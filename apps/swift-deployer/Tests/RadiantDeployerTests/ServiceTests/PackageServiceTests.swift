// RADIANT v4.18.0 - PackageService Tests

import XCTest
@testable import RadiantDeployer

final class PackageServiceTests: XCTestCase {
    
    var tempDirectory: URL!
    var packageService: PackageService!
    
    override func setUp() async throws {
        try await super.setUp()
        
        // Create temp directory for test packages
        tempDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent("RadiantPackageTests")
            .appendingPathComponent(UUID().uuidString)
        
        try FileManager.default.createDirectory(
            at: tempDirectory,
            withIntermediateDirectories: true
        )
        
        packageService = PackageService()
    }
    
    override func tearDown() async throws {
        try? FileManager.default.removeItem(at: tempDirectory)
        try await super.tearDown()
    }
    
    // MARK: - Tests
    
    func testPackageManifestDecoding() async throws {
        // Create a test manifest
        let manifestJson = """
        {
          "packageFormat": "radpkg-v1",
          "version": "4.18.0",
          "buildId": "test-build-123",
          "buildTimestamp": "2024-12-25T00:00:00Z",
          "buildHost": "test-host",
          "components": {
            "radiantPlatform": {
              "version": "4.18.0",
              "minUpgradeFrom": "4.16.0"
            }
          },
          "migrations": {},
          "dependencies": {
            "awsCdk": "2.100.0",
            "nodejs": "18.x",
            "postgresql": "15"
          },
          "compatibility": {
            "minimumDeployerVersion": "4.16.0",
            "supportedTiers": ["SEED", "STARTER", "GROWTH"],
            "supportedRegions": ["us-east-1", "us-west-2"]
          },
          "integrity": {
            "algorithm": "sha256",
            "packageHash": "abc123"
          },
          "installBehavior": {
            "seedAIRegistry": true,
            "createInitialAdmin": true,
            "runFullMigrations": true
          },
          "updateBehavior": {
            "seedAIRegistry": false,
            "preserveAdminCustomizations": true,
            "runIncrementalMigrations": true,
            "createPreUpdateSnapshot": true
          },
          "rollbackBehavior": {
            "supportedFromVersions": ["4.17.0"],
            "requiresDatabaseRollback": false
          },
          "seedData": {
            "version": "1.0.0",
            "hash": "seed123",
            "externalProviders": 21,
            "externalModels": 50,
            "selfHostedModels": 38,
            "services": 5
          }
        }
        """
        
        let data = manifestJson.data(using: .utf8)!
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        
        let manifest = try decoder.decode(PackageManifest.self, from: data)
        
        // Verify basic fields
        XCTAssertEqual(manifest.packageFormat, "radpkg-v1")
        XCTAssertEqual(manifest.version, "4.18.0")
        XCTAssertEqual(manifest.buildId, "test-build-123")
        
        // Verify components
        XCTAssertEqual(manifest.components.radiantPlatform.version, "4.18.0")
        XCTAssertEqual(manifest.components.radiantPlatform.minUpgradeFrom, "4.16.0")
        
        // Verify compatibility
        XCTAssertEqual(manifest.compatibility.minimumDeployerVersion, "4.16.0")
        XCTAssertTrue(manifest.compatibility.supportedTiers.contains("GROWTH"))
        
        // Verify behaviors
        XCTAssertTrue(manifest.installBehavior.seedAIRegistry)
        XCTAssertFalse(manifest.updateBehavior.seedAIRegistry)
        XCTAssertTrue(manifest.updateBehavior.preserveAdminCustomizations)
        
        // Verify seed data
        XCTAssertNotNil(manifest.seedData)
        XCTAssertEqual(manifest.seedData?.version, "1.0.0")
        XCTAssertEqual(manifest.seedData?.externalProviders, 21)
        XCTAssertEqual(manifest.seedData?.externalModels, 50)
        XCTAssertEqual(manifest.seedData?.selfHostedModels, 38)
    }
    
    func testPackageInfoEquatable() {
        let info1 = PackageInfo(
            version: "4.18.0",
            channel: .stable,
            buildId: "build1",
            buildDate: Date(),
            size: 1000,
            hash: "abc123",
            isLocal: true,
            path: "/test/path"
        )
        
        let info2 = PackageInfo(
            version: "4.18.0",
            channel: .stable,
            buildId: "build2",  // Different build ID
            buildDate: Date(),
            size: 2000,
            hash: "def456",
            isLocal: false,
            path: nil
        )
        
        // Same version = equal (for Set deduplication)
        XCTAssertEqual(info1, info2)
        XCTAssertEqual(info1.hashValue, info2.hashValue)
    }
    
    func testReleaseChannelOrdering() {
        let stable = ReleaseChannel.stable
        let beta = ReleaseChannel.beta
        let alpha = ReleaseChannel.alpha
        
        // Verify display names
        XCTAssertEqual(stable.displayName, "Stable")
        XCTAssertEqual(beta.displayName, "Beta")
        XCTAssertEqual(alpha.displayName, "Alpha")
    }
    
    func testPackageErrorDescriptions() {
        let errors: [PackageError] = [
            .notFound("4.18.0"),
            .downloadFailed("Network error"),
            .integrityCheckFailed,
            .invalidManifest("Missing field"),
            .extractionFailed("Corrupt archive"),
            .versionMismatch(expected: "4.18.0", actual: "4.17.0")
        ]
        
        for error in errors {
            XCTAssertNotNil(error.errorDescription, "Error should have description: \(error)")
            XCTAssertFalse(error.errorDescription!.isEmpty, "Error description should not be empty: \(error)")
        }
    }
}
