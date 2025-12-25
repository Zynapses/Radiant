// RADIANT v4.18.0 - DeploymentService Tests

import XCTest
@testable import RadiantDeployer

final class DeploymentServiceTests: XCTestCase {
    
    var deploymentService: DeploymentService!
    
    override func setUp() async throws {
        try await super.setUp()
        deploymentService = DeploymentService()
    }
    
    // MARK: - Deployment Mode Tests
    
    func testDeploymentModeDisplayNames() {
        XCTAssertEqual(DeploymentMode.install.displayName, "Fresh Install")
        XCTAssertEqual(DeploymentMode.update.displayName, "Update")
        XCTAssertEqual(DeploymentMode.rollback.displayName, "Rollback")
    }
    
    func testDeploymentModeIcons() {
        XCTAssertEqual(DeploymentMode.install.icon, "plus.circle.fill")
        XCTAssertEqual(DeploymentMode.update.icon, "arrow.up.circle.fill")
        XCTAssertEqual(DeploymentMode.rollback.icon, "arrow.uturn.backward.circle.fill")
    }
    
    func testDeploymentModeColors() {
        XCTAssertEqual(DeploymentMode.install.color, "green")
        XCTAssertEqual(DeploymentMode.update.color, "blue")
        XCTAssertEqual(DeploymentMode.rollback.color, "orange")
    }
    
    func testDeploymentModeCodable() throws {
        let modes: [DeploymentMode] = [.install, .update, .rollback]
        
        for mode in modes {
            let encoded = try JSONEncoder().encode(mode)
            let decoded = try JSONDecoder().decode(DeploymentMode.self, from: encoded)
            XCTAssertEqual(mode, decoded)
        }
    }
    
    // MARK: - Deployment Error Tests
    
    func testDeploymentErrorDescriptions() {
        let errors: [DeploymentError] = [
            .noCredentials,
            .instanceNotFound,
            .snapshotNotFound("snap-123"),
            .invalidSnapshot("corrupt data"),
            .parameterValidationFailed("invalid region"),
            .infrastructureDeploymentFailed("stack creation failed"),
            .migrationFailed("migration 044 failed"),
            .rollbackFailed("cannot restore"),
            .networkError(NSError(domain: "test", code: 1)),
            .packageNotFound("4.18.0"),
            .integrityCheckFailed,
            .verificationFailed("health check failed"),
            .commandFailed("cdk deploy", 1),
        ]
        
        for error in errors {
            XCTAssertNotNil(error.errorDescription, "Error should have description: \(error)")
            XCTAssertFalse(error.errorDescription!.isEmpty, "Description should not be empty")
        }
    }
    
    // MARK: - Deployment Execution Result Tests
    
    func testDeploymentExecutionResultCreation() {
        let result = DeploymentExecutionResult(
            mode: .install,
            success: true,
            version: "4.18.0",
            rollbackSnapshotId: "snap-123",
            outputs: nil,
            errors: nil,
            duration: 120.5
        )
        
        XCTAssertEqual(result.mode, .install)
        XCTAssertTrue(result.success)
        XCTAssertEqual(result.version, "4.18.0")
        XCTAssertEqual(result.rollbackSnapshotId, "snap-123")
        XCTAssertEqual(result.duration, 120.5, accuracy: 0.01)
    }
    
    func testFailedDeploymentExecutionResult() {
        let result = DeploymentExecutionResult(
            mode: .update,
            success: false,
            version: "4.18.0",
            rollbackSnapshotId: nil,
            outputs: nil,
            errors: ["CDK deployment failed", "Stack rollback triggered"],
            duration: 45.0
        )
        
        XCTAssertFalse(result.success)
        XCTAssertNil(result.rollbackSnapshotId)
        XCTAssertEqual(result.errors?.count, 2)
    }
    
    // MARK: - Migration Mode Tests
    
    func testMigrationModes() {
        // MigrationMode is used internally to determine how to run migrations
        // .fresh runs ALL migrations (install)
        // .incremental runs only new migrations (update)
        
        // These are internal implementation details, but we can verify
        // the behavior through InstallationParameters
        
        let installParams = InstallationParameters.defaults(
            appId: "test",
            environment: .dev,
            tier: .growth
        )
        
        // On install, seedAIRegistry should be true
        XCTAssertTrue(installParams.seedAIRegistry)
        
        // On update, it should be false
        let updateParams = InstanceParameters.defaults(tier: .growth).toInstallationParameters()
        XCTAssertFalse(updateParams.seedAIRegistry)
    }
}

// MARK: - InstallationParameters Tests

extension DeploymentServiceTests {
    
    func testInstallationParametersDefaults() {
        let params = InstallationParameters.defaults(
            appId: "test-app",
            environment: .dev,
            tier: .seed
        )
        
        XCTAssertEqual(params.tier, .seed)
        XCTAssertEqual(params.region, .usEast1)
        XCTAssertEqual(params.vpcCidr, "10.0.0.0/16")
        XCTAssertFalse(params.multiAz)  // SEED tier doesn't get multi-AZ
        XCTAssertFalse(params.enableSelfHostedModels)  // SEED tier doesn't get self-hosted
        XCTAssertTrue(params.seedAIRegistry)  // Install mode seeds registry
        XCTAssertEqual(params.externalProviderMarkup, 1.40)
        XCTAssertEqual(params.selfHostedMarkup, 1.75)
    }
    
    func testInstallationParametersGrowthTier() {
        let params = InstallationParameters.defaults(
            appId: "test-app",
            environment: .prod,
            tier: .growth
        )
        
        XCTAssertEqual(params.tier, .growth)
        XCTAssertTrue(params.multiAz)  // GROWTH tier gets multi-AZ
        XCTAssertTrue(params.enableSelfHostedModels)  // GROWTH tier gets self-hosted
        XCTAssertFalse(params.enableMultiRegion)  // GROWTH doesn't get multi-region
    }
    
    func testInstallationParametersScaleTier() {
        let params = InstallationParameters.defaults(
            appId: "test-app",
            environment: .prod,
            tier: .scale
        )
        
        XCTAssertEqual(params.tier, .scale)
        XCTAssertTrue(params.multiAz)
        XCTAssertTrue(params.enableSelfHostedModels)
        XCTAssertTrue(params.enableMultiRegion)  // SCALE tier gets multi-region
    }
}

// MARK: - InstanceParameters Tests

extension DeploymentServiceTests {
    
    func testInstanceParametersToInstallationParameters() {
        let instanceParams = InstanceParameters(
            tier: .growth,
            region: .euWest1,
            vpcCidr: "10.1.0.0/16",
            multiAz: true,
            auroraInstanceClass: "db.r6g.xlarge",
            auroraMinCapacity: 2,
            auroraMaxCapacity: 16,
            enableSelfHostedModels: true,
            enableMultiRegion: false,
            enableWAF: true,
            enableGuardDuty: true,
            enableHIPAACompliance: true,
            externalProviderMarkup: 1.50,
            selfHostedMarkup: 1.80,
            version: "4.18.0",
            instanceId: "radiant-test-eu",
            deployedAt: Date(),
            lastUpdatedAt: Date(),
            customSettings: ["feature_x": "enabled"]
        )
        
        let installParams = instanceParams.toInstallationParameters()
        
        // All core settings should be preserved
        XCTAssertEqual(installParams.tier, .growth)
        XCTAssertEqual(installParams.region, .euWest1)
        XCTAssertEqual(installParams.vpcCidr, "10.1.0.0/16")
        XCTAssertTrue(installParams.multiAz)
        XCTAssertTrue(installParams.enableHIPAACompliance)
        XCTAssertEqual(installParams.externalProviderMarkup, 1.50)
        
        // seedAIRegistry should ALWAYS be false on update
        XCTAssertFalse(installParams.seedAIRegistry)
    }
}

// MARK: - DeploymentSnapshot Tests

extension DeploymentServiceTests {
    
    func testDeploymentSnapshotCreation() {
        let params = InstanceParameters.defaults(tier: .growth)
        
        let snapshot = DeploymentSnapshot(
            id: "snap-20241225-001",
            appId: "test-app",
            environment: "production",
            version: "4.18.0",
            packageHash: "abc123def456",
            parameters: params,
            createdAt: Date(),
            reason: .preUpdate,
            databaseSnapshotId: "rds-snap-123",
            includesDatabaseRollback: true
        )
        
        XCTAssertEqual(snapshot.id, "snap-20241225-001")
        XCTAssertEqual(snapshot.version, "4.18.0")
        XCTAssertEqual(snapshot.reason, .preUpdate)
        XCTAssertTrue(snapshot.includesDatabaseRollback)
        XCTAssertNotNil(snapshot.databaseSnapshotId)
    }
    
    func testDeploymentSnapshotReasons() {
        let reasons: [DeploymentSnapshot.SnapshotReason] = [
            .preUpdate,
            .preRollback,
            .manual,
            .scheduled
        ]
        
        for reason in reasons {
            XCTAssertNotNil(reason.rawValue)
            
            // Test Codable
            let encoded = try? JSONEncoder().encode(reason)
            XCTAssertNotNil(encoded)
            
            if let encoded = encoded {
                let decoded = try? JSONDecoder().decode(DeploymentSnapshot.SnapshotReason.self, from: encoded)
                XCTAssertEqual(decoded, reason)
            }
        }
    }
    
    func testDeploymentSnapshotHashable() {
        let params = InstanceParameters.defaults(tier: .seed)
        
        let snapshot1 = DeploymentSnapshot(
            id: "snap-001",
            appId: "test",
            environment: "dev",
            version: "4.18.0",
            packageHash: "abc",
            parameters: params,
            createdAt: Date(),
            reason: .manual,
            databaseSnapshotId: nil,
            includesDatabaseRollback: false
        )
        
        let snapshot2 = DeploymentSnapshot(
            id: "snap-001",  // Same ID
            appId: "different",
            environment: "prod",
            version: "4.17.0",
            packageHash: "xyz",
            parameters: params,
            createdAt: Date(),
            reason: .scheduled,
            databaseSnapshotId: nil,
            includesDatabaseRollback: false
        )
        
        // Equal because same ID
        XCTAssertEqual(snapshot1, snapshot2)
        XCTAssertEqual(snapshot1.hashValue, snapshot2.hashValue)
        
        // Can be used in Set
        var set = Set<DeploymentSnapshot>()
        set.insert(snapshot1)
        set.insert(snapshot2)
        XCTAssertEqual(set.count, 1)  // Only one because same ID
    }
}
