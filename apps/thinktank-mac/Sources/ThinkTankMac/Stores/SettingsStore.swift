import Foundation
import SwiftUI

@MainActor
final class SettingsStore: ObservableObject {
    @Published var personalityMode: PersonalityMode {
        didSet { UserDefaults.standard.set(personalityMode.rawValue, forKey: "personalityMode") }
    }
    @Published var voiceEnabled: Bool {
        didSet { UserDefaults.standard.set(voiceEnabled, forKey: "voiceEnabled") }
    }
    @Published var notificationsEnabled: Bool {
        didSet { UserDefaults.standard.set(notificationsEnabled, forKey: "notificationsEnabled") }
    }
    @Published var keyboardShortcutsEnabled: Bool {
        didSet { UserDefaults.standard.set(keyboardShortcutsEnabled, forKey: "keyboardShortcutsEnabled") }
    }
    @Published var showTokenCount: Bool {
        didSet { UserDefaults.standard.set(showTokenCount, forKey: "showTokenCount") }
    }
    @Published var showCostEstimate: Bool {
        didSet { UserDefaults.standard.set(showCostEstimate, forKey: "showCostEstimate") }
    }
    @Published var compactMode: Bool {
        didSet { UserDefaults.standard.set(compactMode, forKey: "compactMode") }
    }
    @Published var streamingEnabled: Bool {
        didSet { UserDefaults.standard.set(streamingEnabled, forKey: "streamingEnabled") }
    }
    @Published var catoMood: CatoMood {
        didSet { UserDefaults.standard.set(catoMood.rawValue, forKey: "catoMood") }
    }
    @Published var selectedLocale: SupportedLocale {
        didSet {
            UserDefaults.standard.set(selectedLocale.rawValue, forKey: "selectedLocale")
            LocalizationService.shared.setLocale(selectedLocale)
        }
    }
    @Published var clarionPreferences: ClarionPreferences {
        didSet {
            if let data = try? JSONEncoder().encode(clarionPreferences) {
                UserDefaults.standard.set(data, forKey: "clarionPreferences")
            }
        }
    }
    @Published var soundEnabled: Bool {
        didSet { UserDefaults.standard.set(soundEnabled, forKey: "soundEnabled") }
    }

    private let settingsService = SettingsService()
    private let delightService = DelightPreferencesService()
    private var delightSyncTask: Task<Void, Never>?

    init() {
        self.personalityMode = PersonalityMode(rawValue: UserDefaults.standard.string(forKey: "personalityMode") ?? "auto") ?? .auto
        self.voiceEnabled = UserDefaults.standard.object(forKey: "voiceEnabled") as? Bool ?? true
        self.notificationsEnabled = UserDefaults.standard.object(forKey: "notificationsEnabled") as? Bool ?? true
        self.keyboardShortcutsEnabled = UserDefaults.standard.object(forKey: "keyboardShortcutsEnabled") as? Bool ?? true
        self.showTokenCount = UserDefaults.standard.object(forKey: "showTokenCount") as? Bool ?? false
        self.showCostEstimate = UserDefaults.standard.object(forKey: "showCostEstimate") as? Bool ?? false
        self.compactMode = UserDefaults.standard.object(forKey: "compactMode") as? Bool ?? false
        self.streamingEnabled = UserDefaults.standard.object(forKey: "streamingEnabled") as? Bool ?? true
        self.catoMood = CatoMood(rawValue: UserDefaults.standard.string(forKey: "catoMood") ?? "balanced") ?? .balanced
        self.selectedLocale = SupportedLocale(rawValue: UserDefaults.standard.string(forKey: "selectedLocale") ?? "en") ?? .en
        self.soundEnabled = UserDefaults.standard.object(forKey: "soundEnabled") as? Bool ?? true

        if let prefData = UserDefaults.standard.data(forKey: "clarionPreferences"),
           let prefs = try? JSONDecoder().decode(ClarionPreferences.self, from: prefData) {
            self.clarionPreferences = prefs
        } else {
            self.clarionPreferences = .default
        }
    }

    func syncFromServer() async {
        do {
            let remote = try await settingsService.getSettings()
            personalityMode = remote.personalityMode
            voiceEnabled = remote.features.voiceInput
        } catch {
            // Use local settings as fallback
        }
    }

    func syncToServer() async {
        let settings = UserSettings(
            personalityMode: personalityMode,
            features: FeatureSettings(
                voiceInput: voiceEnabled,
                collaboration: true,
                codeExecution: true,
                fileUploads: true,
                imageGeneration: true
            ),
            notifications: NotificationSettings(
                achievements: notificationsEnabled,
                updates: notificationsEnabled,
                tips: notificationsEnabled
            ),
            privacy: PrivacySettings(
                shareAnalytics: true,
                storeConversations: true
            )
        )
        _ = try? await settingsService.updateSettings(settings)
    }

    // MARK: - Delight Sync (mirrors useDelightSync.ts)

    func syncDelightFromServer() async {
        do {
            let prefs = try await delightService.fetchPreferences()
            if let mode = PersonalityMode(rawValue: prefs.personality_mode) {
                personalityMode = mode
            }
            soundEnabled = prefs.sound_enabled
        } catch {
            // Use local as fallback
        }
    }

    func syncDelightToServer() {
        delightSyncTask?.cancel()
        delightSyncTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 500_000_000) // 500ms debounce
            guard !Task.isCancelled, let self else { return }
            let prefs = DelightPreferencesService.BackendPreferences(
                personality_mode: self.personalityMode.rawValue,
                intensity: nil,
                sound_enabled: self.soundEnabled,
                suppress_idle: false,
                suppress_session_start: false
            )
            try? await self.delightService.updatePreferences(prefs)
        }
    }
}
