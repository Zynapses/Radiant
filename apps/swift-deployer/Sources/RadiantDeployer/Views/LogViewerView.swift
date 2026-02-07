// RADIANT v7.2.0 - Log Viewer View
// CloudWatch logs visualization with search and tailing

import SwiftUI

struct LogViewerView: View {
    @EnvironmentObject var appState: AppState
    @State private var logGroups: [CloudWatchLogsService.LogGroup] = []
    @State private var selectedLogGroup: CloudWatchLogsService.LogGroup?
    @State private var logEvents: [CloudWatchLogsService.LogEvent] = []
    @State private var isLoadingGroups = false
    @State private var isLoadingEvents = false
    @State private var searchText = ""
    @State private var selectedLevel: CloudWatchLogsService.LogLevel = .all
    @State private var isTailing = false
    @State private var tailId: String?
    @State private var timeRange: TimeRange = .oneHour
    @State private var errorMessage: String?
    
    private let region = "us-east-1"
    
    enum TimeRange: String, CaseIterable {
        case fifteenMin = "15m"
        case oneHour = "1h"
        case sixHours = "6h"
        case oneDay = "24h"
        
        var seconds: TimeInterval {
            switch self {
            case .fifteenMin: return 900
            case .oneHour: return 3600
            case .sixHours: return 21600
            case .oneDay: return 86400
            }
        }
    }
    
    var body: some View {
        HSplitView {
            logGroupsList
                .frame(minWidth: 250, maxWidth: 350)
            
            logEventsView
        }
        .onAppear { loadLogGroups() }
        .onDisappear { stopTailing() }
    }
    
    private var logGroupsList: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Log Groups")
                    .font(.headline)
                Spacer()
                Button { loadLogGroups() } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .disabled(isLoadingGroups)
            }
            .padding()
            
            Divider()
            
            if isLoadingGroups {
                ProgressView().padding()
            } else {
                List(logGroups, selection: $selectedLogGroup) { group in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(group.displayName)
                            .font(.subheadline)
                            .lineLimit(1)
                        HStack {
                            Text(group.storedSizeFormatted)
                            if let days = group.retentionInDays {
                                Text("• \(days)d retention")
                            }
                        }
                        .font(.caption)
                        .foregroundColor(.secondary)
                    }
                    .padding(.vertical, 4)
                    .tag(group)
                }
                .onChange(of: selectedLogGroup) { _, newValue in
                    if newValue != nil { loadLogEvents() }
                }
            }
        }
        .background(Color(.textBackgroundColor).opacity(0.5))
    }
    
    private var logEventsView: some View {
        VStack(spacing: 0) {
            toolbar
            Divider()
            
            if selectedLogGroup == nil {
                emptyState
            } else if isLoadingEvents && logEvents.isEmpty {
                ProgressView("Loading logs...").frame(maxHeight: .infinity)
            } else {
                logEventsList
            }
        }
    }
    
    private var toolbar: some View {
        HStack(spacing: 12) {
            Image(systemName: "magnifyingglass")
                .foregroundColor(.secondary)
            TextField("Search logs...", text: $searchText)
                .textFieldStyle(.plain)
                .onSubmit { loadLogEvents() }
            
            Picker("Level", selection: $selectedLevel) {
                ForEach(CloudWatchLogsService.LogLevel.allCases, id: \.self) { level in
                    Text(level.rawValue).tag(level)
                }
            }
            .frame(width: 100)
            
            Picker("Time", selection: $timeRange) {
                ForEach(TimeRange.allCases, id: \.self) { range in
                    Text(range.rawValue).tag(range)
                }
            }
            .frame(width: 80)
            .onChange(of: timeRange) { _, _ in loadLogEvents() }
            
            Divider().frame(height: 20)
            
            Toggle(isOn: $isTailing) {
                Label("Tail", systemImage: "play.fill")
            }
            .toggleStyle(.button)
            .onChange(of: isTailing) { _, newValue in
                if newValue { startTailing() } else { stopTailing() }
            }
            
            Button { loadLogEvents() } label: {
                Image(systemName: "arrow.clockwise")
            }
            .disabled(isLoadingEvents)
        }
        .padding()
    }
    
    private var logEventsList: some View {
        ScrollViewReader { proxy in
            List(filteredEvents) { event in
                logEventRow(event: event)
                    .id(event.id)
            }
            .onChange(of: logEvents.count) { _, _ in
                if isTailing, let lastId = logEvents.last?.id {
                    withAnimation { proxy.scrollTo(lastId, anchor: .bottom) }
                }
            }
        }
    }
    
    private func logEventRow(event: CloudWatchLogsService.LogEvent) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: levelIcon(event.parsedLevel))
                .foregroundColor(levelColor(event.parsedLevel))
                .frame(width: 16)
            
            Text(event.timestamp.formatted(date: .omitted, time: .standard))
                .font(.caption.monospaced())
                .foregroundColor(.secondary)
                .frame(width: 80, alignment: .leading)
            
            Text(event.message)
                .font(.system(.caption, design: .monospaced))
                .lineLimit(3)
                .textSelection(.enabled)
        }
        .padding(.vertical, 2)
    }
    
    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 40))
                .foregroundColor(.secondary)
            Text("Select a log group")
                .font(.headline)
            Text("Choose a log group from the left to view logs")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    private var filteredEvents: [CloudWatchLogsService.LogEvent] {
        var events = logEvents
        if selectedLevel != .all {
            events = events.filter { $0.parsedLevel == selectedLevel }
        }
        if !searchText.isEmpty {
            events = events.filter { $0.message.localizedCaseInsensitiveContains(searchText) }
        }
        return events
    }
    
    private func loadLogGroups() {
        isLoadingGroups = true
        Task {
            do {
                let groups = try await CloudWatchLogsService.shared.listLogGroups(region: region, prefix: "/aws/")
                await MainActor.run {
                    logGroups = groups.sorted { $0.name < $1.name }
                    isLoadingGroups = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isLoadingGroups = false
                }
            }
        }
    }
    
    private func loadLogEvents() {
        guard let group = selectedLogGroup else { return }
        isLoadingEvents = true
        
        Task {
            do {
                let events = try await CloudWatchLogsService.shared.getLogEvents(
                    logGroupName: group.name,
                    region: region,
                    startTime: Date().addingTimeInterval(-timeRange.seconds),
                    filterPattern: searchText.isEmpty ? nil : searchText,
                    limit: 200
                )
                await MainActor.run {
                    logEvents = events.sorted { $0.timestamp < $1.timestamp }
                    isLoadingEvents = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isLoadingEvents = false
                }
            }
        }
    }
    
    private func startTailing() {
        guard let group = selectedLogGroup else { return }
        tailId = CloudWatchLogsService.shared.startTailing(
            logGroupName: group.name,
            region: region
        ) { event in
            Task { @MainActor in
                logEvents.append(event)
                if logEvents.count > 1000 {
                    logEvents.removeFirst(100)
                }
            }
        }
    }
    
    private func stopTailing() {
        if let id = tailId {
            Task { await CloudWatchLogsService.shared.stopTailing(tailId: id) }
            tailId = nil
        }
        isTailing = false
    }
    
    private func levelIcon(_ level: CloudWatchLogsService.LogLevel) -> String {
        switch level {
        case .error: return "xmark.circle.fill"
        case .warn: return "exclamationmark.triangle.fill"
        case .info: return "info.circle.fill"
        case .debug: return "ladybug.fill"
        case .all: return "circle.fill"
        }
    }
    
    private func levelColor(_ level: CloudWatchLogsService.LogLevel) -> Color {
        switch level {
        case .error: return .red
        case .warn: return .orange
        case .info: return .blue
        case .debug: return .green
        case .all: return .gray
        }
    }
}
