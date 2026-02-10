// RADIANT v4.18.0 - Security Testing Header View
// Top bar with title, status, and action buttons

import SwiftUI

struct SecurityTestingHeaderView: View {
    @ObservedObject var orchestrator: SecurityTestOrchestrator
    @Binding var showingSettings: Bool
    @Binding var showingConfirmBattery: Bool
    @Binding var showingExportMenu: Bool

    private let reportGenerator = SecurityReportGenerator()

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "shield.checkered")
                .font(.system(size: 24))
                .foregroundColor(.blue)

            VStack(alignment: .leading, spacing: 2) {
                Text("Endpoint Security Testing")
                    .font(.headline)
                Text(orchestrator.statusMessage)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            if let lastRun = orchestrator.lastBatteryRunDate {
                VStack(alignment: .trailing, spacing: 1) {
                    Text("Last Battery")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    Text(lastRun, style: .relative)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }

            scoreBadge

            Divider()
                .frame(height: 24)

            if orchestrator.isRunning {
                Button(action: { orchestrator.cancelExecution() }) {
                    Label("Cancel", systemImage: "stop.fill")
                }
                .buttonStyle(.bordered)
                .tint(.red)
            } else {
                Button(action: { showingConfirmBattery = true }) {
                    Label("Run Full Battery", systemImage: "play.fill")
                }
                .buttonStyle(.borderedProminent)

                Menu {
                    Button(action: { exportFullReport() }) {
                        Label("Export Full Report (PDF)", systemImage: "doc.richtext")
                    }
                    Divider()
                    Button(action: { orchestrator.resetAllResults() }) {
                        Label("Reset All Results", systemImage: "arrow.counterclockwise")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }

                Button(action: { showingSettings = true }) {
                    Image(systemName: "gearshape")
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color(nsColor: .windowBackgroundColor))
    }

    private var scoreBadge: some View {
        let suite = orchestrator.testSuite
        let completed = suite.totalTests - suite.notRunTests
        let passed = suite.passedTests
        let rate = completed > 0 ? Double(passed) / Double(completed) : 0
        let color: Color = rate >= 0.9 ? .green : (rate >= 0.7 ? .orange : .red)

        return VStack(spacing: 2) {
            if completed > 0 {
                Text("\(Int(rate * 100))%")
                    .font(.system(size: 18, weight: .bold, design: .rounded))
                    .foregroundColor(color)
                Text("\(passed)/\(completed)")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            } else {
                Text("—")
                    .font(.system(size: 18, weight: .bold, design: .rounded))
                    .foregroundColor(.secondary)
                Text("No results")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .frame(width: 60)
    }

    private func exportFullReport() {
        let generator = SecurityReportGenerator()
        if let url = generator.savePDF(scope: .fullBattery(orchestrator.testSuite), settings: orchestrator.settings) {
            NSWorkspace.shared.activateFileViewerSelecting([url])
        }
    }
}
