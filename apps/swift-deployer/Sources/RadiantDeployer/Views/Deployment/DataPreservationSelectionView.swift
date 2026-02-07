import SwiftUI

/// View for selecting which data to preserve during deployment updates
struct DataPreservationSelectionView: View {
    @Binding var config: SnapshotService.DataPreservationConfig
    @State private var availableBuckets: [String] = []
    @State private var isLoadingBuckets = false
    @State private var showAdvancedOptions = false
    
    let appId: String
    let environment: String
    let credentials: CredentialSet?
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack {
                Image(systemName: "externaldrive.badge.checkmark")
                    .font(.title2)
                    .foregroundColor(.blue)
                Text("Data Preservation")
                    .font(.headline)
                Spacer()
                
                // Quick presets
                Menu {
                    Button("Preserve All Data") {
                        config = .preserveAll
                    }
                    Button("Preserve None") {
                        config = .preserveNone
                    }
                    Divider()
                    Button("Database Only") {
                        config = SnapshotService.DataPreservationConfig(
                            preserveAurora: true,
                            preserveDynamoDB: true,
                            preserveS3Buckets: [],
                            downloadS3ToLocal: false
                        )
                    }
                } label: {
                    Label("Presets", systemImage: "slider.horizontal.3")
                        .font(.caption)
                }
                .menuStyle(.borderlessButton)
            }
            
            Text("Select which data sources to snapshot before updating. This creates a restore point in case of issues.")
                .font(.caption)
                .foregroundColor(.secondary)
            
            Divider()
            
            // Aurora PostgreSQL
            Toggle(isOn: $config.preserveAurora) {
                HStack {
                    Image(systemName: "cylinder.split.1x2")
                        .foregroundColor(.orange)
                        .frame(width: 24)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Aurora PostgreSQL")
                            .font(.subheadline)
                        Text("Creates an RDS cluster snapshot (~5-30 minutes)")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }
            .toggleStyle(.checkbox)
            
            // DynamoDB
            Toggle(isOn: $config.preserveDynamoDB) {
                HStack {
                    Image(systemName: "tablecells")
                        .foregroundColor(.purple)
                        .frame(width: 24)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("DynamoDB Tables")
                            .font(.subheadline)
                        Text("Creates on-demand backups (instant)")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }
            .toggleStyle(.checkbox)
            
            Divider()
            
            // S3 Options
            DisclosureGroup(isExpanded: $showAdvancedOptions) {
                VStack(alignment: .leading, spacing: 12) {
                    // Download S3 to local
                    Toggle(isOn: $config.downloadS3ToLocal) {
                        HStack {
                            Image(systemName: "arrow.down.circle")
                                .foregroundColor(.green)
                                .frame(width: 24)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Download S3 to Local")
                                    .font(.subheadline)
                                Text("Downloads bucket contents to your Mac for offline backup")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    .toggleStyle(.checkbox)
                    
                    if config.downloadS3ToLocal {
                        // Local path selector
                        HStack {
                            Text("Backup Location:")
                                .font(.caption)
                            TextField("~/RadiantBackups", text: Binding(
                                get: { config.localS3BackupPath ?? "" },
                                set: { config.localS3BackupPath = $0.isEmpty ? nil : $0 }
                            ))
                            .textFieldStyle(.roundedBorder)
                            .font(.caption)
                            
                            Button(action: selectBackupFolder) {
                                Image(systemName: "folder")
                            }
                            .buttonStyle(.borderless)
                        }
                        .padding(.leading, 28)
                    }
                    
                    // Bucket selection
                    if isLoadingBuckets {
                        HStack {
                            ProgressView()
                                .scaleEffect(0.7)
                            Text("Loading S3 buckets...")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        .padding(.leading, 28)
                    } else if !availableBuckets.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Select buckets to include:")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            
                            ForEach(availableBuckets, id: \.self) { bucket in
                                Toggle(isOn: Binding(
                                    get: { config.preserveS3Buckets.contains(bucket) },
                                    set: { isSelected in
                                        if isSelected {
                                            if !config.preserveS3Buckets.contains(bucket) {
                                                config.preserveS3Buckets.append(bucket)
                                            }
                                        } else {
                                            config.preserveS3Buckets.removeAll { $0 == bucket }
                                        }
                                    }
                                )) {
                                    HStack {
                                        Image(systemName: "folder.fill")
                                            .foregroundColor(.yellow)
                                            .font(.caption)
                                        Text(bucket)
                                            .font(.caption)
                                    }
                                }
                                .toggleStyle(.checkbox)
                            }
                        }
                        .padding(.leading, 28)
                    }
                }
                .padding(.top, 8)
            } label: {
                HStack {
                    Image(systemName: "externaldrive")
                        .foregroundColor(.blue)
                        .frame(width: 24)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("S3 Buckets")
                            .font(.subheadline)
                        Text("Optional local backup of S3 data")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }
            
            Divider()
            
            // Summary
            summaryView
        }
        .padding()
        .background(Color(.controlBackgroundColor))
        .cornerRadius(8)
        .onAppear {
            loadAvailableBuckets()
        }
    }
    
    private var summaryView: some View {
        HStack {
            Image(systemName: "info.circle")
                .foregroundColor(.blue)
            
            VStack(alignment: .leading, spacing: 2) {
                Text("Snapshot Summary")
                    .font(.caption)
                    .fontWeight(.medium)
                
                let items = buildSummaryItems()
                if items.isEmpty {
                    Text("No data will be preserved")
                        .font(.caption2)
                        .foregroundColor(.orange)
                } else {
                    Text(items.joined(separator: " • "))
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()
            
            if !buildSummaryItems().isEmpty {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.green)
            } else {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundColor(.orange)
            }
        }
        .padding(8)
        .background(Color(.textBackgroundColor).opacity(0.5))
        .cornerRadius(6)
    }
    
    private func buildSummaryItems() -> [String] {
        var items: [String] = []
        if config.preserveAurora {
            items.append("Aurora")
        }
        if config.preserveDynamoDB {
            items.append("DynamoDB")
        }
        if config.downloadS3ToLocal && !config.preserveS3Buckets.isEmpty {
            items.append("\(config.preserveS3Buckets.count) S3 bucket(s)")
        }
        return items
    }
    
    private func loadAvailableBuckets() {
        guard let credentials = credentials else { return }
        
        isLoadingBuckets = true
        
        Task {
            do {
                let buckets = try await listS3Buckets(credentials: credentials)
                await MainActor.run {
                    self.availableBuckets = buckets
                    self.isLoadingBuckets = false
                }
            } catch {
                await MainActor.run {
                    self.isLoadingBuckets = false
                }
            }
        }
    }
    
    private func listS3Buckets(credentials: CredentialSet) async throws -> [String] {
        let awsCliPath = findAwsCliPath()
        
        let process = Process()
        process.executableURL = URL(fileURLWithPath: awsCliPath)
        process.arguments = ["s3api", "list-buckets", "--output", "json"]
        
        var env = ProcessInfo.processInfo.environment
        env["AWS_ACCESS_KEY_ID"] = credentials.accessKeyId
        env["AWS_SECRET_ACCESS_KEY"] = credentials.secretAccessKey
        env["AWS_DEFAULT_REGION"] = credentials.region
        process.environment = env
        
        let outputPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = Pipe()
        
        try process.run()
        process.waitUntilExit()
        
        let data = outputPipe.fileHandleForReading.readDataToEndOfFile()
        
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let buckets = json["Buckets"] as? [[String: Any]] else {
            return []
        }
        
        let prefix = "radiant-\(appId)-\(environment.lowercased())"
        
        return buckets.compactMap { bucket -> String? in
            guard let name = bucket["Name"] as? String, name.hasPrefix(prefix) else {
                return nil
            }
            return name
        }
    }
    
    private func findAwsCliPath() -> String {
        let paths = ["/opt/homebrew/bin/aws", "/usr/local/bin/aws", "/usr/bin/aws"]
        for path in paths {
            if FileManager.default.fileExists(atPath: path) {
                return path
            }
        }
        return "/usr/local/bin/aws"
    }
    
    private func selectBackupFolder() {
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        panel.prompt = "Select Backup Folder"
        
        if panel.runModal() == .OK, let url = panel.url {
            config.localS3BackupPath = url.path
        }
    }
}

#Preview {
    DataPreservationSelectionView(
        config: .constant(.preserveAll),
        appId: "test-app",
        environment: "Production",
        credentials: nil
    )
    .frame(width: 400)
    .padding()
}
