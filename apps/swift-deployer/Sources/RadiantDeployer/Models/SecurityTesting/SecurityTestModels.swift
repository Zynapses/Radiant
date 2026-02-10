// RADIANT v4.18.0 - Endpoint Security Testing Data Models
// Comprehensive penetration testing framework for MCP, A2A, and REST protocols

import Foundation
import SwiftUI

// MARK: - Core Enums

enum TestProtocol: String, Codable, CaseIterable, Sendable {
    case mcp = "MCP"
    case a2a = "A2A"
    case rest = "REST"
    case cross = "CROSS"

    var displayName: String {
        switch self {
        case .mcp: return "Model Context Protocol"
        case .a2a: return "Agent-to-Agent"
        case .rest: return "REST/Script API"
        case .cross: return "Cross-Cutting Orchestration"
        }
    }

    var color: Color {
        switch self {
        case .mcp: return .blue
        case .a2a: return .purple
        case .rest: return .teal
        case .cross: return .orange
        }
    }

    var icon: String {
        switch self {
        case .mcp: return "cpu"
        case .a2a: return "arrow.left.arrow.right"
        case .rest: return "network"
        case .cross: return "link.circle"
        }
    }
}

enum TestStatus: String, Codable, Sendable {
    case notRun = "not_run"
    case running = "running"
    case passed = "passed"
    case failed = "failed"
    case error = "error"
    case skipped = "skipped"

    var displayName: String {
        switch self {
        case .notRun: return "Not Run"
        case .running: return "Running"
        case .passed: return "PASSED"
        case .failed: return "FAILED"
        case .error: return "ERROR"
        case .skipped: return "SKIPPED"
        }
    }

    var icon: String {
        switch self {
        case .notRun: return "circle"
        case .running: return "arrow.triangle.2.circlepath"
        case .passed: return "checkmark.circle.fill"
        case .failed: return "xmark.circle.fill"
        case .error: return "exclamationmark.triangle.fill"
        case .skipped: return "minus.circle.fill"
        }
    }

    var color: Color {
        switch self {
        case .notRun: return .secondary
        case .running: return .blue
        case .passed: return Color(nsColor: NSColor(red: 0.13, green: 0.55, blue: 0.13, alpha: 1))
        case .failed: return Color(nsColor: NSColor(red: 0.80, green: 0.12, blue: 0.12, alpha: 1))
        case .error: return Color(nsColor: NSColor(red: 0.85, green: 0.55, blue: 0.05, alpha: 1))
        case .skipped: return .gray
        }
    }
}

enum LogLevel: String, Codable, Sendable {
    case info, warning, error, success

    var color: Color {
        switch self {
        case .info: return .secondary
        case .warning: return .orange
        case .error: return .red
        case .success: return .green
        }
    }

    var icon: String {
        switch self {
        case .info: return "info.circle"
        case .warning: return "exclamationmark.triangle"
        case .error: return "xmark.octagon"
        case .success: return "checkmark.circle"
        }
    }
}

enum EvidenceType: String, Codable, Sendable {
    case httpRequest, httpResponse, mcpMessage, a2aMessage
    case screenshot, logOutput, configSnapshot
}

enum TransportType: String, Codable, Sendable {
    case stdio, httpSSE, https, websocket, jsonRPC
}

enum AuthMethod: String, Codable, Sendable {
    case oauth21, apiKey, bearer, mtls, none
}

enum RiskSeverity: String, Codable, Sendable {
    case critical = "Critical"
    case high = "High"
    case medium = "Medium"
    case low = "Low"
    case informational = "Informational"

    var color: Color {
        switch self {
        case .critical: return .red
        case .high: return .orange
        case .medium: return .yellow
        case .low: return .blue
        case .informational: return .gray
        }
    }
}

// MARK: - Core Data Structures

struct StandardReference: Codable, Identifiable, Sendable, Hashable {
    let id: String
    let framework: String
    let control: String
    let title: String
    let description: String

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    static func == (lhs: StandardReference, rhs: StandardReference) -> Bool {
        lhs.id == rhs.id
    }
}

struct LogEntry: Codable, Identifiable, Sendable {
    let id: UUID
    let timestamp: Date
    let level: LogLevel
    let message: String
}

struct EvidenceItem: Codable, Identifiable, Sendable {
    let id: UUID
    let type: EvidenceType
    let title: String
    let content: String
    let timestamp: Date

    init(type: EvidenceType, title: String, content: String, timestamp: Date) {
        self.id = UUID()
        self.type = type
        self.title = title
        self.content = content
        self.timestamp = timestamp
    }
}

struct SecurityTest: Codable, Identifiable, Sendable {
    let id: String
    let sopGroup: String
    let title: String
    let description: String
    let passCriteria: String
    let failCriteria: String
    let protocolType: TestProtocol
    let standards: [StandardReference]
    let riskSeverity: RiskSeverity
    var status: TestStatus
    var lastRunDate: Date?
    var lastRunDuration: TimeInterval?
    var executionLog: [LogEntry]
    var detailedFindings: String?
    var remediationGuidance: String?
    var evidence: [EvidenceItem]

    init(
        id: String,
        sopGroup: String,
        title: String,
        description: String,
        passCriteria: String,
        failCriteria: String,
        protocolType: TestProtocol,
        standards: [StandardReference],
        riskSeverity: RiskSeverity = .high
    ) {
        self.id = id
        self.sopGroup = sopGroup
        self.title = title
        self.description = description
        self.passCriteria = passCriteria
        self.failCriteria = failCriteria
        self.protocolType = protocolType
        self.standards = standards
        self.riskSeverity = riskSeverity
        self.status = .notRun
        self.lastRunDate = nil
        self.lastRunDuration = nil
        self.executionLog = []
        self.detailedFindings = nil
        self.remediationGuidance = nil
        self.evidence = []
    }
}

struct SOPGroup: Codable, Identifiable, Sendable {
    let id: String
    let title: String
    let protocolType: TestProtocol
    let description: String
    let primaryStandards: [String]
    var tests: [SecurityTest]

    var passedCount: Int { tests.filter { $0.status == .passed }.count }
    var failedCount: Int { tests.filter { $0.status == .failed }.count }
    var errorCount: Int { tests.filter { $0.status == .error }.count }
    var notRunCount: Int { tests.filter { $0.status == .notRun }.count }
    var skippedCount: Int { tests.filter { $0.status == .skipped }.count }
    var runningCount: Int { tests.filter { $0.status == .running }.count }
}

struct TestSuite: Codable, Sendable {
    let version: String
    let lastUpdated: Date
    var groups: [SOPGroup]

    var totalTests: Int { groups.flatMap(\.tests).count }
    var passedTests: Int { groups.flatMap(\.tests).filter { $0.status == .passed }.count }
    var failedTests: Int { groups.flatMap(\.tests).filter { $0.status == .failed }.count }
    var errorTests: Int { groups.flatMap(\.tests).filter { $0.status == .error }.count }
    var notRunTests: Int { groups.flatMap(\.tests).filter { $0.status == .notRun }.count }
    var skippedTests: Int { groups.flatMap(\.tests).filter { $0.status == .skipped }.count }

    var completedTests: Int { totalTests - notRunTests }
    var progressPercent: Double {
        guard totalTests > 0 else { return 0 }
        return Double(completedTests) / Double(totalTests)
    }

    var mcpGroups: [SOPGroup] { groups.filter { $0.protocolType == .mcp } }
    var a2aGroups: [SOPGroup] { groups.filter { $0.protocolType == .a2a } }
    var restGroups: [SOPGroup] { groups.filter { $0.protocolType == .rest } }
    var crossGroups: [SOPGroup] { groups.filter { $0.protocolType == .cross } }
}

// MARK: - Test Execution Types

struct TestResult: Sendable {
    let status: TestStatus
    let findings: String
    let evidence: [EvidenceItem]
    let remediation: String?
    let executionLog: [LogEntry]
    let duration: TimeInterval
}

struct EndpointConfiguration: Sendable {
    let url: URL
    let protocolType: TestProtocol
    let transportType: TransportType
    let authMethod: AuthMethod
    let label: String

    init(url: URL, protocolType: TestProtocol, transportType: TransportType = .https, authMethod: AuthMethod = .bearer, label: String = "") {
        self.url = url
        self.protocolType = protocolType
        self.transportType = transportType
        self.authMethod = authMethod
        self.label = label
    }
}

struct SecurityTestCredentials: Sendable {
    let apiKeys: [String: String]
    let bearerTokens: [String: String]
    let region: String
    let accountId: String?

    static let empty = SecurityTestCredentials(apiKeys: [:], bearerTokens: [:], region: "us-east-1", accountId: nil)
}

// MARK: - Security Test Executor Protocol

protocol SecurityTestExecutor: Sendable {
    var testId: String { get }
    func execute(
        endpoint: EndpointConfiguration,
        credentials: SecurityTestCredentials,
        logger: TestLogger
    ) async throws -> TestResult
}

// MARK: - Test Settings

struct SecurityTestSettings: Codable, Sendable {
    var testTimeoutSeconds: Int
    var maxConcurrentTests: Int
    var evidenceRetentionDays: Int
    var autoRedactCredentials: Bool
    var reportClassification: String
    var reportOutputDirectory: String?

    static let `default` = SecurityTestSettings(
        testTimeoutSeconds: 30,
        maxConcurrentTests: 1,
        evidenceRetentionDays: 90,
        autoRedactCredentials: true,
        reportClassification: "CONFIDENTIAL",
        reportOutputDirectory: nil
    )
}
