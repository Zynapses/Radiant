// RADIANT v7.1.0 - Code Sync View
// UI for syncing local code changes to AWS instances

import SwiftUI

struct CodeSyncView: View {
    @State private var changedFiles: [ChangedFile] = []
    @State private var isAnalyzing = false
    @State private var isSyncing = false
    @State private var syncProgress: CodeSyncProgress = .analyzing
    @State private var syncResult: CodeSyncResult?
    @State private var selectedEnvironment: DeployEnvironment = .dev
    @State private var selectedFiles: Set<String> = []
    @State private var lastSyncTime: Date?
    @State private var error: String?
    
    private let scriptRunner = BashScriptRunnerService.shared
    private let projectPath: String
    
    init(projectPath: String = FileManager.default.currentDirectoryPath) {
        self.projectPath = projectPath
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            headerView
            
            Divider()
            
            // Content
            if isAnalyzing {
                analyzingView
            } else if changedFiles.isEmpty {
                noChangesView
            } else {
                changedFilesView
            }
            
            Divider()
            
            // Footer with actions
            footerView
        }
        .frame(minWidth: 600, minHeight: 400)
        .task {
            await analyzeChanges()
        }
    }
    
    // MARK: - Header
    
    private var headerView: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Code Sync")
                    .font(.title2)
                    .fontWeight(.semibold)
                
                HStack(spacing: 8) {
                    Text("Sync local changes to AWS")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    
                    if let lastSync = lastSyncTime {
                        Text("•")
                            .foregroundStyle(.tertiary)
                        Text("Last sync: \(lastSync.formatted(date: .abbreviated, time: .shortened))")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                }
            }
            
            Spacer()
            
            HStack(spacing: 12) {
                Picker("Environment", selection: $selectedEnvironment) {
                    ForEach(DeployEnvironment.allCases, id: \.self) { env in
                        Text(env.displayName).tag(env)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 180)
                
                Button(action: { Task { await analyzeChanges() } }) {
                    Label("Refresh", systemImage: "arrow.clockwise")
                }
                .disabled(isAnalyzing || isSyncing)
            }
        }
        .padding()
    }
    
    // MARK: - Analyzing View
    
    private var analyzingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.5)
            Text("Analyzing changes...")
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    // MARK: - No Changes View
    
    private var noChangesView: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.circle")
                .font(.system(size: 48))
                .foregroundStyle(.green)
            
            Text("All synced!")
                .font(.headline)
            
            Text("No local changes detected")
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    // MARK: - Changed Files View
    
    private var changedFilesView: some View {
        VStack(spacing: 0) {
            // Summary bar
            HStack {
                HStack(spacing: 16) {
                    changeSummaryBadge(type: .added, count: changedFiles.filter { $0.changeType == .added }.count)
                    changeSummaryBadge(type: .modified, count: changedFiles.filter { $0.changeType == .modified }.count)
                    changeSummaryBadge(type: .deleted, count: changedFiles.filter { $0.changeType == .deleted }.count)
                }
                
                Spacer()
                
                Button(action: selectAll) {
                    Text(selectedFiles.count == changedFiles.count ? "Deselect All" : "Select All")
                }
                .buttonStyle(.borderless)
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
            .background(Color(nsColor: .controlBackgroundColor))
            
            // File list
            List(changedFiles, id: \.path, selection: $selectedFiles) { file in
                changedFileRow(file)
            }
            .listStyle(.inset)
        }
    }
    
    private func changeSummaryBadge(type: ChangeType, count: Int) -> some View {
        HStack(spacing: 4) {
            Circle()
                .fill(changeTypeColor(type))
                .frame(width: 8, height: 8)
            
            Text("\(count) \(type.rawValue)")
                .font(.caption)
        }
    }
    
    private func changedFileRow(_ file: ChangedFile) -> some View {
        HStack(spacing: 12) {
            // Change type indicator
            Image(systemName: changeTypeIcon(file.changeType))
                .foregroundStyle(changeTypeColor(file.changeType))
                .frame(width: 20)
            
            // File info
            VStack(alignment: .leading, spacing: 2) {
                Text(file.path)
                    .font(.system(.body, design: .monospaced))
                    .lineLimit(1)
                
                HStack(spacing: 8) {
                    Text(file.changeType.rawValue)
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(changeTypeColor(file.changeType).opacity(0.15))
                        .clipShape(Capsule())
                    
                    if file.size > 0 {
                        Text(formatFileSize(file.size))
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                }
            }
            
            Spacer()
        }
        .padding(.vertical, 4)
    }
    
    private func changeTypeIcon(_ type: ChangeType) -> String {
        switch type {
        case .added: return "plus.circle.fill"
        case .modified: return "pencil.circle.fill"
        case .deleted: return "minus.circle.fill"
        case .renamed: return "arrow.right.circle.fill"
        }
    }
    
    private func changeTypeColor(_ type: ChangeType) -> Color {
        switch type {
        case .added: return .green
        case .modified: return .orange
        case .deleted: return .red
        case .renamed: return .blue
        }
    }
    
    private func formatFileSize(_ bytes: Int) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: Int64(bytes))
    }
    
    // MARK: - Footer
    
    private var footerView: some View {
        HStack {
            // Sync progress
            if isSyncing {
                HStack(spacing: 8) {
                    ProgressView()
                        .scaleEffect(0.7)
                    
                    Text(progressDescription)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } else if let result = syncResult {
                HStack(spacing: 8) {
                    Image(systemName: result.success ? "checkmark.circle.fill" : "xmark.circle.fill")
                        .foregroundStyle(result.success ? .green : .red)
                    
                    Text(result.success 
                        ? "Synced \(result.filesUploaded) files (\(formatFileSize(result.bytesTransferred)))"
                        : "Sync failed")
                        .font(.caption)
                }
            } else if let error = error {
                HStack(spacing: 8) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.orange)
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            
            Spacer()
            
            // Selected count
            if !changedFiles.isEmpty {
                Text("\(selectedFiles.count) of \(changedFiles.count) selected")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            // Sync button
            Button(action: { Task { await syncChanges() } }) {
                Label(isSyncing ? "Syncing..." : "Sync to \(selectedEnvironment.displayName)", systemImage: "arrow.up.circle.fill")
            }
            .buttonStyle(.borderedProminent)
            .disabled(isSyncing || selectedFiles.isEmpty)
        }
        .padding()
    }
    
    private var progressDescription: String {
        switch syncProgress {
        case .analyzing: return "Analyzing..."
        case .noChanges: return "No changes"
        case .preparingUpload(let count): return "Preparing \(count) files..."
        case .uploading(let current, let total): return "Uploading \(current)/\(total)..."
        case .triggering: return "Triggering sync..."
        case .verifying: return "Verifying..."
        case .completed: return "Completed"
        case .failed(let msg): return "Failed: \(msg)"
        }
    }
    
    // MARK: - Actions
    
    private func analyzeChanges() async {
        isAnalyzing = true
        error = nil
        
        // Use git to find changed files
        let result = await runGitStatus()
        changedFiles = result
        selectedFiles = Set(result.map { $0.path })
        
        isAnalyzing = false
    }
    
    private func runGitStatus() async -> [ChangedFile] {
        await withCheckedContinuation { continuation in
            let task = Process()
            let pipe = Pipe()
            
            task.standardOutput = pipe
            task.standardError = pipe
            task.executableURL = URL(fileURLWithPath: "/usr/bin/git")
            task.arguments = ["status", "--porcelain"]
            task.currentDirectoryURL = URL(fileURLWithPath: projectPath)
            
            do {
                try task.run()
                task.waitUntilExit()
                
                let data = pipe.fileHandleForReading.readDataToEndOfFile()
                let output = String(data: data, encoding: .utf8) ?? ""
                
                var files: [ChangedFile] = []
                let lines = output.components(separatedBy: "\n")
                
                for line in lines where !line.isEmpty {
                    let status = String(line.prefix(2)).trimmingCharacters(in: .whitespaces)
                    let path = String(line.dropFirst(3))
                    
                    let changeType: ChangeType
                    switch status {
                    case "M", "MM": changeType = .modified
                    case "A", "??": changeType = .added
                    case "D": changeType = .deleted
                    case "R": changeType = .renamed
                    default: changeType = .modified
                    }
                    
                    let fullPath = (projectPath as NSString).appendingPathComponent(path)
                    let fileSize = (try? FileManager.default.attributesOfItem(atPath: fullPath)[.size] as? Int) ?? 0
                    
                    files.append(ChangedFile(
                        path: path,
                        fullPath: fullPath,
                        changeType: changeType,
                        size: fileSize
                    ))
                }
                
                continuation.resume(returning: files)
            } catch {
                continuation.resume(returning: [])
            }
        }
    }
    
    private func selectAll() {
        if selectedFiles.count == changedFiles.count {
            selectedFiles = []
        } else {
            selectedFiles = Set(changedFiles.map { $0.path })
        }
    }
    
    private func syncChanges() async {
        isSyncing = true
        syncResult = nil
        error = nil
        
        // For now, we'll run the deploy script
        // In a full implementation, this would use the CodeSync functionality
        do {
            // Create a mock credential for demo purposes
            // In real usage, this would come from the app's credential store
            let credential = CredentialSet(
                id: UUID().uuidString,
                name: "Default",
                accessKeyId: "",
                secretAccessKey: "",
                region: "us-east-1"
            )
            
            syncResult = try await scriptRunner.syncCodeToAWS(
                projectPath: projectPath,
                environment: selectedEnvironment,
                credential: credential
            ) { progress in
                Task { @MainActor in
                    syncProgress = progress
                }
            }
            
            if syncResult?.success == true {
                lastSyncTime = Date()
                await analyzeChanges()
            }
        } catch {
            self.error = error.localizedDescription
        }
        
        isSyncing = false
    }
}

#Preview {
    CodeSyncView(projectPath: "/Users/robertlong/CascadeProjects/Radiant")
}
