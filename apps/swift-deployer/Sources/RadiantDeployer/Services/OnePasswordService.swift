// RADIANT v4.18.0 - 1Password Integration Service
// Compliance-certified credential storage (SOC2, HIPAA)
// Requires 1Password Teams or Business plan for Service Accounts

import Foundation
import Security

/// 1Password integration for secure, compliant credential storage
/// Uses Service Account tokens (requires Teams/Business plan)
/// Requires 1Password CLI (op) to be installed: https://developer.1password.com/docs/cli
actor OnePasswordService {
    
    // MARK: - Types
    
    enum OnePasswordError: Error, LocalizedError {
        case cliNotInstalled
        case notConfigured
        case vaultNotFound(String)
        case itemNotFound(String)
        case operationFailed(String)
        case invalidResponse
        case parseError(String)
        case invalidToken
        
        var errorDescription: String? {
            switch self {
            case .cliNotInstalled:
                return "1Password CLI (op) is not installed."
            case .notConfigured:
                return "Service account token not configured."
            case .vaultNotFound(let vault):
                return "1Password vault '\(vault)' not found"
            case .itemNotFound(let item):
                return "Credential '\(item)' not found in 1Password"
            case .operationFailed(let message):
                return "1Password operation failed: \(message)"
            case .invalidResponse:
                return "Invalid response from 1Password CLI"
            case .parseError(let message):
                return "Failed to parse 1Password response: \(message)"
            case .invalidToken:
                return "Invalid service account token"
            }
        }
    }
    
    // MARK: - Keychain Storage for Service Account Token
    
    private static let keychainService = "com.radiant.deployer.1password"
    private static let serviceAccountTokenKey = "service_account_token"
    
    /// Store service account token in Keychain
    func storeServiceAccountToken(_ token: String) {
        // Delete existing
        let deleteQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Self.keychainService,
            kSecAttrAccount as String: Self.serviceAccountTokenKey
        ]
        SecItemDelete(deleteQuery as CFDictionary)
        
        // Store new token
        let tokenQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Self.keychainService,
            kSecAttrAccount as String: Self.serviceAccountTokenKey,
            kSecValueData as String: token.data(using: .utf8)!,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        SecItemAdd(tokenQuery as CFDictionary, nil)
    }
    
    /// Retrieve service account token from Keychain
    func getServiceAccountToken() -> String? {
        let tokenQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Self.keychainService,
            kSecAttrAccount as String: Self.serviceAccountTokenKey,
            kSecReturnData as String: true
        ]
        
        var tokenResult: AnyObject?
        guard SecItemCopyMatching(tokenQuery as CFDictionary, &tokenResult) == errSecSuccess,
              let tokenData = tokenResult as? Data,
              let token = String(data: tokenData, encoding: .utf8) else {
            return nil
        }
        
        return token
    }
    
    /// Clear stored token from Keychain
    func clearStoredToken() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Self.keychainService
        ]
        SecItemDelete(query as CFDictionary)
    }
    
    /// Configure with a service account token
    func configureServiceAccount(token: String) async throws {
        // Validate the token by running a simple command
        let process = Process()
        process.executableURL = URL(fileURLWithPath: opPath)
        process.arguments = ["account", "get", "--format", "json"]
        
        var environment = ProcessInfo.processInfo.environment
        environment["OP_SERVICE_ACCOUNT_TOKEN"] = token
        process.environment = environment
        
        let outputPipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = errorPipe
        
        try process.run()
        process.waitUntilExit()
        
        guard process.terminationStatus == 0 else {
            let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
            let errorMessage = String(data: errorData, encoding: .utf8) ?? "Unknown error"
            throw OnePasswordError.invalidToken
        }
        
        // Token is valid, store it
        storeServiceAccountToken(token)
        
        await auditLogger.log(
            event: .credentialListAccessed,
            details: ["action": "configure_service_account"]
        )
    }
    
    /// Check if we have a configured service account
    func hasConfiguredServiceAccount() -> Bool {
        return getServiceAccountToken() != nil
    }
    
    struct AWSCredential: Codable, Sendable {
        let id: String
        let name: String
        let accessKeyId: String
        let secretAccessKey: String
        let region: String
        let accountId: String?
        let createdAt: Date
        let lastUsedAt: Date?
        
        enum CodingKeys: String, CodingKey {
            case id, name, region, createdAt, lastUsedAt
            case accessKeyId = "access_key_id"
            case secretAccessKey = "secret_access_key"
            case accountId = "account_id"
        }
    }
    
    struct OnePasswordItem: Codable {
        let id: String
        let title: String
        let vault: VaultRef
        let category: String
        let fields: [Field]?
        let createdAt: String?
        let updatedAt: String?
        
        struct VaultRef: Codable {
            let id: String
            let name: String?
        }
        
        struct Field: Codable {
            let id: String?
            let label: String?
            let value: String?
            let type: String?
        }
        
        enum CodingKeys: String, CodingKey {
            case id, title, vault, category, fields
            case createdAt = "created_at"
            case updatedAt = "updated_at"
        }
    }
    
    // MARK: - Configuration
    
    private let vaultName: String
    private let itemPrefix: String
    private var opPath: String
    private let auditLogger: AuditLogger
    
    /// Possible paths where 1Password CLI might be installed
    private static let opPaths = [
        "/opt/homebrew/bin/op",      // Apple Silicon Homebrew
        "/usr/local/bin/op",          // Intel Homebrew / manual install
        "/usr/bin/op"                 // System install
    ]
    
    /// Find the 1Password CLI binary
    private static func findOpPath() -> String? {
        for path in opPaths {
            if FileManager.default.fileExists(atPath: path) {
                return path
            }
        }
        return nil
    }
    
    // MARK: - Initialization
    
    init(
        vaultName: String = "RADIANT",
        itemPrefix: String = "radiant-aws-"
    ) {
        self.vaultName = vaultName
        self.itemPrefix = itemPrefix
        self.opPath = Self.findOpPath() ?? "/usr/local/bin/op"
        self.auditLogger = AuditLogger.shared
    }
    
    // MARK: - Public Methods
    
    /// Check if 1Password CLI is installed and service account is configured
    func checkStatus() async throws -> (installed: Bool, signedIn: Bool) {
        // Re-check for op binary (might have been installed since init)
        if let foundPath = Self.findOpPath() {
            opPath = foundPath
        }
        
        // Check if CLI exists
        let installed = FileManager.default.fileExists(atPath: opPath)
        if !installed {
            return (false, false)
        }
        
        // Check if service account token is configured and valid
        guard let token = getServiceAccountToken() else {
            return (true, false)
        }
        
        // Validate token by running a command
        do {
            _ = try await runCommand(["vault", "list", "--format", "json"])
            return (true, true)
        } catch {
            return (true, false)
        }
    }
    
    /// Ensure vault exists, create if needed
    func ensureVaultExists() async throws {
        let vaults = try await listVaults()
        if !vaults.contains(where: { $0.lowercased() == vaultName.lowercased() }) {
            try await createVault(vaultName)
            await auditLogger.log(
                event: .credentialVaultCreated,
                details: ["vault": vaultName]
            )
        }
    }
    
    /// List all AWS credentials stored in 1Password
    func listCredentials() async throws -> [AWSCredential] {
        let (installed, signedIn) = try await checkStatus()
        guard installed else { throw OnePasswordError.cliNotInstalled }
        guard signedIn else { throw OnePasswordError.notConfigured }
        
        let output = try await runCommand([
            "item", "list",
            "--vault", vaultName,
            "--categories", "API Credential",
            "--format", "json"
        ])
        
        guard let data = output.data(using: .utf8) else {
            throw OnePasswordError.invalidResponse
        }
        
        let items = try JSONDecoder().decode([OnePasswordItem].self, from: data)
        
        var credentials: [AWSCredential] = []
        for item in items where item.title.hasPrefix(itemPrefix) {
            if let credential = try? await getCredential(id: item.id) {
                credentials.append(credential)
            }
        }
        
        await auditLogger.log(
            event: .credentialListAccessed,
            details: ["count": "\(credentials.count)"]
        )
        
        return credentials
    }
    
    /// Get a specific credential by ID
    func getCredential(id: String) async throws -> AWSCredential {
        let output = try await runCommand([
            "item", "get", id,
            "--vault", vaultName,
            "--format", "json"
        ])
        
        guard let data = output.data(using: .utf8) else {
            throw OnePasswordError.invalidResponse
        }
        
        let item = try JSONDecoder().decode(OnePasswordItem.self, from: data)
        
        guard let fields = item.fields else {
            throw OnePasswordError.parseError("No fields in credential")
        }
        
        let accessKeyId = fields.first { $0.label == "access_key_id" }?.value ?? ""
        let secretAccessKey = fields.first { $0.label == "secret_access_key" }?.value ?? ""
        let region = fields.first { $0.label == "region" }?.value ?? "us-east-1"
        let accountId = fields.first { $0.label == "account_id" }?.value
        
        let formatter = ISO8601DateFormatter()
        let createdAt = item.createdAt.flatMap { formatter.date(from: $0) } ?? Date()
        let updatedAt = item.updatedAt.flatMap { formatter.date(from: $0) }
        
        let name = String(item.title.dropFirst(itemPrefix.count))
        
        await auditLogger.log(
            event: .credentialAccessed,
            details: ["credential_id": id, "name": name]
        )
        
        return AWSCredential(
            id: item.id,
            name: name,
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey,
            region: region,
            accountId: accountId,
            createdAt: createdAt,
            lastUsedAt: updatedAt
        )
    }
    
    /// Save a new credential to 1Password
    func saveCredential(
        name: String,
        accessKeyId: String,
        secretAccessKey: String,
        region: String,
        accountId: String? = nil
    ) async throws -> AWSCredential {
        let (installed, signedIn) = try await checkStatus()
        guard installed else { throw OnePasswordError.cliNotInstalled }
        guard signedIn else { throw OnePasswordError.notConfigured }
        
        try await ensureVaultExists()
        
        let itemTitle = "\(itemPrefix)\(name)"
        
        var args = [
            "item", "create",
            "--category", "API Credential",
            "--vault", vaultName,
            "--title", itemTitle,
            "access_key_id[text]=\(accessKeyId)",
            "secret_access_key[password]=\(secretAccessKey)",
            "region[text]=\(region)",
            "--format", "json"
        ]
        
        if let accountId = accountId {
            args.insert("account_id[text]=\(accountId)", at: args.count - 2)
        }
        
        let output = try await runCommand(args)
        
        guard let data = output.data(using: .utf8) else {
            throw OnePasswordError.invalidResponse
        }
        
        let item = try JSONDecoder().decode(OnePasswordItem.self, from: data)
        
        await auditLogger.log(
            event: .credentialCreated,
            details: ["credential_id": item.id, "name": name, "region": region]
        )
        
        return AWSCredential(
            id: item.id,
            name: name,
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey,
            region: region,
            accountId: accountId,
            createdAt: Date(),
            lastUsedAt: nil
        )
    }
    
    /// Update an existing credential
    func updateCredential(
        id: String,
        accessKeyId: String? = nil,
        secretAccessKey: String? = nil,
        region: String? = nil
    ) async throws {
        var args = ["item", "edit", id, "--vault", vaultName]
        
        if let accessKeyId = accessKeyId {
            args.append("access_key_id[text]=\(accessKeyId)")
        }
        if let secretAccessKey = secretAccessKey {
            args.append("secret_access_key[password]=\(secretAccessKey)")
        }
        if let region = region {
            args.append("region[text]=\(region)")
        }
        
        _ = try await runCommand(args)
        
        await auditLogger.log(
            event: .credentialUpdated,
            details: ["credential_id": id]
        )
    }
    
    /// Delete a credential
    func deleteCredential(id: String) async throws {
        _ = try await runCommand([
            "item", "delete", id,
            "--vault", vaultName
        ])
        
        await auditLogger.log(
            event: .credentialDeleted,
            details: ["credential_id": id]
        )
    }
    
    // MARK: - Provider API Keys
    
    /// Provider API key stored in 1Password
    struct ProviderAPIKey: Sendable {
        let provider: String
        let secretPath: String
        let apiKey: String
    }
    
    /// Save a provider API key to 1Password
    func saveProviderAPIKey(
        provider: String,
        secretPath: String,
        apiKey: String
    ) async throws {
        let (installed, signedIn) = try await checkStatus()
        guard installed else { throw OnePasswordError.cliNotInstalled }
        guard signedIn else { throw OnePasswordError.notConfigured }
        
        try await ensureVaultExists()
        
        let itemTitle = "radiant-provider-\(provider.lowercased().replacingOccurrences(of: " ", with: "-"))"
        
        // Check if item exists and update, or create new
        do {
            // Try to find existing item
            let output = try await runCommand([
                "item", "list",
                "--vault", vaultName,
                "--format", "json"
            ])
            
            if let data = output.data(using: .utf8),
               let items = try? JSONDecoder().decode([OnePasswordItem].self, from: data),
               let existing = items.first(where: { $0.title == itemTitle }) {
                // Update existing
                _ = try await runCommand([
                    "item", "edit", existing.id,
                    "--vault", vaultName,
                    "api_key[password]=\(apiKey)",
                    "secret_path[text]=\(secretPath)"
                ])
                return
            }
        } catch {
            // Item doesn't exist, continue to create
        }
        
        // Create new item
        _ = try await runCommand([
            "item", "create",
            "--category", "API Credential",
            "--vault", vaultName,
            "--title", itemTitle,
            "provider[text]=\(provider)",
            "secret_path[text]=\(secretPath)",
            "api_key[password]=\(apiKey)",
            "--format", "json"
        ])
        
        await auditLogger.log(
            event: .credentialCreated,
            details: ["provider": provider, "secret_path": secretPath]
        )
    }
    
    /// Get a provider API key from 1Password
    func getProviderAPIKey(provider: String) async throws -> ProviderAPIKey? {
        let (installed, signedIn) = try await checkStatus()
        guard installed else { throw OnePasswordError.cliNotInstalled }
        guard signedIn else { throw OnePasswordError.notConfigured }
        
        let itemTitle = "radiant-provider-\(provider.lowercased().replacingOccurrences(of: " ", with: "-"))"
        
        // Find the item
        let listOutput = try await runCommand([
            "item", "list",
            "--vault", vaultName,
            "--format", "json"
        ])
        
        guard let listData = listOutput.data(using: .utf8),
              let items = try? JSONDecoder().decode([OnePasswordItem].self, from: listData),
              let item = items.first(where: { $0.title == itemTitle }) else {
            return nil
        }
        
        // Get the full item with fields
        let output = try await runCommand([
            "item", "get", item.id,
            "--vault", vaultName,
            "--format", "json"
        ])
        
        guard let data = output.data(using: .utf8) else {
            throw OnePasswordError.invalidResponse
        }
        
        let fullItem = try JSONDecoder().decode(OnePasswordItem.self, from: data)
        
        guard let fields = fullItem.fields else {
            return nil
        }
        
        let apiKey = fields.first { $0.label == "api_key" }?.value ?? ""
        let secretPath = fields.first { $0.label == "secret_path" }?.value ?? ""
        
        return ProviderAPIKey(
            provider: provider,
            secretPath: secretPath,
            apiKey: apiKey
        )
    }
    
    /// Get all required provider API keys
    func getRequiredProviderAPIKeys() async throws -> [ProviderAPIKey] {
        let requiredProviders = ["Anthropic", "Groq"]
        var keys: [ProviderAPIKey] = []
        
        for provider in requiredProviders {
            if let key = try await getProviderAPIKey(provider: provider) {
                keys.append(key)
            }
        }
        
        return keys
    }
    
    /// Check if all required provider API keys are configured
    func hasRequiredProviderAPIKeys() async -> Bool {
        do {
            let keys = try await getRequiredProviderAPIKeys()
            return keys.count == 2 && keys.allSatisfy { !$0.apiKey.isEmpty }
        } catch {
            return false
        }
    }
    
    /// Validate credentials by calling AWS STS
    func validateCredential(_ credential: AWSCredential) async throws -> Bool {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/local/bin/aws")
        process.arguments = ["sts", "get-caller-identity", "--output", "json"]
        
        var environment = ProcessInfo.processInfo.environment
        environment["AWS_ACCESS_KEY_ID"] = credential.accessKeyId
        environment["AWS_SECRET_ACCESS_KEY"] = credential.secretAccessKey
        environment["AWS_DEFAULT_REGION"] = credential.region
        process.environment = environment
        
        let outputPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = Pipe()
        
        do {
            try process.run()
            process.waitUntilExit()
            
            let isValid = process.terminationStatus == 0
            
            await auditLogger.log(
                event: .credentialValidated,
                details: [
                    "credential_id": credential.id,
                    "name": credential.name,
                    "valid": "\(isValid)"
                ]
            )
            
            return isValid
        } catch {
            return false
        }
    }
    
    // MARK: - Private Methods
    
    private func listVaults() async throws -> [String] {
        let output = try await runCommand(["vault", "list", "--format", "json"])
        
        guard let data = output.data(using: .utf8) else {
            return []
        }
        
        struct VaultItem: Codable {
            let id: String
            let name: String
        }
        
        let vaults = try JSONDecoder().decode([VaultItem].self, from: data)
        return vaults.map { $0.name }
    }
    
    private func createVault(_ name: String) async throws {
        _ = try await runCommand(["vault", "create", name])
    }
    
    private func runCommand(_ arguments: [String]) async throws -> String {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: opPath)
        process.arguments = arguments
        
        // Set service account token from Keychain
        var environment = ProcessInfo.processInfo.environment
        if let token = getServiceAccountToken() {
            environment["OP_SERVICE_ACCOUNT_TOKEN"] = token
        }
        process.environment = environment
        
        let outputPipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = errorPipe
        
        try process.run()
        process.waitUntilExit()
        
        let outputData = outputPipe.fileHandleForReading.readDataToEndOfFile()
        let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
        
        if process.terminationStatus != 0 {
            let errorMessage = String(data: errorData, encoding: .utf8) ?? "Unknown error"
            
            if errorMessage.contains("not authorized") || errorMessage.contains("invalid token") || errorMessage.contains("authentication") {
                // Clear invalid token from Keychain
                clearStoredToken()
                throw OnePasswordError.invalidToken
            }
            if errorMessage.contains("vault") && errorMessage.contains("not found") {
                throw OnePasswordError.vaultNotFound(vaultName)
            }
            if errorMessage.contains("item") && errorMessage.contains("not found") {
                throw OnePasswordError.itemNotFound(arguments.last ?? "unknown")
            }
            
            throw OnePasswordError.operationFailed(errorMessage.trimmingCharacters(in: .whitespacesAndNewlines))
        }
        
        return String(data: outputData, encoding: .utf8) ?? ""
    }
}

// MARK: - Audit Events

extension AuditLogger {
    enum CredentialEvent: String {
        case credentialListAccessed = "credential.list.accessed"
        case credentialAccessed = "credential.accessed"
        case credentialCreated = "credential.created"
        case credentialUpdated = "credential.updated"
        case credentialDeleted = "credential.deleted"
        case credentialValidated = "credential.validated"
        case credentialVaultCreated = "credential.vault.created"
    }
    
    func log(event: CredentialEvent, details: [String: String]) async {
        let auditLogger = AuditLogger.shared
        await auditLogger.log(
            action: .credentialValidated,
            details: "\(event.rawValue): \(details.map { "\($0.key)=\($0.value)" }.joined(separator: ", "))",
            metadata: details
        )
    }
}
