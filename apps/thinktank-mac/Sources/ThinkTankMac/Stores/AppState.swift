import Foundation
import SwiftUI
import Combine

@MainActor
final class AppState: ObservableObject {
    // MARK: - UI State
    @Published var isSidebarVisible: Bool = true
    @Published var advancedMode: Bool {
        didSet { UserDefaults.standard.set(advancedMode, forKey: "advancedMode") }
    }
    @Published var focusMode: Bool = false
    @Published var soundEnabled: Bool {
        didSet { UserDefaults.standard.set(soundEnabled, forKey: "soundEnabled") }
    }

    // MARK: - Navigation
    @Published var selectedSection: NavigationSection = .chat
    @Published var selectedConversationId: String?

    // MARK: - Auth
    @Published var isAuthenticated: Bool = false
    @Published var currentUserId: String?
    @Published var userDisplayName: String?

    // MARK: - Data
    @Published var models: [AIModel] = []
    @Published var domains: [DomainMode] = []
    @Published var selectedModelId: String?
    @Published var selectedDomainId: String?

    // MARK: - Status
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?

    private let modelService = ModelService()
    private let domainService = DomainModeService()

    init() {
        self.advancedMode = UserDefaults.standard.bool(forKey: "advancedMode")
        self.soundEnabled = UserDefaults.standard.object(forKey: "soundEnabled") as? Bool ?? true

        setupNotifications()
    }

    private func setupNotifications() {
        NotificationCenter.default.addObserver(forName: .toggleAdvancedMode, object: nil, queue: .main) { [weak self] _ in
            self?.advancedMode.toggle()
        }
        NotificationCenter.default.addObserver(forName: .toggleFocusMode, object: nil, queue: .main) { [weak self] _ in
            self?.focusMode.toggle()
        }
    }

    func loadInitialData() async {
        isLoading = true
        defer { isLoading = false }

        do {
            async let modelsTask = modelService.listModels()
            async let domainsTask = domainService.listDomains()
            let (fetchedModels, fetchedDomains) = try await (modelsTask, domainsTask)
            models = fetchedModels
            domains = fetchedDomains
            if selectedModelId == nil, let first = models.first {
                selectedModelId = first.id
            }
        } catch {
            errorMessage = "Failed to load data: \(error.localizedDescription)"
        }
    }

    func clearError() {
        errorMessage = nil
    }
}

enum NavigationSection: String, CaseIterable, Identifiable {
    case chat
    case rules
    case grimoire
    case ideas
    case flashFacts
    case history
    case artifacts
    case governor
    case settings
    case profile

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .chat: return "Chat"
        case .rules: return "My Rules"
        case .grimoire: return "Grimoire"
        case .ideas: return "Ideas"
        case .flashFacts: return "Flash Facts"
        case .history: return "History"
        case .artifacts: return "Artifacts"
        case .governor: return "Governor"
        case .settings: return "Settings"
        case .profile: return "Profile"
        }
    }

    var systemImage: String {
        switch self {
        case .chat: return "bubble.left.and.bubble.right"
        case .rules: return "list.bullet.clipboard"
        case .grimoire: return "wand.and.stars"
        case .ideas: return "lightbulb"
        case .flashFacts: return "bolt.circle"
        case .history: return "clock"
        case .artifacts: return "doc.on.doc"
        case .governor: return "gauge.with.dots.needle.33percent"
        case .settings: return "gearshape"
        case .profile: return "person.circle"
        }
    }
}
