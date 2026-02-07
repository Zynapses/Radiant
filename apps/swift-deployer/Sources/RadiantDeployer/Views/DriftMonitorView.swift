// RADIANT v7.0.0 - Drift Monitor View
// Implements: Infrastructure drift detection with AI-powered review and reconciliation

import SwiftUI

struct DriftMonitorView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var driftService = DriftDetectionService()
    @State private var selectedDrift: DriftResult?
    @State private var showAIReviewSheet = false
    @State private var isScanning = false
    
    var body: some View {
        HSplitView {
            // Left: Drift List
            DriftListPanel(
                drifts: driftService.detectedDrifts,
                selectedDrift: $selectedDrift,
                isScanning: isScanning,
                onScan: { await scanForDrift() },
                onAdopt: { drift in await adoptDrift(drift) },
                onRevert: { drift in await revertDrift(drift) }
            )
            .frame(minWidth: 400, idealWidth: 500)
            
            // Right: Detail Panel
            if let drift = selectedDrift {
                DriftDetailPanel(
                    drift: drift,
                    aiReview: driftService.aiReviews[drift.id],
                    onRequestAIReview: { await requestAIReview(drift) },
                    onAdopt: { await adoptDrift(drift) },
                    onRevert: { await revertDrift(drift) }
                )
            } else {
                EmptyDriftDetailPanel()
            }
        }
        .background(Color(nsColor: .windowBackgroundColor))
        .navigationTitle("Drift Monitor")
        .toolbar {
            ToolbarItemGroup {
                Toggle(isOn: $driftService.autoScanEnabled) {
                    Label("Auto-Scan", systemImage: "clock.arrow.circlepath")
                }
                .help("Automatically scan for drift every 15 minutes")
                
                Button {
                    Task { await scanForDrift() }
                } label: {
                    Label("Scan Now", systemImage: "arrow.triangle.2.circlepath")
                }
                .disabled(isScanning)
            }
        }
        .task {
            await driftService.loadHistory()
        }
    }
    
    private func scanForDrift() async {
        isScanning = true
        defer { isScanning = false }
        await driftService.detectDrift(for: appState.selectedEnvironment)
    }
    
    private func requestAIReview(_ drift: DriftResult) async {
        await driftService.requestAIReview(for: drift)
    }
    
    private func adoptDrift(_ drift: DriftResult) async {
        await driftService.adoptDrift(drift)
        selectedDrift = nil
    }
    
    private func revertDrift(_ drift: DriftResult) async {
        await driftService.revertDrift(drift)
        selectedDrift = nil
    }
}

// MARK: - Drift List Panel

struct DriftListPanel: View {
    let drifts: [DriftResult]
    @Binding var selectedDrift: DriftResult?
    let isScanning: Bool
    let onScan: () async -> Void
    let onAdopt: (DriftResult) async -> Void
    let onRevert: (DriftResult) async -> Void
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Infrastructure Drift")
                        .font(.headline)
                    
                    if drifts.isEmpty {
                        Text("No drift detected")
                            .font(.caption)
                            .foregroundStyle(.green)
                    } else {
                        Text("\(drifts.count) resource\(drifts.count == 1 ? "" : "s") drifted")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    }
                }
                
                Spacer()
                
                if isScanning {
                    ProgressView()
                        .controlSize(.small)
                    Text("Scanning...")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding()
            .background(.bar)
            
            Divider()
            
            // Drift List
            if drifts.isEmpty {
                EmptyDriftListView(isScanning: isScanning, onScan: onScan)
            } else {
                List(selection: $selectedDrift) {
                    ForEach(drifts) { drift in
                        DriftRowView(drift: drift)
                            .tag(drift)
                            .contextMenu {
                                Button("View Details") {
                                    selectedDrift = drift
                                }
                                Divider()
                                Button("Adopt Change") {
                                    Task { await onAdopt(drift) }
                                }
                                Button("Revert to Expected", role: .destructive) {
                                    Task { await onRevert(drift) }
                                }
                            }
                    }
                }
                .listStyle(.inset)
            }
            
            Divider()
            
            // Footer with last scan info
            HStack {
                Image(systemName: "clock")
                    .foregroundStyle(.secondary)
                Text("Last scan: Just now")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                
                Spacer()
                
                Button("Scan All Stacks") {
                    Task { await onScan() }
                }
                .buttonStyle(.borderless)
                .disabled(isScanning)
            }
            .padding(RadiantSpacing.sm)
            .background(.bar)
        }
    }
}

struct EmptyDriftListView: View {
    let isScanning: Bool
    let onScan: () async -> Void
    
    var body: some View {
        VStack(spacing: RadiantSpacing.lg) {
            Spacer()
            
            Image(systemName: "checkmark.shield.fill")
                .font(.system(size: 48))
                .foregroundStyle(.green)
            
            Text("No Drift Detected")
                .font(.title2)
                .fontWeight(.semibold)
            
            Text("Your infrastructure matches the expected state.\nChanges made outside the Deployer will appear here.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            
            Button {
                Task { await onScan() }
            } label: {
                Label("Scan Now", systemImage: "arrow.triangle.2.circlepath")
            }
            .buttonStyle(.borderedProminent)
            .disabled(isScanning)
            
            Spacer()
        }
        .frame(maxWidth: .infinity)
        .padding()
    }
}

struct DriftRowView: View {
    let drift: DriftResult
    
    var body: some View {
        HStack(spacing: RadiantSpacing.md) {
            // Severity indicator
            Circle()
                .fill(drift.severity.color)
                .frame(width: 10, height: 10)
            
            // Resource info
            VStack(alignment: .leading, spacing: 2) {
                Text(drift.resourceType)
                    .font(.headline)
                
                Text(drift.resourceId)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            
            Spacer()
            
            // Change type badge
            Text(drift.changeType.rawValue)
                .font(.caption2)
                .fontWeight(.medium)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(drift.changeType.color.opacity(0.2))
                .foregroundStyle(drift.changeType.color)
                .clipShape(Capsule())
            
            // AI review indicator
            if drift.hasAIReview {
                Image(systemName: "sparkles")
                    .foregroundStyle(.purple)
                    .font(.caption)
            }
            
            // Time
            Text(drift.detectedAt.formatted(.relative(presentation: .named)))
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, RadiantSpacing.xs)
    }
}

// MARK: - Drift Detail Panel

struct DriftDetailPanel: View {
    let drift: DriftResult
    let aiReview: AIReviewResult?
    let onRequestAIReview: () async -> Void
    let onAdopt: () async -> Void
    let onRevert: () async -> Void
    
    @State private var isRequestingReview = false
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: RadiantSpacing.lg) {
                // Header
                DriftDetailHeader(drift: drift)
                
                // Change summary
                DriftChangeSummary(drift: drift)
                
                // AI Review section
                AIReviewSection(
                    review: aiReview,
                    isRequesting: isRequestingReview,
                    onRequest: {
                        isRequestingReview = true
                        await onRequestAIReview()
                        isRequestingReview = false
                    }
                )
                
                // Diff view
                DriftDiffView(drift: drift)
                
                // Actions
                DriftActionButtons(
                    drift: drift,
                    aiReview: aiReview,
                    onAdopt: onAdopt,
                    onRevert: onRevert
                )
                
                // Metadata
                DriftMetadataSection(drift: drift)
            }
            .padding(RadiantSpacing.lg)
        }
        .background(Color(nsColor: .controlBackgroundColor))
    }
}

struct DriftDetailHeader: View {
    let drift: DriftResult
    
    var body: some View {
        VStack(alignment: .leading, spacing: RadiantSpacing.sm) {
            HStack {
                Image(systemName: drift.resourceIcon)
                    .font(.title2)
                    .foregroundStyle(drift.severity.color)
                
                VStack(alignment: .leading) {
                    Text(drift.resourceType)
                        .font(.title2)
                        .fontWeight(.bold)
                    
                    Text(drift.resourceId)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                Spacer()
                
                VStack(alignment: .trailing) {
                    SeverityBadge(severity: drift.severity)
                    
                    Text(drift.stackName)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

struct SeverityBadge: View {
    let severity: DriftSeverity
    
    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(severity.color)
                .frame(width: 8, height: 8)
            
            Text(severity.rawValue)
                .font(.caption)
                .fontWeight(.medium)
        }
        .padding(.horizontal, RadiantSpacing.sm)
        .padding(.vertical, 2)
        .background(severity.color.opacity(0.15))
        .clipShape(Capsule())
    }
}

struct DriftChangeSummary: View {
    let drift: DriftResult
    
    var body: some View {
        VStack(alignment: .leading, spacing: RadiantSpacing.sm) {
            Text("Change Summary")
                .font(.headline)
            
            HStack(spacing: RadiantSpacing.lg) {
                VStack(alignment: .leading) {
                    Text("Property")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(drift.propertyPath)
                        .font(.system(.body, design: .monospaced))
                }
                
                Spacer()
                
                VStack(alignment: .center) {
                    Text("Change Type")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(drift.changeType.rawValue)
                        .fontWeight(.medium)
                        .foregroundStyle(drift.changeType.color)
                }
                
                Spacer()
                
                VStack(alignment: .trailing) {
                    Text("Changed By")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(drift.changedBy ?? "Unknown")
                        .font(.caption)
                }
            }
            .padding()
            .background(Color(nsColor: .windowBackgroundColor))
            .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.md))
        }
    }
}

struct AIReviewSection: View {
    let review: AIReviewResult?
    let isRequesting: Bool
    let onRequest: () async -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: RadiantSpacing.sm) {
            HStack {
                Image(systemName: "sparkles")
                    .foregroundStyle(.purple)
                Text("AI Review")
                    .font(.headline)
                
                Spacer()
                
                if review == nil && !isRequesting {
                    Button {
                        Task { await onRequest() }
                    } label: {
                        Label("Request Review", systemImage: "sparkles")
                    }
                    .buttonStyle(.bordered)
                }
            }
            
            if isRequesting {
                HStack {
                    ProgressView()
                        .controlSize(.small)
                    Text("AI is analyzing this change...")
                        .foregroundStyle(.secondary)
                }
                .padding()
                .frame(maxWidth: .infinity)
                .background(Color.purple.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.md))
            } else if let review = review {
                VStack(alignment: .leading, spacing: RadiantSpacing.md) {
                    // Recommendation
                    HStack {
                        Image(systemName: review.recommendation.icon)
                            .foregroundStyle(review.recommendation.color)
                        
                        Text(review.recommendation.rawValue)
                            .fontWeight(.semibold)
                            .foregroundStyle(review.recommendation.color)
                        
                        Spacer()
                        
                        Text("Confidence: \(Int(review.confidence * 100))%")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    
                    // Analysis
                    Text(review.analysis)
                        .font(.body)
                    
                    // Risk assessment
                    if let risks = review.risks, !risks.isEmpty {
                        VStack(alignment: .leading, spacing: RadiantSpacing.xs) {
                            Text("Potential Risks")
                                .font(.caption)
                                .fontWeight(.medium)
                                .foregroundStyle(.secondary)
                            
                            ForEach(risks, id: \.self) { risk in
                                HStack(alignment: .top, spacing: RadiantSpacing.xs) {
                                    Image(systemName: "exclamationmark.triangle.fill")
                                        .font(.caption)
                                        .foregroundStyle(.orange)
                                    Text(risk)
                                        .font(.caption)
                                }
                            }
                        }
                    }
                }
                .padding()
                .background(Color.purple.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.md))
            } else {
                Text("Request an AI review to get recommendations on how to handle this drift.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(Color(nsColor: .windowBackgroundColor))
                    .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.md))
            }
        }
    }
}

struct DriftDiffView: View {
    let drift: DriftResult
    @State private var showRaw = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: RadiantSpacing.sm) {
            HStack {
                Text("Value Comparison")
                    .font(.headline)
                
                Spacer()
                
                Toggle("Raw", isOn: $showRaw)
                    .toggleStyle(.button)
                    .controlSize(.small)
            }
            
            HStack(spacing: RadiantSpacing.md) {
                // Expected value
                VStack(alignment: .leading, spacing: RadiantSpacing.xs) {
                    Text("Expected (IaC)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    
                    ScrollView(.horizontal, showsIndicators: false) {
                        Text(drift.expectedValue)
                            .font(.system(.caption, design: .monospaced))
                            .padding(RadiantSpacing.sm)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.green.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.sm))
                }
                
                Image(systemName: "arrow.right")
                    .foregroundStyle(.secondary)
                
                // Actual value
                VStack(alignment: .leading, spacing: RadiantSpacing.xs) {
                    Text("Actual (AWS)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    
                    ScrollView(.horizontal, showsIndicators: false) {
                        Text(drift.actualValue)
                            .font(.system(.caption, design: .monospaced))
                            .padding(RadiantSpacing.sm)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.orange.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.sm))
                }
            }
        }
    }
}

struct DriftActionButtons: View {
    let drift: DriftResult
    let aiReview: AIReviewResult?
    let onAdopt: () async -> Void
    let onRevert: () async -> Void
    
    @State private var isAdopting = false
    @State private var isReverting = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: RadiantSpacing.sm) {
            Text("Actions")
                .font(.headline)
            
            HStack(spacing: RadiantSpacing.md) {
                Button {
                    Task {
                        isAdopting = true
                        await onAdopt()
                        isAdopting = false
                    }
                } label: {
                    if isAdopting {
                        ProgressView()
                            .controlSize(.small)
                    } else {
                        Label("Adopt Change", systemImage: "checkmark.circle")
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
                .disabled(isAdopting || isReverting)
                
                Button {
                    Task {
                        isReverting = true
                        await onRevert()
                        isReverting = false
                    }
                } label: {
                    if isReverting {
                        ProgressView()
                            .controlSize(.small)
                    } else {
                        Label("Revert to Expected", systemImage: "arrow.uturn.backward")
                    }
                }
                .buttonStyle(.bordered)
                .disabled(isAdopting || isReverting)
                
                Spacer()
                
                Button {
                    // Ignore this drift
                } label: {
                    Label("Ignore Once", systemImage: "eye.slash")
                }
                .buttonStyle(.borderless)
            }
            
            // AI recommendation note
            if let review = aiReview {
                HStack(spacing: RadiantSpacing.xs) {
                    Image(systemName: "sparkles")
                        .font(.caption)
                        .foregroundStyle(.purple)
                    
                    Text("AI recommends: \(review.recommendation.rawValue)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

struct DriftMetadataSection: View {
    let drift: DriftResult
    
    var body: some View {
        VStack(alignment: .leading, spacing: RadiantSpacing.sm) {
            Text("Metadata")
                .font(.headline)
            
            VStack(spacing: RadiantSpacing.xs) {
                MetadataRow(label: "Stack", value: drift.stackName)
                MetadataRow(label: "Logical ID", value: drift.logicalId)
                MetadataRow(label: "Physical ID", value: drift.physicalId ?? "—")
                MetadataRow(label: "Detected", value: drift.detectedAt.formatted())
                MetadataRow(label: "Changed By", value: drift.changedBy ?? "Unknown")
                MetadataRow(label: "Change Time", value: drift.changeTime?.formatted() ?? "Unknown")
            }
            .padding()
            .background(Color(nsColor: .windowBackgroundColor))
            .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.md))
        }
    }
}

struct MetadataRow: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text(label)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .font(.system(.body, design: .monospaced))
                .lineLimit(1)
        }
        .font(.caption)
    }
}

struct EmptyDriftDetailPanel: View {
    var body: some View {
        VStack(spacing: RadiantSpacing.lg) {
            Image(systemName: "arrow.left.circle")
                .font(.system(size: 48))
                .foregroundStyle(.tertiary)
            
            Text("Select a drift item")
                .font(.title3)
                .foregroundStyle(.secondary)
            
            Text("Choose a drifted resource from the list to view details and take action.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(nsColor: .controlBackgroundColor))
    }
}

// MARK: - Models

enum DriftSeverity: String, Sendable {
    case critical = "Critical"
    case high = "High"
    case medium = "Medium"
    case low = "Low"
    
    var color: Color {
        switch self {
        case .critical: return .red
        case .high: return .orange
        case .medium: return .yellow
        case .low: return .blue
        }
    }
}

enum DriftChangeType: String, Sendable {
    case modified = "Modified"
    case deleted = "Deleted"
    case added = "Added"
    
    var color: Color {
        switch self {
        case .modified: return .orange
        case .deleted: return .red
        case .added: return .green
        }
    }
}

enum AIRecommendation: String, Sendable {
    case adopt = "Adopt"
    case revert = "Revert"
    case investigate = "Investigate"
    
    var icon: String {
        switch self {
        case .adopt: return "checkmark.circle.fill"
        case .revert: return "arrow.uturn.backward.circle.fill"
        case .investigate: return "magnifyingglass.circle.fill"
        }
    }
    
    var color: Color {
        switch self {
        case .adopt: return .green
        case .revert: return .orange
        case .investigate: return .blue
        }
    }
}

struct DriftResult: Identifiable, Hashable, Sendable {
    let id: UUID
    let stackName: String
    let logicalId: String
    let physicalId: String?
    let resourceType: String
    let resourceId: String
    let propertyPath: String
    let expectedValue: String
    let actualValue: String
    let changeType: DriftChangeType
    let severity: DriftSeverity
    let detectedAt: Date
    let changedBy: String?
    let changeTime: Date?
    let hasAIReview: Bool
    
    var resourceIcon: String {
        switch resourceType {
        case _ where resourceType.contains("Lambda"): return "function"
        case _ where resourceType.contains("DynamoDB"): return "tablecells"
        case _ where resourceType.contains("S3"): return "externaldrive"
        case _ where resourceType.contains("API"): return "network"
        case _ where resourceType.contains("RDS"), _ where resourceType.contains("Aurora"): return "cylinder"
        case _ where resourceType.contains("IAM"): return "person.badge.key"
        case _ where resourceType.contains("CloudWatch"): return "chart.line.uptrend.xyaxis"
        case _ where resourceType.contains("SNS"), _ where resourceType.contains("SQS"): return "envelope"
        case _ where resourceType.contains("Secret"): return "key"
        default: return "cube"
        }
    }
    
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
    
    static func == (lhs: DriftResult, rhs: DriftResult) -> Bool {
        lhs.id == rhs.id
    }
}

struct AIReviewResult: Sendable {
    let recommendation: AIRecommendation
    let confidence: Double
    let analysis: String
    let risks: [String]?
}

// MARK: - Drift Detection Service

@MainActor
class DriftDetectionService: ObservableObject {
    @Published var detectedDrifts: [DriftResult] = []
    @Published var aiReviews: [UUID: AIReviewResult] = [:]
    @Published var autoScanEnabled = true
    @Published var isScanning = false
    @Published var lastScanTime: Date?
    
    private var autoScanTask: Task<Void, Never>?
    
    init() {
        startAutoScan()
    }
    
    deinit {
        autoScanTask?.cancel()
    }
    
    func loadHistory() async {
        // Load drift history from local storage or API
    }
    
    func startAutoScan() {
        autoScanTask?.cancel()
        autoScanTask = Task {
            while !Task.isCancelled {
                if autoScanEnabled {
                    await detectDrift(for: .prod)
                }
                try? await Task.sleep(for: .seconds(900)) // 15 minutes
            }
        }
    }
    
    func detectDrift(for environment: DeployEnvironment) async {
        isScanning = true
        defer { isScanning = false }
        
        // In production, this would call:
        // 1. CloudFormation DetectStackDrift API
        // 2. Wait for drift detection to complete
        // 3. Get drifted resources
        
        // Demo data showing typical drift scenarios
        try? await Task.sleep(for: .seconds(2))
        
        detectedDrifts = [
            DriftResult(
                id: UUID(),
                stackName: "RadiantAPIStack",
                logicalId: "ThinktankAPIFunction",
                physicalId: "radiant-prod-thinktank-api",
                resourceType: "AWS::Lambda::Function",
                resourceId: "Lambda/ThinktankAPI",
                propertyPath: "Environment.Variables.FEATURE_FLAG_SHADOW",
                expectedValue: "\"false\"",
                actualValue: "\"true\"",
                changeType: .modified,
                severity: .low,
                detectedAt: Date().addingTimeInterval(-3600),
                changedBy: "arn:aws:iam::123456789:user/windsurf-agent",
                changeTime: Date().addingTimeInterval(-3700),
                hasAIReview: true
            ),
            DriftResult(
                id: UUID(),
                stackName: "RadiantDatabaseStack",
                logicalId: "AuroraCluster",
                physicalId: "radiant-prod-aurora",
                resourceType: "AWS::RDS::DBCluster",
                resourceId: "Aurora/RadiantCluster",
                propertyPath: "BackupRetentionPeriod",
                expectedValue: "7",
                actualValue: "14",
                changeType: .modified,
                severity: .medium,
                detectedAt: Date().addingTimeInterval(-7200),
                changedBy: "arn:aws:iam::123456789:user/admin",
                changeTime: Date().addingTimeInterval(-7300),
                hasAIReview: false
            )
        ]
        
        lastScanTime = Date()
    }
    
    func requestAIReview(for drift: DriftResult) async {
        // In production, send to Claude/GPT-4 for analysis
        try? await Task.sleep(for: .seconds(2))
        
        let review: AIReviewResult
        
        if drift.propertyPath.contains("FEATURE_FLAG") {
            review = AIReviewResult(
                recommendation: .adopt,
                confidence: 0.94,
                analysis: "This change enables a feature flag that appears to be intentionally set for shadow mode testing. The change was made by the Windsurf agent, suggesting it was part of an automated deployment or testing workflow. The change is safe and aligns with typical feature flag patterns.",
                risks: nil
            )
        } else if drift.propertyPath.contains("BackupRetention") {
            review = AIReviewResult(
                recommendation: .adopt,
                confidence: 0.87,
                analysis: "The backup retention period was increased from 7 to 14 days. This is a positive change that improves data durability and disaster recovery capabilities. The change was made by an admin user, likely in response to compliance requirements.",
                risks: ["Increased storage costs (~$2.50/day based on current DB size)"]
            )
        } else {
            review = AIReviewResult(
                recommendation: .investigate,
                confidence: 0.65,
                analysis: "This change requires further investigation. The modification source and intent are unclear.",
                risks: ["Potential security implications", "May affect dependent resources"]
            )
        }
        
        aiReviews[drift.id] = review
    }
    
    func adoptDrift(_ drift: DriftResult) async {
        // Update local IaC state to match AWS
        // Generate migration record
        // Optionally create PR to CDK repo
        
        try? await Task.sleep(for: .seconds(1))
        detectedDrifts.removeAll { $0.id == drift.id }
        aiReviews.removeValue(forKey: drift.id)
    }
    
    func revertDrift(_ drift: DriftResult) async {
        // Deploy to revert AWS state to expected
        // This triggers a CloudFormation update
        
        try? await Task.sleep(for: .seconds(2))
        detectedDrifts.removeAll { $0.id == drift.id }
        aiReviews.removeValue(forKey: drift.id)
    }
}

// MARK: - Preview

#Preview {
    DriftMonitorView()
        .environmentObject(AppState())
        .frame(width: 1200, height: 800)
}
