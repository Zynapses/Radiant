/**
 * System Configuration Service
 * 
 * Reads and writes system configuration from the database.
 * Provides caching for performance with configurable TTL.
 * Uses centralized pool manager to prevent connection exhaustion.
 */

import { getCentralizedPool, getPoolClient } from '../db/centralized-pool';
import { logger } from '../logging/enhanced-logger';
import { ValidationError, NotFoundError } from '../errors';

// Cache for configuration values
interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const configCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60000; // 1 minute cache

export interface SystemConfigValue {
  id: string;
  category: string;
  key: string;
  value: unknown;
  valueType: string;
  displayName: string;
  description?: string;
  unit?: string;
  minValue?: number;
  maxValue?: number;
  defaultValue?: unknown;
  isSensitive: boolean;
  requiresRestart: boolean;
  sortOrder: number;
}

export interface SystemConfigCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  sortOrder: number;
}

export interface ConfigAuditEntry {
  id: string;
  configKey: string;
  oldValue: unknown;
  newValue: unknown;
  changedBy?: string;
  changedByEmail?: string;
  changeReason?: string;
  createdAt: string;
}

/**
 * Get a configuration value by category and key
 */
export async function getConfig<T>(category: string, key: string, defaultValue?: T): Promise<T> {
  const cacheKey = `${category}.${key}`;
  
  // Check cache first
  const cached = configCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }
  
  const client = await getPoolClient();
  try {
    const result = await client.query(
      `SELECT value, value_type FROM system_config WHERE category_id = $1 AND key = $2`,
      [category, key]
    );
    
    if (result.rows.length === 0) {
      return defaultValue as T;
    }
    
    const row = result.rows[0];
    const value = parseValue(row.value, row.value_type);
    
    // Update cache
    configCache.set(cacheKey, {
      value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    
    return value as T;
  } finally {
    client.release();
  }
}

/**
 * Get multiple configuration values by category
 */
export async function getConfigsByCategory(category: string): Promise<SystemConfigValue[]> {
  const client = await getPoolClient();
  try {
    const result = await client.query(
      `SELECT 
        id, category, key, value, value_type, display_name, description,
        unit, min_value, max_value, default_value, is_sensitive, 
        requires_restart, sort_order
       FROM system_config 
       WHERE category = $1 
       ORDER BY sort_order`,
      [category]
    );
    
    return result.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      category: row.category as string,
      key: row.key as string,
      value: parseValue(row.value, row.value_type as string),
      valueType: row.value_type as string,
      displayName: row.display_name as string,
      description: row.description as string | undefined,
      unit: row.unit as string | undefined,
      minValue: row.min_value ? parseFloat(row.min_value as string) : undefined,
      maxValue: row.max_value ? parseFloat(row.max_value as string) : undefined,
      defaultValue: row.default_value ? parseValue(row.default_value, row.value_type as string) : undefined,
      isSensitive: row.is_sensitive as boolean,
      requiresRestart: row.requires_restart as boolean,
      sortOrder: row.sort_order as number,
    }));
  } finally {
    client.release();
  }
}

/**
 * Get all configuration categories
 */
export async function getConfigCategories(): Promise<SystemConfigCategory[]> {
  const client = await getPoolClient();
  try {
    const result = await client.query(
      `SELECT id, name, description, icon, sort_order 
       FROM system_config_categories 
       WHERE is_active = true 
       ORDER BY sort_order`
    );
    
    return result.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      icon: row.icon as string | undefined,
      sortOrder: row.sort_order as number,
    }));
  } finally {
    client.release();
  }
}

/**
 * Update a configuration value
 */
export async function setConfig(
  category: string, 
  key: string, 
  value: unknown,
  updatedBy?: string
): Promise<void> {
  const client = await getPoolClient();
  try {
    // Validate against min/max if applicable
    const configResult = await client.query(
      `SELECT id, value_type, min_value, max_value FROM system_config WHERE category_id = $1 AND key = $2`,
      [category, key]
    );
    
    if (configResult.rows.length === 0) {
      throw new NotFoundError(`Configuration: ${category}.${key}`);
    }
    
    const config = configResult.rows[0];
    const numericValue = typeof value === 'number' ? value : parseFloat(String(value));
    
    if (config.min_value !== null && numericValue < parseFloat(config.min_value)) {
      throw new ValidationError(`Value ${value} is below minimum ${config.min_value}`);
    }
    if (config.max_value !== null && numericValue > parseFloat(config.max_value)) {
      throw new ValidationError(`Value ${value} is above maximum ${config.max_value}`);
    }
    
    // Update the value
    await client.query(
      `UPDATE system_config 
       SET value = $1, updated_at = NOW(), updated_by = $2
       WHERE category_id = $3 AND key = $4`,
      [JSON.stringify(value), updatedBy, category, key]
    );
    
    logger.info('Configuration updated', { category, key, updatedBy });
    
    // Invalidate cache
    const cacheKey = `${category}.${key}`;
    configCache.delete(cacheKey);
    
  } finally {
    client.release();
  }
}

/**
 * Reset a configuration value to its default
 */
export async function resetConfigToDefault(category: string, key: string, updatedBy?: string): Promise<void> {
  const client = await getPoolClient();
  try {
    await client.query(
      `UPDATE system_config 
       SET value = default_value, updated_at = NOW(), updated_by = $1
       WHERE category = $2 AND key = $3 AND default_value IS NOT NULL`,
      [updatedBy, category, key]
    );
    
    // Invalidate cache
    configCache.delete(`${category}.${key}`);
  } finally {
    client.release();
  }
}

/**
 * Get audit log for configuration changes
 */
export async function getConfigAuditLog(limit = 50): Promise<ConfigAuditEntry[]> {
  const client = await getPoolClient();
  try {
    const result = await client.query(
      `SELECT 
        a.id, a.config_key, a.old_value, a.new_value, 
        a.changed_by, a.changed_by_email, a.change_reason, a.created_at
       FROM system_config_audit a
       ORDER BY a.created_at DESC
       LIMIT $1`,
      [limit]
    );
    
    return result.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      configKey: row.config_key as string,
      oldValue: row.old_value,
      newValue: row.new_value,
      changedBy: row.changed_by as string | undefined,
      changedByEmail: row.changed_by_email as string | undefined,
      changeReason: row.change_reason as string | undefined,
      createdAt: row.created_at as string,
    }));
  } finally {
    client.release();
  }
}

/**
 * Parse a JSON value based on its type
 */
function parseValue(jsonValue: unknown, valueType: string): unknown {
  // Handle already-parsed values
  if (typeof jsonValue !== 'string') {
    return jsonValue;
  }
  
  try {
    const parsed = JSON.parse(jsonValue);
    
    switch (valueType) {
      case 'integer':
        return parseInt(String(parsed), 10);
      case 'decimal':
      case 'percentage':
        return parseFloat(String(parsed));
      case 'boolean':
        return Boolean(parsed);
      case 'json':
      case 'array':
        return parsed;
      default:
        return parsed;
    }
  } catch (parseError) {
    console.debug('Failed to parse config JSON value:', parseError instanceof Error ? parseError.message : 'unknown');
    return jsonValue;
  }
}

/**
 * Clear the configuration cache
 */
export function clearConfigCache(): void {
  configCache.clear();
}

/**
 * Get cache statistics
 */
export function getConfigCacheStats(): { size: number; keys: string[] } {
  return {
    size: configCache.size,
    keys: Array.from(configCache.keys()),
  };
}

// Convenience functions for specific config categories

export const CircuitBreakerConfig = {
  async getFailureThreshold(provider: string): Promise<number> {
    return getConfig('circuit_breaker', `${provider}.failure_threshold`, 5);
  },
  async getSuccessThreshold(provider: string): Promise<number> {
    return getConfig('circuit_breaker', `${provider}.success_threshold`, 2);
  },
  async getTimeoutMs(provider: string): Promise<number> {
    return getConfig('circuit_breaker', `${provider}.timeout_ms`, 30000);
  },
};

export const ConnectionPoolConfig = {
  async getMaxConnections(): Promise<number> {
    return getConfig('connection_pool', 'max_connections', 10);
  },
  async getMinConnections(): Promise<number> {
    return getConfig('connection_pool', 'min_connections', 1);
  },
  async getAcquireTimeoutMs(): Promise<number> {
    return getConfig('connection_pool', 'acquire_timeout_ms', 10000);
  },
  async getUtilizationWarningThreshold(): Promise<number> {
    return getConfig('connection_pool', 'utilization_warning_threshold', 0.7);
  },
  async getUtilizationCriticalThreshold(): Promise<number> {
    return getConfig('connection_pool', 'utilization_critical_threshold', 0.9);
  },
};

export const RateLimitConfig = {
  async getDefaultRequestsPerMinute(): Promise<number> {
    return getConfig('rate_limiting', 'default_requests_per_minute', 100);
  },
  async getDefaultWindowMs(): Promise<number> {
    return getConfig('rate_limiting', 'default_window_ms', 60000);
  },
  async getTierMultiplier(tier: number): Promise<number> {
    return getConfig('rate_limiting', `tier_${tier}_multiplier`, 1);
  },
};

export const TimeoutConfig = {
  async getDefaultRequestTimeoutMs(): Promise<number> {
    return getConfig('timeouts', 'default_request_timeout_ms', 30000);
  },
  async getAiRequestTimeoutMs(): Promise<number> {
    return getConfig('timeouts', 'ai_request_timeout_ms', 120000);
  },
  async getStreamingTimeoutMs(): Promise<number> {
    return getConfig('timeouts', 'streaming_timeout_ms', 300000);
  },
};

export const DeduplicationConfig = {
  async getDefaultWindowMs(): Promise<number> {
    return getConfig('deduplication', 'default_window_ms', 5000);
  },
  async getChatCompletionWindowMs(): Promise<number> {
    return getConfig('deduplication', 'chat_completion_window_ms', 10000);
  },
  async getMaxCacheEntries(): Promise<number> {
    return getConfig('deduplication', 'max_cache_entries', 10000);
  },
};

export const CachingConfig = {
  async getRedisDefaultTtlSeconds(): Promise<number> {
    return getConfig('caching', 'redis_default_ttl_seconds', 300);
  },
  async getMemoryCacheTtlMs(): Promise<number> {
    return getConfig('caching', 'memory_cache_ttl_ms', 60000);
  },
  async getFeatureFlagCacheTtlMs(): Promise<number> {
    return getConfig('caching', 'feature_flag_cache_ttl_ms', 60000);
  },
};

export const BufferingConfig = {
  async getAuditBufferSize(): Promise<number> {
    return getConfig('buffering', 'audit_buffer_size', 25);
  },
  async getAuditFlushIntervalMs(): Promise<number> {
    return getConfig('buffering', 'audit_flush_interval_ms', 5000);
  },
  async getMetricsBufferSize(): Promise<number> {
    return getConfig('buffering', 'metrics_buffer_size', 20);
  },
  async getMetricsFlushIntervalMs(): Promise<number> {
    return getConfig('buffering', 'metrics_flush_interval_ms', 10000);
  },
};

export const DataRetentionConfig = {
  async getUsageEventsRetentionDays(): Promise<number> {
    return getConfig('data_retention', 'usage_events_retention_days', 90);
  },
  async getNotificationsRetentionDays(): Promise<number> {
    return getConfig('data_retention', 'notifications_retention_days', 30);
  },
  async getAuditLogsRetentionDays(): Promise<number> {
    return getConfig('data_retention', 'audit_logs_retention_days', 365);
  },
};

export const SecurityConfig = {
  async getAnomalySuppressionWindowMinutes(): Promise<number> {
    return getConfig('security', 'anomaly_suppression_window_minutes', 60);
  },
  async getBruteForceThreshold(): Promise<number> {
    return getConfig('security', 'brute_force_threshold', 5);
  },
  async getSessionTimeoutMinutes(): Promise<number> {
    return getConfig('security', 'session_timeout_minutes', 60);
  },
  async getMaxConcurrentSessions(): Promise<number> {
    return getConfig('security', 'max_concurrent_sessions', 5);
  },
};

export const InvitationConfig = {
  async getDefaultExpiryHours(): Promise<number> {
    return getConfig('invitations', 'default_expiry_hours', 72);
  },
  async getMaxExpiryHours(): Promise<number> {
    return getConfig('invitations', 'max_expiry_hours', 168);
  },
  async getMaxResendCount(): Promise<number> {
    return getConfig('invitations', 'max_resend_count', 3);
  },
};

export const BatchProcessingConfig = {
  async getMaxEventsPerBatch(): Promise<number> {
    return getConfig('batch_processing', 'max_events_per_batch', 100);
  },
  async getMaxItemsPerChunk(): Promise<number> {
    return getConfig('batch_processing', 'max_items_per_chunk', 50);
  },
  async getChunkTimeoutSeconds(): Promise<number> {
    return getConfig('batch_processing', 'chunk_timeout_seconds', 300);
  },
};

/**
 * Get all configuration values for a category as a simple key-value object
 * Useful for middleware and services that need multiple config values
 */
export async function getSystemConfig(category: string): Promise<Record<string, unknown>> {
  const configs = await getConfigsByCategory(category);
  const result: Record<string, unknown> = {};
  
  for (const config of configs) {
    // Convert key to snake_case for consistency
    result[config.key] = config.value;
  }
  
  return result;
}
