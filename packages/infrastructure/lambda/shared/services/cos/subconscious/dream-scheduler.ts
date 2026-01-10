/**
 * DreamScheduler v6.0.5
 * 
 * PURPOSE: Schedule "Dreaming" maintenance jobs for consciousness consolidation
 * 
 * TRIGGERS:
 *   - TWILIGHT: 4 AM tenant local time (optimal for low-activity consolidation)
 *   - STARVATION: 30 hours since last dream (catch-all if Twilight missed)
 * 
 * Gemini note: LIMIT 500 may cause EST bottleneck during peak hours;
 * starvation trigger catches any missed tenants within 30hr
 * 
 * Location: packages/infrastructure/lambda/shared/services/cos/subconscious/dream-scheduler.ts
 */

import { Redis } from 'ioredis';
import { query } from '../../database';
import { DreamJob, DreamTrigger, TenantDreamConfig } from '../types';
import { logger } from '../../../logging/enhanced-logger';

export interface SchedulingResult {
  scheduled: number;
  skipped: number;
  errors: string[];
}

/**
 * DreamScheduler - Consciousness maintenance scheduling
 * 
 * "Dreaming" is when the system consolidates:
 * 1. Flash facts → Long-term memory
 * 2. Ghost vectors → Re-anchored with fresh hidden states
 * 3. Learning updates → Applied to model adapters
 * 
 * This happens during low-activity periods (4 AM local time)
 * to minimize impact on user experience.
 */
export class DreamScheduler {
  private redis: Redis;
  private readonly QUEUE_KEY = 'cos:dream_queue';
  private readonly STARVATION_HOURS = 30;
  private readonly BATCH_SIZE = 500;
  private readonly DEFAULT_TWILIGHT_HOUR = 4; // 4 AM
  
  constructor(redis: Redis) {
    this.redis = redis;
  }
  
  /**
   * Schedule Twilight dreams for tenants at 4 AM local time
   * 
   * Run this every hour from a cron job.
   * It will only schedule tenants where it's currently 4 AM.
   * 
   * @returns Number of dreams scheduled
   */
  async scheduleTwilightDreams(): Promise<SchedulingResult> {
    const result: SchedulingResult = { scheduled: 0, skipped: 0, errors: [] };
    
    try {
      // Find tenants where it's currently twilight hour (4 AM local)
      // AND they haven't dreamed in the last 20 hours (prevent double-scheduling)
      const tenantsResult = await query(
        `SELECT tc.tenant_id, tc.timezone, tc.twilight_hour, tc.last_dream_at
         FROM cos_tenant_dream_config tc
         WHERE EXTRACT(HOUR FROM NOW() AT TIME ZONE tc.timezone) = tc.twilight_hour
         AND (tc.last_dream_at IS NULL OR tc.last_dream_at < NOW() - INTERVAL '20 hours')
         AND NOT EXISTS (
           SELECT 1 FROM cos_dream_jobs dj 
           WHERE dj.tenant_id = tc.tenant_id 
           AND dj.status IN ('scheduled', 'running')
         )
         LIMIT $1`,
        [this.BATCH_SIZE]
      );
      
      for (const row of tenantsResult.rows) {
        try {
          await this.queueDream(row.tenant_id, 'TWILIGHT');
          result.scheduled++;
        } catch (error) {
          result.errors.push(`Tenant ${row.tenant_id}: ${error}`);
          result.skipped++;
        }
      }
      
      if (result.scheduled > 0) {
        logger.info(`[COS] Twilight dreams scheduled: ${result.scheduled} tenants`);
      }
      
    } catch (error) {
      result.errors.push(`Query failed: ${error}`);
    }
    
    return result;
  }
  
  /**
   * Schedule Starvation dreams for tenants that missed Twilight
   * 
   * This is a catch-all to ensure no tenant goes more than 30 hours
   * without consolidation, even if Twilight scheduling fails.
   * 
   * @returns Number of dreams scheduled
   */
  async scheduleStarvationDreams(): Promise<SchedulingResult> {
    const result: SchedulingResult = { scheduled: 0, skipped: 0, errors: [] };
    
    try {
      const threshold = new Date(Date.now() - this.STARVATION_HOURS * 60 * 60 * 1000);
      
      const tenantsResult = await query(
        `SELECT tc.tenant_id, tc.last_dream_at
         FROM cos_tenant_dream_config tc
         WHERE (tc.last_dream_at IS NULL OR tc.last_dream_at < $1)
         AND NOT EXISTS (
           SELECT 1 FROM cos_dream_jobs dj 
           WHERE dj.tenant_id = tc.tenant_id 
           AND dj.status IN ('scheduled', 'running')
         )
         LIMIT $2`,
        [threshold, this.BATCH_SIZE]
      );
      
      for (const row of tenantsResult.rows) {
        try {
          await this.queueDream(row.tenant_id, 'STARVATION');
          result.scheduled++;
        } catch (error) {
          result.errors.push(`Tenant ${row.tenant_id}: ${error}`);
          result.skipped++;
        }
      }
      
      if (result.scheduled > 0) {
        logger.info(`[COS] Starvation dreams scheduled: ${result.scheduled} tenants (threshold: ${this.STARVATION_HOURS}h)`);
      }
      
    } catch (error) {
      result.errors.push(`Query failed: ${error}`);
    }
    
    return result;
  }
  
  /**
   * Run both Twilight and Starvation scheduling
   * 
   * Call this from a single cron job every hour.
   */
  async runSchedulingCycle(): Promise<{
    twilight: SchedulingResult;
    starvation: SchedulingResult;
  }> {
    const twilight = await this.scheduleTwilightDreams();
    const starvation = await this.scheduleStarvationDreams();
    
    return { twilight, starvation };
  }
  
  /**
   * Queue a dream job for a tenant
   */
  private async queueDream(tenantId: string, trigger: DreamTrigger): Promise<DreamJob> {
    const job: DreamJob = {
      id: crypto.randomUUID(),
      tenantId,
      trigger,
      scheduledAt: new Date(),
      status: 'scheduled',
      flashFactsConsolidated: 0,
      ghostVectorsReanchored: 0,
      loraUpdatesApplied: 0,
      retryCount: 0,
    };
    
    // Insert into database
    await query(
      `INSERT INTO cos_dream_jobs 
       (id, tenant_id, trigger, scheduled_at, status, retry_count)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [job.id, tenantId, trigger, job.scheduledAt, 'scheduled', 0]
    );
    
    // Add to Redis queue for processing
    await this.redis.lpush(this.QUEUE_KEY, JSON.stringify(job));
    
    return job;
  }
  
  /**
   * Get pending dream jobs for a tenant
   */
  async getPendingDreams(tenantId: string): Promise<DreamJob[]> {
    const result = await query(
      `SELECT * FROM cos_dream_jobs 
       WHERE tenant_id = $1 AND status IN ('scheduled', 'running')
       ORDER BY scheduled_at DESC`,
      [tenantId]
    );
    
    return result.rows.map(this.rowToDreamJob);
  }
  
  /**
   * Get dream history for a tenant
   */
  async getDreamHistory(tenantId: string, limit: number = 10): Promise<DreamJob[]> {
    const result = await query(
      `SELECT * FROM cos_dream_jobs 
       WHERE tenant_id = $1 
       ORDER BY scheduled_at DESC 
       LIMIT $2`,
      [tenantId, limit]
    );
    
    return result.rows.map(this.rowToDreamJob);
  }
  
  /**
   * Get or create tenant dream config
   */
  async getTenantConfig(tenantId: string): Promise<TenantDreamConfig> {
    const result = await query(
      `SELECT * FROM cos_tenant_dream_config WHERE tenant_id = $1`,
      [tenantId]
    );
    
    if (result.rows.length > 0) {
      return this.rowToConfig(result.rows[0]);
    }
    
    // Create default config
    return this.createTenantConfig(tenantId);
  }
  
  /**
   * Create default tenant dream config
   */
  async createTenantConfig(tenantId: string, timezone: string = 'UTC'): Promise<TenantDreamConfig> {
    const config: TenantDreamConfig = {
      tenantId,
      timezone,
      twilightHour: this.DEFAULT_TWILIGHT_HOUR,
      starvationThresholdHours: this.STARVATION_HOURS,
    };
    
    await query(
      `INSERT INTO cos_tenant_dream_config 
       (tenant_id, timezone, twilight_hour, starvation_threshold_hours)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [tenantId, timezone, config.twilightHour, config.starvationThresholdHours]
    );
    
    return config;
  }
  
  /**
   * Update tenant dream config
   */
  async updateTenantConfig(
    tenantId: string, 
    updates: Partial<Omit<TenantDreamConfig, 'tenantId'>>
  ): Promise<TenantDreamConfig> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;
    
    if (updates.timezone !== undefined) {
      sets.push(`timezone = $${paramIndex++}`);
      values.push(updates.timezone);
    }
    if (updates.twilightHour !== undefined) {
      sets.push(`twilight_hour = $${paramIndex++}`);
      values.push(updates.twilightHour);
    }
    if (updates.starvationThresholdHours !== undefined) {
      sets.push(`starvation_threshold_hours = $${paramIndex++}`);
      values.push(updates.starvationThresholdHours);
    }
    
    if (sets.length === 0) {
      return this.getTenantConfig(tenantId);
    }
    
    values.push(tenantId);
    
    await query(
      `UPDATE cos_tenant_dream_config SET ${sets.join(', ')} WHERE tenant_id = $${paramIndex}`,
      values
    );
    
    return this.getTenantConfig(tenantId);
  }
  
  /**
   * Mark dream as started (called by executor)
   */
  async markDreamStarted(jobId: string): Promise<void> {
    await query(
      `UPDATE cos_dream_jobs SET status = 'running', started_at = NOW() WHERE id = $1`,
      [jobId]
    );
  }
  
  /**
   * Mark dream as completed (called by executor)
   */
  async markDreamCompleted(
    jobId: string, 
    results: { flashFacts: number; ghosts: number; lora: number }
  ): Promise<void> {
    await query(
      `UPDATE cos_dream_jobs 
       SET status = 'completed', 
           completed_at = NOW(),
           flash_facts_consolidated = $2,
           ghost_vectors_reanchored = $3,
           lora_updates_applied = $4
       WHERE id = $1`,
      [jobId, results.flashFacts, results.ghosts, results.lora]
    );
    
    // Update tenant's last_dream_at
    await query(
      `UPDATE cos_tenant_dream_config 
       SET last_dream_at = NOW() 
       WHERE tenant_id = (SELECT tenant_id FROM cos_dream_jobs WHERE id = $1)`,
      [jobId]
    );
  }
  
  /**
   * Mark dream as failed (called by executor)
   */
  async markDreamFailed(jobId: string, errorMessage: string): Promise<void> {
    await query(
      `UPDATE cos_dream_jobs 
       SET status = 'failed', 
           completed_at = NOW(),
           error_message = $2,
           retry_count = retry_count + 1
       WHERE id = $1`,
      [jobId, errorMessage]
    );
  }
  
  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    queued: number;
    scheduled: number;
    running: number;
    completedToday: number;
    failedToday: number;
  }> {
    const queuedCount = await this.redis.llen(this.QUEUE_KEY);
    
    const dbStats = await query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
        COUNT(*) FILTER (WHERE status = 'running') as running,
        COUNT(*) FILTER (WHERE status = 'completed' AND completed_at > CURRENT_DATE) as completed_today,
        COUNT(*) FILTER (WHERE status = 'failed' AND completed_at > CURRENT_DATE) as failed_today
       FROM cos_dream_jobs`
    );
    
    const row = dbStats.rows[0];
    return {
      queued: queuedCount,
      scheduled: parseInt(row.scheduled),
      running: parseInt(row.running),
      completedToday: parseInt(row.completed_today),
      failedToday: parseInt(row.failed_today),
    };
  }
  
  private rowToDreamJob(row: Record<string, unknown>): DreamJob {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      trigger: row.trigger as DreamTrigger,
      scheduledAt: new Date(row.scheduled_at as string),
      status: row.status as DreamJob['status'],
      startedAt: row.started_at ? new Date(row.started_at as string) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      flashFactsConsolidated: row.flash_facts_consolidated as number,
      ghostVectorsReanchored: row.ghost_vectors_reanchored as number,
      loraUpdatesApplied: row.lora_updates_applied as number,
      errorMessage: row.error_message as string | undefined,
      retryCount: row.retry_count as number,
    };
  }
  
  private rowToConfig(row: Record<string, unknown>): TenantDreamConfig {
    return {
      tenantId: row.tenant_id as string,
      timezone: row.timezone as string,
      twilightHour: row.twilight_hour as number,
      starvationThresholdHours: row.starvation_threshold_hours as number,
      lastDreamAt: row.last_dream_at ? new Date(row.last_dream_at as string) : undefined,
    };
  }
}
