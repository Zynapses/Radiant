// RADIANT v7.1.0 - Dependency Manager View
// UI for checking and installing required CLI tools

import SwiftUI

struct DependencyManagerView: View {
    @State private var checkResult: DependencyCheckResult?
    @State private var isChecking = false
    @State private var isInstalling = false
    @State private var installationProgress: [DependencyType: InstallationProgress] = [:]
    @State private var showInstallConfirmation = false
    @State private var error: String?
    
    private let dependencyManager = DependencyManagerService.shared
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            headerView
            
            Divider()
            
            // Content
            if isChecking {
                loadingView
            } else if let result = checkResult {
                dependencyListView(result)
            } else {
                emptyStateView
            }
        }
        .frame(minWidth: 600, minHeight: 400)
        .task {
            await checkDependencies()
        }
        .alert("Install Missing Dependencies?", isPresented: $showInstallConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Install All") {
                Task { await installMissing() }
            }
        } message: {
            if let missing = checkResult?.missingRequired {
                Text("The following required tools will be installed:\n\(missing.map { $0.rawValue }.joined(separator: ", "))")
            }
        }
    }
    
    // MARK: - Header
    
    private var headerView: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Dependency Manager")
                    .font(.title2)
                    .fontWeight(.semibold)
                
                Text("Required CLI tools for deployment")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            HStack(spacing: 12) {
                if let result = checkResult {
                    statusBadge(result)
                }
                
                Button(action: { Task { await checkDependencies() } }) {
                    Label("Refresh", systemImage: "arrow.clockwise")
                }
                .disabled(isChecking)
                
                if checkResult?.missingRequired.isEmpty == false {
                    Button(action: { showInstallConfirmation = true }) {
                        Label("Install Missing", systemImage: "arrow.down.circle")
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isInstalling)
                }
            }
        }
        .padding()
    }
    
    private func statusBadge(_ result: DependencyCheckResult) -> some View {
        HStack(spacing: 6) {
            Circle()
                .fill(result.allRequiredInstalled ? Color.green : Color.orange)
                .frame(width: 8, height: 8)
            
            Text(result.allRequiredInstalled ? "All Ready" : "\(result.missingRequired.count) Missing")
                .font(.caption)
                .fontWeight(.medium)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(result.allRequiredInstalled ? Color.green.opacity(0.1) : Color.orange.opacity(0.1))
        )
    }
    
    // MARK: - Loading View
    
    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.5)
            Text("Checking dependencies...")
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    // MARK: - Empty State
    
    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.shield")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            
            Text("Click Refresh to check dependencies")
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    // MARK: - Dependency List
    
    private func dependencyListView(_ result: DependencyCheckResult) -> some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                // Required Dependencies
                Section {
                    ForEach(result.dependencies.filter { $0.dependency.isRequired }, id: \.dependency) { status in
                        dependencyRow(status)
                    }
                } header: {
                    sectionHeader("Required", count: result.dependencies.filter { $0.dependency.isRequired }.count)
                }
                
                // Optional Dependencies
                Section {
                    ForEach(result.dependencies.filter { !$0.dependency.isRequired }, id: \.dependency) { status in
                        dependencyRow(status)
                    }
                } header: {
                    sectionHeader("Optional", count: result.dependencies.filter { !$0.dependency.isRequired }.count)
                }
            }
            .padding()
        }
    }
    
    private func sectionHeader(_ title: String, count: Int) -> some View {
        HStack {
            Text(title)
                .font(.headline)
            
            Text("\(count)")
                .font(.caption)
                .padding(.horizontal, 8)
                .padding(.vertical, 2)
                .background(Color.secondary.opacity(0.2))
                .clipShape(Capsule())
            
            Spacer()
        }
        .padding(.vertical, 8)
    }
    
    private func dependencyRow(_ status: DependencyStatus) -> some View {
        HStack(spacing: 12) {
            // Status Icon
            ZStack {
                Circle()
                    .fill(statusColor(status).opacity(0.15))
                    .frame(width: 36, height: 36)
                
                Image(systemName: statusIcon(status))
                    .foregroundStyle(statusColor(status))
            }
            
            // Info
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(status.dependency.rawValue)
                        .fontWeight(.medium)
                    
                    if let progress = installationProgress[status.dependency] {
                        Text("• \(progress.description)")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    }
                }
                
                Text(status.dependency.description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            // Version & Path
            VStack(alignment: .trailing, spacing: 2) {
                if let version = status.version {
                    Text("v\(version)")
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundStyle(status.meetsMinimumVersion ? .primary : .orange)
                } else {
                    Text("Not Installed")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                if let path = status.path {
                    Text(path)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
            }
            .frame(width: 150, alignment: .trailing)
            
            // Action Button
            if !status.installed {
                Button("Install") {
                    Task { await installSingle(status.dependency) }
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                .disabled(isInstalling)
            }
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(nsColor: .controlBackgroundColor))
        )
        .padding(.vertical, 2)
    }
    
    private func statusColor(_ status: DependencyStatus) -> Color {
        if status.installed && status.meetsMinimumVersion {
            return .green
        } else if status.installed {
            return .orange
        } else if status.dependency.isRequired {
            return .red
        } else {
            return .secondary
        }
    }
    
    private func statusIcon(_ status: DependencyStatus) -> String {
        if status.installed && status.meetsMinimumVersion {
            return "checkmark.circle.fill"
        } else if status.installed {
            return "exclamationmark.triangle.fill"
        } else {
            return "xmark.circle"
        }
    }
    
    // MARK: - Actions
    
    private func checkDependencies() async {
        isChecking = true
        error = nil
        
        checkResult = await dependencyManager.checkAllDependencies()
        
        isChecking = false
    }
    
    private func installMissing() async {
        isInstalling = true
        installationProgress = [:]
        
        do {
            _ = try await dependencyManager.installMissingDependencies { dep, progress in
                Task { @MainActor in
                    installationProgress[dep] = progress
                }
            }
            
            // Refresh after installation
            await checkDependencies()
        } catch {
            self.error = error.localizedDescription
        }
        
        isInstalling = false
    }
    
    private func installSingle(_ dependency: DependencyType) async {
        isInstalling = true
        
        do {
            try await dependencyManager.installDependency(dependency) { dep, progress in
                Task { @MainActor in
                    installationProgress[dep] = progress
                }
            }
            
            await checkDependencies()
        } catch {
            self.error = error.localizedDescription
        }
        
        isInstalling = false
    }
}

#Preview {
    DependencyManagerView()
}
