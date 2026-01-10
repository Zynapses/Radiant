/**
 * Rate Limiter Service - Token Bucket Implementation
 * 
 * RADIANT v5.2.0 - Production Hardening
 * 
 * Implements rate limiting using the Token Bucket algorithm with Redis storage.
 * Protects against "Noisy Neighbor" attacks where one tenant consumes excessive resources.
 * 
 * Usage:
 *   import { rateLimiterService, RateLimitExceededError } from './rate-limiter.service';
 *   
 *   // Check rate limit before processing
 *   const allowed = await rateLimiterService.checkLimit(tenantId);
 *   if (!allowed) {
 *     throw new RateLimitExceededError(tenantId);
 *   }
 */

import { logger } from '../logger';

// ============================================================================
// Types
// ============================================================================

export interface RateLimitConfig {
  /** Maximum requests per window (default: 100) */
  maxRequests: number;
  /** Window size in seconds (default: 60) */
  windowSeconds: number;
  /** Whether to enable rate limiting (default: true) */
  enabled: boolean;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Current request count in the window */
  currentCount: number;
  /** Maximum allowed requests */
  limit: number;
  /** Seconds until the rate limit resets */
  resetInSeconds: number;
  /** Remaining requests in the window */
  remaining: number;
}

export interface TenantRateLimitOverride {
  tenantId: string;
  maxRequests: number;
  windowSeconds: number;
  reason?: string;
  expiresAt?: Date;
}

// ============================================================================
// Errors
// ============================================================================

/**
 * Error thrown when rate limit is exceeded.
 */
export class RateLimitExceededError extends Error {
  readonly isRateLimitExceeded = true;
  readonly statusCode = 429;
  
  constructor(
    public readonly tenantId: string,
    public readonly limit: number,
    public readonly resetInSeconds: number,
    public readonly currentCount: number
  ) {
    super(`Rate limit exceeded for tenant ${tenantId}. Limit: ${limit}, Current: ${currentCount}. Retry in ${resetInSeconds}s`);
    this.name = 'RateLimitExceededError';
  }
  
  toResponse(): { statusCode: number; body: string; headers: Record<string, string> } {
    return {
      statusCode: 429,
      body: JSON.stringify({
        error: 'Too Many Requests',
        message: this.message,
        retryAfter: this.resetInSeconds,
      }),
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(this.resetInSeconds),
        'X-RateLimit-Limit': String(this.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + this.resetInSeconds),
      },
    };
  }
}

// ============================================================================
// Redis Client Interface
// ============================================================================

interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number }): Promise<void>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  ttl(key: string): Promise<number>;
  del(key: string): Promise<void>;
}

// ============================================================================
// In-Memory Fallback Store
// ============================================================================

/**
 * In-memory fallback when Redis is unavailable.
 * Uses a simple Map with TTL tracking.
 */
class InMemoryStore implements RedisClient {
  private store: Map<string, { value: string; expiresAt: number }> = new Map();
  
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.store.delete(key);
      }
    }
  }
  
  async get(key: string): Promise<string | null> {
    this.cleanup();
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }
  
  async set(key: string, value: string, options?: { EX?: number }): Promise<void> {
    const expiresAt = options?.EX ? Date.now() + options.EX * 1000 : 0;
    this.store.set(key, { value, expiresAt });
  }
  
  async incr(key: string): Promise<number> {
    const entry = this.store.get(key);
    let newValue: number;
    
    if (!entry || (entry.expiresAt && entry.expiresAt < Date.now())) {
      newValue = 1;
      this.store.set(key, { value: '1', expiresAt: entry?.expiresAt || 0 });
    } else {
      newValue = parseInt(entry.value, 10) + 1;
      entry.value = String(newValue);
    }
    
    return newValue;
  }
  
  async expire(key: string, seconds: number): Promise<void> {
    const entry = this.store.get(key);
    if (entry) {
      entry.expiresAt = Date.now() + seconds * 1000;
    }
  }
  
  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry || !entry.expiresAt) return -1;
    const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }
  
  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}

// ============================================================================
// Rate Limiter Service
// ============================================================================

export class RateLimiterService {
  private redis: RedisClient;
  private config: RateLimitConfig;
  private tenantOverrides: Map<string, TenantRateLimitOverride> = new Map();
  private readonly keyPrefix = 'rate_limit:';
  
  constructor(
    redisClient?: RedisClient,
    config?: Partial<RateLimitConfig>
  ) {
    // Use provided Redis client or fall back to in-memory
    this.redis = redisClient || new InMemoryStore();
    
    // Load config from environment with defaults
    this.config = {
      enabled: this.getEnvBoolean('RATE_LIMIT_ENABLED', true),
      maxRequests: this.getEnvNumber('RATE_LIMIT_REQUESTS_PER_MINUTE', 100),
      windowSeconds: this.getEnvNumber('RATE_LIMIT_WINDOW_SECONDS', 60),
      ...config,
    };
    
    logger.info('RateLimiterService initialized', {
      enabled: this.config.enabled,
      maxRequests: this.config.maxRequests,
      windowSeconds: this.config.windowSeconds,
      usingRedis: !(this.redis instanceof InMemoryStore),
    });
  }
  
  private getEnvBoolean(name: string, defaultValue: boolean): boolean {
    const value = process.env[name];
    if (!value) return defaultValue;
    return value.toLowerCase() === 'true' || value === '1';
  }
  
  private getEnvNumber(name: string, defaultValue: number): number {
    const value = process.env[name];
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  
  /**
   * Get the rate limit key for a tenant.
   */
  private getKey(tenantId: string): string {
    return `${this.keyPrefix}${tenantId}`;
  }
  
  /**
   * Get the effective rate limit config for a tenant.
   * Checks for overrides first, then falls back to default.
   */
  private getEffectiveConfig(tenantId: string): RateLimitConfig {
    const override = this.tenantOverrides.get(tenantId);
    
    if (override) {
      // Check if override has expired
      if (override.expiresAt && override.expiresAt < new Date()) {
        this.tenantOverrides.delete(tenantId);
        return this.config;
      }
      
      return {
        ...this.config,
        maxRequests: override.maxRequests,
        windowSeconds: override.windowSeconds,
      };
    }
    
    return this.config;
  }
  
  /**
   * Check if a request is allowed for the given tenant.
   * 
   * @param tenantId The tenant ID to check
   * @returns RateLimitResult with allowed status and metadata
   */
  async checkLimit(tenantId: string): Promise<RateLimitResult> {
    // If rate limiting is disabled, always allow
    if (!this.config.enabled) {
      return {
        allowed: true,
        currentCount: 0,
        limit: this.config.maxRequests,
        resetInSeconds: 0,
        remaining: this.config.maxRequests,
      };
    }
    
    const effectiveConfig = this.getEffectiveConfig(tenantId);
    const key = this.getKey(tenantId);
    
    try {
      // Increment the counter
      const currentCount = await this.redis.incr(key);
      
      // Set expiry on first request in window
      if (currentCount === 1) {
        await this.redis.expire(key, effectiveConfig.windowSeconds);
      }
      
      // Get TTL for reset time
      const ttl = await this.redis.ttl(key);
      const resetInSeconds = ttl > 0 ? ttl : effectiveConfig.windowSeconds;
      
      const allowed = currentCount <= effectiveConfig.maxRequests;
      const remaining = Math.max(0, effectiveConfig.maxRequests - currentCount);
      
      // Log if approaching limit
      if (currentCount >= effectiveConfig.maxRequests * 0.8) {
        logger.warn('Tenant approaching rate limit', {
          tenantId,
          currentCount,
          limit: effectiveConfig.maxRequests,
          remaining,
        });
      }
      
      return {
        allowed,
        currentCount,
        limit: effectiveConfig.maxRequests,
        resetInSeconds,
        remaining,
      };
    } catch (error) {
      // On Redis error, fail open (allow request) but log warning
      logger.error('Rate limiter Redis error - failing open', error instanceof Error ? error : new Error(String(error)), {
        tenantId,
      });
      
      return {
        allowed: true,
        currentCount: 0,
        limit: effectiveConfig.maxRequests,
        resetInSeconds: effectiveConfig.windowSeconds,
        remaining: effectiveConfig.maxRequests,
      };
    }
  }
  
  /**
   * Check rate limit and throw if exceeded.
   * 
   * @param tenantId The tenant ID to check
   * @throws RateLimitExceededError if limit is exceeded
   */
  async enforceLimit(tenantId: string): Promise<RateLimitResult> {
    const result = await this.checkLimit(tenantId);
    
    if (!result.allowed) {
      throw new RateLimitExceededError(
        tenantId,
        result.limit,
        result.resetInSeconds,
        result.currentCount
      );
    }
    
    return result;
  }
  
  /**
   * Get current rate limit status for a tenant without incrementing.
   */
  async getStatus(tenantId: string): Promise<RateLimitResult> {
    if (!this.config.enabled) {
      return {
        allowed: true,
        currentCount: 0,
        limit: this.config.maxRequests,
        resetInSeconds: 0,
        remaining: this.config.maxRequests,
      };
    }
    
    const effectiveConfig = this.getEffectiveConfig(tenantId);
    const key = this.getKey(tenantId);
    
    try {
      const countStr = await this.redis.get(key);
      const currentCount = countStr ? parseInt(countStr, 10) : 0;
      const ttl = await this.redis.ttl(key);
      const resetInSeconds = ttl > 0 ? ttl : effectiveConfig.windowSeconds;
      
      return {
        allowed: currentCount < effectiveConfig.maxRequests,
        currentCount,
        limit: effectiveConfig.maxRequests,
        resetInSeconds,
        remaining: Math.max(0, effectiveConfig.maxRequests - currentCount),
      };
    } catch (error) {
      logger.error('Rate limiter status check failed', error instanceof Error ? error : new Error(String(error)), {
        tenantId,
      });
      
      return {
        allowed: true,
        currentCount: 0,
        limit: effectiveConfig.maxRequests,
        resetInSeconds: effectiveConfig.windowSeconds,
        remaining: effectiveConfig.maxRequests,
      };
    }
  }
  
  /**
   * Reset the rate limit counter for a tenant.
   */
  async resetLimit(tenantId: string): Promise<void> {
    const key = this.getKey(tenantId);
    await this.redis.del(key);
    logger.info('Rate limit reset', { tenantId });
  }
  
  /**
   * Set a custom rate limit override for a tenant.
   */
  setTenantOverride(override: TenantRateLimitOverride): void {
    this.tenantOverrides.set(override.tenantId, override);
    logger.info('Tenant rate limit override set', {
      tenantId: override.tenantId,
      maxRequests: override.maxRequests,
      windowSeconds: override.windowSeconds,
      reason: override.reason,
      expiresAt: override.expiresAt?.toISOString(),
    });
  }
  
  /**
   * Remove a tenant's rate limit override.
   */
  removeTenantOverride(tenantId: string): void {
    this.tenantOverrides.delete(tenantId);
    logger.info('Tenant rate limit override removed', { tenantId });
  }
  
  /**
   * Get all tenant overrides.
   */
  getTenantOverrides(): TenantRateLimitOverride[] {
    return Array.from(this.tenantOverrides.values());
  }
  
  /**
   * Update the global rate limit configuration.
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Rate limiter config updated', this.config as unknown as Record<string, unknown>);
  }
  
  /**
   * Get the current configuration.
   */
  getConfig(): RateLimitConfig {
    return { ...this.config };
  }
  
  /**
   * Create rate limit headers for HTTP responses.
   */
  createHeaders(result: RateLimitResult): Record<string, string> {
    return {
      'X-RateLimit-Limit': String(result.limit),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + result.resetInSeconds),
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let rateLimiterInstance: RateLimiterService | null = null;

/**
 * Get the singleton rate limiter service.
 * Creates a new instance on first call.
 */
export function getRateLimiterService(
  redisClient?: RedisClient,
  config?: Partial<RateLimitConfig>
): RateLimiterService {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RateLimiterService(redisClient, config);
  }
  return rateLimiterInstance;
}

/**
 * Reset the singleton instance (for testing).
 */
export function resetRateLimiterService(): void {
  rateLimiterInstance = null;
}

// Default export for convenience
export const rateLimiterService = getRateLimiterService();

// ============================================================================
// Express/Lambda Middleware
// ============================================================================

/**
 * Rate limiting middleware for Lambda handlers.
 * 
 * Usage:
 *   const handler = withRateLimit(async (event) => {
 *     // Your handler logic
 *   });
 */
export function withRateLimit<T extends { headers?: Record<string, string>; pathParameters?: { tenantId?: string } }>(
  handler: (event: T, context: unknown) => Promise<{ statusCode: number; body: string; headers?: Record<string, string> }>,
  extractTenantId?: (event: T) => string | undefined
): (event: T, context: unknown) => Promise<{ statusCode: number; body: string; headers?: Record<string, string> }> {
  return async (event: T, context: unknown) => {
    const service = getRateLimiterService();
    
    // Extract tenant ID from event
    const tenantId = extractTenantId
      ? extractTenantId(event)
      : event.pathParameters?.tenantId || event.headers?.['x-tenant-id'] || 'default';
    
    if (!tenantId) {
      return handler(event, context);
    }
    
    try {
      const result = await service.enforceLimit(tenantId);
      
      // Call the actual handler
      const response = await handler(event, context);
      
      // Add rate limit headers to response
      return {
        ...response,
        headers: {
          ...response.headers,
          ...service.createHeaders(result),
        },
      };
    } catch (error) {
      if (error instanceof RateLimitExceededError) {
        return error.toResponse();
      }
      throw error;
    }
  };
}
