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
    
    // MARK: - Credential Storage
    @Published var credentialStorageMode: CredentialStorageMode = .local
    @Published var isCredentialStorageUnlocked = false
    @Published var needsCredentialSetup = true
    
    // MARK: - 1Password Status (legacy)
    @Published var onePasswordConfigured = false
    @Published var onePasswordStatus: CredentialService.OnePasswordStatus?
    
    // MARK: - Debug/Testing
    /// Set to true ONLY for local development without 1Password installed
    /// WARNING: When true, uses default placeholder credentials - never deploy with this enabled
    @Published var bypassOnePassword = false
    
    enum CredentialStorageMode: String, CaseIterable, Sendable {
        case local = "Local Encrypted"
        case onePassword = "1Password"
    }
    
    // MARK: - Initialization
    init() {
        Task {
            await loadInitialData()
        }
    }
    
    func loadInitialData() async {
        isLoading = true
        defer { isLoading = false }
        
        // Allow bypass for testing
        if bypassOnePassword {
            onePasswordConfigured = true
            isCredentialStorageUnlocked = true
            needsCredentialSetup = false
            apps = ManagedApp.defaults
            return
        }
        
        // Check local encrypted storage first (preferred)
        let secureStorage = SecureCredentialStorage.shared
        let localConfigured = await secureStorage.isConfigured()
        let localUnlocked = await secureStorage.isStorageUnlocked()
        
        if localConfigured {
            credentialStorageMode = .local
            needsCredentialSetup = false
            isCredentialStorageUnlocked = localUnlocked
            
            if localUnlocked {
                do {
                    credentials = try await secureStorage.getAllCredentials()
                } catch {
                    self.error = AppError(message: "Failed to load credentials", underlying: error)
                }
            }
            apps = ManagedApp.defaults
            return
        }
        
        // Fall back to 1Password check
        onePasswordStatus = await credentialService.checkOnePasswordStatus()
        onePasswordConfigured = onePasswordStatus?.installed == true && onePasswordStatus?.signedIn == true
        
        if onePasswordConfigured {
            credentialStorageMode = .onePassword
            needsCredentialSetup = false
            isCredentialStorageUnlocked = true
            
            do {
                credentials = try await credentialService.loadCredentials()
                apps = try await loadApps()
            } catch {
                self.error = AppError(message: "Failed to load data", underlying: error)
            }
            return
        }
        
        // Neither configured - needs setup
        needsCredentialSetup = true
        apps = ManagedApp.defaults
    }
    
    /// Unlock local credential storage with passphrase
    func unlockCredentialStorage(passphrase: String) async throws {
        let secureStorage = SecureCredentialStorage.shared
        try await secureStorage.unlock(passphrase: passphrase)
        isCredentialStorageUnlocked = true
        credentials = try await secureStorage.getAllCredentials()
    }
    
    /// Lock credential storage
    func lockCredentialStorage() async {
        let secureStorage = SecureCredentialStorage.shared
        await secureStorage.lock()
        isCredentialStorageUnlocked = false
        credentials = []
    }
    
    /// Initialize local credential storage
    func initializeCredentialStorage(passphrase: String) async throws {
        let secureStorage = SecureCredentialStorage.shared
        try await secureStorage.initialize(passphrase: passphrase)
        credentialStorageMode = .local
        needsCredentialSetup = false
        isCredentialStorageUnlocked = true
    }
    
    /// Reload credentials from current storage
    func reloadCredentials() async {
        do {
            if credentialStorageMode == .local {
                let secureStorage = SecureCredentialStorage.shared
                credentials = try await secureStorage.getAllCredentials()
            } else {
                credentials = try await credentialService.loadCredentials()
            }
        } catch {
            self.error = AppError(message: "Failed to reload credentials", underlying: error)
        }
    }
    
    func refreshOnePasswordStatus() async {
        if bypassOnePassword {
            onePasswordConfigured = true
            return
        }
        
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
        
        // Check AWS connectivity and service health
        guard let credential = credentials.first else {
            isConnectedToRadiant = false
            return
        }
        
        let credentialsValid = await AWSService.shared.checkCredentialsValid(credential)
        let apiHealthy = await AWSService.shared.checkAPIHealth(credential: credential)
        let dbHealthy = await AWSService.shared.checkDatabaseHealth(credential: credential)
        
        // Update connection status based on health checks
        isConnectedToRadiant = credentialsValid && apiHealthy && dbHealthy
    }
}

// MARK: - Navigation (v7.5.0 - Added Bi-directional Sync)
enum NavigationTab: String, CaseIterable, Identifiable, Sendable {
    // Core Operations
    case dashboard = "Dashboard"
    case deploy = "Deploy"
    case bidirectionalSync = "Sync from Instance"
    case scripts = "Scripts"
    case codeSync = "Code Sync"
    case dependencies = "Dependencies"
    case credentials = "Credentials"
    case instances = "Instances"
    case packages = "Packages"
    case migrations = "Migrations"
    case snapshots = "Snapshots"
    case history = "History"
    case driftMonitor = "Drift Monitor"
    case spendGovernor = "Spend Governor"
    case intrusionDetection = "Intrusion Detection"
    case credentialLifecycle = "Credential Security"
    case endpointSecurity = "Endpoint Security"
    
    // Configuration (v7.4.0)
    case domainURLs = "Domain URLs"
    case curator = "Curator"
    case cortexMemory = "Cortex Memory"
    
    case settings = "Settings"
    
    var id: String { rawValue }
    
    var icon: String {
        switch self {
        case .dashboard: return "square.grid.2x2"
        case .deploy: return "arrow.up.circle"
        case .bidirectionalSync: return "arrow.triangle.2.circlepath.circle"
        case .scripts: return "doc.text"
        case .codeSync: return "arrow.triangle.2.circlepath"
        case .dependencies: return "wrench.and.screwdriver"
        case .credentials: return "key.horizontal"
        case .instances: return "server.rack"
        case .packages: return "shippingbox"
        case .migrations: return "arrow.right.arrow.left"
        case .snapshots: return "clock.arrow.circlepath"
        case .history: return "clock"
        case .driftMonitor: return "exclamationmark.triangle"
        case .spendGovernor: return "gauge.with.dots.needle.33percent"
        case .intrusionDetection: return "shield.checkered"
        case .credentialLifecycle: return "shield.lefthalf.filled.badge.checkmark"
        case .endpointSecurity: return "lock.shield"
        case .domainURLs: return "globe"
        case .curator: return "book.pages"
        case .cortexMemory: return "brain.head.profile"
        case .settings: return "gearshape"
        }
    }
    
    var color: Color {
        switch self {
        case .dashboard: return .blue
        case .deploy: return .green
        case .bidirectionalSync: return .purple
        case .scripts: return .teal
        case .codeSync: return .mint
        case .dependencies: return .pink
        case .credentials: return .orange
        case .instances: return .purple
        case .packages: return .indigo
        case .migrations: return .orange
        case .snapshots: return .cyan
        case .history: return .brown
        case .driftMonitor: return .red
        case .spendGovernor: return .orange
        case .intrusionDetection: return .blue
        case .credentialLifecycle: return .orange
        case .endpointSecurity: return .red
        case .domainURLs: return .blue
        case .curator: return .teal
        case .cortexMemory: return .purple
        case .settings: return .gray
        }
    }
    
    var description: String {
        switch self {
        case .dashboard: return "Overview of all environments and status"
        case .deploy: return "One-click automated deployment"
        case .bidirectionalSync: return "Extract instance state and generate new package"
        case .scripts: return "Run deployment bash scripts"
        case .codeSync: return "Sync local changes to AWS"
        case .dependencies: return "Manage CLI tools (AWS CLI, Node.js, CDK)"
        case .credentials: return "AWS key management and rotation"
        case .instances: return "Start, stop, or wipe environment instances"
        case .packages: return "Version and package management"
        case .migrations: return "Promote through dev → staging → prod"
        case .snapshots: return "Backup and restore points"
        case .history: return "Deployment history and logs"
        case .driftMonitor: return "Detect and reconcile infrastructure drift"
        case .spendGovernor: return "Budget limits, freeze/thaw AWS services"
        case .intrusionDetection: return "Real-time threat detection & prevention"
        case .credentialLifecycle: return "Credential lifecycle security audit & automation"
        case .endpointSecurity: return "MCP, A2A & REST endpoint penetration testing"
        case .domainURLs: return "Configure domain URLs and routing"
        case .curator: return "Knowledge graph curation settings"
        case .cortexMemory: return "Three-tier memory system configuration"
        case .settings: return "Preferences"
        }
    }
    
    /// Primary tabs shown in sidebar
    static var primaryTabs: [NavigationTab] {
        [.dashboard, .deploy, .bidirectionalSync, .instances, .snapshots, .history, .driftMonitor, .spendGovernor, .intrusionDetection, .credentialLifecycle, .endpointSecurity]
    }
    
    /// Configuration tabs
    static var configTabs: [NavigationTab] {
        [.domainURLs, .curator, .cortexMemory]
    }
    
    /// Tools tabs
    static var toolsTabs: [NavigationTab] {
        [.scripts, .codeSync, .dependencies, .credentials, .packages, .migrations]
    }
    
    /// All tabs in order
    static var allTabs: [NavigationTab] {
        primaryTabs + configTabs + toolsTabs + [.settings]
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
