/**
 * Query Fallback Service
 * 
 * Provides fallback strategies when primary query methods fail.
 * Part of the Cato resilience architecture.
 */

export type FallbackStrategy = 'CACHED' | 'SIMPLIFIED' | 'DEGRADED' | 'OFFLINE' | 'ERROR';

export interface FallbackResult<T = unknown> {
  success: boolean;
  strategy: FallbackStrategy;
  data?: T;
  error?: string;
  latencyMs: number;
  fromCache: boolean;
}

export interface FallbackConfig {
  tenantId: string;
  enableCaching: boolean;
  cacheTtlMs: number;
  enableSimplified: boolean;
  enableDegraded: boolean;
  offlineMessage: string;
}

const DEFAULT_CONFIG: Omit<FallbackConfig, 'tenantId'> = {
  enableCaching: true,
  cacheTtlMs: 300000,
  enableSimplified: true,
  enableDegraded: true,
  offlineMessage: 'Service temporarily unavailable. Please try again later.',
};

export class QueryFallbackService {
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private configs: Map<string, FallbackConfig> = new Map();

  async getConfig(tenantId: string): Promise<FallbackConfig> {
    if (!this.configs.has(tenantId)) {
      this.configs.set(tenantId, { tenantId, ...DEFAULT_CONFIG });
    }
    return this.configs.get(tenantId)!;
  }

  async updateConfig(tenantId: string, updates: Partial<FallbackConfig>): Promise<FallbackConfig> {
    const config = await this.getConfig(tenantId);
    Object.assign(config, updates);
    return config;
  }

  async executeWithFallback<T>(
    tenantId: string,
    cacheKey: string,
    primaryFn: () => Promise<T>,
    simplifiedFn?: () => Promise<T>,
    degradedFn?: () => Promise<T>
  ): Promise<FallbackResult<T>> {
    const config = await this.getConfig(tenantId);
    const startTime = Date.now();

    // Try primary
    try {
      const data = await primaryFn();
      this.setCache(cacheKey, data, config.cacheTtlMs);
      return {
        success: true,
        strategy: 'CACHED',
        data,
        latencyMs: Date.now() - startTime,
        fromCache: false,
      };
    } catch (primaryError) {
      // Try cache
      if (config.enableCaching) {
        const cached = this.getCache<T>(cacheKey);
        if (cached) {
          return {
            success: true,
            strategy: 'CACHED',
            data: cached,
            latencyMs: Date.now() - startTime,
            fromCache: true,
          };
        }
      }

      // Try simplified
      if (config.enableSimplified && simplifiedFn) {
        try {
          const data = await simplifiedFn();
          return {
            success: true,
            strategy: 'SIMPLIFIED',
            data,
            latencyMs: Date.now() - startTime,
            fromCache: false,
          };
        } catch { /* Continue to next fallback */ }
      }

      // Try degraded
      if (config.enableDegraded && degradedFn) {
        try {
          const data = await degradedFn();
          return {
            success: true,
            strategy: 'DEGRADED',
            data,
            latencyMs: Date.now() - startTime,
            fromCache: false,
          };
        } catch { /* Continue to offline */ }
      }

      // Offline fallback
      return {
        success: false,
        strategy: 'OFFLINE',
        error: config.offlineMessage,
        latencyMs: Date.now() - startTime,
        fromCache: false,
      };
    }
  }

  async clearCache(pattern?: string): Promise<number> {
    if (!pattern) {
      const count = this.cache.size;
      this.cache.clear();
      return count;
    }
    let count = 0;
    for (const key of Array.from(this.cache.keys())) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  async isFallbackActive(tenantId = 'default'): Promise<boolean> {
    return false;
  }

  async getHealthCheck(tenantId = 'default'): Promise<{ healthy: boolean; fallbacksTriggered: number }> {
    return { healthy: true, fallbacksTriggered: 0 };
  }

  private setCache(key: string, data: unknown, ttlMs: number): void {
    this.cache.set(key, { data, timestamp: Date.now() + ttlMs });
  }

  private getCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.timestamp) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  async getFallbackResponse(tenantId = 'default', query = ''): Promise<string> {
    const config = await this.getConfig(tenantId);
    return config.offlineMessage;
  }
}

export const queryFallbackService = new QueryFallbackService();
