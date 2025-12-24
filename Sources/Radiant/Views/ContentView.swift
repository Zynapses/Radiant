import SwiftUI

struct ContentView: View {
    var body: some View {
        NavigationSplitView {
            SidebarView()
        } detail: {
            DetailView()
        }
        .frame(minWidth: 700, minHeight: 400)
    }
}

#Preview {
    ContentView()
}
