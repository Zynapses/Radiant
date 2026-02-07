// RADIANT v7.2.0 - Security Scanner Service
// IAM policies, security groups, and dependency auditing

import Foundation

actor SecurityScannerService {
    static let shared = SecurityScannerService()
    
    enum ScanError: LocalizedError {
        case awsError(String)
        case scanFailed(String)
        
        var errorDescription: String? {
            switch self {
            case .awsError(let msg): return "AWS Error: \(msg)"
            case .scanFailed(let msg): return "Scan failed: \(msg)"
            }
        }
    }
    
    enum Severity: String, CaseIterable, Comparable, Sendable {
        case critical = "Critical"
        case high = "High"
        case medium = "Medium"
        case low = "Low"
        case info = "Info"
        
        var color: String {
            switch self {
            case .critical: return "red"
            case .high: return "orange"
            case .medium: return "yellow"
            case .low: return "blue"
            case .info: return "gray"
            }
        }
        
        var icon: String {
            switch self {
            case .critical: return "exclamationmark.octagon.fill"
            case .high: return "exclamationmark.triangle.fill"
            case .medium: return "exclamationmark.circle.fill"
            case .low: return "info.circle.fill"
            case .info: return "info.circle"
            }
        }
        
        static func < (lhs: Severity, rhs: Severity) -> Bool {
            let order: [Severity] = [.critical, .high, .medium, .low, .info]
            return order.firstIndex(of: lhs)! < order.firstIndex(of: rhs)!
        }
    }
    
    enum ScanCategory: String, CaseIterable, Sendable {
        case iam = "IAM Policies"
        case securityGroups = "Security Groups"
        case encryption = "Encryption"
        case publicAccess = "Public Access"
        case logging = "Logging"
        case secrets = "Secrets"
        
        var icon: String {
            switch self {
            case .iam: return "person.badge.key"
            case .securityGroups: return "network.badge.shield.half.filled"
            case .encryption: return "lock.shield"
            case .publicAccess: return "globe"
            case .logging: return "doc.text.magnifyingglass"
            case .secrets: return "key"
            }
        }
    }
    
    struct Finding: Identifiable, Sendable {
        let id = UUID()
        let category: ScanCategory
        let severity: Severity
        let resource: String
        let resourceType: String
        let title: String
        let description: String
        let recommendation: String
        let affectedItems: [String]
    }
    
    struct ScanResult: Sendable {
        let scanId: String
        let timestamp: Date
        let duration: TimeInterval
        let findings: [Finding]
        let resourcesScanned: Int
        let complianceScore: Double
        
        var criticalCount: Int { findings.filter { $0.severity == .critical }.count }
        var highCount: Int { findings.filter { $0.severity == .high }.count }
        var mediumCount: Int { findings.filter { $0.severity == .medium }.count }
        var lowCount: Int { findings.filter { $0.severity == .low }.count }
    }
    
    func runFullScan(environment: String, region: String, onProgress: @escaping @Sendable (String) -> Void) async throws -> ScanResult {
        let startTime = Date()
        var allFindings: [Finding] = []
        var resourcesScanned = 0
        
        onProgress("Scanning IAM policies...")
        let (iamFindings, iamCount) = try await scanIAMPolicies(environment: environment, region: region)
        allFindings.append(contentsOf: iamFindings)
        resourcesScanned += iamCount
        
        onProgress("Scanning security groups...")
        let (sgFindings, sgCount) = try await scanSecurityGroups(environment: environment, region: region)
        allFindings.append(contentsOf: sgFindings)
        resourcesScanned += sgCount
        
        onProgress("Scanning encryption settings...")
        let (encFindings, encCount) = try await scanEncryption(environment: environment, region: region)
        allFindings.append(contentsOf: encFindings)
        resourcesScanned += encCount
        
        onProgress("Scanning public access...")
        let (pubFindings, pubCount) = try await scanPublicAccess(environment: environment, region: region)
        allFindings.append(contentsOf: pubFindings)
        resourcesScanned += pubCount
        
        onProgress("Scanning logging configuration...")
        let (logFindings, logCount) = try await scanLogging(environment: environment, region: region)
        allFindings.append(contentsOf: logFindings)
        resourcesScanned += logCount
        
        onProgress("Scan complete")
        
        let score = calculateComplianceScore(findings: allFindings, resourcesScanned: resourcesScanned)
        
        return ScanResult(
            scanId: UUID().uuidString,
            timestamp: Date(),
            duration: Date().timeIntervalSince(startTime),
            findings: allFindings.sorted { $0.severity < $1.severity },
            resourcesScanned: resourcesScanned,
            complianceScore: score
        )
    }
    
    // MARK: - IAM Scanning
    
    private func scanIAMPolicies(environment: String, region: String) async throws -> ([Finding], Int) {
        var findings: [Finding] = []
        var count = 0
        
        let rolesCommand = "aws iam list-roles --output json"
        let rolesOutput = try await executeCommand(rolesCommand)
        
        guard let json = try? JSONSerialization.jsonObject(with: rolesOutput) as? [String: Any],
              let roles = json["Roles"] as? [[String: Any]] else {
            return ([], 0)
        }
        
        let envRoles = roles.filter { ($0["RoleName"] as? String)?.contains(environment) == true }
        count = envRoles.count
        
        for role in envRoles {
            guard let roleName = role["RoleName"] as? String else { continue }
            
            let policiesCommand = "aws iam list-attached-role-policies --role-name \"\(roleName)\" --output json"
            if let policiesOutput = try? await executeCommand(policiesCommand),
               let policiesJson = try? JSONSerialization.jsonObject(with: policiesOutput) as? [String: Any],
               let policies = policiesJson["AttachedPolicies"] as? [[String: Any]] {
                
                for policy in policies {
                    let policyArn = policy["PolicyArn"] as? String ?? ""
                    
                    if policyArn.contains("AdministratorAccess") {
                        findings.append(Finding(
                            category: .iam,
                            severity: .critical,
                            resource: roleName,
                            resourceType: "IAM Role",
                            title: "Administrator Access Attached",
                            description: "Role has full administrator access which violates least privilege principle",
                            recommendation: "Create a custom policy with only required permissions",
                            affectedItems: [policyArn]
                        ))
                    }
                    
                    if policyArn.contains("*") {
                        findings.append(Finding(
                            category: .iam,
                            severity: .high,
                            resource: roleName,
                            resourceType: "IAM Role",
                            title: "Wildcard Policy Attached",
                            description: "Policy may grant overly broad permissions",
                            recommendation: "Review and restrict policy permissions",
                            affectedItems: [policyArn]
                        ))
                    }
                }
            }
        }
        
        return (findings, count)
    }
    
    // MARK: - Security Groups Scanning
    
    private func scanSecurityGroups(environment: String, region: String) async throws -> ([Finding], Int) {
        var findings: [Finding] = []
        
        let command = "aws ec2 describe-security-groups --region \(region) --output json"
        let output = try await executeCommand(command)
        
        guard let json = try? JSONSerialization.jsonObject(with: output) as? [String: Any],
              let groups = json["SecurityGroups"] as? [[String: Any]] else {
            return ([], 0)
        }
        
        let envGroups = groups.filter { ($0["GroupName"] as? String)?.contains(environment) == true || ($0["Description"] as? String)?.contains(environment) == true }
        
        for group in envGroups {
            let groupId = group["GroupId"] as? String ?? ""
            let groupName = group["GroupName"] as? String ?? ""
            
            if let ingressRules = group["IpPermissions"] as? [[String: Any]] {
                for rule in ingressRules {
                    let ipRanges = rule["IpRanges"] as? [[String: Any]] ?? []
                    let fromPort = rule["FromPort"] as? Int ?? 0
                    let toPort = rule["ToPort"] as? Int ?? 0
                    
                    for range in ipRanges {
                        let cidr = range["CidrIp"] as? String ?? ""
                        
                        if cidr == "0.0.0.0/0" {
                            let severity: Severity = (fromPort == 22 || fromPort == 3389) ? .critical : .high
                            findings.append(Finding(
                                category: .securityGroups,
                                severity: severity,
                                resource: groupName,
                                resourceType: "Security Group",
                                title: "Open to Internet (0.0.0.0/0)",
                                description: "Port \(fromPort)-\(toPort) is open to all internet traffic",
                                recommendation: "Restrict access to specific IP ranges or use VPN",
                                affectedItems: [groupId, "Port: \(fromPort)-\(toPort)"]
                            ))
                        }
                    }
                }
            }
        }
        
        return (findings, envGroups.count)
    }
    
    // MARK: - Encryption Scanning
    
    private func scanEncryption(environment: String, region: String) async throws -> ([Finding], Int) {
        var findings: [Finding] = []
        var count = 0
        
        // Check S3 bucket encryption
        let s3Command = "aws s3api list-buckets --output json"
        if let s3Output = try? await executeCommand(s3Command),
           let s3Json = try? JSONSerialization.jsonObject(with: s3Output) as? [String: Any],
           let buckets = s3Json["Buckets"] as? [[String: Any]] {
            
            let envBuckets = buckets.filter { ($0["Name"] as? String)?.contains(environment) == true }
            count += envBuckets.count
            
            for bucket in envBuckets {
                let bucketName = bucket["Name"] as? String ?? ""
                let encCommand = "aws s3api get-bucket-encryption --bucket \"\(bucketName)\" --region \(region) --output json 2>/dev/null"
                
                if (try? await executeCommand(encCommand)) == nil {
                    findings.append(Finding(
                        category: .encryption,
                        severity: .high,
                        resource: bucketName,
                        resourceType: "S3 Bucket",
                        title: "No Default Encryption",
                        description: "S3 bucket does not have default encryption enabled",
                        recommendation: "Enable SSE-S3 or SSE-KMS encryption",
                        affectedItems: [bucketName]
                    ))
                }
            }
        }
        
        // Check RDS encryption
        let rdsCommand = "aws rds describe-db-clusters --region \(region) --output json"
        if let rdsOutput = try? await executeCommand(rdsCommand),
           let rdsJson = try? JSONSerialization.jsonObject(with: rdsOutput) as? [String: Any],
           let clusters = rdsJson["DBClusters"] as? [[String: Any]] {
            
            let envClusters = clusters.filter { ($0["DBClusterIdentifier"] as? String)?.contains(environment) == true }
            count += envClusters.count
            
            for cluster in envClusters {
                let clusterId = cluster["DBClusterIdentifier"] as? String ?? ""
                let encrypted = cluster["StorageEncrypted"] as? Bool ?? false
                
                if !encrypted {
                    findings.append(Finding(
                        category: .encryption,
                        severity: .critical,
                        resource: clusterId,
                        resourceType: "RDS Cluster",
                        title: "Storage Not Encrypted",
                        description: "RDS cluster storage is not encrypted at rest",
                        recommendation: "Enable storage encryption (requires cluster recreation)",
                        affectedItems: [clusterId]
                    ))
                }
            }
        }
        
        return (findings, count)
    }
    
    // MARK: - Public Access Scanning
    
    private func scanPublicAccess(environment: String, region: String) async throws -> ([Finding], Int) {
        var findings: [Finding] = []
        var count = 0
        
        // Check S3 public access
        let s3Command = "aws s3api list-buckets --output json"
        if let s3Output = try? await executeCommand(s3Command),
           let s3Json = try? JSONSerialization.jsonObject(with: s3Output) as? [String: Any],
           let buckets = s3Json["Buckets"] as? [[String: Any]] {
            
            let envBuckets = buckets.filter { ($0["Name"] as? String)?.contains(environment) == true }
            count += envBuckets.count
            
            for bucket in envBuckets {
                let bucketName = bucket["Name"] as? String ?? ""
                let publicCommand = "aws s3api get-public-access-block --bucket \"\(bucketName)\" --region \(region) --output json 2>/dev/null"
                
                if let publicOutput = try? await executeCommand(publicCommand),
                   let publicJson = try? JSONSerialization.jsonObject(with: publicOutput) as? [String: Any],
                   let config = publicJson["PublicAccessBlockConfiguration"] as? [String: Any] {
                    
                    let blockPublicAcls = config["BlockPublicAcls"] as? Bool ?? false
                    let blockPublicPolicy = config["BlockPublicPolicy"] as? Bool ?? false
                    
                    if !blockPublicAcls || !blockPublicPolicy {
                        findings.append(Finding(
                            category: .publicAccess,
                            severity: .high,
                            resource: bucketName,
                            resourceType: "S3 Bucket",
                            title: "Public Access Not Fully Blocked",
                            description: "Bucket public access block is not fully configured",
                            recommendation: "Enable all public access block settings",
                            affectedItems: [bucketName]
                        ))
                    }
                }
            }
        }
        
        return (findings, count)
    }
    
    // MARK: - Logging Scanning
    
    private func scanLogging(environment: String, region: String) async throws -> ([Finding], Int) {
        var findings: [Finding] = []
        var count = 0
        
        // Check CloudTrail
        let trailCommand = "aws cloudtrail describe-trails --region \(region) --output json"
        if let trailOutput = try? await executeCommand(trailCommand),
           let trailJson = try? JSONSerialization.jsonObject(with: trailOutput) as? [String: Any],
           let trails = trailJson["trailList"] as? [[String: Any]] {
            
            count += 1
            
            if trails.isEmpty {
                findings.append(Finding(
                    category: .logging,
                    severity: .critical,
                    resource: "CloudTrail",
                    resourceType: "AWS Service",
                    title: "No CloudTrail Configured",
                    description: "No CloudTrail trails are configured for API logging",
                    recommendation: "Create a multi-region CloudTrail trail",
                    affectedItems: ["Account"]
                ))
            } else {
                for trail in trails {
                    let trailName = trail["Name"] as? String ?? ""
                    let isMultiRegion = trail["IsMultiRegionTrail"] as? Bool ?? false
                    let logValidation = trail["LogFileValidationEnabled"] as? Bool ?? false
                    
                    if !isMultiRegion {
                        findings.append(Finding(
                            category: .logging,
                            severity: .medium,
                            resource: trailName,
                            resourceType: "CloudTrail",
                            title: "Single Region Trail",
                            description: "Trail only captures events from one region",
                            recommendation: "Enable multi-region trail for complete coverage",
                            affectedItems: [trailName]
                        ))
                    }
                    
                    if !logValidation {
                        findings.append(Finding(
                            category: .logging,
                            severity: .medium,
                            resource: trailName,
                            resourceType: "CloudTrail",
                            title: "Log Validation Disabled",
                            description: "Log file integrity validation is not enabled",
                            recommendation: "Enable log file validation for tamper detection",
                            affectedItems: [trailName]
                        ))
                    }
                }
            }
        }
        
        return (findings, count)
    }
    
    private func calculateComplianceScore(findings: [Finding], resourcesScanned: Int) -> Double {
        guard resourcesScanned > 0 else { return 100.0 }
        
        var deductions: Double = 0
        for finding in findings {
            switch finding.severity {
            case .critical: deductions += 15
            case .high: deductions += 10
            case .medium: deductions += 5
            case .low: deductions += 2
            case .info: deductions += 0
            }
        }
        
        return max(0, 100 - deductions)
    }
    
    private func executeCommand(_ command: String) async throws -> Data {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/zsh")
        process.arguments = ["-c", command]
        
        let outputPipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = errorPipe
        
        try process.run()
        process.waitUntilExit()
        
        let outputData = outputPipe.fileHandleForReading.readDataToEndOfFile()
        
        guard process.terminationStatus == 0 else {
            let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
            let errorString = String(data: errorData, encoding: .utf8) ?? "Unknown error"
            throw ScanError.awsError(errorString)
        }
        
        return outputData
    }
}
