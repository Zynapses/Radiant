// RADIANT v7.2.0 - CloudWatch Logs Service
// Log aggregation, search, and real-time tailing

import Foundation

actor CloudWatchLogsService {
    static let shared = CloudWatchLogsService()
    
    enum LogsError: LocalizedError {
        case awsError(String)
        case invalidLogGroup
        case noCredentials
        case parseError(String)
        case timeout
        
        var errorDescription: String? {
            switch self {
            case .awsError(let message): return "AWS Error: \(message)"
            case .invalidLogGroup: return "Invalid log group"
            case .noCredentials: return "AWS credentials not configured"
            case .parseError(let message): return "Parse error: \(message)"
            case .timeout: return "Request timed out"
            }
        }
    }
    
    enum LogLevel: String, CaseIterable, Sendable {
        case all = "ALL"
        case error = "ERROR"
        case warn = "WARN"
        case info = "INFO"
        case debug = "DEBUG"
        
        var color: String {
            switch self {
            case .all: return "gray"
            case .error: return "red"
            case .warn: return "orange"
            case .info: return "blue"
            case .debug: return "green"
            }
        }
    }
    
    struct LogGroup: Identifiable, Sendable {
        let id: String
        let name: String
        let arn: String
        let storedBytes: Int64
        let retentionInDays: Int?
        let creationTime: Date
        
        var displayName: String {
            name.replacingOccurrences(of: "/aws/lambda/", with: "Lambda: ")
                .replacingOccurrences(of: "/aws/ecs/", with: "ECS: ")
        }
        
        var storedSizeFormatted: String {
            ByteCountFormatter.string(fromByteCount: storedBytes, countStyle: .file)
        }
    }
    
    struct LogEvent: Identifiable, Sendable {
        let id: String
        let timestamp: Date
        let message: String
        let logStreamName: String
        let parsedLevel: LogLevel
        
        var isError: Bool { parsedLevel == .error || message.lowercased().contains("error") }
        var isWarning: Bool { parsedLevel == .warn || message.lowercased().contains("warn") }
    }
    
    struct LogQuery: Sendable {
        var logGroupNames: [String]
        var startTime: Date
        var endTime: Date
        var filterPattern: String?
        var limit: Int
        var level: LogLevel
    }
    
    private var tailingTasks: [String: Task<Void, Never>] = [:]
    
    func listLogGroups(region: String, prefix: String? = nil) async throws -> [LogGroup] {
        var command = "aws logs describe-log-groups --region \(region) --output json"
        if let prefix = prefix {
            command += " --log-group-name-prefix \"\(prefix)\""
        }
        
        let output = try await executeCommand(command)
        return try parseLogGroups(data: output)
    }
    
    func getLogEvents(
        logGroupName: String,
        region: String,
        startTime: Date? = nil,
        endTime: Date? = nil,
        filterPattern: String? = nil,
        limit: Int = 100
    ) async throws -> [LogEvent] {
        var command = """
        aws logs filter-log-events \
            --log-group-name "\(logGroupName)" \
            --limit \(limit) \
            --region \(region) \
            --output json
        """
        
        if let start = startTime {
            command += " --start-time \(Int(start.timeIntervalSince1970 * 1000))"
        }
        if let end = endTime {
            command += " --end-time \(Int(end.timeIntervalSince1970 * 1000))"
        }
        if let pattern = filterPattern, !pattern.isEmpty {
            let escaped = pattern.replacingOccurrences(of: "\"", with: "\\\"")
            command += " --filter-pattern \"\(escaped)\""
        }
        
        let output = try await executeCommand(command)
        return try parseLogEvents(data: output)
    }
    
    func searchLogs(query: LogQuery, region: String) async throws -> [LogEvent] {
        var allEvents: [LogEvent] = []
        
        for logGroupName in query.logGroupNames {
            let events = try await getLogEvents(
                logGroupName: logGroupName,
                region: region,
                startTime: query.startTime,
                endTime: query.endTime,
                filterPattern: query.filterPattern,
                limit: query.limit
            )
            
            let filtered = query.level == .all ? events : events.filter { $0.parsedLevel == query.level }
            allEvents.append(contentsOf: filtered)
        }
        
        return allEvents.sorted { $0.timestamp > $1.timestamp }.prefix(query.limit).map { $0 }
    }
    
    func startTailing(
        logGroupName: String,
        region: String,
        onEvent: @escaping @Sendable (LogEvent) -> Void
    ) -> String {
        let tailId = UUID().uuidString
        var lastTimestamp = Date()
        
        let task = Task {
            while !Task.isCancelled {
                do {
                    let events = try await getLogEvents(
                        logGroupName: logGroupName,
                        region: region,
                        startTime: lastTimestamp,
                        limit: 50
                    )
                    
                    for event in events where event.timestamp > lastTimestamp {
                        onEvent(event)
                        lastTimestamp = event.timestamp
                    }
                    
                    try await Task.sleep(nanoseconds: 2_000_000_000)
                } catch {
                    try? await Task.sleep(nanoseconds: 5_000_000_000)
                }
            }
        }
        
        tailingTasks[tailId] = task
        return tailId
    }
    
    func stopTailing(tailId: String) {
        tailingTasks[tailId]?.cancel()
        tailingTasks.removeValue(forKey: tailId)
    }
    
    private func executeCommand(_ command: String) async throws -> Data {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/zsh")
        process.arguments = ["-c", command]
        
        let outputPipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = errorPipe
        
        try process.run()
        process.waitUntilExit()
        
        let outputData = outputPipe.fileHandleForReading.readDataToEndOfFile()
        
        guard process.terminationStatus == 0 else {
            let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
            let errorString = String(data: errorData, encoding: .utf8) ?? "Unknown error"
            throw LogsError.awsError(errorString)
        }
        
        return outputData
    }
    
    private func parseLogGroups(data: Data) throws -> [LogGroup] {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let logGroups = json["logGroups"] as? [[String: Any]] else {
            throw LogsError.parseError("Invalid log groups response")
        }
        
        return logGroups.compactMap { group -> LogGroup? in
            guard let name = group["logGroupName"] as? String,
                  let arn = group["arn"] as? String else { return nil }
            
            return LogGroup(
                id: arn,
                name: name,
                arn: arn,
                storedBytes: group["storedBytes"] as? Int64 ?? 0,
                retentionInDays: group["retentionInDays"] as? Int,
                creationTime: Date(timeIntervalSince1970: (group["creationTime"] as? Double ?? 0) / 1000)
            )
        }
    }
    
    private func parseLogEvents(data: Data) throws -> [LogEvent] {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let events = json["events"] as? [[String: Any]] else {
            throw LogsError.parseError("Invalid log events response")
        }
        
        return events.compactMap { event -> LogEvent? in
            guard let message = event["message"] as? String,
                  let timestampMs = event["timestamp"] as? Double else { return nil }
            
            let level: LogLevel
            let msg = message.lowercased()
            if msg.contains("error") || msg.contains("exception") { level = .error }
            else if msg.contains("warn") { level = .warn }
            else if msg.contains("info") { level = .info }
            else if msg.contains("debug") { level = .debug }
            else { level = .info }
            
            return LogEvent(
                id: "\(event["eventId"] ?? UUID().uuidString)",
                timestamp: Date(timeIntervalSince1970: timestampMs / 1000),
                message: message,
                logStreamName: event["logStreamName"] as? String ?? "",
                parsedLevel: level
            )
        }
    }
}
