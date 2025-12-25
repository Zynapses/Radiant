// RADIANT v4.18.0 - Package Registry Settings View
// UI for configuring GitHub-backed package registry

import SwiftUI

struct PackageRegistrySettingsView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var viewModel = PackageRegistryViewModel()
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Image(systemName: "shippingbox.fill")
                    .font(.title2)
                    .foregroundStyle(.indigo)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text("Package Registry")
                        .font(.headline)
                    Text("Store and manage deployment packages in GitHub")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                Spacer()
                
                if viewModel.isConfigured {
                    Label("Connected", systemImage: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                        .font(.subheadline)
                }
            }
            .padding()
            .background(Color(.textBackgroundColor).opacity(0.5))
            
            Divider()
            
            // Content
            if viewModel.isConfigured {
                ConfiguredRegistryView(viewModel: viewModel)
            } else {
                SetupRegistryView(viewModel: viewModel)
            }
        }
        .onAppear {
            viewModel.checkConfiguration()
        }
    }
}

// MARK: - View Model

@MainActor
class PackageRegistryViewModel: ObservableObject {
    @Published var isConfigured = false
    @Published var isLoading = false
    @Published var error: String?
    
    // Config
    @Published var owner = ""
    @Published var repoName = GitHubPackageRegistry.GitHubConfig.defaultRepo
    @Published var personalAccessToken = ""
    @Published var connectedRepo: String?
    
    // Packages
    @Published var packages: [GitHubPackageRegistry.RegistryIndex.PackageEntry] = []
    
    private let registry = GitHubPackageRegistry()
    
    func checkConfiguration() {
        Task {
            let config = try? await registry.loadConfig()
            isConfigured = config != nil
            if let config = config {
                connectedRepo = config.repoFullName
                await loadPackages()
            }
        }
    }
    
    func createNewRepository() async {
        guard !owner.isEmpty, !repoName.isEmpty, !personalAccessToken.isEmpty else {
            error = "Please fill in all fields"
            return
        }
        
        isLoading = true
        error = nil
        
        do {
            let config = try await registry.createRepository(
                owner: owner,
                repoName: repoName,
                personalAccessToken: personalAccessToken
            )
            
            connectedRepo = config.repoFullName
            isConfigured = true
            
            // Clear sensitive data from memory
            personalAccessToken = ""
            
        } catch {
            self.error = error.localizedDescription
        }
        
        isLoading = false
    }
    
    func connectToExistingRepository() async {
        guard !owner.isEmpty, !repoName.isEmpty, !personalAccessToken.isEmpty else {
            error = "Please fill in all fields"
            return
        }
        
        isLoading = true
        error = nil
        
        do {
            let config = try await registry.connectToRepository(
                owner: owner,
                repo: repoName,
                personalAccessToken: personalAccessToken
            )
            
            connectedRepo = config.repoFullName
            isConfigured = true
            
            // Clear sensitive data from memory
            personalAccessToken = ""
            
            await loadPackages()
            
        } catch {
            self.error = error.localizedDescription
        }
        
        isLoading = false
    }
    
    func loadPackages() async {
        do {
            packages = try await registry.listPackages()
        } catch {
            self.error = error.localizedDescription
        }
    }
    
    func refreshPackages() {
        Task {
            isLoading = true
            await loadPackages()
            isLoading = false
        }
    }
}

// MARK: - Setup View

struct SetupRegistryView: View {
    @ObservedObject var viewModel: PackageRegistryViewModel
    @State private var setupMode: SetupMode = .create
    
    enum SetupMode {
        case create
        case connect
    }
    
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Info
                VStack(spacing: 12) {
                    Image(systemName: "externaldrive.badge.plus")
                        .font(.system(size: 48))
                        .foregroundStyle(.indigo)
                    
                    Text("Set Up Package Registry")
                        .font(.title2)
                        .fontWeight(.semibold)
                    
                    Text("Store deployment packages in a private GitHub repository for version control, changelog tracking, and team collaboration.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }
                .padding(.top)
                
                // Setup mode picker
                Picker("Setup Mode", selection: $setupMode) {
                    Text("Create New Repo").tag(SetupMode.create)
                    Text("Connect Existing").tag(SetupMode.connect)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)
                
                // Form
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("GitHub Username or Organization")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        TextField("username", text: $viewModel.owner)
                            .textFieldStyle(.roundedBorder)
                    }
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Repository Name")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        TextField("radiant-packages", text: $viewModel.repoName)
                            .textFieldStyle(.roundedBorder)
                    }
                    
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Personal Access Token")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            
                            Spacer()
                            
                            Button {
                                NSWorkspace.shared.open(URL(string: "https://github.com/settings/tokens/new?scopes=repo&description=RADIANT%20Deployer")!)
                            } label: {
                                Text("Generate Token")
                                    .font(.caption)
                            }
                            .buttonStyle(.link)
                        }
                        
                        SecureField("ghp_...", text: $viewModel.personalAccessToken)
                            .textFieldStyle(.roundedBorder)
                        
                        Text("Requires 'repo' scope for private repository access")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding()
                .background(Color(.textBackgroundColor).opacity(0.5))
                .cornerRadius(12)
                .padding(.horizontal)
                
                // Error
                if let error = viewModel.error {
                    HStack {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(.red)
                        Text(error)
                            .font(.caption)
                    }
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(Color.red.opacity(0.1))
                    .cornerRadius(8)
                    .padding(.horizontal)
                }
                
                // Action button
                Button {
                    Task {
                        if setupMode == .create {
                            await viewModel.createNewRepository()
                        } else {
                            await viewModel.connectToExistingRepository()
                        }
                    }
                } label: {
                    HStack {
                        if viewModel.isLoading {
                            ProgressView()
                                .controlSize(.small)
                        }
                        Text(setupMode == .create ? "Create Repository" : "Connect")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(viewModel.owner.isEmpty || viewModel.repoName.isEmpty || viewModel.personalAccessToken.isEmpty || viewModel.isLoading)
                .padding(.horizontal)
                
                // Security note
                HStack(spacing: 8) {
                    Image(systemName: "lock.shield")
                        .foregroundStyle(.blue)
                    Text("Your Personal Access Token will be stored securely in 1Password")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal)
                
                Spacer()
            }
        }
    }
}

// MARK: - Configured Registry View

struct ConfiguredRegistryView: View {
    @ObservedObject var viewModel: PackageRegistryViewModel
    @State private var showUploadSheet = false
    @State private var showSyncSheet = false
    @State private var showHistorySheet = false
    @State private var showDeprecateSheet = false
    @State private var packageToDeprecate: String?
    @State private var isDeprecating = false
    
    var body: some View {
        VStack(spacing: 0) {
            // Connection info
            HStack {
                Image(systemName: "link.circle.fill")
                    .foregroundStyle(.green)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(viewModel.connectedRepo ?? "Unknown")
                        .font(.subheadline)
                        .fontWeight(.medium)
                    Text("Private Repository")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                Spacer()
                
                // History button
                Button {
                    showHistorySheet = true
                } label: {
                    Label("History", systemImage: "clock.arrow.circlepath")
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                
                // Sync button
                Button {
                    showSyncSheet = true
                } label: {
                    Label("Sync", systemImage: "arrow.triangle.2.circlepath")
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                
                Button {
                    if let repo = viewModel.connectedRepo {
                        NSWorkspace.shared.open(URL(string: "https://github.com/\(repo)")!)
                    }
                } label: {
                    Label("Open in GitHub", systemImage: "arrow.up.right.square")
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }
            .padding()
            .background(Color.green.opacity(0.05))
            
            Divider()
            
            // Packages list header
            HStack {
                Text("Packages")
                    .font(.headline)
                
                Text("(\(viewModel.packages.count))")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                
                Spacer()
                
                Button {
                    viewModel.refreshPackages()
                } label: {
                    if viewModel.isLoading {
                        ProgressView()
                            .controlSize(.small)
                    } else {
                        Label("Refresh", systemImage: "arrow.clockwise")
                    }
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                .disabled(viewModel.isLoading)
                
                Button {
                    showUploadSheet = true
                } label: {
                    Label("Upload Package", systemImage: "plus")
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
            }
            .padding()
            
            Divider()
            
            // Packages list
            if viewModel.packages.isEmpty {
                VStack(spacing: 12) {
                    Spacer()
                    Image(systemName: "shippingbox")
                        .font(.system(size: 40))
                        .foregroundStyle(.secondary)
                    Text("No Packages")
                        .font(.headline)
                    Text("Upload your first deployment package to get started")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Spacer()
                }
            } else {
                List(viewModel.packages) { package in
                    PackageRowView(
                        package: package,
                        onDeprecate: { version in
                            packageToDeprecate = version
                            showDeprecateSheet = true
                        },
                        onUndeprecate: { version in
                            Task {
                                await undeprecatePackage(version)
                            }
                        },
                        onPublish: { version in
                            Task {
                                await publishPackage(version)
                            }
                        },
                        onUnpublish: { version in
                            Task {
                                await unpublishPackage(version)
                            }
                        }
                    )
                }
            }
        }
        .sheet(isPresented: $showUploadSheet) {
            UploadPackageSheet(viewModel: viewModel)
        }
        .sheet(isPresented: $showSyncSheet) {
            PackageSyncSheet(viewModel: viewModel)
        }
        .sheet(isPresented: $showHistorySheet) {
            PackageHistorySheet(viewModel: viewModel)
        }
        .sheet(isPresented: $showDeprecateSheet) {
            DeprecatePackageSheet(
                version: packageToDeprecate ?? "",
                availableVersions: viewModel.packages.filter { $0.version != packageToDeprecate && $0.isDeprecated != true }.map { $0.version },
                onDeprecate: { reason, replacement in
                    Task {
                        await deprecatePackage(packageToDeprecate ?? "", reason: reason, replacement: replacement)
                        showDeprecateSheet = false
                    }
                }
            )
        }
    }
    
    private func deprecatePackage(_ version: String, reason: String, replacement: String?) async {
        isDeprecating = true
        do {
            let registry = GitHubPackageRegistry()
            try await registry.deprecatePackage(version: version, reason: reason, replacementVersion: replacement)
            await viewModel.loadPackages()
            ToastManager.shared.showSuccess("Package Deprecated", message: "v\(version) has been deprecated")
        } catch {
            ToastManager.shared.showError("Deprecation Failed", message: error.localizedDescription)
        }
        isDeprecating = false
    }
    
    private func undeprecatePackage(_ version: String) async {
        isDeprecating = true
        do {
            let registry = GitHubPackageRegistry()
            try await registry.undeprecatePackage(version: version)
            await viewModel.loadPackages()
            ToastManager.shared.showSuccess("Deprecation Removed", message: "v\(version) is no longer deprecated")
        } catch {
            ToastManager.shared.showError("Failed", message: error.localizedDescription)
        }
        isDeprecating = false
    }
    
    private func publishPackage(_ version: String) async {
        do {
            let registry = GitHubPackageRegistry()
            try await registry.publishPackage(version: version)
            await viewModel.loadPackages()
            ToastManager.shared.showSuccess("Package Published", message: "v\(version) is now available for deployment")
        } catch {
            ToastManager.shared.showError("Publishing Failed", message: error.localizedDescription)
        }
    }
    
    private func unpublishPackage(_ version: String) async {
        do {
            let registry = GitHubPackageRegistry()
            try await registry.unpublishPackage(version: version)
            await viewModel.loadPackages()
            ToastManager.shared.showSuccess("Package Unpublished", message: "v\(version) is no longer available for deployment")
        } catch {
            ToastManager.shared.showError("Failed", message: error.localizedDescription)
        }
    }
}

// MARK: - Deprecate Package Sheet

struct DeprecatePackageSheet: View {
    let version: String
    let availableVersions: [String]
    let onDeprecate: (String, String?) -> Void
    
    @Environment(\.dismiss) private var dismiss
    @State private var reason = ""
    @State private var selectedReplacement: String?
    @State private var useReplacement = false
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Deprecate Package")
                    .font(.headline)
                Spacer()
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
            .padding()
            
            Divider()
            
            // Content
            VStack(alignment: .leading, spacing: 20) {
                // Warning
                HStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.title)
                        .foregroundStyle(.yellow)
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Deprecating v\(version)")
                            .font(.headline)
                        Text("This package will be marked as deprecated. Users will be warned not to use this version.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding()
                .background(Color.yellow.opacity(0.1))
                .cornerRadius(8)
                
                // Reason
                VStack(alignment: .leading, spacing: 8) {
                    Text("Deprecation Reason")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    
                    TextField("e.g., Security vulnerability, replaced by newer version", text: $reason, axis: .vertical)
                        .textFieldStyle(.roundedBorder)
                        .lineLimit(3...5)
                }
                
                // Replacement version
                VStack(alignment: .leading, spacing: 8) {
                    Toggle("Suggest Replacement Version", isOn: $useReplacement)
                        .font(.subheadline)
                    
                    if useReplacement && !availableVersions.isEmpty {
                        Picker("Replacement", selection: $selectedReplacement) {
                            Text("Select version").tag(nil as String?)
                            ForEach(availableVersions, id: \.self) { version in
                                Text("v\(version)").tag(version as String?)
                            }
                        }
                        .pickerStyle(.menu)
                    } else if useReplacement && availableVersions.isEmpty {
                        Text("No other non-deprecated versions available")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding()
            
            Spacer()
            
            Divider()
            
            // Actions
            HStack {
                Button("Cancel") {
                    dismiss()
                }
                
                Spacer()
                
                Button("Deprecate") {
                    onDeprecate(reason, useReplacement ? selectedReplacement : nil)
                }
                .buttonStyle(.borderedProminent)
                .tint(.orange)
                .disabled(reason.isEmpty)
            }
            .padding()
        }
        .frame(width: 450, height: 420)
    }
}

// MARK: - Package History Sheet

struct PackageHistorySheet: View {
    @ObservedObject var viewModel: PackageRegistryViewModel
    @Environment(\.dismiss) private var dismiss
    
    @State private var selectedTab = 0
    @State private var historyEntries: [GitHubPackageRegistry.PackageHistory.HistoryEntry] = []
    @State private var snapshots: [GitHubPackageRegistry.HistorySnapshot] = []
    @State private var isLoading = false
    @State private var error: String?
    @State private var showCreateSnapshot = false
    @State private var snapshotDescription = ""
    @State private var selectedSnapshot: GitHubPackageRegistry.HistorySnapshot?
    @State private var showRestoreConfirm = false
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Package History")
                    .font(.headline)
                Spacer()
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
            .padding()
            
            Divider()
            
            // Tab selector
            Picker("View", selection: $selectedTab) {
                Text("History").tag(0)
                Text("Snapshots").tag(1)
            }
            .pickerStyle(.segmented)
            .padding()
            
            // Content
            if isLoading {
                Spacer()
                ProgressView("Loading...")
                Spacer()
            } else if let error = error {
                VStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.largeTitle)
                        .foregroundStyle(.orange)
                    Text(error)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Button("Retry") {
                        Task { await loadData() }
                    }
                }
                .padding()
            } else {
                if selectedTab == 0 {
                    historyListView
                } else {
                    snapshotsListView
                }
            }
            
            Divider()
            
            // Actions
            HStack {
                Button("Close") {
                    dismiss()
                }
                
                Spacer()
                
                if selectedTab == 1 {
                    Button {
                        showCreateSnapshot = true
                    } label: {
                        Label("Create Snapshot", systemImage: "camera.fill")
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
            .padding()
        }
        .frame(width: 600, height: 500)
        .task {
            await loadData()
        }
        .sheet(isPresented: $showCreateSnapshot) {
            createSnapshotSheet
        }
        .alert("Restore Snapshot?", isPresented: $showRestoreConfirm) {
            Button("Cancel", role: .cancel) { }
            Button("Restore", role: .destructive) {
                if let snapshot = selectedSnapshot {
                    Task { await restoreSnapshot(snapshot) }
                }
            }
        } message: {
            if let snapshot = selectedSnapshot {
                Text("This will restore the registry to the state from '\(snapshot.description)'. A backup snapshot will be created automatically.")
            }
        }
    }
    
    private var historyListView: some View {
        Group {
            if historyEntries.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "clock.arrow.circlepath")
                        .font(.system(size: 40))
                        .foregroundStyle(.secondary)
                    Text("No History")
                        .font(.headline)
                    Text("Package history will appear here as you install, update, and manage packages.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding()
            } else {
                List(historyEntries, id: \.id) { entry in
                    HistoryEntryRow(entry: entry)
                }
            }
        }
    }
    
    private var snapshotsListView: some View {
        Group {
            if snapshots.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "camera.on.rectangle")
                        .font(.system(size: 40))
                        .foregroundStyle(.secondary)
                    Text("No Snapshots")
                        .font(.headline)
                    Text("Create snapshots to save the current state of your package registry for easy restore.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding()
            } else {
                List(snapshots, id: \.id) { snapshot in
                    PackageSnapshotRow(snapshot: snapshot) {
                        selectedSnapshot = snapshot
                        showRestoreConfirm = true
                    }
                }
            }
        }
    }
    
    private var createSnapshotSheet: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Create Snapshot")
                    .font(.headline)
                Spacer()
                Button {
                    showCreateSnapshot = false
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
            .padding()
            
            Divider()
            
            VStack(alignment: .leading, spacing: 16) {
                Text("Create a snapshot of the current package registry state. You can restore to this snapshot later.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                
                TextField("Description", text: $snapshotDescription, prompt: Text("e.g., Before major update"))
                    .textFieldStyle(.roundedBorder)
            }
            .padding()
            
            Spacer()
            
            Divider()
            
            HStack {
                Button("Cancel") {
                    showCreateSnapshot = false
                }
                
                Spacer()
                
                Button("Create") {
                    Task {
                        await createSnapshot()
                        showCreateSnapshot = false
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(snapshotDescription.isEmpty)
            }
            .padding()
        }
        .frame(width: 400, height: 250)
    }
    
    private func loadData() async {
        isLoading = true
        error = nil
        
        do {
            let registry = GitHubPackageRegistry()
            historyEntries = try await registry.getRecentHistory(limit: 100)
            snapshots = try await registry.listSnapshots()
        } catch {
            self.error = error.localizedDescription
        }
        
        isLoading = false
    }
    
    private func createSnapshot() async {
        isLoading = true
        
        do {
            let registry = GitHubPackageRegistry()
            let snapshot = try await registry.createHistorySnapshot(description: snapshotDescription)
            snapshots.insert(snapshot, at: 0)
            snapshotDescription = ""
        } catch {
            self.error = error.localizedDescription
        }
        
        isLoading = false
    }
    
    private func restoreSnapshot(_ snapshot: GitHubPackageRegistry.HistorySnapshot) async {
        isLoading = true
        
        do {
            let registry = GitHubPackageRegistry()
            try await registry.restoreFromSnapshot(snapshotId: snapshot.id)
            await viewModel.loadPackages()
            await loadData()
        } catch {
            self.error = error.localizedDescription
        }
        
        isLoading = false
    }
}

struct HistoryEntryRow: View {
    let entry: GitHubPackageRegistry.PackageHistory.HistoryEntry
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: actionIcon)
                .font(.title2)
                .foregroundStyle(actionColor)
                .frame(width: 30)
            
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(entry.action.rawValue.replacingOccurrences(of: "_", with: " ").capitalized)
                        .font(.subheadline)
                        .fontWeight(.medium)
                    
                    Text("v\(entry.packageVersion)")
                        .font(.caption)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.blue.opacity(0.2))
                        .foregroundStyle(.blue)
                        .cornerRadius(4)
                }
                
                if let details = entry.details {
                    Text(details)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                
                HStack {
                    Text(entry.actor)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    
                    Text("•")
                        .foregroundStyle(.secondary)
                    
                    Text(entry.timestamp.formatted(date: .abbreviated, time: .shortened))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            
            Spacer()
        }
        .padding(.vertical, 4)
    }
    
    private var actionIcon: String {
        switch entry.action {
        case .installed: return "arrow.down.circle.fill"
        case .updated: return "arrow.triangle.2.circlepath.circle.fill"
        case .rolledBack: return "arrow.uturn.backward.circle.fill"
        case .removed: return "trash.circle.fill"
        case .uploaded: return "arrow.up.circle.fill"
        case .restored: return "clock.arrow.circlepath"
        case .snapshotCreated: return "camera.circle.fill"
        case .deprecated: return "exclamationmark.triangle.fill"
        case .undeprecated: return "checkmark.circle.fill"
        case .published: return "checkmark.seal.fill"
        case .unpublished: return "xmark.seal.fill"
        }
    }
    
    private var actionColor: Color {
        switch entry.action {
        case .installed: return .green
        case .updated: return .blue
        case .rolledBack: return .orange
        case .removed: return .red
        case .uploaded: return .purple
        case .restored: return .cyan
        case .snapshotCreated: return .indigo
        case .deprecated: return .yellow
        case .undeprecated: return .green
        case .published: return .green
        case .unpublished: return .gray
        }
    }
}

struct PackageSnapshotRow: View {
    let snapshot: GitHubPackageRegistry.HistorySnapshot
    let onRestore: () -> Void
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "camera.fill")
                .font(.title2)
                .foregroundStyle(.indigo)
                .frame(width: 30)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(snapshot.description)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                HStack {
                    Text("\(snapshot.registryState.packages.count) packages")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    
                    Text("•")
                        .foregroundStyle(.secondary)
                    
                    Text(snapshot.createdBy)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    
                    Text("•")
                        .foregroundStyle(.secondary)
                    
                    Text(snapshot.createdAt.formatted(date: .abbreviated, time: .shortened))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            
            Spacer()
            
            Button("Restore") {
                onRestore()
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Package Sync Sheet

struct PackageSyncSheet: View {
    @ObservedObject var viewModel: PackageRegistryViewModel
    @Environment(\.dismiss) private var dismiss
    
    @State private var selectedAction: SyncAction = .sync
    @State private var isRunning = false
    @State private var progress: Double = 0
    @State private var statusMessage = ""
    @State private var result: SyncResultInfo?
    @State private var error: String?
    @State private var selectedVersion: String?
    
    enum SyncAction: String, CaseIterable {
        case sync = "Sync from GitHub"
        case backup = "Backup to GitHub"
        case restore = "Restore Package"
        
        var icon: String {
            switch self {
            case .sync: return "arrow.down.circle"
            case .backup: return "arrow.up.circle"
            case .restore: return "arrow.counterclockwise.circle"
            }
        }
        
        var description: String {
            switch self {
            case .sync: return "Download packages from GitHub to local cache"
            case .backup: return "Upload local packages to GitHub registry"
            case .restore: return "Restore a specific package version"
            }
        }
    }
    
    struct SyncResultInfo {
        let added: Int
        let updated: Int
        let removed: Int
        let errors: [String]
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Package Sync")
                    .font(.headline)
                Spacer()
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .disabled(isRunning)
            }
            .padding()
            
            Divider()
            
            // Content
            ScrollView {
                VStack(spacing: 20) {
                    // Action selector
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Action")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        
                        ForEach(SyncAction.allCases, id: \.self) { action in
                            Button {
                                selectedAction = action
                                result = nil
                                error = nil
                            } label: {
                                HStack(spacing: 12) {
                                    Image(systemName: action.icon)
                                        .font(.title2)
                                        .foregroundStyle(selectedAction == action ? .white : .accentColor)
                                        .frame(width: 40)
                                    
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(action.rawValue)
                                            .font(.subheadline)
                                            .fontWeight(.medium)
                                        Text(action.description)
                                            .font(.caption)
                                            .foregroundStyle(selectedAction == action ? .white.opacity(0.8) : .secondary)
                                    }
                                    
                                    Spacer()
                                    
                                    if selectedAction == action {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundStyle(.white)
                                    }
                                }
                                .padding()
                                .background(selectedAction == action ? Color.accentColor : Color(.textBackgroundColor))
                                .cornerRadius(10)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding()
                    .background(Color(.textBackgroundColor).opacity(0.5))
                    .cornerRadius(12)
                    
                    // Restore version picker (only for restore action)
                    if selectedAction == .restore {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Select Version to Restore")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            
                            Picker("Version", selection: $selectedVersion) {
                                Text("Select a version").tag(nil as String?)
                                ForEach(viewModel.packages, id: \.id) { pkg in
                                    Text("v\(pkg.version) - \(pkg.channel)").tag(pkg.version as String?)
                                }
                            }
                            .pickerStyle(.menu)
                        }
                        .padding()
                        .background(Color(.textBackgroundColor).opacity(0.5))
                        .cornerRadius(12)
                    }
                    
                    // Progress
                    if isRunning {
                        VStack(spacing: 12) {
                            ProgressView(value: progress)
                            
                            Text(statusMessage)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .padding()
                        .background(Color(.textBackgroundColor).opacity(0.5))
                        .cornerRadius(12)
                    }
                    
                    // Result
                    if let result = result {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Image(systemName: result.errors.isEmpty ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                                    .foregroundStyle(result.errors.isEmpty ? .green : .orange)
                                Text(result.errors.isEmpty ? "Sync Complete" : "Completed with Warnings")
                                    .font(.headline)
                            }
                            
                            HStack(spacing: 20) {
                                StatBadge(label: "Added", value: result.added, color: .green)
                                StatBadge(label: "Updated", value: result.updated, color: .blue)
                                StatBadge(label: "Removed", value: result.removed, color: .red)
                            }
                            
                            if !result.errors.isEmpty {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Errors:")
                                        .font(.caption)
                                        .fontWeight(.semibold)
                                    ForEach(result.errors, id: \.self) { err in
                                        Text("• \(err)")
                                            .font(.caption)
                                            .foregroundStyle(.red)
                                    }
                                }
                            }
                        }
                        .padding()
                        .background(Color.green.opacity(0.1))
                        .cornerRadius(12)
                    }
                    
                    // Error
                    if let error = error {
                        HStack {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundStyle(.red)
                            Text(error)
                                .font(.caption)
                        }
                        .padding()
                        .frame(maxWidth: .infinity)
                        .background(Color.red.opacity(0.1))
                        .cornerRadius(8)
                    }
                }
                .padding()
            }
            
            Divider()
            
            // Actions
            HStack {
                Button("Close") {
                    dismiss()
                }
                .keyboardShortcut(.cancelAction)
                .disabled(isRunning)
                
                Spacer()
                
                Button {
                    runAction()
                } label: {
                    HStack {
                        if isRunning {
                            ProgressView()
                                .controlSize(.small)
                        }
                        Text(isRunning ? "Running..." : "Start")
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(isRunning || (selectedAction == .restore && selectedVersion == nil))
                .keyboardShortcut(.defaultAction)
            }
            .padding()
        }
        .frame(width: 500, height: 600)
    }
    
    private func runAction() {
        isRunning = true
        error = nil
        result = nil
        progress = 0
        
        Task {
            do {
                let registry = GitHubPackageRegistry()
                let cacheURL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
                    .appendingPathComponent("RadiantDeployer")
                    .appendingPathComponent("packages")
                
                switch selectedAction {
                case .sync:
                    let syncResult = try await registry.syncFromGitHub(localCacheURL: cacheURL) { message, prog in
                        Task { @MainActor in
                            statusMessage = message
                            progress = prog
                        }
                    }
                    
                    await MainActor.run {
                        result = SyncResultInfo(
                            added: syncResult.packagesAdded,
                            updated: syncResult.packagesUpdated,
                            removed: syncResult.packagesRemoved,
                            errors: syncResult.errors
                        )
                    }
                    
                case .backup:
                    let uploaded = try await registry.backupToGitHub(localCacheURL: cacheURL) { message, prog in
                        Task { @MainActor in
                            statusMessage = message
                            progress = prog
                        }
                    }
                    
                    await MainActor.run {
                        result = SyncResultInfo(added: uploaded, updated: 0, removed: 0, errors: [])
                    }
                    
                case .restore:
                    guard let version = selectedVersion else { return }
                    
                    _ = try await registry.restorePackage(version: version, to: cacheURL) { prog in
                        Task { @MainActor in
                            statusMessage = "Restoring v\(version)..."
                            progress = prog
                        }
                    }
                    
                    await MainActor.run {
                        result = SyncResultInfo(added: 1, updated: 0, removed: 0, errors: [])
                    }
                }
                
                await viewModel.loadPackages()
                
            } catch {
                await MainActor.run {
                    self.error = error.localizedDescription
                }
            }
            
            await MainActor.run {
                isRunning = false
            }
        }
    }
}

struct StatBadge: View {
    let label: String
    let value: Int
    let color: Color
    
    var body: some View {
        VStack(spacing: 4) {
            Text("\(value)")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundStyle(color)
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(minWidth: 60)
    }
}

// MARK: - Package Row

struct PackageRowView: View {
    let package: GitHubPackageRegistry.RegistryIndex.PackageEntry
    var onDeprecate: ((String) -> Void)?
    var onUndeprecate: ((String) -> Void)?
    var onPublish: ((String) -> Void)?
    var onUnpublish: ((String) -> Void)?
    
    var body: some View {
        HStack(spacing: 12) {
            // Icon
            ZStack {
                Image(systemName: package.isCustom ? "cube.fill" : "shippingbox.fill")
                    .font(.title2)
                    .foregroundStyle(iconColor)
                    .frame(width: 40)
                
                // Status badge overlay
                if package.isDeprecated == true {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.caption)
                        .foregroundStyle(.yellow)
                        .offset(x: 12, y: 12)
                } else if package.isPublished == true {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.caption)
                        .foregroundStyle(.green)
                        .offset(x: 12, y: 12)
                }
            }
            
            // Info
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("v\(package.version)")
                        .font(.headline)
                        .strikethrough(package.isDeprecated == true)
                        .foregroundStyle(package.isDeprecated == true ? .secondary : .primary)
                    
                    // Published badge
                    if package.isPublished == true {
                        Text("Published")
                            .font(.caption)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.green.opacity(0.2))
                            .foregroundStyle(.green)
                            .cornerRadius(4)
                    } else {
                        Text("Draft")
                            .font(.caption)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.gray.opacity(0.2))
                            .foregroundStyle(.secondary)
                            .cornerRadius(4)
                    }
                    
                    Text(package.channel.capitalized)
                        .font(.caption)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(channelColor.opacity(0.2))
                        .foregroundStyle(channelColor)
                        .cornerRadius(4)
                    
                    if package.isDeprecated == true {
                        Text("Deprecated")
                            .font(.caption)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.yellow.opacity(0.2))
                            .foregroundStyle(.orange)
                            .cornerRadius(4)
                    }
                    
                    if package.isCustom {
                        Text("Custom")
                            .font(.caption)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.purple.opacity(0.2))
                            .foregroundStyle(.purple)
                            .cornerRadius(4)
                    }
                }
                
                HStack(spacing: 8) {
                    Text(package.buildId)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    
                    Text("•")
                        .foregroundStyle(.secondary)
                    
                    Text(formatSize(package.size))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    
                    Text("•")
                        .foregroundStyle(.secondary)
                    
                    Text(package.createdAt.formatted(date: .abbreviated, time: .shortened))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                if let notes = package.releaseNotes {
                    Text(notes)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                
                // Show deprecation info
                if package.isDeprecated == true {
                    HStack(spacing: 4) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.caption2)
                            .foregroundStyle(.orange)
                        
                        if let reason = package.deprecationReason {
                            Text(reason)
                                .font(.caption)
                                .foregroundStyle(.orange)
                                .lineLimit(1)
                        }
                        
                        if let replacement = package.replacementVersion {
                            Text("→ v\(replacement)")
                                .font(.caption)
                                .fontWeight(.medium)
                                .foregroundStyle(.blue)
                        }
                    }
                }
            }
            
            Spacer()
            
            // Actions
            Menu {
                // Publishing actions (first priority)
                if package.isDeprecated != true {
                    if package.isPublished == true {
                        Button {
                            onUnpublish?(package.version)
                        } label: {
                            Label("Unpublish", systemImage: "xmark.seal")
                        }
                    } else {
                        Button {
                            onPublish?(package.version)
                        } label: {
                            Label("Publish", systemImage: "checkmark.seal")
                        }
                    }
                    
                    Divider()
                }
                
                Button {
                    // Download
                } label: {
                    Label("Download", systemImage: "arrow.down.circle")
                }
                
                Button {
                    // View changelog
                } label: {
                    Label("View Changelog", systemImage: "doc.text")
                }
                
                Divider()
                
                if package.isDeprecated == true {
                    Button {
                        onUndeprecate?(package.version)
                    } label: {
                        Label("Remove Deprecation", systemImage: "checkmark.circle")
                    }
                } else {
                    Button {
                        onDeprecate?(package.version)
                    } label: {
                        Label("Deprecate Package", systemImage: "exclamationmark.triangle")
                    }
                }
                
                Divider()
                
                Button(role: .destructive) {
                    // Delete
                } label: {
                    Label("Delete", systemImage: "trash")
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .font(.title3)
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 4)
    }
    
    private var iconColor: Color {
        if package.isDeprecated == true {
            return .gray
        } else if package.isPublished == true {
            return channelColor
        } else {
            return .gray.opacity(0.7)
        }
    }
    
    private var channelColor: Color {
        switch package.channel {
        case "stable": return .green
        case "beta": return .orange
        default: return .gray
        }
    }
    
    private func formatSize(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: bytes)
    }
}

// MARK: - Upload Package Sheet

struct UploadPackageSheet: View {
    @ObservedObject var viewModel: PackageRegistryViewModel
    @Environment(\.dismiss) private var dismiss
    
    @State private var selectedFile: URL?
    @State private var channel: ReleaseChannel = .stable
    @State private var changelog = ""
    @State private var releaseNotes = ""
    @State private var isCustom = false
    @State private var isUploading = false
    @State private var uploadProgress: Double = 0
    @State private var error: String?
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Upload Package")
                    .font(.headline)
                Spacer()
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
            .padding()
            
            Divider()
            
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // File selection
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Package File")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        
                        HStack {
                            if let file = selectedFile {
                                Image(systemName: "doc.fill")
                                    .foregroundStyle(.indigo)
                                Text(file.lastPathComponent)
                                    .font(.subheadline)
                                Spacer()
                                Button("Change") {
                                    selectFile()
                                }
                                .buttonStyle(.bordered)
                                .controlSize(.small)
                            } else {
                                Button {
                                    selectFile()
                                } label: {
                                    HStack {
                                        Image(systemName: "doc.badge.plus")
                                        Text("Select .radpkg file")
                                    }
                                    .frame(maxWidth: .infinity)
                                    .padding()
                                    .background(Color(.textBackgroundColor))
                                    .cornerRadius(8)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    
                    // Channel
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Release Channel")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        
                        Picker("Channel", selection: $channel) {
                            Text("Stable").tag(ReleaseChannel.stable)
                            Text("Beta").tag(ReleaseChannel.beta)
                        }
                        .pickerStyle(.segmented)
                    }
                    
                    // Custom package toggle
                    Toggle("This is a custom/modified package", isOn: $isCustom)
                        .font(.subheadline)
                    
                    // Release notes
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Release Notes")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        
                        TextField("Brief description of this release...", text: $releaseNotes, axis: .vertical)
                            .textFieldStyle(.roundedBorder)
                            .lineLimit(2...4)
                    }
                    
                    // Changelog
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Changelog (Markdown)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        
                        TextEditor(text: $changelog)
                            .font(.system(.body, design: .monospaced))
                            .frame(minHeight: 100)
                            .padding(4)
                            .background(Color(.textBackgroundColor))
                            .cornerRadius(8)
                    }
                    
                    // Error
                    if let error = error {
                        HStack {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundStyle(.red)
                            Text(error)
                                .font(.caption)
                        }
                        .padding()
                        .frame(maxWidth: .infinity)
                        .background(Color.red.opacity(0.1))
                        .cornerRadius(8)
                    }
                    
                    // Progress
                    if isUploading {
                        VStack(spacing: 8) {
                            ProgressView(value: uploadProgress)
                            Text("Uploading... \(Int(uploadProgress * 100))%")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .padding()
            }
            
            Divider()
            
            // Actions
            HStack {
                Button("Cancel") {
                    dismiss()
                }
                .keyboardShortcut(.cancelAction)
                
                Spacer()
                
                Button {
                    uploadPackage()
                } label: {
                    HStack {
                        if isUploading {
                            ProgressView()
                                .controlSize(.small)
                        }
                        Text(isUploading ? "Uploading..." : "Upload")
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(selectedFile == nil || isUploading)
                .keyboardShortcut(.defaultAction)
            }
            .padding()
        }
        .frame(width: 500, height: 550)
    }
    
    private func selectFile() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.init(filenameExtension: "radpkg")!]
        panel.allowsMultipleSelection = false
        
        if panel.runModal() == .OK {
            selectedFile = panel.url
        }
    }
    
    private func uploadPackage() {
        guard let fileURL = selectedFile else { return }
        
        isUploading = true
        error = nil
        
        Task {
            do {
                let data = try Data(contentsOf: fileURL)
                
                // Load manifest from package
                // For now, create a placeholder - in production would extract from .radpkg
                let manifest = PackageManifest(
                    packageFormat: "1.0",
                    version: RADIANT_VERSION,
                    buildId: String(UUID().uuidString.prefix(8)),
                    buildTimestamp: Date(),
                    buildHost: Host.current().localizedName ?? "unknown",
                    components: PackageManifest.ComponentVersions(
                        radiantPlatform: .init(version: RADIANT_VERSION, minUpgradeFrom: nil, changelog: changelog.isEmpty ? nil : changelog),
                        thinkTank: nil
                    ),
                    migrations: PackageManifest.MigrationInfo(radiant: nil, thinktank: nil),
                    dependencies: PackageManifest.DependencyInfo(awsCdk: "2.x", nodejs: "20.x", postgresql: "15"),
                    compatibility: PackageManifest.CompatibilityInfo(minimumDeployerVersion: RADIANT_VERSION, supportedTiers: ["1", "2", "3", "4"], supportedRegions: ["us-east-1", "us-west-2", "eu-west-1"]),
                    integrity: PackageManifest.IntegrityInfo(algorithm: "sha256", packageHash: "", signedBy: nil, signature: nil),
                    installBehavior: PackageManifest.InstallBehavior(seedAIRegistry: true, createInitialAdmin: true, runFullMigrations: true),
                    updateBehavior: PackageManifest.UpdateBehavior(seedAIRegistry: false, preserveAdminCustomizations: true, runIncrementalMigrations: true, createPreUpdateSnapshot: true),
                    rollbackBehavior: PackageManifest.RollbackBehavior(supportedFromVersions: [], requiresDatabaseRollback: true)
                )
                
                let registry = GitHubPackageRegistry()
                _ = try await registry.uploadPackage(
                    packageData: data,
                    manifest: manifest,
                    channel: channel,
                    changelog: changelog.isEmpty ? nil : changelog,
                    releaseNotes: releaseNotes.isEmpty ? nil : releaseNotes,
                    isCustom: isCustom,
                    parentVersion: nil,
                    onProgress: { progress in
                        Task { @MainActor in
                            uploadProgress = progress
                        }
                    }
                )
                
                await viewModel.loadPackages()
                
                await MainActor.run {
                    dismiss()
                }
                
            } catch {
                await MainActor.run {
                    self.error = error.localizedDescription
                    isUploading = false
                }
            }
        }
    }
}

#Preview {
    PackageRegistrySettingsView()
        .environmentObject(AppState())
        .frame(width: 600, height: 500)
}
