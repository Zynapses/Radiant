// RADIANT v4.18.0 - Credential Lifecycle Security View
// Security audit dashboard with compliance scoring, remediation actions,
// and credential lifecycle management automation.
// Standards: NIST SP 800-57, CIS AWS v3.0, SOC2 CC6.1, AWS Well-Architected

import SwiftUI

struct CredentialLifecycleView: View {
    @EnvironmentObject var appState: AppState
    @State private var isAuditing = false
    @State private var auditReport: CredentialLifecycleService.SecurityAuditReport?
    @State private var progressMessages: [String] = []
    @State private var selectedSection: AuditSection = .overview
    @State private var showingScheduleEditor = false
    @State private var showingDeploySheet = false
    @State private var showingRemediationConfirm = false
    @State private var pendingRemediation: RemediationAction?
    @State private var alertEmail = ""
    @State private var errorMessage: String?
    @State private var schedule = CredentialLifecycleService.RotationSchedule()
    
    enum AuditSection: String, CaseIterable, Identifiable {
        case overview = "Overview"
        case iamKeys = "IAM Keys"
        case configRules = "Config Rules"
        case accessAnalyzer = "Access Analyzer"
        case secretsManager = "Secrets Manager"
        case tenantKeys = "Tenant API Keys"
        case compliance = "Compliance"
        
        var id: String { rawValue }
        
        var icon: String {
            switch self {
            case .overview: return "shield.checkered"
            case .iamKeys: return "key.horizontal"
            case .configRules: return "checklist"
            case .accessAnalyzer: return "magnifyingglass.circle"
            case .secretsManager: return "lock.rotation"
            case .tenantKeys: return "person.badge.key"
            case .compliance: return "checkmark.shield"
            }
        }
    }
    
    struct RemediationAction {
        let title: String
        let description: String
        let action: () async throws -> Void
    }
    
    private let service = CredentialLifecycleService.shared
    
    var body: some View {
        VStack(spacing: 0) {
            toolbar
            Divider()
            
            if isAuditing {
                auditingView
            } else if let report = auditReport {
                HSplitView {
                    sectionSidebar(report: report)
                        .frame(minWidth: 200, maxWidth: 240)
                    
                    sectionContent(report: report)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            } else {
                emptyState
            }
        }
        .sheet(isPresented: $showingScheduleEditor) {
            scheduleEditorSheet
        }
        .sheet(isPresented: $showingDeploySheet) {
            deployStackSheet
        }
        .alert("Confirm Remediation", isPresented: $showingRemediationConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Execute", role: .destructive) {
                if let remediation = pendingRemediation {
                    Task {
                        do {
                            try await remediation.action()
                            await runAudit()
                        } catch {
                            errorMessage = error.localizedDescription
                        }
                    }
                }
            }
        } message: {
            Text(pendingRemediation?.description ?? "")
        }
        .alert("Error", isPresented: .init(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK") { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
    }
    
    // MARK: - Toolbar
    
    private var toolbar: some View {
        HStack {
            Image(systemName: "shield.lefthalf.filled.badge.checkmark")
                .font(.title2)
                .foregroundStyle(.orange)
            
            VStack(alignment: .leading, spacing: 1) {
                Text("Credential Lifecycle Security")
                    .font(.headline)
                Text("NIST 800-57 · CIS AWS · SOC2 · Well-Architected")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            if let report = auditReport {
                scoreIndicator(score: report.overallScore)
            }
            
            Button {
                showingScheduleEditor = true
            } label: {
                Label("Schedule", systemImage: "calendar.badge.clock")
            }
            
            Button {
                showingDeploySheet = true
            } label: {
                Label("Deploy Stack", systemImage: "arrow.up.circle")
            }
            .buttonStyle(.bordered)
            
            Button {
                Task { await runAudit() }
            } label: {
                Label("Run Audit", systemImage: "play.fill")
            }
            .buttonStyle(.borderedProminent)
            .disabled(isAuditing)
        }
        .padding()
    }
    
    // MARK: - Score Indicator
    
    private func scoreIndicator(score: Int) -> some View {
        HStack(spacing: 6) {
            ZStack {
                Circle()
                    .stroke(Color.gray.opacity(0.2), lineWidth: 4)
                    .frame(width: 36, height: 36)
                Circle()
                    .trim(from: 0, to: Double(score) / 100.0)
                    .stroke(scoreColor(score), style: StrokeStyle(lineWidth: 4, lineCap: .round))
                    .frame(width: 36, height: 36)
                    .rotationEffect(.degrees(-90))
                Text("\(score)")
                    .font(.caption.bold())
            }
            
            VStack(alignment: .leading, spacing: 0) {
                Text("Security")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text("Score")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 8)
    }
    
    private func scoreColor(_ score: Int) -> Color {
        if score >= 80 { return .green }
        if score >= 60 { return .orange }
        return .red
    }
    
    // MARK: - Empty State
    
    private var emptyState: some View {
        VStack(spacing: 20) {
            Image(systemName: "shield.lefthalf.filled.badge.checkmark")
                .font(.system(size: 60))
                .foregroundStyle(.orange.opacity(0.6))
            
            Text("Credential Lifecycle Security")
                .font(.title2.bold())
            
            Text("Run a comprehensive security audit to assess IAM key hygiene,\nSecrets Manager rotation, tenant API key lifecycle, and compliance posture.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .frame(maxWidth: 500)
            
            VStack(alignment: .leading, spacing: 8) {
                complianceBadge("NIST SP 800-57", "Key Management Lifecycle")
                complianceBadge("CIS AWS Foundations v3.0", "IAM credential hygiene")
                complianceBadge("SOC 2 CC6.1", "Access control verification")
                complianceBadge("AWS Well-Architected SEC02/03", "Identity & least privilege")
                complianceBadge("PCI DSS v4.0 Req 3.6/3.7", "Cryptographic key management")
                complianceBadge("ISO 27001:2022 A.9", "Access control policy")
            }
            .padding(.top, 8)
            
            Button {
                Task { await runAudit() }
            } label: {
                Label("Run Security Audit", systemImage: "play.fill")
                    .font(.headline)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .padding(.top, 8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    private func complianceBadge(_ standard: String, _ detail: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "checkmark.shield.fill")
                .foregroundStyle(.green)
                .frame(width: 20)
            Text(standard)
                .font(.caption.bold())
            Text("—")
                .foregroundStyle(.secondary)
            Text(detail)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
    
    // MARK: - Auditing View
    
    private var auditingView: some View {
        VStack(spacing: 20) {
            ProgressView()
                .scaleEffect(1.5)
            
            Text("Running Security Audit...")
                .font(.headline)
            
            VStack(alignment: .leading, spacing: 4) {
                ForEach(progressMessages.suffix(8), id: \.self) { msg in
                    HStack(spacing: 6) {
                        Image(systemName: "chevron.right")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        Text(msg)
                            .font(.caption.monospaced())
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .frame(maxWidth: 500, alignment: .leading)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    // MARK: - Section Sidebar
    
    private func sectionSidebar(report: CredentialLifecycleService.SecurityAuditReport) -> some View {
        List(AuditSection.allCases, selection: $selectedSection) { section in
            HStack {
                Image(systemName: section.icon)
                    .frame(width: 20)
                    .foregroundStyle(sectionColor(section, report: report))
                Text(section.rawValue)
                    .font(.callout)
                Spacer()
                if let badge = sectionBadge(section, report: report) {
                    Text(badge)
                        .font(.caption2.bold())
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(sectionBadgeColor(section, report: report).opacity(0.15))
                        .foregroundStyle(sectionBadgeColor(section, report: report))
                        .clipShape(Capsule())
                }
            }
        }
        .listStyle(.sidebar)
    }
    
    private func sectionColor(_ section: AuditSection, report: CredentialLifecycleService.SecurityAuditReport) -> Color {
        switch section {
        case .overview: return .orange
        case .iamKeys: return report.iamKeyAudits.contains(where: { $0.riskLevel <= .high }) ? .red : .green
        case .configRules: return report.configNonCompliant > 0 ? .red : .green
        case .accessAnalyzer: return report.publicAccessFindings > 0 ? .red : .green
        case .secretsManager: return report.secretsWithoutRotation > 0 ? .orange : .green
        case .tenantKeys: return report.dormantKeys > 0 || report.expiringKeys > 0 ? .orange : .green
        case .compliance: return report.overallScore >= 80 ? .green : report.overallScore >= 60 ? .orange : .red
        }
    }
    
    private func sectionBadge(_ section: AuditSection, report: CredentialLifecycleService.SecurityAuditReport) -> String? {
        switch section {
        case .overview: return "\(report.overallScore)%"
        case .iamKeys: return "\(report.iamKeyAudits.count)"
        case .configRules: return "\(report.configNonCompliant)"
        case .accessAnalyzer: return "\(report.analyzerFindings.count)"
        case .secretsManager: return "\(report.managedSecrets.count)"
        case .tenantKeys: return "\(report.tenantKeyAudits.filter { $0.isActive }.count)"
        case .compliance: return nil
        }
    }
    
    private func sectionBadgeColor(_ section: AuditSection, report: CredentialLifecycleService.SecurityAuditReport) -> Color {
        return sectionColor(section, report: report)
    }
    
    // MARK: - Section Content Router
    
    @ViewBuilder
    private func sectionContent(report: CredentialLifecycleService.SecurityAuditReport) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                switch selectedSection {
                case .overview:
                    overviewSection(report: report)
                case .iamKeys:
                    iamKeysSection(report: report)
                case .configRules:
                    configRulesSection(report: report)
                case .accessAnalyzer:
                    accessAnalyzerSection(report: report)
                case .secretsManager:
                    secretsManagerSection(report: report)
                case .tenantKeys:
                    tenantKeysSection(report: report)
                case .compliance:
                    complianceSection(report: report)
                }
            }
            .padding()
        }
    }
    
    // MARK: - Overview Section
    
    private func overviewSection(report: CredentialLifecycleService.SecurityAuditReport) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Security Overview")
                .font(.title2.bold())
            
            // Summary cards
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible()),
            ], spacing: 12) {
                summaryCard("IAM Keys", "\(report.iamKeyAudits.count)", icon: "key.horizontal",
                            color: report.iamKeyAudits.contains(where: { $0.riskLevel <= .high }) ? .red : .green)
                summaryCard("Config Rules", "\(report.configCompliant)/\(report.configRules.count)", icon: "checklist",
                            color: report.configNonCompliant > 0 ? .red : .green)
                summaryCard("Analyzer Findings", "\(report.analyzerFindings.count)", icon: "magnifyingglass.circle",
                            color: report.publicAccessFindings > 0 ? .red : .green)
                summaryCard("Managed Secrets", "\(report.managedSecrets.count)", icon: "lock.rotation",
                            color: report.secretsWithoutRotation > 0 ? .orange : .green)
            }
            
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible()),
            ], spacing: 12) {
                summaryCard("Root Key", report.rootKeyPresent ? "PRESENT" : "None", icon: "exclamationmark.triangle",
                            color: report.rootKeyPresent ? .red : .green)
                summaryCard("Root MFA", report.rootMfaEnabled ? "Enabled" : "DISABLED", icon: "lock.shield",
                            color: report.rootMfaEnabled ? .green : .red)
                summaryCard("Dormant Keys", "\(report.dormantKeys)", icon: "clock.badge.exclamationmark",
                            color: report.dormantKeys > 0 ? .orange : .green)
                summaryCard("Expiring Keys", "\(report.expiringKeys)", icon: "calendar.badge.exclamationmark",
                            color: report.expiringKeys > 0 ? .orange : .green)
            }
            
            // Critical findings
            let criticalFindings = report.iamKeyAudits.filter { $0.riskLevel <= .high }
            if !criticalFindings.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Critical & High Risk Findings")
                        .font(.headline)
                        .foregroundStyle(.red)
                    
                    ForEach(criticalFindings.prefix(10), id: \.accessKeyId) { audit in
                        HStack {
                            riskBadge(audit.riskLevel)
                            VStack(alignment: .leading) {
                                Text("\(audit.userName) / \(audit.accessKeyId)")
                                    .font(.callout.monospaced())
                                Text(audit.recommendations.first ?? "")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text("\(audit.ageDays)d old")
                                .font(.caption.monospaced())
                                .foregroundStyle(.secondary)
                        }
                        .padding(8)
                        .background(Color.red.opacity(0.05))
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                    }
                }
            }
            
            Text("Audit generated \(report.generatedAt.formatted()) for \(report.environment) in \(report.region)")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
    }
    
    // MARK: - IAM Keys Section
    
    private func iamKeysSection(report: CredentialLifecycleService.SecurityAuditReport) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("IAM Access Key Audit")
                .font(.title2.bold())
            
            ForEach(report.iamKeyAudits, id: \.accessKeyId) { audit in
                iamKeyRow(audit)
            }
        }
    }
    
    private func iamKeyRow(_ audit: CredentialLifecycleService.IAMKeyAudit) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                riskBadge(audit.riskLevel)
                
                VStack(alignment: .leading) {
                    Text(audit.userName)
                        .font(.callout.bold())
                    Text(audit.accessKeyId)
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                }
                
                Spacer()
                
                VStack(alignment: .trailing) {
                    Text("Age: \(audit.ageDays) days")
                        .font(.caption)
                    if let dormant = audit.dormantDays {
                        Text("Dormant: \(dormant) days")
                            .font(.caption)
                            .foregroundStyle(dormant > 45 ? .red : dormant > 30 ? .orange : .secondary)
                    }
                }
                
                // Remediation buttons
                if audit.status == "Active" && audit.riskLevel <= .high {
                    Menu {
                        Button("Rotate Key") {
                            pendingRemediation = RemediationAction(
                                title: "Rotate IAM Key",
                                description: "Create a new access key for \(audit.userName) and deactivate \(audit.accessKeyId).",
                                action: {
                                    let env = appState.selectedEnvironment
                                    _ = try await service.rotateIAMKey(
                                        userName: audit.userName,
                                        oldKeyId: audit.accessKeyId,
                                        profile: nil,
                                        region: "us-east-1"
                                    )
                                }
                            )
                            showingRemediationConfirm = true
                        }
                        Button("Disable Key") {
                            pendingRemediation = RemediationAction(
                                title: "Disable IAM Key",
                                description: "Deactivate \(audit.accessKeyId) for user \(audit.userName).",
                                action: {
                                    try await service.disableIAMKey(
                                        userName: audit.userName,
                                        keyId: audit.accessKeyId,
                                        profile: nil,
                                        region: "us-east-1"
                                    )
                                }
                            )
                            showingRemediationConfirm = true
                        }
                        Divider()
                        Button("Delete Key", role: .destructive) {
                            pendingRemediation = RemediationAction(
                                title: "Delete IAM Key",
                                description: "Permanently delete \(audit.accessKeyId) for user \(audit.userName). This cannot be undone.",
                                action: {
                                    try await service.deleteIAMKey(
                                        userName: audit.userName,
                                        keyId: audit.accessKeyId,
                                        profile: nil,
                                        region: "us-east-1"
                                    )
                                }
                            )
                            showingRemediationConfirm = true
                        }
                    } label: {
                        Image(systemName: "wrench.adjustable")
                            .foregroundStyle(.orange)
                    }
                    .menuStyle(.borderlessButton)
                    .frame(width: 30)
                }
            }
            
            if !audit.recommendations.isEmpty {
                ForEach(audit.recommendations, id: \.self) { rec in
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.right")
                            .font(.caption2)
                            .foregroundStyle(.orange)
                        Text(rec)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .padding(10)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
    
    // MARK: - Config Rules Section
    
    private func configRulesSection(report: CredentialLifecycleService.SecurityAuditReport) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("AWS Config Compliance Rules")
                .font(.title2.bold())
            
            HStack(spacing: 20) {
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                    Text("\(report.configCompliant) Compliant")
                }
                HStack {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.red)
                    Text("\(report.configNonCompliant) Non-Compliant")
                }
            }
            .font(.callout)
            
            ForEach(report.configRules, id: \.ruleName) { rule in
                HStack {
                    Image(systemName: rule.complianceType == "COMPLIANT" ? "checkmark.circle.fill" : "xmark.circle.fill")
                        .foregroundStyle(rule.complianceType == "COMPLIANT" ? .green : .red)
                    
                    Text(rule.ruleName)
                        .font(.callout.monospaced())
                    
                    Spacer()
                    
                    Text(rule.complianceType)
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(rule.complianceType == "COMPLIANT" ? Color.green.opacity(0.1) : Color.red.opacity(0.1))
                        .clipShape(Capsule())
                }
                .padding(8)
                .background(Color(nsColor: .controlBackgroundColor))
                .clipShape(RoundedRectangle(cornerRadius: 6))
            }
        }
    }
    
    // MARK: - Access Analyzer Section
    
    private func accessAnalyzerSection(report: CredentialLifecycleService.SecurityAuditReport) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("IAM Access Analyzer Findings")
                .font(.title2.bold())
            
            if report.analyzerFindings.isEmpty {
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                    Text("No active findings. All resources comply with least-privilege principles.")
                        .font(.callout)
                }
                .padding()
            } else {
                ForEach(report.analyzerFindings, id: \.id) { finding in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Image(systemName: finding.isPublic ? "globe" : "person.2")
                                .foregroundStyle(finding.isPublic ? .red : .orange)
                            Text(finding.resourceType)
                                .font(.caption.bold())
                            if finding.isPublic {
                                Text("PUBLIC")
                                    .font(.caption2.bold())
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(.red)
                                    .clipShape(Capsule())
                            }
                            Spacer()
                            Text(finding.status)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Text(finding.resource)
                            .font(.caption.monospaced())
                            .foregroundStyle(.secondary)
                    }
                    .padding(8)
                    .background(Color(nsColor: .controlBackgroundColor))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                }
            }
        }
    }
    
    // MARK: - Secrets Manager Section
    
    private func secretsManagerSection(report: CredentialLifecycleService.SecurityAuditReport) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Secrets Manager Inventory")
                .font(.title2.bold())
            
            HStack(spacing: 20) {
                HStack {
                    Image(systemName: "lock.rotation")
                        .foregroundStyle(.green)
                    Text("\(report.secretsWithRotation) with auto-rotation")
                }
                HStack {
                    Image(systemName: "exclamationmark.triangle")
                        .foregroundStyle(.orange)
                    Text("\(report.secretsWithoutRotation) without rotation")
                }
            }
            .font(.callout)
            
            ForEach(report.managedSecrets, id: \.arn) { secret in
                HStack {
                    Image(systemName: secret.rotationEnabled ? "lock.rotation" : "lock.open")
                        .foregroundStyle(secret.rotationEnabled ? .green : .orange)
                    
                    VStack(alignment: .leading) {
                        Text(secret.name)
                            .font(.callout)
                        if let days = secret.rotationDays {
                            Text("Rotates every \(days) days")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    
                    Spacer()
                    
                    Text(secret.rotationEnabled ? "AUTO" : "MANUAL")
                        .font(.caption.bold())
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(secret.rotationEnabled ? Color.green.opacity(0.1) : Color.orange.opacity(0.1))
                        .clipShape(Capsule())
                }
                .padding(8)
                .background(Color(nsColor: .controlBackgroundColor))
                .clipShape(RoundedRectangle(cornerRadius: 6))
            }
        }
    }
    
    // MARK: - Tenant Keys Section
    
    private func tenantKeysSection(report: CredentialLifecycleService.SecurityAuditReport) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Tenant API Key Lifecycle")
                .font(.title2.bold())
            
            HStack(spacing: 16) {
                statPill("Active", "\(report.tenantKeyAudits.filter { $0.isActive }.count)", color: .green)
                statPill("Dormant", "\(report.dormantKeys)", color: .orange)
                statPill("Expiring", "\(report.expiringKeys)", color: .red)
                statPill("Unrestricted", "\(report.keysWithoutRestrictions)", color: .purple)
            }
            
            ForEach(report.tenantKeyAudits.filter { $0.isActive }, id: \.keyId) { key in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        riskBadge(key.riskLevel)
                        
                        VStack(alignment: .leading) {
                            Text(key.name)
                                .font(.callout.bold())
                            Text("\(key.keyPrefix)... · Tenant: \(key.tenantId.prefix(8))...")
                                .font(.caption.monospaced())
                                .foregroundStyle(.secondary)
                        }
                        
                        Spacer()
                        
                        VStack(alignment: .trailing) {
                            Text("Uses: \(key.useCount)")
                                .font(.caption)
                            if let dormant = key.dormantDays {
                                Text("Dormant: \(dormant)d")
                                    .font(.caption)
                                    .foregroundStyle(dormant >= 45 ? .red : dormant >= 30 ? .orange : .secondary)
                            }
                        }
                        
                        // Restriction indicators
                        HStack(spacing: 4) {
                            if key.allowedIps != nil {
                                Image(systemName: "network")
                                    .font(.caption)
                                    .foregroundStyle(.green)
                                    .help("IP restricted")
                            }
                            if key.allowedOrigins != nil {
                                Image(systemName: "globe")
                                    .font(.caption)
                                    .foregroundStyle(.green)
                                    .help("Origin restricted")
                            }
                            if key.allowedIps == nil && key.allowedOrigins == nil {
                                Image(systemName: "exclamationmark.triangle")
                                    .font(.caption)
                                    .foregroundStyle(.orange)
                                    .help("No restrictions")
                            }
                        }
                    }
                    
                    if !key.recommendations.isEmpty {
                        ForEach(key.recommendations, id: \.self) { rec in
                            HStack(spacing: 4) {
                                Image(systemName: "arrow.right")
                                    .font(.caption2)
                                    .foregroundStyle(.orange)
                                Text(rec)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                .padding(8)
                .background(Color(nsColor: .controlBackgroundColor))
                .clipShape(RoundedRectangle(cornerRadius: 6))
            }
        }
    }
    
    // MARK: - Compliance Section
    
    private func complianceSection(report: CredentialLifecycleService.SecurityAuditReport) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Compliance Scorecard")
                .font(.title2.bold())
            
            ForEach(CredentialLifecycleService.ComplianceStandard.allCases, id: \.rawValue) { standard in
                if let result = report.complianceStatus[standard] {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Image(systemName: result.status == "PASS" ? "checkmark.seal.fill" : result.status == "PARTIAL" ? "exclamationmark.triangle.fill" : "xmark.seal.fill")
                                .foregroundStyle(result.status == "PASS" ? .green : result.status == "PARTIAL" ? .orange : .red)
                            
                            VStack(alignment: .leading) {
                                Text(standard.rawValue)
                                    .font(.callout.bold())
                                Text(standard.description)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            
                            Spacer()
                            
                            Text("\(result.score)/100")
                                .font(.title3.bold())
                                .foregroundStyle(scoreColor(result.score))
                            
                            Text(result.status)
                                .font(.caption.bold())
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(scoreColor(result.score).opacity(0.1))
                                .foregroundStyle(scoreColor(result.score))
                                .clipShape(Capsule())
                        }
                        
                        if !result.findings.isEmpty {
                            ForEach(result.findings, id: \.self) { finding in
                                HStack(spacing: 4) {
                                    Image(systemName: "xmark.circle")
                                        .font(.caption2)
                                        .foregroundStyle(.red)
                                    Text(finding)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                    .padding(12)
                    .background(Color(nsColor: .controlBackgroundColor))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }
        }
    }
    
    // MARK: - Schedule Editor Sheet
    
    private var scheduleEditorSheet: some View {
        VStack(spacing: 16) {
            Text("Rotation Schedule Configuration")
                .font(.headline)
            
            Form {
                Section("Key Rotation Intervals") {
                    Stepper("IAM Key Rotation: \(schedule.iamKeyRotationDays) days", value: $schedule.iamKeyRotationDays, in: 30...365)
                    Stepper("DB Credential Rotation: \(schedule.dbCredentialRotationDays) days", value: $schedule.dbCredentialRotationDays, in: 7...90)
                    Stepper("API Key Default Expiry: \(schedule.apiKeyDefaultExpiryDays) days", value: $schedule.apiKeyDefaultExpiryDays, in: 30...365)
                    Stepper("Auto-Rotation Grace: \(schedule.apiKeyGracePeriodDays) days", value: $schedule.apiKeyGracePeriodDays, in: 7...30)
                    Stepper("JWT Signing Rotation: \(schedule.jwtSigningRotationDays) days", value: $schedule.jwtSigningRotationDays, in: 7...90)
                }
                
                Section("Dormant Key Policy") {
                    Toggle("30-day warning", isOn: $schedule.dormantWarning30Days)
                    Toggle("45-day final warning", isOn: $schedule.dormantWarning45Days)
                    Toggle("60-day auto-disable", isOn: $schedule.dormantAutoDisable60Days)
                }
                
                Section("Enforcement") {
                    Toggle("Require IP restrictions on new keys", isOn: $schedule.enforceIpRestrictions)
                    Toggle("Require origin restrictions on browser keys", isOn: $schedule.enforceOriginRestrictions)
                    Toggle("Require MFA for all IAM users", isOn: $schedule.requireMfaForAllUsers)
                    Toggle("Delete root account access keys", isOn: $schedule.deleteRootAccessKeys)
                }
            }
            .formStyle(.grouped)
            
            HStack {
                Button("Cancel") {
                    showingScheduleEditor = false
                }
                Spacer()
                Button("Save Schedule") {
                    Task {
                        await service.updateSchedule(schedule)
                    }
                    showingScheduleEditor = false
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding()
        .frame(width: 500, height: 550)
    }
    
    // MARK: - Deploy Stack Sheet
    
    private var deployStackSheet: some View {
        VStack(spacing: 16) {
            Text("Deploy Credential Lifecycle Stack")
                .font(.headline)
            
            Text("This will deploy the CredentialLifecycleStack via CDK, which provisions:")
                .font(.callout)
                .foregroundStyle(.secondary)
            
            VStack(alignment: .leading, spacing: 6) {
                deployFeature("AWS Config managed rules for IAM credential hygiene")
                deployFeature("IAM Access Analyzer with EventBridge alerting")
                deployFeature("Secrets Manager auto-rotation for DB credentials")
                deployFeature("Scheduled Lambda: dormant key audit (daily)")
                deployFeature("Scheduled Lambda: API key auto-rotation (daily)")
                deployFeature("Scheduled Lambda: JWT signing key rotation")
                deployFeature("Scheduled Lambda: monthly IAM access report")
                deployFeature("SNS topic for security alerts")
            }
            
            TextField("Alert Email (optional)", text: $alertEmail)
                .textFieldStyle(.roundedBorder)
            
            HStack {
                Button("Cancel") {
                    showingDeploySheet = false
                }
                Spacer()
                Button("Deploy to \(appState.selectedEnvironment.rawValue)") {
                    showingDeploySheet = false
                    Task {
                        do {
                            try await service.deployCredentialLifecycleStack(
                                environment: appState.selectedEnvironment.rawValue,
                                region: "us-east-1",
                                profile: nil,
                                alertEmail: alertEmail.isEmpty ? nil : alertEmail,
                                progressCallback: { msg in
                                    Task { @MainActor in
                                        progressMessages.append(msg)
                                    }
                                }
                            )
                        } catch {
                            errorMessage = error.localizedDescription
                        }
                    }
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding()
        .frame(width: 480)
    }
    
    private func deployFeature(_ text: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(.green)
                .font(.caption)
            Text(text)
                .font(.caption)
        }
    }
    
    // MARK: - Helpers
    
    private func summaryCard(_ title: String, _ value: String, icon: String, color: Color) -> some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(color)
            Text(value)
                .font(.title3.bold())
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(12)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
    
    private func riskBadge(_ level: CredentialLifecycleService.RiskLevel) -> some View {
        Text(level.rawValue)
            .font(.caption2.bold())
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(riskColor(level).opacity(0.15))
            .foregroundStyle(riskColor(level))
            .clipShape(Capsule())
    }
    
    private func riskColor(_ level: CredentialLifecycleService.RiskLevel) -> Color {
        switch level {
        case .critical: return .red
        case .high: return .orange
        case .medium: return .yellow
        case .low: return .green
        case .info: return .gray
        }
    }
    
    private func statPill(_ label: String, _ value: String, color: Color) -> some View {
        HStack(spacing: 4) {
            Text(value)
                .font(.callout.bold())
                .foregroundStyle(color)
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(color.opacity(0.1))
        .clipShape(Capsule())
    }
    
    // MARK: - Run Audit
    
    private func runAudit() async {
        isAuditing = true
        progressMessages = []
        
        do {
            auditReport = try await service.runFullSecurityAudit(
                environment: appState.selectedEnvironment.rawValue,
                region: "us-east-1",
                profile: nil,
                radiantBaseURL: appState.radiantBaseURL,
                adminToken: appState.radiantAuthToken,
                progressCallback: { msg in
                    Task { @MainActor in
                        progressMessages.append(msg)
                    }
                }
            )
            selectedSection = .overview
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isAuditing = false
    }
}
