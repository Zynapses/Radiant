import Foundation

let RADIANT_VERSION = "5.52.17"

struct DeploymentProgress: Identifiable, Sendable {
    let id = UUID()
    var phase: DeploymentPhase
    var progress: Double
    var currentStack: String?
    var message: String?
    var startedAt: Date
    var estimatedCompletion: Date?
}

enum DeploymentPhase: String, CaseIterable, Sendable {
    case idle = "Idle"
    case validating = "Validating Credentials"
    case bootstrapping = "Bootstrapping CDK"
    case synthesizing = "Synthesizing Stacks"
    case deployingFoundation = "Deploying Foundation"
    case deployingNetworking = "Deploying Networking"
    case deploySecurity = "Deploying Security"
    case deployingData = "Deploying Data Layer"
    case deployingAI = "Deploying AI Services"
    case deployingAPI = "Deploying API Layer"
    case deployingAdmin = "Deploying Admin Dashboard"
    case runningMigrations = "Running Migrations"
    case seedingData = "Seeding Initial Data"
    case verifying = "Verifying Deployment"
    case complete = "Complete"
    case failed = "Failed"
    
    var progress: Double {
        switch self {
        case .idle: return 0.0
        case .validating: return 0.05
        case .bootstrapping: return 0.10
        case .synthesizing: return 0.15
        case .deployingFoundation: return 0.25
        case .deployingNetworking: return 0.35
        case .deploySecurity: return 0.45
        case .deployingData: return 0.55
        case .deployingAI: return 0.65
        case .deployingAPI: return 0.75
        case .deployingAdmin: return 0.85
        case .runningMigrations: return 0.90
        case .seedingData: return 0.95
        case .verifying: return 0.98
        case .complete: return 1.0
        case .failed: return 0.0
        }
    }
    
    var icon: String {
        switch self {
        case .idle: return "circle"
        case .validating: return "checkmark.shield"
        case .bootstrapping: return "arrow.up.circle"
        case .synthesizing: return "doc.text"
        case .deployingFoundation: return "building"
        case .deployingNetworking: return "network"
        case .deploySecurity: return "lock.shield"
        case .deployingData: return "cylinder"
        case .deployingAI: return "cpu"
        case .deployingAPI: return "server.rack"
        case .deployingAdmin: return "rectangle.3.group"
        case .runningMigrations: return "arrow.triangle.2.circlepath"
        case .seedingData: return "leaf"
        case .verifying: return "checkmark.circle"
        case .complete: return "checkmark.circle.fill"
        case .failed: return "xmark.circle.fill"
        }
    }
}

struct DeploymentResult: Identifiable, Codable, Sendable {
    let id: String
    let appId: String
    let environment: String
    let version: String
    let success: Bool
    let startedAt: Date
    let completedAt: Date
    let outputs: DeploymentOutputs?
    let errors: [String]?
    
    static func create(
        appId: String,
        environment: String,
        success: Bool,
        startedAt: Date,
        outputs: DeploymentOutputs? = nil,
        errors: [String]? = nil
    ) -> DeploymentResult {
        DeploymentResult(
            id: UUID().uuidString,
            appId: appId,
            environment: environment,
            version: RADIANT_VERSION,
            success: success,
            startedAt: startedAt,
            completedAt: Date(),
            outputs: outputs,
            errors: errors
        )
    }
}

struct DeploymentOutputs: Codable, Sendable {
    let apiUrl: String
    let graphqlUrl: String
    let dashboardUrl: String
    let cognitoUserPoolId: String
    let cognitoClientId: String
    let cognitoDomain: String
    let auroraEndpoint: String
    let s3MediaBucket: String
    let cloudfrontDistribution: String
}

struct LogEntry: Identifiable, Sendable {
    let id = UUID()
    let timestamp: Date
    let level: LogLevel
    let message: String
    let metadata: [String: String]?
}

enum LogLevel: String, Sendable, Codable {
    case debug, info, warn, error, success
    
    var color: String {
        switch self {
        case .debug: return "gray"
        case .info: return "blue"
        case .warn: return "orange"
        case .error: return "red"
        case .success: return "green"
        }
    }
    
    var icon: String {
        switch self {
        case .debug: return "ant"
        case .info: return "info.circle"
        case .warn: return "exclamationmark.triangle"
        case .error: return "xmark.circle"
        case .success: return "checkmark.circle"
        }
    }
}

// MARK: - PROMPT-33 Granular Deployment State

/// Preparation steps before deployment
enum PreparationStep: String, Sendable {
    case validatingPackage = "Validating Package"
    case checkingCompatibility = "Checking Compatibility"
    case acquiringLock = "Acquiring Deployment Lock"
    case loadingConfiguration = "Loading Configuration"
}

/// Health check result for individual service
struct HealthCheckResult: Sendable, Identifiable {
    let id = UUID()
    let service: String
    let status: HealthStatus
    let responseTime: TimeInterval?
    let message: String?
    
    enum HealthStatus: String, Sendable {
        case healthy = "Healthy"
        case unhealthy = "Unhealthy"
        case timeout = "Timeout"
        case pending = "Pending"
    }
}

/// Deployment failure details
struct DeploymentFailure: Sendable {
    let phase: String
    let error: String
    let technicalDetails: String?
    let isRetryable: Bool
    let timestamp: Date
    
    init(phase: String, error: Error, isRetryable: Bool = false) {
        self.phase = phase
        self.error = error.localizedDescription
        self.technicalDetails = String(describing: error)
        self.isRetryable = isRetryable
        self.timestamp = Date()
    }
}

/// Rollback result after recovery
struct RollbackResult: Sendable {
    let success: Bool
    let snapshotId: String?
    let restoredVersion: String?
    let duration: TimeInterval
    let message: String
}

/// Rollback failure details
struct RollbackFailure: Sendable {
    let error: String
    let partiallyRestored: Bool
    let recoverySteps: [String]
}

/// Granular deployment state per PROMPT-33 spec
enum DeploymentState: Sendable {
    case idle
    case preparing(PreparationStep)
    case creatingSnapshot(progress: Double)
    case enablingMaintenance
    case deployingInfrastructure(progress: Double, message: String)
    case runningMigrations(current: Int, total: Int, stepName: String)
    case deployingLambda(progress: Double)
    case deployingDashboard(progress: Double)
    case runningHealthChecks(results: [HealthCheckResult])
    case disablingMaintenance
    case verifying
    case complete(DeploymentResult)
    case failed(DeploymentFailure)
    case cancelling(fromState: String)
    case rollingBack(progress: Double, step: String)
    case rolledBack(RollbackResult)
    case rollbackFailed(RollbackFailure)
    
    /// Whether cancel is allowed in this state
    var canCancel: Bool {
        switch self {
        case .idle, .complete, .failed, .cancelling, .rollingBack, .rolledBack, .rollbackFailed:
            return false
        case .preparing, .creatingSnapshot, .enablingMaintenance, .deployingInfrastructure,
             .runningMigrations, .deployingLambda, .deployingDashboard, .runningHealthChecks,
             .disablingMaintenance, .verifying:
            return true
        }
    }
    
    /// Overall progress percentage
    var progress: Double {
        switch self {
        case .idle: return 0.0
        case .preparing: return 0.05
        case .creatingSnapshot(let p): return 0.05 + p * 0.10
        case .enablingMaintenance: return 0.15
        case .deployingInfrastructure(let p, _): return 0.15 + p * 0.40
        case .runningMigrations(let c, let t, _): return 0.55 + (Double(c) / Double(max(t, 1))) * 0.15
        case .deployingLambda(let p): return 0.70 + p * 0.10
        case .deployingDashboard(let p): return 0.80 + p * 0.10
        case .runningHealthChecks: return 0.90
        case .disablingMaintenance: return 0.95
        case .verifying: return 0.98
        case .complete: return 1.0
        case .failed: return 0.0
        case .cancelling: return 0.0
        case .rollingBack(let p, _): return p
        case .rolledBack: return 1.0
        case .rollbackFailed: return 0.0
        }
    }
    
    /// Display name for the state
    var displayName: String {
        switch self {
        case .idle: return "Ready"
        case .preparing(let step): return step.rawValue
        case .creatingSnapshot: return "Creating Snapshot"
        case .enablingMaintenance: return "Enabling Maintenance Mode"
        case .deployingInfrastructure(_, let msg): return msg.isEmpty ? "Deploying Infrastructure" : msg
        case .runningMigrations(let c, let t, let name): return "Migration \(c)/\(t): \(name)"
        case .deployingLambda: return "Deploying Lambda Functions"
        case .deployingDashboard: return "Deploying Admin Dashboard"
        case .runningHealthChecks: return "Running Health Checks"
        case .disablingMaintenance: return "Disabling Maintenance Mode"
        case .verifying: return "Verifying Deployment"
        case .complete: return "Deployment Complete"
        case .failed(let f): return "Failed: \(f.phase)"
        case .cancelling(let from): return "Cancelling (\(from))"
        case .rollingBack(_, let step): return "Rolling Back: \(step)"
        case .rolledBack: return "Rolled Back Successfully"
        case .rollbackFailed: return "Rollback Failed"
        }
    }
    
    /// Icon for the state
    var icon: String {
        switch self {
        case .idle: return "circle"
        case .preparing: return "gearshape"
        case .creatingSnapshot: return "camera"
        case .enablingMaintenance: return "wrench.and.screwdriver"
        case .deployingInfrastructure: return "building.2"
        case .runningMigrations: return "arrow.triangle.2.circlepath"
        case .deployingLambda: return "function"
        case .deployingDashboard: return "rectangle.3.group"
        case .runningHealthChecks: return "heart.text.square"
        case .disablingMaintenance: return "checkmark.seal"
        case .verifying: return "checkmark.shield"
        case .complete: return "checkmark.circle.fill"
        case .failed: return "xmark.circle.fill"
        case .cancelling: return "stop.circle"
        case .rollingBack: return "arrow.uturn.backward.circle"
        case .rolledBack: return "arrow.uturn.backward.circle.fill"
        case .rollbackFailed: return "exclamationmark.triangle.fill"
        }
    }
    
    /// Whether this is a terminal state
    var isTerminal: Bool {
        switch self {
        case .complete, .failed, .rolledBack, .rollbackFailed:
            return true
        default:
            return false
        }
    }
}
