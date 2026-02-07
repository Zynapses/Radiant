// RADIANT - Package Generator
// Creates new package versions from extracted instance state
// This is the key to bi-directional sync: instance state → deployable package

import Foundation

actor PackageGenerator {
    
    // MARK: - Types
    
    enum GenerationError: Error, LocalizedError {
        case extractionRequired
        case invalidDiff
        case copyFailed(String)
        case migrationGenerationFailed(String)
        case manifestCreationFailed(String)
        
        var errorDescription: String? {
            switch self {
            case .extractionRequired: return "Must extract instance state first"
            case .invalidDiff: return "Invalid diff report"
            case .copyFailed(let msg): return "Failed to copy files: \(msg)"
            case .migrationGenerationFailed(let msg): return "Failed to generate migration: \(msg)"
            case .manifestCreationFailed(let msg): return "Failed to create manifest: \(msg)"
            }
        }
    }
    
    struct GeneratedPackage: Codable, Sendable {
        let packagePath: URL
        let version: String
        let basedOnVersion: String
        let generatedAt: Date
        let includedChanges: IncludedChanges
        let manifestPath: URL
    }
    
    struct IncludedChanges: Codable, Sendable {
        var schemaChanges: Int
        var lambdaChanges: Int
        var newMigrations: [String]
        var copiedLambdaCode: [String]
    }
    
    struct PackageManifest: Codable, Sendable {
        let version: String
        let radiantVersion: String
        let generatedAt: Date
        let generatedFrom: String  // "instance" or "source"
        let sourceInstanceId: String?
        let sourceEnvironment: String?
        let previousVersion: String?
        let changelog: [String]
    }
    
    // MARK: - Properties
    
    private let outputDirectory: URL
    private let fileManager = FileManager.default
    
    // MARK: - Initialization
    
    init() {
        self.outputDirectory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            .appendingPathComponent("RadiantDeployer")
            .appendingPathComponent("generated-packages")
        
        try? fileManager.createDirectory(at: outputDirectory, withIntermediateDirectories: true)
    }
    
    // MARK: - Package Generation
    
    /// Generate a new package version from extracted instance state
    func generatePackage(
        from extractedState: InstanceStateExtractor.ExtractedInstanceState,
        diffReport: SchemaDiffGenerator.FullDiffReport,
        basePackagePath: URL,
        newVersion: String,
        onProgress: @escaping (String, Double) -> Void
    ) async throws -> GeneratedPackage {
        onProgress("Preparing package generation...", 0.0)
        
        // Create output directory for this package
        let packageDir = outputDirectory.appendingPathComponent("radiant-\(newVersion)")
        try? fileManager.removeItem(at: packageDir)
        try fileManager.createDirectory(at: packageDir, withIntermediateDirectories: true)
        
        var includedChanges = IncludedChanges(
            schemaChanges: 0,
            lambdaChanges: 0,
            newMigrations: [],
            copiedLambdaCode: []
        )
        
        // Step 1: Copy base package (30%)
        onProgress("Copying base package...", 0.05)
        try copyBasePackage(from: basePackagePath, to: packageDir)
        onProgress("Base package copied", 0.30)
        
        // Step 2: Generate and add new migration file (20%)
        if !diffReport.schemaDiffs.isEmpty {
            onProgress("Generating migration from schema diff...", 0.30)
            let migrationFile = try await generateMigration(
                diffReport: diffReport,
                packageDir: packageDir
            )
            includedChanges.schemaChanges = diffReport.schemaDiffs.count
            includedChanges.newMigrations.append(migrationFile.lastPathComponent)
            onProgress("Migration generated: \(migrationFile.lastPathComponent)", 0.50)
        }
        
        // Step 3: Copy Lambda code from instance (30%)
        if !diffReport.lambdaDiffs.isEmpty {
            onProgress("Copying Lambda code from instance...", 0.50)
            let copiedLambdas = try await copyLambdaCode(
                diffs: diffReport.lambdaDiffs,
                packageDir: packageDir
            )
            includedChanges.lambdaChanges = copiedLambdas.count
            includedChanges.copiedLambdaCode = copiedLambdas
            onProgress("Lambda code copied: \(copiedLambdas.count) functions", 0.80)
        }
        
        // Step 4: Update manifest (10%)
        onProgress("Updating package manifest...", 0.80)
        let manifestPath = try createManifest(
            packageDir: packageDir,
            newVersion: newVersion,
            extractedState: extractedState,
            diffReport: diffReport
        )
        onProgress("Manifest updated", 0.90)
        
        // Step 5: Validate package (10%)
        onProgress("Validating generated package...", 0.90)
        try validatePackage(at: packageDir)
        onProgress("Package validated", 1.0)
        
        let generatedPackage = GeneratedPackage(
            packagePath: packageDir,
            version: newVersion,
            basedOnVersion: diffReport.packageVersion,
            generatedAt: Date(),
            includedChanges: includedChanges,
            manifestPath: manifestPath
        )
        
        RadiantLogger.info("Generated package v\(newVersion) at: \(packageDir.path)", category: RadiantLogger.general)
        
        return generatedPackage
    }
    
    // MARK: - Copy Base Package
    
    private func copyBasePackage(from source: URL, to destination: URL) throws {
        let subdirs = ["infrastructure", "migrations", "lambda", "config", "admin-dashboard"]
        
        for subdir in subdirs {
            let sourceDir = source.appendingPathComponent(subdir)
            let destDir = destination.appendingPathComponent(subdir)
            
            if fileManager.fileExists(atPath: sourceDir.path) {
                try fileManager.copyItem(at: sourceDir, to: destDir)
            }
        }
        
        // Copy manifest if exists
        let manifestPath = source.appendingPathComponent("manifest.json")
        if fileManager.fileExists(atPath: manifestPath.path) {
            try fileManager.copyItem(at: manifestPath, to: destination.appendingPathComponent("manifest.json"))
        }
    }
    
    // MARK: - Generate Migration
    
    private func generateMigration(
        diffReport: SchemaDiffGenerator.FullDiffReport,
        packageDir: URL
    ) async throws -> URL {
        let migrationsDir = packageDir.appendingPathComponent("migrations")
        try fileManager.createDirectory(at: migrationsDir, withIntermediateDirectories: true)
        
        // Find the next migration number
        let existingMigrations = (try? fileManager.contentsOfDirectory(at: migrationsDir, includingPropertiesForKeys: nil)
            .filter { $0.pathExtension == "sql" }) ?? []
        
        let nextNumber = existingMigrations.count + 1
        let timestamp = DateFormatter.migrationVersion.string(from: Date())
        let filename = "V\(timestamp)_\(String(format: "%03d", nextNumber))__instance_extracted_changes.sql"
        let migrationFile = migrationsDir.appendingPathComponent(filename)
        
        var sql = """
        -- ============================================================
        -- Migration: \(filename)
        -- Generated from instance state extraction
        -- Date: \(DateFormatter.readable.string(from: Date()))
        -- Instance: \(diffReport.appId) / \(diffReport.environment)
        -- Based on version: \(diffReport.packageVersion)
        -- ============================================================
        
        -- This migration was auto-generated from changes detected on
        -- a running instance. Review carefully before applying.
        
        """
        
        // Group changes by type
        let tableChanges = diffReport.schemaDiffs.filter { $0.type == .tableAdded }
        let columnChanges = diffReport.schemaDiffs.filter { $0.type == .columnAdded || $0.type == .columnModified }
        let enumChanges = diffReport.schemaDiffs.filter { $0.type == .enumAdded || $0.type == .enumValueAdded }
        let otherChanges = diffReport.schemaDiffs.filter { 
            $0.type != .tableAdded && $0.type != .columnAdded && 
            $0.type != .columnModified && $0.type != .enumAdded && $0.type != .enumValueAdded
        }
        
        // Add enum changes first (dependencies)
        if !enumChanges.isEmpty {
            sql += "\n-- ====== ENUM CHANGES ======\n\n"
            for diff in enumChanges {
                sql += "-- \(diff.type.rawValue): \(diff.objectName)\n"
                sql += "\(diff.upSQL)\n\n"
            }
        }
        
        // Add table changes
        if !tableChanges.isEmpty {
            sql += "\n-- ====== NEW TABLES ======\n\n"
            for diff in tableChanges {
                sql += "-- \(diff.details)\n"
                sql += "\(diff.upSQL)\n\n"
            }
        }
        
        // Add column changes
        if !columnChanges.isEmpty {
            sql += "\n-- ====== COLUMN CHANGES ======\n\n"
            for diff in columnChanges {
                sql += "-- Table: \(diff.tableName ?? "unknown")\n"
                sql += "-- \(diff.details)\n"
                sql += "\(diff.upSQL)\n\n"
            }
        }
        
        // Add other changes
        if !otherChanges.isEmpty {
            sql += "\n-- ====== OTHER CHANGES ======\n\n"
            for diff in otherChanges {
                if diff.isDestructive {
                    sql += "-- ⚠️ DESTRUCTIVE: "
                }
                sql += "-- \(diff.type.rawValue): \(diff.objectName)\n"
                sql += "\(diff.upSQL)\n\n"
            }
        }
        
        // Add rollback reference
        sql += """
        
        -- ============================================================
        -- ROLLBACK REFERENCE (do not run - for documentation only)
        -- ============================================================
        /*
        """
        
        for diff in diffReport.schemaDiffs.reversed() {
            sql += "\n\(diff.downSQL)"
        }
        
        sql += "\n*/\n"
        
        try sql.write(to: migrationFile, atomically: true, encoding: .utf8)
        
        return migrationFile
    }
    
    // MARK: - Copy Lambda Code
    
    private func copyLambdaCode(
        diffs: [SchemaDiffGenerator.LambdaDiff],
        packageDir: URL
    ) async throws -> [String] {
        let lambdaDir = packageDir.appendingPathComponent("lambda")
        try fileManager.createDirectory(at: lambdaDir, withIntermediateDirectories: true)
        
        var copiedFunctions: [String] = []
        
        for diff in diffs {
            guard diff.changeType == .added || diff.changeType == .codeChanged,
                  let instanceCodePath = diff.instanceCodePath else {
                continue
            }
            
            let destDir = lambdaDir.appendingPathComponent(diff.functionName)
            
            // Remove existing if present
            try? fileManager.removeItem(at: destDir)
            
            // Copy from instance extraction
            try fileManager.copyItem(
                at: URL(fileURLWithPath: instanceCodePath),
                to: destDir
            )
            
            copiedFunctions.append(diff.functionName)
            
            RadiantLogger.info("Copied Lambda code: \(diff.functionName)", category: RadiantLogger.general)
        }
        
        return copiedFunctions
    }
    
    // MARK: - Create Manifest
    
    private func createManifest(
        packageDir: URL,
        newVersion: String,
        extractedState: InstanceStateExtractor.ExtractedInstanceState,
        diffReport: SchemaDiffGenerator.FullDiffReport
    ) throws -> URL {
        var changelog: [String] = []
        
        // Build changelog from diff
        if diffReport.schemaDiffs.contains(where: { $0.type == .tableAdded }) {
            let tables = diffReport.schemaDiffs.filter { $0.type == .tableAdded }.map { $0.objectName }
            changelog.append("Added tables: \(tables.joined(separator: ", "))")
        }
        
        if diffReport.schemaDiffs.contains(where: { $0.type == .columnAdded }) {
            let count = diffReport.schemaDiffs.filter { $0.type == .columnAdded }.count
            changelog.append("Added \(count) new columns")
        }
        
        if !diffReport.lambdaDiffs.isEmpty {
            let added = diffReport.lambdaDiffs.filter { $0.changeType == .added }.count
            let modified = diffReport.lambdaDiffs.filter { $0.changeType == .codeChanged }.count
            if added > 0 { changelog.append("Added \(added) Lambda functions") }
            if modified > 0 { changelog.append("Updated \(modified) Lambda functions") }
        }
        
        if diffReport.schemaDiffs.contains(where: { $0.type == .enumAdded || $0.type == .enumValueAdded }) {
            changelog.append("Added/updated enum types")
        }
        
        let manifest = PackageManifest(
            version: newVersion,
            radiantVersion: RADIANT_VERSION,
            generatedAt: Date(),
            generatedFrom: "instance",
            sourceInstanceId: extractedState.appId,
            sourceEnvironment: extractedState.environment,
            previousVersion: diffReport.packageVersion,
            changelog: changelog
        )
        
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        
        let data = try encoder.encode(manifest)
        let manifestPath = packageDir.appendingPathComponent("manifest.json")
        try data.write(to: manifestPath)
        
        return manifestPath
    }
    
    // MARK: - Validate Package
    
    private func validatePackage(at packageDir: URL) throws {
        // Check required directories exist
        let required = ["migrations"]
        
        for dir in required {
            let path = packageDir.appendingPathComponent(dir)
            guard fileManager.fileExists(atPath: path.path) else {
                throw GenerationError.copyFailed("Missing required directory: \(dir)")
            }
        }
        
        // Check manifest exists
        let manifestPath = packageDir.appendingPathComponent("manifest.json")
        guard fileManager.fileExists(atPath: manifestPath.path) else {
            throw GenerationError.manifestCreationFailed("Manifest not found")
        }
        
        // Validate manifest is valid JSON
        let data = try Data(contentsOf: manifestPath)
        _ = try JSONDecoder().decode(PackageManifest.self, from: data)
    }
    
    // MARK: - List Generated Packages
    
    func listGeneratedPackages() -> [URL] {
        (try? fileManager.contentsOfDirectory(at: outputDirectory, includingPropertiesForKeys: nil)
            .filter { $0.hasDirectoryPath && $0.lastPathComponent.hasPrefix("radiant-") }
            .sorted { $0.lastPathComponent > $1.lastPathComponent }) ?? []
    }
    
    /// Calculate next version number
    func suggestNextVersion(currentVersion: String) -> String {
        let parts = currentVersion.split(separator: ".").compactMap { Int($0) }
        
        guard parts.count >= 3 else {
            return "\(currentVersion).1"
        }
        
        // Increment patch version
        return "\(parts[0]).\(parts[1]).\(parts[2] + 1)"
    }
}

// MARK: - Date Formatter Extension

extension DateFormatter {
    static let migrationVersion: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy_MM_dd"
        return f
    }()
}

// MARK: - Singleton

extension PackageGenerator {
    static let shared = PackageGenerator()
}
