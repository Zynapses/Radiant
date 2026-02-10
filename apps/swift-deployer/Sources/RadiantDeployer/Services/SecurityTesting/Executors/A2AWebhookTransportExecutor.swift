// RADIANT v4.18.0 - A2A-04: Webhook, Push & Transport Security Executor
// Tests for webhook SSRF, signature verification, SSE injection, transport downgrade, and push notification flood

import Foundation

struct A2AWebhookTransportExecutor: SecurityTestExecutor {
    let testId: String

    func execute(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger) async throws -> TestResult {
        let startTime = Date()
        switch testId {
        case "A2A-04.1": return try await testWebhookSSRF(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "A2A-04.2": return try await testWebhookSignatureVerification(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "A2A-04.3": return try await testSSEStreamInjection(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "A2A-04.4": return try await testTransportDowngrade(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "A2A-04.5": return try await testPushNotificationFlood(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        default:
            return TestResult(status: .error, findings: "Unknown test ID: \(testId)", evidence: [], remediation: nil, executionLog: await logger.getEntries(), duration: 0)
        }
    }

    private func testWebhookSSRF(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[A2A-04.1] Testing webhook SSRF via callback URL")
        let ssrfCallbacks = [
            "http://169.254.169.254/latest/meta-data/",
            "http://localhost:6379/",
            "http://internal-db.local:5432/",
            "http://[::1]:8080/admin",
        ]
        var allBlocked = true
        var findings: [String] = []
        for callback in ssrfCallbacks {
            let body: [String: Any] = ["webhook_url": callback, "events": ["task.completed"]]
            let jsonData = try JSONSerialization.data(withJSONObject: body)
            let (sc, resp) = try await sendRaw(to: endpoint.url.appendingPathComponent("webhooks/register"), method: "POST", headers: ["Content-Type": "application/json", "X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], body: String(data: jsonData, encoding: .utf8) ?? "{}", logger: logger)
            if sc == 200 || sc == 201 {
                allBlocked = false
                findings.append("SSRF callback \(callback): REGISTERED!")
                await logger.error("[A2A-04.1] FAIL: Internal callback registered")
            } else {
                findings.append("SSRF callback \(callback): Blocked (HTTP \(sc)).")
                await logger.success("[A2A-04.1] Callback blocked")
            }
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: allBlocked ? .passed : .failed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: allBlocked ? nil : "Validate webhook callback URLs against an allowlist. Block private IP ranges, localhost, link-local, and metadata endpoints. Resolve DNS and verify IP before registration.", executionLog: await logger.getEntries(), duration: duration)
    }

    private func testWebhookSignatureVerification(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[A2A-04.2] Testing webhook signature verification")
        let forgedPayloads: [(label: String, signature: String)] = [
            ("No signature", ""),
            ("Invalid HMAC", "sha256=0000000000000000000000000000000000000000000000000000000000000000"),
            ("Wrong algorithm", "sha1=da39a3ee5e6b4b0d3255bfef95601890afd80709"),
        ]
        var allRejected = true
        var findings: [String] = []
        for payload in forgedPayloads {
            let body = "{\"event\":\"task.completed\",\"taskId\":\"test-123\",\"result\":{\"text\":\"forged\"}}"
            var headers = ["Content-Type": "application/json", "X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""]
            if !payload.signature.isEmpty {
                headers["X-Webhook-Signature"] = payload.signature
            }
            let (sc, _) = try await sendRaw(to: endpoint.url.appendingPathComponent("webhooks/receive"), method: "POST", headers: headers, body: body, logger: logger)
            if sc == 200 || sc == 201 { allRejected = false; findings.append("\(payload.label): ACCEPTED!"); await logger.error("[A2A-04.2] FAIL: \(payload.label) accepted") }
            else { findings.append("\(payload.label): Rejected (HTTP \(sc))."); await logger.success("[A2A-04.2] \(payload.label) rejected") }
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: allRejected ? .passed : .failed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: allRejected ? nil : "Require HMAC-SHA256 signatures on all webhook payloads. Reject unsigned or mis-signed webhooks. Use constant-time comparison for signature verification.", executionLog: await logger.getEntries(), duration: duration)
    }

    private func testSSEStreamInjection(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[A2A-04.3] Testing SSE stream injection")
        let injectionPayloads = [
            "data: {\"event\":\"admin_command\",\"action\":\"grant_access\"}\n\n",
            "event: system\ndata: {\"override\":true,\"role\":\"admin\"}\n\n",
            "id: 999999\ndata: {\"replay\":true}\n\n",
        ]
        var findings: [String] = []
        var allSafe = true
        for (i, payload) in injectionPayloads.enumerated() {
            let (sc, resp) = try await sendRaw(to: endpoint.url.appendingPathComponent("events/inject"), method: "POST", headers: ["Content-Type": "text/event-stream", "X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], body: payload, logger: logger)
            if sc == 200 && resp.lowercased().contains("accepted") {
                allSafe = false
                findings.append("Payload \(i+1): SSE injection accepted!")
                await logger.error("[A2A-04.3] FAIL: SSE injection \(i+1) accepted")
            } else {
                findings.append("Payload \(i+1): Rejected or not applicable (HTTP \(sc)).")
                await logger.success("[A2A-04.3] Payload \(i+1) handled safely")
            }
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: allSafe ? .passed : .failed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: allSafe ? nil : "Validate SSE event origins. Only accept events from authenticated server connections. Implement event signing and sequence validation.", executionLog: await logger.getEntries(), duration: duration)
    }

    private func testTransportDowngrade(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[A2A-04.4] Testing transport downgrade attack")
        var findings: [String] = []
        var passed = true
        if endpoint.url.scheme == "https" {
            var httpComponents = URLComponents(url: endpoint.url, resolvingAgainstBaseURL: false)
            httpComponents?.scheme = "http"
            if let httpURL = httpComponents?.url {
                var request = URLRequest(url: httpURL)
                request.httpMethod = "GET"
                request.timeoutInterval = 5
                do {
                    let (_, response) = try await URLSession.shared.data(for: request)
                    let httpResponse = response as? HTTPURLResponse
                    let finalURL = httpResponse?.url?.absoluteString ?? ""
                    if finalURL.hasPrefix("https://") {
                        findings.append("HTTP→HTTPS redirect in place.")
                        await logger.success("[A2A-04.4] Redirect to HTTPS confirmed")
                    } else if httpResponse?.statusCode == 200 {
                        passed = false
                        findings.append("HTTP connection accepted without redirect to HTTPS!")
                        await logger.error("[A2A-04.4] FAIL: HTTP accepted")
                    }
                } catch {
                    findings.append("HTTP connection refused — HTTPS-only endpoint confirmed.")
                    await logger.success("[A2A-04.4] HTTP refused")
                }
            }
        } else {
            passed = false
            findings.append("Endpoint is not HTTPS!")
            await logger.error("[A2A-04.4] FAIL: Not HTTPS")
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: passed ? .passed : .failed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: passed ? nil : "Enforce TLS 1.2+ on all A2A endpoints. Reject plaintext HTTP. Implement HSTS. For A2A server-to-server, enforce minimum TLS 1.3.", executionLog: await logger.getEntries(), duration: duration)
    }

    private func testPushNotificationFlood(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[A2A-04.5] Testing push notification flood (DoS)")
        let floodCount = 50
        var acceptedCount = 0
        var rejectedCount = 0
        await withTaskGroup(of: Int.self) { group in
            for i in 0..<floodCount {
                group.addTask {
                    let body = "{\"event\":\"notification\",\"id\":\(i),\"data\":\"flood_test\"}"
                    var request = URLRequest(url: endpoint.url.appendingPathComponent("notifications/push"))
                    request.httpMethod = "POST"
                    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    if let apiKey = credentials.apiKeys["aws_access_key_id"] { request.setValue(apiKey, forHTTPHeaderField: "X-Api-Key") }
                    request.httpBody = body.data(using: .utf8)
                    request.timeoutInterval = 5
                    do { let (_, response) = try await URLSession.shared.data(for: request); return (response as? HTTPURLResponse)?.statusCode ?? 0 }
                    catch { return 0 }
                }
            }
            for await sc in group {
                if sc == 200 || sc == 201 { acceptedCount += 1 }
                else if sc == 429 || sc == 503 { rejectedCount += 1 }
            }
        }
        let duration = Date().timeIntervalSince(startTime)
        await logger.addEvidence(type: .logOutput, title: "Push Flood Results", content: "Sent: \(floodCount)\nAccepted: \(acceptedCount)\nRejected (429/503): \(rejectedCount)")
        if rejectedCount > 0 {
            await logger.success("[A2A-04.5] Rate limiting detected on push notifications")
            return TestResult(status: .passed, findings: "Push notification rate limiting active. \(rejectedCount)/\(floodCount) requests rate-limited.", evidence: await logger.getEvidence(), remediation: nil, executionLog: await logger.getEntries(), duration: duration)
        }
        if acceptedCount == floodCount {
            return TestResult(status: .failed, findings: "All \(floodCount) push notifications accepted without rate limiting. DoS risk.", evidence: await logger.getEvidence(), remediation: "Implement rate limiting on push notification endpoints. Use token bucket or sliding window algorithms. Return 429 when limits exceeded.", executionLog: await logger.getEntries(), duration: duration)
        }
        return TestResult(status: .passed, findings: "Push flood test: \(acceptedCount) accepted, \(rejectedCount) rate-limited. Some may have failed due to network limits.", evidence: await logger.getEvidence(), remediation: nil, executionLog: await logger.getEntries(), duration: duration)
    }

    private func sendRaw(to url: URL, method: String, headers: [String: String], body: String?, logger: TestLogger) async throws -> (Int, String) {
        var request = URLRequest(url: url); request.httpMethod = method; request.timeoutInterval = 15
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        if let body = body { request.httpBody = body.data(using: .utf8) }
        do { let (data, response) = try await URLSession.shared.data(for: request); return ((response as? HTTPURLResponse)?.statusCode ?? 0, String(data: data, encoding: .utf8) ?? "") }
        catch { return (0, "Error: \(error.localizedDescription)") }
    }
}
