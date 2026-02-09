import SwiftUI

struct HistoryView: View {
    @EnvironmentObject var chatStore: ChatStore
    @EnvironmentObject var appState: AppState
    @State private var searchText = ""
    @State private var sortOrder: SortOrder = .newest
    @State private var filterDomain: String?

    enum SortOrder: String, CaseIterable {
        case newest = "Newest"
        case oldest = "Oldest"
        case mostMessages = "Most Messages"
    }

    private var filteredConversations: [Conversation] {
        var result = chatStore.conversations

        if !searchText.isEmpty {
            result = result.filter {
                $0.title.localizedCaseInsensitiveContains(searchText) ||
                ($0.lastMessage?.localizedCaseInsensitiveContains(searchText) ?? false)
            }
        }

        if let domain = filterDomain {
            result = result.filter { $0.domainMode == domain }
        }

        switch sortOrder {
        case .newest:
            result.sort { $0.updatedAt > $1.updatedAt }
        case .oldest:
            result.sort { $0.updatedAt < $1.updatedAt }
        case .mostMessages:
            result.sort { $0.messageCount > $1.messageCount }
        }

        return result
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("History")
                        .font(.system(size: 18, weight: .bold))
                    Text("\(chatStore.conversations.count) conversations")
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Picker("Sort", selection: $sortOrder) {
                    ForEach(SortOrder.allCases, id: \.self) { order in
                        Text(order.rawValue).tag(order)
                    }
                }
                .pickerStyle(.menu)
                .frame(width: 150)
            }
            .padding()

            // Search
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.tertiary)
                TextField("Search history...", text: $searchText)
                    .textFieldStyle(.plain)
            }
            .padding(8)
            .background(Color.white.opacity(0.04))
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .padding(.horizontal)
            .padding(.bottom, 8)

            Divider().opacity(0.3)

            // Conversation List
            if filteredConversations.isEmpty {
                EmptyStateView(
                    icon: "clock",
                    title: "No conversations found",
                    message: searchText.isEmpty ? "Start chatting to build your history." : "No matches for \"\(searchText)\""
                )
            } else {
                ScrollView {
                    LazyVStack(spacing: 4) {
                        ForEach(filteredConversations) { conversation in
                            HistoryRow(conversation: conversation) {
                                Task { await chatStore.selectConversation(conversation.id) }
                                appState.selectedSection = .chat
                            } onDelete: {
                                Task { await chatStore.deleteConversation(conversation.id) }
                            }
                        }
                    }
                    .padding()
                }
            }
        }
    }
}

struct HistoryRow: View {
    let conversation: Conversation
    let onSelect: () -> Void
    let onDelete: () -> Void
    @State private var isHovered = false

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(conversation.title)
                        .font(.system(size: 13, weight: .medium))
                        .lineLimit(1)

                    if conversation.isFavorite {
                        Image(systemName: "star.fill")
                            .font(.system(size: 10))
                            .foregroundStyle(.yellow)
                    }
                }

                HStack(spacing: 8) {
                    Text(conversation.updatedAt, style: .relative)
                        .font(.system(size: 11))
                        .foregroundStyle(.tertiary)

                    Text("\(conversation.messageCount) messages")
                        .font(.system(size: 11))
                        .foregroundStyle(.tertiary)

                    if let domain = conversation.domainMode {
                        BadgeView(text: domain, size: .small)
                    }
                }

                if let last = conversation.lastMessage {
                    Text(last)
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer()

            if isHovered {
                HStack(spacing: 4) {
                    Button(action: onSelect) {
                        Image(systemName: "arrow.right.circle")
                            .font(.system(size: 14))
                            .foregroundStyle(.purple)
                    }
                    .buttonStyle(.plain)
                    .help("Open conversation")

                    Button(action: onDelete) {
                        Image(systemName: "trash")
                            .font(.system(size: 12))
                            .foregroundStyle(.red.opacity(0.7))
                    }
                    .buttonStyle(.plain)
                    .help("Delete")
                }
            }
        }
        .padding(10)
        .background(isHovered ? Color.white.opacity(0.04) : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .onHover { isHovered = $0 }
        .contentShape(Rectangle())
        .onTapGesture(perform: onSelect)
    }
}
