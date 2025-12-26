// RADIANT v4.18.0 - App Commands
// Menu bar commands and keyboard shortcuts for macOS

import SwiftUI

// MARK: - App Commands

struct RadiantCommands: Commands {
    @ObservedObject var appState: AppState
    
    var body: some Commands {
        // File Menu
        CommandGroup(replacing: .newItem) {
            Button("New Deployment...") {
                appState.selectedTab = .deploy
            }
            .keyboardShortcut("n", modifiers: .command)
            
            Button("New App...") {
                appState.selectedTab = .apps
                // Trigger new app sheet
            }
            .keyboardShortcut("n", modifiers: [.command, .shift])
            
            Divider()
            
            Button("Import Configuration...") {
                // Import action
            }
            .keyboardShortcut("i", modifiers: .command)
            
            Button("Export Configuration...") {
                // Export action
            }
            .keyboardShortcut("e", modifiers: .command)
        }
        
        // View Menu
        CommandGroup(after: .sidebar) {
            Divider()
            
            Button("Show Dashboard") {
                appState.selectedTab = .dashboard
            }
            .keyboardShortcut("1", modifiers: .command)
            
            Button("Show Apps") {
                appState.selectedTab = .apps
            }
            .keyboardShortcut("2", modifiers: .command)
            
            Button("Show Deployments") {
                appState.selectedTab = .deploy
            }
            .keyboardShortcut("3", modifiers: .command)
            
            Button("Show Instances") {
                appState.selectedTab = .instances
            }
            .keyboardShortcut("4", modifiers: .command)
            
            Divider()
            
            Button("Show Inspector") {
                appState.showInspector.toggle()
            }
            .keyboardShortcut("i", modifiers: [.command, .option])
        }
        
        // Environment Menu
        CommandMenu("Environment") {
            Button("Switch to Development") {
                appState.selectedEnvironment = .dev
            }
            .keyboardShortcut("d", modifiers: [.command, .shift])
            
            Button("Switch to Staging") {
                appState.selectedEnvironment = .staging
            }
            .keyboardShortcut("s", modifiers: [.command, .shift])
            
            Button("Switch to Production") {
                appState.selectedEnvironment = .prod
            }
            .keyboardShortcut("p", modifiers: [.command, .shift])
            
            Divider()
            
            Button("Refresh Status") {
                Task {
                    await appState.refreshAllStatus()
                }
            }
            .keyboardShortcut("r", modifiers: .command)
        }
        
        // Deployment Menu
        CommandMenu("Deployment") {
            Button("Deploy Now...") {
                appState.selectedTab = .deploy
            }
            .keyboardShortcut("d", modifiers: .command)
            
            Button("Rollback...") {
                // Rollback action
            }
            .keyboardShortcut("z", modifiers: [.command, .shift])
            
            Divider()
            
            Button("View Logs") {
                appState.selectedTab = .history
            }
            .keyboardShortcut("l", modifiers: .command)
            
            Button("Create Snapshot...") {
                appState.selectedTab = .snapshots
            }
            .keyboardShortcut("b", modifiers: .command)
        }
        
        // Tools Menu
        CommandMenu("Tools") {
            Button("AI Assistant...") {
                appState.showAIAssistant = true
            }
            .keyboardShortcut(".", modifiers: .command)
            
            Divider()
            
            Button("SQL Editor") {
                // SQL Editor action
            }
            .keyboardShortcut("q", modifiers: [.command, .option])
            
            Button("Package Manager") {
                appState.selectedTab = .packages
            }
            .keyboardShortcut("k", modifiers: .command)
            
            Divider()
            
            Button("Run Health Check") {
                Task {
                    await appState.runHealthCheck()
                }
            }
            .keyboardShortcut("h", modifiers: [.command, .shift])
            
            Button("Validate Configuration") {
                // Validate action
            }
            .keyboardShortcut("v", modifiers: [.command, .shift])
        }
        
        // Help Menu additions
        CommandGroup(after: .help) {
            Divider()
            
            Button("RADIANT Documentation") {
                if let url = URL(string: "https://docs.radiant.ai") {
                    NSWorkspace.shared.open(url)
                }
            }
            
            Button("AWS CDK Reference") {
                if let url = URL(string: "https://docs.aws.amazon.com/cdk/") {
                    NSWorkspace.shared.open(url)
                }
            }
            
            Divider()
            
            Button("Report Issue...") {
                // Report issue action
            }
        }
    }
}

// MARK: - Focusable Commands (for context-sensitive actions)

struct FocusedDeploymentKey: FocusedValueKey {
    typealias Value = String
}

struct FocusedAppKey: FocusedValueKey {
    typealias Value = ManagedApp
}

extension FocusedValues {
    var selectedDeploymentId: String? {
        get { self[FocusedDeploymentKey.self] }
        set { self[FocusedDeploymentKey.self] = newValue }
    }
    
    var selectedApp: ManagedApp? {
        get { self[FocusedAppKey.self] }
        set { self[FocusedAppKey.self] = newValue }
    }
}
