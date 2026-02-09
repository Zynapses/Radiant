import SwiftUI

struct SidebarView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var chatStore: ChatStore
    @State private var searchText = ""
    @State private var isSearching = false
    @State private var hoveredConversationId: String?
    @State private var editingConversationId: String?
    @State private var editingTitle = ""

    var body: some View {
        VStack(spacing: 0) {
            // New Chat Button
            Button {
                Task { await chatStore.createConversation() }
                appState.selectedSection = .chat
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "plus.bubble")
                        .font(.system(size: 14, weight: .semibold))
                    Text("New Chat")
                        .font(.system(size: 13, weight: .semibold))
                    Spacer()
                    Text("⌘N")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.tertiary)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(
                    LinearGradient(colors: [.purple.opacity(0.2), .pink.opacity(0.15)],
                                   startPoint: .leading, endPoint: .trailing)
                )
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.purple.opacity(0.3), lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 12)
            .padding(.top, 12)
            .padding(.bottom, 8)

            // Search
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 12))
                    .foregroundStyle(.tertiary)
                TextField("Search conversations...", text: $searchText)
                    .textFieldStyle(.plain)
                    .font(.system(size: 12))
                    .onSubmit {
                        Task { await chatStore.search(query: searchText) }
                    }
                if !searchText.isEmpty {
                    Button {
                        searchText = ""
                        chatStore.searchResults = []
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 12))
                            .foregroundStyle(.tertiary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .background(Color.white.opacity(0.04))
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .padding(.horizontal, 12)
            .padding(.bottom, 8)

            Divider().opacity(0.3)

            // Navigation Sections
            VStack(spacing: 2) {
                ForEach(NavigationSection.allCases) { section in
                    if section != .chat {
                        Button {
                            appState.selectedSection = section
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: section.systemImage)
                                    .font(.system(size: 13))
                                    .frame(width: 20)
                                Text(section.displayName)
                                    .font(.system(size: 13))
                                Spacer()
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .foregroundStyle(appState.selectedSection == section ? .white : .secondary)
                            .background(
                                appState.selectedSection == section
                                    ? Color.purple.opacity(0.2)
                                    : Color.clear
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)

            Divider().opacity(0.3)

            // Conversations List
            ScrollView {
                LazyVStack(spacing: 0, pinnedViews: .sectionHeaders) {
                    let displayConversations = searchText.isEmpty
                        ? chatStore.groupedConversations
                        : [("Search Results", chatStore.searchResults)]

                    ForEach(displayConversations, id: \.0) { group, conversations in
                        Section {
                            ForEach(conversations) { conversation in
                                ConversationRow(
                                    conversation: conversation,
                                    isSelected: chatStore.currentConversation?.id == conversation.id,
                                    isHovered: hoveredConversationId == conversation.id,
                                    isEditing: editingConversationId == conversation.id,
                                    editingTitle: $editingTitle,
                                    onSelect: {
                                        Task { await chatStore.selectConversation(conversation.id) }
                                        appState.selectedSection = .chat
                                    },
                                    onDelete: {
                                        Task { await chatStore.deleteConversation(conversation.id) }
                                    },
                                    onRename: {
                                        editingConversationId = conversation.id
                                        editingTitle = conversation.title
                                    },
                                    onCommitRename: {
                                        Task {
                                            await chatStore.renameConversation(conversation.id, title: editingTitle)
                                            editingConversationId = nil
                                        }
                                    },
                                    onCancelRename: {
                                        editingConversationId = nil
                                    }
                                )
                                .onHover { isHovered in
                                    hoveredConversationId = isHovered ? conversation.id : nil
                                }
                            }
                        } header: {
                            SectionHeader(title: group)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 6)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(.bar)
                        }
                    }
                }
            }
        }
        .background(Color.surfacePrimary)
    }
}

struct ConversationRow: View {
    let conversation: Conversation
    let isSelected: Bool
    let isHovered: Bool
    let isEditing: Bool
    @Binding var editingTitle: String
    let onSelect: () -> Void
    let onDelete: () -> Void
    let onRename: () -> Void
    let onCommitRename: () -> Void
    let onCancelRename: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "bubble.left")
                .font(.system(size: 12))
                .foregroundStyle(.tertiary)
                .frame(width: 16)

            if isEditing {
                TextField("", text: $editingTitle, onCommit: onCommitRename)
                    .textFieldStyle(.plain)
                    .font(.system(size: 13))
                    .onExitCommand(perform: onCancelRename)
            } else {
                VStack(alignment: .leading, spacing: 2) {
                    Text(conversation.title)
                        .font(.system(size: 13))
                        .lineLimit(1)

                    if let lastMessage = conversation.lastMessage {
                        Text(lastMessage)
                            .font(.system(size: 11))
                            .foregroundStyle(.tertiary)
                            .lineLimit(1)
                    }
                }
            }

            Spacer()

            if isHovered && !isEditing {
                HStack(spacing: 2) {
                    Button(action: onRename) {
                        Image(systemName: "pencil")
                            .font(.system(size: 10))
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(.tertiary)

                    Button(action: onDelete) {
                        Image(systemName: "trash")
                            .font(.system(size: 10))
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(.red.opacity(0.7))
                }
            } else if conversation.isFavorite {
                Image(systemName: "star.fill")
                    .font(.system(size: 10))
                    .foregroundStyle(.yellow.opacity(0.6))
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(
            isSelected
                ? Color.purple.opacity(0.15)
                : isHovered ? Color.white.opacity(0.04) : Color.clear
        )
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .padding(.horizontal, 8)
        .contentShape(Rectangle())
        .onTapGesture(perform: onSelect)
    }
}
