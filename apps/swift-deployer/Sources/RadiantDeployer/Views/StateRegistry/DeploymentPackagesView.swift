import SwiftUI

// MARK: - Deployment Packages View

struct DeploymentPackagesView: View {
    @StateObject private var viewModel = DeploymentPackagesViewModel()
    @State private var selectedPackage: DeploymentPackage?
    @State private var showCreatePackageSheet = false
    @State private var showRestoreSheet = false
    
    var body: some View {
        HSplitView {
            // Package List
            VStack(spacing: 0) {
                // Header
                HStack {
                    Text("Deployment Packages")
                        .font(.headline)
                    
                    Spacer()
                    
                    Button {
                        showCreatePackageSheet = true
                    } label: {
                        Label("Create Package", systemImage: "plus.circle")
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                }
                .padding()
                
                Divider()
                
                // Filter
                HStack {
                    Picker("Environment", selection: $viewModel.selectedEnvironment) {
                        Text("All").tag(String?.none)
                        Text("Production").tag(String?.some("production"))
                        Text("Staging").tag(String?.some("staging"))
                        Text("Development").tag(String?.some("development"))
                    }
                    .pickerStyle(.menu)
                    .frame(width: 150)
                    
                    Picker("Status", selection: $viewModel.selectedStatus) {
                        Text("All").tag(String?.none)
                        Text("Complete").tag(String?.some("complete"))
                        Text("Creating").tag(String?.some("creating"))
                        Text("Failed").tag(String?.some("failed"))
                    }
                    .pickerStyle(.menu)
                    .frame(width: 120)
                    
                    Spacer()
                    
                    Button {
                        Task { await viewModel.loadPackages() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .disabled(viewModel.isLoading)
                }
                .padding(.horizontal)
                .padding(.vertical, 8)
                
                Divider()
                
                // Package List
                if viewModel.isLoading {
                    Spacer()
                    ProgressView("Loading packages...")
                    Spacer()
                } else if viewModel.filteredPackages.isEmpty {
                    Spacer()
                    VStack(spacing: 16) {
                        Image(systemName: "shippingbox")
                            .font(.system(size: 48))
                            .foregroundStyle(.secondary)
                        Text("No Packages")
                            .font(.headline)
                        Text("Create a deployment package to enable full system restore")
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    Spacer()
                } else {
                    List(viewModel.filteredPackages, selection: $selectedPackage) { pkg in
                        DeploymentPackageRow(package: pkg)
                            .tag(pkg)
                    }
                    .listStyle(.inset)
                }
            }
            .frame(minWidth: 400)
            
            // Detail View
            if let package = selectedPackage {
                DeploymentPackageDetailView(
                    package: package,
                    onRestore: {
                        showRestoreSheet = true
                    },
                    onValidate: {
                        Task { await viewModel.validatePackage(package) }
                    },
                    onDelete: {
                        Task { await viewModel.deletePackage(package) }
                    }
                )
            } else {
                VStack {
                    Image(systemName: "shippingbox")
                        .font(.system(size: 64))
                        .foregroundStyle(.tertiary)
                    Text("Select a Package")
                        .font(.headline)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .sheet(isPresented: $showCreatePackageSheet) {
            CreatePackageSheet(viewModel: viewModel)
        }
        .sheet(isPresented: $showRestoreSheet) {
            if let package = selectedPackage {
                RestorePackageSheet(package: package, viewModel: viewModel)
            }
        }
        .task {
            await viewModel.loadPackages()
        }
    }
}

// MARK: - Package Model

struct DeploymentPackage: Identifiable, Hashable {
    let id: String
    let version: String
    let packageVersion: String
    let environment: String
    let createdAt: Date
    let status: PackageStatus
    let totalSizeBytes: Int64
    let sourceType: SourceType
    let description: String?
    let restoreCount: Int
    let lastRestoredAt: Date?
    
    var contents: PackageContents
    var checksums: PackageChecksums
    var validation: PackageValidation?
    
    enum PackageStatus: String {
        case creating
        case complete
        case failed
        case expired
        case deleted
        
        var color: Color {
            switch self {
            case .creating: return .blue
            case .complete: return .green
            case .failed: return .red
            case .expired: return .orange
            case .deleted: return .gray
            }
        }
        
        var icon: String {
            switch self {
            case .creating: return "clock.arrow.circlepath"
            case .complete: return "checkmark.circle.fill"
            case .failed: return "xmark.circle.fill"
            case .expired: return "clock.badge.exclamationmark"
            case .deleted: return "trash.circle.fill"
            }
        }
    }
    
    enum SourceType: String {
        case awsCapture = "aws_capture"
        case gitBuild = "git_build"
        case manual
    }
    
    struct PackageContents: Hashable {
        var hasCdkBundle: Bool
        var hasLambdaBundle: Bool
        var hasDashboardBundle: Bool
        var hasMigrations: Bool
        var hasInfrastructureManifest: Bool
        var includesRdsData: Bool
        var includesS3Data: Bool
        var includesDynamoData: Bool
    }
    
    struct PackageChecksums: Hashable {
        var cdkBundle: String?
        var lambdaBundle: String?
        var dashboardBundle: String?
        var migrationBundle: String?
        var full: String
    }
    
    struct PackageValidation: Hashable {
        var isValid: Bool
        var canRestore: Bool
        var validatedAt: Date
        var blockers: [String]
        var warnings: [String]
        var estimatedRestoreMinutes: Int
    }
}

// MARK: - Package Row

struct DeploymentPackageRow: View {
    let package: DeploymentPackage
    
    var body: some View {
        HStack(spacing: 12) {
            // Status Icon
            Image(systemName: package.status.icon)
                .foregroundStyle(package.status.color)
                .font(.title2)
            
            // Info
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(package.packageVersion)
                        .font(.headline)
                    
                    Text(package.environment)
                        .font(.caption)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(environmentColor.opacity(0.2))
                        .foregroundStyle(environmentColor)
                        .cornerRadius(4)
                }
                
                HStack {
                    Text(package.createdAt, style: .date)
                    Text("•")
                    Text(formatBytes(package.totalSizeBytes))
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            // Restore count
            if package.restoreCount > 0 {
                VStack(alignment: .trailing) {
                    Text("\(package.restoreCount)")
                        .font(.caption)
                        .fontWeight(.semibold)
                    Text("restores")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 4)
    }
    
    private var environmentColor: Color {
        switch package.environment {
        case "production": return .red
        case "staging": return .orange
        case "development": return .blue
        default: return .secondary
        }
    }
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .binary
        return formatter.string(fromByteCount: bytes)
    }
}

// MARK: - Package Detail View

struct DeploymentPackageDetailView: View {
    let package: DeploymentPackage
    let onRestore: () -> Void
    let onValidate: () -> Void
    let onDelete: () -> Void
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Header
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(package.packageVersion)
                            .font(.title2)
                            .fontWeight(.bold)
                        
                        HStack {
                            Image(systemName: package.status.icon)
                                .foregroundStyle(package.status.color)
                            Text(package.status.rawValue.capitalized)
                                .foregroundStyle(package.status.color)
                        }
                    }
                    
                    Spacer()
                    
                    HStack(spacing: 12) {
                        if package.status == .complete {
                            Button("Validate", action: onValidate)
                                .buttonStyle(.bordered)
                            
                            Button("Restore", action: onRestore)
                                .buttonStyle(.borderedProminent)
                        }
                        
                        Button(role: .destructive, action: onDelete) {
                            Image(systemName: "trash")
                        }
                        .buttonStyle(.bordered)
                    }
                }
                
                Divider()
                
                // Metadata
                LazyVGrid(columns: [
                    GridItem(.flexible()),
                    GridItem(.flexible()),
                    GridItem(.flexible())
                ], spacing: 16) {
                    MetadataItem(label: "Environment", value: package.environment.capitalized)
                    MetadataItem(label: "RADIANT Version", value: package.version)
                    MetadataItem(label: "Size", value: formatBytes(package.totalSizeBytes))
                    MetadataItem(label: "Created", value: formatDate(package.createdAt))
                    MetadataItem(label: "Source", value: package.sourceType.rawValue.replacingOccurrences(of: "_", with: " ").capitalized)
                    MetadataItem(label: "Restore Count", value: "\(package.restoreCount)")
                }
                
                if let description = package.description {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Description")
                            .font(.headline)
                        Text(description)
                            .foregroundStyle(.secondary)
                    }
                }
                
                Divider()
                
                // Contents
                VStack(alignment: .leading, spacing: 12) {
                    Text("Package Contents")
                        .font(.headline)
                    
                    LazyVGrid(columns: [
                        GridItem(.flexible()),
                        GridItem(.flexible())
                    ], spacing: 12) {
                        ContentItem(
                            name: "CDK Infrastructure",
                            included: package.contents.hasCdkBundle,
                            icon: "server.rack"
                        )
                        ContentItem(
                            name: "Lambda Functions",
                            included: package.contents.hasLambdaBundle,
                            icon: "bolt.fill"
                        )
                        ContentItem(
                            name: "Admin Dashboard",
                            included: package.contents.hasDashboardBundle,
                            icon: "macwindow"
                        )
                        ContentItem(
                            name: "Database Migrations",
                            included: package.contents.hasMigrations,
                            icon: "arrow.up.arrow.down"
                        )
                        ContentItem(
                            name: "Infrastructure Manifest",
                            included: package.contents.hasInfrastructureManifest,
                            icon: "doc.text"
                        )
                    }
                }
                
                // Persistent Data
                VStack(alignment: .leading, spacing: 12) {
                    Text("Persistent Data")
                        .font(.headline)
                    
                    HStack(spacing: 24) {
                        DataInclusionItem(name: "RDS Data", included: package.contents.includesRdsData)
                        DataInclusionItem(name: "S3 Data", included: package.contents.includesS3Data)
                        DataInclusionItem(name: "DynamoDB Data", included: package.contents.includesDynamoData)
                    }
                }
                
                Divider()
                
                // Checksums
                VStack(alignment: .leading, spacing: 12) {
                    Text("Checksums")
                        .font(.headline)
                    
                    VStack(alignment: .leading, spacing: 8) {
                        ChecksumRow(label: "Full Package", checksum: package.checksums.full)
                        if let cdk = package.checksums.cdkBundle {
                            ChecksumRow(label: "CDK Bundle", checksum: cdk)
                        }
                        if let lambda = package.checksums.lambdaBundle {
                            ChecksumRow(label: "Lambda Bundle", checksum: lambda)
                        }
                    }
                }
                
                // Validation
                if let validation = package.validation {
                    Divider()
                    
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("Validation")
                                .font(.headline)
                            
                            Spacer()
                            
                            if validation.isValid {
                                Label("Valid", systemImage: "checkmark.circle.fill")
                                    .foregroundStyle(.green)
                            } else {
                                Label("Invalid", systemImage: "xmark.circle.fill")
                                    .foregroundStyle(.red)
                            }
                        }
                        
                        Text("Last validated: \(formatDate(validation.validatedAt))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        
                        if !validation.blockers.isEmpty {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Blockers")
                                    .font(.subheadline)
                                    .foregroundStyle(.red)
                                ForEach(validation.blockers, id: \.self) { blocker in
                                    Text("• \(blocker)")
                                        .font(.caption)
                                }
                            }
                        }
                        
                        if !validation.warnings.isEmpty {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Warnings")
                                    .font(.subheadline)
                                    .foregroundStyle(.orange)
                                ForEach(validation.warnings, id: \.self) { warning in
                                    Text("• \(warning)")
                                        .font(.caption)
                                }
                            }
                        }
                        
                        Text("Estimated restore time: ~\(validation.estimatedRestoreMinutes) minutes")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding()
        }
        .frame(minWidth: 450)
    }
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .binary
        return formatter.string(fromByteCount: bytes)
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Helper Views

struct MetadataItem: View {
    let label: String
    let value: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.body)
        }
    }
}

struct ContentItem: View {
    let name: String
    let included: Bool
    let icon: String
    
    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundStyle(included ? .blue : .secondary)
            Text(name)
            Spacer()
            Image(systemName: included ? "checkmark.circle.fill" : "xmark.circle")
                .foregroundStyle(included ? .green : .secondary)
        }
        .padding(12)
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(8)
    }
}

struct DataInclusionItem: View {
    let name: String
    let included: Bool
    
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: included ? "checkmark.circle.fill" : "circle.dashed")
                .foregroundStyle(included ? .green : .secondary)
            Text(name)
                .font(.subheadline)
        }
    }
}

struct ChecksumRow: View {
    let label: String
    let checksum: String
    
    var body: some View {
        HStack {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(width: 120, alignment: .leading)
            
            Text(checksum.prefix(24))
                .font(.system(.caption, design: .monospaced))
            Text("...")
                .foregroundStyle(.tertiary)
            
            Spacer()
            
            Button {
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(checksum, forType: .string)
            } label: {
                Image(systemName: "doc.on.doc")
            }
            .buttonStyle(.plain)
        }
    }
}

// MARK: - Create Package Sheet

struct CreatePackageSheet: View {
    @ObservedObject var viewModel: DeploymentPackagesViewModel
    @Environment(\.dismiss) private var dismiss
    
    @State private var environment = "production"
    @State private var description = ""
    @State private var sourceType = "aws_capture"
    
    @State private var includeCdk = true
    @State private var includeLambdas = true
    @State private var includeDashboard = true
    @State private var includeMigrations = true
    
    @State private var includeRdsData = false
    @State private var includeS3Data = false
    @State private var includeDynamoData = false
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Create Deployment Package")
                    .font(.headline)
                Spacer()
                Button("Cancel") { dismiss() }
            }
            .padding()
            
            Divider()
            
            Form {
                Section {
                    Picker("Environment", selection: $environment) {
                        Text("Production").tag("production")
                        Text("Staging").tag("staging")
                        Text("Development").tag("development")
                    }
                    
                    Picker("Source", selection: $sourceType) {
                        Text("Capture from AWS").tag("aws_capture")
                        Text("Build from Git").tag("git_build")
                    }
                    
                    TextField("Description (optional)", text: $description)
                } header: {
                    Text("Basic Info")
                }
                
                Section {
                    Toggle("CDK Infrastructure", isOn: $includeCdk)
                    Toggle("Lambda Functions", isOn: $includeLambdas)
                    Toggle("Admin Dashboard", isOn: $includeDashboard)
                    Toggle("Database Migrations", isOn: $includeMigrations)
                } header: {
                    Text("Code & Infrastructure")
                } footer: {
                    Text("All selected components will be captured and packaged")
                }
                
                Section {
                    Toggle("Aurora PostgreSQL Data", isOn: $includeRdsData)
                    Toggle("S3 Bucket Data", isOn: $includeS3Data)
                    Toggle("DynamoDB Data", isOn: $includeDynamoData)
                } header: {
                    Text("Persistent Data (Optional)")
                } footer: {
                    Text("⚠️ Including data significantly increases package size and creation time")
                }
            }
            .formStyle(.grouped)
            
            Divider()
            
            // Footer
            HStack {
                if viewModel.isCreating {
                    ProgressView()
                        .scaleEffect(0.8)
                    Text("Creating package...")
                        .foregroundStyle(.secondary)
                }
                
                Spacer()
                
                Button("Create Package") {
                    Task {
                        await viewModel.createPackage(
                            environment: environment,
                            description: description.isEmpty ? nil : description,
                            sourceType: sourceType,
                            includeCdk: includeCdk,
                            includeLambdas: includeLambdas,
                            includeDashboard: includeDashboard,
                            includeMigrations: includeMigrations,
                            includeRdsData: includeRdsData,
                            includeS3Data: includeS3Data,
                            includeDynamoData: includeDynamoData
                        )
                        dismiss()
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(viewModel.isCreating)
            }
            .padding()
        }
        .frame(width: 500, height: 550)
    }
}

// MARK: - Restore Package Sheet

struct RestorePackageSheet: View {
    let package: DeploymentPackage
    @ObservedObject var viewModel: DeploymentPackagesViewModel
    @Environment(\.dismiss) private var dismiss
    
    @State private var targetEnvironment = "staging"
    @State private var restoreCdk = true
    @State private var restoreLambdas = true
    @State private var restoreDashboard = true
    @State private var runMigrations = true
    @State private var restoreRdsData = false
    @State private var restoreS3Data = false
    @State private var restoreDynamoData = false
    @State private var validateBeforeRestore = true
    @State private var dryRun = false
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Restore from Package")
                    .font(.headline)
                Spacer()
                Button("Cancel") { dismiss() }
            }
            .padding()
            
            Divider()
            
            Form {
                Section {
                    Text(package.packageVersion)
                        .font(.headline)
                    Text("Created \(package.createdAt, style: .date)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } header: {
                    Text("Source Package")
                }
                
                Section {
                    Picker("Target Environment", selection: $targetEnvironment) {
                        Text("Production").tag("production")
                        Text("Staging").tag("staging")
                        Text("Development").tag("development")
                    }
                    
                    if package.environment != targetEnvironment {
                        Label("Cross-environment restore", systemImage: "exclamationmark.triangle")
                            .foregroundStyle(.orange)
                            .font(.caption)
                    }
                } header: {
                    Text("Target")
                }
                
                Section {
                    Toggle("CDK Infrastructure", isOn: $restoreCdk)
                        .disabled(!package.contents.hasCdkBundle)
                    Toggle("Lambda Functions", isOn: $restoreLambdas)
                        .disabled(!package.contents.hasLambdaBundle)
                    Toggle("Admin Dashboard", isOn: $restoreDashboard)
                        .disabled(!package.contents.hasDashboardBundle)
                    Toggle("Run Migrations", isOn: $runMigrations)
                        .disabled(!package.contents.hasMigrations)
                } header: {
                    Text("Components to Restore")
                }
                
                if package.contents.includesRdsData || package.contents.includesS3Data || package.contents.includesDynamoData {
                    Section {
                        if package.contents.includesRdsData {
                            Toggle("Aurora PostgreSQL Data", isOn: $restoreRdsData)
                        }
                        if package.contents.includesS3Data {
                            Toggle("S3 Bucket Data", isOn: $restoreS3Data)
                        }
                        if package.contents.includesDynamoData {
                            Toggle("DynamoDB Data", isOn: $restoreDynamoData)
                        }
                    } header: {
                        Text("Data to Restore")
                    } footer: {
                        Text("⚠️ Data restore may take 15-30+ minutes")
                    }
                }
                
                Section {
                    Toggle("Validate before restore", isOn: $validateBeforeRestore)
                    Toggle("Dry run (preview only)", isOn: $dryRun)
                } header: {
                    Text("Options")
                }
            }
            .formStyle(.grouped)
            
            Divider()
            
            // Footer
            HStack {
                if viewModel.isRestoring {
                    ProgressView()
                        .scaleEffect(0.8)
                    Text("Restoring...")
                        .foregroundStyle(.secondary)
                }
                
                Spacer()
                
                Button(dryRun ? "Preview Restore" : "Start Restore") {
                    Task {
                        await viewModel.restorePackage(
                            package,
                            targetEnvironment: targetEnvironment,
                            restoreCdk: restoreCdk,
                            restoreLambdas: restoreLambdas,
                            restoreDashboard: restoreDashboard,
                            runMigrations: runMigrations,
                            restoreRdsData: restoreRdsData,
                            restoreS3Data: restoreS3Data,
                            restoreDynamoData: restoreDynamoData,
                            validateBeforeRestore: validateBeforeRestore,
                            dryRun: dryRun
                        )
                        if !dryRun {
                            dismiss()
                        }
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(viewModel.isRestoring)
            }
            .padding()
        }
        .frame(width: 500, height: 600)
    }
}

// MARK: - View Model

@MainActor
class DeploymentPackagesViewModel: ObservableObject {
    @Published var packages: [DeploymentPackage] = []
    @Published var isLoading = false
    @Published var isCreating = false
    @Published var isRestoring = false
    @Published var selectedEnvironment: String?
    @Published var selectedStatus: String?
    
    var filteredPackages: [DeploymentPackage] {
        packages.filter { pkg in
            if let env = selectedEnvironment, pkg.environment != env { return false }
            if let status = selectedStatus, pkg.status.rawValue != status { return false }
            return true
        }
    }
    
    private let packageService = PackageService()
    
    func loadPackages() async {
        isLoading = true
        defer { isLoading = false }
        
        do {
            let available = try await packageService.listAvailablePackages(forceRefresh: true)
            packages = available.map { info in
                DeploymentPackage(
                    id: info.id,
                    version: info.version,
                    packageVersion: "\(info.version)-\(info.buildId)",
                    environment: "production",
                    createdAt: info.buildTimestamp,
                    status: .complete,
                    totalSizeBytes: info.size,
                    sourceType: .awsCapture,
                    description: info.displayName,
                    restoreCount: 0,
                    lastRestoredAt: nil,
                    contents: .init(
                        hasCdkBundle: true,
                        hasLambdaBundle: true,
                        hasDashboardBundle: true,
                        hasMigrations: true,
                        hasInfrastructureManifest: true,
                        includesRdsData: false,
                        includesS3Data: false,
                        includesDynamoData: false
                    ),
                    checksums: .init(
                        cdkBundle: info.packageHash,
                        lambdaBundle: info.packageHash,
                        dashboardBundle: info.packageHash,
                        migrationBundle: info.packageHash,
                        full: info.packageHash
                    ),
                    validation: nil
                )
            }
        } catch {
            // Fallback to empty list on error
            packages = []
        }
        
        // Legacy mock data kept as reference for structure:
        let _ = [
            DeploymentPackage(
                id: "pkg-1",
                version: "7.1.0",
                packageVersion: "7.1.0-build.1234",
                environment: "production",
                createdAt: Date(),
                status: .complete,
                totalSizeBytes: 524_288_000,
                sourceType: .awsCapture,
                description: "Daily backup package",
                restoreCount: 0,
                lastRestoredAt: nil,
                contents: .init(
                    hasCdkBundle: true,
                    hasLambdaBundle: true,
                    hasDashboardBundle: true,
                    hasMigrations: true,
                    hasInfrastructureManifest: true,
                    includesRdsData: false,
                    includesS3Data: false,
                    includesDynamoData: false
                ),
                checksums: .init(
                    cdkBundle: "a3f2c8e9d1b4567890abcdef1234567890abcdef",
                    lambdaBundle: "b5d4e3f2a1098765432dcba0987654321fedcba",
                    dashboardBundle: "c6e5f4d3b2a19087654321fedcba0987654321",
                    migrationBundle: "d7f6e5d4c3b2a1908765432fedcba0987654321",
                    full: "e8g7f6e5d4c3b2a19087654321fedcba09876543"
                ),
                validation: nil
            ),
            DeploymentPackage(
                id: "pkg-2",
                version: "7.0.0",
                packageVersion: "7.0.0-build.1100",
                environment: "production",
                createdAt: Date().addingTimeInterval(-86400 * 7),
                status: .complete,
                totalSizeBytes: 1_524_288_000,
                sourceType: .awsCapture,
                description: "Weekly full backup with data",
                restoreCount: 1,
                lastRestoredAt: Date().addingTimeInterval(-86400 * 2),
                contents: .init(
                    hasCdkBundle: true,
                    hasLambdaBundle: true,
                    hasDashboardBundle: true,
                    hasMigrations: true,
                    hasInfrastructureManifest: true,
                    includesRdsData: true,
                    includesS3Data: true,
                    includesDynamoData: true
                ),
                checksums: .init(
                    cdkBundle: "f9h8g7f6e5d4c3b2a19087654321fedcba098765",
                    lambdaBundle: "g0i9h8g7f6e5d4c3b2a1908765432fedcba09876",
                    dashboardBundle: "h1j0i9h8g7f6e5d4c3b2a19087654321fedcba09",
                    migrationBundle: "i2k1j0i9h8g7f6e5d4c3b2a1908765432fedcba",
                    full: "j3l2k1j0i9h8g7f6e5d4c3b2a19087654321fedc"
                ),
                validation: .init(
                    isValid: true,
                    canRestore: true,
                    validatedAt: Date().addingTimeInterval(-3600),
                    blockers: [],
                    warnings: ["Package is 7 days old"],
                    estimatedRestoreMinutes: 35
                )
            ),
        ]
    }
    
    func createPackage(
        environment: String,
        description: String?,
        sourceType: String,
        includeCdk: Bool,
        includeLambdas: Bool,
        includeDashboard: Bool,
        includeMigrations: Bool,
        includeRdsData: Bool,
        includeS3Data: Bool,
        includeDynamoData: Bool
    ) async {
        isCreating = true
        defer { isCreating = false }
        
        do {
            let latest = try await packageService.getLatestStable()
            _ = try await packageService.downloadAndVerify(latest)
        } catch {
            // Log error but don't crash
            print("[DeploymentPackages] Package creation failed: \(error.localizedDescription)")
        }
        await loadPackages()
    }
    
    func validatePackage(_ package: DeploymentPackage) async {
        guard let index = packages.firstIndex(where: { $0.id == package.id }) else { return }
        
        do {
            let isValid = try await packageService.verifyPackageIntegrity(packageHash: package.checksums.full)
            packages[index].validation = DeploymentPackage.PackageValidation(
                isValid: isValid,
                canRestore: isValid,
                validatedAt: Date(),
                blockers: isValid ? [] : ["Integrity check failed"],
                warnings: [],
                estimatedRestoreMinutes: 25
            )
        } catch {
            packages[index].validation = DeploymentPackage.PackageValidation(
                isValid: false,
                canRestore: false,
                validatedAt: Date(),
                blockers: [error.localizedDescription],
                warnings: [],
                estimatedRestoreMinutes: 0
            )
        }
    }
    
    func restorePackage(
        _ package: DeploymentPackage,
        targetEnvironment: String,
        restoreCdk: Bool,
        restoreLambdas: Bool,
        restoreDashboard: Bool,
        runMigrations: Bool,
        restoreRdsData: Bool,
        restoreS3Data: Bool,
        restoreDynamoData: Bool,
        validateBeforeRestore: Bool,
        dryRun: Bool
    ) async {
        isRestoring = true
        defer { isRestoring = false }
        
        do {
            let packageInfo = PackageInfo(
                version: package.version,
                buildId: package.packageVersion,
                buildTimestamp: package.createdAt,
                packageHash: package.checksums.full,
                filename: "\(package.id).tar.gz",
                size: package.totalSizeBytes,
                channel: .stable,
                bucket: "",
                key: ""
            )
            _ = try await packageService.downloadAndVerify(packageInfo)
        } catch {
            print("[DeploymentPackages] Restore failed: \(error.localizedDescription)")
        }
    }
    
    func deletePackage(_ package: DeploymentPackage) async {
        guard let index = packages.firstIndex(where: { $0.id == package.id }) else { return }
        packages.remove(at: index)
        
        do {
            try await packageService.removeFromCache(version: package.version)
        } catch {
            print("[DeploymentPackages] Delete from cache failed: \(error.localizedDescription)")
        }
    }
}

#Preview {
    DeploymentPackagesView()
        .frame(width: 1000, height: 700)
}
