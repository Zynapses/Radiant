// RADIANT v4.18.0 - Security Test Logger
// Thread-safe logging for security test execution with evidence collection and credential redaction

import Foundation

actor TestLogger {

    // MARK: - Properties

    private var entries: [LogEntry] = []
    private var evidence: [EvidenceItem] = []
    private let autoRedact: Bool
    private let redactionPatterns: [NSRegularExpression]

    // MARK: - Initialization

    init(autoRedact: Bool = true) {
        self.autoRedact = autoRedact

        var patterns: [NSRegularExpression] = []
        let patternStrings = [
            // AWS Access Key IDs
            "(?:AKIA|ASIA)[A-Z0-9]{16}",
            // AWS Secret Keys (base64-like, 40 chars)
            "(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])",
            // Bearer tokens
            "Bearer\\s+[A-Za-z0-9\\-._~+/]+=*",
            // API keys (generic patterns)
            "(?i)(api[_-]?key|apikey|x-api-key|authorization)[\"'\\s:=]+[A-Za-z0-9\\-._~+/]{20,}",
            // JWT tokens
            "eyJ[A-Za-z0-9_-]+\\.eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+",
            // Session tokens
            "(?i)(session[_-]?token|sess[_-]?id)[\"'\\s:=]+[A-Za-z0-9\\-._~+/]{16,}",
            // Password fields
            "(?i)(password|passwd|secret)[\"'\\s:=]+[^\\s\"',}{\\]]+",
        ]
        for p in patternStrings {
            if let regex = try? NSRegularExpression(pattern: p, options: []) {
                patterns.append(regex)
            }
        }
        self.redactionPatterns = patterns
    }

    // MARK: - Logging

    func info(_ message: String) {
        append(level: .info, message: message)
    }

    func warning(_ message: String) {
        append(level: .warning, message: message)
    }

    func error(_ message: String) {
        append(level: .error, message: message)
    }

    func success(_ message: String) {
        append(level: .success, message: message)
    }

    private func append(level: LogLevel, message: String) {
        let redacted = autoRedact ? redactSensitiveData(message) : message
        let entry = LogEntry(
            id: UUID(),
            timestamp: Date(),
            level: level,
            message: redacted
        )
        entries.append(entry)
    }

    // MARK: - Evidence Collection

    func addEvidence(type: EvidenceType, title: String, content: String) {
        let redacted = autoRedact ? redactSensitiveData(content) : content
        let item = EvidenceItem(
            type: type,
            title: title,
            content: redacted,
            timestamp: Date()
        )
        evidence.append(item)
    }

    func addHTTPRequestEvidence(method: String, url: String, headers: [String: String], body: String?) {
        var content = "HTTP Request:\n"
        content += "\(method) \(autoRedact ? redactSensitiveData(url) : url)\n\n"
        content += "Headers:\n"
        for (key, value) in headers.sorted(by: { $0.key < $1.key }) {
            let redactedValue = autoRedact ? redactSensitiveData(value) : value
            content += "  \(key): \(redactedValue)\n"
        }
        if let body = body {
            content += "\nBody:\n"
            content += autoRedact ? redactSensitiveData(body) : body
        }
        addEvidence(type: .httpRequest, title: "\(method) \(URL(string: url)?.path ?? url)", content: content)
    }

    func addHTTPResponseEvidence(statusCode: Int, headers: [String: String], body: String?) {
        var content = "HTTP Response:\n"
        content += "Status: \(statusCode)\n\n"
        content += "Headers:\n"
        for (key, value) in headers.sorted(by: { $0.key < $1.key }) {
            content += "  \(key): \(value)\n"
        }
        if let body = body {
            content += "\nBody:\n"
            let truncated = body.count > 4096 ? String(body.prefix(4096)) + "\n... [TRUNCATED]" : body
            content += autoRedact ? redactSensitiveData(truncated) : truncated
        }
        addEvidence(type: .httpResponse, title: "Response \(statusCode)", content: content)
    }

    // MARK: - Retrieval

    func getEntries() -> [LogEntry] {
        entries
    }

    func getEvidence() -> [EvidenceItem] {
        evidence
    }

    func reset() {
        entries.removeAll()
        evidence.removeAll()
    }

    // MARK: - Redaction

    private func redactSensitiveData(_ input: String) -> String {
        var result = input
        let nsRange = NSRange(result.startIndex..., in: result)

        for regex in redactionPatterns {
            let matches = regex.matches(in: result, options: [], range: nsRange)
            for match in matches.reversed() {
                if let range = Range(match.range, in: result) {
                    let original = String(result[range])
                    let prefix = String(original.prefix(4))
                    let redacted = "\(prefix)***[REDACTED]***"
                    result.replaceSubrange(range, with: redacted)
                }
            }
        }
        return result
    }

    // MARK: - Formatted Output

    func formattedLog() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        return entries.map { entry in
            let ts = formatter.string(from: entry.timestamp)
            let level = entry.level.rawValue.uppercased().padding(toLength: 7, withPad: " ", startingAt: 0)
            return "[\(ts)] [\(level)] \(entry.message)"
        }.joined(separator: "\n")
    }
}
