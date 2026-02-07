// RADIANT v7.1.0 - Deployment Scripts View
// UI for discovering, managing, and executing deployment bash scripts

import SwiftUI

struct DeploymentScriptsView: View {
    @State private var scripts: [DeploymentScript] = []
    @State private var selectedScript: DeploymentScript?
    @State private var isDiscovering = false
    @State private var isExecuting = false
    @State private var executionOutput: [String] = []
    @State private var selectedCategory: ScriptCategory?
    @State private var searchText = ""
    @State private var showDependencyManager = false
    @State private var executionResult: ScriptExecutionResult?
    @State private var scriptArguments: [String: String] = [:]
    @State private var selectedEnvironment: DeployEnvironment = .dev
    
    private let scriptRunner = BashScriptRunnerService.shared
    private let projectPath: String
    
    init(projectPath: String = FileManager.default.currentDirectoryPath) {
        self.projectPath = projectPath
    }
    
    var filteredScripts: [DeploymentScript] {
        scripts.filter { script in
            let matchesCategory = selectedCategory == nil || script.category == selectedCategory
            let matchesSearch = searchText.isEmpty || 
                script.name.localizedCaseInsensitiveContains(searchText) ||
                script.description.localizedCaseInsensitiveContains(searchText)
            return matchesCategory && matchesSearch
        }
    }
    
    var body: some View {
        HSplitView {
            // Script List
            scriptListView
                .frame(minWidth: 300, maxWidth: 400)
            
            // Detail/Execution View
            if let script = selectedScript {
                scriptDetailView(script)
            } else {
                emptyDetailView
            }
        }
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                Picker("Environment", selection: $selectedEnvironment) {
                    ForEach(DeployEnvironment.allCases, id: \.self) { env in
                        Text(env.displayName).tag(env)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 200)
                
                Button(action: { showDependencyManager = true }) {
                    Label("Dependencies", systemImage: "wrench.and.screwdriver")
                }
                
                Button(action: { Task { await discoverScripts() } }) {
                    Label("Refresh", systemImage: "arrow.clockwise")
                }
                .disabled(isDiscovering)
            }
        }
        .sheet(isPresented: $showDependencyManager) {
            DependencyManagerView()
                .frame(width: 700, height: 500)
        }
        .task {
            await discoverScripts()
        }
    }
    
    // MARK: - Script List
    
    private var scriptListView: some View {
        VStack(spacing: 0) {
            // Search & Filter
            VStack(spacing: 8) {
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(.secondary)
                    TextField("Search scripts...", text: $searchText)
                        .textFieldStyle(.plain)
                }
                .padding(8)
                .background(Color(nsColor: .controlBackgroundColor))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        categoryChip(nil, label: "All")
                        ForEach(ScriptCategory.allCases, id: \.self) { category in
                            categoryChip(category, label: category.rawValue)
                        }
                    }
                }
            }
            .padding()
            
            Divider()
            
            // Script List
            if isDiscovering {
                VStack {
                    ProgressView()
                    Text("Discovering scripts...")
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if filteredScripts.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "doc.text.magnifyingglass")
                        .font(.system(size: 40))
                        .foregroundStyle(.secondary)
                    Text("No scripts found")
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(filteredScripts, selection: $selectedScript) { script in
                    scriptRow(script)
                        .tag(script)
                }
                .listStyle(.inset)
            }
        }
    }
    
    private func categoryChip(_ category: ScriptCategory?, label: String) -> some View {
        Button(action: { selectedCategory = category }) {
            HStack(spacing: 4) {
                if let cat = category {
                    Image(systemName: cat.icon)
                        .font(.caption)
                }
                Text(label)
                    .font(.caption)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(selectedCategory == category ? Color.accentColor : Color.secondary.opacity(0.15))
            )
            .foregroundStyle(selectedCategory == category ? .white : .primary)
        }
        .buttonStyle(.plain)
    }
    
    private func scriptRow(_ script: DeploymentScript) -> some View {
        HStack(spacing: 12) {
            Image(systemName: script.category.icon)
                .frame(width: 24)
                .foregroundStyle(.secondary)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(script.name)
                    .fontWeight(.medium)
                
                Text(script.description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            
            Spacer()
            
            if !script.dependencies.isEmpty {
                HStack(spacing: 2) {
                    ForEach(script.dependencies.prefix(3), id: \.self) { dep in
                        Image(systemName: dependencyIcon(dep))
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                }
            }
        }
        .padding(.vertical, 4)
    }
    
    private func dependencyIcon(_ dep: DependencyType) -> String {
        switch dep {
        case .awsCli: return "cloud"
        case .nodejs, .npm: return "cube"
        case .cdk: return "hammer"
        case .python3, .pip: return "chevron.left.forwardslash.chevron.right"
        case .docker: return "shippingbox"
        case .git: return "arrow.triangle.branch"
        case .homebrew: return "mug"
        }
    }
    
    // MARK: - Detail View
    
    private func scriptDetailView(_ script: DeploymentScript) -> some View {
        VStack(spacing: 0) {
            // Header
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: script.category.icon)
                        .font(.title2)
                        .foregroundStyle(.secondary)
                    
                    VStack(alignment: .leading) {
                        Text(script.name)
                            .font(.title2)
                            .fontWeight(.semibold)
                        
                        Text(script.relativePath)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    
                    Spacer()
                    
                    Button(action: { Task { await executeScript(script) } }) {
                        Label(isExecuting ? "Running..." : "Run Script", systemImage: "play.fill")
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isExecuting)
                }
                
                Text(script.description)
                    .foregroundStyle(.secondary)
                
                // Dependencies
                if !script.dependencies.isEmpty {
                    HStack(spacing: 8) {
                        Text("Requires:")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        
                        ForEach(script.dependencies, id: \.self) { dep in
                            Text(dep.rawValue)
                                .font(.caption)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 2)
                                .background(Color.secondary.opacity(0.15))
                                .clipShape(Capsule())
                        }
                    }
                }
            }
            .padding()
            
            Divider()
            
            // Arguments (if any)
            if !script.arguments.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Arguments")
                        .font(.headline)
                    
                    ForEach(script.arguments, id: \.name) { arg in
                        HStack {
                            VStack(alignment: .leading) {
                                Text("--\(arg.name)")
                                    .font(.system(.body, design: .monospaced))
                                Text(arg.description)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            
                            Spacer()
                            
                            TextField(arg.defaultValue ?? "", text: Binding(
                                get: { scriptArguments[arg.name] ?? arg.defaultValue ?? "" },
                                set: { scriptArguments[arg.name] = $0 }
                            ))
                            .textFieldStyle(.roundedBorder)
                            .frame(width: 200)
                        }
                    }
                }
                .padding()
                
                Divider()
            }
            
            // Output
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Output")
                        .font(.headline)
                    
                    Spacer()
                    
                    if let result = executionResult {
                        HStack(spacing: 6) {
                            Image(systemName: result.success ? "checkmark.circle.fill" : "xmark.circle.fill")
                                .foregroundStyle(result.success ? .green : .red)
                            Text(result.success ? "Success" : "Failed (exit \(result.exitCode))")
                                .font(.caption)
                            Text("• \(String(format: "%.1fs", result.duration))")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    
                    Button(action: { executionOutput = [] }) {
                        Image(systemName: "trash")
                    }
                    .buttonStyle(.borderless)
                    .disabled(executionOutput.isEmpty)
                }
                
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 2) {
                            ForEach(Array(executionOutput.enumerated()), id: \.offset) { index, line in
                                Text(line)
                                    .font(.system(.caption, design: .monospaced))
                                    .foregroundStyle(lineColor(line))
                                    .textSelection(.enabled)
                                    .id(index)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(8)
                    }
                    .background(Color(nsColor: .textBackgroundColor))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .onChange(of: executionOutput.count) { _, _ in
                        if let last = executionOutput.indices.last {
                            proxy.scrollTo(last, anchor: .bottom)
                        }
                    }
                }
            }
            .padding()
        }
    }
    
    private func lineColor(_ line: String) -> Color {
        if line.lowercased().contains("error") || line.lowercased().contains("failed") {
            return .red
        } else if line.lowercased().contains("warning") {
            return .orange
        } else if line.lowercased().contains("success") || line.contains("✅") {
            return .green
        } else {
            return .primary
        }
    }
    
    private var emptyDetailView: some View {
        VStack(spacing: 16) {
            Image(systemName: "doc.text")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            
            Text("Select a script to view details")
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    // MARK: - Actions
    
    private func discoverScripts() async {
        isDiscovering = true
        scripts = await scriptRunner.discoverScripts(projectPath: projectPath)
        isDiscovering = false
    }
    
    private func executeScript(_ script: DeploymentScript) async {
        isExecuting = true
        executionOutput = []
        executionResult = nil
        
        do {
            executionResult = try await scriptRunner.executeScript(
                script,
                arguments: scriptArguments,
                environment: selectedEnvironment
            ) { progress in
                Task { @MainActor in
                    handleProgress(progress)
                }
            }
        } catch {
            executionOutput.append("❌ Error: \(error.localizedDescription)")
        }
        
        isExecuting = false
    }
    
    private func handleProgress(_ progress: ScriptExecutionProgress) {
        switch progress {
        case .checkingDependencies:
            executionOutput.append("🔍 Checking dependencies...")
        case .installingDependencies(let deps):
            executionOutput.append("📦 Installing: \(deps.map { $0.rawValue }.joined(separator: ", "))")
        case .installingDependency(let dep, let status):
            executionOutput.append("  • \(dep.rawValue): \(status.description)")
        case .preparing:
            executionOutput.append("⚙️ Preparing execution...")
        case .running:
            executionOutput.append("▶️ Running script...")
            executionOutput.append("─".repeated(50))
        case .output(let line):
            executionOutput.append(line)
        case .completed:
            executionOutput.append("─".repeated(50))
            executionOutput.append("✅ Script completed successfully")
        case .failed(let error):
            executionOutput.append("─".repeated(50))
            executionOutput.append("❌ Script failed: \(error)")
        }
    }
}

// MARK: - Extensions

extension String {
    func repeated(_ count: Int) -> String {
        return String(repeating: self, count: count)
    }
}

extension DeploymentScript: Hashable {
    static func == (lhs: DeploymentScript, rhs: DeploymentScript) -> Bool {
        lhs.id == rhs.id
    }
    
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}

extension DeployEnvironment: CaseIterable {
    static var allCases: [DeployEnvironment] = [.dev, .staging, .prod]
    
    var displayName: String {
        switch self {
        case .dev: return "Dev"
        case .staging: return "Staging"
        case .prod: return "Prod"
        }
    }
}

#Preview {
    DeploymentScriptsView(projectPath: "/Users/robertlong/CascadeProjects/Radiant")
}
