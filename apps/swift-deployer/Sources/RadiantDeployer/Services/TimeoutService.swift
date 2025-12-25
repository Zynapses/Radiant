import Foundation

/// Timeout Service for managing operation timeouts
/// Syncs with SSM Parameter Store for centralized configuration
actor TimeoutService {
    
    // MARK: - Types
    
    struct OperationTimeout: Codable, Sendable, Hashable {
        let operationName: String
        var timeoutSeconds: Int
        var retryCount: Int
        var retryDelayMs: Int
        var isActive: Bool
        
        func hash(into hasher: inout Hasher) {
            hasher.combine(operationName)
        }
        
        static func == (lhs: OperationTimeout, rhs: OperationTimeout) -> Bool {
            lhs.operationName == rhs.operationName
        }
        
        static let defaults: [OperationTimeout] = [
            OperationTimeout(operationName: "cdk_bootstrap", timeoutSeconds: 600, retryCount: 2, retryDelayMs: 5000, isActive: true),
            OperationTimeout(operationName: "cdk_deploy", timeoutSeconds: 1800, retryCount: 1, retryDelayMs: 10000, isActive: true),
            OperationTimeout(operationName: "cdk_destroy", timeoutSeconds: 900, retryCount: 1, retryDelayMs: 5000, isActive: true),
            OperationTimeout(operationName: "migration_run", timeoutSeconds: 300, retryCount: 3, retryDelayMs: 2000, isActive: true),
            OperationTimeout(operationName: "health_check", timeoutSeconds: 30, retryCount: 5, retryDelayMs: 1000, isActive: true),
            OperationTimeout(operationName: "model_inference", timeoutSeconds: 120, retryCount: 2, retryDelayMs: 3000, isActive: true),
            OperationTimeout(operationName: "api_request", timeoutSeconds: 30, retryCount: 3, retryDelayMs: 1000, isActive: true),
            OperationTimeout(operationName: "file_upload", timeoutSeconds: 300, retryCount: 2, retryDelayMs: 5000, isActive: true),
        ]
    }
    
    enum TimeoutError: Error, LocalizedError {
        case operationTimedOut(String, Int)
        case maxRetriesExceeded(String, Int)
        case operationNotFound(String)
        case cancelled
        
        var errorDescription: String? {
            switch self {
            case .operationTimedOut(let op, let seconds):
                return "Operation '\(op)' timed out after \(seconds) seconds"
            case .maxRetriesExceeded(let op, let retries):
                return "Operation '\(op)' failed after \(retries) retries"
            case .operationNotFound(let op):
                return "Unknown operation: \(op)"
            case .cancelled:
                return "Operation was cancelled"
            }
        }
    }
    
    // MARK: - Properties
    
    private var timeouts: [String: OperationTimeout] = [:]
    private var lastSyncTime: Date?
    private let syncInterval: TimeInterval = 60 // 60 seconds per PROMPT-33 spec
    private var cancellationTokens: Set<UUID> = []
    private var pollingTask: Task<Void, Never>?
    private var isPolling = false
    private var currentCredentials: CredentialSet?
    
    // MARK: - Initialization
    
    init() {
        // Load defaults
        for timeout in OperationTimeout.defaults {
            timeouts[timeout.operationName] = timeout
        }
    }
    
    // MARK: - SSM Polling (60s interval per PROMPT-33)
    
    /// Start continuous SSM parameter polling
    func startSSMPolling(credentials: CredentialSet, appId: String, environment: String) {
        guard !isPolling else { return }
        
        isPolling = true
        currentCredentials = credentials
        
        pollingTask = Task {
            while !Task.isCancelled && isPolling {
                do {
                    try await syncFromSSMWithPath(
                        credentials: credentials,
                        basePath: "/radiant/\(appId)/\(environment)/config/timeouts"
                    )
                } catch {
                    // Log but don't stop polling
                    print("SSM sync error: \(error.localizedDescription)")
                }
                
                // Wait 60 seconds before next poll
                try? await Task.sleep(nanoseconds: 60_000_000_000)
            }
        }
    }
    
    /// Stop SSM polling
    func stopSSMPolling() {
        isPolling = false
        pollingTask?.cancel()
        pollingTask = nil
    }
    
    /// Sync timeouts from SSM with specific path
    func syncFromSSMWithPath(credentials: CredentialSet, basePath: String) async throws {
        // In production, this would call AWS SSM GetParametersByPath
        // Simulated SSM fetch with realistic latency
        try await Task.sleep(nanoseconds: 200_000_000)
        
        // Simulated parameters from SSM
        let ssmTimeouts: [String: [String: Any]] = [
            "cdk_deploy": ["timeout": 1800, "retries": 1, "retryDelay": 10000],
            "cdk_bootstrap": ["timeout": 600, "retries": 2, "retryDelay": 5000],
            "health_check": ["timeout": 30, "retries": 5, "retryDelay": 1000],
            "migration_run": ["timeout": 300, "retries": 3, "retryDelay": 2000],
            "model_inference": ["timeout": 120, "retries": 2, "retryDelay": 3000],
        ]
        
        for (operationName, params) in ssmTimeouts {
            if var timeout = timeouts[operationName] {
                if let timeoutVal = params["timeout"] as? Int {
                    timeout.timeoutSeconds = timeoutVal
                }
                if let retries = params["retries"] as? Int {
                    timeout.retryCount = retries
                }
                if let delay = params["retryDelay"] as? Int {
                    timeout.retryDelayMs = delay
                }
                timeouts[operationName] = timeout
            }
        }
        
        lastSyncTime = Date()
    }
    
    /// Check if polling is active
    func isSSMPollingActive() -> Bool {
        isPolling
    }
    
    /// Get last sync time
    func getLastSyncTime() -> Date? {
        lastSyncTime
    }
    
    // MARK: - Public Methods
    
    /// Get timeout configuration for an operation
    func getTimeout(for operation: String) -> OperationTimeout? {
        return timeouts[operation]
    }
    
    /// Update timeout configuration
    func updateTimeout(_ timeout: OperationTimeout) {
        timeouts[timeout.operationName] = timeout
    }
    
    /// Get all timeout configurations
    func getAllTimeouts() -> [OperationTimeout] {
        return Array(timeouts.values)
    }
    
    /// Execute an operation with timeout and retry support
    func execute<T: Sendable>(
        operation: String,
        task: @escaping @Sendable () async throws -> T
    ) async throws -> T {
        guard let config = timeouts[operation] else {
            throw TimeoutError.operationNotFound(operation)
        }
        
        guard config.isActive else {
            // If timeout is disabled, just run the task
            return try await task()
        }
        
        var lastError: Error?
        
        for attempt in 1...config.retryCount {
            do {
                return try await withTimeout(seconds: config.timeoutSeconds) {
                    try await task()
                }
            } catch is TimeoutError {
                lastError = TimeoutError.operationTimedOut(operation, config.timeoutSeconds)
                
                if attempt < config.retryCount {
                    // Wait before retry
                    try await Task.sleep(nanoseconds: UInt64(config.retryDelayMs) * 1_000_000)
                }
            } catch {
                lastError = error
                
                if attempt < config.retryCount {
                    try await Task.sleep(nanoseconds: UInt64(config.retryDelayMs) * 1_000_000)
                }
            }
        }
        
        throw lastError ?? TimeoutError.maxRetriesExceeded(operation, config.retryCount)
    }
    
    /// Execute with cancellation support
    func executeWithCancellation<T: Sendable>(
        operation: String,
        cancellationToken: UUID,
        task: @escaping @Sendable () async throws -> T
    ) async throws -> T {
        cancellationTokens.insert(cancellationToken)
        defer { cancellationTokens.remove(cancellationToken) }
        
        return try await execute(operation: operation) {
            // Check for cancellation before starting
            if await self.isCancelled(cancellationToken) {
                throw TimeoutError.cancelled
            }
            return try await task()
        }
    }
    
    /// Cancel an operation
    func cancel(_ token: UUID) {
        cancellationTokens.remove(token)
    }
    
    /// Check if operation is cancelled
    func isCancelled(_ token: UUID) -> Bool {
        return !cancellationTokens.contains(token)
    }
    
    // MARK: - SSM Sync
    
    /// Sync timeouts from SSM Parameter Store
    func syncFromSSM(credentials: CredentialSet) async throws {
        // In production, this would call AWS SSM GetParameters
        // For now, we'll simulate the sync
        
        guard shouldSync() else { return }
        
        // Simulated SSM parameters
        let ssmParams: [String: Int] = [
            "/radiant/timeouts/cdk_deploy": 1800,
            "/radiant/timeouts/cdk_bootstrap": 600,
            "/radiant/timeouts/health_check": 30,
        ]
        
        for (key, value) in ssmParams {
            let operationName = key.split(separator: "/").last.map(String.init) ?? ""
            if var timeout = timeouts[operationName] {
                timeout.timeoutSeconds = value
                timeouts[operationName] = timeout
            }
        }
        
        lastSyncTime = Date()
    }
    
    /// Push timeouts to SSM Parameter Store
    func pushToSSM(credentials: CredentialSet) async throws {
        // In production, this would call AWS SSM PutParameter
        // For now, we'll just log
        print("Would push \(timeouts.count) timeout configurations to SSM")
    }
    
    // MARK: - Private Methods
    
    private func shouldSync() -> Bool {
        guard let lastSync = lastSyncTime else { return true }
        return Date().timeIntervalSince(lastSync) > syncInterval
    }
    
    private func withTimeout<T: Sendable>(
        seconds: Int,
        task: @escaping @Sendable () async throws -> T
    ) async throws -> T {
        try await withThrowingTaskGroup(of: T.self) { group in
            group.addTask {
                try await task()
            }
            
            group.addTask {
                try await Task.sleep(nanoseconds: UInt64(seconds) * 1_000_000_000)
                throw TimeoutError.operationTimedOut("", seconds)
            }
            
            let result = try await group.next()!
            group.cancelAll()
            return result
        }
    }
}

// MARK: - Singleton

extension TimeoutService {
    static let shared = TimeoutService()
}

// MARK: - CredentialSet Extension for Type

extension CredentialSet {
    // Add any needed credential handling for SSM
}
