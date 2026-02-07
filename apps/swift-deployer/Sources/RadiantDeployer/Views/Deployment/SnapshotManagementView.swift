// RADIANT - Snapshot Management View
// On-demand snapshot creation, restoration, and tiered storage management

import SwiftUI

struct SnapshotManagementView: View {
    @EnvironmentObject var appState: AppState
    
    @State private var snapshots: [SnapshotManager.Snapshot] = []
    @State private var selectedSnapshot: SnapshotManager.Snapshot?
    @State private var isCreating = false
    @State private var isRestoring = false
    @State private var creationProgress: Double = 0
    @State private var creationMessage = ""
    @State private var showCreateSheet = false
    @State private var showRestoreSheet = false
    @State private var showDeleteConfirmation = false
    @State private var error: String?
    
    // Create snapshot form
    @State private var newSnapshotName = ""
    @State private var newSnapshotDescription = ""
    @State private var snapshotType: SnapshotManager.SnapshotType = .full
    
    // Restore options
    @State private var restoreAurora = true
    @State private var restoreDynamoDB = true
    @State private var restoreToNewEnvironment = false
    @State private var targetEnvironment = ""
    
    // Filter
    @State private var selectedTierFilter: SnapshotManager.StorageTier?
    
    // Policy (read-only, fetched from SnapshotManager)
    @State private var currentPolicy: SnapshotManager.SnapshotPolicy = SnapshotManager.defaultPolicy
    
    private let snapshotManager = SnapshotManager.shared
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            header
            
            Divider()
            
            // Content
            HSplitView {
                // Snapshot list
                snapshotListView
                    .frame(minWidth: 300)
                
                // Detail/Actions
                if let snapshot = selectedSnapshot {
                    snapshotDetailView(snapshot)
                        .frame(minWidth: 400)
                } else {
                    emptySelectionView
                        .frame(minWidth: 400)
                }
            }
        }
        .sheet(isPresented: $showCreateSheet) {
            createSnapshotSheet
        }
        .sheet(isPresented: $showRestoreSheet) {
            if let snapshot = selectedSnapshot {
                restoreSnapshotSheet(snapshot)
            }
        }
        .alert("Delete Snapshot?", isPresented: $showDeleteConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                Task { await deleteSelectedSnapshot() }
            }
        } message: {
            Text("This will permanently delete the snapshot and all associated backups. This action cannot be undone.")
        }
        .task {
            await loadSnapshots()
        }
    }
    
    // MARK: - Header
    
    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Image(systemName: "camera.fill")
                        .foregroundColor(.blue)
                    Text("Snapshot Manager")
                        .font(.title2.bold())
                    
                    Text("v1.4.0")
                        .font(.caption)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.blue.opacity(0.1))
                        .foregroundColor(.blue)
                        .cornerRadius(4)
                }
                
                Text("Create, restore, and manage versioned snapshots with tiered storage")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            // Tier summary
            tierSummaryBadges
            
            Button {
                showCreateSheet = true
            } label: {
                Label("Create Snapshot", systemImage: "plus.circle.fill")
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }
    
    private var tierSummaryBadges: some View {
        HStack(spacing: 8) {
            ForEach(SnapshotManager.StorageTier.allCases, id: \.rawValue) { tier in
                let count = snapshots.filter { $0.storageTier == tier }.count
                if count > 0 {
                    HStack(spacing: 4) {
                        Circle()
                            .fill(tierColor(tier))
                            .frame(width: 8, height: 8)
                        Text("\(count)")
                            .font(.caption.bold())
                        Text(tier.rawValue.capitalized)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(tierColor(tier).opacity(0.1))
                    .cornerRadius(8)
                }
            }
        }
    }
    
    // MARK: - Snapshot List
    
    private var snapshotListView: some View {
        VStack(spacing: 0) {
            // Filter bar
            HStack {
                Text("Snapshots")
                    .font(.headline)
                
                Spacer()
                
                Picker("Filter", selection: $selectedTierFilter) {
                    Text("All").tag(nil as SnapshotManager.StorageTier?)
                    ForEach(SnapshotManager.StorageTier.allCases, id: \.rawValue) { tier in
                        Text(tier.rawValue.capitalized).tag(tier as SnapshotManager.StorageTier?)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 200)
            }
            .padding()
            
            Divider()
            
            // Snapshot list
            List(filteredSnapshots, id: \.id, selection: $selectedSnapshot) { snapshot in
                snapshotRow(snapshot)
                    .tag(snapshot)
            }
            .listStyle(.inset)
        }
    }
    
    private var filteredSnapshots: [SnapshotManager.Snapshot] {
        var filtered = snapshots
        if let tier = selectedTierFilter {
            filtered = filtered.filter { $0.storageTier == tier }
        }
        return filtered.sorted { $0.createdAt > $1.createdAt }
    }
    
    private func snapshotRow(_ snapshot: SnapshotManager.Snapshot) -> some View {
        HStack(spacing: 12) {
            // Status indicator
            Circle()
                .fill(statusColor(snapshot.status))
                .frame(width: 10, height: 10)
            
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(snapshot.name)
                        .font(.subheadline.bold())
                    
                    Text("v\(snapshot.version)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                HStack(spacing: 8) {
                    Label(snapshot.snapshotType.rawValue, systemImage: typeIcon(snapshot.snapshotType))
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    Label(tierLabel(snapshot.storageTier), systemImage: "archivebox")
                        .font(.caption)
                        .foregroundColor(tierColor(snapshot.storageTier))
                    
                    Text(formatSize(snapshot.sizeBytes))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()
            
            Text(snapshot.createdAt, style: .relative)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }
    
    // MARK: - Detail View
    
    private func snapshotDetailView(_ snapshot: SnapshotManager.Snapshot) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(snapshot.name)
                            .font(.title2.bold())
                        Text("Version \(snapshot.version)")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    
                    Spacer()
                    
                    // Status badge
                    statusBadge(snapshot.status)
                }
                
                Divider()
                
                // Metadata grid
                GroupBox("Snapshot Details") {
                    Grid(alignment: .leading, horizontalSpacing: 20, verticalSpacing: 8) {
                        GridRow {
                            Text("Type:")
                            Text(snapshot.snapshotType.rawValue.capitalized)
                                .fontWeight(.medium)
                        }
                        GridRow {
                            Text("Environment:")
                            Text("\(snapshot.appId) / \(snapshot.environment)")
                                .fontWeight(.medium)
                        }
                        GridRow {
                            Text("Created:")
                            Text(snapshot.createdAt, style: .date) + Text(" at ") + Text(snapshot.createdAt, style: .time)
                        }
                        GridRow {
                            Text("Created By:")
                            Text(snapshot.createdBy)
                        }
                        GridRow {
                            Text("Size:")
                            Text(formatSize(snapshot.sizeBytes))
                                .fontWeight(.medium)
                        }
                        GridRow {
                            Text("Tables:")
                            Text("\(snapshot.tableCount)")
                        }
                        GridRow {
                            Text("Resources:")
                            Text("\(snapshot.resourceCount)")
                        }
                        GridRow {
                            Text("Restore Count:")
                            Text("\(snapshot.restoreCount)")
                        }
                        if let lastRestored = snapshot.lastRestoredAt {
                            GridRow {
                                Text("Last Restored:")
                                Text(lastRestored, style: .relative)
                            }
                        }
                    }
                    .padding()
                }
                
                // Storage tier
                GroupBox("Storage Tier") {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Circle()
                                .fill(tierColor(snapshot.storageTier))
                                .frame(width: 12, height: 12)
                            Text(snapshot.storageTier.description)
                                .fontWeight(.medium)
                            
                            Spacer()
                            
                            Text("Restore: \(snapshot.storageTier.restoreTimeEstimate)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        
                        if let transitionDate = snapshot.tierTransitionDate {
                            Text("Transitioned: \(transitionDate, style: .relative)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        
                        // Manual tier transition
                        HStack {
                            Text("Move to:")
                            ForEach(SnapshotManager.StorageTier.allCases, id: \.rawValue) { tier in
                                if tier != snapshot.storageTier {
                                    Button(tier.rawValue.capitalized) {
                                        Task {
                                            try? await snapshotManager.transitionToTier(
                                                snapshotId: snapshot.id,
                                                targetTier: tier
                                            )
                                            await loadSnapshots()
                                        }
                                    }
                                    .buttonStyle(.bordered)
                                    .controlSize(.small)
                                }
                            }
                        }
                    }
                    .padding()
                }
                
                // Resources
                GroupBox("Resources Included") {
                    VStack(alignment: .leading, spacing: 8) {
                        if let auroraArn = snapshot.auroraSnapshotArn {
                            Label("Aurora Cluster Snapshot", systemImage: "cylinder.fill")
                            Text(auroraArn)
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .lineLimit(1)
                                .truncationMode(.middle)
                        }
                        
                        if !snapshot.dynamoDBBackupArns.isEmpty {
                            Label("\(snapshot.dynamoDBBackupArns.count) DynamoDB Table Backups", systemImage: "tablecells.fill")
                        }
                        
                        if snapshot.s3ManifestKey != nil {
                            Label("S3 Bucket Manifest", systemImage: "doc.fill")
                        }
                    }
                    .padding()
                }
                
                // Actions
                GroupBox("Actions") {
                    HStack(spacing: 16) {
                        Button {
                            showRestoreSheet = true
                        } label: {
                            Label("Restore", systemImage: "arrow.counterclockwise")
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(snapshot.status != .available)
                        
                        Button {
                            showDeleteConfirmation = true
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                        .buttonStyle(.bordered)
                        .foregroundColor(.red)
                    }
                    .padding()
                }
                
                if let description = snapshot.description {
                    GroupBox("Description") {
                        Text(description)
                            .padding()
                    }
                }
                
                // Policy Info (Read-Only)
                policyInfoSection
            }
            .padding()
        }
    }
    
    // MARK: - Policy Info (Read-Only)
    
    private var policyInfoSection: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Image(systemName: "gearshape.fill")
                        .foregroundColor(.blue)
                    Text("Snapshot Policy")
                        .fontWeight(.medium)
                    Spacer()
                    Text("Read-Only")
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.secondary.opacity(0.2))
                        .cornerRadius(4)
                }
                
                Divider()
                
                // Display current policy (read-only)
                Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 8) {
                    GridRow {
                        Text("Auto Snapshots:")
                            .foregroundColor(.secondary)
                        HStack {
                            Image(systemName: currentPolicy.autoSnapshotEnabled ? "checkmark.circle.fill" : "xmark.circle")
                                .foregroundColor(currentPolicy.autoSnapshotEnabled ? .green : .secondary)
                            Text(currentPolicy.autoSnapshotEnabled ? "Enabled" : "Disabled")
                        }
                    }
                    GridRow {
                        Text("Schedule:")
                            .foregroundColor(.secondary)
                        Text(currentPolicy.autoSnapshotSchedule)
                            .font(.system(.body, design: .monospaced))
                    }
                    GridRow {
                        Text("Retention:")
                            .foregroundColor(.secondary)
                        Text("\(currentPolicy.retentionDays) days")
                    }
                    GridRow {
                        Text("Pre-Deployment:")
                            .foregroundColor(.secondary)
                        Image(systemName: currentPolicy.preDeploymentSnapshotEnabled ? "checkmark.circle.fill" : "xmark.circle")
                            .foregroundColor(currentPolicy.preDeploymentSnapshotEnabled ? .green : .secondary)
                    }
                    GridRow {
                        Text("Pre-Migration:")
                            .foregroundColor(.secondary)
                        Image(systemName: currentPolicy.preSchemaMigrationSnapshotEnabled ? "checkmark.circle.fill" : "xmark.circle")
                            .foregroundColor(currentPolicy.preSchemaMigrationSnapshotEnabled ? .green : .secondary)
                    }
                }
                
                Divider()
                
                // Admin Dashboard link note
                HStack {
                    Image(systemName: "info.circle")
                        .foregroundColor(.blue)
                    Text("Policy configuration is managed in the **Radiant Admin Dashboard** → Platform → Snapshots → Policy")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .padding()
        }
    }
    
    private var emptySelectionView: some View {
        VStack(spacing: 16) {
            Image(systemName: "camera.fill")
                .font(.system(size: 48))
                .foregroundColor(.secondary)
            
            Text("Select a snapshot")
                .font(.headline)
            
            Text("Choose a snapshot from the list to view details and restore options")
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    // MARK: - Create Sheet
    
    private var createSnapshotSheet: some View {
        VStack(spacing: 20) {
            HStack {
                Text("Create Snapshot")
                    .font(.title2.bold())
                Spacer()
                Button("Cancel") {
                    showCreateSheet = false
                }
            }
            
            if isCreating {
                VStack(spacing: 12) {
                    ProgressView(value: creationProgress)
                    Text(creationMessage)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding()
            } else {
                Form {
                    TextField("Snapshot Name", text: $newSnapshotName)
                    
                    TextField("Description (optional)", text: $newSnapshotDescription, axis: .vertical)
                        .lineLimit(3...5)
                    
                    Picker("Snapshot Type", selection: $snapshotType) {
                        Text("Full (Aurora + DynamoDB + S3)").tag(SnapshotManager.SnapshotType.full)
                        Text("Aurora Only").tag(SnapshotManager.SnapshotType.auroraOnly)
                        Text("DynamoDB Only").tag(SnapshotManager.SnapshotType.dynamoDBOnly)
                        Text("Schema Only (No Data)").tag(SnapshotManager.SnapshotType.schemaOnly)
                    }
                    
                    if let instance = appState.selectedInstance {
                        Section("Target Instance") {
                            Text("\(instance.appId) / \(instance.environment)")
                                .fontWeight(.medium)
                        }
                    }
                }
                
                HStack {
                    Spacer()
                    Button("Create Snapshot") {
                        Task { await createSnapshot() }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(newSnapshotName.isEmpty)
                }
            }
        }
        .padding()
        .frame(width: 500, height: 400)
    }
    
    // MARK: - Restore Sheet
    
    private func restoreSnapshotSheet(_ snapshot: SnapshotManager.Snapshot) -> some View {
        VStack(spacing: 20) {
            HStack {
                Text("Restore Snapshot")
                    .font(.title2.bold())
                Spacer()
                Button("Cancel") {
                    showRestoreSheet = false
                }
            }
            
            if isRestoring {
                VStack(spacing: 12) {
                    ProgressView()
                    Text("Restoring snapshot...")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding()
            } else {
                Form {
                    Section("Snapshot") {
                        Text(snapshot.name)
                            .fontWeight(.medium)
                        Text("Version \(snapshot.version)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    Section("Restore Options") {
                        Toggle("Restore Aurora Database", isOn: $restoreAurora)
                            .disabled(snapshot.auroraSnapshotArn == nil)
                        
                        Toggle("Restore DynamoDB Tables", isOn: $restoreDynamoDB)
                            .disabled(snapshot.dynamoDBBackupArns.isEmpty)
                        
                        Toggle("Restore to Different Environment", isOn: $restoreToNewEnvironment)
                        
                        if restoreToNewEnvironment {
                            TextField("Target Environment", text: $targetEnvironment)
                        }
                    }
                    
                    if snapshot.storageTier == .cold || snapshot.storageTier == .archive {
                        Section {
                            Label("This snapshot is in \(snapshot.storageTier.rawValue) storage. Restore time: \(snapshot.storageTier.restoreTimeEstimate)", systemImage: "exclamationmark.triangle.fill")
                                .foregroundColor(.orange)
                        }
                    }
                }
                
                HStack {
                    Spacer()
                    Button("Restore") {
                        Task { await restoreSnapshot(snapshot) }
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
        }
        .padding()
        .frame(width: 500, height: 450)
    }
    
    // MARK: - Actions
    
    private func loadSnapshots() async {
        if let instance = appState.selectedInstance {
            snapshots = await snapshotManager.listSnapshots(environment: instance.environment)
        } else {
            snapshots = await snapshotManager.listSnapshots()
        }
        // Load current policy (read-only display)
        currentPolicy = await snapshotManager.getPolicy()
    }
    
    private func createSnapshot() async {
        guard let instance = appState.selectedInstance,
              let credentials = appState.credentials else { return }
        
        isCreating = true
        
        do {
            let result = try await snapshotManager.createSnapshot(
                name: newSnapshotName,
                description: newSnapshotDescription.isEmpty ? nil : newSnapshotDescription,
                environment: instance.environment,
                appId: instance.appId,
                credentials: credentials,
                type: snapshotType,
                onProgress: { message, progress in
                    Task { @MainActor in
                        self.creationMessage = message
                        self.creationProgress = progress
                    }
                }
            )
            
            if result.success {
                await loadSnapshots()
                showCreateSheet = false
                newSnapshotName = ""
                newSnapshotDescription = ""
            } else {
                error = result.errors.joined(separator: "\n")
            }
        } catch {
            self.error = error.localizedDescription
        }
        
        isCreating = false
    }
    
    private func restoreSnapshot(_ snapshot: SnapshotManager.Snapshot) async {
        guard let credentials = appState.credentials else { return }
        
        isRestoring = true
        
        let options = SnapshotManager.RestoreOptions(
            targetEnvironment: restoreToNewEnvironment ? targetEnvironment : nil,
            restoreAurora: restoreAurora,
            restoreDynamoDB: restoreDynamoDB,
            restoreToPointInTime: nil,
            skipTableData: false,
            renamePrefix: restoreToNewEnvironment ? "restored" : nil
        )
        
        do {
            let result = try await snapshotManager.restoreSnapshot(
                snapshotId: snapshot.id,
                options: options,
                credentials: credentials,
                onProgress: { _, _ in }
            )
            
            if result.success {
                await loadSnapshots()
                showRestoreSheet = false
            } else {
                error = result.errors.joined(separator: "\n")
            }
        } catch {
            self.error = error.localizedDescription
        }
        
        isRestoring = false
    }
    
    private func deleteSelectedSnapshot() async {
        guard let snapshot = selectedSnapshot,
              let credentials = appState.credentials else { return }
        
        do {
            try await snapshotManager.deleteSnapshot(snapshotId: snapshot.id, credentials: credentials)
            selectedSnapshot = nil
            await loadSnapshots()
        } catch {
            self.error = error.localizedDescription
        }
    }
    
    // MARK: - Helpers
    
    private func statusColor(_ status: SnapshotManager.SnapshotStatus) -> Color {
        switch status {
        case .available: return .green
        case .creating, .restoring, .transitioning: return .orange
        case .deleting: return .red
        case .failed: return .red
        }
    }
    
    private func statusBadge(_ status: SnapshotManager.SnapshotStatus) -> some View {
        HStack(spacing: 4) {
            Circle()
                .fill(statusColor(status))
                .frame(width: 8, height: 8)
            Text(status.rawValue.capitalized)
                .font(.caption)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(statusColor(status).opacity(0.1))
        .cornerRadius(8)
    }
    
    private func tierColor(_ tier: SnapshotManager.StorageTier) -> Color {
        switch tier {
        case .hot: return .red
        case .warm: return .orange
        case .cold: return .blue
        case .archive: return .purple
        }
    }
    
    private func tierLabel(_ tier: SnapshotManager.StorageTier) -> String {
        tier.rawValue.capitalized
    }
    
    private func typeIcon(_ type: SnapshotManager.SnapshotType) -> String {
        switch type {
        case .full: return "square.stack.3d.up.fill"
        case .auroraOnly: return "cylinder.fill"
        case .dynamoDBOnly: return "tablecells.fill"
        case .schemaOnly: return "doc.text.fill"
        case .incremental: return "arrow.triangle.2.circlepath"
        }
    }
    
    private func formatSize(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .binary
        return formatter.string(fromByteCount: bytes)
    }
}

#Preview {
    SnapshotManagementView()
        .environmentObject(AppState())
}
