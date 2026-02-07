/**
 * Environment State Registry Models
 *
 * Swift models for tracking environment state manifests,
 * sync configuration, and backup/restore operations.
 *
 * @version 1.0.0
 * @since RADIANT 7.0.0
 */

import Foundation

// MARK: - Environment Types

/// Environment identifier
public enum EnvironmentName: String, Codable, CaseIterable, Sendable {
    case dev
    case staging
    case prod
    
    public var displayName: String {
        switch self {
        case .dev: return "Development"
        case .staging: return "Staging"
        case .prod: return "Production"
        }
    }
    
    public var shortName: String {
        rawValue.uppercased()
    }
    
    public var color: String {
        switch self {
        case .dev: return "green"
        case .staging: return "orange"
        case .prod: return "red"
        }
    }
}

// MARK: - Status Types

public enum EnvSyncStatus: String, Codable, Sendable {
    case idle
    case syncing
    case completed
    case failed
    case conflict
}

public enum BackupStatus: String, Codable, Sendable {
    case pending
    case inProgress = "in_progress"
    case completed
    case failed
    case expired
}

public enum BackupType: String, Codable, Sendable {
    case full
    case incremental
    case scheduled
    case preDeploy = "pre_deploy"
    case manual
}

public enum ResourceHealth: String, Codable, Sendable {
    case healthy
    case degraded
    case unhealthy
    case unknown
}

public enum DataSensitivity: String, Codable, Sendable {
    case `public`
    case `internal`
    case confidential
    case restricted
}

public enum SyncPreference: String, Codable, Sendable {
    case full
    case structureOnly = "structure_only"
    case exclude
}

// MARK: - Infrastructure Manifests

public struct StackManifest: Codable, Identifiable, Sendable {
    public let name: String
    public let stackId: String
    public let status: String
    public let createdAt: String
    public let lastUpdatedAt: String
    public let templateVersion: String?
    public let outputs: [String: String]
    public let parameters: [String: String]
    public let tags: [String: String]
    public let driftStatus: String?
    
    public var id: String { stackId }
}

public struct LambdaManifest: Codable, Identifiable, Sendable {
    public let name: String
    public let arn: String
    public let runtime: String
    public let handler: String
    public let memoryMB: Int
    public let timeoutSeconds: Int
    public let codeSize: Int64
    public let lastModified: String
    public let version: String
    public let environment: [String: String]?
    public let layers: [String]
    
    public var id: String { arn }
}

public struct S3BucketManifest: Codable, Identifiable, Sendable {
    public let name: String
    public let arn: String
    public let region: String
    public let createdAt: String
    public let versioningEnabled: Bool
    public let totalSizeBytes: Int64
    public let objectCount: Int
    public let encryptionType: String?
    public let publicAccessBlocked: Bool
    public let persistentDataItems: [String]
    public let syncPreference: SyncPreference?
    
    public var id: String { arn }
    
    public var formattedSize: String {
        ByteCountFormatter.string(fromByteCount: totalSizeBytes, countStyle: .file)
    }
}

public struct DynamoTableManifest: Codable, Identifiable, Sendable {
    public let name: String
    public let arn: String
    public let status: String
    public let itemCount: Int64
    public let sizeBytes: Int64
    public let billingMode: String?
    public let streamEnabled: Bool
    
    public var id: String { arn }
    
    public var formattedSize: String {
        ByteCountFormatter.string(fromByteCount: sizeBytes, countStyle: .file)
    }
}

public struct AuroraManifest: Codable, Sendable {
    public let clusterIdentifier: String
    public let clusterArn: String
    public let engine: String
    public let engineVersion: String
    public let status: String
    public let endpoint: String
    public let readerEndpoint: String
    public let port: Int
    public let instances: [AuroraInstance]
    public let allocatedStorage: Int
    public let storageEncrypted: Bool
    public let backupRetentionPeriod: Int
    public let latestRestorableTime: String?
    public let databases: [String]
    public let persistentDataItems: [String]
}

public struct AuroraInstance: Codable, Identifiable, Sendable {
    public let identifier: String
    public let instanceClass: String
    public let status: String
    public let availabilityZone: String
    
    public var id: String { identifier }
}

public struct SecretManifest: Codable, Identifiable, Sendable {
    public let name: String
    public let arn: String
    public let description: String?
    public let createdAt: String
    public let lastChangedAt: String
    public let lastRotatedAt: String?
    public let rotationEnabled: Bool
    public let rotationDays: Int?
    
    public var id: String { arn }
}

public struct ApiGatewayManifest: Codable, Sendable {
    public let restApiId: String
    public let name: String
    public let description: String?
    public let createdAt: String
    public let stages: [ApiGatewayStage]
    public let resourceCount: Int
    public let methodCount: Int
}

public struct ApiGatewayStage: Codable, Identifiable, Sendable {
    public let name: String
    public let deploymentId: String
    public let lastUpdatedAt: String
    
    public var id: String { name }
}

// MARK: - Infrastructure Container

public struct InfrastructureManifest: Codable, Sendable {
    public let region: String
    public let accountId: String
    public let vpcId: String?
    public let stacks: [StackManifest]
    public let lambdas: [LambdaManifest]
    public let s3Buckets: [S3BucketManifest]
    public let dynamoTables: [DynamoTableManifest]
    public let auroraCluster: AuroraManifest
    public let secrets: [SecretManifest]
    public let apiGateway: ApiGatewayManifest
}

// MARK: - Persistent Data

public struct PersistentDataItem: Codable, Identifiable, Sendable {
    public let id: String
    public let name: String
    public let description: String
    public let type: String
    public let location: String
    public let category: String
    public let sensitivity: DataSensitivity
    public let containsPII: Bool
    public let containsPHI: Bool
    public let encryptionRequired: Bool
    public let dependsOn: [String]
    public let requiredFor: [String]
    public var includeInSync: Bool
    public let syncPriority: Int
    public let estimatedSyncSeconds: Int
    public let sizeBytes: Int64
    public let recordCount: Int64
    public let lastModified: String?
    
    public var formattedSize: String {
        ByteCountFormatter.string(fromByteCount: sizeBytes, countStyle: .file)
    }
    
    public var formattedRecordCount: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        return formatter.string(from: NSNumber(value: recordCount)) ?? "\(recordCount)"
    }
}

// MARK: - Feature Manifest

public struct FeatureManifest: Codable, Sendable {
    public let enableCurator: Bool
    public let enableCortexMemory: Bool
    public let enableTimeMachine: Bool
    public let enableCollaboration: Bool
    public let enableComplianceExport: Bool
    public let enableEgoSystem: Bool
    public let enableDelight: Bool
    public let enableCato: Bool
    public let enableSelfHostedModels: Bool
    public let enableExternalModels: Bool
    public let enableModelFallback: Bool
    public let enableStreamingResponses: Bool
    public let enableMCP: Bool
    public let enableA2A: Bool
    public let enableExternalAPI: Bool
    public let customFlags: [String: Bool]?
}

// MARK: - Sync Configuration

public struct SyncConfiguration: Codable, Sendable {
    public var enabled: Bool
    public var syncInfrastructure: Bool
    public var syncPersistentData: Bool
    public var syncFeatureFlags: Bool
    public var syncSecrets: Bool
    public var includedDataItems: [String]
    public var excludedDataItems: [String]
    public var requireConfirmation: Bool
    public var allowDestructive: Bool
    public var requireApproval: Bool
    public var approvers: [String]?
    public var autoSyncEnabled: Bool
    public var autoSyncSourceEnvironment: EnvironmentName?
    public var autoSyncSchedule: String?
    public var lastAutoSyncAt: String?
    public var notifyOnSync: Bool
    public var notifyOnConflict: Bool
    public var notificationChannels: [String]
    
    public static var `default`: SyncConfiguration {
        SyncConfiguration(
            enabled: false,
            syncInfrastructure: false,
            syncPersistentData: true,
            syncFeatureFlags: true,
            syncSecrets: false,
            includedDataItems: [],
            excludedDataItems: ["audit_merkle", "cato_safety_log", "user_analytics"],
            requireConfirmation: true,
            allowDestructive: false,
            requireApproval: false,
            approvers: nil,
            autoSyncEnabled: false,
            autoSyncSourceEnvironment: nil,
            autoSyncSchedule: nil,
            lastAutoSyncAt: nil,
            notifyOnSync: true,
            notifyOnConflict: true,
            notificationChannels: ["email"]
        )
    }
}

// MARK: - Health

public struct EnvironmentHealth: Codable, Sendable {
    public let overall: ResourceHealth
    public let services: [String: ResourceHealth]
    public let lastHealthCheckAt: String
}

// MARK: - Checksums

public struct ManifestChecksums: Codable, Sendable {
    public let infrastructure: String
    public let persistentData: String
    public let features: String
    public let full: String
}

// MARK: - Main Manifest

public struct EnvironmentStateManifest: Codable, Identifiable, Sendable {
    public let version: String
    public let schemaVersion: String
    public let environment: EnvironmentName
    public let capturedAt: String
    public let capturedBy: String
    public let radiantVersion: String
    public let infrastructure: InfrastructureManifest
    public let persistentData: [PersistentDataItem]
    public let features: FeatureManifest
    public let syncConfig: SyncConfiguration
    public let health: EnvironmentHealth
    public let checksums: ManifestChecksums
    public let previousVersionId: String?
    
    public var id: String { "\(environment.rawValue)-\(version)" }
    
    public var capturedAtDate: Date? {
        ISO8601DateFormatter().date(from: capturedAt)
    }
    
    public var formattedCapturedAt: String {
        guard let date = capturedAtDate else { return capturedAt }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Manifest Diff

public struct ManifestDiffChanges: Codable, Sendable {
    public let stacks: [String]
    public let lambdas: [String]
    public let buckets: [String]
    public let tables: [String]
    public let secrets: [String]
    public let persistentData: [String]
}

public struct ManifestDiff: Codable, Sendable {
    public let fromVersion: String
    public let toVersion: String
    public let fromCapturedAt: String
    public let toCapturedAt: String
    public let added: ManifestDiffChanges
    public let removed: ManifestDiffChanges
    public let modified: ManifestDiffChanges
    public let totalChanges: Int
    public let breakingChanges: Int
    public let dataChanges: Int
}

// MARK: - Comparison

public struct SyncRecommendation: Codable, Identifiable, Sendable {
    public let type: String // sync, skip, review, warning
    public let itemType: String
    public let itemId: String
    public let reason: String
    public let risk: String // low, medium, high
    public let action: String
    
    public var id: String { "\(itemType)-\(itemId)" }
}

public struct SyncConflict: Codable, Identifiable, Sendable {
    public let itemId: String
    public let itemType: String
    public let sourceValue: String
    public let targetValue: String
    public let conflictType: String
    public let resolution: String?
    
    public var id: String { "\(itemType)-\(itemId)" }
}

public struct EnvironmentComparison: Codable, Sendable {
    public let sourceEnvironment: EnvironmentName
    public let targetEnvironment: EnvironmentName
    public let comparedAt: String
    public let comparedBy: String
    public let diff: ManifestDiff
    public let recommendations: [SyncRecommendation]
    public let conflicts: [SyncConflict]
    public let estimatedSyncDurationMs: Int
    public let estimatedDataTransferBytes: Int64
    public let requiresDowntime: Bool
    
    public var formattedDataTransfer: String {
        ByteCountFormatter.string(fromByteCount: estimatedDataTransferBytes, countStyle: .file)
    }
    
    public var formattedSyncDuration: String {
        let seconds = estimatedSyncDurationMs / 1000
        if seconds < 60 {
            return "\(seconds) seconds"
        } else if seconds < 3600 {
            return "\(seconds / 60) minutes"
        } else {
            return "\(seconds / 3600) hours"
        }
    }
}

// MARK: - Sync Operations

public struct SyncProgress: Codable, Sendable {
    public let phase: String
    public let percentComplete: Int
    public let currentItem: String?
    public let itemsCompleted: Int
    public let itemsTotal: Int
    public let bytesTransferred: Int64
    
    public var formattedBytesTransferred: String {
        ByteCountFormatter.string(fromByteCount: bytesTransferred, countStyle: .file)
    }
}

public struct SyncResults: Codable, Sendable {
    public let itemsSynced: Int
    public let itemsSkipped: Int
    public let itemsFailed: Int
    public let conflicts: [SyncConflict]
    public let warnings: [String]
}

public struct EnvSyncError: Codable, Identifiable, Sendable {
    public let item: String
    public let itemType: String
    public let error: String
    public let recoverable: Bool
    public let timestamp: String
    public let retryCount: Int
    
    public var id: String { "\(itemType)-\(item)-\(timestamp)" }
}

public struct SyncOperation: Codable, Identifiable, Sendable {
    public let id: String
    public let sourceEnvironment: EnvironmentName
    public let targetEnvironment: EnvironmentName
    public let initiatedBy: String
    public let initiatedAt: String
    public let syncInfrastructure: Bool
    public let syncData: Bool
    public let syncFeatures: Bool
    public let dataItemsToSync: [String]
    public let status: EnvSyncStatus
    public let startedAt: String?
    public let completedAt: String?
    public let progress: SyncProgress
    public let results: SyncResults?
    public let errors: [EnvSyncError]
    
    public var formattedInitiatedAt: String {
        guard let date = ISO8601DateFormatter().date(from: initiatedAt) else { return initiatedAt }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Backup Operations

public struct BackupComponentSizes: Codable, Sendable {
    public let infrastructure: Int64
    public let database: Int64
    public let s3: Int64
    public let secrets: Int64
    public let config: Int64
    
    public var total: Int64 {
        infrastructure + database + s3 + secrets + config
    }
}

public struct BackupManifest: Codable, Identifiable, Sendable {
    public let id: String
    public let environment: EnvironmentName
    public let type: BackupType
    public let status: BackupStatus
    public let createdAt: String
    public let createdBy: String
    public let completedAt: String?
    public let expiresAt: String?
    public let includesInfrastructure: Bool
    public let includesDatabase: Bool
    public let includesS3: Bool
    public let includesSecrets: Bool
    public let includesFeatureFlags: Bool
    public let stateManifestVersion: String?
    public let totalSizeBytes: Int64
    public let componentSizes: BackupComponentSizes
    public let storageLocation: String
    public let storageClass: String
    public let checksumManifest: String?
    public let checksumFull: String?
    public let restoreCount: Int
    public let lastRestoredAt: String?
    public let lastRestoredBy: String?
    public let description: String?
    
    public var formattedSize: String {
        ByteCountFormatter.string(fromByteCount: totalSizeBytes, countStyle: .file)
    }
    
    public var formattedCreatedAt: String {
        guard let date = ISO8601DateFormatter().date(from: createdAt) else { return createdAt }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Restore Operations

public struct RestoreOperation: Codable, Identifiable, Sendable {
    public let id: String
    public let backupId: String
    public let targetEnvironment: EnvironmentName
    public let status: BackupStatus
    public let initiatedAt: String
    public let initiatedBy: String
    public let startedAt: String?
    public let completedAt: String?
    public let restoreItems: [String]?
    public let skipItems: [String]?
    public let overwriteExisting: Bool
    public let progressPhase: String
    public let progressPercent: Int
    public let itemsRestored: Int
    public let itemsSkipped: Int
    public let itemsFailed: Int
    public let bytesRestored: Int64
    public let errors: [EnvSyncError]
    public let warnings: [String]
    
    public var formattedBytesRestored: String {
        ByteCountFormatter.string(fromByteCount: bytesRestored, countStyle: .file)
    }
}

// MARK: - API Response Types

public struct StateRegistryDashboard: Codable, Sendable {
    public let environments: [String: EnvironmentSummary?]
    public let recentSyncs: [SyncOperation]
    public let recentBackups: [BackupManifest]
    public let syncEnabled: [String: Bool]
}

public struct EnvironmentSummary: Codable, Sendable {
    public let lastCaptured: String?
    public let health: ResourceHealth?
    public let stackCount: Int
    public let lambdaCount: Int
    public let persistentDataItems: Int
}

// MARK: - Request Types

public struct CaptureManifestRequest: Codable, Sendable {
    public let environment: EnvironmentName
    public let capturedBy: String
    public var includeInfrastructure: Bool = true
    public var includePersistentData: Bool = true
    public var includeFeatures: Bool = true
}

public struct CompareEnvironmentsRequest: Codable, Sendable {
    public let sourceEnvironment: EnvironmentName
    public let targetEnvironment: EnvironmentName
    public let comparedBy: String
    public var includeInfrastructure: Bool = true
    public var includePersistentData: Bool = true
    public var includeFeatures: Bool = true
}

public struct StartSyncRequest: Codable, Sendable {
    public let sourceEnvironment: EnvironmentName
    public let targetEnvironment: EnvironmentName
    public let initiatedBy: String
    public var syncInfrastructure: Bool = false
    public var syncData: Bool = true
    public var syncFeatures: Bool = true
    public var dataItemsToSync: [String]?
    public var confirmProduction: Bool = false
}

public struct CreateBackupRequest: Codable, Sendable {
    public let environment: EnvironmentName
    public let createdBy: String
    public var type: BackupType = .manual
    public var includeInfrastructure: Bool = true
    public var includeDatabase: Bool = true
    public var includeS3: Bool = true
    public var includeSecrets: Bool = false
    public var includeFeatureFlags: Bool = true
    public var description: String?
}

public struct RestoreBackupRequest: Codable, Sendable {
    public let backupId: String
    public let targetEnvironment: EnvironmentName
    public let initiatedBy: String
    public var restoreItems: [String]?
    public var skipItems: [String]?
    public var overwriteExisting: Bool = false
    public var confirmRestore: Bool = false
}
