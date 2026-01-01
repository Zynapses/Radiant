/**
 * RADIANT v6.1.0 - Advanced Cognition Constants
 */

import type { TeacherConfig, CacheTTLConfig, GoalGuardrails } from '../types/cognition.types';

// ============================================================================
// REASONING TEACHER DEFAULTS
// ============================================================================

export const DEFAULT_TEACHER_CONFIG: TeacherConfig = {
  defaultTeacher: 'claude-opus-4-5-extended',
  taskTypeMapping: {
    'complex_reasoning': 'claude-opus-4-5-extended',
    'research_synthesis': 'gemini-2-5-pro',
    'mathematical': 'o3',
    'code_generation': 'claude-sonnet-4',
    'creative_writing': 'claude-opus-4-5-extended',
    'scientific': 'deepseek-r1',
  },
  maxConcurrentTraces: 10,
  traceQualityThreshold: 0.8,
  maxTokensPerTrace: 16000,
};

export const TEACHER_MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'claude-opus-4-5-extended': { input: 15.0, output: 75.0 },
  'gemini-2-5-pro': { input: 1.25, output: 5.0 },
  'o3': { input: 10.0, output: 40.0 },
  'claude-sonnet-4': { input: 3.0, output: 15.0 },
  'deepseek-r1': { input: 0.55, output: 2.19 },
};

// ============================================================================
// INFERENCE STUDENT DEFAULTS
// ============================================================================

export const STUDENT_BASE_MODELS = ['llama-3-70b', 'llama-3-8b', 'mistral-7b'] as const;

export const STUDENT_TRAINING_CONFIG = {
  minExamplesForTraining: 1000,
  defaultEpochs: 3,
  learningRate: 2e-5,
  batchSize: 4,
  gradientAccumulationSteps: 8,
  warmupRatio: 0.1,
  loraRank: 64,
  loraAlpha: 128,
  loraDropout: 0.05,
};

export const STUDENT_INFERENCE_DEFAULTS = {
  defaultN: 1,
  maxN: 5,
  defaultTemperature: 0.7,
  defaultMaxTokens: 4096,
};

// ============================================================================
// SEMANTIC CACHE DEFAULTS
// ============================================================================

export const CACHE_TTL_CONFIGS: CacheTTLConfig[] = [
  { contentType: 'factual', baseTtlMinutes: 10080, hitBonus: 1440, maxTtlMinutes: 43200 },
  { contentType: 'code', baseTtlMinutes: 1440, hitBonus: 360, maxTtlMinutes: 10080 },
  { contentType: 'creative', baseTtlMinutes: 60, hitBonus: 0, maxTtlMinutes: 240 },
  { contentType: 'time_sensitive', baseTtlMinutes: 15, hitBonus: 0, maxTtlMinutes: 15 },
  { contentType: 'user_specific', baseTtlMinutes: 240, hitBonus: 60, maxTtlMinutes: 1440 },
];

export const CACHE_SIMILARITY_THRESHOLD = 0.95;
export const CACHE_EMBEDDING_DIMENSION = 1536;
export const CACHE_MAX_ENTRIES_PER_TENANT = 100000;

// ============================================================================
// METACOGNITION DEFAULTS
// ============================================================================

export const METACOGNITION_THRESHOLDS = {
  confidenceThreshold: 0.7,
  entropyThreshold: 2.5,
  consistencyThreshold: 0.8,
  maxSelfCorrectionIterations: 3,
};

export const ESCALATION_TARGETS: Record<string, string> = {
  'code': 'claude-sonnet-4',
  'reasoning': 'claude-opus-4-5-extended',
  'research': 'gemini-2-5-pro',
  'default': 'claude-opus-4-5-extended',
};

// ============================================================================
// REWARD MODEL DEFAULTS
// ============================================================================

export const REWARD_MODEL_CONFIG = {
  embeddingModel: 'text-embedding-3-small',
  scoringModel: 'reward-model-v1',
  minTrainingExamples: 10000,
  retrainingFrequency: 'weekly',
  bestOfNDefault: 4,
  bestOfNMax: 8,
};

export const REWARD_DIMENSION_WEIGHTS = {
  relevance: 0.25,
  accuracy: 0.30,
  helpfulness: 0.25,
  safety: 0.10,
  style: 0.10,
};

// ============================================================================
// COUNTERFACTUAL DEFAULTS
// ============================================================================

export const COUNTERFACTUAL_SAMPLING_STRATEGIES = [
  { reason: 'regeneration', rate: 1.0 },
  { reason: 'low_confidence', rate: 0.5 },
  { reason: 'high_cost', rate: 0.25 },
  { reason: 'random', rate: 0.01 },
];

export const COUNTERFACTUAL_MAX_DAILY_SIMULATIONS = 1000;

// ============================================================================
// CURIOSITY ENGINE DEFAULTS
// ============================================================================

export const DEFAULT_GOAL_GUARDRAILS: GoalGuardrails = {
  maxCuriosityTokensPerDay: 100000,
  maxCuriosityApiCostPerDay: 10.00,
  forbiddenPatterns: [
    'collect user data',
    'modify own code',
    'bypass security',
    'access external systems',
    'store credentials',
  ],
  requireApprovalAbove: 8,
  canModifyOwnWeights: false,
  canModifyOwnGoals: false,
};

// ============================================================================
// CAUSAL TRACKER DEFAULTS
// ============================================================================

export const CAUSAL_DETECTION_PATTERNS: Record<string, RegExp[]> = {
  reference: [
    /as (I|we|you) (mentioned|said|discussed|noted)/i,
    /earlier (I|we|you) (said|mentioned)/i,
  ],
  elaboration: [
    /can you (explain|elaborate|expand)/i,
    /tell me more about/i,
  ],
  correction: [
    /actually,? (I meant|what I meant)/i,
    /no,? (I was|that's not)/i,
  ],
  continuation: [
    /continue/i,
    /keep going/i,
    /what's next/i,
  ],
};

export const CAUSAL_CHAIN_MAX_DEPTH = 20;
export const CAUSAL_IMPORTANCE_DECAY = 0.9;

// ============================================================================
// DISTILLATION PIPELINE DEFAULTS
// ============================================================================

export const DISTILLATION_CONFIG = {
  minExamplesForTraining: 1000,
  maxExamplesPerBatch: 10000,
  qualityThreshold: 0.8,
  autoTriggerThreshold: 5000,
};
