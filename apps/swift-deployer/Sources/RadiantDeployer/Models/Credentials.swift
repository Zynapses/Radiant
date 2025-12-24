import Foundation

struct CredentialSet: Identifiable, Codable {
    let id: String
    var name: String
    var accessKeyId: String
    var secretAccessKey: String
    var region: String
    var accountId: String?
    var environment: CredentialEnvironment
    var createdAt: Date
    var lastValidatedAt: Date?
    var isValid: Bool?
    
    var maskedSecretKey: String {
        guard secretAccessKey.count > 8 else { return "********" }
        let prefix = String(secretAccessKey.prefix(4))
        let suffix = String(secretAccessKey.suffix(4))
        return "\(prefix)...\(suffix)"
    }
}

enum CredentialEnvironment: String, Codable, CaseIterable {
    case dev = "Development"
    case staging = "Staging"
    case prod = "Production"
    case shared = "Shared"
}

struct AWSAccount: Codable {
    let accountId: String
    let accountAlias: String?
    let regions: [String]
}
