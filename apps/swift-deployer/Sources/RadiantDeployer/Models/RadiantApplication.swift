// RADIANT v5.52.17 - Radiant Application Registry
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
    
    var id: String { rawValue }
    
    var displayName: String {
        switch self {
        case .radiantAdmin: return "RADIANT Admin"
        case .thinktankAdmin: return "Think Tank Admin"
        case .curator: return "Curator"
        case .thinktank: return "Think Tank"
        case .api: return "External API"
        }
    }
    
    var shortName: String {
        switch self {
        case .radiantAdmin: return "Admin"
        case .thinktankAdmin: return "TT Admin"
        case .curator: return "Curator"
        case .thinktank: return "Think Tank"
        case .api: return "API"
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
        }
    }
    
    var defaultSubdomain: String {
        switch self {
        case .radiantAdmin: return "admin"
        case .thinktankAdmin: return "thinktank-admin"
        case .curator: return "curator"
        case .thinktank: return "app"
        case .api: return "api"
        }
    }
    
    var defaultPath: String {
        switch self {
        case .radiantAdmin: return "/admin"
        case .thinktankAdmin: return "/thinktank-admin"
        case .curator: return "/curator"
        case .thinktank: return "/"
        case .api: return "/api"
        }
    }
    
    var icon: String {
        switch self {
        case .radiantAdmin: return "gearshape.2"
        case .thinktankAdmin: return "brain.head.profile"
        case .curator: return "book.pages"
        case .thinktank: return "bubble.left.and.bubble.right"
        case .api: return "link"
        }
    }
    
    var color: Color {
        switch self {
        case .radiantAdmin: return .blue
        case .thinktankAdmin: return .purple
        case .curator: return .orange
        case .thinktank: return .green
        case .api: return .cyan
        }
    }
    
    var isRequired: Bool {
        switch self {
        case .radiantAdmin, .thinktank, .api: return true
        case .thinktankAdmin, .curator: return false
        }
    }
    
    var tier: ApplicationTier {
        switch self {
        case .radiantAdmin, .thinktank, .api: return .core
        case .thinktankAdmin: return .standard
        case .curator: return .advanced
        }
    }
    
    var techStack: String {
        switch self {
        case .radiantAdmin: return "Next.js 14 + TypeScript"
        case .thinktankAdmin: return "Next.js 14 + TypeScript"
        case .curator: return "Next.js 14 + TypeScript"
        case .thinktank: return "Next.js 14 + TypeScript"
        case .api: return "AWS Lambda + API Gateway"
        }
    }
    
    var sourceDirectory: String {
        switch self {
        case .radiantAdmin: return "apps/admin-dashboard"
        case .thinktankAdmin: return "apps/thinktank-admin"
        case .curator: return "apps/curator"
        case .thinktank: return "apps/thinktank"
        case .api: return "packages/infrastructure/lambda"
        }
    }
    
    static var webApps: [RadiantApplication] {
        [.radiantAdmin, .thinktankAdmin, .curator, .thinktank]
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
    
    static func < (lhs: ApplicationTier, rhs: ApplicationTier) -> Bool {
        let order: [ApplicationTier] = [.core, .standard, .advanced]
        return order.firstIndex(of: lhs)! < order.firstIndex(of: rhs)!
    }
    
    var description: String {
        switch self {
        case .core: return "Included in all tiers"
        case .standard: return "Starter tier and above"
        case .advanced: return "Growth tier and above"
        }
    }
    
    var minimumTierLevel: TierLevel {
        switch self {
        case .core: return .seed
        case .standard: return .starter
        case .advanced: return .growth
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
