import Foundation

// MARK: - AXIOM Session Service
// Full session lifecycle with SSE, feedback, question tree caching
// Mirrors: apps/thinktank/lib/hooks/useAxiomSession.ts (677 lines)

actor AxiomSessionService {
    private let api: APIClient
    private let apiBase = "/api/v2/axiom"
    private let cacheKey = "axiom_question_cache"
    private let cacheTTL: TimeInterval = 24 * 60 * 60

    init(api: APIClient = .shared) {
        self.api = api
    }

    // MARK: - Session Lifecycle

    struct StartSessionResponse: Codable {
        let sessionId: String
        let status: String
        let domain: String
        let domainConfidence: Double
        let currentQuestion: ClarionQuestionFull?
        let modelPredictions: [ModelPredictionResponse]
    }

    struct ModelPredictionResponse: Codable {
        let modelId: String
        let modelName: String
        let provider: String
        let score: Double
        var reasons: [String]?
    }

    struct AnswerResponse: Codable {
        let status: String
        let nextQuestion: ClarionQuestionFull?
        let modelPredictions: [ModelPredictionResponse]
        let confidence: Double
        let readyToCompile: Bool
    }

    struct SkipResponse: Codable {
        let status: String
        let nextQuestion: ClarionQuestionFull?
    }

    struct CompileResponse: Codable {
        let status: String
        let compiledPrompt: CompiledPromptWrapper?
        let clarificationNeeded: Bool?
    }

    struct CompiledPromptWrapper: Codable {
        let prompt: PromptContent
        let model: ModelContent
        var metadata: PromptMetadata?
    }

    struct PromptContent: Codable {
        let systemPrompt: String
        let userPrompt: String
    }

    struct ModelContent: Codable {
        let modelId: String
        let modelName: String
    }

    struct PromptMetadata: Codable {
        var tokenCount: Int?
    }

    func startSession(query: String, locale: String? = nil) async throws -> StartSessionResponse {
        struct Body: Encodable { let query: String; let locale: String? }
        return try await api.post(
            "\(apiBase)/session",
            body: Body(query: query, locale: locale)
        )
    }

    func submitAnswer(sessionId: String, questionId: String, answer: String) async throws -> AnswerResponse {
        struct Body: Encodable { let questionId: String; let answer: String }
        return try await api.post(
            "\(apiBase)/session/\(sessionId)/answer",
            body: Body(questionId: questionId, answer: answer)
        )
    }

    func skipQuestion(sessionId: String, questionId: String, reason: String? = nil) async throws -> SkipResponse {
        struct Body: Encodable { let questionId: String; let reason: String? }
        return try await api.post(
            "\(apiBase)/session/\(sessionId)/skip",
            body: Body(questionId: questionId, reason: reason)
        )
    }

    func compile(sessionId: String, forceCompile: Bool = false) async throws -> CompileResponse {
        struct Body: Encodable { let forceCompile: Bool }
        return try await api.post(
            "\(apiBase)/session/\(sessionId)/compile",
            body: Body(forceCompile: forceCompile)
        )
    }

    // MARK: - Feedback

    func submitFeedback(
        sessionId: String,
        feedbackType: String,
        targetType: String,
        targetId: String,
        value: [String: String]
    ) async throws {
        struct Body: Encodable {
            let sessionId: String
            let feedbackType: String
            let targetType: String
            let targetId: String
            let value: [String: String]
        }
        let _: [String: String] = try await api.post(
            "\(apiBase)/feedback",
            body: Body(
                sessionId: sessionId,
                feedbackType: feedbackType,
                targetType: targetType,
                targetId: targetId,
                value: value
            )
        )
    }

    func rateSession(sessionId: String, rating: Int) async throws {
        try await submitFeedback(
            sessionId: sessionId,
            feedbackType: "rating",
            targetType: "session",
            targetId: sessionId,
            value: ["rating": String(rating)]
        )
    }

    func ratePrompt(sessionId: String, thumbsUp: Bool) async throws {
        try await submitFeedback(
            sessionId: sessionId,
            feedbackType: "thumbs",
            targetType: "prompt",
            targetId: sessionId,
            value: ["thumbs": thumbsUp ? "up" : "down"]
        )
    }

    func submitCorrection(sessionId: String, correction: String) async throws {
        try await submitFeedback(
            sessionId: sessionId,
            feedbackType: "correction",
            targetType: "prompt",
            targetId: sessionId,
            value: ["correction": correction]
        )
    }

    // MARK: - Question Tree Caching

    struct CachedTree: Codable {
        let questions: [ClarionQuestionFull]
        let cachedAt: TimeInterval
        let expiresAt: TimeInterval
    }

    func cacheQuestionTree(domainId: String, questions: [ClarionQuestionFull]) {
        var cache = getQuestionCache()
        cache[domainId] = CachedTree(
            questions: questions,
            cachedAt: Date().timeIntervalSince1970,
            expiresAt: Date().timeIntervalSince1970 + cacheTTL
        )
        if let data = try? JSONEncoder().encode(cache) {
            UserDefaults.standard.set(data, forKey: cacheKey)
        }
    }

    func getCachedQuestions(domainId: String) -> [ClarionQuestionFull]? {
        let cache = getQuestionCache()
        guard let entry = cache[domainId],
              entry.expiresAt > Date().timeIntervalSince1970 else {
            return nil
        }
        return entry.questions
    }

    func cleanQuestionCache() {
        var cache = getQuestionCache()
        let now = Date().timeIntervalSince1970
        var cleaned = false
        for (key, entry) in cache {
            if entry.expiresAt < now {
                cache.removeValue(forKey: key)
                cleaned = true
            }
        }
        if cleaned {
            if let data = try? JSONEncoder().encode(cache) {
                UserDefaults.standard.set(data, forKey: cacheKey)
            }
        }
    }

    private func getQuestionCache() -> [String: CachedTree] {
        guard let data = UserDefaults.standard.data(forKey: cacheKey),
              let cache = try? JSONDecoder().decode([String: CachedTree].self, from: data) else {
            return [:]
        }
        return cache
    }

    // MARK: - SSE Stream Connection

    func connectToStream(sessionId: String) -> AsyncThrowingStream<AxiomSSEEvent, Error> {
        return AsyncThrowingStream { continuation in
            Task {
                do {
                    let url = try await api.buildURL("\(apiBase)/stream?sessionId=\(sessionId)")
                    let (bytes, _) = try await URLSession.shared.bytes(from: url)

                    var buffer = ""
                    for try await byte in bytes {
                        let char = String(UnicodeScalar(byte))
                        buffer += char

                        if buffer.hasSuffix("\n\n") {
                            let lines = buffer.components(separatedBy: "\n")
                            for line in lines {
                                if line.hasPrefix("data: ") {
                                    let jsonString = String(line.dropFirst(6))
                                    if let data = jsonString.data(using: .utf8),
                                       let event = try? JSONDecoder().decode(AxiomSSEEvent.self, from: data) {
                                        continuation.yield(event)
                                    }
                                }
                            }
                            buffer = ""
                        }
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }
}

// MARK: - SSE Event Types

struct AxiomSSEEvent: Codable, Sendable {
    let type: String
    let data: AxiomSSEEventData?
}

struct AxiomSSEEventData: Codable, Sendable {
    var scores: [ModelScoreFull]?
    var confidence: Double?
    var threshold: Double?
    var readyToCompile: Bool?
    var questionId: String?
    var questionType: String?
    var text: String?
    var options: [String]?
    var category: String?
    var status: String?
    var prompt: CompiledPrompt?
    var selectedModel: AxiomSelectedModel?
    var message: String?
}

struct AxiomSelectedModel: Codable, Sendable {
    let modelId: String
    let modelName: String
}

// MARK: - AXIOM Session State (Observable)

@MainActor
class AxiomSessionState: ObservableObject {
    @Published var sessionId: String?
    @Published var status: String = "active"
    @Published var workflow: AxiomWorkflowProgress
    @Published var domain: AxiomDomainFull?
    @Published var currentQuestion: ClarionQuestionFull?
    @Published var answeredCount: Int = 0
    @Published var modelScores: [ModelScoreFull] = []
    @Published var compiledPrompt: CompiledPrompt?
    @Published var isLoading: Bool = false
    @Published var error: String?

    private let service = AxiomSessionService()

    init() {
        self.workflow = AxiomWorkflowProgress(
            currentStep: .classify,
            steps: [
                AxiomWorkflowStepInfo(step: .classify, label: "Classify", status: .active),
                AxiomWorkflowStepInfo(step: .clarify, label: "Clarify", status: .pending),
                AxiomWorkflowStepInfo(step: .compile, label: "Compile", status: .pending),
                AxiomWorkflowStepInfo(step: .route, label: "Route", status: .pending),
            ],
            overallProgress: 0
        )
    }

    func startSession(query: String, locale: String? = nil) async {
        isLoading = true
        error = nil

        do {
            let response = try await service.startSession(query: query, locale: locale)

            sessionId = response.sessionId
            status = response.status

            domain = AxiomDomainFull(
                domainId: response.domain,
                path: response.domain.components(separatedBy: "."),
                name: response.domain,
                displayName: response.domain,
                confidence: response.domainConfidence
            )

            currentQuestion = response.currentQuestion

            modelScores = response.modelPredictions.enumerated().map { idx, p in
                ModelScoreFull(
                    modelId: p.modelId,
                    modelName: p.modelName,
                    provider: p.provider,
                    score: p.score * 100,
                    isLeading: idx == 0,
                    reasons: p.reasons ?? []
                )
            }

            workflow = AxiomWorkflowProgress(
                currentStep: .clarify,
                steps: [
                    AxiomWorkflowStepInfo(step: .classify, label: "Classify", status: .completed),
                    AxiomWorkflowStepInfo(step: .clarify, label: "Clarify", status: .active),
                    AxiomWorkflowStepInfo(step: .compile, label: "Compile", status: .pending),
                    AxiomWorkflowStepInfo(step: .route, label: "Route", status: .pending),
                ],
                overallProgress: 25
            )

            isLoading = false
        } catch {
            self.error = error.localizedDescription
            isLoading = false
        }
    }

    func submitAnswer(questionId: String, answer: String) async {
        guard let sid = sessionId else { return }
        isLoading = true

        do {
            let response = try await service.submitAnswer(sessionId: sid, questionId: questionId, answer: answer)
            status = response.status
            currentQuestion = response.nextQuestion
            answeredCount += 1

            let previousScores = modelScores
            modelScores = response.modelPredictions.enumerated().map { idx, p in
                let prev = previousScores.first(where: { $0.modelId == p.modelId })
                return ModelScoreFull(
                    modelId: p.modelId,
                    modelName: p.modelName,
                    provider: p.provider,
                    score: p.score * 100,
                    previousScore: prev?.score,
                    isLeading: idx == 0,
                    reasons: p.reasons ?? []
                )
            }

            let progress = 25.0 + (Double(answeredCount) / 5.0) * 25.0
            workflow = AxiomWorkflowProgress(
                currentStep: response.readyToCompile ? .compile : .clarify,
                steps: [
                    AxiomWorkflowStepInfo(step: .classify, label: "Classify", status: .completed),
                    AxiomWorkflowStepInfo(step: .clarify, label: "Clarify", status: response.readyToCompile ? .completed : .active),
                    AxiomWorkflowStepInfo(step: .compile, label: "Compile", status: response.readyToCompile ? .active : .pending),
                    AxiomWorkflowStepInfo(step: .route, label: "Route", status: .pending),
                ],
                overallProgress: min(progress, 50)
            )

            isLoading = false
        } catch {
            self.error = error.localizedDescription
            isLoading = false
        }
    }

    func skipQuestion(questionId: String, reason: String? = nil) async {
        guard let sid = sessionId else { return }
        isLoading = true

        do {
            let response = try await service.skipQuestion(sessionId: sid, questionId: questionId, reason: reason)
            status = response.status
            currentQuestion = response.nextQuestion
            answeredCount += 1
            isLoading = false
        } catch {
            self.error = error.localizedDescription
            isLoading = false
        }
    }

    func compile(forceCompile: Bool = false) async {
        guard let sid = sessionId else { return }
        isLoading = true

        do {
            let response = try await service.compile(sessionId: sid, forceCompile: forceCompile)

            if response.status == "ready", let compiled = response.compiledPrompt {
                compiledPrompt = CompiledPrompt(
                    systemPrompt: compiled.prompt.systemPrompt,
                    userPrompt: compiled.prompt.userPrompt,
                    modelId: compiled.model.modelId,
                    modelName: compiled.model.modelName,
                    tokenCount: compiled.metadata?.tokenCount ?? 0
                )

                status = "completed"
                workflow = AxiomWorkflowProgress(
                    currentStep: .route,
                    steps: [
                        AxiomWorkflowStepInfo(step: .classify, label: "Classify", status: .completed),
                        AxiomWorkflowStepInfo(step: .clarify, label: "Clarify", status: .completed),
                        AxiomWorkflowStepInfo(step: .compile, label: "Compile", status: .completed),
                        AxiomWorkflowStepInfo(step: .route, label: "Route", status: .completed),
                    ],
                    overallProgress: 100
                )
            } else if response.clarificationNeeded == true {
                status = "awaiting_clarification"
            }

            isLoading = false
        } catch {
            self.error = error.localizedDescription
            isLoading = false
        }
    }

    func rateSession(rating: Int) async {
        guard let sid = sessionId else { return }
        try? await service.rateSession(sessionId: sid, rating: rating)
    }

    func ratePrompt(thumbsUp: Bool) async {
        guard let sid = sessionId else { return }
        try? await service.ratePrompt(sessionId: sid, thumbsUp: thumbsUp)
    }

    func reset() {
        sessionId = nil
        status = "active"
        domain = nil
        currentQuestion = nil
        answeredCount = 0
        modelScores = []
        compiledPrompt = nil
        isLoading = false
        error = nil
        workflow = AxiomWorkflowProgress(
            currentStep: .classify,
            steps: [
                AxiomWorkflowStepInfo(step: .classify, label: "Classify", status: .active),
                AxiomWorkflowStepInfo(step: .clarify, label: "Clarify", status: .pending),
                AxiomWorkflowStepInfo(step: .compile, label: "Compile", status: .pending),
                AxiomWorkflowStepInfo(step: .route, label: "Route", status: .pending),
            ],
            overallProgress: 0
        )
    }
}
