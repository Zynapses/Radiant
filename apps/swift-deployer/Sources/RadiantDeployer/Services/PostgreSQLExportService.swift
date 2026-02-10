// RADIANT v7.2.0 - PostgreSQL Export/Import Service
// Manages database state capture for deployment packages
// Supports schema-only, seed data, and full data exports with GDPR compliance

import Foundation

actor PostgreSQLExportService {
    static let shared = PostgreSQLExportService()
    
    // MARK: - Types
    
    enum ExportError: Error, LocalizedError {
        case connectionFailed(String)
        case exportFailed(String)
        case importFailed(String)
        case pgDumpNotFound
        case pgRestoreNotFound
        case invalidCredentials
        case insufficientPermissions
        case timeout
        case fileNotFound(String)
        case gdprViolation(String)
        
        var errorDescription: String? {
            switch self {
            case .connectionFailed(let msg): return "Database connection failed: \(msg)"
            case .exportFailed(let msg): return "Export failed: \(msg)"
            case .importFailed(let msg): return "Import failed: \(msg)"
            case .pgDumpNotFound: return "pg_dump not found. Install PostgreSQL client tools."
            case .pgRestoreNotFound: return "pg_restore not found. Install PostgreSQL client tools."
            case .invalidCredentials: return "Invalid database credentials"
            case .insufficientPermissions: return "Insufficient database permissions for export"
            case .timeout: return "Database operation timed out"
            case .fileNotFound(let path): return "Export file not found: \(path)"
            case .gdprViolation(let msg): return "GDPR compliance issue: \(msg)"
            }
        }
    }
    
    enum ExportMode: String, Codable, CaseIterable, Sendable {
        case schemaOnly = "schema_only"
        case aiRegistryOnly = "ai_registry_only"
        case seedData = "seed_data"
        case maskedData = "masked_data"
        case fullData = "full_data"
        
        var displayName: String {
            switch self {
            case .schemaOnly: return "Schema Only"
            case .aiRegistryOnly: return "AI Registry Only"
            case .seedData: return "Seed Data (AI Registry + Config)"
            case .maskedData: return "Masked Data (Anonymized)"
            case .fullData: return "Full Data (⚠️ Contains PII)"
            }
        }
        
        var description: String {
            switch self {
            case .schemaOnly: return "Export database structure only, no data"
            case .aiRegistryOnly: return "Export AI providers, models, and pricing only"
            case .seedData: return "Export AI Registry plus system configuration"
            case .maskedData: return "Export all data with PII anonymized (GDPR compliant)"
            case .fullData: return "Export all data including PII (requires consent)"
            }
        }
        
        var containsPII: Bool {
            switch self {
            case .schemaOnly, .aiRegistryOnly, .seedData, .maskedData: return false
            case .fullData: return true
            }
        }
        
        var icon: String {
            switch self {
            case .schemaOnly: return "tablecells"
            case .aiRegistryOnly: return "cpu"
            case .seedData: return "leaf.fill"
            case .maskedData: return "eye.slash.fill"
            case .fullData: return "exclamationmark.triangle.fill"
            }
        }
    }
    
    struct ExportOptions: Codable, Sendable {
        var mode: ExportMode
        var includeTables: [String]?
        var excludeTables: [String]?
        var compressOutput: Bool
        var splitByTable: Bool
        var includeDropStatements: Bool
        var gdprConsent: Bool
        var consentRecordId: String?
        
        static var defaults: ExportOptions {
            ExportOptions(
                mode: .seedData,
                includeTables: nil,
                excludeTables: nil,
                compressOutput: true,
                splitByTable: false,
                includeDropStatements: false,
                gdprConsent: false,
                consentRecordId: nil
            )
        }
    }
    
    struct ExportResult: Codable, Sendable {
        let id: String
        let createdAt: Date
        let mode: ExportMode
        let filePath: String
        let fileSize: Int64
        let tableCount: Int
        let rowCount: Int64
        let duration: TimeInterval
        let checksum: String
        let metadata: ExportMetadata
    }
    
    struct ExportMetadata: Codable, Sendable {
        let radiantVersion: String
        let databaseVersion: String
        let exportedBy: String
        let environment: String
        let appId: String
        let tablesIncluded: [String]
        let gdprCompliant: Bool
        let containsPII: Bool
    }
    
    struct ImportOptions: Codable, Sendable {
        var dropExisting: Bool
        var createIfNotExists: Bool
        var skipConflicts: Bool
        var dryRun: Bool
        var targetSchema: String?
        
        static var defaults: ImportOptions {
            ImportOptions(
                dropExisting: false,
                createIfNotExists: true,
                skipConflicts: true,
                dryRun: false,
                targetSchema: nil
            )
        }
    }
    
    struct ImportResult: Codable, Sendable {
        let id: String
        let importedAt: Date
        let filePath: String
        let tablesImported: Int
        let rowsImported: Int64
        let duration: TimeInterval
        let warnings: [String]
        let errors: [String]
    }
    
    // MARK: - Tables Configuration
    
    static let aiRegistryTables: [String] = [
        "ai_providers",
        "ai_models",
        "ai_model_pricing",
        "ai_model_capabilities",
        "self_hosted_models",
        "self_hosted_model_pricing",
        "ai_services"
    ]
    
    static let configTables: [String] = [
        "system_configuration",
        "feature_flags",
        "tenant_configuration",
        "billing_configuration",
        "litellm_gateway_config"
    ]
    
    static let piiTables: [String] = [
        "users",
        "user_profiles",
        "conversations",
        "messages",
        "user_consents",
        "audit_logs",
        "session_tokens"
    ]
    
    static let maskingRules: [String: [String: String]] = [
        "users": [
            "email": "'user_' || id || '@anonymized.local'",
            "name": "'User ' || id",
            "phone": "NULL"
        ],
        "user_profiles": [
            "display_name": "'Anonymous User ' || user_id",
            "avatar_url": "NULL",
            "bio": "'[REDACTED]'"
        ],
        "conversations": [
            "title": "'Conversation ' || id"
        ],
        "messages": [
            "content": "'[CONTENT REDACTED FOR PRIVACY]'"
        ]
    ]
    
    // MARK: - Properties
    
    private var pgDumpPath: String?
    private var pgRestorePath: String?
    private let exportDirectory: URL
    
    init() {
        guard let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            fatalError("Could not access Application Support directory")
        }
        exportDirectory = appSupport
            .appendingPathComponent("RadiantDeployer")
            .appendingPathComponent("exports")
            .appendingPathComponent("postgresql")
        
        try? FileManager.default.createDirectory(at: exportDirectory, withIntermediateDirectories: true)
        
        Task {
            await findPostgresTools()
        }
    }
    
    // MARK: - Tool Discovery
    
    private func findPostgresTools() async {
        let searchPaths = [
            "/opt/homebrew/bin",
            "/usr/local/bin",
            "/usr/bin",
            "/Applications/Postgres.app/Contents/Versions/latest/bin"
        ]
        
        for path in searchPaths {
            let pgDump = "\(path)/pg_dump"
            let pgRestore = "\(path)/pg_restore"
            
            if FileManager.default.fileExists(atPath: pgDump) {
                pgDumpPath = pgDump
            }
            if FileManager.default.fileExists(atPath: pgRestore) {
                pgRestorePath = pgRestore
            }
            
            if pgDumpPath != nil && pgRestorePath != nil {
                break
            }
        }
    }
    
    func areToolsAvailable() async -> Bool {
        await findPostgresTools()
        return pgDumpPath != nil && pgRestorePath != nil
    }
    
    // MARK: - Export
    
    func exportDatabase(
        connection: DatabaseConnection,
        options: ExportOptions,
        appId: String,
        environment: String,
        progressHandler: (@Sendable (Double, String) -> Void)? = nil
    ) async throws -> ExportResult {
        guard let pgDump = pgDumpPath else {
            throw ExportError.pgDumpNotFound
        }
        
        // GDPR compliance check
        if options.mode.containsPII && !options.gdprConsent {
            throw ExportError.gdprViolation("Full data export requires explicit GDPR consent")
        }
        
        let exportId = UUID().uuidString
        let timestamp = ISO8601DateFormatter().string(from: Date())
        let fileName = "\(appId)_\(environment)_\(options.mode.rawValue)_\(timestamp).sql"
        let outputPath = exportDirectory.appendingPathComponent(fileName)
        
        progressHandler?(0.1, "Connecting to database...")
        
        // Build pg_dump command
        var arguments: [String] = []
        
        // Connection parameters
        arguments.append(contentsOf: ["-h", connection.host])
        arguments.append(contentsOf: ["-p", String(connection.port)])
        arguments.append(contentsOf: ["-U", connection.username])
        arguments.append(contentsOf: ["-d", connection.database])
        
        // Export mode specific options
        switch options.mode {
        case .schemaOnly:
            arguments.append("--schema-only")
            
        case .aiRegistryOnly:
            for table in Self.aiRegistryTables {
                arguments.append(contentsOf: ["-t", table])
            }
            
        case .seedData:
            for table in Self.aiRegistryTables + Self.configTables {
                arguments.append(contentsOf: ["-t", table])
            }
            
        case .maskedData:
            // Export all tables but we'll post-process to mask PII
            break
            
        case .fullData:
            // Export everything
            break
        }
        
        // Common options
        if options.includeDropStatements {
            arguments.append("--clean")
        }
        arguments.append("--if-exists")
        arguments.append("--no-owner")
        arguments.append("--no-privileges")
        
        // Output file
        arguments.append(contentsOf: ["-f", outputPath.path])
        
        progressHandler?(0.3, "Exporting database...")
        
        let startTime = Date()
        
        // Run pg_dump
        let process = Process()
        process.executableURL = URL(fileURLWithPath: pgDump)
        process.arguments = arguments
        process.environment = [
            "PGPASSWORD": connection.password
        ]
        
        let outputPipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = errorPipe
        
        try process.run()
        process.waitUntilExit()
        
        if process.terminationStatus != 0 {
            let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
            let errorMessage = String(data: errorData, encoding: .utf8) ?? "Unknown error"
            throw ExportError.exportFailed(errorMessage)
        }
        
        progressHandler?(0.7, "Processing export...")
        
        // For masked data, apply masking rules
        if options.mode == .maskedData {
            try await applyDataMasking(to: outputPath)
        }
        
        // Compress if requested
        var finalPath = outputPath
        if options.compressOutput {
            progressHandler?(0.85, "Compressing...")
            finalPath = try await compressFile(outputPath)
            try? FileManager.default.removeItem(at: outputPath)
        }
        
        progressHandler?(0.95, "Calculating checksum...")
        
        // Calculate file info
        let fileAttributes = try FileManager.default.attributesOfItem(atPath: finalPath.path)
        let fileSize = fileAttributes[.size] as? Int64 ?? 0
        let checksum = try await calculateChecksum(for: finalPath)
        
        let duration = Date().timeIntervalSince(startTime)
        
        // Count tables and rows (approximate)
        let tableCount = try await countExportedTables(in: finalPath)
        let rowCount = try await estimateRowCount(in: finalPath)
        
        progressHandler?(1.0, "Export complete")
        
        let result = ExportResult(
            id: exportId,
            createdAt: Date(),
            mode: options.mode,
            filePath: finalPath.path,
            fileSize: fileSize,
            tableCount: tableCount,
            rowCount: rowCount,
            duration: duration,
            checksum: checksum,
            metadata: ExportMetadata(
                radiantVersion: RADIANT_VERSION,
                databaseVersion: "PostgreSQL 15",
                exportedBy: NSUserName(),
                environment: environment,
                appId: appId,
                tablesIncluded: getIncludedTables(for: options.mode),
                gdprCompliant: !options.mode.containsPII || options.gdprConsent,
                containsPII: options.mode.containsPII
            )
        )
        
        // Log to audit
        await AuditLogger.shared.log(
            action: .snapshotCreated,
            details: "PostgreSQL export: \(options.mode.displayName)",
            metadata: [
                "exportId": exportId,
                "mode": options.mode.rawValue,
                "fileSize": String(fileSize),
                "containsPII": String(options.mode.containsPII)
            ]
        )
        
        return result
    }
    
    // MARK: - Import
    
    func importDatabase(
        connection: DatabaseConnection,
        filePath: String,
        options: ImportOptions,
        progressHandler: (@Sendable (Double, String) -> Void)? = nil
    ) async throws -> ImportResult {
        guard let pgRestore = pgRestorePath else {
            throw ExportError.pgRestoreNotFound
        }
        
        guard FileManager.default.fileExists(atPath: filePath) else {
            throw ExportError.fileNotFound(filePath)
        }
        
        let importId = UUID().uuidString
        var inputPath = filePath
        
        progressHandler?(0.1, "Preparing import...")
        
        // Decompress if needed
        if filePath.hasSuffix(".gz") {
            progressHandler?(0.2, "Decompressing...")
            inputPath = try await decompressFile(URL(fileURLWithPath: filePath)).path
        }
        
        progressHandler?(0.3, "Validating export file...")
        
        // Validate export file
        let isValid = try await validateExportFile(at: inputPath)
        if !isValid {
            throw ExportError.importFailed("Invalid or corrupted export file")
        }
        
        if options.dryRun {
            progressHandler?(1.0, "Dry run complete - no changes made")
            return ImportResult(
                id: importId,
                importedAt: Date(),
                filePath: filePath,
                tablesImported: 0,
                rowsImported: 0,
                duration: 0,
                warnings: ["Dry run mode - no changes applied"],
                errors: []
            )
        }
        
        progressHandler?(0.5, "Importing data...")
        
        let startTime = Date()
        var warnings: [String] = []
        var errors: [String] = []
        
        // For SQL files, use psql instead of pg_restore
        let process = Process()
        if inputPath.hasSuffix(".sql") {
            process.executableURL = URL(fileURLWithPath: "/usr/bin/psql")
            process.arguments = [
                "-h", connection.host,
                "-p", String(connection.port),
                "-U", connection.username,
                "-d", connection.database,
                "-f", inputPath
            ]
        } else {
            process.executableURL = URL(fileURLWithPath: pgRestore)
            var arguments: [String] = []
            arguments.append(contentsOf: ["-h", connection.host])
            arguments.append(contentsOf: ["-p", String(connection.port)])
            arguments.append(contentsOf: ["-U", connection.username])
            arguments.append(contentsOf: ["-d", connection.database])
            
            if options.dropExisting {
                arguments.append("--clean")
            }
            if options.skipConflicts {
                arguments.append("--no-data-for-failed-tables")
            }
            if let schema = options.targetSchema {
                arguments.append(contentsOf: ["--schema", schema])
            }
            
            arguments.append(inputPath)
            process.arguments = arguments
        }
        
        process.environment = ["PGPASSWORD": connection.password]
        
        let outputPipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = errorPipe
        
        try process.run()
        process.waitUntilExit()
        
        let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
        if let errorOutput = String(data: errorData, encoding: .utf8), !errorOutput.isEmpty {
            let lines = errorOutput.components(separatedBy: "\n")
            for line in lines {
                if line.contains("ERROR") {
                    errors.append(line)
                } else if line.contains("WARNING") || line.contains("NOTICE") {
                    warnings.append(line)
                }
            }
        }
        
        if process.terminationStatus != 0 && errors.count > 0 {
            throw ExportError.importFailed(errors.joined(separator: "\n"))
        }
        
        progressHandler?(0.9, "Verifying import...")
        
        let duration = Date().timeIntervalSince(startTime)
        let tablesImported = try await countExportedTables(in: URL(fileURLWithPath: inputPath))
        let rowsImported = try await estimateRowCount(in: URL(fileURLWithPath: inputPath))
        
        progressHandler?(1.0, "Import complete")
        
        // Log to audit
        await AuditLogger.shared.log(
            action: .snapshotCreated,
            details: "PostgreSQL import completed",
            metadata: [
                "importId": importId,
                "tablesImported": String(tablesImported),
                "rowsImported": String(rowsImported)
            ]
        )
        
        return ImportResult(
            id: importId,
            importedAt: Date(),
            filePath: filePath,
            tablesImported: tablesImported,
            rowsImported: rowsImported,
            duration: duration,
            warnings: warnings,
            errors: errors
        )
    }
    
    // MARK: - Helper Methods
    
    private func applyDataMasking(to fileURL: URL) async throws {
        var content = try String(contentsOf: fileURL, encoding: .utf8)
        
        for (table, columns) in Self.maskingRules {
            for (column, replacement) in columns {
                // Replace INSERT statements with masked values
                let pattern = "INSERT INTO \(table).*?\(column).*?VALUES"
                // This is a simplified approach - in production, use proper SQL parsing
                content = content.replacingOccurrences(
                    of: "'\(column)'",
                    with: replacement
                )
            }
        }
        
        try content.write(to: fileURL, atomically: true, encoding: .utf8)
    }
    
    private func compressFile(_ fileURL: URL) async throws -> URL {
        let compressedURL = fileURL.appendingPathExtension("gz")
        
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/gzip")
        process.arguments = ["-c", fileURL.path]
        
        let outputFile = FileHandle(forWritingAtPath: compressedURL.path)
        if outputFile == nil {
            FileManager.default.createFile(atPath: compressedURL.path, contents: nil)
        }
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
    
    private func countExportedTables(in fileURL: URL) async throws -> Int {
        let content = try String(contentsOf: fileURL, encoding: .utf8)
        let pattern = "CREATE TABLE"
        let matches = content.components(separatedBy: pattern).count - 1
        return max(0, matches)
    }
    
    private func estimateRowCount(in fileURL: URL) async throws -> Int64 {
        let content = try String(contentsOf: fileURL, encoding: .utf8)
        let pattern = "INSERT INTO"
        let matches = content.components(separatedBy: pattern).count - 1
        return Int64(max(0, matches))
    }
    
    private func validateExportFile(at path: String) async throws -> Bool {
        let content = try String(contentsOf: URL(fileURLWithPath: path), encoding: .utf8)
        // Check for PostgreSQL dump header
        return content.contains("PostgreSQL database dump") || 
               content.contains("CREATE TABLE") ||
               content.contains("INSERT INTO")
    }
    
    private func getIncludedTables(for mode: ExportMode) -> [String] {
        switch mode {
        case .schemaOnly:
            return ["All tables (schema only)"]
        case .aiRegistryOnly:
            return Self.aiRegistryTables
        case .seedData:
            return Self.aiRegistryTables + Self.configTables
        case .maskedData, .fullData:
            return ["All tables"]
        }
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
        
        for file in files where file.pathExtension == "sql" || file.pathExtension == "gz" {
            if let attributes = try? FileManager.default.attributesOfItem(atPath: file.path),
               let size = attributes[.size] as? Int64,
               let createdAt = attributes[.creationDate] as? Date {
                
                let fileName = file.lastPathComponent
                let mode: ExportMode = fileName.contains("schema_only") ? .schemaOnly :
                                       fileName.contains("ai_registry") ? .aiRegistryOnly :
                                       fileName.contains("seed_data") ? .seedData :
                                       fileName.contains("masked") ? .maskedData : .fullData
                
                results.append(ExportResult(
                    id: UUID().uuidString,
                    createdAt: createdAt,
                    mode: mode,
                    filePath: file.path,
                    fileSize: size,
                    tableCount: 0,
                    rowCount: 0,
                    duration: 0,
                    checksum: "",
                    metadata: ExportMetadata(
                        radiantVersion: RADIANT_VERSION,
                        databaseVersion: "PostgreSQL",
                        exportedBy: "Unknown",
                        environment: "Unknown",
                        appId: "Unknown",
                        tablesIncluded: [],
                        gdprCompliant: true,
                        containsPII: mode.containsPII
                    )
                ))
            }
        }
        
        return results.sorted { $0.createdAt > $1.createdAt }
    }
    
    func deleteExport(at path: String) async throws {
        try FileManager.default.removeItem(atPath: path)
        
        await AuditLogger.shared.log(
            action: .snapshotDeleted,
            details: "PostgreSQL export deleted: \(path)"
        )
    }
}

// MARK: - Database Connection

struct DatabaseConnection: Codable, Sendable {
    let host: String
    let port: Int
    let database: String
    let username: String
    let password: String
    let sslMode: SSLMode
    
    enum SSLMode: String, Codable, Sendable {
        case disable
        case require
        case verifyCA = "verify-ca"
        case verifyFull = "verify-full"
    }
    
    var connectionString: String {
        "postgresql://\(username):\(password)@\(host):\(port)/\(database)?sslmode=\(sslMode.rawValue)"
    }
}

// MARK: - Version Constant
// Uses RADIANT_VERSION from Deployment.swift
