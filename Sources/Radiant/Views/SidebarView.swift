import SwiftUI

struct SidebarView: View {
    var body: some View {
        List {
            NavigationLink(value: "dashboard") {
                Label("Dashboard", systemImage: "square.grid.2x2")
            }
            
            Section("Projects") {
                NavigationLink(value: "projects") {
                    Label("All Projects", systemImage: "folder")
                }
            }
            
            Section("Settings") {
                NavigationLink(value: "settings") {
                    Label("Preferences", systemImage: "gear")
                }
            }
        }
        .listStyle(.sidebar)
        .navigationTitle("Radiant")
    }
}

#Preview {
    SidebarView()
}
