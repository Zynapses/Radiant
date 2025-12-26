// RADIANT v4.18.0 - DNS Service
// Manages Route53, ACM, and SES DNS operations

import Foundation

actor DNSService {
    
    private let auditLogger = AuditLogger.shared
    
    enum DNSError: Error, LocalizedError {
        case route53Error(String)
        case acmError(String)
        case sesError(String)
        case domainNotFound
        case verificationFailed(String)
        
        var errorDescription: String? {
            switch self {
            case .route53Error(let msg): return "Route53 error: \(msg)"
            case .acmError(let msg): return "ACM error: \(msg)"
            case .sesError(let msg): return "SES error: \(msg)"
            case .domainNotFound: return "Domain not found"
            case .verificationFailed(let msg): return "Verification failed: \(msg)"
            }
        }
    }
    
    // MARK: - Route53 Operations
    
    /// List hosted zones
    func listHostedZones() async throws -> [HostedZone] {
        let output = try await runAWSCommand([
            "route53", "list-hosted-zones",
            "--output", "json"
        ])
        
        guard let data = output.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let zones = json["HostedZones"] as? [[String: Any]] else {
            return []
        }
        
        return zones.compactMap { zone in
            guard let id = zone["Id"] as? String,
                  let name = zone["Name"] as? String else { return nil }
            
            return HostedZone(
                id: id.replacingOccurrences(of: "/hostedzone/", with: ""),
                name: name.hasSuffix(".") ? String(name.dropLast()) : name,
                recordCount: zone["ResourceRecordSetCount"] as? Int ?? 0,
                isPrivate: (zone["Config"] as? [String: Any])?["PrivateZone"] as? Bool ?? false
            )
        }
    }
    
    /// Get DNS records for a hosted zone
    func getRecordSets(hostedZoneId: String) async throws -> [DNSRecord] {
        let output = try await runAWSCommand([
            "route53", "list-resource-record-sets",
            "--hosted-zone-id", hostedZoneId,
            "--output", "json"
        ])
        
        guard let data = output.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let recordSets = json["ResourceRecordSets"] as? [[String: Any]] else {
            return []
        }
        
        return recordSets.compactMap { record in
            guard let name = record["Name"] as? String,
                  let typeStr = record["Type"] as? String,
                  let type = DNSRecord.RecordType(rawValue: typeStr) else { return nil }
            
            let ttl = record["TTL"] as? Int ?? 300
            
            var value = ""
            if let resourceRecords = record["ResourceRecords"] as? [[String: Any]] {
                value = resourceRecords.compactMap { $0["Value"] as? String }.joined(separator: ", ")
            } else if let alias = record["AliasTarget"] as? [String: Any] {
                value = alias["DNSName"] as? String ?? ""
            }
            
            return DNSRecord(
                id: "\(name)-\(typeStr)",
                type: type,
                name: name.hasSuffix(".") ? String(name.dropLast()) : name,
                value: value,
                ttl: ttl,
                purpose: "Existing Record",
                isRequired: false,
                status: .verified
            )
        }
    }
    
    /// Create or update a DNS record
    func upsertRecord(
        hostedZoneId: String,
        record: DNSRecord
    ) async throws {
        let changeBatch: [String: Any] = [
            "Changes": [[
                "Action": "UPSERT",
                "ResourceRecordSet": [
                    "Name": record.name,
                    "Type": record.type.rawValue,
                    "TTL": record.ttl,
                    "ResourceRecords": [
                        ["Value": record.value]
                    ]
                ]
            ]]
        ]
        
        let jsonData = try JSONSerialization.data(withJSONObject: changeBatch)
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "{}"
        
        _ = try await runAWSCommand([
            "route53", "change-resource-record-sets",
            "--hosted-zone-id", hostedZoneId,
            "--change-batch", jsonString
        ])
    }
    
    // MARK: - ACM Certificate Operations
    
    /// Request a new SSL certificate
    func requestCertificate(
        domain: String,
        subjectAlternativeNames: [String]
    ) async throws -> CertificateRequest {
        var args = [
            "acm", "request-certificate",
            "--domain-name", domain,
            "--validation-method", "DNS",
            "--output", "json"
        ]
        
        if !subjectAlternativeNames.isEmpty {
            args.append(contentsOf: ["--subject-alternative-names"] + subjectAlternativeNames)
        }
        
        let output = try await runAWSCommand(args)
        
        guard let data = output.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let arn = json["CertificateArn"] as? String else {
            throw DNSError.acmError("Failed to request certificate")
        }
        
        // Audit log for compliance (SOC2, GDPR)
        await auditLogger.log(
            action: .certificateRequested,
            details: "SSL certificate requested for domain: \(domain)",
            metadata: ["domain": domain, "arn": arn]
        )
        
        // Wait a moment for validation records to be generated
        try await Task.sleep(nanoseconds: 2_000_000_000)
        
        // Get validation records
        let validationRecords = try await getCertificateValidationRecords(certificateArn: arn)
        
        return CertificateRequest(
            arn: arn,
            domain: domain,
            validationRecords: validationRecords
        )
    }
    
    /// Get certificate validation DNS records
    func getCertificateValidationRecords(certificateArn: String) async throws -> [DNSRecord] {
        let output = try await runAWSCommand([
            "acm", "describe-certificate",
            "--certificate-arn", certificateArn,
            "--output", "json"
        ])
        
        guard let data = output.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let certificate = json["Certificate"] as? [String: Any],
              let domainValidations = certificate["DomainValidationOptions"] as? [[String: Any]] else {
            return []
        }
        
        return domainValidations.compactMap { validation -> DNSRecord? in
            guard let resourceRecord = validation["ResourceRecord"] as? [String: Any],
                  let name = resourceRecord["Name"] as? String,
                  let value = resourceRecord["Value"] as? String else { return nil }
            
            let status: DNSRecord.VerificationStatus
            if let validationStatus = validation["ValidationStatus"] as? String {
                status = validationStatus == "SUCCESS" ? .verified : .pending
            } else {
                status = .pending
            }
            
            return DNSRecord(
                id: "acm-\(name)",
                type: .CNAME,
                name: name,
                value: value,
                ttl: 300,
                purpose: "ACM Certificate Validation",
                isRequired: true,
                status: status
            )
        }
    }
    
    /// Get certificate status
    func getCertificateStatus(certificateArn: String) async throws -> String {
        let output = try await runAWSCommand([
            "acm", "describe-certificate",
            "--certificate-arn", certificateArn,
            "--query", "Certificate.Status",
            "--output", "text"
        ])
        
        return output.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    
    // MARK: - SES Email Operations
    
    /// Verify a domain for SES
    func verifyDomainIdentity(domain: String) async throws -> SESRecords {
        // Start domain verification
        let verifyOutput = try await runAWSCommand([
            "ses", "verify-domain-identity",
            "--domain", domain,
            "--output", "json"
        ])
        
        var verificationToken: String?
        if let data = verifyOutput.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            verificationToken = json["VerificationToken"] as? String
        }
        
        // Get DKIM tokens
        let dkimOutput = try await runAWSCommand([
            "ses", "verify-domain-dkim",
            "--domain", domain,
            "--output", "json"
        ])
        
        var dkimTokens: [String] = []
        if let data = dkimOutput.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let tokens = json["DkimTokens"] as? [String] {
            dkimTokens = tokens
        }
        
        // Audit log for compliance (SOC2, GDPR)
        await auditLogger.log(
            action: .emailDomainVerified,
            details: "SES domain verification initiated for: \(domain)",
            metadata: ["domain": domain, "dkimTokenCount": String(dkimTokens.count)]
        )
        
        return SESRecords(
            verificationToken: verificationToken,
            dkimTokens: dkimTokens,
            mailFromMX: Configuration.sesMailFromMX(),
            mailFromSPF: Configuration.sesSPFRecord
        )
    }
    
    /// Check domain verification status
    func getDomainVerificationStatus(domain: String) async throws -> EmailConfiguration.VerificationStatus {
        let output = try await runAWSCommand([
            "ses", "get-identity-verification-attributes",
            "--identities", domain,
            "--output", "json"
        ])
        
        guard let data = output.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let attrs = json["VerificationAttributes"] as? [String: Any],
              let domainAttrs = attrs[domain] as? [String: Any],
              let status = domainAttrs["VerificationStatus"] as? String else {
            return .pending
        }
        
        switch status {
        case "Success": return .verified
        case "Pending": return .pending
        case "Failed": return .failed
        case "TemporaryFailure": return .temporaryFailure
        default: return .pending
        }
    }
    
    /// Check DKIM status
    func getDKIMStatus(domain: String) async throws -> EmailConfiguration.DKIMStatus {
        let output = try await runAWSCommand([
            "ses", "get-identity-dkim-attributes",
            "--identities", domain,
            "--output", "json"
        ])
        
        guard let data = output.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let attrs = json["DkimAttributes"] as? [String: Any],
              let domainAttrs = attrs[domain] as? [String: Any],
              let status = domainAttrs["DkimVerificationStatus"] as? String else {
            return .notStarted
        }
        
        switch status {
        case "Success": return .success
        case "Pending": return .pending
        case "Failed": return .failed
        case "TemporaryFailure": return .temporaryFailure
        default: return .notStarted
        }
    }
    
    // MARK: - Generate Required DNS Records
    
    /// Generate all required DNS records for a RADIANT deployment
    func generateRequiredRecords(
        domain: String,
        appId: String,
        environment: DeployEnvironment,
        cloudFrontDomain: String?,
        albDomain: String?,
        apiGatewayDomain: String?
    ) -> [DNSRecord] {
        var records: [DNSRecord] = []
        let envPrefix = environment == .prod ? "" : "\(environment.shortName.lowercased())."
        
        // Main app domain (CloudFront)
        if let cf = cloudFrontDomain {
            records.append(DNSRecord(
                id: "app-\(envPrefix)\(domain)",
                type: .CNAME,
                name: "\(envPrefix)\(domain)",
                value: cf,
                ttl: 300,
                purpose: "Main Application (CloudFront)",
                isRequired: true,
                status: .pending
            ))
        }
        
        // API subdomain (API Gateway or ALB)
        if let api = apiGatewayDomain ?? albDomain {
            records.append(DNSRecord(
                id: "api-\(envPrefix)\(domain)",
                type: .CNAME,
                name: "api.\(envPrefix)\(domain)",
                value: api,
                ttl: 300,
                purpose: "API Endpoint",
                isRequired: true,
                status: .pending
            ))
        }
        
        // Admin dashboard
        if let cf = cloudFrontDomain {
            records.append(DNSRecord(
                id: "admin-\(envPrefix)\(domain)",
                type: .CNAME,
                name: "admin.\(envPrefix)\(domain)",
                value: cf,
                ttl: 300,
                purpose: "Admin Dashboard",
                isRequired: false,
                status: .pending
            ))
        }
        
        // WebSocket endpoint (if using ALB)
        if let alb = albDomain {
            records.append(DNSRecord(
                id: "ws-\(envPrefix)\(domain)",
                type: .CNAME,
                name: "ws.\(envPrefix)\(domain)",
                value: alb,
                ttl: 300,
                purpose: "WebSocket Endpoint",
                isRequired: false,
                status: .pending
            ))
        }
        
        return records
    }
    
    // MARK: - Helper
    
    private func runAWSCommand(_ arguments: [String]) async throws -> String {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/local/bin/aws")
        process.arguments = arguments
        
        let outputPipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = errorPipe
        
        try process.run()
        process.waitUntilExit()
        
        let outputData = outputPipe.fileHandleForReading.readDataToEndOfFile()
        let output = String(data: outputData, encoding: .utf8) ?? ""
        
        if process.terminationStatus != 0 {
            let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
            let error = String(data: errorData, encoding: .utf8) ?? "Unknown error"
            throw DNSError.route53Error(error)
        }
        
        return output
    }
}

// MARK: - Supporting Types

struct HostedZone: Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let recordCount: Int
    let isPrivate: Bool
}

struct CertificateRequest: Sendable {
    let arn: String
    let domain: String
    let validationRecords: [DNSRecord]
}

// MARK: - Singleton

extension DNSService {
    static let shared = DNSService()
}
