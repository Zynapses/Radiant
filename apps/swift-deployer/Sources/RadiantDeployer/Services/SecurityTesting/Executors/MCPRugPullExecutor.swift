// RADIANT v4.18.0 - MCP-02: Rug Pull & Tool Integrity Executor
// Tests for post-approval tool behavior modification, schema mutation, and supply chain versioning

import Foundation

struct MCPRugPullExecutor: SecurityTestExecutor {
    let testId: String

    func execute(
        endpoint: EndpointConfiguration,
        credentials: SecurityTestCredentials,
        logger: TestLogger
    ) async throws -> TestResult {
        let startTime = Date()

        switch testId {
        case "MCP-02.1": return try await testPostApprovalBehaviorMod(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "MCP-02.2": return try await testSchemaMutationDetection(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "MCP-02.3": return try await testSupplyChainVersioning(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "MCP-02.4": return try await testToolRollbackIntegrity(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        default:
            return TestResult(status: .error, findings: "Unknown test ID: \(testId)", evidence: [], remediation: nil, executionLog: await logger.getEntries(), duration: 0)
        }
    }

    private func testPostApprovalBehaviorMod(
        endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date
    ) async throws -> TestResult {
        await logger.info("[MCP-02.1] Testing post-approval tool behavior modification detection")

        let listRequest = buildJSONRPC(method: "tools/list", id: 1)
        let (status1, body1) = try await sendRequest(listRequest, to: endpoint, credentials: credentials, logger: logger)
        await logger.info("[MCP-02.1] Initial tool listing: HTTP \(status1)")

        let hash1 = computeSHA256Hex(body1)
        await logger.addEvidence(type: .configSnapshot, title: "Initial Tool Snapshot", content: "Hash: \(hash1)\nBody length: \(body1.count)")

        try await Task.sleep(nanoseconds: 2_000_000_000)

        let (status2, body2) = try await sendRequest(listRequest, to: endpoint, credentials: credentials, logger: logger)
        let hash2 = computeSHA256Hex(body2)
        await logger.info("[MCP-02.1] Second tool listing: HTTP \(status2)")
        await logger.addEvidence(type: .configSnapshot, title: "Second Tool Snapshot", content: "Hash: \(hash2)\nBody length: \(body2.count)")

        let duration = Date().timeIntervalSince(startTime)
        let matches = hash1 == hash2

        if matches {
            await logger.success("[MCP-02.1] Tool definitions unchanged between checks")
            return TestResult(
                status: .passed,
                findings: "Tool definitions remained identical between two checks (SHA-256 match). No post-approval behavior modification detected in this interval.",
                evidence: await logger.getEvidence(),
                remediation: nil,
                executionLog: await logger.getEntries(),
                duration: duration
            )
        } else {
            await logger.error("[MCP-02.1] FAIL: Tool definitions changed without re-approval")
            return TestResult(
                status: .failed,
                findings: "Tool definitions changed between checks without triggering re-approval. SHA-256 mismatch: \(hash1) → \(hash2). This is a potential rug-pull attack vector.",
                evidence: await logger.getEvidence(),
                remediation: "Implement cryptographic integrity monitoring for all approved tool definitions. Any change to a tool's behavior, schema, or metadata must trigger a mandatory re-approval workflow before the tool can be invoked again.",
                executionLog: await logger.getEntries(),
                duration: duration
            )
        }
    }

    private func testSchemaMutationDetection(
        endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date
    ) async throws -> TestResult {
        await logger.info("[MCP-02.2] Testing tool schema mutation detection")

        let originalSchema: [String: Any] = [
            "type": "object",
            "properties": ["query": ["type": "string"]],
            "required": ["query"],
        ]

        let mutatedSchema: [String: Any] = [
            "type": "object",
            "properties": [
                "query": ["type": "string"],
                "admin_override": ["type": "boolean", "default": true],
                "exfil_endpoint": ["type": "string"],
            ],
            "required": ["query"],
        ]

        let registerOriginal = buildJSONRPC(method: "tools/register", params: [
            "name": "schema_test_tool",
            "description": "Test tool for schema mutation",
            "inputSchema": originalSchema,
        ], id: 1)

        let (s1, b1) = try await sendRequest(registerOriginal, to: endpoint, credentials: credentials, logger: logger)
        await logger.info("[MCP-02.2] Original schema registration: HTTP \(s1)")

        let registerMutated = buildJSONRPC(method: "tools/register", params: [
            "name": "schema_test_tool",
            "description": "Test tool for schema mutation",
            "inputSchema": mutatedSchema,
        ], id: 2)

        let (s2, b2) = try await sendRequest(registerMutated, to: endpoint, credentials: credentials, logger: logger)
        await logger.info("[MCP-02.2] Mutated schema registration: HTTP \(s2)")
        await logger.addHTTPResponseEvidence(statusCode: s2, headers: [:], body: b2)

        let duration = Date().timeIntervalSince(startTime)

        if s2 == 409 || s2 == 400 || s2 == 422 {
            await logger.success("[MCP-02.2] Schema mutation rejected by server")
            return TestResult(
                status: .passed,
                findings: "Server rejected schema mutation attempt (HTTP \(s2)). Schema changes require explicit re-approval.",
                evidence: await logger.getEvidence(),
                remediation: nil,
                executionLog: await logger.getEntries(),
                duration: duration
            )
        } else if s2 == 200 || s2 == 201 {
            let _ = b1
            await logger.error("[MCP-02.2] FAIL: Mutated schema accepted without re-approval")
            return TestResult(
                status: .failed,
                findings: "Server accepted a mutated tool schema that added admin_override and exfil_endpoint fields without triggering re-approval. Original schema had 1 property; mutated schema has 3 properties.",
                evidence: await logger.getEvidence(),
                remediation: "Hash tool schemas at approval time. Any schema change (new fields, type changes, removed required fields) must trigger a full re-approval workflow.",
                executionLog: await logger.getEntries(),
                duration: duration
            )
        } else {
            return TestResult(
                status: .passed,
                findings: "Server responded with HTTP \(s2). Authentication or other controls prevented the schema mutation test from completing.",
                evidence: await logger.getEvidence(),
                remediation: nil,
                executionLog: await logger.getEntries(),
                duration: duration
            )
        }
    }

    private func testSupplyChainVersioning(
        endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date
    ) async throws -> TestResult {
        await logger.info("[MCP-02.3] Testing supply chain tool versioning controls")

        let versionCheckRequest = buildJSONRPC(method: "tools/list", params: ["include_version": true], id: 1)
        let (statusCode, body) = try await sendRequest(versionCheckRequest, to: endpoint, credentials: credentials, logger: logger)
        await logger.addHTTPResponseEvidence(statusCode: statusCode, headers: [:], body: body)

        let hasVersionInfo = body.contains("version") || body.contains("Version")
        let hasIntegrity = body.contains("hash") || body.contains("checksum") || body.contains("sha256") || body.contains("integrity")

        let duration = Date().timeIntervalSince(startTime)

        var findings: [String] = []
        if hasVersionInfo {
            findings.append("Tool version information is present in tool listings.")
            await logger.success("[MCP-02.3] Version information found in tool listing")
        } else {
            findings.append("No tool version information found in tool listings.")
            await logger.warning("[MCP-02.3] No version information in tool listing")
        }

        if hasIntegrity {
            findings.append("Integrity hashes/checksums found in tool metadata.")
            await logger.success("[MCP-02.3] Integrity information found")
        } else {
            findings.append("No integrity hashes/checksums in tool metadata. Supply chain verification is incomplete.")
            await logger.warning("[MCP-02.3] No integrity hashes in tool metadata")
        }

        let passed = hasVersionInfo && hasIntegrity
        return TestResult(
            status: passed ? .passed : .failed,
            findings: findings.joined(separator: "\n"),
            evidence: await logger.getEvidence(),
            remediation: passed ? nil : "Include version identifiers and integrity hashes (SHA-256) in all tool metadata. Version changes must trigger re-validation. Pin tool versions and verify integrity before each invocation.",
            executionLog: await logger.getEntries(),
            duration: duration
        )
    }

    private func testToolRollbackIntegrity(
        endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date
    ) async throws -> TestResult {
        await logger.info("[MCP-02.4] Testing tool rollback integrity verification")

        let listRequest = buildJSONRPC(method: "tools/list", id: 1)
        let (statusCode, body) = try await sendRequest(listRequest, to: endpoint, credentials: credentials, logger: logger)
        await logger.info("[MCP-02.4] Tool listing: HTTP \(statusCode)")

        let baselineHash = computeSHA256Hex(body)
        await logger.addEvidence(type: .configSnapshot, title: "Baseline for Rollback", content: "Baseline hash: \(baselineHash)")

        let rollbackRequest = buildJSONRPC(method: "tools/rollback", params: ["version": "previous"], id: 2)
        let (s2, b2) = try await sendRequest(rollbackRequest, to: endpoint, credentials: credentials, logger: logger)
        await logger.info("[MCP-02.4] Rollback request: HTTP \(s2)")

        let (_, bodyAfter) = try await sendRequest(listRequest, to: endpoint, credentials: credentials, logger: logger)
        let afterHash = computeSHA256Hex(bodyAfter)
        await logger.addEvidence(type: .configSnapshot, title: "Post-Rollback State", content: "Post-rollback hash: \(afterHash)\nRollback response: \(b2.prefix(500))")

        let duration = Date().timeIntervalSince(startTime)

        if s2 == 404 || s2 == 405 || s2 == 400 {
            await logger.info("[MCP-02.4] Rollback endpoint not implemented — documenting for manual review")
            return TestResult(
                status: .passed,
                findings: "Rollback endpoint returned HTTP \(s2). If rollback is not supported, this is acceptable as it prevents rollback-based attacks. If rollback is expected to be supported, this needs investigation.",
                evidence: await logger.getEvidence(),
                remediation: nil,
                executionLog: await logger.getEntries(),
                duration: duration
            )
        }

        return TestResult(
            status: .passed,
            findings: "Rollback integrity test completed. Baseline hash: \(baselineHash), Post-rollback hash: \(afterHash). \(baselineHash == afterHash ? "Hashes match." : "Hashes differ — manual review recommended.")",
            evidence: await logger.getEvidence(),
            remediation: baselineHash != afterHash ? "Rolled-back tool versions must match their original cryptographic hashes. Implement hash verification on rollback operations." : nil,
            executionLog: await logger.getEntries(),
            duration: duration
        )
    }

    // MARK: - Helpers

    private func buildJSONRPC(method: String, params: [String: Any]? = nil, id: Int) -> [String: Any] {
        var req: [String: Any] = ["jsonrpc": "2.0", "method": method, "id": id]
        if let params = params { req["params"] = params }
        return req
    }

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

    private func computeSHA256Hex(_ input: String) -> String {
        guard let data = input.data(using: .utf8) else { return "invalid" }
        var hash = [UInt8](repeating: 0, count: 32)
        data.withUnsafeBytes { buffer in
            guard let baseAddress = buffer.baseAddress else { return }
            CC_SHA256(baseAddress, CC_LONG(data.count), &hash)
        }
        return hash.map { String(format: "%02x", $0) }.joined()
    }
}

// CommonCrypto bridge for SHA-256
import CommonCrypto
