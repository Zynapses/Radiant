/**
 * AXIOM Scorers Service
 * 
 * Inference client for the 8 AXIOM Scorers (lightweight MLPs for scoring/ranking).
 * Provides scoring/ranking capabilities for the AXIOM prompt optimization pipeline.
 * 
 * Scorers:
 * 1. Domain Scorer      - Classifies queries into 800+ domain taxonomy
 * 2. CLARION Scorer     - Scores question relevance for adaptive questioning
 * 3. Pattern Scorer     - Ranks prompt patterns for retrieval
 * 4. Model Scorer       - Scores individual models for task suitability
 * 5. Topology Scorer    - Evaluates orchestration strategies
 * 6. Combination Scorer - Scores multi-model combinations
 * 7. Variant Scorer     - Scores prompt variants for model optimization
 * 8. User Scorer        - Personalizes scores via Ghost Vector
 * 
 * Architecture:
 * - Development: In-memory heuristic fallbacks (no model required)
 * - Production: SageMaker endpoints with ONNX Runtime on Inferentia2
 * 
 * Thermal Integration:
 * - Scorers have thermal states (cold/warm/hot)
 * - Cold scorers use heuristic fallbacks
 * - Warm/hot scorers call SageMaker endpoints
 * 
 * @version 1.1.0
 * @since RADIANT v6.0.0
 */

import { SageMakerRuntimeClient, InvokeEndpointCommand } from '@aws-sdk/client-sagemaker-runtime';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { executeStatement, stringParam, doubleParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import type {
  AxiomScorerId,
} from '@radiant/shared';

// =============================================================================
// Types
// =============================================================================

export type ScorerThermalState = 'cold' | 'warm' | 'hot';

export interface ScorerStatus {
  scorerId: AxiomScorerId;
  thermalState: ScorerThermalState;
  version: string;
  sagemakerEndpoint?: string;
  lastInferenceMs?: number;
  requestsPerMinute: number;
  errorRate: number;
}

export interface InferenceResult<T = number[]> {
  scores: T;
  latencyMs: number;
  usedFallback: boolean;
  scorerVersion: string;
}

export interface DomainClassification {
  domainId: string;
  confidence: number;
  topDomains: Array<{ domainId: string; score: number }>;
}

export interface ModelScores {
  scores: Array<{ modelId: string; score: number }>;
  topModel: { modelId: string; score: number };
}

export interface TopologyScores {
  mode: string;
  confidence: number;
  allModes: Array<{ mode: string; score: number }>;
}

export interface CombinationScore {
  modelPair: [string, string];
  score: number;
  synergy: number;
}

// =============================================================================
// Constants
// =============================================================================

const ORCHESTRATION_MODES = [
  'thinking',
  'extended_thinking', 
  'coding',
  'creative',
  'research',
  'analysis',
  'multi_model',
  'chain_of_thought',
  'self_consistency',
] as const;

const SAGEMAKER_ENDPOINT_PREFIX = 'axiom-neural';
const MODEL_BUCKET = `radiant-axiom-${process.env.STAGE || 'dev'}`;

// =============================================================================
// AXIOM Neural Cortex Service
// =============================================================================

class AxiomNeuralCortexService {
  private sagemaker: SageMakerRuntimeClient;
  private s3: S3Client;
  private scorerStatus: Map<AxiomScorerId, ScorerStatus> = new Map();
  private initialized = false;

  constructor() {
    this.sagemaker = new SageMakerRuntimeClient({});
    this.s3 = new S3Client({});
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load network status from database
      const result = await executeStatement(
        `SELECT network_id, thermal_state, version, sagemaker_endpoint,
                requests_per_minute, error_rate, last_inference_ms
         FROM axiom_network_status`,
        []
      );

      for (const row of result.rows) {
        const r = row as Record<string, unknown>;
        this.scorerStatus.set(r.network_id as AxiomScorerId, {
          scorerId: r.network_id as AxiomScorerId,
          thermalState: (r.thermal_state as ScorerThermalState) || 'cold',
          version: (r.version as string) || '1.0.0',
          sagemakerEndpoint: r.sagemaker_endpoint as string | undefined,
          lastInferenceMs: r.last_inference_ms as number | undefined,
          requestsPerMinute: (r.requests_per_minute as number) || 0,
          errorRate: (r.error_rate as number) || 0,
        });
      }

      // Initialize missing scorers with cold state
      const allScorers: AxiomScorerId[] = [
        'domain', 'clarion', 'pattern', 'model', 
        'topology', 'combination', 'variant', 'user'
      ];
      
      for (const scorerId of allScorers) {
        if (!this.scorerStatus.has(scorerId)) {
          this.scorerStatus.set(scorerId, {
            scorerId,
            thermalState: 'cold',
            version: '1.0.0',
            requestsPerMinute: 0,
            errorRate: 0,
          });
        }
      }

      this.initialized = true;
      logger.info('[AXIOM:SCORER] Scorers initialized', {
        scorers: allScorers.length,
        warmScorers: [...this.scorerStatus.values()].filter(s => s.thermalState !== 'cold').length,
      });
    } catch (error) {
      logger.warn('[AXIOM:SCORER] Failed to load scorer status, using defaults', { error });
      this.initialized = true;
    }
  }

  // ===========================================================================
  // [AXIOM:SCORER] Domain Scorer - Classify into 800+ domains
  // ===========================================================================

  async classifyDomain(queryEmbedding: number[]): Promise<InferenceResult<DomainClassification>> {
    await this.initialize();
    const startTime = Date.now();
    const status = this.scorerStatus.get('domain')!;

    // Try SageMaker if warm/hot
    if (status.thermalState !== 'cold' && status.sagemakerEndpoint) {
      try {
        const scores = await this.invokeSageMaker(status.sagemakerEndpoint, queryEmbedding);
        const classification = this.parseDomainScores(scores);
        return {
          scores: classification,
          latencyMs: Date.now() - startTime,
          usedFallback: false,
          scorerVersion: status.version,
        };
      } catch (error) {
        logger.warn('[AXIOM:NEURAL] Domain network inference failed, using fallback', { error });
      }
    }

    // Fallback: Use embedding similarity with domain centroids (simplified)
    const classification = await this.domainFallback(queryEmbedding);
    return {
      scores: classification,
      latencyMs: Date.now() - startTime,
      usedFallback: true,
      scorerVersion: status.version,
    };
  }

  private async domainFallback(queryEmbedding: number[]): Promise<DomainClassification> {
    // Query domain centroids from database using pgvector
    const result = await executeStatement(
      `SELECT domain_id, 1 - (centroid_embedding <=> $1::vector) as similarity
       FROM domain_taxonomy_embeddings
       WHERE centroid_embedding IS NOT NULL
       ORDER BY similarity DESC
       LIMIT 10`,
      [stringParam('embedding', `[${queryEmbedding.slice(0, 1536).join(',')}]`)]
    );

    if (result.rows.length === 0) {
      return {
        domainId: 'general.assistant',
        confidence: 0.5,
        topDomains: [{ domainId: 'general.assistant', score: 0.5 }],
      };
    }

    const topDomains = result.rows.map(r => ({
      domainId: String((r as Record<string, unknown>).domain_id),
      score: Number((r as Record<string, unknown>).similarity),
    }));

    return {
      domainId: topDomains[0].domainId,
      confidence: topDomains[0].score,
      topDomains,
    };
  }

  // ===========================================================================
  // [AXIOM:SCORER] CLARION Scorer - Score question relevance
  // ===========================================================================

  async scoreClarionQuestions(
    sessionContext: number[],
    questionFeatures: Array<{ questionId: string; features: number[] }>
  ): Promise<InferenceResult<Array<{ questionId: string; score: number }>>> {
    await this.initialize();
    const startTime = Date.now();
    const status = this.scorerStatus.get('clarion')!;

    const scores: Array<{ questionId: string; score: number }> = [];

    for (const question of questionFeatures) {
      let score: number;

      if (status.thermalState !== 'cold' && status.sagemakerEndpoint) {
        try {
          const input = [...sessionContext.slice(0, 1408), ...question.features.slice(0, 128)];
          const result = await this.invokeSageMaker(status.sagemakerEndpoint, input);
          score = result[0];
        } catch {
          score = this.clarionFallback(question.features);
        }
      } else {
        score = this.clarionFallback(question.features);
      }

      scores.push({ questionId: question.questionId, score });
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    return {
      scores,
      latencyMs: Date.now() - startTime,
      usedFallback: status.thermalState === 'cold',
      scorerVersion: status.version,
    };
  }

  private clarionFallback(questionFeatures: number[]): number {
    // Heuristic: Use information gain and priority from features
    // Assuming features encode: [informationGain, priority, skipRate, ...]
    const informationGain = questionFeatures[0] || 0.5;
    const priority = questionFeatures[1] || 0.5;
    const skipRateInverse = 1 - (questionFeatures[2] || 0.2);
    
    return (informationGain * 0.4) + (priority * 0.35) + (skipRateInverse * 0.25);
  }

  // ===========================================================================
  // [AXIOM:SCORER] Pattern Scorer - Rank prompt patterns
  // ===========================================================================

  async scorePatterns(
    queryEmbedding: number[],
    patterns: Array<{ patternId: string; embedding: number[] }>
  ): Promise<InferenceResult<Array<{ patternId: string; score: number }>>> {
    await this.initialize();
    const startTime = Date.now();
    const status = this.scorerStatus.get('pattern')!;

    const scores: Array<{ patternId: string; score: number }> = [];

    for (const pattern of patterns) {
      let score: number;

      if (status.thermalState !== 'cold' && status.sagemakerEndpoint) {
        try {
          // Concatenate query + pattern embeddings (3072 total)
          const input = [...queryEmbedding.slice(0, 1536), ...pattern.embedding.slice(0, 1536)];
          const result = await this.invokeSageMaker(status.sagemakerEndpoint, input);
          score = result[0];
        } catch {
          score = this.patternFallback(queryEmbedding, pattern.embedding);
        }
      } else {
        score = this.patternFallback(queryEmbedding, pattern.embedding);
      }

      scores.push({ patternId: pattern.patternId, score });
    }

    scores.sort((a, b) => b.score - a.score);

    return {
      scores,
      latencyMs: Date.now() - startTime,
      usedFallback: status.thermalState === 'cold',
      scorerVersion: status.version,
    };
  }

  private patternFallback(queryEmbedding: number[], patternEmbedding: number[]): number {
    // Cosine similarity fallback
    return this.cosineSimilarity(queryEmbedding, patternEmbedding);
  }

  // ===========================================================================
  // [AXIOM:SCORER] Model Scorer - Score models for task
  // ===========================================================================

  async scoreModels(taskFeatures: number[]): Promise<InferenceResult<ModelScores>> {
    await this.initialize();
    const startTime = Date.now();
    const status = this.scorerStatus.get('model')!;

    let modelScores: Array<{ modelId: string; score: number }>;

    if (status.thermalState !== 'cold' && status.sagemakerEndpoint) {
      try {
        const scores = await this.invokeSageMaker(status.sagemakerEndpoint, taskFeatures);
        modelScores = await this.parseModelScores(scores);
      } catch {
        modelScores = await this.modelFallback(taskFeatures);
      }
    } else {
      modelScores = await this.modelFallback(taskFeatures);
    }

    modelScores.sort((a, b) => b.score - a.score);

    return {
      scores: {
        scores: modelScores,
        topModel: modelScores[0],
      },
      latencyMs: Date.now() - startTime,
      usedFallback: status.thermalState === 'cold',
      scorerVersion: status.version,
    };
  }

  private async modelFallback(taskFeatures: number[]): Promise<Array<{ modelId: string; score: number }>> {
    // Get available models and score based on proficiency match
    const result = await executeStatement(
      `SELECT model_id, provider, capabilities, is_available
       FROM ai_models WHERE is_available = true AND is_deprecated = false
       LIMIT 50`,
      []
    );

    return result.rows.map(row => {
      const r = row as Record<string, unknown>;
      const capabilities = r.capabilities as Record<string, number> || {};
      
      // Simple heuristic: match task features to model capabilities
      const score = Object.values(capabilities).reduce((sum, v) => sum + (v || 0), 0) / 7;
      
      return {
        modelId: String(r.model_id),
        score: Math.min(1, Math.max(0, score)),
      };
    });
  }

  // ===========================================================================
  // [AXIOM:SCORER] Topology Scorer - Evaluate orchestration strategies
  // ===========================================================================

  async scoreTopologies(taskFeatures: number[]): Promise<InferenceResult<TopologyScores>> {
    await this.initialize();
    const startTime = Date.now();
    const status = this.scorerStatus.get('topology')!;

    let modeScores: Array<{ mode: string; score: number }>;

    if (status.thermalState !== 'cold' && status.sagemakerEndpoint) {
      try {
        const scores = await this.invokeSageMaker(status.sagemakerEndpoint, taskFeatures.slice(0, 512));
        modeScores = ORCHESTRATION_MODES.map((mode, i) => ({
          mode,
          score: scores[i] || 0,
        }));
      } catch {
        modeScores = this.topologyFallback(taskFeatures);
      }
    } else {
      modeScores = this.topologyFallback(taskFeatures);
    }

    modeScores.sort((a, b) => b.score - a.score);
    const topMode = modeScores[0];

    return {
      scores: {
        mode: topMode.mode,
        confidence: topMode.score,
        allModes: modeScores,
      },
      latencyMs: Date.now() - startTime,
      usedFallback: status.thermalState === 'cold',
      scorerVersion: status.version,
    };
  }

  private topologyFallback(taskFeatures: number[]): Array<{ mode: string; score: number }> {
    // Heuristic based on task complexity indicators
    // taskFeatures assumed to encode: [complexity, length, requiresReasoning, requiresCoding, ...]
    const complexity = taskFeatures[0] || 0.5;
    const requiresReasoning = taskFeatures[2] || 0;
    const requiresCoding = taskFeatures[3] || 0;
    const requiresCreativity = taskFeatures[4] || 0;
    const requiresResearch = taskFeatures[5] || 0;

    return [
      { mode: 'thinking', score: 0.7 - complexity * 0.3 },
      { mode: 'extended_thinking', score: 0.3 + complexity * 0.5 + requiresReasoning * 0.2 },
      { mode: 'coding', score: 0.2 + requiresCoding * 0.7 },
      { mode: 'creative', score: 0.2 + requiresCreativity * 0.7 },
      { mode: 'research', score: 0.2 + requiresResearch * 0.7 },
      { mode: 'analysis', score: 0.3 + complexity * 0.3 },
      { mode: 'multi_model', score: complexity > 0.7 ? 0.5 : 0.1 },
      { mode: 'chain_of_thought', score: 0.2 + requiresReasoning * 0.5 },
      { mode: 'self_consistency', score: complexity > 0.8 ? 0.4 : 0.1 },
    ];
  }

  // ===========================================================================
  // [AXIOM:SCORER] Combination Scorer - Score model pairs
  // ===========================================================================

  async scoreCombinations(
    taskFeatures: number[],
    modelPairs: Array<[string, string]>
  ): Promise<InferenceResult<CombinationScore[]>> {
    await this.initialize();
    const startTime = Date.now();
    const status = this.scorerStatus.get('combination')!;

    const scores: CombinationScore[] = [];

    for (const pair of modelPairs) {
      let score: number;
      let synergy: number;

      if (status.thermalState !== 'cold' && status.sagemakerEndpoint) {
        try {
          // Build input: task (256) + model1 features (192) + model2 features (192) = 640
          const pairFeatures = await this.getModelPairFeatures(pair);
          const input = [...taskFeatures.slice(0, 256), ...pairFeatures];
          const result = await this.invokeSageMaker(status.sagemakerEndpoint, input);
          score = result[0];
          synergy = result[1] || 0;
        } catch {
          const fallback = await this.combinationFallback(pair);
          score = fallback.score;
          synergy = fallback.synergy;
        }
      } else {
        const fallback = await this.combinationFallback(pair);
        score = fallback.score;
        synergy = fallback.synergy;
      }

      scores.push({ modelPair: pair, score, synergy });
    }

    scores.sort((a, b) => b.score - a.score);

    return {
      scores,
      latencyMs: Date.now() - startTime,
      usedFallback: status.thermalState === 'cold',
      scorerVersion: status.version,
    };
  }

  private async combinationFallback(pair: [string, string]): Promise<{ score: number; synergy: number }> {
    // Heuristic: Different providers tend to have better synergy
    const [model1, model2] = pair;
    const provider1 = model1.split('/')[0];
    const provider2 = model2.split('/')[0];
    
    const diversityBonus = provider1 !== provider2 ? 0.15 : 0;
    const baseScore = 0.5;
    
    return {
      score: baseScore + diversityBonus,
      synergy: diversityBonus > 0 ? 0.6 : 0.3,
    };
  }

  private async getModelPairFeatures(pair: [string, string]): Promise<number[]> {
    // Get model capability vectors and concatenate
    const features: number[] = new Array(384).fill(0);
    // In production, this would fetch actual model embeddings
    return features;
  }

  // ===========================================================================
  // [AXIOM:SCORER] Variant Scorer - Score prompt variants
  // ===========================================================================

  async scoreVariants(
    promptEmbedding: number[],
    modelId: string,
    variants: Array<{ variantId: string; embedding: number[] }>
  ): Promise<InferenceResult<Array<{ variantId: string; score: number }>>> {
    await this.initialize();
    const startTime = Date.now();
    const status = this.scorerStatus.get('variant')!;

    const scores: Array<{ variantId: string; score: number }> = [];

    for (const variant of variants) {
      let score: number;

      if (status.thermalState !== 'cold' && status.sagemakerEndpoint) {
        try {
          const input = [...promptEmbedding.slice(0, 768), ...variant.embedding.slice(0, 768)];
          const result = await this.invokeSageMaker(status.sagemakerEndpoint, input);
          score = result[0];
        } catch {
          score = this.variantFallback(modelId, variant.variantId);
        }
      } else {
        score = this.variantFallback(modelId, variant.variantId);
      }

      scores.push({ variantId: variant.variantId, score });
    }

    scores.sort((a, b) => b.score - a.score);

    return {
      scores,
      latencyMs: Date.now() - startTime,
      usedFallback: status.thermalState === 'cold',
      scorerVersion: status.version,
    };
  }

  private variantFallback(modelId: string, variantId: string): number {
    // Heuristic: Match variant style to model preferences
    const provider = modelId.split('/')[0].toLowerCase();
    const variantStyle = variantId.toLowerCase();

    // Claude prefers XML, GPT prefers Markdown
    if (provider.includes('anthropic') && variantStyle.includes('xml')) return 0.9;
    if (provider.includes('openai') && variantStyle.includes('markdown')) return 0.9;
    if (provider.includes('google') && variantStyle.includes('structured')) return 0.85;

    return 0.5;
  }

  // ===========================================================================
  // [AXIOM:SCORER] User Scorer - Personalization
  // ===========================================================================

  async applyUserPersonalization(
    baseScores: number[],
    ghostVector: number[]
  ): Promise<InferenceResult<number[]>> {
    await this.initialize();
    const startTime = Date.now();
    const status = this.scorerStatus.get('user')!;

    let adjustedScores: number[];

    if (status.thermalState !== 'cold' && status.sagemakerEndpoint) {
      try {
        const adjustments = await this.invokeSageMaker(status.sagemakerEndpoint, ghostVector.slice(0, 128));
        adjustedScores = baseScores.map((score, i) => {
          const adjustment = adjustments[i % adjustments.length] || 1;
          return score * (0.5 + adjustment); // Maps to 0.5x - 1.5x multiplier
        });
      } catch {
        adjustedScores = this.userFallback(baseScores, ghostVector);
      }
    } else {
      adjustedScores = this.userFallback(baseScores, ghostVector);
    }

    return {
      scores: adjustedScores,
      latencyMs: Date.now() - startTime,
      usedFallback: status.thermalState === 'cold',
      scorerVersion: status.version,
    };
  }

  private userFallback(baseScores: number[], ghostVector: number[]): number[] {
    // Simple fallback: minor adjustments based on ghost vector magnitude
    const magnitude = Math.sqrt(ghostVector.reduce((sum, v) => sum + v * v, 0)) / ghostVector.length;
    const adjustment = 0.9 + magnitude * 0.2; // 0.9x - 1.1x range
    
    return baseScores.map(score => score * adjustment);
  }

  // ===========================================================================
  // Thermal State Management
  // ===========================================================================

  async warmUpNetwork(networkId: AxiomScorerId): Promise<void> {
    const status = this.scorerStatus.get(networkId);
    if (!status) return;

    status.thermalState = 'warm';
    
    await executeStatement(
      `UPDATE axiom_network_status 
       SET thermal_state = 'warm', warmed_at = NOW()
       WHERE network_id = $1`,
      [stringParam('networkId', networkId)]
    );

    logger.info('[AXIOM:NEURAL] Network warmed up', { networkId });
  }

  async coolDownNetwork(networkId: AxiomScorerId): Promise<void> {
    const status = this.scorerStatus.get(networkId);
    if (!status) return;

    status.thermalState = 'cold';
    
    await executeStatement(
      `UPDATE axiom_network_status 
       SET thermal_state = 'cold'
       WHERE network_id = $1`,
      [stringParam('networkId', networkId)]
    );

    logger.info('[AXIOM:NEURAL] Network cooled down', { networkId });
  }

  async getScorerStatuses(): Promise<ScorerStatus[]> {
    await this.initialize();
    return [...this.scorerStatus.values()];
  }

  // ===========================================================================
  // Infrastructure Helpers
  // ===========================================================================

  private async invokeSageMaker(endpointName: string, input: number[]): Promise<number[]> {
    const command = new InvokeEndpointCommand({
      EndpointName: endpointName,
      ContentType: 'application/json',
      Body: JSON.stringify({ inputs: input }),
    });

    const response = await this.sagemaker.send(command);
    const body = new TextDecoder().decode(response.Body);
    const result = JSON.parse(body);
    
    return Array.isArray(result) ? result : result.outputs || [result];
  }

  private parseDomainScores(scores: number[]): DomainClassification {
    // Map scores to domain IDs (requires domain index mapping)
    // Simplified: return top domain
    const maxIndex = scores.indexOf(Math.max(...scores));
    return {
      domainId: `domain_${maxIndex}`,
      confidence: scores[maxIndex],
      topDomains: scores
        .map((score, i) => ({ domainId: `domain_${i}`, score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10),
    };
  }

  private async parseModelScores(scores: number[]): Promise<Array<{ modelId: string; score: number }>> {
    // Get model ID mapping
    const result = await executeStatement(
      `SELECT model_id FROM ai_models WHERE is_available = true ORDER BY created_at LIMIT 106`,
      []
    );

    return result.rows.map((row, i) => ({
      modelId: String((row as Record<string, unknown>).model_id),
      score: scores[i] || 0,
    }));
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const minLen = Math.min(a.length, b.length);
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < minLen; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }
}

// Singleton export
export const axiomNeuralCortexService = new AxiomNeuralCortexService();
export { AxiomNeuralCortexService };
