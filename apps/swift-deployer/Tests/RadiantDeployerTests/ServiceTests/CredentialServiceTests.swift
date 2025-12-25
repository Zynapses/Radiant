import XCTest
@testable import RadiantDeployer

final class CredentialServiceTests: XCTestCase {
    
    var credentialService: CredentialService!
    
    override func setUp() {
        super.setUp()
        credentialService = CredentialService.shared
    }
    
    override func tearDown() {
        credentialService = nil
        super.tearDown()
    }
    
    // MARK: - Validation Tests
    
    func testValidateValidCredentials() async {
        // Given
        let credentials = CredentialSet(
            id: "test",
            name: "Test Credentials",
            accessKeyId: "AKIAIOSFODNN7EXAMPLE",
            secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            region: "us-east-1"
        )
        
        // When
        let validation = credentialService.validateFormat(credentials)
        
        // Then
        XCTAssertTrue(validation.accessKeyIdValid)
        XCTAssertTrue(validation.secretAccessKeyValid)
        XCTAssertTrue(validation.regionValid)
    }
    
    func testValidateInvalidAccessKeyId() async {
        // Given
        let credentials = CredentialSet(
            id: "test",
            name: "Test Credentials",
            accessKeyId: "invalid",
            secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            region: "us-east-1"
        )
        
        // When
        let validation = credentialService.validateFormat(credentials)
        
        // Then
        XCTAssertFalse(validation.accessKeyIdValid)
    }
    
    func testValidateEmptySecretAccessKey() async {
        // Given
        let credentials = CredentialSet(
            id: "test",
            name: "Test Credentials",
            accessKeyId: "AKIAIOSFODNN7EXAMPLE",
            secretAccessKey: "",
            region: "us-east-1"
        )
        
        // When
        let validation = credentialService.validateFormat(credentials)
        
        // Then
        XCTAssertFalse(validation.secretAccessKeyValid)
    }
    
    func testValidateInvalidRegion() async {
        // Given
        let credentials = CredentialSet(
            id: "test",
            name: "Test Credentials",
            accessKeyId: "AKIAIOSFODNN7EXAMPLE",
            secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            region: "invalid-region"
        )
        
        // When
        let validation = credentialService.validateFormat(credentials)
        
        // Then
        XCTAssertFalse(validation.regionValid)
    }
    
    // MARK: - Region Tests
    
    func testSupportedRegions() {
        // When
        let regions = credentialService.supportedRegions
        
        // Then
        XCTAssertTrue(regions.contains("us-east-1"))
        XCTAssertTrue(regions.contains("us-west-2"))
        XCTAssertTrue(regions.contains("eu-west-1"))
        XCTAssertTrue(regions.contains("ap-southeast-1"))
    }
    
    // MARK: - Storage Tests
    
    func testSaveAndRetrieveCredentials() async throws {
        // Given
        let testId = "test-\(UUID().uuidString)"
        let credentials = CredentialSet(
            id: testId,
            name: "Test Credentials",
            accessKeyId: "AKIAIOSFODNN7EXAMPLE",
            secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            region: "us-east-1"
        )
        
        // When
        try await credentialService.save(credentials)
        let retrieved = try await credentialService.get(id: testId)
        
        // Then
        XCTAssertNotNil(retrieved)
        XCTAssertEqual(retrieved?.accessKeyId, credentials.accessKeyId)
        XCTAssertEqual(retrieved?.region, credentials.region)
        
        // Cleanup
        try? await credentialService.delete(id: testId)
    }
    
    func testDeleteCredentials() async throws {
        // Given
        let testId = "test-delete-\(UUID().uuidString)"
        let credentials = CredentialSet(
            id: testId,
            name: "To Delete",
            accessKeyId: "AKIAIOSFODNN7EXAMPLE",
            secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            region: "us-east-1"
        )
        
        // When
        try await credentialService.save(credentials)
        try await credentialService.delete(id: testId)
        let retrieved = try await credentialService.get(id: testId)
        
        // Then
        XCTAssertNil(retrieved)
    }
}

// MARK: - Helper Extensions

extension CredentialService {
    struct FormatValidation {
        let accessKeyIdValid: Bool
        let secretAccessKeyValid: Bool
        let regionValid: Bool
        
        var isValid: Bool {
            accessKeyIdValid && secretAccessKeyValid && regionValid
        }
    }
    
    func validateFormat(_ credentials: CredentialSet) -> FormatValidation {
        let accessKeyIdPattern = "^AKIA[A-Z0-9]{16}$"
        let accessKeyIdValid = credentials.accessKeyId.range(
            of: accessKeyIdPattern,
            options: .regularExpression
        ) != nil
        
        let secretAccessKeyValid = credentials.secretAccessKey.count >= 20
        
        let validRegions = supportedRegions
        let regionValid = validRegions.contains(credentials.region)
        
        return FormatValidation(
            accessKeyIdValid: accessKeyIdValid,
            secretAccessKeyValid: secretAccessKeyValid,
            regionValid: regionValid
        )
    }
    
    var supportedRegions: [String] {
        [
            "us-east-1", "us-east-2", "us-west-1", "us-west-2",
            "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-north-1",
            "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2", "ap-south-1",
            "sa-east-1", "ca-central-1", "me-south-1", "af-south-1"
        ]
    }
}
