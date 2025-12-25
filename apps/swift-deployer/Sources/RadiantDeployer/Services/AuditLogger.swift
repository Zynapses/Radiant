// RADIANT v4.18.0 - Audit Logger Service
// Tracks all user actions for security and compliance

import Foundation

actor AuditLogger {
    static let shared = AuditLogger()
    
    enum AuditAction: String, Codable {
        // Credentials
        case credentialAdded = "credential_added"
        case credentialRemoved = "credential_removed"
        case credentialValidated = "credential_validated"
        
        // Deployments
        case deploymentStarted = "deployment_started"
        case deploymentCompleted = "deployment_completed"
        case deploymentFailed = "deployment_failed"
        case deploymentCancelled = "deployment_cancelled"
        
        // Snapshots
        case snapshotCreated = "snapshot_created"
        case snapshotDeleted = "snapshot_deleted"
        case rollbackInitiated = "rollback_initiated"
        
        // Packages
        case packageDownloaded = "package_downloaded"
        case packageVerified = "package_verified"
        case cacheCleared = "cache_cleared"
        
        // Settings
        case settingsChanged = "settings_changed"
        case apiKeyUpdated = "api_key_updated"
        
        // Security
        case loginAttempt = "login_attempt"
        case securityScanRun = "security_scan_run"
        case complianceReportGenerated = "compliance_report_generated"
        
        // App Management
        case appCreated = "app_created"
        case appDeleted = "app_deleted"
        case appUpdated = "app_updated"
        
        // Region/Infrastructure
        case regionAdded = "region_added"
        case regionRemoved = "region_removed"
        
        // AI
        case aiAssistantQuery = "ai_assistant_query"
        case modelDeployed = "model_deployed"
        case modelStopped = "model_stopped"
    }
    
    struct AuditEntry: Codable, Identifiable {
        let id: String
        let timestamp: Date
        let action: AuditAction
        let details: String
        let userId: String?
        let ipAddress: String?
        let metadata: [String: String]?
    }
    
    private var entries: [AuditEntry] = []
    private let maxEntries = 10000
    private let logFileURL: URL
    
    init() {
        guard let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            fatalError("Could not access Application Support directory")
        }
        let appDir = appSupport.appendingPathComponent("RadiantDeployer")
        try? FileManager.default.createDirectory(at: appDir, withIntermediateDirectories: true)
        logFileURL = appDir.appendingPathComponent("audit.log")
        
        Task {
            await loadEntries()
        }
    }
    
    func log(action: AuditAction, details: String, metadata: [String: String]? = nil) {
        let entry = AuditEntry(
            id: UUID().uuidString,
            timestamp: Date(),
            action: action,
            details: details,
            userId: getCurrentUserId(),
            ipAddress: getLocalIPAddress(),
            metadata: metadata
        )
        
        entries.append(entry)
        
        // Trim old entries if needed
        if entries.count > maxEntries {
            entries = Array(entries.suffix(maxEntries))
        }
        
        // Persist to disk
        Task {
            await persistEntry(entry)
        }
    }
    
    func getEntries(limit: Int = 100, action: AuditAction? = nil) -> [AuditEntry] {
        var filtered = entries
        if let action = action {
            filtered = filtered.filter { $0.action == action }
        }
        return Array(filtered.suffix(limit).reversed())
    }
    
    func getEntriesSince(_ date: Date) -> [AuditEntry] {
        return entries.filter { $0.timestamp >= date }
    }
    
    func exportToJSON() throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        return try encoder.encode(entries)
    }
    
    func clearOldEntries(olderThan days: Int) {
        let cutoffDate = Calendar.current.date(byAdding: .day, value: -days, to: Date())!
        entries = entries.filter { $0.timestamp >= cutoffDate }
        
        Task {
            await persistAllEntries()
        }
    }
    
    // MARK: - Private Methods
    
    private func loadEntries() {
        guard FileManager.default.fileExists(atPath: logFileURL.path) else { return }
        
        do {
            let data = try Data(contentsOf: logFileURL)
            let lines = String(data: data, encoding: .utf8)?.components(separatedBy: "\n") ?? []
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            
            for line in lines where !line.isEmpty {
                if let lineData = line.data(using: .utf8),
                   let entry = try? decoder.decode(AuditEntry.self, from: lineData) {
                    entries.append(entry)
                }
            }
        } catch {
            print("Failed to load audit log: \(error)")
        }
    }
    
    private func persistEntry(_ entry: AuditEntry) {
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(entry)
            
            if let jsonString = String(data: data, encoding: .utf8) {
                let line = jsonString + "\n"
                
                if FileManager.default.fileExists(atPath: logFileURL.path) {
                    let fileHandle = try FileHandle(forWritingTo: logFileURL)
                    fileHandle.seekToEndOfFile()
                    fileHandle.write(line.data(using: .utf8)!)
                    fileHandle.closeFile()
                } else {
                    try line.write(to: logFileURL, atomically: true, encoding: .utf8)
                }
            }
        } catch {
            print("Failed to persist audit entry: \(error)")
        }
    }
    
    private func persistAllEntries() {
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            
            var content = ""
            for entry in entries {
                if let data = try? encoder.encode(entry),
                   let json = String(data: data, encoding: .utf8) {
                    content += json + "\n"
                }
            }
            
            try content.write(to: logFileURL, atomically: true, encoding: .utf8)
        } catch {
            print("Failed to persist audit log: \(error)")
        }
    }
    
    private func getCurrentUserId() -> String? {
        return NSUserName()
    }
    
    private func getLocalIPAddress() -> String? {
        var address: String?
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        
        if getifaddrs(&ifaddr) == 0 {
            var ptr = ifaddr
            while ptr != nil {
                let interface = ptr!.pointee
                let addrFamily = interface.ifa_addr.pointee.sa_family
                
                if addrFamily == UInt8(AF_INET) {
                    let name = String(cString: interface.ifa_name)
                    if name == "en0" {
                        var hostname = [CChar](repeating: 0, count: Int(NI_MAXHOST))
                        getnameinfo(interface.ifa_addr, socklen_t(interface.ifa_addr.pointee.sa_len),
                                   &hostname, socklen_t(hostname.count), nil, socklen_t(0), NI_NUMERICHOST)
                        address = String(cString: hostname)
                    }
                }
                ptr = interface.ifa_next
            }
            freeifaddrs(ifaddr)
        }
        return address
    }
}
