import SwiftUI

@main
struct ThinkTankApp: App {
    @StateObject private var appState = AppState()
    @StateObject private var chatStore = ChatStore()
    @StateObject private var settingsStore = SettingsStore()
    @StateObject private var authService = AuthService.shared
    @StateObject private var localizationService = LocalizationService.shared

    var body: some Scene {
        WindowGroup {
            Group {
                if authService.isLoading {
                    ProgressView("Loading...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if authService.isAuthenticated {
                    MainView()
                        .environmentObject(appState)
                        .environmentObject(chatStore)
                        .environmentObject(settingsStore)
                        .environmentObject(localizationService)
                } else {
                    LoginView(authService: authService)
                }
            }
            .frame(minWidth: 900, minHeight: 600)
            .preferredColorScheme(.dark)
        }
        .windowStyle(.titleBar)
        .windowToolbarStyle(.unified(showsTitle: false))
        .defaultSize(width: 1200, height: 800)
        .commands {
            ThinkTankCommands()
        }

        Settings {
            SettingsView()
                .environmentObject(settingsStore)
                .environmentObject(appState)
        }
    }
}

struct ThinkTankCommands: Commands {
    @FocusedBinding(\.isSidebarVisible) var isSidebarVisible

    var body: some Commands {
        SidebarCommands()

        CommandGroup(after: .newItem) {
            Button("New Conversation") {
                NotificationCenter.default.post(name: .newConversation, object: nil)
            }
            .keyboardShortcut("n", modifiers: [.command])

            Divider()

            Button("Toggle Advanced Mode") {
                NotificationCenter.default.post(name: .toggleAdvancedMode, object: nil)
            }
            .keyboardShortcut("d", modifiers: [.command, .shift])

            Button("Toggle Focus Mode") {
                NotificationCenter.default.post(name: .toggleFocusMode, object: nil)
            }
            .keyboardShortcut("f", modifiers: [.command, .shift])
        }

        CommandGroup(replacing: .help) {
            Button("Think Tank Help") {
                NSWorkspace.shared.open(URL(string: "https://docs.radiant.zynapses.com/think-tank")!)
            }
        }
    }
}

extension Notification.Name {
    static let newConversation = Notification.Name("newConversation")
    static let toggleAdvancedMode = Notification.Name("toggleAdvancedMode")
    static let toggleFocusMode = Notification.Name("toggleFocusMode")
}

struct SidebarVisibleKey: FocusedValueKey {
    typealias Value = Binding<Bool>
}

extension FocusedValues {
    var isSidebarVisible: Binding<Bool>? {
        get { self[SidebarVisibleKey.self] }
        set { self[SidebarVisibleKey.self] = newValue }
    }
}
