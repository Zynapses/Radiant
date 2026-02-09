import Foundation
import SwiftUI
import Combine

@MainActor
final class ChatStore: ObservableObject {
    // MARK: - Conversations
    @Published var conversations: [Conversation] = []
    @Published var currentConversation: Conversation?
    @Published var messages: [ChatMessage] = []

    // MARK: - Input State
    @Published var isStreaming: Bool = false
    @Published var streamingContent: String = ""
    @Published var isTyping: Bool = false

    // MARK: - Search
    @Published var searchQuery: String = ""
    @Published var searchResults: [Conversation] = []

    // MARK: - Error
    @Published var error: String?

    private let chatService = ChatService()

    // MARK: - Conversation Management

    func loadConversations() async {
        do {
            conversations = try await chatService.listConversations()
        } catch {
            self.error = "Failed to load conversations: \(error.localizedDescription)"
        }
    }

    func selectConversation(_ id: String) async {
        do {
            let conversation = try await chatService.getConversation(id)
            currentConversation = conversation
            messages = try await chatService.getMessages(conversationId: id)
        } catch {
            self.error = "Failed to load conversation: \(error.localizedDescription)"
        }
    }

    func createConversation(title: String? = nil, domainMode: String? = nil) async {
        do {
            let conversation = try await chatService.createConversation(title: title, domainMode: domainMode)
            conversations.insert(conversation, at: 0)
            currentConversation = conversation
            messages = []
        } catch {
            self.error = "Failed to create conversation: \(error.localizedDescription)"
        }
    }

    func deleteConversation(_ id: String) async {
        do {
            try await chatService.deleteConversation(id)
            conversations.removeAll { $0.id == id }
            if currentConversation?.id == id {
                currentConversation = nil
                messages = []
            }
        } catch {
            self.error = "Failed to delete conversation: \(error.localizedDescription)"
        }
    }

    func renameConversation(_ id: String, title: String) async {
        do {
            let updated = try await chatService.updateConversation(id, title: title)
            if let idx = conversations.firstIndex(where: { $0.id == id }) {
                conversations[idx] = updated
            }
            if currentConversation?.id == id {
                currentConversation = updated
            }
        } catch {
            self.error = "Failed to rename conversation: \(error.localizedDescription)"
        }
    }

    // MARK: - Messaging

    func sendMessage(content: String, modelId: String? = nil, stream: Bool = true) async {
        guard let conversationId = currentConversation?.id else {
            await createConversation()
            guard let newId = currentConversation?.id else { return }
            await sendMessageToConversation(newId, content: content, modelId: modelId, stream: stream)
            return
        }
        await sendMessageToConversation(conversationId, content: content, modelId: modelId, stream: stream)
    }

    private func sendMessageToConversation(_ conversationId: String, content: String, modelId: String?, stream: Bool) async {
        let userMessage = ChatMessage(role: .user, content: content)
        messages.append(userMessage)

        if stream {
            await streamResponse(conversationId: conversationId, content: content, modelId: modelId)
        } else {
            do {
                let response = try await chatService.sendMessage(
                    conversationId: conversationId,
                    content: content,
                    modelId: modelId
                )
                messages.append(response)
            } catch {
                self.error = "Failed to send message: \(error.localizedDescription)"
            }
        }
    }

    private func streamResponse(conversationId: String, content: String, modelId: String?) async {
        isStreaming = true
        streamingContent = ""

        let placeholderId = UUID().uuidString
        let placeholder = ChatMessage(id: placeholderId, role: .assistant, content: "")
        messages.append(placeholder)

        do {
            let stream = await chatService.streamMessage(
                conversationId: conversationId,
                content: content,
                modelId: modelId
            )

            var fullContent = ""
            var metadata: MessageMetadata?

            for try await chunk in stream {
                switch chunk {
                case .content(let text):
                    fullContent += text
                    streamingContent = fullContent
                    if let idx = messages.firstIndex(where: { $0.id == placeholderId }) {
                        messages[idx].content = fullContent
                    }
                case .metadata(let meta):
                    metadata = meta
                case .done:
                    if let idx = messages.firstIndex(where: { $0.id == placeholderId }) {
                        messages[idx].metadata = metadata
                    }
                case .planUpdate:
                    break
                case .error(let errorMsg):
                    self.error = errorMsg
                }
            }
        } catch {
            self.error = "Stream error: \(error.localizedDescription)"
        }

        isStreaming = false
        streamingContent = ""
    }

    func rateMessage(_ messageId: String, positive: Bool) async {
        guard let conversationId = currentConversation?.id else { return }
        do {
            try await chatService.rateMessage(conversationId: conversationId, messageId: messageId, positive: positive)
        } catch {
            self.error = "Failed to rate message: \(error.localizedDescription)"
        }
    }

    func regenerateMessage(_ messageId: String) async {
        guard let conversationId = currentConversation?.id else { return }
        isStreaming = true
        streamingContent = ""

        if let idx = messages.firstIndex(where: { $0.id == messageId }) {
            messages[idx].content = ""
        }

        do {
            let stream = await chatService.regenerateMessage(conversationId: conversationId, messageId: messageId)
            var fullContent = ""

            for try await chunk in stream {
                switch chunk {
                case .content(let text):
                    fullContent += text
                    if let idx = messages.firstIndex(where: { $0.id == messageId }) {
                        messages[idx].content = fullContent
                    }
                case .metadata(let meta):
                    if let idx = messages.firstIndex(where: { $0.id == messageId }) {
                        messages[idx].metadata = meta
                    }
                case .done, .planUpdate:
                    break
                case .error(let errorMsg):
                    self.error = errorMsg
                }
            }
        } catch {
            self.error = "Regeneration error: \(error.localizedDescription)"
        }

        isStreaming = false
    }

    // MARK: - Search

    func search(query: String) async {
        guard !query.isEmpty else {
            searchResults = []
            return
        }
        do {
            searchResults = try await chatService.searchConversations(query: query)
        } catch {
            self.error = "Search failed: \(error.localizedDescription)"
        }
    }

    // MARK: - Grouping

    var groupedConversations: [(String, [Conversation])] {
        let calendar = Calendar.current
        let now = Date()
        var groups: [String: [Conversation]] = [:]

        for conv in conversations {
            let key: String
            if calendar.isDateInToday(conv.updatedAt) {
                key = "Today"
            } else if calendar.isDateInYesterday(conv.updatedAt) {
                key = "Yesterday"
            } else if let daysAgo = calendar.dateComponents([.day], from: conv.updatedAt, to: now).day, daysAgo < 7 {
                key = "This Week"
            } else if let daysAgo = calendar.dateComponents([.day], from: conv.updatedAt, to: now).day, daysAgo < 30 {
                key = "This Month"
            } else {
                key = "Older"
            }
            groups[key, default: []].append(conv)
        }

        let order = ["Today", "Yesterday", "This Week", "This Month", "Older"]
        return order.compactMap { key in
            guard let items = groups[key], !items.isEmpty else { return nil }
            return (key, items.sorted { $0.updatedAt > $1.updatedAt })
        }
    }

    func clearError() {
        error = nil
    }
}
