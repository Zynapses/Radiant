/**
 * RADIANT v5.4.0 - Ghost Vector Manager (PROMPT-40 Cognitive Architecture)
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
 * 
 * v5.4.0 Additions (PROMPT-40):
 * - TTL support (ttl_seconds) with 24h default
 * - Semantic key for deduplication
 * - Domain hint for compliance routing
 * - Retrieval confidence tracking
 * - Circuit breaker integration
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
import { getCognitiveMetrics } from './cognitive-metrics.service';

// v5.4.0 - Cognitive Architecture Types
export interface GhostMemoryEntry {
  semanticKey: string;
  content: string;
  domainHint?: string;
  ttlSeconds?: number;
  confidence?: number;
  sourceWorkflow?: string;
  metadata?: Record<string, unknown>;
}

export interface GhostReadResult {
  hit: boolean;
  content?: string;
  semanticKey?: string;
  confidence: number;
  domainHint?: string;
  ttlRemainingSeconds?: number;
  circuitBreakerFallback: boolean;
  latencyMs: number;
}

export interface CognitiveGhostOptions {
  ttlSeconds?: number;
  semanticKey?: string;
  domainHint?: string;
  retrievalConfidence?: number;
  sourceWorkflow?: string;
}

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
      // Attempt migration if versions are compatible
      const migratedVector = await this.migrateGhostVector(
        oldRecord.vector,
        oldRecord.version,
        currentVersion
      );

      if (migratedVector) {
        logger.info('Ghost vector migrated successfully', {
          userId,
          tenantId,
          oldVersion: oldRecord.version,
          newVersion: currentVersion,
        });

        // Save migrated vector with new version
        await this.saveGhost(userId, tenantId, migratedVector, currentVersion, false);
        return migratedVector;
      }

      logger.info('Ghost migration failed, performing cold start', {
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

  /**
   * Migrate ghost vector between model versions
   * 
   * Migration strategies:
   * 1. Same-family upgrade (e.g., llama3-70b-v1 -> llama3-70b-v2): 
   *    Direct transfer with optional normalization
   * 2. Same-dimension different-model:
   *    Apply learned projection matrix if available
   * 3. Different dimensions:
   *    Cold start required (return null)
   */
  private async migrateGhostVector(
    oldVector: number[],
    oldVersion: string,
    newVersion: string
  ): Promise<Float32Array | null> {
    // Check dimension compatibility
    if (oldVector.length !== GHOST_VECTOR_DIMENSION) {
      logger.warn('Ghost vector dimension mismatch, cold start required', {
        oldDimension: oldVector.length,
        expectedDimension: GHOST_VECTOR_DIMENSION,
      });
      return null;
    }

    // Parse version info (format: model-size-vN)
    const oldParts = oldVersion.split('-');
    const newParts = newVersion.split('-');

    // Extract model family (e.g., "llama3", "qwen2.5")
    const oldFamily = oldParts.slice(0, -1).join('-');
    const newFamily = newParts.slice(0, -1).join('-');

    // Same family upgrade - direct transfer with normalization
    if (oldFamily === newFamily) {
      logger.debug('Same-family ghost migration', { oldFamily, newFamily });
      return this.normalizeGhostVector(new Float32Array(oldVector));
    }

    // Check for pre-computed projection matrix
    const projectionMatrix = await this.loadProjectionMatrix(oldVersion, newVersion);
    if (projectionMatrix) {
      logger.debug('Applying projection matrix for ghost migration');
      return this.applyProjection(new Float32Array(oldVector), projectionMatrix);
    }

    // Different family, no projection - attempt semantic preservation
    // This uses a simple normalization that preserves relative magnitudes
    // It's lossy but better than cold start for maintaining context hints
    const semanticPreservation = await brainConfigService.getBoolean(
      'GHOST_SEMANTIC_PRESERVATION_ENABLED',
      true
    );

    if (semanticPreservation) {
      logger.debug('Applying semantic preservation migration');
      return this.semanticPreservationMigrate(new Float32Array(oldVector));
    }

    return null;
  }

  /**
   * Normalize ghost vector (L2 normalization)
   */
  private normalizeGhostVector(vector: Float32Array): Float32Array {
    let magnitude = 0;
    for (let i = 0; i < vector.length; i++) {
      magnitude += vector[i] * vector[i];
    }
    magnitude = Math.sqrt(magnitude);

    if (magnitude === 0) return vector;

    const normalized = new Float32Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
      normalized[i] = vector[i] / magnitude;
    }
    return normalized;
  }

  /**
   * Load projection matrix from database (if available)
   */
  private async loadProjectionMatrix(
    fromVersion: string,
    toVersion: string
  ): Promise<Float32Array[] | null> {
    try {
      const result = await executeStatement(
        `SELECT matrix_data FROM ghost_projection_matrices
         WHERE from_version = $1 AND to_version = $2
         AND is_active = true`,
        [
          { name: 'fromVersion', value: { stringValue: fromVersion } },
          { name: 'toVersion', value: { stringValue: toVersion } },
        ]
      );

      if (result.rows && result.rows.length > 0) {
        const row = result.rows[0] as Record<string, unknown>;
        const matrixString = row?.matrix_data as string | undefined;
        if (matrixString) {
          const parsed = JSON.parse(matrixString);
          return parsed.map((row: number[]) => new Float32Array(row));
        }
      }
    } catch {
      // Table may not exist yet, that's fine
    }
    return null;
  }

  /**
   * Apply projection matrix to transform vector
   */
  private applyProjection(
    vector: Float32Array,
    matrix: Float32Array[]
  ): Float32Array {
    const result = new Float32Array(matrix.length);
    for (let i = 0; i < matrix.length; i++) {
      let sum = 0;
      for (let j = 0; j < vector.length; j++) {
        sum += vector[j] * matrix[i][j];
      }
      result[i] = sum;
    }
    return this.normalizeGhostVector(result);
  }

  /**
   * Semantic preservation migration
   * Preserves relative importance of features while adapting to new space
   */
  private semanticPreservationMigrate(vector: Float32Array): Float32Array {
    // Apply softmax-like transformation to preserve relative magnitudes
    // while allowing the new model to reinterpret the context hints
    const result = new Float32Array(vector.length);
    
    // Find max for numerical stability
    let maxVal = -Infinity;
    for (let i = 0; i < vector.length; i++) {
      if (vector[i] > maxVal) maxVal = vector[i];
    }

    // Apply scaled transformation
    const scale = 0.5; // Reduce magnitude to allow new model to dominate
    for (let i = 0; i < vector.length; i++) {
      result[i] = (vector[i] - maxVal * 0.5) * scale;
    }

    return this.normalizeGhostVector(result);
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

      // Count ghosts needing migration (version != current version)
      const currentVersion = await brainConfigService.getString('GHOST_CURRENT_VERSION', 'llama3-70b-v1');
      const migrationResult = await executeStatement(
        `SELECT COUNT(*) as pending FROM ghost_vectors 
         WHERE version != $1 ${tenantId ? 'AND tenant_id = $2' : ''}`,
        tenantId 
          ? [{ name: 'v', value: { stringValue: currentVersion } }, { name: 't', value: { stringValue: tenantId } }]
          : [{ name: 'v', value: { stringValue: currentVersion } }]
      );
      const migrationsPending = Number((migrationResult.rows[0] as Record<string, unknown>)?.pending || 0);

      return {
        totalGhosts,
        activeGhosts,
        avgTurnCount,
        avgTimeSinceReanchor,
        versionDistribution,
        migrationsPending,
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

  // ===========================================================================
  // v5.4.0 - Cognitive Architecture Methods (PROMPT-40)
  // ===========================================================================

  /**
   * Read Ghost Memory by semantic key with circuit breaker fallback
   */
  async readGhostMemory(
    userId: string,
    tenantId: string,
    semanticKey: string
  ): Promise<GhostReadResult> {
    const startTime = Date.now();
    const metrics = getCognitiveMetrics(tenantId);

    try {
      // Try to find by semantic key
      const result = await executeStatement(
        `SELECT 
           semantic_key, vector, domain_hint, ttl_seconds, 
           retrieval_confidence, updated_at,
           EXTRACT(EPOCH FROM ((updated_at + (ttl_seconds || ' seconds')::interval) - NOW())) as ttl_remaining
         FROM ghost_vectors
         WHERE tenant_id = $1 
           AND user_id = $2 
           AND semantic_key = $3
           AND (ttl_seconds IS NULL OR ttl_seconds <= 0 OR 
                updated_at + (ttl_seconds || ' seconds')::interval > NOW())
         LIMIT 1`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'userId', value: { stringValue: userId } },
          { name: 'semanticKey', value: { stringValue: semanticKey } },
        ]
      );

      const latencyMs = Date.now() - startTime;

      if (result.rows && result.rows.length > 0) {
        const row = result.rows[0] as Record<string, unknown>;
        const confidence = Number(row.retrieval_confidence) || 1.0;

        await metrics.recordGhostHit({
          userId,
          semanticKey,
          confidence,
          domainHint: row.domain_hint as string,
          latencyMs,
        });

        // Update access stats
        await this.updateGhostAccessStats(userId, tenantId);

        return {
          hit: true,
          content: row.vector as string, // Content stored in vector field for semantic entries
          semanticKey: row.semantic_key as string,
          confidence,
          domainHint: row.domain_hint as string | undefined,
          ttlRemainingSeconds: Math.max(0, Math.floor(Number(row.ttl_remaining) || 0)),
          circuitBreakerFallback: false,
          latencyMs,
        };
      }

      await metrics.recordGhostMiss({
        userId,
        reason: 'not_found',
        latencyMs,
      });

      return {
        hit: false,
        confidence: 1.0,
        circuitBreakerFallback: false,
        latencyMs,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      logger.error(`Ghost Memory read failed: ${String(error)}`);

      await metrics.recordGhostMiss({
        userId,
        reason: 'error',
        latencyMs,
      });

      return {
        hit: false,
        confidence: 1.0,
        circuitBreakerFallback: true,
        latencyMs,
      };
    } finally {
      await metrics.flush();
    }
  }

  /**
   * Append to Ghost Memory with TTL and semantic key (non-blocking write-back)
   */
  async appendGhostMemory(
    userId: string,
    tenantId: string,
    entry: GhostMemoryEntry
  ): Promise<boolean> {
    const metrics = getCognitiveMetrics(tenantId);
    const ttlSeconds = entry.ttlSeconds ?? 86400; // 24h default

    try {
      const currentVersion = await brainConfigService.getString('GHOST_CURRENT_VERSION', 'llama3-70b-v1');

      await executeStatement(
        `INSERT INTO ghost_vectors (
           user_id, tenant_id, vector, version, semantic_key, 
           domain_hint, ttl_seconds, retrieval_confidence, 
           source_workflow, metadata, turn_count, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, NOW())
         ON CONFLICT (user_id, tenant_id) 
         WHERE semantic_key = $5
         DO UPDATE SET
           vector = EXCLUDED.vector,
           domain_hint = EXCLUDED.domain_hint,
           ttl_seconds = EXCLUDED.ttl_seconds,
           retrieval_confidence = EXCLUDED.retrieval_confidence,
           source_workflow = EXCLUDED.source_workflow,
           metadata = EXCLUDED.metadata,
           updated_at = NOW()`,
        [
          { name: 'userId', value: { stringValue: userId } },
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'content', value: { stringValue: entry.content } },
          { name: 'version', value: { stringValue: currentVersion } },
          { name: 'semanticKey', value: { stringValue: entry.semanticKey } },
          { name: 'domainHint', value: entry.domainHint ? { stringValue: entry.domainHint } : { isNull: true } },
          { name: 'ttlSeconds', value: { longValue: ttlSeconds } },
          { name: 'confidence', value: { doubleValue: entry.confidence ?? 1.0 } },
          { name: 'sourceWorkflow', value: entry.sourceWorkflow ? { stringValue: entry.sourceWorkflow } : { isNull: true } },
          { name: 'metadata', value: { stringValue: JSON.stringify(entry.metadata || {}) } },
        ]
      );

      await metrics.recordGhostWrite({
        userId,
        semanticKey: entry.semanticKey,
        ttlSeconds,
        domainHint: entry.domainHint,
        success: true,
      });

      logger.info('Ghost Memory entry written', {
        userId,
        tenantId,
        semanticKey: entry.semanticKey,
        domainHint: entry.domainHint,
        ttlSeconds,
      });

      return true;
    } catch (error) {
      logger.warn(`Ghost Memory write failed (non-blocking): ${String(error)}`);
      
      await metrics.recordGhostWriteFailure(userId, 'write_error');
      
      // Per PROMPT-40: "Log but don't fail - memory write is important but not blocking"
      return false;
    } finally {
      await metrics.flush();
    }
  }

  /**
   * Update access statistics for a ghost entry
   */
  private async updateGhostAccessStats(userId: string, tenantId: string): Promise<void> {
    try {
      await executeStatement(
        `UPDATE ghost_vectors 
         SET last_accessed_at = NOW(),
             access_count = COALESCE(access_count, 0) + 1
         WHERE user_id = $1 AND tenant_id = $2`,
        [
          { name: 'userId', value: { stringValue: userId } },
          { name: 'tenantId', value: { stringValue: tenantId } },
        ]
      );
    } catch (error) {
      logger.debug(`Failed to update ghost access stats: ${String(error)}`);
    }
  }

  /**
   * Clean up expired ghost entries
   */
  async cleanupExpiredGhosts(tenantId?: string, batchSize: number = 1000): Promise<number> {
    try {
      const result = await executeStatement(
        `WITH deleted AS (
           DELETE FROM ghost_vectors
           WHERE id IN (
             SELECT id FROM ghost_vectors
             WHERE ${tenantId ? 'tenant_id = $1 AND' : ''}
               ttl_seconds IS NOT NULL
               AND ttl_seconds > 0
               AND updated_at + (ttl_seconds || ' seconds')::interval < NOW()
             LIMIT ${batchSize}
           )
           RETURNING id
         )
         SELECT COUNT(*) as count FROM deleted`,
        tenantId ? [{ name: 'tenantId', value: { stringValue: tenantId } }] : []
      );

      const deletedCount = Number((result.rows[0] as Record<string, unknown>)?.count || 0);
      
      if (deletedCount > 0) {
        logger.info('Cleaned up expired ghost entries', { tenantId, deletedCount });
      }

      return deletedCount;
    } catch (error) {
      logger.error(`Failed to cleanup expired ghosts: ${String(error)}`);
      return 0;
    }
  }

  /**
   * Save ghost with cognitive options (TTL, semantic key, domain hint)
   */
  async saveGhostWithCognitive(
    userId: string,
    tenantId: string,
    vector: Float32Array,
    version: string,
    options: CognitiveGhostOptions = {}
  ): Promise<void> {
    const {
      ttlSeconds = 86400,
      semanticKey,
      domainHint,
      retrievalConfidence = 1.0,
      sourceWorkflow,
    } = options;

    const turnCount = await this.incrementTurnCount(userId, tenantId);

    // Save to Redis with TTL
    await this.cacheGhostWithCognitive(userId, tenantId, vector, version, turnCount, options);

    // Save to Postgres with cognitive fields
    try {
      const vectorBuffer = serializeGhostVector(vector);
      const vectorBase64 = vectorBuffer.toString('base64');

      await executeStatement(
        `INSERT INTO ghost_vectors (
           user_id, tenant_id, vector, version, turn_count, 
           ttl_seconds, semantic_key, domain_hint, retrieval_confidence, 
           source_workflow, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         ON CONFLICT (user_id, tenant_id) DO UPDATE SET
           vector = EXCLUDED.vector,
           version = EXCLUDED.version,
           turn_count = EXCLUDED.turn_count,
           ttl_seconds = EXCLUDED.ttl_seconds,
           semantic_key = COALESCE(EXCLUDED.semantic_key, ghost_vectors.semantic_key),
           domain_hint = COALESCE(EXCLUDED.domain_hint, ghost_vectors.domain_hint),
           retrieval_confidence = EXCLUDED.retrieval_confidence,
           source_workflow = EXCLUDED.source_workflow,
           updated_at = NOW()`,
        [
          { name: 'userId', value: { stringValue: userId } },
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'vector', value: { stringValue: vectorBase64 } },
          { name: 'version', value: { stringValue: version } },
          { name: 'turnCount', value: { longValue: turnCount } },
          { name: 'ttlSeconds', value: { longValue: ttlSeconds } },
          { name: 'semanticKey', value: semanticKey ? { stringValue: semanticKey } : { isNull: true } },
          { name: 'domainHint', value: domainHint ? { stringValue: domainHint } : { isNull: true } },
          { name: 'confidence', value: { doubleValue: retrievalConfidence } },
          { name: 'sourceWorkflow', value: sourceWorkflow ? { stringValue: sourceWorkflow } : { isNull: true } },
        ]
      );
    } catch (error) {
      logger.error(`Failed to save ghost with cognitive options: ${String(error)}`);
      throw error;
    }
  }

  /**
   * Cache ghost in Redis with cognitive options
   */
  private async cacheGhostWithCognitive(
    userId: string,
    tenantId: string,
    vector: Float32Array,
    version: string,
    turnCount: number,
    options: CognitiveGhostOptions
  ): Promise<void> {
    if (!this.redis) return;

    try {
      const redisKey = buildGhostRedisKey(tenantId, userId);
      const ttl = options.ttlSeconds ?? GHOST_REDIS_TTL_SECONDS;
      
      const data = JSON.stringify({
        vector: Array.from(vector),
        version,
        turnCount,
        semanticKey: options.semanticKey,
        domainHint: options.domainHint,
        retrievalConfidence: options.retrievalConfidence ?? 1.0,
        sourceWorkflow: options.sourceWorkflow,
        cachedAt: new Date().toISOString(),
      });

      await this.redis.set(redisKey, data, { EX: ttl });
    } catch (error) {
      logger.warn(`Failed to cache ghost with cognitive options: ${String(error)}`);
    }
  }
}

// Export singleton instance
export const ghostManagerService = new GhostManagerService();

// Export class for testing
export { GhostManagerService };
