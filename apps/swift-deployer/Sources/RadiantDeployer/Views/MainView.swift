import SwiftUI

struct MainView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        NavigationSplitView {
            SidebarView()
        } detail: {
            DetailContentView()
        }
        .navigationSplitViewStyle(.balanced)
    }
}

struct SidebarView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        List(selection: $appState.selectedTab) {
            Section("Navigation") {
                ForEach(NavigationTab.allCases) { tab in
                    NavigationLink(value: tab) {
                        Label(tab.rawValue, systemImage: tab.icon)
                    }
                }
            }
            
            Section("Environment") {
                ForEach(DeployEnvironment.allCases) { env in
                    Button {
                        appState.selectedEnvironment = env
                    } label: {
                        HStack {
                            Circle()
                                .fill(env.color)
                                .frame(width: 8, height: 8)
                            Text(env.shortName)
                            Spacer()
                            if appState.selectedEnvironment == env {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .listStyle(.sidebar)
        .frame(minWidth: 200)
        .toolbar {
            ToolbarItem(placement: .automatic) {
                Text("RADIANT")
                    .font(.headline)
                    .foregroundStyle(.orange)
            }
        }
    }
}

struct DetailContentView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        Group {
            switch appState.selectedTab {
            case .apps:
                AppsView()
            case .deploy:
                DeployView()
            case .providers:
                ProvidersView()
            case .models:
                ModelsView()
            case .settings:
                SettingsView()
            }
        }
    }
}

#Preview {
    MainView()
        .environmentObject(AppState())
        .frame(width: 1200, height: 800)
}
