// RADIANT v4.18.0 - Detail View Components
// Implements: Pattern 5 (Master List → Detail with Overview, Activity, Settings)

import SwiftUI

// MARK: - Detail View Container

struct DetailViewContainer<Content: View>: View {
    let title: String
    let subtitle: String?
    @ViewBuilder let content: Content
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            VStack(alignment: .leading, spacing: RadiantSpacing.xs) {
                Text(title)
                    .font(.title2.bold())
                
                if let subtitle = subtitle {
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(RadiantSpacing.lg)
            
            Divider()
            
            // Content
            ScrollView {
                content
                    .padding(RadiantSpacing.lg)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

// MARK: - Detail Section

struct DetailSection<Content: View>: View {
    let title: String
    let icon: String?
    @ViewBuilder let content: Content
    
    init(title: String, icon: String? = nil, @ViewBuilder content: () -> Content) {
        self.title = title
        self.icon = icon
        self.content = content()
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: RadiantSpacing.md) {
            HStack(spacing: RadiantSpacing.xs) {
                if let icon = icon {
                    Image(systemName: icon)
                        .foregroundStyle(.secondary)
                }
                Text(title)
                    .font(.headline)
            }
            
            content
        }
    }
}

// MARK: - Key Value Grid

struct KeyValueGrid: View {
    let items: [(key: String, value: String, valueColor: Color?)]
    let columns: Int
    
    init(items: [(key: String, value: String, valueColor: Color?)], columns: Int = 2) {
        self.items = items
        self.columns = columns
    }
    
    var body: some View {
        LazyVGrid(
            columns: Array(repeating: GridItem(.flexible(), spacing: RadiantSpacing.md), count: columns),
            spacing: RadiantSpacing.md
        ) {
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.key)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    
                    Text(item.value)
                        .font(.body)
                        .foregroundStyle(item.valueColor ?? .primary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(RadiantSpacing.md)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.md))
    }
}

// MARK: - Activity Timeline

struct ActivityTimeline: View {
    let activities: [ActivityItem]
    
    struct ActivityItem: Identifiable {
        let id: String
        let title: String
        let description: String?
        let timestamp: Date
        let type: ActivityType
        let user: String?
        
        enum ActivityType {
            case deployment, configuration, user, system, error
            
            var icon: String {
                switch self {
                case .deployment: return "arrow.up.circle.fill"
                case .configuration: return "gearshape.fill"
                case .user: return "person.fill"
                case .system: return "server.rack"
                case .error: return "exclamationmark.triangle.fill"
                }
            }
            
            var color: Color {
                switch self {
                case .deployment: return .green
                case .configuration: return .blue
                case .user: return .purple
                case .system: return .orange
                case .error: return .red
                }
            }
        }
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(activities.enumerated()), id: \.element.id) { index, activity in
                HStack(alignment: .top, spacing: RadiantSpacing.md) {
                    // Timeline
                    VStack(spacing: 0) {
                        Circle()
                            .fill(activity.type.color)
                            .frame(width: 10, height: 10)
                        
                        if index < activities.count - 1 {
                            Rectangle()
                                .fill(Color(nsColor: .separatorColor))
                                .frame(width: 2)
                                .frame(maxHeight: .infinity)
                        }
                    }
                    .frame(width: 10)
                    
                    // Content
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: RadiantSpacing.xs) {
                            Image(systemName: activity.type.icon)
                                .font(.caption)
                                .foregroundStyle(activity.type.color)
                            
                            Text(activity.title)
                                .font(.body.weight(.medium))
                        }
                        
                        if let description = activity.description {
                            Text(description)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        
                        HStack(spacing: RadiantSpacing.xs) {
                            Text(activity.timestamp, style: .relative)
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                            
                            if let user = activity.user {
                                Text("•")
                                    .foregroundStyle(.tertiary)
                                Text(user)
                                    .font(.caption2)
                                    .foregroundStyle(.tertiary)
                            }
                        }
                    }
                    .padding(.bottom, RadiantSpacing.md)
                }
            }
        }
    }
}

// MARK: - Related Items

struct RelatedItemsSection<Item: Identifiable, Content: View>: View {
    let title: String
    let items: [Item]
    let emptyMessage: String
    @ViewBuilder let itemContent: (Item) -> Content
    
    var body: some View {
        DetailSection(title: title, icon: "link") {
            if items.isEmpty {
                Text(emptyMessage)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(RadiantSpacing.md)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .background(Color(nsColor: .controlBackgroundColor))
                    .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.md))
            } else {
                VStack(spacing: RadiantSpacing.xs) {
                    ForEach(items) { item in
                        itemContent(item)
                    }
                }
            }
        }
    }
}

// MARK: - App Detail View

struct AppDetailView: View {
    let app: ManagedApp
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        DetailViewContainer(title: app.name, subtitle: app.description) {
            VStack(alignment: .leading, spacing: RadiantSpacing.xl) {
                // Overview Section
                DetailSection(title: "Overview", icon: "info.circle") {
                    KeyValueGrid(items: [
                        ("Domain", app.domain, app.isDomainConfigured ? nil : .orange),
                        ("App ID", app.id, nil),
                        ("Created", app.createdAt.formatted(date: .abbreviated, time: .omitted), nil),
                        ("Last Updated", app.updatedAt.formatted(date: .abbreviated, time: .shortened), nil)
                    ])
                }
                
                // Environments Section
                DetailSection(title: "Environments", icon: "server.rack") {
                    VStack(spacing: RadiantSpacing.sm) {
                        EnvironmentCard(
                            environment: .dev,
                            status: app.environments.dev,
                            isSelected: appState.selectedEnvironment == .dev
                        )
                        
                        EnvironmentCard(
                            environment: .staging,
                            status: app.environments.staging,
                            isSelected: appState.selectedEnvironment == .staging
                        )
                        
                        EnvironmentCard(
                            environment: .prod,
                            status: app.environments.prod,
                            isSelected: appState.selectedEnvironment == .prod
                        )
                    }
                }
                
                // Recent Activity
                DetailSection(title: "Recent Activity", icon: "clock") {
                    if recentActivities.isEmpty {
                        Text("No recent activity")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .padding(RadiantSpacing.md)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .background(Color(nsColor: .controlBackgroundColor))
                            .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.md))
                    } else {
                        ActivityTimeline(activities: recentActivities)
                            .padding(RadiantSpacing.md)
                            .background(Color(nsColor: .controlBackgroundColor))
                            .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.md))
                    }
                }
                
                // Quick Actions
                DetailSection(title: "Actions", icon: "bolt") {
                    HStack(spacing: RadiantSpacing.sm) {
                        ActionCard(
                            title: "Deploy",
                            icon: "arrow.up.circle",
                            color: .green
                        ) {
                            appState.selectedTab = .deploy
                        }
                        
                        ActionCard(
                            title: "Configure",
                            icon: "gearshape",
                            color: .blue
                        ) {
                            appState.selectedTab = .settings
                        }
                        
                        ActionCard(
                            title: "Logs",
                            icon: "doc.text",
                            color: .purple
                        ) {
                            appState.selectedTab = .history
                        }
                        
                        ActionCard(
                            title: "Snapshot",
                            icon: "clock.arrow.circlepath",
                            color: .cyan
                        ) {
                            appState.selectedTab = .snapshots
                        }
                    }
                }
            }
        }
    }
    
    private var recentActivities: [ActivityTimeline.ActivityItem] {
        // Mock activities - would come from real data
        []
    }
}

// MARK: - Environment Card

struct EnvironmentCard: View {
    let environment: DeployEnvironment
    let status: EnvironmentStatus
    let isSelected: Bool
    
    var body: some View {
        HStack(spacing: RadiantSpacing.md) {
            // Environment Badge
            Text(environment.shortName)
                .font(.caption.weight(.bold))
                .padding(.horizontal, RadiantSpacing.sm)
                .padding(.vertical, RadiantSpacing.xxs)
                .background(environment.color)
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.sm))
            
            // Status
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: RadiantSpacing.xs) {
                    Circle()
                        .fill(statusColor)
                        .frame(width: 8, height: 8)
                    
                    Text(status.deployed ? "Deployed" : "Not Deployed")
                        .font(.body.weight(.medium))
                }
                
                if status.deployed {
                    HStack(spacing: RadiantSpacing.xs) {
                        if let version = status.version {
                            Text("v\(version)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        
                        Text("•")
                            .foregroundStyle(.tertiary)
                        
                        Text("Tier \(status.tier)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            
            Spacer()
            
            // Health
            if status.deployed {
                RadiantStatusBadge(
                    status: status.healthStatus.rawValue.capitalized,
                    color: healthColor
                )
            }
        }
        .padding(RadiantSpacing.md)
        .background(isSelected ? environment.color.opacity(0.1) : Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.md))
        .overlay(
            RoundedRectangle(cornerRadius: RadiantRadius.md)
                .stroke(isSelected ? environment.color : Color.clear, lineWidth: 2)
        )
    }
    
    private var statusColor: Color {
        status.deployed ? .green : .gray
    }
    
    private var healthColor: Color {
        switch status.healthStatus {
        case .healthy: return .green
        case .degraded: return .orange
        case .unhealthy: return .red
        case .unknown: return .gray
        }
    }
}

// MARK: - Action Card

struct ActionCard: View {
    let title: String
    let icon: String
    let color: Color
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: RadiantSpacing.sm) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundStyle(color)
                
                Text(title)
                    .font(.caption.weight(.medium))
            }
            .frame(maxWidth: .infinity)
            .padding(RadiantSpacing.md)
            .background(color.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.md))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Tabbed Detail View

struct TabbedDetailView<Content: View>: View {
    let tabs: [DetailTab]
    @Binding var selectedTab: String
    @ViewBuilder let content: (String) -> Content
    
    struct DetailTab: Identifiable {
        let id: String
        let title: String
        let icon: String
        let badge: Int?
        
        init(id: String, title: String, icon: String, badge: Int? = nil) {
            self.id = id
            self.title = title
            self.icon = icon
            self.badge = badge
        }
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Tab Bar
            HStack(spacing: 0) {
                ForEach(tabs) { tab in
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            selectedTab = tab.id
                        }
                    } label: {
                        HStack(spacing: RadiantSpacing.xs) {
                            Image(systemName: tab.icon)
                            Text(tab.title)
                            
                            if let badge = tab.badge, badge > 0 {
                                Text("\(badge)")
                                    .font(.caption2.weight(.semibold))
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Color.red)
                                    .foregroundStyle(.white)
                                    .clipShape(Capsule())
                            }
                        }
                        .font(.subheadline)
                        .padding(.horizontal, RadiantSpacing.md)
                        .padding(.vertical, RadiantSpacing.sm)
                        .foregroundStyle(selectedTab == tab.id ? .primary : .secondary)
                        .background(
                            selectedTab == tab.id
                            ? Color(nsColor: .controlBackgroundColor)
                            : Color.clear
                        )
                    }
                    .buttonStyle(.plain)
                }
                
                Spacer()
            }
            .background(.bar)
            
            Divider()
            
            // Content
            content(selectedTab)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}
