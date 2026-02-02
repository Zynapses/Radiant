/**
 * AXIOM + CLARION Integrated Subsystem Types
 * 
 * AXIOM: Adaptive eXpert Intelligence Optimization Module
 * - Transforms vague queries into optimized prompts
 * - Domain signature management
 * - Prompt compilation pipeline
 * - Model routing and selection
 * 
 * CLARION: Context-aware Learning Adaptive Reasoning Interrogation ONtology
 * - Adaptive questioning system
 * - Question tree architecture
 * - Model-aware question selection
 * - Compiler feedback loop
 * 
 * Code Tags:
 * [AXIOM:CORE]     - Core Axiom pipeline
 * [AXIOM:DOMAIN]   - Domain signature handling
 * [AXIOM:PATTERN]  - Pattern storage/retrieval
 * [AXIOM:COMPILE]  - Prompt compilation
 * [AXIOM:ROUTE]    - Model routing/selection
 * [AXIOM:VARIANT]  - Model-specific variants
 * [CLARION:CORE]   - Core questioning logic
 * [CLARION:TREE]   - Question tree traversal
 * [CLARION:ADAPT]  - Answer-based adaptation
 * [CLARION:MODEL]  - Model-aware questioning
 * [CLARION:LEARN]  - Question effectiveness learning
 * [CLARION:LOCALE] - Localization support
 * [CLARION:FEEDBACK] - Compiler feedback loop
 * 
 * @version 2.0.0
 * @since RADIANT v6.0.0
 */

// =============================================================================
// [CLARION:CORE] Session Types
// =============================================================================

export type ClarionQuestionType = 'choice' | 'multi_select' | 'text' | 'scale' | 'boolean';
export type ClarionQuestionCategory = 'intent' | 'scope' | 'constraints' | 'format' | 'context';
export type ClarionSessionStatus = 'active' | 'ready_to_compile' | 'awaiting_clarification' | 'completed' | 'abandoned';

/**
 * [CLARION:TREE] Multi-language question text
 */
export interface ClarionLocalizedText {
  en: string;
  es?: string;
  de?: string;
  fr?: string;
  ja?: string;
  zh?: string;
  [locale: string]: string | undefined;
}

/**
 * [CLARION:MODEL] Model-specific question rules
 */
export interface ClarionModelQuestionRules {
  modelId: string;
  boostQuestions: string[];
  boostAmount: number;  // 0.0 - 0.5
  skipQuestions: string[];
  requireQuestions: string[];
  prefersStructured: boolean;
  prefersExamples: boolean;
  maxContextTokens: number;
}

/**
 * [CLARION:TREE] Signal sent to model selection when answer is given
 */
export interface ClarionModelSignal {
  modelId: string;
  adjustment: number;  // -1.0 to 1.0
  reason: string;
}

/**
 * [CLARION:TREE] Branching logic for question answers
 */
export interface ClarionQuestionBranch {
  nextQuestions: string[];
  skipQuestions: string[];
  modelSignals: ClarionModelSignal[];
}

/**
 * [CLARION:TREE] Question definition
 */
export interface ClarionQuestion {
  questionId: string;
  domainApplicability: string[];  // Which domains this question applies to
  type: ClarionQuestionType;
  text: ClarionLocalizedText;
  options?: {
    [locale: string]: string[];
  };
  branches?: {
    [answer: string]: ClarionQuestionBranch;
  };
  priority: number;              // Base priority (0-1)
  informationGain: number;       // Expected uncertainty reduction
  category: ClarionQuestionCategory;
  requiresAnswers?: string[];
  conflictsWith?: string[];
  modelRules?: {
    [modelId: string]: {
      skip: boolean;
      require: boolean;
      priorityBoost: number;
    };
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * [CLARION:CORE] User's answer to a question
 */
export interface ClarionAnswer {
  questionId: string;
  value: string | string[] | number | boolean;
  timestamp: string;
  responseTimeMs: number;
}

/**
 * [CLARION:CORE] Model prediction during questioning
 */
export interface ClarionModelPrediction {
  modelId: string;
  modelName: string;
  provider: string;
  score: number;          // 0-1 predicted match quality
  confidence: number;     // 0-1 confidence in prediction
  reasons: string[];
  updatedAt: string;
}

/**
 * [CLARION:CORE] Working context during session (ephemeral)
 */
export interface ClarionWorkingContext {
  inferredIntent: string;
  predictedComplexity: number;
  confidenceTrajectory: number[];
  compilerClarificationPending: boolean;
}

/**
 * [CLARION:CORE] Session state
 */
export interface ClarionSession {
  sessionId: string;
  tenantId: string;
  userId: string;
  chainId: string;           // Key Chain identity
  domain: string;
  originalQuery: string;
  locale: string;
  status: ClarionSessionStatus;
  answers: Record<string, ClarionAnswer>;
  askedQuestions: string[];
  skippedQuestions: string[];
  currentConfidence: number;
  modelPredictions: ClarionModelPrediction[];
  workingContext: ClarionWorkingContext;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

/**
 * [CLARION:CORE] Stopping criteria for questioning
 */
export interface ClarionStoppingCriteria {
  maxQuestions: number;           // Default: 5
  confidenceThreshold: number;    // Default: 0.85
  userRequestedStop: boolean;
  timeBudgetExceeded: boolean;
  allCriticalAnswered: boolean;
}

/**
 * [CLARION:FEEDBACK] Compiler clarification request
 */
export interface ClarionCompilerClarificationRequest {
  sessionId: string;
  ambiguityType: 'missing_slot' | 'conflicting_answers' | 'low_confidence_inference';
  details: {
    slotName?: string;
    conflictingKeys?: string[];
    inferenceConfidence?: number;
  };
  suggestedQuestions: string[];
  priority: 'required' | 'recommended' | 'optional';
}

/**
 * [CLARION:LEARN] Question effectiveness tracking
 */
export interface ClarionQuestionEffectiveness {
  questionId: string;
  domain: string;
  askCount: number;
  skipCount: number;
  averageInformationGain: number;
  outcomeCorrelation: number;    // Correlation with positive outcomes
  lastUpdated: string;
}

// =============================================================================
// [AXIOM:DOMAIN] Domain Signature Types
// =============================================================================

/**
 * [AXIOM:DOMAIN] Template slot definition
 */
export interface AxiomSlotDefinition {
  description: string;
  required: boolean;
  defaultValue?: string;
  mapsToQuestion?: string;  // CLARION question ID
  validationRegex?: string;
  examples?: string[];
}

/**
 * [AXIOM:DOMAIN] Domain signature template
 */
export interface AxiomDomainTemplate {
  systemPrompt: string;
  userPromptPrefix: string;
  userPromptSuffix: string;
  slots: Record<string, AxiomSlotDefinition>;
}

/**
 * [AXIOM:DOMAIN] Model preferences for a domain
 */
export interface AxiomModelPreferences {
  primary: string[];
  fallback: string[];
  avoid: string[];
  proficiencyRequirements: Record<string, number>;
}

/**
 * [AXIOM:DOMAIN] Domain signature - complete domain definition
 */
export interface AxiomDomainSignature {
  domainId: string;
  domainPath: string[];           // e.g., ["legal", "contracts", "saas"]
  template: AxiomDomainTemplate;
  modelPreferences: AxiomModelPreferences;
  version: string;
  effectivenessScore: number;
  usageCount: number;
  lastUpdated: string;
  createdAt: string;
}

// =============================================================================
// [AXIOM:PATTERN] Pattern Types
// =============================================================================

export type AxiomPatternType = 'system_augment' | 'user_augment' | 'example' | 'constraint' | 'format';
export type AxiomPatternOrigin = 'human_curated' | 'evolved' | 'invented' | 'user_contributed';

/**
 * [AXIOM:PATTERN] Prompt pattern definition
 */
export interface AxiomPromptPattern {
  patternId: string;
  domainId: string;
  type: AxiomPatternType;
  content: string;
  embedding?: number[];          // 1536-dim vector
  usageCount: number;
  successRate: number;
  lastUsed: string;
  origin: AxiomPatternOrigin;
  parentPatterns?: string[];     // For evolved patterns
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// [AXIOM:COMPILE] Compilation Types
// =============================================================================

export type AxiomCompilationStatus = 'pending' | 'compiling' | 'ready' | 'awaiting_clarification' | 'failed';

/**
 * [AXIOM:COMPILE] Filled template after slot substitution
 */
export interface AxiomFilledTemplate {
  systemPrompt: string;
  userPrompt: string;
}

/**
 * [AXIOM:COMPILE] Compiled prompt result
 */
export interface AxiomCompiledPrompt {
  status: AxiomCompilationStatus;
  prompt?: AxiomFilledTemplate;
  model?: AxiomModelSelection;
  metadata?: {
    domain: string;
    patternsUsed: string[];
    confidence: number;
    compilationVersion: string;
    compiledAt: string;
  };
  missingSlots?: string[];
  errors?: string[];
}

/**
 * [AXIOM:ROUTE] Model selection result
 */
export interface AxiomModelSelection {
  modelId: string;
  modelName: string;
  provider: string;
  selectionReason: string;
  matchScore: number;
  strengths: string[];
  weaknesses: string[];
  estimatedLatencyMs: number;
  estimatedCostPer1kTokens: number;
  alternativeModels?: Array<{
    modelId: string;
    modelName: string;
    matchScore: number;
  }>;
}

// =============================================================================
// [AXIOM:VARIANT] Model Variant Types
// =============================================================================

/**
 * [AXIOM:VARIANT] Model-specific rules for prompt formatting
 */
export interface AxiomModelVariantRules {
  modelId: string;
  prefersStructured: boolean;
  requiresExplicitFormat: boolean;
  maxContextTokens: number;
  temperatureDefault: number;
  topPDefault: number;
  systemPromptStyle: 'verbose' | 'concise' | 'structured';
  preferredOutputFormat?: 'json' | 'markdown' | 'plain';
}

// =============================================================================
// [CORTEX:NEURAL] Neural Network Types (shared with neural-operations)
// =============================================================================

/**
 * AXIOM Scorer IDs
 * 
 * The 8 AXIOM Scorers (lightweight MLPs for scoring/ranking):
 * 
 * 1. Domain Scorer      - Classifies queries into 800+ domain taxonomy
 * 2. CLARION Scorer     - Scores question relevance for adaptive questioning
 * 3. Pattern Scorer     - Ranks prompt patterns for retrieval
 * 4. Model Scorer       - Scores individual models for task suitability
 * 5. Topology Scorer    - Evaluates orchestration strategies (single/multi/chain)
 * 6. Combination Scorer - Scores multi-model combinations for ensemble tasks
 * 7. Variant Scorer     - Scores prompt variants for model-specific optimization
 * 8. User Scorer        - Personalizes scores via Ghost Vector integration
 */
export type AxiomScorerId = 
  | 'domain'       // Domain Scorer - classifies into 800+ domains
  | 'clarion'      // CLARION Scorer - scores question relevance
  | 'pattern'      // Pattern Scorer - ranks patterns for retrieval
  | 'model'        // Model Scorer - selects optimal model
  | 'topology'     // Topology Scorer - evaluates orchestration strategies
  | 'combination'  // Combination Scorer - scores multi-model combinations
  | 'variant'      // Variant Scorer - scores prompt variants
  | 'user';        // User Scorer - personalizes via Ghost Vector

/** @deprecated Use AxiomScorerId instead */
export type AxiomCortexNetworkId = AxiomScorerId;

/**
 * Scorer configuration for AXIOM
 */
export interface AxiomScorerConfig {
  scorerId: AxiomScorerId;
  name: string;
  description: string;
  parameters: number;
  inputDim: number;
  outputDim: number;
  hiddenLayers: number[];
  activationFunction: 'relu' | 'gelu' | 'silu';
  version: string;
}

/** @deprecated Use AxiomScorerConfig instead */
export type AxiomNeuralNetworkConfig = AxiomScorerConfig;

/**
 * Full AXIOM Scorer configuration
 */
export const AXIOM_SCORER_CONFIG: Record<AxiomScorerId, AxiomScorerConfig> = {
  domain: {
    scorerId: 'domain',
    name: 'Domain Scorer',
    description: 'Classifies query into 800+ domain taxonomy',
    parameters: 1000000,
    inputDim: 1536,
    outputDim: 800,
    hiddenLayers: [512, 256],
    activationFunction: 'gelu',
    version: '1.0.0',
  },
  clarion: {
    scorerId: 'clarion',
    name: 'CLARION Scorer',
    description: 'Scores question relevance for adaptive questioning',
    parameters: 400000,
    inputDim: 1536,
    outputDim: 1,
    hiddenLayers: [512, 256],
    activationFunction: 'gelu',
    version: '1.0.0',
  },
  pattern: {
    scorerId: 'pattern',
    name: 'Pattern Scorer',
    description: 'Ranks patterns for context retrieval',
    parameters: 500000,
    inputDim: 3072,  // Concatenated embeddings
    outputDim: 1,
    hiddenLayers: [512, 256],
    activationFunction: 'gelu',
    version: '1.0.0',
  },
  model: {
    scorerId: 'model',
    name: 'Model Scorer',
    description: 'Selects optimal AI model for task',
    parameters: 200000,
    inputDim: 1536,
    outputDim: 106,  // Number of models
    hiddenLayers: [256, 128],
    activationFunction: 'gelu',
    version: '1.0.0',
  },
  topology: {
    scorerId: 'topology',
    name: 'Topology Scorer',
    description: 'Evaluates orchestration strategies (single model, multi-model, chain-of-thought, parallel)',
    parameters: 800000,
    inputDim: 512,   // task_features (256) + topology_features (256)
    outputDim: 9,    // 9 orchestration modes
    hiddenLayers: [256, 128, 64],
    activationFunction: 'gelu',
    version: '1.0.0',
  },
  combination: {
    scorerId: 'combination',
    name: 'Combination Scorer',
    description: 'Scores multi-model combinations for ensemble and consensus tasks',
    parameters: 150000,
    inputDim: 640,   // task_features (256) + model_pair_features (384)
    outputDim: 1,    // combination quality score
    hiddenLayers: [256, 128, 64],
    activationFunction: 'gelu',
    version: '1.0.0',
  },
  variant: {
    scorerId: 'variant',
    name: 'Variant Scorer',
    description: 'Scores prompt variants for model-specific optimization',
    parameters: 200000,
    inputDim: 1536,
    outputDim: 1,
    hiddenLayers: [256, 128],
    activationFunction: 'gelu',
    version: '1.0.0',
  },
  user: {
    scorerId: 'user',
    name: 'User Scorer',
    description: 'Personalizes via Ghost Vector integration',
    parameters: 50000,
    inputDim: 128,
    outputDim: 64,
    hiddenLayers: [64, 32],
    activationFunction: 'relu',
    version: '1.0.0',
  },
};

// =============================================================================
// [SERVICE:API] API Request/Response Types
// =============================================================================

/**
 * Start AXIOM session request
 */
export interface AxiomStartSessionRequest {
  tenantId: string;
  userId: string;
  query: string;
  locale?: string;
  chainId?: string;
  conversationId?: string;
  manualDomainOverride?: {
    fieldId?: string;
    domainId?: string;
    subspecialtyId?: string;
  };
}

/**
 * AXIOM session response
 */
export interface AxiomSessionResponse {
  sessionId: string;
  status: ClarionSessionStatus;
  domain: string;
  domainConfidence: number;
  currentQuestion?: ClarionQuestion;
  questionNumber: number;
  totalQuestionsMax: number;
  modelPredictions: ClarionModelPrediction[];
  readyToCompile: boolean;
}

/**
 * Submit answer request
 */
export interface AxiomSubmitAnswerRequest {
  sessionId: string;
  questionId: string;
  answer: string | string[] | number | boolean;
}

/**
 * Submit answer response
 */
export interface AxiomSubmitAnswerResponse {
  sessionId: string;
  answerAccepted: boolean;
  newConfidence: number;
  nextQuestion?: ClarionQuestion;
  modelPredictions: ClarionModelPrediction[];
  readyToCompile: boolean;
  status: ClarionSessionStatus;
}

/**
 * Compile prompt request
 */
export interface AxiomCompileRequest {
  sessionId: string;
  forceCompile?: boolean;  // Skip remaining questions
}

/**
 * Compile prompt response
 */
export interface AxiomCompileResponse {
  sessionId: string;
  status: AxiomCompilationStatus;
  compiledPrompt?: AxiomCompiledPrompt;
  clarificationNeeded?: ClarionCompilerClarificationRequest;
}

/**
 * Skip question request
 */
export interface AxiomSkipQuestionRequest {
  sessionId: string;
  questionId: string;
  reason?: string;
}

// =============================================================================
// [SERVICE:UI] Think Tank UI Types
// =============================================================================

export type AxiomWorkflowStep = 'classify' | 'clarify' | 'compile' | 'route';

/**
 * Workflow progress for UI display
 */
export interface AxiomWorkflowProgress {
  currentStep: AxiomWorkflowStep;
  steps: Array<{
    step: AxiomWorkflowStep;
    label: string;
    status: 'pending' | 'active' | 'completed';
    duration?: number;
  }>;
  overallProgress: number;  // 0-100
}

/**
 * Model score bar for UI visualization
 */
export interface AxiomModelScoreBar {
  modelId: string;
  modelName: string;
  provider: string;
  score: number;           // 0-100
  previousScore?: number;  // For animation
  isLeading: boolean;
  reasons: string[];
}

/**
 * Full session state for UI
 */
export interface AxiomForgeState {
  sessionId: string;
  status: ClarionSessionStatus;
  workflow: AxiomWorkflowProgress;
  domain: {
    path: string[];
    name: string;
    confidence: number;
  };
  questions: {
    current?: ClarionQuestion;
    answered: number;
    total: number;
    history: Array<{
      question: ClarionQuestion;
      answer: ClarionAnswer;
    }>;
  };
  modelScores: AxiomModelScoreBar[];
  compiledPrompt?: {
    preview: string;
    canEdit: boolean;
    tokenCount: number;
  };
  isStreaming: boolean;
  error?: string;
}

// =============================================================================
// [CATO:DREAM] Training Pipeline Types
// =============================================================================

export type CatoEvolutionType = 'evolution' | 'invention';

/**
 * CATO nightly training signal
 */
export interface CatoTrainingSignal {
  sessionId: string;
  domain: string;
  questionsAsked: string[];
  answersGiven: Record<string, ClarionAnswer>;
  compiledPromptHash: string;
  modelUsed: string;
  userRating?: number;       // 1-5
  outcomeQuality?: number;   // 0-1 from automated metrics
  tokensUsed: number;
  latencyMs: number;
  createdAt: string;
}

/**
 * Pattern evolution result from CATO
 */
export interface CatoPatternEvolution {
  evolutionId: string;
  type: CatoEvolutionType;
  domain: string;
  parentPatterns: string[];
  newPattern: AxiomPromptPattern;
  fitnessScore: number;
  inventionRatio: number;    // Must be >= 0.30
  createdAt: string;
}

// =============================================================================
// [IDENTITY:CHAIN] Key Chain Types
// =============================================================================

export type KeyChainUserType = 'anonymous' | 'authenticated' | 'enterprise';

/**
 * Key Chain identity for user
 */
export interface AxiomKeyChain {
  chainId: string;
  userType: KeyChainUserType;
  tenantId?: string;
  userId?: string;
  deviceFingerprint?: string;
  sessionHistory: string[];
  learningTier: 'user' | 'tenant' | 'global';
  createdAt: string;
  lastSeenAt: string;
}

// =============================================================================
// Constants
// =============================================================================

export const CLARION_DEFAULTS = {
  maxQuestions: 5,
  confidenceThreshold: 0.85,
  minInformationGain: 0.1,
  skipPenalty: 0.15,
  sessionTimeoutMinutes: 30,
} as const;

export const AXIOM_DEFAULTS = {
  maxPatternsRetrieved: 5,
  minPatternScore: 0.3,
  compilationTimeoutMs: 5000,
  variantGenerationCount: 3,
} as const;

export const QUESTION_SCORE_WEIGHTS = {
  neural: 0.40,           // CLARION Network prediction
  infoGain: 0.25,         // Expected information gain
  skipRateInverse: 0.15,  // (1 - historical skip rate)
  modelRelevance: 0.10,   // Relevance to predicted models
  recency: 0.10,          // Boost newer questions
} as const;
