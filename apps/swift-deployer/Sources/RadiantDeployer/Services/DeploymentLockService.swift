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
        // Simulated DynamoDB read
        // In production, this would query DynamoDB
        try await Task.sleep(nanoseconds: 100_000_000)
        
        // Return current lock if it matches
        if let lock = currentLock,
           lock.appId == appId,
           lock.environment == environment {
            return lock
        }
        
        return nil
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
    
    // MARK: - DynamoDB Operations (Simulated)
    
    private func writeLock(_ lock: DeploymentLock) async throws {
        // Simulated conditional write to DynamoDB
        // Uses condition expression to prevent overwriting existing lock
        try await Task.sleep(nanoseconds: 200_000_000)
    }
    
    private func deleteLock(_ lock: DeploymentLock) async throws {
        try await Task.sleep(nanoseconds: 100_000_000)
    }
    
    private func updateLockHeartbeat(_ lock: DeploymentLock) async throws {
        try await Task.sleep(nanoseconds: 50_000_000)
    }
    
    private func releaseStaleLock(_ lock: DeploymentLock) async throws {
        try await Task.sleep(nanoseconds: 100_000_000)
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
        let lock = try await acquireLock(appId: appId, environment: environment)
        
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
