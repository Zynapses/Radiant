// RADIANT - Bi-directional Sync Version Management
// Auto-versioned components for AWS state extraction and CDK generation

import Foundation

/// Version information for bi-directional sync components
struct BidirectionalSyncVersion: Codable, Sendable {
    
    // MARK: - Current Versions
    
    /// Overall bi-directional sync system version
    static let systemVersion = "1.4.0"
    
    /// AWS State Tracker component version
    static let stateTrackerVersion = "1.2.0"
    
    /// CDK Code Generator component version
    static let cdkGeneratorVersion = "1.2.0"
    
    /// Instance State Extractor component version
    static let extractorVersion = "1.0.0"
    
    /// Schema Diff Generator component version
    static let diffGeneratorVersion = "1.0.0"
    
    /// Package Generator component version
    static let packageGeneratorVersion = "1.0.0"
    
    /// Secret Migrator component version
    static let secretMigratorVersion = "1.0.0"
    
    /// Safe Schema Migration component version
    static let safeSchemaMigrationVersion = "1.1.0"
    
    /// Snapshot Manager component version
    static let snapshotManagerVersion = "1.0.0"
    
    // MARK: - Capabilities by Version
    
    /// Resources supported by current AWS State Tracker version
    static let trackedResourceTypes: [String] = [
        "IAM Roles",
        "IAM Policies",
        "Security Groups",
        "Secrets Manager",
        "Parameter Store",
        "EventBridge Rules",
        "SQS Queues",
        "SNS Topics",
        "CloudWatch Alarms",
        "CloudWatch Dashboards",
        "API Gateway",
        "Cognito User Pools",
        "Step Functions",
        "Kinesis Streams"
    ]
    
    /// Resources supported by Instance State Extractor
    static let extractedResourceTypes: [String] = [
        "Database Schema (Aurora PostgreSQL)",
        "Lambda Functions (code + config)",
        "S3 Bucket Configurations",
        "DynamoDB Table Schemas",
        "CDK Stack Outputs"
    ]
    
    // MARK: - Version History
    
    struct VersionHistoryEntry: Codable, Sendable {
        let version: String
        let releaseDate: Date
        let changes: [String]
    }
    
    static let versionHistory: [VersionHistoryEntry] = [
        VersionHistoryEntry(
            version: "1.4.0",
            releaseDate: ISO8601DateFormatter().date(from: "2026-02-05T02:15:00Z") ?? Date(),
            changes: [
                "✅ NEW: Full RDS Snapshot Manager with tiered storage",
                "On-demand snapshot creation (Aurora + DynamoDB + S3 manifest)",
                "Versioned snapshots with restore history",
                "Tiered storage: Hot → Warm → Cold → Archive lifecycle",
                "Swift Deployer: New Snapshot Management UI",
                "Admin Dashboard: Snapshot management page",
                "Pre-migration full snapshots before destructive schema changes",
                "Configurable retention policy and auto-transition rules"
            ]
        ),
        VersionHistoryEntry(
            version: "1.3.0",
            releaseDate: ISO8601DateFormatter().date(from: "2026-02-05T01:55:00Z") ?? Date(),
            changes: [
                "✅ NEW: Safe Schema Migration with automatic data clearing",
                "Schema change detection compares instance vs package schemas",
                "4 migration policies: Strict, ClearData, Preserve, Manual",
                "Automatic table backup before data clearing",
                "Full audit logging for regulatory compliance (GDPR, HIPAA)",
                "Prevents unknown failure outcomes from orphaned data",
                "Risk level assessment: Low, Medium, High, Critical"
            ]
        ),
        VersionHistoryEntry(
            version: "1.2.0",
            releaseDate: ISO8601DateFormatter().date(from: "2026-02-05T01:50:00Z") ?? Date(),
            changes: [
                "✅ AUTOMATED: Secret values now migrate securely without local storage",
                "✅ AUTOMATED: SecureString parameters now migrate automatically",
                "✅ AUTOMATED: CloudWatch dashboards capture full widget JSON",
                "New SecretMigrator service for cross-account secret/parameter migration",
                "All partial coverage items now have FULL automation",
                "Zero manual work required for any supported resource type"
            ]
        ),
        VersionHistoryEntry(
            version: "1.1.0",
            releaseDate: ISO8601DateFormatter().date(from: "2026-02-05T01:45:00Z") ?? Date(),
            changes: [
                "✅ FIXED: API Gateway authorizers now use dynamic Lambda ARN resolution",
                "✅ FIXED: Cognito Lambda triggers now use dynamic Lambda ARN resolution",
                "API Gateway and Cognito now have FULL bi-directional support",
                "Lambda function names extracted from ARNs for portable CDK code",
                "Generated CDK uses Function.fromFunctionName() for cross-account compatibility"
            ]
        ),
        VersionHistoryEntry(
            version: "1.0.0",
            releaseDate: ISO8601DateFormatter().date(from: "2026-02-05T00:00:00Z") ?? Date(),
            changes: [
                "Initial release of bi-directional sync",
                "AWS State Tracker: 14 resource types",
                "CDK Code Generator: Full TypeScript generation",
                "Instance State Extractor: Schema, Lambda, S3, DynamoDB",
                "Schema Diff Generator: Table, column, enum diffs",
                "Package Generator: Migration and Lambda code bundling"
            ]
        )
    ]
    
    // MARK: - Computed Properties
    
    /// Full version string for display
    static var displayVersion: String {
        "Bi-directional Sync v\(systemVersion)"
    }
    
    /// Detailed version info
    static var detailedVersion: String {
        """
        Bi-directional Sync System v\(systemVersion)
        ├─ State Tracker v\(stateTrackerVersion) (\(trackedResourceTypes.count) resource types)
        ├─ CDK Generator v\(cdkGeneratorVersion)
        ├─ Extractor v\(extractorVersion) (\(extractedResourceTypes.count) resource types)
        ├─ Diff Generator v\(diffGeneratorVersion)
        └─ Package Generator v\(packageGeneratorVersion)
        """
    }
    
    /// JSON-serializable version info for API responses
    static var versionInfo: [String: Any] {
        [
            "system": systemVersion,
            "components": [
                "stateTracker": stateTrackerVersion,
                "cdkGenerator": cdkGeneratorVersion,
                "extractor": extractorVersion,
                "diffGenerator": diffGeneratorVersion,
                "packageGenerator": packageGeneratorVersion
            ],
            "capabilities": [
                "trackedResourceTypes": trackedResourceTypes,
                "extractedResourceTypes": extractedResourceTypes
            ],
            "totalResourceTypes": trackedResourceTypes.count + extractedResourceTypes.count
        ]
    }
    
    // MARK: - Compatibility Check
    
    /// Check if a persisted state file is compatible with current version
    static func isCompatible(stateVersion: String) -> Bool {
        let currentParts = systemVersion.split(separator: ".").compactMap { Int($0) }
        let stateParts = stateVersion.split(separator: ".").compactMap { Int($0) }
        
        guard currentParts.count >= 2, stateParts.count >= 2 else { return false }
        
        // Major version must match, minor can be equal or less
        return currentParts[0] == stateParts[0] && currentParts[1] >= stateParts[1]
    }
    
    /// Get upgrade notes if version mismatch
    static func upgradeNotes(from oldVersion: String) -> String? {
        guard !isCompatible(stateVersion: oldVersion) else { return nil }
        
        return """
        Your saved state was created with v\(oldVersion).
        Current version is v\(systemVersion).
        Re-extraction is recommended to capture new resource types.
        """
    }
}

// MARK: - Version Badge View Component

import SwiftUI

struct BidirectionalSyncVersionBadge: View {
    var showDetails: Bool = false
    @State private var isHovering = false
    
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "arrow.triangle.2.circlepath.circle.fill")
                .foregroundColor(.purple)
            
            Text("v\(BidirectionalSyncVersion.systemVersion)")
                .font(.caption.monospaced())
                .foregroundColor(.secondary)
            
            if showDetails {
                Text("•")
                    .foregroundColor(.secondary)
                Text("\(BidirectionalSyncVersion.trackedResourceTypes.count + BidirectionalSyncVersion.extractedResourceTypes.count) resource types")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Color.purple.opacity(isHovering ? 0.15 : 0.1))
        .cornerRadius(6)
        .onHover { hovering in
            isHovering = hovering
        }
        .help(BidirectionalSyncVersion.detailedVersion)
    }
}

struct BidirectionalSyncVersionDetailView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                Image(systemName: "arrow.triangle.2.circlepath.circle.fill")
                    .font(.title2)
                    .foregroundColor(.purple)
                
                VStack(alignment: .leading) {
                    Text("Bi-directional Sync")
                        .font(.headline)
                    Text("v\(BidirectionalSyncVersion.systemVersion)")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
            }
            
            Divider()
            
            // Component versions
            GroupBox("Component Versions") {
                Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 6) {
                    GridRow {
                        Text("AWS State Tracker")
                        Text("v\(BidirectionalSyncVersion.stateTrackerVersion)")
                            .foregroundColor(.secondary)
                    }
                    GridRow {
                        Text("CDK Code Generator")
                        Text("v\(BidirectionalSyncVersion.cdkGeneratorVersion)")
                            .foregroundColor(.secondary)
                    }
                    GridRow {
                        Text("Instance Extractor")
                        Text("v\(BidirectionalSyncVersion.extractorVersion)")
                            .foregroundColor(.secondary)
                    }
                    GridRow {
                        Text("Schema Diff Generator")
                        Text("v\(BidirectionalSyncVersion.diffGeneratorVersion)")
                            .foregroundColor(.secondary)
                    }
                    GridRow {
                        Text("Package Generator")
                        Text("v\(BidirectionalSyncVersion.packageGeneratorVersion)")
                            .foregroundColor(.secondary)
                    }
                }
                .font(.caption)
                .padding(8)
            }
            
            // Capabilities
            GroupBox("Tracked AWS Resources (\(BidirectionalSyncVersion.trackedResourceTypes.count))") {
                FlowLayout(spacing: 4) {
                    ForEach(BidirectionalSyncVersion.trackedResourceTypes, id: \.self) { resource in
                        Text(resource)
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.blue.opacity(0.1))
                            .cornerRadius(4)
                    }
                }
                .padding(8)
            }
            
            GroupBox("Extracted Resources (\(BidirectionalSyncVersion.extractedResourceTypes.count))") {
                FlowLayout(spacing: 4) {
                    ForEach(BidirectionalSyncVersion.extractedResourceTypes, id: \.self) { resource in
                        Text(resource)
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.green.opacity(0.1))
                            .cornerRadius(4)
                    }
                }
                .padding(8)
            }
        }
        .padding()
        .frame(width: 350)
    }
}

// MARK: - Flow Layout for Tags

struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = FlowResult(in: proposal.width ?? 0, subviews: subviews, spacing: spacing)
        return result.size
    }
    
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = FlowResult(in: bounds.width, subviews: subviews, spacing: spacing)
        for (index, subview) in subviews.enumerated() {
            subview.place(at: CGPoint(x: bounds.minX + result.positions[index].x,
                                       y: bounds.minY + result.positions[index].y),
                         proposal: .unspecified)
        }
    }
    
    struct FlowResult {
        var size: CGSize = .zero
        var positions: [CGPoint] = []
        
        init(in maxWidth: CGFloat, subviews: Subviews, spacing: CGFloat) {
            var x: CGFloat = 0
            var y: CGFloat = 0
            var rowHeight: CGFloat = 0
            
            for subview in subviews {
                let size = subview.sizeThatFits(.unspecified)
                
                if x + size.width > maxWidth && x > 0 {
                    x = 0
                    y += rowHeight + spacing
                    rowHeight = 0
                }
                
                positions.append(CGPoint(x: x, y: y))
                rowHeight = max(rowHeight, size.height)
                x += size.width + spacing
                
                self.size.width = max(self.size.width, x)
            }
            
            self.size.height = y + rowHeight
        }
    }
}

#Preview {
    VStack {
        BidirectionalSyncVersionBadge()
        BidirectionalSyncVersionBadge(showDetails: true)
        Divider()
        BidirectionalSyncVersionDetailView()
    }
    .padding()
}
