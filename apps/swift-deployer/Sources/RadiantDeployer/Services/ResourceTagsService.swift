// RADIANT v7.2.0 - Resource Tags Service
// AWS resource tagging management for cost allocation and organization

import Foundation

actor ResourceTagsService {
    static let shared = ResourceTagsService()
    
    enum TagsError: LocalizedError {
        case awsError(String)
        case resourceNotFound
        case invalidTag
        
        var errorDescription: String? {
            switch self {
            case .awsError(let msg): return "AWS Error: \(msg)"
            case .resourceNotFound: return "Resource not found"
            case .invalidTag: return "Invalid tag key or value"
            }
        }
    }
    
    enum ResourceType: String, CaseIterable, Sendable {
        case lambda = "lambda:function"
        case ecs = "ecs:cluster"
        case ecsService = "ecs:service"
        case rds = "rds:cluster"
        case s3 = "s3:bucket"
        case dynamodb = "dynamodb:table"
        case apiGateway = "apigateway:restapi"
        case cloudfront = "cloudfront:distribution"
        case elasticache = "elasticache:cluster"
        case secretsManager = "secretsmanager:secret"
        
        var displayName: String {
            switch self {
            case .lambda: return "Lambda Functions"
            case .ecs: return "ECS Clusters"
            case .ecsService: return "ECS Services"
            case .rds: return "RDS Clusters"
            case .s3: return "S3 Buckets"
            case .dynamodb: return "DynamoDB Tables"
            case .apiGateway: return "API Gateway"
            case .cloudfront: return "CloudFront"
            case .elasticache: return "ElastiCache"
            case .secretsManager: return "Secrets Manager"
            }
        }
        
        var icon: String {
            switch self {
            case .lambda: return "function"
            case .ecs, .ecsService: return "server.rack"
            case .rds: return "cylinder"
            case .s3: return "externaldrive"
            case .dynamodb: return "tablecells"
            case .apiGateway: return "arrow.left.arrow.right"
            case .cloudfront: return "globe"
            case .elasticache: return "memorychip"
            case .secretsManager: return "key"
            }
        }
    }
    
    struct TaggedResource: Identifiable, Sendable {
        let id: String
        let arn: String
        let name: String
        let resourceType: ResourceType
        var tags: [String: String]
        let region: String
    }
    
    struct TagPolicy: Identifiable, Sendable {
        let id = UUID()
        let key: String
        let required: Bool
        let allowedValues: [String]?
        let description: String
    }
    
    struct TagComplianceResult: Sendable {
        let resource: TaggedResource
        let missingTags: [String]
        let invalidTags: [String: String]
        let isCompliant: Bool
    }
    
    struct BulkTagOperation: Sendable {
        let resources: [TaggedResource]
        let tagsToAdd: [String: String]
        let tagsToRemove: [String]
    }
    
    static let standardTags: [TagPolicy] = [
        TagPolicy(key: "Environment", required: true, allowedValues: ["dev", "staging", "prod"], description: "Deployment environment"),
        TagPolicy(key: "Project", required: true, allowedValues: ["radiant"], description: "Project identifier"),
        TagPolicy(key: "Owner", required: true, allowedValues: nil, description: "Team or person responsible"),
        TagPolicy(key: "CostCenter", required: true, allowedValues: nil, description: "Cost allocation code"),
        TagPolicy(key: "ManagedBy", required: false, allowedValues: ["cdk", "terraform", "manual"], description: "Infrastructure management tool"),
        TagPolicy(key: "Version", required: false, allowedValues: nil, description: "Application version"),
    ]
    
    func listResources(resourceType: ResourceType, environment: String, region: String) async throws -> [TaggedResource] {
        switch resourceType {
        case .lambda:
            return try await listLambdaFunctions(environment: environment, region: region)
        case .s3:
            return try await listS3Buckets(environment: environment, region: region)
        case .rds:
            return try await listRDSClusters(environment: environment, region: region)
        case .dynamodb:
            return try await listDynamoDBTables(environment: environment, region: region)
        case .ecs:
            return try await listECSClusters(environment: environment, region: region)
        default:
            return []
        }
    }
    
    func getResourceTags(arn: String, region: String) async throws -> [String: String] {
        let command = "aws resourcegroupstaggingapi get-resources --resource-arn-list \"\(arn)\" --region \(region) --output json"
        let output = try await executeCommand(command)
        
        guard let json = try? JSONSerialization.jsonObject(with: output) as? [String: Any],
              let resources = json["ResourceTagMappingList"] as? [[String: Any]],
              let resource = resources.first,
              let tagList = resource["Tags"] as? [[String: Any]] else {
            return [:]
        }
        
        var tags: [String: String] = [:]
        for tag in tagList {
            if let key = tag["Key"] as? String, let value = tag["Value"] as? String {
                tags[key] = value
            }
        }
        return tags
    }
    
    func addTags(arn: String, tags: [String: String], region: String) async throws {
        let tagArgs = tags.map { "Key=\($0.key),Value=\($0.value)" }.joined(separator: " ")
        let command = "aws resourcegroupstaggingapi tag-resources --resource-arn-list \"\(arn)\" --tags \(tagArgs) --region \(region)"
        _ = try await executeCommand(command)
    }
    
    func removeTags(arn: String, tagKeys: [String], region: String) async throws {
        let keysArg = tagKeys.joined(separator: " ")
        let command = "aws resourcegroupstaggingapi untag-resources --resource-arn-list \"\(arn)\" --tag-keys \(keysArg) --region \(region)"
        _ = try await executeCommand(command)
    }
    
    func bulkAddTags(operation: BulkTagOperation, region: String, onProgress: @escaping @Sendable (String) -> Void) async throws {
        for resource in operation.resources {
            onProgress("Tagging \(resource.name)...")
            try await addTags(arn: resource.arn, tags: operation.tagsToAdd, region: region)
        }
        onProgress("Completed tagging \(operation.resources.count) resources")
    }
    
    func bulkRemoveTags(operation: BulkTagOperation, region: String, onProgress: @escaping @Sendable (String) -> Void) async throws {
        for resource in operation.resources {
            onProgress("Removing tags from \(resource.name)...")
            try await removeTags(arn: resource.arn, tagKeys: operation.tagsToRemove, region: region)
        }
        onProgress("Completed removing tags from \(operation.resources.count) resources")
    }
    
    func checkCompliance(resources: [TaggedResource], policies: [TagPolicy] = standardTags) -> [TagComplianceResult] {
        resources.map { resource in
            var missingTags: [String] = []
            var invalidTags: [String: String] = [:]
            
            for policy in policies where policy.required {
                if resource.tags[policy.key] == nil {
                    missingTags.append(policy.key)
                } else if let allowedValues = policy.allowedValues,
                          let value = resource.tags[policy.key],
                          !allowedValues.contains(value) {
                    invalidTags[policy.key] = "Value '\(value)' not in allowed values: \(allowedValues.joined(separator: ", "))"
                }
            }
            
            return TagComplianceResult(
                resource: resource,
                missingTags: missingTags,
                invalidTags: invalidTags,
                isCompliant: missingTags.isEmpty && invalidTags.isEmpty
            )
        }
    }
    
    func generateCostReport(resources: [TaggedResource]) -> [String: [TaggedResource]] {
        var byTag: [String: [TaggedResource]] = [:]
        
        for resource in resources {
            let costCenter = resource.tags["CostCenter"] ?? "Untagged"
            byTag[costCenter, default: []].append(resource)
        }
        
        return byTag
    }
    
    // MARK: - Resource Listing
    
    private func listLambdaFunctions(environment: String, region: String) async throws -> [TaggedResource] {
        let command = "aws lambda list-functions --region \(region) --output json"
        let output = try await executeCommand(command)
        
        guard let json = try? JSONSerialization.jsonObject(with: output) as? [String: Any],
              let functions = json["Functions"] as? [[String: Any]] else {
            return []
        }
        
        var resources: [TaggedResource] = []
        for fn in functions {
            guard let name = fn["FunctionName"] as? String,
                  let arn = fn["FunctionArn"] as? String,
                  name.contains(environment) else { continue }
            
            let tags = try? await getResourceTags(arn: arn, region: region)
            resources.append(TaggedResource(
                id: arn,
                arn: arn,
                name: name,
                resourceType: .lambda,
                tags: tags ?? [:],
                region: region
            ))
        }
        return resources
    }
    
    private func listS3Buckets(environment: String, region: String) async throws -> [TaggedResource] {
        let command = "aws s3api list-buckets --output json"
        let output = try await executeCommand(command)
        
        guard let json = try? JSONSerialization.jsonObject(with: output) as? [String: Any],
              let buckets = json["Buckets"] as? [[String: Any]] else {
            return []
        }
        
        var resources: [TaggedResource] = []
        for bucket in buckets {
            guard let name = bucket["Name"] as? String,
                  name.contains(environment) else { continue }
            
            let arn = "arn:aws:s3:::\(name)"
            
            var tags: [String: String] = [:]
            let tagsCommand = "aws s3api get-bucket-tagging --bucket \"\(name)\" --output json 2>/dev/null"
            if let tagsOutput = try? await executeCommand(tagsCommand),
               let tagsJson = try? JSONSerialization.jsonObject(with: tagsOutput) as? [String: Any],
               let tagSet = tagsJson["TagSet"] as? [[String: Any]] {
                for tag in tagSet {
                    if let key = tag["Key"] as? String, let value = tag["Value"] as? String {
                        tags[key] = value
                    }
                }
            }
            
            resources.append(TaggedResource(
                id: arn,
                arn: arn,
                name: name,
                resourceType: .s3,
                tags: tags,
                region: region
            ))
        }
        return resources
    }
    
    private func listRDSClusters(environment: String, region: String) async throws -> [TaggedResource] {
        let command = "aws rds describe-db-clusters --region \(region) --output json"
        let output = try await executeCommand(command)
        
        guard let json = try? JSONSerialization.jsonObject(with: output) as? [String: Any],
              let clusters = json["DBClusters"] as? [[String: Any]] else {
            return []
        }
        
        var resources: [TaggedResource] = []
        for cluster in clusters {
            guard let name = cluster["DBClusterIdentifier"] as? String,
                  let arn = cluster["DBClusterArn"] as? String,
                  name.contains(environment) else { continue }
            
            var tags: [String: String] = [:]
            if let tagList = cluster["TagList"] as? [[String: Any]] {
                for tag in tagList {
                    if let key = tag["Key"] as? String, let value = tag["Value"] as? String {
                        tags[key] = value
                    }
                }
            }
            
            resources.append(TaggedResource(
                id: arn,
                arn: arn,
                name: name,
                resourceType: .rds,
                tags: tags,
                region: region
            ))
        }
        return resources
    }
    
    private func listDynamoDBTables(environment: String, region: String) async throws -> [TaggedResource] {
        let command = "aws dynamodb list-tables --region \(region) --output json"
        let output = try await executeCommand(command)
        
        guard let json = try? JSONSerialization.jsonObject(with: output) as? [String: Any],
              let tableNames = json["TableNames"] as? [String] else {
            return []
        }
        
        var resources: [TaggedResource] = []
        for name in tableNames where name.contains(environment) {
            let descCommand = "aws dynamodb describe-table --table-name \"\(name)\" --region \(region) --output json"
            guard let descOutput = try? await executeCommand(descCommand),
                  let descJson = try? JSONSerialization.jsonObject(with: descOutput) as? [String: Any],
                  let table = descJson["Table"] as? [String: Any],
                  let arn = table["TableArn"] as? String else { continue }
            
            let tags = try? await getResourceTags(arn: arn, region: region)
            resources.append(TaggedResource(
                id: arn,
                arn: arn,
                name: name,
                resourceType: .dynamodb,
                tags: tags ?? [:],
                region: region
            ))
        }
        return resources
    }
    
    private func listECSClusters(environment: String, region: String) async throws -> [TaggedResource] {
        let command = "aws ecs list-clusters --region \(region) --output json"
        let output = try await executeCommand(command)
        
        guard let json = try? JSONSerialization.jsonObject(with: output) as? [String: Any],
              let arns = json["clusterArns"] as? [String] else {
            return []
        }
        
        var resources: [TaggedResource] = []
        for arn in arns {
            let name = arn.components(separatedBy: "/").last ?? arn
            guard name.contains(environment) else { continue }
            
            let tags = try? await getResourceTags(arn: arn, region: region)
            resources.append(TaggedResource(
                id: arn,
                arn: arn,
                name: name,
                resourceType: .ecs,
                tags: tags ?? [:],
                region: region
            ))
        }
        return resources
    }
    
    private func executeCommand(_ command: String) async throws -> Data {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/zsh")
        process.arguments = ["-c", command]
        
        let outputPipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = errorPipe
        
        try process.run()
        process.waitUntilExit()
        
        let outputData = outputPipe.fileHandleForReading.readDataToEndOfFile()
        
        guard process.terminationStatus == 0 else {
            let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
            let errorString = String(data: errorData, encoding: .utf8) ?? "Unknown error"
            throw TagsError.awsError(errorString)
        }
        
        return outputData
    }
}
