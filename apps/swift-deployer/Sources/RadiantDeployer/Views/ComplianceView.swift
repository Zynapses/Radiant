// RADIANT v4.18.0 - Compliance View
// SOC2, HIPAA, GDPR, ISO27001 compliance reports and status

import SwiftUI

struct ComplianceView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedFramework: ComplianceFramework?
    @State private var isGeneratingReport = false
    @State private var lastReportDate: Date?
    
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                headerSection
                overviewCardsSection
                frameworksSection
                recentAuditsSection
                actionsSection
            }
            .padding(24)
        }
        .background(Color(nsColor: .windowBackgroundColor))
    }
    
    // MARK: - Header
    
    private var headerSection: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Compliance & Governance")
                    .font(.largeTitle.bold())
                Text("Monitor compliance status across all frameworks")
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            Button {
                generateFullReport()
            } label: {
                if isGeneratingReport {
                    ProgressView()
                        .controlSize(.small)
                } else {
                    Label("Generate Full Report", systemImage: "doc.text")
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(isGeneratingReport)
        }
    }
    
    // MARK: - Overview Cards
    
    private var overviewCardsSection: some View {
        HStack(spacing: 16) {
            ComplianceOverviewCard(
                title: "Overall Score",
                value: "94%",
                status: .compliant,
                icon: "checkmark.shield.fill"
            )
            
            ComplianceOverviewCard(
                title: "Open Issues",
                value: "3",
                status: .warning,
                icon: "exclamationmark.triangle.fill"
            )
            
            ComplianceOverviewCard(
                title: "Last Audit",
                value: "7 days ago",
                status: .compliant,
                icon: "calendar"
            )
            
            ComplianceOverviewCard(
                title: "Frameworks",
                value: "4 Active",
                status: .compliant,
                icon: "checklist"
            )
        }
    }
    
    // MARK: - Frameworks Section
    
    private var frameworksSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Compliance Frameworks")
                .font(.headline)
            
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                ForEach(ComplianceFramework.allCases) { framework in
                    FrameworkCard(framework: framework, isSelected: selectedFramework == framework) {
                        withAnimation {
                            selectedFramework = selectedFramework == framework ? nil : framework
                        }
                    }
                }
            }
            
            if let framework = selectedFramework {
                FrameworkDetailView(framework: framework)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
    }
    
    // MARK: - Recent Audits
    
    private var recentAuditsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Recent Audit Events")
                    .font(.headline)
                Spacer()
                Button("View All") {
                    // Navigate to full audit log
                }
                .buttonStyle(.borderless)
            }
            
            VStack(spacing: 8) {
                ForEach(recentAuditEvents) { event in
                    AuditEventRow(event: event)
                }
            }
        }
        .padding(20)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
    
    // MARK: - Actions
    
    private var actionsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Compliance Actions")
                .font(.headline)
            
            HStack(spacing: 16) {
                ComplianceActionButton(
                    title: "Run Security Scan",
                    subtitle: "Scan for vulnerabilities",
                    icon: "shield.lefthalf.filled",
                    color: .blue
                ) {
                    // Run security scan
                }
                
                ComplianceActionButton(
                    title: "Generate Evidence",
                    subtitle: "Export audit evidence",
                    icon: "doc.on.doc",
                    color: .purple
                ) {
                    // Generate evidence
                }
                
                ComplianceActionButton(
                    title: "Schedule Audit",
                    subtitle: "Plan compliance audit",
                    icon: "calendar.badge.plus",
                    color: .orange
                ) {
                    // Schedule audit
                }
                
                ComplianceActionButton(
                    title: "View Policies",
                    subtitle: "Review security policies",
                    icon: "doc.text.magnifyingglass",
                    color: .green
                ) {
                    // View policies
                }
            }
        }
    }
    
    // MARK: - Data
    
    private var recentAuditEvents: [AuditEvent] {
        [
            AuditEvent(id: "1", type: .accessReview, description: "Quarterly access review completed", timestamp: Date().addingTimeInterval(-86400), status: .passed),
            AuditEvent(id: "2", type: .policyUpdate, description: "Data retention policy updated", timestamp: Date().addingTimeInterval(-172800), status: .info),
            AuditEvent(id: "3", type: .securityScan, description: "Vulnerability scan completed - 0 critical issues", timestamp: Date().addingTimeInterval(-259200), status: .passed),
            AuditEvent(id: "4", type: .encryption, description: "Encryption key rotation completed", timestamp: Date().addingTimeInterval(-345600), status: .passed),
            AuditEvent(id: "5", type: .training, description: "Security awareness training - 2 users pending", timestamp: Date().addingTimeInterval(-432000), status: .warning)
        ]
    }
    
    private func generateFullReport() {
        isGeneratingReport = true
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            isGeneratingReport = false
            lastReportDate = Date()
            
            // Open save panel
            let panel = NSSavePanel()
            panel.allowedContentTypes = [.pdf]
            panel.nameFieldStringValue = "radiant-compliance-report-\(Date().ISO8601Format()).pdf"
            
            if panel.runModal() == .OK {
                // Generate and save report
            }
        }
    }
}

// MARK: - Compliance Framework

enum ComplianceFramework: String, CaseIterable, Identifiable {
    case soc2 = "SOC 2"
    case hipaa = "HIPAA"
    case gdpr = "GDPR"
    case iso27001 = "ISO 27001"
    
    var id: String { rawValue }
    
    var description: String {
        switch self {
        case .soc2: return "Service Organization Control 2"
        case .hipaa: return "Health Insurance Portability and Accountability Act"
        case .gdpr: return "General Data Protection Regulation"
        case .iso27001: return "Information Security Management"
        }
    }
    
    var icon: String {
        switch self {
        case .soc2: return "building.columns"
        case .hipaa: return "cross.case"
        case .gdpr: return "globe.europe.africa"
        case .iso27001: return "lock.shield"
        }
    }
    
    var color: Color {
        switch self {
        case .soc2: return .blue
        case .hipaa: return .red
        case .gdpr: return .purple
        case .iso27001: return .green
        }
    }
    
    var controls: [ComplianceControl] {
        switch self {
        case .soc2:
            return [
                ComplianceControl(name: "Access Control", status: .compliant, lastChecked: Date()),
                ComplianceControl(name: "Encryption at Rest", status: .compliant, lastChecked: Date()),
                ComplianceControl(name: "Encryption in Transit", status: .compliant, lastChecked: Date()),
                ComplianceControl(name: "Audit Logging", status: .compliant, lastChecked: Date()),
                ComplianceControl(name: "Incident Response", status: .compliant, lastChecked: Date()),
                ComplianceControl(name: "Change Management", status: .warning, lastChecked: Date()),
                ComplianceControl(name: "Backup & Recovery", status: .compliant, lastChecked: Date())
            ]
        case .hipaa:
            return [
                ComplianceControl(name: "PHI Access Controls", status: .compliant, lastChecked: Date()),
                ComplianceControl(name: "Audit Controls", status: .compliant, lastChecked: Date()),
                ComplianceControl(name: "Transmission Security", status: .compliant, lastChecked: Date()),
                ComplianceControl(name: "BAA Management", status: .warning, lastChecked: Date()),
                ComplianceControl(name: "Breach Notification", status: .compliant, lastChecked: Date())
            ]
        case .gdpr:
            return [
                ComplianceControl(name: "Data Subject Rights", status: .compliant, lastChecked: Date()),
                ComplianceControl(name: "Consent Management", status: .compliant, lastChecked: Date()),
                ComplianceControl(name: "Data Processing Records", status: .compliant, lastChecked: Date()),
                ComplianceControl(name: "Data Retention", status: .compliant, lastChecked: Date()),
                ComplianceControl(name: "Cross-Border Transfer", status: .warning, lastChecked: Date())
            ]
        case .iso27001:
            return [
                ComplianceControl(name: "Risk Assessment", status: .compliant, lastChecked: Date()),
                ComplianceControl(name: "Security Policy", status: .compliant, lastChecked: Date()),
                ComplianceControl(name: "Asset Management", status: .compliant, lastChecked: Date()),
                ComplianceControl(name: "Access Control", status: .compliant, lastChecked: Date()),
                ComplianceControl(name: "Cryptography", status: .compliant, lastChecked: Date()),
                ComplianceControl(name: "Operations Security", status: .compliant, lastChecked: Date())
            ]
        }
    }
    
    var compliancePercentage: Int {
        let compliant = controls.filter { $0.status == .compliant }.count
        return Int((Double(compliant) / Double(controls.count)) * 100)
    }
}

struct ComplianceControl: Identifiable {
    let id = UUID()
    let name: String
    let status: ComplianceStatus
    let lastChecked: Date
}

enum ComplianceStatus {
    case compliant, warning, nonCompliant, notApplicable
    
    var color: Color {
        switch self {
        case .compliant: return .green
        case .warning: return .orange
        case .nonCompliant: return .red
        case .notApplicable: return .gray
        }
    }
    
    var icon: String {
        switch self {
        case .compliant: return "checkmark.circle.fill"
        case .warning: return "exclamationmark.triangle.fill"
        case .nonCompliant: return "xmark.circle.fill"
        case .notApplicable: return "minus.circle"
        }
    }
}

// MARK: - Audit Event

struct AuditEvent: Identifiable {
    let id: String
    let type: AuditEventType
    let description: String
    let timestamp: Date
    let status: AuditStatus
    
    enum AuditEventType {
        case accessReview, policyUpdate, securityScan, encryption, training, dataAccess
        
        var icon: String {
            switch self {
            case .accessReview: return "person.badge.key"
            case .policyUpdate: return "doc.text"
            case .securityScan: return "shield.lefthalf.filled"
            case .encryption: return "lock.rotation"
            case .training: return "graduationcap"
            case .dataAccess: return "cylinder"
            }
        }
    }
    
    enum AuditStatus {
        case passed, warning, failed, info
        
        var color: Color {
            switch self {
            case .passed: return .green
            case .warning: return .orange
            case .failed: return .red
            case .info: return .blue
            }
        }
    }
}

// MARK: - Supporting Views

struct ComplianceOverviewCard: View {
    let title: String
    let value: String
    let status: ComplianceStatus
    let icon: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundStyle(status.color)
                Spacer()
            }
            
            Text(value)
                .font(.system(size: 28, weight: .bold, design: .rounded))
            
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

struct FrameworkCard: View {
    let framework: ComplianceFramework
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Image(systemName: framework.icon)
                        .font(.title2)
                        .foregroundStyle(framework.color)
                    
                    Spacer()
                    
                    Text("\(framework.compliancePercentage)%")
                        .font(.headline)
                        .foregroundStyle(framework.compliancePercentage >= 90 ? .green : .orange)
                }
                
                Text(framework.rawValue)
                    .font(.headline)
                    .foregroundStyle(.primary)
                
                Text(framework.description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                
                // Progress bar
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(framework.color.opacity(0.2))
                            .frame(height: 6)
                        
                        RoundedRectangle(cornerRadius: 3)
                            .fill(framework.color)
                            .frame(width: geometry.size.width * CGFloat(framework.compliancePercentage) / 100, height: 6)
                    }
                }
                .frame(height: 6)
            }
            .padding(16)
            .background(isSelected ? framework.color.opacity(0.1) : Color(nsColor: .controlBackgroundColor))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? framework.color : Color.clear, lineWidth: 2)
            )
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
    }
}

struct FrameworkDetailView: View {
    let framework: ComplianceFramework
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("\(framework.rawValue) Controls")
                    .font(.headline)
                Spacer()
                Button("Export Report") {
                    // Export framework-specific report
                }
                .buttonStyle(.bordered)
            }
            
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                ForEach(framework.controls) { control in
                    HStack(spacing: 8) {
                        Image(systemName: control.status.icon)
                            .foregroundStyle(control.status.color)
                        
                        Text(control.name)
                            .font(.subheadline)
                        
                        Spacer()
                    }
                    .padding(12)
                    .background(control.status.color.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }
        }
        .padding(20)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

struct AuditEventRow: View {
    let event: AuditEvent
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: event.type.icon)
                .font(.title3)
                .foregroundStyle(event.status.color)
                .frame(width: 32)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(event.description)
                    .font(.subheadline)
                Text(event.timestamp, style: .relative)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            Circle()
                .fill(event.status.color)
                .frame(width: 8, height: 8)
        }
        .padding(12)
        .background(Color(nsColor: .windowBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct ComplianceActionButton: View {
    let title: String
    let subtitle: String
    let icon: String
    let color: Color
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.title)
                    .foregroundStyle(color)
                
                VStack(spacing: 4) {
                    Text(title)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.primary)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 20)
            .background(color.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Preview

#Preview {
    ComplianceView()
        .environmentObject(AppState())
        .frame(width: 1200, height: 900)
}
