import Foundation

// MARK: - Message Types

struct ChatMessage: Identifiable, Codable, Sendable {
    let id: String
    let role: MessageRole
    var content: String
    let timestamp: Date
    var modelId: String?
    var metadata: MessageMetadata?

    init(id: String = UUID().uuidString, role: MessageRole, content: String, timestamp: Date = Date(), modelId: String? = nil, metadata: MessageMetadata? = nil) {
        self.id = id
        self.role = role
        self.content = content
        self.timestamp = timestamp
        self.modelId = modelId
        self.metadata = metadata
    }
}

enum MessageRole: String, Codable, Sendable {
    case user
    case assistant
    case system
}

struct MessageMetadata: Codable, Sendable {
    var tokensUsed: Int?
    var latencyMs: Int?
    var orchestrationMode: String?
    var domainDetected: DomainDetection?
    var costEstimate: Double?
    var modelUsed: String?
    var brainPlanId: String?
}

// MARK: - Conversation

struct Conversation: Identifiable, Codable, Sendable {
    let id: String
    var title: String
    let createdAt: Date
    var updatedAt: Date
    var messageCount: Int
    var lastMessage: String?
    var isFavorite: Bool
    var tags: [String]
    var domainMode: String?

    init(id: String = UUID().uuidString, title: String = "New Conversation", createdAt: Date = Date(), updatedAt: Date = Date(), messageCount: Int = 0, lastMessage: String? = nil, isFavorite: Bool = false, tags: [String] = [], domainMode: String? = nil) {
        self.id = id
        self.title = title
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.messageCount = messageCount
        self.lastMessage = lastMessage
        self.isFavorite = isFavorite
        self.tags = tags
        self.domainMode = domainMode
    }
}

// MARK: - Domain Detection

struct DomainDetection: Codable, Sendable {
    let field: String
    let domain: String
    var subspecialty: String?
    let confidence: Double
}

// MARK: - Model

struct AIModel: Identifiable, Codable, Sendable {
    let id: String
    let displayName: String
    var name: String?
    var description: String?
    let provider: String
    let category: String
    var capabilities: [String]
    let costPer1kTokens: Double
    let maxTokens: Int
    var contextLength: Int?
    var avgLatencyMs: Int?
    var isEnabled: Bool
    var isNew: Bool
    var tier: ModelTier?
    var proficiencies: [String: Double]?
}

enum ModelTier: String, Codable, Sendable {
    case free
    case pro
    case enterprise
}

struct ModelCategory: Identifiable, Codable, Sendable {
    let id: String
    let name: String
    let description: String
    var models: [AIModel]
}

// MARK: - User Rules

struct UserRule: Identifiable, Codable, Sendable {
    let id: String
    var ruleText: String
    var ruleSummary: String?
    var ruleType: RuleType
    var priority: Int
    let source: RuleSource
    var presetId: String?
    var isActive: Bool
    var timesApplied: Int
    let createdAt: Date
}

enum RuleType: String, Codable, CaseIterable, Sendable {
    case restriction
    case preference
    case format
    case source
    case tone
    case topic
    case privacy
    case other
}

enum RuleSource: String, Codable, Sendable {
    case userCreated = "user_created"
    case presetAdded = "preset_added"
}

struct PresetRule: Identifiable, Codable, Sendable {
    let id: String
    let ruleText: String
    let ruleSummary: String
    var description: String?
    let ruleType: RuleType
    let category: String
    let isPopular: Bool
}

struct PresetCategory: Codable, Sendable {
    let name: String
    let icon: String
    let description: String
    let rules: [PresetRule]
}

// MARK: - User Settings

struct UserSettings: Codable, Sendable {
    var personalityMode: PersonalityMode
    var features: FeatureSettings
    var notifications: NotificationSettings
    var privacy: PrivacySettings
}

enum PersonalityMode: String, Codable, CaseIterable, Sendable {
    case auto
    case professional
    case subtle
    case expressive
    case playful

    var displayName: String {
        switch self {
        case .auto: return "Auto"
        case .professional: return "Professional"
        case .subtle: return "Subtle"
        case .expressive: return "Expressive"
        case .playful: return "Playful"
        }
    }
}

struct FeatureSettings: Codable, Sendable {
    var voiceInput: Bool
    var collaboration: Bool
    var codeExecution: Bool
    var fileUploads: Bool
    var imageGeneration: Bool
}

struct NotificationSettings: Codable, Sendable {
    var achievements: Bool
    var updates: Bool
    var tips: Bool
}

struct PrivacySettings: Codable, Sendable {
    var shareAnalytics: Bool
    var storeConversations: Bool
}

// MARK: - Brain Plan

struct BrainPlan: Identifiable, Codable, Sendable {
    let id: String
    let prompt: String
    let mode: OrchestrationMode
    let domain: DomainDetection
    var steps: [BrainPlanStep]
    let selectedModel: String
    let modelReason: String
    let estimatedTimeMs: Int
    let estimatedCost: Double
    var status: PlanStatus
    let createdAt: Date
}

enum OrchestrationMode: String, Codable, CaseIterable, Sendable {
    case thinking
    case extendedThinking = "extended_thinking"
    case coding
    case creative
    case research
    case analysis
    case multiModel = "multi_model"
    case chainOfThought = "chain_of_thought"
    case selfConsistency = "self_consistency"

    var displayName: String {
        switch self {
        case .thinking: return "Thinking"
        case .extendedThinking: return "Extended Thinking"
        case .coding: return "Coding"
        case .creative: return "Creative"
        case .research: return "Research"
        case .analysis: return "Analysis"
        case .multiModel: return "Multi-Model"
        case .chainOfThought: return "Chain of Thought"
        case .selfConsistency: return "Self-Consistency"
        }
    }
}

struct BrainPlanStep: Identifiable, Codable, Sendable {
    let id: String
    let type: StepType
    let description: String
    var status: PlanStatus
    var startedAt: Date?
    var completedAt: Date?
    var result: String?
}

enum StepType: String, Codable, Sendable {
    case analyze
    case detectDomain = "detect_domain"
    case selectModel = "select_model"
    case prepareContext = "prepare_context"
    case ethicsCheck = "ethics_check"
    case generate
    case synthesize
    case verify
    case refine
    case calibrate
    case reflect
}

enum PlanStatus: String, Codable, Sendable {
    case pending
    case running
    case executing
    case completed
    case failed
}

// MARK: - Governor

struct GovernorStatus: Codable, Sendable {
    let mode: GovernorMode
    let totalSavings: Double
    let decisionsToday: Int
    var lastDecision: GovernorDecision?
}

enum GovernorMode: String, Codable, CaseIterable, Sendable {
    case economy
    case balanced
    case performance
    case quality
    case custom

    var displayName: String {
        switch self {
        case .economy: return "Economy"
        case .balanced: return "Balanced"
        case .performance: return "Performance"
        case .quality: return "Quality"
        case .custom: return "Custom"
        }
    }

    var systemImage: String {
        switch self {
        case .economy: return "leaf"
        case .balanced: return "scale.3d"
        case .performance: return "bolt"
        case .quality: return "star"
        case .custom: return "slider.horizontal.3"
        }
    }

    var color: String {
        switch self {
        case .economy: return "green"
        case .balanced: return "blue"
        case .performance: return "orange"
        case .quality: return "purple"
        case .custom: return "gray"
        }
    }
}

struct GovernorDecision: Identifiable, Codable, Sendable {
    let id: String
    let timestamp: String
    let model: String
    let tier: String
    let cost: Double
    let tokens: Int
    let reason: String
    let taskType: String
}

// MARK: - Analytics

struct UserAnalytics: Codable, Sendable {
    let totalConversations: Int
    let totalMessages: Int
    let totalTokens: Int
    let totalCost: Double
    let favoriteModels: [ModelUsage]
    let topDomains: [DomainUsage]
    let activityByDay: [DayActivity]
    let achievementsUnlocked: Int
}

struct ModelUsage: Codable, Sendable {
    let model: String
    let count: Int
}

struct DomainUsage: Codable, Sendable {
    let domain: String
    let count: Int
}

struct DayActivity: Codable, Sendable {
    let date: String
    let messages: Int
}

// MARK: - Achievements

struct Achievement: Identifiable, Codable, Sendable {
    let id: String
    let name: String
    let description: String
    let icon: String
    let rarity: AchievementRarity
    let points: Int
    var unlockedAt: Date?
    var progress: Double?
    var threshold: Double?
}

enum AchievementRarity: String, Codable, Sendable {
    case common
    case uncommon
    case rare
    case epic
    case legendary
}

// MARK: - Artifacts

struct Artifact: Identifiable, Codable, Sendable {
    let id: String
    let conversationId: String
    let type: ArtifactType
    let title: String
    var content: String
    var language: String?
    let createdAt: Date
    var metadata: [String: String]?
}

enum ArtifactType: String, Codable, Sendable {
    case code
    case document
    case image
    case chart
}

// MARK: - Domain Mode

struct DomainMode: Identifiable, Codable, Sendable {
    let id: String
    let name: String
    let description: String
    let icon: String
    let color: String
    var isEnabled: Bool
    var defaultModel: String?
    var temperature: Double?
}

// MARK: - Streaming

enum StreamChunk: Sendable {
    case content(String)
    case metadata(MessageMetadata)
    case planUpdate(BrainPlan)
    case done
    case error(String)
}

// MARK: - API Response

struct APIResponse<T: Codable>: Codable {
    let data: T
    var meta: PaginationMeta?
}

struct PaginationMeta: Codable, Sendable {
    var page: Int?
    var pageSize: Int?
    var total: Int?
    var hasMore: Bool?
}

struct APIError: Error, Codable, Sendable {
    let code: String
    let message: String
    var details: [String: String]?
}

// MARK: - Time Machine

struct Snapshot: Identifiable, Codable, Sendable {
    let id: String
    let timestamp: Date
    var label: String?
    var isBookmarked: Bool
    var isBranch: Bool
    var branchName: String?
    var preview: String?
}

// MARK: - Crucible

struct DeliberationEvent: Identifiable, Codable, Sendable {
    var id: String { questionId }
    let questionId: String
    let questionNumber: Int
    let questionType: String
    let questionText: String
    var qualityScore: String?
    let askedAt: Date
    let askerModel: String
    let targetModel: String
    var answer: DeliberationAnswer?
}

struct DeliberationAnswer: Codable, Sendable {
    let answerId: String
    let answerText: String
    let circularCitationDetected: Bool
    let answeredAt: Date
}

struct CrucibleConfig: Codable, Sendable {
    let maxQuestions: Int
    let costMode: String
    let enabled: Bool
    let visible: Bool
    let source: String
    let canOverride: Bool
}

// MARK: - AXIOM / CLARION

struct AxiomSession: Codable, Sendable {
    let sessionId: String
    var status: AxiomStatus
    var workflow: AxiomWorkflow
    var domain: AxiomDomain?
    var currentQuestion: ClarionQuestion?
    var answeredCount: Int
    var modelScores: [ModelScore]
    var compiledPrompt: CompiledPrompt?
}

enum AxiomStatus: String, Codable, Sendable {
    case initializing
    case active
    case readyToCompile = "ready_to_compile"
    case compiling
    case completed
    case failed
}

struct AxiomWorkflow: Codable, Sendable {
    var currentStep: Int
    var steps: [AxiomStep]
    var overallProgress: Double
}

struct AxiomStep: Identifiable, Codable, Sendable {
    let id: String
    let name: String
    var status: PlanStatus
}

struct AxiomDomain: Codable, Sendable {
    let name: String
    let confidence: Double
}

struct ClarionQuestion: Identifiable, Codable, Sendable {
    let questionId: String
    let text: String
    let type: String
    var options: [String]?
    let importance: String

    var id: String { questionId }
}

struct ModelScore: Identifiable, Codable, Sendable {
    let modelId: String
    let modelName: String
    var score: Double
    var reason: String?

    var id: String { modelId }
}

struct CompiledPrompt: Codable, Sendable {
    let systemPrompt: String
    let userPrompt: String
    let modelId: String
    let modelName: String
    let tokenCount: Int
}

// MARK: - Liquid Interface

enum MorphedViewType: String, Codable, CaseIterable, Sendable {
    case datagrid
    case chart
    case kanban
    case calculator
    case codeEditor = "code_editor"
    case document
    case custom

    var displayName: String {
        switch self {
        case .datagrid: return "Data Grid"
        case .chart: return "Chart"
        case .kanban: return "Kanban Board"
        case .calculator: return "Calculator"
        case .codeEditor: return "Code Editor"
        case .document: return "Document"
        case .custom: return "Custom View"
        }
    }

    var systemImage: String {
        switch self {
        case .datagrid: return "tablecells"
        case .chart: return "chart.bar"
        case .kanban: return "square.3.layers.3d"
        case .calculator: return "function"
        case .codeEditor: return "chevron.left.forwardslash.chevron.right"
        case .document: return "doc.text"
        case .custom: return "sparkles"
        }
    }
}

struct LiquidIntent: Codable, Sendable {
    let category: String
    let confidence: Double
    let suggestedView: MorphedViewType
}

// MARK: - Collaboration

struct GuestRestriction: Identifiable, Codable, Sendable {
    var id: String { feature }
    let feature: String
    let message: String
}

// MARK: - Export Formats

enum ExportFormat: String, CaseIterable, Sendable {
    case decisionRecord = "decision_record"
    case hipaaAudit = "hipaa_audit"
    case soc2Evidence = "soc2_evidence"
    case gdprDsar = "gdpr_dsar"
    case pdf

    var displayName: String {
        switch self {
        case .decisionRecord: return "Decision Record"
        case .hipaaAudit: return "HIPAA Audit Package"
        case .soc2Evidence: return "SOC2 Evidence"
        case .gdprDsar: return "GDPR DSAR"
        case .pdf: return "PDF"
        }
    }

    var systemImage: String {
        switch self {
        case .decisionRecord: return "checkmark.seal"
        case .hipaaAudit: return "shield.checkered"
        case .soc2Evidence: return "lock.shield"
        case .gdprDsar: return "person.badge.shield.checkmark"
        case .pdf: return "doc.text"
        }
    }
}

// MARK: - Governor Dashboard (Full)

struct GovernorDashboard: Codable, Sendable {
    let config: GovernorConfig
    let metrics: CostMetrics
    let fuelGauge: FuelGauge
    let modeIndicator: ModeIndicator
    let savingsSparkline: SavingsSparkline
    let alertTriggered: Bool
}

struct GovernorConfig: Codable, Sendable {
    var mode: GovernorMode
    var budgetLimit: Double
    var budgetUsed: Double
    var budgetResetAt: String
    var costAlertThreshold: Double
    var modelTiers: [GovernorModelTier]
    var arbitrageRules: [ArbitrageRule]
}

struct CostMetrics: Codable, Sendable {
    let totalCost: Double
    let totalTokens: Int
    let costByTier: [String: Double]
    let costByModel: [String: Double]
    let tokensByModel: [String: Int]
    let savings: SavingsBreakdown
}

struct FuelGauge: Codable, Sendable {
    let level: Double
    let color: String
    let status: String
    let remaining: String
    let total: String
    let resetIn: String
}

struct ModeIndicator: Codable, Sendable {
    let mode: GovernorMode
    let icon: String
    let description: String
    let color: String
}

struct SavingsSparkline: Codable, Sendable {
    let total: String
    let percent: String
    let breakdown: SavingsSparklineBreakdown
}

struct SavingsSparklineBreakdown: Codable, Sendable {
    let selfHosted: String
    let arbitrage: String
    let cache: String
}

struct SavingsBreakdown: Codable, Sendable {
    let totalSavings: Double
    let savingsPercent: Double
    let selfHostedSavings: Double
    let arbitrageSavings: Double
    let cacheHitSavings: Double
}

struct GovernorModelTier: Identifiable, Codable, Sendable {
    var id: String { name }
    let name: String
    let models: [String]
    let costPerToken: Double
    let qualityScore: Double
    let avgLatencyMs: Int
    let priority: Int
    var label: String?
    var icon: String?
    var color: String?
}

struct ArbitrageRule: Identifiable, Codable, Sendable {
    let id: String
    let name: String
    let condition: RuleCondition
    let action: RuleAction
    var enabled: Bool
}

struct RuleCondition: Codable, Sendable {
    let type: String
    let value: String
    let conditionOperator: String

    enum CodingKeys: String, CodingKey {
        case type, value
        case conditionOperator = "operator"
    }
}

struct RuleAction: Codable, Sendable {
    let type: String
    var targetTier: String?
}

struct ModelRecommendation: Codable, Sendable {
    let model: String
    let tier: String
    let estimatedCost: Double
    let qualityScore: Double
    let estimatedLatency: Int
    let reason: String
    let alternatives: [ModelAlternative]
    var tierIcon: String?
    var tierColor: String?
}

struct ModelAlternative: Codable, Sendable {
    let model: String
    let tier: String
    let estimatedCost: Double
}

struct BudgetStatus: Codable, Sendable {
    let withinBudget: Bool
    let remaining: Double
    let fuelLevel: Double
    let alertTriggered: Bool
    var limit: Double?
    var used: Double?
    var usedPercent: Double?
    var resetAt: String?
}

struct SavingsHistoryEntry: Codable, Sendable {
    let date: String
    let savings: Double
}

// MARK: - Derivation History

struct DerivationNode: Identifiable, Codable, Sendable {
    let id: String
    let type: DerivationNodeType
    let content: String
    let confidence: Double
    var sourceMessageId: String?
    let parentIds: [String]
    let childIds: [String]
    var metadata: [String: String]?
    let createdAt: String
}

enum DerivationNodeType: String, Codable, Sendable {
    case claim
    case evidence
    case inference
    case source
    case toolCall = "tool_call"
}

struct DerivationChain: Identifiable, Codable, Hashable, Sendable {
    let id: String
    let messageId: String
    let nodes: [DerivationNode]
    let rootNodeId: String
    let depth: Int
    let confidence: Double
    let createdAt: String

    static func == (lhs: DerivationChain, rhs: DerivationChain) -> Bool {
        lhs.id == rhs.id
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}

struct ProvenanceReport: Codable, Sendable {
    let conversationId: String
    let totalNodes: Int
    let totalChains: Int
    let avgConfidence: Double
    let nodesByType: [String: Int]
    let generatedAt: String
}

// MARK: - Flash Facts

struct FlashFact: Identifiable, Codable, Sendable {
    let id: String
    let conversationId: String
    let messageId: String
    let fact: String
    let category: FlashFactCategory
    let confidence: Double
    var source: String?
    var verified: Bool
    var verificationMethod: VerificationMethod?
    var tags: [String]
    let createdAt: String
}

enum FlashFactCategory: String, Codable, CaseIterable, Sendable {
    case definition
    case statistic
    case date
    case name
    case process
    case claim
    case other

    var displayName: String {
        rawValue.capitalized
    }

    var systemImage: String {
        switch self {
        case .definition: return "book"
        case .statistic: return "chart.bar"
        case .date: return "calendar"
        case .name: return "person"
        case .process: return "arrow.triangle.branch"
        case .claim: return "quote.bubble"
        case .other: return "ellipsis.circle"
        }
    }
}

enum VerificationMethod: String, Codable, Sendable {
    case aiCheck = "ai_check"
    case userConfirmed = "user_confirmed"
    case citationFound = "citation_found"
}

struct FlashFactExtraction: Codable, Sendable {
    let conversationId: String
    var messageId: String?
    var content: String?
}

struct FlashFactCollection: Identifiable, Codable, Sendable {
    let id: String
    let name: String
    var description: String?
    let factCount: Int
    let isPublic: Bool
    let createdAt: String
}

// MARK: - Grimoire (Spellbook)

struct Spell: Identifiable, Codable, Sendable {
    let id: String
    var name: String
    var description: String
    var category: SpellCategory
    var prompt: String
    var variables: [SpellVariable]
    var icon: String?
    var color: String?
    var isPublic: Bool
    let usageCount: Int
    var rating: Double?
    let createdAt: String
    let updatedAt: String
}

enum SpellCategory: String, Codable, CaseIterable, Sendable {
    case productivity
    case creative
    case analysis
    case code
    case research
    case custom

    var displayName: String {
        rawValue.capitalized
    }

    var systemImage: String {
        switch self {
        case .productivity: return "bolt"
        case .creative: return "paintbrush"
        case .analysis: return "chart.xyaxis.line"
        case .code: return "chevron.left.forwardslash.chevron.right"
        case .research: return "magnifyingglass"
        case .custom: return "wand.and.stars"
        }
    }
}

struct SpellVariable: Identifiable, Codable, Sendable {
    var id: String { name }
    let name: String
    let type: SpellVariableType
    let label: String
    var description: String?
    var defaultValue: String?
    var options: [String]?
    let required: Bool
}

enum SpellVariableType: String, Codable, Sendable {
    case text
    case number
    case select
    case multiselect
}

struct SpellExecution: Codable, Sendable {
    let spellId: String
    let variables: [String: String]
    var conversationId: String?
}

struct SpellResult: Codable, Sendable {
    let executionId: String
    let renderedPrompt: String
    var response: String?
}

// MARK: - Ideas / Brainstorming

struct Idea: Identifiable, Codable, Sendable {
    let id: String
    var title: String
    var description: String
    var category: String
    var status: IdeaStatus
    var priority: IdeaPriority
    var sourceConversationId: String?
    var sourceMessageId: String?
    var tags: [String]
    var attachments: [IdeaAttachment]
    var relatedIdeas: [String]
    let createdAt: String
    let updatedAt: String
}

enum IdeaStatus: String, Codable, CaseIterable, Sendable {
    case captured
    case developing
    case ready
    case implemented
    case archived

    var displayName: String {
        rawValue.capitalized
    }

    var systemImage: String {
        switch self {
        case .captured: return "lightbulb"
        case .developing: return "hammer"
        case .ready: return "checkmark.circle"
        case .implemented: return "checkmark.seal"
        case .archived: return "archivebox"
        }
    }
}

enum IdeaPriority: String, Codable, CaseIterable, Sendable {
    case low
    case medium
    case high

    var displayName: String {
        rawValue.capitalized
    }

    var color: String {
        switch self {
        case .low: return "green"
        case .medium: return "orange"
        case .high: return "red"
        }
    }
}

struct IdeaAttachment: Identifiable, Codable, Sendable {
    let id: String
    let type: IdeaAttachmentType
    let title: String
    let content: String
    var url: String?
}

enum IdeaAttachmentType: String, Codable, Sendable {
    case link
    case note
    case artifact
    case image
}

struct IdeaBoard: Identifiable, Codable, Sendable {
    let id: String
    let name: String
    var description: String?
    let ideaCount: Int
    var columns: [IdeaBoardColumn]
    let createdAt: String
}

struct IdeaBoardColumn: Identifiable, Codable, Sendable {
    let id: String
    let name: String
    var ideaIds: [String]
    var color: String?
}

// MARK: - Cartridges (.RADz Knowledge Bundles)

struct ActiveCartridge: Identifiable, Codable, Sendable {
    let id: String
    let name: String
    let version: String
    let scope: CartridgeScope
    var domainId: String?
    let priority: Int
    var isActive: Bool
}

enum CartridgeScope: String, Codable, Sendable {
    case system
    case tenant
    case user

    var displayName: String {
        switch self {
        case .system: return "System"
        case .tenant: return "Organization"
        case .user: return "Personal"
        }
    }

    var systemImage: String {
        switch self {
        case .system: return "globe"
        case .tenant: return "building.2"
        case .user: return "person"
        }
    }

    var color: String {
        switch self {
        case .system: return "blue"
        case .tenant: return "purple"
        case .user: return "green"
        }
    }
}

// MARK: - Cato Mood (AI Personality)

enum CatoMood: String, Codable, CaseIterable, Sendable {
    case balanced
    case scout
    case sage
    case spark
    case guide

    var displayName: String {
        rawValue.capitalized
    }

    var description: String {
        switch self {
        case .balanced: return "Neutral and adaptive personality"
        case .scout: return "Curious and exploratory"
        case .sage: return "Thoughtful and analytical"
        case .spark: return "Creative and energetic"
        case .guide: return "Supportive and encouraging"
        }
    }

    var systemImage: String {
        switch self {
        case .balanced: return "face.smiling"
        case .scout: return "safari"
        case .sage: return "book"
        case .spark: return "sparkles"
        case .guide: return "heart"
        }
    }

    var color: String {
        switch self {
        case .balanced: return "blue"
        case .scout: return "green"
        case .sage: return "purple"
        case .spark: return "orange"
        case .guide: return "pink"
        }
    }
}

// MARK: - AXIOM / CLARION Extended Types

enum ClarificationMode: String, Codable, CaseIterable, Sendable {
    case always
    case auto
    case never

    var displayName: String {
        rawValue.capitalized
    }
}

struct ClarionPreferences: Codable, Sendable {
    var clarificationMode: ClarificationMode
    var maxQuestions: Int
    var showModelScores: Bool
    var showConfidenceMeter: Bool
    var showDomainDetails: Bool
    var animationsEnabled: Bool
    var soundEnabled: Bool
    var rememberAnswers: Bool
    var learnPreferences: Bool
    var autoSkipKnownAnswers: Bool

    static let `default` = ClarionPreferences(
        clarificationMode: .auto,
        maxQuestions: 5,
        showModelScores: true,
        showConfidenceMeter: true,
        showDomainDetails: true,
        animationsEnabled: true,
        soundEnabled: false,
        rememberAnswers: true,
        learnPreferences: true,
        autoSkipKnownAnswers: false
    )
}

enum AxiomWorkflowStep: String, Codable, CaseIterable, Sendable {
    case classify
    case clarify
    case compile
    case route

    var displayName: String {
        rawValue.capitalized
    }

    var systemImage: String {
        switch self {
        case .classify: return "tag"
        case .clarify: return "questionmark.circle"
        case .compile: return "doc.text"
        case .route: return "arrow.triangle.branch"
        }
    }
}

enum AxiomStepStatus: String, Codable, Sendable {
    case pending
    case active
    case completed
}

struct AxiomWorkflowProgress: Codable, Sendable {
    var currentStep: AxiomWorkflowStep
    var steps: [AxiomWorkflowStepInfo]
    var overallProgress: Double
}

struct AxiomWorkflowStepInfo: Identifiable, Codable, Sendable {
    var id: String { step.rawValue }
    let step: AxiomWorkflowStep
    let label: String
    var status: AxiomStepStatus
}

struct AxiomDomainFull: Codable, Sendable {
    let domainId: String
    let path: [String]
    let name: String
    let displayName: String
    let confidence: Double
    var relatedDomains: [String]?
    var icon: String?
}

struct ClarionQuestionFull: Identifiable, Codable, Sendable {
    let questionId: String
    let type: QuestionType
    let text: String
    var hint: String?
    var options: [String]?
    var optionDescriptions: [String]?
    let category: String
    let priority: Int
    var minLength: Int?
    var maxLength: Int?
    var scaleMin: Int?
    var scaleMax: Int?
    var scaleLabels: ScaleLabels?

    var id: String { questionId }
}

enum QuestionType: String, Codable, Sendable {
    case choice
    case multiSelect = "multi_select"
    case text
    case scale
    case boolean
}

struct ScaleLabels: Codable, Sendable {
    let low: String
    let high: String
}

struct ModelScoreFull: Identifiable, Codable, Sendable {
    let modelId: String
    let modelName: String
    let provider: String
    var score: Double
    var previousScore: Double?
    var isLeading: Bool
    var reasons: [String]
    var capabilities: [String]?
    var costPerToken: Double?

    var id: String { modelId }
}

struct AxiomFeedbackData: Codable, Sendable {
    let feedbackType: String
    let targetType: String
    let targetId: String
    let value: [String: String]
}

struct AxiomChemistryMoment: Codable, Sendable {
    let type: String
    let message: String
    let icon: String
    var modelId: String?
    var scoreDelta: Double?
}

// MARK: - Collaboration (Full)

struct CollaborationSession: Identifiable, Codable, Sendable {
    let id: String
    let conversationId: String
    let name: String
    let status: CollaborationSessionStatus
    let participants: [Participant]
    let settings: SessionSettings
    let createdAt: String
    let updatedAt: String
}

enum CollaborationSessionStatus: String, Codable, Sendable {
    case active
    case paused
    case ended
}

struct Participant: Identifiable, Codable, Sendable {
    let userId: String
    let displayName: String
    var avatar: String?
    let role: ParticipantRole
    var isOnline: Bool
    var cursor: CursorPosition?
    let joinedAt: String

    var id: String { userId }
}

enum ParticipantRole: String, Codable, Sendable {
    case owner
    case editor
    case viewer
}

struct CursorPosition: Codable, Sendable {
    var messageId: String?
    var position: Int?
    var selectionStart: Int?
    var selectionEnd: Int?
}

struct SessionSettings: Codable, Sendable {
    var allowAnonymous: Bool
    var requireApproval: Bool
    var maxParticipants: Int
    var allowVoice: Bool
    var allowVideo: Bool
}

struct CollaborationInvite: Identifiable, Codable, Sendable {
    let id: String
    let sessionId: String
    let inviteCode: String
    let expiresAt: String
    var maxUses: Int?
    let usedCount: Int
}

struct CollaborationMessage: Identifiable, Codable, Sendable {
    let id: String
    let sessionId: String
    let userId: String
    let type: CollaborationMessageType
    let content: String
    let timestamp: String
}

enum CollaborationMessageType: String, Codable, Sendable {
    case chat
    case system
    case reaction
}

// MARK: - Decision Artifact

struct DecisionArtifactSummary: Identifiable, Codable, Sendable {
    let id: String
    let conversationId: String
    let title: String
    let status: String
    let validationStatus: String
    let version: Int
    let phiDetected: Bool
    let piiDetected: Bool
    var primaryDomain: String?
    let createdAt: String
    let updatedAt: String
}

// MARK: - i18n / Localization

enum SupportedLocale: String, Codable, CaseIterable, Sendable {
    case en
    case es
    case fr
    case de
    case ja
    case zh
    case ko
    case pt
    case it
    case ar

    var displayName: String {
        switch self {
        case .en: return "English"
        case .es: return "Español"
        case .fr: return "Français"
        case .de: return "Deutsch"
        case .ja: return "日本語"
        case .zh: return "中文"
        case .ko: return "한국어"
        case .pt: return "Português"
        case .it: return "Italiano"
        case .ar: return "العربية"
        }
    }

    var flag: String {
        switch self {
        case .en: return "🇺🇸"
        case .es: return "🇪🇸"
        case .fr: return "🇫🇷"
        case .de: return "🇩🇪"
        case .ja: return "🇯🇵"
        case .zh: return "🇨🇳"
        case .ko: return "🇰🇷"
        case .pt: return "🇧🇷"
        case .it: return "🇮🇹"
        case .ar: return "🇸🇦"
        }
    }
}
