import SwiftUI

@main
struct RadiantApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .windowStyle(.automatic)
        .defaultSize(width: 900, height: 600)
        
        Settings {
            SettingsView()
        }
    }
}
