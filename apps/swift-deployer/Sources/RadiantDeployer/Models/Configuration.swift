import Foundation

/// Centralized configuration for RADIANT Deployer
/// All hardcoded values should be placed here for easy customization
struct Configuration {
    
    // MARK: - AWS Regions
    
    /// Default region for releases bucket
    static var releasesBucketRegion: String {
        ProcessInfo.processInfo.environment["RADIANT_RELEASES_REGION"] ?? "us-east-1"
    }
    
    /// Primary deployment region
    static var primaryRegion: String {
        ProcessInfo.processInfo.environment["RADIANT_PRIMARY_REGION"] ?? "us-east-1"
    }
    
    /// Available regions for deployment
    static let availableRegions: [String] = [
        "us-east-1",
        "us-west-2",
        "eu-west-1",
        "eu-central-1",
        "ap-northeast-1",
        "ap-southeast-1",
        "ap-south-1"
    ]
    
    // MARK: - S3 Buckets
    
    /// Releases bucket name pattern
    static func releasesBucket(region: String = releasesBucketRegion) -> String {
        "radiant-releases-\(region)"
    }
    
    /// Media bucket name pattern
    static func mediaBucket(region: String) -> String {
        "radiant-media-\(region)"
    }
    
    // MARK: - SES Configuration
    
    /// SES mail-from MX record
    static func sesMailFromMX(region: String = primaryRegion) -> String {
        "10 feedback-smtp.\(region).amazonses.com"
    }
    
    /// SES SPF record
    static let sesSPFRecord = "v=spf1 include:amazonses.com ~all"
    
    // MARK: - Version Information
    
    /// Current RADIANT version
    static let radiantVersion = "4.18.0"
    
    /// Minimum deployer version required
    static let minimumDeployerVersion = "4.18.0"
    
    // MARK: - Timeouts (seconds)
    
    static let cdkDeployTimeout = 1800
    static let cdkBootstrapTimeout = 600
    static let healthCheckTimeout = 30
    static let migrationTimeout = 300
    static let packageDownloadTimeout = 300
    
    // MARK: - Defaults
    
    /// Default VPC CIDR
    static let defaultVpcCidr = "10.0.0.0/16"
    
    /// Default Aurora instance class by tier
    static func defaultAuroraInstance(tier: Int) -> String {
        switch tier {
        case 1: return "db.t3.medium"
        case 2: return "db.r6g.large"
        case 3: return "db.r6g.xlarge"
        case 4: return "db.r6g.2xlarge"
        default: return "db.t3.medium"
        }
    }
    
    // MARK: - Compatibility
    
    /// Supported deployment tiers
    static let supportedTiers = ["1", "2", "3", "4"]
    
    /// AWS CDK version requirement
    static let awsCdkVersion = "2.x"
    
    /// Node.js version requirement
    static let nodejsVersion = "20.x"
    
    /// PostgreSQL version requirement
    static let postgresqlVersion = "15"
}
