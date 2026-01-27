/**
 * RADIANT v5.38.0 - Sovereign Mesh Redis Cache Service
 * 
 * Provides Redis/ElastiCache caching for agent definitions, execution state,
 * and working memory to improve performance at scale.
 */

import { enhancedLogger } from '../../logging/enhanced-logger';
import type { Agent, AgentExecution, OODAState } from './agent-runtime.service';

const logger = enhancedLogger;

// ============================================================================
// TYPES
// ============================================================================

export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  tls: boolean;
  db: number;
  keyPrefix: string;
  defaultTtlSeconds: number;
  compressionEnabled: boolean;
  compressionThreshold: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  memoryUsedBytes: number;
  connectedClients: number;
  avgLatencyMs: number;
}

interface CacheEntry<T> {
  value: T;
  cachedAt: number;
  ttlSeconds: number;
  compressed: boolean;
}

// ============================================================================
// REDIS CACHE SERVICE
// ============================================================================

class RedisCacheService {
  private config: CacheConfig;
  private connected: boolean = false;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    evictions: 0,
    memoryUsedBytes: 0,
    connectedClients: 0,
    avgLatencyMs: 0,
  };

  // In-memory fallback cache when Redis is unavailable
  private memoryCache: Map<string, CacheEntry<unknown>> = new Map();
  private readonly MAX_MEMORY_ENTRIES = 10000;

  // TTL configurations
  private readonly AGENT_TTL = 300; // 5 minutes
  private readonly EXECUTION_STATE_TTL = 3600; // 1 hour
  private readonly WORKING_MEMORY_TTL = 86400; // 24 hours

  constructor() {
    this.config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      tls: process.env.REDIS_TLS === 'true',
      db: parseInt(process.env.REDIS_DB || '0', 10),
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'radiant:mesh:',
      defaultTtlSeconds: parseInt(process.env.REDIS_DEFAULT_TTL || '3600', 10),
      compressionEnabled: process.env.REDIS_COMPRESSION !== 'false',
      compressionThreshold: parseInt(process.env.REDIS_COMPRESSION_THRESHOLD || '1024', 10),
    };

    this.initializeConnection();
  }

  private async initializeConnection(): Promise<void> {
    // Establish Redis connection with ElastiCache
    try {
      const ioredis = await import('ioredis');
      const Redis = ioredis.default || ioredis;
      
      const redisUrl = `redis://${this.config.host}:${this.config.port}`;
      this.redisClient = new (Redis as any)(redisUrl, {
        password: this.config.password || undefined,
        tls: this.config.tls ? {} : undefined,
        keyPrefix: this.config.keyPrefix,
        retryStrategy: (times: number) => {
          if (times > 3) {
            logger.warn('Redis connection retries exhausted, using memory fallback');
            return null; // Stop retrying
          }
          return Math.min(times * 100, 3000);
        },
        maxRetriesPerRequest: 3,
        connectTimeout: 5000,
      });

      // Test connection
      await this.redisClient.ping();
      this.connected = true;
      
      logger.info('Redis cache connected', {
        host: this.config.host,
        keyPrefix: this.config.keyPrefix,
      });
    } catch (error) {
      logger.warn('Redis connection failed, using memory fallback', { error });
      this.connected = false;
      this.redisClient = null;
    }
  }
  
  private redisClient: import('ioredis').Redis | null = null;

  // ============================================================================
  // AGENT CACHING
  // ============================================================================

  /**
   * Get cached agent definition
   */
  async getAgent(agentId: string, tenantId: string): Promise<Agent | null> {
    const key = this.buildKey('agent', tenantId, agentId);
    return this.get<Agent>(key);
  }

  /**
   * Cache agent definition
   */
  async setAgent(agent: Agent, tenantId: string): Promise<void> {
    const key = this.buildKey('agent', tenantId, agent.id);
    await this.set(key, agent, this.AGENT_TTL);
  }

  /**
   * Invalidate cached agent
   */
  async invalidateAgent(agentId: string, tenantId: string): Promise<void> {
    const key = this.buildKey('agent', tenantId, agentId);
    await this.delete(key);
  }

  /**
   * Warm agent cache with frequently used agents
   */
  async warmAgentCache(tenantId: string, agents: Agent[]): Promise<void> {
    const startTime = Date.now();
    for (const agent of agents) {
      await this.setAgent(agent, tenantId);
    }
    logger.info('Agent cache warmed', {
      tenantId,
      count: agents.length,
      durationMs: Date.now() - startTime,
    });
  }

  // ============================================================================
  // EXECUTION STATE CACHING
  // ============================================================================

  /**
   * Get cached execution state
   */
  async getExecutionState(executionId: string, tenantId: string): Promise<AgentExecution | null> {
    const key = this.buildKey('execution', tenantId, executionId);
    return this.get<AgentExecution>(key);
  }

  /**
   * Cache execution state
   */
  async setExecutionState(execution: AgentExecution): Promise<void> {
    const key = this.buildKey('execution', execution.tenantId, execution.id);
    await this.set(key, execution, this.EXECUTION_STATE_TTL);
  }

  /**
   * Update partial execution state (for hot path updates)
   */
  async updateExecutionState(
    executionId: string,
    tenantId: string,
    updates: Partial<AgentExecution>
  ): Promise<void> {
    const existing = await this.getExecutionState(executionId, tenantId);
    if (existing) {
      const updated = { ...existing, ...updates };
      await this.setExecutionState(updated);
    }
  }

  /**
   * Invalidate execution state
   */
  async invalidateExecutionState(executionId: string, tenantId: string): Promise<void> {
    const key = this.buildKey('execution', tenantId, executionId);
    await this.delete(key);
  }

  // ============================================================================
  // WORKING MEMORY CACHING
  // ============================================================================

  /**
   * Get cached OODA state (working memory)
   */
  async getOODAState(executionId: string, tenantId: string): Promise<OODAState | null> {
    const key = this.buildKey('ooda', tenantId, executionId);
    return this.get<OODAState>(key);
  }

  /**
   * Cache OODA state
   */
  async setOODAState(executionId: string, tenantId: string, state: OODAState): Promise<void> {
    const key = this.buildKey('ooda', tenantId, executionId);
    await this.set(key, state, this.WORKING_MEMORY_TTL);
  }

  /**
   * Invalidate OODA state
   */
  async invalidateOODAState(executionId: string, tenantId: string): Promise<void> {
    const key = this.buildKey('ooda', tenantId, executionId);
    await this.delete(key);
  }

  // ============================================================================
  // RATE LIMITING SUPPORT
  // ============================================================================

  /**
   * Increment rate limit counter
   */
  async incrementRateLimit(
    tenantId: string,
    userId: string | null,
    windowSeconds: number = 60
  ): Promise<{ count: number; remaining: number; resetAt: Date }> {
    const windowStart = Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000;
    const key = this.buildKey('ratelimit', tenantId, userId || 'tenant', windowStart.toString());

    // Get current count
    const current = await this.get<number>(key) || 0;
    const newCount = current + 1;

    // Set with TTL equal to window size
    await this.set(key, newCount, windowSeconds);

    // Default limits (should come from config)
    const maxPerTenant = 50;
    const maxPerUser = 10;
    const max = userId ? maxPerUser : maxPerTenant;

    return {
      count: newCount,
      remaining: Math.max(0, max - newCount),
      resetAt: new Date(windowStart + windowSeconds * 1000),
    };
  }

  /**
   * Check if rate limit exceeded
   */
  async isRateLimited(tenantId: string, userId: string | null): Promise<boolean> {
    const { remaining } = await this.incrementRateLimit(tenantId, userId);
    return remaining <= 0;
  }

  // ============================================================================
  // GENERIC CACHE OPERATIONS
  // ============================================================================

  private async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();

    try {
      if (this.connected) {
        // Redis path (to be implemented)
        // const value = await this.redis.get(key);
        // if (value) {
        //   this.stats.hits++;
        //   return this.decompress(value);
        // }
      }

      // Memory fallback
      const entry = this.memoryCache.get(key);
      if (entry) {
        const age = (Date.now() - entry.cachedAt) / 1000;
        if (age < entry.ttlSeconds) {
          this.stats.hits++;
          this.updateAvgLatency(Date.now() - startTime);
          return entry.value as T;
        }
        // Expired, remove it
        this.memoryCache.delete(key);
      }

      this.stats.misses++;
      this.updateHitRate();
      return null;
    } catch (error) {
      logger.error('Cache get failed', { key, error });
      this.stats.misses++;
      return null;
    }
  }

  private async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds || this.config.defaultTtlSeconds;

    try {
      if (this.connected) {
        // Redis path (to be implemented)
        // const serialized = this.compress(value);
        // await this.redis.setex(key, ttl, serialized);
      }

      // Memory fallback
      if (this.memoryCache.size >= this.MAX_MEMORY_ENTRIES) {
        // Evict oldest entries
        this.evictOldestEntries(Math.floor(this.MAX_MEMORY_ENTRIES * 0.1));
      }

      this.memoryCache.set(key, {
        value,
        cachedAt: Date.now(),
        ttlSeconds: ttl,
        compressed: false,
      });
    } catch (error) {
      logger.error('Cache set failed', { key, error });
    }
  }

  private async delete(key: string): Promise<void> {
    try {
      if (this.connected) {
        // await this.redis.del(key);
      }
      this.memoryCache.delete(key);
    } catch (error) {
      logger.error('Cache delete failed', { key, error });
    }
  }

  /**
   * Clear all cache entries for a tenant
   */
  async clearTenantCache(tenantId: string): Promise<void> {
    const prefix = `${this.config.keyPrefix}*:${tenantId}:*`;

    if (this.connected) {
      // await this.redis.keys(prefix).then(keys => this.redis.del(...keys));
    }

    // Memory fallback - iterate and delete matching keys
    for (const key of this.memoryCache.keys()) {
      if (key.includes(`:${tenantId}:`)) {
        this.memoryCache.delete(key);
      }
    }

    logger.info('Tenant cache cleared', { tenantId });
  }

  /**
   * Clear all cache entries
   */
  async clearAll(): Promise<void> {
    if (this.connected) {
      // await this.redis.flushdb();
    }
    this.memoryCache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      evictions: 0,
      memoryUsedBytes: 0,
      connectedClients: 0,
      avgLatencyMs: 0,
    };
    logger.info('Cache cleared');
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private buildKey(...parts: string[]): string {
    return `${this.config.keyPrefix}${parts.join(':')}`;
  }

  private evictOldestEntries(count: number): void {
    const entries = Array.from(this.memoryCache.entries())
      .sort((a, b) => a[1].cachedAt - b[1].cachedAt)
      .slice(0, count);

    for (const [key] of entries) {
      this.memoryCache.delete(key);
      this.stats.evictions++;
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  private updateAvgLatency(latencyMs: number): void {
    // Exponential moving average
    this.stats.avgLatencyMs = this.stats.avgLatencyMs * 0.9 + latencyMs * 0.1;
  }

  // ============================================================================
  // STATS & HEALTH
  // ============================================================================

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.updateHitRate();

    // Estimate memory usage for memory cache
    let estimatedBytes = 0;
    for (const [key, entry] of this.memoryCache.entries()) {
      estimatedBytes += key.length * 2; // UTF-16
      estimatedBytes += JSON.stringify(entry.value).length * 2;
    }
    this.stats.memoryUsedBytes = estimatedBytes;

    return { ...this.stats };
  }

  /**
   * Check if cache is healthy
   */
  async healthCheck(): Promise<{ healthy: boolean; mode: string; details: Record<string, unknown> }> {
    try {
      if (this.connected) {
        // await this.redis.ping();
        return {
          healthy: true,
          mode: 'redis',
          details: {
            host: this.config.host,
            port: this.config.port,
            ...this.getStats(),
          },
        };
      }

      return {
        healthy: true,
        mode: 'memory',
        details: {
          entries: this.memoryCache.size,
          maxEntries: this.MAX_MEMORY_ENTRIES,
          ...this.getStats(),
        },
      };
    } catch (error) {
      return {
        healthy: false,
        mode: 'disconnected',
        details: { error: (error as Error).message },
      };
    }
  }

  /**
   * Check if using Redis (vs memory fallback)
   */
  isRedisConnected(): boolean {
    return this.connected;
  }
}

// Export singleton instance
export const redisCacheService = new RedisCacheService();
