// RADIANT v4.18.0 - Endpoint Resolver
// Resolves endpoint configurations from Deployer's existing credential and deployment settings

import Foundation

actor EndpointResolver {

    // MARK: - Properties

    private let credentialManager: AWSCredentialsManagerService

    // MARK: - Initialization

    init(credentialManager: AWSCredentialsManagerService = .shared) {
        self.credentialManager = credentialManager
    }

    // MARK: - Endpoint Resolution

    func resolveEndpoints(for protocolType: TestProtocol) async throws -> [EndpointConfiguration] {
        switch protocolType {
        case .mcp:
            return try await resolveMCPEndpoints()
        case .a2a:
            return try await resolveA2AEndpoints()
        case .rest:
            return try await resolveRESTEndpoints()
        case .cross:
            return try await resolveCrossEndpoints()
        }
    }

    func resolveCredentials() async throws -> SecurityTestCredentials {
        let masterCred = await credentialManager.getMasterCredential(reveal: true)

        guard let cred = masterCred else {
            throw EndpointResolverError.noCredentialsConfigured
        }

        let apiKeys: [String: String] = [
            "aws_access_key_id": cred.currentVersion.accessKeyId,
            "aws_secret_access_key": cred.currentVersion.secretAccessKey,
        ]

        let bearerTokens: [String: String] = [:]

        return SecurityTestCredentials(
            apiKeys: apiKeys,
            bearerTokens: bearerTokens,
            region: cred.region,
            accountId: cred.accountId
        )
    }

    func resolveBaseURL() async throws -> URL {
        let config = try await loadDeploymentConfig()
        guard let url = URL(string: "https://api.\(config.baseDomain)") else {
            throw EndpointResolverError.invalidBaseURL(config.baseDomain)
        }
        return url
    }

    // MARK: - Protocol-Specific Resolution

    private func resolveMCPEndpoints() async throws -> [EndpointConfiguration] {
        let config = try await loadDeploymentConfig()
        let baseDomain = config.baseDomain

        var endpoints: [EndpointConfiguration] = []

        if let mcpURL = URL(string: "https://mcp.\(baseDomain)") {
            endpoints.append(EndpointConfiguration(
                url: mcpURL,
                protocolType: .mcp,
                transportType: .httpSSE,
                authMethod: .bearer,
                label: "MCP Server (HTTP+SSE)"
            ))
        }

        if let mcpStdioURL = URL(string: "https://mcp-stdio.\(baseDomain)") {
            endpoints.append(EndpointConfiguration(
                url: mcpStdioURL,
                protocolType: .mcp,
                transportType: .stdio,
                authMethod: .apiKey,
                label: "MCP Server (stdio)"
            ))
        }

        if endpoints.isEmpty {
            throw EndpointResolverError.noEndpointsFound(.mcp)
        }
        return endpoints
    }

    private func resolveA2AEndpoints() async throws -> [EndpointConfiguration] {
        let config = try await loadDeploymentConfig()
        let baseDomain = config.baseDomain

        var endpoints: [EndpointConfiguration] = []

        if let a2aURL = URL(string: "https://a2a.\(baseDomain)") {
            endpoints.append(EndpointConfiguration(
                url: a2aURL,
                protocolType: .a2a,
                transportType: .https,
                authMethod: .bearer,
                label: "A2A Protocol Gateway"
            ))
        }

        if let agentCardURL = URL(string: "https://a2a.\(baseDomain)/.well-known/agent-card.json") {
            endpoints.append(EndpointConfiguration(
                url: agentCardURL,
                protocolType: .a2a,
                transportType: .https,
                authMethod: .none,
                label: "Agent Card Discovery"
            ))
        }

        if endpoints.isEmpty {
            throw EndpointResolverError.noEndpointsFound(.a2a)
        }
        return endpoints
    }

    private func resolveRESTEndpoints() async throws -> [EndpointConfiguration] {
        let config = try await loadDeploymentConfig()
        let baseDomain = config.baseDomain

        var endpoints: [EndpointConfiguration] = []

        if let apiURL = URL(string: "https://api.\(baseDomain)") {
            endpoints.append(EndpointConfiguration(
                url: apiURL,
                protocolType: .rest,
                transportType: .https,
                authMethod: .bearer,
                label: "REST API Gateway"
            ))
        }

        if let adminURL = URL(string: "https://admin-api.\(baseDomain)") {
            endpoints.append(EndpointConfiguration(
                url: adminURL,
                protocolType: .rest,
                transportType: .https,
                authMethod: .bearer,
                label: "Admin REST API"
            ))
        }

        if endpoints.isEmpty {
            throw EndpointResolverError.noEndpointsFound(.rest)
        }
        return endpoints
    }

    private func resolveCrossEndpoints() async throws -> [EndpointConfiguration] {
        var allEndpoints: [EndpointConfiguration] = []
        if let mcpEndpoints = try? await resolveMCPEndpoints() {
            allEndpoints.append(contentsOf: mcpEndpoints)
        }
        if let a2aEndpoints = try? await resolveA2AEndpoints() {
            allEndpoints.append(contentsOf: a2aEndpoints)
        }
        if let restEndpoints = try? await resolveRESTEndpoints() {
            allEndpoints.append(contentsOf: restEndpoints)
        }
        if allEndpoints.isEmpty {
            throw EndpointResolverError.noEndpointsFound(.cross)
        }
        return allEndpoints
    }

    // MARK: - Deployment Config Loading

    private func loadDeploymentConfig() async throws -> ResolvedDeployConfig {
        let masterCred = await credentialManager.getMasterCredential(reveal: false)
        guard let cred = masterCred else {
            throw EndpointResolverError.noCredentialsConfigured
        }

        let baseDomain = UserDefaults.standard.string(forKey: "radiant.baseDomain") ?? ""
        guard !baseDomain.isEmpty else {
            throw EndpointResolverError.noBaseDomainConfigured
        }

        return ResolvedDeployConfig(
            baseDomain: baseDomain,
            region: cred.region,
            accountId: cred.accountId
        )
    }

    // MARK: - Types

    struct ResolvedDeployConfig {
        let baseDomain: String
        let region: String
        let accountId: String?
    }

    enum EndpointResolverError: Error, LocalizedError {
        case noCredentialsConfigured
        case noBaseDomainConfigured
        case noEndpointsFound(TestProtocol)
        case invalidBaseURL(String)

        var errorDescription: String? {
            switch self {
            case .noCredentialsConfigured:
                return "No AWS credentials configured. Please set up credentials in the Credentials tab."
            case .noBaseDomainConfigured:
                return "No base domain configured. Please set up a domain in Domain URLs settings."
            case .noEndpointsFound(let proto):
                return "No \(proto.displayName) endpoints found for the current deployment configuration."
            case .invalidBaseURL(let domain):
                return "Cannot construct valid URL from base domain: \(domain)"
            }
        }
    }
}
