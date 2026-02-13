import SwiftUI
import Combine

// MARK: - Navigation

enum SidebarTab: String, CaseIterable, Identifiable {
    case playground = "Drive-Thru"
    case menu = "Menu"
    case firmware = "Firmware"
    case cortex = "Cortex"
    case testSuites = "Test Suites"
    case testResults = "Results"
    case datasets = "Datasets"
    case settings = "Settings"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .playground: return "car.side"
        case .menu: return "menucard"
        case .firmware: return "cpu"
        case .cortex: return "brain.head.profile"
        case .testSuites: return "checklist"
        case .testResults: return "chart.bar"
        case .datasets: return "tablecells"
        case .settings: return "gearshape"
        }
    }

    var color: Color {
        switch self {
        case .playground: return .red
        case .menu: return .red
        case .firmware: return .orange
        case .cortex: return .pink
        case .testSuites: return .orange
        case .testResults: return .green
        case .datasets: return .purple
        case .settings: return .gray
        }
    }
}

// MARK: - Menu Categories

enum MenuCategory: String, CaseIterable, Identifiable {
    case breakfast = "breakfast"
    case mainMenu = "main_menu"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .breakfast: return "Breakfast"
        case .mainMenu: return "Main Menu"
        }
    }

    var icon: String {
        switch self {
        case .breakfast: return "sun.horizon"
        case .mainMenu: return "menucard"
        }
    }

    var color: Color {
        switch self {
        case .breakfast: return .yellow
        case .mainMenu: return .red
        }
    }
}

enum MenuSubcategory: String, CaseIterable, Identifiable {
    case burgers = "burgers"
    case chickenAndFish = "chicken_and_fish"
    case friesAndSides = "fries_and_sides"
    case drinks = "specialty_drinks_and_mccafe"
    case desserts = "desserts"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .burgers: return "Burgers"
        case .chickenAndFish: return "Chicken & Fish"
        case .friesAndSides: return "Fries & Sides"
        case .drinks: return "Drinks & McCafé"
        case .desserts: return "Desserts"
        }
    }

    var icon: String {
        switch self {
        case .burgers: return "flame"
        case .chickenAndFish: return "bird"
        case .friesAndSides: return "takeoutbag.and.cup.and.straw"
        case .drinks: return "cup.and.saucer"
        case .desserts: return "birthday.cake"
        }
    }

    var color: Color {
        switch self {
        case .burgers: return .red
        case .chickenAndFish: return .orange
        case .friesAndSides: return .green
        case .drinks: return .blue
        case .desserts: return .pink
        }
    }
}

// MARK: - App State

@MainActor
final class AppState: ObservableObject {
    @Published var selectedTab: SidebarTab = .playground
    @Published var selectedMenuCategory: MenuCategory = .mainMenu
    @Published var chatMessages: [ChatMessage] = []
    @Published var testSuites: [TestSuite] = []
    @Published var testRuns: [TestRun] = []
    @Published var datasets: [TrainingDataset] = []

    var inferenceService: LocalInferenceService
    var cortexService: OmegaCortexService
    var testRunner: TestRunner
    var storageManager: LocalStorageManager

    init() {
        let storage = LocalStorageManager()
        self.storageManager = storage
        self.inferenceService = LocalInferenceService()
        self.cortexService = OmegaCortexService()
        self.testRunner = TestRunner(inferenceService: LocalInferenceService())

        loadPersistedData()
    }

    func loadPersistedData() {
        testSuites = storageManager.loadTestSuites()
        testRuns = storageManager.loadTestRuns()
        datasets = storageManager.loadDatasets()

        if testSuites.isEmpty {
            testSuites = TestSuite.builtInSuites() + TestSuite.mcdonaldsTestSuites()
        }

        if datasets.isEmpty {
            loadBundledDatasets()
        }
    }

    private func loadBundledDatasets() {
        guard let demoDir = storageManager.findDemoDirectory() else {
            print("[AppState] Demo datasets directory not found — skipping bundled dataset install")
            return
        }

        let bundled: [(file: String, name: String, desc: String)] = [
            ("omega-basics-small.jsonl", "OMEGA Basics (Small)", "10 core OMEGA brain architecture training samples"),
            ("omega-comprehensive-large.jsonl", "OMEGA Comprehensive (Large)", "108 samples covering the full OMEGA knowledge base"),
            ("mcdonalds-behavioral-training.jsonl", "McDonald's Drive-Thru (7-Class)", "29,500 behavioral training examples — greet, take_order, customize, complaint, meal_substitution, combo_entree_swap, split_size_selection"),
        ]

        for item in bundled {
            let path = "\(demoDir)/\(item.file)"
            if let dataset = storageManager.loadJSONLDataset(name: item.name, description: item.desc, from: path) {
                datasets.append(dataset)
                print("[AppState] Loaded bundled dataset: \(item.name) (\(dataset.sampleCount) samples)")
            }
        }

        if !datasets.isEmpty {
            saveAll()
        }
    }

    func saveAll() {
        storageManager.saveTestSuites(testSuites)
        storageManager.saveTestRuns(testRuns)
        storageManager.saveDatasets(datasets)
    }
}
