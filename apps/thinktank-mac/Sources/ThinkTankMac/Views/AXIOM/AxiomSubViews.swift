import SwiftUI

// MARK: - AXIOM Sub-Views
// Mirrors: apps/thinktank/components/axiom/ (10 sub-components)

// MARK: - Workflow Progress View

struct AxiomWorkflowProgressView: View {
    let workflow: AxiomWorkflowProgress

    var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 0) {
                ForEach(workflow.steps) { stepInfo in
                    HStack(spacing: 0) {
                        VStack(spacing: 4) {
                            ZStack {
                                Circle()
                                    .fill(stepColor(stepInfo.status))
                                    .frame(width: 28, height: 28)
                                Image(systemName: stepIcon(stepInfo))
                                    .font(.caption2)
                                    .foregroundStyle(.white)
                            }
                            Text(stepInfo.label)
                                .font(.caption2)
                                .foregroundStyle(stepInfo.status == .pending ? .secondary : .primary)
                        }
                        if stepInfo.step != .route {
                            Rectangle()
                                .fill(stepInfo.status == .completed ? Color.green : Color.secondary.opacity(0.2))
                                .frame(height: 2)
                                .frame(maxWidth: .infinity)
                        }
                    }
                }
            }

            ProgressView(value: workflow.overallProgress, total: 100)
                .tint(.blue)

            Text("\(Int(workflow.overallProgress))% complete")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    private func stepColor(_ status: AxiomStepStatus) -> Color {
        switch status {
        case .completed: return .green
        case .active: return .blue
        case .pending: return .secondary.opacity(0.3)
        }
    }

    private func stepIcon(_ stepInfo: AxiomWorkflowStepInfo) -> String {
        if stepInfo.status == .completed { return "checkmark" }
        return stepInfo.step.systemImage
    }
}

// MARK: - Confidence Meter

struct ConfidenceMeterView: View {
    let confidence: Double
    var showLabel: Bool = true

    var body: some View {
        VStack(spacing: 4) {
            ZStack {
                Circle()
                    .stroke(Color.secondary.opacity(0.15), lineWidth: 4)
                Circle()
                    .trim(from: 0, to: confidence)
                    .stroke(confidenceColor, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                Text("\(Int(confidence * 100))")
                    .font(.caption.bold())
            }
            .frame(width: 44, height: 44)

            if showLabel {
                Text("Confidence")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var confidenceColor: Color {
        if confidence >= 0.8 { return .green }
        if confidence >= 0.5 { return .orange }
        return .red
    }
}

// MARK: - Domain Display

struct AxiomDomainDisplayView: View {
    let domain: AxiomDomainFull

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                if let icon = domain.icon {
                    Image(systemName: icon)
                        .foregroundStyle(.blue)
                }
                Text(domain.displayName)
                    .font(.headline)
                Spacer()
                ConfidenceMeterView(confidence: domain.confidence, showLabel: false)
                    .scaleEffect(0.7)
            }

            if domain.path.count > 1 {
                HStack(spacing: 4) {
                    ForEach(domain.path, id: \.self) { segment in
                        Text(segment)
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.blue.opacity(0.1))
                            .clipShape(Capsule())
                        if segment != domain.path.last {
                            Image(systemName: "chevron.right")
                                .font(.system(size: 7))
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }

            if let related = domain.relatedDomains, !related.isEmpty {
                HStack(spacing: 4) {
                    Text("Related:")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    ForEach(related.prefix(3), id: \.self) { rd in
                        Text(rd)
                            .font(.caption2)
                            .foregroundStyle(.blue)
                    }
                }
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

// MARK: - Model Score Bars

struct ModelScoreBarsView: View {
    let scores: [ModelScoreFull]

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Model Scores")
                .font(.caption.bold())
                .foregroundStyle(.secondary)

            ForEach(scores) { score in
                HStack(spacing: 8) {
                    VStack(alignment: .leading, spacing: 1) {
                        HStack {
                            Text(score.modelName)
                                .font(.caption)
                                .lineLimit(1)
                            if score.isLeading {
                                Image(systemName: "crown.fill")
                                    .font(.caption2)
                                    .foregroundStyle(.yellow)
                            }
                        }
                        Text(score.provider)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    .frame(width: 120, alignment: .leading)

                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 3)
                                .fill(Color.secondary.opacity(0.1))
                            RoundedRectangle(cornerRadius: 3)
                                .fill(barColor(score))
                                .frame(width: geo.size.width * (score.score / 100))
                        }
                    }
                    .frame(height: 12)

                    Text("\(Int(score.score))%")
                        .font(.caption.monospaced())
                        .frame(width: 35, alignment: .trailing)

                    if let delta = scoreDelta(score) {
                        Text(delta > 0 ? "+\(Int(delta))" : "\(Int(delta))")
                            .font(.caption2)
                            .foregroundStyle(delta > 0 ? .green : .red)
                            .frame(width: 30)
                    }
                }
            }
        }
    }

    private func barColor(_ score: ModelScoreFull) -> Color {
        if score.isLeading { return .blue }
        if score.score >= 70 { return .green }
        if score.score >= 40 { return .orange }
        return .red.opacity(0.7)
    }

    private func scoreDelta(_ score: ModelScoreFull) -> Double? {
        guard let prev = score.previousScore else { return nil }
        return score.score - prev
    }
}

// MARK: - Clarification Card

struct ClarificationCardView: View {
    let question: ClarionQuestionFull
    let onAnswer: (String) -> Void
    let onSkip: () -> Void

    @State private var textAnswer = ""
    @State private var selectedOption: String?
    @State private var selectedOptions: Set<String> = []
    @State private var scaleValue: Double = 5
    @State private var boolValue: Bool?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "questionmark.circle.fill")
                    .foregroundStyle(.blue)
                Text("Question \(question.priority)")
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
                Spacer()
                Text(question.category)
                    .font(.caption2)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.blue.opacity(0.1))
                    .clipShape(Capsule())
            }

            Text(question.text)
                .font(.body)

            if let hint = question.hint {
                Text(hint)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .italic()
            }

            questionInput

            HStack {
                Button("Skip") {
                    onSkip()
                }
                .buttonStyle(.bordered)

                Spacer()

                Button("Submit") {
                    submitAnswer()
                }
                .buttonStyle(.borderedProminent)
                .disabled(!canSubmit)
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    @ViewBuilder
    private var questionInput: some View {
        switch question.type {
        case .choice:
            if let options = question.options {
                VStack(spacing: 6) {
                    ForEach(options, id: \.self) { option in
                        Button {
                            selectedOption = option
                        } label: {
                            HStack {
                                Image(systemName: selectedOption == option ? "largecircle.fill.circle" : "circle")
                                    .foregroundStyle(selectedOption == option ? .blue : .secondary)
                                Text(option)
                                    .font(.body)
                                Spacer()
                            }
                            .padding(8)
                            .background(selectedOption == option ? Color.blue.opacity(0.05) : Color.clear)
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

        case .multiSelect:
            if let options = question.options {
                VStack(spacing: 6) {
                    ForEach(options, id: \.self) { option in
                        Button {
                            if selectedOptions.contains(option) {
                                selectedOptions.remove(option)
                            } else {
                                selectedOptions.insert(option)
                            }
                        } label: {
                            HStack {
                                Image(systemName: selectedOptions.contains(option) ? "checkmark.square.fill" : "square")
                                    .foregroundStyle(selectedOptions.contains(option) ? .blue : .secondary)
                                Text(option)
                                    .font(.body)
                                Spacer()
                            }
                            .padding(8)
                            .background(selectedOptions.contains(option) ? Color.blue.opacity(0.05) : Color.clear)
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

        case .text:
            TextField("Type your answer...", text: $textAnswer, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .lineLimit(2...5)

        case .scale:
            VStack(spacing: 4) {
                Slider(
                    value: $scaleValue,
                    in: Double(question.scaleMin ?? 1)...Double(question.scaleMax ?? 10),
                    step: 1
                )
                HStack {
                    Text(question.scaleLabels?.low ?? "Low")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text("\(Int(scaleValue))")
                        .font(.caption.bold())
                    Spacer()
                    Text(question.scaleLabels?.high ?? "High")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

        case .boolean:
            HStack(spacing: 12) {
                Button {
                    boolValue = true
                } label: {
                    Text("Yes")
                        .frame(maxWidth: .infinity)
                        .padding(8)
                        .background(boolValue == true ? Color.green.opacity(0.2) : Color.secondary.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                }
                .buttonStyle(.plain)

                Button {
                    boolValue = false
                } label: {
                    Text("No")
                        .frame(maxWidth: .infinity)
                        .padding(8)
                        .background(boolValue == false ? Color.red.opacity(0.2) : Color.secondary.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var canSubmit: Bool {
        switch question.type {
        case .choice: return selectedOption != nil
        case .multiSelect: return !selectedOptions.isEmpty
        case .text: return !textAnswer.isEmpty
        case .scale: return true
        case .boolean: return boolValue != nil
        }
    }

    private func submitAnswer() {
        let answer: String
        switch question.type {
        case .choice: answer = selectedOption ?? ""
        case .multiSelect: answer = Array(selectedOptions).joined(separator: ",")
        case .text: answer = textAnswer
        case .scale: answer = String(Int(scaleValue))
        case .boolean: answer = boolValue == true ? "true" : "false"
        }
        onAnswer(answer)
    }
}

// MARK: - Compiled Prompt Preview

struct CompiledPromptPreviewView: View {
    let prompt: CompiledPrompt
    let onUse: () -> Void
    let onCopy: () -> Void
    var onRateUp: (() -> Void)?
    var onRateDown: (() -> Void)?

    @State private var showSystemPrompt = true

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "doc.text.fill")
                    .foregroundStyle(.green)
                Text("Compiled Prompt")
                    .font(.headline)
                Spacer()
                Text("\(prompt.tokenCount) tokens")
                    .font(.caption)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.blue.opacity(0.1))
                    .clipShape(Capsule())
            }

            HStack {
                Text("Model: \(prompt.modelName)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
            }

            Picker("View", selection: $showSystemPrompt) {
                Text("System").tag(true)
                Text("User").tag(false)
            }
            .pickerStyle(.segmented)

            ScrollView {
                Text(showSystemPrompt ? prompt.systemPrompt : prompt.userPrompt)
                    .font(.system(.body, design: .monospaced))
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(8)
                    .background(Color.secondary.opacity(0.05))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
            }
            .frame(maxHeight: 200)

            HStack(spacing: 8) {
                if let onRateUp, let onRateDown {
                    Button(action: onRateUp) {
                        Image(systemName: "hand.thumbsup")
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)

                    Button(action: onRateDown) {
                        Image(systemName: "hand.thumbsdown")
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }

                Spacer()

                Button(action: onCopy) {
                    Label("Copy", systemImage: "doc.on.doc")
                }
                .buttonStyle(.bordered)

                Button(action: onUse) {
                    Label("Use Prompt", systemImage: "paperplane.fill")
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

// MARK: - Feedback Capture View

struct AxiomFeedbackCaptureView: View {
    let sessionId: String
    let onSubmit: (Int) -> Void
    @State private var rating: Int = 0
    @State private var submitted = false

    var body: some View {
        if submitted {
            HStack {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(.green)
                Text("Thanks for your feedback!")
                    .font(.caption)
            }
            .padding(8)
        } else {
            VStack(spacing: 8) {
                Text("Rate this session")
                    .font(.caption.bold())

                HStack(spacing: 4) {
                    ForEach(1...5, id: \.self) { star in
                        Button {
                            rating = star
                        } label: {
                            Image(systemName: star <= rating ? "star.fill" : "star")
                                .foregroundStyle(star <= rating ? .yellow : .secondary)
                        }
                        .buttonStyle(.plain)
                    }
                }

                if rating > 0 {
                    Button("Submit") {
                        onSubmit(rating)
                        submitted = true
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                }
            }
            .padding(12)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }
}

// MARK: - Clarion Preferences Panel

struct ClarionPreferencesPanelView: View {
    @Binding var preferences: ClarionPreferences

    var body: some View {
        Form {
            Section("Clarification") {
                Picker("Mode", selection: $preferences.clarificationMode) {
                    ForEach(ClarificationMode.allCases, id: \.self) { mode in
                        Text(mode.displayName).tag(mode)
                    }
                }

                Stepper("Max Questions: \(preferences.maxQuestions)", value: $preferences.maxQuestions, in: 1...15)
            }

            Section("Display") {
                Toggle("Show Model Scores", isOn: $preferences.showModelScores)
                Toggle("Show Confidence Meter", isOn: $preferences.showConfidenceMeter)
                Toggle("Show Domain Details", isOn: $preferences.showDomainDetails)
                Toggle("Animations", isOn: $preferences.animationsEnabled)
                Toggle("Sound Effects", isOn: $preferences.soundEnabled)
            }

            Section("Learning") {
                Toggle("Remember Answers", isOn: $preferences.rememberAnswers)
                Toggle("Learn Preferences", isOn: $preferences.learnPreferences)
                Toggle("Auto-skip Known Answers", isOn: $preferences.autoSkipKnownAnswers)
            }
        }
        .formStyle(.grouped)
    }
}
