// RADIANT v7.11.0 - Heterogeneous Model Consensus Types
// Cross-model agreement scoring using diverse AI providers
// Extends self_consistency mode from single-model to multi-model consensus
//
// Architecture:
//   Unlike standard self-consistency (same model, multiple samples),
//   heterogeneous consensus queries DIFFERENT models from DIFFERENT providers
//   and measures inter-model agreement. This produces:
//
//   1. Higher confidence when diverse models agree (epistemic convergence)
//   2. Better hallucination detection when models disagree
//   3. Provider-fault tolerance (one provider down → others still contribute)
//
// Scoring Algorithm:
//   For each response pair (model_i, model_j):
//     semantic_similarity = cosine(embed(response_i), embed(response_j))
//   Agreement = mean(all pairwise similarities)
//   Confidence = weighted_mean(agreement, model_quality_scores)
//
// Model Selection Strategy:
//   Models are chosen to maximize PROVIDER DIVERSITY:
//   - At least 2 different providers (e.g., Anthropic + OpenAI)
//   - At least 2 different architectures (e.g., Claude + GPT + Gemini)
//   - Cost-aware: uses the cheapest model per provider that meets quality threshold
//
// Integration Points:
//   - OrchestrationMethodsService: New 'heterogeneous-consensus-service' method
//   - AGI Brain Planner: Available as orchestration mode enhancement
//   - Truth Engine: Feeds into factual verification pipeline

// ============================================================================
// Core Consensus Types
// ============================================================================

/**
 * A model participant in the consensus panel.
 * Each participant represents one model from one provider.
 */
export interface ConsensusParticipant {
  /** Model identifier (e.g., 'anthropic/claude-3-5-sonnet-20241022') */
  modelId: string;

  /** Provider name (e.g., 'anthropic', 'openai', 'google') */
  provider: string;

  /** Architecture family (e.g., 'claude', 'gpt', 'gemini', 'llama') */
  architectureFamily: string;

  /** Quality tier: 1 = frontier, 2 = strong, 3 = efficient */
  qualityTier: 1 | 2 | 3;

  /** Cost per 1K input tokens in USD */
  inputCostPer1k: number;

  /** Cost per 1K output tokens in USD */
  outputCostPer1k: number;

  /** Average latency in ms */
  avgLatencyMs: number;

  /** Weight in consensus scoring (higher = more trusted, 0.0-1.0) */
  consensusWeight: number;

  /** Capabilities relevant to the task */
  capabilities: string[];
}

/**
 * A single model's response in the consensus panel.
 */
export interface ConsensusResponse {
  /** Which participant generated this response */
  participant: ConsensusParticipant;

  /** The model's response text */
  response: string;

  /** Extracted answer (normalized for comparison) */
  extractedAnswer: string;

  /** Token usage */
  inputTokens: number;
  outputTokens: number;

  /** Cost of this individual call in USD */
  costUsd: number;

  /** Latency of this individual call in ms */
  latencyMs: number;

  /** Whether this model's call succeeded */
  success: boolean;

  /** Error message if call failed */
  error?: string;

  /** Model's self-reported confidence (if extractable) */
  selfReportedConfidence?: number;
}

/**
 * Pairwise agreement score between two models.
 */
export interface PairwiseAgreement {
  /** First model */
  modelA: string;

  /** Second model */
  modelB: string;

  /** Provider of model A */
  providerA: string;

  /** Provider of model B */
  providerB: string;

  /** Semantic similarity score (0.0-1.0) */
  semanticSimilarity: number;

  /** Exact answer match (boolean converted to 0 or 1) */
  exactMatch: number;

  /** Whether models are from different providers (cross-provider agreement is stronger signal) */
  crossProvider: boolean;

  /** Whether models are from different architecture families */
  crossArchitecture: boolean;
}

// ============================================================================
// Consensus Result
// ============================================================================

/**
 * The complete result of a heterogeneous consensus evaluation.
 * This is the primary output of the consensus service.
 */
export interface HeterogeneousConsensusResult {
  /** Unique identifier for this consensus evaluation */
  consensusId: string;

  /** Tenant that requested this evaluation */
  tenantId: string;

  /** The original prompt that was evaluated */
  promptHash: string;

  /** Number of models that participated */
  participantCount: number;

  /** Number of unique providers represented */
  providerCount: number;

  /** Number of unique architecture families represented */
  architectureFamilyCount: number;

  /** Individual responses from each model */
  responses: ConsensusResponse[];

  /** Pairwise agreement scores between all model pairs */
  pairwiseAgreements: PairwiseAgreement[];

  // ---- Aggregate Scores ----

  /**
   * Overall agreement score (0.0-1.0).
   * Weighted mean of all pairwise semantic similarities.
   * Higher = more models agree on the answer.
   */
  overallAgreement: number;

  /**
   * Cross-provider agreement (0.0-1.0).
   * Only considers pairs from DIFFERENT providers.
   * This is the most meaningful signal — if Claude, GPT, and Gemini all agree,
   * the answer is very likely correct.
   */
  crossProviderAgreement: number;

  /**
   * Cross-architecture agreement (0.0-1.0).
   * Only considers pairs from DIFFERENT architecture families.
   */
  crossArchitectureAgreement: number;

  /**
   * Confidence score (0.0-1.0).
   * Composite score combining agreement, model quality, and diversity.
   * Formula: 0.5 * crossProviderAgreement + 0.3 * overallAgreement + 0.2 * diversityBonus
   */
  confidence: number;

  /**
   * The winning response (highest agreement with other models).
   * This is the response to return to the user.
   */
  winningResponse: string;

  /** Which model produced the winning response */
  winningModel: string;

  /** Which provider produced the winning response */
  winningProvider: string;

  /** Number of models that substantially agreed with the winner */
  agreementCount: number;

  /** Dissenting models (those that disagreed with the majority) */
  dissentingModels: string[];

  /**
   * Hallucination risk score (0.0-1.0).
   * Higher = more likely that the response contains hallucinations.
   * Computed as 1.0 - crossProviderAgreement when agreement is low.
   */
  hallucinationRisk: number;

  /**
   * Whether the result should trigger a reflexion/self-correction loop.
   * True when agreement is below the configured threshold.
   */
  triggerReflexion: boolean;

  /** Reason for triggering reflexion, if applicable */
  reflexionReason?: string;

  // ---- Cost & Performance ----

  /** Total cost of all model calls in USD */
  totalCostUsd: number;

  /** Total wall-clock time in ms (parallel execution) */
  totalLatencyMs: number;

  /** Time to compute consensus scores (post-response processing) */
  scoringLatencyMs: number;

  /** Total tokens used across all models */
  totalTokensUsed: number;

  /** Timestamp of this evaluation */
  createdAt: string;
}

// ============================================================================
// Consensus Configuration (Per-Tenant)
// ============================================================================

/**
 * Per-tenant configuration for heterogeneous consensus.
 */
export interface HeterogeneousConsensusConfig {
  /** Tenant ID (null = global defaults) */
  tenantId: string | null;

  /** Master toggle */
  enabled: boolean;

  /**
   * Minimum number of models to query for consensus.
   * Default: 3 (the minimum for meaningful majority voting).
   */
  minModels: number;

  /**
   * Maximum number of models to query.
   * Default: 5 (balances cost vs. confidence).
   */
  maxModels: number;

  /**
   * Minimum number of unique providers required.
   * Default: 2 (at least 2 different companies' models).
   */
  minProviders: number;

  /**
   * Maximum cost budget per consensus evaluation in USD.
   * Default: 0.50 (prevents runaway costs).
   */
  maxCostPerEvaluationUsd: number;

  /**
   * Maximum latency budget per evaluation in ms.
   * Models are called in parallel, so this is wall-clock time.
   * Default: 30000 (30 seconds).
   */
  maxLatencyMs: number;

  /**
   * Agreement threshold below which reflexion is triggered.
   * Default: 0.6 (if less than 60% agreement, something may be wrong).
   */
  reflexionThreshold: number;

  /**
   * Agreement threshold below which the response is flagged as potentially hallucinated.
   * Default: 0.4 (less than 40% agreement is very concerning).
   */
  hallucinationThreshold: number;

  /**
   * Strategy for selecting the winning response.
   * - 'majority_vote': Response with most similar answers wins
   * - 'quality_weighted': Weight by model quality tier
   * - 'cost_weighted': Prefer cheaper models when agreement is high
   * - 'highest_quality': Always prefer the highest-tier model's response
   */
  winnerSelectionStrategy: 'majority_vote' | 'quality_weighted' | 'cost_weighted' | 'highest_quality';

  /**
   * Default panel of models to use for consensus.
   * If empty, the service auto-selects based on available models and diversity requirements.
   */
  defaultPanel: ConsensusParticipant[];

  /**
   * Task types where consensus is automatically applied.
   * Empty = only when explicitly requested.
   */
  autoApplyTaskTypes: string[];

  /**
   * Whether to use embedding-based semantic similarity (more accurate but costs extra).
   * If false, uses normalized text comparison (free but less accurate).
   */
  useEmbeddingSimilarity: boolean;

  /** Embedding model to use for semantic similarity */
  embeddingModel: string;

  /** When configuration was last updated */
  updatedAt: string;

  /** Who last updated the configuration */
  updatedBy: string;
}

/**
 * Default configuration values.
 */
export const DEFAULT_HETEROGENEOUS_CONSENSUS_CONFIG: Omit<
  HeterogeneousConsensusConfig,
  'tenantId' | 'updatedAt' | 'updatedBy'
> = {
  enabled: true,
  minModels: 3,
  maxModels: 5,
  minProviders: 2,
  maxCostPerEvaluationUsd: 0.50,
  maxLatencyMs: 30000,
  reflexionThreshold: 0.6,
  hallucinationThreshold: 0.4,
  winnerSelectionStrategy: 'quality_weighted',
  defaultPanel: [],
  autoApplyTaskTypes: [],
  useEmbeddingSimilarity: true,
  embeddingModel: 'amazon/titan-embed-text',
};

// ============================================================================
// Consensus Metrics & Dashboard
// ============================================================================

/**
 * Aggregate metrics for the consensus system.
 */
export interface HeterogeneousConsensusMetrics {
  periodStart: string;
  periodEnd: string;
  tenantId: string | null;

  /** Total evaluations performed */
  totalEvaluations: number;

  /** Average agreement score across all evaluations */
  avgAgreement: number;

  /** Average cross-provider agreement */
  avgCrossProviderAgreement: number;

  /** Average confidence score */
  avgConfidence: number;

  /** Average hallucination risk */
  avgHallucinationRisk: number;

  /** Number of reflexion triggers */
  reflexionTriggerCount: number;

  /** Cost statistics */
  totalCostUsd: number;
  avgCostPerEvaluationUsd: number;

  /** Latency statistics */
  avgLatencyMs: number;
  p95LatencyMs: number;

  /** Model participation breakdown */
  modelParticipation: Array<{
    modelId: string;
    provider: string;
    participationCount: number;
    winCount: number;
    avgAgreementWithOthers: number;
  }>;

  /** Provider diversity statistics */
  providerDistribution: Array<{
    provider: string;
    evaluationCount: number;
    avgContribution: number;
  }>;
}

/**
 * Full dashboard data for the admin UI.
 */
export interface HeterogeneousConsensusDashboard {
  config: HeterogeneousConsensusConfig;
  metrics: HeterogeneousConsensusMetrics;
  recentEvaluations: HeterogeneousConsensusResult[];
  modelLeaderboard: Array<{
    modelId: string;
    provider: string;
    winRate: number;
    avgAgreement: number;
    avgCostUsd: number;
    totalParticipations: number;
  }>;
}

// ============================================================================
// Consensus Request Types (for service layer)
// ============================================================================

/**
 * Input for requesting a heterogeneous consensus evaluation.
 */
export interface ConsensusRequest {
  /** Tenant making the request */
  tenantId: string;

  /** User making the request */
  userId: string;

  /** The prompt to evaluate */
  prompt: string;

  /** Optional system prompt */
  systemPrompt?: string;

  /** Task type (influences model selection) */
  taskType?: string;

  /** Specific models to include (overrides auto-selection) */
  forceModels?: string[];

  /** Specific providers to include */
  forceProviders?: string[];

  /** Maximum cost budget (overrides config) */
  maxCostUsd?: number;

  /** Maximum latency (overrides config) */
  maxLatencyMs?: number;

  /** Temperature for generation */
  temperature?: number;

  /** Max tokens per model response */
  maxTokens?: number;

  /** Whether to extract a structured answer from each response */
  extractAnswer?: boolean;

  /** Custom answer extraction prompt */
  answerExtractionPrompt?: string;
}
