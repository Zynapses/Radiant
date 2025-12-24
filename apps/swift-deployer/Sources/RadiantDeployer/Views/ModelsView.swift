import SwiftUI

struct ModelsView: View {
    @EnvironmentObject var appState: AppState
    @State private var searchText = ""
    @State private var selectedCategory = "All"
    
    private let categories = ["All", "LLM", "Vision", "Audio", "Multimodal", "Embedding"]
    
    private let models = [
        Model(id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", category: "Multimodal", context: 128000),
        Model(id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic", category: "LLM", context: 200000),
        Model(id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: "Google", category: "Multimodal", context: 1000000),
        Model(id: "mistral-large", name: "Mistral Large", provider: "Mistral", category: "LLM", context: 128000),
        Model(id: "command-r-plus", name: "Command R+", provider: "Cohere", category: "LLM", context: 128000),
        Model(id: "dall-e-3", name: "DALL-E 3", provider: "OpenAI", category: "Vision", context: 0),
        Model(id: "whisper-1", name: "Whisper", provider: "OpenAI", category: "Audio", context: 0),
        Model(id: "text-embedding-3-large", name: "text-embedding-3-large", provider: "OpenAI", category: "Embedding", context: 8191),
    ]
    
    private var filteredModels: [Model] {
        models.filter { model in
            let matchesSearch = searchText.isEmpty || 
                model.name.localizedCaseInsensitiveContains(searchText) ||
                model.provider.localizedCaseInsensitiveContains(searchText)
            let matchesCategory = selectedCategory == "All" || model.category == selectedCategory
            return matchesSearch && matchesCategory
        }
    }
    
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Picker("Category", selection: $selectedCategory) {
                    ForEach(categories, id: \.self) { category in
                        Text(category).tag(category)
                    }
                }
                .pickerStyle(.segmented)
                .frame(maxWidth: 400)
                
                Spacer()
            }
            .padding()
            .background(.bar)
            
            List {
                ForEach(filteredModels) { model in
                    ModelRow(model: model)
                }
            }
        }
        .navigationTitle("AI Models")
        .searchable(text: $searchText, prompt: "Search models...")
    }
}

struct Model: Identifiable {
    let id: String
    let name: String
    let provider: String
    let category: String
    let context: Int
}

struct ModelRow: View {
    let model: Model
    
    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text(model.name)
                    .font(.headline)
                
                HStack {
                    Text(model.provider)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    
                    Text("•")
                        .foregroundStyle(.secondary)
                    
                    Text(model.category)
                        .font(.caption)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(.blue.opacity(0.1))
                        .clipShape(Capsule())
                }
            }
            
            Spacer()
            
            if model.context > 0 {
                Text(formatContext(model.context))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
    
    private func formatContext(_ tokens: Int) -> String {
        if tokens >= 1_000_000 {
            return "\(tokens / 1_000_000)M tokens"
        } else if tokens >= 1_000 {
            return "\(tokens / 1_000)K tokens"
        }
        return "\(tokens) tokens"
    }
}

#Preview {
    ModelsView()
        .environmentObject(AppState())
        .frame(width: 600, height: 500)
}
