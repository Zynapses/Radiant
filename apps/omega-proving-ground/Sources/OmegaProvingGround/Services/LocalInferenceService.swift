import Foundation

@MainActor
final class LocalInferenceService: ObservableObject {
    @Published var connectionStatus: ConnectionStatus = .disconnected
    @Published var availableModels: [OllamaModel] = []
    @Published var config: InferenceConfig = InferenceConfig()
    @Published var isGenerating: Bool = false

    private let session: URLSession

    init() {
        let sessionConfig = URLSessionConfiguration.default
        sessionConfig.timeoutIntervalForRequest = 120
        sessionConfig.timeoutIntervalForResource = 300
        self.session = URLSession(configuration: sessionConfig)
    }

    // MARK: - Connection

    func checkConnection() async {
        connectionStatus = .checking
        do {
            let models = try await fetchModels()
            availableModels = models
            connectionStatus = .connected(modelCount: models.count)

            if config.selectedModel.isEmpty, let first = models.first {
                config.selectedModel = first.name
            }
        } catch {
            connectionStatus = .error(error.localizedDescription)
            availableModels = []
        }
    }

    private func fetchModels() async throws -> [OllamaModel] {
        guard let url = URL(string: "\(config.baseURL)/api/tags") else {
            throw InferenceError.invalidURL
        }

        let (data, response) = try await session.data(from: url)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw InferenceError.serverError("Unexpected status code")
        }

        let tagsResponse = try JSONDecoder().decode(OllamaTagsResponse.self, from: data)
        return tagsResponse.models
    }

    // MARK: - Chat

    func chat(messages: [ChatMessage]) async throws -> ChatMessage {
        guard connectionStatus.isConnected else {
            throw InferenceError.notConnected
        }

        guard !config.selectedModel.isEmpty else {
            throw InferenceError.noModelSelected
        }

        isGenerating = true
        defer { isGenerating = false }

        let ollamaMessages = buildOllamaMessages(from: messages)
        let request = OllamaChatRequest(
            model: config.selectedModel,
            messages: ollamaMessages,
            stream: false,
            options: OllamaOptions(
                temperature: config.temperature,
                top_p: config.topP,
                num_predict: config.maxTokens,
                seed: config.seed
            )
        )

        guard let url = URL(string: "\(config.baseURL)/api/chat") else {
            throw InferenceError.invalidURL
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.httpBody = try JSONEncoder().encode(request)

        let startTime = CFAbsoluteTimeGetCurrent()
        let (data, response) = try await session.data(for: urlRequest)
        let elapsed = (CFAbsoluteTimeGetCurrent() - startTime) * 1000.0

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw InferenceError.serverError("Chat request failed")
        }

        let chatResponse = try JSONDecoder().decode(OllamaChatResponse.self, from: data)

        return ChatMessage(
            role: .assistant,
            content: chatResponse.message.content,
            tokenCount: chatResponse.eval_count,
            latencyMs: chatResponse.latencyMs ?? elapsed,
            model: config.selectedModel
        )
    }

    func singlePrompt(prompt: String, systemPrompt: String? = nil) async throws -> (response: String, latencyMs: Double, tokenCount: Int?) {
        guard connectionStatus.isConnected else {
            throw InferenceError.notConnected
        }

        var messages: [ChatMessage] = []

        if let sys = systemPrompt ?? (config.systemPrompt.isEmpty ? nil : config.systemPrompt) {
            messages.append(ChatMessage(role: .system, content: sys))
        }
        messages.append(ChatMessage(role: .user, content: prompt))

        let result = try await chat(messages: messages)
        return (response: result.content, latencyMs: result.latencyMs ?? 0, tokenCount: result.tokenCount)
    }

    // MARK: - Helpers

    private func buildOllamaMessages(from messages: [ChatMessage]) -> [OllamaChatMessage] {
        var ollamaMessages: [OllamaChatMessage] = []

        if !config.systemPrompt.isEmpty {
            let hasSystemMsg = messages.contains { $0.role == .system }
            if !hasSystemMsg {
                ollamaMessages.append(OllamaChatMessage(role: "system", content: config.systemPrompt))
            }
        }

        for msg in messages {
            ollamaMessages.append(OllamaChatMessage(role: msg.role.rawValue, content: msg.content))
        }

        return ollamaMessages
    }
}

// MARK: - Errors

enum InferenceError: LocalizedError {
    case invalidURL
    case notConnected
    case noModelSelected
    case serverError(String)
    case decodingError(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid Ollama URL"
        case .notConnected: return "Not connected to Ollama. Check that Ollama is running."
        case .noModelSelected: return "No model selected"
        case .serverError(let msg): return "Server error: \(msg)"
        case .decodingError(let msg): return "Decoding error: \(msg)"
        }
    }
}
