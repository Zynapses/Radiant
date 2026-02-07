import Foundation

/// Snapshot Service for AWS resource snapshots - REAL AWS IMPLEMENTATION
/// Manages Aurora, DynamoDB, S3, and Lambda version snapshots with full AWS API calls
actor SnapshotService {
    
    // MARK: - Types
    
    enum SnapshotError: Error, LocalizedError {
        case creationFailed(String)
        case restoreFailed(String)
        case notFound(String)
        case timeout
        case invalidState(String)
        case awsError(String)
        case resourceNotFound(String)
        case waitTimeout(String)
        
        var errorDescription: String? {
            switch self {
            case .creationFailed(let msg): return "Snapshot creation failed: \(msg)"
            case .restoreFailed(let msg): return "Snapshot restore failed: \(msg)"
            case .notFound(let id): return "Snapshot not found: \(id)"
            case .timeout: return "Snapshot operation timed out"
            case .invalidState(let msg): return "Invalid state: \(msg)"
            case .awsError(let msg): return "AWS error: \(msg)"
            case .resourceNotFound(let resource): return "Resource not found: \(resource)"
            case .waitTimeout(let resource): return "Timeout waiting for \(resource)"
            }
        }
    }
    
    struct SnapshotManifest: Codable, Sendable {
        let id: String
        let appId: String
        let environment: String
        let version: String
        let createdAt: Date
        let expiresAt: Date
        var resources: SnapshotResources
        var status: SnapshotStatus
        var metadata: [String: String]
        var preservationConfig: DataPreservationConfig?
        
        enum SnapshotStatus: String, Codable, Sendable {
            case creating = "creating"
            case available = "available"
            case restoring = "restoring"
            case deleting = "deleting"
            case failed = "failed"
            case expired = "expired"
        }
    }
    
    /// Configuration for what data to preserve during deployment
    struct DataPreservationConfig: Codable, Sendable {
        var preserveAurora: Bool = true
        var preserveDynamoDB: Bool = true
        var preserveS3Buckets: [String] = []
        var downloadS3ToLocal: Bool = false
        var localS3BackupPath: String?
        
        static var preserveAll: DataPreservationConfig {
            DataPreservationConfig(
                preserveAurora: true,
                preserveDynamoDB: true,
                preserveS3Buckets: [],
                downloadS3ToLocal: false
            )
        }
        
        static var preserveNone: DataPreservationConfig {
            DataPreservationConfig(
                preserveAurora: false,
                preserveDynamoDB: false,
                preserveS3Buckets: [],
                downloadS3ToLocal: false
            )
        }
    }
    
    struct SnapshotResources: Codable, Sendable {
        var aurora: AuroraSnapshot?
        var dynamoDB: [DynamoDBSnapshot]
        var s3: [S3Snapshot]
        var lambda: [LambdaSnapshot]
    }
    
    struct AuroraSnapshot: Codable, Sendable {
        let snapshotId: String
        let clusterIdentifier: String
        let clusterArn: String
        let snapshotArn: String
        var status: String
        let sizeGB: Double
        let createdAt: Date
        let engine: String
        let engineVersion: String
    }
    
    struct DynamoDBSnapshot: Codable, Sendable {
        let tableName: String
        let tableArn: String
        let backupArn: String
        var status: String
        let itemCount: Int
        let sizeBytes: Int64
        let createdAt: Date
    }
    
    struct S3Snapshot: Codable, Sendable {
        let bucketName: String
        let bucketArn: String
        let manifestKey: String
        let objectCount: Int
        let totalSizeBytes: Int64
        let createdAt: Date
        var localPath: String?
    }
    
    struct LambdaSnapshot: Codable, Sendable {
        let functionName: String
        let functionArn: String
        let version: String
        let codeSize: Int64
        let lastModified: Date
        let runtime: String
        let handler: String
    }
    
    // MARK: - Properties
    
    private var snapshots: [String: SnapshotManifest] = [:]
    private let awsService: AWSService
    private let storageManager: LocalStorageManager
    private let retentionDays: Int = 30
    private let maxSnapshots: Int = 10
    private let awsCliPath: String
    private let snapshotsDirectory: URL
    
    // MARK: - Initialization
    
    init(awsService: AWSService, storageManager: LocalStorageManager) {
        self.awsService = awsService
        self.storageManager = storageManager
        self.awsCliPath = Self.findAwsCliPath()
        self.snapshotsDirectory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            .appendingPathComponent("RadiantDeployer")
            .appendingPathComponent("snapshots")
        
        // Ensure directory exists
        try? FileManager.default.createDirectory(at: snapshotsDirectory, withIntermediateDirectories: true)
        
        // Load persisted snapshots
        Task { await loadPersistedSnapshots() }
    }
    
    private static func findAwsCliPath() -> String {
        let paths = [
            "/opt/homebrew/bin/aws",
            "/usr/local/bin/aws",
            "/usr/bin/aws"
        ]
        for path in paths {
            if FileManager.default.fileExists(atPath: path) {
                return path
            }
        }
        return "/usr/local/bin/aws"
    }
    
    private func loadPersistedSnapshots() async {
        let manifestsDir = snapshotsDirectory.appendingPathComponent("manifests")
        guard let files = try? FileManager.default.contentsOfDirectory(at: manifestsDir, includingPropertiesForKeys: nil) else {
            return
        }
        
        for file in files where file.pathExtension == "json" {
            if let data = try? Data(contentsOf: file),
               let manifest = try? JSONDecoder().decode(SnapshotManifest.self, from: data) {
                snapshots[manifest.id] = manifest
            }
        }
        RadiantLogger.info("Loaded \(snapshots.count) persisted snapshots", category: RadiantLogger.aws)
    }
    
    private func persistSnapshot(_ manifest: SnapshotManifest) async throws {
        let manifestsDir = snapshotsDirectory.appendingPathComponent("manifests")
        try FileManager.default.createDirectory(at: manifestsDir, withIntermediateDirectories: true)
        
        let data = try JSONEncoder().encode(manifest)
        let file = manifestsDir.appendingPathComponent("\(manifest.id).json")
        try data.write(to: file)
    }
    
    private func removePersistedSnapshot(_ id: String) async throws {
        let file = snapshotsDirectory.appendingPathComponent("manifests").appendingPathComponent("\(id).json")
        try? FileManager.default.removeItem(at: file)
    }
    
    // MARK: - Snapshot Creation
    
    func createSnapshot(
        appId: String,
        environment: String,
        version: String,
        credentials: CredentialSet,
        preservationConfig: DataPreservationConfig = .preserveAll,
        onProgress: @escaping (String, Double) -> Void
    ) async throws -> SnapshotManifest {
        let snapshotId = "snap-\(UUID().uuidString.prefix(8))-\(Int(Date().timeIntervalSince1970))"
        
        var manifest = SnapshotManifest(
            id: snapshotId,
            appId: appId,
            environment: environment,
            version: version,
            createdAt: Date(),
            expiresAt: Date().addingTimeInterval(Double(retentionDays * 24 * 60 * 60)),
            resources: SnapshotResources(aurora: nil, dynamoDB: [], s3: [], lambda: []),
            status: .creating,
            metadata: [
                "createdBy": NSUserName(),
                "radiantVersion": RADIANT_VERSION,
                "region": credentials.region
            ],
            preservationConfig: preservationConfig
        )
        
        snapshots[snapshotId] = manifest
        
        do {
            // Step 1: Aurora snapshot (40% of progress)
            if preservationConfig.preserveAurora {
                onProgress("Creating Aurora cluster snapshot...", 0.0)
                manifest.resources.aurora = try await createAuroraSnapshot(
                    appId: appId,
                    environment: environment,
                    snapshotId: snapshotId,
                    credentials: credentials
                )
                onProgress("Aurora snapshot created: \(manifest.resources.aurora?.snapshotId ?? "")", 0.4)
            } else {
                onProgress("Skipping Aurora snapshot (not selected)", 0.4)
            }
            
            // Step 2: DynamoDB backups (25% of progress)
            if preservationConfig.preserveDynamoDB {
                onProgress("Creating DynamoDB on-demand backups...", 0.4)
                manifest.resources.dynamoDB = try await createDynamoDBSnapshots(
                    appId: appId,
                    environment: environment,
                    snapshotId: snapshotId,
                    credentials: credentials
                )
                onProgress("DynamoDB backups created: \(manifest.resources.dynamoDB.count) tables", 0.65)
            } else {
                onProgress("Skipping DynamoDB backups (not selected)", 0.65)
            }
            
            // Step 3: S3 bucket manifests (20% of progress)
            if !preservationConfig.preserveS3Buckets.isEmpty || preservationConfig.downloadS3ToLocal {
                onProgress("Capturing S3 bucket state...", 0.65)
                manifest.resources.s3 = try await captureS3State(
                    appId: appId,
                    environment: environment,
                    snapshotId: snapshotId,
                    credentials: credentials,
                    config: preservationConfig
                )
                onProgress("S3 state captured: \(manifest.resources.s3.count) buckets", 0.85)
            } else {
                onProgress("Skipping S3 capture (not selected)", 0.85)
            }
            
            // Step 4: Lambda versions (15% of progress)
            onProgress("Recording Lambda function versions...", 0.85)
            manifest.resources.lambda = try await captureLambdaVersions(
                appId: appId,
                environment: environment,
                credentials: credentials
            )
            onProgress("Lambda versions recorded: \(manifest.resources.lambda.count) functions", 1.0)
            
            manifest.status = .available
            snapshots[snapshotId] = manifest
            
            // Persist to local storage
            try await persistSnapshot(manifest)
            
            // Cleanup old snapshots
            try await cleanupOldSnapshots(credentials: credentials)
            
            RadiantLogger.info("Snapshot created successfully: \(snapshotId)", category: RadiantLogger.aws)
            return manifest
            
        } catch {
            manifest.status = .failed
            manifest.metadata["error"] = error.localizedDescription
            snapshots[snapshotId] = manifest
            try? await persistSnapshot(manifest)
            
            RadiantLogger.error("Snapshot creation failed: \(error.localizedDescription)", category: RadiantLogger.aws)
            throw SnapshotError.creationFailed(error.localizedDescription)
        }
    }
    
    // MARK: - Snapshot Restore
    
    func restoreSnapshot(
        _ snapshotId: String,
        credentials: CredentialSet,
        onProgress: @escaping (String, Double) -> Void
    ) async throws {
        guard var manifest = snapshots[snapshotId] else {
            throw SnapshotError.notFound(snapshotId)
        }
        
        guard manifest.status == .available else {
            throw SnapshotError.invalidState("Snapshot is \(manifest.status.rawValue), expected 'available'")
        }
        
        manifest.status = .restoring
        snapshots[snapshotId] = manifest
        
        do {
            // Step 1: Restore Aurora
            if let aurora = manifest.resources.aurora {
                onProgress("Restoring Aurora database from snapshot...", 0.0)
                try await restoreAuroraFromSnapshot(aurora, credentials: credentials)
                onProgress("Aurora database restored", 0.5)
            }
            
            // Step 2: Restore DynamoDB
            if !manifest.resources.dynamoDB.isEmpty {
                onProgress("Restoring DynamoDB tables from backups...", 0.5)
                for (index, table) in manifest.resources.dynamoDB.enumerated() {
                    try await restoreDynamoDBFromBackup(table, credentials: credentials)
                    let progress = 0.5 + (0.3 * Double(index + 1) / Double(manifest.resources.dynamoDB.count))
                    onProgress("Restored \(table.tableName)", progress)
                }
            }
            
            // Step 3: Restore S3 from local backup if available
            if !manifest.resources.s3.isEmpty {
                onProgress("Restoring S3 buckets...", 0.8)
                for s3 in manifest.resources.s3 {
                    if let localPath = s3.localPath {
                        try await restoreS3FromLocal(s3, localPath: localPath, credentials: credentials)
                    }
                }
                onProgress("S3 buckets restored", 0.95)
            }
            
            onProgress("Restore complete", 1.0)
            
            manifest.status = .available
            snapshots[snapshotId] = manifest
            try? await persistSnapshot(manifest)
            
            RadiantLogger.info("Snapshot restored successfully: \(snapshotId)", category: RadiantLogger.aws)
            
        } catch {
            manifest.status = .available // Keep available for retry
            manifest.metadata["lastRestoreError"] = error.localizedDescription
            snapshots[snapshotId] = manifest
            try? await persistSnapshot(manifest)
            
            RadiantLogger.error("Snapshot restore failed: \(error.localizedDescription)", category: RadiantLogger.aws)
            throw SnapshotError.restoreFailed(error.localizedDescription)
        }
    }
    
    // MARK: - Real AWS Resource Snapshots
    
    private func createAuroraSnapshot(
        appId: String,
        environment: String,
        snapshotId: String,
        credentials: CredentialSet
    ) async throws -> AuroraSnapshot {
        let clusterIdentifier = "radiant-\(appId)-\(environment.lowercased())"
        let dbSnapshotId = "radiant-\(snapshotId)"
        
        // Create the RDS cluster snapshot via AWS CLI
        let result = try await runAwsCommand([
            "rds", "create-db-cluster-snapshot",
            "--db-cluster-identifier", clusterIdentifier,
            "--db-cluster-snapshot-identifier", dbSnapshotId,
            "--region", credentials.region,
            "--output", "json"
        ], credentials: credentials)
        
        guard let json = try? JSONSerialization.jsonObject(with: result) as? [String: Any],
              let snapshot = json["DBClusterSnapshot"] as? [String: Any] else {
            throw SnapshotError.awsError("Failed to parse Aurora snapshot response")
        }
        
        // Wait for snapshot to become available (poll every 10 seconds, max 30 minutes)
        try await waitForAuroraSnapshot(snapshotId: dbSnapshotId, credentials: credentials, timeoutSeconds: 1800)
        
        // Get final snapshot details
        let details = try await getAuroraSnapshotDetails(snapshotId: dbSnapshotId, credentials: credentials)
        
        return AuroraSnapshot(
            snapshotId: dbSnapshotId,
            clusterIdentifier: clusterIdentifier,
            clusterArn: snapshot["DBClusterArn"] as? String ?? "",
            snapshotArn: snapshot["DBClusterSnapshotArn"] as? String ?? "",
            status: details.status,
            sizeGB: details.sizeGB,
            createdAt: Date(),
            engine: details.engine,
            engineVersion: details.engineVersion
        )
    }
    
    private func waitForAuroraSnapshot(snapshotId: String, credentials: CredentialSet, timeoutSeconds: Int) async throws {
        let startTime = Date()
        
        while Date().timeIntervalSince(startTime) < Double(timeoutSeconds) {
            let details = try await getAuroraSnapshotDetails(snapshotId: snapshotId, credentials: credentials)
            
            if details.status == "available" {
                return
            } else if details.status == "failed" || details.status == "deleted" {
                throw SnapshotError.awsError("Aurora snapshot failed with status: \(details.status)")
            }
            
            try await Task.sleep(nanoseconds: 10_000_000_000) // 10 seconds
        }
        
        throw SnapshotError.waitTimeout("Aurora snapshot \(snapshotId)")
    }
    
    private func getAuroraSnapshotDetails(snapshotId: String, credentials: CredentialSet) async throws -> (status: String, sizeGB: Double, engine: String, engineVersion: String) {
        let result = try await runAwsCommand([
            "rds", "describe-db-cluster-snapshots",
            "--db-cluster-snapshot-identifier", snapshotId,
            "--region", credentials.region,
            "--output", "json"
        ], credentials: credentials)
        
        guard let json = try? JSONSerialization.jsonObject(with: result) as? [String: Any],
              let snapshots = json["DBClusterSnapshots"] as? [[String: Any]],
              let snapshot = snapshots.first else {
            throw SnapshotError.resourceNotFound("Aurora snapshot \(snapshotId)")
        }
        
        return (
            status: snapshot["Status"] as? String ?? "unknown",
            sizeGB: (snapshot["AllocatedStorage"] as? Double) ?? 0,
            engine: snapshot["Engine"] as? String ?? "aurora-postgresql",
            engineVersion: snapshot["EngineVersion"] as? String ?? "unknown"
        )
    }
    
    private func createDynamoDBSnapshots(
        appId: String,
        environment: String,
        snapshotId: String,
        credentials: CredentialSet
    ) async throws -> [DynamoDBSnapshot] {
        // List all DynamoDB tables for this app/environment
        let tables = try await listDynamoDBTables(appId: appId, environment: environment, credentials: credentials)
        
        var backups: [DynamoDBSnapshot] = []
        
        for table in tables {
            let backupName = "radiant-\(snapshotId)-\(table.name.replacingOccurrences(of: "/", with: "-"))"
            
            do {
                let result = try await runAwsCommand([
                    "dynamodb", "create-backup",
                    "--table-name", table.name,
                    "--backup-name", backupName,
                    "--region", credentials.region,
                    "--output", "json"
                ], credentials: credentials)
                
                if let json = try? JSONSerialization.jsonObject(with: result) as? [String: Any],
                   let backupDetails = json["BackupDetails"] as? [String: Any] {
                    backups.append(DynamoDBSnapshot(
                        tableName: table.name,
                        tableArn: table.arn,
                        backupArn: backupDetails["BackupArn"] as? String ?? "",
                        status: backupDetails["BackupStatus"] as? String ?? "CREATING",
                        itemCount: table.itemCount,
                        sizeBytes: table.sizeBytes,
                        createdAt: Date()
                    ))
                }
            } catch {
                RadiantLogger.warning("Failed to backup DynamoDB table \(table.name): \(error.localizedDescription)", category: RadiantLogger.aws)
            }
        }
        
        return backups
    }
    
    private func listDynamoDBTables(appId: String, environment: String, credentials: CredentialSet) async throws -> [(name: String, arn: String, itemCount: Int, sizeBytes: Int64)] {
        let result = try await runAwsCommand([
            "dynamodb", "list-tables",
            "--region", credentials.region,
            "--output", "json"
        ], credentials: credentials)
        
        guard let json = try? JSONSerialization.jsonObject(with: result) as? [String: Any],
              let tableNames = json["TableNames"] as? [String] else {
            return []
        }
        
        // Filter tables that belong to this app/environment
        let prefix = "radiant-\(appId)-\(environment.lowercased())"
        let relevantTables = tableNames.filter { $0.hasPrefix(prefix) }
        
        var tables: [(name: String, arn: String, itemCount: Int, sizeBytes: Int64)] = []
        
        for tableName in relevantTables {
            if let details = try? await getTableDetails(tableName: tableName, credentials: credentials) {
                tables.append(details)
            }
        }
        
        return tables
    }
    
    private func getTableDetails(tableName: String, credentials: CredentialSet) async throws -> (name: String, arn: String, itemCount: Int, sizeBytes: Int64) {
        let result = try await runAwsCommand([
            "dynamodb", "describe-table",
            "--table-name", tableName,
            "--region", credentials.region,
            "--output", "json"
        ], credentials: credentials)
        
        guard let json = try? JSONSerialization.jsonObject(with: result) as? [String: Any],
              let table = json["Table"] as? [String: Any] else {
            throw SnapshotError.resourceNotFound("DynamoDB table \(tableName)")
        }
        
        return (
            name: tableName,
            arn: table["TableArn"] as? String ?? "",
            itemCount: table["ItemCount"] as? Int ?? 0,
            sizeBytes: table["TableSizeBytes"] as? Int64 ?? 0
        )
    }
    
    private func captureS3State(
        appId: String,
        environment: String,
        snapshotId: String,
        credentials: CredentialSet,
        config: DataPreservationConfig
    ) async throws -> [S3Snapshot] {
        // List all S3 buckets for this app/environment
        let buckets = try await listS3Buckets(appId: appId, environment: environment, credentials: credentials)
        
        var snapshots: [S3Snapshot] = []
        let localBackupBase = config.localS3BackupPath ?? snapshotsDirectory.appendingPathComponent("s3-backups").path
        
        for bucket in buckets {
            // Check if this bucket should be preserved
            if !config.preserveS3Buckets.isEmpty && !config.preserveS3Buckets.contains(bucket.name) {
                continue
            }
            
            // Get bucket size and object count
            let stats = await getBucketStats(bucketName: bucket.name, credentials: credentials)
            
            var localPath: String? = nil
            
            // Download to local if requested
            if config.downloadS3ToLocal {
                let bucketBackupPath = "\(localBackupBase)/\(snapshotId)/\(bucket.name)"
                try FileManager.default.createDirectory(atPath: bucketBackupPath, withIntermediateDirectories: true)
                
                try await downloadBucketToLocal(bucketName: bucket.name, localPath: bucketBackupPath, credentials: credentials)
                localPath = bucketBackupPath
            }
            
            snapshots.append(S3Snapshot(
                bucketName: bucket.name,
                bucketArn: bucket.arn,
                manifestKey: "radiant-snapshots/\(snapshotId)/manifest.json",
                objectCount: stats.objectCount,
                totalSizeBytes: stats.totalSizeBytes,
                createdAt: Date(),
                localPath: localPath
            ))
        }
        
        return snapshots
    }
    
    private func listS3Buckets(appId: String, environment: String, credentials: CredentialSet) async throws -> [(name: String, arn: String)] {
        let result = try await runAwsCommand([
            "s3api", "list-buckets",
            "--output", "json"
        ], credentials: credentials)
        
        guard let json = try? JSONSerialization.jsonObject(with: result) as? [String: Any],
              let buckets = json["Buckets"] as? [[String: Any]] else {
            return []
        }
        
        // Filter buckets that belong to this app/environment
        let prefix = "radiant-\(appId)-\(environment.lowercased())"
        
        return buckets.compactMap { bucket -> (name: String, arn: String)? in
            guard let name = bucket["Name"] as? String, name.hasPrefix(prefix) else {
                return nil
            }
            return (name: name, arn: "arn:aws:s3:::\(name)")
        }
    }
    
    private func getBucketStats(bucketName: String, credentials: CredentialSet) async -> (objectCount: Int, totalSizeBytes: Int64) {
        do {
            let result = try await runAwsCommand([
                "s3", "ls", "s3://\(bucketName)", "--recursive", "--summarize"
            ], credentials: credentials)
            
            let output = String(data: result, encoding: .utf8) ?? ""
            var objectCount = 0
            var totalSize: Int64 = 0
            
            let lines = output.components(separatedBy: "\n")
            for line in lines {
                if line.contains("Total Objects:") {
                    let parts = line.components(separatedBy: ":")
                    if parts.count >= 2, let count = Int(parts[1].trimmingCharacters(in: .whitespaces)) {
                        objectCount = count
                    }
                } else if line.contains("Total Size:") {
                    let parts = line.components(separatedBy: ":")
                    if parts.count >= 2, let size = Int64(parts[1].trimmingCharacters(in: .whitespaces).components(separatedBy: " ").first ?? "0") {
                        totalSize = size
                    }
                }
            }
            
            return (objectCount: objectCount, totalSizeBytes: totalSize)
        } catch {
            return (objectCount: 0, totalSizeBytes: 0)
        }
    }
    
    private func downloadBucketToLocal(bucketName: String, localPath: String, credentials: CredentialSet) async throws {
        _ = try await runAwsCommand([
            "s3", "sync",
            "s3://\(bucketName)",
            localPath,
            "--delete"
        ], credentials: credentials)
        
        RadiantLogger.info("Downloaded S3 bucket \(bucketName) to \(localPath)", category: RadiantLogger.aws)
    }
    
    private func captureLambdaVersions(
        appId: String,
        environment: String,
        credentials: CredentialSet
    ) async throws -> [LambdaSnapshot] {
        let result = try await runAwsCommand([
            "lambda", "list-functions",
            "--region", credentials.region,
            "--output", "json"
        ], credentials: credentials)
        
        guard let json = try? JSONSerialization.jsonObject(with: result) as? [String: Any],
              let functions = json["Functions"] as? [[String: Any]] else {
            return []
        }
        
        // Filter functions that belong to this app/environment
        let prefix = "radiant-\(appId)-\(environment.lowercased())"
        let dateFormatter = ISO8601DateFormatter()
        
        return functions.compactMap { fn -> LambdaSnapshot? in
            guard let name = fn["FunctionName"] as? String, name.hasPrefix(prefix) else {
                return nil
            }
            
            let lastModifiedStr = fn["LastModified"] as? String ?? ""
            let lastModified = dateFormatter.date(from: lastModifiedStr) ?? Date()
            
            return LambdaSnapshot(
                functionName: name,
                functionArn: fn["FunctionArn"] as? String ?? "",
                version: fn["Version"] as? String ?? "$LATEST",
                codeSize: fn["CodeSize"] as? Int64 ?? 0,
                lastModified: lastModified,
                runtime: fn["Runtime"] as? String ?? "nodejs20.x",
                handler: fn["Handler"] as? String ?? "index.handler"
            )
        }
    }
    
    // MARK: - Restore Methods
    
    private func restoreAuroraFromSnapshot(_ snapshot: AuroraSnapshot, credentials: CredentialSet) async throws {
        // Delete existing cluster first (if it exists)
        _ = try? await runAwsCommand([
            "rds", "delete-db-cluster",
            "--db-cluster-identifier", snapshot.clusterIdentifier,
            "--skip-final-snapshot",
            "--region", credentials.region
        ], credentials: credentials)
        
        // Wait for cluster to be deleted
        try await Task.sleep(nanoseconds: 60_000_000_000) // 60 seconds
        
        // Restore from snapshot
        _ = try await runAwsCommand([
            "rds", "restore-db-cluster-from-snapshot",
            "--db-cluster-identifier", snapshot.clusterIdentifier,
            "--snapshot-identifier", snapshot.snapshotId,
            "--engine", snapshot.engine,
            "--region", credentials.region
        ], credentials: credentials)
        
        // Wait for cluster to be available
        try await waitForClusterAvailable(clusterIdentifier: snapshot.clusterIdentifier, credentials: credentials, timeoutSeconds: 1800)
    }
    
    private func waitForClusterAvailable(clusterIdentifier: String, credentials: CredentialSet, timeoutSeconds: Int) async throws {
        let startTime = Date()
        
        while Date().timeIntervalSince(startTime) < Double(timeoutSeconds) {
            let status = await getClusterStatus(clusterIdentifier: clusterIdentifier, credentials: credentials)
            
            if status == "available" {
                return
            } else if status == "failed" || status == "deleted" {
                throw SnapshotError.awsError("Cluster restore failed with status: \(status)")
            }
            
            try await Task.sleep(nanoseconds: 30_000_000_000) // 30 seconds
        }
        
        throw SnapshotError.waitTimeout("Aurora cluster \(clusterIdentifier)")
    }
    
    private func getClusterStatus(clusterIdentifier: String, credentials: CredentialSet) async -> String {
        do {
            let result = try await runAwsCommand([
                "rds", "describe-db-clusters",
                "--db-cluster-identifier", clusterIdentifier,
                "--region", credentials.region,
                "--output", "json"
            ], credentials: credentials)
            
            guard let json = try? JSONSerialization.jsonObject(with: result) as? [String: Any],
                  let clusters = json["DBClusters"] as? [[String: Any]],
                  let cluster = clusters.first else {
                return "not-found"
            }
            
            return cluster["Status"] as? String ?? "unknown"
        } catch {
            return "error"
        }
    }
    
    private func restoreDynamoDBFromBackup(_ snapshot: DynamoDBSnapshot, credentials: CredentialSet) async throws {
        _ = try await runAwsCommand([
            "dynamodb", "restore-table-from-backup",
            "--target-table-name", snapshot.tableName,
            "--backup-arn", snapshot.backupArn,
            "--region", credentials.region
        ], credentials: credentials)
    }
    
    private func restoreS3FromLocal(_ snapshot: S3Snapshot, localPath: String, credentials: CredentialSet) async throws {
        _ = try await runAwsCommand([
            "s3", "sync",
            localPath,
            "s3://\(snapshot.bucketName)",
            "--delete"
        ], credentials: credentials)
    }
    
    // MARK: - AWS CLI Helper
    
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
            let errorMessage = String(data: errorData, encoding: .utf8) ?? "Unknown error"
            throw SnapshotError.awsError("Command failed: \(errorMessage)")
        }
        
        return outputPipe.fileHandleForReading.readDataToEndOfFile()
    }
    
    // MARK: - Snapshot Management
    
    func getSnapshot(_ id: String) -> SnapshotManifest? {
        snapshots[id]
    }
    
    func listSnapshots(appId: String? = nil) -> [SnapshotManifest] {
        var results = Array(snapshots.values)
        if let appId = appId {
            results = results.filter { $0.appId == appId }
        }
        return results.sorted { $0.createdAt > $1.createdAt }
    }
    
    func deleteSnapshot(_ id: String, credentials: CredentialSet) async throws {
        guard var manifest = snapshots[id] else {
            throw SnapshotError.notFound(id)
        }
        
        manifest.status = .deleting
        snapshots[id] = manifest
        
        // Delete AWS resources
        do {
            // Delete Aurora snapshot
            if let aurora = manifest.resources.aurora {
                _ = try? await runAwsCommand([
                    "rds", "delete-db-cluster-snapshot",
                    "--db-cluster-snapshot-identifier", aurora.snapshotId,
                    "--region", credentials.region
                ], credentials: credentials)
                RadiantLogger.info("Deleted Aurora snapshot: \(aurora.snapshotId)", category: RadiantLogger.aws)
            }
            
            // Delete DynamoDB backups
            for dynamoDB in manifest.resources.dynamoDB {
                _ = try? await runAwsCommand([
                    "dynamodb", "delete-backup",
                    "--backup-arn", dynamoDB.backupArn,
                    "--region", credentials.region
                ], credentials: credentials)
                RadiantLogger.info("Deleted DynamoDB backup: \(dynamoDB.tableName)", category: RadiantLogger.aws)
            }
            
            // Delete local S3 backups if they exist
            for s3 in manifest.resources.s3 {
                if let localPath = s3.localPath {
                    try? FileManager.default.removeItem(atPath: localPath)
                    RadiantLogger.info("Deleted local S3 backup: \(localPath)", category: RadiantLogger.aws)
                }
            }
            
            // Remove from local storage
            try await removePersistedSnapshot(id)
            
            snapshots.removeValue(forKey: id)
            RadiantLogger.info("Deleted snapshot: \(id)", category: RadiantLogger.aws)
            
        } catch {
            RadiantLogger.error("Failed to delete snapshot \(id): \(error.localizedDescription)", category: RadiantLogger.aws)
            throw error
        }
    }
    
    private func cleanupOldSnapshots(credentials: CredentialSet) async throws {
        let sorted = snapshots.values.sorted { $0.createdAt > $1.createdAt }
        
        // Remove expired snapshots
        let now = Date()
        for manifest in sorted where manifest.expiresAt < now {
            try? await deleteSnapshot(manifest.id, credentials: credentials)
        }
        
        // Remove oldest if over limit
        if sorted.count > maxSnapshots {
            for manifest in sorted.suffix(from: maxSnapshots) {
                try? await deleteSnapshot(manifest.id, credentials: credentials)
            }
        }
    }
    
    func getLatestSnapshot(appId: String, environment: String) -> SnapshotManifest? {
        snapshots.values
            .filter { $0.appId == appId && $0.environment == environment && $0.status == .available }
            .sorted { $0.createdAt > $1.createdAt }
            .first
    }
    
    /// List available AWS snapshots from the cloud (not just local cache)
    func listAwsSnapshots(appId: String, environment: String, credentials: CredentialSet) async throws -> [SnapshotManifest] {
        // Get Aurora snapshots
        let auroraSnapshots = try await listAuroraSnapshots(appId: appId, environment: environment, credentials: credentials)
        
        // Get DynamoDB backups
        let dynamoDBBackups = try await listDynamoDBBackups(appId: appId, environment: environment, credentials: credentials)
        
        // Combine into manifests (group by snapshot ID from naming convention)
        var manifestMap: [String: SnapshotManifest] = [:]
        
        for aurora in auroraSnapshots {
            let snapshotId = aurora.snapshotId.replacingOccurrences(of: "radiant-", with: "")
            if manifestMap[snapshotId] == nil {
                manifestMap[snapshotId] = SnapshotManifest(
                    id: snapshotId,
                    appId: appId,
                    environment: environment,
                    version: "unknown",
                    createdAt: aurora.createdAt,
                    expiresAt: aurora.createdAt.addingTimeInterval(Double(retentionDays * 24 * 60 * 60)),
                    resources: SnapshotResources(aurora: aurora, dynamoDB: [], s3: [], lambda: []),
                    status: aurora.status == "available" ? .available : .creating,
                    metadata: ["source": "aws"]
                )
            } else {
                manifestMap[snapshotId]?.resources.aurora = aurora
            }
        }
        
        for backup in dynamoDBBackups {
            // Extract snapshot ID from backup name
            let parts = backup.backupArn.components(separatedBy: "/")
            if let backupName = parts.last,
               backupName.hasPrefix("radiant-snap-") {
                let snapshotIdParts = backupName.components(separatedBy: "-")
                if snapshotIdParts.count >= 3 {
                    let snapshotId = "snap-\(snapshotIdParts[2])"
                    if manifestMap[snapshotId] != nil {
                        manifestMap[snapshotId]?.resources.dynamoDB.append(backup)
                    }
                }
            }
        }
        
        return Array(manifestMap.values).sorted { $0.createdAt > $1.createdAt }
    }
    
    private func listAuroraSnapshots(appId: String, environment: String, credentials: CredentialSet) async throws -> [AuroraSnapshot] {
        let clusterIdentifier = "radiant-\(appId)-\(environment.lowercased())"
        
        let result = try await runAwsCommand([
            "rds", "describe-db-cluster-snapshots",
            "--db-cluster-identifier", clusterIdentifier,
            "--region", credentials.region,
            "--output", "json"
        ], credentials: credentials)
        
        guard let json = try? JSONSerialization.jsonObject(with: result) as? [String: Any],
              let snapshotList = json["DBClusterSnapshots"] as? [[String: Any]] else {
            return []
        }
        
        let dateFormatter = ISO8601DateFormatter()
        
        return snapshotList.compactMap { snapshot -> AuroraSnapshot? in
            guard let snapshotId = snapshot["DBClusterSnapshotIdentifier"] as? String,
                  snapshotId.hasPrefix("radiant-snap-") else {
                return nil
            }
            
            let createdAtStr = snapshot["SnapshotCreateTime"] as? String ?? ""
            let createdAt = dateFormatter.date(from: createdAtStr) ?? Date()
            
            return AuroraSnapshot(
                snapshotId: snapshotId,
                clusterIdentifier: clusterIdentifier,
                clusterArn: snapshot["DBClusterArn"] as? String ?? "",
                snapshotArn: snapshot["DBClusterSnapshotArn"] as? String ?? "",
                status: snapshot["Status"] as? String ?? "unknown",
                sizeGB: snapshot["AllocatedStorage"] as? Double ?? 0,
                createdAt: createdAt,
                engine: snapshot["Engine"] as? String ?? "aurora-postgresql",
                engineVersion: snapshot["EngineVersion"] as? String ?? "unknown"
            )
        }
    }
    
    private func listDynamoDBBackups(appId: String, environment: String, credentials: CredentialSet) async throws -> [DynamoDBSnapshot] {
        let result = try await runAwsCommand([
            "dynamodb", "list-backups",
            "--region", credentials.region,
            "--output", "json"
        ], credentials: credentials)
        
        guard let json = try? JSONSerialization.jsonObject(with: result) as? [String: Any],
              let backups = json["BackupSummaries"] as? [[String: Any]] else {
            return []
        }
        
        let prefix = "radiant-snap-"
        let dateFormatter = ISO8601DateFormatter()
        
        return backups.compactMap { backup -> DynamoDBSnapshot? in
            guard let backupName = backup["BackupName"] as? String,
                  backupName.hasPrefix(prefix) else {
                return nil
            }
            
            let createdAtStr = backup["BackupCreationDateTime"] as? String ?? ""
            let createdAt = dateFormatter.date(from: createdAtStr) ?? Date()
            
            return DynamoDBSnapshot(
                tableName: backup["TableName"] as? String ?? "",
                tableArn: backup["TableArn"] as? String ?? "",
                backupArn: backup["BackupArn"] as? String ?? "",
                status: backup["BackupStatus"] as? String ?? "unknown",
                itemCount: 0,
                sizeBytes: backup["BackupSizeBytes"] as? Int64 ?? 0,
                createdAt: createdAt
            )
        }
    }
}

// MARK: - Singleton

extension SnapshotService {
    static let shared = SnapshotService(
        awsService: AWSService.shared,
        storageManager: LocalStorageManager.shared
    )
}
