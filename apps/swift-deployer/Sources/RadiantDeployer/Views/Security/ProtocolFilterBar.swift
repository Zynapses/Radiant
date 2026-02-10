// RADIANT v4.18.0 - Protocol Filter Bar
// Horizontal filter bar for selecting test protocol categories

import SwiftUI

struct ProtocolFilterBar: View {
    @Binding var selectedProtocol: TestProtocol?
    let suite: TestSuite

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                filterChip(label: "All", icon: "shield.checkered", count: suite.totalTests, isSelected: selectedProtocol == nil) {
                    selectedProtocol = nil
                }

                ForEach(TestProtocol.allCases, id: \.self) { proto in
                    let groups = suite.groups.filter { $0.protocolType == proto }
                    let total = groups.flatMap(\.tests).count
                    let passed = groups.flatMap(\.tests).filter { $0.status == .passed }.count
                    let failed = groups.flatMap(\.tests).filter { $0.status == .failed }.count

                    filterChip(
                        label: proto.rawValue,
                        icon: proto.icon,
                        count: total,
                        passed: passed,
                        failed: failed,
                        color: proto.color,
                        isSelected: selectedProtocol == proto
                    ) {
                        selectedProtocol = selectedProtocol == proto ? nil : proto
                    }
                }

                Spacer()

                summaryBadges
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
        }
        .background(Color(nsColor: .controlBackgroundColor).opacity(0.5))
    }

    private func filterChip(
        label: String,
        icon: String,
        count: Int,
        passed: Int = 0,
        failed: Int = 0,
        color: Color = .blue,
        isSelected: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.caption)
                Text(label)
                    .font(.caption)
                    .fontWeight(isSelected ? .semibold : .regular)
                Text("(\(count))")
                    .font(.caption2)
                    .foregroundColor(.secondary)

                if failed > 0 {
                    Text("\(failed)✗")
                        .font(.caption2)
                        .foregroundColor(.red)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(
                RoundedRectangle(cornerRadius: 6)
                    .fill(isSelected ? color.opacity(0.15) : Color.clear)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .strokeBorder(isSelected ? color.opacity(0.5) : Color.secondary.opacity(0.2), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var summaryBadges: some View {
        HStack(spacing: 12) {
            statusBadge(icon: "checkmark.circle.fill", color: .green, count: suite.passedTests, label: "Passed")
            statusBadge(icon: "xmark.circle.fill", color: .red, count: suite.failedTests, label: "Failed")
            statusBadge(icon: "exclamationmark.triangle.fill", color: .orange, count: suite.errorTests, label: "Errors")
            statusBadge(icon: "circle", color: .secondary, count: suite.notRunTests, label: "Pending")
        }
    }

    private func statusBadge(icon: String, color: Color, count: Int, label: String) -> some View {
        HStack(spacing: 3) {
            Image(systemName: icon)
                .font(.caption2)
                .foregroundColor(color)
            Text("\(count)")
                .font(.caption)
                .fontWeight(.medium)
        }
        .help(label)
    }
}
