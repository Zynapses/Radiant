// RADIANT v4.18.0 - Common AGI Types
// Strongly typed definitions for AGI services to replace Record<string, unknown>

// ============================================================================
// Parameter Types (replacing Record<string, unknown> for parameters)
// ============================================================================

export interface MethodParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  required?: boolean;
  default?: unknown;
  min?: number;
  max?: number;
  enum?: string[];
}

export interface ParameterSchema {
  parameters: MethodParameter[];
  required?: string[];
  additionalProperties?: boolean;
}

export interface MethodParameters {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stopSequences?: string[];
  systemPrompt?: string;
  outputFormat?: 'text' | 'json' | 'markdown';
  [key: string]: string | number | boolean | string[] | undefined;
}

// ============================================================================
// Configuration Types (replacing Record<string, unknown> for configs)
// ============================================================================

export interface WorkflowConfig {
  maxIterations?: number;
  timeoutMs?: number;
  retryCount?: number;
  parallelism?: number;
  synthesisStrategy?: 'best_of' | 'merge' | 'vote' | 'weighted';
  qualityThreshold?: number;
  costLimit?: number;
  models?: string[];
  fallbackModels?: string[];
}

export interface StepConfig extends WorkflowConfig {
  skipOnFailure?: boolean;
  cacheResults?: boolean;
  cacheTtlMs?: number;
  outputVariable?: string;
  conditionExpression?: string;
}

export interface OrchestrationConfig {
  workflow: WorkflowConfig;
  steps: Record<string, StepConfig>;
  global?: {
    tenantId: string;
    userId?: string;
    sessionId?: string;
    requestId?: string;
    traceId?: string;
  };
}

// ============================================================================
// Metadata Types (replacing Record<string, unknown> for metadata)
// ============================================================================

export interface RequestMetadata {
  requestId: string;
  tenantId: string;
  userId?: string;
  sessionId?: string;
  conversationId?: string;
  timestamp: string;
  source?: string;
  clientIp?: string;
  userAgent?: string;
}

export interface ResponseMetadata {
  responseId: string;
  requestId: string;
  modelId: string;
  provider: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  cached: boolean;
  timestamp: string;
}

export interface StepMetadata {
  stepId: string;
  stepNumber: number;
  methodId: string;
  modelId: string;
  startTime: string;
  endTime?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  inputHash?: string;
  outputHash?: string;
  errorMessage?: string;
}

// ============================================================================
// Event Data Types (replacing Record<string, unknown> for event data)
// ============================================================================

export interface ConsciousnessEventData {
  eventType: 'attention_shift' | 'memory_access' | 'goal_update' | 'reflection' | 'decision';
  triggerSource?: string;
  previousState?: string;
  newState?: string;
  confidence?: number;
  relevantContext?: string[];
}

export interface LearningEventData {
  eventType: 'feedback' | 'correction' | 'preference' | 'pattern_detected';
  interactionId?: string;
  rating?: 'positive' | 'negative' | 'neutral';
  feedbackText?: string;
  correctedOutput?: string;
  patternId?: string;
  patternConfidence?: number;
}

export interface OrchestrationEventData {
  eventType: 'workflow_start' | 'workflow_end' | 'step_start' | 'step_end' | 'error' | 'retry';
  workflowId?: string;
  stepId?: string;
  modelId?: string;
  duration?: number;
  errorCode?: string;
  retryCount?: number;
}

// ============================================================================
// State Types (replacing Record<string, unknown> for states)
// ============================================================================

export interface WorkspaceState {
  activeContent: string[];
  focusedItem?: string;
  attentionWeights: Record<string, number>;
  lastUpdated: string;
}

export interface MemoryState {
  shortTermItems: string[];
  workingMemoryCapacity: number;
  consolidationQueue: string[];
  retrievalContext?: string;
}

export interface GoalState {
  activeGoals: {
    goalId: string;
    description: string;
    priority: number;
    progress: number;
    subgoals?: string[];
  }[];
  completedGoals: string[];
  blockedGoals: string[];
}

export interface SelfModelState {
  capabilities: string[];
  limitations: string[];
  confidenceCalibration: number;
  currentLoad: number;
  recentPerformance: {
    successRate: number;
    avgLatency: number;
    avgQuality: number;
  };
}

// ============================================================================
// Result Types (replacing Record<string, unknown> for results)
// ============================================================================

export interface StepResult {
  stepId: string;
  status: 'success' | 'failure' | 'partial';
  output: string;
  structuredOutput?: Record<string, unknown>;
  confidence?: number;
  metadata: StepMetadata;
  artifacts?: string[];
  citations?: string[];
}

export interface WorkflowResult {
  workflowId: string;
  status: 'success' | 'failure' | 'partial' | 'cancelled';
  finalOutput: string;
  stepResults: StepResult[];
  synthesizedOutput?: string;
  totalLatencyMs: number;
  totalCostCents: number;
  qualityScore?: number;
  metadata: ResponseMetadata;
}

export interface OrchestrationResult {
  orchestrationId: string;
  planId?: string;
  request: RequestMetadata;
  response: ResponseMetadata;
  workflow?: WorkflowResult;
  directResult?: {
    output: string;
    modelId: string;
    confidence: number;
  };
  feedback?: {
    feedbackId: string;
    rating?: 'positive' | 'negative' | 'neutral';
    comment?: string;
  };
}

// ============================================================================
// Weight/Score Types (replacing generic numbers)
// ============================================================================

export interface ServiceWeight {
  serviceId: string;
  weight: number; // 0.0 - 1.0
  isEnabled: boolean;
  description?: string;
}

export interface ConfidenceScore {
  value: number; // 0.0 - 1.0
  source: 'model' | 'calibrated' | 'aggregated' | 'estimated';
  factors?: {
    factor: string;
    contribution: number;
  }[];
}

export interface QualityMetrics {
  accuracy: number;
  coherence: number;
  relevance: number;
  completeness: number;
  factuality?: number;
  overall: number;
}

// ============================================================================
// Database Row Types (for type-safe DB queries)
// ============================================================================

export interface BaseDbRow {
  created_at: string | Date;
  updated_at?: string | Date;
}

export interface TenantDbRow extends BaseDbRow {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  is_active: boolean;
  settings?: string; // JSON string
}

export interface WorkflowDbRow extends BaseDbRow {
  workflow_id: string;
  workflow_code: string;
  common_name: string;
  formal_name: string;
  category: string;
  category_code: string;
  pattern_number: number;
  description: string;
  detailed_description?: string;
  best_for?: string; // JSON array
  problem_indicators?: string; // JSON array
  quality_improvement?: string;
  typical_latency?: string;
  typical_cost?: string;
  min_models_required: number;
  default_config?: string; // JSON object
  is_system_workflow: boolean;
  is_enabled: boolean;
  avg_quality_score?: number;
}

export interface MethodDbRow extends BaseDbRow {
  method_id: string;
  method_code: string;
  method_name: string;
  description: string;
  method_category: string;
  default_parameters?: string; // JSON object
  parameter_schema?: string; // JSON object
  implementation_type: 'prompt' | 'code' | 'composite' | 'external';
  prompt_template?: string;
  code_reference?: string;
  model_role: string;
  recommended_models?: string; // JSON array
  is_enabled: boolean;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isMethodParameters(obj: unknown): obj is MethodParameters {
  return typeof obj === 'object' && obj !== null;
}

export function isWorkflowConfig(obj: unknown): obj is WorkflowConfig {
  return typeof obj === 'object' && obj !== null;
}

export function isStepResult(obj: unknown): obj is StepResult {
  if (typeof obj !== 'object' || obj === null) return false;
  const r = obj as StepResult;
  return typeof r.stepId === 'string' && 
         typeof r.status === 'string' &&
         typeof r.output === 'string';
}

// ============================================================================
// JSON Parsing Helpers (safe parsing with type checking)
// ============================================================================

export function parseJsonField<T>(
  value: string | null | undefined,
  defaultValue: T
): T {
  if (!value) return defaultValue;
  try {
    return JSON.parse(value) as T;
  } catch {
    return defaultValue;
  }
}

export function parseArrayField(value: string | null | undefined): string[] {
  return parseJsonField<string[]>(value, []);
}

export function parseObjectField<T extends Record<string, unknown>>(
  value: string | null | undefined
): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}
