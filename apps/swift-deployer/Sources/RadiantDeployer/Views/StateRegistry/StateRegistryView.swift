/**
 * State Registry View
 *
 * Main view for the Environment State Registry feature.
 * Displays environment manifests, sync controls, and backup management.
 *
 * @version 1.0.0
 * @since RADIANT 7.0.0
 */

import SwiftUI

struct StateRegistryView: View {
    @StateObject private var viewModel = StateRegistryViewModel()
    @State private var selectedTab: StateRegistryTab = .overview
    
    var body: some View {
        NavigationSplitView {
            sidebar
        } detail: {
            detailView
        }
        .navigationTitle("Environment State Registry")
        .toolbar {
            toolbarContent
        }
        .task {
            await viewModel.loadDashboard()
        }
        .alert("Error", isPresented: $viewModel.showError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.errorMessage)
        }
    }
    
    // MARK: - Sidebar
    
    private var sidebar: some View {
        List(selection: $selectedTab) {
            Section("Overview") {
                Label("Dashboard", systemImage: "gauge.with.dots.needle.bottom.50percent")
                    .tag(StateRegistryTab.overview)
            }
            
            Section("Environments") {
                ForEach(EnvironmentName.allCases, id: \.self) { env in
                    Label(env.displayName, systemImage: environmentIcon(for: env))
                        .tag(StateRegistryTab.environment(env))
                        .badge(viewModel.healthBadge(for: env))
                }
            }
            
            Section("Operations") {
                Label("Compare", systemImage: "arrow.left.arrow.right")
                    .tag(StateRegistryTab.compare)
                
                Label("Sync", systemImage: "arrow.triangle.2.circlepath")
                    .tag(StateRegistryTab.sync)
                
                Label("Backups", systemImage: "externaldrive.badge.timemachine")
                    .tag(StateRegistryTab.backups)
            }
            
            Section("Configuration") {
                Label("Sync Settings", systemImage: "gearshape.2")
                    .tag(StateRegistryTab.settings)
            }
        }
        .listStyle(.sidebar)
        .frame(minWidth: 220)
    }
    
    // MARK: - Detail View
    
    @ViewBuilder
    private var detailView: some View {
        switch selectedTab {
        case .overview:
            StateRegistryDashboardView(viewModel: viewModel)
        case .environment(let env):
            EnvironmentDetailView(environment: env, viewModel: viewModel)
        case .compare:
            CompareView(viewModel: viewModel)
        case .sync:
            SyncOperationsView(viewModel: viewModel)
        case .backups:
            BackupsView(viewModel: viewModel)
        case .settings:
            SyncSettingsView(viewModel: viewModel)
        }
    }
    
    // MARK: - Toolbar
    
    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .primaryAction) {
            Button {
                Task { await viewModel.refreshAll() }
            } label: {
                Label("Refresh", systemImage: "arrow.clockwise")
            }
            .disabled(viewModel.isLoading)
        }
        
        ToolbarItem(placement: .status) {
            if viewModel.isLoading {
                ProgressView()
                    .scaleEffect(0.7)
            }
        }
        
        ToolbarItem {
            if viewModel.isOffline {
                Label("Offline", systemImage: "wifi.slash")
                    .foregroundStyle(.orange)
            }
        }
    }
    
    // MARK: - Helpers
    
    private func environmentIcon(for env: EnvironmentName) -> String {
        switch env {
        case .dev: return "hammer"
        case .staging: return "testtube.2"
        case .prod: return "globe"
        }
    }
}

// MARK: - Tab Enum

enum StateRegistryTab: Hashable {
    case overview
    case environment(EnvironmentName)
    case compare
    case sync
    case backups
    case settings
}

// MARK: - Dashboard View

struct StateRegistryDashboardView: View {
    @ObservedObject var viewModel: StateRegistryViewModel
    
    var body: some View {
        ScrollView {
            VStack(spacing: RadiantSpacing.lg) {
                environmentCards
                recentActivity
            }
            .padding()
        }
    }
    
    private var environmentCards: some View {
        LazyVGrid(columns: [
            GridItem(.flexible()),
            GridItem(.flexible()),
            GridItem(.flexible())
        ], spacing: RadiantSpacing.md) {
            ForEach(EnvironmentName.allCases, id: \.self) { env in
                StateEnvironmentCard(
                    environment: env,
                    manifest: viewModel.manifest(for: env),
                    onCapture: { Task { await viewModel.captureManifest(for: env) } }
                )
            }
        }
    }
    
    private var recentActivity: some View {
        GroupBox("Recent Activity") {
            if viewModel.recentSyncs.isEmpty && viewModel.recentBackups.isEmpty {
                Text("No recent activity")
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding()
            } else {
                VStack(spacing: RadiantSpacing.sm) {
                    ForEach(viewModel.recentSyncs.prefix(5)) { sync in
                        SyncOperationRow(operation: sync)
                    }
                    ForEach(viewModel.recentBackups.prefix(5)) { backup in
                        BackupRow(backup: backup)
                    }
                }
                .padding(.vertical, RadiantSpacing.sm)
            }
        }
    }
}

// MARK: - Environment Card

struct StateEnvironmentCard: View {
    let environment: EnvironmentName
    let manifest: EnvironmentStateManifest?
    let onCapture: () -> Void
    
    var body: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: RadiantSpacing.sm) {
                HStack {
                    Circle()
                        .fill(healthColor)
                        .frame(width: 10, height: 10)
                    
                    Text(environment.displayName)
                        .font(.headline)
                    
                    Spacer()
                    
                    Button(action: onCapture) {
                        Image(systemName: "arrow.clockwise")
                    }
                    .buttonStyle(.borderless)
                }
                
                Divider()
                
                if let manifest = manifest {
                    manifestInfo(manifest)
                } else {
                    Text("No manifest captured")
                        .foregroundStyle(.secondary)
                        .font(.caption)
                }
            }
            .padding(RadiantSpacing.sm)
        }
    }
    
    @ViewBuilder
    private func manifestInfo(_ manifest: EnvironmentStateManifest) -> some View {
        VStack(alignment: .leading, spacing: RadiantSpacing.xs) {
            LabeledContent("Captured", value: manifest.formattedCapturedAt)
            LabeledContent("Stacks", value: "\(manifest.infrastructure.stacks.count)")
            LabeledContent("Lambdas", value: "\(manifest.infrastructure.lambdas.count)")
            LabeledContent("Data Items", value: "\(manifest.persistentData.count)")
        }
        .font(.caption)
    }
    
    private var healthColor: Color {
        guard let manifest = manifest else { return .gray }
        switch manifest.health.overall {
        case .healthy: return .green
        case .degraded: return .orange
        case .unhealthy: return .red
        case .unknown: return .gray
        }
    }
}

// MARK: - Environment Detail View

struct EnvironmentDetailView: View {
    let environment: EnvironmentName
    @ObservedObject var viewModel: StateRegistryViewModel
    @State private var selectedSection: EnvironmentSection = .infrastructure
    
    var body: some View {
        VStack(spacing: 0) {
            Picker("Section", selection: $selectedSection) {
                ForEach(EnvironmentSection.allCases, id: \.self) { section in
                    Text(section.title).tag(section)
                }
            }
            .pickerStyle(.segmented)
            .padding()
            
            Divider()
            
            if let manifest = viewModel.manifest(for: environment) {
                sectionContent(manifest)
            } else {
                ContentUnavailableView(
                    "No Manifest",
                    systemImage: "doc.questionmark",
                    description: Text("Capture a manifest to view environment state")
                )
            }
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Capture Now") {
                    Task { await viewModel.captureManifest(for: environment) }
                }
                .disabled(viewModel.isLoading)
            }
        }
    }
    
    @ViewBuilder
    private func sectionContent(_ manifest: EnvironmentStateManifest) -> some View {
        switch selectedSection {
        case .infrastructure:
            InfrastructureListView(infrastructure: manifest.infrastructure)
        case .persistentData:
            PersistentDataListView(
                items: manifest.persistentData,
                environment: environment,
                viewModel: viewModel
            )
        case .features:
            FeatureFlagsView(features: manifest.features)
        case .health:
            HealthStatusView(health: manifest.health)
        }
    }
}

enum EnvironmentSection: CaseIterable {
    case infrastructure
    case persistentData
    case features
    case health
    
    var title: String {
        switch self {
        case .infrastructure: return "Infrastructure"
        case .persistentData: return "Persistent Data"
        case .features: return "Features"
        case .health: return "Health"
        }
    }
}

// MARK: - Infrastructure List View

struct InfrastructureListView: View {
    let infrastructure: InfrastructureManifest
    @State private var expandedSections: Set<String> = []
    
    var body: some View {
        List {
            Section("CloudFormation Stacks (\(infrastructure.stacks.count))") {
                ForEach(infrastructure.stacks) { stack in
                    DisclosureGroup {
                        VStack(alignment: .leading, spacing: RadiantSpacing.xs) {
                            LabeledContent("Status", value: stack.status)
                            LabeledContent("Last Updated", value: stack.lastUpdatedAt)
                            if let drift = stack.driftStatus {
                                LabeledContent("Drift Status", value: drift)
                            }
                        }
                        .font(.caption)
                    } label: {
                        Label(stack.name, systemImage: "square.stack.3d.up")
                    }
                }
            }
            
            Section("Lambda Functions (\(infrastructure.lambdas.count))") {
                ForEach(infrastructure.lambdas) { lambda in
                    DisclosureGroup {
                        VStack(alignment: .leading, spacing: RadiantSpacing.xs) {
                            LabeledContent("Runtime", value: lambda.runtime)
                            LabeledContent("Memory", value: "\(lambda.memoryMB) MB")
                            LabeledContent("Timeout", value: "\(lambda.timeoutSeconds)s")
                        }
                        .font(.caption)
                    } label: {
                        Label(lambda.name, systemImage: "function")
                    }
                }
            }
            
            Section("S3 Buckets (\(infrastructure.s3Buckets.count))") {
                ForEach(infrastructure.s3Buckets) { bucket in
                    DisclosureGroup {
                        VStack(alignment: .leading, spacing: RadiantSpacing.xs) {
                            LabeledContent("Size", value: bucket.formattedSize)
                            LabeledContent("Objects", value: "\(bucket.objectCount)")
                            LabeledContent("Versioning", value: bucket.versioningEnabled ? "Enabled" : "Disabled")
                        }
                        .font(.caption)
                    } label: {
                        Label(bucket.name, systemImage: "externaldrive")
                    }
                }
            }
            
            Section("DynamoDB Tables (\(infrastructure.dynamoTables.count))") {
                ForEach(infrastructure.dynamoTables) { table in
                    DisclosureGroup {
                        VStack(alignment: .leading, spacing: RadiantSpacing.xs) {
                            LabeledContent("Items", value: "\(table.itemCount)")
                            LabeledContent("Size", value: table.formattedSize)
                            LabeledContent("Status", value: table.status)
                        }
                        .font(.caption)
                    } label: {
                        Label(table.name, systemImage: "tablecells")
                    }
                }
            }
            
            Section("Aurora Cluster") {
                VStack(alignment: .leading, spacing: RadiantSpacing.sm) {
                    LabeledContent("Identifier", value: infrastructure.auroraCluster.clusterIdentifier)
                    LabeledContent("Engine", value: "\(infrastructure.auroraCluster.engine) \(infrastructure.auroraCluster.engineVersion)")
                    LabeledContent("Status", value: infrastructure.auroraCluster.status)
                    LabeledContent("Instances", value: "\(infrastructure.auroraCluster.instances.count)")
                }
            }
            
            Section("Secrets (\(infrastructure.secrets.count))") {
                ForEach(infrastructure.secrets) { secret in
                    Label(secret.name, systemImage: "key")
                }
            }
        }
    }
}

// MARK: - Persistent Data List View

struct PersistentDataListView: View {
    let items: [PersistentDataItem]
    let environment: EnvironmentName
    @ObservedObject var viewModel: StateRegistryViewModel
    
    var body: some View {
        List {
            ForEach(items) { item in
                PersistentDataRow(
                    item: item,
                    onToggleSync: { newValue in
                        Task {
                            await viewModel.updatePersistentDataItem(
                                environment: environment,
                                itemId: item.id,
                                includeInSync: newValue
                            )
                        }
                    }
                )
            }
        }
    }
}

struct PersistentDataRow: View {
    let item: PersistentDataItem
    let onToggleSync: (Bool) -> Void
    @State private var includeInSync: Bool
    
    init(item: PersistentDataItem, onToggleSync: @escaping (Bool) -> Void) {
        self.item = item
        self.onToggleSync = onToggleSync
        self._includeInSync = State(initialValue: item.includeInSync)
    }
    
    var body: some View {
        DisclosureGroup {
            VStack(alignment: .leading, spacing: RadiantSpacing.sm) {
                Text(item.description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                
                HStack {
                    VStack(alignment: .leading) {
                        LabeledContent("Type", value: item.type)
                        LabeledContent("Category", value: item.category)
                        LabeledContent("Size", value: item.formattedSize)
                        LabeledContent("Records", value: item.formattedRecordCount)
                    }
                    
                    Spacer()
                    
                    VStack(alignment: .leading) {
                        LabeledContent("Sensitivity", value: item.sensitivity.rawValue)
                        LabeledContent("PII", value: item.containsPII ? "Yes" : "No")
                        LabeledContent("PHI", value: item.containsPHI ? "Yes" : "No")
                    }
                }
                .font(.caption)
                
                Toggle("Include in Sync", isOn: $includeInSync)
                    .onChange(of: includeInSync) { _, newValue in
                        onToggleSync(newValue)
                    }
            }
            .padding(.vertical, RadiantSpacing.xs)
        } label: {
            HStack {
                Image(systemName: typeIcon)
                Text(item.name)
                Spacer()
                if includeInSync {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                }
                sensitivityBadge
            }
        }
    }
    
    private var typeIcon: String {
        switch item.type {
        case "database": return "cylinder"
        case "s3": return "externaldrive"
        case "secret": return "key"
        default: return "doc"
        }
    }
    
    @ViewBuilder
    private var sensitivityBadge: some View {
        switch item.sensitivity {
        case .restricted:
            Text("RESTRICTED")
                .font(.caption2)
                .padding(.horizontal, 4)
                .background(.red.opacity(0.2))
                .foregroundStyle(.red)
                .clipShape(Capsule())
        case .confidential:
            Text("CONFIDENTIAL")
                .font(.caption2)
                .padding(.horizontal, 4)
                .background(.orange.opacity(0.2))
                .foregroundStyle(.orange)
                .clipShape(Capsule())
        default:
            EmptyView()
        }
    }
}

// MARK: - Feature Flags View

struct FeatureFlagsView: View {
    let features: FeatureManifest
    
    var body: some View {
        List {
            Section("Core Features") {
                FeatureRow(name: "Curator", enabled: features.enableCurator)
                FeatureRow(name: "Cortex Memory", enabled: features.enableCortexMemory)
                FeatureRow(name: "Time Machine", enabled: features.enableTimeMachine)
                FeatureRow(name: "Collaboration", enabled: features.enableCollaboration)
                FeatureRow(name: "Compliance Export", enabled: features.enableComplianceExport)
                FeatureRow(name: "Ego System", enabled: features.enableEgoSystem)
                FeatureRow(name: "Delight", enabled: features.enableDelight)
            }
            
            Section("AI Features") {
                FeatureRow(name: "Cato Safety", enabled: features.enableCato)
                FeatureRow(name: "Self-Hosted Models", enabled: features.enableSelfHostedModels)
                FeatureRow(name: "External Models", enabled: features.enableExternalModels)
                FeatureRow(name: "Model Fallback", enabled: features.enableModelFallback)
                FeatureRow(name: "Streaming Responses", enabled: features.enableStreamingResponses)
            }
            
            Section("Integration Features") {
                FeatureRow(name: "MCP Protocol", enabled: features.enableMCP)
                FeatureRow(name: "A2A Protocol", enabled: features.enableA2A)
                FeatureRow(name: "External API", enabled: features.enableExternalAPI)
            }
            
            if let customFlags = features.customFlags, !customFlags.isEmpty {
                Section("Custom Flags") {
                    ForEach(customFlags.sorted(by: { $0.key < $1.key }), id: \.key) { key, value in
                        FeatureRow(name: key, enabled: value)
                    }
                }
            }
        }
    }
}

struct FeatureRow: View {
    let name: String
    let enabled: Bool
    
    var body: some View {
        HStack {
            Text(name)
            Spacer()
            Image(systemName: enabled ? "checkmark.circle.fill" : "xmark.circle")
                .foregroundStyle(enabled ? .green : .secondary)
        }
    }
}

// MARK: - Health Status View

struct HealthStatusView: View {
    let health: EnvironmentHealth
    
    var body: some View {
        List {
            Section {
                HStack {
                    Text("Overall Health")
                        .font(.headline)
                    Spacer()
                    HealthBadge(health: health.overall)
                }
                
                Text("Last checked: \(health.lastHealthCheckAt)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            Section("Services") {
                ForEach(health.services.sorted(by: { $0.key < $1.key }), id: \.key) { service, status in
                    HStack {
                        Text(service)
                        Spacer()
                        HealthBadge(health: status)
                    }
                }
            }
        }
    }
}

struct HealthBadge: View {
    let health: ResourceHealth
    
    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(color)
                .frame(width: 8, height: 8)
            Text(health.rawValue.capitalized)
                .font(.caption)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(color.opacity(0.1))
        .clipShape(Capsule())
    }
    
    private var color: Color {
        switch health {
        case .healthy: return .green
        case .degraded: return .orange
        case .unhealthy: return .red
        case .unknown: return .gray
        }
    }
}

// MARK: - Preview

#Preview {
    StateRegistryView()
}
