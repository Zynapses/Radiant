import SwiftUI

struct SettingsView: View {
    var body: some View {
        TabView {
            GeneralSettingsView()
                .tabItem {
                    Label("General", systemImage: "gear")
                }
            
            AppearanceSettingsView()
                .tabItem {
                    Label("Appearance", systemImage: "paintbrush")
                }
        }
        .frame(width: 450, height: 250)
    }
}

struct GeneralSettingsView: View {
    @AppStorage("launchAtLogin") private var launchAtLogin = false
    
    var body: some View {
        Form {
            Toggle("Launch at Login", isOn: $launchAtLogin)
        }
        .padding()
    }
}

struct AppearanceSettingsView: View {
    @AppStorage("accentColorName") private var accentColorName = "orange"
    
    var body: some View {
        Form {
            Picker("Accent Color", selection: $accentColorName) {
                Text("Orange").tag("orange")
                Text("Blue").tag("blue")
                Text("Purple").tag("purple")
            }
        }
        .padding()
    }
}

#Preview {
    SettingsView()
}
