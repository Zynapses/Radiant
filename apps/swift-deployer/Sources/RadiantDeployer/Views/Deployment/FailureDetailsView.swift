import SwiftUI

/// Failure details view with AI error translation per PROMPT-33 spec
struct FailureDetailsView: View {
    let failure: DeploymentFailure
    let snapshotAvailable: Bool
    let onRollback: () -> Void
    let onRetry: () -> Void
    let onDismiss: () -> Void
    
    @State private var aiTranslation: AIAssistantService.ErrorTranslation?
    @State private var aiRecommendation: AIAssistantService.RecoveryRecommendation?
    @State private var isLoadingAI = true
    @State private var showTechnicalDetails = false
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Image(systemName: "xmark.circle.fill")
                    .font(.title2)
                    .foregroundStyle(.red)
                
                Text("Deployment Failed")
                    .font(.headline)
                
                Spacer()
                
                Button {
                    onDismiss()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
            .padding()
            
            Divider()
            
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Error Summary
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Failed Phase")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        
                        Text(failure.phase)
                            .font(.headline)
                        
                        Text(failure.timestamp.formatted(date: .abbreviated, time: .standard))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    
                    // AI Translated Error
                    if isLoadingAI {
                        HStack {
                            ProgressView()
                                .scaleEffect(0.8)
                            Text("Getting AI analysis...")
                                .font(.callout)
                                .foregroundStyle(.secondary)
                        }
                        .padding()
                        .frame(maxWidth: .infinity)
                        .background(Color.purple.opacity(0.1))
                        .cornerRadius(8)
                    } else if let translation = aiTranslation {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Image(systemName: "sparkles")
                                    .foregroundStyle(.purple)
                                Text("AI Analysis")
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                                
                                Spacer()
                                
                                Badge(text: translation.severity.capitalized, color: severityColor(translation.severity))
                            }
                            
                            Text(translation.userFriendlyMessage)
                                .font(.body)
                            
                            Divider()
                            
                            Text("Suggested Action")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            
                            Text(translation.suggestedAction)
                                .font(.callout)
                                .foregroundStyle(.blue)
                        }
                        .padding()
                        .background(Color.purple.opacity(0.1))
                        .cornerRadius(8)
                    }
                    
                    // AI Recovery Recommendation
                    if let recommendation = aiRecommendation {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Image(systemName: "lightbulb.fill")
                                    .foregroundStyle(.yellow)
                                Text("Recovery Recommendation")
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                                
                                Spacer()
                                
                                Text("\(Int(recommendation.confidence * 100))% confidence")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            
                            HStack(spacing: 8) {
                                Image(systemName: recommendationIcon(recommendation.action))
                                    .foregroundStyle(recommendationColor(recommendation.action))
                                Text(recommendation.action.capitalized)
                                    .font(.headline)
                                    .foregroundStyle(recommendationColor(recommendation.action))
                            }
                            
                            Text(recommendation.reason)
                                .font(.callout)
                                .foregroundStyle(.secondary)
                            
                            if !recommendation.steps.isEmpty {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Steps:")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                    
                                    ForEach(Array(recommendation.steps.enumerated()), id: \.offset) { index, step in
                                        HStack(alignment: .top, spacing: 8) {
                                            Text("\(index + 1).")
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                            Text(step)
                                                .font(.caption)
                                        }
                                    }
                                }
                            }
                            
                            if !recommendation.alternativeActions.isEmpty {
                                Text("Alternatives: \(recommendation.alternativeActions.joined(separator: ", "))")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding()
                        .background(Color.yellow.opacity(0.1))
                        .cornerRadius(8)
                    }
                    
                    // Technical Details (collapsible)
                    DisclosureGroup("Technical Details", isExpanded: $showTechnicalDetails) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Error Message:")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            
                            Text(failure.error)
                                .font(.system(.caption, design: .monospaced))
                                .padding(8)
                                .background(Color.gray.opacity(0.1))
                                .cornerRadius(4)
                            
                            if let details = failure.technicalDetails {
                                Text("Stack Trace:")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                
                                ScrollView(.horizontal) {
                                    Text(details)
                                        .font(.system(.caption2, design: .monospaced))
                                        .padding(8)
                                        .background(Color.gray.opacity(0.1))
                                        .cornerRadius(4)
                                }
                            }
                        }
                        .padding(.top, 8)
                    }
                    .font(.subheadline)
                }
                .padding()
            }
            
            Divider()
            
            // Actions
            HStack {
                if failure.isRetryable {
                    Button {
                        onRetry()
                    } label: {
                        HStack {
                            Image(systemName: "arrow.clockwise")
                            Text("Retry")
                        }
                    }
                    .buttonStyle(.bordered)
                }
                
                Spacer()
                
                if snapshotAvailable {
                    Button {
                        onRollback()
                    } label: {
                        HStack {
                            Image(systemName: "arrow.uturn.backward")
                            Text("Rollback to Snapshot")
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.orange)
                }
                
                Button("Close") {
                    onDismiss()
                }
                .buttonStyle(.bordered)
            }
            .padding()
        }
        .frame(width: 500, height: 600)
        .task {
            await loadAIAnalysis()
        }
    }
    
    private func loadAIAnalysis() async {
        isLoadingAI = true
        let ai = AIAssistantService.shared
        
        // Load error translation
        do {
            let error = NSError(domain: "Deployment", code: -1, userInfo: [NSLocalizedDescriptionKey: failure.error])
            aiTranslation = try await ai.translateError(error: error, context: "Deployment failed at \(failure.phase)")
        } catch {
            aiTranslation = await ai.fallbackErrorTranslation(error: NSError(domain: "", code: 0, userInfo: [NSLocalizedDescriptionKey: failure.error]))
        }
        
        // Load recovery recommendation
        do {
            aiRecommendation = try await ai.recommendRecovery(failure: failure.error, snapshotAvailable: snapshotAvailable)
        } catch {
            aiRecommendation = await ai.fallbackRecoveryRecommendation(snapshotAvailable: snapshotAvailable)
        }
        
        isLoadingAI = false
    }
    
    private func severityColor(_ severity: String) -> Color {
        switch severity.lowercased() {
        case "critical": return .red
        case "high": return .orange
        case "medium": return .yellow
        case "low": return .blue
        default: return .gray
        }
    }
    
    private func recommendationIcon(_ action: String) -> String {
        switch action.lowercased() {
        case "rollback": return "arrow.uturn.backward.circle.fill"
        case "retry": return "arrow.clockwise.circle.fill"
        default: return "wrench.and.screwdriver.fill"
        }
    }
    
    private func recommendationColor(_ action: String) -> Color {
        switch action.lowercased() {
        case "rollback": return .orange
        case "retry": return .blue
        default: return .purple
        }
    }
}

struct Badge: View {
    let text: String
    let color: Color
    
    var body: some View {
        Text(text)
            .font(.caption2)
            .fontWeight(.medium)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color.opacity(0.2))
            .foregroundStyle(color)
            .cornerRadius(4)
    }
}

#Preview {
    FailureDetailsView(
        failure: DeploymentFailure(
            phase: "Running Migrations",
            error: NSError(domain: "Migration", code: 500, userInfo: [NSLocalizedDescriptionKey: "Lock acquisition timeout"]),
            isRetryable: true
        ),
        snapshotAvailable: true,
        onRollback: {},
        onRetry: {},
        onDismiss: {}
    )
}
