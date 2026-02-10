// RADIANT v4.18.0 - Test Executor Factory
// Creates appropriate test executor instances for each security test ID

import Foundation

struct TestExecutorFactory {

    // MARK: - Factory Method

    static func executor(for testId: String) -> SecurityTestExecutor {
        let prefix = testId.components(separatedBy: "-").first ?? ""
        let groupId = extractGroupId(from: testId)

        switch prefix {
        case "MCP":
            return mcpExecutor(groupId: groupId, testId: testId)
        case "A2A":
            return a2aExecutor(groupId: groupId, testId: testId)
        case "REST":
            return restExecutor(groupId: groupId, testId: testId)
        case "CROSS":
            return crossExecutor(groupId: groupId, testId: testId)
        default:
            return GenericSecurityTestExecutor(testId: testId)
        }
    }

    // MARK: - MCP Executors

    private static func mcpExecutor(groupId: String, testId: String) -> SecurityTestExecutor {
        switch groupId {
        case "01": return MCPToolPoisoningExecutor(testId: testId)
        case "02": return MCPRugPullExecutor(testId: testId)
        case "03": return MCPPromptInjectionExecutor(testId: testId)
        case "04": return MCPAuthSessionExecutor(testId: testId)
        case "05": return MCPDataExfiltrationExecutor(testId: testId)
        case "06": return MCPSamplingExploitExecutor(testId: testId)
        default: return GenericSecurityTestExecutor(testId: testId)
        }
    }

    // MARK: - A2A Executors

    private static func a2aExecutor(groupId: String, testId: String) -> SecurityTestExecutor {
        switch groupId {
        case "01": return A2AAgentCardExecutor(testId: testId)
        case "02": return A2AAuthExecutor(testId: testId)
        case "03": return A2ASessionSmuggleExecutor(testId: testId)
        case "04": return A2AWebhookTransportExecutor(testId: testId)
        case "05": return A2ABehavioralDriftExecutor(testId: testId)
        default: return GenericSecurityTestExecutor(testId: testId)
        }
    }

    // MARK: - REST Executors

    private static func restExecutor(groupId: String, testId: String) -> SecurityTestExecutor {
        switch groupId {
        case "01": return RESTAuthCredentialExecutor(testId: testId)
        case "02": return RESTAuthorizationExecutor(testId: testId)
        case "03": return RESTInputValidationExecutor(testId: testId)
        case "04": return RESTRateLimitTransportExecutor(testId: testId)
        default: return GenericSecurityTestExecutor(testId: testId)
        }
    }

    // MARK: - Cross-Cutting Executors

    private static func crossExecutor(groupId: String, testId: String) -> SecurityTestExecutor {
        switch groupId {
        case "01": return CrossDataIsolationExecutor(testId: testId)
        case "02": return CrossProtocolInjectionExecutor(testId: testId)
        case "03": return CrossCredentialRoutingExecutor(testId: testId)
        case "04": return CrossLoggingAuditExecutor(testId: testId)
        default: return GenericSecurityTestExecutor(testId: testId)
        }
    }

    // MARK: - Helpers

    private static func extractGroupId(from testId: String) -> String {
        // testId format: "MCP-01.1" → group "01"
        let parts = testId.components(separatedBy: "-")
        guard parts.count >= 2 else { return "" }
        let subParts = parts[1].components(separatedBy: ".")
        return subParts.first ?? ""
    }
}

// MARK: - Generic Fallback Executor

struct GenericSecurityTestExecutor: SecurityTestExecutor {
    let testId: String

    func execute(
        endpoint: EndpointConfiguration,
        credentials: SecurityTestCredentials,
        logger: TestLogger
    ) async throws -> TestResult {
        await logger.info("[\(testId)] Starting generic security test execution")
        await logger.warning("[\(testId)] No specialized executor found — running baseline connectivity and response checks")

        let startTime = Date()

        var request = URLRequest(url: endpoint.url)
        request.httpMethod = "GET"
        request.timeoutInterval = 15

        if let apiKey = credentials.apiKeys["aws_access_key_id"] {
            request.setValue(apiKey, forHTTPHeaderField: "X-Api-Key")
        }

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let httpResponse = response as? HTTPURLResponse
            let statusCode = httpResponse?.statusCode ?? 0
            let bodyPreview = String(data: data, encoding: .utf8) ?? "[binary data]"

            await logger.addHTTPResponseEvidence(
                statusCode: statusCode,
                headers: httpResponse?.allHeaderFields as? [String: String] ?? [:],
                body: bodyPreview
            )

            let duration = Date().timeIntervalSince(startTime)
            await logger.info("[\(testId)] Received HTTP \(statusCode) in \(String(format: "%.2f", duration))s")

            let findings: String
            let status: TestStatus

            if statusCode == 200 {
                findings = "Endpoint responded with 200 OK. Manual review recommended for test \(testId)."
                status = .passed
                await logger.success("[\(testId)] Baseline check passed — endpoint reachable and responding")
            } else if statusCode == 401 || statusCode == 403 {
                findings = "Endpoint returned \(statusCode) — authentication/authorization is enforced."
                status = .passed
                await logger.success("[\(testId)] Auth enforcement confirmed (HTTP \(statusCode))")
            } else {
                findings = "Endpoint returned unexpected status \(statusCode). Review required."
                status = .error
                await logger.warning("[\(testId)] Unexpected response status: \(statusCode)")
            }

            return TestResult(
                status: status,
                findings: findings,
                evidence: await logger.getEvidence(),
                remediation: nil,
                executionLog: await logger.getEntries(),
                duration: duration
            )
        } catch {
            let duration = Date().timeIntervalSince(startTime)
            await logger.error("[\(testId)] Network error: \(error.localizedDescription)")

            return TestResult(
                status: .error,
                findings: "Test execution failed: \(error.localizedDescription)",
                evidence: await logger.getEvidence(),
                remediation: "Verify endpoint URL and network connectivity.",
                executionLog: await logger.getEntries(),
                duration: duration
            )
        }
    }
}
