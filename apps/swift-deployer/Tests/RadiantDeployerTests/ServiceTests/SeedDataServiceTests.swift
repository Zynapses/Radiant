// RADIANT v4.18.0 - SeedDataService Tests

import XCTest
@testable import RadiantDeployer

final class SeedDataServiceTests: XCTestCase {
    
    var tempDirectory: URL!
    var seedDataService: SeedDataService!
    
    override func setUp() async throws {
        try await super.setUp()
        
        // Create temp directory for test seed data
        tempDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent("RadiantTests")
            .appendingPathComponent(UUID().uuidString)
        
        try FileManager.default.createDirectory(
            at: tempDirectory,
            withIntermediateDirectories: true
        )
        
        // Create test seed data
        try await createTestSeedData()
        
        seedDataService = SeedDataService(seedsDirectory: tempDirectory)
    }
    
    override func tearDown() async throws {
        try? FileManager.default.removeItem(at: tempDirectory)
        try await super.tearDown()
    }
    
    // MARK: - Test Data Setup
    
    private func createTestSeedData() async throws {
        let v1Dir = tempDirectory.appendingPathComponent("v1")
        try FileManager.default.createDirectory(at: v1Dir, withIntermediateDirectories: true)
        
        // Create manifest.json
        let manifest = """
        {
          "version": "1.0.0",
          "name": "Test Seed Data",
          "description": "Test seed data for unit tests",
          "createdAt": "2024-12-25T00:00:00Z",
          "updatedAt": "2024-12-25T00:00:00Z",
          "compatibility": {
            "minRadiantVersion": "4.16.0",
            "maxRadiantVersion": "5.0.0"
          },
          "files": {
            "providers": "providers.json",
            "externalModels": "external-models.json",
            "selfHostedModels": "self-hosted-models.json",
            "services": "services.json"
          },
          "stats": {
            "externalProviders": 2,
            "externalModels": 3,
            "selfHostedModels": 2,
            "services": 1
          },
          "pricing": {
            "externalMarkup": 1.40,
            "selfHostedMarkup": 1.75
          },
          "changelog": []
        }
        """
        try manifest.write(to: v1Dir.appendingPathComponent("manifest.json"), atomically: true, encoding: .utf8)
        
        // Create providers.json
        let providers = """
        {
          "version": "1.0.0",
          "providers": [
            {
              "id": "test-provider-1",
              "name": "test-provider-1",
              "displayName": "Test Provider 1",
              "category": "text_generation",
              "description": "A test provider",
              "website": "https://test.com",
              "apiBaseUrl": "https://api.test.com/v1",
              "authType": "bearer",
              "secretName": "radiant/providers/test",
              "enabled": true,
              "regions": ["us-east-1"],
              "features": ["streaming"],
              "compliance": ["SOC2"],
              "rateLimit": { "requestsPerMinute": 1000 }
            },
            {
              "id": "test-provider-2",
              "name": "test-provider-2",
              "displayName": "Test Provider 2",
              "category": "image_generation",
              "authType": "api_key",
              "enabled": true
            }
          ]
        }
        """
        try providers.write(to: v1Dir.appendingPathComponent("providers.json"), atomically: true, encoding: .utf8)
        
        // Create external-models.json
        let models = """
        {
          "version": "1.0.0",
          "models": [
            {
              "id": "test-model-1",
              "providerId": "test-provider-1",
              "modelId": "test-model",
              "litellmId": "test/test-model",
              "displayName": "Test Model 1",
              "description": "A test model",
              "category": "text_generation",
              "capabilities": ["chat", "streaming"],
              "contextWindow": 128000,
              "maxOutput": 4096,
              "inputModalities": ["text"],
              "outputModalities": ["text"],
              "pricing": { "inputCostPer1k": 0.001, "outputCostPer1k": 0.002, "markup": 1.40 },
              "minTier": 1
            },
            {
              "id": "test-model-2",
              "providerId": "test-provider-1",
              "modelId": "test-model-2",
              "displayName": "Test Model 2",
              "category": "text_generation",
              "pricing": { "inputCostPer1k": 0.002, "outputCostPer1k": 0.004, "markup": 1.40 },
              "minTier": 2
            },
            {
              "id": "test-image-model",
              "providerId": "test-provider-2",
              "modelId": "test-image",
              "displayName": "Test Image Model",
              "category": "image_generation",
              "pricing": { "perImage": 0.02, "markup": 1.40 },
              "minTier": 1
            }
          ]
        }
        """
        try models.write(to: v1Dir.appendingPathComponent("external-models.json"), atomically: true, encoding: .utf8)
        
        // Create self-hosted-models.json
        let selfHosted = """
        {
          "version": "1.0.0",
          "models": [
            {
              "id": "test-selfhosted-1",
              "displayName": "Test Self-Hosted 1",
              "description": "A test self-hosted model",
              "category": "vision_classification",
              "specialty": "image_classification",
              "instanceType": "ml.g4dn.xlarge",
              "capabilities": ["image_classification"],
              "thermal": { "defaultState": "COLD", "scaleToZeroAfterMinutes": 15, "warmupTimeSeconds": 45 },
              "license": "Apache-2.0",
              "pricing": { "hourlyRate": 1.30, "perImage": 0.001, "markup": 1.75 },
              "minTier": 3
            },
            {
              "id": "test-selfhosted-2",
              "displayName": "Test Self-Hosted 2",
              "category": "audio_stt",
              "instanceType": "ml.g5.xlarge",
              "pricing": { "hourlyRate": 2.47, "perMinuteAudio": 0.015, "markup": 1.75 },
              "minTier": 3
            }
          ]
        }
        """
        try selfHosted.write(to: v1Dir.appendingPathComponent("self-hosted-models.json"), atomically: true, encoding: .utf8)
        
        // Create services.json
        let services = """
        {
          "version": "1.0.0",
          "services": [
            {
              "id": "test-service",
              "displayName": "Test Service",
              "description": "A test orchestration service",
              "requiredModels": ["test-selfhosted-1"],
              "optionalModels": ["test-selfhosted-2"],
              "endpoints": [
                { "path": "/test/endpoint", "description": "Test endpoint" }
              ],
              "pricing": { "perImage": 0.02, "markup": 1.40 },
              "minTier": 3
            }
          ]
        }
        """
        try services.write(to: v1Dir.appendingPathComponent("services.json"), atomically: true, encoding: .utf8)
    }
    
    // MARK: - Tests
    
    func testListAvailableSeedVersions() async throws {
        let versions = try await seedDataService.listAvailableSeedVersions()
        
        XCTAssertFalse(versions.isEmpty, "Should find at least one seed version")
        
        let v1 = versions.first { $0.version == "1.0.0" }
        XCTAssertNotNil(v1, "Should find version 1.0.0")
        XCTAssertEqual(v1?.name, "Test Seed Data")
        XCTAssertEqual(v1?.stats.externalProviders, 2)
        XCTAssertEqual(v1?.stats.externalModels, 3)
        XCTAssertEqual(v1?.stats.selfHostedModels, 2)
        XCTAssertEqual(v1?.stats.services, 1)
        XCTAssertTrue(v1?.isLocal ?? false, "Should be marked as local")
    }
    
    func testLoadSeedData() async throws {
        let seedData = try await seedDataService.loadSeedData(version: "1")
        
        // Verify manifest
        XCTAssertEqual(seedData.manifest.version, "1.0.0")
        XCTAssertEqual(seedData.manifest.name, "Test Seed Data")
        
        // Verify providers
        XCTAssertEqual(seedData.providers.count, 2)
        XCTAssertEqual(seedData.providers[0].id, "test-provider-1")
        XCTAssertEqual(seedData.providers[0].displayName, "Test Provider 1")
        XCTAssertEqual(seedData.providers[0].category, "text_generation")
        XCTAssertEqual(seedData.providers[0].authType, "bearer")
        
        // Verify external models
        XCTAssertEqual(seedData.externalModels.count, 3)
        XCTAssertEqual(seedData.externalModels[0].id, "test-model-1")
        XCTAssertEqual(seedData.externalModels[0].contextWindow, 128000)
        XCTAssertEqual(seedData.externalModels[0].pricing.markup, 1.40)
        
        // Verify self-hosted models
        XCTAssertEqual(seedData.selfHostedModels.count, 2)
        XCTAssertEqual(seedData.selfHostedModels[0].id, "test-selfhosted-1")
        XCTAssertEqual(seedData.selfHostedModels[0].instanceType, "ml.g4dn.xlarge")
        XCTAssertEqual(seedData.selfHostedModels[0].thermal?.defaultState, "COLD")
        
        // Verify services
        XCTAssertEqual(seedData.services.count, 1)
        XCTAssertEqual(seedData.services[0].id, "test-service")
        XCTAssertEqual(seedData.services[0].requiredModels, ["test-selfhosted-1"])
    }
    
    func testGenerateSeedMigration() async throws {
        let seedData = try await seedDataService.loadSeedData(version: "1")
        let sql = await seedDataService.generateSeedMigration(seedData: seedData)
        
        // Verify SQL contains expected sections
        XCTAssertTrue(sql.contains("RADIANT AI Registry Seed Data Migration"), "Should have header comment")
        XCTAssertTrue(sql.contains("Seed Version: 1.0.0"), "Should include seed version")
        XCTAssertTrue(sql.contains("INSERT INTO providers"), "Should insert providers")
        XCTAssertTrue(sql.contains("INSERT INTO models"), "Should insert models")
        XCTAssertTrue(sql.contains("INSERT INTO self_hosted_models"), "Should insert self-hosted models")
        XCTAssertTrue(sql.contains("ON CONFLICT (id) DO NOTHING"), "Should use ON CONFLICT DO NOTHING")
        XCTAssertTrue(sql.contains("test-provider-1"), "Should include provider ID")
        XCTAssertTrue(sql.contains("test-model-1"), "Should include model ID")
    }
    
    func testSeedDataCaching() async throws {
        // First load
        let seedData1 = try await seedDataService.loadSeedData(version: "1")
        
        // Second load (should be cached)
        let seedData2 = try await seedDataService.loadSeedData(version: "1")
        
        // Both should have same data
        XCTAssertEqual(seedData1.manifest.version, seedData2.manifest.version)
        XCTAssertEqual(seedData1.providers.count, seedData2.providers.count)
    }
    
    func testSeedDataInfoHashable() async throws {
        let versions = try await seedDataService.listAvailableSeedVersions()
        guard let v1 = versions.first else {
            XCTFail("Should have at least one version")
            return
        }
        
        // Test Hashable conformance
        var set = Set<SeedDataInfo>()
        set.insert(v1)
        XCTAssertTrue(set.contains(v1))
        
        // Test Identifiable
        XCTAssertEqual(v1.id, v1.version)
    }
}
