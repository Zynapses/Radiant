/**
 * Predictive Memory Prefetch Service v1.0.0
 * 
 * Learns from memory access patterns (what was needed, when, in what context)
 * and predicts what memories will be needed BEFORE the user asks. Pre-warms
 * the cache so recall latency drops to near-zero.
 * 
 * Claude retrieves on-demand. RADIANT anticipates.
 * 
 * Architecture:
 * ┌──────────────────┐
 * │  Session Start /   │
 * │  New Message       │
 * └────────┬──────────┘
 *          ▼
 * ┌──────────────────┐
 * │  Feature Extraction │
 * │  - hour_of_day     │
 * │  - day_of_week     │
 * │  - recent_topics   │
 * │  - session_age     │
 * │  - last_accessed   │
 * └────────┬──────────┘
 *          ▼
 * ┌──────────────────┐
 * │  Prediction Model  │  ← Collaborative filtering + temporal patterns
 * │  (PostgreSQL-based) │
 * └────────┬──────────┘
 *          ▼
 * ┌──────────────────┐
 * │  Prefetch Cache    │  ← Pre-warm AKG nodes in memory
 * │  (in-memory LRU)   │
 * └──────────────────┘
 * 
 * The prediction model uses a simple but effective approach:
 * 1. Temporal patterns: "What nodes does this user access at this time?"
 * 2. Topic co-occurrence: "When topic X is active, what other nodes are needed?"
 * 3. Sequential patterns: "After accessing node A, what comes next?"
 */

import { executeStatement, stringParam, doubleParam } from '../db/client';
import { createRegisteredLogger } from './logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'predictive/prefetch',
  category: 'infrastructure',
  sourceType: 'application',
});

import type {
  MemoryAccessPattern,
  PrefetchPrediction,
  PrefetchFeatures,
  PrefetchConfig,
} from '@radiant/shared';

// =============================================================================
// In-Memory Prefetch Cache
// =============================================================================

interface PrefetchCacheEntry {
  nodeIds: string[];
  contextSummary: string;
  loadedAt: number;
  ttlMs: number;
}

const prefetchCache = new Map<string, PrefetchCacheEntry>();

function getPrefetchCacheKey(tenantId: string, userId: string): string {
  return `${tenantId}:${userId}`;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_PREFETCH_CONFIG: Omit<PrefetchConfig, 'tenantId' | 'createdAt' | 'updatedAt'> = {
  enabled: true,
  maxPrefetchNodes: 20,
  minPrefetchConfidence: 0.60,
  predictionIntervalSec: 30,
  useTemporalFeatures: true,
  useTopicFeatures: true,
  maxCacheSize: 200,
  cacheTtlSec: 300,
};

// =============================================================================
// Predictive Prefetch Service
// =============================================================================

class PredictivePrefetchService {
  private configCache = new Map<string, { config: PrefetchConfig; loadedAt: number }>();
  private readonly CONFIG_CACHE_TTL = 5 * 60 * 1000;

  // ===========================================================================
  // Configuration
  // ===========================================================================

  async getConfig(tenantId: string): Promise<PrefetchConfig> {
    const cached = this.configCache.get(tenantId);
    if (cached && Date.now() - cached.loadedAt < this.CONFIG_CACHE_TTL) {
      return cached.config;
    }

    try {
      const result = await executeStatement(
        `SELECT * FROM prefetch_config WHERE tenant_id = $1`,
        [stringParam('tenantId', tenantId)]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0] as Record<string, unknown>;
        const config: PrefetchConfig = {
          tenantId,
          enabled: Boolean(row.enabled ?? true),
          maxPrefetchNodes: Number(row.max_prefetch_nodes || 20),
          minPrefetchConfidence: Number(row.min_prefetch_confidence || 0.60),
          predictionIntervalSec: Number(row.prediction_interval_sec || 30),
          useTemporalFeatures: Boolean(row.use_temporal_features ?? true),
          useTopicFeatures: Boolean(row.use_topic_features ?? true),
          maxCacheSize: Number(row.max_cache_size || 200),
          cacheTtlSec: Number(row.cache_ttl_sec || 300),
          createdAt: new Date(row.created_at as string),
          updatedAt: new Date(row.updated_at as string),
        };
        this.configCache.set(tenantId, { config, loadedAt: Date.now() });
        return config;
      }
    } catch (error) {
      logger.warn('Failed to load prefetch config', { tenantId, error: String(error) });
    }

    const config: PrefetchConfig = {
      tenantId,
      ...DEFAULT_PREFETCH_CONFIG,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.configCache.set(tenantId, { config, loadedAt: Date.now() });
    return config;
  }

  async updateConfig(tenantId: string, updates: Partial<PrefetchConfig>): Promise<PrefetchConfig> {
    const current = await this.getConfig(tenantId);
    const updated = { ...current, ...updates, tenantId };

    await executeStatement(
      `INSERT INTO prefetch_config (
        tenant_id, enabled, max_prefetch_nodes, min_prefetch_confidence,
        prediction_interval_sec, use_temporal_features, use_topic_features,
        max_cache_size, cache_ttl_sec
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (tenant_id) DO UPDATE SET
        enabled = $2, max_prefetch_nodes = $3, min_prefetch_confidence = $4,
        prediction_interval_sec = $5, use_temporal_features = $6,
        use_topic_features = $7, max_cache_size = $8, cache_ttl_sec = $9, updated_at = NOW()`,
      [
        stringParam('tenantId', tenantId),
        { name: 'enabled', value: { booleanValue: updated.enabled } },
        { name: 'maxNodes', value: { longValue: updated.maxPrefetchNodes } },
        doubleParam('minConf', updated.minPrefetchConfidence),
        { name: 'interval', value: { longValue: updated.predictionIntervalSec } },
        { name: 'temporal', value: { booleanValue: updated.useTemporalFeatures } },
        { name: 'topic', value: { booleanValue: updated.useTopicFeatures } },
        { name: 'cacheSize', value: { longValue: updated.maxCacheSize } },
        { name: 'ttl', value: { longValue: updated.cacheTtlSec } },
      ]
    );

    this.configCache.delete(tenantId);
    return { ...updated, updatedAt: new Date() };
  }

  // ===========================================================================
  // Access Pattern Recording
  // ===========================================================================

  /**
   * Record a memory access pattern for training the prediction model.
   * Called whenever AKG nodes are accessed during prompt building.
   */
  async recordAccessPattern(
    tenantId: string,
    userId: string,
    accessedNodeIds: string[],
    triggerPromptHash: string,
    topicContext: string[],
    sessionDurationSec: number,
  ): Promise<void> {
    const now = new Date();

    try {
      await executeStatement(
        `INSERT INTO memory_access_patterns (
          tenant_id, user_id, accessed_node_ids, trigger_prompt_hash,
          hour_of_day, day_of_week, topic_context, session_duration_sec,
          was_useful, retrieval_latency_ms
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, 0)`,
        [
          stringParam('tenantId', tenantId),
          stringParam('userId', userId),
          stringParam('nodeIds', `{${accessedNodeIds.join(',')}}`),
          stringParam('promptHash', triggerPromptHash),
          { name: 'hour', value: { longValue: now.getUTCHours() } },
          { name: 'dow', value: { longValue: now.getUTCDay() } },
          stringParam('topics', `{${topicContext.map(t => `"${t.replace(/"/g, '\\"')}"`).join(',')}}`),
          { name: 'duration', value: { longValue: sessionDurationSec } },
        ]
      );
    } catch (error) {
      logger.warn('Failed to record access pattern', { tenantId, userId, error: String(error) });
    }
  }

  // ===========================================================================
  // Prediction Engine
  // ===========================================================================

  /**
   * Generate prefetch predictions for a user based on current context.
   * Uses collaborative filtering on access patterns.
   */
  async predict(
    tenantId: string,
    userId: string,
    currentTopics: string[],
    lastAccessedNodeIds: string[],
  ): Promise<PrefetchPrediction> {
    const startTime = Date.now();
    const config = await this.getConfig(tenantId);
    const now = new Date();

    const features: PrefetchFeatures = {
      hourOfDay: now.getUTCHours(),
      dayOfWeek: now.getUTCDay(),
      recentTopics: currentTopics,
      sessionAge: 0,
      lastAccessedNodeIds,
      userActivityLevel: 'medium',
    };

    if (!config.enabled) {
      return this.emptyPrediction(tenantId, userId, features, startTime);
    }

    try {
      // Strategy 1: Temporal patterns — what does this user access at this time?
      const temporalNodes = config.useTemporalFeatures
        ? await this.predictByTemporalPattern(tenantId, userId, features.hourOfDay, features.dayOfWeek)
        : [];

      // Strategy 2: Topic co-occurrence — given current topics, what nodes are related?
      const topicNodes = config.useTopicFeatures && currentTopics.length > 0
        ? await this.predictByTopicCooccurrence(tenantId, userId, currentTopics)
        : [];

      // Strategy 3: Sequential pattern — after accessing X, what comes next?
      const sequentialNodes = lastAccessedNodeIds.length > 0
        ? await this.predictBySequentialPattern(tenantId, userId, lastAccessedNodeIds)
        : [];

      // Merge predictions with weighted scoring
      const scoreMap = new Map<string, number>();

      for (const { nodeId, score } of temporalNodes) {
        scoreMap.set(nodeId, (scoreMap.get(nodeId) || 0) + score * 0.3);
      }
      for (const { nodeId, score } of topicNodes) {
        scoreMap.set(nodeId, (scoreMap.get(nodeId) || 0) + score * 0.4);
      }
      for (const { nodeId, score } of sequentialNodes) {
        scoreMap.set(nodeId, (scoreMap.get(nodeId) || 0) + score * 0.3);
      }

      // Sort by score, filter by confidence, limit
      const sorted = Array.from(scoreMap.entries())
        .sort((a, b) => b[1] - a[1])
        .filter(([, score]) => score >= config.minPrefetchConfidence)
        .slice(0, config.maxPrefetchNodes);

      const predictedNodeIds = sorted.map(([id]) => id);
      const confidences = sorted.map(([, score]) => Math.min(1.0, score));

      // Store prediction for feedback loop
      const predictionId = crypto.randomUUID();
      await this.storePrediction(tenantId, userId, predictionId, predictedNodeIds, confidences, features, Date.now() - startTime);

      // Update prefetch cache
      this.updatePrefetchCache(tenantId, userId, predictedNodeIds, config.cacheTtlSec);

      logger.info('Prefetch prediction generated', {
        tenantId, userId,
        predictedCount: predictedNodeIds.length,
        latencyMs: Date.now() - startTime,
      });

      return {
        predictionId,
        tenantId,
        userId,
        predictedNodeIds,
        confidences,
        features,
        predictionLatencyMs: Date.now() - startTime,
        createdAt: new Date(),
      };

    } catch (error) {
      logger.error('Prefetch prediction failed', { tenantId, userId, error: String(error) });
      return this.emptyPrediction(tenantId, userId, features, startTime);
    }
  }

  /**
   * Get prefetched nodes for a user (from cache).
   */
  getPrefetchedNodes(tenantId: string, userId: string): string[] | null {
    const key = getPrefetchCacheKey(tenantId, userId);
    const cached = prefetchCache.get(key);

    if (!cached) return null;
    if (Date.now() - cached.loadedAt > cached.ttlMs) {
      prefetchCache.delete(key);
      return null;
    }

    return cached.nodeIds;
  }

  /**
   * Mark a prediction as used (for feedback loop training).
   */
  async markPredictionUsed(predictionId: string, tenantId: string): Promise<void> {
    try {
      await executeStatement(
        `UPDATE prefetch_predictions SET was_used = true WHERE prediction_id = $1 AND tenant_id = $2`,
        [stringParam('id', predictionId), stringParam('tenantId', tenantId)]
      );
    } catch (error) {
      logger.warn('Failed to mark prediction as used', { predictionId, error: String(error) });
    }
  }

  // ===========================================================================
  // Prediction Strategies
  // ===========================================================================

  /**
   * Strategy 1: Temporal pattern — what does this user typically access at this time?
   */
  private async predictByTemporalPattern(
    tenantId: string, userId: string, hourOfDay: number, dayOfWeek: number,
  ): Promise<Array<{ nodeId: string; score: number }>> {
    try {
      // Find nodes frequently accessed at similar times (±2 hours, same day type)
      const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
      const result = await executeStatement(
        `SELECT unnest(accessed_node_ids) as node_id, COUNT(*) as freq
         FROM memory_access_patterns
         WHERE tenant_id = $1 AND user_id = $2
         AND ABS(hour_of_day - $3) <= 2
         AND (($4 = true AND day_of_week BETWEEN 1 AND 5) OR ($4 = false AND day_of_week IN (0, 6)))
         AND created_at > NOW() - INTERVAL '30 days'
         GROUP BY node_id
         ORDER BY freq DESC
         LIMIT 20`,
        [
          stringParam('tenantId', tenantId),
          stringParam('userId', userId),
          { name: 'hour', value: { longValue: hourOfDay } },
          { name: 'isWeekday', value: { booleanValue: isWeekday } },
        ]
      );

      const maxFreq = result.rows.length > 0
        ? Math.max(...result.rows.map(r => Number((r as Record<string, unknown>).freq || 1)))
        : 1;

      return result.rows.map(row => {
        const r = row as Record<string, unknown>;
        return {
          nodeId: String(r.node_id),
          score: Number(r.freq || 0) / maxFreq,
        };
      });
    } catch (error) {
      logger.warn('Temporal prediction failed', { error: String(error) });
      return [];
    }
  }

  /**
   * Strategy 2: Topic co-occurrence — what nodes appear when these topics are active?
   */
  private async predictByTopicCooccurrence(
    tenantId: string, userId: string, currentTopics: string[],
  ): Promise<Array<{ nodeId: string; score: number }>> {
    try {
      const result = await executeStatement(
        `SELECT unnest(accessed_node_ids) as node_id, COUNT(*) as freq
         FROM memory_access_patterns
         WHERE tenant_id = $1 AND user_id = $2
         AND topic_context && $3
         AND created_at > NOW() - INTERVAL '30 days'
         GROUP BY node_id
         ORDER BY freq DESC
         LIMIT 20`,
        [
          stringParam('tenantId', tenantId),
          stringParam('userId', userId),
          stringParam('topics', `{${currentTopics.map(t => `"${t.replace(/"/g, '\\"')}"`).join(',')}}`),
        ]
      );

      const maxFreq = result.rows.length > 0
        ? Math.max(...result.rows.map(r => Number((r as Record<string, unknown>).freq || 1)))
        : 1;

      return result.rows.map(row => {
        const r = row as Record<string, unknown>;
        return {
          nodeId: String(r.node_id),
          score: Number(r.freq || 0) / maxFreq,
        };
      });
    } catch (error) {
      logger.warn('Topic co-occurrence prediction failed', { error: String(error) });
      return [];
    }
  }

  /**
   * Strategy 3: Sequential pattern — after accessing these nodes, what comes next?
   */
  private async predictBySequentialPattern(
    tenantId: string, userId: string, lastAccessedNodeIds: string[],
  ): Promise<Array<{ nodeId: string; score: number }>> {
    try {
      // Find patterns where lastAccessedNodeIds appeared, then get what came after
      const result = await executeStatement(
        `WITH recent_patterns AS (
          SELECT accessed_node_ids, created_at,
                 LAG(accessed_node_ids) OVER (ORDER BY created_at) as prev_nodes
          FROM memory_access_patterns
          WHERE tenant_id = $1 AND user_id = $2
          AND created_at > NOW() - INTERVAL '30 days'
          ORDER BY created_at
        )
        SELECT unnest(accessed_node_ids) as node_id, COUNT(*) as freq
        FROM recent_patterns
        WHERE prev_nodes && $3
        GROUP BY node_id
        ORDER BY freq DESC
        LIMIT 20`,
        [
          stringParam('tenantId', tenantId),
          stringParam('userId', userId),
          stringParam('lastNodes', `{${lastAccessedNodeIds.join(',')}}`),
        ]
      );

      const maxFreq = result.rows.length > 0
        ? Math.max(...result.rows.map(r => Number((r as Record<string, unknown>).freq || 1)))
        : 1;

      return result.rows.map(row => {
        const r = row as Record<string, unknown>;
        return {
          nodeId: String(r.node_id),
          score: Number(r.freq || 0) / maxFreq,
        };
      });
    } catch (error) {
      logger.warn('Sequential prediction failed', { error: String(error) });
      return [];
    }
  }

  // ===========================================================================
  // Cache Management
  // ===========================================================================

  private updatePrefetchCache(tenantId: string, userId: string, nodeIds: string[], ttlSec: number): void {
    const key = getPrefetchCacheKey(tenantId, userId);
    prefetchCache.set(key, {
      nodeIds,
      contextSummary: '',
      loadedAt: Date.now(),
      ttlMs: ttlSec * 1000,
    });

    // Evict oldest entries if cache is too large
    if (prefetchCache.size > 1000) {
      const entries = Array.from(prefetchCache.entries());
      entries.sort((a, b) => a[1].loadedAt - b[1].loadedAt);
      for (let i = 0; i < 100; i++) {
        prefetchCache.delete(entries[i][0]);
      }
    }
  }

  // ===========================================================================
  // Persistence & Stats
  // ===========================================================================

  private async storePrediction(
    tenantId: string, userId: string, predictionId: string,
    predictedNodeIds: string[], confidences: number[],
    features: PrefetchFeatures, latencyMs: number,
  ): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO prefetch_predictions (
          prediction_id, tenant_id, user_id, predicted_node_ids, confidences,
          features, prediction_latency_ms
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          stringParam('id', predictionId),
          stringParam('tenantId', tenantId),
          stringParam('userId', userId),
          stringParam('nodeIds', `{${predictedNodeIds.join(',')}}`),
          stringParam('confs', `{${confidences.join(',')}}`),
          stringParam('features', JSON.stringify(features)),
          { name: 'latency', value: { longValue: latencyMs } },
        ]
      );
    } catch (error) {
      logger.warn('Failed to store prefetch prediction', { error: String(error) });
    }
  }

  async getStats(tenantId: string): Promise<{
    totalPredictions: number;
    predictionAccuracy: number;
    avgPrefetchLatencyMs: number;
    cacheHitRate: number;
    memoriesPrefetched: number;
  }> {
    try {
      const result = await executeStatement(
        `SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE was_used = true)::DECIMAL / NULLIF(COUNT(*), 0) as accuracy,
          AVG(prediction_latency_ms) as avg_latency,
          SUM(array_length(predicted_node_ids, 1)) as total_prefetched
        FROM prefetch_predictions
        WHERE tenant_id = $1
        AND created_at > NOW() - INTERVAL '24 hours'`,
        [stringParam('tenantId', tenantId)]
      );

      const row = result.rows[0] as Record<string, unknown>;
      return {
        totalPredictions: Number(row.total || 0),
        predictionAccuracy: Number(row.accuracy || 0),
        avgPrefetchLatencyMs: Number(row.avg_latency || 0),
        cacheHitRate: Number(row.accuracy || 0),
        memoriesPrefetched: Number(row.total_prefetched || 0),
      };
    } catch (error) {
      logger.error('Failed to get prefetch stats', { tenantId, error: String(error) });
      return { totalPredictions: 0, predictionAccuracy: 0, avgPrefetchLatencyMs: 0, cacheHitRate: 0, memoriesPrefetched: 0 };
    }
  }

  private emptyPrediction(tenantId: string, userId: string, features: PrefetchFeatures, startTime: number): PrefetchPrediction {
    return {
      predictionId: crypto.randomUUID(),
      tenantId, userId,
      predictedNodeIds: [],
      confidences: [],
      features,
      predictionLatencyMs: Date.now() - startTime,
      createdAt: new Date(),
    };
  }
}

export const predictivePrefetchService = new PredictivePrefetchService();
