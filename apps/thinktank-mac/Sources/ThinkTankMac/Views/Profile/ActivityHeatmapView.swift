import SwiftUI

// MARK: - Activity Heatmap View
// GitHub-style contribution heatmap for user profile
// Mirrors: apps/thinktank/components/ui/activity-heatmap.tsx + enhanced-activity-heatmap.tsx

struct ActivityHeatmapView: View {
    let activityData: [DayActivity]
    var weeks: Int = 26

    private let daysPerWeek = 7
    private let dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""]

    private var maxMessages: Int {
        activityData.map(\.messages).max() ?? 1
    }

    private var activityMap: [String: Int] {
        Dictionary(uniqueKeysWithValues: activityData.map { ($0.date, $0.messages) })
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Activity")
                .font(.caption.bold())
                .foregroundStyle(.secondary)

            HStack(alignment: .top, spacing: 2) {
                VStack(alignment: .trailing, spacing: 0) {
                    ForEach(0..<daysPerWeek, id: \.self) { day in
                        Text(dayLabels[day])
                            .font(.system(size: 8))
                            .foregroundStyle(.secondary)
                            .frame(height: 12)
                    }
                }
                .frame(width: 24)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 2) {
                        ForEach(0..<weeks, id: \.self) { week in
                            VStack(spacing: 2) {
                                ForEach(0..<daysPerWeek, id: \.self) { day in
                                    let date = dateFor(week: week, day: day)
                                    let dateString = formatDate(date)
                                    let count = activityMap[dateString] ?? 0
                                    Rectangle()
                                        .fill(colorForCount(count))
                                        .frame(width: 10, height: 10)
                                        .clipShape(RoundedRectangle(cornerRadius: 2))
                                        .help("\(dateString): \(count) message\(count == 1 ? "" : "s")")
                                }
                            }
                        }
                    }
                }
            }

            HStack(spacing: 4) {
                Text("Less")
                    .font(.system(size: 8))
                    .foregroundStyle(.secondary)
                ForEach(0..<5, id: \.self) { level in
                    Rectangle()
                        .fill(colorForLevel(level))
                        .frame(width: 10, height: 10)
                        .clipShape(RoundedRectangle(cornerRadius: 2))
                }
                Text("More")
                    .font(.system(size: 8))
                    .foregroundStyle(.secondary)

                Spacer()

                let total = activityData.reduce(0) { $0 + $1.messages }
                Text("\(total) messages in the last \(weeks) weeks")
                    .font(.system(size: 9))
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func dateFor(week: Int, day: Int) -> Date {
        let today = Date()
        let calendar = Calendar.current
        let todayWeekday = calendar.component(.weekday, from: today)
        let daysFromEnd = (weeks - 1 - week) * 7 + (6 - day)
        let adjustedDays = daysFromEnd - (todayWeekday - 1)
        return calendar.date(byAdding: .day, value: -adjustedDays, to: today) ?? today
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    private func colorForCount(_ count: Int) -> Color {
        if count == 0 { return Color.secondary.opacity(0.1) }
        let ratio = Double(count) / Double(max(maxMessages, 1))
        if ratio > 0.75 { return .green.opacity(0.9) }
        if ratio > 0.5 { return .green.opacity(0.7) }
        if ratio > 0.25 { return .green.opacity(0.5) }
        return .green.opacity(0.3)
    }

    private func colorForLevel(_ level: Int) -> Color {
        switch level {
        case 0: return Color.secondary.opacity(0.1)
        case 1: return .green.opacity(0.3)
        case 2: return .green.opacity(0.5)
        case 3: return .green.opacity(0.7)
        case 4: return .green.opacity(0.9)
        default: return Color.secondary.opacity(0.1)
        }
    }
}
