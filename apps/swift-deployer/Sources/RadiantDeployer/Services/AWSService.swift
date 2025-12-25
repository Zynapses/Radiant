import Foundation

actor AWSService {
    enum AWSError: Error, LocalizedError {
        case invalidCredentials
        case networkError(String)
        case apiError(String)
        
        var errorDescription: String? {
            switch self {
            case .invalidCredentials:
                return "Invalid AWS credentials"
            case .networkError(let message):
                return "Network error: \(message)"
            case .apiError(let message):
                return "AWS API error: \(message)"
            }
        }
    }
    
    func getCallerIdentity(credentials: CredentialSet) async throws -> AWSAccount {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/local/bin/aws")
        process.arguments = ["sts", "get-caller-identity", "--output", "json"]
        
        var environment = ProcessInfo.processInfo.environment
        environment["AWS_ACCESS_KEY_ID"] = credentials.accessKeyId
        environment["AWS_SECRET_ACCESS_KEY"] = credentials.secretAccessKey
        environment["AWS_DEFAULT_REGION"] = credentials.region
        process.environment = environment
        
        let outputPipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = errorPipe
        
        try process.run()
        process.waitUntilExit()
        
        if process.terminationStatus != 0 {
            throw AWSError.invalidCredentials
        }
        
        let outputData = outputPipe.fileHandleForReading.readDataToEndOfFile()
        
        guard let json = try? JSONSerialization.jsonObject(with: outputData) as? [String: Any],
              let accountId = json["Account"] as? String else {
            throw AWSError.apiError("Failed to parse STS response")
        }
        
        return AWSAccount(
            accountId: accountId,
            accountAlias: nil,
            regions: [credentials.region]
        )
    }
    
    func listRegions(credentials: CredentialSet) async throws -> [String] {
        return [
            "us-east-1",
            "us-west-2",
            "eu-west-1",
            "eu-central-1",
            "ap-northeast-1",
            "ap-southeast-1",
            "ap-south-1"
        ]
    }
    
    func getStackStatus(
        stackName: String,
        region: String,
        credentials: CredentialSet
    ) async throws -> String {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/local/bin/aws")
        process.arguments = [
            "cloudformation", "describe-stacks",
            "--stack-name", stackName,
            "--region", region,
            "--output", "json"
        ]
        
        var environment = ProcessInfo.processInfo.environment
        environment["AWS_ACCESS_KEY_ID"] = credentials.accessKeyId
        environment["AWS_SECRET_ACCESS_KEY"] = credentials.secretAccessKey
        environment["AWS_DEFAULT_REGION"] = region
        process.environment = environment
        
        let outputPipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = errorPipe
        
        try process.run()
        process.waitUntilExit()
        
        if process.terminationStatus != 0 {
            let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
            let errorMessage = String(data: errorData, encoding: .utf8) ?? "Unknown error"
            throw AWSError.apiError(errorMessage)
        }
        
        let outputData = outputPipe.fileHandleForReading.readDataToEndOfFile()
        
        guard let json = try? JSONSerialization.jsonObject(with: outputData) as? [String: Any],
              let stacks = json["Stacks"] as? [[String: Any]],
              let stack = stacks.first,
              let status = stack["StackStatus"] as? String else {
            throw AWSError.apiError("Failed to parse CloudFormation response")
        }
        
        return status
    }
    
    func getStackOutputs(
        stackName: String,
        region: String,
        credentials: CredentialSet
    ) async throws -> [String: String] {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/local/bin/aws")
        process.arguments = [
            "cloudformation", "describe-stacks",
            "--stack-name", stackName,
            "--region", region,
            "--output", "json"
        ]
        
        var environment = ProcessInfo.processInfo.environment
        environment["AWS_ACCESS_KEY_ID"] = credentials.accessKeyId
        environment["AWS_SECRET_ACCESS_KEY"] = credentials.secretAccessKey
        environment["AWS_DEFAULT_REGION"] = region
        process.environment = environment
        
        let outputPipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = errorPipe
        
        try process.run()
        process.waitUntilExit()
        
        if process.terminationStatus != 0 {
            let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
            let errorMessage = String(data: errorData, encoding: .utf8) ?? "Unknown error"
            throw AWSError.apiError(errorMessage)
        }
        
        let outputData = outputPipe.fileHandleForReading.readDataToEndOfFile()
        
        guard let json = try? JSONSerialization.jsonObject(with: outputData) as? [String: Any],
              let stacks = json["Stacks"] as? [[String: Any]],
              let stack = stacks.first,
              let outputs = stack["Outputs"] as? [[String: Any]] else {
            return [:]
        }
        
        var result: [String: String] = [:]
        for output in outputs {
            if let key = output["OutputKey"] as? String,
               let value = output["OutputValue"] as? String {
                result[key] = value
            }
        }
        
        return result
    }
    
    // MARK: - Stack Management
    
    /// Check if a CloudFormation stack exists
    func stackExists(stackName: String) async -> Bool {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/local/bin/aws")
        process.arguments = [
            "cloudformation", "describe-stacks",
            "--stack-name", stackName,
            "--output", "json"
        ]
        
        let outputPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = FileHandle.nullDevice
        
        do {
            try process.run()
            process.waitUntilExit()
            return process.terminationStatus == 0
        } catch {
            return false
        }
    }
    
    /// Get stack outputs without credentials (uses default)
    func getStackOutputs(stackName: String) async -> [String: String]? {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/local/bin/aws")
        process.arguments = [
            "cloudformation", "describe-stacks",
            "--stack-name", stackName,
            "--output", "json"
        ]
        
        let outputPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = FileHandle.nullDevice
        
        do {
            try process.run()
            process.waitUntilExit()
            
            if process.terminationStatus != 0 {
                return nil
            }
            
            let outputData = outputPipe.fileHandleForReading.readDataToEndOfFile()
            
            guard let json = try? JSONSerialization.jsonObject(with: outputData) as? [String: Any],
                  let stacks = json["Stacks"] as? [[String: Any]],
                  let stack = stacks.first,
                  let outputs = stack["Outputs"] as? [[String: Any]] else {
                return nil
            }
            
            var result: [String: String] = [:]
            for output in outputs {
                if let key = output["OutputKey"] as? String,
                   let value = output["OutputValue"] as? String {
                    result[key] = value
                }
            }
            
            return result
        } catch {
            return nil
        }
    }
    
    // MARK: - S3 Operations
    
    /// Get object from S3
    func getObject(bucket: String, key: String) async -> Data? {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/local/bin/aws")
        process.arguments = [
            "s3api", "get-object",
            "--bucket", bucket,
            "--key", key,
            "/dev/stdout"
        ]
        
        let outputPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = FileHandle.nullDevice
        
        do {
            try process.run()
            process.waitUntilExit()
            
            if process.terminationStatus == 0 {
                return outputPipe.fileHandleForReading.readDataToEndOfFile()
            }
        } catch {
            print("Failed to get S3 object: \(error)")
        }
        
        return nil
    }
    
    /// Put object to S3
    func putObject(bucket: String, key: String, data: Data) async {
        let tempFile = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        
        do {
            try data.write(to: tempFile)
            
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/usr/local/bin/aws")
            process.arguments = [
                "s3", "cp",
                tempFile.path,
                "s3://\(bucket)/\(key)"
            ]
            process.standardOutput = FileHandle.nullDevice
            process.standardError = FileHandle.nullDevice
            
            try process.run()
            process.waitUntilExit()
            
            try? FileManager.default.removeItem(at: tempFile)
        } catch {
            print("Failed to put S3 object: \(error)")
            try? FileManager.default.removeItem(at: tempFile)
        }
    }
    
    /// List objects in S3 bucket
    func listObjects(bucket: String, prefix: String) async -> [String] {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/local/bin/aws")
        process.arguments = [
            "s3api", "list-objects-v2",
            "--bucket", bucket,
            "--prefix", prefix,
            "--output", "json"
        ]
        
        let outputPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = FileHandle.nullDevice
        
        do {
            try process.run()
            process.waitUntilExit()
            
            if process.terminationStatus == 0 {
                let outputData = outputPipe.fileHandleForReading.readDataToEndOfFile()
                
                if let json = try? JSONSerialization.jsonObject(with: outputData) as? [String: Any],
                   let contents = json["Contents"] as? [[String: Any]] {
                    return contents.compactMap { $0["Key"] as? String }
                }
            }
        } catch {
            print("Failed to list S3 objects: \(error)")
        }
        
        return []
    }
    
    // MARK: - Parameter Store
    
    /// Get parameter from SSM Parameter Store
    func getParameter(path: String) async -> String? {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/local/bin/aws")
        process.arguments = [
            "ssm", "get-parameter",
            "--name", path,
            "--with-decryption",
            "--output", "json"
        ]
        
        let outputPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = FileHandle.nullDevice
        
        do {
            try process.run()
            process.waitUntilExit()
            
            if process.terminationStatus == 0 {
                let outputData = outputPipe.fileHandleForReading.readDataToEndOfFile()
                
                if let json = try? JSONSerialization.jsonObject(with: outputData) as? [String: Any],
                   let parameter = json["Parameter"] as? [String: Any],
                   let value = parameter["Value"] as? String {
                    return value
                }
            }
        } catch {
            print("Failed to get SSM parameter: \(error)")
        }
        
        return nil
    }
    
    /// Put parameter to SSM Parameter Store
    func putParameter(path: String, value: String, encrypted: Bool = false) async {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/local/bin/aws")
        
        var args = ["ssm", "put-parameter", "--name", path, "--value", value, "--overwrite"]
        if encrypted {
            args.append(contentsOf: ["--type", "SecureString"])
        } else {
            args.append(contentsOf: ["--type", "String"])
        }
        process.arguments = args
        
        try? process.run()
        process.waitUntilExit()
    }
    
    // MARK: - Credential Validation
    
    /// Validate AWS credentials using STS GetCallerIdentity
    func validateCredentials(_ credentials: CredentialSet) async throws -> AWSAccount {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/local/bin/aws")
        process.arguments = ["sts", "get-caller-identity", "--output", "json"]
        
        var environment = ProcessInfo.processInfo.environment
        environment["AWS_ACCESS_KEY_ID"] = credentials.accessKeyId
        environment["AWS_SECRET_ACCESS_KEY"] = credentials.secretAccessKey
        environment["AWS_DEFAULT_REGION"] = credentials.region
        process.environment = environment
        
        let outputPipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = errorPipe
        
        try process.run()
        process.waitUntilExit()
        
        if process.terminationStatus != 0 {
            let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
            let errorMessage = String(data: errorData, encoding: .utf8) ?? "Unknown error"
            throw AWSError.invalidCredentials
        }
        
        let outputData = outputPipe.fileHandleForReading.readDataToEndOfFile()
        
        guard let json = try? JSONSerialization.jsonObject(with: outputData) as? [String: Any],
              let accountId = json["Account"] as? String else {
            throw AWSError.apiError("Failed to parse STS response")
        }
        
        return AWSAccount(
            accountId: accountId,
            accountAlias: nil,
            regions: [credentials.region]
        )
    }
    
    // MARK: - RDS Operations
    
    /// Create a DB cluster snapshot
    func createDBClusterSnapshot(snapshotId: String, clusterIdentifier: String) async -> String? {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/local/bin/aws")
        process.arguments = [
            "rds", "create-db-cluster-snapshot",
            "--db-cluster-snapshot-identifier", snapshotId,
            "--db-cluster-identifier", clusterIdentifier,
            "--output", "json"
        ]
        
        let outputPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = FileHandle.nullDevice
        
        do {
            try process.run()
            process.waitUntilExit()
            
            if process.terminationStatus == 0 {
                let data = outputPipe.fileHandleForReading.readDataToEndOfFile()
                if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let snapshot = json["DBClusterSnapshot"] as? [String: Any],
                   let id = snapshot["DBClusterSnapshotIdentifier"] as? String {
                    return id
                }
            }
        } catch {
            print("Failed to create DB snapshot: \(error)")
        }
        
        return nil
    }
    
    /// Restore DB cluster from snapshot
    func restoreDBClusterFromSnapshot(snapshotId: String, clusterIdentifier: String) async -> Bool {
        // First, delete the existing cluster
        let deleteProcess = Process()
        deleteProcess.executableURL = URL(fileURLWithPath: "/usr/local/bin/aws")
        deleteProcess.arguments = [
            "rds", "delete-db-cluster",
            "--db-cluster-identifier", clusterIdentifier,
            "--skip-final-snapshot"
        ]
        deleteProcess.standardOutput = FileHandle.nullDevice
        deleteProcess.standardError = FileHandle.nullDevice
        
        do {
            try deleteProcess.run()
            deleteProcess.waitUntilExit()
            
            // Wait for cluster to be deleted
            try await Task.sleep(nanoseconds: 30_000_000_000) // 30 seconds
            
            // Restore from snapshot
            let restoreProcess = Process()
            restoreProcess.executableURL = URL(fileURLWithPath: "/usr/local/bin/aws")
            restoreProcess.arguments = [
                "rds", "restore-db-cluster-from-snapshot",
                "--db-cluster-identifier", clusterIdentifier,
                "--snapshot-identifier", snapshotId,
                "--engine", "aurora-postgresql"
            ]
            restoreProcess.standardOutput = FileHandle.nullDevice
            restoreProcess.standardError = FileHandle.nullDevice
            
            try restoreProcess.run()
            restoreProcess.waitUntilExit()
            
            return restoreProcess.terminationStatus == 0
        } catch {
            print("Failed to restore DB from snapshot: \(error)")
            return false
        }
    }
    
    // MARK: - CloudWatch Metrics
    
    /// Get CloudWatch metric statistics
    func getMetricStatistics(
        namespace: String,
        metricName: String,
        dimensions: [String: String],
        startTime: Date,
        endTime: Date,
        period: Int,
        statistics: [String]
    ) async -> [[String: Any]]? {
        let formatter = ISO8601DateFormatter()
        
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/local/bin/aws")
        
        var args = [
            "cloudwatch", "get-metric-statistics",
            "--namespace", namespace,
            "--metric-name", metricName,
            "--start-time", formatter.string(from: startTime),
            "--end-time", formatter.string(from: endTime),
            "--period", String(period),
            "--statistics"
        ]
        args.append(contentsOf: statistics)
        args.append(contentsOf: ["--output", "json"])
        
        // Add dimensions
        for (name, value) in dimensions {
            args.append(contentsOf: ["--dimensions", "Name=\(name),Value=\(value)"])
        }
        
        process.arguments = args
        
        let outputPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = FileHandle.nullDevice
        
        do {
            try process.run()
            process.waitUntilExit()
            
            if process.terminationStatus == 0 {
                let data = outputPipe.fileHandleForReading.readDataToEndOfFile()
                if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let datapoints = json["Datapoints"] as? [[String: Any]] {
                    return datapoints
                }
            }
        } catch {
            print("Failed to get metric statistics: \(error)")
        }
        
        return nil
    }
}

// MARK: - Singleton

extension AWSService {
    static let shared = AWSService()
}
