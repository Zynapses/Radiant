/**
 * Concurrent Task Execution Types
 * 
 * Moat #17: Split-pane UI (2-4 simultaneous tasks), WebSocket multiplexing,
 * background queue with progress tracking.
 */

export interface ConcurrentTask {
  id: string;
  tenantId: string;
  userId: string;
  sessionId: string;
  paneId: string;
  status: ConcurrentTaskStatus;
  taskType: ConcurrentTaskType;
  priority: TaskPriority;
  prompt: string;
  modelId?: string;
  result?: ConcurrentTaskResult;
  progress: TaskProgress;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
}

export type ConcurrentTaskStatus = 
  | 'queued'
  | 'running'
  | 'streaming'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ConcurrentTaskType =
  | 'chat'
  | 'analysis'
  | 'generation'
  | 'comparison'
  | 'research'
  | 'coding';

export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

export interface TaskProgress {
  percentage: number;
  stage: string;
  tokensGenerated?: number;
  estimatedTimeRemaining?: number;
}

export interface ConcurrentTaskResult {
  content: string;
  modelUsed: string;
  tokensUsed: number;
  costUsd: number;
  latencyMs: number;
  artifacts?: TaskArtifact[];
}

export interface TaskArtifact {
  id: string;
  type: 'code' | 'document' | 'chart' | 'table' | 'image';
  content: string;
  language?: string;
}

export interface SplitPaneConfig {
  id: string;
  userId: string;
  layout: PaneLayout;
  panes: PaneDefinition[];
  syncMode: SyncMode;
  createdAt: Date;
  updatedAt: Date;
}

export type PaneLayout = 
  | 'single'
  | 'horizontal-2'
  | 'vertical-2'
  | 'grid-4'
  | 'focus-left'
  | 'focus-right';

export interface PaneDefinition {
  id: string;
  position: number;
  size: number;
  taskId?: string;
  conversationId?: string;
  modelId?: string;
  locked: boolean;
}

export type SyncMode = 
  | 'independent'
  | 'mirror-input'
  | 'compare-output';

export interface WebSocketMultiplexConfig {
  maxConcurrentStreams: number;
  channelPrefix: string;
  heartbeatInterval: number;
  reconnectStrategy: ReconnectStrategy;
}

export interface ReconnectStrategy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface MultiplexedMessage {
  channelId: string;
  taskId: string;
  messageType: MultiplexMessageType;
  payload: unknown;
  timestamp: number;
  sequence: number;
}

export type MultiplexMessageType =
  | 'task_start'
  | 'task_progress'
  | 'task_chunk'
  | 'task_complete'
  | 'task_error'
  | 'heartbeat'
  | 'sync';

export interface BackgroundQueue {
  tenantId: string;
  userId: string;
  maxConcurrent: number;
  currentRunning: number;
  queuedTasks: ConcurrentTask[];
  runningTasks: ConcurrentTask[];
  completedTasks: ConcurrentTask[];
}

export interface ConcurrentExecutionConfig {
  tenantId: string;
  enabled: boolean;
  maxPanes: number;
  maxConcurrentTasks: number;
  maxQueueDepth: number;
  defaultLayout: PaneLayout;
  defaultSyncMode: SyncMode;
  enableComparison: boolean;
  enableMerge: boolean;
  websocketConfig: WebSocketMultiplexConfig;
}

export interface TaskComparisonResult {
  taskIds: string[];
  similarities: SimilarityScore[];
  differences: DifferenceHighlight[];
  mergedResult?: string;
  recommendation: string;
}

export interface SimilarityScore {
  metric: 'semantic' | 'structural' | 'factual';
  score: number;
  details: string;
}

export interface DifferenceHighlight {
  taskId: string;
  section: string;
  content: string;
  significance: 'minor' | 'moderate' | 'major';
}

export interface ConcurrentExecutionMetrics {
  tenantId: string;
  period: string;
  totalTasks: number;
  concurrentPeakTasks: number;
  averageConcurrency: number;
  tasksByType: Record<ConcurrentTaskType, number>;
  averageLatencyMs: number;
  totalCostUsd: number;
  comparisonsMade: number;
  mergesPerformed: number;
}
