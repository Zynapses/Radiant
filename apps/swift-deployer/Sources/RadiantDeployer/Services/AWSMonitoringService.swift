// RADIANT v4.18.0 - AWS Monitoring Service
// Fetches CloudWatch, X-Ray, and Cost Explorer data from deployed instance

import Foundation

@MainActor
final class AWSMonitoringService: ObservableObject {
    static let shared = AWSMonitoringService()
    
    @Published var dashboard: MonitoringDashboard?
    @Published var isLoading = false
    @Published var error: String?
    @Published var lastRefresh: Date?
    
    private var refreshTimer: Timer?
    private var refreshInterval: TimeInterval = 300 // 5 minutes default
    
    private init() {}
    
    // MARK: - Dashboard
    
    func fetchDashboard(for instance: DeployedInstance) async {
        isLoading = true
        error = nil
        
        do {
            let endpoint = "\(instance.apiEndpoint)/api/admin/aws-monitoring/dashboard"
            guard let url = URL(string: endpoint) else {
                throw MonitoringError.invalidURL
            }
            
            var request = URLRequest(url: url)
            request.httpMethod = "GET"
            request.addValue("Bearer \(instance.authToken)", forHTTPHeaderField: "Authorization")
            request.addValue("application/json", forHTTPHeaderField: "Content-Type")
            
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw MonitoringError.invalidResponse
            }
            
            if httpResponse.statusCode != 200 {
                throw MonitoringError.httpError(httpResponse.statusCode)
            }
            
            let decoder = JSONDecoder()
            let apiResponse = try decoder.decode(APIResponse<MonitoringDashboard>.self, from: data)
            
            if apiResponse.success {
                self.dashboard = apiResponse.data
                self.lastRefresh = Date()
                
                // Update refresh interval from config
                if let interval = apiResponse.data?.config.refreshIntervalMinutes {
                    self.refreshInterval = TimeInterval(interval * 60)
                }
            } else {
                throw MonitoringError.apiError(apiResponse.error ?? "Unknown error")
            }
        } catch {
            self.error = error.localizedDescription
        }
        
        isLoading = false
    }
    
    // MARK: - Auto-Refresh
    
    func startAutoRefresh(for instance: DeployedInstance) {
        stopAutoRefresh()
        
        refreshTimer = Timer.scheduledTimer(withTimeInterval: refreshInterval, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                await self?.fetchDashboard(for: instance)
            }
        }
    }
    
    func stopAutoRefresh() {
        refreshTimer?.invalidate()
        refreshTimer = nil
    }
    
    // MARK: - Specific Data Fetchers
    
    func fetchLambdaMetrics(for instance: DeployedInstance) async -> [LambdaMetrics]? {
        guard let data: LambdaResponse = await fetchEndpoint("/api/admin/aws-monitoring/lambda", instance: instance) else {
            return nil
        }
        return data.functions
    }
    
    func fetchXRayData(for instance: DeployedInstance) async -> XRayTraceSummary? {
        return await fetchEndpoint("/api/admin/aws-monitoring/xray", instance: instance)
    }
    
    func fetchServiceGraph(for instance: DeployedInstance) async -> XRayServiceGraph? {
        return await fetchEndpoint("/api/admin/aws-monitoring/xray/service-graph", instance: instance)
    }
    
    func fetchCosts(for instance: DeployedInstance) async -> CostSummary? {
        return await fetchEndpoint("/api/admin/aws-monitoring/costs", instance: instance)
    }
    
    func fetchCostAnomalies(for instance: DeployedInstance) async -> [CostAnomaly]? {
        return await fetchEndpoint("/api/admin/aws-monitoring/costs/anomalies", instance: instance)
    }
    
    func fetchFreeTierUsage(for instance: DeployedInstance) async -> FreeTierUsage? {
        return await fetchEndpoint("/api/admin/aws-monitoring/free-tier", instance: instance)
    }
    
    func fetchHealthStatus(for instance: DeployedInstance) async -> MonitoringHealthStatus? {
        return await fetchEndpoint("/api/admin/aws-monitoring/health", instance: instance)
    }
    
    // MARK: - Tier Settings
    
    func togglePaidTier(for instance: DeployedInstance, service: String, enabled: Bool) async -> Bool {
        do {
            let endpoint = "\(instance.apiEndpoint)/api/admin/aws-monitoring/tier-settings"
            guard let url = URL(string: endpoint) else { return false }
            
            var request = URLRequest(url: url)
            request.httpMethod = "PUT"
            request.addValue("Bearer \(instance.authToken)", forHTTPHeaderField: "Authorization")
            request.addValue("application/json", forHTTPHeaderField: "Content-Type")
            
            let body = TierSettingsRequest(service: service, paidTierEnabled: enabled)
            request.httpBody = try JSONEncoder().encode(body)
            
            let (_, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else { return false }
            if httpResponse.statusCode == 200 {
                await fetchDashboard(for: instance)
                return true
            }
            return false
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }
    
    func setAutoScale(for instance: DeployedInstance, service: String, enabled: Bool) async -> Bool {
        do {
            let endpoint = "\(instance.apiEndpoint)/api/admin/aws-monitoring/auto-scale"
            guard let url = URL(string: endpoint) else { return false }
            
            var request = URLRequest(url: url)
            request.httpMethod = "PUT"
            request.addValue("Bearer \(instance.authToken)", forHTTPHeaderField: "Authorization")
            request.addValue("application/json", forHTTPHeaderField: "Content-Type")
            
            let body = AutoScaleRequest(service: service, autoScaleEnabled: enabled)
            request.httpBody = try JSONEncoder().encode(body)
            
            let (_, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else { return false }
            return httpResponse.statusCode == 200
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }
    
    func setBudgetCap(for instance: DeployedInstance, service: String, cap: Double) async -> Bool {
        do {
            let endpoint = "\(instance.apiEndpoint)/api/admin/aws-monitoring/budget-cap"
            guard let url = URL(string: endpoint) else { return false }
            
            var request = URLRequest(url: url)
            request.httpMethod = "PUT"
            request.addValue("Bearer \(instance.authToken)", forHTTPHeaderField: "Authorization")
            request.addValue("application/json", forHTTPHeaderField: "Content-Type")
            
            let body = BudgetCapRequest(service: service, budgetCap: cap)
            request.httpBody = try JSONEncoder().encode(body)
            
            let (_, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else { return false }
            return httpResponse.statusCode == 200
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }
    
    // MARK: - Configuration
    
    func updateConfig(for instance: DeployedInstance, config: MonitoringConfigUpdate) async -> Bool {
        do {
            let endpoint = "\(instance.apiEndpoint)/api/admin/aws-monitoring/config"
            guard let url = URL(string: endpoint) else { return false }
            
            var request = URLRequest(url: url)
            request.httpMethod = "PUT"
            request.addValue("Bearer \(instance.authToken)", forHTTPHeaderField: "Authorization")
            request.addValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(config)
            
            let (_, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else { return false }
            return httpResponse.statusCode == 200
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }
    
    // MARK: - Force Refresh
    
    func forceRefresh(for instance: DeployedInstance) async {
        do {
            let endpoint = "\(instance.apiEndpoint)/api/admin/aws-monitoring/refresh"
            guard let url = URL(string: endpoint) else { return }
            
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.addValue("Bearer \(instance.authToken)", forHTTPHeaderField: "Authorization")
            request.addValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(["forceRefresh": true])
            
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else { return }
            
            let decoder = JSONDecoder()
            let apiResponse = try decoder.decode(APIResponse<MonitoringDashboard>.self, from: data)
            
            if apiResponse.success {
                self.dashboard = apiResponse.data
                self.lastRefresh = Date()
            }
        } catch {
            self.error = error.localizedDescription
        }
    }
    
    // MARK: - Chart Data
    
    func getLambdaInvocationsChart() -> MonitoringChart? {
        guard let dashboard = dashboard else { return nil }
        
        let series = dashboard.lambda.functions.map { fn in
            ChartSeries(
                id: fn.functionName,
                name: fn.functionName.replacingOccurrences(of: "radiant-", with: ""),
                type: .bar,
                data: [ChartDataPoint(x: 0, y: Double(fn.invocations), label: "\(fn.invocations)", color: fn.errors > 0 ? "red" : "green")],
                color: fn.errors > 0 ? "red" : "green",
                yAxis: .left,
                overlay: false
            )
        }
        
        return MonitoringChart(
            id: "lambda-invocations",
            title: "Lambda Invocations",
            subtitle: "Last hour",
            series: series,
            xAxisLabel: "Function",
            yAxisLeftLabel: "Invocations",
            yAxisRightLabel: nil,
            showOverlays: true
        )
    }
    
    func getCostTrendChart() -> MonitoringChart? {
        guard let dashboard = dashboard else { return nil }
        
        let costSeries = ChartSeries(
            id: "cost",
            name: "Cost by Service",
            type: .bar,
            data: dashboard.costs.byService.enumerated().map { index, svc in
                ChartDataPoint(x: Double(index), y: svc.cost, label: svc.service, color: nil)
            },
            color: "blue",
            yAxis: .left,
            overlay: false
        )
        
        var series = [costSeries]
        
        // Add forecast overlay if available
        if let forecast = dashboard.costs.forecast {
            let forecastSeries = ChartSeries(
                id: "forecast",
                name: "Forecast",
                type: .line,
                data: [ChartDataPoint(x: Double(dashboard.costs.byService.count), y: forecast.estimatedCost, label: "Forecast", color: "orange")],
                color: "orange",
                yAxis: .right,
                overlay: true
            )
            series.append(forecastSeries)
        }
        
        return MonitoringChart(
            id: "cost-trend",
            title: "Cost by Service",
            subtitle: "Month to date",
            series: series,
            xAxisLabel: "Service",
            yAxisLeftLabel: "Cost (USD)",
            yAxisRightLabel: "Forecast",
            showOverlays: dashboard.costs.forecast != nil
        )
    }
    
    func getLatencyChart() -> MonitoringChart? {
        guard let dashboard = dashboard else { return nil }
        
        let p50Series = ChartSeries(
            id: "p50",
            name: "P50",
            type: .bar,
            data: dashboard.lambda.functions.enumerated().map { index, fn in
                ChartDataPoint(x: Double(index), y: fn.duration.p50, label: nil, color: "green")
            },
            color: "green",
            yAxis: .left,
            overlay: false
        )
        
        let p90Series = ChartSeries(
            id: "p90",
            name: "P90",
            type: .bar,
            data: dashboard.lambda.functions.enumerated().map { index, fn in
                ChartDataPoint(x: Double(index), y: fn.duration.p90, label: nil, color: "orange")
            },
            color: "orange",
            yAxis: .left,
            overlay: false
        )
        
        let p99Series = ChartSeries(
            id: "p99",
            name: "P99",
            type: .bar,
            data: dashboard.lambda.functions.enumerated().map { index, fn in
                ChartDataPoint(x: Double(index), y: fn.duration.p99, label: nil, color: "red")
            },
            color: "red",
            yAxis: .left,
            overlay: false
        )
        
        return MonitoringChart(
            id: "latency",
            title: "Latency Distribution",
            subtitle: "Lambda durations",
            series: [p50Series, p90Series, p99Series],
            xAxisLabel: "Function",
            yAxisLeftLabel: "Duration (ms)",
            yAxisRightLabel: nil,
            showOverlays: false
        )
    }
    
    // MARK: - Helpers
    
    private func fetchEndpoint<T: Decodable>(_ path: String, instance: DeployedInstance) async -> T? {
        do {
            let endpoint = "\(instance.apiEndpoint)\(path)"
            guard let url = URL(string: endpoint) else { return nil }
            
            var request = URLRequest(url: url)
            request.httpMethod = "GET"
            request.addValue("Bearer \(instance.authToken)", forHTTPHeaderField: "Authorization")
            request.addValue("application/json", forHTTPHeaderField: "Content-Type")
            
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else { return nil }
            
            let decoder = JSONDecoder()
            let apiResponse = try decoder.decode(APIResponse<T>.self, from: data)
            
            return apiResponse.data
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }
}

// MARK: - Supporting Types

struct DeployedInstance: Sendable {
    let apiEndpoint: String
    let authToken: String  // JWT token from authentication, not AWS credentials
    
    // Legacy compatibility - accepts apiKey parameter name
    init(apiEndpoint: String, apiKey: String) {
        self.apiEndpoint = apiEndpoint
        self.authToken = apiKey
    }
    
    init(apiEndpoint: String, authToken: String) {
        self.apiEndpoint = apiEndpoint
        self.authToken = authToken
    }
}

struct APIResponse<T: Decodable>: Decodable {
    let success: Bool
    let data: T?
    let error: String?
}

struct LambdaResponse: Decodable {
    let functions: [LambdaMetrics]
    let summary: LambdaSummary?
}

struct MonitoringConfigUpdate: Encodable {
    var cloudwatch: CloudWatchConfigUpdate?
    var xray: XRayConfigUpdate?
    var costExplorer: CostExplorerConfigUpdate?
    var alerting: AlertingConfigUpdate?
    var refreshIntervalMinutes: Int?
}

struct CloudWatchConfigUpdate: Encodable {
    var enabled: Bool?
    var lambdaFunctions: [String]?
    var auroraClusterId: String?
    var ecsClusterName: String?
}

struct XRayConfigUpdate: Encodable {
    var enabled: Bool?
    var samplingRate: Double?
    var filterExpression: String?
}

struct CostExplorerConfigUpdate: Encodable {
    var enabled: Bool?
    var anomalyDetection: Bool?
    var forecastEnabled: Bool?
}

struct AlertingConfigUpdate: Encodable {
    var slackWebhook: String?
    var emailAddresses: [String]?
    var thresholds: AlertThresholdsUpdate?
}

struct AlertThresholdsUpdate: Encodable {
    var lambdaErrorRate: Double?
    var lambdaP99Latency: Double?
    var auroraCpuPercent: Double?
    var costDailyLimit: Double?
    var xrayErrorRate: Double?
}

struct TierSettingsRequest: Encodable {
    let service: String
    let paidTierEnabled: Bool
}

struct AutoScaleRequest: Encodable {
    let service: String
    let autoScaleEnabled: Bool
}

struct BudgetCapRequest: Encodable {
    let service: String
    let budgetCap: Double
}

enum MonitoringError: LocalizedError {
    case invalidURL
    case invalidResponse
    case httpError(Int)
    case apiError(String)
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid API URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .httpError(let code):
            return "HTTP error: \(code)"
        case .apiError(let message):
            return message
        }
    }
}
