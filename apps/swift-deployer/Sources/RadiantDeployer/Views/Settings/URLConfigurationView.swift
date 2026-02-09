import SwiftUI

// MARK: - URL Configuration View

/// Manages platform URLs including Status Page, Think Tank, Admin Dashboard, and API endpoints.
/// These URLs are paralleled in both the Deployer and Admin App.
struct URLConfigurationView: View {
    @StateObject private var viewModel = URLConfigurationViewModel()
    @State private var showSaveConfirmation = false
    
    var body: some View {
        Form {
            // Platform URLs Section
            Section {
                URLInputField(
                    label: "Status Page URL",
                    placeholder: "https://status.example.com",
                    value: $viewModel.statusPageUrl,
                    helpText: "Public read-only system health status page",
                    icon: "globe"
                )
                
                URLInputField(
                    label: "Think Tank URL",
                    placeholder: "https://thinktank.example.com",
                    value: $viewModel.thinkTankUrl,
                    helpText: "Collaborative AI workspace",
                    icon: "brain.head.profile"
                )
                
                URLInputField(
                    label: "Admin Dashboard URL",
                    placeholder: "https://admin.example.com",
                    value: $viewModel.adminDashboardUrl,
                    helpText: "Administrative interface",
                    icon: "gearshape.2"
                )
                
                URLInputField(
                    label: "Aurelius Dojo URL",
                    placeholder: "https://dojo.example.com",
                    value: $viewModel.dojoUrl,
                    helpText: "Thematic mastery training platform with spaced repetition and competency mapping",
                    icon: "flame"
                )
                
                URLInputField(
                    label: "Cato Trainer URL",
                    placeholder: "https://cato.example.com",
                    value: $viewModel.catoTrainerUrl,
                    helpText: "AI-powered knowledge base with grounded Q&A, semantic search, and citation-backed responses",
                    icon: "shield.checkered"
                )
                
                URLInputField(
                    label: "Curator URL",
                    placeholder: "https://curator.example.com",
                    value: $viewModel.curatorUrl,
                    helpText: "Knowledge graph curation, fact verification, and conflict resolution",
                    icon: "book.pages"
                )
            } header: {
                Text("Platform URLs")
            } footer: {
                Text("These URLs define where your RADIANT platform components are accessible.")
            }
            
            // Genesis / OMEGA Section
            Section {
                URLInputField(
                    label: "Genesis Lab URL",
                    placeholder: "https://genesis.example.com",
                    value: $viewModel.genesisLabUrl,
                    helpText: "OMEGA brain monitoring dashboard with thermal visualization and Cortex Explorer",
                    icon: "waveform.path.ecg"
                )
                
                URLInputField(
                    label: "Genesis Forge URL",
                    placeholder: "https://forge.example.com",
                    value: $viewModel.genesisForgeUrl,
                    helpText: "OMEGA firmware creation tool for .bio files with Helix rules and personality traits",
                    icon: "hammer.fill"
                )
                
                URLInputField(
                    label: "OMEGA API URL",
                    placeholder: "https://omega.example.com",
                    value: $viewModel.omegaApiUrl,
                    helpText: "Bio-mimetic AI inference API with Time Warp and shadow mode",
                    icon: "brain"
                )
            } header: {
                Text("Genesis / OMEGA")
            } footer: {
                Text("Bio-mimetic AI organism monitoring and firmware management (Scale tier and above).")
            }
            
            // API Configuration Section
            Section {
                URLInputField(
                    label: "API Base URL",
                    placeholder: "https://api.example.com",
                    value: $viewModel.apiBaseUrl,
                    helpText: "RADIANT Service API endpoint",
                    icon: "server.rack"
                )
                
                URLInputField(
                    label: "WebSocket URL",
                    placeholder: "wss://ws.example.com",
                    value: $viewModel.websocketUrl,
                    helpText: "Real-time communication endpoint",
                    icon: "bolt.horizontal"
                )
            } header: {
                Text("API Configuration")
            }
            
            // CloudFront Distribution Section
            Section {
                URLInputField(
                    label: "CloudFront Distribution",
                    placeholder: "https://d123456789.cloudfront.net",
                    value: $viewModel.cloudfrontUrl,
                    helpText: "CDN distribution for static assets",
                    icon: "cloud"
                )
                
                URLInputField(
                    label: "S3 Assets Bucket URL",
                    placeholder: "https://assets.s3.amazonaws.com",
                    value: $viewModel.s3AssetsUrl,
                    helpText: "Static asset storage",
                    icon: "externaldrive.connected.to.line.below"
                )
            } header: {
                Text("CDN & Storage")
            }
            
            // Domain Configuration
            Section {
                HStack {
                    Text("Primary Domain")
                    Spacer()
                    TextField("example.com", text: $viewModel.primaryDomain)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 250)
                }
                
                Toggle("Use Custom Domain", isOn: $viewModel.useCustomDomain)
                
                if viewModel.useCustomDomain {
                    URLInputField(
                        label: "Custom Domain",
                        placeholder: "custom.example.com",
                        value: $viewModel.customDomain,
                        helpText: "Custom domain for platform access",
                        icon: "link"
                    )
                }
            } header: {
                Text("Domain Configuration")
            }
            
            // Validation Status
            if viewModel.isValidating {
                Section {
                    HStack {
                        ProgressView()
                            .scaleEffect(0.8)
                        Text("Validating URLs...")
                            .foregroundStyle(.secondary)
                    }
                }
            } else if !viewModel.validationErrors.isEmpty {
                Section {
                    ForEach(viewModel.validationErrors, id: \.self) { error in
                        HStack {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundStyle(.orange)
                            Text(error)
                                .font(.caption)
                        }
                    }
                } header: {
                    Text("Validation Issues")
                }
            }
        }
        .formStyle(.grouped)
        .navigationTitle("URL Configuration")
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                Button {
                    Task { await viewModel.validateUrls() }
                } label: {
                    Label("Validate", systemImage: "checkmark.circle")
                }
                .disabled(viewModel.isValidating)
                
                Button {
                    Task {
                        await viewModel.saveConfiguration()
                        showSaveConfirmation = true
                    }
                } label: {
                    Label("Save", systemImage: "square.and.arrow.down")
                }
                .disabled(viewModel.isValidating || viewModel.isSaving)
            }
        }
        .alert("Configuration Saved", isPresented: $showSaveConfirmation) {
            Button("OK", role: .cancel) { }
        } message: {
            Text("URL configuration has been saved and will be used for future deployments.")
        }
        .task {
            await viewModel.loadConfiguration()
        }
    }
}

// MARK: - URL Input Field

struct URLInputField: View {
    let label: String
    let placeholder: String
    @Binding var value: String
    let helpText: String
    let icon: String
    
    @State private var isValid: Bool? = nil
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .foregroundStyle(.secondary)
                    .frame(width: 20)
                
                Text(label)
                
                Spacer()
                
                if let isValid = isValid {
                    Image(systemName: isValid ? "checkmark.circle.fill" : "xmark.circle.fill")
                        .foregroundStyle(isValid ? .green : .red)
                }
            }
            
            TextField(placeholder, text: $value)
                .textFieldStyle(.roundedBorder)
                .onChange(of: value) { _, newValue in
                    validateUrl(newValue)
                }
            
            Text(helpText)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
    
    private func validateUrl(_ url: String) {
        guard !url.isEmpty else {
            isValid = nil
            return
        }
        
        if let urlObj = URL(string: url), urlObj.scheme != nil, urlObj.host != nil {
            isValid = true
        } else {
            isValid = false
        }
    }
}

// MARK: - View Model

@MainActor
class URLConfigurationViewModel: ObservableObject {
    // Platform URLs
    @Published var statusPageUrl = ""
    @Published var thinkTankUrl = ""
    @Published var adminDashboardUrl = ""
    
    // App URLs
    @Published var dojoUrl = ""
    @Published var catoTrainerUrl = ""
    @Published var curatorUrl = ""
    
    // Genesis / OMEGA URLs
    @Published var genesisLabUrl = ""
    @Published var genesisForgeUrl = ""
    @Published var omegaApiUrl = ""
    
    // API Configuration
    @Published var apiBaseUrl = ""
    @Published var websocketUrl = ""
    
    // CDN & Storage
    @Published var cloudfrontUrl = ""
    @Published var s3AssetsUrl = ""
    
    // Domain Configuration
    @Published var primaryDomain = ""
    @Published var useCustomDomain = false
    @Published var customDomain = ""
    
    // State
    @Published var isValidating = false
    @Published var isSaving = false
    @Published var validationErrors: [String] = []
    
    private let configKey = "radiant.url.configuration"
    
    func loadConfiguration() async {
        // Load from UserDefaults or secure storage
        if let data = UserDefaults.standard.data(forKey: configKey),
           let config = try? JSONDecoder().decode(URLConfiguration.self, from: data) {
            statusPageUrl = config.statusPageUrl
            thinkTankUrl = config.thinkTankUrl
            adminDashboardUrl = config.adminDashboardUrl
            dojoUrl = config.dojoUrl ?? ""
            catoTrainerUrl = config.catoTrainerUrl ?? ""
            curatorUrl = config.curatorUrl ?? ""
            genesisLabUrl = config.genesisLabUrl ?? ""
            genesisForgeUrl = config.genesisForgeUrl ?? ""
            omegaApiUrl = config.omegaApiUrl ?? ""
            apiBaseUrl = config.apiBaseUrl
            websocketUrl = config.websocketUrl
            cloudfrontUrl = config.cloudfrontUrl
            s3AssetsUrl = config.s3AssetsUrl
            primaryDomain = config.primaryDomain
            useCustomDomain = config.useCustomDomain
            customDomain = config.customDomain ?? ""
        }
    }
    
    func validateUrls() async {
        isValidating = true
        validationErrors = []
        defer { isValidating = false }
        
        // Validate each URL
        let urlsToValidate = [
            ("Status Page", statusPageUrl),
            ("Think Tank", thinkTankUrl),
            ("Admin Dashboard", adminDashboardUrl),
            ("Aurelius Dojo", dojoUrl),
            ("Cato Trainer", catoTrainerUrl),
            ("Curator", curatorUrl),
            ("Genesis Lab", genesisLabUrl),
            ("Genesis Forge", genesisForgeUrl),
            ("OMEGA API", omegaApiUrl),
            ("API Base", apiBaseUrl),
            ("WebSocket", websocketUrl),
        ]
        
        for (name, url) in urlsToValidate {
            if !url.isEmpty {
                if URL(string: url) == nil {
                    validationErrors.append("\(name) URL is invalid")
                } else if !url.hasPrefix("https://") && !url.hasPrefix("wss://") {
                    validationErrors.append("\(name) should use HTTPS/WSS")
                }
            }
        }
        
        // Check domain consistency
        if !primaryDomain.isEmpty {
            let urls = [statusPageUrl, thinkTankUrl, adminDashboardUrl, apiBaseUrl]
            for url in urls where !url.isEmpty {
                if !url.contains(primaryDomain) {
                    validationErrors.append("Some URLs don't match the primary domain '\(primaryDomain)'")
                    break
                }
            }
        }
    }
    
    func saveConfiguration() async {
        isSaving = true
        defer { isSaving = false }
        
        let config = URLConfiguration(
            statusPageUrl: statusPageUrl,
            thinkTankUrl: thinkTankUrl,
            adminDashboardUrl: adminDashboardUrl,
            dojoUrl: dojoUrl.isEmpty ? nil : dojoUrl,
            catoTrainerUrl: catoTrainerUrl.isEmpty ? nil : catoTrainerUrl,
            curatorUrl: curatorUrl.isEmpty ? nil : curatorUrl,
            genesisLabUrl: genesisLabUrl.isEmpty ? nil : genesisLabUrl,
            genesisForgeUrl: genesisForgeUrl.isEmpty ? nil : genesisForgeUrl,
            omegaApiUrl: omegaApiUrl.isEmpty ? nil : omegaApiUrl,
            apiBaseUrl: apiBaseUrl,
            websocketUrl: websocketUrl,
            cloudfrontUrl: cloudfrontUrl,
            s3AssetsUrl: s3AssetsUrl,
            primaryDomain: primaryDomain,
            useCustomDomain: useCustomDomain,
            customDomain: useCustomDomain ? customDomain : nil
        )
        
        if let data = try? JSONEncoder().encode(config) {
            UserDefaults.standard.set(data, forKey: configKey)
        }
    }
}

// MARK: - Configuration Model

struct URLConfiguration: Codable {
    var statusPageUrl: String
    var thinkTankUrl: String
    var adminDashboardUrl: String
    var dojoUrl: String?
    var catoTrainerUrl: String?
    var curatorUrl: String?
    var genesisLabUrl: String?
    var genesisForgeUrl: String?
    var omegaApiUrl: String?
    var apiBaseUrl: String
    var websocketUrl: String
    var cloudfrontUrl: String
    var s3AssetsUrl: String
    var primaryDomain: String
    var useCustomDomain: Bool
    var customDomain: String?
    
    static var `default`: URLConfiguration {
        URLConfiguration(
            statusPageUrl: "https://status.{{RADIANT_DOMAIN}}",
            thinkTankUrl: "https://thinktank.{{RADIANT_DOMAIN}}",
            adminDashboardUrl: "https://admin.{{RADIANT_DOMAIN}}",
            dojoUrl: "https://dojo.{{RADIANT_DOMAIN}}",
            catoTrainerUrl: "https://cato.{{RADIANT_DOMAIN}}",
            curatorUrl: "https://curator.{{RADIANT_DOMAIN}}",
            genesisLabUrl: "https://genesis.{{RADIANT_DOMAIN}}",
            genesisForgeUrl: "https://forge.{{RADIANT_DOMAIN}}",
            omegaApiUrl: "https://omega.{{RADIANT_DOMAIN}}",
            apiBaseUrl: "https://api.{{RADIANT_DOMAIN}}",
            websocketUrl: "wss://ws.{{RADIANT_DOMAIN}}",
            cloudfrontUrl: "",
            s3AssetsUrl: "",
            primaryDomain: "{{RADIANT_DOMAIN}}",
            useCustomDomain: false,
            customDomain: nil
        )
    }
}

#Preview {
    URLConfigurationView()
        .frame(width: 600, height: 800)
}
