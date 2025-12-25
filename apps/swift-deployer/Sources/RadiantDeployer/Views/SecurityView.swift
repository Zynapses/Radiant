// RADIANT v4.18.0 - Security View
// Security dashboard with anomaly detection, alerts, and threat monitoring

import SwiftUI

enum SecurityTimeRange: String, CaseIterable, Identifiable {
    case hour = "1 Hour"
    case day = "24 Hours"
    case week = "7 Days"
    case month = "30 Days"
    
    var id: String { rawValue }
}

enum ThreatLevel: String, CaseIterable {
    case low = "Low"
    case medium = "Medium"
    case high = "High"
    case critical = "Critical"
    
    var color: Color {
        switch self {
        case .low: return .green
        case .medium: return .yellow
        case .high: return .orange
        case .critical: return .red
        }
    }
    
    var icon: String {
        switch self {
        case .low: return "checkmark.shield"
        case .medium: return "exclamationmark.shield"
        case .high: return "exclamationmark.triangle"
        case .critical: return "xmark.shield"
        }
    }
}

struct SecurityAlert: Identifiable {
    let id: String
    let severity: ThreatLevel
    let title: String
    let description: String
    let timestamp: Date
    let source: String
    var isAcknowledged: Bool
}

struct AnomalyEvent: Identifiable {
    let id: String
    let type: String
    let description: String
    let confidence: Double
    let timestamp: Date
    let isResolved: Bool
}

struct SecurityView: View {
    @EnvironmentObject var appState: AppState
    @State private var isScanning = false
    @State private var selectedTimeRange: SecurityTimeRange = .day
    @State private var neuralEngineEnabled = true
    @State private var activeAlerts: [SecurityAlert] = []
    @State private var anomalies: [AnomalyEvent] = []
    
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                headerSection
                threatLevelSection
                alertsSection
                
                HStack(alignment: .top, spacing: 24) {
                    VStack(spacing: 24) {
                        anomalyDetectionSection
                        recentEventsSection
                    }
                    .frame(maxWidth: .infinity)
                    
                    VStack(spacing: 24) {
                        securityScoreSection
                        quickActionsSection
                    }
                    .frame(width: 320)
                }
            }
            .padding(24)
        }
        .background(Color(nsColor: .windowBackgroundColor))
        .onAppear { loadSecurityData() }
    }
    
    private var headerSection: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Security Dashboard")
                    .font(.largeTitle.bold())
                Text("Monitor threats, anomalies, and security events")
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            Picker("Time Range", selection: $selectedTimeRange) {
                ForEach(SecurityTimeRange.allCases) { range in
                    Text(range.rawValue).tag(range)
                }
            }
            .pickerStyle(.segmented)
            .frame(width: 250)
            
            Button {
                runSecurityScan()
            } label: {
                if isScanning {
                    ProgressView().controlSize(.small)
                } else {
                    Label("Run Scan", systemImage: "shield.lefthalf.filled")
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(isScanning)
        }
    }
    
    private var threatLevelSection: some View {
        HStack(spacing: 16) {
            ForEach(ThreatLevel.allCases, id: \.self) { level in
                ThreatLevelCard(level: level, isActive: level == .low)
            }
        }
    }
    
    private var alertsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Active Alerts")
                    .font(.headline)
                Spacer()
                Text("\(activeAlerts.count) alerts")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            if activeAlerts.isEmpty {
                HStack {
                    Image(systemName: "checkmark.shield.fill")
                        .font(.title)
                        .foregroundStyle(.green)
                    Text("No active security alerts")
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 24)
                .background(Color.green.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            } else {
                VStack(spacing: 8) {
                    ForEach(activeAlerts) { alert in
                        SecurityAlertRow(alert: alert)
                    }
                }
            }
        }
        .padding(20)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
    
    private var anomalyDetectionSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Anomaly Detection")
                    .font(.headline)
                Spacer()
                Toggle("Neural Engine", isOn: $neuralEngineEnabled)
                    .toggleStyle(.switch)
            }
            
            if anomalies.isEmpty {
                Text("No anomalies detected in the selected time range")
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 20)
            } else {
                VStack(spacing: 8) {
                    ForEach(anomalies) { anomaly in
                        AnomalyRow(anomaly: anomaly)
                    }
                }
            }
        }
        .padding(20)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
    
    private var recentEventsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Recent Security Events")
                .font(.headline)
            
            VStack(spacing: 8) {
                SecurityEventRow(icon: "person.badge.key", title: "Login from new location", time: "2 hours ago", status: .info)
                SecurityEventRow(icon: "lock.rotation", title: "API key rotated", time: "5 hours ago", status: .success)
                SecurityEventRow(icon: "shield.lefthalf.filled", title: "Security scan completed", time: "1 day ago", status: .success)
                SecurityEventRow(icon: "exclamationmark.triangle", title: "Failed login attempt", time: "2 days ago", status: .warning)
            }
        }
        .padding(20)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
    
    private var securityScoreSection: some View {
        VStack(spacing: 16) {
            Text("Security Score")
                .font(.headline)
                .frame(maxWidth: .infinity, alignment: .leading)
            
            ZStack {
                Circle()
                    .stroke(Color.green.opacity(0.2), lineWidth: 12)
                Circle()
                    .trim(from: 0, to: 0.92)
                    .stroke(Color.green, style: StrokeStyle(lineWidth: 12, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                
                VStack {
                    Text("92")
                        .font(.system(size: 48, weight: .bold, design: .rounded))
                    Text("Excellent")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(width: 150, height: 150)
            
            VStack(alignment: .leading, spacing: 8) {
                ScoreBreakdownRow(title: "Encryption", score: 100)
                ScoreBreakdownRow(title: "Access Control", score: 95)
                ScoreBreakdownRow(title: "Audit Logging", score: 90)
                ScoreBreakdownRow(title: "Network Security", score: 85)
            }
        }
        .padding(20)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
    
    private var quickActionsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Quick Actions")
                .font(.headline)
            
            VStack(spacing: 8) {
                SecurityActionButton(title: "Rotate API Keys", icon: "key.horizontal.fill", color: .blue)
                SecurityActionButton(title: "Review Access Logs", icon: "doc.text.magnifyingglass", color: .purple)
                SecurityActionButton(title: "Export Audit Report", icon: "square.and.arrow.up", color: .orange)
                SecurityActionButton(title: "Configure Alerts", icon: "bell.badge", color: .green)
            }
        }
        .padding(20)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
    
    private func loadSecurityData() {
        activeAlerts = [
            SecurityAlert(id: "1", severity: .medium, title: "Unusual API activity", description: "Spike in API requests from unknown IP", timestamp: Date().addingTimeInterval(-3600), source: "API Gateway", isAcknowledged: false)
        ]
        
        anomalies = [
            AnomalyEvent(id: "1", type: "Traffic", description: "Unusual traffic pattern detected", confidence: 0.87, timestamp: Date().addingTimeInterval(-7200), isResolved: false)
        ]
    }
    
    private func runSecurityScan() {
        isScanning = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
            isScanning = false
        }
    }
}

struct ThreatLevelCard: View {
    let level: ThreatLevel
    let isActive: Bool
    
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: level.icon)
                .font(.title2)
                .foregroundStyle(isActive ? level.color : .secondary)
            Text(level.rawValue)
                .font(.subheadline)
                .foregroundStyle(isActive ? .primary : .secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .background(isActive ? level.color.opacity(0.15) : Color(nsColor: .controlBackgroundColor))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(isActive ? level.color : .clear, lineWidth: 2))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

struct SecurityAlertRow: View {
    let alert: SecurityAlert
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(alert.severity.color)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(alert.title).font(.subheadline.weight(.medium))
                Text(alert.description).font(.caption).foregroundStyle(.secondary)
            }
            
            Spacer()
            
            Button("Acknowledge") { }
                .buttonStyle(.bordered)
                .controlSize(.small)
        }
        .padding(12)
        .background(alert.severity.color.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct AnomalyRow: View {
    let anomaly: AnomalyEvent
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "waveform.path.ecg")
                .foregroundStyle(.orange)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(anomaly.description).font(.subheadline)
                HStack {
                    Text("Confidence: \(Int(anomaly.confidence * 100))%")
                    Text(anomaly.timestamp, style: .relative)
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            Button("Investigate") { }
                .buttonStyle(.bordered)
                .controlSize(.small)
        }
        .padding(12)
        .background(Color.orange.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct SecurityEventRow: View {
    let icon: String
    let title: String
    let time: String
    let status: EventStatus
    
    enum EventStatus { case success, warning, info }
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(statusColor)
            Text(title).font(.subheadline)
            Spacer()
            Text(time).font(.caption).foregroundStyle(.secondary)
        }
        .padding(10)
        .background(Color(nsColor: .windowBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }
    
    var statusColor: Color {
        switch status {
        case .success: return .green
        case .warning: return .orange
        case .info: return .blue
        }
    }
}

struct ScoreBreakdownRow: View {
    let title: String
    let score: Int
    
    var body: some View {
        HStack {
            Text(title).font(.caption)
            Spacer()
            Text("\(score)%").font(.caption.weight(.medium))
        }
    }
}

struct SecurityActionButton: View {
    let title: String
    let icon: String
    let color: Color
    
    var body: some View {
        Button { } label: {
            HStack {
                Image(systemName: icon).foregroundStyle(color)
                Text(title).foregroundStyle(.primary)
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(.secondary)
            }
            .padding(12)
            .background(color.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    SecurityView()
        .environmentObject(AppState())
        .frame(width: 1200, height: 900)
}
