import SwiftUI

/// Real-time deployment progress view per PROMPT-33 spec
/// Enhanced version with granular state tracking, AI explanations, and cancel support
struct EnhancedDeploymentProgressView: View {
    @Binding var state: DeploymentState
    @State private var isCancelling = false
    @State private var showCancelSheet = false
    @State private var elapsedTime: TimeInterval = 0
    @State private var aiExplanation: String?
    
    let onCancel: () -> Void
    let startTime: Date
    
    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    
    var body: some View {
        VStack(spacing: 20) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Deployment Progress")
                        .font(.headline)
                    Text(state.displayName)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                
                Spacer()
                
                // Timer
                VStack(alignment: .trailing, spacing: 2) {
                    Text("Elapsed")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(formatDuration(elapsedTime))
                        .font(.system(.body, design: .monospaced))
                }
            }
            
            // Main Progress
            VStack(spacing: 8) {
                ProgressView(value: state.progress)
                    .progressViewStyle(.linear)
                    .tint(progressColor)
                
                HStack {
                    Text("\(Int(state.progress * 100))%")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    
                    Spacer()
                    
                    if let eta = estimatedTimeRemaining {
                        Text("ETA: \(formatDuration(eta))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            
            Divider()
            
            // Phase List
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    DeploymentPhaseRow(
                        name: "Preparation",
                        icon: "gearshape",
                        status: phaseStatus(for: .preparing(.validatingPackage))
                    )
                    
                    DeploymentPhaseRow(
                        name: "Create Snapshot",
                        icon: "camera",
                        status: phaseStatus(for: .creatingSnapshot(progress: 0))
                    )
                    
                    DeploymentPhaseRow(
                        name: "Enable Maintenance",
                        icon: "wrench.and.screwdriver",
                        status: phaseStatus(for: .enablingMaintenance)
                    )
                    
                    DeploymentPhaseRow(
                        name: "Deploy Infrastructure",
                        icon: "building.2",
                        status: phaseStatus(for: .deployingInfrastructure(progress: 0, message: ""))
                    )
                    
                    DeploymentPhaseRow(
                        name: "Run Migrations",
                        icon: "arrow.triangle.2.circlepath",
                        status: phaseStatus(for: .runningMigrations(current: 0, total: 1, stepName: ""))
                    )
                    
                    DeploymentPhaseRow(
                        name: "Deploy Lambda",
                        icon: "function",
                        status: phaseStatus(for: .deployingLambda(progress: 0))
                    )
                    
                    DeploymentPhaseRow(
                        name: "Deploy Dashboard",
                        icon: "rectangle.3.group",
                        status: phaseStatus(for: .deployingDashboard(progress: 0))
                    )
                    
                    DeploymentPhaseRow(
                        name: "Health Checks",
                        icon: "heart.text.square",
                        status: phaseStatus(for: .runningHealthChecks(results: []))
                    )
                    
                    DeploymentPhaseRow(
                        name: "Verification",
                        icon: "checkmark.shield",
                        status: phaseStatus(for: .verifying)
                    )
                }
                .padding(.horizontal)
            }
            
            // AI Explanation Card
            if let explanation = aiExplanation {
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: "sparkles")
                        .font(.title3)
                        .foregroundStyle(.purple)
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text("AI Assistant")
                            .font(.caption)
                            .fontWeight(.medium)
                            .foregroundStyle(.purple)
                        Text(explanation)
                            .font(.callout)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding()
                .background(Color.purple.opacity(0.1))
                .cornerRadius(8)
            }
            
            Spacer()
            
            // Cancel Button
            if state.canCancel {
                Button(action: {
                    guard !isCancelling else { return }
                    showCancelSheet = true
                }) {
                    HStack {
                        Image(systemName: "stop.circle")
                        Text("Cancel Deployment")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .tint(.red)
                .disabled(isCancelling)
            }
        }
        .padding()
        .onReceive(timer) { _ in
            elapsedTime = Date().timeIntervalSince(startTime)
        }
        .sheet(isPresented: $showCancelSheet) {
            CancelDeploymentSheet(
                currentPhase: state.displayName,
                onConfirm: {
                    isCancelling = true
                    showCancelSheet = false
                    onCancel()
                },
                onDismiss: {
                    showCancelSheet = false
                }
            )
        }
        .task {
            await loadAIExplanation()
        }
        .onChange(of: state.displayName) { _ in
            Task {
                await loadAIExplanation()
            }
        }
    }
    
    private var progressColor: Color {
        switch state {
        case .failed, .rollbackFailed:
            return .red
        case .cancelling, .rollingBack:
            return .orange
        case .complete, .rolledBack:
            return .green
        default:
            return .blue
        }
    }
    
    private var estimatedTimeRemaining: TimeInterval? {
        guard state.progress > 0.1 else { return nil }
        let rate = elapsedTime / state.progress
        let remaining = rate * (1.0 - state.progress)
        return remaining
    }
    
    private func formatDuration(_ interval: TimeInterval) -> String {
        let minutes = Int(interval) / 60
        let seconds = Int(interval) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
    
    private func phaseStatus(for targetState: DeploymentState) -> PhaseStatus {
        let currentOrder = stateOrder(state)
        let targetOrder = stateOrder(targetState)
        
        if currentOrder > targetOrder {
            return .completed
        } else if currentOrder == targetOrder {
            return .inProgress
        } else {
            return .pending
        }
    }
    
    private func stateOrder(_ state: DeploymentState) -> Int {
        switch state {
        case .idle: return 0
        case .preparing: return 1
        case .creatingSnapshot: return 2
        case .enablingMaintenance: return 3
        case .deployingInfrastructure: return 4
        case .runningMigrations: return 5
        case .deployingLambda: return 6
        case .deployingDashboard: return 7
        case .runningHealthChecks: return 8
        case .disablingMaintenance: return 9
        case .verifying: return 10
        case .complete: return 11
        case .failed, .cancelling, .rollingBack, .rolledBack, .rollbackFailed: return -1
        }
    }
    
    private func loadAIExplanation() async {
        let ai = AIAssistantService.shared
        do {
            aiExplanation = try await ai.explain(
                context: "RADIANT deployment in progress",
                event: state.displayName
            )
        } catch {
            aiExplanation = ai.fallbackExplanation(for: state.displayName)
        }
    }
}

// MARK: - Phase Row

enum PhaseStatus {
    case pending
    case inProgress
    case completed
    case failed
}

struct DeploymentPhaseRow: View {
    let name: String
    let icon: String
    let status: PhaseStatus
    
    var body: some View {
        HStack(spacing: 12) {
            // Status indicator
            ZStack {
                Circle()
                    .fill(statusColor.opacity(0.2))
                    .frame(width: 32, height: 32)
                
                if status == .inProgress {
                    ProgressView()
                        .scaleEffect(0.6)
                } else {
                    Image(systemName: statusIcon)
                        .font(.system(size: 14))
                        .foregroundStyle(statusColor)
                }
            }
            
            // Phase info
            VStack(alignment: .leading, spacing: 2) {
                Text(name)
                    .font(.subheadline)
                    .foregroundStyle(status == .pending ? .secondary : .primary)
                
                if status == .inProgress {
                    Text("In progress...")
                        .font(.caption)
                        .foregroundStyle(.blue)
                }
            }
            
            Spacer()
            
            // Checkmark for completed
            if status == .completed {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(.green)
            }
        }
    }
    
    private var statusColor: Color {
        switch status {
        case .pending: return .gray
        case .inProgress: return .blue
        case .completed: return .green
        case .failed: return .red
        }
    }
    
    private var statusIcon: String {
        switch status {
        case .pending: return icon
        case .inProgress: return icon
        case .completed: return "checkmark"
        case .failed: return "xmark"
        }
    }
}

#Preview {
    EnhancedDeploymentProgressView(
        state: .constant(.deployingInfrastructure(progress: 0.5, message: "Deploying FoundationStack")),
        onCancel: {},
        startTime: Date().addingTimeInterval(-120)
    )
}
