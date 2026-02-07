/**
 * State Registry ViewModel
 *
 * Manages state and business logic for the State Registry views.
 *
 * @version 1.0.0
 * @since RADIANT 7.0.0
 */

import SwiftUI
import Combine

@MainActor
final class StateRegistryViewModel: ObservableObject {
    
    // MARK: - Published State
    
    @Published var isLoading = false
    @Published var showError = false
    @Published var errorMessage = ""
    @Published var isOffline = false
    
    // Environment Manifests
    @Published var devManifest: EnvironmentStateManifest?
    @Published var stagingManifest: EnvironmentStateManifest?
    @Published var prodManifest: EnvironmentStateManifest?
    
    // Sync Configurations
    @Published var devSyncConfig: SyncConfiguration = .default
    @Published var stagingSyncConfig: SyncConfiguration = .default
    @Published var prodSyncConfig: SyncConfiguration = .default
    
    // Operations
    @Published var recentSyncs: [SyncOperation] = []
    @Published var recentBackups: [BackupManifest] = []
    @Published var activeSyncOperation: SyncOperation?
    
    // Comparison
    @Published var currentComparison: EnvironmentComparison?
    
    // MARK: - Private Properties
    
    private var service: StateRegistryService?
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - Initialization
    
    init() {
        // Service will be initialized when base URL is available
    }
    
    func configure(with baseURL: URL) {
        service = StateRegistryService(baseURL: baseURL)
        
        // Bind service state
        service?.$isLoading
            .receive(on: DispatchQueue.main)
            .assign(to: &$isLoading)
        
        service?.$isOffline
            .receive(on: DispatchQueue.main)
            .assign(to: &$isOffline)
    }
    
    // MARK: - Dashboard
    
    func loadDashboard() async {
        guard let service = service else { return }
        
        isLoading = true
        defer { isLoading = false }
        
        do {
            let dashboard = try await service.getDashboard()
            
            // Update state from dashboard
            recentSyncs = dashboard.recentSyncs
            recentBackups = dashboard.recentBackups
            
            // Load individual manifests
            await refreshAll()
        } catch {
            handleError(error)
        }
    }
    
    func refreshAll() async {
        guard let service = service else { return }
        
        isLoading = true
        defer { isLoading = false }
        
        await withTaskGroup(of: Void.self) { group in
            for env in EnvironmentName.allCases {
                group.addTask { [weak self] in
                    do {
                        let manifest = try await service.getManifest(environment: env)
                        await self?.updateManifest(manifest, for: env)
                    } catch {
                        // Silently handle errors for individual environments
                    }
                }
            }
        }
    }
    
    // MARK: - Manifest Operations
    
    func manifest(for environment: EnvironmentName) -> EnvironmentStateManifest? {
        switch environment {
        case .dev: return devManifest
        case .staging: return stagingManifest
        case .prod: return prodManifest
        }
    }
    
    func captureManifest(for environment: EnvironmentName) async {
        guard let service = service else { return }
        
        isLoading = true
        defer { isLoading = false }
        
        do {
            let request = CaptureManifestRequest(
                environment: environment,
                capturedBy: NSUserName()
            )
            let manifest = try await service.captureManifest(request: request)
            updateManifest(manifest, for: environment)
        } catch {
            handleError(error)
        }
    }
    
    private func updateManifest(_ manifest: EnvironmentStateManifest, for environment: EnvironmentName) {
        switch environment {
        case .dev: devManifest = manifest
        case .staging: stagingManifest = manifest
        case .prod: prodManifest = manifest
        }
    }
    
    // MARK: - Comparison
    
    func compareEnvironments(source: EnvironmentName, target: EnvironmentName) async {
        guard let service = service else { return }
        
        isLoading = true
        defer { isLoading = false }
        
        do {
            let request = CompareEnvironmentsRequest(
                sourceEnvironment: source,
                targetEnvironment: target,
                comparedBy: NSUserName()
            )
            currentComparison = try await service.compareEnvironments(request: request)
        } catch {
            handleError(error)
        }
    }
    
    // MARK: - Sync Operations
    
    func startSync(
        source: EnvironmentName,
        target: EnvironmentName,
        syncInfrastructure: Bool = false,
        syncData: Bool = true,
        syncFeatures: Bool = true,
        dataItems: [String]? = nil,
        confirmProduction: Bool = false
    ) async -> String? {
        guard let service = service else { return nil }
        
        isLoading = true
        defer { isLoading = false }
        
        do {
            var request = StartSyncRequest(
                sourceEnvironment: source,
                targetEnvironment: target,
                initiatedBy: NSUserName()
            )
            request.syncInfrastructure = syncInfrastructure
            request.syncData = syncData
            request.syncFeatures = syncFeatures
            request.dataItemsToSync = dataItems
            request.confirmProduction = confirmProduction
            
            let operationId = try await service.startSync(request: request)
            
            // Start polling for status
            Task {
                await pollSyncStatus(operationId: operationId)
            }
            
            return operationId
        } catch {
            handleError(error)
            return nil
        }
    }
    
    func cancelSync(operationId: String) async {
        guard let service = service else { return }
        
        do {
            try await service.cancelSync(operationId: operationId)
            activeSyncOperation = nil
        } catch {
            handleError(error)
        }
    }
    
    private func pollSyncStatus(operationId: String) async {
        guard let service = service else { return }
        
        while true {
            do {
                let operation = try await service.getSyncStatus(operationId: operationId)
                activeSyncOperation = operation
                
                if operation.status == .completed || operation.status == .failed {
                    // Refresh manifests after sync completes
                    await refreshAll()
                    break
                }
                
                try await Task.sleep(nanoseconds: 2_000_000_000) // 2 seconds
            } catch {
                break
            }
        }
    }
    
    // MARK: - Sync Configuration
    
    func syncConfig(for environment: EnvironmentName) -> SyncConfiguration {
        switch environment {
        case .dev: return devSyncConfig
        case .staging: return stagingSyncConfig
        case .prod: return prodSyncConfig
        }
    }
    
    func loadSyncConfig(for environment: EnvironmentName) async {
        guard let service = service else { return }
        
        do {
            let config = try await service.getSyncConfig(environment: environment)
            updateSyncConfig(config, for: environment)
        } catch {
            handleError(error)
        }
    }
    
    func updateSyncConfig(_ config: SyncConfiguration, for environment: EnvironmentName) {
        switch environment {
        case .dev: devSyncConfig = config
        case .staging: stagingSyncConfig = config
        case .prod: prodSyncConfig = config
        }
    }
    
    func saveSyncConfig(for environment: EnvironmentName) async {
        guard let service = service else { return }
        
        let config = syncConfig(for: environment)
        
        do {
            try await service.updateSyncConfig(environment: environment, config: config)
        } catch {
            handleError(error)
        }
    }
    
    // MARK: - Backup Operations
    
    func loadBackups(environment: EnvironmentName? = nil) async {
        guard let service = service else { return }
        
        isLoading = true
        defer { isLoading = false }
        
        do {
            recentBackups = try await service.listBackups(environment: environment)
        } catch {
            handleError(error)
        }
    }
    
    func createBackup(
        environment: EnvironmentName,
        type: BackupType = .manual,
        includeInfrastructure: Bool = true,
        includeDatabase: Bool = true,
        includeS3: Bool = true,
        includeSecrets: Bool = false,
        description: String? = nil
    ) async -> String? {
        guard let service = service else { return nil }
        
        isLoading = true
        defer { isLoading = false }
        
        do {
            var request = CreateBackupRequest(
                environment: environment,
                createdBy: NSUserName()
            )
            request.type = type
            request.includeInfrastructure = includeInfrastructure
            request.includeDatabase = includeDatabase
            request.includeS3 = includeS3
            request.includeSecrets = includeSecrets
            request.description = description
            
            let backupId = try await service.createBackup(request: request)
            
            // Refresh backups list
            await loadBackups()
            
            return backupId
        } catch {
            handleError(error)
            return nil
        }
    }
    
    func restoreBackup(
        backupId: String,
        targetEnvironment: EnvironmentName,
        restoreItems: [String]? = nil,
        overwriteExisting: Bool = false
    ) async -> String? {
        guard let service = service else { return nil }
        
        isLoading = true
        defer { isLoading = false }
        
        do {
            var request = RestoreBackupRequest(
                backupId: backupId,
                targetEnvironment: targetEnvironment,
                initiatedBy: NSUserName()
            )
            request.restoreItems = restoreItems
            request.overwriteExisting = overwriteExisting
            request.confirmRestore = true
            
            let operationId = try await service.restoreBackup(request: request)
            return operationId
        } catch {
            handleError(error)
            return nil
        }
    }
    
    func deleteBackup(backupId: String) async {
        guard let service = service else { return }
        
        do {
            try await service.deleteBackup(backupId: backupId)
            recentBackups.removeAll { $0.id == backupId }
        } catch {
            handleError(error)
        }
    }
    
    // MARK: - Persistent Data
    
    func updatePersistentDataItem(environment: EnvironmentName, itemId: String, includeInSync: Bool) async {
        guard let service = service else { return }
        
        do {
            try await service.updatePersistentDataItem(
                environment: environment,
                itemId: itemId,
                includeInSync: includeInSync
            )
        } catch {
            handleError(error)
        }
    }
    
    // MARK: - Health Badge
    
    func healthBadge(for environment: EnvironmentName) -> Text? {
        guard let manifest = manifest(for: environment) else { return nil }
        
        switch manifest.health.overall {
        case .healthy:
            return Text("●").foregroundColor(.green)
        case .degraded:
            return Text("●").foregroundColor(.orange)
        case .unhealthy:
            return Text("●").foregroundColor(.red)
        case .unknown:
            return Text("●").foregroundColor(.gray)
        }
    }
    
    // MARK: - Error Handling
    
    private func handleError(_ error: Error) {
        if let registryError = error as? StateRegistryError {
            errorMessage = registryError.localizedDescription
        } else {
            errorMessage = error.localizedDescription
        }
        showError = true
    }
}
