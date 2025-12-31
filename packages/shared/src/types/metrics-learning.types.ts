/**
 * RADIANT v4.18.56 - Metrics & Persistent Learning Types
 * Comprehensive types for metrics collection, user memories, and learning hierarchy
 */

// ============================================================================
// SECTION 1: BILLING METRICS
// ============================================================================

export interface BillingMetric {
  id: string;
  tenantId: string;
  userId?: string;
  periodDate: string; // YYYY-MM-DD
  periodHour?: number; // 0-23
  modelId?: string;
  providerId?: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCostCents: number;
  outputCostCents: number;
  totalCostCents: number;
  storageBytesUsed: number;
  storageCostCents: number;
  computeSeconds: number;
  computeCostCents: number;
  apiCalls: number;
  successfulCalls: number;
  failedCalls: number;
  breakdown: Record<string, unknown>;
  createdAt: string;
}

export interface BillingMetricInput {
  tenantId: string;
  userId?: string;
  modelId?: string;
  providerId?: string;
  inputTokens?: number;
  outputTokens?: number;
  costCents?: number;
  storageBytesUsed?: number;
  computeSeconds?: number;
  success?: boolean;
}

// ============================================================================
// SECTION 2: PERFORMANCE METRICS
// ============================================================================

export interface PerformanceMetric {
  id: string;
  tenantId: string;
  userId?: string;
  recordedAt: string;
  periodMinute: string;
  endpoint?: string;
  method?: string;
  modelId?: string;
  providerId?: string;
  totalLatencyMs?: number;
  timeToFirstTokenMs?: number;
  inferenceTimeMs?: number;
  queueWaitMs?: number;
  networkLatencyMs?: number;
  tokensPerSecond?: number;
  memoryMb?: number;
  cpuPercent?: number;
  gpuUtilization?: number;
  requestSizeBytes?: number;
  responseSizeBytes?: number;
  statusCode?: number;
  success: boolean;
  metadata: Record<string, unknown>;
}

export interface PerformanceMetricInput {
  tenantId: string;
  userId?: string;
  endpoint?: string;
  method?: string;
  modelId?: string;
  providerId?: string;
  totalLatencyMs?: number;
  timeToFirstTokenMs?: number;
  inferenceTimeMs?: number;
  statusCode?: number;
  success?: boolean;
  requestSizeBytes?: number;
  responseSizeBytes?: number;
}

// ============================================================================
// SECTION 3: FAILURE TRACKING
// ============================================================================

export type FailureType =
  | 'api_error'
  | 'model_error'
  | 'timeout'
  | 'rate_limit'
  | 'auth_error'
  | 'validation_error'
  | 'provider_error'
  | 'internal_error'
  | 'quota_exceeded'
  | 'content_filter'
  | 'context_length'
  | 'network_error'
  | 'unknown';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface FailureEvent {
  id: string;
  tenantId: string;
  userId?: string;
  occurredAt: string;
  failureType: FailureType;
  severity: Severity;
  endpoint?: string;
  modelId?: string;
  providerId?: string;
  orchestrationId?: string;
  conversationId?: string;
  errorCode?: string;
  errorMessage?: string;
  errorStack?: string;
  requestId?: string;
  requestPayloadHash?: string;
  resolved: boolean;
  resolvedAt?: string;
  resolutionNotes?: string;
  autoRecovered: boolean;
  retryCount: number;
  metadata: Record<string, unknown>;
}

export interface FailureEventInput {
  tenantId: string;
  userId?: string;
  failureType: FailureType;
  severity: Severity;
  endpoint?: string;
  modelId?: string;
  providerId?: string;
  orchestrationId?: string;
  conversationId?: string;
  errorCode?: string;
  errorMessage?: string;
  errorStack?: string;
  requestId?: string;
}

// ============================================================================
// SECTION 4: PROMPT VIOLATIONS
// ============================================================================

export type ViolationType =
  | 'content_policy'
  | 'jailbreak_attempt'
  | 'injection_attempt'
  | 'pii_exposure'
  | 'rate_abuse'
  | 'token_abuse'
  | 'harassment'
  | 'hate_speech'
  | 'violence'
  | 'sexual_content'
  | 'self_harm'
  | 'illegal_activity'
  | 'copyright'
  | 'impersonation'
  | 'misinformation'
  | 'other';

export type DetectionMethod =
  | 'content_filter'
  | 'pattern_match'
  | 'model_refusal'
  | 'manual_review'
  | 'user_report'
  | 'automated_scan';

export type ViolationAction =
  | 'blocked'
  | 'warned'
  | 'filtered'
  | 'logged'
  | 'escalated'
  | 'ignored';

export interface PromptViolation {
  id: string;
  tenantId: string;
  userId: string;
  occurredAt: string;
  violationType: ViolationType;
  severity: Severity;
  conversationId?: string;
  messageId?: string;
  modelId?: string;
  promptHash?: string;
  promptSnippet?: string;
  detectionMethod?: DetectionMethod;
  confidence?: number;
  actionTaken?: ViolationAction;
  reviewed: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewOutcome?: string;
  falsePositive?: boolean;
  metadata: Record<string, unknown>;
}

export interface PromptViolationInput {
  tenantId: string;
  userId: string;
  violationType: ViolationType;
  severity: Severity;
  conversationId?: string;
  messageId?: string;
  modelId?: string;
  promptSnippet?: string;
  detectionMethod?: DetectionMethod;
  confidence?: number;
  actionTaken?: ViolationAction;
}

// ============================================================================
// SECTION 5: SYSTEM LOGS
// ============================================================================

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface SystemLog {
  id: string;
  tenantId?: string;
  userId?: string;
  loggedAt: string;
  logLevel: LogLevel;
  logSource: string;
  logCategory?: string;
  message: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  data: Record<string, unknown>;
  durationMs?: number;
  environment: string;
  version?: string;
}

export interface SystemLogInput {
  tenantId?: string;
  userId?: string;
  logLevel: LogLevel;
  logSource: string;
  logCategory?: string;
  message: string;
  requestId?: string;
  traceId?: string;
  data?: Record<string, unknown>;
  durationMs?: number;
}

// ============================================================================
// SECTION 6: USER RULES (Think Tank)
// ============================================================================

export type RuleCategory =
  | 'behavior'
  | 'format'
  | 'tone'
  | 'content'
  | 'restriction'
  | 'preference'
  | 'domain'
  | 'persona'
  | 'workflow'
  | 'other';

export interface UserRule {
  id: string;
  tenantId: string;
  userId: string;
  ruleName: string;
  ruleCategory?: RuleCategory;
  currentVersion: number;
  ruleContent: string;
  rulePriority: number;
  isActive: boolean;
  appliesToModels?: string[];
  appliesToTasks?: string[];
  timesApplied: number;
  timesEffective: number;
  effectivenessScore: number;
  createdAt: string;
  updatedAt: string;
  lastAppliedAt?: string;
}

export interface UserRuleInput {
  tenantId: string;
  userId: string;
  ruleName: string;
  ruleCategory?: RuleCategory;
  ruleContent: string;
  rulePriority?: number;
  isActive?: boolean;
  appliesToModels?: string[];
  appliesToTasks?: string[];
}

export interface UserRuleVersion {
  id: string;
  ruleId: string;
  version: number;
  versionTimestamp: string;
  ruleContent: string;
  rulePriority?: number;
  isActive?: boolean;
  changeType: 'create' | 'update' | 'delete' | 'restore';
  changeReason?: string;
  changedBy?: string;
  metadata: Record<string, unknown>;
}

// ============================================================================
// SECTION 7: USER LEARNED PREFERENCES
// ============================================================================

export type PreferenceCategory =
  | 'communication_style'
  | 'response_format'
  | 'detail_level'
  | 'expertise_level'
  | 'topic_interest'
  | 'model_preference'
  | 'time_preference'
  | 'language'
  | 'accessibility'
  | 'privacy'
  | 'other';

export type LearnedFrom =
  | 'explicit_setting'
  | 'implicit_behavior'
  | 'feedback'
  | 'conversation'
  | 'pattern_detection'
  | 'admin_set'
  | 'default';

export interface UserLearnedPreference {
  id: string;
  tenantId: string;
  userId: string;
  preferenceKey: string;
  preferenceCategory?: PreferenceCategory;
  currentVersion: number;
  preferenceValue: unknown;
  confidence: number;
  evidenceCount: number;
  lastEvidenceAt: string;
  learnedFrom?: LearnedFrom;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferenceInput {
  tenantId: string;
  userId: string;
  preferenceKey: string;
  preferenceCategory?: PreferenceCategory;
  preferenceValue: unknown;
  confidence?: number;
  learnedFrom?: LearnedFrom;
}

// ============================================================================
// SECTION 8: TENANT AGGREGATE LEARNING
// ============================================================================

export interface TenantAggregateLearning {
  id: string;
  tenantId: string;
  learningDimension: string;
  currentVersion: number;
  stateData: Record<string, unknown>;
  confidence: number;
  sampleCount: number;
  contributingUsers: number;
  lastUpdated: string;
  lastLearningEventAt?: string;
}

export type LearningEventType =
  | 'model_success'
  | 'model_failure'
  | 'user_correction'
  | 'pattern_detected'
  | 'preference_learned'
  | 'error_recovered'
  | 'optimization_applied'
  | 'feedback_incorporated'
  | 'rule_effectiveness';

export interface TenantLearningEvent {
  id: string;
  tenantId: string;
  aggregateLearningId?: string;
  eventType: LearningEventType;
  sourceUserHash?: string;
  eventData: Record<string, unknown>;
  impactScore: number;
  wasIncorporated: boolean;
  occurredAt: string;
}

export interface TenantLearningEventInput {
  tenantId: string;
  userId: string;
  eventType: LearningEventType;
  learningDimension: string;
  eventData: Record<string, unknown>;
  impactScore?: number;
}

export interface TenantModelPerformance {
  id: string;
  tenantId: string;
  modelId: string;
  taskType: string;
  qualityScore: number;
  speedScore: number;
  costEfficiencyScore: number;
  reliabilityScore: number;
  totalUses: number;
  successfulUses: number;
  positiveFeedback: number;
  negativeFeedback: number;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// SECTION 9: GLOBAL AGGREGATE LEARNING
// ============================================================================

export interface GlobalAggregateLearning {
  id: string;
  learningDimension: string;
  currentVersion: number;
  stateData: Record<string, unknown>;
  confidence: number;
  sampleCount: number;
  contributingTenants: number;
  contributingUsers: number;
  minTenantThreshold: number;
  anonymizationLevel: 'low' | 'medium' | 'high';
  lastUpdated: string;
  lastAggregationAt?: string;
}

export interface GlobalModelPerformance {
  id: string;
  modelId: string;
  taskType: string;
  qualityScore: number;
  speedScore: number;
  costEfficiencyScore: number;
  reliabilityScore: number;
  totalTenantsUsing: number;
  totalUses: number;
  positiveFeedbackRate: number;
  confidence: number;
  lastAggregatedAt: string;
}

export interface GlobalPatternLibrary {
  id: string;
  patternHash: string;
  patternCategory: string;
  patternName?: string;
  patternTemplate: string;
  patternDescription?: string;
  tenantAdoptionCount: number;
  successfulApplications: number;
  totalApplications: number;
  successRate?: number;
  applicableTasks?: string[];
  applicableDomains?: string[];
  confidence: number;
  peerValidated: boolean;
  firstDiscoveredAt: string;
  lastAppliedAt?: string;
}

// ============================================================================
// SECTION 10: LEARNING INFLUENCE HIERARCHY
// ============================================================================

export interface LearningInfluenceConfig {
  id: string;
  tenantId: string;
  userWeight: number;
  tenantWeight: number;
  globalWeight: number;
  dimensionOverrides: Record<string, {
    userWeight: number;
    tenantWeight: number;
    globalWeight: number;
  }>;
  enableUserLearning: boolean;
  enableTenantAggregation: boolean;
  enableGlobalLearning: boolean;
  contributeToGlobal: boolean;
  anonymizationLevel: 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt: string;
}

export interface LearningInfluenceConfigInput {
  tenantId: string;
  userWeight?: number;
  tenantWeight?: number;
  globalWeight?: number;
  dimensionOverrides?: Record<string, {
    userWeight: number;
    tenantWeight: number;
    globalWeight: number;
  }>;
  enableUserLearning?: boolean;
  enableTenantAggregation?: boolean;
  enableGlobalLearning?: boolean;
  contributeToGlobal?: boolean;
}

export interface LearningInfluence {
  userInfluence: Record<string, unknown>;
  tenantInfluence: Record<string, unknown>;
  globalInfluence: Record<string, unknown>;
  userWeight: number;
  tenantWeight: number;
  globalWeight: number;
  combinedRecommendation: Record<string, unknown>;
}

export interface LearningDecision {
  id: string;
  tenantId: string;
  userId: string;
  decisionType: string;
  decisionContext: Record<string, unknown>;
  userInfluenceUsed?: Record<string, unknown>;
  tenantInfluenceUsed?: Record<string, unknown>;
  globalInfluenceUsed?: Record<string, unknown>;
  userWeightApplied: number;
  tenantWeightApplied: number;
  globalWeightApplied: number;
  finalDecision: Record<string, unknown>;
  outcomeRecorded: boolean;
  outcomePositive?: boolean;
  outcomeRecordedAt?: string;
  decidedAt: string;
}

// ============================================================================
// SECTION 11: LEARNING SNAPSHOTS & RECOVERY
// ============================================================================

export type ScopeType = 'user' | 'tenant' | 'global';

export interface LearningSnapshot {
  id: string;
  scopeType: ScopeType;
  scopeId?: string;
  tenantId?: string;
  snapshotVersion: number;
  snapshotTimestamp: string;
  learningState: Record<string, unknown>;
  stateChecksum: string;
  modelVersions: Record<string, string>;
  totalSamples?: number;
  isCurrent: boolean;
  canRecoverFrom: boolean;
  recoveryTestedAt?: string;
}

export type RecoveryType =
  | 'cold_start'
  | 'warm_restart'
  | 'snapshot_restore'
  | 'incremental_rebuild'
  | 'migration'
  | 'rollback'
  | 'manual_restore';

export interface LearningRecoveryLog {
  id: string;
  recoveryType: RecoveryType;
  scopeType: ScopeType;
  scopeId?: string;
  tenantId?: string;
  snapshotId?: string;
  startedAt: string;
  completedAt?: string;
  success?: boolean;
  recordsRecovered?: number;
  timeToRecoverMs?: number;
  errorMessage?: string;
  errorDetails?: Record<string, unknown>;
}

// ============================================================================
// SECTION 12: METRICS SUMMARY & DASHBOARD
// ============================================================================

export interface MetricsSummary {
  totalCostCents: number;
  totalTokens: number;
  totalApiCalls: number;
  successRate: number;
  avgLatencyMs: number;
  failureCount: number;
  violationCount: number;
  activeUsers: number;
  modelsUsed: string[];
}

export interface TenantDailyMetrics {
  tenantId: string;
  periodDate: string;
  totalTokens: number;
  totalCostCents: number;
  totalApiCalls: number;
  successfulCalls: number;
  failedCalls: number;
  successRate: number;
  activeUsers: number;
  modelsUsed: number;
}

export interface MetricsDashboard {
  summary: MetricsSummary;
  dailyMetrics: TenantDailyMetrics[];
  topModels: {
    modelId: string;
    totalUses: number;
    totalCostCents: number;
    avgLatencyMs: number;
  }[];
  recentFailures: FailureEvent[];
  recentViolations: PromptViolation[];
  learningStatus: {
    userPreferencesCount: number;
    tenantPatternsCount: number;
    lastSnapshotAt?: string;
    recoveryReady: boolean;
  };
}

// ============================================================================
// SECTION 13: API REQUEST/RESPONSE TYPES
// ============================================================================

export interface MetricsQueryParams {
  startDate: string;
  endDate: string;
  userId?: string;
  modelId?: string;
  providerId?: string;
  limit?: number;
  offset?: number;
}

export interface MetricsResponse<T> {
  success: boolean;
  data: T;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  error?: string;
}

export interface LearningQueryParams {
  dimension?: string;
  includeGlobal?: boolean;
  includeHistory?: boolean;
}

export interface RecordLearningRequest {
  eventType: LearningEventType;
  learningDimension: string;
  eventData: Record<string, unknown>;
  impactScore?: number;
}

export interface GetLearningInfluenceRequest {
  decisionType: string;
  context?: Record<string, unknown>;
}

export interface CreateSnapshotRequest {
  scopeType: ScopeType;
  scopeId?: string;
}

export interface RecoverFromSnapshotRequest {
  snapshotId: string;
}
