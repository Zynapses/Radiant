import Foundation

/// Handles API communication with deployed RADIANT infrastructure
actor APIService {
    private let session: URLSession
    private var authToken: String?
    
    init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        self.session = URLSession(configuration: config)
    }
    
    // MARK: - Authentication
    
    func authenticate(apiUrl: String, credentials: CredentialSet) async throws -> String {
        let url = URL(string: "\(apiUrl)/admin/auth/token")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "accessKeyId": credentials.accessKeyId,
            "secretAccessKey": credentials.secretAccessKey,
            "region": credentials.region
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw APIError.authenticationFailed
        }
        
        let result = try JSONDecoder().decode(AuthResponse.self, from: data)
        self.authToken = result.token
        return result.token
    }
    
    // MARK: - Health Check
    
    func checkHealth(apiUrl: String) async throws -> HealthCheckResponse {
        let url = URL(string: "\(apiUrl)/health")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw APIError.healthCheckFailed
        }
        
        return try JSONDecoder().decode(HealthCheckResponse.self, from: data)
    }
    
    // MARK: - Tenant Management
    
    func listTenants(apiUrl: String) async throws -> [Tenant] {
        guard let token = authToken else {
            throw APIError.notAuthenticated
        }
        
        let url = URL(string: "\(apiUrl)/admin/tenants")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw APIError.requestFailed
        }
        
        let result = try JSONDecoder().decode(TenantsResponse.self, from: data)
        return result.tenants
    }
    
    func createTenant(apiUrl: String, tenant: CreateTenantRequest) async throws -> Tenant {
        guard let token = authToken else {
            throw APIError.notAuthenticated
        }
        
        let url = URL(string: "\(apiUrl)/admin/tenants")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(tenant)
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 201 else {
            throw APIError.requestFailed
        }
        
        return try JSONDecoder().decode(Tenant.self, from: data)
    }
    
    // MARK: - Model Management
    
    func listModels(apiUrl: String) async throws -> [AIModel] {
        guard let token = authToken else {
            throw APIError.notAuthenticated
        }
        
        let url = URL(string: "\(apiUrl)/admin/models")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw APIError.requestFailed
        }
        
        let result = try JSONDecoder().decode(ModelsResponse.self, from: data)
        return result.models
    }
    
    // MARK: - Provider Management
    
    func listProviders(apiUrl: String) async throws -> [APIProvider] {
        guard let token = authToken else {
            throw APIError.notAuthenticated
        }
        
        let url = URL(string: "\(apiUrl)/admin/providers")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw APIError.requestFailed
        }
        
        let result = try JSONDecoder().decode(ProvidersResponse.self, from: data)
        return result.providers
    }
    
    func updateProviderCredentials(apiUrl: String, providerId: String, apiKey: String) async throws {
        guard let token = authToken else {
            throw APIError.notAuthenticated
        }
        
        let url = URL(string: "\(apiUrl)/admin/providers/\(providerId)/credentials")!
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = ["apiKey": apiKey]
        request.httpBody = try JSONEncoder().encode(body)
        
        let (_, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw APIError.requestFailed
        }
    }
}

// MARK: - API Types

struct AuthResponse: Codable {
    let token: String
    let expiresAt: Date
}

struct HealthCheckResponse: Codable {
    let status: String
    let version: String
    let database: String
    let cache: String
    let timestamp: Date
}

struct Tenant: Codable, Identifiable {
    let id: String
    let name: String
    let domain: String
    let status: String
    let plan: String
    let createdAt: Date
}

struct CreateTenantRequest: Codable {
    let name: String
    let domain: String
    let adminEmail: String
    let plan: String
}

struct TenantsResponse: Codable {
    let tenants: [Tenant]
    let total: Int
}

struct AIModel: Codable, Identifiable {
    let id: String
    let name: String
    let provider: String
    let status: String
    let isHosted: Bool
}

struct ModelsResponse: Codable {
    let models: [AIModel]
}

struct APIProvider: Codable, Identifiable {
    let id: String
    let name: String
    let status: String
    let hasCredentials: Bool
}

struct ProvidersResponse: Codable {
    let providers: [APIProvider]
}

// MARK: - Errors

enum APIError: Error, LocalizedError {
    case authenticationFailed
    case notAuthenticated
    case healthCheckFailed
    case requestFailed
    case invalidResponse
    
    var errorDescription: String? {
        switch self {
        case .authenticationFailed: return "Authentication failed"
        case .notAuthenticated: return "Not authenticated - please login first"
        case .healthCheckFailed: return "Health check failed - API may be down"
        case .requestFailed: return "API request failed"
        case .invalidResponse: return "Invalid response from API"
        }
    }
}
