/**
 * RADIANT v6.0.4 - Dreaming Types
 * Twilight Dreaming for memory consolidation
 * 
 * The dreaming system consolidates flash facts into long-term memory
 * during low-traffic periods, similar to how biological sleep works.
 */

// =============================================================================
// Dreaming Configuration
// =============================================================================

/**
 * Dreaming trigger types
 */
export type DreamTrigger = 
  | 'low_traffic'    // Global traffic below threshold
  | 'twilight'       // 4 AM local time
  | 'starvation'     // No dream in 30+ hours
  | 'manual';        // Admin-triggered

/**
 * Dreaming configuration
 */
export interface DreamingConfig {
  triggers: {
    lowTraffic: {
      threshold: number;         // Traffic % to trigger (default: 20)
      minHoursSinceDream: number; // Min hours since last dream (default: 6)
    };
    twilight: {
      localHour: number;         // Local hour for twilight (default: 4)
      minHoursSinceDream: number; // Min hours since last dream (default: 20)
    };
    starvation: {
      maxHoursBetweenDreams: number; // Max hours without dream (default: 30)
    };
  };
  queueing: {
    maxConcurrentDreams: number; // Max parallel dream jobs (default: 100)
    staggerMinutes: number;      // Delay between jobs (default: 5)
  };
}

export const DEFAULT_DREAMING_CONFIG: DreamingConfig = {
  triggers: {
    lowTraffic: {
      threshold: 20,
      minHoursSinceDream: 6,
    },
    twilight: {
      localHour: 4,
      minHoursSinceDream: 20,
    },
    starvation: {
      maxHoursBetweenDreams: 30,
    },
  },
  queueing: {
    maxConcurrentDreams: 100,
    staggerMinutes: 5,
  },
};

// =============================================================================
// Dream Job Types
// =============================================================================

/**
 * Dream job status
 */
export type DreamJobStatus = 
  | 'pending'      // Scheduled but not started
  | 'running'      // Currently executing
  | 'completed'    // Successfully completed
  | 'failed';      // Failed with error

/**
 * Dream job priority
 */
export type DreamJobPriority = 'high' | 'normal';

/**
 * Dream job entity
 */
export interface DreamJob {
  id: string;
  tenantId: string;
  reason: DreamTrigger;
  scheduledFor: Date;
  priority: DreamJobPriority;
  status: DreamJobStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
  error: string | null;
  report: DreamReport | null;
}

/**
 * Dream job database record
 */
export interface DreamJobRecord {
  id: string;
  tenant_id: string;
  reason: string;
  scheduled_for: Date;
  priority: string;
  status: string;
  started_at: Date | null;
  completed_at: Date | null;
  duration_ms: number | null;
  error: string | null;
  report_json: string | null;
}

// =============================================================================
// Dream Report Types
// =============================================================================

/**
 * Dream execution report
 */
export interface DreamReport {
  tenantId: string;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  
  // Flash fact consolidation
  flashFactsProcessed: number;
  flashFactsConsolidated: number;
  flashFactsFailed: number;
  
  // Memory operations
  memoriesCreated: number;
  memoriesUpdated: number;
  memoriesPruned: number;
  
  // Ghost operations
  ghostsReAnchored: number;
  ghostsMigrated: number;
  ghostsPruned: number;
  
  // Errors
  errors: DreamError[];
}

/**
 * Dream error
 */
export interface DreamError {
  userId?: string;
  operation: string;
  error: string;
  timestamp: Date;
}

// =============================================================================
// Dream Log Types
// =============================================================================

/**
 * Dream log entry for tracking tenant dream history
 */
export interface DreamLog {
  id: string;
  tenantId: string;
  reason: DreamTrigger;
  status: DreamJobStatus;
  lastDreamAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
  report: DreamReport | null;
  error: string | null;
}

/**
 * Dream log database record
 */
export interface DreamLogRecord {
  id: string;
  tenant_id: string;
  reason: string;
  status: string;
  last_dream_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  duration_ms: number | null;
  report_json: string | null;
  error: string | null;
}

// =============================================================================
// Dream Scheduling Types
// =============================================================================

/**
 * Tenant dream schedule info
 */
export interface TenantDreamSchedule {
  tenantId: string;
  timezone: string;
  lastDreamAt: Date | null;
  nextScheduledDream: Date | null;
  hoursSinceDream: number;
  eligibleForTwilight: boolean;
  eligibleForStarvation: boolean;
}

/**
 * Dream queue status
 */
export interface DreamQueueStatus {
  pendingJobs: number;
  runningJobs: number;
  completedToday: number;
  failedToday: number;
  avgDurationMs: number;
  oldestPendingAt: Date | null;
}

// =============================================================================
// Dream Consolidation Types
// =============================================================================

/**
 * Flash fact consolidation request
 */
export interface FlashFactConsolidationRequest {
  userId: string;
  tenantId: string;
  facts: Array<{
    id: string;
    fact: string;
    factType: string;
    priority: string;
  }>;
}

/**
 * Flash fact consolidation result
 */
export interface FlashFactConsolidationResult {
  userId: string;
  tenantId: string;
  factsConsolidated: number;
  factsFailed: number;
  memoriesCreated: number;
  memoriesUpdated: number;
  errors: string[];
}

// =============================================================================
// Dream Analytics Types
// =============================================================================

/**
 * Dream analytics for monitoring
 */
export interface DreamAnalytics {
  period: { start: Date; end: Date };
  totalDreams: number;
  successRate: number;
  avgDurationMs: number;
  byReason: Record<DreamTrigger, number>;
  byTenant: Array<{
    tenantId: string;
    dreamCount: number;
    avgDurationMs: number;
    lastDreamAt: Date;
  }>;
  flashFactsConsolidated: number;
  memoriesCreated: number;
  errors: number;
}

// =============================================================================
// Dream Constants
// =============================================================================

export const DREAM_CHECK_INTERVAL_MINUTES = 15;
export const DREAM_MAX_RETRIES = 3;
export const DREAM_RETRY_DELAY_MINUTES = 30;
export const DREAM_JOB_TIMEOUT_MINUTES = 60;
