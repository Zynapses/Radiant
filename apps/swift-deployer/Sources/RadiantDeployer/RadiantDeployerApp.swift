import SwiftUI

@main
struct RadiantDeployerApp: App {
    @StateObject private var appState = AppState()
    
    var body: some Scene {
        WindowGroup("Radiant Deployer") {
            MainView()
                .environmentObject(appState)
                .frame(minWidth: 1200, minHeight: 800)
        }
        .windowStyle(.titleBar)
        .windowToolbarStyle(.unified(showsTitle: true))
        .commands {
            RadiantCommands(appState: appState)
        }
        
        Settings {
            SettingsView()
                .environmentObject(appState)
        }
    }
}

#Preview {
    MainView()
        .environmentObject(AppState())
        .frame(width: 1200, height: 800)
}
