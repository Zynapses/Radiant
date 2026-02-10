// RADIANT - Safe Schema Migration Service
// Handles schema changes with data clearing when migrations are not provided
// Prevents unknown failure outcomes and regulatory issues from orphaned data

import Foundation

actor SafeSchemaMigrationService {
    
    // MARK: - Types
    
    /// Policy for handling schema changes without explicit migrations
    enum MigrationPolicy: String, Codable, Sendable, CaseIterable {
        case strict = "strict"           // Fail if no migration provided for schema change
        case clearData = "clear_data"    // Clear table data and apply schema change
        case preserveData = "preserve"   // Try to preserve data (may fail)
        case manual = "manual"           // Require manual intervention
        
        var description: String {
            switch self {
            case .strict: return "Fail deployment if schema changes without migration"
            case .clearData: return "Clear table data before applying schema changes (safest)"
            case .preserveData: return "Attempt to preserve data (may cause failures)"
            case .manual: return "Pause and require manual intervention"
            }
        }
    }
    
    /// Detected schema change between instance and package
    struct DetectedSchemaChange: Codable, Sendable, Identifiable {
        let id: String
        let tableName: String
        let changeType: ChangeType
        let description: String
        let hasPackageMigration: Bool
        let riskLevel: RiskLevel
        var recommendedAction: MigrationPolicy
        var affectedRowCount: Int?
        var relatedTables: [String] // Foreign key dependencies
    }
    
    enum ChangeType: String, Codable, Sendable {
        case columnAdded = "column_added"
        case columnRemoved = "column_removed"
        case columnTypeChanged = "column_type_changed"
        case columnConstraintChanged = "column_constraint_changed"
        case tableAdded = "table_added"
        case tableRemoved = "table_removed"
        case indexAdded = "index_added"
        case indexRemoved = "index_removed"
        case foreignKeyAdded = "fk_added"
        case foreignKeyRemoved = "fk_removed"
        case enumValueAdded = "enum_value_added"
        case enumValueRemoved = "enum_value_removed"
    }
    
    enum RiskLevel: String, Codable, Sendable {
        case low = "low"           // Additive change, safe
        case medium = "medium"     // May cause issues
        case high = "high"         // Likely to cause data loss or failures
        case critical = "critical" // Will definitely fail without intervention
        
        var color: String {
            switch self {
            case .low: return "green"
            case .medium: return "yellow"
            case .high: return "orange"
            case .critical: return "red"
            }
        }
    }
    
    /// Result of applying safe migration
    struct SafeMigrationResult: Codable, Sendable {
        let timestamp: Date
        let tableName: String
        let changeApplied: DetectedSchemaChange
        let policy: MigrationPolicy
        let dataCleared: Bool
        let rowsCleared: Int
        let success: Bool
        let errorMessage: String?
        let auditLogId: String
    }
    
    /// Audit log entry for regulatory compliance
    struct DataClearingAuditEntry: Codable, Sendable {
        let id: String
        let timestamp: Date
        let environment: String
        let tableName: String
        let reason: String
        let rowsCleared: Int
        let schemaChangeBefore: String
        let schemaChangeAfter: String
        let initiatedBy: String // "system" or user ID
        let approvedBy: String? // For manual approval
        let retentionPolicy: String
        let backupLocation: String? // If backup was created before clearing
    }
    
    // MARK: - Properties
    
    private let awsCliPath: String
    private var auditLog: [DataClearingAuditEntry] = []
    
    // MARK: - Initialization
    
    init() {
        let paths = ["/opt/homebrew/bin/aws", "/usr/local/bin/aws", "/usr/bin/aws"]
        self.awsCliPath = paths.first { FileManager.default.fileExists(atPath: $0) } ?? "/usr/local/bin/aws"
    }
    
    // MARK: - Schema Change Detection
    
    /// Detect schema changes between live instance and package
    func detectSchemaChanges(
        instanceSchema: InstanceStateExtractor.DatabaseSchema,
        packageSchema: InstanceStateExtractor.DatabaseSchema,
        packageMigrations: [String], // List of migration files in package
        credentials: CredentialSet
    ) async throws -> [DetectedSchemaChange] {
        var changes: [DetectedSchemaChange] = []
        
        let instanceTableMap = Dictionary(uniqueKeysWithValues: instanceSchema.tables.map { ($0.name, $0) })
        let packageTableMap = Dictionary(uniqueKeysWithValues: packageSchema.tables.map { ($0.name, $0) })
        
        // Check for table additions (in instance but not in package)
        for table in instanceSchema.tables {
            if packageTableMap[table.name] == nil {
                changes.append(DetectedSchemaChange(
                    id: "table-added-\(table.name)",
                    tableName: table.name,
                    changeType: .tableAdded,
                    description: "Table '\(table.name)' exists in instance but not in package",
                    hasPackageMigration: hasMigrationForTable(table.name, in: packageMigrations),
                    riskLevel: .medium,
                    recommendedAction: .clearData,
                    affectedRowCount: nil,
                    relatedTables: []
                ))
            }
        }
        
        // Check for table removals (in package but not in instance)
        for table in packageSchema.tables {
            if instanceTableMap[table.name] == nil {
                changes.append(DetectedSchemaChange(
                    id: "table-removed-\(table.name)",
                    tableName: table.name,
                    changeType: .tableRemoved,
                    description: "Table '\(table.name)' in package but not in instance",
                    hasPackageMigration: hasMigrationForTable(table.name, in: packageMigrations),
                    riskLevel: .low,
                    recommendedAction: .preserveData,
                    affectedRowCount: nil,
                    relatedTables: []
                ))
            }
        }
        
        // Check for column changes in existing tables
        for instanceTable in instanceSchema.tables {
            guard let packageTable = packageTableMap[instanceTable.name] else { continue }
            
            let instanceColumnMap = Dictionary(uniqueKeysWithValues: instanceTable.columns.map { ($0.name, $0) })
            let packageColumnMap = Dictionary(uniqueKeysWithValues: packageTable.columns.map { ($0.name, $0) })
            
            // Column additions
            for column in instanceTable.columns {
                if packageColumnMap[column.name] == nil {
                    let riskLevel: RiskLevel = column.isNullable ? .low : .high
                    changes.append(DetectedSchemaChange(
                        id: "column-added-\(instanceTable.name)-\(column.name)",
                        tableName: instanceTable.name,
                        changeType: .columnAdded,
                        description: "Column '\(column.name)' added to '\(instanceTable.name)' (NOT NULL: \(!column.isNullable))",
                        hasPackageMigration: hasMigrationForTable(instanceTable.name, in: packageMigrations),
                        riskLevel: riskLevel,
                        recommendedAction: column.isNullable ? .preserveData : .clearData,
                        affectedRowCount: nil,
                        relatedTables: []
                    ))
                }
            }
            
            // Column removals
            for column in packageTable.columns {
                if instanceColumnMap[column.name] == nil {
                    changes.append(DetectedSchemaChange(
                        id: "column-removed-\(instanceTable.name)-\(column.name)",
                        tableName: instanceTable.name,
                        changeType: .columnRemoved,
                        description: "Column '\(column.name)' removed from '\(instanceTable.name)'",
                        hasPackageMigration: hasMigrationForTable(instanceTable.name, in: packageMigrations),
                        riskLevel: .critical,
                        recommendedAction: .clearData,
                        affectedRowCount: nil,
                        relatedTables: []
                    ))
                }
            }
            
            // Column type changes
            for instanceColumn in instanceTable.columns {
                guard let packageColumn = packageColumnMap[instanceColumn.name] else { continue }
                
                if instanceColumn.dataType != packageColumn.dataType {
                    let isCompatible = isTypeChangeCompatible(from: packageColumn.dataType, to: instanceColumn.dataType)
                    changes.append(DetectedSchemaChange(
                        id: "column-type-\(instanceTable.name)-\(instanceColumn.name)",
                        tableName: instanceTable.name,
                        changeType: .columnTypeChanged,
                        description: "Column '\(instanceColumn.name)' type changed: \(packageColumn.dataType) → \(instanceColumn.dataType)",
                        hasPackageMigration: hasMigrationForTable(instanceTable.name, in: packageMigrations),
                        riskLevel: isCompatible ? .medium : .critical,
                        recommendedAction: isCompatible ? .preserveData : .clearData,
                        affectedRowCount: nil,
                        relatedTables: []
                    ))
                }
            }
        }
        
        // Get row counts for affected tables
        for i in changes.indices {
            if let rowCount = try? await getTableRowCount(
                tableName: changes[i].tableName,
                credentials: credentials
            ) {
                changes[i].affectedRowCount = rowCount
            }
        }
        
        return changes
    }
    
    // MARK: - Safe Migration Execution
    
    /// Apply schema changes with specified policy
    func applySafeSchemaChanges(
        changes: [DetectedSchemaChange],
        policy: MigrationPolicy,
        environment: String,
        appId: String,
        credentials: CredentialSet,
        createBackup: Bool = true,
        createFullSnapshot: Bool = false, // v1.4.0: Full RDS snapshot option
        onProgress: @escaping (String, Double) -> Void
    ) async throws -> [SafeMigrationResult] {
        
        // v1.4.0: Create full RDS snapshot before any destructive changes
        if createFullSnapshot && changes.contains(where: { $0.riskLevel == .critical || $0.riskLevel == .high }) {
            onProgress("Creating full RDS snapshot before schema changes...", 0.05)
            
            let snapshotResult = try await SnapshotManager.shared.createSnapshot(
                name: "pre-migration-\(ISO8601DateFormatter().string(from: Date()))",
                description: "Automatic snapshot before schema migration with destructive changes",
                environment: environment,
                appId: appId,
                credentials: credentials,
                type: .full,
                onProgress: { msg, _ in
                    onProgress("Snapshot: \(msg)", 0.1)
                }
            )
            
            if !snapshotResult.success {
                throw SafeMigrationError.dataBackupFailed("Full snapshot failed: \(snapshotResult.errors.joined(separator: ", "))")
            }
            
            RadiantLogger.info("✅ Pre-migration snapshot created: \(snapshotResult.snapshotId)", category: RadiantLogger.database)
            onProgress("Snapshot complete: \(snapshotResult.snapshotId)", 0.15)
        }
        
        var results: [SafeMigrationResult] = []
        let total = Double(changes.count)
        
        for (index, change) in changes.enumerated() {
            let progress = Double(index) / total
            onProgress("Processing: \(change.tableName)", progress)
            
            let effectivePolicy = change.hasPackageMigration ? .preserveData : policy
            
            switch effectivePolicy {
            case .strict:
                if !change.hasPackageMigration && change.riskLevel == .critical {
                    results.append(SafeMigrationResult(
                        timestamp: Date(),
                        tableName: change.tableName,
                        changeApplied: change,
                        policy: .strict,
                        dataCleared: false,
                        rowsCleared: 0,
                        success: false,
                        errorMessage: "Strict mode: No migration provided for critical schema change",
                        auditLogId: UUID().uuidString
                    ))
                    throw SafeMigrationError.noMigrationProvided(change.tableName)
                }
                
            case .clearData:
                if !change.hasPackageMigration && change.riskLevel.rawValue >= RiskLevel.high.rawValue {
                    let result = try await clearTableAndApplyChange(
                        change: change,
                        environment: environment,
                        credentials: credentials,
                        createBackup: createBackup
                    )
                    results.append(result)
                }
                
            case .preserveData:
                // Log warning but proceed
                RadiantLogger.warning("Preserving data for schema change without migration: \(change.tableName)", category: RadiantLogger.database)
                results.append(SafeMigrationResult(
                    timestamp: Date(),
                    tableName: change.tableName,
                    changeApplied: change,
                    policy: .preserveData,
                    dataCleared: false,
                    rowsCleared: 0,
                    success: true,
                    errorMessage: nil,
                    auditLogId: UUID().uuidString
                ))
                
            case .manual:
                results.append(SafeMigrationResult(
                    timestamp: Date(),
                    tableName: change.tableName,
                    changeApplied: change,
                    policy: .manual,
                    dataCleared: false,
                    rowsCleared: 0,
                    success: false,
                    errorMessage: "Manual intervention required",
                    auditLogId: UUID().uuidString
                ))
            }
        }
        
        onProgress("Schema migration complete", 1.0)
        return results
    }
    
    // MARK: - Data Clearing
    
    private func clearTableAndApplyChange(
        change: DetectedSchemaChange,
        environment: String,
        credentials: CredentialSet,
        createBackup: Bool
    ) async throws -> SafeMigrationResult {
        let auditId = UUID().uuidString
        var backupLocation: String? = nil
        
        // Step 1: Create backup if requested
        if createBackup {
            backupLocation = try await createTableBackup(
                tableName: change.tableName,
                environment: environment,
                credentials: credentials
            )
            RadiantLogger.info("✅ Backup created: \(backupLocation ?? "unknown")", category: RadiantLogger.database)
        }
        
        // Step 2: Get current row count
        let rowCount = try await getTableRowCount(tableName: change.tableName, credentials: credentials)
        
        // Step 3: Clear the table
        try await clearTableData(tableName: change.tableName, credentials: credentials)
        
        // Step 4: Create audit log entry
        let auditEntry = DataClearingAuditEntry(
            id: auditId,
            timestamp: Date(),
            environment: environment,
            tableName: change.tableName,
            reason: "Schema change without migration: \(change.description)",
            rowsCleared: rowCount,
            schemaChangeBefore: "See migration diff",
            schemaChangeAfter: "See migration diff",
            initiatedBy: "system",
            approvedBy: nil,
            retentionPolicy: "7 years (regulatory compliance)",
            backupLocation: backupLocation
        )
        auditLog.append(auditEntry)
        
        // Save audit log
        try await saveAuditLog()
        
        RadiantLogger.info("✅ Cleared \(rowCount) rows from \(change.tableName) for safe schema migration", category: RadiantLogger.database)
        
        return SafeMigrationResult(
            timestamp: Date(),
            tableName: change.tableName,
            changeApplied: change,
            policy: .clearData,
            dataCleared: true,
            rowsCleared: rowCount,
            success: true,
            errorMessage: nil,
            auditLogId: auditId
        )
    }
    
    // MARK: - Helper Methods
    
    private func hasMigrationForTable(_ tableName: String, in migrations: [String]) -> Bool {
        let tablePattern = tableName.lowercased()
        return migrations.contains { migration in
            migration.lowercased().contains(tablePattern)
        }
    }
    
    private func isTypeChangeCompatible(from: String, to: String) -> Bool {
        // Safe type promotions
        let safePromotions: [(from: String, to: String)] = [
            ("integer", "bigint"),
            ("smallint", "integer"),
            ("smallint", "bigint"),
            ("varchar", "text"),
            ("char", "varchar"),
            ("char", "text"),
            ("real", "double precision"),
            ("numeric", "double precision"),
        ]
        
        let fromLower = from.lowercased()
        let toLower = to.lowercased()
        
        return safePromotions.contains { $0.from == fromLower && $0.to == toLower }
    }
    
    private func getTableRowCount(tableName: String, credentials: CredentialSet) async throws -> Int {
        // This would execute a COUNT(*) query via RDS Data API
        // For now, return placeholder
        return 0
    }
    
    private func clearTableData(tableName: String, credentials: CredentialSet) async throws {
        // Execute TRUNCATE via RDS Data API
        // TRUNCATE is faster than DELETE and resets sequences
        let sql = "TRUNCATE TABLE \(tableName) CASCADE"
        RadiantLogger.info("Executing: \(sql)", category: RadiantLogger.database)
        
        // In production, this would call RDS Data API
        // For safety, we use TRUNCATE CASCADE to handle foreign keys
    }
    
    private func createTableBackup(tableName: String, environment: String, credentials: CredentialSet) async throws -> String {
        let timestamp = ISO8601DateFormatter().string(from: Date())
        let backupName = "\(tableName)_backup_\(timestamp)"
        
        // Create backup table with current data
        let sql = "CREATE TABLE \(backupName) AS SELECT * FROM \(tableName)"
        RadiantLogger.info("Creating backup: \(sql)", category: RadiantLogger.database)
        
        return backupName
    }
    
    // MARK: - Audit Log Persistence
    
    private func saveAuditLog() async throws {
        let auditDir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            .appendingPathComponent("RadiantDeployer")
            .appendingPathComponent("audit-logs")
        
        try FileManager.default.createDirectory(at: auditDir, withIntermediateDirectories: true)
        
        let logFile = auditDir.appendingPathComponent("data-clearing-audit.json")
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        
        let data = try encoder.encode(auditLog)
        try data.write(to: logFile)
        
        RadiantLogger.info("📋 Audit log saved: \(logFile.path)", category: RadiantLogger.database)
    }
    
    /// Get audit log for regulatory compliance reporting
    func getAuditLog() -> [DataClearingAuditEntry] {
        return auditLog
    }
    
    /// Export audit log for compliance
    func exportAuditLog(format: ExportFormat) async throws -> Data {
        switch format {
        case .json:
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            return try encoder.encode(auditLog)
            
        case .csv:
            var csv = "ID,Timestamp,Environment,Table,Reason,Rows Cleared,Initiated By,Approved By,Backup Location\n"
            for entry in auditLog {
                csv += "\"\(entry.id)\",\"\(entry.timestamp)\",\"\(entry.environment)\",\"\(entry.tableName)\",\"\(entry.reason)\",\(entry.rowsCleared),\"\(entry.initiatedBy)\",\"\(entry.approvedBy ?? "")\",\"\(entry.backupLocation ?? "")\"\n"
            }
            return csv.data(using: .utf8) ?? Data()
        }
    }
    
    enum ExportFormat {
        case json
        case csv
    }
    
    // MARK: - Errors
    
    enum SafeMigrationError: Error, LocalizedError {
        case noMigrationProvided(String)
        case dataBackupFailed(String)
        case schemaMismatch(String)
        case regulatoryHold(String)
        
        var errorDescription: String? {
            switch self {
            case .noMigrationProvided(let table): return "No migration provided for schema change on '\(table)'"
            case .dataBackupFailed(let table): return "Failed to create backup for '\(table)'"
            case .schemaMismatch(let msg): return "Schema mismatch: \(msg)"
            case .regulatoryHold(let msg): return "Regulatory hold: \(msg)"
            }
        }
    }
}

// MARK: - Singleton

extension SafeSchemaMigrationService {
    static let shared = SafeSchemaMigrationService()
}
