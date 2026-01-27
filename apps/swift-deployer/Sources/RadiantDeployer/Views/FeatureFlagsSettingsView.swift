// RADIANT v5.52.17 - Feature Flags Settings View
// Configure which platform features are enabled

import SwiftUI

struct FeatureFlagsSettingsView: View {
    @AppStorage("enableCurator") private var enableCurator = true
    @AppStorage("enableCortexMemory") private var enableCortexMemory = true
    @AppStorage("enableTimeMachine") private var enableTimeMachine = true
    @AppStorage("enableCollaboration") private var enableCollaboration = true
    @AppStorage("enableComplianceExport") private var enableComplianceExport = true
    @AppStorage("enableEgoSystem") private var enableEgoSystem = true
    @AppStorage("enableSelfHostedModels") private var enableSelfHostedModels = false
    @AppStorage("enableMultiRegion") private var enableMultiRegion = false
    
    var body: some View {
        Form {
            // Core Platform Features
            Section {
                FeatureToggleRow(
                    title: "Cortex Memory System",
                    description: "Three-tier memory (Hot/Warm/Cold) with knowledge graph",
                    icon: "brain",
                    iconColor: .purple,
                    isOn: $enableCortexMemory
                )
                
                FeatureToggleRow(
                    title: "Zero-Cost Ego System",
                    description: "Persistent AI identity at $0 additional cost",
                    icon: "person.crop.circle",
                    iconColor: .blue,
                    isOn: $enableEgoSystem
                )
                
                FeatureToggleRow(
                    title: "Compliance Export",
                    description: "HIPAA, SOC2, GDPR-formatted conversation exports",
                    icon: "checkmark.shield",
                    iconColor: .green,
                    isOn: $enableComplianceExport
                )
            } header: {
                Label("Core Features", systemImage: "star.fill")
            } footer: {
                Text("Core features are enabled by default and recommended for all deployments")
            }
            
            // Think Tank Features
            Section {
                FeatureToggleRow(
                    title: "Time Machine",
                    description: "Fork conversations, create checkpoints, navigate timelines",
                    icon: "clock.arrow.circlepath",
                    iconColor: .orange,
                    isOn: $enableTimeMachine
                )
                
                FeatureToggleRow(
                    title: "Real-time Collaboration",
                    description: "Multi-user sessions with AI facilitator",
                    icon: "person.3",
                    iconColor: .cyan,
                    isOn: $enableCollaboration
                )
            } header: {
                Label("Think Tank Features", systemImage: "bubble.left.and.bubble.right")
            }
            
            // Optional Applications
            Section {
                FeatureToggleRow(
                    title: "Curator App",
                    description: "Knowledge graph curation and fact verification",
                    icon: "book.pages",
                    iconColor: .orange,
                    isOn: $enableCurator,
                    tierRequirement: "Growth tier and above"
                )
            } header: {
                Label("Optional Applications", systemImage: "app.badge")
            }
            
            // Infrastructure Features
            Section {
                FeatureToggleRow(
                    title: "Self-Hosted Models",
                    description: "Deploy models on SageMaker for data sovereignty",
                    icon: "server.rack",
                    iconColor: .indigo,
                    isOn: $enableSelfHostedModels,
                    tierRequirement: "Growth tier and above"
                )
                
                FeatureToggleRow(
                    title: "Multi-Region Deployment",
                    description: "Deploy across multiple AWS regions for resilience",
                    icon: "globe",
                    iconColor: .blue,
                    isOn: $enableMultiRegion,
                    tierRequirement: "Scale tier and above"
                )
            } header: {
                Label("Infrastructure", systemImage: "server.rack")
            } footer: {
                Text("Infrastructure features may incur additional AWS costs")
            }
            
            // Feature Summary
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Enabled Features")
                        .font(.headline)
                    
                    let enabled = enabledFeaturesList
                    if enabled.isEmpty {
                        Text("No features enabled")
                            .foregroundStyle(.secondary)
                    } else {
                        FlowLayout(spacing: 8) {
                            ForEach(enabled, id: \.self) { feature in
                                Text(feature)
                                    .font(.caption)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(.blue.opacity(0.1))
                                    .foregroundStyle(.blue)
                                    .clipShape(Capsule())
                            }
                        }
                    }
                }
                .padding(.vertical, 4)
            } header: {
                Label("Summary", systemImage: "list.bullet.clipboard")
            }
        }
        .formStyle(.grouped)
    }
    
    private var enabledFeaturesList: [String] {
        var features: [String] = []
        if enableCortexMemory { features.append("Cortex Memory") }
        if enableEgoSystem { features.append("Ego System") }
        if enableComplianceExport { features.append("Compliance Export") }
        if enableTimeMachine { features.append("Time Machine") }
        if enableCollaboration { features.append("Collaboration") }
        if enableCurator { features.append("Curator") }
        if enableSelfHostedModels { features.append("Self-Hosted Models") }
        if enableMultiRegion { features.append("Multi-Region") }
        return features
    }
}

// MARK: - Feature Toggle Row

struct FeatureToggleRow: View {
    let title: String
    let description: String
    let icon: String
    let iconColor: Color
    @Binding var isOn: Bool
    var tierRequirement: String? = nil
    
    var body: some View {
        Toggle(isOn: $isOn) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundStyle(iconColor)
                    .frame(width: 32)
                
                VStack(alignment: .leading, spacing: 2) {
                    HStack {
                        Text(title)
                            .font(.subheadline.bold())
                        
                        if let tier = tierRequirement {
                            Text(tier)
                                .font(.caption2)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(.orange.opacity(0.2))
                                .foregroundStyle(.orange)
                                .clipShape(Capsule())
                        }
                    }
                    
                    Text(description)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .toggleStyle(.switch)
    }
}

// MARK: - Flow Layout

struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = FlowResult(
            in: proposal.replacingUnspecifiedDimensions().width,
            subviews: subviews,
            spacing: spacing
        )
        return result.size
    }
    
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = FlowResult(
            in: bounds.width,
            subviews: subviews,
            spacing: spacing
        )
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
            var maxHeight: CGFloat = 0
            
            for subview in subviews {
                let size = subview.sizeThatFits(.unspecified)
                
                if x + size.width > maxWidth && x > 0 {
                    x = 0
                    y += maxHeight + spacing
                    maxHeight = 0
                }
                
                positions.append(CGPoint(x: x, y: y))
                maxHeight = max(maxHeight, size.height)
                x += size.width + spacing
                
                self.size.width = max(self.size.width, x)
            }
            
            self.size.height = y + maxHeight
        }
    }
}

// MARK: - Preview

#Preview {
    FeatureFlagsSettingsView()
        .frame(width: 600, height: 700)
}
