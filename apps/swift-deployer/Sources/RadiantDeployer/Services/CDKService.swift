import Foundation

actor CDKService {
    private var process: Process?
    private var outputPipe: Pipe?
    
    enum CDKError: Error, LocalizedError {
        case nodeNotFound
        case cdkNotFound
        case bootstrapFailed(String)
        case deployFailed(String)
        case synthesizeFailed(String)
        
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
            }
        }
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
        tier: Int,
        credentials: CredentialSet,
        progressHandler: @escaping (String) -> Void
    ) async throws -> DeploymentOutputs? {
        let env = [
            "AWS_ACCESS_KEY_ID": credentials.accessKeyId,
            "AWS_SECRET_ACCESS_KEY": credentials.secretAccessKey,
            "AWS_DEFAULT_REGION": credentials.region
        ]
        
        let output = try await runCommand(
            "npx",
            arguments: [
                "cdk", "deploy", "--all",
                "--context", "appId=\(appId)",
                "--context", "environment=\(environment)",
                "--context", "tier=\(tier)",
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
        
        var output = ""
        
        outputPipe.fileHandleForReading.readabilityHandler = { handle in
            let data = handle.availableData
            if let str = String(data: data, encoding: .utf8), !str.isEmpty {
                output += str
                progressHandler?(str)
            }
        }
        
        try process.run()
        process.waitUntilExit()
        
        outputPipe.fileHandleForReading.readabilityHandler = nil
        
        return output
    }
}
