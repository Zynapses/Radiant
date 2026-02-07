// RADIANT v7.2.0 - Rollback View
// UI for version tracking and rollback operations

import SwiftUI

struct RollbackView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedResourceType: RollbackService.ResourceType = .lambda
    @State private var resourceName: String = ""
    @State private var versions: [RollbackService.ResourceVersion] = []
    @State private var selectedVersion: RollbackService.ResourceVersion?
    @State private var rollbackPlan: RollbackService.RollbackPlan?
    @State private var isLoading = false
    @State private var isRollingBack = false
    @State private var showConfirmation = false
    @State private var progressLog: [String] = []
    @State private var rollbackResult: RollbackService.RollbackResult?
    @State private var errorMessage: String?
    
    private let region = "us-east-1"
    
    var body: some View {
        VStack(spacing: 0) {
            toolbar
            Divider()
            
            HSplitView {
                resourceSelector
                    .frame(minWidth: 300, maxWidth: 400)
                
                if let plan = rollbackPlan {
                    rollbackPlanView(plan: plan)
                } else if !versions.isEmpty {
                    versionsListView
                } else {
                    emptyState
                }
            }
        }
        .alert("Confirm Rollback", isPresented: $showConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Rollback", role: .destructive) { executeRollback() }
        } message: {
            if let plan = rollbackPlan {
                Text("This will rollback \(plan.targetVersion.resourceName) to version \(plan.targetVersion.version). Estimated downtime: \(formatDuration(plan.estimatedDowntime))")
            }
        }
    }
    
    private var toolbar: some View {
        HStack {
            Image(systemName: "arrow.uturn.backward.circle")
                .font(.title2)
            Text("Rollback Manager")
                .font(.headline)
            
            Spacer()
            
            if isRollingBack {
                ProgressView()
                    .scaleEffect(0.8)
                Text("Rolling back...")
                    .foregroundColor(.secondary)
            }
        }
        .padding()
    }
    
    private var resourceSelector: some View {
        VStack(alignment: .leading, spacing: 16) {
            GroupBox("Resource Selection") {
                VStack(alignment: .leading, spacing: 12) {
                    Picker("Resource Type", selection: $selectedResourceType) {
                        ForEach(RollbackService.ResourceType.allCases, id: \.self) { type in
                            Label(type.rawValue, systemImage: type.icon).tag(type)
                        }
                    }
                    .onChange(of: selectedResourceType) { _, _ in
                        versions = []
                        selectedVersion = nil
                        rollbackPlan = nil
                    }
                    
                    TextField("Resource Name", text: $resourceName)
                        .textFieldStyle(.roundedBorder)
                    
                    Text(resourcePlaceholder)
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    Button {
                        loadVersions()
                    } label: {
                        HStack {
                            Image(systemName: "magnifyingglass")
                            Text("Find Versions")
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(resourceName.isEmpty || isLoading)
                }
                .padding(.vertical, 8)
            }
            
            if let result = rollbackResult {
                rollbackResultView(result: result)
            }
            
            if !progressLog.isEmpty {
                GroupBox("Progress") {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 4) {
                            ForEach(progressLog.indices, id: \.self) { index in
                                Text(progressLog[index])
                                    .font(.caption.monospaced())
                                    .foregroundColor(.secondary)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .frame(maxHeight: 150)
                }
            }
            
            Spacer()
        }
        .padding()
        .background(Color(.textBackgroundColor).opacity(0.5))
    }
    
    private var resourcePlaceholder: String {
        switch selectedResourceType {
        case .lambda: return "e.g., radiant-prod-api"
        case .ecs: return "e.g., cluster-name/service-name"
        case .cloudformation: return "e.g., radiant-prod-stack"
        case .rds: return "e.g., radiant-prod-aurora-cluster"
        }
    }
    
    private var versionsListView: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Available Versions")
                    .font(.headline)
                Spacer()
                Text("\(versions.count) versions")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding()
            
            Divider()
            
            List(versions, selection: $selectedVersion) { version in
                versionRow(version: version)
                    .tag(version)
            }
            .onChange(of: selectedVersion) { _, newValue in
                if let version = newValue {
                    createPlan(for: version)
                }
            }
        }
    }
    
    private func versionRow(version: RollbackService.ResourceVersion) -> some View {
        HStack(spacing: 12) {
            Image(systemName: version.resourceType.icon)
                .foregroundColor(version.isCurrent ? .green : .secondary)
                .frame(width: 24)
            
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(version.version)
                        .font(.subheadline.bold())
                    if version.isCurrent {
                        Text("CURRENT")
                            .font(.caption2.bold())
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.green.opacity(0.2))
                            .foregroundColor(.green)
                            .cornerRadius(4)
                    }
                }
                
                Text(version.deployedAt.formatted(date: .abbreviated, time: .shortened))
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                if let desc = version.description {
                    Text(desc)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
            }
            
            Spacer()
            
            if !version.metadata.isEmpty {
                VStack(alignment: .trailing, spacing: 2) {
                    ForEach(Array(version.metadata.prefix(2)), id: \.key) { key, value in
                        Text("\(key): \(value)")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
        .padding(.vertical, 4)
        .opacity(version.isCurrent ? 0.6 : 1.0)
    }
    
    private func rollbackPlanView(plan: RollbackService.RollbackPlan) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                GroupBox {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Image(systemName: plan.targetVersion.resourceType.icon)
                                .font(.title)
                            VStack(alignment: .leading) {
                                Text("Rollback to")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Text(plan.targetVersion.version)
                                    .font(.title2.bold())
                            }
                        }
                        
                        Divider()
                        
                        HStack(spacing: 24) {
                            VStack(alignment: .leading) {
                                Text("Estimated Downtime")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Text(formatDuration(plan.estimatedDowntime))
                                    .font(.headline)
                            }
                            
                            VStack(alignment: .leading) {
                                Text("Affected Resources")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Text("\(plan.affectedResources.count)")
                                    .font(.headline)
                            }
                            
                            if plan.requiresApproval {
                                VStack(alignment: .leading) {
                                    Text("Requires")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    Label("Manual Approval", systemImage: "hand.raised")
                                        .font(.subheadline)
                                        .foregroundColor(.orange)
                                }
                            }
                        }
                    }
                    .padding(.vertical, 8)
                }
                
                GroupBox("Rollback Steps") {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(plan.steps) { step in
                            HStack(alignment: .top, spacing: 12) {
                                Text("\(step.order)")
                                    .font(.caption.bold())
                                    .frame(width: 20, height: 20)
                                    .background(Circle().fill(Color.accentColor.opacity(0.2)))
                                
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(step.action)
                                        .font(.subheadline.bold())
                                    Text(step.description)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                    }
                    .padding(.vertical, 8)
                }
                
                if plan.requiresApproval {
                    HStack {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(.orange)
                        Text("This rollback requires manual approval due to potential data impact.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding()
                    .background(Color.orange.opacity(0.1))
                    .cornerRadius(8)
                }
                
                HStack {
                    Button("Cancel") {
                        rollbackPlan = nil
                        selectedVersion = nil
                    }
                    .buttonStyle(.bordered)
                    
                    Spacer()
                    
                    Button {
                        showConfirmation = true
                    } label: {
                        Label("Execute Rollback", systemImage: "arrow.uturn.backward")
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.orange)
                    .disabled(isRollingBack)
                }
            }
            .padding()
        }
    }
    
    private func rollbackResultView(result: RollbackService.RollbackResult) -> some View {
        GroupBox {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: result.success ? "checkmark.circle.fill" : "xmark.circle.fill")
                        .foregroundColor(result.success ? .green : .red)
                    Text(result.success ? "Rollback Successful" : "Rollback Failed")
                        .font(.subheadline.bold())
                }
                
                Text("\(result.previousVersion) → \(result.newVersion)")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Text("Duration: \(formatDuration(result.duration))")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                if let error = result.error {
                    Text(error)
                        .font(.caption)
                        .foregroundColor(.red)
                }
            }
        }
    }
    
    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "arrow.uturn.backward.circle")
                .font(.system(size: 48))
                .foregroundColor(.secondary)
            Text("Select a Resource")
                .font(.headline)
            Text("Choose a resource type and enter its name to view available versions for rollback")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }
    
    private func loadVersions() {
        isLoading = true
        versions = []
        selectedVersion = nil
        rollbackPlan = nil
        
        Task {
            do {
                let result = try await RollbackService.shared.listVersions(
                    resourceType: selectedResourceType,
                    resourceName: resourceName,
                    region: region
                )
                await MainActor.run {
                    versions = result
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }
    
    private func createPlan(for version: RollbackService.ResourceVersion) {
        guard !version.isCurrent else { return }
        
        Task {
            do {
                let plan = try await RollbackService.shared.createRollbackPlan(to: version, region: region)
                await MainActor.run {
                    rollbackPlan = plan
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                }
            }
        }
    }
    
    private func executeRollback() {
        guard let plan = rollbackPlan else { return }
        
        isRollingBack = true
        progressLog = []
        rollbackResult = nil
        
        Task {
            let result = try await RollbackService.shared.executeRollback(plan: plan, region: region) { message in
                Task { @MainActor in
                    progressLog.append("[\(Date().formatted(date: .omitted, time: .standard))] \(message)")
                }
            }
            
            await MainActor.run {
                rollbackResult = result
                isRollingBack = false
                if result.success {
                    rollbackPlan = nil
                    loadVersions()
                }
            }
        }
    }
    
    private func formatDuration(_ seconds: TimeInterval) -> String {
        if seconds < 60 {
            return "\(Int(seconds))s"
        } else if seconds < 3600 {
            return "\(Int(seconds / 60))m"
        } else {
            return "\(Int(seconds / 3600))h \(Int((seconds.truncatingRemainder(dividingBy: 3600)) / 60))m"
        }
    }
}
