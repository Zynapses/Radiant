/**
 * Semantic Cache Service
 * Reduces inference costs by caching responses for semantically similar queries.
 * RADIANT v6.1.0
 */

import type { SemanticCacheEntry, ContentType, CacheMetrics } from '@radiant/shared';
import { CACHE_TTL_CONFIGS, CACHE_SIMILARITY_THRESHOLD, CACHE_MAX_ENTRIES_PER_TENANT } from '@radiant/shared/constants';
import { getDbPool } from './database';
import { callLiteLLMEmbedding } from './litellm.service';

export class SemanticCacheService {
  private metricsBuffer: Map<string, { hits: number; misses: number }> = new Map();
  
  async get(
    query: string,
    tenantId: string,
    modelId: string,
    domainIds: string[],
    contextHash?: string
  ): Promise<SemanticCacheEntry | null> {
    const embedding = await this.generateEmbedding(query);
    const pool = await getDbPool();
    
    const result = await pool.query(`
      SELECT *, 1 - (query_embedding <=> $1::vector) as similarity
      FROM semantic_cache
      WHERE tenant_id = $2 AND model_id = $3 AND domain_ids @> $4
        AND (context_hash IS NULL OR context_hash = $5)
        AND expires_at > NOW() AND was_invalidated = FALSE
        AND 1 - (query_embedding <=> $1::vector) > $6
      ORDER BY similarity DESC LIMIT 1
    `, [JSON.stringify(embedding), tenantId, modelId, domainIds, contextHash, CACHE_SIMILARITY_THRESHOLD]);
    
    if (result.rows.length === 0) {
      this.recordMiss(tenantId);
      return null;
    }
    
    const entry = this.rowToEntry(result.rows[0]);
    await this.recordHit(entry.id, tenantId);
    return entry;
  }
  
  async set(
    query: string,
    response: string,
    tenantId: string,
    modelId: string,
    domainIds: string[],
    contentType: ContentType,
    contextHash?: string
  ): Promise<SemanticCacheEntry> {
    await this.enforceLimit(tenantId);
    
    const queryEmbedding = await this.generateEmbedding(query);
    const responseEmbedding = await this.generateEmbedding(response);
    
    const ttlConfig = CACHE_TTL_CONFIGS.find(c => c.contentType === contentType)!;
    const expiresAt = new Date(Date.now() + ttlConfig.baseTtlMinutes * 60 * 1000);
    
    const id = crypto.randomUUID();
    const pool = await getDbPool();
    
    await pool.query(`
      INSERT INTO semantic_cache (
        id, tenant_id, query_embedding, model_id, domain_ids,
        context_hash, response, response_embedding, expires_at, hit_count, created_at
      ) VALUES ($1, $2, $3::vector, $4, $5, $6, $7, $8::vector, $9, 0, NOW())
      ON CONFLICT (tenant_id, model_id, context_hash) 
      WHERE 1 - (query_embedding <=> $3::vector) > 0.99
      DO UPDATE SET response = EXCLUDED.response, expires_at = EXCLUDED.expires_at
    `, [id, tenantId, JSON.stringify(queryEmbedding), modelId, domainIds, 
        contextHash, response, JSON.stringify(responseEmbedding), expiresAt]);
    
    return {
      id, tenantId, queryEmbedding, modelId, domainIds,
      contextHash: contextHash || null, response, responseEmbedding,
      createdAt: new Date(), expiresAt, hitCount: 0, lastHitAt: null,
      userFeedbackAvg: null, feedbackCount: 0, wasInvalidated: false,
    };
  }
  
  async invalidate(
    tenantId: string,
    options: { modelId?: string; domainIds?: string[]; olderThan?: Date } = {}
  ): Promise<number> {
    const pool = await getDbPool();
    let query = `UPDATE semantic_cache SET was_invalidated = TRUE WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let idx = 2;
    
    if (options.modelId) { query += ` AND model_id = $${idx++}`; params.push(options.modelId); }
    if (options.domainIds?.length) { query += ` AND domain_ids && $${idx++}`; params.push(options.domainIds); }
    if (options.olderThan) { query += ` AND created_at < $${idx++}`; params.push(options.olderThan); }
    
    const result = await pool.query(query, params);
    return result.rowCount || 0;
  }
  
  async recordFeedback(entryId: string, tenantId: string, score: number): Promise<void> {
    const pool = await getDbPool();
    
    await pool.query(`
      UPDATE semantic_cache SET 
        user_feedback_avg = CASE WHEN feedback_count = 0 THEN $1
          ELSE (user_feedback_avg * feedback_count + $1) / (feedback_count + 1) END,
        feedback_count = feedback_count + 1
      WHERE id = $2 AND tenant_id = $3
    `, [score, entryId, tenantId]);
    
    if (score < 0.3) {
      await pool.query(`
        UPDATE semantic_cache SET expires_at = LEAST(expires_at, NOW() + INTERVAL '1 hour')
        WHERE id = $1
      `, [entryId]);
    }
  }
  
  async getMetrics(tenantId: string, periodDays: number = 7): Promise<CacheMetrics[]> {
    const pool = await getDbPool();
    const result = await pool.query(`
      SELECT * FROM semantic_cache_metrics
      WHERE tenant_id = $1 AND period_start > NOW() - INTERVAL '1 day' * $2
      ORDER BY period_start DESC
    `, [tenantId, periodDays]);
    
    return result.rows.map(row => ({
      tenantId: row.tenant_id,
      periodStart: new Date(row.period_start),
      periodEnd: new Date(row.period_end),
      totalRequests: row.total_requests,
      cacheHits: row.cache_hits,
      cacheMisses: row.cache_misses,
      hitRate: parseFloat(row.hit_rate),
      avgHitLatencyMs: row.avg_hit_latency_ms,
      avgMissLatencyMs: row.avg_miss_latency_ms,
      estimatedCostSaved: parseFloat(row.estimated_cost_saved),
    }));
  }
  
  async getStats(tenantId: string): Promise<{
    totalEntries: number;
    hitRate: number;
    estimatedCostSaved: number;
    avgHitLatencyMs: number;
  }> {
    const pool = await getDbPool();
    
    const countResult = await pool.query(`
      SELECT COUNT(*) as total FROM semantic_cache
      WHERE tenant_id = $1 AND was_invalidated = FALSE AND expires_at > NOW()
    `, [tenantId]);
    
    const metricsResult = await pool.query(`
      SELECT 
        SUM(cache_hits) as total_hits,
        SUM(cache_misses) as total_misses,
        SUM(estimated_cost_saved) as total_saved,
        AVG(avg_hit_latency_ms) as avg_latency
      FROM semantic_cache_metrics
      WHERE tenant_id = $1 AND period_start > NOW() - INTERVAL '7 days'
    `, [tenantId]);
    
    const metrics = metricsResult.rows[0];
    const totalHits = parseInt(metrics.total_hits) || 0;
    const totalMisses = parseInt(metrics.total_misses) || 0;
    const totalRequests = totalHits + totalMisses;
    
    return {
      totalEntries: parseInt(countResult.rows[0].total),
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      estimatedCostSaved: parseFloat(metrics.total_saved) || 0,
      avgHitLatencyMs: parseFloat(metrics.avg_latency) || 0,
    };
  }
  
  async cleanup(): Promise<number> {
    const pool = await getDbPool();
    const result = await pool.query(`
      DELETE FROM semantic_cache WHERE expires_at < NOW() OR was_invalidated = TRUE
    `);
    return result.rowCount || 0;
  }
  
  async flushMetricsBuffer(): Promise<void> {
    const pool = await getDbPool();
    const now = new Date();
    const periodStart = new Date(now.getTime() - 3600000);
    
    for (const [tenantId, counts] of this.metricsBuffer.entries()) {
      await pool.query(`
        INSERT INTO semantic_cache_metrics (
          id, tenant_id, period_start, period_end, total_requests, cache_hits, cache_misses,
          avg_hit_latency_ms, avg_miss_latency_ms, estimated_cost_saved
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 10, 500, $8)
        ON CONFLICT (tenant_id, period_start) DO UPDATE SET
          cache_hits = semantic_cache_metrics.cache_hits + EXCLUDED.cache_hits,
          cache_misses = semantic_cache_metrics.cache_misses + EXCLUDED.cache_misses,
          total_requests = semantic_cache_metrics.total_requests + EXCLUDED.total_requests
      `, [
        crypto.randomUUID(), tenantId, periodStart, now,
        counts.hits + counts.misses, counts.hits, counts.misses,
        counts.hits * 0.01,
      ]);
    }
    
    this.metricsBuffer.clear();
  }
  
  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await callLiteLLMEmbedding({ model: 'text-embedding-3-small', input: text });
    return response.data?.[0]?.embedding || [];
  }
  
  private async recordHit(entryId: string, tenantId: string): Promise<void> {
    const pool = await getDbPool();
    await pool.query(`
      UPDATE semantic_cache SET hit_count = hit_count + 1, last_hit_at = NOW(),
        expires_at = LEAST(expires_at + INTERVAL '1 hour', created_at + INTERVAL '30 days')
      WHERE id = $1
    `, [entryId]);
    
    const current = this.metricsBuffer.get(tenantId) || { hits: 0, misses: 0 };
    current.hits++;
    this.metricsBuffer.set(tenantId, current);
  }
  
  private recordMiss(tenantId: string): void {
    const current = this.metricsBuffer.get(tenantId) || { hits: 0, misses: 0 };
    current.misses++;
    this.metricsBuffer.set(tenantId, current);
  }
  
  private async enforceLimit(tenantId: string): Promise<void> {
    const pool = await getDbPool();
    await pool.query(`
      DELETE FROM semantic_cache WHERE id IN (
        SELECT id FROM semantic_cache WHERE tenant_id = $1
        ORDER BY last_hit_at NULLS FIRST, created_at ASC OFFSET $2
      )
    `, [tenantId, CACHE_MAX_ENTRIES_PER_TENANT]);
  }
  
  private rowToEntry(row: any): SemanticCacheEntry {
    return {
      id: row.id, tenantId: row.tenant_id, queryEmbedding: row.query_embedding,
      modelId: row.model_id, domainIds: row.domain_ids, contextHash: row.context_hash,
      response: row.response, responseEmbedding: row.response_embedding,
      createdAt: new Date(row.created_at), expiresAt: new Date(row.expires_at),
      hitCount: row.hit_count, lastHitAt: row.last_hit_at ? new Date(row.last_hit_at) : null,
      userFeedbackAvg: row.user_feedback_avg ? parseFloat(row.user_feedback_avg) : null,
      feedbackCount: row.feedback_count, wasInvalidated: row.was_invalidated,
    };
  }
}

export const semanticCache = new SemanticCacheService();
