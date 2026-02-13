import Foundation

// MARK: - OMEGA Cortex Service

@MainActor
final class OmegaCortexService: ObservableObject {
    @Published var isConnected: Bool = false
    @Published var brainState: BrainState?
    @Published var inferenceLog: [CortexInference] = []
    @Published var isThinking: Bool = false

    private let baseURL: String
    private let session: URLSession

    init(baseURL: String = "http://localhost:11435") {
        self.baseURL = baseURL
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        self.session = URLSession(configuration: config)
    }

    // MARK: - Health

    func checkHealth() async {
        guard let url = URL(string: "\(baseURL)/health") else { return }
        do {
            let (data, _) = try await session.data(from: url)
            let resp = try JSONDecoder().decode(HealthResponse.self, from: data)
            isConnected = resp.status == "ok"
        } catch {
            isConnected = false
        }
    }

    // MARK: - Boot

    func boot(config: [String: Any]? = nil) async throws -> BrainState {
        let resp: BrainState = try await post("/boot", body: config ?? [:])
        brainState = resp
        return resp
    }

    // MARK: - Think

    func think(text: String) async throws -> CortexInference {
        isThinking = true
        defer { isThinking = false }

        let resp: CortexInference = try await post("/think", body: ["text": text])
        inferenceLog.append(resp)
        await refreshState()
        return resp
    }

    // MARK: - Dream

    func dream() async throws -> DreamResult {
        let resp: DreamResult = try await post("/dream", body: [:])
        await refreshState()
        return resp
    }

    // MARK: - State

    func refreshState() async {
        guard let url = URL(string: "\(baseURL)/state") else { return }
        do {
            let (data, _) = try await session.data(from: url)
            brainState = try JSONDecoder().decode(BrainState.self, from: data)
        } catch {
            print("[OmegaCortex] State refresh failed: \(error)")
        }
    }

    // MARK: - Firmware

    func loadFirmware(data: Data) async throws -> FirmwareLoadResult {
        guard let url = URL(string: "\(baseURL)/firmware/load") else {
            throw CortexError.invalidURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = data
        let (respData, _) = try await session.data(for: request)
        return try JSONDecoder().decode(FirmwareLoadResult.self, from: respData)
    }

    // MARK: - Ambition

    func sendReward(magnitude: Double = 0.5) async throws -> AmbitionState {
        try await post("/ambition/reward", body: ["magnitude": magnitude])
    }

    func sendError(magnitude: Double = 0.3) async throws -> AmbitionState {
        try await post("/ambition/error", body: ["magnitude": magnitude])
    }

    // MARK: - Drive-Thru Pipeline

    func infer(text: String, conversationHistory: [[String: String]]) async throws -> DriveThruResponse {
        isThinking = true
        defer { isThinking = false }

        guard let url = URL(string: "\(baseURL)/infer") else { throw CortexError.invalidURL }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 60
        let body: [String: Any] = ["text": text, "conversation_history": conversationHistory]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await session.data(for: request)
        if let http = response as? HTTPURLResponse, http.statusCode >= 400 {
            let msg = String(data: data, encoding: .utf8) ?? "Unknown"
            throw CortexError.serverError(http.statusCode, msg)
        }
        return try JSONDecoder().decode(DriveThruResponse.self, from: data)
    }

    func loadTrainingData(model: String = "llama3.2:1b") async throws -> TrainLoadResponse {
        try await post("/train/load", body: ["model": model])
    }

    func loadCheckpoint() async throws -> CheckpointLoadResponse {
        try await post("/train/load-checkpoint", body: [:])
    }

    func clearOrder() async throws {
        guard let url = URL(string: "\(baseURL)/order/clear") else { throw CortexError.invalidURL }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let (_, response) = try await session.data(for: request)
        if let http = response as? HTTPURLResponse, http.statusCode >= 400 {
            throw CortexError.serverError(http.statusCode, "Clear order failed")
        }
    }

    // MARK: - Reset

    func reset() async throws -> BrainState {
        let resp: BrainState = try await post("/reset", body: [:])
        brainState = resp
        inferenceLog.removeAll()
        return resp
    }

    // MARK: - Helpers

    private func post<T: Decodable>(_ path: String, body: Any) async throws -> T {
        guard let url = URL(string: "\(baseURL)\(path)") else {
            throw CortexError.invalidURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await session.data(for: request)

        if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode >= 400 {
            let errorBody = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw CortexError.serverError(httpResponse.statusCode, errorBody)
        }

        return try JSONDecoder().decode(T.self, from: data)
    }
}

// MARK: - Error

enum CortexError: LocalizedError {
    case invalidURL
    case serverError(Int, String)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid OMEGA Cortex URL"
        case .serverError(let code, let body): return "Cortex error \(code): \(body)"
        }
    }
}

// MARK: - Response Models

struct HealthResponse: Codable {
    let status: String
    let service: String
    let brain_booted: Bool
    let torch_version: String
    let device: String
}

struct CortexInference: Codable, Identifiable {
    var id: Int { inference_id }
    let inference_id: Int
    let input_text: String
    let latency_ms: Double
    let pre_coherence: Double
    let post_coherence: Double
    let coherence_delta: Double
    let is_safe: Bool
    let max_helix_alignment: Double
    let helix_rules_count: Int
    let output_magnitude_mean: Double
    let output_magnitude_std: Double
    let output_phase_mean: Double
    let output_phase_std: Double
    let soft_tokens_shape: [Int]
    let ambition_signal: String
    let ambition_state: AmbitionState
    let state_norm: Double
}

struct DreamResult: Codable {
    let pre_coherence: Double
    let post_coherence: Double
    let coherence_gain: Double
    let replay_count: Int
    let total_dreams: Int
    let ambition_state: AmbitionState
}

struct AmbitionState: Codable {
    let signal: String
    let dopamine: Double
    let entropy: Double
    let curiosity: Double
    let arousal: Double
    let idle_ticks: Int
    let total_dreams: Int
    let total_rewards: Int
    let dream_ready: Bool
}

struct FirmwareLoadResult: Codable {
    let loaded: Bool
    let name: String
    let version: String
    let helix_rules: Int
}

struct CortexConfig: Codable {
    let input_dim: Int
    let hidden_dim: Int
    let dt: Double
    let decay_rate: Double
}

struct CortexMetrics: Codable {
    let coherence: Double
    let state_norm: Double
    let magnitude_mean: Double
    let magnitude_std: Double
    let magnitude_max: Double?
    let magnitude_min: Double?
    let phase_mean: Double
    let phase_std: Double
    let phase_histogram: [Double]?
    let magnitude_histogram: [Double]?
}

struct HelixState: Codable {
    let rules_count: Int
}

struct FirmwareState: Codable {
    let loaded: Bool
    let name: String?
    let version: String?
}

struct TransducerState: Codable {
    let params: Int
    let omega_dim: Int
    let llm_dim: Int
    let num_soft_tokens: Int
}

struct BrainState: Codable {
    let booted: Bool
    let boot_time: Double?
    let uptime_seconds: Double?
    let inference_count: Int?
    let config: CortexConfig?
    let cortex: CortexMetrics?
    let helix: HelixState?
    let ambition: AmbitionState?
    let firmware: FirmwareState?
    let transducer: TransducerState?
}
