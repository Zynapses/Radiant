import SwiftUI

struct ProvidersView: View {
    @EnvironmentObject var appState: AppState
    
    private let providers = [
        Provider(id: "openai", name: "OpenAI", status: .active, models: 8, hipaa: true),
        Provider(id: "anthropic", name: "Anthropic", status: .active, models: 5, hipaa: true),
        Provider(id: "google", name: "Google AI", status: .active, models: 6, hipaa: true),
        Provider(id: "mistral", name: "Mistral AI", status: .active, models: 4, hipaa: false),
        Provider(id: "cohere", name: "Cohere", status: .active, models: 3, hipaa: false),
        Provider(id: "replicate", name: "Replicate", status: .active, models: 20, hipaa: false),
        Provider(id: "stability", name: "Stability AI", status: .active, models: 4, hipaa: false),
        Provider(id: "aws-bedrock", name: "AWS Bedrock", status: .active, models: 12, hipaa: true),
    ]
    
    var body: some View {
        List {
            ForEach(providers) { provider in
                ProviderRow(provider: provider)
            }
        }
        .navigationTitle("AI Providers")
    }
}

struct Provider: Identifiable {
    let id: String
    let name: String
    let status: ProviderStatus
    let models: Int
    let hipaa: Bool
}

enum ProviderStatus {
    case active, degraded, maintenance, disabled
    
    var color: Color {
        switch self {
        case .active: return .green
        case .degraded: return .orange
        case .maintenance: return .yellow
        case .disabled: return .gray
        }
    }
    
    var label: String {
        switch self {
        case .active: return "Active"
        case .degraded: return "Degraded"
        case .maintenance: return "Maintenance"
        case .disabled: return "Disabled"
        }
    }
}

struct ProviderRow: View {
    let provider: Provider
    
    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                HStack {
                    Text(provider.name)
                        .font(.headline)
                    
                    if provider.hipaa {
                        Text("HIPAA")
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(.blue.opacity(0.2))
                            .clipShape(Capsule())
                    }
                }
                
                Text("\(provider.models) models available")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            HStack(spacing: 4) {
                Circle()
                    .fill(provider.status.color)
                    .frame(width: 8, height: 8)
                Text(provider.status.label)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

#Preview {
    ProvidersView()
        .environmentObject(AppState())
        .frame(width: 600, height: 400)
}
