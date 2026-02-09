import SwiftUI

// MARK: - Ideas View
// Mirrors: apps/thinktank/lib/api/ideas.ts

struct IdeasView: View {
    @State private var ideas: [Idea] = []
    @State private var boards: [IdeaBoard] = []
    @State private var selectedStatus: IdeaStatus?
    @State private var searchQuery = ""
    @State private var isLoading = false
    @State private var showCreateIdea = false
    @State private var showBoards = false
    @State private var error: String?

    private let service = IdeasService()

    var filteredIdeas: [Idea] {
        var result = ideas
        if let status = selectedStatus {
            result = result.filter { $0.status == status }
        }
        if !searchQuery.isEmpty {
            result = result.filter {
                $0.title.localizedCaseInsensitiveContains(searchQuery) ||
                $0.description.localizedCaseInsensitiveContains(searchQuery)
            }
        }
        return result
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            content
        }
        .task { await loadIdeas() }
        .sheet(isPresented: $showCreateIdea) {
            CreateIdeaSheet { idea in
                Task { await createIdea(idea) }
            }
        }
    }

    private var header: some View {
        VStack(spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Ideas")
                        .font(.title2.bold())
                    Text("Capture and develop ideas from conversations")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button {
                    showBoards.toggle()
                } label: {
                    Label("Boards", systemImage: "square.3.layers.3d")
                }
                Button {
                    showCreateIdea = true
                } label: {
                    Label("New Idea", systemImage: "lightbulb")
                }
                .buttonStyle(.borderedProminent)
            }

            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                TextField("Search ideas...", text: $searchQuery)
                    .textFieldStyle(.plain)
            }
            .padding(8)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 8))

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    statusPill(nil, label: "All", count: ideas.count)
                    ForEach(IdeaStatus.allCases, id: \.self) { status in
                        let count = ideas.filter { $0.status == status }.count
                        statusPill(status, label: status.displayName, count: count)
                    }
                }
            }
        }
        .padding()
    }

    private func statusPill(_ status: IdeaStatus?, label: String, count: Int) -> some View {
        Button {
            selectedStatus = status
        } label: {
            HStack(spacing: 4) {
                if let status {
                    Image(systemName: status.systemImage)
                        .font(.caption2)
                }
                Text(label)
                    .font(.caption)
                if count > 0 {
                    Text("\(count)")
                        .font(.caption2.bold())
                        .padding(.horizontal, 4)
                        .background(Color.secondary.opacity(0.2))
                        .clipShape(Capsule())
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(selectedStatus == status ? Color.accentColor.opacity(0.2) : Color.secondary.opacity(0.1))
            .foregroundStyle(selectedStatus == status ? Color.accentColor : .secondary)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var content: some View {
        if isLoading {
            ProgressView("Loading ideas...")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if filteredIdeas.isEmpty {
            VStack(spacing: 12) {
                Image(systemName: "lightbulb")
                    .font(.system(size: 48))
                    .foregroundStyle(.secondary)
                Text("No ideas yet")
                    .font(.headline)
                Text("Capture ideas from conversations or create them manually")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Button {
                    showCreateIdea = true
                } label: {
                    Label("Create First Idea", systemImage: "plus")
                }
                .buttonStyle(.borderedProminent)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(filteredIdeas) { idea in
                        IdeaCard(idea: idea, onDevelop: {
                            Task { await developIdea(idea.id) }
                        }, onDelete: {
                            Task { await deleteIdea(idea.id) }
                        })
                    }
                }
                .padding()
            }
        }
    }

    private func loadIdeas() async {
        isLoading = true
        do {
            async let ideasResult = service.listIdeas()
            async let boardsResult = service.listBoards()
            ideas = try await ideasResult
            boards = try await boardsResult
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    private func createIdea(_ idea: Idea) async {
        do {
            let created = try await service.createIdea(idea)
            ideas.insert(created, at: 0)
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func developIdea(_ ideaId: String) async {
        do {
            let developed = try await service.developIdea(ideaId: ideaId)
            if let idx = ideas.firstIndex(where: { $0.id == ideaId }) {
                ideas[idx] = developed
            }
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func deleteIdea(_ ideaId: String) async {
        do {
            try await service.deleteIdea(ideaId: ideaId)
            ideas.removeAll { $0.id == ideaId }
        } catch {
            self.error = error.localizedDescription
        }
    }
}

// MARK: - Idea Card

struct IdeaCard: View {
    let idea: Idea
    let onDevelop: () -> Void
    let onDelete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: idea.status.systemImage)
                    .foregroundStyle(statusColor)
                Text(idea.title)
                    .font(.headline)
                    .lineLimit(1)
                Spacer()
                Text(idea.priority.displayName)
                    .font(.caption2)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(priorityColor.opacity(0.1))
                    .foregroundStyle(priorityColor)
                    .clipShape(Capsule())
            }

            Text(idea.description)
                .font(.body)
                .foregroundStyle(.secondary)
                .lineLimit(3)

            if !idea.tags.isEmpty {
                HStack(spacing: 4) {
                    ForEach(idea.tags.prefix(5), id: \.self) { tag in
                        Text(tag)
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.blue.opacity(0.1))
                            .clipShape(Capsule())
                    }
                }
            }

            HStack {
                Text(idea.status.displayName)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                if !idea.relatedIdeas.isEmpty {
                    Text("\(idea.relatedIdeas.count) linked")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Button(action: onDevelop) {
                    Label("Develop", systemImage: "sparkles")
                        .font(.caption)
                }
                .buttonStyle(.bordered)
                .controlSize(.small)

                Button(role: .destructive, action: onDelete) {
                    Image(systemName: "trash")
                        .font(.caption)
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private var statusColor: Color {
        switch idea.status {
        case .captured: return .blue
        case .developing: return .orange
        case .ready: return .green
        case .implemented: return .purple
        case .archived: return .gray
        }
    }

    private var priorityColor: Color {
        switch idea.priority {
        case .low: return .green
        case .medium: return .orange
        case .high: return .red
        }
    }
}

// MARK: - Create Idea Sheet

struct CreateIdeaSheet: View {
    let onCreate: (Idea) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var description = ""
    @State private var category = ""
    @State private var priority: IdeaPriority = .medium
    @State private var tagsString = ""

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("New Idea").font(.title3.bold())
                Spacer()
                Button("Cancel") { dismiss() }
            }
            .padding()
            Divider()

            Form {
                TextField("Title", text: $title)
                TextField("Description", text: $description, axis: .vertical)
                    .lineLimit(3...6)
                TextField("Category", text: $category)
                Picker("Priority", selection: $priority) {
                    ForEach(IdeaPriority.allCases, id: \.self) { p in
                        Text(p.displayName).tag(p)
                    }
                }
                TextField("Tags (comma separated)", text: $tagsString)
            }
            .padding()

            Divider()
            HStack {
                Spacer()
                Button("Create") {
                    let tags = tagsString.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
                    let idea = Idea(
                        id: UUID().uuidString,
                        title: title,
                        description: description,
                        category: category,
                        status: .captured,
                        priority: priority,
                        tags: tags,
                        attachments: [],
                        relatedIdeas: [],
                        createdAt: ISO8601DateFormatter().string(from: Date()),
                        updatedAt: ISO8601DateFormatter().string(from: Date())
                    )
                    onCreate(idea)
                    dismiss()
                }
                .buttonStyle(.borderedProminent)
                .disabled(title.isEmpty)
            }
            .padding()
        }
        .frame(width: 450, height: 400)
    }
}
