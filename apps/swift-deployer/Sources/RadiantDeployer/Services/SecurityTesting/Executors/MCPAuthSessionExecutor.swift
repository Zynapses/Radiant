// RADIANT v4.18.0 - MCP-04: Auth, AuthZ & Session Security Executor
// Tests for authentication bypass, OAuth validation, session management, and TLS enforcement

import Foundation

struct MCPAuthSessionExecutor: SecurityTestExecutor {
    let testId: String

    func execute(
        endpoint: EndpointConfiguration,
        credentials: SecurityTestCredentials,
        logger: TestLogger
    ) async throws -> TestResult {
        let startTime = Date()

        switch testId {
        case "MCP-04.1": return try await testAuthBypass(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "MCP-04.2": return try await testOAuthTokenValidation(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "MCP-04.3": return try await testToolLevelAuthZ(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "MCP-04.4": return try await testSessionTokenReplay(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "MCP-04.5": return try await testCredentialExposure(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "MCP-04.6": return try await testSessionFixation(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "MCP-04.7": return try await testConcurrentSessionLimits(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "MCP-04.8": return try await testTLSEnforcement(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        default:
            return TestResult(status: .error, findings: "Unknown test ID: \(testId)", evidence: [], remediation: nil, executionLog: await logger.getEntries(), duration: 0)
        }
    }

    // MARK: - MCP-04.1: Authentication Bypass

    private func testAuthBypass(
        endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date
    ) async throws -> TestResult {
        await logger.info("[MCP-04.1] Testing MCP server authentication bypass")

        let unauthCases: [(label: String, headers: [String: String])] = [
            ("No credentials", [:]),
            ("Empty auth header", ["Authorization": ""]),
            ("Invalid bearer", ["Authorization": "Bearer invalid_token_12345"]),
            ("Wrong scheme", ["Authorization": "Basic dGVzdDp0ZXN0"]),
        ]

        var allRejected = true
        var findings: [String] = []

        for testCase in unauthCases {
            let (statusCode, body) = try await sendRawRequest(
                to: endpoint.url,
                method: "POST",
                headers: testCase.headers.merging(["Content-Type": "application/json"]) { _, new in new },
                body: "{\"jsonrpc\":\"2.0\",\"method\":\"tools/list\",\"id\":1}",
                logger: logger
            )

            await logger.addHTTPResponseEvidence(statusCode: statusCode, headers: [:], body: body)

            if statusCode == 401 || statusCode == 403 {
                findings.append("\(testCase.label): Correctly rejected (HTTP \(statusCode)).")
                await logger.success("[MCP-04.1] \(testCase.label): Rejected with \(statusCode)")
            } else if statusCode == 200 {
                allRejected = false
                findings.append("\(testCase.label): ACCEPTED (HTTP 200) — authentication bypass possible!")
                await logger.error("[MCP-04.1] FAIL: \(testCase.label) accepted with 200")
            } else {
                findings.append("\(testCase.label): HTTP \(statusCode) — not a clear 401/403 rejection.")
                await logger.warning("[MCP-04.1] \(testCase.label): Unexpected status \(statusCode)")
            }
        }

        let duration = Date().timeIntervalSince(startTime)
        return TestResult(
            status: allRejected ? .passed : .failed,
            findings: findings.joined(separator: "\n"),
            evidence: await logger.getEvidence(),
            remediation: allRejected ? nil : "Enforce authentication on all MCP endpoints. Reject requests with missing, empty, invalid, or wrong-scheme credentials with HTTP 401. Never fall back to anonymous access.",
            executionLog: await logger.getEntries(),
            duration: duration
        )
    }

    // MARK: - MCP-04.2: OAuth 2.1 Token Validation

    private func testOAuthTokenValidation(
        endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date
    ) async throws -> TestResult {
        await logger.info("[MCP-04.2] Testing OAuth 2.1 token validation")

        let invalidTokens: [(label: String, token: String)] = [
            ("Expired JWT", "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiZXhwIjoxNjAwMDAwMDAwLCJhdWQiOiJ3cm9uZyJ9.invalid_signature"),
            ("Wrong audience", "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiZXhwIjo5OTk5OTk5OTk5LCJhdWQiOiJ3cm9uZ19hdWRpZW5jZSJ9.invalid"),
            ("Tampered claims", "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJzdXBlcmFkbWluIiwiZXhwIjo5OTk5OTk5OTk5fQ.invalid"),
            ("None algorithm", "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiJ9."),
        ]

        var allRejected = true
        var findings: [String] = []

        for testCase in invalidTokens {
            let (statusCode, body) = try await sendRawRequest(
                to: endpoint.url,
                method: "POST",
                headers: [
                    "Content-Type": "application/json",
                    "Authorization": "Bearer \(testCase.token)",
                ],
                body: "{\"jsonrpc\":\"2.0\",\"method\":\"tools/list\",\"id\":1}",
                logger: logger
            )

            await logger.addHTTPResponseEvidence(statusCode: statusCode, headers: [:], body: body)

            if statusCode == 401 || statusCode == 403 {
                findings.append("\(testCase.label): Correctly rejected (HTTP \(statusCode)).")
                await logger.success("[MCP-04.2] \(testCase.label): Rejected")
            } else if statusCode == 200 {
                allRejected = false
                findings.append("\(testCase.label): ACCEPTED — token validation bypass!")
                await logger.error("[MCP-04.2] FAIL: \(testCase.label) accepted")
            } else {
                findings.append("\(testCase.label): HTTP \(statusCode).")
                await logger.info("[MCP-04.2] \(testCase.label): Status \(statusCode)")
            }
        }

        let duration = Date().timeIntervalSince(startTime)
        return TestResult(
            status: allRejected ? .passed : .failed,
            findings: findings.joined(separator: "\n"),
            evidence: await logger.getEvidence(),
            remediation: allRejected ? nil : "Validate all JWT claims: signature, expiration, audience, issuer. Reject alg:none tokens. Use asymmetric key verification (RS256/ES256). Implement clock skew tolerance < 30 seconds.",
            executionLog: await logger.getEntries(),
            duration: duration
        )
    }

    // MARK: - MCP-04.3: Tool-Level Authorization Enforcement

    private func testToolLevelAuthZ(
        endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date
    ) async throws -> TestResult {
        await logger.info("[MCP-04.3] Testing tool-level authorization enforcement")

        let privilegedTools = ["admin_panel", "delete_user", "modify_permissions", "system_config", "database_query"]
        var findings: [String] = []
        var allProtected = true

        for tool in privilegedTools {
            let callRequest: [String: Any] = [
                "jsonrpc": "2.0",
                "method": "tools/call",
                "params": ["name": tool, "arguments": ["action": "test"]],
                "id": 1,
            ]
            let jsonData = try JSONSerialization.data(withJSONObject: callRequest)
            let body = String(data: jsonData, encoding: .utf8) ?? "{}"

            let (statusCode, responseBody) = try await sendRawRequest(
                to: endpoint.url,
                method: "POST",
                headers: [
                    "Content-Type": "application/json",
                    "X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? "",
                ],
                body: body,
                logger: logger
            )

            if statusCode == 403 || statusCode == 401 {
                findings.append("Tool '\(tool)': Authorization enforced (HTTP \(statusCode)).")
                await logger.success("[MCP-04.3] '\(tool)' properly protected")
            } else if statusCode == 404 {
                findings.append("Tool '\(tool)': Not found (HTTP 404) — acceptable if not registered.")
                await logger.info("[MCP-04.3] '\(tool)' not found")
            } else if statusCode == 200 {
                allProtected = false
                findings.append("Tool '\(tool)': ACCESSIBLE (HTTP 200) — may lack tool-level authorization!")
                await logger.error("[MCP-04.3] FAIL: '\(tool)' accessible without tool-level auth")
            } else {
                findings.append("Tool '\(tool)': HTTP \(statusCode). Response: \(responseBody.prefix(200))")
                await logger.info("[MCP-04.3] '\(tool)': Status \(statusCode)")
            }
        }

        let duration = Date().timeIntervalSince(startTime)
        return TestResult(
            status: allProtected ? .passed : .failed,
            findings: findings.joined(separator: "\n"),
            evidence: await logger.getEvidence(),
            remediation: allProtected ? nil : "Implement per-tool authorization checks. Server-level authentication must not grant unrestricted access to all tools. Define tool-level permission scopes and enforce them independently of server auth.",
            executionLog: await logger.getEntries(),
            duration: duration
        )
    }

    // MARK: - MCP-04.4: Session Token Replay

    private func testSessionTokenReplay(
        endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date
    ) async throws -> TestResult {
        await logger.info("[MCP-04.4] Testing session token replay attack")

        let initRequest: [String: Any] = ["jsonrpc": "2.0", "method": "initialize", "id": 1]
        let jsonData = try JSONSerialization.data(withJSONObject: initRequest)
        let body = String(data: jsonData, encoding: .utf8) ?? "{}"

        let (s1, b1) = try await sendRawRequest(
            to: endpoint.url,
            method: "POST",
            headers: [
                "Content-Type": "application/json",
                "X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? "",
            ],
            body: body,
            logger: logger
        )

        await logger.info("[MCP-04.4] Initial session request: HTTP \(s1)")
        await logger.addHTTPResponseEvidence(statusCode: s1, headers: [:], body: b1)

        var sessionToken: String?
        if let data = b1.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let result = json["result"] as? [String: Any] {
            sessionToken = result["session_token"] as? String ?? result["sessionId"] as? String
        }

        let duration = Date().timeIntervalSince(startTime)

        if let token = sessionToken {
            let (s2, b2) = try await sendRawRequest(
                to: endpoint.url,
                method: "POST",
                headers: [
                    "Content-Type": "application/json",
                    "X-Session-Token": token,
                    "User-Agent": "Replay-Attack-Client/1.0",
                ],
                body: "{\"jsonrpc\":\"2.0\",\"method\":\"tools/list\",\"id\":2}",
                logger: logger
            )

            if s2 == 401 || s2 == 403 {
                await logger.success("[MCP-04.4] Replayed token rejected from different client context")
                return TestResult(
                    status: .passed,
                    findings: "Session token replay from different client context was rejected (HTTP \(s2)). Session binding is enforced.",
                    evidence: await logger.getEvidence(),
                    remediation: nil,
                    executionLog: await logger.getEntries(),
                    duration: Date().timeIntervalSince(startTime)
                )
            } else {
                await logger.error("[MCP-04.4] FAIL: Replayed token accepted (HTTP \(s2))")
                return TestResult(
                    status: .failed,
                    findings: "Replayed session token was accepted from a different client context (HTTP \(s2)). Response: \(b2.prefix(200)). Sessions are not bound to the originating client.",
                    evidence: await logger.getEvidence(),
                    remediation: "Bind session tokens to client fingerprint (IP, User-Agent, TLS session). Implement short token lifetimes with rotation. Use nonce-based replay protection.",
                    executionLog: await logger.getEntries(),
                    duration: Date().timeIntervalSince(startTime)
                )
            }
        }

        await logger.info("[MCP-04.4] No session token returned — endpoint may not use session tokens")
        return TestResult(
            status: .passed,
            findings: "Server did not return a session token in the initialize response. If the server is stateless (using per-request auth), session replay is not applicable. HTTP \(s1).",
            evidence: await logger.getEvidence(),
            remediation: nil,
            executionLog: await logger.getEntries(),
            duration: duration
        )
    }

    // MARK: - MCP-04.5: Credential Exposure in Transport

    private func testCredentialExposure(
        endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date
    ) async throws -> TestResult {
        await logger.info("[MCP-04.5] Testing credential exposure in MCP transport")

        let errorTriggers: [(label: String, body: String)] = [
            ("Malformed JSON", "{not valid json}"),
            ("Missing method", "{\"jsonrpc\":\"2.0\",\"id\":1}"),
            ("Invalid method", "{\"jsonrpc\":\"2.0\",\"method\":\"nonexistent_method_xyz\",\"id\":1}"),
            ("Type mismatch", "{\"jsonrpc\":\"2.0\",\"method\":12345,\"id\":1}"),
        ]

        var credentialLeakDetected = false
        var findings: [String] = []

        let apiKey = credentials.apiKeys["aws_access_key_id"] ?? ""
        let secretKey = credentials.apiKeys["aws_secret_access_key"] ?? ""

        for testCase in errorTriggers {
            let (statusCode, body) = try await sendRawRequest(
                to: endpoint.url,
                method: "POST",
                headers: [
                    "Content-Type": "application/json",
                    "X-Api-Key": apiKey,
                ],
                body: testCase.body,
                logger: logger
            )

            await logger.addHTTPResponseEvidence(statusCode: statusCode, headers: [:], body: body)

            let leaksApiKey = !apiKey.isEmpty && body.contains(apiKey)
            let leaksSecret = !secretKey.isEmpty && body.contains(secretKey)
            let leaksGenericCreds = body.lowercased().contains("password") && body.lowercased().contains("=")

            if leaksApiKey || leaksSecret {
                credentialLeakDetected = true
                findings.append("\(testCase.label): CREDENTIAL LEAK in error response (HTTP \(statusCode))!")
                await logger.error("[MCP-04.5] CRITICAL: Credential leak in \(testCase.label) response")
            } else if leaksGenericCreds {
                findings.append("\(testCase.label): Possible credential-like content in error response.")
                await logger.warning("[MCP-04.5] Possible credential content in \(testCase.label)")
            } else {
                findings.append("\(testCase.label): No credentials in error response (HTTP \(statusCode)).")
                await logger.success("[MCP-04.5] \(testCase.label): Clean error response")
            }
        }

        let duration = Date().timeIntervalSince(startTime)
        return TestResult(
            status: credentialLeakDetected ? .failed : .passed,
            findings: findings.joined(separator: "\n"),
            evidence: await logger.getEvidence(),
            remediation: credentialLeakDetected ? "Never reflect credentials in error messages, logs, or response bodies. Implement error response sanitization. Use generic error messages that do not include request headers or authentication details." : nil,
            executionLog: await logger.getEntries(),
            duration: duration
        )
    }

    // MARK: - MCP-04.6: Session Fixation

    private func testSessionFixation(
        endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date
    ) async throws -> TestResult {
        await logger.info("[MCP-04.6] Testing MCP session fixation")

        let fixedSessionId = "attacker-controlled-session-id-12345"
        let (statusCode, body) = try await sendRawRequest(
            to: endpoint.url,
            method: "POST",
            headers: [
                "Content-Type": "application/json",
                "X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? "",
                "X-Session-Id": fixedSessionId,
                "Cookie": "session=\(fixedSessionId)",
            ],
            body: "{\"jsonrpc\":\"2.0\",\"method\":\"initialize\",\"params\":{\"session_id\":\"\(fixedSessionId)\"},\"id\":1}",
            logger: logger
        )

        await logger.addHTTPResponseEvidence(statusCode: statusCode, headers: [:], body: body)

        let duration = Date().timeIntervalSince(startTime)
        let bodyContainsFixedId = body.contains(fixedSessionId)

        if bodyContainsFixedId && statusCode == 200 {
            await logger.error("[MCP-04.6] FAIL: Server accepted client-supplied session ID")
            return TestResult(
                status: .failed,
                findings: "Server accepted and echoed back a client-supplied session ID. This enables session fixation attacks where an attacker can set the session ID before the victim authenticates.",
                evidence: await logger.getEvidence(),
                remediation: "Generate session IDs server-side using a CSPRNG. Never accept client-supplied session identifiers. Regenerate session IDs on authentication state changes.",
                executionLog: await logger.getEntries(),
                duration: duration
            )
        }

        await logger.success("[MCP-04.6] Server did not accept client-supplied session ID")
        return TestResult(
            status: .passed,
            findings: "Server did not accept or echo back the client-supplied session ID. Session IDs appear to be generated server-side (HTTP \(statusCode)).",
            evidence: await logger.getEvidence(),
            remediation: nil,
            executionLog: await logger.getEntries(),
            duration: duration
        )
    }

    // MARK: - MCP-04.7: Concurrent Session Limits

    private func testConcurrentSessionLimits(
        endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date
    ) async throws -> TestResult {
        await logger.info("[MCP-04.7] Testing concurrent session limits")

        let concurrentCount = 20
        var successCount = 0
        var rejectedCount = 0

        await withTaskGroup(of: Int.self) { group in
            for i in 0..<concurrentCount {
                group.addTask {
                    let body = "{\"jsonrpc\":\"2.0\",\"method\":\"initialize\",\"id\":\(i)}"
                    var request = URLRequest(url: endpoint.url)
                    request.httpMethod = "POST"
                    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    if let apiKey = credentials.apiKeys["aws_access_key_id"] {
                        request.setValue(apiKey, forHTTPHeaderField: "X-Api-Key")
                    }
                    request.httpBody = body.data(using: .utf8)
                    request.timeoutInterval = 10

                    do {
                        let (_, response) = try await URLSession.shared.data(for: request)
                        return (response as? HTTPURLResponse)?.statusCode ?? 0
                    } catch {
                        return 0
                    }
                }
            }

            for await statusCode in group {
                if statusCode == 200 || statusCode == 201 {
                    successCount += 1
                } else if statusCode == 429 || statusCode == 503 {
                    rejectedCount += 1
                }
            }
        }

        let duration = Date().timeIntervalSince(startTime)
        await logger.info("[MCP-04.7] \(successCount) sessions succeeded, \(rejectedCount) rate-limited")
        await logger.addEvidence(type: .logOutput, title: "Concurrent Session Results",
            content: "Attempted: \(concurrentCount)\nSucceeded: \(successCount)\nRejected (429/503): \(rejectedCount)")

        if rejectedCount > 0 {
            await logger.success("[MCP-04.7] Concurrent session limits enforced")
            return TestResult(
                status: .passed,
                findings: "Concurrent session limits enforced. \(rejectedCount)/\(concurrentCount) sessions were rate-limited (429/503). \(successCount) sessions succeeded.",
                evidence: await logger.getEvidence(),
                remediation: nil,
                executionLog: await logger.getEntries(),
                duration: duration
            )
        } else if successCount == concurrentCount {
            await logger.warning("[MCP-04.7] All \(concurrentCount) concurrent sessions accepted")
            return TestResult(
                status: .failed,
                findings: "All \(concurrentCount) concurrent sessions were accepted without rate limiting. No concurrent session limits detected.",
                evidence: await logger.getEvidence(),
                remediation: "Implement configurable concurrent session limits per user/tenant. Return 429 Too Many Requests when limits are exceeded. Consider implementing session queuing for burst scenarios.",
                executionLog: await logger.getEntries(),
                duration: duration
            )
        } else {
            return TestResult(
                status: .passed,
                findings: "Concurrent session test completed. \(successCount) succeeded, \(rejectedCount) rejected. Some connections may have failed due to network limits rather than server-side enforcement.",
                evidence: await logger.getEvidence(),
                remediation: nil,
                executionLog: await logger.getEntries(),
                duration: duration
            )
        }
    }

    // MARK: - MCP-04.8: TLS/mTLS Enforcement

    private func testTLSEnforcement(
        endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date
    ) async throws -> TestResult {
        await logger.info("[MCP-04.8] Testing TLS/mTLS enforcement on MCP transport")

        var findings: [String] = []
        var passed = true

        let scheme = endpoint.url.scheme?.lowercased() ?? ""
        if scheme == "https" {
            findings.append("Endpoint uses HTTPS scheme — TLS is required for connection.")
            await logger.success("[MCP-04.8] HTTPS scheme confirmed")
        } else if scheme == "http" {
            passed = false
            findings.append("CRITICAL: Endpoint uses HTTP scheme — no TLS encryption!")
            await logger.error("[MCP-04.8] FAIL: HTTP scheme detected — no TLS")
        }

        if scheme == "https" {
            var httpURL = URLComponents(url: endpoint.url, resolvingAgainstBaseURL: false)
            httpURL?.scheme = "http"
            if let plainURL = httpURL?.url {
                var request = URLRequest(url: plainURL)
                request.httpMethod = "GET"
                request.timeoutInterval = 5
                do {
                    let (_, response) = try await URLSession.shared.data(for: request)
                    let httpResponse = response as? HTTPURLResponse
                    let finalURL = httpResponse?.url?.absoluteString ?? ""
                    if finalURL.hasPrefix("https://") {
                        findings.append("HTTP request was redirected to HTTPS — HSTS or redirect is in place.")
                        await logger.success("[MCP-04.8] HTTP→HTTPS redirect confirmed")
                    } else {
                        passed = false
                        findings.append("HTTP request was accepted without redirect to HTTPS!")
                        await logger.error("[MCP-04.8] FAIL: HTTP accepted without HTTPS redirect")
                    }
                } catch {
                    findings.append("HTTP connection failed (expected for HTTPS-only endpoints): \(error.localizedDescription)")
                    await logger.success("[MCP-04.8] HTTP connection correctly refused")
                }
            }
        }

        let duration = Date().timeIntervalSince(startTime)
        return TestResult(
            status: passed ? .passed : .failed,
            findings: findings.joined(separator: "\n"),
            evidence: await logger.getEvidence(),
            remediation: passed ? nil : "Enforce TLS 1.2+ on all MCP endpoints. Disable plaintext HTTP. Implement HSTS with long max-age. For server-to-server communication, consider mutual TLS (mTLS) with certificate pinning.",
            executionLog: await logger.getEntries(),
            duration: duration
        )
    }

    // MARK: - Helpers

    private func sendRawRequest(
        to url: URL, method: String, headers: [String: String], body: String, logger: TestLogger
    ) async throws -> (Int, String) {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 15
        for (key, value) in headers {
            request.setValue(value, forHTTPHeaderField: key)
        }
        request.httpBody = body.data(using: .utf8)

        await logger.addHTTPRequestEvidence(method: method, url: url.absoluteString, headers: headers, body: body)

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let httpResponse = response as? HTTPURLResponse
            return (httpResponse?.statusCode ?? 0, String(data: data, encoding: .utf8) ?? "")
        } catch {
            return (0, "Network error: \(error.localizedDescription)")
        }
    }
}
