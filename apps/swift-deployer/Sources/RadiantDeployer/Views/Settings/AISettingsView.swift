import SwiftUI

/// AI Assistant settings view per PROMPT-33 spec
struct AISettingsView: View {
    @State private var apiKey = ""
    @State private var isEnabled = true
    @State private var connectionStatus: ConnectionStatus = .unknown
    @State private var isTestingConnection = false
    @State private var showApiKeySheet = false
    @State private var lastCheckTime: Date?
    
    enum ConnectionStatus {
        case unknown
        case connected
        case disconnected
        case error(String)
        
        var color: Color {
            switch self {
            case .unknown: return .gray
            case .connected: return .green
            case .disconnected: return .orange
            case .error: return .red
            }
        }
        
        var icon: String {
            switch self {
            case .unknown: return "questionmark.circle"
            case .connected: return "checkmark.circle.fill"
            case .disconnected: return "exclamationmark.circle"
            case .error: return "xmark.circle.fill"
            }
        }
        
        var text: String {
            switch self {
            case .unknown: return "Unknown"
            case .connected: return "Connected"
            case .disconnected: return "Disconnected"
            case .error(let msg): return "Error: \(msg)"
            }
        }
    }
    
    var body: some View {
        Form {
            // Connection Status Section
            Section {
                HStack {
                    Image(systemName: connectionStatus.icon)
                        .foregroundStyle(connectionStatus.color)
                        .font(.title2)
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Claude API")
                            .font(.headline)
                        Text(connectionStatus.text)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    
                    Spacer()
                    
                    if isTestingConnection {
                        ProgressView()
                            .scaleEffect(0.8)
                    } else {
                        Button("Test") {
                            Task {
                                await testConnection()
                            }
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                    }
                }
                
                if let lastCheck = lastCheckTime {
                    Text("Last checked: \(lastCheck.formatted(date: .omitted, time: .shortened))")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            } header: {
                Text("Connection Status")
            }
            
            // Enable/Disable Section
            Section {
                Toggle("Enable AI Assistant", isOn: $isEnabled)
                
                if !isEnabled {
                    HStack {
                        Image(systemName: "info.circle")
                            .foregroundStyle(.blue)
                        Text("When disabled, static explanations will be used instead of AI-generated content.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            } header: {
                Text("AI Features")
            } footer: {
                Text("The AI assistant provides deployment explanations, error translations, and recovery recommendations.")
            }
            
            // API Key Section
            Section {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("API Key")
                            .font(.subheadline)
                        
                        if hasApiKey {
                            Text("••••••••••••\(maskedApiKey)")
                                .font(.system(.caption, design: .monospaced))
                                .foregroundStyle(.secondary)
                        } else {
                            Text("Not configured")
                                .font(.caption)
                                .foregroundStyle(.orange)
                        }
                    }
                    
                    Spacer()
                    
                    Button(hasApiKey ? "Update" : "Add") {
                        showApiKeySheet = true
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }
                
                if hasApiKey {
                    Button(role: .destructive) {
                        Task {
                            await deleteApiKey()
                        }
                    } label: {
                        HStack {
                            Image(systemName: "trash")
                            Text("Remove API Key")
                        }
                    }
                }
            } header: {
                Text("Authentication")
            } footer: {
                Text("Your API key is stored securely in the macOS Keychain.")
            }
            
            // Model Info Section
            Section {
                HStack {
                    Text("Model")
                    Spacer()
                    Text("claude-3-5-sonnet-20241022")
                        .font(.system(.caption, design: .monospaced))
                        .foregroundStyle(.secondary)
                }
                
                HStack {
                    Text("Provider")
                    Spacer()
                    Text("Anthropic")
                        .foregroundStyle(.secondary)
                }
                
                HStack {
                    Text("Check Interval")
                    Spacer()
                    Text("60 seconds")
                        .foregroundStyle(.secondary)
                }
            } header: {
                Text("Configuration")
            }
            
            // Features Section
            Section {
                FeatureRow(
                    icon: "text.bubble",
                    title: "Auto-Explain",
                    description: "Explains deployment phases in plain language",
                    isEnabled: isEnabled
                )
                
                FeatureRow(
                    icon: "exclamationmark.triangle",
                    title: "Error Translation",
                    description: "Converts technical errors to user-friendly messages",
                    isEnabled: isEnabled
                )
                
                FeatureRow(
                    icon: "lightbulb",
                    title: "Recovery Recommendations",
                    description: "Suggests rollback vs retry with confidence scores",
                    isEnabled: isEnabled
                )
                
                FeatureRow(
                    icon: "doc.text",
                    title: "Release Notes",
                    description: "Generates release notes from commits",
                    isEnabled: isEnabled
                )
                
                FeatureRow(
                    icon: "gauge",
                    title: "Risk Assessment",
                    description: "Analyzes deployment complexity",
                    isEnabled: isEnabled
                )
            } header: {
                Text("AI Features")
            }
        }
        .formStyle(.grouped)
        .sheet(isPresented: $showApiKeySheet) {
            ApiKeySheet(
                onSave: { key in
                    Task {
                        await saveApiKey(key)
                    }
                }
            )
        }
        .task {
            await loadInitialState()
        }
    }
    
    private var hasApiKey: Bool {
        !apiKey.isEmpty
    }
    
    private var maskedApiKey: String {
        String(apiKey.suffix(4))
    }
    
    private func loadInitialState() async {
        let ai = AIAssistantService.shared
        if let key = await ai.getApiKey() {
            apiKey = key
        }
        await testConnection()
    }
    
    private func testConnection() async {
        isTestingConnection = true
        let ai = AIAssistantService.shared
        let connected = await ai.checkConnection()
        connectionStatus = connected ? .connected : .disconnected
        lastCheckTime = Date()
        isTestingConnection = false
    }
    
    private func saveApiKey(_ key: String) async {
        let ai = AIAssistantService.shared
        do {
            try await ai.saveApiKey(key)
            apiKey = key
            await testConnection()
        } catch {
            connectionStatus = .error(error.localizedDescription)
        }
    }
    
    private func deleteApiKey() async {
        let ai = AIAssistantService.shared
        await ai.deleteApiKey()
        apiKey = ""
        connectionStatus = .disconnected
    }
}

struct FeatureRow: View {
    let icon: String
    let title: String
    let description: String
    let isEnabled: Bool
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(isEnabled ? .blue : .gray)
                .frame(width: 24)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .foregroundStyle(isEnabled ? .primary : .secondary)
                Text(description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            if isEnabled {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(.green)
            } else {
                Text("Fallback")
                    .font(.caption2)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.orange.opacity(0.2))
                    .foregroundStyle(.orange)
                    .cornerRadius(4)
            }
        }
    }
}

struct ApiKeySheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var apiKey = ""
    
    let onSave: (String) -> Void
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Configure API Key")
                    .font(.headline)
                Spacer()
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
            .padding()
            
            Divider()
            
            // Content
            VStack(alignment: .leading, spacing: 16) {
                Text("Enter your Anthropic API key to enable AI features.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                
                SecureField("sk-ant-...", text: $apiKey)
                    .textFieldStyle(.roundedBorder)
                    .font(.system(.body, design: .monospaced))
                
                HStack {
                    Image(systemName: "lock.shield")
                        .foregroundStyle(.green)
                    Text("Your API key is stored securely in the macOS Keychain and never sent to our servers.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                Link(destination: URL(string: "https://console.anthropic.com/settings/keys")!) {
                    HStack {
                        Image(systemName: "arrow.up.right.square")
                        Text("Get an API key from Anthropic")
                    }
                    .font(.caption)
                }
            }
            .padding()
            
            Spacer()
            
            Divider()
            
            // Actions
            HStack {
                Button("Cancel") {
                    dismiss()
                }
                
                Spacer()
                
                Button("Save") {
                    onSave(apiKey)
                    dismiss()
                }
                .buttonStyle(.borderedProminent)
                .disabled(apiKey.isEmpty || !apiKey.hasPrefix("sk-"))
            }
            .padding()
        }
        .frame(width: 400, height: 300)
    }
}

#Preview {
    AISettingsView()
}
