import SwiftUI

struct ArtifactsView: View {
    @State private var artifacts: [Artifact] = []
    @State private var isLoading = true
    @State private var selectedArtifact: Artifact?
    @State private var filterType: ArtifactType?

    private let artifactService = ArtifactService()

    private var filteredArtifacts: [Artifact] {
        guard let filterType else { return artifacts }
        return artifacts.filter { $0.type == filterType }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Artifacts")
                        .font(.system(size: 18, weight: .bold))
                    Text("Code, documents, and generated content")
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Picker("Filter", selection: Binding(
                    get: { filterType?.rawValue ?? "all" },
                    set: { filterType = $0 == "all" ? nil : ArtifactType(rawValue: $0) }
                )) {
                    Text("All").tag("all")
                    ForEach([ArtifactType.code, .document, .image, .chart], id: \.self) { type in
                        Text(type.rawValue.capitalized).tag(type.rawValue)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 300)
            }
            .padding()

            Divider().opacity(0.3)

            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if filteredArtifacts.isEmpty {
                EmptyStateView(
                    icon: "doc.on.doc",
                    title: "No artifacts yet",
                    message: "Artifacts are generated during conversations — code snippets, documents, charts, and more."
                )
            } else {
                HSplitView {
                    // List
                    ScrollView {
                        LazyVStack(spacing: 4) {
                            ForEach(filteredArtifacts) { artifact in
                                ArtifactRow(
                                    artifact: artifact,
                                    isSelected: selectedArtifact?.id == artifact.id
                                ) {
                                    selectedArtifact = artifact
                                }
                            }
                        }
                        .padding(8)
                    }
                    .frame(minWidth: 250, maxWidth: 350)

                    // Detail
                    if let artifact = selectedArtifact {
                        ArtifactDetailView(artifact: artifact)
                    } else {
                        VStack {
                            Image(systemName: "doc.text.magnifyingglass")
                                .font(.system(size: 36))
                                .foregroundStyle(.tertiary)
                            Text("Select an artifact to preview")
                                .font(.system(size: 13))
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    }
                }
            }
        }
        .task {
            isLoading = true
            do {
                artifacts = try await artifactService.listArtifacts()
            } catch {
                // Handle gracefully
            }
            isLoading = false
        }
    }
}

struct ArtifactRow: View {
    let artifact: Artifact
    let isSelected: Bool
    let onSelect: () -> Void
    @State private var isHovered = false

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: iconForType(artifact.type))
                .font(.system(size: 14))
                .foregroundStyle(colorForType(artifact.type))
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text(artifact.title)
                    .font(.system(size: 12, weight: .medium))
                    .lineLimit(1)

                HStack(spacing: 6) {
                    BadgeView(text: artifact.type.rawValue, size: .small)
                    if let lang = artifact.language {
                        Text(lang)
                            .font(.system(size: 10))
                            .foregroundStyle(.tertiary)
                    }
                }
            }

            Spacer()

            Text(artifact.createdAt, style: .relative)
                .font(.system(size: 10))
                .foregroundStyle(.tertiary)
        }
        .padding(8)
        .background(isSelected ? Color.purple.opacity(0.15) : isHovered ? Color.white.opacity(0.04) : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .onHover { isHovered = $0 }
        .contentShape(Rectangle())
        .onTapGesture(perform: onSelect)
    }

    private func iconForType(_ type: ArtifactType) -> String {
        switch type {
        case .code: return "chevron.left.forwardslash.chevron.right"
        case .document: return "doc.text"
        case .image: return "photo"
        case .chart: return "chart.bar"
        }
    }

    private func colorForType(_ type: ArtifactType) -> Color {
        switch type {
        case .code: return .green
        case .document: return .blue
        case .image: return .purple
        case .chart: return .orange
        }
    }
}

struct ArtifactDetailView: View {
    let artifact: Artifact
    @State private var copied = false

    var body: some View {
        VStack(spacing: 0) {
            // Toolbar
            HStack {
                Text(artifact.title)
                    .font(.system(size: 14, weight: .semibold))

                Spacer()

                Button {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(artifact.content, forType: .string)
                    copied = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) { copied = false }
                } label: {
                    Label(copied ? "Copied" : "Copy", systemImage: copied ? "checkmark" : "doc.on.doc")
                        .font(.system(size: 12))
                }

                Button {
                    let panel = NSSavePanel()
                    panel.nameFieldStringValue = artifact.title
                    if panel.runModal() == .OK, let url = panel.url {
                        try? artifact.content.write(to: url, atomically: true, encoding: .utf8)
                    }
                } label: {
                    Label("Save", systemImage: "arrow.down.doc")
                        .font(.system(size: 12))
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(.ultraThinMaterial)

            Divider().opacity(0.3)

            // Content
            ScrollView {
                Text(artifact.content)
                    .font(.system(size: 12, design: artifact.type == .code ? .monospaced : .default))
                    .textSelection(.enabled)
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}
