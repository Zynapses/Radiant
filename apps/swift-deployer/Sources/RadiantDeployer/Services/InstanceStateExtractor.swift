// RADIANT - Instance State Extractor
// Bi-directional sync: Extract state from running AWS instance WITHOUT snapshots
// This READS state, it does NOT restore or overwrite anything

import Foundation

actor InstanceStateExtractor {
    
    // MARK: - Types
    
    enum ExtractionError: Error, LocalizedError {
        case connectionFailed(String)
        case schemaExtractionFailed(String)
        case lambdaExtractionFailed(String)
        case s3ExtractionFailed(String)
        case cdkExtractionFailed(String)
        case awsError(String)
        
        var errorDescription: String? {
            switch self {
            case .connectionFailed(let msg): return "Connection failed: \(msg)"
            case .schemaExtractionFailed(let msg): return "Schema extraction failed: \(msg)"
            case .lambdaExtractionFailed(let msg): return "Lambda extraction failed: \(msg)"
            case .s3ExtractionFailed(let msg): return "S3 extraction failed: \(msg)"
            case .cdkExtractionFailed(let msg): return "CDK extraction failed: \(msg)"
            case .awsError(let msg): return "AWS error: \(msg)"
            }
        }
    }
    
    /// Complete extracted state from a running instance
    struct ExtractedInstanceState: Codable, Sendable {
        let extractedAt: Date
        let appId: String
        let environment: String
        let region: String
        
        // Extracted components
        var databaseSchema: DatabaseSchema
        var lambdaFunctions: [ExtractedLambda]
        var s3Buckets: [ExtractedS3Bucket]
        var dynamoDBTables: [ExtractedDynamoDBTable]
        var cdkStackOutputs: [String: String]
        var deployedVersion: String
        
        // Metadata about the extraction
        var extractionDuration: TimeInterval
        var warnings: [String]
    }
    
    /// Database schema (structure only, NO data)
    struct DatabaseSchema: Codable, Sendable {
        var tables: [TableDefinition]
        var enums: [EnumDefinition]
        var functions: [FunctionDefinition]
        var indexes: [IndexDefinition]
        var extensions: [String]
        var currentMigrationVersion: String?
    }
    
    struct TableDefinition: Codable, Sendable {
        let name: String
        let schema: String
        var columns: [ColumnDefinition]
        var primaryKey: [String]
        var foreignKeys: [ForeignKeyDefinition]
        var constraints: [ConstraintDefinition]
        var rowCount: Int64 // Approximate, for info only
    }
    
    struct ColumnDefinition: Codable, Sendable {
        let name: String
        let dataType: String
        let isNullable: Bool
        let defaultValue: String?
        let isIdentity: Bool
    }
    
    struct ForeignKeyDefinition: Codable, Sendable {
        let name: String
        let columns: [String]
        let referencedTable: String
        let referencedColumns: [String]
        let onDelete: String
        let onUpdate: String
    }
    
    struct ConstraintDefinition: Codable, Sendable {
        let name: String
        let type: String // CHECK, UNIQUE, etc.
        let definition: String
    }
    
    struct EnumDefinition: Codable, Sendable {
        let name: String
        let values: [String]
    }
    
    struct FunctionDefinition: Codable, Sendable {
        let name: String
        let schema: String
        let language: String
        let returnType: String
        let arguments: String
        let definition: String
    }
    
    struct IndexDefinition: Codable, Sendable {
        let name: String
        let tableName: String
        let columns: [String]
        let isUnique: Bool
        let indexType: String
    }
    
    /// Extracted Lambda function (code included)
    struct ExtractedLambda: Codable, Sendable {
        let functionName: String
        let functionArn: String
        let runtime: String
        let handler: String
        let memorySize: Int
        let timeout: Int
        let environment: [String: String]
        let codeHash: String
        let codeSize: Int64
        let lastModified: Date
        var localCodePath: String? // Where we downloaded the code
    }
    
    /// Extracted S3 bucket configuration (NOT contents)
    struct ExtractedS3Bucket: Codable, Sendable {
        let bucketName: String
        let bucketArn: String
        let region: String
        let versioning: Bool
        let encryption: String?
        let lifecycleRules: [String]
        let corsRules: [String]
        let objectCount: Int
        let totalSizeBytes: Int64
    }
    
    /// Extracted DynamoDB table (schema only, NO data)
    struct ExtractedDynamoDBTable: Codable, Sendable {
        let tableName: String
        let tableArn: String
        let keySchema: [KeySchemaElement]
        let attributeDefinitions: [AttributeDefinition]
        let billingMode: String
        let provisionedThroughput: ProvisionedThroughput?
        let globalSecondaryIndexes: [GSIDefinition]
        let itemCount: Int64
        let tableSizeBytes: Int64
    }
    
    struct KeySchemaElement: Codable, Sendable {
        let attributeName: String
        let keyType: String // HASH or RANGE
    }
    
    struct AttributeDefinition: Codable, Sendable {
        let attributeName: String
        let attributeType: String // S, N, B
    }
    
    struct ProvisionedThroughput: Codable, Sendable {
        let readCapacityUnits: Int
        let writeCapacityUnits: Int
    }
    
    struct GSIDefinition: Codable, Sendable {
        let indexName: String
        let keySchema: [KeySchemaElement]
        let projection: String
    }
    
    // MARK: - Properties
    
    private let awsCliPath: String
    private let extractionDirectory: URL
    
    // MARK: - Initialization
    
    init() {
        self.awsCliPath = Self.findAwsCliPath()
        self.extractionDirectory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            .appendingPathComponent("RadiantDeployer")
            .appendingPathComponent("extracted-states")
        
        try? FileManager.default.createDirectory(at: extractionDirectory, withIntermediateDirectories: true)
    }
    
    private static func findAwsCliPath() -> String {
        let paths = ["/opt/homebrew/bin/aws", "/usr/local/bin/aws", "/usr/bin/aws"]
        for path in paths {
            if FileManager.default.fileExists(atPath: path) { return path }
        }
        return "/usr/local/bin/aws"
    }
    
    // MARK: - Main Extraction Method
    
    /// Extract complete state from a running instance (READ-ONLY, no modifications)
    func extractInstanceState(
        appId: String,
        environment: String,
        credentials: CredentialSet,
        onProgress: @escaping (String, Double) -> Void
    ) async throws -> ExtractedInstanceState {
        let startTime = Date()
        var warnings: [String] = []
        
        onProgress("Connecting to AWS...", 0.0)
        
        // Verify connectivity
        guard try await verifyAWSConnectivity(credentials: credentials) else {
            throw ExtractionError.connectionFailed("Cannot connect to AWS with provided credentials")
        }
        
        // Also extract comprehensive AWS state using AWSStateTracker
        onProgress("Extracting comprehensive AWS state...", 0.02)
        _ = try? await AWSStateTracker.shared.extractFullState(
            appId: appId,
            environment: environment,
            credentials: credentials
        ) { message, progress in
            // Sub-progress for AWS state tracking (0.02 to 0.05)
            onProgress("AWS State: \(message)", 0.02 + (progress * 0.03))
        }
        
        // Step 1: Extract database schema (30%)
        onProgress("Extracting database schema...", 0.05)
        let dbSchema = try await extractDatabaseSchema(
            appId: appId,
            environment: environment,
            credentials: credentials
        )
        onProgress("Database schema extracted: \(dbSchema.tables.count) tables", 0.30)
        
        // Step 2: Extract Lambda functions (25%)
        onProgress("Extracting Lambda functions...", 0.30)
        let lambdas = try await extractLambdaFunctions(
            appId: appId,
            environment: environment,
            credentials: credentials
        )
        onProgress("Lambda functions extracted: \(lambdas.count) functions", 0.55)
        
        // Step 3: Extract S3 bucket configurations (15%)
        onProgress("Extracting S3 bucket configurations...", 0.55)
        let s3Buckets = try await extractS3Configurations(
            appId: appId,
            environment: environment,
            credentials: credentials
        )
        onProgress("S3 configurations extracted: \(s3Buckets.count) buckets", 0.70)
        
        // Step 4: Extract DynamoDB tables (15%)
        onProgress("Extracting DynamoDB table schemas...", 0.70)
        let dynamoTables = try await extractDynamoDBSchemas(
            appId: appId,
            environment: environment,
            credentials: credentials
        )
        onProgress("DynamoDB schemas extracted: \(dynamoTables.count) tables", 0.85)
        
        // Step 5: Extract CDK stack outputs (10%)
        onProgress("Extracting CDK stack outputs...", 0.85)
        let cdkOutputs = try await extractCDKStackOutputs(
            appId: appId,
            environment: environment,
            credentials: credentials
        )
        onProgress("CDK outputs extracted", 0.95)
        
        // Get deployed version from metadata
        let deployedVersion = cdkOutputs["RadiantVersion"] ?? "unknown"
        
        let extractionDuration = Date().timeIntervalSince(startTime)
        
        let state = ExtractedInstanceState(
            extractedAt: Date(),
            appId: appId,
            environment: environment,
            region: credentials.region,
            databaseSchema: dbSchema,
            lambdaFunctions: lambdas,
            s3Buckets: s3Buckets,
            dynamoDBTables: dynamoTables,
            cdkStackOutputs: cdkOutputs,
            deployedVersion: deployedVersion,
            extractionDuration: extractionDuration,
            warnings: warnings
        )
        
        // Persist the extracted state
        try await persistExtractedState(state)
        
        onProgress("Extraction complete!", 1.0)
        RadiantLogger.info("Extracted instance state in \(String(format: "%.1f", extractionDuration))s", category: RadiantLogger.aws)
        
        return state
    }
    
    // MARK: - Database Schema Extraction
    
    private func extractDatabaseSchema(
        appId: String,
        environment: String,
        credentials: CredentialSet
    ) async throws -> DatabaseSchema {
        // Get database connection info from Secrets Manager
        let secretName = "radiant-\(appId)-\(environment.lowercased())/database"
        let dbCredentials = try await getSecretValue(secretName: secretName, credentials: credentials)
        
        guard let host = dbCredentials["host"],
              let port = dbCredentials["port"],
              let database = dbCredentials["database"],
              let username = dbCredentials["username"],
              let password = dbCredentials["password"] else {
            throw ExtractionError.schemaExtractionFailed("Missing database credentials in secret")
        }
        
        // Use psql to extract schema information
        let schemaQuery = """
        SELECT json_build_object(
            'tables', (
                SELECT json_agg(json_build_object(
                    'name', t.table_name,
                    'schema', t.table_schema,
                    'columns', (
                        SELECT json_agg(json_build_object(
                            'name', c.column_name,
                            'dataType', c.data_type,
                            'isNullable', c.is_nullable = 'YES',
                            'defaultValue', c.column_default,
                            'isIdentity', c.is_identity = 'YES'
                        ) ORDER BY c.ordinal_position)
                        FROM information_schema.columns c
                        WHERE c.table_name = t.table_name AND c.table_schema = t.table_schema
                    )
                ))
                FROM information_schema.tables t
                WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
                AND t.table_type = 'BASE TABLE'
            ),
            'enums', (
                SELECT json_agg(json_build_object(
                    'name', t.typname,
                    'values', (SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid = t.oid)
                ))
                FROM pg_type t
                JOIN pg_namespace n ON t.typnamespace = n.oid
                WHERE t.typtype = 'e' AND n.nspname = 'public'
            ),
            'currentMigrationVersion', (
                SELECT version FROM flyway_schema_history 
                WHERE success = true 
                ORDER BY installed_rank DESC LIMIT 1
            )
        )
        """
        
        let result = try await runPsqlQuery(
            host: host,
            port: port,
            database: database,
            username: username,
            password: password,
            query: schemaQuery
        )
        
        // Parse JSON result into DatabaseSchema
        guard let data = result.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw ExtractionError.schemaExtractionFailed("Failed to parse schema JSON")
        }
        
        var schema = DatabaseSchema(
            tables: [],
            enums: [],
            functions: [],
            indexes: [],
            extensions: [],
            currentMigrationVersion: json["currentMigrationVersion"] as? String
        )
        
        // Parse tables
        if let tablesJson = json["tables"] as? [[String: Any]] {
            for tableJson in tablesJson {
                var columns: [ColumnDefinition] = []
                if let columnsJson = tableJson["columns"] as? [[String: Any]] {
                    for colJson in columnsJson {
                        columns.append(ColumnDefinition(
                            name: colJson["name"] as? String ?? "",
                            dataType: colJson["dataType"] as? String ?? "",
                            isNullable: colJson["isNullable"] as? Bool ?? true,
                            defaultValue: colJson["defaultValue"] as? String,
                            isIdentity: colJson["isIdentity"] as? Bool ?? false
                        ))
                    }
                }
                
                schema.tables.append(TableDefinition(
                    name: tableJson["name"] as? String ?? "",
                    schema: tableJson["schema"] as? String ?? "public",
                    columns: columns,
                    primaryKey: [],
                    foreignKeys: [],
                    constraints: [],
                    rowCount: 0
                ))
            }
        }
        
        // Parse enums
        if let enumsJson = json["enums"] as? [[String: Any]] {
            for enumJson in enumsJson {
                schema.enums.append(EnumDefinition(
                    name: enumJson["name"] as? String ?? "",
                    values: enumJson["values"] as? [String] ?? []
                ))
            }
        }
        
        return schema
    }
    
    // MARK: - Lambda Extraction
    
    private func extractLambdaFunctions(
        appId: String,
        environment: String,
        credentials: CredentialSet
    ) async throws -> [ExtractedLambda] {
        let prefix = "radiant-\(appId)-\(environment.lowercased())"
        
        // List all Lambda functions
        let listResult = try await runAwsCommand([
            "lambda", "list-functions",
            "--region", credentials.region,
            "--output", "json"
        ], credentials: credentials)
        
        guard let json = try? JSONSerialization.jsonObject(with: listResult) as? [String: Any],
              let functions = json["Functions"] as? [[String: Any]] else {
            return []
        }
        
        var extractedLambdas: [ExtractedLambda] = []
        let dateFormatter = ISO8601DateFormatter()
        
        for fn in functions {
            guard let name = fn["FunctionName"] as? String, name.hasPrefix(prefix) else {
                continue
            }
            
            // Download the function code
            let codeLocation = try await downloadLambdaCode(
                functionName: name,
                credentials: credentials
            )
            
            let lastModifiedStr = fn["LastModified"] as? String ?? ""
            let lastModified = dateFormatter.date(from: lastModifiedStr) ?? Date()
            
            extractedLambdas.append(ExtractedLambda(
                functionName: name,
                functionArn: fn["FunctionArn"] as? String ?? "",
                runtime: fn["Runtime"] as? String ?? "nodejs20.x",
                handler: fn["Handler"] as? String ?? "index.handler",
                memorySize: fn["MemorySize"] as? Int ?? 128,
                timeout: fn["Timeout"] as? Int ?? 30,
                environment: (fn["Environment"] as? [String: Any])?["Variables"] as? [String: String] ?? [:],
                codeHash: fn["CodeSha256"] as? String ?? "",
                codeSize: fn["CodeSize"] as? Int64 ?? 0,
                lastModified: lastModified,
                localCodePath: codeLocation
            ))
        }
        
        return extractedLambdas
    }
    
    private func downloadLambdaCode(functionName: String, credentials: CredentialSet) async throws -> String {
        // Get the code URL
        let result = try await runAwsCommand([
            "lambda", "get-function",
            "--function-name", functionName,
            "--region", credentials.region,
            "--output", "json"
        ], credentials: credentials)
        
        guard let json = try? JSONSerialization.jsonObject(with: result) as? [String: Any],
              let code = json["Code"] as? [String: Any],
              let codeUrl = code["Location"] as? String else {
            throw ExtractionError.lambdaExtractionFailed("Cannot get code URL for \(functionName)")
        }
        
        // Download the code zip
        let localDir = extractionDirectory.appendingPathComponent("lambda-code")
        try FileManager.default.createDirectory(at: localDir, withIntermediateDirectories: true)
        
        let localPath = localDir.appendingPathComponent("\(functionName).zip")
        
        // Use curl to download (presigned URL)
        let curlProcess = Process()
        curlProcess.executableURL = URL(fileURLWithPath: "/usr/bin/curl")
        curlProcess.arguments = ["-s", "-o", localPath.path, codeUrl]
        try curlProcess.run()
        curlProcess.waitUntilExit()
        
        if curlProcess.terminationStatus == 0 {
            // Unzip
            let extractDir = localDir.appendingPathComponent(functionName)
            try? FileManager.default.removeItem(at: extractDir)
            try FileManager.default.createDirectory(at: extractDir, withIntermediateDirectories: true)
            
            let unzipProcess = Process()
            unzipProcess.executableURL = URL(fileURLWithPath: "/usr/bin/unzip")
            unzipProcess.arguments = ["-q", "-o", localPath.path, "-d", extractDir.path]
            try unzipProcess.run()
            unzipProcess.waitUntilExit()
            
            return extractDir.path
        }
        
        return localPath.path
    }
    
    // MARK: - S3 Extraction
    
    private func extractS3Configurations(
        appId: String,
        environment: String,
        credentials: CredentialSet
    ) async throws -> [ExtractedS3Bucket] {
        let prefix = "radiant-\(appId)-\(environment.lowercased())"
        
        let listResult = try await runAwsCommand([
            "s3api", "list-buckets",
            "--output", "json"
        ], credentials: credentials)
        
        guard let json = try? JSONSerialization.jsonObject(with: listResult) as? [String: Any],
              let buckets = json["Buckets"] as? [[String: Any]] else {
            return []
        }
        
        var extractedBuckets: [ExtractedS3Bucket] = []
        
        for bucket in buckets {
            guard let name = bucket["Name"] as? String, name.hasPrefix(prefix) else {
                continue
            }
            
            // Get bucket details
            var versioning = false
            var encryption: String? = nil
            
            // Check versioning
            if let versionResult = try? await runAwsCommand([
                "s3api", "get-bucket-versioning",
                "--bucket", name,
                "--output", "json"
            ], credentials: credentials),
               let vJson = try? JSONSerialization.jsonObject(with: versionResult) as? [String: Any] {
                versioning = (vJson["Status"] as? String) == "Enabled"
            }
            
            // Check encryption
            if let encResult = try? await runAwsCommand([
                "s3api", "get-bucket-encryption",
                "--bucket", name,
                "--output", "json"
            ], credentials: credentials),
               let eJson = try? JSONSerialization.jsonObject(with: encResult) as? [String: Any],
               let rules = eJson["ServerSideEncryptionConfiguration"] as? [String: Any],
               let ruleList = rules["Rules"] as? [[String: Any]],
               let firstRule = ruleList.first,
               let apply = firstRule["ApplyServerSideEncryptionByDefault"] as? [String: Any] {
                encryption = apply["SSEAlgorithm"] as? String
            }
            
            extractedBuckets.append(ExtractedS3Bucket(
                bucketName: name,
                bucketArn: "arn:aws:s3:::\(name)",
                region: credentials.region,
                versioning: versioning,
                encryption: encryption,
                lifecycleRules: [],
                corsRules: [],
                objectCount: 0,
                totalSizeBytes: 0
            ))
        }
        
        return extractedBuckets
    }
    
    // MARK: - DynamoDB Extraction
    
    private func extractDynamoDBSchemas(
        appId: String,
        environment: String,
        credentials: CredentialSet
    ) async throws -> [ExtractedDynamoDBTable] {
        let prefix = "radiant-\(appId)-\(environment.lowercased())"
        
        let listResult = try await runAwsCommand([
            "dynamodb", "list-tables",
            "--region", credentials.region,
            "--output", "json"
        ], credentials: credentials)
        
        guard let json = try? JSONSerialization.jsonObject(with: listResult) as? [String: Any],
              let tableNames = json["TableNames"] as? [String] else {
            return []
        }
        
        var extractedTables: [ExtractedDynamoDBTable] = []
        
        for tableName in tableNames where tableName.hasPrefix(prefix) {
            let descResult = try await runAwsCommand([
                "dynamodb", "describe-table",
                "--table-name", tableName,
                "--region", credentials.region,
                "--output", "json"
            ], credentials: credentials)
            
            guard let descJson = try? JSONSerialization.jsonObject(with: descResult) as? [String: Any],
                  let table = descJson["Table"] as? [String: Any] else {
                continue
            }
            
            var keySchema: [KeySchemaElement] = []
            if let ks = table["KeySchema"] as? [[String: Any]] {
                for k in ks {
                    keySchema.append(KeySchemaElement(
                        attributeName: k["AttributeName"] as? String ?? "",
                        keyType: k["KeyType"] as? String ?? ""
                    ))
                }
            }
            
            var attrDefs: [AttributeDefinition] = []
            if let ad = table["AttributeDefinitions"] as? [[String: Any]] {
                for a in ad {
                    attrDefs.append(AttributeDefinition(
                        attributeName: a["AttributeName"] as? String ?? "",
                        attributeType: a["AttributeType"] as? String ?? ""
                    ))
                }
            }
            
            extractedTables.append(ExtractedDynamoDBTable(
                tableName: tableName,
                tableArn: table["TableArn"] as? String ?? "",
                keySchema: keySchema,
                attributeDefinitions: attrDefs,
                billingMode: table["BillingModeSummary"] != nil ? "PAY_PER_REQUEST" : "PROVISIONED",
                provisionedThroughput: nil,
                globalSecondaryIndexes: [],
                itemCount: table["ItemCount"] as? Int64 ?? 0,
                tableSizeBytes: table["TableSizeBytes"] as? Int64 ?? 0
            ))
        }
        
        return extractedTables
    }
    
    // MARK: - CDK Stack Outputs
    
    private func extractCDKStackOutputs(
        appId: String,
        environment: String,
        credentials: CredentialSet
    ) async throws -> [String: String] {
        let stackPrefix = "Radiant-\(appId)-\(environment)"
        
        // List all stacks
        let listResult = try await runAwsCommand([
            "cloudformation", "list-stacks",
            "--stack-status-filter", "CREATE_COMPLETE", "UPDATE_COMPLETE",
            "--region", credentials.region,
            "--output", "json"
        ], credentials: credentials)
        
        guard let json = try? JSONSerialization.jsonObject(with: listResult) as? [String: Any],
              let stacks = json["StackSummaries"] as? [[String: Any]] else {
            return [:]
        }
        
        var outputs: [String: String] = [:]
        
        for stack in stacks {
            guard let stackName = stack["StackName"] as? String,
                  stackName.hasPrefix(stackPrefix) else {
                continue
            }
            
            // Describe stack to get outputs
            let descResult = try await runAwsCommand([
                "cloudformation", "describe-stacks",
                "--stack-name", stackName,
                "--region", credentials.region,
                "--output", "json"
            ], credentials: credentials)
            
            if let descJson = try? JSONSerialization.jsonObject(with: descResult) as? [String: Any],
               let stacksArray = descJson["Stacks"] as? [[String: Any]],
               let stackData = stacksArray.first,
               let stackOutputs = stackData["Outputs"] as? [[String: Any]] {
                for output in stackOutputs {
                    if let key = output["OutputKey"] as? String,
                       let value = output["OutputValue"] as? String {
                        outputs["\(stackName)_\(key)"] = value
                    }
                }
            }
        }
        
        return outputs
    }
    
    // MARK: - Helper Methods
    
    private func verifyAWSConnectivity(credentials: CredentialSet) async throws -> Bool {
        do {
            _ = try await runAwsCommand([
                "sts", "get-caller-identity",
                "--output", "json"
            ], credentials: credentials)
            return true
        } catch {
            return false
        }
    }
    
    private func getSecretValue(secretName: String, credentials: CredentialSet) async throws -> [String: String] {
        let result = try await runAwsCommand([
            "secretsmanager", "get-secret-value",
            "--secret-id", secretName,
            "--region", credentials.region,
            "--output", "json"
        ], credentials: credentials)
        
        guard let json = try? JSONSerialization.jsonObject(with: result) as? [String: Any],
              let secretString = json["SecretString"] as? String,
              let secretData = secretString.data(using: .utf8),
              let secret = try? JSONSerialization.jsonObject(with: secretData) as? [String: String] else {
            throw ExtractionError.awsError("Failed to parse secret: \(secretName)")
        }
        
        return secret
    }
    
    private func runPsqlQuery(
        host: String,
        port: String,
        database: String,
        username: String,
        password: String,
        query: String
    ) async throws -> String {
        let psqlPath = "/opt/homebrew/bin/psql"
        
        let process = Process()
        process.executableURL = URL(fileURLWithPath: FileManager.default.fileExists(atPath: psqlPath) ? psqlPath : "/usr/bin/psql")
        process.arguments = [
            "-h", host,
            "-p", port,
            "-U", username,
            "-d", database,
            "-t", "-A",
            "-c", query
        ]
        
        var env = ProcessInfo.processInfo.environment
        env["PGPASSWORD"] = password
        process.environment = env
        
        let outputPipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = errorPipe
        
        try process.run()
        process.waitUntilExit()
        
        let outputData = outputPipe.fileHandleForReading.readDataToEndOfFile()
        return String(data: outputData, encoding: .utf8) ?? ""
    }
    
    private func runAwsCommand(_ arguments: [String], credentials: CredentialSet) async throws -> Data {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: awsCliPath)
        process.arguments = arguments
        
        var env = ProcessInfo.processInfo.environment
        env["AWS_ACCESS_KEY_ID"] = credentials.accessKeyId
        env["AWS_SECRET_ACCESS_KEY"] = credentials.secretAccessKey
        env["AWS_DEFAULT_REGION"] = credentials.region
        process.environment = env
        
        let outputPipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = errorPipe
        
        try process.run()
        process.waitUntilExit()
        
        if process.terminationStatus != 0 {
            let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
            let errorMessage = String(data: errorData, encoding: .utf8) ?? "Unknown error"
            throw ExtractionError.awsError(errorMessage)
        }
        
        return outputPipe.fileHandleForReading.readDataToEndOfFile()
    }
    
    private func persistExtractedState(_ state: ExtractedInstanceState) async throws {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        
        let data = try encoder.encode(state)
        let filename = "\(state.appId)-\(state.environment)-\(Int(state.extractedAt.timeIntervalSince1970)).json"
        let file = extractionDirectory.appendingPathComponent(filename)
        
        try data.write(to: file)
        RadiantLogger.info("Persisted extracted state to: \(file.path)", category: RadiantLogger.aws)
    }
    
    /// List previously extracted states
    func listExtractedStates() -> [URL] {
        (try? FileManager.default.contentsOfDirectory(at: extractionDirectory, includingPropertiesForKeys: nil)
            .filter { $0.pathExtension == "json" }
            .sorted { $0.lastPathComponent > $1.lastPathComponent }) ?? []
    }
    
    /// Load a previously extracted state
    func loadExtractedState(from url: URL) throws -> ExtractedInstanceState {
        let data = try Data(contentsOf: url)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(ExtractedInstanceState.self, from: data)
    }
}

// MARK: - Singleton

extension InstanceStateExtractor {
    static let shared = InstanceStateExtractor()
}
