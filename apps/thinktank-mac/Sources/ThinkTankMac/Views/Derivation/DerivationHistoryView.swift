import SwiftUI

// MARK: - Derivation History View
// Mirrors: apps/thinktank/lib/api/derivation-history.ts

struct DerivationHistoryView: View {
    let conversationId: String
    var messageId: String?

    @State private var chains: [DerivationChain] = []
    @State private var report: ProvenanceReport?
    @State private var selectedChain: DerivationChain?
    @State private var isLoading = false
    @State private var error: String?

    private let service = DerivationHistoryService()

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            content
        }
        .task { await loadData() }
    }

    private var header: some View {
        VStack(spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Reasoning Provenance")
                        .font(.title2.bold())
                    Text("AI reasoning chains and evidence tracking")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if let report {
                    HStack(spacing: 16) {
                        StatPill(label: "Chains", value: "\(report.totalChains)")
                        StatPill(label: "Nodes", value: "\(report.totalNodes)")
                        StatPill(label: "Avg Confidence", value: "\(Int(report.avgConfidence * 100))%")
                    }
                }
            }
        }
        .padding()
    }

    @ViewBuilder
    private var content: some View {
        if isLoading {
            ProgressView("Loading derivation chains...")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if chains.isEmpty {
            VStack(spacing: 12) {
                Image(systemName: "arrow.triangle.branch")
                    .font(.system(size: 48))
                    .foregroundStyle(.secondary)
                Text("No derivation chains")
                    .font(.headline)
                Text("Reasoning provenance will appear after AI generates responses")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            HSplitView {
                chainList
                    .frame(minWidth: 250, maxWidth: 350)

                if let chain = selectedChain {
                    ChainDetailView(chain: chain, service: service)
                } else {
                    Text("Select a chain to view details")
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
        }
    }

    private var chainList: some View {
        List(chains, selection: $selectedChain) { chain in
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("Chain \(chain.id.prefix(8))")
                        .font(.headline)
                    Spacer()
                    Text("\(Int(chain.confidence * 100))%")
                        .font(.caption.bold())
                        .foregroundStyle(chain.confidence >= 0.7 ? .green : .orange)
                }
                HStack {
                    Text("\(chain.nodes.count) nodes")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text("Depth: \(chain.depth)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.vertical, 4)
            .tag(chain)
        }
    }

    private func loadData() async {
        isLoading = true
        do {
            if let messageId {
                chains = try await service.getMessageDerivations(messageId: messageId)
            } else {
                chains = try await service.getConversationDerivations(conversationId: conversationId)
            }
            report = try await service.getProvenanceReport(conversationId: conversationId)
            if selectedChain == nil, let first = chains.first {
                selectedChain = first
            }
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

// MARK: - Chain Detail View

struct ChainDetailView: View {
    let chain: DerivationChain
    let service: DerivationHistoryService
    @State private var challengeText = ""
    @State private var selectedNodeId: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("Derivation Chain")
                        .font(.title3.bold())
                    Spacer()
                    Text("Confidence: \(Int(chain.confidence * 100))%")
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(chain.confidence >= 0.7 ? Color.green.opacity(0.1) : Color.orange.opacity(0.1))
                        .clipShape(Capsule())
                }

                ForEach(chain.nodes) { node in
                    DerivationNodeCard(
                        node: node,
                        isSelected: selectedNodeId == node.id,
                        onSelect: { selectedNodeId = node.id },
                        onChallenge: { challenge in
                            Task { await challengeNode(node.id, challenge: challenge) }
                        }
                    )
                }
            }
            .padding()
        }
    }

    private func challengeNode(_ nodeId: String, challenge: String) async {
        do {
            let _ = try await service.challengeNode(nodeId: nodeId, challenge: challenge)
        } catch {
            // Handle silently
        }
    }
}

// MARK: - Derivation Node Card

struct DerivationNodeCard: View {
    let node: DerivationNode
    let isSelected: Bool
    let onSelect: () -> Void
    let onChallenge: (String) -> Void
    @State private var showChallenge = false
    @State private var challengeText = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: nodeIcon)
                    .foregroundStyle(nodeColor)
                Text(node.type.rawValue.capitalized)
                    .font(.caption.bold())
                    .foregroundStyle(nodeColor)
                Spacer()
                Text("\(Int(node.confidence * 100))%")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            Text(node.content)
                .font(.body)
                .lineLimit(isSelected ? nil : 3)

            if !node.parentIds.isEmpty {
                HStack(spacing: 4) {
                    Image(systemName: "arrow.up")
                        .font(.caption2)
                    Text("\(node.parentIds.count) parent\(node.parentIds.count == 1 ? "" : "s")")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            if isSelected {
                HStack(spacing: 8) {
                    Button {
                        showChallenge.toggle()
                    } label: {
                        Label("Challenge", systemImage: "exclamationmark.triangle")
                            .font(.caption)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)

                    Button {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString(node.content, forType: .string)
                    } label: {
                        Label("Copy", systemImage: "doc.on.doc")
                            .font(.caption)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }

                if showChallenge {
                    HStack {
                        TextField("Enter challenge...", text: $challengeText)
                            .textFieldStyle(.roundedBorder)
                        Button("Submit") {
                            onChallenge(challengeText)
                            challengeText = ""
                            showChallenge = false
                        }
                        .disabled(challengeText.isEmpty)
                    }
                }
            }
        }
        .padding()
        .background(isSelected ? Color.accentColor.opacity(0.05) : Color.clear)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(isSelected ? Color.accentColor.opacity(0.3) : Color.clear, lineWidth: 1)
        )
        .onTapGesture(perform: onSelect)
    }

    private var nodeIcon: String {
        switch node.type {
        case .claim: return "text.quote"
        case .evidence: return "checkmark.seal"
        case .inference: return "brain"
        case .source: return "doc.text"
        case .toolCall: return "wrench"
        }
    }

    private var nodeColor: Color {
        switch node.type {
        case .claim: return .blue
        case .evidence: return .green
        case .inference: return .purple
        case .source: return .orange
        case .toolCall: return .teal
        }
    }
}

// MARK: - Stat Pill

struct StatPill: View {
    let label: String
    let value: String

    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.caption.bold())
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }
}
