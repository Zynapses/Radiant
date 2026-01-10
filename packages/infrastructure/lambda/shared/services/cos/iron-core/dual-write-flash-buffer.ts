/**
 * DualWriteFlashBuffer v6.0.5
 * 
 * PURPOSE: Prevent flash fact loss if Dreaming job fails
 * 
 * PROBLEM (v6.0.2): Redis-only with 24h TTL
 *   - Dreaming fails for 36h → Redis TTL expires → FACT LOST
 *   - User: "I'm allergic to peanuts" → Order Thai food → Gets peanut dish
 * 
 * SOLUTION (Gemini): Dual-write to Redis (speed) AND Postgres (durability)
 *   - Redis: 7-day TTL (extended from 24h)
 *   - Postgres: Permanent backup
 *   - Reconciliation: 1hr scan for orphans (168× safety margin)
 * 
 * Location: packages/infrastructure/lambda/shared/services/cos/iron-core/dual-write-flash-buffer.ts
 */

import { Redis } from 'ioredis';
import { query } from '../../database';
import { FlashFact, FlashFactType, FlashFactStatus, FLASH_PATTERNS } from '../types';
import { logger } from '../../../logging/enhanced-logger';

export interface FlashFactDetectionResult {
  detected: boolean;
  type?: FlashFactType;
  fact?: string;
  critical?: boolean;
  matchedPattern?: string;
}

export interface StoreFlashFactParams {
  userId: string;
  tenantId: string;
  fact: string;
  factType: FlashFactType;
  isSafetyCritical: boolean;
}

/**
 * DualWriteFlashBuffer - Durable flash fact storage with Redis + Postgres
 * 
 * Implements the dual-write pattern to ensure flash facts are never lost:
 * 1. Write to Postgres first (durable, authoritative)
 * 2. Write to Redis second (fast access, caching)
 * 3. Reconciliation job recovers orphans (1hr interval)
 */
export class DualWriteFlashBuffer {
  private redis: Redis;
  private readonly REDIS_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
  private readonly KEY_PREFIX = 'flash_fact:';
  private readonly ORPHAN_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour
  private readonly MAX_RETRY_COUNT = 3;
  
  constructor(redis: Redis) {
    this.redis = redis;
  }
  
  /**
   * Detect flash-worthy facts in user message
   * 
   * Uses pattern matching to identify facts that should be remembered:
   * - Identity facts (name, age, profession)
   * - Allergy information (CRITICAL - safety)
   * - Medical conditions (CRITICAL - safety)
   * - Preferences
   * - Corrections
   * 
   * @param message - User message to analyze
   * @returns Detection result with fact details
   */
  detectFlashFact(message: string): FlashFactDetectionResult {
    for (const { pattern, type, critical } of FLASH_PATTERNS) {
      const match = message.match(pattern);
      if (match) {
        return { 
          detected: true, 
          type, 
          fact: match[0], 
          critical,
          matchedPattern: pattern.source,
        };
      }
    }
    return { detected: false };
  }
  
  /**
   * Store flash fact with dual-write (Redis + Postgres)
   * 
   * Write order is critical:
   * 1. Postgres first - ensures durability
   * 2. Redis second - for fast access
   * 
   * If Redis write fails, fact is still safe in Postgres.
   * Reconciliation job will recover Redis entry.
   * 
   * @param params - Flash fact details
   * @returns Stored flash fact with IDs
   */
  async store(params: StoreFlashFactParams): Promise<FlashFact> {
    const id = crypto.randomUUID();
    const redisKey = `${this.KEY_PREFIX}${params.userId}:${id}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.REDIS_TTL_SECONDS * 1000);
    
    const flashFact: FlashFact = {
      id,
      userId: params.userId,
      tenantId: params.tenantId,
      fact: params.fact,
      factType: params.factType,
      isSafetyCritical: params.isSafetyCritical,
      status: 'pending_dream',
      retryCount: 0,
      redisKey,
      createdAt: now,
      expiresAt,
    };
    
    // DUAL-WRITE: Postgres first (durable), then Redis (fast)
    const pgResult = await query(
      `INSERT INTO cos_flash_facts (
        id, user_id, tenant_id, fact, fact_type, is_safety_critical,
        status, retry_count, redis_key, created_at, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [id, params.userId, params.tenantId, params.fact, params.factType,
       params.isSafetyCritical, 'pending_dream', 0, redisKey, now, expiresAt]
    );
    
    flashFact.postgresId = pgResult.rows[0].id;
    
    // Redis write - if this fails, reconciliation will recover
    try {
      await this.redis.setex(redisKey, this.REDIS_TTL_SECONDS, JSON.stringify(flashFact));
    } catch (error) {
      logger.error(`[COS] Redis write failed for flash fact ${id}, will be recovered:`, error);
    }
    
    logger.info(`[COS] Flash fact stored: ${id} (${params.factType}, critical=${params.isSafetyCritical})`);
    return flashFact;
  }
  
  /**
   * Get flash facts for context injection
   * 
   * Priority order:
   * 1. Try Redis first (fast path)
   * 2. Fall back to Postgres if Redis empty
   * 
   * Safety-critical facts are always prioritized.
   * 
   * @param userId - User to get facts for
   * @param limit - Maximum facts to return
   * @returns Array of pending flash facts
   */
  async getForUser(userId: string, limit: number = 10): Promise<FlashFact[]> {
    // Try Redis first (fast path)
    const redisKeys = await this.redis.keys(`${this.KEY_PREFIX}${userId}:*`);
    
    if (redisKeys.length > 0) {
      const redisValues = await this.redis.mget(redisKeys);
      const facts = redisValues
        .filter((v): v is string => v !== null)
        .map(v => JSON.parse(v) as FlashFact)
        .filter(f => f.status === 'pending_dream')
        // Sort: safety-critical first, then by creation time
        .sort((a, b) => {
          if (a.isSafetyCritical !== b.isSafetyCritical) {
            return a.isSafetyCritical ? -1 : 1;
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })
        .slice(0, limit);
      
      if (facts.length > 0) return facts;
    }
    
    // Fallback to Postgres
    const result = await query(
      `SELECT * FROM cos_flash_facts 
       WHERE user_id = $1 AND status = 'pending_dream' 
       ORDER BY is_safety_critical DESC, created_at DESC 
       LIMIT $2`,
      [userId, limit]
    );
    
    return result.rows.map(row => this.rowToFlashFact(row));
  }
  
  /**
   * Get all safety-critical facts for a user (always included in context)
   */
  async getSafetyCriticalFacts(userId: string): Promise<FlashFact[]> {
    const result = await query(
      `SELECT * FROM cos_flash_facts 
       WHERE user_id = $1 AND is_safety_critical = TRUE 
       AND status IN ('pending_dream', 'consolidated')
       ORDER BY created_at DESC`,
      [userId]
    );
    
    return result.rows.map(row => this.rowToFlashFact(row));
  }
  
  /**
   * Mark flash fact as consolidated (processed by Dreaming)
   */
  async markConsolidated(factId: string): Promise<void> {
    await query(
      `UPDATE cos_flash_facts 
       SET status = 'consolidated', consolidated_at = NOW() 
       WHERE id = $1`,
      [factId]
    );
    
    // Remove from Redis (no longer pending)
    const result = await query(
      `SELECT redis_key FROM cos_flash_facts WHERE id = $1`,
      [factId]
    );
    
    if (result.rows[0]?.redis_key) {
      await this.redis.del(result.rows[0].redis_key);
    }
  }
  
  /**
   * Reconciliation job: Find orphans (in Postgres but not Redis)
   * 
   * Gemini: 1hr interval = 168× safety margin vs 7-day TTL
   * 
   * This catches:
   * - Redis write failures
   * - Redis evictions (memory pressure)
   * - Network partitions
   * 
   * @returns Number of orphans recovered
   */
  async reconcileOrphans(): Promise<number> {
    const orphanThreshold = new Date(Date.now() - this.ORPHAN_THRESHOLD_MS);
    
    const result = await query(
      `SELECT * FROM cos_flash_facts 
       WHERE status = 'pending_dream' 
       AND created_at < $1 
       AND retry_count < $2`,
      [orphanThreshold, this.MAX_RETRY_COUNT]
    );
    
    let recoveredCount = 0;
    
    for (const row of result.rows) {
      const flashFact = this.rowToFlashFact(row);
      const exists = await this.redis.exists(flashFact.redisKey);
      
      if (!exists) {
        // Recover to Redis
        await this.redis.setex(
          flashFact.redisKey, 
          this.REDIS_TTL_SECONDS, 
          JSON.stringify(flashFact)
        );
        
        // Update status and increment retry
        await query(
          `UPDATE cos_flash_facts 
           SET status = 'orphan_recovered', retry_count = retry_count + 1 
           WHERE id = $1`,
          [flashFact.id]
        );
        
        recoveredCount++;
        logger.info(`[COS] Recovered orphan flash fact: ${flashFact.id} (${flashFact.factType})`);
      }
    }
    
    if (recoveredCount > 0) {
      logger.info(`[COS] Reconciliation complete: ${recoveredCount} orphans recovered`);
    }
    
    return recoveredCount;
  }
  
  /**
   * Mark facts as failed after max retries
   */
  async markFailedFacts(): Promise<number> {
    const result = await query(
      `UPDATE cos_flash_facts 
       SET status = 'failed_retry' 
       WHERE status IN ('pending_dream', 'orphan_recovered') 
       AND retry_count >= $1
       RETURNING id`,
      [this.MAX_RETRY_COUNT]
    );
    
    return result.rowCount || 0;
  }
  
  /**
   * Delete a flash fact (user requested removal)
   */
  async delete(factId: string, userId: string): Promise<boolean> {
    // Get Redis key first
    const selectResult = await query(
      `SELECT redis_key FROM cos_flash_facts WHERE id = $1 AND user_id = $2`,
      [factId, userId]
    );
    
    if (selectResult.rows.length === 0) {
      return false;
    }
    
    // Delete from both stores
    const deleteResult = await query(
      `DELETE FROM cos_flash_facts WHERE id = $1 AND user_id = $2`,
      [factId, userId]
    );
    
    if (selectResult.rows[0]?.redis_key) {
      await this.redis.del(selectResult.rows[0].redis_key);
    }
    
    return (deleteResult.rowCount || 0) > 0;
  }
  
  /**
   * Get statistics for monitoring
   */
  async getStats(tenantId: string): Promise<{
    total: number;
    pending: number;
    consolidated: number;
    failed: number;
    safetyCritical: number;
    byType: Record<string, number>;
  }> {
    const result = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending_dream') as pending,
        COUNT(*) FILTER (WHERE status = 'consolidated') as consolidated,
        COUNT(*) FILTER (WHERE status = 'failed_retry') as failed,
        COUNT(*) FILTER (WHERE is_safety_critical = TRUE) as safety_critical,
        fact_type,
        COUNT(*) as type_count
       FROM cos_flash_facts 
       WHERE tenant_id = $1
       GROUP BY GROUPING SETS ((), (fact_type))`,
      [tenantId]
    );
    
    const totals = result.rows.find(r => !r.fact_type) || {};
    const byType: Record<string, number> = {};
    result.rows.filter(r => r.fact_type).forEach(r => {
      byType[r.fact_type] = parseInt(r.type_count);
    });
    
    return {
      total: parseInt(totals.total || '0'),
      pending: parseInt(totals.pending || '0'),
      consolidated: parseInt(totals.consolidated || '0'),
      failed: parseInt(totals.failed || '0'),
      safetyCritical: parseInt(totals.safety_critical || '0'),
      byType,
    };
  }
  
  /**
   * Convert database row to FlashFact object
   */
  private rowToFlashFact(row: Record<string, unknown>): FlashFact {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      tenantId: row.tenant_id as string,
      fact: row.fact as string,
      factType: row.fact_type as FlashFactType,
      isSafetyCritical: row.is_safety_critical as boolean,
      status: row.status as FlashFactStatus,
      retryCount: row.retry_count as number,
      redisKey: row.redis_key as string,
      postgresId: row.id as string,
      createdAt: new Date(row.created_at as string),
      consolidatedAt: row.consolidated_at ? new Date(row.consolidated_at as string) : undefined,
      expiresAt: new Date(row.expires_at as string),
    };
  }
}
