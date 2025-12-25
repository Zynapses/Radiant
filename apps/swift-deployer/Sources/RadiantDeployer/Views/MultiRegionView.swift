// RADIANT v4.18.0 - Multi-Region View
// Configure and manage multi-region deployments

import SwiftUI

struct RegionConfig: Identifiable, Hashable {
    let id: String
    var region: AWSRegion
    var isPrimary: Bool
    var isEnabled: Bool
    var replicationType: ReplicationType
    var status: RegionStatus
    var latency: Int?
    var lastSyncedAt: Date?
    
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
    static func == (lhs: RegionConfig, rhs: RegionConfig) -> Bool { lhs.id == rhs.id }
}

enum ReplicationType: String, CaseIterable {
    case active = "Active-Active"
    case passive = "Active-Passive"
    case readonly = "Read-Only"
}

enum RegionStatus: String {
    case healthy = "Healthy"
    case syncing = "Syncing"
    case degraded = "Degraded"
    case offline = "Offline"
    
    var color: Color {
        switch self {
        case .healthy: return .green
        case .syncing: return .blue
        case .degraded: return .orange
        case .offline: return .red
        }
    }
}

struct MultiRegionView: View {
    @EnvironmentObject var appState: AppState
    @State private var regions: [RegionConfig] = []
    @State private var selectedRegion: RegionConfig?
    @State private var showAddRegion = false
    @State private var isLoading = true
    @State private var globalReplicationEnabled = true
    
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                headerSection
                globalSettingsSection
                regionsMapSection
                regionsListSection
                replicationStatusSection
            }
            .padding(24)
        }
        .background(Color(nsColor: .windowBackgroundColor))
        .onAppear { loadRegions() }
        .sheet(isPresented: $showAddRegion) {
            AddRegionSheet(existingRegions: regions, onAdd: { loadRegions() })
        }
    }
    
    private var headerSection: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Multi-Region Configuration")
                    .font(.largeTitle.bold())
                Text("Configure global deployment across AWS regions")
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            Button { showAddRegion = true } label: {
                Label("Add Region", systemImage: "plus")
            }
            .buttonStyle(.borderedProminent)
        }
    }
    
    private var globalSettingsSection: some View {
        HStack(spacing: 16) {
            SettingCard(title: "Global Replication", value: globalReplicationEnabled ? "Enabled" : "Disabled", icon: "globe", color: .blue) {
                Toggle("", isOn: $globalReplicationEnabled).labelsHidden()
            }
            
            SettingCard(title: "Primary Region", value: primaryRegion?.region.displayName ?? "Not Set", icon: "star.fill", color: .yellow) {
                EmptyView()
            }
            
            SettingCard(title: "Active Regions", value: "\(activeRegionCount)/\(regions.count)", icon: "server.rack", color: .green) {
                EmptyView()
            }
            
            SettingCard(title: "Avg Latency", value: "\(averageLatency)ms", icon: "speedometer", color: .orange) {
                EmptyView()
            }
        }
    }
    
    private var regionsMapSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Region Overview")
                .font(.headline)
            
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color(nsColor: .controlBackgroundColor))
                    .frame(height: 200)
                
                HStack(spacing: 40) {
                    ForEach(regions) { region in
                        VStack(spacing: 8) {
                            ZStack {
                                Circle()
                                    .fill(region.status.color.opacity(0.2))
                                    .frame(width: 60, height: 60)
                                
                                Circle()
                                    .fill(region.status.color)
                                    .frame(width: 40, height: 40)
                                
                                if region.isPrimary {
                                    Image(systemName: "star.fill")
                                        .foregroundStyle(.white)
                                }
                            }
                            
                            Text(region.region.shortName)
                                .font(.caption.weight(.medium))
                            
                            Text(region.status.rawValue)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .padding(20)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
    
    private var regionsListSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Configured Regions")
                .font(.headline)
            
            VStack(spacing: 8) {
                ForEach(regions) { region in
                    RegionRow(region: region, onEdit: { selectedRegion = region }, onDelete: { deleteRegion(region) })
                }
            }
        }
        .padding(20)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
    
    private var replicationStatusSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Replication Status")
                .font(.headline)
            
            if let primary = primaryRegion {
                VStack(spacing: 12) {
                    ForEach(regions.filter { !$0.isPrimary }) { region in
                        ReplicationRow(from: primary.region, to: region.region, status: region.status, lastSync: region.lastSyncedAt)
                    }
                }
            } else {
                Text("Set a primary region to enable replication")
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 20)
            }
        }
        .padding(20)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
    
    private var primaryRegion: RegionConfig? { regions.first { $0.isPrimary } }
    private var activeRegionCount: Int { regions.filter { $0.isEnabled }.count }
    private var averageLatency: Int {
        let latencies = regions.compactMap { $0.latency }
        return latencies.isEmpty ? 0 : latencies.reduce(0, +) / latencies.count
    }
    
    private func loadRegions() {
        isLoading = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            regions = [
                RegionConfig(id: "1", region: .usEast1, isPrimary: true, isEnabled: true, replicationType: .active, status: .healthy, latency: 45, lastSyncedAt: Date()),
                RegionConfig(id: "2", region: .usWest2, isPrimary: false, isEnabled: true, replicationType: .active, status: .healthy, latency: 78, lastSyncedAt: Date().addingTimeInterval(-60)),
                RegionConfig(id: "3", region: .euWest1, isPrimary: false, isEnabled: true, replicationType: .passive, status: .syncing, latency: 120, lastSyncedAt: Date().addingTimeInterval(-300))
            ]
            isLoading = false
        }
    }
    
    private func deleteRegion(_ region: RegionConfig) {
        regions.removeAll { $0.id == region.id }
    }
}

struct SettingCard<Trailing: View>: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    @ViewBuilder let trailing: Trailing
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: icon).foregroundStyle(color)
                Spacer()
                trailing
            }
            Text(value).font(.title2.bold())
            Text(title).font(.caption).foregroundStyle(.secondary)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

struct RegionRow: View {
    let region: RegionConfig
    let onEdit: () -> Void
    let onDelete: () -> Void
    
    var body: some View {
        HStack(spacing: 16) {
            Circle().fill(region.status.color).frame(width: 10, height: 10)
            
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(region.region.displayName).font(.headline)
                    if region.isPrimary {
                        Text("PRIMARY").font(.caption2).padding(.horizontal, 6).padding(.vertical, 2)
                            .background(Color.yellow).foregroundStyle(.black).clipShape(Capsule())
                    }
                }
                Text(region.replicationType.rawValue).font(.caption).foregroundStyle(.secondary)
            }
            
            Spacer()
            
            if let latency = region.latency {
                Text("\(latency)ms").font(.subheadline.monospacedDigit()).foregroundStyle(.secondary)
            }
            
            Toggle("", isOn: .constant(region.isEnabled)).labelsHidden()
            
            Button { onEdit() } label: { Image(systemName: "pencil") }.buttonStyle(.borderless)
            
            Button { onDelete() } label: { Image(systemName: "trash").foregroundStyle(.red) }
                .buttonStyle(.borderless)
                .disabled(region.isPrimary)
        }
        .padding(12)
        .background(Color(nsColor: .windowBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct ReplicationRow: View {
    let from: AWSRegion
    let to: AWSRegion
    let status: RegionStatus
    let lastSync: Date?
    
    var body: some View {
        HStack(spacing: 12) {
            Text(from.shortName).font(.subheadline.weight(.medium))
            Image(systemName: "arrow.right").foregroundStyle(.secondary)
            Text(to.shortName).font(.subheadline.weight(.medium))
            
            Spacer()
            
            if status == .syncing {
                ProgressView().controlSize(.small)
            }
            
            Circle().fill(status.color).frame(width: 8, height: 8)
            Text(status.rawValue).font(.caption).foregroundStyle(.secondary)
            
            if let sync = lastSync {
                Text(sync, style: .relative).font(.caption).foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .background(Color(nsColor: .windowBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct AddRegionSheet: View {
    @Environment(\.dismiss) var dismiss
    let existingRegions: [RegionConfig]
    let onAdd: () -> Void
    
    @State private var selectedRegion: AWSRegion = .usEast1
    @State private var replicationType: ReplicationType = .passive
    @State private var isPrimary = false
    
    var availableRegions: [AWSRegion] {
        AWSRegion.allCases.filter { region in
            !existingRegions.contains { $0.region == region }
        }
    }
    
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Add Region").font(.headline)
                Spacer()
                Button { dismiss() } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary) }
                    .buttonStyle(.plain)
            }
            .padding()
            .background(.bar)
            
            Divider()
            
            Form {
                Section("Region") {
                    Picker("AWS Region", selection: $selectedRegion) {
                        ForEach(availableRegions, id: \.self) { region in
                            Text(region.displayName).tag(region)
                        }
                    }
                }
                
                Section("Configuration") {
                    Picker("Replication Type", selection: $replicationType) {
                        ForEach(ReplicationType.allCases, id: \.self) { type in
                            Text(type.rawValue).tag(type)
                        }
                    }
                    
                    if existingRegions.isEmpty || !existingRegions.contains(where: { $0.isPrimary }) {
                        Toggle("Set as Primary Region", isOn: $isPrimary)
                    }
                }
            }
            .formStyle(.grouped)
            
            Divider()
            
            HStack {
                Button("Cancel") { dismiss() }.buttonStyle(.bordered)
                Spacer()
                Button("Add Region") { onAdd(); dismiss() }
                    .buttonStyle(.borderedProminent)
                    .disabled(availableRegions.isEmpty)
            }
            .padding()
        }
        .frame(width: 450, height: 380)
        .onAppear {
            if let first = availableRegions.first { selectedRegion = first }
        }
    }
}

#Preview {
    MultiRegionView()
        .environmentObject(AppState())
        .frame(width: 1200, height: 900)
}
