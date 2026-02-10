// RADIANT v4.18.0 - SOP Group Card View
// Collapsible card showing a group of security tests with status summary

import SwiftUI

struct SOPGroupCard: View {
    let group: SOPGroup
    let isExpanded: Bool
    let selectedTestId: String?
    let isRunning: Bool
    let currentTestId: String?
    let onToggle: () -> Void
    let onSelectTest: (SecurityTest) -> Void
    let onRunGroup: (String) -> Void
    let onRunTest: (String) -> Void

    var body: some View {
        VStack(spacing: 0) {
            groupHeader
            if isExpanded {
                Divider()
                    .padding(.horizontal, 12)
                testList
            }
        }
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(nsColor: .controlBackgroundColor))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .strokeBorder(group.protocolType.color.opacity(0.2), lineWidth: 1)
        )
    }

    // MARK: - Header

    private var groupHeader: some View {
        Button(action: onToggle) {
            HStack(spacing: 10) {
                Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .frame(width: 12)

                Image(systemName: group.protocolType.icon)
                    .font(.caption)
                    .foregroundColor(group.protocolType.color)
                    .frame(width: 20)

                VStack(alignment: .leading, spacing: 1) {
                    HStack(spacing: 6) {
                        Text(group.id)
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundColor(group.protocolType.color)
                        Text(group.title)
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.primary)
                            .lineLimit(1)
                    }
                    Text(group.description)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }

                Spacer()

                statusPills

                if !isRunning {
                    Button(action: { onRunGroup(group.id) }) {
                        Image(systemName: "play.circle")
                            .font(.caption)
                    }
                    .buttonStyle(.plain)
                    .foregroundColor(.blue)
                    .help("Run this group")
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var statusPills: some View {
        HStack(spacing: 4) {
            if group.passedCount > 0 {
                miniPill(count: group.passedCount, color: .green)
            }
            if group.failedCount > 0 {
                miniPill(count: group.failedCount, color: .red)
            }
            if group.errorCount > 0 {
                miniPill(count: group.errorCount, color: .orange)
            }
            if group.notRunCount > 0 {
                miniPill(count: group.notRunCount, color: .secondary)
            }
        }
    }

    private func miniPill(count: Int, color: Color) -> some View {
        Text("\(count)")
            .font(.system(size: 9, weight: .bold, design: .rounded))
            .foregroundColor(.white)
            .padding(.horizontal, 5)
            .padding(.vertical, 1)
            .background(Capsule().fill(color))
    }

    // MARK: - Test List

    private var testList: some View {
        VStack(spacing: 0) {
            ForEach(group.tests) { test in
                TestRow(
                    test: test,
                    isSelected: selectedTestId == test.id,
                    isCurrentlyRunning: currentTestId == test.id,
                    isRunning: isRunning,
                    onSelect: { onSelectTest(test) },
                    onRun: { onRunTest(test.id) }
                )
                if test.id != group.tests.last?.id {
                    Divider()
                        .padding(.leading, 44)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Test Row

struct TestRow: View {
    let test: SecurityTest
    let isSelected: Bool
    let isCurrentlyRunning: Bool
    let isRunning: Bool
    let onSelect: () -> Void
    let onRun: () -> Void

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 8) {
                statusIcon
                    .frame(width: 20)

                VStack(alignment: .leading, spacing: 1) {
                    HStack(spacing: 4) {
                        Text(test.id)
                            .font(.system(size: 10, weight: .medium, design: .monospaced))
                            .foregroundColor(.secondary)
                        Text(test.title)
                            .font(.caption)
                            .fontWeight(.medium)
                            .foregroundColor(.primary)
                            .lineLimit(1)
                    }

                    HStack(spacing: 6) {
                        severityBadge
                        if !test.standards.isEmpty {
                            Text(test.standards.prefix(2).map(\.control).joined(separator: ", "))
                                .font(.system(size: 9))
                                .foregroundColor(.secondary)
                        }
                        if let duration = test.lastRunDuration {
                            Text(String(format: "%.2fs", duration))
                                .font(.system(size: 9))
                                .foregroundColor(.secondary)
                        }
                    }
                }

                Spacer()

                if !isRunning && test.status == .notRun {
                    Button(action: onRun) {
                        Image(systemName: "play.circle")
                            .font(.caption2)
                    }
                    .buttonStyle(.plain)
                    .foregroundColor(.blue)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: 4)
                    .fill(isSelected ? Color.accentColor.opacity(0.1) : Color.clear)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var statusIcon: some View {
        if isCurrentlyRunning {
            ProgressView()
                .controlSize(.small)
                .scaleEffect(0.7)
        } else {
            Image(systemName: test.status.icon)
                .font(.caption)
                .foregroundColor(test.status.color)
        }
    }

    private var severityBadge: some View {
        Text(test.riskSeverity.rawValue)
            .font(.system(size: 8, weight: .bold))
            .foregroundColor(.white)
            .padding(.horizontal, 4)
            .padding(.vertical, 1)
            .background(
                Capsule().fill(test.riskSeverity.color.opacity(0.8))
            )
    }
}
