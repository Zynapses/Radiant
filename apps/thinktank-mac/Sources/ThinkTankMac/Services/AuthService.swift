import Foundation
import Security

// MARK: - Auth Service
// Full authentication with Keychain storage, token refresh, login/logout
// Mirrors: apps/thinktank/lib/auth/api-auth.ts + context.tsx

@MainActor
class AuthService: ObservableObject {
    static let shared = AuthService()

    @Published var isAuthenticated: Bool = false
    @Published var isLoading: Bool = true
    @Published var user: AuthUser?
    @Published var error: String?

    private let keychainService = "com.radiant.thinktank"
    private let accessTokenKey = "access_token"
    private let refreshTokenKey = "refresh_token"
    private let userKey = "auth_user"
    private var refreshTask: Task<Void, Never>?

    struct AuthUser: Codable, Sendable {
        let id: String
        let email: String
        var displayName: String?
        var avatar: String?
        let tenantId: String
        var role: String?
    }

    struct LoginResponse: Codable {
        let accessToken: String
        let refreshToken: String
        let expiresIn: Int
        let user: AuthUser
    }

    struct RefreshResponse: Codable {
        let accessToken: String
        let expiresIn: Int
    }

    private init() {
        checkExistingSession()
    }

    // MARK: - Login

    func login(email: String, password: String) async {
        isLoading = true
        error = nil

        do {
            var request = URLRequest(url: URL(string: "\(APIClient.shared.baseURL)/api/auth/login")!)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")

            struct LoginBody: Encodable { let email: String; let password: String }
            request.httpBody = try JSONEncoder().encode(LoginBody(email: email, password: password))

            let (data, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw AuthError.invalidResponse
            }

            guard httpResponse.statusCode == 200 else {
                if let errorBody = try? JSONDecoder().decode(APIError.self, from: data) {
                    throw AuthError.serverError(errorBody.message)
                }
                throw AuthError.httpError(httpResponse.statusCode)
            }

            let loginResponse = try JSONDecoder().decode(LoginResponse.self, from: data)

            saveToKeychain(key: accessTokenKey, value: loginResponse.accessToken)
            saveToKeychain(key: refreshTokenKey, value: loginResponse.refreshToken)
            saveUser(loginResponse.user)

            await APIClient.shared.setToken(loginResponse.accessToken)

            user = loginResponse.user
            isAuthenticated = true
            isLoading = false

            scheduleTokenRefresh(expiresIn: loginResponse.expiresIn)
        } catch let authError as AuthError {
            self.error = authError.localizedDescription
            isLoading = false
        } catch {
            self.error = error.localizedDescription
            isLoading = false
        }
    }

    // MARK: - Logout

    func logout() {
        refreshTask?.cancel()
        refreshTask = nil

        deleteFromKeychain(key: accessTokenKey)
        deleteFromKeychain(key: refreshTokenKey)
        UserDefaults.standard.removeObject(forKey: userKey)

        Task {
            await APIClient.shared.setToken(nil)
        }

        user = nil
        isAuthenticated = false
        error = nil
    }

    // MARK: - Token Refresh

    func refreshAccessToken() async -> Bool {
        guard let refreshToken = loadFromKeychain(key: refreshTokenKey) else {
            return false
        }

        do {
            var request = URLRequest(url: URL(string: "\(APIClient.shared.baseURL)/api/auth/refresh")!)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")

            struct RefreshBody: Encodable { let refreshToken: String }
            request.httpBody = try JSONEncoder().encode(RefreshBody(refreshToken: refreshToken))

            let (data, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                return false
            }

            let refreshResponse = try JSONDecoder().decode(RefreshResponse.self, from: data)

            saveToKeychain(key: accessTokenKey, value: refreshResponse.accessToken)
            await APIClient.shared.setToken(refreshResponse.accessToken)

            scheduleTokenRefresh(expiresIn: refreshResponse.expiresIn)
            return true
        } catch {
            return false
        }
    }

    // MARK: - Session Check

    private func checkExistingSession() {
        guard let token = loadFromKeychain(key: accessTokenKey) else {
            isLoading = false
            return
        }

        if let userData = UserDefaults.standard.data(forKey: userKey),
           let savedUser = try? JSONDecoder().decode(AuthUser.self, from: userData) {
            user = savedUser
            isAuthenticated = true

            Task {
                await APIClient.shared.setToken(token)
                let refreshed = await refreshAccessToken()
                if !refreshed {
                    logout()
                }
                isLoading = false
            }
        } else {
            isLoading = false
        }
    }

    private func scheduleTokenRefresh(expiresIn: Int) {
        refreshTask?.cancel()
        let refreshDelay = max(Double(expiresIn) - 60, 30)
        refreshTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(refreshDelay * 1_000_000_000))
            guard !Task.isCancelled else { return }
            let success = await self?.refreshAccessToken() ?? false
            if !success {
                await MainActor.run {
                    self?.logout()
                }
            }
        }
    }

    // MARK: - Keychain Helpers

    private func saveToKeychain(key: String, value: String) {
        let data = value.data(using: .utf8)!
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)

        var addQuery = query
        addQuery[kSecValueData as String] = data
        SecItemAdd(addQuery as CFDictionary, nil)
    }

    private func loadFromKeychain(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func deleteFromKeychain(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
    }

    private func saveUser(_ user: AuthUser) {
        if let data = try? JSONEncoder().encode(user) {
            UserDefaults.standard.set(data, forKey: userKey)
        }
    }
}

// MARK: - Auth Errors

enum AuthError: LocalizedError {
    case invalidResponse
    case httpError(Int)
    case serverError(String)
    case tokenExpired

    var errorDescription: String? {
        switch self {
        case .invalidResponse: return "Invalid server response"
        case .httpError(let code): return "HTTP error \(code)"
        case .serverError(let message): return message
        case .tokenExpired: return "Session expired. Please log in again."
        }
    }
}
