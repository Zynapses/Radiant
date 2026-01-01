/**
 * RADIANT v6.1.0 - Advanced Cognition Types
 */

// ============================================================================
// REASONING TEACHER TYPES
// ============================================================================

export type TeacherModelId = 
  | 'claude-opus-4-5-extended'
  | 'gemini-2-5-pro'
  | 'o3'
  | 'claude-sonnet-4'
  | 'deepseek-r1';

export interface TeacherConfig {
  defaultTeacher: TeacherModelId;
  taskTypeMapping: Record<string, TeacherModelId>;
  maxConcurrentTraces: number;
  traceQualityThreshold: number;
  maxTokensPerTrace: number;
}

export interface ReasoningTrace {
  id: string;
  tenantId: string;
  inputPrompt: string;
  inputContext: Record<string, unknown>;
  taskType: string;
  domainIds: string[];
  teacherModelId: TeacherModelId;
  teacherResponse: string;
  reasoningTrace: string;
  confidenceScore: number;
  alternativePaths: AlternativePath[];
  generationLatencyMs: number;
  tokenCountInput: number;
  tokenCountOutput: number;
  costUsd: number;
  status: 'pending' | 'validated' | 'used' | 'rejected';
  qualityScore: number | null;
  validatedBy: string | null;
  usedInTrainingJob: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlternativePath {
  path: string;
  confidence: number;
  reason: string;
}

// ============================================================================
// INFERENCE STUDENT TYPES
// ============================================================================

export interface StudentVersion {
  id: string;
  tenantId: string;
  versionNumber: number;
  baseModel: string;
  trainingJobId: string | null;
  trainingExamplesCount: number;
  trainingEpochs: number;
  accuracyScore: number | null;
  latencyP50Ms: number | null;
  latencyP99Ms: number | null;
  sagemakerEndpointName: string | null;
  isActive: boolean;
  promotedAt: Date | null;
  createdAt: Date;
}

export interface StudentInferenceRequest {
  prompt: string;
  context: Record<string, unknown>;
  tenantId: string;
  userId: string;
  n?: number;
  temperature?: number;
  maxTokens?: number;
}

export interface StudentInferenceResponse {
  responses: string[];
  latencyMs: number;
  tokensUsed: number;
  modelVersion: number;
}

// ============================================================================
// SEMANTIC CACHE TYPES
// ============================================================================

export interface SemanticCacheEntry {
  id: string;
  tenantId: string;
  queryEmbedding: number[];
  modelId: string;
  domainIds: string[];
  contextHash: string | null;
  response: string;
  responseEmbedding: number[] | null;
  createdAt: Date;
  expiresAt: Date;
  hitCount: number;
  lastHitAt: Date | null;
  userFeedbackAvg: number | null;
  feedbackCount: number;
  wasInvalidated: boolean;
}

export type ContentType = 'factual' | 'code' | 'creative' | 'time_sensitive' | 'user_specific';

export interface CacheTTLConfig {
  contentType: ContentType;
  baseTtlMinutes: number;
  hitBonus: number;
  maxTtlMinutes: number;
}

export interface CacheMetrics {
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  avgHitLatencyMs: number;
  avgMissLatencyMs: number;
  estimatedCostSaved: number;
}

// ============================================================================
// METACOGNITION TYPES
// ============================================================================

export interface ConfidenceAssessment {
  overallConfidence: number;
  factors: {
    logitsEntropy: number;
    responseConsistency: number;
    domainMatchScore: number;
    historicalAccuracy: number;
  };
  uncertaintyReasons: string[];
  suggestedAction: 'proceed' | 'escalate' | 'clarify' | 'defer';
}

export interface EscalationDecision {
  shouldEscalate: boolean;
  reason: string;
  targetModel?: string;
  userClarificationNeeded?: boolean;
}

export interface SelfCorrectionResult {
  originalResponse: string;
  correctedResponse: string;
  iterations: number;
  corrections: CorrectionStep[];
  finalConfidence: number;
}

export interface CorrectionStep {
  iteration: number;
  critique: string;
  revision: string;
  confidenceAfter: number;
}

// ============================================================================
// REWARD MODEL TYPES
// ============================================================================

export interface RewardContext {
  userId: string;
  tenantId: string;
  conversationHistory: Message[];
  originalPrompt: string;
  domainIds: string[];
  userPreferences: UserPreferences;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface UserPreferences {
  responseLength: 'concise' | 'detailed' | 'balanced';
  formalityLevel: 'casual' | 'professional' | 'academic';
  preferredModels: string[];
}

export interface RewardScore {
  overall: number;
  dimensions: {
    relevance: number;
    accuracy: number;
    helpfulness: number;
    safety: number;
    style: number;
  };
  confidence: number;
}

export interface RewardTrainingData {
  id: string;
  tenantId: string;
  userId: string;
  prompt: string;
  context: Record<string, unknown>;
  winningResponse: string;
  winningModelId: string | null;
  losingResponse: string;
  losingModelId: string | null;
  signalType: 'explicit_feedback' | 'regeneration' | 'dwell_time' | 'copy' | 'share';
  signalStrength: number;
  domainIds: string[];
  createdAt: Date;
  usedInTraining: boolean;
}

// ============================================================================
// COUNTERFACTUAL TYPES
// ============================================================================

export interface CounterfactualResult {
  id: string;
  traceId: string;
  tenantId: string;
  originalModel: string;
  originalResponse: string;
  originalLatencyMs: number | null;
  originalCost: number | null;
  originalRewardScore: number | null;
  alternativeModel: string;
  alternativeResponse: string | null;
  alternativeLatencyMs: number | null;
  alternativeCost: number | null;
  alternativeRewardScore: number | null;
  preferredByReward: 'original' | 'alternative' | 'equal' | null;
  qualityDelta: number | null;
  costDelta: number | null;
  sampleReason: 'regeneration' | 'low_confidence' | 'high_cost' | 'random';
  createdAt: Date;
}

// ============================================================================
// CURIOSITY ENGINE TYPES
// ============================================================================

export interface KnowledgeGap {
  id: string;
  tenantId: string;
  domain: string;
  topic: string;
  evidenceOfGap: string[];
  frequency: number;
  importance: number;
  createdAt: Date;
  updatedAt: Date;
}

export type GoalType = 'assigned' | 'inferred' | 'emergent' | 'maintenance';
export type GoalStatus = 'pending' | 'active' | 'completed' | 'abandoned';

export interface Goal {
  id: string;
  tenantId: string;
  type: GoalType;
  description: string;
  priority: number;
  status: GoalStatus;
  curiositySourceId: string | null;
  explorationStrategy: string | null;
  progress: number;
  milestones: Milestone[];
  tokensUsed: number;
  costUsed: number;
  createdAt: Date;
  targetCompletionDate: Date | null;
  completedAt: Date | null;
}

export interface Milestone {
  id: string;
  description: string;
  completed: boolean;
  completedAt: Date | null;
}

export interface GoalGuardrails {
  maxCuriosityTokensPerDay: number;
  maxCuriosityApiCostPerDay: number;
  forbiddenPatterns: string[];
  requireApprovalAbove: number;
  canModifyOwnWeights: boolean;
  canModifyOwnGoals: boolean;
}

// ============================================================================
// CAUSAL TRACKER TYPES
// ============================================================================

export type CausalType = 
  | 'reference'
  | 'elaboration'
  | 'correction'
  | 'consequence'
  | 'contradiction'
  | 'continuation';

export interface CausalLink {
  id: string;
  tenantId: string;
  conversationId: string;
  sourceTurnId: string;
  targetTurnId: string;
  causalType: CausalType;
  strength: number;
  createdAt: Date;
}

export interface CausalChain {
  rootTurnId: string;
  nodes: CausalNode[];
  edges: CausalEdge[];
  depth: number;
  criticalPath: string[];
}

export interface CausalNode {
  turnId: string;
  summary: string;
  importance: number;
  timestamp: Date;
}

export interface CausalEdge {
  sourceId: string;
  targetId: string;
  causalType: CausalType;
  strength: number;
}

// ============================================================================
// DISTILLATION PIPELINE TYPES
// ============================================================================

export type DistillationJobStatus = 'collecting' | 'preparing' | 'training' | 'evaluating' | 'completed' | 'failed';

export interface DistillationJob {
  id: string;
  tenantId: string;
  status: DistillationJobStatus;
  examplesCollected: number;
  trainingJobArn: string | null;
  studentVersionId: string | null;
  startedAt: Date;
  completedAt: Date | null;
  errorMessage: string | null;
}

// ============================================================================
// INFERENCE CONTEXT (for metacognition)
// ============================================================================

export interface InferenceContext {
  userId: string;
  tenantId: string;
  requestId: string;
  prompt: string;
  domainIds: string[];
  modelUsed: string;
  logitsEntropy?: number;
}
