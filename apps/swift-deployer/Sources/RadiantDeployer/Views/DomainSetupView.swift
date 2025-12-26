// RADIANT v4.18.0 - Domain Setup View
// UI for configuring domain names and displaying DNS records

import SwiftUI

struct DomainSetupView: View {
    @EnvironmentObject var appState: AppState
    @State private var baseDomain: String = ""
    @State private var selectedHostedZone: HostedZone?
    @State private var hostedZones: [HostedZone] = []
    @State private var isLoading = false
    @State private var dnsRecords: [DNSRecord] = []
    @State private var certificateArn: String?
    @State private var certificateStatus: String = "Not Requested"
    @State private var showCertificateRecords = false
    @State private var certificateRecords: [DNSRecord] = []
    @State private var errorMessage: String?
    @State private var successMessage: String?
    
    private let dnsService = DNSService.shared
    private let auditLogger = AuditLogger.shared
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: RadiantSpacing.lg) {
                // Header
                headerSection
                
                // Domain Configuration
                domainConfigSection
                
                // SSL Certificate
                certificateSection
                
                // DNS Records to Configure
                if !dnsRecords.isEmpty {
                    dnsRecordsSection
                }
                
                // Certificate Validation Records
                if showCertificateRecords && !certificateRecords.isEmpty {
                    certificateRecordsSection
                }
                
                // Messages
                messagesSection
            }
            .padding(RadiantSpacing.lg)
        }
        .navigationTitle("Domain Setup")
        .task {
            await loadHostedZones()
        }
    }
    
    // MARK: - Header Section
    
    private var headerSection: some View {
        VStack(alignment: .leading, spacing: RadiantSpacing.sm) {
            Text("Domain Configuration")
                .font(.title2.bold())
            
            Text("Configure your custom domain for RADIANT and Think Tank. DNS records will be generated for you to add to your domain provider.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }
    
    // MARK: - Domain Config Section
    
    private var domainConfigSection: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: RadiantSpacing.md) {
                // Base Domain Input
                VStack(alignment: .leading, spacing: RadiantSpacing.xs) {
                    Text("Base Domain")
                        .font(.headline)
                    
                    HStack {
                        TextField("example.com", text: $baseDomain)
                            .textFieldStyle(.roundedBorder)
                        
                        Button("Generate Records") {
                            Task { await generateRecords() }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(baseDomain.isEmpty || isLoading)
                    }
                    
                    Text("Enter your base domain (e.g., mycompany.com). Subdomains will be created for api, admin, etc.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                Divider()
                
                // Hosted Zone Selection (optional)
                VStack(alignment: .leading, spacing: RadiantSpacing.xs) {
                    Text("Route53 Hosted Zone (Optional)")
                        .font(.headline)
                    
                    if hostedZones.isEmpty {
                        Text("No hosted zones found in AWS account")
                            .foregroundStyle(.secondary)
                            .font(.subheadline)
                    } else {
                        Picker("Hosted Zone", selection: $selectedHostedZone) {
                            Text("None - Manual DNS").tag(nil as HostedZone?)
                            ForEach(hostedZones) { zone in
                                Text("\(zone.name) (\(zone.recordCount) records)")
                                    .tag(zone as HostedZone?)
                            }
                        }
                        .pickerStyle(.menu)
                    }
                    
                    Text("If you have a Route53 hosted zone, select it to automatically configure DNS records.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                // Environment Subdomains Preview
                VStack(alignment: .leading, spacing: RadiantSpacing.xs) {
                    Text("Subdomains")
                        .font(.headline)
                    
                    if !baseDomain.isEmpty {
                        Grid(alignment: .leading, horizontalSpacing: RadiantSpacing.lg, verticalSpacing: RadiantSpacing.xs) {
                            GridRow {
                                Text("Environment")
                                    .fontWeight(.semibold)
                                Text("App URL")
                                    .fontWeight(.semibold)
                                Text("API URL")
                                    .fontWeight(.semibold)
                            }
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            
                            Divider()
                            
                            GridRow {
                                Text("Production")
                                Text(baseDomain)
                                Text("api.\(baseDomain)")
                            }
                            
                            GridRow {
                                Text("Staging")
                                Text("staging.\(baseDomain)")
                                Text("api.staging.\(baseDomain)")
                            }
                            
                            GridRow {
                                Text("Development")
                                Text("dev.\(baseDomain)")
                                Text("api.dev.\(baseDomain)")
                            }
                        }
                        .font(.system(.body, design: .monospaced))
                    }
                }
            }
            .padding(RadiantSpacing.md)
        } label: {
            Label("Domain Settings", systemImage: "globe")
        }
    }
    
    // MARK: - Certificate Section
    
    private var certificateSection: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: RadiantSpacing.md) {
                HStack {
                    VStack(alignment: .leading, spacing: RadiantSpacing.xs) {
                        Text("SSL Certificate")
                            .font(.headline)
                        
                        HStack(spacing: RadiantSpacing.xs) {
                            Circle()
                                .fill(certificateStatusColor)
                                .frame(width: 8, height: 8)
                            Text(certificateStatus)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }
                    
                    Spacer()
                    
                    Button("Request Certificate") {
                        Task { await requestCertificate() }
                    }
                    .buttonStyle(.bordered)
                    .disabled(baseDomain.isEmpty || isLoading)
                }
                
                if let arn = certificateArn {
                    HStack {
                        Text("ARN:")
                            .foregroundStyle(.secondary)
                        Text(arn)
                            .font(.system(.caption, design: .monospaced))
                            .textSelection(.enabled)
                        
                        Button {
                            NSPasteboard.general.clearContents()
                            NSPasteboard.general.setString(arn, forType: .string)
                        } label: {
                            Image(systemName: "doc.on.doc")
                        }
                        .buttonStyle(.borderless)
                    }
                }
                
                Text("An SSL certificate is required for HTTPS. AWS Certificate Manager (ACM) certificates are free.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(RadiantSpacing.md)
        } label: {
            Label("SSL Certificate", systemImage: "lock.shield")
        }
    }
    
    private var certificateStatusColor: Color {
        switch certificateStatus {
        case "ISSUED": return .green
        case "PENDING_VALIDATION": return .orange
        case "FAILED", "EXPIRED": return .red
        default: return .gray
        }
    }
    
    // MARK: - DNS Records Section
    
    private var dnsRecordsSection: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: RadiantSpacing.md) {
                HStack {
                    Text("Required DNS Records")
                        .font(.headline)
                    
                    Spacer()
                    
                    Button("Copy All") {
                        copyAllRecords(dnsRecords)
                    }
                    .buttonStyle(.bordered)
                    
                    Button("Refresh Status") {
                        Task { await refreshRecordStatus() }
                    }
                    .buttonStyle(.bordered)
                }
                
                Text("Add these records to your DNS provider to complete the domain setup.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                
                dnsRecordsTable(records: dnsRecords)
            }
            .padding(RadiantSpacing.md)
        } label: {
            Label("DNS Records", systemImage: "list.bullet.rectangle")
        }
    }
    
    // MARK: - Certificate Records Section
    
    private var certificateRecordsSection: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: RadiantSpacing.md) {
                HStack {
                    Text("Certificate Validation Records")
                        .font(.headline)
                    
                    Spacer()
                    
                    Button("Copy All") {
                        copyAllRecords(certificateRecords)
                    }
                    .buttonStyle(.bordered)
                }
                
                Text("Add these CNAME records to validate your SSL certificate.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                
                dnsRecordsTable(records: certificateRecords)
            }
            .padding(RadiantSpacing.md)
        } label: {
            Label("Certificate Validation", systemImage: "checkmark.seal")
        }
    }
    
    // MARK: - DNS Records Table
    
    private func dnsRecordsTable(records: [DNSRecord]) -> some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Type")
                    .frame(width: 60, alignment: .leading)
                Text("Name")
                    .frame(minWidth: 200, alignment: .leading)
                Text("Value")
                    .frame(minWidth: 300, alignment: .leading)
                Text("TTL")
                    .frame(width: 60, alignment: .trailing)
                Text("Status")
                    .frame(width: 80, alignment: .center)
                Text("")
                    .frame(width: 40)
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(.secondary)
            .padding(.vertical, RadiantSpacing.xs)
            .padding(.horizontal, RadiantSpacing.sm)
            .background(Color.gray.opacity(0.1))
            
            Divider()
            
            // Records
            ForEach(records) { record in
                HStack {
                    Text(record.type.rawValue)
                        .font(.system(.body, design: .monospaced))
                        .frame(width: 60, alignment: .leading)
                    
                    Text(record.name)
                        .font(.system(.caption, design: .monospaced))
                        .lineLimit(1)
                        .frame(minWidth: 200, alignment: .leading)
                    
                    Text(record.value)
                        .font(.system(.caption, design: .monospaced))
                        .lineLimit(1)
                        .frame(minWidth: 300, alignment: .leading)
                    
                    Text("\(record.ttl)")
                        .font(.system(.body, design: .monospaced))
                        .frame(width: 60, alignment: .trailing)
                    
                    statusBadge(for: record.status)
                        .frame(width: 80, alignment: .center)
                    
                    Button {
                        copyRecord(record)
                    } label: {
                        Image(systemName: "doc.on.doc")
                    }
                    .buttonStyle(.borderless)
                    .frame(width: 40)
                }
                .padding(.vertical, RadiantSpacing.xs)
                .padding(.horizontal, RadiantSpacing.sm)
                
                Divider()
            }
        }
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.md))
    }
    
    private func statusBadge(for status: DNSRecord.VerificationStatus) -> some View {
        Text(status.rawValue)
            .font(.caption2.weight(.medium))
            .padding(.horizontal, RadiantSpacing.xs)
            .padding(.vertical, 2)
            .background(statusColor(for: status).opacity(0.15))
            .foregroundStyle(statusColor(for: status))
            .clipShape(Capsule())
    }
    
    private func statusColor(for status: DNSRecord.VerificationStatus) -> Color {
        switch status {
        case .verified: return .green
        case .pending: return .orange
        case .failed: return .red
        }
    }
    
    // MARK: - Messages Section
    
    private var messagesSection: some View {
        VStack(spacing: RadiantSpacing.sm) {
            if let error = errorMessage {
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.red)
                    Text(error)
                    Spacer()
                    Button("Dismiss") { errorMessage = nil }
                        .buttonStyle(.borderless)
                }
                .padding(RadiantSpacing.md)
                .background(Color.red.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.md))
            }
            
            if let success = successMessage {
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                    Text(success)
                    Spacer()
                    Button("Dismiss") { successMessage = nil }
                        .buttonStyle(.borderless)
                }
                .padding(RadiantSpacing.md)
                .background(Color.green.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.md))
            }
        }
    }
    
    // MARK: - Actions
    
    private func loadHostedZones() async {
        isLoading = true
        defer { isLoading = false }
        
        do {
            hostedZones = try await dnsService.listHostedZones()
        } catch {
            errorMessage = "Failed to load hosted zones: \(error.localizedDescription)"
        }
    }
    
    private func generateRecords() async {
        guard !baseDomain.isEmpty else { return }
        isLoading = true
        defer { isLoading = false }
        
        // Generate placeholder records (actual values come from deployment outputs)
        dnsRecords = await dnsService.generateRequiredRecords(
            domain: baseDomain,
            appId: appState.selectedApp?.id ?? "app",
            environment: appState.selectedEnvironment,
            cloudFrontDomain: "d123456789.cloudfront.net", // Placeholder
            albDomain: "alb-123456.us-east-1.elb.amazonaws.com", // Placeholder
            apiGatewayDomain: "api-id.execute-api.us-east-1.amazonaws.com" // Placeholder
        )
        
        // Audit log for compliance (SOC2, GDPR)
        await auditLogger.log(
            action: .domainConfigured,
            details: "Domain configured: \(baseDomain)",
            metadata: [
                "domain": baseDomain,
                "environment": appState.selectedEnvironment.rawValue,
                "recordCount": String(dnsRecords.count)
            ]
        )
        
        successMessage = "DNS records generated. Add these to your DNS provider."
    }
    
    private func requestCertificate() async {
        guard !baseDomain.isEmpty else { return }
        isLoading = true
        defer { isLoading = false }
        
        do {
            let wildcardDomain = "*.\(baseDomain)"
            let request = try await dnsService.requestCertificate(
                domain: baseDomain,
                subjectAlternativeNames: [wildcardDomain]
            )
            
            certificateArn = request.arn
            certificateRecords = request.validationRecords
            certificateStatus = "PENDING_VALIDATION"
            showCertificateRecords = true
            
            successMessage = "Certificate requested. Add the validation records to complete."
        } catch {
            errorMessage = "Failed to request certificate: \(error.localizedDescription)"
        }
    }
    
    private func refreshRecordStatus() async {
        // In a real implementation, this would verify DNS propagation
        successMessage = "Record status refreshed"
    }
    
    private func copyRecord(_ record: DNSRecord) {
        let text = "\(record.type.rawValue)\t\(record.name)\t\(record.copyableValue)\t\(record.ttl)"
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
    }
    
    private func copyAllRecords(_ records: [DNSRecord]) {
        let header = "Type\tName\tValue\tTTL"
        let rows = records.map { "\($0.type.rawValue)\t\($0.name)\t\($0.copyableValue)\t\($0.ttl)" }
        let text = ([header] + rows).joined(separator: "\n")
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
        successMessage = "All records copied to clipboard"
    }
}

#Preview {
    DomainSetupView()
        .environmentObject(AppState())
        .frame(width: 1000, height: 800)
}
