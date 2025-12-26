// RADIANT v4.18.0 - Domain Configuration Models
// Models for domain and email setup with DNS records

import Foundation

// MARK: - Domain Configuration

struct DomainConfiguration: Identifiable, Codable, Sendable {
    let id: String
    var appId: String
    var environment: DeployEnvironment
    var baseDomain: String
    var subdomains: [SubdomainConfig]
    var certificateArn: String?
    var hostedZoneId: String?
    var isVerified: Bool
    var createdAt: Date
    var updatedAt: Date
    
    struct SubdomainConfig: Codable, Sendable, Identifiable {
        var id: String { name }
        var name: String           // e.g., "api", "app", "admin"
        var targetType: TargetType
        var targetValue: String    // CloudFront distribution, ALB DNS, etc.
        
        enum TargetType: String, Codable, Sendable {
            case cloudfront = "CloudFront"
            case alb = "ALB"
            case apiGateway = "API Gateway"
            case s3 = "S3"
        }
    }
}

// MARK: - DNS Record

struct DNSRecord: Identifiable, Codable, Sendable {
    let id: String
    var type: RecordType
    var name: String
    var value: String
    var ttl: Int
    var purpose: String
    var isRequired: Bool
    var status: VerificationStatus
    
    enum RecordType: String, Codable, Sendable, CaseIterable {
        case A = "A"
        case AAAA = "AAAA"
        case CNAME = "CNAME"
        case MX = "MX"
        case TXT = "TXT"
        case NS = "NS"
        case SOA = "SOA"
    }
    
    enum VerificationStatus: String, Codable, Sendable {
        case pending = "Pending"
        case verified = "Verified"
        case failed = "Failed"
    }
    
    var copyableValue: String {
        // Format value for easy copying to DNS provider
        switch type {
        case .TXT:
            return "\"\(value)\""
        case .MX:
            return value
        default:
            return value
        }
    }
}

// MARK: - Email Configuration

struct EmailConfiguration: Identifiable, Codable, Sendable {
    let id: String
    var appId: String
    var environment: DeployEnvironment
    var domain: String
    var identityType: IdentityType
    var verificationStatus: VerificationStatus
    var dkimStatus: DKIMStatus
    var mailFromDomain: String?
    var mailFromStatus: VerificationStatus?
    var sendingEnabled: Bool
    var createdAt: Date
    var updatedAt: Date
    
    enum IdentityType: String, Codable, Sendable {
        case domain = "Domain"
        case email = "Email Address"
    }
    
    enum VerificationStatus: String, Codable, Sendable {
        case pending = "Pending"
        case verified = "Verified"
        case failed = "Failed"
        case temporaryFailure = "Temporary Failure"
    }
    
    enum DKIMStatus: String, Codable, Sendable {
        case pending = "Pending"
        case success = "Success"
        case failed = "Failed"
        case temporaryFailure = "Temporary Failure"
        case notStarted = "Not Started"
    }
}

// MARK: - SES DNS Records

struct SESRecords: Sendable {
    var verificationToken: String?
    var dkimTokens: [String]
    var mailFromMX: String?
    var mailFromSPF: String?
    
    func toDNSRecords(domain: String, mailFromDomain: String?) -> [DNSRecord] {
        var records: [DNSRecord] = []
        
        // Domain verification TXT record
        if let token = verificationToken {
            records.append(DNSRecord(
                id: "ses-verification",
                type: .TXT,
                name: "_amazonses.\(domain)",
                value: token,
                ttl: 1800,
                purpose: "SES Domain Verification",
                isRequired: true,
                status: .pending
            ))
        }
        
        // DKIM CNAME records
        for (index, token) in dkimTokens.enumerated() {
            records.append(DNSRecord(
                id: "dkim-\(index + 1)",
                type: .CNAME,
                name: "\(token)._domainkey.\(domain)",
                value: "\(token).dkim.amazonses.com",
                ttl: 1800,
                purpose: "DKIM Signature \(index + 1)",
                isRequired: true,
                status: .pending
            ))
        }
        
        // Mail FROM records (if custom MAIL FROM domain)
        if let mailFrom = mailFromDomain {
            if let mx = mailFromMX {
                records.append(DNSRecord(
                    id: "mailfrom-mx",
                    type: .MX,
                    name: mailFrom,
                    value: mx,
                    ttl: 1800,
                    purpose: "Custom MAIL FROM MX",
                    isRequired: false,
                    status: .pending
                ))
            }
            
            if let spf = mailFromSPF {
                records.append(DNSRecord(
                    id: "mailfrom-spf",
                    type: .TXT,
                    name: mailFrom,
                    value: spf,
                    ttl: 1800,
                    purpose: "Custom MAIL FROM SPF",
                    isRequired: false,
                    status: .pending
                ))
            }
        }
        
        return records
    }
}

// MARK: - Certificate DNS Records

struct CertificateRecords: Sendable {
    var validationRecords: [(name: String, value: String)]
    
    func toDNSRecords() -> [DNSRecord] {
        return validationRecords.enumerated().map { index, record in
            DNSRecord(
                id: "acm-validation-\(index + 1)",
                type: .CNAME,
                name: record.name,
                value: record.value,
                ttl: 300,
                purpose: "ACM Certificate Validation",
                isRequired: true,
                status: .pending
            )
        }
    }
}

// MARK: - Domain Setup Summary

struct DomainSetupSummary: Sendable {
    var baseDomain: String
    var subdomains: [String]
    var dnsRecords: [DNSRecord]
    var certificateStatus: CertificateStatus
    var domainVerified: Bool
    var emailVerified: Bool
    
    enum CertificateStatus: String, Sendable {
        case pending = "Pending Validation"
        case issued = "Issued"
        case failed = "Failed"
        case expired = "Expired"
        case notRequested = "Not Requested"
    }
    
    var allRecordsVerified: Bool {
        dnsRecords.allSatisfy { $0.status == .verified }
    }
    
    var pendingRecordsCount: Int {
        dnsRecords.filter { $0.status == .pending }.count
    }
}

// MARK: - Stored Domain Data (for Radiant DB)

struct StoredDomainData: Codable, Sendable {
    var appId: String
    var environment: String
    var baseDomain: String
    var hostedZoneId: String?
    var certificateArn: String?
    var subdomains: [SubdomainData]
    var emailDomain: String?
    var emailVerified: Bool
    var dkimVerified: Bool
    var createdAt: String
    var updatedAt: String
    
    struct SubdomainData: Codable, Sendable {
        var name: String
        var targetType: String
        var targetValue: String
    }
}
