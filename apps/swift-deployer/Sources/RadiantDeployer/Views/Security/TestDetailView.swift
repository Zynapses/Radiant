// RADIANT v4.18.0 - Test Detail View
// Detailed view for a selected security test showing findings, evidence, logs, standards, and actions

import SwiftUI

struct TestDetailView: View {
    let test: SecurityTest
    @ObservedObject var orchestrator: SecurityTestOrchestrator
    @State private var selectedTab = 0

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                headerSection
                Divider()
                criteriaSection
                Divider()

                Picker("", selection: $selectedTab) {
                    Text("Findings").tag(0)
                    Text("Evidence (\(test.evidence.count))").tag(1)
                    Text("Execution Log").tag(2)
                    Text("Standards (\(test.standards.count))").tag(3)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 4)

                switch selectedTab {
                case 0: findingsSection
                case 1: evidenceSection
                case 2: executionLogSection
                case 3: standardsSection
                default: EmptyView()
                }

                Spacer(minLength: 20)
            }
            .padding(16)
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: test.status.icon)
                    .font(.title2)
                    .foregroundColor(test.status.color)

                VStack(alignment: .leading, spacing: 2) {
                    Text(test.id)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundColor(.secondary)
                    Text(test.title)
                        .font(.headline)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 4) {
                    Text(test.status.displayName)
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundColor(test.status.color)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(
                            Capsule().fill(test.status.color.opacity(0.1))
                        )

                    if !orchestrator.isRunning {
                        Button(action: { Task { await orchestrator.runSingleTest(test.id) } }) {
                            Label("Run Test", systemImage: "play.fill")
                                .font(.caption)
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                    }
                }
            }

            HStack(spacing: 12) {
                metaBadge(icon: test.protocolType.icon, text: test.protocolType.rawValue, color: test.protocolType.color)
                metaBadge(icon: "exclamationmark.shield", text: test.riskSeverity.rawValue, color: test.riskSeverity.color)
                metaBadge(icon: "folder", text: test.sopGroup, color: .secondary)

                if let date = test.lastRunDate {
                    metaBadge(icon: "clock", text: date.formatted(.relative(presentation: .named)), color: .secondary)
                }
                if let duration = test.lastRunDuration {
                    metaBadge(icon: "timer", text: String(format: "%.2fs", duration), color: .secondary)
                }
            }

            Text(test.description)
                .font(.caption)
                .foregroundColor(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func metaBadge(icon: String, text: String, color: Color) -> some View {
        HStack(spacing: 3) {
            Image(systemName: icon)
                .font(.system(size: 9))
            Text(text)
                .font(.system(size: 10))
        }
        .foregroundColor(color)
    }

    // MARK: - Criteria

    private var criteriaSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "checkmark.circle")
                    .foregroundColor(.green)
                    .font(.caption)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Pass Criteria")
                        .font(.caption)
                        .fontWeight(.semibold)
                    Text(test.passCriteria)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "xmark.circle")
                    .foregroundColor(.red)
                    .font(.caption)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Fail Criteria")
                        .font(.caption)
                        .fontWeight(.semibold)
                    Text(test.failCriteria)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
    }

    // MARK: - Findings

    private var findingsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let findings = test.detailedFindings, !findings.isEmpty {
                GroupBox("Detailed Findings") {
                    Text(findings)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundColor(.primary)
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            } else {
                Text("No findings yet. Run the test to see results.")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 20)
            }

            if let remediation = test.remediationGuidance, !remediation.isEmpty {
                GroupBox {
                    VStack(alignment: .leading, spacing: 4) {
                        Label("Remediation Guidance", systemImage: "wrench.and.screwdriver")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.orange)
                        Text(remediation)
                            .font(.system(size: 11))
                            .foregroundColor(.primary)
                            .textSelection(.enabled)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    // MARK: - Evidence

    private var evidenceSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            if test.evidence.isEmpty {
                Text("No evidence collected yet.")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 20)
            } else {
                ForEach(test.evidence) { item in
                    GroupBox {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Image(systemName: evidenceIcon(for: item.type))
                                    .font(.caption)
                                    .foregroundColor(.blue)
                                Text(item.title)
                                    .font(.caption)
                                    .fontWeight(.semibold)
                                Spacer()
                                Text(item.type.rawValue)
                                    .font(.system(size: 9))
                                    .foregroundColor(.secondary)
                                Text(item.timestamp, style: .time)
                                    .font(.system(size: 9))
                                    .foregroundColor(.secondary)
                            }

                            ScrollView(.vertical, showsIndicators: true) {
                                Text(item.content)
                                    .font(.system(size: 10, design: .monospaced))
                                    .foregroundColor(.primary)
                                    .textSelection(.enabled)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .frame(maxHeight: 200)
                        }
                    }
                }
            }
        }
    }

    private func evidenceIcon(for type: EvidenceType) -> String {
        switch type {
        case .httpRequest: return "arrow.up.right.square"
        case .httpResponse: return "arrow.down.left.square"
        case .mcpMessage: return "cpu"
        case .a2aMessage: return "arrow.left.arrow.right"
        case .screenshot: return "camera"
        case .logOutput: return "doc.text"
        case .configSnapshot: return "doc.on.clipboard"
        }
    }

    // MARK: - Execution Log

    private var executionLogSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            if test.executionLog.isEmpty {
                Text("No execution log yet.")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 20)
            } else {
                GroupBox {
                    ScrollView(.vertical, showsIndicators: true) {
                        VStack(alignment: .leading, spacing: 2) {
                            ForEach(test.executionLog) { entry in
                                HStack(alignment: .top, spacing: 6) {
                                    Image(systemName: entry.level.icon)
                                        .font(.system(size: 9))
                                        .foregroundColor(entry.level.color)
                                        .frame(width: 12)

                                    Text(entry.timestamp, style: .time)
                                        .font(.system(size: 9, design: .monospaced))
                                        .foregroundColor(.secondary)
                                        .frame(width: 70, alignment: .leading)

                                    Text(entry.message)
                                        .font(.system(size: 10, design: .monospaced))
                                        .foregroundColor(.primary)
                                        .textSelection(.enabled)
                                }
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .frame(maxHeight: 300)
                }
            }
        }
    }

    // MARK: - Standards

    private var standardsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(test.standards) { standard in
                GroupBox {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(standard.framework)
                                .font(.caption2)
                                .fontWeight(.bold)
                                .foregroundColor(.white)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Capsule().fill(frameworkColor(standard.framework)))

                            Text(standard.control)
                                .font(.system(size: 11, weight: .semibold, design: .monospaced))

                            Spacer()
                        }

                        Text(standard.title)
                            .font(.caption)
                            .fontWeight(.medium)

                        Text(standard.description)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    private func frameworkColor(_ framework: String) -> Color {
        switch framework {
        case _ where framework.contains("OWASP LLM"): return .red
        case _ where framework.contains("OWASP API"): return .orange
        case _ where framework.contains("OWASP WSTG"): return .pink
        case _ where framework.contains("CWE"): return .purple
        case _ where framework.contains("MITRE"): return .blue
        case _ where framework.contains("NIST"): return .teal
        case _ where framework.contains("ISO"): return .green
        default: return .gray
        }
    }
}

// MARK: - Settings Sheet

struct SecurityTestSettingsSheet: View {
    @Binding var settings: SecurityTestSettings
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 16) {
            Text("Security Testing Settings")
                .font(.headline)

            Form {
                Section("Execution") {
                    Stepper("Test Timeout: \(settings.testTimeoutSeconds)s", value: $settings.testTimeoutSeconds, in: 5...120, step: 5)
                    Stepper("Max Concurrent: \(settings.maxConcurrentTests)", value: $settings.maxConcurrentTests, in: 1...5)
                }

                Section("Evidence") {
                    Stepper("Retention: \(settings.evidenceRetentionDays) days", value: $settings.evidenceRetentionDays, in: 7...365, step: 7)
                    Toggle("Auto-Redact Credentials", isOn: $settings.autoRedactCredentials)
                }

                Section("Reports") {
                    TextField("Classification", text: $settings.reportClassification)
                    TextField("Output Directory (optional)", text: Binding(
                        get: { settings.reportOutputDirectory ?? "" },
                        set: { settings.reportOutputDirectory = $0.isEmpty ? nil : $0 }
                    ))
                }
            }
            .formStyle(.grouped)

            HStack {
                Button("Reset to Defaults") {
                    settings = .default
                }
                Spacer()
                Button("Done") {
                    dismiss()
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding()
        .frame(width: 450, height: 400)
    }
}
