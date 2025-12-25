// RADIANT v4.18.0 - Packages View
// Manage deployment packages (.radpkg files)

import SwiftUI

struct PackagesView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedPackage: PackageInfo?
    @State private var isRefreshing = false
    @State private var packages: [PackageInfo] = []
    @State private var selectedChannel: ReleaseChannel = .stable
    @State private var searchText = ""
    
    var body: some View {
        HSplitView {
            packageListPanel
                .frame(minWidth: 400, maxWidth: 500)
            
            packageDetailPanel
        }
        .navigationTitle("Packages")
        .onAppear { loadPackages() }
    }
    
    private var packageListPanel: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Deployment Packages")
                    .font(.headline)
                
                Spacer()
                
                Button {
                    loadPackages()
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .buttonStyle(.borderless)
                .disabled(isRefreshing)
            }
            .padding()
            .background(.bar)
            
            Divider()
            
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                TextField("Search packages...", text: $searchText)
                    .textFieldStyle(.plain)
            }
            .padding(10)
            .background(Color(nsColor: .controlBackgroundColor))
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .padding(.horizontal)
            .padding(.top, 12)
            
            Picker("Channel", selection: $selectedChannel) {
                ForEach([ReleaseChannel.stable, .beta], id: \.self) { channel in
                    Text(channel.displayName).tag(channel)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)
            .padding(.vertical, 12)
            
            Divider()
            
            if filteredPackages.isEmpty {
                emptyStateView
            } else {
                List(filteredPackages, id: \.id, selection: $selectedPackage) { pkg in
                    PackageRow(package: pkg, isSelected: selectedPackage?.id == pkg.id)
                        .tag(pkg)
                }
                .listStyle(.plain)
            }
            
            Divider()
            
            cacheInfoBar
        }
    }
    
    private var filteredPackages: [PackageInfo] {
        packages
            .filter { $0.channel == selectedChannel }
            .filter { searchText.isEmpty || $0.version.contains(searchText) || $0.buildId.contains(searchText) }
    }
    
    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "shippingbox")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            
            Text("No Packages Found")
                .font(.headline)
            
            Text("Check your network connection or try refreshing")
                .foregroundStyle(.secondary)
            
            Button("Refresh") {
                loadPackages()
            }
            .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }
    
    private var cacheInfoBar: some View {
        HStack {
            Image(systemName: "folder")
                .foregroundStyle(.secondary)
            Text("Cache: 256 MB")
                .font(.caption)
                .foregroundStyle(.secondary)
            
            Spacer()
            
            Button("Clear Cache") {
                // Clear cache
            }
            .font(.caption)
            .buttonStyle(.borderless)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(.bar)
    }
    
    private var packageDetailPanel: some View {
        Group {
            if let pkg = selectedPackage {
                PackageDetailView(package: pkg, onDownload: { downloadPackage(pkg) })
            } else {
                VStack {
                    Image(systemName: "sidebar.right")
                        .font(.system(size: 48))
                        .foregroundStyle(.secondary)
                    Text("Select a package to view details")
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }
    
    private func loadPackages() {
        isRefreshing = true
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            packages = samplePackages
            isRefreshing = false
        }
    }
    
    private func downloadPackage(_ pkg: PackageInfo) {
        // Download package
    }
    
    private var samplePackages: [PackageInfo] {
        [
            PackageInfo(
                version: "4.18.0",
                buildId: "abc123",
                buildTimestamp: Date(),
                packageHash: "e3b0c44298fc1c149afbf4c8996fb924",
                filename: "radiant-4.18.0-abc123.radpkg",
                size: 125_000_000,
                channel: .stable,
                bucket: "radiant-releases-us-east-1",
                key: "stable/radiant-4.18.0-abc123.radpkg"
            ),
            PackageInfo(
                version: "4.17.0",
                buildId: "def456",
                buildTimestamp: Date().addingTimeInterval(-604800),
                packageHash: "7c4a8d09ca3762af61e59520943dc264",
                filename: "radiant-4.17.0-def456.radpkg",
                size: 122_000_000,
                channel: .stable,
                bucket: "radiant-releases-us-east-1",
                key: "stable/radiant-4.17.0-def456.radpkg"
            ),
            PackageInfo(
                version: "4.19.0-beta1",
                buildId: "xyz789",
                buildTimestamp: Date().addingTimeInterval(-86400),
                packageHash: "2c26b46b68ffc68ff99b453c1d304134",
                filename: "radiant-4.19.0-beta1-xyz789.radpkg",
                size: 128_000_000,
                channel: .beta,
                bucket: "radiant-releases-us-east-1",
                key: "beta/radiant-4.19.0-beta1-xyz789.radpkg"
            )
        ]
    }
}

struct PackageRow: View {
    let package: PackageInfo
    let isSelected: Bool
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "shippingbox.fill")
                .font(.title2)
                .foregroundStyle(package.channel == .stable ? .indigo : .orange)
            
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("v\(package.version)")
                        .font(.headline)
                    
                    if package.channel == .beta {
                        Text("BETA")
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.orange)
                            .foregroundColor(.white)
                            .clipShape(Capsule())
                    }
                    
                    if isLatest {
                        Text("LATEST")
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.green)
                            .foregroundColor(.white)
                            .clipShape(Capsule())
                    }
                }
                
                HStack(spacing: 8) {
                    Text(package.buildId)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    
                    Text(formatSize(package.size))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    
                    Text(package.buildTimestamp, style: .relative)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .foregroundStyle(.secondary)
                .font(.caption)
        }
        .padding(.vertical, 8)
        .contentShape(Rectangle())
    }
    
    private var isLatest: Bool {
        package.version == RADIANT_VERSION && package.channel == .stable
    }
    
    private func formatSize(_ bytes: Int64) -> String {
        let mb = Double(bytes) / 1_000_000
        return String(format: "%.0f MB", mb)
    }
}

struct PackageDetailView: View {
    let package: PackageInfo
    let onDownload: () -> Void
    @State private var isDownloading = false
    @State private var downloadProgress: Double = 0
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                headerSection
                
                Divider()
                
                actionsSection
                
                Divider()
                
                detailsSection
                
                componentsSection
                
                changelogSection
            }
            .padding(24)
        }
    }
    
    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "shippingbox.fill")
                    .font(.title)
                    .foregroundStyle(.indigo)
                
                VStack(alignment: .leading) {
                    Text("RADIANT v\(package.version)")
                        .font(.title.bold())
                    Text("Build: \(package.buildId)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                Spacer()
                
                if package.channel == .beta {
                    Text("BETA")
                        .font(.caption.bold())
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(Color.orange)
                        .foregroundColor(.white)
                        .clipShape(Capsule())
                }
            }
            
            HStack(spacing: 16) {
                Label(formatSize(package.size), systemImage: "doc.zipper")
                Label(package.buildTimestamp.formatted(), systemImage: "calendar")
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
    }
    
    private var actionsSection: some View {
        VStack(spacing: 12) {
            if isDownloading {
                VStack(spacing: 8) {
                    ProgressView(value: downloadProgress)
                    Text("Downloading... \(Int(downloadProgress * 100))%")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } else {
                HStack(spacing: 12) {
                    Button {
                        startDownload()
                    } label: {
                        Label("Download Package", systemImage: "arrow.down.circle")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    
                    Button {
                        // Use this package for deployment
                    } label: {
                        Label("Deploy", systemImage: "arrow.up.circle")
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
    }
    
    private var detailsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Details")
                .font(.headline)
            
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                DetailItem(label: "Version", value: package.version)
                DetailItem(label: "Build ID", value: package.buildId)
                DetailItem(label: "Size", value: formatSize(package.size))
                DetailItem(label: "Channel", value: package.channel.displayName)
                DetailItem(label: "Hash", value: String(package.packageHash.prefix(16)) + "...")
                DetailItem(label: "Built", value: package.buildTimestamp.formatted())
            }
        }
    }
    
    private var componentsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Components")
                .font(.headline)
            
            VStack(spacing: 8) {
                ComponentRow(name: "RADIANT Platform", version: package.version, status: .included)
                ComponentRow(name: "Think Tank", version: "3.2.0", status: .included)
                ComponentRow(name: "Admin Dashboard", version: package.version, status: .included)
                ComponentRow(name: "Lambda Functions", version: package.version, status: .included)
                ComponentRow(name: "Migrations", version: "045", status: .included)
            }
        }
    }
    
    private var changelogSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Changelog")
                .font(.headline)
            
            VStack(alignment: .leading, spacing: 8) {
                ChangelogItem(text: "Added unified deployment packages with atomic versioning")
                ChangelogItem(text: "AI Assistant with Claude integration")
                ChangelogItem(text: "Cost management with neural engine recommendations")
                ChangelogItem(text: "Compliance reports (SOC2, HIPAA, GDPR)")
                ChangelogItem(text: "Security anomaly detection dashboard")
            }
            .padding()
            .background(Color(nsColor: .controlBackgroundColor))
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }
    
    private func formatSize(_ bytes: Int64) -> String {
        let mb = Double(bytes) / 1_000_000
        return String(format: "%.0f MB", mb)
    }
    
    private func startDownload() {
        isDownloading = true
        downloadProgress = 0
        
        Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { timer in
            downloadProgress += 0.05
            if downloadProgress >= 1.0 {
                timer.invalidate()
                isDownloading = false
            }
        }
    }
}

struct ComponentRow: View {
    let name: String
    let version: String
    let status: ComponentStatus
    
    enum ComponentStatus {
        case included, updated, unchanged
    }
    
    var body: some View {
        HStack {
            Image(systemName: statusIcon)
                .foregroundStyle(statusColor)
            
            Text(name)
                .font(.subheadline)
            
            Spacer()
            
            Text("v\(version)")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(10)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }
    
    private var statusIcon: String {
        switch status {
        case .included: return "checkmark.circle.fill"
        case .updated: return "arrow.up.circle.fill"
        case .unchanged: return "minus.circle"
        }
    }
    
    private var statusColor: Color {
        switch status {
        case .included: return .green
        case .updated: return .blue
        case .unchanged: return .gray
        }
    }
}

struct ChangelogItem: View {
    let text: String
    
    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "checkmark")
                .foregroundStyle(.green)
                .font(.caption)
            Text(text)
                .font(.subheadline)
        }
    }
}

#Preview {
    PackagesView()
        .environmentObject(AppState())
        .frame(width: 1200, height: 800)
}
