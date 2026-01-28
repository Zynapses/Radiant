import Foundation

/// Deployment Lock Service with DynamoDB heartbeat per PROMPT-33 spec
/// Prevents concurrent deployments with 120s stale lock detection
actor DeploymentLockService {
    
    // MARK: - Types
    
    enum LockError: Error, LocalizedError {
        case lockHeld(by: String, since: Date)
        case lockAcquisitionFailed(String)
        case lockReleaseFailed(String)
        case lockExpired
        case heartbeatFailed
        
        var errorDescription: String? {
            switch self {
            case .lockHeld(let owner, let since):
                return "Deployment lock held by \(owner) since \(since.formatted())"
            case .lockAcquisitionFailed(let reason):
                return "Failed to acquire lock: \(reason)"
            case .lockReleaseFailed(let reason):
                return "Failed to release lock: \(reason)"
            case .lockExpired:
                return "Lock expired due to missed heartbeats"
            case .heartbeatFailed:
                return "Failed to send heartbeat"
            }
        }
    }
    
    struct DeploymentLock: Codable, Sendable {
        let lockId: String
        let appId: String
        let environment: String
        let owner: String
        let ownerId: String
        let acquiredAt: Date
        var lastHeartbeat: Date
        var expiresAt: Date
        let metadata: [String: String]
    }
    
    struct LockStatus: Sendable {
        let isLocked: Bool
        let lock: DeploymentLock?
        let isOwnedByMe: Bool
        let timeUntilExpiry: TimeInterval?
    }
    
    // MARK: - Properties
    
    private let heartbeatIntervalSeconds: TimeInterval = 30
    private let lockTimeoutSeconds: TimeInterval = 120 // Stale after 120s without heartbeat
    private let awsService: AWSService
    
    private var currentLock: DeploymentLock?
    private var heartbeatTask: Task<Void, Never>?
    private let instanceId: String
    
    // MARK: - Initialization
    
    init(awsService: AWSService) {
        self.awsService = awsService
        self.instanceId = UUID().uuidString
    }
    
    // MARK: - Lock Acquisition
    
    func acquireLock(
        appId: String,
        environment: String,
        owner: String = NSUserName(),
        force: Bool = false
    ) async throws -> DeploymentLock {
        // Check for existing lock
        let existingLock = try await checkLock(appId: appId, environment: environment)
        
        if let existing = existingLock {
            // Check if lock is stale (no heartbeat for 120s)
            let isStale = Date().timeIntervalSince(existing.lastHeartbeat) > lockTimeoutSeconds
            
            if !isStale && !force {
                throw LockError.lockHeld(by: existing.owner, since: existing.acquiredAt)
            }
            
            // Stale lock or force - take over
            if isStale {
                try await releaseStaleLock(existing)
            }
        }
        
        // Create new lock
        let lock = DeploymentLock(
            lockId: "lock-\(UUID().uuidString.prefix(8))",
            appId: appId,
            environment: environment,
            owner: owner,
            ownerId: instanceId,
            acquiredAt: Date(),
            lastHeartbeat: Date(),
            expiresAt: Date().addingTimeInterval(lockTimeoutSeconds),
            metadata: [
                "hostname": Host.current().localizedName ?? "unknown",
                "pid": "\(ProcessInfo.processInfo.processIdentifier)"
            ]
        )
        
        // Write to DynamoDB (simulated)
        try await writeLock(lock)
        
        currentLock = lock
        
        // Start heartbeat
        startHeartbeat()
        
        return lock
    }
    
    func releaseLock() async throws {
        guard let lock = currentLock else {
            return // No lock to release
        }
        
        // Stop heartbeat
        stopHeartbeat()
        
        // Delete from DynamoDB (simulated)
        try await deleteLock(lock)
        
        currentLock = nil
    }
    
    // MARK: - Lock Status
    
    func checkLock(appId: String, environment: String) async throws -> DeploymentLock? {
        // Check local cache first
        if let lock = currentLock,
           lock.appId == appId,
           lock.environment == environment {
            return lock
        }
        
        // Query DynamoDB for existing lock
        let tableName = "radiant-deployment-locks"
        let key: [String: Any] = [
            "pk": "\(appId)#\(environment)"
        ]
        
        let result = await awsService.dynamoDbGetItem(tableName: tableName, key: key)
        
        switch result {
        case .success(let item):
            guard let item = item else { return nil }
            
            // Parse lock from DynamoDB item
            guard let lockId = item["lockId"] as? String,
                  let owner = item["owner"] as? String,
                  let ownerId = item["ownerId"] as? String,
                  let acquiredAtStr = item["acquiredAt"] as? String,
                  let lastHeartbeatStr = item["lastHeartbeat"] as? String,
                  let expiresAtStr = item["expiresAt"] as? String else {
                return nil
            }
            
            let formatter = ISO8601DateFormatter()
            return DeploymentLock(
                lockId: lockId,
                appId: appId,
                environment: environment,
                owner: owner,
                ownerId: ownerId,
                acquiredAt: formatter.date(from: acquiredAtStr) ?? Date(),
                lastHeartbeat: formatter.date(from: lastHeartbeatStr) ?? Date(),
                expiresAt: formatter.date(from: expiresAtStr) ?? Date(),
                metadata: item["metadata"] as? [String: String] ?? [:]
            )
            
        case .failure:
            return nil
        }
    }
    
    func getLockStatus(appId: String, environment: String) async -> LockStatus {
        do {
            let lock = try await checkLock(appId: appId, environment: environment)
            
            if let lock = lock {
                let isStale = Date().timeIntervalSince(lock.lastHeartbeat) > lockTimeoutSeconds
                let timeUntilExpiry = lock.expiresAt.timeIntervalSinceNow
                
                return LockStatus(
                    isLocked: !isStale,
                    lock: lock,
                    isOwnedByMe: lock.ownerId == instanceId,
                    timeUntilExpiry: isStale ? nil : timeUntilExpiry
                )
            }
            
            return LockStatus(isLocked: false, lock: nil, isOwnedByMe: false, timeUntilExpiry: nil)
            
        } catch {
            return LockStatus(isLocked: false, lock: nil, isOwnedByMe: false, timeUntilExpiry: nil)
        }
    }
    
    // MARK: - Heartbeat
    
    private func startHeartbeat() {
        stopHeartbeat()
        
        heartbeatTask = Task {
            while !Task.isCancelled {
                do {
                    try await Task.sleep(nanoseconds: UInt64(heartbeatIntervalSeconds * 1_000_000_000))
                    try await sendHeartbeat()
                } catch {
                    if !Task.isCancelled {
                        // Heartbeat failed - lock may be lost
                        break
                    }
                }
            }
        }
    }
    
    private func stopHeartbeat() {
        heartbeatTask?.cancel()
        heartbeatTask = nil
    }
    
    private func sendHeartbeat() async throws {
        guard var lock = currentLock else {
            throw LockError.heartbeatFailed
        }
        
        lock.lastHeartbeat = Date()
        lock.expiresAt = Date().addingTimeInterval(lockTimeoutSeconds)
        
        // Update in DynamoDB (simulated)
        try await updateLockHeartbeat(lock)
        
        currentLock = lock
    }
    
    // MARK: - DynamoDB Operations
    
    private let tableName = "radiant-deployment-locks"
    
    private func writeLock(_ lock: DeploymentLock) async throws {
        let formatter = ISO8601DateFormatter()
        let item: [String: Any] = [
            "pk": "\(lock.appId)#\(lock.environment)",
            "lockId": lock.lockId,
            "appId": lock.appId,
            "environment": lock.environment,
            "owner": lock.owner,
            "ownerId": lock.ownerId,
            "acquiredAt": formatter.string(from: lock.acquiredAt),
            "lastHeartbeat": formatter.string(from: lock.lastHeartbeat),
            "expiresAt": formatter.string(from: lock.expiresAt),
            "hostname": lock.metadata["hostname"] ?? "",
            "pid": lock.metadata["pid"] ?? ""
        ]
        
        let result = await awsService.dynamoDbPutItem(tableName: tableName, item: item)
        
        if case .failure(let error) = result {
            throw LockError.lockAcquisitionFailed(error.localizedDescription)
        }
    }
    
    private func deleteLock(_ lock: DeploymentLock) async throws {
        let key: [String: Any] = [
            "pk": "\(lock.appId)#\(lock.environment)"
        ]
        
        let result = await awsService.dynamoDbDeleteItem(tableName: tableName, key: key)
        
        if case .failure(let error) = result {
            throw LockError.lockReleaseFailed(error.localizedDescription)
        }
    }
    
    private func updateLockHeartbeat(_ lock: DeploymentLock) async throws {
        // Re-write the lock with updated heartbeat
        try await writeLock(lock)
    }
    
    private func releaseStaleLock(_ lock: DeploymentLock) async throws {
        try await deleteLock(lock)
    }
    
    // MARK: - Utility
    
    func isLockHeld() -> Bool {
        currentLock != nil
    }
    
    func getCurrentLock() -> DeploymentLock? {
        currentLock
    }
    
    /// Execute a block while holding the deployment lock
    func withLock<T: Sendable>(
        appId: String,
        environment: String,
        operation: @Sendable () async throws -> T
    ) async throws -> T {
        _ = try await acquireLock(appId: appId, environment: environment)
        
        defer {
            Task {
                try? await releaseLock()
            }
        }
        
        return try await operation()
    }
}

// MARK: - Singleton

extension DeploymentLockService {
    static let shared = DeploymentLockService(awsService: AWSService.shared)
}
