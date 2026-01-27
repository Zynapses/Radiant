/**
 * RADIANT v5.33.0 - HITL Rate Limiting Service
 * 
 * Prevents question storms by implementing rate limiting at three levels:
 * 1. Global: 50 RPM across all users
 * 2. Per-user: 10 RPM, 3 concurrent
 * 3. Per-workflow: 5 RPM, 2 concurrent
 * 
 * Uses a sliding window algorithm with burst allowance.
 */

import { executeStatement, stringParam, longParam } from '../../db/client';
import { logger } from '../../utils/logger';

// Using enhanced logger from utils

// ============================================================================
// TYPES
// ============================================================================

export type RateLimitScope = 'global' | 'per_user' | 'per_workflow';

export interface RateLimitConfig {
  scope: RateLimitScope;
  scopeKey?: string;
  maxRequestsPerMinute: number;
  maxConcurrentRequests: number;
  burstAllowance: number;
}

export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
  currentConcurrent: number;
  maxConcurrent: number;
  reason?: string;
}

export interface RateLimitCheck {
  global: RateLimitStatus;
  perUser?: RateLimitStatus;
  perWorkflow?: RateLimitStatus;
  allowed: boolean;
  blockedBy?: RateLimitScope;
}

const DEFAULT_LIMITS: Record<RateLimitScope, Omit<RateLimitConfig, 'scope' | 'scopeKey'>> = {
  global: {
    maxRequestsPerMinute: 50,
    maxConcurrentRequests: 20,
    burstAllowance: 10,
  },
  per_user: {
    maxRequestsPerMinute: 10,
    maxConcurrentRequests: 3,
    burstAllowance: 2,
  },
  per_workflow: {
    maxRequestsPerMinute: 5,
    maxConcurrentRequests: 2,
    burstAllowance: 1,
  },
};

// ============================================================================
// RATE LIMIT CHECKS
// ============================================================================

async function checkRateLimit(
  tenantId: string,
  scope: RateLimitScope,
  scopeKey?: string
): Promise<RateLimitStatus> {
  // Get or create rate limit record
  const result = await executeStatement({
    sql: `
      SELECT * FROM hitl_rate_limits
      WHERE tenant_id = :tenantId
        AND scope = :scope
        AND (scope_key = :scopeKey OR (scope_key IS NULL AND :scopeKey IS NULL))
    `,
    parameters: [
      stringParam('tenantId', tenantId),
      stringParam('scope', scope),
      stringParam('scopeKey', scopeKey || ''),
    ],
  });

  let config: RateLimitConfig;
  let currentCount: number;
  let currentConcurrent: number;
  let windowStart: Date;

  if (result.rows && result.rows.length > 0) {
    const row = result.rows[0];
    config = {
      scope,
      scopeKey,
      maxRequestsPerMinute: row.max_requests_per_minute as number,
      maxConcurrentRequests: row.max_concurrent_requests as number,
      burstAllowance: row.burst_allowance as number,
    };
    currentCount = row.current_window_count as number;
    currentConcurrent = row.current_concurrent as number;
    windowStart = new Date(row.current_window_start as string);
  } else {
    // Use defaults
    const defaults = DEFAULT_LIMITS[scope];
    config = { scope, scopeKey, ...defaults };
    currentCount = 0;
    currentConcurrent = 0;
    windowStart = new Date();
    
    // Create the record
    await executeStatement({
      sql: `
        INSERT INTO hitl_rate_limits (
          tenant_id, scope, scope_key, max_requests_per_minute,
          max_concurrent_requests, burst_allowance
        ) VALUES (
          :tenantId, :scope, :scopeKey, :maxRPM, :maxConcurrent, :burst
        )
        ON CONFLICT (tenant_id, scope, scope_key) DO NOTHING
      `,
      parameters: [
        stringParam('tenantId', tenantId),
        stringParam('scope', scope),
        stringParam('scopeKey', scopeKey || ''),
        longParam('maxRPM', config.maxRequestsPerMinute),
        longParam('maxConcurrent', config.maxConcurrentRequests),
        longParam('burst', config.burstAllowance),
      ],
    });
  }

  // Check if window has expired (1 minute)
  const now = new Date();
  const windowAge = (now.getTime() - windowStart.getTime()) / 1000;
  
  if (windowAge >= 60) {
    // Reset window
    currentCount = 0;
    windowStart = now;
    
    await executeStatement({
      sql: `
        UPDATE hitl_rate_limits
        SET current_window_start = NOW(),
            current_window_count = 0
        WHERE tenant_id = :tenantId
          AND scope = :scope
          AND (scope_key = :scopeKey OR (scope_key IS NULL AND :scopeKey IS NULL))
      `,
      parameters: [
        stringParam('tenantId', tenantId),
        stringParam('scope', scope),
        stringParam('scopeKey', scopeKey || ''),
      ],
    });
  }

  const effectiveLimit = config.maxRequestsPerMinute + config.burstAllowance;
  const remaining = Math.max(0, effectiveLimit - currentCount);
  const resetInSeconds = Math.max(0, 60 - windowAge);

  // Check limits
  let allowed = true;
  let reason: string | undefined;

  if (currentCount >= effectiveLimit) {
    allowed = false;
    reason = `Rate limit exceeded: ${currentCount}/${config.maxRequestsPerMinute} RPM (burst: ${config.burstAllowance})`;
  } else if (currentConcurrent >= config.maxConcurrentRequests) {
    allowed = false;
    reason = `Concurrent limit exceeded: ${currentConcurrent}/${config.maxConcurrentRequests}`;
  }

  return {
    allowed,
    remaining,
    resetInSeconds,
    currentConcurrent,
    maxConcurrent: config.maxConcurrentRequests,
    reason,
  };
}

async function checkAllRateLimits(
  tenantId: string,
  userId?: string,
  workflowId?: string
): Promise<RateLimitCheck> {
  const global = await checkRateLimit(tenantId, 'global');
  const result: RateLimitCheck = {
    global,
    allowed: global.allowed,
  };

  if (!global.allowed) {
    result.blockedBy = 'global';
    return result;
  }

  if (userId) {
    const perUser = await checkRateLimit(tenantId, 'per_user', userId);
    result.perUser = perUser;
    if (!perUser.allowed) {
      result.allowed = false;
      result.blockedBy = 'per_user';
      return result;
    }
  }

  if (workflowId) {
    const perWorkflow = await checkRateLimit(tenantId, 'per_workflow', workflowId);
    result.perWorkflow = perWorkflow;
    if (!perWorkflow.allowed) {
      result.allowed = false;
      result.blockedBy = 'per_workflow';
      return result;
    }
  }

  return result;
}

// ============================================================================
// RATE LIMIT CONSUMPTION
// ============================================================================

async function consumeRateLimit(
  tenantId: string,
  scope: RateLimitScope,
  scopeKey?: string
): Promise<void> {
  await executeStatement({
    sql: `
      UPDATE hitl_rate_limits
      SET current_window_count = current_window_count + 1,
          current_concurrent = current_concurrent + 1,
          last_updated = NOW()
      WHERE tenant_id = :tenantId
        AND scope = :scope
        AND (scope_key = :scopeKey OR (scope_key IS NULL AND :scopeKey IS NULL))
    `,
    parameters: [
      stringParam('tenantId', tenantId),
      stringParam('scope', scope),
      stringParam('scopeKey', scopeKey || ''),
    ],
  });
}

async function releaseRateLimit(
  tenantId: string,
  scope: RateLimitScope,
  scopeKey?: string
): Promise<void> {
  await executeStatement({
    sql: `
      UPDATE hitl_rate_limits
      SET current_concurrent = GREATEST(0, current_concurrent - 1),
          last_updated = NOW()
      WHERE tenant_id = :tenantId
        AND scope = :scope
        AND (scope_key = :scopeKey OR (scope_key IS NULL AND :scopeKey IS NULL))
    `,
    parameters: [
      stringParam('tenantId', tenantId),
      stringParam('scope', scope),
      stringParam('scopeKey', scopeKey || ''),
    ],
  });
}

async function consumeAllRateLimits(
  tenantId: string,
  userId?: string,
  workflowId?: string
): Promise<void> {
  await consumeRateLimit(tenantId, 'global');
  
  if (userId) {
    await consumeRateLimit(tenantId, 'per_user', userId);
  }
  
  if (workflowId) {
    await consumeRateLimit(tenantId, 'per_workflow', workflowId);
  }
}

async function releaseAllRateLimits(
  tenantId: string,
  userId?: string,
  workflowId?: string
): Promise<void> {
  await releaseRateLimit(tenantId, 'global');
  
  if (userId) {
    await releaseRateLimit(tenantId, 'per_user', userId);
  }
  
  if (workflowId) {
    await releaseRateLimit(tenantId, 'per_workflow', workflowId);
  }
}

// ============================================================================
// CONFIGURATION
// ============================================================================

async function updateRateLimitConfig(
  tenantId: string,
  scope: RateLimitScope,
  config: Partial<RateLimitConfig>,
  scopeKey?: string
): Promise<void> {
  const defaults = DEFAULT_LIMITS[scope];
  
  await executeStatement({
    sql: `
      INSERT INTO hitl_rate_limits (
        tenant_id, scope, scope_key, max_requests_per_minute,
        max_concurrent_requests, burst_allowance, is_active
      ) VALUES (
        :tenantId, :scope, :scopeKey, :maxRPM, :maxConcurrent, :burst, true
      )
      ON CONFLICT (tenant_id, scope, scope_key) DO UPDATE SET
        max_requests_per_minute = EXCLUDED.max_requests_per_minute,
        max_concurrent_requests = EXCLUDED.max_concurrent_requests,
        burst_allowance = EXCLUDED.burst_allowance,
        last_updated = NOW()
    `,
    parameters: [
      stringParam('tenantId', tenantId),
      stringParam('scope', scope),
      stringParam('scopeKey', scopeKey || ''),
      longParam('maxRPM', config.maxRequestsPerMinute ?? defaults.maxRequestsPerMinute),
      longParam('maxConcurrent', config.maxConcurrentRequests ?? defaults.maxConcurrentRequests),
      longParam('burst', config.burstAllowance ?? defaults.burstAllowance),
    ],
  });

  logger.info('Updated rate limit config', {
    tenantId,
    scope,
    scopeKey,
    config,
  });
}

async function getRateLimitConfigs(tenantId: string): Promise<RateLimitConfig[]> {
  const result = await executeStatement({
    sql: `
      SELECT * FROM hitl_rate_limits
      WHERE tenant_id = :tenantId AND is_active = true
      ORDER BY scope, scope_key
    `,
    parameters: [stringParam('tenantId', tenantId)],
  });

  return (result.rows || []).map(row => ({
    scope: row.scope as RateLimitScope,
    scopeKey: row.scope_key as string | undefined,
    maxRequestsPerMinute: row.max_requests_per_minute as number,
    maxConcurrentRequests: row.max_concurrent_requests as number,
    burstAllowance: row.burst_allowance as number,
  }));
}

// ============================================================================
// STATISTICS
// ============================================================================

async function getRateLimitStatistics(tenantId: string): Promise<{
  globalUsage: { current: number; max: number; percentage: number };
  topUsers: Array<{ userId: string; requests: number }>;
  topWorkflows: Array<{ workflowId: string; requests: number }>;
  blockedCount24h: number;
}> {
  // Get global usage
  const globalResult = await executeStatement({
    sql: `
      SELECT current_window_count, max_requests_per_minute
      FROM hitl_rate_limits
      WHERE tenant_id = :tenantId AND scope = 'global' AND scope_key IS NULL
    `,
    parameters: [stringParam('tenantId', tenantId)],
  });

  const globalRow = globalResult.rows?.[0] || { current_window_count: 0, max_requests_per_minute: 50 };
  const globalUsage = {
    current: Number(globalRow.current_window_count) || 0,
    max: Number(globalRow.max_requests_per_minute) || 50,
    percentage: 0,
  };
  globalUsage.percentage = globalUsage.max > 0 ? (globalUsage.current / globalUsage.max) * 100 : 0;

  // Get top users by request count
  const usersResult = await executeStatement({
    sql: `
      SELECT scope_key as user_id, current_window_count as requests
      FROM hitl_rate_limits
      WHERE tenant_id = :tenantId 
        AND scope = 'per_user' 
        AND scope_key IS NOT NULL
      ORDER BY current_window_count DESC
      LIMIT 10
    `,
    parameters: [stringParam('tenantId', tenantId)],
  });

  const topUsers = (usersResult.rows || []).map(row => ({
    userId: row.user_id as string,
    requests: Number(row.requests) || 0,
  }));

  // Get top workflows
  const workflowsResult = await executeStatement({
    sql: `
      SELECT scope_key as workflow_id, current_window_count as requests
      FROM hitl_rate_limits
      WHERE tenant_id = :tenantId 
        AND scope = 'per_workflow' 
        AND scope_key IS NOT NULL
      ORDER BY current_window_count DESC
      LIMIT 10
    `,
    parameters: [stringParam('tenantId', tenantId)],
  });

  const topWorkflows = (workflowsResult.rows || []).map(row => ({
    workflowId: row.workflow_id as string,
    requests: Number(row.requests) || 0,
  }));

  // Count blocked requests from the rate limit events log
  const blockedResult = await executeStatement({
    sql: `
      SELECT COUNT(*) as blocked_count
      FROM hitl_rate_limit_events
      WHERE tenant_id = :tenantId 
        AND event_type = 'blocked'
        AND created_at > NOW() - INTERVAL '24 hours'
    `,
    parameters: [stringParam('tenantId', tenantId)],
  });

  const blockedCount24h = Number(blockedResult.rows?.[0]?.blocked_count) || 0;

  return {
    globalUsage,
    topUsers,
    topWorkflows,
    blockedCount24h,
  };
}

export const rateLimitingService = {
  checkRateLimit,
  checkAllRateLimits,
  consumeRateLimit,
  releaseRateLimit,
  consumeAllRateLimits,
  releaseAllRateLimits,
  updateRateLimitConfig,
  getRateLimitConfigs,
  getRateLimitStatistics,
  DEFAULT_LIMITS,
};
