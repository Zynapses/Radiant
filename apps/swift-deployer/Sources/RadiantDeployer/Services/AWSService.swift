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
    
    // MARK: - AWS CLI Path Discovery
    
    /// Possible paths where AWS CLI might be installed
    private static let awsCliPaths = [
        "/opt/homebrew/bin/aws",      // Apple Silicon Homebrew
        "/usr/local/bin/aws",          // Intel Homebrew / manual install
        "/usr/bin/aws"                 // System install
    ]
    
    /// Find the AWS CLI binary path
    private static func findAwsCliPath() -> String {
        for path in awsCliPaths {
            if FileManager.default.fileExists(atPath: path) {
                return path
            }
        }
        // Fallback to Intel Homebrew path
        return "/usr/local/bin/aws"
    }
    
    /// Cached AWS CLI path
    private let awsCliPath: String = AWSService.findAwsCliPath()
    
    func getCallerIdentity(credentials: CredentialSet) async throws -> AWSAccount {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: awsCliPath)
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
        process.executableURL = URL(fileURLWithPath: awsCliPath)
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
        process.executableURL = URL(fileURLWithPath: awsCliPath)
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
        process.executableURL = URL(fileURLWithPath: awsCliPath)
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
        process.executableURL = URL(fileURLWithPath: awsCliPath)
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
        process.executableURL = URL(fileURLWithPath: awsCliPath)
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
            RadiantLogger.warning("Failed to get S3 object \(bucket)/\(key): \(error.localizedDescription)", category: RadiantLogger.aws)
        }
        
        return nil
    }
    
    /// Put object to S3
    func putObject(bucket: String, key: String, data: Data) async {
        let tempFile = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        
        do {
            try data.write(to: tempFile)
            
            let process = Process()
            process.executableURL = URL(fileURLWithPath: awsCliPath)
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
            RadiantLogger.warning("Failed to put S3 object \(bucket)/\(key): \(error.localizedDescription)", category: RadiantLogger.aws)
            try? FileManager.default.removeItem(at: tempFile)
        }
    }
    
    /// List objects in S3 bucket
    func listObjects(bucket: String, prefix: String) async -> [String] {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: awsCliPath)
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
            RadiantLogger.warning("Failed to list S3 objects in \(bucket)/\(prefix): \(error.localizedDescription)", category: RadiantLogger.aws)
        }
        
        return []
    }
    
    // MARK: - Parameter Store
    
    /// Get parameter from SSM Parameter Store
    func getParameter(path: String) async -> String? {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: awsCliPath)
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
            RadiantLogger.warning("Failed to get SSM parameter \(path): \(error.localizedDescription)", category: RadiantLogger.aws)
        }
        
        return nil
    }
    
    /// Put parameter to SSM Parameter Store
    func putParameter(path: String, value: String, encrypted: Bool = false) async {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: awsCliPath)
        
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
        process.executableURL = URL(fileURLWithPath: awsCliPath)
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
        process.executableURL = URL(fileURLWithPath: awsCliPath)
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
            RadiantLogger.error("Failed to create DB snapshot \(snapshotId): \(error.localizedDescription)", category: RadiantLogger.aws)
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
            RadiantLogger.error("Failed to restore DB from snapshot \(snapshotId): \(error.localizedDescription)", category: RadiantLogger.aws)
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
        process.executableURL = URL(fileURLWithPath: awsCliPath)
        
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
            RadiantLogger.warning("Failed to get CloudWatch metric \(namespace)/\(metricName): \(error.localizedDescription)", category: RadiantLogger.aws)
        }
        
        return nil
    }
}

// MARK: - Health Check Methods

extension AWSService {
    /// Validate that AWS credentials are configured and valid (returns Bool)
    func checkCredentialsValid(_ credential: CredentialSet) async -> Bool {
        do {
            _ = try await self.getCallerIdentity(credentials: credential)
            return true
        } catch {
            RadiantLogger.warning("Credential validation failed: \(error.localizedDescription)", category: RadiantLogger.aws)
            return false
        }
    }
    
    /// Check if the API Gateway is healthy by verifying stack status
    func checkAPIHealth(credential: CredentialSet) async -> Bool {
        do {
            // Check if the API stack exists and is healthy
            let status = try await self.getStackStatus(
                stackName: "radiant-api",
                region: credential.region,
                credentials: credential
            )
            return status == "CREATE_COMPLETE" || status == "UPDATE_COMPLETE"
        } catch {
            // Stack might not exist yet, which is okay
            return true
        }
    }
    
    /// Check if the database stack is healthy
    func checkDatabaseHealth(credential: CredentialSet) async -> Bool {
        
        do {
            // Check if the database stack exists and is healthy
            let status = try await self.getStackStatus(
                stackName: "radiant-database",
                region: credential.region,
                credentials: credential
            )
            return status == "CREATE_COMPLETE" || status == "UPDATE_COMPLETE"
        } catch {
            // Stack might not exist yet, which is okay
            return true
        }
    }
    
    // MARK: - S3 Metadata
    
    struct S3ObjectMetadata {
        let lastModified: Date
        let contentLength: Int64
        let eTag: String
    }
    
    /// Get S3 object metadata without downloading content
    func getObjectMetadata(bucket: String, key: String) async -> S3ObjectMetadata? {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: awsCliPath)
        process.arguments = [
            "s3api", "head-object",
            "--bucket", bucket,
            "--key", key,
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
                
                if let json = try? JSONSerialization.jsonObject(with: outputData) as? [String: Any] {
                    let formatter = ISO8601DateFormatter()
                    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                    
                    let lastModified = (json["LastModified"] as? String).flatMap { formatter.date(from: $0) } ?? Date()
                    let contentLength = json["ContentLength"] as? Int64 ?? 0
                    let eTag = (json["ETag"] as? String)?.trimmingCharacters(in: CharacterSet(charactersIn: "\"")) ?? ""
                    
                    return S3ObjectMetadata(
                        lastModified: lastModified,
                        contentLength: contentLength,
                        eTag: eTag
                    )
                }
            }
        } catch {
            RadiantLogger.warning("Failed to get S3 metadata for \(bucket)/\(key): \(error.localizedDescription)", category: RadiantLogger.aws)
        }
        
        return nil
    }
    
    // MARK: - RDS Data API
    
    /// Execute SQL statement via RDS Data API (for Aurora Serverless)
    func executeRdsStatement(
        resourceArn: String,
        secretArn: String,
        database: String,
        sql: String
    ) async -> Result<[[String: Any]], Error> {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: awsCliPath)
        process.arguments = [
            "rds-data", "execute-statement",
            "--resource-arn", resourceArn,
            "--secret-arn", secretArn,
            "--database", database,
            "--sql", sql,
            "--output", "json"
        ]
        
        let outputPipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = errorPipe
        
        do {
            try process.run()
            process.waitUntilExit()
            
            if process.terminationStatus != 0 {
                let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
                let errorMessage = String(data: errorData, encoding: .utf8) ?? "Unknown error"
                return .failure(AWSError.apiError(errorMessage))
            }
            
            let outputData = outputPipe.fileHandleForReading.readDataToEndOfFile()
            
            guard let json = try? JSONSerialization.jsonObject(with: outputData) as? [String: Any] else {
                return .success([])
            }
            
            // Parse RDS Data API response format
            var records: [[String: Any]] = []
            
            if let recordsArray = json["records"] as? [[[String: Any]]],
               let columnMetadata = json["columnMetadata"] as? [[String: Any]] {
                let columnNames = columnMetadata.compactMap { $0["name"] as? String }
                
                for row in recordsArray {
                    var record: [String: Any] = [:]
                    for (index, field) in row.enumerated() {
                        if index < columnNames.count {
                            // Extract value from RDS Data API field format
                            let value = field["stringValue"] ?? field["longValue"] ?? field["doubleValue"] ?? field["booleanValue"] ?? field["isNull"]
                            record[columnNames[index]] = value
                        }
                    }
                    records.append(record)
                }
            }
            
            return .success(records)
        } catch {
            return .failure(AWSError.networkError(error.localizedDescription))
        }
    }
    
    // MARK: - DynamoDB
    
    /// Put item to DynamoDB
    func dynamoDbPutItem(tableName: String, item: [String: Any]) async -> Result<Void, Error> {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: awsCliPath)
        
        // Convert item to DynamoDB JSON format
        let dynamoItem = convertToDynamoDbFormat(item)
        
        guard let itemJson = try? JSONSerialization.data(withJSONObject: dynamoItem),
              let itemString = String(data: itemJson, encoding: .utf8) else {
            return .failure(AWSError.apiError("Failed to serialize item"))
        }
        
        process.arguments = [
            "dynamodb", "put-item",
            "--table-name", tableName,
            "--item", itemString
        ]
        
        let errorPipe = Pipe()
        process.standardOutput = FileHandle.nullDevice
        process.standardError = errorPipe
        
        do {
            try process.run()
            process.waitUntilExit()
            
            if process.terminationStatus != 0 {
                let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
                let errorMessage = String(data: errorData, encoding: .utf8) ?? "Unknown error"
                return .failure(AWSError.apiError(errorMessage))
            }
            
            return .success(())
        } catch {
            return .failure(AWSError.networkError(error.localizedDescription))
        }
    }
    
    /// Get item from DynamoDB
    func dynamoDbGetItem(tableName: String, key: [String: Any]) async -> Result<[String: Any]?, Error> {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: awsCliPath)
        
        let dynamoKey = convertToDynamoDbFormat(key)
        
        guard let keyJson = try? JSONSerialization.data(withJSONObject: dynamoKey),
              let keyString = String(data: keyJson, encoding: .utf8) else {
            return .failure(AWSError.apiError("Failed to serialize key"))
        }
        
        process.arguments = [
            "dynamodb", "get-item",
            "--table-name", tableName,
            "--key", keyString,
            "--output", "json"
        ]
        
        let outputPipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = errorPipe
        
        do {
            try process.run()
            process.waitUntilExit()
            
            if process.terminationStatus != 0 {
                let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
                let errorMessage = String(data: errorData, encoding: .utf8) ?? "Unknown error"
                return .failure(AWSError.apiError(errorMessage))
            }
            
            let outputData = outputPipe.fileHandleForReading.readDataToEndOfFile()
            
            guard let json = try? JSONSerialization.jsonObject(with: outputData) as? [String: Any],
                  let item = json["Item"] as? [String: Any] else {
                return .success(nil)
            }
            
            return .success(convertFromDynamoDbFormat(item))
        } catch {
            return .failure(AWSError.networkError(error.localizedDescription))
        }
    }
    
    /// Delete item from DynamoDB
    func dynamoDbDeleteItem(tableName: String, key: [String: Any]) async -> Result<Void, Error> {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: awsCliPath)
        
        let dynamoKey = convertToDynamoDbFormat(key)
        
        guard let keyJson = try? JSONSerialization.data(withJSONObject: dynamoKey),
              let keyString = String(data: keyJson, encoding: .utf8) else {
            return .failure(AWSError.apiError("Failed to serialize key"))
        }
        
        process.arguments = [
            "dynamodb", "delete-item",
            "--table-name", tableName,
            "--key", keyString
        ]
        
        let errorPipe = Pipe()
        process.standardOutput = FileHandle.nullDevice
        process.standardError = errorPipe
        
        do {
            try process.run()
            process.waitUntilExit()
            
            if process.terminationStatus != 0 {
                let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
                let errorMessage = String(data: errorData, encoding: .utf8) ?? "Unknown error"
                return .failure(AWSError.apiError(errorMessage))
            }
            
            return .success(())
        } catch {
            return .failure(AWSError.networkError(error.localizedDescription))
        }
    }
    
    /// Convert Swift dictionary to DynamoDB JSON format
    private func convertToDynamoDbFormat(_ item: [String: Any]) -> [String: [String: Any]] {
        var result: [String: [String: Any]] = [:]
        for (key, value) in item {
            switch value {
            case let s as String:
                result[key] = ["S": s]
            case let n as Int:
                result[key] = ["N": String(n)]
            case let n as Double:
                result[key] = ["N": String(n)]
            case let b as Bool:
                result[key] = ["BOOL": b]
            case let d as Date:
                result[key] = ["S": ISO8601DateFormatter().string(from: d)]
            default:
                result[key] = ["S": String(describing: value)]
            }
        }
        return result
    }
    
    /// Convert DynamoDB JSON format to Swift dictionary
    private func convertFromDynamoDbFormat(_ item: [String: Any]) -> [String: Any] {
        var result: [String: Any] = [:]
        for (key, value) in item {
            if let typeValue = value as? [String: Any] {
                if let s = typeValue["S"] as? String {
                    result[key] = s
                } else if let n = typeValue["N"] as? String {
                    result[key] = Double(n) ?? Int(n) ?? n
                } else if let b = typeValue["BOOL"] as? Bool {
                    result[key] = b
                }
            }
        }
        return result
    }
    
    // MARK: - RDS Snapshots
    
    /// Create RDS cluster snapshot
    func createRdsSnapshot(clusterIdentifier: String, snapshotIdentifier: String) async -> Result<String, Error> {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: awsCliPath)
        process.arguments = [
            "rds", "create-db-cluster-snapshot",
            "--db-cluster-identifier", clusterIdentifier,
            "--db-cluster-snapshot-identifier", snapshotIdentifier,
            "--output", "json"
        ]
        
        let outputPipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = errorPipe
        
        do {
            try process.run()
            process.waitUntilExit()
            
            if process.terminationStatus != 0 {
                let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
                let errorMessage = String(data: errorData, encoding: .utf8) ?? "Unknown error"
                return .failure(AWSError.apiError(errorMessage))
            }
            
            let outputData = outputPipe.fileHandleForReading.readDataToEndOfFile()
            
            if let json = try? JSONSerialization.jsonObject(with: outputData) as? [String: Any],
               let snapshot = json["DBClusterSnapshot"] as? [String: Any],
               let arn = snapshot["DBClusterSnapshotArn"] as? String {
                return .success(arn)
            }
            
            return .success(snapshotIdentifier)
        } catch {
            return .failure(AWSError.networkError(error.localizedDescription))
        }
    }
    
    /// Delete RDS cluster snapshot
    func deleteRdsSnapshot(snapshotIdentifier: String) async -> Result<Void, Error> {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: awsCliPath)
        process.arguments = [
            "rds", "delete-db-cluster-snapshot",
            "--db-cluster-snapshot-identifier", snapshotIdentifier
        ]
        
        let errorPipe = Pipe()
        process.standardOutput = FileHandle.nullDevice
        process.standardError = errorPipe
        
        do {
            try process.run()
            process.waitUntilExit()
            
            if process.terminationStatus != 0 {
                let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
                let errorMessage = String(data: errorData, encoding: .utf8) ?? "Unknown error"
                return .failure(AWSError.apiError(errorMessage))
            }
            
            return .success(())
        } catch {
            return .failure(AWSError.networkError(error.localizedDescription))
        }
    }
    
    // MARK: - Secrets Manager Operations
    
    /// Create or update a secret in AWS Secrets Manager
    func createOrUpdateSecret(
        secretName: String,
        secretValue: String,
        region: String,
        credentials: CredentialSet
    ) async throws {
        // First try to update existing secret
        let updateProcess = Process()
        updateProcess.executableURL = URL(fileURLWithPath: "/usr/local/bin/aws")
        updateProcess.arguments = [
            "secretsmanager", "put-secret-value",
            "--secret-id", secretName,
            "--secret-string", secretValue,
            "--region", region
        ]
        
        var environment = ProcessInfo.processInfo.environment
        environment["AWS_ACCESS_KEY_ID"] = credentials.accessKeyId
        environment["AWS_SECRET_ACCESS_KEY"] = credentials.secretAccessKey
        environment["AWS_DEFAULT_REGION"] = region
        updateProcess.environment = environment
        
        let updateErrorPipe = Pipe()
        updateProcess.standardOutput = FileHandle.nullDevice
        updateProcess.standardError = updateErrorPipe
        
        try updateProcess.run()
        updateProcess.waitUntilExit()
        
        if updateProcess.terminationStatus == 0 {
            RadiantLogger.info("Updated secret: \(secretName)", category: RadiantLogger.aws)
            return
        }
        
        // Secret doesn't exist, create it
        let createProcess = Process()
        createProcess.executableURL = URL(fileURLWithPath: "/usr/local/bin/aws")
        createProcess.arguments = [
            "secretsmanager", "create-secret",
            "--name", secretName,
            "--secret-string", secretValue,
            "--region", region
        ]
        createProcess.environment = environment
        
        let createErrorPipe = Pipe()
        createProcess.standardOutput = FileHandle.nullDevice
        createProcess.standardError = createErrorPipe
        
        try createProcess.run()
        createProcess.waitUntilExit()
        
        if createProcess.terminationStatus != 0 {
            let errorData = createErrorPipe.fileHandleForReading.readDataToEndOfFile()
            let errorMessage = String(data: errorData, encoding: .utf8) ?? "Unknown error"
            throw AWSError.apiError("Failed to create secret \(secretName): \(errorMessage)")
        }
        
        RadiantLogger.info("Created secret: \(secretName)", category: RadiantLogger.aws)
    }
    
    /// Get a secret value from AWS Secrets Manager
    func getSecretValue(
        secretName: String,
        region: String,
        credentials: CredentialSet
    ) async -> String? {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: awsCliPath)
        process.arguments = [
            "secretsmanager", "get-secret-value",
            "--secret-id", secretName,
            "--region", region,
            "--output", "json"
        ]
        
        var environment = ProcessInfo.processInfo.environment
        environment["AWS_ACCESS_KEY_ID"] = credentials.accessKeyId
        environment["AWS_SECRET_ACCESS_KEY"] = credentials.secretAccessKey
        environment["AWS_DEFAULT_REGION"] = region
        process.environment = environment
        
        let outputPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = FileHandle.nullDevice
        
        do {
            try process.run()
            process.waitUntilExit()
            
            if process.terminationStatus == 0 {
                let outputData = outputPipe.fileHandleForReading.readDataToEndOfFile()
                
                if let json = try? JSONSerialization.jsonObject(with: outputData) as? [String: Any],
                   let secretString = json["SecretString"] as? String {
                    return secretString
                }
            }
        } catch {
            RadiantLogger.warning("Failed to get secret \(secretName): \(error.localizedDescription)", category: RadiantLogger.aws)
        }
        
        return nil
    }
    
    /// Check if a secret exists in AWS Secrets Manager
    func secretExists(
        secretName: String,
        region: String,
        credentials: CredentialSet
    ) async -> Bool {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: awsCliPath)
        process.arguments = [
            "secretsmanager", "describe-secret",
            "--secret-id", secretName,
            "--region", region
        ]
        
        var environment = ProcessInfo.processInfo.environment
        environment["AWS_ACCESS_KEY_ID"] = credentials.accessKeyId
        environment["AWS_SECRET_ACCESS_KEY"] = credentials.secretAccessKey
        environment["AWS_DEFAULT_REGION"] = region
        process.environment = environment
        
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        
        do {
            try process.run()
            process.waitUntilExit()
            return process.terminationStatus == 0
        } catch {
            return false
        }
    }
    
    /// Upload all required provider API keys to Secrets Manager
    /// Retrieves keys from 1Password and uploads to AWS Secrets Manager
    func uploadRequiredProviderSecrets(
        region: String,
        credentials: CredentialSet,
        onProgress: @escaping (String) -> Void
    ) async throws {
        let onePassword = OnePasswordService()
        
        // Check 1Password is configured
        let (installed, signedIn) = try await onePassword.checkStatus()
        guard installed else {
            throw AWSError.apiError("1Password CLI is not installed. Please install it from https://developer.1password.com/docs/cli")
        }
        guard signedIn else {
            throw AWSError.apiError("1Password is not configured. Please configure your Service Account token in Settings.")
        }
        
        // Get required provider API keys from 1Password
        onProgress("Retrieving provider API keys from 1Password...")
        let providerKeys = try await onePassword.getRequiredProviderAPIKeys()
        
        // Required providers
        let requiredProviders: [(name: String, secretPath: String)] = [
            ("Anthropic", "radiant/providers/anthropic"),
            ("Groq", "radiant/providers/groq")
        ]
        
        for provider in requiredProviders {
            onProgress("Uploading \(provider.name) API key to Secrets Manager...")
            
            guard let key = providerKeys.first(where: { $0.provider == provider.name }) else {
                throw AWSError.apiError("Missing required API key for \(provider.name). Please configure it in 1Password (RADIANT vault, item: radiant-provider-\(provider.name.lowercased()))")
            }
            
            guard !key.apiKey.isEmpty else {
                throw AWSError.apiError("Empty API key for \(provider.name). Please update it in 1Password.")
            }
            
            try await createOrUpdateSecret(
                secretName: provider.secretPath,
                secretValue: key.apiKey,
                region: region,
                credentials: credentials
            )
            
            onProgress("✓ \(provider.name) API key uploaded")
        }
    }
}

// MARK: - Singleton

extension AWSService {
    static let shared = AWSService()
}
