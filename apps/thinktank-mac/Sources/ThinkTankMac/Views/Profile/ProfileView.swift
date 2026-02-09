import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var appState: AppState
    @State private var analytics: UserAnalytics?
    @State private var achievements: [Achievement] = []
    @State private var isLoading = true
    @State private var selectedTab = ProfileTab.overview

    private let analyticsService = AnalyticsService()

    enum ProfileTab: String, CaseIterable {
        case overview = "Overview"
        case achievements = "Achievements"
        case usage = "Usage"
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack(spacing: 16) {
                ZStack {
                    Circle()
                        .fill(LinearGradient(colors: [.purple, .pink], startPoint: .topLeading, endPoint: .bottomTrailing))
                    Text(String(appState.userDisplayName?.prefix(1) ?? "U"))
                        .font(.system(size: 24, weight: .bold))
                        .foregroundStyle(.white)
                }
                .frame(width: 56, height: 56)

                VStack(alignment: .leading, spacing: 4) {
                    Text(appState.userDisplayName ?? "User")
                        .font(.system(size: 18, weight: .bold))
                    if let analytics {
                        Text("\(analytics.totalConversations) conversations | \(analytics.achievementsUnlocked) achievements")
                            .font(.system(size: 12))
                            .foregroundStyle(.secondary)
                    }
                }

                Spacer()

                Picker("", selection: $selectedTab) {
                    ForEach(ProfileTab.allCases, id: \.self) { tab in
                        Text(tab.rawValue).tag(tab)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 300)
            }
            .padding()

            Divider().opacity(0.3)

            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                switch selectedTab {
                case .overview:
                    overviewTab
                case .achievements:
                    achievementsTab
                case .usage:
                    usageTab
                }
            }
        }
        .task {
            isLoading = true
            do {
                async let analyticsTask = analyticsService.getAnalytics()
                async let achievementsTask = analyticsService.getAchievements()
                let (a, ach) = try await (analyticsTask, achievementsTask)
                analytics = a
                achievements = ach
            } catch {
                // Graceful fallback
            }
            isLoading = false
        }
    }

    private var overviewTab: some View {
        ScrollView {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 180))], spacing: 12) {
                if let analytics {
                    StatCard(title: "Conversations", value: "\(analytics.totalConversations)", icon: "bubble.left.and.bubble.right", color: .purple)
                    StatCard(title: "Messages Sent", value: "\(analytics.totalMessages)", icon: "text.bubble", color: .blue)
                    StatCard(title: "Tokens Used", value: formatNumber(analytics.totalTokens), icon: "cpu", color: .green)
                    StatCard(title: "Total Cost", value: "$\(String(format: "%.2f", analytics.totalCost))", icon: "dollarsign.circle", color: .orange)
                    StatCard(title: "Achievements", value: "\(analytics.achievementsUnlocked)", icon: "trophy", color: .yellow)
                }
            }
            .padding()

            if let analytics {
                VStack(alignment: .leading, spacing: 8) {
                    SectionHeader(title: "Favorite Models")
                    ForEach(analytics.favoriteModels.prefix(5), id: \.model) { usage in
                        HStack {
                            Text(usage.model)
                                .font(.system(size: 12))
                            Spacer()
                            Text("\(usage.count) uses")
                                .font(.system(size: 11))
                                .foregroundStyle(.secondary)
                        }
                        .padding(.horizontal, 4)
                    }
                }
                .padding(.horizontal)

                VStack(alignment: .leading, spacing: 8) {
                    SectionHeader(title: "Top Domains")
                    ForEach(analytics.topDomains.prefix(5), id: \.domain) { usage in
                        HStack {
                            Text(usage.domain)
                                .font(.system(size: 12))
                            Spacer()
                            Text("\(usage.count) queries")
                                .font(.system(size: 11))
                                .foregroundStyle(.secondary)
                        }
                        .padding(.horizontal, 4)
                    }
                }
                .padding()
            }
        }
    }

    private var achievementsTab: some View {
        ScrollView {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 200))], spacing: 12) {
                ForEach(achievements) { achievement in
                    AchievementCard(achievement: achievement)
                }
            }
            .padding()
        }
    }

    private var usageTab: some View {
        ScrollView {
            if let analytics {
                VStack(alignment: .leading, spacing: 16) {
                    SectionHeader(title: "Daily Activity (Last 30 Days)")

                    HStack(alignment: .bottom, spacing: 2) {
                        ForEach(analytics.activityByDay.suffix(30), id: \.date) { day in
                            VStack {
                                RoundedRectangle(cornerRadius: 2)
                                    .fill(Color.purple.opacity(0.6))
                                    .frame(width: 12, height: CGFloat(day.messages) * 3)
                            }
                            .help("\(day.date): \(day.messages) messages")
                        }
                    }
                    .frame(height: 120)
                    .padding(.horizontal)
                }
                .padding()
            }
        }
    }

    private func formatNumber(_ n: Int) -> String {
        if n >= 1_000_000 { return "\(n / 1_000_000)M" }
        if n >= 1_000 { return "\(n / 1_000)K" }
        return "\(n)"
    }
}

struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .font(.system(size: 14))
                    .foregroundStyle(color)
                Spacer()
            }
            HStack {
                Text(value)
                    .font(.system(size: 22, weight: .bold))
                Spacer()
            }
            HStack {
                Text(title)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                Spacer()
            }
        }
        .padding(12)
        .glassCard(cornerRadius: 10)
    }
}

struct AchievementCard: View {
    let achievement: Achievement
    private var isUnlocked: Bool { achievement.unlockedAt != nil }

    var body: some View {
        VStack(spacing: 8) {
            Text(achievement.icon)
                .font(.system(size: 32))
                .opacity(isUnlocked ? 1 : 0.3)

            Text(achievement.name)
                .font(.system(size: 12, weight: .semibold))
                .multilineTextAlignment(.center)

            Text(achievement.description)
                .font(.system(size: 10))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .lineLimit(2)

            HStack(spacing: 4) {
                BadgeView(text: achievement.rarity.rawValue.capitalized, color: colorForRarity(achievement.rarity), size: .small)
                Text("\(achievement.points) pts")
                    .font(.system(size: 10))
                    .foregroundStyle(.tertiary)
            }

            if let progress = achievement.progress, let threshold = achievement.threshold, !isUnlocked {
                ProgressView(value: progress, total: threshold)
                    .tint(.purple)
            }
        }
        .padding(12)
        .glassCard(cornerRadius: 10)
        .opacity(isUnlocked ? 1 : 0.6)
    }

    private func colorForRarity(_ rarity: AchievementRarity) -> Color {
        switch rarity {
        case .common: return .gray
        case .uncommon: return .green
        case .rare: return .blue
        case .epic: return .purple
        case .legendary: return .orange
        }
    }
}
