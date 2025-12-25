// RADIANT v4.18.0 - Package Service
// Handles deployment package discovery, download, verification, and caching

import Foundation
import CryptoKit

// MARK: - Package Errors

enum PackageError: Error, LocalizedError {
    case notFound(String)
    case downloadFailed(String)
    case integrityCheckFailed
    case invalidManifest(String)
    case extractionFailed(String)
    case cacheError(String)
    case networkError(Error)
    case notPublished(String)
    case deprecated(String)
    case notDeployable(String)
    
    var errorDescription: String? {
        switch self {
        case .notFound(let version):
            return "Package not found: \(version)"
        case .downloadFailed(let reason):
            return "Download failed: \(reason)"
        case .integrityCheckFailed:
            return "Package integrity check failed - hash mismatch"
        case .invalidManifest(let reason):
            return "Invalid package manifest: \(reason)"
        case .extractionFailed(let reason):
            return "Package extraction failed: \(reason)"
        case .cacheError(let reason):
            return "Cache error: \(reason)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .notPublished(let version):
            return "Package v\(version) is not published. Only published packages can be deployed."
        case .deprecated(let version):
            return "Package v\(version) is deprecated and cannot be deployed."
        case .notDeployable(let version):
            return "Package v\(version) is not deployable. It must be published and not deprecated."
        }
    }
}

// MARK: - Release Channel

enum ReleaseChannel: String, Codable, Sendable {
    case stable = "stable"
    case beta = "beta"
    case archive = "archive"
    
    var displayName: String {
        switch self {
        case .stable: return "Stable"
        case .beta: return "Beta"
        case .archive: return "Archive"
        }
    }
}

// MARK: - Package Info (metadata without full package)

struct PackageInfo: Codable, Sendable, Identifiable, Hashable {
    var id: String { "\(version)-\(buildId)" }
    
    let version: String
    let buildId: String
    let buildTimestamp: Date
    let packageHash: String
    let filename: String
    let size: Int64
    let channel: ReleaseChannel
    let bucket: String
    let key: String
    
    var displayName: String {
        "RADIANT v\(version) (\(buildId))"
    }
    
    func hash(into hasher: inout Hasher) {
        hasher.combine(packageHash)
    }
    
    static func == (lhs: PackageInfo, rhs: PackageInfo) -> Bool {
        lhs.packageHash == rhs.packageHash
    }
}

// MARK: - Package Manifest

struct PackageManifest: Codable, Sendable {
    let packageFormat: String
    let version: String
    let buildId: String
    let buildTimestamp: Date
    let buildHost: String
    
    let components: ComponentVersions
    let migrations: MigrationInfo
    let dependencies: DependencyInfo
    let compatibility: CompatibilityInfo
    let integrity: IntegrityInfo
    let installBehavior: InstallBehavior
    let updateBehavior: UpdateBehavior
    let rollbackBehavior: RollbackBehavior
    
    struct ComponentVersions: Codable, Sendable {
        let radiantPlatform: ComponentInfo
        let thinkTank: ComponentInfo?
        
        struct ComponentInfo: Codable, Sendable {
            let version: String
            let minUpgradeFrom: String?
            let changelog: String?
        }
    }
    
    struct MigrationInfo: Codable, Sendable {
        let radiant: MigrationRange?
        let thinktank: MigrationRange?
        
        struct MigrationRange: Codable, Sendable {
            let from: String
            let to: String
            let files: [String]
        }
    }
    
    struct DependencyInfo: Codable, Sendable {
        let awsCdk: String
        let nodejs: String
        let postgresql: String
    }
    
    struct CompatibilityInfo: Codable, Sendable {
        let minimumDeployerVersion: String
        let supportedTiers: [String]
        let supportedRegions: [String]
    }
    
    struct IntegrityInfo: Codable, Sendable {
        let algorithm: String
        let packageHash: String
        let signedBy: String?
        let signature: String?
    }
    
    struct InstallBehavior: Codable, Sendable {
        let seedAIRegistry: Bool
        let createInitialAdmin: Bool
        let runFullMigrations: Bool
    }
    
    struct UpdateBehavior: Codable, Sendable {
        let seedAIRegistry: Bool
        let preserveAdminCustomizations: Bool
        let runIncrementalMigrations: Bool
        let createPreUpdateSnapshot: Bool
    }
    
    struct RollbackBehavior: Codable, Sendable {
        let supportedFromVersions: [String]
        let requiresDatabaseRollback: Bool
    }
}

// MARK: - Deployment Package (full loaded package)

struct DeploymentPackage: Sendable {
    let manifest: PackageManifest
    let extractedPath: URL
    let originalPath: URL
    
    var infrastructurePath: URL {
        extractedPath.appendingPathComponent("infrastructure")
    }
    
    var migrationsPath: URL {
        extractedPath.appendingPathComponent("migrations")
    }
    
    var functionsPath: URL {
        extractedPath.appendingPathComponent("functions")
    }
    
    var adminDashboardPath: URL {
        extractedPath.appendingPathComponent("admin-dashboard")
    }
    
    var configPath: URL {
        extractedPath.appendingPathComponent("config")
    }
}

// MARK: - Package Index (for caching)

struct PackageIndex: Codable, Sendable {
    var packages: [PackageInfo]
    var lastUpdated: Date
}

// MARK: - Package Source

enum PackageSource: String, Codable, Sendable {
    case local = "local"
    case s3 = "s3"
    case github = "github"
}

// MARK: - Package Service

actor PackageService {
    
    private let fileManager = FileManager.default
    private let cacheDirectory: URL
    private let awsService: AWSService
    private let githubRegistry: GitHubPackageRegistry
    
    private var packageIndex: PackageIndex?
    
    init() {
        // ~/Library/Application Support/RadiantDeployer/packages/
        let appSupport = FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        )[0]
        
        self.cacheDirectory = appSupport
            .appendingPathComponent("RadiantDeployer")
            .appendingPathComponent("packages")
        
        self.awsService = AWSService()
        self.githubRegistry = GitHubPackageRegistry()
        
        // Ensure cache directory exists
        try? fileManager.createDirectory(
            at: cacheDirectory,
            withIntermediateDirectories: true
        )
    }
    
    // MARK: - Package Discovery
    
    /// List available packages from all sources (GitHub preferred, then S3, then local)
    func listAvailablePackages(forceRefresh: Bool = false) async throws -> [PackageInfo] {
        if !forceRefresh, let index = packageIndex, 
           Date().timeIntervalSince(index.lastUpdated) < 300 {
            return index.packages
        }
        
        var packages: [PackageInfo] = []
        
        // 1. Local cache
        let localPackages = try listLocalPackages()
        packages.append(contentsOf: localPackages)
        
        // 2. GitHub Registry (preferred source if configured)
        do {
            let githubPackages = try await listGitHubPackages()
            packages.append(contentsOf: githubPackages)
        } catch {
            // Continue if GitHub not configured or fails
        }
        
        // 3. Official S3 release bucket (stable + beta)
        do {
            let stablePackages = try await listRemotePackages(channel: .stable)
            packages.append(contentsOf: stablePackages)
        } catch {
            // Continue with local packages if network fails
        }
        
        do {
            let betaPackages = try await listRemotePackages(channel: .beta)
            packages.append(contentsOf: betaPackages)
        } catch {
            // Continue if beta fetch fails
        }
        
        // Deduplicate by package hash, preferring GitHub source
        let uniquePackages = deduplicatePackages(packages)
        
        // Update index
        packageIndex = PackageIndex(packages: uniquePackages, lastUpdated: Date())
        
        // Persist index
        try savePackageIndex()
        
        return uniquePackages
    }
    
    /// List packages from GitHub registry
    private func listGitHubPackages() async throws -> [PackageInfo] {
        let entries = try await githubRegistry.listPackages()
        
        return entries.map { entry in
            PackageInfo(
                version: entry.version,
                buildId: entry.buildId,
                buildTimestamp: entry.createdAt,
                packageHash: entry.sha256,
                filename: URL(string: entry.packagePath)?.lastPathComponent ?? "unknown.radpkg",
                size: entry.size,
                channel: ReleaseChannel(rawValue: entry.channel) ?? .stable,
                bucket: "github",
                key: entry.packagePath
            )
        }
    }
    
    /// Deduplicate packages, preferring GitHub source
    private func deduplicatePackages(_ packages: [PackageInfo]) -> [PackageInfo] {
        var seen: [String: PackageInfo] = [:]
        
        for package in packages {
            let key = "\(package.version)-\(package.buildId)"
            
            // Prefer GitHub packages over S3/local
            if let existing = seen[key] {
                if package.bucket == "github" && existing.bucket != "github" {
                    seen[key] = package
                }
            } else {
                seen[key] = package
            }
        }
        
        return Array(seen.values).sorted { $0.buildTimestamp > $1.buildTimestamp }
    }
    
    /// Download package from appropriate source
    func downloadPackageFromSource(info: PackageInfo) async throws -> DeploymentPackage {
        if info.bucket == "github" {
            return try await downloadFromGitHub(info: info)
        } else {
            return try await downloadPackage(info: info)
        }
    }
    
    /// Download package from GitHub
    private func downloadFromGitHub(info: PackageInfo) async throws -> DeploymentPackage {
        // Find the entry in GitHub registry
        let entries = try await githubRegistry.listPackages()
        guard let entry = entries.first(where: { $0.version == info.version && $0.buildId == info.buildId }) else {
            throw PackageError.notFound(info.version)
        }
        
        // Download package data
        let data = try await githubRegistry.downloadPackage(entry: entry)
        
        // Save to local cache
        let localPath = cacheDirectory.appendingPathComponent(info.filename)
        try data.write(to: localPath)
        
        // Load and return package
        return try loadPackage(from: localPath)
    }
    
    /// List packages in local cache
    private func listLocalPackages() throws -> [PackageInfo] {
        var packages: [PackageInfo] = []
        
        let contents = try fileManager.contentsOfDirectory(
            at: cacheDirectory,
            includingPropertiesForKeys: [.fileSizeKey, .creationDateKey]
        )
        
        for url in contents where url.pathExtension == "radpkg" {
            if let info = try? loadPackageInfo(from: url) {
                packages.append(info)
            }
        }
        
        return packages
    }
    
    /// List packages from S3 release bucket
    private func listRemotePackages(channel: ReleaseChannel) async throws -> [PackageInfo] {
        let region = "us-east-1"  // Release bucket region
        let bucket = "radiant-releases-\(region)"
        let prefix = "\(channel.rawValue)/"
        
        let keys = await awsService.listObjects(bucket: bucket, prefix: prefix)
        
        var packages: [PackageInfo] = []
        
        for key in keys where key.hasSuffix(".radpkg") {
            // Parse version from filename: radiant-4.18.0-abc123.radpkg
            let filename = URL(string: key)?.lastPathComponent ?? key
            if let info = parsePackageInfoFromFilename(
                filename: filename,
                channel: channel,
                bucket: bucket,
                key: key
            ) {
                packages.append(info)
            }
        }
        
        return packages
    }
    
    /// Parse package info from filename
    private func parsePackageInfoFromFilename(
        filename: String,
        channel: ReleaseChannel,
        bucket: String,
        key: String
    ) -> PackageInfo? {
        // Format: radiant-4.18.0-abc123.radpkg
        let pattern = #"radiant-(\d+\.\d+\.\d+)-([a-f0-9]+)\.radpkg"#
        
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(
                in: filename,
                range: NSRange(filename.startIndex..., in: filename)
              ),
              let versionRange = Range(match.range(at: 1), in: filename),
              let buildIdRange = Range(match.range(at: 2), in: filename) else {
            return nil
        }
        
        let version = String(filename[versionRange])
        let buildId = String(filename[buildIdRange])
        
        return PackageInfo(
            version: version,
            buildId: buildId,
            buildTimestamp: Date(),  // Would be fetched from S3 metadata
            packageHash: "",  // Would be fetched from manifest
            filename: filename,
            size: 0,  // Would be fetched from S3
            channel: channel,
            bucket: bucket,
            key: key
        )
    }
    
    /// Get latest stable package info
    func getLatestStable() async throws -> PackageInfo {
        let region = "us-east-1"
        let bucket = "radiant-releases-\(region)"
        let key = "stable/latest.json"
        
        guard let data = await awsService.getObject(bucket: bucket, key: key) else {
            throw PackageError.notFound("latest stable")
        }
        
        return try JSONDecoder().decode(PackageInfo.self, from: data)
    }
    
    /// Download latest package with progress callback
    func downloadLatestPackage(
        channel: ReleaseChannel,
        onProgress: @escaping (Double) -> Void
    ) async throws -> PackageInfo {
        // Try to get latest.json first
        let region = "us-east-1"
        let bucket = "radiant-releases-\(region)"
        let latestKey = "\(channel.rawValue)/latest.json"
        
        var packageInfo: PackageInfo
        
        if let data = await awsService.getObject(bucket: bucket, key: latestKey),
           let info = try? JSONDecoder().decode(PackageInfo.self, from: data) {
            packageInfo = info
        } else {
            // Fallback to listing packages and getting the newest
            let packages = try await listRemotePackages(channel: channel)
            guard let latest = packages.sorted(by: { $0.buildTimestamp > $1.buildTimestamp }).first else {
                throw PackageError.notFound("No packages found in \(channel.rawValue) channel")
            }
            packageInfo = latest
        }
        
        // Download with progress
        let localPath = cacheDirectory.appendingPathComponent(packageInfo.filename)
        
        // Check cache first
        if fileManager.fileExists(atPath: localPath.path) {
            onProgress(1.0)
            return packageInfo
        }
        
        // Download from S3 with progress simulation
        onProgress(0.1)
        
        guard let data = await awsService.getObject(bucket: packageInfo.bucket, key: packageInfo.key) else {
            throw PackageError.downloadFailed("Failed to download from S3: \(packageInfo.key)")
        }
        
        onProgress(0.8)
        
        try data.write(to: localPath)
        
        onProgress(1.0)
        
        // Update package info with actual values
        let attributes = try fileManager.attributesOfItem(atPath: localPath.path)
        let size = attributes[.size] as? Int64 ?? packageInfo.size
        
        return PackageInfo(
            version: packageInfo.version,
            buildId: packageInfo.buildId,
            buildTimestamp: packageInfo.buildTimestamp,
            packageHash: packageInfo.packageHash,
            filename: packageInfo.filename,
            size: size,
            channel: channel,
            bucket: packageInfo.bucket,
            key: packageInfo.key
        )
    }
    
    /// Verify package integrity
    func verifyPackage(_ info: PackageInfo) async throws -> Bool {
        let localPath = cacheDirectory.appendingPathComponent(info.filename)
        
        guard fileManager.fileExists(atPath: localPath.path) else {
            throw PackageError.notFound(info.filename)
        }
        
        // If no hash provided, just check the file exists and is valid
        if info.packageHash.isEmpty {
            // Try to load the package to verify it's valid
            do {
                let _ = try loadPackage(from: localPath)
                return true
            } catch {
                return false
            }
        }
        
        // Verify hash
        guard let data = try? Data(contentsOf: localPath) else {
            return false
        }
        
        let hash = SHA256.hash(data: data)
        let hashString = hash.compactMap { String(format: "%02x", $0) }.joined()
        
        return hashString == info.packageHash
    }
    
    // MARK: - Package Download
    
    /// Download package to local cache
    func downloadPackage(info: PackageInfo) async throws -> DeploymentPackage {
        let localPath = cacheDirectory.appendingPathComponent(info.filename)
        
        // Check if already cached
        if fileManager.fileExists(atPath: localPath.path) {
            let cachedPackage = try loadPackage(from: localPath)
            
            // Verify integrity if hash is available
            if !info.packageHash.isEmpty {
                if cachedPackage.manifest.integrity.packageHash == info.packageHash {
                    return cachedPackage
                } else {
                    // Hash mismatch - re-download
                    try fileManager.removeItem(at: localPath)
                }
            } else {
                return cachedPackage
            }
        }
        
        // Download from S3
        guard let data = await awsService.getObject(bucket: info.bucket, key: info.key) else {
            throw PackageError.downloadFailed("Failed to download from S3")
        }
        
        try data.write(to: localPath)
        
        // Load and verify after download
        let package = try loadPackage(from: localPath)
        
        if !info.packageHash.isEmpty {
            guard verifyPackageIntegrity(package, expectedHash: info.packageHash) else {
                try fileManager.removeItem(at: localPath)
                throw PackageError.integrityCheckFailed
            }
        }
        
        return package
    }
    
    /// Download package by version
    func downloadPackage(version: String, channel: ReleaseChannel = .stable) async throws -> DeploymentPackage {
        let packages = try await listAvailablePackages()
        
        guard let info = packages.first(where: { 
            $0.version == version && $0.channel == channel 
        }) else {
            throw PackageError.notFound(version)
        }
        
        return try await downloadPackage(info: info)
    }
    
    // MARK: - Package Loading
    
    /// Load and parse a deployment package from disk
    func loadPackage(from url: URL) throws -> DeploymentPackage {
        // Packages are zip files with .radpkg extension
        let tempDir = fileManager.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
        
        try fileManager.createDirectory(
            at: tempDir,
            withIntermediateDirectories: true
        )
        
        // Unzip package
        try unzipPackage(from: url, to: tempDir)
        
        // Load manifest
        let manifestPath = tempDir.appendingPathComponent("manifest.json")
        let manifestData = try Data(contentsOf: manifestPath)
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        
        let manifest = try decoder.decode(PackageManifest.self, from: manifestData)
        
        // Verify checksums
        try verifyChecksums(in: tempDir)
        
        return DeploymentPackage(
            manifest: manifest,
            extractedPath: tempDir,
            originalPath: url
        )
    }
    
    /// Load package info without full extraction
    private func loadPackageInfo(from url: URL) throws -> PackageInfo {
        let package = try loadPackage(from: url)
        
        let attributes = try fileManager.attributesOfItem(atPath: url.path)
        let size = attributes[.size] as? Int64 ?? 0
        
        return PackageInfo(
            version: package.manifest.version,
            buildId: package.manifest.buildId,
            buildTimestamp: package.manifest.buildTimestamp,
            packageHash: package.manifest.integrity.packageHash,
            filename: url.lastPathComponent,
            size: size,
            channel: .stable,  // Local packages assumed stable
            bucket: "",
            key: url.path
        )
    }
    
    // MARK: - Package Extraction
    
    /// Unzip package archive
    private func unzipPackage(from source: URL, to destination: URL) throws {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/unzip")
        process.arguments = ["-q", "-o", source.path, "-d", destination.path]
        
        let pipe = Pipe()
        process.standardError = pipe
        
        try process.run()
        process.waitUntilExit()
        
        if process.terminationStatus != 0 {
            let errorData = pipe.fileHandleForReading.readDataToEndOfFile()
            let errorMessage = String(data: errorData, encoding: .utf8) ?? "Unknown error"
            throw PackageError.extractionFailed(errorMessage)
        }
    }
    
    // MARK: - Integrity Verification
    
    /// Verify package hash
    private func verifyPackageIntegrity(_ package: DeploymentPackage, expectedHash: String) -> Bool {
        guard let data = try? Data(contentsOf: package.originalPath) else {
            return false
        }
        
        let hash = SHA256.hash(data: data)
        let hashString = hash.compactMap { String(format: "%02x", $0) }.joined()
        
        return hashString == expectedHash
    }
    
    /// Verify internal checksums
    private func verifyChecksums(in directory: URL) throws {
        let checksumsPath = directory.appendingPathComponent("checksums.sha256")
        
        guard fileManager.fileExists(atPath: checksumsPath.path) else {
            return  // No checksums file - skip verification
        }
        
        let content = try String(contentsOf: checksumsPath, encoding: .utf8)
        let lines = content.split(separator: "\n")
        
        for line in lines {
            let parts = line.split(separator: " ", maxSplits: 1)
            guard parts.count == 2 else { continue }
            
            let expectedHash = String(parts[0])
            var filePath = String(parts[1])
            
            // Remove leading "./" if present
            if filePath.hasPrefix("./") {
                filePath = String(filePath.dropFirst(2))
            }
            
            let fileURL = directory.appendingPathComponent(filePath)
            
            guard let data = try? Data(contentsOf: fileURL) else {
                continue  // Skip missing files
            }
            
            let hash = SHA256.hash(data: data)
            let hashString = hash.compactMap { String(format: "%02x", $0) }.joined()
            
            if hashString != expectedHash {
                throw PackageError.integrityCheckFailed
            }
        }
    }
    
    // MARK: - Cache Management
    
    /// Save package index to disk
    private func savePackageIndex() throws {
        guard let index = packageIndex else { return }
        
        let indexPath = cacheDirectory.appendingPathComponent("index.json")
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        
        let data = try encoder.encode(index)
        try data.write(to: indexPath)
    }
    
    /// Load package index from disk
    private func loadPackageIndex() throws {
        let indexPath = cacheDirectory.appendingPathComponent("index.json")
        
        guard fileManager.fileExists(atPath: indexPath.path) else {
            return
        }
        
        let data = try Data(contentsOf: indexPath)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        
        packageIndex = try decoder.decode(PackageIndex.self, from: data)
    }
    
    /// Clear local cache
    func clearCache() throws {
        let contents = try fileManager.contentsOfDirectory(
            at: cacheDirectory,
            includingPropertiesForKeys: nil
        )
        
        for url in contents {
            try fileManager.removeItem(at: url)
        }
        
        packageIndex = nil
    }
    
    /// Get cache size
    func getCacheSize() throws -> Int64 {
        var totalSize: Int64 = 0
        
        let contents = try fileManager.contentsOfDirectory(
            at: cacheDirectory,
            includingPropertiesForKeys: [.fileSizeKey]
        )
        
        for url in contents {
            let attributes = try fileManager.attributesOfItem(atPath: url.path)
            if let size = attributes[.size] as? Int64 {
                totalSize += size
            }
        }
        
        return totalSize
    }
    
    // MARK: - Snapshot Package Storage
    
    /// Upload package to instance snapshot storage
    func uploadPackageForSnapshot(
        package: DeploymentPackage,
        app: ManagedApp,
        environment: DeployEnvironment,
        snapshotId: String
    ) async throws {
        let bucket = "radiant-\(app.id)-\(environment.rawValue.lowercased())-deployments"
        let key = "snapshots/\(snapshotId)/package.radpkg"
        
        let data = try Data(contentsOf: package.originalPath)
        await awsService.putObject(bucket: bucket, key: key, data: data)
    }
    
    /// Download package from snapshot
    func downloadPackageFromSnapshot(
        app: ManagedApp,
        environment: DeployEnvironment,
        snapshotId: String
    ) async throws -> DeploymentPackage {
        let bucket = "radiant-\(app.id)-\(environment.rawValue.lowercased())-deployments"
        let key = "snapshots/\(snapshotId)/package.radpkg"
        
        guard let data = await awsService.getObject(bucket: bucket, key: key) else {
            throw PackageError.notFound("snapshot package: \(snapshotId)")
        }
        
        // Save to temp file and load
        let tempPath = fileManager.temporaryDirectory
            .appendingPathComponent("\(snapshotId).radpkg")
        
        try data.write(to: tempPath)
        
        return try loadPackage(from: tempPath)
    }
    
    // MARK: - Deployment Validation
    
    /// Validate that a package version is deployable (published and not deprecated)
    func validateDeployable(version: String) async throws {
        let registry = GitHubPackageRegistry()
        
        // Try to load config - if not configured, allow deployment (fallback to S3-only)
        guard let _ = try? await registry.loadConfig() else {
            return
        }
        
        let isDeployable = await registry.isVersionDeployable(version)
        if !isDeployable {
            // Check specific reason
            let allPackages = await registry.getDeployablePackages()
            if let pkg = allPackages.first(where: { $0.version == version }) {
                if pkg.isDeprecated == true {
                    throw PackageError.deprecated(version)
                }
                if pkg.isPublished != true {
                    throw PackageError.notPublished(version)
                }
            }
            throw PackageError.notDeployable(version)
        }
    }
    
    /// Get list of deployable package versions
    func getDeployableVersions() async throws -> [String] {
        let registry = GitHubPackageRegistry()
        _ = try? await registry.loadConfig()
        let packages = await registry.getDeployablePackages()
        return packages.map { $0.version }
    }
    
    /// Download latest deployable package (published and not deprecated)
    func downloadLatestDeployablePackage(
        channel: ReleaseChannel,
        onProgress: @escaping (Double) -> Void
    ) async throws -> PackageInfo {
        let registry = GitHubPackageRegistry()
        _ = try? await registry.loadConfig()
        
        // Get deployable packages from registry
        let allDeployable = await registry.getDeployablePackages()
        let deployable = allDeployable
            .filter { $0.channel == channel.rawValue }
            .sorted { ($0.version) > ($1.version) }
        
        if let latest = deployable.first {
            // Use registry package
            onProgress(0.1)
            
            // Download from local cache or registry
            let localPath = cacheDirectory.appendingPathComponent("radiant-\(latest.version)-\(latest.buildId).radpkg")
            
            if fileManager.fileExists(atPath: localPath.path) {
                onProgress(1.0)
                return PackageInfo(
                    version: latest.version,
                    buildId: latest.buildId,
                    buildTimestamp: latest.createdAt,
                    packageHash: latest.sha256,
                    filename: localPath.lastPathComponent,
                    size: latest.size,
                    channel: channel,
                    bucket: "",
                    key: localPath.path
                )
            }
            
            // Try to sync from GitHub registry
            _ = try await registry.syncFromGitHub(localCacheURL: cacheDirectory) { _, progress in
                onProgress(0.1 + progress * 0.8)
            }
            
            onProgress(1.0)
            
            return PackageInfo(
                version: latest.version,
                buildId: latest.buildId,
                buildTimestamp: latest.createdAt,
                packageHash: latest.sha256,
                filename: "radiant-\(latest.version)-\(latest.buildId).radpkg",
                size: latest.size,
                channel: channel,
                bucket: "",
                key: localPath.path
            )
        }
        
        // Fallback to S3 if no registry packages available
        return try await downloadLatestPackage(channel: channel, onProgress: onProgress)
    }
}
