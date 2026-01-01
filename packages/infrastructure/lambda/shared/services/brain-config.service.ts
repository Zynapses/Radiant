/**
 * RADIANT v6.0.4 - Brain Config Service
 * Cached configuration reads for AGI Brain parameters
 * 
 * All admin-configurable parameters are loaded from the database
 * and cached in memory with TTL for performance.
 */

import { executeStatement } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import {
  DEFAULT_PARAMETER_VALUES,
  type ParameterKey,
  type AdminParameter,
  type ParameterCategory,
  type ConfigUpdateRequest,
  type ConfigUpdateResponse,
  type ConfigHistoryEntry,
  PARAMETER_CATEGORIES,
  PARAMETER_DEFINITIONS,
} from '@radiant/shared';

// =============================================================================
// Cache Configuration
// =============================================================================

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const CONFIG_CACHE_TTL_MS = 300000; // 5 minutes
const configCache = new Map<string, CacheEntry<unknown>>();

// =============================================================================
// Brain Config Service
// =============================================================================

class BrainConfigService {
  private redis: { get: (key: string) => Promise<string | null>; set: (key: string, value: string, options?: { EX?: number }) => Promise<void> } | null = null;

  /**
   * Initialize with optional Redis client for distributed caching
   */
  initialize(redisClient?: typeof this.redis): void {
    this.redis = redisClient || null;
  }

  // ===========================================================================
  // Core Get Methods
  // ===========================================================================

  /**
   * Get a configuration value as a number
   */
  async getNumber(key: ParameterKey, defaultValue?: number): Promise<number> {
    const value = await this.getValue(key);
    if (value === null || value === undefined) {
      return defaultValue ?? (DEFAULT_PARAMETER_VALUES[key] as number) ?? 0;
    }
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    return isNaN(num) ? (defaultValue ?? 0) : num;
  }

  /**
   * Get a configuration value as a string
   */
  async getString(key: ParameterKey, defaultValue?: string): Promise<string> {
    const value = await this.getValue(key);
    if (value === null || value === undefined) {
      return defaultValue ?? (DEFAULT_PARAMETER_VALUES[key] as string) ?? '';
    }
    return String(value);
  }

  /**
   * Get a configuration value as a boolean
   */
  async getBoolean(key: ParameterKey, defaultValue?: boolean): Promise<boolean> {
    const value = await this.getValue(key);
    if (value === null || value === undefined) {
      return defaultValue ?? (DEFAULT_PARAMETER_VALUES[key] as boolean) ?? false;
    }
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return Boolean(value);
  }

  /**
   * Get a configuration value as JSON object
   */
  async getJson<T>(key: ParameterKey, defaultValue?: T): Promise<T> {
    const value = await this.getValue(key);
    if (value === null || value === undefined) {
      return defaultValue ?? (DEFAULT_PARAMETER_VALUES[key] as T);
    }
    if (typeof value === 'object') return value as T;
    try {
      return JSON.parse(String(value)) as T;
    } catch {
      return defaultValue ?? (DEFAULT_PARAMETER_VALUES[key] as T);
    }
  }

  /**
   * Get raw configuration value with caching
   */
  async getValue(key: ParameterKey): Promise<unknown> {
    // Check memory cache first
    const cached = configCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    // Check Redis cache if available
    if (this.redis) {
      try {
        const redisValue = await this.redis.get(`config:${key}`);
        if (redisValue) {
          const parsed = JSON.parse(redisValue);
          this.setMemoryCache(key, parsed);
          return parsed;
        }
      } catch (error) {
        logger.warn(`Redis cache read failed for ${key}: ${String(error)}`);
      }
    }

    // Load from database
    try {
      const result = await executeStatement(
        `SELECT value FROM system_config WHERE key = $1`,
        [{ name: 'key', value: { stringValue: key } }]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0] as { value: string };
        const value = JSON.parse(row.value);
        
        // Cache in memory and Redis
        this.setMemoryCache(key, value);
        if (this.redis) {
          await this.redis.set(`config:${key}`, row.value, { EX: CONFIG_CACHE_TTL_MS / 1000 });
        }
        
        return value;
      }
    } catch (error) {
      logger.error(`Failed to load config ${key}: ${String(error)}`);
    }

    // Return default value
    return DEFAULT_PARAMETER_VALUES[key];
  }

  /**
   * Get multiple configuration values at once
   */
  async getMultiple(keys: ParameterKey[]): Promise<Map<ParameterKey, unknown>> {
    const results = new Map<ParameterKey, unknown>();
    
    // Check which keys need database lookup
    const uncachedKeys: ParameterKey[] = [];
    for (const key of keys) {
      const cached = configCache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        results.set(key, cached.value);
      } else {
        uncachedKeys.push(key);
      }
    }

    // Load uncached keys from database
    if (uncachedKeys.length > 0) {
      try {
        const placeholders = uncachedKeys.map((_, i) => `$${i + 1}`).join(', ');
        const result = await executeStatement(
          `SELECT key, value FROM system_config WHERE key IN (${placeholders})`,
          uncachedKeys.map((key, i) => ({ name: `p${i}`, value: { stringValue: key } }))
        );

        for (const row of result.rows) {
          const r = row as { key: string; value: string };
          const value = JSON.parse(r.value);
          results.set(r.key as ParameterKey, value);
          this.setMemoryCache(r.key, value);
        }

        // Set defaults for missing keys
        for (const key of uncachedKeys) {
          if (!results.has(key)) {
            results.set(key, DEFAULT_PARAMETER_VALUES[key]);
          }
        }
      } catch (error) {
        logger.error(`Failed to load multiple configs: ${String(error)}`);
        // Use defaults for all uncached keys
        for (const key of uncachedKeys) {
          results.set(key, DEFAULT_PARAMETER_VALUES[key]);
        }
      }
    }

    return results;
  }

  // ===========================================================================
  // Set Methods
  // ===========================================================================

  /**
   * Update a configuration value
   */
  async setValue(
    key: ParameterKey,
    value: unknown,
    changedBy: string,
    reason?: string
  ): Promise<ConfigUpdateResponse> {
    const definition = PARAMETER_DEFINITIONS.find(d => d.key === key);
    const warnings: string[] = [];

    // Validate value against constraints
    if (definition?.constraints) {
      const numValue = typeof value === 'number' ? value : parseFloat(String(value));
      if (!isNaN(numValue)) {
        if (definition.constraints.min !== undefined && numValue < definition.constraints.min) {
          warnings.push(`Value ${numValue} is below minimum ${definition.constraints.min}`);
        }
        if (definition.constraints.max !== undefined && numValue > definition.constraints.max) {
          warnings.push(`Value ${numValue} is above maximum ${definition.constraints.max}`);
        }
      }
    }

    try {
      // Get old value for history
      const oldValue = await this.getValue(key);

      // Update database
      await executeStatement(
        `UPDATE system_config 
         SET value = $1, 
             last_modified_by = $2, 
             last_modified_at = NOW(), 
             updated_at = NOW()
         WHERE key = $3`,
        [
          { name: 'value', value: { stringValue: JSON.stringify(value) } },
          { name: 'changedBy', value: { stringValue: changedBy } },
          { name: 'key', value: { stringValue: key } },
        ]
      );

      // Record history
      await executeStatement(
        `INSERT INTO config_history (config_key, old_value, new_value, changed_by, change_reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          { name: 'key', value: { stringValue: key } },
          { name: 'oldValue', value: { stringValue: JSON.stringify(oldValue) } },
          { name: 'newValue', value: { stringValue: JSON.stringify(value) } },
          { name: 'changedBy', value: { stringValue: changedBy } },
          { name: 'reason', value: reason ? { stringValue: reason } : { isNull: true } },
        ]
      );

      // Invalidate caches
      this.invalidateCache(key);

      return {
        success: true,
        key,
        oldValue,
        newValue: value,
        warnings,
        requiresRestart: definition?.requiresRestart ?? false,
      };
    } catch (error) {
      logger.error(`Failed to set config ${key}: ${String(error)}`);
      return {
        success: false,
        key,
        oldValue: undefined,
        newValue: value,
        warnings: [`Failed to update: ${String(error)}`],
        requiresRestart: false,
      };
    }
  }

  /**
   * Update multiple configuration values
   */
  async setMultiple(
    updates: ConfigUpdateRequest[],
    changedBy: string
  ): Promise<ConfigUpdateResponse[]> {
    const results: ConfigUpdateResponse[] = [];
    
    for (const update of updates) {
      const result = await this.setValue(
        update.key,
        update.value,
        changedBy,
        update.reason
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Reset a configuration value to default
   */
  async resetToDefault(key: ParameterKey, changedBy: string): Promise<ConfigUpdateResponse> {
    const defaultValue = DEFAULT_PARAMETER_VALUES[key];
    return this.setValue(key, defaultValue, changedBy, 'Reset to default');
  }

  // ===========================================================================
  // Admin Methods
  // ===========================================================================

  /**
   * Get all parameters by category
   */
  async getParametersByCategory(): Promise<ParameterCategory[]> {
    try {
      const result = await executeStatement(
        `SELECT key, value, category, name, description, type, 
                constraints_json, dangerous, requires_restart, default_value,
                last_modified_by, last_modified_at, created_at, updated_at
         FROM system_config
         ORDER BY category, key`,
        []
      );

      const categoryMap = new Map<string, AdminParameter[]>();

      for (const row of result.rows) {
        const r = row as Record<string, unknown>;
        const param: AdminParameter = {
          id: r.key as string,
          categoryId: r.category as string,
          key: r.key as string,
          name: r.name as string,
          description: r.description as string,
          type: r.type as 'number' | 'string' | 'boolean' | 'select' | 'json',
          value: JSON.parse(r.value as string),
          defaultValue: JSON.parse(r.default_value as string),
          constraints: r.constraints_json ? JSON.parse(r.constraints_json as string) : undefined,
          dangerous: r.dangerous as boolean,
          requiresRestart: r.requires_restart as boolean,
          lastModifiedBy: r.last_modified_by as string | null,
          lastModifiedAt: r.last_modified_at ? new Date(r.last_modified_at as string) : null,
          createdAt: new Date(r.created_at as string),
          updatedAt: new Date(r.updated_at as string),
        };

        const category = r.category as string;
        if (!categoryMap.has(category)) {
          categoryMap.set(category, []);
        }
        categoryMap.get(category)!.push(param);
      }

      const categories: ParameterCategory[] = [];
      for (const [categoryId, parameters] of categoryMap) {
        const categoryInfo = PARAMETER_CATEGORIES[categoryId as keyof typeof PARAMETER_CATEGORIES];
        categories.push({
          id: categoryId,
          name: categoryInfo?.name ?? categoryId,
          description: categoryInfo?.description ?? '',
          icon: categoryInfo?.icon ?? 'settings',
          displayOrder: Object.keys(PARAMETER_CATEGORIES).indexOf(categoryId),
          parameters,
        });
      }

      return categories.sort((a, b) => a.displayOrder - b.displayOrder);
    } catch (error) {
      logger.error(`Failed to get parameters by category: ${String(error)}`);
      return [];
    }
  }

  /**
   * Get configuration history
   */
  async getHistory(key?: ParameterKey, limit: number = 50): Promise<ConfigHistoryEntry[]> {
    try {
      let sql = `SELECT id, config_key, old_value, new_value, changed_by, change_reason, changed_at
                 FROM config_history`;
      const params: Array<{ name: string; value: { stringValue: string } | { longValue: number } }> = [];

      if (key) {
        sql += ` WHERE config_key = $1`;
        params.push({ name: 'key', value: { stringValue: key } });
      }

      sql += ` ORDER BY changed_at DESC LIMIT $${params.length + 1}`;
      params.push({ name: 'limit', value: { longValue: limit } });

      const result = await executeStatement(sql, params);

      return result.rows.map(row => {
        const r = row as Record<string, unknown>;
        return {
          id: r.id as string,
          configKey: r.config_key as ParameterKey,
          oldValue: r.old_value ? JSON.parse(r.old_value as string) : null,
          newValue: JSON.parse(r.new_value as string),
          changedBy: r.changed_by as string,
          changeReason: r.change_reason as string | null,
          changedAt: new Date(r.changed_at as string),
        };
      });
    } catch (error) {
      logger.error(`Failed to get config history: ${String(error)}`);
      return [];
    }
  }

  /**
   * Get dangerous parameters that have been modified
   */
  async getDangerousModifications(): Promise<AdminParameter[]> {
    try {
      const result = await executeStatement(
        `SELECT key, value, name, category, description, default_value, 
                last_modified_by, last_modified_at
         FROM system_config
         WHERE dangerous = true AND last_modified_at IS NOT NULL
         ORDER BY last_modified_at DESC`,
        []
      );

      return result.rows.map(row => {
        const r = row as Record<string, unknown>;
        return {
          id: r.key as string,
          categoryId: r.category as string,
          key: r.key as string,
          name: r.name as string,
          description: r.description as string,
          type: 'string' as const,
          value: JSON.parse(r.value as string),
          defaultValue: JSON.parse(r.default_value as string),
          dangerous: true,
          requiresRestart: false,
          lastModifiedBy: r.last_modified_by as string | null,
          lastModifiedAt: r.last_modified_at ? new Date(r.last_modified_at as string) : null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      });
    } catch (error) {
      logger.error(`Failed to get dangerous modifications: ${String(error)}`);
      return [];
    }
  }

  // ===========================================================================
  // Cache Management
  // ===========================================================================

  /**
   * Set value in memory cache
   */
  private setMemoryCache(key: string, value: unknown): void {
    configCache.set(key, {
      value,
      expiresAt: Date.now() + CONFIG_CACHE_TTL_MS,
    });
  }

  /**
   * Invalidate cache for a key
   */
  invalidateCache(key: string): void {
    configCache.delete(key);
    if (this.redis) {
      this.redis.set(`config:${key}`, '', { EX: 0 }).catch(() => {});
    }
  }

  /**
   * Invalidate all cached configuration
   */
  invalidateAllCache(): void {
    configCache.clear();
    logger.info('All config cache invalidated');
  }

  /**
   * Preload commonly used configuration values
   */
  async preload(): Promise<void> {
    const commonKeys: ParameterKey[] = [
      'GHOST_CURRENT_VERSION',
      'GHOST_REANCHOR_INTERVAL',
      'GHOST_JITTER_RANGE',
      'CONTEXT_RESPONSE_RESERVE',
      'CONTEXT_MODEL_LIMIT',
      'SOFAI_SYSTEM2_THRESHOLD',
      'DREAM_TWILIGHT_HOUR',
      'FLASH_MAX_FACTS_PER_USER',
    ];

    await this.getMultiple(commonKeys);
    logger.info(`Preloaded ${commonKeys.length} config values`);
  }
}

// Export singleton instance
export const brainConfigService = new BrainConfigService();

// Export class for testing
export { BrainConfigService };
