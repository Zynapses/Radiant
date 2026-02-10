// RADIANT v7.2.0 - Compliance Report View
// UI for generating and viewing regulatory compliance reports
// Supports HIPAA, SOC2, GDPR, PCI-DSS, and ISO 27001

import SwiftUI

struct ComplianceReportView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedFramework: ComplianceReportService.ComplianceFramework = .hipaa
    @State private var currentReport: ComplianceReportService.ComplianceReport?
    @State private var reportHistory: [ComplianceReportService.ComplianceReport] = []
    @State private var isGenerating: Bool = false
    @State private var generationProgress: Double = 0
    @State private var progressMessage: String = ""
    @State private var startDate: Date = Calendar.current.date(byAdding: .month, value: -3, to: Date()) ?? Date()
    @State private var endDate: Date = Date()
    @State private var organizationName: String = ""
    @State private var environmentName: String = "Production"
    @State private var showingGenerateSheet: Bool = false
    @State private var showingExportSheet: Bool = false
    @State private var selectedControl: ComplianceReportService.ControlAssessment?
    @State private var searchText: String = ""
    
    var filteredControls: [ComplianceReportService.ControlAssessment] {
        guard let report = currentReport else { return [] }
        if searchText.isEmpty {
            return report.controls
        }
        return report.controls.filter {
            $0.name.localizedCaseInsensitiveContains(searchText) ||
            $0.controlId.localizedCaseInsensitiveContains(searchText) ||
            $0.category.localizedCaseInsensitiveContains(searchText)
        }
    }
    
    var body: some View {
        NavigationSplitView {
            sidebarContent
        } content: {
            if let report = currentReport {
                controlsListView(report)
            } else {
                ContentUnavailableView(
                    "No Report Selected",
                    systemImage: "doc.text.magnifyingglass",
                    description: Text("Generate a new report or select one from history")
                )
            }
        } detail: {
            if let control = selectedControl {
                controlDetailView(control)
            } else {
                ContentUnavailableView(
                    "Select a Control",
                    systemImage: "checkmark.shield",
                    description: Text("Choose a control to view assessment details")
                )
            }
        }
        .navigationTitle("Compliance Reports")
        .searchable(text: $searchText, prompt: "Search controls...")
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                if isGenerating {
                    ProgressView()
                        .scaleEffect(0.7)
                }
                
                Button {
                    showingGenerateSheet = true
                } label: {
                    Label("Generate Report", systemImage: "doc.badge.plus")
                }
                .disabled(isGenerating)
                
                if currentReport != nil {
                    Button {
                        showingExportSheet = true
                    } label: {
                        Label("Export", systemImage: "square.and.arrow.up")
                    }
                }
            }
        }
        .task {
            await loadHistory()
            if let selectedApp = appState.apps.first {
                organizationName = selectedApp.name
            }
        }
        .sheet(isPresented: $showingGenerateSheet) {
            generateReportSheet
        }
        .sheet(isPresented: $showingExportSheet) {
            exportSheet
        }
    }
    
    // MARK: - Sidebar
    
    private var sidebarContent: some View {
        List {
            Section("Frameworks") {
                ForEach(ComplianceReportService.ComplianceFramework.allCases, id: \.self) { framework in
                    Button {
                        selectedFramework = framework
                        Task {
                            if let latest = await ComplianceReportService.shared.getLatestReport(framework: framework) {
                                currentReport = latest
                            }
                        }
                    } label: {
                        HStack {
                            Image(systemName: framework.icon)
                                .foregroundColor(selectedFramework == framework ? .accentColor : .secondary)
                                .frame(width: 24)
                            
                            VStack(alignment: .leading, spacing: 2) {
                                Text(framework.displayName)
                                    .font(.body)
                                Text(framework.description)
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                                    .lineLimit(1)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                    .padding(.vertical, 4)
                    .background(selectedFramework == framework ? Color.accentColor.opacity(0.1) : Color.clear)
                    .cornerRadius(6)
                }
            }
            
            Section("Recent Reports") {
                if reportHistory.isEmpty {
                    Text("No reports generated")
                        .font(.caption)
                        .foregroundColor(.secondary)
                } else {
                    ForEach(reportHistory.prefix(10)) { report in
                        Button {
                            currentReport = report
                            selectedFramework = report.framework
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                HStack {
                                    Text(report.framework.displayName)
                                        .font(.caption.weight(.medium))
                                    Spacer()
                                    statusBadge(report.overallStatus)
                                }
                                Text(report.generatedAt, style: .date)
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                        .buttonStyle(.plain)
                        .padding(.vertical, 2)
                    }
                }
            }
        }
        .listStyle(.sidebar)
        .frame(minWidth: 250)
    }
    
    // MARK: - Controls List
    
    private func controlsListView(_ report: ComplianceReportService.ComplianceReport) -> some View {
        VStack(spacing: 0) {
            // Report Summary Header
            reportSummaryHeader(report)
            
            Divider()
            
            // Controls List
            List(selection: $selectedControl) {
                ForEach(report.framework.controlCategories, id: \.self) { category in
                    let categoryControls = filteredControls.filter { $0.category == category }
                    if !categoryControls.isEmpty {
                        Section(category) {
                            ForEach(categoryControls, id: \.id) { control in
                                controlRow(control)
                                    .tag(control)
                            }
                        }
                    }
                }
            }
            .listStyle(.inset)
        }
        .frame(minWidth: 400)
    }
    
    private func reportSummaryHeader(_ report: ComplianceReportService.ComplianceReport) -> some View {
        VStack(spacing: 16) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Image(systemName: report.framework.icon)
                            .font(.title2)
                        Text(report.framework.displayName)
                            .font(.title2.weight(.semibold))
                    }
                    Text("Report Period: \(report.reportPeriod.formattedRange)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                VStack(alignment: .trailing, spacing: 4) {
                    statusBadge(report.overallStatus, large: true)
                    Text(report.summary.formattedPercentage)
                        .font(.title.weight(.bold))
                        .foregroundColor(report.overallStatus == .compliant ? .green : report.overallStatus == .partiallyCompliant ? .orange : .red)
                }
            }
            
            // Summary Stats
            HStack(spacing: 20) {
                summaryStatView(
                    title: "Compliant",
                    value: report.summary.compliantControls,
                    color: .green
                )
                summaryStatView(
                    title: "Partial",
                    value: report.summary.partiallyCompliantControls,
                    color: .orange
                )
                summaryStatView(
                    title: "Non-Compliant",
                    value: report.summary.nonCompliantControls,
                    color: .red
                )
                summaryStatView(
                    title: "N/A",
                    value: report.summary.notApplicableControls,
                    color: .gray
                )
                
                Divider()
                    .frame(height: 30)
                
                summaryStatView(
                    title: "Critical",
                    value: report.summary.criticalFindings,
                    color: .purple
                )
                summaryStatView(
                    title: "High",
                    value: report.summary.highFindings,
                    color: .red
                )
                summaryStatView(
                    title: "Medium",
                    value: report.summary.mediumFindings,
                    color: .orange
                )
                summaryStatView(
                    title: "Low",
                    value: report.summary.lowFindings,
                    color: .yellow
                )
            }
        }
        .padding()
        .background(Color(.controlBackgroundColor))
    }
    
    private func summaryStatView(title: String, value: Int, color: Color) -> some View {
        VStack(spacing: 2) {
            Text("\(value)")
                .font(.title3.weight(.bold))
                .foregroundColor(value > 0 ? color : .secondary)
            Text(title)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
    }
    
    private func controlRow(_ control: ComplianceReportService.ControlAssessment) -> some View {
        HStack {
            Circle()
                .fill(statusColor(control.status))
                .frame(width: 10, height: 10)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(control.controlId)
                    .font(.caption.monospaced())
                    .foregroundColor(.secondary)
                Text(control.name)
                    .font(.body)
                    .lineLimit(1)
            }
            
            Spacer()
            
            Image(systemName: statusIcon(control.status))
                .foregroundColor(statusColor(control.status))
        }
        .padding(.vertical, 4)
    }
    
    // MARK: - Control Detail
    
    private func controlDetailView(_ control: ComplianceReportService.ControlAssessment) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(control.controlId)
                            .font(.caption.monospaced())
                            .foregroundColor(.secondary)
                        Text(control.name)
                            .font(.title2.weight(.semibold))
                        Text(control.category)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    Spacer()
                    
                    statusBadge(control.status, large: true)
                }
                .padding()
                .background(statusColor(control.status).opacity(0.1))
                .cornerRadius(12)
                
                // Description
                GroupBox("Control Description") {
                    Text(control.description)
                        .font(.body)
                        .padding(.vertical, 8)
                }
                
                // Implementation Details
                GroupBox("Implementation Details") {
                    Text(control.implementationDetails)
                        .font(.body)
                        .padding(.vertical, 8)
                }
                
                // Evidence
                if !control.evidence.isEmpty {
                    GroupBox("Evidence") {
                        VStack(alignment: .leading, spacing: 8) {
                            ForEach(control.evidence, id: \.self) { evidence in
                                HStack {
                                    Image(systemName: "doc.fill")
                                        .foregroundColor(.blue)
                                    Text(evidence)
                                        .font(.body)
                                    Spacer()
                                    Button {
                                        // View evidence
                                    } label: {
                                        Image(systemName: "eye")
                                    }
                                    .buttonStyle(.borderless)
                                }
                            }
                        }
                        .padding(.vertical, 8)
                    }
                }
                
                // Assessment Info
                GroupBox("Assessment Information") {
                    VStack(alignment: .leading, spacing: 8) {
                        detailRow(label: "Assessed By", value: control.assessor)
                        detailRow(label: "Assessment Date", value: control.lastAssessedAt.formatted())
                        if let notes = control.notes {
                            detailRow(label: "Notes", value: notes)
                        }
                    }
                    .padding(.vertical, 8)
                }
            }
            .padding()
        }
    }
    
    private func detailRow(label: String, value: String) -> some View {
        HStack(alignment: .top) {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
                .frame(width: 120, alignment: .leading)
            Text(value)
                .font(.body)
        }
    }
    
    // MARK: - Generate Sheet
    
    private var generateReportSheet: some View {
        VStack(spacing: 20) {
            Text("Generate Compliance Report")
                .font(.title2.weight(.semibold))
            
            VStack(alignment: .leading, spacing: 16) {
                // Framework Selection
                Picker("Framework", selection: $selectedFramework) {
                    ForEach(ComplianceReportService.ComplianceFramework.allCases, id: \.self) { framework in
                        Text(framework.displayName).tag(framework)
                    }
                }
                
                // Organization
                TextField("Organization Name", text: $organizationName)
                
                // Environment
                Picker("Environment", selection: $environmentName) {
                    Text("Production").tag("Production")
                    Text("Staging").tag("Staging")
                    Text("Development").tag("Development")
                }
                
                // Date Range
                DatePicker("Start Date", selection: $startDate, displayedComponents: .date)
                DatePicker("End Date", selection: $endDate, displayedComponents: .date)
            }
            .textFieldStyle(.roundedBorder)
            
            if isGenerating {
                VStack(spacing: 8) {
                    ProgressView(value: generationProgress)
                    Text(progressMessage)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            HStack {
                Button("Cancel") {
                    showingGenerateSheet = false
                }
                .buttonStyle(.bordered)
                
                Button("Generate") {
                    Task { await generateReport() }
                }
                .buttonStyle(.borderedProminent)
                .disabled(isGenerating || organizationName.isEmpty)
            }
        }
        .padding()
        .frame(width: 400)
    }
    
    // MARK: - Export Sheet
    
    private var exportSheet: some View {
        VStack(spacing: 20) {
            Text("Export Report")
                .font(.title2.weight(.semibold))
            
            if let report = currentReport {
                VStack(alignment: .leading, spacing: 8) {
                    Text(report.framework.displayName)
                        .font(.headline)
                    Text("Generated: \(report.generatedAt.formatted())")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text("Status: \(report.overallStatus.displayName)")
                        .font(.caption)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.controlBackgroundColor))
                .cornerRadius(8)
            }
            
            HStack {
                Button("Cancel") {
                    showingExportSheet = false
                }
                .buttonStyle(.bordered)
                
                Button("Export JSON") {
                    exportReport(format: "json")
                }
                .buttonStyle(.bordered)
                
                Button("Export CSV") {
                    exportReport(format: "csv")
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding()
        .frame(width: 400)
    }
    
    // MARK: - Helper Views
    
    private func statusBadge(_ status: ComplianceReportService.ComplianceStatus, large: Bool = false) -> some View {
        Label(status.displayName, systemImage: statusIcon(status))
            .font(large ? .body.weight(.medium) : .caption.weight(.medium))
            .padding(.horizontal, large ? 12 : 8)
            .padding(.vertical, large ? 6 : 4)
            .background(statusColor(status).opacity(0.2))
            .foregroundColor(statusColor(status))
            .cornerRadius(6)
    }
    
    private func statusColor(_ status: ComplianceReportService.ComplianceStatus) -> Color {
        switch status {
        case .compliant: return .green
        case .partiallyCompliant: return .orange
        case .nonCompliant: return .red
        case .notApplicable: return .gray
        case .needsReview: return .yellow
        }
    }
    
    private func statusIcon(_ status: ComplianceReportService.ComplianceStatus) -> String {
        switch status {
        case .compliant: return "checkmark.circle.fill"
        case .partiallyCompliant: return "exclamationmark.circle.fill"
        case .nonCompliant: return "xmark.circle.fill"
        case .notApplicable: return "minus.circle.fill"
        case .needsReview: return "questionmark.circle.fill"
        }
    }
    
    // MARK: - Actions
    
    private func loadHistory() async {
        reportHistory = await ComplianceReportService.shared.getReportHistory()
        if let latest = reportHistory.first {
            currentReport = latest
            selectedFramework = latest.framework
        }
    }
    
    private func generateReport() async {
        isGenerating = true
        generationProgress = 0
        progressMessage = "Initializing..."
        
        currentReport = await ComplianceReportService.shared.generateReport(
            framework: selectedFramework,
            organization: organizationName,
            environment: environmentName,
            startDate: startDate,
            endDate: endDate
        ) { progress, message in
            Task { @MainActor in
                self.generationProgress = progress
                self.progressMessage = message
            }
        }
        
        await loadHistory()
        isGenerating = false
        showingGenerateSheet = false
    }
    
    private func exportReport(format: String) {
        guard let report = currentReport else { return }
        
        let panel = NSSavePanel()
        panel.allowedContentTypes = format == "json" ? [.json] : [.commaSeparatedText]
        panel.nameFieldStringValue = "\(report.framework.rawValue)-compliance-\(Date().ISO8601Format()).\(format)"
        
        if panel.runModal() == .OK, let url = panel.url {
            Task {
                try? await ComplianceReportService.shared.exportReport(report, format: format, outputURL: url)
            }
        }
        
        showingExportSheet = false
    }
}

#Preview {
    ComplianceReportView()
        .environmentObject(AppState())
        .frame(width: 1200, height: 700)
}
