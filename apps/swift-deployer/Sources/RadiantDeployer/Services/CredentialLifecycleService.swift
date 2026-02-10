// RADIANT v4.18.0 - Credential Lifecycle Security Service
// Implements NIST SP 800-57, CIS AWS Benchmark, SOC2 CC6.1, and AWS Well-Architected
// Manages: API key lifecycle, dormant key detection, rotation scheduling,
//          IAM hygiene audits, Secrets Manager orchestration, compliance reporting

import Foundation
import CryptoKit

actor CredentialLifecycleService {
    static let shared = CredentialLifecycleService()
    
    // MARK: - Types
    
    enum LifecycleError: Error, LocalizedError {
        case awsCommandFailed(String)
        case keyNotFound(String)
        case rotationFailed(String)
        case auditFailed(String)
        case complianceViolation(String)
        case configRuleFailed(String)
        case accessAnalyzerFailed(String)
        case secretsManagerFailed(String)
        
        var errorDescription: String? {
            switch self {
            case .awsCommandFailed(let msg): return "AWS CLI error: \(msg)"
            case .keyNotFound(let msg): return "Key not found: \(msg)"
            case .rotationFailed(let msg): return "Rotation failed: \(msg)"
            case .auditFailed(let msg): return "Audit failed: \(msg)"
            case .complianceViolation(let msg): return "Compliance violation: \(msg)"
            case .configRuleFailed(let msg): return "AWS Config rule error: \(msg)"
            case .accessAnalyzerFailed(let msg): return "Access Analyzer error: \(msg)"
            case .secretsManagerFailed(let msg): return "Secrets Manager error: \(msg)"
            }
        }
    }
    
    // MARK: - Compliance Standards
    
    enum ComplianceStandard: String, Codable, CaseIterable, Sendable {
        case nist80057 = "NIST SP 800-57"
        case cisAws = "CIS AWS Foundations Benchmark v3.0"
        case soc2 = "SOC 2 Type II (CC6.1)"
        case awsWellArchitected = "AWS Well-Architected (SEC02/SEC03)"
        case pciDss = "PCI DSS v4.0 (Req 3.6/3.7)"
        case iso27001 = "ISO 27001:2022 (A.9.2/A.9.4)"
        
        var description: String {
            switch self {
            case .nist80057: return "Key Management Recommendation — key lifecycle, rotation periods, cryptoperiods"
            case .cisAws: return "CIS 1.4/1.12/1.14/1.16 — root key, MFA, credential age, unused keys"
            case .soc2: return "Logical and Physical Access Controls — credential management"
            case .awsWellArchitected: return "Security Pillar — identity management, least privilege"
            case .pciDss: return "Cryptographic Key Management — generation, distribution, rotation, destruction"
            case .iso27001: return "Access Control — user registration/deregistration, access provisioning"
            }
        }
    }
    
    // MARK: - IAM Key Audit Models
    
    struct IAMKeyAudit: Sendable {
        let userName: String
        let accessKeyId: String
        let status: String
        let createdDate: Date
        let lastUsedDate: Date?
        let lastUsedService: String?
        let lastUsedRegion: String?
        let ageDays: Int
        let dormantDays: Int?
        let riskLevel: RiskLevel
        let recommendations: [String]
    }
    
    enum RiskLevel: String, Sendable, Comparable {
        case critical = "Critical"
        case high = "High"
        case medium = "Medium"
        case low = "Low"
        case info = "Info"
        
        var sortOrder: Int {
            switch self {
            case .critical: return 0
            case .high: return 1
            case .medium: return 2
            case .low: return 3
            case .info: return 4
            }
        }
        
        static func < (lhs: RiskLevel, rhs: RiskLevel) -> Bool {
            lhs.sortOrder < rhs.sortOrder
        }
    }
    
    // MARK: - Config Rule Models
    
    struct ConfigRuleStatus: Sendable {
        let ruleName: String
        let complianceType: String  // COMPLIANT, NON_COMPLIANT, NOT_APPLICABLE
        let lastEvaluated: Date?
        let annotation: String?
        let resourceCount: Int
    }
    
    // MARK: - Access Analyzer Models
    
    struct AccessAnalyzerFinding: Sendable {
        let id: String
        let resource: String
        let resourceType: String
        let principal: String
        let condition: String
        let action: [String]
        let status: String
        let createdAt: Date
        let isPublic: Bool
    }
    
    // MARK: - Secrets Manager Models
    
    struct ManagedSecret: Sendable {
        let name: String
        let arn: String
        let rotationEnabled: Bool
        let rotationDays: Int?
        let lastRotatedDate: Date?
        let nextRotationDate: Date?
        let lastAccessedDate: Date?
        let versionCount: Int
        let tags: [String: String]
    }
    
    // MARK: - Tenant API Key Models
    
    struct TenantApiKeyAudit: Sendable {
        let keyId: String
        let tenantId: String
        let keyPrefix: String
        let name: String
        let isActive: Bool
        let expiresAt: Date?
        let lastUsedAt: Date?
        let useCount: Int
        let dormantDays: Int?
        let dormantWarningLevel: String?
        let allowedIps: [String]?
        let allowedOrigins: [String]?
        let riskLevel: RiskLevel
        let recommendations: [String]
    }
    
    // MARK: - Full Audit Report
    
    struct SecurityAuditReport: Sendable {
        let generatedAt: Date
        let environment: String
        let region: String
        
        // IAM
        let iamKeyAudits: [IAMKeyAudit]
        let rootKeyPresent: Bool
        let rootMfaEnabled: Bool
        let usersWithoutMfa: Int
        
        // AWS Config
        let configRules: [ConfigRuleStatus]
        let configCompliant: Int
        let configNonCompliant: Int
        
        // Access Analyzer
        let analyzerFindings: [AccessAnalyzerFinding]
        let publicAccessFindings: Int
        
        // Secrets Manager
        let managedSecrets: [ManagedSecret]
        let secretsWithRotation: Int
        let secretsWithoutRotation: Int
        
        // Tenant API Keys
        let tenantKeyAudits: [TenantApiKeyAudit]
        let dormantKeys: Int
        let expiringKeys: Int
        let keysWithoutRestrictions: Int
        
        // Compliance
        let overallScore: Int  // 0-100
        let complianceStatus: [ComplianceStandard: ComplianceResult]
    }
    
    struct ComplianceResult: Sendable {
        let standard: ComplianceStandard
        let status: String  // PASS, FAIL, PARTIAL
        let score: Int
        let findings: [String]
        let remediations: [String]
    }
    
    // MARK: - Rotation Schedule
    
    struct RotationSchedule: Codable, Sendable {
        var iamKeyRotationDays: Int = 90
        var dbCredentialRotationDays: Int = 30
        var apiKeyDefaultExpiryDays: Int = 90
        var apiKeyGracePeriodDays: Int = 14
        var jwtSigningRotationDays: Int = 30
        var dormantWarning30Days: Bool = true
        var dormantWarning45Days: Bool = true
        var dormantAutoDisable60Days: Bool = true
        var enforceIpRestrictions: Bool = false
        var enforceOriginRestrictions: Bool = false
        var requireMfaForAllUsers: Bool = true
        var deleteRootAccessKeys: Bool = true
    }
    
    // MARK: - Properties
    
    private var currentSchedule: RotationSchedule = RotationSchedule()
    private let auditLogger = AuditLogger.shared
    private let dateFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    
    // MARK: - Initialization
    
    private init() {}
    
    // MARK: - Schedule Management
    
    func getSchedule() -> RotationSchedule {
        return currentSchedule
    }
    
    func updateSchedule(_ schedule: RotationSchedule) {
        currentSchedule = schedule
    }
    
    // MARK: - Full Security Audit
    
    func runFullSecurityAudit(
        environment: String,
        region: String,
        profile: String?,
        radiantBaseURL: String?,
        adminToken: String?,
        progressCallback: @Sendable (String) -> Void
    ) async throws -> SecurityAuditReport {
        progressCallback("Starting comprehensive security audit...")
        
        // 1. IAM Key Audit
        progressCallback("Auditing IAM access keys...")
        let iamAudits = try await auditIAMKeys(profile: profile, region: region)
        
        // 2. Root account checks
        progressCallback("Checking root account security...")
        let (rootKeyPresent, rootMfaEnabled) = try await checkRootAccountSecurity(profile: profile, region: region)
        
        // 3. MFA audit
        progressCallback("Auditing MFA enrollment...")
        let usersWithoutMfa = try await countUsersWithoutMfa(profile: profile, region: region)
        
        // 4. AWS Config rules
        progressCallback("Evaluating AWS Config compliance rules...")
        let configRules = try await evaluateConfigRules(profile: profile, region: region)
        
        // 5. IAM Access Analyzer
        progressCallback("Scanning IAM Access Analyzer findings...")
        let analyzerFindings = try await getAccessAnalyzerFindings(profile: profile, region: region)
        
        // 6. Secrets Manager inventory
        progressCallback("Inventorying Secrets Manager secrets...")
        let managedSecrets = try await inventorySecretsManager(profile: profile, region: region)
        
        // 7. Tenant API key audit (if RADIANT API available)
        progressCallback("Auditing tenant API keys...")
        let tenantKeyAudits = try await auditTenantApiKeys(
            baseURL: radiantBaseURL,
            adminToken: adminToken
        )
        
        // 8. Calculate compliance scores
        progressCallback("Calculating compliance scores...")
        let complianceStatus = calculateComplianceScores(
            iamAudits: iamAudits,
            rootKeyPresent: rootKeyPresent,
            rootMfaEnabled: rootMfaEnabled,
            usersWithoutMfa: usersWithoutMfa,
            configRules: configRules,
            analyzerFindings: analyzerFindings,
            managedSecrets: managedSecrets,
            tenantKeyAudits: tenantKeyAudits
        )
        
        let overallScore = complianceStatus.values.reduce(0) { $0 + $1.score } / max(complianceStatus.count, 1)
        
        let report = SecurityAuditReport(
            generatedAt: Date(),
            environment: environment,
            region: region,
            iamKeyAudits: iamAudits,
            rootKeyPresent: rootKeyPresent,
            rootMfaEnabled: rootMfaEnabled,
            usersWithoutMfa: usersWithoutMfa,
            configRules: configRules,
            configCompliant: configRules.filter { $0.complianceType == "COMPLIANT" }.count,
            configNonCompliant: configRules.filter { $0.complianceType == "NON_COMPLIANT" }.count,
            analyzerFindings: analyzerFindings,
            publicAccessFindings: analyzerFindings.filter { $0.isPublic }.count,
            managedSecrets: managedSecrets,
            secretsWithRotation: managedSecrets.filter { $0.rotationEnabled }.count,
            secretsWithoutRotation: managedSecrets.filter { !$0.rotationEnabled }.count,
            tenantKeyAudits: tenantKeyAudits,
            dormantKeys: tenantKeyAudits.filter { ($0.dormantDays ?? 0) >= 30 }.count,
            expiringKeys: tenantKeyAudits.filter {
                guard let exp = $0.expiresAt else { return false }
                return exp.timeIntervalSinceNow < Double(currentSchedule.apiKeyGracePeriodDays * 86400)
            }.count,
            keysWithoutRestrictions: tenantKeyAudits.filter {
                $0.isActive && $0.allowedIps == nil && $0.allowedOrigins == nil
            }.count,
            overallScore: overallScore,
            complianceStatus: complianceStatus
        )
        
        await auditLogger.log(
            action: .securityAuditCompleted,
            details: "Security audit completed for \(environment) with score \(overallScore)",
            metadata: ["environment": environment, "score": "\(overallScore)", "findings": "\(iamAudits.count + analyzerFindings.count + tenantKeyAudits.count)"]
        )
        
        progressCallback("Security audit complete. Overall score: \(overallScore)/100")
        
        return report
    }
    
    // MARK: - IAM Key Audit
    
    private func auditIAMKeys(profile: String?, region: String) async throws -> [IAMKeyAudit] {
        var audits: [IAMKeyAudit] = []
        
        // List IAM users
        let usersJson = try await runAWSCLI(
            command: "iam list-users --output json",
            profile: profile,
            region: region
        )
        
        guard let usersData = usersJson.data(using: .utf8),
              let usersDict = try? JSONSerialization.jsonObject(with: usersData) as? [String: Any],
              let users = usersDict["Users"] as? [[String: Any]] else {
            return audits
        }
        
        let now = Date()
        
        for user in users {
            guard let userName = user["UserName"] as? String else { continue }
            
            // List access keys for user
            let keysJson = try await runAWSCLI(
                command: "iam list-access-keys --user-name \(userName) --output json",
                profile: profile,
                region: region
            )
            
            guard let keysData = keysJson.data(using: .utf8),
                  let keysDict = try? JSONSerialization.jsonObject(with: keysData) as? [String: Any],
                  let keys = keysDict["AccessKeyMetadata"] as? [[String: Any]] else {
                continue
            }
            
            for key in keys {
                guard let keyId = key["AccessKeyId"] as? String,
                      let status = key["Status"] as? String,
                      let createDateStr = key["CreateDate"] as? String else {
                    continue
                }
                
                let createDate = ISO8601DateFormatter().date(from: createDateStr) ?? now
                let ageDays = Calendar.current.dateComponents([.day], from: createDate, to: now).day ?? 0
                
                // Get last used info
                var lastUsedDate: Date?
                var lastUsedService: String?
                var lastUsedRegion: String?
                
                let lastUsedJson = try? await runAWSCLI(
                    command: "iam get-access-key-last-used --access-key-id \(keyId) --output json",
                    profile: profile,
                    region: region
                )
                
                if let luJson = lastUsedJson,
                   let luData = luJson.data(using: .utf8),
                   let luDict = try? JSONSerialization.jsonObject(with: luData) as? [String: Any],
                   let luInfo = luDict["AccessKeyLastUsed"] as? [String: Any] {
                    if let luDateStr = luInfo["LastUsedDate"] as? String {
                        lastUsedDate = ISO8601DateFormatter().date(from: luDateStr)
                    }
                    lastUsedService = luInfo["ServiceName"] as? String
                    lastUsedRegion = luInfo["Region"] as? String
                }
                
                let dormantDays: Int?
                if let lastUsed = lastUsedDate {
                    dormantDays = Calendar.current.dateComponents([.day], from: lastUsed, to: now).day
                } else {
                    dormantDays = ageDays  // Never used = dormant since creation
                }
                
                // Determine risk
                var recommendations: [String] = []
                let riskLevel: RiskLevel
                
                if status == "Inactive" {
                    riskLevel = .low
                    recommendations.append("Consider deleting this inactive key")
                } else if ageDays > 365 {
                    riskLevel = .critical
                    recommendations.append("NIST SP 800-57: Key exceeds maximum cryptoperiod. Rotate immediately.")
                    recommendations.append("CIS AWS 1.14: Access keys should be rotated within 90 days.")
                } else if ageDays > 90 {
                    riskLevel = .high
                    recommendations.append("CIS AWS 1.14: Rotate access key (>\(ageDays) days old).")
                } else if (dormantDays ?? 0) > 45 {
                    riskLevel = .high
                    recommendations.append("CIS AWS 1.12: Disable key unused for \(dormantDays ?? 0) days.")
                } else if (dormantDays ?? 0) > 30 {
                    riskLevel = .medium
                    recommendations.append("Key approaching dormant threshold (\(dormantDays ?? 0) days unused).")
                } else if ageDays > 60 {
                    riskLevel = .medium
                    recommendations.append("Schedule rotation — key is \(ageDays) days old.")
                } else {
                    riskLevel = .low
                }
                
                audits.append(IAMKeyAudit(
                    userName: userName,
                    accessKeyId: keyId,
                    status: status,
                    createdDate: createDate,
                    lastUsedDate: lastUsedDate,
                    lastUsedService: lastUsedService,
                    lastUsedRegion: lastUsedRegion,
                    ageDays: ageDays,
                    dormantDays: dormantDays,
                    riskLevel: riskLevel,
                    recommendations: recommendations
                ))
            }
        }
        
        return audits.sorted { $0.riskLevel < $1.riskLevel }
    }
    
    // MARK: - Root Account Security
    
    private func checkRootAccountSecurity(profile: String?, region: String) async throws -> (rootKeyPresent: Bool, rootMfaEnabled: Bool) {
        let summaryJson = try await runAWSCLI(
            command: "iam get-account-summary --output json",
            profile: profile,
            region: region
        )
        
        guard let data = summaryJson.data(using: .utf8),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let summary = dict["SummaryMap"] as? [String: Int] else {
            return (false, false)
        }
        
        let rootKeyPresent = (summary["AccountAccessKeysPresent"] ?? 0) > 0
        let rootMfaEnabled = (summary["AccountMFAEnabled"] ?? 0) > 0
        
        return (rootKeyPresent, rootMfaEnabled)
    }
    
    // MARK: - MFA Audit
    
    private func countUsersWithoutMfa(profile: String?, region: String) async throws -> Int {
        let reportJson = try await runAWSCLI(
            command: "iam generate-credential-report --output json",
            profile: profile,
            region: region
        )
        
        // Wait for report generation
        try await Task.sleep(nanoseconds: 3_000_000_000)
        
        let getReportJson = try await runAWSCLI(
            command: "iam get-credential-report --output json",
            profile: profile,
            region: region
        )
        
        guard let data = getReportJson.data(using: .utf8),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let contentB64 = dict["Content"] as? String,
              let csvData = Data(base64Encoded: contentB64) else {
            return 0
        }
        
        let csv = String(data: csvData, encoding: .utf8) ?? ""
        let lines = csv.components(separatedBy: .newlines)
        guard lines.count > 1 else { return 0 }
        
        let headers = lines[0].components(separatedBy: ",")
        guard let mfaIndex = headers.firstIndex(of: "mfa_active"),
              let userIndex = headers.firstIndex(of: "user") else { return 0 }
        
        var count = 0
        for i in 1..<lines.count {
            let fields = lines[i].components(separatedBy: ",")
            guard fields.count > max(mfaIndex, userIndex) else { continue }
            let user = fields[userIndex]
            let mfa = fields[mfaIndex]
            if user != "<root_account>" && mfa != "true" {
                count += 1
            }
        }
        
        return count
    }
    
    // MARK: - AWS Config Rules
    
    private func evaluateConfigRules(profile: String?, region: String) async throws -> [ConfigRuleStatus] {
        let rulesJson = try await runAWSCLI(
            command: "configservice describe-compliance-by-config-rule --output json",
            profile: profile,
            region: region
        )
        
        guard let data = rulesJson.data(using: .utf8),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let rules = dict["ComplianceByConfigRules"] as? [[String: Any]] else {
            return []
        }
        
        return rules.compactMap { rule in
            guard let name = rule["ConfigRuleName"] as? String,
                  let compliance = rule["Compliance"] as? [String: Any],
                  let complianceType = compliance["ComplianceType"] as? String else {
                return nil
            }
            
            return ConfigRuleStatus(
                ruleName: name,
                complianceType: complianceType,
                lastEvaluated: nil,
                annotation: nil,
                resourceCount: 0
            )
        }
    }
    
    // MARK: - Access Analyzer
    
    private func getAccessAnalyzerFindings(profile: String?, region: String) async throws -> [AccessAnalyzerFinding] {
        // List analyzers first
        let analyzersJson = try await runAWSCLI(
            command: "accessanalyzer list-analyzers --output json",
            profile: profile,
            region: region
        )
        
        guard let aData = analyzersJson.data(using: .utf8),
              let aDict = try? JSONSerialization.jsonObject(with: aData) as? [String: Any],
              let analyzers = aDict["analyzers"] as? [[String: Any]],
              let analyzerArn = analyzers.first?["arn"] as? String else {
            return []
        }
        
        // Get findings
        let findingsJson = try await runAWSCLI(
            command: "accessanalyzer list-findings --analyzer-arn \(analyzerArn) --filter '{\"status\": {\"eq\": [\"ACTIVE\"]}}' --output json",
            profile: profile,
            region: region
        )
        
        guard let fData = findingsJson.data(using: .utf8),
              let fDict = try? JSONSerialization.jsonObject(with: fData) as? [String: Any],
              let findings = fDict["findings"] as? [[String: Any]] else {
            return []
        }
        
        return findings.compactMap { f in
            guard let id = f["id"] as? String,
                  let resource = f["resource"] as? String,
                  let resourceType = f["resourceType"] as? String else {
                return nil
            }
            
            return AccessAnalyzerFinding(
                id: id,
                resource: resource,
                resourceType: resourceType,
                principal: (f["principal"] as? [String: String])?.values.first ?? "unknown",
                condition: "",
                action: f["action"] as? [String] ?? [],
                status: f["status"] as? String ?? "ACTIVE",
                createdAt: Date(),
                isPublic: f["isPublic"] as? Bool ?? false
            )
        }
    }
    
    // MARK: - Secrets Manager Inventory
    
    private func inventorySecretsManager(profile: String?, region: String) async throws -> [ManagedSecret] {
        let secretsJson = try await runAWSCLI(
            command: "secretsmanager list-secrets --filters Key=name,Values=radiant --output json",
            profile: profile,
            region: region
        )
        
        guard let data = secretsJson.data(using: .utf8),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let secrets = dict["SecretList"] as? [[String: Any]] else {
            return []
        }
        
        return secrets.compactMap { s in
            guard let name = s["Name"] as? String,
                  let arn = s["ARN"] as? String else { return nil }
            
            let rotationEnabled = s["RotationEnabled"] as? Bool ?? false
            let rotationRules = s["RotationRules"] as? [String: Any]
            let rotationDays = rotationRules?["AutomaticallyAfterDays"] as? Int
            
            var tags: [String: String] = [:]
            if let tagList = s["Tags"] as? [[String: String]] {
                for tag in tagList {
                    if let key = tag["Key"], let value = tag["Value"] {
                        tags[key] = value
                    }
                }
            }
            
            return ManagedSecret(
                name: name,
                arn: arn,
                rotationEnabled: rotationEnabled,
                rotationDays: rotationDays,
                lastRotatedDate: nil,
                nextRotationDate: nil,
                lastAccessedDate: nil,
                versionCount: 0,
                tags: tags
            )
        }
    }
    
    // MARK: - Tenant API Key Audit
    
    private func auditTenantApiKeys(
        baseURL: String?,
        adminToken: String?
    ) async throws -> [TenantApiKeyAudit] {
        guard let baseURL = baseURL, let token = adminToken else {
            return []
        }
        
        guard let url = URL(string: "\(baseURL)/api/admin/api-keys?include_audit=true") else {
            return []
        }
        
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("swift_deployer", forHTTPHeaderField: "X-Source-App")
        request.timeoutInterval = 30
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            return []
        }
        
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let keys = json["keys"] as? [[String: Any]] else {
            return []
        }
        
        let now = Date()
        let isoFormatter = ISO8601DateFormatter()
        
        return keys.compactMap { k in
            guard let keyId = k["id"] as? String,
                  let tenantId = k["tenant_id"] as? String else { return nil }
            
            let isActive = k["is_active"] as? Bool ?? false
            let keyPrefix = k["key_prefix"] as? String ?? ""
            let name = k["name"] as? String ?? "Unnamed"
            let useCount = k["use_count"] as? Int ?? 0
            let allowedIps = k["allowed_ips"] as? [String]
            let allowedOrigins = k["allowed_origins"] as? [String]
            let dormantWarningLevel = k["dormant_warning_level"] as? String
            
            var expiresAt: Date?
            if let expStr = k["expires_at"] as? String { expiresAt = isoFormatter.date(from: expStr) }
            var lastUsedAt: Date?
            if let luStr = k["last_used_at"] as? String { lastUsedAt = isoFormatter.date(from: luStr) }
            
            let dormantDays: Int?
            if let lastUsed = lastUsedAt {
                dormantDays = Calendar.current.dateComponents([.day], from: lastUsed, to: now).day
            } else {
                dormantDays = nil
            }
            
            // Risk assessment
            var recommendations: [String] = []
            let riskLevel: RiskLevel
            
            if !isActive {
                riskLevel = .info
            } else if let exp = expiresAt, exp < now {
                riskLevel = .critical
                recommendations.append("Key has expired. Disable and rotate immediately.")
            } else if (dormantDays ?? 0) >= 60 {
                riskLevel = .critical
                recommendations.append("Key unused for \(dormantDays ?? 0) days. Auto-disable threshold reached.")
            } else if (dormantDays ?? 0) >= 45 {
                riskLevel = .high
                recommendations.append("Key unused for \(dormantDays ?? 0) days. Final warning before auto-disable.")
            } else if (dormantDays ?? 0) >= 30 {
                riskLevel = .medium
                recommendations.append("Key flagged as dormant (\(dormantDays ?? 0) days unused).")
            } else if allowedIps == nil && allowedOrigins == nil && isActive {
                riskLevel = .medium
                recommendations.append("No IP or origin restrictions. Consider adding restrictions per SOC2 CC6.1.")
            } else if let exp = expiresAt, exp.timeIntervalSinceNow < Double(currentSchedule.apiKeyGracePeriodDays * 86400) {
                riskLevel = .medium
                recommendations.append("Key expiring within grace period. Auto-rotation will generate successor.")
            } else {
                riskLevel = .low
            }
            
            return TenantApiKeyAudit(
                keyId: keyId,
                tenantId: tenantId,
                keyPrefix: keyPrefix,
                name: name,
                isActive: isActive,
                expiresAt: expiresAt,
                lastUsedAt: lastUsedAt,
                useCount: useCount,
                dormantDays: dormantDays,
                dormantWarningLevel: dormantWarningLevel,
                allowedIps: allowedIps,
                allowedOrigins: allowedOrigins,
                riskLevel: riskLevel,
                recommendations: recommendations
            )
        }.sorted { $0.riskLevel < $1.riskLevel }
    }
    
    // MARK: - Remediation Actions
    
    /// Rotate an IAM access key
    func rotateIAMKey(userName: String, oldKeyId: String, profile: String?, region: String) async throws -> String {
        // Create new key
        let createJson = try await runAWSCLI(
            command: "iam create-access-key --user-name \(userName) --output json",
            profile: profile,
            region: region
        )
        
        guard let data = createJson.data(using: .utf8),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let accessKey = dict["AccessKey"] as? [String: Any],
              let newKeyId = accessKey["AccessKeyId"] as? String else {
            throw LifecycleError.rotationFailed("Failed to create new access key for \(userName)")
        }
        
        // Deactivate old key
        _ = try await runAWSCLI(
            command: "iam update-access-key --user-name \(userName) --access-key-id \(oldKeyId) --status Inactive",
            profile: profile,
            region: region
        )
        
        await auditLogger.log(
            action: .iamKeyRotated,
            details: "Rotated IAM key for \(userName) from \(oldKeyId) to \(newKeyId)",
            metadata: ["user": userName, "old_key": oldKeyId, "new_key": newKeyId]
        )
        
        return newKeyId
    }
    
    /// Disable a dormant IAM key
    func disableIAMKey(userName: String, keyId: String, profile: String?, region: String) async throws {
        _ = try await runAWSCLI(
            command: "iam update-access-key --user-name \(userName) --access-key-id \(keyId) --status Inactive",
            profile: profile,
            region: region
        )
        
        await auditLogger.log(
            action: .iamKeyDisabled,
            details: "Disabled dormant IAM key \(keyId) for \(userName)",
            metadata: ["user": userName, "key": keyId, "reason": "dormant"]
        )
    }
    
    /// Delete an IAM access key
    func deleteIAMKey(userName: String, keyId: String, profile: String?, region: String) async throws {
        _ = try await runAWSCLI(
            command: "iam delete-access-key --user-name \(userName) --access-key-id \(keyId)",
            profile: profile,
            region: region
        )
        
        await auditLogger.log(
            action: .iamKeyDeleted,
            details: "Deleted IAM key \(keyId) for \(userName)",
            metadata: ["user": userName, "key": keyId]
        )
    }
    
    /// Enable Secrets Manager rotation for a secret
    func enableSecretRotation(
        secretArn: String,
        rotationLambdaArn: String,
        rotationDays: Int,
        profile: String?,
        region: String
    ) async throws {
        _ = try await runAWSCLI(
            command: "secretsmanager rotate-secret --secret-id \(secretArn) --rotation-lambda-arn \(rotationLambdaArn) --rotation-rules AutomaticallyAfterDays=\(rotationDays)",
            profile: profile,
            region: region
        )
        
        await auditLogger.log(
            action: .secretRotationEnabled,
            details: "Enabled rotation for \(secretArn) every \(rotationDays) days",
            metadata: ["secret": secretArn, "interval_days": "\(rotationDays)"]
        )
    }
    
    /// Deploy the CredentialLifecycleStack via CDK
    func deployCredentialLifecycleStack(
        environment: String,
        region: String,
        profile: String?,
        alertEmail: String?,
        progressCallback: @Sendable (String) -> Void
    ) async throws {
        progressCallback("Deploying Credential Lifecycle Stack...")
        
        var contextArgs = "-c environment=\(environment)"
        if let email = alertEmail {
            contextArgs += " -c alertEmail=\(email)"
        }
        
        let profileArg = profile != nil ? "--profile \(profile!)" : ""
        let command = "npx cdk deploy *-credential-lifecycle \(profileArg) \(contextArgs) --require-approval never"
        
        progressCallback("Running: \(command)")
        
        _ = try await runShellCommand(command: command, cwd: "packages/infrastructure")
        
        await auditLogger.log(
            action: .credentialLifecycleStackDeployed,
            details: "Deployed credential lifecycle stack to \(environment) in \(region)",
            metadata: ["environment": environment, "region": region]
        )
        
        progressCallback("Credential Lifecycle Stack deployed successfully.")
    }
    
    // MARK: - Compliance Score Calculation
    
    private func calculateComplianceScores(
        iamAudits: [IAMKeyAudit],
        rootKeyPresent: Bool,
        rootMfaEnabled: Bool,
        usersWithoutMfa: Int,
        configRules: [ConfigRuleStatus],
        analyzerFindings: [AccessAnalyzerFinding],
        managedSecrets: [ManagedSecret],
        tenantKeyAudits: [TenantApiKeyAudit]
    ) -> [ComplianceStandard: ComplianceResult] {
        var results: [ComplianceStandard: ComplianceResult] = [:]
        
        // NIST SP 800-57
        let nistFindings: [String] = iamAudits.filter { $0.ageDays > 365 }.map { "Key \($0.accessKeyId) exceeds 365-day cryptoperiod" }
        let nistScore = max(0, 100 - (nistFindings.count * 20))
        results[.nist80057] = ComplianceResult(
            standard: .nist80057,
            status: nistScore >= 80 ? "PASS" : nistScore >= 50 ? "PARTIAL" : "FAIL",
            score: nistScore,
            findings: nistFindings,
            remediations: nistFindings.isEmpty ? [] : ["Rotate all keys exceeding maximum cryptoperiod immediately"]
        )
        
        // CIS AWS Foundations
        var cisFindings: [String] = []
        if rootKeyPresent { cisFindings.append("CIS 1.4: Root account has active access keys") }
        if !rootMfaEnabled { cisFindings.append("CIS 1.5: Root account MFA not enabled") }
        if usersWithoutMfa > 0 { cisFindings.append("CIS 1.10: \(usersWithoutMfa) users without MFA") }
        let staleKeys = iamAudits.filter { $0.ageDays > 90 }
        if !staleKeys.isEmpty { cisFindings.append("CIS 1.14: \(staleKeys.count) keys older than 90 days") }
        let dormantKeys = iamAudits.filter { ($0.dormantDays ?? 0) > 45 }
        if !dormantKeys.isEmpty { cisFindings.append("CIS 1.12: \(dormantKeys.count) keys unused >45 days") }
        let cisScore = max(0, 100 - (cisFindings.count * 15))
        results[.cisAws] = ComplianceResult(
            standard: .cisAws,
            status: cisScore >= 80 ? "PASS" : cisScore >= 50 ? "PARTIAL" : "FAIL",
            score: cisScore,
            findings: cisFindings,
            remediations: cisFindings.map { "Remediate: \($0)" }
        )
        
        // SOC 2 CC6.1
        var soc2Findings: [String] = []
        let unrestricted = tenantKeyAudits.filter { $0.isActive && $0.allowedIps == nil && $0.allowedOrigins == nil }
        if !unrestricted.isEmpty { soc2Findings.append("\(unrestricted.count) API keys without IP/origin restrictions") }
        let noRotation = managedSecrets.filter { !$0.rotationEnabled }
        if !noRotation.isEmpty { soc2Findings.append("\(noRotation.count) secrets without auto-rotation") }
        let soc2Score = max(0, 100 - (soc2Findings.count * 20))
        results[.soc2] = ComplianceResult(
            standard: .soc2,
            status: soc2Score >= 80 ? "PASS" : soc2Score >= 50 ? "PARTIAL" : "FAIL",
            score: soc2Score,
            findings: soc2Findings,
            remediations: soc2Findings.map { "Address: \($0)" }
        )
        
        // AWS Well-Architected
        var waFindings: [String] = []
        if !analyzerFindings.isEmpty { waFindings.append("\(analyzerFindings.count) Access Analyzer findings") }
        let publicFindings = analyzerFindings.filter { $0.isPublic }
        if !publicFindings.isEmpty { waFindings.append("\(publicFindings.count) resources with public access") }
        let waScore = max(0, 100 - (waFindings.count * 15) - (publicFindings.count * 25))
        results[.awsWellArchitected] = ComplianceResult(
            standard: .awsWellArchitected,
            status: waScore >= 80 ? "PASS" : waScore >= 50 ? "PARTIAL" : "FAIL",
            score: waScore,
            findings: waFindings,
            remediations: waFindings.map { "Investigate: \($0)" }
        )
        
        // PCI DSS
        var pciFindings: [String] = []
        let keysWithoutExpiry = tenantKeyAudits.filter { $0.isActive && $0.expiresAt == nil }
        if !keysWithoutExpiry.isEmpty { pciFindings.append("\(keysWithoutExpiry.count) keys without expiry (Req 3.6.4)") }
        let pciScore = max(0, 100 - (pciFindings.count * 25))
        results[.pciDss] = ComplianceResult(
            standard: .pciDss,
            status: pciScore >= 80 ? "PASS" : pciScore >= 50 ? "PARTIAL" : "FAIL",
            score: pciScore,
            findings: pciFindings,
            remediations: pciFindings.isEmpty ? [] : ["Ensure all keys have mandatory expiry dates"]
        )
        
        // ISO 27001
        var isoFindings: [String] = []
        if usersWithoutMfa > 0 { isoFindings.append("A.9.4.2: \(usersWithoutMfa) users without multi-factor authentication") }
        let isoScore = max(0, 100 - (isoFindings.count * 20))
        results[.iso27001] = ComplianceResult(
            standard: .iso27001,
            status: isoScore >= 80 ? "PASS" : isoScore >= 50 ? "PARTIAL" : "FAIL",
            score: isoScore,
            findings: isoFindings,
            remediations: isoFindings.map { "Remediate: \($0)" }
        )
        
        return results
    }
    
    // MARK: - AWS CLI Execution
    
    private func runAWSCLI(command: String, profile: String?, region: String) async throws -> String {
        let profileArg = profile != nil ? "--profile \(profile!) " : ""
        let fullCommand = "aws \(profileArg)--region \(region) \(command)"
        return try await runShellCommand(command: fullCommand)
    }
    
    private func runShellCommand(command: String, cwd: String? = nil) async throws -> String {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/zsh")
        process.arguments = ["-c", command]
        
        if let cwd = cwd {
            process.currentDirectoryURL = URL(fileURLWithPath: cwd)
        }
        
        let pipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = pipe
        process.standardError = errorPipe
        
        try process.run()
        process.waitUntilExit()
        
        let outputData = pipe.fileHandleForReading.readDataToEndOfFile()
        let output = String(data: outputData, encoding: .utf8) ?? ""
        
        if process.terminationStatus != 0 {
            let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
            let errorOutput = String(data: errorData, encoding: .utf8) ?? ""
            throw LifecycleError.awsCommandFailed("\(errorOutput)\n\(output)")
        }
        
        return output
    }
}
