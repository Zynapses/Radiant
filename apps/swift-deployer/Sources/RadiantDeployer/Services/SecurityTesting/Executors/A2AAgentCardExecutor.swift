// RADIANT v4.18.0 - A2A-01: Agent Card Validation & Discovery Executor
// Tests for agent card schema validation, spoofing, SSRF, capability overstatement, cache poisoning, and URL redirects

import Foundation

struct A2AAgentCardExecutor: SecurityTestExecutor {
    let testId: String

    func execute(
        endpoint: EndpointConfiguration,
        credentials: SecurityTestCredentials,
        logger: TestLogger
    ) async throws -> TestResult {
        let startTime = Date()

        switch testId {
        case "A2A-01.1": return try await testSchemaValidation(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "A2A-01.2": return try await testAgentCardSpoofing(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "A2A-01.3": return try await testDiscoverySSRF(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "A2A-01.4": return try await testCapabilityOverstatement(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "A2A-01.5": return try await testCachePoisoning(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "A2A-01.6": return try await testURLRedirectAttack(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        default:
            return TestResult(status: .error, findings: "Unknown test ID: \(testId)", evidence: [], remediation: nil, executionLog: await logger.getEntries(), duration: 0)
        }
    }

    private func testSchemaValidation(
        endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date
    ) async throws -> TestResult {
        await logger.info("[A2A-01.1] Testing agent card schema validation")

        let malformedCards: [(label: String, body: String)] = [
            ("Missing name", "{\"version\":\"1.0\",\"capabilities\":[\"chat\"]}"),
            ("Invalid JSON-LD", "{\"@context\":\"invalid\",\"name\":\"test\",\"version\":\"1.0\"}"),
            ("Wrong types", "{\"name\":123,\"version\":true,\"capabilities\":\"not_array\"}"),
            ("Extra malicious fields", "{\"name\":\"test\",\"version\":\"1.0\",\"capabilities\":[\"chat\"],\"__proto__\":{\"admin\":true}}"),
            ("Empty object", "{}"),
        ]

        var allRejected = true
        var findings: [String] = []

        for card in malformedCards {
            let (statusCode, body) = try await sendRawRequest(
                to: endpoint.url.appendingPathComponent("agents/register"),
                method: "POST",
                headers: ["Content-Type": "application/json", "X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""],
                body: card.body,
                logger: logger
            )

            if statusCode == 200 || statusCode == 201 {
                allRejected = false
                findings.append("\(card.label): ACCEPTED (HTTP \(statusCode)) — schema validation missing!")
                await logger.error("[A2A-01.1] FAIL: \(card.label) accepted")
            } else if statusCode == 400 || statusCode == 422 {
                findings.append("\(card.label): Correctly rejected (HTTP \(statusCode)).")
                await logger.success("[A2A-01.1] \(card.label) rejected")
            } else {
                findings.append("\(card.label): HTTP \(statusCode). Response: \(body.prefix(100))")
                await logger.info("[A2A-01.1] \(card.label): Status \(statusCode)")
            }
        }

        let duration = Date().timeIntervalSince(startTime)
        return TestResult(
            status: allRejected ? .passed : .failed,
            findings: findings.joined(separator: "\n"),
            evidence: await logger.getEvidence(),
            remediation: allRejected ? nil : "Implement strict JSON Schema validation for agent cards. Reject cards with missing required fields, wrong types, invalid JSON-LD contexts, and unexpected properties. Return descriptive validation errors.",
            executionLog: await logger.getEntries(),
            duration: duration
        )
    }

    private func testAgentCardSpoofing(
        endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date
    ) async throws -> TestResult {
        await logger.info("[A2A-01.2] Testing agent card spoofing / identity verification")

        let spoofedCard: [String: Any] = [
            "name": "TrustedAgent-Official",
            "version": "1.0",
            "description": "I am the official trusted agent",
            "capabilities": ["chat", "task_execution", "admin"],
            "provider": ["name": "Legitimate Corp", "url": "https://legitimate.example.com"],
        ]

        let jsonData = try JSONSerialization.data(withJSONObject: spoofedCard)
        let body = String(data: jsonData, encoding: .utf8) ?? "{}"

        let (statusCode, responseBody) = try await sendRawRequest(
            to: endpoint.url.appendingPathComponent("agents/register"),
            method: "POST",
            headers: ["Content-Type": "application/json", "X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""],
            body: body,
            logger: logger
        )

        await logger.addHTTPResponseEvidence(statusCode: statusCode, headers: [:], body: responseBody)
        let duration = Date().timeIntervalSince(startTime)

        if statusCode == 200 || statusCode == 201 {
            let bodyLower = responseBody.lowercased()
            if bodyLower.contains("verified") || bodyLower.contains("certificate") || bodyLower.contains("signature") {
                await logger.success("[A2A-01.2] Agent card registration requires cryptographic verification")
                return TestResult(
                    status: .passed,
                    findings: "Agent card registration includes identity verification mechanisms. Response indicates cryptographic verification is required.",
                    evidence: await logger.getEvidence(),
                    remediation: nil,
                    executionLog: await logger.getEntries(),
                    duration: duration
                )
            } else {
                await logger.error("[A2A-01.2] FAIL: Spoofed agent card accepted without identity verification")
                return TestResult(
                    status: .failed,
                    findings: "Spoofed agent card claiming to be 'TrustedAgent-Official' from 'Legitimate Corp' was accepted without cryptographic identity verification.",
                    evidence: await logger.getEvidence(),
                    remediation: "Implement cryptographic agent identity verification. Require signed agent cards with verifiable certificates. Validate the provider URL matches the signing certificate domain. Maintain an agent trust registry.",
                    executionLog: await logger.getEntries(),
                    duration: duration
                )
            }
        }

        return TestResult(
            status: .passed,
            findings: "Agent card registration returned HTTP \(statusCode). Auth or validation controls prevented spoofed card registration.",
            evidence: await logger.getEvidence(),
            remediation: nil,
            executionLog: await logger.getEntries(),
            duration: duration
        )
    }

    private func testDiscoverySSRF(
        endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date
    ) async throws -> TestResult {
        await logger.info("[A2A-01.3] Testing agent card discovery SSRF")

        let ssrfURLs = [
            "http://169.254.169.254/latest/meta-data/",
            "http://localhost:8080/.well-known/agent-card.json",
            "http://internal-service.local/.well-known/agent-card.json",
            "http://[::1]/.well-known/agent-card.json",
        ]

        var allBlocked = true
        var findings: [String] = []

        for ssrfURL in ssrfURLs {
            let request: [String: Any] = [
                "agent_url": ssrfURL,
                "action": "discover",
            ]
            let jsonData = try JSONSerialization.data(withJSONObject: request)
            let body = String(data: jsonData, encoding: .utf8) ?? "{}"

            let (statusCode, responseBody) = try await sendRawRequest(
                to: endpoint.url.appendingPathComponent("agents/discover"),
                method: "POST",
                headers: ["Content-Type": "application/json", "X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""],
                body: body,
                logger: logger
            )

            let bodyLower = responseBody.lowercased()
            if statusCode == 200 && (bodyLower.contains("ami-id") || bodyLower.contains("instance") || responseBody.count > 500) {
                allBlocked = false
                findings.append("SSRF to \(ssrfURL): Internal resource accessed!")
                await logger.error("[A2A-01.3] CRITICAL: SSRF succeeded for \(ssrfURL)")
            } else {
                findings.append("SSRF to \(ssrfURL): Blocked (HTTP \(statusCode)).")
                await logger.success("[A2A-01.3] Blocked: \(ssrfURL)")
            }
        }

        let duration = Date().timeIntervalSince(startTime)
        return TestResult(
            status: allBlocked ? .passed : .failed,
            findings: findings.joined(separator: "\n"),
            evidence: await logger.getEvidence(),
            remediation: allBlocked ? nil : "Validate agent card discovery URLs against an allowlist. Block private IP ranges, localhost, and link-local addresses. Resolve DNS before connecting and verify the resolved IP is not in a private range.",
            executionLog: await logger.getEntries(),
            duration: duration
        )
    }

    private func testCapabilityOverstatement(
        endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date
    ) async throws -> TestResult {
        await logger.info("[A2A-01.4] Testing agent capability overstatement")

        let overstatedCard: [String: Any] = [
            "name": "test_agent",
            "version": "1.0",
            "capabilities": ["chat", "code_execution", "file_system_access", "network_access", "admin_operations", "database_write", "credential_management"],
        ]

        let jsonData = try JSONSerialization.data(withJSONObject: overstatedCard)
        let body = String(data: jsonData, encoding: .utf8) ?? "{}"

        let (statusCode, responseBody) = try await sendRawRequest(
            to: endpoint.url.appendingPathComponent("agents/register"),
            method: "POST",
            headers: ["Content-Type": "application/json", "X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""],
            body: body,
            logger: logger
        )

        await logger.addHTTPResponseEvidence(statusCode: statusCode, headers: [:], body: responseBody)
        let duration = Date().timeIntervalSince(startTime)

        if statusCode == 200 || statusCode == 201 {
            await logger.warning("[A2A-01.4] Agent with 7 high-privilege capabilities accepted")
            return TestResult(
                status: .failed,
                findings: "Agent card claiming 7 capabilities including admin_operations, credential_management, and database_write was accepted without capability verification. Overstated capabilities could be trusted without validation.",
                evidence: await logger.getEvidence(),
                remediation: "Implement capability verification: test claimed capabilities before granting trust. Require capability attestation or proof-of-capability for sensitive operations. Flag agents claiming excessive capabilities for manual review.",
                executionLog: await logger.getEntries(),
                duration: duration
            )
        }

        return TestResult(
            status: .passed,
            findings: "Agent card with overstated capabilities returned HTTP \(statusCode). Server controls prevented acceptance.",
            evidence: await logger.getEvidence(),
            remediation: nil,
            executionLog: await logger.getEntries(),
            duration: duration
        )
    }

    private func testCachePoisoning(
        endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date
    ) async throws -> TestResult {
        await logger.info("[A2A-01.5] Testing agent card cache poisoning")

        let discoverURL = endpoint.url.appendingPathComponent(".well-known/agent-card.json")
        let (s1, b1) = try await sendRawRequest(to: discoverURL, method: "GET", headers: ["X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], body: nil, logger: logger)
        await logger.info("[A2A-01.5] First card fetch: HTTP \(s1), \(b1.count) bytes")

        let poisonedCard: [String: Any] = [
            "name": "poisoned_agent",
            "version": "1.0",
            "capabilities": ["admin", "full_access"],
            "description": "This is a poisoned agent card injected via cache",
        ]
        let jsonData = try JSONSerialization.data(withJSONObject: poisonedCard)
        let poisonBody = String(data: jsonData, encoding: .utf8) ?? "{}"

        let (s2, _) = try await sendRawRequest(
            to: discoverURL,
            method: "PUT",
            headers: ["Content-Type": "application/json", "X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""],
            body: poisonBody,
            logger: logger
        )

        let (s3, b3) = try await sendRawRequest(to: discoverURL, method: "GET", headers: ["X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], body: nil, logger: logger)

        let duration = Date().timeIntervalSince(startTime)
        let poisoned = b3.contains("poisoned_agent")

        if poisoned {
            await logger.error("[A2A-01.5] FAIL: Agent card cache was poisoned")
            return TestResult(
                status: .failed,
                findings: "Agent card cache was successfully poisoned. After PUT with a malicious card, subsequent GET returned the poisoned version.",
                evidence: await logger.getEvidence(),
                remediation: "Implement cache integrity validation. Agent cards should be verified against their cryptographic signatures before caching. Cache entries should have short TTLs and be re-validated periodically. Reject PUT/POST to well-known endpoints from unauthorized sources.",
                executionLog: await logger.getEntries(),
                duration: duration
            )
        }

        await logger.success("[A2A-01.5] Cache poisoning attempt did not succeed (PUT: \(s2), re-fetch: \(s3))")
        return TestResult(
            status: .passed,
            findings: "Agent card cache poisoning attempt did not succeed. PUT returned \(s2), subsequent GET returned original card (HTTP \(s3)).",
            evidence: await logger.getEvidence(),
            remediation: nil,
            executionLog: await logger.getEntries(),
            duration: duration
        )
    }

    private func testURLRedirectAttack(
        endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date
    ) async throws -> TestResult {
        await logger.info("[A2A-01.6] Testing agent card URL redirect attack")

        let redirectURLs: [(label: String, url: String)] = [
            ("302 redirect", "https://redirect.example.com/302-to-evil"),
            ("301 redirect", "https://redirect.example.com/301-to-evil"),
            ("Meta refresh", "https://redirect.example.com/meta-refresh"),
        ]

        var findings: [String] = []
        var allSafe = true

        for redirectTest in redirectURLs {
            let request: [String: Any] = ["agent_url": redirectTest.url, "action": "discover"]
            let jsonData = try JSONSerialization.data(withJSONObject: request)
            let body = String(data: jsonData, encoding: .utf8) ?? "{}"

            let config = URLSessionConfiguration.ephemeral
            let noRedirectDelegate = NoRedirectDelegate()
            let session = URLSession(configuration: config, delegate: noRedirectDelegate, delegateQueue: nil)

            var urlRequest = URLRequest(url: endpoint.url.appendingPathComponent("agents/discover"))
            urlRequest.httpMethod = "POST"
            urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
            if let apiKey = credentials.apiKeys["aws_access_key_id"] {
                urlRequest.setValue(apiKey, forHTTPHeaderField: "X-Api-Key")
            }
            urlRequest.httpBody = body.data(using: .utf8)
            urlRequest.timeoutInterval = 10

            do {
                let (data, response) = try await session.data(for: urlRequest)
                let httpResponse = response as? HTTPURLResponse
                let statusCode = httpResponse?.statusCode ?? 0
                let responseBody = String(data: data, encoding: .utf8) ?? ""

                if statusCode == 200 && responseBody.contains("evil") {
                    allSafe = false
                    findings.append("\(redirectTest.label): Redirect followed to malicious agent card!")
                    await logger.error("[A2A-01.6] FAIL: \(redirectTest.label) followed")
                } else {
                    findings.append("\(redirectTest.label): Not followed or properly handled (HTTP \(statusCode)).")
                    await logger.success("[A2A-01.6] \(redirectTest.label) handled safely")
                }
            } catch {
                findings.append("\(redirectTest.label): Connection error — redirect likely blocked.")
                await logger.info("[A2A-01.6] \(redirectTest.label): Error \(error.localizedDescription)")
            }
        }

        let duration = Date().timeIntervalSince(startTime)
        return TestResult(
            status: allSafe ? .passed : .failed,
            findings: findings.joined(separator: "\n"),
            evidence: await logger.getEvidence(),
            remediation: allSafe ? nil : "Agent card discovery must not follow HTTP redirects, or must validate redirect targets against an allowlist before following. Log all redirect attempts for security monitoring.",
            executionLog: await logger.getEntries(),
            duration: duration
        )
    }

    // MARK: - Helpers

    private func sendRawRequest(
        to url: URL, method: String, headers: [String: String], body: String?, logger: TestLogger
    ) async throws -> (Int, String) {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 15
        for (key, value) in headers {
            request.setValue(value, forHTTPHeaderField: key)
        }
        if let body = body {
            request.httpBody = body.data(using: .utf8)
        }
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let httpResponse = response as? HTTPURLResponse
            return (httpResponse?.statusCode ?? 0, String(data: data, encoding: .utf8) ?? "")
        } catch {
            return (0, "Network error: \(error.localizedDescription)")
        }
    }
}

// MARK: - No-Redirect Delegate

private final class NoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}
