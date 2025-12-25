// RADIANT v4.18.0 - Snapshots View
// Manage deployment snapshots and rollback capabilities

import SwiftUI

struct SnapshotsView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedSnapshot: DeploymentSnapshot?
    @State private var showCreateSheet = false
    @State private var showRollbackConfirmation = false
    @State private var isLoading = false
    @State private var snapshots: [DeploymentSnapshot] = []
    
    var body: some View {
        HSplitView {
            snapshotListPanel
                .frame(minWidth: 400, maxWidth: 500)
            
            snapshotDetailPanel
        }
        .navigationTitle("Snapshots")
        .onAppear { loadSnapshots() }
        .sheet(isPresented: $showCreateSheet) {
            CreateSnapshotSheet(onCreate: { loadSnapshots() })
                .environmentObject(appState)
        }
        .confirmationDialog(
            "Rollback to Snapshot?",
            isPresented: $showRollbackConfirmation,
            titleVisibility: .visible
        ) {
            Button("Rollback", role: .destructive) {
                performRollback()
            }
            Button("Cancel", role: .cancel) { }
        } message: {
            if let snapshot = selectedSnapshot {
                Text("This will restore \(snapshot.appId) to v\(snapshot.version). A safety snapshot will be created first.")
            }
        }
    }
    
    private var snapshotListPanel: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Snapshots")
                    .font(.headline)
                
                Spacer()
                
                Button {
                    showCreateSheet = true
                } label: {
                    Image(systemName: "plus")
                }
                .buttonStyle(.borderless)
                
                Button {
                    loadSnapshots()
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .buttonStyle(.borderless)
                .disabled(isLoading)
            }
            .padding()
            .background(.bar)
            
            Divider()
            
            if snapshots.isEmpty {
                emptyStateView
            } else {
                List(snapshots, selection: $selectedSnapshot) { snapshot in
                    SnapshotRow(snapshot: snapshot, isSelected: selectedSnapshot?.id == snapshot.id)
                        .tag(snapshot)
                }
                .listStyle(.plain)
            }
        }
    }
    
    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "clock.arrow.circlepath")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            
            Text("No Snapshots")
                .font(.headline)
            
            Text("Snapshots are created automatically before updates. You can also create manual snapshots.")
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            
            Button("Create Snapshot") {
                showCreateSheet = true
            }
            .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }
    
    private var snapshotDetailPanel: some View {
        Group {
            if let snapshot = selectedSnapshot {
                SnapshotDetailView(
                    snapshot: snapshot,
                    onRollback: { showRollbackConfirmation = true },
                    onDelete: { deleteSnapshot(snapshot) }
                )
            } else {
                VStack {
                    Image(systemName: "sidebar.right")
                        .font(.system(size: 48))
                        .foregroundStyle(.secondary)
                    Text("Select a snapshot to view details")
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }
    
    private func loadSnapshots() {
        isLoading = true
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            snapshots = sampleSnapshots
            isLoading = false
        }
    }
    
    private func performRollback() {
        guard selectedSnapshot != nil else { return }
        appState.selectedTab = .deploy
    }
    
    private func deleteSnapshot(_ snapshot: DeploymentSnapshot) {
        snapshots.removeAll { $0.id == snapshot.id }
        selectedSnapshot = nil
    }
    
    private var sampleSnapshots: [DeploymentSnapshot] {
        [
            DeploymentSnapshot(
                id: "snapshot-2024-12-24T10-30-00Z",
                appId: "thinktank",
                environment: "dev",
                version: "4.17.0",
                packageHash: "abc123def456",
                parameters: InstanceParameters.defaults(tier: .seed),
                createdAt: Date().addingTimeInterval(-86400),
                reason: .preUpdate,
                databaseSnapshotId: "rds-snap-123",
                includesDatabaseRollback: true
            ),
            DeploymentSnapshot(
                id: "snapshot-2024-12-20T15-00-00Z",
                appId: "thinktank",
                environment: "staging",
                version: "4.16.0",
                packageHash: "xyz789ghi012",
                parameters: InstanceParameters.defaults(tier: .starter),
                createdAt: Date().addingTimeInterval(-432000),
                reason: .manual,
                databaseSnapshotId: nil,
                includesDatabaseRollback: false
            )
        ]
    }
}

struct SnapshotRow: View {
    let snapshot: DeploymentSnapshot
    let isSelected: Bool
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: reasonIcon)
                .foregroundStyle(reasonColor)
                .frame(width: 32, height: 32)
                .background(reasonColor.opacity(0.1))
                .clipShape(Circle())
            
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(snapshot.appId.capitalized)
                        .font(.headline)
                    
                    Text(snapshot.environment.uppercased())
                        .font(.caption)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.blue.opacity(0.2))
                        .clipShape(Capsule())
                }
                
                HStack(spacing: 8) {
                    Text("v\(snapshot.version)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    
                    Text(snapshot.createdAt, style: .relative)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            
            Spacer()
            
            if snapshot.includesDatabaseRollback {
                Image(systemName: "cylinder.split.1x2")
                    .font(.caption)
                    .foregroundStyle(.blue)
                    .help("Includes database snapshot")
            }
        }
        .padding(.vertical, 8)
        .contentShape(Rectangle())
    }
    
    private var reasonIcon: String {
        switch snapshot.reason {
        case .preUpdate: return "arrow.up.circle"
        case .preRollback: return "arrow.uturn.backward"
        case .manual: return "hand.tap"
        case .scheduled: return "calendar"
        }
    }
    
    private var reasonColor: Color {
        switch snapshot.reason {
        case .preUpdate: return .blue
        case .preRollback: return .orange
        case .manual: return .purple
        case .scheduled: return .green
        }
    }
}

struct SnapshotDetailView: View {
    let snapshot: DeploymentSnapshot
    let onRollback: () -> Void
    let onDelete: () -> Void
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                headerSection
                
                Divider()
                
                actionsSection
                
                Divider()
                
                detailsSection
                
                parametersSection
            }
            .padding(24)
        }
    }
    
    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "clock.arrow.circlepath")
                    .font(.title)
                    .foregroundStyle(.cyan)
                
                VStack(alignment: .leading) {
                    Text("Snapshot")
                        .font(.title.bold())
                    Text(snapshot.id)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            
            HStack(spacing: 16) {
                Label(snapshot.appId.capitalized, systemImage: "app.badge")
                Label(snapshot.environment.uppercased(), systemImage: "server.rack")
                Label("v\(snapshot.version)", systemImage: "tag")
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
    }
    
    private var actionsSection: some View {
        HStack(spacing: 12) {
            Button {
                onRollback()
            } label: {
                Label("Rollback to This Snapshot", systemImage: "arrow.uturn.backward")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(.orange)
            
            Button(role: .destructive) {
                onDelete()
            } label: {
                Label("Delete", systemImage: "trash")
            }
            .buttonStyle(.bordered)
        }
    }
    
    private var detailsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Details")
                .font(.headline)
            
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                DetailItem(label: "Created", value: snapshot.createdAt.formatted())
                DetailItem(label: "Reason", value: snapshot.reason.rawValue.replacingOccurrences(of: "_", with: " ").capitalized)
                DetailItem(label: "Package Hash", value: String(snapshot.packageHash.prefix(12)) + "...")
                DetailItem(label: "Database Snapshot", value: snapshot.databaseSnapshotId ?? "None")
            }
        }
    }
    
    private var parametersSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Parameters")
                .font(.headline)
            
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                DetailItem(label: "Tier", value: snapshot.parameters.tier.displayName)
                DetailItem(label: "Region", value: snapshot.parameters.region.displayName)
                DetailItem(label: "Multi-AZ", value: snapshot.parameters.multiAz ? "Enabled" : "Disabled")
                DetailItem(label: "Self-Hosted Models", value: snapshot.parameters.enableSelfHostedModels ? "Enabled" : "Disabled")
            }
        }
    }
}

struct CreateSnapshotSheet: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var appState: AppState
    @State private var selectedApp: ManagedApp?
    @State private var selectedEnvironment: DeployEnvironment = .dev
    @State private var includeDatabase = true
    @State private var isCreating = false
    
    let onCreate: () -> Void
    
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Create Snapshot")
                    .font(.headline)
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
            .padding()
            .background(.bar)
            
            Divider()
            
            Form {
                Section("Target") {
                    Picker("Application", selection: $selectedApp) {
                        Text("Select App").tag(nil as ManagedApp?)
                        ForEach(appState.apps) { app in
                            Text(app.name).tag(app as ManagedApp?)
                        }
                    }
                    
                    Picker("Environment", selection: $selectedEnvironment) {
                        ForEach(DeployEnvironment.allCases) { env in
                            Text(env.rawValue).tag(env)
                        }
                    }
                }
                
                Section("Options") {
                    Toggle("Include Database Snapshot", isOn: $includeDatabase)
                    
                    if includeDatabase {
                        Text("This will create an RDS snapshot which may take several minutes")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .formStyle(.grouped)
            
            Divider()
            
            HStack {
                Button("Cancel") { dismiss() }
                    .buttonStyle(.bordered)
                
                Spacer()
                
                Button {
                    createSnapshot()
                } label: {
                    if isCreating {
                        ProgressView()
                            .controlSize(.small)
                    } else {
                        Text("Create Snapshot")
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(selectedApp == nil || isCreating)
            }
            .padding()
        }
        .frame(width: 450, height: 400)
    }
    
    private func createSnapshot() {
        isCreating = true
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            isCreating = false
            onCreate()
            dismiss()
        }
    }
}

#Preview {
    SnapshotsView()
        .environmentObject(AppState())
        .frame(width: 1200, height: 800)
}
