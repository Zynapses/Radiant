// RADIANT v4.18.0 - History View
// Deployment history, logs, and audit trail

import SwiftUI

struct HistoryView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedDeployment: DeploymentRecord?
    @State private var filterEnvironment: DeployEnvironment?
    @State private var filterApp: String?
    @State private var filterStatus: DeploymentStatus?
    @State private var searchText = ""
    @State private var deployments: [DeploymentRecord] = []
    @State private var isLoading = true
    
    var body: some View {
        HSplitView {
            historyListPanel
                .frame(minWidth: 450, maxWidth: 550)
            
            historyDetailPanel
        }
        .navigationTitle("Deployment History")
        .onAppear { loadHistory() }
    }
    
    // MARK: - History List Panel
    
    private var historyListPanel: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Deployment History")
                    .font(.headline)
                Spacer()
                Button {
                    loadHistory()
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .buttonStyle(.borderless)
                
                Button {
                    exportHistory()
                } label: {
                    Image(systemName: "square.and.arrow.up")
                }
                .buttonStyle(.borderless)
            }
            .padding()
            .background(.bar)
            
            Divider()
            
            // Filters
            VStack(spacing: 8) {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(.secondary)
                    TextField("Search deployments...", text: $searchText)
                        .textFieldStyle(.plain)
                }
                .padding(8)
                .background(Color(nsColor: .controlBackgroundColor))
                .clipShape(RoundedRectangle(cornerRadius: 6))
                
                HStack(spacing: 8) {
                    Picker("Environment", selection: $filterEnvironment) {
                        Text("All Environments").tag(nil as DeployEnvironment?)
                        ForEach(DeployEnvironment.allCases) { env in
                            Text(env.shortName).tag(env as DeployEnvironment?)
                        }
                    }
                    .frame(maxWidth: 150)
                    
                    Picker("Status", selection: $filterStatus) {
                        Text("All Statuses").tag(nil as DeploymentStatus?)
                        ForEach(DeploymentStatus.allCases, id: \.self) { status in
                            Text(status.rawValue.capitalized).tag(status as DeploymentStatus?)
                        }
                    }
                    .frame(maxWidth: 120)
                    
                    Spacer()
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
            
            Divider()
            
            // Deployment List
            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if filteredDeployments.isEmpty {
                emptyStateView
            } else {
                List(filteredDeployments, selection: $selectedDeployment) { deployment in
                    DeploymentHistoryRow(deployment: deployment)
                        .tag(deployment)
                }
                .listStyle(.plain)
            }
            
            // Stats Footer
            statsFooter
        }
    }
    
    private var filteredDeployments: [DeploymentRecord] {
        deployments.filter { deployment in
            let matchesSearch = searchText.isEmpty || 
                deployment.appId.localizedCaseInsensitiveContains(searchText) ||
                deployment.version.contains(searchText)
            
            let matchesEnv = filterEnvironment == nil || deployment.environment == filterEnvironment
            let matchesStatus = filterStatus == nil || deployment.status == filterStatus
            
            return matchesSearch && matchesEnv && matchesStatus
        }
    }
    
    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "clock.arrow.circlepath")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            
            Text("No Deployments Found")
                .font(.headline)
            
            Text("Your deployment history will appear here")
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    private var statsFooter: some View {
        HStack {
            Text("\(filteredDeployments.count) deployments")
                .font(.caption)
                .foregroundStyle(.secondary)
            
            Spacer()
            
            let successCount = filteredDeployments.filter { $0.status == .success }.count
            let failCount = filteredDeployments.filter { $0.status == .failed }.count
            
            HStack(spacing: 12) {
                Label("\(successCount)", systemImage: "checkmark.circle.fill")
                    .foregroundStyle(.green)
                Label("\(failCount)", systemImage: "xmark.circle.fill")
                    .foregroundStyle(.red)
            }
            .font(.caption)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(.bar)
    }
    
    // MARK: - Detail Panel
    
    private var historyDetailPanel: some View {
        Group {
            if let deployment = selectedDeployment {
                DeploymentDetailView(deployment: deployment)
            } else {
                VStack {
                    Image(systemName: "sidebar.right")
                        .font(.system(size: 48))
                        .foregroundStyle(.secondary)
                    Text("Select a deployment to view details")
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }
    
    // MARK: - Data Loading
    
    private func loadHistory() {
        isLoading = true
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            deployments = sampleDeployments
            isLoading = false
        }
    }
    
    private func exportHistory() {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.json]
        panel.nameFieldStringValue = "radiant-deployment-history.json"
        
        if panel.runModal() == .OK, let url = panel.url {
            let encoder = JSONEncoder()
            encoder.outputFormatting = .prettyPrinted
            encoder.dateEncodingStrategy = .iso8601
            
            if let data = try? encoder.encode(filteredDeployments) {
                try? data.write(to: url)
            }
        }
    }
    
    private var sampleDeployments: [DeploymentRecord] {
        [
            DeploymentRecord(
                id: "deploy-001",
                appId: "thinktank",
                appName: "Think Tank",
                environment: .prod,
                version: "4.18.0",
                status: .success,
                mode: .update,
                startedAt: Date().addingTimeInterval(-3600),
                completedAt: Date().addingTimeInterval(-1800),
                duration: 1800,
                initiatedBy: "admin@example.com",
                tier: 3,
                stacksDeployed: 7,
                migrationsRun: 2,
                snapshotId: "snap-abc123",
                logs: sampleLogs
            ),
            DeploymentRecord(
                id: "deploy-002",
                appId: "thinktank",
                appName: "Think Tank",
                environment: .staging,
                version: "4.18.0",
                status: .success,
                mode: .update,
                startedAt: Date().addingTimeInterval(-86400),
                completedAt: Date().addingTimeInterval(-84600),
                duration: 1800,
                initiatedBy: "admin@example.com",
                tier: 2,
                stacksDeployed: 7,
                migrationsRun: 2,
                snapshotId: "snap-def456",
                logs: []
            ),
            DeploymentRecord(
                id: "deploy-003",
                appId: "thinktank",
                appName: "Think Tank",
                environment: .dev,
                version: "4.17.0",
                status: .failed,
                mode: .install,
                startedAt: Date().addingTimeInterval(-172800),
                completedAt: Date().addingTimeInterval(-172000),
                duration: 800,
                initiatedBy: "developer@example.com",
                tier: 1,
                stacksDeployed: 4,
                migrationsRun: 0,
                snapshotId: nil,
                errorMessage: "Aurora cluster creation timed out",
                logs: []
            ),
            DeploymentRecord(
                id: "deploy-004",
                appId: "launchboard",
                appName: "Launch Board",
                environment: .dev,
                version: "4.17.0",
                status: .success,
                mode: .install,
                startedAt: Date().addingTimeInterval(-259200),
                completedAt: Date().addingTimeInterval(-256800),
                duration: 2400,
                initiatedBy: "admin@example.com",
                tier: 1,
                stacksDeployed: 7,
                migrationsRun: 44,
                snapshotId: nil,
                logs: []
            )
        ]
    }
    
    private var sampleLogs: [DeploymentLogRecord] {
        [
            DeploymentLogRecord(timestamp: Date().addingTimeInterval(-3600), level: .info, message: "Starting deployment..."),
            DeploymentLogRecord(timestamp: Date().addingTimeInterval(-3590), level: .info, message: "Validating AWS credentials"),
            DeploymentLogRecord(timestamp: Date().addingTimeInterval(-3580), level: .success, message: "Credentials validated"),
            DeploymentLogRecord(timestamp: Date().addingTimeInterval(-3500), level: .info, message: "Creating pre-update snapshot"),
            DeploymentLogRecord(timestamp: Date().addingTimeInterval(-3400), level: .info, message: "Deploying Foundation stack"),
            DeploymentLogRecord(timestamp: Date().addingTimeInterval(-3000), level: .success, message: "Foundation stack deployed"),
            DeploymentLogRecord(timestamp: Date().addingTimeInterval(-2500), level: .info, message: "Running migrations"),
            DeploymentLogRecord(timestamp: Date().addingTimeInterval(-2000), level: .success, message: "Migrations complete"),
            DeploymentLogRecord(timestamp: Date().addingTimeInterval(-1800), level: .success, message: "Deployment complete!")
        ]
    }
}

// MARK: - Data Models

struct DeploymentRecord: Identifiable, Codable, Hashable {
    let id: String
    let appId: String
    let appName: String
    let environment: DeployEnvironment
    let version: String
    let status: DeploymentStatus
    let mode: DeploymentMode
    let startedAt: Date
    let completedAt: Date?
    let duration: Int // seconds
    let initiatedBy: String
    let tier: Int
    let stacksDeployed: Int
    let migrationsRun: Int
    let snapshotId: String?
    var errorMessage: String?
    var logs: [DeploymentLogRecord]
    
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
    
    static func == (lhs: DeploymentRecord, rhs: DeploymentRecord) -> Bool {
        lhs.id == rhs.id
    }
}

struct DeploymentLogRecord: Identifiable, Codable {
    let id = UUID()
    let timestamp: Date
    let level: LogLevel
    let message: String
    
    enum CodingKeys: String, CodingKey {
        case timestamp, level, message
    }
}

enum DeploymentStatus: String, Codable, CaseIterable {
    case pending, running, success, failed, cancelled, rolledBack
}

// MARK: - Row View

struct DeploymentHistoryRow: View {
    let deployment: DeploymentRecord
    
    var body: some View {
        HStack(spacing: 12) {
            // Status Icon
            Image(systemName: statusIcon)
                .font(.title2)
                .foregroundStyle(statusColor)
                .frame(width: 32)
            
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(deployment.appName)
                        .font(.headline)
                    
                    Text(deployment.environment.shortName)
                        .font(.caption)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(deployment.environment.color.opacity(0.2))
                        .foregroundStyle(deployment.environment.color)
                        .clipShape(Capsule())
                    
                    Text(deployment.mode.rawValue.uppercased())
                        .font(.caption2)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .background(modeColor.opacity(0.2))
                        .foregroundStyle(modeColor)
                        .clipShape(Capsule())
                }
                
                HStack(spacing: 8) {
                    Text("v\(deployment.version)")
                    Text("•")
                    Text(deployment.startedAt, style: .relative)
                    Text("•")
                    Text(formatDuration(deployment.duration))
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .foregroundStyle(.secondary)
                .font(.caption)
        }
        .padding(.vertical, 8)
        .contentShape(Rectangle())
    }
    
    private var statusIcon: String {
        switch deployment.status {
        case .pending: return "clock"
        case .running: return "arrow.triangle.2.circlepath"
        case .success: return "checkmark.circle.fill"
        case .failed: return "xmark.circle.fill"
        case .cancelled: return "stop.circle.fill"
        case .rolledBack: return "arrow.uturn.backward.circle.fill"
        }
    }
    
    private var statusColor: Color {
        switch deployment.status {
        case .pending: return .gray
        case .running: return .blue
        case .success: return .green
        case .failed: return .red
        case .cancelled: return .orange
        case .rolledBack: return .purple
        }
    }
    
    private var modeColor: Color {
        switch deployment.mode {
        case .install: return .green
        case .update: return .blue
        case .rollback: return .orange
        }
    }
    
    private func formatDuration(_ seconds: Int) -> String {
        if seconds < 60 {
            return "\(seconds)s"
        } else if seconds < 3600 {
            return "\(seconds / 60)m \(seconds % 60)s"
        } else {
            let hours = seconds / 3600
            let minutes = (seconds % 3600) / 60
            return "\(hours)h \(minutes)m"
        }
    }
}

// MARK: - Detail View

struct DeploymentDetailView: View {
    let deployment: DeploymentRecord
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                headerSection
                Divider()
                statsSection
                Divider()
                detailsSection
                
                if !deployment.logs.isEmpty {
                    Divider()
                    logsSection
                }
                
                if let error = deployment.errorMessage {
                    Divider()
                    errorSection(error)
                }
            }
            .padding(24)
        }
    }
    
    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: statusIcon)
                    .font(.title)
                    .foregroundStyle(statusColor)
                
                VStack(alignment: .leading) {
                    Text("\(deployment.appName) - \(deployment.environment.rawValue)")
                        .font(.title.bold())
                    Text("Deployment \(deployment.id)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                Spacer()
                
                Text(deployment.status.rawValue.uppercased())
                    .font(.caption.bold())
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(statusColor)
                    .foregroundStyle(.white)
                    .clipShape(Capsule())
            }
        }
    }
    
    private var statsSection: some View {
        HStack(spacing: 16) {
            StatBox(title: "Duration", value: formatDuration(deployment.duration), icon: "clock")
            StatBox(title: "Stacks", value: "\(deployment.stacksDeployed)", icon: "square.stack.3d.up")
            StatBox(title: "Migrations", value: "\(deployment.migrationsRun)", icon: "arrow.triangle.2.circlepath")
            StatBox(title: "Tier", value: "\(deployment.tier)", icon: "star")
        }
    }
    
    private var detailsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Details")
                .font(.headline)
            
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                DetailItem(label: "Mode", value: deployment.mode.rawValue.capitalized)
                DetailItem(label: "Version", value: deployment.version)
                DetailItem(label: "Started", value: deployment.startedAt.formatted())
                DetailItem(label: "Completed", value: deployment.completedAt?.formatted() ?? "In Progress")
                DetailItem(label: "Initiated By", value: deployment.initiatedBy)
                
                if let snapshotId = deployment.snapshotId {
                    DetailItem(label: "Snapshot", value: snapshotId)
                }
            }
        }
    }
    
    private var logsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Deployment Logs")
                .font(.headline)
            
            VStack(alignment: .leading, spacing: 4) {
                ForEach(deployment.logs) { log in
                    HStack(alignment: .top, spacing: 8) {
                        Text(log.timestamp, style: .time)
                            .font(.caption.monospaced())
                            .foregroundStyle(.secondary)
                            .frame(width: 80, alignment: .leading)
                        
                        Image(systemName: log.level.icon)
                            .font(.caption)
                            .foregroundStyle(logColor(log.level))
                        
                        Text(log.message)
                            .font(.caption)
                    }
                }
            }
            .padding()
            .background(Color(nsColor: .textBackgroundColor))
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }
    
    private func errorSection(_ error: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Error")
                .font(.headline)
            
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(.red)
                Text(error)
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.red.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }
    
    private var statusIcon: String {
        switch deployment.status {
        case .pending: return "clock"
        case .running: return "arrow.triangle.2.circlepath"
        case .success: return "checkmark.circle.fill"
        case .failed: return "xmark.circle.fill"
        case .cancelled: return "stop.circle.fill"
        case .rolledBack: return "arrow.uturn.backward.circle.fill"
        }
    }
    
    private var statusColor: Color {
        switch deployment.status {
        case .pending: return .gray
        case .running: return .blue
        case .success: return .green
        case .failed: return .red
        case .cancelled: return .orange
        case .rolledBack: return .purple
        }
    }
    
    private func logColor(_ level: LogLevel) -> Color {
        switch level {
        case .debug: return .gray
        case .info: return .blue
        case .warn: return .orange
        case .error: return .red
        case .success: return .green
        }
    }
    
    private func formatDuration(_ seconds: Int) -> String {
        if seconds < 60 {
            return "\(seconds)s"
        } else if seconds < 3600 {
            return "\(seconds / 60)m"
        } else {
            return "\(seconds / 3600)h \((seconds % 3600) / 60)m"
        }
    }
}

struct StatBox: View {
    let title: String
    let value: String
    let icon: String
    
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title2.bold())
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

// MARK: - Preview

#Preview {
    HistoryView()
        .environmentObject(AppState())
        .frame(width: 1200, height: 800)
}
