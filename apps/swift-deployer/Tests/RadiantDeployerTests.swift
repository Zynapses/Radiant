import XCTest
@testable import RadiantDeployer

final class RadiantDeployerTests: XCTestCase {
    func testVersionConstant() {
        XCTAssertEqual(RADIANT_VERSION, "4.18.0")
    }
    
    func testManagedAppDefaults() {
        XCTAssertEqual(ManagedApp.defaults.count, 4)
        XCTAssertEqual(ManagedApp.defaults[0].id, "thinktank")
    }
    
    func testEnvironmentColors() {
        XCTAssertNotNil(DeployEnvironment.dev.color)
        XCTAssertNotNil(DeployEnvironment.staging.color)
        XCTAssertNotNil(DeployEnvironment.prod.color)
    }
}
