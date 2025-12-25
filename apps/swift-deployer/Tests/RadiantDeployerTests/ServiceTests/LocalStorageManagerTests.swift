import XCTest
@testable import RadiantDeployer

final class LocalStorageManagerTests: XCTestCase {
    
    var storageManager: LocalStorageManager!
    var testDirectory: URL!
    
    override func setUp() {
        super.setUp()
        testDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent("RadiantTests-\(UUID().uuidString)")
        try? FileManager.default.createDirectory(at: testDirectory, withIntermediateDirectories: true)
        storageManager = LocalStorageManager.shared
    }
    
    override func tearDown() {
        try? FileManager.default.removeItem(at: testDirectory)
        testDirectory = nil
        super.tearDown()
    }
    
    // MARK: - Configuration Storage Tests
    
    func testSaveAndLoadConfiguration() async throws {
        // Given
        let key = "test_config_\(UUID().uuidString)"
        let testConfig = TestConfiguration(
            name: "Test",
            value: 42,
            enabled: true
        )
        
        // When
        try await storageManager.save(testConfig, forKey: key)
        let loadedConfig: TestConfiguration? = try await storageManager.load(forKey: key)
        
        // Then
        XCTAssertNotNil(loadedConfig)
        XCTAssertEqual(loadedConfig?.name, "Test")
        XCTAssertEqual(loadedConfig?.value, 42)
        XCTAssertEqual(loadedConfig?.enabled, true)
        
        // Cleanup
        try? await storageManager.delete(forKey: key)
    }
    
    func testLoadNonExistentConfiguration() async throws {
        // Given
        let key = "non_existent_key_\(UUID().uuidString)"
        
        // When
        let loadedConfig: TestConfiguration? = try await storageManager.load(forKey: key)
        
        // Then
        XCTAssertNil(loadedConfig)
    }
    
    func testDeleteConfiguration() async throws {
        // Given
        let key = "test_delete_\(UUID().uuidString)"
        let testConfig = TestConfiguration(name: "ToDelete", value: 1, enabled: false)
        
        // When
        try await storageManager.save(testConfig, forKey: key)
        try await storageManager.delete(forKey: key)
        let loadedConfig: TestConfiguration? = try await storageManager.load(forKey: key)
        
        // Then
        XCTAssertNil(loadedConfig)
    }
    
    // MARK: - Recent Deployments Tests
    
    func testAddRecentDeployment() async throws {
        // Given
        let deployment = RecentDeployment(
            id: UUID().uuidString,
            appId: "thinktank",
            environment: "staging",
            version: "4.18.0",
            deployedAt: Date(),
            status: .success,
            duration: 120
        )
        
        // When
        await storageManager.addRecentDeployment(deployment)
        let recentDeployments = await storageManager.getRecentDeployments()
        
        // Then
        XCTAssertTrue(recentDeployments.contains(where: { $0.id == deployment.id }))
    }
    
    func testRecentDeploymentsLimitedTo50() async throws {
        // Given - Add 55 deployments
        for i in 0..<55 {
            let deployment = RecentDeployment(
                id: "deployment-\(i)",
                appId: "app-\(i % 5)",
                environment: "staging",
                version: "4.18.0",
                deployedAt: Date().addingTimeInterval(Double(-i * 60)),
                status: .success,
                duration: 120
            )
            await storageManager.addRecentDeployment(deployment)
        }
        
        // When
        let recentDeployments = await storageManager.getRecentDeployments()
        
        // Then - Should be limited to 50
        XCTAssertLessThanOrEqual(recentDeployments.count, 50)
    }
    
    // MARK: - Secure Storage Tests
    
    func testSecureStorageRoundTrip() async throws {
        // Given
        let testSecret = "super-secret-value-\(UUID().uuidString)"
        let key = "test_secret_\(UUID().uuidString)"
        
        // When
        try await storageManager.saveSecure(testSecret, forKey: key)
        let loadedSecret: String? = try await storageManager.loadSecure(forKey: key)
        
        // Then
        XCTAssertEqual(loadedSecret, testSecret)
        
        // Cleanup
        try? await storageManager.deleteSecure(forKey: key)
    }
}

// MARK: - Test Helpers

struct TestConfiguration: Codable, Equatable {
    let name: String
    let value: Int
    let enabled: Bool
}

struct RecentDeployment: Codable, Identifiable, Equatable {
    let id: String
    let appId: String
    let environment: String
    let version: String
    let deployedAt: Date
    let status: DeploymentStatus
    let duration: Int
    
    enum DeploymentStatus: String, Codable {
        case success
        case failed
        case cancelled
    }
}
