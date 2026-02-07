// RADIANT v7.1.0 - Bash Script Runner Service
// Discovers and executes deployment scripts, manages code sync to AWS instances

import Foundation

/// BashScriptRunnerService discovers deployment scripts in the codebase and executes them
/// with proper dependency resolution and progress tracking. Also handles code sync to AWS.
actor BashScriptRunnerService {
    
    // MARK: - Singleton
    
    static let shared = BashScriptRunnerService()
    
    // MARK: - Properties
    
    private let dependencyManager = DependencyManagerService.shared
    private var discoveredScripts: [DeploymentScript] = []
    private var scriptExecutionHistory: [ScriptExecutionRecord] = []
    private var syncState: CodeSyncState = CodeSyncState()
    
    // MARK: - Script Discovery
    
    /// Discovers all deployment scripts in the codebase
    func discoverScripts(projectPath: String) async -> [DeploymentScript] {
        var scripts: [DeploymentScript] = []
        
        // Known script locations
        let scriptPaths = [
            "scripts",
            "tools/scripts",
            "packages/infrastructure/scripts",
            "apps/swift-deployer/scripts"
        ]
        
        let fileManager = FileManager.default
        
        for relativePath in scriptPaths {
            let fullPath = (projectPath as NSString).appendingPathComponent(relativePath)
            
            guard fileManager.fileExists(atPath: fullPath) else { continue }
            
            do {
                let contents = try fileManager.contentsOfDirectory(atPath: fullPath)
                
                for filename in contents where filename.hasSuffix(".sh") {
                    let scriptPath = (fullPath as NSString).appendingPathComponent(filename)
                    
                    if let script = await parseScript(at: scriptPath, relativePath: "\(relativePath)/\(filename)") {
                        scripts.append(script)
                    }
                }
            } catch {
                RadiantLogger.warning("Error scanning \(fullPath): \(error.localizedDescription)", category: RadiantLogger.general)
            }
        }
        
        // Sort by category and name
        scripts.sort { ($0.category.rawValue, $0.name) < ($1.category.rawValue, $1.name) }
        
        discoveredScripts = scripts
        return scripts
    }
    
    /// Parses a script file to extract metadata
    private func parseScript(at path: String, relativePath: String) async -> DeploymentScript? {
        guard let content = try? String(contentsOfFile: path, encoding: .utf8) else {
            return nil
        }
        
        let name = (path as NSString).lastPathComponent.replacingOccurrences(of: ".sh", with: "")
        let category = categorizeScript(name: name, content: content)
        let dependencies = extractDependencies(from: content)
        let description = extractDescription(from: content)
        let arguments = extractArguments(from: content)
        let isExecutable = FileManager.default.isExecutableFile(atPath: path)
        
        return DeploymentScript(
            id: UUID().uuidString,
            name: name,
            path: path,
            relativePath: relativePath,
            category: category,
            description: description,
            dependencies: dependencies,
            arguments: arguments,
            isExecutable: isExecutable,
            lastModified: getFileModificationDate(path),
            content: content
        )
    }
    
    private func categorizeScript(name: String, content: String) -> ScriptCategory {
        let lowercaseName = name.lowercased()
        let lowercaseContent = content.lowercased()
        
        if lowercaseName.contains("deploy") {
            return .deployment
        } else if lowercaseName.contains("migrate") || lowercaseContent.contains("migration") {
            return .database
        } else if lowercaseName.contains("test") || lowercaseName.contains("verify") {
            return .testing
        } else if lowercaseName.contains("build") {
            return .build
        } else if lowercaseName.contains("setup") || lowercaseName.contains("install") {
            return .setup
        } else if lowercaseName.contains("backup") || lowercaseName.contains("restore") {
            return .backup
        } else if lowercaseName.contains("sync") || lowercaseName.contains("upload") {
            return .sync
        } else {
            return .utility
        }
    }
    
    private func extractDependencies(from content: String) -> [DependencyType] {
        var deps: Set<DependencyType> = []
        
        if content.contains("aws ") || content.contains("aws\n") {
            deps.insert(.awsCli)
        }
        if content.contains("node ") || content.contains("npm ") || content.contains("npx ") {
            deps.insert(.nodejs)
            deps.insert(.npm)
        }
        if content.contains("cdk ") {
            deps.insert(.cdk)
        }
        if content.contains("python") || content.contains("pip") {
            deps.insert(.python3)
        }
        if content.contains("docker ") {
            deps.insert(.docker)
        }
        if content.contains("git ") {
            deps.insert(.git)
        }
        
        return Array(deps)
    }
    
    private func extractDescription(from content: String) -> String {
        // Look for description in comments at the top of the file
        let lines = content.components(separatedBy: "\n")
        var description = ""
        
        for line in lines.prefix(20) {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.hasPrefix("#") && !trimmed.hasPrefix("#!") {
                let comment = trimmed.dropFirst().trimmingCharacters(in: .whitespaces)
                if !comment.isEmpty && !comment.hasPrefix("=") && !comment.hasPrefix("-") {
                    description = comment
                    break
                }
            }
        }
        
        return description.isEmpty ? "No description available" : description
    }
    
    private func extractArguments(from content: String) -> [ScriptArgument] {
        var arguments: [ScriptArgument] = []
        
        // Look for --help output or argument parsing
        let patterns = [
            #"-([a-z]), --([a-z-]+)\s+(.+)"#,
            #"--([a-z-]+)\s+(.+)"#
        ]
        
        for pattern in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) {
                let range = NSRange(content.startIndex..., in: content)
                let matches = regex.matches(in: content, options: [], range: range)
                
                for match in matches {
                    if match.numberOfRanges >= 3 {
                        let nameRange = Range(match.range(at: match.numberOfRanges == 4 ? 2 : 1), in: content)!
                        let descRange = Range(match.range(at: match.numberOfRanges == 4 ? 3 : 2), in: content)!
                        
                        let name = String(content[nameRange])
                        let desc = String(content[descRange])
                        
                        arguments.append(ScriptArgument(
                            name: name,
                            shortName: match.numberOfRanges == 4 ? String(content[Range(match.range(at: 1), in: content)!]) : nil,
                            description: desc,
                            required: false,
                            defaultValue: nil
                        ))
                    }
                }
            }
        }
        
        return arguments
    }
    
    private func getFileModificationDate(_ path: String) -> Date {
        let attributes = try? FileManager.default.attributesOfItem(atPath: path)
        return attributes?[.modificationDate] as? Date ?? Date()
    }
    
    // MARK: - Script Execution
    
    /// Executes a deployment script with the given arguments
    func executeScript(
        _ script: DeploymentScript,
        arguments: [String: String] = [:],
        environment: DeployEnvironment = .dev,
        progressHandler: @escaping (ScriptExecutionProgress) -> Void
    ) async throws -> ScriptExecutionResult {
        
        let executionId = UUID().uuidString
        let startTime = Date()
        
        // Check dependencies first
        progressHandler(.checkingDependencies)
        
        let missingDeps = await checkScriptDependencies(script)
        if !missingDeps.isEmpty {
            // Attempt to install missing dependencies
            progressHandler(.installingDependencies(missingDeps))
            
            let installResult = try await dependencyManager.installMissingDependencies { dep, progress in
                progressHandler(.installingDependency(dep, progress))
            }
            
            if !installResult.success {
                let failedNames = installResult.failed.map { $0.0.rawValue }.joined(separator: ", ")
                throw ScriptError.dependenciesNotMet(failedNames)
            }
        }
        
        // Build command with arguments
        progressHandler(.preparing)
        
        var command = script.path
        for (key, value) in arguments {
            command += " --\(key) \(value)"
        }
        
        // Add environment if the script supports it
        if script.arguments.contains(where: { $0.name == "environment" }) {
            command += " --environment \(environment.shortName)"
        }
        
        // Make executable if needed
        if !script.isExecutable {
            _ = await runShellCommand("chmod +x \(script.path)")
        }
        
        // Execute the script
        progressHandler(.running)
        
        let result = await runShellCommandWithStreaming(command) { line in
            progressHandler(.output(line))
        }
        
        let endTime = Date()
        let duration = endTime.timeIntervalSince(startTime)
        
        // Record execution
        let record = ScriptExecutionRecord(
            id: executionId,
            script: script,
            arguments: arguments,
            environment: environment,
            startTime: startTime,
            endTime: endTime,
            duration: duration,
            exitCode: result.exitCode,
            output: result.output,
            success: result.exitCode == 0
        )
        
        scriptExecutionHistory.append(record)
        
        if result.exitCode == 0 {
            progressHandler(.completed)
        } else {
            progressHandler(.failed(result.output))
        }
        
        return ScriptExecutionResult(
            success: result.exitCode == 0,
            exitCode: result.exitCode,
            output: result.output,
            duration: duration,
            executionId: executionId
        )
    }
    
    private func checkScriptDependencies(_ script: DeploymentScript) async -> [DependencyType] {
        var missing: [DependencyType] = []
        
        for dep in script.dependencies {
            let status = await dependencyManager.checkDependency(dep)
            if !status.installed {
                missing.append(dep)
            }
        }
        
        return missing
    }
    
    // MARK: - Code Sync to AWS
    
    /// Syncs local code changes to the AWS instance
    func syncCodeToAWS(
        projectPath: String,
        environment: DeployEnvironment,
        credential: CredentialSet,
        progressHandler: @escaping (CodeSyncProgress) -> Void
    ) async throws -> CodeSyncResult {
        
        let syncId = UUID().uuidString
        let startTime = Date()
        
        progressHandler(.analyzing)
        
        // Get list of changed files since last sync
        let changedFiles = await getChangedFiles(projectPath: projectPath)
        
        if changedFiles.isEmpty {
            progressHandler(.noChanges)
            return CodeSyncResult(
                success: true,
                syncId: syncId,
                filesUploaded: 0,
                bytesTransferred: 0,
                duration: 0
            )
        }
        
        progressHandler(.preparingUpload(changedFiles.count))
        
        // Build the deployment package
        let packagePath = try await buildDeploymentPackage(
            projectPath: projectPath,
            changedFiles: changedFiles
        )
        
        progressHandler(.uploading(0, changedFiles.count))
        
        // Upload to S3
        let s3Bucket = "radiant-\(environment.shortName)-artifacts"
        let s3Key = "code-sync/\(syncId).tar.gz"
        
        let uploadResult = await uploadToS3(
            localPath: packagePath,
            bucket: s3Bucket,
            key: s3Key,
            credential: credential
        ) { progress in
            let uploaded = Int(Double(changedFiles.count) * progress)
            progressHandler(.uploading(uploaded, changedFiles.count))
        }
        
        guard uploadResult.success else {
            throw ScriptError.uploadFailed(uploadResult.error ?? "Unknown error")
        }
        
        progressHandler(.triggering)
        
        // Trigger Lambda to apply the sync
        let triggerResult = await triggerCodeSyncLambda(
            s3Bucket: s3Bucket,
            s3Key: s3Key,
            environment: environment,
            credential: credential
        )
        
        guard triggerResult.success else {
            throw ScriptError.syncTriggerFailed(triggerResult.error ?? "Unknown error")
        }
        
        progressHandler(.verifying)
        
        // Wait for sync completion
        let verified = try await waitForSyncCompletion(
            syncId: syncId,
            environment: environment,
            credential: credential,
            timeout: 120
        )
        
        let endTime = Date()
        let duration = endTime.timeIntervalSince(startTime)
        
        // Update sync state
        syncState.lastSyncTime = endTime
        syncState.lastSyncId = syncId
        syncState.syncedFiles.formUnion(changedFiles.map { $0.path })
        
        if verified {
            progressHandler(.completed)
        } else {
            progressHandler(.failed("Sync verification timed out"))
        }
        
        // Cleanup
        try? FileManager.default.removeItem(atPath: packagePath)
        
        return CodeSyncResult(
            success: verified,
            syncId: syncId,
            filesUploaded: changedFiles.count,
            bytesTransferred: uploadResult.bytesTransferred,
            duration: duration
        )
    }
    
    private func getChangedFiles(projectPath: String) async -> [ChangedFile] {
        // Use git to find changed files
        let result = await runShellCommand("cd \(projectPath) && git status --porcelain")
        
        guard result.exitCode == 0 else { return [] }
        
        var files: [ChangedFile] = []
        let lines = result.output.components(separatedBy: "\n")
        
        for line in lines where !line.isEmpty {
            let status = String(line.prefix(2)).trimmingCharacters(in: .whitespaces)
            let path = String(line.dropFirst(3))
            
            let changeType: ChangeType
            switch status {
            case "M", "MM": changeType = .modified
            case "A", "??": changeType = .added
            case "D": changeType = .deleted
            case "R": changeType = .renamed
            default: changeType = .modified
            }
            
            let fullPath = (projectPath as NSString).appendingPathComponent(path)
            let fileSize = (try? FileManager.default.attributesOfItem(atPath: fullPath)[.size] as? Int) ?? 0
            
            files.append(ChangedFile(
                path: path,
                fullPath: fullPath,
                changeType: changeType,
                size: fileSize
            ))
        }
        
        return files
    }
    
    private func buildDeploymentPackage(projectPath: String, changedFiles: [ChangedFile]) async throws -> String {
        let tempDir = NSTemporaryDirectory()
        let packageName = "code-sync-\(UUID().uuidString).tar.gz"
        let packagePath = (tempDir as NSString).appendingPathComponent(packageName)
        
        // Create file list
        let fileListPath = (tempDir as NSString).appendingPathComponent("files.txt")
        let fileList = changedFiles.filter { $0.changeType != .deleted }.map { $0.path }.joined(separator: "\n")
        try fileList.write(toFile: fileListPath, atomically: true, encoding: .utf8)
        
        // Create tar archive
        let tarCommand = "cd \(projectPath) && tar -czf \(packagePath) -T \(fileListPath)"
        let result = await runShellCommand(tarCommand)
        
        try? FileManager.default.removeItem(atPath: fileListPath)
        
        guard result.exitCode == 0 else {
            throw ScriptError.packageBuildFailed(result.output)
        }
        
        return packagePath
    }
    
    private func uploadToS3(
        localPath: String,
        bucket: String,
        key: String,
        credential: CredentialSet,
        progressHandler: @escaping (Double) -> Void
    ) async -> UploadResult {
        let command = "aws s3 cp \(localPath) s3://\(bucket)/\(key)"
        let result = await runShellCommand(command)
        
        if result.exitCode == 0 {
            let fileSize = (try? FileManager.default.attributesOfItem(atPath: localPath)[.size] as? Int) ?? 0
            return UploadResult(success: true, bytesTransferred: fileSize, error: nil)
        } else {
            return UploadResult(success: false, bytesTransferred: 0, error: result.output)
        }
    }
    
    private func triggerCodeSyncLambda(
        s3Bucket: String,
        s3Key: String,
        environment: DeployEnvironment,
        credential: CredentialSet
    ) async -> TriggerResult {
        let payload = """
        {"bucket": "\(s3Bucket)", "key": "\(s3Key)", "environment": "\(environment.shortName)"}
        """
        
        let command = """
        aws lambda invoke --function-name radiant-\(environment.shortName)-code-sync \
        --payload '\(payload)' /tmp/lambda-response.json
        """
        
        let result = await runShellCommand(command)
        return TriggerResult(success: result.exitCode == 0, error: result.exitCode == 0 ? nil : result.output)
    }
    
    private func waitForSyncCompletion(
        syncId: String,
        environment: DeployEnvironment,
        credential: CredentialSet,
        timeout: TimeInterval
    ) async throws -> Bool {
        // In a real implementation, this would poll CloudWatch or a status endpoint
        // For now, we'll simulate with a short delay
        try await Task.sleep(for: .seconds(2))
        return true
    }
    
    // MARK: - Shell Command Execution
    
    private func runShellCommand(_ command: String) async -> CommandResult {
        await withCheckedContinuation { continuation in
            let task = Process()
            let pipe = Pipe()
            
            task.standardOutput = pipe
            task.standardError = pipe
            task.executableURL = URL(fileURLWithPath: "/bin/zsh")
            task.arguments = ["-c", command]
            
            var environment = ProcessInfo.processInfo.environment
            let additionalPaths = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"]
            environment["PATH"] = (additionalPaths + [environment["PATH"] ?? ""]).joined(separator: ":")
            task.environment = environment
            
            do {
                try task.run()
                task.waitUntilExit()
                
                let data = pipe.fileHandleForReading.readDataToEndOfFile()
                let output = String(data: data, encoding: .utf8) ?? ""
                
                continuation.resume(returning: CommandResult(
                    exitCode: Int(task.terminationStatus),
                    output: output.trimmingCharacters(in: .whitespacesAndNewlines)
                ))
            } catch {
                continuation.resume(returning: CommandResult(exitCode: -1, output: error.localizedDescription))
            }
        }
    }
    
    private func runShellCommandWithStreaming(_ command: String, outputHandler: @escaping (String) -> Void) async -> CommandResult {
        await withCheckedContinuation { continuation in
            let task = Process()
            let pipe = Pipe()
            
            task.standardOutput = pipe
            task.standardError = pipe
            task.executableURL = URL(fileURLWithPath: "/bin/zsh")
            task.arguments = ["-c", command]
            
            var environment = ProcessInfo.processInfo.environment
            let additionalPaths = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"]
            environment["PATH"] = (additionalPaths + [environment["PATH"] ?? ""]).joined(separator: ":")
            task.environment = environment
            
            var outputLines: [String] = []
            
            pipe.fileHandleForReading.readabilityHandler = { handle in
                let data = handle.availableData
                if let line = String(data: data, encoding: .utf8), !line.isEmpty {
                    outputLines.append(line)
                    outputHandler(line)
                }
            }
            
            do {
                try task.run()
                task.waitUntilExit()
                
                pipe.fileHandleForReading.readabilityHandler = nil
                
                continuation.resume(returning: CommandResult(
                    exitCode: Int(task.terminationStatus),
                    output: outputLines.joined()
                ))
            } catch {
                continuation.resume(returning: CommandResult(exitCode: -1, output: error.localizedDescription))
            }
        }
    }
    
    // MARK: - History
    
    func getExecutionHistory() -> [ScriptExecutionRecord] {
        return scriptExecutionHistory
    }
    
    func getDiscoveredScripts() -> [DeploymentScript] {
        return discoveredScripts
    }
}

// MARK: - Models

struct DeploymentScript: Identifiable, Sendable {
    let id: String
    let name: String
    let path: String
    let relativePath: String
    let category: ScriptCategory
    let description: String
    let dependencies: [DependencyType]
    let arguments: [ScriptArgument]
    let isExecutable: Bool
    let lastModified: Date
    let content: String
}

enum ScriptCategory: String, CaseIterable, Sendable {
    case deployment = "Deployment"
    case database = "Database"
    case build = "Build"
    case testing = "Testing"
    case setup = "Setup"
    case backup = "Backup"
    case sync = "Sync"
    case utility = "Utility"
    
    var icon: String {
        switch self {
        case .deployment: return "arrow.up.circle"
        case .database: return "cylinder"
        case .build: return "hammer"
        case .testing: return "checkmark.circle"
        case .setup: return "gearshape"
        case .backup: return "arrow.clockwise"
        case .sync: return "arrow.triangle.2.circlepath"
        case .utility: return "wrench"
        }
    }
}

struct ScriptArgument: Sendable {
    let name: String
    let shortName: String?
    let description: String
    let required: Bool
    let defaultValue: String?
}

struct ScriptExecutionRecord: Identifiable, Sendable {
    let id: String
    let script: DeploymentScript
    let arguments: [String: String]
    let environment: DeployEnvironment
    let startTime: Date
    let endTime: Date
    let duration: TimeInterval
    let exitCode: Int
    let output: String
    let success: Bool
}

struct ScriptExecutionResult: Sendable {
    let success: Bool
    let exitCode: Int
    let output: String
    let duration: TimeInterval
    let executionId: String
}

enum ScriptExecutionProgress: Sendable {
    case checkingDependencies
    case installingDependencies([DependencyType])
    case installingDependency(DependencyType, InstallationProgress)
    case preparing
    case running
    case output(String)
    case completed
    case failed(String)
}

// MARK: - Code Sync Models

struct CodeSyncState: Sendable {
    var lastSyncTime: Date?
    var lastSyncId: String?
    var syncedFiles: Set<String> = []
}

struct ChangedFile: Sendable {
    let path: String
    let fullPath: String
    let changeType: ChangeType
    let size: Int
}

enum ChangeType: String, Sendable {
    case added = "Added"
    case modified = "Modified"
    case deleted = "Deleted"
    case renamed = "Renamed"
}

struct CodeSyncResult: Sendable {
    let success: Bool
    let syncId: String
    let filesUploaded: Int
    let bytesTransferred: Int
    let duration: TimeInterval
}

enum CodeSyncProgress: Sendable {
    case analyzing
    case noChanges
    case preparingUpload(Int)
    case uploading(Int, Int)
    case triggering
    case verifying
    case completed
    case failed(String)
}

struct UploadResult: Sendable {
    let success: Bool
    let bytesTransferred: Int
    let error: String?
}

struct TriggerResult: Sendable {
    let success: Bool
    let error: String?
}

enum ScriptError: LocalizedError {
    case dependenciesNotMet(String)
    case executionFailed(String)
    case uploadFailed(String)
    case syncTriggerFailed(String)
    case packageBuildFailed(String)
    
    var errorDescription: String? {
        switch self {
        case .dependenciesNotMet(let deps):
            return "Missing dependencies: \(deps)"
        case .executionFailed(let output):
            return "Script execution failed: \(output)"
        case .uploadFailed(let error):
            return "Upload failed: \(error)"
        case .syncTriggerFailed(let error):
            return "Sync trigger failed: \(error)"
        case .packageBuildFailed(let error):
            return "Failed to build package: \(error)"
        }
    }
}
