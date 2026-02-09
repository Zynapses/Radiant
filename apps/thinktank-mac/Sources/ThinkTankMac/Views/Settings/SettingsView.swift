import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var settingsStore: SettingsStore
    @EnvironmentObject var appState: AppState
    @State private var selectedTab = SettingsTab.general

    enum SettingsTab: String, CaseIterable, Identifiable {
        case general, display, personality, language, axiom, voice, shortcuts, privacy
        var id: String { rawValue }

        var displayName: String {
            switch self {
            case .general: return "General"
            case .display: return "Display"
            case .personality: return "Personality"
            case .language: return "Language"
            case .axiom: return "AXIOM"
            case .voice: return "Voice"
            case .shortcuts: return "Shortcuts"
            case .privacy: return "Privacy"
            }
        }

        var icon: String {
            switch self {
            case .general: return "gearshape"
            case .display: return "paintbrush"
            case .personality: return "face.smiling"
            case .language: return "globe"
            case .axiom: return "wand.and.rays"
            case .voice: return "mic"
            case .shortcuts: return "keyboard"
            case .privacy: return "lock.shield"
            }
        }
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            ForEach(SettingsTab.allCases) { tab in
                settingsContent(for: tab)
                    .tabItem {
                        Label(tab.displayName, systemImage: tab.icon)
                    }
                    .tag(tab)
            }
        }
        .frame(width: 560, height: 440)
    }

    @ViewBuilder
    private func settingsContent(for tab: SettingsTab) -> some View {
        switch tab {
        case .general:
            generalSettings
        case .display:
            displaySettings
        case .personality:
            personalitySettings
        case .language:
            languageSettings
        case .axiom:
            axiomSettings
        case .voice:
            voiceSettings
        case .shortcuts:
            shortcutSettings
        case .privacy:
            privacySettings
        }
    }

    private var generalSettings: some View {
        Form {
            Section("AI Personality") {
                Picker("Mode", selection: $settingsStore.personalityMode) {
                    ForEach(PersonalityMode.allCases, id: \.self) { mode in
                        Text(mode.displayName).tag(mode)
                    }
                }
                .pickerStyle(.segmented)

                Text("Controls how the AI communicates. 'Auto' adapts to context.")
                    .font(.system(size: 11))
                    .foregroundStyle(.tertiary)
            }

            Section("Streaming") {
                Toggle("Stream responses", isOn: $settingsStore.streamingEnabled)
                Text("Show AI responses as they're generated instead of waiting for completion.")
                    .font(.system(size: 11))
                    .foregroundStyle(.tertiary)
            }

            Section("Notifications") {
                Toggle("Enable notifications", isOn: $settingsStore.notificationsEnabled)
            }

            Section("API") {
                HStack {
                    Text("Server URL")
                    Spacer()
                    TextField("https://api.radiant.local", text: Binding(
                        get: { UserDefaults.standard.string(forKey: "apiBaseURL") ?? "https://api.radiant.local" },
                        set: { UserDefaults.standard.set($0, forKey: "apiBaseURL") }
                    ))
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 250)
                }
            }
        }
        .formStyle(.grouped)
        .padding()
    }

    private var displaySettings: some View {
        Form {
            Section("Layout") {
                Toggle("Compact mode", isOn: $settingsStore.compactMode)
            }

            Section("Metadata") {
                Toggle("Show token count", isOn: $settingsStore.showTokenCount)
                Toggle("Show cost estimate", isOn: $settingsStore.showCostEstimate)
            }

            Section("Sound") {
                Toggle("Sound effects", isOn: $settingsStore.soundEnabled)
            }
        }
        .formStyle(.grouped)
        .padding()
    }

    private var personalitySettings: some View {
        Form {
            Section("AI Personality Mode") {
                Picker("Mode", selection: $settingsStore.personalityMode) {
                    ForEach(PersonalityMode.allCases, id: \.self) { mode in
                        Text(mode.displayName).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .onChange(of: settingsStore.personalityMode) { _, _ in
                    settingsStore.syncDelightToServer()
                }
            }

            Section("Cato Mood") {
                CatoMoodSelectorView(selectedMood: $settingsStore.catoMood, variant: .inline)
                Text("Sets the AI assistant's personality style during conversations.")
                    .font(.system(size: 11))
                    .foregroundStyle(.tertiary)
            }
        }
        .formStyle(.grouped)
        .padding()
    }

    private var languageSettings: some View {
        Form {
            Section("Display Language") {
                Picker("Language", selection: $settingsStore.selectedLocale) {
                    ForEach(SupportedLocale.allCases, id: \.self) { locale in
                        HStack {
                            Text(locale.flag)
                            Text(locale.displayName)
                        }
                        .tag(locale)
                    }
                }
                Text("Changes the language used throughout the app interface.")
                    .font(.system(size: 11))
                    .foregroundStyle(.tertiary)
            }
        }
        .formStyle(.grouped)
        .padding()
    }

    private var axiomSettings: some View {
        ClarionPreferencesPanelView(preferences: $settingsStore.clarionPreferences)
            .padding()
    }

    private var voiceSettings: some View {
        Form {
            Section("Voice Input") {
                Toggle("Enable voice input", isOn: $settingsStore.voiceEnabled)
                Text("Uses Whisper API for speech-to-text transcription.")
                    .font(.system(size: 11))
                    .foregroundStyle(.tertiary)
            }

            Section("Microphone") {
                Text("Microphone access is managed in System Settings > Privacy & Security > Microphone.")
                    .font(.system(size: 11))
                    .foregroundStyle(.tertiary)

                Button("Open System Settings") {
                    NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone")!)
                }
            }
        }
        .formStyle(.grouped)
        .padding()
    }

    private var shortcutSettings: some View {
        Form {
            Section("Keyboard Shortcuts") {
                Toggle("Enable keyboard shortcuts", isOn: $settingsStore.keyboardShortcutsEnabled)
            }

            Section("Available Shortcuts") {
                shortcutRow("New Conversation", shortcut: "⌘N")
                shortcutRow("Toggle Advanced Mode", shortcut: "⇧⌘D")
                shortcutRow("Toggle Focus Mode", shortcut: "⇧⌘F")
                shortcutRow("Toggle Sidebar", shortcut: "⌘\\")
                shortcutRow("Settings", shortcut: "⌘,")
                shortcutRow("Search Conversations", shortcut: "⌘K")
            }
        }
        .formStyle(.grouped)
        .padding()
    }

    private var privacySettings: some View {
        Form {
            Section("Data") {
                Text("Conversations are stored on the RADIANT server. Your tenant administrator controls data retention policies.")
                    .font(.system(size: 11))
                    .foregroundStyle(.tertiary)
            }

            Section("Local Storage") {
                Text("Settings and preferences are stored locally using UserDefaults.")
                    .font(.system(size: 11))
                    .foregroundStyle(.tertiary)

                Button("Clear Local Settings") {
                    let domain = Bundle.main.bundleIdentifier ?? "com.zynapses.thinktank-mac"
                    UserDefaults.standard.removePersistentDomain(forName: domain)
                }
                .foregroundStyle(.red)
            }
        }
        .formStyle(.grouped)
        .padding()
    }

    private func shortcutRow(_ name: String, shortcut: String) -> some View {
        HStack {
            Text(name)
                .font(.system(size: 13))
            Spacer()
            Text(shortcut)
                .font(.system(size: 12, design: .monospaced))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 8)
                .padding(.vertical, 2)
                .background(Color.white.opacity(0.06))
                .clipShape(RoundedRectangle(cornerRadius: 4))
        }
    }
}
