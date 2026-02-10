/**
 * State Registry Service
 *
 * Swift service for managing environment state manifests,
 * comparisons, sync operations, and backups through the State Registry API.
 *
 * @version 1.0.0
 * @since RADIANT 7.0.0
 */

import Foundation
import os.log

// MARK: - Service Errors

public enum StateRegistryError: LocalizedError, Sendable {
    case networkError(String)
    case apiError(statusCode: Int, message: String)
    case decodingError(String)
    case invalidConfiguration
    case manifestNotFound(EnvironmentName)
    case syncFailed(String)
    case backupFailed(String)
    case restoreFailed(String)
    case offlineMode
    
    public var errorDescription: String? {
        switch self {
        case .networkError(let message):
            return "Network error: \(message)"
        case .apiError(let statusCode, let message):
            return "API error (\(statusCode)): \(message)"
        case .decodingError(let message):
            return "Failed to decode response: \(message)"
        case .invalidConfiguration:
            return "Invalid service configuration"
        case .manifestNotFound(let env):
            return "Manifest not found for \(env.displayName)"
        case .syncFailed(let message):
            return "Sync failed: \(message)"
        case .backupFailed(let message):
            return "Backup failed: \(message)"
        case .restoreFailed(let message):
            return "Restore failed: \(message)"
        case .offlineMode:
            return "Cannot perform operation while offline"
        }
    }
}

// MARK: - Service Protocol

public protocol StateRegistryServiceProtocol: Sendable {
    func getDashboard() async throws -> StateRegistryDashboard
    func getManifest(environment: EnvironmentName) async throws -> EnvironmentStateManifest
    func captureManifest(request: CaptureManifestRequest) async throws -> EnvironmentStateManifest
    func compareEnvironments(request: CompareEnvironmentsRequest) async throws -> EnvironmentComparison
    func getSyncConfig(environment: EnvironmentName) async throws -> SyncConfiguration
    func updateSyncConfig(environment: EnvironmentName, config: SyncConfiguration) async throws
    func startSync(request: StartSyncRequest) async throws -> String
    func getSyncStatus(operationId: String) async throws -> SyncOperation
    func cancelSync(operationId: String) async throws
    func listBackups(environment: EnvironmentName?) async throws -> [BackupManifest]
    func createBackup(request: CreateBackupRequest) async throws -> String
    func getBackup(backupId: String) async throws -> BackupManifest
    func restoreBackup(request: RestoreBackupRequest) async throws -> String
    func deleteBackup(backupId: String) async throws
    func getPersistentData(environment: EnvironmentName) async throws -> [PersistentDataItem]
    func updatePersistentDataItem(environment: EnvironmentName, itemId: String, includeInSync: Bool) async throws
}

// MARK: - Service Implementation

@MainActor
public final class StateRegistryService: ObservableObject, StateRegistryServiceProtocol {
    
    // MARK: - Published State
    
    @Published public private(set) var isLoading = false
    @Published public private(set) var lastError: StateRegistryError?
    @Published public private(set) var isOffline = false
    
    // Cached manifests
    @Published public private(set) var devManifest: EnvironmentStateManifest?
    @Published public private(set) var stagingManifest: EnvironmentStateManifest?
    @Published public private(set) var prodManifest: EnvironmentStateManifest?
    
    // Sync configurations
    @Published public private(set) var devSyncConfig: SyncConfiguration?
    @Published public private(set) var stagingSyncConfig: SyncConfiguration?
    @Published public private(set) var prodSyncConfig: SyncConfiguration?
    
    // Active operations
    @Published public private(set) var activeSyncOperations: [SyncOperation] = []
    @Published public private(set) var recentBackups: [BackupManifest] = []
    
    // MARK: - Private Properties
    
    private let logger = Logger(subsystem: "com.radiant.deployer", category: "StateRegistry")
    private let session: URLSession
    private let baseURL: URL
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder
    private let localCache: StateRegistryLocalCache
    
    // MARK: - Initialization
    
    public init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL.appendingPathComponent("api/admin/state-registry")
        self.session = session
        
        self.decoder = JSONDecoder()
        self.decoder.keyDecodingStrategy = .convertFromSnakeCase
        
        self.encoder = JSONEncoder()
        self.encoder.keyEncodingStrategy = .convertToSnakeCase
        
        self.localCache = StateRegistryLocalCache()
    }
    
    // MARK: - Dashboard
    
    public func getDashboard() async throws -> StateRegistryDashboard {
        let response: StateRegistryAPIResponse<StateRegistryDashboard> = try await request(
            method: "GET",
            path: ""
        )
        return response.data
    }
    
    // MARK: - Manifest Operations
    
    public func getManifest(environment: EnvironmentName) async throws -> EnvironmentStateManifest {
        // Check cache first if offline
        if isOffline, let cached = localCache.getManifest(for: environment) {
            logger.info("Returning cached manifest for \(environment.rawValue)")
            return cached
        }
        
        let response: StateRegistryAPIResponse<EnvironmentStateManifest> = try await request(
            method: "GET",
            path: "/manifests/\(environment.rawValue)"
        )
        
        // Cache the manifest
        localCache.saveManifest(response.data, for: environment)
        updateCachedManifest(response.data)
        
        return response.data
    }
    
    public func captureManifest(request: CaptureManifestRequest) async throws -> EnvironmentStateManifest {
        guard !isOffline else { throw StateRegistryError.offlineMode }
        
        struct CaptureResponse: Codable {
            let manifest: EnvironmentStateManifest
            let duration: Int
        }
        
        let response: StateRegistryAPIResponse<CaptureResponse> = try await self.request(
            method: "POST",
            path: "/manifests/\(request.environment.rawValue)/capture",
            body: request
        )
        
        logger.info("Captured manifest for \(request.environment.rawValue) in \(response.data.duration)ms")
        
        // Cache the manifest
        localCache.saveManifest(response.data.manifest, for: request.environment)
        updateCachedManifest(response.data.manifest)
        
        return response.data.manifest
    }
    
    public func refreshAllManifests() async {
        isLoading = true
        defer { isLoading = false }
        
        await withTaskGroup(of: Void.self) { group in
            for env in EnvironmentName.allCases {
                group.addTask { [weak self] in
                    do {
                        _ = try await self?.getManifest(environment: env)
                    } catch {
                        self?.logger.error("Failed to refresh manifest for \(env.rawValue): \(error.localizedDescription)")
                    }
                }
            }
        }
    }
    
    // MARK: - Comparison
    
    public func compareEnvironments(request: CompareEnvironmentsRequest) async throws -> EnvironmentComparison {
        guard !isOffline else { throw StateRegistryError.offlineMode }
        
        let response: StateRegistryAPIResponse<EnvironmentComparison> = try await self.request(
            method: "POST",
            path: "/compare",
            body: request
        )
        
        return response.data
    }
    
    // MARK: - Sync Configuration
    
    public func getSyncConfig(environment: EnvironmentName) async throws -> SyncConfiguration {
        struct ConfigResponse: Codable {
            let environment: EnvironmentName
            let config: SyncConfiguration
        }
        
        let response: StateRegistryAPIResponse<ConfigResponse> = try await request(
            method: "GET",
            path: "/config/\(environment.rawValue)"
        )
        
        updateCachedSyncConfig(response.data.config, for: environment)
        return response.data.config
    }
    
    public func updateSyncConfig(environment: EnvironmentName, config: SyncConfiguration) async throws {
        guard !isOffline else { throw StateRegistryError.offlineMode }
        
        let _: StateRegistryAPIResponse<EmptyResponse> = try await request(
            method: "PUT",
            path: "/config/\(environment.rawValue)",
            body: config
        )
        
        updateCachedSyncConfig(config, for: environment)
        logger.info("Updated sync config for \(environment.rawValue)")
    }
    
    // MARK: - Sync Operations
    
    public func startSync(request: StartSyncRequest) async throws -> String {
        guard !isOffline else { throw StateRegistryError.offlineMode }
        
        struct SyncStartResponse: Codable {
            let operationId: String
            let message: String
        }
        
        let response: StateRegistryAPIResponse<SyncStartResponse> = try await self.request(
            method: "POST",
            path: "/sync",
            body: request
        )
        
        logger.info("Started sync operation: \(response.data.operationId)")
        return response.data.operationId
    }
    
    public func getSyncStatus(operationId: String) async throws -> SyncOperation {
        let response: StateRegistryAPIResponse<SyncOperation> = try await request(
            method: "GET",
            path: "/sync/\(operationId)"
        )
        
        // Update active operations list
        if let index = activeSyncOperations.firstIndex(where: { $0.id == operationId }) {
            activeSyncOperations[index] = response.data
        } else {
            activeSyncOperations.append(response.data)
        }
        
        return response.data
    }
    
    public func cancelSync(operationId: String) async throws {
        guard !isOffline else { throw StateRegistryError.offlineMode }
        
        let _: StateRegistryAPIResponse<EmptyResponse> = try await request(
            method: "POST",
            path: "/sync/\(operationId)/cancel"
        )
        
        // Update local state
        if let index = activeSyncOperations.firstIndex(where: { $0.id == operationId }) {
            activeSyncOperations.remove(at: index)
        }
        
        logger.info("Cancelled sync operation: \(operationId)")
    }
    
    public func getSyncHistory(environment: EnvironmentName? = nil, limit: Int = 20) async throws -> [SyncOperation] {
        var queryParams = "?limit=\(limit)"
        if let env = environment {
            queryParams += "&environment=\(env.rawValue)"
        }
        
        struct HistoryResponse: Codable {
            let history: [SyncOperation]
        }
        
        let response: StateRegistryAPIResponse<HistoryResponse> = try await request(
            method: "GET",
            path: "/sync/history\(queryParams)"
        )
        
        return response.data.history
    }
    
    // MARK: - Backup Operations
    
    public func listBackups(environment: EnvironmentName? = nil) async throws -> [BackupManifest] {
        var queryParams = ""
        if let env = environment {
            queryParams = "?environment=\(env.rawValue)"
        }
        
        struct BackupsResponse: Codable {
            let backups: [BackupManifest]
        }
        
        let response: StateRegistryAPIResponse<BackupsResponse> = try await request(
            method: "GET",
            path: "/backups\(queryParams)"
        )
        
        recentBackups = response.data.backups
        return response.data.backups
    }
    
    public func createBackup(request: CreateBackupRequest) async throws -> String {
        guard !isOffline else { throw StateRegistryError.offlineMode }
        
        struct BackupResponse: Codable {
            let backupId: String
            let message: String
        }
        
        let response: StateRegistryAPIResponse<BackupResponse> = try await self.request(
            method: "POST",
            path: "/backups",
            body: request
        )
        
        logger.info("Created backup: \(response.data.backupId)")
        return response.data.backupId
    }
    
    public func getBackup(backupId: String) async throws -> BackupManifest {
        let response: StateRegistryAPIResponse<BackupManifest> = try await request(
            method: "GET",
            path: "/backups/\(backupId)"
        )
        
        return response.data
    }
    
    public func restoreBackup(request: RestoreBackupRequest) async throws -> String {
        guard !isOffline else { throw StateRegistryError.offlineMode }
        
        struct RestoreResponse: Codable {
            let restoreOperationId: String
            let backupId: String
            let targetEnvironment: EnvironmentName
            let message: String
        }
        
        let response: StateRegistryAPIResponse<RestoreResponse> = try await self.request(
            method: "POST",
            path: "/backups/\(request.backupId)/restore",
            body: request
        )
        
        logger.info("Started restore: \(response.data.restoreOperationId)")
        return response.data.restoreOperationId
    }
    
    public func deleteBackup(backupId: String) async throws {
        guard !isOffline else { throw StateRegistryError.offlineMode }
        
        let _: StateRegistryAPIResponse<EmptyResponse> = try await request(
            method: "DELETE",
            path: "/backups/\(backupId)"
        )
        
        // Update local state
        recentBackups.removeAll { $0.id == backupId }
        logger.info("Deleted backup: \(backupId)")
    }
    
    // MARK: - Persistent Data
    
    public func getPersistentData(environment: EnvironmentName) async throws -> [PersistentDataItem] {
        struct DataResponse: Codable {
            let environment: EnvironmentName
            let persistentData: [PersistentDataItem]
        }
        
        let response: StateRegistryAPIResponse<DataResponse> = try await request(
            method: "GET",
            path: "/persistent-data/\(environment.rawValue)"
        )
        
        return response.data.persistentData
    }
    
    public func updatePersistentDataItem(environment: EnvironmentName, itemId: String, includeInSync: Bool) async throws {
        guard !isOffline else { throw StateRegistryError.offlineMode }
        
        struct UpdateRequest: Codable {
            let itemId: String
            let includeInSync: Bool
        }
        
        let _: StateRegistryAPIResponse<EmptyResponse> = try await request(
            method: "PUT",
            path: "/persistent-data/\(environment.rawValue)",
            body: UpdateRequest(itemId: itemId, includeInSync: includeInSync)
        )
        
        logger.info("Updated persistent data item \(itemId) for \(environment.rawValue)")
    }
    
    // MARK: - Offline Support
    
    public func setOfflineMode(_ offline: Bool) {
        isOffline = offline
        if offline {
            logger.info("Entering offline mode")
        } else {
            logger.info("Exiting offline mode")
        }
    }
    
    public func syncOnStartup() async {
        logger.info("Syncing state registry on startup...")
        
        // Load cached manifests
        for env in EnvironmentName.allCases {
            if let cached = localCache.getManifest(for: env) {
                updateCachedManifest(cached)
            }
        }
        
        // Try to refresh from server
        await refreshAllManifests()
    }
    
    // MARK: - Private Helpers
    
    private func request<T: Decodable>(
        method: String,
        path: String
    ) async throws -> StateRegistryAPIResponse<T> {
        let url = baseURL.appendingPathComponent(path)
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        return try await executeRequest(request)
    }
    
    private func request<T: Decodable, B: Encodable>(
        method: String,
        path: String,
        body: B
    ) async throws -> StateRegistryAPIResponse<T> {
        let url = baseURL.appendingPathComponent(path)
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(body)
        
        return try await executeRequest(request)
    }
    
    private func executeRequest<T: Decodable>(_ request: URLRequest) async throws -> StateRegistryAPIResponse<T> {
        do {
            let (data, response) = try await session.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw StateRegistryError.networkError("Invalid response")
            }
            
            if httpResponse.statusCode >= 400 {
                // Try to decode error message
                if let errorResponse = try? decoder.decode(APIErrorResponse.self, from: data) {
                    throw StateRegistryError.apiError(
                        statusCode: httpResponse.statusCode,
                        message: errorResponse.error
                    )
                }
                throw StateRegistryError.apiError(
                    statusCode: httpResponse.statusCode,
                    message: "Request failed"
                )
            }
            
            do {
                return try decoder.decode(StateRegistryAPIResponse<T>.self, from: data)
            } catch {
                throw StateRegistryError.decodingError(error.localizedDescription)
            }
        } catch let error as StateRegistryError {
            lastError = error
            throw error
        } catch {
            let registryError = StateRegistryError.networkError(error.localizedDescription)
            lastError = registryError
            throw registryError
        }
    }
    
    private func updateCachedManifest(_ manifest: EnvironmentStateManifest) {
        switch manifest.environment {
        case .dev:
            devManifest = manifest
        case .staging:
            stagingManifest = manifest
        case .prod:
            prodManifest = manifest
        }
    }
    
    private func updateCachedSyncConfig(_ config: SyncConfiguration, for environment: EnvironmentName) {
        switch environment {
        case .dev:
            devSyncConfig = config
        case .staging:
            stagingSyncConfig = config
        case .prod:
            prodSyncConfig = config
        }
    }
}

// MARK: - Response Types

private struct StateRegistryAPIResponse<T: Decodable>: Decodable {
    let success: Bool
    let data: T
}

private struct APIErrorResponse: Decodable {
    let success: Bool
    let error: String
}

private struct EmptyResponse: Codable {}

// MARK: - Local Cache

final class StateRegistryLocalCache: @unchecked Sendable {
    private let fileManager = FileManager.default
    private let cacheDirectory: URL
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    
    init() {
        let appSupport = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        cacheDirectory = appSupport.appendingPathComponent("RadiantDeployer/StateRegistry")
        
        try? fileManager.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
        
        encoder.keyEncodingStrategy = .convertToSnakeCase
        decoder.keyDecodingStrategy = .convertFromSnakeCase
    }
    
    func getManifest(for environment: EnvironmentName) -> EnvironmentStateManifest? {
        let file = cacheDirectory.appendingPathComponent("manifest-\(environment.rawValue).json")
        guard let data = try? Data(contentsOf: file) else { return nil }
        return try? decoder.decode(EnvironmentStateManifest.self, from: data)
    }
    
    func saveManifest(_ manifest: EnvironmentStateManifest, for environment: EnvironmentName) {
        let file = cacheDirectory.appendingPathComponent("manifest-\(environment.rawValue).json")
        guard let data = try? encoder.encode(manifest) else { return }
        try? data.write(to: file)
    }
    
    func clearCache() {
        try? fileManager.removeItem(at: cacheDirectory)
        try? fileManager.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
    }
}
