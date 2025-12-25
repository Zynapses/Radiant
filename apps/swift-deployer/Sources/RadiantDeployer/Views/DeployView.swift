import SwiftUI

struct DeployView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedTier: TierLevel = .seed
    @State private var showConfirmation = false
    @State private var deploymentMode: DeploymentMode = .install
    @State private var isCheckingMode = false
    @State private var showParameterEditor = false
    @State private var selectedSnapshot: DeploymentSnapshot?
    @State private var availableSnapshots: [DeploymentSnapshot] = []
    
    private let deploymentService = DeploymentService()
    
    var body: some View {
        HSplitView {
            deploymentConfigPanel
                .frame(minWidth: 450, maxWidth: 550)
            
            deploymentLogsPanel
        }
        .navigationTitle("Deploy")
        .onChange(of: appState.selectedApp) { _ in
            Task { await checkDeploymentMode() }
        }
        .onChange(of: appState.selectedEnvironment) { _ in
            Task { await checkDeploymentMode() }
        }
    }
    
    private var deploymentConfigPanel: some View {
        Form {
            // Application & Environment Selection
            Section("Application") {
                Picker("Select App", selection: $appState.selectedApp) {
                    Text("Select an application").tag(nil as ManagedApp?)
                    ForEach(appState.apps) { app in
                        Text(app.name).tag(app as ManagedApp?)
                    }
                }
                
                Picker("Environment", selection: $appState.selectedEnvironment) {
                    ForEach(DeployEnvironment.allCases) { env in
                        Text(env.rawValue).tag(env)
                    }
                }
            }
            
            // Deployment Mode Detection
            Section("Deployment Mode") {
                if isCheckingMode {
                    HStack {
                        ProgressView()
                            .controlSize(.small)
                        Text("Checking existing deployment...")
                            .foregroundStyle(.secondary)
                    }
                } else {
                    HStack {
                        Image(systemName: deploymentMode.icon)
                            .font(.title2)
                            .foregroundColor(modeColor)
                        
                        VStack(alignment: .leading) {
                            Text(deploymentMode.displayName)
                                .font(.headline)
                            Text(modeDescription)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        
                        Spacer()
                        
                        Button("Check Again") {
                            Task { await checkDeploymentMode() }
                        }
                        .buttonStyle(.borderless)
                    }
                }
            }
            
            // Tier Selection (for install mode)
            if deploymentMode == .install {
                Section("Infrastructure Tier") {
                    TierPickerNew(selectedTier: $selectedTier)
                }
            }
            
            // Parameter Editor Toggle
            if appState.selectedApp != nil {
                Section("Parameters") {
                    Button {
                        showParameterEditor.toggle()
                    } label: {
                        HStack {
                            Image(systemName: "slider.horizontal.3")
                            Text(showParameterEditor ? "Hide Parameters" : "Configure Parameters")
                            Spacer()
                            Image(systemName: showParameterEditor ? "chevron.up" : "chevron.down")
                        }
                    }
                    .buttonStyle(.borderless)
                    
                    if showParameterEditor, let app = appState.selectedApp {
                        ParameterEditorView(
                            app: app,
                            environment: appState.selectedEnvironment,
                            mode: deploymentMode,
                            onSave: { _ in }
                        )
                    }
                }
            }
            
            // Rollback Snapshot Selection
            if deploymentMode == .rollback {
                Section("Select Snapshot") {
                    if availableSnapshots.isEmpty {
                        Text("No snapshots available")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(availableSnapshots) { snapshot in
                            Button {
                                selectedSnapshot = snapshot
                            } label: {
                                HStack {
                                    VStack(alignment: .leading) {
                                        Text("v\(snapshot.version)")
                                            .font(.headline)
                                        Text(snapshot.createdAt, style: .date)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    if selectedSnapshot?.id == snapshot.id {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundColor(.blue)
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            
            // Credentials
            Section("Credentials") {
                if appState.credentials.isEmpty {
                    Label("No credentials configured", systemImage: "exclamationmark.triangle")
                        .foregroundStyle(.orange)
                    
                    Button("Configure Credentials") {
                        appState.selectedTab = .settings
                    }
                } else {
                    ForEach(appState.credentials, id: \.id) { cred in
                        HStack {
                            VStack(alignment: .leading) {
                                Text(cred.name)
                                    .font(.headline)
                                Text(cred.region)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            if cred.isValid == true {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(.green)
                            }
                        }
                    }
                }
            }
            
            // Deploy Button
            Section {
                Button(action: { showConfirmation = true }) {
                    HStack {
                        Image(systemName: deploymentMode.icon)
                        Text(deployButtonText)
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(modeColor)
                .controlSize(.large)
                .disabled(!canDeploy)
            }
        }
        .formStyle(.grouped)
        .confirmationDialog(
            confirmationTitle,
            isPresented: $showConfirmation,
            titleVisibility: .visible
        ) {
            Button(deployButtonText, role: deploymentMode == .rollback ? .destructive : nil) {
                startDeployment()
            }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text(confirmationMessage)
        }
    }
    
    // MARK: - Computed Properties
    
    private var modeColor: Color {
        switch deploymentMode {
        case .install: return .green
        case .update: return .blue
        case .rollback: return .orange
        }
    }
    
    private var modeDescription: String {
        switch deploymentMode {
        case .install: return "No existing deployment found. Will create new infrastructure."
        case .update: return "Existing deployment found. Will update with your changes."
        case .rollback: return "Select a snapshot to restore previous state."
        }
    }
    
    private var deployButtonText: String {
        switch deploymentMode {
        case .install: return "Install to \(appState.selectedEnvironment.shortName)"
        case .update: return "Update \(appState.selectedEnvironment.shortName)"
        case .rollback: return "Rollback \(appState.selectedEnvironment.shortName)"
        }
    }
    
    private var canDeploy: Bool {
        guard appState.selectedApp != nil,
              !appState.credentials.isEmpty,
              !appState.isDeploying else {
            return false
        }
        
        if deploymentMode == .rollback && selectedSnapshot == nil {
            return false
        }
        
        return true
    }
    
    private var confirmationTitle: String {
        "\(deploymentMode.displayName) \(appState.selectedApp?.name ?? "") to \(appState.selectedEnvironment.shortName)?"
    }
    
    private var confirmationMessage: String {
        switch deploymentMode {
        case .install:
            return "This will create new infrastructure in your AWS account. AI Registry will be seeded with providers and models. Charges will apply."
        case .update:
            return "This will update existing infrastructure. Admin customizations to AI providers and models will be preserved."
        case .rollback:
            return "This will restore the system to the selected snapshot. Current state will be saved as a safety snapshot."
        }
    }
    
    // MARK: - Methods
    
    private func checkDeploymentMode() async {
        guard let app = appState.selectedApp else { return }
        
        isCheckingMode = true
        defer { isCheckingMode = false }
        
        do {
            deploymentMode = try await deploymentService.determineDeploymentMode(
                app: app,
                environment: appState.selectedEnvironment
            )
            
            // Load snapshots if rollback mode
            if deploymentMode == .rollback || deploymentMode == .update {
                availableSnapshots = try await deploymentService.listSnapshots(
                    app: app,
                    environment: appState.selectedEnvironment
                )
            }
        } catch {
            // Default to install if check fails
            deploymentMode = .install
        }
    }
    
    private var deploymentLogsPanel: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Deployment Logs")
                    .font(.headline)
                Spacer()
                if appState.isDeploying {
                    ProgressView()
                        .controlSize(.small)
                }
            }
            .padding()
            .background(.bar)
            
            if let progress = appState.deploymentProgress {
                DeploymentProgressView(progress: progress)
                    .padding()
            }
            
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 4) {
                    ForEach(appState.deploymentLogs) { log in
                        LogEntryView(entry: log)
                    }
                }
                .padding()
            }
            .background(.black.opacity(0.8))
            .font(.system(.caption, design: .monospaced))
        }
    }
    
    private func startDeployment() {
        guard let app = appState.selectedApp else { return }
        
        appState.isDeploying = true
        let startTime = Date()
        
        appState.deploymentProgress = DeploymentProgress(
            phase: .validating,
            progress: 0.05,
            currentStack: nil,
            message: "Starting \(deploymentMode.displayName.lowercased())...",
            startedAt: startTime,
            estimatedCompletion: startTime.addingTimeInterval(600)
        )
        
        appState.deploymentLogs.append(LogEntry(
            timestamp: Date(),
            level: .info,
            message: "[\(deploymentMode.displayName.uppercased())] Starting \(deploymentMode.displayName.lowercased()) of \(app.name) to \(appState.selectedEnvironment.shortName)",
            metadata: nil
        ))
        
        // Log mode-specific information
        switch deploymentMode {
        case .install:
            appState.deploymentLogs.append(LogEntry(
                timestamp: Date(),
                level: .info,
                message: "Using default parameters for \(selectedTier.displayName) tier",
                metadata: nil
            ))
            appState.deploymentLogs.append(LogEntry(
                timestamp: Date(),
                level: .info,
                message: "AI Registry will be seeded with providers and models",
                metadata: nil
            ))
            
        case .update:
            appState.deploymentLogs.append(LogEntry(
                timestamp: Date(),
                level: .info,
                message: "Fetching current parameters from running instance...",
                metadata: nil
            ))
            appState.deploymentLogs.append(LogEntry(
                timestamp: Date(),
                level: .info,
                message: "AI Registry will NOT be modified (admin customizations preserved)",
                metadata: nil
            ))
            
        case .rollback:
            if let snapshot = selectedSnapshot {
                appState.deploymentLogs.append(LogEntry(
                    timestamp: Date(),
                    level: .info,
                    message: "Rolling back to snapshot: \(snapshot.id) (v\(snapshot.version))",
                    metadata: nil
                ))
            }
        }
        
        // Execute deployment in background
        Task {
            await executeDeployment(app: app)
        }
    }
    
    private func executeDeployment(app: ManagedApp) async {
        guard let credentials = appState.credentials.first else {
            await MainActor.run {
                appState.deploymentLogs.append(LogEntry(
                    timestamp: Date(),
                    level: .error,
                    message: "No credentials available. Add AWS credentials in Settings.",
                    metadata: nil
                ))
                appState.isDeploying = false
                ToastManager.shared.showError("Deployment Failed", message: "No AWS credentials configured")
            }
            return
        }
        
        let startTime = Date()
        await AuditLogger.shared.log(
            action: .deploymentStarted,
            details: "Started \(deploymentMode.displayName) for \(app.name) in \(appState.selectedEnvironment.rawValue)",
            metadata: ["app_id": app.id, "environment": appState.selectedEnvironment.rawValue, "mode": deploymentMode.rawValue]
        )
        
        do {
            let packageService = PackageService()
            let environment = appState.selectedEnvironment
            
            switch deploymentMode {
            case .install:
                // Download the latest package
                await logMessage(.info, "Downloading deployment package v\(RADIANT_VERSION)...")
                
                let packageInfo = try await packageService.downloadLatestPackage(channel: .stable) { progress in
                    Task { @MainActor in
                        self.appState.deploymentProgress?.progress = progress * 0.1
                    }
                }
                
                await logMessage(.success, "Package downloaded: \(packageInfo.filename)")
                
                // Verify package integrity
                await logMessage(.info, "Verifying package integrity...")
                let isValid = try await packageService.verifyPackage(packageInfo)
                guard isValid else {
                    throw DeploymentError.verificationFailed("Package hash mismatch")
                }
                await logMessage(.success, "Package verified")
                
                // Execute CDK deployment
                _ = try await appState.cdkService.deploy(
                    appId: app.id,
                    environment: environment.rawValue,
                    tier: selectedTier.rawValue,
                    credentials: credentials,
                    progressHandler: { message in
                        Task { @MainActor in
                            self.appState.deploymentProgress?.message = message
                            self.appState.deploymentLogs.append(LogEntry(
                                timestamp: Date(),
                                level: .info,
                                message: message,
                                metadata: ["source": "CDK"]
                            ))
                        }
                    }
                )
                
                await logMessage(.success, "Fresh install completed successfully")
                await AuditLogger.shared.log(action: .deploymentCompleted, details: "Install completed for \(app.name)")
                
            case .update:
                // Create pre-update snapshot
                await logMessage(.info, "Creating pre-update snapshot...")
                let snapshotService = DeploymentService()
                let snapshot = try await snapshotService.createSnapshot(
                    app: app,
                    environment: environment,
                    credentials: credentials,
                    reason: .preUpdate
                )
                await logMessage(.success, "Snapshot created: \(snapshot.id)")
                
                // Fetch current parameters
                await logMessage(.info, "Fetching current configuration...")
                let currentParams = try await snapshotService.fetchCurrentParameters(
                    app: app,
                    environment: environment,
                    credentials: credentials
                )
                await logMessage(.info, "Current version: \(currentParams.version ?? "unknown")")
                
                // Download update package
                await logMessage(.info, "Downloading update package...")
                let packageInfo = try await packageService.downloadLatestPackage(channel: .stable) { progress in
                    Task { @MainActor in
                        self.appState.deploymentProgress?.progress = progress * 0.1
                    }
                }
                
                // Execute CDK deployment with preserved parameters
                _ = try await appState.cdkService.deploy(
                    appId: app.id,
                    environment: environment.rawValue,
                    tier: selectedTier.rawValue,
                    credentials: credentials,
                    progressHandler: { message in
                        Task { @MainActor in
                            self.appState.deploymentProgress?.message = message
                            self.appState.deploymentLogs.append(LogEntry(
                                timestamp: Date(),
                                level: .info,
                                message: message,
                                metadata: ["source": "CDK"]
                            ))
                        }
                    }
                )
                
                await logMessage(.success, "Update completed successfully")
                await AuditLogger.shared.log(action: .deploymentCompleted, details: "Update completed for \(app.name)")
                
            case .rollback:
                guard let snapshot = selectedSnapshot else {
                    throw DeploymentError.verificationFailed("No snapshot selected for rollback")
                }
                
                await logMessage(.info, "Initiating rollback to snapshot: \(snapshot.id)")
                await AuditLogger.shared.log(action: .rollbackInitiated, details: "Rolling back to \(snapshot.version)")
                
                // Load snapshot package
                await logMessage(.info, "Loading snapshot package v\(snapshot.version)...")
                
                // Restore from snapshot
                let snapshotService = DeploymentService()
                try await snapshotService.restoreFromSnapshot(
                    snapshot: snapshot,
                    app: app,
                    environment: environment,
                    credentials: credentials,
                    onProgress: { progress in
                        Task { @MainActor in
                            self.appState.deploymentProgress?.progress = progress
                        }
                    },
                    onLog: { log in
                        Task { @MainActor in
                            self.appState.deploymentLogs.append(log)
                        }
                    }
                )
                
                await logMessage(.success, "Rollback completed to v\(snapshot.version)")
                await AuditLogger.shared.log(action: .deploymentCompleted, details: "Rollback completed for \(app.name)")
            }
            
            // Mark deployment complete
            await MainActor.run {
                appState.deploymentProgress = DeploymentProgress(
                    phase: .complete,
                    progress: 1.0,
                    currentStack: nil,
                    message: "\(deploymentMode.displayName) complete!",
                    startedAt: startTime,
                    estimatedCompletion: nil
                )
                appState.isDeploying = false
                ToastManager.shared.showSuccess("Deployment Complete", message: "\(deploymentMode.displayName) finished successfully")
            }
            
        } catch {
            await AuditLogger.shared.log(
                action: .deploymentFailed,
                details: "Failed: \(error.localizedDescription)",
                metadata: ["error": error.localizedDescription]
            )
            
            await MainActor.run {
                appState.deploymentProgress = DeploymentProgress(
                    phase: .failed,
                    progress: 0,
                    currentStack: nil,
                    message: "Deployment failed: \(error.localizedDescription)",
                    startedAt: startTime,
                    estimatedCompletion: nil
                )
                
                appState.deploymentLogs.append(LogEntry(
                    timestamp: Date(),
                    level: .error,
                    message: "Deployment failed: \(error.localizedDescription)",
                    metadata: nil
                ))
                
                appState.isDeploying = false
                ToastManager.shared.showError("Deployment Failed", message: error.localizedDescription)
            }
        }
    }
    
    private func logMessage(_ level: LogLevel, _ message: String) async {
        await MainActor.run {
            appState.deploymentLogs.append(LogEntry(
                timestamp: Date(),
                level: level,
                message: message,
                metadata: nil
            ))
        }
    }
}

// MARK: - Tier Picker (New)

struct TierPickerNew: View {
    @Binding var selectedTier: TierLevel
    
    var body: some View {
        ForEach(TierLevel.allCases, id: \.self) { tier in
            Button {
                selectedTier = tier
            } label: {
                HStack {
                    VStack(alignment: .leading) {
                        HStack {
                            Text("Tier \(tier.rawValue): \(tier.displayName)")
                                .font(.headline)
                            Spacer()
                            Text(tier.priceRange)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Text(tier.description)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    
                    if selectedTier == tier {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(.blue)
                    }
                }
                .padding(.vertical, 4)
            }
            .buttonStyle(.plain)
        }
    }
}

// MARK: - Legacy Tier Picker (for compatibility)

struct TierPicker: View {
    @Binding var selectedTier: Int
    
    private let tiers = [
        (1, "SEED", "$50-150/mo", "Development and testing"),
        (2, "STARTER", "$200-400/mo", "Small production workloads"),
        (3, "GROWTH", "$1,000-2,500/mo", "Medium production with self-hosted models"),
        (4, "SCALE", "$4,000-8,000/mo", "Large production with multi-region"),
        (5, "ENTERPRISE", "$15,000-35,000/mo", "Enterprise-grade global deployment")
    ]
    
    var body: some View {
        ForEach(tiers, id: \.0) { tier in
            Button {
                selectedTier = tier.0
            } label: {
                HStack {
                    VStack(alignment: .leading) {
                        HStack {
                            Text("Tier \(tier.0): \(tier.1)")
                                .font(.headline)
                            Spacer()
                            Text(tier.2)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Text(tier.3)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    
                    if selectedTier == tier.0 {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(.blue)
                    }
                }
                .padding(.vertical, 4)
            }
            .buttonStyle(.plain)
        }
    }
}

struct DeploymentProgressView: View {
    let progress: DeploymentProgress
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: progress.phase.icon)
                Text(progress.phase.rawValue)
                    .font(.headline)
                Spacer()
                Text("\(Int(progress.progress * 100))%")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            ProgressView(value: progress.progress)
                .progressViewStyle(.linear)
            
            if let message = progress.message {
                Text(message)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct LogEntryView: View {
    let entry: LogEntry
    
    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Text(entry.timestamp, style: .time)
                .foregroundStyle(.secondary)
            
            Image(systemName: entry.level.icon)
                .foregroundStyle(levelColor)
            
            Text(entry.message)
                .foregroundStyle(.white)
        }
    }
    
    private var levelColor: Color {
        switch entry.level {
        case .debug: return .gray
        case .info: return .blue
        case .warn: return .orange
        case .error: return .red
        case .success: return .green
        }
    }
}

#Preview {
    DeployView()
        .environmentObject(AppState())
        .frame(width: 1000, height: 700)
}
