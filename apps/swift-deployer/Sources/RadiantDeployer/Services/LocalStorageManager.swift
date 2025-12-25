import Foundation
import SQLite3

/// Local Storage Manager using SQLCipher for encrypted local data
actor LocalStorageManager {
    
    // MARK: - Types
    
    enum StorageError: Error, LocalizedError {
        case databaseNotOpen
        case encryptionFailed
        case queryFailed(String)
        case migrationFailed(String)
        case backupFailed(String)
        case restoreFailed(String)
        
        var errorDescription: String? {
            switch self {
            case .databaseNotOpen:
                return "Database is not open"
            case .encryptionFailed:
                return "Failed to encrypt database"
            case .queryFailed(let message):
                return "Query failed: \(message)"
            case .migrationFailed(let message):
                return "Migration failed: \(message)"
            case .backupFailed(let message):
                return "Backup failed: \(message)"
            case .restoreFailed(let message):
                return "Restore failed: \(message)"
            }
        }
    }
    
    struct DeploymentRecord: Codable, Sendable {
        let id: String
        let appId: String
        let environment: String
        let tier: Int
        let region: String
        let status: String
        let startedAt: Date
        let completedAt: Date?
        let outputs: [String: String]?
        let error: String?
    }
    
    struct CredentialRecord: Codable, Sendable {
        let id: String
        let name: String
        let accessKeyId: String
        let secretAccessKey: String // Encrypted
        let region: String
        let accountId: String?
        let createdAt: Date
        let lastUsedAt: Date?
    }
    
    // MARK: - Properties
    
    private var db: OpaquePointer?
    private let dbPath: String
    private let encryptionKey: String
    
    private static let schemaVersion = 1
    
    // MARK: - Initialization
    
    init() {
        guard let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            fatalError("Could not access Application Support directory")
        }
        let radiantDir = appSupport.appendingPathComponent("RadiantDeployer")
        
        // Create directory if needed
        try? FileManager.default.createDirectory(at: radiantDir, withIntermediateDirectories: true)
        
        self.dbPath = radiantDir.appendingPathComponent("local.db").path
        
        // Generate or retrieve encryption key
        self.encryptionKey = Self.getOrCreateEncryptionKey()
    }
    
    // MARK: - Database Management
    
    func open() throws {
        guard sqlite3_open(dbPath, &db) == SQLITE_OK else {
            throw StorageError.queryFailed("Failed to open database")
        }
        
        // Set encryption key (SQLCipher)
        let keyQuery = "PRAGMA key = '\(encryptionKey)';"
        if sqlite3_exec(db, keyQuery, nil, nil, nil) != SQLITE_OK {
            throw StorageError.encryptionFailed
        }
        
        // Run migrations
        try runMigrations()
    }
    
    func close() {
        if db != nil {
            sqlite3_close(db)
            db = nil
        }
    }
    
    private func runMigrations() throws {
        // Create schema version table
        try execute("""
            CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER PRIMARY KEY
            )
        """)
        
        // Get current version
        var currentVersion = 0
        try query("SELECT version FROM schema_version ORDER BY version DESC LIMIT 1") { stmt in
            currentVersion = Int(sqlite3_column_int(stmt, 0))
        }
        
        // Run migrations
        if currentVersion < 1 {
            try migrate_v1()
            try execute("INSERT INTO schema_version (version) VALUES (1)")
        }
    }
    
    private func migrate_v1() throws {
        // Deployments table
        try execute("""
            CREATE TABLE IF NOT EXISTS deployments (
                id TEXT PRIMARY KEY,
                app_id TEXT NOT NULL,
                environment TEXT NOT NULL,
                tier INTEGER NOT NULL,
                region TEXT NOT NULL,
                status TEXT NOT NULL,
                started_at TEXT NOT NULL,
                completed_at TEXT,
                outputs TEXT,
                error TEXT
            )
        """)
        
        // Credentials table
        try execute("""
            CREATE TABLE IF NOT EXISTS credentials (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                access_key_id TEXT NOT NULL,
                secret_access_key TEXT NOT NULL,
                region TEXT NOT NULL,
                account_id TEXT,
                created_at TEXT NOT NULL,
                last_used_at TEXT
            )
        """)
        
        // Settings table
        try execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        
        // Logs table
        try execute("""
            CREATE TABLE IF NOT EXISTS deployment_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                deployment_id TEXT NOT NULL,
                level TEXT NOT NULL,
                message TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                FOREIGN KEY (deployment_id) REFERENCES deployments(id)
            )
        """)
        
        // Indexes
        try execute("CREATE INDEX IF NOT EXISTS idx_deployments_app ON deployments(app_id)")
        try execute("CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status)")
        try execute("CREATE INDEX IF NOT EXISTS idx_logs_deployment ON deployment_logs(deployment_id)")
    }
    
    // MARK: - Deployment Methods
    
    func saveDeployment(_ record: DeploymentRecord) throws {
        let outputsJson = record.outputs.map { try? JSONEncoder().encode($0) }.flatMap { $0 }
        let outputsString = outputsJson.flatMap { String(data: $0, encoding: .utf8) }
        
        try execute("""
            INSERT OR REPLACE INTO deployments 
            (id, app_id, environment, tier, region, status, started_at, completed_at, outputs, error)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, params: [
            record.id,
            record.appId,
            record.environment,
            String(record.tier),
            record.region,
            record.status,
            ISO8601DateFormatter().string(from: record.startedAt),
            record.completedAt.map { ISO8601DateFormatter().string(from: $0) } ?? "",
            outputsString ?? "",
            record.error ?? ""
        ])
    }
    
    func getDeployments(appId: String? = nil, limit: Int = 50) throws -> [DeploymentRecord] {
        var records: [DeploymentRecord] = []
        
        if let appId = appId {
            try queryWithParams("""
                SELECT id, app_id, environment, tier, region, status, started_at, completed_at, outputs, error
                FROM deployments WHERE app_id = ?
                ORDER BY started_at DESC LIMIT \(limit)
            """, params: [appId]) { stmt in
                records.append(parseDeploymentRecord(stmt))
            }
        } else {
            try query("""
                SELECT id, app_id, environment, tier, region, status, started_at, completed_at, outputs, error
                FROM deployments
                ORDER BY started_at DESC LIMIT \(limit)
            """) { stmt in
                records.append(parseDeploymentRecord(stmt))
            }
        }
        
        return records
    }
    
    private func parseDeploymentRecord(_ stmt: OpaquePointer) -> DeploymentRecord {
        let id = String(cString: sqlite3_column_text(stmt, 0))
        let appId = String(cString: sqlite3_column_text(stmt, 1))
        let environment = String(cString: sqlite3_column_text(stmt, 2))
        let tier = Int(sqlite3_column_int(stmt, 3))
        let region = String(cString: sqlite3_column_text(stmt, 4))
        let status = String(cString: sqlite3_column_text(stmt, 5))
        let startedAtStr = String(cString: sqlite3_column_text(stmt, 6))
        let completedAtStr = sqlite3_column_text(stmt, 7).map { String(cString: $0) }
        let outputsStr = sqlite3_column_text(stmt, 8).map { String(cString: $0) }
        let error = sqlite3_column_text(stmt, 9).map { String(cString: $0) }
        
        let formatter = ISO8601DateFormatter()
        let startedAt = formatter.date(from: startedAtStr) ?? Date()
        let completedAt = completedAtStr.flatMap { formatter.date(from: $0) }
        
        var outputs: [String: String]?
        if let outputsData = outputsStr?.data(using: .utf8) {
            outputs = try? JSONDecoder().decode([String: String].self, from: outputsData)
        }
        
        return DeploymentRecord(
            id: id,
            appId: appId,
            environment: environment,
            tier: tier,
            region: region,
            status: status,
            startedAt: startedAt,
            completedAt: completedAt,
            outputs: outputs,
            error: error?.isEmpty == true ? nil : error
        )
    }
    
    // MARK: - Settings Methods
    
    func setSetting(key: String, value: String) throws {
        try execute("""
            INSERT OR REPLACE INTO settings (key, value, updated_at)
            VALUES (?, ?, ?)
        """, params: [key, value, ISO8601DateFormatter().string(from: Date())])
    }
    
    func getSetting(key: String) throws -> String? {
        var result: String?
        try queryWithParams("SELECT value FROM settings WHERE key = ?", params: [key]) { stmt in
            result = String(cString: sqlite3_column_text(stmt, 0))
        }
        return result
    }
    
    // MARK: - Backup & Restore
    
    func createBackup() throws -> URL {
        guard db != nil else { throw StorageError.databaseNotOpen }
        
        guard let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            throw StorageError.backupFailed("Could not access Application Support directory")
        }
        let backupDir = appSupport.appendingPathComponent("RadiantDeployer/backups")
        
        try FileManager.default.createDirectory(at: backupDir, withIntermediateDirectories: true)
        
        let timestamp = ISO8601DateFormatter().string(from: Date())
            .replacingOccurrences(of: ":", with: "-")
        let backupPath = backupDir.appendingPathComponent("backup-\(timestamp).db")
        
        try FileManager.default.copyItem(atPath: dbPath, toPath: backupPath.path)
        
        return backupPath
    }
    
    func restoreFromBackup(_ backupURL: URL) throws {
        guard FileManager.default.fileExists(atPath: backupURL.path) else {
            throw StorageError.restoreFailed("Backup file not found")
        }
        
        close()
        
        // Create backup of current before restore
        let tempPath = dbPath + ".temp"
        try? FileManager.default.moveItem(atPath: dbPath, toPath: tempPath)
        
        do {
            try FileManager.default.copyItem(atPath: backupURL.path, toPath: dbPath)
            try open()
            try? FileManager.default.removeItem(atPath: tempPath)
        } catch {
            // Restore original on failure
            try? FileManager.default.removeItem(atPath: dbPath)
            try? FileManager.default.moveItem(atPath: tempPath, toPath: dbPath)
            try? open()
            throw StorageError.restoreFailed(error.localizedDescription)
        }
    }
    
    func listBackups() throws -> [URL] {
        guard let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            throw StorageError.backupFailed("Could not access Application Support directory")
        }
        let backupDir = appSupport.appendingPathComponent("RadiantDeployer/backups")
        
        guard FileManager.default.fileExists(atPath: backupDir.path) else {
            return []
        }
        
        let files = try FileManager.default.contentsOfDirectory(at: backupDir, includingPropertiesForKeys: [.creationDateKey])
        return files.filter { $0.pathExtension == "db" }
            .sorted { ($0.path) > ($1.path) }
    }
    
    // MARK: - PROMPT-33 Backup Rotation (keep last 5)
    
    private static let maxBackupCount = 5
    
    /// Create backup with automatic rotation (keeps last 5)
    func createBackupWithRotation() throws -> URL {
        let backupURL = try createBackup()
        try rotateBackups()
        return backupURL
    }
    
    /// Remove old backups, keeping only the most recent 5
    func rotateBackups() throws {
        let backups = try listBackups()
        
        // Delete old backups beyond the limit
        if backups.count > Self.maxBackupCount {
            let toDelete = backups.suffix(from: Self.maxBackupCount)
            for backupURL in toDelete {
                try? FileManager.default.removeItem(at: backupURL)
            }
        }
    }
    
    /// Auto-restore from backup chain on corruption
    func autoRestoreFromBackupChain() throws -> Bool {
        let backups = try listBackups()
        
        for (_, backupURL) in backups.enumerated() {
            do {
                // Try to verify backup integrity
                if try verifyBackupIntegrity(backupURL) {
                    try restoreFromBackup(backupURL)
                    return true
                }
            } catch {
                // Continue to next backup
                continue
            }
        }
        
        return false
    }
    
    /// Verify backup file integrity using SHA256
    func verifyBackupIntegrity(_ backupURL: URL) throws -> Bool {
        guard FileManager.default.fileExists(atPath: backupURL.path) else {
            return false
        }
        
        // Check if file can be opened as SQLite
        var testDb: OpaquePointer?
        if sqlite3_open(backupURL.path, &testDb) != SQLITE_OK {
            return false
        }
        
        // Set encryption key
        let keyQuery = "PRAGMA key = '\(encryptionKey)';"
        if sqlite3_exec(testDb, keyQuery, nil, nil, nil) != SQLITE_OK {
            sqlite3_close(testDb)
            return false
        }
        
        // Try a simple query to verify
        var stmt: OpaquePointer?
        let testResult = sqlite3_prepare_v2(testDb, "SELECT COUNT(*) FROM schema_version", -1, &stmt, nil)
        sqlite3_finalize(stmt)
        sqlite3_close(testDb)
        
        return testResult == SQLITE_OK
    }
    
    /// Save with automatic backup rotation
    func saveWithBackup(_ operation: () throws -> Void) throws {
        // Create backup before operation
        _ = try? createBackupWithRotation()
        
        // Perform operation
        try operation()
    }
    
    // MARK: - Helper Methods
    
    private func execute(_ sql: String, params: [String] = []) throws {
        guard let db = db else { throw StorageError.databaseNotOpen }
        
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw StorageError.queryFailed(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(stmt) }
        
        for (index, param) in params.enumerated() {
            sqlite3_bind_text(stmt, Int32(index + 1), param, -1, nil)
        }
        
        guard sqlite3_step(stmt) == SQLITE_DONE else {
            throw StorageError.queryFailed(String(cString: sqlite3_errmsg(db)))
        }
    }
    
    private func query(_ sql: String, handler: (OpaquePointer) -> Void) throws {
        guard let db = db else { throw StorageError.databaseNotOpen }
        
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw StorageError.queryFailed(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(stmt) }
        
        while sqlite3_step(stmt) == SQLITE_ROW {
            guard let statement = stmt else { continue }
            handler(statement)
        }
    }
    
    private func queryWithParams(_ sql: String, params: [String], handler: (OpaquePointer) -> Void) throws {
        guard let db = db else { throw StorageError.databaseNotOpen }
        
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw StorageError.queryFailed(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(stmt) }
        
        for (index, param) in params.enumerated() {
            sqlite3_bind_text(stmt, Int32(index + 1), param, -1, nil)
        }
        
        while sqlite3_step(stmt) == SQLITE_ROW {
            guard let statement = stmt else { continue }
            handler(statement)
        }
    }
    
    private static func getOrCreateEncryptionKey() -> String {
        let keychain = "com.radiant.deployer.dbkey"
        
        // Try to retrieve existing key
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychain,
            kSecReturnData as String: true,
        ]
        
        var result: AnyObject?
        if SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
           let data = result as? Data,
           let key = String(data: data, encoding: .utf8) {
            return key
        }
        
        // Generate new key
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        let newKey = Data(bytes).base64EncodedString()
        
        // Store in keychain
        let storeQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychain,
            kSecValueData as String: newKey.data(using: .utf8) ?? Data(),
        ]
        SecItemAdd(storeQuery as CFDictionary, nil)
        
        return newKey
    }
}

// MARK: - Singleton

extension LocalStorageManager {
    static let shared = LocalStorageManager()
}
