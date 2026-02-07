// RADIANT v7.1.0 - Dependency Manager Service
// Automatically detects and installs required CLI tools for deployment

import Foundation

/// DependencyManagerService handles detection and automatic installation of required
/// command-line tools like AWS CLI, Node.js, CDK, and other deployment dependencies.
actor DependencyManagerService {
    
    // MARK: - Singleton
    
    static let shared = DependencyManagerService()
    
    // MARK: - Properties
    
    private var installedDependencies: Set<DependencyType> = []
    private var installationProgress: [DependencyType: InstallationProgress] = [:]
    
    // MARK: - Dependency Detection
    
    /// Checks all required dependencies and returns their status
    func checkAllDependencies() async -> DependencyCheckResult {
        var results: [DependencyStatus] = []
        
        for dependency in DependencyType.allCases {
            let status = await checkDependency(dependency)
            results.append(status)
        }
        
        let missingRequired = results.filter { !$0.installed && $0.dependency.isRequired }
        let missingOptional = results.filter { !$0.installed && !$0.dependency.isRequired }
        
        return DependencyCheckResult(
            allRequiredInstalled: missingRequired.isEmpty,
            dependencies: results,
            missingRequired: missingRequired.map { $0.dependency },
            missingOptional: missingOptional.map { $0.dependency }
        )
    }
    
    /// Checks if a specific dependency is installed
    func checkDependency(_ dependency: DependencyType) async -> DependencyStatus {
        let result = await runCommand(dependency.checkCommand)
        
        if result.exitCode == 0 {
            let version = parseVersion(from: result.output, pattern: dependency.versionPattern)
            installedDependencies.insert(dependency)
            
            return DependencyStatus(
                dependency: dependency,
                installed: true,
                version: version,
                path: await findExecutablePath(dependency.executable),
                meetsMinimumVersion: version.map { meetsMinimum($0, minimum: dependency.minimumVersion) } ?? true
            )
        } else {
            return DependencyStatus(
                dependency: dependency,
                installed: false,
                version: nil,
                path: nil,
                meetsMinimumVersion: false
            )
        }
    }
    
    // MARK: - Automatic Installation
    
    /// Installs all missing required dependencies
    func installMissingDependencies(progressHandler: @escaping (DependencyType, InstallationProgress) -> Void) async throws -> InstallationResult {
        let checkResult = await checkAllDependencies()
        
        guard !checkResult.allRequiredInstalled else {
            return InstallationResult(success: true, installed: [], failed: [], skipped: checkResult.dependencies.filter { $0.installed }.map { $0.dependency })
        }
        
        var installed: [DependencyType] = []
        var failed: [(DependencyType, String)] = []
        
        // First ensure Homebrew is installed (required for other installations on macOS)
        if checkResult.missingRequired.contains(.homebrew) || checkResult.missingOptional.contains(.homebrew) {
            do {
                try await installDependency(.homebrew, progressHandler: progressHandler)
                installed.append(.homebrew)
            } catch {
                failed.append((.homebrew, error.localizedDescription))
                // Can't proceed without Homebrew on macOS
                return InstallationResult(success: false, installed: installed, failed: failed, skipped: [])
            }
        }
        
        // Install other missing dependencies
        for dependency in checkResult.missingRequired where dependency != .homebrew {
            do {
                try await installDependency(dependency, progressHandler: progressHandler)
                installed.append(dependency)
            } catch {
                failed.append((dependency, error.localizedDescription))
            }
        }
        
        return InstallationResult(
            success: failed.isEmpty,
            installed: installed,
            failed: failed,
            skipped: []
        )
    }
    
    /// Installs a specific dependency
    func installDependency(_ dependency: DependencyType, progressHandler: @escaping (DependencyType, InstallationProgress) -> Void) async throws {
        updateProgress(dependency, .downloading, progressHandler)
        
        let installScript = dependency.installScript
        
        updateProgress(dependency, .installing, progressHandler)
        
        let result = await runCommand(installScript, timeout: 300) // 5 minute timeout for installations
        
        if result.exitCode != 0 {
            updateProgress(dependency, .failed(result.output), progressHandler)
            throw DependencyError.installationFailed(dependency, result.output)
        }
        
        // Verify installation
        let verifyResult = await checkDependency(dependency)
        
        if verifyResult.installed {
            updateProgress(dependency, .completed, progressHandler)
            installedDependencies.insert(dependency)
        } else {
            updateProgress(dependency, .failed("Installation completed but dependency not found"), progressHandler)
            throw DependencyError.verificationFailed(dependency)
        }
    }
    
    // MARK: - Helper Methods
    
    private func updateProgress(_ dependency: DependencyType, _ progress: InstallationProgress, _ handler: (DependencyType, InstallationProgress) -> Void) {
        installationProgress[dependency] = progress
        handler(dependency, progress)
    }
    
    private func runCommand(_ command: String, timeout: TimeInterval = 30) async -> CommandResult {
        await withCheckedContinuation { continuation in
            let task = Process()
            let pipe = Pipe()
            
            task.standardOutput = pipe
            task.standardError = pipe
            task.executableURL = URL(fileURLWithPath: "/bin/zsh")
            task.arguments = ["-c", command]
            
            // Add common paths to PATH
            var environment = ProcessInfo.processInfo.environment
            let additionalPaths = [
                "/opt/homebrew/bin",
                "/usr/local/bin",
                "/usr/bin",
                "/bin",
                "/usr/sbin",
                "/sbin",
                "\(NSHomeDirectory())/.nvm/versions/node/*/bin",
                "\(NSHomeDirectory())/.local/bin"
            ]
            let currentPath = environment["PATH"] ?? ""
            environment["PATH"] = (additionalPaths + [currentPath]).joined(separator: ":")
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
                continuation.resume(returning: CommandResult(
                    exitCode: -1,
                    output: error.localizedDescription
                ))
            }
        }
    }
    
    private func findExecutablePath(_ executable: String) async -> String? {
        let result = await runCommand("which \(executable)")
        return result.exitCode == 0 ? result.output : nil
    }
    
    private func parseVersion(from output: String, pattern: String) -> String? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else {
            return nil
        }
        
        let range = NSRange(output.startIndex..., in: output)
        guard let match = regex.firstMatch(in: output, options: [], range: range) else {
            return nil
        }
        
        if match.numberOfRanges > 1 {
            let versionRange = Range(match.range(at: 1), in: output)!
            return String(output[versionRange])
        }
        
        return nil
    }
    
    private func meetsMinimum(_ version: String, minimum: String?) -> Bool {
        guard let minimum = minimum else { return true }
        
        let versionParts = version.split(separator: ".").compactMap { Int($0) }
        let minimumParts = minimum.split(separator: ".").compactMap { Int($0) }
        
        for i in 0..<max(versionParts.count, minimumParts.count) {
            let v = i < versionParts.count ? versionParts[i] : 0
            let m = i < minimumParts.count ? minimumParts[i] : 0
            
            if v > m { return true }
            if v < m { return false }
        }
        
        return true
    }
}

// MARK: - Models

enum DependencyType: String, CaseIterable, Sendable {
    case homebrew = "Homebrew"
    case awsCli = "AWS CLI"
    case nodejs = "Node.js"
    case npm = "npm"
    case cdk = "AWS CDK"
    case python3 = "Python 3"
    case pip = "pip"
    case docker = "Docker"
    case git = "Git"
    
    var executable: String {
        switch self {
        case .homebrew: return "brew"
        case .awsCli: return "aws"
        case .nodejs: return "node"
        case .npm: return "npm"
        case .cdk: return "cdk"
        case .python3: return "python3"
        case .pip: return "pip3"
        case .docker: return "docker"
        case .git: return "git"
        }
    }
    
    var checkCommand: String {
        switch self {
        case .homebrew: return "brew --version"
        case .awsCli: return "aws --version"
        case .nodejs: return "node --version"
        case .npm: return "npm --version"
        case .cdk: return "cdk --version"
        case .python3: return "python3 --version"
        case .pip: return "pip3 --version"
        case .docker: return "docker --version"
        case .git: return "git --version"
        }
    }
    
    var versionPattern: String {
        switch self {
        case .homebrew: return "Homebrew ([0-9.]+)"
        case .awsCli: return "aws-cli/([0-9.]+)"
        case .nodejs: return "v([0-9.]+)"
        case .npm: return "([0-9.]+)"
        case .cdk: return "([0-9.]+)"
        case .python3: return "Python ([0-9.]+)"
        case .pip: return "pip ([0-9.]+)"
        case .docker: return "Docker version ([0-9.]+)"
        case .git: return "git version ([0-9.]+)"
        }
    }
    
    var minimumVersion: String? {
        switch self {
        case .awsCli: return "2.0.0"
        case .nodejs: return "18.0.0"
        case .cdk: return "2.0.0"
        case .python3: return "3.9.0"
        default: return nil
        }
    }
    
    var isRequired: Bool {
        switch self {
        case .homebrew, .awsCli, .nodejs, .npm, .cdk, .git:
            return true
        case .python3, .pip, .docker:
            return false
        }
    }
    
    var installScript: String {
        switch self {
        case .homebrew:
            return "/bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        case .awsCli:
            return "brew install awscli"
        case .nodejs:
            return "brew install node@20"
        case .npm:
            return "brew install node" // npm comes with node
        case .cdk:
            return "npm install -g aws-cdk"
        case .python3:
            return "brew install python@3.11"
        case .pip:
            return "python3 -m ensurepip --upgrade"
        case .docker:
            return "brew install --cask docker"
        case .git:
            return "brew install git"
        }
    }
    
    var description: String {
        switch self {
        case .homebrew: return "Package manager for macOS"
        case .awsCli: return "AWS Command Line Interface for cloud operations"
        case .nodejs: return "JavaScript runtime for build tools"
        case .npm: return "Node package manager"
        case .cdk: return "AWS Cloud Development Kit for infrastructure"
        case .python3: return "Python runtime for Cato Genesis"
        case .pip: return "Python package manager"
        case .docker: return "Container runtime (optional)"
        case .git: return "Version control system"
        }
    }
}

struct DependencyStatus: Sendable {
    let dependency: DependencyType
    let installed: Bool
    let version: String?
    let path: String?
    let meetsMinimumVersion: Bool
}

struct DependencyCheckResult: Sendable {
    let allRequiredInstalled: Bool
    let dependencies: [DependencyStatus]
    let missingRequired: [DependencyType]
    let missingOptional: [DependencyType]
}

enum InstallationProgress: Sendable {
    case pending
    case downloading
    case installing
    case verifying
    case completed
    case failed(String)
    
    var description: String {
        switch self {
        case .pending: return "Pending"
        case .downloading: return "Downloading..."
        case .installing: return "Installing..."
        case .verifying: return "Verifying..."
        case .completed: return "Completed"
        case .failed(let error): return "Failed: \(error)"
        }
    }
    
    var isComplete: Bool {
        switch self {
        case .completed, .failed: return true
        default: return false
        }
    }
}

struct InstallationResult: Sendable {
    let success: Bool
    let installed: [DependencyType]
    let failed: [(DependencyType, String)]
    let skipped: [DependencyType]
}

struct CommandResult: Sendable {
    let exitCode: Int
    let output: String
}

enum DependencyError: LocalizedError {
    case installationFailed(DependencyType, String)
    case verificationFailed(DependencyType)
    case homebrewRequired
    case unsupportedPlatform
    
    var errorDescription: String? {
        switch self {
        case .installationFailed(let dep, let output):
            return "Failed to install \(dep.rawValue): \(output)"
        case .verificationFailed(let dep):
            return "Installation of \(dep.rawValue) completed but verification failed"
        case .homebrewRequired:
            return "Homebrew is required to install other dependencies"
        case .unsupportedPlatform:
            return "Automatic installation is only supported on macOS"
        }
    }
}
