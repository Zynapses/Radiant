// RADIANT Autonomous Organism Architecture Types
// Project Metamorphosis - Complete Type Definitions
// Version: 1.0.0

// ============================================================================
// MCP SERVER CONFIGURATION
// ============================================================================

export type MCPTransport = 'stdio' | 'sse' | 'streamable-http' | 'websocket' | 'wasm-local';
export type MCPAuthType = 'none' | 'api_key' | 'oauth2' | 'jwt' | 'mtls';
export type MCPServerStatus = 'active' | 'disabled' | 'deprecated' | 'pending_review';
export type MCPHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface MCPServerConfig {
  serverId: string;
  name: string;
  description: string;
  
  // Transport configuration
  transport: MCPTransport;
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  
  // Neural routing metadata
  domainAffinity: string[];
  embeddingVector?: Float32Array;
  proficiencyScores: Record<string, number>;
  neuralAffinityModel: string;
  
  // Health metrics
  healthEndpoint?: string;
  lastHealthCheck?: Date;
  healthStatus: MCPHealthStatus;
  errorRate: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  
  // Cost tracking
  costPerCall: number;
  totalCallsToday: number;
  totalCostToday: number;
  budgetLimit?: number;
  
  // Authentication
  authType: MCPAuthType;
  credentials?: {
    encrypted: string;
    keyId: string;
    algorithm: string;
  };
  credentialRotationDays?: number;
  
  // Capabilities
  supportedCapabilities: string[];
  maxConcurrentCalls: number;
  timeout: number;
  retryConfig: RetryConfig;
  
  // Lifecycle
  status: MCPServerStatus;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface RoutingConstraints {
  maxLatencyMs?: number;
  maxCostPerCall?: number;
  requiredCapabilities?: string[];
  excludeServers?: string[];
  preferLocal?: boolean;
  privacyLevel?: 'local-only' | 'tenant-cloud' | 'multi-tenant';
  budgetRemaining?: number;
  requireApproval?: boolean;
}

// ============================================================================
// TOOL SCHEMA DEFINITIONS
// ============================================================================

export type ToolCategory = 
  | 'data_retrieval' 
  | 'data_manipulation' 
  | 'communication'
  | 'file_operations' 
  | 'api_integration' 
  | 'computation'
  | 'search' 
  | 'generation' 
  | 'analysis' 
  | 'automation';

export type ToolSensitivity = 'public' | 'internal' | 'confidential' | 'restricted';

export interface ToolSchema {
  toolId: string;
  serverId: string;
  name: string;
  description: string;
  
  // Zod schemas stored as JSON Schema
  inputSchemaJSON: Record<string, unknown>;
  outputSchemaJSON: Record<string, unknown>;
  
  // Neural embeddings
  descriptionEmbedding?: Float32Array;
  structureEmbedding?: Float32Array;
  parameterEmbeddings?: Map<string, Float32Array>;
  exampleEmbeddings?: Float32Array[];
  neuralSignature?: Float32Array;
  
  // Classification
  category: ToolCategory;
  tags: string[];
  isStructuredOutput: boolean;
  
  // Usage metrics
  successRate: number;
  avgExecutionMs: number;
  lastUsed?: Date;
  usageCount: number;
  
  // Domain mapping
  primaryDomain: string;
  secondaryDomains: string[];
  proficiencyByModel: Record<string, number>;
  
  // Access control
  requiredPermissions: string[];
  sensitivityLevel: ToolSensitivity;
  
  // Cost
  estimatedCostPerCall: number;
  actualAvgCost?: number;
  
  // Metadata
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ToolFilters {
  categories?: ToolCategory[];
  domains?: string[];
  maxCost?: number;
  minSuccessRate?: number;
  tags?: string[];
}

export interface ToolExecution {
  toolId: string;
  success: boolean;
  latencyMs: number;
  cost?: number;
  error?: string;
}

// ============================================================================
// TOOL FORGE PIPELINE (formerly Genesis Auto-Tool)
// ============================================================================

export type ToolForgeStatus = 
  | 'queued' 
  | 'scraping' 
  | 'generating' 
  | 'validating' 
  | 'sandbox_testing'
  | 'approved' 
  | 'rejected' 
  | 'deployed' 
  | 'failed';

export type ToolForgeValidationResult = 'pass' | 'fail' | 'warn';

export interface ToolForgeRequest {
  requestId: string;
  tenantId: string;
  userId: string;
  
  // What to build
  targetService: string;
  targetCapability: string;
  naturalLanguageSpec: string;
  
  // Context
  intentEmbedding?: Float32Array;
  existingSimilarTools: string[];
  userContext?: Record<string, unknown>;
  
  // Constraints
  maxGenerationTimeMs: number;
  requireSandboxValidation: boolean;
  securityLevel: ToolSensitivity;
  
  // Status
  status: ToolForgeStatus;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface ToolForgeResult {
  requestId: string;
  toolId?: string;
  
  // Generated artifacts
  mcpServerCode?: string;
  zodSchemas?: string;
  testCases?: string[];
  documentation?: string;
  
  // Validation
  sandboxValidation?: {
    passed: boolean;
    executionTimeMs: number;
    memoryUsageMb: number;
    securityScan: ToolForgeValidationResult;
    functionalTests: ToolForgeValidationResult;
    errorMessages?: string[];
  };
  
  // Deployment
  deployedAt?: Date;
  hotLoadedSessionIds?: string[];
  
  // Metrics
  generationTimeMs: number;
  tokensUsed: number;
  estimatedCost: number;
}

export interface ToolForgeAPIDiscovery {
  serviceUrl: string;
  discoveryMethod: 'openapi' | 'graphql' | 'grpc' | 'html_scrape' | 'documentation';
  
  // Discovered info
  endpoints: ToolForgeEndpoint[];
  authRequirements?: ToolForgeAuthRequirement;
  rateLimits?: ToolForgeRateLimit;
  
  // Metadata
  lastScrapedAt: Date;
  confidenceScore: number;
}

export interface ToolForgeEndpoint {
  path: string;
  method: string;
  description: string;
  parameters: ToolForgeParameter[];
  responseSchema?: Record<string, unknown>;
}

export interface ToolForgeParameter {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  defaultValue?: unknown;
}

export interface ToolForgeAuthRequirement {
  type: 'api_key' | 'oauth2' | 'basic' | 'bearer' | 'custom';
  location: 'header' | 'query' | 'body';
  keyName?: string;
}

export interface ToolForgeRateLimit {
  requestsPerMinute?: number;
  requestsPerDay?: number;
  concurrentRequests?: number;
}

// ============================================================================
// LIQUID COMPUTE TOPOLOGY
// ============================================================================

export type ComputeLocation = 'browser' | 'local' | 'edge' | 'cloud';
export type ComputeReason = 
  | 'privacy' 
  | 'latency' 
  | 'cost' 
  | 'capability' 
  | 'availability'
  | 'user_preference';

export interface LiquidComputeDecision {
  decisionId: string;
  toolId: string;
  
  // Selected location
  selectedLocation: ComputeLocation;
  reason: ComputeReason;
  
  // Alternatives considered
  alternatives: Array<{
    location: ComputeLocation;
    score: number;
    disqualifyReason?: string;
  }>;
  
  // Execution details
  executionEndpoint: string;
  estimatedLatencyMs: number;
  estimatedCost: number;
  
  // Constraints applied
  privacyConstraint?: boolean;
  latencyConstraint?: number;
  costConstraint?: number;
}

export interface ComputeTopology {
  tenantId: string;
  
  // Available compute locations
  browserCapabilities: BrowserCapabilities;
  localCapabilities?: LocalCapabilities;
  edgeLocations: EdgeLocation[];
  cloudRegions: CloudRegion[];
  
  // Routing rules
  defaultLocation: ComputeLocation;
  domainLocationOverrides: Record<string, ComputeLocation>;
  sensitivityLocationRules: Record<ToolSensitivity, ComputeLocation[]>;
}

export interface BrowserCapabilities {
  wasmSupported: boolean;
  webGPUSupported: boolean;
  maxMemoryMb: number;
  estimatedComputeScore: number;
  supportedModels: string[];
}

export interface LocalCapabilities {
  available: boolean;
  platform: 'macos' | 'windows' | 'linux';
  gpuAvailable: boolean;
  gpuModel?: string;
  memoryGb: number;
  supportedModels: string[];
}

export interface EdgeLocation {
  locationId: string;
  region: string;
  provider: 'cloudflare' | 'lambda_edge' | 'fastly' | 'vercel';
  latencyFromUserMs: number;
  capabilities: string[];
  costMultiplier: number;
}

export interface CloudRegion {
  regionId: string;
  provider: 'aws' | 'gcp' | 'azure';
  region: string;
  latencyFromUserMs: number;
  costPerRequest: number;
  availableServices: string[];
}

// ============================================================================
// TENSOR-LINK PROTOCOL
// ============================================================================

export type TensorDataType = 'float32' | 'float16' | 'int32' | 'int8' | 'uint8' | 'bool';
export type TensorCompression = 'none' | 'zstd' | 'lz4' | 'quantized';

export interface TensorLinkMessage {
  messageId: string;
  messageType: 'request' | 'response' | 'stream_chunk' | 'error';
  
  // Tensor payload
  tensors: TensorPayload[];
  
  // Metadata (minimal JSON)
  metadata: {
    toolId?: string;
    sessionId?: string;
    sequenceNumber?: number;
    timestamp: number;
  };
  
  // Compression
  compression: TensorCompression;
  originalSizeBytes: number;
  compressedSizeBytes: number;
}

export interface TensorPayload {
  name: string;
  dataType: TensorDataType;
  shape: number[];
  data: ArrayBuffer;
  
  // Optional metadata
  semanticType?: 'embedding' | 'attention' | 'logits' | 'hidden_state' | 'custom';
  modelSource?: string;
}

export interface TensorLinkSession {
  sessionId: string;
  tenantId: string;
  userId: string;
  
  // Protocol version
  protocolVersion: string;
  
  // Capabilities
  supportedDataTypes: TensorDataType[];
  supportedCompression: TensorCompression[];
  maxTensorSizeMb: number;
  
  // Connection
  transportType: 'websocket' | 'http2' | 'quic';
  endpoint: string;
  connectedAt: Date;
  
  // Stats
  messagesSent: number;
  messagesReceived: number;
  totalBytesSent: number;
  totalBytesReceived: number;
}

// ============================================================================
// GHOST SIMULATION LAYER
// ============================================================================

export type GhostSimulationType = 
  | 'user_reaction' 
  | 'outcome_prediction' 
  | 'safety_check'
  | 'cost_estimation' 
  | 'latency_estimation';

export type GhostConfidenceLevel = 'high' | 'medium' | 'low' | 'uncertain';

export interface GhostVector {
  vectorId: string;
  userId: string;
  tenantId: string;
  
  // Core vector (4096 dimensions)
  vector: Float32Array;
  
  // Component vectors
  preferenceVector: Float32Array;
  behaviorVector: Float32Array;
  emotionalVector: Float32Array;
  knowledgeVector: Float32Array;
  
  // Metadata
  lastUpdated: Date;
  interactionCount: number;
  confidenceScore: number;
  
  // Decay settings
  decayRate: number;
  lastDecayAt: Date;
}

export interface GhostSimulation {
  simulationId: string;
  type: GhostSimulationType;
  
  // Input
  toolId: string;
  proposedAction: string;
  context: Record<string, unknown>;
  ghostVector: GhostVector;
  
  // Output
  prediction: GhostPrediction;
  confidence: GhostConfidenceLevel;
  
  // Execution
  simulationTimeMs: number;
  modelUsed: string;
  
  // Timestamps
  createdAt: Date;
}

export interface GhostPrediction {
  // User reaction prediction
  predictedSatisfaction?: number; // 0-1
  predictedFrustration?: number; // 0-1
  predictedEngagement?: number; // 0-1
  
  // Outcome prediction
  successProbability?: number;
  expectedOutputQuality?: number;
  potentialRisks?: string[];
  
  // Safety prediction
  safetyScore?: number;
  flaggedConcerns?: string[];
  
  // Cost/latency prediction
  estimatedCost?: number;
  estimatedLatencyMs?: number;
  
  // Reasoning
  reasoning: string;
  alternativesSuggested?: string[];
}

export interface GhostCalibration {
  userId: string;
  
  // Calibration metrics
  predictionAccuracy: number;
  satisfactionCorrelation: number;
  outcomeCorrelation: number;
  
  // Historical data
  totalPredictions: number;
  correctPredictions: number;
  
  // Last calibration
  lastCalibratedAt: Date;
  calibrationDataPoints: number;
}

// ============================================================================
// ECONOMIC CORTEX (ENHANCED)
// ============================================================================

export type BudgetScope = 'tenant' | 'user' | 'session' | 'task';
export type BudgetAlertLevel = 'info' | 'warning' | 'critical' | 'exceeded';
export type NegotiationStrategy = 'aggressive' | 'balanced' | 'conservative';

export interface EconomicCortexConfig {
  tenantId: string;
  
  // Budget management
  budgets: Budget[];
  alertThresholds: BudgetAlert[];
  
  // Cost optimization
  preferSelfHosted: boolean;
  qualityFloor: number;
  latencyTarget: number;
  
  // Autonomous features
  autonomousBudgetNegotiation: boolean;
  negotiationStrategy: NegotiationStrategy;
  autoScaleOnDemand: boolean;
  
  // Crypto wallet (optional)
  cryptoWalletEnabled: boolean;
  cryptoWalletAddress?: string;
  micropaymentThreshold?: number;
}

export interface Budget {
  budgetId: string;
  scope: BudgetScope;
  scopeId: string; // tenantId, userId, sessionId, or taskId
  
  // Limits
  totalBudget: number;
  usedBudget: number;
  reservedBudget: number;
  
  // Period
  periodType: 'daily' | 'weekly' | 'monthly' | 'session' | 'task';
  periodStart: Date;
  periodEnd: Date;
  
  // Controls
  hardLimit: boolean;
  autoRenew: boolean;
  
  // Metrics
  avgDailySpend: number;
  projectedEndOfPeriod: number;
}

export interface BudgetAlert {
  alertId: string;
  budgetId: string;
  
  // Trigger
  thresholdPercent: number;
  level: BudgetAlertLevel;
  
  // Actions
  notifyAdmin: boolean;
  notifyUser: boolean;
  pauseExecution: boolean;
  switchToLowerTier: boolean;
  
  // State
  triggered: boolean;
  triggeredAt?: Date;
}

export interface CostNegotiation {
  negotiationId: string;
  tenantId: string;
  
  // Request
  requestedAction: string;
  estimatedCost: number;
  availableBudget: number;
  
  // Negotiation
  strategy: NegotiationStrategy;
  alternatives: CostAlternative[];
  selectedAlternative?: CostAlternative;
  
  // Result
  approved: boolean;
  finalCost: number;
  savingsAchieved: number;
  
  // Timestamps
  negotiatedAt: Date;
  executedAt?: Date;
}

export interface CostAlternative {
  alternativeId: string;
  description: string;
  
  // Cost comparison
  estimatedCost: number;
  costSavingsPercent: number;
  
  // Trade-offs
  qualityImpact: number; // -1 to 1
  latencyImpact: number; // multiplier
  capabilityLoss?: string[];
  
  // Recommendation
  recommendationScore: number;
}

// ============================================================================
// NEURAL AFFINITY ROUTING
// ============================================================================

export interface NeuralAffinityScore {
  toolId: string;
  
  // Component scores
  semanticSimilarity: number; // cos_sim(intent, tool)
  domainProficiency: number; // historical success in domain
  errorPenalty: number; // 1 - error_rate
  latencyScore: number; // normalized latency
  costScore: number; // normalized cost
  
  // Combined score
  finalScore: number;
  
  // Explanation
  scoringFactors: string[];
}

export interface NeuralRoutingDecision {
  decisionId: string;
  
  // Input
  intentEmbedding: Float32Array;
  constraints: RoutingConstraints;
  
  // Candidates
  candidates: NeuralAffinityScore[];
  
  // Selection
  selectedToolId: string;
  selectionReason: string;
  
  // Fallbacks
  fallbackTools: string[];
  
  // Metrics
  routingTimeMs: number;
  candidatesEvaluated: number;
}

// ============================================================================
// CATO TRAINING INTEGRATION
// ============================================================================

export interface CATOTrainingSignal {
  signalId: string;
  signalType: 'error' | 'success' | 'user_feedback' | 'safety_violation' | 'performance';
  
  // Context
  toolId?: string;
  serverId?: string;
  userId: string;
  tenantId: string;
  
  // Signal data
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  
  // Labels
  isPositive: boolean;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  
  // Timestamps
  occurredAt: Date;
  processedAt?: Date;
  
  // Training status
  addedToTrainingQueue: boolean;
  trainedAt?: Date;
}

export interface TwilightDreamingConfig {
  tenantId: string;
  
  // Schedule
  enabled: boolean;
  startTimeUTC: string; // "02:00"
  maxDurationMinutes: number;
  
  // Training parameters
  learningRate: number;
  batchSize: number;
  innovationPercent: number; // 30% for exploration
  
  // Data sources
  useErrorSignals: boolean;
  useSuccessSignals: boolean;
  useUserFeedback: boolean;
  useSafetySignals: boolean;
  
  // Constraints
  maxTrainingCost: number;
  minSignalsRequired: number;
}

// ============================================================================
// OBSERVABILITY & TELEMETRY
// ============================================================================

export interface OrganismTelemetry {
  // System health
  systemHealth: {
    overallScore: number;
    mcpServersHealthy: number;
    mcpServersTotal: number;
    toolForgeQueueDepth: number;
    ghostSimulationLatency: number;
    economicBudgetUtilization: number;
  };
  
  // Neural metrics
  neuralMetrics: {
    routingAccuracy: number;
    schemaMatchRate: number;
    embeddingCacheHitRate: number;
    averageAffinityScore: number;
  };
  
  // Tool Forge metrics
  toolForgeMetrics: {
    toolsGeneratedToday: number;
    toolsDeployedToday: number;
    averageGenerationTime: number;
    sandboxPassRate: number;
  };
  
  // Ghost metrics
  ghostMetrics: {
    simulationsRunToday: number;
    predictionAccuracy: number;
    averageSimulationTime: number;
    userSatisfactionCorrelation: number;
  };
  
  // Economic metrics
  economicMetrics: {
    totalSpendToday: number;
    savingsFromOptimization: number;
    budgetUtilization: number;
    autonomousDecisionsMade: number;
  };
  
  // Timestamp
  collectedAt: Date;
}

// ============================================================================
// MCP CLIENT TYPES
// ============================================================================

export interface MCPConnection {
  connectionId: string;
  serverId: string;
  status: 'idle' | 'active' | 'closing';
  createdAt: Date;
  lastUsedAt: Date;
}

export interface MCPConnectionPool {
  serverId: string;
  maxConnections: number;
  minConnections: number;
  idleTimeoutMs: number;
  maxLifetimeMs: number;
  
  metrics: {
    totalAcquires: number;
    totalReleases: number;
    totalTimeouts: number;
    totalErrors: number;
    peakActiveConnections: number;
  };
}

export interface MCPRequest {
  requestId: string;
  serverId: string;
  toolId: string;
  
  input: Record<string, unknown>;
  
  // Routing info
  routingDecision: NeuralRoutingDecision;
  computeDecision: LiquidComputeDecision;
  
  // Execution
  startedAt: Date;
  completedAt?: Date;
  latencyMs?: number;
  
  // Result
  success?: boolean;
  output?: Record<string, unknown>;
  error?: string;
}

export interface MCPResponse {
  requestId: string;
  
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  
  isError: boolean;
  isPartial?: boolean;
  structuredData?: unknown;
  
  // Metadata
  latencyMs: number;
  tokensUsed?: number;
  cost?: number;
}

// ============================================================================
// RESOURCE MANAGEMENT
// ============================================================================

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  lastModified?: Date;
  size?: number;
}

export interface ResourceContent {
  data: string | Uint8Array;
  mimeType: string;
  encoding?: string;
}

export interface ResourceUpdate {
  uri: string;
  type: 'created' | 'updated' | 'deleted';
  content?: ResourceContent;
  timestamp: Date;
}

// ============================================================================
// PROMPT TEMPLATES
// ============================================================================

export interface MCPPromptTemplate {
  templateId: string;
  name: string;
  description: string;
  template: string;
  parameters: PromptParameter[];
}

export interface PromptParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: unknown;
}

// ============================================================================
// PROGRESS & LIFECYCLE
// ============================================================================

export interface ProgressState {
  token: string;
  total: number;
  current: number;
  message?: string;
  status: 'running' | 'completed' | 'error';
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

export interface ServerLifecycle {
  onInitialize?: () => Promise<void>;
  onReady?: () => void;
  onShutdown?: () => Promise<void>;
  onError?: (error: Error) => void;
  onToolCall?: (toolId: string, input: unknown) => void;
  onToolResult?: (toolId: string, result: unknown) => void;
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export type ErrorType = 
  | 'timeout' 
  | 'rate_limit' 
  | 'authentication' 
  | 'not_found' 
  | 'validation' 
  | 'network' 
  | 'unknown';

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface ErrorClassification {
  type: ErrorType;
  retryable: boolean;
  severity: ErrorSeverity;
}

export interface ErrorContext {
  toolId?: string;
  serverId?: string;
  userId?: string;
  tenantId?: string;
  input?: unknown;
}

// ============================================================================
// EXPORTS
// ============================================================================

export interface AutonomousOrganismState {
  // Core subsystems
  mcpServers: MCPServerConfig[];
  toolSchemas: ToolSchema[];
  
  // Tool Forge pipeline
  pendingToolForgeRequests: ToolForgeRequest[];
  deployedToolForgeTools: ToolForgeResult[];
  
  // Compute topology
  computeTopology: ComputeTopology;
  
  // Ghost simulation
  ghostVectors: Map<string, GhostVector>;
  recentSimulations: GhostSimulation[];
  
  // Economic cortex
  economicConfig: EconomicCortexConfig;
  activeBudgets: Budget[];
  
  // Telemetry
  latestTelemetry: OrganismTelemetry;
  
  // Status
  systemStatus: 'initializing' | 'running' | 'degraded' | 'maintenance' | 'shutdown';
  lastHealthCheck: Date;
}
