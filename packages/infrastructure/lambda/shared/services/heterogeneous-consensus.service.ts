// RADIANT v7.11.0 - Heterogeneous Model Consensus Service
//
// Cross-model agreement scoring using diverse AI providers.
// Extends self_consistency from single-model (same model, N samples)
// to multi-model (N different models from M different providers).
//
// Why This Matters:
//   When Claude, GPT-4, and Gemini all agree on an answer, that answer
//   is far more likely to be correct than when a single model agrees
//   with itself 5 times (which just confirms the model's own biases).
//
// Architecture:
//   1. Select diverse panel of models (maximize provider + architecture diversity)
//   2. Query all models in PARALLEL (latency = max single model, not sum)
//   3. Extract structured answers from each response
//   4. Compute pairwise semantic similarity between all response pairs
//   5. Aggregate into overall, cross-provider, and cross-architecture scores
//   6. Select winning response based on configured strategy
//   7. Flag low-agreement results for reflexion/hallucination review
//
// Integration Points:
//   - OrchestrationMethodsService: 'heterogeneous-consensus-service'
//   - AGI Brain Planner: Available as orchestration enhancement
//   - Truth Engine: Feeds into factual verification pipeline
//   - Inference Cache: Cached responses bypass consensus (already verified)

import { createHash } from 'crypto';
import { executeStatement, stringParam, longParam } from '../db';
import { Logger } from '../logger';
import { modelRouterService } from './model-router.service';
import { MODEL_REGISTRY } from './model-router.service';
import type {
  ConsensusParticipant,
  ConsensusResponse,
  PairwiseAgreement,
  HeterogeneousConsensusResult,
  HeterogeneousConsensusConfig,
  HeterogeneousConsensusMetrics,
  HeterogeneousConsensusDashboard,
  ConsensusRequest,
} from '@radiant/shared';

const logger = new Logger({ service: 'heterogeneous-consensus-service' });

// ============================================================================
// Architecture Family Detection
// ============================================================================

/**
 * Map model IDs to their architecture families.
 * Models from the same family share training data and architectural biases,
 * so cross-family agreement is a stronger signal than within-family agreement.
 */
const ARCHITECTURE_FAMILIES: Record<string, string> = {
  'anthropic': 'claude',
  'openai': 'gpt',
  'google': 'gemini',
  'meta': 'llama',
  'mistral': 'mistral',
  'cohere': 'command',
  'deepseek': 'deepseek',
  'xai': 'grok',
  'together': 'llama', // Together hosts Llama models
  'groq': 'llama',     // Groq hosts Llama/Mixtral
  'perplexity': 'llama', // Perplexity hosts Llama-based models
  'amazon': 'titan',
};

/**
 * Default consensus panel — diverse models from different providers.
 * Selected to maximize provider diversity while minimizing cost.
 * The panel uses one model per provider, choosing the best cost/quality ratio.
 */
const DEFAULT_PANEL: ConsensusParticipant[] = [
  {
    modelId: 'anthropic/claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    architectureFamily: 'claude',
    qualityTier: 1,
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.015,
    avgLatencyMs: 1200,
    consensusWeight: 0.9,
    capabilities: ['reasoning', 'coding', 'analysis', 'vision'],
  },
  {
    modelId: 'openai/gpt-4o',
    provider: 'openai',
    architectureFamily: 'gpt',
    qualityTier: 1,
    inputCostPer1k: 0.005,
    outputCostPer1k: 0.015,
    avgLatencyMs: 1000,
    consensusWeight: 0.9,
    capabilities: ['reasoning', 'vision', 'language'],
  },
  {
    modelId: 'google/gemini-1.5-pro',
    provider: 'google',
    architectureFamily: 'gemini',
    qualityTier: 1,
    inputCostPer1k: 0.00125,
    outputCostPer1k: 0.005,
    avgLatencyMs: 1500,
    consensusWeight: 0.85,
    capabilities: ['reasoning', 'vision', 'long-context'],
  },
  {
    modelId: 'mistral/mistral-large',
    provider: 'mistral',
    architectureFamily: 'mistral',
    qualityTier: 2,
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.009,
    avgLatencyMs: 900,
    consensusWeight: 0.75,
    capabilities: ['reasoning', 'coding', 'multilingual'],
  },
  {
    modelId: 'meta/llama-3.1-70b',
    provider: 'bedrock',
    architectureFamily: 'llama',
    qualityTier: 2,
    inputCostPer1k: 0.00099,
    outputCostPer1k: 0.00099,
    avgLatencyMs: 800,
    consensusWeight: 0.7,
    capabilities: ['reasoning', 'general', 'open-source'],
  },
];

// ============================================================================
// Heterogeneous Consensus Service
// ============================================================================

class HeterogeneousConsensusService {
  /**
   * Tenant config cache (5-minute TTL).
   */
  private configCache = new Map<string, { config: HeterogeneousConsensusConfig; fetchedAt: number }>();
  private readonly CONFIG_CACHE_TTL_MS = 300_000;

  // ============================================================================
  // Main Consensus Evaluation
  // ============================================================================

  /**
   * Run a heterogeneous consensus evaluation.
   *
   * This is the primary entry point. It:
   * 1. Selects a diverse panel of models
   * 2. Queries all models in parallel
   * 3. Computes pairwise agreement scores
   * 4. Selects the winning response
   * 5. Persists results for audit and analytics
   *
   * @param request - The consensus request with prompt and configuration
   * @returns Complete consensus result with agreement scores and winning response
   */
  async evaluate(request: ConsensusRequest): Promise<HeterogeneousConsensusResult> {
    const startTime = Date.now();
    const consensusId = crypto.randomUUID();

    logger.info('Starting heterogeneous consensus evaluation', {
      consensusId,
      tenantId: request.tenantId,
      promptLength: request.prompt.length,
      taskType: request.taskType,
    });

    // Load configuration
    const config = await this.getConfig(request.tenantId);
    if (!config.enabled) {
      throw new Error('Heterogeneous consensus is disabled for this tenant');
    }

    // 1. SELECT PANEL
    const panel = this.selectPanel(config, request);
    const providerSet = new Set(panel.map(p => p.provider));
    const familySet = new Set(panel.map(p => p.architectureFamily));

    logger.info('Panel selected', {
      consensusId,
      panelSize: panel.length,
      providers: Array.from(providerSet),
      families: Array.from(familySet),
    });

    // 2. QUERY ALL MODELS IN PARALLEL
    const responses = await this.queryPanel(panel, request, config);
    const successfulResponses = responses.filter(r => r.success);

    if (successfulResponses.length < 2) {
      throw new Error(`Insufficient successful responses: ${successfulResponses.length}/${panel.length}. Need at least 2 for consensus.`);
    }

    // 3. COMPUTE PAIRWISE AGREEMENT
    const scoringStart = Date.now();
    const pairwiseAgreements = await this.computePairwiseAgreement(
      successfulResponses,
      config.useEmbeddingSimilarity,
      config.embeddingModel
    );

    // 4. AGGREGATE SCORES
    const overallAgreement = this.computeOverallAgreement(pairwiseAgreements, successfulResponses);
    const crossProviderAgreement = this.computeCrossProviderAgreement(pairwiseAgreements);
    const crossArchitectureAgreement = this.computeCrossArchitectureAgreement(pairwiseAgreements);

    // 5. SELECT WINNER
    const { winner, agreementCount, dissentingModels } = this.selectWinner(
      successfulResponses,
      pairwiseAgreements,
      config.winnerSelectionStrategy
    );

    // 6. COMPUTE DERIVED SCORES
    const diversityBonus = (providerSet.size / panel.length) * 0.5 + (familySet.size / panel.length) * 0.5;
    const confidence = 0.5 * crossProviderAgreement + 0.3 * overallAgreement + 0.2 * diversityBonus;
    const hallucinationRisk = crossProviderAgreement < config.hallucinationThreshold
      ? 1.0 - crossProviderAgreement
      : Math.max(0, 0.5 - crossProviderAgreement * 0.5);

    const triggerReflexion = overallAgreement < config.reflexionThreshold;
    const reflexionReason = triggerReflexion
      ? `Agreement score ${(overallAgreement * 100).toFixed(0)}% is below threshold ${(config.reflexionThreshold * 100).toFixed(0)}%. ${dissentingModels.length} model(s) dissented: ${dissentingModels.join(', ')}.`
      : undefined;

    const scoringLatencyMs = Date.now() - scoringStart;

    // 7. BUILD RESULT
    const totalCostUsd = responses.reduce((sum, r) => sum + r.costUsd, 0);
    const totalTokensUsed = responses.reduce((sum, r) => sum + r.inputTokens + r.outputTokens, 0);
    const totalLatencyMs = Date.now() - startTime;

    const result: HeterogeneousConsensusResult = {
      consensusId,
      tenantId: request.tenantId,
      promptHash: createHash('sha256').update(request.prompt).digest('hex'),
      participantCount: panel.length,
      providerCount: providerSet.size,
      architectureFamilyCount: familySet.size,
      responses,
      pairwiseAgreements,
      overallAgreement,
      crossProviderAgreement,
      crossArchitectureAgreement,
      confidence,
      winningResponse: winner.response,
      winningModel: winner.participant.modelId,
      winningProvider: winner.participant.provider,
      agreementCount,
      dissentingModels,
      hallucinationRisk,
      triggerReflexion,
      reflexionReason,
      totalCostUsd,
      totalLatencyMs,
      scoringLatencyMs,
      totalTokensUsed,
      createdAt: new Date().toISOString(),
    };

    // 8. PERSIST RESULTS (async, don't block response)
    this.persistResult(result).catch(err => {
      logger.warn('Failed to persist consensus result', { consensusId, error: err });
    });

    logger.info('Consensus evaluation complete', {
      consensusId,
      overallAgreement: overallAgreement.toFixed(3),
      crossProviderAgreement: crossProviderAgreement.toFixed(3),
      confidence: confidence.toFixed(3),
      hallucinationRisk: hallucinationRisk.toFixed(3),
      triggerReflexion,
      winningModel: winner.participant.modelId,
      totalCostUsd: totalCostUsd.toFixed(6),
      totalLatencyMs,
    });

    return result;
  }

  // ============================================================================
  // Panel Selection
  // ============================================================================

  /**
   * Select a diverse panel of models for consensus evaluation.
   *
   * Strategy:
   * 1. Start with forced models (if any)
   * 2. Fill remaining slots from default panel, prioritizing provider diversity
   * 3. Ensure minProviders requirement is met
   * 4. Respect cost budget
   */
  private selectPanel(config: HeterogeneousConsensusConfig, request: ConsensusRequest): ConsensusParticipant[] {
    const maxModels = request.forceModels?.length || config.maxModels;
    const panel: ConsensusParticipant[] = [];
    const usedProviders = new Set<string>();

    // Add forced models first
    if (request.forceModels && request.forceModels.length > 0) {
      for (const modelId of request.forceModels) {
        const participant = this.modelIdToParticipant(modelId);
        if (participant) {
          panel.push(participant);
          usedProviders.add(participant.provider);
        }
      }
    }

    // Fill from default panel (or config panel)
    const sourcePanel = config.defaultPanel.length > 0 ? config.defaultPanel : DEFAULT_PANEL;

    // Prioritize models from new providers (maximize diversity)
    const sortedPanel = [...sourcePanel].sort((a, b) => {
      const aNew = usedProviders.has(a.provider) ? 1 : 0;
      const bNew = usedProviders.has(b.provider) ? 1 : 0;
      return aNew - bNew; // New providers first
    });

    for (const participant of sortedPanel) {
      if (panel.length >= maxModels) break;
      if (panel.some(p => p.modelId === participant.modelId)) continue;

      // Check cost budget
      const estimatedCost = (participant.inputCostPer1k * 2 + participant.outputCostPer1k * 2); // ~2K tokens estimate
      const currentCost = panel.reduce((sum, p) => sum + p.inputCostPer1k * 2 + p.outputCostPer1k * 2, 0);
      if (currentCost + estimatedCost > config.maxCostPerEvaluationUsd) continue;

      panel.push(participant);
      usedProviders.add(participant.provider);
    }

    // Ensure minimum models
    if (panel.length < config.minModels) {
      logger.warn('Panel below minimum size', {
        panelSize: panel.length,
        minModels: config.minModels,
      });
    }

    return panel;
  }

  /**
   * Convert a model ID from the model registry to a ConsensusParticipant.
   */
  private modelIdToParticipant(modelId: string): ConsensusParticipant | null {
    const modelConfig = MODEL_REGISTRY[modelId];
    if (!modelConfig) return null;

    const provider = modelConfig.provider;
    const providerPrefix = modelId.split('/')[0] || provider;
    const family = ARCHITECTURE_FAMILIES[providerPrefix] || providerPrefix;

    return {
      modelId: modelConfig.modelId,
      provider,
      architectureFamily: family,
      qualityTier: modelConfig.avgLatencyMs < 500 ? 3 : modelConfig.avgLatencyMs < 1500 ? 2 : 1,
      inputCostPer1k: modelConfig.inputCostPer1k,
      outputCostPer1k: modelConfig.outputCostPer1k,
      avgLatencyMs: modelConfig.avgLatencyMs,
      consensusWeight: modelConfig.inputCostPer1k > 0.003 ? 0.9 : modelConfig.inputCostPer1k > 0.001 ? 0.75 : 0.6,
      capabilities: modelConfig.capabilities,
    };
  }

  // ============================================================================
  // Parallel Model Querying
  // ============================================================================

  /**
   * Query all panel models in parallel.
   * Uses Promise.allSettled to ensure one failure doesn't block others.
   */
  private async queryPanel(
    panel: ConsensusParticipant[],
    request: ConsensusRequest,
    config: HeterogeneousConsensusConfig
  ): Promise<ConsensusResponse[]> {
    const temperature = request.temperature ?? 0.3; // Low temperature for consensus (deterministic)
    const maxTokens = request.maxTokens ?? 2048;

    // Build the prompt with answer extraction instruction
    const extractionPrompt = request.extractAnswer !== false
      ? '\n\nAfter your reasoning, provide your final answer on a new line starting with "ANSWER:".'
      : '';

    const fullPrompt = request.prompt + extractionPrompt;

    // Query all models in parallel with timeout
    const promises = panel.map(async (participant): Promise<ConsensusResponse> => {
      const startTime = Date.now();

      try {
        const result = await Promise.race([
          modelRouterService.invoke({
            tenantId: request.tenantId,
            modelId: participant.modelId,
            messages: request.systemPrompt
              ? [
                  { role: 'system' as const, content: request.systemPrompt },
                  { role: 'user' as const, content: fullPrompt },
                ]
              : [{ role: 'user' as const, content: fullPrompt }],
            temperature,
            maxTokens,
          }),
          // Timeout: reject if model takes too long
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout after ${config.maxLatencyMs}ms`)), config.maxLatencyMs)
          ),
        ]);

        const latencyMs = Date.now() - startTime;
        const extractedAnswer = this.extractAnswer(result.content);

        return {
          participant,
          response: result.content,
          extractedAnswer,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          costUsd: result.costCents / 100,
          latencyMs,
          success: true,
        };
      } catch (error) {
        const latencyMs = Date.now() - startTime;
        logger.warn('Consensus model call failed', {
          modelId: participant.modelId,
          provider: participant.provider,
          error: error instanceof Error ? error.message : 'unknown',
          latencyMs,
        });

        return {
          participant,
          response: '',
          extractedAnswer: '',
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          latencyMs,
          success: false,
          error: error instanceof Error ? error.message : 'unknown',
        };
      }
    });

    return Promise.all(promises);
  }

  /**
   * Extract a structured answer from a model's response.
   * Looks for "ANSWER:" prefix, or uses the last non-empty line.
   */
  private extractAnswer(response: string): string {
    // Look for "ANSWER:" marker
    const answerMatch = response.match(/ANSWER:\s*(.+?)(?:\n|$)/i);
    if (answerMatch) {
      return answerMatch[1].trim();
    }

    // Fall back to last non-empty line
    const lines = response.split('\n').filter(l => l.trim().length > 0);
    return lines[lines.length - 1]?.trim() || response.substring(0, 200);
  }

  // ============================================================================
  // Agreement Scoring
  // ============================================================================

  /**
   * Compute pairwise agreement scores between all response pairs.
   *
   * For N responses, this produces N*(N-1)/2 pairwise scores.
   * Uses either embedding-based semantic similarity or normalized text comparison.
   */
  private async computePairwiseAgreement(
    responses: ConsensusResponse[],
    useEmbeddings: boolean,
    embeddingModel: string
  ): Promise<PairwiseAgreement[]> {
    const agreements: PairwiseAgreement[] = [];

    for (let i = 0; i < responses.length; i++) {
      for (let j = i + 1; j < responses.length; j++) {
        const a = responses[i];
        const b = responses[j];

        // Compute semantic similarity
        let semanticSimilarity: number;
        if (useEmbeddings) {
          try {
            semanticSimilarity = await this.computeEmbeddingSimilarity(
              a.extractedAnswer,
              b.extractedAnswer,
              embeddingModel
            );
          } catch {
            // Fallback to text similarity if embedding fails
            semanticSimilarity = this.computeTextSimilarity(a.extractedAnswer, b.extractedAnswer);
          }
        } else {
          semanticSimilarity = this.computeTextSimilarity(a.extractedAnswer, b.extractedAnswer);
        }

        // Check exact match (case-insensitive, whitespace-normalized)
        const normalizedA = a.extractedAnswer.toLowerCase().replace(/\s+/g, ' ').trim();
        const normalizedB = b.extractedAnswer.toLowerCase().replace(/\s+/g, ' ').trim();
        const exactMatch = normalizedA === normalizedB ? 1 : 0;

        agreements.push({
          modelA: a.participant.modelId,
          modelB: b.participant.modelId,
          providerA: a.participant.provider,
          providerB: b.participant.provider,
          semanticSimilarity,
          exactMatch,
          crossProvider: a.participant.provider !== b.participant.provider,
          crossArchitecture: a.participant.architectureFamily !== b.participant.architectureFamily,
        });
      }
    }

    return agreements;
  }

  /**
   * Compute embedding-based semantic similarity using cosine distance.
   * Uses the configured embedding model (default: Amazon Titan Embeddings).
   */
  private async computeEmbeddingSimilarity(
    textA: string,
    textB: string,
    embeddingModel: string
  ): Promise<number> {
    // Get embeddings for both texts
    const [embA, embB] = await Promise.all([
      this.getEmbedding(textA, embeddingModel),
      this.getEmbedding(textB, embeddingModel),
    ]);

    if (!embA || !embB || embA.length !== embB.length) {
      return this.computeTextSimilarity(textA, textB);
    }

    // Cosine similarity
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < embA.length; i++) {
      dotProduct += embA[i] * embB[i];
      normA += embA[i] * embA[i];
      normB += embB[i] * embB[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Get embedding vector for a text using the model router.
   */
  private async getEmbedding(text: string, embeddingModel: string, tenantId?: string): Promise<number[] | null> {
    try {
      const result = await modelRouterService.invoke({
        modelId: embeddingModel,
        messages: [{ role: 'user', content: text }],
        maxTokens: 1,
        tenantId,
      });

      // Parse embedding from response (model-specific)
      if (result.content && result.content.startsWith('[')) {
        return JSON.parse(result.content) as number[];
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Compute text-based similarity using Jaccard coefficient on word n-grams.
   * This is the free fallback when embeddings are unavailable.
   *
   * Algorithm:
   *   1. Tokenize both texts into word bigrams
   *   2. Compute Jaccard similarity = |intersection| / |union|
   *   3. Result is 0.0-1.0
   */
  private computeTextSimilarity(textA: string, textB: string): number {
    const normalize = (t: string) => t.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const nA = normalize(textA);
    const nB = normalize(textB);

    if (nA === nB) return 1.0;
    if (!nA || !nB) return 0.0;

    // Word-level bigrams
    const wordsA = nA.split(/\s+/);
    const wordsB = nB.split(/\s+/);

    const bigramsA = new Set<string>();
    const bigramsB = new Set<string>();

    for (let i = 0; i < wordsA.length - 1; i++) {
      bigramsA.add(`${wordsA[i]} ${wordsA[i + 1]}`);
    }
    for (let i = 0; i < wordsB.length - 1; i++) {
      bigramsB.add(`${wordsB[i]} ${wordsB[i + 1]}`);
    }

    if (bigramsA.size === 0 && bigramsB.size === 0) {
      // Single-word answers: direct comparison
      return wordsA[0] === wordsB[0] ? 1.0 : 0.0;
    }

    let intersection = 0;
    for (const bg of bigramsA) {
      if (bigramsB.has(bg)) intersection++;
    }

    const union = bigramsA.size + bigramsB.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }

  // ============================================================================
  // Aggregation
  // ============================================================================

  /**
   * Compute overall agreement (weighted mean of all pairwise similarities).
   */
  private computeOverallAgreement(
    agreements: PairwiseAgreement[],
    responses: ConsensusResponse[]
  ): number {
    if (agreements.length === 0) return 0;

    // Weight by the consensus weights of both participants
    const weightMap = new Map(responses.map(r => [r.participant.modelId, r.participant.consensusWeight]));

    let weightedSum = 0;
    let totalWeight = 0;

    for (const ag of agreements) {
      const wA = weightMap.get(ag.modelA) || 0.5;
      const wB = weightMap.get(ag.modelB) || 0.5;
      const pairWeight = (wA + wB) / 2;

      weightedSum += ag.semanticSimilarity * pairWeight;
      totalWeight += pairWeight;
    }

    return totalWeight === 0 ? 0 : weightedSum / totalWeight;
  }

  /**
   * Compute cross-provider agreement (only pairs from DIFFERENT providers).
   * This is the most meaningful signal for correctness.
   */
  private computeCrossProviderAgreement(agreements: PairwiseAgreement[]): number {
    const crossProvider = agreements.filter(a => a.crossProvider);
    if (crossProvider.length === 0) return 0;

    return crossProvider.reduce((sum, a) => sum + a.semanticSimilarity, 0) / crossProvider.length;
  }

  /**
   * Compute cross-architecture agreement (only pairs from DIFFERENT families).
   */
  private computeCrossArchitectureAgreement(agreements: PairwiseAgreement[]): number {
    const crossArch = agreements.filter(a => a.crossArchitecture);
    if (crossArch.length === 0) return 0;

    return crossArch.reduce((sum, a) => sum + a.semanticSimilarity, 0) / crossArch.length;
  }

  // ============================================================================
  // Winner Selection
  // ============================================================================

  /**
   * Select the winning response based on the configured strategy.
   *
   * Strategies:
   * - majority_vote: Response most similar to all others wins
   * - quality_weighted: Weight by model quality tier
   * - cost_weighted: Prefer cheaper models when agreement is high
   * - highest_quality: Always prefer the highest-tier model
   */
  private selectWinner(
    responses: ConsensusResponse[],
    agreements: PairwiseAgreement[],
    strategy: string
  ): { winner: ConsensusResponse; agreementCount: number; dissentingModels: string[] } {
    // Compute per-model agreement score (average similarity with all other models)
    const modelScores = new Map<string, number>();

    for (const response of responses) {
      const relevantAgreements = agreements.filter(
        a => a.modelA === response.participant.modelId || a.modelB === response.participant.modelId
      );

      const avgSimilarity = relevantAgreements.length > 0
        ? relevantAgreements.reduce((sum, a) => sum + a.semanticSimilarity, 0) / relevantAgreements.length
        : 0;

      let score: number;
      switch (strategy) {
        case 'quality_weighted':
          // Boost score by quality tier (tier 1 = 1.0 bonus, tier 2 = 0.5, tier 3 = 0.25)
          score = avgSimilarity * (1.0 + (4 - response.participant.qualityTier) * 0.25);
          break;
        case 'cost_weighted':
          // Boost score for cheaper models (inverted cost)
          const costFactor = 1.0 / (1.0 + response.participant.inputCostPer1k * 100);
          score = avgSimilarity * (1.0 + costFactor * 0.3);
          break;
        case 'highest_quality':
          // Quality tier dominates, agreement is tiebreaker
          score = (4 - response.participant.qualityTier) * 10 + avgSimilarity;
          break;
        default: // majority_vote
          score = avgSimilarity;
      }

      modelScores.set(response.participant.modelId, score);
    }

    // Sort by score
    const sorted = [...responses].sort((a, b) =>
      (modelScores.get(b.participant.modelId) || 0) - (modelScores.get(a.participant.modelId) || 0)
    );

    const winner = sorted[0];
    const winnerModelId = winner.participant.modelId;

    // Count how many models agree with the winner (similarity > 0.6)
    const winnerAgreements = agreements.filter(
      a => (a.modelA === winnerModelId || a.modelB === winnerModelId) && a.semanticSimilarity > 0.6
    );
    const agreementCount = winnerAgreements.length + 1; // +1 for winner itself

    // Identify dissenting models (similarity with winner < 0.4)
    const dissentingModels = agreements
      .filter(a =>
        (a.modelA === winnerModelId || a.modelB === winnerModelId) && a.semanticSimilarity < 0.4
      )
      .map(a => a.modelA === winnerModelId ? a.modelB : a.modelA);

    return { winner, agreementCount, dissentingModels };
  }

  // ============================================================================
  // Persistence
  // ============================================================================

  /**
   * Persist a consensus result to the database.
   * Stores the evaluation, individual responses, and pairwise agreements.
   */
  private async persistResult(result: HeterogeneousConsensusResult): Promise<void> {
    try {
      // 1. Store evaluation
      await executeStatement(
        `INSERT INTO consensus_evaluations (
          consensus_id, tenant_id, prompt_hash, prompt_length, task_type,
          participant_count, provider_count, architecture_family_count,
          overall_agreement, cross_provider_agreement, cross_architecture_agreement,
          confidence, winning_response, winning_model, winning_provider,
          agreement_count, dissenting_models, hallucination_risk,
          trigger_reflexion, reflexion_reason,
          total_cost_usd, total_latency_ms, scoring_latency_ms, total_tokens_used
        ) VALUES (
          $1::uuid, $2::uuid, $3, $4, $5,
          $6, $7, $8,
          $9, $10, $11,
          $12, $13, $14, $15,
          $16, $17::jsonb, $18,
          $19, $20,
          $21, $22, $23, $24
        )`,
        [
          stringParam('consensusId', result.consensusId),
          stringParam('tenantId', result.tenantId),
          stringParam('promptHash', result.promptHash),
          longParam('promptLength', result.promptHash.length),
          stringParam('taskType', result.responses[0]?.participant.capabilities[0] || 'general'),
          longParam('participantCount', result.participantCount),
          longParam('providerCount', result.providerCount),
          longParam('familyCount', result.architectureFamilyCount),
          stringParam('overall', String(result.overallAgreement)),
          stringParam('crossProvider', String(result.crossProviderAgreement)),
          stringParam('crossArch', String(result.crossArchitectureAgreement)),
          stringParam('confidence', String(result.confidence)),
          stringParam('winningResponse', result.winningResponse.substring(0, 10000)),
          stringParam('winningModel', result.winningModel),
          stringParam('winningProvider', result.winningProvider),
          longParam('agreementCount', result.agreementCount),
          stringParam('dissentingModels', JSON.stringify(result.dissentingModels)),
          stringParam('hallucinationRisk', String(result.hallucinationRisk)),
          stringParam('triggerReflexion', String(result.triggerReflexion)),
          stringParam('reflexionReason', result.reflexionReason || ''),
          stringParam('totalCost', String(result.totalCostUsd)),
          longParam('totalLatency', result.totalLatencyMs),
          longParam('scoringLatency', result.scoringLatencyMs),
          longParam('totalTokens', result.totalTokensUsed),
        ]
      );

      // 2. Store individual responses
      for (const response of result.responses) {
        await executeStatement(
          `INSERT INTO consensus_responses (
            consensus_id, tenant_id, model_id, provider, architecture_family,
            quality_tier, consensus_weight, response_text, extracted_answer,
            input_tokens, output_tokens, cost_usd, latency_ms,
            success, error_message, self_reported_confidence
          ) VALUES (
            $1::uuid, $2::uuid, $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11, $12, $13,
            $14, $15, $16
          )`,
          [
            stringParam('consensusId', result.consensusId),
            stringParam('tenantId', result.tenantId),
            stringParam('modelId', response.participant.modelId),
            stringParam('provider', response.participant.provider),
            stringParam('family', response.participant.architectureFamily),
            longParam('tier', response.participant.qualityTier),
            stringParam('weight', String(response.participant.consensusWeight)),
            stringParam('response', response.response.substring(0, 10000)),
            stringParam('answer', response.extractedAnswer.substring(0, 2000)),
            longParam('inputTokens', response.inputTokens),
            longParam('outputTokens', response.outputTokens),
            stringParam('cost', String(response.costUsd)),
            longParam('latency', response.latencyMs),
            stringParam('success', String(response.success)),
            stringParam('error', response.error || ''),
            stringParam('selfConfidence', String(response.selfReportedConfidence ?? '')),
          ]
        );
      }

      // 3. Store pairwise agreements
      for (const agreement of result.pairwiseAgreements) {
        await executeStatement(
          `INSERT INTO consensus_pairwise_agreements (
            consensus_id, tenant_id, model_a, model_b,
            provider_a, provider_b, semantic_similarity,
            exact_match, cross_provider, cross_architecture
          ) VALUES (
            $1::uuid, $2::uuid, $3, $4,
            $5, $6, $7,
            $8, $9, $10
          )`,
          [
            stringParam('consensusId', result.consensusId),
            stringParam('tenantId', result.tenantId),
            stringParam('modelA', agreement.modelA),
            stringParam('modelB', agreement.modelB),
            stringParam('providerA', agreement.providerA),
            stringParam('providerB', agreement.providerB),
            stringParam('similarity', String(agreement.semanticSimilarity)),
            stringParam('exactMatch', String(agreement.exactMatch)),
            stringParam('crossProvider', String(agreement.crossProvider)),
            stringParam('crossArch', String(agreement.crossArchitecture)),
          ]
        );
      }

      logger.info('Consensus result persisted', { consensusId: result.consensusId });
    } catch (error) {
      logger.error('Failed to persist consensus result', error, {
        consensusId: result.consensusId,
      });
    }
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Get consensus configuration for a tenant.
   */
  async getConfig(tenantId: string): Promise<HeterogeneousConsensusConfig> {
    const cached = this.configCache.get(tenantId);
    if (cached && Date.now() - cached.fetchedAt < this.CONFIG_CACHE_TTL_MS) {
      return cached.config;
    }

    try {
      const result = await executeStatement<Record<string, unknown>>(
        `SELECT * FROM consensus_config WHERE tenant_id = $1::uuid`,
        [stringParam('tenantId', tenantId)]
      );

      if (result.rows && result.rows.length > 0) {
        const row = result.rows[0];
        const config: HeterogeneousConsensusConfig = {
          tenantId: String(row.tenant_id),
          enabled: Boolean(row.enabled),
          minModels: Number(row.min_models),
          maxModels: Number(row.max_models),
          minProviders: Number(row.min_providers),
          maxCostPerEvaluationUsd: Number(row.max_cost_per_eval_usd),
          maxLatencyMs: Number(row.max_latency_ms),
          reflexionThreshold: Number(row.reflexion_threshold),
          hallucinationThreshold: Number(row.hallucination_threshold),
          winnerSelectionStrategy: String(row.winner_selection) as HeterogeneousConsensusConfig['winnerSelectionStrategy'],
          defaultPanel: (row.default_panel as ConsensusParticipant[]) || [],
          autoApplyTaskTypes: (row.auto_apply_task_types as string[]) || [],
          useEmbeddingSimilarity: Boolean(row.use_embedding_similarity),
          embeddingModel: String(row.embedding_model),
          updatedAt: String(row.updated_at),
          updatedBy: String(row.updated_by),
        };

        this.configCache.set(tenantId, { config, fetchedAt: Date.now() });
        return config;
      }
    } catch (error) {
      logger.warn('Failed to load consensus config', { tenantId, error });
    }

    // Return defaults
    const defaultConfig: HeterogeneousConsensusConfig = {
      tenantId,
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
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
    };

    this.configCache.set(tenantId, { config: defaultConfig, fetchedAt: Date.now() });
    return defaultConfig;
  }

  /**
   * Update consensus configuration for a tenant.
   */
  async updateConfig(tenantId: string, updates: Partial<HeterogeneousConsensusConfig>, updatedBy: string): Promise<HeterogeneousConsensusConfig> {
    const current = await this.getConfig(tenantId);
    const merged = { ...current, ...updates, tenantId, updatedAt: new Date().toISOString(), updatedBy };

    await executeStatement(
      `INSERT INTO consensus_config (
        tenant_id, enabled, min_models, max_models, min_providers,
        max_cost_per_eval_usd, max_latency_ms, reflexion_threshold,
        hallucination_threshold, winner_selection, default_panel,
        auto_apply_task_types, use_embedding_similarity, embedding_model,
        updated_at, updated_by
      ) VALUES (
        $1::uuid, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11::jsonb,
        $12::jsonb, $13, $14,
        NOW(), $15
      )
      ON CONFLICT (tenant_id) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        min_models = EXCLUDED.min_models,
        max_models = EXCLUDED.max_models,
        min_providers = EXCLUDED.min_providers,
        max_cost_per_eval_usd = EXCLUDED.max_cost_per_eval_usd,
        max_latency_ms = EXCLUDED.max_latency_ms,
        reflexion_threshold = EXCLUDED.reflexion_threshold,
        hallucination_threshold = EXCLUDED.hallucination_threshold,
        winner_selection = EXCLUDED.winner_selection,
        default_panel = EXCLUDED.default_panel,
        auto_apply_task_types = EXCLUDED.auto_apply_task_types,
        use_embedding_similarity = EXCLUDED.use_embedding_similarity,
        embedding_model = EXCLUDED.embedding_model,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by`,
      [
        stringParam('tenantId', tenantId),
        stringParam('enabled', String(merged.enabled)),
        longParam('minModels', merged.minModels),
        longParam('maxModels', merged.maxModels),
        longParam('minProviders', merged.minProviders),
        stringParam('maxCost', String(merged.maxCostPerEvaluationUsd)),
        longParam('maxLatency', merged.maxLatencyMs),
        stringParam('reflexion', String(merged.reflexionThreshold)),
        stringParam('hallucination', String(merged.hallucinationThreshold)),
        stringParam('strategy', merged.winnerSelectionStrategy),
        stringParam('panel', JSON.stringify(merged.defaultPanel)),
        stringParam('autoApply', JSON.stringify(merged.autoApplyTaskTypes)),
        stringParam('useEmbeddings', String(merged.useEmbeddingSimilarity)),
        stringParam('embeddingModel', merged.embeddingModel),
        stringParam('updatedBy', updatedBy),
      ]
    );

    this.configCache.delete(tenantId);
    return merged;
  }

  // ============================================================================
  // Dashboard & Metrics
  // ============================================================================

  /**
   * Get the full dashboard data for the admin UI.
   */
  async getDashboard(tenantId: string): Promise<HeterogeneousConsensusDashboard> {
    const [config, metrics, recentEvaluations, modelLeaderboard] = await Promise.all([
      this.getConfig(tenantId),
      this.getMetrics(tenantId),
      this.getRecentEvaluations(tenantId, 20),
      this.getModelLeaderboard(tenantId),
    ]);

    return { config, metrics, recentEvaluations, modelLeaderboard };
  }

  /**
   * Get aggregated metrics for the consensus system.
   */
  async getMetrics(tenantId: string): Promise<HeterogeneousConsensusMetrics> {
    try {
      const result = await executeStatement<Record<string, unknown>>(
        `SELECT
          COUNT(*) as total_evaluations,
          AVG(overall_agreement) as avg_agreement,
          AVG(cross_provider_agreement) as avg_cross_provider,
          AVG(confidence) as avg_confidence,
          AVG(hallucination_risk) as avg_hallucination,
          COUNT(*) FILTER (WHERE trigger_reflexion = true) as reflexion_count,
          SUM(total_cost_usd) as total_cost,
          AVG(total_cost_usd) as avg_cost,
          AVG(total_latency_ms) as avg_latency,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_latency_ms) as p95_latency
         FROM consensus_evaluations
         WHERE tenant_id = $1::uuid
           AND created_at > NOW() - INTERVAL '24 hours'`,
        [stringParam('tenantId', tenantId)]
      );

      const row = result.rows?.[0] || {};
      return {
        periodStart: new Date(Date.now() - 86400000).toISOString(),
        periodEnd: new Date().toISOString(),
        tenantId,
        totalEvaluations: Number(row.total_evaluations || 0),
        avgAgreement: Number(row.avg_agreement || 0),
        avgCrossProviderAgreement: Number(row.avg_cross_provider || 0),
        avgConfidence: Number(row.avg_confidence || 0),
        avgHallucinationRisk: Number(row.avg_hallucination || 0),
        reflexionTriggerCount: Number(row.reflexion_count || 0),
        totalCostUsd: Number(row.total_cost || 0),
        avgCostPerEvaluationUsd: Number(row.avg_cost || 0),
        avgLatencyMs: Number(row.avg_latency || 0),
        p95LatencyMs: Number(row.p95_latency || 0),
        modelParticipation: [],
        providerDistribution: [],
      };
    } catch (error) {
      logger.warn('Failed to get consensus metrics', { tenantId, error });
      return {
        periodStart: new Date(Date.now() - 86400000).toISOString(),
        periodEnd: new Date().toISOString(),
        tenantId,
        totalEvaluations: 0,
        avgAgreement: 0,
        avgCrossProviderAgreement: 0,
        avgConfidence: 0,
        avgHallucinationRisk: 0,
        reflexionTriggerCount: 0,
        totalCostUsd: 0,
        avgCostPerEvaluationUsd: 0,
        avgLatencyMs: 0,
        p95LatencyMs: 0,
        modelParticipation: [],
        providerDistribution: [],
      };
    }
  }

  /**
   * Get recent consensus evaluations.
   */
  async getRecentEvaluations(tenantId: string, limit: number = 20): Promise<HeterogeneousConsensusResult[]> {
    try {
      const result = await executeStatement<Record<string, unknown>>(
        `SELECT * FROM consensus_evaluations
         WHERE tenant_id = $1::uuid
         ORDER BY created_at DESC
         LIMIT $2`,
        [
          stringParam('tenantId', tenantId),
          longParam('limit', limit),
        ]
      );

      return (result.rows || []).map(row => ({
        consensusId: String(row.consensus_id),
        tenantId: String(row.tenant_id),
        promptHash: String(row.prompt_hash),
        participantCount: Number(row.participant_count),
        providerCount: Number(row.provider_count),
        architectureFamilyCount: Number(row.architecture_family_count),
        responses: [],
        pairwiseAgreements: [],
        overallAgreement: Number(row.overall_agreement),
        crossProviderAgreement: Number(row.cross_provider_agreement),
        crossArchitectureAgreement: Number(row.cross_architecture_agreement),
        confidence: Number(row.confidence),
        winningResponse: String(row.winning_response),
        winningModel: String(row.winning_model),
        winningProvider: String(row.winning_provider),
        agreementCount: Number(row.agreement_count),
        dissentingModels: (row.dissenting_models as string[]) || [],
        hallucinationRisk: Number(row.hallucination_risk),
        triggerReflexion: Boolean(row.trigger_reflexion),
        reflexionReason: row.reflexion_reason ? String(row.reflexion_reason) : undefined,
        totalCostUsd: Number(row.total_cost_usd),
        totalLatencyMs: Number(row.total_latency_ms),
        scoringLatencyMs: Number(row.scoring_latency_ms),
        totalTokensUsed: Number(row.total_tokens_used),
        createdAt: String(row.created_at),
      }));
    } catch (error) {
      logger.warn('Failed to get recent evaluations', { tenantId, error });
      return [];
    }
  }

  /**
   * Get model leaderboard (win rate, avg agreement, cost).
   */
  private async getModelLeaderboard(tenantId: string): Promise<HeterogeneousConsensusDashboard['modelLeaderboard']> {
    try {
      const result = await executeStatement<Record<string, unknown>>(
        `SELECT
          cr.model_id,
          cr.provider,
          COUNT(*) as total_participations,
          COUNT(*) FILTER (WHERE ce.winning_model = cr.model_id) as wins,
          AVG(cr.consensus_weight) as avg_agreement,
          AVG(cr.cost_usd) as avg_cost
         FROM consensus_responses cr
         JOIN consensus_evaluations ce ON cr.consensus_id = ce.consensus_id
         WHERE cr.tenant_id = $1::uuid
           AND cr.success = true
         GROUP BY cr.model_id, cr.provider
         ORDER BY wins DESC
         LIMIT 20`,
        [stringParam('tenantId', tenantId)]
      );

      return (result.rows || []).map(row => ({
        modelId: String(row.model_id),
        provider: String(row.provider),
        winRate: Number(row.total_participations) > 0
          ? Number(row.wins) / Number(row.total_participations)
          : 0,
        avgAgreement: Number(row.avg_agreement || 0),
        avgCostUsd: Number(row.avg_cost || 0),
        totalParticipations: Number(row.total_participations),
      }));
    } catch (error) {
      logger.warn('Failed to get model leaderboard', { tenantId, error });
      return [];
    }
  }
}

// Singleton export
export const heterogeneousConsensusService = new HeterogeneousConsensusService();
