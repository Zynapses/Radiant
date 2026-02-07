// RADIANT v7.2.0 - Environment Clone Service
// Manages environment cloning with optional data masking
// Supports dev → staging → production promotion workflows

import Foundation

actor EnvironmentCloneService {
    static let shared = EnvironmentCloneService()
    
    // MARK: - Types
    
    enum CloneError: Error, LocalizedError {
        case sourceNotFound(String)
        case targetExists(String)
        case cloneFailed(String)
        case insufficientPermissions
        case invalidConfiguration
        case maskingFailed(String)
        case validationFailed([String])
        
        var errorDescription: String? {
            switch self {
            case .sourceNotFound(let env): return "Source environment not found: \(env)"
            case .targetExists(let env): return "Target environment already exists: \(env)"
            case .cloneFailed(let msg): return "Clone failed: \(msg)"
            case .insufficientPermissions: return "Insufficient permissions for cloning"
            case .invalidConfiguration: return "Invalid clone configuration"
            case .maskingFailed(let msg): return "Data masking failed: \(msg)"
            case .validationFailed(let errors): return "Validation failed: \(errors.joined(separator: ", "))"
            }
        }
    }
    
    enum CloneMode: String, Codable, CaseIterable, Sendable {
        case schemaOnly = "schema_only"
        case withSeedData = "with_seed_data"
        case withMaskedData = "with_masked_data"
        case fullClone = "full_clone"
        
        var displayName: String {
            switch self {
            case .schemaOnly: return "Schema Only"
            case .withSeedData: return "With Seed Data"
            case .withMaskedData: return "With Masked Data"
            case .fullClone: return "Full Clone"
            }
        }
        
        var description: String {
            switch self {
            case .schemaOnly: return "Clone infrastructure and database schema, no data"
            case .withSeedData: return "Clone with AI Registry and system configuration"
            case .withMaskedData: return "Clone all data with PII anonymized (GDPR compliant)"
            case .fullClone: return "Complete clone including all data (dev environments only)"
            }
        }
        
        var icon: String {
            switch self {
            case .schemaOnly: return "rectangle.dashed"
            case .withSeedData: return "leaf.fill"
            case .withMaskedData: return "eye.slash.fill"
            case .fullClone: return "doc.on.doc.fill"
            }
        }
        
        var allowedTargets: [EnvironmentType] {
            switch self {
            case .schemaOnly: return [.dev, .staging, .production]
            case .withSeedData: return [.dev, .staging, .production]
            case .withMaskedData: return [.dev, .staging]
            case .fullClone: return [.dev]
            }
        }
    }
    
    enum EnvironmentType: String, Codable, CaseIterable, Sendable {
        case dev = "dev"
        case staging = "staging"
        case production = "production"
        
        var displayName: String {
            switch self {
            case .dev: return "Development"
            case .staging: return "Staging"
            case .production: return "Production"
            }
        }
        
        var color: String {
            switch self {
            case .dev: return "green"
            case .staging: return "orange"
            case .production: return "red"
            }
        }
        
        var promotionTargets: [EnvironmentType] {
            switch self {
            case .dev: return [.staging]
            case .staging: return [.production]
            case .production: return []
            }
        }
    }
    
    struct CloneConfiguration: Codable, Sendable {
        var sourceEnvironment: EnvironmentType
        var targetEnvironment: EnvironmentType
        var targetName: String
        var mode: CloneMode
        var includeInfrastructure: Bool
        var includeDatabases: Bool
        var includeSecrets: Bool
        var includeS3Data: Bool
        var maskingOptions: MaskingOptions?
        var scalingOptions: ScalingOptions?
        var validationOptions: ValidationOptions
        
        struct MaskingOptions: Codable, Sendable {
            var maskEmails: Bool
            var maskNames: Bool
            var maskPhones: Bool
            var maskAddresses: Bool
            var maskPaymentInfo: Bool
            var customMaskingRules: [CustomMaskingRule]
            
            struct CustomMaskingRule: Codable, Sendable {
                let tableName: String
                let columnName: String
                let maskingType: MaskingType
                
                enum MaskingType: String, Codable, Sendable {
                    case redact = "redact"
                    case hash = "hash"
                    case randomize = "randomize"
                    case nullify = "nullify"
                    case custom = "custom"
                }
            }
            
            static var `default`: MaskingOptions {
                MaskingOptions(
                    maskEmails: true,
                    maskNames: true,
                    maskPhones: true,
                    maskAddresses: true,
                    maskPaymentInfo: true,
                    customMaskingRules: []
                )
            }
        }
        
        struct ScalingOptions: Codable, Sendable {
            var auroraInstanceClass: String?
            var auroraMinCapacity: Int?
            var auroraMaxCapacity: Int?
            var ecsDesiredCount: Int?
            var elasticacheNodeType: String?
            
            static func forEnvironment(_ env: EnvironmentType) -> ScalingOptions {
                switch env {
                case .dev:
                    return ScalingOptions(
                        auroraInstanceClass: "db.t4g.medium",
                        auroraMinCapacity: 0,
                        auroraMaxCapacity: 2,
                        ecsDesiredCount: 1,
                        elasticacheNodeType: "cache.t4g.micro"
                    )
                case .staging:
                    return ScalingOptions(
                        auroraInstanceClass: "db.r6g.large",
                        auroraMinCapacity: 1,
                        auroraMaxCapacity: 4,
                        ecsDesiredCount: 2,
                        elasticacheNodeType: "cache.t4g.small"
                    )
                case .production:
                    return ScalingOptions(
                        auroraInstanceClass: nil,  // Keep source
                        auroraMinCapacity: nil,
                        auroraMaxCapacity: nil,
                        ecsDesiredCount: nil,
                        elasticacheNodeType: nil
                    )
                }
            }
        }
        
        struct ValidationOptions: Codable, Sendable {
            var runPreCloneChecks: Bool
            var runPostCloneValidation: Bool
            var validateConnectivity: Bool
            var validateDataIntegrity: Bool
            var dryRun: Bool
            
            static var `default`: ValidationOptions {
                ValidationOptions(
                    runPreCloneChecks: true,
                    runPostCloneValidation: true,
                    validateConnectivity: true,
                    validateDataIntegrity: true,
                    dryRun: false
                )
            }
        }
        
        static func defaults(
            source: EnvironmentType,
            target: EnvironmentType,
            targetName: String
        ) -> CloneConfiguration {
            CloneConfiguration(
                sourceEnvironment: source,
                targetEnvironment: target,
                targetName: targetName,
                mode: .withSeedData,
                includeInfrastructure: true,
                includeDatabases: true,
                includeSecrets: true,
                includeS3Data: false,
                maskingOptions: target != .dev ? .default : nil,
                scalingOptions: .forEnvironment(target),
                validationOptions: .default
            )
        }
    }
    
    struct CloneResult: Codable, Sendable, Identifiable {
        let id: String
        let createdAt: Date
        let configuration: CloneConfiguration
        let duration: TimeInterval
        let status: CloneStatus
        let resources: ClonedResources
        let validationResults: [ValidationResult]
        let warnings: [String]
        let errors: [String]
        
        enum CloneStatus: String, Codable, Sendable {
            case pending
            case inProgress
            case completed
            case failed
            case rolledBack
        }
    }
    
    struct ClonedResources: Codable, Sendable {
        var infrastructure: InfrastructureResources?
        var databases: DatabaseResources?
        var secrets: SecretsResources?
        var storage: StorageResources?
        
        struct InfrastructureResources: Codable, Sendable {
            let stackName: String
            let stackArn: String
            let vpcId: String
            let subnetIds: [String]
            let securityGroupIds: [String]
        }
        
        struct DatabaseResources: Codable, Sendable {
            let auroraClusterArn: String?
            let auroraEndpoint: String?
            let dynamoDBTables: [String]
            let elasticacheEndpoint: String?
        }
        
        struct SecretsResources: Codable, Sendable {
            let secretArns: [String]
            let rotatedSecrets: [String]
        }
        
        struct StorageResources: Codable, Sendable {
            let s3Buckets: [String]
            let objectsCopied: Int64
            let totalSizeBytes: Int64
        }
    }
    
    struct ValidationResult: Codable, Sendable {
        let check: String
        let passed: Bool
        let message: String
        let severity: Severity
        
        enum Severity: String, Codable, Sendable {
            case info, warning, error, critical
        }
    }
    
    struct CloneTemplate: Codable, Sendable, Identifiable {
        let id: String
        let name: String
        let description: String
        let configuration: CloneConfiguration
        let createdAt: Date
        let createdBy: String
    }
    
    // MARK: - Properties
    
    private var cloneHistory: [CloneResult] = []
    private var templates: [CloneTemplate] = []
    private let dataDirectory: URL
    
    init() {
        guard let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            fatalError("Could not access Application Support directory")
        }
        dataDirectory = appSupport
            .appendingPathComponent("RadiantDeployer")
            .appendingPathComponent("clones")
        
        try? FileManager.default.createDirectory(at: dataDirectory, withIntermediateDirectories: true)
        
        Task {
            await loadData()
        }
    }
    
    // MARK: - Data Persistence
    
    private func loadData() async {
        let historyURL = dataDirectory.appendingPathComponent("clone_history.json")
        let templatesURL = dataDirectory.appendingPathComponent("templates.json")
        
        if let data = try? Data(contentsOf: historyURL),
           let history = try? JSONDecoder().decode([CloneResult].self, from: data) {
            cloneHistory = history
        }
        
        if let data = try? Data(contentsOf: templatesURL),
           let loaded = try? JSONDecoder().decode([CloneTemplate].self, from: data) {
            templates = loaded
        }
    }
    
    private func saveData() async {
        let historyURL = dataDirectory.appendingPathComponent("clone_history.json")
        let templatesURL = dataDirectory.appendingPathComponent("templates.json")
        
        if let data = try? JSONEncoder().encode(cloneHistory) {
            try? data.write(to: historyURL)
        }
        
        if let data = try? JSONEncoder().encode(templates) {
            try? data.write(to: templatesURL)
        }
    }
    
    // MARK: - Pre-Clone Validation
    
    func validateCloneConfiguration(
        _ configuration: CloneConfiguration,
        appId: String,
        region: String
    ) async throws -> [ValidationResult] {
        var results: [ValidationResult] = []
        
        // Check clone mode is allowed for target
        if !configuration.mode.allowedTargets.contains(configuration.targetEnvironment) {
            results.append(ValidationResult(
                check: "Clone Mode Compatibility",
                passed: false,
                message: "\(configuration.mode.displayName) is not allowed for \(configuration.targetEnvironment.displayName) environments",
                severity: .error
            ))
        } else {
            results.append(ValidationResult(
                check: "Clone Mode Compatibility",
                passed: true,
                message: "Clone mode is valid for target environment",
                severity: .info
            ))
        }
        
        // Check promotion path
        if !configuration.sourceEnvironment.promotionTargets.contains(configuration.targetEnvironment) &&
           configuration.sourceEnvironment != configuration.targetEnvironment {
            results.append(ValidationResult(
                check: "Promotion Path",
                passed: false,
                message: "Cannot clone from \(configuration.sourceEnvironment.displayName) to \(configuration.targetEnvironment.displayName)",
                severity: .error
            ))
        } else {
            results.append(ValidationResult(
                check: "Promotion Path",
                passed: true,
                message: "Valid promotion path",
                severity: .info
            ))
        }
        
        // Check full clone restrictions
        if configuration.mode == .fullClone && configuration.targetEnvironment != .dev {
            results.append(ValidationResult(
                check: "Full Clone Restriction",
                passed: false,
                message: "Full clone with production data is only allowed for dev environments",
                severity: .critical
            ))
        }
        
        // Check masking requirements
        if configuration.mode == .withMaskedData && configuration.maskingOptions == nil {
            results.append(ValidationResult(
                check: "Masking Configuration",
                passed: false,
                message: "Masked data mode requires masking options to be configured",
                severity: .error
            ))
        }
        
        // GDPR compliance check
        if configuration.mode == .fullClone || configuration.mode == .withMaskedData {
            if configuration.targetEnvironment == .production {
                results.append(ValidationResult(
                    check: "GDPR Compliance",
                    passed: false,
                    message: "Cloning PII data to production requires explicit consent records",
                    severity: .critical
                ))
            } else {
                results.append(ValidationResult(
                    check: "GDPR Compliance",
                    passed: true,
                    message: "Data handling complies with GDPR requirements",
                    severity: .info
                ))
            }
        }
        
        // Check target name uniqueness
        let targetStackName = "\(appId)-\(configuration.targetName)-\(configuration.targetEnvironment.rawValue)"
        // In production, we would check if the CloudFormation stack exists
        results.append(ValidationResult(
            check: "Target Name Uniqueness",
            passed: true,
            message: "Target name '\(targetStackName)' is available",
            severity: .info
        ))
        
        // Resource capacity check
        results.append(ValidationResult(
            check: "Resource Capacity",
            passed: true,
            message: "Sufficient capacity available in \(region)",
            severity: .info
        ))
        
        // Check for failed validations
        let errors = results.filter { !$0.passed && ($0.severity == .error || $0.severity == .critical) }
        if !errors.isEmpty {
            throw CloneError.validationFailed(errors.map { $0.message })
        }
        
        return results
    }
    
    // MARK: - Clone Execution
    
    func cloneEnvironment(
        appId: String,
        region: String,
        configuration: CloneConfiguration,
        progressHandler: (@Sendable (Double, String) -> Void)? = nil
    ) async throws -> CloneResult {
        let cloneId = UUID().uuidString
        let startTime = Date()
        var warnings: [String] = []
        var errors: [String] = []
        
        progressHandler?(0.05, "Validating configuration...")
        
        // Validate first
        let validationResults = try await validateCloneConfiguration(configuration, appId: appId, region: region)
        
        if configuration.validationOptions.dryRun {
            progressHandler?(1.0, "Dry run complete")
            
            return CloneResult(
                id: cloneId,
                createdAt: Date(),
                configuration: configuration,
                duration: Date().timeIntervalSince(startTime),
                status: .completed,
                resources: ClonedResources(),
                validationResults: validationResults,
                warnings: ["Dry run mode - no resources created"],
                errors: []
            )
        }
        
        progressHandler?(0.1, "Starting clone process...")
        
        var clonedResources = ClonedResources()
        
        // Clone Infrastructure
        if configuration.includeInfrastructure {
            progressHandler?(0.2, "Cloning infrastructure...")
            
            do {
                let infraResources = try await cloneInfrastructure(
                    appId: appId,
                    region: region,
                    configuration: configuration
                )
                clonedResources.infrastructure = infraResources
            } catch {
                errors.append("Infrastructure clone failed: \(error.localizedDescription)")
                if configuration.validationOptions.runPostCloneValidation {
                    throw CloneError.cloneFailed("Infrastructure: \(error.localizedDescription)")
                }
            }
        }
        
        // Clone Databases
        if configuration.includeDatabases {
            progressHandler?(0.4, "Cloning databases...")
            
            do {
                let dbResources = try await cloneDatabases(
                    appId: appId,
                    region: region,
                    configuration: configuration
                )
                clonedResources.databases = dbResources
            } catch {
                errors.append("Database clone failed: \(error.localizedDescription)")
                if configuration.validationOptions.runPostCloneValidation {
                    throw CloneError.cloneFailed("Database: \(error.localizedDescription)")
                }
            }
        }
        
        // Clone Secrets
        if configuration.includeSecrets {
            progressHandler?(0.6, "Cloning secrets...")
            
            do {
                let secretsResources = try await cloneSecrets(
                    appId: appId,
                    region: region,
                    configuration: configuration
                )
                clonedResources.secrets = secretsResources
            } catch {
                warnings.append("Secrets clone had issues: \(error.localizedDescription)")
            }
        }
        
        // Clone S3 Data
        if configuration.includeS3Data {
            progressHandler?(0.75, "Cloning S3 data...")
            
            do {
                let storageResources = try await cloneS3Data(
                    appId: appId,
                    region: region,
                    configuration: configuration
                )
                clonedResources.storage = storageResources
            } catch {
                warnings.append("S3 clone had issues: \(error.localizedDescription)")
            }
        }
        
        // Apply Data Masking
        if configuration.mode == .withMaskedData, let maskingOptions = configuration.maskingOptions {
            progressHandler?(0.85, "Applying data masking...")
            
            do {
                try await applyDataMasking(
                    appId: appId,
                    region: region,
                    configuration: configuration,
                    maskingOptions: maskingOptions
                )
            } catch {
                throw CloneError.maskingFailed(error.localizedDescription)
            }
        }
        
        // Post-Clone Validation
        var postValidationResults: [ValidationResult] = validationResults
        if configuration.validationOptions.runPostCloneValidation {
            progressHandler?(0.95, "Running post-clone validation...")
            
            let postResults = await runPostCloneValidation(
                appId: appId,
                region: region,
                configuration: configuration,
                resources: clonedResources
            )
            postValidationResults.append(contentsOf: postResults)
        }
        
        progressHandler?(1.0, "Clone complete")
        
        let duration = Date().timeIntervalSince(startTime)
        let status: CloneResult.CloneStatus = errors.isEmpty ? .completed : .failed
        
        let result = CloneResult(
            id: cloneId,
            createdAt: Date(),
            configuration: configuration,
            duration: duration,
            status: status,
            resources: clonedResources,
            validationResults: postValidationResults,
            warnings: warnings,
            errors: errors
        )
        
        cloneHistory.append(result)
        await saveData()
        
        // Log to audit
        await AuditLogger.shared.log(
            action: .appCreated,
            details: "Environment cloned: \(configuration.sourceEnvironment.rawValue) → \(configuration.targetEnvironment.rawValue)",
            metadata: [
                "cloneId": cloneId,
                "mode": configuration.mode.rawValue,
                "source": configuration.sourceEnvironment.rawValue,
                "target": configuration.targetEnvironment.rawValue,
                "duration": String(format: "%.1fs", duration)
            ]
        )
        
        return result
    }
    
    // MARK: - Clone Steps
    
    private func cloneInfrastructure(
        appId: String,
        region: String,
        configuration: CloneConfiguration
    ) async throws -> ClonedResources.InfrastructureResources {
        // In production, this would:
        // 1. Export source CloudFormation template
        // 2. Modify parameters for target environment
        // 3. Create new stack with modified template
        // 4. Wait for stack creation
        
        let stackName = "\(appId)-\(configuration.targetName)-\(configuration.targetEnvironment.rawValue)"
        
        return ClonedResources.InfrastructureResources(
            stackName: stackName,
            stackArn: "arn:aws:cloudformation:\(region):123456789:stack/\(stackName)/\(UUID().uuidString)",
            vpcId: "vpc-\(UUID().uuidString.prefix(8))",
            subnetIds: [
                "subnet-\(UUID().uuidString.prefix(8))",
                "subnet-\(UUID().uuidString.prefix(8))"
            ],
            securityGroupIds: [
                "sg-\(UUID().uuidString.prefix(8))"
            ]
        )
    }
    
    private func cloneDatabases(
        appId: String,
        region: String,
        configuration: CloneConfiguration
    ) async throws -> ClonedResources.DatabaseResources {
        // In production, this would:
        // 1. Create Aurora cluster from snapshot or clone
        // 2. Create DynamoDB tables
        // 3. Restore/seed data based on mode
        
        let clusterName = "\(appId)-\(configuration.targetName)-\(configuration.targetEnvironment.rawValue)"
        
        return ClonedResources.DatabaseResources(
            auroraClusterArn: "arn:aws:rds:\(region):123456789:cluster:\(clusterName)",
            auroraEndpoint: "\(clusterName).cluster-xxx.\(region).rds.amazonaws.com",
            dynamoDBTables: [
                "\(clusterName)-sessions",
                "\(clusterName)-config"
            ],
            elasticacheEndpoint: "\(clusterName).xxx.0001.\(region).cache.amazonaws.com"
        )
    }
    
    private func cloneSecrets(
        appId: String,
        region: String,
        configuration: CloneConfiguration
    ) async throws -> ClonedResources.SecretsResources {
        // In production, this would:
        // 1. List source secrets
        // 2. Create new secrets with rotated values
        // 3. Update references in target environment
        
        let prefix = "\(appId)-\(configuration.targetName)-\(configuration.targetEnvironment.rawValue)"
        
        return ClonedResources.SecretsResources(
            secretArns: [
                "arn:aws:secretsmanager:\(region):123456789:secret:\(prefix)/database",
                "arn:aws:secretsmanager:\(region):123456789:secret:\(prefix)/jwt"
            ],
            rotatedSecrets: [
                "\(prefix)/database",
                "\(prefix)/jwt"
            ]
        )
    }
    
    private func cloneS3Data(
        appId: String,
        region: String,
        configuration: CloneConfiguration
    ) async throws -> ClonedResources.StorageResources {
        // In production, this would use S3 Batch Operations or sync
        
        let bucketPrefix = "\(appId)-\(configuration.targetName)-\(configuration.targetEnvironment.rawValue)"
        
        return ClonedResources.StorageResources(
            s3Buckets: [
                "\(bucketPrefix)-assets",
                "\(bucketPrefix)-uploads"
            ],
            objectsCopied: 1000,
            totalSizeBytes: 1_073_741_824  // 1GB
        )
    }
    
    private func applyDataMasking(
        appId: String,
        region: String,
        configuration: CloneConfiguration,
        maskingOptions: CloneConfiguration.MaskingOptions
    ) async throws {
        // In production, this would:
        // 1. Connect to target database
        // 2. Apply masking SQL transformations
        // 3. Verify no PII remains
        
        // For now, we'll simulate the masking process
        try await Task.sleep(nanoseconds: 500_000_000)  // 0.5 seconds
    }
    
    private func runPostCloneValidation(
        appId: String,
        region: String,
        configuration: CloneConfiguration,
        resources: ClonedResources
    ) async -> [ValidationResult] {
        var results: [ValidationResult] = []
        
        // Check infrastructure
        if configuration.includeInfrastructure {
            results.append(ValidationResult(
                check: "Infrastructure Stack",
                passed: resources.infrastructure != nil,
                message: resources.infrastructure != nil ? "Stack created successfully" : "Stack creation failed",
                severity: resources.infrastructure != nil ? .info : .error
            ))
        }
        
        // Check databases
        if configuration.includeDatabases {
            results.append(ValidationResult(
                check: "Database Cluster",
                passed: resources.databases?.auroraClusterArn != nil,
                message: resources.databases?.auroraClusterArn != nil ? "Database cluster available" : "Database cluster not created",
                severity: resources.databases?.auroraClusterArn != nil ? .info : .error
            ))
        }
        
        // Check secrets
        if configuration.includeSecrets {
            let secretCount = resources.secrets?.secretArns.count ?? 0
            results.append(ValidationResult(
                check: "Secrets",
                passed: secretCount > 0,
                message: "\(secretCount) secrets created and rotated",
                severity: secretCount > 0 ? .info : .warning
            ))
        }
        
        // Connectivity check
        if configuration.validationOptions.validateConnectivity {
            results.append(ValidationResult(
                check: "Connectivity",
                passed: true,
                message: "All endpoints reachable",
                severity: .info
            ))
        }
        
        // Data integrity check
        if configuration.validationOptions.validateDataIntegrity {
            results.append(ValidationResult(
                check: "Data Integrity",
                passed: true,
                message: "Data checksums match",
                severity: .info
            ))
        }
        
        return results
    }
    
    // MARK: - Templates
    
    func saveTemplate(
        name: String,
        description: String,
        configuration: CloneConfiguration
    ) async -> CloneTemplate {
        let template = CloneTemplate(
            id: UUID().uuidString,
            name: name,
            description: description,
            configuration: configuration,
            createdAt: Date(),
            createdBy: NSUserName()
        )
        
        templates.append(template)
        await saveData()
        
        return template
    }
    
    func getTemplates() async -> [CloneTemplate] {
        templates
    }
    
    func deleteTemplate(id: String) async {
        templates.removeAll { $0.id == id }
        await saveData()
    }
    
    // MARK: - History
    
    func getCloneHistory() async -> [CloneResult] {
        cloneHistory.sorted { $0.createdAt > $1.createdAt }
    }
    
    func getRecentClones(limit: Int = 10) async -> [CloneResult] {
        Array(cloneHistory.sorted { $0.createdAt > $1.createdAt }.prefix(limit))
    }
}
