import SwiftUI
import Combine

@MainActor
final class AppState: ObservableObject {
    // MARK: - Navigation
    @Published var selectedTab: NavigationTab = .dashboard
    @Published var selectedApp: ManagedApp?
    @Published var selectedEnvironment: DeployEnvironment = .dev
    
    // MARK: - UI State
    @Published var showInspector: Bool = false
    @Published var showAIAssistant: Bool = false
    @Published var sidebarWidth: CGFloat = 240
    @Published var inspectorWidth: CGFloat = 280
    @Published var columnVisibility: NavigationSplitViewVisibility = .all
    
    // MARK: - Data
    @Published var apps: [ManagedApp] = []
    @Published var credentials: [CredentialSet] = []
    @Published var isLoading = false
    @Published var error: AppError?
    
    // MARK: - Deployment
    @Published var isDeploying = false
    @Published var deploymentProgress: DeploymentProgress?
    @Published var deploymentLogs: [LogEntry] = []
    
    // MARK: - Services
    let credentialService = CredentialService()
    let cdkService = CDKService()
    let awsService = AWSService()
    let aiRegistryService = AIRegistryService()
    
    // MARK: - Radiant Connection
    @Published var radiantBaseURL: String?
    @Published var radiantAuthToken: String?
    @Published var isConnectedToRadiant = false
    
    // MARK: - 1Password Status
    @Published var onePasswordConfigured = false
    @Published var onePasswordStatus: CredentialService.OnePasswordStatus?
    
    // MARK: - Initialization
    init() {
        Task {
            await loadInitialData()
        }
    }
    
    func loadInitialData() async {
        isLoading = true
        defer { isLoading = false }
        
        // Check 1Password status first
        onePasswordStatus = await credentialService.checkOnePasswordStatus()
        onePasswordConfigured = onePasswordStatus?.installed == true && onePasswordStatus?.signedIn == true
        
        guard onePasswordConfigured else {
            apps = ManagedApp.defaults
            return
        }
        
        do {
            credentials = try await credentialService.loadCredentials()
            apps = try await loadApps()
        } catch {
            self.error = AppError(message: "Failed to load data", underlying: error)
        }
    }
    
    func refreshOnePasswordStatus() async {
        onePasswordStatus = await credentialService.checkOnePasswordStatus()
        onePasswordConfigured = onePasswordStatus?.installed == true && onePasswordStatus?.signedIn == true
        
        if onePasswordConfigured {
            do {
                credentials = try await credentialService.loadCredentials()
            } catch {
                self.error = AppError(message: "Failed to load credentials", underlying: error)
            }
        }
    }
    
    private func loadApps() async throws -> [ManagedApp] {
        return ManagedApp.defaults
    }
    
    // MARK: - Commands
    
    func refreshAllStatus() async {
        isLoading = true
        defer { isLoading = false }
        
        do {
            credentials = try await credentialService.loadCredentials()
            apps = try await loadApps()
        } catch {
            self.error = AppError(message: "Failed to refresh status", underlying: error)
        }
    }
    
    func runHealthCheck() async {
        // Health check implementation
        isLoading = true
        defer { isLoading = false }
        
        // TODO: Implement health check logic
    }
}

// MARK: - Navigation
enum NavigationTab: String, CaseIterable, Identifiable, Sendable {
    // Main
    case dashboard = "Dashboard"
    case apps = "Apps"
    case deploy = "Deploy"
    
    // Operations
    case instances = "Instances"
    case snapshots = "Snapshots"
    case packages = "Packages"
    case history = "History"
    
    // AI Registry
    case providers = "Providers"
    case models = "Models"
    case selfHosted = "Self-Hosted"
    
    // Configuration
    case domains = "Domains"
    case email = "Email"
    
    // Advanced
    case multiRegion = "Multi-Region"
    case abTesting = "A/B Testing"
    
    // Security & Compliance
    case security = "Security"
    case compliance = "Compliance"
    
    // System
    case costs = "Costs"
    case settings = "Settings"
    
    var id: String { rawValue }
    
    var icon: String {
        switch self {
        case .dashboard: return "square.grid.2x2"
        case .apps: return "app.badge"
        case .deploy: return "arrow.up.circle"
        case .instances: return "server.rack"
        case .snapshots: return "clock.arrow.circlepath"
        case .packages: return "shippingbox"
        case .history: return "clock"
        case .providers: return "building.2"
        case .models: return "cpu"
        case .selfHosted: return "memorychip"
        case .domains: return "globe.americas"
        case .email: return "envelope"
        case .multiRegion: return "globe"
        case .abTesting: return "flask"
        case .security: return "shield.lefthalf.filled"
        case .compliance: return "checkmark.shield"
        case .costs: return "dollarsign.circle"
        case .settings: return "gearshape"
        }
    }
    
    var color: Color {
        switch self {
        case .dashboard: return .blue
        case .apps: return .purple
        case .deploy: return .green
        case .instances: return .orange
        case .snapshots: return .cyan
        case .packages: return .indigo
        case .history: return .brown
        case .providers: return .teal
        case .models: return .pink
        case .selfHosted: return .mint
        case .domains: return .cyan
        case .email: return .orange
        case .multiRegion: return .blue
        case .abTesting: return .purple
        case .security: return .red
        case .compliance: return .green
        case .costs: return .yellow
        case .settings: return .gray
        }
    }
    
    static var mainTabs: [NavigationTab] {
        [.dashboard, .apps, .deploy]
    }
    
    static var operationTabs: [NavigationTab] {
        [.instances, .snapshots, .packages, .history]
    }
    
    static var aiTabs: [NavigationTab] {
        [.providers, .models, .selfHosted]
    }
    
    static var configTabs: [NavigationTab] {
        [.domains, .email]
    }
    
    static var advancedTabs: [NavigationTab] {
        [.multiRegion, .abTesting]
    }
    
    static var securityTabs: [NavigationTab] {
        [.security, .compliance]
    }
    
    static var systemTabs: [NavigationTab] {
        [.costs, .settings]
    }
}

// MARK: - DeployEnvironment
enum DeployEnvironment: String, CaseIterable, Identifiable, Sendable, Codable {
    case dev = "Development"
    case staging = "Staging"
    case prod = "Production"
    
    var id: String { rawValue }
    
    var shortName: String {
        switch self {
        case .dev: return "DEV"
        case .staging: return "STAGING"
        case .prod: return "PROD"
        }
    }
    
    var color: Color {
        switch self {
        case .dev: return .blue
        case .staging: return .orange
        case .prod: return .green
        }
    }
}

// MARK: - Error
struct AppError: Identifiable, Sendable {
    let id = UUID()
    let message: String
    let underlying: (any Error)?
    
    var localizedDescription: String {
        if let underlying = underlying {
            return "\(message): \(underlying.localizedDescription)"
        }
        return message
    }
}
