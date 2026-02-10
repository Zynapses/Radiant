// RADIANT v4.18.0 - Security Test Orchestrator
// Main engine for sequential test execution with progress tracking, timeout enforcement, and result aggregation

import Foundation
import Combine

@MainActor
final class SecurityTestOrchestrator: ObservableObject {

    // MARK: - Published State

    @Published var testSuite: TestSuite
    @Published var isRunning: Bool = false
    @Published var currentTestId: String?
    @Published var overallProgress: Double = 0
    @Published var estimatedTimeRemaining: TimeInterval?
    @Published var lastBatteryRunDate: Date?
    @Published var statusMessage: String = "Ready"
    @Published var settings: SecurityTestSettings

    // MARK: - Properties

    private let endpointResolver: EndpointResolver
    private var runTask: Task<Void, Never>?
    private var testDurations: [String: TimeInterval] = [:]
    private let confirmationHandler: (@Sendable (String) async -> Bool)?

    // MARK: - Initialization

    init(
        settings: SecurityTestSettings = .default,
        endpointResolver: EndpointResolver = EndpointResolver(),
        confirmationHandler: (@Sendable (String) async -> Bool)? = nil
    ) {
        self.testSuite = TestRegistry.buildSuite()
        self.settings = settings
        self.endpointResolver = endpointResolver
        self.confirmationHandler = confirmationHandler
        loadPersistedResults()
    }

    // MARK: - Full Battery Execution

    func runFullBattery() async {
        guard !isRunning else { return }

        isRunning = true
        statusMessage = "Starting full security battery..."
        overallProgress = 0

        let allTests = testSuite.groups.flatMap(\.tests)
        let totalCount = allTests.count
        var completedCount = 0
        let batteryStart = Date()

        for groupIndex in testSuite.groups.indices {
            for testIndex in testSuite.groups[groupIndex].tests.indices {
                if Task.isCancelled { break }

                let test = testSuite.groups[groupIndex].tests[testIndex]
                currentTestId = test.id
                statusMessage = "Running \(test.id): \(test.title)"

                let result = await executeTest(test)
                applyResult(result, groupIndex: groupIndex, testIndex: testIndex)

                completedCount += 1
                overallProgress = Double(completedCount) / Double(totalCount)
                updateEstimatedTime(completedCount: completedCount, totalCount: totalCount, elapsed: Date().timeIntervalSince(batteryStart))
            }
            if Task.isCancelled { break }
        }

        currentTestId = nil
        isRunning = false
        lastBatteryRunDate = Date()

        let failed = testSuite.failedTests
        let errors = testSuite.errorTests
        if failed + errors > 0 {
            statusMessage = "Battery complete: \(failed) failed, \(errors) errors out of \(totalCount) tests"
        } else {
            statusMessage = "Battery complete: All \(totalCount) tests passed"
        }

        persistResults()
    }

    // MARK: - Group Execution

    func runGroup(_ groupId: String) async {
        guard !isRunning else { return }
        guard let groupIndex = testSuite.groups.firstIndex(where: { $0.id == groupId }) else { return }

        isRunning = true
        let group = testSuite.groups[groupIndex]
        statusMessage = "Running group: \(group.title)"
        overallProgress = 0

        let totalCount = group.tests.count
        var completedCount = 0
        let groupStart = Date()

        for testIndex in testSuite.groups[groupIndex].tests.indices {
            if Task.isCancelled { break }

            let test = testSuite.groups[groupIndex].tests[testIndex]
            currentTestId = test.id
            statusMessage = "Running \(test.id): \(test.title)"

            let result = await executeTest(test)
            applyResult(result, groupIndex: groupIndex, testIndex: testIndex)

            completedCount += 1
            overallProgress = Double(completedCount) / Double(totalCount)
            updateEstimatedTime(completedCount: completedCount, totalCount: totalCount, elapsed: Date().timeIntervalSince(groupStart))
        }

        currentTestId = nil
        isRunning = false
        statusMessage = "Group \(group.id) complete"
        persistResults()
    }

    // MARK: - Single Test Execution

    func runSingleTest(_ testId: String) async {
        guard !isRunning else { return }
        guard let (groupIndex, testIndex) = findTest(testId) else { return }

        isRunning = true
        let test = testSuite.groups[groupIndex].tests[testIndex]
        currentTestId = test.id
        statusMessage = "Running \(test.id): \(test.title)"

        let result = await executeTest(test)
        applyResult(result, groupIndex: groupIndex, testIndex: testIndex)

        currentTestId = nil
        isRunning = false
        statusMessage = "Test \(testId) complete: \(testSuite.groups[groupIndex].tests[testIndex].status.displayName)"
        persistResults()
    }

    // MARK: - Cancellation

    func cancelExecution() {
        runTask?.cancel()
        runTask = nil
        isRunning = false
        currentTestId = nil
        statusMessage = "Execution cancelled"
    }

    // MARK: - Reset

    func resetAllResults() {
        testSuite = TestRegistry.buildSuite()
        overallProgress = 0
        lastBatteryRunDate = nil
        statusMessage = "All results cleared"
        clearPersistedResults()
    }

    // MARK: - Private Execution

    private func executeTest(_ test: SecurityTest) async -> TestResult {
        let logger = TestLogger(autoRedact: settings.autoRedactCredentials)
        let executor = TestExecutorFactory.executor(for: test.id)
        let timeoutSeconds = settings.testTimeoutSeconds

        await logger.info("[\(test.id)] Resolving endpoints for \(test.protocolType.displayName)...")

        do {
            let endpoints = try await endpointResolver.resolveEndpoints(for: test.protocolType)
            let credentials = try await endpointResolver.resolveCredentials()

            guard let endpoint = endpoints.first else {
                await logger.error("[\(test.id)] No endpoints available")
                return TestResult(
                    status: .error,
                    findings: "No endpoints available for \(test.protocolType.displayName) protocol.",
                    evidence: await logger.getEvidence(),
                    remediation: "Configure \(test.protocolType.displayName) endpoints in Deployer settings.",
                    executionLog: await logger.getEntries(),
                    duration: 0
                )
            }

            await logger.info("[\(test.id)] Using endpoint: \(endpoint.label) (\(endpoint.url.absoluteString))")
            await logger.info("[\(test.id)] Executing with \(timeoutSeconds)s timeout...")

            let startTime = Date()

            let result = try await withThrowingTaskGroup(of: TestResult.self) { group in
                group.addTask {
                    try await executor.execute(endpoint: endpoint, credentials: credentials, logger: logger)
                }

                group.addTask {
                    try await Task.sleep(nanoseconds: UInt64(timeoutSeconds) * 1_000_000_000)
                    throw TestExecutionError.timeout(testId: test.id, seconds: timeoutSeconds)
                }

                guard let firstResult = try await group.next() else {
                    throw TestExecutionError.noResult(testId: test.id)
                }
                group.cancelAll()
                return firstResult
            }

            let duration = Date().timeIntervalSince(startTime)
            testDurations[test.id] = duration
            return result

        } catch let error as TestExecutionError {
            await logger.error("[\(test.id)] \(error.localizedDescription)")
            return TestResult(
                status: .error,
                findings: error.localizedDescription,
                evidence: await logger.getEvidence(),
                remediation: error.remediation,
                executionLog: await logger.getEntries(),
                duration: 0
            )
        } catch {
            await logger.error("[\(test.id)] Unexpected error: \(error.localizedDescription)")
            return TestResult(
                status: .error,
                findings: "Unexpected error: \(error.localizedDescription)",
                evidence: await logger.getEvidence(),
                remediation: "Review error details and retry. If the issue persists, check endpoint connectivity and credentials.",
                executionLog: await logger.getEntries(),
                duration: 0
            )
        }
    }

    // MARK: - Result Application

    private func applyResult(_ result: TestResult, groupIndex: Int, testIndex: Int) {
        testSuite.groups[groupIndex].tests[testIndex].status = result.status
        testSuite.groups[groupIndex].tests[testIndex].lastRunDate = Date()
        testSuite.groups[groupIndex].tests[testIndex].lastRunDuration = result.duration
        testSuite.groups[groupIndex].tests[testIndex].executionLog = result.executionLog
        testSuite.groups[groupIndex].tests[testIndex].detailedFindings = result.findings
        testSuite.groups[groupIndex].tests[testIndex].remediationGuidance = result.remediation
        testSuite.groups[groupIndex].tests[testIndex].evidence = result.evidence
    }

    // MARK: - Helpers

    private func findTest(_ testId: String) -> (Int, Int)? {
        for (gi, group) in testSuite.groups.enumerated() {
            for (ti, test) in group.tests.enumerated() {
                if test.id == testId {
                    return (gi, ti)
                }
            }
        }
        return nil
    }

    private func updateEstimatedTime(completedCount: Int, totalCount: Int, elapsed: TimeInterval) {
        guard completedCount > 0 else {
            estimatedTimeRemaining = nil
            return
        }
        let avgTime = elapsed / Double(completedCount)
        estimatedTimeRemaining = avgTime * Double(totalCount - completedCount)
    }

    // MARK: - Persistence

    private func persistResults() {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        if let data = try? encoder.encode(testSuite) {
            UserDefaults.standard.set(data, forKey: "radiant.securityTest.lastResults")
        }
        if let lastDate = lastBatteryRunDate {
            UserDefaults.standard.set(lastDate, forKey: "radiant.securityTest.lastBatteryDate")
        }
    }

    private func loadPersistedResults() {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        if let data = UserDefaults.standard.data(forKey: "radiant.securityTest.lastResults"),
           let suite = try? decoder.decode(TestSuite.self, from: data) {
            self.testSuite = suite
        }
        if let date = UserDefaults.standard.object(forKey: "radiant.securityTest.lastBatteryDate") as? Date {
            self.lastBatteryRunDate = date
        }
    }

    private func clearPersistedResults() {
        UserDefaults.standard.removeObject(forKey: "radiant.securityTest.lastResults")
        UserDefaults.standard.removeObject(forKey: "radiant.securityTest.lastBatteryDate")
    }
}

// MARK: - Test Execution Errors

enum TestExecutionError: Error, LocalizedError {
    case timeout(testId: String, seconds: Int)
    case noResult(testId: String)
    case endpointUnavailable(testId: String, reason: String)

    var errorDescription: String? {
        switch self {
        case .timeout(let testId, let seconds):
            return "Test \(testId) timed out after \(seconds) seconds."
        case .noResult(let testId):
            return "Test \(testId) completed without producing a result."
        case .endpointUnavailable(let testId, let reason):
            return "Test \(testId) endpoint unavailable: \(reason)"
        }
    }

    var remediation: String {
        switch self {
        case .timeout:
            return "Increase the test timeout in settings or investigate slow endpoint response."
        case .noResult:
            return "This is an internal error. Please report it."
        case .endpointUnavailable:
            return "Verify the endpoint is running and accessible from this machine."
        }
    }
}
