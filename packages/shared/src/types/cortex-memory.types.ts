/**
 * Cortex Memory System Types
 * Tiered Memory Architecture v4.20.0
 * 
 * Three-tier memory system: Hot (Redis) → Warm (Neptune+pgvector) → Cold (S3+Iceberg)
 */

// =============================================================================
// Tier Definitions
// =============================================================================

export type MemoryTier = 'hot' | 'warm' | 'cold';

export interface CortexTierConfig {
  hot: HotTierConfig;
  warm: WarmTierConfig;
  cold: ColdTierConfig;
}

export interface HotTierConfig {
  enabled: boolean;
  redisClusterMode: boolean;
  shardCount: number;
  replicasPerShard: number;
  instanceType: string;
  maxMemoryPercent: number;
  defaultTtlSeconds: number;
  overflowToDynamoDB: boolean;
}

export interface WarmTierConfig {
  enabled: boolean;
  neptuneMode: 'serverless' | 'provisioned';
  neptuneMinCapacity?: number;
  neptuneMaxCapacity?: number;
  neptuneInstanceClass?: string;
  pgvectorEnabled: boolean;
  retentionDays: number;
  graphWeightPercent: number;
  vectorWeightPercent: number;
}

export interface ColdTierConfig {
  enabled: boolean;
  s3Bucket: string;
  icebergEnabled: boolean;
  compressionFormat: 'snappy' | 'zstd' | 'gzip';
  partitionBy: string[];
  storageClasses: StorageClassConfig[];
  zeroCopyEnabled: boolean;
}

export interface StorageClassConfig {
  ageRangeDays: { min: number; max: number | null };
  storageClass: 'STANDARD' | 'INTELLIGENT_TIERING' | 'GLACIER_IR' | 'DEEP_ARCHIVE';
  retrievalLatency: string;
}

// =============================================================================
// Hot Tier Types (Redis + DynamoDB)
// =============================================================================

export type HotKeyType = 'context' | 'ghost' | 'telemetry' | 'prefetch' | 'ratelimit';

export interface HotTierKey {
  type: HotKeyType;
  tenantId: string;
  identifier: string; // session, user, source, hash
  ttlSeconds: number;
}

export interface SessionContext {
  sessionId: string;
  tenantId: string;
  userId: string;
  messages: ContextMessage[];
  systemPrompt?: string;
  activePersona?: string;
  featureFlags: Record<string, boolean>;
  metadata: Record<string, unknown>;
  createdAt: Date;
  lastAccessedAt: Date;
  expiresAt: Date;
}

export interface ContextMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tokenCount?: number;
}

export interface CortexGhostVector {
  userId: string;
  tenantId: string;
  vector: number[]; // 4096-dimensional
  personality: PersonalityTraits;
  lastUpdated: Date;
  interactionCount: number;
  version: number;
}

export interface PersonalityTraits {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
  curiosity: number;
  creativity: number;
  analyticalDepth: number;
}

export interface TelemetryFeed {
  sourceId: string;
  tenantId: string;
  dataType: string;
  value: number | string | Record<string, unknown>;
  timestamp: Date;
  ttlSeconds: number;
}

export interface PrefetchEntry {
  hash: string;
  tenantId: string;
  nodeIds: string[];
  content: string;
  confidence: number;
  expiresAt: Date;
}

// =============================================================================
// Warm Tier Types (Neptune Knowledge Graph + pgvector)
// =============================================================================

export type GraphNodeType = 'document' | 'entity' | 'concept' | 'procedure' | 'fact';
export type GraphEdgeType = 
  | 'mentions' 
  | 'causes' 
  | 'depends_on' 
  | 'supersedes' 
  | 'verified_by' 
  | 'authored_by' 
  | 'relates_to'
  | 'contains'
  | 'requires';

export interface GraphNode {
  id: string;
  tenantId: string;
  nodeType: GraphNodeType;
  label: string;
  properties: Record<string, unknown>;
  embedding?: number[];
  confidence: number;
  sourceDocumentIds: string[];
  isEvergreen: boolean;
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date;
}

export interface GraphEdge {
  id: string;
  tenantId: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: GraphEdgeType;
  weight: number;
  properties: Record<string, unknown>;
  confidence: number;
  createdAt: Date;
}

export interface GraphDocument {
  id: string;
  tenantId: string;
  title: string;
  source: string;
  sourceType: 'upload' | 'mount' | 'api';
  hash: string;
  nodeCount: number;
  status: 'processing' | 'indexed' | 'archived' | 'error';
  createdAt: Date;
  indexedAt?: Date;
  archivedAt?: Date;
}

export interface GraphTraversalQuery {
  startNodeIds?: string[];
  startLabels?: string[];
  edgeTypes?: GraphEdgeType[];
  nodeTypes?: GraphNodeType[];
  maxHops: number;
  minConfidence: number;
  limit: number;
  includeEmbeddings?: boolean;
}

export interface GraphTraversalResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  paths: GraphPath[];
  reasoning: string;
  queryTimeMs: number;
}

export interface GraphPath {
  nodeIds: string[];
  edgeIds: string[];
  totalWeight: number;
  confidence: number;
}

// =============================================================================
// Cold Tier Types (S3 + Iceberg + Zero-Copy)
// =============================================================================

export interface ColdArchiveRecord {
  id: string;
  tenantId: string;
  originalTier: 'hot' | 'warm';
  originalTableName: string;
  archiveReason: 'age' | 'manual' | 'gdpr' | 'retention_policy';
  s3Key: string;
  icebergTableName: string;
  partitionValues: Record<string, string>;
  recordCount: number;
  sizeBytes: number;
  checksum: string;
  storageClass: string;
  archivedAt: Date;
  retrievableUntil?: Date;
}

export interface ZeroCopyMount {
  id: string;
  tenantId: string;
  name: string;
  sourceType: 'snowflake' | 'databricks' | 's3' | 'azure_datalake' | 'gcs';
  connectionConfig: ZeroCopyConnectionConfig;
  status: 'active' | 'scanning' | 'error' | 'disconnected';
  lastScanAt?: Date;
  objectCount: number;
  totalSizeBytes: number;
  indexedNodeCount: number;
  credentialSecretArn: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ZeroCopyConnectionConfig {
  // Snowflake
  snowflakeAccount?: string;
  snowflakeWarehouse?: string;
  snowflakeDatabase?: string;
  snowflakeSchema?: string;
  
  // Databricks
  databricksWorkspaceUrl?: string;
  databricksCatalog?: string;
  databricksSchema?: string;
  
  // S3
  s3BucketArn?: string;
  s3Prefix?: string;
  s3RoleArn?: string;
  
  // Azure
  azureStorageAccount?: string;
  azureContainer?: string;
  azureServicePrincipalId?: string;
  
  // GCS
  gcsBucket?: string;
  gcsPrefix?: string;
  gcsWorkloadIdentityPool?: string;
}

export interface ZeroCopyScanResult {
  mountId: string;
  objectsScanned: number;
  objectsIndexed: number;
  nodesCreated: number;
  errorCount: number;
  scanDurationMs: number;
  scannedAt: Date;
}

// =============================================================================
// Tier Coordinator Types
// =============================================================================

export interface TierCoordinatorConfig {
  tenantId: string;
  hotToWarmThresholdHours: number;
  warmToColdThresholdDays: number;
  enableAutoPromotion: boolean;
  enableAutoArchival: boolean;
  evergreenNodeTypes: GraphNodeType[];
  priorityDomains: string[];
}

export interface DataFlowMetrics {
  tenantId: string;
  period: 'hour' | 'day' | 'week';
  hotToWarmPromotions: number;
  warmToColdArchivals: number;
  coldToWarmRetrievals: number;
  hotCacheMissRate: number;
  warmQueryLatencyP99Ms: number;
  coldRetrievalLatencyP99Ms: number;
  tierMissRate: number;
}

export interface TierHealthStatus {
  tier: MemoryTier;
  status: 'healthy' | 'degraded' | 'critical';
  metrics: TierMetrics;
  alerts: TierAlert[];
  lastChecked: Date;
}

export interface TierMetrics {
  // Hot Tier
  redisMemoryUsagePercent?: number;
  redisCacheHitRate?: number;
  redisP99LatencyMs?: number;
  redisConnectionCount?: number;
  
  // Warm Tier
  neptuneCpuPercent?: number;
  neptuneQueryLatencyP99Ms?: number;
  pgvectorIndexSize?: number;
  graphNodeCount?: number;
  graphEdgeCount?: number;
  
  // Cold Tier
  s3StorageBytes?: number;
  s3StorageCostUsd?: number;
  athenaQueryDurationP99Ms?: number;
  icebergCompactionLagHours?: number;
  zeroCopyMountErrorCount?: number;
}

export interface TierAlert {
  id: string;
  tier: MemoryTier;
  severity: 'info' | 'warning' | 'critical';
  metric: string;
  threshold: number;
  currentValue: number;
  message: string;
  triggeredAt: Date;
  acknowledgedAt?: Date;
}

// =============================================================================
// Housekeeping Types (Twilight Dreaming Integration)
// =============================================================================

export interface TwilightDreamingTask {
  taskType: 
    | 'ttl_enforcement'
    | 'archive_promotion'
    | 'deduplication'
    | 'conflict_resolution'
    | 'iceberg_compaction'
    | 'index_optimization'
    | 'integrity_audit'
    | 'storage_report';
  frequency: 'hourly' | 'nightly' | 'weekly';
  lastRunAt?: Date;
  nextRunAt: Date;
  status: 'scheduled' | 'running' | 'completed' | 'failed';
  lastResult?: TwilightTaskResult;
}

export interface TwilightTaskResult {
  taskType: string;
  success: boolean;
  recordsProcessed: number;
  errorsEncountered: number;
  durationMs: number;
  details: Record<string, unknown>;
  completedAt: Date;
}

export interface GdprErasureRequest {
  id: string;
  tenantId: string;
  userId?: string;
  scopeType: 'user' | 'tenant';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  hotTierStatus: 'pending' | 'completed';
  warmTierStatus: 'pending' | 'completed';
  coldTierStatus: 'pending' | 'completed';
  auditLogRetained: boolean;
  requestedAt: Date;
  completedAt?: Date;
  error?: string;
}

// =============================================================================
// Admin Dashboard Types
// =============================================================================

export interface CortexOverview {
  tenantId: string;
  tiers: {
    hot: TierSummary;
    warm: TierSummary;
    cold: TierSummary;
  };
  dataFlow: DataFlowMetrics;
  health: TierHealthStatus[];
  costProjection: CostProjection;
}

export interface TierSummary {
  tier: MemoryTier;
  storageUsedBytes: number;
  storageAllocatedBytes: number;
  utilizationPercent: number;
  recordCount: number;
  latencyP99Ms: number;
  status: 'healthy' | 'degraded' | 'critical';
}

export interface CostProjection {
  currentMonthUsd: number;
  projectedMonthUsd: number;
  byTier: {
    hot: number;
    warm: number;
    cold: number;
  };
  growthRatePercent: number;
  recommendations: string[];
}

// =============================================================================
// API Types
// =============================================================================

export interface CortexDashboardRequest {
  tenantId: string;
}

export interface CortexDashboardResponse {
  overview: CortexOverview;
  recentActivity: DataFlowMetrics[];
  alerts: TierAlert[];
  housekeepingStatus: TwilightDreamingTask[];
  zeroCopyMounts: ZeroCopyMount[];
}

export interface GraphExploreRequest {
  tenantId: string;
  query?: GraphTraversalQuery;
  search?: string;
  nodeId?: string;
}

export interface GraphExploreResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  totalNodes: number;
  totalEdges: number;
  conflicts: ConflictingFact[];
}

export interface ConflictingFact {
  nodeId1: string;
  nodeId2: string;
  conflictType: 'contradiction' | 'superseded' | 'ambiguous';
  description: string;
  detectedAt: Date;
  resolvedAt?: Date;
}

export interface ZeroCopyMountRequest {
  tenantId: string;
  name: string;
  sourceType: ZeroCopyMount['sourceType'];
  connectionConfig: ZeroCopyConnectionConfig;
}

export interface TriggerHousekeepingRequest {
  tenantId: string;
  taskType: TwilightDreamingTask['taskType'];
}

export interface GdprErasureRequestCreate {
  tenantId: string;
  userId?: string;
  scopeType: 'user' | 'tenant';
  reason: string;
}

// =============================================================================
// Golden Rules Override System (v2.0)
// =============================================================================

export type GoldenRuleType = 'force_override' | 'ignore_source' | 'prefer_source' | 'deprecate';

export interface GoldenRule {
  id: string;
  tenantId: string;
  entityId?: string;
  ruleType: GoldenRuleType;
  condition: string;
  override: string;
  reason: string;
  priority: number;
  isActive: boolean;
  verifiedBy: string;
  verifiedAt: Date;
  signature: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface GoldenRuleCreateRequest {
  tenantId: string;
  entityId?: string;
  ruleType: GoldenRuleType;
  condition: string;
  override: string;
  reason: string;
  priority?: number;
  expiresAt?: Date;
}

export interface GoldenRuleMatch {
  ruleId: string;
  ruleType: GoldenRuleType;
  override: string;
  confidence: number;
  chainOfCustody: ChainOfCustody;
}

// =============================================================================
// Chain of Custody Audit Trail (v2.0)
// =============================================================================

export interface ChainOfCustody {
  factId: string;
  tenantId: string;
  source: string;
  sourceType: 'document' | 'graph_node' | 'golden_rule' | 'telemetry' | 'user_input';
  extractedAt: Date;
  extractedBy?: string;
  verifiedBy?: string;
  verifiedAt?: Date;
  signature?: string;
  supersedes?: string[];
  metadata: Record<string, unknown>;
}

export interface ChainOfCustodyCreateRequest {
  tenantId: string;
  factId: string;
  source: string;
  sourceType: ChainOfCustody['sourceType'];
  metadata?: Record<string, unknown>;
}

export interface AuditTrailEntry {
  id: string;
  chainOfCustodyId: string;
  action: 'created' | 'verified' | 'updated' | 'superseded' | 'deleted';
  performedBy: string;
  performedAt: Date;
  previousValue?: string;
  newValue?: string;
  reason?: string;
  signature: string;
}

// =============================================================================
// Stub Nodes - Zero-Copy Pointers (v2.0)
// =============================================================================

export type StubNodeFormat = 'csv' | 'json' | 'parquet' | 'pdf' | 'docx' | 'xlsx' | 'txt' | 'html';

export interface StubNode {
  id: string;
  tenantId: string;
  nodeType: 'stub';
  label: string;
  description?: string;
  externalSource: StubNodeExternalSource;
  extractedMetadata: StubNodeMetadata;
  connectedTo: string[];
  lastScannedAt: Date;
  scanStatus: 'pending' | 'scanning' | 'complete' | 'error';
  scanError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StubNodeExternalSource {
  mountId: string;
  uri: string;
  format: StubNodeFormat;
  sizeBytes: number;
  lastModified: Date;
  checksum?: string;
}

export interface StubNodeMetadata {
  columns?: string[];
  rowCount?: number;
  pageCount?: number;
  dateRange?: { start: Date; end: Date };
  entityMentions?: string[];
  keywords?: string[];
  language?: string;
}

export interface ContentRange {
  type: 'pages' | 'rows' | 'bytes' | 'sections';
  start: number;
  end: number;
}

export interface StubNodeFetchRequest {
  tenantId: string;
  stubNodeId: string;
  range?: ContentRange;
  ttlSeconds?: number;
}

export interface StubNodeFetchResponse {
  stubNodeId: string;
  signedUrl: string;
  expiresAt: Date;
  contentType: string;
  range?: ContentRange;
}

// =============================================================================
// Live Telemetry Injection (MQTT/OPC UA) (v2.0)
// =============================================================================

export type TelemetryProtocol = 'mqtt' | 'opc_ua' | 'kafka' | 'websocket' | 'http_poll';

export interface TelemetryFeedConfig {
  id: string;
  tenantId: string;
  name: string;
  protocol: TelemetryProtocol;
  endpoint: string;
  nodeIds?: string[];
  topics?: string[];
  pollIntervalMs?: number;
  contextInjection: boolean;
  transformScript?: string;
  isActive: boolean;
  authConfig?: TelemetryAuthConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface TelemetryAuthConfig {
  type: 'none' | 'basic' | 'bearer' | 'certificate' | 'oauth2';
  credentials?: Record<string, string>;
  certificateArn?: string;
}

export interface TelemetryDataPoint {
  feedId: string;
  tenantId: string;
  nodeId: string;
  value: number | string | boolean;
  quality: 'good' | 'bad' | 'uncertain';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface TelemetryFeedCreateRequest {
  tenantId: string;
  name: string;
  protocol: TelemetryProtocol;
  endpoint: string;
  nodeIds?: string[];
  topics?: string[];
  pollIntervalMs?: number;
  contextInjection?: boolean;
  transformScript?: string;
  authConfig?: TelemetryAuthConfig;
}

export interface TelemetrySnapshot {
  feedId: string;
  feedName: string;
  dataPoints: TelemetryDataPoint[];
  lastUpdated: Date;
}

// =============================================================================
// Curator Entrance Exam (v2.0)
// =============================================================================

export type ExamQuestionType = 'verify' | 'correct' | 'select' | 'fill_blank';
export type ExamStatus = 'pending' | 'in_progress' | 'passed' | 'failed' | 'expired';

export interface EntranceExam {
  id: string;
  tenantId: string;
  domainId: string;
  domainPath: string;
  questions: ExamQuestion[];
  passingScore: number;
  timeoutMinutes: number;
  status: ExamStatus;
  assignedTo?: string;
  startedAt?: Date;
  completedAt?: Date;
  score?: number;
  createdAt: Date;
}

export interface ExamQuestion {
  id: string;
  type: ExamQuestionType;
  statement: string;
  source: string;
  sourceLocation?: string;
  confidence: number;
  aiReasoning?: string;
  correctAnswer?: string;
  options?: string[];
  userAnswer?: string;
  isCorrect?: boolean;
  feedback?: string;
}

export interface ExamSubmission {
  examId: string;
  questionId: string;
  answer: string;
  isVerified: boolean;
  correction?: string;
  notes?: string;
}

export interface ExamResult {
  examId: string;
  passed: boolean;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  verifiedFacts: string[];
  correctedFacts: CorrectedFact[];
  goldenRulesCreated: string[];
}

export interface CorrectedFact {
  questionId: string;
  originalStatement: string;
  correctedStatement: string;
  graphNodeId?: string;
}

// =============================================================================
// Graph Expansion (Twilight Dreaming) (v2.0)
// =============================================================================

export interface GraphExpansionTask {
  id: string;
  tenantId: string;
  taskType: 'infer_links' | 'cluster_entities' | 'detect_patterns' | 'merge_duplicates';
  sourceNodeIds: string[];
  targetScope: 'local' | 'domain' | 'global';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  discoveredLinks: InferredLink[];
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface InferredLink {
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: string;
  confidence: number;
  evidence: string[];
  isApproved?: boolean;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface PatternDetection {
  id: string;
  tenantId: string;
  patternType: 'sequence' | 'correlation' | 'anomaly' | 'cluster';
  description: string;
  affectedNodes: string[];
  confidence: number;
  suggestedAction?: string;
  detectedAt: Date;
}

// =============================================================================
// Model Migration (v2.0)
// =============================================================================

export type MigrationStatus = 'pending' | 'validating' | 'migrating' | 'testing' | 'completed' | 'failed' | 'rolled_back';

export interface ModelMigration {
  id: string;
  tenantId: string;
  sourceModel: ModelReference;
  targetModel: ModelReference;
  status: MigrationStatus;
  validationResults?: MigrationValidation;
  testResults?: MigrationTestResult[];
  rollbackAvailable: boolean;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface ModelReference {
  provider: string;
  modelId: string;
  version?: string;
  endpoint?: string;
}

export interface MigrationValidation {
  cortexCompatible: boolean;
  featureSupport: Record<string, boolean>;
  estimatedCostChange: number;
  latencyChange: number;
  qualityScore: number;
  warnings: string[];
}

export interface MigrationTestResult {
  testId: string;
  testType: 'accuracy' | 'latency' | 'cost' | 'safety';
  passed: boolean;
  score: number;
  details: string;
}

export interface ModelMigrationRequest {
  tenantId: string;
  targetModel: ModelReference;
  runTests?: boolean;
  autoRollbackOnFailure?: boolean;
}
