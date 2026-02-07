/**
 * State Registry Operations Views
 *
 * Views for Compare, Sync, Backups, and Settings operations.
 *
 * @version 1.0.0
 * @since RADIANT 7.0.0
 */

import SwiftUI

// MARK: - Compare View

struct CompareView: View {
    @ObservedObject var viewModel: StateRegistryViewModel
    @State private var sourceEnvironment: EnvironmentName = .dev
    @State private var targetEnvironment: EnvironmentName = .staging
    
    var body: some View {
        VStack(spacing: RadiantSpacing.lg) {
            // Environment selectors
            HStack(spacing: RadiantSpacing.xl) {
                VStack(alignment: .leading) {
                    Text("Source Environment")
                        .font(.headline)
                    Picker("Source", selection: $sourceEnvironment) {
                        ForEach(EnvironmentName.allCases, id: \.self) { env in
                            Text(env.displayName).tag(env)
                        }
                    }
                    .pickerStyle(.segmented)
                }
                
                Image(systemName: "arrow.right")
                    .font(.title2)
                    .foregroundStyle(.secondary)
                
                VStack(alignment: .leading) {
                    Text("Target Environment")
                        .font(.headline)
                    Picker("Target", selection: $targetEnvironment) {
                        ForEach(EnvironmentName.allCases, id: \.self) { env in
                            Text(env.displayName).tag(env)
                        }
                    }
                    .pickerStyle(.segmented)
                }
            }
            .padding()
            
            Button("Compare Environments") {
                Task {
                    await viewModel.compareEnvironments(source: sourceEnvironment, target: targetEnvironment)
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(sourceEnvironment == targetEnvironment || viewModel.isLoading)
            
            Divider()
            
            // Comparison results
            if let comparison = viewModel.currentComparison {
                ComparisonResultView(comparison: comparison)
            } else {
                ContentUnavailableView(
                    "No Comparison",
                    systemImage: "arrow.left.arrow.right",
                    description: Text("Select environments and compare to see differences")
                )
            }
        }
        .padding()
    }
}

struct ComparisonResultView: View {
    let comparison: EnvironmentComparison
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: RadiantSpacing.lg) {
                // Summary
                GroupBox("Summary") {
                    VStack(alignment: .leading, spacing: RadiantSpacing.sm) {
                        LabeledContent("Total Changes", value: "\(comparison.diff.totalChanges)")
                        LabeledContent("Breaking Changes", value: "\(comparison.diff.breakingChanges)")
                        LabeledContent("Data Changes", value: "\(comparison.diff.dataChanges)")
                        LabeledContent("Estimated Duration", value: comparison.formattedSyncDuration)
                        LabeledContent("Data Transfer", value: comparison.formattedDataTransfer)
                        
                        if comparison.requiresDowntime {
                            Label("Requires Downtime", systemImage: "exclamationmark.triangle.fill")
                                .foregroundStyle(.orange)
                        }
                    }
                }
                
                // Changes
                if !comparison.diff.added.stacks.isEmpty || !comparison.diff.added.lambdas.isEmpty {
                    GroupBox("Added") {
                        VStack(alignment: .leading, spacing: RadiantSpacing.xs) {
                            ForEach(comparison.diff.added.stacks, id: \.self) { item in
                                Label(item, systemImage: "plus.circle.fill")
                                    .foregroundStyle(.green)
                            }
                            ForEach(comparison.diff.added.lambdas, id: \.self) { item in
                                Label(item, systemImage: "plus.circle.fill")
                                    .foregroundStyle(.green)
                            }
                        }
                    }
                }
                
                if !comparison.diff.removed.stacks.isEmpty || !comparison.diff.removed.lambdas.isEmpty {
                    GroupBox("Removed") {
                        VStack(alignment: .leading, spacing: RadiantSpacing.xs) {
                            ForEach(comparison.diff.removed.stacks, id: \.self) { item in
                                Label(item, systemImage: "minus.circle.fill")
                                    .foregroundStyle(.red)
                            }
                            ForEach(comparison.diff.removed.lambdas, id: \.self) { item in
                                Label(item, systemImage: "minus.circle.fill")
                                    .foregroundStyle(.red)
                            }
                        }
                    }
                }
                
                // Recommendations
                if !comparison.recommendations.isEmpty {
                    GroupBox("Recommendations") {
                        VStack(alignment: .leading, spacing: RadiantSpacing.sm) {
                            ForEach(comparison.recommendations) { rec in
                                HStack {
                                    Image(systemName: recommendationIcon(rec.type))
                                        .foregroundStyle(recommendationColor(rec.risk))
                                    VStack(alignment: .leading) {
                                        Text(rec.itemId)
                                            .font(.headline)
                                        Text(rec.reason)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                            }
                        }
                    }
                }
                
                // Conflicts
                if !comparison.conflicts.isEmpty {
                    GroupBox("Conflicts") {
                        VStack(alignment: .leading, spacing: RadiantSpacing.sm) {
                            ForEach(comparison.conflicts) { conflict in
                                VStack(alignment: .leading) {
                                    Text(conflict.itemId)
                                        .font(.headline)
                                    Text("Source: \(conflict.sourceValue)")
                                        .font(.caption)
                                    Text("Target: \(conflict.targetValue)")
                                        .font(.caption)
                                }
                                .padding(.vertical, RadiantSpacing.xs)
                            }
                        }
                    }
                }
            }
            .padding()
        }
    }
    
    private func recommendationIcon(_ type: String) -> String {
        switch type {
        case "sync": return "arrow.triangle.2.circlepath"
        case "skip": return "forward.fill"
        case "review": return "eye"
        case "warning": return "exclamationmark.triangle"
        default: return "info.circle"
        }
    }
    
    private func recommendationColor(_ risk: String) -> Color {
        switch risk {
        case "high": return .red
        case "medium": return .orange
        case "low": return .green
        default: return .secondary
        }
    }
}

// MARK: - Sync Operations View

struct SyncOperationsView: View {
    @ObservedObject var viewModel: StateRegistryViewModel
    @State private var sourceEnvironment: EnvironmentName = .dev
    @State private var targetEnvironment: EnvironmentName = .staging
    @State private var syncInfrastructure = false
    @State private var syncData = true
    @State private var syncFeatures = true
    @State private var confirmProduction = false
    @State private var showConfirmation = false
    
    var body: some View {
        VStack(spacing: RadiantSpacing.lg) {
            // Active operation
            if let operation = viewModel.activeSyncOperation {
                ActiveSyncOperationCard(
                    operation: operation,
                    onCancel: {
                        Task { await viewModel.cancelSync(operationId: operation.id) }
                    }
                )
            }
            
            // New sync form
            GroupBox("Start New Sync") {
                VStack(alignment: .leading, spacing: RadiantSpacing.md) {
                    HStack {
                        VStack(alignment: .leading) {
                            Text("Source")
                                .font(.caption)
                            Picker("Source", selection: $sourceEnvironment) {
                                ForEach(EnvironmentName.allCases, id: \.self) { env in
                                    Text(env.displayName).tag(env)
                                }
                            }
                        }
                        
                        Image(systemName: "arrow.right")
                        
                        VStack(alignment: .leading) {
                            Text("Target")
                                .font(.caption)
                            Picker("Target", selection: $targetEnvironment) {
                                ForEach(EnvironmentName.allCases, id: \.self) { env in
                                    Text(env.displayName).tag(env)
                                }
                            }
                        }
                    }
                    
                    Divider()
                    
                    Toggle("Sync Infrastructure", isOn: $syncInfrastructure)
                    Toggle("Sync Persistent Data", isOn: $syncData)
                    Toggle("Sync Feature Flags", isOn: $syncFeatures)
                    
                    if targetEnvironment == .prod {
                        Toggle("Confirm Production Sync", isOn: $confirmProduction)
                            .foregroundStyle(.orange)
                    }
                    
                    Button("Start Sync") {
                        showConfirmation = true
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(
                        sourceEnvironment == targetEnvironment ||
                        viewModel.isLoading ||
                        viewModel.activeSyncOperation != nil ||
                        (targetEnvironment == .prod && !confirmProduction)
                    )
                }
                .padding()
            }
            
            // Recent syncs
            GroupBox("Recent Sync Operations") {
                if viewModel.recentSyncs.isEmpty {
                    Text("No recent sync operations")
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding()
                } else {
                    List(viewModel.recentSyncs) { sync in
                        SyncOperationRow(operation: sync)
                    }
                }
            }
        }
        .padding()
        .confirmationDialog(
            "Start Sync?",
            isPresented: $showConfirmation,
            titleVisibility: .visible
        ) {
            Button("Start Sync") {
                Task {
                    _ = await viewModel.startSync(
                        source: sourceEnvironment,
                        target: targetEnvironment,
                        syncInfrastructure: syncInfrastructure,
                        syncData: syncData,
                        syncFeatures: syncFeatures,
                        confirmProduction: confirmProduction
                    )
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Sync from \(sourceEnvironment.displayName) to \(targetEnvironment.displayName)?")
        }
    }
}

struct ActiveSyncOperationCard: View {
    let operation: SyncOperation
    let onCancel: () -> Void
    
    var body: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: RadiantSpacing.md) {
                HStack {
                    Text("Active Sync")
                        .font(.headline)
                    Spacer()
                    StatusBadge(status: operation.status)
                }
                
                ProgressView(value: Double(operation.progress.percentComplete), total: 100) {
                    Text(operation.progress.phase)
                        .font(.caption)
                }
                
                HStack {
                    Text("\(operation.progress.itemsCompleted)/\(operation.progress.itemsTotal) items")
                    Spacer()
                    Text(operation.progress.formattedBytesTransferred)
                }
                .font(.caption)
                .foregroundStyle(.secondary)
                
                if operation.status == .syncing {
                    Button("Cancel", role: .destructive, action: onCancel)
                        .buttonStyle(.bordered)
                }
            }
            .padding()
        }
    }
}

struct SyncOperationRow: View {
    let operation: SyncOperation
    
    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text("\(operation.sourceEnvironment.displayName) → \(operation.targetEnvironment.displayName)")
                    .font(.headline)
                Text(operation.formattedInitiatedAt)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            StatusBadge(status: operation.status)
        }
    }
}

struct StatusBadge: View {
    let status: EnvSyncStatus
    
    var body: some View {
        Text(status.rawValue.capitalized)
            .font(.caption)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.2))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }
    
    private var color: Color {
        switch status {
        case .idle: return .gray
        case .syncing: return .blue
        case .completed: return .green
        case .failed: return .red
        case .conflict: return .orange
        }
    }
}

// MARK: - Backups View

struct BackupsView: View {
    @ObservedObject var viewModel: StateRegistryViewModel
    @State private var selectedEnvironment: EnvironmentName = .dev
    @State private var showCreateBackup = false
    @State private var backupDescription = ""
    @State private var includeInfrastructure = true
    @State private var includeDatabase = true
    @State private var includeS3 = true
    @State private var includeSecrets = false
    
    var body: some View {
        VStack(spacing: RadiantSpacing.lg) {
            // Filter and create
            HStack {
                Picker("Environment", selection: $selectedEnvironment) {
                    ForEach(EnvironmentName.allCases, id: \.self) { env in
                        Text(env.displayName).tag(env)
                    }
                }
                .pickerStyle(.segmented)
                .frame(maxWidth: 300)
                
                Spacer()
                
                Button {
                    showCreateBackup = true
                } label: {
                    Label("Create Backup", systemImage: "plus")
                }
                .buttonStyle(.borderedProminent)
            }
            .padding()
            
            // Backups list
            if viewModel.recentBackups.isEmpty {
                ContentUnavailableView(
                    "No Backups",
                    systemImage: "externaldrive.badge.timemachine",
                    description: Text("Create a backup to protect your environment state")
                )
            } else {
                List(viewModel.recentBackups.filter { $0.environment == selectedEnvironment }) { backup in
                    BackupRow(backup: backup)
                        .contextMenu {
                            Button("Restore") {
                                Task {
                                    _ = await viewModel.restoreBackup(
                                        backupId: backup.id,
                                        targetEnvironment: backup.environment
                                    )
                                }
                            }
                            Button("Delete", role: .destructive) {
                                Task {
                                    await viewModel.deleteBackup(backupId: backup.id)
                                }
                            }
                        }
                }
            }
        }
        .sheet(isPresented: $showCreateBackup) {
            CreateBackupSheet(
                viewModel: viewModel,
                environment: selectedEnvironment,
                isPresented: $showCreateBackup
            )
        }
        .task {
            await viewModel.loadBackups()
        }
    }
}

struct BackupRow: View {
    let backup: BackupManifest
    
    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text(backup.formattedCreatedAt)
                    .font(.headline)
                HStack {
                    if let desc = backup.description {
                        Text(desc)
                    } else {
                        Text(backup.type.rawValue.capitalized)
                    }
                    Text("•")
                    Text(backup.formattedSize)
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            BackupStatusBadge(status: backup.status)
        }
    }
}

struct BackupStatusBadge: View {
    let status: BackupStatus
    
    var body: some View {
        Text(status.rawValue.replacingOccurrences(of: "_", with: " ").capitalized)
            .font(.caption)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.2))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }
    
    private var color: Color {
        switch status {
        case .pending: return .gray
        case .inProgress: return .blue
        case .completed: return .green
        case .failed: return .red
        case .expired: return .orange
        }
    }
}

struct CreateBackupSheet: View {
    @ObservedObject var viewModel: StateRegistryViewModel
    let environment: EnvironmentName
    @Binding var isPresented: Bool
    
    @State private var description = ""
    @State private var includeInfrastructure = true
    @State private var includeDatabase = true
    @State private var includeS3 = true
    @State private var includeSecrets = false
    
    var body: some View {
        NavigationStack {
            Form {
                Section("Environment") {
                    Text(environment.displayName)
                }
                
                Section("Description") {
                    TextField("Optional description", text: $description)
                }
                
                Section("Include") {
                    Toggle("Infrastructure", isOn: $includeInfrastructure)
                    Toggle("Database", isOn: $includeDatabase)
                    Toggle("S3 Buckets", isOn: $includeS3)
                    Toggle("Secrets", isOn: $includeSecrets)
                }
            }
            .navigationTitle("Create Backup")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        isPresented = false
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        Task {
                            _ = await viewModel.createBackup(
                                environment: environment,
                                includeInfrastructure: includeInfrastructure,
                                includeDatabase: includeDatabase,
                                includeS3: includeS3,
                                includeSecrets: includeSecrets,
                                description: description.isEmpty ? nil : description
                            )
                            isPresented = false
                        }
                    }
                    .disabled(viewModel.isLoading)
                }
            }
        }
        .frame(width: 400, height: 350)
    }
}

// MARK: - Sync Settings View

struct SyncSettingsView: View {
    @ObservedObject var viewModel: StateRegistryViewModel
    @State private var selectedEnvironment: EnvironmentName = .dev
    
    var body: some View {
        VStack(spacing: 0) {
            Picker("Environment", selection: $selectedEnvironment) {
                ForEach(EnvironmentName.allCases, id: \.self) { env in
                    Text(env.displayName).tag(env)
                }
            }
            .pickerStyle(.segmented)
            .padding()
            
            Divider()
            
            SyncConfigForm(
                config: binding(for: selectedEnvironment),
                environment: selectedEnvironment,
                onSave: {
                    Task { await viewModel.saveSyncConfig(for: selectedEnvironment) }
                }
            )
        }
        .task {
            await viewModel.loadSyncConfig(for: selectedEnvironment)
        }
        .onChange(of: selectedEnvironment) { _, newValue in
            Task { await viewModel.loadSyncConfig(for: newValue) }
        }
    }
    
    private func binding(for environment: EnvironmentName) -> Binding<SyncConfiguration> {
        switch environment {
        case .dev:
            return $viewModel.devSyncConfig
        case .staging:
            return $viewModel.stagingSyncConfig
        case .prod:
            return $viewModel.prodSyncConfig
        }
    }
}

struct SyncConfigForm: View {
    @Binding var config: SyncConfiguration
    let environment: EnvironmentName
    let onSave: () -> Void
    
    var body: some View {
        Form {
            Section("Sync Settings") {
                Toggle("Sync Enabled", isOn: $config.enabled)
                Toggle("Sync Infrastructure", isOn: $config.syncInfrastructure)
                Toggle("Sync Persistent Data", isOn: $config.syncPersistentData)
                Toggle("Sync Feature Flags", isOn: $config.syncFeatureFlags)
                Toggle("Sync Secrets", isOn: $config.syncSecrets)
            }
            
            Section("Safety") {
                Toggle("Require Confirmation", isOn: $config.requireConfirmation)
                Toggle("Allow Destructive Changes", isOn: $config.allowDestructive)
                Toggle("Require Approval", isOn: $config.requireApproval)
            }
            
            Section("Automation") {
                Toggle("Auto-Sync Enabled", isOn: $config.autoSyncEnabled)
                    .disabled(environment == .prod)
                
                if environment == .prod && config.autoSyncEnabled {
                    Text("Auto-sync is disabled for production")
                        .font(.caption)
                        .foregroundStyle(.orange)
                }
            }
            
            Section("Notifications") {
                Toggle("Notify on Sync", isOn: $config.notifyOnSync)
                Toggle("Notify on Conflict", isOn: $config.notifyOnConflict)
            }
            
            Section {
                Button("Save Configuration", action: onSave)
                    .buttonStyle(.borderedProminent)
            }
        }
    }
}
