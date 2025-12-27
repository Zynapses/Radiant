// RADIANT v4.18.0 - Dashboard View
// Overview with health status, recent deployments, and quick actions

import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Header
                headerSection
                
                // Status Cards
                statusCardsSection
                
                // Main Content Grid
                HStack(alignment: .top, spacing: 24) {
                    // Left Column
                    VStack(spacing: 24) {
                        quickActionsSection
                        recentDeploymentsSection
                    }
                    .frame(minWidth: 300, maxWidth: .infinity)
                    
                    // Right Column
                    VStack(spacing: 24) {
                        environmentStatusSection
                        systemHealthSection
                    }
                    .frame(minWidth: 280, idealWidth: 320, maxWidth: 350)
                }
            }
            .padding(24)
        }
        .frame(minWidth: 600)
        .background(Color(nsColor: .windowBackgroundColor))
    }
    
    // MARK: - Header
    
    private var headerSection: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Welcome to RADIANT")
                    .font(.largeTitle.bold())
                
                Text("Manage your AI platform deployments")
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            // Version Badge
            HStack(spacing: 8) {
                Image(systemName: "checkmark.seal.fill")
                    .foregroundStyle(.green)
                Text("v\(RADIANT_VERSION)")
                    .font(.headline)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(Color.green.opacity(0.1))
            .clipShape(Capsule())
        }
    }
    
    // MARK: - Status Cards
    
    private var statusCardsSection: some View {
        HStack(spacing: 16) {
            StatusCard(
                title: "Apps",
                value: "\(appState.apps.count)",
                subtitle: "Managed Applications",
                icon: "app.badge",
                color: .purple
            )
            
            StatusCard(
                title: "Instances",
                value: "\(deployedInstancesCount)",
                subtitle: "Deployed Instances",
                icon: "server.rack",
                color: .orange
            )
            
            StatusCard(
                title: "Providers",
                value: "21",
                subtitle: "AI Providers",
                icon: "building.2",
                color: .teal
            )
            
            StatusCard(
                title: "Models",
                value: "106+",
                subtitle: "Available Models",
                icon: "cpu",
                color: .pink
            )
        }
    }
    
    private var deployedInstancesCount: Int {
        appState.apps.reduce(0) { count, app in
            count + (app.environments.dev.deployed ? 1 : 0)
                  + (app.environments.staging.deployed ? 1 : 0)
                  + (app.environments.prod.deployed ? 1 : 0)
        }
    }
    
    // MARK: - Quick Actions
    
    private var quickActionsSection: some View {
        DashboardSection(title: "Quick Actions", icon: "bolt.fill") {
            VStack(spacing: 12) {
                QuickActionButton(
                    title: "New Deployment",
                    subtitle: "Deploy to an environment",
                    icon: "arrow.up.circle.fill",
                    color: .green
                ) {
                    appState.selectedTab = .deploy
                }
                
                QuickActionButton(
                    title: "View Instances",
                    subtitle: "Monitor running instances",
                    icon: "server.rack",
                    color: .orange
                ) {
                    appState.selectedTab = .instances
                }
                
                QuickActionButton(
                    title: "Manage Snapshots",
                    subtitle: "Backup and restore points",
                    icon: "clock.arrow.circlepath",
                    color: .cyan
                ) {
                    appState.selectedTab = .snapshots
                }
                
                QuickActionButton(
                    title: "Configure Credentials",
                    subtitle: "AWS access management",
                    icon: "key.fill",
                    color: .blue
                ) {
                    appState.selectedTab = .settings
                }
            }
        }
    }
    
    // MARK: - Recent Deployments
    
    private var recentDeploymentsSection: some View {
        DashboardSection(title: "Recent Deployments", icon: "clock") {
            if appState.deploymentLogs.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "tray")
                        .font(.largeTitle)
                        .foregroundStyle(.secondary)
                    Text("No recent deployments")
                        .foregroundStyle(.secondary)
                    
                    Button("Start Your First Deployment") {
                        appState.selectedTab = .deploy
                    }
                    .buttonStyle(.borderedProminent)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 32)
            } else {
                VStack(spacing: 8) {
                    ForEach(appState.deploymentLogs.prefix(5)) { log in
                        DeploymentLogRow(log: log)
                    }
                }
            }
        }
    }
    
    // MARK: - Environment Status
    
    private var environmentStatusSection: some View {
        DashboardSection(title: "Environment Status", icon: "server.rack") {
            VStack(spacing: 12) {
                ForEach(DeployEnvironment.allCases) { env in
                    EnvironmentStatusRow(environment: env, apps: appState.apps)
                }
            }
        }
    }
    
    // MARK: - System Health
    
    private var systemHealthSection: some View {
        DashboardSection(title: "System Health", icon: "heart.fill") {
            VStack(spacing: 12) {
                HealthRow(title: "AWS Connection", status: appState.credentials.isEmpty ? .unknown : .healthy)
                HealthRow(title: "Radiant Instance", status: appState.isConnectedToRadiant ? .healthy : .unknown)
                HealthRow(title: "CDK Runtime", status: .healthy)
                HealthRow(title: "Package Cache", status: .healthy)
            }
        }
    }
}

// MARK: - Supporting Views

struct StatusCard: View {
    let title: String
    let value: String
    let subtitle: String
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundStyle(color)
                Spacer()
            }
            
            Text(value)
                .font(.system(size: 36, weight: .bold, design: .rounded))
            
            Text(subtitle)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

struct DashboardSection<Content: View>: View {
    let title: String
    let icon: String
    @ViewBuilder let content: Content
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .foregroundStyle(.secondary)
                Text(title)
                    .font(.headline)
            }
            
            content
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

struct QuickActionButton: View {
    let title: String
    let subtitle: String
    let icon: String
    let color: Color
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 16) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundStyle(color)
                    .frame(width: 40)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.headline)
                        .foregroundColor(.primary)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                Image(systemName: "chevron.right")
                    .foregroundStyle(.secondary)
            }
            .padding(12)
            .background(color.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
    }
}

struct DeploymentLogRow: View {
    let log: LogEntry
    
    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(statusColor)
                .frame(width: 8, height: 8)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(log.message)
                    .lineLimit(1)
                Text(log.timestamp, style: .relative)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
        }
        .padding(.vertical, 4)
    }
    
    private var statusColor: Color {
        switch log.level {
        case .success: return .green
        case .error: return .red
        case .warn: return .orange
        default: return .blue
        }
    }
}

struct EnvironmentStatusRow: View {
    let environment: DeployEnvironment
    let apps: [ManagedApp]
    
    private var deployedCount: Int {
        apps.filter { app in
            switch environment {
            case .dev: return app.environments.dev.deployed
            case .staging: return app.environments.staging.deployed
            case .prod: return app.environments.prod.deployed
            }
        }.count
    }
    
    var body: some View {
        HStack {
            Circle()
                .fill(environment.color)
                .frame(width: 10, height: 10)
            
            Text(environment.rawValue)
                .font(.subheadline)
            
            Spacer()
            
            Text("\(deployedCount) deployed")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .background(environment.color.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct HealthRow: View {
    let title: String
    let status: HealthStatus
    
    var body: some View {
        HStack {
            Text(title)
                .font(.subheadline)
            
            Spacer()
            
            HStack(spacing: 6) {
                Circle()
                    .fill(statusColor)
                    .frame(width: 8, height: 8)
                Text(status.rawValue.capitalized)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(8)
    }
    
    private var statusColor: Color {
        switch status {
        case .healthy: return .green
        case .degraded: return .orange
        case .unhealthy: return .red
        case .unknown: return .gray
        }
    }
}

// MARK: - Preview

#Preview {
    DashboardView()
        .environmentObject(AppState())
        .frame(width: 1200, height: 900)
}
