// RADIANT v4.18.0 - 1Password Integration Service
// Compliance-certified credential storage (SOC2, HIPAA)

import Foundation
import Security

/// 1Password integration for secure, compliant credential storage
/// Requires 1Password CLI (op) to be installed: https://developer.1password.com/docs/cli
actor OnePasswordService {
    
    // MARK: - Types
    
    enum OnePasswordError: Error, LocalizedError {
        case cliNotInstalled
        case notSignedIn
        case vaultNotFound(String)
        case itemNotFound(String)
        case operationFailed(String)
        case invalidResponse
        case parseError(String)
        case authenticationFailed
        
        var errorDescription: String? {
            switch self {
            case .cliNotInstalled:
                return "1Password CLI (op) is not installed. Please install from https://1password.com/downloads/command-line/"
            case .notSignedIn:
                return "Not signed in to 1Password. Please sign in."
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
            case .authenticationFailed:
                return "1Password authentication failed"
            }
        }
    }
    
    // MARK: - Keychain Storage for Session
    
    private static let keychainService = "com.radiant.deployer.1password"
    private static let sessionTokenKey = "session_token"
    private static let accountKey = "account"
    
    /// Store 1Password session token in Keychain
    private func storeSessionToken(_ token: String, account: String) {
        // Delete existing
        let deleteQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Self.keychainService,
            kSecAttrAccount as String: Self.sessionTokenKey
        ]
        SecItemDelete(deleteQuery as CFDictionary)
        
        // Store new token
        let tokenQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Self.keychainService,
            kSecAttrAccount as String: Self.sessionTokenKey,
            kSecValueData as String: token.data(using: .utf8)!,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        SecItemAdd(tokenQuery as CFDictionary, nil)
        
        // Store account
        let accountDeleteQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Self.keychainService,
            kSecAttrAccount as String: Self.accountKey
        ]
        SecItemDelete(accountDeleteQuery as CFDictionary)
        
        let accountQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Self.keychainService,
            kSecAttrAccount as String: Self.accountKey,
            kSecValueData as String: account.data(using: .utf8)!,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        SecItemAdd(accountQuery as CFDictionary, nil)
    }
    
    /// Retrieve 1Password session token from Keychain
    private func getStoredSessionToken() -> (token: String, account: String)? {
        let tokenQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Self.keychainService,
            kSecAttrAccount as String: Self.sessionTokenKey,
            kSecReturnData as String: true
        ]
        
        var tokenResult: AnyObject?
        guard SecItemCopyMatching(tokenQuery as CFDictionary, &tokenResult) == errSecSuccess,
              let tokenData = tokenResult as? Data,
              let token = String(data: tokenData, encoding: .utf8) else {
            return nil
        }
        
        let accountQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Self.keychainService,
            kSecAttrAccount as String: Self.accountKey,
            kSecReturnData as String: true
        ]
        
        var accountResult: AnyObject?
        guard SecItemCopyMatching(accountQuery as CFDictionary, &accountResult) == errSecSuccess,
              let accountData = accountResult as? Data,
              let account = String(data: accountData, encoding: .utf8) else {
            return nil
        }
        
        return (token, account)
    }
    
    /// Clear stored session from Keychain
    func clearStoredSession() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Self.keychainService
        ]
        SecItemDelete(query as CFDictionary)
    }
    
    /// Sign in to 1Password and store session in Keychain
    func signIn(account: String, password: String) async throws {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: opPath)
        process.arguments = ["signin", "--account", account, "--raw"]
        
        let inputPipe = Pipe()
        let outputPipe = Pipe()
        let errorPipe = Pipe()
        
        process.standardInput = inputPipe
        process.standardOutput = outputPipe
        process.standardError = errorPipe
        
        try process.run()
        
        // Send password
        inputPipe.fileHandleForWriting.write(password.data(using: .utf8)!)
        inputPipe.fileHandleForWriting.closeFile()
        
        process.waitUntilExit()
        
        let outputData = outputPipe.fileHandleForReading.readDataToEndOfFile()
        let sessionToken = String(data: outputData, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        
        guard process.terminationStatus == 0 && !sessionToken.isEmpty else {
            throw OnePasswordError.authenticationFailed
        }
        
        // Store session token in Keychain
        storeSessionToken(sessionToken, account: account)
        
        await auditLogger.log(
            event: .credentialListAccessed,
            details: ["action": "signin", "account": account]
        )
    }
    
    /// Check if we have a valid stored session
    func hasStoredSession() -> Bool {
        return getStoredSessionToken() != nil
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
    private let opPath: String
    private let auditLogger: AuditLogger
    
    // MARK: - Initialization
    
    init(
        vaultName: String = "RADIANT",
        itemPrefix: String = "radiant-aws-",
        opPath: String = "/usr/local/bin/op"
    ) {
        self.vaultName = vaultName
        self.itemPrefix = itemPrefix
        self.opPath = opPath
        self.auditLogger = AuditLogger.shared
    }
    
    // MARK: - Public Methods
    
    /// Check if 1Password CLI is installed and user is signed in
    func checkStatus() async throws -> (installed: Bool, signedIn: Bool) {
        // Check if CLI exists
        let installed = FileManager.default.fileExists(atPath: opPath)
        if !installed {
            return (false, false)
        }
        
        // Check if signed in
        do {
            _ = try await runCommand(["account", "get", "--format", "json"])
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
        guard signedIn else { throw OnePasswordError.notSignedIn }
        
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
        guard signedIn else { throw OnePasswordError.notSignedIn }
        
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
        
        // Set session token from Keychain if available
        var environment = ProcessInfo.processInfo.environment
        if let stored = getStoredSessionToken() {
            environment["OP_SESSION_\(stored.account)"] = stored.token
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
            
            if errorMessage.contains("not signed in") || errorMessage.contains("session expired") {
                // Clear invalid session from Keychain
                clearStoredSession()
                throw OnePasswordError.notSignedIn
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
