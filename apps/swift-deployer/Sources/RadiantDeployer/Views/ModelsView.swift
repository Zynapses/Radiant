import SwiftUI

struct ModelsView: View {
    @EnvironmentObject var appState: AppState
    @State private var searchText = ""
    @State private var selectedCategory = "All"
    @State private var models: [AIRegistryService.AIModel] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    
    private let categories = ["All", "text_generation", "reasoning", "image_generation", "video_generation", "audio", "embedding", "code_generation", "search"]
    
    private var filteredModels: [AIRegistryService.AIModel] {
        models.filter { model in
            let matchesSearch = searchText.isEmpty || 
                model.displayName.localizedCaseInsensitiveContains(searchText) ||
                model.providerId.localizedCaseInsensitiveContains(searchText)
            let matchesCategory = selectedCategory == "All" || model.category == selectedCategory
            return matchesSearch && matchesCategory
        }
    }
    
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Picker("Category", selection: $selectedCategory) {
                    Text("All").tag("All")
                    ForEach(categories.dropFirst(), id: \.self) { category in
                        Text(categoryLabel(category)).tag(category)
                    }
                }
                .pickerStyle(.segmented)
                .frame(maxWidth: 500)
                
                Spacer()
            }
            .padding()
            .background(.bar)
            
            Group {
                if isLoading {
                    ProgressView("Loading models...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let error = errorMessage {
                    VStack(spacing: 16) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.largeTitle)
                            .foregroundStyle(.orange)
                        Text("Failed to load models")
                            .font(.headline)
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Button("Retry") {
                            Task { await loadModels() }
                        }
                        .buttonStyle(.bordered)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if filteredModels.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "cpu")
                            .font(.largeTitle)
                            .foregroundStyle(.secondary)
                        Text("No models found")
                            .font(.headline)
                        Text("Connect to a Radiant instance to view models")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(filteredModels) { model in
                            ModelRow(model: model)
                        }
                    }
                }
            }
        }
        .navigationTitle("AI Models")
        .searchable(text: $searchText, prompt: "Search models...")
        .task {
            await loadModels()
        }
        .refreshable {
            await loadModels()
        }
    }
    
    private func loadModels() async {
        isLoading = true
        errorMessage = nil
        
        do {
            let registry = appState.aiRegistryService
            models = try await registry.fetchModels()
            isLoading = false
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }
    
    private func categoryLabel(_ category: String) -> String {
        switch category {
        case "text_generation": return "Text"
        case "reasoning": return "Reasoning"
        case "image_generation": return "Image"
        case "video_generation": return "Video"
        case "audio": return "Audio"
        case "embedding": return "Embedding"
        case "code_generation": return "Code"
        case "search": return "Search"
        default: return category.capitalized
        }
    }
}

struct ModelRow: View {
    let model: AIRegistryService.AIModel
    
    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                HStack {
                    Text(model.displayName)
                        .font(.headline)
                    
                    if !model.enabled {
                        Text("Disabled")
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(.gray.opacity(0.2))
                            .clipShape(Capsule())
                    }
                }
                
                HStack {
                    Text(model.providerId)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    
                    Text("•")
                        .foregroundStyle(.secondary)
                    
                    Text(categoryLabel(model.category))
                        .font(.caption)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(.blue.opacity(0.1))
                        .clipShape(Capsule())
                    
                    if let specialty = model.specialty {
                        Text(specialty)
                            .font(.caption)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(.purple.opacity(0.1))
                            .clipShape(Capsule())
                    }
                }
                
                if let description = model.description {
                    Text(description)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            
            Spacer()
            
            VStack(alignment: .trailing) {
                if let context = model.contextWindow, context > 0 {
                    Text(formatContext(context))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                Text("Tier \(model.minTier)+")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
    
    private func formatContext(_ tokens: Int) -> String {
        if tokens >= 1_000_000 {
            return "\(tokens / 1_000_000)M ctx"
        } else if tokens >= 1_000 {
            return "\(tokens / 1_000)K ctx"
        }
        return "\(tokens) ctx"
    }
    
    private func categoryLabel(_ category: String) -> String {
        switch category {
        case "text_generation": return "Text"
        case "reasoning": return "Reasoning"
        case "image_generation": return "Image"
        case "video_generation": return "Video"
        case "audio": return "Audio"
        case "embedding": return "Embedding"
        case "code_generation": return "Code"
        case "search": return "Search"
        default: return category.capitalized
        }
    }
}

#Preview {
    ModelsView()
        .environmentObject(AppState())
        .frame(width: 600, height: 500)
}
