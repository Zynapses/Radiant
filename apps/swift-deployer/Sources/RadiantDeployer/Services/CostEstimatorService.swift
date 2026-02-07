// RADIANT v7.2.0 - Cost Estimator Service
// Provides pre-deployment cost estimation for AWS resources
// Supports tier-based pricing, multi-region, and self-hosted model costs

import Foundation

actor CostEstimatorService {
    static let shared = CostEstimatorService()
    
    // MARK: - Types
    
    struct CostEstimate: Codable, Sendable, Identifiable {
        let id: String
        let createdAt: Date
        let parameters: EstimateParameters
        let breakdown: CostBreakdown
        let summary: CostSummary
        let recommendations: [CostRecommendation]
        let warnings: [String]
    }
    
    struct EstimateParameters: Codable, Sendable {
        let tier: String
        let region: String
        let multiRegion: Bool
        let regions: [String]
        let auroraInstanceClass: String
        let auroraMinCapacity: Int
        let auroraMaxCapacity: Int
        let enableSelfHostedModels: Bool
        let selfHostedGPUInstances: Int
        let enableWAF: Bool
        let enableGuardDuty: Bool
        let expectedMonthlyRequests: Int64
        let expectedStorageGB: Int
        let expectedDataTransferGB: Int
    }
    
    struct CostBreakdown: Codable, Sendable {
        let compute: ComputeCosts
        let database: DatabaseCosts
        let storage: StorageCosts
        let networking: NetworkingCosts
        let security: SecurityCosts
        let ai: AICosts
        let other: OtherCosts
    }
    
    struct ComputeCosts: Codable, Sendable {
        let ecsCluster: LineItem
        let lambdaFunctions: LineItem
        let ecsFargateTasks: LineItem
        let gpuInstances: LineItem?
        
        var total: Double {
            ecsCluster.monthlyCost + lambdaFunctions.monthlyCost + 
            ecsFargateTasks.monthlyCost + (gpuInstances?.monthlyCost ?? 0)
        }
    }
    
    struct DatabaseCosts: Codable, Sendable {
        let auroraPostgres: LineItem
        let dynamoDB: LineItem
        let elasticache: LineItem
        
        var total: Double {
            auroraPostgres.monthlyCost + dynamoDB.monthlyCost + elasticache.monthlyCost
        }
    }
    
    struct StorageCosts: Codable, Sendable {
        let s3Standard: LineItem
        let s3InfrequentAccess: LineItem
        let efsStorage: LineItem
        let backups: LineItem
        
        var total: Double {
            s3Standard.monthlyCost + s3InfrequentAccess.monthlyCost + 
            efsStorage.monthlyCost + backups.monthlyCost
        }
    }
    
    struct NetworkingCosts: Codable, Sendable {
        let dataTransferOut: LineItem
        let dataTransferRegion: LineItem
        let natGateway: LineItem
        let loadBalancer: LineItem
        let apiGateway: LineItem
        
        var total: Double {
            dataTransferOut.monthlyCost + dataTransferRegion.monthlyCost + 
            natGateway.monthlyCost + loadBalancer.monthlyCost + apiGateway.monthlyCost
        }
    }
    
    struct SecurityCosts: Codable, Sendable {
        let waf: LineItem?
        let guardDuty: LineItem?
        let secretsManager: LineItem
        let kms: LineItem
        let certificateManager: LineItem
        
        var total: Double {
            (waf?.monthlyCost ?? 0) + (guardDuty?.monthlyCost ?? 0) + 
            secretsManager.monthlyCost + kms.monthlyCost + certificateManager.monthlyCost
        }
    }
    
    struct AICosts: Codable, Sendable {
        let externalProviders: LineItem
        let selfHostedInference: LineItem?
        let litellmGateway: LineItem
        
        var total: Double {
            externalProviders.monthlyCost + (selfHostedInference?.monthlyCost ?? 0) + 
            litellmGateway.monthlyCost
        }
    }
    
    struct OtherCosts: Codable, Sendable {
        let cloudwatch: LineItem
        let sns: LineItem
        let ses: LineItem
        let route53: LineItem
        
        var total: Double {
            cloudwatch.monthlyCost + sns.monthlyCost + ses.monthlyCost + route53.monthlyCost
        }
    }
    
    struct LineItem: Codable, Sendable {
        let name: String
        let description: String
        let quantity: Double
        let unit: String
        let unitPrice: Double
        let monthlyCost: Double
        let notes: String?
        
        static func zero(name: String, description: String) -> LineItem {
            LineItem(name: name, description: description, quantity: 0, unit: "-", unitPrice: 0, monthlyCost: 0, notes: nil)
        }
    }
    
    struct CostSummary: Codable, Sendable {
        let monthlyTotal: Double
        let yearlyTotal: Double
        let computePercentage: Double
        let databasePercentage: Double
        let storagePercentage: Double
        let networkingPercentage: Double
        let securityPercentage: Double
        let aiPercentage: Double
        let otherPercentage: Double
        let priceRangeMin: Double
        let priceRangeMax: Double
        
        var formattedMonthly: String {
            String(format: "$%.2f", monthlyTotal)
        }
        
        var formattedYearly: String {
            String(format: "$%.2f", yearlyTotal)
        }
        
        var formattedRange: String {
            String(format: "$%.0f - $%.0f/mo", priceRangeMin, priceRangeMax)
        }
    }
    
    struct CostRecommendation: Codable, Sendable, Identifiable {
        let id: String
        let category: String
        let title: String
        let description: String
        let potentialSavings: Double
        let effort: Effort
        let impact: Impact
        
        enum Effort: String, Codable, Sendable {
            case low, medium, high
        }
        
        enum Impact: String, Codable, Sendable {
            case low, medium, high
        }
        
        var formattedSavings: String {
            String(format: "$%.2f/mo", potentialSavings)
        }
    }
    
    // MARK: - Pricing Data (US East 1, as of 2026)
    
    struct AWSPricing {
        // Aurora PostgreSQL
        static let auroraInstancePrices: [String: Double] = [
            "db.t4g.medium": 0.073,      // per hour
            "db.r6g.large": 0.260,
            "db.r6g.xlarge": 0.520,
            "db.r6g.2xlarge": 1.040,
            "db.r6g.4xlarge": 2.080
        ]
        static let auroraStoragePerGB: Double = 0.10
        static let auroraIOPerMillion: Double = 0.20
        static let auroraServerlessACU: Double = 0.12  // per ACU-hour
        
        // DynamoDB
        static let dynamoDBWriteUnit: Double = 1.25    // per million
        static let dynamoDBReadUnit: Double = 0.25     // per million
        static let dynamoDBStorageGB: Double = 0.25
        
        // ElastiCache
        static let elasticachePrices: [String: Double] = [
            "cache.t4g.micro": 0.016,
            "cache.t4g.small": 0.032,
            "cache.r6g.large": 0.182,
            "cache.r6g.xlarge": 0.364
        ]
        
        // EC2/ECS
        static let fargateVCPU: Double = 0.04048       // per vCPU-hour
        static let fargateMemoryGB: Double = 0.004445  // per GB-hour
        
        // GPU Instances (for self-hosted models)
        static let gpuInstancePrices: [String: Double] = [
            "g4dn.xlarge": 0.526,
            "g4dn.2xlarge": 0.752,
            "g5.xlarge": 1.006,
            "g5.2xlarge": 1.212,
            "p4d.24xlarge": 32.77
        ]
        
        // Lambda
        static let lambdaRequestsPerMillion: Double = 0.20
        static let lambdaGBSecond: Double = 0.0000166667
        
        // S3
        static let s3StandardGB: Double = 0.023
        static let s3IAGB: Double = 0.0125
        static let s3RequestsPer1000: Double = 0.005
        
        // Networking
        static let dataTransferOutGB: Double = 0.09
        static let dataTransferRegionGB: Double = 0.02
        static let natGatewayHour: Double = 0.045
        static let natGatewayGB: Double = 0.045
        static let albHour: Double = 0.0225
        static let albLCU: Double = 0.008
        
        // API Gateway
        static let apiGatewayRequestsPerMillion: Double = 3.50
        
        // Security
        static let wafWebACL: Double = 5.00           // per month
        static let wafRulePerMonth: Double = 1.00
        static let wafRequestsPerMillion: Double = 0.60
        static let guardDutyPerGB: Double = 1.00      // first 500GB
        static let secretsManagerSecret: Double = 0.40
        static let secretsManagerAPICall: Double = 0.05  // per 10,000
        static let kmsKeyPerMonth: Double = 1.00
        static let kmsRequestsPer10000: Double = 0.03
        
        // Other
        static let cloudwatchLogIngestionGB: Double = 0.50
        static let cloudwatchLogStorageGB: Double = 0.03
        static let snsRequestsPerMillion: Double = 0.50
        static let sesEmailPer1000: Double = 0.10
        static let route53HostedZone: Double = 0.50
        static let route53QueryPerMillion: Double = 0.40
    }
    
    // MARK: - Tier Defaults
    
    struct TierDefaults {
        let expectedRequests: Int64
        let expectedStorageGB: Int
        let expectedDataTransferGB: Int
        let lambdaInvocations: Int64
        let dynamoDBReadUnits: Int64
        let dynamoDBWriteUnits: Int64
        
        static let seed = TierDefaults(
            expectedRequests: 100_000,
            expectedStorageGB: 10,
            expectedDataTransferGB: 50,
            lambdaInvocations: 500_000,
            dynamoDBReadUnits: 1_000_000,
            dynamoDBWriteUnits: 500_000
        )
        
        static let starter = TierDefaults(
            expectedRequests: 1_000_000,
            expectedStorageGB: 50,
            expectedDataTransferGB: 200,
            lambdaInvocations: 5_000_000,
            dynamoDBReadUnits: 10_000_000,
            dynamoDBWriteUnits: 5_000_000
        )
        
        static let growth = TierDefaults(
            expectedRequests: 10_000_000,
            expectedStorageGB: 200,
            expectedDataTransferGB: 1000,
            lambdaInvocations: 50_000_000,
            dynamoDBReadUnits: 100_000_000,
            dynamoDBWriteUnits: 50_000_000
        )
        
        static let scale = TierDefaults(
            expectedRequests: 100_000_000,
            expectedStorageGB: 1000,
            expectedDataTransferGB: 5000,
            lambdaInvocations: 500_000_000,
            dynamoDBReadUnits: 1_000_000_000,
            dynamoDBWriteUnits: 500_000_000
        )
        
        static let enterprise = TierDefaults(
            expectedRequests: 1_000_000_000,
            expectedStorageGB: 5000,
            expectedDataTransferGB: 20000,
            lambdaInvocations: 5_000_000_000,
            dynamoDBReadUnits: 10_000_000_000,
            dynamoDBWriteUnits: 5_000_000_000
        )
        
        static func forTier(_ tier: String) -> TierDefaults {
            switch tier.lowercased() {
            case "seed": return .seed
            case "starter": return .starter
            case "growth": return .growth
            case "scale": return .scale
            case "enterprise": return .enterprise
            default: return .starter
            }
        }
    }
    
    // MARK: - Estimate Generation
    
    func generateEstimate(
        tier: String,
        region: String,
        multiRegion: Bool,
        regions: [String] = [],
        auroraInstanceClass: String,
        auroraMinCapacity: Int,
        auroraMaxCapacity: Int,
        enableSelfHostedModels: Bool,
        selfHostedGPUInstances: Int = 0,
        enableWAF: Bool,
        enableGuardDuty: Bool,
        expectedMonthlyRequests: Int64? = nil,
        expectedStorageGB: Int? = nil,
        expectedDataTransferGB: Int? = nil
    ) async -> CostEstimate {
        let defaults = TierDefaults.forTier(tier)
        let requests = expectedMonthlyRequests ?? defaults.expectedRequests
        let storage = expectedStorageGB ?? defaults.expectedStorageGB
        let dataTransfer = expectedDataTransferGB ?? defaults.expectedDataTransferGB
        
        let parameters = EstimateParameters(
            tier: tier,
            region: region,
            multiRegion: multiRegion,
            regions: multiRegion ? regions : [region],
            auroraInstanceClass: auroraInstanceClass,
            auroraMinCapacity: auroraMinCapacity,
            auroraMaxCapacity: auroraMaxCapacity,
            enableSelfHostedModels: enableSelfHostedModels,
            selfHostedGPUInstances: selfHostedGPUInstances,
            enableWAF: enableWAF,
            enableGuardDuty: enableGuardDuty,
            expectedMonthlyRequests: requests,
            expectedStorageGB: storage,
            expectedDataTransferGB: dataTransfer
        )
        
        let regionMultiplier = multiRegion ? Double(max(1, regions.count)) : 1.0
        
        // Calculate each category
        let compute = calculateComputeCosts(
            tier: tier,
            enableSelfHostedModels: enableSelfHostedModels,
            selfHostedGPUInstances: selfHostedGPUInstances,
            requests: requests,
            regionMultiplier: regionMultiplier
        )
        
        let database = calculateDatabaseCosts(
            auroraInstanceClass: auroraInstanceClass,
            auroraMinCapacity: auroraMinCapacity,
            storageGB: storage,
            defaults: defaults,
            regionMultiplier: regionMultiplier
        )
        
        let storageCosts = calculateStorageCosts(
            storageGB: storage,
            regionMultiplier: regionMultiplier
        )
        
        let networking = calculateNetworkingCosts(
            dataTransferGB: dataTransfer,
            requests: requests,
            regionMultiplier: regionMultiplier
        )
        
        let security = calculateSecurityCosts(
            enableWAF: enableWAF,
            enableGuardDuty: enableGuardDuty,
            requests: requests
        )
        
        let ai = calculateAICosts(
            enableSelfHostedModels: enableSelfHostedModels,
            selfHostedGPUInstances: selfHostedGPUInstances,
            requests: requests
        )
        
        let other = calculateOtherCosts(
            requests: requests
        )
        
        let breakdown = CostBreakdown(
            compute: compute,
            database: database,
            storage: storageCosts,
            networking: networking,
            security: security,
            ai: ai,
            other: other
        )
        
        let monthlyTotal = compute.total + database.total + storageCosts.total + 
                          networking.total + security.total + ai.total + other.total
        
        let summary = CostSummary(
            monthlyTotal: monthlyTotal,
            yearlyTotal: monthlyTotal * 12,
            computePercentage: (compute.total / monthlyTotal) * 100,
            databasePercentage: (database.total / monthlyTotal) * 100,
            storagePercentage: (storageCosts.total / monthlyTotal) * 100,
            networkingPercentage: (networking.total / monthlyTotal) * 100,
            securityPercentage: (security.total / monthlyTotal) * 100,
            aiPercentage: (ai.total / monthlyTotal) * 100,
            otherPercentage: (other.total / monthlyTotal) * 100,
            priceRangeMin: monthlyTotal * 0.8,
            priceRangeMax: monthlyTotal * 1.3
        )
        
        let recommendations = generateRecommendations(
            parameters: parameters,
            breakdown: breakdown,
            summary: summary
        )
        
        var warnings: [String] = []
        if monthlyTotal > 10000 {
            warnings.append("Estimated cost exceeds $10,000/month. Consider Reserved Instances or Savings Plans.")
        }
        if enableSelfHostedModels && selfHostedGPUInstances > 0 {
            warnings.append("GPU instances can be expensive. Consider Spot Instances for non-critical workloads.")
        }
        if multiRegion {
            warnings.append("Multi-region deployment increases data transfer costs significantly.")
        }
        
        return CostEstimate(
            id: UUID().uuidString,
            createdAt: Date(),
            parameters: parameters,
            breakdown: breakdown,
            summary: summary,
            recommendations: recommendations,
            warnings: warnings
        )
    }
    
    // MARK: - Category Calculations
    
    private func calculateComputeCosts(
        tier: String,
        enableSelfHostedModels: Bool,
        selfHostedGPUInstances: Int,
        requests: Int64,
        regionMultiplier: Double
    ) -> ComputeCosts {
        let hoursPerMonth = 730.0
        
        // ECS Cluster (Fargate)
        let vCPUs: Double = tier == "seed" ? 0.5 : tier == "starter" ? 1 : tier == "growth" ? 2 : tier == "scale" ? 4 : 8
        let memoryGB: Double = vCPUs * 2
        let ecsVCPUCost = vCPUs * AWSPricing.fargateVCPU * hoursPerMonth
        let ecsMemoryCost = memoryGB * AWSPricing.fargateMemoryGB * hoursPerMonth
        
        let ecsCluster = LineItem(
            name: "ECS Fargate Cluster",
            description: "\(Int(vCPUs)) vCPU, \(Int(memoryGB)) GB RAM",
            quantity: hoursPerMonth,
            unit: "hours",
            unitPrice: (AWSPricing.fargateVCPU * vCPUs) + (AWSPricing.fargateMemoryGB * memoryGB),
            monthlyCost: (ecsVCPUCost + ecsMemoryCost) * regionMultiplier,
            notes: nil
        )
        
        // Lambda Functions
        let lambdaRequests = Double(requests) / 10  // Assume 10% of requests hit Lambda
        let lambdaGBSeconds = lambdaRequests * 0.5  // 500ms avg, 1GB
        let lambdaCost = (lambdaRequests / 1_000_000 * AWSPricing.lambdaRequestsPerMillion) +
                        (lambdaGBSeconds * AWSPricing.lambdaGBSecond)
        
        let lambdaFunctions = LineItem(
            name: "Lambda Functions",
            description: "\(Int(lambdaRequests)) invocations/month",
            quantity: lambdaRequests,
            unit: "invocations",
            unitPrice: AWSPricing.lambdaRequestsPerMillion / 1_000_000,
            monthlyCost: lambdaCost * regionMultiplier,
            notes: nil
        )
        
        // Fargate Tasks (LiteLLM Gateway)
        let gatewayTasks = tier == "seed" ? 1 : tier == "starter" ? 2 : tier == "growth" ? 3 : tier == "scale" ? 5 : 10
        let gatewayVCPU = 0.5
        let gatewayMemory = 1.0
        let gatewayCost = Double(gatewayTasks) * ((gatewayVCPU * AWSPricing.fargateVCPU) + 
                          (gatewayMemory * AWSPricing.fargateMemoryGB)) * hoursPerMonth
        
        let ecsFargateTasks = LineItem(
            name: "LiteLLM Gateway Tasks",
            description: "\(gatewayTasks) tasks running",
            quantity: Double(gatewayTasks),
            unit: "tasks",
            unitPrice: gatewayCost / Double(gatewayTasks),
            monthlyCost: gatewayCost * regionMultiplier,
            notes: nil
        )
        
        // GPU Instances (optional)
        var gpuInstances: LineItem? = nil
        if enableSelfHostedModels && selfHostedGPUInstances > 0 {
            let gpuType = "g5.xlarge"
            let gpuPrice = AWSPricing.gpuInstancePrices[gpuType] ?? 1.0
            let gpuCost = Double(selfHostedGPUInstances) * gpuPrice * hoursPerMonth
            
            gpuInstances = LineItem(
                name: "GPU Instances",
                description: "\(selfHostedGPUInstances)x \(gpuType)",
                quantity: Double(selfHostedGPUInstances),
                unit: "instances",
                unitPrice: gpuPrice * hoursPerMonth,
                monthlyCost: gpuCost,
                notes: "For self-hosted AI models"
            )
        }
        
        return ComputeCosts(
            ecsCluster: ecsCluster,
            lambdaFunctions: lambdaFunctions,
            ecsFargateTasks: ecsFargateTasks,
            gpuInstances: gpuInstances
        )
    }
    
    private func calculateDatabaseCosts(
        auroraInstanceClass: String,
        auroraMinCapacity: Int,
        storageGB: Int,
        defaults: TierDefaults,
        regionMultiplier: Double
    ) -> DatabaseCosts {
        let hoursPerMonth = 730.0
        
        // Aurora PostgreSQL
        let auroraHourlyPrice = AWSPricing.auroraInstancePrices[auroraInstanceClass] ?? 0.26
        let auroraComputeCost = auroraHourlyPrice * hoursPerMonth
        let auroraStorageCost = Double(storageGB) * AWSPricing.auroraStoragePerGB
        let auroraIOCost = 10.0 * AWSPricing.auroraIOPerMillion  // Assume 10M IOs
        
        let auroraPostgres = LineItem(
            name: "Aurora PostgreSQL",
            description: "\(auroraInstanceClass), \(storageGB) GB storage",
            quantity: hoursPerMonth,
            unit: "hours",
            unitPrice: auroraHourlyPrice,
            monthlyCost: (auroraComputeCost + auroraStorageCost + auroraIOCost) * regionMultiplier,
            notes: "Includes compute, storage, and I/O"
        )
        
        // DynamoDB
        let readCost = Double(defaults.dynamoDBReadUnits) / 1_000_000 * AWSPricing.dynamoDBReadUnit
        let writeCost = Double(defaults.dynamoDBWriteUnits) / 1_000_000 * AWSPricing.dynamoDBWriteUnit
        let dynamoStorageCost = Double(storageGB / 10) * AWSPricing.dynamoDBStorageGB  // 10% of total
        
        let dynamoDB = LineItem(
            name: "DynamoDB",
            description: "On-demand capacity",
            quantity: Double(defaults.dynamoDBReadUnits + defaults.dynamoDBWriteUnits),
            unit: "operations",
            unitPrice: 0.0000001,
            monthlyCost: (readCost + writeCost + dynamoStorageCost) * regionMultiplier,
            notes: nil
        )
        
        // ElastiCache
        let cacheInstanceClass = auroraInstanceClass.contains("t4g") ? "cache.t4g.small" : "cache.r6g.large"
        let cacheHourlyPrice = AWSPricing.elasticachePrices[cacheInstanceClass] ?? 0.032
        let cacheCost = cacheHourlyPrice * hoursPerMonth
        
        let elasticache = LineItem(
            name: "ElastiCache Redis",
            description: cacheInstanceClass,
            quantity: hoursPerMonth,
            unit: "hours",
            unitPrice: cacheHourlyPrice,
            monthlyCost: cacheCost * regionMultiplier,
            notes: nil
        )
        
        return DatabaseCosts(
            auroraPostgres: auroraPostgres,
            dynamoDB: dynamoDB,
            elasticache: elasticache
        )
    }
    
    private func calculateStorageCosts(
        storageGB: Int,
        regionMultiplier: Double
    ) -> StorageCosts {
        let standardGB = Double(storageGB) * 0.7  // 70% standard
        let iaGB = Double(storageGB) * 0.3         // 30% infrequent access
        
        let s3Standard = LineItem(
            name: "S3 Standard",
            description: "\(Int(standardGB)) GB",
            quantity: standardGB,
            unit: "GB",
            unitPrice: AWSPricing.s3StandardGB,
            monthlyCost: standardGB * AWSPricing.s3StandardGB * regionMultiplier,
            notes: nil
        )
        
        let s3IA = LineItem(
            name: "S3 Infrequent Access",
            description: "\(Int(iaGB)) GB",
            quantity: iaGB,
            unit: "GB",
            unitPrice: AWSPricing.s3IAGB,
            monthlyCost: iaGB * AWSPricing.s3IAGB * regionMultiplier,
            notes: nil
        )
        
        let efsGB = Double(storageGB) * 0.1  // 10% for EFS
        let efsStorage = LineItem(
            name: "EFS Storage",
            description: "\(Int(efsGB)) GB",
            quantity: efsGB,
            unit: "GB",
            unitPrice: 0.30,
            monthlyCost: efsGB * 0.30,
            notes: nil
        )
        
        let backupGB = Double(storageGB) * 0.5  // Backup 50%
        let backups = LineItem(
            name: "Backup Storage",
            description: "\(Int(backupGB)) GB",
            quantity: backupGB,
            unit: "GB",
            unitPrice: 0.05,
            monthlyCost: backupGB * 0.05 * regionMultiplier,
            notes: "Aurora and S3 backups"
        )
        
        return StorageCosts(
            s3Standard: s3Standard,
            s3InfrequentAccess: s3IA,
            efsStorage: efsStorage,
            backups: backups
        )
    }
    
    private func calculateNetworkingCosts(
        dataTransferGB: Int,
        requests: Int64,
        regionMultiplier: Double
    ) -> NetworkingCosts {
        let hoursPerMonth = 730.0
        let transferOut = Double(dataTransferGB) * 0.6  // 60% outbound
        let transferRegion = Double(dataTransferGB) * 0.4  // 40% inter-region
        
        let dataTransferOut = LineItem(
            name: "Data Transfer Out",
            description: "\(Int(transferOut)) GB to internet",
            quantity: transferOut,
            unit: "GB",
            unitPrice: AWSPricing.dataTransferOutGB,
            monthlyCost: transferOut * AWSPricing.dataTransferOutGB,
            notes: nil
        )
        
        let dataTransferRegion = LineItem(
            name: "Inter-Region Transfer",
            description: "\(Int(transferRegion)) GB between regions",
            quantity: transferRegion,
            unit: "GB",
            unitPrice: AWSPricing.dataTransferRegionGB,
            monthlyCost: transferRegion * AWSPricing.dataTransferRegionGB * (regionMultiplier - 1),
            notes: regionMultiplier > 1 ? "Multi-region" : "N/A"
        )
        
        let natGateway = LineItem(
            name: "NAT Gateway",
            description: "1 per AZ",
            quantity: hoursPerMonth * 2,
            unit: "hours",
            unitPrice: AWSPricing.natGatewayHour,
            monthlyCost: (AWSPricing.natGatewayHour * hoursPerMonth * 2) + 
                        (Double(dataTransferGB) * 0.3 * AWSPricing.natGatewayGB),
            notes: "Includes data processing"
        )
        
        let loadBalancer = LineItem(
            name: "Application Load Balancer",
            description: "1 ALB",
            quantity: hoursPerMonth,
            unit: "hours",
            unitPrice: AWSPricing.albHour,
            monthlyCost: (AWSPricing.albHour * hoursPerMonth) * regionMultiplier,
            notes: nil
        )
        
        let apiGateway = LineItem(
            name: "API Gateway",
            description: "\(requests / 1_000_000)M requests",
            quantity: Double(requests),
            unit: "requests",
            unitPrice: AWSPricing.apiGatewayRequestsPerMillion / 1_000_000,
            monthlyCost: Double(requests) / 1_000_000 * AWSPricing.apiGatewayRequestsPerMillion,
            notes: nil
        )
        
        return NetworkingCosts(
            dataTransferOut: dataTransferOut,
            dataTransferRegion: dataTransferRegion,
            natGateway: natGateway,
            loadBalancer: loadBalancer,
            apiGateway: apiGateway
        )
    }
    
    private func calculateSecurityCosts(
        enableWAF: Bool,
        enableGuardDuty: Bool,
        requests: Int64
    ) -> SecurityCosts {
        var waf: LineItem? = nil
        if enableWAF {
            let wafRules = 10
            let wafCost = AWSPricing.wafWebACL + (Double(wafRules) * AWSPricing.wafRulePerMonth) +
                         (Double(requests) / 1_000_000 * AWSPricing.wafRequestsPerMillion)
            waf = LineItem(
                name: "AWS WAF",
                description: "Web ACL + \(wafRules) rules",
                quantity: Double(wafRules),
                unit: "rules",
                unitPrice: AWSPricing.wafRulePerMonth,
                monthlyCost: wafCost,
                notes: nil
            )
        }
        
        var guardDuty: LineItem? = nil
        if enableGuardDuty {
            let analyzedGB = 100.0  // Assume 100GB/month
            guardDuty = LineItem(
                name: "GuardDuty",
                description: "\(Int(analyzedGB)) GB analyzed",
                quantity: analyzedGB,
                unit: "GB",
                unitPrice: AWSPricing.guardDutyPerGB,
                monthlyCost: analyzedGB * AWSPricing.guardDutyPerGB,
                notes: nil
            )
        }
        
        let secretsCount = 20
        let secretsManager = LineItem(
            name: "Secrets Manager",
            description: "\(secretsCount) secrets",
            quantity: Double(secretsCount),
            unit: "secrets",
            unitPrice: AWSPricing.secretsManagerSecret,
            monthlyCost: Double(secretsCount) * AWSPricing.secretsManagerSecret,
            notes: nil
        )
        
        let kmsKeys = 5
        let kms = LineItem(
            name: "KMS",
            description: "\(kmsKeys) keys",
            quantity: Double(kmsKeys),
            unit: "keys",
            unitPrice: AWSPricing.kmsKeyPerMonth,
            monthlyCost: Double(kmsKeys) * AWSPricing.kmsKeyPerMonth,
            notes: nil
        )
        
        let certificateManager = LineItem(
            name: "Certificate Manager",
            description: "Public certificates",
            quantity: 5,
            unit: "certs",
            unitPrice: 0,
            monthlyCost: 0,
            notes: "Free for ACM-issued public certs"
        )
        
        return SecurityCosts(
            waf: waf,
            guardDuty: guardDuty,
            secretsManager: secretsManager,
            kms: kms,
            certificateManager: certificateManager
        )
    }
    
    private func calculateAICosts(
        enableSelfHostedModels: Bool,
        selfHostedGPUInstances: Int,
        requests: Int64
    ) -> AICosts {
        // External provider costs (estimated based on typical usage)
        let aiRequests = Double(requests) * 0.1  // 10% of requests use AI
        let avgTokensPerRequest = 2000.0
        let avgCostPer1000Tokens = 0.003  // Blended average
        let externalCost = (aiRequests * avgTokensPerRequest / 1000) * avgCostPer1000Tokens
        
        let externalProviders = LineItem(
            name: "External AI Providers",
            description: "OpenAI, Anthropic, etc.",
            quantity: aiRequests,
            unit: "requests",
            unitPrice: avgCostPer1000Tokens * avgTokensPerRequest / 1000,
            monthlyCost: externalCost,
            notes: "Estimate based on 40% markup pass-through"
        )
        
        var selfHostedInference: LineItem? = nil
        if enableSelfHostedModels && selfHostedGPUInstances > 0 {
            // Cost already captured in compute, but show inference estimate here
            let inferenceRequests = aiRequests * 0.3  // 30% go to self-hosted
            selfHostedInference = LineItem(
                name: "Self-Hosted Inference",
                description: "\(Int(inferenceRequests)) requests",
                quantity: inferenceRequests,
                unit: "requests",
                unitPrice: 0,
                monthlyCost: 0,
                notes: "GPU costs in Compute section"
            )
        }
        
        let litellmGateway = LineItem(
            name: "LiteLLM Gateway",
            description: "Request routing overhead",
            quantity: aiRequests,
            unit: "requests",
            unitPrice: 0.00001,
            monthlyCost: aiRequests * 0.00001,
            notes: "Minimal overhead per request"
        )
        
        return AICosts(
            externalProviders: externalProviders,
            selfHostedInference: selfHostedInference,
            litellmGateway: litellmGateway
        )
    }
    
    private func calculateOtherCosts(
        requests: Int64
    ) -> OtherCosts {
        let logGB = Double(requests) / 1_000_000 * 0.5  // 0.5 GB per million requests
        let cloudwatch = LineItem(
            name: "CloudWatch",
            description: "\(Int(logGB)) GB logs",
            quantity: logGB,
            unit: "GB",
            unitPrice: AWSPricing.cloudwatchLogIngestionGB,
            monthlyCost: logGB * (AWSPricing.cloudwatchLogIngestionGB + AWSPricing.cloudwatchLogStorageGB),
            notes: nil
        )
        
        let snsMessages = Double(requests) * 0.01  // 1% trigger SNS
        let sns = LineItem(
            name: "SNS",
            description: "\(Int(snsMessages)) messages",
            quantity: snsMessages,
            unit: "messages",
            unitPrice: AWSPricing.snsRequestsPerMillion / 1_000_000,
            monthlyCost: snsMessages / 1_000_000 * AWSPricing.snsRequestsPerMillion,
            notes: nil
        )
        
        let emails = 10000.0  // Assume 10K emails/month
        let ses = LineItem(
            name: "SES",
            description: "\(Int(emails)) emails",
            quantity: emails,
            unit: "emails",
            unitPrice: AWSPricing.sesEmailPer1000 / 1000,
            monthlyCost: emails / 1000 * AWSPricing.sesEmailPer1000,
            notes: nil
        )
        
        let hostedZones = 2
        let dnsQueries = Double(requests) / 10  // 10% hit DNS
        let route53 = LineItem(
            name: "Route 53",
            description: "\(hostedZones) hosted zones",
            quantity: Double(hostedZones),
            unit: "zones",
            unitPrice: AWSPricing.route53HostedZone,
            monthlyCost: Double(hostedZones) * AWSPricing.route53HostedZone + 
                        (dnsQueries / 1_000_000 * AWSPricing.route53QueryPerMillion),
            notes: nil
        )
        
        return OtherCosts(
            cloudwatch: cloudwatch,
            sns: sns,
            ses: ses,
            route53: route53
        )
    }
    
    // MARK: - Recommendations
    
    private func generateRecommendations(
        parameters: EstimateParameters,
        breakdown: CostBreakdown,
        summary: CostSummary
    ) -> [CostRecommendation] {
        var recommendations: [CostRecommendation] = []
        
        // Reserved Instances recommendation
        if summary.monthlyTotal > 500 {
            recommendations.append(CostRecommendation(
                id: UUID().uuidString,
                category: "Compute",
                title: "Consider Reserved Instances",
                description: "For predictable workloads, Reserved Instances can save up to 72% compared to On-Demand pricing.",
                potentialSavings: summary.monthlyTotal * 0.3,
                effort: .medium,
                impact: .high
            ))
        }
        
        // Savings Plans
        if breakdown.compute.total > 200 {
            recommendations.append(CostRecommendation(
                id: UUID().uuidString,
                category: "Compute",
                title: "AWS Savings Plans",
                description: "Commit to consistent compute usage for 1-3 years to save up to 66%.",
                potentialSavings: breakdown.compute.total * 0.4,
                effort: .low,
                impact: .high
            ))
        }
        
        // Aurora Serverless
        if parameters.tier == "seed" || parameters.tier == "starter" {
            recommendations.append(CostRecommendation(
                id: UUID().uuidString,
                category: "Database",
                title: "Consider Aurora Serverless v2",
                description: "For variable workloads, Aurora Serverless scales automatically and can reduce costs during low-traffic periods.",
                potentialSavings: breakdown.database.auroraPostgres.monthlyCost * 0.3,
                effort: .medium,
                impact: .medium
            ))
        }
        
        // S3 Intelligent Tiering
        if breakdown.storage.total > 50 {
            recommendations.append(CostRecommendation(
                id: UUID().uuidString,
                category: "Storage",
                title: "Enable S3 Intelligent-Tiering",
                description: "Automatically moves data to the most cost-effective tier based on access patterns.",
                potentialSavings: breakdown.storage.s3Standard.monthlyCost * 0.2,
                effort: .low,
                impact: .medium
            ))
        }
        
        // Spot Instances for GPU
        if parameters.enableSelfHostedModels && parameters.selfHostedGPUInstances > 0 {
            recommendations.append(CostRecommendation(
                id: UUID().uuidString,
                category: "AI",
                title: "Use Spot Instances for GPU Workloads",
                description: "Spot Instances can save up to 90% on GPU costs for fault-tolerant inference workloads.",
                potentialSavings: (breakdown.compute.gpuInstances?.monthlyCost ?? 0) * 0.7,
                effort: .high,
                impact: .high
            ))
        }
        
        // NAT Gateway optimization
        if breakdown.networking.natGateway.monthlyCost > 100 {
            recommendations.append(CostRecommendation(
                id: UUID().uuidString,
                category: "Networking",
                title: "Optimize NAT Gateway Usage",
                description: "Use VPC endpoints for AWS services to reduce NAT Gateway data processing costs.",
                potentialSavings: breakdown.networking.natGateway.monthlyCost * 0.3,
                effort: .medium,
                impact: .medium
            ))
        }
        
        return recommendations
    }
}
