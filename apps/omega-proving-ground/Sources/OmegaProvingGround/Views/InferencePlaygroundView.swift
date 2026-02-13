import SwiftUI

// MARK: - Drive-Thru Conversation Message

struct DriveThruMessage: Identifiable {
    let id = UUID()
    let role: DriveThruRole
    let text: String
    let timestamp = Date()
    var behavior: String?
    var confidence: Double?
    var totalMs: Double?
    var omegaMs: Double?
    var llamaMs: Double?
}

enum DriveThruRole: String {
    case customer
    case crew
    case system
}

// MARK: - Drive-Thru View

struct InferencePlaygroundView: View {
    @EnvironmentObject var appState: AppState
    @State private var inputText: String = ""
    @State private var messages: [DriveThruMessage] = []
    @State private var orderItems: [OrderItem] = []
    @State private var runningTotal: Double = 0
    @State private var lastBehavior: String = ""
    @State private var lastConfidence: Double = 0
    @State private var lastCortex: CortexTelemetry?
    @State private var isReady: Bool = false
    @State private var isLoading: Bool = false
    @State private var isSending: Bool = false
    @State private var errorMessage: String?
    @State private var statusMessage: String = "Connecting to OMEGA..."
    @FocusState private var isInputFocused: Bool

    var body: some View {
        HSplitView {
            // Left: Conversation
            VStack(spacing: 0) {
                driveThruHeader
                Divider()
                if messages.isEmpty {
                    emptyState
                } else {
                    conversationList
                }
                Divider()
                inputBar
            }
            .frame(minWidth: 460)

            // Right: Order Board + Telemetry
            VStack(spacing: 0) {
                orderBoard
                Divider()
                telemetryPanel
            }
            .frame(minWidth: 260, idealWidth: 300, maxWidth: 360)
            .background(Color(nsColor: .controlBackgroundColor))
        }
        .task { await initializePipeline() }
    }

    // MARK: - Header

    private var driveThruHeader: some View {
        HStack(spacing: 10) {
            Image(systemName: "car.side")
                .font(.title2)
                .foregroundColor(.red)

            VStack(alignment: .leading, spacing: 1) {
                Text("McDonald's Drive-Thru")
                    .font(.headline)
                HStack(spacing: 6) {
                    Circle()
                        .fill(isReady ? Color.green : Color.orange)
                        .frame(width: 7, height: 7)
                    Text(isReady ? "OMEGA Ready" : statusMessage)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()

            Button(action: newOrder) {
                Label("New Order", systemImage: "arrow.counterclockwise")
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
            .disabled(!isReady || isSending)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color(nsColor: .windowBackgroundColor))
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "car.side")
                .font(.system(size: 48))
                .foregroundColor(.secondary.opacity(0.4))
            Text("Welcome to the Drive-Thru")
                .font(.title2)
                .foregroundColor(.secondary)

            if isLoading {
                VStack(spacing: 8) {
                    ProgressView()
                        .controlSize(.regular)
                    Text(statusMessage)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            } else if isReady {
                Text("Type your order below — OMEGA will classify your intent\nand the crew will respond via Llama.")
                    .font(.body)
                    .foregroundColor(.secondary.opacity(0.7))
                    .multilineTextAlignment(.center)
            } else if let err = errorMessage {
                VStack(spacing: 8) {
                    Text(err)
                        .font(.caption)
                        .foregroundColor(.orange)
                        .multilineTextAlignment(.center)
                    Button("Retry") { Task { await initializePipeline() } }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                }
            }
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Conversation

    private var conversationList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 10) {
                    ForEach(messages) { msg in
                        DriveThruBubble(message: msg)
                            .id(msg.id)
                    }

                    if isSending {
                        HStack(spacing: 8) {
                            ProgressView().controlSize(.small)
                            Text("OMEGA thinking...")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        .padding(.horizontal, 16)
                        .id("thinking")
                    }
                }
                .padding(14)
            }
            .onChange(of: messages.count) { _ in
                withAnimation {
                    if let last = messages.last {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }
        }
    }

    // MARK: - Input Bar

    private var inputBar: some View {
        VStack(spacing: 6) {
            if let err = errorMessage, isReady {
                HStack {
                    Image(systemName: "exclamationmark.triangle")
                        .foregroundColor(.orange)
                    Text(err).font(.caption).foregroundColor(.orange)
                    Spacer()
                    Button("Dismiss") { errorMessage = nil }
                        .buttonStyle(.plain).font(.caption)
                }
                .padding(.horizontal, 16).padding(.top, 6)
            }

            HStack(spacing: 10) {
                TextField("\"Can I get a Big Mac combo?\"", text: $inputText, axis: .vertical)
                    .textFieldStyle(.plain)
                    .lineLimit(1...3)
                    .focused($isInputFocused)
                    .onSubmit { send() }
                    .disabled(!isReady || isSending)

                Button(action: send) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title2)
                        .foregroundColor(canSend ? .red : .gray)
                }
                .buttonStyle(.plain)
                .disabled(!canSend)
                .keyboardShortcut(.return, modifiers: [.command])
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(Color(nsColor: .textBackgroundColor))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .strokeBorder(Color.secondary.opacity(0.2), lineWidth: 1)
                    )
            )
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
        .background(Color(nsColor: .windowBackgroundColor))
    }

    // MARK: - Order Board

    private var orderBoard: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Image(systemName: "list.clipboard")
                    .foregroundColor(.red)
                Text("Order Board")
                    .font(.headline)
                Spacer()
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)

            Divider()

            if orderItems.isEmpty {
                VStack {
                    Spacer()
                    Text("No items yet")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Spacer()
                }
                .frame(maxWidth: .infinity)
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(orderItems) { item in
                            orderItemRow(item)
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                }
            }

            Divider()

            HStack {
                Text("Total")
                    .font(.headline)
                Spacer()
                Text(String(format: "$%.2f", runningTotal))
                    .font(.system(.headline, design: .monospaced))
                    .foregroundColor(.red)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
        }
    }

    private func orderItemRow(_ item: OrderItem) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text("\(item.quantity)×")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .frame(width: 24, alignment: .leading)
                Text(item.item)
                    .font(.callout)
                    .fontWeight(.medium)
                if item.is_meal {
                    Text("MEAL")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .background(Capsule().fill(Color.red))
                }
                Spacer()
                Text(String(format: "$%.2f", item.line_total))
                    .font(.system(.callout, design: .monospaced))
            }
            if let drink = item.drink {
                Text("  🥤 \(drink)")
                    .font(.caption2).foregroundColor(.secondary)
            }
            if let sauce = item.sauce {
                Text("  🫙 \(sauce)")
                    .font(.caption2).foregroundColor(.secondary)
            }
            ForEach(Array(item.customizations.enumerated()), id: \.offset) { _, cust in
                Text("  ✏️ \(cust)")
                    .font(.caption2).foregroundColor(.secondary)
            }
        }
    }

    // MARK: - Telemetry Panel

    private var telemetryPanel: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Image(systemName: "brain.head.profile")
                    .foregroundColor(.purple)
                Text("OMEGA Telemetry")
                    .font(.headline)
                Spacer()
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    if !lastBehavior.isEmpty {
                        telemetryRow("Behavior", lastBehavior, color: behaviorColor(lastBehavior))
                        telemetryRow("Confidence", String(format: "%.1f%%", lastConfidence * 100))
                    }

                    if let cx = lastCortex {
                        Divider().padding(.vertical, 4)
                        Text("Cortex").font(.caption).fontWeight(.semibold).foregroundColor(.secondary)
                        telemetryRow("Coherence", String(format: "%.4f", cx.coherence))
                        telemetryRow("State Norm", String(format: "%.2f", cx.state_norm))
                        telemetryRow("Magnitude μ", String(format: "%.4f", cx.output_magnitude_mean))
                        telemetryRow("Magnitude σ", String(format: "%.4f", cx.output_magnitude_std))
                        telemetryRow("Phase μ", String(format: "%.4f", cx.output_phase_mean))
                        telemetryRow("Sparsity", String(format: "%.1f%%", cx.output_sparsity * 100))
                        telemetryRow("Hidden Dim", "\(cx.hidden_dim)")
                    }

                    if lastBehavior.isEmpty {
                        Text("Send a message to see telemetry")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
            }
        }
    }

    private func telemetryRow(_ label: String, _ value: String, color: Color = .primary) -> some View {
        HStack {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
                .frame(width: 90, alignment: .leading)
            Text(value)
                .font(.system(.caption, design: .monospaced))
                .foregroundColor(color)
        }
    }

    private func behaviorColor(_ b: String) -> Color {
        switch b {
        case "greet": return .green
        case "take_order": return .blue
        case "customize": return .orange
        case "complaint": return .red
        case "meal_substitution": return .purple
        case "combo_entree_swap": return .teal
        case "split_size_selection": return .indigo
        default: return .primary
        }
    }

    // MARK: - Logic

    private var canSend: Bool {
        !inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && isReady && !isSending
    }

    private func initializePipeline() async {
        isLoading = true
        errorMessage = nil

        // 1. Check health
        statusMessage = "Checking OMEGA server..."
        await appState.cortexService.checkHealth()
        guard appState.cortexService.isConnected else {
            errorMessage = "OMEGA server not running.\nStart it: python3 omega_server/server.py"
            isLoading = false
            return
        }

        // 2. Load training data + checkpoint
        statusMessage = "Loading training data (29,500 examples)..."
        do {
            let trainResp = try await appState.cortexService.loadTrainingData()
            statusMessage = "Loaded \(trainResp.training_examples) examples, \(trainResp.behavior_types) behaviors"
        } catch {
            errorMessage = "Failed to load training data: \(error.localizedDescription)"
            isLoading = false
            return
        }

        statusMessage = "Loading trained checkpoint..."
        do {
            let ckpt = try await appState.cortexService.loadCheckpoint()
            if ckpt.is_trained {
                statusMessage = "Ready — accuracy: \(String(format: "%.0f%%", ckpt.best_accuracy * 100))"
            }
        } catch {
            errorMessage = "Failed to load checkpoint: \(error.localizedDescription)"
            isLoading = false
            return
        }

        isReady = true
        isLoading = false
    }

    private func send() {
        guard canSend else { return }
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        inputText = ""
        errorMessage = nil

        messages.append(DriveThruMessage(role: .customer, text: text))

        Task {
            isSending = true
            defer { isSending = false }

            // Build conversation history for context
            let history: [[String: String]] = messages.map { msg in
                ["role": msg.role == .customer ? "customer" : "crew", "text": msg.text]
            }

            do {
                let resp = try await appState.cortexService.infer(
                    text: text,
                    conversationHistory: history
                )

                // Update order state
                orderItems = resp.order.items
                runningTotal = resp.order.running_total

                // Update telemetry
                lastBehavior = resp.omega.behavior
                lastConfidence = resp.omega.confidence
                lastCortex = resp.cortex

                // Crew response
                var crewMsg = DriveThruMessage(role: .crew, text: resp.response)
                crewMsg.behavior = resp.omega.behavior
                crewMsg.confidence = resp.omega.confidence
                crewMsg.totalMs = resp.total_ms
                crewMsg.omegaMs = resp.omega.processing_ms
                crewMsg.llamaMs = resp.llama.processing_ms
                messages.append(crewMsg)
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func newOrder() {
        messages.removeAll()
        orderItems.removeAll()
        runningTotal = 0
        lastBehavior = ""
        lastConfidence = 0
        lastCortex = nil
        errorMessage = nil

        Task {
            try? await appState.cortexService.clearOrder()
        }
    }
}

// MARK: - Drive-Thru Bubble

struct DriveThruBubble: View {
    let message: DriveThruMessage

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            if message.role == .crew {
                Image(systemName: "headset.circle.fill")
                    .font(.title3)
                    .foregroundColor(.red)
                    .frame(width: 28)
            } else {
                Image(systemName: "person.circle.fill")
                    .font(.title3)
                    .foregroundColor(.blue)
                    .frame(width: 28)
            }

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(message.role == .crew ? "Crew" : "Customer")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.secondary)

                    if let behavior = message.behavior {
                        Text(behavior)
                            .font(.system(size: 9, weight: .semibold, design: .monospaced))
                            .foregroundColor(.white)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 1)
                            .background(Capsule().fill(behaviorTagColor(behavior)))
                    }

                    Spacer()

                    if let total = message.totalMs {
                        Text(String(format: "%.0fms", total))
                            .font(.caption2)
                            .foregroundColor(.secondary.opacity(0.6))
                    }
                }

                Text(message.text)
                    .font(.body)
                    .textSelection(.enabled)

                if let conf = message.confidence {
                    HStack(spacing: 4) {
                        if let omega = message.omegaMs {
                            Text(String(format: "OMEGA %.0fms", omega))
                                .font(.system(size: 9, design: .monospaced))
                                .foregroundColor(.purple.opacity(0.6))
                        }
                        if let llama = message.llamaMs {
                            Text(String(format: "Llama %.0fms", llama))
                                .font(.system(size: 9, design: .monospaced))
                                .foregroundColor(.green.opacity(0.6))
                        }
                        Text(String(format: "%.1f%% conf", conf * 100))
                            .font(.system(size: 9, design: .monospaced))
                            .foregroundColor(.secondary.opacity(0.5))
                    }
                }
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(message.role == .crew
                      ? Color.red.opacity(0.05)
                      : Color.blue.opacity(0.05))
        )
    }

    private func behaviorTagColor(_ b: String) -> Color {
        switch b {
        case "greet": return .green
        case "take_order": return .blue
        case "customize": return .orange
        case "complaint": return .red
        case "meal_substitution": return .purple
        case "combo_entree_swap": return .teal
        case "split_size_selection": return .indigo
        default: return .gray
        }
    }
}
