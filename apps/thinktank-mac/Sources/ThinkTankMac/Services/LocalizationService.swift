import Foundation
import SwiftUI

// MARK: - Localization Service
// Full i18n system with translations, locale management
// Mirrors: apps/thinktank/lib/i18n/ (6 files)

@MainActor
class LocalizationService: ObservableObject {
    static let shared = LocalizationService()

    @Published var currentLocale: SupportedLocale {
        didSet {
            UserDefaults.standard.set(currentLocale.rawValue, forKey: "thinktank_locale")
        }
    }

    private var translations: [SupportedLocale: [String: String]] = [:]

    private init() {
        let saved = UserDefaults.standard.string(forKey: "thinktank_locale") ?? "en"
        self.currentLocale = SupportedLocale(rawValue: saved) ?? .en
        loadTranslations()
    }

    func t(_ key: String) -> String {
        translations[currentLocale]?[key] ?? translations[.en]?[key] ?? key
    }

    func setLocale(_ locale: SupportedLocale) {
        currentLocale = locale
    }

    private func loadTranslations() {
        translations[.en] = Self.englishTranslations
        translations[.es] = Self.spanishTranslations
        translations[.fr] = Self.frenchTranslations
        translations[.de] = Self.germanTranslations
        translations[.ja] = Self.japaneseTranslations
    }

    // MARK: - English Translations

    static let englishTranslations: [String: String] = [
        "app.name": "Think Tank",
        "app.tagline": "AI-Powered Thinking",

        "nav.chat": "Chat",
        "nav.history": "History",
        "nav.rules": "My Rules",
        "nav.artifacts": "Artifacts",
        "nav.profile": "Profile",
        "nav.settings": "Settings",
        "nav.grimoire": "Grimoire",
        "nav.ideas": "Ideas",
        "nav.flash_facts": "Flash Facts",
        "nav.governor": "Governor",

        "chat.new": "New Chat",
        "chat.send": "Send",
        "chat.placeholder": "Type a message...",
        "chat.thinking": "Thinking...",
        "chat.streaming": "Streaming response...",
        "chat.copy": "Copy",
        "chat.regenerate": "Regenerate",
        "chat.rate_up": "Good response",
        "chat.rate_down": "Poor response",
        "chat.export": "Export",
        "chat.delete": "Delete",
        "chat.search": "Search conversations...",
        "chat.no_conversations": "No conversations yet",
        "chat.welcome": "Welcome to Think Tank",
        "chat.welcome_subtitle": "Start a conversation to explore ideas with AI",

        "model.select": "Select Model",
        "model.recommended": "Recommended",
        "model.all": "All Models",

        "domain.auto": "Auto-detect",
        "domain.select": "Select Domain",

        "rules.title": "My Rules",
        "rules.create": "Create Rule",
        "rules.edit": "Edit Rule",
        "rules.delete": "Delete Rule",
        "rules.presets": "Browse Presets",
        "rules.empty": "No rules yet. Add rules to customize AI responses.",

        "settings.title": "Settings",
        "settings.general": "General",
        "settings.display": "Display",
        "settings.voice": "Voice",
        "settings.shortcuts": "Shortcuts",
        "settings.privacy": "Privacy",
        "settings.language": "Language",
        "settings.personality": "AI Personality",
        "settings.token_count": "Show Token Count",
        "settings.cost_estimate": "Show Cost Estimate",
        "settings.compact_mode": "Compact Mode",

        "governor.title": "Economic Governor",
        "governor.mode": "Mode",
        "governor.budget": "Budget",
        "governor.savings": "Savings",
        "governor.fuel": "Fuel Gauge",
        "governor.tiers": "Model Tiers",
        "governor.rules": "Arbitrage Rules",
        "governor.decisions": "Recent Decisions",

        "grimoire.title": "Grimoire",
        "grimoire.subtitle": "Reusable prompt templates",
        "grimoire.create": "Create Spell",
        "grimoire.featured": "Featured",
        "grimoire.my_spells": "My Spells",
        "grimoire.execute": "Cast Spell",

        "ideas.title": "Ideas",
        "ideas.subtitle": "Capture and develop ideas",
        "ideas.create": "New Idea",
        "ideas.boards": "Boards",
        "ideas.develop": "Develop with AI",
        "ideas.capture": "Capture from Chat",

        "flash_facts.title": "Flash Facts",
        "flash_facts.subtitle": "Quick fact extraction and verification",
        "flash_facts.extract": "Extract Facts",
        "flash_facts.verify": "Verify",
        "flash_facts.collections": "Collections",

        "derivation.title": "Reasoning Provenance",
        "derivation.chains": "Derivation Chains",
        "derivation.challenge": "Challenge",
        "derivation.evidence": "View Evidence",

        "axiom.title": "AXIOM Forge",
        "axiom.classify": "Classify",
        "axiom.clarify": "Clarify",
        "axiom.compile": "Compile",
        "axiom.route": "Route",
        "axiom.confidence": "Confidence",
        "axiom.use_prompt": "Use Prompt",

        "mood.balanced": "Balanced",
        "mood.scout": "Scout",
        "mood.sage": "Sage",
        "mood.spark": "Spark",
        "mood.guide": "Guide",

        "common.save": "Save",
        "common.cancel": "Cancel",
        "common.delete": "Delete",
        "common.edit": "Edit",
        "common.close": "Close",
        "common.loading": "Loading...",
        "common.error": "Error",
        "common.retry": "Retry",
        "common.search": "Search",
        "common.copy": "Copy",
        "common.share": "Share",
    ]

    // MARK: - Spanish Translations

    static let spanishTranslations: [String: String] = [
        "app.name": "Think Tank",
        "app.tagline": "Pensamiento Potenciado por IA",
        "nav.chat": "Chat",
        "nav.history": "Historial",
        "nav.rules": "Mis Reglas",
        "nav.artifacts": "Artefactos",
        "nav.profile": "Perfil",
        "nav.settings": "Configuración",
        "nav.grimoire": "Grimorio",
        "nav.ideas": "Ideas",
        "nav.flash_facts": "Datos Rápidos",
        "nav.governor": "Gobernador",
        "chat.new": "Nuevo Chat",
        "chat.send": "Enviar",
        "chat.placeholder": "Escribe un mensaje...",
        "chat.thinking": "Pensando...",
        "chat.welcome": "Bienvenido a Think Tank",
        "common.save": "Guardar",
        "common.cancel": "Cancelar",
        "common.delete": "Eliminar",
        "common.loading": "Cargando...",
        "common.search": "Buscar",
    ]

    // MARK: - French Translations

    static let frenchTranslations: [String: String] = [
        "app.name": "Think Tank",
        "app.tagline": "Réflexion Assistée par IA",
        "nav.chat": "Discussion",
        "nav.history": "Historique",
        "nav.rules": "Mes Règles",
        "nav.artifacts": "Artefacts",
        "nav.profile": "Profil",
        "nav.settings": "Paramètres",
        "nav.grimoire": "Grimoire",
        "nav.ideas": "Idées",
        "nav.flash_facts": "Faits Rapides",
        "nav.governor": "Gouverneur",
        "chat.new": "Nouvelle Discussion",
        "chat.send": "Envoyer",
        "chat.placeholder": "Tapez un message...",
        "chat.thinking": "Réflexion en cours...",
        "chat.welcome": "Bienvenue sur Think Tank",
        "common.save": "Enregistrer",
        "common.cancel": "Annuler",
        "common.delete": "Supprimer",
        "common.loading": "Chargement...",
        "common.search": "Rechercher",
    ]

    // MARK: - German Translations

    static let germanTranslations: [String: String] = [
        "app.name": "Think Tank",
        "app.tagline": "KI-gestütztes Denken",
        "nav.chat": "Chat",
        "nav.history": "Verlauf",
        "nav.rules": "Meine Regeln",
        "nav.artifacts": "Artefakte",
        "nav.profile": "Profil",
        "nav.settings": "Einstellungen",
        "nav.grimoire": "Grimoire",
        "nav.ideas": "Ideen",
        "nav.flash_facts": "Schnelle Fakten",
        "nav.governor": "Gouverneur",
        "chat.new": "Neuer Chat",
        "chat.send": "Senden",
        "chat.placeholder": "Nachricht eingeben...",
        "chat.thinking": "Denke nach...",
        "chat.welcome": "Willkommen bei Think Tank",
        "common.save": "Speichern",
        "common.cancel": "Abbrechen",
        "common.delete": "Löschen",
        "common.loading": "Laden...",
        "common.search": "Suchen",
    ]

    // MARK: - Japanese Translations

    static let japaneseTranslations: [String: String] = [
        "app.name": "Think Tank",
        "app.tagline": "AI搭載の思考",
        "nav.chat": "チャット",
        "nav.history": "履歴",
        "nav.rules": "マイルール",
        "nav.artifacts": "アーティファクト",
        "nav.profile": "プロフィール",
        "nav.settings": "設定",
        "nav.grimoire": "グリモワール",
        "nav.ideas": "アイデア",
        "nav.flash_facts": "ファクト",
        "nav.governor": "ガバナー",
        "chat.new": "新しいチャット",
        "chat.send": "送信",
        "chat.placeholder": "メッセージを入力...",
        "chat.thinking": "考え中...",
        "chat.welcome": "Think Tankへようこそ",
        "common.save": "保存",
        "common.cancel": "キャンセル",
        "common.delete": "削除",
        "common.loading": "読み込み中...",
        "common.search": "検索",
    ]
}
