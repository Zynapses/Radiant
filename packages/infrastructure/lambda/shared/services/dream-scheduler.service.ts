/**
 * RADIANT v6.0.4 - Dream Scheduler Service
 * Twilight Dreaming for memory consolidation
 * 
 * Triggers dreaming cycles based on:
 * - Low traffic (global < 20%)
 * - Twilight hour (4 AM local time)
 * - Starvation safety net (30h max without dream)
 */

import { v4 as uuidv4 } from 'uuid';
import { executeStatement } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { brainConfigService } from './brain-config.service';
import { flashBufferService } from './flash-buffer.service';
import { empiricismLoopService } from './empiricism-loop.service';
import {
  type DreamJob,
  type DreamTrigger,
  type DreamJobStatus,
  type DreamReport,
  type TenantDreamSchedule,
  type DreamQueueStatus,
} from '@radiant/shared';

// Extended report type with verification fields
interface DreamReportWithVerification extends DreamReport {
  verificationsRun?: number;
  skillsVerified?: number;
  verificationSurprises?: number;
}

// =============================================================================
// Dream Scheduler Service
// =============================================================================

class DreamSchedulerService {
  // ===========================================================================
  // Dream Triggers
  // ===========================================================================

  /**
   * Check and trigger dreams based on all conditions
   */
  async checkAndTriggerDreams(): Promise<{
    triggered: number;
    reason: DreamTrigger | null;
  }> {
    const [lowTrafficThreshold, twilightHour, starvationHours] = await Promise.all([
      brainConfigService.getNumber('DREAM_LOW_TRAFFIC_THRESHOLD', 20),
      brainConfigService.getNumber('DREAM_TWILIGHT_HOUR', 4),
      brainConfigService.getNumber('DREAM_STARVATION_HOURS', 30),
    ]);

    // 1. Check global low-traffic trigger
    const globalTraffic = await this.getGlobalTrafficRatio();
    if (globalTraffic < lowTrafficThreshold / 100) {
      const count = await this.triggerGlobalDreamCycle();
      return { triggered: count, reason: 'low_traffic' };
    }

    // 2. TWILIGHT DREAMING - 4 AM tenant local time
    const twilightTenants = await this.getTenantsForTwilightDream(twilightHour);
    if (twilightTenants.length > 0) {
      await this.scheduleTenantDreams(twilightTenants, 'twilight');
      return { triggered: twilightTenants.length, reason: 'twilight' };
    }

    // 3. STARVATION TRIGGER - Safety net (30h max)
    const starvedTenants = await this.getStarvedTenants(starvationHours);
    if (starvedTenants.length > 0) {
      await this.scheduleTenantDreams(starvedTenants, 'starvation');
      return { triggered: starvedTenants.length, reason: 'starvation' };
    }

    return { triggered: 0, reason: null };
  }

  /**
   * Get global traffic ratio (0-1)
   */
  private async getGlobalTrafficRatio(): Promise<number> {
    try {
      const result = await executeStatement(
        `SELECT 
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '15 minutes') as recent,
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as hourly
         FROM brain_inference_log
         WHERE created_at > NOW() - INTERVAL '1 hour'`,
        []
      );

      if (result.rows.length > 0) {
        const row = result.rows[0] as { recent: number; hourly: number };
        // Normalize: if hourly is at expected level, ratio ≈ 1
        const expectedHourly = 100; // Baseline expected requests per hour
        return Math.min(1, (row.hourly / expectedHourly));
      }
    } catch (error) {
      logger.warn(`Failed to get traffic ratio: ${String(error)}`);
    }

    return 0.5; // Default to moderate traffic
  }

  /**
   * Get tenants eligible for twilight dreaming (4 AM local)
   */
  async getTenantsForTwilightDream(twilightHour: number): Promise<Array<{ tenantId: string }>> {
    try {
      const result = await executeStatement(
        `SELECT t.tenant_id 
         FROM tenants t
         LEFT JOIN tenant_dream_status tds ON t.tenant_id = tds.tenant_id
         WHERE 
           EXTRACT(HOUR FROM NOW() AT TIME ZONE COALESCE(tds.timezone, 'UTC')) = $1
           AND EXTRACT(MINUTE FROM NOW() AT TIME ZONE COALESCE(tds.timezone, 'UTC')) < 15
           AND (tds.last_dream_at IS NULL OR tds.last_dream_at < NOW() - INTERVAL '20 hours')
           AND NOT EXISTS (
             SELECT 1 FROM dream_queue dq 
             WHERE dq.tenant_id = t.tenant_id AND dq.status = 'pending'
           )
         ORDER BY tds.last_dream_at ASC NULLS FIRST
         LIMIT 500`,
        [{ name: 'hour', value: { longValue: twilightHour } }]
      );

      return result.rows.map(row => ({
        tenantId: (row as { tenant_id: string }).tenant_id,
      }));
    } catch (error) {
      logger.error(`Failed to get twilight tenants: ${String(error)}`);
      return [];
    }
  }

  /**
   * Get tenants that haven't dreamed in too long (starvation safety net)
   */
  async getStarvedTenants(maxHours: number): Promise<Array<{ tenantId: string }>> {
    try {
      const result = await executeStatement(
        `SELECT t.tenant_id
         FROM tenants t
         LEFT JOIN tenant_dream_status tds ON t.tenant_id = tds.tenant_id
         WHERE 
           tds.last_dream_at IS NULL 
           OR tds.last_dream_at < NOW() - INTERVAL '${maxHours} hours'
         ORDER BY tds.last_dream_at ASC NULLS FIRST
         LIMIT 100`,
        []
      );

      return result.rows.map(row => ({
        tenantId: (row as { tenant_id: string }).tenant_id,
      }));
    } catch (error) {
      logger.error(`Failed to get starved tenants: ${String(error)}`);
      return [];
    }
  }

  // ===========================================================================
  // Dream Scheduling
  // ===========================================================================

  /**
   * Trigger global dream cycle for all eligible tenants
   */
  async triggerGlobalDreamCycle(): Promise<number> {
    const maxConcurrent = await brainConfigService.getNumber('DREAM_MAX_CONCURRENT', 100);

    try {
      const result = await executeStatement(
        `SELECT t.tenant_id
         FROM tenants t
         LEFT JOIN tenant_dream_status tds ON t.tenant_id = tds.tenant_id
         WHERE 
           (tds.last_dream_at IS NULL OR tds.last_dream_at < NOW() - INTERVAL '6 hours')
           AND NOT EXISTS (
             SELECT 1 FROM dream_queue dq 
             WHERE dq.tenant_id = t.tenant_id AND dq.status IN ('pending', 'running')
           )
         ORDER BY tds.last_dream_at ASC NULLS FIRST
         LIMIT $1`,
        [{ name: 'limit', value: { longValue: maxConcurrent } }]
      );

      const tenants = result.rows.map(row => ({
        tenantId: (row as { tenant_id: string }).tenant_id,
      }));

      await this.scheduleTenantDreams(tenants, 'low_traffic');
      return tenants.length;
    } catch (error) {
      logger.error(`Failed to trigger global dream cycle: ${String(error)}`);
      return 0;
    }
  }

  /**
   * Schedule dreams for multiple tenants with staggering
   */
  async scheduleTenantDreams(
    tenants: Array<{ tenantId: string }>,
    reason: DreamTrigger
  ): Promise<void> {
    const staggerMinutes = await brainConfigService.getNumber('DREAM_STAGGER_MINUTES', 5);

    for (let i = 0; i < tenants.length; i++) {
      const tenant = tenants[i];
      const scheduledFor = new Date(Date.now() + i * staggerMinutes * 60000);

      await this.scheduleDream(tenant.tenantId, reason, scheduledFor);
    }

    logger.info('Scheduled tenant dreams', {
      count: tenants.length,
      reason,
      staggerMinutes,
    });
  }

  /**
   * Schedule a single dream job
   */
  async scheduleDream(
    tenantId: string,
    reason: DreamTrigger,
    scheduledFor: Date = new Date()
  ): Promise<DreamJob> {
    const job: DreamJob = {
      id: uuidv4(),
      tenantId,
      reason,
      scheduledFor,
      priority: reason === 'starvation' ? 'high' : 'normal',
      status: 'pending',
      startedAt: null,
      completedAt: null,
      durationMs: null,
      error: null,
      report: null,
    };

    try {
      await executeStatement(
        `INSERT INTO dream_queue (id, tenant_id, reason, priority, status, scheduled_for)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          { name: 'id', value: { stringValue: job.id } },
          { name: 'tenantId', value: { stringValue: job.tenantId } },
          { name: 'reason', value: { stringValue: job.reason } },
          { name: 'priority', value: { stringValue: job.priority } },
          { name: 'status', value: { stringValue: job.status } },
          { name: 'scheduledFor', value: { stringValue: job.scheduledFor.toISOString() } },
        ]
      );
    } catch (error) {
      logger.error(`Failed to schedule dream: ${String(error)}`);
      throw error;
    }

    return job;
  }

  // ===========================================================================
  // Dream Execution
  // ===========================================================================

  /**
   * Process pending dream jobs
   */
  async processPendingDreams(): Promise<number> {
    const maxConcurrent = await brainConfigService.getNumber('DREAM_MAX_CONCURRENT', 100);

    try {
      // Get pending jobs that are due
      const result = await executeStatement(
        `SELECT id, tenant_id, reason, priority
         FROM dream_queue
         WHERE status = 'pending' AND scheduled_for <= NOW()
         ORDER BY 
           CASE priority WHEN 'high' THEN 0 ELSE 1 END,
           scheduled_for ASC
         LIMIT $1`,
        [{ name: 'limit', value: { longValue: maxConcurrent } }]
      );

      let processed = 0;
      for (const row of result.rows) {
        const job = row as { id: string; tenant_id: string; reason: string; priority: string };
        
        try {
          await this.executeDream(job.id, job.tenant_id);
          processed++;
        } catch (error) {
          logger.error(`Dream execution failed: ${String(error)}`);
        }
      }

      return processed;
    } catch (error) {
      logger.error(`Failed to process pending dreams: ${String(error)}`);
      return 0;
    }
  }

  /**
   * Execute a single dream job
   */
  async executeDream(jobId: string, tenantId: string): Promise<DreamReport> {
    const startTime = Date.now();

    // Mark as running
    await executeStatement(
      `UPDATE dream_queue SET status = 'running', started_at = NOW() WHERE id = $1`,
      [{ name: 'id', value: { stringValue: jobId } }]
    );

    const report: DreamReport = {
      tenantId,
      startedAt: new Date(),
      completedAt: new Date(),
      durationMs: 0,
      flashFactsProcessed: 0,
      flashFactsConsolidated: 0,
      flashFactsFailed: 0,
      memoriesCreated: 0,
      memoriesUpdated: 0,
      memoriesPruned: 0,
      ghostsReAnchored: 0,
      ghostsMigrated: 0,
      ghostsPruned: 0,
      errors: [],
    };

    try {
      // 1. Consolidate flash facts
      const pendingFacts = await flashBufferService.getPendingForConsolidation(tenantId);
      report.flashFactsProcessed = pendingFacts.length;

      for (const fact of pendingFacts) {
        try {
          await this.consolidateFlashFact(fact);
          report.flashFactsConsolidated++;
          report.memoriesCreated++;
        } catch (error) {
          report.flashFactsFailed++;
          report.errors.push({
            userId: fact.userId,
            operation: 'consolidate_flash_fact',
            error: String(error),
            timestamp: new Date(),
          });
        }
      }

      // 2. Prune old memories
      const pruned = await this.pruneOldMemories(tenantId);
      report.memoriesPruned = pruned;

      // 3. Prune stale ghosts
      const ghostsPruned = await this.pruneStaleGhosts(tenantId);
      report.ghostsPruned = ghostsPruned;

      // 4. ACTIVE VERIFICATION (Empiricism Loop)
      // During dreams, autonomously verify uncertain skills by running sandbox tests
      // This implements Gemini's "Recursive Curiosity" / "Boredom Protocol"
      try {
        const verificationResult = await empiricismLoopService.activeVerification(tenantId);
        (report as DreamReportWithVerification).verificationsRun = verificationResult.verificationsRun;
        (report as DreamReportWithVerification).skillsVerified = verificationResult.skillsUpdated;
        (report as DreamReportWithVerification).verificationSurprises = verificationResult.surpriseEvents;
        
        logger.info('Active verification during dream', {
          tenantId,
          verificationsRun: verificationResult.verificationsRun,
          skillsUpdated: verificationResult.skillsUpdated,
          surpriseEvents: verificationResult.surpriseEvents,
        });
      } catch (verifyError) {
        logger.warn('Active verification failed during dream', { tenantId, error: verifyError });
        report.errors.push({
          operation: 'active_verification',
          error: String(verifyError),
          timestamp: new Date(),
        });
      }

      // Complete successfully
      report.completedAt = new Date();
      report.durationMs = Date.now() - startTime;

      await executeStatement(
        `UPDATE dream_queue 
         SET status = 'completed', 
             completed_at = NOW(), 
             duration_ms = $2,
             report_json = $3
         WHERE id = $1`,
        [
          { name: 'id', value: { stringValue: jobId } },
          { name: 'durationMs', value: { longValue: report.durationMs } },
          { name: 'report', value: { stringValue: JSON.stringify(report) } },
        ]
      );

      // Update tenant dream status
      await executeStatement(
        `INSERT INTO tenant_dream_status (tenant_id, last_dream_at, dream_count, last_dream_duration_ms, last_dream_status)
         VALUES ($1, NOW(), 1, $2, 'completed')
         ON CONFLICT (tenant_id) DO UPDATE SET
           last_dream_at = NOW(),
           dream_count = tenant_dream_status.dream_count + 1,
           last_dream_duration_ms = $2,
           last_dream_status = 'completed',
           updated_at = NOW()`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'durationMs', value: { longValue: report.durationMs } },
        ]
      );

      logger.info('Dream completed', {
        jobId,
        tenantId,
        durationMs: report.durationMs,
        factsConsolidated: report.flashFactsConsolidated,
      });

    } catch (error) {
      report.completedAt = new Date();
      report.durationMs = Date.now() - startTime;
      report.errors.push({
        operation: 'dream_execution',
        error: String(error),
        timestamp: new Date(),
      });

      await executeStatement(
        `UPDATE dream_queue 
         SET status = 'failed', 
             completed_at = NOW(), 
             error = $2
         WHERE id = $1`,
        [
          { name: 'id', value: { stringValue: jobId } },
          { name: 'error', value: { stringValue: String(error) } },
        ]
      );

      logger.error(`Dream failed: ${String(error)}`);
    }

    return report;
  }

  /**
   * Consolidate a flash fact into long-term memory
   */
  private async consolidateFlashFact(fact: { id: string; userId: string; tenantId: string; fact: string; factType: string }): Promise<void> {
    // Create memory from flash fact
    await executeStatement(
      `INSERT INTO user_memories (user_id, tenant_id, content, source, memory_type, relevance_score)
       VALUES ($1, $2, $3, 'flash_fact', $4, 0.8)`,
      [
        { name: 'userId', value: { stringValue: fact.userId } },
        { name: 'tenantId', value: { stringValue: fact.tenantId } },
        { name: 'content', value: { stringValue: fact.fact } },
        { name: 'type', value: { stringValue: fact.factType } },
      ]
    );

    // Mark flash fact as consolidated
    await flashBufferService.markConsolidated(fact.id);
  }

  /**
   * Prune old memories
   */
  private async pruneOldMemories(tenantId: string): Promise<number> {
    try {
      const result = await executeStatement(
        `DELETE FROM user_memories
         WHERE tenant_id = $1 
         AND accessed_at < NOW() - INTERVAL '90 days'
         AND relevance_score < 0.3`,
        [{ name: 'tenantId', value: { stringValue: tenantId } }]
      );
      return result.rowCount || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Prune stale ghost vectors
   */
  private async pruneStaleGhosts(tenantId: string): Promise<number> {
    try {
      const result = await executeStatement(
        `DELETE FROM ghost_vectors
         WHERE tenant_id = $1 
         AND updated_at < NOW() - INTERVAL '30 days'`,
        [{ name: 'tenantId', value: { stringValue: tenantId } }]
      );
      return result.rowCount || 0;
    } catch {
      return 0;
    }
  }

  // ===========================================================================
  // Status & Monitoring
  // ===========================================================================

  /**
   * Get dream queue status
   */
  async getQueueStatus(): Promise<DreamQueueStatus> {
    try {
      const result = await executeStatement(
        `SELECT 
           COUNT(*) FILTER (WHERE status = 'pending') as pending,
           COUNT(*) FILTER (WHERE status = 'running') as running,
           COUNT(*) FILTER (WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours') as completed_today,
           COUNT(*) FILTER (WHERE status = 'failed' AND completed_at > NOW() - INTERVAL '24 hours') as failed_today,
           AVG(duration_ms) FILTER (WHERE status = 'completed') as avg_duration,
           MIN(scheduled_for) FILTER (WHERE status = 'pending') as oldest_pending
         FROM dream_queue`,
        []
      );

      if (result.rows.length > 0) {
        const row = result.rows[0] as Record<string, unknown>;
        return {
          pendingJobs: Number(row.pending) || 0,
          runningJobs: Number(row.running) || 0,
          completedToday: Number(row.completed_today) || 0,
          failedToday: Number(row.failed_today) || 0,
          avgDurationMs: Number(row.avg_duration) || 0,
          oldestPendingAt: row.oldest_pending ? new Date(row.oldest_pending as string) : null,
        };
      }
    } catch (error) {
      logger.error(`Failed to get queue status: ${String(error)}`);
    }

    return {
      pendingJobs: 0,
      runningJobs: 0,
      completedToday: 0,
      failedToday: 0,
      avgDurationMs: 0,
      oldestPendingAt: null,
    };
  }

  /**
   * Get tenant dream schedules
   */
  async getTenantSchedules(limit: number = 50): Promise<TenantDreamSchedule[]> {
    try {
      const result = await executeStatement(
        `SELECT 
           t.tenant_id,
           COALESCE(tds.timezone, 'UTC') as timezone,
           tds.last_dream_at,
           tds.next_dream_scheduled,
           EXTRACT(EPOCH FROM (NOW() - COALESCE(tds.last_dream_at, NOW() - INTERVAL '100 hours'))) / 3600 as hours_since_dream
         FROM tenants t
         LEFT JOIN tenant_dream_status tds ON t.tenant_id = tds.tenant_id
         ORDER BY hours_since_dream DESC
         LIMIT $1`,
        [{ name: 'limit', value: { longValue: limit } }]
      );

      const twilightHour = await brainConfigService.getNumber('DREAM_TWILIGHT_HOUR', 4);
      const starvationHours = await brainConfigService.getNumber('DREAM_STARVATION_HOURS', 30);

      return result.rows.map(row => {
        const r = row as Record<string, unknown>;
        const hoursSinceDream = Number(r.hours_since_dream) || 0;
        return {
          tenantId: r.tenant_id as string,
          timezone: r.timezone as string,
          lastDreamAt: r.last_dream_at ? new Date(r.last_dream_at as string) : null,
          nextScheduledDream: r.next_dream_scheduled ? new Date(r.next_dream_scheduled as string) : null,
          hoursSinceDream,
          eligibleForTwilight: hoursSinceDream >= 20,
          eligibleForStarvation: hoursSinceDream >= starvationHours,
        };
      });
    } catch (error) {
      logger.error(`Failed to get tenant schedules: ${String(error)}`);
      return [];
    }
  }

  /**
   * Manually trigger a dream for a tenant
   */
  async triggerManualDream(tenantId: string): Promise<DreamJob> {
    return this.scheduleDream(tenantId, 'manual', new Date());
  }
}

// Export singleton instance
export const dreamSchedulerService = new DreamSchedulerService();

// Export class for testing
export { DreamSchedulerService };
