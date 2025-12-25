// RADIANT v4.18.0 - GitHub Package Registry Service
// Manages deployment packages via private GitHub repository

import Foundation

// MARK: - GitHub Package Registry

actor GitHubPackageRegistry {
    
    // MARK: - Types
    
    enum GitHubError: Error, LocalizedError {
        case notConfigured
        case authenticationFailed
        case repositoryNotFound
        case packageNotFound(String)
        case uploadFailed(String)
        case networkError(Error)
        case invalidResponse
        case rateLimited
        case lfsNotEnabled
        
        var errorDescription: String? {
            switch self {
            case .notConfigured:
                return "GitHub repository not configured. Please set up in Settings."
            case .authenticationFailed:
                return "GitHub authentication failed. Check your Personal Access Token."
            case .repositoryNotFound:
                return "GitHub repository not found or you don't have access."
            case .packageNotFound(let version):
                return "Package version \(version) not found in repository."
            case .uploadFailed(let reason):
                return "Failed to upload package: \(reason)"
            case .networkError(let error):
                return "Network error: \(error.localizedDescription)"
            case .invalidResponse:
                return "Invalid response from GitHub API"
            case .rateLimited:
                return "GitHub API rate limit exceeded. Please wait and try again."
            case .lfsNotEnabled:
                return "Git LFS is not enabled. Large package files require LFS."
            }
        }
    }
    
    struct GitHubConfig: Codable, Sendable {
        var owner: String
        var repo: String
        var branch: String
        var personalAccessToken: String
        
        var repoFullName: String { "\(owner)/\(repo)" }
        
        static let defaultRepo = "radiant-packages"
        static let defaultBranch = "main"
    }
    
    struct RegistryIndex: Codable, Sendable {
        var schemaVersion: String
        var lastUpdated: Date
        var packages: [PackageEntry]
        
        struct PackageEntry: Codable, Sendable, Identifiable {
            var id: String { "\(version)-\(buildId)" }
            let version: String
            let buildId: String
            let channel: String
            let createdAt: Date
            let createdBy: String
            let changelog: String?
            let releaseNotes: String?
            let packagePath: String
            let manifestPath: String
            let sha256: String
            let size: Int64
            let isCustom: Bool
            let parentVersion: String?
            var isDeprecated: Bool?
            var deprecatedAt: Date?
            var deprecatedBy: String?
            var deprecationReason: String?
            var replacementVersion: String?
            var isPublished: Bool?
            var publishedAt: Date?
            var publishedBy: String?
            
            /// Check if package can be deployed (published and not deprecated)
            var isDeployable: Bool {
                (isPublished == true) && (isDeprecated != true)
            }
        }
        
        static var empty: RegistryIndex {
            RegistryIndex(
                schemaVersion: "1.0",
                lastUpdated: Date(),
                packages: []
            )
        }
    }
    
    // MARK: - Package History (Versioned in GitHub)
    
    struct PackageHistory: Codable, Sendable {
        var schemaVersion: String
        var entries: [HistoryEntry]
        
        struct HistoryEntry: Codable, Sendable, Identifiable {
            var id: String { "\(timestamp.timeIntervalSince1970)-\(action)" }
            let timestamp: Date
            let action: HistoryAction
            let packageVersion: String
            let buildId: String
            let actor: String
            let details: String?
            let snapshotId: String?
            let commitSha: String?
        }
        
        enum HistoryAction: String, Codable, Sendable {
            case installed = "installed"
            case updated = "updated"
            case rolledBack = "rolled_back"
            case removed = "removed"
            case uploaded = "uploaded"
            case restored = "restored"
            case snapshotCreated = "snapshot_created"
            case deprecated = "deprecated"
            case undeprecated = "undeprecated"
            case published = "published"
            case unpublished = "unpublished"
        }
        
        static var empty: PackageHistory {
            PackageHistory(schemaVersion: "1.0", entries: [])
        }
    }
    
    struct HistorySnapshot: Codable, Sendable, Identifiable {
        let id: String
        let createdAt: Date
        let createdBy: String
        let description: String
        let registryState: RegistryIndex
        let commitSha: String
    }
    
    struct CreateRepoRequest: Codable {
        let name: String
        let description: String
        let `private`: Bool
        let auto_init: Bool
    }
    
    struct GitHubContent: Codable {
        let name: String
        let path: String
        let sha: String?
        let size: Int?
        let type: String
        let content: String?
        let encoding: String?
        let download_url: String?
    }
    
    struct CreateFileRequest: Codable {
        let message: String
        let content: String
        let branch: String
        let sha: String?
    }
    
    // MARK: - Properties
    
    private var config: GitHubConfig?
    private var registryIndex: RegistryIndex?
    private var packageHistory: PackageHistory?
    private var historySnapshots: [HistorySnapshot] = []
    private let baseURL = "https://api.github.com"
    private let onePasswordService = OnePasswordService()
    
    // MARK: - Configuration
    
    /// Load configuration from 1Password
    func loadConfig() async throws -> GitHubConfig? {
        // Try to get GitHub config from 1Password
        // Stored as a separate item in the RADIANT vault
        do {
            let credentials = try await onePasswordService.listCredentials()
            // Look for a GitHub config item (would be stored separately)
            // For now, return nil if not configured
            return config
        } catch {
            return nil
        }
    }
    
    /// Save configuration to 1Password
    func saveConfig(_ newConfig: GitHubConfig) async throws {
        config = newConfig
        // Store PAT in 1Password for security
        // The config itself can be stored in UserDefaults (without PAT)
    }
    
    /// Check if configured
    var isConfigured: Bool {
        config != nil
    }
    
    // MARK: - Repository Setup
    
    /// Create a new private repository for packages
    func createRepository(
        owner: String,
        repoName: String,
        personalAccessToken: String
    ) async throws -> GitHubConfig {
        let url = URL(string: "\(baseURL)/user/repos")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(personalAccessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        
        let createRequest = CreateRepoRequest(
            name: repoName,
            description: "RADIANT Deployment Packages - Private registry for deployment artifacts",
            private: true,
            auto_init: true
        )
        
        request.httpBody = try JSONEncoder().encode(createRequest)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw GitHubError.invalidResponse
        }
        
        switch httpResponse.statusCode {
        case 201:
            // Repository created successfully
            let newConfig = GitHubConfig(
                owner: owner,
                repo: repoName,
                branch: GitHubConfig.defaultBranch,
                personalAccessToken: personalAccessToken
            )
            
            // Initialize repository structure
            try await initializeRepositoryStructure(config: newConfig)
            
            config = newConfig
            return newConfig
            
        case 401:
            throw GitHubError.authenticationFailed
        case 422:
            // Repository might already exist
            throw GitHubError.uploadFailed("Repository already exists or name is invalid")
        default:
            let errorBody = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw GitHubError.uploadFailed("HTTP \(httpResponse.statusCode): \(errorBody)")
        }
    }
    
    /// Connect to existing repository
    func connectToRepository(
        owner: String,
        repo: String,
        personalAccessToken: String
    ) async throws -> GitHubConfig {
        // Verify repository exists and we have access
        let url = URL(string: "\(baseURL)/repos/\(owner)/\(repo)")!
        var request = URLRequest(url: url)
        request.setValue("Bearer \(personalAccessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw GitHubError.invalidResponse
        }
        
        switch httpResponse.statusCode {
        case 200:
            let newConfig = GitHubConfig(
                owner: owner,
                repo: repo,
                branch: GitHubConfig.defaultBranch,
                personalAccessToken: personalAccessToken
            )
            
            // Load or initialize registry index
            try await loadOrInitializeRegistry(config: newConfig)
            
            config = newConfig
            return newConfig
            
        case 401:
            throw GitHubError.authenticationFailed
        case 404:
            throw GitHubError.repositoryNotFound
        default:
            throw GitHubError.invalidResponse
        }
    }
    
    /// Initialize repository structure
    private func initializeRepositoryStructure(config: GitHubConfig) async throws {
        // Create directory structure via commits
        // packages/
        //   registry.json
        //   stable/
        //   beta/
        //   custom/
        
        // Create registry.json
        let emptyIndex = RegistryIndex.empty
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let indexData = try encoder.encode(emptyIndex)
        let indexContent = indexData.base64EncodedString()
        
        try await createOrUpdateFile(
            config: config,
            path: "packages/registry.json",
            content: indexContent,
            message: "Initialize package registry"
        )
        
        // Create README
        let readmeContent = """
        # RADIANT Deployment Packages
        
        This repository contains deployment packages for RADIANT infrastructure.
        
        ## Structure
        
        ```
        packages/
        ├── registry.json      # Package index
        ├── stable/            # Stable release packages
        ├── beta/              # Beta release packages
        └── custom/            # Custom/modified packages
        ```
        
        ## Usage
        
        This repository is managed by the RADIANT Deployer application.
        Do not manually modify files unless you know what you're doing.
        
        ## Git LFS
        
        Large `.radpkg` files are stored using Git LFS.
        Make sure Git LFS is installed: `git lfs install`
        """.data(using: .utf8)!.base64EncodedString()
        
        try await createOrUpdateFile(
            config: config,
            path: "README.md",
            content: readmeContent,
            message: "Add README"
        )
        
        // Create .gitattributes for LFS
        let gitattributes = "*.radpkg filter=lfs diff=lfs merge=lfs -text\n"
            .data(using: .utf8)!.base64EncodedString()
        
        try await createOrUpdateFile(
            config: config,
            path: ".gitattributes",
            content: gitattributes,
            message: "Configure Git LFS for package files"
        )
        
        registryIndex = emptyIndex
    }
    
    /// Load or initialize registry
    private func loadOrInitializeRegistry(config: GitHubConfig) async throws {
        do {
            registryIndex = try await fetchRegistryIndex(config: config)
        } catch {
            // Registry doesn't exist - initialize it
            try await initializeRepositoryStructure(config: config)
        }
    }
    
    // MARK: - Package Operations
    
    /// List all packages in registry
    func listPackages() async throws -> [RegistryIndex.PackageEntry] {
        guard let config = config else {
            throw GitHubError.notConfigured
        }
        
        if registryIndex == nil {
            registryIndex = try await fetchRegistryIndex(config: config)
        }
        
        return registryIndex?.packages ?? []
    }
    
    /// Get package by version
    func getPackage(version: String) async throws -> RegistryIndex.PackageEntry {
        let packages = try await listPackages()
        
        guard let package = packages.first(where: { $0.version == version }) else {
            throw GitHubError.packageNotFound(version)
        }
        
        return package
    }
    
    /// Download package
    func downloadPackage(entry: RegistryIndex.PackageEntry) async throws -> Data {
        guard let config = config else {
            throw GitHubError.notConfigured
        }
        
        let url = URL(string: "\(baseURL)/repos/\(config.repoFullName)/contents/\(entry.packagePath)?ref=\(config.branch)")!
        var request = URLRequest(url: url)
        request.setValue("Bearer \(config.personalAccessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/vnd.github.raw", forHTTPHeaderField: "Accept")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw GitHubError.packageNotFound(entry.version)
        }
        
        return data
    }
    
    /// Upload a new package
    func uploadPackage(
        packageData: Data,
        manifest: PackageManifest,
        channel: ReleaseChannel,
        changelog: String?,
        releaseNotes: String?,
        isCustom: Bool = false,
        parentVersion: String? = nil,
        onProgress: @escaping (Double) -> Void
    ) async throws -> RegistryIndex.PackageEntry {
        guard let config = config else {
            throw GitHubError.notConfigured
        }
        
        onProgress(0.1)
        
        // Calculate SHA256
        let sha256 = calculateSHA256(data: packageData)
        
        // Determine paths
        let folder = isCustom ? "custom" : channel.rawValue
        let filename = "radiant-\(manifest.version)-\(manifest.buildId).radpkg"
        let packagePath = "packages/\(folder)/\(manifest.version)/\(filename)"
        let manifestPath = "packages/\(folder)/\(manifest.version)/manifest.json"
        
        onProgress(0.2)
        
        // Upload manifest
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let manifestData = try encoder.encode(manifest)
        
        try await createOrUpdateFile(
            config: config,
            path: manifestPath,
            content: manifestData.base64EncodedString(),
            message: "Add manifest for v\(manifest.version)"
        )
        
        onProgress(0.4)
        
        // Upload changelog if provided
        if let changelog = changelog {
            let changelogPath = "packages/\(folder)/\(manifest.version)/CHANGELOG.md"
            try await createOrUpdateFile(
                config: config,
                path: changelogPath,
                content: changelog.data(using: .utf8)!.base64EncodedString(),
                message: "Add changelog for v\(manifest.version)"
            )
        }
        
        onProgress(0.5)
        
        // Upload package (may need LFS for large files)
        try await createOrUpdateFile(
            config: config,
            path: packagePath,
            content: packageData.base64EncodedString(),
            message: "Upload package v\(manifest.version)"
        )
        
        onProgress(0.8)
        
        // Create registry entry
        let entry = RegistryIndex.PackageEntry(
            version: manifest.version,
            buildId: manifest.buildId,
            channel: channel.rawValue,
            createdAt: Date(),
            createdBy: NSUserName(),
            changelog: changelog,
            releaseNotes: releaseNotes,
            packagePath: packagePath,
            manifestPath: manifestPath,
            sha256: sha256,
            size: Int64(packageData.count),
            isCustom: isCustom,
            parentVersion: parentVersion
        )
        
        // Update registry index
        var index = registryIndex ?? RegistryIndex.empty
        index.packages.insert(entry, at: 0)
        index.lastUpdated = Date()
        
        let indexData = try encoder.encode(index)
        try await createOrUpdateFile(
            config: config,
            path: "packages/registry.json",
            content: indexData.base64EncodedString(),
            message: "Add v\(manifest.version) to registry",
            sha: try await getFileSHA(config: config, path: "packages/registry.json")
        )
        
        registryIndex = index
        
        onProgress(1.0)
        
        return entry
    }
    
    /// Delete a package
    func deletePackage(version: String) async throws {
        guard let config = config else {
            throw GitHubError.notConfigured
        }
        
        guard var index = registryIndex,
              let entryIndex = index.packages.firstIndex(where: { $0.version == version }) else {
            throw GitHubError.packageNotFound(version)
        }
        
        let entry = index.packages[entryIndex]
        
        // Delete package files
        try await deleteFile(config: config, path: entry.packagePath)
        try await deleteFile(config: config, path: entry.manifestPath)
        
        // Update registry
        index.packages.remove(at: entryIndex)
        index.lastUpdated = Date()
        
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let indexData = try encoder.encode(index)
        
        try await createOrUpdateFile(
            config: config,
            path: "packages/registry.json",
            content: indexData.base64EncodedString(),
            message: "Remove v\(version) from registry",
            sha: try await getFileSHA(config: config, path: "packages/registry.json")
        )
        
        registryIndex = index
    }
    
    // MARK: - Package Deprecation
    
    /// Deprecate a package version
    func deprecatePackage(
        version: String,
        reason: String,
        replacementVersion: String? = nil
    ) async throws {
        guard let config = config else {
            throw GitHubError.notConfigured
        }
        
        guard var index = registryIndex,
              let entryIndex = index.packages.firstIndex(where: { $0.version == version }) else {
            throw GitHubError.packageNotFound(version)
        }
        
        var entry = index.packages[entryIndex]
        entry.isDeprecated = true
        entry.deprecatedAt = Date()
        entry.deprecatedBy = NSUserName()
        entry.deprecationReason = reason
        entry.replacementVersion = replacementVersion
        
        index.packages[entryIndex] = entry
        index.lastUpdated = Date()
        
        // Save updated registry to GitHub
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let indexData = try encoder.encode(index)
        
        try await createOrUpdateFile(
            config: config,
            path: "packages/registry.json",
            content: indexData.base64EncodedString(),
            message: "Deprecate v\(version): \(reason)",
            sha: try await getFileSHA(config: config, path: "packages/registry.json")
        )
        
        registryIndex = index
        
        // Record in history
        try await recordHistoryEntry(
            action: .deprecated,
            packageVersion: version,
            buildId: entry.buildId,
            details: "Reason: \(reason)" + (replacementVersion.map { ". Replacement: v\($0)" } ?? "")
        )
    }
    
    /// Remove deprecation from a package version
    func undeprecatePackage(version: String) async throws {
        guard let config = config else {
            throw GitHubError.notConfigured
        }
        
        guard var index = registryIndex,
              let entryIndex = index.packages.firstIndex(where: { $0.version == version }) else {
            throw GitHubError.packageNotFound(version)
        }
        
        var entry = index.packages[entryIndex]
        let wasDeprecated = entry.isDeprecated ?? false
        
        guard wasDeprecated else {
            return // Already not deprecated
        }
        
        entry.isDeprecated = false
        entry.deprecatedAt = nil
        entry.deprecatedBy = nil
        entry.deprecationReason = nil
        entry.replacementVersion = nil
        
        index.packages[entryIndex] = entry
        index.lastUpdated = Date()
        
        // Save updated registry to GitHub
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let indexData = try encoder.encode(index)
        
        try await createOrUpdateFile(
            config: config,
            path: "packages/registry.json",
            content: indexData.base64EncodedString(),
            message: "Undeprecate v\(version)",
            sha: try await getFileSHA(config: config, path: "packages/registry.json")
        )
        
        registryIndex = index
        
        // Record in history
        try await recordHistoryEntry(
            action: .undeprecated,
            packageVersion: version,
            buildId: entry.buildId,
            details: "Deprecation removed"
        )
    }
    
    /// Get all deprecated packages
    func getDeprecatedPackages() -> [RegistryIndex.PackageEntry] {
        return registryIndex?.packages.filter { $0.isDeprecated == true } ?? []
    }
    
    // MARK: - Package Publishing
    
    /// Publish a package version (makes it deployable)
    func publishPackage(version: String) async throws {
        guard let config = config else {
            throw GitHubError.notConfigured
        }
        
        guard var index = registryIndex,
              let entryIndex = index.packages.firstIndex(where: { $0.version == version }) else {
            throw GitHubError.packageNotFound(version)
        }
        
        var entry = index.packages[entryIndex]
        
        // Cannot publish deprecated packages
        if entry.isDeprecated == true {
            throw GitHubError.invalidResponse // Package is deprecated
        }
        
        entry.isPublished = true
        entry.publishedAt = Date()
        entry.publishedBy = NSUserName()
        
        index.packages[entryIndex] = entry
        index.lastUpdated = Date()
        
        // Save updated registry to GitHub
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let indexData = try encoder.encode(index)
        
        try await createOrUpdateFile(
            config: config,
            path: "packages/registry.json",
            content: indexData.base64EncodedString(),
            message: "Publish v\(version) - ready for deployment",
            sha: try await getFileSHA(config: config, path: "packages/registry.json")
        )
        
        registryIndex = index
        
        // Record in history
        try await recordHistoryEntry(
            action: .published,
            packageVersion: version,
            buildId: entry.buildId,
            details: "Package published and ready for deployment"
        )
    }
    
    /// Unpublish a package version (prevents deployment)
    func unpublishPackage(version: String) async throws {
        guard let config = config else {
            throw GitHubError.notConfigured
        }
        
        guard var index = registryIndex,
              let entryIndex = index.packages.firstIndex(where: { $0.version == version }) else {
            throw GitHubError.packageNotFound(version)
        }
        
        var entry = index.packages[entryIndex]
        let wasPublished = entry.isPublished ?? false
        
        guard wasPublished else {
            return // Already not published
        }
        
        entry.isPublished = false
        entry.publishedAt = nil
        entry.publishedBy = nil
        
        index.packages[entryIndex] = entry
        index.lastUpdated = Date()
        
        // Save updated registry to GitHub
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let indexData = try encoder.encode(index)
        
        try await createOrUpdateFile(
            config: config,
            path: "packages/registry.json",
            content: indexData.base64EncodedString(),
            message: "Unpublish v\(version) - deployment disabled",
            sha: try await getFileSHA(config: config, path: "packages/registry.json")
        )
        
        registryIndex = index
        
        // Record in history
        try await recordHistoryEntry(
            action: .unpublished,
            packageVersion: version,
            buildId: entry.buildId,
            details: "Package unpublished - deployment disabled"
        )
    }
    
    /// Get all published packages (deployable)
    func getPublishedPackages() -> [RegistryIndex.PackageEntry] {
        return registryIndex?.packages.filter { $0.isPublished == true } ?? []
    }
    
    /// Get all deployable packages (published and not deprecated)
    func getDeployablePackages() -> [RegistryIndex.PackageEntry] {
        return registryIndex?.packages.filter { $0.isDeployable } ?? []
    }
    
    /// Check if a specific version is deployable
    func isVersionDeployable(_ version: String) -> Bool {
        return registryIndex?.packages.first { $0.version == version }?.isDeployable ?? false
    }
    
    // MARK: - Sync & Restore Operations
    
    struct SyncResult: Sendable {
        let packagesAdded: Int
        let packagesUpdated: Int
        let packagesRemoved: Int
        let errors: [String]
    }
    
    /// Sync local cache with GitHub registry
    func syncFromGitHub(
        localCacheURL: URL,
        onProgress: @escaping (String, Double) -> Void
    ) async throws -> SyncResult {
        guard let config = config else {
            throw GitHubError.notConfigured
        }
        
        onProgress("Fetching registry from GitHub...", 0.1)
        
        // Refresh registry index
        registryIndex = try await fetchRegistryIndex(config: config)
        
        guard let index = registryIndex else {
            throw GitHubError.invalidResponse
        }
        
        var added = 0
        var updated = 0
        var removed = 0
        var errors: [String] = []
        
        let fileManager = FileManager.default
        
        // Ensure cache directory exists
        try fileManager.createDirectory(at: localCacheURL, withIntermediateDirectories: true)
        
        onProgress("Checking local packages...", 0.2)
        
        // Get local packages
        let localFiles = try fileManager.contentsOfDirectory(at: localCacheURL, includingPropertiesForKeys: nil)
            .filter { $0.pathExtension == "radpkg" }
            .map { $0.lastPathComponent }
        let localSet = Set(localFiles)
        
        // Download missing packages
        let totalPackages = index.packages.count
        for (idx, entry) in index.packages.enumerated() {
            let filename = URL(string: entry.packagePath)?.lastPathComponent ?? "\(entry.version).radpkg"
            let progress = 0.2 + (0.7 * Double(idx) / Double(max(totalPackages, 1)))
            
            if !localSet.contains(filename) {
                onProgress("Downloading \(entry.version)...", progress)
                
                do {
                    let data = try await downloadPackage(entry: entry)
                    let localPath = localCacheURL.appendingPathComponent(filename)
                    try data.write(to: localPath)
                    added += 1
                } catch {
                    errors.append("Failed to download \(entry.version): \(error.localizedDescription)")
                }
            } else {
                // Verify checksum
                let localPath = localCacheURL.appendingPathComponent(filename)
                if let localData = try? Data(contentsOf: localPath) {
                    let localHash = calculateSHA256(data: localData)
                    if localHash != entry.sha256 {
                        onProgress("Updating \(entry.version)...", progress)
                        do {
                            let data = try await downloadPackage(entry: entry)
                            try data.write(to: localPath)
                            updated += 1
                        } catch {
                            errors.append("Failed to update \(entry.version): \(error.localizedDescription)")
                        }
                    }
                }
            }
        }
        
        onProgress("Cleaning up...", 0.95)
        
        // Remove packages not in registry (optional - controlled by settings)
        let remoteFilenames = Set(index.packages.compactMap { URL(string: $0.packagePath)?.lastPathComponent })
        for localFile in localFiles {
            if !remoteFilenames.contains(localFile) {
                let localPath = localCacheURL.appendingPathComponent(localFile)
                try? fileManager.removeItem(at: localPath)
                removed += 1
            }
        }
        
        onProgress("Sync complete", 1.0)
        
        return SyncResult(
            packagesAdded: added,
            packagesUpdated: updated,
            packagesRemoved: removed,
            errors: errors
        )
    }
    
    /// Restore a specific package version from GitHub to local cache
    func restorePackage(
        version: String,
        to localCacheURL: URL,
        onProgress: @escaping (Double) -> Void
    ) async throws -> URL {
        guard let config = config else {
            throw GitHubError.notConfigured
        }
        
        onProgress(0.1)
        
        // Find package in registry
        if registryIndex == nil {
            registryIndex = try await fetchRegistryIndex(config: config)
        }
        
        guard let entry = registryIndex?.packages.first(where: { $0.version == version }) else {
            throw GitHubError.packageNotFound(version)
        }
        
        onProgress(0.3)
        
        // Download package
        let data = try await downloadPackage(entry: entry)
        
        onProgress(0.8)
        
        // Verify checksum
        let downloadedHash = calculateSHA256(data: data)
        guard downloadedHash == entry.sha256 else {
            throw GitHubError.uploadFailed("Checksum mismatch - package may be corrupted")
        }
        
        // Save to local cache
        let filename = URL(string: entry.packagePath)?.lastPathComponent ?? "radiant-\(version).radpkg"
        let localPath = localCacheURL.appendingPathComponent(filename)
        
        let fileManager = FileManager.default
        try fileManager.createDirectory(at: localCacheURL, withIntermediateDirectories: true)
        try data.write(to: localPath)
        
        onProgress(1.0)
        
        return localPath
    }
    
    /// Export local packages to GitHub (backup)
    func backupToGitHub(
        localCacheURL: URL,
        onProgress: @escaping (String, Double) -> Void
    ) async throws -> Int {
        guard let config = config else {
            throw GitHubError.notConfigured
        }
        
        let fileManager = FileManager.default
        let localFiles = try fileManager.contentsOfDirectory(at: localCacheURL, includingPropertiesForKeys: [.fileSizeKey])
            .filter { $0.pathExtension == "radpkg" }
        
        if registryIndex == nil {
            registryIndex = try await fetchRegistryIndex(config: config)
        }
        
        let existingVersions = Set(registryIndex?.packages.map { $0.version } ?? [])
        var uploaded = 0
        
        for (idx, fileURL) in localFiles.enumerated() {
            let progress = Double(idx) / Double(max(localFiles.count, 1))
            
            // Extract version from filename
            let filename = fileURL.lastPathComponent
            let versionPattern = try? NSRegularExpression(pattern: "radiant-(\\d+\\.\\d+\\.\\d+)-", options: [])
            if let match = versionPattern?.firstMatch(in: filename, options: [], range: NSRange(filename.startIndex..., in: filename)),
               let versionRange = Range(match.range(at: 1), in: filename) {
                let version = String(filename[versionRange])
                
                if !existingVersions.contains(version) {
                    onProgress("Uploading \(version)...", progress)
                    
                    let data = try Data(contentsOf: fileURL)
                    
                    // Create minimal manifest for backup
                    let manifest = PackageManifest(
                        packageFormat: "1.0",
                        version: version,
                        buildId: String(filename.dropFirst("radiant-\(version)-".count).prefix(8)),
                        buildTimestamp: Date(),
                        buildHost: "backup",
                        components: PackageManifest.ComponentVersions(
                            radiantPlatform: .init(version: version, minUpgradeFrom: nil, changelog: nil),
                            thinkTank: nil
                        ),
                        migrations: PackageManifest.MigrationInfo(radiant: nil, thinktank: nil),
                        dependencies: PackageManifest.DependencyInfo(awsCdk: "2.x", nodejs: "20.x", postgresql: "15"),
                        compatibility: PackageManifest.CompatibilityInfo(minimumDeployerVersion: version, supportedTiers: ["1", "2", "3", "4"], supportedRegions: ["us-east-1"]),
                        integrity: PackageManifest.IntegrityInfo(algorithm: "sha256", packageHash: calculateSHA256(data: data), signedBy: nil, signature: nil),
                        installBehavior: PackageManifest.InstallBehavior(seedAIRegistry: true, createInitialAdmin: true, runFullMigrations: true),
                        updateBehavior: PackageManifest.UpdateBehavior(seedAIRegistry: false, preserveAdminCustomizations: true, runIncrementalMigrations: true, createPreUpdateSnapshot: true),
                        rollbackBehavior: PackageManifest.RollbackBehavior(supportedFromVersions: [], requiresDatabaseRollback: true)
                    )
                    
                    _ = try await uploadPackage(
                        packageData: data,
                        manifest: manifest,
                        channel: .stable,
                        changelog: nil,
                        releaseNotes: "Backed up from local cache",
                        isCustom: false,
                        parentVersion: nil,
                        onProgress: { _ in }
                    )
                    
                    uploaded += 1
                }
            }
        }
        
        onProgress("Backup complete", 1.0)
        return uploaded
    }
    
    /// Get sync status comparing local and remote
    func getSyncStatus(localCacheURL: URL) async throws -> (local: Int, remote: Int, needsSync: Bool) {
        guard config != nil else {
            throw GitHubError.notConfigured
        }
        
        let fileManager = FileManager.default
        let localFiles = (try? fileManager.contentsOfDirectory(at: localCacheURL, includingPropertiesForKeys: nil)
            .filter { $0.pathExtension == "radpkg" }) ?? []
        
        let remoteCount = registryIndex?.packages.count ?? 0
        let localCount = localFiles.count
        
        return (local: localCount, remote: remoteCount, needsSync: localCount != remoteCount)
    }
    
    // MARK: - Package History Management
    
    /// Load package history from GitHub
    func loadHistory() async throws -> PackageHistory {
        guard let config = config else {
            throw GitHubError.notConfigured
        }
        
        do {
            let history = try await fetchPackageHistory(config: config)
            packageHistory = history
            return history
        } catch GitHubError.packageNotFound {
            // Initialize empty history if not found
            let empty = PackageHistory.empty
            packageHistory = empty
            return empty
        }
    }
    
    /// Record a history entry and commit to GitHub
    func recordHistoryEntry(
        action: PackageHistory.HistoryAction,
        packageVersion: String,
        buildId: String,
        details: String? = nil,
        snapshotId: String? = nil
    ) async throws {
        guard let config = config else {
            throw GitHubError.notConfigured
        }
        
        // Load current history
        var history: PackageHistory
        if let cached = packageHistory {
            history = cached
        } else if let loaded = try? await loadHistory() {
            history = loaded
        } else {
            history = PackageHistory.empty
        }
        
        // Create new entry
        let entry = PackageHistory.HistoryEntry(
            timestamp: Date(),
            action: action,
            packageVersion: packageVersion,
            buildId: buildId,
            actor: NSUserName(),
            details: details,
            snapshotId: snapshotId,
            commitSha: nil
        )
        
        history.entries.insert(entry, at: 0)
        
        // Keep only last 500 entries
        if history.entries.count > 500 {
            history.entries = Array(history.entries.prefix(500))
        }
        
        // Save to GitHub
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let historyData = try encoder.encode(history)
        
        try await createOrUpdateFile(
            config: config,
            path: "history/package-history.json",
            content: historyData.base64EncodedString(),
            message: "[\(action.rawValue)] \(packageVersion) - \(details ?? "No details")",
            sha: try await getFileSHA(config: config, path: "history/package-history.json")
        )
        
        packageHistory = history
    }
    
    /// Create a snapshot of current registry state
    func createHistorySnapshot(description: String) async throws -> HistorySnapshot {
        guard let config = config else {
            throw GitHubError.notConfigured
        }
        
        // Load current registry state
        let registry: RegistryIndex
        if let cached = registryIndex {
            registry = cached
        } else {
            registry = try await fetchRegistryIndex(config: config)
        }
        
        let snapshotId = UUID().uuidString
        let snapshot = HistorySnapshot(
            id: snapshotId,
            createdAt: Date(),
            createdBy: NSUserName(),
            description: description,
            registryState: registry,
            commitSha: ""
        )
        
        // Save snapshot to GitHub
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let snapshotData = try encoder.encode(snapshot)
        
        try await createOrUpdateFile(
            config: config,
            path: "history/snapshots/\(snapshotId).json",
            content: snapshotData.base64EncodedString(),
            message: "Snapshot: \(description)"
        )
        
        // Update snapshots index
        historySnapshots.insert(snapshot, at: 0)
        try await saveSnapshotsIndex()
        
        // Record in history
        try await recordHistoryEntry(
            action: .snapshotCreated,
            packageVersion: registry.packages.first?.version ?? "unknown",
            buildId: snapshotId,
            details: description,
            snapshotId: snapshotId
        )
        
        return snapshot
    }
    
    /// List all history snapshots
    func listSnapshots() async throws -> [HistorySnapshot] {
        guard let config = config else {
            throw GitHubError.notConfigured
        }
        
        if historySnapshots.isEmpty {
            historySnapshots = try await fetchSnapshotsIndex(config: config)
        }
        
        return historySnapshots
    }
    
    /// Restore registry state from a snapshot
    func restoreFromSnapshot(snapshotId: String) async throws {
        guard let config = config else {
            throw GitHubError.notConfigured
        }
        
        // Create a backup snapshot before restoring
        _ = try await createHistorySnapshot(description: "Auto-backup before restore from \(snapshotId)")
        
        // Load the snapshot
        let snapshot = try await fetchSnapshot(config: config, snapshotId: snapshotId)
        
        // Restore the registry state
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let indexData = try encoder.encode(snapshot.registryState)
        
        try await createOrUpdateFile(
            config: config,
            path: "packages/registry.json",
            content: indexData.base64EncodedString(),
            message: "Restore from snapshot: \(snapshot.description)",
            sha: try await getFileSHA(config: config, path: "packages/registry.json")
        )
        
        registryIndex = snapshot.registryState
        
        // Record in history
        try await recordHistoryEntry(
            action: .restored,
            packageVersion: snapshot.registryState.packages.first?.version ?? "unknown",
            buildId: snapshotId,
            details: "Restored from snapshot: \(snapshot.description)",
            snapshotId: snapshotId
        )
    }
    
    /// Get history entries for a specific package version
    func getPackageHistory(version: String) async throws -> [PackageHistory.HistoryEntry] {
        let history: PackageHistory
        if let cached = packageHistory {
            history = cached
        } else {
            history = try await loadHistory()
        }
        return history.entries.filter { $0.packageVersion == version }
    }
    
    /// Get recent history entries
    func getRecentHistory(limit: Int = 50) async throws -> [PackageHistory.HistoryEntry] {
        let history: PackageHistory
        if let cached = packageHistory {
            history = cached
        } else {
            history = try await loadHistory()
        }
        return Array(history.entries.prefix(limit))
    }
    
    // MARK: - History GitHub Helpers
    
    private func fetchPackageHistory(config: GitHubConfig) async throws -> PackageHistory {
        let url = URL(string: "\(baseURL)/repos/\(config.repoFullName)/contents/history/package-history.json?ref=\(config.branch)")!
        var request = URLRequest(url: url)
        request.setValue("Bearer \(config.personalAccessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw GitHubError.invalidResponse
        }
        
        if httpResponse.statusCode == 404 {
            throw GitHubError.packageNotFound("package-history.json")
        }
        
        guard httpResponse.statusCode == 200 else {
            throw GitHubError.invalidResponse
        }
        
        let content = try JSONDecoder().decode(GitHubContent.self, from: data)
        
        guard let contentData = content.content,
              let decodedData = Data(base64Encoded: contentData.replacingOccurrences(of: "\n", with: "")) else {
            throw GitHubError.invalidResponse
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(PackageHistory.self, from: decodedData)
    }
    
    private func fetchSnapshotsIndex(config: GitHubConfig) async throws -> [HistorySnapshot] {
        let url = URL(string: "\(baseURL)/repos/\(config.repoFullName)/contents/history/snapshots-index.json?ref=\(config.branch)")!
        var request = URLRequest(url: url)
        request.setValue("Bearer \(config.personalAccessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw GitHubError.invalidResponse
        }
        
        if httpResponse.statusCode == 404 {
            return []
        }
        
        guard httpResponse.statusCode == 200 else {
            throw GitHubError.invalidResponse
        }
        
        let content = try JSONDecoder().decode(GitHubContent.self, from: data)
        
        guard let contentData = content.content,
              let decodedData = Data(base64Encoded: contentData.replacingOccurrences(of: "\n", with: "")) else {
            throw GitHubError.invalidResponse
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode([HistorySnapshot].self, from: decodedData)
    }
    
    private func fetchSnapshot(config: GitHubConfig, snapshotId: String) async throws -> HistorySnapshot {
        let url = URL(string: "\(baseURL)/repos/\(config.repoFullName)/contents/history/snapshots/\(snapshotId).json?ref=\(config.branch)")!
        var request = URLRequest(url: url)
        request.setValue("Bearer \(config.personalAccessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw GitHubError.packageNotFound("Snapshot \(snapshotId)")
        }
        
        let content = try JSONDecoder().decode(GitHubContent.self, from: data)
        
        guard let contentData = content.content,
              let decodedData = Data(base64Encoded: contentData.replacingOccurrences(of: "\n", with: "")) else {
            throw GitHubError.invalidResponse
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(HistorySnapshot.self, from: decodedData)
    }
    
    private func saveSnapshotsIndex() async throws {
        guard let config = config else {
            throw GitHubError.notConfigured
        }
        
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let indexData = try encoder.encode(historySnapshots)
        
        try await createOrUpdateFile(
            config: config,
            path: "history/snapshots-index.json",
            content: indexData.base64EncodedString(),
            message: "Update snapshots index",
            sha: try await getFileSHA(config: config, path: "history/snapshots-index.json")
        )
    }
    
    // MARK: - GitHub API Helpers
    
    private func fetchRegistryIndex(config: GitHubConfig) async throws -> RegistryIndex {
        let url = URL(string: "\(baseURL)/repos/\(config.repoFullName)/contents/packages/registry.json?ref=\(config.branch)")!
        var request = URLRequest(url: url)
        request.setValue("Bearer \(config.personalAccessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw GitHubError.packageNotFound("registry.json")
        }
        
        let content = try JSONDecoder().decode(GitHubContent.self, from: data)
        
        guard let contentData = content.content,
              let decodedData = Data(base64Encoded: contentData.replacingOccurrences(of: "\n", with: "")) else {
            throw GitHubError.invalidResponse
        }
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(RegistryIndex.self, from: decodedData)
    }
    
    private func createOrUpdateFile(
        config: GitHubConfig,
        path: String,
        content: String,
        message: String,
        sha: String? = nil
    ) async throws {
        let url = URL(string: "\(baseURL)/repos/\(config.repoFullName)/contents/\(path)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("Bearer \(config.personalAccessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        
        let createRequest = CreateFileRequest(
            message: message,
            content: content,
            branch: config.branch,
            sha: sha
        )
        
        request.httpBody = try JSONEncoder().encode(createRequest)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw GitHubError.invalidResponse
        }
        
        switch httpResponse.statusCode {
        case 200, 201:
            return
        case 401:
            throw GitHubError.authenticationFailed
        case 403:
            if let rateLimitRemaining = httpResponse.value(forHTTPHeaderField: "X-RateLimit-Remaining"),
               rateLimitRemaining == "0" {
                throw GitHubError.rateLimited
            }
            throw GitHubError.uploadFailed("Permission denied")
        case 422:
            let errorBody = String(data: data, encoding: .utf8) ?? ""
            throw GitHubError.uploadFailed("Validation failed: \(errorBody)")
        default:
            let errorBody = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw GitHubError.uploadFailed("HTTP \(httpResponse.statusCode): \(errorBody)")
        }
    }
    
    private func getFileSHA(config: GitHubConfig, path: String) async throws -> String? {
        let url = URL(string: "\(baseURL)/repos/\(config.repoFullName)/contents/\(path)?ref=\(config.branch)")!
        var request = URLRequest(url: url)
        request.setValue("Bearer \(config.personalAccessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            return nil
        }
        
        let content = try JSONDecoder().decode(GitHubContent.self, from: data)
        return content.sha
    }
    
    private func deleteFile(config: GitHubConfig, path: String) async throws {
        guard let sha = try await getFileSHA(config: config, path: path) else {
            return // File doesn't exist
        }
        
        let url = URL(string: "\(baseURL)/repos/\(config.repoFullName)/contents/\(path)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("Bearer \(config.personalAccessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        
        let body: [String: Any] = [
            "message": "Delete \(path)",
            "sha": sha,
            "branch": config.branch
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw GitHubError.uploadFailed("Failed to delete file")
        }
    }
    
    private func calculateSHA256(data: Data) -> String {
        var hasher = SHA256Hasher()
        hasher.update(data: data)
        return hasher.finalize()
    }
}

// MARK: - SHA256 Hasher (without CryptoKit import conflict)

private struct SHA256Hasher {
    private var context = CC_SHA256_CTX()
    
    init() {
        CC_SHA256_Init(&context)
    }
    
    mutating func update(data: Data) {
        data.withUnsafeBytes { buffer in
            _ = CC_SHA256_Update(&context, buffer.baseAddress, CC_LONG(buffer.count))
        }
    }
    
    mutating func finalize() -> String {
        var digest = [UInt8](repeating: 0, count: Int(CC_SHA256_DIGEST_LENGTH))
        CC_SHA256_Final(&digest, &context)
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}

import CommonCrypto
