import SwiftUI

struct DeployView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedTier: Int = 1
    @State private var showConfirmation = false
    
    var body: some View {
        HSplitView {
            deploymentConfigPanel
                .frame(minWidth: 400, maxWidth: 500)
            
            deploymentLogsPanel
        }
        .navigationTitle("Deploy")
    }
    
    private var deploymentConfigPanel: some View {
        Form {
            Section("Application") {
                Picker("Select App", selection: $appState.selectedApp) {
                    Text("Select an application").tag(nil as ManagedApp?)
                    ForEach(appState.apps) { app in
                        Text(app.name).tag(app as ManagedApp?)
                    }
                }
                
                Picker("Environment", selection: $appState.selectedEnvironment) {
                    ForEach(DeployEnvironment.allCases) { env in
                        Text(env.rawValue).tag(env)
                    }
                }
            }
            
            Section("Infrastructure Tier") {
                TierPicker(selectedTier: $selectedTier)
            }
            
            Section("Credentials") {
                if appState.credentials.isEmpty {
                    Label("No credentials configured", systemImage: "exclamationmark.triangle")
                        .foregroundStyle(.orange)
                    
                    Button("Configure Credentials") {
                        appState.selectedTab = .settings
                    }
                } else {
                    ForEach(appState.credentials, id: \.id) { cred in
                        HStack {
                            VStack(alignment: .leading) {
                                Text(cred.name)
                                    .font(.headline)
                                Text(cred.region)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            if cred.isValid == true {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(.green)
                            }
                        }
                    }
                }
            }
            
            Section {
                Button(action: { showConfirmation = true }) {
                    HStack {
                        Image(systemName: "arrow.up.circle.fill")
                        Text("Deploy to \(appState.selectedEnvironment.shortName)")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(appState.selectedApp == nil || appState.credentials.isEmpty || appState.isDeploying)
            }
        }
        .formStyle(.grouped)
        .confirmationDialog(
            "Deploy \(appState.selectedApp?.name ?? "") to \(appState.selectedEnvironment.shortName)?",
            isPresented: $showConfirmation,
            titleVisibility: .visible
        ) {
            Button("Deploy", role: .destructive) {
                startDeployment()
            }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("This will deploy infrastructure to your AWS account. Charges may apply.")
        }
    }
    
    private var deploymentLogsPanel: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Deployment Logs")
                    .font(.headline)
                Spacer()
                if appState.isDeploying {
                    ProgressView()
                        .controlSize(.small)
                }
            }
            .padding()
            .background(.bar)
            
            if let progress = appState.deploymentProgress {
                DeploymentProgressView(progress: progress)
                    .padding()
            }
            
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 4) {
                    ForEach(appState.deploymentLogs) { log in
                        LogEntryView(entry: log)
                    }
                }
                .padding()
            }
            .background(.black.opacity(0.8))
            .font(.system(.caption, design: .monospaced))
        }
    }
    
    private func startDeployment() {
        guard let app = appState.selectedApp else { return }
        
        appState.isDeploying = true
        appState.deploymentProgress = DeploymentProgress(
            phase: .validating,
            progress: 0.05,
            currentStack: nil,
            message: "Starting deployment...",
            startedAt: Date(),
            estimatedCompletion: Date().addingTimeInterval(600)
        )
        
        appState.deploymentLogs.append(LogEntry(
            timestamp: Date(),
            level: .info,
            message: "Starting deployment of \(app.name) to \(appState.selectedEnvironment.shortName)",
            metadata: nil
        ))
    }
}

struct TierPicker: View {
    @Binding var selectedTier: Int
    
    private let tiers = [
        (1, "SEED", "$50-150/mo", "Development and testing"),
        (2, "STARTUP", "$200-400/mo", "Small production workloads"),
        (3, "GROWTH", "$1,000-2,500/mo", "Medium production with self-hosted models"),
        (4, "SCALE", "$4,000-8,000/mo", "Large production with multi-region"),
        (5, "ENTERPRISE", "$15,000-35,000/mo", "Enterprise-grade global deployment")
    ]
    
    var body: some View {
        ForEach(tiers, id: \.0) { tier in
            Button {
                selectedTier = tier.0
            } label: {
                HStack {
                    VStack(alignment: .leading) {
                        HStack {
                            Text("Tier \(tier.0): \(tier.1)")
                                .font(.headline)
                            Spacer()
                            Text(tier.2)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Text(tier.3)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    
                    if selectedTier == tier.0 {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(.blue)
                    }
                }
                .padding(.vertical, 4)
            }
            .buttonStyle(.plain)
        }
    }
}

struct DeploymentProgressView: View {
    let progress: DeploymentProgress
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: progress.phase.icon)
                Text(progress.phase.rawValue)
                    .font(.headline)
                Spacer()
                Text("\(Int(progress.progress * 100))%")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            ProgressView(value: progress.progress)
                .progressViewStyle(.linear)
            
            if let message = progress.message {
                Text(message)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct LogEntryView: View {
    let entry: LogEntry
    
    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Text(entry.timestamp, style: .time)
                .foregroundStyle(.secondary)
            
            Image(systemName: entry.level.icon)
                .foregroundStyle(levelColor)
            
            Text(entry.message)
                .foregroundStyle(.white)
        }
    }
    
    private var levelColor: Color {
        switch entry.level {
        case .debug: return .gray
        case .info: return .blue
        case .warn: return .orange
        case .error: return .red
        case .success: return .green
        }
    }
}

#Preview {
    DeployView()
        .environmentObject(AppState())
        .frame(width: 1000, height: 700)
}
