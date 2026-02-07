// RADIANT v7.2.0 - Network Diagnostics View
// UI for DNS, SSL, connectivity, and latency testing

import SwiftUI

struct NetworkDiagnosticsView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedEnvironment = "dev"
    @State private var customEndpoints: String = ""
    @State private var isRunning = false
    @State private var report: NetworkDiagnosticsService.DiagnosticReport?
    @State private var progressMessages: [String] = []
    @State private var selectedTab = 0
    
    private let environments = ["dev", "staging", "prod"]
    
    private var defaultEndpoints: [String] {
        [
            "https://api.\(selectedEnvironment).radiant.example.com",
            "https://\(selectedEnvironment).radiant.example.com"
        ]
    }
    
    var body: some View {
        VStack(spacing: 0) {
            toolbar
            Divider()
            
            if isRunning {
                runningView
            } else if let report = report {
                resultsView(report: report)
            } else {
                configurationView
            }
        }
    }
    
    private var toolbar: some View {
        HStack {
            Image(systemName: "network")
                .font(.title2)
            Text("Network Diagnostics")
                .font(.headline)
            
            Spacer()
            
            if let report = report {
                statusBadge(status: report.overallStatus)
            }
            
            Picker("Environment", selection: $selectedEnvironment) {
                ForEach(environments, id: \.self) { env in
                    Text(env.capitalized).tag(env)
                }
            }
            .frame(width: 120)
            
            Button {
                runDiagnostics()
            } label: {
                Label("Run Tests", systemImage: "play.fill")
            }
            .buttonStyle(.borderedProminent)
            .disabled(isRunning)
        }
        .padding()
    }
    
    private var configurationView: some View {
        VStack(spacing: 20) {
            GroupBox("Endpoints to Test") {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Default endpoints for \(selectedEnvironment):")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    ForEach(defaultEndpoints, id: \.self) { endpoint in
                        HStack {
                            Image(systemName: "link")
                                .foregroundColor(.secondary)
                            Text(endpoint)
                                .font(.caption.monospaced())
                        }
                    }
                    
                    Divider()
                    
                    Text("Additional endpoints (one per line):")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    TextEditor(text: $customEndpoints)
                        .font(.caption.monospaced())
                        .frame(height: 80)
                        .border(Color.gray.opacity(0.3))
                }
                .padding(.vertical, 8)
            }
            
            GroupBox("Tests to Run") {
                VStack(alignment: .leading, spacing: 8) {
                    testRow(icon: "globe", title: "DNS Resolution", description: "Verify hostnames resolve correctly")
                    testRow(icon: "lock.shield", title: "SSL Certificate", description: "Check certificate validity and expiration")
                    testRow(icon: "link", title: "HTTP Connectivity", description: "Test endpoint reachability and response")
                    testRow(icon: "timer", title: "Latency", description: "Measure network latency with ping")
                    testRow(icon: "network", title: "Port Scan", description: "Check common service ports")
                }
                .padding(.vertical, 8)
            }
            
            Button {
                runDiagnostics()
            } label: {
                Label("Start Diagnostics", systemImage: "play.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
        }
        .padding()
        .frame(maxWidth: 600)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    private func testRow(icon: String, title: String, description: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .frame(width: 24)
                .foregroundColor(.accentColor)
            VStack(alignment: .leading) {
                Text(title).font(.subheadline.bold())
                Text(description).font(.caption).foregroundColor(.secondary)
            }
            Spacer()
            Image(systemName: "checkmark.circle.fill")
                .foregroundColor(.green)
        }
    }
    
    private var runningView: some View {
        VStack(spacing: 20) {
            ProgressView()
                .scaleEffect(1.5)
            Text("Running diagnostics...")
                .font(.headline)
            
            VStack(alignment: .leading, spacing: 4) {
                ForEach(progressMessages.suffix(8), id: \.self) { msg in
                    HStack {
                        Image(systemName: "chevron.right")
                            .font(.caption2)
                            .foregroundColor(.accentColor)
                        Text(msg)
                            .font(.caption.monospaced())
                            .foregroundColor(.secondary)
                    }
                }
            }
            .frame(maxWidth: 400, alignment: .leading)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    private func resultsView(report: NetworkDiagnosticsService.DiagnosticReport) -> some View {
        VStack(spacing: 0) {
            summaryBar(report: report)
            Divider()
            
            TabView(selection: $selectedTab) {
                dnsResultsTab(results: report.dnsResults)
                    .tabItem { Label("DNS", systemImage: "globe") }
                    .tag(0)
                
                sslResultsTab(results: report.sslResults)
                    .tabItem { Label("SSL", systemImage: "lock.shield") }
                    .tag(1)
                
                connectivityResultsTab(results: report.connectivityResults)
                    .tabItem { Label("Connectivity", systemImage: "link") }
                    .tag(2)
                
                latencyResultsTab(results: report.latencyResults)
                    .tabItem { Label("Latency", systemImage: "timer") }
                    .tag(3)
                
                portResultsTab(results: report.portCheckResults)
                    .tabItem { Label("Ports", systemImage: "network") }
                    .tag(4)
            }
        }
    }
    
    private func summaryBar(report: NetworkDiagnosticsService.DiagnosticReport) -> some View {
        HStack(spacing: 20) {
            statusBadge(status: report.overallStatus)
            
            Text(report.summary)
                .font(.subheadline)
                .foregroundColor(.secondary)
            
            Spacer()
            
            Text(report.timestamp.formatted(date: .abbreviated, time: .shortened))
                .font(.caption)
                .foregroundColor(.secondary)
            
            Button("Re-run") { runDiagnostics() }
                .buttonStyle(.bordered)
        }
        .padding()
        .background(Color(.textBackgroundColor).opacity(0.5))
    }
    
    private func dnsResultsTab(results: [NetworkDiagnosticsService.DNSResult]) -> some View {
        List(results) { result in
            HStack(spacing: 12) {
                statusIcon(status: result.status)
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(result.hostname)
                        .font(.subheadline.bold())
                    
                    if !result.resolvedIPs.isEmpty {
                        Text(result.resolvedIPs.joined(separator: ", "))
                            .font(.caption.monospaced())
                            .foregroundColor(.secondary)
                    }
                    
                    if let error = result.error {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.red)
                    }
                }
                
                Spacer()
                
                VStack(alignment: .trailing) {
                    Text(String(format: "%.0fms", result.responseTime * 1000))
                        .font(.caption.monospaced())
                    Text(result.recordType)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
            .padding(.vertical, 4)
        }
    }
    
    private func sslResultsTab(results: [NetworkDiagnosticsService.SSLResult]) -> some View {
        List(results) { result in
            HStack(spacing: 12) {
                statusIcon(status: result.status)
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(result.hostname)
                        .font(.subheadline.bold())
                    
                    if let issuer = result.issuer {
                        Text("Issuer: \(issuer)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    }
                    
                    if let error = result.error {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.red)
                    }
                }
                
                Spacer()
                
                if let days = result.daysUntilExpiry {
                    VStack(alignment: .trailing) {
                        Text("\(days) days")
                            .font(.subheadline.bold())
                            .foregroundColor(days <= 30 ? .orange : .green)
                        Text("until expiry")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }
            .padding(.vertical, 4)
        }
    }
    
    private func connectivityResultsTab(results: [NetworkDiagnosticsService.ConnectivityResult]) -> some View {
        List(results) { result in
            HStack(spacing: 12) {
                statusIcon(status: result.status)
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(result.endpoint)
                        .font(.subheadline.bold())
                        .lineLimit(1)
                    
                    HStack(spacing: 8) {
                        if let status = result.httpStatus {
                            Text("HTTP \(status)")
                                .font(.caption)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(httpStatusColor(status).opacity(0.2))
                                .foregroundColor(httpStatusColor(status))
                                .cornerRadius(4)
                        }
                        
                        Text("\(result.bytesReceived) bytes")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    if let error = result.error {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.red)
                    }
                }
                
                Spacer()
                
                Text(String(format: "%.0fms", result.responseTime * 1000))
                    .font(.caption.monospaced())
            }
            .padding(.vertical, 4)
        }
    }
    
    private func latencyResultsTab(results: [NetworkDiagnosticsService.LatencyResult]) -> some View {
        List(results) { result in
            HStack(spacing: 12) {
                statusIcon(status: result.status)
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(result.endpoint)
                        .font(.subheadline.bold())
                    
                    HStack(spacing: 16) {
                        latencyStat(label: "Min", value: result.minLatency)
                        latencyStat(label: "Avg", value: result.avgLatency)
                        latencyStat(label: "Max", value: result.maxLatency)
                    }
                }
                
                Spacer()
                
                VStack(alignment: .trailing) {
                    Text(String(format: "%.1f%%", result.packetLoss))
                        .font(.subheadline.bold())
                        .foregroundColor(result.packetLoss > 0 ? .red : .green)
                    Text("packet loss")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
            .padding(.vertical, 4)
        }
    }
    
    private func latencyStat(label: String, value: TimeInterval) -> some View {
        VStack(spacing: 2) {
            Text(String(format: "%.0fms", value * 1000))
                .font(.caption.monospaced())
            Text(label)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
    }
    
    private func portResultsTab(results: [NetworkDiagnosticsService.PortCheckResult]) -> some View {
        List(results) { result in
            HStack(spacing: 12) {
                statusIcon(status: result.status)
                
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("\(result.host):\(result.port)")
                            .font(.subheadline.bold())
                        
                        if let service = result.serviceName {
                            Text("(\(service))")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    
                    Text(result.isOpen ? "Port is open" : "Port is closed/filtered")
                        .font(.caption)
                        .foregroundColor(result.isOpen ? .green : .red)
                }
                
                Spacer()
                
                Text(String(format: "%.0fms", result.responseTime * 1000))
                    .font(.caption.monospaced())
            }
            .padding(.vertical, 4)
        }
    }
    
    private func statusBadge(status: NetworkDiagnosticsService.TestStatus) -> some View {
        HStack(spacing: 4) {
            Image(systemName: status.icon)
            Text(status.rawValue)
                .font(.caption.bold())
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(statusColor(status).opacity(0.2))
        .foregroundColor(statusColor(status))
        .cornerRadius(6)
    }
    
    private func statusIcon(status: NetworkDiagnosticsService.TestStatus) -> some View {
        Image(systemName: status.icon)
            .foregroundColor(statusColor(status))
            .frame(width: 20)
    }
    
    private func statusColor(_ status: NetworkDiagnosticsService.TestStatus) -> Color {
        switch status {
        case .passed: return .green
        case .failed: return .red
        case .warning: return .orange
        case .skipped: return .gray
        }
    }
    
    private func httpStatusColor(_ status: Int) -> Color {
        switch status {
        case 200..<300: return .green
        case 300..<400: return .blue
        case 400..<500: return .orange
        default: return .red
        }
    }
    
    private func runDiagnostics() {
        isRunning = true
        progressMessages = []
        report = nil
        
        var endpoints = defaultEndpoints
        let custom = customEndpoints.components(separatedBy: "\n").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        endpoints.append(contentsOf: custom)
        
        Task {
            let result = await NetworkDiagnosticsService.shared.runFullDiagnostics(
                environment: selectedEnvironment,
                endpoints: endpoints
            ) { message in
                Task { @MainActor in
                    progressMessages.append(message)
                }
            }
            
            await MainActor.run {
                report = result
                isRunning = false
            }
        }
    }
}
