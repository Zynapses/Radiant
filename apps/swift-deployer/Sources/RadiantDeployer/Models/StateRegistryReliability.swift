/**
 * State Registry Reliability Models
 *
 * Swift models for reliability features including storage configuration,
 * retry logic, fallback handling, and data integrity verification.
 *
 * @version 1.0.0
 * @since RADIANT 7.1.0
 */

import Foundation

// MARK: - Storage Configuration

/// Configurable storage paths for manifests, backups, and packages.
/// Allows administrators to specify custom paths for large datasets.
public struct StateRegistryStorageConfig: Codable, Sendable, Equatable {
    // Local storage paths
    public var localManifestPath: String
    public var localBackupPath: String
    public var localPackagePath: String
    public var localCachePath: String
    
    // S3 storage configuration
    public var s3ManifestBucket: String
    public var s3BackupBucket: String
    public var s3PackageBucket: String
    public var s3Region: String
    
    // Storage limits
    public var maxLocalCacheSizeGB: Double
    public var maxBackupRetentionDays: Int
    public var maxManifestVersions: Int
    
    // Cleanup policies
    public var autoCleanupEnabled: Bool
    public var cleanupThresholdPercent: Int
    
    public static let `default` = StateRegistryStorageConfig(
        localManifestPath: "~/Library/Application Support/RadiantDeployer/StateRegistry/manifests",
        localBackupPath: "~/Library/Application Support/RadiantDeployer/StateRegistry/backups",
        localPackagePath: "~/Library/Application Support/RadiantDeployer/StateRegistry/packages",
        localCachePath: "~/Library/Application Support/RadiantDeployer/StateRegistry/cache",
        s3ManifestBucket: "radiant-{env}-state-manifests",
        s3BackupBucket: "radiant-{env}-state-backups",
        s3PackageBucket: "radiant-{env}-deployment-packages",
        s3Region: "us-east-1",
        maxLocalCacheSizeGB: 50,
        maxBackupRetentionDays: 90,
        maxManifestVersions: 100,
        autoCleanupEnabled: true,
        cleanupThresholdPercent: 85
    )
    
    /// Resolves the actual path by expanding ~ and environment variables
    public func resolvedPath(_ path: String) -> URL {
        let expanded = NSString(string: path).expandingTildeInPath
        return URL(fileURLWithPath: expanded)
    }
    
    /// Returns the manifest path for a specific environment
    public func manifestPath(for environment: EnvironmentName) -> URL {
        resolvedPath(localManifestPath).appendingPathComponent(environment.rawValue)
    }
    
    /// Returns the backup path for a specific environment
    public func backupPath(for environment: EnvironmentName) -> URL {
        resolvedPath(localBackupPath).appendingPathComponent(environment.rawValue)
    }
    
    /// Returns the package path
    public func packagePath() -> URL {
        resolvedPath(localPackagePath)
    }
    
    /// Returns the cache path
    public func cachePath() -> URL {
        resolvedPath(localCachePath)
    }
    
    /// Resolves S3 bucket name for environment
    public func s3Bucket(_ template: String, environment: EnvironmentName) -> String {
        template.replacingOccurrences(of: "{env}", with: environment.rawValue)
    }
}

// MARK: - Retry Configuration

/// Retry configuration with exponential backoff for transient failures.
public struct RetryConfig: Codable, Sendable, Equatable {
    public var maxRetries: Int
    public var initialDelayMs: Int
    public var maxDelayMs: Int
    public var backoffMultiplier: Double
    public var retryableErrors: [String]
    public var jitterEnabled: Bool
    
    public static let network = RetryConfig(
        maxRetries: 5,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2.0,
        retryableErrors: ["ETIMEDOUT", "ECONNRESET", "ENOTFOUND", "502", "503", "504"],
        jitterEnabled: true
    )
    
    public static let sync = RetryConfig(
        maxRetries: 3,
        initialDelayMs: 5000,
        maxDelayMs: 60000,
        backoffMultiplier: 2.0,
        retryableErrors: ["LOCK_CONFLICT", "RATE_LIMIT", "TEMPORARY_FAILURE"],
        jitterEnabled: true
    )
    
    public static let backup = RetryConfig(
        maxRetries: 3,
        initialDelayMs: 10000,
        maxDelayMs: 120000,
        backoffMultiplier: 2.0,
        retryableErrors: ["S3_THROTTLE", "DB_TIMEOUT", "NETWORK_ERROR"],
        jitterEnabled: false
    )
    
    /// Calculates delay for a specific retry attempt with optional jitter
    public func delay(for attempt: Int) -> TimeInterval {
        let baseDelay = Double(initialDelayMs) * pow(backoffMultiplier, Double(attempt))
        let cappedDelay = min(baseDelay, Double(maxDelayMs))
        
        if jitterEnabled {
            let jitter = Double.random(in: 0...0.3) * cappedDelay
            return (cappedDelay + jitter) / 1000.0
        }
        
        return cappedDelay / 1000.0
    }
    
    /// Checks if an error code is retryable
    public func isRetryable(_ errorCode: String) -> Bool {
        retryableErrors.contains(errorCode)
    }
}

// MARK: - Fallback Configuration

/// Fallback configuration for graceful degradation.
public struct FallbackConfig: Codable, Sendable, Equatable {
    // Cache fallback
    public var useCacheOnNetworkFailure: Bool
    public var maxCacheAgeMinutes: Int
    
    // Partial sync fallback
    public var continueOnPartialFailure: Bool
    public var minSuccessThreshold: Int // Percentage
    
    // Alternative storage fallback
    public var fallbackStoragePath: String?
    public var fallbackS3Bucket: String?
    
    // Read-only mode fallback
    public var enableReadOnlyOnWriteFailure: Bool
    
    // Retry escalation
    public var escalateAfterRetries: Int
    public var escalationChannels: [NotificationChannel]
    
    public static let `default` = FallbackConfig(
        useCacheOnNetworkFailure: true,
        maxCacheAgeMinutes: 60,
        continueOnPartialFailure: true,
        minSuccessThreshold: 80,
        fallbackStoragePath: nil,
        fallbackS3Bucket: nil,
        enableReadOnlyOnWriteFailure: true,
        escalateAfterRetries: 3,
        escalationChannels: [.email]
    )
}

public enum NotificationChannel: String, Codable, Sendable, CaseIterable {
    case email
    case slack
    case webhook
    case pagerduty
}

// MARK: - Data Integrity

/// Data integrity checksum for verification.
public struct DataIntegrityChecksum: Codable, Sendable, Equatable {
    public enum Algorithm: String, Codable, Sendable {
        case sha256
        case sha512
        case md5
        case xxhash
    }
    
    public var algorithm: Algorithm
    public var value: String
    public var computedAt: Date
    public var verified: Bool
    public var verifiedAt: Date?
    
    public init(algorithm: Algorithm, value: String, computedAt: Date = Date()) {
        self.algorithm = algorithm
        self.value = value
        self.computedAt = computedAt
        self.verified = false
    }
    
    public mutating func markVerified() {
        self.verified = true
        self.verifiedAt = Date()
    }
}

// MARK: - Conflict Resolution

/// Strategies for resolving sync conflicts.
public enum ConflictResolutionStrategy: String, Codable, Sendable, CaseIterable {
    case sourceWins = "source_wins"
    case targetWins = "target_wins"
    case newestWins = "newest_wins"
    case manual = "manual"
    case merge = "merge"
    case skip = "skip"
    
    public var displayName: String {
        switch self {
        case .sourceWins: return "Source Wins"
        case .targetWins: return "Target Wins"
        case .newestWins: return "Newest Wins"
        case .manual: return "Manual Resolution"
        case .merge: return "Merge"
        case .skip: return "Skip"
        }
    }
    
    public var description: String {
        switch self {
        case .sourceWins: return "Always use the source environment value"
        case .targetWins: return "Always keep the target environment value"
        case .newestWins: return "Use the most recently modified value"
        case .manual: return "Require manual resolution for each conflict"
        case .merge: return "Attempt to merge values (for compatible types)"
        case .skip: return "Skip conflicting items entirely"
        }
    }
}

// MARK: - Enhanced Sync Configuration

/// Enhanced sync configuration with conflict resolution and reliability settings.
public struct EnhancedSyncConfig: Codable, Sendable, Equatable {
    // Base sync settings
    public var enabled: Bool
    public var sourceEnvironment: EnvironmentName?
    
    // Conflict handling
    public var conflictResolution: ConflictResolutionStrategy
    public var conflictNotifications: Bool
    public var autoResolveThreshold: Int // Auto-resolve if confidence > this %
    
    // Retry and timeout settings
    public var retryConfig: RetryConfig
    public var operationTimeoutMs: Int
    public var itemTimeoutMs: Int
    
    // Data validation
    public var validateBeforeSync: Bool
    public var validateAfterSync: Bool
    public var checksumVerification: Bool
    
    // Rollback settings
    public var createCheckpointBeforeSync: Bool
    public var autoRollbackOnFailure: Bool
    public var rollbackThresholdPercent: Int
    
    // Rate limiting
    public var maxConcurrentItems: Int
    public var throttleDelayMs: Int
    
    // Notifications
    public var notifyOnStart: Bool
    public var notifyOnComplete: Bool
    public var notifyOnFailure: Bool
    public var notifyOnConflict: Bool
    public var notificationChannels: [NotificationChannel]
    
    public static let `default` = EnhancedSyncConfig(
        enabled: true,
        sourceEnvironment: nil,
        conflictResolution: .newestWins,
        conflictNotifications: true,
        autoResolveThreshold: 90,
        retryConfig: .sync,
        operationTimeoutMs: 300000,
        itemTimeoutMs: 30000,
        validateBeforeSync: true,
        validateAfterSync: true,
        checksumVerification: true,
        createCheckpointBeforeSync: true,
        autoRollbackOnFailure: true,
        rollbackThresholdPercent: 20,
        maxConcurrentItems: 10,
        throttleDelayMs: 100,
        notifyOnStart: false,
        notifyOnComplete: true,
        notifyOnFailure: true,
        notifyOnConflict: true,
        notificationChannels: [.email]
    )
}

// MARK: - Health Check

/// Health check result for State Registry components.
public struct StateRegistryHealthCheck: Codable, Sendable {
    public var timestamp: Date
    public var overall: HealthStatus
    public var components: ComponentHealth
    public var metrics: ReliabilityMetrics
    
    public enum HealthStatus: String, Codable, Sendable {
        case healthy
        case degraded
        case unhealthy
    }
    
    public struct ComponentHealth: Codable, Sendable {
        public var localCache: ComponentStatus
        public var s3Connection: ComponentStatus
        public var apiConnection: ComponentStatus
        public var database: ComponentStatus
    }
    
    public struct ComponentStatus: Codable, Sendable {
        public var status: HealthStatus
        public var latencyMs: Int?
        public var diskSpaceAvailableGB: Double?
        public var diskSpaceUsedGB: Double?
        public var connectionPoolUsage: Double?
        public var lastSuccessfulAt: Date?
        public var errors: [String]
    }
    
    public struct ReliabilityMetrics: Codable, Sendable {
        public var uptime: Double // Percentage
        public var successRate: Double // Percentage
        public var avgLatencyMs: Double
        public var errorCount24h: Int
        public var lastErrorAt: Date?
        public var lastError: String?
    }
}

// MARK: - Backup Validation

/// Comprehensive backup validation result.
public struct BackupValidationResult: Codable, Sendable {
    public var backupId: String
    public var validatedAt: Date
    public var overallValid: Bool
    public var validationDurationMs: Int
    public var components: ComponentValidations
    public var integrityChecks: IntegrityCheckResult
    public var recoverability: RecoverabilityAssessment
    
    public struct ComponentValidations: Codable, Sendable {
        public var infrastructure: ComponentValidation
        public var database: ComponentValidation
        public var s3: ComponentValidation
        public var secrets: ComponentValidation
        public var featureFlags: ComponentValidation
    }
    
    public struct ComponentValidation: Codable, Sendable {
        public var valid: Bool
        public var itemCount: Int
        public var validItems: Int
        public var invalidItems: [String]
        public var missingDependencies: [String]
        public var sizeBytes: Int64
    }
    
    public struct IntegrityCheckResult: Codable, Sendable {
        public var checksumValid: Bool
        public var checksumAlgorithm: String
        public var expectedChecksum: String
        public var actualChecksum: String
    }
    
    public struct RecoverabilityAssessment: Codable, Sendable {
        public var canRestore: Bool
        public var estimatedRestoreTime: Int // seconds
        public var blockers: [String]
        public var warnings: [String]
    }
}

// MARK: - Operation Checkpoint

/// Checkpoint for operation recovery and rollback.
public struct OperationCheckpoint: Codable, Sendable, Identifiable {
    public var id: String
    public var operationType: OperationType
    public var operationId: String
    public var createdAt: Date
    public var state: CheckpointState
    public var canResume: Bool
    public var resumeFrom: String?
    public var stateChecksum: DataIntegrityChecksum
    
    public enum OperationType: String, Codable, Sendable {
        case sync
        case backup
        case restore
    }
    
    public struct CheckpointState: Codable, Sendable {
        public var phase: String
        public var itemsCompleted: [String]
        public var itemsPending: [String]
        public var itemsFailed: [String]
    }
}

// MARK: - Recoverable Error

/// Comprehensive error with recovery suggestions.
public struct RecoverableError: Codable, Sendable, Identifiable {
    public var id: String { "\(code)-\(timestamp.timeIntervalSince1970)" }
    public var code: String
    public var message: String
    public var timestamp: Date
    
    public var category: ErrorCategory
    public var severity: ErrorSeverity
    public var isTransient: Bool
    
    public var recoverable: Bool
    public var suggestedActions: [String]
    public var autoRecoveryAttempted: Bool
    public var autoRecoverySucceeded: Bool?
    
    public var operationId: String?
    public var itemId: String?
    public var environment: EnvironmentName?
    
    public var retryCount: Int
    public var maxRetries: Int
    public var nextRetryAt: Date?
    
    public enum ErrorCategory: String, Codable, Sendable {
        case network
        case storage
        case permission
        case data
        case timeout
        case conflict
        case unknown
    }
    
    public enum ErrorSeverity: String, Codable, Sendable {
        case low
        case medium
        case high
        case critical
    }
}

// MARK: - SLA Targets

/// Reliability SLA targets.
public struct ReliabilitySLATargets {
    public static let availability: Double = 99.99 // 4 nines
    public static let syncSuccessRate: Double = 99.9
    public static let backupSuccessRate: Double = 99.99
    public static let restoreSuccessRate: Double = 99.9
    public static let maxSyncLatencyMs: Int = 30000
    public static let maxBackupLatencyMs: Int = 300000
    public static let maxRestoreLatencyMs: Int = 600000
    public static let maxApiLatencyMs: Int = 5000
    public static let dataIntegrityRate: Double = 100.0 // Must be 100%
}
