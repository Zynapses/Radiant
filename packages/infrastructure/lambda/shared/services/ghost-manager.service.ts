/**
 * RADIANT v6.0.4 - Ghost Vector Manager
 * Manages consciousness continuity with version gating
 * 
 * Ghost Vectors capture the final hidden state of the LLM,
 * providing a compressed representation of conversation context.
 * 
 * Key Features:
 * - Version gating to prevent hallucinations on model upgrade
 * - Deterministic jitter to prevent thundering herd
 * - Async re-anchoring (fire-and-forget)
 * - Dual storage (Redis + Postgres)
 */

import { executeStatement } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { brainConfigService } from './brain-config.service';
import {
  type GhostVector,
  type GhostLoadResult,
  type ReAnchorResult,
  type GhostStats,
  type GhostHealthCheck,
  GHOST_VECTOR_DIMENSION,
  GHOST_REDIS_KEY_PREFIX,
  GHOST_REDIS_TTL_SECONDS,
  buildGhostRedisKey,
  serializeGhostVector,
  deserializeGhostVector,
} from '@radiant/shared';

// =============================================================================
// Ghost Manager Service
// =============================================================================

class GhostManagerService {
  private redis: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string, options?: { EX?: number }) => Promise<void>;
    del: (key: string) => Promise<void>;
  } | null = null;

  /**
   * Initialize with Redis client
   */
  initialize(redisClient: typeof this.redis): void {
    this.redis = redisClient;
  }

  // ===========================================================================
  // Load Ghost Vector
  // ===========================================================================

  /**
   * Load ghost vector with VERSION GATING - CRITICAL
   */
  async loadGhost(userId: string, tenantId: string): Promise<GhostLoadResult> {
    const startTime = Date.now();
    const currentVersion = await brainConfigService.getString('GHOST_CURRENT_VERSION', 'llama3-70b-v1');

    // Try Redis first
    if (this.redis) {
      try {
        const redisKey = buildGhostRedisKey(tenantId, userId);
        const redisData = await this.redis.get(redisKey);

        if (redisData) {
          const record = JSON.parse(redisData) as {
            vector: number[];
            version: string;
            turnCount: number;
          };

          // VERSION CHECK - Prevents hallucinations on model upgrade
          if (record.version !== currentVersion) {
            logger.warn('Ghost version mismatch', {
              userId,
              tenantId,
              oldVersion: record.version,
              currentVersion,
            });
            
            const handled = await this.handleVersionMismatch(
              userId,
              tenantId,
              record,
              currentVersion
            );
            
            return {
              found: handled !== null,
              vector: handled,
              version: handled ? currentVersion : null,
              turnCount: 0,
              versionMatch: false,
              source: 'redis',
              latencyMs: Date.now() - startTime,
            };
          }

          return {
            found: true,
            vector: new Float32Array(record.vector),
            version: record.version,
            turnCount: record.turnCount,
            versionMatch: true,
            source: 'redis',
            latencyMs: Date.now() - startTime,
          };
        }
      } catch (error) {
        logger.warn(`Redis ghost load failed: ${String(error)}`);
      }
    }

    // Fallback to Postgres
    try {
      const result = await executeStatement(
        `SELECT vector, version, turn_count 
         FROM ghost_vectors 
         WHERE user_id = $1 AND tenant_id = $2`,
        [
          { name: 'userId', value: { stringValue: userId } },
          { name: 'tenantId', value: { stringValue: tenantId } },
        ]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0] as {
          vector: string; // Base64 encoded
          version: string;
          turn_count: number;
        };

        const vectorBuffer = Buffer.from(row.vector, 'base64');
        const vector = deserializeGhostVector(vectorBuffer);

        // VERSION CHECK
        if (row.version !== currentVersion) {
          logger.warn('Ghost version mismatch (Postgres)', {
            userId,
            tenantId,
            oldVersion: row.version,
            currentVersion,
          });

          const handled = await this.handleVersionMismatch(
            userId,
            tenantId,
            { vector: Array.from(vector), version: row.version, turnCount: row.turn_count },
            currentVersion
          );

          return {
            found: handled !== null,
            vector: handled,
            version: handled ? currentVersion : null,
            turnCount: 0,
            versionMatch: false,
            source: 'postgres',
            latencyMs: Date.now() - startTime,
          };
        }

        // Cache in Redis for next time
        await this.cacheGhost(userId, tenantId, vector, row.version, row.turn_count);

        return {
          found: true,
          vector,
          version: row.version,
          turnCount: row.turn_count,
          versionMatch: true,
          source: 'postgres',
          latencyMs: Date.now() - startTime,
        };
      }
    } catch (error) {
      logger.error(`Postgres ghost load failed: ${String(error)}`);
    }

    // Cold start - no ghost found
    return {
      found: false,
      vector: null,
      version: null,
      turnCount: 0,
      versionMatch: false,
      source: 'none',
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Handle version mismatch - Cold start or migrate
   */
  private async handleVersionMismatch(
    userId: string,
    tenantId: string,
    oldRecord: { vector: number[]; version: string; turnCount: number },
    currentVersion: string
  ): Promise<Float32Array | null> {
    const migrationEnabled = await brainConfigService.getBoolean('GHOST_MIGRATION_ENABLED', true);

    if (migrationEnabled) {
      // For now, we do cold start. Future: implement migration
      logger.info('Ghost migration not yet implemented, performing cold start', {
        userId,
        tenantId,
        oldVersion: oldRecord.version,
        newVersion: currentVersion,
      });
    }

    // Default: Cold start - delete old ghost
    await this.deleteGhost(userId, tenantId);
    return null;
  }

  // ===========================================================================
  // Save Ghost Vector
  // ===========================================================================

  /**
   * Save ghost vector (dual-write: Redis + Postgres)
   */
  async saveGhost(
    userId: string,
    tenantId: string,
    vector: Float32Array,
    version: string,
    isReanchor: boolean = false
  ): Promise<void> {
    const turnCount = isReanchor ? 0 : await this.incrementTurnCount(userId, tenantId);

    // Save to Redis
    await this.cacheGhost(userId, tenantId, vector, version, turnCount);

    // Save to Postgres
    try {
      const vectorBuffer = serializeGhostVector(vector);
      const vectorBase64 = vectorBuffer.toString('base64');

      await executeStatement(
        `INSERT INTO ghost_vectors (user_id, tenant_id, vector, version, turn_count, last_reanchor_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (user_id, tenant_id) DO UPDATE SET
           vector = EXCLUDED.vector,
           version = EXCLUDED.version,
           turn_count = EXCLUDED.turn_count,
           last_reanchor_at = CASE WHEN $6 IS NOT NULL THEN EXCLUDED.last_reanchor_at ELSE ghost_vectors.last_reanchor_at END,
           updated_at = NOW()`,
        [
          { name: 'userId', value: { stringValue: userId } },
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'vector', value: { stringValue: vectorBase64 } },
          { name: 'version', value: { stringValue: version } },
          { name: 'turnCount', value: { longValue: turnCount } },
          { name: 'reanchorAt', value: isReanchor ? { stringValue: new Date().toISOString() } : { isNull: true } },
        ]
      );
    } catch (error) {
      logger.error(`Failed to save ghost to Postgres: ${String(error)}`);
      throw error;
    }
  }

  /**
   * Cache ghost in Redis
   */
  private async cacheGhost(
    userId: string,
    tenantId: string,
    vector: Float32Array,
    version: string,
    turnCount: number
  ): Promise<void> {
    if (!this.redis) return;

    try {
      const redisKey = buildGhostRedisKey(tenantId, userId);
      const data = JSON.stringify({
        vector: Array.from(vector),
        version,
        turnCount,
        cachedAt: new Date().toISOString(),
      });

      await this.redis.set(redisKey, data, { EX: GHOST_REDIS_TTL_SECONDS });
    } catch (error) {
      logger.warn(`Failed to cache ghost in Redis: ${String(error)}`);
    }
  }

  // ===========================================================================
  // Re-anchoring
  // ===========================================================================

  /**
   * Check if re-anchor needed with JITTER - CRITICAL
   */
  async checkReAnchorNeeded(userId: string, tenantId: string): Promise<boolean> {
    const [baseTurnInterval, jitterRange, entropyThreshold] = await Promise.all([
      brainConfigService.getNumber('GHOST_REANCHOR_INTERVAL', 15),
      brainConfigService.getNumber('GHOST_JITTER_RANGE', 3),
      brainConfigService.getNumber('GHOST_ENTROPY_THRESHOLD', 0.3),
    ]);

    const turnCount = await this.getTurnCount(userId, tenantId);

    // Deterministic jitter based on user ID hash
    const jitter = this.deterministicJitter(userId, jitterRange);
    const targetTurn = baseTurnInterval + jitter; // e.g., 12-18

    logger.debug('Re-anchor check', {
      userId,
      turnCount,
      baseTurnInterval,
      jitter,
      targetTurn,
      needsReanchor: turnCount >= targetTurn,
    });

    return turnCount >= targetTurn;
  }

  /**
   * Deterministic jitter to prevent thundering herd
   */
  private deterministicJitter(userId: string, range: number): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash |= 0; // Convert to 32-bit integer
    }
    return (Math.abs(hash) % (range * 2 + 1)) - range; // -range to +range
  }

  /**
   * Perform async re-anchor (fire-and-forget)
   */
  async reAnchorAsync(
    userId: string,
    tenantId: string,
    conversationHistory: string[],
    captureFunction: (history: string[]) => Promise<Float32Array>
  ): Promise<void> {
    // Fire-and-forget - don't await
    this.performReAnchor(userId, tenantId, conversationHistory, captureFunction)
      .catch(error => {
        logger.error(`Async re-anchor failed: ${String(error)}`);
      });
  }

  /**
   * Perform re-anchor synchronously
   */
  async reAnchorSync(
    userId: string,
    tenantId: string,
    conversationHistory: string[],
    captureFunction: (history: string[]) => Promise<Float32Array>
  ): Promise<ReAnchorResult> {
    return this.performReAnchor(userId, tenantId, conversationHistory, captureFunction);
  }

  /**
   * Internal re-anchor implementation
   */
  private async performReAnchor(
    userId: string,
    tenantId: string,
    conversationHistory: string[],
    captureFunction: (history: string[]) => Promise<Float32Array>
  ): Promise<ReAnchorResult> {
    const startTime = Date.now();

    try {
      const currentVersion = await brainConfigService.getString('GHOST_CURRENT_VERSION', 'llama3-70b-v1');

      // Capture new ghost vector
      const newVector = await captureFunction(conversationHistory);

      // Validate vector dimension
      if (newVector.length !== GHOST_VECTOR_DIMENSION) {
        throw new Error(`Invalid ghost vector dimension: ${newVector.length}, expected ${GHOST_VECTOR_DIMENSION}`);
      }

      // Save with re-anchor flag
      await this.saveGhost(userId, tenantId, newVector, currentVersion, true);

      logger.info('Ghost re-anchored', {
        userId,
        tenantId,
        latencyMs: Date.now() - startTime,
      });

      return {
        success: true,
        newVector,
        capturedAt: new Date(),
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error(`Re-anchor failed: ${String(error)}`);
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        error: String(error),
      };
    }
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Get current turn count
   */
  async getTurnCount(userId: string, tenantId: string): Promise<number> {
    // Try Redis first
    if (this.redis) {
      try {
        const redisKey = buildGhostRedisKey(tenantId, userId);
        const data = await this.redis.get(redisKey);
        if (data) {
          const record = JSON.parse(data);
          return record.turnCount || 0;
        }
      } catch {
        // Fall through to Postgres
      }
    }

    // Try Postgres
    try {
      const result = await executeStatement(
        `SELECT turn_count FROM ghost_vectors WHERE user_id = $1 AND tenant_id = $2`,
        [
          { name: 'userId', value: { stringValue: userId } },
          { name: 'tenantId', value: { stringValue: tenantId } },
        ]
      );

      if (result.rows.length > 0) {
        return (result.rows[0] as { turn_count: number }).turn_count;
      }
    } catch (error) {
      logger.warn(`Failed to get turn count: ${String(error)}`);
    }

    return 0;
  }

  /**
   * Increment turn count
   */
  async incrementTurnCount(userId: string, tenantId: string): Promise<number> {
    try {
      const result = await executeStatement(
        `UPDATE ghost_vectors 
         SET turn_count = turn_count + 1, updated_at = NOW()
         WHERE user_id = $1 AND tenant_id = $2
         RETURNING turn_count`,
        [
          { name: 'userId', value: { stringValue: userId } },
          { name: 'tenantId', value: { stringValue: tenantId } },
        ]
      );

      if (result.rows.length > 0) {
        const newCount = (result.rows[0] as { turn_count: number }).turn_count;
        
        // Update Redis cache too
        if (this.redis) {
          const redisKey = buildGhostRedisKey(tenantId, userId);
          const data = await this.redis.get(redisKey);
          if (data) {
            const record = JSON.parse(data);
            record.turnCount = newCount;
            await this.redis.set(redisKey, JSON.stringify(record), { EX: GHOST_REDIS_TTL_SECONDS });
          }
        }
        
        return newCount;
      }
    } catch (error) {
      logger.warn(`Failed to increment turn count: ${String(error)}`);
    }

    return 0;
  }

  /**
   * Delete ghost vector
   */
  async deleteGhost(userId: string, tenantId: string): Promise<void> {
    // Delete from Redis
    if (this.redis) {
      try {
        const redisKey = buildGhostRedisKey(tenantId, userId);
        await this.redis.del(redisKey);
      } catch (error) {
        logger.warn(`Failed to delete ghost from Redis: ${String(error)}`);
      }
    }

    // Delete from Postgres
    try {
      await executeStatement(
        `DELETE FROM ghost_vectors WHERE user_id = $1 AND tenant_id = $2`,
        [
          { name: 'userId', value: { stringValue: userId } },
          { name: 'tenantId', value: { stringValue: tenantId } },
        ]
      );
    } catch (error) {
      logger.warn(`Failed to delete ghost from Postgres: ${String(error)}`);
    }
  }

  // ===========================================================================
  // Statistics
  // ===========================================================================

  /**
   * Get ghost statistics for monitoring
   */
  async getStats(tenantId?: string): Promise<GhostStats> {
    try {
      let whereClause = '';
      const params: Array<{ name: string; value: { stringValue: string } }> = [];

      if (tenantId) {
        whereClause = 'WHERE tenant_id = $1';
        params.push({ name: 'tenantId', value: { stringValue: tenantId } });
      }

      const result = await executeStatement(
        `SELECT 
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '24 hours') as active,
           AVG(turn_count) as avg_turn_count,
           AVG(EXTRACT(EPOCH FROM (NOW() - COALESCE(last_reanchor_at, captured_at))) / 3600) as avg_hours_since_reanchor,
           version,
           COUNT(*) as version_count
         FROM ghost_vectors
         ${whereClause}
         GROUP BY version`,
        params
      );

      let totalGhosts = 0;
      let activeGhosts = 0;
      let avgTurnCount = 0;
      let avgTimeSinceReanchor = 0;
      const versionDistribution: Record<string, number> = {};

      for (const row of result.rows) {
        const r = row as Record<string, unknown>;
        totalGhosts += Number(r.total);
        activeGhosts += Number(r.active);
        avgTurnCount = Number(r.avg_turn_count);
        avgTimeSinceReanchor = Number(r.avg_hours_since_reanchor);
        versionDistribution[r.version as string] = Number(r.version_count);
      }

      return {
        totalGhosts,
        activeGhosts,
        avgTurnCount,
        avgTimeSinceReanchor,
        versionDistribution,
        migrationsPending: 0, // TODO: implement migration tracking
      };
    } catch (error) {
      logger.error(`Failed to get ghost stats: ${String(error)}`);
      return {
        totalGhosts: 0,
        activeGhosts: 0,
        avgTurnCount: 0,
        avgTimeSinceReanchor: 0,
        versionDistribution: {},
        migrationsPending: 0,
      };
    }
  }

  /**
   * Health check for a specific user's ghost
   */
  async healthCheck(userId: string, tenantId: string): Promise<GhostHealthCheck> {
    const issues: GhostHealthCheck['issues'] = [];
    const currentVersion = await brainConfigService.getString('GHOST_CURRENT_VERSION', 'llama3-70b-v1');

    // Load ghost to check
    const loadResult = await this.loadGhost(userId, tenantId);

    if (!loadResult.found) {
      return {
        userId,
        tenantId,
        healthy: true, // No ghost is fine - cold start
        issues: [],
        lastAccess: null,
        turnsSinceReanchor: 0,
      };
    }

    // Check version mismatch
    if (!loadResult.versionMatch) {
      issues.push('version_mismatch');
    }

    // Check high turn count (needs re-anchor)
    const baseTurnInterval = await brainConfigService.getNumber('GHOST_REANCHOR_INTERVAL', 15);
    if (loadResult.turnCount > baseTurnInterval * 2) {
      issues.push('high_entropy');
    }

    return {
      userId,
      tenantId,
      healthy: issues.length === 0,
      issues,
      lastAccess: new Date(),
      turnsSinceReanchor: loadResult.turnCount,
    };
  }
}

// Export singleton instance
export const ghostManagerService = new GhostManagerService();

// Export class for testing
export { GhostManagerService };
