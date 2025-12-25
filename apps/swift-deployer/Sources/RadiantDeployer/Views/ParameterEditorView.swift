// RADIANT v4.18.0 - Parameter Editor View
// Displays and edits deployment parameters based on deployment mode

import SwiftUI

struct ParameterEditorView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var viewModel: ParameterEditorViewModel
    
    let app: ManagedApp
    let environment: DeployEnvironment
    let mode: DeploymentMode
    
    init(app: ManagedApp, environment: DeployEnvironment, mode: DeploymentMode) {
        self.app = app
        self.environment = environment
        self.mode = mode
        self._viewModel = StateObject(wrappedValue: ParameterEditorViewModel(
            app: app,
            environment: environment,
            mode: mode
        ))
    }
    
    var body: some View {
        Form {
            modeHeader
            parameterSourceSection
            infrastructureSection
            featuresSection
            billingSection
            changesSection
        }
        .formStyle(.grouped)
        .onAppear {
            Task { await viewModel.loadParameters() }
        }
    }
    
    // MARK: - Mode Header
    
    private var modeHeader: some View {
        Section {
            HStack {
                Image(systemName: mode.icon)
                    .font(.title2)
                    .foregroundColor(modeColor)
                
                VStack(alignment: .leading) {
                    Text(mode.displayName)
                        .font(.headline)
                    Text(modeDescription)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                Spacer()
                
                if viewModel.isLoading {
                    ProgressView()
                        .controlSize(.small)
                }
            }
        }
    }
    
    private var modeColor: Color {
        switch mode {
        case .install: return .green
        case .update: return .blue
        case .rollback: return .orange
        }
    }
    
    private var modeDescription: String {
        switch mode {
        case .install: return "Fresh installation with default parameters"
        case .update: return "Updating existing instance with merged parameters"
        case .rollback: return "Reverting to a previous snapshot"
        }
    }
    
    // MARK: - Parameter Source Section
    
    private var parameterSourceSection: some View {
        Section("Parameters Source") {
            switch mode {
            case .install:
                Label(
                    "Using default parameters for \(viewModel.parameters.tier.displayName) tier",
                    systemImage: "doc.badge.gearshape"
                )
                .foregroundColor(.secondary)
                
                Text("AI Registry will be seeded with providers and models")
                    .font(.caption)
                    .foregroundStyle(.green)
                
            case .update:
                Label("Loaded from running instance", systemImage: "arrow.down.circle")
                    .foregroundColor(.green)
                
                if let lastFetched = viewModel.lastFetched {
                    Text("Last updated: \(lastFetched, style: .relative) ago")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                Button("Refresh from Instance") {
                    Task { await viewModel.refreshFromInstance() }
                }
                .disabled(viewModel.isLoading)
                
                Text("AI Registry will NOT be modified (admin customizations preserved)")
                    .font(.caption)
                    .foregroundStyle(.orange)
                
            case .rollback:
                if let snapshotId = viewModel.selectedSnapshotId {
                    Label("Loading from snapshot: \(snapshotId)", systemImage: "clock.arrow.circlepath")
                        .foregroundColor(.orange)
                } else {
                    Label("Select a snapshot to rollback to", systemImage: "exclamationmark.triangle")
                        .foregroundColor(.orange)
                }
            }
        }
    }
    
    // MARK: - Infrastructure Section
    
    private var infrastructureSection: some View {
        Section("Infrastructure") {
            // Tier
            Picker("Tier", selection: $viewModel.parameters.tier) {
                ForEach(TierLevel.allCases, id: \.self) { tier in
                    HStack {
                        Text(tier.displayName)
                        Text(tier.priceRange)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .tag(tier)
                }
            }
            .disabled(mode == .rollback)
            
            // Region (read-only after install)
            HStack {
                Text("Region")
                Spacer()
                Text(viewModel.parameters.region.displayName)
                    .foregroundStyle(mode == .install ? .primary : .secondary)
                if mode != .install {
                    Image(systemName: "lock.fill")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            
            if mode == .install {
                Picker("Region", selection: $viewModel.parameters.region) {
                    ForEach(AWSRegion.supported, id: \.self) { region in
                        Text(region.displayName).tag(region)
                    }
                }
            }
            
            // Multi-AZ
            Toggle("Multi-AZ Deployment", isOn: $viewModel.parameters.multiAz)
                .disabled(viewModel.parameters.tier < .growth || mode == .rollback)
            
            if viewModel.parameters.tier < .growth {
                Text("Multi-AZ requires GROWTH tier or higher")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            // Aurora Configuration
            DisclosureGroup("Database Configuration") {
                HStack {
                    Text("Instance Class")
                    Spacer()
                    Text(viewModel.parameters.auroraInstanceClass)
                        .foregroundStyle(.secondary)
                }
                
                Stepper(
                    "Min Capacity: \(viewModel.parameters.auroraMinCapacity)",
                    value: $viewModel.parameters.auroraMinCapacity,
                    in: 0...viewModel.parameters.auroraMaxCapacity
                )
                .disabled(mode == .rollback)
                
                Stepper(
                    "Max Capacity: \(viewModel.parameters.auroraMaxCapacity)",
                    value: $viewModel.parameters.auroraMaxCapacity,
                    in: viewModel.parameters.auroraMinCapacity...128
                )
                .disabled(mode == .rollback)
            }
        }
    }
    
    // MARK: - Features Section
    
    private var featuresSection: some View {
        Section("Features") {
            Toggle("Self-Hosted Models", isOn: $viewModel.parameters.enableSelfHostedModels)
                .disabled(viewModel.parameters.tier < .growth || mode == .rollback)
            
            if viewModel.parameters.tier < .growth && viewModel.parameters.enableSelfHostedModels {
                Text("Requires GROWTH tier or higher")
                    .font(.caption)
                    .foregroundStyle(.red)
            }
            
            Toggle("Multi-Region", isOn: $viewModel.parameters.enableMultiRegion)
                .disabled(viewModel.parameters.tier < .scale || mode == .rollback)
            
            if viewModel.parameters.tier < .scale && viewModel.parameters.enableMultiRegion {
                Text("Requires SCALE tier or higher")
                    .font(.caption)
                    .foregroundStyle(.red)
            }
            
            Toggle("WAF Protection", isOn: $viewModel.parameters.enableWAF)
                .disabled(mode == .rollback)
            
            Toggle("GuardDuty", isOn: $viewModel.parameters.enableGuardDuty)
                .disabled(mode == .rollback)
            
            Toggle("HIPAA Compliance", isOn: $viewModel.parameters.enableHIPAACompliance)
                .disabled(mode == .rollback)
            
            if viewModel.parameters.enableHIPAACompliance {
                Text("Enables additional encryption, audit logging, and access controls")
                    .font(.caption)
                    .foregroundStyle(.blue)
            }
        }
    }
    
    // MARK: - Billing Section
    
    private var billingSection: some View {
        Section("Billing & Markup") {
            HStack {
                Text("External Provider Markup")
                Spacer()
                TextField(
                    "Markup",
                    value: $viewModel.parameters.externalProviderMarkup,
                    format: .number.precision(.fractionLength(2))
                )
                .textFieldStyle(.roundedBorder)
                .frame(width: 80)
                .disabled(mode == .rollback)
                
                Text("(\(Int((viewModel.parameters.externalProviderMarkup - 1) * 100))%)")
                    .foregroundStyle(.secondary)
                    .frame(width: 50)
            }
            
            Text("Applied to OpenAI, Anthropic, Google, etc.")
                .font(.caption)
                .foregroundStyle(.secondary)
            
            HStack {
                Text("Self-Hosted Markup")
                Spacer()
                TextField(
                    "Markup",
                    value: $viewModel.parameters.selfHostedMarkup,
                    format: .number.precision(.fractionLength(2))
                )
                .textFieldStyle(.roundedBorder)
                .frame(width: 80)
                .disabled(mode == .rollback)
                
                Text("(\(Int((viewModel.parameters.selfHostedMarkup - 1) * 100))%)")
                    .foregroundStyle(.secondary)
                    .frame(width: 50)
            }
            
            Text("Applied to SageMaker-hosted models")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
    
    // MARK: - Changes Section (for update mode)
    
    @ViewBuilder
    private var changesSection: some View {
        if mode == .update && !viewModel.changes.isEmpty {
            Section("Changes to Apply") {
                ForEach(viewModel.changes) { change in
                    HStack {
                        Text(change.field)
                            .font(.caption)
                        Spacer()
                        Text(change.oldValue)
                            .foregroundColor(.red)
                            .strikethrough()
                            .font(.caption)
                        Image(systemName: "arrow.right")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        Text(change.newValue)
                            .foregroundColor(.green)
                            .font(.caption)
                    }
                }
            }
        }
    }
}

// MARK: - View Model

@MainActor
class ParameterEditorViewModel: ObservableObject {
    @Published var parameters: InstanceParameters
    @Published var originalParameters: InstanceParameters?
    @Published var isLoading = false
    @Published var lastFetched: Date?
    @Published var changes: [ParameterChange] = []
    @Published var selectedSnapshotId: String?
    @Published var error: String?
    
    let app: ManagedApp
    let environment: DeployEnvironment
    let mode: DeploymentMode
    
    private let deploymentService = DeploymentService()
    
    init(app: ManagedApp, environment: DeployEnvironment, mode: DeploymentMode) {
        self.app = app
        self.environment = environment
        self.mode = mode
        
        // Initialize with defaults
        let envStatus = app.environments[environment]
        let tier = TierLevel(rawValue: envStatus.tier) ?? .seed
        self.parameters = InstanceParameters.defaults(tier: tier)
    }
    
    func loadParameters() async {
        isLoading = true
        defer { isLoading = false }
        
        switch mode {
        case .install:
            // Use defaults - already set in init
            break
            
        case .update:
            await refreshFromInstance()
            
        case .rollback:
            // Will be loaded when user selects snapshot
            break
        }
    }
    
    func refreshFromInstance() async {
        isLoading = true
        defer { isLoading = false }
        
        do {
            // Get credentials
            guard let credentials = await getCredentials() else {
                error = "No credentials available"
                return
            }
            
            let fetched = try await deploymentService.fetchCurrentParameters(
                app: app,
                environment: environment,
                credentials: credentials
            )
            
            self.originalParameters = fetched
            self.parameters = fetched
            self.lastFetched = Date()
            
            updateChanges()
        } catch {
            self.error = error.localizedDescription
        }
    }
    
    func loadFromSnapshot(_ snapshotId: String) async {
        isLoading = true
        defer { isLoading = false }
        
        self.selectedSnapshotId = snapshotId
        
        // Load snapshot parameters
        // In real implementation, this would fetch from S3
    }
    
    private func getCredentials() async -> CredentialSet? {
        // Get credentials from credential service
        let credentialService = CredentialService()
        return try? await credentialService.loadCredentials().first
    }
    
    private func updateChanges() {
        guard let original = originalParameters else {
            changes = []
            return
        }
        
        var newChanges: [ParameterChange] = []
        
        if parameters.tier != original.tier {
            newChanges.append(ParameterChange(
                field: "Tier",
                oldValue: original.tier.displayName,
                newValue: parameters.tier.displayName
            ))
        }
        
        if parameters.multiAz != original.multiAz {
            newChanges.append(ParameterChange(
                field: "Multi-AZ",
                oldValue: original.multiAz ? "Enabled" : "Disabled",
                newValue: parameters.multiAz ? "Enabled" : "Disabled"
            ))
        }
        
        if parameters.enableSelfHostedModels != original.enableSelfHostedModels {
            newChanges.append(ParameterChange(
                field: "Self-Hosted Models",
                oldValue: original.enableSelfHostedModels ? "Enabled" : "Disabled",
                newValue: parameters.enableSelfHostedModels ? "Enabled" : "Disabled"
            ))
        }
        
        if parameters.enableMultiRegion != original.enableMultiRegion {
            newChanges.append(ParameterChange(
                field: "Multi-Region",
                oldValue: original.enableMultiRegion ? "Enabled" : "Disabled",
                newValue: parameters.enableMultiRegion ? "Enabled" : "Disabled"
            ))
        }
        
        if parameters.enableWAF != original.enableWAF {
            newChanges.append(ParameterChange(
                field: "WAF",
                oldValue: original.enableWAF ? "Enabled" : "Disabled",
                newValue: parameters.enableWAF ? "Enabled" : "Disabled"
            ))
        }
        
        if parameters.enableGuardDuty != original.enableGuardDuty {
            newChanges.append(ParameterChange(
                field: "GuardDuty",
                oldValue: original.enableGuardDuty ? "Enabled" : "Disabled",
                newValue: parameters.enableGuardDuty ? "Enabled" : "Disabled"
            ))
        }
        
        if parameters.enableHIPAACompliance != original.enableHIPAACompliance {
            newChanges.append(ParameterChange(
                field: "HIPAA Compliance",
                oldValue: original.enableHIPAACompliance ? "Enabled" : "Disabled",
                newValue: parameters.enableHIPAACompliance ? "Enabled" : "Disabled"
            ))
        }
        
        if parameters.externalProviderMarkup != original.externalProviderMarkup {
            newChanges.append(ParameterChange(
                field: "External Markup",
                oldValue: String(format: "%.0f%%", (original.externalProviderMarkup - 1) * 100),
                newValue: String(format: "%.0f%%", (parameters.externalProviderMarkup - 1) * 100)
            ))
        }
        
        if parameters.selfHostedMarkup != original.selfHostedMarkup {
            newChanges.append(ParameterChange(
                field: "Self-Hosted Markup",
                oldValue: String(format: "%.0f%%", (original.selfHostedMarkup - 1) * 100),
                newValue: String(format: "%.0f%%", (parameters.selfHostedMarkup - 1) * 100)
            ))
        }
        
        if parameters.auroraMinCapacity != original.auroraMinCapacity {
            newChanges.append(ParameterChange(
                field: "Aurora Min Capacity",
                oldValue: "\(original.auroraMinCapacity)",
                newValue: "\(parameters.auroraMinCapacity)"
            ))
        }
        
        if parameters.auroraMaxCapacity != original.auroraMaxCapacity {
            newChanges.append(ParameterChange(
                field: "Aurora Max Capacity",
                oldValue: "\(original.auroraMaxCapacity)",
                newValue: "\(parameters.auroraMaxCapacity)"
            ))
        }
        
        self.changes = newChanges
    }
    
    /// Get parameter changes for deployment
    func getParameterChanges() -> ParameterChanges? {
        guard let original = originalParameters else {
            return nil
        }
        
        var changes = ParameterChanges()
        
        if parameters.tier != original.tier {
            changes.tier = parameters.tier
        }
        if parameters.multiAz != original.multiAz {
            changes.multiAz = parameters.multiAz
        }
        if parameters.auroraInstanceClass != original.auroraInstanceClass {
            changes.auroraInstanceClass = parameters.auroraInstanceClass
        }
        if parameters.auroraMinCapacity != original.auroraMinCapacity {
            changes.auroraMinCapacity = parameters.auroraMinCapacity
        }
        if parameters.auroraMaxCapacity != original.auroraMaxCapacity {
            changes.auroraMaxCapacity = parameters.auroraMaxCapacity
        }
        if parameters.enableSelfHostedModels != original.enableSelfHostedModels {
            changes.enableSelfHostedModels = parameters.enableSelfHostedModels
        }
        if parameters.enableMultiRegion != original.enableMultiRegion {
            changes.enableMultiRegion = parameters.enableMultiRegion
        }
        if parameters.enableWAF != original.enableWAF {
            changes.enableWAF = parameters.enableWAF
        }
        if parameters.enableGuardDuty != original.enableGuardDuty {
            changes.enableGuardDuty = parameters.enableGuardDuty
        }
        if parameters.enableHIPAACompliance != original.enableHIPAACompliance {
            changes.enableHIPAACompliance = parameters.enableHIPAACompliance
        }
        if parameters.externalProviderMarkup != original.externalProviderMarkup {
            changes.externalProviderMarkup = parameters.externalProviderMarkup
        }
        if parameters.selfHostedMarkup != original.selfHostedMarkup {
            changes.selfHostedMarkup = parameters.selfHostedMarkup
        }
        
        return changes.isEmpty ? nil : changes
    }
}

// MARK: - Preview

#Preview {
    ParameterEditorView(
        app: ManagedApp.defaults[0],
        environment: .dev,
        mode: .install
    )
    .environmentObject(AppState())
    .frame(width: 500, height: 800)
}
