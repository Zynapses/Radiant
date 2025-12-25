// RADIANT v4.18.0 - Configuration
// Centralized configuration with environment variable support

import Foundation
import os.log

// MARK: - Logger

enum RadiantLogger {
    private static let subsystem = "com.radiant.deployer"
    
    static let general = Logger(subsystem: subsystem, category: "general")
    static let deployment = Logger(subsystem: subsystem, category: "deployment")
    static let packages = Logger(subsystem: subsystem, category: "packages")
    static let seeds = Logger(subsystem: subsystem, category: "seeds")
    static let aws = Logger(subsystem: subsystem, category: "aws")
    static let credentials = Logger(subsystem: subsystem, category: "credentials")
    
    /// Log an error with context
    static func error(_ message: String, error: Error? = nil, category: Logger = general) {
        if let error = error {
            category.error("\(message): \(error.localizedDescription)")
        } else {
            category.error("\(message)")
        }
    }
    
    /// Log a warning
    static func warning(_ message: String, category: Logger = general) {
        category.warning("\(message)")
    }
    
    /// Log info
    static func info(_ message: String, category: Logger = general) {
        category.info("\(message)")
    }
    
    /// Log debug info
    static func debug(_ message: String, category: Logger = general) {
        category.debug("\(message)")
    }
}

// MARK: - Configuration

struct RadiantConfig: Sendable {
    
    // MARK: - Singleton
    
    static let shared = RadiantConfig()
    
    // MARK: - AWS Configuration
    
    /// S3 bucket for official releases
    let releasesBucket: String
    
    /// S3 bucket prefix for seeds
    let seedsPrefix: String
    
    /// S3 bucket prefix for packages
    let packagesPrefix: String
    
    /// Default AWS region
    let defaultRegion: String
    
    // MARK: - Paths
    
    /// Local cache directory for packages
    let packageCacheDirectory: URL
    
    /// Local cache directory for seeds
    let seedsCacheDirectory: URL
    
    /// AWS CLI path
    let awsCliPath: String
    
    /// CDK CLI path
    let cdkCliPath: String
    
    // MARK: - Timeouts
    
    /// Default network timeout in seconds
    let networkTimeout: TimeInterval
    
    /// CDK deployment timeout in seconds
    let cdkDeploymentTimeout: TimeInterval
    
    /// Health check timeout in seconds
    let healthCheckTimeout: TimeInterval
    
    // MARK: - Feature Flags
    
    /// Enable verbose logging
    let verboseLogging: Bool
    
    /// Enable dry run mode (no actual deployments)
    let dryRunMode: Bool
    
    // MARK: - Initialization
    
    private init() {
        let env = ProcessInfo.processInfo.environment
        
        // AWS Configuration
        self.releasesBucket = env["RADIANT_RELEASES_BUCKET"] ?? "radiant-releases-us-east-1"
        self.seedsPrefix = env["RADIANT_SEEDS_PREFIX"] ?? "seeds/"
        self.packagesPrefix = env["RADIANT_PACKAGES_PREFIX"] ?? "packages/"
        self.defaultRegion = env["AWS_DEFAULT_REGION"] ?? "us-east-1"
        
        // Paths
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let radiantDir = appSupport.appendingPathComponent("RadiantDeployer")
        
        self.packageCacheDirectory = radiantDir.appendingPathComponent("packages")
        self.seedsCacheDirectory = radiantDir.appendingPathComponent("seeds")
        self.awsCliPath = env["AWS_CLI_PATH"] ?? "/usr/local/bin/aws"
        self.cdkCliPath = env["CDK_CLI_PATH"] ?? "/usr/local/bin/cdk"
        
        // Timeouts
        self.networkTimeout = TimeInterval(env["RADIANT_NETWORK_TIMEOUT"] ?? "30") ?? 30
        self.cdkDeploymentTimeout = TimeInterval(env["RADIANT_CDK_TIMEOUT"] ?? "3600") ?? 3600
        self.healthCheckTimeout = TimeInterval(env["RADIANT_HEALTH_TIMEOUT"] ?? "60") ?? 60
        
        // Feature Flags
        self.verboseLogging = env["RADIANT_VERBOSE"] == "true"
        self.dryRunMode = env["RADIANT_DRY_RUN"] == "true"
        
        // Ensure cache directories exist
        try? FileManager.default.createDirectory(at: packageCacheDirectory, withIntermediateDirectories: true)
        try? FileManager.default.createDirectory(at: seedsCacheDirectory, withIntermediateDirectories: true)
    }
    
    // MARK: - Helpers
    
    /// Get the full S3 URI for releases bucket
    func releasesS3URI(path: String = "") -> String {
        "s3://\(releasesBucket)/\(path)"
    }
    
    /// Get environment-specific bucket name
    func instanceBucket(appId: String, environment: String) -> String {
        "radiant-\(appId)-\(environment)-deployments"
    }
}

// MARK: - Credential Sanitization

extension RadiantConfig {
    
    /// Sanitize a string to remove potential credentials
    static func sanitize(_ string: String) -> String {
        var result = string
        
        // Patterns that might contain credentials
        let patterns = [
            // AWS Access Key ID (starts with AKIA, ABIA, ACCA, ASIA)
            "A[KBS]IA[A-Z0-9]{16}",
            // AWS Secret Access Key (40 char base64)
            "[A-Za-z0-9/+=]{40}",
            // Generic API keys
            "(?i)(api[_-]?key|apikey|secret|password|token)[\"':\\s=]+[A-Za-z0-9/+=_-]{16,}",
        ]
        
        for pattern in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern, options: []) {
                result = regex.stringByReplacingMatches(
                    in: result,
                    range: NSRange(result.startIndex..., in: result),
                    withTemplate: "[REDACTED]"
                )
            }
        }
        
        return result
    }
    
    /// Sanitize error for logging (removes potential credentials)
    static func sanitizeError(_ error: Error) -> String {
        sanitize(error.localizedDescription)
    }
}
