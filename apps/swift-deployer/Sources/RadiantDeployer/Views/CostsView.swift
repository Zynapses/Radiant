// RADIANT v4.18.0 - Costs View
// Monitor costs, usage, and billing across instances

import SwiftUI

struct CostsView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedTimeRange: TimeRange = .week
    @State private var isRefreshing = false
    
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                headerSection
                summaryCardsSection
                
                HStack(alignment: .top, spacing: 24) {
                    VStack(spacing: 24) {
                        costBreakdownSection
                        topModelsSection
                    }
                    .frame(minWidth: 300, maxWidth: .infinity)
                    
                    VStack(spacing: 24) {
                        alertsSection
                        budgetSection
                    }
                    .frame(minWidth: 280, idealWidth: 320, maxWidth: 350)
                }
            }
            .padding(24)
        }
        .frame(minWidth: 600)
        .background(Color(nsColor: .windowBackgroundColor))
    }
    
    private var headerSection: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Cost Management")
                    .font(.largeTitle.bold())
                Text("Monitor spending across all environments")
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            Picker("Time Range", selection: $selectedTimeRange) {
                ForEach(TimeRange.allCases) { range in
                    Text(range.rawValue).tag(range)
                }
            }
            .pickerStyle(.segmented)
            .frame(width: 300)
            
            Button {
                refreshData()
            } label: {
                Image(systemName: "arrow.clockwise")
            }
            .buttonStyle(.bordered)
            .disabled(isRefreshing)
        }
    }
    
    private var summaryCardsSection: some View {
        HStack(spacing: 16) {
            CostSummaryCard(
                title: "Total Spend",
                value: "$2,847.50",
                change: "+12%",
                changePositive: false,
                icon: "dollarsign.circle.fill",
                color: .blue
            )
            
            CostSummaryCard(
                title: "External APIs",
                value: "$1,923.00",
                change: "+8%",
                changePositive: false,
                icon: "cloud.fill",
                color: .purple
            )
            
            CostSummaryCard(
                title: "Self-Hosted",
                value: "$624.50",
                change: "-5%",
                changePositive: true,
                icon: "server.rack",
                color: .orange
            )
            
            CostSummaryCard(
                title: "Infrastructure",
                value: "$300.00",
                change: "0%",
                changePositive: true,
                icon: "building.2.fill",
                color: .green
            )
        }
    }
    
    private var costBreakdownSection: some View {
        CostSection(title: "Cost Breakdown by Provider", icon: "chart.pie.fill") {
            VStack(spacing: 12) {
                ProviderCostRow(provider: "OpenAI", amount: 892.00, percentage: 31, color: .green)
                ProviderCostRow(provider: "Anthropic", amount: 756.00, percentage: 27, color: .orange)
                ProviderCostRow(provider: "Google AI", amount: 423.00, percentage: 15, color: .blue)
                ProviderCostRow(provider: "Self-Hosted (SageMaker)", amount: 624.50, percentage: 22, color: .purple)
                ProviderCostRow(provider: "Other", amount: 152.00, percentage: 5, color: .gray)
            }
        }
    }
    
    private var topModelsSection: some View {
        CostSection(title: "Top Models by Usage", icon: "cpu") {
            VStack(spacing: 8) {
                ModelUsageRow(model: "gpt-4o", provider: "OpenAI", requests: 45_200, cost: 542.40)
                ModelUsageRow(model: "claude-3-5-sonnet", provider: "Anthropic", requests: 32_100, cost: 481.50)
                ModelUsageRow(model: "gemini-1.5-pro", provider: "Google", requests: 28_400, cost: 284.00)
                ModelUsageRow(model: "llama-3.1-70b", provider: "Self-Hosted", requests: 52_000, cost: 312.00)
                ModelUsageRow(model: "gpt-4o-mini", provider: "OpenAI", requests: 125_000, cost: 187.50)
            }
        }
    }
    
    private var alertsSection: some View {
        CostSection(title: "Cost Alerts", icon: "exclamationmark.triangle.fill") {
            if costAlerts.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.title)
                        .foregroundStyle(.green)
                    Text("No active alerts")
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 20)
            } else {
                VStack(spacing: 8) {
                    ForEach(costAlerts) { alert in
                        CostAlertRow(alert: alert)
                    }
                }
            }
        }
    }
    
    private var budgetSection: some View {
        CostSection(title: "Budget Status", icon: "chart.bar.fill") {
            VStack(spacing: 16) {
                BudgetRow(name: "Monthly Budget", spent: 2847.50, budget: 5000, color: .blue)
                BudgetRow(name: "OpenAI Limit", spent: 892.00, budget: 1500, color: .green)
                BudgetRow(name: "Anthropic Limit", spent: 756.00, budget: 1000, color: .orange)
                BudgetRow(name: "Self-Hosted", spent: 624.50, budget: 1000, color: .purple)
            }
        }
    }
    
    private var costAlerts: [CostAlert] {
        [
            CostAlert(id: "1", type: .warning, message: "Anthropic spend approaching 80% of limit", timestamp: Date().addingTimeInterval(-3600)),
            CostAlert(id: "2", type: .info, message: "Self-hosted costs decreased 5% this week", timestamp: Date().addingTimeInterval(-86400))
        ]
    }
    
    private func refreshData() {
        isRefreshing = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            isRefreshing = false
        }
    }
}

enum TimeRange: String, CaseIterable, Identifiable {
    case day = "24h"
    case week = "7 Days"
    case month = "30 Days"
    case quarter = "90 Days"
    
    var id: String { rawValue }
}

struct CostSummaryCard: View {
    let title: String
    let value: String
    let change: String
    let changePositive: Bool
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundStyle(color)
                Spacer()
                HStack(spacing: 4) {
                    Image(systemName: changePositive ? "arrow.down.right" : "arrow.up.right")
                        .font(.caption2)
                    Text(change)
                        .font(.caption)
                }
                .foregroundStyle(changePositive ? .green : .red)
            }
            
            Text(value)
                .font(.system(size: 28, weight: .bold, design: .rounded))
            
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

struct CostSection<Content: View>: View {
    let title: String
    let icon: String
    @ViewBuilder let content: Content
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .foregroundStyle(.secondary)
                Text(title)
                    .font(.headline)
            }
            
            content
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

struct ProviderCostRow: View {
    let provider: String
    let amount: Double
    let percentage: Int
    let color: Color
    
    var body: some View {
        VStack(spacing: 6) {
            HStack {
                Circle()
                    .fill(color)
                    .frame(width: 10, height: 10)
                
                Text(provider)
                    .font(.subheadline)
                
                Spacer()
                
                Text(String(format: "$%.2f", amount))
                    .font(.subheadline.monospacedDigit())
                
                Text("\(percentage)%")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(width: 40, alignment: .trailing)
            }
            
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 3)
                        .fill(color.opacity(0.2))
                        .frame(height: 6)
                    
                    RoundedRectangle(cornerRadius: 3)
                        .fill(color)
                        .frame(width: geometry.size.width * CGFloat(percentage) / 100, height: 6)
                }
            }
            .frame(height: 6)
        }
    }
}

struct ModelUsageRow: View {
    let model: String
    let provider: String
    let requests: Int
    let cost: Double
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(model)
                    .font(.subheadline.weight(.medium))
                Text(provider)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 2) {
                Text(String(format: "$%.2f", cost))
                    .font(.subheadline.monospacedDigit())
                Text(formatRequests(requests))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(10)
        .background(Color(nsColor: .windowBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
    
    private func formatRequests(_ count: Int) -> String {
        if count >= 1000 {
            return String(format: "%.1fK requests", Double(count) / 1000)
        }
        return "\(count) requests"
    }
}

struct CostAlert: Identifiable {
    let id: String
    let type: AlertType
    let message: String
    let timestamp: Date
    
    enum AlertType {
        case warning, critical, info
        
        var color: Color {
            switch self {
            case .warning: return .orange
            case .critical: return .red
            case .info: return .blue
            }
        }
        
        var icon: String {
            switch self {
            case .warning: return "exclamationmark.triangle.fill"
            case .critical: return "xmark.circle.fill"
            case .info: return "info.circle.fill"
            }
        }
    }
}

struct CostAlertRow: View {
    let alert: CostAlert
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: alert.type.icon)
                .foregroundStyle(alert.type.color)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(alert.message)
                    .font(.subheadline)
                Text(alert.timestamp, style: .relative)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(alert.type.color.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct BudgetRow: View {
    let name: String
    let spent: Double
    let budget: Double
    let color: Color
    
    private var percentage: Double {
        min(spent / budget, 1.0)
    }
    
    private var isWarning: Bool {
        percentage >= 0.8
    }
    
    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Text(name)
                    .font(.subheadline)
                
                Spacer()
                
                Text(String(format: "$%.0f / $%.0f", spent, budget))
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
            
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(color.opacity(0.2))
                        .frame(height: 8)
                    
                    RoundedRectangle(cornerRadius: 4)
                        .fill(isWarning ? .orange : color)
                        .frame(width: geometry.size.width * percentage, height: 8)
                }
            }
            .frame(height: 8)
        }
    }
}

#Preview {
    CostsView()
        .environmentObject(AppState())
        .frame(width: 1200, height: 900)
}
