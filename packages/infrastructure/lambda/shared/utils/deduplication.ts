/**
 * Request Deduplication Utility
 * 
 * Prevents duplicate requests within a time window to avoid:
 * - Double billing
 * - Duplicate AI completions
 * - Race conditions
 */

import { createHash } from 'crypto';

export interface DeduplicationConfig {
  windowMs: number;           // Time window for deduplication
  maxEntries: number;         // Maximum entries to track
  keyPrefix?: string;         // Prefix for cache keys
}

export interface DeduplicationResult<T> {
  isDuplicate: boolean;
  requestId: string;
  cachedResult?: T;
  originalTimestamp?: Date;
}

const DEFAULT_CONFIG: DeduplicationConfig = {
  windowMs: 5000,      // 5 seconds default
  maxEntries: 10000,   // Max entries before cleanup
};

// In-memory deduplication cache for Lambda
// Note: For distributed deduplication, use Redis/DynamoDB
interface CacheEntry<T> {
  requestId: string;
  timestamp: Date;
  result?: T;
  inProgress: boolean;
}

const dedupeCache = new Map<string, CacheEntry<unknown>>();
let lastCleanup = Date.now();

/**
 * Generate a deduplication key from request parameters
 */
export function generateDedupeKey(
  ...parts: (string | number | object | undefined | null)[]
): string {
  const data = parts
    .map(p => {
      if (p === null || p === undefined) return '';
      if (typeof p === 'object') return JSON.stringify(p);
      return String(p);
    })
    .join('|');
  
  return createHash('sha256').update(data).digest('hex').substring(0, 32);
}

/**
 * Check if a request is a duplicate
 */
export function checkDuplicate<T>(
  key: string,
  config: Partial<DeduplicationConfig> = {}
): DeduplicationResult<T> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const fullKey = cfg.keyPrefix ? `${cfg.keyPrefix}:${key}` : key;
  
  // Cleanup old entries periodically
  if (Date.now() - lastCleanup > 60000) {
    cleanupExpiredEntries(cfg.windowMs);
    lastCleanup = Date.now();
  }
  
  const existing = dedupeCache.get(fullKey) as CacheEntry<T> | undefined;
  
  if (existing) {
    const age = Date.now() - existing.timestamp.getTime();
    
    if (age < cfg.windowMs) {
      return {
        isDuplicate: true,
        requestId: existing.requestId,
        cachedResult: existing.result as T,
        originalTimestamp: existing.timestamp,
      };
    }
  }
  
  // Create new entry
  const requestId = generateRequestId();
  dedupeCache.set(fullKey, {
    requestId,
    timestamp: new Date(),
    inProgress: true,
  });
  
  // Enforce max entries
  if (dedupeCache.size > cfg.maxEntries) {
    evictOldestEntries(cfg.maxEntries * 0.8);
  }
  
  return {
    isDuplicate: false,
    requestId,
  };
}

/**
 * Mark a request as completed with result
 */
export function completeRequest<T>(
  key: string,
  result: T,
  keyPrefix?: string
): void {
  const fullKey = keyPrefix ? `${keyPrefix}:${key}` : key;
  const entry = dedupeCache.get(fullKey);
  
  if (entry) {
    entry.result = result;
    entry.inProgress = false;
  }
}

/**
 * Remove a request from deduplication cache
 */
export function removeRequest(key: string, keyPrefix?: string): void {
  const fullKey = keyPrefix ? `${keyPrefix}:${key}` : key;
  dedupeCache.delete(fullKey);
}

/**
 * Clean up expired entries
 */
function cleanupExpiredEntries(windowMs: number): void {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  dedupeCache.forEach((entry, key) => {
    if (now - entry.timestamp.getTime() > windowMs) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => dedupeCache.delete(key));
}

/**
 * Evict oldest entries to maintain size limit
 */
function evictOldestEntries(targetSize: number): void {
  const entries = Array.from(dedupeCache.entries())
    .sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime());
  
  const toRemove = entries.length - targetSize;
  for (let i = 0; i < toRemove && i < entries.length; i++) {
    dedupeCache.delete(entries[i][0]);
  }
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomUUID().replace(/-/g, '').substring(0, 8);
  return `req_${timestamp}_${random}`;
}

/**
 * Decorator for deduplicating async functions
 */
export function withDeduplication<T extends unknown[], R>(
  keyGenerator: (...args: T) => string,
  fn: (...args: T) => Promise<R>,
  config: Partial<DeduplicationConfig> = {}
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    const key = keyGenerator(...args);
    const check = checkDuplicate<R>(key, config);
    
    if (check.isDuplicate && check.cachedResult !== undefined) {
      console.log(`[Dedupe] Returning cached result for ${key}`);
      return check.cachedResult;
    }
    
    try {
      const result = await fn(...args);
      completeRequest(key, result, config.keyPrefix);
      return result;
    } catch (error) {
      // Remove failed request from cache
      removeRequest(key, config.keyPrefix);
      throw error;
    }
  };
}

/**
 * Idempotency key helpers for API requests
 */
export const IdempotencyKeys = {
  /**
   * Generate idempotency key for chat completion
   */
  chatCompletion: (tenantId: string, userId: string, model: string, messageHash: string): string => {
    return generateDedupeKey('chat', tenantId, userId, model, messageHash);
  },
  
  /**
   * Generate idempotency key for billing operation
   */
  billing: (tenantId: string, operation: string, amount: number, timestamp: number): string => {
    // Round timestamp to nearest minute to allow slight variations
    const roundedTimestamp = Math.floor(timestamp / 60000) * 60000;
    return generateDedupeKey('billing', tenantId, operation, amount, roundedTimestamp);
  },
  
  /**
   * Generate idempotency key for API key creation
   */
  apiKeyCreation: (tenantId: string, userId: string, name: string): string => {
    return generateDedupeKey('apikey', tenantId, userId, name);
  },
  
  /**
   * Generate idempotency key for webhook delivery
   */
  webhook: (webhookId: string, eventId: string): string => {
    return generateDedupeKey('webhook', webhookId, eventId);
  },
};

/**
 * Get deduplication cache stats
 */
export function getDedupeStats(): {
  cacheSize: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
} {
  let oldest: Date | null = null;
  let newest: Date | null = null;
  
  dedupeCache.forEach(entry => {
    if (!oldest || entry.timestamp < oldest) oldest = entry.timestamp;
    if (!newest || entry.timestamp > newest) newest = entry.timestamp;
  });
  
  return {
    cacheSize: dedupeCache.size,
    oldestEntry: oldest,
    newestEntry: newest,
  };
}

/**
 * Clear all deduplication cache entries
 */
export function clearDedupeCache(): void {
  dedupeCache.clear();
}
