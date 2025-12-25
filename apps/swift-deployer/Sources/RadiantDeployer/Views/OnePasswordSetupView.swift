// RADIANT v4.18.0 - 1Password Setup View
// Guides users through 1Password CLI installation and configuration

import SwiftUI

struct OnePasswordSetupView: View {
    @EnvironmentObject var appState: AppState
    @State private var status: CredentialService.OnePasswordStatus?
    @State private var isChecking = false
    @State private var error: String?
    
    private let credentialService = CredentialService()
    
    var body: some View {
        VStack(spacing: 24) {
            // Header
            VStack(spacing: 8) {
                Image(systemName: "lock.shield")
                    .font(.system(size: 48))
                    .foregroundStyle(.blue)
                
                Text("1Password Required")
                    .font(.title)
                    .fontWeight(.semibold)
                
                Text("RADIANT uses 1Password for compliance-certified credential storage (SOC2, HIPAA)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            .padding(.top)
            
            Divider()
            
            // Status Checklist
            VStack(alignment: .leading, spacing: 16) {
                SetupStepRow(
                    step: 1,
                    title: "Install 1Password CLI",
                    description: "Download and install the 1Password command-line tool",
                    isComplete: status?.installed ?? false,
                    action: {
                        NSWorkspace.shared.open(URL(string: "https://1password.com/downloads/command-line/")!)
                    },
                    actionTitle: "Download"
                )
                
                SetupStepRow(
                    step: 2,
                    title: "Sign in to 1Password",
                    description: "Run 'op signin' in Terminal to authenticate",
                    isComplete: status?.signedIn ?? false,
                    action: {
                        openTerminalWithCommand("op signin")
                    },
                    actionTitle: "Open Terminal"
                )
                
                SetupStepRow(
                    step: 3,
                    title: "RADIANT Vault Created",
                    description: "A secure vault will be created for your AWS credentials",
                    isComplete: status?.vaultExists ?? false,
                    action: nil,
                    actionTitle: nil
                )
            }
            .padding()
            .background(Color(.textBackgroundColor).opacity(0.5))
            .cornerRadius(12)
            
            // Error Display
            if let error = error {
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.orange)
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding()
                .background(Color.orange.opacity(0.1))
                .cornerRadius(8)
            }
            
            Spacer()
            
            // Actions
            HStack {
                Button("Check Status") {
                    checkStatus()
                }
                .buttonStyle(.bordered)
                .disabled(isChecking)
                
                if isChecking {
                    ProgressView()
                        .controlSize(.small)
                }
                
                Spacer()
                
                if status?.installed == true && status?.signedIn == true {
                    Button("Continue") {
                        appState.onePasswordConfigured = true
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
        }
        .padding(24)
        .frame(width: 500, height: 500)
        .onAppear {
            checkStatus()
        }
    }
    
    private func checkStatus() {
        isChecking = true
        error = nil
        
        Task {
            let newStatus = await credentialService.checkOnePasswordStatus()
            await MainActor.run {
                status = newStatus
                isChecking = false
                
                if !newStatus.installed {
                    error = "1Password CLI not found at /usr/local/bin/op"
                } else if !newStatus.signedIn {
                    error = "Please sign in to 1Password using Terminal"
                }
            }
        }
    }
    
    private func openTerminalWithCommand(_ command: String) {
        let script = """
        tell application "Terminal"
            activate
            do script "\(command)"
        end tell
        """
        
        if let appleScript = NSAppleScript(source: script) {
            var error: NSDictionary?
            appleScript.executeAndReturnError(&error)
        }
    }
}

struct SetupStepRow: View {
    let step: Int
    let title: String
    let description: String
    let isComplete: Bool
    let action: (() -> Void)?
    let actionTitle: String?
    
    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            // Step indicator
            ZStack {
                Circle()
                    .fill(isComplete ? Color.green : Color.secondary.opacity(0.3))
                    .frame(width: 32, height: 32)
                
                if isComplete {
                    Image(systemName: "checkmark")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                } else {
                    Text("\(step)")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(isComplete ? .white : .secondary)
                }
            }
            
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(isComplete ? .secondary : .primary)
                
                Text(description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            if let action = action, let actionTitle = actionTitle, !isComplete {
                Button(actionTitle) {
                    action()
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
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
