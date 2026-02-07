// RADIANT v7.2.0 - CloudWatch Monitoring Service
// Real-time metrics from AWS CloudWatch for monitoring dashboard

import Foundation

actor CloudWatchMonitoringService {
    static let shared = CloudWatchMonitoringService()
    
    // MARK: - Types
    
    enum MonitoringError: LocalizedError {
        case awsError(String)
        case invalidRegion
        case noCredentials
        case parseError(String)
        case timeout
        
        var errorDescription: String? {
            switch self {
            case .awsError(let message): return "AWS Error: \(message)"
            case .invalidRegion: return "Invalid AWS region"
            case .noCredentials: return "AWS credentials not configured"
            case .parseError(let message): return "Parse error: \(message)"
            case .timeout: return "Request timed out"
            }
        }
    }
    
    enum MetricNamespace: String, CaseIterable, Sendable {
        case lambda = "AWS/Lambda"
        case ecs = "AWS/ECS"
        case rds = "AWS/RDS"
        case dynamodb = "AWS/DynamoDB"
        case apiGateway = "AWS/ApiGateway"
        case elasticache = "AWS/ElastiCache"
        case s3 = "AWS/S3"
        case cloudfront = "AWS/CloudFront"
        case cognito = "AWS/Cognito"
        case sqs = "AWS/SQS"
        case sns = "AWS/SNS"
        case custom = "RADIANT/Custom"
        
        var displayName: String {
            switch self {
            case .lambda: return "Lambda"
            case .ecs: return "ECS"
            case .rds: return "Aurora PostgreSQL"
            case .dynamodb: return "DynamoDB"
            case .apiGateway: return "API Gateway"
            case .elasticache: return "ElastiCache"
            case .s3: return "S3"
            case .cloudfront: return "CloudFront"
            case .cognito: return "Cognito"
            case .sqs: return "SQS"
            case .sns: return "SNS"
            case .custom: return "RADIANT Metrics"
            }
        }
        
        var icon: String {
            switch self {
            case .lambda: return "function"
            case .ecs: return "server.rack"
            case .rds: return "cylinder"
            case .dynamodb: return "tablecells"
            case .apiGateway: return "arrow.left.arrow.right"
            case .elasticache: return "memorychip"
            case .s3: return "externaldrive"
            case .cloudfront: return "globe"
            case .cognito: return "person.2"
            case .sqs: return "tray.2"
            case .sns: return "bell"
            case .custom: return "chart.bar"
            }
        }
    }
    
    enum MetricStatistic: String, CaseIterable, Sendable {
        case average = "Average"
        case sum = "Sum"
        case minimum = "Minimum"
        case maximum = "Maximum"
        case sampleCount = "SampleCount"
        case p50 = "p50"
        case p90 = "p90"
        case p99 = "p99"
    }
    
    enum TimeRange: String, CaseIterable, Sendable {
        case oneHour = "1h"
        case threeHours = "3h"
        case sixHours = "6h"
        case twelveHours = "12h"
        case oneDay = "1d"
        case threeDays = "3d"
        case oneWeek = "1w"
        
        var seconds: Int {
            switch self {
            case .oneHour: return 3600
            case .threeHours: return 10800
            case .sixHours: return 21600
            case .twelveHours: return 43200
            case .oneDay: return 86400
            case .threeDays: return 259200
            case .oneWeek: return 604800
            }
        }
        
        var period: Int {
            switch self {
            case .oneHour: return 60
            case .threeHours: return 300
            case .sixHours: return 300
            case .twelveHours: return 900
            case .oneDay: return 900
            case .threeDays: return 3600
            case .oneWeek: return 3600
            }
        }
        
        var displayName: String {
            switch self {
            case .oneHour: return "1 Hour"
            case .threeHours: return "3 Hours"
            case .sixHours: return "6 Hours"
            case .twelveHours: return "12 Hours"
            case .oneDay: return "1 Day"
            case .threeDays: return "3 Days"
            case .oneWeek: return "1 Week"
            }
        }
    }
    
    struct MetricDataPoint: Identifiable, Sendable {
        let id = UUID()
        let timestamp: Date
        let value: Double
        let unit: String?
    }
    
    struct MetricQuery: Sendable {
        let namespace: MetricNamespace
        let metricName: String
        let dimensions: [String: String]
        let statistic: MetricStatistic
        let period: Int
        let startTime: Date
        let endTime: Date
    }
    
    struct MetricResult: Identifiable, Sendable {
        let id = UUID()
        let namespace: MetricNamespace
        let metricName: String
        let dimensions: [String: String]
        let dataPoints: [MetricDataPoint]
        let statistic: MetricStatistic
        let unit: String?
        let label: String
        
        var latestValue: Double? {
            dataPoints.sorted { $0.timestamp > $1.timestamp }.first?.value
        }
        
        var averageValue: Double? {
            guard !dataPoints.isEmpty else { return nil }
            return dataPoints.map(\.value).reduce(0, +) / Double(dataPoints.count)
        }
        
        var maxValue: Double? {
            dataPoints.map(\.value).max()
        }
        
        var minValue: Double? {
            dataPoints.map(\.value).min()
        }
    }
    
    struct ServiceHealth: Identifiable, Sendable {
        let id = UUID()
        let namespace: MetricNamespace
        let serviceName: String
        let status: HealthStatus
        let metrics: [MetricSummary]
        let lastUpdated: Date
        
        enum HealthStatus: String, Sendable {
            case healthy = "Healthy"
            case degraded = "Degraded"
            case unhealthy = "Unhealthy"
            case unknown = "Unknown"
            
            var color: String {
                switch self {
                case .healthy: return "green"
                case .degraded: return "yellow"
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
        
        struct MetricSummary: Identifiable, Sendable {
            let id = UUID()
            let name: String
            let value: Double
            let unit: String
            let trend: Trend
            let threshold: Threshold?
            
            enum Trend: String, Sendable {
                case up = "up"
                case down = "down"
                case stable = "stable"
                
                var icon: String {
                    switch self {
                    case .up: return "arrow.up"
                    case .down: return "arrow.down"
                    case .stable: return "minus"
                    }
                }
            }
            
            struct Threshold: Sendable {
                let warning: Double
                let critical: Double
            }
        }
    }
    
    struct DashboardSnapshot: Identifiable, Sendable {
        let id = UUID()
        let environment: String
        let region: String
        let timestamp: Date
        let services: [ServiceHealth]
        let alerts: [Alert]
        let costEstimate: CostEstimate?
        
        struct Alert: Identifiable, Sendable {
            let id = UUID()
            let severity: Severity
            let service: String
            let metric: String
            let message: String
            let timestamp: Date
            let acknowledged: Bool
            
            enum Severity: String, CaseIterable, Sendable {
                case critical = "Critical"
                case warning = "Warning"
                case info = "Info"
                
                var color: String {
                    switch self {
                    case .critical: return "red"
                    case .warning: return "orange"
                    case .info: return "blue"
                    }
                }
                
                var icon: String {
                    switch self {
                    case .critical: return "exclamationmark.octagon.fill"
                    case .warning: return "exclamationmark.triangle.fill"
                    case .info: return "info.circle.fill"
                    }
                }
            }
        }
        
        struct CostEstimate: Sendable {
            let hourlyRate: Double
            let dailyProjection: Double
            let monthlyProjection: Double
            let breakdown: [String: Double]
        }
    }
    
    // MARK: - Predefined Metric Definitions
    
    struct MetricDefinition: Sendable {
        let namespace: MetricNamespace
        let metricName: String
        let statistic: MetricStatistic
        let unit: String
        let displayName: String
        let warningThreshold: Double?
        let criticalThreshold: Double?
        let invertThreshold: Bool
    }
    
    static let lambdaMetrics: [MetricDefinition] = [
        MetricDefinition(namespace: .lambda, metricName: "Invocations", statistic: .sum, unit: "Count", displayName: "Invocations", warningThreshold: nil, criticalThreshold: nil, invertThreshold: false),
        MetricDefinition(namespace: .lambda, metricName: "Errors", statistic: .sum, unit: "Count", displayName: "Errors", warningThreshold: 10, criticalThreshold: 50, invertThreshold: false),
        MetricDefinition(namespace: .lambda, metricName: "Duration", statistic: .average, unit: "ms", displayName: "Avg Duration", warningThreshold: 5000, criticalThreshold: 15000, invertThreshold: false),
        MetricDefinition(namespace: .lambda, metricName: "Duration", statistic: .p99, unit: "ms", displayName: "P99 Duration", warningThreshold: 10000, criticalThreshold: 25000, invertThreshold: false),
        MetricDefinition(namespace: .lambda, metricName: "Throttles", statistic: .sum, unit: "Count", displayName: "Throttles", warningThreshold: 1, criticalThreshold: 10, invertThreshold: false),
        MetricDefinition(namespace: .lambda, metricName: "ConcurrentExecutions", statistic: .maximum, unit: "Count", displayName: "Concurrent Executions", warningThreshold: 800, criticalThreshold: 950, invertThreshold: false),
    ]
    
    static let ecsMetrics: [MetricDefinition] = [
        MetricDefinition(namespace: .ecs, metricName: "CPUUtilization", statistic: .average, unit: "%", displayName: "CPU Utilization", warningThreshold: 70, criticalThreshold: 90, invertThreshold: false),
        MetricDefinition(namespace: .ecs, metricName: "MemoryUtilization", statistic: .average, unit: "%", displayName: "Memory Utilization", warningThreshold: 75, criticalThreshold: 90, invertThreshold: false),
        MetricDefinition(namespace: .ecs, metricName: "RunningTaskCount", statistic: .average, unit: "Count", displayName: "Running Tasks", warningThreshold: nil, criticalThreshold: nil, invertThreshold: false),
        MetricDefinition(namespace: .ecs, metricName: "PendingTaskCount", statistic: .average, unit: "Count", displayName: "Pending Tasks", warningThreshold: 2, criticalThreshold: 5, invertThreshold: false),
    ]
    
    static let rdsMetrics: [MetricDefinition] = [
        MetricDefinition(namespace: .rds, metricName: "CPUUtilization", statistic: .average, unit: "%", displayName: "CPU Utilization", warningThreshold: 70, criticalThreshold: 90, invertThreshold: false),
        MetricDefinition(namespace: .rds, metricName: "DatabaseConnections", statistic: .average, unit: "Count", displayName: "Connections", warningThreshold: 80, criticalThreshold: 95, invertThreshold: false),
        MetricDefinition(namespace: .rds, metricName: "FreeableMemory", statistic: .average, unit: "GB", displayName: "Freeable Memory", warningThreshold: 2, criticalThreshold: 0.5, invertThreshold: true),
        MetricDefinition(namespace: .rds, metricName: "ReadLatency", statistic: .average, unit: "ms", displayName: "Read Latency", warningThreshold: 10, criticalThreshold: 50, invertThreshold: false),
        MetricDefinition(namespace: .rds, metricName: "WriteLatency", statistic: .average, unit: "ms", displayName: "Write Latency", warningThreshold: 10, criticalThreshold: 50, invertThreshold: false),
        MetricDefinition(namespace: .rds, metricName: "ReadIOPS", statistic: .average, unit: "Count/s", displayName: "Read IOPS", warningThreshold: nil, criticalThreshold: nil, invertThreshold: false),
        MetricDefinition(namespace: .rds, metricName: "WriteIOPS", statistic: .average, unit: "Count/s", displayName: "Write IOPS", warningThreshold: nil, criticalThreshold: nil, invertThreshold: false),
    ]
    
    static let apiGatewayMetrics: [MetricDefinition] = [
        MetricDefinition(namespace: .apiGateway, metricName: "Count", statistic: .sum, unit: "Count", displayName: "Request Count", warningThreshold: nil, criticalThreshold: nil, invertThreshold: false),
        MetricDefinition(namespace: .apiGateway, metricName: "4XXError", statistic: .sum, unit: "Count", displayName: "4XX Errors", warningThreshold: 50, criticalThreshold: 200, invertThreshold: false),
        MetricDefinition(namespace: .apiGateway, metricName: "5XXError", statistic: .sum, unit: "Count", displayName: "5XX Errors", warningThreshold: 10, criticalThreshold: 50, invertThreshold: false),
        MetricDefinition(namespace: .apiGateway, metricName: "Latency", statistic: .average, unit: "ms", displayName: "Avg Latency", warningThreshold: 1000, criticalThreshold: 3000, invertThreshold: false),
        MetricDefinition(namespace: .apiGateway, metricName: "Latency", statistic: .p99, unit: "ms", displayName: "P99 Latency", warningThreshold: 3000, criticalThreshold: 10000, invertThreshold: false),
    ]
    
    static let dynamoDBMetrics: [MetricDefinition] = [
        MetricDefinition(namespace: .dynamodb, metricName: "ConsumedReadCapacityUnits", statistic: .sum, unit: "Count", displayName: "Read Capacity", warningThreshold: nil, criticalThreshold: nil, invertThreshold: false),
        MetricDefinition(namespace: .dynamodb, metricName: "ConsumedWriteCapacityUnits", statistic: .sum, unit: "Count", displayName: "Write Capacity", warningThreshold: nil, criticalThreshold: nil, invertThreshold: false),
        MetricDefinition(namespace: .dynamodb, metricName: "ThrottledRequests", statistic: .sum, unit: "Count", displayName: "Throttled Requests", warningThreshold: 1, criticalThreshold: 10, invertThreshold: false),
        MetricDefinition(namespace: .dynamodb, metricName: "SuccessfulRequestLatency", statistic: .average, unit: "ms", displayName: "Avg Latency", warningThreshold: 10, criticalThreshold: 50, invertThreshold: false),
    ]
    
    static let elasticacheMetrics: [MetricDefinition] = [
        MetricDefinition(namespace: .elasticache, metricName: "CPUUtilization", statistic: .average, unit: "%", displayName: "CPU Utilization", warningThreshold: 70, criticalThreshold: 90, invertThreshold: false),
        MetricDefinition(namespace: .elasticache, metricName: "DatabaseMemoryUsagePercentage", statistic: .average, unit: "%", displayName: "Memory Usage", warningThreshold: 75, criticalThreshold: 90, invertThreshold: false),
        MetricDefinition(namespace: .elasticache, metricName: "CacheHitRate", statistic: .average, unit: "%", displayName: "Hit Rate", warningThreshold: 80, criticalThreshold: 50, invertThreshold: true),
        MetricDefinition(namespace: .elasticache, metricName: "CurrConnections", statistic: .average, unit: "Count", displayName: "Connections", warningThreshold: nil, criticalThreshold: nil, invertThreshold: false),
    ]
    
    // MARK: - Properties
    
    private var metricsCache: [String: (data: [MetricResult], timestamp: Date)] = [:]
    private let cacheDuration: TimeInterval = 60
    
    // MARK: - Public Methods
    
    func fetchDashboardSnapshot(
        appId: String,
        environment: String,
        region: String,
        timeRange: TimeRange = .oneHour
    ) async throws -> DashboardSnapshot {
        async let lambdaHealth = fetchServiceHealth(namespace: .lambda, appId: appId, environment: environment, region: region, timeRange: timeRange)
        async let ecsHealth = fetchServiceHealth(namespace: .ecs, appId: appId, environment: environment, region: region, timeRange: timeRange)
        async let rdsHealth = fetchServiceHealth(namespace: .rds, appId: appId, environment: environment, region: region, timeRange: timeRange)
        async let apiHealth = fetchServiceHealth(namespace: .apiGateway, appId: appId, environment: environment, region: region, timeRange: timeRange)
        async let dynamoHealth = fetchServiceHealth(namespace: .dynamodb, appId: appId, environment: environment, region: region, timeRange: timeRange)
        async let cacheHealth = fetchServiceHealth(namespace: .elasticache, appId: appId, environment: environment, region: region, timeRange: timeRange)
        
        let services = try await [lambdaHealth, ecsHealth, rdsHealth, apiHealth, dynamoHealth, cacheHealth]
        let alerts = generateAlerts(from: services)
        let costEstimate = estimateCurrentCosts(services: services)
        
        return DashboardSnapshot(
            environment: environment,
            region: region,
            timestamp: Date(),
            services: services,
            alerts: alerts,
            costEstimate: costEstimate
        )
    }
    
    func fetchServiceHealth(
        namespace: MetricNamespace,
        appId: String,
        environment: String,
        region: String,
        timeRange: TimeRange
    ) async throws -> ServiceHealth {
        let definitions = getMetricDefinitions(for: namespace)
        var metricSummaries: [ServiceHealth.MetricSummary] = []
        
        for definition in definitions {
            do {
                let result = try await fetchMetric(
                    namespace: namespace,
                    metricName: definition.metricName,
                    dimensions: buildDimensions(namespace: namespace, appId: appId, environment: environment),
                    statistic: definition.statistic,
                    region: region,
                    timeRange: timeRange
                )
                
                if let latestValue = result.latestValue {
                    let trend = calculateTrend(dataPoints: result.dataPoints)
                    let threshold: ServiceHealth.MetricSummary.Threshold?
                    if let warning = definition.warningThreshold, let critical = definition.criticalThreshold {
                        threshold = ServiceHealth.MetricSummary.Threshold(warning: warning, critical: critical)
                    } else {
                        threshold = nil
                    }
                    
                    metricSummaries.append(ServiceHealth.MetricSummary(
                        name: definition.displayName,
                        value: latestValue,
                        unit: definition.unit,
                        trend: trend,
                        threshold: threshold
                    ))
                }
            } catch {
                continue
            }
        }
        
        let status = calculateServiceStatus(metrics: metricSummaries, definitions: definitions)
        
        return ServiceHealth(
            namespace: namespace,
            serviceName: namespace.displayName,
            status: status,
            metrics: metricSummaries,
            lastUpdated: Date()
        )
    }
    
    func fetchMetric(
        namespace: MetricNamespace,
        metricName: String,
        dimensions: [String: String],
        statistic: MetricStatistic,
        region: String,
        timeRange: TimeRange
    ) async throws -> MetricResult {
        let cacheKey = "\(namespace.rawValue)/\(metricName)/\(dimensions)/\(statistic)/\(region)/\(timeRange)"
        
        if let cached = metricsCache[cacheKey],
           Date().timeIntervalSince(cached.timestamp) < cacheDuration,
           let result = cached.data.first {
            return result
        }
        
        let endTime = Date()
        let startTime = endTime.addingTimeInterval(-Double(timeRange.seconds))
        
        let dataPoints = try await executeCloudWatchQuery(
            namespace: namespace,
            metricName: metricName,
            dimensions: dimensions,
            statistic: statistic,
            period: timeRange.period,
            startTime: startTime,
            endTime: endTime,
            region: region
        )
        
        let result = MetricResult(
            namespace: namespace,
            metricName: metricName,
            dimensions: dimensions,
            dataPoints: dataPoints,
            statistic: statistic,
            unit: nil,
            label: "\(namespace.displayName) - \(metricName)"
        )
        
        metricsCache[cacheKey] = (data: [result], timestamp: Date())
        
        return result
    }
    
    func fetchMultipleMetrics(
        queries: [MetricQuery],
        region: String
    ) async throws -> [MetricResult] {
        try await withThrowingTaskGroup(of: MetricResult.self) { group in
            for query in queries {
                group.addTask {
                    try await self.fetchMetric(
                        namespace: query.namespace,
                        metricName: query.metricName,
                        dimensions: query.dimensions,
                        statistic: query.statistic,
                        region: region,
                        timeRange: .oneHour
                    )
                }
            }
            
            var results: [MetricResult] = []
            for try await result in group {
                results.append(result)
            }
            return results
        }
    }
    
    func startRealtimeMonitoring(
        appId: String,
        environment: String,
        region: String,
        interval: TimeInterval = 60,
        onUpdate: @escaping @Sendable (DashboardSnapshot) -> Void
    ) -> Task<Void, Never> {
        Task {
            while !Task.isCancelled {
                do {
                    let snapshot = try await fetchDashboardSnapshot(
                        appId: appId,
                        environment: environment,
                        region: region
                    )
                    onUpdate(snapshot)
                } catch {
                    // Continue monitoring even on error
                }
                
                try? await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
            }
        }
    }
    
    func clearCache() {
        metricsCache.removeAll()
    }
    
    // MARK: - Private Methods
    
    private func executeCloudWatchQuery(
        namespace: MetricNamespace,
        metricName: String,
        dimensions: [String: String],
        statistic: MetricStatistic,
        period: Int,
        startTime: Date,
        endTime: Date,
        region: String
    ) async throws -> [MetricDataPoint] {
        let dimensionArgs = dimensions.map { "--dimensions Name=\($0.key),Value=\($0.value)" }.joined(separator: " ")
        let dateFormatter = ISO8601DateFormatter()
        
        let command = """
        aws cloudwatch get-metric-statistics \
            --namespace "\(namespace.rawValue)" \
            --metric-name "\(metricName)" \
            \(dimensionArgs) \
            --start-time "\(dateFormatter.string(from: startTime))" \
            --end-time "\(dateFormatter.string(from: endTime))" \
            --period \(period) \
            --statistics \(statistic.rawValue) \
            --region \(region) \
            --output json
        """
        
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/zsh")
        process.arguments = ["-c", command]
        
        let outputPipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = errorPipe
        
        try process.run()
        process.waitUntilExit()
        
        let outputData = outputPipe.fileHandleForReading.readDataToEndOfFile()
        
        guard process.terminationStatus == 0 else {
            let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
            let errorString = String(data: errorData, encoding: .utf8) ?? "Unknown error"
            throw MonitoringError.awsError(errorString)
        }
        
        return try parseCloudWatchResponse(data: outputData, statistic: statistic)
    }
    
    private func parseCloudWatchResponse(data: Data, statistic: MetricStatistic) throws -> [MetricDataPoint] {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let datapoints = json["Datapoints"] as? [[String: Any]] else {
            throw MonitoringError.parseError("Invalid CloudWatch response format")
        }
        
        let dateFormatter = ISO8601DateFormatter()
        
        return datapoints.compactMap { point -> MetricDataPoint? in
            guard let timestampString = point["Timestamp"] as? String,
                  let timestamp = dateFormatter.date(from: timestampString) else {
                return nil
            }
            
            let value: Double
            switch statistic {
            case .average:
                value = point["Average"] as? Double ?? 0
            case .sum:
                value = point["Sum"] as? Double ?? 0
            case .minimum:
                value = point["Minimum"] as? Double ?? 0
            case .maximum:
                value = point["Maximum"] as? Double ?? 0
            case .sampleCount:
                value = point["SampleCount"] as? Double ?? 0
            default:
                value = point["Average"] as? Double ?? 0
            }
            
            let unit = point["Unit"] as? String
            
            return MetricDataPoint(timestamp: timestamp, value: value, unit: unit)
        }.sorted { $0.timestamp < $1.timestamp }
    }
    
    private func getMetricDefinitions(for namespace: MetricNamespace) -> [MetricDefinition] {
        switch namespace {
        case .lambda: return Self.lambdaMetrics
        case .ecs: return Self.ecsMetrics
        case .rds: return Self.rdsMetrics
        case .apiGateway: return Self.apiGatewayMetrics
        case .dynamodb: return Self.dynamoDBMetrics
        case .elasticache: return Self.elasticacheMetrics
        default: return []
        }
    }
    
    private func buildDimensions(namespace: MetricNamespace, appId: String, environment: String) -> [String: String] {
        let prefix = "radiant-\(environment)"
        
        switch namespace {
        case .lambda:
            return ["FunctionName": "\(prefix)-api"]
        case .ecs:
            return ["ClusterName": "\(prefix)-cluster", "ServiceName": "\(prefix)-service"]
        case .rds:
            return ["DBClusterIdentifier": "\(prefix)-aurora-cluster"]
        case .apiGateway:
            return ["ApiName": "\(prefix)-api"]
        case .dynamodb:
            return ["TableName": "\(prefix)-sessions"]
        case .elasticache:
            return ["CacheClusterId": "\(prefix)-redis"]
        default:
            return [:]
        }
    }
    
    private func calculateTrend(dataPoints: [MetricDataPoint]) -> ServiceHealth.MetricSummary.Trend {
        guard dataPoints.count >= 2 else { return .stable }
        
        let sorted = dataPoints.sorted { $0.timestamp < $1.timestamp }
        let recentHalf = Array(sorted.suffix(sorted.count / 2))
        let olderHalf = Array(sorted.prefix(sorted.count / 2))
        
        let recentAvg = recentHalf.map(\.value).reduce(0, +) / Double(max(recentHalf.count, 1))
        let olderAvg = olderHalf.map(\.value).reduce(0, +) / Double(max(olderHalf.count, 1))
        
        let changePercent = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0
        
        if changePercent > 10 {
            return .up
        } else if changePercent < -10 {
            return .down
        } else {
            return .stable
        }
    }
    
    private func calculateServiceStatus(
        metrics: [ServiceHealth.MetricSummary],
        definitions: [MetricDefinition]
    ) -> ServiceHealth.HealthStatus {
        var hasCritical = false
        var hasWarning = false
        
        for (index, metric) in metrics.enumerated() {
            guard index < definitions.count else { continue }
            let definition = definitions[index]
            
            guard let warning = definition.warningThreshold,
                  let critical = definition.criticalThreshold else {
                continue
            }
            
            if definition.invertThreshold {
                if metric.value <= critical {
                    hasCritical = true
                } else if metric.value <= warning {
                    hasWarning = true
                }
            } else {
                if metric.value >= critical {
                    hasCritical = true
                } else if metric.value >= warning {
                    hasWarning = true
                }
            }
        }
        
        if hasCritical {
            return .unhealthy
        } else if hasWarning {
            return .degraded
        } else if metrics.isEmpty {
            return .unknown
        } else {
            return .healthy
        }
    }
    
    private func generateAlerts(from services: [ServiceHealth]) -> [DashboardSnapshot.Alert] {
        var alerts: [DashboardSnapshot.Alert] = []
        
        for service in services {
            for metric in service.metrics {
                guard let threshold = metric.threshold else { continue }
                
                if metric.value >= threshold.critical {
                    alerts.append(DashboardSnapshot.Alert(
                        severity: .critical,
                        service: service.serviceName,
                        metric: metric.name,
                        message: "\(metric.name) is at \(String(format: "%.1f", metric.value))\(metric.unit) (critical threshold: \(String(format: "%.1f", threshold.critical))\(metric.unit))",
                        timestamp: Date(),
                        acknowledged: false
                    ))
                } else if metric.value >= threshold.warning {
                    alerts.append(DashboardSnapshot.Alert(
                        severity: .warning,
                        service: service.serviceName,
                        metric: metric.name,
                        message: "\(metric.name) is at \(String(format: "%.1f", metric.value))\(metric.unit) (warning threshold: \(String(format: "%.1f", threshold.warning))\(metric.unit))",
                        timestamp: Date(),
                        acknowledged: false
                    ))
                }
            }
            
            if service.status == .unhealthy {
                alerts.append(DashboardSnapshot.Alert(
                    severity: .critical,
                    service: service.serviceName,
                    metric: "Service Status",
                    message: "\(service.serviceName) is unhealthy",
                    timestamp: Date(),
                    acknowledged: false
                ))
            }
        }
        
        return alerts.sorted { $0.severity.rawValue < $1.severity.rawValue }
    }
    
    private func estimateCurrentCosts(services: [ServiceHealth]) -> DashboardSnapshot.CostEstimate {
        var breakdown: [String: Double] = [:]
        var hourlyTotal: Double = 0
        
        for service in services {
            let hourlyRate: Double
            switch service.namespace {
            case .lambda:
                let invocations = service.metrics.first { $0.name == "Invocations" }?.value ?? 0
                hourlyRate = invocations * 0.0000002
            case .ecs:
                hourlyRate = 0.05
            case .rds:
                hourlyRate = 0.10
            case .apiGateway:
                let requests = service.metrics.first { $0.name == "Request Count" }?.value ?? 0
                hourlyRate = requests * 0.0000035
            case .dynamodb:
                let rcu = service.metrics.first { $0.name == "Read Capacity" }?.value ?? 0
                let wcu = service.metrics.first { $0.name == "Write Capacity" }?.value ?? 0
                hourlyRate = (rcu * 0.00013 + wcu * 0.00065) / 3600
            case .elasticache:
                hourlyRate = 0.02
            default:
                hourlyRate = 0
            }
            
            breakdown[service.serviceName] = hourlyRate
            hourlyTotal += hourlyRate
        }
        
        return DashboardSnapshot.CostEstimate(
            hourlyRate: hourlyTotal,
            dailyProjection: hourlyTotal * 24,
            monthlyProjection: hourlyTotal * 24 * 30,
            breakdown: breakdown
        )
    }
}
