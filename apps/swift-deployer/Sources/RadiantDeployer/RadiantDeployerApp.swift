import SwiftUI

@main
struct RadiantDeployerApp: App {
    @StateObject private var appState = AppState()
    
    var body: some Scene {
        WindowGroup {
            MainView()
                .environmentObject(appState)
                .frame(minWidth: 1200, minHeight: 800)
        }
        .windowStyle(.hiddenTitleBar)
        .commands {
            CommandGroup(replacing: .newItem) { }
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
