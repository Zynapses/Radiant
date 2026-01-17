import Foundation

actor CDKService {
    private var process: Process?
    private var outputPipe: Pipe?
    
    // ═══════════════════════════════════════════════════════════════════════════
    // CRITICAL SAFETY RULE: cdk watch/hotswap is DEV-ONLY
    // ═══════════════════════════════════════════════════════════════════════════
    // This rule is enforced at the CDK entry point AND here in Swift.
    // Hotswap bypasses CloudFormation safety checks and can corrupt infrastructure.
    // ═══════════════════════════════════════════════════════════════════════════
    
    enum CDKError: Error, LocalizedError {
        case nodeNotFound
        case cdkNotFound
        case bootstrapFailed(String)
        case deployFailed(String)
        case synthesizeFailed(String)
        case hotswapBlockedForEnvironment(String)
        case watchBlockedForEnvironment(String)
        
        var errorDescription: String? {
            switch self {
            case .nodeNotFound:
                return "Node.js not found. Please install Node.js 20+."
            case .cdkNotFound:
                return "AWS CDK not found. Please install AWS CDK."
            case .bootstrapFailed(let message):
                return "CDK bootstrap failed: \(message)"
            case .deployFailed(let message):
                return "CDK deploy failed: \(message)"
            case .synthesizeFailed(let message):
                return "CDK synth failed: \(message)"
            case .hotswapBlockedForEnvironment(let env):
                return "🛑 BLOCKED: Hotswap deployments are FORBIDDEN for \(env). Use standard deploy with approval gates."
            case .watchBlockedForEnvironment(let env):
                return "🛑 BLOCKED: cdk watch is FORBIDDEN for \(env). Use standard deploy with approval gates."
            }
        }
    }
    
    /// Check if hotswap/watch is allowed for the given environment
    /// Returns true ONLY for dev environment
    private func isHotswapAllowed(environment: String) -> Bool {
        let env = environment.lowercased()
        return env == "dev" || env == "development"
    }
    
    /// Get the appropriate approval mode for the environment
    /// - DEV: "never" (fast iteration)
    /// - STAGING/PROD: "broadening" (requires approval for permission changes)
    private func getApprovalMode(environment: String) -> String {
        if isHotswapAllowed(environment: environment) {
            return "never"
        }
        return "broadening"
    }
    
    func checkPrerequisites() async throws -> Bool {
        let nodeVersion = try await runCommand("node", arguments: ["--version"])
        guard nodeVersion.contains("v20") || nodeVersion.contains("v21") || nodeVersion.contains("v22") else {
            throw CDKError.nodeNotFound
        }
        
        let cdkVersion = try await runCommand("npx", arguments: ["cdk", "--version"])
        guard !cdkVersion.isEmpty else {
            throw CDKError.cdkNotFound
        }
        
        return true
    }
    
    func bootstrap(
        region: String,
        accountId: String,
        credentials: CredentialSet,
        progressHandler: @escaping (String) -> Void
    ) async throws {
        let env = [
            "AWS_ACCESS_KEY_ID": credentials.accessKeyId,
            "AWS_SECRET_ACCESS_KEY": credentials.secretAccessKey,
            "AWS_DEFAULT_REGION": region
        ]
        
        let output = try await runCommand(
            "npx",
            arguments: ["cdk", "bootstrap", "aws://\(accountId)/\(region)"],
            environment: env,
            progressHandler: progressHandler
        )
        
        if output.contains("error") || output.contains("Error") {
            throw CDKError.bootstrapFailed(output)
        }
    }
    
    func deploy(
        appId: String,
        environment: String,
        credentials: CredentialSet,
        progressHandler: @escaping (String) -> Void
    ) async throws -> DeploymentOutputs? {
        // ═══════════════════════════════════════════════════════════════════════
        // SAFETY: Use environment-appropriate approval mode
        // DEV: --require-approval never (fast iteration)
        // STAGING/PROD: --require-approval broadening (safety gates)
        // ═══════════════════════════════════════════════════════════════════════
        let approvalMode = getApprovalMode(environment: environment)
        
        let env = [
            "AWS_ACCESS_KEY_ID": credentials.accessKeyId,
            "AWS_SECRET_ACCESS_KEY": credentials.secretAccessKey,
            "AWS_DEFAULT_REGION": credentials.region,
            "RADIANT_ENV": environment.lowercased()  // Pass to CDK for additional safety checks
        ]
        
        // Log safety mode for transparency
        if approvalMode == "broadening" {
            progressHandler("🛡️ Safety Mode: Deploying to \(environment.uppercased()) with approval gates enabled\n")
        }
        
        let output = try await runCommand(
            "npx",
            arguments: [
                "cdk", "deploy", "--all",
                "--context", "appId=\(appId)",
                "--context", "environment=\(environment)",
                "--require-approval", approvalMode,
                "--outputs-file", "cdk-outputs.json"
            ],
            environment: env,
            progressHandler: progressHandler
        )
        
        if output.contains("failed") || output.contains("Error") {
            throw CDKError.deployFailed(output)
        }
        
        return nil
    }
    
    /// Deploy with hotswap - DEV ONLY
    /// This function will throw an error if called for non-dev environments
    func deployWithHotswap(
        appId: String,
        environment: String,
        credentials: CredentialSet,
        progressHandler: @escaping (String) -> Void
    ) async throws -> DeploymentOutputs? {
        // ═══════════════════════════════════════════════════════════════════════
        // 🛑 CRITICAL SAFETY CHECK: Hotswap is DEV-ONLY
        // ═══════════════════════════════════════════════════════════════════════
        guard isHotswapAllowed(environment: environment) else {
            throw CDKError.hotswapBlockedForEnvironment(environment)
        }
        
        let env = [
            "AWS_ACCESS_KEY_ID": credentials.accessKeyId,
            "AWS_SECRET_ACCESS_KEY": credentials.secretAccessKey,
            "AWS_DEFAULT_REGION": credentials.region,
            "RADIANT_ENV": "dev"
        ]
        
        progressHandler("⚡ Hotswap Mode: Fast deployment for DEV environment\n")
        
        let output = try await runCommand(
            "npx",
            arguments: [
                "cdk", "deploy", "--all", "--hotswap",
                "--context", "appId=\(appId)",
                "--context", "environment=\(environment)",
                "--require-approval", "never",
                "--outputs-file", "cdk-outputs.json"
            ],
            environment: env,
            progressHandler: progressHandler
        )
        
        if output.contains("failed") || output.contains("Error") {
            throw CDKError.deployFailed(output)
        }
        
        return nil
    }
    
    /// Start cdk watch - DEV ONLY
    /// This function will throw an error if called for non-dev environments
    func startWatch(
        appId: String,
        environment: String,
        credentials: CredentialSet,
        progressHandler: @escaping (String) -> Void
    ) async throws {
        // ═══════════════════════════════════════════════════════════════════════
        // 🛑 CRITICAL SAFETY CHECK: cdk watch is DEV-ONLY
        // ═══════════════════════════════════════════════════════════════════════
        guard isHotswapAllowed(environment: environment) else {
            throw CDKError.watchBlockedForEnvironment(environment)
        }
        
        let env = [
            "AWS_ACCESS_KEY_ID": credentials.accessKeyId,
            "AWS_SECRET_ACCESS_KEY": credentials.secretAccessKey,
            "AWS_DEFAULT_REGION": credentials.region,
            "RADIANT_ENV": "dev",
            "CDK_WATCH": "true"
        ]
        
        progressHandler("👁️ Watch Mode: Starting continuous deployment for DEV environment\n")
        progressHandler("⚠️ This mode is ONLY available for development. Press Ctrl+C to stop.\n")
        
        _ = try await runCommand(
            "npx",
            arguments: [
                "cdk", "watch", "--hotswap",
                "--context", "appId=\(appId)",
                "--context", "environment=\(environment)"
            ],
            environment: env,
            progressHandler: progressHandler
        )
    }
    
    private func runCommand(
        _ command: String,
        arguments: [String] = [],
        environment: [String: String]? = nil,
        progressHandler: ((String) -> Void)? = nil
    ) async throws -> String {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = [command] + arguments
        
        if let env = environment {
            var processEnv = ProcessInfo.processInfo.environment
            for (key, value) in env {
                processEnv[key] = value
            }
            process.environment = processEnv
        }
        
        let outputPipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = errorPipe
        
        // Use actor-isolated storage to avoid sendable closure capture warning
        let outputData = OutputAccumulator()
        
        outputPipe.fileHandleForReading.readabilityHandler = { handle in
            let data = handle.availableData
            if let str = String(data: data, encoding: .utf8), !str.isEmpty {
                outputData.append(str)
                progressHandler?(str)
            }
        }
        
        try process.run()
        process.waitUntilExit()
        
        outputPipe.fileHandleForReading.readabilityHandler = nil
        
        return outputData.value
    }
}

// Thread-safe output accumulator to avoid Sendable closure capture issues
private final class OutputAccumulator: @unchecked Sendable {
    private var _value: String = ""
    private let lock = NSLock()
    
    var value: String {
        lock.lock()
        defer { lock.unlock() }
        return _value
    }
    
    func append(_ str: String) {
        lock.lock()
        defer { lock.unlock() }
        _value += str
    }
}

// MARK: - Singleton

extension CDKService {
    static let shared = CDKService()
}
