/**
 * Caching Service
 * 
 * Multi-layer caching with Redis and in-memory fallback
 */

import Redis from 'ioredis';
import { logger } from '../logger';
import { CachingConfig } from './system-config';

let redisClient: Redis | null = null;
const memoryCache: Map<string, { value: unknown; expiresAt: number }> = new Map();

const REDIS_URL = process.env.REDIS_URL;

// Default TTL - will be overridden by DB config when available
let DEFAULT_TTL = 300; // 5 minutes

// Load TTL from database config (async, non-blocking)
CachingConfig.getRedisDefaultTtlSeconds().then(ttl => {
  DEFAULT_TTL = ttl;
  logger.info('Cache TTL loaded from config', { ttl });
}).catch(() => {
  // Use default if DB not available
});

/**
 * Initialize Redis connection
 */
export async function initCache(): Promise<void> {
  if (REDIS_URL && !redisClient) {
    try {
      redisClient = new Redis(REDIS_URL);
      redisClient.on('error', (err: Error) => {
        logger.error('Redis connection error', err);
        redisClient = null;
      });
      logger.info('Redis connected');
    } catch (error) {
      logger.error('Failed to connect to Redis', error instanceof Error ? error : undefined);
      redisClient = null;
    }
  }
}

/**
 * Get a value from cache
 */
export async function get<T>(key: string): Promise<T | null> {
  // Try Redis first
  if (redisClient) {
    try {
      const value = await redisClient.get(key);
      if (value) {
        return JSON.parse(value) as T;
      }
    } catch (error) {
      logger.warn('Redis get error', { error: error instanceof Error ? error.message : 'Unknown' });
    }
  }

  // Fallback to memory cache
  const cached = memoryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  // Expired - remove from memory cache
  if (cached) {
    memoryCache.delete(key);
  }

  return null;
}

/**
 * Set a value in cache
 */
export async function set(key: string, value: unknown, ttlSeconds: number = DEFAULT_TTL): Promise<void> {
  const serialized = JSON.stringify(value);

  // Set in Redis
  if (redisClient) {
    try {
      await redisClient.setex(key, ttlSeconds, serialized);
    } catch (error) {
      logger.warn('Redis set error', { error: error instanceof Error ? error.message : 'Unknown' });
    }
  }

  // Also set in memory cache
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + (ttlSeconds * 1000),
  });

  // Cleanup old entries if memory cache is too large
  if (memoryCache.size > 1000) {
    cleanupMemoryCache();
  }
}

/**
 * Delete a value from cache
 */
export async function del(key: string): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.del(key);
    } catch (error) {
      logger.warn('Redis del error', { error: error instanceof Error ? error.message : 'Unknown' });
    }
  }
  memoryCache.delete(key);
}

/**
 * Delete multiple keys by pattern
 */
export async function delByPattern(pattern: string): Promise<number> {
  let deleted = 0;

  if (redisClient) {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        deleted = await redisClient.del(keys);
      }
    } catch (error) {
      logger.warn('Redis delByPattern error', { error: error instanceof Error ? error.message : 'Unknown' });
    }
  }

  // Also clean memory cache
  const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
  for (const key of memoryCache.keys()) {
    if (regex.test(key)) {
      memoryCache.delete(key);
      deleted++;
    }
  }

  return deleted;
}

/**
 * Get or set (cache-aside pattern)
 */
export async function getOrSet<T>(
  key: string,
  factory: () => Promise<T>,
  ttlSeconds: number = DEFAULT_TTL
): Promise<T> {
  const cached = await get<T>(key);
  if (cached !== null) {
    return cached;
  }

  const value = await factory();
  await set(key, value, ttlSeconds);
  return value;
}

/**
 * Increment a counter
 */
export async function incr(key: string, amount: number = 1): Promise<number> {
  if (redisClient) {
    try {
      return await redisClient.incrby(key, amount);
    } catch (error) {
      logger.warn('Redis incr error', { error: error instanceof Error ? error.message : 'Unknown' });
    }
  }

  // Fallback to memory
  const current = (memoryCache.get(key)?.value as number) || 0;
  const newValue = current + amount;
  memoryCache.set(key, { value: newValue, expiresAt: Date.now() + 3600000 });
  return newValue;
}

/**
 * Set expiration on a key
 */
export async function expire(key: string, ttlSeconds: number): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.expire(key, ttlSeconds);
    } catch (error) {
      logger.warn('Redis expire error', { error: error instanceof Error ? error.message : 'Unknown' });
    }
  }

  const cached = memoryCache.get(key);
  if (cached) {
    cached.expiresAt = Date.now() + (ttlSeconds * 1000);
  }
}

/**
 * Check if key exists
 */
export async function exists(key: string): Promise<boolean> {
  if (redisClient) {
    try {
      return (await redisClient.exists(key)) === 1;
    } catch (error) {
      logger.warn('Redis exists error', { error: error instanceof Error ? error.message : 'Unknown' });
    }
  }

  const cached = memoryCache.get(key);
  return cached !== undefined && cached.expiresAt > Date.now();
}

/**
 * Cleanup expired entries from memory cache
 */
function cleanupMemoryCache(): void {
  const now = Date.now();
  for (const [key, value] of memoryCache.entries()) {
    if (value.expiresAt < now) {
      memoryCache.delete(key);
    }
  }

  // If still too large, remove oldest entries
  if (memoryCache.size > 500) {
    const entries = Array.from(memoryCache.entries())
      .sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    
    const toRemove = entries.slice(0, entries.length - 500);
    for (const [key] of toRemove) {
      memoryCache.delete(key);
    }
  }
}

/**
 * Close Redis connection
 */
export async function closeCache(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

// ============================================================================
// Cache Key Builders
// ============================================================================

export const CacheKeys = {
  // Tenant data
  tenant: (id: string) => `tenant:${id}`,
  tenantConfig: (id: string) => `tenant:${id}:config`,
  
  // Models
  modelList: (tenantId: string) => `models:${tenantId}:list`,
  model: (tenantId: string, modelId: string) => `models:${tenantId}:${modelId}`,
  
  // Billing
  credits: (tenantId: string) => `billing:${tenantId}:credits`,
  usage: (tenantId: string, date: string) => `billing:${tenantId}:usage:${date}`,
  
  // Localization
  translations: (language: string) => `i18n:${language}:bundle`,
  
  // Rate limiting
  rateLimit: (tenantId: string, endpoint: string) => `ratelimit:${tenantId}:${endpoint}`,
  rateLimitIp: (ip: string) => `ratelimit:ip:${ip}`,
  
  // Sessions
  session: (tenantId: string, userId: string) => `session:${tenantId}:${userId}`,
  
  // Feature flags
  flag: (key: string) => `flag:${key}`,
  flagsAll: () => 'flags:all',
};

// ============================================================================
// Cache TTL Constants
// ============================================================================

export const CacheTTL = {
  SHORT: 60,           // 1 minute
  MEDIUM: 300,         // 5 minutes
  LONG: 3600,          // 1 hour
  VERY_LONG: 86400,    // 24 hours
  
  // Specific TTLs
  MODELS: 300,         // 5 minutes
  CONFIG: 300,         // 5 minutes
  TRANSLATIONS: 3600,  // 1 hour
  CREDITS: 60,         // 1 minute (needs to be fresh)
  SESSION: 86400,      // 24 hours
  RATE_LIMIT: 60,      // 1 minute
};
