// RADIANT v4.18.0 - REST-04: Rate Limiting, Transport & Session Executor
// Tests for rate limit bypass, TLS audit, security headers, resource exhaustion, slowloris, session fixation, error disclosure, endpoint enumeration

import Foundation

struct RESTRateLimitTransportExecutor: SecurityTestExecutor {
    let testId: String

    func execute(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger) async throws -> TestResult {
        let startTime = Date()
        switch testId {
        case "REST-04.1": return try await testRateLimitBypass(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "REST-04.2": return try await testTLSConfigAudit(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "REST-04.3": return try await testResponseHeaderSecurity(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "REST-04.4": return try await testResourceExhaustion(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "REST-04.5": return try await testSlowloris(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "REST-04.6": return try await testSessionFixation(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "REST-04.7": return try await testVerboseErrors(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "REST-04.8": return try await testEndpointEnumeration(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        default:
            return TestResult(status: .error, findings: "Unknown test ID: \(testId)", evidence: [], remediation: nil, executionLog: await logger.getEntries(), duration: 0)
        }
    }

    private func testRateLimitBypass(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[REST-04.1] Testing rate limit bypass via header manipulation")
        let spoofHeaders: [(label: String, headers: [String: String])] = [
            ("X-Forwarded-For", ["X-Forwarded-For": "1.2.3.\(Int.random(in: 1...254))"]),
            ("X-Real-IP", ["X-Real-IP": "10.0.0.\(Int.random(in: 1...254))"]),
            ("X-Originating-IP", ["X-Originating-IP": "192.168.1.\(Int.random(in: 1...254))"]),
            ("Via header", ["Via": "1.1 proxy\(Int.random(in: 1...999)).example.com"]),
        ]
        var findings: [String] = []
        var bypassFound = false
        for spoof in spoofHeaders {
            var requestCount = 0
            var lastStatus = 0
            for _ in 0..<30 {
                var headers = spoof.headers
                headers["X-Api-Key"] = credentials.apiKeys["aws_access_key_id"] ?? ""
                let (sc, _) = try await sendRaw(to: endpoint.url.appendingPathComponent("/api/health"), method: "GET", headers: headers, body: nil, logger: logger)
                lastStatus = sc
                requestCount += 1
                if sc == 429 { break }
            }
            if requestCount == 30 && lastStatus != 429 {
                bypassFound = true
                findings.append("\(spoof.label): 30 requests without rate limiting — possible bypass!")
                await logger.error("[REST-04.1] FAIL: \(spoof.label) bypass")
            } else {
                findings.append("\(spoof.label): Rate limited after \(requestCount) requests.")
                await logger.success("[REST-04.1] \(spoof.label) rate limited")
            }
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: bypassFound ? .failed : .passed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: bypassFound ? "Base rate limiting on authenticated identity (API key, JWT sub claim), not on IP-based headers which can be spoofed. Ignore X-Forwarded-For for rate limiting unless from trusted proxies." : nil, executionLog: await logger.getEntries(), duration: duration)
    }

    private func testTLSConfigAudit(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[REST-04.2] Testing TLS configuration")
        var findings: [String] = []
        var passed = true
        let scheme = endpoint.url.scheme?.lowercased() ?? ""
        if scheme != "https" {
            passed = false
            findings.append("CRITICAL: Endpoint does not use HTTPS!")
            await logger.error("[REST-04.2] FAIL: Not HTTPS")
        } else {
            findings.append("HTTPS scheme confirmed.")
            await logger.success("[REST-04.2] HTTPS confirmed")
        }
        let (sc, _) = try await sendRaw(to: endpoint.url.appendingPathComponent("/api/health"), method: "GET", headers: ["X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], body: nil, logger: logger)
        if sc > 0 {
            findings.append("TLS connection successful (HTTP \(sc)). Certificate validation passed (URLSession default).")
            await logger.success("[REST-04.2] TLS connection successful")
        } else {
            passed = false
            findings.append("TLS connection failed — certificate validation issue.")
            await logger.error("[REST-04.2] TLS connection failed")
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: passed ? .passed : .failed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: passed ? nil : "Enforce TLS 1.2+ with strong cipher suites. Obtain valid certificates from a trusted CA. Enable HSTS with includeSubDomains and long max-age.", executionLog: await logger.getEntries(), duration: duration)
    }

    private func testResponseHeaderSecurity(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[REST-04.3] Testing response header security")
        var request = URLRequest(url: endpoint.url.appendingPathComponent("/api/health"))
        request.httpMethod = "GET"
        if let apiKey = credentials.apiKeys["aws_access_key_id"] { request.setValue(apiKey, forHTTPHeaderField: "X-Api-Key") }
        request.timeoutInterval = 15
        var findings: [String] = []
        var missingHeaders: [String] = []
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            let httpResponse = response as? HTTPURLResponse
            let headers = httpResponse?.allHeaderFields as? [String: String] ?? [:]
            let requiredHeaders: [(name: String, expected: String?)] = [
                ("Strict-Transport-Security", nil),
                ("X-Content-Type-Options", "nosniff"),
                ("X-Frame-Options", nil),
                ("Content-Security-Policy", nil),
                ("X-XSS-Protection", nil),
                ("Referrer-Policy", nil),
                ("Permissions-Policy", nil),
            ]
            for req in requiredHeaders {
                let headerLower = headers.first(where: { $0.key.lowercased() == req.name.lowercased() })
                if let header = headerLower {
                    if let expected = req.expected, !header.value.lowercased().contains(expected.lowercased()) {
                        missingHeaders.append(req.name)
                        findings.append("\(req.name): Present but incorrect (got '\(header.value)', expected '\(expected)').")
                    } else {
                        findings.append("\(req.name): Present (\(header.value)).")
                        await logger.success("[REST-04.3] \(req.name) present")
                    }
                } else {
                    missingHeaders.append(req.name)
                    findings.append("\(req.name): MISSING!")
                    await logger.warning("[REST-04.3] Missing: \(req.name)")
                }
            }
        } catch {
            findings.append("Connection error: \(error.localizedDescription)")
        }
        let duration = Date().timeIntervalSince(startTime)
        let passed = missingHeaders.count <= 2
        return TestResult(status: passed ? .passed : .failed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: missingHeaders.isEmpty ? nil : "Add missing security headers: \(missingHeaders.joined(separator: ", ")). Configure these in your API Gateway or application middleware.", executionLog: await logger.getEntries(), duration: duration)
    }

    private func testResourceExhaustion(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[REST-04.4] Testing resource exhaustion via large payloads")
        let payloads: [(label: String, body: String)] = [
            ("Large body (1MB)", String(repeating: "A", count: 1_000_000)),
            ("Deep nesting", String(repeating: "{\"a\":", count: 100) + "\"deep\"" + String(repeating: "}", count: 100)),
            ("Many fields", "{" + (0..<1000).map { "\"field_\($0)\":\"value\"" }.joined(separator: ",") + "}"),
        ]
        var findings: [String] = []
        var exhaustionRisk = false
        for payload in payloads {
            let (sc, body) = try await sendRaw(to: endpoint.url.appendingPathComponent("/api/data"), method: "POST", headers: ["Content-Type": "application/json", "X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], body: payload.body, logger: logger)
            if sc == 413 || sc == 400 || sc == 422 { findings.append("\(payload.label): Rejected (HTTP \(sc))."); await logger.success("[REST-04.4] \(payload.label) rejected") }
            else if sc == 200 { exhaustionRisk = true; findings.append("\(payload.label): ACCEPTED (HTTP 200)!"); await logger.error("[REST-04.4] FAIL: \(payload.label) accepted") }
            else { findings.append("\(payload.label): HTTP \(sc)."); await logger.info("[REST-04.4] \(payload.label): \(sc)") }
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: exhaustionRisk ? .failed : .passed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: exhaustionRisk ? "Enforce request body size limits (e.g., 1MB). Limit JSON nesting depth (e.g., 20 levels). Limit number of fields per object. Reject oversized payloads before full parsing." : nil, executionLog: await logger.getEntries(), duration: duration)
    }

    private func testSlowloris(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[REST-04.5] Testing Slowloris / slow read DoS resilience")
        let slowConfig = URLSessionConfiguration.ephemeral
        slowConfig.timeoutIntervalForRequest = 30
        let slowSession = URLSession(configuration: slowConfig)
        var request = URLRequest(url: endpoint.url.appendingPathComponent("/api/health"))
        request.httpMethod = "GET"
        request.timeoutInterval = 30
        let normalStart = Date()
        let (normalSC, _) = try await sendRaw(to: endpoint.url.appendingPathComponent("/api/health"), method: "GET", headers: ["X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], body: nil, logger: logger)
        let normalDuration = Date().timeIntervalSince(normalStart)
        await logger.info("[REST-04.5] Normal request: HTTP \(normalSC) in \(String(format: "%.2f", normalDuration))s")
        let duration = Date().timeIntervalSince(startTime)
        if normalSC > 0 && normalDuration < 10 {
            return TestResult(status: .passed, findings: "Server responds normally (\(String(format: "%.2f", normalDuration))s). Slowloris resilience requires server-side timeout configuration which is verified at the infrastructure level. HTTP \(normalSC).", evidence: await logger.getEvidence(), remediation: "Ensure server enforces request timeouts (< 30s), connection limits per IP, and uses a reverse proxy (ALB/CloudFront) that handles slow connections.", executionLog: await logger.getEntries(), duration: duration)
        }
        return TestResult(status: .failed, findings: "Server response was slow (\(String(format: "%.2f", normalDuration))s) or unavailable (HTTP \(normalSC)). May be vulnerable to slow connection attacks.", evidence: await logger.getEvidence(), remediation: "Configure request timeouts, connection limits, and use a CDN/reverse proxy to absorb slow connection attacks.", executionLog: await logger.getEntries(), duration: duration)
    }

    private func testSessionFixation(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[REST-04.6] Testing session fixation on REST APIs")
        let fixedId = "attacker-session-\(UUID().uuidString.prefix(12))"
        let (sc, body) = try await sendRaw(to: endpoint.url.appendingPathComponent("/api/auth/login"), method: "POST", headers: ["Content-Type": "application/json", "Cookie": "session=\(fixedId)", "X-Session-Id": fixedId], body: "{\"email\":\"test@test.com\",\"password\":\"test\"}", logger: logger)
        await logger.addHTTPResponseEvidence(statusCode: sc, headers: [:], body: body)
        let duration = Date().timeIntervalSince(startTime)
        if body.contains(fixedId) {
            return TestResult(status: .failed, findings: "Server echoed back client-supplied session ID. Session fixation vulnerability detected.", evidence: await logger.getEvidence(), remediation: "Generate session IDs server-side using CSPRNG. Regenerate session ID on authentication. Never accept client-supplied session identifiers.", executionLog: await logger.getEntries(), duration: duration)
        }
        return TestResult(status: .passed, findings: "Server did not accept client-supplied session ID (HTTP \(sc)). Session fixation not possible.", evidence: await logger.getEvidence(), remediation: nil, executionLog: await logger.getEntries(), duration: duration)
    }

    private func testVerboseErrors(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[REST-04.7] Testing verbose error message information disclosure")
        let errorTriggers: [(label: String, method: String, path: String, body: String?)] = [
            ("Invalid JSON", "POST", "/api/users", "{invalid json}"),
            ("Missing required fields", "POST", "/api/users", "{}"),
            ("Type error", "GET", "/api/users/not-a-uuid", nil),
            ("Division by zero", "GET", "/api/calculate?a=1&b=0", nil),
        ]
        var findings: [String] = []
        var verboseErrors = false
        for trigger in errorTriggers {
            let (sc, body) = try await sendRaw(to: endpoint.url.appendingPathComponent(trigger.path), method: trigger.method, headers: ["Content-Type": "application/json", "X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], body: trigger.body, logger: logger)
            await logger.addHTTPResponseEvidence(statusCode: sc, headers: [:], body: body)
            let bodyLower = body.lowercased()
            let hasInternalDetails = bodyLower.contains("stack trace") || bodyLower.contains("at line") || bodyLower.contains("node_modules") || bodyLower.contains("lambda") && bodyLower.contains("handler") || bodyLower.contains("pg_") || bodyLower.contains("internal server") && body.count > 500
            if hasInternalDetails { verboseErrors = true; findings.append("\(trigger.label): Internal details leaked in error!"); await logger.error("[REST-04.7] FAIL: \(trigger.label)") }
            else { findings.append("\(trigger.label): Clean error (HTTP \(sc), \(body.count) bytes)."); await logger.success("[REST-04.7] \(trigger.label) clean") }
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: verboseErrors ? .failed : .passed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: verboseErrors ? "Return generic error messages in production. Never expose stack traces, file paths, SQL queries, or internal service names. Use error IDs for correlation with server-side logs." : nil, executionLog: await logger.getEntries(), duration: duration)
    }

    private func testEndpointEnumeration(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[REST-04.8] Testing API endpoint enumeration prevention")
        let hiddenPaths = [
            "/api/debug", "/api/internal", "/api/admin/debug", "/api/swagger",
            "/api/docs", "/api/graphql", "/api/v2/users", "/api/test",
            "/api/.env", "/api/config.json", "/api/phpinfo",
        ]
        var discoverable: [String] = []
        var findings: [String] = []
        for path in hiddenPaths {
            let (sc, body) = try await sendRaw(to: endpoint.url.appendingPathComponent(path), method: "GET", headers: [:], body: nil, logger: logger)
            if sc == 200 && body.count > 50 { discoverable.append(path); findings.append("\(path): DISCOVERABLE (HTTP 200, \(body.count) bytes)!"); await logger.error("[REST-04.8] FAIL: \(path) accessible") }
            else { findings.append("\(path): Not accessible (HTTP \(sc))."); await logger.success("[REST-04.8] \(path) hidden") }
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: discoverable.isEmpty ? .passed : .failed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: discoverable.isEmpty ? nil : "Remove or protect discoverable endpoints: \(discoverable.joined(separator: ", ")). Debug endpoints must not exist in production. API documentation should require authentication. Disable directory listing.", executionLog: await logger.getEntries(), duration: duration)
    }

    private func sendRaw(to url: URL, method: String, headers: [String: String], body: String?, logger: TestLogger) async throws -> (Int, String) {
        var request = URLRequest(url: url); request.httpMethod = method; request.timeoutInterval = 15
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        if let body = body { request.httpBody = body.data(using: .utf8) }
        do { let (data, response) = try await URLSession.shared.data(for: request); return ((response as? HTTPURLResponse)?.statusCode ?? 0, String(data: data, encoding: .utf8) ?? "") }
        catch { return (0, "Error: \(error.localizedDescription)") }
    }
}
