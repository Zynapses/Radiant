import SwiftUI

struct MainView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var chatStore: ChatStore
    @EnvironmentObject var settingsStore: SettingsStore

    var body: some View {
        NavigationSplitView(
            columnVisibility: Binding(
                get: { appState.isSidebarVisible ? .all : .detailOnly },
                set: { appState.isSidebarVisible = ($0 != .detailOnly) }
            )
        ) {
            SidebarView()
                .navigationSplitViewColumnWidth(min: 240, ideal: 280, max: 360)
        } detail: {
            ZStack {
                AuroraBackground()

                switch appState.selectedSection {
                case .chat:
                    ChatView()
                case .rules:
                    RulesView()
                case .grimoire:
                    GrimoireView()
                case .ideas:
                    IdeasView()
                case .flashFacts:
                    FlashFactsView()
                case .history:
                    HistoryView()
                case .artifacts:
                    ArtifactsView()
                case .governor:
                    GovernorDashboardView()
                case .settings:
                    SettingsView()
                case .profile:
                    ProfileView()
                }
            }
        }
        .focusedSceneValue(\.isSidebarVisible, $appState.isSidebarVisible)
        .task {
            await appState.loadInitialData()
            await chatStore.loadConversations()
            await settingsStore.syncFromServer()
        }
        .onReceive(NotificationCenter.default.publisher(for: .newConversation)) { _ in
            Task {
                await chatStore.createConversation()
                appState.selectedSection = .chat
            }
        }
        .alert("Error", isPresented: Binding(
            get: { appState.errorMessage != nil || chatStore.error != nil },
            set: { if !$0 { appState.clearError(); chatStore.clearError() } }
        )) {
            Button("OK") {
                appState.clearError()
                chatStore.clearError()
            }
        } message: {
            Text(appState.errorMessage ?? chatStore.error ?? "")
        }
    }
}
