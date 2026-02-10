// RADIANT v4.18.0 - REST-02: Authorization & Access Control Executor
// Tests for BOLA/IDOR, function-level authz, horizontal/vertical escalation, mass assignment, tenant isolation, method override

import Foundation

struct RESTAuthorizationExecutor: SecurityTestExecutor {
    let testId: String

    func execute(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger) async throws -> TestResult {
        let startTime = Date()
        switch testId {
        case "REST-02.1": return try await testBOLA(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "REST-02.2": return try await testFunctionLevelAuthZ(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "REST-02.3": return try await testHorizontalEscalation(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "REST-02.4": return try await testVerticalEscalation(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "REST-02.5": return try await testMassAssignment(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "REST-02.6": return try await testTenantIsolation(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        case "REST-02.7": return try await testHTTPMethodOverride(endpoint: endpoint, credentials: credentials, logger: logger, startTime: startTime)
        default:
            return TestResult(status: .error, findings: "Unknown test ID: \(testId)", evidence: [], remediation: nil, executionLog: await logger.getEntries(), duration: 0)
        }
    }

    private func testBOLA(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[REST-02.1] Testing Broken Object Level Authorization (BOLA/IDOR)")
        let objectPaths = [
            "/api/users/other-user-id-12345",
            "/api/conversations/other-conv-id-12345",
            "/api/documents/other-doc-id-12345",
            "/api/billing/invoices/other-invoice-12345",
        ]
        var accessible: [String] = []
        var findings: [String] = []
        for path in objectPaths {
            let (sc, body) = try await sendRaw(to: endpoint.url.appendingPathComponent(path), method: "GET", headers: ["X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], body: nil, logger: logger)
            if sc == 200 && body.count > 50 { accessible.append(path); findings.append("\(path): ACCESSIBLE (HTTP 200, \(body.count) bytes)!"); await logger.error("[REST-02.1] FAIL: \(path)") }
            else { findings.append("\(path): Protected (HTTP \(sc))."); await logger.success("[REST-02.1] \(path) protected") }
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: accessible.isEmpty ? .passed : .failed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: accessible.isEmpty ? nil : "Validate object ownership on every API request. Check that the authenticated user has permission to access the specific object ID in the URL. Return 404 (not 403) to prevent information disclosure.", executionLog: await logger.getEntries(), duration: duration)
    }

    private func testFunctionLevelAuthZ(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[REST-02.2] Testing function level authorization bypass")
        let adminEndpoints = [
            "/api/admin/users", "/api/admin/tenants", "/api/admin/settings",
            "/api/admin/billing", "/api/admin/models/config", "/api/admin/audit-logs",
        ]
        var accessible: [String] = []
        var findings: [String] = []
        let regularUserToken = "regular_user_token_\(UUID().uuidString.prefix(8))"
        for path in adminEndpoints {
            let (sc, _) = try await sendRaw(to: endpoint.url.appendingPathComponent(path), method: "GET", headers: ["Authorization": "Bearer \(regularUserToken)"], body: nil, logger: logger)
            if sc == 200 { accessible.append(path); findings.append("\(path): Admin endpoint ACCESSIBLE with regular token!"); await logger.error("[REST-02.2] FAIL: \(path)") }
            else { findings.append("\(path): Protected (HTTP \(sc))."); await logger.success("[REST-02.2] \(path) protected") }
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: accessible.isEmpty ? .passed : .failed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: accessible.isEmpty ? nil : "Enforce role-based access control on all admin endpoints. Regular user tokens must not access admin functions. Implement middleware that checks role claims before routing to admin handlers.", executionLog: await logger.getEntries(), duration: duration)
    }

    private func testHorizontalEscalation(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[REST-02.3] Testing horizontal privilege escalation")
        let userAPaths = ["/api/users/user-a-id/profile", "/api/users/user-a-id/settings", "/api/users/user-a-id/api-keys"]
        var findings: [String] = []
        var escalationFound = false
        let userBToken = "user_b_token_\(UUID().uuidString.prefix(8))"
        for path in userAPaths {
            let (sc, body) = try await sendRaw(to: endpoint.url.appendingPathComponent(path), method: "GET", headers: ["Authorization": "Bearer \(userBToken)"], body: nil, logger: logger)
            if sc == 200 && body.count > 50 { escalationFound = true; findings.append("\(path): User B accessed User A's data!"); await logger.error("[REST-02.3] FAIL: \(path)") }
            else { findings.append("\(path): Isolated (HTTP \(sc))."); await logger.success("[REST-02.3] \(path) isolated") }
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: escalationFound ? .failed : .passed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: escalationFound ? "Enforce user-level resource ownership. Derive user ID from the authenticated token, not from the URL path. Never trust client-supplied user IDs for authorization decisions." : nil, executionLog: await logger.getEntries(), duration: duration)
    }

    private func testVerticalEscalation(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[REST-02.4] Testing vertical privilege escalation")
        let escalationPayloads: [(label: String, body: String)] = [
            ("Role claim injection", "{\"role\":\"admin\",\"is_admin\":true}"),
            ("Permission override", "{\"permissions\":[\"admin:*\",\"superuser\"]}"),
            ("Group manipulation", "{\"groups\":[\"administrators\",\"superadmins\"]}"),
        ]
        var findings: [String] = []
        var escalationFound = false
        for payload in escalationPayloads {
            let (sc, resp) = try await sendRaw(to: endpoint.url.appendingPathComponent("/api/users/me"), method: "PUT", headers: ["Content-Type": "application/json", "X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], body: payload.body, logger: logger)
            if sc == 200 && (resp.lowercased().contains("admin") || resp.lowercased().contains("superuser")) { escalationFound = true; findings.append("\(payload.label): ESCALATION SUCCEEDED!"); await logger.error("[REST-02.4] FAIL: \(payload.label)") }
            else { findings.append("\(payload.label): Rejected/ignored (HTTP \(sc))."); await logger.success("[REST-02.4] \(payload.label) blocked") }
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: escalationFound ? .failed : .passed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: escalationFound ? "Role and permission assignments must be server-enforced only. Ignore client-supplied role/permission/group claims. Use a strict allowlist of modifiable user properties." : nil, executionLog: await logger.getEntries(), duration: duration)
    }

    private func testMassAssignment(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[REST-02.5] Testing mass assignment / object property injection")
        let massAssignPayloads: [(label: String, body: String)] = [
            ("isAdmin field", "{\"name\":\"Test\",\"isAdmin\":true}"),
            ("tenantId override", "{\"name\":\"Test\",\"tenantId\":\"other-tenant\"}"),
            ("balance manipulation", "{\"name\":\"Test\",\"balance\":999999,\"credits\":999999}"),
            ("Prototype pollution", "{\"name\":\"Test\",\"__proto__\":{\"isAdmin\":true}}"),
        ]
        var findings: [String] = []
        var injectionWorked = false
        for payload in massAssignPayloads {
            let (sc, resp) = try await sendRaw(to: endpoint.url.appendingPathComponent("/api/users/me"), method: "PATCH", headers: ["Content-Type": "application/json", "X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], body: payload.body, logger: logger)
            let respLower = resp.lowercased()
            if sc == 200 && (respLower.contains("\"isadmin\":true") || respLower.contains("\"balance\":999999") || respLower.contains("other-tenant")) { injectionWorked = true; findings.append("\(payload.label): INJECTED!"); await logger.error("[REST-02.5] FAIL: \(payload.label)") }
            else { findings.append("\(payload.label): Rejected/ignored (HTTP \(sc))."); await logger.success("[REST-02.5] \(payload.label) blocked") }
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: injectionWorked ? .failed : .passed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: injectionWorked ? "Use strict input schema validation. Only accept explicitly allowed properties. Ignore unknown fields. Never bind request body directly to database models without a whitelist." : nil, executionLog: await logger.getEntries(), duration: duration)
    }

    private func testTenantIsolation(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[REST-02.6] Testing tenant isolation in multi-tenant APIs")
        let tenantProbes: [(label: String, headers: [String: String], path: String)] = [
            ("Tenant header injection", ["X-Tenant-Id": "other-tenant-12345", "X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], "/api/users"),
            ("Tenant path traversal", ["X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], "/api/tenants/other-tenant/users"),
            ("Tenant query param", ["X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], "/api/users?tenant_id=other-tenant"),
        ]
        var findings: [String] = []
        var isolationBroken = false
        for probe in tenantProbes {
            let (sc, body) = try await sendRaw(to: endpoint.url.appendingPathComponent(probe.path), method: "GET", headers: probe.headers, body: nil, logger: logger)
            if sc == 200 && body.count > 100 && body.lowercased().contains("other-tenant") { isolationBroken = true; findings.append("\(probe.label): Cross-tenant data returned!"); await logger.error("[REST-02.6] FAIL: \(probe.label)") }
            else { findings.append("\(probe.label): Isolated (HTTP \(sc))."); await logger.success("[REST-02.6] \(probe.label) isolated") }
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: isolationBroken ? .failed : .passed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: isolationBroken ? "Derive tenant context exclusively from the authenticated session (JWT claims or server-side session). Never trust client-supplied tenant IDs. Enforce tenant isolation at the database level using RLS." : nil, executionLog: await logger.getEntries(), duration: duration)
    }

    private func testHTTPMethodOverride(endpoint: EndpointConfiguration, credentials: SecurityTestCredentials, logger: TestLogger, startTime: Date) async throws -> TestResult {
        await logger.info("[REST-02.7] Testing HTTP method override bypass")
        let overrideHeaders: [(label: String, header: String, value: String)] = [
            ("X-HTTP-Method-Override: DELETE", "X-HTTP-Method-Override", "DELETE"),
            ("X-Method-Override: PUT", "X-Method-Override", "PUT"),
            ("_method query param", "", ""),
        ]
        var findings: [String] = []
        var bypassFound = false
        for override in overrideHeaders {
            var headers = ["X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""]
            var path = "/api/users/test-user"
            if !override.header.isEmpty { headers[override.header] = override.value }
            else { path += "?_method=DELETE" }
            let (sc, _) = try await sendRaw(to: endpoint.url.appendingPathComponent(path), method: "GET", headers: headers, body: nil, logger: logger)
            if sc == 204 || sc == 200 {
                let respCheck = try await sendRaw(to: endpoint.url.appendingPathComponent("/api/users/test-user"), method: "GET", headers: ["X-Api-Key": credentials.apiKeys["aws_access_key_id"] ?? ""], body: nil, logger: logger)
                if respCheck.0 == 404 { bypassFound = true; findings.append("\(override.label): Method override EXECUTED DELETE via GET!"); await logger.error("[REST-02.7] FAIL: \(override.label)") }
                else { findings.append("\(override.label): HTTP \(sc) but resource still exists."); await logger.info("[REST-02.7] \(override.label) no effect") }
            } else { findings.append("\(override.label): Not effective (HTTP \(sc))."); await logger.success("[REST-02.7] \(override.label) blocked") }
        }
        let duration = Date().timeIntervalSince(startTime)
        return TestResult(status: bypassFound ? .failed : .passed, findings: findings.joined(separator: "\n"), evidence: await logger.getEvidence(), remediation: bypassFound ? "Disable HTTP method override headers. If needed for legacy compatibility, validate the overridden method against the same access control policy as the actual HTTP method." : nil, executionLog: await logger.getEntries(), duration: duration)
    }

    private func sendRaw(to url: URL, method: String, headers: [String: String], body: String?, logger: TestLogger) async throws -> (Int, String) {
        var request = URLRequest(url: url); request.httpMethod = method; request.timeoutInterval = 15
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        if let body = body { request.httpBody = body.data(using: .utf8) }
        do { let (data, response) = try await URLSession.shared.data(for: request); return ((response as? HTTPURLResponse)?.statusCode ?? 0, String(data: data, encoding: .utf8) ?? "") }
        catch { return (0, "Error: \(error.localizedDescription)") }
    }
}
