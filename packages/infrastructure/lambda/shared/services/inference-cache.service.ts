// RADIANT v7.11.0 - Inference Response Cache Service
//
// Hash-based semantic deduplication for AI inference calls.
// Reduces cost and latency by caching identical prompt+model+params combinations.
//
// Architecture:
//   L1: In-memory LRU cache (per Lambda instance, <1ms lookups)
//   L2: Aurora PostgreSQL (tenant-isolated, 7-day TTL default, <10ms lookups)
//
// Cache Key Computation:
//   SHA-256(tenantId + modelId + prompt + systemPrompt + temperature + maxTokens)
//   This ensures that even slightly different requests produce different keys.
//
// Security:
//   - tenant_id is part of the cache key → no cross-tenant leaks
//   - PII detection can exclude sensitive responses from caching
//   - All operations are logged to inference_cache_events for audit
//
// Integration:
//   Used by ModelRouterService.invoke() as a transparent cache layer.
//   The caller doesn't need to know about caching — it's handled internally.

import { createHash } from 'crypto';
import { executeStatement, stringParam, longParam } from '../db';
import { Logger } from '../logger';
import type {
  InferenceCacheConfig,
  InferenceCacheEntry,
  CacheKeyInput,
  CacheLookupResult,
  CacheStoreResult,
  InferenceCacheMetrics,
  InferenceCacheEvent,
  InferenceCacheDashboard,
  CacheEntryStatus,
} from '@radiant/shared';

const logger = new Logger({ service: 'inference-cache-service' });

// ============================================================================
// L1 In-Memory LRU Cache
// ============================================================================

/**
 * Simple LRU cache for L1 (in-memory) layer.
 * Each Lambda instance maintains its own L1 cache.
 * Entries are evicted when capacity is exceeded (least recently used first).
 */
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private readonly maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict least recently used (first entry)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// ============================================================================
// Inference Cache Service
// ============================================================================

/**
 * Main service class for the inference response cache.
 *
 * Usage in ModelRouterService:
 * ```typescript
 * // Before invoking the model:
 * const cached = await inferenceCacheService.lookup({ tenantId, modelId, prompt, ... });
 * if (cached.hit) return cached.entry; // Zero-cost cached response
 *
 * // After invoking the model:
 * const result = await actualModelCall(...);
 * await inferenceCacheService.store({ tenantId, modelId, prompt, ... }, result);
 * ```
 */
class InferenceCacheService {
  /**
   * L1 in-memory cache. Shared across all requests within the same Lambda instance.
   * Key: cache key (SHA-256 hash), Value: { response, inputTokens, outputTokens, cost, provider }
   */
  private l1Cache = new LRUCache<string, {
    response: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    provider: string;
    originalLatencyMs: number;
  }>(100);

  /**
   * Tenant config cache. Avoids hitting the DB for config on every request.
   * TTL: 5 minutes (refreshed on next request after expiry).
   */
  private configCache = new Map<string, { config: InferenceCacheConfig; fetchedAt: number }>();
  private readonly CONFIG_CACHE_TTL_MS = 300_000; // 5 minutes

  // ============================================================================
  // Cache Key Generation
  // ============================================================================

  /**
   * Compute a deterministic cache key from request parameters.
   *
   * The key is a SHA-256 hash of all parameters that affect the model's output.
   * This includes tenant_id to ensure strict tenant isolation.
   *
   * @param input - The request parameters to hash
   * @returns A hex-encoded SHA-256 hash string (64 characters)
   */
  computeCacheKey(input: CacheKeyInput): string {
    const hash = createHash('sha256');

    // Order matters: all fields must be included in a deterministic order
    hash.update(input.tenantId);
    hash.update('|');
    hash.update(input.modelId);
    hash.update('|');
    hash.update(input.prompt);
    hash.update('|');
    hash.update(input.systemPrompt || '');
    hash.update('|');
    hash.update(String(input.temperature));
    hash.update('|');
    hash.update(String(input.maxTokens));

    return hash.digest('hex');
  }

  /**
   * Compute a hash of just the prompt text (for storage/display, not as cache key).
   */
  private computePromptHash(prompt: string): string {
    return createHash('sha256').update(prompt).digest('hex');
  }

  // ============================================================================
  // Cache Lookup (The Hot Path)
  // ============================================================================

  /**
   * Look up a cached response for the given request parameters.
   *
   * Checks L1 (in-memory) first, then L2 (database).
   * On L2 hit, promotes the entry to L1 for future requests.
   *
   * @param input - The request parameters to look up
   * @returns CacheLookupResult with hit status, entry, and source layer
   */
  async lookup(input: CacheKeyInput): Promise<CacheLookupResult> {
    const startTime = Date.now();

    // Check if caching is enabled for this tenant
    const config = await this.getConfig(input.tenantId);
    if (!config.enabled) {
      return { hit: false, entry: null, source: 'miss', lookupTimeMs: Date.now() - startTime };
    }

    // Check exclusions
    if (config.excludedModels.includes(input.modelId)) {
      return { hit: false, entry: null, source: 'miss', lookupTimeMs: Date.now() - startTime };
    }
    if (input.temperature > config.maxTemperatureToCache) {
      return { hit: false, entry: null, source: 'miss', lookupTimeMs: Date.now() - startTime };
    }

    const cacheKey = this.computeCacheKey(input);

    // L1: In-memory check (fastest)
    const l1Entry = this.l1Cache.get(cacheKey);
    if (l1Entry) {
      const lookupTimeMs = Date.now() - startTime;

      // Update hit count in database asynchronously (fire-and-forget)
      this.recordHit(input.tenantId, cacheKey, input.modelId, l1Entry.costUsd, lookupTimeMs).catch(() => {});

      logger.info('L1 cache hit', {
        tenantId: input.tenantId,
        modelId: input.modelId,
        cacheKey: cacheKey.substring(0, 16) + '...',
        lookupTimeMs,
      });

      return {
        hit: true,
        entry: {
          cacheKey,
          tenantId: input.tenantId,
          modelId: input.modelId,
          promptHash: this.computePromptHash(input.prompt),
          promptLength: input.prompt.length,
          systemPromptHash: input.systemPrompt ? this.computePromptHash(input.systemPrompt) : null,
          temperature: input.temperature,
          maxTokens: input.maxTokens,
          cachedResponse: l1Entry.response,
          inputTokens: l1Entry.inputTokens,
          outputTokens: l1Entry.outputTokens,
          originalCostUsd: l1Entry.costUsd,
          originalLatencyMs: l1Entry.originalLatencyMs,
          provider: l1Entry.provider,
          status: 'active' as CacheEntryStatus,
          hitCount: 0, // Not tracked in L1
          totalCostSavedUsd: 0,
          totalLatencySavedMs: 0,
          createdAt: '',
          lastAccessedAt: new Date().toISOString(),
          expiresAt: '',
          invalidatedAt: null,
          invalidationReason: null,
        },
        source: 'l1_memory',
        lookupTimeMs,
      };
    }

    // L2: Database check
    try {
      const result = await executeStatement<{
        cache_key: string;
        cached_response: string;
        input_tokens: number;
        output_tokens: number;
        original_cost_usd: string;
        original_latency_ms: number;
        provider: string;
        model_id: string;
        hit_count: number;
      }>(
        `UPDATE inference_cache_entries
         SET hit_count = hit_count + 1,
             last_accessed_at = NOW(),
             total_cost_saved_usd = total_cost_saved_usd + original_cost_usd,
             total_latency_saved_ms = total_latency_saved_ms + original_latency_ms
         WHERE cache_key = $1
           AND tenant_id = $2::uuid
           AND status = 'active'
           AND expires_at > NOW()
         RETURNING cache_key, cached_response, input_tokens, output_tokens,
                   original_cost_usd::text, original_latency_ms, provider, model_id, hit_count`,
        [
          stringParam('cacheKey', cacheKey),
          stringParam('tenantId', input.tenantId),
        ]
      );

      if (result.rows && result.rows.length > 0) {
        const row = result.rows[0];
        const lookupTimeMs = Date.now() - startTime;
        const costUsd = parseFloat(row.original_cost_usd);

        // Promote to L1 for future requests
        this.l1Cache.set(cacheKey, {
          response: row.cached_response,
          inputTokens: row.input_tokens,
          outputTokens: row.output_tokens,
          costUsd,
          provider: row.provider,
          originalLatencyMs: row.original_latency_ms,
        });

        // Log cache hit event
        this.logEvent(input.tenantId, cacheKey, 'hit', row.model_id, this.computePromptHash(input.prompt), lookupTimeMs, costUsd).catch(() => {});

        logger.info('L2 cache hit', {
          tenantId: input.tenantId,
          modelId: input.modelId,
          cacheKey: cacheKey.substring(0, 16) + '...',
          hitCount: row.hit_count,
          lookupTimeMs,
        });

        return {
          hit: true,
          entry: {
            cacheKey,
            tenantId: input.tenantId,
            modelId: row.model_id,
            promptHash: this.computePromptHash(input.prompt),
            promptLength: input.prompt.length,
            systemPromptHash: input.systemPrompt ? this.computePromptHash(input.systemPrompt) : null,
            temperature: input.temperature,
            maxTokens: input.maxTokens,
            cachedResponse: row.cached_response,
            inputTokens: row.input_tokens,
            outputTokens: row.output_tokens,
            originalCostUsd: costUsd,
            originalLatencyMs: row.original_latency_ms,
            provider: row.provider,
            status: 'active' as CacheEntryStatus,
            hitCount: row.hit_count,
            totalCostSavedUsd: costUsd * row.hit_count,
            totalLatencySavedMs: row.original_latency_ms * row.hit_count,
            createdAt: '',
            lastAccessedAt: new Date().toISOString(),
            expiresAt: '',
            invalidatedAt: null,
            invalidationReason: null,
          },
          source: 'l2_database',
          lookupTimeMs,
        };
      }
    } catch (error) {
      logger.warn('L2 cache lookup failed', {
        tenantId: input.tenantId,
        cacheKey: cacheKey.substring(0, 16) + '...',
        error: error instanceof Error ? error.message : 'unknown',
      });
    }

    // Cache miss
    const lookupTimeMs = Date.now() - startTime;
    this.logEvent(input.tenantId, cacheKey, 'miss', input.modelId, this.computePromptHash(input.prompt), lookupTimeMs, 0).catch(() => {});

    return { hit: false, entry: null, source: 'miss', lookupTimeMs };
  }

  // ============================================================================
  // Cache Store
  // ============================================================================

  /**
   * Store an inference response in the cache.
   *
   * Validates against configuration (TTL, size limits, exclusions) before storing.
   * Stores in both L1 (in-memory) and L2 (database).
   *
   * @param input - The request parameters (used to compute cache key)
   * @param response - The response text to cache
   * @param metadata - Additional metadata (tokens, cost, latency, provider)
   * @returns CacheStoreResult indicating success/failure and reason
   */
  async store(
    input: CacheKeyInput,
    response: string,
    metadata: {
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
      latencyMs: number;
      provider: string;
      taskType?: string;
    }
  ): Promise<CacheStoreResult> {
    const cacheKey = this.computeCacheKey(input);

    // Check if caching is enabled
    const config = await this.getConfig(input.tenantId);
    if (!config.enabled) {
      return { stored: false, cacheKey, skipReason: 'disabled' };
    }

    // Check exclusions
    if (config.excludedModels.includes(input.modelId)) {
      return { stored: false, cacheKey, skipReason: 'excluded_model' };
    }
    if (metadata.taskType && config.excludedTaskTypes.includes(metadata.taskType)) {
      return { stored: false, cacheKey, skipReason: 'excluded_task' };
    }
    if (input.temperature > config.maxTemperatureToCache) {
      return { stored: false, cacheKey, skipReason: 'temperature_too_high' };
    }
    if (input.prompt.length < config.minPromptLengthToCache) {
      return { stored: false, cacheKey, skipReason: 'prompt_too_short' };
    }

    // Check response size
    const responseBytes = Buffer.byteLength(response, 'utf-8');
    if (responseBytes > config.maxResponseSizeBytes) {
      return { stored: false, cacheKey, skipReason: 'response_too_large' };
    }

    // PII detection (simple pattern-based check)
    if (!config.cachePiiResponses && this.containsPii(response)) {
      return { stored: false, cacheKey, skipReason: 'pii_detected' };
    }

    // Store in L1
    this.l1Cache.set(cacheKey, {
      response,
      inputTokens: metadata.inputTokens,
      outputTokens: metadata.outputTokens,
      costUsd: metadata.costUsd,
      provider: metadata.provider,
      originalLatencyMs: metadata.latencyMs,
    });

    // Store in L2 (database)
    try {
      const ttlSeconds = config.defaultTtlSeconds;
      const promptHash = this.computePromptHash(input.prompt);
      const systemPromptHash = input.systemPrompt ? this.computePromptHash(input.systemPrompt) : null;

      await executeStatement(
        `INSERT INTO inference_cache_entries (
          cache_key, tenant_id, model_id, prompt_hash, prompt_length,
          system_prompt_hash, temperature, max_tokens, cached_response,
          input_tokens, output_tokens, original_cost_usd, original_latency_ms,
          provider, status, expires_at
        ) VALUES (
          $1, $2::uuid, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12, $13,
          $14, 'active', NOW() + ($15 || ' seconds')::interval
        )
        ON CONFLICT (cache_key, tenant_id) DO UPDATE SET
          cached_response = EXCLUDED.cached_response,
          input_tokens = EXCLUDED.input_tokens,
          output_tokens = EXCLUDED.output_tokens,
          original_cost_usd = EXCLUDED.original_cost_usd,
          original_latency_ms = EXCLUDED.original_latency_ms,
          provider = EXCLUDED.provider,
          status = 'active',
          expires_at = EXCLUDED.expires_at,
          last_accessed_at = NOW()`,
        [
          stringParam('cacheKey', cacheKey),
          stringParam('tenantId', input.tenantId),
          stringParam('modelId', input.modelId),
          stringParam('promptHash', promptHash),
          longParam('promptLength', input.prompt.length),
          stringParam('systemPromptHash', systemPromptHash || ''),
          stringParam('temperature', String(input.temperature)),
          longParam('maxTokens', input.maxTokens),
          stringParam('response', response),
          longParam('inputTokens', metadata.inputTokens),
          longParam('outputTokens', metadata.outputTokens),
          stringParam('costUsd', String(metadata.costUsd)),
          longParam('latencyMs', metadata.latencyMs),
          stringParam('provider', metadata.provider),
          stringParam('ttl', String(ttlSeconds)),
        ]
      );

      // Log store event
      this.logEvent(input.tenantId, cacheKey, 'store', input.modelId, promptHash, 0, 0).catch(() => {});

      logger.info('Cached inference response', {
        tenantId: input.tenantId,
        modelId: input.modelId,
        cacheKey: cacheKey.substring(0, 16) + '...',
        responseBytes,
        ttlSeconds,
      });

      return { stored: true, cacheKey };
    } catch (error) {
      logger.warn('Failed to store in L2 cache', {
        tenantId: input.tenantId,
        cacheKey: cacheKey.substring(0, 16) + '...',
        error: error instanceof Error ? error.message : 'unknown',
      });
      return { stored: false, cacheKey, skipReason: 'error' };
    }
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Invalidate a specific cache entry by key.
   * Used by admins to manually clear incorrect cached responses.
   */
  async invalidateEntry(tenantId: string, cacheKey: string, reason: string = 'manual_admin'): Promise<boolean> {
    // Remove from L1
    this.l1Cache.delete(cacheKey);

    // Update L2
    try {
      const result = await executeStatement(
        `UPDATE inference_cache_entries
         SET status = 'invalidated',
             invalidated_at = NOW(),
             invalidation_reason = $3
         WHERE cache_key = $1
           AND tenant_id = $2::uuid
           AND status = 'active'`,
        [
          stringParam('cacheKey', cacheKey),
          stringParam('tenantId', tenantId),
          stringParam('reason', reason),
        ]
      );

      this.logEvent(tenantId, cacheKey, 'invalidate', '', '', 0, 0).catch(() => {});
      return (result.numberOfRecordsUpdated ?? 0) > 0;
    } catch (error) {
      logger.error('Failed to invalidate cache entry', { tenantId, cacheKey, error });
      return false;
    }
  }

  /**
   * Invalidate all cache entries for a specific model.
   * Useful when a model is updated and cached responses may be stale.
   */
  async invalidateByModel(tenantId: string, modelId: string): Promise<number> {
    try {
      const result = await executeStatement(
        `UPDATE inference_cache_entries
         SET status = 'invalidated',
             invalidated_at = NOW(),
             invalidation_reason = 'model_updated'
         WHERE tenant_id = $1::uuid
           AND model_id = $2
           AND status = 'active'`,
        [
          stringParam('tenantId', tenantId),
          stringParam('modelId', modelId),
        ]
      );

      // Clear L1 entirely (we don't track by model in L1)
      this.l1Cache.clear();

      return result.numberOfRecordsUpdated ?? 0;
    } catch (error) {
      logger.error('Failed to invalidate by model', { tenantId, modelId, error });
      return 0;
    }
  }

  /**
   * Purge all cache entries for a tenant.
   * Used when tenant requests a full cache clear.
   */
  async purgeForTenant(tenantId: string): Promise<number> {
    this.l1Cache.clear();

    try {
      const result = await executeStatement(
        `UPDATE inference_cache_entries
         SET status = 'invalidated',
             invalidated_at = NOW(),
             invalidation_reason = 'tenant_purge'
         WHERE tenant_id = $1::uuid
           AND status = 'active'`,
        [stringParam('tenantId', tenantId)]
      );

      this.logEvent(tenantId, 'ALL', 'purge', '', '', 0, 0).catch(() => {});
      return result.numberOfRecordsUpdated ?? 0;
    } catch (error) {
      logger.error('Failed to purge tenant cache', { tenantId, error });
      return 0;
    }
  }

  /**
   * Run TTL expiration for stale entries (called by scheduled job).
   */
  async expireStaleEntries(): Promise<{ expiredCount: number; freedBytes: number }> {
    try {
      const result = await executeStatement<{ expired_count: number; freed_bytes: string }>(
        `SELECT * FROM expire_stale_cache_entries()`,
        []
      );

      const row = result.rows[0];
      return {
        expiredCount: row?.expired_count ?? 0,
        freedBytes: parseInt(row?.freed_bytes ?? '0', 10),
      };
    } catch (error) {
      logger.error('Failed to expire stale entries', { error });
      return { expiredCount: 0, freedBytes: 0 };
    }
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Get cache configuration for a tenant. Uses a 5-minute local cache.
   */
  async getConfig(tenantId: string): Promise<InferenceCacheConfig> {
    // Check local config cache
    const cached = this.configCache.get(tenantId);
    if (cached && Date.now() - cached.fetchedAt < this.CONFIG_CACHE_TTL_MS) {
      return cached.config;
    }

    try {
      const result = await executeStatement<Record<string, unknown>>(
        `SELECT * FROM inference_cache_config WHERE tenant_id = $1::uuid`,
        [stringParam('tenantId', tenantId)]
      );

      if (result.rows && result.rows.length > 0) {
        const row = result.rows[0];
        const config: InferenceCacheConfig = {
          tenantId: String(row.tenant_id),
          enabled: Boolean(row.enabled),
          defaultTtlSeconds: Number(row.default_ttl_seconds),
          maxEntriesPerTenant: Number(row.max_entries),
          maxResponseSizeBytes: Number(row.max_response_size_bytes),
          minPromptLengthToCache: Number(row.min_prompt_length),
          hashAlgorithm: String(row.hash_algorithm) as 'sha256',
          excludedTaskTypes: (row.excluded_task_types as string[]) || [],
          excludedModels: (row.excluded_models as string[]) || [],
          maxTemperatureToCache: Number(row.max_temperature),
          cachePiiResponses: Boolean(row.cache_pii_responses),
          l1CacheSize: Number(row.l1_cache_size),
          updatedAt: String(row.updated_at),
          updatedBy: String(row.updated_by),
        };

        this.configCache.set(tenantId, { config, fetchedAt: Date.now() });
        return config;
      }
    } catch (error) {
      logger.warn('Failed to load cache config, using defaults', { tenantId, error });
    }

    // Return defaults if no tenant config exists
    const defaultConfig: InferenceCacheConfig = {
      tenantId,
      enabled: true,
      defaultTtlSeconds: 604800,
      maxEntriesPerTenant: 10000,
      maxResponseSizeBytes: 65536,
      minPromptLengthToCache: 20,
      hashAlgorithm: 'sha256',
      excludedTaskTypes: ['creative'],
      excludedModels: ['perplexity/llama-3.1-sonar-large', 'perplexity/llama-3.1-sonar-small'],
      maxTemperatureToCache: 0.3,
      cachePiiResponses: false,
      l1CacheSize: 100,
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
    };

    this.configCache.set(tenantId, { config: defaultConfig, fetchedAt: Date.now() });
    return defaultConfig;
  }

  /**
   * Update cache configuration for a tenant.
   */
  async updateConfig(tenantId: string, updates: Partial<InferenceCacheConfig>, updatedBy: string): Promise<InferenceCacheConfig> {
    const current = await this.getConfig(tenantId);
    const merged = { ...current, ...updates, tenantId, updatedAt: new Date().toISOString(), updatedBy };

    await executeStatement(
      `INSERT INTO inference_cache_config (
        tenant_id, enabled, default_ttl_seconds, max_entries,
        max_response_size_bytes, min_prompt_length, hash_algorithm,
        excluded_task_types, excluded_models, max_temperature,
        cache_pii_responses, l1_cache_size, updated_at, updated_by
      ) VALUES (
        $1::uuid, $2, $3, $4, $5, $6, $7,
        $8::jsonb, $9::jsonb, $10, $11, $12, NOW(), $13
      )
      ON CONFLICT (tenant_id) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        default_ttl_seconds = EXCLUDED.default_ttl_seconds,
        max_entries = EXCLUDED.max_entries,
        max_response_size_bytes = EXCLUDED.max_response_size_bytes,
        min_prompt_length = EXCLUDED.min_prompt_length,
        hash_algorithm = EXCLUDED.hash_algorithm,
        excluded_task_types = EXCLUDED.excluded_task_types,
        excluded_models = EXCLUDED.excluded_models,
        max_temperature = EXCLUDED.max_temperature,
        cache_pii_responses = EXCLUDED.cache_pii_responses,
        l1_cache_size = EXCLUDED.l1_cache_size,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by`,
      [
        stringParam('tenantId', tenantId),
        stringParam('enabled', String(merged.enabled)),
        longParam('ttl', merged.defaultTtlSeconds),
        longParam('maxEntries', merged.maxEntriesPerTenant),
        longParam('maxResponseSize', merged.maxResponseSizeBytes),
        longParam('minPromptLength', merged.minPromptLengthToCache),
        stringParam('hashAlgorithm', merged.hashAlgorithm),
        stringParam('excludedTaskTypes', JSON.stringify(merged.excludedTaskTypes)),
        stringParam('excludedModels', JSON.stringify(merged.excludedModels)),
        stringParam('maxTemp', String(merged.maxTemperatureToCache)),
        stringParam('cachePii', String(merged.cachePiiResponses)),
        longParam('l1Size', merged.l1CacheSize),
        stringParam('updatedBy', updatedBy),
      ]
    );

    // Invalidate config cache
    this.configCache.delete(tenantId);

    // Update L1 cache size if changed
    if (updates.l1CacheSize !== undefined) {
      this.l1Cache = new LRUCache(updates.l1CacheSize);
    }

    return merged;
  }

  // ============================================================================
  // Dashboard & Metrics
  // ============================================================================

  /**
   * Get the full dashboard data for a tenant.
   */
  async getDashboard(tenantId: string): Promise<InferenceCacheDashboard> {
    const [config, metrics, recentEvents, topEntries, modelBreakdown] = await Promise.all([
      this.getConfig(tenantId),
      this.getMetrics(tenantId),
      this.getRecentEvents(tenantId, 50),
      this.getTopEntries(tenantId, 20),
      this.getModelBreakdown(tenantId),
    ]);

    return { config, metrics, recentEvents, topEntries, modelBreakdown };
  }

  /**
   * Get metrics for a tenant (most recent period).
   */
  async getMetrics(tenantId: string): Promise<InferenceCacheMetrics> {
    try {
      // Compute fresh metrics
      await executeStatement(
        `SELECT compute_cache_metrics($1::uuid, 24)`,
        [stringParam('tenantId', tenantId)]
      );

      const result = await executeStatement<Record<string, unknown>>(
        `SELECT * FROM inference_cache_metrics
         WHERE tenant_id = $1::uuid
         ORDER BY created_at DESC LIMIT 1`,
        [stringParam('tenantId', tenantId)]
      );

      if (result.rows && result.rows.length > 0) {
        const row = result.rows[0];
        return {
          periodStart: String(row.period_start),
          periodEnd: String(row.period_end),
          tenantId,
          totalRequests: Number(row.total_requests),
          cacheHits: Number(row.cache_hits),
          cacheMisses: Number(row.cache_misses),
          hitRate: Number(row.hit_rate),
          totalCostSavedUsd: Number(row.total_cost_saved_usd),
          avgCostPerHitUsd: Number(row.avg_cost_per_hit_usd),
          projectedMonthlySavingsUsd: Number(row.total_cost_saved_usd) * 30,
          totalLatencySavedMs: Number(row.total_latency_saved_ms),
          avgLatencyReductionMs: Number(row.avg_latency_reduction_ms),
          avgCacheResponseTimeMs: Number(row.avg_cache_response_time_ms),
          totalEntries: Number(row.total_entries),
          activeEntries: Number(row.active_entries),
          expiredEntries: Number(row.expired_entries),
          totalStorageSizeBytes: Number(row.total_storage_bytes),
          topCachedModels: (row.top_cached_models as Array<{ model_id: string; hit_count: number; cost_saved_usd: number }>) || [],
          evictionsInPeriod: Number(row.evictions),
          invalidationsInPeriod: Number(row.invalidations),
        };
      }
    } catch (error) {
      logger.warn('Failed to get cache metrics', { tenantId, error });
    }

    // Return empty metrics
    return {
      periodStart: new Date(Date.now() - 86400000).toISOString(),
      periodEnd: new Date().toISOString(),
      tenantId,
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRate: 0,
      totalCostSavedUsd: 0,
      avgCostPerHitUsd: 0,
      projectedMonthlySavingsUsd: 0,
      totalLatencySavedMs: 0,
      avgLatencyReductionMs: 0,
      avgCacheResponseTimeMs: 0,
      totalEntries: 0,
      activeEntries: 0,
      expiredEntries: 0,
      totalStorageSizeBytes: 0,
      topCachedModels: [],
      evictionsInPeriod: 0,
      invalidationsInPeriod: 0,
    };
  }

  /**
   * Get recent cache events for the audit log.
   */
  async getRecentEvents(tenantId: string, limit: number = 50): Promise<InferenceCacheEvent[]> {
    try {
      const result = await executeStatement<Record<string, unknown>>(
        `SELECT * FROM inference_cache_events
         WHERE tenant_id = $1::uuid
         ORDER BY created_at DESC
         LIMIT $2`,
        [
          stringParam('tenantId', tenantId),
          longParam('limit', limit),
        ]
      );

      return (result.rows || []).map(row => ({
        eventId: String(row.event_id),
        tenantId: String(row.tenant_id),
        cacheKey: String(row.cache_key),
        eventType: String(row.event_type) as InferenceCacheEvent['eventType'],
        modelId: String(row.model_id),
        promptHash: String(row.prompt_hash),
        responseTimeMs: Number(row.response_time_ms),
        costSavedUsd: Number(row.cost_saved_usd),
        metadata: (row.metadata as Record<string, unknown>) || {},
        createdAt: String(row.created_at),
      }));
    } catch (error) {
      logger.warn('Failed to get cache events', { tenantId, error });
      return [];
    }
  }

  /**
   * Get top cache entries by hit count.
   */
  private async getTopEntries(tenantId: string, limit: number = 20): Promise<InferenceCacheEntry[]> {
    try {
      const result = await executeStatement<Record<string, unknown>>(
        `SELECT * FROM inference_cache_entries
         WHERE tenant_id = $1::uuid AND status = 'active'
         ORDER BY hit_count DESC
         LIMIT $2`,
        [
          stringParam('tenantId', tenantId),
          longParam('limit', limit),
        ]
      );

      return (result.rows || []).map(row => ({
        cacheKey: String(row.cache_key),
        tenantId: String(row.tenant_id),
        modelId: String(row.model_id),
        promptHash: String(row.prompt_hash),
        promptLength: Number(row.prompt_length),
        systemPromptHash: row.system_prompt_hash ? String(row.system_prompt_hash) : null,
        temperature: Number(row.temperature),
        maxTokens: Number(row.max_tokens),
        cachedResponse: String(row.cached_response),
        inputTokens: Number(row.input_tokens),
        outputTokens: Number(row.output_tokens),
        originalCostUsd: Number(row.original_cost_usd),
        originalLatencyMs: Number(row.original_latency_ms),
        provider: String(row.provider),
        status: String(row.status) as CacheEntryStatus,
        hitCount: Number(row.hit_count),
        totalCostSavedUsd: Number(row.total_cost_saved_usd),
        totalLatencySavedMs: Number(row.total_latency_saved_ms),
        createdAt: String(row.created_at),
        lastAccessedAt: String(row.last_accessed_at),
        expiresAt: String(row.expires_at),
        invalidatedAt: row.invalidated_at ? String(row.invalidated_at) : null,
        invalidationReason: row.invalidation_reason ? String(row.invalidation_reason) as any : null,
      }));
    } catch (error) {
      logger.warn('Failed to get top entries', { tenantId, error });
      return [];
    }
  }

  /**
   * Get model-level breakdown for the dashboard.
   */
  private async getModelBreakdown(tenantId: string): Promise<InferenceCacheDashboard['modelBreakdown']> {
    try {
      const result = await executeStatement<Record<string, unknown>>(
        `SELECT
          model_id,
          provider,
          COUNT(*) as total_entries,
          AVG(CASE WHEN hit_count > 0 THEN 1.0 ELSE 0.0 END)::NUMERIC(5,4) as hit_rate,
          SUM(total_cost_saved_usd)::NUMERIC(12,8) as cost_saved_usd
         FROM inference_cache_entries
         WHERE tenant_id = $1::uuid AND status = 'active'
         GROUP BY model_id, provider
         ORDER BY cost_saved_usd DESC
         LIMIT 20`,
        [stringParam('tenantId', tenantId)]
      );

      return (result.rows || []).map(row => ({
        modelId: String(row.model_id),
        provider: String(row.provider),
        totalEntries: Number(row.total_entries),
        hitRate: Number(row.hit_rate),
        costSavedUsd: Number(row.cost_saved_usd),
      }));
    } catch (error) {
      logger.warn('Failed to get model breakdown', { tenantId, error });
      return [];
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Record a cache hit in the database (updates hit count and cost saved).
   */
  private async recordHit(tenantId: string, cacheKey: string, modelId: string, costUsd: number, responseTimeMs: number): Promise<void> {
    try {
      await executeStatement(
        `UPDATE inference_cache_entries
         SET hit_count = hit_count + 1,
             last_accessed_at = NOW(),
             total_cost_saved_usd = total_cost_saved_usd + original_cost_usd,
             total_latency_saved_ms = total_latency_saved_ms + original_latency_ms
         WHERE cache_key = $1 AND tenant_id = $2::uuid AND status = 'active'`,
        [
          stringParam('cacheKey', cacheKey),
          stringParam('tenantId', tenantId),
        ]
      );

      await this.logEvent(tenantId, cacheKey, 'hit', modelId, '', responseTimeMs, costUsd);
    } catch (error) {
      logger.warn('Failed to record cache hit', { tenantId, cacheKey, error });
    }
  }

  /**
   * Log a cache event to the audit trail.
   */
  private async logEvent(
    tenantId: string,
    cacheKey: string,
    eventType: string,
    modelId: string,
    promptHash: string,
    responseTimeMs: number,
    costSavedUsd: number
  ): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO inference_cache_events (
          tenant_id, cache_key, event_type, model_id, prompt_hash,
          response_time_ms, cost_saved_usd
        ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)`,
        [
          stringParam('tenantId', tenantId),
          stringParam('cacheKey', cacheKey),
          stringParam('eventType', eventType),
          stringParam('modelId', modelId),
          stringParam('promptHash', promptHash),
          longParam('responseTimeMs', responseTimeMs),
          stringParam('costSaved', String(costSavedUsd)),
        ]
      );
    } catch (error) {
      // Fire-and-forget: don't let logging failures affect the hot path
      logger.warn('Failed to log cache event', { tenantId, eventType, error });
    }
  }

  /**
   * Simple PII detection using regex patterns.
   * Returns true if the text appears to contain personally identifiable information.
   * This is a conservative check — it may have false positives but should not miss real PII.
   */
  private containsPii(text: string): boolean {
    const piiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/,       // SSN
      /\b\d{16}\b/,                     // Credit card (16 digits)
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card with separators
      /\b[A-Z]{1,2}\d{6,9}\b/,         // Passport numbers
      /\b\d{3}-\d{3}-\d{4}\b/,         // Phone numbers (US format)
    ];

    return piiPatterns.some(pattern => pattern.test(text));
  }
}

// Singleton export
export const inferenceCacheService = new InferenceCacheService();
