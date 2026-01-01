/**
 * RADIANT v6.0.4 - Flash Buffer Service
 * Dual-write flash facts for safety-critical information
 * 
 * Flash facts are critical pieces of information that must be:
 * 1. Immediately available (Redis for speed)
 * 2. Durably stored (Postgres for persistence)
 * 3. Eventually consolidated into long-term memory (Dreaming)
 */

import { v4 as uuidv4 } from 'uuid';
import { executeStatement } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { brainConfigService } from './brain-config.service';
import {
  type FlashFact,
  type FlashFactType,
  type FlashFactPriority,
  type FlashFactStatus,
  type FlashFactDetection,
} from '@radiant/shared';

// =============================================================================
// Constants
// =============================================================================

const FLASH_REDIS_KEY_PREFIX = 'flash_facts:';

// Flash fact detection patterns
const FLASH_FACT_PATTERNS: Array<{
  pattern: RegExp;
  type: FlashFactType;
  priority: FlashFactPriority;
}> = [
  // Allergies - CRITICAL
  { pattern: /\b(allergic|allergy)\s+(to\s+)?(\w+)/i, type: 'allergy', priority: 'critical' },
  { pattern: /\bcan'?t\s+(have|eat|take)\s+(\w+)\s+(because|due)/i, type: 'allergy', priority: 'critical' },
  
  // Medical conditions - CRITICAL
  { pattern: /\b(diagnosed\s+with|have|suffer\s+from)\s+(\w+\s+){0,2}(diabetes|cancer|heart|asthma|epilepsy)/i, type: 'medical', priority: 'critical' },
  { pattern: /\bmy\s+(doctor|physician)\s+(said|told)/i, type: 'medical', priority: 'high' },
  
  // Identity - HIGH
  { pattern: /\bmy\s+name\s+is\s+(\w+)/i, type: 'identity', priority: 'high' },
  { pattern: /\bcall\s+me\s+(\w+)/i, type: 'identity', priority: 'high' },
  { pattern: /\bi'?m\s+(\d+)\s+years?\s+old/i, type: 'identity', priority: 'normal' },
  
  // Preferences - NORMAL
  { pattern: /\bi\s+(prefer|like|love|hate|dislike)\s+(\w+)/i, type: 'preference', priority: 'normal' },
  { pattern: /\bdon'?t\s+(like|want|need)\s+(\w+)/i, type: 'preference', priority: 'normal' },
  
  // Constraints - HIGH
  { pattern: /\bi\s+(can'?t|cannot|must\s+not|never)\s+(\w+)/i, type: 'constraint', priority: 'high' },
  { pattern: /\balways\s+(need|require|must)/i, type: 'constraint', priority: 'high' },
  
  // Corrections - HIGH
  { pattern: /\bthat'?s\s+(not\s+right|wrong|incorrect)/i, type: 'correction', priority: 'high' },
  { pattern: /\bno,?\s+(i\s+meant|actually|i\s+said)/i, type: 'correction', priority: 'high' },
];

// =============================================================================
// Flash Buffer Service
// =============================================================================

class FlashBufferService {
  private redis: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string, options?: { EX?: number }) => Promise<void>;
    lpush: (key: string, ...values: string[]) => Promise<number>;
    lrange: (key: string, start: number, stop: number) => Promise<string[]>;
    ltrim: (key: string, start: number, stop: number) => Promise<void>;
    expire: (key: string, seconds: number) => Promise<void>;
    del: (key: string) => Promise<void>;
  } | null = null;

  /**
   * Initialize with Redis client
   */
  initialize(redisClient: typeof this.redis): void {
    this.redis = redisClient;
  }

  // ===========================================================================
  // Flash Fact Detection
  // ===========================================================================

  /**
   * Detect flash facts in user input
   */
  detectFlashFacts(input: string): FlashFactDetection {
    const facts: FlashFactDetection['facts'] = [];

    for (const { pattern, type, priority } of FLASH_FACT_PATTERNS) {
      const match = input.match(pattern);
      if (match) {
        facts.push({
          fact: match[0],
          type,
          priority,
          confidence: this.calculateConfidence(match[0], type),
        });
      }
    }

    // Deduplicate by type
    const deduped = facts.reduce((acc, fact) => {
      const existing = acc.find(f => f.type === fact.type);
      if (!existing || fact.confidence > existing.confidence) {
        return [...acc.filter(f => f.type !== fact.type), fact];
      }
      return acc;
    }, [] as typeof facts);

    return {
      detected: deduped.length > 0,
      facts: deduped,
    };
  }

  /**
   * Calculate confidence score for detected fact
   */
  private calculateConfidence(factText: string, type: FlashFactType): number {
    let confidence = 0.7; // Base confidence

    // Longer matches are more confident
    if (factText.length > 20) confidence += 0.1;
    if (factText.length > 40) confidence += 0.1;

    // Critical types get higher base confidence
    if (type === 'allergy' || type === 'medical') confidence += 0.1;

    return Math.min(0.99, confidence);
  }

  // ===========================================================================
  // Store Flash Facts
  // ===========================================================================

  /**
   * Store flash fact - DUAL WRITE (Redis + Postgres)
   */
  async storeFact(
    userId: string,
    tenantId: string,
    detected: { fact: string; type: FlashFactType; priority: FlashFactPriority }
  ): Promise<FlashFact> {
    const fact: FlashFact = {
      id: uuidv4(),
      userId,
      tenantId,
      fact: detected.fact,
      factType: detected.type,
      priority: detected.priority,
      status: 'pending_dream',
      retryCount: 0,
      createdAt: new Date(),
      consolidatedAt: null,
    };

    // DUAL WRITE: Redis (speed) + Postgres (durability)
    await Promise.all([
      this.writeToRedis(fact),
      this.writeToPostgres(fact),
    ]);

    logger.info('Flash fact stored', {
      userId,
      tenantId,
      factType: fact.factType,
      priority: fact.priority,
    });

    return fact;
  }

  /**
   * Write flash fact to Redis
   */
  private async writeToRedis(fact: FlashFact): Promise<void> {
    if (!this.redis) return;

    try {
      const ttlHours = await brainConfigService.getNumber('FLASH_REDIS_TTL_HOURS', 168);
      const maxFacts = await brainConfigService.getNumber('FLASH_MAX_FACTS_PER_USER', 10);
      const listKey = `${FLASH_REDIS_KEY_PREFIX}${fact.tenantId}:${fact.userId}`;

      // Add to list (newest first)
      await this.redis.lpush(listKey, JSON.stringify(fact));
      
      // Trim to max size
      await this.redis.ltrim(listKey, 0, maxFacts - 1);
      
      // Set expiry
      await this.redis.expire(listKey, ttlHours * 3600);
    } catch (error) {
      logger.error(`Failed to write flash fact to Redis: ${String(error)}`);
      // Don't throw - Postgres is the durable store
    }
  }

  /**
   * Write flash fact to Postgres
   */
  private async writeToPostgres(fact: FlashFact): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO flash_facts_log 
         (id, user_id, tenant_id, fact_json, fact_type, priority, status, retry_count, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          { name: 'id', value: { stringValue: fact.id } },
          { name: 'userId', value: { stringValue: fact.userId } },
          { name: 'tenantId', value: { stringValue: fact.tenantId } },
          { name: 'factJson', value: { stringValue: JSON.stringify({ fact: fact.fact }) } },
          { name: 'factType', value: { stringValue: fact.factType } },
          { name: 'priority', value: { stringValue: fact.priority } },
          { name: 'status', value: { stringValue: fact.status } },
          { name: 'retryCount', value: { longValue: fact.retryCount } },
          { name: 'createdAt', value: { stringValue: fact.createdAt.toISOString() } },
        ]
      );
    } catch (error) {
      logger.error(`Failed to write flash fact to Postgres: ${String(error)}`);
      throw error; // Postgres is critical - must succeed
    }
  }

  // ===========================================================================
  // Load Flash Facts
  // ===========================================================================

  /**
   * Load flash facts for user (from Redis, fallback to Postgres)
   */
  async loadFacts(userId: string, tenantId: string): Promise<FlashFact[]> {
    const maxFacts = await brainConfigService.getNumber('FLASH_MAX_FACTS_PER_USER', 10);

    // Try Redis first
    if (this.redis) {
      try {
        const listKey = `${FLASH_REDIS_KEY_PREFIX}${tenantId}:${userId}`;
        const redisData = await this.redis.lrange(listKey, 0, maxFacts - 1);

        if (redisData.length > 0) {
          return redisData.map(data => JSON.parse(data) as FlashFact);
        }
      } catch (error) {
        logger.warn(`Failed to load flash facts from Redis: ${String(error)}`);
      }
    }

    // Fallback to Postgres
    try {
      const result = await executeStatement(
        `SELECT id, user_id, tenant_id, fact_json, fact_type, priority, status, 
                retry_count, created_at, consolidated_at
         FROM flash_facts_log
         WHERE user_id = $1 AND tenant_id = $2
         ORDER BY 
           CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,
           created_at DESC
         LIMIT $3`,
        [
          { name: 'userId', value: { stringValue: userId } },
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'limit', value: { longValue: maxFacts } },
        ]
      );

      const facts = result.rows.map(row => {
        const r = row as Record<string, unknown>;
        const factJson = JSON.parse(r.fact_json as string);
        return {
          id: r.id as string,
          userId: r.user_id as string,
          tenantId: r.tenant_id as string,
          fact: factJson.fact,
          factType: r.fact_type as FlashFactType,
          priority: r.priority as FlashFactPriority,
          status: r.status as FlashFactStatus,
          retryCount: r.retry_count as number,
          createdAt: new Date(r.created_at as string),
          consolidatedAt: r.consolidated_at ? new Date(r.consolidated_at as string) : null,
        };
      });

      // Cache in Redis for next time
      if (this.redis && facts.length > 0) {
        const listKey = `${FLASH_REDIS_KEY_PREFIX}${tenantId}:${userId}`;
        const ttlHours = await brainConfigService.getNumber('FLASH_REDIS_TTL_HOURS', 168);
        
        await this.redis.del(listKey);
        for (const fact of facts.reverse()) {
          await this.redis.lpush(listKey, JSON.stringify(fact));
        }
        await this.redis.expire(listKey, ttlHours * 3600);
      }

      return facts;
    } catch (error) {
      logger.error(`Failed to load flash facts from Postgres: ${String(error)}`);
      return [];
    }
  }

  /**
   * Load critical facts only (always included in context)
   */
  async loadCriticalFacts(userId: string, tenantId: string): Promise<FlashFact[]> {
    const allFacts = await this.loadFacts(userId, tenantId);
    return allFacts.filter(f => f.priority === 'critical');
  }

  // ===========================================================================
  // Consolidation
  // ===========================================================================

  /**
   * Get pending facts for dream consolidation
   */
  async getPendingForConsolidation(tenantId: string, limit: number = 100): Promise<FlashFact[]> {
    try {
      const result = await executeStatement(
        `SELECT id, user_id, tenant_id, fact_json, fact_type, priority, status,
                retry_count, created_at
         FROM flash_facts_log
         WHERE tenant_id = $1 AND status = 'pending_dream' AND retry_count < 3
         ORDER BY priority DESC, created_at ASC
         LIMIT $2`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'limit', value: { longValue: limit } },
        ]
      );

      return result.rows.map(row => {
        const r = row as Record<string, unknown>;
        const factJson = JSON.parse(r.fact_json as string);
        return {
          id: r.id as string,
          userId: r.user_id as string,
          tenantId: r.tenant_id as string,
          fact: factJson.fact,
          factType: r.fact_type as FlashFactType,
          priority: r.priority as FlashFactPriority,
          status: r.status as FlashFactStatus,
          retryCount: r.retry_count as number,
          createdAt: new Date(r.created_at as string),
          consolidatedAt: null,
        };
      });
    } catch (error) {
      logger.error(`Failed to get pending facts: ${String(error)}`);
      return [];
    }
  }

  /**
   * Mark fact as consolidated
   */
  async markConsolidated(factId: string): Promise<void> {
    try {
      await executeStatement(
        `UPDATE flash_facts_log 
         SET status = 'consolidated', consolidated_at = NOW()
         WHERE id = $1`,
        [{ name: 'id', value: { stringValue: factId } }]
      );
    } catch (error) {
      logger.error(`Failed to mark fact consolidated: ${String(error)}`);
    }
  }

  /**
   * Mark fact as failed with retry
   */
  async markFailed(factId: string): Promise<void> {
    try {
      await executeStatement(
        `UPDATE flash_facts_log 
         SET status = CASE WHEN retry_count >= 2 THEN 'failed_retry' ELSE status END,
             retry_count = retry_count + 1
         WHERE id = $1`,
        [{ name: 'id', value: { stringValue: factId } }]
      );
    } catch (error) {
      logger.error(`Failed to mark fact failed: ${String(error)}`);
    }
  }

  // ===========================================================================
  // Reconciliation
  // ===========================================================================

  /**
   * Reconcile Redis and Postgres (run periodically)
   */
  async reconcile(tenantId: string): Promise<{ synced: number; errors: number }> {
    let synced = 0;
    let errors = 0;

    if (!this.redis) {
      return { synced, errors };
    }

    try {
      // Get all users with flash facts in this tenant
      const result = await executeStatement(
        `SELECT DISTINCT user_id FROM flash_facts_log WHERE tenant_id = $1`,
        [{ name: 'tenantId', value: { stringValue: tenantId } }]
      );

      for (const row of result.rows) {
        const userId = (row as { user_id: string }).user_id;
        
        try {
          // Load from Postgres and refresh Redis
          const facts = await this.loadFacts(userId, tenantId);
          if (facts.length > 0) {
            synced++;
          }
        } catch {
          errors++;
        }
      }
    } catch (error) {
      logger.error(`Reconciliation failed: ${String(error)}`);
      errors++;
    }

    logger.info('Flash buffer reconciliation complete', { tenantId, synced, errors });
    return { synced, errors };
  }
}

// Export singleton instance
export const flashBufferService = new FlashBufferService();

// Export class for testing
export { FlashBufferService };
