// RADIANT - Snapshot Manager Service
// Versioned, restorable snapshots with tiered storage lifecycle (Hot → Warm → Cold)
// Supports RDS Aurora, DynamoDB, and S3 bucket snapshots

import Foundation

actor SnapshotManager {
    
    // MARK: - Types
    
    struct Snapshot: Codable, Sendable, Identifiable {
        let id: String
        let version: String
        let name: String
        let description: String?
        let createdAt: Date
        let createdBy: String
        let environment: String
        let appId: String
        
        var snapshotType: SnapshotType
        var status: SnapshotStatus
        var storageTier: StorageTier
        var tierTransitionDate: Date?
        
        // Resource-specific identifiers
        var auroraSnapshotArn: String?
        var dynamoDBBackupArns: [String]
        var s3ManifestKey: String?
        
        // Metadata
        var sizeBytes: Int64
        var tableCount: Int
        var resourceCount: Int
        var tags: [String: String]
        
        // Restoration info
        var lastRestoredAt: Date?
        var restoreCount: Int
    }
    
    enum SnapshotType: String, Codable, Sendable {
        case full = "full"                    // Aurora + DynamoDB + S3 metadata
        case auroraOnly = "aurora_only"       // Just Aurora cluster
        case dynamoDBOnly = "dynamodb_only"   // Just DynamoDB tables
        case schemaOnly = "schema_only"       // Schema without data (pre-migration)
        case incremental = "incremental"      // Delta from previous snapshot
    }
    
    enum SnapshotStatus: String, Codable, Sendable {
        case creating = "creating"
        case available = "available"
        case restoring = "restoring"
        case deleting = "deleting"
        case failed = "failed"
        case transitioning = "transitioning"  // Moving between tiers
    }
    
    enum StorageTier: String, Codable, Sendable, CaseIterable {
        case hot = "hot"       // Instant restore, highest cost (0-7 days)
        case warm = "warm"     // Minutes to restore, medium cost (7-30 days)
        case cold = "cold"     // Hours to restore, lowest cost (30+ days)
        case archive = "archive" // Deep archive, 12+ hours restore (1+ year)
        
        var description: String {
            switch self {
            case .hot: return "Hot (instant restore, 0-7 days)"
            case .warm: return "Warm (minutes to restore, 7-30 days)"
            case .cold: return "Cold (hours to restore, 30+ days)"
            case .archive: return "Archive (12+ hours, 1+ year retention)"
            }
        }
        
        var retentionDays: Int {
            switch self {
            case .hot: return 7
            case .warm: return 30
            case .cold: return 365
            case .archive: return 2555 // 7 years
            }
        }
        
        var restoreTimeEstimate: String {
            switch self {
            case .hot: return "Instant"
            case .warm: return "3-5 minutes"
            case .cold: return "1-5 hours"
            case .archive: return "12-48 hours"
            }
        }
    }
    
    struct SnapshotPolicy: Codable, Sendable {
        var autoSnapshotEnabled: Bool
        var autoSnapshotSchedule: String // Cron expression
        var retentionDays: Int
        var tierTransitionRules: [TierTransitionRule]
        var maxSnapshotsPerTier: Int
        var preDeploymentSnapshotEnabled: Bool
        var preSchemaMigrationSnapshotEnabled: Bool
    }
    
    struct TierTransitionRule: Codable, Sendable {
        let fromTier: StorageTier
        let toTier: StorageTier
        let afterDays: Int
    }
    
    struct RestoreOptions: Codable, Sendable {
        var targetEnvironment: String?  // nil = restore to same environment
        var restoreAurora: Bool
        var restoreDynamoDB: Bool
        var restoreToPointInTime: Date?
        var skipTableData: Bool  // Restore schema only
        var renamePrefix: String?  // Add prefix to restored resources
    }
    
    struct SnapshotResult: Codable, Sendable {
        let snapshotId: String
        let version: String
        let success: Bool
        let duration: TimeInterval
        let sizeBytes: Int64
        var errors: [String]
        var warnings: [String]
    }
    
    struct RestoreResult: Codable, Sendable {
        let snapshotId: String
        let success: Bool
        let duration: TimeInterval
        var restoredResources: [String]
        var errors: [String]
        var warnings: [String]
    }
    
    // MARK: - Properties
    
    private let awsCliPath: String
    private let storageDirectory: URL
    private var snapshots: [Snapshot] = []
    private var policy: SnapshotPolicy
    
    static let defaultPolicy = SnapshotPolicy(
        autoSnapshotEnabled: true,
        autoSnapshotSchedule: "0 2 * * *", // 2 AM daily
        retentionDays: 365,
        tierTransitionRules: [
            TierTransitionRule(fromTier: .hot, toTier: .warm, afterDays: 7),
            TierTransitionRule(fromTier: .warm, toTier: .cold, afterDays: 30),
            TierTransitionRule(fromTier: .cold, toTier: .archive, afterDays: 365)
        ],
        maxSnapshotsPerTier: 10,
        preDeploymentSnapshotEnabled: true,
        preSchemaMigrationSnapshotEnabled: true
    )
    
    // MARK: - Initialization
    
    init() {
        let paths = ["/opt/homebrew/bin/aws", "/usr/local/bin/aws", "/usr/bin/aws"]
        self.awsCliPath = paths.first { FileManager.default.fileExists(atPath: $0) } ?? "/usr/local/bin/aws"
        
        self.storageDirectory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            .appendingPathComponent("RadiantDeployer")
            .appendingPathComponent("snapshots")
        
        try? FileManager.default.createDirectory(at: storageDirectory, withIntermediateDirectories: true)
        
        self.policy = Self.defaultPolicy
        
        Task {
            await loadSnapshots()
        }
    }
    
    // MARK: - Create Snapshot
    
    /// Create a full snapshot (Aurora + DynamoDB + S3 metadata)
    func createSnapshot(
        name: String,
        description: String?,
        environment: String,
        appId: String,
        credentials: CredentialSet,
        type: SnapshotType = .full,
        onProgress: @escaping (String, Double) -> Void
    ) async throws -> SnapshotResult {
        let startTime = Date()
        let version = generateVersion()
        let snapshotId = "\(appId)-\(environment)-\(version)"
        
        var snapshot = Snapshot(
            id: snapshotId,
            version: version,
            name: name,
            description: description,
            createdAt: Date(),
            createdBy: NSUserName(),
            environment: environment,
            appId: appId,
            snapshotType: type,
            status: .creating,
            storageTier: .hot,
            tierTransitionDate: nil,
            auroraSnapshotArn: nil,
            dynamoDBBackupArns: [],
            s3ManifestKey: nil,
            sizeBytes: 0,
            tableCount: 0,
            resourceCount: 0,
            tags: ["radiant:snapshot": "true", "radiant:version": version],
            lastRestoredAt: nil,
            restoreCount: 0
        )
        
        var errors: [String] = []
        var warnings: [String] = []
        var totalSize: Int64 = 0
        
        do {
            // Step 1: Create Aurora snapshot
            if type == .full || type == .auroraOnly {
                onProgress("Creating Aurora cluster snapshot...", 0.1)
                let auroraResult = try await createAuroraSnapshot(
                    appId: appId,
                    environment: environment,
                    snapshotId: snapshotId,
                    credentials: credentials
                )
                snapshot.auroraSnapshotArn = auroraResult.arn
                snapshot.tableCount = auroraResult.tableCount
                totalSize += auroraResult.sizeBytes
                onProgress("Aurora snapshot created", 0.4)
            }
            
            // Step 2: Create DynamoDB backups
            if type == .full || type == .dynamoDBOnly {
                onProgress("Creating DynamoDB table backups...", 0.5)
                let dynamoResult = try await createDynamoDBBackups(
                    appId: appId,
                    environment: environment,
                    snapshotId: snapshotId,
                    credentials: credentials
                )
                snapshot.dynamoDBBackupArns = dynamoResult.backupArns
                snapshot.resourceCount += dynamoResult.tableCount
                totalSize += dynamoResult.sizeBytes
                onProgress("DynamoDB backups created", 0.7)
            }
            
            // Step 3: Create S3 manifest (metadata only, not objects)
            if type == .full {
                onProgress("Creating S3 bucket manifest...", 0.8)
                let s3Result = try await createS3Manifest(
                    appId: appId,
                    environment: environment,
                    snapshotId: snapshotId,
                    credentials: credentials
                )
                snapshot.s3ManifestKey = s3Result.manifestKey
                snapshot.resourceCount += s3Result.bucketCount
                warnings.append(contentsOf: s3Result.warnings)
                onProgress("S3 manifest created", 0.9)
            }
            
            snapshot.sizeBytes = totalSize
            snapshot.status = .available
            
            // Save snapshot metadata
            snapshots.append(snapshot)
            try await saveSnapshots()
            
            onProgress("Snapshot complete!", 1.0)
            
            RadiantLogger.info("✅ Snapshot created: \(snapshotId) (v\(version))", category: RadiantLogger.aws)
            
        } catch {
            snapshot.status = .failed
            errors.append(error.localizedDescription)
            RadiantLogger.error("❌ Snapshot failed: \(error)", category: RadiantLogger.aws)
        }
        
        let duration = Date().timeIntervalSince(startTime)
        
        return SnapshotResult(
            snapshotId: snapshotId,
            version: version,
            success: snapshot.status == .available,
            duration: duration,
            sizeBytes: totalSize,
            errors: errors,
            warnings: warnings
        )
    }
    
    // MARK: - Restore Snapshot
    
    /// Restore from a snapshot
    func restoreSnapshot(
        snapshotId: String,
        options: RestoreOptions,
        credentials: CredentialSet,
        onProgress: @escaping (String, Double) -> Void
    ) async throws -> RestoreResult {
        let startTime = Date()
        
        guard let snapshot = snapshots.first(where: { $0.id == snapshotId }) else {
            throw SnapshotError.notFound(snapshotId)
        }
        
        // Check if snapshot needs retrieval from cold storage
        if snapshot.storageTier == .cold || snapshot.storageTier == .archive {
            onProgress("Initiating retrieval from \(snapshot.storageTier.rawValue) storage...", 0.05)
            try await initiateRetrieval(snapshot: snapshot, credentials: credentials)
            // Note: For cold/archive, this will take time. Return early with pending status.
            if snapshot.storageTier == .archive {
                throw SnapshotError.retrievalPending("Archive retrieval initiated. Estimated time: 12-48 hours.")
            }
        }
        
        var restoredResources: [String] = []
        var errors: [String] = []
        var warnings: [String] = []
        
        // Restore Aurora
        if options.restoreAurora, let auroraArn = snapshot.auroraSnapshotArn {
            onProgress("Restoring Aurora cluster from snapshot...", 0.2)
            do {
                let targetCluster = options.renamePrefix.map { "\($0)-\(snapshot.appId)-\(snapshot.environment)" }
                    ?? "\(snapshot.appId)-\(snapshot.environment)"
                
                try await restoreAuroraFromSnapshot(
                    snapshotArn: auroraArn,
                    targetClusterIdentifier: targetCluster,
                    credentials: credentials
                )
                restoredResources.append("Aurora: \(targetCluster)")
                onProgress("Aurora cluster restored", 0.5)
            } catch {
                errors.append("Aurora restore failed: \(error.localizedDescription)")
            }
        }
        
        // Restore DynamoDB
        if options.restoreDynamoDB, !snapshot.dynamoDBBackupArns.isEmpty {
            onProgress("Restoring DynamoDB tables from backups...", 0.6)
            for (index, backupArn) in snapshot.dynamoDBBackupArns.enumerated() {
                do {
                    let tableName = try await restoreDynamoDBFromBackup(
                        backupArn: backupArn,
                        renamePrefix: options.renamePrefix,
                        credentials: credentials
                    )
                    restoredResources.append("DynamoDB: \(tableName)")
                } catch {
                    errors.append("DynamoDB restore failed for backup \(index): \(error.localizedDescription)")
                }
            }
            onProgress("DynamoDB tables restored", 0.8)
        }
        
        // Update snapshot metadata
        if var updatedSnapshot = snapshots.first(where: { $0.id == snapshotId }) {
            updatedSnapshot.lastRestoredAt = Date()
            updatedSnapshot.restoreCount += 1
            if let index = snapshots.firstIndex(where: { $0.id == snapshotId }) {
                snapshots[index] = updatedSnapshot
            }
            try await saveSnapshots()
        }
        
        onProgress("Restore complete!", 1.0)
        
        let duration = Date().timeIntervalSince(startTime)
        
        RadiantLogger.info("✅ Snapshot restored: \(snapshotId)", category: RadiantLogger.aws)
        
        return RestoreResult(
            snapshotId: snapshotId,
            success: errors.isEmpty,
            duration: duration,
            restoredResources: restoredResources,
            errors: errors,
            warnings: warnings
        )
    }
    
    // MARK: - Tier Management
    
    /// Process tier transitions based on policy
    func processTierTransitions() async throws {
        let now = Date()
        
        for rule in policy.tierTransitionRules {
            let cutoffDate = Calendar.current.date(byAdding: .day, value: -rule.afterDays, to: now)!
            
            let snapshotsToTransition = snapshots.filter {
                $0.storageTier == rule.fromTier &&
                $0.status == .available &&
                $0.createdAt < cutoffDate
            }
            
            for snapshot in snapshotsToTransition {
                try await transitionToTier(snapshotId: snapshot.id, targetTier: rule.toTier)
            }
        }
    }
    
    /// Manually transition a snapshot to a different tier
    func transitionToTier(snapshotId: String, targetTier: StorageTier) async throws {
        guard let index = snapshots.firstIndex(where: { $0.id == snapshotId }) else {
            throw SnapshotError.notFound(snapshotId)
        }
        
        var snapshot = snapshots[index]
        let previousTier = snapshot.storageTier
        
        snapshot.status = .transitioning
        snapshots[index] = snapshot
        
        RadiantLogger.info("Transitioning snapshot \(snapshotId) from \(previousTier.rawValue) to \(targetTier.rawValue)", category: RadiantLogger.aws)
        
        // In production, this would call AWS APIs to change storage class
        // For Aurora: Modify snapshot storage class
        // For DynamoDB: This is handled automatically by AWS
        // For S3: Change storage class of manifest
        
        snapshot.storageTier = targetTier
        snapshot.tierTransitionDate = Date()
        snapshot.status = .available
        snapshots[index] = snapshot
        
        try await saveSnapshots()
        
        RadiantLogger.info("✅ Snapshot \(snapshotId) transitioned to \(targetTier.rawValue)", category: RadiantLogger.aws)
    }
    
    // MARK: - List & Query
    
    /// Get all snapshots
    func listSnapshots(environment: String? = nil, tier: StorageTier? = nil) -> [Snapshot] {
        var filtered = snapshots
        
        if let env = environment {
            filtered = filtered.filter { $0.environment == env }
        }
        
        if let t = tier {
            filtered = filtered.filter { $0.storageTier == t }
        }
        
        return filtered.sorted { $0.createdAt > $1.createdAt }
    }
    
    /// Get snapshot by ID
    func getSnapshot(id: String) -> Snapshot? {
        return snapshots.first { $0.id == id }
    }
    
    /// Get snapshots by tier
    func getSnapshotsByTier() -> [StorageTier: [Snapshot]] {
        Dictionary(grouping: snapshots) { $0.storageTier }
    }
    
    // MARK: - Delete
    
    /// Delete a snapshot
    func deleteSnapshot(snapshotId: String, credentials: CredentialSet) async throws {
        guard let index = snapshots.firstIndex(where: { $0.id == snapshotId }) else {
            throw SnapshotError.notFound(snapshotId)
        }
        
        var snapshot = snapshots[index]
        snapshot.status = .deleting
        snapshots[index] = snapshot
        
        // Delete Aurora snapshot
        if let auroraArn = snapshot.auroraSnapshotArn {
            try await deleteAuroraSnapshot(snapshotArn: auroraArn, credentials: credentials)
        }
        
        // Delete DynamoDB backups
        for backupArn in snapshot.dynamoDBBackupArns {
            try await deleteDynamoDBBackup(backupArn: backupArn, credentials: credentials)
        }
        
        // Remove from local list
        snapshots.remove(at: index)
        try await saveSnapshots()
        
        RadiantLogger.info("✅ Snapshot deleted: \(snapshotId)", category: RadiantLogger.aws)
    }
    
    // MARK: - Policy Management (Read-Only)
    // NOTE: Storage policy configuration is managed in the Radiant Admin Dashboard.
    // The deployer fetches policy from the API and does not allow local modifications.
    // To change tier rules, costs, or auto-snapshot settings, use:
    //   Admin Dashboard → Platform → Snapshots → Policy tab
    
    func getPolicy() -> SnapshotPolicy {
        return policy
    }
    
    /// Fetch latest policy from Admin Dashboard API
    func refreshPolicyFromAPI(baseURL: String, tenantId: String) async throws {
        guard let url = URL(string: "\(baseURL)/api/admin/snapshot-storage/config") else { return }
        
        var request = URLRequest(url: url)
        request.setValue(tenantId, forHTTPHeaderField: "X-Tenant-Id")
        
        let (data, _) = try await URLSession.shared.data(for: request)
        
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let config = json["data"] as? [String: Any] {
            policy = SnapshotPolicy(
                autoSnapshotEnabled: config["auto_snapshot_enabled"] as? Bool ?? true,
                autoSnapshotSchedule: config["auto_snapshot_schedule"] as? String ?? "0 2 * * *",
                retentionDays: config["retention_days"] as? Int ?? 365,
                tierTransitionRules: policy.tierTransitionRules, // Keep defaults, API returns separately
                maxSnapshotsPerTier: config["max_snapshots_per_tier"] as? Int ?? 10,
                preDeploymentSnapshotEnabled: config["pre_deployment_snapshot_enabled"] as? Bool ?? true,
                preSchemaMigrationSnapshotEnabled: config["pre_migration_snapshot_enabled"] as? Bool ?? true
            )
        }
    }
    
    // MARK: - AWS Operations
    
    private struct AuroraSnapshotResult {
        let arn: String
        let tableCount: Int
        let sizeBytes: Int64
    }
    
    private func createAuroraSnapshot(
        appId: String,
        environment: String,
        snapshotId: String,
        credentials: CredentialSet
    ) async throws -> AuroraSnapshotResult {
        let clusterIdentifier = "radiant-\(appId)-\(environment)"
        let snapshotIdentifier = "radiant-snapshot-\(snapshotId)"
        
        let result = try await runAwsCommand([
            "rds", "create-db-cluster-snapshot",
            "--db-cluster-identifier", clusterIdentifier,
            "--db-cluster-snapshot-identifier", snapshotIdentifier,
            "--tags", "Key=radiant:snapshot,Value=true",
            "--region", credentials.region,
            "--output", "json"
        ], credentials: credentials)
        
        guard let json = try? JSONSerialization.jsonObject(with: result) as? [String: Any],
              let snapshot = json["DBClusterSnapshot"] as? [String: Any],
              let arn = snapshot["DBClusterSnapshotArn"] as? String else {
            throw SnapshotError.creationFailed("Failed to parse Aurora snapshot response")
        }
        
        // Wait for snapshot to be available
        try await waitForAuroraSnapshot(snapshotIdentifier: snapshotIdentifier, credentials: credentials)
        
        return AuroraSnapshotResult(
            arn: arn,
            tableCount: 0, // Would need to query schema
            sizeBytes: (snapshot["AllocatedStorage"] as? Int64 ?? 0) * 1024 * 1024 * 1024
        )
    }
    
    private func waitForAuroraSnapshot(snapshotIdentifier: String, credentials: CredentialSet) async throws {
        var attempts = 0
        let maxAttempts = 60 // 10 minutes max
        
        while attempts < maxAttempts {
            let result = try await runAwsCommand([
                "rds", "describe-db-cluster-snapshots",
                "--db-cluster-snapshot-identifier", snapshotIdentifier,
                "--region", credentials.region,
                "--output", "json"
            ], credentials: credentials)
            
            if let json = try? JSONSerialization.jsonObject(with: result) as? [String: Any],
               let snapshots = json["DBClusterSnapshots"] as? [[String: Any]],
               let snapshot = snapshots.first,
               let status = snapshot["Status"] as? String {
                if status == "available" {
                    return
                }
            }
            
            try await Task.sleep(nanoseconds: 10_000_000_000) // 10 seconds
            attempts += 1
        }
        
        throw SnapshotError.timeout("Aurora snapshot creation timed out")
    }
    
    private struct DynamoDBBackupResult {
        let backupArns: [String]
        let tableCount: Int
        let sizeBytes: Int64
    }
    
    private func createDynamoDBBackups(
        appId: String,
        environment: String,
        snapshotId: String,
        credentials: CredentialSet
    ) async throws -> DynamoDBBackupResult {
        // List tables with prefix
        let prefix = "radiant-\(appId)-\(environment)"
        let listResult = try await runAwsCommand([
            "dynamodb", "list-tables",
            "--region", credentials.region,
            "--output", "json"
        ], credentials: credentials)
        
        guard let json = try? JSONSerialization.jsonObject(with: listResult) as? [String: Any],
              let tables = json["TableNames"] as? [String] else {
            return DynamoDBBackupResult(backupArns: [], tableCount: 0, sizeBytes: 0)
        }
        
        let radiantTables = tables.filter { $0.hasPrefix(prefix) }
        var backupArns: [String] = []
        var totalSize: Int64 = 0
        
        for table in radiantTables {
            let backupName = "\(snapshotId)-\(table)"
            let backupResult = try await runAwsCommand([
                "dynamodb", "create-backup",
                "--table-name", table,
                "--backup-name", backupName,
                "--region", credentials.region,
                "--output", "json"
            ], credentials: credentials)
            
            if let backupJson = try? JSONSerialization.jsonObject(with: backupResult) as? [String: Any],
               let details = backupJson["BackupDetails"] as? [String: Any],
               let arn = details["BackupArn"] as? String {
                backupArns.append(arn)
                totalSize += (details["BackupSizeBytes"] as? Int64) ?? 0
            }
        }
        
        return DynamoDBBackupResult(
            backupArns: backupArns,
            tableCount: radiantTables.count,
            sizeBytes: totalSize
        )
    }
    
    private struct S3ManifestResult {
        let manifestKey: String
        let bucketCount: Int
        let warnings: [String]
    }
    
    private func createS3Manifest(
        appId: String,
        environment: String,
        snapshotId: String,
        credentials: CredentialSet
    ) async throws -> S3ManifestResult {
        // List buckets and create manifest (metadata only)
        let prefix = "radiant-\(appId)-\(environment)"
        let listResult = try await runAwsCommand([
            "s3api", "list-buckets",
            "--region", credentials.region,
            "--output", "json"
        ], credentials: credentials)
        
        guard let json = try? JSONSerialization.jsonObject(with: listResult) as? [String: Any],
              let buckets = json["Buckets"] as? [[String: Any]] else {
            return S3ManifestResult(manifestKey: "", bucketCount: 0, warnings: ["Could not list buckets"])
        }
        
        let radiantBuckets = buckets.compactMap { $0["Name"] as? String }.filter { $0.hasPrefix(prefix) }
        
        var manifest: [String: Any] = [
            "snapshotId": snapshotId,
            "createdAt": ISO8601DateFormatter().string(from: Date()),
            "buckets": radiantBuckets.map { ["name": $0] }
        ]
        
        // Save manifest locally
        let manifestFile = storageDirectory.appendingPathComponent("\(snapshotId)-s3-manifest.json")
        let manifestData = try JSONSerialization.data(withJSONObject: manifest, options: .prettyPrinted)
        try manifestData.write(to: manifestFile)
        
        return S3ManifestResult(
            manifestKey: manifestFile.path,
            bucketCount: radiantBuckets.count,
            warnings: ["S3 manifest captures bucket config only, not objects"]
        )
    }
    
    private func restoreAuroraFromSnapshot(
        snapshotArn: String,
        targetClusterIdentifier: String,
        credentials: CredentialSet
    ) async throws {
        _ = try await runAwsCommand([
            "rds", "restore-db-cluster-from-snapshot",
            "--db-cluster-identifier", targetClusterIdentifier,
            "--snapshot-identifier", snapshotArn,
            "--engine", "aurora-postgresql",
            "--region", credentials.region,
            "--output", "json"
        ], credentials: credentials)
    }
    
    private func restoreDynamoDBFromBackup(
        backupArn: String,
        renamePrefix: String?,
        credentials: CredentialSet
    ) async throws -> String {
        // Extract original table name from backup ARN
        let components = backupArn.components(separatedBy: "/")
        let tableName = components.last ?? "restored-table"
        let targetTableName = renamePrefix.map { "\($0)-\(tableName)" } ?? tableName
        
        _ = try await runAwsCommand([
            "dynamodb", "restore-table-from-backup",
            "--target-table-name", targetTableName,
            "--backup-arn", backupArn,
            "--region", credentials.region,
            "--output", "json"
        ], credentials: credentials)
        
        return targetTableName
    }
    
    private func initiateRetrieval(snapshot: Snapshot, credentials: CredentialSet) async throws {
        // For cold/archive tier, initiate retrieval
        // This would typically trigger Glacier retrieval for archived snapshots
        RadiantLogger.info("Initiating retrieval for snapshot: \(snapshot.id)", category: RadiantLogger.aws)
    }
    
    private func deleteAuroraSnapshot(snapshotArn: String, credentials: CredentialSet) async throws {
        let snapshotIdentifier = snapshotArn.components(separatedBy: ":").last ?? ""
        _ = try await runAwsCommand([
            "rds", "delete-db-cluster-snapshot",
            "--db-cluster-snapshot-identifier", snapshotIdentifier,
            "--region", credentials.region
        ], credentials: credentials)
    }
    
    private func deleteDynamoDBBackup(backupArn: String, credentials: CredentialSet) async throws {
        _ = try await runAwsCommand([
            "dynamodb", "delete-backup",
            "--backup-arn", backupArn,
            "--region", credentials.region
        ], credentials: credentials)
    }
    
    // MARK: - Helpers
    
    private func generateVersion() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyyMMdd-HHmmss"
        return formatter.string(from: Date())
    }
    
    private func runAwsCommand(_ arguments: [String], credentials: CredentialSet) async throws -> Data {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: awsCliPath)
        process.arguments = arguments
        
        var env = ProcessInfo.processInfo.environment
        env["AWS_ACCESS_KEY_ID"] = credentials.accessKeyId
        env["AWS_SECRET_ACCESS_KEY"] = credentials.secretAccessKey
        env["AWS_DEFAULT_REGION"] = credentials.region
        process.environment = env
        
        let outputPipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = errorPipe
        
        try process.run()
        process.waitUntilExit()
        
        if process.terminationStatus != 0 {
            let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
            let errorString = String(data: errorData, encoding: .utf8) ?? "Unknown error"
            throw SnapshotError.awsError(errorString)
        }
        
        return outputPipe.fileHandleForReading.readDataToEndOfFile()
    }
    
    // MARK: - Persistence
    
    private func loadSnapshots() async {
        let file = storageDirectory.appendingPathComponent("snapshots.json")
        guard let data = try? Data(contentsOf: file) else { return }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        snapshots = (try? decoder.decode([Snapshot].self, from: data)) ?? []
    }
    
    private func saveSnapshots() async throws {
        let file = storageDirectory.appendingPathComponent("snapshots.json")
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        
        let data = try encoder.encode(snapshots)
        try data.write(to: file)
    }
    
    // NOTE: savePolicy() removed - policy is now managed via Radiant Admin Dashboard
    // Use refreshPolicyFromAPI() to fetch the latest configuration
    
    // MARK: - Errors
    
    enum SnapshotError: Error, LocalizedError {
        case notFound(String)
        case creationFailed(String)
        case restoreFailed(String)
        case timeout(String)
        case retrievalPending(String)
        case awsError(String)
        
        var errorDescription: String? {
            switch self {
            case .notFound(let id): return "Snapshot not found: \(id)"
            case .creationFailed(let msg): return "Snapshot creation failed: \(msg)"
            case .restoreFailed(let msg): return "Snapshot restore failed: \(msg)"
            case .timeout(let msg): return "Operation timed out: \(msg)"
            case .retrievalPending(let msg): return "Retrieval pending: \(msg)"
            case .awsError(let msg): return "AWS error: \(msg)"
            }
        }
    }
}

// MARK: - Singleton

extension SnapshotManager {
    static let shared = SnapshotManager()
}
