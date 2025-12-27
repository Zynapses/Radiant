// RADIANT v4.18.0 - 1Password Setup View
// Service Account token-based setup (requires Teams/Business plan)

import SwiftUI

struct OnePasswordSetupView: View {
    @EnvironmentObject var appState: AppState
    @State private var status: CredentialService.OnePasswordStatus?
    @State private var isChecking = false
    @State private var isInstalling = false
    @State private var showTokenEntry = false
    @State private var statusMessage: String?
    
    private let credentialService = CredentialService()
    private let onePasswordService = OnePasswordService()
    
    private var isInstalled: Bool { status?.installed ?? false }
    private var isConfigured: Bool { status?.signedIn ?? false }
    
    var body: some View {
        VStack(spacing: 28) {
            Spacer()
            
            // Header
            VStack(spacing: 12) {
                Image(systemName: "lock.shield.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(.blue)
                
                Text("Secure Credential Storage")
                    .font(.title)
                    .fontWeight(.semibold)
                
                Text("Your AWS credentials are protected with enterprise-grade encryption using 1Password Service Accounts.")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
            }
            
            // Plan requirement notice
            HStack(spacing: 8) {
                Image(systemName: "building.2")
                    .foregroundStyle(.orange)
                Text("Requires 1Password Teams or Business plan")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(Color.orange.opacity(0.1))
            .cornerRadius(8)
            
            // Setup Steps
            VStack(spacing: 16) {
                // Step 1: Install CLI
                SetupStepCard(
                    stepNumber: 1,
                    title: "Install 1Password CLI",
                    subtitle: isInstalled ? "Installed" : "Required for credential access",
                    isComplete: isInstalled,
                    isLoading: isInstalling,
                    buttonTitle: "Install",
                    isDisabled: false
                ) {
                    install1Password()
                }
                
                // Step 2: Enter Service Account Token
                SetupStepCard(
                    stepNumber: 2,
                    title: "Add Service Account Token",
                    subtitle: isConfigured ? "Token configured" : "Paste your service account token",
                    isComplete: isConfigured,
                    isLoading: false,
                    buttonTitle: "Add Token",
                    isDisabled: !isInstalled
                ) {
                    showTokenEntry = true
                }
            }
            .padding(.horizontal, 40)
            
            // Status message
            if let message = statusMessage {
                HStack(spacing: 8) {
                    Image(systemName: "info.circle.fill")
                        .foregroundStyle(.blue)
                    Text(message)
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
                .padding()
                .background(Color.blue.opacity(0.1))
                .cornerRadius(8)
            }
            
            Spacer()
            
            // Bottom actions
            HStack {
                Button {
                    checkStatus()
                } label: {
                    HStack(spacing: 6) {
                        if isChecking {
                            ProgressView()
                                .controlSize(.small)
                        }
                        Text("Refresh")
                    }
                }
                .buttonStyle(.bordered)
                .disabled(isChecking || isInstalling)
                
                Spacer()
                
                Link("Create Service Account", destination: URL(string: "https://developer.1password.com/docs/service-accounts/get-started/")!)
                    .font(.callout)
                
                Spacer()
                
                if isInstalled && isConfigured {
                    Button("Continue") {
                        appState.onePasswordConfigured = true
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 8)
        }
        .padding(24)
        .frame(width: 560, height: 580)
        .onAppear {
            checkStatus()
        }
        .sheet(isPresented: $showTokenEntry) {
            ServiceAccountTokenView()
                .environmentObject(appState)
                .onDisappear {
                    checkStatus()
                }
        }
    }
    
    private func checkStatus() {
        isChecking = true
        statusMessage = nil
        
        Task {
            let newStatus = await credentialService.checkOnePasswordStatus()
            await MainActor.run {
                status = newStatus
                isChecking = false
            }
        }
    }
    
    private func install1Password() {
        isInstalling = true
        statusMessage = nil
        
        Task {
            // Try Homebrew installation (works silently in background)
            let brewPaths = ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"]
            let brewPath = brewPaths.first { FileManager.default.fileExists(atPath: $0) }
            
            if let brewPath = brewPath {
                let process = Process()
                process.executableURL = URL(fileURLWithPath: brewPath)
                process.arguments = ["install", "--cask", "1password-cli"]
                process.standardOutput = FileHandle.nullDevice
                process.standardError = FileHandle.nullDevice
                
                do {
                    try process.run()
                    process.waitUntilExit()
                    
                    if process.terminationStatus == 0 {
                        await MainActor.run {
                            statusMessage = "Installation complete!"
                            isInstalling = false
                        }
                        checkStatus()
                        return
                    }
                } catch {
                    // Fall through to manual download
                }
            }
            
            // Fallback: Open download page
            await MainActor.run {
                NSWorkspace.shared.open(URL(string: "https://1password.com/downloads/mac/")!)
                statusMessage = "Download started. Click Refresh when done."
                isInstalling = false
            }
        }
    }
}

// MARK: - Setup Step Card

struct SetupStepCard: View {
    let stepNumber: Int
    let title: String
    let subtitle: String
    let isComplete: Bool
    var isLoading: Bool = false
    let buttonTitle: String
    var isDisabled: Bool = false
    let action: () -> Void
    
    var body: some View {
        HStack(spacing: 16) {
            // Step indicator
            ZStack {
                Circle()
                    .fill(isComplete ? Color.green : (isDisabled ? Color.secondary.opacity(0.2) : Color.blue))
                    .frame(width: 40, height: 40)
                
                if isComplete {
                    Image(systemName: "checkmark")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(.white)
                } else if isLoading {
                    ProgressView()
                        .controlSize(.small)
                        .tint(.white)
                } else {
                    Text("\(stepNumber)")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.white)
                }
            }
            
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(isDisabled ? .secondary : .primary)
                
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            if !isComplete && !isLoading {
                Button(buttonTitle) {
                    action()
                }
                .buttonStyle(.borderedProminent)
                .disabled(isDisabled)
            }
        }
        .padding(16)
        .background(Color(.textBackgroundColor).opacity(0.5))
        .cornerRadius(12)
    }
}

// MARK: - Service Account Token View

struct ServiceAccountTokenView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject var appState: AppState
    
    @State private var token = ""
    @State private var isConfiguring = false
    @State private var error: String?
    
    private let onePasswordService = OnePasswordService()
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Image(systemName: "key.fill")
                    .font(.title2)
                    .foregroundStyle(.blue)
                Text("Add Service Account Token")
                    .font(.headline)
                Spacer()
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title2)
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
            .padding()
            
            Divider()
            
            // Instructions
            VStack(alignment: .leading, spacing: 16) {
                Text("To get a service account token:")
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .top, spacing: 8) {
                        Text("1.")
                            .foregroundStyle(.secondary)
                        Text("Go to your 1Password account settings")
                    }
                    HStack(alignment: .top, spacing: 8) {
                        Text("2.")
                            .foregroundStyle(.secondary)
                        Text("Navigate to Developer Tools → Service Accounts")
                    }
                    HStack(alignment: .top, spacing: 8) {
                        Text("3.")
                            .foregroundStyle(.secondary)
                        Text("Create a new service account with vault access")
                    }
                    HStack(alignment: .top, spacing: 8) {
                        Text("4.")
                            .foregroundStyle(.secondary)
                        Text("Copy the token and paste it below")
                    }
                }
                .font(.callout)
                .foregroundStyle(.secondary)
                
                Link("View setup guide →", destination: URL(string: "https://developer.1password.com/docs/service-accounts/get-started/")!)
                    .font(.callout)
            }
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.textBackgroundColor).opacity(0.5))
            
            // Token input
            VStack(alignment: .leading, spacing: 8) {
                Text("Service Account Token")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                
                SecureField("Paste your token here...", text: $token)
                    .textFieldStyle(.roundedBorder)
                    .font(.system(.body, design: .monospaced))
                
                HStack(spacing: 8) {
                    Image(systemName: "lock.fill")
                        .foregroundStyle(.green)
                    Text("Token is stored securely in macOS Keychain")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(20)
            
            // Error
            if let error = error {
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.red)
                    Text(error)
                        .font(.callout)
                }
                .padding()
                .frame(maxWidth: .infinity)
                .background(Color.red.opacity(0.1))
            }
            
            Divider()
            
            // Actions
            HStack {
                Button("Cancel") {
                    dismiss()
                }
                .keyboardShortcut(.cancelAction)
                
                Spacer()
                
                Button {
                    configureToken()
                } label: {
                    HStack(spacing: 6) {
                        if isConfiguring {
                            ProgressView()
                                .controlSize(.small)
                        }
                        Text(isConfiguring ? "Validating..." : "Save Token")
                    }
                    .frame(width: 110)
                }
                .buttonStyle(.borderedProminent)
                .disabled(token.isEmpty || isConfiguring)
                .keyboardShortcut(.defaultAction)
            }
            .padding()
        }
        .frame(width: 480, height: 520)
    }
    
    private func configureToken() {
        isConfiguring = true
        error = nil
        
        Task {
            do {
                try await onePasswordService.configureServiceAccount(token: token)
                await appState.refreshOnePasswordStatus()
                await MainActor.run {
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    self.error = error.localizedDescription
                    isConfiguring = false
                }
            }
        }
    }
}

// MARK: - Add Credential Sheet (Updated for 1Password)

struct AddCredentialSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject var appState: AppState
    
    @State private var name = ""
    @State private var accessKeyId = ""
    @State private var secretAccessKey = ""
    @State private var region = "us-east-1"
    @State private var isSaving = false
    @State private var error: String?
    
    private let credentialService = CredentialService()
    
    let regions = [
        "us-east-1": "US East (N. Virginia)",
        "us-west-2": "US West (Oregon)",
        "eu-west-1": "Europe (Ireland)",
        "eu-central-1": "Europe (Frankfurt)",
        "ap-northeast-1": "Asia Pacific (Tokyo)",
        "ap-southeast-1": "Asia Pacific (Singapore)",
    ]
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Add AWS Credentials")
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
            
            // Form
            Form {
                Section {
                    TextField("Credential Name", text: $name, prompt: Text("e.g., Production AWS"))
                    
                    TextField("Access Key ID", text: $accessKeyId, prompt: Text("AKIA..."))
                        .font(.system(.body, design: .monospaced))
                    
                    SecureField("Secret Access Key", text: $secretAccessKey)
                        .font(.system(.body, design: .monospaced))
                    
                    Picker("Default Region", selection: $region) {
                        ForEach(Array(regions.keys.sorted()), id: \.self) { key in
                            Text(regions[key]!).tag(key)
                        }
                    }
                }
                
                Section {
                    HStack {
                        Image(systemName: "lock.shield.fill")
                            .foregroundStyle(.blue)
                        Text("Credentials will be stored securely in 1Password")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .formStyle(.grouped)
            
            // Error
            if let error = error {
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.red)
                    Text(error)
                        .font(.caption)
                }
                .padding()
                .frame(maxWidth: .infinity)
                .background(Color.red.opacity(0.1))
            }
            
            Divider()
            
            // Actions
            HStack {
                Button("Cancel") {
                    dismiss()
                }
                .keyboardShortcut(.cancelAction)
                
                Spacer()
                
                Button("Save to 1Password") {
                    saveCredential()
                }
                .buttonStyle(.borderedProminent)
                .disabled(name.isEmpty || accessKeyId.isEmpty || secretAccessKey.isEmpty || isSaving)
                .keyboardShortcut(.defaultAction)
            }
            .padding()
        }
        .frame(width: 450, height: 400)
    }
    
    private func saveCredential() {
        isSaving = true
        error = nil
        
        Task {
            do {
                let credential = CredentialSet(
                    id: UUID().uuidString,
                    name: name,
                    accessKeyId: accessKeyId,
                    secretAccessKey: secretAccessKey,
                    region: region,
                    accountId: nil,
                    environment: .shared,
                    createdAt: Date(),
                    lastValidatedAt: nil,
                    isValid: nil
                )
                
                try await credentialService.saveCredential(credential)
                
                // Reload credentials
                let credentials = try await credentialService.loadCredentials()
                
                await MainActor.run {
                    appState.credentials = credentials
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    self.error = error.localizedDescription
                    isSaving = false
                }
            }
        }
    }
}

#Preview {
    OnePasswordSetupView()
        .environmentObject(AppState())
}
