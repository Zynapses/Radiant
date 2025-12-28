// RADIANT v4.18.0 - AGI Brain Plan Types
// Real-time planning system for transparent AGI decision-making

// ============================================================================
// Plan Status and Step Types
// ============================================================================

export type PlanStatus = 
  | 'planning'      // Initial analysis
  | 'ready'         // Plan generated, ready to execute
  | 'executing'     // Currently running
  | 'completed'     // Successfully finished
  | 'failed'        // Execution failed
  | 'cancelled';    // User cancelled

export type StepStatus = 
  | 'pending'       // Not yet started
  | 'in_progress'   // Currently executing
  | 'completed'     // Successfully finished
  | 'skipped'       // Skipped (optional step)
  | 'failed';       // Step failed

export type StepType =
  | 'analyze'           // Analyze the prompt
  | 'detect_domain'     // Detect knowledge domain
  | 'select_model'      // Select best AI model
  | 'prepare_context'   // Prepare context and memory
  | 'ethics_check'      // Moral compass evaluation
  | 'generate'          // Generate response
  | 'synthesize'        // Synthesize from multiple models
  | 'verify'            // Verify response quality
  | 'refine'            // Refine and improve
  | 'calibrate'         // Calibrate confidence
  | 'reflect';          // Self-reflection

export type OrchestrationMode =
  | 'thinking'          // Standard thinking mode
  | 'extended_thinking' // Deep reasoning mode
  | 'coding'            // Code generation mode
  | 'creative'          // Creative writing mode
  | 'research'          // Research synthesis mode
  | 'analysis'          // Data analysis mode
  | 'multi_model'       // Multi-model consensus
  | 'chain_of_thought'  // Explicit reasoning chain
  | 'self_consistency'; // Multiple samples, best answer

// ============================================================================
// Plan Step Definition
// ============================================================================

export interface PlanStep {
  stepId: string;
  stepNumber: number;
  stepType: StepType;
  title: string;
  description: string;
  status: StepStatus;
  
  // Execution details
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  
  // Service involvement
  servicesInvolved: string[];
  primaryService?: string;
  
  // Model selection (if applicable)
  selectedModel?: string;
  modelReason?: string;
  alternativeModels?: string[];
  
  // Domain detection (if applicable)
  detectedDomain?: {
    fieldId: string;
    fieldName: string;
    domainId: string;
    domainName: string;
    subspecialtyId?: string;
    subspecialtyName?: string;
    confidence: number;
  };
  
  // Output/result
  output?: Record<string, unknown>;
  confidence?: number;
  
  // Dependencies
  dependsOn?: string[];  // Step IDs
  isOptional?: boolean;
  isParallel?: boolean;  // Can run in parallel with previous
}

// ============================================================================
// Brain Plan Definition
// ============================================================================

export interface AGIBrainPlan {
  planId: string;
  tenantId: string;
  userId: string;
  sessionId?: string;
  conversationId?: string;
  
  // Original request
  prompt: string;
  promptAnalysis: PromptAnalysis;
  
  // Plan status
  status: PlanStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  totalDurationMs?: number;
  
  // Plan steps
  steps: PlanStep[];
  currentStepIndex: number;
  
  // Orchestration configuration
  orchestrationMode: OrchestrationMode;
  orchestrationReason: string;
  
  // Model selection
  primaryModel: ModelSelection;
  fallbackModels: ModelSelection[];
  
  // Domain detection
  domainDetection?: DomainDetection;
  
  // Consciousness state
  consciousnessActive: boolean;
  consciousnessIndicators?: ConsciousnessIndicators;
  
  // Ethics evaluation
  ethicsEvaluation?: EthicsEvaluation;
  
  // Performance estimates
  estimatedDurationMs: number;
  estimatedCostCents: number;
  estimatedTokens: number;
  
  // Quality metrics
  qualityTargets: QualityTargets;
  
  // Self-improvement
  learningEnabled: boolean;
  feedbackRequested: boolean;
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface PromptAnalysis {
  originalPrompt: string;
  tokenCount: number;
  complexity: 'simple' | 'moderate' | 'complex' | 'expert';
  taskType: string;
  intentDetected: string;
  requiresReasoning: boolean;
  requiresCreativity: boolean;
  requiresFactualAccuracy: boolean;
  requiresCodeGeneration: boolean;
  requiresMultiStep: boolean;
  keyTopics: string[];
  detectedLanguage: string;
  sensitivityLevel: 'none' | 'low' | 'medium' | 'high';
}

export interface ModelSelection {
  modelId: string;
  modelName: string;
  provider: string;
  selectionReason: string;
  matchScore: number;
  strengths: string[];
  estimatedLatencyMs: number;
  estimatedCostPer1kTokens: number;
}

export interface DomainDetection {
  fieldId: string;
  fieldName: string;
  fieldIcon: string;
  domainId: string;
  domainName: string;
  domainIcon: string;
  subspecialtyId?: string;
  subspecialtyName?: string;
  confidence: number;
  proficiencies: Record<string, number>;
  matchedKeywords: string[];
}

export interface ConsciousnessIndicators {
  globalWorkspaceActive: boolean;
  broadcastCycle: number;
  integrationLevel: number;
  selfModelConfidence: number;
  attentionFocus: string;
  cognitiveLoad: number;
}

export interface EthicsEvaluation {
  passed: boolean;
  principlesChecked: number;
  relevantPrinciples: string[];
  concerns: string[];
  recommendation: 'proceed' | 'modify' | 'refuse' | 'clarify';
  moralConfidence: number;
}

export interface QualityTargets {
  minConfidence: number;
  targetAccuracy: number;
  maxLatencyMs: number;
  maxCostCents: number;
  requireVerification: boolean;
  requireConsistency: boolean;
}

// ============================================================================
// Real-time Update Events
// ============================================================================

export interface PlanUpdateEvent {
  eventType: 'plan_created' | 'step_started' | 'step_completed' | 'step_failed' | 'plan_completed' | 'plan_failed';
  planId: string;
  timestamp: string;
  stepId?: string;
  stepNumber?: number;
  data?: Record<string, unknown>;
}

export interface PlanStreamChunk {
  planId: string;
  chunkType: 'thinking' | 'content' | 'step_update' | 'plan_update';
  content?: string;
  stepUpdate?: Partial<PlanStep>;
  planUpdate?: Partial<AGIBrainPlan>;
}

// ============================================================================
// Plan Generation Request
// ============================================================================

export interface GeneratePlanRequest {
  prompt: string;
  tenantId: string;
  userId: string;
  sessionId?: string;
  conversationId?: string;
  
  // User preferences
  preferredMode?: OrchestrationMode;
  preferredModel?: string;
  maxLatencyMs?: number;
  maxCostCents?: number;
  
  // Feature flags
  enableConsciousness?: boolean;
  enableEthicsCheck?: boolean;
  enableVerification?: boolean;
  enableLearning?: boolean;
  
  // Domain override
  domainOverride?: {
    fieldId?: string;
    domainId?: string;
    subspecialtyId?: string;
  };
}

// ============================================================================
// Plan Display for UI
// ============================================================================

export interface PlanDisplayStep {
  stepNumber: number;
  icon: string;
  title: string;
  description: string;
  status: StepStatus;
  statusIcon: string;
  isActive: boolean;
  details?: string[];
  model?: string;
  domain?: string;
  duration?: string;
  confidence?: string;
}

export interface PlanDisplay {
  planId: string;
  status: PlanStatus;
  statusMessage: string;
  mode: OrchestrationMode;
  modeDescription: string;
  
  // Summary
  promptSummary: string;
  complexity: string;
  estimatedTime: string;
  estimatedCost: string;
  
  // Domain
  domain?: {
    icon: string;
    name: string;
    field: string;
    confidence: string;
  };
  
  // Model
  model: {
    name: string;
    provider: string;
    reason: string;
  };
  
  // Steps
  steps: PlanDisplayStep[];
  currentStep: number;
  totalSteps: number;
  completedSteps: number;
  
  // Timing
  elapsed?: string;
  remaining?: string;
}
