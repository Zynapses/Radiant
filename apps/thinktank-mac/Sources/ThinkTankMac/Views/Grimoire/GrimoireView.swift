import SwiftUI

// MARK: - Grimoire View (Spellbook)
// Mirrors: apps/thinktank/lib/api/grimoire.ts

struct GrimoireView: View {
    @State private var spells: [Spell] = []
    @State private var featuredSpells: [Spell] = []
    @State private var selectedCategory: SpellCategory?
    @State private var searchQuery = ""
    @State private var isLoading = false
    @State private var showCreateSpell = false
    @State private var selectedSpell: Spell?
    @State private var showExecuteSheet = false
    @State private var error: String?
    @State private var showFeatured = true

    private let service = GrimoireService()

    var filteredSpells: [Spell] {
        var result = showFeatured ? featuredSpells : spells
        if let cat = selectedCategory {
            result = result.filter { $0.category == cat }
        }
        if !searchQuery.isEmpty {
            result = result.filter {
                $0.name.localizedCaseInsensitiveContains(searchQuery) ||
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
        .task { await loadSpells() }
        .sheet(item: $selectedSpell) { spell in
            SpellDetailSheet(spell: spell, onExecute: { execution in
                Task { await executeSpell(execution) }
            })
        }
    }

    private var header: some View {
        VStack(spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Grimoire")
                        .font(.title2.bold())
                    Text("Reusable prompt templates")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button {
                    showCreateSpell = true
                } label: {
                    Label("Create Spell", systemImage: "wand.and.stars")
                }
                .buttonStyle(.borderedProminent)
            }

            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                TextField("Search spells...", text: $searchQuery)
                    .textFieldStyle(.plain)
            }
            .padding(8)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 8))

            HStack(spacing: 8) {
                Picker("View", selection: $showFeatured) {
                    Text("Featured").tag(true)
                    Text("My Spells").tag(false)
                }
                .pickerStyle(.segmented)
                .frame(width: 200)

                Spacer()

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        categoryButton(nil, label: "All")
                        ForEach(SpellCategory.allCases, id: \.self) { cat in
                            categoryButton(cat, label: cat.displayName)
                        }
                    }
                }
            }
        }
        .padding()
    }

    private func categoryButton(_ category: SpellCategory?, label: String) -> some View {
        Button {
            selectedCategory = category
        } label: {
            Text(label)
                .font(.caption)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(selectedCategory == category ? Color.purple.opacity(0.2) : Color.secondary.opacity(0.1))
                .foregroundStyle(selectedCategory == category ? Color.purple : .secondary)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var content: some View {
        if isLoading {
            ProgressView("Loading spells...")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if filteredSpells.isEmpty {
            VStack(spacing: 12) {
                Image(systemName: "wand.and.stars")
                    .font(.system(size: 48))
                    .foregroundStyle(.secondary)
                Text("No spells found")
                    .font(.headline)
                Text("Create reusable prompt templates to speed up your workflow")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            ScrollView {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 260), spacing: 12)], spacing: 12) {
                    ForEach(filteredSpells) { spell in
                        SpellCard(spell: spell) {
                            selectedSpell = spell
                        }
                    }
                }
                .padding()
            }
        }
    }

    private func loadSpells() async {
        isLoading = true
        do {
            async let featured = service.getFeaturedSpells()
            async let all = service.listSpells()
            featuredSpells = try await featured
            spells = try await all
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    private func executeSpell(_ execution: SpellExecution) async {
        do {
            let _ = try await service.executeSpell(execution: execution)
        } catch {
            self.error = error.localizedDescription
        }
    }
}

// MARK: - Spell Card

struct SpellCard: View {
    let spell: Spell
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: spell.category.systemImage)
                        .font(.title3)
                        .foregroundStyle(.purple)
                    Spacer()
                    if let rating = spell.rating {
                        HStack(spacing: 2) {
                            Image(systemName: "star.fill")
                                .font(.caption2)
                                .foregroundStyle(.yellow)
                            Text(String(format: "%.1f", rating))
                                .font(.caption2)
                        }
                    }
                }

                Text(spell.name)
                    .font(.headline)
                    .lineLimit(1)

                Text(spell.description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)

                HStack {
                    Text(spell.category.displayName)
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.purple.opacity(0.1))
                        .clipShape(Capsule())

                    Spacer()

                    if !spell.variables.isEmpty {
                        Text("\(spell.variables.count) var\(spell.variables.count == 1 ? "" : "s")")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }

                    Text("\(spell.usageCount) uses")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .padding()
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Spell Detail Sheet

struct SpellDetailSheet: View {
    let spell: Spell
    let onExecute: (SpellExecution) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var variableValues: [String: String] = [:]

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(spell.name).font(.title3.bold())
                    Text(spell.description).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Button("Close") { dismiss() }
            }
            .padding()

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    GroupBox("Prompt Template") {
                        Text(spell.prompt)
                            .font(.system(.body, design: .monospaced))
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(8)
                    }

                    if !spell.variables.isEmpty {
                        GroupBox("Variables") {
                            VStack(spacing: 12) {
                                ForEach(spell.variables) { variable in
                                    VStack(alignment: .leading, spacing: 4) {
                                        HStack {
                                            Text(variable.label)
                                                .font(.caption.bold())
                                            if variable.required {
                                                Text("*")
                                                    .foregroundStyle(.red)
                                            }
                                        }
                                        if let desc = variable.description {
                                            Text(desc)
                                                .font(.caption2)
                                                .foregroundStyle(.secondary)
                                        }
                                        if let options = variable.options, !options.isEmpty {
                                            Picker(variable.label, selection: binding(for: variable.name)) {
                                                ForEach(options, id: \.self) { opt in
                                                    Text(opt).tag(opt)
                                                }
                                            }
                                            .labelsHidden()
                                        } else {
                                            TextField(variable.defaultValue ?? "Enter value...", text: binding(for: variable.name))
                                                .textFieldStyle(.roundedBorder)
                                        }
                                    }
                                }
                            }
                            .padding(4)
                        }
                    }
                }
                .padding()
            }

            Divider()

            HStack {
                Button {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(spell.prompt, forType: .string)
                } label: {
                    Label("Copy Prompt", systemImage: "doc.on.doc")
                }

                Spacer()

                Button {
                    let execution = SpellExecution(
                        spellId: spell.id,
                        variables: variableValues,
                        conversationId: nil
                    )
                    onExecute(execution)
                    dismiss()
                } label: {
                    Label("Cast Spell", systemImage: "wand.and.stars")
                }
                .buttonStyle(.borderedProminent)
            }
            .padding()
        }
        .frame(width: 500, height: 600)
        .onAppear {
            for variable in spell.variables {
                variableValues[variable.name] = variable.defaultValue ?? ""
            }
        }
    }

    private func binding(for key: String) -> Binding<String> {
        Binding(
            get: { variableValues[key] ?? "" },
            set: { variableValues[key] = $0 }
        )
    }
}
