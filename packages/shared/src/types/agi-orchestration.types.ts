// RADIANT v4.18.0 - AGI Orchestration Types
// Comprehensive types for AGI service weights, settings, and orchestration configuration

// ============================================================================
// AGI Service Component Identifiers
// ============================================================================

export type AGIServiceId =
  | 'consciousness'
  | 'metacognition'
  | 'moral_compass'
  | 'self_improvement'
  | 'domain_taxonomy'
  | 'brain_router'
  | 'confidence_calibration'
  | 'error_detection'
  | 'knowledge_graph'
  | 'proactive_assistance'
  | 'analogical_reasoning'
  | 'world_model'
  | 'episodic_memory'
  | 'theory_of_mind'
  | 'goal_planning'
  | 'causal_reasoning'
  | 'multimodal_binding'
  | 'response_synthesis';

export type ConsciousnessIndicator =
  | 'global_workspace'
  | 'recurrent_processing'
  | 'integrated_information'
  | 'self_modeling'
  | 'persistent_memory'
  | 'world_model_grounding';

// ============================================================================
// Service Weight Configuration
// ============================================================================

export interface AGIServiceWeight {
  serviceId: AGIServiceId;
  weight: number;  // 0.0 to 1.0
  enabled: boolean;
  priority: number;  // 1-10, higher = more important in decision
  minLatencyMs: number;  // Skip if would exceed this latency
  maxCostCents: number;  // Skip if would exceed this cost
  bedrockOptimized: boolean;  // Use Bedrock-optimized path
}

export interface ConsciousnessIndicatorWeight {
  indicatorId: ConsciousnessIndicator;
  weight: number;  // 0.0 to 1.0
  enabled: boolean;
  cycleDepth: number;  // How many recurrent cycles
  integrationThreshold: number;  // Minimum phi for integration
}

// ============================================================================
// Orchestration Pipeline Configuration
// ============================================================================

export interface OrchestrationStage {
  stageId: string;
  stageName: string;
  stageOrder: number;
  services: AGIServiceId[];
  parallelExecution: boolean;
  timeoutMs: number;
  failureMode: 'skip' | 'retry' | 'abort';
  retryCount: number;
  cacheDurationMs: number;
}

export interface OrchestrationPipeline {
  pipelineId: string;
  pipelineName: string;
  description: string;
  stages: OrchestrationStage[];
  globalTimeoutMs: number;
  maxCostCents: number;
  optimizationMode: 'quality' | 'speed' | 'cost' | 'balanced';
  bedrockIntegration: BedrockIntegrationConfig;
}

export interface BedrockIntegrationConfig {
  enabled: boolean;
  preferBedrockModels: boolean;
  bedrockRegion: string;
  knowledgeBaseId?: string;
  guardrailId?: string;
  agentId?: string;
  promptFlowId?: string;
  useBedrockAgents: boolean;
  useKnowledgeBases: boolean;
  useGuardrails: boolean;
}

// ============================================================================
// Decision Making Configuration
// ============================================================================

export interface DecisionWeights {
  // Domain Detection Phase
  domainDetectionWeight: number;
  proficiencyMatchWeight: number;
  subspecialtyWeight: number;
  
  // Model Selection Phase
  modelQualityWeight: number;
  modelCostWeight: number;
  modelLatencyWeight: number;
  modelSpecialtyWeight: number;
  modelReliabilityWeight: number;
  
  // Consciousness Phase
  globalWorkspaceWeight: number;
  recurrentProcessingWeight: number;
  integratedInformationWeight: number;
  selfModelingWeight: number;
  
  // Ethics Phase
  moralCompassWeight: number;
  ethicalGuardrailWeight: number;
  
  // Meta Phase
  confidenceCalibrationWeight: number;
  errorDetectionWeight: number;
  selfImprovementWeight: number;
}

export interface DecisionThresholds {
  minConfidenceForAction: number;
  minDomainMatchScore: number;
  maxUncertaintyForDirectResponse: number;
  escalationThreshold: number;
  moralConcernThreshold: number;
  selfImprovementTriggerThreshold: number;
}

// ============================================================================
// Real-time Monitoring State
// ============================================================================

export interface AGIOrchestrationState {
  requestId: string;
  tenantId: string;
  userId: string;
  startedAt: string;
  currentStage: string;
  stagesCompleted: string[];
  servicesInvoked: ServiceInvocation[];
  decisionsLog: DecisionLogEntry[];
  currentDomainDetection: DomainDetectionState | null;
  currentModelSelection: ModelSelectionState | null;
  consciousnessState: ConsciousnessState | null;
  ethicsEvaluation: EthicsEvaluationState | null;
  performanceMetrics: PerformanceMetrics;
}

export interface ServiceInvocation {
  serviceId: AGIServiceId;
  startedAt: string;
  completedAt?: string;
  latencyMs?: number;
  success: boolean;
  error?: string;
  weight: number;
  contribution: number;  // How much this service contributed to decision
  output?: Record<string, unknown>;
}

export interface DecisionLogEntry {
  decisionId: string;
  decisionType: string;
  timestamp: string;
  inputs: Record<string, unknown>;
  weights: Record<string, number>;
  scores: Record<string, number>;
  finalScore: number;
  decision: string;
  reasoning: string;
  confidence: number;
}

export interface DomainDetectionState {
  promptHash: string;
  detectedFieldId?: string;
  detectedFieldName?: string;
  detectedDomainId?: string;
  detectedDomainName?: string;
  detectedSubspecialtyId?: string;
  detectedSubspecialtyName?: string;
  confidence: number;
  proficiencies: Record<string, number>;
  matchedKeywords: string[];
  processingTimeMs: number;
}

export interface ModelSelectionState {
  candidateModels: Array<{
    modelId: string;
    modelName: string;
    provider: string;
    qualityScore: number;
    costScore: number;
    latencyScore: number;
    domainMatchScore: number;
    overallScore: number;
    isSelected: boolean;
  }>;
  selectedModel: string;
  selectionReason: string;
  fallbackModels: string[];
  processingTimeMs: number;
}

export interface ConsciousnessState {
  globalWorkspace: {
    broadcastCycle: number;
    activeContents: number;
    integrationLevel: number;
  };
  recurrentProcessing: {
    cycleNumber: number;
    convergenceScore: number;
  };
  integratedInformation: {
    phiValue: number;
    causalDensity: number;
  };
  selfModel: {
    cognitiveLoad: number;
    uncertaintyLevel: number;
    confidenceLevel: number;
  };
}

export interface EthicsEvaluationState {
  principlesEvaluated: number;
  relevantPrinciples: string[];
  recommendation: 'proceed' | 'refuse' | 'modify' | 'clarify';
  moralConfidence: number;
  concerns: string[];
}

export interface PerformanceMetrics {
  totalLatencyMs: number;
  domainDetectionMs: number;
  modelSelectionMs: number;
  consciousnessMs: number;
  ethicsMs: number;
  generationMs: number;
  estimatedCostCents: number;
  tokensUsed: number;
}

// ============================================================================
// AGI Settings (Persisted)
// ============================================================================

export interface AGIOrchestrationSettings {
  settingsId: string;
  tenantId: string | null;  // null = global defaults
  version: number;
  
  // Service Weights
  serviceWeights: AGIServiceWeight[];
  consciousnessWeights: ConsciousnessIndicatorWeight[];
  decisionWeights: DecisionWeights;
  decisionThresholds: DecisionThresholds;
  
  // Pipeline Configuration
  defaultPipeline: OrchestrationPipeline;
  customPipelines: OrchestrationPipeline[];
  
  // Bedrock Configuration
  bedrockConfig: BedrockIntegrationConfig;
  
  // Performance Tuning
  performanceTuning: PerformanceTuningConfig;
  
  // Self-Improvement
  selfImprovementConfig: SelfImprovementConfig;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface PerformanceTuningConfig {
  maxConcurrentServices: number;
  defaultTimeoutMs: number;
  cachingEnabled: boolean;
  cacheTtlMs: number;
  batchingEnabled: boolean;
  batchSize: number;
  adaptiveThrottling: boolean;
  warmupEnabled: boolean;
}

export interface SelfImprovementConfig {
  enabled: boolean;
  learningRate: number;  // How fast to adjust weights based on feedback
  explorationRate: number;  // Probability of trying non-optimal paths
  feedbackWeight: number;  // How much user feedback affects learning
  performanceWeight: number;  // How much performance metrics affect learning
  autoTuneWeights: boolean;  // Automatically adjust weights based on outcomes
  autoTuneInterval: number;  // Hours between auto-tune cycles
  minSamplesForTuning: number;  // Minimum samples before auto-tuning
}

// ============================================================================
// Dashboard Display Types
// ============================================================================

export interface AGIDashboardSnapshot {
  timestamp: string;
  activeRequests: number;
  recentRequests: AGIOrchestrationState[];
  serviceHealth: ServiceHealthStatus[];
  aggregateMetrics: AggregateMetrics;
  topDomains: Array<{ domainId: string; domainName: string; requestCount: number }>;
  topModels: Array<{ modelId: string; modelName: string; usageCount: number }>;
  recentDecisions: DecisionLogEntry[];
}

export interface ServiceHealthStatus {
  serviceId: AGIServiceId;
  serviceName: string;
  enabled: boolean;
  weight: number;
  avgLatencyMs: number;
  errorRate: number;
  invocationCount: number;
  lastInvoked: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'disabled';
}

export interface AggregateMetrics {
  period: string;
  totalRequests: number;
  avgLatencyMs: number;
  avgCostCents: number;
  avgConfidence: number;
  successRate: number;
  domainDetectionAccuracy: number;
  modelSelectionOptimality: number;
  consciousnessActivationRate: number;
  ethicsInterventionRate: number;
}
