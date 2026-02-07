/**
 * Storage Configuration View
 *
 * Administrator interface for configuring storage paths for manifests,
 * backups, and packages. Supports large datasets on external drives.
 *
 * @version 1.0.0
 * @since RADIANT 7.1.0
 */

import SwiftUI
import UniformTypeIdentifiers

struct StorageConfigurationView: View {
    @StateObject private var storageManager = StateRegistryStorageManager()
    @State private var editedConfig: StateRegistryStorageConfig = .default
    @State private var showingSaveConfirmation = false
    @State private var showingResetConfirmation = false
    @State private var showingError = false
    @State private var errorMessage = ""
    @State private var isSaving = false
    
    var body: some View {
        Form {
            // Storage Overview
            Section {
                storageOverview
            } header: {
                Label("Storage Overview", systemImage: "externaldrive")
            }
            
            // Local Storage Paths
            Section {
                localStoragePaths
            } header: {
                Label("Local Storage Paths", systemImage: "folder")
            } footer: {
                Text("Choose paths with sufficient space for large datasets. External drives are supported.")
            }
            
            // S3 Configuration
            Section {
                s3Configuration
            } header: {
                Label("S3 Storage (AWS)", systemImage: "cloud")
            }
            
            // Storage Limits
            Section {
                storageLimits
            } header: {
                Label("Storage Limits", systemImage: "gauge.with.dots.needle.bottom.50percent")
            }
            
            // Cleanup Policies
            Section {
                cleanupPolicies
            } header: {
                Label("Automatic Cleanup", systemImage: "trash")
            }
            
            // Actions
            Section {
                actions
            }
        }
        .formStyle(.grouped)
        .navigationTitle("Storage Configuration")
        .task {
            do {
                try await storageManager.initialize()
                try storageManager.loadConfig()
                editedConfig = storageManager.config
            } catch {
                // Use defaults if no saved config
                editedConfig = .default
            }
        }
        .alert("Save Configuration?", isPresented: $showingSaveConfirmation) {
            Button("Cancel", role: .cancel) {}
            Button("Save") {
                Task { await saveConfiguration() }
            }
        } message: {
            Text("This will update all storage paths. Existing data will not be moved automatically.")
        }
        .alert("Reset to Defaults?", isPresented: $showingResetConfirmation) {
            Button("Cancel", role: .cancel) {}
            Button("Reset", role: .destructive) {
                editedConfig = .default
            }
        } message: {
            Text("This will reset all storage paths to their default locations.")
        }
        .alert("Error", isPresented: $showingError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage)
        }
    }
    
    // MARK: - Storage Overview
    
    @ViewBuilder
    private var storageOverview: some View {
        if let usage = storageManager.diskUsage {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    VStack(alignment: .leading) {
                        Text("Total Used")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(formatBytes(usage.totalSizeBytes))
                            .font(.title2)
                            .fontWeight(.semibold)
                    }
                    
                    Spacer()
                    
                    VStack(alignment: .trailing) {
                        Text("Available")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(formatBytes(usage.availableSpaceBytes))
                            .font(.title2)
                            .fontWeight(.semibold)
                            .foregroundStyle(usage.availableSpaceBytes < 10_000_000_000 ? .red : .primary)
                    }
                }
                
                ProgressView(value: usage.usagePercent, total: 100) {
                    HStack {
                        Text("Usage")
                        Spacer()
                        Text("\(Int(usage.usagePercent))%")
                            .foregroundStyle(usage.usagePercent > 85 ? .orange : .secondary)
                    }
                    .font(.caption)
                }
                .tint(usage.usagePercent > 85 ? .orange : .blue)
                
                Divider()
                
                Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 8) {
                    GridRow {
                        Label("Manifests", systemImage: "doc.text")
                        Text(formatBytes(usage.manifestSizeBytes))
                            .foregroundStyle(.secondary)
                    }
                    GridRow {
                        Label("Backups", systemImage: "externaldrive.badge.timemachine")
                        Text(formatBytes(usage.backupSizeBytes))
                            .foregroundStyle(.secondary)
                    }
                    GridRow {
                        Label("Packages", systemImage: "shippingbox")
                        Text(formatBytes(usage.packageSizeBytes))
                            .foregroundStyle(.secondary)
                    }
                    GridRow {
                        Label("Cache", systemImage: "memorychip")
                        Text(formatBytes(usage.cacheSizeBytes))
                            .foregroundStyle(.secondary)
                    }
                }
                .font(.callout)
            }
        } else {
            HStack {
                ProgressView()
                Text("Calculating storage usage...")
                    .foregroundStyle(.secondary)
            }
        }
        
        Button {
            Task { await storageManager.refreshDiskUsage() }
        } label: {
            Label("Refresh", systemImage: "arrow.clockwise")
        }
    }
    
    // MARK: - Local Storage Paths
    
    @ViewBuilder
    private var localStoragePaths: some View {
        PathSelector(
            label: "Manifests",
            path: $editedConfig.localManifestPath,
            description: "Environment state snapshots"
        )
        
        PathSelector(
            label: "Backups",
            path: $editedConfig.localBackupPath,
            description: "Point-in-time environment backups"
        )
        
        PathSelector(
            label: "Packages",
            path: $editedConfig.localPackagePath,
            description: "Deployment packages (can be very large)"
        )
        
        PathSelector(
            label: "Cache",
            path: $editedConfig.localCachePath,
            description: "Temporary data and offline cache"
        )
    }
    
    // MARK: - S3 Configuration
    
    @ViewBuilder
    private var s3Configuration: some View {
        LabeledContent("Manifest Bucket") {
            TextField("Bucket name", text: $editedConfig.s3ManifestBucket)
                .textFieldStyle(.roundedBorder)
                .frame(maxWidth: 300)
        }
        
        LabeledContent("Backup Bucket") {
            TextField("Bucket name", text: $editedConfig.s3BackupBucket)
                .textFieldStyle(.roundedBorder)
                .frame(maxWidth: 300)
        }
        
        LabeledContent("Package Bucket") {
            TextField("Bucket name", text: $editedConfig.s3PackageBucket)
                .textFieldStyle(.roundedBorder)
                .frame(maxWidth: 300)
        }
        
        LabeledContent("Region") {
            Picker("Region", selection: $editedConfig.s3Region) {
                ForEach(awsRegions, id: \.self) { region in
                    Text(region).tag(region)
                }
            }
            .frame(maxWidth: 200)
        }
        
        Text("Use {env} placeholder for environment-specific buckets (e.g., radiant-{env}-backups)")
            .font(.caption)
            .foregroundStyle(.secondary)
    }
    
    // MARK: - Storage Limits
    
    @ViewBuilder
    private var storageLimits: some View {
        LabeledContent("Max Local Cache Size") {
            HStack {
                TextField("GB", value: $editedConfig.maxLocalCacheSizeGB, format: .number)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 80)
                Text("GB")
                    .foregroundStyle(.secondary)
            }
        }
        
        LabeledContent("Max Backup Retention") {
            HStack {
                TextField("Days", value: $editedConfig.maxBackupRetentionDays, format: .number)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 80)
                Text("days")
                    .foregroundStyle(.secondary)
            }
        }
        
        LabeledContent("Max Manifest Versions") {
            TextField("Versions", value: $editedConfig.maxManifestVersions, format: .number)
                .textFieldStyle(.roundedBorder)
                .frame(width: 80)
        }
    }
    
    // MARK: - Cleanup Policies
    
    @ViewBuilder
    private var cleanupPolicies: some View {
        Toggle("Enable Automatic Cleanup", isOn: $editedConfig.autoCleanupEnabled)
        
        if editedConfig.autoCleanupEnabled {
            LabeledContent("Cleanup Threshold") {
                HStack {
                    Slider(value: Binding(
                        get: { Double(editedConfig.cleanupThresholdPercent) },
                        set: { editedConfig.cleanupThresholdPercent = Int($0) }
                    ), in: 50...95, step: 5)
                    .frame(width: 150)
                    
                    Text("\(editedConfig.cleanupThresholdPercent)%")
                        .frame(width: 40, alignment: .trailing)
                        .foregroundStyle(.secondary)
                }
            }
            
            Text("Cleanup runs when disk usage exceeds this threshold")
                .font(.caption)
                .foregroundStyle(.secondary)
            
            Button {
                Task {
                    do {
                        try await storageManager.performCleanup()
                    } catch {
                        errorMessage = error.localizedDescription
                        showingError = true
                    }
                }
            } label: {
                Label("Run Cleanup Now", systemImage: "trash")
            }
        }
    }
    
    // MARK: - Actions
    
    @ViewBuilder
    private var actions: some View {
        HStack {
            Button("Reset to Defaults") {
                showingResetConfirmation = true
            }
            
            Spacer()
            
            Button("Save Configuration") {
                showingSaveConfirmation = true
            }
            .buttonStyle(.borderedProminent)
            .disabled(isSaving)
        }
    }
    
    // MARK: - Helpers
    
    private func saveConfiguration() async {
        isSaving = true
        defer { isSaving = false }
        
        do {
            try await storageManager.updateConfig(editedConfig)
        } catch {
            errorMessage = error.localizedDescription
            showingError = true
        }
    }
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: bytes)
    }
    
    private let awsRegions = [
        "us-east-1", "us-east-2", "us-west-1", "us-west-2",
        "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-north-1",
        "ap-northeast-1", "ap-northeast-2", "ap-southeast-1", "ap-southeast-2",
        "ap-south-1", "sa-east-1", "ca-central-1"
    ]
}

// MARK: - Path Selector Component

struct PathSelector: View {
    let label: String
    @Binding var path: String
    let description: String
    
    @State private var showingFilePicker = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                VStack(alignment: .leading) {
                    Text(label)
                        .font(.headline)
                    Text(description)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                Spacer()
                
                Button("Browse...") {
                    showingFilePicker = true
                }
            }
            
            HStack {
                TextField("Path", text: $path)
                    .textFieldStyle(.roundedBorder)
                    .font(.system(.body, design: .monospaced))
                
                Button {
                    // Open in Finder
                    let resolvedPath = NSString(string: path).expandingTildeInPath
                    NSWorkspace.shared.selectFile(nil, inFileViewerRootedAtPath: resolvedPath)
                } label: {
                    Image(systemName: "folder")
                }
                .help("Open in Finder")
            }
        }
        .fileImporter(
            isPresented: $showingFilePicker,
            allowedContentTypes: [.folder],
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let urls):
                if let url = urls.first {
                    path = url.path
                }
            case .failure:
                break
            }
        }
    }
}

// MARK: - Reliability Settings View

struct ReliabilitySettingsView: View {
    @State private var syncConfig: EnhancedSyncConfig = .default
    @State private var fallbackConfig: FallbackConfig = .default
    @State private var showingSaved = false
    
    var body: some View {
        Form {
            // Conflict Resolution
            Section {
                Picker("Resolution Strategy", selection: $syncConfig.conflictResolution) {
                    ForEach(ConflictResolutionStrategy.allCases, id: \.self) { strategy in
                        VStack(alignment: .leading) {
                            Text(strategy.displayName)
                            Text(strategy.description)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .tag(strategy)
                    }
                }
                .pickerStyle(.radioGroup)
                
                Toggle("Notify on Conflicts", isOn: $syncConfig.conflictNotifications)
                
                LabeledContent("Auto-Resolve Threshold") {
                    HStack {
                        Slider(value: Binding(
                            get: { Double(syncConfig.autoResolveThreshold) },
                            set: { syncConfig.autoResolveThreshold = Int($0) }
                        ), in: 50...100, step: 5)
                        .frame(width: 150)
                        
                        Text("\(syncConfig.autoResolveThreshold)%")
                            .frame(width: 40)
                    }
                }
            } header: {
                Label("Conflict Resolution", systemImage: "arrow.triangle.merge")
            }
            
            // Retry Settings
            Section {
                LabeledContent("Max Retries") {
                    Stepper("\(syncConfig.retryConfig.maxRetries)", value: $syncConfig.retryConfig.maxRetries, in: 1...10)
                }
                
                LabeledContent("Initial Delay") {
                    HStack {
                        TextField("ms", value: $syncConfig.retryConfig.initialDelayMs, format: .number)
                            .textFieldStyle(.roundedBorder)
                            .frame(width: 80)
                        Text("ms")
                    }
                }
                
                LabeledContent("Max Delay") {
                    HStack {
                        TextField("ms", value: $syncConfig.retryConfig.maxDelayMs, format: .number)
                            .textFieldStyle(.roundedBorder)
                            .frame(width: 80)
                        Text("ms")
                    }
                }
                
                Toggle("Enable Jitter", isOn: $syncConfig.retryConfig.jitterEnabled)
            } header: {
                Label("Retry Configuration", systemImage: "arrow.clockwise")
            }
            
            // Validation
            Section {
                Toggle("Validate Before Sync", isOn: $syncConfig.validateBeforeSync)
                Toggle("Validate After Sync", isOn: $syncConfig.validateAfterSync)
                Toggle("Checksum Verification", isOn: $syncConfig.checksumVerification)
            } header: {
                Label("Data Validation", systemImage: "checkmark.shield")
            }
            
            // Rollback
            Section {
                Toggle("Create Checkpoint Before Sync", isOn: $syncConfig.createCheckpointBeforeSync)
                Toggle("Auto-Rollback on Failure", isOn: $syncConfig.autoRollbackOnFailure)
                
                if syncConfig.autoRollbackOnFailure {
                    LabeledContent("Rollback Threshold") {
                        HStack {
                            Slider(value: Binding(
                                get: { Double(syncConfig.rollbackThresholdPercent) },
                                set: { syncConfig.rollbackThresholdPercent = Int($0) }
                            ), in: 5...50, step: 5)
                            .frame(width: 150)
                            
                            Text("\(syncConfig.rollbackThresholdPercent)%")
                                .frame(width: 40)
                        }
                    }
                    
                    Text("Rollback if more than this percentage of items fail")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } header: {
                Label("Rollback Settings", systemImage: "arrow.uturn.backward")
            }
            
            // Fallback
            Section {
                Toggle("Use Cache on Network Failure", isOn: $fallbackConfig.useCacheOnNetworkFailure)
                
                if fallbackConfig.useCacheOnNetworkFailure {
                    LabeledContent("Max Cache Age") {
                        HStack {
                            TextField("minutes", value: $fallbackConfig.maxCacheAgeMinutes, format: .number)
                                .textFieldStyle(.roundedBorder)
                                .frame(width: 80)
                            Text("minutes")
                        }
                    }
                }
                
                Toggle("Continue on Partial Failure", isOn: $fallbackConfig.continueOnPartialFailure)
                Toggle("Read-Only Mode on Write Failure", isOn: $fallbackConfig.enableReadOnlyOnWriteFailure)
            } header: {
                Label("Fallback Behavior", systemImage: "arrow.triangle.branch")
            }
            
            // Notifications
            Section {
                Toggle("Notify on Start", isOn: $syncConfig.notifyOnStart)
                Toggle("Notify on Complete", isOn: $syncConfig.notifyOnComplete)
                Toggle("Notify on Failure", isOn: $syncConfig.notifyOnFailure)
                Toggle("Notify on Conflict", isOn: $syncConfig.notifyOnConflict)
            } header: {
                Label("Notifications", systemImage: "bell")
            }
            
            // SLA Targets (Read-only)
            Section {
                LabeledContent("Target Availability", value: "\(ReliabilitySLATargets.availability)%")
                LabeledContent("Sync Success Rate", value: "\(ReliabilitySLATargets.syncSuccessRate)%")
                LabeledContent("Backup Success Rate", value: "\(ReliabilitySLATargets.backupSuccessRate)%")
                LabeledContent("Data Integrity", value: "\(Int(ReliabilitySLATargets.dataIntegrityRate))%")
            } header: {
                Label("SLA Targets (99.99%)", systemImage: "target")
            } footer: {
                Text("These targets ensure enterprise-grade reliability")
            }
        }
        .formStyle(.grouped)
        .navigationTitle("Reliability Settings")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Save") {
                    // Save configuration
                    showingSaved = true
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .alert("Settings Saved", isPresented: $showingSaved) {
            Button("OK", role: .cancel) {}
        }
    }
}

// MARK: - Health Dashboard View

struct HealthDashboardView: View {
    @StateObject private var healthService: StateRegistryHealthService
    
    init(storageManager: StateRegistryStorageManager, apiBaseURL: URL) {
        _healthService = StateObject(wrappedValue: StateRegistryHealthService(
            storageManager: storageManager,
            apiBaseURL: apiBaseURL
        ))
    }
    
    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if let health = healthService.lastHealthCheck {
                    // Overall Status
                    GroupBox {
                        HStack {
                            VStack(alignment: .leading) {
                                Text("Overall Health")
                                    .font(.headline)
                                Text("Last checked: \(health.timestamp.formatted())")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            
                            Spacer()
                            
                            HealthStatusBadge(status: health.overall)
                        }
                    }
                    
                    // Components
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        ComponentHealthCard(
                            title: "Local Cache",
                            status: health.components.localCache
                        )
                        ComponentHealthCard(
                            title: "S3 Connection",
                            status: health.components.s3Connection
                        )
                        ComponentHealthCard(
                            title: "API Connection",
                            status: health.components.apiConnection
                        )
                        ComponentHealthCard(
                            title: "Database",
                            status: health.components.database
                        )
                    }
                    
                    // Metrics
                    GroupBox("Reliability Metrics") {
                        Grid(alignment: .leading, horizontalSpacing: 24, verticalSpacing: 8) {
                            GridRow {
                                Text("Uptime")
                                Text("\(health.metrics.uptime, specifier: "%.2f")%")
                                    .foregroundStyle(health.metrics.uptime >= 99.99 ? .green : .orange)
                            }
                            GridRow {
                                Text("Success Rate")
                                Text("\(health.metrics.successRate, specifier: "%.2f")%")
                                    .foregroundStyle(health.metrics.successRate >= 99.9 ? .green : .orange)
                            }
                            GridRow {
                                Text("Avg Latency")
                                Text("\(Int(health.metrics.avgLatencyMs))ms")
                                    .foregroundStyle(health.metrics.avgLatencyMs < 5000 ? .green : .orange)
                            }
                            GridRow {
                                Text("Errors (24h)")
                                Text("\(health.metrics.errorCount24h)")
                                    .foregroundStyle(health.metrics.errorCount24h == 0 ? .green : .red)
                            }
                        }
                    }
                } else {
                    ContentUnavailableView(
                        "No Health Data",
                        systemImage: "heart.text.square",
                        description: Text("Run a health check to see component status")
                    )
                }
                
                Button {
                    Task {
                        _ = await healthService.performHealthCheck()
                    }
                } label: {
                    Label(
                        healthService.isChecking ? "Checking..." : "Run Health Check",
                        systemImage: "heart.text.square"
                    )
                }
                .buttonStyle(.borderedProminent)
                .disabled(healthService.isChecking)
            }
            .padding()
        }
        .navigationTitle("Health Dashboard")
        .task {
            _ = await healthService.performHealthCheck()
        }
    }
}

struct HealthStatusBadge: View {
    let status: StateRegistryHealthCheck.HealthStatus
    
    var body: some View {
        HStack {
            Circle()
                .fill(color)
                .frame(width: 12, height: 12)
            Text(status.rawValue.capitalized)
                .font(.headline)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(color.opacity(0.1))
        .clipShape(Capsule())
    }
    
    private var color: Color {
        switch status {
        case .healthy: return .green
        case .degraded: return .orange
        case .unhealthy: return .red
        }
    }
}

struct ComponentHealthCard: View {
    let title: String
    let status: StateRegistryHealthCheck.ComponentStatus
    
    var body: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(title)
                        .font(.headline)
                    Spacer()
                    Circle()
                        .fill(statusColor)
                        .frame(width: 10, height: 10)
                }
                
                if let latency = status.latencyMs {
                    Text("Latency: \(latency)ms")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                if let diskAvailable = status.diskSpaceAvailableGB {
                    Text("Available: \(diskAvailable, specifier: "%.1f") GB")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                if !status.errors.isEmpty {
                    ForEach(status.errors, id: \.self) { error in
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                }
            }
        }
    }
    
    private var statusColor: Color {
        switch status.status {
        case .healthy: return .green
        case .degraded: return .orange
        case .unhealthy: return .red
        }
    }
}

#Preview {
    StorageConfigurationView()
}
