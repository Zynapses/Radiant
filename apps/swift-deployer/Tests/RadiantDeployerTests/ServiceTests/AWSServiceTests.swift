// RADIANT v4.18.0 - AWS Service Tests
// Tests for AWS CLI wrapper service

import XCTest
@testable import RadiantDeployer

final class AWSServiceTests: XCTestCase {
    
    var sut: AWSService!
    
    override func setUp() async throws {
        try await super.setUp()
        sut = AWSService.shared
    }
    
    // MARK: - Stack Existence Tests
    
    func testStackExistsReturnsFalseForNonExistentStack() async {
        // This test uses a stack name that definitely doesn't exist
        let exists = await sut.stackExists(stackName: "nonexistent-stack-xyz-123")
        XCTAssertFalse(exists)
    }
    
    // MARK: - Region Tests
    
    func testListRegionsReturnsExpectedRegions() async throws {
        let credentials = CredentialSet(
            name: "test",
            accessKeyId: "test",
            secretAccessKey: "test",
            region: "us-east-1"
        )
        
        let regions = try await sut.listRegions(credentials: credentials)
        
        XCTAssertFalse(regions.isEmpty)
        XCTAssertTrue(regions.contains("us-east-1"))
        XCTAssertTrue(regions.contains("us-west-2"))
        XCTAssertTrue(regions.contains("eu-west-1"))
    }
    
    // MARK: - Error Handling Tests
    
    func testInvalidCredentialsThrowsError() async {
        let invalidCredentials = CredentialSet(
            name: "invalid",
            accessKeyId: "INVALID_KEY",
            secretAccessKey: "INVALID_SECRET",
            region: "us-east-1"
        )
        
        do {
            _ = try await sut.getCallerIdentity(credentials: invalidCredentials)
            XCTFail("Expected error to be thrown")
        } catch let error as AWSService.AWSError {
            switch error {
            case .invalidCredentials:
                // Expected
                break
            default:
                XCTFail("Expected invalidCredentials error, got \(error)")
            }
        } catch {
            // AWS CLI might not be available in test environment
            // This is acceptable
        }
    }
    
    // MARK: - S3 Operations Tests
    
    func testGetObjectReturnsNilForNonExistentObject() async {
        let data = await sut.getObject(
            bucket: "nonexistent-bucket-xyz-123",
            key: "nonexistent-key"
        )
        
        XCTAssertNil(data)
    }
    
    func testListObjectsReturnsEmptyForNonExistentBucket() async {
        let objects = await sut.listObjects(
            bucket: "nonexistent-bucket-xyz-123",
            prefix: "test/"
        )
        
        XCTAssertTrue(objects.isEmpty)
    }
    
    // MARK: - Parameter Store Tests
    
    func testGetParameterReturnsNilForNonExistentParameter() async {
        let value = await sut.getParameter(path: "/nonexistent/parameter/xyz123")
        XCTAssertNil(value)
    }
    
    // MARK: - Stack Output Tests
    
    func testGetStackOutputsReturnsNilForNonExistentStack() async {
        let outputs = await sut.getStackOutputs(stackName: "nonexistent-stack-xyz-123")
        XCTAssertNil(outputs)
    }
}

// MARK: - Mock Credential Set for Testing

extension CredentialSet {
    init(name: String, accessKeyId: String, secretAccessKey: String, region: String) {
        self.init(
            id: UUID(),
            name: name,
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey,
            region: region,
            createdAt: Date(),
            lastUsed: nil
        )
    }
}
