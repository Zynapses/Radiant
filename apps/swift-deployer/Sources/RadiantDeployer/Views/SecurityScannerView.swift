// RADIANT v7.2.0 - Security Scanner View
// UI for security scan results and recommendations

import SwiftUI

struct SecurityScannerView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedEnvironment = "dev"
    @State private var isScanning = false
    @State private var scanResult: SecurityScannerService.ScanResult?
    @State private var progressMessages: [String] = []
    @State private var selectedCategory: SecurityScannerService.ScanCategory?
    @State private var selectedFinding: SecurityScannerService.Finding?
    
    private let region = "us-east-1"
    private let environments = ["dev", "staging", "prod"]
    
    var body: some View {
        VStack(spacing: 0) {
            toolbar
            Divider()
            
            if isScanning {
                scanningView
            } else if let result = scanResult {
                resultsView(result: result)
            } else {
                emptyState
            }
        }
        .sheet(item: $selectedFinding) { finding in
            findingDetailSheet(finding: finding)
        }
    }
    
    private var toolbar: some View {
        HStack {
            Image(systemName: "shield.checkered")
                .font(.title2)
            Text("Security Scanner")
                .font(.headline)
            
            Spacer()
            
            Picker("Environment", selection: $selectedEnvironment) {
                ForEach(environments, id: \.self) { env in
                    Text(env.capitalized).tag(env)
                }
            }
            .frame(width: 120)
            
            Button {
                startScan()
            } label: {
                Label("Run Scan", systemImage: "play.fill")
            }
            .buttonStyle(.borderedProminent)
            .disabled(isScanning)
        }
        .padding()
    }
    
    private var scanningView: some View {
        VStack(spacing: 20) {
            ProgressView()
                .scaleEffect(1.5)
            
            Text("Scanning security configuration...")
                .font(.headline)
            
            VStack(alignment: .leading, spacing: 4) {
                ForEach(progressMessages.suffix(5), id: \.self) { msg in
                    Text(msg)
                        .font(.caption.monospaced())
                        .foregroundColor(.secondary)
                }
            }
            .frame(maxWidth: 400)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    private func resultsView(result: SecurityScannerService.ScanResult) -> some View {
        HSplitView {
            VStack(spacing: 0) {
                summaryCard(result: result)
                Divider()
                categoryList(result: result)
            }
            .frame(minWidth: 280, maxWidth: 350)
            
            findingsList(result: result)
        }
    }
    
    private func summaryCard(result: SecurityScannerService.ScanResult) -> some View {
        VStack(spacing: 16) {
            HStack {
                complianceGauge(score: result.complianceScore)
                
                VStack(alignment: .leading, spacing: 8) {
                    Text("Compliance Score")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text("\(Int(result.complianceScore))%")
                        .font(.title.bold())
                        .foregroundColor(scoreColor(result.complianceScore))
                }
                
                Spacer()
            }
            
            HStack(spacing: 16) {
                severityBadge(count: result.criticalCount, severity: .critical)
                severityBadge(count: result.highCount, severity: .high)
                severityBadge(count: result.mediumCount, severity: .medium)
                severityBadge(count: result.lowCount, severity: .low)
            }
            
            HStack {
                Label("\(result.resourcesScanned) resources", systemImage: "cube.box")
                Spacer()
                Text(result.timestamp.formatted(date: .abbreviated, time: .shortened))
            }
            .font(.caption)
            .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(.textBackgroundColor).opacity(0.5))
    }
    
    private func complianceGauge(score: Double) -> some View {
        ZStack {
            Circle()
                .stroke(Color.gray.opacity(0.2), lineWidth: 8)
            Circle()
                .trim(from: 0, to: score / 100)
                .stroke(scoreColor(score), style: StrokeStyle(lineWidth: 8, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
        .frame(width: 60, height: 60)
    }
    
    private func severityBadge(count: Int, severity: SecurityScannerService.Severity) -> some View {
        VStack(spacing: 2) {
            Text("\(count)")
                .font(.headline)
                .foregroundColor(severityColor(severity))
            Text(severity.rawValue)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
    
    private func categoryList(result: SecurityScannerService.ScanResult) -> some View {
        List(SecurityScannerService.ScanCategory.allCases, id: \.self, selection: $selectedCategory) { category in
            let count = result.findings.filter { $0.category == category }.count
            HStack {
                Image(systemName: category.icon)
                    .frame(width: 24)
                Text(category.rawValue)
                Spacer()
                if count > 0 {
                    Text("\(count)")
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(Color.red.opacity(0.2))
                        .foregroundColor(.red)
                        .cornerRadius(10)
                }
            }
            .tag(category)
        }
    }
    
    private func findingsList(result: SecurityScannerService.ScanResult) -> some View {
        let findings = selectedCategory == nil ? result.findings : result.findings.filter { $0.category == selectedCategory }
        
        return VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text(selectedCategory?.rawValue ?? "All Findings")
                    .font(.headline)
                Spacer()
                Text("\(findings.count) findings")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding()
            
            Divider()
            
            if findings.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "checkmark.shield")
                        .font(.system(size: 40))
                        .foregroundColor(.green)
                    Text("No findings in this category")
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(findings) { finding in
                    findingRow(finding: finding)
                        .onTapGesture { selectedFinding = finding }
                }
            }
        }
    }
    
    private func findingRow(finding: SecurityScannerService.Finding) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: finding.severity.icon)
                .foregroundColor(severityColor(finding.severity))
                .frame(width: 20)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(finding.title)
                    .font(.subheadline.bold())
                
                Text(finding.resource)
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Text(finding.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }
            
            Spacer()
            
            Text(finding.severity.rawValue)
                .font(.caption2.bold())
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(severityColor(finding.severity).opacity(0.2))
                .foregroundColor(severityColor(finding.severity))
                .cornerRadius(4)
        }
        .padding(.vertical, 4)
    }
    
    private func findingDetailSheet(finding: SecurityScannerService.Finding) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack {
                Image(systemName: finding.severity.icon)
                    .font(.title)
                    .foregroundColor(severityColor(finding.severity))
                
                VStack(alignment: .leading) {
                    Text(finding.title)
                        .font(.title2.bold())
                    Text("\(finding.resourceType): \(finding.resource)")
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                Button { selectedFinding = nil } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title2)
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
            }
            
            GroupBox("Description") {
                Text(finding.description)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            
            GroupBox("Recommendation") {
                Text(finding.recommendation)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            
            if !finding.affectedItems.isEmpty {
                GroupBox("Affected Items") {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(finding.affectedItems, id: \.self) { item in
                            Text("• \(item)")
                                .font(.caption.monospaced())
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            
            Spacer()
        }
        .padding()
        .frame(width: 500, height: 400)
    }
    
    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "shield.checkered")
                .font(.system(size: 48))
                .foregroundColor(.secondary)
            Text("Security Scanner")
                .font(.headline)
            Text("Select an environment and run a scan to check for security issues")
                .font(.subheadline)
                .foregroundColor(.secondary)
            Button("Run Scan") { startScan() }
                .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    private func startScan() {
        isScanning = true
        progressMessages = []
        scanResult = nil
        selectedCategory = nil
        
        Task {
            do {
                let result = try await SecurityScannerService.shared.runFullScan(
                    environment: selectedEnvironment,
                    region: region
                ) { message in
                    Task { @MainActor in
                        progressMessages.append(message)
                    }
                }
                await MainActor.run {
                    scanResult = result
                    isScanning = false
                }
            } catch {
                await MainActor.run {
                    progressMessages.append("Error: \(error.localizedDescription)")
                    isScanning = false
                }
            }
        }
    }
    
    private func scoreColor(_ score: Double) -> Color {
        if score >= 80 { return .green }
        if score >= 60 { return .orange }
        return .red
    }
    
    private func severityColor(_ severity: SecurityScannerService.Severity) -> Color {
        switch severity {
        case .critical: return .red
        case .high: return .orange
        case .medium: return .yellow
        case .low: return .blue
        case .info: return .gray
        }
    }
}
