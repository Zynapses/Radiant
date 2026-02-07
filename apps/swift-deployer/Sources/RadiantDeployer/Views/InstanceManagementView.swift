// RADIANT v7.0.0 - Instance Management View
// Start/Stop/Wipe controls for each deployment environment (dev, staging, prod)

import SwiftUI

struct InstanceManagementView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var instanceService = InstanceManagementService()
    @State private var showWipeConfirmation = false
    @State private var wipeTarget: DeployEnvironment?
    @State private var wipeOptions = WipeOptions()
    
    var body: some View {
        ScrollView {
            VStack(spacing: RadiantSpacing.xl) {
                // Header
                InstanceManagementHeader()
                
                // Three environment panels
                HStack(alignment: .top, spacing: RadiantSpacing.lg) {
                    InstancePanel(
                        environment: .dev,
                        status: instanceService.devStatus,
                        onStart: { await instanceService.startInstance(.dev) },
                        onStop: { await instanceService.stopInstance(.dev) },
                        onWipe: { wipeTarget = .dev; showWipeConfirmation = true }
                    )
                    
                    InstancePanel(
                        environment: .staging,
                        status: instanceService.stagingStatus,
                        onStart: { await instanceService.startInstance(.staging) },
                        onStop: { await instanceService.stopInstance(.staging) },
                        onWipe: { wipeTarget = .staging; showWipeConfirmation = true }
                    )
                    
                    InstancePanel(
                        environment: .prod,
                        status: instanceService.prodStatus,
                        onStart: { await instanceService.startInstance(.prod) },
                        onStop: { await instanceService.stopInstance(.prod) },
                        onWipe: { wipeTarget = .prod; showWipeConfirmation = true }
                    )
                }
                
                // Global actions
                GlobalInstanceActions(instanceService: instanceService)
                
                // Resource inventory
                ResourceInventorySection(instanceService: instanceService)
            }
            .padding(RadiantSpacing.xl)
        }
        .background(Color(nsColor: .windowBackgroundColor))
        .navigationTitle("Instance Management")
        .task {
            await instanceService.loadAllStatus()
        }
        .sheet(isPresented: $showWipeConfirmation) {
            if let target = wipeTarget {
                WipeConfirmationSheet(
                    environment: target,
                    options: $wipeOptions,
                    instanceService: instanceService,
                    onConfirm: {
                        Task {
                            await instanceService.wipeInstance(target, options: wipeOptions)
                        }
                    }
                )
            }
        }
    }
}

// MARK: - Header

struct InstanceManagementHeader: View {
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: RadiantSpacing.xs) {
                Text("Instance Management")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                Text("Start, stop, or completely reset your deployment environments")
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            HStack(spacing: RadiantSpacing.md) {
                Button {
                    // Refresh all status
                } label: {
                    Label("Refresh", systemImage: "arrow.clockwise")
                }
                
                Button {
                    // View cost breakdown
                } label: {
                    Label("Costs", systemImage: "dollarsign.circle")
                }
            }
        }
    }
}

// MARK: - Instance Panel

struct InstancePanel: View {
    let environment: DeployEnvironment
    let status: InstanceStatus
    let onStart: () async -> Void
    let onStop: () async -> Void
    let onWipe: () -> Void
    
    @State private var isStarting = false
    @State private var isStopping = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: RadiantSpacing.md) {
            // Header with status
            HStack {
                Circle()
                    .fill(status.overallHealth.color)
                    .frame(width: 12, height: 12)
                
                Text(environment.rawValue)
                    .font(.headline)
                
                Spacer()
                
                StatusBadge(status: status.overallHealth)
            }
            
            Divider()
            
            // Service status grid
            VStack(alignment: .leading, spacing: RadiantSpacing.sm) {
                Text("Services")
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundStyle(.secondary)
                
                ServiceStatusGrid(services: status.services)
            }
            
            // Resource counts
            VStack(alignment: .leading, spacing: RadiantSpacing.xs) {
                Text("Resources")
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundStyle(.secondary)
                
                HStack(spacing: RadiantSpacing.lg) {
                    ResourceCount(label: "Lambdas", count: status.lambdaCount, icon: "function")
                    ResourceCount(label: "Tables", count: status.tableCount, icon: "tablecells")
                    ResourceCount(label: "Buckets", count: status.bucketCount, icon: "externaldrive")
                }
            }
            
            // Monthly cost estimate
            HStack {
                Text("Est. Cost")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Text("$\(String(format: "%.2f", status.estimatedMonthlyCost))/mo")
                    .font(.caption)
                    .fontWeight(.medium)
            }
            
            Divider()
            
            // Action buttons
            VStack(spacing: RadiantSpacing.sm) {
                // Start/Stop buttons
                HStack(spacing: RadiantSpacing.sm) {
                    Button {
                        Task {
                            isStarting = true
                            await onStart()
                            isStarting = false
                        }
                    } label: {
                        if isStarting {
                            ProgressView()
                                .controlSize(.small)
                        } else {
                            Label("Start All", systemImage: "play.fill")
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.green)
                    .disabled(status.overallHealth == .running || isStarting || isStopping)
                    .frame(maxWidth: .infinity)
                    
                    Button {
                        Task {
                            isStopping = true
                            await onStop()
                            isStopping = false
                        }
                    } label: {
                        if isStopping {
                            ProgressView()
                                .controlSize(.small)
                        } else {
                            Label("Stop All", systemImage: "stop.fill")
                        }
                    }
                    .buttonStyle(.bordered)
                    .disabled(status.overallHealth == .stopped || isStarting || isStopping)
                    .frame(maxWidth: .infinity)
                }
                
                // Wipe button (dangerous)
                Button(role: .destructive) {
                    onWipe()
                } label: {
                    Label("Wipe Instance", systemImage: "trash.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .tint(.red)
            }
        }
        .padding(RadiantSpacing.lg)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: RadiantRadius.lg)
                .stroke(environment.color.opacity(0.3), lineWidth: 2)
        )
    }
}

struct StatusBadge: View {
    let status: InstanceHealth
    
    var body: some View {
        Text(status.rawValue)
            .font(.caption)
            .fontWeight(.medium)
            .padding(.horizontal, RadiantSpacing.sm)
            .padding(.vertical, 2)
            .background(status.color.opacity(0.2))
            .foregroundStyle(status.color)
            .clipShape(Capsule())
    }
}

struct ServiceStatusGrid: View {
    let services: [ServiceStatus]
    
    let columns = [
        GridItem(.flexible()),
        GridItem(.flexible())
    ]
    
    var body: some View {
        LazyVGrid(columns: columns, spacing: RadiantSpacing.xs) {
            ForEach(services) { service in
                HStack(spacing: 4) {
                    Circle()
                        .fill(service.isRunning ? Color.green : Color.gray)
                        .frame(width: 6, height: 6)
                    
                    Text(service.name)
                        .font(.caption2)
                        .lineLimit(1)
                    
                    Spacer()
                }
            }
        }
    }
}

struct ResourceCount: View {
    let label: String
    let count: Int
    let icon: String
    
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption2)
                .foregroundStyle(.secondary)
            
            Text("\(count)")
                .font(.caption)
                .fontWeight(.medium)
        }
    }
}

// MARK: - Wipe Confirmation Sheet (Double Warning)

struct WipeConfirmationSheet: View {
    let environment: DeployEnvironment
    @Binding var options: WipeOptions
    @ObservedObject var instanceService: InstanceManagementService
    let onConfirm: () -> Void
    
    @Environment(\.dismiss) var dismiss
    @State private var confirmationStep = 1
    @State private var typedConfirmation = ""
    @State private var isWiping = false
    
    private var requiredConfirmation: String {
        "WIPE \(environment.shortName)"
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Header with warning
            HStack {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.title)
                    .foregroundStyle(.red)
                
                Text("Wipe \(environment.rawValue) Instance")
                    .font(.headline)
                
                Spacer()
                
                Button("Cancel") { dismiss() }
            }
            .padding()
            .background(Color.red.opacity(0.1))
            
            Divider()
            
            if confirmationStep == 1 {
                // Step 1: Warning and options
                WipeStep1View(
                    environment: environment,
                    options: $options,
                    onContinue: { confirmationStep = 2 }
                )
            } else {
                // Step 2: Final confirmation
                WipeStep2View(
                    environment: environment,
                    options: options,
                    typedConfirmation: $typedConfirmation,
                    requiredConfirmation: requiredConfirmation,
                    isWiping: isWiping,
                    onConfirm: {
                        isWiping = true
                        onConfirm()
                        dismiss()
                    },
                    onBack: { confirmationStep = 1 }
                )
            }
        }
        .frame(width: 550, height: 600)
    }
}

struct WipeStep1View: View {
    let environment: DeployEnvironment
    @Binding var options: WipeOptions
    let onContinue: () -> Void
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: RadiantSpacing.lg) {
                // Warning message
                VStack(alignment: .leading, spacing: RadiantSpacing.sm) {
                    Text("⚠️ This action is irreversible!")
                        .font(.headline)
                        .foregroundStyle(.red)
                    
                    Text("This will delete ALL resources in the \(environment.rawValue) environment. This includes:")
                        .foregroundStyle(.secondary)
                    
                    VStack(alignment: .leading, spacing: RadiantSpacing.xs) {
                        WipeItemRow(icon: "function", text: "All Lambda functions and layers")
                        WipeItemRow(icon: "tablecells", text: "All DynamoDB tables and data")
                        WipeItemRow(icon: "cylinder", text: "Aurora database cluster and all data")
                        WipeItemRow(icon: "externaldrive", text: "All S3 buckets and objects")
                        WipeItemRow(icon: "key", text: "All Secrets Manager secrets")
                        WipeItemRow(icon: "network", text: "API Gateway and WebSocket endpoints")
                        WipeItemRow(icon: "cloud", text: "CloudFront distributions")
                        WipeItemRow(icon: "person.badge.key", text: "IAM roles and policies")
                        WipeItemRow(icon: "bell", text: "SNS topics and SQS queues")
                        WipeItemRow(icon: "chart.line.uptrend.xyaxis", text: "CloudWatch logs, dashboards, alarms")
                    }
                    .padding(.leading, RadiantSpacing.md)
                }
                
                Divider()
                
                // Preservation options
                VStack(alignment: .leading, spacing: RadiantSpacing.md) {
                    Text("What to Preserve")
                        .font(.headline)
                    
                    Text("Select configurations you want to keep after the wipe:")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    
                    VStack(alignment: .leading, spacing: RadiantSpacing.sm) {
                        PreserveOption(
                            title: "Domain & DNS Configuration",
                            description: "Keep Route53 hosted zone and DNS records",
                            icon: "globe",
                            isSelected: $options.preserveDNS
                        )
                        
                        PreserveOption(
                            title: "SSL Certificates",
                            description: "Keep ACM certificates (avoids re-validation)",
                            icon: "lock.shield",
                            isSelected: $options.preserveCertificates
                        )
                        
                        PreserveOption(
                            title: "SES Email Configuration",
                            description: "Keep verified email domain and DKIM",
                            icon: "envelope",
                            isSelected: $options.preserveSES
                        )
                        
                        PreserveOption(
                            title: "VPC & Networking",
                            description: "Keep VPC, subnets, security groups",
                            icon: "network",
                            isSelected: $options.preserveVPC
                        )
                        
                        PreserveOption(
                            title: "CloudWatch Log Groups",
                            description: "Keep log groups (logs will be deleted)",
                            icon: "doc.text",
                            isSelected: $options.preserveLogGroups
                        )
                        
                        PreserveOption(
                            title: "KMS Encryption Keys",
                            description: "Keep encryption keys (required for backups)",
                            icon: "key.fill",
                            isSelected: $options.preserveKMSKeys
                        )
                    }
                }
                
                Divider()
                
                // Additional options
                VStack(alignment: .leading, spacing: RadiantSpacing.md) {
                    Text("Additional Options")
                        .font(.headline)
                    
                    Toggle(isOn: $options.createBackupFirst) {
                        VStack(alignment: .leading) {
                            Text("Create backup before wipe")
                                .font(.body)
                            Text("Snapshot database and export critical data")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    
                    Toggle(isOn: $options.deleteCloudFormationStacks) {
                        VStack(alignment: .leading) {
                            Text("Delete CloudFormation stacks")
                                .font(.body)
                            Text("Clean deletion via CDK (recommended)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    
                    Toggle(isOn: $options.forceDeleteOrphanedResources) {
                        VStack(alignment: .leading) {
                            Text("Force delete orphaned resources")
                                .font(.body)
                            Text("Delete resources not in CloudFormation (manual creates)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .padding(RadiantSpacing.lg)
        }
        
        Divider()
        
        // Footer
        HStack {
            Spacer()
            
            Button("Continue to Confirmation") {
                onContinue()
            }
            .buttonStyle(.borderedProminent)
            .tint(.red)
        }
        .padding()
    }
}

struct WipeItemRow: View {
    let icon: String
    let text: String
    
    var body: some View {
        HStack(spacing: RadiantSpacing.sm) {
            Image(systemName: icon)
                .foregroundStyle(.red)
                .frame(width: 20)
            
            Text(text)
                .font(.caption)
        }
    }
}

struct PreserveOption: View {
    let title: String
    let description: String
    let icon: String
    @Binding var isSelected: Bool
    
    var body: some View {
        Button {
            isSelected.toggle()
        } label: {
            HStack(spacing: RadiantSpacing.md) {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(isSelected ? .green : .secondary)
                    .font(.title3)
                
                Image(systemName: icon)
                    .foregroundStyle(.secondary)
                    .frame(width: 24)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.body)
                        .foregroundStyle(.primary)
                    
                    Text(description)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                Spacer()
            }
            .padding(RadiantSpacing.sm)
            .background(isSelected ? Color.green.opacity(0.1) : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.md))
        }
        .buttonStyle(.plain)
    }
}

struct WipeStep2View: View {
    let environment: DeployEnvironment
    let options: WipeOptions
    @Binding var typedConfirmation: String
    let requiredConfirmation: String
    let isWiping: Bool
    let onConfirm: () -> Void
    let onBack: () -> Void
    
    private var isConfirmationValid: Bool {
        typedConfirmation == requiredConfirmation
    }
    
    var body: some View {
        VStack(spacing: RadiantSpacing.lg) {
            Spacer()
            
            // Big warning icon
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 64))
                .foregroundStyle(.red)
            
            Text("Final Confirmation")
                .font(.title)
                .fontWeight(.bold)
            
            // Summary of what will happen
            VStack(alignment: .leading, spacing: RadiantSpacing.sm) {
                Text("You are about to wipe the **\(environment.rawValue)** instance.")
                
                if options.hasPreservations {
                    Text("The following will be **preserved**:")
                        .padding(.top, RadiantSpacing.sm)
                    
                    VStack(alignment: .leading, spacing: 4) {
                        if options.preserveDNS { PreservationItem(text: "DNS Configuration") }
                        if options.preserveCertificates { PreservationItem(text: "SSL Certificates") }
                        if options.preserveSES { PreservationItem(text: "SES Email") }
                        if options.preserveVPC { PreservationItem(text: "VPC & Networking") }
                        if options.preserveLogGroups { PreservationItem(text: "CloudWatch Log Groups") }
                        if options.preserveKMSKeys { PreservationItem(text: "KMS Keys") }
                    }
                    .padding(.leading, RadiantSpacing.md)
                }
                
                if options.createBackupFirst {
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                        Text("Backup will be created first")
                    }
                    .padding(.top, RadiantSpacing.sm)
                }
            }
            .padding()
            .background(Color(nsColor: .controlBackgroundColor))
            .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.md))
            
            // Type to confirm
            VStack(spacing: RadiantSpacing.sm) {
                Text("Type **\(requiredConfirmation)** to confirm:")
                    .font(.body)
                
                TextField("", text: $typedConfirmation)
                    .textFieldStyle(.roundedBorder)
                    .font(.system(.body, design: .monospaced))
                    .frame(width: 200)
                    .multilineTextAlignment(.center)
                
                if !typedConfirmation.isEmpty && !isConfirmationValid {
                    Text("Doesn't match")
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }
            
            Spacer()
            
            Divider()
            
            // Action buttons
            HStack {
                Button("Back") {
                    onBack()
                }
                
                Spacer()
                
                Button {
                    onConfirm()
                } label: {
                    if isWiping {
                        HStack {
                            ProgressView()
                                .controlSize(.small)
                            Text("Wiping...")
                        }
                    } else {
                        Label("Wipe Instance", systemImage: "trash.fill")
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(.red)
                .disabled(!isConfirmationValid || isWiping)
            }
            .padding()
        }
        .padding(RadiantSpacing.lg)
    }
}

struct PreservationItem: View {
    let text: String
    
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "checkmark")
                .foregroundStyle(.green)
                .font(.caption)
            Text(text)
                .font(.caption)
        }
    }
}

// MARK: - Global Instance Actions

struct GlobalInstanceActions: View {
    @ObservedObject var instanceService: InstanceManagementService
    
    var body: some View {
        VStack(alignment: .leading, spacing: RadiantSpacing.md) {
            Text("Bulk Actions")
                .font(.headline)
            
            HStack(spacing: RadiantSpacing.md) {
                Button {
                    Task { await instanceService.stopAllNonProd() }
                } label: {
                    Label("Stop Dev & Staging", systemImage: "stop.circle")
                }
                .help("Stop all non-production environments to save costs")
                
                Button {
                    Task { await instanceService.startAllNonProd() }
                } label: {
                    Label("Start Dev & Staging", systemImage: "play.circle")
                }
                
                Spacer()
                
                Menu {
                    Button("Export All Configurations") { }
                    Button("Import Configurations") { }
                    Divider()
                    Button("View AWS Console") { }
                } label: {
                    Label("More", systemImage: "ellipsis.circle")
                }
            }
        }
        .padding(RadiantSpacing.lg)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.lg))
    }
}

// MARK: - Resource Inventory Section

struct ResourceInventorySection: View {
    @ObservedObject var instanceService: InstanceManagementService
    @State private var selectedEnvironment: DeployEnvironment = .dev
    
    var body: some View {
        VStack(alignment: .leading, spacing: RadiantSpacing.md) {
            HStack {
                Text("Resource Inventory")
                    .font(.headline)
                
                Spacer()
                
                Picker("Environment", selection: $selectedEnvironment) {
                    ForEach(DeployEnvironment.allCases) { env in
                        Text(env.shortName).tag(env)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 250)
            }
            
            // Resource table
            ResourceInventoryTable(
                resources: instanceService.getResources(for: selectedEnvironment)
            )
        }
        .padding(RadiantSpacing.lg)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.lg))
    }
}

struct ResourceInventoryTable: View {
    let resources: [AWSResource]
    
    var body: some View {
        if resources.isEmpty {
            HStack {
                Spacer()
                VStack(spacing: RadiantSpacing.md) {
                    Image(systemName: "cube.transparent")
                        .font(.largeTitle)
                        .foregroundStyle(.secondary)
                    Text("No resources found")
                        .foregroundStyle(.secondary)
                }
                .padding(RadiantSpacing.xl)
                Spacer()
            }
        } else {
            Table(resources) {
                TableColumn("Type") { resource in
                    HStack(spacing: RadiantSpacing.xs) {
                        Image(systemName: resource.icon)
                            .foregroundStyle(resource.typeColor)
                        Text(resource.type)
                    }
                }
                .width(min: 120, ideal: 150)
                
                TableColumn("Name") { resource in
                    Text(resource.name)
                        .lineLimit(1)
                }
                .width(min: 200, ideal: 300)
                
                TableColumn("Status") { resource in
                    HStack(spacing: 4) {
                        Circle()
                            .fill(resource.isRunning ? Color.green : Color.gray)
                            .frame(width: 8, height: 8)
                        Text(resource.isRunning ? "Running" : "Stopped")
                    }
                    .font(.caption)
                }
                .width(min: 80, ideal: 100)
                
                TableColumn("Cost") { resource in
                    Text(resource.monthlyCost > 0 ? "$\(String(format: "%.2f", resource.monthlyCost))/mo" : "—")
                        .font(.caption)
                }
                .width(min: 80, ideal: 100)
                
                TableColumn("Source") { resource in
                    Text(resource.source)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .width(min: 100, ideal: 120)
            }
            .tableStyle(.bordered)
            .frame(height: 300)
        }
    }
}

// MARK: - Models

struct WipeOptions: Sendable {
    var preserveDNS = true
    var preserveCertificates = true
    var preserveSES = true
    var preserveVPC = false
    var preserveLogGroups = false
    var preserveKMSKeys = true
    var createBackupFirst = true
    var deleteCloudFormationStacks = true
    var forceDeleteOrphanedResources = true
    
    var hasPreservations: Bool {
        preserveDNS || preserveCertificates || preserveSES || preserveVPC || preserveLogGroups || preserveKMSKeys
    }
}

enum InstanceHealth: String, Sendable {
    case running = "Running"
    case stopped = "Stopped"
    case partial = "Partial"
    case degraded = "Degraded"
    case unknown = "Unknown"
    
    var color: Color {
        switch self {
        case .running: return .green
        case .stopped: return .gray
        case .partial: return .orange
        case .degraded: return .red
        case .unknown: return .secondary
        }
    }
}

struct InstanceStatus: Sendable {
    let environment: DeployEnvironment
    let overallHealth: InstanceHealth
    let services: [ServiceStatus]
    let lambdaCount: Int
    let tableCount: Int
    let bucketCount: Int
    let estimatedMonthlyCost: Double
}

struct ServiceStatus: Identifiable, Sendable {
    let id = UUID()
    let name: String
    let isRunning: Bool
}

struct AWSResource: Identifiable, Sendable {
    let id = UUID()
    let type: String
    let name: String
    let isRunning: Bool
    let monthlyCost: Double
    let source: String // "CloudFormation" or "Manual"
    
    var icon: String {
        switch type {
        case "Lambda": return "function"
        case "DynamoDB": return "tablecells"
        case "Aurora": return "cylinder"
        case "S3": return "externaldrive"
        case "API Gateway": return "network"
        case "CloudFront": return "cloud"
        case "Secret": return "key"
        case "IAM Role": return "person.badge.key"
        case "SQS": return "tray.2"
        case "SNS": return "bell"
        default: return "cube"
        }
    }
    
    var typeColor: Color {
        switch type {
        case "Lambda": return .orange
        case "DynamoDB": return .blue
        case "Aurora": return .purple
        case "S3": return .green
        case "API Gateway": return .pink
        case "CloudFront": return .cyan
        default: return .secondary
        }
    }
}

// MARK: - Instance Management Service

@MainActor
class InstanceManagementService: ObservableObject {
    @Published var devStatus: InstanceStatus
    @Published var stagingStatus: InstanceStatus
    @Published var prodStatus: InstanceStatus
    @Published var isLoading = false
    
    private var devResources: [AWSResource] = []
    private var stagingResources: [AWSResource] = []
    private var prodResources: [AWSResource] = []
    
    init() {
        // Initialize with default status
        devStatus = InstanceStatus(
            environment: .dev,
            overallHealth: .unknown,
            services: [],
            lambdaCount: 0,
            tableCount: 0,
            bucketCount: 0,
            estimatedMonthlyCost: 0
        )
        stagingStatus = InstanceStatus(
            environment: .staging,
            overallHealth: .unknown,
            services: [],
            lambdaCount: 0,
            tableCount: 0,
            bucketCount: 0,
            estimatedMonthlyCost: 0
        )
        prodStatus = InstanceStatus(
            environment: .prod,
            overallHealth: .unknown,
            services: [],
            lambdaCount: 0,
            tableCount: 0,
            bucketCount: 0,
            estimatedMonthlyCost: 0
        )
    }
    
    func loadAllStatus() async {
        isLoading = true
        defer { isLoading = false }
        
        // In production, this would query CloudFormation, Lambda, DynamoDB, etc.
        // Demo data for now
        
        let commonServices = [
            ServiceStatus(name: "API Gateway", isRunning: true),
            ServiceStatus(name: "Lambda", isRunning: true),
            ServiceStatus(name: "Aurora DB", isRunning: true),
            ServiceStatus(name: "S3", isRunning: true),
            ServiceStatus(name: "CloudFront", isRunning: true),
            ServiceStatus(name: "WebSocket", isRunning: true)
        ]
        
        devStatus = InstanceStatus(
            environment: .dev,
            overallHealth: .running,
            services: commonServices,
            lambdaCount: 24,
            tableCount: 12,
            bucketCount: 5,
            estimatedMonthlyCost: 45.00
        )
        
        stagingStatus = InstanceStatus(
            environment: .staging,
            overallHealth: .running,
            services: commonServices,
            lambdaCount: 24,
            tableCount: 12,
            bucketCount: 5,
            estimatedMonthlyCost: 85.00
        )
        
        prodStatus = InstanceStatus(
            environment: .prod,
            overallHealth: .running,
            services: commonServices,
            lambdaCount: 24,
            tableCount: 12,
            bucketCount: 5,
            estimatedMonthlyCost: 450.00
        )
        
        // Load resources
        devResources = generateDemoResources(for: .dev)
        stagingResources = generateDemoResources(for: .staging)
        prodResources = generateDemoResources(for: .prod)
    }
    
    private func generateDemoResources(for environment: DeployEnvironment) -> [AWSResource] {
        let prefix = "radiant-\(environment.shortName.lowercased())"
        return [
            AWSResource(type: "Lambda", name: "\(prefix)-api-handler", isRunning: true, monthlyCost: 2.50, source: "CloudFormation"),
            AWSResource(type: "Lambda", name: "\(prefix)-auth-handler", isRunning: true, monthlyCost: 1.20, source: "CloudFormation"),
            AWSResource(type: "Lambda", name: "\(prefix)-websocket", isRunning: true, monthlyCost: 3.00, source: "CloudFormation"),
            AWSResource(type: "Aurora", name: "\(prefix)-aurora-cluster", isRunning: true, monthlyCost: environment == .prod ? 250.00 : 35.00, source: "CloudFormation"),
            AWSResource(type: "DynamoDB", name: "\(prefix)-sessions", isRunning: true, monthlyCost: 5.00, source: "CloudFormation"),
            AWSResource(type: "S3", name: "\(prefix)-artifacts", isRunning: true, monthlyCost: 2.00, source: "CloudFormation"),
            AWSResource(type: "S3", name: "\(prefix)-uploads", isRunning: true, monthlyCost: 8.00, source: "CloudFormation"),
            AWSResource(type: "CloudFront", name: "\(prefix)-cdn", isRunning: true, monthlyCost: 15.00, source: "CloudFormation"),
            AWSResource(type: "API Gateway", name: "\(prefix)-rest-api", isRunning: true, monthlyCost: 4.00, source: "CloudFormation"),
            AWSResource(type: "Secret", name: "\(prefix)/openai-key", isRunning: true, monthlyCost: 0.40, source: "CloudFormation")
        ]
    }
    
    func getResources(for environment: DeployEnvironment) -> [AWSResource] {
        switch environment {
        case .dev: return devResources
        case .staging: return stagingResources
        case .prod: return prodResources
        }
    }
    
    func startInstance(_ environment: DeployEnvironment) async {
        // Start all services for the environment
        // This would: resume Aurora, warm up Lambdas, etc.
        try? await Task.sleep(for: .seconds(2))
        await loadAllStatus()
    }
    
    func stopInstance(_ environment: DeployEnvironment) async {
        // Stop pausable services to save costs
        // This would: pause Aurora, remove provisioned concurrency, etc.
        try? await Task.sleep(for: .seconds(2))
        await loadAllStatus()
    }
    
    func wipeInstance(_ environment: DeployEnvironment, options: WipeOptions) async {
        // NUCLEAR OPTION: Delete all resources
        
        // 1. Create backup if requested
        if options.createBackupFirst {
            await createBackup(for: environment)
        }
        
        // 2. Delete via CloudFormation (clean)
        if options.deleteCloudFormationStacks {
            await deleteCloudFormationStacks(for: environment, preserving: options)
        }
        
        // 3. Force delete orphaned resources
        if options.forceDeleteOrphanedResources {
            await deleteOrphanedResources(for: environment, preserving: options)
        }
        
        // 4. Reload status
        await loadAllStatus()
    }
    
    private func createBackup(for environment: DeployEnvironment) async {
        // Create Aurora snapshot
        // Export DynamoDB tables
        // Create S3 inventory
        try? await Task.sleep(for: .seconds(3))
    }
    
    private func deleteCloudFormationStacks(for environment: DeployEnvironment, preserving options: WipeOptions) async {
        // Delete stacks in reverse dependency order:
        // 1. API Stack
        // 2. AI Stacks
        // 3. Database Stack
        // 4. Storage Stack
        // 5. Security Stack
        // 6. Foundation Stack
        try? await Task.sleep(for: .seconds(5))
    }
    
    private func deleteOrphanedResources(for environment: DeployEnvironment, preserving options: WipeOptions) async {
        // Find and delete resources not in CloudFormation
        // - Manually created Lambdas
        // - Test S3 buckets
        // - Orphaned IAM roles
        try? await Task.sleep(for: .seconds(3))
    }
    
    func stopAllNonProd() async {
        await stopInstance(.dev)
        await stopInstance(.staging)
    }
    
    func startAllNonProd() async {
        await startInstance(.dev)
        await startInstance(.staging)
    }
}

// MARK: - Preview

#Preview {
    InstanceManagementView()
        .environmentObject(AppState())
        .frame(width: 1200, height: 900)
}
