import SwiftUI

struct TestSuiteListView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedSuite: TestSuite?
    @State private var showingNewSuite: Bool = false
    @State private var showingNewCase: Bool = false
    @State private var runningAlert: Bool = false

    var body: some View {
        HSplitView {
            suiteListPanel
                .frame(minWidth: 280, idealWidth: 320)

            suiteDetailPanel
                .frame(minWidth: 400)
        }
    }

    // MARK: - Suite List

    private var suiteListPanel: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Test Suites")
                    .font(.headline)
                Spacer()
                Button(action: { showingNewSuite = true }) {
                    Image(systemName: "plus")
                }
                .help("Create new test suite")
            }
            .padding(12)
            .background(Color(nsColor: .windowBackgroundColor))

            Divider()

            if appState.testSuites.isEmpty {
                VStack(spacing: 8) {
                    Spacer()
                    Image(systemName: "checklist")
                        .font(.system(size: 36))
                        .foregroundColor(.secondary.opacity(0.4))
                    Text("No test suites")
                        .foregroundColor(.secondary)
                    Spacer()
                }
            } else {
                List(selection: $selectedSuite) {
                    ForEach(appState.testSuites) { suite in
                        SuiteRow(suite: suite)
                            .tag(suite)
                            .contextMenu {
                                Button("Delete", role: .destructive) {
                                    appState.testSuites.removeAll { $0.id == suite.id }
                                    appState.saveAll()
                                }
                            }
                    }
                }
                .listStyle(.inset)
            }
        }
        .sheet(isPresented: $showingNewSuite) {
            NewTestSuiteSheet { name, description in
                let suite = TestSuite(name: name, description: description)
                appState.testSuites.append(suite)
                selectedSuite = suite
                appState.saveAll()
            }
        }
    }

    // MARK: - Suite Detail

    @ViewBuilder
    private var suiteDetailPanel: some View {
        if let suite = selectedSuite, let index = appState.testSuites.firstIndex(where: { $0.id == suite.id }) {
            VStack(spacing: 0) {
                suiteDetailHeader(suite: appState.testSuites[index])
                Divider()

                if appState.testSuites[index].cases.isEmpty {
                    VStack(spacing: 8) {
                        Spacer()
                        Text("No test cases yet")
                            .foregroundColor(.secondary)
                        Button("Add Test Case") { showingNewCase = true }
                            .buttonStyle(.bordered)
                        Spacer()
                    }
                } else {
                    List {
                        ForEach(appState.testSuites[index].cases) { testCase in
                            TestCaseRow(testCase: testCase)
                                .contextMenu {
                                    Button("Delete", role: .destructive) {
                                        appState.testSuites[index].cases.removeAll { $0.id == testCase.id }
                                        appState.saveAll()
                                    }
                                }
                        }
                    }
                    .listStyle(.inset)
                }
            }
            .sheet(isPresented: $showingNewCase) {
                NewTestCaseSheet { testCase in
                    appState.testSuites[index].cases.append(testCase)
                    appState.saveAll()
                }
            }
        } else {
            VStack(spacing: 12) {
                Spacer()
                Image(systemName: "checklist")
                    .font(.system(size: 48))
                    .foregroundColor(.secondary.opacity(0.3))
                Text("Select a test suite")
                    .font(.title3)
                    .foregroundColor(.secondary)
                Spacer()
            }
        }
    }

    private func suiteDetailHeader(suite: TestSuite) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(suite.name)
                    .font(.headline)
                Text(suite.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                Text("\(suite.caseCount) test cases")
                    .font(.caption2)
                    .foregroundColor(.secondary.opacity(0.7))
            }

            Spacer()

            Button(action: { showingNewCase = true }) {
                Label("Add Case", systemImage: "plus")
            }
            .buttonStyle(.bordered)
            .controlSize(.small)

            Button(action: { runSuite(suite) }) {
                Label("Run Suite", systemImage: "play.fill")
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.small)
            .disabled(!appState.inferenceService.connectionStatus.isConnected || suite.cases.isEmpty)
        }
        .padding(12)
        .background(Color(nsColor: .windowBackgroundColor))
        .alert("Cannot Run", isPresented: $runningAlert) {
            Button("OK") {}
        } message: {
            Text("Connect to Ollama first (check Settings).")
        }
    }

    private func runSuite(_ suite: TestSuite) {
        guard appState.inferenceService.connectionStatus.isConnected else {
            runningAlert = true
            return
        }

        let model = appState.inferenceService.config.selectedModel
        Task {
            let run = await appState.testRunner.runSuite(suite, model: model)
            appState.testRuns.insert(run, at: 0)
            appState.saveAll()
            appState.selectedTab = .testResults
        }
    }
}

// MARK: - Suite Row

struct SuiteRow: View {
    let suite: TestSuite

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(suite.name)
                .font(.body)
                .fontWeight(.medium)
            HStack {
                Text(suite.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
                Spacer()
                Text("\(suite.caseCount)")
                    .font(.caption)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Capsule().fill(Color.orange.opacity(0.15)))
                    .foregroundColor(.orange)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Test Case Row

struct TestCaseRow: View {
    let testCase: TestCase

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                severityBadge
                Text(testCase.name)
                    .font(.body)
                    .fontWeight(.medium)
                Spacer()
                Text(testCase.category.rawValue)
                    .font(.caption2)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Capsule().fill(Color.blue.opacity(0.1)))
                    .foregroundColor(.blue)
            }

            Text(testCase.prompt)
                .font(.caption)
                .foregroundColor(.secondary)
                .lineLimit(2)

            HStack(spacing: 12) {
                if !testCase.expectedBehavior.mustContain.isEmpty {
                    Label("\(testCase.expectedBehavior.mustContain.count) must-contain", systemImage: "checkmark.circle")
                        .font(.caption2)
                        .foregroundColor(.green)
                }
                if !testCase.expectedBehavior.mustNotContain.isEmpty {
                    Label("\(testCase.expectedBehavior.mustNotContain.count) must-not-contain", systemImage: "xmark.circle")
                        .font(.caption2)
                        .foregroundColor(.red)
                }
            }
        }
        .padding(.vertical, 4)
    }

    private var severityBadge: some View {
        Circle()
            .fill(severityColor)
            .frame(width: 8, height: 8)
    }

    private var severityColor: Color {
        switch testCase.severity {
        case .critical: return .red
        case .high: return .orange
        case .medium: return .yellow
        case .low: return .green
        }
    }
}

// MARK: - New Test Suite Sheet

struct NewTestSuiteSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var name: String = ""
    @State private var description: String = ""
    let onSave: (String, String) -> Void

    var body: some View {
        VStack(spacing: 16) {
            Text("New Test Suite")
                .font(.headline)

            TextField("Suite name", text: $name)
                .textFieldStyle(.roundedBorder)

            TextField("Description", text: $description, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .lineLimit(2...4)

            HStack {
                Button("Cancel") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Spacer()
                Button("Create") {
                    onSave(name, description)
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .padding(20)
        .frame(width: 400)
    }
}

// MARK: - New Test Case Sheet

struct NewTestCaseSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var name: String = ""
    @State private var prompt: String = ""
    @State private var systemPrompt: String = ""
    @State private var mustContainText: String = ""
    @State private var mustNotContainText: String = ""
    @State private var category: TestCategory = .functional
    @State private var severity: TestSeverity = .medium
    let onSave: (TestCase) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("New Test Case")
                    .font(.headline)

                Group {
                    Text("Name").font(.caption).foregroundColor(.secondary)
                    TextField("Test case name", text: $name)
                        .textFieldStyle(.roundedBorder)
                }

                Group {
                    Text("Prompt").font(.caption).foregroundColor(.secondary)
                    TextEditor(text: $prompt)
                        .font(.body)
                        .frame(minHeight: 60, maxHeight: 120)
                        .border(Color.secondary.opacity(0.2))
                }

                Group {
                    Text("System Prompt (optional)").font(.caption).foregroundColor(.secondary)
                    TextField("Optional system prompt override", text: $systemPrompt)
                        .textFieldStyle(.roundedBorder)
                }

                HStack {
                    VStack(alignment: .leading) {
                        Text("Category").font(.caption).foregroundColor(.secondary)
                        Picker("", selection: $category) {
                            ForEach(TestCategory.allCases, id: \.self) { cat in
                                Text(cat.rawValue).tag(cat)
                            }
                        }
                        .labelsHidden()
                    }

                    VStack(alignment: .leading) {
                        Text("Severity").font(.caption).foregroundColor(.secondary)
                        Picker("", selection: $severity) {
                            ForEach(TestSeverity.allCases, id: \.self) { sev in
                                Text(sev.rawValue).tag(sev)
                            }
                        }
                        .labelsHidden()
                    }
                }

                Group {
                    Text("Must Contain (comma-separated)").font(.caption).foregroundColor(.secondary)
                    TextField("e.g. Paris, capital", text: $mustContainText)
                        .textFieldStyle(.roundedBorder)
                }

                Group {
                    Text("Must NOT Contain (comma-separated)").font(.caption).foregroundColor(.secondary)
                    TextField("e.g. step 1, here's how", text: $mustNotContainText)
                        .textFieldStyle(.roundedBorder)
                }

                HStack {
                    Button("Cancel") { dismiss() }
                        .keyboardShortcut(.cancelAction)
                    Spacer()
                    Button("Add Test Case") {
                        let tc = TestCase(
                            name: name,
                            prompt: prompt,
                            systemPrompt: systemPrompt.isEmpty ? nil : systemPrompt,
                            expectedBehavior: ExpectedBehavior(
                                mustContain: parseCommaList(mustContainText),
                                mustNotContain: parseCommaList(mustNotContainText)
                            ),
                            category: category,
                            severity: severity
                        )
                        onSave(tc)
                        dismiss()
                    }
                    .keyboardShortcut(.defaultAction)
                    .disabled(name.isEmpty || prompt.isEmpty)
                }
            }
            .padding(20)
        }
        .frame(width: 500, height: 550)
    }

    private func parseCommaList(_ text: String) -> [String] {
        text.split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
    }
}

// MARK: - Hashable Conformance for Selection

extension TestSuite: Hashable {
    static func == (lhs: TestSuite, rhs: TestSuite) -> Bool {
        lhs.id == rhs.id
    }
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}
