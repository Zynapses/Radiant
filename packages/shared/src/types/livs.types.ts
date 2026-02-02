/**
 * LIVS - LLM Integrity Verification System Types
 * 
 * Two-tier defense against AI "lying" behaviors:
 * - Tier 1: Individual LLM Interrogation
 * - Tier 2: Orchestration Integrity Verification
 * 
 * @version 1.0.0
 * @since v6.3.0
 */

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Interrogation depth levels
 * Higher levels = more thorough but more expensive
 */
export type InterrogationDepth = 0 | 1 | 2 | 3 | 4;

export const INTERROGATION_DEPTH_NAMES: Record<InterrogationDepth, string> = {
  0: 'None',
  1: 'Spot Check',
  2: 'Moderate',
  3: 'Thorough',
  4: 'Forensic'
};

export const INTERROGATION_DEPTH_QUESTIONS: Record<InterrogationDepth, number> = {
  0: 0,
  1: 2,
  2: 4,
  3: 7,
  4: 10
};

export const INTERROGATION_COST_MULTIPLIER: Record<InterrogationDepth, number> = {
  0: 1.0,
  1: 1.3,
  2: 1.6,
  3: 2.0,
  4: 3.0
};

/**
 * Cost mode for LIVS operations
 */
export type LIVSCostMode = 'economy' | 'balanced' | 'thorough';

/**
 * Interrogation style
 */
export type InterrogationStyle = 'socratic' | 'adversarial' | 'collaborative';

/**
 * Question pattern types for interrogation
 */
export type InterrogationPatternType =
  | 'dependency_probe'
  | 'forensic_validator'
  | 'edge_case_probe'
  | 'confidence_calibration'
  | 'contradiction_test';

/**
 * LIVS configuration hierarchy: System → Tenant → User
 */
export interface LIVSConfiguration {
  /** Master toggle (affects both tiers) */
  enabled: boolean;
  
  /** Tier 1: Individual Interrogation settings */
  individualInterrogation: {
    enabled: boolean;
    defaultDepth: InterrogationDepth;
    autoEscalate: boolean;
    escalationThreshold: number; // 0.0-1.0
    interrogatorModel?: string; // Different model for interrogation
    style: InterrogationStyle;
  };
  
  /** Tier 2: Orchestration Integrity settings */
  orchestrationIntegrity: {
    enabled: boolean;
    preActionInterrogation: boolean;
    consistencyChecking: boolean;
    evidenceChainValidation: boolean;
    maxConfidencePropagation: number; // Cap confidence inflation
  };
  
  /** Cost/Speed tradeoffs */
  costMode: LIVSCostMode;
  maxInterrogationCostMultiplier: number;
  
  /** Learning settings */
  contributeToGlobalWeights: boolean;
  useGlobalWeights: boolean;
}

/**
 * Default LIVS configuration
 */
export const DEFAULT_LIVS_CONFIG: LIVSConfiguration = {
  enabled: true,
  individualInterrogation: {
    enabled: true,
    defaultDepth: 1, // Spot Check
    autoEscalate: true,
    escalationThreshold: 0.6,
    style: 'socratic'
  },
  orchestrationIntegrity: {
    enabled: true,
    preActionInterrogation: true,
    consistencyChecking: true,
    evidenceChainValidation: true,
    maxConfidencePropagation: 0.95
  },
  costMode: 'balanced',
  maxInterrogationCostMultiplier: 2.0,
  contributeToGlobalWeights: true,
  useGlobalWeights: true
};

// =============================================================================
// Soft Rules Types
// =============================================================================

/**
 * Query types for rule matching
 */
export type LIVSQueryType = 
  | 'factual'
  | 'procedural'
  | 'analytical'
  | 'creative'
  | 'code'
  | 'medical'
  | 'legal'
  | 'financial';

/**
 * User tier for rule matching
 */
export type LIVSUserTier = 'free' | 'pro' | 'enterprise';

/**
 * Soft rule creator type
 */
export type SoftRuleCreatorType = 'system' | 'tenant_admin' | 'user';

/**
 * Conditions for when a soft rule applies
 */
export interface LIVSSoftRuleConditions {
  /** Only apply in specific domains */
  domains?: string[];
  /** Only apply for specific models */
  models?: string[];
  /** Only apply for specific query types */
  queryTypes?: LIVSQueryType[];
  /** Only apply at certain confidence levels */
  confidenceRange?: [number, number];
  /** Only apply for certain user tiers */
  userTiers?: LIVSUserTier[];
  /** Minimum token count to trigger */
  minTokens?: number;
  /** Keywords that trigger the rule */
  keywords?: string[];
}

/**
 * Actions a soft rule can take
 */
export interface LIVSSoftRuleActions {
  /** Force a specific interrogation depth */
  forceInterrogationDepth?: InterrogationDepth;
  /** Require evidence citation */
  requireEvidenceCitation?: boolean;
  /** Add adversarial model to pipeline */
  addAdversarialModel?: boolean;
  /** Block without verification */
  blockWithoutVerification?: boolean;
  /** Custom interrogation questions */
  customInterrogationQuestions?: string[];
  /** Force specific interrogator model */
  forceInterrogatorModel?: string;
  /** Minimum confidence required */
  minConfidenceRequired?: number;
}

/**
 * LIVS Soft Rule definition
 */
export interface LIVSSoftRule {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  conditions: LIVSSoftRuleConditions;
  actions: LIVSSoftRuleActions;
  priority: number; // Higher = evaluated first
  createdByType: SoftRuleCreatorType;
  createdBy?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create soft rule request
 */
export interface CreateLIVSSoftRuleRequest {
  name: string;
  description?: string;
  conditions: LIVSSoftRuleConditions;
  actions: LIVSSoftRuleActions;
  priority?: number;
  active?: boolean;
}

// =============================================================================
// Interrogation Types
// =============================================================================

/**
 * A single interrogation question and response
 */
export interface InterrogationExchange {
  /** Question pattern used */
  pattern: InterrogationPatternType;
  /** The question asked */
  question: string;
  /** The model's response */
  answer: string;
  /** Analysis of the response */
  analysis: {
    /** Did the answer support or weaken the original claim? */
    verdict: 'supports' | 'weakens' | 'inconclusive';
    /** Detected signals */
    signals: LieDetectionSignal[];
    /** Confidence adjustment from this exchange */
    confidenceAdjustment: number;
  };
  /** Timestamp */
  timestamp: Date;
}

/**
 * Lie detection signal types
 */
export type LieDetectionSignalType =
  | 'confidence_mismatch'
  | 'contradiction'
  | 'hedging_increase'
  | 'specificity_decrease'
  | 'assertion_without_evidence'
  | 'deflection'
  | 'scope_narrowing'
  | 'citation_unverified';

/**
 * A detected lie signal
 */
export interface LieDetectionSignal {
  type: LieDetectionSignalType;
  severity: 'low' | 'medium' | 'high';
  description: string;
  evidence: string;
}

/**
 * Aggregated lie detection signals
 */
export interface LieDetectionSignals {
  /** Confidence mismatch between claimed and calibrated */
  claimedConfidence: number;
  calibratedConfidence: number;
  confidenceDelta: number;
  
  /** Consistency signals */
  contradictionCount: number;
  hedgingIncrease: boolean;
  specificityDecrease: boolean;
  
  /** Evidence signals */
  citationVerified: boolean;
  sourceProvided: boolean;
  logicChainComplete: boolean;
  
  /** Behavioral signals */
  deflectionCount: number;
  scopeNarrowing: boolean;
  assertionWithoutEvidence: number;
  
  /** All detected signals */
  signals: LieDetectionSignal[];
}

/**
 * Interrogation verdict
 */
export type InterrogationVerdict = 'trusted' | 'suspicious' | 'likely_lie' | 'confirmed_lie';

/**
 * Full interrogation result
 */
export interface InterrogationResult {
  id: string;
  tenantId: string;
  
  /** Original request info */
  originalRequestId?: string;
  originalModelId: string;
  originalResponse: string;
  originalConfidence: number;
  
  /** Interrogation details */
  interrogatorModelId: string;
  interrogationDepth: InterrogationDepth;
  exchanges: InterrogationExchange[];
  
  /** Lie detection */
  lieDetected: boolean;
  lieConfidence: number; // 0.0-1.0 confidence that this was a lie
  signals: LieDetectionSignals;
  calibratedConfidence: number;
  
  /** Verdict */
  verdict: InterrogationVerdict;
  
  /** Cost tracking */
  costTokens: number;
  durationMs: number;
  
  /** Metadata */
  createdAt: Date;
}

/**
 * Request to interrogate a response
 */
export interface InterrogateRequest {
  /** The original response to interrogate */
  response: string;
  /** The original query/prompt */
  originalQuery: string;
  /** Model that generated the response */
  modelId: string;
  /** Claimed confidence (if any) */
  claimedConfidence?: number;
  /** Domain context */
  domain?: string;
  /** Query type */
  queryType?: LIVSQueryType;
  /** Override interrogation depth */
  depth?: InterrogationDepth;
  /** Additional context */
  context?: Record<string, unknown>;
}

// =============================================================================
// Model Integrity Weights Types
// =============================================================================

/**
 * Integrity profile for a specific model
 */
export interface ModelIntegrityProfile {
  tenantId: string;
  modelId: string;
  
  /** Aggregate interrogation stats */
  totalInterrogations: number;
  liesDetected: number;
  lieRate: number; // liesDetected / totalInterrogations
  
  /** Domain-specific lie rates */
  domainLieRates: Record<string, number>;
  
  /** Question type specific lie rates */
  questionTypeLieRates: Record<LIVSQueryType, number>;
  
  /** Confidence calibration score (0-1, higher = better calibrated) */
  calibrationScore: number;
  
  /** How well does the model hold up under interrogation? */
  interrogationResilience: number;
  
  /** Sample size for statistical significance */
  sampleSize: number;
  
  /** Last updated timestamp */
  lastUpdated: Date;
}

/**
 * Model integrity weight update
 */
export interface ModelIntegrityUpdate {
  modelId: string;
  interrogationResult: InterrogationResult;
  domain?: string;
  queryType?: LIVSQueryType;
}

// =============================================================================
// Orchestration Integrity Types
// =============================================================================

/**
 * Orchestration failure pattern types
 */
export type OrchestrationFailurePattern =
  | 'watermelon_pipeline'
  | 'echo_chamber'
  | 'confidence_inflation'
  | 'circular_reasoning'
  | 'scope_drift'
  | 'integration_mismatch';

/**
 * Pre-action check decision
 */
export type PreActionDecision = 'proceed' | 'flag_and_proceed' | 'halt_for_review';

/**
 * Pre-action interrogation result
 */
export interface PreActionResult {
  decision: PreActionDecision;
  /** Issues found in upstream output */
  issues: {
    type: OrchestrationFailurePattern | 'missing_info' | 'unverified_assumption';
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }[];
  /** Confidence in the upstream output */
  upstreamConfidence: number;
  /** Recommended actions */
  recommendations: string[];
}

/**
 * Pipeline integrity score
 */
export interface PipelineIntegrityScore {
  /** Per-method integrity scores */
  methodScores: Record<string, {
    integrityScore: number;
    lieDetected: boolean;
    issues: string[];
  }>;
  
  /** Cross-method consistency (0-1) */
  consistencyScore: number;
  
  /** Evidence chain completeness (0-1) */
  evidenceChainScore: number;
  
  /** Goal alignment (0-1) */
  goalAlignmentScore: number;
  
  /** Aggregate pipeline integrity (0-1) */
  overallIntegrityScore: number;
  
  /** Detected failure patterns */
  detectedPatterns: OrchestrationFailurePattern[];
}

/**
 * Full pipeline audit result
 */
export interface PipelineIntegrityAudit {
  id: string;
  tenantId: string;
  pipelineExecutionId: string;
  
  /** Scores */
  scores: PipelineIntegrityScore;
  
  /** Issues found */
  issues: {
    methodId?: string;
    pattern: OrchestrationFailurePattern;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    evidence: string;
  }[];
  
  /** Recommendations for improvement */
  recommendations: string[];
  
  /** Metadata */
  createdAt: Date;
}

/**
 * Orchestration integrity profile for a pattern
 */
export interface OrchestrationIntegrityProfile {
  tenantId: string;
  patternId: string;
  
  /** Reliability stats */
  totalExecutions: number;
  successfulExecutions: number;
  reliabilityScore: number;
  
  /** Failure mode frequency */
  failureModeHistory: Record<OrchestrationFailurePattern, number>;
  
  /** Model compatibility scores */
  modelCompatibility: Record<string, number>; // model pair -> compatibility score
  
  /** Last updated */
  lastUpdated: Date;
}

// =============================================================================
// Dashboard & Analytics Types
// =============================================================================

/**
 * LIVS dashboard data
 */
export interface LIVSDashboard {
  /** Configuration status */
  config: {
    enabled: boolean;
    tier1Enabled: boolean;
    tier2Enabled: boolean;
    costMode: LIVSCostMode;
  };
  
  /** Interrogation metrics */
  interrogationMetrics: {
    total24h: number;
    total7d: number;
    total30d: number;
    liesDetected24h: number;
    liesDetected7d: number;
    liesDetected30d: number;
    averageLieRate: number;
    costSavings: number; // Estimated cost saved by catching lies
  };
  
  /** Top lying models */
  topLyingModels: {
    modelId: string;
    lieRate: number;
    sampleSize: number;
  }[];
  
  /** Top reliable models */
  topReliableModels: {
    modelId: string;
    lieRate: number;
    sampleSize: number;
  }[];
  
  /** Orchestration metrics */
  orchestrationMetrics: {
    pipelinesAudited24h: number;
    failurePatternsDetected24h: number;
    averageIntegrityScore: number;
  };
  
  /** Active soft rules count */
  activeSoftRules: number;
  
  /** Recent interrogations */
  recentInterrogations: {
    id: string;
    modelId: string;
    verdict: InterrogationVerdict;
    timestamp: Date;
  }[];
}

/**
 * Model integrity report
 */
export interface ModelIntegrityReport {
  modelId: string;
  profile: ModelIntegrityProfile;
  
  /** Trend data */
  lieRateTrend: {
    date: string;
    lieRate: number;
  }[];
  
  /** Domain breakdown */
  domainBreakdown: {
    domain: string;
    lieRate: number;
    sampleSize: number;
  }[];
  
  /** Recent interrogations */
  recentInterrogations: InterrogationResult[];
  
  /** Recommendations */
  recommendations: string[];
}

// =============================================================================
// Cato Integration Types
// =============================================================================

/**
 * Model selection with integrity consideration
 */
export interface IntegrityAwareModelSelection {
  /** Original selection criteria */
  task: string;
  requirements: {
    capability?: string[];
    maxCost?: number;
    maxLatency?: number;
  };
  
  /** Integrity weight in selection (0-1, default 0.3) */
  integrityWeight: number;
  
  /** Minimum acceptable integrity score */
  minIntegrityScore?: number;
  
  /** Exclude models above this lie rate */
  maxLieRate?: number;
}

/**
 * Model candidate with integrity score
 */
export interface IntegrityScoreModelCandidate {
  modelId: string;
  
  /** Standard scores */
  capabilityScore: number;
  costScore: number;
  latencyScore: number;
  
  /** Integrity score */
  integrityScore: number;
  lieRate: number;
  calibrationScore: number;
  
  /** Combined weighted score */
  totalScore: number;
}

// =============================================================================
// Question Templates
// =============================================================================

/**
 * Interrogation question template
 */
export interface InterrogationQuestionTemplate {
  pattern: InterrogationPatternType;
  templates: string[];
  description: string;
}

/**
 * Default question templates for each pattern
 */
export const INTERROGATION_QUESTION_TEMPLATES: InterrogationQuestionTemplate[] = [
  {
    pattern: 'dependency_probe',
    description: 'Verify claimed dependencies and prerequisites',
    templates: [
      'You referenced {CLAIM}. Can you explain how this was verified?',
      'Your answer depends on {DEPENDENCY}. How did you confirm this is accurate?',
      'You assumed {ASSUMPTION}. What evidence supports this assumption?'
    ]
  },
  {
    pattern: 'forensic_validator',
    description: 'Require evidence for claims',
    templates: [
      'You stated that {CLAIM}. What source confirms this?',
      'Can you provide a citation or reference for {CLAIM}?',
      'How certain are you that {CLAIM} is accurate? What would make you less certain?'
    ]
  },
  {
    pattern: 'edge_case_probe',
    description: 'Check beyond happy path',
    templates: [
      'Your solution handles {HAPPY_PATH}. What happens when {EDGE_CASE}?',
      'What would cause this to fail?',
      'Are there any scenarios where this approach would not work?'
    ]
  },
  {
    pattern: 'confidence_calibration',
    description: 'Test stated certainty',
    templates: [
      'On a scale of 1-10, how confident are you in this answer?',
      'What would change your confidence to a 10?',
      'If this answer were wrong, what would be the most likely error?'
    ]
  },
  {
    pattern: 'contradiction_test',
    description: 'Expose inconsistencies',
    templates: [
      'Earlier you said {PREVIOUS_CLAIM}. Now you\'re saying {CURRENT_CLAIM}. Which is correct?',
      'This seems to contradict {CONTRADICTION}. Can you explain?',
      'How do you reconcile {STATEMENT_A} with {STATEMENT_B}?'
    ]
  }
];
