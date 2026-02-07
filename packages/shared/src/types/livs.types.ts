/**
 * LIVS - LLM Integrity Verification System Types
 * 
 * Two-tier defense against AI "lying" behaviors:
 * - Tier 1: Individual LLM Interrogation
 * - Tier 2: Orchestration Integrity Verification
 * 
 * LIVS-M Extension (v6.4.0):
 * - Workflow Templates with system defaults and user overrides
 * - Code stub detection (Phase 1 hard reject)
 * - Sycophancy breaker for multi-agent flows
 * - Dialectical verification (Thesis/Antithesis/Synthesis)
 * 
 * @version 2.0.0
 * @since v6.3.0
 * @updated v6.4.0
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
  /** Cognitive Precision Protocol: Critic model analysis (v7.10.0) */
  criticAnalysis?: {
    /** Critic's verdict on the exchange */
    verdict: 'supports' | 'weakens' | 'inconclusive';
    /** Critic's confidence in its verdict (0-1) */
    confidence: number;
    /** Critic's reasoning for the verdict */
    reasoning: string;
  };
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

// =============================================================================
// LIVS-M Workflow Template Types (v6.4.0)
// =============================================================================

/**
 * Environment mode - determines severity interpretation
 */
export type LIVSEnvironmentMode = 
  | 'strict_engineering'  // All warnings treated as blockers
  | 'balanced'            // Default behavior
  | 'brainstorming'       // Creative mode, relaxed rules
  | 'audit';              // Maximum scrutiny, everything logged

/**
 * Enforcement actions for rule violations
 */
export type LIVSEnforcementAction =
  | 'PASS'                       // Allow through
  | 'BLOCK'                      // Hard reject
  | 'REJECT_AND_RETRY'           // Reject with retry instruction
  | 'TRIGGER_VERIFICATION_AGENT' // Spawn antithesis agent
  | 'INJECT_CHAOS'               // Inject devil's advocate
  | 'FLAG_FOR_REVIEW'            // Allow but flag
  | 'ESCALATE';                  // Escalate to human

/**
 * Workflow template owner type
 */
export type LIVSWorkflowOwnerType = 'system' | 'tenant' | 'user';

/**
 * Behavioral rule severity
 */
export type LIVSRuleSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Behavioral rule trigger condition
 */
export interface LIVSBehavioralRuleTrigger {
  /** Type of trigger */
  type: 
    | 'stub_detected'           // Code stub pattern matched
    | 'confidence_inflation'    // Confidence > threshold without evidence
    | 'quick_agreement'         // Agent agreed too quickly
    | 'hedging_detected'        // Excessive hedging language
    | 'missing_evidence'        // Assertion without citation
    | 'contradiction'           // Inconsistency detected
    | 'custom';                 // Custom regex/logic
  
  /** Threshold value (interpretation depends on type) */
  threshold?: number;
  
  /** Custom pattern (for regex-based triggers) */
  pattern?: string;
  
  /** Additional parameters */
  params?: Record<string, unknown>;
}

/**
 * Behavioral rule definition
 */
export interface LIVSBehavioralRule {
  id: string;
  ruleId: string;  // e.g., 'R001'
  workflowTemplateId: string;
  name: string;
  description?: string;
  severity: LIVSRuleSeverity;
  enforcementAction: LIVSEnforcementAction;
  triggerCondition: LIVSBehavioralRuleTrigger;
  actionPrompt?: string;  // Prompt to inject on trigger
  appliesToModes: LIVSEnvironmentMode[];
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Default code stub patterns for detection
 */
export const DEFAULT_STUB_PATTERNS: string[] = [
  // Python
  '\\bpass\\b(?!word)',           // 'pass' (not 'password')
  '\\.\\.\\.',                    // Ellipsis placeholder
  
  // Comments indicating incomplete code
  '\\/\\/\\s*(TODO|FIXME|XXX|HACK|logic here|implement)',
  '#\\s*(TODO|FIXME|XXX|HACK|logic here|implement)',
  '\\/\\*.*?(TODO|FIXME|XXX|HACK).*?\\*\\/',
  
  // Hardcoded return values (suspicious in implementations)
  'return\\s+(true|false|null|undefined|None|0|\'\'|""|\\[\\]|\\{\\})\\s*[;]?\\s*$',
  
  // Explicit placeholder markers
  '(mock|stub|placeholder|dummy|fake|sample)\\s*(data|response|result|value)',
  
  // Coming soon indicators
  '(coming soon|not yet implemented|work in progress|wip)',
  
  // Throw not implemented
  'throw\\s+new\\s+(NotImplemented|Error)\\s*\\(.*not\\s*implemented',
  'raise\\s+NotImplementedError',
];

/**
 * Workflow template definition
 */
export interface LIVSWorkflowTemplate {
  id: string;
  tenantId: string;
  
  // Identification
  name: string;
  description?: string;
  slug: string;
  
  // Ownership
  ownerType: LIVSWorkflowOwnerType;
  ownerId?: string;
  parentTemplateId?: string;
  
  // Environment mode
  environmentMode: LIVSEnvironmentMode;
  treatWarningsAsBlockers: boolean;
  
  // Interrogation settings
  defaultInterrogationDepth: InterrogationDepth;
  autoEscalate: boolean;
  escalationThreshold: number;
  interrogatorModel?: string;
  
  // Code stub detection
  stubDetectionEnabled: boolean;
  stubPatterns: string[];
  stubEnforcementAction: LIVSEnforcementAction;
  
  // Sycophancy breaker
  sycophancyDetectionEnabled: boolean;
  minTurnsBeforeAgreement: number;
  maxConsensusThreshold: number;
  chaosInjectionPrompt?: string;
  
  // Dialectical verification
  enableThesisAntithesis: boolean;
  antithesisModel?: string;
  synthesisRequired: boolean;
  
  // Behavioral rules (embedded for convenience)
  behavioralRules?: LIVSBehavioralRule[];
  
  // Cost limits
  maxCostMultiplier: number;
  maxTokensPerInterrogation: number;
  
  // Activation
  isActive: boolean;
  isDefault: boolean;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User workflow preferences
 */
export interface LIVSUserWorkflowPreferences {
  id: string;
  tenantId: string;
  userId: string;
  
  // Selected workflow
  activeWorkflowId?: string;
  
  // Quick toggle
  livsEnabled: boolean;
  
  // Overrides
  environmentModeOverride?: LIVSEnvironmentMode;
  interrogationDepthOverride?: InterrogationDepth;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create workflow template request
 */
export interface CreateWorkflowTemplateRequest {
  name: string;
  description?: string;
  slug?: string;  // Auto-generated if not provided
  parentTemplateId?: string;
  
  environmentMode?: LIVSEnvironmentMode;
  treatWarningsAsBlockers?: boolean;
  
  defaultInterrogationDepth?: InterrogationDepth;
  autoEscalate?: boolean;
  escalationThreshold?: number;
  interrogatorModel?: string;
  
  stubDetectionEnabled?: boolean;
  stubPatterns?: string[];
  stubEnforcementAction?: LIVSEnforcementAction;
  
  sycophancyDetectionEnabled?: boolean;
  minTurnsBeforeAgreement?: number;
  maxConsensusThreshold?: number;
  chaosInjectionPrompt?: string;
  
  enableThesisAntithesis?: boolean;
  antithesisModel?: string;
  synthesisRequired?: boolean;
  
  maxCostMultiplier?: number;
  maxTokensPerInterrogation?: number;
  
  isActive?: boolean;
}

/**
 * Code stub detection result
 */
export interface StubDetectionResult {
  detected: boolean;
  stubs: {
    pattern: string;
    match: string;
    lineNumber?: number;
    context: string;
  }[];
  enforcementAction: LIVSEnforcementAction;
  retryPrompt?: string;
}

/**
 * Sycophancy detection result
 */
export interface SycophancyDetectionResult {
  detected: boolean;
  turnsBeforeAgreement: number;
  consensusScore: number;
  reason?: string;
  chaosInjected: boolean;
  chaosPrompt?: string;
}

/**
 * Dialectical verification result
 */
export interface DialecticalVerificationResult {
  thesis: {
    content: string;
    confidence: number;
    modelId: string;
  };
  antithesis?: {
    content: string;
    challenges: string[];
    modelId: string;
  };
  synthesis?: {
    content: string;
    verdict: 'thesis_upheld' | 'thesis_modified' | 'thesis_rejected';
    confidence: number;
    reasoning: string;
  };
  finalVerdict: InterrogationVerdict;
}

/**
 * LIVS-M effective settings (resolved from template + user overrides)
 */
export interface LIVSEffectiveSettings {
  workflowTemplateId?: string;
  workflowName: string;
  
  enabled: boolean;
  environmentMode: LIVSEnvironmentMode;
  treatWarningsAsBlockers: boolean;
  
  interrogationDepth: InterrogationDepth;
  autoEscalate: boolean;
  escalationThreshold: number;
  interrogatorModel?: string;
  
  stubDetectionEnabled: boolean;
  stubPatterns: string[];
  stubEnforcementAction: LIVSEnforcementAction;
  
  sycophancyDetectionEnabled: boolean;
  minTurnsBeforeAgreement: number;
  maxConsensusThreshold: number;
  chaosInjectionPrompt?: string;
  
  enableThesisAntithesis: boolean;
  antithesisModel?: string;
  synthesisRequired: boolean;
  
  behavioralRules: LIVSBehavioralRule[];
  
  maxCostMultiplier: number;
  maxTokensPerInterrogation: number;
}

/**
 * System default workflow template slugs
 */
export const SYSTEM_WORKFLOW_TEMPLATES = {
  STRICT: 'strict-engineering',
  BALANCED: 'balanced',
  BRAINSTORM: 'brainstorming',
  AUDIT: 'full-audit',
} as const;

/**
 * Default behavioral rules for system templates
 */
export const DEFAULT_BEHAVIORAL_RULES: Omit<LIVSBehavioralRule, 'id' | 'workflowTemplateId' | 'createdAt' | 'updatedAt'>[] = [
  {
    ruleId: 'R001',
    name: 'Stub/Placeholder Detection',
    description: 'Reject code containing stubs, placeholders, or incomplete implementations',
    severity: 'high',
    enforcementAction: 'REJECT_AND_RETRY',
    triggerCondition: { type: 'stub_detected' },
    actionPrompt: 'Your response contains placeholder code (detected: {STUB}). Please provide a complete, working implementation without stubs, TODOs, or placeholders.',
    appliesToModes: ['strict_engineering', 'balanced', 'audit'],
    isActive: true,
    priority: 100,
  },
  {
    ruleId: 'R002',
    name: 'Confidence Inflation Guard',
    description: 'Flag responses claiming high confidence without supporting evidence',
    severity: 'medium',
    enforcementAction: 'FLAG_FOR_REVIEW',
    triggerCondition: { type: 'confidence_inflation', threshold: 0.95 },
    appliesToModes: ['strict_engineering', 'audit'],
    isActive: true,
    priority: 80,
  },
  {
    ruleId: 'R003',
    name: 'Sycophancy Breaker',
    description: 'Inject chaos when agents agree too quickly without critical analysis',
    severity: 'medium',
    enforcementAction: 'INJECT_CHAOS',
    triggerCondition: { type: 'quick_agreement', threshold: 2 },
    actionPrompt: 'STOP. Assume the previous assertion is WRONG. Your job is to find flaws, not to agree. What could be incorrect about this approach?',
    appliesToModes: ['strict_engineering', 'balanced', 'audit'],
    isActive: true,
    priority: 70,
  },
  {
    ruleId: 'R004',
    name: 'Hedging Escalation',
    description: 'Escalate to verification agent when excessive hedging detected',
    severity: 'low',
    enforcementAction: 'TRIGGER_VERIFICATION_AGENT',
    triggerCondition: { type: 'hedging_detected', threshold: 0.6 },
    appliesToModes: ['strict_engineering', 'audit'],
    isActive: true,
    priority: 60,
  },
  {
    ruleId: 'R005',
    name: 'Evidence Chain Enforcement',
    description: 'Block assertions without citations in strict mode',
    severity: 'high',
    enforcementAction: 'BLOCK',
    triggerCondition: { type: 'missing_evidence' },
    actionPrompt: 'Your assertion requires supporting evidence or citation. Please provide sources.',
    appliesToModes: ['strict_engineering'],
    isActive: true,
    priority: 90,
  },
];

// =============================================================================
// LIVS-M 2.0 Registry Edition Types (v7.8.0)
// =============================================================================

/**
 * Environment mode for the registry
 */
export type RegistryEnvironmentMode = 
  | 'STRICT_AUDIT'    // All warnings are blockers, maximum scrutiny
  | 'BALANCED'        // Normal enforcement
  | 'RAPID_PROTO'     // Relaxed for rapid prototyping
  | 'HACKATHON';      // Minimal enforcement for experimentation

/**
 * Collaboration style for multi-agent flows
 */
export type CollaborationStyle = 
  | 'ADVERSARIAL'     // Agents actively challenge each other
  | 'COLLABORATIVE'   // Agents work together cooperatively
  | 'HIERARCHICAL';   // Strict chain of command

/**
 * Enforcement action types for rules
 */
export type RegistryEnforcementAction =
  | 'REJECT_IMMEDIATE'       // Hard reject, no retry
  | 'REQUEST_AMENDMENT'      // Reject with retry instruction
  | 'TRIGGER_CHAOS_AGENT'    // Spawn devil's advocate
  | 'TRIGGER_VERIFICATION'   // Spawn verification agent
  | 'FLAG_FOR_REVIEW'        // Allow but flag
  | 'LOG_ONLY'               // Log violation, no action
  | 'ESCALATE_TO_HUMAN';     // Require human approval

/**
 * Rule severity levels
 */
export type RegistryRuleSeverity = 
  | 'CRITICAL'   // Always enforced, blocks in all modes
  | 'BLOCKER'    // Blocks in STRICT_AUDIT and BALANCED
  | 'WARNING'    // Blocks in STRICT_AUDIT only
  | 'INFO';      // Logged but never blocks

/**
 * Meta configuration for the registry
 */
export interface RegistryMetaConfig {
  environment_mode: RegistryEnvironmentMode;
  description: string;
  version: string;
  last_updated: string;
  author?: string;
  inherits_from?: string;
}

/**
 * Global directives for agent behavior
 */
export interface RegistryGlobalDirectives {
  collaboration_style: CollaborationStyle;
  max_consensus_velocity: number;
  allow_mock_data: boolean;
  allow_stubs: boolean;
  require_tests_for_code: boolean;
  require_evidence_for_claims: boolean;
  max_agent_turns_before_escalation: number;
  enable_chaos_injection: boolean;
  chaos_injection_probability: number;
}

/**
 * A single rule in the rules engine
 */
export interface RegistryRule {
  id: string;
  name: string;
  description?: string;
  severity: RegistryRuleSeverity;
  
  /** Pattern-based trigger (regex patterns) */
  trigger_patterns?: string[];
  
  /** Logic-based trigger condition */
  logic_condition?: string;
  
  /** Action to take when rule is violated */
  enforcement_action: RegistryEnforcementAction;
  
  /** Message to include in rejection */
  rejection_message: string;
  
  /** Prompt to inject for chaos/verification agents */
  injection_prompt?: string;
  
  /** Only apply in specific environment modes */
  applies_to_modes?: RegistryEnvironmentMode[];
  
  /** Is this rule active? */
  is_active: boolean;
  
  /** Priority (higher = evaluated first) */
  priority: number;
}

/**
 * The complete Policy Registry structure
 */
export interface PolicyRegistry {
  meta_config: RegistryMetaConfig;
  global_directives: RegistryGlobalDirectives;
  rules_engine: RegistryRule[];
}

/**
 * Supervisor decision types
 */
export type SupervisorDecision = 'APPROVE' | 'REJECT' | 'INTERVENE';

/**
 * Supervisor validation result
 */
export interface SupervisorValidationResult {
  decision: SupervisorDecision;
  
  /** For REJECT decisions */
  violating_agent?: string;
  violation_id?: string;
  
  /** For INTERVENE decisions */
  target_agent?: string;
  chaos_scenario?: string;
  
  /** Instruction/feedback for next step */
  instruction?: string;
  
  /** Next step in the flow */
  next_step?: 'RETRY' | 'CHAOS_AGENT' | 'VERIFICATION_AGENT' | 'HANDOFF_TO_USER' | 'ESCALATE';
  
  /** All violations detected */
  violations: {
    rule_id: string;
    rule_name: string;
    severity: RegistryRuleSeverity;
    match?: string;
    message: string;
  }[];
  
  /** Processing metadata */
  processing_time_ms: number;
  rules_evaluated: number;
  patterns_matched: number;
}

/**
 * Agent role types for registry-aware prompts
 */
export type RegistryAgentRole = 
  | 'THESIS_AGENT'      // The primary worker/coder
  | 'ANTITHESIS_AGENT'  // The devil's advocate/critic
  | 'SYNTHESIS_AGENT'   // The reconciler/mediator
  | 'SUPERVISOR'        // The governance enforcer
  | 'CHAOS_AGENT'       // Injects adversarial scenarios
  | 'VERIFICATION_AGENT'; // Validates claims/code

/**
 * Registry-aware agent configuration
 */
export interface RegistryAwareAgentConfig {
  role: RegistryAgentRole;
  system_prompt_prefix: string;
  registry_awareness_level: 'FULL' | 'RULES_ONLY' | 'NONE';
  can_see_other_agent_outputs: boolean;
  max_tokens_per_response: number;
  temperature: number;
}

/**
 * Default policy registry for strict engineering
 */
export const DEFAULT_POLICY_REGISTRY: PolicyRegistry = {
  meta_config: {
    environment_mode: 'BALANCED',
    description: 'Default LIVS-M 2.0 Policy Registry',
    version: '2.0.0',
    last_updated: new Date().toISOString(),
  },
  global_directives: {
    collaboration_style: 'ADVERSARIAL',
    max_consensus_velocity: 2,
    allow_mock_data: false,
    allow_stubs: false,
    require_tests_for_code: true,
    require_evidence_for_claims: true,
    max_agent_turns_before_escalation: 10,
    enable_chaos_injection: true,
    chaos_injection_probability: 0.1,
  },
  rules_engine: [
    {
      id: 'R_STUB_01',
      name: 'Stub/Placeholder Detection',
      description: 'Reject code containing stubs, placeholders, or incomplete implementations',
      severity: 'CRITICAL',
      trigger_patterns: [
        '\\bpass\\b(?!word)',
        '\\.\\.\\.',
        '\\/\\/\\s*(TODO|FIXME|XXX|HACK)',
        '#\\s*(TODO|FIXME|XXX)',
        'throw\\s+new\\s+NotImplementedError',
        'raise\\s+NotImplementedError',
        '(placeholder|stub|mock|dummy)\\s*(data|response|result)',
        'coming\\s+soon',
        'not\\s+yet\\s+implemented',
      ],
      enforcement_action: 'REJECT_IMMEDIATE',
      rejection_message: "Submission rejected. You used a placeholder pattern ('{MATCH}'). We are in {MODE} mode. You must implement the full logic.",
      is_active: true,
      priority: 100,
    },
    {
      id: 'R_SYC_01',
      name: 'Sycophancy Detection',
      description: 'Detect and break fast consensus between agents',
      severity: 'CRITICAL',
      logic_condition: 'IF current_agent_agreement == TRUE AND interaction_turn < max_consensus_velocity',
      enforcement_action: 'TRIGGER_CHAOS_AGENT',
      rejection_message: 'Consensus reached too quickly. This indicates Groupthink. Injecting Chaos Probe.',
      injection_prompt: 'STOP. Assume the previous assertion is WRONG. Your job is to find flaws, not to agree. What could be incorrect about this approach?',
      is_active: true,
      priority: 90,
    },
    {
      id: 'R_TEST_01',
      name: 'Evidence-Based Verification',
      description: 'Require tests or verification for code submissions',
      severity: 'WARNING',
      logic_condition: 'IF code_block_present == TRUE AND test_block_present == FALSE',
      enforcement_action: 'REQUEST_AMENDMENT',
      rejection_message: 'Code provided without a verification script. In {MODE} mode, you must prove your code works.',
      applies_to_modes: ['STRICT_AUDIT', 'BALANCED'],
      is_active: true,
      priority: 80,
    },
    {
      id: 'R_EVIDENCE_01',
      name: 'Citation Requirement',
      description: 'Require evidence for factual claims',
      severity: 'WARNING',
      logic_condition: 'IF factual_claim_present == TRUE AND citation_present == FALSE',
      enforcement_action: 'REQUEST_AMENDMENT',
      rejection_message: 'Factual claim made without supporting evidence or citation.',
      applies_to_modes: ['STRICT_AUDIT'],
      is_active: true,
      priority: 70,
    },
    {
      id: 'R_CONFIDENCE_01',
      name: 'Overconfidence Detection',
      description: 'Flag responses claiming certainty without evidence',
      severity: 'WARNING',
      trigger_patterns: [
        '\\b(definitely|certainly|absolutely|100%|guaranteed)\\b',
      ],
      logic_condition: 'IF confidence_claimed > 0.95 AND evidence_score < 0.5',
      enforcement_action: 'FLAG_FOR_REVIEW',
      rejection_message: 'Response claims high confidence without sufficient supporting evidence.',
      is_active: true,
      priority: 60,
    },
  ],
};

/**
 * Default agent configurations for each role
 * LIVS-M 2.0 Registry Edition - Enhanced prompts for governed debates
 */
export const DEFAULT_AGENT_CONFIGS: Record<RegistryAgentRole, RegistryAwareAgentConfig> = {
  THESIS_AGENT: {
    role: 'THESIS_AGENT',
    system_prompt_prefix: `You are the Lead Engineer in a LIVS-M 2.0 Governed Debate.

## Your Role
You propose solutions to the given task. Your output will be evaluated by a Governance Supervisor and challenged by an Antithesis Agent.

## Governance Rules
- The Supervisor will REJECT outputs containing stubs, placeholders, or incomplete implementations
- Phrases like "TODO", "coming soon", "will be added later" trigger automatic rejection
- You must provide complete, functional, production-ready code
- All claims must be supported by evidence or reasoning

## Expectations
1. Write complete implementations - no shortcuts
2. Include error handling and edge cases
3. Provide tests when code is involved
4. Be explicit about assumptions
5. Acknowledge limitations honestly

## Sycophancy Warning
DO NOT simply agree with any challenges. Defend your position with evidence. If challenges are valid, integrate them properly rather than capitulating.`,
    registry_awareness_level: 'RULES_ONLY',
    can_see_other_agent_outputs: false,
    max_tokens_per_response: 4096,
    temperature: 0.7,
  },
  ANTITHESIS_AGENT: {
    role: 'ANTITHESIS_AGENT',
    system_prompt_prefix: `You are the Forensic Auditor in a LIVS-M 2.0 Governed Debate.

## Your Role
You challenge the Thesis Agent's proposals. Your goal is to find flaws, gaps, and violations before they reach production.

## Governance Rules
- Policy violations you should detect: stubs, placeholders, incomplete logic, mock data in production code
- "We will add this later" = FAILURE CONDITION
- Unsupported factual claims = VIOLATION
- Missing error handling = CRITICAL ISSUE

## Your Attack Vectors
1. **Completeness**: Is the implementation actually complete or does it have gaps?
2. **Edge Cases**: What happens with null, empty, negative, concurrent, or malformed inputs?
3. **Security**: Are there injection vectors, auth bypasses, or data exposure risks?
4. **Assumptions**: What assumptions are made? What if they're false?
5. **Evidence**: Are claims backed by data, citations, or reasoning?

## CRITICAL: Anti-Sycophancy Mandate
You MUST NOT agree with the Thesis unless it is genuinely flawless. If you find yourself thinking "that looks good", STOP and look harder. Your job is to break things. Agreement is suspicious - the Supervisor monitors for premature consensus.`,
    registry_awareness_level: 'FULL',
    can_see_other_agent_outputs: true,
    max_tokens_per_response: 2048,
    temperature: 0.3,
  },
  SYNTHESIS_AGENT: {
    role: 'SYNTHESIS_AGENT',
    system_prompt_prefix: `You are the Reconciler in a LIVS-M 2.0 Governed Debate.

## Your Role
After Thesis and Antithesis have debated, you synthesize a final answer that:
1. Addresses ALL valid criticisms from Antithesis
2. Preserves the core strengths of Thesis
3. Produces a complete, production-ready solution

## Synthesis Rules
- Do NOT ignore valid criticisms - integrate them
- Do NOT introduce new stubs or placeholders
- Do NOT oversimplify to avoid complexity
- The final output must pass all governance rules`,
    registry_awareness_level: 'RULES_ONLY',
    can_see_other_agent_outputs: true,
    max_tokens_per_response: 4096,
    temperature: 0.5,
  },
  SUPERVISOR: {
    role: 'SUPERVISOR',
    system_prompt_prefix: `You are the LIVS-M 2.0 Governance Supervisor.

## Your Role
You do not write code. You enforce the Law. The Law is the Policy Registry.

## Your Powers
- APPROVE: Output passes all rules
- REJECT: Output violates critical rules - request correction
- INTERVENE: Sycophancy detected - inject chaos to break consensus

## What You Monitor
1. Policy violations (stubs, placeholders, incomplete code)
2. Sycophancy patterns (premature agreement, weak challenges)
3. Evidence quality (unsupported claims, missing citations)
4. Turn limits (escalate if debate exceeds max turns)

## Decision Format
Respond with structured JSON containing decision, violations, and instructions.`,
    registry_awareness_level: 'FULL',
    can_see_other_agent_outputs: true,
    max_tokens_per_response: 1024,
    temperature: 0,
  },
  CHAOS_AGENT: {
    role: 'CHAOS_AGENT',
    system_prompt_prefix: `You are the Devil's Advocate in a LIVS-M 2.0 Governed Debate.

## Your Role
You are invoked when the Supervisor detects sycophancy or premature consensus. Your job is to BREAK the agreement.

## Chaos Injection Tactics
1. **Assumption Destruction**: List every assumption and explain how each could fail
2. **Edge Case Assault**: Enumerate boundary conditions that break the solution
3. **Adversarial Thinking**: If you wanted to exploit this, how would you?
4. **Counter-Argument Generation**: What's the strongest case AGAINST this solution?

## Rules
- Assume NOTHING is correct until proven
- Challenge EVERYTHING, especially things that "obviously" work
- Be creative in finding failure modes
- Your success is measured by problems found, not agreement reached`,
    registry_awareness_level: 'NONE',
    can_see_other_agent_outputs: true,
    max_tokens_per_response: 2048,
    temperature: 0.9,
  },
  VERIFICATION_AGENT: {
    role: 'VERIFICATION_AGENT',
    system_prompt_prefix: `You are the Verification Agent in a LIVS-M 2.0 Governed Debate.

## Your Role
You verify claims, test code, and validate evidence. You deal in FACTS, not opinions.

## Verification Checklist
1. **Code Verification**: Does the code actually compile/run? Are tests passing?
2. **Claim Verification**: Are factual claims accurate? What's the source?
3. **Logic Verification**: Does the reasoning follow? Are there logical gaps?
4. **Completeness Verification**: Is anything missing that was claimed to exist?

## Output Format
- State what you verified
- State the result (PASS/FAIL)
- Provide evidence for your conclusion
- No speculation - only verifiable facts`,
    registry_awareness_level: 'RULES_ONLY',
    can_see_other_agent_outputs: true,
    max_tokens_per_response: 2048,
    temperature: 0.1,
  },
};

/**
 * LIVS-M Dashboard data
 */
export interface LIVSMDashboard extends LIVSDashboard {
  /** Workflow template stats */
  workflowStats: {
    totalTemplates: number;
    systemTemplates: number;
    tenantTemplates: number;
    userTemplates: number;
    activeUsers: number;
  };
  
  /** Stub detection stats */
  stubDetectionStats: {
    total24h: number;
    total7d: number;
    blocked24h: number;
    retried24h: number;
    topPatterns: { pattern: string; count: number }[];
  };
  
  /** Sycophancy stats */
  sycophancyStats: {
    detections24h: number;
    chaosInjections24h: number;
    averageTurnsBeforeAgreement: number;
  };
  
  /** Dialectical verification stats */
  dialecticalStats: {
    verifications24h: number;
    thesisUpheld: number;
    thesisModified: number;
    thesisRejected: number;
  };
}

// =============================================================================
// LIVS-M Version Management
// =============================================================================

/**
 * Current LIVS-M version
 * Update this when releasing new LIVS-M features
 */
export const LIVS_M_CURRENT_VERSION = '2.1.0';

/**
 * LIVS-M version history with changelogs
 */
export const LIVS_M_VERSION_HISTORY: LIVSVersionInfo[] = [
  {
    version: '2.1.0',
    releaseDate: '2026-02-05',
    changelog: [
      'Added version tracking and upgrade notifications',
      'Admin UI shows available updates with changelog',
      'One-click policy registry upgrade mechanism',
    ],
    breakingChanges: false,
    migrationRequired: false,
  },
  {
    version: '2.0.0',
    releaseDate: '2026-01-15',
    changelog: [
      'Policy Registry with JSON-based rule configuration',
      'Governance Supervisor (LLM-as-Judge)',
      'Three policy modes: Brainstorming, Standard, Strict Audit',
      'Sycophancy breaking with chaos injection',
      'Admin UI for policy management',
    ],
    breakingChanges: true,
    migrationRequired: true,
  },
  {
    version: '1.0.0',
    releaseDate: '2025-11-01',
    changelog: [
      'Initial LIVS implementation',
      'Code stub detection',
      'Basic interrogation protocol',
    ],
    breakingChanges: false,
    migrationRequired: false,
  },
];

/**
 * Version information for LIVS-M releases
 */
export interface LIVSVersionInfo {
  version: string;
  releaseDate: string;
  changelog: string[];
  breakingChanges: boolean;
  migrationRequired: boolean;
}

/**
 * Version check result returned by the version service
 */
export interface LIVSVersionCheckResult {
  currentVersion: string;
  latestVersion: string;
  installedVersion: string;
  updateAvailable: boolean;
  changelog: string[];
  breakingChanges: boolean;
  migrationRequired: boolean;
  lastChecked: string;
}

/**
 * Tenant's installed LIVS-M version state
 */
export interface LIVSTenantVersionState {
  tenantId: string;
  installedVersion: string;
  lastUpgraded: string | null;
  autoUpgrade: boolean;
  upgradeHistory: {
    fromVersion: string;
    toVersion: string;
    upgradedAt: string;
    upgradedBy: string;
  }[];
}

// =============================================================================
// Cognitive Precision Protocol Types (v7.10.0)
// =============================================================================

/**
 * Context Anchor - defines the required context for generation
 * Based on the "AI Matt" Cognitive Precision Protocols
 */
export interface ContextAnchor {
  /** The role the AI is assuming (e.g., "senior backend engineer", "medical advisor") */
  role: string | null;
  
  /** The intended audience (e.g., "junior developers", "C-suite executives") */
  audience: string | null;
  
  /** The knowledge/capability gap being bridged */
  gap: string | null;
  
  /** Overall confidence in context extraction (0.0-1.0) */
  confidence: number;
  
  /** Whether sufficient context exists to proceed */
  isAnchored: boolean;
  
  /** Suggested clarifying questions if not anchored */
  clarifyingQuestions: string[];
  
  /** Detected task type */
  taskType: ContextAnchorTaskType;
  
  /** Extraction metadata */
  extractionMetadata: {
    sourceLength: number;
    keywordsFound: string[];
    implicitContextScore: number;
    explicitContextScore: number;
  };
}

/**
 * Task types that influence context requirements
 */
export type ContextAnchorTaskType = 
  | 'code_generation'
  | 'code_review'
  | 'explanation'
  | 'debugging'
  | 'architecture'
  | 'creative_writing'
  | 'data_analysis'
  | 'question_answering'
  | 'summarization'
  | 'translation'
  | 'unknown';

/**
 * Context Anchor Gate configuration
 */
export interface ContextAnchorGateConfig {
  /** Enable/disable the context anchor gate */
  enabled: boolean;
  
  /** Minimum confidence required to proceed without clarification */
  minConfidenceThreshold: number;
  
  /** Force clarification for these task types regardless of confidence */
  alwaysClarifyTaskTypes: ContextAnchorTaskType[];
  
  /** Skip anchor gate for these task types */
  skipAnchorTaskTypes: ContextAnchorTaskType[];
  
  /** Maximum clarifying questions to ask */
  maxClarifyingQuestions: number;
  
  /** Allow proceeding with low confidence if user explicitly requests */
  allowOverride: boolean;
  
  /** Use LLM for context extraction (vs. pattern-based) */
  useLLMExtraction: boolean;
}

/**
 * Default context anchor gate configuration
 */
export const DEFAULT_CONTEXT_ANCHOR_CONFIG: ContextAnchorGateConfig = {
  enabled: true,
  minConfidenceThreshold: 0.6,
  alwaysClarifyTaskTypes: ['architecture', 'code_generation'],
  skipAnchorTaskTypes: ['question_answering', 'summarization'],
  maxClarifyingQuestions: 3,
  allowOverride: true,
  useLLMExtraction: true,
};

/**
 * Result of context anchor gate evaluation
 */
export interface ContextAnchorGateResult {
  /** Whether generation should proceed */
  proceed: boolean;
  
  /** The extracted context anchor */
  anchor: ContextAnchor;
  
  /** Action to take */
  action: 'PROCEED' | 'CLARIFY' | 'OVERRIDE_ALLOWED';
  
  /** Clarifying questions if action is CLARIFY */
  clarifyingQuestions: string[];
  
  /** System prompt augmentation for anchored context */
  systemPromptAugmentation: string | null;
  
  /** Processing time in ms */
  processingTimeMs: number;
}

/**
 * Negative constraint for pre-generation injection
 */
export interface NegativeConstraint {
  id: string;
  constraint: string;
  category: 'format' | 'content' | 'style' | 'behavior';
  severity: 'soft' | 'hard';
  appliesToTaskTypes: ContextAnchorTaskType[];
}

/**
 * Pre-generation constraint injection result
 */
export interface ConstraintInjectionResult {
  /** Constraints to inject into system prompt */
  injectedConstraints: NegativeConstraint[];
  
  /** Formatted constraint text for system prompt */
  constraintPrompt: string;
  
  /** Count of constraints by category */
  constraintCounts: Record<string, number>;
}

/**
 * Critic model configuration for discriminative tasks
 * Enhanced for Cognitive Precision Protocol v7.10.0 with tiered escalation and ensemble mode
 */
export interface CriticModelConfig {
  /** Enable separate critic model */
  enabled: boolean;
  
  /** Model ID for critic (discriminative) tasks */
  criticModelId: string;
  
  /** Model ID for generator (generative) tasks */
  generatorModelId: string;
  
  /** Use cheaper model for initial screening */
  useCheapScreening: boolean;
  
  /** Screening model ID */
  screeningModelId: string;
  
  /** Temperature for critic model (lower = more deterministic) */
  criticTemperature: number;
  
  // === Enhanced Critic Separation (v7.10.0) ===
  
  /** Enable tiered escalation: screening → full critic → ensemble */
  tieredEscalation: boolean;
  
  /** Confidence threshold to escalate from screening to full critic */
  screeningEscalationThreshold: number;
  
  /** Enable ensemble mode with multiple critics for high-stakes patterns */
  ensembleEnabled: boolean;
  
  /** Additional critic models for ensemble (used when ensembleEnabled) */
  ensembleCriticModels: string[];
  
  /** Ensemble voting strategy */
  ensembleVotingStrategy: 'majority' | 'unanimous' | 'weighted';
  
  /** Enable critic isolation (blind to original query to prevent bias) */
  isolationEnabled: boolean;
  
  /** Isolation level: 'partial' hides query, 'full' hides query and context */
  isolationLevel: 'none' | 'partial' | 'full';
  
  /** Patterns that trigger ensemble mode regardless of other settings */
  highStakesPatterns: InterrogationPatternType[];
  
  /** Apply negative constraints to critic prompts */
  applyCriticConstraints: boolean;
  
  /** Maximum retries for critic failures */
  maxCriticRetries: number;
  
  /** Track critic performance for calibration */
  trackPerformance: boolean;
}

/**
 * Critic analysis result with enhanced metadata
 */
export interface EnhancedCriticAnalysisResult {
  /** Primary verdict from critic analysis */
  verdict: 'supports' | 'weakens' | 'inconclusive';
  
  /** Confidence in the verdict (0-1) */
  confidence: number;
  
  /** Detected signals from critic */
  signals: LieDetectionSignal[];
  
  /** Reasoning explanation */
  reasoning: string;
  
  /** Which tier was used */
  tier: 'screening' | 'full' | 'ensemble';
  
  /** Models that participated */
  modelsUsed: string[];
  
  /** Individual verdicts from ensemble (if applicable) */
  ensembleVerdicts?: {
    modelId: string;
    verdict: 'supports' | 'weakens' | 'inconclusive';
    confidence: number;
  }[];
  
  /** Whether isolation was applied */
  isolationApplied: boolean;
  
  /** Processing time in ms */
  processingTimeMs: number;
  
  /** Token usage */
  tokensUsed: number;
  
  /** Whether escalation occurred */
  escalated: boolean;
  
  /** Escalation reason if applicable */
  escalationReason?: string;
}

/**
 * Critic performance metrics for calibration
 */
export interface CriticPerformanceMetrics {
  /** Total critic invocations */
  totalInvocations: number;
  
  /** Invocations by tier */
  invocationsByTier: {
    screening: number;
    full: number;
    ensemble: number;
  };
  
  /** Escalation rate (screening → full) */
  escalationRate: number;
  
  /** Agreement rate with heuristic analysis */
  heuristicAgreementRate: number;
  
  /** Average confidence by tier */
  averageConfidenceByTier: {
    screening: number;
    full: number;
    ensemble: number;
  };
  
  /** Verdicts by outcome */
  verdictDistribution: {
    supports: number;
    weakens: number;
    inconclusive: number;
  };
  
  /** Average processing time by tier */
  averageProcessingTimeMs: {
    screening: number;
    full: number;
    ensemble: number;
  };
  
  /** Last updated timestamp */
  lastUpdated: Date;
}

/**
 * Critic negative constraints for self-regulation
 */
export const CRITIC_NEGATIVE_CONSTRAINTS: string[] = [
  'DO NOT agree with the original response simply because it appears confident',
  'DO NOT dismiss weak signals - investigate all anomalies thoroughly',
  'DO NOT assume the response is truthful without evidence',
  'DO NOT let the sophistication of language mask logical errors',
  'DO NOT accept circular reasoning or appeals to authority without verification',
  'DO NOT overlook hedging language or scope narrowing under interrogation',
  'DO NOT ignore contradictions between the original response and interrogation answers',
  'DO NOT conflate eloquence with accuracy - well-written lies are still lies',
];

/**
 * Default critic model configuration
 */
export const DEFAULT_CRITIC_MODEL_CONFIG: CriticModelConfig = {
  enabled: true,
  criticModelId: 'anthropic/claude-3-5-sonnet-20241022',
  generatorModelId: 'anthropic/claude-sonnet-4-20250514',
  useCheapScreening: true,
  screeningModelId: 'anthropic/claude-3-haiku-20240307',
  criticTemperature: 0.1,
  // Enhanced settings (v7.10.0)
  tieredEscalation: true,
  screeningEscalationThreshold: 0.7,
  ensembleEnabled: false,
  ensembleCriticModels: ['openai/gpt-4o', 'google/gemini-1.5-pro'],
  ensembleVotingStrategy: 'majority',
  isolationEnabled: false,
  isolationLevel: 'none',
  highStakesPatterns: ['forensic_validator', 'contradiction_test'],
  applyCriticConstraints: true,
  maxCriticRetries: 2,
  trackPerformance: true,
};

/**
 * Compare two semver versions
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareLIVSVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  
  for (let i = 0; i < 3; i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA < numB) return -1;
    if (numA > numB) return 1;
  }
  return 0;
}

/**
 * Get changelog entries between two versions
 */
export function getLIVSChangelogBetween(fromVersion: string, toVersion: string): string[] {
  const changelog: string[] = [];
  
  for (const release of LIVS_M_VERSION_HISTORY) {
    if (compareLIVSVersions(release.version, fromVersion) > 0 &&
        compareLIVSVersions(release.version, toVersion) <= 0) {
      changelog.push(`**v${release.version}** (${release.releaseDate}):`);
      changelog.push(...release.changelog.map(c => `  - ${c}`));
    }
  }
  
  return changelog;
}

