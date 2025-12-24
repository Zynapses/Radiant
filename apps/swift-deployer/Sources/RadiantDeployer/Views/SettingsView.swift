import SwiftUI

struct SettingsView: View {
    var body: some View {
        TabView {
            GeneralSettingsView()
                .tabItem {
                    Label("General", systemImage: "gear")
                }
            
            CredentialsSettingsView()
                .tabItem {
                    Label("Credentials", systemImage: "key")
                }
            
            AdvancedSettingsView()
                .tabItem {
                    Label("Advanced", systemImage: "wrench.and.screwdriver")
                }
        }
        .frame(width: 550, height: 400)
    }
}

struct GeneralSettingsView: View {
    @AppStorage("defaultEnvironment") private var defaultEnvironment = "dev"
    @AppStorage("defaultRegion") private var defaultRegion = "us-east-1"
    @AppStorage("autoCheckUpdates") private var autoCheckUpdates = true
    
    var body: some View {
        Form {
            Section("Defaults") {
                Picker("Default Environment", selection: $defaultEnvironment) {
                    Text("Development").tag("dev")
                    Text("Staging").tag("staging")
                    Text("Production").tag("prod")
                }
                
                Picker("Default Region", selection: $defaultRegion) {
                    Text("US East (N. Virginia)").tag("us-east-1")
                    Text("US West (Oregon)").tag("us-west-2")
                    Text("Europe (Ireland)").tag("eu-west-1")
                    Text("Europe (Frankfurt)").tag("eu-central-1")
                    Text("Asia Pacific (Tokyo)").tag("ap-northeast-1")
                }
            }
            
            Section("Updates") {
                Toggle("Automatically check for updates", isOn: $autoCheckUpdates)
            }
            
            Section("About") {
                LabeledContent("Version", value: RADIANT_VERSION)
                LabeledContent("Build", value: "1")
            }
        }
        .formStyle(.grouped)
        .padding()
    }
}

struct CredentialsSettingsView: View {
    @EnvironmentObject var appState: AppState
    @State private var showAddCredential = false
    
    var body: some View {
        VStack {
            if appState.credentials.isEmpty {
                VStack(spacing: 16) {
                    Spacer()
                    Image(systemName: "key")
                        .font(.system(size: 48))
                        .foregroundStyle(.secondary)
                    Text("No Credentials")
                        .font(.headline)
                    Text("Add AWS credentials to deploy infrastructure.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Button("Add Credentials") {
                        showAddCredential = true
                    }
                    .buttonStyle(.borderedProminent)
                    Spacer()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(appState.credentials, id: \.id) { credential in
                        CredentialRow(credential: credential)
                    }
                }
                .toolbar {
                    Button {
                        showAddCredential = true
                    } label: {
                        Label("Add", systemImage: "plus")
                    }
                }
            }
        }
        .sheet(isPresented: $showAddCredential) {
            AddCredentialSheet()
        }
    }
}

struct CredentialRow: View {
    let credential: CredentialSet
    
    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text(credential.name)
                    .font(.headline)
                Text("\(credential.accessKeyId) • \(credential.region)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            if credential.isValid == true {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(.green)
            } else if credential.isValid == false {
                Image(systemName: "xmark.circle.fill")
                    .foregroundStyle(.red)
            } else {
                Image(systemName: "questionmark.circle")
                    .foregroundStyle(.secondary)
            }
        }
    }
}

struct AddCredentialSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var accessKeyId = ""
    @State private var secretAccessKey = ""
    @State private var region = "us-east-1"
    @State private var environment = CredentialEnvironment.shared
    
    var body: some View {
        NavigationStack {
            Form {
                Section("Credential Info") {
                    TextField("Name", text: $name)
                    Picker("Environment", selection: $environment) {
                        ForEach(CredentialEnvironment.allCases, id: \.self) { env in
                            Text(env.rawValue).tag(env)
                        }
                    }
                }
                
                Section("AWS Credentials") {
                    TextField("Access Key ID", text: $accessKeyId)
                    SecureField("Secret Access Key", text: $secretAccessKey)
                    Picker("Region", selection: $region) {
                        Text("US East (N. Virginia)").tag("us-east-1")
                        Text("US West (Oregon)").tag("us-west-2")
                        Text("Europe (Ireland)").tag("eu-west-1")
                    }
                }
            }
            .formStyle(.grouped)
            .navigationTitle("Add Credentials")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        saveCredential()
                        dismiss()
                    }
                    .disabled(name.isEmpty || accessKeyId.isEmpty || secretAccessKey.isEmpty)
                }
            }
        }
        .frame(width: 450, height: 350)
    }
    
    private func saveCredential() {
        // TODO: Save to keychain
    }
}

struct AdvancedSettingsView: View {
    @AppStorage("cdkPath") private var cdkPath = "/usr/local/bin/cdk"
    @AppStorage("nodePath") private var nodePath = "/usr/local/bin/node"
    @AppStorage("verboseLogging") private var verboseLogging = false
    
    var body: some View {
        Form {
            Section("Paths") {
                TextField("CDK Path", text: $cdkPath)
                TextField("Node.js Path", text: $nodePath)
            }
            
            Section("Debugging") {
                Toggle("Verbose Logging", isOn: $verboseLogging)
            }
        }
        .formStyle(.grouped)
        .padding()
    }
}

#Preview {
    SettingsView()
        .environmentObject(AppState())
}
