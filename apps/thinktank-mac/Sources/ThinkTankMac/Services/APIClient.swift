import Foundation

actor APIClient {
    static let shared = APIClient()

    let baseURL: String
    private let _baseURL: URL
    private let session: URLSession
    private var accessToken: String?
    private var refreshToken: String?
    private(set) var devMode = false

    init(baseURL: URL? = nil) {
        let url = baseURL ?? URL(string: UserDefaults.standard.string(forKey: "apiBaseURL") ?? "https://api.radiant.local")!
        self._baseURL = url
        self.baseURL = url.absoluteString
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 300
        self.session = URLSession(configuration: config)
    }

    func configure(baseURL: String, accessToken: String?, refreshToken: String?) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
    }

    func setTokens(access: String, refresh: String) {
        self.accessToken = access
        self.refreshToken = refresh
    }

    func setToken(_ token: String?) {
        self.accessToken = token
    }

    func enableDevMode() {
        self.devMode = true
    }

    func buildURL(_ path: String) -> URL {
        _baseURL.appendingPathComponent(path)
    }

    private func buildRequest(path: String, method: String = "GET", body: Data? = nil, params: [String: String]? = nil) -> URLRequest {
        var components = URLComponents(url: _baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: true)!
        if let params {
            components.queryItems = params.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        var request = URLRequest(url: components.url!)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let accessToken {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = body
        return request
    }

    func get<T: Decodable>(_ path: String, params: [String: String]? = nil) async throws -> T {
        if devMode, let mockData = MockDataProvider.resolve(path: path, method: "GET") {
            return try JSONDecoder.radiant.decode(T.self, from: mockData)
        }
        let request = buildRequest(path: path, params: params)
        let (data, response) = try await session.data(for: request)
        try validateResponse(response)
        return try JSONDecoder.radiant.decode(T.self, from: data)
    }

    func post<T: Decodable>(_ path: String, body: some Encodable) async throws -> T {
        if devMode, let mockData = MockDataProvider.resolve(path: path, method: "POST") {
            return try JSONDecoder.radiant.decode(T.self, from: mockData)
        }
        let bodyData = try JSONEncoder.radiant.encode(body)
        let request = buildRequest(path: path, method: "POST", body: bodyData)
        let (data, response) = try await session.data(for: request)
        try validateResponse(response)
        return try JSONDecoder.radiant.decode(T.self, from: data)
    }

    func put<T: Decodable>(_ path: String, body: some Encodable) async throws -> T {
        if devMode, let mockData = MockDataProvider.resolve(path: path, method: "PUT") {
            return try JSONDecoder.radiant.decode(T.self, from: mockData)
        }
        let bodyData = try JSONEncoder.radiant.encode(body)
        let request = buildRequest(path: path, method: "PUT", body: bodyData)
        let (data, response) = try await session.data(for: request)
        try validateResponse(response)
        return try JSONDecoder.radiant.decode(T.self, from: data)
    }

    func delete(_ path: String) async throws {
        if devMode { return }
        let request = buildRequest(path: path, method: "DELETE")
        let (_, response) = try await session.data(for: request)
        try validateResponse(response)
    }

    func stream(_ path: String, body: some Encodable) -> AsyncThrowingStream<StreamChunk, Error> {
        if devMode {
            return AsyncThrowingStream { continuation in
                Task {
                    // Simulate streaming response in dev mode
                    let words = ["I'd ", "be ", "happy ", "to ", "help ", "with ", "that. ", "Let ", "me ", "think ", "through ", "this ", "carefully...\n\n", "Here's ", "my ", "analysis ", "of ", "the ", "problem:\n\n", "The ", "key ", "insight ", "is ", "that ", "you ", "need ", "to ", "consider ", "both ", "the ", "performance ", "and ", "cost ", "implications. ", "I'd ", "recommend ", "starting ", "with ", "a ", "balanced ", "approach ", "and ", "iterating ", "from ", "there."]
                    for word in words {
                        try await Task.sleep(nanoseconds: 30_000_000) // 30ms per word
                        continuation.yield(.content(word))
                    }
                    continuation.yield(.metadata(MessageMetadata(tokensUsed: 156, latencyMs: 620, orchestrationMode: "thinking", costEstimate: 0.0005, modelUsed: "claude-4-sonnet")))
                    continuation.yield(.done)
                    continuation.finish()
                }
            }
        }
        return AsyncThrowingStream { continuation in
            Task {
                do {
                    let bodyData = try JSONEncoder.radiant.encode(body)
                    let request = buildRequest(path: path, method: "POST", body: bodyData)
                    let (bytes, response) = try await session.bytes(for: request)
                    try validateResponse(response)

                    var buffer = ""
                    for try await byte in bytes {
                        let char = String(UnicodeScalar(byte))
                        buffer += char
                        if char == "\n" {
                            let line = buffer.trimmingCharacters(in: .whitespacesAndNewlines)
                            buffer = ""
                            if line.hasPrefix("data: ") {
                                let payload = String(line.dropFirst(6))
                                if payload == "[DONE]" {
                                    continuation.yield(.done)
                                } else if let data = payload.data(using: .utf8) {
                                    if let content = try? JSONDecoder.radiant.decode(StreamContent.self, from: data) {
                                        if let text = content.content {
                                            continuation.yield(.content(text))
                                        }
                                        if let meta = content.metadata {
                                            continuation.yield(.metadata(meta))
                                        }
                                    }
                                }
                            }
                        }
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    private func validateResponse(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else {
            throw APIError(code: "INVALID_RESPONSE", message: "Invalid response type")
        }
        guard (200...299).contains(http.statusCode) else {
            throw APIError(code: "HTTP_\(http.statusCode)", message: "Request failed with status \(http.statusCode)")
        }
    }
}

private struct StreamContent: Decodable {
    let content: String?
    let metadata: MessageMetadata?
}

extension JSONDecoder {
    static let radiant: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        d.dateDecodingStrategy = .iso8601
        return d
    }()
}

extension JSONEncoder {
    static let radiant: JSONEncoder = {
        let e = JSONEncoder()
        e.keyEncodingStrategy = .convertToSnakeCase
        e.dateEncodingStrategy = .iso8601
        return e
    }()
}
