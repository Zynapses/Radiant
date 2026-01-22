/**
 * Semantic Cache Service
 * 
 * Provides semantic similarity-based caching for Cato.
 * Caches responses based on meaning rather than exact match.
 */

export interface SemanticCacheEntry {
  id: string;
  tenantId: string;
  queryEmbedding: number[];
  query: string;
  response: unknown;
  hitCount: number;
  createdAt: Date;
  lastHitAt: Date;
  expiresAt: Date;
  metadata?: Record<string, unknown>;
}

export interface CacheStats {
  tenantId?: string;
  totalEntries: number;
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  averageHitsPerEntry: number;
  cacheSize: number;
}

class SemanticCacheService {
  private cache: Map<string, SemanticCacheEntry[]> = new Map();
  private stats: Map<string, { hits: number; misses: number }> = new Map();
  private similarityThreshold = 0.85;

  async get(tenantId: string, query: string): Promise<SemanticCacheEntry | null> {
    const entries = this.cache.get(tenantId) || [];
    const queryEmbedding = this.simpleEmbed(query);

    for (const entry of entries) {
      if (new Date() > entry.expiresAt) continue;
      
      const similarity = this.cosineSimilarity(queryEmbedding, entry.queryEmbedding);
      if (similarity >= this.similarityThreshold) {
        entry.hitCount++;
        entry.lastHitAt = new Date();
        this.recordHit(tenantId);
        return entry;
      }
    }

    this.recordMiss(tenantId);
    return null;
  }

  async set(
    tenantId: string,
    query: string,
    response: unknown,
    ttlMs = 3600000,
    metadata?: Record<string, unknown>
  ): Promise<SemanticCacheEntry> {
    const now = new Date();
    const entry: SemanticCacheEntry = {
      id: `cache_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenantId,
      queryEmbedding: this.simpleEmbed(query),
      query,
      response,
      hitCount: 0,
      createdAt: now,
      lastHitAt: now,
      expiresAt: new Date(now.getTime() + ttlMs),
      metadata,
    };

    if (!this.cache.has(tenantId)) {
      this.cache.set(tenantId, []);
    }
    this.cache.get(tenantId)!.push(entry);
    return entry;
  }

  async invalidate(tenantId: string, pattern?: string): Promise<number> {
    if (!pattern) {
      const count = (this.cache.get(tenantId) || []).length;
      this.cache.delete(tenantId);
      return count;
    }

    const entries = this.cache.get(tenantId) || [];
    const filtered = entries.filter(e => !e.query.includes(pattern));
    this.cache.set(tenantId, filtered);
    return entries.length - filtered.length;
  }

  async getStats(tenantId = 'default'): Promise<CacheStats> {
    const entries = this.cache.get(tenantId) || [];
    const stats = this.stats.get(tenantId) || { hits: 0, misses: 0 };
    const total = stats.hits + stats.misses;
    return {
      tenantId,
      totalEntries: entries.length,
      hitRate: total > 0 ? stats.hits / total : 0,
      missRate: total > 0 ? stats.misses / total : 0,
      totalHits: stats.hits,
      totalMisses: stats.misses,
      averageHitsPerEntry: entries.length > 0 
        ? entries.reduce((sum, e) => sum + e.hitCount, 0) / entries.length 
        : 0,
      cacheSize: JSON.stringify(entries).length,
    };
  }

  async prune(tenantId: string): Promise<number> {
    const entries = this.cache.get(tenantId) || [];
    const now = new Date();
    const valid = entries.filter(e => e.expiresAt > now);
    this.cache.set(tenantId, valid);
    return entries.length - valid.length;
  }

  setSimilarityThreshold(threshold: number): void {
    this.similarityThreshold = Math.max(0, Math.min(1, threshold));
  }

  async invalidateByDomain(tenantIdOrDomain: string = 'default', domain?: string): Promise<number> {
    const actualDomain = domain !== undefined ? domain : tenantIdOrDomain;
    const actualTenantId = domain !== undefined ? tenantIdOrDomain : 'default';
    return this.invalidate(actualTenantId, actualDomain);
  }

  private recordHit(tenantId: string): void {
    if (!this.stats.has(tenantId)) this.stats.set(tenantId, { hits: 0, misses: 0 });
    this.stats.get(tenantId)!.hits++;
  }

  private recordMiss(tenantId: string): void {
    if (!this.stats.has(tenantId)) this.stats.set(tenantId, { hits: 0, misses: 0 });
    this.stats.get(tenantId)!.misses++;
  }

  private simpleEmbed(text: string): number[] {
    const normalized = text.toLowerCase().trim();
    const embedding: number[] = new Array(64).fill(0);
    for (let i = 0; i < normalized.length && i < 64; i++) {
      embedding[i] = normalized.charCodeAt(i) / 255;
    }
    return embedding;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

export const semanticCacheService = new SemanticCacheService();
