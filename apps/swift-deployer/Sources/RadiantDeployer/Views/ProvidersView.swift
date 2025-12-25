import SwiftUI

struct ProvidersView: View {
    @EnvironmentObject var appState: AppState
    @State private var providers: [AIRegistryService.AIProvider] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    
    var body: some View {
        Group {
            if isLoading {
                ProgressView("Loading providers...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = errorMessage {
                VStack(spacing: 16) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.largeTitle)
                        .foregroundStyle(.orange)
                    Text("Failed to load providers")
                        .font(.headline)
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Button("Retry") {
                        Task { await loadProviders() }
                    }
                    .buttonStyle(.bordered)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if providers.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "building.2")
                        .font(.largeTitle)
                        .foregroundStyle(.secondary)
                    Text("No providers configured")
                        .font(.headline)
                    Text("Connect to a Radiant instance to view providers")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(providers) { provider in
                        ProviderRow(provider: provider)
                    }
                }
            }
        }
        .navigationTitle("AI Providers")
        .task {
            await loadProviders()
        }
        .refreshable {
            await loadProviders()
        }
    }
    
    private func loadProviders() async {
        isLoading = true
        errorMessage = nil
        
        do {
            let registry = appState.aiRegistryService
            providers = try await registry.fetchProviders()
            isLoading = false
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }
}

struct ProviderDisplayModel: Identifiable {
    let id: String
    let name: String
    let status: ProviderStatus
    let models: Int
    let hipaa: Bool
}

enum ProviderStatus: String {
    case active, degraded, maintenance, disabled
    
    init(from string: String) {
        self = ProviderStatus(rawValue: string.lowercased()) ?? .disabled
    }
    
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
    let provider: AIRegistryService.AIProvider
    
    private var status: ProviderStatus {
        ProviderStatus(from: provider.status)
    }
    
    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                HStack {
                    Text(provider.displayName)
                        .font(.headline)
                    
                    if provider.isHIPAACompliant {
                        Text("HIPAA")
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(.blue.opacity(0.2))
                            .clipShape(Capsule())
                    }
                    
                    if !provider.enabled {
                        Text("Disabled")
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(.gray.opacity(0.2))
                            .clipShape(Capsule())
                    }
                }
                
                HStack {
                    Text("\(provider.modelCount) models")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    
                    if let description = provider.description {
                        Text("•")
                            .foregroundStyle(.secondary)
                        Text(description)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
            }
            
            Spacer()
            
            HStack(spacing: 4) {
                Circle()
                    .fill(status.color)
                    .frame(width: 8, height: 8)
                Text(status.label)
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
