// RADIANT v4.18.0 - A/B Testing View
// Experiment configuration and management for feature testing

import SwiftUI

struct Experiment: Identifiable, Hashable {
    let id: String
    var name: String
    var description: String
    var status: ExperimentStatus
    var variants: [Variant]
    var trafficAllocation: Double
    var startDate: Date?
    var endDate: Date?
    var targetAudience: String
    var metric: String
    var createdAt: Date
    
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
    static func == (lhs: Experiment, rhs: Experiment) -> Bool { lhs.id == rhs.id }
}

struct Variant: Identifiable, Codable {
    let id: String
    var name: String
    var allocation: Double
    var conversions: Int
    var impressions: Int
    
    var conversionRate: Double {
        impressions > 0 ? Double(conversions) / Double(impressions) * 100 : 0
    }
}

enum ExperimentStatus: String, CaseIterable {
    case draft = "Draft"
    case running = "Running"
    case paused = "Paused"
    case completed = "Completed"
    case archived = "Archived"
    
    var color: Color {
        switch self {
        case .draft: return .gray
        case .running: return .green
        case .paused: return .orange
        case .completed: return .blue
        case .archived: return .secondary
        }
    }
}

struct ABTestingView: View {
    @EnvironmentObject var appState: AppState
    @State private var experiments: [Experiment] = []
    @State private var selectedExperiment: Experiment?
    @State private var showCreateSheet = false
    @State private var filterStatus: ExperimentStatus?
    @State private var searchText = ""
    
    var body: some View {
        HSplitView {
            experimentListPanel
                .frame(minWidth: 400, maxWidth: 500)
            experimentDetailPanel
        }
        .navigationTitle("A/B Testing")
        .onAppear { loadExperiments() }
        .sheet(isPresented: $showCreateSheet) {
            CreateExperimentSheet(onCreate: { loadExperiments() })
        }
    }
    
    private var experimentListPanel: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Experiments")
                    .font(.headline)
                Spacer()
                Button { showCreateSheet = true } label: {
                    Image(systemName: "plus")
                }
                .buttonStyle(.borderless)
            }
            .padding()
            .background(.bar)
            
            Divider()
            
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                TextField("Search experiments...", text: $searchText)
                    .textFieldStyle(.plain)
            }
            .padding(8)
            .background(Color(nsColor: .controlBackgroundColor))
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .padding(.horizontal)
            .padding(.top, 8)
            
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    FilterChip(title: "All", isSelected: filterStatus == nil) { filterStatus = nil }
                    ForEach(ExperimentStatus.allCases, id: \.self) { status in
                        FilterChip(title: status.rawValue, isSelected: filterStatus == status) { filterStatus = status }
                    }
                }
                .padding(.horizontal)
                .padding(.vertical, 8)
            }
            
            Divider()
            
            if filteredExperiments.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "flask").font(.system(size: 48)).foregroundStyle(.secondary)
                    Text("No Experiments").font(.headline)
                    Text("Create your first A/B test").foregroundStyle(.secondary)
                    Button("Create Experiment") { showCreateSheet = true }
                        .buttonStyle(.borderedProminent)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(filteredExperiments, selection: $selectedExperiment) { experiment in
                    ExperimentRow(experiment: experiment).tag(experiment)
                }
                .listStyle(.plain)
            }
        }
    }
    
    private var experimentDetailPanel: some View {
        Group {
            if let experiment = selectedExperiment {
                ExperimentDetailView(experiment: experiment, onUpdate: { loadExperiments() })
            } else {
                VStack {
                    Image(systemName: "sidebar.right").font(.system(size: 48)).foregroundStyle(.secondary)
                    Text("Select an experiment").foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }
    
    private var filteredExperiments: [Experiment] {
        experiments.filter { exp in
            let matchesSearch = searchText.isEmpty || exp.name.localizedCaseInsensitiveContains(searchText)
            let matchesStatus = filterStatus == nil || exp.status == filterStatus
            return matchesSearch && matchesStatus
        }
    }
    
    private func loadExperiments() {
        experiments = [
            Experiment(id: "exp-001", name: "New Chat UI", description: "Testing redesigned chat interface", status: .running, variants: [
                Variant(id: "control", name: "Control", allocation: 50, conversions: 1234, impressions: 5000),
                Variant(id: "variant-a", name: "Variant A", allocation: 50, conversions: 1456, impressions: 5000)
            ], trafficAllocation: 100, startDate: Date().addingTimeInterval(-604800), endDate: nil, targetAudience: "All Users", metric: "Engagement Rate", createdAt: Date().addingTimeInterval(-604800)),
            
            Experiment(id: "exp-002", name: "Model Selection Flow", description: "Simplified model picker", status: .paused, variants: [
                Variant(id: "control", name: "Control", allocation: 50, conversions: 890, impressions: 3000),
                Variant(id: "variant-a", name: "Variant A", allocation: 50, conversions: 920, impressions: 3000)
            ], trafficAllocation: 50, startDate: Date().addingTimeInterval(-1209600), endDate: nil, targetAudience: "Pro Users", metric: "Completion Rate", createdAt: Date().addingTimeInterval(-1209600)),
            
            Experiment(id: "exp-003", name: "Pricing Page", description: "New pricing layout", status: .completed, variants: [
                Variant(id: "control", name: "Control", allocation: 50, conversions: 234, impressions: 2000),
                Variant(id: "variant-a", name: "Variant A", allocation: 50, conversions: 312, impressions: 2000)
            ], trafficAllocation: 100, startDate: Date().addingTimeInterval(-2592000), endDate: Date().addingTimeInterval(-604800), targetAudience: "Free Users", metric: "Conversion Rate", createdAt: Date().addingTimeInterval(-2592000))
        ]
    }
}

struct FilterChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.caption)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? Color.accentColor : Color(nsColor: .controlBackgroundColor))
                .foregroundStyle(isSelected ? .white : .primary)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

struct ExperimentRow: View {
    let experiment: Experiment
    
    var body: some View {
        HStack(spacing: 12) {
            Circle().fill(experiment.status.color).frame(width: 10, height: 10)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(experiment.name).font(.headline)
                HStack(spacing: 8) {
                    Text(experiment.status.rawValue).font(.caption)
                    Text("\(experiment.variants.count) variants").font(.caption).foregroundStyle(.secondary)
                }
            }
            
            Spacer()
            Image(systemName: "chevron.right").foregroundStyle(.secondary).font(.caption)
        }
        .padding(.vertical, 8)
    }
}

struct ExperimentDetailView: View {
    let experiment: Experiment
    let onUpdate: () -> Void
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                headerSection
                Divider()
                variantsSection
                Divider()
                resultsSection
                Divider()
                settingsSection
            }
            .padding(24)
        }
    }
    
    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading) {
                    Text(experiment.name).font(.title.bold())
                    Text(experiment.description).foregroundStyle(.secondary)
                }
                Spacer()
                Text(experiment.status.rawValue.uppercased())
                    .font(.caption.bold())
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(experiment.status.color)
                    .foregroundStyle(.white)
                    .clipShape(Capsule())
            }
            
            HStack(spacing: 24) {
                Label(experiment.targetAudience, systemImage: "person.2")
                Label(experiment.metric, systemImage: "chart.line.uptrend.xyaxis")
                Label("\(Int(experiment.trafficAllocation))% traffic", systemImage: "arrow.left.arrow.right")
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
    }
    
    private var variantsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Variants").font(.headline)
            
            ForEach(experiment.variants) { variant in
                VariantCard(variant: variant, isWinning: isWinningVariant(variant))
            }
        }
    }
    
    private var resultsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Results").font(.headline)
            
            HStack(spacing: 16) {
                ResultCard(title: "Total Impressions", value: "\(totalImpressions)", icon: "eye")
                ResultCard(title: "Total Conversions", value: "\(totalConversions)", icon: "checkmark.circle")
                ResultCard(title: "Lift", value: lift, icon: "arrow.up.right")
                ResultCard(title: "Confidence", value: "95%", icon: "chart.bar")
            }
        }
    }
    
    private var settingsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Actions").font(.headline)
            
            HStack(spacing: 12) {
                if experiment.status == .running {
                    Button { } label: { Label("Pause", systemImage: "pause.fill") }
                        .buttonStyle(.bordered)
                } else if experiment.status == .paused {
                    Button { } label: { Label("Resume", systemImage: "play.fill") }
                        .buttonStyle(.borderedProminent)
                }
                
                if experiment.status != .completed {
                    Button { } label: { Label("End Experiment", systemImage: "stop.fill") }
                        .buttonStyle(.bordered)
                }
                
                Button { } label: { Label("Export Data", systemImage: "square.and.arrow.up") }
                    .buttonStyle(.bordered)
            }
        }
    }
    
    private func isWinningVariant(_ variant: Variant) -> Bool {
        variant.conversionRate == experiment.variants.map(\.conversionRate).max()
    }
    
    private var totalImpressions: Int { experiment.variants.reduce(0) { $0 + $1.impressions } }
    private var totalConversions: Int { experiment.variants.reduce(0) { $0 + $1.conversions } }
    
    private var lift: String {
        guard experiment.variants.count >= 2 else { return "N/A" }
        let control = experiment.variants[0].conversionRate
        let variant = experiment.variants[1].conversionRate
        let liftValue = ((variant - control) / control) * 100
        return String(format: "%+.1f%%", liftValue)
    }
}

struct VariantCard: View {
    let variant: Variant
    let isWinning: Bool
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(variant.name).font(.headline)
                    if isWinning {
                        Image(systemName: "crown.fill").foregroundStyle(.yellow)
                    }
                }
                Text("\(Int(variant.allocation))% allocation").font(.caption).foregroundStyle(.secondary)
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 4) {
                Text(String(format: "%.2f%%", variant.conversionRate)).font(.title2.bold())
                Text("\(variant.conversions)/\(variant.impressions)").font(.caption).foregroundStyle(.secondary)
            }
        }
        .padding(16)
        .background(isWinning ? Color.green.opacity(0.1) : Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

struct ResultCard: View {
    let title: String
    let value: String
    let icon: String
    
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon).font(.title2).foregroundStyle(.secondary)
            Text(value).font(.title2.bold())
            Text(title).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

struct CreateExperimentSheet: View {
    @Environment(\.dismiss) var dismiss
    @State private var name = ""
    @State private var description = ""
    @State private var targetAudience = "All Users"
    @State private var metric = "Conversion Rate"
    let onCreate: () -> Void
    
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Create Experiment").font(.headline)
                Spacer()
                Button { dismiss() } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary) }
                    .buttonStyle(.plain)
            }
            .padding()
            .background(.bar)
            
            Divider()
            
            Form {
                Section("Basic Info") {
                    TextField("Name", text: $name)
                    TextField("Description", text: $description)
                }
                
                Section("Targeting") {
                    Picker("Target Audience", selection: $targetAudience) {
                        Text("All Users").tag("All Users")
                        Text("Free Users").tag("Free Users")
                        Text("Pro Users").tag("Pro Users")
                    }
                    
                    Picker("Success Metric", selection: $metric) {
                        Text("Conversion Rate").tag("Conversion Rate")
                        Text("Engagement Rate").tag("Engagement Rate")
                        Text("Retention Rate").tag("Retention Rate")
                    }
                }
            }
            .formStyle(.grouped)
            
            Divider()
            
            HStack {
                Button("Cancel") { dismiss() }.buttonStyle(.bordered)
                Spacer()
                Button("Create") { onCreate(); dismiss() }
                    .buttonStyle(.borderedProminent)
                    .disabled(name.isEmpty)
            }
            .padding()
        }
        .frame(width: 500, height: 450)
    }
}

#Preview {
    ABTestingView()
        .environmentObject(AppState())
        .frame(width: 1200, height: 800)
}
