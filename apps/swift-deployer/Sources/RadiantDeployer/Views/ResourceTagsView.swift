// RADIANT v7.2.0 - Resource Tags View
// UI for AWS resource tagging management

import SwiftUI

struct ResourceTagsView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedEnvironment = "dev"
    @State private var selectedResourceType: ResourceTagsService.ResourceType = .lambda
    @State private var resources: [ResourceTagsService.TaggedResource] = []
    @State private var selectedResources: Set<String> = []
    @State private var isLoading = false
    @State private var showingBulkTagSheet = false
    @State private var showingComplianceSheet = false
    @State private var complianceResults: [ResourceTagsService.TagComplianceResult] = []
    @State private var newTagKey = ""
    @State private var newTagValue = ""
    @State private var editingResource: ResourceTagsService.TaggedResource?
    
    private let region = "us-east-1"
    private let environments = ["dev", "staging", "prod"]
    
    var body: some View {
        VStack(spacing: 0) {
            toolbar
            Divider()
            
            HSplitView {
                resourceTypeList
                    .frame(minWidth: 200, maxWidth: 250)
                
                resourcesListView
            }
        }
        .sheet(isPresented: $showingBulkTagSheet) {
            bulkTagSheet
        }
        .sheet(isPresented: $showingComplianceSheet) {
            complianceSheet
        }
        .sheet(item: $editingResource) { resource in
            editTagsSheet(resource: resource)
        }
    }
    
    private var toolbar: some View {
        HStack {
            Image(systemName: "tag")
                .font(.title2)
            Text("Resource Tags Manager")
                .font(.headline)
            
            Spacer()
            
            Picker("Environment", selection: $selectedEnvironment) {
                ForEach(environments, id: \.self) { env in
                    Text(env.capitalized).tag(env)
                }
            }
            .frame(width: 120)
            .onChange(of: selectedEnvironment) { _, _ in loadResources() }
            
            Button {
                checkCompliance()
            } label: {
                Label("Check Compliance", systemImage: "checkmark.shield")
            }
            .disabled(resources.isEmpty)
            
            Button {
                showingBulkTagSheet = true
            } label: {
                Label("Bulk Tag", systemImage: "tag.fill")
            }
            .disabled(selectedResources.isEmpty)
            
            Button {
                loadResources()
            } label: {
                Image(systemName: "arrow.clockwise")
            }
            .disabled(isLoading)
        }
        .padding()
    }
    
    private var resourceTypeList: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Resource Types")
                .font(.caption)
                .foregroundColor(.secondary)
                .padding(.horizontal)
                .padding(.top)
            
            List(ResourceTagsService.ResourceType.allCases, id: \.self, selection: $selectedResourceType) { type in
                HStack {
                    Image(systemName: type.icon)
                        .frame(width: 20)
                    Text(type.displayName)
                        .font(.subheadline)
                }
                .tag(type)
            }
            .onChange(of: selectedResourceType) { _, _ in loadResources() }
        }
        .background(Color(.textBackgroundColor).opacity(0.5))
    }
    
    private var resourcesListView: some View {
        VStack(spacing: 0) {
            HStack {
                Text(selectedResourceType.displayName)
                    .font(.headline)
                Spacer()
                Text("\(resources.count) resources")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                if !selectedResources.isEmpty {
                    Text("• \(selectedResources.count) selected")
                        .font(.caption)
                        .foregroundColor(.accentColor)
                }
            }
            .padding()
            
            Divider()
            
            if isLoading {
                ProgressView("Loading resources...")
                    .frame(maxHeight: .infinity)
            } else if resources.isEmpty {
                emptyState
            } else {
                resourcesList
            }
        }
    }
    
    private var resourcesList: some View {
        List(resources, selection: $selectedResources) { resource in
            resourceRow(resource: resource)
                .tag(resource.id)
        }
    }
    
    private func resourceRow(resource: ResourceTagsService.TaggedResource) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: resource.resourceType.icon)
                    .foregroundColor(.accentColor)
                Text(resource.name)
                    .font(.subheadline.bold())
                
                Spacer()
                
                complianceBadge(for: resource)
                
                Button {
                    editingResource = resource
                } label: {
                    Image(systemName: "pencil")
                }
                .buttonStyle(.borderless)
            }
            
            if resource.tags.isEmpty {
                Text("No tags")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .italic()
            } else {
                tagsDisplay(tags: resource.tags)
            }
        }
        .padding(.vertical, 4)
    }
    
    private func tagsDisplay(tags: [String: String]) -> some View {
        TagsFlowLayout(spacing: 4) {
            ForEach(tags.sorted(by: { $0.key < $1.key }), id: \.key) { key, value in
                HStack(spacing: 4) {
                    Text(key)
                        .font(.caption2.bold())
                    Text("=")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    Text(value)
                        .font(.caption2)
                }
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(tagColor(key: key).opacity(0.2))
                .foregroundColor(tagColor(key: key))
                .cornerRadius(4)
            }
        }
    }
    
    private func complianceBadge(for resource: ResourceTagsService.TaggedResource) -> some View {
        let results = ResourceTagsService.shared.checkCompliance(resources: [resource])
        let isCompliant = results.first?.isCompliant ?? false
        
        return HStack(spacing: 4) {
            Image(systemName: isCompliant ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
            Text(isCompliant ? "Compliant" : "Non-compliant")
        }
        .font(.caption2)
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(isCompliant ? Color.green.opacity(0.2) : Color.orange.opacity(0.2))
        .foregroundColor(isCompliant ? .green : .orange)
        .cornerRadius(4)
    }
    
    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "tag.slash")
                .font(.system(size: 48))
                .foregroundColor(.secondary)
            Text("No Resources Found")
                .font(.headline)
            Text("No \(selectedResourceType.displayName.lowercased()) found in \(selectedEnvironment) environment")
                .font(.subheadline)
                .foregroundColor(.secondary)
            Button("Refresh") { loadResources() }
                .buttonStyle(.bordered)
        }
        .frame(maxHeight: .infinity)
    }
    
    // MARK: - Sheets
    
    private var bulkTagSheet: some View {
        VStack(spacing: 20) {
            HStack {
                Text("Bulk Tag Resources")
                    .font(.headline)
                Spacer()
                Button("Cancel") { showingBulkTagSheet = false }
                    .buttonStyle(.plain)
            }
            
            Text("Apply tags to \(selectedResources.count) selected resources")
                .foregroundColor(.secondary)
            
            GroupBox("Add Tag") {
                HStack {
                    TextField("Key", text: $newTagKey)
                        .textFieldStyle(.roundedBorder)
                    TextField("Value", text: $newTagValue)
                        .textFieldStyle(.roundedBorder)
                }
            }
            
            GroupBox("Standard Tags") {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(ResourceTagsService.standardTags) { policy in
                        HStack {
                            Text(policy.key)
                                .font(.subheadline.bold())
                            if policy.required {
                                Text("Required")
                                    .font(.caption2)
                                    .padding(.horizontal, 4)
                                    .background(Color.red.opacity(0.2))
                                    .foregroundColor(.red)
                                    .cornerRadius(2)
                            }
                            Spacer()
                            if let values = policy.allowedValues {
                                Text(values.joined(separator: ", "))
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
            }
            
            HStack {
                Button("Cancel") {
                    showingBulkTagSheet = false
                }
                .buttonStyle(.bordered)
                
                Spacer()
                
                Button("Apply Tags") {
                    applyBulkTags()
                }
                .buttonStyle(.borderedProminent)
                .disabled(newTagKey.isEmpty || newTagValue.isEmpty)
            }
        }
        .padding()
        .frame(width: 500)
    }
    
    private var complianceSheet: some View {
        VStack(spacing: 20) {
            HStack {
                Text("Tag Compliance Report")
                    .font(.headline)
                Spacer()
                Button("Close") { showingComplianceSheet = false }
                    .buttonStyle(.plain)
            }
            
            let compliant = complianceResults.filter(\.isCompliant).count
            let total = complianceResults.count
            
            HStack(spacing: 20) {
                VStack {
                    Text("\(compliant)/\(total)")
                        .font(.title.bold())
                        .foregroundColor(.green)
                    Text("Compliant")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                VStack {
                    Text("\(total - compliant)")
                        .font(.title.bold())
                        .foregroundColor(.orange)
                    Text("Non-compliant")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            Divider()
            
            List(complianceResults, id: \.resource.id) { result in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Image(systemName: result.isCompliant ? "checkmark.circle.fill" : "xmark.circle.fill")
                            .foregroundColor(result.isCompliant ? .green : .red)
                        Text(result.resource.name)
                            .font(.subheadline.bold())
                    }
                    
                    if !result.missingTags.isEmpty {
                        Text("Missing: \(result.missingTags.joined(separator: ", "))")
                            .font(.caption)
                            .foregroundColor(.orange)
                    }
                    
                    ForEach(Array(result.invalidTags.keys), id: \.self) { key in
                        Text("\(key): \(result.invalidTags[key] ?? "")")
                            .font(.caption)
                            .foregroundColor(.red)
                    }
                }
            }
        }
        .padding()
        .frame(width: 500, height: 500)
    }
    
    private func editTagsSheet(resource: ResourceTagsService.TaggedResource) -> some View {
        EditTagsView(resource: resource) {
            editingResource = nil
            loadResources()
        }
    }
    
    // MARK: - Actions
    
    private func loadResources() {
        isLoading = true
        selectedResources = []
        
        Task {
            do {
                let result = try await ResourceTagsService.shared.listResources(
                    resourceType: selectedResourceType,
                    environment: selectedEnvironment,
                    region: region
                )
                await MainActor.run {
                    resources = result
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    resources = []
                    isLoading = false
                }
            }
        }
    }
    
    private func checkCompliance() {
        Task {
            let results = await ResourceTagsService.shared.checkCompliance(resources: resources)
            await MainActor.run {
                complianceResults = results
                showingComplianceSheet = true
            }
        }
    }
    
    private func applyBulkTags() {
        let selectedResourcesList = resources.filter { selectedResources.contains($0.id) }
        let operation = ResourceTagsService.BulkTagOperation(
            resources: selectedResourcesList,
            tagsToAdd: [newTagKey: newTagValue],
            tagsToRemove: []
        )
        
        Task {
            try await ResourceTagsService.shared.bulkAddTags(operation: operation, region: region) { _ in }
            await MainActor.run {
                showingBulkTagSheet = false
                newTagKey = ""
                newTagValue = ""
                loadResources()
            }
        }
    }
    
    private func tagColor(key: String) -> Color {
        switch key {
        case "Environment": return .blue
        case "Project": return .purple
        case "Owner": return .green
        case "CostCenter": return .orange
        case "ManagedBy": return .cyan
        case "Version": return .pink
        default: return .gray
        }
    }
}

struct EditTagsView: View {
    let resource: ResourceTagsService.TaggedResource
    let onDismiss: () -> Void
    
    @State private var tags: [String: String]
    @State private var newKey = ""
    @State private var newValue = ""
    @State private var isSaving = false
    
    init(resource: ResourceTagsService.TaggedResource, onDismiss: @escaping () -> Void) {
        self.resource = resource
        self.onDismiss = onDismiss
        _tags = State(initialValue: resource.tags)
    }
    
    var body: some View {
        VStack(spacing: 20) {
            HStack {
                Text("Edit Tags: \(resource.name)")
                    .font(.headline)
                Spacer()
                Button("Cancel") { onDismiss() }
                    .buttonStyle(.plain)
            }
            
            List {
                ForEach(tags.sorted(by: { $0.key < $1.key }), id: \.key) { key, value in
                    HStack {
                        Text(key).font(.subheadline.bold())
                        Spacer()
                        Text(value).foregroundColor(.secondary)
                        Button {
                            tags.removeValue(forKey: key)
                        } label: {
                            Image(systemName: "trash")
                                .foregroundColor(.red)
                        }
                        .buttonStyle(.borderless)
                    }
                }
                
                HStack {
                    TextField("Key", text: $newKey)
                        .textFieldStyle(.roundedBorder)
                    TextField("Value", text: $newValue)
                        .textFieldStyle(.roundedBorder)
                    Button {
                        if !newKey.isEmpty && !newValue.isEmpty {
                            tags[newKey] = newValue
                            newKey = ""
                            newValue = ""
                        }
                    } label: {
                        Image(systemName: "plus.circle.fill")
                    }
                    .buttonStyle(.borderless)
                    .disabled(newKey.isEmpty || newValue.isEmpty)
                }
            }
            
            HStack {
                Button("Cancel") { onDismiss() }
                    .buttonStyle(.bordered)
                Spacer()
                Button("Save") { saveTags() }
                    .buttonStyle(.borderedProminent)
                    .disabled(isSaving)
            }
        }
        .padding()
        .frame(width: 450, height: 400)
    }
    
    private func saveTags() {
        isSaving = true
        Task {
            let toRemove = resource.tags.keys.filter { tags[$0] == nil }
            if !toRemove.isEmpty {
                try? await ResourceTagsService.shared.removeTags(arn: resource.arn, tagKeys: Array(toRemove), region: resource.region)
            }
            if !tags.isEmpty {
                try? await ResourceTagsService.shared.addTags(arn: resource.arn, tags: tags, region: resource.region)
            }
            await MainActor.run { onDismiss() }
        }
    }
}

struct TagsFlowLayout: Layout {
    var spacing: CGFloat = 8
    
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = arrange(proposal: proposal, subviews: subviews)
        return result.size
    }
    
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(proposal: proposal, subviews: subviews)
        for (index, position) in result.positions.enumerated() {
            subviews[index].place(at: CGPoint(x: bounds.minX + position.x, y: bounds.minY + position.y), proposal: .unspecified)
        }
    }
    
    private func arrange(proposal: ProposedViewSize, subviews: Subviews) -> (size: CGSize, positions: [CGPoint]) {
        let maxWidth = proposal.width ?? .infinity
        var positions: [CGPoint] = []
        var currentX: CGFloat = 0
        var currentY: CGFloat = 0
        var lineHeight: CGFloat = 0
        
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if currentX + size.width > maxWidth && currentX > 0 {
                currentX = 0
                currentY += lineHeight + spacing
                lineHeight = 0
            }
            positions.append(CGPoint(x: currentX, y: currentY))
            currentX += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
        
        return (CGSize(width: maxWidth, height: currentY + lineHeight), positions)
    }
}
