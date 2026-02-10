// RADIANT v4.18.0 - Battery Progress View
// Live progress indicator during test execution

import SwiftUI

struct BatteryProgressView: View {
    @ObservedObject var orchestrator: SecurityTestOrchestrator

    var body: some View {
        VStack(spacing: 6) {
            HStack {
                if let currentId = orchestrator.currentTestId {
                    Image(systemName: "arrow.triangle.2.circlepath")
                        .foregroundColor(.blue)
                        .rotationEffect(.degrees(orchestrator.isRunning ? 360 : 0))
                        .animation(.linear(duration: 1).repeatForever(autoreverses: false), value: orchestrator.isRunning)
                    Text("Running: \(currentId)")
                        .font(.caption)
                        .fontWeight(.medium)
                } else {
                    Text("Preparing...")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                if let eta = orchestrator.estimatedTimeRemaining {
                    Text("ETA: \(formatDuration(eta))")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Text("\(Int(orchestrator.overallProgress * 100))%")
                    .font(.caption)
                    .fontWeight(.bold)
                    .foregroundColor(.blue)
            }

            ProgressView(value: orchestrator.overallProgress)
                .progressViewStyle(.linear)
                .tint(.blue)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color.blue.opacity(0.05))
    }

    private func formatDuration(_ seconds: TimeInterval) -> String {
        let mins = Int(seconds) / 60
        let secs = Int(seconds) % 60
        if mins > 0 {
            return "\(mins)m \(secs)s"
        }
        return "\(secs)s"
    }
}
