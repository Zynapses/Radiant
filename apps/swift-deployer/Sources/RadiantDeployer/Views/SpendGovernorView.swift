// RADIANT v7.39.0 - Spend Governor View
// Budget controls, freeze/thaw AWS services, cost reporting configuration

import SwiftUI

struct SpendGovernorView: View {
    @EnvironmentObject var appState: AppState
    
    @State private var instanceBudgetUsd: String = "5000"
    @State private var instancePeriodValue: String = "30"
    @State private var instancePeriodUnit: PeriodUnit = .days
    @State private var costReportIntervalValue: String = "24"
    @State private var costReportIntervalUnit: PeriodUnit = .hours
    @State private var warningThreshold: Double = 0.90
    @State private var suspendThreshold: Double = 1.00
    
    @State private var isFrozen: Bool = false
    @State private var frozenAt: String?
    @State private var frozenReason: String?
    @State private var currentSpendUsd: Double = 0
    
    @State private var isLoading: Bool = false
    @State private var isSaving: Bool = false
    @State private var isFreezing: Bool = false
    @State private var isThawing: Bool = false
    @State private var statusMessage: String?
    @State private var showingFreezeConfirmation: Bool = false
    @State private var showingThawConfirmation: Bool = false
    
    enum PeriodUnit: String, CaseIterable, Sendable {
        case hours = "Hours"
        case days = "Days"
    }
    
    var periodHours: Int {
        let val = Int(instancePeriodValue) ?? 1
        return instancePeriodUnit == .days ? val * 24 : val
    }
    
    var reportIntervalHours: Int {
        let val = Int(costReportIntervalValue) ?? 24
        return costReportIntervalUnit == .days ? val * 24 : val
    }
    
    var budgetPercent: Double {
        guard let budget = Double(instanceBudgetUsd), budget > 0 else { return 0 }
        return min(currentSpendUsd / budget, 1.0)
    }
    
    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                headerSection
                
                if isFrozen {
                    frozenBanner
                }
                
                summaryCards
                budgetSettingsCard
                costReportCard
                freezeControls
            }
            .padding(24)
        }
        .background(Color(.windowBackgroundColor))
        .onAppear { loadConfig() }
    }
    
    // MARK: - Header
    
    private var headerSection: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    Image(systemName: "gauge.with.dots.needle.33percent")
                        .font(.title)
                        .foregroundStyle(.orange)
                    Text("Spend Governor")
                        .font(.largeTitle.bold())
                }
                Text("Control AWS spending and configure budget alerts")
                    .foregroundStyle(.secondary)
            }
            Spacer()
            
            if isFrozen {
                Label("AWS FROZEN", systemImage: "snowflake")
                    .font(.headline)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(.red, in: Capsule())
            }
        }
    }
    
    // MARK: - Frozen Banner
    
    private var frozenBanner: some View {
        HStack(spacing: 16) {
            Image(systemName: "snowflake")
                .font(.title)
                .foregroundStyle(.white)
            
            VStack(alignment: .leading, spacing: 4) {
                Text("AWS Services Are Frozen")
                    .font(.headline)
                    .foregroundStyle(.white)
                Text(frozenReason ?? "Budget exceeded. Restore services below.")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.8))
                if let frozenAt = frozenAt {
                    Text("Frozen at: \(frozenAt)")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.6))
                }
            }
            
            Spacer()
            
            Button(action: { showingThawConfirmation = true }) {
                Label("Restore Services", systemImage: "sun.max.fill")
                    .font(.headline)
            }
            .buttonStyle(.borderedProminent)
            .tint(.green)
            .disabled(isThawing)
        }
        .padding(20)
        .background(.red.gradient, in: RoundedRectangle(cornerRadius: 12))
        .confirmationDialog("Restore AWS Services?", isPresented: $showingThawConfirmation) {
            Button("Restore All Services", role: .none) { thawInstance() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This will restore all frozen AWS services. Billing will resume.")
        }
    }
    
    // MARK: - Summary Cards
    
    private var summaryCards: some View {
        HStack(spacing: 16) {
            SummaryCard(
                title: "Instance Budget",
                value: "$\(instanceBudgetUsd)",
                icon: "dollarsign.circle.fill",
                color: .blue
            )
            
            SummaryCard(
                title: "Current Spend",
                value: String(format: "$%.2f", currentSpendUsd),
                icon: "chart.line.uptrend.xyaxis",
                color: budgetPercent > 0.9 ? .red : budgetPercent > 0.7 ? .orange : .green
            )
            
            SummaryCard(
                title: "Budget Used",
                value: String(format: "%.1f%%", budgetPercent * 100),
                icon: "gauge.with.dots.needle.33percent",
                color: budgetPercent > 0.9 ? .red : budgetPercent > 0.7 ? .orange : .green
            )
            
            SummaryCard(
                title: "Budget Period",
                value: instancePeriodUnit == .days ? "\(instancePeriodValue) days" : "\(instancePeriodValue) hours",
                icon: "clock.fill",
                color: .purple
            )
        }
    }
    
    // MARK: - Budget Settings
    
    private var budgetSettingsCard: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: 16) {
                Label("Budget Configuration", systemImage: "shield.fill")
                    .font(.headline)
                
                HStack(spacing: 20) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Budget Amount (USD)")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        HStack {
                            Text("$")
                                .foregroundStyle(.secondary)
                            TextField("5000", text: $instanceBudgetUsd)
                                .textFieldStyle(.roundedBorder)
                                .frame(width: 120)
                        }
                    }
                    
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Budget Period")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        HStack(spacing: 8) {
                            TextField("30", text: $instancePeriodValue)
                                .textFieldStyle(.roundedBorder)
                                .frame(width: 60)
                            Picker("", selection: $instancePeriodUnit) {
                                ForEach(PeriodUnit.allCases, id: \.self) { unit in
                                    Text(unit.rawValue).tag(unit)
                                }
                            }
                            .frame(width: 80)
                        }
                    }
                    
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Warning at")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        HStack {
                            Slider(value: $warningThreshold, in: 0.5...1.0, step: 0.05)
                                .frame(width: 100)
                            Text("\(Int(warningThreshold * 100))%")
                                .font(.caption.monospaced())
                                .frame(width: 36)
                        }
                    }
                    
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Suspend at")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        HStack {
                            Slider(value: $suspendThreshold, in: 0.5...1.5, step: 0.05)
                                .frame(width: 100)
                            Text("\(Int(suspendThreshold * 100))%")
                                .font(.caption.monospaced())
                                .frame(width: 36)
                        }
                    }
                }
                
                HStack {
                    Spacer()
                    
                    if let statusMessage = statusMessage {
                        Label(statusMessage, systemImage: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                            .font(.caption)
                    }
                    
                    Button(action: saveConfig) {
                        if isSaving {
                            ProgressView()
                                .scaleEffect(0.7)
                                .frame(width: 14, height: 14)
                        } else {
                            Label("Save Budget Settings", systemImage: "square.and.arrow.down")
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isSaving)
                }
            }
            .padding(4)
        }
    }
    
    // MARK: - Cost Report Settings
    
    private var costReportCard: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: 16) {
                Label("Cost Report Schedule", systemImage: "envelope.fill")
                    .font(.headline)
                
                Text("Send cost summaries to super admins at regular intervals")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                
                HStack(spacing: 20) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Send Report Every")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        HStack(spacing: 8) {
                            TextField("24", text: $costReportIntervalValue)
                                .textFieldStyle(.roundedBorder)
                                .frame(width: 60)
                            Picker("", selection: $costReportIntervalUnit) {
                                ForEach(PeriodUnit.allCases, id: \.self) { unit in
                                    Text(unit.rawValue).tag(unit)
                                }
                            }
                            .frame(width: 80)
                        }
                    }
                    
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Effective Interval")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Text("Every \(reportIntervalHours) hours")
                            .font(.body.monospaced())
                            .foregroundStyle(.primary)
                    }
                }
            }
            .padding(4)
        }
    }
    
    // MARK: - Freeze/Thaw Controls
    
    private var freezeControls: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: 16) {
                Label("Emergency Controls", systemImage: "exclamationmark.triangle.fill")
                    .font(.headline)
                    .foregroundStyle(.red)
                
                Text("Manually freeze or restore AWS services. Freezing stops all billable AI services while keeping admin access alive.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                
                HStack(spacing: 16) {
                    if !isFrozen {
                        Button(action: { showingFreezeConfirmation = true }) {
                            Label("Freeze AWS Services", systemImage: "snowflake")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.red)
                        .disabled(isFreezing)
                        .confirmationDialog("Freeze AWS Services?", isPresented: $showingFreezeConfirmation) {
                            Button("Freeze All Services", role: .destructive) { freezeInstance() }
                            Button("Cancel", role: .cancel) {}
                        } message: {
                            Text("This will immediately stop all billable AI services. Admin access will remain available. You can restore services later.")
                        }
                    } else {
                        Button(action: { showingThawConfirmation = true }) {
                            Label("Restore AWS Services", systemImage: "sun.max.fill")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.green)
                        .disabled(isThawing)
                    }
                }
            }
            .padding(4)
        }
    }
    
    // MARK: - Actions
    
    private func loadConfig() {
        isLoading = true
        Task {
            defer { isLoading = false }
            
            guard let baseURL = appState.radiantBaseURL,
                  let token = appState.radiantAuthToken else { return }
            
            do {
                var request = URLRequest(url: URL(string: "\(baseURL)/api/admin/spend-governor/instance")!)
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                
                let (data, _) = try await URLSession.shared.data(for: request)
                let config = try JSONDecoder().decode(InstanceConfigResponse.self, from: data)
                
                await MainActor.run {
                    instanceBudgetUsd = String(format: "%.0f", config.budgetUsd)
                    if config.periodHours >= 24 && config.periodHours % 24 == 0 {
                        instancePeriodValue = String(config.periodHours / 24)
                        instancePeriodUnit = .days
                    } else {
                        instancePeriodValue = String(config.periodHours)
                        instancePeriodUnit = .hours
                    }
                    warningThreshold = config.warningThreshold
                    suspendThreshold = config.suspendThreshold
                    isFrozen = config.isFrozen
                    frozenAt = config.frozenAt
                    frozenReason = config.frozenReason
                    currentSpendUsd = config.currentSpendUsd
                    
                    if config.costReportIntervalHours >= 24 && config.costReportIntervalHours % 24 == 0 {
                        costReportIntervalValue = String(config.costReportIntervalHours / 24)
                        costReportIntervalUnit = .days
                    } else {
                        costReportIntervalValue = String(config.costReportIntervalHours)
                        costReportIntervalUnit = .hours
                    }
                }
            } catch {
                await MainActor.run {
                    appState.error = AppError(message: "Failed to load spend governor config", underlying: error)
                }
            }
        }
    }
    
    private func saveConfig() {
        isSaving = true
        statusMessage = nil
        Task {
            defer { isSaving = false }
            
            guard let baseURL = appState.radiantBaseURL,
                  let token = appState.radiantAuthToken else { return }
            
            do {
                var request = URLRequest(url: URL(string: "\(baseURL)/api/admin/spend-governor/instance")!)
                request.httpMethod = "PUT"
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                
                let body: [String: Any] = [
                    "budgetUsd": Double(instanceBudgetUsd) ?? 5000,
                    "periodHours": periodHours,
                    "warningThreshold": warningThreshold,
                    "suspendThreshold": suspendThreshold,
                    "costReportIntervalHours": reportIntervalHours,
                ]
                request.httpBody = try JSONSerialization.data(withJSONObject: body)
                
                let (_, response) = try await URLSession.shared.data(for: request)
                guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
                    throw NSError(domain: "SpendGovernor", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to save config"])
                }
                
                await MainActor.run {
                    statusMessage = "Settings saved"
                    Task {
                        try? await Task.sleep(nanoseconds: 3_000_000_000)
                        statusMessage = nil
                    }
                }
            } catch {
                await MainActor.run {
                    appState.error = AppError(message: "Failed to save spend governor config", underlying: error)
                }
            }
        }
    }
    
    private func freezeInstance() {
        isFreezing = true
        Task {
            defer { isFreezing = false }
            
            guard let baseURL = appState.radiantBaseURL,
                  let token = appState.radiantAuthToken else { return }
            
            do {
                var request = URLRequest(url: URL(string: "\(baseURL)/api/admin/spend-governor/instance/freeze")!)
                request.httpMethod = "POST"
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                request.httpBody = try JSONSerialization.data(withJSONObject: ["reason": "Manual freeze from Deployer"])
                
                let (_, _) = try await URLSession.shared.data(for: request)
                
                await MainActor.run {
                    isFrozen = true
                    frozenAt = ISO8601DateFormatter().string(from: Date())
                    frozenReason = "Manual freeze from Deployer"
                }
            } catch {
                await MainActor.run {
                    appState.error = AppError(message: "Failed to freeze AWS services", underlying: error)
                }
            }
        }
    }
    
    private func thawInstance() {
        isThawing = true
        Task {
            defer { isThawing = false }
            
            guard let baseURL = appState.radiantBaseURL,
                  let token = appState.radiantAuthToken else { return }
            
            do {
                var request = URLRequest(url: URL(string: "\(baseURL)/api/admin/spend-governor/instance/thaw")!)
                request.httpMethod = "POST"
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                
                let (_, _) = try await URLSession.shared.data(for: request)
                
                await MainActor.run {
                    isFrozen = false
                    frozenAt = nil
                    frozenReason = nil
                }
            } catch {
                await MainActor.run {
                    appState.error = AppError(message: "Failed to restore AWS services", underlying: error)
                }
            }
        }
    }
}

// MARK: - Summary Card

private struct SummaryCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .foregroundStyle(color)
                Spacer()
            }
            Text(value)
                .font(.title2.bold())
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.controlBackgroundColor), in: RoundedRectangle(cornerRadius: 10))
    }
}

// MARK: - API Response

private struct InstanceConfigResponse: Codable, Sendable {
    let budgetUsd: Double
    let periodHours: Int
    let warningThreshold: Double
    let suspendThreshold: Double
    let isFrozen: Bool
    let frozenAt: String?
    let frozenReason: String?
    let currentSpendUsd: Double
    let costReportIntervalHours: Int
    let lastCostReportAt: String?
}
