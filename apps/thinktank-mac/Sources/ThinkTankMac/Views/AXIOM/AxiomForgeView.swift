import SwiftUI

struct AxiomForgeView: View {
    @State private var prompt = ""
    @State private var session: AxiomSession?
    @State private var currentAnswer = ""
    @State private var isLoading = false
    @State private var error: String?
    @Environment(\.dismiss) var dismiss

    private let axiomService = AxiomService()

    private var steps: [AxiomStep] {
        session?.workflow.steps ?? [
            AxiomStep(id: "1", name: "Classify", status: .pending),
            AxiomStep(id: "2", name: "Clarify", status: .pending),
            AxiomStep(id: "3", name: "Compile", status: .pending),
            AxiomStep(id: "4", name: "Route", status: .pending),
        ]
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Image(systemName: "wand.and.stars")
                    .font(.system(size: 16))
                    .foregroundStyle(.purple)
                Text("AXIOM Forge")
                    .font(.system(size: 16, weight: .bold))
                Text("Prompt Optimization")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                Spacer()
                Button("Close") { dismiss() }
            }
            .padding()

            Divider().opacity(0.3)

            // Workflow Progress
            workflowProgress
                .padding(.horizontal)
                .padding(.top, 12)

            Divider().opacity(0.2).padding(.vertical, 8)

            // Content
            ScrollView {
                VStack(spacing: 16) {
                    if session == nil {
                        // Initial prompt input
                        initialPromptInput
                    } else if let question = session?.currentQuestion {
                        // Clarification question
                        clarificationCard(question)
                    } else if session?.status == .compiling || session?.status == .completed {
                        // Results
                        compilationResults
                    }
                }
                .padding()
            }
        }
    }

    // MARK: - Workflow Progress

    private var workflowProgress: some View {
        HStack(spacing: 0) {
            ForEach(Array(steps.enumerated()), id: \.element.id) { index, step in
                HStack(spacing: 6) {
                    ZStack {
                        Circle()
                            .fill(fillForStatus(step.status))
                            .frame(width: 24, height: 24)

                        if step.status == .running || step.status == .executing {
                            ProgressView()
                                .controlSize(.mini)
                                .tint(.white)
                        } else if step.status == .completed {
                            Image(systemName: "checkmark")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(.white)
                        } else {
                            Text("\(index + 1)")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(.white.opacity(0.6))
                        }
                    }

                    Text(step.name)
                        .font(.system(size: 11, weight: step.status == .running ? .semibold : .regular))
                        .foregroundStyle(step.status == .pending ? .tertiary : .primary)
                }

                if index < steps.count - 1 {
                    Rectangle()
                        .fill(step.status == .completed ? Color.purple : Color.white.opacity(0.1))
                        .frame(height: 2)
                        .frame(maxWidth: .infinity)
                        .padding(.horizontal, 4)
                }
            }
        }
    }

    // MARK: - Initial Prompt

    private var initialPromptInput: some View {
        VStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Enter your prompt")
                    .font(.system(size: 14, weight: .semibold))
                Text("AXIOM will analyze, refine, and optimize your prompt for the best AI response.")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            TextEditor(text: $prompt)
                .font(.system(size: 13))
                .scrollContentBackground(.hidden)
                .frame(minHeight: 100)
                .padding(12)
                .background(Color.white.opacity(0.04))
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(Color.white.opacity(0.08), lineWidth: 1)
                )

            GradientButton(title: "Start Optimization", icon: "wand.and.stars", action: {
                Task { await startSession() }
            }, isLoading: isLoading)
            .disabled(prompt.trimmingCharacters(in: .whitespaces).isEmpty)
        }
    }

    // MARK: - Clarification Card

    private func clarificationCard(_ question: ClarionQuestion) -> some View {
        VStack(spacing: 16) {
            // Domain detection
            if let domain = session?.domain {
                HStack(spacing: 8) {
                    Image(systemName: "globe")
                        .foregroundStyle(.blue)
                    Text("Detected domain: **\(domain.name)**")
                        .font(.system(size: 12))
                    BadgeView(text: "\(Int(domain.confidence * 100))%", color: .blue, size: .small)
                    Spacer()
                }
                .padding(10)
                .glassCard(cornerRadius: 8)
            }

            // Question
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    BadgeView(text: question.importance.uppercased(), color: question.importance == "high" ? .red : .orange, size: .small)
                    BadgeView(text: question.type, size: .small)
                    Spacer()
                    Text("Q\(session?.answeredCount ?? 0 + 1)")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(.tertiary)
                }

                Text(question.text)
                    .font(.system(size: 14, weight: .medium))

                if let options = question.options, !options.isEmpty {
                    VStack(spacing: 6) {
                        ForEach(options, id: \.self) { option in
                            Button {
                                currentAnswer = option
                                Task { await answerQuestion(question.questionId, answer: option) }
                            } label: {
                                Text(option)
                                    .font(.system(size: 12))
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(10)
                                    .background(Color.white.opacity(0.04))
                                    .clipShape(RoundedRectangle(cornerRadius: 6))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                HStack {
                    TextField("Or type your answer...", text: $currentAnswer)
                        .textFieldStyle(.plain)
                        .font(.system(size: 13))
                        .padding(8)
                        .background(Color.white.opacity(0.04))
                        .clipShape(RoundedRectangle(cornerRadius: 6))

                    GradientButton(title: "Answer", icon: "arrow.right") {
                        Task { await answerQuestion(question.questionId, answer: currentAnswer) }
                    }
                    .disabled(currentAnswer.isEmpty)
                }
            }
            .padding(16)
            .glassCard(cornerRadius: 12)
        }
    }

    // MARK: - Compilation Results

    private var compilationResults: some View {
        VStack(spacing: 16) {
            // Model Scores
            if let scores = session?.modelScores, !scores.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Model Routing")
                        .font(.system(size: 13, weight: .semibold))

                    ForEach(scores.sorted(by: { $0.score > $1.score })) { score in
                        HStack(spacing: 8) {
                            Text(score.modelName)
                                .font(.system(size: 12))
                                .frame(width: 120, alignment: .leading)

                            ProgressView(value: score.score, total: 100)
                                .tint(score.score > 80 ? .green : score.score > 50 ? .yellow : .orange)

                            Text("\(Int(score.score))%")
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundStyle(.secondary)
                                .frame(width: 35)
                        }
                    }
                }
                .padding(12)
                .glassCard(cornerRadius: 10)
            }

            // Compiled Prompt
            if let compiled = session?.compiledPrompt {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Compiled Prompt")
                            .font(.system(size: 13, weight: .semibold))
                        Spacer()
                        BadgeView(text: compiled.modelName, color: .green, size: .small)
                        Text("\(compiled.tokenCount) tokens")
                            .font(.system(size: 10))
                            .foregroundStyle(.tertiary)
                    }

                    Text("System Prompt")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.secondary)

                    Text(compiled.systemPrompt)
                        .font(.system(size: 12))
                        .padding(8)
                        .background(Color.white.opacity(0.03))
                        .clipShape(RoundedRectangle(cornerRadius: 6))

                    Text("User Prompt")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.secondary)

                    Text(compiled.userPrompt)
                        .font(.system(size: 12))
                        .padding(8)
                        .background(Color.white.opacity(0.03))
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                }
                .padding(12)
                .glassCard(cornerRadius: 10)

                HStack {
                    GradientButton(title: "Use This Prompt", icon: "checkmark.circle") {
                        // Copy to clipboard and dismiss
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString(compiled.userPrompt, forType: .string)
                        dismiss()
                    }

                    Button("Copy System Prompt") {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString(compiled.systemPrompt, forType: .string)
                    }
                }
            }
        }
    }

    // MARK: - Actions

    private func startSession() async {
        isLoading = true
        do {
            session = try await axiomService.startSession(prompt: prompt)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    private func answerQuestion(_ questionId: String, answer: String) async {
        isLoading = true
        do {
            session = try await axiomService.answerQuestion(
                sessionId: session!.sessionId,
                questionId: questionId,
                answer: answer
            )
            currentAnswer = ""

            if session?.status == .readyToCompile {
                session = try await axiomService.compile(sessionId: session!.sessionId)
            }
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    private func fillForStatus(_ status: PlanStatus) -> Color {
        switch status {
        case .completed: return .purple
        case .running, .executing: return .blue
        case .pending: return Color.white.opacity(0.1)
        case .failed: return .red
        }
    }
}
