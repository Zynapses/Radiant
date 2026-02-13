import SwiftUI

struct TestResultsView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedRun: TestRun?
    @State private var selectedResult: TestCaseResult?

    var body: some View {
        HSplitView {
            runListPanel
                .frame(minWidth: 280, idealWidth: 320)

            runDetailPanel
                .frame(minWidth: 450)
        }
    }

    // MARK: - Run List

    private var runListPanel: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Test Results")
                    .font(.headline)
                Spacer()
                if !appState.testRuns.isEmpty {
                    Button(action: {
                        appState.testRuns.removeAll()
                        appState.saveAll()
                        selectedRun = nil
                    }) {
                        Image(systemName: "trash")
                    }
                    .help("Clear all results")
                }
            }
            .padding(12)
            .background(Color(nsColor: .windowBackgroundColor))

            Divider()

            if appState.testRuns.isEmpty {
                VStack(spacing: 8) {
                    Spacer()
                    Image(systemName: "chart.bar")
                        .font(.system(size: 36))
                        .foregroundColor(.secondary.opacity(0.4))
                    Text("No test results yet")
                        .foregroundColor(.secondary)
                    Text("Run a test suite to see results here")
                        .font(.caption)
                        .foregroundColor(.secondary.opacity(0.7))
                    Spacer()
                }
            } else {
                List(selection: $selectedRun) {
                    ForEach(appState.testRuns) { run in
                        TestRunRow(run: run)
                            .tag(run)
                    }
                }
                .listStyle(.inset)
            }
        }
    }

    // MARK: - Run Detail

    @ViewBuilder
    private var runDetailPanel: some View {
        if let run = selectedRun {
            VStack(spacing: 0) {
                runDetailHeader(run: run)
                Divider()

                if run.results.isEmpty {
                    VStack {
                        Spacer()
                        if run.status == .running {
                            ProgressView("Running tests...")
                        } else {
                            Text("No results")
                                .foregroundColor(.secondary)
                        }
                        Spacer()
                    }
                } else {
                    HSplitView {
                        resultsList(run: run)
                            .frame(minWidth: 250)

                        resultDetail
                            .frame(minWidth: 300)
                    }
                }
            }
        } else {
            VStack(spacing: 12) {
                Spacer()
                Image(systemName: "chart.bar")
                    .font(.system(size: 48))
                    .foregroundColor(.secondary.opacity(0.3))
                Text("Select a test run")
                    .font(.title3)
                    .foregroundColor(.secondary)
                Spacer()
            }
        }
    }

    private func runDetailHeader(run: TestRun) -> some View {
        HStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 2) {
                Text(run.suiteName)
                    .font(.headline)
                HStack(spacing: 8) {
                    Text(run.model)
                        .font(.caption)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(Color.purple.opacity(0.1)))
                        .foregroundColor(.purple)

                    Text(run.startedAt, style: .relative)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()

            scoreCard(label: "Pass", value: "\(run.passCount)", color: .green)
            scoreCard(label: "Fail", value: "\(run.failCount)", color: .red)
            scoreCard(label: "Rate", value: String(format: "%.0f%%", run.passRate), color: run.passRate >= 80 ? .green : .orange)
            scoreCard(label: "Avg Latency", value: String(format: "%.0fms", run.avgLatencyMs), color: .blue)
        }
        .padding(12)
        .background(Color(nsColor: .windowBackgroundColor))
    }

    private func scoreCard(label: String, value: String, color: Color) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(.title3, design: .rounded))
                .fontWeight(.bold)
                .foregroundColor(color)
            Text(label)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(minWidth: 60)
    }

    private func resultsList(run: TestRun) -> some View {
        List(selection: $selectedResult) {
            ForEach(run.results) { result in
                ResultRow(result: result)
                    .tag(result)
            }
        }
        .listStyle(.inset)
    }

    @ViewBuilder
    private var resultDetail: some View {
        if let result = selectedResult {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    HStack {
                        Image(systemName: result.passed ? "checkmark.circle.fill" : "xmark.circle.fill")
                            .foregroundColor(result.passed ? .green : .red)
                            .font(.title2)
                        Text(result.caseName)
                            .font(.headline)
                    }

                    if let latency = result.latencyMs {
                        HStack(spacing: 16) {
                            Label(String(format: "%.0fms", latency), systemImage: "clock")
                                .font(.caption)
                            if let tokens = result.tokenCount {
                                Label("\(tokens) tokens", systemImage: "number")
                                    .font(.caption)
                            }
                        }
                        .foregroundColor(.secondary)
                    }

                    if !result.failures.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Failures")
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .foregroundColor(.red)

                            ForEach(result.failures, id: \.self) { failure in
                                HStack(alignment: .top, spacing: 6) {
                                    Image(systemName: "xmark.circle")
                                        .foregroundColor(.red)
                                        .font(.caption)
                                    Text(failure)
                                        .font(.caption)
                                }
                            }
                        }
                        .padding(10)
                        .background(RoundedRectangle(cornerRadius: 8).fill(Color.red.opacity(0.05)))
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Model Response")
                            .font(.subheadline)
                            .fontWeight(.semibold)

                        Text(result.response.isEmpty ? "(empty response)" : result.response)
                            .font(.body)
                            .textSelection(.enabled)
                            .padding(10)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(RoundedRectangle(cornerRadius: 8).fill(Color(nsColor: .textBackgroundColor)))
                    }
                }
                .padding(16)
            }
        } else {
            VStack {
                Spacer()
                Text("Select a result to view details")
                    .foregroundColor(.secondary)
                Spacer()
            }
        }
    }
}

// MARK: - Test Run Row

struct TestRunRow: View {
    let run: TestRun

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Image(systemName: run.status.icon)
                    .foregroundColor(statusColor)
                Text(run.suiteName)
                    .font(.body)
                    .fontWeight(.medium)
            }
            HStack {
                Text(run.model)
                    .font(.caption2)
                    .foregroundColor(.purple)
                Spacer()
                Text("\(run.passCount)/\(run.results.count) passed")
                    .font(.caption)
                    .foregroundColor(run.passRate >= 80 ? .green : .orange)
            }
            Text(run.startedAt, style: .relative)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }

    private var statusColor: Color {
        switch run.status {
        case .completed: return run.failCount == 0 ? .green : .orange
        case .running: return .blue
        case .failed: return .red
        case .cancelled: return .gray
        }
    }
}

// MARK: - Result Row

struct ResultRow: View {
    let result: TestCaseResult

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: result.passed ? "checkmark.circle.fill" : "xmark.circle.fill")
                .foregroundColor(result.passed ? .green : .red)
            VStack(alignment: .leading, spacing: 2) {
                Text(result.caseName)
                    .font(.body)
                if let latency = result.latencyMs {
                    Text(String(format: "%.0fms", latency))
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Hashable Conformance

extension TestRun: Hashable {
    static func == (lhs: TestRun, rhs: TestRun) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

extension TestCaseResult: Hashable {
    static func == (lhs: TestCaseResult, rhs: TestCaseResult) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}
