// RADIANT v4.18.0 - Result Derivation Types
// Comprehensive history tracking for Think Tank results

import type { OrchestrationMode, StepType } from './agi-brain-plan.types';

// ============================================================================
// Core Types
// ============================================================================

export interface ResultDerivation {
  id: string;
  sessionId: string;
  promptId: string;
  tenantId: string;
  userId: string;
  
  // The original prompt
  originalPrompt: string;
  
  // The final result
  finalResponse: string;
  
  // Plan that was executed
  plan: DerivationPlan;
  
  // All models used in generating the result
  modelsUsed: ModelUsageRecord[];
  
  // Complete workflow execution history
  workflow: WorkflowExecution;
  
  // Domain detection details
  domainDetection: DomainDetectionRecord;
  
  // Orchestration details
  orchestration: OrchestrationRecord;
  
  // Quality and verification
  qualityMetrics: QualityMetrics;
  
  // Timing and costs
  timing: TimingRecord;
  costs: CostRecord;
  
  // Metadata
  createdAt: Date;
  completedAt: Date;
}

// ============================================================================
// Plan Types
// ============================================================================

export interface DerivationPlan {
  planId: string;
  mode: OrchestrationMode;
  modeDescription: string;
  
  // Steps in the plan
  steps: DerivationStep[];
  
  // Plan generation details
  generatedAt: Date;
  generationLatencyMs: number;
  
  // Template used (if any)
  templateId?: string;
  templateName?: string;
}

export interface DerivationStep {
  stepId: string;
  stepNumber: number;
  type: StepType;
  name: string;
  description: string;
  
  // Execution status
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  
  // Timing
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  
  // Model used for this step
  modelId?: string;
  modelDisplayName?: string;
  
  // Step-specific details
  details?: Record<string, unknown>;
  
  // Error if failed
  error?: string;
}

// OrchestrationMode imported from agi-brain-plan.types

// StepType imported from agi-brain-plan.types

// ============================================================================
// Model Usage Types
// ============================================================================

export interface ModelUsageRecord {
  modelId: string;
  modelDisplayName: string;
  modelFamily: string;
  provider: 'self-hosted' | 'external';
  
  // What was this model used for
  purpose: ModelPurpose;
  stepId?: string;
  
  // Token usage
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  
  // Timing
  latencyMs: number;
  
  // Cost
  inputCost: number;
  outputCost: number;
  totalCost: number;
  
  // Selection reason
  selectionReason: string;
  selectionScore?: number;
  alternativesConsidered?: string[];
  
  // Quality
  qualityTier: 'premium' | 'standard' | 'economy';
  
  // Response details
  responseLength?: number;
  truncated?: boolean;
}

export type ModelPurpose =
  | 'primary_generation'
  | 'secondary_generation'
  | 'verification'
  | 'synthesis'
  | 'domain_detection'
  | 'ethics_check'
  | 'refinement'
  | 'embedding'
  | 'vision_analysis'
  | 'audio_processing'
  | 'code_generation';

// ============================================================================
// Workflow Types
// ============================================================================

export interface WorkflowExecution {
  workflowId: string;
  workflowType: WorkflowType;
  
  // All phases of execution
  phases: WorkflowPhase[];
  
  // Current state
  currentPhase?: string;
  overallStatus: 'pending' | 'running' | 'completed' | 'failed';
  
  // Retry information
  retryCount: number;
  maxRetries: number;
  
  // Fallback chain used
  fallbackChain?: FallbackRecord[];
}

export interface WorkflowPhase {
  phaseId: string;
  phaseName: string;
  phaseType: 'pre_execution' | 'execution' | 'post_execution';
  
  // Steps in this phase
  steps: WorkflowPhaseStep[];
  
  // Timing
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  
  // Status
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
}

export interface WorkflowPhaseStep {
  stepId: string;
  stepName: string;
  
  // Input/output snapshots
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  
  // Timing
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  
  // Status
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  error?: string;
}

export interface FallbackRecord {
  attemptNumber: number;
  originalModelId: string;
  fallbackModelId: string;
  reason: string;
  success: boolean;
}

export type WorkflowType =
  | 'simple_generation'
  | 'chain_of_thought'
  | 'multi_model_consensus'
  | 'self_consistency'
  | 'mixture_of_agents'
  | 'adversarial_verification'
  | 'deep_research';

// ============================================================================
// Domain Detection Types
// ============================================================================

export interface DomainDetectionRecord {
  detectedField: string;
  detectedDomain: string;
  detectedSubspecialty?: string;
  
  // Confidence scores
  fieldConfidence: number;
  domainConfidence: number;
  subspecialtyConfidence?: number;
  
  // Alternative detections
  alternativeDomains?: Array<{
    domain: string;
    confidence: number;
  }>;
  
  // Detection method
  detectionMethod: 'embedding' | 'classifier' | 'llm' | 'hybrid';
  
  // User override (if any)
  userOverride?: {
    field?: string;
    domain?: string;
    subspecialty?: string;
  };
  
  // Timing
  detectionLatencyMs: number;
}

// ============================================================================
// Orchestration Types
// ============================================================================

export interface OrchestrationRecord {
  // Mode selection
  selectedMode: OrchestrationMode;
  modeSelectionReason: string;
  alternativeModes?: Array<{
    mode: OrchestrationMode;
    score: number;
  }>;
  
  // Model selection strategy
  modelSelectionStrategy: 'best_fit' | 'cost_optimized' | 'speed_optimized' | 'quality_optimized';
  
  // Multi-model details (if applicable)
  multiModelConfig?: {
    modelCount: number;
    synthesisMethod: 'voting' | 'aggregation' | 'ranked_choice';
    agreementThreshold?: number;
  };
  
  // Complexity analysis
  complexityScore: number;
  complexityFactors: string[];
  
  // Context preparation
  contextPreparation: {
    tokensUsed: number;
    maxTokens: number;
    contextSources: string[];
    memoryIncluded: boolean;
    prepromptApplied?: string;
  };
  
  // Ethics check result
  ethicsCheck?: {
    passed: boolean;
    flags?: string[];
    modifications?: string[];
  };
}

// ============================================================================
// Quality Types
// ============================================================================

export interface QualityMetrics {
  // Overall quality score (0-100)
  overallScore: number;
  
  // Individual dimensions
  dimensions: {
    relevance: number;
    accuracy: number;
    completeness: number;
    clarity: number;
    coherence: number;
  };
  
  // Verification status
  verified: boolean;
  verificationMethod?: 'self_check' | 'adversarial' | 'human';
  verificationDetails?: Record<string, unknown>;
  
  // Confidence
  confidenceLevel: 'high' | 'medium' | 'low';
  uncertaintyFlags?: string[];
  
  // User feedback (if provided)
  userRating?: number;
  userFeedback?: string;
}

// ============================================================================
// Timing & Cost Types
// ============================================================================

export interface TimingRecord {
  // Total time
  totalDurationMs: number;
  
  // Breakdown
  breakdown: {
    planGeneration: number;
    domainDetection: number;
    modelSelection: number;
    contextPreparation: number;
    generation: number;
    verification: number;
    synthesis: number;
    postProcessing: number;
  };
  
  // Queue time (if applicable)
  queueTimeMs?: number;
  
  // Perceived latency class
  latencyClass: 'fast' | 'medium' | 'slow';
}

export interface CostRecord {
  // Total cost
  totalCost: number;
  currency: string;
  
  // Breakdown by model
  modelCosts: Array<{
    modelId: string;
    inputCost: number;
    outputCost: number;
    totalCost: number;
  }>;
  
  // Cost comparison
  estimatedSavingsVsExternal?: number;
  
  // Tier-based pricing
  tierMultiplier: number;
  baseCost: number;
  finalCost: number;
}

// ============================================================================
// Summary View Types (for UI display)
// ============================================================================

export interface DerivationSummary {
  id: string;
  promptPreview: string;
  responsePreview: string;
  
  // Key highlights
  mode: OrchestrationMode;
  modelsUsedCount: number;
  primaryModel: string;
  domain: string;
  
  // Quick stats
  totalDurationMs: number;
  totalCost: number;
  qualityScore: number;
  
  // Timestamps
  createdAt: Date;
}

export interface DerivationTimeline {
  events: DerivationTimelineEvent[];
}

export interface DerivationTimelineEvent {
  timestamp: Date;
  eventType: 'plan_start' | 'step_start' | 'step_complete' | 'model_call' | 'fallback' | 'verification' | 'complete';
  title: string;
  description: string;
  details?: Record<string, unknown>;
  durationMs?: number;
  modelId?: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface GetDerivationRequest {
  derivationId: string;
  includeFullResponse?: boolean;
  includeTokenDetails?: boolean;
}

export interface ListDerivationsRequest {
  sessionId?: string;
  userId?: string;
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
}

export interface DerivationAnalytics {
  totalDerivations: number;
  averageDurationMs: number;
  averageCost: number;
  averageQualityScore: number;
  
  // Mode distribution
  modeDistribution: Record<OrchestrationMode, number>;
  
  // Model usage
  topModels: Array<{
    modelId: string;
    usageCount: number;
    avgQuality: number;
  }>;
  
  // Domain distribution
  domainDistribution: Record<string, number>;
}
