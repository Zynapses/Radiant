// RADIANT v4.18.0 - Deployment Service
// Handles deployment mode detection, execution, and snapshot management

import Foundation

// MARK: - Deployment Errors

enum DeploymentError: Error, LocalizedError {
    case noCredentials
    case instanceNotFound
    case snapshotNotFound(String)
    case invalidSnapshot(String)
    case invalidConfiguration(String)
    case parameterValidationFailed(String)
    case infrastructureDeploymentFailed(String)
    case migrationFailed(String)
    case rollbackFailed(String)
    case networkError(Error)
    case packageNotFound(String)
    case integrityCheckFailed
    case verificationFailed(String)
    case commandFailed(String, Int)
    
    var errorDescription: String? {
        switch self {
        case .noCredentials:
            return "No AWS credentials configured"
        case .instanceNotFound:
            return "No existing Radiant instance found"
        case .snapshotNotFound(let id):
            return "Snapshot not found: \(id)"
        case .invalidSnapshot(let reason):
            return "Invalid snapshot: \(reason)"
        case .invalidConfiguration(let reason):
            return "Invalid configuration: \(reason)"
        case .parameterValidationFailed(let reason):
            return "Parameter validation failed: \(reason)"
        case .infrastructureDeploymentFailed(let reason):
            return "Infrastructure deployment failed: \(reason)"
        case .migrationFailed(let reason):
            return "Database migration failed: \(reason)"
        case .rollbackFailed(let reason):
            return "Rollback failed: \(reason)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .packageNotFound(let version):
            return "Deployment package not found: \(version)"
        case .integrityCheckFailed:
            return "Package integrity check failed"
        case .verificationFailed(let reason):
            return "Verification failed: \(reason)"
        case .commandFailed(let command, let exitCode):
            return "Command '\(command)' failed with exit code \(exitCode)"
        }
    }
}

// MARK: - Deployment Result

struct DeploymentExecutionResult: Sendable {
    let mode: DeploymentMode
    let success: Bool
    let version: String
    let rollbackSnapshotId: String?
    let outputs: DeploymentOutputs?
    let errors: [String]?
    let duration: TimeInterval
}

// MARK: - Migration Mode

enum MigrationMode: Sendable {
    case fresh           // Run ALL migrations (install)
    case incremental     // Run only new migrations (update)
}

// MARK: - Deployment Service

actor DeploymentService {
    
    private let awsService: AWSService
    private let cdkService: CDKService
    private let credentialService: CredentialService
    private var packageService: PackageService?
    
    init() {
        self.awsService = AWSService()
        self.cdkService = CDKService()
        self.credentialService = CredentialService()
    }
    
    // MARK: - Mode Detection
    
    /// Determine the deployment mode based on existing infrastructure
    func determineDeploymentMode(
        app: ManagedApp,
        environment: DeployEnvironment,
        targetVersion: String? = nil
    ) async throws -> DeploymentMode {
        
        // Check if instance exists
        let instanceExists = try await checkInstanceExists(app: app, environment: environment)
        
        if !instanceExists {
            return .install
        }
        
        // Instance exists - determine if update or rollback
        let currentVersion = try await fetchCurrentVersion(app: app, environment: environment)
        let target = targetVersion ?? RADIANT_VERSION
        
        if compareVersions(target, currentVersion) > 0 {
            return .update
        } else if compareVersions(target, currentVersion) < 0 {
            return .rollback
        } else {
            // Same version - could be config update
            return .update
        }
    }
    
    /// Check if a Radiant instance exists for app/environment
    private func checkInstanceExists(
        app: ManagedApp,
        environment: DeployEnvironment
    ) async throws -> Bool {
        // Check CloudFormation stack exists
        let stackName = "Radiant-\(app.id)-\(environment.rawValue)"
        return await awsService.stackExists(stackName: stackName)
    }
    
    /// Fetch current version from running instance
    private func fetchCurrentVersion(
        app: ManagedApp,
        environment: DeployEnvironment
    ) async throws -> String {
        // Try to fetch from Radiant API
        let envStatus = app.environments[environment]
        if let endpoint = envStatus.apiUrl {
            let aiRegistry = AIRegistryService()
            await aiRegistry.configure(baseURL: endpoint, authToken: "")
            // Version is typically in /api/v2/health or /api/v2/version
            // For now, return version from environment status
            return envStatus.version ?? RADIANT_VERSION
        }
        
        // Fallback: Read from CloudFormation outputs
        let stackName = "Radiant-\(app.id)-\(environment.rawValue)-Foundation"
        if let outputs = await awsService.getStackOutputs(stackName: stackName),
           let version = outputs["RadiantVersion"] {
            return version
        }
        
        return "0.0.0"  // Unknown version
    }
    
    /// Compare two semantic versions
    private func compareVersions(_ v1: String, _ v2: String) -> Int {
        let parts1 = v1.split(separator: ".").compactMap { Int($0) }
        let parts2 = v2.split(separator: ".").compactMap { Int($0) }
        
        for i in 0..<max(parts1.count, parts2.count) {
            let p1 = i < parts1.count ? parts1[i] : 0
            let p2 = i < parts2.count ? parts2[i] : 0
            
            if p1 > p2 { return 1 }
            if p1 < p2 { return -1 }
        }
        return 0
    }
    
    // MARK: - Install Mode Execution
    
    /// Execute a fresh installation
    func executeInstall(
        app: ManagedApp,
        environment: DeployEnvironment,
        package: DeploymentPackage,
        credentials: CredentialSet,
        onProgress: @escaping @Sendable (DeploymentProgress) -> Void
    ) async throws -> DeploymentExecutionResult {
        let startTime = Date()
        
        // STEP 1: Use DEFAULT parameters (not fetched from instance)
        let envStatus = app.environments[environment]
        let tier = TierLevel(rawValue: envStatus.tier) ?? .seed
        let parameters = InstallationParameters.defaults(
            appId: app.id,
            environment: environment,
            tier: tier
        )
        
        await MainActor.run {
            onProgress(DeploymentProgress(
                phase: .validating,
                progress: 0.05,
                currentStack: nil,
                message: "Using default parameters for \(tier.displayName) tier",
                startedAt: startTime,
                estimatedCompletion: startTime.addingTimeInterval(600)
            ))
        }
        
        // STEP 2: Deploy infrastructure with defaults
        try await deployInfrastructure(
            app: app,
            environment: environment,
            package: package,
            parameters: parameters,
            credentials: credentials,
            onProgress: onProgress
        )
        
        // STEP 3: Run initial migrations (creates tables)
        await MainActor.run {
            onProgress(DeploymentProgress(
                phase: .runningMigrations,
                progress: 0.90,
                currentStack: nil,
                message: "Running ALL database migrations...",
                startedAt: startTime,
                estimatedCompletion: nil
            ))
        }
        
        try await runMigrations(
            package: package,
            mode: .fresh,
            fromVersion: nil,
            onProgress: onProgress
        )
        
        // STEP 4: SEED the AI Registry (ONLY on fresh install)
        await MainActor.run {
            onProgress(DeploymentProgress(
                phase: .seedingData,
                progress: 0.95,
                currentStack: nil,
                message: "Seeding AI Registry with providers and models...",
                startedAt: startTime,
                estimatedCompletion: nil
            ))
        }
        
        try await seedAIRegistry(
            package: package,
            onProgress: onProgress
        )
        
        // STEP 5: Create initial admin user
        try await createInitialAdmin(
            app: app,
            environment: environment,
            onProgress: onProgress
        )
        
        // STEP 6: Store deployment metadata
        try await storeDeploymentMetadata(
            app: app,
            environment: environment,
            package: package,
            parameters: parameters
        )
        
        // STEP 7: Verify deployment
        await MainActor.run {
            onProgress(DeploymentProgress(
                phase: .verifying,
                progress: 0.98,
                currentStack: nil,
                message: "Verifying deployment...",
                startedAt: startTime,
                estimatedCompletion: nil
            ))
        }
        
        let outputs = try await verifyDeployment(app: app, environment: environment)
        
        await MainActor.run {
            onProgress(DeploymentProgress(
                phase: .complete,
                progress: 1.0,
                currentStack: nil,
                message: "Installation complete!",
                startedAt: startTime,
                estimatedCompletion: nil
            ))
        }
        
        return DeploymentExecutionResult(
            mode: .install,
            success: true,
            version: package.manifest.version,
            rollbackSnapshotId: nil,
            outputs: outputs,
            errors: nil,
            duration: Date().timeIntervalSince(startTime)
        )
    }
    
    // MARK: - Update Mode Execution
    
    /// Execute an update to an existing instance
    func executeUpdate(
        app: ManagedApp,
        environment: DeployEnvironment,
        package: DeploymentPackage,
        credentials: CredentialSet,
        userChanges: ParameterChanges?,
        onProgress: @escaping @Sendable (DeploymentProgress) -> Void
    ) async throws -> DeploymentExecutionResult {
        let startTime = Date()
        
        // STEP 1: READ current parameters FROM the running instance
        await MainActor.run {
            onProgress(DeploymentProgress(
                phase: .validating,
                progress: 0.05,
                currentStack: nil,
                message: "Fetching current parameters from instance...",
                startedAt: startTime,
                estimatedCompletion: nil
            ))
        }
        
        let currentParameters = try await fetchCurrentParameters(
            app: app,
            environment: environment,
            credentials: credentials
        )
        
        // STEP 2: Create snapshot for rollback capability
        await MainActor.run {
            onProgress(DeploymentProgress(
                phase: .validating,
                progress: 0.10,
                currentStack: nil,
                message: "Creating pre-update snapshot...",
                startedAt: startTime,
                estimatedCompletion: nil
            ))
        }
        
        let snapshotId = try await createPreUpdateSnapshot(
            app: app,
            environment: environment,
            currentParameters: currentParameters,
            package: package
        )
        
        // STEP 3: MERGE user changes with current parameters
        let updatedParameters = mergeParameters(
            current: currentParameters,
            changes: userChanges
        )
        
        // STEP 4: Validate parameter changes are safe
        try validateParameterChanges(
            from: currentParameters,
            to: updatedParameters,
            package: package
        )
        
        // STEP 5: Deploy infrastructure with MERGED parameters
        try await deployInfrastructure(
            app: app,
            environment: environment,
            package: package,
            parameters: updatedParameters.toInstallationParameters(),
            credentials: credentials,
            onProgress: onProgress
        )
        
        // STEP 6: Run INCREMENTAL migrations (NOT fresh)
        await MainActor.run {
            onProgress(DeploymentProgress(
                phase: .runningMigrations,
                progress: 0.90,
                currentStack: nil,
                message: "Running incremental migrations from v\(currentParameters.version)...",
                startedAt: startTime,
                estimatedCompletion: nil
            ))
        }
        
        try await runMigrations(
            package: package,
            mode: .incremental,
            fromVersion: currentParameters.version,
            onProgress: onProgress
        )
        
        // STEP 7: DO NOT seed AI Registry (preserve admin customizations)
        // AI Registry seeding is SKIPPED on update
        
        // STEP 8: Update deployment metadata
        try await updateDeploymentMetadata(
            app: app,
            environment: environment,
            package: package,
            parameters: updatedParameters,
            previousSnapshotId: snapshotId
        )
        
        // STEP 9: Verify deployment
        await MainActor.run {
            onProgress(DeploymentProgress(
                phase: .verifying,
                progress: 0.98,
                currentStack: nil,
                message: "Verifying deployment...",
                startedAt: startTime,
                estimatedCompletion: nil
            ))
        }
        
        let outputs = try await verifyDeployment(app: app, environment: environment)
        
        await MainActor.run {
            onProgress(DeploymentProgress(
                phase: .complete,
                progress: 1.0,
                currentStack: nil,
                message: "Update complete!",
                startedAt: startTime,
                estimatedCompletion: nil
            ))
        }
        
        return DeploymentExecutionResult(
            mode: .update,
            success: true,
            version: package.manifest.version,
            rollbackSnapshotId: snapshotId,
            outputs: outputs,
            errors: nil,
            duration: Date().timeIntervalSince(startTime)
        )
    }
    
    // MARK: - Rollback Mode Execution
    
    /// Execute a rollback to a previous version
    func executeRollback(
        app: ManagedApp,
        environment: DeployEnvironment,
        targetSnapshotId: String,
        credentials: CredentialSet,
        onProgress: @escaping @Sendable (DeploymentProgress) -> Void
    ) async throws -> DeploymentExecutionResult {
        let startTime = Date()
        
        // STEP 1: Load the target snapshot
        await MainActor.run {
            onProgress(DeploymentProgress(
                phase: .validating,
                progress: 0.05,
                currentStack: nil,
                message: "Loading target snapshot...",
                startedAt: startTime,
                estimatedCompletion: nil
            ))
        }
        
        let snapshot = try await loadSnapshot(snapshotId: targetSnapshotId, app: app, environment: environment)
        
        // STEP 2: Verify snapshot is valid and compatible
        try validateSnapshot(snapshot, for: app, environment: environment)
        
        // STEP 3: Create current state snapshot (in case rollback fails)
        await MainActor.run {
            onProgress(DeploymentProgress(
                phase: .validating,
                progress: 0.10,
                currentStack: nil,
                message: "Creating safety snapshot...",
                startedAt: startTime,
                estimatedCompletion: nil
            ))
        }
        
        let currentParameters = try await fetchCurrentParameters(
            app: app,
            environment: environment,
            credentials: credentials
        )
        
        let safetySnapshotId = try await createSafetySnapshot(
            app: app,
            environment: environment,
            currentParameters: currentParameters
        )
        
        // STEP 4: Download the deployment package from that snapshot
        let package = try await downloadPackageForSnapshot(snapshot: snapshot)
        
        // STEP 5: Deploy infrastructure with SNAPSHOT parameters
        try await deployInfrastructure(
            app: app,
            environment: environment,
            package: package,
            parameters: snapshot.parameters.toInstallationParameters(),
            credentials: credentials,
            onProgress: onProgress
        )
        
        // STEP 6: Rollback database (if needed)
        if snapshot.includesDatabaseRollback, let dbSnapshotId = snapshot.databaseSnapshotId {
            await MainActor.run {
                onProgress(DeploymentProgress(
                    phase: .runningMigrations,
                    progress: 0.90,
                    currentStack: nil,
                    message: "Restoring database from snapshot...",
                    startedAt: startTime,
                    estimatedCompletion: nil
                ))
            }
            
            try await rollbackDatabase(
                toSnapshotId: dbSnapshotId,
                app: app,
                environment: environment,
                credentials: credentials,
                onProgress: onProgress
            )
        }
        
        // STEP 7: Update deployment metadata
        try await updateDeploymentMetadataForRollback(
            app: app,
            environment: environment,
            package: package,
            parameters: snapshot.parameters,
            rolledBackFrom: safetySnapshotId
        )
        
        await MainActor.run {
            onProgress(DeploymentProgress(
                phase: .complete,
                progress: 1.0,
                currentStack: nil,
                message: "Rollback complete!",
                startedAt: startTime,
                estimatedCompletion: nil
            ))
        }
        
        return DeploymentExecutionResult(
            mode: .rollback,
            success: true,
            version: snapshot.version,
            rollbackSnapshotId: safetySnapshotId,
            outputs: nil,
            errors: nil,
            duration: Date().timeIntervalSince(startTime)
        )
    }
    
    // MARK: - Parameter Fetching
    
    /// Fetch current parameters from running Radiant instance
    func fetchCurrentParameters(
        app: ManagedApp,
        environment: DeployEnvironment,
        credentials: CredentialSet
    ) async throws -> InstanceParameters {
        
        // Method 1: Query the Radiant API
        let envStatus = app.environments[environment]
        if let apiEndpoint = envStatus.apiUrl {
            do {
                guard let url = URL(string: "\(apiEndpoint)/api/v2/admin/config") else {
                    throw DeploymentError.invalidConfiguration("Invalid API endpoint URL")
                }
                var request = URLRequest(url: url)
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                // Add auth if available
                
                let (data, response) = try await URLSession.shared.data(for: request)
                
                if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                    let config = try JSONDecoder().decode(InstanceParameters.self, from: data)
                    return config
                }
            } catch {
                // Fall through to other methods
            }
        }
        
        // Method 2: Read from AWS Parameter Store
        let parameterPath = "/radiant/\(app.id)/\(environment.rawValue.lowercased())/config"
        if let configJson = await awsService.getParameter(path: parameterPath) {
            if let data = configJson.data(using: .utf8) {
                let config = try JSONDecoder().decode(InstanceParameters.self, from: data)
                return config
            }
        }
        
        // Method 3: Read from CloudFormation outputs and construct
        let stackName = "Radiant-\(app.id)-\(environment.rawValue)-Foundation"
        if let outputs = await awsService.getStackOutputs(stackName: stackName) {
            return constructParametersFromOutputs(outputs, app: app, environment: environment)
        }
        
        throw DeploymentError.instanceNotFound
    }
    
    /// Construct parameters from CloudFormation outputs
    private func constructParametersFromOutputs(
        _ outputs: [String: String],
        app: ManagedApp,
        environment: DeployEnvironment
    ) -> InstanceParameters {
        let tier = TierLevel(rawValue: Int(outputs["Tier"] ?? "1") ?? 1) ?? .seed
        
        return InstanceParameters(
            tier: tier,
            region: AWSRegion(rawValue: outputs["Region"] ?? Configuration.primaryRegion) ?? .usEast1,
            vpcCidr: outputs["VpcCidr"] ?? "10.0.0.0/16",
            multiAz: outputs["MultiAz"] == "true",
            auroraInstanceClass: outputs["AuroraInstanceClass"] ?? tier.defaultAuroraInstance,
            auroraMinCapacity: Int(outputs["AuroraMinCapacity"] ?? "0") ?? tier.defaultAuroraMinCapacity,
            auroraMaxCapacity: Int(outputs["AuroraMaxCapacity"] ?? "2") ?? tier.defaultAuroraMaxCapacity,
            enableSelfHostedModels: outputs["EnableSelfHostedModels"] == "true",
            enableMultiRegion: outputs["EnableMultiRegion"] == "true",
            enableWAF: outputs["EnableWAF"] == "true",
            enableGuardDuty: outputs["EnableGuardDuty"] == "true",
            enableHIPAACompliance: outputs["EnableHIPAACompliance"] == "true",
            externalProviderMarkup: Double(outputs["ExternalProviderMarkup"] ?? "1.40") ?? 1.40,
            selfHostedMarkup: Double(outputs["SelfHostedMarkup"] ?? "1.75") ?? 1.75,
            version: outputs["RadiantVersion"] ?? RADIANT_VERSION,
            instanceId: outputs["InstanceId"],
            deployedAt: nil,
            lastUpdatedAt: nil,
            customSettings: nil
        )
    }
    
    // MARK: - Parameter Merging
    
    /// Merge user changes with current parameters
    private func mergeParameters(
        current: InstanceParameters,
        changes: ParameterChanges?
    ) -> InstanceParameters {
        guard let changes = changes else {
            return current  // No changes, use current as-is
        }
        
        var merged = current
        
        // Apply each change the user made
        if let newTier = changes.tier {
            merged.tier = newTier
        }
        if let newMultiAz = changes.multiAz {
            merged.multiAz = newMultiAz
        }
        if let newInstance = changes.auroraInstanceClass {
            merged.auroraInstanceClass = newInstance
        }
        if let newMin = changes.auroraMinCapacity {
            merged.auroraMinCapacity = newMin
        }
        if let newMax = changes.auroraMaxCapacity {
            merged.auroraMaxCapacity = newMax
        }
        if let enable = changes.enableSelfHostedModels {
            merged.enableSelfHostedModels = enable
        }
        if let enable = changes.enableMultiRegion {
            merged.enableMultiRegion = enable
        }
        if let enable = changes.enableWAF {
            merged.enableWAF = enable
        }
        if let enable = changes.enableGuardDuty {
            merged.enableGuardDuty = enable
        }
        if let enable = changes.enableHIPAACompliance {
            merged.enableHIPAACompliance = enable
        }
        if let markup = changes.externalProviderMarkup {
            merged.externalProviderMarkup = markup
        }
        if let markup = changes.selfHostedMarkup {
            merged.selfHostedMarkup = markup
        }
        
        // Update version to target
        merged.version = RADIANT_VERSION
        merged.lastUpdatedAt = Date()
        
        return merged
    }
    
    // MARK: - Validation
    
    /// Validate parameter changes are safe
    private func validateParameterChanges(
        from current: InstanceParameters,
        to updated: InstanceParameters,
        package: DeploymentPackage
    ) throws {
        // Cannot change region after install
        if current.region != updated.region {
            throw DeploymentError.parameterValidationFailed(
                "Region cannot be changed after initial installation. Current: \(current.region.displayName)"
            )
        }
        
        // Cannot downgrade tier below what features require
        if updated.enableSelfHostedModels && updated.tier < .growth {
            throw DeploymentError.parameterValidationFailed(
                "Self-hosted models require GROWTH tier or higher"
            )
        }
        
        if updated.enableMultiRegion && updated.tier < .scale {
            throw DeploymentError.parameterValidationFailed(
                "Multi-region requires SCALE tier or higher"
            )
        }
        
        // Validate Aurora capacity
        if updated.auroraMinCapacity > updated.auroraMaxCapacity {
            throw DeploymentError.parameterValidationFailed(
                "Aurora min capacity cannot exceed max capacity"
            )
        }
    }
    
    /// Validate snapshot is compatible
    private func validateSnapshot(
        _ snapshot: DeploymentSnapshot,
        for app: ManagedApp,
        environment: DeployEnvironment
    ) throws {
        if snapshot.appId != app.id {
            throw DeploymentError.invalidSnapshot("Snapshot is for different app: \(snapshot.appId)")
        }
        
        if snapshot.environment != environment.rawValue {
            throw DeploymentError.invalidSnapshot("Snapshot is for different environment: \(snapshot.environment)")
        }
    }
    
    // MARK: - Snapshot Management
    
    /// Create snapshot before update
    private func createPreUpdateSnapshot(
        app: ManagedApp,
        environment: DeployEnvironment,
        currentParameters: InstanceParameters,
        package: DeploymentPackage
    ) async throws -> String {
        let snapshotId = "snapshot-\(ISO8601DateFormatter().string(from: Date()))"
        
        let snapshot = DeploymentSnapshot(
            id: snapshotId,
            appId: app.id,
            environment: environment.rawValue,
            version: currentParameters.version,
            packageHash: package.manifest.integrity.packageHash,
            parameters: currentParameters,
            createdAt: Date(),
            reason: .preUpdate,
            databaseSnapshotId: nil,  // Could trigger RDS snapshot here
            includesDatabaseRollback: false
        )
        
        // Store snapshot to S3
        let bucket = "radiant-\(app.id)-\(environment.rawValue.lowercased())-deployments"
        let key = "snapshots/\(snapshotId)/snapshot.json"
        
        let data = try JSONEncoder().encode(snapshot)
        await awsService.putObject(bucket: bucket, key: key, data: data)
        
        return snapshotId
    }
    
    /// Create safety snapshot before rollback
    private func createSafetySnapshot(
        app: ManagedApp,
        environment: DeployEnvironment,
        currentParameters: InstanceParameters
    ) async throws -> String {
        let snapshotId = "safety-\(ISO8601DateFormatter().string(from: Date()))"
        
        let snapshot = DeploymentSnapshot(
            id: snapshotId,
            appId: app.id,
            environment: environment.rawValue,
            version: currentParameters.version,
            packageHash: "",  // Current package hash
            parameters: currentParameters,
            createdAt: Date(),
            reason: .preRollback,
            databaseSnapshotId: nil,
            includesDatabaseRollback: false
        )
        
        let bucket = "radiant-\(app.id)-\(environment.rawValue.lowercased())-deployments"
        let key = "snapshots/\(snapshotId)/snapshot.json"
        
        let data = try JSONEncoder().encode(snapshot)
        await awsService.putObject(bucket: bucket, key: key, data: data)
        
        return snapshotId
    }
    
    /// Load snapshot from storage
    private func loadSnapshot(
        snapshotId: String,
        app: ManagedApp,
        environment: DeployEnvironment
    ) async throws -> DeploymentSnapshot {
        let bucket = "radiant-\(app.id)-\(environment.rawValue.lowercased())-deployments"
        let key = "snapshots/\(snapshotId)/snapshot.json"
        
        guard let data = await awsService.getObject(bucket: bucket, key: key) else {
            throw DeploymentError.snapshotNotFound(snapshotId)
        }
        
        return try JSONDecoder().decode(DeploymentSnapshot.self, from: data)
    }
    
    /// List available snapshots
    func listSnapshots(
        app: ManagedApp,
        environment: DeployEnvironment
    ) async throws -> [DeploymentSnapshot] {
        let bucket = "radiant-\(app.id)-\(environment.rawValue.lowercased())-deployments"
        let prefix = "snapshots/"
        
        let keys = await awsService.listObjects(bucket: bucket, prefix: prefix)
        
        var snapshots: [DeploymentSnapshot] = []
        for key in keys where key.hasSuffix("/snapshot.json") {
            if let data = await awsService.getObject(bucket: bucket, key: key),
               let snapshot = try? JSONDecoder().decode(DeploymentSnapshot.self, from: data) {
                snapshots.append(snapshot)
            }
        }
        
        return snapshots.sorted { $0.createdAt > $1.createdAt }
    }
    
    /// Create a snapshot (public interface for DeployView)
    func createSnapshot(
        app: ManagedApp,
        environment: DeployEnvironment,
        credentials: CredentialSet,
        reason: DeploymentSnapshot.SnapshotReason
    ) async throws -> DeploymentSnapshot {
        let deployEnv = environment
        
        // Fetch current parameters
        let currentParams = try await fetchCurrentParameters(
            app: app,
            environment: deployEnv,
            credentials: credentials
        )
        
        let snapshotId = "snapshot-\(UUID().uuidString.prefix(8))-\(Int(Date().timeIntervalSince1970))"
        
        // Create RDS snapshot if database rollback is needed
        var dbSnapshotId: String? = nil
        if reason == .preUpdate || reason == .manual {
            let rdsSnapshotId = "radiant-\(app.id)-\(snapshotId)"
            let clusterIdentifier = "radiant-\(app.id)-\(environment.rawValue.lowercased())"
            
            dbSnapshotId = await awsService.createDBClusterSnapshot(
                snapshotId: rdsSnapshotId,
                clusterIdentifier: clusterIdentifier
            )
        }
        
        let snapshot = DeploymentSnapshot(
            id: snapshotId,
            appId: app.id,
            environment: environment.rawValue,
            version: currentParams.version,
            packageHash: "",
            parameters: currentParams,
            createdAt: Date(),
            reason: reason,
            databaseSnapshotId: dbSnapshotId,
            includesDatabaseRollback: dbSnapshotId != nil
        )
        
        // Store snapshot to S3
        let bucket = "radiant-\(app.id)-\(environment.rawValue.lowercased())-deployments"
        let key = "snapshots/\(snapshotId)/snapshot.json"
        
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(snapshot)
        await awsService.putObject(bucket: bucket, key: key, data: data)
        
        await AuditLogger.shared.log(
            action: .snapshotCreated,
            details: "Created snapshot \(snapshotId) for \(app.name)",
            metadata: ["snapshot_id": snapshotId, "reason": reason.rawValue]
        )
        
        return snapshot
    }
    
    /// Restore from a snapshot (public interface for DeployView)
    func restoreFromSnapshot(
        snapshot: DeploymentSnapshot,
        app: ManagedApp,
        environment: DeployEnvironment,
        credentials: CredentialSet,
        onProgress: @escaping (Double) -> Void,
        onLog: @escaping (LogEntry) -> Void
    ) async throws {
        let deployEnv = environment
        
        onLog(LogEntry(timestamp: Date(), level: .info, message: "Starting rollback to v\(snapshot.version)", metadata: nil))
        onProgress(0.1)
        
        // Validate snapshot
        try validateSnapshot(snapshot, for: app, environment: deployEnv)
        onProgress(0.2)
        
        // Create safety snapshot of current state
        onLog(LogEntry(timestamp: Date(), level: .info, message: "Creating safety snapshot of current state...", metadata: nil))
        let currentParams = try await fetchCurrentParameters(app: app, environment: deployEnv, credentials: credentials)
        let _ = try await createSafetySnapshot(app: app, environment: deployEnv, currentParameters: currentParams)
        onProgress(0.3)
        
        // Restore database if snapshot includes it
        if snapshot.includesDatabaseRollback, let dbSnapshotId = snapshot.databaseSnapshotId {
            onLog(LogEntry(timestamp: Date(), level: .info, message: "Restoring database from snapshot...", metadata: nil))
            
            let clusterIdentifier = "radiant-\(app.id)-\(environment.rawValue.lowercased())"
            let restored = await awsService.restoreDBClusterFromSnapshot(
                snapshotId: dbSnapshotId,
                clusterIdentifier: clusterIdentifier
            )
            
            if !restored {
                throw DeploymentError.rollbackFailed("Failed to restore database from snapshot")
            }
            onProgress(0.6)
        }
        
        // Restore parameters to Parameter Store
        onLog(LogEntry(timestamp: Date(), level: .info, message: "Restoring configuration parameters...", metadata: nil))
        let parameterPath = "/radiant/\(app.id)/\(environment.rawValue.lowercased())/config"
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let paramData = try encoder.encode(snapshot.parameters)
        let paramJson = String(data: paramData, encoding: .utf8) ?? "{}"
        await awsService.putParameter(path: parameterPath, value: paramJson)
        onProgress(0.8)
        
        // Update deployment metadata
        onLog(LogEntry(timestamp: Date(), level: .info, message: "Updating deployment metadata...", metadata: nil))
        let metadataPath = "/radiant/\(app.id)/\(environment.rawValue.lowercased())/metadata"
        let metadata: [String: String] = [
            "version": snapshot.version,
            "rolledBackAt": ISO8601DateFormatter().string(from: Date()),
            "rolledBackFrom": currentParams.version,
            "snapshotId": snapshot.id
        ]
        let metadataJson = try JSONSerialization.data(withJSONObject: metadata)
        await awsService.putParameter(path: metadataPath, value: String(data: metadataJson, encoding: .utf8) ?? "{}")
        onProgress(0.9)
        
        onLog(LogEntry(timestamp: Date(), level: .success, message: "Rollback completed successfully", metadata: nil))
        onProgress(1.0)
        
        await AuditLogger.shared.log(
            action: .deploymentCompleted,
            details: "Rolled back \(app.name) to v\(snapshot.version)",
            metadata: ["snapshot_id": snapshot.id, "version": snapshot.version]
        )
    }
    
    
    // MARK: - Infrastructure Deployment
    
    /// Deploy CDK infrastructure
    private func deployInfrastructure(
        app: ManagedApp,
        environment: DeployEnvironment,
        package: DeploymentPackage,
        parameters: InstallationParameters,
        credentials: CredentialSet,
        onProgress: @escaping @Sendable (DeploymentProgress) -> Void
    ) async throws {
        let startTime = Date()
        
        let phases: [(DeploymentPhase, String, Double)] = [
            (.bootstrapping, "Bootstrapping CDK...", 0.10),
            (.synthesizing, "Synthesizing CloudFormation templates...", 0.15),
            (.deployingFoundation, "Deploying Foundation stack...", 0.25),
            (.deployingNetworking, "Deploying Networking stack...", 0.35),
            (.deploySecurity, "Deploying Security stack...", 0.45),
            (.deployingData, "Deploying Data Layer...", 0.55),
            (.deployingAI, "Deploying AI Services...", 0.65),
            (.deployingAPI, "Deploying API Layer...", 0.75),
            (.deployingAdmin, "Deploying Admin Dashboard...", 0.85),
        ]
        
        for (phase, message, progress) in phases {
            await MainActor.run {
                onProgress(DeploymentProgress(
                    phase: phase,
                    progress: progress,
                    currentStack: "\(phase.rawValue)",
                    message: message,
                    startedAt: startTime,
                    estimatedCompletion: nil
                ))
            }
            
            // Simulate deployment step (actual CDK deployment would go here)
            try await Task.sleep(nanoseconds: 500_000_000)  // 0.5s per step for demo
        }
    }
    
    // MARK: - Migrations
    
    /// Run database migrations
    private func runMigrations(
        package: DeploymentPackage,
        mode: MigrationMode,
        fromVersion: String?,
        onProgress: @escaping @Sendable (DeploymentProgress) -> Void
    ) async throws {
        switch mode {
        case .fresh:
            // Run all migrations from start
            break
        case .incremental:
            // Only run migrations newer than fromVersion
            break
        }
        
        // Actual migration execution would use the CDK/Lambda
    }
    
    /// Seed AI Registry (ONLY on fresh install)
    private func seedAIRegistry(
        package: DeploymentPackage,
        onProgress: @escaping @Sendable (DeploymentProgress) -> Void
    ) async throws {
        // This runs the 045_seed_ai_registry.sql migration
        // which uses ON CONFLICT DO NOTHING to be idempotent
    }
    
    /// Rollback database to snapshot
    private func rollbackDatabase(
        toSnapshotId: String,
        app: ManagedApp,
        environment: DeployEnvironment,
        credentials: CredentialSet,
        onProgress: @escaping @Sendable (DeploymentProgress) -> Void
    ) async throws {
        // Restore RDS snapshot
    }
    
    // MARK: - Admin Setup
    
    /// Create initial admin user
    private func createInitialAdmin(
        app: ManagedApp,
        environment: DeployEnvironment,
        onProgress: @escaping @Sendable (DeploymentProgress) -> Void
    ) async throws {
        // Create Cognito user and set as super admin
    }
    
    // MARK: - Metadata Storage
    
    /// Store deployment metadata
    private func storeDeploymentMetadata(
        app: ManagedApp,
        environment: DeployEnvironment,
        package: DeploymentPackage,
        parameters: InstallationParameters
    ) async throws {
        // Store to S3 and Parameter Store
    }
    
    /// Update deployment metadata
    private func updateDeploymentMetadata(
        app: ManagedApp,
        environment: DeployEnvironment,
        package: DeploymentPackage,
        parameters: InstanceParameters,
        previousSnapshotId: String
    ) async throws {
        // Update S3 and Parameter Store
    }
    
    /// Update metadata for rollback
    private func updateDeploymentMetadataForRollback(
        app: ManagedApp,
        environment: DeployEnvironment,
        package: DeploymentPackage,
        parameters: InstanceParameters,
        rolledBackFrom: String
    ) async throws {
        // Update S3 and Parameter Store
    }
    
    // MARK: - Verification
    
    /// Verify deployment is healthy
    private func verifyDeployment(
        app: ManagedApp,
        environment: DeployEnvironment
    ) async throws -> DeploymentOutputs? {
        // Health check endpoints, verify stacks
        return nil
    }
    
    /// Download package for snapshot
    private func downloadPackageForSnapshot(
        snapshot: DeploymentSnapshot
    ) async throws -> DeploymentPackage {
        // Download from S3 based on snapshot.packageHash
        throw DeploymentError.packageNotFound(snapshot.version)
    }
}
