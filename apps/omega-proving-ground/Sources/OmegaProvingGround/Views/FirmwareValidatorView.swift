import SwiftUI
import UniformTypeIdentifiers

struct FirmwareValidatorView: View {
    @EnvironmentObject var appState: AppState
    @State private var loadedFirmware: BioFirmware?
    @State private var validationResult: FirmwareValidationResult?
    @State private var firmwareJSON: String = ""
    @State private var selectedCategory: ValidationCategory?
    @State private var isApplied: Bool = false

    private let validator = FirmwareValidator()

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()

            if let result = validationResult {
                HSplitView {
                    validationResultsPanel(result: result)
                        .frame(minWidth: 400)

                    firmwareInspector
                        .frame(minWidth: 350)
                }
            } else {
                emptyState
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: 12) {
            Image(systemName: "cpu")
                .font(.title2)
                .foregroundColor(.orange)

            VStack(alignment: .leading, spacing: 2) {
                Text("Firmware Validator")
                    .font(.headline)
                if let fw = loadedFirmware {
                    Text("\(fw.metadata.name) — v\(fw.firmware_version)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                } else {
                    Text("Load a .bio firmware file to validate")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()

            if validationResult != nil {
                statusBadge
            }

            Button(action: loadBundledFirmware) {
                Label("Load Demo Firmware", systemImage: "doc.badge.gearshape")
            }
            .buttonStyle(.bordered)
            .controlSize(.small)

            Button(action: openFilePicker) {
                Label("Open .bio File", systemImage: "folder")
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.small)

            if loadedFirmware != nil && !isApplied {
                Button(action: applyFirmware) {
                    Label("Apply to Brain", systemImage: "bolt.fill")
                }
                .buttonStyle(.borderedProminent)
                .tint(.orange)
                .controlSize(.small)
            }

            if isApplied {
                Label("Applied", systemImage: "checkmark.seal.fill")
                    .font(.caption)
                    .foregroundColor(.green)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color(nsColor: .windowBackgroundColor))
    }

    @ViewBuilder
    private var statusBadge: some View {
        if let result = validationResult {
            HStack(spacing: 6) {
                Image(systemName: result.allPassed ? "checkmark.shield.fill" : "exclamationmark.shield.fill")
                Text(String(format: "%.0f%%", result.passRate))
                    .font(.system(.body, design: .rounded))
                    .fontWeight(.bold)
            }
            .foregroundColor(result.allPassed ? .green : (result.passRate >= 80 ? .orange : .red))
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill((result.allPassed ? Color.green : Color.orange).opacity(0.1))
            )
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 20) {
            Spacer()
            Image(systemName: "cpu")
                .font(.system(size: 56))
                .foregroundColor(.secondary.opacity(0.3))

            Text("No Firmware Loaded")
                .font(.title2)
                .foregroundColor(.secondary)

            Text("Load a .bio firmware file to validate its safety invariants,\nbehavioral parameters, routing rules, and compliance settings.")
                .font(.body)
                .foregroundColor(.secondary.opacity(0.7))
                .multilineTextAlignment(.center)

            HStack(spacing: 16) {
                Button(action: loadBundledFirmware) {
                    VStack(spacing: 8) {
                        Image(systemName: "doc.badge.gearshape")
                            .font(.title2)
                        Text("Load Demo Firmware")
                            .font(.caption)
                    }
                    .frame(width: 140, height: 80)
                }
                .buttonStyle(.bordered)

                Button(action: openFilePicker) {
                    VStack(spacing: 8) {
                        Image(systemName: "folder")
                            .font(.title2)
                        Text("Open .bio File")
                            .font(.caption)
                    }
                    .frame(width: 140, height: 80)
                }
                .buttonStyle(.bordered)
            }

            Spacer()
        }
    }

    // MARK: - Validation Results

    private func validationResultsPanel(result: FirmwareValidationResult) -> some View {
        VStack(spacing: 0) {
            summaryBar(result: result)
            Divider()

            List {
                ForEach(ValidationCategory.allCases, id: \.self) { category in
                    let categoryChecks = result.checks.filter { $0.category == category }
                    if !categoryChecks.isEmpty {
                        Section(header: categoryHeader(category: category, checks: categoryChecks)) {
                            ForEach(categoryChecks) { check in
                                CheckRow(check: check)
                            }
                        }
                    }
                }
            }
            .listStyle(.inset)
        }
    }

    private func summaryBar(result: FirmwareValidationResult) -> some View {
        HStack(spacing: 20) {
            summaryItem(label: "Total", value: "\(result.checks.count)", color: .blue)
            summaryItem(label: "Passed", value: "\(result.passCount)", color: .green)
            summaryItem(label: "Failed", value: "\(result.failCount)", color: .red)

            Spacer()

            Text("Validated \(result.timestamp, style: .relative) ago")
                .font(.caption2)
                .foregroundColor(.secondary)

            Button(action: { revalidate() }) {
                Label("Re-validate", systemImage: "arrow.clockwise")
            }
            .buttonStyle(.bordered)
            .controlSize(.mini)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color(nsColor: .controlBackgroundColor))
    }

    private func summaryItem(label: String, value: String, color: Color) -> some View {
        VStack(spacing: 1) {
            Text(value)
                .font(.system(.title3, design: .rounded))
                .fontWeight(.bold)
                .foregroundColor(color)
            Text(label)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
    }

    private func categoryHeader(category: ValidationCategory, checks: [ValidationCheck]) -> some View {
        HStack {
            Text(category.rawValue)
            Spacer()
            let passed = checks.filter(\.passed).count
            Text("\(passed)/\(checks.count)")
                .font(.caption)
                .foregroundColor(passed == checks.count ? .green : .orange)
        }
    }

    // MARK: - Firmware Inspector

    private var firmwareInspector: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Firmware Inspector")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                Spacer()
            }
            .padding(10)
            .background(Color(nsColor: .controlBackgroundColor))

            Divider()

            if let fw = loadedFirmware {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        inspectorSection("Metadata") {
                            inspectorRow("Name", fw.metadata.name)
                            inspectorRow("Version", fw.firmware_version)
                            inspectorRow("Author", fw.metadata.author)
                            inspectorRow("Classification", fw.metadata.classification)
                            inspectorRow("Environment", fw.metadata.target_environment)
                        }

                        inspectorSection("Safety (\(fw.safety_invariants.rules.count) invariants)") {
                            ForEach(fw.safety_invariants.rules) { rule in
                                HStack(alignment: .top, spacing: 6) {
                                    Text(rule.id)
                                        .font(.caption.monospaced())
                                        .foregroundColor(.orange)
                                        .frame(width: 40, alignment: .leading)
                                    VStack(alignment: .leading, spacing: 1) {
                                        Text(rule.name)
                                            .font(.caption)
                                            .fontWeight(.medium)
                                        Text("\(rule.enforcement) @ \(rule.cato_checkpoint)")
                                            .font(.caption2)
                                            .foregroundColor(.secondary)
                                    }
                                }
                            }
                        }

                        inspectorSection("Persona") {
                            inspectorRow("Name", fw.behavioral_parameters.persona.name)
                            inspectorRow("Style", fw.behavioral_parameters.persona.style)
                            inspectorRow("Delight", fw.behavioral_parameters.persona.delight_mode)
                            inspectorRow("Traits", fw.behavioral_parameters.persona.traits.joined(separator: ", "))
                        }

                        inspectorSection("Routing (\(fw.routing_rules.task_routing.count) routes)") {
                            ForEach(fw.routing_rules.task_routing) { route in
                                HStack {
                                    Text(route.task_type)
                                        .font(.caption)
                                        .fontWeight(.medium)
                                    Spacer()
                                    Text("t=\(String(format: "%.1f", route.temperature_override))")
                                        .font(.caption2)
                                        .foregroundColor(.secondary)
                                    if route.require_consensus == true {
                                        Text("CONSENSUS")
                                            .font(.caption2)
                                            .padding(.horizontal, 4)
                                            .background(Color.orange.opacity(0.2))
                                            .cornerRadius(3)
                                    }
                                }
                            }
                            Text("Fallback: \(fw.routing_rules.fallback_chain.joined(separator: " → "))")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }

                        inspectorSection("Compliance") {
                            complianceFlag("GDPR", fw.compliance_flags.gdpr_enabled)
                            complianceFlag("SOC2", fw.compliance_flags.soc2_enabled)
                            complianceFlag("HIPAA", fw.compliance_flags.hipaa_enabled)
                            complianceFlag("PCI-DSS", fw.compliance_flags.pci_dss_enabled)
                            complianceFlag("Zero Data Retention", fw.compliance_flags.zero_data_retention)
                            inspectorRow("Region", fw.compliance_flags.data_residency_region)
                        }

                        inspectorSection("Limits") {
                            inspectorRow("Rate Limit", "\(fw.resource_limits.rate_limit_rpm) RPM")
                            inspectorRow("Max Tokens", "\(fw.resource_limits.max_request_tokens)")
                            inspectorRow("Context Window", "\(fw.resource_limits.max_context_window)")
                            inspectorRow("Cost Ceiling", "$\(String(format: "%.2f", fw.resource_limits.cost_ceiling_daily_usd))/day")
                        }
                    }
                    .padding(12)
                }
            } else {
                VStack {
                    Spacer()
                    Text("No firmware loaded")
                        .foregroundColor(.secondary)
                    Spacer()
                }
            }
        }
    }

    private func inspectorSection(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption)
                .fontWeight(.bold)
                .foregroundColor(.secondary)
                .textCase(.uppercase)
            content()
        }
    }

    private func inspectorRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
                .frame(width: 100, alignment: .trailing)
            Text(value)
                .font(.caption)
                .fontWeight(.medium)
        }
    }

    private func complianceFlag(_ label: String, _ enabled: Bool) -> some View {
        HStack {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
                .frame(width: 100, alignment: .trailing)
            Image(systemName: enabled ? "checkmark.circle.fill" : "xmark.circle")
                .foregroundColor(enabled ? .green : .secondary)
                .font(.caption)
            Text(enabled ? "Enabled" : "Disabled")
                .font(.caption)
                .foregroundColor(enabled ? .green : .secondary)
        }
    }

    // MARK: - Actions

    private func openFilePicker() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [UTType.json]
        panel.allowsMultipleSelection = false
        panel.message = "Select an OMEGA .bio firmware file"

        panel.begin { response in
            guard response == .OK, let url = panel.url else { return }
            loadFirmwareFile(url: url)
        }
    }

    private func loadBundledFirmware() {
        let demoPath = findDemoFirmwarePath()
        if let path = demoPath {
            loadFirmwareFile(url: URL(fileURLWithPath: path))
        }
    }

    private func loadFirmwareFile(url: URL) {
        do {
            let data = try Data(contentsOf: url)
            loadedFirmware = try JSONDecoder().decode(BioFirmware.self, from: data)
            firmwareJSON = String(data: data, encoding: .utf8) ?? ""
            validationResult = validator.validate(data: data)
            isApplied = false
        } catch {
            validationResult = FirmwareValidationResult(
                firmwareName: url.lastPathComponent,
                timestamp: Date(),
                checks: [ValidationCheck(
                    category: .schema, name: "Load Failed",
                    description: "Could not load firmware file",
                    passed: false, severity: .critical,
                    details: error.localizedDescription
                )]
            )
        }
    }

    private func revalidate() {
        guard let data = firmwareJSON.data(using: .utf8) else { return }
        validationResult = validator.validate(data: data)
    }

    private func applyFirmware() {
        guard let fw = loadedFirmware else { return }
        appState.inferenceService.config.systemPrompt = buildSystemPrompt(from: fw)
        appState.inferenceService.config.temperature = fw.behavioral_parameters.default_temperature
        appState.inferenceService.config.topP = fw.behavioral_parameters.default_top_p
        appState.inferenceService.config.maxTokens = fw.behavioral_parameters.default_max_tokens
        isApplied = true
    }

    private func buildSystemPrompt(from fw: BioFirmware) -> String {
        var prompt = "You are \(fw.behavioral_parameters.persona.name).\n"
        prompt += "Style: \(fw.behavioral_parameters.persona.style). Traits: \(fw.behavioral_parameters.persona.traits.joined(separator: ", ")).\n\n"
        prompt += "SAFETY INVARIANTS (non-negotiable):\n"
        for rule in fw.safety_invariants.rules {
            prompt += "- [\(rule.id)] \(rule.name): \(rule.description)\n"
        }
        prompt += "\n\(fw.behavioral_parameters.persona.greeting)"
        return prompt
    }

    private func findDemoFirmwarePath() -> String? {
        let possiblePaths = [
            Bundle.main.path(forResource: "omega-test-v1.bio", ofType: "json"),
            "./demo/firmware/omega-test-v1.bio.json",
            "../demo/firmware/omega-test-v1.bio.json",
        ]

        for path in possiblePaths {
            if let p = path, FileManager.default.fileExists(atPath: p) {
                return p
            }
        }

        let process = ProcessInfo.processInfo
        let cwd = FileManager.default.currentDirectoryPath
        let cwdPath = "\(cwd)/demo/firmware/omega-test-v1.bio.json"
        if FileManager.default.fileExists(atPath: cwdPath) {
            return cwdPath
        }

        let execPath = process.arguments.first ?? ""
        let execDir = (execPath as NSString).deletingLastPathComponent
        let relPath = "\(execDir)/../../../demo/firmware/omega-test-v1.bio.json"
        if FileManager.default.fileExists(atPath: relPath) {
            return relPath
        }

        return nil
    }
}

// MARK: - Check Row

struct CheckRow: View {
    let check: ValidationCheck

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: check.passed ? "checkmark.circle.fill" : "xmark.circle.fill")
                .foregroundColor(check.passed ? .green : severityColor)

            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(check.name)
                        .font(.body)
                        .fontWeight(.medium)
                    if !check.passed {
                        Text(check.severity.rawValue)
                            .font(.caption2)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 1)
                            .background(Capsule().fill(severityColor.opacity(0.15)))
                            .foregroundColor(severityColor)
                    }
                }
                Text(check.details)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 2)
    }

    private var severityColor: Color {
        switch check.severity {
        case .critical: return .red
        case .error: return .orange
        case .warning: return .yellow
        case .info: return .blue
        }
    }
}
