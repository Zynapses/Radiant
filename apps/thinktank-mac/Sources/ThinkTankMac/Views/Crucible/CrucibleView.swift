import SwiftUI

struct CrucibleDeliberationView: View {
    let conversationId: String
    let messageId: String
    @State private var config: CrucibleConfig?
    @State private var events: [DeliberationEvent] = []
    @State private var isLoading = true
    @State private var maxQuestions: Int = 5
    @Environment(\.dismiss) var dismiss

    private let crucibleService = CrucibleService()

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Image(systemName: "flame")
                    .font(.system(size: 16))
                    .foregroundStyle(.orange)
                Text("Crucible Deliberation")
                    .font(.system(size: 16, weight: .bold))
                Spacer()

                if let config, config.canOverride {
                    Stepper("Max Questions: \(maxQuestions)", value: $maxQuestions, in: 1...20)
                        .font(.system(size: 11))
                        .onChange(of: maxQuestions) { _, newValue in
                            Task { _ = try? await crucibleService.updateMaxQuestions(newValue) }
                        }
                }

                Button("Done") { dismiss() }
            }
            .padding()

            Divider().opacity(0.3)

            if isLoading {
                ProgressView("Loading deliberation...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if events.isEmpty {
                EmptyStateView(
                    icon: "flame",
                    title: "No deliberation events",
                    message: "Crucible deliberation occurs when multi-model verification is triggered."
                )
            } else {
                // Config summary
                if let config {
                    HStack(spacing: 16) {
                        HStack(spacing: 4) {
                            Text("Mode:")
                                .font(.system(size: 11))
                                .foregroundStyle(.tertiary)
                            BadgeView(text: config.costMode, size: .small)
                        }
                        HStack(spacing: 4) {
                            Text("Max Questions:")
                                .font(.system(size: 11))
                                .foregroundStyle(.tertiary)
                            Text("\(config.maxQuestions)")
                                .font(.system(size: 11, weight: .medium))
                        }
                        HStack(spacing: 4) {
                            Text("Source:")
                                .font(.system(size: 11))
                                .foregroundStyle(.tertiary)
                            Text(config.source)
                                .font(.system(size: 11))
                        }
                        Spacer()
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 8)
                    .background(.ultraThinMaterial)
                }

                // Events timeline
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(events) { event in
                            DeliberationEventCard(event: event)
                        }
                    }
                    .padding()
                }
            }
        }
        .task {
            isLoading = true
            do {
                async let configTask = crucibleService.getConfig()
                async let eventsTask = crucibleService.getEvents(conversationId: conversationId, messageId: messageId)
                let (fetchedConfig, fetchedEvents) = try await (configTask, eventsTask)
                config = fetchedConfig
                events = fetchedEvents
                maxQuestions = fetchedConfig.maxQuestions
            } catch {
                // Graceful fallback
            }
            isLoading = false
        }
    }
}

struct DeliberationEventCard: View {
    let event: DeliberationEvent
    @State private var isExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Question header
            HStack {
                ZStack {
                    Circle()
                        .fill(Color.orange.opacity(0.2))
                        .frame(width: 28, height: 28)
                    Text("Q\(event.questionNumber)")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.orange)
                }

                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(event.questionType.capitalized)
                            .font(.system(size: 11, weight: .semibold))
                        if let score = event.qualityScore {
                            BadgeView(text: "Quality: \(score)", color: .green, size: .small)
                        }
                    }

                    HStack(spacing: 4) {
                        Text("Asked by \(event.askerModel)")
                            .font(.system(size: 10))
                            .foregroundStyle(.tertiary)
                        Image(systemName: "arrow.right")
                            .font(.system(size: 8))
                            .foregroundStyle(.tertiary)
                        Text(event.targetModel)
                            .font(.system(size: 10))
                            .foregroundStyle(.tertiary)
                    }
                }

                Spacer()

                Text(event.askedAt, style: .time)
                    .font(.system(size: 10))
                    .foregroundStyle(.tertiary)

                Button {
                    withAnimation(.spring(response: 0.3)) { isExpanded.toggle() }
                } label: {
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 10))
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }

            // Question text
            Text(event.questionText)
                .font(.system(size: 12))
                .foregroundStyle(.primary)

            // Answer (expanded)
            if isExpanded, let answer = event.answer {
                VStack(alignment: .leading, spacing: 6) {
                    Divider().opacity(0.2)

                    Text(answer.answerText)
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)

                    if answer.circularCitationDetected {
                        HStack(spacing: 6) {
                            Image(systemName: "exclamationmark.triangle")
                                .font(.system(size: 11))
                                .foregroundStyle(.yellow)
                            Text("Circular citation detected")
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(.yellow)
                        }
                        .padding(6)
                        .background(Color.yellow.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                    }
                }
            }
        }
        .padding(12)
        .glassCard(cornerRadius: 10)
    }
}
