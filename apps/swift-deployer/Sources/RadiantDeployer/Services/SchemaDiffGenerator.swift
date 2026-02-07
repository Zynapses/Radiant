// RADIANT - Schema Diff Generator
// Compares extracted instance state with local package and generates migration files

import Foundation

actor SchemaDiffGenerator {
    
    // MARK: - Types
    
    enum DiffType: String, Codable, Sendable {
        case tableAdded = "TABLE_ADDED"
        case tableRemoved = "TABLE_REMOVED"
        case columnAdded = "COLUMN_ADDED"
        case columnRemoved = "COLUMN_REMOVED"
        case columnModified = "COLUMN_MODIFIED"
        case indexAdded = "INDEX_ADDED"
        case indexRemoved = "INDEX_REMOVED"
        case enumAdded = "ENUM_ADDED"
        case enumRemoved = "ENUM_REMOVED"
        case enumValueAdded = "ENUM_VALUE_ADDED"
        case functionAdded = "FUNCTION_ADDED"
        case functionModified = "FUNCTION_MODIFIED"
        case constraintAdded = "CONSTRAINT_ADDED"
        case constraintRemoved = "CONSTRAINT_REMOVED"
    }
    
    struct SchemaDiff: Codable, Sendable {
        let type: DiffType
        let objectName: String
        let tableName: String?
        let details: String
        let upSQL: String      // SQL to apply this change
        let downSQL: String    // SQL to reverse this change
        let isDestructive: Bool
    }
    
    struct DiffReport: Codable, Sendable {
        let generatedAt: Date
        let instanceVersion: String
        let packageVersion: String
        let diffs: [SchemaDiff]
        let generatedMigrationFile: String?
        
        var hasDestructiveChanges: Bool {
            diffs.contains { $0.isDestructive }
        }
        
        var summary: String {
            let added = diffs.filter { $0.type.rawValue.contains("ADDED") }.count
            let removed = diffs.filter { $0.type.rawValue.contains("REMOVED") }.count
            let modified = diffs.filter { $0.type.rawValue.contains("MODIFIED") }.count
            return "\(added) additions, \(modified) modifications, \(removed) removals"
        }
    }
    
    struct LambdaDiff: Codable, Sendable {
        let functionName: String
        let changeType: LambdaChangeType
        let details: String
        let instanceCodePath: String?
        let packageCodePath: String?
    }
    
    enum LambdaChangeType: String, Codable, Sendable {
        case added = "ADDED"
        case removed = "REMOVED"
        case codeChanged = "CODE_CHANGED"
        case configChanged = "CONFIG_CHANGED"
    }
    
    struct FullDiffReport: Codable, Sendable {
        let generatedAt: Date
        let appId: String
        let environment: String
        let instanceVersion: String
        let packageVersion: String
        
        var schemaDiffs: [SchemaDiff]
        var lambdaDiffs: [LambdaDiff]
        var s3Diffs: [String]
        var dynamoDBDiffs: [String]
        
        var canAutoMerge: Bool {
            // Can auto-merge if no destructive changes
            !schemaDiffs.contains { $0.isDestructive }
        }
        
        var requiresManualReview: Bool {
            schemaDiffs.contains { $0.isDestructive } || !lambdaDiffs.isEmpty
        }
    }
    
    // MARK: - Properties
    
    private let outputDirectory: URL
    
    // MARK: - Initialization
    
    init() {
        self.outputDirectory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            .appendingPathComponent("RadiantDeployer")
            .appendingPathComponent("generated-migrations")
        
        try? FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)
    }
    
    // MARK: - Main Diff Generation
    
    /// Compare extracted instance state with local package schema
    func generateDiff(
        extractedState: InstanceStateExtractor.ExtractedInstanceState,
        packagePath: URL,
        onProgress: @escaping (String) -> Void
    ) async throws -> FullDiffReport {
        onProgress("Loading package schema...")
        
        // Load the package's expected schema from migrations
        let packageSchema = try await loadPackageSchema(from: packagePath)
        
        onProgress("Comparing database schemas...")
        let schemaDiffs = compareSchemas(
            instance: extractedState.databaseSchema,
            package: packageSchema
        )
        
        onProgress("Comparing Lambda functions...")
        let lambdaDiffs = try await compareLambdas(
            instance: extractedState.lambdaFunctions,
            packagePath: packagePath
        )
        
        onProgress("Comparing DynamoDB tables...")
        let dynamoDBDiffs = compareDynamoDB(
            instance: extractedState.dynamoDBTables,
            packagePath: packagePath
        )
        
        onProgress("Comparing S3 configurations...")
        let s3Diffs = compareS3(
            instance: extractedState.s3Buckets,
            packagePath: packagePath
        )
        
        let report = FullDiffReport(
            generatedAt: Date(),
            appId: extractedState.appId,
            environment: extractedState.environment,
            instanceVersion: extractedState.deployedVersion,
            packageVersion: try loadPackageVersion(from: packagePath),
            schemaDiffs: schemaDiffs,
            lambdaDiffs: lambdaDiffs,
            s3Diffs: s3Diffs,
            dynamoDBDiffs: dynamoDBDiffs
        )
        
        onProgress("Diff complete: \(schemaDiffs.count) schema changes, \(lambdaDiffs.count) Lambda changes")
        
        return report
    }
    
    // MARK: - Schema Comparison
    
    private func compareSchemas(
        instance: InstanceStateExtractor.DatabaseSchema,
        package: InstanceStateExtractor.DatabaseSchema
    ) -> [SchemaDiff] {
        var diffs: [SchemaDiff] = []
        
        let instanceTableNames = Set(instance.tables.map { $0.name })
        let packageTableNames = Set(package.tables.map { $0.name })
        
        // Tables in instance but not in package (added on instance)
        for tableName in instanceTableNames.subtracting(packageTableNames) {
            if let table = instance.tables.first(where: { $0.name == tableName }) {
                let columns = table.columns.map { "\($0.name) \($0.dataType)" }.joined(separator: ", ")
                diffs.append(SchemaDiff(
                    type: .tableAdded,
                    objectName: tableName,
                    tableName: nil,
                    details: "Table exists on instance but not in package. Columns: \(columns)",
                    upSQL: generateCreateTableSQL(table),
                    downSQL: "DROP TABLE IF EXISTS \(tableName);",
                    isDestructive: false
                ))
            }
        }
        
        // Tables in package but not in instance (removed from instance)
        for tableName in packageTableNames.subtracting(instanceTableNames) {
            diffs.append(SchemaDiff(
                type: .tableRemoved,
                objectName: tableName,
                tableName: nil,
                details: "Table exists in package but not on instance. Was it deleted?",
                upSQL: "-- Table \(tableName) was removed from instance",
                downSQL: "-- Would need to recreate \(tableName)",
                isDestructive: true
            ))
        }
        
        // Compare columns for tables that exist in both
        for tableName in instanceTableNames.intersection(packageTableNames) {
            guard let instanceTable = instance.tables.first(where: { $0.name == tableName }),
                  let packageTable = package.tables.first(where: { $0.name == tableName }) else {
                continue
            }
            
            let instanceCols = Set(instanceTable.columns.map { $0.name })
            let packageCols = Set(packageTable.columns.map { $0.name })
            
            // Columns added on instance
            for colName in instanceCols.subtracting(packageCols) {
                if let col = instanceTable.columns.first(where: { $0.name == colName }) {
                    diffs.append(SchemaDiff(
                        type: .columnAdded,
                        objectName: colName,
                        tableName: tableName,
                        details: "Column \(col.dataType), nullable=\(col.isNullable)",
                        upSQL: "ALTER TABLE \(tableName) ADD COLUMN \(colName) \(col.dataType)\(col.isNullable ? "" : " NOT NULL")\(col.defaultValue.map { " DEFAULT \($0)" } ?? "");",
                        downSQL: "ALTER TABLE \(tableName) DROP COLUMN \(colName);",
                        isDestructive: false
                    ))
                }
            }
            
            // Columns removed from instance
            for colName in packageCols.subtracting(instanceCols) {
                diffs.append(SchemaDiff(
                    type: .columnRemoved,
                    objectName: colName,
                    tableName: tableName,
                    details: "Column exists in package but not on instance",
                    upSQL: "-- Column \(colName) was removed from \(tableName)",
                    downSQL: "-- Would need to recreate column \(colName)",
                    isDestructive: true
                ))
            }
            
            // Check for column type changes
            for colName in instanceCols.intersection(packageCols) {
                guard let instanceCol = instanceTable.columns.first(where: { $0.name == colName }),
                      let packageCol = packageTable.columns.first(where: { $0.name == colName }) else {
                    continue
                }
                
                if instanceCol.dataType != packageCol.dataType {
                    diffs.append(SchemaDiff(
                        type: .columnModified,
                        objectName: colName,
                        tableName: tableName,
                        details: "Type changed: package=\(packageCol.dataType), instance=\(instanceCol.dataType)",
                        upSQL: "ALTER TABLE \(tableName) ALTER COLUMN \(colName) TYPE \(instanceCol.dataType);",
                        downSQL: "ALTER TABLE \(tableName) ALTER COLUMN \(colName) TYPE \(packageCol.dataType);",
                        isDestructive: false
                    ))
                }
            }
        }
        
        // Compare enums
        let instanceEnumNames = Set(instance.enums.map { $0.name })
        let packageEnumNames = Set(package.enums.map { $0.name })
        
        for enumName in instanceEnumNames.subtracting(packageEnumNames) {
            if let e = instance.enums.first(where: { $0.name == enumName }) {
                diffs.append(SchemaDiff(
                    type: .enumAdded,
                    objectName: enumName,
                    tableName: nil,
                    details: "Values: \(e.values.joined(separator: ", "))",
                    upSQL: "CREATE TYPE \(enumName) AS ENUM (\(e.values.map { "'\($0)'" }.joined(separator: ", ")));",
                    downSQL: "DROP TYPE \(enumName);",
                    isDestructive: false
                ))
            }
        }
        
        // Check for new enum values
        for enumName in instanceEnumNames.intersection(packageEnumNames) {
            guard let instanceEnum = instance.enums.first(where: { $0.name == enumName }),
                  let packageEnum = package.enums.first(where: { $0.name == enumName }) else {
                continue
            }
            
            let newValues = Set(instanceEnum.values).subtracting(Set(packageEnum.values))
            for value in newValues {
                diffs.append(SchemaDiff(
                    type: .enumValueAdded,
                    objectName: "\(enumName).\(value)",
                    tableName: nil,
                    details: "New enum value added to \(enumName)",
                    upSQL: "ALTER TYPE \(enumName) ADD VALUE '\(value)';",
                    downSQL: "-- Cannot remove enum values in PostgreSQL",
                    isDestructive: false
                ))
            }
        }
        
        return diffs
    }
    
    private func generateCreateTableSQL(_ table: InstanceStateExtractor.TableDefinition) -> String {
        var sql = "CREATE TABLE IF NOT EXISTS \(table.name) (\n"
        
        let columnDefs = table.columns.map { col -> String in
            var def = "    \(col.name) \(col.dataType)"
            if !col.isNullable { def += " NOT NULL" }
            if let defaultVal = col.defaultValue { def += " DEFAULT \(defaultVal)" }
            return def
        }
        
        sql += columnDefs.joined(separator: ",\n")
        
        if !table.primaryKey.isEmpty {
            sql += ",\n    PRIMARY KEY (\(table.primaryKey.joined(separator: ", ")))"
        }
        
        sql += "\n);"
        return sql
    }
    
    // MARK: - Lambda Comparison
    
    private func compareLambdas(
        instance: [InstanceStateExtractor.ExtractedLambda],
        packagePath: URL
    ) async throws -> [LambdaDiff] {
        var diffs: [LambdaDiff] = []
        
        let packageLambdaPath = packagePath.appendingPathComponent("lambda")
        
        guard FileManager.default.fileExists(atPath: packageLambdaPath.path) else {
            // No Lambda code in package - all instance Lambdas are "added"
            for lambda in instance {
                diffs.append(LambdaDiff(
                    functionName: lambda.functionName,
                    changeType: .added,
                    details: "Function exists on instance but not in package",
                    instanceCodePath: lambda.localCodePath,
                    packageCodePath: nil
                ))
            }
            return diffs
        }
        
        // Get list of Lambda functions in package
        let packageFunctions = try FileManager.default.contentsOfDirectory(at: packageLambdaPath, includingPropertiesForKeys: nil)
            .filter { $0.hasDirectoryPath }
            .map { $0.lastPathComponent }
        
        let instanceFunctionNames = Set(instance.map { extractFunctionBaseName($0.functionName) })
        let packageFunctionNames = Set(packageFunctions)
        
        // Functions on instance but not in package
        for funcName in instanceFunctionNames.subtracting(packageFunctionNames) {
            if let lambda = instance.first(where: { extractFunctionBaseName($0.functionName) == funcName }) {
                diffs.append(LambdaDiff(
                    functionName: funcName,
                    changeType: .added,
                    details: "Runtime: \(lambda.runtime), Handler: \(lambda.handler)",
                    instanceCodePath: lambda.localCodePath,
                    packageCodePath: nil
                ))
            }
        }
        
        // Functions in package but not on instance
        for funcName in packageFunctionNames.subtracting(instanceFunctionNames) {
            diffs.append(LambdaDiff(
                functionName: funcName,
                changeType: .removed,
                details: "Function exists in package but not on instance",
                instanceCodePath: nil,
                packageCodePath: packageLambdaPath.appendingPathComponent(funcName).path
            ))
        }
        
        // Compare code hashes for functions that exist in both
        for funcName in instanceFunctionNames.intersection(packageFunctionNames) {
            if let lambda = instance.first(where: { extractFunctionBaseName($0.functionName) == funcName }) {
                // Compare code hashes (simplified - would need actual hash comparison)
                if let instanceCodePath = lambda.localCodePath {
                    let packageCodePath = packageLambdaPath.appendingPathComponent(funcName)
                    
                    // Check if code differs
                    let instanceHash = try? computeDirectoryHash(URL(fileURLWithPath: instanceCodePath))
                    let packageHash = try? computeDirectoryHash(packageCodePath)
                    
                    if instanceHash != packageHash {
                        diffs.append(LambdaDiff(
                            functionName: funcName,
                            changeType: .codeChanged,
                            details: "Code on instance differs from package",
                            instanceCodePath: instanceCodePath,
                            packageCodePath: packageCodePath.path
                        ))
                    }
                }
            }
        }
        
        return diffs
    }
    
    private func extractFunctionBaseName(_ fullName: String) -> String {
        // Extract base name from "radiant-appid-env-functionname"
        let parts = fullName.components(separatedBy: "-")
        if parts.count >= 4 {
            return parts.dropFirst(3).joined(separator: "-")
        }
        return fullName
    }
    
    private func computeDirectoryHash(_ url: URL) throws -> String {
        var combinedHash = ""
        
        if let enumerator = FileManager.default.enumerator(at: url, includingPropertiesForKeys: [.isRegularFileKey]) {
            while let fileURL = enumerator.nextObject() as? URL {
                if let isFile = try? fileURL.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile, isFile {
                    if let data = try? Data(contentsOf: fileURL) {
                        combinedHash += data.base64EncodedString().prefix(32)
                    }
                }
            }
        }
        
        return combinedHash
    }
    
    // MARK: - DynamoDB Comparison
    
    private func compareDynamoDB(
        instance: [InstanceStateExtractor.ExtractedDynamoDBTable],
        packagePath: URL
    ) -> [String] {
        // Load expected DynamoDB tables from CDK
        // For now, return description of instance tables
        return instance.map { "Instance has table: \($0.tableName) with \($0.itemCount) items" }
    }
    
    // MARK: - S3 Comparison
    
    private func compareS3(
        instance: [InstanceStateExtractor.ExtractedS3Bucket],
        packagePath: URL
    ) -> [String] {
        // Load expected S3 buckets from CDK
        return instance.map { "Instance has bucket: \($0.bucketName) (\($0.objectCount) objects)" }
    }
    
    // MARK: - Migration Generation
    
    /// Generate a migration file from the diff report
    func generateMigrationFile(from report: FullDiffReport) throws -> URL {
        let timestamp = DateFormatter.migrationTimestamp.string(from: Date())
        let filename = "V\(timestamp)__extracted_schema_changes.sql"
        let outputFile = outputDirectory.appendingPathComponent(filename)
        
        var sql = """
        -- Migration generated from instance state extraction
        -- Generated: \(DateFormatter.readable.string(from: Date()))
        -- Instance Version: \(report.instanceVersion)
        -- Package Version: \(report.packageVersion)
        -- Changes: \(report.schemaDiffs.count) schema modifications
        
        """
        
        // Add UP migrations
        sql += "\n-- ====== SCHEMA CHANGES ======\n\n"
        
        for diff in report.schemaDiffs {
            sql += "-- \(diff.type.rawValue): \(diff.objectName)\n"
            sql += "-- \(diff.details)\n"
            if diff.isDestructive {
                sql += "-- ⚠️ DESTRUCTIVE CHANGE - Review carefully!\n"
            }
            sql += "\(diff.upSQL)\n\n"
        }
        
        // Add rollback section as comments
        sql += "\n-- ====== ROLLBACK SQL (for reference) ======\n"
        sql += "-- Run these statements to reverse the migration:\n"
        sql += "/*\n"
        for diff in report.schemaDiffs.reversed() {
            sql += "\(diff.downSQL)\n"
        }
        sql += "*/\n"
        
        try sql.write(to: outputFile, atomically: true, encoding: .utf8)
        
        RadiantLogger.info("Generated migration file: \(outputFile.path)", category: RadiantLogger.general)
        
        return outputFile
    }
    
    // MARK: - Helper Methods
    
    private func loadPackageSchema(from packagePath: URL) async throws -> InstanceStateExtractor.DatabaseSchema {
        // Parse all migration files to build expected schema
        let migrationsPath = packagePath.appendingPathComponent("migrations")
        
        guard FileManager.default.fileExists(atPath: migrationsPath.path) else {
            return InstanceStateExtractor.DatabaseSchema(
                tables: [], enums: [], functions: [], indexes: [], extensions: [], currentMigrationVersion: nil
            )
        }
        
        var schema = InstanceStateExtractor.DatabaseSchema(
            tables: [], enums: [], functions: [], indexes: [], extensions: [], currentMigrationVersion: nil
        )
        
        // Get all migration files sorted by version
        let migrationFiles = try FileManager.default.contentsOfDirectory(at: migrationsPath, includingPropertiesForKeys: nil)
            .filter { $0.pathExtension == "sql" }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
        
        for file in migrationFiles {
            let content = try String(contentsOf: file, encoding: .utf8)
            
            // Parse CREATE TABLE statements
            let tablePattern = #"CREATE TABLE (?:IF NOT EXISTS )?(\w+)"#
            if let regex = try? NSRegularExpression(pattern: tablePattern, options: .caseInsensitive) {
                let matches = regex.matches(in: content, range: NSRange(content.startIndex..., in: content))
                for match in matches {
                    if let range = Range(match.range(at: 1), in: content) {
                        let tableName = String(content[range])
                        if !schema.tables.contains(where: { $0.name == tableName }) {
                            schema.tables.append(InstanceStateExtractor.TableDefinition(
                                name: tableName,
                                schema: "public",
                                columns: [],
                                primaryKey: [],
                                foreignKeys: [],
                                constraints: [],
                                rowCount: 0
                            ))
                        }
                    }
                }
            }
            
            // Parse CREATE TYPE (enums)
            let enumPattern = #"CREATE TYPE (\w+) AS ENUM"#
            if let regex = try? NSRegularExpression(pattern: enumPattern, options: .caseInsensitive) {
                let matches = regex.matches(in: content, range: NSRange(content.startIndex..., in: content))
                for match in matches {
                    if let range = Range(match.range(at: 1), in: content) {
                        let enumName = String(content[range])
                        if !schema.enums.contains(where: { $0.name == enumName }) {
                            schema.enums.append(InstanceStateExtractor.EnumDefinition(name: enumName, values: []))
                        }
                    }
                }
            }
            
            // Track latest migration version
            let versionPattern = #"V(\d{4}_\d{2}_\d{2}_\d{3})"#
            if let regex = try? NSRegularExpression(pattern: versionPattern),
               let match = regex.firstMatch(in: file.lastPathComponent, range: NSRange(file.lastPathComponent.startIndex..., in: file.lastPathComponent)),
               let range = Range(match.range(at: 1), in: file.lastPathComponent) {
                schema.currentMigrationVersion = String(file.lastPathComponent[range])
            }
        }
        
        return schema
    }
    
    private func loadPackageVersion(from packagePath: URL) throws -> String {
        let manifestPath = packagePath.appendingPathComponent("manifest.json")
        if let data = try? Data(contentsOf: manifestPath),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let version = json["version"] as? String {
            return version
        }
        return "unknown"
    }
}

// MARK: - Date Formatters

extension DateFormatter {
    static let migrationTimestamp: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy_MM_dd_HHmmss"
        return f
    }()
    
    static let readable: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .medium
        return f
    }()
}

// MARK: - Singleton

extension SchemaDiffGenerator {
    static let shared = SchemaDiffGenerator()
}
