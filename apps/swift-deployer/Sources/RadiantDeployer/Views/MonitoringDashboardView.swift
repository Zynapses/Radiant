// RADIANT v7.2.0 - Monitoring Dashboard View
// Real-time CloudWatch metrics visualization

import SwiftUI
import Charts

struct MonitoringDashboardView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedEnvironment: String = "dev"
    @State private var selectedTimeRange: CloudWatchMonitoringService.TimeRange = .oneHour
    @State private var snapshot: CloudWatchMonitoringService.DashboardSnapshot?
    @State private var isLoading: Bool = false
    @State private var autoRefresh: Bool = true
    @State private var refreshTask: Task<Void, Never>?
    @State private var selectedService: CloudWatchMonitoringService.MetricNamespace?
    @State private var showingAlertDetails: Bool = false
    @State private var selectedAlert: CloudWatchMonitoringService.DashboardSnapshot.Alert?
    @State private var errorMessage: String?
    
    private let environments = ["dev", "staging", "prod"]
    
    var body: some View {
        VStack(spacing: 0) {
            // Toolbar
            toolbar
            
            Divider()
            
            if isLoading && snapshot == nil {
                loadingView
            } else if let snapshot = snapshot {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        // Overview Cards
                        overviewSection(snapshot: snapshot)
                        
                        // Alerts Section
                        if !snapshot.alerts.isEmpty {
                            alertsSection(alerts: snapshot.alerts)
                        }
                        
                        // Services Grid
                        servicesSection(services: snapshot.services)
                        
                        // Selected Service Detail
                        if let selected = selectedService,
                           let service = snapshot.services.first(where: { $0.namespace == selected }) {
                            serviceDetailSection(service: service)
                        }
                        
                        // Cost Estimate
                        if let cost = snapshot.costEstimate {
                            costSection(cost: cost)
                        }
                    }
                    .padding()
                }
            } else {
                emptyStateView
            }
        }
        .onAppear {
            startMonitoring()
        }
        .onDisappear {
            stopMonitoring()
        }
        .onChange(of: selectedEnvironment) { _, _ in
            restartMonitoring()
        }
        .alert("Alert Details", isPresented: $showingAlertDetails) {
            Button("Acknowledge") {
                // Acknowledge alert
            }
            Button("Dismiss", role: .cancel) { }
        } message: {
            if let alert = selectedAlert {
                Text("\(alert.service) - \(alert.metric)\n\n\(alert.message)")
            }
        }
    }
    
    // MARK: - Toolbar
    
    private var toolbar: some View {
        HStack(spacing: 16) {
            // Environment Picker
            Picker("Environment", selection: $selectedEnvironment) {
                ForEach(environments, id: \.self) { env in
                    Text(env.capitalized).tag(env)
                }
            }
            .pickerStyle(.segmented)
            .frame(width: 250)
            
            // Time Range Picker
            Picker("Time Range", selection: $selectedTimeRange) {
                ForEach(CloudWatchMonitoringService.TimeRange.allCases, id: \.self) { range in
                    Text(range.displayName).tag(range)
                }
            }
            .frame(width: 120)
            
            Spacer()
            
            // Auto-refresh toggle
            Toggle(isOn: $autoRefresh) {
                Label("Auto-refresh", systemImage: "arrow.clockwise")
            }
            .toggleStyle(.checkbox)
            .onChange(of: autoRefresh) { _, newValue in
                if newValue {
                    startMonitoring()
                } else {
                    stopMonitoring()
                }
            }
            
            // Manual refresh
            Button {
                Task { await refreshData() }
            } label: {
                Label("Refresh", systemImage: "arrow.clockwise")
            }
            .disabled(isLoading)
            
            // Last updated
            if let snapshot = snapshot {
                Text("Updated: \(snapshot.timestamp.formatted(date: .omitted, time: .shortened))")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
    }
    
    // MARK: - Overview Section
    
    private func overviewSection(snapshot: CloudWatchMonitoringService.DashboardSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Overview")
                .font(.headline)
            
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 16) {
                // Health Summary
                overviewCard(
                    title: "Services Health",
                    value: "\(snapshot.services.filter { $0.status == .healthy }.count)/\(snapshot.services.count)",
                    subtitle: "Healthy",
                    icon: "heart.fill",
                    color: overallHealthColor(services: snapshot.services)
                )
                
                // Active Alerts
                overviewCard(
                    title: "Active Alerts",
                    value: "\(snapshot.alerts.filter { !$0.acknowledged }.count)",
                    subtitle: snapshot.alerts.isEmpty ? "All clear" : "\(snapshot.alerts.filter { $0.severity == .critical }.count) critical",
                    icon: "bell.fill",
                    color: snapshot.alerts.isEmpty ? .green : .orange
                )
                
                // Hourly Cost
                if let cost = snapshot.costEstimate {
                    overviewCard(
                        title: "Hourly Cost",
                        value: String(format: "$%.2f", cost.hourlyRate),
                        subtitle: String(format: "~$%.0f/month", cost.monthlyProjection),
                        icon: "dollarsign.circle.fill",
                        color: .blue
                    )
                }
                
                // Environment
                overviewCard(
                    title: "Environment",
                    value: snapshot.environment.uppercased(),
                    subtitle: snapshot.region,
                    icon: "server.rack",
                    color: environmentColor(snapshot.environment)
                )
            }
        }
    }
    
    private func overviewCard(title: String, value: String, subtitle: String, icon: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(color)
                Text(title)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Text(value)
                .font(.title2.bold())
            
            Text(subtitle)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.textBackgroundColor).opacity(0.5))
        .cornerRadius(12)
    }
    
    // MARK: - Alerts Section
    
    private func alertsSection(alerts: [CloudWatchMonitoringService.DashboardSnapshot.Alert]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Active Alerts")
                    .font(.headline)
                
                Spacer()
                
                Text("\(alerts.count) alert\(alerts.count == 1 ? "" : "s")")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            VStack(spacing: 8) {
                ForEach(alerts.prefix(5)) { alert in
                    alertRow(alert: alert)
                }
                
                if alerts.count > 5 {
                    Button("View all \(alerts.count) alerts") {
                        // Show all alerts
                    }
                    .font(.caption)
                }
            }
            .padding()
            .background(Color(.textBackgroundColor).opacity(0.5))
            .cornerRadius(12)
        }
    }
    
    private func alertRow(alert: CloudWatchMonitoringService.DashboardSnapshot.Alert) -> some View {
        HStack(spacing: 12) {
            Image(systemName: alert.severity.icon)
                .foregroundColor(alertColor(alert.severity))
            
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(alert.service)
                        .font(.subheadline.bold())
                    Text("•")
                        .foregroundColor(.secondary)
                    Text(alert.metric)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                
                Text(alert.message)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }
            
            Spacer()
            
            Text(alert.timestamp.formatted(date: .omitted, time: .shortened))
                .font(.caption2)
                .foregroundColor(.secondary)
            
            Button {
                selectedAlert = alert
                showingAlertDetails = true
            } label: {
                Image(systemName: "chevron.right")
                    .foregroundColor(.secondary)
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 4)
    }
    
    // MARK: - Services Section
    
    private func servicesSection(services: [CloudWatchMonitoringService.ServiceHealth]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Services")
                .font(.headline)
            
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 12) {
                ForEach(services) { service in
                    serviceCard(service: service)
                        .onTapGesture {
                            withAnimation {
                                if selectedService == service.namespace {
                                    selectedService = nil
                                } else {
                                    selectedService = service.namespace
                                }
                            }
                        }
                }
            }
        }
    }
    
    private func serviceCard(service: CloudWatchMonitoringService.ServiceHealth) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: service.namespace.icon)
                    .font(.title2)
                    .foregroundColor(statusColor(service.status))
                
                Spacer()
                
                Image(systemName: service.status.icon)
                    .foregroundColor(statusColor(service.status))
            }
            
            Text(service.serviceName)
                .font(.subheadline.bold())
            
            Text(service.status.rawValue)
                .font(.caption)
                .foregroundColor(statusColor(service.status))
            
            if let topMetric = service.metrics.first {
                Divider()
                HStack {
                    Text(topMetric.name)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    Spacer()
                    Text("\(String(format: "%.1f", topMetric.value))\(topMetric.unit)")
                        .font(.caption2.monospaced())
                }
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.textBackgroundColor).opacity(0.5))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(selectedService == service.namespace ? Color.accentColor : Color.clear, lineWidth: 2)
                )
        )
    }
    
    // MARK: - Service Detail Section
    
    private func serviceDetailSection(service: CloudWatchMonitoringService.ServiceHealth) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: service.namespace.icon)
                    .font(.title2)
                    .foregroundColor(statusColor(service.status))
                
                Text("\(service.serviceName) Details")
                    .font(.headline)
                
                Spacer()
                
                Button {
                    selectedService = nil
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
            }
            
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 12) {
                ForEach(service.metrics) { metric in
                    metricDetailCard(metric: metric)
                }
            }
        }
        .padding()
        .background(Color(.textBackgroundColor).opacity(0.5))
        .cornerRadius(12)
    }
    
    private func metricDetailCard(metric: CloudWatchMonitoringService.ServiceHealth.MetricSummary) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(metric.name)
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Spacer()
                
                Image(systemName: metric.trend.icon)
                    .foregroundColor(trendColor(metric.trend))
                    .font(.caption)
            }
            
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(String(format: "%.1f", metric.value))
                    .font(.title2.bold())
                Text(metric.unit)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            if let threshold = metric.threshold {
                HStack(spacing: 4) {
                    Circle()
                        .fill(thresholdColor(value: metric.value, threshold: threshold))
                        .frame(width: 6, height: 6)
                    Text("Warning: \(String(format: "%.0f", threshold.warning)) | Critical: \(String(format: "%.0f", threshold.critical))")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding()
        .background(Color(.windowBackgroundColor))
        .cornerRadius(8)
    }
    
    // MARK: - Cost Section
    
    private func costSection(cost: CloudWatchMonitoringService.DashboardSnapshot.CostEstimate) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Cost Estimate")
                .font(.headline)
            
            HStack(spacing: 20) {
                VStack(alignment: .leading) {
                    Text("Hourly")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(String(format: "$%.3f", cost.hourlyRate))
                        .font(.title3.bold())
                }
                
                Divider()
                    .frame(height: 40)
                
                VStack(alignment: .leading) {
                    Text("Daily (projected)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(String(format: "$%.2f", cost.dailyProjection))
                        .font(.title3.bold())
                }
                
                Divider()
                    .frame(height: 40)
                
                VStack(alignment: .leading) {
                    Text("Monthly (projected)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(String(format: "$%.0f", cost.monthlyProjection))
                        .font(.title3.bold())
                }
                
                Spacer()
            }
            .padding()
            .background(Color(.textBackgroundColor).opacity(0.5))
            .cornerRadius(12)
            
            // Breakdown
            if !cost.breakdown.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Cost Breakdown")
                        .font(.subheadline.bold())
                    
                    ForEach(cost.breakdown.sorted(by: { $0.value > $1.value }), id: \.key) { service, hourlyRate in
                        HStack {
                            Text(service)
                                .font(.caption)
                            Spacer()
                            Text(String(format: "$%.4f/hr", hourlyRate))
                                .font(.caption.monospaced())
                                .foregroundColor(.secondary)
                        }
                    }
                }
                .padding()
                .background(Color(.textBackgroundColor).opacity(0.3))
                .cornerRadius(8)
            }
        }
    }
    
    // MARK: - Empty & Loading States
    
    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.5)
            Text("Loading metrics...")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "chart.bar.xaxis")
                .font(.system(size: 48))
                .foregroundColor(.secondary)
            
            Text("No Monitoring Data")
                .font(.headline)
            
            Text("Select an environment and click Refresh to load metrics")
                .font(.subheadline)
                .foregroundColor(.secondary)
            
            Button("Load Metrics") {
                Task { await refreshData() }
            }
            .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    // MARK: - Helper Methods
    
    private func startMonitoring() {
        guard autoRefresh else { return }
        stopMonitoring()
        
        refreshTask = Task {
            while !Task.isCancelled {
                await refreshData()
                try? await Task.sleep(nanoseconds: 60_000_000_000) // 60 seconds
            }
        }
    }
    
    private func stopMonitoring() {
        refreshTask?.cancel()
        refreshTask = nil
    }
    
    private func restartMonitoring() {
        stopMonitoring()
        snapshot = nil
        startMonitoring()
    }
    
    private func refreshData() async {
        guard let app = appState.apps.first else { return }
        
        isLoading = true
        defer { isLoading = false }
        
        do {
            let newSnapshot = try await CloudWatchMonitoringService.shared.fetchDashboardSnapshot(
                appId: app.id,
                environment: selectedEnvironment,
                region: "us-east-1",
                timeRange: selectedTimeRange
            )
            await MainActor.run {
                self.snapshot = newSnapshot
                self.errorMessage = nil
            }
        } catch {
            await MainActor.run {
                self.errorMessage = error.localizedDescription
            }
        }
    }
    
    private func overallHealthColor(services: [CloudWatchMonitoringService.ServiceHealth]) -> Color {
        if services.contains(where: { $0.status == .unhealthy }) {
            return .red
        } else if services.contains(where: { $0.status == .degraded }) {
            return .orange
        } else if services.allSatisfy({ $0.status == .healthy }) {
            return .green
        } else {
            return .gray
        }
    }
    
    private func statusColor(_ status: CloudWatchMonitoringService.ServiceHealth.HealthStatus) -> Color {
        switch status {
        case .healthy: return .green
        case .degraded: return .orange
        case .unhealthy: return .red
        case .unknown: return .gray
        }
    }
    
    private func alertColor(_ severity: CloudWatchMonitoringService.DashboardSnapshot.Alert.Severity) -> Color {
        switch severity {
        case .critical: return .red
        case .warning: return .orange
        case .info: return .blue
        }
    }
    
    private func environmentColor(_ env: String) -> Color {
        switch env {
        case "prod": return .red
        case "staging": return .orange
        case "dev": return .green
        default: return .blue
        }
    }
    
    private func trendColor(_ trend: CloudWatchMonitoringService.ServiceHealth.MetricSummary.Trend) -> Color {
        switch trend {
        case .up: return .orange
        case .down: return .green
        case .stable: return .gray
        }
    }
    
    private func thresholdColor(value: Double, threshold: CloudWatchMonitoringService.ServiceHealth.MetricSummary.Threshold) -> Color {
        if value >= threshold.critical {
            return .red
        } else if value >= threshold.warning {
            return .orange
        } else {
            return .green
        }
    }
}
