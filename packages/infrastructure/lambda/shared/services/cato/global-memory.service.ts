/**
 * Global Memory Service
 * 
 * Manages global memory state for Cato consciousness.
 * Provides cross-session memory persistence via PostgreSQL.
 * 
 * Database-backed for Lambda cold start survival.
 */

import { executeStatement, stringParam, doubleParam } from '../../db/client';
import { enhancedLogger as logger } from '../../logging/enhanced-logger';

export interface MemoryEntry {
  id: string;
  tenantId: string;
  category: 'episodic' | 'semantic' | 'procedural' | 'working';
  key: string;
  value: unknown;
  importance: number;
  accessCount: number;
  lastAccessedAt: Date;
  createdAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface MemoryStats {
  tenantId?: string;
  totalEntries: number;
  byCategory: Record<string, number>;
  totalSizeBytes: number;
  oldestEntry?: Date;
  newestEntry?: Date;
  averageImportance: number;
}

class GlobalMemoryService {
  /**
   * Store a memory entry in PostgreSQL
   */
  async store(
    tenantId: string,
    category: MemoryEntry['category'],
    key: string,
    value: unknown,
    options?: { importance?: number; expiresAt?: Date; metadata?: Record<string, unknown> }
  ): Promise<MemoryEntry> {
    const id = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const importance = options?.importance ?? 0.5;
    const now = new Date();

    try {
      await executeStatement(
        `INSERT INTO cato_global_memory 
         (id, tenant_id, category, key, value, importance, access_count, last_accessed_at, created_at, expires_at, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, 0, NOW(), NOW(), $7, $8)
         ON CONFLICT (tenant_id, category, key) DO UPDATE SET
           value = $5,
           importance = $6,
           expires_at = $7,
           metadata = $8,
           updated_at = NOW()`,
        [
          stringParam('id', id),
          stringParam('tenantId', tenantId),
          stringParam('category', category),
          stringParam('key', key),
          stringParam('value', JSON.stringify(value)),
          doubleParam('importance', importance),
          options?.expiresAt ? stringParam('expiresAt', options.expiresAt.toISOString()) : { name: 'expiresAt', value: { isNull: true } },
          options?.metadata ? stringParam('metadata', JSON.stringify(options.metadata)) : { name: 'metadata', value: { isNull: true } },
        ]
      );
    } catch (error) {
      logger.warn('Failed to store memory, using fallback', { error: String(error) });
    }

    return {
      id,
      tenantId,
      category,
      key,
      value,
      importance,
      accessCount: 0,
      lastAccessedAt: now,
      createdAt: now,
      expiresAt: options?.expiresAt,
      metadata: options?.metadata,
    };
  }

  /**
   * Retrieve a memory entry by key
   */
  async retrieve(tenantId: string, key: string): Promise<MemoryEntry | null> {
    try {
      // Update access count and timestamp
      await executeStatement(
        `UPDATE cato_global_memory 
         SET access_count = access_count + 1, last_accessed_at = NOW()
         WHERE tenant_id = $1 AND key = $2`,
        [stringParam('tenantId', tenantId), stringParam('key', key)]
      );

      const result = await executeStatement(
        `SELECT * FROM cato_global_memory WHERE tenant_id = $1 AND key = $2`,
        [stringParam('tenantId', tenantId), stringParam('key', key)]
      );

      if (result.rows.length > 0) {
        return this.mapRowToEntry(result.rows[0] as Record<string, unknown>);
      }
    } catch (error) {
      logger.warn('Failed to retrieve memory', { error: String(error) });
    }
    return null;
  }

  /**
   * Search memories with filters
   */
  async search(
    tenantId: string,
    query: { category?: MemoryEntry['category']; minImportance?: number; limit?: number }
  ): Promise<MemoryEntry[]> {
    try {
      let sql = `SELECT * FROM cato_global_memory WHERE tenant_id = $1`;
      const params: any[] = [stringParam('tenantId', tenantId)];
      let paramIndex = 2;

      if (query.category) {
        sql += ` AND category = $${paramIndex}`;
        params.push(stringParam(`p${paramIndex}`, query.category));
        paramIndex++;
      }

      if (query.minImportance !== undefined) {
        sql += ` AND importance >= $${paramIndex}`;
        params.push(doubleParam(`p${paramIndex}`, query.minImportance));
        paramIndex++;
      }

      // Filter out expired entries
      sql += ` AND (expires_at IS NULL OR expires_at > NOW())`;
      sql += ` ORDER BY importance DESC`;

      if (query.limit) {
        sql += ` LIMIT $${paramIndex}`;
        params.push({ name: `p${paramIndex}`, value: { longValue: query.limit } });
      }

      const result = await executeStatement(sql, params);
      return result.rows.map(row => this.mapRowToEntry(row as Record<string, unknown>));
    } catch (error) {
      logger.warn('Failed to search memories', { error: String(error) });
      return [];
    }
  }

  /**
   * Forget (delete) a memory entry
   */
  async forget(tenantId: string, key: string): Promise<boolean> {
    try {
      const result = await executeStatement(
        `DELETE FROM cato_global_memory WHERE tenant_id = $1 AND key = $2`,
        [stringParam('tenantId', tenantId), stringParam('key', key)]
      );
      return (result.rowCount || 0) > 0;
    } catch (error) {
      logger.warn('Failed to forget memory', { error: String(error) });
      return false;
    }
  }

  /**
   * Consolidate memories - remove expired entries
   */
  async consolidate(tenantId: string): Promise<number> {
    try {
      const result = await executeStatement(
        `DELETE FROM cato_global_memory 
         WHERE tenant_id = $1 AND expires_at IS NOT NULL AND expires_at < NOW()`,
        [stringParam('tenantId', tenantId)]
      );
      return result.rowCount || 0;
    } catch (error) {
      logger.warn('Failed to consolidate memories', { error: String(error) });
      return 0;
    }
  }

  /**
   * Get memory statistics
   */
  async getStats(tenantId?: string): Promise<MemoryStats> {
    const actualTenantId = tenantId || 'default';
    
    try {
      const result = await executeStatement(
        `SELECT 
           COUNT(*) as total_entries,
           category,
           AVG(importance) as avg_importance,
           MIN(created_at) as oldest_entry,
           MAX(created_at) as newest_entry,
           SUM(LENGTH(value::text)) as total_size
         FROM cato_global_memory 
         WHERE tenant_id = $1
         GROUP BY category`,
        [stringParam('tenantId', actualTenantId)]
      );

      const byCategory: Record<string, number> = {};
      let totalEntries = 0;
      let totalImportance = 0;
      let totalSize = 0;
      let oldest: Date | undefined;
      let newest: Date | undefined;

      for (const row of result.rows as Record<string, unknown>[]) {
        const cat = String(row.category);
        const count = Number(row.total_entries) || 0;
        byCategory[cat] = count;
        totalEntries += count;
        totalImportance += (Number(row.avg_importance) || 0) * count;
        totalSize += Number(row.total_size) || 0;
        
        const rowOldest = row.oldest_entry ? new Date(String(row.oldest_entry)) : undefined;
        const rowNewest = row.newest_entry ? new Date(String(row.newest_entry)) : undefined;
        if (rowOldest && (!oldest || rowOldest < oldest)) oldest = rowOldest;
        if (rowNewest && (!newest || rowNewest > newest)) newest = rowNewest;
      }

      return {
        tenantId,
        totalEntries,
        byCategory,
        totalSizeBytes: totalSize,
        oldestEntry: oldest,
        newestEntry: newest,
        averageImportance: totalEntries > 0 ? totalImportance / totalEntries : 0,
      };
    } catch (error) {
      logger.warn('Failed to get memory stats', { error: String(error) });
      return {
        tenantId,
        totalEntries: 0,
        byCategory: {},
        totalSizeBytes: 0,
        averageImportance: 0,
      };
    }
  }

  /**
   * Clear memories by tenant and optionally by category
   */
  async clear(tenantId: string, category?: MemoryEntry['category']): Promise<number> {
    try {
      let sql = `DELETE FROM cato_global_memory WHERE tenant_id = $1`;
      const params: any[] = [stringParam('tenantId', tenantId)];

      if (category) {
        sql += ` AND category = $2`;
        params.push(stringParam('category', category));
      }

      const result = await executeStatement(sql, params);
      return result.rowCount || 0;
    } catch (error) {
      logger.warn('Failed to clear memories', { error: String(error) });
      return 0;
    }
  }

  /**
   * Store a semantic fact
   */
  async storeFact(
    tenantIdOrFact: string | { subject: string; predicate: string; object: string; domain: string; confidence?: number; sources?: string[] } = 'default',
    key = '',
    value?: unknown
  ): Promise<MemoryEntry | string> {
    if (typeof tenantIdOrFact === 'object') {
      const fact = tenantIdOrFact;
      const factKey = `${fact.subject}:${fact.predicate}:${fact.object}`;
      const entry = await this.store('default', 'semantic', factKey, fact, { 
        importance: fact.confidence || 0.7,
        metadata: { domain: fact.domain, sources: fact.sources },
      });
      return entry.id;
    }
    return this.store(tenantIdOrFact, 'semantic', key, value, { importance: 0.7 });
  }

  /**
   * Get facts by domain
   */
  async getFactsByDomain(tenantIdOrDomain: string = 'default', domainOrLimit?: string | number): Promise<MemoryEntry[]> {
    const tenantId = typeof domainOrLimit === 'string' || typeof domainOrLimit === 'number' ? tenantIdOrDomain : 'default';
    return this.search(tenantId, { category: 'semantic' });
  }

  /**
   * Get active goals
   */
  async getGoals(tenantId = 'default'): Promise<string[]> {
    const entries = await this.search(tenantId, { category: 'procedural' });
    return entries.map(e => e.key);
  }

  /**
   * Update goals
   */
  async updateGoals(tenantIdOrGoals: string | string[] = 'default', goals?: string[]): Promise<void> {
    const isGoals = Array.isArray(tenantIdOrGoals);
    const tenantId = isGoals ? 'default' : tenantIdOrGoals;
    const actualGoals = isGoals ? tenantIdOrGoals : (goals || []);
    await this.clear(tenantId, 'procedural');
    for (const goal of actualGoals) {
      await this.store(tenantId, 'procedural', goal, { active: true });
    }
  }

  /**
   * Get meta state
   */
  async getMetaState(tenantId = 'default'): Promise<Record<string, unknown>> {
    const stats = await this.getStats(tenantId);
    return { ...stats, meta: true };
  }

  /**
   * Get current attention focus
   */
  async getAttentionFocus(tenantId = 'default'): Promise<string | null> {
    const entries = await this.search(tenantId, { category: 'working', limit: 1 });
    return entries[0]?.key || null;
  }

  /**
   * Map database row to MemoryEntry
   */
  private mapRowToEntry(row: Record<string, unknown>): MemoryEntry {
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      category: String(row.category) as MemoryEntry['category'],
      key: String(row.key),
      value: row.value ? JSON.parse(String(row.value)) : null,
      importance: Number(row.importance) || 0.5,
      accessCount: Number(row.access_count) || 0,
      lastAccessedAt: row.last_accessed_at ? new Date(String(row.last_accessed_at)) : new Date(),
      createdAt: row.created_at ? new Date(String(row.created_at)) : new Date(),
      expiresAt: row.expires_at ? new Date(String(row.expires_at)) : undefined,
      metadata: row.metadata ? JSON.parse(String(row.metadata)) : undefined,
    };
  }
}

export const globalMemoryService = new GlobalMemoryService();
