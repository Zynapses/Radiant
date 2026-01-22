/**
 * Project Cato: Method Pipeline Types
 * Version 5.0 - Universal Method Protocol Implementation
 *
 * This file defines the core TypeScript interfaces for the Cato method pipeline:
 * - Schema Registry types
 * - Method Registry types
 * - Tool Registry types
 * - Universal Envelope Protocol
 * - Context strategies
 * - Risk assessment
 * - Checkpoint system
 * - Compensation (SAGA pattern)
 */

// ============================================================================
// ENUMS
// ============================================================================

export enum CatoMethodType {
  OBSERVER = 'OBSERVER',
  PARSER = 'PARSER',
  ROUTER = 'ROUTER',
  PROPOSER = 'PROPOSER',
  STRATEGIST = 'STRATEGIST',
  PLANNER = 'PLANNER',
  CRITIC = 'CRITIC',
  VALIDATOR = 'VALIDATOR',
  JUDGE = 'JUDGE',
  DECIDER = 'DECIDER',
  SYNTHESIZER = 'SYNTHESIZER',
  RESOLVER = 'RESOLVER',
  EXECUTOR = 'EXECUTOR',
  TRANSFORMER = 'TRANSFORMER',
  GENERATOR = 'GENERATOR',
  ORCHESTRATOR = 'ORCHESTRATOR',
  CHECKPOINT = 'CHECKPOINT',
  SPLITTER = 'SPLITTER',
  JOINER = 'JOINER',
  RESEARCHER = 'RESEARCHER',
  FACT_CHECKER = 'FACT_CHECKER',
  SUMMARIZER = 'SUMMARIZER',
  TRANSLATOR = 'TRANSLATOR',
  CUSTOM = 'CUSTOM',
}

export enum CatoOutputType {
  CLASSIFICATION = 'CLASSIFICATION',
  ANALYSIS = 'ANALYSIS',
  ASSESSMENT = 'ASSESSMENT',
  VERIFICATION = 'VERIFICATION',
  PLAN = 'PLAN',
  PROPOSAL = 'PROPOSAL',
  RECOMMENDATION = 'RECOMMENDATION',
  CRITIQUE = 'CRITIQUE',
  APPROVAL = 'APPROVAL',
  JUDGMENT = 'JUDGMENT',
  SYNTHESIS = 'SYNTHESIS',
  SUMMARY = 'SUMMARY',
  RESOLUTION = 'RESOLUTION',
  EXECUTION_RESULT = 'EXECUTION_RESULT',
  VALIDATION_RESULT = 'VALIDATION_RESULT',
  CONTENT = 'CONTENT',
  TRANSFORMATION = 'TRANSFORMATION',
  ROUTING_DECISION = 'ROUTING_DECISION',
  CHECKPOINT_REQUEST = 'CHECKPOINT_REQUEST',
  ERROR = 'ERROR',
  CUSTOM = 'CUSTOM',
}

export enum CatoRiskLevel {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  NONE = 'NONE',
}

export enum CatoContextStrategy {
  FULL = 'FULL',
  SUMMARY = 'SUMMARY',
  TAIL = 'TAIL',
  RELEVANT = 'RELEVANT',
  MINIMAL = 'MINIMAL',
}

export enum CatoCheckpointMode {
  AUTO = 'AUTO',
  MANUAL = 'MANUAL',
  CONDITIONAL = 'CONDITIONAL',
  DISABLED = 'DISABLED',
}

export enum CatoCheckpointDecision {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  MODIFIED = 'MODIFIED',
  AUTO_APPROVED = 'AUTO_APPROVED',
  TIMEOUT = 'TIMEOUT',
  ESCALATED = 'ESCALATED',
}

export enum CatoTriageDecision {
  AUTO_EXECUTE = 'AUTO_EXECUTE',
  CHECKPOINT_REQUIRED = 'CHECKPOINT_REQUIRED',
  BLOCKED = 'BLOCKED',
}

export enum CatoCompensationType {
  DELETE = 'DELETE',
  RESTORE = 'RESTORE',
  NOTIFY = 'NOTIFY',
  MANUAL = 'MANUAL',
  NONE = 'NONE',
}

export enum CatoPipelineStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  CHECKPOINT_WAITING = 'CHECKPOINT_WAITING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  ROLLED_BACK = 'ROLLED_BACK',
}

export enum CatoInvocationStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
  CANCELLED = 'CANCELLED',
}

// ============================================================================
// SCHEMA REGISTRY TYPES
// ============================================================================

export interface CatoSchemaDefinition {
  schemaRefId: string;
  schemaName: string;
  version: string;
  jsonSchema: Record<string, unknown>;
  fieldDescriptions: Record<string, string>;
  usedByOutputTypes: CatoOutputType[];
  producedByMethods: string[];
  examplePayload?: Record<string, unknown>;
  scope: 'SYSTEM' | 'TENANT';
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSchemaDefinitionInput {
  schemaRefId: string;
  schemaName: string;
  version: string;
  jsonSchema: Record<string, unknown>;
  fieldDescriptions?: Record<string, string>;
  usedByOutputTypes?: CatoOutputType[];
  producedByMethods?: string[];
  examplePayload?: Record<string, unknown>;
}

// ============================================================================
// METHOD REGISTRY TYPES
// ============================================================================

export interface CatoContextStrategyConfig {
  strategy: CatoContextStrategy;
  maxTokens?: number;
  tailCount?: number;
  relevanceThreshold?: number;
  summaryPrompt?: string;
  includeOutputTypes?: CatoOutputType[];
  excludeOutputTypes?: CatoOutputType[];
}

export interface CatoModelConfig {
  modelId: string;
  provider: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface CatoPromptVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
  default?: unknown;
}

export interface CatoMethodDefinition {
  methodId: string;
  name: string;
  description: string;
  methodType: CatoMethodType;
  version: string;
  capabilities: string[];
  outputTypes: CatoOutputType[];
  useCases: string[];
  requiresInContext: CatoOutputType[];
  acceptsOutputTypes: CatoOutputType[];
  typicalPredecessors: string[];
  typicalSuccessors: string[];
  contextStrategy: CatoContextStrategyConfig;
  supportedModels: CatoModelConfig[];
  defaultModel: string;
  systemPromptTemplate: string;
  userPromptTemplate?: string;
  promptVariables: CatoPromptVariable[];
  outputSchemaRef?: string;
  estimatedCostCents: number;
  estimatedDurationMs: number;
  riskCategory: CatoRiskLevel;
  parallelizable: boolean;
  idempotent: boolean;
  scope: 'SYSTEM' | 'TENANT';
  tenantId?: string;
  enabled: boolean;
  minTier: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMethodDefinitionInput {
  methodId: string;
  name: string;
  description: string;
  methodType: CatoMethodType;
  version: string;
  capabilities?: string[];
  outputTypes: CatoOutputType[];
  useCases?: string[];
  requiresInContext?: CatoOutputType[];
  acceptsOutputTypes?: CatoOutputType[];
  typicalPredecessors?: string[];
  typicalSuccessors?: string[];
  contextStrategy: CatoContextStrategyConfig;
  supportedModels: CatoModelConfig[];
  defaultModel: string;
  systemPromptTemplate: string;
  userPromptTemplate?: string;
  promptVariables?: CatoPromptVariable[];
  outputSchemaRef?: string;
  estimatedCostCents?: number;
  estimatedDurationMs?: number;
  riskCategory?: CatoRiskLevel;
  parallelizable?: boolean;
  idempotent?: boolean;
}

// ============================================================================
// TOOL REGISTRY TYPES
// ============================================================================

export interface CatoRateLimit {
  requestsPerMinute?: number;
  requestsPerHour?: number;
  requestsPerDay?: number;
  concurrentLimit?: number;
}

export interface CatoToolDefinition {
  toolId: string;
  toolName: string;
  description: string;
  mcpServer: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  riskCategory: CatoRiskLevel;
  supportsDryRun: boolean;
  isReversible: boolean;
  compensationType: CatoCompensationType;
  compensationTool?: string;
  estimatedCostCents: number;
  rateLimit?: CatoRateLimit;
  requiredPermissions: string[];
  category?: string;
  tags: string[];
  scope: 'SYSTEM' | 'TENANT';
  tenantId?: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateToolDefinitionInput {
  toolId: string;
  toolName: string;
  description: string;
  mcpServer: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  riskCategory?: CatoRiskLevel;
  supportsDryRun?: boolean;
  isReversible?: boolean;
  compensationType?: CatoCompensationType;
  compensationTool?: string;
  estimatedCostCents?: number;
  rateLimit?: CatoRateLimit;
  requiredPermissions?: string[];
  category?: string;
  tags?: string[];
}

// ============================================================================
// PIPELINE TEMPLATE TYPES
// ============================================================================

export interface CatoPipelineTemplate {
  templateId: string;
  name: string;
  description: string;
  methodChain: string[];
  checkpointPositions: Record<string, CatoCheckpointConfig>;
  defaultConfig: Record<string, unknown>;
  category?: string;
  tags: string[];
  scope: 'SYSTEM' | 'TENANT';
  tenantId?: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// UNIVERSAL ENVELOPE PROTOCOL
// ============================================================================

export interface CatoConfidenceFactor {
  factor: string;
  score: number;
  weight: number;
  reasoning?: string;
}

export interface CatoRiskSignal {
  signalType: string;
  severity: CatoRiskLevel;
  description: string;
  source: string;
  mitigations?: string[];
}

export interface CatoModelUsage {
  modelId: string;
  provider: string;
  tokensInput: number;
  tokensOutput: number;
  costCents: number;
  latencyMs: number;
}

export interface CatoMethodOutput<T = unknown> {
  outputType: CatoOutputType;
  schemaRef: string;
  data: T;
  hash: string;
  summary: string;
}

export interface CatoComplianceContext {
  frameworks: string[];
  dataClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  containsPii: boolean;
  containsPhi: boolean;
  retentionDays?: number;
}

export interface CatoAccumulatedContext {
  history: CatoMethodEnvelope[];
  pruningApplied: CatoContextStrategy;
  originalCount: number;
  prunedCount: number;
  totalTokensEstimate: number;
}

export interface CatoMethodEnvelope<T = unknown> {
  envelopeId: string;
  pipelineId: string;
  tenantId: string;
  sequence: number;
  envelopeVersion: string;
  source: {
    methodId: string;
    methodType: CatoMethodType;
    methodName: string;
  };
  destination?: {
    methodId: string;
    routingReason: string;
  };
  output: CatoMethodOutput<T>;
  confidence: {
    score: number;
    factors: CatoConfidenceFactor[];
  };
  contextStrategy: CatoContextStrategy;
  context: CatoAccumulatedContext;
  riskSignals: CatoRiskSignal[];
  tracing: {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
  };
  compliance: CatoComplianceContext;
  models: CatoModelUsage[];
  durationMs: number;
  costCents: number;
  tokensUsed: number;
  timestamp: Date;
}

export interface CreateEnvelopeInput<T = unknown> {
  pipelineId: string;
  tenantId: string;
  sequence: number;
  source: {
    methodId: string;
    methodType: CatoMethodType;
    methodName: string;
  };
  destination?: {
    methodId: string;
    routingReason: string;
  };
  output: {
    outputType: CatoOutputType;
    schemaRef: string;
    data: T;
    summary: string;
  };
  confidence: {
    score: number;
    factors: CatoConfidenceFactor[];
  };
  contextStrategy: CatoContextStrategy;
  context: CatoAccumulatedContext;
  riskSignals?: CatoRiskSignal[];
  tracing: {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
  };
  compliance: CatoComplianceContext;
  models: CatoModelUsage[];
  durationMs: number;
  costCents: number;
  tokensUsed: number;
}

// ============================================================================
// PIPELINE EXECUTION TYPES
// ============================================================================

export interface CatoPipelineExecution {
  id: string;
  tenantId: string;
  userId?: string;
  status: CatoPipelineStatus;
  templateId?: string;
  config: Record<string, unknown>;
  governancePreset: 'COWBOY' | 'BALANCED' | 'PARANOID';
  originalRequest: Record<string, unknown>;
  originalRequestHash: string;
  methodsExecuted: string[];
  currentMethod?: string;
  currentSequence: number;
  totalCostCents: number;
  totalDurationMs: number;
  totalTokens: number;
  finalEnvelopeId?: string;
  executionResult?: Record<string, unknown>;
  error?: CatoPipelineError;
  traceId: string;
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
}

export interface CatoPipelineError {
  code: string;
  message: string;
  methodId?: string;
  sequence?: number;
  recoverable: boolean;
  details?: Record<string, unknown>;
}

export interface CreatePipelineExecutionInput {
  tenantId: string;
  userId?: string;
  templateId?: string;
  config?: Record<string, unknown>;
  governancePreset?: 'COWBOY' | 'BALANCED' | 'PARANOID';
  originalRequest: Record<string, unknown>;
}

// ============================================================================
// METHOD INVOCATION TYPES
// ============================================================================

export interface CatoMethodInvocation {
  id: string;
  pipelineId: string;
  tenantId: string;
  envelopeId?: string;
  methodId: string;
  methodName: string;
  methodType: CatoMethodType;
  sequence: number;
  inputEnvelopeRef?: string;
  outputEnvelopeRef?: string;
  modelsUsed: CatoModelUsage[];
  status: CatoInvocationStatus;
  error?: CatoPipelineError;
  retryCount: number;
  durationMs: number;
  costCents: number;
  tokensInput: number;
  tokensOutput: number;
  traceId: string;
  spanId: string;
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
}

// ============================================================================
// AUDIT PROMPT RECORD TYPES
// ============================================================================

export interface CatoAuditPromptRecord {
  id: string;
  pipelineId: string;
  tenantId: string;
  invocationId: string;
  promptSequence: number;
  promptType: string;
  modelId: string;
  modelProvider: string;
  systemPrompt: string;
  userPrompt: string;
  promptVariables?: Record<string, unknown>;
  modelResponse: string;
  responseMetadata: Record<string, unknown>;
  complianceFrameworks: string[];
  containsPii: boolean;
  containsPhi: boolean;
  piiRedacted: boolean;
  redactionLog?: Record<string, unknown>;
  tokensInput: number;
  tokensOutput: number;
  costCents: number;
  latencyMs: number;
  promptSentAt: Date;
  responseReceivedAt: Date;
  contentHash: string;
  createdAt: Date;
}

// ============================================================================
// CHECKPOINT TYPES
// ============================================================================

export type CatoCheckpointType = 'CP1' | 'CP2' | 'CP3' | 'CP4' | 'CP5';

export interface CatoCheckpointConfig {
  mode: CatoCheckpointMode;
  triggerOn: string[];
  timeoutSeconds?: number;
  timeoutAction?: CatoCheckpointDecision;
  autoApproveConditions?: string[];
}

export interface CatoCheckpointConfiguration {
  id: string;
  tenantId: string;
  preset: 'COWBOY' | 'BALANCED' | 'PARANOID';
  checkpoints: Record<CatoCheckpointType, CatoCheckpointConfig>;
  domainOverrides: Record<string, Record<CatoCheckpointType, CatoCheckpointConfig>>;
  actionTypeOverrides: Record<string, Record<CatoCheckpointType, CatoCheckpointConfig>>;
  defaultTimeoutSeconds: number;
  timeoutAction: CatoCheckpointDecision;
  escalationChain: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CatoCheckpointDecisionRecord {
  id: string;
  pipelineId: string;
  tenantId: string;
  envelopeId: string;
  checkpointType: CatoCheckpointType;
  checkpointName: string;
  triggerReason: string;
  presentedData: Record<string, unknown>;
  availableActions: string[];
  status: 'PENDING' | 'DECIDED' | 'TIMEOUT' | 'ESCALATED';
  decision?: CatoCheckpointDecision;
  decidedBy?: string;
  decidedByUserId?: string;
  modifications?: string[];
  feedback?: string;
  deadline: Date;
  timeoutAction: CatoCheckpointDecision;
  escalationLevel: number;
  escalatedTo?: string[];
  triggeredAt: Date;
  decidedAt?: Date;
  decisionTimeMs?: number;
  createdAt: Date;
}

// ============================================================================
// RISK ASSESSMENT TYPES
// ============================================================================

export interface CatoRiskFactor {
  factorId: string;
  name: string;
  category: string;
  level: CatoRiskLevel;
  score: number;
  weight: number;
  description: string;
  source: string;
  mitigations?: string[];
  vetoTrigger: boolean;
}

export interface CatoRiskAssessment {
  id: string;
  pipelineId: string;
  tenantId: string;
  envelopeId: string;
  overallRisk: CatoRiskLevel;
  overallRiskScore: number;
  vetoApplied: boolean;
  vetoFactor?: string;
  vetoReason?: string;
  riskFactors: CatoRiskFactor[];
  triageDecision: CatoTriageDecision;
  triageReason: string;
  autoExecuteThreshold: number;
  vetoThreshold: number;
  unmitigatedRisks: string[];
  mitigationSuggestions: Array<{
    riskFactorId: string;
    suggestion: string;
    estimatedReduction: number;
  }>;
  assessedAt: Date;
  createdAt: Date;
}

// ============================================================================
// COMPENSATION (SAGA PATTERN) TYPES
// ============================================================================

export interface CatoAffectedResource {
  resourceType: string;
  resourceId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
}

export interface CatoCompensationEntry {
  id: string;
  pipelineId: string;
  tenantId: string;
  invocationId?: string;
  stepNumber: number;
  stepName?: string;
  compensationType: CatoCompensationType;
  compensationTool?: string;
  compensationInputs?: Record<string, unknown>;
  compensationDeadline?: Date;
  affectedResources: CatoAffectedResource[];
  status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  priority: number;
  executedAt?: Date;
  result?: Record<string, unknown>;
  error?: string;
  retryCount: number;
  originalAction: Record<string, unknown>;
  originalResult?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// MERKLE CHAIN TYPES
// ============================================================================

export interface CatoMerkleEntry {
  id: string;
  tenantId: string;
  pipelineId?: string;
  sequenceNumber: number;
  recordType: string;
  recordId: string;
  recordHash: string;
  previousHash: string;
  merkleRoot: string;
  verified: boolean;
  verifiedAt?: Date;
  createdAt: Date;
}

// ============================================================================
// SERVICE INTERFACES
// ============================================================================

export interface SchemaRegistryService {
  getSchema(schemaRefId: string): Promise<CatoSchemaDefinition | null>;
  listSchemas(options?: {
    scope?: 'SYSTEM' | 'TENANT';
    outputType?: CatoOutputType;
    tenantId?: string;
  }): Promise<CatoSchemaDefinition[]>;
  createSchema(input: CreateSchemaDefinitionInput, tenantId?: string): Promise<CatoSchemaDefinition>;
  updateSchema(schemaRefId: string, updates: Partial<CreateSchemaDefinitionInput>): Promise<CatoSchemaDefinition>;
  deleteSchema(schemaRefId: string): Promise<void>;
  validatePayload(schemaRefId: string, payload: unknown): Promise<{ valid: boolean; errors?: string[] }>;
}

export interface MethodRegistryService {
  getMethod(methodId: string): Promise<CatoMethodDefinition | null>;
  listMethods(options?: {
    scope?: 'SYSTEM' | 'TENANT';
    methodType?: CatoMethodType;
    tenantId?: string;
    enabled?: boolean;
  }): Promise<CatoMethodDefinition[]>;
  createMethod(input: CreateMethodDefinitionInput, tenantId?: string): Promise<CatoMethodDefinition>;
  updateMethod(methodId: string, updates: Partial<CreateMethodDefinitionInput>): Promise<CatoMethodDefinition>;
  deleteMethod(methodId: string): Promise<void>;
  getMethodChain(startMethodId: string): Promise<CatoMethodDefinition[]>;
  findCompatibleMethods(outputType: CatoOutputType): Promise<CatoMethodDefinition[]>;
}

export interface ToolRegistryService {
  getTool(toolId: string): Promise<CatoToolDefinition | null>;
  listTools(options?: {
    scope?: 'SYSTEM' | 'TENANT';
    category?: string;
    riskCategory?: CatoRiskLevel;
    tenantId?: string;
    enabled?: boolean;
  }): Promise<CatoToolDefinition[]>;
  createTool(input: CreateToolDefinitionInput, tenantId?: string): Promise<CatoToolDefinition>;
  updateTool(toolId: string, updates: Partial<CreateToolDefinitionInput>): Promise<CatoToolDefinition>;
  deleteTool(toolId: string): Promise<void>;
  getToolsByCapability(capability: string): Promise<CatoToolDefinition[]>;
  validateToolInput(toolId: string, input: unknown): Promise<{ valid: boolean; errors?: string[] }>;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface CatoPaginationOptions {
  limit?: number;
  offset?: number;
  cursor?: string;
}

export interface CatoPaginatedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface CatoFilterOptions {
  tenantId?: string;
  userId?: string;
  status?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  methodTypes?: CatoMethodType[];
  riskLevels?: CatoRiskLevel[];
}

// ============================================================================
// EVENT TYPES
// ============================================================================

export interface CatoPipelineEvent {
  eventType:
    | 'PIPELINE_STARTED'
    | 'PIPELINE_COMPLETED'
    | 'PIPELINE_FAILED'
    | 'METHOD_STARTED'
    | 'METHOD_COMPLETED'
    | 'METHOD_FAILED'
    | 'CHECKPOINT_TRIGGERED'
    | 'CHECKPOINT_DECIDED'
    | 'RISK_VETO'
    | 'COMPENSATION_STARTED'
    | 'COMPENSATION_COMPLETED';
  pipelineId: string;
  tenantId: string;
  methodId?: string;
  envelopeId?: string;
  data: Record<string, unknown>;
  timestamp: Date;
}

export type CatoPipelineEventHandler = (event: CatoPipelineEvent) => Promise<void>;

// ============================================================================
// GOVERNANCE PRESETS
// ============================================================================

export const CATO_GOVERNANCE_PRESETS: Record<
  'COWBOY' | 'BALANCED' | 'PARANOID',
  {
    description: string;
    checkpoints: Record<CatoCheckpointType, CatoCheckpointConfig>;
    riskThresholds: {
      autoExecute: number;
      veto: number;
    };
  }
> = {
  COWBOY: {
    description: 'Maximum autonomy - minimal checkpoints, auto-approve most actions',
    checkpoints: {
      CP1: { mode: CatoCheckpointMode.DISABLED, triggerOn: [] },
      CP2: { mode: CatoCheckpointMode.CONDITIONAL, triggerOn: ['destructive_action'] },
      CP3: { mode: CatoCheckpointMode.DISABLED, triggerOn: [] },
      CP4: { mode: CatoCheckpointMode.CONDITIONAL, triggerOn: ['critical_risk'] },
      CP5: { mode: CatoCheckpointMode.DISABLED, triggerOn: [] },
    },
    riskThresholds: {
      autoExecute: 0.7,
      veto: 0.95,
    },
  },
  BALANCED: {
    description: 'Balanced autonomy - checkpoints at key decision points',
    checkpoints: {
      CP1: { mode: CatoCheckpointMode.CONDITIONAL, triggerOn: ['ambiguous_intent', 'missing_context'] },
      CP2: { mode: CatoCheckpointMode.CONDITIONAL, triggerOn: ['high_cost', 'irreversible_actions'] },
      CP3: { mode: CatoCheckpointMode.CONDITIONAL, triggerOn: ['objections_raised', 'consensus_not_reached'] },
      CP4: { mode: CatoCheckpointMode.CONDITIONAL, triggerOn: ['risk_above_threshold', 'cost_above_threshold'] },
      CP5: { mode: CatoCheckpointMode.DISABLED, triggerOn: [] },
    },
    riskThresholds: {
      autoExecute: 0.5,
      veto: 0.85,
    },
  },
  PARANOID: {
    description: 'Maximum oversight - checkpoints at every stage',
    checkpoints: {
      CP1: { mode: CatoCheckpointMode.MANUAL, triggerOn: ['always'] },
      CP2: { mode: CatoCheckpointMode.MANUAL, triggerOn: ['always'] },
      CP3: { mode: CatoCheckpointMode.MANUAL, triggerOn: ['always'] },
      CP4: { mode: CatoCheckpointMode.MANUAL, triggerOn: ['always'] },
      CP5: { mode: CatoCheckpointMode.CONDITIONAL, triggerOn: ['execution_completed'] },
    },
    riskThresholds: {
      autoExecute: 0.2,
      veto: 0.6,
    },
  },
};
