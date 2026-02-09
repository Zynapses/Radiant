import Foundation

actor ChatService {
    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    // MARK: - Conversations

    func listConversations(page: Int = 1, pageSize: Int = 50) async throws -> [Conversation] {
        let response: APIResponse<[Conversation]> = try await api.get(
            "/api/thinktank/conversations",
            params: ["page": "\(page)", "pageSize": "\(pageSize)"]
        )
        return response.data
    }

    func getConversation(_ id: String) async throws -> Conversation {
        let response: APIResponse<Conversation> = try await api.get("/api/thinktank/conversations/\(id)")
        return response.data
    }

    func createConversation(title: String? = nil, domainMode: String? = nil) async throws -> Conversation {
        struct Body: Encodable {
            let title: String?
            let domainMode: String?
        }
        let response: APIResponse<Conversation> = try await api.post(
            "/api/thinktank/conversations",
            body: Body(title: title, domainMode: domainMode)
        )
        return response.data
    }

    func deleteConversation(_ id: String) async throws {
        try await api.delete("/api/thinktank/conversations/\(id)")
    }

    func updateConversation(_ id: String, title: String) async throws -> Conversation {
        struct Body: Encodable { let title: String }
        let response: APIResponse<Conversation> = try await api.put(
            "/api/thinktank/conversations/\(id)",
            body: Body(title: title)
        )
        return response.data
    }

    // MARK: - Messages

    func getMessages(conversationId: String) async throws -> [ChatMessage] {
        let response: APIResponse<[ChatMessage]> = try await api.get(
            "/api/thinktank/conversations/\(conversationId)/messages"
        )
        return response.data
    }

    func sendMessage(conversationId: String, content: String, modelId: String? = nil, attachments: [String]? = nil) async throws -> ChatMessage {
        struct Body: Encodable {
            let content: String
            let modelId: String?
            let attachments: [String]?
        }
        let response: APIResponse<ChatMessage> = try await api.post(
            "/api/thinktank/conversations/\(conversationId)/messages",
            body: Body(content: content, modelId: modelId, attachments: attachments)
        )
        return response.data
    }

    func streamMessage(conversationId: String, content: String, modelId: String? = nil) async -> AsyncThrowingStream<StreamChunk, Error> {
        struct Body: Encodable {
            let content: String
            let modelId: String?
            let stream: Bool
        }
        return await api.stream(
            "/api/thinktank/conversations/\(conversationId)/messages",
            body: Body(content: content, modelId: modelId, stream: true)
        )
    }

    func rateMessage(conversationId: String, messageId: String, positive: Bool) async throws {
        struct Body: Encodable { let rating: String }
        let _: APIResponse<[String: String]> = try await api.post(
            "/api/thinktank/conversations/\(conversationId)/messages/\(messageId)/rate",
            body: Body(rating: positive ? "positive" : "negative")
        )
    }

    func regenerateMessage(conversationId: String, messageId: String) async -> AsyncThrowingStream<StreamChunk, Error> {
        struct Body: Encodable {
            let messageId: String
            let stream: Bool
        }
        return await api.stream(
            "/api/thinktank/conversations/\(conversationId)/regenerate",
            body: Body(messageId: messageId, stream: true)
        )
    }

    // MARK: - Search

    func searchConversations(query: String) async throws -> [Conversation] {
        let response: APIResponse<[Conversation]> = try await api.get(
            "/api/thinktank/conversations/search",
            params: ["q": query]
        )
        return response.data
    }

    // MARK: - Export

    func exportConversation(_ id: String, format: ExportFormat) async throws -> Data {
        try await api.get("/api/thinktank/conversations/\(id)/export", params: ["format": format.rawValue])
    }
}
