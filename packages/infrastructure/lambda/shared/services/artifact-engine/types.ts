// ============================================================================
// RADIANT Artifact Engine - Type Definitions
// packages/infrastructure/lambda/shared/services/artifact-engine/types.ts
// Version: 4.19.0
// ============================================================================

/**
 * Intent classification for artifact requests
 */
export type ArtifactIntentType =
  | 'calculator'
  | 'chart'
  | 'form'
  | 'table'
  | 'dashboard'
  | 'game'
  | 'visualization'
  | 'utility'
  | 'custom';

/**
 * Generation session status (state machine)
 * Status transitions:
 * pending -> planning -> generating/streaming -> validating -> [reflexion ->] completed|rejected|failed
 */
export type GenerationStatus =
  | 'pending'
  | 'planning'
  | 'generating'
  | 'streaming'
  | 'validating'
  | 'reflexion'
  | 'completed'
  | 'failed'
  | 'rejected';

/**
 * Final verification status for artifacts
 */
export type VerificationStatus = 'unverified' | 'validated' | 'rejected' | 'manual';

/**
 * Log entry types for real-time UI
 */
export type LogType =
  | 'thinking'
  | 'planning'
  | 'generating'
  | 'streaming_chunk'
  | 'validating'
  | 'reflexion'
  | 'error'
  | 'success';

/**
 * Validation rule severity
 */
export type ValidationSeverity = 'block' | 'warn' | 'log';

/**
 * Request to generate a new artifact
 */
export interface ArtifactGenerationRequest {
  tenantId: string;
  userId: string;
  chatId?: string;
  canvasId?: string;
  prompt: string;
  mood?: string;
  constraints?: {
    maxLines?: number;
    allowedDependencies?: string[];
    targetComplexity?: 'simple' | 'moderate' | 'complex';
  };
}

/**
 * Generated plan from Intent Classifier
 */
export interface ArtifactGenerationPlan {
  intent: ArtifactIntentType;
  complexity: 'simple' | 'moderate' | 'complex';
  steps: string[];
  estimatedTokens: number;
  suggestedModel: string;
  similarPatterns: Array<{
    patternId: string;
    similarity: number;
    patternName: string;
  }>;
  dependencies: string[];
}

/**
 * Cato CBF validation result
 */
export interface ArtifactValidationResult {
  isValid: boolean;
  errors: Array<{
    rule: string;
    severity: ValidationSeverity;
    message: string;
    line?: number;
    column?: number;
  }>;
  warnings: Array<{
    rule: string;
    message: string;
  }>;
  securityScore: number;
  passedCBFs: string[];
  failedCBFs: string[];
}

/**
 * Context for Reflexion self-correction
 */
export interface ReflexionContext {
  originalCode: string;
  errors: string[];
  attempt: number;
  maxAttempts: number;
  previousAttempts: Array<{
    code: string;
    errors: string[];
  }>;
}

/**
 * Result of a reflexion attempt
 */
export interface ReflexionResult {
  success: boolean;
  fixedCode: string;
  explanation: string;
}

/**
 * Final result of artifact generation
 */
export interface ArtifactGenerationResult {
  sessionId: string;
  artifactId?: string;
  status: GenerationStatus;
  verificationStatus: VerificationStatus;
  code?: string;
  validation?: ArtifactValidationResult;
  reflexionAttempts: number;
  tokensUsed: number;
  estimatedCost: number;
  generationTimeMs: number;
}

/**
 * Streaming chunk for real-time code delivery
 */
export interface StreamingChunk {
  sessionId: string;
  chunkIndex: number;
  content: string;
  isComplete: boolean;
  totalTokensSoFar: number;
}

/**
 * Database row types
 */
export interface ArtifactGenerationSessionRow {
  id: string;
  tenant_id: string;
  user_id: string;
  chat_id: string | null;
  canvas_id: string | null;
  prompt: string;
  intent_classification: string;
  plan: ArtifactGenerationPlan | null;
  estimated_complexity: string | null;
  selected_model: string | null;
  status: GenerationStatus;
  tokens_generated: number;
  stream_chunks_sent: number;
  cato_validation_result: ArtifactValidationResult | null;
  reflexion_attempts: number;
  max_reflexion_attempts: number;
  artifact_id: string | null;
  final_code: string | null;
  verification_status: string;
  total_tokens_used: number;
  estimated_cost: string;
  planning_started_at: Date | null;
  generation_started_at: Date | null;
  validation_started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ArtifactValidationRuleRow {
  id: string;
  rule_name: string;
  rule_type: string;
  description: string | null;
  validation_pattern: string | null;
  validation_function: string | null;
  severity: ValidationSeverity;
  error_message: string | null;
  is_active: boolean;
  created_at: Date;
}

export interface ArtifactCodePatternRow {
  id: string;
  tenant_id: string | null;
  pattern_name: string;
  pattern_type: string;
  description: string | null;
  template_code: string;
  dependencies: string[];
  embedding: number[] | null;
  usage_count: number;
  success_rate: string;
  average_generation_time_ms: number | null;
  scope: 'system' | 'tenant';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ArtifactDependencyAllowlistRow {
  id: string;
  tenant_id: string | null;
  package_name: string;
  package_version: string | null;
  reason: string | null;
  security_reviewed: boolean;
  reviewed_at: Date | null;
  reviewed_by: string | null;
  is_active: boolean;
  created_at: Date;
}

export interface ArtifactGenerationLogRow {
  id: string;
  session_id: string;
  log_type: LogType;
  message: string;
  metadata: Record<string, unknown>;
  created_at: Date;
}
