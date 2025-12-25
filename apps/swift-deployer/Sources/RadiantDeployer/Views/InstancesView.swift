// RADIANT v4.18.0 - Instances View
// Monitor and manage deployed Radiant instances

import SwiftUI

struct InstancesView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedInstance: InstanceInfo?
    @State private var isRefreshing = false
    
    var body: some View {
        HSplitView {
            // Instance List
            instanceListPanel
                .frame(minWidth: 350, maxWidth: 450)
            
            // Instance Detail
            instanceDetailPanel
        }
        .navigationTitle("Instances")
    }
    
    // MARK: - Instance List
    
    private var instanceListPanel: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Deployed Instances")
                    .font(.headline)
                
                Spacer()
                
                Button {
                    refreshInstances()
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .buttonStyle(.borderless)
                .disabled(isRefreshing)
            }
            .padding()
            .background(.bar)
            
            Divider()
            
            // Instance List
            if instances.isEmpty {
                emptyStateView
            } else {
                List(instances, id: \.id, selection: $selectedInstance) { instance in
                    InstanceRow(instance: instance, isSelected: selectedInstance?.id == instance.id)
                        .tag(instance)
                }
                .listStyle(.plain)
            }
        }
    }
    
    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "server.rack")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            
            Text("No Deployed Instances")
                .font(.headline)
            
            Text("Deploy your first Radiant instance to get started")
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            
            Button("Go to Deploy") {
                appState.selectedTab = .deploy
            }
            .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }
    
    // MARK: - Instance Detail
    
    private var instanceDetailPanel: some View {
        Group {
            if let instance = selectedInstance {
                InstanceDetailView(instance: instance)
            } else {
                VStack {
                    Image(systemName: "sidebar.right")
                        .font(.system(size: 48))
                        .foregroundStyle(.secondary)
                    Text("Select an instance to view details")
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }
    
    // MARK: - Data
    
    private var instances: [InstanceInfo] {
        var result: [InstanceInfo] = []
        
        for app in appState.apps {
            for env in DeployEnvironment.allCases {
                let status = app.environments[env]
                if status.deployed {
                    result.append(InstanceInfo(
                        id: "\(app.id)-\(env.shortName)",
                        appId: app.id,
                        appName: app.name,
                        environment: env,
                        version: status.version ?? RADIANT_VERSION,
                        tier: status.tier,
                        healthStatus: status.healthStatus,
                        apiUrl: status.apiUrl,
                        dashboardUrl: status.dashboardUrl,
                        lastDeployedAt: status.lastDeployedAt
                    ))
                }
            }
        }
        
        return result
    }
    
    private func refreshInstances() {
        isRefreshing = true
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            isRefreshing = false
        }
    }
}

// MARK: - Instance Info

struct InstanceInfo: Identifiable, Hashable {
    let id: String
    let appId: String
    let appName: String
    let environment: DeployEnvironment
    let version: String
    let tier: Int
    let healthStatus: HealthStatus
    let apiUrl: String?
    let dashboardUrl: String?
    let lastDeployedAt: Date?
}

// MARK: - Instance Row

struct InstanceRow: View {
    let instance: InstanceInfo
    let isSelected: Bool
    
    var body: some View {
        HStack(spacing: 12) {
            // Health Indicator
            Circle()
                .fill(healthColor)
                .frame(width: 10, height: 10)
            
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(instance.appName)
                        .font(.headline)
                    
                    Text(instance.environment.shortName)
                        .font(.caption)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(instance.environment.color.opacity(0.2))
                        .foregroundColor(instance.environment.color)
                        .clipShape(Capsule())
                }
                
                HStack(spacing: 8) {
                    Text("v\(instance.version)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    
                    Text("•")
                        .foregroundStyle(.secondary)
                    
                    Text("Tier \(instance.tier)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .foregroundStyle(.secondary)
                .font(.caption)
        }
        .padding(.vertical, 8)
        .contentShape(Rectangle())
    }
    
    private var healthColor: Color {
        switch instance.healthStatus {
        case .healthy: return .green
        case .degraded: return .orange
        case .unhealthy: return .red
        case .unknown: return .gray
        }
    }
}

// MARK: - Instance Detail View

struct InstanceDetailView: View {
    let instance: InstanceInfo
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Header
                headerSection
                
                Divider()
                
                // Quick Actions
                quickActionsSection
                
                Divider()
                
                // Details
                detailsSection
                
                // Endpoints
                endpointsSection
                
                // Metrics (placeholder)
                metricsSection
            }
            .padding(24)
        }
    }
    
    private var headerSection: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 12) {
                    Text(instance.appName)
                        .font(.title.bold())
                    
                    Text(instance.environment.shortName)
                        .font(.headline)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(instance.environment.color)
                        .foregroundColor(.white)
                        .clipShape(Capsule())
                }
                
                HStack(spacing: 16) {
                    Label("v\(instance.version)", systemImage: "tag")
                    Label("Tier \(instance.tier)", systemImage: "star")
                    
                    HStack(spacing: 4) {
                        Circle()
                            .fill(healthColor)
                            .frame(width: 8, height: 8)
                        Text(instance.healthStatus.rawValue.capitalized)
                    }
                }
                .font(.subheadline)
                .foregroundStyle(.secondary)
            }
            
            Spacer()
        }
    }
    
    private var quickActionsSection: some View {
        HStack(spacing: 12) {
            ActionButton(title: "Open Dashboard", icon: "rectangle.3.group", color: .blue) {
                if let url = instance.dashboardUrl, let nsUrl = URL(string: url) {
                    NSWorkspace.shared.open(nsUrl)
                }
            }
            
            ActionButton(title: "View Logs", icon: "doc.text", color: .orange) {
                // Open CloudWatch logs
            }
            
            ActionButton(title: "Update", icon: "arrow.up.circle", color: .green) {
                // Trigger update
            }
            
            ActionButton(title: "Restart", icon: "arrow.clockwise", color: .purple) {
                // Restart services
            }
        }
    }
    
    private var detailsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Details")
                .font(.headline)
            
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 12) {
                DetailItem(label: "App ID", value: instance.appId)
                DetailItem(label: "Environment", value: instance.environment.rawValue)
                DetailItem(label: "Version", value: instance.version)
                DetailItem(label: "Tier", value: "Tier \(instance.tier) - \(tierName)")
                DetailItem(label: "Status", value: instance.healthStatus.rawValue.capitalized)
                
                if let date = instance.lastDeployedAt {
                    DetailItem(label: "Last Deployed", value: date.formatted())
                }
            }
        }
    }
    
    private var endpointsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Endpoints")
                .font(.headline)
            
            VStack(spacing: 8) {
                if let apiUrl = instance.apiUrl {
                    EndpointRow(label: "API", url: apiUrl)
                }
                
                if let dashboardUrl = instance.dashboardUrl {
                    EndpointRow(label: "Dashboard", url: dashboardUrl)
                }
            }
        }
    }
    
    private var metricsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Metrics (Last 24h)")
                .font(.headline)
            
            HStack(spacing: 16) {
                MetricCard(title: "Requests", value: "12.4K", trend: "+5%", color: .blue)
                MetricCard(title: "Latency", value: "145ms", trend: "-12%", color: .green)
                MetricCard(title: "Errors", value: "0.02%", trend: "-8%", color: .orange)
                MetricCard(title: "Cost", value: "$24.50", trend: "+2%", color: .purple)
            }
        }
    }
    
    private var healthColor: Color {
        switch instance.healthStatus {
        case .healthy: return .green
        case .degraded: return .orange
        case .unhealthy: return .red
        case .unknown: return .gray
        }
    }
    
    private var tierName: String {
        switch instance.tier {
        case 1: return "SEED"
        case 2: return "STARTER"
        case 3: return "GROWTH"
        case 4: return "SCALE"
        case 5: return "ENTERPRISE"
        default: return "CUSTOM"
        }
    }
}

// MARK: - Supporting Views

struct InstanceActionButton: View {
    let title: String
    let icon: String
    let color: Color
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.title2)
                Text(title)
                    .font(.caption)
            }
            .foregroundColor(color)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(color.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
    }
}

struct EndpointRow: View {
    let label: String
    let url: String
    
    var body: some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .frame(width: 80, alignment: .leading)
            
            Text(url)
                .font(.system(.subheadline, design: .monospaced))
                .foregroundStyle(.primary)
            
            Spacer()
            
            Button {
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(url, forType: .string)
            } label: {
                Image(systemName: "doc.on.doc")
            }
            .buttonStyle(.borderless)
            
            Button {
                if let nsUrl = URL(string: url) {
                    NSWorkspace.shared.open(nsUrl)
                }
            } label: {
                Image(systemName: "arrow.up.right.square")
            }
            .buttonStyle(.borderless)
        }
        .padding(12)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct MetricCard: View {
    let title: String
    let value: String
    let trend: String
    let color: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            
            Text(value)
                .font(.title2.bold())
            
            HStack(spacing: 4) {
                Image(systemName: trend.hasPrefix("+") ? "arrow.up.right" : "arrow.down.right")
                    .font(.caption2)
                Text(trend)
                    .font(.caption)
            }
            .foregroundStyle(trend.hasPrefix("+") && title != "Errors" ? .green : (trend.hasPrefix("-") ? .green : .red))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(color.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

// MARK: - Preview

#Preview {
    InstancesView()
        .environmentObject(AppState())
        .frame(width: 1200, height: 800)
}
