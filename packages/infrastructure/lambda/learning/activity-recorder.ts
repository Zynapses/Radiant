// RADIANT v4.18.0 - Hourly Activity Recorder Lambda
// Records usage statistics per hour for optimal training time prediction
// Triggered by EventBridge every hour
// ============================================================================

import type { ScheduledEvent, Context } from 'aws-lambda';
import { executeStatement, stringParam, longParam } from '../shared/db/client';
import { enhancedLearningService } from '../shared/services/enhanced-learning.service';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

interface TenantActivityStats {
  tenantId: string;
  requests: number;
  tokens: number;
  activeUsers: number;
}

/**
 * Get activity stats for all tenants in the past hour
 */
async function getHourlyActivityForAllTenants(): Promise<TenantActivityStats[]> {
  const result = await executeStatement(
    `SELECT 
       tenant_id,
       COUNT(*) as request_count,
       COALESCE(SUM(total_tokens), 0) as total_tokens,
       COUNT(DISTINCT user_id) as active_users
     FROM usage_logs
     WHERE created_at >= NOW() - INTERVAL '1 hour'
       AND created_at < NOW()
     GROUP BY tenant_id`,
    []
  );
  
  if (!result.rows?.length) {
    return [];
  }
  
  return result.rows.map(row => ({
    tenantId: String(row.tenant_id || ''),
    requests: Number(row.request_count || 0),
    tokens: Number(row.total_tokens || 0),
    activeUsers: Number(row.active_users || 0),
  }));
}

/**
 * Get all active tenants (even those with no activity)
 */
async function getAllActiveTenants(): Promise<string[]> {
  const result = await executeStatement(
    `SELECT id FROM tenants WHERE status = 'active'`,
    []
  );
  
  return (result.rows || []).map(row => String(row.id));
}

/**
 * Main handler - runs every hour via EventBridge
 */
export const handler = async (event: ScheduledEvent, context: Context): Promise<void> => {
  const startTime = Date.now();
  logger.info('Starting hourly activity recording', { event });
  
  try {
    // Get current hour and day of week in UTC
    const now = new Date();
    const hourUtc = now.getUTCHours();
    const dayOfWeek = now.getUTCDay(); // 0 = Sunday
    
    // Get activity stats for the past hour
    const activityStats = await getHourlyActivityForAllTenants();
    const allTenants = await getAllActiveTenants();
    
    // Create a map of tenant activity
    const activityMap = new Map<string, TenantActivityStats>();
    for (const stat of activityStats) {
      activityMap.set(stat.tenantId, stat);
    }
    
    // Record stats for all tenants (including those with zero activity)
    let recordedCount = 0;
    let errorCount = 0;
    
    for (const tenantId of allTenants) {
      try {
        const stats = activityMap.get(tenantId) || {
          tenantId,
          requests: 0,
          tokens: 0,
          activeUsers: 0,
        };
        
        await enhancedLearningService.recordActivityForOptimalTime(
          tenantId,
          hourUtc,
          dayOfWeek,
          stats.requests,
          stats.tokens,
          stats.activeUsers
        );
        
        recordedCount++;
      } catch (error) {
        errorCount++;
        logger.error('Failed to record activity for tenant', { tenantId, error });
      }
    }
    
    const duration = Date.now() - startTime;
    logger.info('Hourly activity recording complete', {
      hourUtc,
      dayOfWeek,
      totalTenants: allTenants.length,
      tenantsWithActivity: activityStats.length,
      recordedCount,
      errorCount,
      durationMs: duration,
    });
    
    // Success - logged above
  } catch (error) {
    logger.error('Hourly activity recording failed', { error });
    throw error;
  }
};

/**
 * Backfill handler - populates historical data from usage_logs
 * Run manually via Lambda invoke if needed
 */
export const backfillHandler = async (event: ScheduledEvent, context: Context): Promise<void> => {
  logger.info('Starting activity stats backfill', { event });
  
  try {
    // Get stats aggregated by hour for the past 30 days
    const result = await executeStatement(
      `SELECT 
         tenant_id,
         EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC')::int as hour_utc,
         EXTRACT(DOW FROM created_at AT TIME ZONE 'UTC')::int as day_of_week,
         COUNT(*) as request_count,
         COALESCE(SUM(total_tokens), 0) as total_tokens,
         COUNT(DISTINCT user_id) as active_users
       FROM usage_logs
       WHERE created_at >= NOW() - INTERVAL '30 days'
       GROUP BY tenant_id, 
         EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC'),
         EXTRACT(DOW FROM created_at AT TIME ZONE 'UTC')
       ORDER BY tenant_id, hour_utc, day_of_week`,
      []
    );
    
    if (!result.rows?.length) {
      logger.info('No historical data to backfill');
      return;
    }
    
    let recordedCount = 0;
    
    for (const row of result.rows) {
      try {
        await enhancedLearningService.recordActivityForOptimalTime(
          String(row.tenant_id),
          Number(row.hour_utc),
          Number(row.day_of_week),
          Number(row.request_count),
          Number(row.total_tokens),
          Number(row.active_users)
        );
        recordedCount++;
      } catch (error) {
        logger.error('Failed to backfill activity', { row, error });
      }
    }
    
    logger.info('Activity stats backfill complete', {
      totalRows: result.rows.length,
      recordedCount,
    });
    
    // Success - logged above
  } catch (error) {
    logger.error('Activity stats backfill failed', { error });
    throw error;
  }
};
