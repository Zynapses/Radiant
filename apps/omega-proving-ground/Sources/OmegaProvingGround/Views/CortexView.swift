import SwiftUI

struct CortexView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var cortex = OmegaCortexService()
    @State private var inputText: String = ""
    @State private var lastInference: CortexInference?
    @State private var lastDream: DreamResult?
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()

            HSplitView {
                controlPanel
                    .frame(minWidth: 400, idealWidth: 450)

                statePanel
                    .frame(minWidth: 400)
            }
        }
        .task {
            await cortex.checkHealth()
            if cortex.isConnected {
                await cortex.refreshState()
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: 12) {
            Image(systemName: "brain.head.profile")
                .font(.title2)
                .foregroundColor(cortex.isConnected ? .green : .red)

            VStack(alignment: .leading, spacing: 2) {
                Text("OMEGA Cortex")
                    .font(.headline)
                if cortex.isConnected {
                    if let state = cortex.brainState {
                        Text("Connected — \(state.config?.hidden_dim ?? 0)-dim brain, \(state.inference_count ?? 0) cycles")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    } else {
                        Text("Connected")
                            .font(.caption)
                            .foregroundColor(.green)
                    }
                } else {
                    Text("Not connected — start omega_server/server.py on port 11435")
                        .font(.caption)
                        .foregroundColor(.red)
                }
            }

            Spacer()

            if cortex.isConnected {
                if let state = cortex.brainState, let c = state.cortex {
                    coherenceBadge(c.coherence)
                }
            }

            Button(action: { Task { await cortex.checkHealth(); if cortex.isConnected { await cortex.refreshState() } } }) {
                Image(systemName: "arrow.clockwise")
            }
            .help("Refresh connection")

            if cortex.isConnected {
                Button(action: { Task { try? await cortex.reset() } }) {
                    Label("Reset Brain", systemImage: "arrow.counterclockwise")
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color(nsColor: .windowBackgroundColor))
    }

    private func coherenceBadge(_ coherence: Double) -> some View {
        HStack(spacing: 4) {
            Circle()
                .fill(coherenceColor(coherence))
                .frame(width: 8, height: 8)
            Text(String(format: "%.4f", coherence))
                .font(.system(.caption, design: .monospaced))
            Text("coherence")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(RoundedRectangle(cornerRadius: 6).fill(Color(nsColor: .controlBackgroundColor)))
    }

    // MARK: - Control Panel

    private var controlPanel: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if !cortex.isConnected {
                    notConnectedView
                } else {
                    thinkSection
                    Divider()
                    dreamSection
                    Divider()
                    ambitionSection
                    Divider()
                    inferenceLogSection
                }
            }
            .padding(16)
        }
    }

    private var notConnectedView: some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 40))
                .foregroundColor(.orange)
            Text("OMEGA Cortex Server Not Running")
                .font(.title3)
            Text("Start the server with:")
                .font(.caption)
                .foregroundColor(.secondary)
            Text("python3 omega_server/server.py")
                .font(.system(.body, design: .monospaced))
                .padding(8)
                .background(RoundedRectangle(cornerRadius: 6).fill(Color(nsColor: .textBackgroundColor)))
                .textSelection(.enabled)
        }
        .frame(maxWidth: .infinity)
        .padding(20)
    }

    // MARK: - Think

    private var thinkSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Think — Inference Cycle", systemImage: "bolt.fill")
                .font(.subheadline)
                .fontWeight(.semibold)

            HStack {
                TextField("Enter thought...", text: $inputText)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit { runThink() }

                Button(action: runThink) {
                    if cortex.isThinking {
                        ProgressView()
                            .controlSize(.small)
                    } else {
                        Label("Think", systemImage: "brain")
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(inputText.trimmingCharacters(in: .whitespaces).isEmpty || cortex.isThinking)
            }

            if let inf = lastInference {
                inferenceResultCard(inf)
            }

            if let err = errorMessage {
                Text(err)
                    .font(.caption)
                    .foregroundColor(.red)
                    .padding(6)
                    .background(RoundedRectangle(cornerRadius: 4).fill(Color.red.opacity(0.1)))
            }
        }
    }

    private func inferenceResultCard(_ inf: CortexInference) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: inf.is_safe ? "checkmark.shield.fill" : "xmark.shield.fill")
                    .foregroundColor(inf.is_safe ? .green : .red)
                Text("Cycle #\(inf.inference_id)")
                    .font(.caption)
                    .fontWeight(.bold)
                Spacer()
                Text(String(format: "%.0fms", inf.latency_ms))
                    .font(.caption.monospaced())
                    .foregroundColor(.secondary)
            }

            HStack(spacing: 16) {
                metricPill("Coherence", String(format: "%.6f", inf.post_coherence), .blue)
                metricPill("Delta", String(format: "%+.6f", inf.coherence_delta), inf.coherence_delta > 0 ? .green : .orange)
                metricPill("Helix", String(format: "%.4f", inf.max_helix_alignment), inf.is_safe ? .green : .red)
                metricPill("Signal", inf.ambition_signal.replacingOccurrences(of: "SIGNAL_", with: ""), signalColor(inf.ambition_signal))
            }

            HStack(spacing: 16) {
                metricPill("|ψ| mean", String(format: "%.4f", inf.output_magnitude_mean), .purple)
                metricPill("∠ψ mean", String(format: "%.4f", inf.output_phase_mean), .purple)
                metricPill("Soft Tokens", "\(inf.soft_tokens_shape.map(String.init).joined(separator: "×"))", .orange)
            }
        }
        .padding(10)
        .background(RoundedRectangle(cornerRadius: 8).fill(Color(nsColor: .controlBackgroundColor)))
    }

    // MARK: - Dream

    private var dreamSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Dream — Memory Consolidation", systemImage: "moon.stars.fill")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                Spacer()
                Button("Dream Now") {
                    Task {
                        do {
                            lastDream = try await cortex.dream()
                        } catch {
                            errorMessage = error.localizedDescription
                        }
                    }
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }

            if let dream = lastDream {
                HStack(spacing: 16) {
                    metricPill("Pre", String(format: "%.6f", dream.pre_coherence), .secondary)
                    metricPill("Post", String(format: "%.6f", dream.post_coherence), .blue)
                    metricPill("Gain", String(format: "%+.6f", dream.coherence_gain), dream.coherence_gain > 0 ? .green : .orange)
                    metricPill("Replays", "\(dream.replay_count)", .purple)
                    metricPill("Dreams", "\(dream.total_dreams)", .indigo)
                }
                .padding(8)
                .background(RoundedRectangle(cornerRadius: 6).fill(Color(nsColor: .controlBackgroundColor)))
            }
        }
    }

    // MARK: - Ambition

    private var ambitionSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Ambition — Homeostatic Loop", systemImage: "heart.fill")
                .font(.subheadline)
                .fontWeight(.semibold)

            if let amb = cortex.brainState?.ambition {
                VStack(spacing: 6) {
                    ambitionBar("Dopamine", amb.dopamine, .green)
                    ambitionBar("Entropy", amb.entropy, .red)
                    ambitionBar("Curiosity", amb.curiosity, .blue)
                    ambitionBar("Arousal", amb.arousal, .orange)
                }

                HStack(spacing: 8) {
                    Text("Signal: \(amb.signal.replacingOccurrences(of: "SIGNAL_", with: ""))")
                        .font(.caption.monospaced())
                        .foregroundColor(signalColor(amb.signal))
                    Spacer()
                    Button("Reward") { Task { try? await cortex.sendReward() } }
                        .buttonStyle(.bordered)
                        .controlSize(.mini)
                        .tint(.green)
                    Button("Error") { Task { try? await cortex.sendError() } }
                        .buttonStyle(.bordered)
                        .controlSize(.mini)
                        .tint(.red)
                }
            }
        }
    }

    private func ambitionBar(_ label: String, _ value: Double, _ color: Color) -> some View {
        HStack(spacing: 8) {
            Text(label)
                .font(.caption)
                .frame(width: 70, alignment: .trailing)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 3)
                        .fill(Color.secondary.opacity(0.15))
                    RoundedRectangle(cornerRadius: 3)
                        .fill(color)
                        .frame(width: max(0, geo.size.width * CGFloat(min(1, value))))
                }
            }
            .frame(height: 8)
            Text(String(format: "%.3f", value))
                .font(.caption.monospaced())
                .frame(width: 50, alignment: .trailing)
        }
    }

    // MARK: - Inference Log

    private var inferenceLogSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("Inference Log (\(cortex.inferenceLog.count))", systemImage: "list.bullet")
                .font(.subheadline)
                .fontWeight(.semibold)

            if cortex.inferenceLog.isEmpty {
                Text("No inferences yet — type a thought above")
                    .font(.caption)
                    .foregroundColor(.secondary)
            } else {
                ForEach(cortex.inferenceLog.reversed()) { inf in
                    HStack(spacing: 8) {
                        Text("#\(inf.inference_id)")
                            .font(.caption2.monospaced())
                            .foregroundColor(.secondary)
                            .frame(width: 24)
                        Image(systemName: inf.is_safe ? "checkmark.circle" : "xmark.circle")
                            .foregroundColor(inf.is_safe ? .green : .red)
                            .font(.caption2)
                        Text(inf.input_text)
                            .font(.caption)
                            .lineLimit(1)
                        Spacer()
                        Text(String(format: "c=%.4f", inf.post_coherence))
                            .font(.caption2.monospaced())
                            .foregroundColor(.blue)
                        Text(String(format: "%.0fms", inf.latency_ms))
                            .font(.caption2.monospaced())
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
    }

    // MARK: - State Panel

    private var statePanel: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let state = cortex.brainState {
                    brainInfoSection(state)
                    if let c = state.cortex {
                        phaseHistogramSection(c)
                        magnitudeHistogramSection(c)
                    }
                    if let t = state.transducer {
                        transducerSection(t)
                    }
                } else {
                    VStack {
                        Spacer()
                        Text("No brain state loaded")
                            .foregroundColor(.secondary)
                        Spacer()
                    }
                }
            }
            .padding(16)
        }
    }

    private func brainInfoSection(_ state: BrainState) -> some View {
        GroupBox("Brain Info") {
            VStack(alignment: .leading, spacing: 4) {
                if let cfg = state.config {
                    infoRow("Input Dim", "\(cfg.input_dim)")
                    infoRow("Hidden Dim", "\(cfg.hidden_dim)")
                    infoRow("dt", String(format: "%.4f", cfg.dt))
                    infoRow("Decay Rate", String(format: "%.4f", cfg.decay_rate))
                }
                if let uptime = state.uptime_seconds {
                    infoRow("Uptime", String(format: "%.0fs", uptime))
                }
                infoRow("Inferences", "\(state.inference_count ?? 0)")
                if let fw = state.firmware {
                    infoRow("Firmware", fw.loaded ? "\(fw.name ?? "unknown") v\(fw.version ?? "?")" : "None")
                }
                if let h = state.helix {
                    infoRow("Helix Rules", "\(h.rules_count)")
                }
            }
            .padding(4)
        }
    }

    private func phaseHistogramSection(_ c: CortexMetrics) -> some View {
        GroupBox("Phase Distribution (∠ψ)") {
            VStack(alignment: .leading, spacing: 4) {
                if let hist = c.phase_histogram, !hist.isEmpty {
                    histogramView(data: hist, color: .blue)
                }
                HStack {
                    Text("mean: \(String(format: "%.4f", c.phase_mean))")
                    Spacer()
                    Text("std: \(String(format: "%.4f", c.phase_std))")
                }
                .font(.caption.monospaced())
                .foregroundColor(.secondary)
            }
            .padding(4)
        }
    }

    private func magnitudeHistogramSection(_ c: CortexMetrics) -> some View {
        GroupBox("Magnitude Distribution (|ψ|)") {
            VStack(alignment: .leading, spacing: 4) {
                if let hist = c.magnitude_histogram, !hist.isEmpty {
                    histogramView(data: hist, color: .purple)
                }
                HStack {
                    Text("mean: \(String(format: "%.4f", c.magnitude_mean))")
                    Spacer()
                    Text("std: \(String(format: "%.6f", c.magnitude_std))")
                }
                .font(.caption.monospaced())
                .foregroundColor(.secondary)
            }
            .padding(4)
        }
    }

    private func transducerSection(_ t: TransducerState) -> some View {
        GroupBox("Neural Transducer") {
            VStack(alignment: .leading, spacing: 4) {
                infoRow("Parameters", "\(t.params.formatted())")
                infoRow("OMEGA Dim", "\(t.omega_dim)")
                infoRow("LLM Dim", "\(t.llm_dim)")
                infoRow("Soft Tokens", "\(t.num_soft_tokens)")
            }
            .padding(4)
        }
    }

    private func histogramView(data: [Double], color: Color) -> some View {
        let maxVal = data.max() ?? 1
        return HStack(spacing: 1) {
            ForEach(Array(data.enumerated()), id: \.offset) { _, val in
                RoundedRectangle(cornerRadius: 1)
                    .fill(color.opacity(0.7))
                    .frame(height: maxVal > 0 ? CGFloat(val / maxVal) * 60 : 0)
            }
        }
        .frame(height: 60)
    }

    // MARK: - Helpers

    private func runThink() {
        let text = inputText.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }
        errorMessage = nil
        Task {
            do {
                lastInference = try await cortex.think(text: text)
                inputText = ""
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func metricPill(_ label: String, _ value: String, _ color: Color) -> some View {
        VStack(spacing: 1) {
            Text(value)
                .font(.caption.monospaced())
                .fontWeight(.medium)
                .foregroundColor(color)
            Text(label)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
    }

    private func infoRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
                .frame(width: 90, alignment: .trailing)
            Text(value)
                .font(.caption.monospaced())
        }
    }

    private func coherenceColor(_ c: Double) -> Color {
        if c > 0.5 { return .green }
        if c > 0.1 { return .blue }
        if c > 0.01 { return .orange }
        return .red
    }

    private func signalColor(_ signal: String) -> Color {
        if signal.contains("STABLE") { return .green }
        if signal.contains("CURIOUS") { return .blue }
        if signal.contains("ALERT") { return .orange }
        if signal.contains("DREAM") { return .purple }
        if signal.contains("URGENT") { return .red }
        return .secondary
    }
}
