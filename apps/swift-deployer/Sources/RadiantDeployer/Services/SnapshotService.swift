import Foundation

/// Snapshot Service for AWS resource snapshots per PROMPT-33 spec
/// Manages Aurora, DynamoDB, S3, and Lambda version snapshots
actor SnapshotService {
    
    // MARK: - Types
    
    enum SnapshotError: Error, LocalizedError {
        case creationFailed(String)
        case restoreFailed(String)
        case notFound(String)
        case timeout
        case invalidState(String)
        
        var errorDescription: String? {
            switch self {
            case .creationFailed(let msg): return "Snapshot creation failed: \(msg)"
            case .restoreFailed(let msg): return "Snapshot restore failed: \(msg)"
            case .notFound(let id): return "Snapshot not found: \(id)"
            case .timeout: return "Snapshot operation timed out"
            case .invalidState(let msg): return "Invalid state: \(msg)"
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
        
        enum SnapshotStatus: String, Codable, Sendable {
            case creating = "creating"
            case available = "available"
            case restoring = "restoring"
            case deleting = "deleting"
            case failed = "failed"
            case expired = "expired"
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
        let clusterArn: String
        let dbInstanceArn: String
        let snapshotArn: String
        var status: String
        let sizeGB: Double
        let createdAt: Date
    }
    
    struct DynamoDBSnapshot: Codable, Sendable {
        let tableName: String
        let tableArn: String
        let backupArn: String
        var status: String
        let itemCount: Int
        let sizeBytes: Int64
    }
    
    struct S3Snapshot: Codable, Sendable {
        let bucketName: String
        let bucketArn: String
        let versionId: String
        let objectCount: Int
        let totalSizeBytes: Int64
    }
    
    struct LambdaSnapshot: Codable, Sendable {
        let functionName: String
        let functionArn: String
        let version: String
        let codeSize: Int64
        let lastModified: Date
    }
    
    // MARK: - Properties
    
    private var snapshots: [String: SnapshotManifest] = [:]
    private let awsService: AWSService
    private let storageManager: LocalStorageManager
    private let retentionDays: Int = 30
    private let maxSnapshots: Int = 10
    
    // MARK: - Initialization
    
    init(awsService: AWSService, storageManager: LocalStorageManager) {
        self.awsService = awsService
        self.storageManager = storageManager
    }
    
    // MARK: - Snapshot Creation
    
    func createSnapshot(
        appId: String,
        environment: String,
        version: String,
        onProgress: @escaping (String, Double) -> Void
    ) async throws -> SnapshotManifest {
        let snapshotId = "snap-\(UUID().uuidString.prefix(8))"
        
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
                "radiantVersion": RADIANT_VERSION
            ]
        )
        
        snapshots[snapshotId] = manifest
        
        do {
            // Step 1: Aurora snapshot (40% of progress)
            onProgress("Creating Aurora snapshot...", 0.0)
            manifest.resources.aurora = try await createAuroraSnapshot(appId: appId, environment: environment)
            onProgress("Aurora snapshot created", 0.4)
            
            // Step 2: DynamoDB backups (25% of progress)
            onProgress("Creating DynamoDB backups...", 0.4)
            manifest.resources.dynamoDB = try await createDynamoDBSnapshots(appId: appId, environment: environment)
            onProgress("DynamoDB backups created", 0.65)
            
            // Step 3: S3 versioning (20% of progress)
            onProgress("Capturing S3 versions...", 0.65)
            manifest.resources.s3 = try await captureS3Versions(appId: appId, environment: environment)
            onProgress("S3 versions captured", 0.85)
            
            // Step 4: Lambda versions (15% of progress)
            onProgress("Recording Lambda versions...", 0.85)
            manifest.resources.lambda = try await captureLambdaVersions(appId: appId, environment: environment)
            onProgress("Lambda versions recorded", 1.0)
            
            manifest.status = .available
            snapshots[snapshotId] = manifest
            
            // Cleanup old snapshots
            try await cleanupOldSnapshots()
            
            return manifest
            
        } catch {
            manifest.status = .failed
            manifest.metadata["error"] = error.localizedDescription
            snapshots[snapshotId] = manifest
            throw SnapshotError.creationFailed(error.localizedDescription)
        }
    }
    
    // MARK: - Snapshot Restore
    
    func restoreSnapshot(
        _ snapshotId: String,
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
                onProgress("Restoring Aurora database...", 0.0)
                try await restoreAuroraSnapshot(aurora)
                onProgress("Aurora database restored", 0.5)
            }
            
            // Step 2: Restore DynamoDB
            if !manifest.resources.dynamoDB.isEmpty {
                onProgress("Restoring DynamoDB tables...", 0.5)
                for (index, table) in manifest.resources.dynamoDB.enumerated() {
                    try await restoreDynamoDBBackup(table)
                    let progress = 0.5 + (0.3 * Double(index + 1) / Double(manifest.resources.dynamoDB.count))
                    onProgress("Restored \(table.tableName)", progress)
                }
            }
            
            // Step 3: Restore Lambda versions
            if !manifest.resources.lambda.isEmpty {
                onProgress("Restoring Lambda versions...", 0.8)
                for lambda in manifest.resources.lambda {
                    try await restoreLambdaVersion(lambda)
                }
                onProgress("Lambda versions restored", 1.0)
            }
            
            manifest.status = .available
            snapshots[snapshotId] = manifest
            
        } catch {
            manifest.status = .available // Keep available for retry
            manifest.metadata["lastRestoreError"] = error.localizedDescription
            snapshots[snapshotId] = manifest
            throw SnapshotError.restoreFailed(error.localizedDescription)
        }
    }
    
    // MARK: - AWS Resource Snapshots (Simulated)
    
    private func createAuroraSnapshot(appId: String, environment: String) async throws -> AuroraSnapshot {
        // Simulate API call
        try await Task.sleep(nanoseconds: 1_000_000_000)
        
        return AuroraSnapshot(
            snapshotId: "aurora-snap-\(UUID().uuidString.prefix(8))",
            clusterArn: "arn:aws:rds:us-east-1:123456789:cluster:\(appId)-\(environment)",
            dbInstanceArn: "arn:aws:rds:us-east-1:123456789:db:\(appId)-\(environment)-instance",
            snapshotArn: "arn:aws:rds:us-east-1:123456789:snapshot:\(appId)-\(environment)-snap",
            status: "available",
            sizeGB: 50.0,
            createdAt: Date()
        )
    }
    
    private func createDynamoDBSnapshots(appId: String, environment: String) async throws -> [DynamoDBSnapshot] {
        try await Task.sleep(nanoseconds: 500_000_000)
        
        let tables = ["sessions", "cache", "events"]
        return tables.map { table in
            DynamoDBSnapshot(
                tableName: "\(appId)-\(environment)-\(table)",
                tableArn: "arn:aws:dynamodb:us-east-1:123456789:table/\(appId)-\(environment)-\(table)",
                backupArn: "arn:aws:dynamodb:us-east-1:123456789:backup/\(table)-backup",
                status: "available",
                itemCount: Int.random(in: 1000...100000),
                sizeBytes: Int64.random(in: 1_000_000...100_000_000)
            )
        }
    }
    
    private func captureS3Versions(appId: String, environment: String) async throws -> [S3Snapshot] {
        try await Task.sleep(nanoseconds: 300_000_000)
        
        let buckets = ["media", "uploads", "exports"]
        return buckets.map { bucket in
            S3Snapshot(
                bucketName: "\(appId)-\(environment)-\(bucket)",
                bucketArn: "arn:aws:s3:::\(appId)-\(environment)-\(bucket)",
                versionId: UUID().uuidString,
                objectCount: Int.random(in: 100...10000),
                totalSizeBytes: Int64.random(in: 100_000_000...10_000_000_000)
            )
        }
    }
    
    private func captureLambdaVersions(appId: String, environment: String) async throws -> [LambdaSnapshot] {
        try await Task.sleep(nanoseconds: 200_000_000)
        
        let functions = ["router", "chat", "admin", "webhooks", "migration"]
        return functions.map { fn in
            LambdaSnapshot(
                functionName: "\(appId)-\(environment)-\(fn)",
                functionArn: "arn:aws:lambda:us-east-1:123456789:function:\(appId)-\(environment)-\(fn)",
                version: "\(Int.random(in: 1...50))",
                codeSize: Int64.random(in: 1_000_000...50_000_000),
                lastModified: Date()
            )
        }
    }
    
    private func restoreAuroraSnapshot(_ snapshot: AuroraSnapshot) async throws {
        try await Task.sleep(nanoseconds: 2_000_000_000)
    }
    
    private func restoreDynamoDBBackup(_ snapshot: DynamoDBSnapshot) async throws {
        try await Task.sleep(nanoseconds: 500_000_000)
    }
    
    private func restoreLambdaVersion(_ snapshot: LambdaSnapshot) async throws {
        try await Task.sleep(nanoseconds: 100_000_000)
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
    
    func deleteSnapshot(_ id: String) async throws {
        guard var manifest = snapshots[id] else {
            throw SnapshotError.notFound(id)
        }
        
        manifest.status = .deleting
        snapshots[id] = manifest
        
        // Delete AWS resources (simulated)
        try await Task.sleep(nanoseconds: 500_000_000)
        
        snapshots.removeValue(forKey: id)
    }
    
    private func cleanupOldSnapshots() async throws {
        let sorted = snapshots.values.sorted { $0.createdAt > $1.createdAt }
        
        // Remove expired snapshots
        let now = Date()
        for manifest in sorted where manifest.expiresAt < now {
            try? await deleteSnapshot(manifest.id)
        }
        
        // Remove oldest if over limit
        if sorted.count > maxSnapshots {
            for manifest in sorted.suffix(from: maxSnapshots) {
                try? await deleteSnapshot(manifest.id)
            }
        }
    }
    
    func getLatestSnapshot(appId: String, environment: String) -> SnapshotManifest? {
        snapshots.values
            .filter { $0.appId == appId && $0.environment == environment && $0.status == .available }
            .sorted { $0.createdAt > $1.createdAt }
            .first
    }
}

// MARK: - Singleton

extension SnapshotService {
    static let shared = SnapshotService(
        awsService: AWSService.shared,
        storageManager: LocalStorageManager.shared
    )
}
