// RADIANT v4.18.0 - Endpoint Security Testing View
// Main SwiftUI view for the security testing module

import SwiftUI

struct EndpointSecurityTestingView: View {
    @StateObject private var orchestrator = SecurityTestOrchestrator()
    @State private var selectedProtocolFilter: TestProtocol?
    @State private var selectedTest: SecurityTest?
    @State private var showingSettings = false
    @State private var showingConfirmBattery = false
    @State private var showingExportMenu = false
    @State private var expandedGroups: Set<String> = []
    @State private var searchText = ""

    var body: some View {
        VStack(spacing: 0) {
            SecurityTestingHeaderView(
                orchestrator: orchestrator,
                showingSettings: $showingSettings,
                showingConfirmBattery: $showingConfirmBattery,
                showingExportMenu: $showingExportMenu
            )

            Divider()

            ProtocolFilterBar(
                selectedProtocol: $selectedProtocolFilter,
                suite: orchestrator.testSuite
            )

            Divider()

            if orchestrator.isRunning {
                BatteryProgressView(orchestrator: orchestrator)
                Divider()
            }

            HSplitView {
                testListPanel
                    .frame(minWidth: 400, idealWidth: 500)

                testDetailPanel
                    .frame(minWidth: 350, idealWidth: 450)
            }
        }
        .sheet(isPresented: $showingSettings) {
            SecurityTestSettingsSheet(settings: $orchestrator.settings)
        }
        .alert("Run Full Security Battery?", isPresented: $showingConfirmBattery) {
            Button("Cancel", role: .cancel) {}
            Button("Run All \(orchestrator.testSuite.totalTests) Tests") {
                Task { await orchestrator.runFullBattery() }
            }
        } message: {
            Text("This will run all \(orchestrator.testSuite.totalTests) security tests sequentially against your configured endpoints. Estimated time: \(estimatedBatteryTime). Tests are non-destructive but will generate network traffic.")
        }
    }

    // MARK: - Test List Panel

    private var testListPanel: some View {
        VStack(spacing: 0) {
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.secondary)
                TextField("Search tests...", text: $searchText)
                    .textFieldStyle(.plain)
                if !searchText.isEmpty {
                    Button(action: { searchText = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(8)
            .background(Color(nsColor: .controlBackgroundColor))

            Divider()

            ScrollView {
                LazyVStack(spacing: 8, pinnedViews: []) {
                    ForEach(filteredGroups) { group in
                        SOPGroupCard(
                            group: group,
                            isExpanded: expandedGroups.contains(group.id),
                            selectedTestId: selectedTest?.id,
                            isRunning: orchestrator.isRunning,
                            currentTestId: orchestrator.currentTestId,
                            onToggle: { toggleGroup(group.id) },
                            onSelectTest: { test in selectedTest = test },
                            onRunGroup: { groupId in Task { await orchestrator.runGroup(groupId) } },
                            onRunTest: { testId in Task { await orchestrator.runSingleTest(testId) } }
                        )
                    }
                }
                .padding(12)
            }
        }
        .background(Color(nsColor: .windowBackgroundColor))
    }

    // MARK: - Test Detail Panel

    private var testDetailPanel: some View {
        Group {
            if let test = selectedTest {
                TestDetailView(test: test, orchestrator: orchestrator)
            } else {
                VStack(spacing: 16) {
                    Image(systemName: "shield.checkered")
                        .font(.system(size: 48))
                        .foregroundColor(.secondary.opacity(0.5))
                    Text("Select a test to view details")
                        .font(.headline)
                        .foregroundColor(.secondary)
                    Text("Choose a test from the list or run the full battery to begin.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .background(Color(nsColor: .textBackgroundColor))
    }

    // MARK: - Filtering

    private var filteredGroups: [SOPGroup] {
        var groups = orchestrator.testSuite.groups

        if let proto = selectedProtocolFilter {
            groups = groups.filter { $0.protocolType == proto }
        }

        if !searchText.isEmpty {
            let query = searchText.lowercased()
            groups = groups.compactMap { group in
                let matchingTests = group.tests.filter { test in
                    test.id.lowercased().contains(query) ||
                    test.title.lowercased().contains(query) ||
                    test.description.lowercased().contains(query) ||
                    test.standards.contains(where: { $0.control.lowercased().contains(query) })
                }
                if matchingTests.isEmpty && !group.title.lowercased().contains(query) {
                    return nil
                }
                if matchingTests.isEmpty {
                    return group
                }
                var filtered = group
                filtered.tests = matchingTests
                return filtered
            }
        }

        return groups
    }

    // MARK: - Helpers

    private func toggleGroup(_ groupId: String) {
        if expandedGroups.contains(groupId) {
            expandedGroups.remove(groupId)
        } else {
            expandedGroups.insert(groupId)
        }
    }

    private var estimatedBatteryTime: String {
        let totalSeconds = orchestrator.testSuite.totalTests * Int(orchestrator.settings.testTimeoutSeconds / 2)
        let minutes = totalSeconds / 60
        return "~\(minutes) minutes"
    }
}
