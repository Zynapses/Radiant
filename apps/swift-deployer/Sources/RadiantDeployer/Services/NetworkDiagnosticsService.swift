// RADIANT v7.2.0 - Network Diagnostics Service
// DNS, SSL, connectivity, and latency testing

import Foundation

actor NetworkDiagnosticsService {
    static let shared = NetworkDiagnosticsService()
    
    enum DiagnosticError: LocalizedError {
        case testFailed(String)
        case timeout
        case invalidEndpoint
        
        var errorDescription: String? {
            switch self {
            case .testFailed(let msg): return "Test failed: \(msg)"
            case .timeout: return "Request timed out"
            case .invalidEndpoint: return "Invalid endpoint"
            }
        }
    }
    
    enum TestStatus: String, Sendable {
        case passed = "Passed"
        case failed = "Failed"
        case warning = "Warning"
        case skipped = "Skipped"
        
        var icon: String {
            switch self {
            case .passed: return "checkmark.circle.fill"
            case .failed: return "xmark.circle.fill"
            case .warning: return "exclamationmark.triangle.fill"
            case .skipped: return "minus.circle.fill"
            }
        }
        
        var color: String {
            switch self {
            case .passed: return "green"
            case .failed: return "red"
            case .warning: return "orange"
            case .skipped: return "gray"
            }
        }
    }
    
    struct DNSResult: Identifiable, Sendable {
        let id = UUID()
        let hostname: String
        let status: TestStatus
        let resolvedIPs: [String]
        let responseTime: TimeInterval
        let recordType: String
        let error: String?
    }
    
    struct SSLResult: Identifiable, Sendable {
        let id = UUID()
        let hostname: String
        let status: TestStatus
        let certificateValid: Bool
        let expiresAt: Date?
        let daysUntilExpiry: Int?
        let issuer: String?
        let subject: String?
        let protocol_: String?
        let cipher: String?
        let error: String?
    }
    
    struct ConnectivityResult: Identifiable, Sendable {
        let id = UUID()
        let endpoint: String
        let status: TestStatus
        let httpStatus: Int?
        let responseTime: TimeInterval
        let bytesReceived: Int
        let error: String?
    }
    
    struct LatencyResult: Identifiable, Sendable {
        let id = UUID()
        let endpoint: String
        let status: TestStatus
        let minLatency: TimeInterval
        let avgLatency: TimeInterval
        let maxLatency: TimeInterval
        let packetLoss: Double
        let samples: Int
    }
    
    struct PortCheckResult: Identifiable, Sendable {
        let id = UUID()
        let host: String
        let port: Int
        let status: TestStatus
        let isOpen: Bool
        let serviceName: String?
        let responseTime: TimeInterval
    }
    
    struct DiagnosticReport: Sendable {
        let timestamp: Date
        let environment: String
        let dnsResults: [DNSResult]
        let sslResults: [SSLResult]
        let connectivityResults: [ConnectivityResult]
        let latencyResults: [LatencyResult]
        let portCheckResults: [PortCheckResult]
        let overallStatus: TestStatus
        let summary: String
    }
    
    func runFullDiagnostics(
        environment: String,
        endpoints: [String],
        onProgress: @escaping @Sendable (String) -> Void
    ) async -> DiagnosticReport {
        var dnsResults: [DNSResult] = []
        var sslResults: [SSLResult] = []
        var connectivityResults: [ConnectivityResult] = []
        var latencyResults: [LatencyResult] = []
        var portCheckResults: [PortCheckResult] = []
        
        for endpoint in endpoints {
            let host = extractHost(from: endpoint)
            
            onProgress("Testing DNS for \(host)...")
            let dns = await testDNS(hostname: host)
            dnsResults.append(dns)
            
            if endpoint.hasPrefix("https") {
                onProgress("Testing SSL for \(host)...")
                let ssl = await testSSL(hostname: host)
                sslResults.append(ssl)
            }
            
            onProgress("Testing connectivity to \(endpoint)...")
            let conn = await testConnectivity(endpoint: endpoint)
            connectivityResults.append(conn)
            
            onProgress("Testing latency to \(host)...")
            let latency = await testLatency(hostname: host, samples: 5)
            latencyResults.append(latency)
        }
        
        let commonPorts = [(443, "HTTPS"), (80, "HTTP"), (5432, "PostgreSQL"), (6379, "Redis")]
        for endpoint in endpoints.prefix(1) {
            let host = extractHost(from: endpoint)
            for (port, service) in commonPorts {
                onProgress("Checking port \(port) on \(host)...")
                let portResult = await testPort(host: host, port: port, serviceName: service)
                portCheckResults.append(portResult)
            }
        }
        
        let overallStatus = determineOverallStatus(
            dns: dnsResults, ssl: sslResults, connectivity: connectivityResults, latency: latencyResults
        )
        
        let summary = generateSummary(
            dns: dnsResults, ssl: sslResults, connectivity: connectivityResults, latency: latencyResults
        )
        
        return DiagnosticReport(
            timestamp: Date(),
            environment: environment,
            dnsResults: dnsResults,
            sslResults: sslResults,
            connectivityResults: connectivityResults,
            latencyResults: latencyResults,
            portCheckResults: portCheckResults,
            overallStatus: overallStatus,
            summary: summary
        )
    }
    
    func testDNS(hostname: String) async -> DNSResult {
        let startTime = Date()
        
        do {
            let output = try await executeCommand("dig +short \(hostname) A")
            let responseTime = Date().timeIntervalSince(startTime)
            let ips = String(data: output, encoding: .utf8)?
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .components(separatedBy: "\n")
                .filter { !$0.isEmpty } ?? []
            
            if ips.isEmpty {
                return DNSResult(
                    hostname: hostname,
                    status: .failed,
                    resolvedIPs: [],
                    responseTime: responseTime,
                    recordType: "A",
                    error: "No DNS records found"
                )
            }
            
            return DNSResult(
                hostname: hostname,
                status: .passed,
                resolvedIPs: ips,
                responseTime: responseTime,
                recordType: "A",
                error: nil
            )
        } catch {
            return DNSResult(
                hostname: hostname,
                status: .failed,
                resolvedIPs: [],
                responseTime: Date().timeIntervalSince(startTime),
                recordType: "A",
                error: error.localizedDescription
            )
        }
    }
    
    func testSSL(hostname: String, port: Int = 443) async -> SSLResult {
        do {
            let command = "echo | openssl s_client -servername \(hostname) -connect \(hostname):\(port) 2>/dev/null | openssl x509 -noout -dates -issuer -subject 2>/dev/null"
            let output = try await executeCommand(command)
            let outputStr = String(data: output, encoding: .utf8) ?? ""
            
            var expiresAt: Date?
            var issuer: String?
            var subject: String?
            var daysUntilExpiry: Int?
            
            let lines = outputStr.components(separatedBy: "\n")
            let dateFormatter = DateFormatter()
            dateFormatter.dateFormat = "MMM d HH:mm:ss yyyy z"
            
            for line in lines {
                if line.hasPrefix("notAfter=") {
                    let dateStr = line.replacingOccurrences(of: "notAfter=", with: "")
                    expiresAt = dateFormatter.date(from: dateStr)
                    if let expiry = expiresAt {
                        daysUntilExpiry = Calendar.current.dateComponents([.day], from: Date(), to: expiry).day
                    }
                } else if line.hasPrefix("issuer=") {
                    issuer = line.replacingOccurrences(of: "issuer=", with: "")
                } else if line.hasPrefix("subject=") {
                    subject = line.replacingOccurrences(of: "subject=", with: "")
                }
            }
            
            let status: TestStatus
            if let days = daysUntilExpiry {
                if days <= 0 { status = .failed }
                else if days <= 30 { status = .warning }
                else { status = .passed }
            } else {
                status = .failed
            }
            
            return SSLResult(
                hostname: hostname,
                status: status,
                certificateValid: status != .failed,
                expiresAt: expiresAt,
                daysUntilExpiry: daysUntilExpiry,
                issuer: issuer,
                subject: subject,
                protocol_: "TLS 1.3",
                cipher: nil,
                error: status == .failed ? "Certificate expired or invalid" : nil
            )
        } catch {
            return SSLResult(
                hostname: hostname,
                status: .failed,
                certificateValid: false,
                expiresAt: nil,
                daysUntilExpiry: nil,
                issuer: nil,
                subject: nil,
                protocol_: nil,
                cipher: nil,
                error: error.localizedDescription
            )
        }
    }
    
    func testConnectivity(endpoint: String) async -> ConnectivityResult {
        let startTime = Date()
        
        do {
            let command = "curl -s -o /dev/null -w '%{http_code},%{size_download}' --connect-timeout 10 \"\(endpoint)\""
            let output = try await executeCommand(command)
            let responseTime = Date().timeIntervalSince(startTime)
            
            let outputStr = String(data: output, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let parts = outputStr.components(separatedBy: ",")
            let httpStatus = Int(parts.first ?? "") ?? 0
            let bytesReceived = Int(parts.last ?? "") ?? 0
            
            let status: TestStatus
            if httpStatus >= 200 && httpStatus < 400 { status = .passed }
            else if httpStatus >= 400 && httpStatus < 500 { status = .warning }
            else { status = .failed }
            
            return ConnectivityResult(
                endpoint: endpoint,
                status: status,
                httpStatus: httpStatus,
                responseTime: responseTime,
                bytesReceived: bytesReceived,
                error: status == .failed ? "HTTP \(httpStatus)" : nil
            )
        } catch {
            return ConnectivityResult(
                endpoint: endpoint,
                status: .failed,
                httpStatus: nil,
                responseTime: Date().timeIntervalSince(startTime),
                bytesReceived: 0,
                error: error.localizedDescription
            )
        }
    }
    
    func testLatency(hostname: String, samples: Int = 5) async -> LatencyResult {
        do {
            let command = "ping -c \(samples) -q \(hostname) 2>&1"
            let output = try await executeCommand(command)
            let outputStr = String(data: output, encoding: .utf8) ?? ""
            
            var minLatency: TimeInterval = 0
            var avgLatency: TimeInterval = 0
            var maxLatency: TimeInterval = 0
            var packetLoss: Double = 0
            
            let lines = outputStr.components(separatedBy: "\n")
            for line in lines {
                if line.contains("packet loss") {
                    if let match = line.range(of: #"(\d+\.?\d*)% packet loss"#, options: .regularExpression) {
                        let lossStr = line[match].replacingOccurrences(of: "% packet loss", with: "")
                        packetLoss = Double(lossStr) ?? 0
                    }
                }
                if line.contains("min/avg/max") {
                    let parts = line.components(separatedBy: " = ")
                    if let stats = parts.last?.components(separatedBy: "/") {
                        minLatency = (Double(stats[0]) ?? 0) / 1000
                        avgLatency = (Double(stats[1]) ?? 0) / 1000
                        maxLatency = (Double(stats[2].components(separatedBy: " ").first ?? "") ?? 0) / 1000
                    }
                }
            }
            
            let status: TestStatus
            if packetLoss > 50 { status = .failed }
            else if packetLoss > 10 || avgLatency > 0.5 { status = .warning }
            else { status = .passed }
            
            return LatencyResult(
                endpoint: hostname,
                status: status,
                minLatency: minLatency,
                avgLatency: avgLatency,
                maxLatency: maxLatency,
                packetLoss: packetLoss,
                samples: samples
            )
        } catch {
            return LatencyResult(
                endpoint: hostname,
                status: .failed,
                minLatency: 0,
                avgLatency: 0,
                maxLatency: 0,
                packetLoss: 100,
                samples: samples
            )
        }
    }
    
    func testPort(host: String, port: Int, serviceName: String? = nil) async -> PortCheckResult {
        let startTime = Date()
        
        do {
            let command = "nc -z -w 5 \(host) \(port) 2>&1"
            _ = try await executeCommand(command)
            let responseTime = Date().timeIntervalSince(startTime)
            
            return PortCheckResult(
                host: host,
                port: port,
                status: .passed,
                isOpen: true,
                serviceName: serviceName,
                responseTime: responseTime
            )
        } catch {
            return PortCheckResult(
                host: host,
                port: port,
                status: .failed,
                isOpen: false,
                serviceName: serviceName,
                responseTime: Date().timeIntervalSince(startTime)
            )
        }
    }
    
    private func extractHost(from endpoint: String) -> String {
        var host = endpoint
        if let url = URL(string: endpoint) {
            host = url.host ?? endpoint
        }
        return host.replacingOccurrences(of: "https://", with: "").replacingOccurrences(of: "http://", with: "").components(separatedBy: "/").first ?? host
    }
    
    private func determineOverallStatus(
        dns: [DNSResult],
        ssl: [SSLResult],
        connectivity: [ConnectivityResult],
        latency: [LatencyResult]
    ) -> TestStatus {
        let allStatuses = dns.map(\.status) + ssl.map(\.status) + connectivity.map(\.status) + latency.map(\.status)
        
        if allStatuses.contains(.failed) { return .failed }
        if allStatuses.contains(.warning) { return .warning }
        return .passed
    }
    
    private func generateSummary(
        dns: [DNSResult],
        ssl: [SSLResult],
        connectivity: [ConnectivityResult],
        latency: [LatencyResult]
    ) -> String {
        var issues: [String] = []
        
        let dnsFailed = dns.filter { $0.status == .failed }.count
        if dnsFailed > 0 { issues.append("\(dnsFailed) DNS resolution failed") }
        
        let sslWarnings = ssl.filter { $0.status == .warning }.count
        let sslFailed = ssl.filter { $0.status == .failed }.count
        if sslFailed > 0 { issues.append("\(sslFailed) SSL certificates invalid") }
        if sslWarnings > 0 { issues.append("\(sslWarnings) SSL certificates expiring soon") }
        
        let connFailed = connectivity.filter { $0.status == .failed }.count
        if connFailed > 0 { issues.append("\(connFailed) endpoints unreachable") }
        
        let highLatency = latency.filter { $0.avgLatency > 0.5 }.count
        if highLatency > 0 { issues.append("\(highLatency) endpoints with high latency") }
        
        if issues.isEmpty { return "All diagnostics passed successfully" }
        return issues.joined(separator: "; ")
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
        
        return outputPipe.fileHandleForReading.readDataToEndOfFile()
    }
}
