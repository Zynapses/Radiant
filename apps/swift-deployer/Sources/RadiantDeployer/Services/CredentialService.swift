import Foundation
import Security

actor CredentialService {
    private let keychainService = "com.radiant.deployer.credentials"
    
    enum CredentialError: Error {
        case saveFailed
        case loadFailed
        case deleteFailed
        case encodingFailed
        case decodingFailed
    }
    
    func loadCredentials() async throws -> [CredentialSet] {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitAll
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess, let items = result as? [Data] else {
            if status == errSecItemNotFound {
                return []
            }
            throw CredentialError.loadFailed
        }
        
        let decoder = JSONDecoder()
        return items.compactMap { try? decoder.decode(CredentialSet.self, from: $0) }
    }
    
    func saveCredential(_ credential: CredentialSet) async throws {
        let encoder = JSONEncoder()
        guard let data = try? encoder.encode(credential) else {
            throw CredentialError.encodingFailed
        }
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: credential.id,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        
        SecItemDelete(query as CFDictionary)
        
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw CredentialError.saveFailed
        }
    }
    
    func deleteCredential(_ id: String) async throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: id
        ]
        
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw CredentialError.deleteFailed
        }
    }
    
    func validateCredentials(_ credential: CredentialSet) async throws -> Bool {
        // TODO: Implement AWS STS GetCallerIdentity call
        return true
    }
}
