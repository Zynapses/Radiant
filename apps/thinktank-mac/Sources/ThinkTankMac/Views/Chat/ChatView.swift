import SwiftUI

struct ChatView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var chatStore: ChatStore
    @EnvironmentObject var settingsStore: SettingsStore
    @State private var showBrainPlan = false
    @State private var showTimeMachine = false
    @State private var showAxiomForge = false
    @State private var hoveredMessageId: String?
    @State private var scrollProxy: ScrollViewProxy?

    var body: some View {
        VStack(spacing: 0) {
            // Header
            chatHeader

            // Messages or Empty State
            if chatStore.messages.isEmpty && chatStore.currentConversation == nil {
                welcomeState
            } else if chatStore.messages.isEmpty {
                EmptyStateView(
                    icon: "bubble.left.and.bubble.right",
                    title: "Start a conversation",
                    message: "Type a message below to begin chatting with AI."
                )
            } else {
                messageList
            }

            // Input
            ChatInputView()
        }
        .sheet(isPresented: $showBrainPlan) {
            BrainPlanViewer(conversationId: chatStore.currentConversation?.id ?? "")
                .frame(minWidth: 500, minHeight: 400)
        }
        .sheet(isPresented: $showTimeMachine) {
            TimeMachineView(conversationId: chatStore.currentConversation?.id ?? "")
                .frame(minWidth: 600, minHeight: 400)
        }
        .sheet(isPresented: $showAxiomForge) {
            AxiomForgeView()
                .frame(minWidth: 550, minHeight: 500)
        }
    }

    // MARK: - Header

    private var chatHeader: some View {
        HStack(spacing: 12) {
            if let conversation = chatStore.currentConversation {
                Text(conversation.title)
                    .font(.system(size: 14, weight: .semibold))
                    .lineLimit(1)
            } else {
                Text("Think Tank")
                    .font(.system(size: 14, weight: .semibold))
            }

            Spacer()

            // Cartridge Indicator
            CartridgeIndicatorView(compact: true)

            // Cato Mood (compact)
            if appState.advancedMode {
                CatoMoodSelectorView(selectedMood: $settingsStore.catoMood, variant: .compact)
            }

            // Domain Selector
            if appState.advancedMode {
                DomainSelectorView()
            }

            // Model Selector
            ModelSelectorView()

            Divider()
                .frame(height: 20)
                .opacity(0.3)

            // Advanced Mode Toggle
            Button {
                appState.advancedMode.toggle()
            } label: {
                Image(systemName: appState.advancedMode ? "brain.head.profile" : "brain")
                    .font(.system(size: 13))
                    .foregroundStyle(appState.advancedMode ? .purple : .secondary)
            }
            .buttonStyle(.plain)
            .help("Toggle Advanced Mode (⇧⌘D)")

            // Time Machine
            if appState.advancedMode {
                Button { showTimeMachine = true } label: {
                    Image(systemName: "clock.arrow.circlepath")
                        .font(.system(size: 13))
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .help("Time Machine")
            }

            // AXIOM Forge
            if appState.advancedMode {
                Button { showAxiomForge = true } label: {
                    Image(systemName: "wand.and.stars")
                        .font(.system(size: 13))
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .help("AXIOM Forge")
            }

            // Focus Mode
            Button {
                appState.focusMode.toggle()
            } label: {
                Image(systemName: appState.focusMode ? "eye.slash" : "eye")
                    .font(.system(size: 13))
                    .foregroundStyle(appState.focusMode ? .orange : .secondary)
            }
            .buttonStyle(.plain)
            .help("Toggle Focus Mode (⇧⌘F)")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(.ultraThinMaterial)
        .overlay(alignment: .bottom) {
            Divider().opacity(0.3)
        }
    }

    // MARK: - Welcome State

    private var welcomeState: some View {
        VStack(spacing: 24) {
            Spacer()

            VStack(spacing: 12) {
                Image(systemName: "sparkles")
                    .font(.system(size: 48))
                    .foregroundStyle(
                        LinearGradient(colors: [.purple, .pink], startPoint: .topLeading, endPoint: .bottomTrailing)
                    )

                Text("Welcome to Think Tank")
                    .font(.system(size: 22, weight: .bold))

                Text("Your AI-powered thinking companion.\nStart a conversation or explore the features below.")
                    .font(.system(size: 14))
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            HStack(spacing: 16) {
                QuickActionCard(icon: "wand.and.stars", title: "AXIOM Forge", subtitle: "Optimize your prompt") {
                    showAxiomForge = true
                }
                QuickActionCard(icon: "brain.head.profile", title: "Advanced Mode", subtitle: "See AI reasoning") {
                    appState.advancedMode = true
                }
                QuickActionCard(icon: "list.bullet.clipboard", title: "My Rules", subtitle: "Personalize responses") {
                    appState.selectedSection = .rules
                }
            }
            .padding(.horizontal, 40)

            Spacer()
        }
    }

    // MARK: - Message List

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(chatStore.messages) { message in
                        MessageBubbleView(
                            message: message,
                            showMetadata: appState.advancedMode,
                            isStreaming: chatStore.isStreaming && message.id == chatStore.messages.last?.id && message.role == .assistant,
                            isHovered: hoveredMessageId == message.id,
                            onRate: { positive in
                                Task { await chatStore.rateMessage(message.id, positive: positive) }
                            },
                            onRegenerate: {
                                Task { await chatStore.regenerateMessage(message.id) }
                            },
                            onViewBrainPlan: {
                                showBrainPlan = true
                            }
                        )
                        .id(message.id)
                        .onHover { isHovered in
                            hoveredMessageId = isHovered ? message.id : nil
                        }
                    }

                    if chatStore.isStreaming {
                        HStack {
                            TypingIndicator()
                            Spacer()
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 8)
                    }
                }
                .padding(.vertical, 16)
            }
            .onChange(of: chatStore.messages.count) { _, _ in
                if let lastId = chatStore.messages.last?.id {
                    withAnimation(.easeOut(duration: 0.2)) {
                        proxy.scrollTo(lastId, anchor: .bottom)
                    }
                }
            }
        }
    }
}

// MARK: - Quick Action Card

struct QuickActionCard: View {
    let icon: String
    let title: String
    let subtitle: String
    let action: () -> Void
    @State private var isHovered = false

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 24))
                    .foregroundStyle(.purple)

                Text(title)
                    .font(.system(size: 13, weight: .semibold))

                Text(subtitle)
                    .font(.system(size: 11))
                    .foregroundStyle(.tertiary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 20)
            .glassCard()
            .scaleEffect(isHovered ? 1.02 : 1.0)
        }
        .buttonStyle(.plain)
        .onHover { isHovered = $0 }
        .animation(.spring(response: 0.3), value: isHovered)
    }
}
