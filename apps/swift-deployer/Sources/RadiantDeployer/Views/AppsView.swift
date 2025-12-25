import SwiftUI

struct AppsView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        ScrollView {
            LazyVGrid(columns: [
                GridItem(.adaptive(minimum: 300, maximum: 400), spacing: 20)
            ], spacing: 20) {
                ForEach(appState.apps) { app in
                    AppCard(app: app)
                }
            }
            .padding()
        }
        .navigationTitle("Applications")
        .toolbar {
            ToolbarItem(placement: .automatic) {
                EnvironmentPicker()
            }
        }
    }
}

struct AppCard: View {
    @EnvironmentObject var appState: AppState
    let app: ManagedApp
    
    private var status: EnvironmentStatus {
        app.environments[appState.selectedEnvironment]
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading) {
                    Text(app.name)
                        .font(.headline)
                    Text(app.domain)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                Spacer()
                
                StatusBadge(status: status.deployed ? "Deployed" : "Not Deployed", color: status.deployed ? .green : .gray)
            }
            
            if let description = app.description {
                Text(description)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            
            Divider()
            
            HStack {
                Label("Tier \(status.tier)", systemImage: "chart.bar")
                    .font(.caption)
                
                Spacer()
                
                if status.deployed {
                    Button("Open Dashboard") {
                        if let url = status.dashboardUrl.flatMap(URL.init(string:)) {
                            NSWorkspace.shared.open(url)
                        }
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                } else {
                    Button("Deploy") {
                        appState.selectedApp = app
                        appState.selectedTab = .deploy
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                }
            }
        }
        .padding()
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(radius: 2)
    }
}

struct EnvironmentStatusBadge: View {
    let status: EnvironmentStatus
    
    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(statusColor)
                .frame(width: 8, height: 8)
            Text(statusText)
                .font(.caption)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(statusColor.opacity(0.1))
        .clipShape(Capsule())
    }
    
    private var statusColor: Color {
        switch status.healthStatus {
        case .healthy: return .green
        case .degraded: return .orange
        case .unhealthy: return .red
        case .unknown: return .gray
        }
    }
    
    private var statusText: String {
        if status.deployed {
            return status.healthStatus.rawValue.capitalized
        }
        return "Not Deployed"
    }
}

struct EnvironmentPicker: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        Picker("Environment", selection: $appState.selectedEnvironment) {
            ForEach(DeployEnvironment.allCases) { env in
                HStack {
                    Circle()
                        .fill(env.color)
                        .frame(width: 8, height: 8)
                    Text(env.shortName)
                }
                .tag(env)
            }
        }
        .pickerStyle(.segmented)
        .frame(width: 280)
    }
}

#Preview {
    AppsView()
        .environmentObject(AppState())
        .frame(width: 800, height: 600)
}
