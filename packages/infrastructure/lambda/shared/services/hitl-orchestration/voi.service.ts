/**
 * RADIANT v5.33.0 - SAGE-Agent Bayesian Value-of-Information Service
 * 
 * Implements the SAGE-Agent framework for intelligent question selection.
 * Uses Bayesian VOI to determine when asking a question is worth the user's time.
 * 
 * Key principles:
 * - Only ask when expected information gain exceeds ask cost
 * - Track aspect-based beliefs to avoid redundant questions
 * - Learn from outcomes to improve future decisions
 * 
 * References:
 * - SAGE-Agent: Task Coverage Improved by 7-39%
 * - Two-question rule: Max 2 clarifications, then proceed with assumptions
 */

import { executeStatement, stringParam, doubleParam } from '../../db/client';
import { logger } from '../../utils/logger';

// Using enhanced logger from utils

// ============================================================================
// TYPES
// ============================================================================

export interface Aspect {
  id: string;
  tenantId: string;
  workflowType: string | null;
  aspectName: string;
  aspectCategory: 'preference' | 'constraint' | 'requirement' | 'context';
  priorBelief: PriorBelief;
  decisionImpactWeight: number;
  errorCostWeight: number;
  askCount: number;
  usefulAnswerCount: number;
  avgInformationGain: number;
}

export interface PriorBelief {
  type: 'categorical' | 'continuous' | 'boolean' | 'unknown';
  distribution?: Record<string, number>; // For categorical: {option: probability}
  mean?: number; // For continuous
  variance?: number; // For continuous
  confidence: number; // 0-1, how confident in the prior
  source?: 'historical' | 'inferred' | 'default' | 'user_provided';
}

export interface VOIDecision {
  aspectId: string;
  priorEntropy: number;
  expectedPosteriorEntropy: number;
  expectedInformationGain: number;
  askCost: number;
  expectedDecisionImprovement: number;
  voiScore: number;
  askThreshold: number;
  decision: 'ask' | 'skip_with_default' | 'infer';
  reasoning: string;
}

export interface VOIRequest {
  tenantId: string;
  workflowType?: string;
  question: string;
  aspectName: string;
  aspectCategory: 'preference' | 'constraint' | 'requirement' | 'context';
  options?: string[];
  currentContext: Record<string, unknown>;
  urgency: 'blocking' | 'high' | 'normal' | 'low' | 'optional';
}

export interface VOIConfig {
  askThreshold: number; // VOI must exceed this to ask (default 0.3)
  maxQuestionsPerWorkflow: number; // Two-question rule (default 2)
  askCostBase: number; // Base cost of asking a question
  askCostUrgencyMultipliers: Record<string, number>;
  learningRate: number; // How fast to update beliefs (default 0.1)
}

const DEFAULT_CONFIG: VOIConfig = {
  askThreshold: 0.3,
  maxQuestionsPerWorkflow: 2,
  askCostBase: 0.2,
  askCostUrgencyMultipliers: {
    blocking: 0.5, // Cheaper to ask blocking questions
    high: 0.7,
    normal: 1.0,
    low: 1.5,
    optional: 2.0,
  },
  learningRate: 0.1,
};

// ============================================================================
// ENTROPY CALCULATIONS
// ============================================================================

function calculateCategoricalEntropy(distribution: Record<string, number>): number {
  const values = Object.values(distribution);
  const sum = values.reduce((a, b) => a + b, 0);
  if (sum === 0) return Math.log2(Object.keys(distribution).length); // Maximum entropy

  let entropy = 0;
  for (const p of values) {
    const normalized = p / sum;
    if (normalized > 0) {
      entropy -= normalized * Math.log2(normalized);
    }
  }
  return entropy;
}

function calculateContinuousEntropy(variance: number): number {
  // Differential entropy of Gaussian: 0.5 * log2(2 * pi * e * variance)
  if (variance <= 0) return 0;
  return 0.5 * Math.log2(2 * Math.PI * Math.E * variance);
}

function calculateBooleanEntropy(pTrue: number): number {
  if (pTrue <= 0 || pTrue >= 1) return 0;
  return -pTrue * Math.log2(pTrue) - (1 - pTrue) * Math.log2(1 - pTrue);
}

function calculatePriorEntropy(belief: PriorBelief): number {
  switch (belief.type) {
    case 'categorical':
      return belief.distribution 
        ? calculateCategoricalEntropy(belief.distribution)
        : 2.0; // Default entropy for unknown categorical
    case 'continuous':
      return calculateContinuousEntropy(belief.variance ?? 1.0);
    case 'boolean':
      return calculateBooleanEntropy(belief.mean ?? 0.5);
    case 'unknown':
    default:
      return 2.0; // High entropy for unknown
  }
}

function estimateExpectedPosteriorEntropy(
  priorBelief: PriorBelief,
  priorEntropy: number
): number {
  // After asking, we expect entropy to decrease
  // The reduction depends on how confident we are in the prior
  // If prior is already confident, asking adds little
  const confidenceFactor = 1 - priorBelief.confidence;
  
  // Expected reduction is proportional to current entropy and uncertainty
  const expectedReduction = priorEntropy * confidenceFactor * 0.7;
  
  return Math.max(0, priorEntropy - expectedReduction);
}

// ============================================================================
// VOI CALCULATION
// ============================================================================

function calculateVOI(
  aspect: Aspect,
  urgency: string,
  config: VOIConfig = DEFAULT_CONFIG
): VOIDecision {
  const priorBelief = aspect.priorBelief;
  
  // 1. Calculate prior entropy (uncertainty before asking)
  const priorEntropy = calculatePriorEntropy(priorBelief);
  
  // 2. Estimate expected posterior entropy (uncertainty after asking)
  const expectedPosteriorEntropy = estimateExpectedPosteriorEntropy(
    priorBelief,
    priorEntropy
  );
  
  // 3. Expected information gain = prior entropy - expected posterior entropy
  const expectedInformationGain = priorEntropy - expectedPosteriorEntropy;
  
  // 4. Calculate ask cost (adjusted by urgency)
  const urgencyMultiplier = config.askCostUrgencyMultipliers[urgency] ?? 1.0;
  const askCost = config.askCostBase * urgencyMultiplier;
  
  // 5. Calculate expected decision improvement
  // Combines information gain with impact weights
  const decisionImpact = expectedInformationGain * aspect.decisionImpactWeight;
  const errorCostAvoidance = expectedInformationGain * aspect.errorCostWeight;
  const expectedDecisionImprovement = (decisionImpact + errorCostAvoidance) / 2;
  
  // 6. VOI = Expected improvement - Ask cost
  // Also factor in historical usefulness
  const historicalFactor = aspect.askCount > 0
    ? aspect.usefulAnswerCount / aspect.askCount
    : 0.5; // Default 50% useful if no history
  
  const voiScore = (expectedDecisionImprovement * historicalFactor) - askCost;
  
  // 7. Make decision
  let decision: 'ask' | 'skip_with_default' | 'infer';
  let reasoning: string;
  
  if (voiScore >= config.askThreshold) {
    decision = 'ask';
    reasoning = `VOI score ${voiScore.toFixed(3)} exceeds threshold ${config.askThreshold}. ` +
      `Expected info gain: ${expectedInformationGain.toFixed(3)}, ` +
      `Historical usefulness: ${(historicalFactor * 100).toFixed(0)}%`;
  } else if (priorBelief.confidence >= 0.7) {
    decision = 'infer';
    reasoning = `Prior confidence ${(priorBelief.confidence * 100).toFixed(0)}% is high enough to infer. ` +
      `VOI ${voiScore.toFixed(3)} below threshold. Will use prior belief.`;
  } else {
    decision = 'skip_with_default';
    reasoning = `VOI ${voiScore.toFixed(3)} below threshold ${config.askThreshold}. ` +
      `Prior confidence ${(priorBelief.confidence * 100).toFixed(0)}% insufficient to infer. ` +
      `Will proceed with default and explicitly state assumption.`;
  }
  
  return {
    aspectId: aspect.id,
    priorEntropy,
    expectedPosteriorEntropy,
    expectedInformationGain,
    askCost,
    expectedDecisionImprovement,
    voiScore,
    askThreshold: config.askThreshold,
    decision,
    reasoning,
  };
}

// ============================================================================
// ASPECT MANAGEMENT
// ============================================================================

async function getOrCreateAspect(
  tenantId: string,
  workflowType: string | null,
  aspectName: string,
  aspectCategory: 'preference' | 'constraint' | 'requirement' | 'context',
  options?: string[]
): Promise<Aspect> {
  // Try to get existing aspect
  const existingResult = await executeStatement(
    `SELECT * FROM hitl_voi_aspects 
     WHERE tenant_id = :tenantId 
       AND (workflow_type = :workflowType OR (workflow_type IS NULL AND :workflowType IS NULL))
       AND aspect_name = :aspectName`,
    [
      stringParam('tenantId', tenantId),
      stringParam('workflowType', workflowType || ''),
      stringParam('aspectName', aspectName),
    ]
  );

  if (existingResult.rows && existingResult.rows.length > 0) {
    const row = existingResult.rows[0];
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      workflowType: row.workflow_type as string | null,
      aspectName: row.aspect_name as string,
      aspectCategory: row.aspect_category as Aspect['aspectCategory'],
      priorBelief: row.prior_belief as PriorBelief,
      decisionImpactWeight: row.decision_impact_weight as number,
      errorCostWeight: row.error_cost_weight as number,
      askCount: row.ask_count as number,
      usefulAnswerCount: row.useful_answer_count as number,
      avgInformationGain: row.avg_information_gain as number,
    };
  }

  // Create new aspect with default prior
  const defaultPrior: PriorBelief = options && options.length > 0
    ? {
        type: 'categorical',
        distribution: Object.fromEntries(options.map(o => [o, 1 / options.length])),
        confidence: 0.1,
        source: 'default',
      }
    : {
        type: 'unknown',
        confidence: 0.1,
        source: 'default',
      };

  const insertResult = await executeStatement(
    `INSERT INTO hitl_voi_aspects (
       tenant_id, workflow_type, aspect_name, aspect_category, prior_belief
     ) VALUES (
       :tenantId, :workflowType, :aspectName, :aspectCategory, :priorBelief::jsonb
     )
     RETURNING *`,
    [
      stringParam('tenantId', tenantId),
      stringParam('workflowType', workflowType || ''),
      stringParam('aspectName', aspectName),
      stringParam('aspectCategory', aspectCategory),
      stringParam('priorBelief', JSON.stringify(defaultPrior)),
    ]
  );

  const row = insertResult.rows![0];
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    workflowType: row.workflow_type as string | null,
    aspectName: row.aspect_name as string,
    aspectCategory: row.aspect_category as Aspect['aspectCategory'],
    priorBelief: defaultPrior,
    decisionImpactWeight: 0.5,
    errorCostWeight: 0.5,
    askCount: 0,
    usefulAnswerCount: 0,
    avgInformationGain: 0.5,
  };
}

async function updateAspectFromOutcome(
  aspectId: string,
  actualAnswer: unknown,
  answerMatchedPrior: boolean,
  actualInfoGain: number,
  config: VOIConfig = DEFAULT_CONFIG
): Promise<void> {
  // Update running averages and counts
  await executeStatement(
    `UPDATE hitl_voi_aspects SET
       ask_count = ask_count + 1,
       useful_answer_count = useful_answer_count + CASE WHEN :wasUseful THEN 1 ELSE 0 END,
       avg_information_gain = avg_information_gain * (1 - :learningRate) + :actualInfoGain * :learningRate,
       updated_at = NOW()
     WHERE id = :aspectId`,
    [
      stringParam('aspectId', aspectId),
      stringParam('wasUseful', (!answerMatchedPrior).toString()),
      doubleParam('learningRate', config.learningRate),
      doubleParam('actualInfoGain', actualInfoGain),
    ]
  );

  logger.info('Updated aspect from outcome', {
    aspectId,
    answerMatchedPrior,
    actualInfoGain,
  });
}

// ============================================================================
// DECISION RECORDING
// ============================================================================

async function recordVOIDecision(
  requestId: string,
  decision: VOIDecision
): Promise<void> {
  await executeStatement(
    `INSERT INTO hitl_voi_decisions (
       request_id, aspect_id, prior_entropy, expected_posterior_entropy,
       expected_information_gain, ask_cost, expected_decision_improvement,
       voi_score, ask_threshold, decision
     ) VALUES (
       :requestId, :aspectId, :priorEntropy, :expectedPosteriorEntropy,
       :expectedInfoGain, :askCost, :expectedImprovement,
       :voiScore, :askThreshold, :decision
     )`,
    [
      stringParam('requestId', requestId),
      stringParam('aspectId', decision.aspectId),
      doubleParam('priorEntropy', decision.priorEntropy),
      doubleParam('expectedPosteriorEntropy', decision.expectedPosteriorEntropy),
      doubleParam('expectedInfoGain', decision.expectedInformationGain),
      doubleParam('askCost', decision.askCost),
      doubleParam('expectedImprovement', decision.expectedDecisionImprovement),
      doubleParam('voiScore', decision.voiScore),
      doubleParam('askThreshold', decision.askThreshold),
      stringParam('decision', decision.decision),
    ]
  );
}

// ============================================================================
// MAIN API
// ============================================================================

async function shouldAskQuestion(
  request: VOIRequest,
  questionsAskedInWorkflow: number = 0,
  config: VOIConfig = DEFAULT_CONFIG
): Promise<VOIDecision> {
  // Two-question rule enforcement
  if (questionsAskedInWorkflow >= config.maxQuestionsPerWorkflow) {
    logger.info('Two-question limit reached', {
      tenantId: request.tenantId,
      questionsAsked: questionsAskedInWorkflow,
      limit: config.maxQuestionsPerWorkflow,
    });
    
    return {
      aspectId: '',
      priorEntropy: 0,
      expectedPosteriorEntropy: 0,
      expectedInformationGain: 0,
      askCost: config.askCostBase,
      expectedDecisionImprovement: 0,
      voiScore: -1,
      askThreshold: config.askThreshold,
      decision: 'skip_with_default',
      reasoning: `Two-question limit (${config.maxQuestionsPerWorkflow}) reached. ` +
        `Already asked ${questionsAskedInWorkflow} questions. ` +
        `Will proceed with explicit assumptions.`,
    };
  }

  // Get or create aspect
  const aspect = await getOrCreateAspect(
    request.tenantId,
    request.workflowType || null,
    request.aspectName,
    request.aspectCategory,
    request.options
  );

  // Calculate VOI
  const decision = calculateVOI(aspect, request.urgency, config);
  
  logger.info('VOI decision made', {
    tenantId: request.tenantId,
    aspectName: request.aspectName,
    decision: decision.decision,
    voiScore: decision.voiScore,
    reasoning: decision.reasoning,
  });

  return decision;
}

async function recordQuestionOutcome(
  requestId: string,
  aspectId: string,
  actualAnswer: unknown,
  priorBelief: PriorBelief
): Promise<void> {
  // Determine if answer matched prior
  let answerMatchedPrior = false;
  
  if (priorBelief.type === 'categorical' && priorBelief.distribution) {
    const answerStr = String(actualAnswer);
    const maxPrior = Math.max(...Object.values(priorBelief.distribution));
    const answerPrior = priorBelief.distribution[answerStr] || 0;
    answerMatchedPrior = answerPrior >= maxPrior * 0.9;
  } else if (priorBelief.type === 'boolean') {
    const answerBool = Boolean(actualAnswer);
    answerMatchedPrior = (answerBool && (priorBelief.mean ?? 0.5) > 0.5) ||
                         (!answerBool && (priorBelief.mean ?? 0.5) <= 0.5);
  }

  // Calculate actual information gain (simplified)
  const actualInfoGain = answerMatchedPrior ? 0.1 : 0.8;

  // Update VOI decision record
  await executeStatement(
    `UPDATE hitl_voi_decisions SET
       actual_answer = :actualAnswer::jsonb,
       answer_matched_prior = :answerMatchedPrior,
       actual_information_gain = :actualInfoGain
     WHERE request_id = :requestId`,
    [
      stringParam('requestId', requestId),
      stringParam('actualAnswer', JSON.stringify(actualAnswer)),
      stringParam('answerMatchedPrior', answerMatchedPrior.toString()),
      doubleParam('actualInfoGain', actualInfoGain),
    ]
  );

  // Update aspect with outcome
  await updateAspectFromOutcome(aspectId, actualAnswer, answerMatchedPrior, actualInfoGain);
}

async function getVOIStatistics(tenantId: string): Promise<{
  totalDecisions: number;
  askDecisions: number;
  skipDecisions: number;
  inferDecisions: number;
  avgVOIScore: number;
  avgActualInfoGain: number;
  priorAccuracy: number;
}> {
  const result = await executeStatement(
    `SELECT 
       COUNT(*) as total,
       COUNT(CASE WHEN decision = 'ask' THEN 1 END) as ask_count,
       COUNT(CASE WHEN decision = 'skip_with_default' THEN 1 END) as skip_count,
       COUNT(CASE WHEN decision = 'infer' THEN 1 END) as infer_count,
       AVG(voi_score) as avg_voi,
       AVG(actual_information_gain) as avg_info_gain,
       AVG(CASE WHEN answer_matched_prior THEN 1 ELSE 0 END) as prior_accuracy
     FROM hitl_voi_decisions vd
     JOIN hitl_approval_requests r ON r.id = vd.request_id
     WHERE r.tenant_id = :tenantId
       AND vd.created_at > NOW() - INTERVAL '30 days'`,
    [stringParam('tenantId', tenantId)]
  );

  const row = result.rows?.[0] || {};
  return {
    totalDecisions: Number(row.total) || 0,
    askDecisions: Number(row.ask_count) || 0,
    skipDecisions: Number(row.skip_count) || 0,
    inferDecisions: Number(row.infer_count) || 0,
    avgVOIScore: Number(row.avg_voi) || 0,
    avgActualInfoGain: Number(row.avg_info_gain) || 0,
    priorAccuracy: Number(row.prior_accuracy) || 0,
  };
}

export const voiService = {
  shouldAskQuestion,
  recordVOIDecision,
  recordQuestionOutcome,
  getOrCreateAspect,
  calculateVOI,
  getVOIStatistics,
  DEFAULT_CONFIG,
};
