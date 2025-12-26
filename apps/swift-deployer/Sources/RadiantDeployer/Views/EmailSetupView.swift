// RADIANT v4.18.0 - Email Setup View
// UI for configuring SES email and displaying required DNS records

import SwiftUI

struct EmailSetupView: View {
    @EnvironmentObject var appState: AppState
    @State private var emailDomain: String = ""
    @State private var mailFromSubdomain: String = "mail"
    @State private var isLoading = false
    @State private var sesRecords: [DNSRecord] = []
    @State private var verificationStatus: EmailConfiguration.VerificationStatus = .pending
    @State private var dkimStatus: EmailConfiguration.DKIMStatus = .notStarted
    @State private var errorMessage: String?
    @State private var successMessage: String?
    @State private var isVerifying = false
    
    private let dnsService = DNSService.shared
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: RadiantSpacing.lg) {
                // Header
                headerSection
                
                // Email Domain Configuration
                emailConfigSection
                
                // Verification Status
                statusSection
                
                // DNS Records
                if !sesRecords.isEmpty {
                    dnsRecordsSection
                }
                
                // Instructions
                instructionsSection
                
                // Messages
                messagesSection
            }
            .padding(RadiantSpacing.lg)
        }
        .navigationTitle("Email Setup")
    }
    
    // MARK: - Header Section
    
    private var headerSection: some View {
        VStack(alignment: .leading, spacing: RadiantSpacing.sm) {
            Text("Email Configuration")
                .font(.title2.bold())
            
            Text("Configure Amazon SES for sending emails from RADIANT and Think Tank. This includes transactional emails, notifications, and user communications.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }
    
    // MARK: - Email Config Section
    
    private var emailConfigSection: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: RadiantSpacing.md) {
                // Email Domain Input
                VStack(alignment: .leading, spacing: RadiantSpacing.xs) {
                    Text("Email Domain")
                        .font(.headline)
                    
                    HStack {
                        TextField("example.com", text: $emailDomain)
                            .textFieldStyle(.roundedBorder)
                        
                        Button("Verify Domain") {
                            Task { await verifyDomain() }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(emailDomain.isEmpty || isLoading)
                    }
                    
                    Text("The domain you want to send emails from (e.g., notifications@yourdomain.com)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                Divider()
                
                // Mail FROM subdomain
                VStack(alignment: .leading, spacing: RadiantSpacing.xs) {
                    Text("Custom MAIL FROM Subdomain (Optional)")
                        .font(.headline)
                    
                    HStack {
                        TextField("mail", text: $mailFromSubdomain)
                            .textFieldStyle(.roundedBorder)
                            .frame(width: 100)
                        
                        if !emailDomain.isEmpty {
                            Text(".\(emailDomain)")
                                .foregroundStyle(.secondary)
                        }
                    }
                    
                    Text("Custom MAIL FROM domain improves deliverability. Leave as 'mail' for mail.yourdomain.com")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                Divider()
                
                // Email Addresses Preview
                VStack(alignment: .leading, spacing: RadiantSpacing.xs) {
                    Text("Email Addresses")
                        .font(.headline)
                    
                    if !emailDomain.isEmpty {
                        VStack(alignment: .leading, spacing: RadiantSpacing.xs) {
                            emailAddressRow(label: "Notifications", address: "noreply@\(emailDomain)")
                            emailAddressRow(label: "Support", address: "support@\(emailDomain)")
                            emailAddressRow(label: "System", address: "system@\(emailDomain)")
                        }
                    } else {
                        Text("Enter a domain to see email addresses")
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding(RadiantSpacing.md)
        } label: {
            Label("Email Settings", systemImage: "envelope")
        }
    }
    
    private func emailAddressRow(label: String, address: String) -> some View {
        HStack {
            Text(label)
                .frame(width: 100, alignment: .leading)
                .foregroundStyle(.secondary)
            
            Text(address)
                .font(.system(.body, design: .monospaced))
            
            Spacer()
        }
    }
    
    // MARK: - Status Section
    
    private var statusSection: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: RadiantSpacing.md) {
                HStack {
                    Text("Verification Status")
                        .font(.headline)
                    
                    Spacer()
                    
                    if isVerifying {
                        ProgressView()
                            .scaleEffect(0.7)
                    }
                    
                    Button("Refresh Status") {
                        Task { await refreshStatus() }
                    }
                    .buttonStyle(.bordered)
                    .disabled(emailDomain.isEmpty || isVerifying)
                }
                
                Grid(alignment: .leading, horizontalSpacing: RadiantSpacing.xl, verticalSpacing: RadiantSpacing.sm) {
                    GridRow {
                        Text("Domain Verification")
                        statusBadge(
                            status: verificationStatus.rawValue,
                            color: verificationStatusColor
                        )
                    }
                    
                    GridRow {
                        Text("DKIM Signing")
                        statusBadge(
                            status: dkimStatus.rawValue,
                            color: dkimStatusColor
                        )
                    }
                    
                    GridRow {
                        Text("Sending Enabled")
                        statusBadge(
                            status: verificationStatus == .verified ? "Yes" : "No",
                            color: verificationStatus == .verified ? .green : .gray
                        )
                    }
                }
            }
            .padding(RadiantSpacing.md)
        } label: {
            Label("Status", systemImage: "checkmark.circle")
        }
    }
    
    private func statusBadge(status: String, color: Color) -> some View {
        HStack(spacing: RadiantSpacing.xs) {
            Circle()
                .fill(color)
                .frame(width: 8, height: 8)
            Text(status)
                .font(.subheadline)
        }
    }
    
    private var verificationStatusColor: Color {
        switch verificationStatus {
        case .verified: return .green
        case .pending: return .orange
        case .failed, .temporaryFailure: return .red
        }
    }
    
    private var dkimStatusColor: Color {
        switch dkimStatus {
        case .success: return .green
        case .pending: return .orange
        case .failed, .temporaryFailure: return .red
        case .notStarted: return .gray
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
                        copyAllRecords()
                    }
                    .buttonStyle(.bordered)
                }
                
                Text("Add these records to your DNS provider to verify your domain for email sending.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                
                dnsRecordsTable
            }
            .padding(RadiantSpacing.md)
        } label: {
            Label("DNS Records for Email", systemImage: "list.bullet.rectangle")
        }
    }
    
    private var dnsRecordsTable: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Type")
                    .frame(width: 50, alignment: .leading)
                Text("Name")
                    .frame(minWidth: 250, alignment: .leading)
                Text("Value")
                    .frame(minWidth: 350, alignment: .leading)
                Text("Purpose")
                    .frame(width: 150, alignment: .leading)
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
            ForEach(sesRecords) { record in
                HStack {
                    Text(record.type.rawValue)
                        .font(.system(.body, design: .monospaced))
                        .frame(width: 50, alignment: .leading)
                    
                    Text(record.name)
                        .font(.system(.caption, design: .monospaced))
                        .lineLimit(2)
                        .frame(minWidth: 250, alignment: .leading)
                    
                    Text(record.copyableValue)
                        .font(.system(.caption, design: .monospaced))
                        .lineLimit(2)
                        .frame(minWidth: 350, alignment: .leading)
                    
                    Text(record.purpose)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(width: 150, alignment: .leading)
                    
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
    
    // MARK: - Instructions Section
    
    private var instructionsSection: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: RadiantSpacing.md) {
                Text("Setup Instructions")
                    .font(.headline)
                
                VStack(alignment: .leading, spacing: RadiantSpacing.sm) {
                    instructionStep(number: 1, text: "Enter your email domain and click 'Verify Domain'")
                    instructionStep(number: 2, text: "Copy the DNS records and add them to your DNS provider")
                    instructionStep(number: 3, text: "Wait for DNS propagation (can take up to 72 hours)")
                    instructionStep(number: 4, text: "Click 'Refresh Status' to check verification")
                    instructionStep(number: 5, text: "Once verified, RADIANT can send emails from your domain")
                }
                
                Divider()
                
                Text("Important Notes")
                    .font(.subheadline.weight(.semibold))
                
                VStack(alignment: .leading, spacing: RadiantSpacing.xs) {
                    bulletPoint("DKIM records are required for email deliverability")
                    bulletPoint("SES starts in sandbox mode - request production access for bulk sending")
                    bulletPoint("SPF record improves deliverability and prevents spoofing")
                    bulletPoint("DMARC record (optional) provides additional protection")
                }
            }
            .padding(RadiantSpacing.md)
        } label: {
            Label("Instructions", systemImage: "questionmark.circle")
        }
    }
    
    private func instructionStep(number: Int, text: String) -> some View {
        HStack(alignment: .top, spacing: RadiantSpacing.sm) {
            Text("\(number)")
                .font(.caption.weight(.bold))
                .foregroundStyle(.white)
                .frame(width: 20, height: 20)
                .background(Color.blue)
                .clipShape(Circle())
            
            Text(text)
                .font(.subheadline)
        }
    }
    
    private func bulletPoint(_ text: String) -> some View {
        HStack(alignment: .top, spacing: RadiantSpacing.sm) {
            Text("•")
                .foregroundStyle(.secondary)
            Text(text)
                .font(.caption)
                .foregroundStyle(.secondary)
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
    
    private func verifyDomain() async {
        guard !emailDomain.isEmpty else { return }
        isLoading = true
        defer { isLoading = false }
        
        do {
            let mailFromDomain = "\(mailFromSubdomain).\(emailDomain)"
            let records = try await dnsService.verifyDomainIdentity(domain: emailDomain)
            sesRecords = records.toDNSRecords(domain: emailDomain, mailFromDomain: mailFromDomain)
            
            verificationStatus = .pending
            dkimStatus = .pending
            
            successMessage = "Domain verification initiated. Add the DNS records below."
        } catch {
            errorMessage = "Failed to verify domain: \(error.localizedDescription)"
        }
    }
    
    private func refreshStatus() async {
        guard !emailDomain.isEmpty else { return }
        isVerifying = true
        defer { isVerifying = false }
        
        do {
            verificationStatus = try await dnsService.getDomainVerificationStatus(domain: emailDomain)
            dkimStatus = try await dnsService.getDKIMStatus(domain: emailDomain)
            
            if verificationStatus == .verified && dkimStatus == .success {
                successMessage = "Email domain is fully verified and ready to use!"
            }
        } catch {
            errorMessage = "Failed to check status: \(error.localizedDescription)"
        }
    }
    
    private func copyRecord(_ record: DNSRecord) {
        let text = "\(record.type.rawValue)\t\(record.name)\t\(record.copyableValue)"
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
    }
    
    private func copyAllRecords() {
        let header = "Type\tName\tValue\tPurpose"
        let rows = sesRecords.map { "\($0.type.rawValue)\t\($0.name)\t\($0.copyableValue)\t\($0.purpose)" }
        let text = ([header] + rows).joined(separator: "\n")
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
        successMessage = "All records copied to clipboard"
    }
}

#Preview {
    EmailSetupView()
        .environmentObject(AppState())
        .frame(width: 1000, height: 800)
}
