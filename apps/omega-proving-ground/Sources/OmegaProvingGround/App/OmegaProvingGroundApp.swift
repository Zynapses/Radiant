import SwiftUI

@main
struct OmegaProvingGroundApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            MainView()
                .environmentObject(appState)
                .frame(minWidth: 1000, minHeight: 650)
        }
        .windowStyle(.titleBar)
        .defaultSize(width: 1200, height: 800)
        .commands {
            CommandGroup(replacing: .newItem) {}
            CommandMenu("Proving Ground") {
                Button("Check Connection") {
                    Task { await appState.inferenceService.checkConnection() }
                }
                .keyboardShortcut("k", modifiers: [.command])

                Divider()

                Button("Clear Chat") {
                    appState.chatMessages.removeAll()
                }
                .keyboardShortcut("l", modifiers: [.command, .shift])
            }
        }

        Settings {
            ConnectionSettingsView()
                .environmentObject(appState)
                .frame(width: 500, height: 400)
        }
    }
}
