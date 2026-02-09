import SwiftUI

// MARK: - Flash Facts View
// Mirrors: apps/thinktank/lib/api/flash-facts.ts

struct FlashFactsView: View {
    @State private var facts: [FlashFact] = []
    @State private var collections: [FlashFactCollection] = []
    @State private var selectedCategory: FlashFactCategory?
    @State private var searchQuery = ""
    @State private var isLoading = false
    @State private var showCreateCollection = false
    @State private var newCollectionName = ""
    @State private var error: String?

    private let service = FlashFactsService()

    var filteredFacts: [FlashFact] {
        var result = facts
        if let cat = selectedCategory {
            result = result.filter { $0.category == cat }
        }
        if !searchQuery.isEmpty {
            result = result.filter { $0.fact.localizedCaseInsensitiveContains(searchQuery) }
        }
        return result
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            content
        }
        .task { await loadFacts() }
    }

    private var header: some View {
        VStack(spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Flash Facts")
                        .font(.title2.bold())
                    Text("Quick fact extraction and verification")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button {
                    showCreateCollection = true
                } label: {
                    Label("New Collection", systemImage: "folder.badge.plus")
                }
                .popover(isPresented: $showCreateCollection) {
                    VStack(spacing: 12) {
                        Text("New Collection").font(.headline)
                        TextField("Collection name", text: $newCollectionName)
                            .textFieldStyle(.roundedBorder)
                            .frame(width: 200)
                        HStack {
                            Button("Cancel") { showCreateCollection = false }
                            Button("Create") {
                                Task { await createCollection() }
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(newCollectionName.isEmpty)
                        }
                    }
                    .padding()
                }
            }

            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                TextField("Search facts...", text: $searchQuery)
                    .textFieldStyle(.plain)
            }
            .padding(8)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 8))

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    categoryPill(nil, label: "All")
                    ForEach(FlashFactCategory.allCases, id: \.self) { cat in
                        categoryPill(cat, label: cat.displayName)
                    }
                }
            }
        }
        .padding()
    }

    private func categoryPill(_ category: FlashFactCategory?, label: String) -> some View {
        Button {
            selectedCategory = category
        } label: {
            Text(label)
                .font(.caption)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(selectedCategory == category ? Color.accentColor.opacity(0.2) : Color.secondary.opacity(0.1))
                .foregroundStyle(selectedCategory == category ? Color.accentColor : .secondary)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var content: some View {
        if isLoading {
            ProgressView("Loading facts...")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if filteredFacts.isEmpty {
            VStack(spacing: 12) {
                Image(systemName: "bolt.circle")
                    .font(.system(size: 48))
                    .foregroundStyle(.secondary)
                Text("No facts yet")
                    .font(.headline)
                Text("Facts will appear here when extracted from conversations")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(filteredFacts) { fact in
                        FlashFactCard(fact: fact, onVerify: {
                            Task { await verifyFact(fact.id) }
                        }, onDelete: {
                            Task { await deleteFact(fact.id) }
                        })
                    }
                }
                .padding()
            }
        }
    }

    private func loadFacts() async {
        isLoading = true
        do {
            facts = try await service.getAllFacts()
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    private func verifyFact(_ factId: String) async {
        do {
            let updated = try await service.verifyFact(factId: factId)
            if let idx = facts.firstIndex(where: { $0.id == factId }) {
                facts[idx] = updated
            }
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func deleteFact(_ factId: String) async {
        do {
            try await service.deleteFact(factId: factId)
            facts.removeAll { $0.id == factId }
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func createCollection() async {
        guard !newCollectionName.isEmpty else { return }
        do {
            let collection = try await service.createCollection(name: newCollectionName)
            collections.append(collection)
            newCollectionName = ""
            showCreateCollection = false
        } catch {
            self.error = error.localizedDescription
        }
    }
}

// MARK: - Flash Fact Card

struct FlashFactCard: View {
    let fact: FlashFact
    let onVerify: () -> Void
    let onDelete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: fact.category.systemImage)
                    .foregroundStyle(.blue)
                Text(fact.category.displayName)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                if fact.verified {
                    Label("Verified", systemImage: "checkmark.seal.fill")
                        .font(.caption2)
                        .foregroundStyle(.green)
                }
                confidenceBadge
            }

            Text(fact.fact)
                .font(.body)

            if !fact.tags.isEmpty {
                HStack(spacing: 4) {
                    ForEach(fact.tags, id: \.self) { tag in
                        Text(tag)
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.purple.opacity(0.1))
                            .clipShape(Capsule())
                    }
                }
            }

            HStack(spacing: 12) {
                if !fact.verified {
                    Button(action: onVerify) {
                        Label("Verify", systemImage: "checkmark.circle")
                            .font(.caption)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }

                Button {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(fact.fact, forType: .string)
                } label: {
                    Label("Copy", systemImage: "doc.on.doc")
                        .font(.caption)
                }
                .buttonStyle(.bordered)
                .controlSize(.small)

                Spacer()

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

    private var confidenceBadge: some View {
        Text("\(Int(fact.confidence * 100))%")
            .font(.caption2.bold())
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(confidenceColor.opacity(0.2))
            .foregroundStyle(confidenceColor)
            .clipShape(Capsule())
    }

    private var confidenceColor: Color {
        if fact.confidence >= 0.8 { return .green }
        if fact.confidence >= 0.5 { return .orange }
        return .red
    }
}
