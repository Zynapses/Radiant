import SwiftUI

// MARK: - Governor Dashboard View
// Mirrors: apps/thinktank/lib/api/governor.ts (376 lines)

struct GovernorDashboardView: View {
    @State private var dashboard: GovernorDashboard?
    @State private var decisions: [GovernorDecision] = []
    @State private var savingsHistory: [SavingsHistoryEntry] = []
    @State private var isLoading = false
    @State private var selectedMode: GovernorMode = .balanced
    @State private var error: String?
    @State private var selectedTab = 0

    private let service = GovernorService()

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            content
        }
        .task { await loadDashboard() }
    }

    private var header: some View {
        VStack(spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Economic Governor")
                        .font(.title2.bold())
                    Text("Cost optimization and budget management")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if let dashboard, dashboard.alertTriggered {
                    Label("Budget Alert", systemImage: "exclamationmark.triangle.fill")
                        .font(.caption.bold())
                        .foregroundStyle(.red)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(Color.red.opacity(0.1))
                        .clipShape(Capsule())
                }
            }

            if let dashboard {
                HStack(spacing: 16) {
                    fuelGaugeCard(dashboard.fuelGauge)
                    modeCard(dashboard.modeIndicator)
                    savingsCard(dashboard.savingsSparkline)
                }
            }
        }
        .padding()
    }

    private func fuelGaugeCard(_ gauge: FuelGauge) -> some View {
        VStack(spacing: 8) {
            ZStack {
                Circle()
                    .stroke(Color.secondary.opacity(0.2), lineWidth: 6)
                Circle()
                    .trim(from: 0, to: gauge.level / 100)
                    .stroke(fuelColor(gauge.level), style: StrokeStyle(lineWidth: 6, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                VStack(spacing: 0) {
                    Text("\(Int(gauge.level))%")
                        .font(.title3.bold())
                    Text("fuel")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(width: 70, height: 70)
            Text(gauge.remaining)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text("resets \(gauge.resetIn)")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func modeCard(_ indicator: ModeIndicator) -> some View {
        VStack(spacing: 8) {
            Image(systemName: indicator.mode.systemImage)
                .font(.title)
                .foregroundStyle(modeColor(indicator.mode))
            Text(indicator.mode.displayName)
                .font(.headline)
            Text(indicator.description)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            Picker("Mode", selection: $selectedMode) {
                ForEach(GovernorMode.allCases, id: \.self) { mode in
                    Text(mode.displayName).tag(mode)
                }
            }
            .pickerStyle(.menu)
            .controlSize(.small)
            .onChange(of: selectedMode) { _, newMode in
                Task { await changeMode(newMode) }
            }
        }
        .padding()
        .frame(maxWidth: .infinity)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func savingsCard(_ sparkline: SavingsSparkline) -> some View {
        VStack(spacing: 8) {
            Text(sparkline.total)
                .font(.title2.bold())
                .foregroundStyle(.green)
            Text("saved (\(sparkline.percent))")
                .font(.caption)
                .foregroundStyle(.secondary)
            Divider()
            VStack(alignment: .leading, spacing: 4) {
                savingsRow("Self-Hosted", value: sparkline.breakdown.selfHosted)
                savingsRow("Arbitrage", value: sparkline.breakdown.arbitrage)
                savingsRow("Cache", value: sparkline.breakdown.cache)
            }
        }
        .padding()
        .frame(maxWidth: .infinity)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func savingsRow(_ label: String, value: String) -> some View {
        HStack {
            Text(label).font(.caption2).foregroundStyle(.secondary)
            Spacer()
            Text(value).font(.caption2.bold())
        }
    }

    @ViewBuilder
    private var content: some View {
        if isLoading && dashboard == nil {
            ProgressView("Loading governor dashboard...")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            VStack(spacing: 0) {
                Picker("Tab", selection: $selectedTab) {
                    Text("Metrics").tag(0)
                    Text("Tiers").tag(1)
                    Text("Rules").tag(2)
                    Text("Decisions").tag(3)
                }
                .pickerStyle(.segmented)
                .padding()

                Divider()

                switch selectedTab {
                case 0: metricsTab
                case 1: tiersTab
                case 2: rulesTab
                case 3: decisionsTab
                default: EmptyView()
                }
            }
        }
    }

    private var metricsTab: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let metrics = dashboard?.metrics {
                    GroupBox("Cost Summary") {
                        HStack(spacing: 20) {
                            MetricCard(title: "Total Cost", value: String(format: "$%.2f", metrics.totalCost), color: .red)
                            MetricCard(title: "Total Tokens", value: formatNumber(metrics.totalTokens), color: .blue)
                            MetricCard(title: "Savings", value: String(format: "$%.2f", metrics.savings.totalSavings), color: .green)
                            MetricCard(title: "Savings %", value: String(format: "%.1f%%", metrics.savings.savingsPercent), color: .purple)
                        }
                    }

                    if !metrics.costByModel.isEmpty {
                        GroupBox("Cost by Model") {
                            VStack(spacing: 6) {
                                ForEach(Array(metrics.costByModel.sorted(by: { $0.value > $1.value })), id: \.key) { model, cost in
                                    HStack {
                                        Text(model).font(.caption)
                                        Spacer()
                                        Text(String(format: "$%.4f", cost))
                                            .font(.caption.monospaced())
                                    }
                                }
                            }
                            .padding(4)
                        }
                    }
                }
            }
            .padding()
        }
    }

    private var tiersTab: some View {
        ScrollView {
            VStack(spacing: 8) {
                if let tiers = dashboard?.config.modelTiers {
                    ForEach(tiers) { tier in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(tier.label ?? tier.name)
                                    .font(.headline)
                                Text("\(tier.models.count) models")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 2) {
                                Text(String(format: "$%.6f/tok", tier.costPerToken))
                                    .font(.caption.monospaced())
                                HStack(spacing: 4) {
                                    Text("Q: \(String(format: "%.0f", tier.qualityScore))")
                                    Text("L: \(tier.avgLatencyMs)ms")
                                }
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                            }
                        }
                        .padding()
                        .background(.ultraThinMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                } else {
                    Text("No tiers configured").foregroundStyle(.secondary)
                }
            }
            .padding()
        }
    }

    private var rulesTab: some View {
        ScrollView {
            VStack(spacing: 8) {
                if let rules = dashboard?.config.arbitrageRules, !rules.isEmpty {
                    ForEach(rules) { rule in
                        HStack {
                            Circle()
                                .fill(rule.enabled ? Color.green : Color.gray)
                                .frame(width: 8, height: 8)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(rule.name).font(.headline)
                                Text("\(rule.condition.type) \(rule.condition.conditionOperator) \(rule.condition.value)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(rule.action.type)
                                .font(.caption)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.blue.opacity(0.1))
                                .clipShape(Capsule())
                        }
                        .padding()
                        .background(.ultraThinMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                } else {
                    Text("No arbitrage rules configured").foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .padding()
        }
    }

    private var decisionsTab: some View {
        ScrollView {
            VStack(spacing: 6) {
                if decisions.isEmpty {
                    Text("No recent decisions").foregroundStyle(.secondary)
                        .padding(.top, 40)
                } else {
                    ForEach(decisions) { decision in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(decision.model).font(.caption.bold())
                                Text(decision.reason)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 2) {
                                Text(String(format: "$%.4f", decision.cost))
                                    .font(.caption.monospaced())
                                Text("\(decision.tokens) tokens")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(8)
                        .background(.ultraThinMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                    }
                }
            }
            .padding()
        }
    }

    // MARK: - Actions

    private func loadDashboard() async {
        isLoading = true
        do {
            dashboard = try await service.getDashboard()
            selectedMode = dashboard?.config.mode ?? .balanced
            decisions = try await service.getRecentDecisions()
            savingsHistory = try await service.getSavingsHistory()
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    private func changeMode(_ mode: GovernorMode) async {
        do {
            try await service.setMode(mode)
            dashboard = try await service.getDashboard()
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Helpers

    private func fuelColor(_ level: Double) -> Color {
        if level >= 60 { return .green }
        if level >= 30 { return .orange }
        return .red
    }

    private func modeColor(_ mode: GovernorMode) -> Color {
        switch mode {
        case .economy: return .green
        case .balanced: return .blue
        case .performance: return .orange
        case .quality: return .purple
        case .custom: return .gray
        }
    }

    private func formatNumber(_ num: Int) -> String {
        if num >= 1_000_000 { return String(format: "%.1fM", Double(num) / 1_000_000) }
        if num >= 1_000 { return String(format: "%.1fK", Double(num) / 1_000) }
        return "\(num)"
    }
}

// MARK: - Metric Card

struct MetricCard: View {
    let title: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.title3.bold())
                .foregroundStyle(color)
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}
