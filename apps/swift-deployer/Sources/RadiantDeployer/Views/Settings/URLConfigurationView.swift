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
            } header: {
                Text("Platform URLs")
            } footer: {
                Text("These URLs define where your RADIANT platform components are accessible.")
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
    
    // Dojo URL
    @Published var dojoUrl = ""
    
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
