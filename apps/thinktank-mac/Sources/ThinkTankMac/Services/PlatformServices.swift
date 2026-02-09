import Foundation

// MARK: - Model Service

actor ModelService {
    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    func listModels() async throws -> [AIModel] {
        let response: APIResponse<[AIModel]> = try await api.get("/api/thinktank/models")
        return response.data
    }

    func getModelCategories() async throws -> [ModelCategory] {
        let response: APIResponse<[ModelCategory]> = try await api.get("/api/thinktank/models/categories")
        return response.data
    }

    func detectDomain(prompt: String) async throws -> DomainDetection {
        struct Body: Encodable { let prompt: String }
        let response: APIResponse<DomainDetection> = try await api.post(
            "/api/thinktank/domain/detect",
            body: Body(prompt: prompt)
        )
        return response.data
    }
}

// MARK: - Rules Service

actor RulesService {
    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    func listRules() async throws -> [UserRule] {
        let response: APIResponse<[UserRule]> = try await api.get("/api/thinktank/rules")
        return response.data
    }

    func createRule(ruleText: String, ruleType: RuleType, priority: Int = 50) async throws -> UserRule {
        struct Body: Encodable {
            let ruleText: String
            let ruleType: RuleType
            let priority: Int
        }
        let response: APIResponse<UserRule> = try await api.post(
            "/api/thinktank/rules",
            body: Body(ruleText: ruleText, ruleType: ruleType, priority: priority)
        )
        return response.data
    }

    func updateRule(_ id: String, ruleText: String, ruleType: RuleType, priority: Int, isActive: Bool) async throws -> UserRule {
        struct Body: Encodable {
            let ruleText: String
            let ruleType: RuleType
            let priority: Int
            let isActive: Bool
        }
        let response: APIResponse<UserRule> = try await api.put(
            "/api/thinktank/rules/\(id)",
            body: Body(ruleText: ruleText, ruleType: ruleType, priority: priority, isActive: isActive)
        )
        return response.data
    }

    func deleteRule(_ id: String) async throws {
        try await api.delete("/api/thinktank/rules/\(id)")
    }

    func getPresets() async throws -> [PresetCategory] {
        let response: APIResponse<[PresetCategory]> = try await api.get("/api/thinktank/rules/presets")
        return response.data
    }

    func addPreset(_ presetId: String) async throws -> UserRule {
        struct Body: Encodable { let presetId: String }
        let response: APIResponse<UserRule> = try await api.post(
            "/api/thinktank/rules/presets/add",
            body: Body(presetId: presetId)
        )
        return response.data
    }
}

// MARK: - Settings Service

actor SettingsService {
    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    func getSettings() async throws -> UserSettings {
        let response: APIResponse<UserSettings> = try await api.get("/api/thinktank/settings")
        return response.data
    }

    func updateSettings(_ settings: UserSettings) async throws -> UserSettings {
        let response: APIResponse<UserSettings> = try await api.put(
            "/api/thinktank/settings",
            body: settings
        )
        return response.data
    }
}

// MARK: - Analytics Service

actor AnalyticsService {
    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    func getAnalytics() async throws -> UserAnalytics {
        let response: APIResponse<UserAnalytics> = try await api.get("/api/thinktank/analytics")
        return response.data
    }

    func getAchievements() async throws -> [Achievement] {
        let response: APIResponse<[Achievement]> = try await api.get("/api/thinktank/achievements")
        return response.data
    }
}

// MARK: - Artifact Service

actor ArtifactService {
    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    func listArtifacts(conversationId: String? = nil) async throws -> [Artifact] {
        var params: [String: String] = [:]
        if let conversationId { params["conversationId"] = conversationId }
        let response: APIResponse<[Artifact]> = try await api.get("/api/thinktank/artifacts", params: params)
        return response.data
    }

    func getArtifact(_ id: String) async throws -> Artifact {
        let response: APIResponse<Artifact> = try await api.get("/api/thinktank/artifacts/\(id)")
        return response.data
    }
}

// MARK: - Brain Plan Service

actor BrainPlanService {
    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    func getBrainPlan(conversationId: String, messageId: String) async throws -> BrainPlan {
        let response: APIResponse<BrainPlan> = try await api.get(
            "/api/thinktank/conversations/\(conversationId)/messages/\(messageId)/brain-plan"
        )
        return response.data
    }

    func getGovernorStatus() async throws -> GovernorStatus {
        let response: APIResponse<GovernorStatus> = try await api.get("/api/thinktank/governor/status")
        return response.data
    }
}

// MARK: - Governor Service (Full)

actor GovernorService {
    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    func getDashboard() async throws -> GovernorDashboard {
        let response: APIResponse<GovernorDashboard> = try await api.get("/api/thinktank/governor")
        return response.data
    }

    func getStatus() async throws -> GovernorStatus {
        let response: APIResponse<GovernorStatus> = try await api.get("/api/thinktank/governor/status")
        return response.data
    }

    func getConfig() async throws -> GovernorConfig {
        let response: APIResponse<GovernorConfig> = try await api.get("/api/thinktank/governor/config")
        return response.data
    }

    func updateConfig(_ updates: GovernorConfig) async throws -> GovernorConfig {
        let response: APIResponse<GovernorConfig> = try await api.put(
            "/api/thinktank/governor/config",
            body: updates
        )
        return response.data
    }

    func setMode(_ mode: GovernorMode) async throws {
        struct Body: Encodable { let mode: GovernorMode }
        struct ModeResponse: Codable { let mode: GovernorMode; let message: String }
        let _: APIResponse<ModeResponse> = try await api.put(
            "/api/thinktank/governor/mode",
            body: Body(mode: mode)
        )
    }

    func recommendModel(taskType: String, complexity: Int = 5) async throws -> ModelRecommendation {
        struct Body: Encodable { let taskType: String; let complexity: Int }
        let response: APIResponse<ModelRecommendation> = try await api.post(
            "/api/thinktank/governor/recommend",
            body: Body(taskType: taskType, complexity: complexity)
        )
        return response.data
    }

    func getMetrics(period: String = "day") async throws -> CostMetrics {
        let response: APIResponse<CostMetrics> = try await api.get(
            "/api/thinktank/governor/metrics",
            params: ["period": period]
        )
        return response.data
    }

    func getBudget(estimatedCost: Double = 0) async throws -> BudgetStatus {
        let response: APIResponse<BudgetStatus> = try await api.get(
            "/api/thinktank/governor/budget",
            params: ["estimate": String(estimatedCost)]
        )
        return response.data
    }

    func updateBudget(budgetLimit: Double?, costAlertThreshold: Double?) async throws -> GovernorConfig {
        struct Body: Encodable { let budgetLimit: Double?; let costAlertThreshold: Double? }
        let response: APIResponse<GovernorConfig> = try await api.put(
            "/api/thinktank/governor/budget",
            body: Body(budgetLimit: budgetLimit, costAlertThreshold: costAlertThreshold)
        )
        return response.data
    }

    func getTiers() async throws -> [GovernorModelTier] {
        let response: APIResponse<[GovernorModelTier]> = try await api.get("/api/thinktank/governor/tiers")
        return response.data
    }

    func getRules() async throws -> [ArbitrageRule] {
        let response: APIResponse<[ArbitrageRule]> = try await api.get("/api/thinktank/governor/rules")
        return response.data
    }

    func addRule(_ rule: ArbitrageRule) async throws -> ArbitrageRule {
        let response: APIResponse<ArbitrageRule> = try await api.post(
            "/api/thinktank/governor/rules",
            body: rule
        )
        return response.data
    }

    func deleteRule(_ ruleId: String) async throws {
        try await api.delete("/api/thinktank/governor/rules/\(ruleId)")
    }

    func getRecentDecisions(limit: Int = 10) async throws -> [GovernorDecision] {
        struct DecisionsResponse: Codable { let decisions: [GovernorDecision] }
        let response: APIResponse<DecisionsResponse> = try await api.get(
            "/api/thinktank/governor/decisions",
            params: ["limit": String(limit)]
        )
        return response.data.decisions
    }

    func getSavingsHistory(days: Int = 30) async throws -> [SavingsHistoryEntry] {
        struct HistoryResponse: Codable { let history: [SavingsHistoryEntry] }
        let response: APIResponse<HistoryResponse> = try await api.get(
            "/api/thinktank/governor/savings-history",
            params: ["days": String(days)]
        )
        return response.data.history
    }
}

// MARK: - Time Travel Service

actor TimeTravelService {
    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    func getSnapshots(conversationId: String) async throws -> [Snapshot] {
        try await api.get("/api/thinktank/conversations/\(conversationId)/snapshots")
    }

    func restoreSnapshot(conversationId: String, snapshotId: String) async throws -> [ChatMessage] {
        struct Body: Encodable { let snapshotId: String }
        let response: APIResponse<[ChatMessage]> = try await api.post(
            "/api/thinktank/conversations/\(conversationId)/restore",
            body: Body(snapshotId: snapshotId)
        )
        return response.data
    }

    func createBranch(conversationId: String, snapshotId: String, name: String) async throws -> Conversation {
        struct Body: Encodable { let snapshotId: String; let name: String }
        let response: APIResponse<Conversation> = try await api.post(
            "/api/thinktank/conversations/\(conversationId)/branch",
            body: Body(snapshotId: snapshotId, name: name)
        )
        return response.data
    }

    func bookmarkSnapshot(conversationId: String, snapshotId: String, label: String) async throws {
        struct Body: Encodable { let label: String }
        let _: APIResponse<[String: String]> = try await api.put(
            "/api/thinktank/conversations/\(conversationId)/snapshots/\(snapshotId)/bookmark",
            body: Body(label: label)
        )
    }
}

// MARK: - AXIOM Service

actor AxiomService {
    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    func startSession(prompt: String) async throws -> AxiomSession {
        struct Body: Encodable { let prompt: String }
        let response: APIResponse<AxiomSession> = try await api.post(
            "/api/thinktank/axiom/sessions",
            body: Body(prompt: prompt)
        )
        return response.data
    }

    func answerQuestion(sessionId: String, questionId: String, answer: String) async throws -> AxiomSession {
        struct Body: Encodable { let questionId: String; let answer: String }
        let response: APIResponse<AxiomSession> = try await api.post(
            "/api/thinktank/axiom/sessions/\(sessionId)/answer",
            body: Body(questionId: questionId, answer: answer)
        )
        return response.data
    }

    func compile(sessionId: String) async throws -> AxiomSession {
        let response: APIResponse<AxiomSession> = try await api.post(
            "/api/thinktank/axiom/sessions/\(sessionId)/compile",
            body: [String: String]()
        )
        return response.data
    }
}

// MARK: - Crucible Service

actor CrucibleService {
    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    func getConfig() async throws -> CrucibleConfig {
        let response: APIResponse<CrucibleConfig> = try await api.get("/api/thinktank/crucible/config")
        return response.data
    }

    func getEvents(conversationId: String, messageId: String) async throws -> [DeliberationEvent] {
        let response: APIResponse<[DeliberationEvent]> = try await api.get(
            "/api/thinktank/crucible/events",
            params: ["conversationId": conversationId, "messageId": messageId]
        )
        return response.data
    }

    func updateMaxQuestions(_ max: Int) async throws -> CrucibleConfig {
        struct Body: Encodable { let maxQuestions: Int }
        let response: APIResponse<CrucibleConfig> = try await api.put(
            "/api/thinktank/crucible/config",
            body: Body(maxQuestions: max)
        )
        return response.data
    }
}

// MARK: - Collaboration Service

actor CollaborationService {
    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    func getGuestRestrictions(conversationId: String) async throws -> [GuestRestriction] {
        let response: APIResponse<[GuestRestriction]> = try await api.get(
            "/api/thinktank/collaboration/restrictions",
            params: ["conversationId": conversationId]
        )
        return response.data
    }
}

// MARK: - Compliance Export Service

actor ComplianceExportService {
    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    func exportConversation(_ conversationId: String, format: ExportFormat) async throws -> Data {
        try await api.get(
            "/api/thinktank/export/\(conversationId)",
            params: ["format": format.rawValue]
        )
    }
}

// MARK: - Domain Mode Service

actor DomainModeService {
    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    func listDomains() async throws -> [DomainMode] {
        let response: APIResponse<[DomainMode]> = try await api.get("/api/thinktank/domains")
        return response.data
    }
}

// MARK: - Derivation History Service

actor DerivationHistoryService {
    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    func getMessageDerivations(messageId: String) async throws -> [DerivationChain] {
        let response: APIResponse<[DerivationChain]> = try await api.get(
            "/api/thinktank/derivation-history/message/\(messageId)"
        )
        return response.data
    }

    func getChain(chainId: String) async throws -> DerivationChain {
        let response: APIResponse<DerivationChain> = try await api.get(
            "/api/thinktank/derivation-history/chains/\(chainId)"
        )
        return response.data
    }

    func getProvenanceReport(conversationId: String) async throws -> ProvenanceReport {
        let response: APIResponse<ProvenanceReport> = try await api.get(
            "/api/thinktank/derivation-history/provenance/\(conversationId)"
        )
        return response.data
    }

    func getConversationDerivations(conversationId: String) async throws -> [DerivationChain] {
        let response: APIResponse<[DerivationChain]> = try await api.get(
            "/api/thinktank/derivation-history/conversation/\(conversationId)"
        )
        return response.data
    }

    func challengeNode(nodeId: String, challenge: String) async throws -> DerivationNode {
        struct Body: Encodable { let challenge: String }
        let response: APIResponse<DerivationNode> = try await api.post(
            "/api/thinktank/derivation-history/nodes/\(nodeId)/challenge",
            body: Body(challenge: challenge)
        )
        return response.data
    }

    func getEvidenceSources(nodeId: String) async throws -> [DerivationNode] {
        let response: APIResponse<[DerivationNode]> = try await api.get(
            "/api/thinktank/derivation-history/nodes/\(nodeId)/evidence"
        )
        return response.data
    }
}

// MARK: - Flash Facts Service

actor FlashFactsService {
    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    func extractFacts(extraction: FlashFactExtraction) async throws -> [FlashFact] {
        let response: APIResponse<[FlashFact]> = try await api.post(
            "/api/thinktank/flash-facts/extract",
            body: extraction
        )
        return response.data
    }

    func listFacts(conversationId: String) async throws -> [FlashFact] {
        let response: APIResponse<[FlashFact]> = try await api.get(
            "/api/thinktank/flash-facts",
            params: ["conversationId": conversationId]
        )
        return response.data
    }

    func getAllFacts(category: FlashFactCategory? = nil) async throws -> [FlashFact] {
        var params: [String: String] = [:]
        if let category { params["category"] = category.rawValue }
        let response: APIResponse<[FlashFact]> = try await api.get(
            "/api/thinktank/flash-facts",
            params: params
        )
        return response.data
    }

    func verifyFact(factId: String) async throws -> FlashFact {
        let response: APIResponse<FlashFact> = try await api.post(
            "/api/thinktank/flash-facts/\(factId)/verify",
            body: [String: String]()
        )
        return response.data
    }

    func confirmFact(factId: String, confirmed: Bool) async throws -> FlashFact {
        struct Body: Encodable { let confirmed: Bool }
        let response: APIResponse<FlashFact> = try await api.post(
            "/api/thinktank/flash-facts/\(factId)/confirm",
            body: Body(confirmed: confirmed)
        )
        return response.data
    }

    func deleteFact(factId: String) async throws {
        try await api.delete("/api/thinktank/flash-facts/\(factId)")
    }

    func createCollection(name: String, description: String? = nil) async throws -> FlashFactCollection {
        struct Body: Encodable { let name: String; let description: String? }
        let response: APIResponse<FlashFactCollection> = try await api.post(
            "/api/thinktank/flash-facts/collections",
            body: Body(name: name, description: description)
        )
        return response.data
    }

    func addToCollection(collectionId: String, factIds: [String]) async throws {
        struct Body: Encodable { let factIds: [String] }
        let _: APIResponse<[String: String]> = try await api.post(
            "/api/thinktank/flash-facts/collections/\(collectionId)/add",
            body: Body(factIds: factIds)
        )
    }

    func searchFacts(query: String) async throws -> [FlashFact] {
        let response: APIResponse<[FlashFact]> = try await api.get(
            "/api/thinktank/flash-facts/search",
            params: ["q": query]
        )
        return response.data
    }
}

// MARK: - Grimoire Service (Spellbook)

actor GrimoireService {
    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    func listSpells(category: SpellCategory? = nil) async throws -> [Spell] {
        var params: [String: String] = [:]
        if let category { params["category"] = category.rawValue }
        let response: APIResponse<[Spell]> = try await api.get(
            "/api/thinktank/grimoire/spells",
            params: params
        )
        return response.data
    }

    func getSpell(spellId: String) async throws -> Spell {
        let response: APIResponse<Spell> = try await api.get(
            "/api/thinktank/grimoire/spells/\(spellId)"
        )
        return response.data
    }

    func createSpell(_ spell: Spell) async throws -> Spell {
        let response: APIResponse<Spell> = try await api.post(
            "/api/thinktank/grimoire/spells",
            body: spell
        )
        return response.data
    }

    func updateSpell(spellId: String, updates: Spell) async throws -> Spell {
        let response: APIResponse<Spell> = try await api.put(
            "/api/thinktank/grimoire/spells/\(spellId)",
            body: updates
        )
        return response.data
    }

    func deleteSpell(spellId: String) async throws {
        try await api.delete("/api/thinktank/grimoire/spells/\(spellId)")
    }

    func executeSpell(execution: SpellExecution) async throws -> SpellResult {
        let response: APIResponse<SpellResult> = try await api.post(
            "/api/thinktank/grimoire/execute",
            body: execution
        )
        return response.data
    }

    func getFeaturedSpells() async throws -> [Spell] {
        let response: APIResponse<[Spell]> = try await api.get("/api/thinktank/grimoire/featured")
        return response.data
    }

    func rateSpell(spellId: String, rating: Double) async throws {
        struct Body: Encodable { let rating: Double }
        let _: APIResponse<[String: String]> = try await api.post(
            "/api/thinktank/grimoire/spells/\(spellId)/rate",
            body: Body(rating: rating)
        )
    }
}

// MARK: - Ideas Service

actor IdeasService {
    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    func listIdeas(status: IdeaStatus? = nil, category: String? = nil) async throws -> [Idea] {
        var params: [String: String] = [:]
        if let status { params["status"] = status.rawValue }
        if let category { params["category"] = category }
        let response: APIResponse<[Idea]> = try await api.get(
            "/api/thinktank/ideas",
            params: params
        )
        return response.data
    }

    func getIdea(ideaId: String) async throws -> Idea {
        let response: APIResponse<Idea> = try await api.get("/api/thinktank/ideas/\(ideaId)")
        return response.data
    }

    func createIdea(_ idea: Idea) async throws -> Idea {
        let response: APIResponse<Idea> = try await api.post(
            "/api/thinktank/ideas",
            body: idea
        )
        return response.data
    }

    func captureFromMessage(conversationId: String, messageId: String, title: String? = nil) async throws -> Idea {
        struct Body: Encodable { let conversationId: String; let messageId: String; let title: String? }
        let response: APIResponse<Idea> = try await api.post(
            "/api/thinktank/ideas/capture",
            body: Body(conversationId: conversationId, messageId: messageId, title: title)
        )
        return response.data
    }

    func updateIdea(ideaId: String, updates: Idea) async throws -> Idea {
        let response: APIResponse<Idea> = try await api.put(
            "/api/thinktank/ideas/\(ideaId)",
            body: updates
        )
        return response.data
    }

    func deleteIdea(ideaId: String) async throws {
        try await api.delete("/api/thinktank/ideas/\(ideaId)")
    }

    func linkIdeas(ideaId: String, relatedIdeaId: String) async throws {
        struct Body: Encodable { let relatedIdeaId: String }
        let _: APIResponse<[String: String]> = try await api.post(
            "/api/thinktank/ideas/\(ideaId)/link",
            body: Body(relatedIdeaId: relatedIdeaId)
        )
    }

    func listBoards() async throws -> [IdeaBoard] {
        let response: APIResponse<[IdeaBoard]> = try await api.get("/api/thinktank/ideas/boards")
        return response.data
    }

    func createBoard(name: String, description: String? = nil) async throws -> IdeaBoard {
        struct Body: Encodable { let name: String; let description: String? }
        let response: APIResponse<IdeaBoard> = try await api.post(
            "/api/thinktank/ideas/boards",
            body: Body(name: name, description: description)
        )
        return response.data
    }

    func developIdea(ideaId: String, instructions: String? = nil) async throws -> Idea {
        struct Body: Encodable { let instructions: String? }
        let response: APIResponse<Idea> = try await api.post(
            "/api/thinktank/ideas/\(ideaId)/develop",
            body: Body(instructions: instructions)
        )
        return response.data
    }
}

// MARK: - Cartridge Service

actor CartridgeService {
    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    func getActiveCartridges() async throws -> [ActiveCartridge] {
        let response: APIResponse<[ActiveCartridge]> = try await api.get("/api/v1/cartridges/active")
        return response.data
    }

    func toggleCartridge(cartridgeId: String) async throws -> ActiveCartridge {
        let response: APIResponse<ActiveCartridge> = try await api.post(
            "/api/v1/cartridges/\(cartridgeId)/toggle",
            body: [String: String]()
        )
        return response.data
    }
}

// MARK: - Collaboration Service (Full)

actor FullCollaborationService {
    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    func createSession(conversationId: String, name: String, settings: SessionSettings? = nil) async throws -> CollaborationSession {
        struct Body: Encodable { let conversationId: String; let name: String; let settings: SessionSettings? }
        let response: APIResponse<CollaborationSession> = try await api.post(
            "/api/thinktank/enhanced-collaboration/sessions",
            body: Body(conversationId: conversationId, name: name, settings: settings)
        )
        return response.data
    }

    func getSession(sessionId: String) async throws -> CollaborationSession {
        let response: APIResponse<CollaborationSession> = try await api.get(
            "/api/thinktank/enhanced-collaboration/sessions/\(sessionId)"
        )
        return response.data
    }

    func listSessions() async throws -> [CollaborationSession] {
        let response: APIResponse<[CollaborationSession]> = try await api.get(
            "/api/thinktank/enhanced-collaboration/sessions"
        )
        return response.data
    }

    func joinSession(inviteCode: String) async throws -> CollaborationSession {
        struct Body: Encodable { let inviteCode: String }
        let response: APIResponse<CollaborationSession> = try await api.post(
            "/api/thinktank/enhanced-collaboration/join",
            body: Body(inviteCode: inviteCode)
        )
        return response.data
    }

    func leaveSession(sessionId: String) async throws {
        let _: APIResponse<[String: String]> = try await api.post(
            "/api/thinktank/enhanced-collaboration/sessions/\(sessionId)/leave",
            body: [String: String]()
        )
    }

    func createInvite(sessionId: String, maxUses: Int? = nil, expiresInHours: Int? = nil) async throws -> CollaborationInvite {
        struct Body: Encodable { let maxUses: Int?; let expiresInHours: Int? }
        let response: APIResponse<CollaborationInvite> = try await api.post(
            "/api/thinktank/enhanced-collaboration/sessions/\(sessionId)/invite",
            body: Body(maxUses: maxUses, expiresInHours: expiresInHours)
        )
        return response.data
    }

    func endSession(sessionId: String) async throws {
        let _: APIResponse<[String: String]> = try await api.post(
            "/api/thinktank/enhanced-collaboration/sessions/\(sessionId)/end",
            body: [String: String]()
        )
    }
}

// MARK: - Delight Preferences Service

actor DelightPreferencesService {
    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    struct BackendPreferences: Codable {
        var personality_mode: String
        var intensity: Int?
        var sound_enabled: Bool
        var suppress_idle: Bool
        var suppress_session_start: Bool
    }

    func fetchPreferences() async throws -> BackendPreferences {
        let response: APIResponse<BackendPreferences> = try await api.get("/api/delight/preferences")
        return response.data
    }

    func updatePreferences(_ prefs: BackendPreferences) async throws {
        let _: APIResponse<BackendPreferences> = try await api.put(
            "/api/delight/preferences",
            body: prefs
        )
    }
}
