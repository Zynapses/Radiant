// RADIANT v4.18.0 - Credential Service
// Uses 1Password for compliance-certified credential storage (SOC2, HIPAA)

import Foundation

actor CredentialService {
    
    // MARK: - Types
    
    enum CredentialError: Error, LocalizedError {
        case onePasswordNotInstalled
        case onePasswordNotSignedIn
        case saveFailed(String)
        case loadFailed(String)
        case deleteFailed(String)
        case validationFailed(String)
        
        var errorDescription: String? {
            switch self {
            case .onePasswordNotInstalled:
                return "1Password CLI is required. Please install from https://1password.com/downloads/command-line/"
            case .onePasswordNotSignedIn:
                return "Please sign in to 1Password. Run 'op signin' in Terminal."
            case .saveFailed(let msg):
                return "Failed to save credential: \(msg)"
            case .loadFailed(let msg):
                return "Failed to load credentials: \(msg)"
            case .deleteFailed(let msg):
                return "Failed to delete credential: \(msg)"
            case .validationFailed(let msg):
                return "Credential validation failed: \(msg)"
            }
        }
    }
    
    struct OnePasswordStatus: Sendable {
        let installed: Bool
        let signedIn: Bool
        let vaultExists: Bool
    }
    
    // MARK: - Properties
    
    private let onePassword: OnePasswordService
    private let auditLogger: AuditLogger
    
    // MARK: - Initialization
    
    init() {
        self.onePassword = OnePasswordService()
        self.auditLogger = AuditLogger.shared
    }
    
    // MARK: - Status Check
    
    /// Check 1Password status (installed, signed in, vault exists)
    func checkOnePasswordStatus() async -> OnePasswordStatus {
        do {
            let (installed, signedIn) = try await onePassword.checkStatus()
            
            var vaultExists = false
            if signedIn {
                let credentials = try? await onePassword.listCredentials()
                vaultExists = credentials != nil
            }
            
            return OnePasswordStatus(
                installed: installed,
                signedIn: signedIn,
                vaultExists: vaultExists
            )
        } catch {
            return OnePasswordStatus(installed: false, signedIn: false, vaultExists: false)
        }
    }
    
    // MARK: - Credential Operations
    
    /// Load all credentials from 1Password
    func loadCredentials() async throws -> [CredentialSet] {
        let status = await checkOnePasswordStatus()
        guard status.installed else { throw CredentialError.onePasswordNotInstalled }
        guard status.signedIn else { throw CredentialError.onePasswordNotSignedIn }
        
        do {
            let opCredentials = try await onePassword.listCredentials()
            
            return opCredentials.map { cred in
                CredentialSet(
                    id: cred.id,
                    name: cred.name,
                    accessKeyId: cred.accessKeyId,
                    secretAccessKey: cred.secretAccessKey,
                    region: cred.region,
                    accountId: cred.accountId,
                    environment: .shared,
                    createdAt: cred.createdAt,
                    lastValidatedAt: cred.lastUsedAt,
                    isValid: nil
                )
            }
        } catch {
            throw CredentialError.loadFailed(error.localizedDescription)
        }
    }
    
    /// Save a new credential to 1Password
    func saveCredential(_ credential: CredentialSet) async throws {
        let status = await checkOnePasswordStatus()
        guard status.installed else { throw CredentialError.onePasswordNotInstalled }
        guard status.signedIn else { throw CredentialError.onePasswordNotSignedIn }
        
        do {
            _ = try await onePassword.saveCredential(
                name: credential.name,
                accessKeyId: credential.accessKeyId,
                secretAccessKey: credential.secretAccessKey,
                region: credential.region,
                accountId: credential.accountId
            )
        } catch {
            throw CredentialError.saveFailed(error.localizedDescription)
        }
    }
    
    /// Delete a credential from 1Password
    func deleteCredential(_ id: String) async throws {
        let status = await checkOnePasswordStatus()
        guard status.installed else { throw CredentialError.onePasswordNotInstalled }
        guard status.signedIn else { throw CredentialError.onePasswordNotSignedIn }
        
        do {
            try await onePassword.deleteCredential(id: id)
        } catch {
            throw CredentialError.deleteFailed(error.localizedDescription)
        }
    }
    
    /// Validate credentials by calling AWS STS
    func validateCredentials(_ credential: CredentialSet) async throws -> Bool {
        let opCredential = OnePasswordService.AWSCredential(
            id: credential.id,
            name: credential.name,
            accessKeyId: credential.accessKeyId,
            secretAccessKey: credential.secretAccessKey,
            region: credential.region,
            accountId: credential.accountId,
            createdAt: credential.createdAt,
            lastUsedAt: credential.lastValidatedAt
        )
        
        return try await onePassword.validateCredential(opCredential)
    }
    
    /// Get a single credential by ID
    func getCredential(id: String) async throws -> CredentialSet {
        let status = await checkOnePasswordStatus()
        guard status.installed else { throw CredentialError.onePasswordNotInstalled }
        guard status.signedIn else { throw CredentialError.onePasswordNotSignedIn }
        
        do {
            let cred = try await onePassword.getCredential(id: id)
            
            return CredentialSet(
                id: cred.id,
                name: cred.name,
                accessKeyId: cred.accessKeyId,
                secretAccessKey: cred.secretAccessKey,
                region: cred.region,
                accountId: cred.accountId,
                environment: .shared,
                createdAt: cred.createdAt,
                lastValidatedAt: cred.lastUsedAt,
                isValid: nil
            )
        } catch {
            throw CredentialError.loadFailed(error.localizedDescription)
        }
    }
}
