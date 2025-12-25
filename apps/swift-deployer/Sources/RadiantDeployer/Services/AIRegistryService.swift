import Foundation

/// AI Registry Service - Fetches providers and models from Radiant API
/// NEVER hardcode provider/model lists - always fetch from running instance
actor AIRegistryService {
    
    // MARK: - Types
    
    struct AIProvider: Codable, Identifiable, Sendable {
        let id: String
        let name: String
        let displayName: String
        let category: String
        let description: String?
        let website: String?
        let enabled: Bool
        let modelCount: Int
        let features: [String]
        let compliance: [String]
        let status: String
        
        var isHIPAACompliant: Bool {
            compliance.contains("HIPAA")
        }
    }
    
    struct AIModel: Codable, Identifiable, Sendable {
        let id: String
        let providerId: String
        let modelId: String
        let name: String
        let displayName: String
        let description: String?
        let category: String
        let specialty: String?
        let capabilities: [String]
        let contextWindow: Int?
        let maxOutput: Int?
        let inputModalities: [String]?
        let outputModalities: [String]?
        let pricing: ModelPricing
        let minTier: Int
        let enabled: Bool
        let status: String
    }
    
    struct ModelPricing: Codable, Sendable {
        let inputCostPer1k: Double?
        let outputCostPer1k: Double?
        let perImage: Double?
        let perMinuteAudio: Double?
        let perMinuteVideo: Double?
        let markup: Double
    }
    
    struct SelfHostedModel: Codable, Identifiable, Sendable {
        let id: String
        let name: String
        let displayName: String
        let description: String?
        let category: String
        let specialty: String?
        let instanceType: String
        let capabilities: [String]
        let pricing: ModelPricing
        let minTier: Int
        let thermalState: String?
        let enabled: Bool
    }
    
    struct ThermalState: Codable, Sendable {
        let modelId: String
        let state: String  // COLD, WARMING, WARM, HOT
        let currentInstances: Int
        let desiredInstances: Int
        let lastActivity: Date?
    }
    
    enum RegistryError: Error, LocalizedError {
        case notConnected
        case invalidResponse
        case networkError(String)
        case serverError(Int, String)
        
        var errorDescription: String? {
            switch self {
            case .notConnected:
                return "Not connected to Radiant instance"
            case .invalidResponse:
                return "Invalid response from server"
            case .networkError(let message):
                return "Network error: \(message)"
            case .serverError(let code, let message):
                return "Server error (\(code)): \(message)"
            }
        }
    }
    
    // MARK: - Properties
    
    private var baseURL: String?
    private var authToken: String?
    
    // MARK: - Configuration
    
    func configure(baseURL: String, authToken: String) {
        self.baseURL = baseURL
        self.authToken = authToken
    }
    
    // MARK: - Provider Operations
    
    /// Fetch all providers from Radiant instance
    func fetchProviders() async throws -> [AIProvider] {
        let data = try await request(path: "/api/v2/providers")
        let response = try JSONDecoder().decode(RegistryProvidersResponse.self, from: data)
        return response.providers
    }
    
    /// Fetch a specific provider
    func fetchProvider(id: String) async throws -> AIProvider {
        let data = try await request(path: "/api/v2/providers/\(id)")
        return try JSONDecoder().decode(AIProvider.self, from: data)
    }
    
    // MARK: - Model Operations
    
    /// Fetch all models
    func fetchModels() async throws -> [AIModel] {
        let data = try await request(path: "/api/v2/models")
        let response = try JSONDecoder().decode(RegistryModelsResponse.self, from: data)
        return response.models
    }
    
    /// Fetch models for a specific provider
    func fetchModels(providerId: String) async throws -> [AIModel] {
        let data = try await request(path: "/api/v2/providers/\(providerId)/models")
        let response = try JSONDecoder().decode(RegistryModelsResponse.self, from: data)
        return response.models
    }
    
    /// Fetch models by category
    func fetchModels(category: String) async throws -> [AIModel] {
        let data = try await request(path: "/api/v2/models?category=\(category)")
        let response = try JSONDecoder().decode(RegistryModelsResponse.self, from: data)
        return response.models
    }
    
    // MARK: - Self-Hosted Model Operations
    
    /// Fetch all self-hosted models
    func fetchSelfHostedModels() async throws -> [SelfHostedModel] {
        let data = try await request(path: "/api/v2/models/self-hosted")
        let response = try JSONDecoder().decode(RegistrySelfHostedModelsResponse.self, from: data)
        return response.models
    }
    
    // MARK: - Thermal Management
    
    /// Get thermal state for a model
    func getThermalState(modelId: String) async throws -> ThermalState {
        let data = try await request(path: "/api/v2/thermal/\(modelId)")
        return try JSONDecoder().decode(ThermalState.self, from: data)
    }
    
    /// Get all thermal states
    func getAllThermalStates() async throws -> [ThermalState] {
        let data = try await request(path: "/api/v2/thermal")
        let response = try JSONDecoder().decode(RegistryThermalStatesResponse.self, from: data)
        return response.states
    }
    
    /// Warm up a model
    func warmModel(modelId: String) async throws {
        _ = try await request(path: "/api/v2/thermal/\(modelId)/warm", method: "POST")
    }
    
    /// Cool down a model
    func coolModel(modelId: String) async throws {
        _ = try await request(path: "/api/v2/thermal/\(modelId)/cool", method: "POST")
    }
    
    // MARK: - Private Helpers
    
    private func request(path: String, method: String = "GET", body: Data? = nil) async throws -> Data {
        guard let baseURL = baseURL, let authToken = authToken else {
            throw RegistryError.notConnected
        }
        
        guard let url = URL(string: "\(baseURL)\(path)") else {
            throw RegistryError.invalidResponse
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("RadiantDeployer/4.18.0", forHTTPHeaderField: "User-Agent")
        
        if let body = body {
            request.httpBody = body
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw RegistryError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            let message = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw RegistryError.serverError(httpResponse.statusCode, message)
        }
        
        return data
    }
}

// MARK: - Response Types

private struct RegistryProvidersResponse: Codable {
    let providers: [AIRegistryService.AIProvider]
}

private struct RegistryModelsResponse: Codable {
    let models: [AIRegistryService.AIModel]
}

private struct RegistrySelfHostedModelsResponse: Codable {
    let models: [AIRegistryService.SelfHostedModel]
}

private struct RegistryThermalStatesResponse: Codable {
    let states: [AIRegistryService.ThermalState]
}
