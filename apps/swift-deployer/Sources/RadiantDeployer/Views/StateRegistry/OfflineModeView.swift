import SwiftUI

// MARK: - Offline Mode Status Model

struct OfflineModeStatus: Codable {
    var isOffline: Bool
    var offlineSince: Date?
    var cacheStatus: CacheStatus
    var connectionAttempts: ConnectionAttempts
    var pendingOperations: PendingOperations
    var availableActions: [String]
    var unavailableActions: [String]
    
    struct CacheStatus: Codable {
        var available: Bool
        var lastSyncAt: Date?
        var ageMinutes: Int?
        var isStale: Bool
        var itemCount: Int
    }
    
    struct ConnectionAttempts: Codable {
        var count: Int
        var lastAttemptAt: Date?
        var nextAttemptAt: Date?
        var backoffSeconds: Int
    }
    
    struct PendingOperations: Codable {
        var count: Int
        var types: [String]
        var willSyncOnReconnect: Bool
    }
}

// MARK: - Offline Mode Banner

struct OfflineModeBanner: View {
    let status: OfflineModeStatus
    let onRetryNow: () -> Void
    
    @State private var isExpanded = false
    
    var body: some View {
        if status.isOffline {
            VStack(spacing: 0) {
                // Main Banner
                HStack(spacing: 12) {
                    Image(systemName: "wifi.slash")
                        .font(.title2)
                        .foregroundStyle(.yellow)
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Offline Mode")
                            .font(.headline)
                            .foregroundStyle(.primary)
                        
                        if let lastSync = status.cacheStatus.lastSyncAt {
                            Text("Using cached data from \(lastSync, style: .relative) ago")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    
                    Spacer()
                    
                    // Status indicators
                    HStack(spacing: 8) {
                        if status.pendingOperations.count > 0 {
                            Label("\(status.pendingOperations.count) pending", systemImage: "clock.badge.exclamationmark")
                                .font(.caption)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color.orange.opacity(0.2))
                                .cornerRadius(4)
                        }
                        
                        if status.cacheStatus.isStale {
                            Label("Stale", systemImage: "exclamationmark.triangle")
                                .font(.caption)
                                .foregroundStyle(.yellow)
                        }
                        
                        Button {
                            onRetryNow()
                        } label: {
                            Label("Retry", systemImage: "arrow.clockwise")
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                        
                        Button {
                            withAnimation {
                                isExpanded.toggle()
                            }
                        } label: {
                            Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding()
                .background(Color.yellow.opacity(0.1))
                
                // Expanded Details
                if isExpanded {
                    Divider()
                    
                    VStack(alignment: .leading, spacing: 16) {
                        // Connection Status
                        HStack(spacing: 20) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Connection Attempts")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Text("\(status.connectionAttempts.count)")
                                    .font(.title3)
                                    .fontWeight(.semibold)
                            }
                            
                            Divider()
                                .frame(height: 40)
                            
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Next Retry")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                if let nextAttempt = status.connectionAttempts.nextAttemptAt {
                                    Text(nextAttempt, style: .relative)
                                        .font(.title3)
                                        .fontWeight(.semibold)
                                } else {
                                    Text("\(status.connectionAttempts.backoffSeconds)s")
                                        .font(.title3)
                                        .fontWeight(.semibold)
                                }
                            }
                            
                            Divider()
                                .frame(height: 40)
                            
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Cache Items")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Text("\(status.cacheStatus.itemCount)")
                                    .font(.title3)
                                    .fontWeight(.semibold)
                            }
                            
                            Spacer()
                        }
                        
                        // Available Actions
                        HStack(alignment: .top, spacing: 24) {
                            VStack(alignment: .leading, spacing: 8) {
                                Label("Available Offline", systemImage: "checkmark.circle")
                                    .font(.caption)
                                    .foregroundStyle(.green)
                                
                                ForEach(status.availableActions, id: \.self) { action in
                                    Text("• \(action)")
                                        .font(.caption)
                                }
                            }
                            
                            VStack(alignment: .leading, spacing: 8) {
                                Label("Requires Connection", systemImage: "xmark.circle")
                                    .font(.caption)
                                    .foregroundStyle(.red)
                                
                                ForEach(status.unavailableActions, id: \.self) { action in
                                    Text("• \(action)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            
                            Spacer()
                        }
                        
                        // Pending Operations
                        if status.pendingOperations.count > 0 {
                            VStack(alignment: .leading, spacing: 8) {
                                Label("Pending Operations", systemImage: "clock.badge.exclamationmark")
                                    .font(.caption)
                                    .foregroundStyle(.orange)
                                
                                Text("These operations will sync when connection is restored:")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                
                                ForEach(status.pendingOperations.types, id: \.self) { type in
                                    Text("• \(type)")
                                        .font(.caption)
                                }
                            }
                        }
                    }
                    .padding()
                    .background(Color.yellow.opacity(0.05))
                }
            }
            .background(Color(nsColor: .controlBackgroundColor))
            .cornerRadius(8)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.yellow.opacity(0.5), lineWidth: 1)
            )
        }
    }
}

// MARK: - Sync Status View (Completed with Errors)

enum EnhancedSyncStatus: String, Codable {
    case pending
    case inProgress = "in_progress"
    case completed
    case completedWithErrors = "completed_with_errors"
    case failed
    case cancelled
    case rolledBack = "rolled_back"
    
    var displayName: String {
        switch self {
        case .pending: return "Pending"
        case .inProgress: return "In Progress"
        case .completed: return "Completed"
        case .completedWithErrors: return "Completed with Errors"
        case .failed: return "Failed"
        case .cancelled: return "Cancelled"
        case .rolledBack: return "Rolled Back"
        }
    }
    
    var icon: String {
        switch self {
        case .pending: return "clock"
        case .inProgress: return "arrow.triangle.2.circlepath"
        case .completed: return "checkmark.circle.fill"
        case .completedWithErrors: return "exclamationmark.circle.fill"
        case .failed: return "xmark.circle.fill"
        case .cancelled: return "stop.circle.fill"
        case .rolledBack: return "arrow.uturn.backward.circle.fill"
        }
    }
    
    var color: Color {
        switch self {
        case .pending: return .secondary
        case .inProgress: return .blue
        case .completed: return .green
        case .completedWithErrors: return .orange
        case .failed: return .red
        case .cancelled: return .gray
        case .rolledBack: return .purple
        }
    }
}

struct SyncResultView: View {
    let status: EnhancedSyncStatus
    let totalItems: Int
    let successfulItems: Int
    let failedItems: Int
    let skippedItems: Int
    let failures: [SyncFailure]
    let successThreshold: Int
    let onRetryFailed: (() -> Void)?
    let onViewDetails: (() -> Void)?
    
    struct SyncFailure: Identifiable {
        let id: String
        let itemType: String
        let error: String
        let recoverable: Bool
    }
    
    var successRate: Double {
        guard totalItems > 0 else { return 100 }
        return Double(successfulItems) / Double(successfulItems + failedItems) * 100
    }
    
    var body: some View {
        VStack(spacing: 16) {
            // Status Header
            HStack {
                Image(systemName: status.icon)
                    .font(.title)
                    .foregroundStyle(status.color)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(status.displayName)
                        .font(.headline)
                    
                    Text("\(successfulItems) of \(totalItems) items (\(String(format: "%.1f", successRate))%)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                Spacer()
                
                // Progress indicator
                if status == .inProgress {
                    ProgressView()
                }
            }
            
            // Progress Bar with threshold indicator
            ZStack(alignment: .leading) {
                // Background
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.secondary.opacity(0.2))
                    .frame(height: 8)
                
                // Success portion
                GeometryReader { geometry in
                    RoundedRectangle(cornerRadius: 4)
                        .fill(successRate >= Double(successThreshold) ? Color.green : Color.orange)
                        .frame(width: geometry.size.width * successRate / 100)
                }
                .frame(height: 8)
                
                // Threshold marker
                GeometryReader { geometry in
                    Rectangle()
                        .fill(Color.primary)
                        .frame(width: 2, height: 12)
                        .offset(x: geometry.size.width * Double(successThreshold) / 100 - 1, y: -2)
                }
                .frame(height: 8)
            }
            
            // Counts
            HStack(spacing: 20) {
                CountBadge(label: "Successful", count: successfulItems, color: .green)
                CountBadge(label: "Failed", count: failedItems, color: .red)
                CountBadge(label: "Skipped", count: skippedItems, color: .gray)
                
                Spacer()
                
                Text("Threshold: \(successThreshold)%")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            // Failed Items (if any)
            if !failures.isEmpty && status == .completedWithErrors {
                Divider()
                
                VStack(alignment: .leading, spacing: 8) {
                    Text("Failed Items")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                    
                    ForEach(failures.prefix(5)) { failure in
                        HStack {
                            Image(systemName: failure.recoverable ? "arrow.clockwise.circle" : "xmark.circle")
                                .foregroundStyle(failure.recoverable ? .orange : .red)
                            
                            VStack(alignment: .leading, spacing: 2) {
                                Text(failure.id)
                                    .font(.caption)
                                    .fontWeight(.medium)
                                Text(failure.error)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                            
                            Spacer()
                            
                            Text(failure.itemType)
                                .font(.caption2)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.secondary.opacity(0.2))
                                .cornerRadius(4)
                        }
                    }
                    
                    if failures.count > 5 {
                        Text("+ \(failures.count - 5) more failures")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                
                // Actions
                HStack {
                    if let onRetryFailed = onRetryFailed, failures.contains(where: { $0.recoverable }) {
                        Button {
                            onRetryFailed()
                        } label: {
                            Label("Retry Failed", systemImage: "arrow.clockwise")
                        }
                        .buttonStyle(.bordered)
                    }
                    
                    Spacer()
                    
                    if let onViewDetails = onViewDetails {
                        Button {
                            onViewDetails()
                        } label: {
                            Label("View Details", systemImage: "info.circle")
                        }
                        .buttonStyle(.bordered)
                    }
                }
            }
        }
        .padding()
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(status.color.opacity(0.3), lineWidth: 1)
        )
    }
}

// MARK: - Count Badge

struct CountBadge: View {
    let label: String
    let count: Int
    let color: Color
    
    var body: some View {
        VStack(spacing: 2) {
            Text("\(count)")
                .font(.title3)
                .fontWeight(.bold)
                .foregroundStyle(color)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }
}

// MARK: - Offline Mode Manager

@MainActor
class OfflineModeManager: ObservableObject {
    @Published var status: OfflineModeStatus
    @Published var isRetrying = false
    
    private var retryTimer: Timer?
    
    init() {
        self.status = OfflineModeStatus(
            isOffline: false,
            offlineSince: nil,
            cacheStatus: .init(
                available: true,
                lastSyncAt: Date(),
                ageMinutes: 0,
                isStale: false,
                itemCount: 0
            ),
            connectionAttempts: .init(
                count: 0,
                lastAttemptAt: nil,
                nextAttemptAt: nil,
                backoffSeconds: 5
            ),
            pendingOperations: .init(
                count: 0,
                types: [],
                willSyncOnReconnect: true
            ),
            availableActions: [
                "View cached manifests",
                "View cached backups",
                "Browse local packages",
                "Checksum verification"
            ],
            unavailableActions: [
                "Create new backups",
                "Sync environments",
                "Deploy changes",
                "Capture manifests"
            ]
        )
    }
    
    func setOffline() {
        status.isOffline = true
        status.offlineSince = Date()
        scheduleRetry()
    }
    
    func setOnline() {
        status.isOffline = false
        status.offlineSince = nil
        status.connectionAttempts.count = 0
        retryTimer?.invalidate()
    }
    
    func retryConnection() async {
        isRetrying = true
        defer { isRetrying = false }
        
        status.connectionAttempts.count += 1
        status.connectionAttempts.lastAttemptAt = Date()
        
        // Simulate connection attempt
        try? await Task.sleep(nanoseconds: 2_000_000_000)
        
        // For demo, stay offline
        // In production, this would actually test the connection
        
        // Increase backoff with exponential backoff + jitter
        let baseBackoff = min(300, Int(pow(2.0, Double(status.connectionAttempts.count))) * 5)
        let jitter = Int.random(in: 0...baseBackoff/4)
        status.connectionAttempts.backoffSeconds = baseBackoff + jitter
        
        scheduleRetry()
    }
    
    func addPendingOperation(type: String) {
        if !status.pendingOperations.types.contains(type) {
            status.pendingOperations.types.append(type)
        }
        status.pendingOperations.count += 1
    }
    
    private func scheduleRetry() {
        retryTimer?.invalidate()
        
        let nextRetry = Date().addingTimeInterval(TimeInterval(status.connectionAttempts.backoffSeconds))
        status.connectionAttempts.nextAttemptAt = nextRetry
        
        retryTimer = Timer.scheduledTimer(withTimeInterval: TimeInterval(status.connectionAttempts.backoffSeconds), repeats: false) { [weak self] _ in
            Task { @MainActor in
                await self?.retryConnection()
            }
        }
    }
}

// MARK: - Previews

#Preview("Offline Banner") {
    OfflineModeBanner(
        status: OfflineModeStatus(
            isOffline: true,
            offlineSince: Date().addingTimeInterval(-3600),
            cacheStatus: .init(
                available: true,
                lastSyncAt: Date().addingTimeInterval(-7200),
                ageMinutes: 120,
                isStale: true,
                itemCount: 45
            ),
            connectionAttempts: .init(
                count: 3,
                lastAttemptAt: Date().addingTimeInterval(-60),
                nextAttemptAt: Date().addingTimeInterval(30),
                backoffSeconds: 30
            ),
            pendingOperations: .init(
                count: 2,
                types: ["Sync operation", "Backup creation"],
                willSyncOnReconnect: true
            ),
            availableActions: ["View cached manifests", "Browse local packages"],
            unavailableActions: ["Create new backups", "Sync environments"]
        ),
        onRetryNow: {}
    )
    .padding()
}

#Preview("Sync Result - Completed with Errors") {
    SyncResultView(
        status: .completedWithErrors,
        totalItems: 100,
        successfulItems: 85,
        failedItems: 12,
        skippedItems: 3,
        failures: [
            .init(id: "table_users", itemType: "database", error: "Connection timeout", recoverable: true),
            .init(id: "s3_assets", itemType: "s3", error: "Access denied", recoverable: false),
            .init(id: "config_flags", itemType: "config", error: "Schema mismatch", recoverable: true),
        ],
        successThreshold: 80,
        onRetryFailed: {},
        onViewDetails: {}
    )
    .padding()
    .frame(width: 500)
}
