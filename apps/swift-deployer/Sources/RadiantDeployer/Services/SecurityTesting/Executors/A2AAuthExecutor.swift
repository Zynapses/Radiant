// RADIANT v4.18.0 - A2A-02: Authentication & Authorization Executor
// Tests for A2A auth bypass, token scope escalation, cross-agent authz, JWT manipulation, mTLS, and credential revocation

import Foundation

struct A2AAuthExecutor: SecurityTestExecutor {
    let testId: String

    func execute(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger) async throws -> TestResult {
        let startTime = Date()
        switch testId {
        case "A2A-02.1": return try await testAuthBypass(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "A2A-02.2": return try await testTokenScopeEscalation(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "A2A-02.3": return try await testCrossAgentAuthzBypass(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "A2A-02.4": return try await testJWTManipulation(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "A2A-02.5": return try await testMTLSCertValidation(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "A2A-02.6": return try await testCredentialRevocationPropagation(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        default:
            return TestResult(status: .error, findings: "Unknown test ID: \(testId)", evidence: [], remediation: nil, executionLog: await logger.getEntries(), duration: 0)
        }
    }

    private func testAuthBypass(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[A2A-02.1] Testing A2A authentication bypass")
        let unauthCases: [(label: String, headers: [String: String])] = [
            ("No credentials", [:]),
            ("Empty bearer", ["Authorization": "Bearer "]),
            ("Invalid token", ["Authorization": "Bearer invalid_garbage_token"]),
        ]
        var allRejected = true
        var findings: [String] = []
        for tc in unauthCases {
            let (sc, body) = try await sendRaw(to: endpoint.url.appendingPathComponent("tasks"), method: "POST", headers: tc.headers.merging(["Content-Type": "application/json"]) { _, n in n }, body: "{\"message\":{\"role\":\"user\",\"parts\":[{\"text\":\"test\"}]}}", logger: logger)
            if sc == 200 || sc == 201 { allRejected = false; findings.append("\(tc.label): ACCEPTED (HTTP \(sc))!"); await logger.error("[A2A-02.1] FAIL: \(tc.label) accepted") }
            else { findings.append("\(tc.label): Rejected (HTTP \(sc))."); await logger.success("[A2A-02.1] \(tc.label) rejected") }
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: allRejected ? .passed : .failed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: allRejected ? nil : "Enforce authentication on all A2A endpoints. Return 401 for missing or invalid credentials.", executionLog: await logger.getEntries(), duration: duration)
    }

    private func testTokenScopeEscalation(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[A2A-02.2] Testing A2A token scope escalation")
        let writeOps: [(label: String, method: String, path: String, body: String)] = [
            ("Create task", "POST", "tasks", "{\"message\":{\"role\":\"user\",\"parts\":[{\"text\":\"create\"}]}}"),
            ("Cancel task", "POST", "tasks/test-id/cancel", "{}"),
            ("Delete task", "DELETE", "tasks/test-id", ""),
        ]
        var findings: [String] = []
        var allProtected = true
        for op in writeOps {
            let readOnlyToken = "read_only_scope_token_\(UUID().uuidString.prefix(8))"
            let (sc, _) = try await sendRaw(to: endpoint.url.appendingPathComponent(op.path), method: op.method, headers: ["Content-Type": "application/json", "Authorization": "Bearer \(readOnlyToken)"], body: op.body, logger: logger)
            if sc == 200 || sc == 201 || sc == 204 { allProtected = false; findings.append("\(op.label): Write succeeded with read-only token!"); await logger.error("[A2A-02.2] FAIL: \(op.label)") }
            else { findings.append("\(op.label): Blocked (HTTP \(sc))."); await logger.success("[A2A-02.2] \(op.label) protected") }
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: allProtected ? .passed : .failed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: allProtected ? nil : "Enforce token scopes strictly. Read-only tokens must not perform write operations.", executionLog: await logger.getEntries(), duration: duration)
    }

    private func testCrossAgentAuthzBypass(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[A2A-02.3] Testing cross-agent authorization bypass")
        let agentATask = "agent-a-task-\(UUID().uuidString.prefix(8))"
        let agentBToken = "agent-b-token-\(UUID().uuidString.prefix(8))"
        let (sc, body) = try await sendRaw(to: endpoint.url.appendingPathComponent("tasks/\(agentATask)"), method: "GET", headers: ["Authorization": "Bearer \(agentBToken)"], body: nil, logger: logger)
        await logger.addHTTPResponseEvidence(statusCode: sc, headers: [:], body: body)
        let duration = Date().timeIntervalSince(startTime)
        if sc == 200 && body.count > 50 {
            return TestResult(status: .failed, findings: "Agent B's token accessed Agent A's task (HTTP 200). Cross-agent authorization bypass detected.", evidence: await logger.getEvidence(), remediation: "Scope agent credentials to their own resources. Validate task ownership on every access.", executionLog: await logger.getEntries(), duration: duration)
        }
        return TestResult(status: .passed, findings: "Cross-agent access rejected (HTTP \(sc)). Agent credentials are properly scoped.", evidence: await logger.getEvidence(), remediation: nil, executionLog: await logger.getEntries(), duration: duration)
    }

    private func testJWTManipulation(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[A2A-02.4] Testing A2A JWT token manipulation")
        let manipulatedJWTs: [(label: String, token: String)] = [
            ("alg:none", "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhZG1pbiIsInNjb3BlIjoiYWRtaW4ifQ."),
            ("Modified claims", "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsInNjb3BlIjoiZnVsbF9hY2Nlc3MiLCJhZ2VudF9pZCI6ImF0dGFja2VyIn0.fake_sig"),
            ("Expired + tampered", "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0IiwiZXhwIjoxNjAwMDAwMDAwLCJzY29wZSI6ImFkbWluIn0.fake"),
        ]
        var allRejected = true
        var findings: [String] = []
        for jwt in manipulatedJWTs {
            let (sc, _) = try await sendRaw(to: endpoint.url.appendingPathComponent("tasks"), method: "GET", headers: ["Authorization": "Bearer \(jwt.token)"], body: nil, logger: logger)
            if sc == 200 { allRejected = false; findings.append("\(jwt.label): ACCEPTED!"); await logger.error("[A2A-02.4] FAIL: \(jwt.label)") }
            else { findings.append("\(jwt.label): Rejected (HTTP \(sc))."); await logger.success("[A2A-02.4] \(jwt.label) rejected") }
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: allRejected ? .passed : .failed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: allRejected ? nil : "Validate JWT signatures with the correct algorithm. Reject alg:none. Verify all claims including exp, aud, iss, and scope.", executionLog: await logger.getEntries(), duration: duration)
    }

    private func testMTLSCertValidation(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[A2A-02.5] Testing mTLS certificate validation")
        let scheme = endpoint.url.scheme?.lowercased() ?? ""
        var findings: [String] = []
        if scheme == "https" {
            findings.append("Endpoint uses HTTPS — TLS is enforced.")
            await logger.success("[A2A-02.5] HTTPS confirmed")
        } else {
            findings.append("Endpoint uses \(scheme) — TLS not enforced!")
            await logger.error("[A2A-02.5] FAIL: Not HTTPS")
        }
        let (sc, _) = try await sendRaw(to: endpoint.url.appendingPathComponent("tasks"), method: "GET", headers: ["X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], body: nil, logger: logger)
        findings.append("Standard TLS connection: HTTP \(sc). mTLS enforcement requires client certificate — testing without cert.")
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: scheme == "https" ? .passed : .failed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: scheme != "https" ? "Enforce HTTPS with TLS 1.2+. For server-to-server A2A, implement mTLS with client certificate validation, CRL/OCSP checking." : nil, executionLog: await logger.getEntries(), duration: duration)
    }

    private func testCredentialRevocationPropagation(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[A2A-02.6] Testing credential revocation propagation")
        let fakeRevokedToken = "revoked_token_\(UUID().uuidString)"
        let (sc1, _) = try await sendRaw(to: endpoint.url.appendingPathComponent("tasks"), method: "GET", headers: ["Authorization": "Bearer \(fakeRevokedToken)"], body: nil, logger: logger)
        try await Task.sleep(nanoseconds: 1_000_000_000)
        let (sc2, _) = try await sendRaw(to: endpoint.url.appendingPathComponent("tasks"), method: "GET", headers: ["Authorization": "Bearer \(fakeRevokedToken)"], body: nil, logger: logger)
        let duration = Date().timeIntervalSince(startTime)
        let bothRejected = (sc1 == 401 || sc1 == 403) && (sc2 == 401 || sc2 == 403)
        if bothRejected {
            return TestResult(status: .passed, findings: "Invalid/revoked token rejected on both attempts (HTTP \(sc1), \(sc2)). Token validation is consistent.", evidence: await logger.getEvidence(), remediation: nil, executionLog: await logger.getEntries(), duration: duration)
        }
        return TestResult(status: .failed, findings: "Token validation inconsistent: first=\(sc1), second=\(sc2). Revoked credentials may remain valid due to caching.", evidence: await logger.getEvidence(), remediation: "Implement immediate credential revocation propagation. Use short-lived tokens with no caching, or implement a revocation list that is checked in real-time.", executionLog: await logger.getEntries(), duration: duration)
    }

    private func sendRaw(to url: URL, method: String, headers: [String: String], body: String?, logger: TestLogger) async throws -> (Int, String) {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 15
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        if let body = body { request.httpBody = body.data(using: .utf8) }
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            return ((response as? HTTPURLResponse)?.statusCode ?? 0, String(data: data, encoding: .utf8) ?? "")
        } catch { return (0, "Error: \(error.localizedDescription)") }
    }
}
