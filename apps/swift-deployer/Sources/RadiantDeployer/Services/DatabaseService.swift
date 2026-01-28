import Foundation
import Darwin

actor DatabaseService {
    private let awsService: AWSService
    
    init(awsService: AWSService = AWSService()) {
        self.awsService = awsService
    }
    
    enum DatabaseError: Error, LocalizedError {
        case connectionFailed(String)
        case migrationFailed(String)
        case queryFailed(String)
        case invalidConfiguration
        case rdsDataApiError(String)
        
        var errorDescription: String? {
            switch self {
            case .connectionFailed(let message):
                return "Database connection failed: \(message)"
            case .migrationFailed(let message):
                return "Migration failed: \(message)"
            case .queryFailed(let message):
                return "Query failed: \(message)"
            case .invalidConfiguration:
                return "Invalid database configuration"
            case .rdsDataApiError(let message):
                return "RDS Data API error: \(message)"
            }
        }
    }
    
    struct DatabaseConfig: Codable, Sendable {
        let host: String
        let port: Int
        let database: String
        let username: String
        let password: String
        let sslMode: String
        let resourceArn: String?      // Aurora cluster ARN for RDS Data API
        let secretArn: String?        // Secrets Manager ARN for credentials
        
        var connectionString: String {
            "postgresql://\(username):\(password)@\(host):\(port)/\(database)?sslmode=\(sslMode)"
        }
        
        init(host: String, port: Int, database: String, username: String, password: String, sslMode: String, resourceArn: String? = nil, secretArn: String? = nil) {
            self.host = host
            self.port = port
            self.database = database
            self.username = username
            self.password = password
            self.sslMode = sslMode
            self.resourceArn = resourceArn
            self.secretArn = secretArn
        }
    }
    
    struct MigrationResult: Sendable {
        let migrationName: String
        let status: MigrationStatus
        let duration: TimeInterval
        let error: String?
    }
    
    enum MigrationStatus: String, Sendable {
        case pending
        case running
        case completed
        case failed
        case skipped
    }
    
    func testConnection(config: DatabaseConfig) async throws -> Bool {
        guard !config.host.isEmpty,
              config.port > 0,
              !config.database.isEmpty else {
            throw DatabaseError.invalidConfiguration
        }
        
        // Use RDS Data API if ARNs are provided
        if let resourceArn = config.resourceArn, let secretArn = config.secretArn {
            return try await testConnectionViaDataApi(
                resourceArn: resourceArn,
                secretArn: secretArn,
                database: config.database
            )
        }
        
        // Fallback: Test via network connectivity check
        return try await testConnectionViaTcp(config: config)
    }
    
    private func testConnectionViaDataApi(resourceArn: String, secretArn: String, database: String) async throws -> Bool {
        let result = await awsService.executeRdsStatement(
            resourceArn: resourceArn,
            secretArn: secretArn,
            database: database,
            sql: "SELECT 1 as health_check"
        )
        
        switch result {
        case .success:
            return true
        case .failure(let error):
            throw DatabaseError.connectionFailed(error.localizedDescription)
        }
    }
    
    private func testConnectionViaTcp(config: DatabaseConfig) async throws -> Bool {
        // Test TCP connectivity to the database host
        let host = config.host
        let port = UInt16(config.port)
        
        return await withCheckedContinuation { continuation in
            let queue = DispatchQueue(label: "db-connection-test")
            queue.async {
                var hints = addrinfo()
                hints.ai_family = AF_UNSPEC
                hints.ai_socktype = SOCK_STREAM
                
                var result: UnsafeMutablePointer<addrinfo>?
                let status = getaddrinfo(host, String(port), &hints, &result)
                
                if status != 0 {
                    continuation.resume(returning: false)
                    return
                }
                
                defer { freeaddrinfo(result) }
                
                guard let addrInfo = result else {
                    continuation.resume(returning: false)
                    return
                }
                
                let sock = socket(addrInfo.pointee.ai_family, addrInfo.pointee.ai_socktype, addrInfo.pointee.ai_protocol)
                if sock < 0 {
                    continuation.resume(returning: false)
                    return
                }
                
                defer { close(sock) }
                
                // Set socket to non-blocking for timeout
                let flags = fcntl(sock, F_GETFL, 0)
                _ = fcntl(sock, F_SETFL, flags | O_NONBLOCK)
                
                let connectResult = connect(sock, addrInfo.pointee.ai_addr, addrInfo.pointee.ai_addrlen)
                
                if connectResult == 0 {
                    continuation.resume(returning: true)
                    return
                }
                
                if errno == EINPROGRESS {
                    // Use poll() instead of select() for better portability
                    var pfd = pollfd(fd: sock, events: Int16(POLLOUT), revents: 0)
                    let pollResult = poll(&pfd, 1, 5000) // 5 second timeout
                    
                    continuation.resume(returning: pollResult > 0 && (pfd.revents & Int16(POLLOUT)) != 0)
                } else {
                    continuation.resume(returning: false)
                }
            }
        }
    }
    
    func getMigrationStatus(
        config: DatabaseConfig,
        migrationsPath: String
    ) async throws -> [MigrationResult] {
        let fileManager = FileManager.default
        let migrationsURL = URL(fileURLWithPath: migrationsPath)
        
        guard fileManager.fileExists(atPath: migrationsPath) else {
            throw DatabaseError.migrationFailed("Migrations directory not found: \(migrationsPath)")
        }
        
        let files = try fileManager.contentsOfDirectory(
            at: migrationsURL,
            includingPropertiesForKeys: nil
        ).filter { $0.pathExtension == "sql" }
         .sorted { $0.lastPathComponent < $1.lastPathComponent }
        
        // Get applied migrations from schema_migrations table
        var appliedMigrations: Set<String> = []
        
        if let resourceArn = config.resourceArn, let secretArn = config.secretArn {
            let result = await awsService.executeRdsStatement(
                resourceArn: resourceArn,
                secretArn: secretArn,
                database: config.database,
                sql: "SELECT migration_name FROM schema_migrations"
            )
            
            if case .success(let records) = result {
                for record in records {
                    if let name = record["migration_name"] as? String {
                        appliedMigrations.insert(name)
                    }
                }
            }
        }
        
        return files.map { file in
            let name = file.lastPathComponent
            let isApplied = appliedMigrations.contains(name)
            return MigrationResult(
                migrationName: name,
                status: isApplied ? .completed : .pending,
                duration: 0,
                error: nil
            )
        }
    }
    
    func runMigrations(
        config: DatabaseConfig,
        migrationsPath: String,
        progressHandler: @escaping (MigrationResult) -> Void
    ) async throws -> [MigrationResult] {
        let migrations = try await getMigrationStatus(
            config: config,
            migrationsPath: migrationsPath
        )
        
        var results: [MigrationResult] = []
        _ = FileManager.default // Reserved for future file operations
        
        for migration in migrations where migration.status == .pending {
            let startTime = Date()
            let migrationFile = URL(fileURLWithPath: migrationsPath).appendingPathComponent(migration.migrationName)
            
            // Report running status
            let runningResult = MigrationResult(
                migrationName: migration.migrationName,
                status: .running,
                duration: 0,
                error: nil
            )
            progressHandler(runningResult)
            
            do {
                // Read SQL file
                let sql = try String(contentsOf: migrationFile, encoding: .utf8)
                
                // Execute via RDS Data API if available
                if let resourceArn = config.resourceArn, let secretArn = config.secretArn {
                    let result = await awsService.executeRdsStatement(
                        resourceArn: resourceArn,
                        secretArn: secretArn,
                        database: config.database,
                        sql: sql
                    )
                    
                    if case .failure(let error) = result {
                        throw DatabaseError.migrationFailed(error.localizedDescription)
                    }
                    
                    // Record migration in schema_migrations
                    let recordSql = "INSERT INTO schema_migrations (migration_name, applied_at) VALUES ('\(migration.migrationName)', NOW())"
                    _ = await awsService.executeRdsStatement(
                        resourceArn: resourceArn,
                        secretArn: secretArn,
                        database: config.database,
                        sql: recordSql
                    )
                } else {
                    throw DatabaseError.invalidConfiguration
                }
                
                let completedResult = MigrationResult(
                    migrationName: migration.migrationName,
                    status: .completed,
                    duration: Date().timeIntervalSince(startTime),
                    error: nil
                )
                results.append(completedResult)
                progressHandler(completedResult)
                
            } catch {
                let failedResult = MigrationResult(
                    migrationName: migration.migrationName,
                    status: .failed,
                    duration: Date().timeIntervalSince(startTime),
                    error: error.localizedDescription
                )
                results.append(failedResult)
                progressHandler(failedResult)
                throw DatabaseError.migrationFailed("\(migration.migrationName): \(error.localizedDescription)")
            }
        }
        
        return results
    }
    
    func rollbackMigration(
        config: DatabaseConfig,
        migrationName: String
    ) async throws {
        guard let resourceArn = config.resourceArn, let secretArn = config.secretArn else {
            throw DatabaseError.invalidConfiguration
        }
        
        // Look for rollback file (e.g., 001_create_users.down.sql)
        let rollbackName = migrationName.replacingOccurrences(of: ".sql", with: ".down.sql")
        let migrationsPath = Bundle.main.resourcePath ?? ""
        let rollbackFile = URL(fileURLWithPath: migrationsPath).appendingPathComponent("migrations").appendingPathComponent(rollbackName)
        
        if FileManager.default.fileExists(atPath: rollbackFile.path) {
            let sql = try String(contentsOf: rollbackFile, encoding: .utf8)
            let result = await awsService.executeRdsStatement(
                resourceArn: resourceArn,
                secretArn: secretArn,
                database: config.database,
                sql: sql
            )
            
            if case .failure(let error) = result {
                throw DatabaseError.migrationFailed("Rollback failed: \(error.localizedDescription)")
            }
        }
        
        // Remove from schema_migrations
        let deleteSql = "DELETE FROM schema_migrations WHERE migration_name = '\(migrationName)'"
        _ = await awsService.executeRdsStatement(
            resourceArn: resourceArn,
            secretArn: secretArn,
            database: config.database,
            sql: deleteSql
        )
    }
    
    func seedDatabase(
        config: DatabaseConfig,
        seedPath: String,
        progressHandler: @escaping (String) -> Void
    ) async throws {
        let fileManager = FileManager.default
        
        guard fileManager.fileExists(atPath: seedPath) else {
            throw DatabaseError.migrationFailed("Seed file not found: \(seedPath)")
        }
        
        guard let resourceArn = config.resourceArn, let secretArn = config.secretArn else {
            throw DatabaseError.invalidConfiguration
        }
        
        progressHandler("Loading seed data from \(seedPath)...")
        
        let sql = try String(contentsOf: URL(fileURLWithPath: seedPath), encoding: .utf8)
        
        let result = await awsService.executeRdsStatement(
            resourceArn: resourceArn,
            secretArn: secretArn,
            database: config.database,
            sql: sql
        )
        
        if case .failure(let error) = result {
            throw DatabaseError.queryFailed("Seed failed: \(error.localizedDescription)")
        }
        
        progressHandler("Seed data loaded successfully")
    }
    
    func getDatabaseStats(config: DatabaseConfig) async throws -> DatabaseStats {
        guard let resourceArn = config.resourceArn, let secretArn = config.secretArn else {
            throw DatabaseError.invalidConfiguration
        }
        
        // Query pg_stat_* tables for real stats
        let statsSql = """
            SELECT 
                (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public') as table_count,
                pg_database_size(current_database()) / (1024 * 1024) as size_mb,
                (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) as connection_count,
                (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND state = 'active') as active_queries,
                version() as version
        """
        
        let result = await awsService.executeRdsStatement(
            resourceArn: resourceArn,
            secretArn: secretArn,
            database: config.database,
            sql: statsSql
        )
        
        switch result {
        case .success(let records):
            if let record = records.first {
                return DatabaseStats(
                    tableCount: record["table_count"] as? Int ?? 0,
                    totalSizeMB: record["size_mb"] as? Double ?? 0,
                    connectionCount: record["connection_count"] as? Int ?? 0,
                    activeQueries: record["active_queries"] as? Int ?? 0,
                    version: record["version"] as? String ?? "Unknown"
                )
            }
            fallthrough
        case .failure:
            return DatabaseStats(
                tableCount: 0,
                totalSizeMB: 0,
                connectionCount: 0,
                activeQueries: 0,
                version: "Unable to retrieve"
            )
        }
    }
}

struct DatabaseStats: Sendable {
    let tableCount: Int
    let totalSizeMB: Double
    let connectionCount: Int
    let activeQueries: Int
    let version: String
}
