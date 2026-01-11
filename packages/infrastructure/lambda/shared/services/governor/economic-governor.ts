/**
 * The Economic Governor
 * 
 * RADIANT v5.4.0 - Cognitive Architecture (PROMPT-40)
 * 
 * Uses a "System 0" cheap model to classify task complexity and route
 * to the most cost-effective model that can handle the task.
 * 
 * NEW in v5.4.0:
 * - Retrieval confidence routing (Ghost Memory integration)
 * - War Room fallback for low confidence
 * - Circuit breaker integration
 * - Domain-aware routing
 * 
 * Complexity Scale:
 * 1-4: Simple (formatting, summarization, basic Q&A) → gpt-4o-mini
 * 5-8: Medium (analysis, multi-step reasoning) → original model
 * 9-10: Complex (planning, code generation, creative) → gpt-4o
 * 
 * Routing Decision Tree:
 * 1. retrieval_confidence < 0.7 → War Room (validation needed)
 * 2. complexity < 0.3 (sniper threshold) → Sniper (fast path)
 * 3. complexity > 0.7 (war_room threshold) → War Room (deep analysis)
 * 4. domain_hint = 'medical' → War Room + Precision Governor
 */

import { Logger } from '../../logger';

export type GovernorMode = 'performance' | 'balanced' | 'cost_saver' | 'off';

export interface SwarmTask {
  id: string;
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
}

export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  model: string;
}

export type RouteType = 'sniper' | 'war_room' | 'hitl';

// ============================================================================
// Polymorphic UI Types (PROMPT-41)
// ============================================================================

export type ViewType = 
  | 'terminal_simple'   // Sniper Mode - Command Center
  | 'mindmap'           // Scout Mode - Infinite Canvas
  | 'diff_editor'       // Sage Mode - Split-Screen Verification
  | 'dashboard'         // Analytics & Metrics
  | 'decision_cards'    // HITL Mission Control
  | 'chat';             // Default conversation

export interface PolymorphicViewDecision {
  viewType: ViewType;
  executionMode: 'sniper' | 'war_room';
  rationale: string;
  estimatedCostCents: number;
  domainHint?: string;
}

export interface GovernorDecision {
  originalModel: string;
  selectedModel: string;
  complexityScore: number;
  mode: GovernorMode;
  reason: string;
  estimatedOriginalCost: number;
  estimatedActualCost: number;
  savingsAmount: number;
  // v5.4.0 additions
  routeType: RouteType;
  retrievalConfidence: number;
  ghostHit: boolean;
  domainHint?: string;
  circuitBreakerOpen: boolean;
}

export interface GovernorConfig {
  mode: GovernorMode;
  cheapThreshold: number;
  premiumThreshold: number;
  classifierModel: string;
  cheapModel: string;
  premiumModel: string;
  // v5.4.0 additions for cognitive routing
  sniperThreshold: number;
  warRoomThreshold: number;
  retrievalConfidenceThreshold: number;
  lowConfidenceRoute: RouteType;
  domainRouting: Record<string, RouteType>;
}

const DEFAULT_CONFIG: GovernorConfig = {
  mode: 'balanced',
  cheapThreshold: 4,
  premiumThreshold: 9,
  classifierModel: 'gpt-4o-mini',
  cheapModel: 'gpt-4o-mini',
  premiumModel: 'gpt-4o',
  // v5.4.0 cognitive routing defaults
  sniperThreshold: 0.3,
  warRoomThreshold: 0.7,
  retrievalConfidenceThreshold: 0.7,
  lowConfidenceRoute: 'war_room',
  domainRouting: {
    medical: 'war_room',
    financial: 'war_room',
    legal: 'war_room',
    general: 'sniper',
  },
};

const MODEL_COSTS_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
  'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
  'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
  'llama-3.1-70b': { input: 0.0009, output: 0.0009 },
  'llama-3.1-8b': { input: 0.0001, output: 0.0001 },
};

export class EconomicGovernor {
  private readonly litellmUrl: string;
  private readonly apiKey: string;
  private config: GovernorConfig;

  constructor(private logger: Logger, config?: Partial<GovernorConfig>) {
    this.litellmUrl = process.env.LITELLM_PROXY_URL || 'http://litellm.radiant.internal';
    this.apiKey = process.env.LITELLM_API_KEY || '';
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Updates the Governor configuration
   */
  setConfig(config: Partial<GovernorConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Governor config updated', { config: this.config });
  }

  /**
   * Gets the current Governor configuration
   */
  getConfig(): GovernorConfig {
    return { ...this.config };
  }

  /**
   * Estimates the cost for a given model and token count
   */
  private estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    const costs = MODEL_COSTS_PER_1K_TOKENS[model] || MODEL_COSTS_PER_1K_TOKENS['gpt-4o'];
    return (inputTokens / 1000) * costs.input + (outputTokens / 1000) * costs.output;
  }

  /**
   * v5.4.0 - Cognitive routing with retrieval confidence
   * 
   * Routes based on:
   * 1. Retrieval confidence from Ghost Memory
   * 2. Complexity score from System 0
   * 3. Domain hints for compliance routing
   */
  async cognitiveRoute(
    query: string,
    options: {
      retrievalConfidence?: number;
      ghostHit?: boolean;
      domainHint?: string;
      userTier?: string;
      circuitBreakerState?: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
      userOverride?: 'sniper' | 'war_room';
    } = {}
  ): Promise<{
    routeType: RouteType;
    reason: string;
    complexityScore: number;
    selectedModel: string;
  }> {
    const {
      retrievalConfidence = 1.0,
      ghostHit = false,
      domainHint,
      userTier = 'standard',
      circuitBreakerState = 'CLOSED',
      userOverride,
    } = options;

    // Honor manual user override (PROMPT-41 Gearbox)
    if (userOverride) {
      return {
        routeType: userOverride,
        reason: `User manual override to ${userOverride} mode`,
        complexityScore: -1,
        selectedModel: userOverride === 'sniper' ? this.config.cheapModel : this.config.premiumModel,
      };
    }

    // Circuit breaker open - fallback to War Room
    if (circuitBreakerState === 'OPEN') {
      return {
        routeType: 'war_room',
        reason: 'Circuit breaker open - routing to War Room for validation',
        complexityScore: -1,
        selectedModel: this.config.premiumModel,
      };
    }

    // Low retrieval confidence - needs War Room validation
    if (retrievalConfidence < this.config.retrievalConfidenceThreshold) {
      return {
        routeType: this.config.lowConfidenceRoute,
        reason: `Low retrieval confidence (${(retrievalConfidence * 100).toFixed(1)}%) - routing to ${this.config.lowConfidenceRoute} for validation`,
        complexityScore: -1,
        selectedModel: this.config.premiumModel,
      };
    }

    // Domain-based routing (medical, financial, legal → War Room)
    if (domainHint && this.config.domainRouting[domainHint]) {
      const domainRoute = this.config.domainRouting[domainHint];
      if (domainRoute === 'war_room') {
        return {
          routeType: 'war_room',
          reason: `Domain hint '${domainHint}' requires War Room + Precision Governor`,
          complexityScore: -1,
          selectedModel: this.config.premiumModel,
        };
      }
    }

    // Analyze complexity
    const complexityScore = await this.scoreComplexity(query);
    const normalizedComplexity = complexityScore / 10; // Convert 1-10 to 0-1

    // Free tier or simple query with good retrieval → Sniper
    if (userTier === 'free' || normalizedComplexity < this.config.sniperThreshold) {
      return {
        routeType: 'sniper',
        reason: ghostHit 
          ? `Ghost memory hit with high confidence - Sniper path (complexity: ${complexityScore}/10)`
          : `Low complexity (${complexityScore}/10) - Sniper path`,
        complexityScore,
        selectedModel: this.config.cheapModel,
      };
    }

    // High complexity → War Room
    if (normalizedComplexity >= this.config.warRoomThreshold) {
      return {
        routeType: 'war_room',
        reason: `High complexity (${complexityScore}/10) - War Room for deep analysis`,
        complexityScore,
        selectedModel: this.config.premiumModel,
      };
    }

    // Medium complexity - route based on ghost hit
    return {
      routeType: ghostHit ? 'sniper' : 'war_room',
      reason: ghostHit
        ? `Medium complexity with Ghost hit - Sniper path (complexity: ${complexityScore}/10)`
        : `Medium complexity without Ghost hit - War Room (complexity: ${complexityScore}/10)`,
      complexityScore,
      selectedModel: ghostHit ? this.config.cheapModel : this.config.premiumModel,
    };
  }

  /**
   * Analyzes prompt complexity and returns the optimal model.
   */
  async optimizeModelSelection(
    task: SwarmTask,
    agent: AgentConfig,
    mode?: GovernorMode,
    cognitiveOptions?: {
      retrievalConfidence?: number;
      ghostHit?: boolean;
      domainHint?: string;
    }
  ): Promise<GovernorDecision> {
    const effectiveMode = mode || this.config.mode;

    // Performance mode or off: Always use the original model (no intervention)
    if (effectiveMode === 'off' || effectiveMode === 'performance') {
      return {
        originalModel: agent.model,
        selectedModel: agent.model,
        complexityScore: -1,
        mode: effectiveMode,
        reason: `Governor ${effectiveMode === 'off' ? 'disabled' : 'in performance mode'}`,
        estimatedOriginalCost: 0,
        estimatedActualCost: 0,
        savingsAmount: 0,
        routeType: 'sniper',
        retrievalConfidence: cognitiveOptions?.retrievalConfidence ?? 1.0,
        ghostHit: cognitiveOptions?.ghostHit ?? false,
        domainHint: cognitiveOptions?.domainHint,
        circuitBreakerOpen: false,
      };
    }

    // 1. Analyze Complexity using "System 0" (cheap classifier model)
    const complexityScore = await this.scoreComplexity(task.prompt);
    
    this.logger.info('Governor Complexity Analysis', { 
      taskId: task.id,
      score: complexityScore, 
      originalModel: agent.model, 
      mode: effectiveMode 
    });

    // 2. Determine routing thresholds based on mode
    const cheapThreshold = effectiveMode === 'cost_saver' ? 7 : this.config.cheapThreshold;
    const premiumThreshold = this.config.premiumThreshold;

    // 3. Route to optimal model
    let selectedModel = agent.model;
    let reason = 'Complexity within range for original model';

    if (complexityScore <= cheapThreshold) {
      selectedModel = this.config.cheapModel;
      reason = `Low complexity (${complexityScore}/${cheapThreshold}) - downgraded to efficient model`;
    } else if (complexityScore >= premiumThreshold) {
      selectedModel = this.config.premiumModel;
      reason = `High complexity (${complexityScore}) - upgraded to premium model`;
    }

    // 4. Calculate estimated costs (assuming ~500 input, ~1000 output tokens average)
    const avgInputTokens = 500;
    const avgOutputTokens = 1000;
    const estimatedOriginalCost = this.estimateCost(agent.model, avgInputTokens, avgOutputTokens);
    const estimatedActualCost = this.estimateCost(selectedModel, avgInputTokens, avgOutputTokens);
    const savingsAmount = Math.max(0, estimatedOriginalCost - estimatedActualCost);

    // v5.4.0 - Use cognitive routing if retrieval confidence provided
    let routeType: RouteType = 'sniper';
    if (cognitiveOptions?.retrievalConfidence !== undefined) {
      const cognitiveResult = await this.cognitiveRoute(task.prompt, {
        retrievalConfidence: cognitiveOptions.retrievalConfidence,
        ghostHit: cognitiveOptions.ghostHit,
        domainHint: cognitiveOptions.domainHint,
      });
      routeType = cognitiveResult.routeType;
      
      // If cognitive routing determined War Room, use premium model
      if (routeType === 'war_room' && selectedModel === this.config.cheapModel) {
        selectedModel = this.config.premiumModel;
        reason = cognitiveResult.reason;
      }
    } else {
      // Determine route type based on complexity alone
      routeType = complexityScore <= this.config.cheapThreshold ? 'sniper' : 'war_room';
    }

    return {
      originalModel: agent.model,
      selectedModel,
      complexityScore,
      mode: effectiveMode,
      reason,
      estimatedOriginalCost,
      estimatedActualCost,
      savingsAmount,
      routeType,
      retrievalConfidence: cognitiveOptions?.retrievalConfidence ?? 1.0,
      ghostHit: cognitiveOptions?.ghostHit ?? false,
      domainHint: cognitiveOptions?.domainHint,
      circuitBreakerOpen: false,
    };
  }

  /**
   * Uses a cheap "System 0" model to score task complexity.
   * Returns a score from 1-10.
   */
  private async scoreComplexity(prompt: string): Promise<number> {
    try {
      const response = await fetch(`${this.litellmUrl}/chat/completions`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          model: this.config.classifierModel,
          max_tokens: 5,
          temperature: 0,
          messages: [
            {
              role: 'system',
              content: `You are a task complexity classifier. Rate the complexity of the following task from 1-10.
              
Scale:
1-3: Simple formatting, basic Q&A, summarization
4-6: Analysis, comparison, multi-step reasoning  
7-8: Complex analysis, creative writing, detailed planning
9-10: Advanced reasoning, code generation, multi-domain synthesis

Return ONLY a single integer from 1-10. No explanation.`
            },
            {
              role: 'user',
              content: prompt.substring(0, 500)
            }
          ]
        })
      });
      
      if (!response.ok) {
        this.logger.warn('Governor API call failed', { status: response.status });
        return 5;
      }

      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content || '5';
      const score = parseInt(content.trim(), 10);
      
      if (isNaN(score) || score < 1 || score > 10) {
        this.logger.warn('Governor received invalid score', { content });
        return 5;
      }

      return score;
    } catch (error) {
      this.logger.warn('Governor scoring failed, defaulting to 5', { error });
      return 5;
    }
  }

  /**
   * Batch analyze multiple tasks for efficiency
   */
  async optimizeBatch(
    tasks: Array<{ task: SwarmTask; agent: AgentConfig }>,
    mode?: GovernorMode
  ): Promise<GovernorDecision[]> {
    return Promise.all(
      tasks.map(({ task, agent }) => this.optimizeModelSelection(task, agent, mode))
    );
  }

  // ============================================================================
  // Polymorphic UI Methods (PROMPT-41)
  // ============================================================================

  /**
   * Determines the optimal UI view type based on query intent and execution mode.
   * 
   * View Selection Logic:
   * - Quick commands/lookups → terminal_simple (Sniper)
   * - Research/exploration → mindmap (Scout)
   * - Verification/compliance → diff_editor (Sage)
   * - HITL escalation → decision_cards
   * - Analytics queries → dashboard
   * - Default conversation → chat
   * 
   * @param query - User query text
   * @param routeType - Already-determined route (sniper/war_room/hitl)
   * @param domainHint - Domain for compliance routing
   * @returns PolymorphicViewDecision with view type and rationale
   */
  determineViewType(
    query: string,
    routeType: RouteType,
    domainHint?: string
  ): PolymorphicViewDecision {
    const queryLower = query.toLowerCase();
    
    // HITL always gets decision_cards
    if (routeType === 'hitl') {
      return {
        viewType: 'decision_cards',
        executionMode: 'war_room',
        rationale: 'Human-in-the-loop escalation requires Mission Control decision interface',
        estimatedCostCents: 50,
        domainHint,
      };
    }

    // Sniper Mode patterns → terminal_simple
    const sniperPatterns = [
      /^(check|show|list|get|find|lookup|search|query)\s/i,
      /^(what is|what's|who is|where is|when is)\s/i,
      /(error|log|status|version|config)/i,
      /^(run|execute|do|make|create)\s.*?(quick|fast|simple)/i,
      /(draft|write|send)\s(a\s)?(quick|brief|short)/i,
    ];

    // Scout Mode patterns → mindmap
    const scoutPatterns = [
      /(map|explore|research|investigate|analyze.*landscape)/i,
      /(compare|versus|vs\.|difference|contrast|competitive)/i,
      /(brainstorm|ideas|options|alternatives|possibilities)/i,
      /(strategy|plan|roadmap|approach|framework)/i,
      /(market|industry|sector|trend|outlook)/i,
    ];

    // Sage Mode patterns → diff_editor
    const sagePatterns = [
      /(verify|validate|check|audit|review|ensure|confirm)/i,
      /(compliance|regulation|guideline|policy|safety)/i,
      /(contract|agreement|document|legal|terms)/i,
      /(compare.*against|match.*with|align.*to)/i,
      /(source|citation|reference|evidence|proof)/i,
    ];

    // Dashboard patterns
    const dashboardPatterns = [
      /(analytics|metrics|statistics|kpi|dashboard)/i,
      /(chart|graph|visualization|report|summary)/i,
      /(performance|usage|cost|spend|budget)/i,
    ];

    // Check Sage patterns first (highest compliance priority)
    if (sagePatterns.some(p => p.test(queryLower)) || 
        ['medical', 'financial', 'legal'].includes(domainHint || '')) {
      return {
        viewType: 'diff_editor',
        executionMode: 'war_room',
        rationale: domainHint 
          ? `Compliance domain (${domainHint}) requires verification view with source attribution`
          : 'Verification/audit query requires split-screen diff editor for source validation',
        estimatedCostCents: 50,
        domainHint,
      };
    }

    // Check Scout patterns (research/exploration)
    if (scoutPatterns.some(p => p.test(queryLower))) {
      return {
        viewType: 'mindmap',
        executionMode: 'war_room',
        rationale: 'Research/exploration query benefits from infinite canvas mind map visualization',
        estimatedCostCents: 50,
        domainHint,
      };
    }

    // Check Dashboard patterns
    if (dashboardPatterns.some(p => p.test(queryLower))) {
      return {
        viewType: 'dashboard',
        executionMode: routeType === 'sniper' ? 'sniper' : 'war_room',
        rationale: 'Analytics/metrics query rendered as interactive dashboard',
        estimatedCostCents: routeType === 'sniper' ? 1 : 50,
        domainHint,
      };
    }

    // Check Sniper patterns (fast execution)
    if (sniperPatterns.some(p => p.test(queryLower)) || routeType === 'sniper') {
      return {
        viewType: 'terminal_simple',
        executionMode: 'sniper',
        rationale: 'Quick command/lookup rendered as command center terminal',
        estimatedCostCents: 1,
        domainHint,
      };
    }

    // Default to chat - War Room for remaining cases (already checked sniper above)
    return {
      viewType: 'chat',
      executionMode: 'war_room',
      rationale: 'General query uses standard conversation interface with multi-agent ensemble',
      estimatedCostCents: 50,
      domainHint,
    };
  }

  /**
   * Combined routing: determines both execution mode AND view type.
   * 
   * This is the main entry point for Polymorphic UI routing decisions.
   * Returns full routing decision including model, view type, and cost estimate.
   */
  async determinePolymorphicRoute(
    query: string,
    options: {
      userTier?: string;
      retrievalConfidence?: number;
      ghostHit?: boolean;
      domainHint?: string;
      userOverride?: 'sniper' | 'war_room';
    } = {}
  ): Promise<GovernorDecision & PolymorphicViewDecision> {
    // 1. Determine execution route (sniper/war_room)
    const cognitiveResult = await this.cognitiveRoute(query, {
      userTier: options.userTier,
      retrievalConfidence: options.retrievalConfidence ?? 1.0,
      ghostHit: options.ghostHit ?? false,
      domainHint: options.domainHint,
      userOverride: options.userOverride,
    });

    // 2. Determine view type based on route and query
    const viewDecision = this.determineViewType(
      query,
      cognitiveResult.routeType,
      options.domainHint
    );

    // 3. Combine into full polymorphic decision
    return {
      originalModel: this.config.cheapModel,
      selectedModel: cognitiveResult.selectedModel,
      complexityScore: cognitiveResult.complexityScore,
      mode: this.config.mode,
      reason: cognitiveResult.reason,
      estimatedOriginalCost: 0,
      estimatedActualCost: viewDecision.estimatedCostCents / 100,
      savingsAmount: 0,
      routeType: cognitiveResult.routeType,
      retrievalConfidence: options.retrievalConfidence ?? 1.0,
      ghostHit: options.ghostHit ?? false,
      domainHint: options.domainHint,
      circuitBreakerOpen: false,
      // Polymorphic UI additions
      viewType: viewDecision.viewType,
      executionMode: viewDecision.executionMode,
      rationale: viewDecision.rationale,
      estimatedCostCents: viewDecision.estimatedCostCents,
    };
  }
}

let governorInstance: EconomicGovernor | null = null;

export function getGovernor(logger: Logger, config?: Partial<GovernorConfig>): EconomicGovernor {
  if (!governorInstance) {
    governorInstance = new EconomicGovernor(logger, config);
  }
  return governorInstance;
}

export function resetGovernor(): void {
  governorInstance = null;
}
