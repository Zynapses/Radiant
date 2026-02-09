import SwiftUI

struct ModelSelectorView: View {
    @EnvironmentObject var appState: AppState
    @State private var isExpanded = false

    private var selectedModel: AIModel? {
        appState.models.first { $0.id == appState.selectedModelId }
    }

    var body: some View {
        Menu {
            ForEach(groupedModels, id: \.0) { category, models in
                Section(category) {
                    ForEach(models) { model in
                        Button {
                            appState.selectedModelId = model.id
                        } label: {
                            HStack {
                                Text(model.displayName)
                                if model.isNew {
                                    Text("NEW")
                                        .font(.system(size: 9, weight: .bold))
                                        .foregroundStyle(.green)
                                }
                                Spacer()
                                if model.id == appState.selectedModelId {
                                    Image(systemName: "checkmark")
                                }
                            }
                        }
                    }
                }
            }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "cpu")
                    .font(.system(size: 11))
                Text(selectedModel?.displayName ?? "Select Model")
                    .font(.system(size: 12, weight: .medium))
                    .lineLimit(1)
                Image(systemName: "chevron.down")
                    .font(.system(size: 9, weight: .semibold))
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(Color.white.opacity(0.06))
            .clipShape(Capsule())
            .overlay(
                Capsule().stroke(Color.white.opacity(0.08), lineWidth: 1)
            )
        }
        .menuStyle(.borderlessButton)
        .fixedSize()
    }

    private var groupedModels: [(String, [AIModel])] {
        var groups: [String: [AIModel]] = [:]
        for model in appState.models where model.isEnabled {
            groups[model.category, default: []].append(model)
        }
        return groups.sorted { $0.key < $1.key }
    }
}

struct DomainSelectorView: View {
    @EnvironmentObject var appState: AppState

    private var selectedDomain: DomainMode? {
        appState.domains.first { $0.id == appState.selectedDomainId }
    }

    var body: some View {
        Menu {
            Button {
                appState.selectedDomainId = nil
            } label: {
                HStack {
                    Text("Auto-detect")
                    Spacer()
                    if appState.selectedDomainId == nil {
                        Image(systemName: "checkmark")
                    }
                }
            }

            Divider()

            ForEach(appState.domains.filter(\.isEnabled)) { domain in
                Button {
                    appState.selectedDomainId = domain.id
                } label: {
                    HStack {
                        Text(domain.name)
                        Spacer()
                        if domain.id == appState.selectedDomainId {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "globe")
                    .font(.system(size: 11))
                Text(selectedDomain?.name ?? "Auto")
                    .font(.system(size: 12, weight: .medium))
                    .lineLimit(1)
                Image(systemName: "chevron.down")
                    .font(.system(size: 9, weight: .semibold))
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(Color.white.opacity(0.06))
            .clipShape(Capsule())
            .overlay(
                Capsule().stroke(Color.white.opacity(0.08), lineWidth: 1)
            )
        }
        .menuStyle(.borderlessButton)
        .fixedSize()
    }
}
