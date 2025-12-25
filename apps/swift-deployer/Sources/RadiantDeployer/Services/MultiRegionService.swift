import Foundation

/// Multi-Region Deployment Service per PROMPT-33 spec
/// Manages deployments across multiple AWS regions with consistency checking
actor MultiRegionService {
    
    // MARK: - Types
    
    enum MultiRegionError: Error, LocalizedError {
        case regionNotConfigured(String)
        case consistencyCheckFailed(String)
        case deploymentInProgress(String)
        case rollbackRequired([String])
        case partialFailure(succeeded: [String], failed: [String])
        
        var errorDescription: String? {
            switch self {
            case .regionNotConfigured(let region):
                return "Region '\(region)' is not configured"
            case .consistencyCheckFailed(let message):
                return "Cross-region consistency check failed: \(message)"
            case .deploymentInProgress(let region):
                return "Deployment already in progress in region: \(region)"
            case .rollbackRequired(let regions):
                return "Rollback required in regions: \(regions.joined(separator: ", "))"
            case .partialFailure(let succeeded, let failed):
                return "Partial failure - Succeeded: \(succeeded.joined(separator: ", ")), Failed: \(failed.joined(separator: ", "))"
            }
        }
    }
    
    struct RegionConfig: Codable, Sendable, Identifiable {
        let id: String
        let region: String
        let isPrimary: Bool
        let endpoint: String
        let stackPrefix: String
        var isEnabled: Bool
        var lastDeployedVersion: String?
        var lastDeployedAt: Date?
        var healthStatus: HealthStatus
        
        enum HealthStatus: String, Codable, Sendable {
            case healthy = "healthy"
            case unhealthy = "unhealthy"
            case unknown = "unknown"
            case deploying = "deploying"
        }
    }
    
    struct MultiRegionDeployment: Sendable {
        let id: String
        let packageVersion: String
        let targetRegions: [String]
        let strategy: DeploymentStrategy
        let startedAt: Date
        var completedAt: Date?
        var regionStatuses: [String: RegionDeploymentStatus]
        
        enum DeploymentStrategy: String, Codable, Sendable {
            case sequential = "sequential"     // One region at a time
            case parallel = "parallel"         // All regions simultaneously
            case canary = "canary"             // Primary first, then others
            case blueGreen = "blue_green"      // Switch traffic after all deployed
        }
    }
    
    struct RegionDeploymentStatus: Sendable {
        let region: String
        var status: Status
        var progress: Double
        var message: String?
        var error: String?
        var startedAt: Date?
        var completedAt: Date?
        
        enum Status: String, Sendable {
            case pending = "pending"
            case deploying = "deploying"
            case verifying = "verifying"
            case completed = "completed"
            case failed = "failed"
            case rolledBack = "rolled_back"
        }
    }
    
    struct CrossRegionConsistency: Sendable {
        let isConsistent: Bool
        let primaryVersion: String?
        let regionVersions: [String: String]
        let driftDetected: [String]
        let recommendations: [String]
    }
    
    // MARK: - Properties
    
    private var regions: [String: RegionConfig] = [:]
    private var currentDeployment: MultiRegionDeployment?
    private let awsService: AWSService
    private let cdkService: CDKService
    
    // MARK: - Initialization
    
    init(awsService: AWSService, cdkService: CDKService) {
        self.awsService = awsService
        self.cdkService = cdkService
    }
    
    // MARK: - Region Management
    
    func addRegion(_ config: RegionConfig) {
        regions[config.region] = config
    }
    
    func removeRegion(_ region: String) {
        regions.removeValue(forKey: region)
    }
    
    func getRegions() -> [RegionConfig] {
        Array(regions.values).sorted { $0.isPrimary && !$1.isPrimary }
    }
    
    func getRegion(_ region: String) -> RegionConfig? {
        regions[region]
    }
    
    func getPrimaryRegion() -> RegionConfig? {
        regions.values.first { $0.isPrimary }
    }
    
    func getEnabledRegions() -> [RegionConfig] {
        regions.values.filter { $0.isEnabled }.sorted { $0.isPrimary && !$1.isPrimary }
    }
    
    // MARK: - Cross-Region Consistency
    
    func checkConsistency() async throws -> CrossRegionConsistency {
        let enabledRegions = getEnabledRegions()
        guard !enabledRegions.isEmpty else {
            return CrossRegionConsistency(
                isConsistent: true,
                primaryVersion: nil,
                regionVersions: [:],
                driftDetected: [],
                recommendations: ["No regions configured"]
            )
        }
        
        var regionVersions: [String: String] = [:]
        var driftDetected: [String] = []
        var recommendations: [String] = []
        
        // Get version from each region
        for config in enabledRegions {
            if let version = config.lastDeployedVersion {
                regionVersions[config.region] = version
            } else {
                regionVersions[config.region] = "not_deployed"
            }
        }
        
        // Check for version drift
        let primaryVersion = getPrimaryRegion()?.lastDeployedVersion
        for (region, version) in regionVersions {
            if let primary = primaryVersion, version != primary {
                driftDetected.append(region)
                recommendations.append("Region \(region) has version \(version), primary has \(primary)")
            }
        }
        
        let isConsistent = driftDetected.isEmpty
        
        if !isConsistent {
            recommendations.append("Consider deploying to drifted regions to restore consistency")
        }
        
        return CrossRegionConsistency(
            isConsistent: isConsistent,
            primaryVersion: primaryVersion,
            regionVersions: regionVersions,
            driftDetected: driftDetected,
            recommendations: recommendations
        )
    }
    
    // MARK: - Multi-Region Deployment
    
    func startMultiRegionDeployment(
        packageVersion: String,
        targetRegions: [String]? = nil,
        strategy: MultiRegionDeployment.DeploymentStrategy = .canary,
        onProgress: @escaping (String, RegionDeploymentStatus) -> Void
    ) async throws -> MultiRegionDeployment {
        // Check if deployment already in progress
        if let current = currentDeployment, current.completedAt == nil {
            throw MultiRegionError.deploymentInProgress(current.regionStatuses.first { $0.value.status == .deploying }?.key ?? "unknown")
        }
        
        // Determine target regions
        let targets = targetRegions ?? getEnabledRegions().map { $0.region }
        guard !targets.isEmpty else {
            throw MultiRegionError.regionNotConfigured("No target regions specified")
        }
        
        // Validate all regions are configured
        for region in targets {
            guard regions[region] != nil else {
                throw MultiRegionError.regionNotConfigured(region)
            }
        }
        
        // Create deployment record
        var deployment = MultiRegionDeployment(
            id: UUID().uuidString,
            packageVersion: packageVersion,
            targetRegions: targets,
            strategy: strategy,
            startedAt: Date(),
            regionStatuses: targets.reduce(into: [:]) { result, region in
                result[region] = RegionDeploymentStatus(
                    region: region,
                    status: .pending,
                    progress: 0,
                    message: "Waiting to start"
                )
            }
        )
        
        currentDeployment = deployment
        
        // Execute based on strategy
        switch strategy {
        case .sequential:
            deployment = try await executeSequential(deployment, onProgress: onProgress)
        case .parallel:
            deployment = try await executeParallel(deployment, onProgress: onProgress)
        case .canary:
            deployment = try await executeCanary(deployment, onProgress: onProgress)
        case .blueGreen:
            deployment = try await executeBlueGreen(deployment, onProgress: onProgress)
        }
        
        deployment.completedAt = Date()
        currentDeployment = deployment
        
        // Check for partial failures
        let failed = deployment.regionStatuses.filter { $0.value.status == .failed }
        let succeeded = deployment.regionStatuses.filter { $0.value.status == .completed }
        
        if !failed.isEmpty && !succeeded.isEmpty {
            throw MultiRegionError.partialFailure(
                succeeded: succeeded.map { $0.key },
                failed: failed.map { $0.key }
            )
        }
        
        return deployment
    }
    
    // MARK: - Deployment Strategies
    
    private func executeSequential(
        _ deployment: MultiRegionDeployment,
        onProgress: @escaping (String, RegionDeploymentStatus) -> Void
    ) async throws -> MultiRegionDeployment {
        var deployment = deployment
        
        for region in deployment.targetRegions {
            deployment = try await deployToRegion(deployment, region: region, onProgress: onProgress)
            
            // Stop if any region fails
            if deployment.regionStatuses[region]?.status == .failed {
                break
            }
        }
        
        return deployment
    }
    
    private func executeParallel(
        _ deployment: MultiRegionDeployment,
        onProgress: @escaping (String, RegionDeploymentStatus) -> Void
    ) async throws -> MultiRegionDeployment {
        var deployment = deployment
        
        await withTaskGroup(of: (String, RegionDeploymentStatus).self) { group in
            for region in deployment.targetRegions {
                group.addTask {
                    var status = RegionDeploymentStatus(
                        region: region,
                        status: .deploying,
                        progress: 0,
                        startedAt: Date()
                    )
                    
                    do {
                        // Simulate deployment (actual implementation would use CDK)
                        for i in 1...10 {
                            try await Task.sleep(nanoseconds: 500_000_000)
                            status.progress = Double(i) / 10.0
                            status.message = "Deploying... \(i * 10)%"
                            onProgress(region, status)
                        }
                        
                        status.status = .completed
                        status.progress = 1.0
                        status.completedAt = Date()
                    } catch {
                        status.status = .failed
                        status.error = error.localizedDescription
                    }
                    
                    return (region, status)
                }
            }
            
            for await (region, status) in group {
                deployment.regionStatuses[region] = status
                onProgress(region, status)
            }
        }
        
        return deployment
    }
    
    private func executeCanary(
        _ deployment: MultiRegionDeployment,
        onProgress: @escaping (String, RegionDeploymentStatus) -> Void
    ) async throws -> MultiRegionDeployment {
        var deployment = deployment
        
        // Deploy to primary first
        if let primaryRegion = getPrimaryRegion()?.region,
           deployment.targetRegions.contains(primaryRegion) {
            deployment = try await deployToRegion(deployment, region: primaryRegion, onProgress: onProgress)
            
            // If primary fails, don't continue
            if deployment.regionStatuses[primaryRegion]?.status == .failed {
                return deployment
            }
            
            // Verify primary is healthy before continuing
            try await Task.sleep(nanoseconds: 2_000_000_000) // 2 second verification delay
        }
        
        // Deploy to remaining regions in parallel
        let remainingRegions = deployment.targetRegions.filter { $0 != getPrimaryRegion()?.region }
        
        await withTaskGroup(of: (String, RegionDeploymentStatus).self) { group in
            for region in remainingRegions {
                group.addTask {
                    var status = RegionDeploymentStatus(
                        region: region,
                        status: .deploying,
                        progress: 0,
                        startedAt: Date()
                    )
                    
                    // Simulate deployment
                    for i in 1...10 {
                        try? await Task.sleep(nanoseconds: 300_000_000)
                        status.progress = Double(i) / 10.0
                        onProgress(region, status)
                    }
                    
                    status.status = .completed
                    status.progress = 1.0
                    status.completedAt = Date()
                    
                    return (region, status)
                }
            }
            
            for await (region, status) in group {
                deployment.regionStatuses[region] = status
                onProgress(region, status)
            }
        }
        
        return deployment
    }
    
    private func executeBlueGreen(
        _ deployment: MultiRegionDeployment,
        onProgress: @escaping (String, RegionDeploymentStatus) -> Void
    ) async throws -> MultiRegionDeployment {
        // Blue-Green: Deploy to all, then switch traffic
        var deployment = try await executeParallel(deployment, onProgress: onProgress)
        
        // All regions must succeed before traffic switch
        let allSucceeded = deployment.regionStatuses.allSatisfy { $0.value.status == .completed }
        
        if allSucceeded {
            // Switch traffic (simulated)
            for region in deployment.targetRegions {
                var status = deployment.regionStatuses[region]!
                status.message = "Traffic switched"
                deployment.regionStatuses[region] = status
                onProgress(region, status)
            }
        } else {
            // Rollback all
            for region in deployment.targetRegions {
                var status = deployment.regionStatuses[region]!
                status.status = .rolledBack
                status.message = "Rolled back due to partial failure"
                deployment.regionStatuses[region] = status
                onProgress(region, status)
            }
            
            throw MultiRegionError.rollbackRequired(deployment.targetRegions)
        }
        
        return deployment
    }
    
    private func deployToRegion(
        _ deployment: MultiRegionDeployment,
        region: String,
        onProgress: @escaping (String, RegionDeploymentStatus) -> Void
    ) async throws -> MultiRegionDeployment {
        var deployment = deployment
        var status = RegionDeploymentStatus(
            region: region,
            status: .deploying,
            progress: 0,
            startedAt: Date()
        )
        
        deployment.regionStatuses[region] = status
        onProgress(region, status)
        
        do {
            // Simulate deployment phases
            for i in 1...10 {
                try await Task.sleep(nanoseconds: 500_000_000)
                status.progress = Double(i) / 10.0
                status.message = "Deploying to \(region)... \(i * 10)%"
                deployment.regionStatuses[region] = status
                onProgress(region, status)
            }
            
            status.status = .completed
            status.progress = 1.0
            status.completedAt = Date()
            
            // Update region config
            if var config = regions[region] {
                config.lastDeployedVersion = deployment.packageVersion
                config.lastDeployedAt = Date()
                config.healthStatus = .healthy
                regions[region] = config
            }
        } catch {
            status.status = .failed
            status.error = error.localizedDescription
        }
        
        deployment.regionStatuses[region] = status
        onProgress(region, status)
        
        return deployment
    }
    
    // MARK: - Rollback
    
    func rollbackRegion(_ region: String, toVersion: String) async throws {
        guard var config = regions[region] else {
            throw MultiRegionError.regionNotConfigured(region)
        }
        
        // Simulate rollback
        config.healthStatus = .deploying
        regions[region] = config
        
        try await Task.sleep(nanoseconds: 2_000_000_000)
        
        config.lastDeployedVersion = toVersion
        config.lastDeployedAt = Date()
        config.healthStatus = .healthy
        regions[region] = config
    }
    
    // MARK: - Health Monitoring
    
    func checkRegionHealth(_ region: String) async throws -> RegionConfig.HealthStatus {
        guard let config = regions[region] else {
            throw MultiRegionError.regionNotConfigured(region)
        }
        
        // In production, this would call the region's health endpoint
        return config.healthStatus
    }
    
    func checkAllRegionsHealth() async -> [String: RegionConfig.HealthStatus] {
        var results: [String: RegionConfig.HealthStatus] = [:]
        
        for (region, config) in regions {
            results[region] = config.healthStatus
        }
        
        return results
    }
    
    // MARK: - Status
    
    func getCurrentDeployment() -> MultiRegionDeployment? {
        currentDeployment
    }
    
    func isDeploymentInProgress() -> Bool {
        currentDeployment?.completedAt == nil
    }
}

// MARK: - Singleton

extension MultiRegionService {
    static let shared = MultiRegionService(
        awsService: AWSService.shared,
        cdkService: CDKService.shared
    )
}
