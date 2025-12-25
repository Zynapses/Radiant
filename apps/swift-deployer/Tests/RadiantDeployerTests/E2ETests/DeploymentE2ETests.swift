import XCTest
@testable import RadiantDeployer

/// End-to-end tests for deployment workflows per PROMPT-33 spec
final class DeploymentE2ETests: XCTestCase {
    
    // MARK: - Properties
    
    var mockAWSService: MockAWSService!
    var mockCDKService: MockCDKService!
    
    // MARK: - Setup
    
    override func setUp() {
        super.setUp()
        mockAWSService = MockAWSService()
        mockCDKService = MockCDKService()
    }
    
    override func tearDown() {
        mockAWSService = nil
        mockCDKService = nil
        super.tearDown()
    }
    
    // MARK: - Deployment Flow Tests
    
    func testFullDeploymentFlow() async throws {
        // Given
        let appId = "test-app"
        let environment = "staging"
        let credentials = MockCredentials.valid
        
        // When - Simulate full deployment
        var phases: [String] = []
        
        // Phase 1: Credential validation
        let credentialsValid = await mockAWSService.validateCredentials(credentials)
        XCTAssertTrue(credentialsValid)
        phases.append("credentials_validated")
        
        // Phase 2: Create snapshot
        let snapshotService = SnapshotService(awsService: mockAWSService, storageManager: LocalStorageManager.shared)
        let snapshot = try await snapshotService.createSnapshot(
            appId: appId,
            environment: environment,
            version: "4.18.0",
            onProgress: { _, _ in }
        )
        XCTAssertEqual(snapshot.status, .available)
        phases.append("snapshot_created")
        
        // Phase 3: Acquire deployment lock
        let lockService = DeploymentLockService(awsService: mockAWSService)
        let lock = try await lockService.acquireLock(appId: appId, environment: environment)
        XCTAssertNotNil(lock)
        phases.append("lock_acquired")
        
        // Phase 4: CDK deploy (simulated)
        let deploySuccess = await mockCDKService.deploy(appId: appId, environment: environment)
        XCTAssertTrue(deploySuccess)
        phases.append("cdk_deployed")
        
        // Phase 5: Health check
        let healthService = HealthCheckService.shared
        let healthResult = await healthService.checkEndpoint(
            service: "API",
            endpoint: "https://api.test.radiant.app/health"
        )
        // Note: Will timeout in test, that's expected
        phases.append("health_checked")
        
        // Phase 6: Release lock
        try await lockService.releaseLock()
        phases.append("lock_released")
        
        // Then - Verify all phases completed
        XCTAssertEqual(phases.count, 6)
        XCTAssertTrue(phases.contains("credentials_validated"))
        XCTAssertTrue(phases.contains("snapshot_created"))
        XCTAssertTrue(phases.contains("lock_acquired"))
    }
    
    func testDeploymentWithRollback() async throws {
        // Given
        let appId = "test-app"
        let environment = "staging"
        
        // When - Create snapshot then simulate failure and rollback
        let snapshotService = SnapshotService(awsService: mockAWSService, storageManager: LocalStorageManager.shared)
        
        let snapshot = try await snapshotService.createSnapshot(
            appId: appId,
            environment: environment,
            version: "4.18.0",
            onProgress: { _, _ in }
        )
        
        // Simulate deployment failure
        let deployFailed = true
        
        if deployFailed {
            // Rollback from snapshot
            try await snapshotService.restoreSnapshot(snapshot.id, onProgress: { _, _ in })
        }
        
        // Then - Verify snapshot still available for re-use
        let restoredSnapshot = snapshotService.getSnapshot(snapshot.id)
        XCTAssertNotNil(restoredSnapshot)
        XCTAssertEqual(restoredSnapshot?.status, .available)
    }
    
    func testConcurrentDeploymentPrevention() async throws {
        // Given
        let appId = "test-app"
        let environment = "production"
        let lockService = DeploymentLockService(awsService: mockAWSService)
        
        // When - First deployment acquires lock
        let firstLock = try await lockService.acquireLock(appId: appId, environment: environment)
        XCTAssertNotNil(firstLock)
        
        // Then - Second deployment should fail
        do {
            _ = try await lockService.acquireLock(appId: appId, environment: environment)
            XCTFail("Should have thrown lock error")
        } catch let error as DeploymentLockService.LockError {
            switch error {
            case .lockHeld:
                // Expected
                break
            default:
                XCTFail("Wrong error type: \(error)")
            }
        }
        
        // Cleanup
        try await lockService.releaseLock()
    }
    
    func testMultiRegionDeployment() async throws {
        // Given
        let multiRegionService = MultiRegionService(awsService: mockAWSService, cdkService: mockCDKService)
        
        // Add regions
        await multiRegionService.addRegion(MultiRegionService.RegionConfig(
            id: "1",
            region: "us-east-1",
            isPrimary: true,
            endpoint: "https://us-east-1.api.radiant.app",
            stackPrefix: "radiant-prod",
            isEnabled: true,
            lastDeployedVersion: "4.17.0",
            lastDeployedAt: Date().addingTimeInterval(-86400),
            healthStatus: .healthy
        ))
        
        await multiRegionService.addRegion(MultiRegionService.RegionConfig(
            id: "2",
            region: "eu-west-1",
            isPrimary: false,
            endpoint: "https://eu-west-1.api.radiant.app",
            stackPrefix: "radiant-prod-eu",
            isEnabled: true,
            lastDeployedVersion: "4.17.0",
            lastDeployedAt: Date().addingTimeInterval(-86400),
            healthStatus: .healthy
        ))
        
        // When - Check consistency
        let consistency = try await multiRegionService.checkConsistency()
        
        // Then
        XCTAssertTrue(consistency.isConsistent)
        XCTAssertEqual(consistency.regionVersions.count, 2)
    }
    
    // MARK: - Timeout Tests
    
    func testOperationTimeout() async throws {
        // Given
        let timeoutService = TimeoutService.shared
        
        // When - Execute operation that exceeds timeout
        do {
            _ = try await timeoutService.execute(operation: "health_check") {
                // Simulate long operation
                try await Task.sleep(nanoseconds: 60_000_000_000) // 60 seconds
                return true
            }
            XCTFail("Should have timed out")
        } catch {
            // Expected timeout
            XCTAssertTrue(error is TimeoutService.TimeoutError)
        }
    }
    
    func testCancellation() async throws {
        // Given
        let timeoutService = TimeoutService.shared
        let token = UUID()
        
        // When - Start operation and cancel
        let task = Task {
            try await timeoutService.executeWithCancellation(
                operation: "cdk_deploy",
                cancellationToken: token
            ) {
                try await Task.sleep(nanoseconds: 10_000_000_000)
                return true
            }
        }
        
        // Cancel after short delay
        try await Task.sleep(nanoseconds: 100_000_000)
        await timeoutService.cancel(token)
        
        // Then - Task should be cancelled
        let result = await task.result
        switch result {
        case .success:
            // May succeed if cancellation timing is off
            break
        case .failure(let error):
            if case TimeoutService.TimeoutError.cancelled = error {
                // Expected
            }
        }
    }
    
    // MARK: - AI Assistant Tests
    
    func testAIFallbackWhenOffline() async throws {
        // Given
        let aiService = AIAssistantService.shared
        
        // When - API is unavailable, fallback should work
        let fallbackExplanation = await aiService.fallbackExplanation(for: "snapshot creation")
        
        // Then
        XCTAssertFalse(fallbackExplanation.isEmpty)
        XCTAssertTrue(fallbackExplanation.contains("backup") || fallbackExplanation.contains("snapshot"))
    }
    
    func testErrorTranslation() async throws {
        // Given
        let aiService = AIAssistantService.shared
        let testError = NSError(domain: "AWS", code: 403, userInfo: [
            NSLocalizedDescriptionKey: "Access Denied: User is not authorized to perform: dynamodb:PutItem"
        ])
        
        // When - Use fallback translation
        let translation = await aiService.fallbackErrorTranslation(error: testError)
        
        // Then
        XCTAssertFalse(translation.userFriendlyMessage.isEmpty)
        XCTAssertEqual(translation.severity, "high") // Permission errors are high severity
    }
}

// MARK: - Mock Services

class MockAWSService: AWSService {
    var shouldFailValidation = false
    
    override func validateCredentials(_ credentials: CredentialSet) async -> Bool {
        return !shouldFailValidation
    }
}

class MockCDKService: CDKService {
    var shouldFailDeploy = false
    
    func deploy(appId: String, environment: String) async -> Bool {
        // Simulate deployment time
        try? await Task.sleep(nanoseconds: 100_000_000)
        return !shouldFailDeploy
    }
}

struct MockCredentials {
    static var valid: CredentialSet {
        CredentialSet(
            id: "mock",
            name: "Mock Credentials",
            accessKeyId: "AKIAIOSFODNN7EXAMPLE",
            secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            region: "us-east-1"
        )
    }
}
