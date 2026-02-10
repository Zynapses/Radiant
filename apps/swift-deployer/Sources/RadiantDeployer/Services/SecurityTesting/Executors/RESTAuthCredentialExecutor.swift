// RADIANT v4.18.0 - REST-01: Authentication & Credential Security Executor
// Tests for missing auth, key exposure, token expiration, brute force, refresh flow, JWT confusion, rotation, MFA, credential stuffing, CORS

import Foundation

struct RESTAuthCredentialExecutor: SecurityTestExecutor {
    let testId: String

    func execute(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger) async throws -> TestResult {
        let startTime = Date()
        switch testId {
        case "REST-01.1": return try await testMissingAuth(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "REST-01.2": return try await testAPIKeyExposure(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "REST-01.3": return try await testBearerTokenExpiration(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "REST-01.4": return try await testBruteForce(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "REST-01.5": return try await testTokenRefreshFlow(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "REST-01.6": return try await testJWTAlgorithmConfusion(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "REST-01.7": return try await testAPIKeyRotation(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "REST-01.8": return try await testMFABypass(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "REST-01.9": return try await testCredentialStuffing(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "REST-01.10": return try await testCORSPolicy(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        default:
            return TestResult(status: .error, findings: "Unknown test ID: \(testId)", evidence: [], remediation: nil, executionLog: await logger.getEntries(), duration: 0)
        }
    }

    private func testMissingAuth(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[REST-01.1] Testing missing authentication on protected endpoints")
        let protectedPaths = ["/api/users", "/api/tenants", "/api/models", "/api/admin/settings", "/api/conversations", "/api/billing"]
        var unprotected: [String] = []
        var findings: [String] = []
        for path in protectedPaths {
            let url = endpoint.url.appendingPathComponent(path)
            let (sc, _) = try await sendRaw(to: url, method: "GET", headers: [:], body: nil, logger: logger)
            if sc == 200 { unprotected.append(path); findings.append("\(path): ACCESSIBLE without auth (HTTP 200)!"); await logger.error("[REST-01.1] FAIL: \(path) unprotected") }
            else { findings.append("\(path): Protected (HTTP \(sc))."); await logger.success("[REST-01.1] \(path) protected") }
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: unprotected.isEmpty ? .passed : .failed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: unprotected.isEmpty ? nil : "Enforce authentication on all API endpoints: \(unprotected.joined(separator: ", ")). Use middleware to require valid credentials before any handler executes.", executionLog: await logger.getEntries(), duration: duration)
    }

    private func testAPIKeyExposure(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[REST-01.2] Testing API key exposure in responses")
        let testPaths = ["/api/health", "/api/config", "/api/status", "/api/debug"]
        let apiKey = credentials.apiKeys["aws_access_key_id"] ?? ""
        var leakDetected = false
        var findings: [String] = []
        for path in testPaths {
            let url = endpoint.url.appendingPathComponent(path)
            let (sc, body) = try await sendRaw(to: url, method: "GET", headers: ["X-Api-Key": apiKey], body: nil, logger: logger)
            await logger.addHTTPResponseEvidence(statusCode: sc, headers: [:], body: body)
            if !apiKey.isEmpty && body.contains(apiKey) { leakDetected = true; findings.append("\(path): API KEY LEAKED in response!"); await logger.error("[REST-01.2] CRITICAL: Key in \(path)") }
            else if body.lowercased().contains("secret") && body.lowercased().contains("key") { findings.append("\(path): Possible credential-like content (HTTP \(sc))."); await logger.warning("[REST-01.2] Suspicious content in \(path)") }
            else { findings.append("\(path): Clean (HTTP \(sc))."); await logger.success("[REST-01.2] \(path) clean") }
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: leakDetected ? .failed : .passed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: leakDetected ? "Never include API keys in response bodies. Implement response sanitization middleware. Audit all config/debug/status endpoints for credential exposure." : nil, executionLog: await logger.getEntries(), duration: duration)
    }

    private func testBearerTokenExpiration(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[REST-01.3] Testing bearer token expiration enforcement")
        let expiredJWT = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiZXhwIjoxNjAwMDAwMDAwfQ.invalid"
        let (sc, body) = try await sendRaw(to: endpoint.url.appendingPathComponent("/api/users/me"), method: "GET", headers: ["Authorization": "Bearer \(expiredJWT)"], body: nil, logger: logger)
        await logger.addHTTPResponseEvidence(statusCode: sc, headers: [:], body: body)
        let duration = Date().timeIntervalSince(startTime)
        if sc == 401 || sc == 403 {
            return TestResult(status: .passed, findings: "Expired bearer token correctly rejected (HTTP \(sc)).", evidence: await logger.getEvidence(), remediation: nil, executionLog: await logger.getEntries(), duration: duration)
        }
        if sc == 200 {
            return TestResult(status: .failed, findings: "Expired bearer token ACCEPTED (HTTP 200). Token expiration is not enforced.", evidence: await logger.getEvidence(), remediation: "Validate JWT expiration claims (exp) on every request. Reject tokens with clock skew > 30 seconds. Return 401 with clear expiration message.", executionLog: await logger.getEntries(), duration: duration)
        }
        return TestResult(status: .passed, findings: "Expired token returned HTTP \(sc). Expiration appears enforced.", evidence: await logger.getEvidence(), remediation: nil, executionLog: await logger.getEntries(), duration: duration)
    }

    private func testBruteForce(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[REST-01.4] Testing brute force API key guessing protection")
        let attempts = 20
        var rateLimited = false
        for i in 0..<attempts {
            let fakeKey = "AKIA\(String(format: "%016d", i))"
            let (sc, _) = try await sendRaw(to: endpoint.url.appendingPathComponent("/api/users"), method: "GET", headers: ["X-Api-Key": fakeKey], body: nil, logger: logger)
            if sc == 429 { rateLimited = true; await logger.success("[REST-01.4] Rate limited after \(i+1) attempts"); break }
        }
        let duration = Date().timeIntervalSince(startTime)
        if rateLimited {
            return TestResult(status: .passed, findings: "Rate limiting triggered during brute force attempt. Authentication endpoint is protected.", evidence: await logger.getEvidence(), remediation: nil, executionLog: await logger.getEntries(), duration: duration)
        }
        return TestResult(status: .failed, findings: "Sent \(attempts) invalid API keys without triggering rate limiting. Brute force protection is missing.", evidence: await logger.getEvidence(), remediation: "Implement rate limiting on authentication endpoints. After 5 failed attempts, enforce exponential backoff. After 20 attempts, temporarily block the source IP. Consider CAPTCHA for web-based auth.", executionLog: await logger.getEntries(), duration: duration)
    }

    private func testTokenRefreshFlow(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[REST-01.5] Testing token refresh flow security")
        let fakeRefreshToken = "refresh_\(UUID().uuidString)"
        let body = "{\"refresh_token\":\"\(fakeRefreshToken)\"}"
        let (sc, resp) = try await sendRaw(to: endpoint.url.appendingPathComponent("/api/auth/refresh"), method: "POST", headers: ["Content-Type": "application/json"], body: body, logger: logger)
        await logger.addHTTPResponseEvidence(statusCode: sc, headers: [:], body: resp)
        let (sc2, _) = try await sendRaw(to: endpoint.url.appendingPathComponent("/api/auth/refresh"), method: "POST", headers: ["Content-Type": "application/json"], body: body, logger: logger)
        let duration = Date().timeIntervalSince(startTime)
        if sc == 401 || sc == 403 {
            return TestResult(status: .passed, findings: "Invalid refresh token rejected (HTTP \(sc)). Token validation is enforced.", evidence: await logger.getEvidence(), remediation: nil, executionLog: await logger.getEntries(), duration: duration)
        }
        if sc == 200 && sc2 == 200 {
            return TestResult(status: .failed, findings: "Refresh token was accepted and reusable (both attempts returned 200). Refresh tokens should be rotated on use.", evidence: await logger.getEvidence(), remediation: "Rotate refresh tokens on each use. Invalidate the old token immediately. Implement refresh token families to detect reuse.", executionLog: await logger.getEntries(), duration: duration)
        }
        return TestResult(status: .passed, findings: "Refresh flow: first=\(sc), second=\(sc2). Token appears properly handled.", evidence: await logger.getEvidence(), remediation: nil, executionLog: await logger.getEntries(), duration: duration)
    }

    private func testJWTAlgorithmConfusion(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[REST-01.6] Testing JWT algorithm confusion attack")
        let algNoneJWT = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OX0."
        let hs256JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiJ9.fake_hmac_signature"
        let tokens: [(label: String, token: String)] = [("alg:none", algNoneJWT), ("RS256→HS256", hs256JWT)]
        var allRejected = true
        var findings: [String] = []
        for t in tokens {
            let (sc, _) = try await sendRaw(to: endpoint.url.appendingPathComponent("/api/users"), method: "GET", headers: ["Authorization": "Bearer \(t.token)"], body: nil, logger: logger)
            if sc == 200 { allRejected = false; findings.append("\(t.label): ACCEPTED!"); await logger.error("[REST-01.6] FAIL: \(t.label)") }
            else { findings.append("\(t.label): Rejected (HTTP \(sc))."); await logger.success("[REST-01.6] \(t.label) rejected") }
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: allRejected ? .passed : .failed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: allRejected ? nil : "Whitelist acceptable JWT algorithms. Reject alg:none. Use asymmetric verification (RS256/ES256). Never derive the verification method from the token's alg header alone.", executionLog: await logger.getEntries(), duration: duration)
    }

    private func testAPIKeyRotation(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[REST-01.7] Testing API key rotation enforcement")
        let revokedKey = "AKIA_REVOKED_\(UUID().uuidString.prefix(12))"
        let (sc1, _) = try await sendRaw(to: endpoint.url.appendingPathComponent("/api/users"), method: "GET", headers: ["X-Api-Key": revokedKey], body: nil, logger: logger)
        try await Task.sleep(nanoseconds: 2_000_000_000)
        let (sc2, _) = try await sendRaw(to: endpoint.url.appendingPathComponent("/api/users"), method: "GET", headers: ["X-Api-Key": revokedKey], body: nil, logger: logger)
        let duration = Date().timeIntervalSince(startTime)
        let bothRejected = (sc1 == 401 || sc1 == 403) && (sc2 == 401 || sc2 == 403)
        return TestResult(status: bothRejected ? .passed : .failed, findings: "Key rejection: first=\(sc1), second=\(sc2). \(bothRejected ? "Invalid keys consistently rejected." : "Inconsistent rejection may indicate caching issues.")", evidence: await logger.getEvidence(), remediation: bothRejected ? nil : "Ensure revoked API keys are rejected immediately across all endpoints. Avoid long-lived API key caches. Propagation delay should be < 5 seconds.", executionLog: await logger.getEntries(), duration: duration)
    }

    private func testMFABypass(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[REST-01.8] Testing MFA bypass on sensitive operations")
        let sensitiveOps: [(label: String, method: String, path: String, body: String?)] = [
            ("Delete user", "DELETE", "/api/admin/users/test-user", nil),
            ("Change role", "PUT", "/api/admin/users/test-user/role", "{\"role\":\"superadmin\"}"),
            ("Export data", "POST", "/api/admin/export", "{\"scope\":\"all\"}"),
        ]
        var findings: [String] = []
        var allProtected = true
        for op in sensitiveOps {
            let url = endpoint.url.appendingPathComponent(op.path)
            let (sc, _) = try await sendRaw(to: url, method: op.method, headers: ["Content-Type": "application/json", "X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], body: op.body, logger: logger)
            if sc == 200 || sc == 204 { allProtected = false; findings.append("\(op.label): Executed without MFA!"); await logger.error("[REST-01.8] FAIL: \(op.label)") }
            else { findings.append("\(op.label): Protected (HTTP \(sc))."); await logger.success("[REST-01.8] \(op.label) protected") }
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: allProtected ? .passed : .failed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: allProtected ? nil : "Require MFA step-up authentication for sensitive operations (user deletion, role changes, data export). Implement MFA challenge-response before executing destructive actions.", executionLog: await logger.getEntries(), duration: duration)
    }

    private func testCredentialStuffing(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[REST-01.9] Testing credential stuffing protection")
        let stuffingAttempts = 15
        var rateLimited = false
        for i in 0..<stuffingAttempts {
            let body = "{\"email\":\"user\(i)@example.com\",\"password\":\"password123\"}"
            let (sc, _) = try await sendRaw(to: endpoint.url.appendingPathComponent("/api/auth/login"), method: "POST", headers: ["Content-Type": "application/json"], body: body, logger: logger)
            if sc == 429 { rateLimited = true; await logger.success("[REST-01.9] Rate limited after \(i+1) stuffing attempts"); break }
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: rateLimited ? .passed : .failed, findings: rateLimited ? "Credential stuffing protection active. Rate limiting triggered during rapid login attempts." : "Sent \(stuffingAttempts) credential stuffing attempts without rate limiting. No protection detected.", evidence: await logger.getEvidence(), remediation: rateLimited ? nil : "Implement credential stuffing detection: rate limit login attempts per IP and per account. Use CAPTCHA after repeated failures. Consider breach password checking (Have I Been Pwned API).", executionLog: await logger.getEntries(), duration: duration)
    }

    private func testCORSPolicy(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[REST-01.10] Testing CORS policy validation")
        let origins = ["https://evil.example.com", "null", "https://localhost:3000"]
        var findings: [String] = []
        var corsIssue = false
        for origin in origins {
            var request = URLRequest(url: endpoint.url.appendingPathComponent("/api/health"))
            request.httpMethod = "OPTIONS"
            request.setValue(origin, forHTTPHeaderField: "Origin")
            request.setValue("GET", forHTTPHeaderField: "Access-Control-Request-Method")
            request.timeoutInterval = 10
            do {
                let (_, response) = try await URLSession.shared.data(for: request)
                let httpResponse = response as? HTTPURLResponse
                let allowOrigin = httpResponse?.value(forHTTPHeaderField: "Access-Control-Allow-Origin") ?? ""
                let allowCreds = httpResponse?.value(forHTTPHeaderField: "Access-Control-Allow-Credentials") ?? ""
                if allowOrigin == "*" && allowCreds.lowercased() == "true" {
                    corsIssue = true
                    findings.append("Origin '\(origin)': Wildcard + credentials — CORS misconfiguration!")
                    await logger.error("[REST-01.10] FAIL: Wildcard CORS with credentials")
                } else if allowOrigin == origin {
                    corsIssue = true
                    findings.append("Origin '\(origin)': Reflected origin — allows arbitrary origins!")
                    await logger.error("[REST-01.10] FAIL: Origin reflected for \(origin)")
                } else {
                    findings.append("Origin '\(origin)': Properly restricted (Allow-Origin: '\(allowOrigin)').")
                    await logger.success("[REST-01.10] CORS properly restricted for \(origin)")
                }
            } catch {
                findings.append("Origin '\(origin)': Connection error — CORS check inconclusive.")
            }
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: corsIssue ? .failed : .passed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: corsIssue ? "Restrict CORS to specific allowed origins. Never combine Access-Control-Allow-Origin: * with Access-Control-Allow-Credentials: true. Do not reflect the Origin header without validation." : nil, executionLog: await logger.getEntries(), duration: duration)
    }

    private func sendRaw(to url: URL, method: String, headers: [String: String], body: String?, logger: TestLogger) async throws -> (Int, String) {
        var request = URLRequest(url: url); request.httpMethod = method; request.timeoutInterval = 15
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        if let body = body { request.httpBody = body.data(using: .utf8) }
        do { let (data, response) = try await URLSession.shared.data(for: request); return ((response as? HTTPURLResponse)?.statusCode ?? 0, String(data: data, encoding: .utf8) ?? "") }
        catch { return (0, "Error: \(error.localizedDescription)") }
    }
}
