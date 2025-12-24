import Foundation

let DOMAIN_PLACEHOLDER = "YOUR_DOMAIN.com"

struct ManagedApp: Identifiable, Codable, Hashable, Sendable {
    let id: String
    var name: String
    var domain: String
    var description: String?
    var createdAt: Date
    var updatedAt: Date
    var environments: EnvironmentStatuses
    
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
}

struct EnvironmentStatus: Codable, Hashable, Sendable {
    var deployed: Bool
    var version: String?
    var tier: Int
    var lastDeployedAt: Date?
    var healthStatus: HealthStatus
    var apiUrl: String?
    var dashboardUrl: String?
}

enum HealthStatus: String, Codable, Sendable {
    case healthy, degraded, unhealthy, unknown
    
    var color: String {
        switch self {
        case .healthy: return "green"
        case .degraded: return "orange"
        case .unhealthy: return "red"
        case .unknown: return "gray"
        }
    }
}

extension ManagedApp {
    static let defaults: [ManagedApp] = [
        ManagedApp(
            id: "thinktank",
            name: "Think Tank",
            domain: "thinktank.\(DOMAIN_PLACEHOLDER)",
            description: "AI-powered brainstorming and ideation platform",
            createdAt: Date(),
            updatedAt: Date(),
            environments: .init(
                dev: .init(deployed: false, tier: 1, healthStatus: .unknown),
                staging: .init(deployed: false, tier: 2, healthStatus: .unknown),
                prod: .init(deployed: false, tier: 3, healthStatus: .unknown)
            )
        ),
        ManagedApp(
            id: "launchboard",
            name: "Launch Board",
            domain: "launchboard.\(DOMAIN_PLACEHOLDER)",
            description: "Project launch management and tracking",
            createdAt: Date(),
            updatedAt: Date(),
            environments: .init(
                dev: .init(deployed: false, tier: 1, healthStatus: .unknown),
                staging: .init(deployed: false, tier: 2, healthStatus: .unknown),
                prod: .init(deployed: false, tier: 3, healthStatus: .unknown)
            )
        ),
        ManagedApp(
            id: "alwaysme",
            name: "Always Me",
            domain: "alwaysme.\(DOMAIN_PLACEHOLDER)",
            description: "Personal AI assistant and memory",
            createdAt: Date(),
            updatedAt: Date(),
            environments: .init(
                dev: .init(deployed: false, tier: 1, healthStatus: .unknown),
                staging: .init(deployed: false, tier: 2, healthStatus: .unknown),
                prod: .init(deployed: false, tier: 3, healthStatus: .unknown)
            )
        ),
        ManagedApp(
            id: "mechanicalmaker",
            name: "Mechanical Maker",
            domain: "mechanicalmaker.\(DOMAIN_PLACEHOLDER)",
            description: "AI-assisted mechanical design and CAD",
            createdAt: Date(),
            updatedAt: Date(),
            environments: .init(
                dev: .init(deployed: false, tier: 1, healthStatus: .unknown),
                staging: .init(deployed: false, tier: 2, healthStatus: .unknown),
                prod: .init(deployed: false, tier: 3, healthStatus: .unknown)
            )
        )
    ]
}
