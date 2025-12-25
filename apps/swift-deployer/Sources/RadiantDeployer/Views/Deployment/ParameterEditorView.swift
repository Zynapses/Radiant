// RADIANT v4.18.0 - Parameter Editor View
// UI for editing deployment parameters based on deployment mode

import SwiftUI

// MARK: - Parameter Editor View

struct ParameterEditorView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var viewModel: ParameterEditorViewModel
    
    let app: ManagedApp
    let environment: DeployEnvironment
    let mode: DeploymentMode
    let onSave: (InstanceParameters) -> Void
    
    init(
        app: ManagedApp,
        environment: DeployEnvironment,
        mode: DeploymentMode,
        onSave: @escaping (InstanceParameters) -> Void
    ) {
        self.app = app
        self.environment = environment
        self.mode = mode
        self.onSave = onSave
        self._viewModel = StateObject(wrappedValue: ParameterEditorViewModel(
            app: app,
            environment: environment,
            mode: mode
        ))
    }
    
    var body: some View {
        Form {
            // Header showing mode
            modeHeader
            
            // Source of parameters
            parameterSourceSection
            
            // Infrastructure parameters
            infrastructureSection
            
            // Features section
            featuresSection
            
            // Billing section
            billingSection
            
            // Changes summary (for update mode)
            if mode == .update && !viewModel.changes.isEmpty {
                changesSection
            }
            
            // Action buttons
            actionSection
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
                    .foregroundColor(modeColor)
                    .font(.title2)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(mode.displayName)
                        .font(.headline)
                    Text(modeDescription)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                if viewModel.isLoading {
                    ProgressView()
                        .scaleEffect(0.8)
                }
            }
            .padding(.vertical, 4)
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
        case .install:
            return "Fresh installation using default parameters"
        case .update:
            return "Update preserving existing configuration"
        case .rollback:
            return "Restore from previous snapshot"
        }
    }
    
    // MARK: - Parameter Source Section
    
    private var parameterSourceSection: some View {
        Section("Parameters Source") {
            if mode == .install {
                Label(
                    "Using default parameters for \(viewModel.parameters.tier.displayName) tier",
                    systemImage: "doc.badge.gearshape"
                )
                .foregroundColor(.secondary)
                
                Text("Parameters will be initialized with tier-appropriate defaults. You can customize these values below.")
                    .font(.caption)
                    .foregroundColor(.secondary)
            } else {
                Label("Loaded from running instance", systemImage: "arrow.down.circle")
                    .foregroundColor(.green)
                
                if let lastFetched = viewModel.lastFetched {
                    Text("Last updated: \(lastFetched, style: .relative) ago")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Button(action: {
                    Task { await viewModel.refreshFromInstance() }
                }) {
                    Label("Refresh from Instance", systemImage: "arrow.clockwise")
                }
                .disabled(viewModel.isLoading)
            }
        }
    }
    
    // MARK: - Infrastructure Section
    
    private var infrastructureSection: some View {
        Section("Infrastructure") {
            // Tier Picker
            Picker("Tier", selection: $viewModel.parameters.tier) {
                ForEach(TierLevel.allCases, id: \.self) { tier in
                    HStack {
                        Text(tier.displayName)
                        Spacer()
                        Text(tier.priceRange)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .tag(tier)
                }
            }
            .disabled(mode == .rollback)
            
            // Region Picker
            Picker("Region", selection: $viewModel.parameters.region) {
                ForEach(AWSRegion.supported, id: \.self) { region in
                    Text(region.displayName).tag(region)
                }
            }
            .disabled(mode != .install)
            
            if mode != .install {
                Text("Region cannot be changed after initial installation")
                    .font(.caption)
                    .foregroundColor(.orange)
            }
            
            // Multi-AZ Toggle
            Toggle("Multi-AZ Deployment", isOn: $viewModel.parameters.multiAz)
                .disabled(viewModel.parameters.tier < .growth)
            
            if viewModel.parameters.tier < .growth {
                Text("Multi-AZ requires GROWTH tier or higher")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            // VPC CIDR
            LabeledContent("VPC CIDR") {
                TextField("CIDR", text: $viewModel.parameters.vpcCidr)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 150)
                    .disabled(mode != .install)
            }
            
            // Aurora Configuration
            DisclosureGroup("Database Configuration") {
                LabeledContent("Instance Class") {
                    TextField("Instance", text: $viewModel.parameters.auroraInstanceClass)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 150)
                }
                
                LabeledContent("Min Capacity") {
                    Stepper(
                        value: $viewModel.parameters.auroraMinCapacity,
                        in: 0...viewModel.parameters.auroraMaxCapacity
                    ) {
                        Text("\(viewModel.parameters.auroraMinCapacity) ACU")
                    }
                }
                
                LabeledContent("Max Capacity") {
                    Stepper(
                        value: $viewModel.parameters.auroraMaxCapacity,
                        in: viewModel.parameters.auroraMinCapacity...128
                    ) {
                        Text("\(viewModel.parameters.auroraMaxCapacity) ACU")
                    }
                }
            }
        }
    }
    
    // MARK: - Features Section
    
    private var featuresSection: some View {
        Section("Features") {
            Toggle("Self-Hosted Models", isOn: $viewModel.parameters.enableSelfHostedModels)
                .disabled(viewModel.parameters.tier < .growth)
            
            if viewModel.parameters.enableSelfHostedModels {
                Text("Enables 56 self-hosted AI models on SageMaker")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Toggle("Multi-Region", isOn: $viewModel.parameters.enableMultiRegion)
                .disabled(viewModel.parameters.tier < .scale)
            
            Toggle("WAF Protection", isOn: $viewModel.parameters.enableWAF)
            
            if viewModel.parameters.enableWAF {
                Text("Web Application Firewall for API protection")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Toggle("GuardDuty", isOn: $viewModel.parameters.enableGuardDuty)
            
            Toggle("HIPAA Compliance", isOn: $viewModel.parameters.enableHIPAACompliance)
            
            if viewModel.parameters.enableHIPAACompliance {
                VStack(alignment: .leading, spacing: 4) {
                    Text("⚠️ HIPAA compliance requires additional configuration")
                        .font(.caption)
                        .foregroundColor(.orange)
                    Text("Enables encryption, audit logging, and access controls")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
    }
    
    // MARK: - Billing Section
    
    private var billingSection: some View {
        Section("Billing Configuration") {
            LabeledContent("External Provider Markup") {
                HStack {
                    TextField(
                        "Markup",
                        value: $viewModel.parameters.externalProviderMarkup,
                        format: .number.precision(.fractionLength(2))
                    )
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 80)
                    
                    Text("(\(Int((viewModel.parameters.externalProviderMarkup - 1) * 100))%)")
                        .foregroundColor(.secondary)
                }
            }
            
            Text("Applied to OpenAI, Anthropic, Google, and other external providers")
                .font(.caption)
                .foregroundColor(.secondary)
            
            LabeledContent("Self-Hosted Markup") {
                HStack {
                    TextField(
                        "Markup",
                        value: $viewModel.parameters.selfHostedMarkup,
                        format: .number.precision(.fractionLength(2))
                    )
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 80)
                    
                    Text("(\(Int((viewModel.parameters.selfHostedMarkup - 1) * 100))%)")
                        .foregroundColor(.secondary)
                }
            }
            
            Text("Applied to self-hosted models running on SageMaker")
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
    
    // MARK: - Changes Section
    
    private var changesSection: some View {
        Section("Changes to Apply") {
            ForEach(viewModel.changes) { change in
                HStack {
                    Text(change.field)
                        .fontWeight(.medium)
                    
                    Spacer()
                    
                    Text(change.oldValue)
                        .foregroundColor(.red)
                        .strikethrough()
                    
                    Image(systemName: "arrow.right")
                        .foregroundColor(.secondary)
                        .font(.caption)
                    
                    Text(change.newValue)
                        .foregroundColor(.green)
                }
                .font(.caption)
            }
        }
    }
    
    // MARK: - Action Section
    
    private var actionSection: some View {
        Section {
            HStack {
                if mode == .update && !viewModel.changes.isEmpty {
                    Button("Reset Changes") {
                        Task { await viewModel.refreshFromInstance() }
                    }
                    .buttonStyle(.bordered)
                }
                
                Spacer()
                
                Button(action: {
                    onSave(viewModel.parameters)
                }) {
                    Label(
                        mode == .install ? "Continue with Installation" : "Apply Changes",
                        systemImage: "checkmark.circle"
                    )
                }
                .buttonStyle(.borderedProminent)
                .disabled(viewModel.isLoading)
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
    @Published var error: String?
    
    let app: ManagedApp
    let environment: DeployEnvironment
    let mode: DeploymentMode
    
    private let deploymentService = DeploymentService()
    
    init(app: ManagedApp, environment: DeployEnvironment, mode: DeploymentMode) {
        self.app = app
        self.environment = environment
        self.mode = mode
        
        // Initialize with tier-appropriate defaults
        let tier = TierLevel(rawValue: app.environments[environment].tier) ?? .seed
        self.parameters = InstanceParameters.defaults(tier: tier)
    }
    
    func loadParameters() async {
        isLoading = true
        defer { isLoading = false }
        
        switch mode {
        case .install:
            // Use defaults - already set in init
            // Just update tier based on app configuration
            let tier = TierLevel(rawValue: app.environments[environment].tier) ?? .seed
            parameters = InstanceParameters.defaults(tier: tier)
            
        case .update, .rollback:
            // Fetch from running instance
            await refreshFromInstance()
        }
    }
    
    func refreshFromInstance() async {
        isLoading = true
        defer { isLoading = false }
        error = nil
        
        do {
            // Load credentials from credential service
            let credentialService = CredentialService()
            let allCredentials = try await credentialService.loadCredentials()
            
            // Find credentials for this app (use first available for now)
            guard let credentials = allCredentials.first else {
                self.error = "No AWS credentials configured"
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
        
        if parameters.enableWAF != original.enableWAF {
            newChanges.append(ParameterChange(
                field: "WAF Protection",
                oldValue: original.enableWAF ? "Enabled" : "Disabled",
                newValue: parameters.enableWAF ? "Enabled" : "Disabled"
            ))
        }
        
        if parameters.enableHIPAACompliance != original.enableHIPAACompliance {
            newChanges.append(ParameterChange(
                field: "HIPAA Compliance",
                oldValue: original.enableHIPAACompliance ? "Enabled" : "Disabled",
                newValue: parameters.enableHIPAACompliance ? "Enabled" : "Disabled"
            ))
        }
        
        if abs(parameters.externalProviderMarkup - original.externalProviderMarkup) > 0.001 {
            newChanges.append(ParameterChange(
                field: "External Markup",
                oldValue: String(format: "%.0f%%", (original.externalProviderMarkup - 1) * 100),
                newValue: String(format: "%.0f%%", (parameters.externalProviderMarkup - 1) * 100)
            ))
        }
        
        if abs(parameters.selfHostedMarkup - original.selfHostedMarkup) > 0.001 {
            newChanges.append(ParameterChange(
                field: "Self-Hosted Markup",
                oldValue: String(format: "%.0f%%", (original.selfHostedMarkup - 1) * 100),
                newValue: String(format: "%.0f%%", (parameters.selfHostedMarkup - 1) * 100)
            ))
        }
        
        if parameters.auroraMinCapacity != original.auroraMinCapacity {
            newChanges.append(ParameterChange(
                field: "Aurora Min Capacity",
                oldValue: "\(original.auroraMinCapacity) ACU",
                newValue: "\(parameters.auroraMinCapacity) ACU"
            ))
        }
        
        if parameters.auroraMaxCapacity != original.auroraMaxCapacity {
            newChanges.append(ParameterChange(
                field: "Aurora Max Capacity",
                oldValue: "\(original.auroraMaxCapacity) ACU",
                newValue: "\(parameters.auroraMaxCapacity) ACU"
            ))
        }
        
        self.changes = newChanges
    }
}

// MARK: - Preview

#if DEBUG
struct ParameterEditorView_Previews: PreviewProvider {
    static var previews: some View {
        ParameterEditorView(
            app: ManagedApp.preview,
            environment: .development,
            mode: .install,
            onSave: { _ in }
        )
        .environmentObject(AppState())
        .frame(width: 600, height: 800)
    }
}
#endif
