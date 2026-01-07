// RADIANT v4.18.0 - AWS Free Tier Monitoring View
// Smart visuals with overlays for CloudWatch, X-Ray, and Cost Explorer

import SwiftUI
import Charts

struct AWSMonitoringView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var monitoringService = AWSMonitoringService.shared
    @State private var selectedTab: MonitoringTab = .overview
    @State private var isRefreshing = false
    @State private var showOverlays = true
    @State private var selectedTimeRange: MonitoringTimeRange = .hour
    
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                headerSection
                
                if monitoringService.isLoading && monitoringService.dashboard == nil {
                    loadingView
                } else if let dashboard = monitoringService.dashboard {
                    healthOverviewSection(dashboard: dashboard)
                    tabPicker
                    
                    switch selectedTab {
                    case .overview:
                        overviewSection(dashboard: dashboard)
                    case .lambda:
                        lambdaSection(dashboard: dashboard)
                    case .aurora:
                        auroraSection(dashboard: dashboard)
                    case .xray:
                        xraySection(dashboard: dashboard)
                    case .costs:
                        costsSection(dashboard: dashboard)
                    case .freeTier:
                        freeTierSection(dashboard: dashboard)
                    case .tierSettings:
                        tierSettingsSection()
                    }
                } else {
                    emptyStateView
                }
            }
            .padding(24)
        }
        .frame(minWidth: 600)
        .background(Color(nsColor: .windowBackgroundColor))
        .task {
            await loadData()
        }
    }
    
    // MARK: - Header
    
    private var headerSection: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("AWS Monitoring")
                    .font(.largeTitle.bold())
                Text("Free tier metrics: CloudWatch, X-Ray, Cost Explorer")
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            // Time Range Picker
            Picker("Time Range", selection: $selectedTimeRange) {
                ForEach(MonitoringTimeRange.allCases) { range in
                    Text(range.rawValue).tag(range)
                }
            }
            .pickerStyle(.segmented)
            .frame(width: 250)
            
            // Overlay Toggle
            Toggle(isOn: $showOverlays) {
                Label("Overlays", systemImage: "square.3.layers.3d")
            }
            .toggleStyle(.button)
            
            // Refresh Button
            Button {
                Task { await refreshData() }
            } label: {
                Image(systemName: "arrow.clockwise")
            }
            .buttonStyle(.bordered)
            .disabled(isRefreshing)
            
            // Last refresh indicator
            if let lastRefresh = monitoringService.lastRefresh {
                Text("Updated \(lastRefresh, style: .relative) ago")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
    
    // MARK: - Health Overview
    
    private func healthOverviewSection(dashboard: MonitoringDashboard) -> some View {
        VStack(spacing: 16) {
            // Overall Health Banner
            HStack(spacing: 16) {
                overallHealthBadge(status: dashboard.health.overall)
                
                Divider()
                    .frame(height: 40)
                
                // Quick Stats
                HStack(spacing: 24) {
                    QuickStatItem(
                        title: "Lambda",
                        value: "\(dashboard.lambda.totalInvocations.formatted())",
                        subtitle: "\(dashboard.lambda.totalErrors) errors",
                        color: dashboard.lambda.errorRate > 5 ? .orange : .green,
                        icon: "function"
                    )
                    
                    if let aurora = dashboard.aurora {
                        QuickStatItem(
                            title: "Aurora",
                            value: String(format: "%.0f%%", aurora.cpuUtilization),
                            subtitle: "CPU",
                            color: aurora.cpuUtilization > 80 ? .orange : .green,
                            icon: "cylinder.split.1x2"
                        )
                    }
                    
                    QuickStatItem(
                        title: "X-Ray",
                        value: "\(dashboard.xray.totalTraces.formatted())",
                        subtitle: String(format: "%.1f%% error", dashboard.xray.errorRate),
                        color: dashboard.xray.errorRate > 5 ? .orange : .green,
                        icon: "waveform.path.ecg"
                    )
                    
                    QuickStatItem(
                        title: "Cost",
                        value: String(format: "$%.2f", dashboard.costs.totalCost),
                        subtitle: dashboard.costs.trend.rawValue,
                        color: dashboard.costs.trend == .up ? .red : .green,
                        icon: "dollarsign.circle"
                    )
                    
                    QuickStatItem(
                        title: "Free Tier",
                        value: String(format: "$%.2f", dashboard.freeTierUsage.totalSavings),
                        subtitle: "savings",
                        color: dashboard.freeTierUsage.exceeded.isEmpty ? .green : .orange,
                        icon: "gift"
                    )
                }
                
                Spacer()
            }
            .padding(16)
            .background(Color(nsColor: .controlBackgroundColor))
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }
    
    private func overallHealthBadge(status: MonitoringHealthLevel) -> some View {
        HStack(spacing: 8) {
            Circle()
                .fill(healthColor(status))
                .frame(width: 12, height: 12)
            
            VStack(alignment: .leading, spacing: 2) {
                Text("System Health")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(status.rawValue.capitalized)
                    .font(.headline)
            }
        }
    }
    
    // MARK: - Tab Picker
    
    private var tabPicker: some View {
        Picker("Section", selection: $selectedTab) {
            ForEach(MonitoringTab.allCases) { tab in
                Label(tab.rawValue, systemImage: tab.icon).tag(tab)
            }
        }
        .pickerStyle(.segmented)
    }
    
    // MARK: - Overview Section
    
    private func overviewSection(dashboard: MonitoringDashboard) -> some View {
        VStack(spacing: 24) {
            HStack(alignment: .top, spacing: 24) {
                // Lambda Invocations Chart
                MonitoringSection(title: "Lambda Invocations", icon: "function") {
                    lambdaInvocationsChart(dashboard: dashboard)
                }
                .frame(maxWidth: .infinity)
                
                // Cost Trend Chart
                MonitoringSection(title: "Cost by Service", icon: "dollarsign.circle") {
                    costByServiceChart(dashboard: dashboard)
                }
                .frame(maxWidth: .infinity)
            }
            
            HStack(alignment: .top, spacing: 24) {
                // Latency Distribution
                MonitoringSection(title: "Latency Distribution", icon: "clock") {
                    latencyDistributionChart(dashboard: dashboard)
                }
                .frame(maxWidth: .infinity)
                
                // Service Health Grid
                MonitoringSection(title: "Service Health", icon: "heart.fill") {
                    serviceHealthGrid(dashboard: dashboard)
                }
                .frame(minWidth: 280, idealWidth: 320, maxWidth: 350)
            }
        }
    }
    
    // MARK: - Lambda Section
    
    private func lambdaSection(dashboard: MonitoringDashboard) -> some View {
        VStack(spacing: 24) {
            // Summary Cards
            HStack(spacing: 16) {
                MonitoringMetricCard(
                    title: "Total Invocations",
                    value: dashboard.lambda.totalInvocations.formatted(),
                    icon: "bolt.fill",
                    color: .blue
                )
                
                MonitoringMetricCard(
                    title: "Total Errors",
                    value: "\(dashboard.lambda.totalErrors)",
                    icon: "exclamationmark.triangle.fill",
                    color: dashboard.lambda.totalErrors > 0 ? .red : .green
                )
                
                MonitoringMetricCard(
                    title: "Avg Duration",
                    value: String(format: "%.0fms", dashboard.lambda.avgDuration),
                    icon: "clock.fill",
                    color: .orange
                )
                
                MonitoringMetricCard(
                    title: "Est. Cost",
                    value: String(format: "$%.4f", dashboard.lambda.totalCost),
                    icon: "dollarsign.circle.fill",
                    color: .purple
                )
            }
            
            // Functions Table
            MonitoringSection(title: "Lambda Functions", icon: "function") {
                VStack(spacing: 8) {
                    ForEach(dashboard.lambda.functions) { fn in
                        LambdaFunctionRow(function: fn, showOverlay: showOverlays)
                    }
                }
            }
            
            // Invocations Chart with Error Overlay
            MonitoringSection(title: "Invocations vs Errors", icon: "chart.xyaxis.line") {
                lambdaInvocationsWithErrorsChart(dashboard: dashboard)
            }
        }
    }
    
    // MARK: - Aurora Section
    
    private func auroraSection(dashboard: MonitoringDashboard) -> some View {
        Group {
            if let aurora = dashboard.aurora {
                VStack(spacing: 24) {
                    // Aurora Metrics Cards
                    HStack(spacing: 16) {
                        MonitoringMetricCard(
                            title: "CPU Utilization",
                            value: String(format: "%.1f%%", aurora.cpuUtilization),
                            icon: "cpu",
                            color: aurora.cpuUtilization > 80 ? .red : aurora.cpuUtilization > 50 ? .orange : .green
                        )
                        
                        MonitoringMetricCard(
                            title: "Connections",
                            value: "\(aurora.databaseConnections)",
                            icon: "link",
                            color: .blue
                        )
                        
                        MonitoringMetricCard(
                            title: "Storage",
                            value: String(format: "%.2f GB", aurora.storageGb),
                            icon: "internaldrive",
                            color: .purple
                        )
                        
                        if let acu = aurora.acu {
                            MonitoringMetricCard(
                                title: "ACU",
                                value: String(format: "%.1f", acu),
                                icon: "bolt.circle",
                                color: .orange
                            )
                        }
                    }
                    
                    HStack(alignment: .top, spacing: 24) {
                        // IOPS Chart
                        MonitoringSection(title: "IOPS", icon: "arrow.up.arrow.down.circle") {
                            auroraIOPSChart(aurora: aurora)
                        }
                        .frame(maxWidth: .infinity)
                        
                        // Latency Chart
                        MonitoringSection(title: "Latency", icon: "clock") {
                            auroraLatencyChart(aurora: aurora)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
            } else {
                VStack(spacing: 16) {
                    Image(systemName: "cylinder.split.1x2")
                        .font(.system(size: 48))
                        .foregroundStyle(.secondary)
                    Text("Aurora not configured")
                        .font(.headline)
                    Text("Enable Aurora monitoring in your configuration")
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(40)
                .background(Color(nsColor: .controlBackgroundColor))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
    }
    
    // MARK: - X-Ray Section
    
    private func xraySection(dashboard: MonitoringDashboard) -> some View {
        VStack(spacing: 24) {
            // X-Ray Summary Cards
            HStack(spacing: 16) {
                MonitoringMetricCard(
                    title: "Total Traces",
                    value: dashboard.xray.totalTraces.formatted(),
                    icon: "waveform.path.ecg",
                    color: .blue
                )
                
                MonitoringMetricCard(
                    title: "Error Rate",
                    value: String(format: "%.2f%%", dashboard.xray.errorRate),
                    icon: "exclamationmark.triangle.fill",
                    color: dashboard.xray.errorRate > 5 ? .red : .green
                )
                
                MonitoringMetricCard(
                    title: "Avg Latency",
                    value: String(format: "%.0fms", dashboard.xray.avgDuration * 1000),
                    icon: "clock.fill",
                    color: .orange
                )
                
                MonitoringMetricCard(
                    title: "P99 Latency",
                    value: String(format: "%.0fms", dashboard.xray.p99Duration * 1000),
                    icon: "gauge.high",
                    color: .purple
                )
            }
            
            HStack(alignment: .top, spacing: 24) {
                // Top Endpoints
                MonitoringSection(title: "Top Endpoints", icon: "link") {
                    VStack(spacing: 8) {
                        ForEach(dashboard.xray.topEndpoints.prefix(5)) { endpoint in
                            MonitoringEndpointRow(endpoint: endpoint)
                        }
                    }
                }
                .frame(maxWidth: .infinity)
                
                // Top Errors
                MonitoringSection(title: "Top Errors", icon: "exclamationmark.circle") {
                    if dashboard.xray.topErrors.isEmpty {
                        VStack(spacing: 8) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.title)
                                .foregroundStyle(.green)
                            Text("No errors")
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(20)
                    } else {
                        VStack(spacing: 8) {
                            ForEach(dashboard.xray.topErrors) { error in
                                ErrorRow(error: error)
                            }
                        }
                    }
                }
                .frame(minWidth: 280, idealWidth: 320, maxWidth: 350)
            }
            
            // Trace Distribution Chart
            MonitoringSection(title: "Trace Status Distribution", icon: "chart.pie") {
                traceStatusChart(xray: dashboard.xray)
            }
        }
    }
    
    // MARK: - Costs Section
    
    private func costsSection(dashboard: MonitoringDashboard) -> some View {
        VStack(spacing: 24) {
            // Cost Summary Cards
            HStack(spacing: 16) {
                MonitoringMetricCard(
                    title: "Total Cost",
                    value: String(format: "$%.2f", dashboard.costs.totalCost),
                    icon: "dollarsign.circle.fill",
                    color: .blue
                )
                
                MonitoringMetricCard(
                    title: "vs Last Period",
                    value: String(format: "%+.1f%%", dashboard.costs.percentChange),
                    icon: dashboard.costs.trend.icon,
                    color: dashboard.costs.trend == .up ? .red : .green
                )
                
                if let forecast = dashboard.costs.forecast {
                    MonitoringMetricCard(
                        title: "Forecast",
                        value: String(format: "$%.2f", forecast.estimatedCost),
                        icon: "chart.line.uptrend.xyaxis",
                        color: .orange
                    )
                }
                
                MonitoringMetricCard(
                    title: "Anomalies",
                    value: "\(dashboard.anomalies.count)",
                    icon: "exclamationmark.triangle.fill",
                    color: dashboard.anomalies.isEmpty ? .green : .red
                )
            }
            
            HStack(alignment: .top, spacing: 24) {
                // Cost by Service
                MonitoringSection(title: "Cost by Service", icon: "chart.pie") {
                    costByServiceChart(dashboard: dashboard)
                }
                .frame(maxWidth: .infinity)
                
                // Cost Breakdown List
                MonitoringSection(title: "Service Breakdown", icon: "list.bullet") {
                    VStack(spacing: 8) {
                        ForEach(dashboard.costs.byService.prefix(8)) { service in
                            CostServiceRow(service: service, total: dashboard.costs.totalCost, showOverlay: showOverlays)
                        }
                    }
                }
                .frame(minWidth: 300, idealWidth: 350, maxWidth: 400)
            }
            
            // Anomalies Section
            if !dashboard.anomalies.isEmpty {
                MonitoringSection(title: "Cost Anomalies", icon: "exclamationmark.triangle.fill") {
                    VStack(spacing: 8) {
                        ForEach(dashboard.anomalies) { anomaly in
                            MonitoringAnomalyRow(anomaly: anomaly)
                        }
                    }
                }
            }
        }
    }
    
    // MARK: - Free Tier Section
    
    private func freeTierSection(dashboard: MonitoringDashboard) -> some View {
        VStack(spacing: 24) {
            // Free Tier Savings Banner
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Free Tier Savings")
                        .font(.headline)
                    Text("Estimated savings from AWS free tier usage this month")
                        .foregroundStyle(.secondary)
                }
                
                Spacer()
                
                Text(String(format: "$%.2f", dashboard.freeTierUsage.totalSavings))
                    .font(.system(size: 36, weight: .bold, design: .rounded))
                    .foregroundStyle(.green)
            }
            .padding(20)
            .background(Color.green.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            
            // Alerts
            if !dashboard.freeTierUsage.exceeded.isEmpty {
                HStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.red)
                    Text("\(dashboard.freeTierUsage.exceeded.count) service(s) exceeded free tier limit")
                        .font(.subheadline)
                    Spacer()
                }
                .padding(12)
                .background(Color.red.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            
            if !dashboard.freeTierUsage.atRisk.isEmpty {
                HStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.orange)
                    Text("\(dashboard.freeTierUsage.atRisk.count) service(s) approaching free tier limit (>80%)")
                        .font(.subheadline)
                    Spacer()
                }
                .padding(12)
                .background(Color.orange.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            
            // Free Tier Services
            MonitoringSection(title: "Free Tier Usage", icon: "gift") {
                VStack(spacing: 12) {
                    ForEach(dashboard.freeTierUsage.services) { service in
                        FreeTierServiceRow(service: service, showOverlay: showOverlays)
                    }
                }
            }
        }
    }
    
    // MARK: - Charts
    
    private func lambdaInvocationsChart(dashboard: MonitoringDashboard) -> some View {
        Chart {
            ForEach(dashboard.lambda.functions) { fn in
                BarMark(
                    x: .value("Function", fn.functionName.replacingOccurrences(of: "radiant-", with: "")),
                    y: .value("Invocations", fn.invocations)
                )
                .foregroundStyle(fn.errors > 0 ? Color.orange : Color.blue)
                .annotation(position: .top) {
                    if fn.errors > 0 && showOverlays {
                        Text("\(fn.errors) err")
                            .font(.caption2)
                            .foregroundStyle(.red)
                    }
                }
            }
        }
        .chartYAxisLabel("Invocations")
        .frame(height: 200)
    }
    
    private func lambdaInvocationsWithErrorsChart(dashboard: MonitoringDashboard) -> some View {
        Chart {
            ForEach(dashboard.lambda.functions) { fn in
                BarMark(
                    x: .value("Function", fn.functionName.replacingOccurrences(of: "radiant-", with: "")),
                    y: .value("Invocations", fn.invocations)
                )
                .foregroundStyle(Color.blue.opacity(0.7))
                
                if showOverlays && fn.errors > 0 {
                    BarMark(
                        x: .value("Function", fn.functionName.replacingOccurrences(of: "radiant-", with: "")),
                        y: .value("Errors", fn.errors)
                    )
                    .foregroundStyle(Color.red.opacity(0.8))
                }
            }
        }
        .chartForegroundStyleScale([
            "Invocations": Color.blue.opacity(0.7),
            "Errors": Color.red.opacity(0.8)
        ])
        .chartLegend(position: .top)
        .frame(height: 250)
    }
    
    private func costByServiceChart(dashboard: MonitoringDashboard) -> some View {
        Chart {
            ForEach(dashboard.costs.byService.prefix(6)) { service in
                BarMark(
                    x: .value("Service", service.service),
                    y: .value("Cost", service.cost)
                )
                .foregroundStyle(by: .value("Service", service.service))
                .annotation(position: .top) {
                    if service.percentageOfTotal > 10 {
                        Text(String(format: "%.0f%%", service.percentageOfTotal))
                            .font(.caption2)
                    }
                }
            }
            
            // Forecast overlay
            if showOverlays, let forecast = dashboard.costs.forecast {
                RuleMark(y: .value("Forecast", forecast.estimatedCost))
                    .foregroundStyle(.orange)
                    .lineStyle(StrokeStyle(lineWidth: 2, dash: [5, 5]))
                    .annotation(position: .top, alignment: .trailing) {
                        Text("Forecast: $\(String(format: "%.2f", forecast.estimatedCost))")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    }
            }
        }
        .chartLegend(position: .trailing, alignment: .center)
        .chartYAxisLabel("Cost ($)")
        .frame(height: 200)
    }
    
    private func latencyDistributionChart(dashboard: MonitoringDashboard) -> some View {
        Chart {
            ForEach(dashboard.lambda.functions) { fn in
                BarMark(
                    x: .value("Function", fn.functionName.replacingOccurrences(of: "radiant-", with: "")),
                    y: .value("P50", fn.duration.p50)
                )
                .foregroundStyle(Color.green)
                .position(by: .value("Percentile", "P50"))
                
                BarMark(
                    x: .value("Function", fn.functionName.replacingOccurrences(of: "radiant-", with: "")),
                    y: .value("P90", fn.duration.p90)
                )
                .foregroundStyle(Color.orange)
                .position(by: .value("Percentile", "P90"))
                
                BarMark(
                    x: .value("Function", fn.functionName.replacingOccurrences(of: "radiant-", with: "")),
                    y: .value("P99", fn.duration.p99)
                )
                .foregroundStyle(Color.red)
                .position(by: .value("Percentile", "P99"))
            }
        }
        .chartForegroundStyleScale([
            "P50": Color.green,
            "P90": Color.orange,
            "P99": Color.red
        ])
        .chartLegend(position: .top)
        .chartYAxisLabel("Duration (ms)")
        .frame(height: 200)
    }
    
    private func auroraIOPSChart(aurora: AuroraMetrics) -> some View {
        Chart {
            BarMark(
                x: .value("Type", "Read"),
                y: .value("IOPS", aurora.readIOPS)
            )
            .foregroundStyle(Color.blue)
            
            BarMark(
                x: .value("Type", "Write"),
                y: .value("IOPS", aurora.writeIOPS)
            )
            .foregroundStyle(Color.purple)
        }
        .chartYAxisLabel("IOPS")
        .frame(height: 150)
    }
    
    private func auroraLatencyChart(aurora: AuroraMetrics) -> some View {
        Chart {
            BarMark(
                x: .value("Type", "Read"),
                y: .value("Latency", aurora.readLatencyMs)
            )
            .foregroundStyle(Color.green)
            
            BarMark(
                x: .value("Type", "Write"),
                y: .value("Latency", aurora.writeLatencyMs)
            )
            .foregroundStyle(Color.orange)
        }
        .chartYAxisLabel("Latency (ms)")
        .frame(height: 150)
    }
    
    private func traceStatusChart(xray: XRayTraceSummary) -> some View {
        let traceData = [
            ("OK", xray.okCount, Color.green),
            ("Error", xray.errorCount, Color.orange),
            ("Fault", xray.faultCount, Color.red),
            ("Throttle", xray.throttleCount, Color.yellow)
        ]
        
        return Chart {
            ForEach(traceData, id: \.0) { name, count, color in
                BarMark(
                    x: .value("Status", name),
                    y: .value("Count", count)
                )
                .foregroundStyle(color)
            }
        }
        .chartLegend(position: .trailing)
        .chartYAxisLabel("Trace Count")
        .frame(height: 200)
    }
    
    private func serviceHealthGrid(dashboard: MonitoringDashboard) -> some View {
        VStack(spacing: 8) {
            ForEach(dashboard.health.services) { service in
                HStack {
                    Circle()
                        .fill(healthColor(service.status))
                        .frame(width: 10, height: 10)
                    
                    Text(service.name.replacingOccurrences(of: "radiant-", with: ""))
                        .font(.subheadline)
                        .lineLimit(1)
                    
                    Spacer()
                    
                    Text(service.status.rawValue.capitalized)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(8)
                .background(healthColor(service.status).opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 6))
            }
        }
    }
    
    // MARK: - Supporting Views
    
    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .controlSize(.large)
            Text("Loading monitoring data...")
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(60)
    }
    
    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "waveform.path.ecg.rectangle")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text("No monitoring data available")
                .font(.headline)
            Text("Connect to a deployed instance to view AWS metrics")
                .foregroundStyle(.secondary)
            
            Button("Configure Monitoring") {
                // Open configuration
            }
            .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity)
        .padding(60)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
    
    // MARK: - Helpers
    
    private func healthColor(_ status: MonitoringHealthLevel) -> Color {
        switch status {
        case .healthy: return .green
        case .degraded: return .orange
        case .unhealthy: return .red
        case .unknown: return .gray
        }
    }
    
    private func loadData() async {
        guard let instance = getActiveInstance() else { return }
        await monitoringService.fetchDashboard(for: instance)
    }
    
    private func refreshData() async {
        isRefreshing = true
        guard let instance = getActiveInstance() else {
            isRefreshing = false
            return
        }
        await monitoringService.forceRefresh(for: instance)
        isRefreshing = false
    }
    
    private func getActiveInstance() -> DeployedInstance? {
        // Get the active deployed instance from app state
        guard let app = appState.selectedApp,
              appState.selectedEnvironment == .prod,
              app.environments.prod.deployed,
              let apiUrl = app.environments.prod.apiUrl else {
            return nil
        }
        
        return DeployedInstance(
            apiEndpoint: apiUrl,
            apiKey: appState.credentials.first?.accessKeyId ?? ""
        )
    }
    
    // MARK: - Tier Settings Section (Free/Paid Toggle Sliders)
    
    @ViewBuilder
    private func tierSettingsSection() -> some View {
        VStack(alignment: .leading, spacing: 20) {
            // Header with explanation
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: "slider.horizontal.3")
                        .font(.title2)
                        .foregroundStyle(.blue)
                    Text("Service Tier Settings")
                        .font(.title2.bold())
                }
                
                Text("Toggle paid tier for each AWS service. Free tier is ON by default. Enable paid tier to allow usage beyond free tier limits.")
                    .foregroundStyle(.secondary)
                    .font(.subheadline)
                
                HStack(spacing: 16) {
                    Label("Free Tier", systemImage: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                    Label("Paid Tier", systemImage: "dollarsign.circle.fill")
                        .foregroundStyle(.orange)
                }
                .font(.caption)
                .padding(.top, 4)
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.blue.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            
            // Service tier toggles grid
            LazyVGrid(columns: [
                GridItem(.flexible(), spacing: 16),
                GridItem(.flexible(), spacing: 16)
            ], spacing: 16) {
                ForEach(AWSServiceType.allCases, id: \.rawValue) { service in
                    ServiceTierToggleCard(
                        service: service,
                        instance: getActiveInstance(),
                        monitoringService: monitoringService
                    )
                }
            }
            
            // Warning about charges
            HStack(spacing: 12) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(.orange)
                    .font(.title3)
                
                VStack(alignment: .leading, spacing: 4) {
                    Text("Billing Warning")
                        .font(.headline)
                    Text("Enabling paid tier may result in AWS charges. Monitor your usage carefully and set budget caps to avoid unexpected costs.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.orange.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }
}

// MARK: - Service Tier Toggle Card

struct ServiceTierToggleCard: View {
    let service: AWSServiceType
    let instance: DeployedInstance?
    @ObservedObject var monitoringService: AWSMonitoringService
    @State private var paidTierEnabled = false
    @State private var autoScaleEnabled = false
    @State private var budgetCap: Double = 0
    @State private var showBudgetInput = false
    @State private var isUpdating = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Service header
            HStack {
                Image(systemName: service.icon)
                    .font(.title3)
                    .foregroundStyle(paidTierEnabled ? .orange : .green)
                    .frame(width: 28)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(service.displayName)
                        .font(.headline)
                    Text(service.freeTierDescription)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                
                Spacer()
                
                // Status badge
                Text(paidTierEnabled ? "PAID" : "FREE")
                    .font(.caption.bold())
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(paidTierEnabled ? Color.orange : Color.green)
                    .foregroundStyle(.white)
                    .clipShape(Capsule())
            }
            
            Divider()
            
            // Paid tier toggle (the main slider button)
            Toggle(isOn: $paidTierEnabled) {
                HStack {
                    Text("Enable Paid Tier")
                        .font(.subheadline)
                    if isUpdating {
                        ProgressView()
                            .controlSize(.small)
                    }
                }
            }
            .toggleStyle(.switch)
            .tint(.orange)
            .onChange(of: paidTierEnabled) { newValue in
                Task {
                    await togglePaidTier(enabled: newValue)
                }
            }
            
            // Auto-scale option (only visible when paid is enabled)
            if paidTierEnabled {
                Toggle(isOn: $autoScaleEnabled) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Auto-scale to Paid")
                            .font(.caption)
                        Text("Automatically enable paid when free tier exceeded")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                .toggleStyle(.switch)
                .tint(.blue)
                .onChange(of: autoScaleEnabled) { newValue in
                    Task {
                        await setAutoScale(enabled: newValue)
                    }
                }
                
                // Budget cap
                HStack {
                    Text("Budget Cap:")
                        .font(.caption)
                    
                    if budgetCap > 0 {
                        Text("$\(String(format: "%.2f", budgetCap))")
                            .font(.caption.bold())
                            .foregroundStyle(.orange)
                    } else {
                        Text("No limit")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    
                    Spacer()
                    
                    Button(action: { showBudgetInput.toggle() }) {
                        Image(systemName: "pencil.circle")
                            .foregroundStyle(.blue)
                    }
                    .buttonStyle(.plain)
                }
                
                if showBudgetInput {
                    HStack {
                        TextField("Max $", value: $budgetCap, format: .number)
                            .textFieldStyle(.roundedBorder)
                            .frame(width: 80)
                        
                        Button("Set") {
                            Task {
                                await setBudgetCap()
                            }
                            showBudgetInput = false
                        }
                        .buttonStyle(.borderedProminent)
                        .controlSize(.small)
                        
                        Button("Clear") {
                            budgetCap = 0
                            Task {
                                await setBudgetCap()
                            }
                            showBudgetInput = false
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                    }
                }
            }
        }
        .padding()
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(paidTierEnabled ? Color.orange.opacity(0.5) : Color.green.opacity(0.3), lineWidth: 2)
        )
    }
    
    private func togglePaidTier(enabled: Bool) async {
        guard let instance = instance else { return }
        isUpdating = true
        let success = await monitoringService.togglePaidTier(
            for: instance,
            service: service.rawValue,
            enabled: enabled
        )
        if !success {
            // Revert toggle on failure
            paidTierEnabled = !enabled
        }
        isUpdating = false
    }
    
    private func setAutoScale(enabled: Bool) async {
        guard let instance = instance else { return }
        let success = await monitoringService.setAutoScale(
            for: instance,
            service: service.rawValue,
            enabled: enabled
        )
        if !success {
            // Revert toggle on failure
            autoScaleEnabled = !enabled
        }
    }
    
    private func setBudgetCap() async {
        guard let instance = instance else { return }
        _ = await monitoringService.setBudgetCap(
            for: instance,
            service: service.rawValue,
            cap: budgetCap
        )
    }
}

// MARK: - Supporting Types

enum MonitoringTab: String, CaseIterable, Identifiable {
    case overview = "Overview"
    case lambda = "Lambda"
    case aurora = "Aurora"
    case xray = "X-Ray"
    case costs = "Costs"
    case freeTier = "Free Tier"
    case tierSettings = "Tier Settings"
    
    var id: String { rawValue }
    
    var icon: String {
        switch self {
        case .overview: return "chart.bar.xaxis"
        case .lambda: return "function"
        case .aurora: return "cylinder.split.1x2"
        case .xray: return "waveform.path.ecg"
        case .costs: return "dollarsign.circle"
        case .freeTier: return "gift"
        case .tierSettings: return "slider.horizontal.3"
        }
    }
}

enum MonitoringTimeRange: String, CaseIterable, Identifiable {
    case hour = "1 Hour"
    case day = "24 Hours"
    case week = "7 Days"
    case month = "30 Days"
    
    var id: String { rawValue }
}

// MARK: - Component Views

struct QuickStatItem: View {
    let title: String
    let value: String
    let subtitle: String
    let color: Color
    let icon: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.caption)
                    .foregroundStyle(color)
                Text(title)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Text(value)
                .font(.system(.title3, design: .rounded).bold())
            Text(subtitle)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }
}

struct MonitoringMetricCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundStyle(color)
                Spacer()
            }
            
            Text(value)
                .font(.system(size: 24, weight: .bold, design: .rounded))
            
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

struct MonitoringSection<Content: View>: View {
    let title: String
    let icon: String
    @ViewBuilder let content: Content
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .foregroundStyle(.secondary)
                Text(title)
                    .font(.headline)
            }
            
            content
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

struct LambdaFunctionRow: View {
    let function: LambdaMetrics
    let showOverlay: Bool
    
    var body: some View {
        HStack {
            Circle()
                .fill(function.healthStatus == .healthy ? .green : function.healthStatus == .degraded ? .orange : .red)
                .frame(width: 8, height: 8)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(function.functionName.replacingOccurrences(of: "radiant-", with: ""))
                    .font(.subheadline.weight(.medium))
                Text("\(function.invocations.formatted()) invocations")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            if showOverlay && function.errors > 0 {
                Text("\(function.errors) errors")
                    .font(.caption)
                    .foregroundStyle(.red)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(Color.red.opacity(0.1))
                    .clipShape(Capsule())
            }
            
            VStack(alignment: .trailing, spacing: 2) {
                Text(String(format: "%.0fms", function.duration.avg))
                    .font(.subheadline.monospacedDigit())
                Text("avg")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            
            VStack(alignment: .trailing, spacing: 2) {
                Text(String(format: "$%.4f", function.costEstimate))
                    .font(.subheadline.monospacedDigit())
                Text("cost")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .frame(width: 70)
        }
        .padding(10)
        .background(Color(nsColor: .windowBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct MonitoringEndpointRow: View {
    let endpoint: EndpointSummary
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(endpoint.url)
                    .font(.subheadline)
                    .lineLimit(1)
                Text("\(endpoint.count) requests")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 2) {
                Text(String(format: "%.0fms", endpoint.avgDuration * 1000))
                    .font(.subheadline.monospacedDigit())
                if endpoint.errorRate > 0 {
                    Text(String(format: "%.1f%% err", endpoint.errorRate * 100))
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }
        }
        .padding(8)
        .background(Color(nsColor: .windowBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }
}

struct ErrorRow: View {
    let error: ErrorSummary
    
    var body: some View {
        HStack {
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundStyle(.red)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(error.message)
                    .font(.subheadline)
                Text("\(error.count) occurrences")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
        }
        .padding(8)
        .background(Color.red.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }
}

struct CostServiceRow: View {
    let service: CostByService
    let total: Double
    let showOverlay: Bool
    
    var body: some View {
        VStack(spacing: 6) {
            HStack {
                Text(service.service)
                    .font(.subheadline)
                
                Spacer()
                
                Text(String(format: "$%.2f", service.cost))
                    .font(.subheadline.monospacedDigit())
                
                Text(String(format: "%.0f%%", service.percentageOfTotal))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(width: 40, alignment: .trailing)
            }
            
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 3)
                        .fill(Color.blue.opacity(0.2))
                        .frame(height: 6)
                    
                    RoundedRectangle(cornerRadius: 3)
                        .fill(Color.blue)
                        .frame(width: geometry.size.width * service.percentageOfTotal / 100, height: 6)
                    
                    if showOverlay && service.change != 0 {
                        Rectangle()
                            .fill(service.change > 0 ? Color.red.opacity(0.5) : Color.green.opacity(0.5))
                            .frame(width: 2, height: 10)
                            .offset(x: geometry.size.width * service.percentageOfTotal / 100 - 1)
                    }
                }
            }
            .frame(height: 6)
        }
    }
}

struct MonitoringAnomalyRow: View {
    let anomaly: CostAnomaly
    
    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(severityColor(anomaly.severity))
                .frame(width: 10, height: 10)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(anomaly.service)
                    .font(.subheadline.weight(.medium))
                Text("Impact: +\(String(format: "%.0f", anomaly.impact))%")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 2) {
                Text(String(format: "$%.2f", anomaly.actualCost))
                    .font(.subheadline.monospacedDigit())
                Text("vs $\(String(format: "%.2f", anomaly.expectedCost)) expected")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            Text(anomaly.status.rawValue.capitalized)
                .font(.caption)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(anomaly.status == .resolved ? Color.green.opacity(0.2) : Color.orange.opacity(0.2))
                .clipShape(Capsule())
        }
        .padding(12)
        .background(severityColor(anomaly.severity).opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
    
    private func severityColor(_ severity: AnomalySeverity) -> Color {
        switch severity {
        case .low: return .gray
        case .medium: return .yellow
        case .high: return .orange
        case .critical: return .red
        }
    }
}

struct FreeTierServiceRow: View {
    let service: FreeTierService
    let showOverlay: Bool
    
    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Image(systemName: service.status.icon)
                    .foregroundStyle(statusColor(service.status))
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(service.service)
                        .font(.subheadline.weight(.medium))
                    Text(service.metric)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                Spacer()
                
                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(service.used.formatted()) / \(service.limit.formatted())")
                        .font(.subheadline.monospacedDigit())
                    Text(service.unit)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(statusColor(service.status).opacity(0.2))
                        .frame(height: 8)
                    
                    RoundedRectangle(cornerRadius: 4)
                        .fill(statusColor(service.status))
                        .frame(width: geometry.size.width * min(service.percentUsed, 100) / 100, height: 8)
                    
                    // Free tier limit marker
                    if showOverlay {
                        Rectangle()
                            .fill(Color.primary)
                            .frame(width: 2, height: 12)
                            .offset(x: geometry.size.width - 1, y: -2)
                    }
                }
            }
            .frame(height: 8)
            
            HStack {
                Text(String(format: "%.1f%% used", service.percentUsed))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                
                Spacer()
                
                Text("Resets: \(formatDate(service.resetDate))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .background(statusColor(service.status).opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
    
    private func statusColor(_ status: FreeTierStatus) -> Color {
        switch status {
        case .ok: return .green
        case .warning: return .orange
        case .exceeded: return .red
        }
    }
    
    private func formatDate(_ dateString: String) -> String {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: dateString) else { return dateString }
        let displayFormatter = DateFormatter()
        displayFormatter.dateStyle = .short
        return displayFormatter.string(from: date)
    }
}

// MARK: - Preview

#Preview {
    AWSMonitoringView()
        .environmentObject(AppState())
        .frame(width: 1200, height: 900)
}
