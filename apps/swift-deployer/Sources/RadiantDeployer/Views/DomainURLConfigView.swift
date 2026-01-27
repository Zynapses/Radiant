// RADIANT v5.52.17 - Domain URL Configuration View
// Configure domain routing for all RADIANT applications

import SwiftUI

struct DomainURLConfigView: View {
    @Binding var config: DomainURLConfiguration
    @State private var showAdvanced = false
    @State private var validationResult: DomainValidationResult?
    @State private var isValidating = false
    
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Header
                headerSection
                
                // Base Domain
                baseDomainSection
                
                // Routing Strategy
                routingStrategySection
                
                // Application URLs
                applicationURLsSection
                
                // URL Preview
                urlPreviewSection
                
                // Validation Status
                if validationResult != nil || isValidating {
                    validationSection
                }
                
                // Advanced Options
                if showAdvanced {
                    advancedSection
                }
            }
            .padding()
        }
        .navigationTitle("Domain Configuration")
    }
    
    // MARK: - Header Section
    
    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "globe")
                    .font(.title2)
                    .foregroundStyle(.blue)
                Text("Domain URL Configuration")
                    .font(.title2.bold())
                Spacer()
                
                Button {
                    showAdvanced.toggle()
                } label: {
                    Label(showAdvanced ? "Hide Advanced" : "Show Advanced", 
                          systemImage: showAdvanced ? "chevron.up" : "chevron.down")
                }
                .buttonStyle(.borderless)
            }
            
            Text("Configure how users access each RADIANT application")
                .foregroundStyle(.secondary)
        }
        .padding()
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }
    
    // MARK: - Base Domain Section
    
    private var baseDomainSection: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: 12) {
                Label("Base Domain", systemImage: "link")
                    .font(.headline)
                
                HStack {
                    TextField("example.com", text: $config.baseDomain)
                        .textFieldStyle(.roundedBorder)
                        .autocorrectionDisabled()
                    
                    Button {
                        Task { await validateDomain() }
                    } label: {
                        if isValidating {
                            ProgressView()
                                .controlSize(.small)
                        } else {
                            Label("Validate", systemImage: "checkmark.circle")
                        }
                    }
                    .disabled(config.baseDomain.isEmpty || isValidating)
                }
                
                if !config.validationErrors.isEmpty {
                    ForEach(config.validationErrors, id: \.self) { error in
                        Label(error, systemImage: "exclamationmark.triangle")
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                }
                
                Text("Enter your domain without protocol (e.g., acme.radiant.ai)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
    
    // MARK: - Routing Strategy Section
    
    private var routingStrategySection: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: 12) {
                Label("Routing Strategy", systemImage: "arrow.triangle.branch")
                    .font(.headline)
                
                Picker("Strategy", selection: $config.routingStrategy) {
                    ForEach(DomainURLConfiguration.RoutingStrategy.allCases, id: \.self) { strategy in
                        HStack {
                            Image(systemName: strategy.icon)
                            Text(strategy.displayName)
                        }
                        .tag(strategy)
                    }
                }
                .pickerStyle(.segmented)
                
                // Strategy description
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: config.routingStrategy.icon)
                        .font(.title2)
                        .foregroundStyle(.blue)
                        .frame(width: 32)
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text(config.routingStrategy.displayName)
                            .font(.subheadline.bold())
                        Text(config.routingStrategy.description)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.top, 8)
                
                // Example URLs
                VStack(alignment: .leading, spacing: 4) {
                    Text("Example URLs:")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                    
                    switch config.routingStrategy {
                    case .subdomain:
                        Text("admin.\(config.baseDomain.isEmpty ? "example.com" : config.baseDomain)")
                        Text("app.\(config.baseDomain.isEmpty ? "example.com" : config.baseDomain)")
                    case .pathBased:
                        Text("\(config.baseDomain.isEmpty ? "example.com" : config.baseDomain)/admin")
                        Text("\(config.baseDomain.isEmpty ? "example.com" : config.baseDomain)/")
                    }
                }
                .font(.caption.monospaced())
                .foregroundStyle(.secondary)
                .padding(.top, 4)
            }
        }
    }
    
    // MARK: - Application URLs Section
    
    private var applicationURLsSection: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: 12) {
                Label("Application URLs", systemImage: "app.badge")
                    .font(.headline)
                
                Text("Configure which applications are enabled and their URL paths")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                
                Divider()
                
                ForEach(RadiantApplication.allCases) { app in
                    ApplicationURLRow(
                        app: app,
                        config: Binding(
                            get: { config.config(for: app) },
                            set: { config.setConfig(for: app, config: $0) }
                        ),
                        routingStrategy: config.routingStrategy,
                        baseDomain: config.baseDomain
                    )
                    
                    if app != RadiantApplication.allCases.last {
                        Divider()
                    }
                }
            }
        }
    }
    
    // MARK: - URL Preview Section
    
    private var urlPreviewSection: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Label("URL Preview", systemImage: "eye")
                        .font(.headline)
                    Spacer()
                    
                    Button {
                        copyAllURLs()
                    } label: {
                        Label("Copy All", systemImage: "doc.on.doc")
                    }
                    .buttonStyle(.borderless)
                    .disabled(config.baseDomain.isEmpty)
                }
                
                if config.baseDomain.isEmpty {
                    Text("Enter a base domain to see URL preview")
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding()
                } else {
                    VStack(spacing: 8) {
                        ForEach(config.allURLs(), id: \.app) { item in
                            HStack {
                                Image(systemName: item.app.icon)
                                    .foregroundStyle(item.app.color)
                                    .frame(width: 24)
                                
                                Text(item.app.displayName)
                                    .frame(width: 140, alignment: .leading)
                                
                                Text(item.url)
                                    .font(.system(.body, design: .monospaced))
                                    .foregroundStyle(.blue)
                                
                                Spacer()
                                
                                Button {
                                    NSPasteboard.general.clearContents()
                                    NSPasteboard.general.setString(item.url, forType: .string)
                                } label: {
                                    Image(systemName: "doc.on.doc")
                                }
                                .buttonStyle(.borderless)
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }
            }
        }
    }
    
    // MARK: - Validation Section
    
    private var validationSection: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Label("Validation Status", systemImage: "checkmark.shield")
                        .font(.headline)
                    Spacer()
                    
                    if isValidating {
                        ProgressView()
                            .controlSize(.small)
                        Text("Validating...")
                            .foregroundStyle(.secondary)
                    } else if let result = validationResult {
                        Image(systemName: result.overallStatus.icon)
                            .foregroundStyle(Color(result.overallStatus.color))
                        Text(result.overallStatus.rawValue)
                    }
                }
                
                if let result = validationResult {
                    Divider()
                    
                    VStack(alignment: .leading, spacing: 8) {
                        ValidationRow(
                            label: "DNS Records",
                            isValid: result.dnsRecordsFound,
                            icon: "network"
                        )
                        
                        ValidationRow(
                            label: "SSL Certificate",
                            isValid: result.sslCertificateValid,
                            icon: "lock.shield"
                        )
                        
                        ValidationRow(
                            label: "CloudFront",
                            isValid: result.cloudFrontConfigured,
                            icon: "cloud"
                        )
                    }
                    
                    if !result.errors.isEmpty {
                        Divider()
                        Text("Errors:")
                            .font(.caption.bold())
                            .foregroundStyle(.red)
                        ForEach(result.errors, id: \.self) { error in
                            Text("• \(error)")
                                .font(.caption)
                                .foregroundStyle(.red)
                        }
                    }
                    
                    if !result.warnings.isEmpty {
                        Divider()
                        Text("Warnings:")
                            .font(.caption.bold())
                            .foregroundStyle(.orange)
                        ForEach(result.warnings, id: \.self) { warning in
                            Text("• \(warning)")
                                .font(.caption)
                                .foregroundStyle(.orange)
                        }
                    }
                }
            }
        }
    }
    
    // MARK: - Advanced Section
    
    private var advancedSection: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: 12) {
                Label("Advanced Configuration", systemImage: "wrench.and.screwdriver")
                    .font(.headline)
                
                // SSL Certificate ARN
                VStack(alignment: .leading, spacing: 4) {
                    Text("SSL Certificate ARN")
                        .font(.subheadline)
                    TextField("arn:aws:acm:us-east-1:...", text: Binding(
                        get: { config.sslCertificateArn ?? "" },
                        set: { config.sslCertificateArn = $0.isEmpty ? nil : $0 }
                    ))
                    .textFieldStyle(.roundedBorder)
                    .font(.system(.body, design: .monospaced))
                }
                
                // Hosted Zone ID
                VStack(alignment: .leading, spacing: 4) {
                    Text("Route53 Hosted Zone ID")
                        .font(.subheadline)
                    TextField("Z1234567890ABC", text: Binding(
                        get: { config.hostedZoneId ?? "" },
                        set: { config.hostedZoneId = $0.isEmpty ? nil : $0 }
                    ))
                    .textFieldStyle(.roundedBorder)
                    .font(.system(.body, design: .monospaced))
                }
                
                // CloudFront Distribution ID
                VStack(alignment: .leading, spacing: 4) {
                    Text("CloudFront Distribution ID")
                        .font(.subheadline)
                    TextField("E1234567890ABC", text: Binding(
                        get: { config.cloudFrontDistributionId ?? "" },
                        set: { config.cloudFrontDistributionId = $0.isEmpty ? nil : $0 }
                    ))
                    .textFieldStyle(.roundedBorder)
                    .font(.system(.body, design: .monospaced))
                }
            }
        }
    }
    
    // MARK: - Actions
    
    private func validateDomain() async {
        isValidating = true
        defer { isValidating = false }
        
        // Simulate validation - in real implementation, this would call DomainValidationService
        try? await Task.sleep(nanoseconds: 1_000_000_000)
        
        validationResult = DomainValidationResult(
            domain: config.baseDomain,
            isValid: config.isValid,
            dnsRecordsFound: false,
            sslCertificateValid: config.sslCertificateArn != nil,
            cloudFrontConfigured: config.cloudFrontDistributionId != nil,
            errors: config.validationErrors,
            warnings: config.sslCertificateArn == nil ? ["SSL certificate not configured"] : []
        )
    }
    
    private func copyAllURLs() {
        let urls = config.allURLs()
            .map { "\($0.app.displayName): \($0.url)" }
            .joined(separator: "\n")
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(urls, forType: .string)
    }
}

// MARK: - Application URL Row

struct ApplicationURLRow: View {
    let app: RadiantApplication
    @Binding var config: DomainURLConfiguration.AppRouteConfig
    let routingStrategy: DomainURLConfiguration.RoutingStrategy
    let baseDomain: String
    
    var body: some View {
        HStack(spacing: 12) {
            // App Icon & Toggle
            Toggle(isOn: $config.enabled) {
                HStack {
                    Image(systemName: app.icon)
                        .foregroundStyle(app.color)
                        .frame(width: 24)
                    
                    VStack(alignment: .leading, spacing: 2) {
                        HStack {
                            Text(app.displayName)
                                .font(.subheadline.bold())
                            
                            if app.isRequired {
                                Text("Required")
                                    .font(.caption2)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(.blue.opacity(0.2))
                                    .foregroundStyle(.blue)
                                    .clipShape(Capsule())
                            }
                        }
                        
                        Text(app.description)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
            }
            .disabled(app.isRequired)
            .toggleStyle(.switch)
            
            Spacer()
            
            // Custom Path/Subdomain
            if config.enabled {
                VStack(alignment: .trailing, spacing: 4) {
                    switch routingStrategy {
                    case .subdomain:
                        HStack(spacing: 4) {
                            TextField(app.defaultSubdomain, text: Binding(
                                get: { config.customSubdomain ?? "" },
                                set: { config.customSubdomain = $0.isEmpty ? nil : $0 }
                            ))
                            .textFieldStyle(.roundedBorder)
                            .frame(width: 120)
                            
                            Text(".\(baseDomain.isEmpty ? "domain.com" : baseDomain)")
                                .font(.caption.monospaced())
                                .foregroundStyle(.secondary)
                        }
                    case .pathBased:
                        HStack(spacing: 4) {
                            Text(baseDomain.isEmpty ? "domain.com" : baseDomain)
                                .font(.caption.monospaced())
                                .foregroundStyle(.secondary)
                            
                            TextField(app.defaultPath, text: Binding(
                                get: { config.customPath ?? "" },
                                set: { config.customPath = $0.isEmpty ? nil : $0 }
                            ))
                            .textFieldStyle(.roundedBorder)
                            .frame(width: 120)
                        }
                    }
                }
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Validation Row

struct ValidationRow: View {
    let label: String
    let isValid: Bool
    let icon: String
    
    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundStyle(.secondary)
                .frame(width: 24)
            
            Text(label)
            
            Spacer()
            
            Image(systemName: isValid ? "checkmark.circle.fill" : "xmark.circle.fill")
                .foregroundStyle(isValid ? .green : .red)
        }
    }
}

// MARK: - Preview

#Preview {
    DomainURLConfigView(config: .constant(.defaults(baseDomain: "acme.radiant.ai")))
        .frame(width: 700, height: 900)
}
