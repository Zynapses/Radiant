// RADIANT v7.2.0 - Rollback Service
// Version tracking and automated rollback for AWS resources

import Foundation

actor RollbackService {
    static let shared = RollbackService()
    
    enum RollbackError: LocalizedError {
        case awsError(String)
        case noVersionsFound
        case rollbackFailed(String)
        case invalidResource
        
        var errorDescription: String? {
            switch self {
            case .awsError(let msg): return "AWS Error: \(msg)"
            case .noVersionsFound: return "No previous versions found"
            case .rollbackFailed(let msg): return "Rollback failed: \(msg)"
            case .invalidResource: return "Invalid resource"
            }
        }
    }
    
    enum ResourceType: String, CaseIterable, Sendable {
        case lambda = "Lambda"
        case ecs = "ECS"
        case cloudformation = "CloudFormation"
        case rds = "RDS"
        
        var icon: String {
            switch self {
            case .lambda: return "function"
            case .ecs: return "server.rack"
            case .cloudformation: return "square.stack.3d.up"
            case .rds: return "cylinder"
            }
        }
    }
    
    struct ResourceVersion: Identifiable, Sendable {
        let id: String
        let resourceType: ResourceType
        let resourceName: String
        let version: String
        let deployedAt: Date
        let isCurrent: Bool
        let description: String?
        let metadata: [String: String]
    }
    
    struct RollbackPlan: Identifiable, Sendable {
        let id = UUID()
        let targetVersion: ResourceVersion
        let affectedResources: [String]
        let estimatedDowntime: TimeInterval
        let requiresApproval: Bool
        let steps: [RollbackStep]
        
        struct RollbackStep: Identifiable, Sendable {
            let id = UUID()
            let order: Int
            let action: String
            let resource: String
            let description: String
        }
    }
    
    struct RollbackResult: Sendable {
        let success: Bool
        let resourceName: String
        let previousVersion: String
        let newVersion: String
        let duration: TimeInterval
        let error: String?
    }
    
    func listVersions(resourceType: ResourceType, resourceName: String, region: String) async throws -> [ResourceVersion] {
        switch resourceType {
        case .lambda:
            return try await listLambdaVersions(functionName: resourceName, region: region)
        case .ecs:
            return try await listECSVersions(serviceName: resourceName, region: region)
        case .cloudformation:
            return try await listCFNVersions(stackName: resourceName, region: region)
        case .rds:
            return try await listRDSSnapshots(dbIdentifier: resourceName, region: region)
        }
    }
    
    func createRollbackPlan(to version: ResourceVersion, region: String) async throws -> RollbackPlan {
        var steps: [RollbackPlan.RollbackStep] = []
        var affectedResources: [String] = [version.resourceName]
        var estimatedDowntime: TimeInterval = 0
        
        switch version.resourceType {
        case .lambda:
            steps = [
                RollbackPlan.RollbackStep(order: 1, action: "Update alias", resource: version.resourceName, description: "Point alias to version \(version.version)"),
                RollbackPlan.RollbackStep(order: 2, action: "Verify", resource: version.resourceName, description: "Verify function is responding")
            ]
            estimatedDowntime = 5
            
        case .ecs:
            steps = [
                RollbackPlan.RollbackStep(order: 1, action: "Update service", resource: version.resourceName, description: "Update to task definition \(version.version)"),
                RollbackPlan.RollbackStep(order: 2, action: "Wait for stability", resource: version.resourceName, description: "Wait for service to stabilize"),
                RollbackPlan.RollbackStep(order: 3, action: "Verify health", resource: version.resourceName, description: "Verify all tasks are healthy")
            ]
            estimatedDowntime = 120
            
        case .cloudformation:
            steps = [
                RollbackPlan.RollbackStep(order: 1, action: "Initiate rollback", resource: version.resourceName, description: "Rollback stack to previous state"),
                RollbackPlan.RollbackStep(order: 2, action: "Monitor progress", resource: version.resourceName, description: "Monitor stack events"),
                RollbackPlan.RollbackStep(order: 3, action: "Verify resources", resource: version.resourceName, description: "Verify all resources are restored")
            ]
            estimatedDowntime = 300
            
        case .rds:
            steps = [
                RollbackPlan.RollbackStep(order: 1, action: "Restore snapshot", resource: version.resourceName, description: "Restore from snapshot \(version.version)"),
                RollbackPlan.RollbackStep(order: 2, action: "Update endpoint", resource: version.resourceName, description: "Update connection endpoint"),
                RollbackPlan.RollbackStep(order: 3, action: "Verify connectivity", resource: version.resourceName, description: "Verify database connectivity")
            ]
            estimatedDowntime = 600
        }
        
        return RollbackPlan(
            targetVersion: version,
            affectedResources: affectedResources,
            estimatedDowntime: estimatedDowntime,
            requiresApproval: version.resourceType == .rds || version.resourceType == .cloudformation,
            steps: steps
        )
    }
    
    func executeRollback(plan: RollbackPlan, region: String, onProgress: @escaping @Sendable (String) -> Void) async throws -> RollbackResult {
        let startTime = Date()
        let version = plan.targetVersion
        
        onProgress("Starting rollback to version \(version.version)...")
        
        do {
            switch version.resourceType {
            case .lambda:
                try await rollbackLambda(functionName: version.resourceName, version: version.version, region: region, onProgress: onProgress)
            case .ecs:
                try await rollbackECS(serviceName: version.resourceName, taskDefinition: version.version, region: region, onProgress: onProgress)
            case .cloudformation:
                try await rollbackCFN(stackName: version.resourceName, region: region, onProgress: onProgress)
            case .rds:
                try await rollbackRDS(dbIdentifier: version.resourceName, snapshotId: version.version, region: region, onProgress: onProgress)
            }
            
            onProgress("Rollback completed successfully")
            
            return RollbackResult(
                success: true,
                resourceName: version.resourceName,
                previousVersion: "current",
                newVersion: version.version,
                duration: Date().timeIntervalSince(startTime),
                error: nil
            )
        } catch {
            return RollbackResult(
                success: false,
                resourceName: version.resourceName,
                previousVersion: "current",
                newVersion: version.version,
                duration: Date().timeIntervalSince(startTime),
                error: error.localizedDescription
            )
        }
    }
    
    // MARK: - Lambda
    
    private func listLambdaVersions(functionName: String, region: String) async throws -> [ResourceVersion] {
        let command = "aws lambda list-versions-by-function --function-name \"\(functionName)\" --region \(region) --output json"
        let output = try await executeCommand(command)
        
        guard let json = try? JSONSerialization.jsonObject(with: output) as? [String: Any],
              let versions = json["Versions"] as? [[String: Any]] else {
            throw RollbackError.noVersionsFound
        }
        
        return versions.compactMap { v -> ResourceVersion? in
            guard let version = v["Version"] as? String, version != "$LATEST" else { return nil }
            let lastModified = v["LastModified"] as? String ?? ""
            let date = ISO8601DateFormatter().date(from: lastModified) ?? Date()
            
            return ResourceVersion(
                id: "\(functionName):\(version)",
                resourceType: .lambda,
                resourceName: functionName,
                version: version,
                deployedAt: date,
                isCurrent: false,
                description: v["Description"] as? String,
                metadata: ["runtime": v["Runtime"] as? String ?? "", "codeSize": "\(v["CodeSize"] as? Int ?? 0)"]
            )
        }.sorted { $0.version > $1.version }
    }
    
    private func rollbackLambda(functionName: String, version: String, region: String, onProgress: @escaping @Sendable (String) -> Void) async throws {
        onProgress("Updating Lambda alias to version \(version)...")
        
        let command = """
        aws lambda update-alias \
            --function-name "\(functionName)" \
            --name live \
            --function-version \(version) \
            --region \(region) \
            --output json
        """
        
        _ = try await executeCommand(command)
        onProgress("Lambda alias updated successfully")
    }
    
    // MARK: - ECS
    
    private func listECSVersions(serviceName: String, region: String) async throws -> [ResourceVersion] {
        let parts = serviceName.split(separator: "/")
        let cluster = parts.count > 1 ? String(parts[0]) : "default"
        let service = parts.count > 1 ? String(parts[1]) : serviceName
        
        let command = "aws ecs describe-services --cluster \"\(cluster)\" --services \"\(service)\" --region \(region) --output json"
        let output = try await executeCommand(command)
        
        guard let json = try? JSONSerialization.jsonObject(with: output) as? [String: Any],
              let services = json["services"] as? [[String: Any]],
              let svc = services.first,
              let deployments = svc["deployments"] as? [[String: Any]] else {
            throw RollbackError.noVersionsFound
        }
        
        return deployments.enumerated().compactMap { (index, d) -> ResourceVersion? in
            guard let taskDef = d["taskDefinition"] as? String else { return nil }
            let createdAt = d["createdAt"] as? Double ?? 0
            
            return ResourceVersion(
                id: taskDef,
                resourceType: .ecs,
                resourceName: serviceName,
                version: taskDef.components(separatedBy: "/").last ?? taskDef,
                deployedAt: Date(timeIntervalSince1970: createdAt),
                isCurrent: index == 0,
                description: d["status"] as? String,
                metadata: ["runningCount": "\(d["runningCount"] as? Int ?? 0)", "desiredCount": "\(d["desiredCount"] as? Int ?? 0)"]
            )
        }
    }
    
    private func rollbackECS(serviceName: String, taskDefinition: String, region: String, onProgress: @escaping @Sendable (String) -> Void) async throws {
        let parts = serviceName.split(separator: "/")
        let cluster = parts.count > 1 ? String(parts[0]) : "default"
        let service = parts.count > 1 ? String(parts[1]) : serviceName
        
        onProgress("Updating ECS service to task definition \(taskDefinition)...")
        
        let command = """
        aws ecs update-service \
            --cluster "\(cluster)" \
            --service "\(service)" \
            --task-definition "\(taskDefinition)" \
            --region \(region) \
            --output json
        """
        
        _ = try await executeCommand(command)
        onProgress("Waiting for service to stabilize...")
        
        let waitCommand = "aws ecs wait services-stable --cluster \"\(cluster)\" --services \"\(service)\" --region \(region)"
        _ = try await executeCommand(waitCommand)
        onProgress("ECS service rolled back successfully")
    }
    
    // MARK: - CloudFormation
    
    private func listCFNVersions(stackName: String, region: String) async throws -> [ResourceVersion] {
        let command = "aws cloudformation describe-stack-events --stack-name \"\(stackName)\" --region \(region) --output json"
        let output = try await executeCommand(command)
        
        guard let json = try? JSONSerialization.jsonObject(with: output) as? [String: Any],
              let events = json["StackEvents"] as? [[String: Any]] else {
            throw RollbackError.noVersionsFound
        }
        
        let updateEvents = events.filter { ($0["ResourceStatus"] as? String)?.contains("COMPLETE") == true && $0["ResourceType"] as? String == "AWS::CloudFormation::Stack" }
        
        return updateEvents.prefix(10).enumerated().map { (index, event) -> ResourceVersion in
            let timestamp = event["Timestamp"] as? String ?? ""
            let date = ISO8601DateFormatter().date(from: timestamp) ?? Date()
            
            return ResourceVersion(
                id: event["EventId"] as? String ?? UUID().uuidString,
                resourceType: .cloudformation,
                resourceName: stackName,
                version: date.formatted(date: .abbreviated, time: .shortened),
                deployedAt: date,
                isCurrent: index == 0,
                description: event["ResourceStatus"] as? String,
                metadata: [:]
            )
        }
    }
    
    private func rollbackCFN(stackName: String, region: String, onProgress: @escaping @Sendable (String) -> Void) async throws {
        onProgress("Initiating CloudFormation rollback...")
        
        let command = "aws cloudformation rollback-stack --stack-name \"\(stackName)\" --region \(region)"
        _ = try await executeCommand(command)
        
        onProgress("Waiting for rollback to complete...")
        let waitCommand = "aws cloudformation wait stack-rollback-complete --stack-name \"\(stackName)\" --region \(region)"
        _ = try await executeCommand(waitCommand)
        onProgress("CloudFormation rollback completed")
    }
    
    // MARK: - RDS
    
    private func listRDSSnapshots(dbIdentifier: String, region: String) async throws -> [ResourceVersion] {
        let command = "aws rds describe-db-cluster-snapshots --db-cluster-identifier \"\(dbIdentifier)\" --region \(region) --output json"
        let output = try await executeCommand(command)
        
        guard let json = try? JSONSerialization.jsonObject(with: output) as? [String: Any],
              let snapshots = json["DBClusterSnapshots"] as? [[String: Any]] else {
            throw RollbackError.noVersionsFound
        }
        
        return snapshots.compactMap { s -> ResourceVersion? in
            guard let snapshotId = s["DBClusterSnapshotIdentifier"] as? String else { return nil }
            let createdAt = s["SnapshotCreateTime"] as? String ?? ""
            let date = ISO8601DateFormatter().date(from: createdAt) ?? Date()
            
            return ResourceVersion(
                id: snapshotId,
                resourceType: .rds,
                resourceName: dbIdentifier,
                version: snapshotId,
                deployedAt: date,
                isCurrent: false,
                description: s["Status"] as? String,
                metadata: ["engine": s["Engine"] as? String ?? "", "allocatedStorage": "\(s["AllocatedStorage"] as? Int ?? 0) GB"]
            )
        }.sorted { $0.deployedAt > $1.deployedAt }
    }
    
    private func rollbackRDS(dbIdentifier: String, snapshotId: String, region: String, onProgress: @escaping @Sendable (String) -> Void) async throws {
        onProgress("Restoring RDS from snapshot \(snapshotId)...")
        
        let restoredId = "\(dbIdentifier)-restored-\(Int(Date().timeIntervalSince1970))"
        let command = """
        aws rds restore-db-cluster-from-snapshot \
            --db-cluster-identifier "\(restoredId)" \
            --snapshot-identifier "\(snapshotId)" \
            --engine aurora-postgresql \
            --region \(region) \
            --output json
        """
        
        _ = try await executeCommand(command)
        onProgress("Waiting for cluster to become available...")
        
        let waitCommand = "aws rds wait db-cluster-available --db-cluster-identifier \"\(restoredId)\" --region \(region)"
        _ = try await executeCommand(waitCommand)
        onProgress("RDS cluster restored successfully as \(restoredId)")
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
            throw RollbackError.awsError(errorString)
        }
        
        return outputData
    }
}
