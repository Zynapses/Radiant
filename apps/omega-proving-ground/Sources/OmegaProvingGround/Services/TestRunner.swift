import Foundation

@MainActor
final class TestRunner: ObservableObject {
    @Published var isRunning: Bool = false
    @Published var currentTestName: String = ""
    @Published var progress: Double = 0.0
    @Published var currentRun: TestRun?

    private let inferenceService: LocalInferenceService
    private var cancelled: Bool = false

    init(inferenceService: LocalInferenceService) {
        self.inferenceService = inferenceService
    }

    // MARK: - Run Suite

    func runSuite(_ suite: TestSuite, model: String) async -> TestRun {
        isRunning = true
        cancelled = false
        progress = 0.0

        var run = TestRun(
            suiteId: suite.id,
            suiteName: suite.name,
            model: model
        )
        currentRun = run

        for (index, testCase) in suite.cases.enumerated() {
            guard !cancelled else {
                run.status = .cancelled
                break
            }

            currentTestName = testCase.name
            progress = Double(index) / Double(suite.cases.count)

            let result = await executeTestCase(testCase)
            run.results.append(result)
            currentRun = run
        }

        if !cancelled {
            run.status = .completed
            progress = 1.0
        }

        run.completedAt = Date()
        currentRun = run
        isRunning = false
        currentTestName = ""

        return run
    }

    func cancel() {
        cancelled = true
    }

    // MARK: - Execute Single Test

    private func executeTestCase(_ testCase: TestCase) async -> TestCaseResult {
        do {
            let (response, latencyMs, tokenCount) = try await inferenceService.singlePrompt(
                prompt: testCase.prompt,
                systemPrompt: testCase.systemPrompt
            )

            let (passed, failures) = evaluate(response: response, latencyMs: latencyMs, expected: testCase.expectedBehavior)

            return TestCaseResult(
                caseId: testCase.id,
                caseName: testCase.name,
                passed: passed,
                response: response,
                latencyMs: latencyMs,
                tokenCount: tokenCount,
                failures: failures
            )
        } catch {
            return TestCaseResult(
                caseId: testCase.id,
                caseName: testCase.name,
                passed: false,
                response: "",
                failures: ["Inference error: \(error.localizedDescription)"]
            )
        }
    }

    // MARK: - Evaluation

    private func evaluate(response: String, latencyMs: Double, expected: ExpectedBehavior) -> (passed: Bool, failures: [String]) {
        var failures: [String] = []
        let lowerResponse = response.lowercased()

        for keyword in expected.mustContain {
            if !lowerResponse.contains(keyword.lowercased()) {
                failures.append("Missing required content: \"\(keyword)\"")
            }
        }

        for keyword in expected.mustNotContain {
            if lowerResponse.contains(keyword.lowercased()) {
                failures.append("Contains forbidden content: \"\(keyword)\"")
            }
        }

        if let maxLatency = expected.maxLatencyMs, latencyMs > maxLatency {
            failures.append("Latency \(String(format: "%.0f", latencyMs))ms exceeds max \(String(format: "%.0f", maxLatency))ms")
        }

        if let minLen = expected.minLength, response.count < minLen {
            failures.append("Response length \(response.count) below minimum \(minLen)")
        }

        if let maxLen = expected.maxLength, response.count > maxLen {
            failures.append("Response length \(response.count) exceeds maximum \(maxLen)")
        }

        return (failures.isEmpty, failures)
    }
}
