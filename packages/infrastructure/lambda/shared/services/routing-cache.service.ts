// RADIANT v4.18.3 - Routing Decision Cache Service
// Semantic vector caching for brain router decisions to reduce latency

import { executeStatement, stringParam } from '../db/client';
import { createHash } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface CachedRoutingDecision {
  id: string;
  tenantId: string;
  promptHash: string;
  complexity: string;
  taskType: string;
  selectedModelId: string;
  orchestrationMode: string;
  domainId?: string;
  selectionReason: string;
  hitCount: number;
  lastHitAt?: Date;
  createdAt: Date;
  expiresAt: Date;
}

export interface RoutingCacheResult {
  hit: boolean;
  decision?: CachedRoutingDecision;
  latencySavedMs?: number;
}

// ============================================================================
// Constants
// ============================================================================

const SHORT_INPUT_THRESHOLD = 50; // Characters - skip router for very short inputs
const SIMPLE_QUERY_PATTERNS = [
  /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|sure)[\s!.?]*$/i,
  /^what is (the )?(time|date|weather)/i,
  /^(who|what|when|where|why|how) (is|are|was|were|do|does|did)/i,
];

// ============================================================================
// Service
// ============================================================================

class RoutingCacheService {
  
  /**
   * Check if we should skip the brain router entirely for simple queries
   */
  shouldSkipRouter(prompt: string): { skip: boolean; reason?: string; defaultModel?: string } {
    const trimmed = prompt.trim();
    
    // Very short inputs - use fast model
    if (trimmed.length < SHORT_INPUT_THRESHOLD) {
      // Check for simple greetings/acknowledgments
      for (const pattern of SIMPLE_QUERY_PATTERNS) {
        if (pattern.test(trimmed)) {
          return {
            skip: true,
            reason: 'Simple query detected - using optimistic fast path',
            defaultModel: 'openai/gpt-4o-mini',
          };
        }
      }
    }
    
    return { skip: false };
  }
  
  /**
   * Generate a hash for prompt caching
   */
  generatePromptHash(prompt: string, complexity: string, taskType: string): string {
    const normalized = prompt.toLowerCase().trim();
    const input = `${normalized}:${complexity}:${taskType}`;
    return createHash('sha256').update(input).digest('hex');
  }
  
  /**
   * Look up a cached routing decision
   */
  async getCachedDecision(
    tenantId: string,
    prompt: string,
    complexity: string,
    taskType: string
  ): Promise<RoutingCacheResult> {
    const promptHash = this.generatePromptHash(prompt, complexity, taskType);
    
    try {
      const result = await executeStatement<CachedRoutingDecision>(`
        UPDATE routing_decision_cache
        SET hit_count = hit_count + 1, last_hit_at = NOW()
        WHERE tenant_id = :tenantId AND prompt_hash = :promptHash AND expires_at > NOW()
        RETURNING 
          id, tenant_id as "tenantId", prompt_hash as "promptHash",
          complexity, task_type as "taskType", 
          selected_model_id as "selectedModelId",
          orchestration_mode as "orchestrationMode",
          domain_id as "domainId",
          selection_reason as "selectionReason",
          hit_count as "hitCount",
          last_hit_at as "lastHitAt",
          created_at as "createdAt",
          expires_at as "expiresAt"
      `, [
        stringParam('tenantId', tenantId),
        stringParam('promptHash', promptHash),
      ]);
      
      if (result && result.rows && result.rows.length > 0) {
        return {
          hit: true,
          decision: result.rows[0] as unknown as CachedRoutingDecision,
          latencySavedMs: 500, // Estimated router latency saved
        };
      }
    } catch (error) {
      // Cache miss - continue with normal routing
      console.warn('Routing cache lookup failed:', error);
    }
    
    return { hit: false };
  }
  
  /**
   * Cache a routing decision for future lookups
   */
  async cacheDecision(
    tenantId: string,
    prompt: string,
    complexity: string,
    taskType: string,
    selectedModelId: string,
    orchestrationMode: string,
    domainId?: string,
    selectionReason?: string
  ): Promise<void> {
    const promptHash = this.generatePromptHash(prompt, complexity, taskType);
    
    try {
      await executeStatement(`
        INSERT INTO routing_decision_cache (
          tenant_id, prompt_hash, complexity, task_type,
          selected_model_id, orchestration_mode, domain_id, selection_reason
        ) VALUES (:tenantId, :promptHash, :complexity, :taskType, :selectedModelId, :orchestrationMode, :domainId, :selectionReason)
        ON CONFLICT (tenant_id, prompt_hash) 
        DO UPDATE SET
          selected_model_id = EXCLUDED.selected_model_id,
          orchestration_mode = EXCLUDED.orchestration_mode,
          domain_id = EXCLUDED.domain_id,
          selection_reason = EXCLUDED.selection_reason,
          expires_at = NOW() + INTERVAL '24 hours',
          hit_count = routing_decision_cache.hit_count + 1
      `, [
        stringParam('tenantId', tenantId),
        stringParam('promptHash', promptHash),
        stringParam('complexity', complexity),
        stringParam('taskType', taskType),
        stringParam('selectedModelId', selectedModelId),
        stringParam('orchestrationMode', orchestrationMode),
        stringParam('domainId', domainId || ''),
        stringParam('selectionReason', selectionReason || ''),
      ]);
    } catch (error) {
      // Caching failure is non-fatal
      console.warn('Failed to cache routing decision:', error);
    }
  }
  
  /**
   * Clear expired cache entries
   */
  async cleanupExpired(): Promise<number> {
    try {
      const result = await executeStatement<{ count: number }>(`
        WITH deleted AS (
          DELETE FROM routing_decision_cache
          WHERE expires_at < NOW()
          RETURNING id
        )
        SELECT COUNT(*)::int as count FROM deleted
      `, []);
      
      if (result && result.rows && result.rows.length > 0) {
        const row = result.rows[0] as unknown as { count: number };
        return row.count || 0;
      }
      return 0;
    } catch (error) {
      console.warn('Cache cleanup failed:', error);
      return 0;
    }
  }
  
  /**
   * Get cache statistics
   */
  async getStats(tenantId?: string): Promise<{
    totalEntries: number;
    totalHits: number;
    avgHitsPerEntry: number;
    cacheHitRate: number;
  }> {
    try {
      const whereClause = tenantId ? 'WHERE tenant_id = :tenantId' : '';
      const params = tenantId ? [stringParam('tenantId', tenantId)] : [];
      
      const result = await executeStatement<{
        total_entries: number;
        total_hits: number;
        avg_hits: number;
      }>(`
        SELECT 
          COUNT(*)::int as total_entries,
          COALESCE(SUM(hit_count), 0)::int as total_hits,
          COALESCE(AVG(hit_count), 0)::float as avg_hits
        FROM routing_decision_cache
        ${whereClause}
      `, params);
      
      if (result && result.rows && result.rows.length > 0) {
        const row = result.rows[0] as unknown as { total_entries: number; total_hits: number; avg_hits: number };
        return {
          totalEntries: row.total_entries,
          totalHits: row.total_hits,
          avgHitsPerEntry: row.avg_hits,
          cacheHitRate: row.total_entries > 0 ? row.total_hits / (row.total_entries + row.total_hits) : 0,
        };
      }
    } catch (error) {
      console.warn('Failed to get cache stats:', error);
    }
    
    return {
      totalEntries: 0,
      totalHits: 0,
      avgHitsPerEntry: 0,
      cacheHitRate: 0,
    };
  }
}

export const routingCacheService = new RoutingCacheService();
