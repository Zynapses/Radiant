import Foundation

/// Health Check Service for post-deployment validation per PROMPT-33 spec
/// Validates API, database, Lambda, and other service health
actor HealthCheckService {
    
    // MARK: - Types
    
    enum HealthCheckError: Error, LocalizedError {
        case endpointUnreachable(String)
        case timeout(String)
        case unhealthyResponse(String, Int)
        case allChecksFailed
        
        var errorDescription: String? {
            switch self {
            case .endpointUnreachable(let endpoint):
                return "Endpoint unreachable: \(endpoint)"
            case .timeout(let endpoint):
                return "Health check timed out: \(endpoint)"
            case .unhealthyResponse(let endpoint, let status):
                return "Unhealthy response from \(endpoint): HTTP \(status)"
            case .allChecksFailed:
                return "All health checks failed"
            }
        }
    }
    
    struct HealthCheckConfig: Codable, Sendable {
        let endpoint: String
        let method: String
        let expectedStatus: Int
        let timeoutSeconds: Int
        let retryCount: Int
        let retryDelayMs: Int
        let headers: [String: String]?
        let body: String?
    }
    
    struct HealthCheckResult: Sendable, Identifiable {
        let id = UUID()
        let service: String
        let endpoint: String
        let status: HealthStatus
        let responseTimeMs: Int?
        let statusCode: Int?
        let message: String?
        let checkedAt: Date
        
        enum HealthStatus: String, Sendable {
            case healthy = "healthy"
            case unhealthy = "unhealthy"
            case timeout = "timeout"
            case error = "error"
            case pending = "pending"
        }
    }
    
    struct HealthReport: Sendable {
        let overallStatus: OverallStatus
        let results: [HealthCheckResult]
        let duration: TimeInterval
        let passedCount: Int
        let failedCount: Int
        let timestamp: Date
        
        enum OverallStatus: String, Sendable {
            case healthy = "healthy"
            case degraded = "degraded"
            case unhealthy = "unhealthy"
        }
        
        var isHealthy: Bool { overallStatus == .healthy }
    }
    
    // MARK: - Properties
    
    private let defaultTimeout: TimeInterval = 10
    private let defaultRetries: Int = 3
    private let retryDelay: TimeInterval = 1
    
    // MARK: - Health Check Execution
    
    func runHealthChecks(
        apiUrl: String,
        dashboardUrl: String,
        graphqlUrl: String,
        onProgress: @escaping (String, HealthCheckResult) -> Void
    ) async -> HealthReport {
        let startTime = Date()
        var results: [HealthCheckResult] = []
        
        // API Health Check
        let apiResult = await checkEndpoint(
            service: "API",
            endpoint: "\(apiUrl)/health",
            expectedStatus: 200
        )
        results.append(apiResult)
        onProgress("API", apiResult)
        
        // GraphQL Health Check
        let graphqlResult = await checkEndpoint(
            service: "GraphQL",
            endpoint: "\(graphqlUrl)/health",
            expectedStatus: 200
        )
        results.append(graphqlResult)
        onProgress("GraphQL", graphqlResult)
        
        // Dashboard Health Check
        let dashboardResult = await checkEndpoint(
            service: "Dashboard",
            endpoint: dashboardUrl,
            expectedStatus: 200
        )
        results.append(dashboardResult)
        onProgress("Dashboard", dashboardResult)
        
        // Database Connectivity (via API)
        let dbResult = await checkEndpoint(
            service: "Database",
            endpoint: "\(apiUrl)/health/db",
            expectedStatus: 200
        )
        results.append(dbResult)
        onProgress("Database", dbResult)
        
        // Lambda Health (via API)
        let lambdaResult = await checkEndpoint(
            service: "Lambda",
            endpoint: "\(apiUrl)/health/lambda",
            expectedStatus: 200
        )
        results.append(lambdaResult)
        onProgress("Lambda", lambdaResult)
        
        // Cache Health
        let cacheResult = await checkEndpoint(
            service: "Cache",
            endpoint: "\(apiUrl)/health/cache",
            expectedStatus: 200
        )
        results.append(cacheResult)
        onProgress("Cache", cacheResult)
        
        let duration = Date().timeIntervalSince(startTime)
        let passedCount = results.filter { $0.status == .healthy }.count
        let failedCount = results.count - passedCount
        
        let overallStatus: HealthReport.OverallStatus
        if failedCount == 0 {
            overallStatus = .healthy
        } else if passedCount > failedCount {
            overallStatus = .degraded
        } else {
            overallStatus = .unhealthy
        }
        
        return HealthReport(
            overallStatus: overallStatus,
            results: results,
            duration: duration,
            passedCount: passedCount,
            failedCount: failedCount,
            timestamp: Date()
        )
    }
    
    func checkEndpoint(
        service: String,
        endpoint: String,
        expectedStatus: Int = 200,
        timeout: TimeInterval? = nil,
        retries: Int? = nil
    ) async -> HealthCheckResult {
        let timeoutValue = timeout ?? defaultTimeout
        let retriesValue = retries ?? defaultRetries
        
        var lastError: Error?
        var lastStatusCode: Int?
        
        for attempt in 1...retriesValue {
            do {
                let startTime = Date()
                
                guard let url = URL(string: endpoint) else {
                    return HealthCheckResult(
                        service: service,
                        endpoint: endpoint,
                        status: .error,
                        responseTimeMs: nil,
                        statusCode: nil,
                        message: "Invalid URL",
                        checkedAt: Date()
                    )
                }
                
                var request = URLRequest(url: url)
                request.timeoutInterval = timeoutValue
                request.httpMethod = "GET"
                
                let (_, response) = try await URLSession.shared.data(for: request)
                
                let responseTime = Int(Date().timeIntervalSince(startTime) * 1000)
                
                guard let httpResponse = response as? HTTPURLResponse else {
                    throw HealthCheckError.unhealthyResponse(endpoint, 0)
                }
                
                lastStatusCode = httpResponse.statusCode
                
                if httpResponse.statusCode == expectedStatus {
                    return HealthCheckResult(
                        service: service,
                        endpoint: endpoint,
                        status: .healthy,
                        responseTimeMs: responseTime,
                        statusCode: httpResponse.statusCode,
                        message: "OK",
                        checkedAt: Date()
                    )
                } else {
                    throw HealthCheckError.unhealthyResponse(endpoint, httpResponse.statusCode)
                }
                
            } catch is URLError {
                lastError = HealthCheckError.timeout(endpoint)
            } catch {
                lastError = error
            }
            
            if attempt < retriesValue {
                try? await Task.sleep(nanoseconds: UInt64(retryDelay * 1_000_000_000))
            }
        }
        
        // All retries failed
        let status: HealthCheckResult.HealthStatus
        let message: String
        
        if let error = lastError as? HealthCheckError {
            switch error {
            case .timeout:
                status = .timeout
                message = "Timed out after \(retriesValue) attempts"
            case .unhealthyResponse(_, let code):
                status = .unhealthy
                message = "HTTP \(code)"
            default:
                status = .error
                message = error.localizedDescription
            }
        } else {
            status = .error
            message = lastError?.localizedDescription ?? "Unknown error"
        }
        
        return HealthCheckResult(
            service: service,
            endpoint: endpoint,
            status: status,
            responseTimeMs: nil,
            statusCode: lastStatusCode,
            message: message,
            checkedAt: Date()
        )
    }
    
    // MARK: - Specialized Checks
    
    func checkDatabaseConnectivity(apiUrl: String) async -> HealthCheckResult {
        await checkEndpoint(
            service: "Database",
            endpoint: "\(apiUrl)/health/db",
            timeout: 30
        )
    }
    
    func checkLambdaWarmup(apiUrl: String) async -> HealthCheckResult {
        // Lambda cold start can take longer
        await checkEndpoint(
            service: "Lambda",
            endpoint: "\(apiUrl)/health/lambda",
            timeout: 30,
            retries: 5
        )
    }
    
    func checkCacheConnectivity(apiUrl: String) async -> HealthCheckResult {
        await checkEndpoint(
            service: "Cache",
            endpoint: "\(apiUrl)/health/cache"
        )
    }
    
    // MARK: - Health Gating
    
    func waitForHealthy(
        apiUrl: String,
        dashboardUrl: String,
        graphqlUrl: String,
        maxWaitSeconds: Int = 300,
        checkIntervalSeconds: Int = 10,
        onProgress: @escaping (HealthReport) -> Void
    ) async throws -> HealthReport {
        let startTime = Date()
        let deadline = startTime.addingTimeInterval(Double(maxWaitSeconds))
        
        while Date() < deadline {
            let report = await runHealthChecks(
                apiUrl: apiUrl,
                dashboardUrl: dashboardUrl,
                graphqlUrl: graphqlUrl,
                onProgress: { _, _ in }
            )
            
            onProgress(report)
            
            if report.isHealthy {
                return report
            }
            
            // Wait before next check
            try await Task.sleep(nanoseconds: UInt64(checkIntervalSeconds) * 1_000_000_000)
        }
        
        // Final check
        let finalReport = await runHealthChecks(
            apiUrl: apiUrl,
            dashboardUrl: dashboardUrl,
            graphqlUrl: graphqlUrl,
            onProgress: { _, _ in }
        )
        
        if !finalReport.isHealthy {
            throw HealthCheckError.allChecksFailed
        }
        
        return finalReport
    }
}

// MARK: - Singleton

extension HealthCheckService {
    static let shared = HealthCheckService()
}
