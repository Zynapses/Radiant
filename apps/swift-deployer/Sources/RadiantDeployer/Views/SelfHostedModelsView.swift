// RADIANT v4.18.0 - Self-Hosted Models View
// Configure and manage SageMaker-based self-hosted AI models

import SwiftUI

struct SelfHostedModel: Identifiable, Hashable {
    let id: String
    var name: String
    var modelFamily: String
    var version: String
    var status: ModelHostingStatus
    var instanceType: String
    var instanceCount: Int
    var endpointName: String?
    var createdAt: Date
    var monthlyCost: Double
    var requestsPerDay: Int
    var avgLatency: Int
    
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
    static func == (lhs: SelfHostedModel, rhs: SelfHostedModel) -> Bool { lhs.id == rhs.id }
}

enum ModelHostingStatus: String, CaseIterable {
    case deploying = "Deploying"
    case running = "Running"
    case stopped = "Stopped"
    case failed = "Failed"
    case updating = "Updating"
    
    var color: Color {
        switch self {
        case .deploying: return .blue
        case .running: return .green
        case .stopped: return .gray
        case .failed: return .red
        case .updating: return .orange
        }
    }
    
    var icon: String {
        switch self {
        case .deploying: return "arrow.up.circle"
        case .running: return "checkmark.circle.fill"
        case .stopped: return "stop.circle"
        case .failed: return "xmark.circle.fill"
        case .updating: return "arrow.triangle.2.circlepath"
        }
    }
}

struct SelfHostedModelsView: View {
    @EnvironmentObject var appState: AppState
    @State private var models: [SelfHostedModel] = []
    @State private var selectedModel: SelfHostedModel?
    @State private var showDeploySheet = false
    @State private var isLoading = true
    
    var body: some View {
        HSplitView {
            modelListPanel
                .frame(minWidth: 400, maxWidth: 500)
            modelDetailPanel
        }
        .navigationTitle("Self-Hosted Models")
        .onAppear { loadModels() }
        .sheet(isPresented: $showDeploySheet) {
            DeployModelSheet(onDeploy: { loadModels() })
        }
    }
    
    private var modelListPanel: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Self-Hosted Models")
                    .font(.headline)
                Spacer()
                Button { showDeploySheet = true } label: {
                    Image(systemName: "plus")
                }
                .buttonStyle(.borderless)
            }
            .padding()
            .background(.bar)
            
            Divider()
            
            summaryCardsRow
            
            Divider()
            
            if models.isEmpty {
                emptyStateView
            } else {
                List(models, selection: $selectedModel) { model in
                    SelfHostedModelRow(model: model).tag(model)
                }
                .listStyle(.plain)
            }
        }
    }
    
    private var summaryCardsRow: some View {
        HStack(spacing: 12) {
            MiniStatCard(title: "Running", value: "\(runningCount)", color: .green)
            MiniStatCard(title: "Monthly Cost", value: "$\(Int(totalMonthlyCost))", color: .orange)
            MiniStatCard(title: "Avg Latency", value: "\(avgLatency)ms", color: .blue)
        }
        .padding()
    }
    
    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "cpu").font(.system(size: 48)).foregroundStyle(.secondary)
            Text("No Self-Hosted Models").font(.headline)
            Text("Deploy your own models on SageMaker").foregroundStyle(.secondary)
            Button("Deploy Model") { showDeploySheet = true }
                .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    private var modelDetailPanel: some View {
        Group {
            if let model = selectedModel {
                SelfHostedModelDetailView(model: model, onAction: { loadModels() })
            } else {
                VStack {
                    Image(systemName: "sidebar.right").font(.system(size: 48)).foregroundStyle(.secondary)
                    Text("Select a model to view details").foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }
    
    private var runningCount: Int { models.filter { $0.status == .running }.count }
    private var totalMonthlyCost: Double { models.filter { $0.status == .running }.reduce(0) { $0 + $1.monthlyCost } }
    private var avgLatency: Int {
        let running = models.filter { $0.status == .running }
        return running.isEmpty ? 0 : running.reduce(0) { $0 + $1.avgLatency } / running.count
    }
    
    private func loadModels() {
        isLoading = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            models = [
                SelfHostedModel(id: "1", name: "Llama 3.1 70B", modelFamily: "Meta Llama", version: "3.1-70b", status: .running, instanceType: "ml.g5.12xlarge", instanceCount: 2, endpointName: "radiant-llama-70b-prod", createdAt: Date().addingTimeInterval(-604800), monthlyCost: 2400, requestsPerDay: 15000, avgLatency: 450),
                SelfHostedModel(id: "2", name: "Llama 3.1 8B", modelFamily: "Meta Llama", version: "3.1-8b", status: .running, instanceType: "ml.g5.2xlarge", instanceCount: 1, endpointName: "radiant-llama-8b-prod", createdAt: Date().addingTimeInterval(-1209600), monthlyCost: 800, requestsPerDay: 45000, avgLatency: 120),
                SelfHostedModel(id: "3", name: "Mistral 7B", modelFamily: "Mistral AI", version: "0.3", status: .stopped, instanceType: "ml.g5.2xlarge", instanceCount: 1, endpointName: nil, createdAt: Date().addingTimeInterval(-2592000), monthlyCost: 0, requestsPerDay: 0, avgLatency: 0),
                SelfHostedModel(id: "4", name: "SDXL Turbo", modelFamily: "Stability AI", version: "1.0", status: .running, instanceType: "ml.g5.4xlarge", instanceCount: 1, endpointName: "radiant-sdxl-prod", createdAt: Date().addingTimeInterval(-432000), monthlyCost: 1200, requestsPerDay: 8000, avgLatency: 850)
            ]
            isLoading = false
        }
    }
}

struct MiniStatCard: View {
    let title: String
    let value: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 4) {
            Text(value).font(.headline)
            Text(title).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(color.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct SelfHostedModelRow: View {
    let model: SelfHostedModel
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: model.status.icon)
                .foregroundStyle(model.status.color)
                .frame(width: 24)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(model.name).font(.headline)
                HStack(spacing: 8) {
                    Text(model.instanceType).font(.caption)
                    if model.instanceCount > 1 {
                        Text("x\(model.instanceCount)").font(.caption).foregroundStyle(.secondary)
                    }
                }
                .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            if model.status == .running {
                Text("$\(Int(model.monthlyCost))/mo")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
            
            Image(systemName: "chevron.right").foregroundStyle(.secondary).font(.caption)
        }
        .padding(.vertical, 8)
    }
}

struct SelfHostedModelDetailView: View {
    let model: SelfHostedModel
    let onAction: () -> Void
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                headerSection
                Divider()
                actionsSection
                Divider()
                configurationSection
                
                if model.status == .running {
                    Divider()
                    metricsSection
                }
                
                Divider()
                scalingSection
            }
            .padding(24)
        }
    }
    
    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading) {
                    Text(model.name).font(.title.bold())
                    Text("\(model.modelFamily) v\(model.version)").foregroundStyle(.secondary)
                }
                
                Spacer()
                
                HStack(spacing: 8) {
                    Image(systemName: model.status.icon)
                    Text(model.status.rawValue)
                }
                .font(.subheadline.weight(.medium))
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(model.status.color.opacity(0.15))
                .foregroundStyle(model.status.color)
                .clipShape(Capsule())
            }
            
            if let endpoint = model.endpointName {
                HStack {
                    Text("Endpoint:").font(.caption).foregroundStyle(.secondary)
                    Text(endpoint).font(.caption.monospaced())
                    Button { NSPasteboard.general.clearContents(); NSPasteboard.general.setString(endpoint, forType: .string) } label: {
                        Image(systemName: "doc.on.doc")
                    }
                    .buttonStyle(.borderless)
                }
            }
        }
    }
    
    private var actionsSection: some View {
        HStack(spacing: 12) {
            if model.status == .running {
                Button { } label: { Label("Stop", systemImage: "stop.fill") }
                    .buttonStyle(.bordered)
                
                Button { } label: { Label("Scale", systemImage: "arrow.up.arrow.down") }
                    .buttonStyle(.bordered)
            } else if model.status == .stopped {
                Button { } label: { Label("Start", systemImage: "play.fill") }
                    .buttonStyle(.borderedProminent)
            }
            
            Button { } label: { Label("Update Model", systemImage: "arrow.triangle.2.circlepath") }
                .buttonStyle(.bordered)
            
            Button(role: .destructive) { } label: { Label("Delete", systemImage: "trash") }
                .buttonStyle(.bordered)
        }
    }
    
    private var configurationSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Configuration").font(.headline)
            
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                ConfigItem(label: "Instance Type", value: model.instanceType)
                ConfigItem(label: "Instance Count", value: "\(model.instanceCount)")
                ConfigItem(label: "Created", value: model.createdAt.formatted(date: .abbreviated, time: .omitted))
                ConfigItem(label: "Monthly Cost", value: "$\(Int(model.monthlyCost))")
            }
        }
    }
    
    private var metricsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Performance Metrics").font(.headline)
            
            HStack(spacing: 16) {
                MetricBox(title: "Requests/Day", value: formatNumber(model.requestsPerDay), icon: "arrow.left.arrow.right", color: .blue)
                MetricBox(title: "Avg Latency", value: "\(model.avgLatency)ms", icon: "speedometer", color: .green)
                MetricBox(title: "Error Rate", value: "0.02%", icon: "exclamationmark.triangle", color: .orange)
                MetricBox(title: "Uptime", value: "99.9%", icon: "checkmark.shield", color: .purple)
            }
        }
    }
    
    private var scalingSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Auto-Scaling").font(.headline)
            
            VStack(spacing: 12) {
                HStack {
                    Text("Auto-scaling").font(.subheadline)
                    Spacer()
                    Toggle("", isOn: .constant(true)).labelsHidden()
                }
                
                HStack {
                    Text("Min Instances").font(.caption).foregroundStyle(.secondary)
                    Spacer()
                    Text("1").font(.subheadline)
                }
                
                HStack {
                    Text("Max Instances").font(.caption).foregroundStyle(.secondary)
                    Spacer()
                    Text("4").font(.subheadline)
                }
                
                HStack {
                    Text("Scale-out Threshold").font(.caption).foregroundStyle(.secondary)
                    Spacer()
                    Text("70% CPU").font(.subheadline)
                }
            }
            .padding()
            .background(Color(nsColor: .controlBackgroundColor))
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }
    
    private func formatNumber(_ num: Int) -> String {
        if num >= 1000 { return String(format: "%.1fK", Double(num) / 1000) }
        return "\(num)"
    }
}

struct ConfigItem: View {
    let label: String
    let value: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.caption).foregroundStyle(.secondary)
            Text(value).font(.subheadline)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct MetricBox: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon).font(.title2).foregroundStyle(color)
            Text(value).font(.title3.bold())
            Text(title).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(color.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

struct DeployModelSheet: View {
    @Environment(\.dismiss) var dismiss
    let onDeploy: () -> Void
    
    @State private var selectedFamily = "Meta Llama"
    @State private var selectedModel = "Llama 3.1 70B"
    @State private var instanceType = "ml.g5.12xlarge"
    @State private var instanceCount = 1
    
    let modelFamilies = ["Meta Llama", "Mistral AI", "Stability AI", "Anthropic (Custom)"]
    let instanceTypes = ["ml.g5.2xlarge", "ml.g5.4xlarge", "ml.g5.12xlarge", "ml.g5.24xlarge", "ml.p4d.24xlarge"]
    
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Deploy Self-Hosted Model").font(.headline)
                Spacer()
                Button { dismiss() } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary) }
                    .buttonStyle(.plain)
            }
            .padding()
            .background(.bar)
            
            Divider()
            
            Form {
                Section("Model") {
                    Picker("Model Family", selection: $selectedFamily) {
                        ForEach(modelFamilies, id: \.self) { Text($0) }
                    }
                    
                    Picker("Model", selection: $selectedModel) {
                        Text("Llama 3.1 70B").tag("Llama 3.1 70B")
                        Text("Llama 3.1 8B").tag("Llama 3.1 8B")
                        Text("Llama 3.2 3B").tag("Llama 3.2 3B")
                    }
                }
                
                Section("Infrastructure") {
                    Picker("Instance Type", selection: $instanceType) {
                        ForEach(instanceTypes, id: \.self) { Text($0) }
                    }
                    
                    Stepper("Instance Count: \(instanceCount)", value: $instanceCount, in: 1...10)
                }
                
                Section("Estimated Cost") {
                    HStack {
                        Text("Monthly Cost")
                        Spacer()
                        Text("~$\(estimatedCost)/month").font(.headline)
                    }
                }
            }
            .formStyle(.grouped)
            
            Divider()
            
            HStack {
                Button("Cancel") { dismiss() }.buttonStyle(.bordered)
                Spacer()
                Button("Deploy Model") { onDeploy(); dismiss() }
                    .buttonStyle(.borderedProminent)
            }
            .padding()
        }
        .frame(width: 500, height: 480)
    }
    
    var estimatedCost: Int {
        let baseCost: Int
        switch instanceType {
        case "ml.g5.2xlarge": baseCost = 800
        case "ml.g5.4xlarge": baseCost = 1200
        case "ml.g5.12xlarge": baseCost = 2400
        case "ml.g5.24xlarge": baseCost = 4800
        case "ml.p4d.24xlarge": baseCost = 12000
        default: baseCost = 1000
        }
        return baseCost * instanceCount
    }
}

#Preview {
    SelfHostedModelsView()
        .environmentObject(AppState())
        .frame(width: 1200, height: 800)
}
