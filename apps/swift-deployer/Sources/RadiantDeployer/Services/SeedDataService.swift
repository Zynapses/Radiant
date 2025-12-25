// RADIANT v4.18.0 - Seed Data Service
// Manages AI Registry seed data versions and integration with packages

import Foundation
import CryptoKit

// MARK: - Seed Data Manifest

struct SeedDataManifest: Codable, Sendable {
    let version: String
    let name: String
    let description: String
    let createdAt: Date
    let updatedAt: Date
    let compatibility: SeedCompatibility
    let files: SeedFiles
    let stats: SeedStats
    let pricing: SeedPricing
    let changelog: [SeedChangelogEntry]
    
    struct SeedCompatibility: Codable, Sendable {
        let minRadiantVersion: String
        let maxRadiantVersion: String
    }
    
    struct SeedFiles: Codable, Sendable {
        let providers: String
        let externalModels: String
        let selfHostedModels: String
        let services: String
    }
    
    struct SeedStats: Codable, Sendable {
        let externalProviders: Int
        let externalModels: Int
        let selfHostedModels: Int
        let services: Int
    }
    
    struct SeedPricing: Codable, Sendable {
        let externalMarkup: Double
        let selfHostedMarkup: Double
    }
    
    struct SeedChangelogEntry: Codable, Sendable {
        let version: String
        let date: String
        let changes: [String]
    }
}

// MARK: - Seed Data Info

struct SeedDataInfo: Codable, Sendable, Identifiable, Hashable {
    var id: String { version }
    let version: String
    let name: String
    let description: String
    let createdAt: Date
    let stats: SeedDataManifest.SeedStats
    let hash: String
    let size: Int64
    let isLocal: Bool
    let path: String?
    
    func hash(into hasher: inout Hasher) {
        hasher.combine(version)
    }
    
    static func == (lhs: SeedDataInfo, rhs: SeedDataInfo) -> Bool {
        lhs.version == rhs.version
    }
}

// MARK: - Provider Model

struct SeedProvider: Codable, Sendable, Identifiable {
    let id: String
    let name: String
    let displayName: String
    let category: String
    let description: String?
    let website: String?
    let apiBaseUrl: String?
    let authType: String
    let secretName: String?
    let enabled: Bool
    let regions: [String]?
    let features: [String]?
    let compliance: [String]?
    let rateLimit: RateLimit?
    
    struct RateLimit: Codable, Sendable {
        let requestsPerMinute: Int?
        let tokensPerMinute: Int?
        let imagesPerMinute: Int?
        let videosPerMinute: Int?
        let charactersPerMinute: Int?
        let minutesPerMinute: Int?
        let modelsPerMinute: Int?
    }
}

// MARK: - External Model

struct SeedExternalModel: Codable, Sendable, Identifiable {
    let id: String
    let providerId: String
    let modelId: String
    let litellmId: String?
    let displayName: String
    let description: String?
    let category: String
    let capabilities: [String]?
    let contextWindow: Int?
    let maxOutput: Int?
    let inputModalities: [String]?
    let outputModalities: [String]?
    let pricing: Pricing
    let minTier: Int
    
    struct Pricing: Codable, Sendable {
        let inputCostPer1k: Double?
        let outputCostPer1k: Double?
        let perImage: Double?
        let perImage1024: Double?
        let perImage1024HD: Double?
        let perImage1792: Double?
        let perImage1792HD: Double?
        let perSecond: Double?
        let perCharacter: Double?
        let perMinute: Double?
        let perSearch: Double?
        let per3DModel: Double?
        let markup: Double
    }
}

// MARK: - Self-Hosted Model

struct SeedSelfHostedModel: Codable, Sendable, Identifiable {
    let id: String
    let displayName: String
    let description: String?
    let category: String
    let specialty: String?
    let instanceType: String
    let parameters: Int?
    let accuracy: String?
    let benchmark: String?
    let contextWindow: Int?
    let capabilities: [String]?
    let inputFormats: [String]?
    let outputFormats: [String]?
    let thermal: ThermalConfig?
    let license: String?
    let commercialUseNotes: String?
    let pricing: Pricing
    let minTier: Int
    
    struct ThermalConfig: Codable, Sendable {
        let defaultState: String
        let scaleToZeroAfterMinutes: Int
        let warmupTimeSeconds: Int
    }
    
    struct Pricing: Codable, Sendable {
        let hourlyRate: Double
        let perImage: Double?
        let perMinuteAudio: Double?
        let perMinuteVideo: Double?
        let perProtein: Double?
        let perSequence: Double?
        let per3DModel: Double?
        let inputCostPer1k: Double?
        let outputCostPer1k: Double?
        let markup: Double
    }
}

// MARK: - Service Definition

struct SeedService: Codable, Sendable, Identifiable {
    let id: String
    let displayName: String
    let description: String
    let requiredModels: [String]
    let optionalModels: [String]
    let endpoints: [Endpoint]
    let pricing: Pricing
    let minTier: Int
    
    struct Endpoint: Codable, Sendable {
        let path: String
        let description: String
    }
    
    struct Pricing: Codable, Sendable {
        let perImage: Double?
        let perMinuteVideo: Double?
        let perSequence: Double?
        let perProtein: Double?
        let per3DModel: Double?
        let markup: Double
    }
}

// MARK: - Complete Seed Data

struct SeedData: Sendable {
    let manifest: SeedDataManifest
    let providers: [SeedProvider]
    let externalModels: [SeedExternalModel]
    let selfHostedModels: [SeedSelfHostedModel]
    let services: [SeedService]
    let path: URL
}

// MARK: - Seed Data Service

actor SeedDataService {
    
    private let fileManager = FileManager.default
    private let seedsDirectory: URL
    private let awsService: AWSService
    
    private var cachedSeeds: [String: SeedData] = [:]
    
    init() {
        // Local seeds in config/seeds/
        let projectRoot = FileManager.default.currentDirectoryPath
        self.seedsDirectory = URL(fileURLWithPath: projectRoot)
            .appendingPathComponent("config")
            .appendingPathComponent("seeds")
        
        self.awsService = AWSService()
    }
    
    // MARK: - List Available Seed Versions
    
    /// List all available seed data versions (local and remote)
    func listAvailableSeedVersions() async throws -> [SeedDataInfo] {
        var seeds: [SeedDataInfo] = []
        
        // 1. List local seeds
        seeds.append(contentsOf: try listLocalSeeds())
        
        // 2. List remote seeds from S3
        do {
            let remoteSeeds = try await listRemoteSeeds()
            seeds.append(contentsOf: remoteSeeds)
        } catch {
            // Continue with local seeds if remote fails
        }
        
        // Deduplicate by version, preferring local
        let uniqueSeeds = Dictionary(grouping: seeds, by: \.version)
            .compactMapValues { $0.first(where: { $0.isLocal }) ?? $0.first }
            .values
            .sorted { $0.version > $1.version }
        
        return Array(uniqueSeeds)
    }
    
    /// List local seed data versions
    private func listLocalSeeds() throws -> [SeedDataInfo] {
        guard fileManager.fileExists(atPath: seedsDirectory.path) else {
            return []
        }
        
        let contents = try fileManager.contentsOfDirectory(
            at: seedsDirectory,
            includingPropertiesForKeys: [.isDirectoryKey]
        )
        
        var seeds: [SeedDataInfo] = []
        
        for url in contents {
            var isDirectory: ObjCBool = false
            guard fileManager.fileExists(atPath: url.path, isDirectory: &isDirectory),
                  isDirectory.boolValue else {
                continue
            }
            
            let manifestPath = url.appendingPathComponent("manifest.json")
            guard fileManager.fileExists(atPath: manifestPath.path) else {
                continue
            }
            
            do {
                let data = try Data(contentsOf: manifestPath)
                let decoder = JSONDecoder()
                decoder.dateDecodingStrategy = .iso8601
                let manifest = try decoder.decode(SeedDataManifest.self, from: data)
                
                // Calculate hash of seed directory
                let hash = try calculateDirectoryHash(url)
                let size = try calculateDirectorySize(url)
                
                seeds.append(SeedDataInfo(
                    version: manifest.version,
                    name: manifest.name,
                    description: manifest.description,
                    createdAt: manifest.createdAt,
                    stats: manifest.stats,
                    hash: hash,
                    size: size,
                    isLocal: true,
                    path: url.path
                ))
            } catch {
                // Skip invalid seed directories
                continue
            }
        }
        
        return seeds
    }
    
    /// List remote seed data versions from S3
    private func listRemoteSeeds() async throws -> [SeedDataInfo] {
        let bucket = "radiant-releases-us-east-1"
        let prefix = "seeds/"
        
        let keys = await awsService.listObjects(bucket: bucket, prefix: prefix)
        
        var seeds: [SeedDataInfo] = []
        
        for key in keys where key.hasSuffix("/manifest.json") {
            if let data = await awsService.getObject(bucket: bucket, key: key) {
                let decoder = JSONDecoder()
                decoder.dateDecodingStrategy = .iso8601
                
                if let manifest = try? decoder.decode(SeedDataManifest.self, from: data) {
                    let versionDir = String(key.dropLast("/manifest.json".count))
                    
                    seeds.append(SeedDataInfo(
                        version: manifest.version,
                        name: manifest.name,
                        description: manifest.description,
                        createdAt: manifest.createdAt,
                        stats: manifest.stats,
                        hash: "",
                        size: 0,
                        isLocal: false,
                        path: "s3://\(bucket)/\(versionDir)"
                    ))
                }
            }
        }
        
        return seeds
    }
    
    // MARK: - Load Seed Data
    
    /// Load complete seed data for a version
    func loadSeedData(version: String) async throws -> SeedData {
        // Check cache
        if let cached = cachedSeeds[version] {
            return cached
        }
        
        // Try local first
        let localPath = seedsDirectory.appendingPathComponent("v\(version.replacingOccurrences(of: ".", with: "_"))")
        
        if fileManager.fileExists(atPath: localPath.path) {
            let seedData = try loadSeedDataFromDirectory(localPath)
            cachedSeeds[version] = seedData
            return seedData
        }
        
        // Try version directory name
        let altPath = seedsDirectory.appendingPathComponent("v\(version.split(separator: ".").first ?? "1")")
        if fileManager.fileExists(atPath: altPath.path) {
            let seedData = try loadSeedDataFromDirectory(altPath)
            cachedSeeds[version] = seedData
            return seedData
        }
        
        // Download from S3
        let downloadedPath = try await downloadSeedData(version: version)
        let seedData = try loadSeedDataFromDirectory(downloadedPath)
        cachedSeeds[version] = seedData
        return seedData
    }
    
    /// Load seed data from a local directory
    private func loadSeedDataFromDirectory(_ directory: URL) throws -> SeedData {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        
        // Load manifest
        let manifestData = try Data(contentsOf: directory.appendingPathComponent("manifest.json"))
        let manifest = try decoder.decode(SeedDataManifest.self, from: manifestData)
        
        // Load providers
        let providersData = try Data(contentsOf: directory.appendingPathComponent(manifest.files.providers))
        let providersWrapper = try decoder.decode(ProvidersWrapper.self, from: providersData)
        
        // Load external models
        let externalModelsData = try Data(contentsOf: directory.appendingPathComponent(manifest.files.externalModels))
        let externalModelsWrapper = try decoder.decode(ExternalModelsWrapper.self, from: externalModelsData)
        
        // Load self-hosted models
        let selfHostedData = try Data(contentsOf: directory.appendingPathComponent(manifest.files.selfHostedModels))
        let selfHostedWrapper = try decoder.decode(SelfHostedModelsWrapper.self, from: selfHostedData)
        
        // Load services
        let servicesData = try Data(contentsOf: directory.appendingPathComponent(manifest.files.services))
        let servicesWrapper = try decoder.decode(ServicesWrapper.self, from: servicesData)
        
        return SeedData(
            manifest: manifest,
            providers: providersWrapper.providers,
            externalModels: externalModelsWrapper.models,
            selfHostedModels: selfHostedWrapper.models,
            services: servicesWrapper.services,
            path: directory
        )
    }
    
    /// Download seed data from S3
    private func downloadSeedData(version: String) async throws -> URL {
        let bucket = "radiant-releases-us-east-1"
        let prefix = "seeds/v\(version)/"
        
        let localPath = seedsDirectory.appendingPathComponent("v\(version)")
        try fileManager.createDirectory(at: localPath, withIntermediateDirectories: true)
        
        let files = ["manifest.json", "providers.json", "external-models.json", "self-hosted-models.json", "services.json"]
        
        for file in files {
            if let data = await awsService.getObject(bucket: bucket, key: "\(prefix)\(file)") {
                try data.write(to: localPath.appendingPathComponent(file))
            }
        }
        
        return localPath
    }
    
    // MARK: - Generate SQL Migration
    
    /// Generate SQL migration from seed data
    func generateSeedMigration(seedData: SeedData) -> String {
        var sql = """
        -- RADIANT AI Registry Seed Data Migration
        -- Seed Version: \(seedData.manifest.version)
        -- Generated: \(ISO8601DateFormatter().string(from: Date()))
        -- 
        -- IMPORTANT: This migration ONLY runs on FRESH INSTALL
        -- It uses ON CONFLICT DO NOTHING to preserve admin customizations
        
        -- Check if this is a fresh install
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM providers LIMIT 1) THEN
                RAISE NOTICE 'AI Registry already populated, skipping seed';
                RETURN;
            END IF;
        END $$;
        
        -- ============================================
        -- PROVIDERS
        -- ============================================
        
        INSERT INTO providers (id, name, display_name, category, description, website, api_base_url, auth_type, secret_name, enabled, regions, features, compliance, rate_limit, created_at, updated_at)
        VALUES
        
        """
        
        // Add providers
        let providerValues = seedData.providers.map { provider in
            let regions = provider.regions.map { "ARRAY['\($0.joined(separator: "','"))']" } ?? "NULL"
            let features = provider.features.map { "ARRAY['\($0.joined(separator: "','"))']" } ?? "NULL"
            let compliance = provider.compliance.map { "ARRAY['\($0.joined(separator: "','"))']" } ?? "NULL"
            let rateLimit = provider.rateLimit.map { rl in
                "'{\"requestsPerMinute\": \(rl.requestsPerMinute ?? 0)}'"
            } ?? "NULL"
            
            return """
            ('\(provider.id)', '\(provider.name)', '\(provider.displayName)', '\(provider.category)', '\(provider.description ?? "")', '\(provider.website ?? "")', '\(provider.apiBaseUrl ?? "")', '\(provider.authType)', '\(provider.secretName ?? "")', \(provider.enabled), \(regions), \(features), \(compliance), \(rateLimit)::jsonb, NOW(), NOW())
            """
        }
        
        sql += providerValues.joined(separator: ",\n") + "\nON CONFLICT (id) DO NOTHING;\n\n"
        
        sql += """
        -- ============================================
        -- EXTERNAL MODELS
        -- ============================================
        
        INSERT INTO models (id, provider_id, model_id, litellm_id, name, display_name, description, category, capabilities, context_window, max_output, input_modalities, output_modalities, pricing, min_tier, enabled, created_at, updated_at)
        VALUES
        
        """
        
        // Add external models
        let modelValues = seedData.externalModels.map { model in
            let capabilities = model.capabilities.map { "ARRAY['\($0.joined(separator: "','"))']" } ?? "NULL"
            let inputMods = model.inputModalities.map { "ARRAY['\($0.joined(separator: "','"))']" } ?? "NULL"
            let outputMods = model.outputModalities.map { "ARRAY['\($0.joined(separator: "','"))']" } ?? "NULL"
            let pricing = "{\"markup\": \(model.pricing.markup)}"
            
            return """
            ('\(model.id)', '\(model.providerId)', '\(model.modelId)', '\(model.litellmId ?? "")', '\(model.displayName)', '\(model.displayName)', '\(model.description ?? "")', '\(model.category)', \(capabilities), \(model.contextWindow ?? 0), \(model.maxOutput ?? 0), \(inputMods), \(outputMods), '\(pricing)'::jsonb, \(model.minTier), true, NOW(), NOW())
            """
        }
        
        sql += modelValues.joined(separator: ",\n") + "\nON CONFLICT (id) DO NOTHING;\n\n"
        
        sql += """
        -- ============================================
        -- SELF-HOSTED MODELS
        -- ============================================
        
        INSERT INTO self_hosted_models (id, name, display_name, description, category, specialty, instance_type, capabilities, thermal_config, license, pricing, min_tier, enabled, created_at, updated_at)
        VALUES
        
        """
        
        // Add self-hosted models
        let selfHostedValues = seedData.selfHostedModels.map { model in
            let capabilities = model.capabilities.map { "ARRAY['\($0.joined(separator: "','"))']" } ?? "NULL"
            let thermal = model.thermal.map { t in
                "{\"defaultState\": \"\(t.defaultState)\", \"scaleToZeroAfterMinutes\": \(t.scaleToZeroAfterMinutes), \"warmupTimeSeconds\": \(t.warmupTimeSeconds)}"
            } ?? "{}"
            let pricing = "{\"hourlyRate\": \(model.pricing.hourlyRate), \"markup\": \(model.pricing.markup)}"
            
            return """
            ('\(model.id)', '\(model.id)', '\(model.displayName)', '\(model.description ?? "")', '\(model.category)', '\(model.specialty ?? "")', '\(model.instanceType)', \(capabilities), '\(thermal)'::jsonb, '\(model.license ?? "")', '\(pricing)'::jsonb, \(model.minTier), true, NOW(), NOW())
            """
        }
        
        sql += selfHostedValues.joined(separator: ",\n") + "\nON CONFLICT (id) DO NOTHING;\n\n"
        
        sql += """
        -- Log completion
        DO $$
        BEGIN
            RAISE NOTICE 'AI Registry seeded with % providers, % external models, % self-hosted models',
                (SELECT COUNT(*) FROM providers),
                (SELECT COUNT(*) FROM models),
                (SELECT COUNT(*) FROM self_hosted_models);
        END $$;
        """
        
        return sql
    }
    
    // MARK: - Helpers
    
    private func calculateDirectoryHash(_ directory: URL) throws -> String {
        var hasher = SHA256()
        
        let contents = try fileManager.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: nil
        ).sorted { $0.path < $1.path }
        
        for url in contents {
            if let data = try? Data(contentsOf: url) {
                hasher.update(data: data)
            }
        }
        
        let digest = hasher.finalize()
        return digest.compactMap { String(format: "%02x", $0) }.joined()
    }
    
    private func calculateDirectorySize(_ directory: URL) throws -> Int64 {
        var size: Int64 = 0
        
        let contents = try fileManager.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: [.fileSizeKey]
        )
        
        for url in contents {
            let attributes = try fileManager.attributesOfItem(atPath: url.path)
            if let fileSize = attributes[.size] as? Int64 {
                size += fileSize
            }
        }
        
        return size
    }
}

// MARK: - JSON Wrapper Types

private struct ProvidersWrapper: Codable {
    let version: String
    let providers: [SeedProvider]
}

private struct ExternalModelsWrapper: Codable {
    let version: String
    let models: [SeedExternalModel]
}

private struct SelfHostedModelsWrapper: Codable {
    let version: String
    let models: [SeedSelfHostedModel]
}

private struct ServicesWrapper: Codable {
    let version: String
    let services: [SeedService]
}
