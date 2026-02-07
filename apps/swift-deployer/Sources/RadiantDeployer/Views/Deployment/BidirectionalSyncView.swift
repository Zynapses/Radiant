// RADIANT - Bi-directional Sync View
// Extract instance state → Compare → Generate package → Deploy

import SwiftUI

struct BidirectionalSyncView: View {
    @EnvironmentObject var appState: AppState
    
    @State private var currentStep: SyncStep = .selectInstance
    @State private var isExtracting = false
    @State private var extractionProgress: Double = 0
    @State private var extractionMessage = ""
    @State private var extractedState: InstanceStateExtractor.ExtractedInstanceState?
    @State private var diffReport: SchemaDiffGenerator.FullDiffReport?
    @State private var generatedPackage: PackageGenerator.GeneratedPackage?
    @State private var newVersion = ""
    @State private var error: String?
    @State private var showDestructiveWarning = false
    @State private var showVersionDetails = false
    
    // Safe Schema Migration
    @State private var migrationPolicy: SafeSchemaMigrationService.MigrationPolicy = .clearData
    @State private var detectedSchemaChanges: [SafeSchemaMigrationService.DetectedSchemaChange] = []
    @State private var createBackupBeforeClear = true
    @State private var showSchemaChangeWarning = false
    
    private let extractor = InstanceStateExtractor.shared
    private let diffGenerator = SchemaDiffGenerator.shared
    private let packageGenerator = PackageGenerator.shared
    private let safeMigration = SafeSchemaMigrationService.shared
    
    enum SyncStep: Int, CaseIterable {
        case selectInstance = 0
        case extractState = 1
        case reviewDiff = 2
        case generatePackage = 3
        case deploy = 4
        
        var title: String {
            switch self {
            case .selectInstance: return "Select Instance"
            case .extractState: return "Extract State"
            case .reviewDiff: return "Review Changes"
            case .generatePackage: return "Generate Package"
            case .deploy: return "Deploy"
            }
        }
        
        var icon: String {
            switch self {
            case .selectInstance: return "server.rack"
            case .extractState: return "arrow.down.circle"
            case .reviewDiff: return "doc.text.magnifyingglass"
            case .generatePackage: return "shippingbox"
            case .deploy: return "rocket"
            }
        }
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Header with steps
            stepIndicator
            
            Divider()
            
            // Main content
            ScrollView {
                VStack(spacing: 20) {
                    switch currentStep {
                    case .selectInstance:
                        selectInstanceView
                    case .extractState:
                        extractStateView
                    case .reviewDiff:
                        reviewDiffView
                    case .generatePackage:
                        generatePackageView
                    case .deploy:
                        deployView
                    }
                }
                .padding()
            }
            
            Divider()
            
            // Navigation buttons
            navigationButtons
        }
        .frame(minWidth: 800, minHeight: 600)
        .alert("Destructive Changes Detected", isPresented: $showDestructiveWarning) {
            Button("Continue Anyway", role: .destructive) {
                currentStep = .generatePackage
            }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("The diff contains destructive changes (column removals, table drops). These may cause data loss. Review the diff carefully before proceeding.")
        }
    }
    
    // MARK: - Step Indicator
    
    private var stepIndicator: some View {
        VStack(spacing: 0) {
            // Version badge at top
            HStack {
                BidirectionalSyncVersionBadge(showDetails: true)
                Spacer()
                
                Button {
                    showVersionDetails = true
                } label: {
                    Image(systemName: "info.circle")
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.borderless)
                .popover(isPresented: $showVersionDetails) {
                    BidirectionalSyncVersionDetailView()
                }
            }
            .padding(.horizontal)
            .padding(.top, 8)
            
            // Step indicators
            HStack(spacing: 0) {
                ForEach(SyncStep.allCases, id: \.rawValue) { step in
                    HStack(spacing: 8) {
                        ZStack {
                            Circle()
                                .fill(stepColor(for: step))
                                .frame(width: 32, height: 32)
                            
                            if step.rawValue < currentStep.rawValue {
                                Image(systemName: "checkmark")
                                    .font(.caption.bold())
                                    .foregroundColor(.white)
                            } else {
                                Image(systemName: step.icon)
                                    .font(.caption)
                                    .foregroundColor(step == currentStep ? .white : .secondary)
                            }
                        }
                        
                        Text(step.title)
                            .font(.caption)
                            .foregroundColor(step == currentStep ? .primary : .secondary)
                    }
                    
                    if step != SyncStep.allCases.last {
                        Rectangle()
                            .fill(step.rawValue < currentStep.rawValue ? Color.green : Color.secondary.opacity(0.3))
                            .frame(height: 2)
                            .frame(maxWidth: .infinity)
                    }
                }
            }
            .padding()
        }
        .background(Color(.controlBackgroundColor))
    }
    
    private func stepColor(for step: SyncStep) -> Color {
        if step.rawValue < currentStep.rawValue {
            return .green
        } else if step == currentStep {
            return .blue
        } else {
            return .secondary.opacity(0.3)
        }
    }
    
    // MARK: - Step 1: Select Instance
    
    private var selectInstanceView: some View {
        VStack(alignment: .leading, spacing: 20) {
            infoBox(
                icon: "info.circle.fill",
                color: .blue,
                title: "Bi-directional Sync",
                message: "This tool extracts the current state from a running AWS instance and generates a new deployable package. Data is preserved - only schema and code are captured."
            )
            
            GroupBox("Select Instance") {
                VStack(alignment: .leading, spacing: 12) {
                    Picker("Application", selection: $appState.selectedApp) {
                        Text("Select an application").tag(nil as ManagedApp?)
                        ForEach(appState.apps) { app in
                            Text(app.name).tag(app as ManagedApp?)
                        }
                    }
                    
                    Picker("Environment", selection: $appState.selectedEnvironment) {
                        ForEach(DeployEnvironment.allCases) { env in
                            Text(env.displayName).tag(env)
                        }
                    }
                    
                    if appState.credentials.isEmpty {
                        Label("No AWS credentials configured", systemImage: "exclamationmark.triangle")
                            .foregroundColor(.orange)
                    } else {
                        Label("Credentials: \(appState.credentials.first?.name ?? "Default")", systemImage: "checkmark.circle")
                            .foregroundColor(.green)
                    }
                }
                .padding()
            }
            
            GroupBox("What Will Be Extracted") {
                VStack(alignment: .leading, spacing: 8) {
                    extractionItem(icon: "cylinder.split.1x2", title: "Database Schema", description: "Table definitions, columns, indexes, enums (NOT data)")
                    extractionItem(icon: "function", title: "Lambda Functions", description: "Function code, configuration, environment variables")
                    extractionItem(icon: "externaldrive", title: "S3 Bucket Config", description: "Bucket settings, versioning, encryption (NOT contents)")
                    extractionItem(icon: "tablecells", title: "DynamoDB Schemas", description: "Table definitions, key schemas, indexes (NOT data)")
                    extractionItem(icon: "square.stack.3d.up", title: "CDK Stack Outputs", description: "CloudFormation outputs and deployed version")
                }
                .padding()
            }
            
            if let error = error {
                Label(error, systemImage: "exclamationmark.triangle.fill")
                    .foregroundColor(.red)
                    .padding()
                    .background(Color.red.opacity(0.1))
                    .cornerRadius(8)
            }
        }
    }
    
    private func extractionItem(icon: String, title: String, description: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(.blue)
                .frame(width: 20)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.bold())
                Text(description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }
    
    // MARK: - Step 2: Extract State
    
    private var extractStateView: some View {
        VStack(spacing: 20) {
            if isExtracting {
                VStack(spacing: 16) {
                    ProgressView(value: extractionProgress)
                        .progressViewStyle(.linear)
                    
                    Text(extractionMessage)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    
                    HStack {
                        Image(systemName: "arrow.down.circle")
                            .foregroundColor(.blue)
                        Text("Extracting from \(appState.selectedApp?.name ?? "instance")...")
                    }
                }
                .padding(40)
            } else if let state = extractedState {
                extractedStateSummary(state)
            } else {
                VStack(spacing: 16) {
                    Image(systemName: "arrow.down.circle")
                        .font(.system(size: 48))
                        .foregroundColor(.blue)
                    
                    Text("Ready to Extract")
                        .font(.headline)
                    
                    Text("Click 'Extract State' to read the current state from your AWS instance. This is a read-only operation - nothing will be modified.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                    
                    Button("Extract State") {
                        Task { await performExtraction() }
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                }
                .padding(40)
            }
        }
    }
    
    private func extractedStateSummary(_ state: InstanceStateExtractor.ExtractedInstanceState) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Label("Extraction Complete", systemImage: "checkmark.circle.fill")
                .font(.headline)
                .foregroundColor(.green)
            
            GroupBox("Extracted State Summary") {
                Grid(alignment: .leading, horizontalSpacing: 20, verticalSpacing: 8) {
                    GridRow {
                        Text("Instance:")
                        Text("\(state.appId) / \(state.environment)")
                            .fontWeight(.medium)
                    }
                    GridRow {
                        Text("Deployed Version:")
                        Text(state.deployedVersion)
                            .fontWeight(.medium)
                    }
                    GridRow {
                        Text("Database Tables:")
                        Text("\(state.databaseSchema.tables.count)")
                            .fontWeight(.medium)
                    }
                    GridRow {
                        Text("Database Enums:")
                        Text("\(state.databaseSchema.enums.count)")
                            .fontWeight(.medium)
                    }
                    GridRow {
                        Text("Lambda Functions:")
                        Text("\(state.lambdaFunctions.count)")
                            .fontWeight(.medium)
                    }
                    GridRow {
                        Text("S3 Buckets:")
                        Text("\(state.s3Buckets.count)")
                            .fontWeight(.medium)
                    }
                    GridRow {
                        Text("DynamoDB Tables:")
                        Text("\(state.dynamoDBTables.count)")
                            .fontWeight(.medium)
                    }
                    GridRow {
                        Text("Extraction Time:")
                        Text(String(format: "%.1fs", state.extractionDuration))
                            .fontWeight(.medium)
                    }
                }
                .padding()
            }
            
            if !state.warnings.isEmpty {
                GroupBox {
                    VStack(alignment: .leading, spacing: 4) {
                        Label("Warnings", systemImage: "exclamationmark.triangle")
                            .font(.subheadline.bold())
                            .foregroundColor(.orange)
                        
                        ForEach(state.warnings, id: \.self) { warning in
                            Text("• \(warning)")
                                .font(.caption)
                        }
                    }
                    .padding()
                }
            }
        }
    }
    
    // MARK: - Step 3: Review Diff
    
    private var reviewDiffView: some View {
        VStack(alignment: .leading, spacing: 16) {
            if let diff = diffReport {
                HStack {
                    Label("Diff Report", systemImage: "doc.text.magnifyingglass")
                        .font(.headline)
                    
                    Spacer()
                    
                    if diff.requiresManualReview {
                        Label("Manual Review Required", systemImage: "exclamationmark.triangle.fill")
                            .font(.caption)
                            .foregroundColor(.orange)
                    } else if diff.canAutoMerge {
                        Label("Safe to Merge", systemImage: "checkmark.circle.fill")
                            .font(.caption)
                            .foregroundColor(.green)
                    }
                }
                
                // Summary
                GroupBox("Summary") {
                    HStack(spacing: 20) {
                        statBox(title: "Schema Changes", value: "\(diff.schemaDiffs.count)", color: .blue)
                        statBox(title: "Lambda Changes", value: "\(diff.lambdaDiffs.count)", color: .purple)
                        statBox(title: "Destructive", value: "\(diff.schemaDiffs.filter { $0.isDestructive }.count)", color: .red)
                    }
                    .padding()
                }
                
                // Safe Schema Migration Policy
                if diff.schemaDiffs.contains(where: { $0.isDestructive }) {
                    GroupBox {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Image(systemName: "shield.checkered")
                                    .foregroundColor(.orange)
                                Text("Safe Schema Migration Policy")
                                    .font(.subheadline.bold())
                            }
                            
                            Text("Destructive schema changes detected. Select how to handle tables without explicit migrations:")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            
                            Picker("Migration Policy", selection: $migrationPolicy) {
                                ForEach(SafeSchemaMigrationService.MigrationPolicy.allCases, id: \.rawValue) { policy in
                                    Text(policy.description).tag(policy)
                                }
                            }
                            .pickerStyle(.radioGroup)
                            
                            if migrationPolicy == .clearData {
                                Toggle("Create backup before clearing data", isOn: $createBackupBeforeClear)
                                    .font(.caption)
                                
                                HStack {
                                    Image(systemName: "info.circle")
                                        .foregroundColor(.blue)
                                    Text("Tables will be backed up and truncated to prevent data incompatibility and regulatory issues.")
                                        .font(.caption2)
                                        .foregroundColor(.secondary)
                                }
                                .padding(.top, 4)
                            }
                            
                            if migrationPolicy == .strict {
                                HStack {
                                    Image(systemName: "exclamationmark.triangle.fill")
                                        .foregroundColor(.red)
                                    Text("Deployment will FAIL if any schema change lacks a migration.")
                                        .font(.caption2)
                                        .foregroundColor(.red)
                                }
                            }
                        }
                        .padding()
                    }
                    .background(Color.orange.opacity(0.05))
                }
                
                // Schema changes
                if !diff.schemaDiffs.isEmpty {
                    GroupBox("Schema Changes") {
                        ScrollView {
                            VStack(alignment: .leading, spacing: 8) {
                                ForEach(diff.schemaDiffs, id: \.objectName) { schemaDiff in
                                    schemaDiffRow(schemaDiff)
                                }
                            }
                            .padding()
                        }
                        .frame(maxHeight: 200)
                    }
                }
                
                // Lambda changes
                if !diff.lambdaDiffs.isEmpty {
                    GroupBox("Lambda Changes") {
                        VStack(alignment: .leading, spacing: 8) {
                            ForEach(diff.lambdaDiffs, id: \.functionName) { lambdaDiff in
                                lambdaDiffRow(lambdaDiff)
                            }
                        }
                        .padding()
                    }
                }
                
                if diff.schemaDiffs.isEmpty && diff.lambdaDiffs.isEmpty {
                    infoBox(
                        icon: "checkmark.circle.fill",
                        color: .green,
                        title: "No Changes Detected",
                        message: "The instance state matches the current package. No migration needed."
                    )
                }
            } else {
                VStack(spacing: 16) {
                    ProgressView()
                    Text("Generating diff report...")
                }
                .padding(40)
                .onAppear {
                    Task { await generateDiff() }
                }
            }
        }
    }
    
    private func statBox(title: String, value: String, color: Color) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.title.bold())
                .foregroundColor(color)
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
    
    private func schemaDiffRow(_ diff: SchemaDiffGenerator.SchemaDiff) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: diff.isDestructive ? "exclamationmark.triangle.fill" : "plus.circle.fill")
                .foregroundColor(diff.isDestructive ? .red : .green)
            
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(diff.objectName)
                        .font(.subheadline.bold())
                    Text("(\(diff.type.rawValue))")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Text(diff.details)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
        }
        .padding(8)
        .background(diff.isDestructive ? Color.red.opacity(0.1) : Color.green.opacity(0.1))
        .cornerRadius(6)
    }
    
    private func lambdaDiffRow(_ diff: SchemaDiffGenerator.LambdaDiff) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: diff.changeType == .added ? "plus.circle.fill" : 
                             diff.changeType == .removed ? "minus.circle.fill" : "arrow.triangle.2.circlepath")
                .foregroundColor(diff.changeType == .removed ? .red : .blue)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(diff.functionName)
                    .font(.subheadline.bold())
                Text(diff.details)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
        }
        .padding(8)
        .background(Color.blue.opacity(0.1))
        .cornerRadius(6)
    }
    
    // MARK: - Step 4: Generate Package
    
    private var generatePackageView: some View {
        VStack(alignment: .leading, spacing: 16) {
            if let pkg = generatedPackage {
                Label("Package Generated Successfully", systemImage: "checkmark.circle.fill")
                    .font(.headline)
                    .foregroundColor(.green)
                
                GroupBox("Generated Package") {
                    Grid(alignment: .leading, horizontalSpacing: 20, verticalSpacing: 8) {
                        GridRow {
                            Text("Version:")
                            Text(pkg.version).fontWeight(.medium)
                        }
                        GridRow {
                            Text("Based On:")
                            Text(pkg.basedOnVersion).fontWeight(.medium)
                        }
                        GridRow {
                            Text("Schema Changes:")
                            Text("\(pkg.includedChanges.schemaChanges)").fontWeight(.medium)
                        }
                        GridRow {
                            Text("Lambda Changes:")
                            Text("\(pkg.includedChanges.lambdaChanges)").fontWeight(.medium)
                        }
                        GridRow {
                            Text("Location:")
                            Text(pkg.packagePath.path)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding()
                }
                
                if !pkg.includedChanges.newMigrations.isEmpty {
                    GroupBox("New Migrations") {
                        VStack(alignment: .leading, spacing: 4) {
                            ForEach(pkg.includedChanges.newMigrations, id: \.self) { migration in
                                Label(migration, systemImage: "doc.text")
                                    .font(.caption)
                            }
                        }
                        .padding()
                    }
                }
            } else {
                GroupBox("Package Configuration") {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("New Version:")
                            TextField("e.g., 4.19.0", text: $newVersion)
                                .textFieldStyle(.roundedBorder)
                                .frame(width: 150)
                            
                            if let diff = diffReport {
                                Button("Suggest") {
                                    newVersion = PackageGenerator.shared.suggestNextVersion(currentVersion: diff.packageVersion)
                                }
                                .buttonStyle(.borderless)
                            }
                        }
                        
                        Text("This will create a new package version containing all extracted changes.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding()
                }
                
                Button("Generate Package") {
                    Task { await generatePackage() }
                }
                .buttonStyle(.borderedProminent)
                .disabled(newVersion.isEmpty)
            }
        }
    }
    
    // MARK: - Step 5: Deploy
    
    private var deployView: some View {
        VStack(spacing: 20) {
            if let pkg = generatedPackage {
                infoBox(
                    icon: "checkmark.circle.fill",
                    color: .green,
                    title: "Ready to Deploy",
                    message: "Package v\(pkg.version) is ready. You can deploy it to any environment."
                )
                
                GroupBox("Deploy Options") {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("The generated package can be:")
                            .font(.subheadline)
                        
                        HStack(spacing: 12) {
                            Image(systemName: "1.circle.fill")
                                .foregroundColor(.blue)
                            Text("Deployed immediately to the same instance")
                        }
                        
                        HStack(spacing: 12) {
                            Image(systemName: "2.circle.fill")
                                .foregroundColor(.blue)
                            Text("Deployed to a different environment (Dev → Prod)")
                        }
                        
                        HStack(spacing: 12) {
                            Image(systemName: "3.circle.fill")
                                .foregroundColor(.blue)
                            Text("Published to your package registry for later use")
                        }
                    }
                    .padding()
                }
                
                HStack(spacing: 16) {
                    Button("Open Package Folder") {
                        NSWorkspace.shared.selectFile(nil, inFileViewerRootedAtPath: pkg.packagePath.path)
                    }
                    .buttonStyle(.bordered)
                    
                    Button("Deploy Now") {
                        // Switch to deploy view with this package
                        appState.selectedTab = .deploy
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
        }
    }
    
    // MARK: - Navigation Buttons
    
    private var navigationButtons: some View {
        HStack {
            Button("Back") {
                if currentStep.rawValue > 0 {
                    currentStep = SyncStep(rawValue: currentStep.rawValue - 1)!
                }
            }
            .disabled(currentStep == .selectInstance || isExtracting)
            
            Spacer()
            
            if currentStep == .selectInstance {
                Button("Next: Extract State") {
                    currentStep = .extractState
                }
                .buttonStyle(.borderedProminent)
                .disabled(appState.selectedApp == nil || appState.credentials.isEmpty)
            } else if currentStep == .extractState && extractedState != nil {
                Button("Next: Review Diff") {
                    currentStep = .reviewDiff
                }
                .buttonStyle(.borderedProminent)
            } else if currentStep == .reviewDiff && diffReport != nil {
                Button("Next: Generate Package") {
                    if diffReport?.requiresManualReview == true {
                        showDestructiveWarning = true
                    } else {
                        currentStep = .generatePackage
                    }
                }
                .buttonStyle(.borderedProminent)
            } else if currentStep == .generatePackage && generatedPackage != nil {
                Button("Next: Deploy") {
                    currentStep = .deploy
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding()
    }
    
    // MARK: - Helper Views
    
    private func infoBox(icon: String, color: Color, title: String, message: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(color)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                Text(message)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(color.opacity(0.1))
        .cornerRadius(8)
    }
    
    // MARK: - Actions
    
    private func performExtraction() async {
        guard let app = appState.selectedApp,
              let credentials = appState.credentials.first else {
            return
        }
        
        isExtracting = true
        error = nil
        
        do {
            extractedState = try await extractor.extractInstanceState(
                appId: app.id,
                environment: appState.selectedEnvironment.rawValue,
                credentials: credentials
            ) { message, progress in
                Task { @MainActor in
                    self.extractionMessage = message
                    self.extractionProgress = progress
                }
            }
        } catch {
            self.error = error.localizedDescription
        }
        
        isExtracting = false
    }
    
    private func generateDiff() async {
        guard let state = extractedState else { return }
        
        // For now, use a placeholder package path
        // In production, this would be the actual package being compared against
        let packagePath = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            .appendingPathComponent("RadiantDeployer")
            .appendingPathComponent("packages")
            .appendingPathComponent("current")
        
        do {
            diffReport = try await diffGenerator.generateDiff(
                extractedState: state,
                packagePath: packagePath
            ) { message in
                RadiantLogger.info(message, category: RadiantLogger.general)
            }
            
            // Suggest next version
            if let diff = diffReport {
                newVersion = PackageGenerator.shared.suggestNextVersion(currentVersion: diff.packageVersion)
            }
        } catch {
            self.error = error.localizedDescription
        }
    }
    
    private func generatePackage() async {
        guard let state = extractedState,
              let diff = diffReport else { return }
        
        let packagePath = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            .appendingPathComponent("RadiantDeployer")
            .appendingPathComponent("packages")
            .appendingPathComponent("current")
        
        do {
            generatedPackage = try await packageGenerator.generatePackage(
                from: state,
                diffReport: diff,
                basePackagePath: packagePath,
                newVersion: newVersion
            ) { message, progress in
                RadiantLogger.info("\(message) (\(Int(progress * 100))%)", category: RadiantLogger.general)
            }
        } catch {
            self.error = error.localizedDescription
        }
    }
}

#Preview {
    BidirectionalSyncView()
        .environmentObject(AppState())
        .frame(width: 900, height: 700)
}
