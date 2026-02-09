import SwiftUI

struct MessageBubbleView: View {
    let message: ChatMessage
    let showMetadata: Bool
    let isStreaming: Bool
    let isHovered: Bool
    let onRate: (Bool) -> Void
    let onRegenerate: () -> Void
    let onViewBrainPlan: () -> Void

    @State private var copied = false

    private var isUser: Bool { message.role == .user }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if !isUser {
                assistantAvatar
            }

            VStack(alignment: isUser ? .trailing : .leading, spacing: 4) {
                // Message bubble
                HStack {
                    if isUser { Spacer(minLength: 80) }

                    Text(message.content.isEmpty && isStreaming ? " " : message.content)
                        .font(.system(size: 13))
                        .lineSpacing(4)
                        .textSelection(.enabled)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(
                            isUser
                                ? AnyShapeStyle(LinearGradient(colors: [.purple, .pink], startPoint: .leading, endPoint: .trailing))
                                : AnyShapeStyle(Color.white.opacity(0.06))
                        )
                        .foregroundStyle(isUser ? .white : .primary)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                        .overlay(
                            isUser
                                ? nil
                                : RoundedRectangle(cornerRadius: 16)
                                    .stroke(Color.white.opacity(0.04), lineWidth: 1)
                        )
                        .overlay(alignment: .bottomTrailing) {
                            if isStreaming {
                                streamingCursor
                            }
                        }

                    if !isUser { Spacer(minLength: 80) }
                }

                // Metadata
                if showMetadata, let meta = message.metadata, !isUser {
                    metadataRow(meta)
                }

                // Actions
                if !isUser && !isStreaming && isHovered {
                    actionButtons
                }
            }

            if isUser {
                userAvatar
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 4)
    }

    // MARK: - Avatars

    private var assistantAvatar: some View {
        ZStack {
            Circle()
                .fill(
                    LinearGradient(colors: [.purple, .pink], startPoint: .topLeading, endPoint: .bottomTrailing)
                )
            Image(systemName: "sparkles")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.white)
        }
        .frame(width: 28, height: 28)
        .shadow(color: .purple.opacity(0.3), radius: 6, y: 2)
    }

    private var userAvatar: some View {
        ZStack {
            Circle()
                .fill(
                    LinearGradient(colors: [.blue, .cyan], startPoint: .topLeading, endPoint: .bottomTrailing)
                )
            Text("U")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.white)
        }
        .frame(width: 28, height: 28)
        .shadow(color: .blue.opacity(0.3), radius: 6, y: 2)
    }

    // MARK: - Streaming Cursor

    private var streamingCursor: some View {
        RoundedRectangle(cornerRadius: 1)
            .fill(Color.purple.opacity(0.6))
            .frame(width: 2, height: 14)
            .opacity(isStreaming ? 1 : 0)
            .animation(.easeInOut(duration: 0.5).repeatForever(), value: isStreaming)
            .padding(.trailing, 6)
            .padding(.bottom, 6)
    }

    // MARK: - Metadata

    private func metadataRow(_ meta: MessageMetadata) -> some View {
        HStack(spacing: 8) {
            if let model = meta.modelUsed {
                BadgeView(text: model, size: .small)
            }
            if let tokens = meta.tokensUsed {
                Text("\(tokens) tokens")
                    .font(.system(size: 10))
                    .foregroundStyle(.tertiary)
            }
            if let latency = meta.latencyMs {
                Text("\(latency)ms")
                    .font(.system(size: 10))
                    .foregroundStyle(.tertiary)
            }
            if let cost = meta.costEstimate {
                Text("$\(cost, specifier: "%.4f")")
                    .font(.system(size: 10))
                    .foregroundStyle(.tertiary)
            }
        }
        .transition(.opacity.combined(with: .move(edge: .top)))
    }

    // MARK: - Action Buttons

    private var actionButtons: some View {
        HStack(spacing: 2) {
            Button {
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(message.content, forType: .string)
                copied = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) { copied = false }
            } label: {
                Image(systemName: copied ? "checkmark" : "doc.on.doc")
                    .font(.system(size: 11))
                    .foregroundStyle(copied ? .green : .secondary)
                    .frame(width: 24, height: 24)
            }
            .buttonStyle(.plain)
            .help("Copy")

            Button { onRate(true) } label: {
                Image(systemName: "hand.thumbsup")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .frame(width: 24, height: 24)
            }
            .buttonStyle(.plain)
            .help("Good response")

            Button { onRate(false) } label: {
                Image(systemName: "hand.thumbsdown")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .frame(width: 24, height: 24)
            }
            .buttonStyle(.plain)
            .help("Bad response")

            Button(action: onRegenerate) {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .frame(width: 24, height: 24)
            }
            .buttonStyle(.plain)
            .help("Regenerate")

            if showMetadata, message.metadata?.brainPlanId != nil {
                Button(action: onViewBrainPlan) {
                    Image(systemName: "brain")
                        .font(.system(size: 11))
                        .foregroundStyle(.purple)
                        .frame(width: 24, height: 24)
                }
                .buttonStyle(.plain)
                .help("View Brain Plan")
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .glassCard(cornerRadius: 8)
        .transition(.opacity)
    }
}
