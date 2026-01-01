/**
 * RADIANT v6.0.4 - Reconciliation Lambda
 * Scheduled job for data consistency and maintenance
 * 
 * Runs periodically to:
 * - Reconcile Redis and Postgres flash facts
 * - Process dream queue
 * - Process oversight timeouts
 * - Cleanup stale data
 */

import { ScheduledEvent } from 'aws-lambda';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import { executeStatement } from '../shared/db/client';
import { flashBufferService } from '../shared/services/flash-buffer.service';
import { dreamSchedulerService } from '../shared/services/dream-scheduler.service';
import { oversightService } from '../shared/services/oversight.service';

// =============================================================================
// Main Handler
// =============================================================================

export async function handler(event: ScheduledEvent): Promise<void> {
  const startTime = Date.now();
  logger.info('Reconciliation job started', { source: event.source });

  const results = {
    flashReconciliation: { synced: 0, errors: 0 },
    dreamProcessing: { triggered: 0, processed: 0 },
    oversightTimeouts: { expired: 0, escalated: 0 },
    cleanup: { ghostsPruned: 0, memoriesPruned: 0, logsPruned: 0 },
  };

  try {
    // ===========================================================================
    // Step 1: Flash Buffer Reconciliation
    // ===========================================================================
    logger.info('Starting flash buffer reconciliation');
    
    const tenants = await getActiveTenants();
    for (const tenantId of tenants) {
      try {
        const result = await flashBufferService.reconcile(tenantId);
        results.flashReconciliation.synced += result.synced;
        results.flashReconciliation.errors += result.errors;
      } catch (error) {
        logger.warn(`Flash reconciliation failed for tenant ${tenantId}: ${String(error)}`);
        results.flashReconciliation.errors++;
      }
    }

    // ===========================================================================
    // Step 2: Dream Scheduling Check
    // ===========================================================================
    logger.info('Checking dream triggers');
    
    const dreamTriggerResult = await dreamSchedulerService.checkAndTriggerDreams();
    results.dreamProcessing.triggered = dreamTriggerResult.triggered;

    if (dreamTriggerResult.triggered > 0) {
      logger.info('Dreams triggered', {
        count: dreamTriggerResult.triggered,
        reason: dreamTriggerResult.reason,
      });
    }

    // ===========================================================================
    // Step 3: Process Pending Dreams
    // ===========================================================================
    logger.info('Processing pending dreams');
    
    results.dreamProcessing.processed = await dreamSchedulerService.processPendingDreams();

    // ===========================================================================
    // Step 4: Oversight Timeout Processing
    // ===========================================================================
    logger.info('Processing oversight timeouts');
    
    results.oversightTimeouts = await oversightService.processTimeouts();

    // ===========================================================================
    // Step 5: Data Cleanup
    // ===========================================================================
    logger.info('Running data cleanup');
    
    results.cleanup = await runCleanup();

    // ===========================================================================
    // Log Summary
    // ===========================================================================
    const duration = Date.now() - startTime;
    
    logger.info('Reconciliation job completed', {
      durationMs: duration,
      flashReconciliation: results.flashReconciliation,
      dreamProcessing: results.dreamProcessing,
      oversightTimeouts: results.oversightTimeouts,
      cleanup: results.cleanup,
    });

    // Store metrics
    await storeReconciliationMetrics(results, duration);

  } catch (error) {
    logger.error('Reconciliation job failed', { error: String(error) });
    throw error;
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get list of active tenants
 */
async function getActiveTenants(): Promise<string[]> {
  try {
    const result = await executeStatement(
      `SELECT tenant_id FROM tenants WHERE status = 'active' LIMIT 1000`,
      []
    );
    return result.rows.map(row => (row as { tenant_id: string }).tenant_id);
  } catch (error) {
    logger.error(`Failed to get active tenants: ${String(error)}`);
    return [];
  }
}

/**
 * Run data cleanup tasks
 */
async function runCleanup(): Promise<{
  ghostsPruned: number;
  memoriesPruned: number;
  logsPruned: number;
}> {
  let ghostsPruned = 0;
  let memoriesPruned = 0;
  let logsPruned = 0;

  try {
    // Prune stale ghost vectors (30+ days unused)
    const ghostResult = await executeStatement(
      `DELETE FROM ghost_vectors 
       WHERE updated_at < NOW() - INTERVAL '30 days'
       RETURNING id`,
      []
    );
    ghostsPruned = ghostResult.rowCount || 0;

    // Prune old memories (90+ days, low relevance)
    const memoryResult = await executeStatement(
      `DELETE FROM user_memories 
       WHERE accessed_at < NOW() - INTERVAL '90 days'
       AND relevance_score < 0.3
       RETURNING id`,
      []
    );
    memoriesPruned = memoryResult.rowCount || 0;

    // Prune old inference logs (30+ days)
    const logResult = await executeStatement(
      `DELETE FROM brain_inference_log 
       WHERE created_at < NOW() - INTERVAL '30 days'
       RETURNING id`,
      []
    );
    logsPruned = logResult.rowCount || 0;

    // Prune old SOFAI routing logs (30+ days)
    await executeStatement(
      `DELETE FROM sofai_routing_log 
       WHERE created_at < NOW() - INTERVAL '30 days'`,
      []
    );

    // Prune completed dream jobs (7+ days)
    await executeStatement(
      `DELETE FROM dream_queue 
       WHERE status IN ('completed', 'failed') 
       AND completed_at < NOW() - INTERVAL '7 days'`,
      []
    );

    // Prune old config history (90+ days)
    await executeStatement(
      `DELETE FROM config_history 
       WHERE changed_at < NOW() - INTERVAL '90 days'`,
      []
    );

  } catch (error) {
    logger.warn(`Cleanup task failed: ${String(error)}`);
  }

  return { ghostsPruned, memoriesPruned, logsPruned };
}

/**
 * Store reconciliation metrics
 */
async function storeReconciliationMetrics(
  results: {
    flashReconciliation: { synced: number; errors: number };
    dreamProcessing: { triggered: number; processed: number };
    oversightTimeouts: { expired: number; escalated: number };
    cleanup: { ghostsPruned: number; memoriesPruned: number; logsPruned: number };
  },
  durationMs: number
): Promise<void> {
  try {
    await executeStatement(
      `INSERT INTO system_logs 
       (level, category, message, metadata_json, created_at)
       VALUES ('info', 'reconciliation', 'Reconciliation job completed', $1, NOW())`,
      [
        {
          name: 'metadata',
          value: {
            stringValue: JSON.stringify({
              durationMs,
              ...results,
            }),
          },
        },
      ]
    );
  } catch (error) {
    logger.warn(`Failed to store reconciliation metrics: ${String(error)}`);
  }
}

// =============================================================================
// Manual Trigger Handler (for API calls)
// =============================================================================

export async function manualTriggerHandler(): Promise<{
  success: boolean;
  message: string;
  results?: unknown;
}> {
  try {
    await handler({
      source: 'manual-trigger',
      version: '0',
      id: 'manual',
      'detail-type': 'Scheduled Event',
      account: '',
      time: new Date().toISOString(),
      region: '',
      resources: [],
      detail: {},
    });

    return {
      success: true,
      message: 'Reconciliation job completed successfully',
    };
  } catch (error) {
    return {
      success: false,
      message: `Reconciliation job failed: ${String(error)}`,
    };
  }
}
