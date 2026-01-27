/**
 * RADIANT v5.33.0 - Abstention Detection Service
 * 
 * Detects when AI models should abstain from answering due to uncertainty.
 * Uses output-based methods for external models (OpenAI, Anthropic, etc.)
 * and reserves architecture for linear probes on self-hosted models.
 * 
 * Detection Methods:
 * 1. Calibrated confidence prompting - Ask model to rate confidence
 * 2. Self-consistency sampling - Sample N responses, measure agreement
 * 3. Semantic entropy - Cluster outputs, high entropy = uncertain
 * 4. Refusal pattern detection - Detect hedging language
 * 
 * FUTURE: Linear probes for self-hosted models (requires inference wrapper integration)
 */

import { executeStatement, stringParam, doubleParam, longParam } from '../../db/client';
import { logger } from '../../utils/logger';

// Using enhanced logger from utils

// ============================================================================
// TYPES
// ============================================================================

export type AbstentionReason =
  | 'low_confidence'
  | 'high_semantic_entropy'
  | 'self_consistency_fail'
  | 'missing_information'
  | 'out_of_scope'
  | 'false_premise'
  | 'phi_detected';

export interface AbstentionConfig {
  confidenceThreshold: number;
  semanticEntropyThreshold: number;
  selfConsistencySamples: number;
  selfConsistencyThreshold: number;
  enableConfidencePrompting: boolean;
  enableSelfConsistency: boolean;
  enableSemanticEntropy: boolean;
  enableRefusalDetection: boolean;
  enableLinearProbe: boolean;
  onAbstentionAction: 'escalate' | 'ask_user' | 'use_default';
  escalationQueueId?: string;
}

export interface AbstentionResult {
  shouldAbstain: boolean;
  reason?: AbstentionReason;
  confidenceScore?: number;
  semanticEntropyScore?: number;
  selfConsistencyAgreement?: number;
  linearProbeScore?: number;
  samples?: string[];
  recommendedAction: 'proceed' | 'escalate' | 'ask_user' | 'use_default';
  explanation: string;
}

export interface ModelResponse {
  content: string;
  modelId: string;
  modelProvider: 'openai' | 'anthropic' | 'google' | 'self_hosted' | 'other';
  promptHash?: string;
  inputTokens?: number;
}

export interface ConfidencePromptResult {
  originalResponse: string;
  confidence: number;
  reasoning?: string;
}

// ============================================================================
// REFUSAL PATTERNS
// ============================================================================

const HEDGING_PATTERNS = [
  /i('m| am) not (entirely |completely )?sure/i,
  /i('m| am) uncertain/i,
  /i don't (really )?know/i,
  /i cannot (definitively |confidently )?answer/i,
  /it's (hard|difficult) to (say|determine)/i,
  /i would need more (information|context|details)/i,
  /this is (just )?(a|my) (guess|speculation)/i,
  /i'm (just )?guessing/i,
  /there (isn't|is not) enough (information|context)/i,
  /i can't be (certain|sure)/i,
  /it('s| is) unclear/i,
  /i (might|may|could) be wrong/i,
  /take this with a grain of salt/i,
  /this is outside my (expertise|knowledge)/i,
  /i('m| am) not (the best|qualified)/i,
];

const OUT_OF_SCOPE_PATTERNS = [
  /i('m| am) (just )?an ai/i,
  /as an ai( language model)?/i,
  /i don't have (access to|the ability)/i,
  /i cannot (access|browse|search)/i,
  /my (knowledge|training) (cutoff|ends)/i,
  /i('m| am) not able to/i,
  /this (requires|needs) (a |professional )?human/i,
];

const MISSING_INFO_PATTERNS = [
  /could you (please )?(provide|clarify|specify)/i,
  /what (exactly |specifically )?do you mean/i,
  /can you (give|provide) (me )?(more )?(details|information|context)/i,
  /i need (more|additional) (information|context)/i,
  /please (specify|clarify)/i,
  /which (one|option) (do you|would you)/i,
  /to (better )?answer (this|your question)/i,
];

// ============================================================================
// CONFIDENCE PROMPTING
// ============================================================================

export function createConfidencePrompt(originalPrompt: string): string {
  return `${originalPrompt}

After your response, on a new line, provide a confidence assessment in exactly this format:
CONFIDENCE: [0-100]
REASONING: [brief explanation of your confidence level]

Where 100 means you are absolutely certain and 0 means you are completely uncertain.
Consider: Do you have sufficient information? Are there multiple valid interpretations?
Could you be missing context? Is this within your training data?`;
}

export function parseConfidenceResponse(response: string): ConfidencePromptResult {
  const lines = response.split('\n');
  let confidence = 50; // Default if not found
  let reasoning: string | undefined;
  let originalResponse = response;

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    
    if (line.startsWith('CONFIDENCE:')) {
      const match = line.match(/CONFIDENCE:\s*(\d+)/i);
      if (match) {
        confidence = Math.min(100, Math.max(0, parseInt(match[1], 10)));
        originalResponse = lines.slice(0, i).join('\n').trim();
      }
    }
    
    if (line.startsWith('REASONING:')) {
      reasoning = line.replace(/^REASONING:\s*/i, '').trim();
    }
  }

  return { originalResponse, confidence, reasoning };
}

// ============================================================================
// SELF-CONSISTENCY
// ============================================================================

function calculateLevenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function normalizedSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = calculateLevenshteinDistance(a.toLowerCase(), b.toLowerCase());
  return 1 - distance / maxLen;
}

export function calculateSelfConsistency(samples: string[]): number {
  if (samples.length < 2) return 1;

  let totalSimilarity = 0;
  let comparisons = 0;

  for (let i = 0; i < samples.length; i++) {
    for (let j = i + 1; j < samples.length; j++) {
      totalSimilarity += normalizedSimilarity(samples[i], samples[j]);
      comparisons++;
    }
  }

  return comparisons > 0 ? totalSimilarity / comparisons : 1;
}

// ============================================================================
// SEMANTIC ENTROPY
// ============================================================================

function extractKeyPhrases(text: string): string[] {
  // Simple extraction: split by sentences and common delimiters
  const phrases = text
    .split(/[.!?;:\n]/)
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 10);
  return phrases;
}

function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size > 0 ? intersection.size / union.size : 1;
}

export function calculateSemanticEntropy(samples: string[]): number {
  if (samples.length < 2) return 0;

  // Extract key phrases from each sample
  const phraseSets = samples.map(extractKeyPhrases);

  // Calculate pairwise similarities
  let totalSimilarity = 0;
  let comparisons = 0;

  for (let i = 0; i < phraseSets.length; i++) {
    for (let j = i + 1; j < phraseSets.length; j++) {
      totalSimilarity += jaccardSimilarity(phraseSets[i], phraseSets[j]);
      comparisons++;
    }
  }

  const avgSimilarity = comparisons > 0 ? totalSimilarity / comparisons : 1;
  
  // Entropy is inverse of similarity (0 = all same, 1 = all different)
  return 1 - avgSimilarity;
}

// ============================================================================
// REFUSAL DETECTION
// ============================================================================

export function detectRefusalPatterns(response: string): {
  isRefusal: boolean;
  reason?: AbstentionReason;
  matchedPatterns: string[];
} {
  const matchedPatterns: string[] = [];
  let reason: AbstentionReason | undefined;

  for (const pattern of OUT_OF_SCOPE_PATTERNS) {
    if (pattern.test(response)) {
      matchedPatterns.push(pattern.toString());
      reason = 'out_of_scope';
    }
  }

  for (const pattern of MISSING_INFO_PATTERNS) {
    if (pattern.test(response)) {
      matchedPatterns.push(pattern.toString());
      reason = reason || 'missing_information';
    }
  }

  for (const pattern of HEDGING_PATTERNS) {
    if (pattern.test(response)) {
      matchedPatterns.push(pattern.toString());
      reason = reason || 'low_confidence';
    }
  }

  return {
    isRefusal: matchedPatterns.length > 0,
    reason,
    matchedPatterns,
  };
}

// ============================================================================
// MAIN ABSTENTION CHECK
// ============================================================================

async function checkAbstention(
  tenantId: string,
  response: ModelResponse,
  samples: string[] = [],
  config?: Partial<AbstentionConfig>
): Promise<AbstentionResult> {
  // Get tenant config
  const fullConfig = await getAbstentionConfig(tenantId, config);
  
  const result: AbstentionResult = {
    shouldAbstain: false,
    recommendedAction: 'proceed',
    explanation: '',
    samples,
  };

  const checks: string[] = [];

  // 1. Refusal pattern detection
  if (fullConfig.enableRefusalDetection) {
    const refusal = detectRefusalPatterns(response.content);
    if (refusal.isRefusal) {
      result.shouldAbstain = true;
      result.reason = refusal.reason;
      checks.push(`Refusal detected: ${refusal.matchedPatterns.length} patterns matched`);
    }
  }

  // 2. Confidence prompting (if response includes confidence)
  if (fullConfig.enableConfidencePrompting) {
    const parsed = parseConfidenceResponse(response.content);
    result.confidenceScore = parsed.confidence / 100;
    
    if (result.confidenceScore < fullConfig.confidenceThreshold) {
      result.shouldAbstain = true;
      result.reason = result.reason || 'low_confidence';
      checks.push(`Low confidence: ${parsed.confidence}% < ${fullConfig.confidenceThreshold * 100}%`);
    }
  }

  // 3. Self-consistency (requires multiple samples)
  if (fullConfig.enableSelfConsistency && samples.length >= fullConfig.selfConsistencySamples) {
    result.selfConsistencyAgreement = calculateSelfConsistency(samples);
    
    if (result.selfConsistencyAgreement < fullConfig.selfConsistencyThreshold) {
      result.shouldAbstain = true;
      result.reason = result.reason || 'self_consistency_fail';
      checks.push(
        `Self-consistency fail: ${(result.selfConsistencyAgreement * 100).toFixed(1)}% < ` +
        `${fullConfig.selfConsistencyThreshold * 100}%`
      );
    }
  }

  // 4. Semantic entropy
  if (fullConfig.enableSemanticEntropy && samples.length >= 2) {
    result.semanticEntropyScore = calculateSemanticEntropy(samples);
    
    if (result.semanticEntropyScore > fullConfig.semanticEntropyThreshold) {
      result.shouldAbstain = true;
      result.reason = result.reason || 'high_semantic_entropy';
      checks.push(
        `High semantic entropy: ${(result.semanticEntropyScore * 100).toFixed(1)}% > ` +
        `${fullConfig.semanticEntropyThreshold * 100}%`
      );
    }
  }

  // 5. Linear probe (self-hosted only)
  if (fullConfig.enableLinearProbe && response.modelProvider === 'self_hosted') {
    try {
      const probeResult = await evaluateLinearProbe(tenantId, response);
      if (probeResult) {
        result.linearProbeScore = probeResult.uncertaintyScore;
        
        // Linear probe threshold is typically 0.5 (above = uncertain)
        const probeThreshold = 0.5;
        if (probeResult.uncertaintyScore > probeThreshold) {
          result.shouldAbstain = true;
          result.reason = result.reason || 'low_confidence';
          checks.push(
            `Linear probe uncertainty: ${(probeResult.uncertaintyScore * 100).toFixed(1)}% > ${probeThreshold * 100}%`
          );
        }
      }
    } catch (error) {
      logger.warn('Linear probe evaluation failed, continuing without probe score', {
        modelId: response.modelId,
        error: (error as Error).message,
      });
    }
  }

  // Determine action
  if (result.shouldAbstain) {
    result.recommendedAction = fullConfig.onAbstentionAction;
    result.explanation = `Model should abstain. Checks: ${checks.join('; ')}`;
  } else {
    result.explanation = 'All checks passed. Model response is confident.';
  }

  // Log abstention event if abstaining
  if (result.shouldAbstain) {
    await logAbstentionEvent(tenantId, response, result);
  }

  return result;
}

// ============================================================================
// LINEAR PROBE EVALUATION
// ============================================================================

interface LinearProbeResult {
  uncertaintyScore: number;
  hiddenStateLayer: number;
  probeModelId: string;
  evaluatedAt: Date;
}

/**
 * Evaluate uncertainty using a linear probe on self-hosted model hidden states.
 * 
 * Linear probes work by:
 * 1. Extracting hidden states from a specific layer of the transformer model
 * 2. Passing those hidden states through a trained linear classifier
 * 3. The classifier predicts whether the model is "certain" or "uncertain"
 * 
 * This requires the self-hosted inference endpoint to expose hidden states.
 */
async function evaluateLinearProbe(
  tenantId: string,
  response: ModelResponse
): Promise<LinearProbeResult | null> {
  // Get the linear probe endpoint for this model
  const probeConfig = await getLinearProbeConfig(tenantId, response.modelId);
  if (!probeConfig) {
    logger.info('No linear probe configured for model', { modelId: response.modelId });
    return null;
  }

  const inferenceEndpoint = process.env.SELF_HOSTED_INFERENCE_ENDPOINT;
  if (!inferenceEndpoint) {
    logger.warn('SELF_HOSTED_INFERENCE_ENDPOINT not configured');
    return null;
  }

  try {
    // Request hidden states from the inference endpoint
    // This assumes the self-hosted model endpoint supports hidden state extraction
    const hiddenStatesResponse = await fetch(`${inferenceEndpoint}/v1/hidden-states`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SELF_HOSTED_API_KEY || ''}`,
        'X-Tenant-ID': tenantId,
      },
      body: JSON.stringify({
        model: response.modelId,
        text: response.content,
        layer: probeConfig.targetLayer,
        pooling: probeConfig.poolingStrategy || 'last_token',
      }),
    });

    if (!hiddenStatesResponse.ok) {
      throw new Error(`Hidden states API returned ${hiddenStatesResponse.status}`);
    }

    const hiddenStates = await hiddenStatesResponse.json() as {
      hidden_state: number[];
      layer: number;
      dimensions: number;
    };

    // Now evaluate the hidden states with the linear probe
    const probeResponse = await fetch(`${probeConfig.probeEndpoint}/evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${probeConfig.probeApiKey || ''}`,
      },
      body: JSON.stringify({
        hidden_state: hiddenStates.hidden_state,
        probe_model_id: probeConfig.probeModelId,
      }),
    });

    if (!probeResponse.ok) {
      throw new Error(`Probe evaluation returned ${probeResponse.status}`);
    }

    const probeResult = await probeResponse.json() as {
      uncertainty_score: number;
      confidence: number;
    };

    logger.info('Linear probe evaluation complete', {
      tenantId,
      modelId: response.modelId,
      uncertaintyScore: probeResult.uncertainty_score,
      layer: hiddenStates.layer,
    });

    return {
      uncertaintyScore: probeResult.uncertainty_score,
      hiddenStateLayer: hiddenStates.layer,
      probeModelId: probeConfig.probeModelId,
      evaluatedAt: new Date(),
    };
  } catch (error) {
    logger.error('Linear probe evaluation failed', {
      tenantId,
      modelId: response.modelId,
      error: (error as Error).message,
    });
    throw error;
  }
}

interface LinearProbeConfig {
  probeModelId: string;
  probeEndpoint: string;
  probeApiKey?: string;
  targetLayer: number;
  poolingStrategy: 'last_token' | 'mean' | 'max';
}

async function getLinearProbeConfig(
  tenantId: string,
  modelId: string
): Promise<LinearProbeConfig | null> {
  try {
    const result = await executeStatement({
      sql: `
        SELECT probe_model_id, probe_endpoint, probe_api_key, target_layer, pooling_strategy
        FROM hitl_linear_probe_config
        WHERE tenant_id = :tenantId AND model_id = :modelId AND is_active = true
      `,
      parameters: [
        stringParam('tenantId', tenantId),
        stringParam('modelId', modelId),
      ],
    });

    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0];
      return {
        probeModelId: row.probe_model_id as string,
        probeEndpoint: row.probe_endpoint as string,
        probeApiKey: row.probe_api_key as string | undefined,
        targetLayer: (row.target_layer as number) || -1,
        poolingStrategy: (row.pooling_strategy as LinearProbeConfig['poolingStrategy']) || 'last_token',
      };
    }
  } catch (error) {
    logger.warn('Failed to get linear probe config', { tenantId, modelId, error });
  }

  return null;
}

// ============================================================================
// CONFIG MANAGEMENT
// ============================================================================

const DEFAULT_CONFIG: AbstentionConfig = {
  confidenceThreshold: 0.7,
  semanticEntropyThreshold: 0.8,
  selfConsistencySamples: 5,
  selfConsistencyThreshold: 0.7,
  enableConfidencePrompting: true,
  enableSelfConsistency: true,
  enableSemanticEntropy: true,
  enableRefusalDetection: true,
  enableLinearProbe: false,
  onAbstentionAction: 'escalate',
};

async function getAbstentionConfig(
  tenantId: string,
  overrides?: Partial<AbstentionConfig>
): Promise<AbstentionConfig> {
  try {
    const result = await executeStatement({
      sql: `SELECT * FROM hitl_abstention_config WHERE tenant_id = :tenantId AND is_active = true`,
      parameters: [stringParam('tenantId', tenantId)],
    });

    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0];
      return {
        confidenceThreshold: (row.confidence_threshold as number) ?? DEFAULT_CONFIG.confidenceThreshold,
        semanticEntropyThreshold: (row.semantic_entropy_threshold as number) ?? DEFAULT_CONFIG.semanticEntropyThreshold,
        selfConsistencySamples: (row.self_consistency_samples as number) ?? DEFAULT_CONFIG.selfConsistencySamples,
        selfConsistencyThreshold: (row.self_consistency_threshold as number) ?? DEFAULT_CONFIG.selfConsistencyThreshold,
        enableConfidencePrompting: row.enable_confidence_prompting as boolean ?? DEFAULT_CONFIG.enableConfidencePrompting,
        enableSelfConsistency: row.enable_self_consistency as boolean ?? DEFAULT_CONFIG.enableSelfConsistency,
        enableSemanticEntropy: row.enable_semantic_entropy as boolean ?? DEFAULT_CONFIG.enableSemanticEntropy,
        enableRefusalDetection: row.enable_refusal_detection as boolean ?? DEFAULT_CONFIG.enableRefusalDetection,
        enableLinearProbe: row.enable_linear_probe as boolean ?? DEFAULT_CONFIG.enableLinearProbe,
        onAbstentionAction: row.on_abstention_action as AbstentionConfig['onAbstentionAction'] ?? DEFAULT_CONFIG.onAbstentionAction,
        escalationQueueId: row.escalation_queue_id as string | undefined,
        ...overrides,
      };
    }
  } catch (error) {
    logger.warn('Failed to get abstention config, using defaults', { tenantId, error });
  }

  return { ...DEFAULT_CONFIG, ...overrides };
}

async function updateAbstentionConfig(
  tenantId: string,
  config: Partial<AbstentionConfig>
): Promise<void> {
  await executeStatement({
    sql: `
      INSERT INTO hitl_abstention_config (
        tenant_id, confidence_threshold, semantic_entropy_threshold,
        self_consistency_samples, self_consistency_threshold,
        enable_confidence_prompting, enable_self_consistency,
        enable_semantic_entropy, enable_refusal_detection,
        enable_linear_probe, on_abstention_action, escalation_queue_id
      ) VALUES (
        :tenantId, :confidenceThreshold, :semanticEntropyThreshold,
        :selfConsistencySamples, :selfConsistencyThreshold,
        :enableConfidencePrompting, :enableSelfConsistency,
        :enableSemanticEntropy, :enableRefusalDetection,
        :enableLinearProbe, :onAbstentionAction, :escalationQueueId
      )
      ON CONFLICT (tenant_id) DO UPDATE SET
        confidence_threshold = EXCLUDED.confidence_threshold,
        semantic_entropy_threshold = EXCLUDED.semantic_entropy_threshold,
        self_consistency_samples = EXCLUDED.self_consistency_samples,
        self_consistency_threshold = EXCLUDED.self_consistency_threshold,
        enable_confidence_prompting = EXCLUDED.enable_confidence_prompting,
        enable_self_consistency = EXCLUDED.enable_self_consistency,
        enable_semantic_entropy = EXCLUDED.enable_semantic_entropy,
        enable_refusal_detection = EXCLUDED.enable_refusal_detection,
        enable_linear_probe = EXCLUDED.enable_linear_probe,
        on_abstention_action = EXCLUDED.on_abstention_action,
        escalation_queue_id = EXCLUDED.escalation_queue_id,
        updated_at = NOW()
    `,
    parameters: [
      stringParam('tenantId', tenantId),
      doubleParam('confidenceThreshold', config.confidenceThreshold ?? DEFAULT_CONFIG.confidenceThreshold),
      doubleParam('semanticEntropyThreshold', config.semanticEntropyThreshold ?? DEFAULT_CONFIG.semanticEntropyThreshold),
      longParam('selfConsistencySamples', config.selfConsistencySamples ?? DEFAULT_CONFIG.selfConsistencySamples),
      doubleParam('selfConsistencyThreshold', config.selfConsistencyThreshold ?? DEFAULT_CONFIG.selfConsistencyThreshold),
      stringParam('enableConfidencePrompting', String(config.enableConfidencePrompting ?? DEFAULT_CONFIG.enableConfidencePrompting)),
      stringParam('enableSelfConsistency', String(config.enableSelfConsistency ?? DEFAULT_CONFIG.enableSelfConsistency)),
      stringParam('enableSemanticEntropy', String(config.enableSemanticEntropy ?? DEFAULT_CONFIG.enableSemanticEntropy)),
      stringParam('enableRefusalDetection', String(config.enableRefusalDetection ?? DEFAULT_CONFIG.enableRefusalDetection)),
      stringParam('enableLinearProbe', String(config.enableLinearProbe ?? DEFAULT_CONFIG.enableLinearProbe)),
      stringParam('onAbstentionAction', config.onAbstentionAction ?? DEFAULT_CONFIG.onAbstentionAction),
      stringParam('escalationQueueId', config.escalationQueueId ?? ''),
    ],
  });
}

// ============================================================================
// LOGGING
// ============================================================================

async function logAbstentionEvent(
  tenantId: string,
  response: ModelResponse,
  result: AbstentionResult
): Promise<void> {
  const detectionMethod = result.reason === 'low_confidence' ? 'confidence' :
    result.reason === 'self_consistency_fail' ? 'self_consistency' :
    result.reason === 'high_semantic_entropy' ? 'semantic_entropy' : 'refusal_detection';

  await executeStatement({
    sql: `
      INSERT INTO hitl_abstention_events (
        tenant_id, model_id, model_provider, detection_method, reason,
        confidence_score, semantic_entropy_score, self_consistency_agreement,
        samples, prompt_hash, input_tokens, action_taken
      ) VALUES (
        :tenantId, :modelId, :modelProvider, :detectionMethod, :reason,
        :confidenceScore, :semanticEntropyScore, :selfConsistencyAgreement,
        :samples::jsonb, :promptHash, :inputTokens, :actionTaken
      )
    `,
    parameters: [
      stringParam('tenantId', tenantId),
      stringParam('modelId', response.modelId),
      stringParam('modelProvider', response.modelProvider),
      stringParam('detectionMethod', detectionMethod),
      stringParam('reason', result.reason || 'unknown'),
      doubleParam('confidenceScore', result.confidenceScore ?? 0),
      doubleParam('semanticEntropyScore', result.semanticEntropyScore ?? 0),
      doubleParam('selfConsistencyAgreement', result.selfConsistencyAgreement ?? 0),
      stringParam('samples', JSON.stringify(result.samples || [])),
      stringParam('promptHash', response.promptHash || ''),
      longParam('inputTokens', response.inputTokens || 0),
      stringParam('actionTaken', result.recommendedAction),
    ],
  });

  logger.info('Abstention event logged', {
    tenantId,
    modelId: response.modelId,
    reason: result.reason,
    action: result.recommendedAction,
  });
}

async function getAbstentionStatistics(tenantId: string): Promise<{
  totalEvents: number;
  byReason: Record<string, number>;
  byModel: Record<string, number>;
  avgConfidence: number;
  avgSemanticEntropy: number;
}> {
  const result = await executeStatement({
    sql: `
      SELECT 
        COUNT(*) as total,
        AVG(confidence_score) as avg_confidence,
        AVG(semantic_entropy_score) as avg_semantic_entropy
      FROM hitl_abstention_events
      WHERE tenant_id = :tenantId
        AND created_at > NOW() - INTERVAL '30 days'
    `,
    parameters: [stringParam('tenantId', tenantId)],
  });

  const reasonResult = await executeStatement({
    sql: `
      SELECT reason, COUNT(*) as count
      FROM hitl_abstention_events
      WHERE tenant_id = :tenantId
        AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY reason
    `,
    parameters: [stringParam('tenantId', tenantId)],
  });

  const modelResult = await executeStatement({
    sql: `
      SELECT model_id, COUNT(*) as count
      FROM hitl_abstention_events
      WHERE tenant_id = :tenantId
        AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY model_id
    `,
    parameters: [stringParam('tenantId', tenantId)],
  });

  const row = result.rows?.[0] || {};
  const byReason: Record<string, number> = {};
  const byModel: Record<string, number> = {};

  for (const r of reasonResult.rows || []) {
    byReason[r.reason as string] = Number(r.count);
  }

  for (const r of modelResult.rows || []) {
    byModel[r.model_id as string] = Number(r.count);
  }

  return {
    totalEvents: Number(row.total) || 0,
    byReason,
    byModel,
    avgConfidence: Number(row.avg_confidence) || 0,
    avgSemanticEntropy: Number(row.avg_semantic_entropy) || 0,
  };
}

export const abstentionService = {
  checkAbstention,
  getAbstentionConfig,
  updateAbstentionConfig,
  getAbstentionStatistics,
  createConfidencePrompt,
  parseConfidenceResponse,
  calculateSelfConsistency,
  calculateSemanticEntropy,
  detectRefusalPatterns,
  DEFAULT_CONFIG,
};
