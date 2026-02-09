import SwiftUI

struct BrainPlanViewer: View {
    let conversationId: String
    @State private var brainPlan: BrainPlan?
    @State private var governorStatus: GovernorStatus?
    @State private var isLoading = true
    @Environment(\.dismiss) var dismiss

    private let brainPlanService = BrainPlanService()

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Image(systemName: "brain.head.profile")
                    .font(.system(size: 16))
                    .foregroundStyle(.purple)
                Text("Brain Plan")
                    .font(.system(size: 16, weight: .bold))
                Spacer()
                Button("Done") { dismiss() }
            }
            .padding()

            Divider().opacity(0.3)

            if isLoading {
                ProgressView("Loading brain plan...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let plan = brainPlan {
                ScrollView {
                    VStack(spacing: 16) {
                        // Overview
                        overviewCard(plan)

                        // Steps
                        stepsCard(plan)

                        // Governor
                        if let governor = governorStatus {
                            governorCard(governor)
                        }
                    }
                    .padding()
                }
            } else {
                EmptyStateView(
                    icon: "brain",
                    title: "No brain plan available",
                    message: "Brain plans are generated when the AI processes your messages in Advanced Mode."
                )
            }
        }
        .task {
            isLoading = true
            do {
                governorStatus = try await brainPlanService.getGovernorStatus()
            } catch {
                // Graceful fallback
            }
            isLoading = false
        }
    }

    private func overviewCard(_ plan: BrainPlan) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Orchestration")
                    .font(.system(size: 13, weight: .semibold))
                Spacer()
                BadgeView(text: plan.mode.displayName, color: .purple)
                BadgeView(text: plan.status.rawValue.capitalized, color: colorForStatus(plan.status), size: .small)
            }

            Divider().opacity(0.2)

            // Domain
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Domain")
                        .font(.system(size: 10))
                        .foregroundStyle(.tertiary)
                    Text(plan.domain.domain)
                        .font(.system(size: 12, weight: .medium))
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text("Confidence")
                        .font(.system(size: 10))
                        .foregroundStyle(.tertiary)
                    Text("\(Int(plan.domain.confidence * 100))%")
                        .font(.system(size: 12, weight: .medium))
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text("Model")
                        .font(.system(size: 10))
                        .foregroundStyle(.tertiary)
                    Text(plan.selectedModel)
                        .font(.system(size: 12, weight: .medium))
                }

                Spacer()
            }

            // Reason
            Text(plan.modelReason)
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
                .padding(8)
                .background(Color.white.opacity(0.03))
                .clipShape(RoundedRectangle(cornerRadius: 6))

            // Estimates
            HStack(spacing: 16) {
                HStack(spacing: 4) {
                    Image(systemName: "clock")
                        .font(.system(size: 10))
                        .foregroundStyle(.tertiary)
                    Text("~\(plan.estimatedTimeMs)ms")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                }

                HStack(spacing: 4) {
                    Image(systemName: "dollarsign.circle")
                        .font(.system(size: 10))
                        .foregroundStyle(.tertiary)
                    Text("~$\(plan.estimatedCost, specifier: "%.4f")")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(14)
        .glassCard(cornerRadius: 12)
    }

    private func stepsCard(_ plan: BrainPlan) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Execution Steps")
                .font(.system(size: 13, weight: .semibold))

            ForEach(Array(plan.steps.enumerated()), id: \.element.id) { index, step in
                HStack(spacing: 10) {
                    // Status indicator
                    ZStack {
                        Circle()
                            .fill(colorForStatus(step.status).opacity(0.2))
                            .frame(width: 24, height: 24)

                        if step.status == .completed {
                            Image(systemName: "checkmark")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(.green)
                        } else if step.status == .running || step.status == .executing {
                            ProgressView()
                                .controlSize(.mini)
                        } else if step.status == .failed {
                            Image(systemName: "xmark")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(.red)
                        } else {
                            Text("\(index + 1)")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundStyle(.tertiary)
                        }
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text(step.type.rawValue.replacingOccurrences(of: "_", with: " ").capitalized)
                            .font(.system(size: 12, weight: .medium))

                        Text(step.description)
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    }

                    Spacer()

                    if let completed = step.completedAt, let started = step.startedAt {
                        let duration = completed.timeIntervalSince(started) * 1000
                        Text("\(Int(duration))ms")
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundStyle(.tertiary)
                    }
                }
                .padding(.vertical, 4)

                if index < plan.steps.count - 1 {
                    Rectangle()
                        .fill(Color.white.opacity(0.06))
                        .frame(width: 2, height: 12)
                        .padding(.leading, 11)
                }
            }
        }
        .padding(14)
        .glassCard(cornerRadius: 12)
    }

    private func governorCard(_ governor: GovernorStatus) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "gauge.with.dots.needle.50percent")
                    .foregroundStyle(.orange)
                Text("Spend Governor")
                    .font(.system(size: 13, weight: .semibold))
                Spacer()
                BadgeView(text: governor.mode.rawValue.replacingOccurrences(of: "_", with: " ").capitalized, color: .orange, size: .small)
            }

            HStack(spacing: 16) {
                VStack(alignment: .leading) {
                    Text("Total Savings")
                        .font(.system(size: 10))
                        .foregroundStyle(.tertiary)
                    Text("$\(governor.totalSavings, specifier: "%.2f")")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.green)
                }

                VStack(alignment: .leading) {
                    Text("Decisions Today")
                        .font(.system(size: 10))
                        .foregroundStyle(.tertiary)
                    Text("\(governor.decisionsToday)")
                        .font(.system(size: 14, weight: .bold))
                }
            }

            if let decision = governor.lastDecision {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Last Decision")
                        .font(.system(size: 10))
                        .foregroundStyle(.tertiary)
                    Text("\(decision.model) (\(decision.tier))")
                        .font(.system(size: 11, design: .monospaced))
                    Text(decision.reason)
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                }
                .padding(8)
                .background(Color.white.opacity(0.03))
                .clipShape(RoundedRectangle(cornerRadius: 6))
            }
        }
        .padding(14)
        .glassCard(cornerRadius: 12)
    }

    private func colorForStatus(_ status: PlanStatus) -> Color {
        switch status {
        case .completed: return .green
        case .running, .executing: return .blue
        case .pending: return .gray
        case .failed: return .red
        }
    }
}
