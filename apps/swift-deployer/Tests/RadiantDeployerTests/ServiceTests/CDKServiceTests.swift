// RADIANT v4.18.0 - CDK Service Tests
// Tests for CDK deployment service

import XCTest
@testable import RadiantDeployer

final class CDKServiceTests: XCTestCase {
    
    // MARK: - Stack Name Tests
    
    func testGenerateStackNameWithEnvironment() {
        let stackName = CDKService.generateStackName(
            base: "RadiantCore",
            environment: "prod",
            region: "us-east-1"
        )
        
        XCTAssertEqual(stackName, "RadiantCore-prod-us-east-1")
    }
    
    func testGenerateStackNameWithDevEnvironment() {
        let stackName = CDKService.generateStackName(
            base: "RadiantCore",
            environment: "dev",
            region: "us-west-2"
        )
        
        XCTAssertEqual(stackName, "RadiantCore-dev-us-west-2")
    }
    
    // MARK: - Stack Order Tests
    
    func testDeploymentStackOrder() {
        let expectedOrder = [
            "RadiantFoundation",
            "RadiantNetwork",
            "RadiantDatabase",
            "RadiantAuth",
            "RadiantAPI",
            "RadiantLambda",
            "RadiantAI",
            "RadiantMonitoring"
        ]
        
        XCTAssertEqual(CDKService.deploymentStackOrder, expectedOrder)
    }
    
    func testDestroyStackOrderIsReversed() {
        let deployOrder = CDKService.deploymentStackOrder
        let destroyOrder = CDKService.destroyStackOrder
        
        XCTAssertEqual(destroyOrder, deployOrder.reversed())
    }
    
    // MARK: - Context Generation Tests
    
    func testGenerateCDKContext() {
        let context = CDKService.generateContext(
            environment: "staging",
            region: "eu-west-1",
            accountId: "123456789012",
            tenantId: "tenant-abc"
        )
        
        XCTAssertEqual(context["environment"] as? String, "staging")
        XCTAssertEqual(context["region"] as? String, "eu-west-1")
        XCTAssertEqual(context["accountId"] as? String, "123456789012")
        XCTAssertEqual(context["tenantId"] as? String, "tenant-abc")
    }
    
    // MARK: - Validation Tests
    
    func testValidateEnvironmentAcceptsValidEnvironments() {
        XCTAssertTrue(CDKService.isValidEnvironment("dev"))
        XCTAssertTrue(CDKService.isValidEnvironment("staging"))
        XCTAssertTrue(CDKService.isValidEnvironment("prod"))
        XCTAssertTrue(CDKService.isValidEnvironment("production"))
    }
    
    func testValidateEnvironmentRejectsInvalidEnvironments() {
        XCTAssertFalse(CDKService.isValidEnvironment("test"))
        XCTAssertFalse(CDKService.isValidEnvironment("local"))
        XCTAssertFalse(CDKService.isValidEnvironment(""))
        XCTAssertFalse(CDKService.isValidEnvironment("PROD"))
    }
    
    func testValidateRegionAcceptsValidRegions() {
        XCTAssertTrue(CDKService.isValidRegion("us-east-1"))
        XCTAssertTrue(CDKService.isValidRegion("us-west-2"))
        XCTAssertTrue(CDKService.isValidRegion("eu-west-1"))
        XCTAssertTrue(CDKService.isValidRegion("ap-northeast-1"))
    }
    
    func testValidateRegionRejectsInvalidRegions() {
        XCTAssertFalse(CDKService.isValidRegion("invalid-region"))
        XCTAssertFalse(CDKService.isValidRegion(""))
        XCTAssertFalse(CDKService.isValidRegion("US-EAST-1"))
    }
}

// MARK: - CDKService Static Helpers

extension CDKService {
    /// Generate stack name with environment and region
    static func generateStackName(base: String, environment: String, region: String) -> String {
        return "\(base)-\(environment)-\(region)"
    }
    
    /// Order of stacks for deployment
    static let deploymentStackOrder = [
        "RadiantFoundation",
        "RadiantNetwork",
        "RadiantDatabase",
        "RadiantAuth",
        "RadiantAPI",
        "RadiantLambda",
        "RadiantAI",
        "RadiantMonitoring"
    ]
    
    /// Order of stacks for destroy (reverse of deploy)
    static var destroyStackOrder: [String] {
        deploymentStackOrder.reversed()
    }
    
    /// Generate CDK context dictionary
    static func generateContext(
        environment: String,
        region: String,
        accountId: String,
        tenantId: String
    ) -> [String: Any] {
        return [
            "environment": environment,
            "region": region,
            "accountId": accountId,
            "tenantId": tenantId
        ]
    }
    
    /// Validate environment name
    static func isValidEnvironment(_ env: String) -> Bool {
        let validEnvironments = ["dev", "staging", "prod", "production"]
        return validEnvironments.contains(env)
    }
    
    /// Validate AWS region
    static func isValidRegion(_ region: String) -> Bool {
        let validRegions = [
            "us-east-1", "us-east-2", "us-west-1", "us-west-2",
            "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1",
            "ap-northeast-1", "ap-northeast-2", "ap-southeast-1", "ap-southeast-2",
            "ap-south-1", "sa-east-1", "ca-central-1"
        ]
        return validRegions.contains(region)
    }
}
