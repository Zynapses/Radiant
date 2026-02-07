// RADIANT v7.11.0 - Inference Response Cache Types
// Hash-based semantic deduplication for AI inference calls
// Reduces cost and latency by caching identical prompt+model+params combinations
//
// Architecture:
//   prompt + model + temperature + maxTokens + systemPrompt → SHA-256 hash → cache key
//   Cache hit → return stored response (0ms inference, $0 cost)
//   Cache miss → invoke model → store response → return
//
// Cache Layers:
//   L1: In-memory LRU (per Lambda instance, ~100 entries, <1ms)
//   L2: Database (Aurora PostgreSQL, 7-day TTL default, <10ms)
//
// Security:
//   - Cache is tenant-isolated (tenant_id is part of the key)
//   - No cross-tenant cache hits possible
//   - PII-containing prompts can be excluded via config
//   - Cache entries are soft-deleted, not hard-deleted

// ============================================================================
// Core Cache Types
// ============================================================================

/**
 * Unique identifier for a cached inference response.
 * Computed as SHA-256 of: tenantId + modelId + prompt + systemPrompt + temperature + maxTokens
 */
export type InferenceCacheKey = string;

/**
 * Supported hash algorithms for cache key generation.
 * SHA-256 is the default for security and collision resistance.
 */
export type CacheHashAlgorithm = 'sha256' | 'sha384' | 'sha512';

/**
 * Cache entry status lifecycle.
 * - `active`: Entry is valid and can be served
 * - `expired`: TTL exceeded, awaiting cleanup
 * - `invalidated`: Manually invalidated by admin
 * - `evicted`: Removed due to capacity limits
 */
export type CacheEntryStatus = 'active' | 'expired' | 'invalidated' | 'evicted';

/**
 * Reason for cache invalidation.
 * Used in audit trail to track why entries were removed.
 */
export type CacheInvalidationReason =
  | 'ttl_expired'        // Time-to-live exceeded
  | 'manual_admin'       // Admin manually invalidated
  | 'model_updated'      // Underlying model was updated
  | 'config_changed'     // Cache configuration changed
  | 'capacity_eviction'  // LRU eviction due to capacity
  | 'tenant_purge'       // Tenant requested full cache purge
  | 'security_concern';  // Security team flagged the entry

// ============================================================================
// Cache Entry
// ============================================================================

/**
 * A single cached inference response.
 * Stores the complete request fingerprint and response for replay.
 */
export interface InferenceCacheEntry {
  /** SHA-256 hash of the request parameters (primary key) */
  cacheKey: InferenceCacheKey;

  /** Tenant that owns this cache entry (isolation boundary) */
  tenantId: string;

  /** The model that generated this response */
  modelId: string;

  /** Hash of the prompt text (not the full prompt, for storage efficiency) */
  promptHash: string;

  /** Length of the original prompt in characters */
  promptLength: number;

  /** Hash of the system prompt, if any */
  systemPromptHash: string | null;

  /** Temperature used for generation */
  temperature: number;

  /** Max tokens requested */
  maxTokens: number;

  /** The cached response text */
  cachedResponse: string;

  /** Token counts from the original response */
  inputTokens: number;
  outputTokens: number;

  /** Cost of the original inference call in USD */
  originalCostUsd: number;

  /** Latency of the original inference call in ms */
  originalLatencyMs: number;

  /** Provider that served the original request */
  provider: string;

  /** Current status of this cache entry */
  status: CacheEntryStatus;

  /** Number of times this entry has been served from cache */
  hitCount: number;

  /** Total cost saved by serving from cache (hitCount × originalCostUsd) */
  totalCostSavedUsd: number;

  /** Total latency saved by serving from cache */
  totalLatencySavedMs: number;

  /** When this entry was first created */
  createdAt: string;

  /** When this entry was last served from cache */
  lastAccessedAt: string;

  /** When this entry expires (createdAt + TTL) */
  expiresAt: string;

  /** When this entry was invalidated, if applicable */
  invalidatedAt: string | null;

  /** Reason for invalidation, if applicable */
  invalidationReason: CacheInvalidationReason | null;
}

// ============================================================================
// Cache Configuration (Per-Tenant)
// ============================================================================

/**
 * Per-tenant configuration for the inference cache.
 * Controls caching behavior, TTL, exclusions, and capacity limits.
 */
export interface InferenceCacheConfig {
  /** Tenant ID (null = global defaults) */
  tenantId: string | null;

  /** Master toggle: enable/disable caching for this tenant */
  enabled: boolean;

  /** Default time-to-live for cache entries in seconds (default: 604800 = 7 days) */
  defaultTtlSeconds: number;

  /** Maximum number of cache entries per tenant (default: 10000) */
  maxEntriesPerTenant: number;

  /** Maximum cached response size in bytes (default: 65536 = 64KB) */
  maxResponseSizeBytes: number;

  /** Minimum prompt length to cache (very short prompts are unlikely to repeat) */
  minPromptLengthToCache: number;

  /** Hash algorithm for cache key generation */
  hashAlgorithm: CacheHashAlgorithm;

  /**
   * Task types to exclude from caching.
   * Creative tasks with high temperature are poor cache candidates.
   */
  excludedTaskTypes: string[];

  /**
   * Models to exclude from caching.
   * Some models (e.g., real-time search models) should never be cached.
   */
  excludedModels: string[];

  /**
   * Temperature threshold: don't cache responses generated with temperature above this.
   * Higher temperatures produce varied outputs, making caching counterproductive.
   * Default: 0.3 (only cache deterministic/near-deterministic outputs)
   */
  maxTemperatureToCache: number;

  /**
   * Whether to cache responses that contain PII markers.
   * When false, responses containing detected PII patterns are not cached.
   */
  cachePiiResponses: boolean;

  /**
   * L1 in-memory cache size (entries per Lambda instance).
   * Default: 100. Set to 0 to disable L1 cache.
   */
  l1CacheSize: number;

  /** When configuration was last updated */
  updatedAt: string;

  /** Who last updated the configuration */
  updatedBy: string;
}

/**
 * Default configuration values for new tenants.
 */
export const DEFAULT_INFERENCE_CACHE_CONFIG: Omit<InferenceCacheConfig, 'tenantId' | 'updatedAt' | 'updatedBy'> = {
  enabled: true,
  defaultTtlSeconds: 604800, // 7 days
  maxEntriesPerTenant: 10000,
  maxResponseSizeBytes: 65536, // 64KB
  minPromptLengthToCache: 20,
  hashAlgorithm: 'sha256',
  excludedTaskTypes: ['creative'], // Creative tasks are too varied
  excludedModels: [
    'perplexity/llama-3.1-sonar-large',  // Real-time search
    'perplexity/llama-3.1-sonar-small',  // Real-time search
  ],
  maxTemperatureToCache: 0.3,
  cachePiiResponses: false,
  l1CacheSize: 100,
};

// ============================================================================
// Cache Metrics & Dashboard
// ============================================================================

/**
 * Real-time cache performance metrics for the admin dashboard.
 */
export interface InferenceCacheMetrics {
  /** Time period for these metrics */
  periodStart: string;
  periodEnd: string;
  tenantId: string | null; // null = global

  /** Hit/miss statistics */
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number; // 0.0 - 1.0

  /** Cost savings */
  totalCostSavedUsd: number;
  avgCostPerHitUsd: number;
  projectedMonthlySavingsUsd: number;

  /** Latency improvements */
  totalLatencySavedMs: number;
  avgLatencyReductionMs: number;
  avgCacheResponseTimeMs: number; // How fast cache serves (should be <10ms)

  /** Storage statistics */
  totalEntries: number;
  activeEntries: number;
  expiredEntries: number;
  totalStorageSizeBytes: number;

  /** Top cached models */
  topCachedModels: Array<{
    modelId: string;
    hitCount: number;
    costSavedUsd: number;
  }>;

  /** Eviction statistics */
  evictionsInPeriod: number;
  invalidationsInPeriod: number;
}

/**
 * Cache event for the audit log.
 * Every cache operation is logged for transparency and debugging.
 */
export interface InferenceCacheEvent {
  eventId: string;
  tenantId: string;
  cacheKey: InferenceCacheKey;
  eventType: 'hit' | 'miss' | 'store' | 'evict' | 'invalidate' | 'purge';
  modelId: string;
  promptHash: string;
  responseTimeMs: number;
  costSavedUsd: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/**
 * Full dashboard data for the admin UI.
 */
export interface InferenceCacheDashboard {
  config: InferenceCacheConfig;
  metrics: InferenceCacheMetrics;
  recentEvents: InferenceCacheEvent[];
  topEntries: InferenceCacheEntry[];
  modelBreakdown: Array<{
    modelId: string;
    provider: string;
    totalEntries: number;
    hitRate: number;
    costSavedUsd: number;
  }>;
}

// ============================================================================
// Cache Operation Types (for service layer)
// ============================================================================

/**
 * Input for computing a cache key.
 * All fields that affect the output must be included.
 */
export interface CacheKeyInput {
  tenantId: string;
  modelId: string;
  prompt: string;
  systemPrompt?: string;
  temperature: number;
  maxTokens: number;
}

/**
 * Result of a cache lookup operation.
 */
export interface CacheLookupResult {
  /** Whether the cache contained a valid entry */
  hit: boolean;
  /** The cached entry, if hit */
  entry: InferenceCacheEntry | null;
  /** Which cache layer served the response */
  source: 'l1_memory' | 'l2_database' | 'miss';
  /** Time to perform the lookup in ms */
  lookupTimeMs: number;
}

/**
 * Result of a cache store operation.
 */
export interface CacheStoreResult {
  /** Whether the response was stored successfully */
  stored: boolean;
  /** The cache key that was stored */
  cacheKey: InferenceCacheKey;
  /** Reason if not stored */
  skipReason?: 'disabled' | 'excluded_model' | 'excluded_task' | 'temperature_too_high' |
    'response_too_large' | 'prompt_too_short' | 'pii_detected' | 'capacity_exceeded' | 'error';
}
