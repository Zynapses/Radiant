// RADIANT v4.18.0 - Installation Parameters
// Defines deployment parameters with tier-based defaults

import Foundation

// MARK: - Deployment Mode

enum DeploymentMode: String, Codable, Sendable {
    case install    // Fresh installation - uses defaults, seeds AI Registry
    case update     // Upgrade existing - fetches from instance, preserves customizations
    case rollback   // Revert to previous - restores from snapshot
    
    var displayName: String {
        switch self {
        case .install: return "Fresh Install"
        case .update: return "Update"
        case .rollback: return "Rollback"
        }
    }
    
    var icon: String {
        switch self {
        case .install: return "plus.circle.fill"
        case .update: return "arrow.up.circle.fill"
        case .rollback: return "arrow.uturn.backward.circle.fill"
        }
    }
    
    var color: String {
        switch self {
        case .install: return "green"
        case .update: return "blue"
        case .rollback: return "orange"
        }
    }
}

// MARK: - Tier Level

enum TierLevel: Int, Codable, CaseIterable, Sendable, Comparable {
    case seed = 1
    case starter = 2
    case growth = 3
    case scale = 4
    case enterprise = 5
    
    static func < (lhs: TierLevel, rhs: TierLevel) -> Bool {
        lhs.rawValue < rhs.rawValue
    }
    
    var displayName: String {
        switch self {
        case .seed: return "SEED"
        case .starter: return "STARTER"
        case .growth: return "GROWTH"
        case .scale: return "SCALE"
        case .enterprise: return "ENTERPRISE"
        }
    }
    
    var priceRange: String {
        switch self {
        case .seed: return "$50-150/mo"
        case .starter: return "$200-400/mo"
        case .growth: return "$1,000-2,500/mo"
        case .scale: return "$4,000-8,000/mo"
        case .enterprise: return "$15,000-35,000/mo"
        }
    }
    
    var description: String {
        switch self {
        case .seed: return "Development and testing"
        case .starter: return "Small production workloads"
        case .growth: return "Medium production with self-hosted models"
        case .scale: return "Large production with multi-region"
        case .enterprise: return "Enterprise-grade global deployment"
        }
    }
    
    var defaultAuroraInstance: String {
        switch self {
        case .seed: return "db.t4g.medium"
        case .starter: return "db.r6g.large"
        case .growth: return "db.r6g.xlarge"
        case .scale: return "db.r6g.2xlarge"
        case .enterprise: return "db.r6g.4xlarge"
        }
    }
    
    var defaultAuroraMinCapacity: Int {
        switch self {
        case .seed: return 0
        case .starter: return 1
        case .growth: return 2
        case .scale: return 4
        case .enterprise: return 8
        }
    }
    
    var defaultAuroraMaxCapacity: Int {
        switch self {
        case .seed: return 2
        case .starter: return 4
        case .growth: return 16
        case .scale: return 64
        case .enterprise: return 128
        }
    }
}

// MARK: - AWS Region

enum AWSRegion: String, Codable, CaseIterable, Sendable {
    case usEast1 = "us-east-1"
    case usEast2 = "us-east-2"
    case usWest2 = "us-west-2"
    case euWest1 = "eu-west-1"
    case euCentral1 = "eu-central-1"
    case apSoutheast1 = "ap-southeast-1"
    case apNortheast1 = "ap-northeast-1"
    
    var displayName: String {
        switch self {
        case .usEast1: return "US East (N. Virginia)"
        case .usEast2: return "US East (Ohio)"
        case .usWest2: return "US West (Oregon)"
        case .euWest1: return "EU (Ireland)"
        case .euCentral1: return "EU (Frankfurt)"
        case .apSoutheast1: return "Asia Pacific (Singapore)"
        case .apNortheast1: return "Asia Pacific (Tokyo)"
        }
    }
    
    var shortName: String {
        switch self {
        case .usEast1: return "US-E1"
        case .usEast2: return "US-E2"
        case .usWest2: return "US-W2"
        case .euWest1: return "EU-W1"
        case .euCentral1: return "EU-C1"
        case .apSoutheast1: return "AP-SE1"
        case .apNortheast1: return "AP-NE1"
        }
    }
    
    static var supported: [AWSRegion] {
        [.usEast1, .usWest2, .euWest1, .apSoutheast1]
    }
}

// MARK: - Installation Parameters

struct InstallationParameters: Codable, Sendable {
    // Infrastructure
    var tier: TierLevel
    var region: AWSRegion
    var vpcCidr: String
    var multiAz: Bool
    
    // Database
    var auroraInstanceClass: String
    var auroraMinCapacity: Int
    var auroraMaxCapacity: Int
    
    // Features
    var enableSelfHostedModels: Bool
    var enableMultiRegion: Bool
    var enableWAF: Bool
    var enableGuardDuty: Bool
    var enableHIPAACompliance: Bool
    
    // Billing
    var externalProviderMarkup: Double  // Default: 1.40 (40%)
    var selfHostedMarkup: Double        // Default: 1.75 (75%)
    
    // AI Registry
    var seedAIRegistry: Bool            // Default: true (ONLY on install)
    
    // Version tracking
    var version: String
    
    /// Create default parameters for a fresh installation
    static func defaults(
        appId: String,
        environment: DeployEnvironment,
        tier: TierLevel
    ) -> InstallationParameters {
        return InstallationParameters(
            tier: tier,
            region: .usEast1,
            vpcCidr: "10.0.0.0/16",
            multiAz: tier >= .growth,
            auroraInstanceClass: tier.defaultAuroraInstance,
            auroraMinCapacity: tier.defaultAuroraMinCapacity,
            auroraMaxCapacity: tier.defaultAuroraMaxCapacity,
            enableSelfHostedModels: tier >= .growth,
            enableMultiRegion: tier >= .scale,
            enableWAF: tier >= .starter,
            enableGuardDuty: tier >= .starter,
            enableHIPAACompliance: false,  // Must be explicitly enabled
            externalProviderMarkup: 1.40,
            selfHostedMarkup: 1.75,
            seedAIRegistry: true,  // ONLY true on fresh install
            version: RADIANT_VERSION
        )
    }
}

// MARK: - Instance Parameters (fetched from running instance)

struct InstanceParameters: Codable, Sendable {
    // All fields from InstallationParameters
    var tier: TierLevel
    var region: AWSRegion
    var vpcCidr: String
    var multiAz: Bool
    var auroraInstanceClass: String
    var auroraMinCapacity: Int
    var auroraMaxCapacity: Int
    var enableSelfHostedModels: Bool
    var enableMultiRegion: Bool
    var enableWAF: Bool
    var enableGuardDuty: Bool
    var enableHIPAACompliance: Bool
    var externalProviderMarkup: Double
    var selfHostedMarkup: Double
    var version: String
    
    // Instance-specific (fetched from running instance)
    var instanceId: String?
    var deployedAt: Date?
    var lastUpdatedAt: Date?
    var customSettings: [String: String]?
    
    /// Convert to installation parameters (for update deployments)
    func toInstallationParameters() -> InstallationParameters {
        InstallationParameters(
            tier: tier,
            region: region,
            vpcCidr: vpcCidr,
            multiAz: multiAz,
            auroraInstanceClass: auroraInstanceClass,
            auroraMinCapacity: auroraMinCapacity,
            auroraMaxCapacity: auroraMaxCapacity,
            enableSelfHostedModels: enableSelfHostedModels,
            enableMultiRegion: enableMultiRegion,
            enableWAF: enableWAF,
            enableGuardDuty: enableGuardDuty,
            enableHIPAACompliance: enableHIPAACompliance,
            externalProviderMarkup: externalProviderMarkup,
            selfHostedMarkup: selfHostedMarkup,
            seedAIRegistry: false,  // NEVER seed on update
            version: version
        )
    }
    
    /// Create defaults (for initial display before fetching from instance)
    static func defaults(tier: TierLevel) -> InstanceParameters {
        InstanceParameters(
            tier: tier,
            region: .usEast1,
            vpcCidr: "10.0.0.0/16",
            multiAz: tier >= .growth,
            auroraInstanceClass: tier.defaultAuroraInstance,
            auroraMinCapacity: tier.defaultAuroraMinCapacity,
            auroraMaxCapacity: tier.defaultAuroraMaxCapacity,
            enableSelfHostedModels: tier >= .growth,
            enableMultiRegion: tier >= .scale,
            enableWAF: tier >= .starter,
            enableGuardDuty: tier >= .starter,
            enableHIPAACompliance: false,
            externalProviderMarkup: 1.40,
            selfHostedMarkup: 1.75,
            version: RADIANT_VERSION,
            instanceId: nil,
            deployedAt: nil,
            lastUpdatedAt: nil,
            customSettings: nil
        )
    }
}

// MARK: - Parameter Changes (for tracking user modifications)

struct ParameterChanges: Codable, Sendable {
    var tier: TierLevel?
    var multiAz: Bool?
    var auroraInstanceClass: String?
    var auroraMinCapacity: Int?
    var auroraMaxCapacity: Int?
    var enableSelfHostedModels: Bool?
    var enableMultiRegion: Bool?
    var enableWAF: Bool?
    var enableGuardDuty: Bool?
    var enableHIPAACompliance: Bool?
    var externalProviderMarkup: Double?
    var selfHostedMarkup: Double?
    
    var isEmpty: Bool {
        tier == nil &&
        multiAz == nil &&
        auroraInstanceClass == nil &&
        auroraMinCapacity == nil &&
        auroraMaxCapacity == nil &&
        enableSelfHostedModels == nil &&
        enableMultiRegion == nil &&
        enableWAF == nil &&
        enableGuardDuty == nil &&
        enableHIPAACompliance == nil &&
        externalProviderMarkup == nil &&
        selfHostedMarkup == nil
    }
}

// MARK: - Parameter Change Record (for UI display)

struct ParameterChange: Identifiable, Sendable {
    let id = UUID()
    let field: String
    let oldValue: String
    let newValue: String
}

// MARK: - Deployment Snapshot

struct DeploymentSnapshot: Codable, Sendable, Identifiable, Hashable {
    let id: String
    let appId: String
    let environment: String
    let version: String
    let packageHash: String
    let parameters: InstanceParameters
    let createdAt: Date
    let reason: SnapshotReason
    let databaseSnapshotId: String?
    let includesDatabaseRollback: Bool
    
    enum SnapshotReason: String, Codable, Sendable {
        case preUpdate = "pre_update"
        case preRollback = "pre_rollback"
        case manual = "manual"
        case scheduled = "scheduled"
    }
    
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
    
    static func == (lhs: DeploymentSnapshot, rhs: DeploymentSnapshot) -> Bool {
        lhs.id == rhs.id
    }
}
