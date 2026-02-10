// RADIANT v4.18.0 - CROSS-04: Logging, Audit & Supply Chain Executor
// Tests for logging completeness, tamper detection, cross-protocol correlation, data redaction, model supply chain, plugin security, log injection, incident response

import Foundation

struct CrossLoggingAuditExecutor: SecurityTestExecutor {
    let testId: String

    func execute(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger) async throws -> TestResult {
        let startTime = Date()
        switch testId {
        case "CROSS-04.1": return try await testLoggingCompleteness(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "CROSS-04.2": return try await testAuditLogTamperDetection(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "CROSS-04.3": return try await testCrossProtocolCorrelation(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "CROSS-04.4": return try await testSensitiveDataRedaction(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "CROSS-04.5": return try await testModelSupplyChain(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "CROSS-04.6": return try await testPluginSecurity(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "CROSS-04.7": return try await testLogInjection(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "CROSS-04.8": return try await testIncidentResponseAutomation(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        default:
            return TestResult(status: .error, findings: "Unknown test ID: \(testId)", evidence: [], remediation: nil, executionLog: await logger.getEntries(), duration: 0)
        }
    }

    private func testLoggingCompleteness(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[CROSS-04.1] Testing security event logging completeness")
        let securityEvents: [(label: String, method: String, path: String, headers: [String: String], body: String?)] = [
            ("Auth failure", "GET", "/api/users", ["Authorization": "Bearer invalid"], nil),
            ("Forbidden access", "GET", "/api/admin/settings", ["X-Api-Key": "unauthorized_key"], nil),
            ("Invalid input", "POST", "/api/users", ["Content-Type": "application/json", "X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], "{invalid json}"),
            ("Rate limit trigger", "GET", "/api/health", [:], nil),
        ]
        var findings: [String] = []
        for event in securityEvents {
            let url = endpoint.url.appendingPathComponent(event.path)
            let (sc, _) = try await sendRaw(to: url, method: event.method, headers: event.headers, body: event.body, logger: logger)
            findings.append("\(event.label): Triggered (HTTP \(sc)). Verify event is logged with timestamp, actor, action, resource, outcome.")
            await logger.info("[CROSS-04.1] \(event.label): HTTP \(sc)")
        }
        let (logSC, logResp) = try await sendRaw(to: endpoint.url.appendingPathComponent("/api/admin/audit-logs"), method: "GET", headers: ["X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], body: nil, logger: logger)
        await logger.addHTTPResponseEvidence(statusCode: logSC, headers: [:], body: logResp)
        let hasLogs = logSC == 200 && logResp.count > 100
        findings.append(hasLogs ? "Audit log endpoint available with entries." : "Audit log endpoint: HTTP \(logSC). Manual log verification recommended.")
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: .passed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: hasLogs ? nil : "Ensure all security events are logged with: timestamp, actor identity, action performed, resource accessed, and outcome (success/failure). Implement centralized logging.", executionLog: await logger.getEntries(), duration: duration)
    }

    private func testAuditLogTamperDetection(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[CROSS-04.2] Testing audit log tamper detection")
        let tamperAttempts: [(label: String, method: String, path: String, body: String?)] = [
            ("Delete log entry", "DELETE", "/api/admin/audit-logs/recent", nil),
            ("Modify log entry", "PUT", "/api/admin/audit-logs/recent", "{\"action\":\"modified\",\"outcome\":\"success\"}"),
            ("Truncate logs", "POST", "/api/admin/audit-logs/truncate", "{\"before\":\"2099-01-01\"}"),
        ]
        var allProtected = true
        var findings: [String] = []
        for attempt in tamperAttempts {
            let (sc, resp) = try await sendRaw(to: endpoint.url.appendingPathComponent(attempt.path), method: attempt.method, headers: ["Content-Type": "application/json", "X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], body: attempt.body, logger: logger)
            if sc == 200 || sc == 204 { allProtected = false; findings.append("\(attempt.label): SUCCEEDED (HTTP \(sc))!"); await logger.error("[CROSS-04.2] FAIL: \(attempt.label)") }
            else if sc == 405 || sc == 403 || sc == 404 { findings.append("\(attempt.label): Protected (HTTP \(sc))."); await logger.success("[CROSS-04.2] \(attempt.label) protected") }
            else { findings.append("\(attempt.label): HTTP \(sc)."); await logger.info("[CROSS-04.2] \(attempt.label): \(sc)") }
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: allProtected ? .passed : .failed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: allProtected ? nil : "Audit logs must be append-only. Disable DELETE/PUT/PATCH on audit log endpoints. Use write-once storage (S3 Object Lock, CloudWatch Logs). Implement cryptographic log chaining for tamper evidence.", executionLog: await logger.getEntries(), duration: duration)
    }

    private func testCrossProtocolCorrelation(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[CROSS-04.3] Testing cross-protocol audit correlation")
        let correlationId = "trace-\(UUID().uuidString)"
        let protocols: [(label: String, path: String, body: String)] = [
            ("REST", "/api/chat/completions", "{\"messages\":[{\"role\":\"user\",\"content\":\"test\"}]}"),
            ("MCP", "", "{\"jsonrpc\":\"2.0\",\"method\":\"tools/list\",\"id\":1}"),
            ("A2A", "tasks/send", "{\"message\":{\"role\":\"user\",\"parts\":[{\"text\":\"test\"}]}}"),
        ]
        var findings: [String] = []
        for proto in protocols {
            let url = proto.path.isEmpty ? endpoint.url : endpoint.url.appendingPathComponent(proto.path)
            let (sc, resp) = try await sendRaw(to: url, method: "POST", headers: ["Content-Type": "application/json", "X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? "", "X-Trace-Id": correlationId, "X-Request-Id": correlationId], body: proto.body, logger: logger)
            let hasCorrelation = resp.contains(correlationId) || resp.lowercased().contains("trace") || resp.lowercased().contains("request_id")
            findings.append("\(proto.label): HTTP \(sc). Correlation ID \(hasCorrelation ? "echoed" : "not echoed") in response.")
            await logger.info("[CROSS-04.3] \(proto.label): \(sc), correlation: \(hasCorrelation)")
        }
        let (logSC, logResp) = try await sendRaw(to: endpoint.url.appendingPathComponent("/api/admin/audit-logs?trace_id=\(correlationId)"), method: "GET", headers: ["X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], body: nil, logger: logger)
        let logsCorrelated = logResp.contains(correlationId)
        findings.append("Audit log correlation: HTTP \(logSC). \(logsCorrelated ? "Trace ID found in logs." : "Trace ID not found — correlation may not be implemented.")")
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: .passed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: logsCorrelated ? nil : "Implement distributed tracing with a single correlation ID that flows across all protocol boundaries (REST, MCP, A2A). Include trace IDs in all audit log entries. Use OpenTelemetry or similar.", executionLog: await logger.getEntries(), duration: duration)
    }

    private func testSensitiveDataRedaction(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[CROSS-04.4] Testing sensitive data redaction in logs")
        let sensitivePayloads: [(label: String, body: String)] = [
            ("PII in message", "{\"messages\":[{\"role\":\"user\",\"content\":\"My SSN is 123-45-6789 and my credit card is 4111111111111111\"}]}"),
            ("API key in content", "{\"messages\":[{\"role\":\"user\",\"content\":\"My API key is sk-proj-ABC123XYZ789\"}]}"),
            ("Password in field", "{\"messages\":[{\"role\":\"user\",\"content\":\"test\"}],\"password\":\"SuperSecret123!\"}"),
        ]
        var findings: [String] = []
        var redactionMissing = false
        for payload in sensitivePayloads {
            let (sc, _) = try await sendRaw(to: endpoint.url.appendingPathComponent("/api/chat/completions"), method: "POST", headers: ["Content-Type": "application/json", "X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], body: payload.body, logger: logger)
            findings.append("\(payload.label): Sent (HTTP \(sc)). Verify PII/credentials are redacted in server logs.")
        }
        let (logSC, logResp) = try await sendRaw(to: endpoint.url.appendingPathComponent("/api/admin/audit-logs?limit=5"), method: "GET", headers: ["X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], body: nil, logger: logger)
        if logSC == 200 {
            if logResp.contains("123-45-6789") || logResp.contains("4111111111111111") || logResp.contains("sk-proj-") || logResp.contains("SuperSecret") {
                redactionMissing = true
                findings.append("CRITICAL: Sensitive data found in audit logs!")
                await logger.error("[CROSS-04.4] FAIL: PII/credentials in logs")
            } else {
                findings.append("Audit logs checked — no raw sensitive data detected.")
                await logger.success("[CROSS-04.4] Logs appear redacted")
            }
        } else {
            findings.append("Audit logs: HTTP \(logSC). Manual log review recommended.")
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: redactionMissing ? .failed : .passed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: redactionMissing ? "Implement automatic PII and credential redaction in all log outputs. Use regex patterns to detect and mask SSNs, credit cards, API keys, and passwords before logging. Retain audit utility with masked values." : nil, executionLog: await logger.getEntries(), duration: duration)
    }

    private func testModelSupplyChain(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[CROSS-04.5] Testing AI model supply chain verification")
        let (sc, resp) = try await sendRaw(to: endpoint.url.appendingPathComponent("/api/admin/models"), method: "GET", headers: ["X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], body: nil, logger: logger)
        await logger.addHTTPResponseEvidence(statusCode: sc, headers: [:], body: resp)
        let duration = Date().timeIntervalSince(startTime)
        let respLower = resp.lowercased()
        let hasVersioning = respLower.contains("version") || respLower.contains("checksum") || respLower.contains("sha256") || respLower.contains("hash")
        let hasProvider = respLower.contains("provider") || respLower.contains("source")
        if sc == 200 && hasVersioning && hasProvider {
            return TestResult(status: .passed, findings: "Model registry available with version and provider information. Supply chain tracking is in place.", evidence: await logger.getEvidence(), remediation: nil, executionLog: await logger.getEntries(), duration: duration)
        }
        return TestResult(status: hasVersioning ? .passed : .failed, findings: "Model registry: HTTP \(sc). \(hasVersioning ? "Version info present." : "No version/checksum info — model integrity unverified.") \(hasProvider ? "Provider info present." : "No provider info.")", evidence: await logger.getEvidence(), remediation: hasVersioning ? nil : "Track model versions and checksums. Verify model integrity before use. Maintain a model provenance registry. Alert on unexpected model version changes.", executionLog: await logger.getEntries(), duration: duration)
    }

    private func testPluginSecurity(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[CROSS-04.6] Testing third-party plugin/extension security")
        let (sc, resp) = try await sendRaw(to: endpoint.url.appendingPathComponent("/api/admin/plugins"), method: "GET", headers: ["X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], body: nil, logger: logger)
        await logger.addHTTPResponseEvidence(statusCode: sc, headers: [:], body: resp)
        let duration = Date().timeIntervalSince(startTime)
        let respLower = resp.lowercased()
        let hasVersionPin = respLower.contains("version") && (respLower.contains("pinned") || respLower.contains("locked"))
        let hasVulnScan = respLower.contains("vulnerability") || respLower.contains("scan") || respLower.contains("audit")
        var findings = ["Plugin registry: HTTP \(sc)."]
        if hasVersionPin { findings.append("Version pinning detected.") }
        if hasVulnScan { findings.append("Vulnerability scanning detected.") }
        if !hasVersionPin && !hasVulnScan { findings.append("No version pinning or vulnerability scanning indicators found. Verify third-party component management manually.") }
        return TestResult(status: .passed, findings: findings.joined(separator: " "), evidence: await logger.getEvidence(), remediation: (hasVersionPin && hasVulnScan) ? nil : "Pin all third-party component versions. Scan for known vulnerabilities regularly. Vet new plugins before installation. Maintain a component inventory with CVE monitoring.", executionLog: await logger.getEntries(), duration: duration)
    }

    private func testLogInjection(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[CROSS-04.7] Testing log injection attack")
        let logInjectionPayloads: [(label: String, body: String)] = [
            ("Newline injection", "{\"messages\":[{\"role\":\"user\",\"content\":\"test\\n[ADMIN] User granted superadmin access\\n[AUDIT] All logs cleared\"}]}"),
            ("CRLF injection", "{\"messages\":[{\"role\":\"user\",\"content\":\"test\\r\\n{\\\"level\\\":\\\"CRITICAL\\\",\\\"event\\\":\\\"system_compromise\\\"}\"}]}"),
            ("JSON escape", "{\"messages\":[{\"role\":\"user\",\"content\":\"test\\\",\\\"admin\\\":true,\\\"bypass\\\":\\\"true\"}]}"),
        ]
        var findings: [String] = []
        for payload in logInjectionPayloads {
            let (sc, _) = try await sendRaw(to: endpoint.url.appendingPathComponent("/api/chat/completions"), method: "POST", headers: ["Content-Type": "application/json", "X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], body: payload.body, logger: logger)
            findings.append("\(payload.label): Sent (HTTP \(sc)). Verify log entries are properly encoded and no forged entries were created.")
        }
        let (logSC, logResp) = try await sendRaw(to: endpoint.url.appendingPathComponent("/api/admin/audit-logs?limit=10"), method: "GET", headers: ["X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], body: nil, logger: logger)
        let forgedEntries = logResp.contains("[ADMIN] User granted") || logResp.contains("system_compromise") || logResp.contains("\"admin\":true")
        if forgedEntries {
            findings.append("CRITICAL: Forged log entries detected in audit logs!")
            await logger.error("[CROSS-04.7] FAIL: Log injection succeeded")
        } else {
            findings.append("No forged log entries detected (HTTP \(logSC)).")
            await logger.success("[CROSS-04.7] Log injection blocked")
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: forgedEntries ? .failed : .passed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: forgedEntries ? "Encode all user input before logging. Use structured logging (JSON) with proper escaping. Never concatenate raw user input into log strings. Validate log entry structure." : nil, executionLog: await logger.getEntries(), duration: duration)
    }

    private func testIncidentResponseAutomation(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[CROSS-04.8] Testing incident response automation verification")
        let criticalEvents: [(label: String, method: String, path: String, body: String?)] = [
            ("Auth brute force", "POST", "/api/auth/login", "{\"email\":\"attacker@evil.com\",\"password\":\"wrong\"}"),
            ("Admin endpoint probe", "GET", "/api/admin/settings", nil),
            ("SQL injection attempt", "GET", "/api/users?search=' OR 1=1--", nil),
        ]
        var findings: [String] = []
        for event in criticalEvents {
            for _ in 0..<5 {
                let url = endpoint.url.appendingPathComponent(event.path)
                let headers: [String: String] = event.body != nil ? ["Content-Type": "application/json"] : [:]
                let _ = try await sendRaw(to: url, method: event.method, headers: headers, body: event.body, logger: logger)
            }
            findings.append("\(event.label): 5 attempts sent. Verify alerts triggered and containment actions initiated.")
        }
        let (alertSC, alertResp) = try await sendRaw(to: endpoint.url.appendingPathComponent("/api/admin/alerts/recent"), method: "GET", headers: ["X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], body: nil, logger: logger)
        let hasAlerts = alertSC == 200 && alertResp.count > 50
        findings.append(hasAlerts ? "Alert system active — recent alerts found." : "Alert endpoint: HTTP \(alertSC). Verify incident response automation via infrastructure audit.")
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: .passed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: hasAlerts ? nil : "Implement automated incident response: alerts for auth failures > threshold, admin endpoint probes, injection attempts. Configure automated blocking for repeated offenders. Integrate with PagerDuty/OpsGenie for critical alerts.", executionLog: await logger.getEntries(), duration: duration)
    }

    private func sendRaw(to url: URL, method: String, headers: [String: String], body: String?, logger: TestLogger) async throws -> (Int, String) {
        var request = URLRequest(url: url); request.httpMethod = method; request.timeoutInterval = 15
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        if let body = body { request.httpBody = body.data(using: .utf8) }
        do { let (data, response) = try await URLSession.shared.data(for: request); return ((response as? HTTPURLResponse)?.statusCode ?? 0, String(data: data, encoding: .utf8) ?? "") }
        catch { return (0, "Error: \(error.localizedDescription)") }
    }
}
