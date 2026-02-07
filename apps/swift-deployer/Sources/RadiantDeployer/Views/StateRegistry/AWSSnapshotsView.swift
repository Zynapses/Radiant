import SwiftUI

// MARK: - AWS Snapshot Models

struct AWSSnapshotConfig: Codable, Sendable {
    var enabled: Bool = true
    var scheduleType: ScheduleType = .cron
    var intervalHours: Int = 24
    var cronExpression: String? = "0 10 * * *"
    var timezone: String = "America/Los_Angeles"
    
    var snapshotRDS: Bool = true
    var snapshotS3: Bool = true
    var snapshotSecrets: Bool = true
    var snapshotDynamoDB: Bool = true
    
    var retentionDays: Int = 30
    var maxSnapshots: Int? = nil
    
    var storageClass: StorageClass = .standard
    var crossRegionReplication: Bool = false
    var replicationRegion: String? = nil
    
    var notifyOnSuccess: Bool = false
    var notifyOnFailure: Bool = true
    var notificationChannels: [String] = ["email"]
    
    enum ScheduleType: String, Codable, CaseIterable {
        case interval
        case cron
    }
    
    enum StorageClass: String, Codable, CaseIterable {
        case standard = "STANDARD"
        case standardIA = "STANDARD_IA"
        case glacier = "GLACIER"
        case deepArchive = "DEEP_ARCHIVE"
    }
}

struct AWSSnapshot: Identifiable, Codable, Sendable {
    let id: String
    let environment: String
    let createdAt: Date
    var completedAt: Date?
    let expiresAt: Date
    let type: SnapshotType
    let trigger: SnapshotTrigger
    var triggeredBy: String?
    var status: SnapshotStatus
    var progress: SnapshotProgress
    var components: [AWSSnapshotComponent]
    var description: String?
    var tags: [String: String]
    var totalSizeBytes: Int64
    var estimatedMonthlyCostUSD: Double
    var restoreCount: Int
    var errors: [AWSSnapshotError]
    
    enum SnapshotType: String, Codable, CaseIterable {
        case scheduled
        case manual
        case preDeployment = "pre-deployment"
        case preSync = "pre-sync"
    }
    
    enum SnapshotTrigger: String, Codable {
        case automatic
        case user
        case system
    }
    
    enum SnapshotStatus: String, Codable {
        case pending
        case inProgress = "in_progress"
        case completed
        case failed
        case expired
        case deleted
    }
    
    struct SnapshotProgress: Codable, Sendable {
        var phase: String
        var percentComplete: Int
        var currentComponent: String?
    }
}

struct AWSSnapshotComponent: Identifiable, Codable, Sendable {
    var id: String { "\(type.rawValue)-\(name)" }
    let type: ComponentType
    let name: String
    let arn: String
    var awsSnapshotId: String?
    var awsSnapshotArn: String?
    var versionId: String?
    var status: ComponentStatus
    var startedAt: Date?
    var completedAt: Date?
    var sizeBytes: Int64
    var checksum: String?
    var error: String?
    
    enum ComponentType: String, Codable {
        case rdsCluster = "rds_cluster"
        case rdsInstance = "rds_instance"
        case s3Bucket = "s3_bucket"
        case dynamodbTable = "dynamodb_table"
        case secret
    }
    
    enum ComponentStatus: String, Codable {
        case pending
        case inProgress = "in_progress"
        case completed
        case failed
        case skipped
    }
}

struct AWSSnapshotError: Identifiable, Codable, Sendable {
    var id: String { "\(timestamp)-\(code)" }
    let timestamp: Date
    var component: String?
    let code: String
    let message: String
    var awsErrorCode: String?
    let recoverable: Bool
    var suggestedAction: String?
}

// MARK: - AWS Snapshots View

struct AWSSnapshotsView: View {
    @StateObject private var viewModel = AWSSnapshotsViewModel()
    @State private var showCreateSheet = false
    @State private var showConfigSheet = false
    @State private var selectedSnapshot: AWSSnapshot?
    @State private var showRestoreConfirmation = false
    @State private var showDeleteConfirmation = false
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("AWS Snapshots")
                        .font(.title2)
                        .fontWeight(.semibold)
                    Text("Automated infrastructure snapshots for disaster recovery")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                
                Spacer()
                
                HStack(spacing: 12) {
                    Button {
                        Task { await viewModel.refresh() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .disabled(viewModel.isLoading)
                    
                    Button {
                        showConfigSheet = true
                    } label: {
                        Image(systemName: "gear")
                    }
                    
                    Button {
                        showCreateSheet = true
                    } label: {
                        Label("Create Snapshot", systemImage: "camera.fill")
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
            .padding()
            
            Divider()
            
            // Summary Cards
            HStack(spacing: 16) {
                SummaryCard(
                    title: "Total Snapshots",
                    value: "\(viewModel.snapshots.count)",
                    subtitle: "\(viewModel.snapshots.filter { $0.status == .completed }.count) completed",
                    icon: "camera.fill",
                    color: .blue
                )
                
                SummaryCard(
                    title: "Total Size",
                    value: formatBytes(viewModel.totalSize),
                    subtitle: "Across all snapshots",
                    icon: "internaldrive.fill",
                    color: .green
                )
                
                SummaryCard(
                    title: "Est. Monthly Cost",
                    value: String(format: "$%.2f", viewModel.totalCost),
                    subtitle: "For storage",
                    icon: "dollarsign.circle.fill",
                    color: .orange
                )
                
                SummaryCard(
                    title: "Next Scheduled",
                    value: "2:00 AM",
                    subtitle: "Pacific Time (daily)",
                    icon: "calendar.badge.clock",
                    color: .purple
                )
            }
            .padding()
            
            Divider()
            
            // Snapshots List
            if viewModel.isLoading {
                Spacer()
                ProgressView("Loading snapshots...")
                Spacer()
            } else if viewModel.snapshots.isEmpty {
                Spacer()
                VStack(spacing: 16) {
                    Image(systemName: "icloud.slash")
                        .font(.system(size: 48))
                        .foregroundStyle(.secondary)
                    Text("No Snapshots")
                        .font(.headline)
                    Text("Create your first snapshot to enable disaster recovery")
                        .foregroundStyle(.secondary)
                    Button("Create Snapshot") {
                        showCreateSheet = true
                    }
                    .buttonStyle(.borderedProminent)
                }
                Spacer()
            } else {
                List(viewModel.snapshots, selection: $selectedSnapshot) { snapshot in
                    SnapshotRow(snapshot: snapshot)
                        .tag(snapshot)
                        .contextMenu {
                            if snapshot.status == .completed {
                                Button {
                                    selectedSnapshot = snapshot
                                    showRestoreConfirmation = true
                                } label: {
                                    Label("Restore", systemImage: "arrow.uturn.backward")
                                }
                            }
                            
                            Button {
                                selectedSnapshot = snapshot
                                // Show details
                            } label: {
                                Label("View Details", systemImage: "info.circle")
                            }
                            
                            Divider()
                            
                            Button(role: .destructive) {
                                selectedSnapshot = snapshot
                                showDeleteConfirmation = true
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                }
                .listStyle(.inset)
            }
        }
        .sheet(isPresented: $showCreateSheet) {
            CreateSnapshotSheet(viewModel: viewModel)
        }
        .sheet(isPresented: $showConfigSheet) {
            SnapshotConfigSheet(config: $viewModel.config, onSave: {
                Task { await viewModel.saveConfig() }
            })
        }
        .alert("Restore Snapshot?", isPresented: $showRestoreConfirmation) {
            Button("Cancel", role: .cancel) {}
            Button("Restore") {
                if let snapshot = selectedSnapshot {
                    Task { await viewModel.restoreSnapshot(snapshot) }
                }
            }
        } message: {
            Text("This will create a new RDS cluster from the snapshot. The restore process takes approximately 5-15 minutes. Your current data will NOT be affected.")
        }
        .alert("Delete Snapshot?", isPresented: $showDeleteConfirmation) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                if let snapshot = selectedSnapshot {
                    Task { await viewModel.deleteSnapshot(snapshot) }
                }
            }
        } message: {
            Text("This will permanently delete the snapshot and all associated AWS resources. This action cannot be undone.")
        }
        .task {
            await viewModel.refresh()
        }
    }
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .binary
        return formatter.string(fromByteCount: bytes)
    }
}

// MARK: - Summary Card

struct SummaryCard: View {
    let title: String
    let value: String
    let subtitle: String
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Image(systemName: icon)
                    .foregroundStyle(color)
            }
            
            Text(value)
                .font(.title2)
                .fontWeight(.bold)
            
            Text(subtitle)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity)
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(8)
    }
}

// MARK: - Snapshot Row

struct SnapshotRow: View {
    let snapshot: AWSSnapshot
    
    var body: some View {
        HStack(spacing: 16) {
            // Status Icon
            statusIcon
                .frame(width: 32)
            
            // Info
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(snapshot.id.prefix(16))
                        .font(.system(.body, design: .monospaced))
                    
                    Text("...")
                        .foregroundStyle(.secondary)
                    
                    Spacer()
                    
                    statusBadge
                }
                
                HStack {
                    Text(snapshot.createdAt, style: .date)
                    Text("•")
                        .foregroundStyle(.secondary)
                    Text(snapshot.createdAt, style: .relative)
                        .foregroundStyle(.secondary)
                    
                    Spacer()
                    
                    // Component icons
                    componentIcons
                }
                .font(.caption)
            }
            
            // Size
            VStack(alignment: .trailing) {
                Text(formatBytes(snapshot.totalSizeBytes))
                    .font(.caption)
                Text("Expires \(snapshot.expiresAt, style: .date)")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
    
    @ViewBuilder
    private var statusIcon: some View {
        switch snapshot.status {
        case .completed:
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(.green)
        case .inProgress:
            ProgressView()
                .scaleEffect(0.8)
        case .failed:
            Image(systemName: "xmark.circle.fill")
                .foregroundStyle(.red)
        case .expired:
            Image(systemName: "clock.fill")
                .foregroundStyle(.secondary)
        case .pending:
            Image(systemName: "clock")
                .foregroundStyle(.orange)
        case .deleted:
            Image(systemName: "trash.fill")
                .foregroundStyle(.secondary)
        }
    }
    
    @ViewBuilder
    private var statusBadge: some View {
        Text(snapshot.status.rawValue.capitalized)
            .font(.caption2)
            .fontWeight(.medium)
            .padding(.horizontal, 8)
            .padding(.vertical, 2)
            .background(statusColor.opacity(0.2))
            .foregroundStyle(statusColor)
            .cornerRadius(4)
    }
    
    private var statusColor: Color {
        switch snapshot.status {
        case .completed: return .green
        case .inProgress: return .blue
        case .failed: return .red
        case .expired: return .gray
        case .pending: return .orange
        case .deleted: return .gray
        }
    }
    
    @ViewBuilder
    private var componentIcons: some View {
        HStack(spacing: 4) {
            if snapshot.components.contains(where: { $0.type == .rdsCluster }) {
                Image(systemName: "cylinder.fill")
                    .foregroundStyle(.blue)
                    .help("RDS Cluster")
            }
            if snapshot.components.contains(where: { $0.type == .s3Bucket }) {
                Image(systemName: "externaldrive.fill")
                    .foregroundStyle(.green)
                    .help("S3 Bucket")
            }
            if snapshot.components.contains(where: { $0.type == .secret }) {
                Image(systemName: "key.fill")
                    .foregroundStyle(.yellow)
                    .help("Secrets")
            }
            if snapshot.components.contains(where: { $0.type == .dynamodbTable }) {
                Image(systemName: "tablecells.fill")
                    .foregroundStyle(.orange)
                    .help("DynamoDB")
            }
        }
        .font(.caption)
    }
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .binary
        return formatter.string(fromByteCount: bytes)
    }
}

// MARK: - Create Snapshot Sheet

struct CreateSnapshotSheet: View {
    @ObservedObject var viewModel: AWSSnapshotsViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var description = ""
    @State private var includeRDS = true
    @State private var includeS3 = true
    @State private var includeSecrets = true
    @State private var includeDynamoDB = true
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Create Manual Snapshot")
                    .font(.headline)
                Spacer()
                Button("Cancel") { dismiss() }
            }
            .padding()
            
            Divider()
            
            Form {
                Section {
                    TextField("Description (optional)", text: $description)
                        .textFieldStyle(.roundedBorder)
                } header: {
                    Text("Description")
                }
                
                Section {
                    Toggle("Aurora PostgreSQL (RDS)", isOn: $includeRDS)
                    Toggle("S3 Buckets", isOn: $includeS3)
                    Toggle("Secrets Manager", isOn: $includeSecrets)
                    Toggle("DynamoDB Tables", isOn: $includeDynamoDB)
                } header: {
                    Text("Components to Include")
                }
                
                Section {
                    HStack {
                        Image(systemName: "info.circle.fill")
                            .foregroundStyle(.blue)
                        Text("Snapshots do NOT cause downtime for users")
                            .font(.callout)
                    }
                    .padding(.vertical, 4)
                }
            }
            .formStyle(.grouped)
            
            Divider()
            
            // Footer
            HStack {
                Spacer()
                Button("Create Snapshot") {
                    Task {
                        await viewModel.createSnapshot(
                            description: description.isEmpty ? nil : description,
                            includeRDS: includeRDS,
                            includeS3: includeS3,
                            includeSecrets: includeSecrets,
                            includeDynamoDB: includeDynamoDB
                        )
                        dismiss()
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(viewModel.isCreating)
            }
            .padding()
        }
        .frame(width: 500, height: 450)
    }
}

// MARK: - Snapshot Config Sheet

struct SnapshotConfigSheet: View {
    @Binding var config: AWSSnapshotConfig
    let onSave: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var scheduleHour = 2
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Snapshot Configuration")
                    .font(.headline)
                Spacer()
                Button("Cancel") { dismiss() }
            }
            .padding()
            
            Divider()
            
            Form {
                Section {
                    Toggle("Enable Automated Snapshots", isOn: $config.enabled)
                } header: {
                    Text("Schedule")
                } footer: {
                    Text("Automatically create snapshots on the configured schedule")
                }
                
                Section {
                    Picker("Schedule Type", selection: $config.scheduleType) {
                        Text("Interval").tag(AWSSnapshotConfig.ScheduleType.interval)
                        Text("Daily at specific time").tag(AWSSnapshotConfig.ScheduleType.cron)
                    }
                    
                    if config.scheduleType == .interval {
                        Stepper("Every \(config.intervalHours) hours", value: $config.intervalHours, in: 1...168)
                    } else {
                        Picker("Time (Pacific)", selection: $scheduleHour) {
                            ForEach(0..<24, id: \.self) { hour in
                                Text("\(hour):00").tag(hour)
                            }
                        }
                        .onChange(of: scheduleHour) { _, newValue in
                            config.cronExpression = "0 \(newValue + 8) * * *" // PT to UTC
                        }
                    }
                }
                
                Section {
                    Stepper("Keep for \(config.retentionDays) days", value: $config.retentionDays, in: 1...365)
                } header: {
                    Text("Retention")
                } footer: {
                    Text("Snapshots older than \(config.retentionDays) days will be automatically deleted")
                }
                
                Section {
                    Toggle("Aurora PostgreSQL (RDS)", isOn: $config.snapshotRDS)
                    Toggle("S3 Buckets", isOn: $config.snapshotS3)
                    Toggle("Secrets Manager", isOn: $config.snapshotSecrets)
                    Toggle("DynamoDB Tables", isOn: $config.snapshotDynamoDB)
                } header: {
                    Text("Components")
                }
                
                Section {
                    Toggle("Notify on success", isOn: $config.notifyOnSuccess)
                    Toggle("Notify on failure", isOn: $config.notifyOnFailure)
                } header: {
                    Text("Notifications")
                }
            }
            .formStyle(.grouped)
            
            Divider()
            
            // Footer
            HStack {
                Spacer()
                Button("Save Configuration") {
                    onSave()
                    dismiss()
                }
                .buttonStyle(.borderedProminent)
            }
            .padding()
        }
        .frame(width: 500, height: 600)
        .onAppear {
            if let cron = config.cronExpression {
                let parts = cron.split(separator: " ")
                if parts.count >= 2, let hour = Int(parts[1]) {
                    scheduleHour = max(0, hour - 8) // UTC to PT
                }
            }
        }
    }
}

// MARK: - View Model

@MainActor
class AWSSnapshotsViewModel: ObservableObject {
    @Published var snapshots: [AWSSnapshot] = []
    @Published var config = AWSSnapshotConfig()
    @Published var isLoading = false
    @Published var isCreating = false
    @Published var isRestoring = false
    @Published var error: String?
    
    private let region = "us-east-1"
    private let environment: String
    private let snapshotService = AWSSnapshotService.shared
    
    init(environment: String = "prod") {
        self.environment = environment
        loadConfig()
    }
    
    var totalSize: Int64 {
        snapshots.reduce(0) { $0 + $1.totalSizeBytes }
    }
    
    var totalCost: Double {
        snapshots.reduce(0) { $0 + $1.estimatedMonthlyCostUSD }
    }
    
    private func loadConfig() {
        if let data = UserDefaults.standard.data(forKey: "awsSnapshotConfig"),
           let saved = try? JSONDecoder().decode(AWSSnapshotConfig.self, from: data) {
            config = saved
        }
    }
    
    func refresh() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        
        do {
            let fetchedSnapshots = try await snapshotService.listSnapshots(
                environment: environment,
                region: region
            )
            await MainActor.run {
                self.snapshots = fetchedSnapshots.sorted { $0.createdAt > $1.createdAt }
            }
        } catch {
            await MainActor.run {
                self.error = error.localizedDescription
            }
        }
    }
    
    func createSnapshot(
        description: String?,
        includeRDS: Bool,
        includeS3: Bool,
        includeSecrets: Bool,
        includeDynamoDB: Bool
    ) async {
        isCreating = true
        error = nil
        defer { isCreating = false }
        
        do {
            let snapshot = try await snapshotService.createSnapshot(
                environment: environment,
                region: region,
                description: description,
                includeRDS: includeRDS,
                includeS3: includeS3,
                includeSecrets: includeSecrets,
                includeDynamoDB: includeDynamoDB
            )
            await MainActor.run {
                self.snapshots.insert(snapshot, at: 0)
            }
        } catch {
            await MainActor.run {
                self.error = error.localizedDescription
            }
        }
    }
    
    func restoreSnapshot(_ snapshot: AWSSnapshot) async {
        isRestoring = true
        error = nil
        defer { isRestoring = false }
        
        do {
            try await snapshotService.restoreSnapshot(
                snapshotId: snapshot.id,
                environment: environment,
                region: region
            )
            await refresh()
        } catch {
            await MainActor.run {
                self.error = error.localizedDescription
            }
        }
    }
    
    func deleteSnapshot(_ snapshot: AWSSnapshot) async {
        error = nil
        
        do {
            try await snapshotService.deleteSnapshot(
                snapshotId: snapshot.id,
                environment: environment,
                region: region
            )
            await MainActor.run {
                self.snapshots.removeAll { $0.id == snapshot.id }
            }
        } catch {
            await MainActor.run {
                self.error = error.localizedDescription
            }
        }
    }
    
    func saveConfig() async {
        if let data = try? JSONEncoder().encode(config) {
            UserDefaults.standard.set(data, forKey: "awsSnapshotConfig")
        }
        
        do {
            try await snapshotService.updateSnapshotSchedule(
                environment: environment,
                region: region,
                config: config
            )
        } catch {
            await MainActor.run {
                self.error = error.localizedDescription
            }
        }
    }
}

// MARK: - AWS Snapshot Service

actor AWSSnapshotService {
    static let shared = AWSSnapshotService()
    
    private init() {}
    
    func listSnapshots(environment: String, region: String) async throws -> [AWSSnapshot] {
        var snapshots: [AWSSnapshot] = []
        
        // Fetch RDS snapshots
        let rdsSnapshots = try await listRDSSnapshots(environment: environment, region: region)
        snapshots.append(contentsOf: rdsSnapshots)
        
        // Fetch DynamoDB backups
        let dynamoSnapshots = try await listDynamoDBBackups(environment: environment, region: region)
        for dynamoSnapshot in dynamoSnapshots {
            if let existingIndex = snapshots.firstIndex(where: { isSameSnapshotGroup($0, dynamoSnapshot) }) {
                snapshots[existingIndex].components.append(contentsOf: dynamoSnapshot.components)
                snapshots[existingIndex].totalSizeBytes += dynamoSnapshot.totalSizeBytes
            } else {
                snapshots.append(dynamoSnapshot)
            }
        }
        
        return snapshots
    }
    
    private func isSameSnapshotGroup(_ a: AWSSnapshot, _ b: AWSSnapshot) -> Bool {
        let timeDiff = abs(a.createdAt.timeIntervalSince(b.createdAt))
        return timeDiff < 300 // Within 5 minutes
    }
    
    private func listRDSSnapshots(environment: String, region: String) async throws -> [AWSSnapshot] {
        let output = try await runAWSCommand([
            "rds", "describe-db-cluster-snapshots",
            "--region", region,
            "--query", "DBClusterSnapshots[?contains(DBClusterSnapshotIdentifier, 'radiant-\(environment)')]",
            "--output", "json"
        ])
        
        guard let data = output.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            return []
        }
        
        return json.compactMap { item -> AWSSnapshot? in
            guard let snapshotId = item["DBClusterSnapshotIdentifier"] as? String,
                  let arn = item["DBClusterSnapshotArn"] as? String,
                  let statusStr = item["Status"] as? String,
                  let createdAtStr = item["SnapshotCreateTime"] as? String else {
                return nil
            }
            
            let dateFormatter = ISO8601DateFormatter()
            dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            let createdAt = dateFormatter.date(from: createdAtStr) ?? Date()
            
            let status: AWSSnapshot.SnapshotStatus = switch statusStr {
            case "available": .completed
            case "creating", "backing-up": .inProgress
            case "failed": .failed
            case "deleting": .deleted
            default: .pending
            }
            
            let sizeBytes = Int64((item["AllocatedStorage"] as? Int ?? 0)) * 1024 * 1024 * 1024
            let storageCostPerGBMonth = 0.021
            let estimatedCost = Double(sizeBytes) / (1024 * 1024 * 1024) * storageCostPerGBMonth
            
            let component = AWSSnapshotComponent(
                type: .rdsCluster,
                name: item["DBClusterIdentifier"] as? String ?? "unknown",
                arn: arn,
                awsSnapshotId: snapshotId,
                awsSnapshotArn: arn,
                versionId: nil,
                status: status == .completed ? .completed : .inProgress,
                startedAt: createdAt,
                completedAt: status == .completed ? createdAt : nil,
                sizeBytes: sizeBytes,
                checksum: nil,
                error: nil
            )
            
            let snapshotType: AWSSnapshot.SnapshotType = snapshotId.contains("manual") ? .manual : .scheduled
            
            return AWSSnapshot(
                id: snapshotId,
                environment: environment,
                createdAt: createdAt,
                completedAt: status == .completed ? createdAt : nil,
                expiresAt: createdAt.addingTimeInterval(30 * 24 * 3600),
                type: snapshotType,
                trigger: snapshotType == .manual ? .user : .automatic,
                triggeredBy: nil,
                status: status,
                progress: AWSSnapshot.SnapshotProgress(
                    phase: status == .completed ? "Complete" : "In Progress",
                    percentComplete: status == .completed ? 100 : 50,
                    currentComponent: nil
                ),
                components: [component],
                description: nil,
                tags: [:],
                totalSizeBytes: sizeBytes,
                estimatedMonthlyCostUSD: estimatedCost,
                restoreCount: 0,
                errors: []
            )
        }
    }
    
    private func listDynamoDBBackups(environment: String, region: String) async throws -> [AWSSnapshot] {
        let output = try await runAWSCommand([
            "dynamodb", "list-backups",
            "--region", region,
            "--output", "json"
        ])
        
        guard let data = output.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let backups = json["BackupSummaries"] as? [[String: Any]] else {
            return []
        }
        
        return backups.compactMap { item -> AWSSnapshot? in
            guard let backupArn = item["BackupArn"] as? String,
                  let tableName = item["TableName"] as? String,
                  tableName.contains("radiant") || tableName.contains(environment),
                  let statusStr = item["BackupStatus"] as? String,
                  let createdAtEpoch = item["BackupCreationDateTime"] as? Double else {
                return nil
            }
            
            let createdAt = Date(timeIntervalSince1970: createdAtEpoch)
            let status: AWSSnapshot.SnapshotStatus = statusStr == "AVAILABLE" ? .completed : .inProgress
            let sizeBytes = Int64((item["BackupSizeBytes"] as? Int) ?? 0)
            
            let component = AWSSnapshotComponent(
                type: .dynamodbTable,
                name: tableName,
                arn: backupArn,
                awsSnapshotId: item["BackupName"] as? String,
                awsSnapshotArn: backupArn,
                versionId: nil,
                status: status == .completed ? .completed : .inProgress,
                startedAt: createdAt,
                completedAt: status == .completed ? createdAt : nil,
                sizeBytes: sizeBytes,
                checksum: nil,
                error: nil
            )
            
            return AWSSnapshot(
                id: backupArn.components(separatedBy: "/").last ?? UUID().uuidString,
                environment: environment,
                createdAt: createdAt,
                completedAt: status == .completed ? createdAt : nil,
                expiresAt: createdAt.addingTimeInterval(30 * 24 * 3600),
                type: .manual,
                trigger: .user,
                triggeredBy: nil,
                status: status,
                progress: AWSSnapshot.SnapshotProgress(
                    phase: status == .completed ? "Complete" : "In Progress",
                    percentComplete: status == .completed ? 100 : 50,
                    currentComponent: nil
                ),
                components: [component],
                description: nil,
                tags: [:],
                totalSizeBytes: sizeBytes,
                estimatedMonthlyCostUSD: Double(sizeBytes) / (1024 * 1024 * 1024) * 0.10,
                restoreCount: 0,
                errors: []
            )
        }
    }
    
    func createSnapshot(
        environment: String,
        region: String,
        description: String?,
        includeRDS: Bool,
        includeS3: Bool,
        includeSecrets: Bool,
        includeDynamoDB: Bool
    ) async throws -> AWSSnapshot {
        let snapshotId = "radiant-\(environment)-manual-\(Int(Date().timeIntervalSince1970))"
        var components: [AWSSnapshotComponent] = []
        var totalSize: Int64 = 0
        var errors: [AWSSnapshotError] = []
        
        // Create RDS snapshot
        if includeRDS {
            do {
                let rdsComponent = try await createRDSSnapshot(
                    environment: environment,
                    region: region,
                    snapshotId: snapshotId
                )
                components.append(rdsComponent)
                totalSize += rdsComponent.sizeBytes
            } catch {
                errors.append(AWSSnapshotError(
                    timestamp: Date(),
                    component: "RDS",
                    code: "RDS_SNAPSHOT_FAILED",
                    message: error.localizedDescription,
                    awsErrorCode: nil,
                    recoverable: true,
                    suggestedAction: "Retry the snapshot or check RDS cluster status"
                ))
            }
        }
        
        // Create DynamoDB backups
        if includeDynamoDB {
            do {
                let dynamoComponents = try await createDynamoDBBackups(
                    environment: environment,
                    region: region,
                    snapshotId: snapshotId
                )
                components.append(contentsOf: dynamoComponents)
                totalSize += dynamoComponents.reduce(0) { $0 + $1.sizeBytes }
            } catch {
                errors.append(AWSSnapshotError(
                    timestamp: Date(),
                    component: "DynamoDB",
                    code: "DYNAMODB_BACKUP_FAILED",
                    message: error.localizedDescription,
                    awsErrorCode: nil,
                    recoverable: true,
                    suggestedAction: "Retry the backup or check DynamoDB table status"
                ))
            }
        }
        
        // Create Secrets backup (export to S3)
        if includeSecrets {
            do {
                let secretsComponent = try await backupSecrets(
                    environment: environment,
                    region: region,
                    snapshotId: snapshotId
                )
                components.append(secretsComponent)
                totalSize += secretsComponent.sizeBytes
            } catch {
                errors.append(AWSSnapshotError(
                    timestamp: Date(),
                    component: "Secrets",
                    code: "SECRETS_BACKUP_FAILED",
                    message: error.localizedDescription,
                    awsErrorCode: nil,
                    recoverable: true,
                    suggestedAction: "Check Secrets Manager permissions"
                ))
            }
        }
        
        let now = Date()
        return AWSSnapshot(
            id: snapshotId,
            environment: environment,
            createdAt: now,
            completedAt: errors.isEmpty ? now : nil,
            expiresAt: now.addingTimeInterval(30 * 24 * 3600),
            type: .manual,
            trigger: .user,
            triggeredBy: NSUserName(),
            status: errors.isEmpty ? .completed : (components.isEmpty ? .failed : .completed),
            progress: AWSSnapshot.SnapshotProgress(
                phase: "Complete",
                percentComplete: 100,
                currentComponent: nil
            ),
            components: components,
            description: description,
            tags: ["Environment": environment, "CreatedBy": "RadiantDeployer"],
            totalSizeBytes: totalSize,
            estimatedMonthlyCostUSD: Double(totalSize) / (1024 * 1024 * 1024) * 0.023,
            restoreCount: 0,
            errors: errors
        )
    }
    
    private func createRDSSnapshot(environment: String, region: String, snapshotId: String) async throws -> AWSSnapshotComponent {
        // Find the RDS cluster
        let clusterOutput = try await runAWSCommand([
            "rds", "describe-db-clusters",
            "--region", region,
            "--query", "DBClusters[?contains(DBClusterIdentifier, 'radiant-\(environment)')].[DBClusterIdentifier,DBClusterArn]",
            "--output", "json"
        ])
        
        guard let data = clusterOutput.data(using: .utf8),
              let clusters = try? JSONSerialization.jsonObject(with: data) as? [[Any]],
              let firstCluster = clusters.first,
              let clusterId = firstCluster[0] as? String,
              let clusterArn = firstCluster[1] as? String else {
            throw SnapshotError.noResourceFound("No RDS cluster found for environment \(environment)")
        }
        
        // Create the snapshot
        let createOutput = try await runAWSCommand([
            "rds", "create-db-cluster-snapshot",
            "--db-cluster-identifier", clusterId,
            "--db-cluster-snapshot-identifier", snapshotId,
            "--region", region,
            "--output", "json"
        ])
        
        guard let createData = createOutput.data(using: .utf8),
              let result = try? JSONSerialization.jsonObject(with: createData) as? [String: Any],
              let snapshot = result["DBClusterSnapshot"] as? [String: Any],
              let snapshotArn = snapshot["DBClusterSnapshotArn"] as? String else {
            throw SnapshotError.createFailed("Failed to create RDS snapshot")
        }
        
        return AWSSnapshotComponent(
            type: .rdsCluster,
            name: clusterId,
            arn: clusterArn,
            awsSnapshotId: snapshotId,
            awsSnapshotArn: snapshotArn,
            versionId: nil,
            status: .inProgress,
            startedAt: Date(),
            completedAt: nil,
            sizeBytes: 0,
            checksum: nil,
            error: nil
        )
    }
    
    private func createDynamoDBBackups(environment: String, region: String, snapshotId: String) async throws -> [AWSSnapshotComponent] {
        // List tables
        let tablesOutput = try await runAWSCommand([
            "dynamodb", "list-tables",
            "--region", region,
            "--output", "json"
        ])
        
        guard let data = tablesOutput.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let tableNames = json["TableNames"] as? [String] else {
            return []
        }
        
        let radiantTables = tableNames.filter { $0.contains("radiant") || $0.contains(environment) }
        var components: [AWSSnapshotComponent] = []
        
        for tableName in radiantTables {
            let backupName = "\(snapshotId)-\(tableName)"
            let backupOutput = try await runAWSCommand([
                "dynamodb", "create-backup",
                "--table-name", tableName,
                "--backup-name", backupName,
                "--region", region,
                "--output", "json"
            ])
            
            if let backupData = backupOutput.data(using: .utf8),
               let backupJson = try? JSONSerialization.jsonObject(with: backupData) as? [String: Any],
               let backupDetails = backupJson["BackupDetails"] as? [String: Any],
               let backupArn = backupDetails["BackupArn"] as? String {
                
                components.append(AWSSnapshotComponent(
                    type: .dynamodbTable,
                    name: tableName,
                    arn: "arn:aws:dynamodb:\(region):*:table/\(tableName)",
                    awsSnapshotId: backupName,
                    awsSnapshotArn: backupArn,
                    versionId: nil,
                    status: .inProgress,
                    startedAt: Date(),
                    completedAt: nil,
                    sizeBytes: 0,
                    checksum: nil,
                    error: nil
                ))
            }
        }
        
        return components
    }
    
    private func backupSecrets(environment: String, region: String, snapshotId: String) async throws -> AWSSnapshotComponent {
        // List secrets
        let secretsOutput = try await runAWSCommand([
            "secretsmanager", "list-secrets",
            "--region", region,
            "--query", "SecretList[?contains(Name, 'radiant') || contains(Name, '\(environment)')].[Name,ARN]",
            "--output", "json"
        ])
        
        guard let data = secretsOutput.data(using: .utf8),
              let secrets = try? JSONSerialization.jsonObject(with: data) as? [[Any]] else {
            throw SnapshotError.noResourceFound("No secrets found")
        }
        
        // Export secrets metadata (not values) to S3
        var secretsManifest: [[String: Any]] = []
        for secret in secrets {
            if let name = secret[0] as? String, let arn = secret[1] as? String {
                secretsManifest.append(["name": name, "arn": arn, "backedUp": Date().ISO8601Format()])
            }
        }
        
        let manifestData = try JSONSerialization.data(withJSONObject: secretsManifest)
        let manifestPath = FileManager.default.temporaryDirectory.appendingPathComponent("\(snapshotId)-secrets.json")
        try manifestData.write(to: manifestPath)
        
        // Upload to S3
        let bucket = "radiant-\(environment)-backups"
        _ = try? await runAWSCommand([
            "s3", "cp", manifestPath.path,
            "s3://\(bucket)/snapshots/\(snapshotId)/secrets-manifest.json",
            "--region", region
        ])
        
        try? FileManager.default.removeItem(at: manifestPath)
        
        return AWSSnapshotComponent(
            type: .secret,
            name: "secrets-manifest",
            arn: "arn:aws:s3:::\(bucket)/snapshots/\(snapshotId)/secrets-manifest.json",
            awsSnapshotId: snapshotId,
            awsSnapshotArn: nil,
            versionId: nil,
            status: .completed,
            startedAt: Date(),
            completedAt: Date(),
            sizeBytes: Int64(manifestData.count),
            checksum: nil,
            error: nil
        )
    }
    
    func restoreSnapshot(snapshotId: String, environment: String, region: String) async throws {
        // Find the RDS snapshot
        let snapshotOutput = try await runAWSCommand([
            "rds", "describe-db-cluster-snapshots",
            "--db-cluster-snapshot-identifier", snapshotId,
            "--region", region,
            "--output", "json"
        ])
        
        guard let data = snapshotOutput.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let snapshots = json["DBClusterSnapshots"] as? [[String: Any]],
              let snapshot = snapshots.first,
              let originalClusterId = snapshot["DBClusterIdentifier"] as? String else {
            throw SnapshotError.noResourceFound("Snapshot not found: \(snapshotId)")
        }
        
        // Create a new cluster from snapshot with a temporary name
        let restoredClusterId = "\(originalClusterId)-restored-\(Int(Date().timeIntervalSince1970))"
        
        _ = try await runAWSCommand([
            "rds", "restore-db-cluster-from-snapshot",
            "--db-cluster-identifier", restoredClusterId,
            "--snapshot-identifier", snapshotId,
            "--engine", "aurora-postgresql",
            "--region", region,
            "--output", "json"
        ])
    }
    
    func deleteSnapshot(snapshotId: String, environment: String, region: String) async throws {
        // Delete RDS snapshot if exists
        _ = try? await runAWSCommand([
            "rds", "delete-db-cluster-snapshot",
            "--db-cluster-snapshot-identifier", snapshotId,
            "--region", region
        ])
        
        // Delete DynamoDB backups with this prefix
        let backupsOutput = try await runAWSCommand([
            "dynamodb", "list-backups",
            "--region", region,
            "--output", "json"
        ])
        
        if let data = backupsOutput.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let backups = json["BackupSummaries"] as? [[String: Any]] {
            
            for backup in backups {
                if let backupArn = backup["BackupArn"] as? String,
                   let backupName = backup["BackupName"] as? String,
                   backupName.contains(snapshotId) {
                    _ = try? await runAWSCommand([
                        "dynamodb", "delete-backup",
                        "--backup-arn", backupArn,
                        "--region", region
                    ])
                }
            }
        }
        
        // Delete S3 snapshot folder
        let bucket = "radiant-\(environment)-backups"
        _ = try? await runAWSCommand([
            "s3", "rm", "s3://\(bucket)/snapshots/\(snapshotId)/",
            "--recursive",
            "--region", region
        ])
    }
    
    func updateSnapshotSchedule(environment: String, region: String, config: AWSSnapshotConfig) async throws {
        // Update EventBridge rule for scheduled snapshots
        let ruleName = "radiant-\(environment)-snapshot-schedule"
        
        if config.enabled {
            let scheduleExpression: String
            if config.scheduleType == .cron, let cron = config.cronExpression {
                scheduleExpression = "cron(\(cron))"
            } else {
                scheduleExpression = "rate(\(config.intervalHours) hours)"
            }
            
            _ = try await runAWSCommand([
                "events", "put-rule",
                "--name", ruleName,
                "--schedule-expression", scheduleExpression,
                "--state", "ENABLED",
                "--region", region
            ])
        } else {
            _ = try? await runAWSCommand([
                "events", "disable-rule",
                "--name", ruleName,
                "--region", region
            ])
        }
    }
    
    private func runAWSCommand(_ arguments: [String]) async throws -> String {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/local/bin/aws")
        process.arguments = arguments
        
        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe
        
        try process.run()
        process.waitUntilExit()
        
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        return String(data: data, encoding: .utf8) ?? ""
    }
    
    enum SnapshotError: LocalizedError {
        case noResourceFound(String)
        case createFailed(String)
        case restoreFailed(String)
        case deleteFailed(String)
        
        var errorDescription: String? {
            switch self {
            case .noResourceFound(let msg): return "Resource not found: \(msg)"
            case .createFailed(let msg): return "Create failed: \(msg)"
            case .restoreFailed(let msg): return "Restore failed: \(msg)"
            case .deleteFailed(let msg): return "Delete failed: \(msg)"
            }
        }
    }
}

#Preview {
    AWSSnapshotsView()
        .frame(width: 900, height: 600)
}
