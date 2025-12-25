// RADIANT v4.18.0 - Main View
// Beautiful, comprehensive UI for the Deployer app

import SwiftUI

struct MainView: View {
    @EnvironmentObject var appState: AppState
    @State private var showAIAssistant = false
    @State private var showOnePasswordSetup = false
    
    var body: some View {
        Group {
            if !appState.onePasswordConfigured {
                // Show 1Password setup when not configured
                OnePasswordSetupView()
            } else {
                // Main app content
                NavigationSplitView {
                    SidebarView()
                } detail: {
                    ZStack(alignment: .bottomTrailing) {
                        DetailContentView()
                        
                        // Floating AI Assistant Button
                        Button {
                            showAIAssistant.toggle()
                        } label: {
                            Image(systemName: "sparkles")
                                .font(.title2)
                                .foregroundColor(.white)
                                .frame(width: 50, height: 50)
                                .background(
                                    LinearGradient(
                                        colors: [.purple, .blue],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                                .clipShape(Circle())
                                .shadow(color: .purple.opacity(0.4), radius: 8, x: 0, y: 4)
                        }
                        .buttonStyle(.plain)
                        .padding(24)
                        .help("AI Assistant (Claude)")
                    }
                }
                .navigationSplitViewStyle(.balanced)
                .sheet(isPresented: $showAIAssistant) {
                    AIAssistantSheet()
                        .environmentObject(appState)
                }
            }
        }
        .withToasts()
        .onChange(of: appState.onePasswordConfigured) { configured in
            if configured {
                Task {
                    await appState.loadInitialData()
                }
            }
        }
    }
}

// MARK: - Sidebar

struct SidebarView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        VStack(spacing: 0) {
            // Logo Header
            HStack(spacing: 12) {
                Image(systemName: "rays")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.orange, .red],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                
                VStack(alignment: .leading, spacing: 2) {
                    Text("RADIANT")
                        .font(.system(size: 18, weight: .bold, design: .rounded))
                    Text("Deployer v\(RADIANT_VERSION)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 16)
            .background(.bar)
            
            // Navigation List
            List(selection: $appState.selectedTab) {
                // Main Navigation
                Section {
                    ForEach(NavigationTab.mainTabs) { tab in
                        NavigationLink(value: tab) {
                            Label {
                                Text(tab.rawValue)
                            } icon: {
                                Image(systemName: tab.icon)
                                    .foregroundStyle(tab.color)
                            }
                        }
                    }
                } header: {
                    Text("MAIN")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                // Operations
                Section {
                    ForEach(NavigationTab.operationTabs) { tab in
                        NavigationLink(value: tab) {
                            Label {
                                Text(tab.rawValue)
                            } icon: {
                                Image(systemName: tab.icon)
                                    .foregroundStyle(tab.color)
                            }
                        }
                    }
                } header: {
                    Text("OPERATIONS")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                // AI & Registry
                Section {
                    ForEach(NavigationTab.aiTabs) { tab in
                        NavigationLink(value: tab) {
                            Label {
                                Text(tab.rawValue)
                            } icon: {
                                Image(systemName: tab.icon)
                                    .foregroundStyle(tab.color)
                            }
                        }
                    }
                } header: {
                    Text("AI REGISTRY")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                // Advanced
                Section {
                    ForEach(NavigationTab.advancedTabs) { tab in
                        NavigationLink(value: tab) {
                            Label {
                                Text(tab.rawValue)
                            } icon: {
                                Image(systemName: tab.icon)
                                    .foregroundStyle(tab.color)
                            }
                        }
                    }
                } header: {
                    Text("ADVANCED")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                // Security & Compliance
                Section {
                    ForEach(NavigationTab.securityTabs) { tab in
                        NavigationLink(value: tab) {
                            Label {
                                Text(tab.rawValue)
                            } icon: {
                                Image(systemName: tab.icon)
                                    .foregroundStyle(tab.color)
                            }
                        }
                    }
                } header: {
                    Text("SECURITY")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                // System
                Section {
                    ForEach(NavigationTab.systemTabs) { tab in
                        NavigationLink(value: tab) {
                            Label {
                                Text(tab.rawValue)
                            } icon: {
                                Image(systemName: tab.icon)
                                    .foregroundStyle(tab.color)
                            }
                        }
                    }
                } header: {
                    Text("SYSTEM")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .listStyle(.sidebar)
            
            Divider()
            
            // Environment Selector
            VStack(spacing: 8) {
                Text("ENVIRONMENT")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                
                HStack(spacing: 4) {
                    ForEach(DeployEnvironment.allCases) { env in
                        Button {
                            withAnimation(.spring(response: 0.3)) {
                                appState.selectedEnvironment = env
                            }
                        } label: {
                            Text(env.shortName)
                                .font(.caption.weight(.semibold))
                                .foregroundColor(appState.selectedEnvironment == env ? .white : env.color)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 8)
                                .background(
                                    appState.selectedEnvironment == env
                                    ? env.color
                                    : env.color.opacity(0.15)
                                )
                                .clipShape(RoundedRectangle(cornerRadius: 6))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(12)
            .background(.bar)
            
            // Connection Status
            HStack(spacing: 8) {
                Circle()
                    .fill(appState.credentials.isEmpty ? .red : .green)
                    .frame(width: 8, height: 8)
                
                Text(appState.credentials.isEmpty ? "Not Connected" : "AWS Connected")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                
                Spacer()
                
                if appState.isConnectedToRadiant {
                    Image(systemName: "checkmark.seal.fill")
                        .foregroundStyle(.green)
                        .font(.caption)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color(nsColor: .windowBackgroundColor))
        }
        .frame(minWidth: 220, maxWidth: 280)
    }
}

// MARK: - Detail Content

struct DetailContentView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        Group {
            switch appState.selectedTab {
            case .dashboard:
                DashboardView()
            case .apps:
                AppsView()
            case .deploy:
                DeployView()
            case .instances:
                InstancesView()
            case .snapshots:
                SnapshotsView()
            case .packages:
                PackagesView()
            case .history:
                HistoryView()
            case .providers:
                ProvidersView()
            case .models:
                ModelsView()
            case .selfHosted:
                SelfHostedModelsView()
            case .multiRegion:
                MultiRegionView()
            case .abTesting:
                ABTestingView()
            case .security:
                SecurityView()
            case .compliance:
                ComplianceView()
            case .costs:
                CostsView()
            case .settings:
                SettingsView()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - AI Assistant Sheet

struct AIAssistantSheet: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) var dismiss
    @State private var messageText = ""
    @State private var messages: [AssistantMessage] = []
    @State private var isLoading = false
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Image(systemName: "sparkles")
                    .foregroundStyle(.purple)
                Text("AI Assistant")
                    .font(.headline)
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
            .padding()
            .background(.bar)
            
            Divider()
            
            // Messages
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    if messages.isEmpty {
                        WelcomeMessageView()
                    }
                    
                    ForEach(messages) { message in
                        MessageBubble(message: message)
                    }
                    
                    if isLoading {
                        HStack {
                            ProgressView()
                                .controlSize(.small)
                            Text("Thinking...")
                                .foregroundStyle(.secondary)
                        }
                        .padding()
                    }
                }
                .padding()
            }
            
            Divider()
            
            // Input
            HStack(spacing: 12) {
                TextField("Ask about deployments, AWS, or RADIANT...", text: $messageText)
                    .textFieldStyle(.plain)
                    .padding(12)
                    .background(Color(nsColor: .textBackgroundColor))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .onSubmit { sendMessage() }
                
                Button {
                    sendMessage()
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title2)
                        .foregroundStyle(.purple)
                }
                .buttonStyle(.plain)
                .disabled(messageText.isEmpty || isLoading)
            }
            .padding()
        }
        .frame(width: 500, height: 600)
    }
    
    private func sendMessage() {
        guard !messageText.isEmpty else { return }
        
        let userMessage = AssistantMessage(role: .user, content: messageText)
        messages.append(userMessage)
        messageText = ""
        isLoading = true
        
        // Simulate AI response
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            let response = AssistantMessage(
                role: .assistant,
                content: "I'm your RADIANT deployment assistant. I can help you with:\n\n• **Deploy workflows** - Install, Update, or Rollback\n• **AWS configuration** - Credentials, regions, tiers\n• **Troubleshooting** - Common issues and solutions\n• **Best practices** - Security, cost optimization\n\nWhat would you like help with?"
            )
            messages.append(response)
            isLoading = false
        }
    }
}

struct AssistantMessage: Identifiable {
    let id = UUID()
    let role: MessageRole
    let content: String
    
    enum MessageRole {
        case user, assistant
    }
}

struct WelcomeMessageView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "sparkles")
                .font(.system(size: 40))
                .foregroundStyle(
                    LinearGradient(
                        colors: [.purple, .blue],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
            
            Text("Hi! I'm your RADIANT Assistant")
                .font(.headline)
            
            Text("I can help you deploy, configure, and troubleshoot your RADIANT instances.")
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            
            VStack(alignment: .leading, spacing: 8) {
                SuggestedQuestion(text: "How do I deploy to production?")
                SuggestedQuestion(text: "What tier should I choose?")
                SuggestedQuestion(text: "How do I rollback a deployment?")
            }
            .padding(.top)
        }
        .padding(32)
        .frame(maxWidth: .infinity)
    }
}

struct SuggestedQuestion: View {
    let text: String
    
    var body: some View {
        HStack {
            Image(systemName: "questionmark.circle")
                .foregroundStyle(.purple)
            Text(text)
                .foregroundStyle(.primary)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color.purple.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct MessageBubble: View {
    let message: AssistantMessage
    
    var body: some View {
        HStack {
            if message.role == .user { Spacer() }
            
            Text(LocalizedStringKey(message.content))
                .padding(12)
                .background(
                    message.role == .user
                    ? Color.blue
                    : Color(nsColor: .controlBackgroundColor)
                )
                .foregroundColor(message.role == .user ? .white : .primary)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            
            if message.role == .assistant { Spacer() }
        }
    }
}

// MARK: - Preview

#Preview {
    MainView()
        .environmentObject(AppState())
        .frame(width: 1400, height: 900)
}
