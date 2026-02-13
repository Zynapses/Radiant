import Foundation

// MARK: - Chat

struct ChatMessage: Identifiable, Codable, Sendable {
    let id: UUID
    let role: MessageRole
    let content: String
    let timestamp: Date
    var tokenCount: Int?
    var latencyMs: Double?
    var model: String?

    init(
        id: UUID = UUID(),
        role: MessageRole,
        content: String,
        timestamp: Date = Date(),
        tokenCount: Int? = nil,
        latencyMs: Double? = nil,
        model: String? = nil
    ) {
        self.id = id
        self.role = role
        self.content = content
        self.timestamp = timestamp
        self.tokenCount = tokenCount
        self.latencyMs = latencyMs
        self.model = model
    }
}

enum MessageRole: String, Codable, Sendable {
    case system
    case user
    case assistant
}

// MARK: - Ollama API Types

struct OllamaTagsResponse: Codable, Sendable {
    let models: [OllamaModel]
}

struct OllamaModel: Codable, Sendable, Identifiable {
    let name: String
    let model: String
    let modified_at: String
    let size: Int64
    let digest: String

    var id: String { name }

    var sizeGB: Double {
        Double(size) / 1_073_741_824.0
    }

    var displaySize: String {
        String(format: "%.1f GB", sizeGB)
    }
}

struct OllamaChatRequest: Codable, Sendable {
    let model: String
    let messages: [OllamaChatMessage]
    let stream: Bool
    let options: OllamaOptions?

    init(model: String, messages: [OllamaChatMessage], stream: Bool = false, options: OllamaOptions? = nil) {
        self.model = model
        self.messages = messages
        self.stream = stream
        self.options = options
    }
}

struct OllamaChatMessage: Codable, Sendable {
    let role: String
    let content: String
}

struct OllamaOptions: Codable, Sendable {
    let temperature: Double?
    let top_p: Double?
    let num_predict: Int?
    let seed: Int?
}

struct OllamaChatResponse: Codable, Sendable {
    let model: String
    let message: OllamaChatMessage
    let done: Bool
    let total_duration: Int64?
    let eval_count: Int?
    let eval_duration: Int64?

    var latencyMs: Double? {
        guard let duration = total_duration else { return nil }
        return Double(duration) / 1_000_000.0
    }

    var tokensPerSecond: Double? {
        guard let count = eval_count, let duration = eval_duration, duration > 0 else { return nil }
        return Double(count) / (Double(duration) / 1_000_000_000.0)
    }
}

// MARK: - Connection

enum ConnectionStatus: Sendable {
    case disconnected
    case checking
    case connected(modelCount: Int)
    case error(String)

    var displayText: String {
        switch self {
        case .disconnected: return "Disconnected"
        case .checking: return "Checking..."
        case .connected(let count): return "Connected (\(count) models)"
        case .error(let msg): return "Error: \(msg)"
        }
    }

    var color: String {
        switch self {
        case .disconnected: return "gray"
        case .checking: return "yellow"
        case .connected: return "green"
        case .error: return "red"
        }
    }

    var isConnected: Bool {
        if case .connected = self { return true }
        return false
    }
}

// MARK: - Drive-Thru (OMEGA /infer endpoint)

struct DriveThruResponse: Codable, Sendable {
    let response: String
    let omega: OmegaDecision
    let cortex: CortexTelemetry
    let llama: LlamaInfo
    let order: OrderState
    let total_ms: Double
    let is_trained: Bool
}

struct OmegaDecision: Codable, Sendable {
    let behavior: String
    let raw_behavior: String
    let confidence: Double
    let top_behaviors: [[AnyCodable]]
    let target_data: [String: AnyCodable]
    let processing_ms: Double
}

struct CortexTelemetry: Codable, Sendable {
    let coherence: Double
    let state_norm: Double
    let output_magnitude_mean: Double
    let output_magnitude_std: Double
    let output_magnitude_max: Double
    let output_phase_mean: Double
    let output_phase_std: Double
    let output_sparsity: Double
    let hidden_dim: Int
}

struct LlamaInfo: Codable, Sendable {
    let instruction: String
    let processing_ms: Double
    let model: String?
}

struct OrderState: Codable, Sendable {
    let items: [OrderItem]
    let running_total: Double
}

struct OrderItem: Codable, Sendable, Identifiable {
    var id: String { "\(item)-\(quantity)-\(line_total)" }
    let item: String
    let quantity: Int
    let unit_price: Double
    let line_total: Double
    let is_meal: Bool
    let drink: String?
    let sauce: String?
    let customizations: [String]
}

struct TrainLoadResponse: Codable, Sendable {
    let loaded: Bool
    let training_examples: Int
    let behavior_types: Int
    let behaviors: [String: Int]
    let model: String?
}

struct CheckpointLoadResponse: Codable, Sendable {
    let loaded: Bool
    let epoch: Int
    let best_accuracy: Double
    let is_trained: Bool
}

/// Type-erased Codable for heterogeneous JSON values
struct AnyCodable: Codable, Sendable {
    let value: Any

    init(_ value: Any) { self.value = value }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            value = NSNull()
        } else if let b = try? container.decode(Bool.self) {
            value = b
        } else if let i = try? container.decode(Int.self) {
            value = i
        } else if let d = try? container.decode(Double.self) {
            value = d
        } else if let s = try? container.decode(String.self) {
            value = s
        } else if let arr = try? container.decode([AnyCodable].self) {
            value = arr.map(\.value)
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            value = dict.mapValues(\.value)
        } else {
            value = NSNull()
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch value {
        case is NSNull: try container.encodeNil()
        case let b as Bool: try container.encode(b)
        case let i as Int: try container.encode(i)
        case let d as Double: try container.encode(d)
        case let s as String: try container.encode(s)
        default: try container.encodeNil()
        }
    }

    var stringValue: String? { value as? String }
    var doubleValue: Double? { value as? Double }
    var intValue: Int? { value as? Int }
}

// MARK: - Inference Config

struct InferenceConfig: Codable, Sendable {
    var baseURL: String = "http://localhost:11434"
    var selectedModel: String = ""
    var systemPrompt: String = "You are an OMEGA brain instance running in the Proving Ground. Respond accurately and concisely."
    var temperature: Double = 0.7
    var topP: Double = 0.9
    var maxTokens: Int = 2048
    var seed: Int? = nil
}
