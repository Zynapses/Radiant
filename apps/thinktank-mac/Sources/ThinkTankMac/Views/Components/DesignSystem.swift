import SwiftUI

// MARK: - Glass Card (Glassmorphism)

struct GlassCard<Content: View>: View {
    let content: Content
    var cornerRadius: CGFloat = 16
    var padding: CGFloat = 16

    init(cornerRadius: CGFloat = 16, padding: CGFloat = 16, @ViewBuilder content: () -> Content) {
        self.content = content()
        self.cornerRadius = cornerRadius
        self.padding = padding
    }

    var body: some View {
        content
            .padding(padding)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(Color.white.opacity(0.06), lineWidth: 1)
            )
    }
}

// MARK: - Aurora Background

struct AuroraBackground: View {
    @State private var animateGradient = false

    var body: some View {
        ZStack {
            Color(nsColor: NSColor(red: 0.04, green: 0.04, blue: 0.06, alpha: 1))

            EllipticalGradient(
                colors: [
                    Color.purple.opacity(0.15),
                    Color.clear,
                ],
                center: .topLeading,
                startRadiusFraction: 0,
                endRadiusFraction: 0.8
            )
            .offset(x: animateGradient ? 20 : -20, y: animateGradient ? -10 : 10)

            EllipticalGradient(
                colors: [
                    Color.blue.opacity(0.1),
                    Color.clear,
                ],
                center: .bottomTrailing,
                startRadiusFraction: 0,
                endRadiusFraction: 0.6
            )
            .offset(x: animateGradient ? -15 : 15, y: animateGradient ? 15 : -15)
        }
        .ignoresSafeArea()
        .onAppear {
            withAnimation(.easeInOut(duration: 8).repeatForever(autoreverses: true)) {
                animateGradient = true
            }
        }
    }
}

// MARK: - Gradient Button

struct GradientButton: View {
    let title: String
    let icon: String?
    let action: () -> Void
    var isLoading: Bool = false
    var style: GradientButtonStyle = .primary

    enum GradientButtonStyle {
        case primary
        case secondary
        case danger

        var gradient: LinearGradient {
            switch self {
            case .primary:
                return LinearGradient(colors: [.purple, .pink], startPoint: .leading, endPoint: .trailing)
            case .secondary:
                return LinearGradient(colors: [.blue, .cyan], startPoint: .leading, endPoint: .trailing)
            case .danger:
                return LinearGradient(colors: [.red, .orange], startPoint: .leading, endPoint: .trailing)
            }
        }
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if isLoading {
                    ProgressView()
                        .controlSize(.small)
                        .tint(.white)
                } else {
                    if let icon {
                        Image(systemName: icon)
                            .font(.system(size: 12, weight: .semibold))
                    }
                    Text(title)
                        .font(.system(size: 13, weight: .semibold))
                }
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(style.gradient)
            .clipShape(Capsule())
            .shadow(color: .purple.opacity(0.3), radius: 8, y: 4)
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
    }
}

// MARK: - Badge View

struct BadgeView: View {
    let text: String
    var color: Color = .purple
    var size: BadgeSize = .regular

    enum BadgeSize {
        case small, regular

        var font: Font {
            switch self {
            case .small: return .system(size: 10, weight: .medium)
            case .regular: return .system(size: 11, weight: .medium)
            }
        }

        var padding: EdgeInsets {
            switch self {
            case .small: return EdgeInsets(top: 2, leading: 6, bottom: 2, trailing: 6)
            case .regular: return EdgeInsets(top: 3, leading: 8, bottom: 3, trailing: 8)
            }
        }
    }

    var body: some View {
        Text(text)
            .font(size.font)
            .foregroundStyle(color)
            .padding(size.padding)
            .background(color.opacity(0.15))
            .clipShape(Capsule())
    }
}

// MARK: - Typing Indicator

struct TypingIndicator: View {
    @State private var dotOffset: [CGFloat] = [0, 0, 0]

    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<3, id: \.self) { index in
                Circle()
                    .fill(Color.purple.opacity(0.6))
                    .frame(width: 6, height: 6)
                    .offset(y: dotOffset[index])
            }
        }
        .onAppear {
            for i in 0..<3 {
                withAnimation(.easeInOut(duration: 0.5).repeatForever().delay(Double(i) * 0.15)) {
                    dotOffset[i] = -6
                }
            }
        }
    }
}

// MARK: - Section Header

struct SectionHeader: View {
    let title: String
    var subtitle: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .tracking(0.5)
            if let subtitle {
                Text(subtitle)
                    .font(.system(size: 11))
                    .foregroundStyle(.tertiary)
            }
        }
    }
}

// MARK: - Empty State

struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundStyle(.tertiary)

            VStack(spacing: 6) {
                Text(title)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.secondary)

                Text(message)
                    .font(.system(size: 13))
                    .foregroundStyle(.tertiary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 300)
            }

            if let actionTitle, let action {
                GradientButton(title: actionTitle, icon: "plus", action: action)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Shimmer Loading

struct ShimmerView: View {
    @State private var phase: CGFloat = 0

    var body: some View {
        RoundedRectangle(cornerRadius: 8)
            .fill(Color.white.opacity(0.05))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .fill(
                        LinearGradient(
                            colors: [.clear, .white.opacity(0.05), .clear],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .offset(x: phase)
            )
            .clipped()
            .onAppear {
                withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                    phase = 300
                }
            }
    }
}

// MARK: - View Modifiers

struct GlassCardModifier: ViewModifier {
    var cornerRadius: CGFloat = 12

    func body(content: Content) -> some View {
        content
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(Color.white.opacity(0.06), lineWidth: 1)
            )
    }
}

extension View {
    func glassCard(cornerRadius: CGFloat = 12) -> some View {
        modifier(GlassCardModifier(cornerRadius: cornerRadius))
    }
}

// MARK: - Color Extensions

extension Color {
    static let radiantPurple = Color(red: 0.56, green: 0.27, blue: 0.96)
    static let radiantPink = Color(red: 0.85, green: 0.27, blue: 0.83)
    static let radiantBlue = Color(red: 0.25, green: 0.48, blue: 0.98)
    static let radiantCyan = Color(red: 0.20, green: 0.80, blue: 0.90)
    static let surfacePrimary = Color(red: 0.06, green: 0.06, blue: 0.09)
    static let surfaceSecondary = Color(red: 0.08, green: 0.08, blue: 0.12)
    static let surfaceTertiary = Color(red: 0.10, green: 0.10, blue: 0.14)
}
