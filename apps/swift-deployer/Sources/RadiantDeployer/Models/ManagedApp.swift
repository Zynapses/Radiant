// RADIANT v5.52.17 - Managed App Models
// Defines tenant applications and their deployment status

import Foundation
import SwiftUI

let DOMAIN_PLACEHOLDER = "YOUR_DOMAIN.com"

// MARK: - Managed App (Tenant-Level)

struct ManagedApp: Identifiable, Codable, Hashable, Sendable {
    let id: String
    var name: String
    var domain: String
    var description: String?
    var createdAt: Date
    var updatedAt: Date
    var environments: EnvironmentStatuses
    var domainConfig: DomainURLConfiguration?
    var applicationStatuses: [String: ApplicationStatus]?
    
    var isDomainConfigured: Bool {
        !domain.contains(DOMAIN_PLACEHOLDER)
    }
    
    struct EnvironmentStatuses: Codable, Hashable, Sendable {
        var dev: EnvironmentStatus
        var staging: EnvironmentStatus
        var prod: EnvironmentStatus
        
        subscript(env: DeployEnvironment) -> EnvironmentStatus {
            get {
                switch env {
                case .dev: return dev
                case .staging: return staging
                case .prod: return prod
                }
            }
            set {
                switch env {
                case .dev: dev = newValue
                case .staging: staging = newValue
                case .prod: prod = newValue
                }
            }
        }
    }
    
    // Get URL for a specific RADIANT application
    func url(for app: RadiantApplication, environment: DeployEnvironment) -> String? {
        guard let config = domainConfig else { return nil }
        let envStatus = environments[environment]
        guard envStatus.deployed else { return nil }
        return config.url(for: app)
    }
}

// MARK: - Environment Status

struct EnvironmentStatus: Codable, Hashable, Sendable {
    var deployed: Bool
    var version: String?
    var tier: Int
    var lastDeployedAt: Date?
    var healthStatus: HealthStatus
    var apiUrl: String?
    var dashboardUrl: String?
    
    // v5.52.17 - Application-specific URLs
    var radiantAdminUrl: String?
    var thinktankAdminUrl: String?
    var curatorUrl: String?
    var thinktankUrl: String?
    var externalApiUrl: String?
}

// MARK: - Health Status

enum HealthStatus: String, Codable, Sendable {
    case healthy, degraded, unhealthy, unknown
    
    var color: Color {
        switch self {
        case .healthy: return .green
        case .degraded: return .orange
        case .unhealthy: return .red
        case .unknown: return .gray
        }
    }
    
    var icon: String {
        switch self {
        case .healthy: return "checkmark.circle.fill"
        case .degraded: return "exclamationmark.triangle.fill"
        case .unhealthy: return "xmark.circle.fill"
        case .unknown: return "questionmark.circle"
        }
    }
    
    var displayName: String {
        switch self {
        case .healthy: return "Healthy"
        case .degraded: return "Degraded"
        case .unhealthy: return "Unhealthy"
        case .unknown: return "Unknown"
        }
    }
}

// MARK: - Default Apps

extension ManagedApp {
    /// Default RADIANT deployment - single tenant with all apps
    static func radiantDefault(baseDomain: String = DOMAIN_PLACEHOLDER) -> ManagedApp {
        ManagedApp(
            id: "radiant",
            name: "RADIANT Platform",
            domain: baseDomain,
            description: "Complete RADIANT AI platform deployment",
            createdAt: Date(),
            updatedAt: Date(),
            environments: .init(
                dev: .init(deployed: false, tier: 1, healthStatus: .unknown),
                staging: .init(deployed: false, tier: 2, healthStatus: .unknown),
                prod: .init(deployed: false, tier: 3, healthStatus: .unknown)
            ),
            domainConfig: baseDomain == DOMAIN_PLACEHOLDER ? nil : .defaults(baseDomain: baseDomain)
        )
    }
    
    /// Legacy defaults for backward compatibility
    static let defaults: [ManagedApp] = [
        radiantDefault()
    ]
    
    /// Create a new tenant app
    static func create(
        id: String,
        name: String,
        baseDomain: String,
        description: String? = nil
    ) -> ManagedApp {
        ManagedApp(
            id: id,
            name: name,
            domain: baseDomain,
            description: description,
            createdAt: Date(),
            updatedAt: Date(),
            environments: .init(
                dev: .init(deployed: false, tier: 1, healthStatus: .unknown),
                staging: .init(deployed: false, tier: 2, healthStatus: .unknown),
                prod: .init(deployed: false, tier: 3, healthStatus: .unknown)
            ),
            domainConfig: .defaults(baseDomain: baseDomain)
        )
    }
}

// MARK: - Platform Overview

struct PlatformOverview: Sendable {
    let apps: [RadiantApplication]
    let domainConfig: DomainURLConfiguration
    let environment: DeployEnvironment
    
    var urlPreviews: [URLPreview] {
        apps.map { URLPreview(app: $0, config: domainConfig) }
    }
    
    var enabledApps: [RadiantApplication] {
        apps.filter { domainConfig.isEnabled($0) }
    }
    
    var requiredApps: [RadiantApplication] {
        apps.filter { $0.isRequired }
    }
    
    var optionalApps: [RadiantApplication] {
        apps.filter { !$0.isRequired }
    }
}
