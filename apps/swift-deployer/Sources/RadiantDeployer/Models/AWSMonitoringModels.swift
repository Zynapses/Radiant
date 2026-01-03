// RADIANT v4.18.0 - AWS Free Tier Monitoring Models
// CloudWatch, X-Ray, and Cost Explorer data structures

import Foundation

// MARK: - Lambda Metrics

struct LambdaMetrics: Codable, Identifiable, Sendable {
    var id: String { functionName }
    let functionName: String
    let invocations: Int
    let errors: Int
    let duration: DurationMetrics
    let throttles: Int
    let concurrentExecutions: Int
    let coldStarts: Int?
    let memoryUsedMb: Double?
    let costEstimate: Double
    
    var errorRate: Double {
        guard invocations > 0 else { return 0 }
        return Double(errors) / Double(invocations) * 100
    }
    
    var healthStatus: MonitoringHealthLevel {
        if errorRate > 10 { return .unhealthy }
        if errorRate > 5 { return .degraded }
        return .healthy
    }
}

struct DurationMetrics: Codable, Sendable {
    let avg: Double
    let p50: Double
    let p90: Double
    let p99: Double
    let max: Double
}

// MARK: - Aurora Metrics

struct AuroraMetrics: Codable, Sendable {
    let clusterId: String
    let cpuUtilization: Double
    let databaseConnections: Int
    let freeableMemoryMb: Double
    let readIOPS: Double
    let writeIOPS: Double
    let readLatencyMs: Double
    let writeLatencyMs: Double
    let volumeBytesUsed: Int64
    let replicaLag: Double?
    let serverlessDatabaseCapacity: Double?
    let acu: Double?
    let costEstimate: Double
    
    var healthStatus: MonitoringHealthLevel {
        if cpuUtilization > 90 { return .unhealthy }
        if cpuUtilization > 70 { return .degraded }
        return .healthy
    }
    
    var storageGb: Double {
        Double(volumeBytesUsed) / (1024 * 1024 * 1024)
    }
}

// MARK: - ECS Metrics

struct ECSMetrics: Codable, Identifiable, Sendable {
    var id: String { "\(clusterName)-\(serviceName)" }
    let clusterName: String
    let serviceName: String
    let runningTasksCount: Int
    let desiredTasksCount: Int
    let cpuUtilization: Double
    let memoryUtilization: Double
    let networkRxBytes: Int64
    let networkTxBytes: Int64
    let costEstimate: Double
    
    var healthStatus: MonitoringHealthLevel {
        if runningTasksCount < desiredTasksCount { return .degraded }
        if cpuUtilization > 90 || memoryUtilization > 90 { return .unhealthy }
        return .healthy
    }
}

// MARK: - X-Ray Trace Summary

struct XRayTraceSummary: Codable, Sendable {
    let totalTraces: Int
    let okCount: Int
    let errorCount: Int
    let faultCount: Int
    let throttleCount: Int
    let avgDuration: Double
    let p50Duration: Double
    let p90Duration: Double
    let p99Duration: Double
    let tracesPerSecond: Double
    let topEndpoints: [EndpointSummary]
    let topErrors: [ErrorSummary]
    
    var errorRate: Double {
        guard totalTraces > 0 else { return 0 }
        return Double(errorCount + faultCount) / Double(totalTraces) * 100
    }
    
    var healthStatus: MonitoringHealthLevel {
        if errorRate > 10 { return .unhealthy }
        if errorRate > 5 { return .degraded }
        return .healthy
    }
}

struct EndpointSummary: Codable, Identifiable, Sendable {
    var id: String { url }
    let url: String
    let count: Int
    let avgDuration: Double
    let errorRate: Double
}

struct ErrorSummary: Codable, Identifiable, Sendable {
    var id: String { message }
    let message: String
    let count: Int
    let lastSeen: String
}

// MARK: - X-Ray Service Graph

struct XRayServiceGraph: Codable, Sendable {
    let startTime: String
    let endTime: String
    let services: [ServiceNode]
    let containsOldData: Bool
}

struct ServiceNode: Codable, Identifiable, Sendable {
    var id: String { name }
    let name: String
    let type: String
    let state: String
    let edges: [ServiceEdge]
    let summaryStatistics: ServiceStatistics
}

struct ServiceEdge: Codable, Sendable {
    let targetId: String
    let summaryStatistics: EdgeStatistics
}

struct ServiceStatistics: Codable, Sendable {
    let totalCount: Int
    let okCount: Int
    let errorCount: Int
    let faultCount: Int
    let totalResponseTime: Double
    
    var avgResponseTime: Double {
        guard totalCount > 0 else { return 0 }
        return totalResponseTime / Double(totalCount)
    }
}

struct EdgeStatistics: Codable, Sendable {
    let totalCount: Int
    let errorStatistics: ErrorStatistics
    let faultStatistics: FaultStatistics
    let okCount: Int
    let totalResponseTime: Double
}

struct ErrorStatistics: Codable, Sendable {
    let throttleCount: Int
    let otherCount: Int
    let totalCount: Int
}

struct FaultStatistics: Codable, Sendable {
    let otherCount: Int
    let totalCount: Int
}

// MARK: - Cost Summary

struct CostSummary: Codable, Sendable {
    let period: CostPeriod
    let totalCost: Double
    let previousPeriodCost: Double
    let percentChange: Double
    let trend: CostTrend
    let byService: [CostByService]
    let topResources: [CostByResource]
    let forecast: CostForecast?
    let credits: Double?
    let refunds: Double?
    let netCost: Double
}

struct CostPeriod: Codable, Sendable {
    let start: String
    let end: String
    let granularity: String
}

enum CostTrend: String, Codable, Sendable {
    case up, down, stable
    
    var color: String {
        switch self {
        case .up: return "red"
        case .down: return "green"
        case .stable: return "gray"
        }
    }
    
    var icon: String {
        switch self {
        case .up: return "arrow.up.right"
        case .down: return "arrow.down.right"
        case .stable: return "arrow.right"
        }
    }
}

struct CostByService: Codable, Identifiable, Sendable {
    var id: String { service }
    let service: String
    let cost: Double
    let unit: String
    let percentageOfTotal: Double
    let change: Double
    let trend: CostTrend
}

struct CostByResource: Codable, Identifiable, Sendable {
    var id: String { resourceId }
    let resourceId: String
    let resourceType: String
    let service: String
    let cost: Double
    let usage: Double
    let usageUnit: String
}

struct CostForecast: Codable, Sendable {
    let startDate: String
    let endDate: String
    let estimatedCost: Double
    let lowerBound: Double
    let upperBound: Double
    let confidence: Int
}

// MARK: - Cost Anomaly

struct CostAnomaly: Codable, Identifiable, Sendable {
    let id: String
    let service: String
    let startDate: String
    let endDate: String?
    let actualCost: Double
    let expectedCost: Double
    let impact: Double
    let severity: AnomalySeverity
    let rootCause: String?
    let status: AnomalyStatus
}

enum AnomalySeverity: String, Codable, Sendable {
    case low, medium, high, critical
    
    var color: String {
        switch self {
        case .low: return "gray"
        case .medium: return "yellow"
        case .high: return "orange"
        case .critical: return "red"
        }
    }
}

enum AnomalyStatus: String, Codable, Sendable {
    case open, resolved, acknowledged
}

// MARK: - Free Tier Usage

struct FreeTierUsage: Codable, Sendable {
    let period: FreeTierPeriod
    let services: [FreeTierService]
    let totalSavings: Double
    let atRisk: [FreeTierService]
    let exceeded: [FreeTierService]
}

struct FreeTierPeriod: Codable, Sendable {
    let start: String
    let end: String
}

struct FreeTierService: Codable, Identifiable, Sendable {
    var id: String { "\(service)-\(metric)" }
    let service: String
    let metric: String
    let limit: Int
    let used: Int
    let unit: String
    let percentUsed: Double
    let resetDate: String
    let status: FreeTierStatus
}

enum FreeTierStatus: String, Codable, Sendable {
    case ok, warning, exceeded
    
    var color: String {
        switch self {
        case .ok: return "green"
        case .warning: return "orange"
        case .exceeded: return "red"
        }
    }
    
    var icon: String {
        switch self {
        case .ok: return "checkmark.circle.fill"
        case .warning: return "exclamationmark.triangle.fill"
        case .exceeded: return "xmark.circle.fill"
        }
    }
}

// MARK: - Monitoring Health Level
// Note: Using MonitoringHealthLevel to avoid conflict with HealthStatus in ManagedApp.swift

enum MonitoringHealthLevel: String, Codable, Sendable {
    case healthy, degraded, unhealthy, unknown
    
    var color: String {
        switch self {
        case .healthy: return "green"
        case .degraded: return "orange"
        case .unhealthy: return "red"
        case .unknown: return "gray"
        }
    }
    
    var icon: String {
        switch self {
        case .healthy: return "checkmark.circle.fill"
        case .degraded: return "exclamationmark.triangle.fill"
        case .unhealthy: return "xmark.circle.fill"
        case .unknown: return "questionmark.circle.fill"
        }
    }
}

struct MonitoringHealthStatus: Codable, Sendable {
    let overall: MonitoringHealthLevel
    let lastCheck: String
    let services: [ServiceHealthStatus]
}

struct ServiceHealthStatus: Codable, Identifiable, Sendable {
    var id: String { name }
    let name: String
    let type: String
    let status: MonitoringHealthLevel
    let message: String?
    let metrics: [MetricHealth]
}

struct MetricHealth: Codable, Identifiable, Sendable {
    var id: String { key }
    let key: String
    let value: Double
    let unit: String
    let status: MetricStatus
    let threshold: Double?
}

enum MetricStatus: String, Codable, Sendable {
    case ok, warning, critical
    
    var color: String {
        switch self {
        case .ok: return "green"
        case .warning: return "orange"
        case .critical: return "red"
        }
    }
}

// MARK: - Monitoring Dashboard

struct MonitoringDashboard: Codable, Sendable {
    let config: MonitoringConfig
    let health: MonitoringHealthStatus
    let lambda: LambdaSummary
    let aurora: AuroraMetrics?
    let ecs: [ECSMetrics]?
    let apiGateway: [APIGatewayMetrics]?
    let xray: XRayTraceSummary
    let serviceGraph: XRayServiceGraph?
    let costs: CostSummary
    let anomalies: [CostAnomaly]
    let freeTierUsage: FreeTierUsage
}

struct LambdaSummary: Codable, Sendable {
    let functions: [LambdaMetrics]
    let totalInvocations: Int
    let totalErrors: Int
    let avgDuration: Double
    let totalCost: Double
    
    var errorRate: Double {
        guard totalInvocations > 0 else { return 0 }
        return Double(totalErrors) / Double(totalInvocations) * 100
    }
}

struct APIGatewayMetrics: Codable, Identifiable, Sendable {
    var id: String { apiId }
    let apiId: String
    let apiName: String
    let requestCount: Int
    let latency: LatencyMetrics
    let error4xxCount: Int
    let error5xxCount: Int
    let cacheHitCount: Int?
    let cacheMissCount: Int?
}

struct LatencyMetrics: Codable, Sendable {
    let avg: Double
    let p50: Double
    let p90: Double
}

// MARK: - Configuration

struct MonitoringConfig: Codable, Sendable {
    let id: String
    let tenantId: String
    let enabled: Bool
    let refreshIntervalMinutes: Int
    let cloudwatch: CloudWatchConfig
    let xray: XRayConfig
    let costExplorer: CostExplorerConfig
    let alerting: AlertingConfig
    let createdAt: String
    let updatedAt: String
}

struct CloudWatchConfig: Codable, Sendable {
    let enabled: Bool
    let lambdaFunctions: [String]
    let auroraClusterId: String?
    let ecsClusterName: String?
    let customNamespaces: [String]?
}

struct XRayConfig: Codable, Sendable {
    let enabled: Bool
    let samplingRate: Double
    let filterExpression: String?
    let traceRetentionDays: Int
}

struct CostExplorerConfig: Codable, Sendable {
    let enabled: Bool
    let budgetAlertThreshold: Double?
    let anomalyDetection: Bool
    let forecastEnabled: Bool
}

struct AlertingConfig: Codable, Sendable {
    let slackWebhook: String?
    let emailAddresses: [String]?
    let thresholds: AlertThresholds
}

struct AlertThresholds: Codable, Sendable {
    let lambdaErrorRate: Double?
    let lambdaP99Latency: Double?
    let auroraCpuPercent: Double?
    let costDailyLimit: Double?
    let xrayErrorRate: Double?
}

// MARK: - Chart Data (For Smart Visuals)

struct ChartDataPoint: Identifiable, Sendable {
    let id = UUID()
    let x: Double
    let y: Double
    let label: String?
    let color: String?
}

struct ChartSeries: Identifiable, Sendable {
    let id: String
    let name: String
    let type: ChartType
    let data: [ChartDataPoint]
    let color: String?
    let yAxis: YAxisSide
    let overlay: Bool
}

enum ChartType: String, Sendable {
    case line, bar, area, scatter
}

enum YAxisSide: String, Sendable {
    case left, right
}

struct MonitoringChart: Identifiable, Sendable {
    let id: String
    let title: String
    let subtitle: String?
    let series: [ChartSeries]
    let xAxisLabel: String?
    let yAxisLeftLabel: String?
    let yAxisRightLabel: String?
    let showOverlays: Bool
}

// MARK: - Notification Models

struct NotificationTarget: Codable, Identifiable, Sendable {
    let id: String
    let tenantId: String
    let type: NotificationTargetType
    let value: String
    let name: String
    let enabled: Bool
    let createdAt: String
    let updatedAt: String
}

enum NotificationTargetType: String, Codable, Sendable, CaseIterable {
    case email
    case sms
    
    var icon: String {
        switch self {
        case .email: return "envelope.fill"
        case .sms: return "phone.fill"
        }
    }
    
    var placeholder: String {
        switch self {
        case .email: return "admin@company.com"
        case .sms: return "+15551234567"
        }
    }
}

struct SpendThreshold: Codable, Identifiable, Sendable {
    let id: String
    let tenantId: String
    let period: SpendPeriod
    let thresholdAmount: Double
    let warningPercent: Int
    let enabled: Bool
    let lastTriggeredAt: String?
    let createdAt: String
    let updatedAt: String
}

enum SpendPeriod: String, Codable, Sendable, CaseIterable {
    case hourly
    case daily
    case weekly
    case monthly
    
    var displayName: String {
        switch self {
        case .hourly: return "Hourly"
        case .daily: return "Daily"
        case .weekly: return "Weekly"
        case .monthly: return "Monthly"
        }
    }
    
    var icon: String {
        switch self {
        case .hourly: return "clock"
        case .daily: return "sun.max"
        case .weekly: return "calendar.badge.clock"
        case .monthly: return "calendar"
        }
    }
}

struct MetricThreshold: Codable, Identifiable, Sendable {
    let id: String
    let tenantId: String
    let metricType: MetricThresholdType
    let thresholdValue: Double
    let comparison: ThresholdComparison
    let enabled: Bool
    let lastTriggeredAt: String?
    let createdAt: String
    let updatedAt: String
}

enum MetricThresholdType: String, Codable, Sendable, CaseIterable {
    case lambda_error_rate
    case lambda_p99_latency
    case aurora_cpu
    case xray_error_rate
    case free_tier_usage
    
    var displayName: String {
        switch self {
        case .lambda_error_rate: return "Lambda Error Rate"
        case .lambda_p99_latency: return "Lambda P99 Latency"
        case .aurora_cpu: return "Aurora CPU"
        case .xray_error_rate: return "X-Ray Error Rate"
        case .free_tier_usage: return "Free Tier Usage"
        }
    }
    
    var unit: String {
        switch self {
        case .lambda_error_rate, .xray_error_rate, .aurora_cpu, .free_tier_usage: return "%"
        case .lambda_p99_latency: return "ms"
        }
    }
}

enum ThresholdComparison: String, Codable, Sendable {
    case gt  // greater than
    case lt  // less than
    case gte // greater than or equal
    case lte // less than or equal
    
    var symbol: String {
        switch self {
        case .gt: return ">"
        case .lt: return "<"
        case .gte: return "≥"
        case .lte: return "≤"
        }
    }
}

struct SpendSummary: Codable, Sendable {
    let hourly: Double
    let daily: Double
    let weekly: Double
    let monthly: Double
    let hourlyChange: Double
    let dailyChange: Double
    let weeklyChange: Double
    let monthlyChange: Double
}

struct NotificationLogEntry: Codable, Identifiable, Sendable {
    let id: String
    let tenantId: String
    let targetId: String
    let thresholdId: String?
    let type: NotificationLogType
    let message: String
    let sentAt: String
    let deliveryStatus: DeliveryStatus
    let errorMessage: String?
}

enum NotificationLogType: String, Codable, Sendable {
    case spend_warning
    case spend_exceeded
    case metric_exceeded
    case free_tier_warning
    case free_tier_exceeded
    
    var icon: String {
        switch self {
        case .spend_warning, .free_tier_warning: return "exclamationmark.triangle.fill"
        case .spend_exceeded, .metric_exceeded, .free_tier_exceeded: return "exclamationmark.octagon.fill"
        }
    }
    
    var color: String {
        switch self {
        case .spend_warning, .free_tier_warning: return "orange"
        case .spend_exceeded, .metric_exceeded, .free_tier_exceeded: return "red"
        }
    }
}

enum DeliveryStatus: String, Codable, Sendable {
    case pending
    case sent
    case failed
    
    var icon: String {
        switch self {
        case .pending: return "clock"
        case .sent: return "checkmark.circle.fill"
        case .failed: return "xmark.circle.fill"
        }
    }
}

struct ChargeableStatus: Codable, Sendable {
    let isChargeable: Bool
    let reason: String?
    let estimatedMonthlyCost: Double
    let recommendation: String
}

// MARK: - Free Tier Service Settings (Admin toggles)

enum AWSServiceType: String, Codable, CaseIterable, Sendable {
    case lambda
    case aurora
    case xray
    case cloudwatch
    case costExplorer = "cost_explorer"
    case apiGateway = "api_gateway"
    case sqs
    case s3
    case dynamodb
    case sns
    case ses
    
    var displayName: String {
        switch self {
        case .lambda: return "Lambda"
        case .aurora: return "Aurora"
        case .xray: return "X-Ray"
        case .cloudwatch: return "CloudWatch"
        case .costExplorer: return "Cost Explorer"
        case .apiGateway: return "API Gateway"
        case .sqs: return "SQS"
        case .s3: return "S3"
        case .dynamodb: return "DynamoDB"
        case .sns: return "SNS"
        case .ses: return "SES"
        }
    }
    
    var icon: String {
        switch self {
        case .lambda: return "function"
        case .aurora: return "cylinder.split.1x2"
        case .xray: return "waveform.path.ecg"
        case .cloudwatch: return "chart.xyaxis.line"
        case .costExplorer: return "dollarsign.circle"
        case .apiGateway: return "network"
        case .sqs: return "tray.2"
        case .s3: return "externaldrive"
        case .dynamodb: return "tablecells"
        case .sns: return "bell"
        case .ses: return "envelope"
        }
    }
    
    var freeTierDescription: String {
        switch self {
        case .lambda: return "1M requests, 400K GB-seconds/month"
        case .aurora: return "750 ACU-hours, 10GB storage/month"
        case .xray: return "100K traces/month"
        case .cloudwatch: return "10 metrics, 3 dashboards, 10 alarms"
        case .costExplorer: return "~1000 API requests/month"
        case .apiGateway: return "1M REST API calls/month"
        case .sqs: return "1M requests/month"
        case .s3: return "5GB storage, 20K GET, 2K PUT"
        case .dynamodb: return "25GB storage, 25 RCU, 25 WCU"
        case .sns: return "1M publishes, 100K HTTP/S deliveries"
        case .ses: return "62K outbound emails/month (from EC2)"
        }
    }
}

struct FreeTierServiceSetting: Codable, Identifiable, Sendable {
    var id: String
    let tenantId: String
    let service: AWSServiceType
    var freeTierEnabled: Bool      // Free tier ON by default
    var paidTierEnabled: Bool      // Paid tier requires admin toggle (slider)
    var autoScaleToPaid: Bool      // Auto-upgrade when free tier exceeded
    var maxPaidBudget: Double?     // Optional budget cap
    let enabledAt: String
    let enabledBy: String?
    let createdAt: String
    let updatedAt: String
    
    var tierStatusText: String {
        if paidTierEnabled {
            if let budget = maxPaidBudget {
                return "Paid (cap: $\(String(format: "%.2f", budget)))"
            }
            return "Paid tier enabled"
        }
        return "Free tier only"
    }
    
    var tierStatusColor: String {
        if paidTierEnabled {
            return "orange"
        }
        return "green"
    }
}
