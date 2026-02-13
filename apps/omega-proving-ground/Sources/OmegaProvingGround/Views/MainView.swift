import SwiftUI

struct MainView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        NavigationSplitView {
            SidebarView()
        } detail: {
            detailContent
        }
        .navigationSplitViewStyle(.balanced)
        .task {
            await appState.inferenceService.checkConnection()
        }
    }

    @ViewBuilder
    private var detailContent: some View {
        switch appState.selectedTab {
        case .playground:
            InferencePlaygroundView()
        case .menu:
            MenuBrowserView()
        case .firmware:
            FirmwareValidatorView()
        case .cortex:
            CortexView()
        case .testSuites:
            TestSuiteListView()
        case .testResults:
            TestResultsView()
        case .datasets:
            DatasetListView()
        case .settings:
            ConnectionSettingsView()
        }
    }
}

// MARK: - Sidebar

struct SidebarView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        List(selection: $appState.selectedTab) {
            Section("OMEGA Proving Ground") {
                ForEach(SidebarTab.allCases) { tab in
                    Label {
                        Text(tab.rawValue)
                    } icon: {
                        Image(systemName: tab.icon)
                            .foregroundColor(tab.color)
                    }
                    .tag(tab)
                }
            }

            Section {
                ForEach(MenuCategory.allCases) { category in
                    let isActive = appState.selectedTab == .menu && appState.selectedMenuCategory == category
                    Button {
                        appState.selectedMenuCategory = category
                        appState.selectedTab = .menu
                    } label: {
                        Label {
                            Text(category.displayName)
                                .fontWeight(isActive ? .semibold : .regular)
                        } icon: {
                            Image(systemName: category.icon)
                                .foregroundColor(category.color)
                        }
                    }
                    .buttonStyle(.plain)
                    .padding(.vertical, 2)
                    .padding(.horizontal, 4)
                    .background(
                        RoundedRectangle(cornerRadius: 6)
                            .fill(isActive ? category.color.opacity(0.12) : Color.clear)
                    )
                }
            } header: {
                Text("McDonald's Menu")
            }

            Section {
                connectionStatusRow
            } header: {
                Text("Connection")
            }
        }
        .listStyle(.sidebar)
        .frame(minWidth: 200)
    }

    private var connectionStatusRow: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(connectionColor)
                .frame(width: 8, height: 8)
            Text(appState.inferenceService.connectionStatus.displayText)
                .font(.caption)
                .foregroundColor(.secondary)
                .lineLimit(1)
        }
        .padding(.vertical, 4)
    }

    private var connectionColor: Color {
        switch appState.inferenceService.connectionStatus {
        case .connected: return .green
        case .checking: return .yellow
        case .error: return .red
        case .disconnected: return .gray
        }
    }
}
