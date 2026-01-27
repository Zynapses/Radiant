// RADIANT v5.52.17 - Domain URL Configuration
// Configures domain routing for all RADIANT applications

import Foundation

// MARK: - Domain URL Configuration

struct DomainURLConfiguration: Codable, Sendable, Equatable {
    var baseDomain: String
    var routingStrategy: RoutingStrategy
    var appConfigs: [String: AppRouteConfig]
    var sslCertificateArn: String?
    var hostedZoneId: String?
    var cloudFrontDistributionId: String?
    var isVerified: Bool
    var createdAt: Date
    var updatedAt: Date
    
    // MARK: - Routing Strategy
    
    enum RoutingStrategy: String, Codable, Sendable, CaseIterable {
        case subdomain = "subdomain"
        case pathBased = "path"
        
        var displayName: String {
            switch self {
            case .subdomain: return "Subdomain-Based"
            case .pathBased: return "Path-Based"
            }
        }
        
        var description: String {
            switch self {
            case .subdomain: return "Each app on its own subdomain (e.g., admin.domain.com)"
            case .pathBased: return "All apps under paths on one domain (e.g., domain.com/admin)"
            }
        }
        
        var icon: String {
            switch self {
            case .subdomain: return "network"
            case .pathBased: return "arrow.triangle.branch"
            }
        }
    }
    
    // MARK: - App Route Config
    
    struct AppRouteConfig: Codable, Sendable, Equatable {
        var enabled: Bool
        var customSubdomain: String?
        var customPath: String?
        var cloudFrontBehaviorPriority: Int?
        var healthCheckPath: String
        var cachePolicy: CachePolicy
        
        enum CachePolicy: String, Codable, Sendable {
            case disabled = "disabled"
            case standard = "standard"
            case aggressive = "aggressive"
            
            var displayName: String {
                switch self {
                case .disabled: return "No Cache"
                case .standard: return "Standard (1 hour)"
                case .aggressive: return "Aggressive (24 hours)"
                }
            }
            
            var ttlSeconds: Int {
                switch self {
                case .disabled: return 0
                case .standard: return 3600
                case .aggressive: return 86400
                }
            }
        }
        
        static func defaults(for app: RadiantApplication) -> AppRouteConfig {
            AppRouteConfig(
                enabled: app.isRequired,
                customSubdomain: nil,
                customPath: nil,
                cloudFrontBehaviorPriority: nil,
                healthCheckPath: app == .api ? "/health" : "/_health",
                cachePolicy: app == .api ? .disabled : .standard
            )
        }
    }
    
    // MARK: - Initialization
    
    init(
        baseDomain: String,
        routingStrategy: RoutingStrategy = .pathBased,
        appConfigs: [String: AppRouteConfig]? = nil,
        sslCertificateArn: String? = nil,
        hostedZoneId: String? = nil,
        cloudFrontDistributionId: String? = nil,
        isVerified: Bool = false
    ) {
        self.baseDomain = baseDomain
        self.routingStrategy = routingStrategy
        self.sslCertificateArn = sslCertificateArn
        self.hostedZoneId = hostedZoneId
        self.cloudFrontDistributionId = cloudFrontDistributionId
        self.isVerified = isVerified
        self.createdAt = Date()
        self.updatedAt = Date()
        
        if let configs = appConfigs {
            self.appConfigs = configs
        } else {
            var configs: [String: AppRouteConfig] = [:]
            for app in RadiantApplication.allCases {
                configs[app.rawValue] = .defaults(for: app)
            }
            self.appConfigs = configs
        }
    }
    
    // MARK: - URL Generation
    
    func url(for app: RadiantApplication) -> String {
        guard let config = appConfigs[app.rawValue], config.enabled else {
            return ""
        }
        
        switch routingStrategy {
        case .subdomain:
            let subdomain = config.customSubdomain ?? app.defaultSubdomain
            return "https://\(subdomain).\(baseDomain)"
        case .pathBased:
            let path = config.customPath ?? app.defaultPath
            if path == "/" {
                return "https://\(baseDomain)"
            }
            return "https://\(baseDomain)\(path)"
        }
    }
    
    func allURLs() -> [(app: RadiantApplication, url: String)] {
        RadiantApplication.allCases.compactMap { app in
            guard let config = appConfigs[app.rawValue], config.enabled else {
                return nil
            }
            return (app, url(for: app))
        }
    }
    
    // MARK: - Configuration Access
    
    func config(for app: RadiantApplication) -> AppRouteConfig {
        appConfigs[app.rawValue] ?? .defaults(for: app)
    }
    
    mutating func setConfig(for app: RadiantApplication, config: AppRouteConfig) {
        appConfigs[app.rawValue] = config
        updatedAt = Date()
    }
    
    mutating func setEnabled(_ app: RadiantApplication, enabled: Bool) {
        if var config = appConfigs[app.rawValue] {
            config.enabled = enabled
            appConfigs[app.rawValue] = config
        } else {
            var config = AppRouteConfig.defaults(for: app)
            config.enabled = enabled
            appConfigs[app.rawValue] = config
        }
        updatedAt = Date()
    }
    
    func isEnabled(_ app: RadiantApplication) -> Bool {
        appConfigs[app.rawValue]?.enabled ?? app.isRequired
    }
    
    // MARK: - Validation
    
    var isValid: Bool {
        !baseDomain.isEmpty && 
        baseDomain.contains(".") && 
        !baseDomain.hasPrefix("http") &&
        enabledApps.count > 0
    }
    
    var enabledApps: [RadiantApplication] {
        RadiantApplication.allCases.filter { isEnabled($0) }
    }
    
    var validationErrors: [String] {
        var errors: [String] = []
        
        if baseDomain.isEmpty {
            errors.append("Base domain is required")
        } else if !baseDomain.contains(".") {
            errors.append("Base domain must include a TLD (e.g., example.com)")
        } else if baseDomain.hasPrefix("http") {
            errors.append("Base domain should not include protocol (remove https://)")
        }
        
        if enabledApps.isEmpty {
            errors.append("At least one application must be enabled")
        }
        
        // Check required apps
        for app in RadiantApplication.requiredApps {
            if !isEnabled(app) {
                errors.append("\(app.displayName) is required and cannot be disabled")
            }
        }
        
        return errors
    }
    
    // MARK: - DNS Records Generation
    
    func generateDNSRecords() -> [DNSRecord] {
        var records: [DNSRecord] = []
        
        switch routingStrategy {
        case .subdomain:
            // Each app needs a CNAME to CloudFront
            for app in enabledApps {
                let subdomain = appConfigs[app.rawValue]?.customSubdomain ?? app.defaultSubdomain
                records.append(DNSRecord(
                    id: "app-\(app.rawValue)",
                    type: .CNAME,
                    name: subdomain,
                    value: cloudFrontDistributionId.map { "\($0).cloudfront.net" } ?? "PENDING",
                    ttl: 300,
                    purpose: "\(app.displayName) subdomain",
                    isRequired: app.isRequired,
                    status: .pending
                ))
            }
        case .pathBased:
            // Single A record (or ALIAS) to CloudFront
            records.append(DNSRecord(
                id: "root",
                type: .A,
                name: "@",
                value: cloudFrontDistributionId.map { "\($0).cloudfront.net" } ?? "PENDING",
                ttl: 300,
                purpose: "Root domain to CloudFront",
                isRequired: true,
                status: .pending
            ))
        }
        
        return records
    }
    
    // MARK: - CDK Context
    
    func toCDKContext() -> [String: Any] {
        var context: [String: Any] = [
            "baseDomain": baseDomain,
            "routingStrategy": routingStrategy.rawValue,
            "isVerified": isVerified
        ]
        
        if let cert = sslCertificateArn {
            context["sslCertificateArn"] = cert
        }
        
        if let zone = hostedZoneId {
            context["hostedZoneId"] = zone
        }
        
        var appPaths: [String: [String: Any]] = [:]
        for app in RadiantApplication.allCases {
            let config = self.config(for: app)
            appPaths[app.rawValue] = [
                "enabled": config.enabled,
                "subdomain": config.customSubdomain ?? app.defaultSubdomain,
                "path": config.customPath ?? app.defaultPath,
                "healthCheckPath": config.healthCheckPath,
                "cachePolicy": config.cachePolicy.rawValue
            ]
        }
        context["apps"] = appPaths
        
        return context
    }
    
    // MARK: - Defaults
    
    static func defaults(baseDomain: String = "") -> DomainURLConfiguration {
        DomainURLConfiguration(baseDomain: baseDomain)
    }
    
    static let placeholder = DomainURLConfiguration(baseDomain: "your-domain.com")
}

// MARK: - Domain Validation Result

struct DomainValidationResult: Sendable {
    let domain: String
    let isValid: Bool
    let dnsRecordsFound: Bool
    let sslCertificateValid: Bool
    let cloudFrontConfigured: Bool
    let errors: [String]
    let warnings: [String]
    
    var overallStatus: ValidationStatus {
        if !isValid { return .invalid }
        if errors.isEmpty && warnings.isEmpty { return .valid }
        if errors.isEmpty { return .validWithWarnings }
        return .invalid
    }
    
    enum ValidationStatus: String, Sendable {
        case valid = "Valid"
        case validWithWarnings = "Valid with Warnings"
        case invalid = "Invalid"
        case pending = "Pending Validation"
        
        var color: String {
            switch self {
            case .valid: return "green"
            case .validWithWarnings: return "orange"
            case .invalid: return "red"
            case .pending: return "gray"
            }
        }
        
        var icon: String {
            switch self {
            case .valid: return "checkmark.circle.fill"
            case .validWithWarnings: return "exclamationmark.triangle.fill"
            case .invalid: return "xmark.circle.fill"
            case .pending: return "clock.fill"
            }
        }
    }
}

// MARK: - URL Preview

struct URLPreview: Identifiable, Sendable {
    let id: String
    let app: RadiantApplication
    let url: String
    let isEnabled: Bool
    let isRequired: Bool
    
    init(app: RadiantApplication, config: DomainURLConfiguration) {
        self.id = app.rawValue
        self.app = app
        self.url = config.url(for: app)
        self.isEnabled = config.isEnabled(app)
        self.isRequired = app.isRequired
    }
}
