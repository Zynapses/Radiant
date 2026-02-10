import SwiftUI
import CryptoKit

// MARK: - Checksum Verification View

struct ChecksumVerificationView: View {
    @StateObject private var viewModel = ChecksumVerificationViewModel()
    @State private var selectedItem: VerifiableItem?
    @State private var showManualVerifySheet = false
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Data Integrity Verification")
                        .font(.title2)
                        .fontWeight(.semibold)
                    Text("Verify checksums for manifests, backups, and packages")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                
                Spacer()
                
                HStack(spacing: 12) {
                    Button {
                        Task { await viewModel.verifyAll() }
                    } label: {
                        Label("Verify All", systemImage: "checkmark.shield")
                    }
                    .disabled(viewModel.isVerifying)
                    
                    Button {
                        showManualVerifySheet = true
                    } label: {
                        Label("Manual Verify", systemImage: "doc.text.magnifyingglass")
                    }
                }
            }
            .padding()
            
            Divider()
            
            // Summary Cards
            HStack(spacing: 16) {
                IntegrityCard(
                    title: "Total Items",
                    value: "\(viewModel.items.count)",
                    icon: "doc.fill",
                    color: .blue
                )
                
                IntegrityCard(
                    title: "Verified",
                    value: "\(viewModel.verifiedCount)",
                    icon: "checkmark.circle.fill",
                    color: .green
                )
                
                IntegrityCard(
                    title: "Failed",
                    value: "\(viewModel.failedCount)",
                    icon: "xmark.circle.fill",
                    color: .red
                )
                
                IntegrityCard(
                    title: "Pending",
                    value: "\(viewModel.pendingCount)",
                    icon: "clock.fill",
                    color: .orange
                )
            }
            .padding()
            
            Divider()
            
            // Items List
            if viewModel.isLoading {
                Spacer()
                ProgressView("Loading items...")
                Spacer()
            } else if viewModel.items.isEmpty {
                Spacer()
                VStack(spacing: 16) {
                    Image(systemName: "checkmark.shield")
                        .font(.system(size: 48))
                        .foregroundStyle(.secondary)
                    Text("No Items to Verify")
                        .font(.headline)
                    Text("Manifests and backups will appear here for verification")
                        .foregroundStyle(.secondary)
                }
                Spacer()
            } else {
                List(viewModel.items, selection: $selectedItem) { item in
                    VerifiableItemRow(item: item, onVerify: {
                        Task { await viewModel.verifyItem(item) }
                    })
                    .tag(item)
                }
                .listStyle(.inset)
            }
        }
        .sheet(isPresented: $showManualVerifySheet) {
            ManualVerifySheet(viewModel: viewModel)
        }
        .task {
            await viewModel.loadItems()
        }
    }
}

// MARK: - Integrity Card

struct IntegrityCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Image(systemName: icon)
                    .foregroundStyle(color)
            }
            
            Text(value)
                .font(.title2)
                .fontWeight(.bold)
        }
        .padding()
        .frame(maxWidth: .infinity)
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(8)
    }
}

// MARK: - Verifiable Item Model

struct VerifiableItem: Identifiable, Hashable {
    let id: String
    let name: String
    let type: ItemType
    let path: String
    let expectedChecksum: String
    let checksumAlgorithm: ChecksumAlgorithm
    let sizeBytes: Int64
    let createdAt: Date
    var verificationStatus: VerificationStatus
    var actualChecksum: String?
    var lastVerifiedAt: Date?
    var verificationError: String?
    
    enum ItemType: String, CaseIterable {
        case manifest
        case backup
        case package
        case migration
        case config
    }
    
    enum ChecksumAlgorithm: String, CaseIterable {
        case sha256 = "SHA-256"
        case sha512 = "SHA-512"
        case md5 = "MD5"
    }
    
    enum VerificationStatus: String {
        case pending
        case verifying
        case valid
        case invalid
        case error
    }
}

// MARK: - Verifiable Item Row

struct VerifiableItemRow: View {
    let item: VerifiableItem
    let onVerify: () -> Void
    
    var body: some View {
        HStack(spacing: 16) {
            // Status Icon
            statusIcon
                .frame(width: 32)
            
            // Item Info
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(item.name)
                        .font(.system(.body, design: .monospaced))
                        .lineLimit(1)
                    
                    Spacer()
                    
                    typeBadge
                }
                
                HStack {
                    // Checksum preview
                    Text(item.expectedChecksum.prefix(16))
                        .font(.system(.caption, design: .monospaced))
                        .foregroundStyle(.secondary)
                    Text("...")
                        .foregroundStyle(.tertiary)
                    
                    Spacer()
                    
                    // Algorithm
                    Text(item.checksumAlgorithm.rawValue)
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.secondary.opacity(0.2))
                        .cornerRadius(4)
                }
                .font(.caption)
            }
            
            // Size and Actions
            VStack(alignment: .trailing, spacing: 4) {
                Text(formatBytes(item.sizeBytes))
                    .font(.caption)
                
                if item.verificationStatus == .pending {
                    Button("Verify", action: onVerify)
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                } else if item.verificationStatus == .verifying {
                    ProgressView()
                        .scaleEffect(0.7)
                }
            }
        }
        .padding(.vertical, 4)
    }
    
    @ViewBuilder
    private var statusIcon: some View {
        switch item.verificationStatus {
        case .valid:
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(.green)
                .font(.title2)
        case .invalid:
            Image(systemName: "xmark.circle.fill")
                .foregroundStyle(.red)
                .font(.title2)
        case .verifying:
            ProgressView()
                .scaleEffect(0.8)
        case .error:
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.yellow)
                .font(.title2)
        case .pending:
            Image(systemName: "circle.dashed")
                .foregroundStyle(.secondary)
                .font(.title2)
        }
    }
    
    @ViewBuilder
    private var typeBadge: some View {
        Text(item.type.rawValue.capitalized)
            .font(.caption2)
            .fontWeight(.medium)
            .padding(.horizontal, 8)
            .padding(.vertical, 2)
            .background(typeColor.opacity(0.2))
            .foregroundStyle(typeColor)
            .cornerRadius(4)
    }
    
    private var typeColor: Color {
        switch item.type {
        case .manifest: return .blue
        case .backup: return .green
        case .package: return .purple
        case .migration: return .orange
        case .config: return .cyan
        }
    }
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .binary
        return formatter.string(fromByteCount: bytes)
    }
}

// MARK: - Manual Verify Sheet

struct ManualVerifySheet: View {
    @ObservedObject var viewModel: ChecksumVerificationViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var inputChecksum = ""
    @State private var selectedAlgorithm: VerifiableItem.ChecksumAlgorithm = .sha256
    @State private var selectedFilePath = ""
    @State private var verificationResult: ManualVerificationResult?
    
    struct ManualVerificationResult {
        let isValid: Bool
        let computedChecksum: String
        let expectedChecksum: String
        let algorithm: String
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Manual Checksum Verification")
                    .font(.headline)
                Spacer()
                Button("Close") { dismiss() }
            }
            .padding()
            
            Divider()
            
            Form {
                Section {
                    HStack {
                        TextField("File Path", text: $selectedFilePath)
                            .textFieldStyle(.roundedBorder)
                        
                        Button("Browse...") {
                            let panel = NSOpenPanel()
                            panel.allowsMultipleSelection = false
                            panel.canChooseDirectories = false
                            if panel.runModal() == .OK, let url = panel.url {
                                selectedFilePath = url.path
                            }
                        }
                    }
                } header: {
                    Text("File to Verify")
                }
                
                Section {
                    Picker("Algorithm", selection: $selectedAlgorithm) {
                        ForEach(VerifiableItem.ChecksumAlgorithm.allCases, id: \.self) { algo in
                            Text(algo.rawValue).tag(algo)
                        }
                    }
                    .pickerStyle(.segmented)
                } header: {
                    Text("Checksum Algorithm")
                }
                
                Section {
                    TextField("Expected Checksum (optional)", text: $inputChecksum)
                        .textFieldStyle(.roundedBorder)
                        .font(.system(.body, design: .monospaced))
                } header: {
                    Text("Expected Checksum")
                } footer: {
                    Text("Leave empty to just compute the checksum")
                }
                
                if let result = verificationResult {
                    Section {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                if result.isValid {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(.green)
                                    Text("Checksum Valid")
                                        .foregroundStyle(.green)
                                        .fontWeight(.semibold)
                                } else if result.expectedChecksum.isEmpty {
                                    Image(systemName: "info.circle.fill")
                                        .foregroundStyle(.blue)
                                    Text("Checksum Computed")
                                        .foregroundStyle(.blue)
                                        .fontWeight(.semibold)
                                } else {
                                    Image(systemName: "xmark.circle.fill")
                                        .foregroundStyle(.red)
                                    Text("Checksum Mismatch")
                                        .foregroundStyle(.red)
                                        .fontWeight(.semibold)
                                }
                            }
                            
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Computed (\(result.algorithm)):")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Text(result.computedChecksum)
                                    .font(.system(.caption, design: .monospaced))
                                    .textSelection(.enabled)
                                    .padding(8)
                                    .background(Color(nsColor: .textBackgroundColor))
                                    .cornerRadius(4)
                            }
                            
                            if !result.expectedChecksum.isEmpty {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Expected:")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                    Text(result.expectedChecksum)
                                        .font(.system(.caption, design: .monospaced))
                                        .foregroundColor(result.isValid ? .primary : .red)
                                        .padding(8)
                                        .background(Color(nsColor: .textBackgroundColor))
                                        .cornerRadius(4)
                                }
                            }
                            
                            // Copy button
                            Button {
                                NSPasteboard.general.clearContents()
                                NSPasteboard.general.setString(result.computedChecksum, forType: .string)
                            } label: {
                                Label("Copy Checksum", systemImage: "doc.on.doc")
                            }
                            .buttonStyle(.bordered)
                        }
                    } header: {
                        Text("Result")
                    }
                }
            }
            .formStyle(.grouped)
            
            Divider()
            
            // Footer
            HStack {
                Spacer()
                Button("Verify") {
                    Task {
                        verificationResult = await viewModel.manualVerify(
                            filePath: selectedFilePath,
                            expectedChecksum: inputChecksum,
                            algorithm: selectedAlgorithm
                        )
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(selectedFilePath.isEmpty)
            }
            .padding()
        }
        .frame(width: 550, height: 550)
    }
}

// MARK: - View Model

@MainActor
class ChecksumVerificationViewModel: ObservableObject {
    @Published var items: [VerifiableItem] = []
    @Published var isLoading = false
    @Published var isVerifying = false
    
    var verifiedCount: Int {
        items.filter { $0.verificationStatus == .valid }.count
    }
    
    var failedCount: Int {
        items.filter { $0.verificationStatus == .invalid || $0.verificationStatus == .error }.count
    }
    
    var pendingCount: Int {
        items.filter { $0.verificationStatus == .pending }.count
    }
    
    func loadItems() async {
        isLoading = true
        defer { isLoading = false }
        
        // Load items from local storage and S3
        // For now, create mock data
        items = [
            VerifiableItem(
                id: "manifest-1",
                name: "manifest-prod-2026-02-04.json",
                type: .manifest,
                path: "~/Library/Application Support/RadiantDeployer/StateRegistry/manifests/manifest-prod-2026-02-04.json",
                expectedChecksum: "a3f2c8e9d1b4567890abcdef1234567890abcdef1234567890abcdef12345678",
                checksumAlgorithm: .sha256,
                sizeBytes: 245_760,
                createdAt: Date(),
                verificationStatus: .pending
            ),
            VerifiableItem(
                id: "backup-1",
                name: "backup-2026-02-04-020000.zip",
                type: .backup,
                path: "~/Library/Application Support/RadiantDeployer/StateRegistry/backups/backup-2026-02-04-020000.zip",
                expectedChecksum: "b5d4e3f2a1098765432dcba0987654321fedcba0987654321fedcba09876543",
                checksumAlgorithm: .sha256,
                sizeBytes: 52_428_800,
                createdAt: Date().addingTimeInterval(-86400),
                verificationStatus: .valid,
                actualChecksum: "b5d4e3f2a1098765432dcba0987654321fedcba0987654321fedcba09876543",
                lastVerifiedAt: Date().addingTimeInterval(-3600)
            ),
            VerifiableItem(
                id: "package-1",
                name: "radiant-7.1.0-build.1234.zip",
                type: .package,
                path: "~/Library/Application Support/RadiantDeployer/StateRegistry/packages/radiant-7.1.0-build.1234.zip",
                expectedChecksum: "c6e5f4d3b2a19087654321fedcba0987654321fedcba0987654321fedcba098",
                checksumAlgorithm: .sha256,
                sizeBytes: 524_288_000,
                createdAt: Date().addingTimeInterval(-172800),
                verificationStatus: .pending
            ),
        ]
    }
    
    func verifyItem(_ item: VerifiableItem) async {
        guard let index = items.firstIndex(where: { $0.id == item.id }) else { return }
        
        items[index].verificationStatus = .verifying
        
        // Simulate verification delay
        try? await Task.sleep(nanoseconds: 1_000_000_000)
        
        // Compute checksum
        let expandedPath = NSString(string: item.path).expandingTildeInPath
        if let data = FileManager.default.contents(atPath: expandedPath) {
            let computedChecksum = computeChecksum(data: data, algorithm: item.checksumAlgorithm)
            items[index].actualChecksum = computedChecksum
            items[index].lastVerifiedAt = Date()
            
            if computedChecksum.lowercased() == item.expectedChecksum.lowercased() {
                items[index].verificationStatus = .valid
            } else {
                items[index].verificationStatus = .invalid
            }
        } else {
            items[index].verificationStatus = .error
            items[index].verificationError = "File not found"
        }
    }
    
    func verifyAll() async {
        isVerifying = true
        defer { isVerifying = false }
        
        for item in items where item.verificationStatus == .pending {
            await verifyItem(item)
        }
    }
    
    func manualVerify(
        filePath: String,
        expectedChecksum: String,
        algorithm: VerifiableItem.ChecksumAlgorithm
    ) async -> ManualVerifySheet.ManualVerificationResult? {
        let expandedPath = NSString(string: filePath).expandingTildeInPath
        guard let data = FileManager.default.contents(atPath: expandedPath) else {
            return nil
        }
        
        let computedChecksum = computeChecksum(data: data, algorithm: algorithm)
        let isValid = expectedChecksum.isEmpty || 
                      computedChecksum.lowercased() == expectedChecksum.lowercased()
        
        return ManualVerifySheet.ManualVerificationResult(
            isValid: isValid,
            computedChecksum: computedChecksum,
            expectedChecksum: expectedChecksum,
            algorithm: algorithm.rawValue
        )
    }
    
    private func computeChecksum(data: Data, algorithm: VerifiableItem.ChecksumAlgorithm) -> String {
        switch algorithm {
        case .sha256:
            let digest = SHA256.hash(data: data)
            return digest.map { String(format: "%02x", $0) }.joined()
        case .sha512:
            let digest = SHA512.hash(data: data)
            return digest.map { String(format: "%02x", $0) }.joined()
        case .md5:
            let digest = Insecure.MD5.hash(data: data)
            return digest.map { String(format: "%02x", $0) }.joined()
        }
    }
}

#Preview {
    ChecksumVerificationView()
        .frame(width: 800, height: 600)
}
