import SwiftUI
import Combine

@MainActor
final class AppState: ObservableObject {
    // MARK: - Navigation
    @Published var selectedTab: NavigationTab = .apps
    @Published var selectedApp: ManagedApp?
    @Published var selectedEnvironment: DeployEnvironment = .dev
    
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
    
    // MARK: - Initialization
    init() {
        Task {
            await loadInitialData()
        }
    }
    
    func loadInitialData() async {
        isLoading = true
        defer { isLoading = false }
        
        do {
            credentials = try await credentialService.loadCredentials()
            apps = try await loadApps()
        } catch {
            self.error = AppError(message: "Failed to load data", underlying: error)
        }
    }
    
    private func loadApps() async throws -> [ManagedApp] {
        return ManagedApp.defaults
    }
}

// MARK: - Navigation
enum NavigationTab: String, CaseIterable, Identifiable, Sendable {
    case apps = "Apps"
    case deploy = "Deploy"
    case providers = "Providers"
    case models = "Models"
    case settings = "Settings"
    
    var id: String { rawValue }
    
    var icon: String {
        switch self {
        case .apps: return "square.grid.2x2"
        case .deploy: return "arrow.up.circle"
        case .providers: return "building.2"
        case .models: return "cpu"
        case .settings: return "gearshape"
        }
    }
}

// MARK: - DeployEnvironment
enum DeployEnvironment: String, CaseIterable, Identifiable, Sendable {
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
