// RADIANT v7.2.0 - DynamoDB Export/Import Service
// Manages DynamoDB table state capture for deployment packages
// Supports selective table backup, restore, and cross-region replication

import Foundation

actor DynamoDBExportService {
    static let shared = DynamoDBExportService()
    
    // MARK: - Types
    
    enum ExportError: Error, LocalizedError {
        case connectionFailed(String)
        case exportFailed(String)
        case importFailed(String)
        case tableNotFound(String)
        case insufficientPermissions
        case timeout
        case fileNotFound(String)
        case invalidFormat
        case awsCliNotFound
        case rateLimitExceeded
        
        var errorDescription: String? {
            switch self {
            case .connectionFailed(let msg): return "DynamoDB connection failed: \(msg)"
            case .exportFailed(let msg): return "Export failed: \(msg)"
            case .importFailed(let msg): return "Import failed: \(msg)"
            case .tableNotFound(let name): return "Table not found: \(name)"
            case .insufficientPermissions: return "Insufficient IAM permissions for DynamoDB operations"
            case .timeout: return "DynamoDB operation timed out"
            case .fileNotFound(let path): return "Export file not found: \(path)"
            case .invalidFormat: return "Invalid export file format"
            case .awsCliNotFound: return "AWS CLI not found. Install using 'brew install awscli'"
            case .rateLimitExceeded: return "DynamoDB rate limit exceeded. Try again later."
            }
        }
    }
    
    enum ExportMode: String, Codable, CaseIterable, Sendable {
        case sessionTables = "session_tables"
        case cacheTables = "cache_tables"
        case configTables = "config_tables"
        case allTables = "all_tables"
        case selectedTables = "selected_tables"
        
        var displayName: String {
            switch self {
            case .sessionTables: return "Session Tables"
            case .cacheTables: return "Cache Tables"
            case .configTables: return "Configuration Tables"
            case .allTables: return "All Tables"
            case .selectedTables: return "Selected Tables"
            }
        }
        
        var description: String {
            switch self {
            case .sessionTables: return "User sessions, tokens, and temporary state"
            case .cacheTables: return "API response caches and computed data"
            case .configTables: return "System configuration and feature flags"
            case .allTables: return "All DynamoDB tables in the application"
            case .selectedTables: return "Manually selected tables"
            }
        }
        
        var icon: String {
            switch self {
            case .sessionTables: return "person.badge.clock"
            case .cacheTables: return "memorychip"
            case .configTables: return "gearshape.2"
            case .allTables: return "tablecells.badge.ellipsis"
            case .selectedTables: return "checklist"
            }
        }
    }
    
    struct TableInfo: Codable, Sendable, Identifiable {
        var id: String { tableName }
        let tableName: String
        let tableArn: String
        let itemCount: Int64
        let sizeBytes: Int64
        let status: String
        let createdAt: Date
        let keySchema: [KeySchemaElement]
        let provisionedThroughput: ProvisionedThroughput?
        let billingMode: String
        
        struct KeySchemaElement: Codable, Sendable {
            let attributeName: String
            let keyType: String // HASH or RANGE
        }
        
        struct ProvisionedThroughput: Codable, Sendable {
            let readCapacityUnits: Int
            let writeCapacityUnits: Int
        }
        
        var formattedSize: String {
            ByteCountFormatter.string(fromByteCount: sizeBytes, countStyle: .file)
        }
    }
    
    struct ExportOptions: Codable, Sendable {
        var mode: ExportMode
        var selectedTables: [String]
        var includeStreamData: Bool
        var compressOutput: Bool
        var maxItemsPerTable: Int?
        var exportToS3: Bool
        var s3Bucket: String?
        var s3Prefix: String?
        
        static var defaults: ExportOptions {
            ExportOptions(
                mode: .configTables,
                selectedTables: [],
                includeStreamData: false,
                compressOutput: true,
                maxItemsPerTable: nil,
                exportToS3: false,
                s3Bucket: nil,
                s3Prefix: nil
            )
        }
    }
    
    struct ExportResult: Codable, Sendable, Identifiable {
        let id: String
        let createdAt: Date
        let mode: ExportMode
        let filePath: String
        let fileSize: Int64
        let tables: [TableExportInfo]
        let duration: TimeInterval
        let checksum: String
        
        struct TableExportInfo: Codable, Sendable {
            let tableName: String
            let itemCount: Int64
            let sizeBytes: Int64
        }
        
        var totalItems: Int64 {
            tables.reduce(0) { $0 + $1.itemCount }
        }
        
        var totalSize: Int64 {
            tables.reduce(0) { $0 + $1.sizeBytes }
        }
    }
    
    struct ImportOptions: Codable, Sendable {
        var createTablesIfNotExist: Bool
        var overwriteExisting: Bool
        var skipConflicts: Bool
        var dryRun: Bool
        var targetRegion: String?
        var tableNamePrefix: String?
        var batchSize: Int
        
        static var defaults: ImportOptions {
            ImportOptions(
                createTablesIfNotExist: true,
                overwriteExisting: false,
                skipConflicts: true,
                dryRun: false,
                targetRegion: nil,
                tableNamePrefix: nil,
                batchSize: 25
            )
        }
    }
    
    struct ImportResult: Codable, Sendable {
        let id: String
        let importedAt: Date
        let filePath: String
        let tablesImported: Int
        let itemsImported: Int64
        let duration: TimeInterval
        let warnings: [String]
        let errors: [String]
    }
    
    // MARK: - Table Categories
    
    static let sessionTablePatterns: [String] = [
        "*-sessions",
        "*-tokens",
        "*-websocket-connections",
        "*-active-users"
    ]
    
    static let cacheTablePatterns: [String] = [
        "*-cache",
        "*-api-cache",
        "*-model-cache",
        "*-response-cache"
    ]
    
    static let configTablePatterns: [String] = [
        "*-config",
        "*-settings",
        "*-feature-flags",
        "*-tenant-config"
    ]
    
    // MARK: - Properties
    
    private var awsCliPath: String?
    private let exportDirectory: URL
    
    init() {
        guard let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            fatalError("Could not access Application Support directory")
        }
        exportDirectory = appSupport
            .appendingPathComponent("RadiantDeployer")
            .appendingPathComponent("exports")
            .appendingPathComponent("dynamodb")
        
        try? FileManager.default.createDirectory(at: exportDirectory, withIntermediateDirectories: true)
        
        Task {
            await findAwsCli()
        }
    }
    
    // MARK: - Tool Discovery
    
    private func findAwsCli() async {
        let searchPaths = [
            "/opt/homebrew/bin/aws",
            "/usr/local/bin/aws",
            "/usr/bin/aws"
        ]
        
        for path in searchPaths {
            if FileManager.default.fileExists(atPath: path) {
                awsCliPath = path
                break
            }
        }
    }
    
    func isAwsCliAvailable() async -> Bool {
        await findAwsCli()
        return awsCliPath != nil
    }
    
    // MARK: - List Tables
    
    func listTables(
        region: String,
        appPrefix: String
    ) async throws -> [TableInfo] {
        guard let awsCli = awsCliPath else {
            throw ExportError.awsCliNotFound
        }
        
        // List all tables
        let listProcess = Process()
        listProcess.executableURL = URL(fileURLWithPath: awsCli)
        listProcess.arguments = [
            "dynamodb", "list-tables",
            "--region", region,
            "--output", "json"
        ]
        
        let listPipe = Pipe()
        listProcess.standardOutput = listPipe
        
        try listProcess.run()
        listProcess.waitUntilExit()
        
        let listData = listPipe.fileHandleForReading.readDataToEndOfFile()
        
        struct ListTablesResponse: Codable {
            let TableNames: [String]
        }
        
        let listResponse = try JSONDecoder().decode(ListTablesResponse.self, from: listData)
        
        // Filter by app prefix and get details
        var tables: [TableInfo] = []
        
        for tableName in listResponse.TableNames where tableName.hasPrefix(appPrefix) {
            if let info = try? await getTableInfo(tableName: tableName, region: region) {
                tables.append(info)
            }
        }
        
        return tables.sorted { $0.tableName < $1.tableName }
    }
    
    private func getTableInfo(tableName: String, region: String) async throws -> TableInfo {
        guard let awsCli = awsCliPath else {
            throw ExportError.awsCliNotFound
        }
        
        let process = Process()
        process.executableURL = URL(fileURLWithPath: awsCli)
        process.arguments = [
            "dynamodb", "describe-table",
            "--table-name", tableName,
            "--region", region,
            "--output", "json"
        ]
        
        let pipe = Pipe()
        process.standardOutput = pipe
        
        try process.run()
        process.waitUntilExit()
        
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        
        struct DescribeTableResponse: Codable {
            let Table: TableDescription
            
            struct TableDescription: Codable {
                let TableName: String
                let TableArn: String
                let ItemCount: Int64
                let TableSizeBytes: Int64
                let TableStatus: String
                let CreationDateTime: Double
                let KeySchema: [KeySchemaItem]
                let ProvisionedThroughput: ProvisionedThroughputInfo?
                let BillingModeSummary: BillingModeInfo?
                
                struct KeySchemaItem: Codable {
                    let AttributeName: String
                    let KeyType: String
                }
                
                struct ProvisionedThroughputInfo: Codable {
                    let ReadCapacityUnits: Int
                    let WriteCapacityUnits: Int
                }
                
                struct BillingModeInfo: Codable {
                    let BillingMode: String?
                }
            }
        }
        
        let response = try JSONDecoder().decode(DescribeTableResponse.self, from: data)
        let table = response.Table
        
        return TableInfo(
            tableName: table.TableName,
            tableArn: table.TableArn,
            itemCount: table.ItemCount,
            sizeBytes: table.TableSizeBytes,
            status: table.TableStatus,
            createdAt: Date(timeIntervalSince1970: table.CreationDateTime),
            keySchema: table.KeySchema.map { TableInfo.KeySchemaElement(attributeName: $0.AttributeName, keyType: $0.KeyType) },
            provisionedThroughput: table.ProvisionedThroughput.map {
                TableInfo.ProvisionedThroughput(readCapacityUnits: $0.ReadCapacityUnits, writeCapacityUnits: $0.WriteCapacityUnits)
            },
            billingMode: table.BillingModeSummary?.BillingMode ?? "PROVISIONED"
        )
    }
    
    // MARK: - Export
    
    func exportTables(
        region: String,
        appPrefix: String,
        options: ExportOptions,
        progressHandler: (@Sendable (Double, String) -> Void)? = nil
    ) async throws -> ExportResult {
        guard let awsCli = awsCliPath else {
            throw ExportError.awsCliNotFound
        }
        
        let exportId = UUID().uuidString
        let timestamp = ISO8601DateFormatter().string(from: Date())
        let fileName = "\(appPrefix)_dynamodb_\(options.mode.rawValue)_\(timestamp).json"
        let outputPath = exportDirectory.appendingPathComponent(fileName)
        
        progressHandler?(0.1, "Listing tables...")
        
        // Get tables to export
        let allTables = try await listTables(region: region, appPrefix: appPrefix)
        let tablesToExport: [TableInfo]
        
        switch options.mode {
        case .sessionTables:
            tablesToExport = allTables.filter { table in
                Self.sessionTablePatterns.contains { pattern in
                    matchesPattern(table.tableName, pattern: pattern)
                }
            }
        case .cacheTables:
            tablesToExport = allTables.filter { table in
                Self.cacheTablePatterns.contains { pattern in
                    matchesPattern(table.tableName, pattern: pattern)
                }
            }
        case .configTables:
            tablesToExport = allTables.filter { table in
                Self.configTablePatterns.contains { pattern in
                    matchesPattern(table.tableName, pattern: pattern)
                }
            }
        case .allTables:
            tablesToExport = allTables
        case .selectedTables:
            tablesToExport = allTables.filter { options.selectedTables.contains($0.tableName) }
        }
        
        if tablesToExport.isEmpty {
            throw ExportError.exportFailed("No tables match the selected criteria")
        }
        
        progressHandler?(0.2, "Exporting \(tablesToExport.count) tables...")
        
        let startTime = Date()
        var exportData: [String: [[String: Any]]] = [:]
        var tableInfos: [ExportResult.TableExportInfo] = []
        
        for (index, table) in tablesToExport.enumerated() {
            let progress = 0.2 + (0.7 * Double(index) / Double(tablesToExport.count))
            progressHandler?(progress, "Exporting \(table.tableName)...")
            
            let items = try await scanTable(
                tableName: table.tableName,
                region: region,
                maxItems: options.maxItemsPerTable
            )
            
            exportData[table.tableName] = items
            tableInfos.append(ExportResult.TableExportInfo(
                tableName: table.tableName,
                itemCount: Int64(items.count),
                sizeBytes: table.sizeBytes
            ))
        }
        
        progressHandler?(0.9, "Writing export file...")
        
        // Create export manifest
        let manifest: [String: Any] = [
            "exportId": exportId,
            "createdAt": ISO8601DateFormatter().string(from: Date()),
            "mode": options.mode.rawValue,
            "region": region,
            "appPrefix": appPrefix,
            "radiantVersion": RADIANT_VERSION,
            "tables": exportData
        ]
        
        let jsonData = try JSONSerialization.data(withJSONObject: manifest, options: [.prettyPrinted, .sortedKeys])
        
        var finalPath = outputPath
        if options.compressOutput {
            let compressedPath = outputPath.appendingPathExtension("gz")
            try jsonData.write(to: outputPath)
            finalPath = try await compressFile(outputPath)
            try? FileManager.default.removeItem(at: outputPath)
        } else {
            try jsonData.write(to: outputPath)
        }
        
        // Calculate checksum
        let checksum = try await calculateChecksum(for: finalPath)
        
        let fileAttributes = try FileManager.default.attributesOfItem(atPath: finalPath.path)
        let fileSize = fileAttributes[.size] as? Int64 ?? 0
        
        let duration = Date().timeIntervalSince(startTime)
        
        progressHandler?(1.0, "Export complete")
        
        // Log to audit
        await AuditLogger.shared.log(
            action: .snapshotCreated,
            details: "DynamoDB export: \(options.mode.displayName) - \(tablesToExport.count) tables",
            metadata: [
                "exportId": exportId,
                "mode": options.mode.rawValue,
                "tableCount": String(tablesToExport.count)
            ]
        )
        
        return ExportResult(
            id: exportId,
            createdAt: Date(),
            mode: options.mode,
            filePath: finalPath.path,
            fileSize: fileSize,
            tables: tableInfos,
            duration: duration,
            checksum: checksum
        )
    }
    
    private func scanTable(
        tableName: String,
        region: String,
        maxItems: Int?
    ) async throws -> [[String: Any]] {
        guard let awsCli = awsCliPath else {
            throw ExportError.awsCliNotFound
        }
        
        var items: [[String: Any]] = []
        var lastEvaluatedKey: String? = nil
        
        repeat {
            var arguments = [
                "dynamodb", "scan",
                "--table-name", tableName,
                "--region", region,
                "--output", "json"
            ]
            
            if let key = lastEvaluatedKey {
                arguments.append(contentsOf: ["--exclusive-start-key", key])
            }
            
            if let max = maxItems {
                arguments.append(contentsOf: ["--limit", String(max - items.count)])
            }
            
            let process = Process()
            process.executableURL = URL(fileURLWithPath: awsCli)
            process.arguments = arguments
            
            let pipe = Pipe()
            process.standardOutput = pipe
            
            try process.run()
            process.waitUntilExit()
            
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            
            if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
               let scannedItems = json["Items"] as? [[String: Any]] {
                items.append(contentsOf: scannedItems)
                
                if let nextKey = json["LastEvaluatedKey"] {
                    lastEvaluatedKey = String(data: try JSONSerialization.data(withJSONObject: nextKey), encoding: .utf8)
                } else {
                    lastEvaluatedKey = nil
                }
            } else {
                break
            }
            
            if let max = maxItems, items.count >= max {
                break
            }
        } while lastEvaluatedKey != nil
        
        return items
    }
    
    // MARK: - Import
    
    func importTables(
        region: String,
        filePath: String,
        options: ImportOptions,
        progressHandler: (@Sendable (Double, String) -> Void)? = nil
    ) async throws -> ImportResult {
        guard let awsCli = awsCliPath else {
            throw ExportError.awsCliNotFound
        }
        
        guard FileManager.default.fileExists(atPath: filePath) else {
            throw ExportError.fileNotFound(filePath)
        }
        
        let importId = UUID().uuidString
        var inputPath = filePath
        
        progressHandler?(0.1, "Preparing import...")
        
        // Decompress if needed
        if filePath.hasSuffix(".gz") {
            progressHandler?(0.15, "Decompressing...")
            inputPath = try await decompressFile(URL(fileURLWithPath: filePath)).path
        }
        
        // Load export data
        let data = try Data(contentsOf: URL(fileURLWithPath: inputPath))
        guard let manifest = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let tables = manifest["tables"] as? [String: [[String: Any]]] else {
            throw ExportError.invalidFormat
        }
        
        if options.dryRun {
            progressHandler?(1.0, "Dry run complete - no changes made")
            return ImportResult(
                id: importId,
                importedAt: Date(),
                filePath: filePath,
                tablesImported: tables.count,
                itemsImported: Int64(tables.values.reduce(0) { $0 + $1.count }),
                duration: 0,
                warnings: ["Dry run mode - no changes applied"],
                errors: []
            )
        }
        
        let startTime = Date()
        var warnings: [String] = []
        var errors: [String] = []
        var totalItems: Int64 = 0
        
        let tableCount = tables.count
        for (index, (tableName, items)) in tables.enumerated() {
            let progress = 0.2 + (0.7 * Double(index) / Double(tableCount))
            let finalTableName = (options.tableNamePrefix ?? "") + tableName
            progressHandler?(progress, "Importing \(finalTableName)...")
            
            // Check if table exists
            let tableExists = await checkTableExists(tableName: finalTableName, region: options.targetRegion ?? region)
            
            if !tableExists && options.createTablesIfNotExist {
                // Would need table schema to create - skip for now with warning
                warnings.append("Table \(finalTableName) does not exist and schema not available")
                continue
            } else if !tableExists {
                errors.append("Table \(finalTableName) does not exist")
                continue
            }
            
            // Batch write items
            let batches = items.chunked(into: options.batchSize)
            for batch in batches {
                do {
                    try await batchWriteItems(
                        tableName: finalTableName,
                        items: batch,
                        region: options.targetRegion ?? region
                    )
                    totalItems += Int64(batch.count)
                } catch {
                    if options.skipConflicts {
                        warnings.append("Some items in \(finalTableName) skipped: \(error.localizedDescription)")
                    } else {
                        errors.append("Failed to write to \(finalTableName): \(error.localizedDescription)")
                    }
                }
            }
        }
        
        let duration = Date().timeIntervalSince(startTime)
        
        progressHandler?(1.0, "Import complete")
        
        // Log to audit
        await AuditLogger.shared.log(
            action: .snapshotCreated,
            details: "DynamoDB import completed: \(tables.count) tables",
            metadata: [
                "importId": importId,
                "tablesImported": String(tables.count),
                "itemsImported": String(totalItems)
            ]
        )
        
        return ImportResult(
            id: importId,
            importedAt: Date(),
            filePath: filePath,
            tablesImported: tables.count,
            itemsImported: totalItems,
            duration: duration,
            warnings: warnings,
            errors: errors
        )
    }
    
    private func checkTableExists(tableName: String, region: String) async -> Bool {
        guard let awsCli = awsCliPath else { return false }
        
        let process = Process()
        process.executableURL = URL(fileURLWithPath: awsCli)
        process.arguments = [
            "dynamodb", "describe-table",
            "--table-name", tableName,
            "--region", region,
            "--output", "json"
        ]
        
        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = Pipe()
        
        do {
            try process.run()
            process.waitUntilExit()
            return process.terminationStatus == 0
        } catch {
            return false
        }
    }
    
    private func batchWriteItems(
        tableName: String,
        items: [[String: Any]],
        region: String
    ) async throws {
        guard let awsCli = awsCliPath else {
            throw ExportError.awsCliNotFound
        }
        
        let requestItems: [String: Any] = [
            tableName: items.map { ["PutRequest": ["Item": $0]] }
        ]
        
        let requestData = try JSONSerialization.data(withJSONObject: ["RequestItems": requestItems])
        let tempFile = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".json")
        try requestData.write(to: tempFile)
        
        defer {
            try? FileManager.default.removeItem(at: tempFile)
        }
        
        let process = Process()
        process.executableURL = URL(fileURLWithPath: awsCli)
        process.arguments = [
            "dynamodb", "batch-write-item",
            "--request-items", "file://\(tempFile.path)",
            "--region", region
        ]
        
        let errorPipe = Pipe()
        process.standardError = errorPipe
        
        try process.run()
        process.waitUntilExit()
        
        if process.terminationStatus != 0 {
            let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
            let errorMessage = String(data: errorData, encoding: .utf8) ?? "Unknown error"
            throw ExportError.importFailed(errorMessage)
        }
    }
    
    // MARK: - Helper Methods
    
    private func matchesPattern(_ string: String, pattern: String) -> Bool {
        let regexPattern = pattern
            .replacingOccurrences(of: "*", with: ".*")
            .replacingOccurrences(of: "?", with: ".")
        
        guard let regex = try? NSRegularExpression(pattern: "^\(regexPattern)$", options: []) else {
            return false
        }
        
        let range = NSRange(string.startIndex..., in: string)
        return regex.firstMatch(in: string, options: [], range: range) != nil
    }
    
    private func compressFile(_ fileURL: URL) async throws -> URL {
        let compressedURL = fileURL.appendingPathExtension("gz")
        
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/gzip")
        process.arguments = ["-c", fileURL.path]
        
        FileManager.default.createFile(atPath: compressedURL.path, contents: nil)
        let output = try FileHandle(forWritingTo: compressedURL)
        process.standardOutput = output
        
        try process.run()
        process.waitUntilExit()
        
        try output.close()
        
        return compressedURL
    }
    
    private func decompressFile(_ fileURL: URL) async throws -> URL {
        let decompressedURL = fileURL.deletingPathExtension()
        
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/gunzip")
        process.arguments = ["-c", fileURL.path]
        
        FileManager.default.createFile(atPath: decompressedURL.path, contents: nil)
        let output = try FileHandle(forWritingTo: decompressedURL)
        process.standardOutput = output
        
        try process.run()
        process.waitUntilExit()
        
        try output.close()
        
        return decompressedURL
    }
    
    private func calculateChecksum(for fileURL: URL) async throws -> String {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/shasum")
        process.arguments = ["-a", "256", fileURL.path]
        
        let pipe = Pipe()
        process.standardOutput = pipe
        
        try process.run()
        process.waitUntilExit()
        
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        let output = String(data: data, encoding: .utf8) ?? ""
        return output.components(separatedBy: " ").first ?? ""
    }
    
    // MARK: - List Exports
    
    func listExports() async -> [ExportResult] {
        var results: [ExportResult] = []
        
        guard let files = try? FileManager.default.contentsOfDirectory(
            at: exportDirectory,
            includingPropertiesForKeys: [.fileSizeKey, .creationDateKey]
        ) else {
            return results
        }
        
        for file in files where file.pathExtension == "json" || file.lastPathComponent.contains(".json.gz") {
            if let attributes = try? FileManager.default.attributesOfItem(atPath: file.path),
               let size = attributes[.size] as? Int64,
               let createdAt = attributes[.creationDate] as? Date {
                
                let fileName = file.lastPathComponent
                let mode: ExportMode = fileName.contains("session") ? .sessionTables :
                                       fileName.contains("cache") ? .cacheTables :
                                       fileName.contains("config") ? .configTables :
                                       fileName.contains("all") ? .allTables : .selectedTables
                
                results.append(ExportResult(
                    id: UUID().uuidString,
                    createdAt: createdAt,
                    mode: mode,
                    filePath: file.path,
                    fileSize: size,
                    tables: [],
                    duration: 0,
                    checksum: ""
                ))
            }
        }
        
        return results.sorted { $0.createdAt > $1.createdAt }
    }
    
    func deleteExport(at path: String) async throws {
        try FileManager.default.removeItem(atPath: path)
        
        await AuditLogger.shared.log(
            action: .snapshotDeleted,
            details: "DynamoDB export deleted: \(path)"
        )
    }
}

// MARK: - Array Extension

private extension Array {
    func chunked(into size: Int) -> [[Element]] {
        stride(from: 0, to: count, by: size).map {
            Array(self[$0..<Swift.min($0 + size, count)])
        }
    }
}

// MARK: - Version Constant
// Uses RADIANT_VERSION from Deployment.swift
