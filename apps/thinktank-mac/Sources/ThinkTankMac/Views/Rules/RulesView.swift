import SwiftUI

struct RulesView: View {
    @State private var rules: [UserRule] = []
    @State private var presetCategories: [PresetCategory] = []
    @State private var isLoading = true
    @State private var showAddRule = false
    @State private var showPresets = false
    @State private var editingRule: UserRule?
    @State private var newRuleText = ""
    @State private var newRuleType: RuleType = .preference
    @State private var error: String?

    private let rulesService = RulesService()

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("My Rules")
                        .font(.system(size: 18, weight: .bold))
                    Text("Personalize how AI responds to you")
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Button { showPresets = true } label: {
                    Label("Presets", systemImage: "sparkles.rectangle.stack")
                        .font(.system(size: 12))
                }

                GradientButton(title: "Add Rule", icon: "plus", action: { showAddRule = true })
            }
            .padding()

            Divider().opacity(0.3)

            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if rules.isEmpty {
                EmptyStateView(
                    icon: "list.bullet.clipboard",
                    title: "No rules yet",
                    message: "Create rules to customize how AI responds to you, or browse presets for inspiration.",
                    actionTitle: "Browse Presets",
                    action: { showPresets = true }
                )
            } else {
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(rules) { rule in
                            RuleCard(
                                rule: rule,
                                onToggle: { toggleRule(rule) },
                                onEdit: { editingRule = rule },
                                onDelete: { deleteRule(rule) }
                            )
                        }
                    }
                    .padding()
                }
            }
        }
        .task { await loadRules() }
        .sheet(isPresented: $showAddRule) {
            AddRuleSheet(
                ruleText: $newRuleText,
                ruleType: $newRuleType,
                onSave: { await addRule() },
                onCancel: { showAddRule = false }
            )
            .frame(width: 450, height: 300)
        }
        .sheet(isPresented: $showPresets) {
            PresetsSheet(
                categories: presetCategories,
                onAddPreset: { presetId in await addPreset(presetId) }
            )
            .frame(width: 500, height: 500)
        }
        .sheet(item: $editingRule) { rule in
            EditRuleSheet(rule: rule) { updatedText, updatedType, priority, isActive in
                await updateRule(rule.id, text: updatedText, type: updatedType, priority: priority, isActive: isActive)
            }
            .frame(width: 450, height: 350)
        }
    }

    private func loadRules() async {
        isLoading = true
        do {
            async let rulesTask = rulesService.listRules()
            async let presetsTask = rulesService.getPresets()
            let (fetchedRules, fetchedPresets) = try await (rulesTask, presetsTask)
            rules = fetchedRules
            presetCategories = fetchedPresets
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    private func addRule() async {
        do {
            let rule = try await rulesService.createRule(ruleText: newRuleText, ruleType: newRuleType)
            rules.insert(rule, at: 0)
            newRuleText = ""
            showAddRule = false
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func addPreset(_ presetId: String) async {
        do {
            let rule = try await rulesService.addPreset(presetId)
            rules.insert(rule, at: 0)
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func toggleRule(_ rule: UserRule) {
        Task {
            do {
                let updated = try await rulesService.updateRule(
                    rule.id, ruleText: rule.ruleText, ruleType: rule.ruleType,
                    priority: rule.priority, isActive: !rule.isActive
                )
                if let idx = rules.firstIndex(where: { $0.id == rule.id }) {
                    rules[idx] = updated
                }
            } catch {
                self.error = error.localizedDescription
            }
        }
    }

    private func updateRule(_ id: String, text: String, type: RuleType, priority: Int, isActive: Bool) async {
        do {
            let updated = try await rulesService.updateRule(id, ruleText: text, ruleType: type, priority: priority, isActive: isActive)
            if let idx = rules.firstIndex(where: { $0.id == id }) {
                rules[idx] = updated
            }
            editingRule = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func deleteRule(_ rule: UserRule) {
        Task {
            do {
                try await rulesService.deleteRule(rule.id)
                rules.removeAll { $0.id == rule.id }
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}

struct RuleCard: View {
    let rule: UserRule
    let onToggle: () -> Void
    let onEdit: () -> Void
    let onDelete: () -> Void
    @State private var isHovered = false

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Toggle("", isOn: Binding(get: { rule.isActive }, set: { _ in onToggle() }))
                .toggleStyle(.switch)
                .controlSize(.mini)

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    BadgeView(text: rule.ruleType.rawValue.capitalized, color: colorForType(rule.ruleType), size: .small)
                    if rule.source == .presetAdded {
                        BadgeView(text: "Preset", color: .blue, size: .small)
                    }
                    Text("Applied \(rule.timesApplied)x")
                        .font(.system(size: 10))
                        .foregroundStyle(.tertiary)
                }

                Text(rule.ruleText)
                    .font(.system(size: 13))
                    .foregroundStyle(rule.isActive ? .primary : .secondary)
                    .lineLimit(3)

                if let summary = rule.ruleSummary {
                    Text(summary)
                        .font(.system(size: 11))
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                }
            }

            Spacer()

            if isHovered {
                HStack(spacing: 4) {
                    Button(action: onEdit) {
                        Image(systemName: "pencil")
                            .font(.system(size: 11))
                    }
                    .buttonStyle(.plain)

                    Button(action: onDelete) {
                        Image(systemName: "trash")
                            .font(.system(size: 11))
                            .foregroundStyle(.red)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(12)
        .glassCard(cornerRadius: 10)
        .onHover { isHovered = $0 }
    }

    private func colorForType(_ type: RuleType) -> Color {
        switch type {
        case .restriction: return .red
        case .preference: return .purple
        case .format: return .blue
        case .source: return .green
        case .tone: return .orange
        case .topic: return .cyan
        case .privacy: return .pink
        case .other: return .gray
        }
    }
}

struct AddRuleSheet: View {
    @Binding var ruleText: String
    @Binding var ruleType: RuleType
    let onSave: () async -> Void
    let onCancel: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Text("Add Rule")
                .font(.system(size: 16, weight: .bold))

            Picker("Type", selection: $ruleType) {
                ForEach(RuleType.allCases, id: \.self) { type in
                    Text(type.rawValue.capitalized).tag(type)
                }
            }

            TextEditor(text: $ruleText)
                .font(.system(size: 13))
                .frame(minHeight: 100)
                .scrollContentBackground(.hidden)
                .padding(8)
                .background(Color.white.opacity(0.04))
                .clipShape(RoundedRectangle(cornerRadius: 8))

            HStack {
                Button("Cancel", action: onCancel)
                Spacer()
                GradientButton(title: "Save Rule", icon: "checkmark") {
                    Task { await onSave() }
                }
                .disabled(ruleText.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .padding(20)
    }
}

struct EditRuleSheet: View {
    let rule: UserRule
    let onSave: (String, RuleType, Int, Bool) async -> Void
    @State private var text: String
    @State private var type: RuleType
    @State private var priority: Int
    @State private var isActive: Bool
    @Environment(\.dismiss) var dismiss

    init(rule: UserRule, onSave: @escaping (String, RuleType, Int, Bool) async -> Void) {
        self.rule = rule
        self.onSave = onSave
        _text = State(initialValue: rule.ruleText)
        _type = State(initialValue: rule.ruleType)
        _priority = State(initialValue: rule.priority)
        _isActive = State(initialValue: rule.isActive)
    }

    var body: some View {
        VStack(spacing: 16) {
            Text("Edit Rule")
                .font(.system(size: 16, weight: .bold))

            Picker("Type", selection: $type) {
                ForEach(RuleType.allCases, id: \.self) { t in
                    Text(t.rawValue.capitalized).tag(t)
                }
            }

            Stepper("Priority: \(priority)", value: $priority, in: 1...100)

            Toggle("Active", isOn: $isActive)

            TextEditor(text: $text)
                .font(.system(size: 13))
                .frame(minHeight: 100)
                .scrollContentBackground(.hidden)
                .padding(8)
                .background(Color.white.opacity(0.04))
                .clipShape(RoundedRectangle(cornerRadius: 8))

            HStack {
                Button("Cancel") { dismiss() }
                Spacer()
                GradientButton(title: "Save", icon: "checkmark") {
                    Task { await onSave(text, type, priority, isActive) }
                }
            }
        }
        .padding(20)
    }
}

struct PresetsSheet: View {
    let categories: [PresetCategory]
    let onAddPreset: (String) async -> Void
    @Environment(\.dismiss) var dismiss

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Rule Presets")
                    .font(.system(size: 16, weight: .bold))
                Spacer()
                Button("Done") { dismiss() }
            }
            .padding()

            Divider()

            ScrollView {
                LazyVStack(spacing: 16) {
                    ForEach(categories, id: \.name) { category in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack(spacing: 6) {
                                Text(category.icon)
                                Text(category.name)
                                    .font(.system(size: 14, weight: .semibold))
                            }

                            Text(category.description)
                                .font(.system(size: 11))
                                .foregroundStyle(.tertiary)

                            ForEach(category.rules) { preset in
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(preset.ruleSummary)
                                            .font(.system(size: 12, weight: .medium))
                                        Text(preset.ruleText)
                                            .font(.system(size: 11))
                                            .foregroundStyle(.secondary)
                                            .lineLimit(2)
                                    }
                                    Spacer()
                                    Button {
                                        Task { await onAddPreset(preset.id) }
                                    } label: {
                                        Image(systemName: "plus.circle")
                                            .font(.system(size: 16))
                                            .foregroundStyle(.purple)
                                    }
                                    .buttonStyle(.plain)
                                }
                                .padding(8)
                                .background(Color.white.opacity(0.03))
                                .clipShape(RoundedRectangle(cornerRadius: 6))
                            }
                        }
                    }
                }
                .padding()
            }
        }
    }
}
