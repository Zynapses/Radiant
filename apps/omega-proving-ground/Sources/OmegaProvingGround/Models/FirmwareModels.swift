import Foundation

// MARK: - Bio Firmware

struct BioFirmware: Codable, Sendable {
    let firmware_version: String
    let schema_version: String
    let metadata: FirmwareMetadata
    let safety_invariants: SafetyInvariants
    let behavioral_parameters: BehavioralParameters
    let routing_rules: RoutingRules
    let compliance_flags: ComplianceFlags
    let resource_limits: ResourceLimits
    let integrations: Integrations?
}

struct FirmwareMetadata: Codable, Sendable {
    let name: String
    let description: String
    let author: String
    let created: String
    let classification: String
    let target_environment: String
    let signature: String
}

struct SafetyInvariants: Codable, Sendable {
    let version: String
    let rules: [SafetyRule]
}

struct SafetyRule: Codable, Sendable, Identifiable {
    let id: String
    let name: String
    let description: String
    let enforcement: String
    let cato_checkpoint: String
}

struct BehavioralParameters: Codable, Sendable {
    let default_temperature: Double
    let max_temperature: Double
    let min_temperature: Double
    let default_max_tokens: Int
    let absolute_max_tokens: Int
    let default_top_p: Double
    let persona: Persona
    let response_format: ResponseFormat
}

struct Persona: Codable, Sendable {
    let name: String
    let style: String
    let traits: [String]
    let greeting: String
    let delight_mode: String
}

struct ResponseFormat: Codable, Sendable {
    let prefer_structured: Bool
    let code_fence_language_tags: Bool
    let max_list_items: Int
    let citation_style: String
}

struct RoutingRules: Codable, Sendable {
    let default_model_tier: String
    let task_routing: [TaskRoute]
    let fallback_chain: [String]
    let max_retries: Int
    let circuit_breaker_threshold: Int
}

struct TaskRoute: Codable, Sendable, Identifiable {
    var id: String { task_type }
    let task_type: String
    let preferred_models: [String]
    let temperature_override: Double
    let require_sandbox: Bool?
    let require_consensus: Bool?
    let min_consensus_confidence: Double?
}

struct ComplianceFlags: Codable, Sendable {
    let hipaa_enabled: Bool
    let gdpr_enabled: Bool
    let soc2_enabled: Bool
    let pci_dss_enabled: Bool
    let fda_21_cfr_11_enabled: Bool
    let data_residency_region: String
    let zero_data_retention: Bool
    let audit_level: String
}

struct ResourceLimits: Codable, Sendable {
    let max_concurrent_requests: Int
    let max_daily_tokens: Int
    let max_request_tokens: Int
    let max_context_window: Int
    let rate_limit_rpm: Int
    let cost_ceiling_daily_usd: Double
}

struct Integrations: Codable, Sendable {
    let mcp_servers: [MCPServer]?
    let a2a_agents: [A2AAgent]?
}

struct MCPServer: Codable, Sendable, Identifiable {
    var id: String { name }
    let name: String
    let transport: String
    let enabled: Bool
    let sandboxed: Bool
}

struct A2AAgent: Codable, Sendable, Identifiable {
    var id: String { name }
    let name: String
    let endpoint: String
    let capabilities: [String]
    let require_jws: Bool
}

// MARK: - Validation

struct FirmwareValidationResult: Identifiable, Sendable {
    let id = UUID()
    let firmwareName: String
    let timestamp: Date
    var checks: [ValidationCheck]

    var passCount: Int { checks.filter { $0.passed }.count }
    var failCount: Int { checks.filter { !$0.passed }.count }
    var warnCount: Int { checks.filter { $0.severity == .warning && $0.passed }.count }
    var allPassed: Bool { checks.allSatisfy { $0.passed } }
    var passRate: Double {
        guard !checks.isEmpty else { return 0 }
        return Double(passCount) / Double(checks.count) * 100.0
    }
}

struct ValidationCheck: Identifiable, Sendable {
    let id = UUID()
    let category: ValidationCategory
    let name: String
    let description: String
    let passed: Bool
    let severity: ValidationSeverity
    let details: String
}

enum ValidationCategory: String, CaseIterable, Sendable {
    case schema = "Schema"
    case safety = "Safety Invariants"
    case behavioral = "Behavioral Parameters"
    case routing = "Routing Rules"
    case compliance = "Compliance"
    case resources = "Resource Limits"
    case integrations = "Integrations"
    case security = "Security"
}

enum ValidationSeverity: String, Sendable {
    case critical = "Critical"
    case error = "Error"
    case warning = "Warning"
    case info = "Info"

    var color: String {
        switch self {
        case .critical: return "red"
        case .error: return "orange"
        case .warning: return "yellow"
        case .info: return "blue"
        }
    }
}
