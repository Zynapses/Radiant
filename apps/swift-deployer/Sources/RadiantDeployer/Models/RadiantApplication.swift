// RADIANT v7.5.0 - Radiant Application Registry
// Defines all deployable applications in the RADIANT platform

import Foundation
import SwiftUI

// MARK: - Radiant Application

enum RadiantApplication: String, CaseIterable, Codable, Sendable, Identifiable {
    case radiantAdmin = "radiant-admin"
    case thinktankAdmin = "thinktank-admin"
    case curator = "curator"
    case thinktank = "thinktank"
    case api = "api"
    // v7.5.0 - Project Genesis/OMEGA
    case genesisLab = "genesis-lab"
    case genesisForge = "genesis-forge"
    case omegaApi = "omega-api"
    // v7.17.0 - Aurelius Dojo
    case dojo = "dojo"
    // v7.18.0 - Cato Trainer
    case catoTrainer = "cato-trainer"
    
    var id: String { rawValue }
    
    var displayName: String {
        switch self {
        case .radiantAdmin: return "RADIANT Admin"
        case .thinktankAdmin: return "Think Tank Admin"
        case .curator: return "Curator"
        case .thinktank: return "Think Tank"
        case .api: return "External API"
        case .genesisLab: return "Genesis Lab"
        case .genesisForge: return "Genesis Forge"
        case .omegaApi: return "OMEGA API"
        case .dojo: return "Aurelius Dojo"
        case .catoTrainer: return "Cato Trainer"
        }
    }
    
    var shortName: String {
        switch self {
        case .radiantAdmin: return "Admin"
        case .thinktankAdmin: return "TT Admin"
        case .curator: return "Curator"
        case .thinktank: return "Think Tank"
        case .api: return "API"
        case .genesisLab: return "Genesis"
        case .genesisForge: return "Forge"
        case .omegaApi: return "OMEGA"
        case .dojo: return "Dojo"
        case .catoTrainer: return "Cato"
        }
    }
    
    var description: String {
        switch self {
        case .radiantAdmin:
            return "Platform administration dashboard for managing tenants, AI models, billing, and system configuration"
        case .thinktankAdmin:
            return "Think Tank configuration including Ego, Cortex, Governor, Delight, and feature management"
        case .curator:
            return "Knowledge graph curation, fact verification, conflict resolution, and domain management"
        case .thinktank:
            return "Consumer AI interface with chat, artifacts, collaboration, and compliance features"
        case .api:
            return "External REST and GraphQL API for integrations and third-party access"
        case .genesisLab:
            return "OMEGA brain monitoring dashboard with thermal visualization, coherence metrics, and Cortex Explorer"
        case .genesisForge:
            return "OMEGA firmware creation tool for .bio files with Helix rules, ambition settings, and personality traits"
        case .omegaApi:
            return "OMEGA bio-mimetic AI inference API with Time Warp, shadow mode, and brain management"
        case .dojo:
            return "Thematic mastery training platform with spaced repetition, scenario synthesis, and competency mapping"
        case .catoTrainer:
            return "AI-powered knowledge base delivering instant, citable responses with ground-truth accuracy from document libraries"
        }
    }
    
    var defaultSubdomain: String {
        switch self {
        case .radiantAdmin: return "admin"
        case .thinktankAdmin: return "thinktank-admin"
        case .curator: return "curator"
        case .thinktank: return "app"
        case .api: return "api"
        case .genesisLab: return "genesis"
        case .genesisForge: return "forge"
        case .omegaApi: return "omega"
        case .dojo: return "dojo"
        case .catoTrainer: return "cato"
        }
    }
    
    var defaultPath: String {
        switch self {
        case .radiantAdmin: return "/admin"
        case .thinktankAdmin: return "/thinktank-admin"
        case .curator: return "/curator"
        case .thinktank: return "/"
        case .api: return "/api"
        case .genesisLab: return "/genesis"
        case .genesisForge: return "/forge"
        case .omegaApi: return "/omega"
        case .dojo: return "/dojo"
        case .catoTrainer: return "/cato"
        }
    }
    
    var icon: String {
        switch self {
        case .radiantAdmin: return "gearshape.2"
        case .thinktankAdmin: return "brain.head.profile"
        case .curator: return "book.pages"
        case .thinktank: return "bubble.left.and.bubble.right"
        case .api: return "link"
        case .genesisLab: return "waveform.path.ecg"
        case .genesisForge: return "hammer.fill"
        case .omegaApi: return "brain"
        case .dojo: return "flame"
        case .catoTrainer: return "shield.checkered"
        }
    }
    
    var color: Color {
        switch self {
        case .radiantAdmin: return .blue
        case .thinktankAdmin: return .purple
        case .curator: return .orange
        case .thinktank: return .green
        case .api: return .cyan
        case .genesisLab: return .pink
        case .genesisForge: return .red
        case .omegaApi: return .indigo
        case .dojo: return .orange
        case .catoTrainer: return .teal
        }
    }
    
    var isRequired: Bool {
        switch self {
        case .radiantAdmin, .thinktank, .api: return true
        case .thinktankAdmin, .curator, .genesisLab, .genesisForge, .omegaApi, .dojo, .catoTrainer: return false
        }
    }
    
    var tier: ApplicationTier {
        switch self {
        case .radiantAdmin, .thinktank, .api: return .core
        case .thinktankAdmin: return .standard
        case .curator: return .advanced
        case .genesisLab, .genesisForge, .omegaApi: return .enterprise
        case .dojo: return .advanced
        case .catoTrainer: return .advanced
        }
    }
    
    var techStack: String {
        switch self {
        case .radiantAdmin: return "Next.js 14 + TypeScript"
        case .thinktankAdmin: return "Next.js 14 + TypeScript"
        case .curator: return "Next.js 14 + TypeScript"
        case .thinktank: return "Next.js 14 + TypeScript"
        case .api: return "AWS Lambda + API Gateway"
        case .genesisLab: return "Next.js 14 + Three.js"
        case .genesisForge: return "Next.js 14 + TypeScript"
        case .omegaApi: return "AWS Lambda + Python 3.11"
        case .dojo: return "Next.js 14 + TypeScript"
        case .catoTrainer: return "Next.js 14 + TypeScript"
        }
    }
    
    var sourceDirectory: String {
        switch self {
        case .radiantAdmin: return "apps/admin-dashboard"
        case .thinktankAdmin: return "apps/thinktank-admin"
        case .curator: return "apps/curator"
        case .thinktank: return "apps/thinktank"
        case .api: return "packages/infrastructure/lambda"
        case .genesisLab: return "apps/genesis"
        case .genesisForge: return "apps/genesis"
        case .omegaApi: return "packages/infrastructure/omega"
        case .dojo: return "apps/dojo"
        case .catoTrainer: return "apps/cato-trainer"
        }
    }
    
    static var webApps: [RadiantApplication] {
        [.radiantAdmin, .thinktankAdmin, .curator, .thinktank, .genesisLab, .genesisForge, .dojo, .catoTrainer]
    }
    
    static var genesisApps: [RadiantApplication] {
        [.genesisLab, .genesisForge, .omegaApi]
    }
    
    static var requiredApps: [RadiantApplication] {
        allCases.filter { $0.isRequired }
    }
    
    static var optionalApps: [RadiantApplication] {
        allCases.filter { !$0.isRequired }
    }
}

// MARK: - Application Tier

enum ApplicationTier: String, Codable, Sendable, Comparable {
    case core = "Core"
    case standard = "Standard"
    case advanced = "Advanced"
    case enterprise = "Enterprise"
    
    static func < (lhs: ApplicationTier, rhs: ApplicationTier) -> Bool {
        let order: [ApplicationTier] = [.core, .standard, .advanced, .enterprise]
        return order.firstIndex(of: lhs)! < order.firstIndex(of: rhs)!
    }
    
    var description: String {
        switch self {
        case .core: return "Included in all tiers"
        case .standard: return "Starter tier and above"
        case .advanced: return "Growth tier and above"
        case .enterprise: return "Scale tier and above (OMEGA)"
        }
    }
    
    var minimumTierLevel: TierLevel {
        switch self {
        case .core: return .seed
        case .standard: return .starter
        case .advanced: return .growth
        case .enterprise: return .scale
        }
    }
}

// MARK: - Application Status

struct ApplicationStatus: Codable, Sendable, Identifiable, Hashable, Equatable {
    let id: String
    let app: RadiantApplication
    var enabled: Bool
    var deployed: Bool
    var version: String?
    var healthStatus: HealthStatus
    var lastDeployedAt: Date?
    var url: String?
    var cloudFrontDistributionId: String?
    var errorMessage: String?
    
    init(app: RadiantApplication) {
        self.id = app.rawValue
        self.app = app
        self.enabled = app.isRequired
        self.deployed = false
        self.version = nil
        self.healthStatus = .unknown
        self.lastDeployedAt = nil
        self.url = nil
        self.cloudFrontDistributionId = nil
        self.errorMessage = nil
    }
}

// MARK: - Application Configuration

struct ApplicationConfiguration: Codable, Sendable {
    var apps: [RadiantApplication: ApplicationSettings]
    
    struct ApplicationSettings: Codable, Sendable {
        var enabled: Bool
        var customConfig: [String: String]?
    }
    
    static var defaults: ApplicationConfiguration {
        var apps: [RadiantApplication: ApplicationSettings] = [:]
        for app in RadiantApplication.allCases {
            apps[app] = ApplicationSettings(enabled: app.isRequired)
        }
        return ApplicationConfiguration(apps: apps)
    }
    
    func isEnabled(_ app: RadiantApplication) -> Bool {
        apps[app]?.enabled ?? app.isRequired
    }
    
    mutating func setEnabled(_ app: RadiantApplication, enabled: Bool) {
        if apps[app] != nil {
            apps[app]?.enabled = enabled
        } else {
            apps[app] = ApplicationSettings(enabled: enabled)
        }
    }
}
