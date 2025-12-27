// RADIANT v4.18.0 - Main View (macOS Patterns)
// Implements: NavigationSplitView, Glass Toolbar, Inspector, Menu Commands

import SwiftUI

struct MainView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        Group {
            if !appState.onePasswordConfigured {
                OnePasswordSetupView()
            } else {
                AppWindowShell()
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
        .sheet(isPresented: $appState.showAIAssistant) {
            AIAssistantSheet()
                .environmentObject(appState)
        }
    }
}

// MARK: - App Window Shell

struct AppWindowShell: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        NavigationSplitView(columnVisibility: $appState.columnVisibility) {
            AppSidebar()
        } detail: {
            HSplitView {
                // Main Content
                VStack(spacing: 0) {
                    ContentToolbar()
                    DetailContentView()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                
                // Inspector (Optional Right Panel)
                if appState.showInspector {
                    AppInspector()
                }
            }
        }
        .navigationSplitViewStyle(.balanced)
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                PrimaryToolbarActions()
            }
            
            ToolbarItemGroup(placement: .automatic) {
                SecondaryToolbarActions()
            }
        }
    }
}

// MARK: - App Sidebar (Pattern 1 & 5)

struct AppSidebar: View {
    @EnvironmentObject var appState: AppState
    @State private var searchText = ""
    
    var body: some View {
        VStack(spacing: 0) {
            // Logo Header
            SidebarHeader()
            
            // Environment Selector (at top for visibility)
            EnvironmentSelector()
            
            // Search (Pattern 6)
            SidebarSearch(text: $searchText)
            
            // Navigation List
            List(selection: $appState.selectedTab) {
                // Main Navigation
                SidebarSection(title: "MAIN") {
                    ForEach(NavigationTab.mainTabs) { tab in
                        NavigationLink(value: tab) {
                            SidebarRow(
                                title: tab.rawValue,
                                icon: tab.icon,
                                iconColor: tab.color,
                                badge: badgeCount(for: tab)
                            )
                        }
                    }
                }
                
                // Operations
                SidebarSection(title: "OPERATIONS") {
                    ForEach(NavigationTab.operationTabs) { tab in
                        NavigationLink(value: tab) {
                            SidebarRow(
                                title: tab.rawValue,
                                icon: tab.icon,
                                iconColor: tab.color,
                                badge: badgeCount(for: tab)
                            )
                        }
                    }
                }
                
                // AI Registry
                SidebarSection(title: "AI REGISTRY") {
                    ForEach(NavigationTab.aiTabs) { tab in
                        NavigationLink(value: tab) {
                            SidebarRow(
                                title: tab.rawValue,
                                icon: tab.icon,
                                iconColor: tab.color
                            )
                        }
                    }
                }
                
                // Configuration (Domain & Email)
                SidebarSection(title: "CONFIGURATION") {
                    ForEach(NavigationTab.configTabs) { tab in
                        NavigationLink(value: tab) {
                            SidebarRow(
                                title: tab.rawValue,
                                icon: tab.icon,
                                iconColor: tab.color
                            )
                        }
                    }
                }
                
                // Advanced
                SidebarSection(title: "ADVANCED") {
                    ForEach(NavigationTab.advancedTabs) { tab in
                        NavigationLink(value: tab) {
                            SidebarRow(
                                title: tab.rawValue,
                                icon: tab.icon,
                                iconColor: tab.color
                            )
                        }
                    }
                }
                
                // Security
                SidebarSection(title: "SECURITY") {
                    ForEach(NavigationTab.securityTabs) { tab in
                        NavigationLink(value: tab) {
                            SidebarRow(
                                title: tab.rawValue,
                                icon: tab.icon,
                                iconColor: tab.color
                            )
                        }
                    }
                }
                
                // System
                SidebarSection(title: "SYSTEM") {
                    ForEach(NavigationTab.systemTabs) { tab in
                        NavigationLink(value: tab) {
                            SidebarRow(
                                title: tab.rawValue,
                                icon: tab.icon,
                                iconColor: tab.color
                            )
                        }
                    }
                }
                
                // Saved Views (Smart Filters)
                if !savedViews.isEmpty {
                    SidebarSection(title: "SAVED VIEWS") {
                        ForEach(savedViews, id: \.self) { view in
                            HStack(spacing: RadiantSpacing.sm) {
                                Image(systemName: "line.3.horizontal.decrease.circle")
                                    .foregroundStyle(.purple)
                                Text(view)
                            }
                        }
                    }
                }
            }
            .listStyle(.sidebar)
            .searchable(text: $searchText, placement: .sidebar, prompt: "Search")
            
            Divider()
            
            // Connection Status
            ConnectionStatus()
        }
        .frame(minWidth: 220, idealWidth: 240, maxWidth: 280)
        .background(.bar)
    }
    
    private var savedViews: [String] {
        ["Production Apps", "Recent Deployments", "Failed Instances"]
    }
    
    private func badgeCount(for tab: NavigationTab) -> Int? {
        switch tab {
        case .apps: return appState.apps.count
        case .instances: return deployedInstancesCount
        default: return nil
        }
    }
    
    private var deployedInstancesCount: Int {
        appState.apps.reduce(0) { count, app in
            count + (app.environments.dev.deployed ? 1 : 0)
                  + (app.environments.staging.deployed ? 1 : 0)
                  + (app.environments.prod.deployed ? 1 : 0)
        }
    }
}

// MARK: - Sidebar Header

struct SidebarHeader: View {
    var body: some View {
        HStack(spacing: RadiantSpacing.sm) {
            Image(systemName: "rays")
                .font(.system(size: 24, weight: .bold))
                .foregroundStyle(
                    LinearGradient(
                        colors: [.orange, .red],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
            
            VStack(alignment: .leading, spacing: 2) {
                Text("RADIANT")
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                Text("Deployer v\(RADIANT_VERSION)")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
        }
        .padding(.horizontal, RadiantSpacing.md)
        .padding(.vertical, RadiantSpacing.sm)
    }
}

// MARK: - Sidebar Search

struct SidebarSearch: View {
    @Binding var text: String
    
    var body: some View {
        HStack(spacing: RadiantSpacing.xs) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)
            
            TextField("Search...", text: $text)
                .textFieldStyle(.plain)
                .font(.callout)
        }
        .padding(RadiantSpacing.xs)
        .background(Color(nsColor: .textBackgroundColor).opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.sm))
        .padding(.horizontal, RadiantSpacing.sm)
        .padding(.bottom, RadiantSpacing.xs)
    }
}

// MARK: - Environment Selector

struct EnvironmentSelector: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        VStack(spacing: RadiantSpacing.xs) {
            Text("ENVIRONMENT")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.tertiary)
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
                            .padding(.vertical, 6)
                            .background(
                                appState.selectedEnvironment == env
                                ? env.color
                                : env.color.opacity(0.15)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.sm))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(RadiantSpacing.sm)
    }
}

// MARK: - Connection Status

struct ConnectionStatus: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        HStack(spacing: RadiantSpacing.xs) {
            Circle()
                .fill(appState.credentials.isEmpty ? .red : .green)
                .frame(width: 8, height: 8)
            
            Text(appState.credentials.isEmpty ? "Not Connected" : "AWS Connected")
                .font(.caption2)
                .foregroundStyle(.secondary)
            
            Spacer()
            
            if appState.isConnectedToRadiant {
                Image(systemName: "checkmark.seal.fill")
                    .foregroundStyle(.green)
                    .font(.caption2)
            }
        }
        .padding(.horizontal, RadiantSpacing.sm)
        .padding(.vertical, RadiantSpacing.xs)
        .background(Color(nsColor: .windowBackgroundColor).opacity(0.5))
    }
}

// MARK: - Content Toolbar (Pattern 3)

struct ContentToolbar: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        GlassToolbar(
            title: appState.selectedTab.rawValue,
            subtitle: environmentSubtitle
        ) {
            // Leading: Breadcrumb or back button if needed
            EmptyView()
        } trailing: {
            // View toggle, filter, sort buttons
            HStack(spacing: RadiantSpacing.sm) {
                // Search in content area (Pattern 6)
                Button {
                    // Toggle search
                } label: {
                    Image(systemName: "magnifyingglass")
                }
                .buttonStyle(.borderless)
                .help("Search (⌘F)")
                
                Divider()
                    .frame(height: 16)
                
                // View toggle
                Picker("View", selection: .constant("list")) {
                    Image(systemName: "list.bullet")
                        .tag("list")
                    Image(systemName: "square.grid.2x2")
                        .tag("grid")
                }
                .pickerStyle(.segmented)
                .frame(width: 70)
            }
        }
    }
    
    private var environmentSubtitle: String {
        "\(appState.selectedEnvironment.rawValue) Environment"
    }
}

// MARK: - Primary Toolbar Actions (Pattern 3)

struct PrimaryToolbarActions: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        // Primary action button
        Button {
            appState.selectedTab = .deploy
        } label: {
            Label("Deploy", systemImage: "arrow.up.circle.fill")
        }
        .buttonStyle(.borderedProminent)
        .help("New Deployment (⌘N)")
    }
}

// MARK: - Secondary Toolbar Actions

struct SecondaryToolbarActions: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        // Grouped frequent actions
        ControlGroup {
            Button {
                Task { await appState.refreshAllStatus() }
            } label: {
                Image(systemName: "arrow.clockwise")
            }
            .help("Refresh (⌘R)")
            
            Button {
                appState.showInspector.toggle()
            } label: {
                Image(systemName: appState.showInspector ? "sidebar.trailing" : "sidebar.trailing")
            }
            .help("Toggle Inspector (⌥⌘I)")
        }
        
        // AI Assistant
        Button {
            appState.showAIAssistant = true
        } label: {
            Image(systemName: "sparkles")
        }
        .help("AI Assistant (⌘.)")
        
        // Overflow menu
        Menu {
            Button("Export Configuration...") { }
            Button("Import Configuration...") { }
            Divider()
            Button("View Documentation") {
                if let url = URL(string: "https://docs.radiant.ai") {
                    NSWorkspace.shared.open(url)
                }
            }
            Divider()
            Button("Check for Updates...") { }
        } label: {
            Image(systemName: "ellipsis.circle")
        }
        .menuStyle(.borderlessButton)
        .help("More Actions")
    }
}

// MARK: - App Inspector (Pattern 1 & 10)

struct AppInspector: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Text("Inspector")
                    .font(.headline)
                Spacer()
                Button {
                    appState.showInspector = false
                } label: {
                    Image(systemName: "xmark")
                        .font(.caption)
                }
                .buttonStyle(.borderless)
            }
            .padding(RadiantSpacing.md)
            .background(.bar)
            
            Divider()
            
            // Content based on selection
            ScrollView {
                VStack(alignment: .leading, spacing: RadiantSpacing.lg) {
                    if let app = appState.selectedApp {
                        AppInspectorContent(app: app)
                    } else {
                        ContextualInspectorContent()
                    }
                }
                .padding(RadiantSpacing.md)
            }
        }
        .frame(width: 280)
        .background(Color(nsColor: .windowBackgroundColor))
    }
}

struct AppInspectorContent: View {
    let app: ManagedApp
    
    var body: some View {
        InspectorSection(title: "APP INFO") {
            InspectorRow(label: "Name", value: app.name)
            InspectorRow(label: "Domain", value: app.domain)
            if let description = app.description {
                InspectorRow(label: "Description", value: description)
            }
        }
        
        InspectorSection(title: "ENVIRONMENTS") {
            InspectorRow(
                label: "Development",
                value: app.environments.dev.deployed ? "Tier \(app.environments.dev.tier)" : "Not Deployed",
                valueColor: app.environments.dev.deployed ? .blue : .secondary
            )
            InspectorRow(
                label: "Staging",
                value: app.environments.staging.deployed ? "Tier \(app.environments.staging.tier)" : "Not Deployed",
                valueColor: app.environments.staging.deployed ? .orange : .secondary
            )
            InspectorRow(
                label: "Production",
                value: app.environments.prod.deployed ? "Tier \(app.environments.prod.tier)" : "Not Deployed",
                valueColor: app.environments.prod.deployed ? .green : .secondary
            )
        }
        
        InspectorSection(title: "ACTIONS") {
            Button("View Logs") { }
                .buttonStyle(.bordered)
                .frame(maxWidth: .infinity)
            
            Button("Edit Configuration") { }
                .buttonStyle(.bordered)
                .frame(maxWidth: .infinity)
        }
    }
}

struct ContextualInspectorContent: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        InspectorSection(title: "QUICK STATS") {
            InspectorRow(label: "Total Apps", value: "\(appState.apps.count)")
            InspectorRow(label: "Environment", value: appState.selectedEnvironment.rawValue)
            InspectorRow(
                label: "Status",
                value: appState.credentials.isEmpty ? "Disconnected" : "Connected",
                valueColor: appState.credentials.isEmpty ? .red : .green
            )
        }
        
        InspectorSection(title: "RECENT ACTIVITY") {
            if appState.deploymentLogs.isEmpty {
                Text("No recent activity")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(appState.deploymentLogs.prefix(5)) { log in
                    HStack(spacing: RadiantSpacing.xs) {
                        Circle()
                            .fill(logColor(for: log))
                            .frame(width: 6, height: 6)
                        Text(log.message)
                            .font(.caption)
                            .lineLimit(1)
                    }
                }
            }
        }
    }
    
    private func logColor(for log: LogEntry) -> Color {
        switch log.level {
        case .success: return .green
        case .error: return .red
        case .warn: return .orange
        default: return .blue
        }
    }
}

// MARK: - Detail Content View

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
            case .domains:
                DomainSetupView()
            case .email:
                EmailSetupView()
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
                
                Text("⌘.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color(nsColor: .controlBackgroundColor))
                    .clipShape(RoundedRectangle(cornerRadius: 4))
                
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
                LazyVStack(alignment: .leading, spacing: RadiantSpacing.sm) {
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
            HStack(spacing: RadiantSpacing.sm) {
                TextField("Ask about deployments, AWS, or RADIANT...", text: $messageText)
                    .textFieldStyle(.plain)
                    .padding(RadiantSpacing.sm)
                    .background(Color(nsColor: .textBackgroundColor))
                    .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.md))
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
                .keyboardShortcut(.return, modifiers: [])
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
        VStack(spacing: RadiantSpacing.md) {
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
            
            VStack(alignment: .leading, spacing: RadiantSpacing.xs) {
                SuggestedQuestion(text: "How do I deploy to production?")
                SuggestedQuestion(text: "What tier should I choose?")
                SuggestedQuestion(text: "How do I rollback a deployment?")
            }
            .padding(.top)
        }
        .padding(RadiantSpacing.xl)
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
        .padding(.horizontal, RadiantSpacing.sm)
        .padding(.vertical, RadiantSpacing.xs)
        .background(Color.purple.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.md))
    }
}

struct MessageBubble: View {
    let message: AssistantMessage
    
    var body: some View {
        HStack {
            if message.role == .user { Spacer() }
            
            Text(LocalizedStringKey(message.content))
                .padding(RadiantSpacing.sm)
                .background(
                    message.role == .user
                    ? Color.accentColor
                    : Color(nsColor: .controlBackgroundColor)
                )
                .foregroundColor(message.role == .user ? .white : .primary)
                .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.lg))
            
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
