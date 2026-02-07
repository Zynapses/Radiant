// RADIANT v7.2.0 - Cost Estimator View
// UI for pre-deployment AWS cost estimation
// Displays detailed breakdown and recommendations

import SwiftUI

struct CostEstimatorView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedTier: String = "starter"
    @State private var selectedRegion: String = "us-east-1"
    @State private var enableMultiRegion: Bool = false
    @State private var multiRegions: Set<String> = []
    @State private var auroraInstanceClass: String = "db.r6g.large"
    @State private var auroraMinCapacity: Int = 1
    @State private var auroraMaxCapacity: Int = 4
    @State private var enableSelfHosted: Bool = false
    @State private var gpuInstances: Int = 0
    @State private var enableWAF: Bool = true
    @State private var enableGuardDuty: Bool = true
    @State private var expectedRequests: Int64 = 1_000_000
    @State private var expectedStorageGB: Int = 50
    @State private var expectedDataTransferGB: Int = 200
    
    @State private var estimate: CostEstimatorService.CostEstimate?
    @State private var isCalculating: Bool = false
    @State private var selectedCategory: CostCategory = .total
    @State private var showingExportSheet: Bool = false
    
    enum CostCategory: String, CaseIterable {
        case total = "Total"
        case compute = "Compute"
        case database = "Database"
        case storage = "Storage"
        case networking = "Networking"
        case security = "Security"
        case ai = "AI"
        case other = "Other"
        
        var icon: String {
            switch self {
            case .total: return "chart.pie.fill"
            case .compute: return "cpu.fill"
            case .database: return "cylinder.fill"
            case .storage: return "externaldrive.fill"
            case .networking: return "network"
            case .security: return "shield.fill"
            case .ai: return "brain.fill"
            case .other: return "ellipsis.circle.fill"
            }
        }
        
        var color: Color {
            switch self {
            case .total: return .primary
            case .compute: return .blue
            case .database: return .purple
            case .storage: return .orange
            case .networking: return .green
            case .security: return .red
            case .ai: return .pink
            case .other: return .gray
            }
        }
    }
    
    let tiers = ["seed", "starter", "growth", "scale", "enterprise"]
    let regions = ["us-east-1", "us-west-2", "eu-west-1", "eu-central-1", "ap-northeast-1", "ap-southeast-1"]
    let auroraInstances = ["db.t4g.medium", "db.r6g.large", "db.r6g.xlarge", "db.r6g.2xlarge", "db.r6g.4xlarge"]
    
    var body: some View {
        HSplitView {
            // Configuration Panel
            ScrollView {
                configurationPanel
            }
            .frame(minWidth: 320, maxWidth: 400)
            .background(Color(.controlBackgroundColor))
            
            // Results Panel
            ScrollView {
                if let estimate = estimate {
                    resultsPanel(estimate)
                } else {
                    ContentUnavailableView(
                        "Configure Parameters",
                        systemImage: "dollarsign.circle",
                        description: Text("Adjust the parameters on the left and click Calculate to see cost estimates")
                    )
                }
            }
        }
        .navigationTitle("Cost Estimator")
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                if isCalculating {
                    ProgressView()
                        .scaleEffect(0.7)
                }
                
                Button {
                    Task { await calculateEstimate() }
                } label: {
                    Label("Calculate", systemImage: "equal.circle.fill")
                }
                .buttonStyle(.borderedProminent)
                .disabled(isCalculating)
                
                if estimate != nil {
                    Button {
                        showingExportSheet = true
                    } label: {
                        Label("Export", systemImage: "square.and.arrow.up")
                    }
                }
            }
        }
        .sheet(isPresented: $showingExportSheet) {
            exportSheet
        }
    }
    
    // MARK: - Configuration Panel
    
    private var configurationPanel: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Configuration")
                .font(.title2.weight(.semibold))
                .padding(.horizontal)
                .padding(.top)
            
            // Tier Selection
            GroupBox("Deployment Tier") {
                Picker("Tier", selection: $selectedTier) {
                    ForEach(tiers, id: \.self) { tier in
                        Text(tier.capitalized).tag(tier)
                    }
                }
                .pickerStyle(.segmented)
                .onChange(of: selectedTier) { _, newTier in
                    applyTierDefaults(newTier)
                }
            }
            .padding(.horizontal)
            
            // Region
            GroupBox("Region") {
                VStack(alignment: .leading, spacing: 12) {
                    Picker("Primary Region", selection: $selectedRegion) {
                        ForEach(regions, id: \.self) { region in
                            Text(region).tag(region)
                        }
                    }
                    
                    Toggle("Enable Multi-Region", isOn: $enableMultiRegion)
                    
                    if enableMultiRegion {
                        Text("Additional Regions")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        ForEach(regions.filter { $0 != selectedRegion }, id: \.self) { region in
                            HStack {
                                Image(systemName: multiRegions.contains(region) ? "checkmark.square.fill" : "square")
                                    .foregroundColor(multiRegions.contains(region) ? .accentColor : .secondary)
                                Text(region)
                                    .font(.caption)
                            }
                            .contentShape(Rectangle())
                            .onTapGesture {
                                if multiRegions.contains(region) {
                                    multiRegions.remove(region)
                                } else {
                                    multiRegions.insert(region)
                                }
                            }
                        }
                    }
                }
            }
            .padding(.horizontal)
            
            // Database
            GroupBox("Database") {
                VStack(alignment: .leading, spacing: 12) {
                    Picker("Aurora Instance", selection: $auroraInstanceClass) {
                        ForEach(auroraInstances, id: \.self) { instance in
                            Text(instance).tag(instance)
                        }
                    }
                    
                    HStack {
                        Text("Min Capacity")
                            .font(.caption)
                        Stepper("\(auroraMinCapacity) ACU", value: $auroraMinCapacity, in: 0...16)
                    }
                    
                    HStack {
                        Text("Max Capacity")
                            .font(.caption)
                        Stepper("\(auroraMaxCapacity) ACU", value: $auroraMaxCapacity, in: 1...128)
                    }
                }
            }
            .padding(.horizontal)
            
            // AI/ML
            GroupBox("AI Configuration") {
                VStack(alignment: .leading, spacing: 12) {
                    Toggle("Self-Hosted Models", isOn: $enableSelfHosted)
                    
                    if enableSelfHosted {
                        HStack {
                            Text("GPU Instances")
                                .font(.caption)
                            Stepper("\(gpuInstances)", value: $gpuInstances, in: 0...10)
                        }
                    }
                }
            }
            .padding(.horizontal)
            
            // Security
            GroupBox("Security") {
                VStack(alignment: .leading, spacing: 8) {
                    Toggle("AWS WAF", isOn: $enableWAF)
                    Toggle("GuardDuty", isOn: $enableGuardDuty)
                }
            }
            .padding(.horizontal)
            
            // Expected Usage
            GroupBox("Expected Monthly Usage") {
                VStack(alignment: .leading, spacing: 12) {
                    VStack(alignment: .leading) {
                        Text("API Requests: \(formatNumber(expectedRequests))")
                            .font(.caption)
                        Slider(value: Binding(
                            get: { log10(Double(expectedRequests)) },
                            set: { expectedRequests = Int64(pow(10, $0)) }
                        ), in: 4...10)
                    }
                    
                    VStack(alignment: .leading) {
                        Text("Storage: \(expectedStorageGB) GB")
                            .font(.caption)
                        Slider(value: Binding(
                            get: { Double(expectedStorageGB) },
                            set: { expectedStorageGB = Int($0) }
                        ), in: 10...5000)
                    }
                    
                    VStack(alignment: .leading) {
                        Text("Data Transfer: \(expectedDataTransferGB) GB")
                            .font(.caption)
                        Slider(value: Binding(
                            get: { Double(expectedDataTransferGB) },
                            set: { expectedDataTransferGB = Int($0) }
                        ), in: 50...20000)
                    }
                }
            }
            .padding(.horizontal)
            
            Spacer()
        }
    }
    
    // MARK: - Results Panel
    
    private func resultsPanel(_ estimate: CostEstimatorService.CostEstimate) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            // Summary Header
            HStack(spacing: 20) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Estimated Monthly Cost")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(estimate.summary.formattedMonthly)
                        .font(.system(size: 36, weight: .bold, design: .rounded))
                }
                
                Spacer()
                
                VStack(alignment: .trailing, spacing: 4) {
                    Text("Annual Estimate")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(estimate.summary.formattedYearly)
                        .font(.title2.weight(.semibold))
                }
            }
            .padding()
            .background(Color.accentColor.opacity(0.1))
            .cornerRadius(12)
            
            // Range
            HStack {
                Image(systemName: "info.circle")
                    .foregroundColor(.blue)
                Text("Expected range: \(estimate.summary.formattedRange)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            // Warnings
            if !estimate.warnings.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(estimate.warnings, id: \.self) { warning in
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(.orange)
                            Text(warning)
                                .font(.caption)
                        }
                    }
                }
                .padding()
                .background(Color.orange.opacity(0.1))
                .cornerRadius(8)
            }
            
            // Category Breakdown
            GroupBox("Cost Breakdown") {
                VStack(spacing: 12) {
                    costCategoryRow("Compute", amount: estimate.breakdown.compute.total, percentage: estimate.summary.computePercentage, color: .blue)
                    costCategoryRow("Database", amount: estimate.breakdown.database.total, percentage: estimate.summary.databasePercentage, color: .purple)
                    costCategoryRow("Storage", amount: estimate.breakdown.storage.total, percentage: estimate.summary.storagePercentage, color: .orange)
                    costCategoryRow("Networking", amount: estimate.breakdown.networking.total, percentage: estimate.summary.networkingPercentage, color: .green)
                    costCategoryRow("Security", amount: estimate.breakdown.security.total, percentage: estimate.summary.securityPercentage, color: .red)
                    costCategoryRow("AI", amount: estimate.breakdown.ai.total, percentage: estimate.summary.aiPercentage, color: .pink)
                    costCategoryRow("Other", amount: estimate.breakdown.other.total, percentage: estimate.summary.otherPercentage, color: .gray)
                }
                .padding(.vertical, 8)
            }
            
            // Detailed Line Items
            GroupBox("Detailed Breakdown") {
                VStack(alignment: .leading, spacing: 16) {
                    // Compute
                    lineItemSection("Compute", items: [
                        estimate.breakdown.compute.ecsCluster,
                        estimate.breakdown.compute.lambdaFunctions,
                        estimate.breakdown.compute.ecsFargateTasks
                    ] + (estimate.breakdown.compute.gpuInstances.map { [$0] } ?? []))
                    
                    // Database
                    lineItemSection("Database", items: [
                        estimate.breakdown.database.auroraPostgres,
                        estimate.breakdown.database.dynamoDB,
                        estimate.breakdown.database.elasticache
                    ])
                    
                    // Storage
                    lineItemSection("Storage", items: [
                        estimate.breakdown.storage.s3Standard,
                        estimate.breakdown.storage.s3InfrequentAccess,
                        estimate.breakdown.storage.efsStorage,
                        estimate.breakdown.storage.backups
                    ])
                    
                    // Networking
                    lineItemSection("Networking", items: [
                        estimate.breakdown.networking.dataTransferOut,
                        estimate.breakdown.networking.dataTransferRegion,
                        estimate.breakdown.networking.natGateway,
                        estimate.breakdown.networking.loadBalancer,
                        estimate.breakdown.networking.apiGateway
                    ])
                }
                .padding(.vertical, 8)
            }
            
            // Recommendations
            if !estimate.recommendations.isEmpty {
                GroupBox("Cost Optimization Recommendations") {
                    VStack(alignment: .leading, spacing: 12) {
                        ForEach(estimate.recommendations) { rec in
                            recommendationRow(rec)
                        }
                    }
                    .padding(.vertical, 8)
                }
            }
        }
        .padding()
    }
    
    private func costCategoryRow(_ name: String, amount: Double, percentage: Double, color: Color) -> some View {
        HStack {
            Circle()
                .fill(color)
                .frame(width: 10, height: 10)
            Text(name)
                .font(.body)
            Spacer()
            Text(String(format: "$%.2f", amount))
                .font(.body.monospacedDigit())
            Text(String(format: "(%.1f%%)", percentage))
                .font(.caption)
                .foregroundColor(.secondary)
                .frame(width: 60, alignment: .trailing)
        }
    }
    
    private func lineItemSection(_ title: String, items: [CostEstimatorService.LineItem]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundColor(.secondary)
            
            ForEach(items, id: \.name) { item in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.name)
                            .font(.caption)
                        Text(item.description)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                    Text(String(format: "$%.2f", item.monthlyCost))
                        .font(.caption.monospacedDigit())
                }
            }
        }
    }
    
    private func recommendationRow(_ rec: CostEstimatorService.CostRecommendation) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "lightbulb.fill")
                .foregroundColor(.yellow)
            
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(rec.title)
                        .font(.body.weight(.medium))
                    Spacer()
                    Text(rec.formattedSavings)
                        .font(.caption.weight(.semibold))
                        .foregroundColor(.green)
                }
                
                Text(rec.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                HStack {
                    Label(rec.effort.rawValue.capitalized, systemImage: "hammer.fill")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    Label(rec.impact.rawValue.capitalized, systemImage: "arrow.up.right")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding()
        .background(Color.yellow.opacity(0.1))
        .cornerRadius(8)
    }
    
    // MARK: - Export Sheet
    
    private var exportSheet: some View {
        VStack(spacing: 20) {
            Text("Export Cost Estimate")
                .font(.title2.weight(.semibold))
            
            if let estimate = estimate {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Monthly: \(estimate.summary.formattedMonthly)")
                    Text("Tier: \(selectedTier.capitalized)")
                    Text("Region: \(selectedRegion)")
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
                    exportEstimate()
                }
                .buttonStyle(.borderedProminent)
                
                Button("Copy to Clipboard") {
                    copyToClipboard()
                }
                .buttonStyle(.bordered)
            }
        }
        .padding()
        .frame(width: 400)
    }
    
    // MARK: - Actions
    
    private func calculateEstimate() async {
        isCalculating = true
        
        estimate = await CostEstimatorService.shared.generateEstimate(
            tier: selectedTier,
            region: selectedRegion,
            multiRegion: enableMultiRegion,
            regions: Array(multiRegions),
            auroraInstanceClass: auroraInstanceClass,
            auroraMinCapacity: auroraMinCapacity,
            auroraMaxCapacity: auroraMaxCapacity,
            enableSelfHostedModels: enableSelfHosted,
            selfHostedGPUInstances: gpuInstances,
            enableWAF: enableWAF,
            enableGuardDuty: enableGuardDuty,
            expectedMonthlyRequests: expectedRequests,
            expectedStorageGB: expectedStorageGB,
            expectedDataTransferGB: expectedDataTransferGB
        )
        
        isCalculating = false
    }
    
    private func applyTierDefaults(_ tier: String) {
        switch tier {
        case "seed":
            auroraInstanceClass = "db.t4g.medium"
            auroraMinCapacity = 0
            auroraMaxCapacity = 2
            expectedRequests = 100_000
            expectedStorageGB = 10
            expectedDataTransferGB = 50
        case "starter":
            auroraInstanceClass = "db.r6g.large"
            auroraMinCapacity = 1
            auroraMaxCapacity = 4
            expectedRequests = 1_000_000
            expectedStorageGB = 50
            expectedDataTransferGB = 200
        case "growth":
            auroraInstanceClass = "db.r6g.xlarge"
            auroraMinCapacity = 2
            auroraMaxCapacity = 8
            expectedRequests = 10_000_000
            expectedStorageGB = 200
            expectedDataTransferGB = 1000
        case "scale":
            auroraInstanceClass = "db.r6g.2xlarge"
            auroraMinCapacity = 4
            auroraMaxCapacity = 16
            expectedRequests = 100_000_000
            expectedStorageGB = 1000
            expectedDataTransferGB = 5000
        case "enterprise":
            auroraInstanceClass = "db.r6g.4xlarge"
            auroraMinCapacity = 8
            auroraMaxCapacity = 32
            expectedRequests = 1_000_000_000
            expectedStorageGB = 5000
            expectedDataTransferGB = 20000
        default:
            break
        }
    }
    
    private func formatNumber(_ num: Int64) -> String {
        if num >= 1_000_000_000 {
            return String(format: "%.1fB", Double(num) / 1_000_000_000)
        } else if num >= 1_000_000 {
            return String(format: "%.1fM", Double(num) / 1_000_000)
        } else if num >= 1_000 {
            return String(format: "%.1fK", Double(num) / 1_000)
        }
        return "\(num)"
    }
    
    private func exportEstimate() {
        guard let estimate = estimate else { return }
        
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.json]
        panel.nameFieldStringValue = "cost-estimate-\(selectedTier)-\(Date().ISO8601Format()).json"
        
        if panel.runModal() == .OK, let url = panel.url {
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            encoder.dateEncodingStrategy = .iso8601
            
            if let data = try? encoder.encode(estimate) {
                try? data.write(to: url)
            }
        }
        
        showingExportSheet = false
    }
    
    private func copyToClipboard() {
        guard let estimate = estimate else { return }
        
        let summary = """
        RADIANT Cost Estimate
        =====================
        Tier: \(selectedTier.capitalized)
        Region: \(selectedRegion)
        
        Monthly Total: \(estimate.summary.formattedMonthly)
        Annual Total: \(estimate.summary.formattedYearly)
        Range: \(estimate.summary.formattedRange)
        
        Breakdown:
        - Compute: $\(String(format: "%.2f", estimate.breakdown.compute.total))
        - Database: $\(String(format: "%.2f", estimate.breakdown.database.total))
        - Storage: $\(String(format: "%.2f", estimate.breakdown.storage.total))
        - Networking: $\(String(format: "%.2f", estimate.breakdown.networking.total))
        - Security: $\(String(format: "%.2f", estimate.breakdown.security.total))
        - AI: $\(String(format: "%.2f", estimate.breakdown.ai.total))
        - Other: $\(String(format: "%.2f", estimate.breakdown.other.total))
        
        Generated: \(Date().formatted())
        """
        
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(summary, forType: .string)
        
        showingExportSheet = false
    }
}

#Preview {
    CostEstimatorView()
        .environmentObject(AppState())
        .frame(width: 1000, height: 700)
}
