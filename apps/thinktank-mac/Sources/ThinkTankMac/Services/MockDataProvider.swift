import Foundation

// MARK: - Mock Data Provider
// Returns realistic mock data for every API endpoint when running in Dev Mode (no server).
// This allows exploring every view and pane of the app without a backend.

enum MockDataProvider {

    // MARK: - Route Resolver

    static func resolve(path: String, method: String) -> Data? {
        // Normalize path: strip query params
        let cleanPath = path.components(separatedBy: "?").first ?? path

        switch (method, cleanPath) {
        // Models & Domains
        case ("GET", let p) where p.hasSuffix("/models"):
            return encode(APIResponse(data: models, meta: nil))
        case ("GET", let p) where p.hasSuffix("/models/categories"):
            return encode(APIResponse(data: modelCategories, meta: nil))
        case ("GET", let p) where p.hasSuffix("/domains"):
            return encode(APIResponse(data: domains, meta: nil))
        case (_, let p) where p.contains("/domain/detect"):
            return encode(APIResponse(data: domainDetection, meta: nil))

        // Conversations
        case ("GET", let p) where p.hasSuffix("/conversations") && !p.contains("/messages"):
            return encode(APIResponse(data: conversations, meta: nil))
        case ("GET", let p) where p.contains("/conversations/") && !p.contains("/messages") && !p.contains("/snapshots") && !p.contains("/restore") && !p.contains("/branch"):
            return encode(APIResponse(data: conversations[0], meta: nil))
        case ("POST", let p) where p.hasSuffix("/conversations"):
            return encode(APIResponse(data: newConversation, meta: nil))
        case ("GET", let p) where p.contains("/messages"):
            return encode(APIResponse(data: chatMessages, meta: nil))
        case ("POST", let p) where p.contains("/messages"):
            return encode(APIResponse(data: assistantResponse, meta: nil))
        case ("GET", let p) where p.contains("/search"):
            return encode(APIResponse(data: conversations, meta: nil))

        // Rules
        case ("GET", let p) where p.hasSuffix("/rules"):
            return encode(APIResponse(data: userRules, meta: nil))
        case ("POST", let p) where p.hasSuffix("/rules"):
            return encode(APIResponse(data: userRules[0], meta: nil))
        case ("GET", let p) where p.hasSuffix("/rules/presets"):
            return encode(APIResponse(data: presetCategories, meta: nil))
        case ("POST", let p) where p.contains("/rules/presets/add"):
            return encode(APIResponse(data: userRules[0], meta: nil))
        case (_, let p) where p.contains("/rules/"):
            return encode(APIResponse(data: userRules[0], meta: nil))

        // Settings
        case ("GET", let p) where p.hasSuffix("/settings"):
            return encode(APIResponse(data: userSettings, meta: nil))
        case ("PUT", let p) where p.hasSuffix("/settings"):
            return encode(APIResponse(data: userSettings, meta: nil))

        // Analytics & Achievements
        case ("GET", let p) where p.hasSuffix("/analytics"):
            return encode(APIResponse(data: analytics, meta: nil))
        case ("GET", let p) where p.hasSuffix("/achievements"):
            return encode(APIResponse(data: achievements, meta: nil))

        // Artifacts
        case ("GET", let p) where p.hasSuffix("/artifacts"):
            return encode(APIResponse(data: artifacts, meta: nil))
        case ("GET", let p) where p.contains("/artifacts/"):
            return encode(APIResponse(data: artifacts[0], meta: nil))

        // Governor
        case ("GET", let p) where p.hasSuffix("/governor") || p.hasSuffix("/governor/"):
            return encode(APIResponse(data: governorDashboard, meta: nil))
        case ("GET", let p) where p.hasSuffix("/governor/status"):
            return encode(APIResponse(data: governorStatus, meta: nil))
        case ("GET", let p) where p.hasSuffix("/governor/config"):
            return encode(APIResponse(data: governorDashboard.config, meta: nil))
        case ("GET", let p) where p.hasSuffix("/governor/decisions"):
            return encode(APIResponse(data: GovernorDecisionsWrap(decisions: governorDecisions), meta: nil))
        case ("GET", let p) where p.hasSuffix("/governor/savings-history"):
            return encode(APIResponse(data: SavingsHistoryWrap(history: savingsHistory), meta: nil))
        case ("GET", let p) where p.hasSuffix("/governor/metrics"):
            return encode(APIResponse(data: governorDashboard.metrics, meta: nil))
        case ("GET", let p) where p.hasSuffix("/governor/budget"):
            return encode(APIResponse(data: budgetStatus, meta: nil))
        case ("GET", let p) where p.hasSuffix("/governor/tiers"):
            return encode(APIResponse(data: governorDashboard.config.modelTiers, meta: nil))
        case ("GET", let p) where p.hasSuffix("/governor/rules"):
            return encode(APIResponse(data: governorDashboard.config.arbitrageRules, meta: nil))
        case ("PUT", let p) where p.contains("/governor/mode"):
            return encode(APIResponse(data: GovernorModeResponse(mode: .balanced, message: "Mode updated"), meta: nil))
        case (_, let p) where p.contains("/governor/recommend"):
            return encode(APIResponse(data: modelRecommendation, meta: nil))
        case ("PUT", let p) where p.contains("/governor"):
            return encode(APIResponse(data: governorDashboard.config, meta: nil))

        // Brain Plan
        case ("GET", let p) where p.contains("/brain-plan"):
            return encode(APIResponse(data: brainPlan, meta: nil))

        // Time Machine / Snapshots
        case ("GET", let p) where p.contains("/snapshots"):
            return encode(snapshots)

        // Grimoire
        case ("GET", let p) where p.hasSuffix("/grimoire/featured"):
            return encode(APIResponse(data: spells, meta: nil))
        case ("GET", let p) where p.hasSuffix("/grimoire/spells"):
            return encode(APIResponse(data: spells, meta: nil))
        case ("GET", let p) where p.contains("/grimoire/spells/"):
            return encode(APIResponse(data: spells[0], meta: nil))
        case ("POST", let p) where p.contains("/grimoire/execute"):
            return encode(APIResponse(data: SpellResult(executionId: "exec-001", renderedPrompt: "Rendered prompt...", response: "AI response here"), meta: nil))

        // Ideas
        case ("GET", let p) where p.hasSuffix("/ideas") && !p.contains("/boards"):
            return encode(APIResponse(data: ideas, meta: nil))
        case ("GET", let p) where p.hasSuffix("/ideas/boards"):
            return encode(APIResponse(data: ideaBoards, meta: nil))
        case ("POST", let p) where p.hasSuffix("/ideas"):
            return encode(APIResponse(data: ideas[0], meta: nil))
        case (_, let p) where p.contains("/ideas/") && p.contains("/develop"):
            return encode(APIResponse(data: ideas[1], meta: nil))

        // Flash Facts
        case ("GET", let p) where p.contains("/flash-facts") && !p.contains("/collections"):
            return encode(APIResponse(data: flashFacts, meta: nil))
        case ("POST", let p) where p.contains("/flash-facts/extract"):
            return encode(APIResponse(data: flashFacts, meta: nil))

        // Crucible
        case ("GET", let p) where p.hasSuffix("/crucible/config"):
            return encode(APIResponse(data: crucibleConfig, meta: nil))
        case ("GET", let p) where p.contains("/crucible/events"):
            return encode(APIResponse(data: deliberationEvents, meta: nil))

        // Cartridges
        case ("GET", let p) where p.contains("/cartridges/active"):
            return encode(APIResponse(data: cartridges, meta: nil))

        // AXIOM
        case ("POST", let p) where p.contains("/axiom/sessions") && !p.contains("/answer") && !p.contains("/compile"):
            return encode(APIResponse(data: axiomSession, meta: nil))
        case ("POST", let p) where p.contains("/axiom/") && p.contains("/answer"):
            return encode(APIResponse(data: axiomSession, meta: nil))
        case ("POST", let p) where p.contains("/axiom/") && p.contains("/compile"):
            return encode(APIResponse(data: axiomSessionCompiled, meta: nil))

        // Derivation History
        case ("GET", let p) where p.contains("/derivation-history"):
            return encode(APIResponse(data: derivationChains, meta: nil))

        // Delight
        case ("GET", let p) where p.contains("/delight/preferences"):
            return encode(APIResponse(data: delightPrefs, meta: nil))
        case ("PUT", let p) where p.contains("/delight/preferences"):
            return encode(APIResponse(data: delightPrefs, meta: nil))

        // Collaboration
        case ("GET", let p) where p.contains("/collaboration"):
            return encode(APIResponse(data: [GuestRestriction](), meta: nil))

        default:
            return encode(APIResponse(data: [String: String](), meta: nil))
        }
    }

    private static func encode<T: Encodable>(_ value: T) -> Data? {
        try? JSONEncoder.radiant.encode(value)
    }

    // MARK: - Helper Wrappers (for nested response structures)

    private struct GovernorDecisionsWrap: Codable { let decisions: [GovernorDecision] }
    private struct SavingsHistoryWrap: Codable { let history: [SavingsHistoryEntry] }
    private struct GovernorModeResponse: Codable { let mode: GovernorMode; let message: String }

    // MARK: - AI Models

    static let models: [AIModel] = [
        AIModel(id: "gpt-4o", displayName: "GPT-4o", name: "gpt-4o", description: "OpenAI's most capable multimodal model", provider: "OpenAI", category: "flagship", capabilities: ["text", "vision", "code", "analysis"], costPer1kTokens: 0.005, maxTokens: 128000, contextLength: 128000, avgLatencyMs: 850, isEnabled: true, isNew: false, tier: .pro, proficiencies: ["coding": 0.95, "analysis": 0.92, "creative": 0.88]),
        AIModel(id: "claude-4-opus", displayName: "Claude 4 Opus", name: "claude-4-opus", description: "Anthropic's most intelligent model for complex tasks", provider: "Anthropic", category: "flagship", capabilities: ["text", "vision", "code", "analysis", "research"], costPer1kTokens: 0.015, maxTokens: 200000, contextLength: 200000, avgLatencyMs: 1200, isEnabled: true, isNew: true, tier: .enterprise, proficiencies: ["coding": 0.97, "analysis": 0.96, "creative": 0.91]),
        AIModel(id: "claude-4-sonnet", displayName: "Claude 4 Sonnet", name: "claude-4-sonnet", description: "Best balance of intelligence and speed", provider: "Anthropic", category: "balanced", capabilities: ["text", "vision", "code", "analysis"], costPer1kTokens: 0.003, maxTokens: 200000, contextLength: 200000, avgLatencyMs: 600, isEnabled: true, isNew: true, tier: .pro, proficiencies: ["coding": 0.93, "analysis": 0.90, "creative": 0.87]),
        AIModel(id: "gemini-2-ultra", displayName: "Gemini 2 Ultra", name: "gemini-2-ultra", description: "Google's most capable model with 2M context", provider: "Google", category: "flagship", capabilities: ["text", "vision", "code", "analysis", "video"], costPer1kTokens: 0.007, maxTokens: 2000000, contextLength: 2000000, avgLatencyMs: 950, isEnabled: true, isNew: true, tier: .enterprise, proficiencies: ["coding": 0.91, "analysis": 0.94, "creative": 0.86]),
        AIModel(id: "llama-3.3-70b", displayName: "Llama 3.3 70B", name: "llama-3.3-70b", description: "Self-hosted open-source model, zero external cost", provider: "RADIANT Self-Hosted", category: "self-hosted", capabilities: ["text", "code"], costPer1kTokens: 0.0, maxTokens: 128000, contextLength: 128000, avgLatencyMs: 350, isEnabled: true, isNew: false, tier: .free, proficiencies: ["coding": 0.82, "analysis": 0.78, "creative": 0.75]),
        AIModel(id: "mixtral-8x22b", displayName: "Mixtral 8x22B", name: "mixtral-8x22b", description: "High-speed MoE model for rapid iteration", provider: "RADIANT Self-Hosted", category: "self-hosted", capabilities: ["text", "code"], costPer1kTokens: 0.0, maxTokens: 65536, contextLength: 65536, avgLatencyMs: 280, isEnabled: true, isNew: false, tier: .free, proficiencies: ["coding": 0.79, "analysis": 0.74, "creative": 0.72]),
        AIModel(id: "gpt-4o-mini", displayName: "GPT-4o Mini", name: "gpt-4o-mini", description: "Fast and affordable for simple tasks", provider: "OpenAI", category: "economy", capabilities: ["text", "vision"], costPer1kTokens: 0.00015, maxTokens: 128000, contextLength: 128000, avgLatencyMs: 300, isEnabled: true, isNew: false, tier: .free, proficiencies: ["coding": 0.72, "analysis": 0.70, "creative": 0.68]),
        AIModel(id: "deepseek-r1", displayName: "DeepSeek R1", name: "deepseek-r1", description: "Reasoning-focused model with chain-of-thought", provider: "DeepSeek", category: "reasoning", capabilities: ["text", "code", "math"], costPer1kTokens: 0.001, maxTokens: 128000, contextLength: 128000, avgLatencyMs: 1500, isEnabled: true, isNew: true, tier: .pro, proficiencies: ["coding": 0.94, "analysis": 0.93, "creative": 0.65]),
    ]

    static let modelCategories: [ModelCategory] = [
        ModelCategory(id: "flagship", name: "Flagship", description: "Most capable models", models: Array(models.prefix(4))),
        ModelCategory(id: "self-hosted", name: "Self-Hosted", description: "Zero-cost on-premise models", models: Array(models[4...5])),
        ModelCategory(id: "economy", name: "Economy", description: "Fast and affordable", models: [models[6]]),
    ]

    // MARK: - Domains

    static let domains: [DomainMode] = [
        DomainMode(id: "general", name: "General", description: "No domain specialization", icon: "globe", color: "blue", isEnabled: true, defaultModel: "claude-4-sonnet"),
        DomainMode(id: "medicine", name: "Medicine", description: "Clinical reasoning and medical literature", icon: "cross.case", color: "red", isEnabled: true, defaultModel: "claude-4-opus", temperature: 0.3),
        DomainMode(id: "legal", name: "Legal", description: "Case law, contracts, and regulatory analysis", icon: "building.columns", color: "purple", isEnabled: true, defaultModel: "gpt-4o", temperature: 0.2),
        DomainMode(id: "engineering", name: "Engineering", description: "Software, systems, and architecture", icon: "wrench.and.screwdriver", color: "orange", isEnabled: true, defaultModel: "claude-4-opus", temperature: 0.4),
        DomainMode(id: "finance", name: "Finance", description: "Markets, accounting, and financial modeling", icon: "chart.line.uptrend.xyaxis", color: "green", isEnabled: true, defaultModel: "gpt-4o"),
        DomainMode(id: "science", name: "Science", description: "Research methodology and scientific analysis", icon: "atom", color: "cyan", isEnabled: true, defaultModel: "gemini-2-ultra"),
    ]

    static let domainDetection = DomainDetection(field: "engineering", domain: "software", subspecialty: "distributed_systems", confidence: 0.92)

    // MARK: - Conversations

    static let conversations: [Conversation] = [
        Conversation(id: "conv-001", title: "Kubernetes Pod Scheduling Analysis", createdAt: Date().addingTimeInterval(-3600), updatedAt: Date().addingTimeInterval(-600), messageCount: 12, lastMessage: "The HPA should scale based on custom metrics rather than CPU alone...", isFavorite: true, tags: ["engineering", "k8s"], domainMode: "engineering"),
        Conversation(id: "conv-002", title: "HIPAA Compliance Audit Prep", createdAt: Date().addingTimeInterval(-7200), updatedAt: Date().addingTimeInterval(-1800), messageCount: 8, lastMessage: "Section 164.312(a)(1) requires unique user identification...", isFavorite: false, tags: ["compliance", "hipaa"], domainMode: "legal"),
        Conversation(id: "conv-003", title: "React Server Components Deep Dive", createdAt: Date().addingTimeInterval(-14400), updatedAt: Date().addingTimeInterval(-3600), messageCount: 15, lastMessage: "The key insight is that RSCs serialize on the server and hydrate selectively...", isFavorite: true, tags: ["frontend", "react"]),
        Conversation(id: "conv-004", title: "Differential Diagnosis: Persistent Cough", createdAt: Date().addingTimeInterval(-86400), updatedAt: Date().addingTimeInterval(-43200), messageCount: 6, lastMessage: "Given the 3-week duration and nocturnal pattern, consider...", isFavorite: false, tags: ["medicine"], domainMode: "medicine"),
        Conversation(id: "conv-005", title: "Q3 Revenue Forecasting Model", createdAt: Date().addingTimeInterval(-86400), updatedAt: Date().addingTimeInterval(-50000), messageCount: 10, lastMessage: "The Monte Carlo simulation shows a 68% probability of hitting the $4.2M target...", isFavorite: false, tags: ["finance", "forecasting"], domainMode: "finance"),
        Conversation(id: "conv-006", title: "Brainstorming: AI Safety Paper", createdAt: Date().addingTimeInterval(-172800), updatedAt: Date().addingTimeInterval(-90000), messageCount: 20, lastMessage: "The alignment tax framework provides a useful lens for evaluating...", isFavorite: true, tags: ["research", "ai-safety"], domainMode: "science"),
        Conversation(id: "conv-007", title: "PostgreSQL Query Optimization", createdAt: Date().addingTimeInterval(-259200), updatedAt: Date().addingTimeInterval(-200000), messageCount: 9, lastMessage: "Adding a partial index on status WHERE status != 'archived' reduced scan time by 94%...", isFavorite: false, tags: ["database", "performance"]),
        Conversation(id: "conv-008", title: "Contract Review: SaaS Agreement", createdAt: Date().addingTimeInterval(-345600), updatedAt: Date().addingTimeInterval(-300000), messageCount: 5, lastMessage: "Section 7.2 liability cap should be at minimum 12 months of fees...", isFavorite: false, tags: ["legal", "contracts"], domainMode: "legal"),
    ]

    static let newConversation = Conversation(id: UUID().uuidString, title: "New Conversation", createdAt: Date(), updatedAt: Date(), messageCount: 0, lastMessage: nil, isFavorite: false, tags: [])

    // MARK: - Chat Messages

    static let chatMessages: [ChatMessage] = [
        ChatMessage(id: "msg-001", role: .user, content: "Can you explain the difference between horizontal and vertical pod autoscaling in Kubernetes, and when to use each?", timestamp: Date().addingTimeInterval(-3600), modelId: nil),
        ChatMessage(id: "msg-002", role: .assistant, content: """
        Great question! Here's a breakdown of both autoscaling strategies in Kubernetes:

        ## Horizontal Pod Autoscaler (HPA)
        - **What it does**: Adds or removes pod replicas based on observed metrics
        - **Best for**: Stateless workloads that can scale out (web servers, API gateways)
        - **Key metrics**: CPU utilization, memory, custom metrics (requests/sec, queue depth)
        - **Example**: Your API server gets a traffic spike; HPA adds 3 more pods

        ## Vertical Pod Autoscaler (VPA)
        - **What it does**: Adjusts CPU/memory *requests and limits* for existing pods
        - **Best for**: Stateful workloads, databases, or single-instance services
        - **Key metrics**: Historical resource usage patterns
        - **Example**: Your ML training job needs more memory; VPA increases the limit

        ## When to Use Each

        | Scenario | Recommendation |
        |----------|---------------|
        | Web API with variable traffic | **HPA** on requests/sec |
        | Database with growing memory needs | **VPA** with `updateMode: Auto` |
        | Batch processing workers | **HPA** on queue depth |
        | ML inference service | **Both** - HPA for replicas, VPA for right-sizing |

        **Pro tip**: You can use both together with the `ControlledValues: RequestsOnly` setting on VPA to avoid conflicts.
        """, timestamp: Date().addingTimeInterval(-3540), modelId: "claude-4-opus", metadata: MessageMetadata(tokensUsed: 847, latencyMs: 1240, orchestrationMode: "thinking", domainDetected: DomainDetection(field: "engineering", domain: "kubernetes", subspecialty: "autoscaling", confidence: 0.96), costEstimate: 0.0127, modelUsed: "claude-4-opus", brainPlanId: "bp-001")),
        ChatMessage(id: "msg-003", role: .user, content: "What about KEDA? How does it compare to the built-in HPA?", timestamp: Date().addingTimeInterval(-3400)),
        ChatMessage(id: "msg-004", role: .assistant, content: """
        **KEDA (Kubernetes Event-Driven Autoscaler)** extends the HPA with a much richer set of event sources. Here's the comparison:

        ### Built-in HPA
        - Scales on CPU, memory, or custom metrics via Metrics API
        - Requires a metrics adapter for custom sources
        - Minimum 1 replica always running
        - ~15s default check interval

        ### KEDA
        - **60+ built-in scalers**: Kafka lag, RabbitMQ queue depth, Prometheus queries, AWS SQS, Cron schedules, PostgreSQL row count, HTTP requests, and more
        - **Scale to zero**: Can terminate all pods when idle (huge cost savings)
        - **ScaledObject CRD**: Declarative configuration
        - **ScaledJob**: For batch/job workloads that should run to completion

        ```yaml
        apiVersion: keda.sh/v1alpha1
        kind: ScaledObject
        metadata:
          name: order-processor
        spec:
          scaleTargetRef:
            name: order-processor
          minReplicaCount: 0    # Scale to zero!
          maxReplicaCount: 50
          triggers:
          - type: kafka
            metadata:
              topic: orders
              consumerGroup: processor
              lagThreshold: "100"
        ```

        **My recommendation**: Use KEDA whenever you need event-driven scaling or scale-to-zero. It's production-ready and CNCF graduated.
        """, timestamp: Date().addingTimeInterval(-3340), modelId: "claude-4-opus", metadata: MessageMetadata(tokensUsed: 612, latencyMs: 980, orchestrationMode: "coding", domainDetected: DomainDetection(field: "engineering", domain: "kubernetes", subspecialty: "autoscaling", confidence: 0.97), costEstimate: 0.0092, modelUsed: "claude-4-opus", brainPlanId: "bp-002")),
    ]

    static let assistantResponse = ChatMessage(id: UUID().uuidString, role: .assistant, content: "I'd be happy to help with that. Let me think through this carefully...", timestamp: Date(), modelId: "claude-4-sonnet", metadata: MessageMetadata(tokensUsed: 45, latencyMs: 320, orchestrationMode: "thinking", costEstimate: 0.0001, modelUsed: "claude-4-sonnet"))

    // MARK: - User Rules

    static let userRules: [UserRule] = [
        UserRule(id: "rule-001", ruleText: "Always provide code examples in TypeScript unless I specify otherwise", ruleSummary: "Default to TypeScript code", ruleType: .preference, priority: 90, source: .userCreated, isActive: true, timesApplied: 47, createdAt: Date().addingTimeInterval(-604800)),
        UserRule(id: "rule-002", ruleText: "Never use var in JavaScript/TypeScript examples. Always use const or let.", ruleSummary: "No var declarations", ruleType: .restriction, priority: 85, source: .userCreated, isActive: true, timesApplied: 33, createdAt: Date().addingTimeInterval(-518400)),
        UserRule(id: "rule-003", ruleText: "Format responses with clear headers, bullet points, and code blocks. Avoid walls of text.", ruleSummary: "Structured formatting", ruleType: .format, priority: 80, source: .presetAdded, presetId: "preset-format-01", isActive: true, timesApplied: 124, createdAt: Date().addingTimeInterval(-432000)),
        UserRule(id: "rule-004", ruleText: "When discussing medical topics, always include a disclaimer that I should consult a healthcare professional.", ruleSummary: "Medical disclaimer", ruleType: .privacy, priority: 95, source: .userCreated, isActive: true, timesApplied: 8, createdAt: Date().addingTimeInterval(-345600)),
        UserRule(id: "rule-005", ruleText: "Use a professional but approachable tone. Avoid overly casual language but don't be stiff.", ruleSummary: "Professional tone", ruleType: .tone, priority: 70, source: .presetAdded, presetId: "preset-tone-02", isActive: true, timesApplied: 89, createdAt: Date().addingTimeInterval(-259200)),
        UserRule(id: "rule-006", ruleText: "When citing sources, prefer peer-reviewed papers and official documentation over blog posts.", ruleSummary: "Prefer academic sources", ruleType: .source, priority: 60, source: .userCreated, isActive: false, timesApplied: 12, createdAt: Date().addingTimeInterval(-172800)),
    ]

    // MARK: - Preset Categories

    static let presetCategories: [PresetCategory] = [
        PresetCategory(name: "Coding Standards", icon: "chevron.left.forwardslash.chevron.right", description: "Rules for code generation and review", rules: [
            PresetRule(id: "preset-code-01", ruleText: "Follow the Airbnb JavaScript Style Guide for all JS/TS code", ruleSummary: "Airbnb JS style", description: "Enforces consistent code style", ruleType: .preference, category: "coding", isPopular: true),
            PresetRule(id: "preset-code-02", ruleText: "Always include error handling in code examples. Never show happy-path-only code.", ruleSummary: "Include error handling", description: "Production-ready code examples", ruleType: .preference, category: "coding", isPopular: true),
            PresetRule(id: "preset-code-03", ruleText: "Add JSDoc comments to all exported functions and types", ruleSummary: "JSDoc documentation", description: nil, ruleType: .format, category: "coding", isPopular: false),
        ]),
        PresetCategory(name: "Communication Style", icon: "text.bubble", description: "How AI communicates with you", rules: [
            PresetRule(id: "preset-tone-01", ruleText: "Be concise. Get to the point quickly. Avoid unnecessary preamble.", ruleSummary: "Be concise", description: "Eliminates filler text", ruleType: .tone, category: "communication", isPopular: true),
            PresetRule(id: "preset-tone-02", ruleText: "Use a professional but approachable tone", ruleSummary: "Professional tone", description: nil, ruleType: .tone, category: "communication", isPopular: true),
        ]),
        PresetCategory(name: "Privacy & Safety", icon: "shield", description: "Data handling and safety rules", rules: [
            PresetRule(id: "preset-priv-01", ruleText: "Never store or reference personal health information in conversation summaries", ruleSummary: "No PHI in summaries", description: "HIPAA-aligned privacy rule", ruleType: .privacy, category: "privacy", isPopular: false),
            PresetRule(id: "preset-priv-02", ruleText: "Redact any email addresses, phone numbers, or SSNs that appear in pasted content", ruleSummary: "Auto-redact PII", description: "Automatic PII detection", ruleType: .privacy, category: "privacy", isPopular: true),
        ]),
    ]

    // MARK: - User Settings

    static let userSettings = UserSettings(
        personalityMode: .auto,
        features: FeatureSettings(voiceInput: true, collaboration: true, codeExecution: true, fileUploads: true, imageGeneration: true),
        notifications: NotificationSettings(achievements: true, updates: true, tips: true),
        privacy: PrivacySettings(shareAnalytics: true, storeConversations: true)
    )

    // MARK: - Analytics

    static let analytics = UserAnalytics(
        totalConversations: 142,
        totalMessages: 1847,
        totalTokens: 2_340_000,
        totalCost: 47.82,
        favoriteModels: [
            ModelUsage(model: "Claude 4 Opus", count: 523),
            ModelUsage(model: "GPT-4o", count: 412),
            ModelUsage(model: "Llama 3.3 70B", count: 389),
            ModelUsage(model: "Claude 4 Sonnet", count: 298),
            ModelUsage(model: "DeepSeek R1", count: 112),
        ],
        topDomains: [
            DomainUsage(domain: "Engineering", count: 487),
            DomainUsage(domain: "General", count: 342),
            DomainUsage(domain: "Medicine", count: 156),
            DomainUsage(domain: "Legal", count: 134),
            DomainUsage(domain: "Finance", count: 98),
        ],
        activityByDay: (0..<30).map { i in
            let date = Calendar.current.date(byAdding: .day, value: -29 + i, to: Date())!
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd"
            let msgs = [8, 12, 5, 15, 22, 18, 3, 0, 14, 25, 31, 19, 7, 11, 28, 16, 9, 20, 13, 6, 24, 17, 10, 21, 35, 27, 14, 8, 19, 23][i]
            return DayActivity(date: formatter.string(from: date), messages: msgs)
        },
        achievementsUnlocked: 14
    )

    // MARK: - Achievements

    static let achievements: [Achievement] = [
        Achievement(id: "ach-001", name: "First Steps", description: "Send your first message", icon: "figure.walk", rarity: .common, points: 10, unlockedAt: Date().addingTimeInterval(-2592000)),
        Achievement(id: "ach-002", name: "Conversation Starter", description: "Create 10 conversations", icon: "bubble.left.and.bubble.right", rarity: .common, points: 25, unlockedAt: Date().addingTimeInterval(-2000000)),
        Achievement(id: "ach-003", name: "Power User", description: "Send 500 messages", icon: "bolt.fill", rarity: .uncommon, points: 50, unlockedAt: Date().addingTimeInterval(-1500000)),
        Achievement(id: "ach-004", name: "Domain Explorer", description: "Use 5 different domain modes", icon: "map", rarity: .uncommon, points: 75, unlockedAt: Date().addingTimeInterval(-1000000)),
        Achievement(id: "ach-005", name: "Rule Crafter", description: "Create 5 custom rules", icon: "list.bullet.clipboard", rarity: .rare, points: 100, unlockedAt: Date().addingTimeInterval(-500000)),
        Achievement(id: "ach-006", name: "Spellcaster", description: "Execute 25 Grimoire spells", icon: "wand.and.stars", rarity: .rare, points: 100, unlockedAt: nil, progress: 18, threshold: 25),
        Achievement(id: "ach-007", name: "Fact Checker", description: "Verify 50 Flash Facts", icon: "checkmark.seal", rarity: .epic, points: 200, unlockedAt: nil, progress: 32, threshold: 50),
        Achievement(id: "ach-008", name: "Brain Surgeon", description: "Review 100 Brain Plans", icon: "brain", rarity: .epic, points: 250, unlockedAt: nil, progress: 67, threshold: 100),
        Achievement(id: "ach-009", name: "Token Millionaire", description: "Use 1 million tokens", icon: "dollarsign.circle", rarity: .legendary, points: 500, unlockedAt: Date().addingTimeInterval(-200000)),
        Achievement(id: "ach-010", name: "Radiant Master", description: "Unlock all other achievements", icon: "crown", rarity: .legendary, points: 1000, unlockedAt: nil, progress: 14, threshold: 20),
    ]

    // MARK: - Artifacts

    static let artifacts: [Artifact] = [
        Artifact(id: "art-001", conversationId: "conv-001", type: .code, title: "HPA Configuration", content: "apiVersion: autoscaling/v2\nkind: HorizontalPodAutoscaler\nmetadata:\n  name: api-server\nspec:\n  scaleTargetRef:\n    apiVersion: apps/v1\n    kind: Deployment\n    name: api-server\n  minReplicas: 2\n  maxReplicas: 20\n  metrics:\n  - type: Resource\n    resource:\n      name: cpu\n      target:\n        type: Utilization\n        averageUtilization: 70", language: "yaml", createdAt: Date().addingTimeInterval(-3500)),
        Artifact(id: "art-002", conversationId: "conv-003", type: .code, title: "RSC Data Fetching Pattern", content: "// app/dashboard/page.tsx\nimport { Suspense } from 'react';\nimport { fetchMetrics } from '@/lib/data';\n\nexport default async function DashboardPage() {\n  const metrics = await fetchMetrics();\n  return (\n    <Suspense fallback={<MetricsSkeleton />}>\n      <MetricsGrid data={metrics} />\n    </Suspense>\n  );\n}", language: "typescript", createdAt: Date().addingTimeInterval(-14000)),
        Artifact(id: "art-003", conversationId: "conv-005", type: .document, title: "Q3 Revenue Forecast Summary", content: "# Q3 2026 Revenue Forecast\n\n## Key Findings\n- **Base case**: $4.2M (68% confidence)\n- **Bull case**: $5.1M (22% confidence)\n- **Bear case**: $3.4M (10% confidence)\n\n## Assumptions\n- ARR growth rate: 18% QoQ\n- Churn rate: 2.1%\n- New customer acquisition: 45/month\n- Average deal size: $28K", createdAt: Date().addingTimeInterval(-50000)),
        Artifact(id: "art-004", conversationId: "conv-007", type: .code, title: "Optimized PostgreSQL Query", content: "CREATE INDEX CONCURRENTLY idx_orders_status_partial\n  ON orders (created_at DESC)\n  WHERE status != 'archived';\n\n-- Before: 2.3s full table scan\n-- After:  0.14s index scan\nEXPLAIN ANALYZE\nSELECT id, customer_id, total, status\nFROM orders\nWHERE status != 'archived'\n  AND created_at > NOW() - INTERVAL '30 days'\nORDER BY created_at DESC\nLIMIT 50;", language: "sql", createdAt: Date().addingTimeInterval(-200000)),
    ]

    // MARK: - Governor

    static let governorDashboard = GovernorDashboard(
        config: GovernorConfig(
            mode: .balanced,
            budgetLimit: 100.0,
            budgetUsed: 47.82,
            budgetResetAt: "2026-03-01T00:00:00Z",
            costAlertThreshold: 0.8,
            modelTiers: [
                GovernorModelTier(name: "free", models: ["llama-3.3-70b", "mixtral-8x22b", "gpt-4o-mini"], costPerToken: 0.0, qualityScore: 75, avgLatencyMs: 310, priority: 1, label: "Free Tier", icon: "leaf", color: "green"),
                GovernorModelTier(name: "pro", models: ["claude-4-sonnet", "gpt-4o", "deepseek-r1"], costPerToken: 0.003, qualityScore: 90, avgLatencyMs: 750, priority: 2, label: "Pro Tier", icon: "star", color: "blue"),
                GovernorModelTier(name: "enterprise", models: ["claude-4-opus", "gemini-2-ultra"], costPerToken: 0.012, qualityScore: 97, avgLatencyMs: 1100, priority: 3, label: "Enterprise Tier", icon: "crown", color: "purple"),
            ],
            arbitrageRules: [
                ArbitrageRule(id: "arb-001", name: "Simple tasks use free tier", condition: RuleCondition(type: "complexity", value: "3", conditionOperator: "<="), action: RuleAction(type: "downgrade", targetTier: "free"), enabled: true),
                ArbitrageRule(id: "arb-002", name: "Budget alert at 80%", condition: RuleCondition(type: "budget_percent", value: "80", conditionOperator: ">="), action: RuleAction(type: "alert", targetTier: nil), enabled: true),
                ArbitrageRule(id: "arb-003", name: "Cache repeated queries", condition: RuleCondition(type: "similarity", value: "0.95", conditionOperator: ">="), action: RuleAction(type: "cache_hit", targetTier: nil), enabled: true),
                ArbitrageRule(id: "arb-004", name: "Prefer self-hosted after hours", condition: RuleCondition(type: "time_range", value: "22:00-06:00", conditionOperator: "in"), action: RuleAction(type: "prefer", targetTier: "free"), enabled: false),
            ]
        ),
        metrics: CostMetrics(
            totalCost: 47.82,
            totalTokens: 2_340_000,
            costByTier: ["free": 0.0, "pro": 18.45, "enterprise": 29.37],
            costByModel: ["claude-4-opus": 22.14, "gpt-4o": 12.67, "claude-4-sonnet": 5.78, "deepseek-r1": 4.23, "gemini-2-ultra": 3.00, "llama-3.3-70b": 0.0, "mixtral-8x22b": 0.0],
            tokensByModel: ["claude-4-opus": 580000, "gpt-4o": 450000, "llama-3.3-70b": 420000, "claude-4-sonnet": 380000, "mixtral-8x22b": 260000, "deepseek-r1": 150000, "gemini-2-ultra": 100000],
            savings: SavingsBreakdown(totalSavings: 34.56, savingsPercent: 42.0, selfHostedSavings: 22.10, arbitrageSavings: 8.46, cacheHitSavings: 4.00)
        ),
        fuelGauge: FuelGauge(level: 52.18, color: "orange", status: "Active", remaining: "$52.18 remaining", total: "$100.00 budget", resetIn: "in 20 days"),
        modeIndicator: ModeIndicator(mode: .balanced, icon: "scale.3d", description: "Optimizes for quality and cost balance", color: "blue"),
        savingsSparkline: SavingsSparkline(total: "$34.56", percent: "42%", breakdown: SavingsSparklineBreakdown(selfHosted: "$22.10", arbitrage: "$8.46", cache: "$4.00")),
        alertTriggered: false
    )

    static let governorStatus = GovernorStatus(
        mode: .balanced,
        totalSavings: 34.56,
        decisionsToday: 23,
        lastDecision: GovernorDecision(id: "dec-001", timestamp: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-120)), model: "llama-3.3-70b", tier: "free", cost: 0.0, tokens: 1240, reason: "Simple code formatting task routed to self-hosted model", taskType: "code_format")
    )

    static let governorDecisions: [GovernorDecision] = [
        GovernorDecision(id: "dec-001", timestamp: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-120)), model: "llama-3.3-70b", tier: "free", cost: 0.0, tokens: 1240, reason: "Simple code formatting task routed to self-hosted", taskType: "code_format"),
        GovernorDecision(id: "dec-002", timestamp: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-600)), model: "claude-4-opus", tier: "enterprise", cost: 0.0345, tokens: 2300, reason: "Complex medical reasoning requires highest quality", taskType: "medical_analysis"),
        GovernorDecision(id: "dec-003", timestamp: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-1200)), model: "gpt-4o", tier: "pro", cost: 0.0082, tokens: 1640, reason: "Code review task, pro tier sufficient", taskType: "code_review"),
        GovernorDecision(id: "dec-004", timestamp: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-1800)), model: "mixtral-8x22b", tier: "free", cost: 0.0, tokens: 890, reason: "Cache hit: 97% similar to previous query", taskType: "general"),
        GovernorDecision(id: "dec-005", timestamp: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-2400)), model: "claude-4-sonnet", tier: "pro", cost: 0.0056, tokens: 1870, reason: "Research synthesis requires good reasoning", taskType: "research"),
        GovernorDecision(id: "dec-006", timestamp: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-3000)), model: "deepseek-r1", tier: "pro", cost: 0.0023, tokens: 2300, reason: "Mathematical proof verification", taskType: "math"),
        GovernorDecision(id: "dec-007", timestamp: ISO8601DateFormatter().string(from: Date().addingTimeInterval(-3600)), model: "gpt-4o-mini", tier: "free", cost: 0.0001, tokens: 560, reason: "Simple Q&A, economy model sufficient", taskType: "general"),
    ]

    static let savingsHistory: [SavingsHistoryEntry] = (0..<30).map { i in
        let date = Calendar.current.date(byAdding: .day, value: -29 + i, to: Date())!
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return SavingsHistoryEntry(date: formatter.string(from: date), savings: Double.random(in: 0.5...3.5))
    }

    static let budgetStatus = BudgetStatus(withinBudget: true, remaining: 52.18, fuelLevel: 52.18, alertTriggered: false, limit: 100, used: 47.82, usedPercent: 47.82, resetAt: "2026-03-01T00:00:00Z")

    static let modelRecommendation = ModelRecommendation(
        model: "claude-4-sonnet", tier: "pro", estimatedCost: 0.0045, qualityScore: 90, estimatedLatency: 600,
        reason: "Best quality/cost ratio for this task complexity",
        alternatives: [
            ModelAlternative(model: "llama-3.3-70b", tier: "free", estimatedCost: 0.0),
            ModelAlternative(model: "claude-4-opus", tier: "enterprise", estimatedCost: 0.0135),
        ],
        tierIcon: "star", tierColor: "blue"
    )

    // MARK: - Brain Plan

    static let brainPlan = BrainPlan(
        id: "bp-001",
        prompt: "Explain Kubernetes pod autoscaling strategies",
        mode: .thinking,
        domain: DomainDetection(field: "engineering", domain: "kubernetes", subspecialty: "autoscaling", confidence: 0.96),
        steps: [
            BrainPlanStep(id: "step-1", type: .analyze, description: "Analyze prompt complexity and intent", status: .completed, startedAt: Date().addingTimeInterval(-5), completedAt: Date().addingTimeInterval(-4.5)),
            BrainPlanStep(id: "step-2", type: .detectDomain, description: "Detect domain: Engineering > Kubernetes", status: .completed, startedAt: Date().addingTimeInterval(-4.5), completedAt: Date().addingTimeInterval(-4)),
            BrainPlanStep(id: "step-3", type: .selectModel, description: "Select model: Claude 4 Opus (enterprise)", status: .completed, startedAt: Date().addingTimeInterval(-4), completedAt: Date().addingTimeInterval(-3.5)),
            BrainPlanStep(id: "step-4", type: .ethicsCheck, description: "CATO safety check passed", status: .completed, startedAt: Date().addingTimeInterval(-3.5), completedAt: Date().addingTimeInterval(-3)),
            BrainPlanStep(id: "step-5", type: .prepareContext, description: "Assemble context with K8s cartridge", status: .completed, startedAt: Date().addingTimeInterval(-3), completedAt: Date().addingTimeInterval(-2)),
            BrainPlanStep(id: "step-6", type: .generate, description: "Generate response with chain-of-thought", status: .completed, startedAt: Date().addingTimeInterval(-2), completedAt: Date().addingTimeInterval(-0.5)),
        ],
        selectedModel: "claude-4-opus",
        modelReason: "Complex technical explanation requires highest reasoning capability",
        estimatedTimeMs: 1240,
        estimatedCost: 0.0127,
        status: .completed,
        createdAt: Date().addingTimeInterval(-5)
    )

    // MARK: - Snapshots (Time Machine)

    static let snapshots: [Snapshot] = [
        Snapshot(id: "snap-001", timestamp: Date().addingTimeInterval(-3600), label: "Initial question", isBookmarked: true, isBranch: false, preview: "Can you explain the difference between horizontal and vertical..."),
        Snapshot(id: "snap-002", timestamp: Date().addingTimeInterval(-3540), label: nil, isBookmarked: false, isBranch: false, preview: "HPA vs VPA response generated"),
        Snapshot(id: "snap-003", timestamp: Date().addingTimeInterval(-3400), label: nil, isBookmarked: false, isBranch: false, preview: "Follow-up about KEDA"),
        Snapshot(id: "snap-004", timestamp: Date().addingTimeInterval(-3340), label: "KEDA deep dive", isBookmarked: true, isBranch: false, preview: "KEDA comparison response with YAML example"),
        Snapshot(id: "snap-005", timestamp: Date().addingTimeInterval(-3200), label: "Alternative: Knative", isBookmarked: false, isBranch: true, branchName: "knative-branch", preview: "Branched to explore Knative autoscaling"),
    ]

    // MARK: - Grimoire (Spells)

    static let spells: [Spell] = [
        Spell(id: "spell-001", name: "Code Review Expert", description: "Thorough code review with security, performance, and best practice checks", category: .code, prompt: "Review the following {{language}} code for:\n1. Security vulnerabilities\n2. Performance issues\n3. Best practice violations\n4. Potential bugs\n\nCode:\n```\n{{code}}\n```\n\nProvide specific line-by-line feedback with severity ratings.", variables: [
            SpellVariable(name: "language", type: .select, label: "Language", description: "Programming language", options: ["TypeScript", "Python", "Go", "Rust", "Java"], required: true),
            SpellVariable(name: "code", type: .text, label: "Code to Review", description: "Paste the code to review", required: true),
        ], icon: "magnifyingglass", color: "blue", isPublic: true, usageCount: 234, rating: 4.8, createdAt: "2025-12-01", updatedAt: "2026-01-15"),
        Spell(id: "spell-002", name: "Meeting Summary", description: "Convert meeting notes into structured action items and decisions", category: .productivity, prompt: "Convert these meeting notes into a structured summary:\n\n{{notes}}\n\nFormat:\n1. **Key Decisions** (numbered)\n2. **Action Items** (with owners and deadlines)\n3. **Open Questions**\n4. **Next Steps**", variables: [
            SpellVariable(name: "notes", type: .text, label: "Meeting Notes", description: "Raw meeting notes or transcript", required: true),
        ], icon: "doc.text", color: "green", isPublic: true, usageCount: 189, rating: 4.6, createdAt: "2025-11-15", updatedAt: "2026-02-01"),
        Spell(id: "spell-003", name: "SQL Query Builder", description: "Generate optimized SQL queries from natural language", category: .code, prompt: "Generate an optimized {{dialect}} query for:\n\n{{description}}\n\nSchema:\n{{schema}}\n\nRequirements:\n- Include appropriate indexes\n- Add EXPLAIN ANALYZE\n- Handle NULL cases\n- Use parameterized queries where applicable", variables: [
            SpellVariable(name: "dialect", type: .select, label: "SQL Dialect", options: ["PostgreSQL", "MySQL", "SQLite", "SQL Server"], required: true),
            SpellVariable(name: "description", type: .text, label: "What you need", required: true),
            SpellVariable(name: "schema", type: .text, label: "Table Schema", description: "CREATE TABLE statements or description", required: false),
        ], icon: "cylinder", color: "orange", isPublic: true, usageCount: 156, rating: 4.7, createdAt: "2025-12-10", updatedAt: "2026-01-20"),
        Spell(id: "spell-004", name: "Research Synthesizer", description: "Synthesize multiple sources into a coherent analysis", category: .research, prompt: "Synthesize the following {{source_count}} sources on the topic of {{topic}}:\n\n{{sources}}\n\nProvide:\n1. Common themes and consensus\n2. Contradictions or debates\n3. Key findings with citations\n4. Gaps in the literature\n5. Recommended next reading", variables: [
            SpellVariable(name: "topic", type: .text, label: "Research Topic", required: true),
            SpellVariable(name: "source_count", type: .number, label: "Number of Sources", defaultValue: "3", required: true),
            SpellVariable(name: "sources", type: .text, label: "Sources", description: "Paste summaries or links", required: true),
        ], icon: "books.vertical", color: "purple", isPublic: true, usageCount: 98, rating: 4.9, createdAt: "2026-01-05", updatedAt: "2026-02-05"),
        Spell(id: "spell-005", name: "Creative Brief Generator", description: "Generate a comprehensive creative brief from project requirements", category: .creative, prompt: "Create a creative brief for:\n\nProject: {{project}}\nAudience: {{audience}}\nGoal: {{goal}}\n\nInclude: brand voice, key messages, visual direction, deliverables, timeline.", variables: [
            SpellVariable(name: "project", type: .text, label: "Project Name", required: true),
            SpellVariable(name: "audience", type: .text, label: "Target Audience", required: true),
            SpellVariable(name: "goal", type: .text, label: "Primary Goal", required: true),
        ], icon: "paintbrush", color: "pink", isPublic: true, usageCount: 67, rating: 4.4, createdAt: "2026-01-20", updatedAt: "2026-02-03"),
        Spell(id: "spell-006", name: "Data Analysis Pipeline", description: "Design a data analysis approach for your dataset", category: .analysis, prompt: "Design a data analysis pipeline for:\n\nDataset: {{dataset}}\nObjective: {{objective}}\nTools: {{tools}}\n\nProvide: data cleaning steps, feature engineering, analysis methods, visualization recommendations, and statistical tests.", variables: [
            SpellVariable(name: "dataset", type: .text, label: "Dataset Description", required: true),
            SpellVariable(name: "objective", type: .text, label: "Analysis Objective", required: true),
            SpellVariable(name: "tools", type: .select, label: "Tools", options: ["Python/Pandas", "R", "SQL", "Excel"], required: true),
        ], icon: "chart.xyaxis.line", color: "cyan", isPublic: true, usageCount: 83, rating: 4.5, createdAt: "2026-01-10", updatedAt: "2026-02-01"),
    ]

    // MARK: - Ideas

    static let ideas: [Idea] = [
        Idea(id: "idea-001", title: "AI-Powered Code Migration Tool", description: "Build a tool that uses AI to automatically migrate codebases between frameworks (e.g., React class components to hooks, Express to Fastify). Could analyze AST patterns and generate migration scripts.", category: "Engineering", status: .developing, priority: .high, sourceConversationId: "conv-003", tags: ["ai", "tooling", "migration", "dx"], attachments: [], relatedIdeas: ["idea-003"], createdAt: "2026-02-01T10:00:00Z", updatedAt: "2026-02-07T14:30:00Z"),
        Idea(id: "idea-002", title: "Patient Outcome Prediction Dashboard", description: "Dashboard that aggregates patient data to predict outcomes using ML models. Would need HIPAA compliance, explainable AI components, and integration with EHR systems.", category: "Healthcare", status: .captured, priority: .medium, sourceConversationId: "conv-004", tags: ["healthcare", "ml", "dashboard", "hipaa"], attachments: [IdeaAttachment(id: "att-001", type: .link, title: "FHIR API Reference", content: "https://hl7.org/fhir/")], relatedIdeas: [], createdAt: "2026-02-03T09:15:00Z", updatedAt: "2026-02-03T09:15:00Z"),
        Idea(id: "idea-003", title: "Semantic Codebase Search Engine", description: "A search engine that understands code semantics, not just text. Could find functions by behavior description, detect duplicate logic across repos, and suggest refactoring opportunities.", category: "Engineering", status: .ready, priority: .high, tags: ["search", "nlp", "code-analysis"], attachments: [], relatedIdeas: ["idea-001"], createdAt: "2026-01-28T16:00:00Z", updatedAt: "2026-02-06T11:00:00Z"),
        Idea(id: "idea-004", title: "Automated Compliance Report Generator", description: "Generate SOC2, HIPAA, and GDPR compliance reports automatically by scanning infrastructure configs, access logs, and policy documents.", category: "Security", status: .developing, priority: .medium, tags: ["compliance", "automation", "security"], attachments: [], relatedIdeas: [], createdAt: "2026-01-25T14:30:00Z", updatedAt: "2026-02-05T09:00:00Z"),
        Idea(id: "idea-005", title: "Interactive Financial Model Builder", description: "Drag-and-drop financial modeling tool that uses AI to suggest assumptions, validate logic, and run sensitivity analyses. Export to Excel.", category: "Finance", status: .captured, priority: .low, sourceConversationId: "conv-005", tags: ["finance", "modeling", "interactive"], attachments: [], relatedIdeas: [], createdAt: "2026-02-05T11:00:00Z", updatedAt: "2026-02-05T11:00:00Z"),
        Idea(id: "idea-006", title: "Team Knowledge Graph", description: "Build an organizational knowledge graph that maps expertise, projects, and documentation. AI-powered recommendations for who to talk to about specific topics.", category: "Productivity", status: .implemented, priority: .medium, tags: ["knowledge-management", "graph", "team"], attachments: [], relatedIdeas: [], createdAt: "2026-01-15T08:00:00Z", updatedAt: "2026-02-01T17:00:00Z"),
    ]

    static let ideaBoards: [IdeaBoard] = [
        IdeaBoard(id: "board-001", name: "Q1 2026 Roadmap", description: "Ideas being considered for Q1 implementation", ideaCount: 4, columns: [
            IdeaBoardColumn(id: "col-001", name: "Backlog", ideaIds: ["idea-002", "idea-005"], color: "gray"),
            IdeaBoardColumn(id: "col-002", name: "In Progress", ideaIds: ["idea-001", "idea-004"], color: "blue"),
            IdeaBoardColumn(id: "col-003", name: "Done", ideaIds: ["idea-006"], color: "green"),
        ], createdAt: "2026-01-01T00:00:00Z"),
    ]

    // MARK: - Flash Facts

    static let flashFacts: [FlashFact] = [
        FlashFact(id: "ff-001", conversationId: "conv-001", messageId: "msg-002", fact: "HPA (Horizontal Pod Autoscaler) scales by adding/removing pod replicas based on observed metrics", category: .process, confidence: 0.95, source: "Kubernetes official documentation", verified: true, verificationMethod: .citationFound, tags: ["kubernetes", "scaling"], createdAt: "2026-02-08T20:00:00Z"),
        FlashFact(id: "ff-002", conversationId: "conv-001", messageId: "msg-004", fact: "KEDA supports 60+ built-in event-driven scalers including Kafka, RabbitMQ, and Prometheus", category: .statistic, confidence: 0.92, source: "KEDA documentation", verified: true, verificationMethod: .citationFound, tags: ["keda", "kubernetes"], createdAt: "2026-02-08T20:05:00Z"),
        FlashFact(id: "ff-003", conversationId: "conv-005", messageId: "msg-010", fact: "Monte Carlo simulation showed 68% probability of hitting the $4.2M Q3 revenue target", category: .statistic, confidence: 0.88, verified: false, tags: ["finance", "forecasting"], createdAt: "2026-02-07T15:00:00Z"),
        FlashFact(id: "ff-004", conversationId: "conv-007", messageId: "msg-015", fact: "A partial index on status WHERE status != 'archived' reduced PostgreSQL scan time by 94%", category: .statistic, confidence: 0.97, source: "EXPLAIN ANALYZE output", verified: true, verificationMethod: .userConfirmed, tags: ["postgresql", "optimization"], createdAt: "2026-02-06T10:00:00Z"),
        FlashFact(id: "ff-005", conversationId: "conv-004", messageId: "msg-008", fact: "HIPAA Section 164.312(a)(1) requires unique user identification for all system access", category: .definition, confidence: 0.99, source: "HIPAA Security Rule", verified: true, verificationMethod: .citationFound, tags: ["hipaa", "compliance"], createdAt: "2026-02-05T14:00:00Z"),
        FlashFact(id: "ff-006", conversationId: "conv-006", messageId: "msg-025", fact: "The alignment tax framework measures the additional cost of making AI systems safe vs. unconstrained", category: .definition, confidence: 0.85, verified: false, tags: ["ai-safety", "alignment"], createdAt: "2026-02-04T09:00:00Z"),
        FlashFact(id: "ff-007", conversationId: "conv-003", messageId: "msg-012", fact: "React Server Components serialize on the server and hydrate selectively on the client", category: .process, confidence: 0.93, source: "React RFC", verified: true, verificationMethod: .aiCheck, tags: ["react", "rsc"], createdAt: "2026-02-03T16:00:00Z"),
    ]

    // MARK: - Crucible

    static let crucibleConfig = CrucibleConfig(maxQuestions: 5, costMode: "balanced", enabled: true, visible: true, source: "tenant", canOverride: true)

    static let deliberationEvents: [DeliberationEvent] = [
        DeliberationEvent(questionId: "q-001", questionNumber: 1, questionType: "factual", questionText: "What specific version of the HPA API are you referencing? v1 or v2?", qualityScore: "high", askedAt: Date().addingTimeInterval(-100), askerModel: "claude-4-opus", targetModel: "gpt-4o", answer: DeliberationAnswer(answerId: "a-001", answerText: "autoscaling/v2, which supports custom and external metrics", circularCitationDetected: false, answeredAt: Date().addingTimeInterval(-95))),
        DeliberationEvent(questionId: "q-002", questionNumber: 2, questionType: "challenge", questionText: "Is KEDA truly CNCF graduated, or is it still incubating?", qualityScore: "high", askedAt: Date().addingTimeInterval(-90), askerModel: "gemini-2-ultra", targetModel: "claude-4-opus", answer: DeliberationAnswer(answerId: "a-002", answerText: "KEDA graduated from CNCF in August 2023. Verified via CNCF landscape.", circularCitationDetected: false, answeredAt: Date().addingTimeInterval(-85))),
    ]

    // MARK: - Cartridges

    static let cartridges: [ActiveCartridge] = [
        ActiveCartridge(id: "cart-001", name: "Kubernetes Expert", version: "2.1.0", scope: .system, domainId: "engineering", priority: 10, isActive: true),
        ActiveCartridge(id: "cart-002", name: "TypeScript Best Practices", version: "1.4.0", scope: .tenant, domainId: "engineering", priority: 20, isActive: true),
        ActiveCartridge(id: "cart-003", name: "HIPAA Compliance Guide", version: "1.0.0", scope: .system, domainId: "medicine", priority: 15, isActive: true),
        ActiveCartridge(id: "cart-004", name: "My Coding Standards", version: "1.0.0", scope: .user, priority: 5, isActive: true),
    ]

    // MARK: - AXIOM Session

    static let axiomSession = AxiomSession(
        sessionId: "axiom-001",
        status: .active,
        workflow: AxiomWorkflow(currentStep: 1, steps: [
            AxiomStep(id: "ax-step-1", name: "Classify", status: .completed),
            AxiomStep(id: "ax-step-2", name: "Clarify", status: .running),
            AxiomStep(id: "ax-step-3", name: "Compile", status: .pending),
            AxiomStep(id: "ax-step-4", name: "Route", status: .pending),
        ], overallProgress: 0.35),
        domain: AxiomDomain(name: "Software Engineering", confidence: 0.89),
        currentQuestion: ClarionQuestion(questionId: "cq-001", text: "What programming language is your project primarily written in?", type: "choice", options: ["TypeScript", "Python", "Go", "Rust", "Java", "Other"], importance: "high"),
        answeredCount: 1,
        modelScores: [
            ModelScore(modelId: "claude-4-opus", modelName: "Claude 4 Opus", score: 0.92, reason: "Strong at complex code analysis"),
            ModelScore(modelId: "deepseek-r1", modelName: "DeepSeek R1", score: 0.88, reason: "Excellent reasoning capabilities"),
            ModelScore(modelId: "gpt-4o", modelName: "GPT-4o", score: 0.85, reason: "Good general-purpose coding"),
        ],
        compiledPrompt: nil
    )

    static let axiomSessionCompiled = AxiomSession(
        sessionId: "axiom-001",
        status: .completed,
        workflow: AxiomWorkflow(currentStep: 3, steps: [
            AxiomStep(id: "ax-step-1", name: "Classify", status: .completed),
            AxiomStep(id: "ax-step-2", name: "Clarify", status: .completed),
            AxiomStep(id: "ax-step-3", name: "Compile", status: .completed),
            AxiomStep(id: "ax-step-4", name: "Route", status: .completed),
        ], overallProgress: 1.0),
        domain: AxiomDomain(name: "Software Engineering", confidence: 0.95),
        currentQuestion: nil,
        answeredCount: 3,
        modelScores: [
            ModelScore(modelId: "claude-4-opus", modelName: "Claude 4 Opus", score: 0.96, reason: "Best match for TypeScript architecture review"),
            ModelScore(modelId: "deepseek-r1", modelName: "DeepSeek R1", score: 0.89, reason: "Strong reasoning but less TypeScript training"),
        ],
        compiledPrompt: CompiledPrompt(systemPrompt: "You are an expert TypeScript architect...", userPrompt: "Review my distributed system architecture...", modelId: "claude-4-opus", modelName: "Claude 4 Opus", tokenCount: 2450)
    )

    // MARK: - Derivation Chains

    static let derivationChains: [DerivationChain] = [
        DerivationChain(id: "dc-001", messageId: "msg-002", nodes: [
            DerivationNode(id: "dn-001", type: .claim, content: "HPA scales by adding/removing pod replicas", confidence: 0.95, parentIds: [], childIds: ["dn-002"], createdAt: "2026-02-08T20:00:00Z"),
            DerivationNode(id: "dn-002", type: .evidence, content: "Kubernetes autoscaling/v2 API specification", confidence: 0.98, sourceMessageId: "msg-002", parentIds: ["dn-001"], childIds: [], metadata: ["source": "k8s.io/docs"], createdAt: "2026-02-08T20:00:01Z"),
        ], rootNodeId: "dn-001", depth: 2, confidence: 0.96, createdAt: "2026-02-08T20:00:00Z"),
    ]

    // MARK: - Delight Preferences

    static let delightPrefs = DelightPreferencesService.BackendPreferences(
        personality_mode: "auto",
        intensity: 5,
        sound_enabled: true,
        suppress_idle: false,
        suppress_session_start: false
    )
}
