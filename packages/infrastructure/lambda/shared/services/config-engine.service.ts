// RADIANT v4.18.0 - Dynamic Configuration Engine
// Hot-reload configuration without code rebuilds
// Auto-propagates changes across all services

import { executeStatement } from '../db/client';

// ============================================================================
// Types
// ============================================================================

export type ConfigType = 'models' | 'providers' | 'specialties' | 'orchestration' | 'system' | 'tenants';

export interface ConfigVersion {
  versionId: string;
  versionNumber: number;
  configType: ConfigType;
  changeType: string;
  changeSource?: string;
  changedBy?: string;
  affectedKeys: string[];
  changeSummary?: string;
  createdAt: string;
}

export interface ConfigFreshness {
  configType: ConfigType;
  currentVersion: number;
  serviceVersion: number;
  needsUpdate: boolean;
}

export interface ConfigNotification {
  notificationId: string;
  configType: ConfigType;
  versionNumber: number;
  changeType: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  requiresRestart: boolean;
  payload: Record<string, unknown>;
}

export interface ServiceInstance {
  instanceId: string;
  serviceName: string;
  serviceType: string;
  configVersions: Record<ConfigType, number>;
  status: string;
  lastHeartbeat: string;
}

// ============================================================================
// In-Memory Cache with Auto-Invalidation
// ============================================================================

interface CacheEntry<T> {
  value: T;
  version: number;
  expiresAt?: number;
}

class LocalConfigCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private versions: Record<string, number> = {};
  private pollInterval: NodeJS.Timeout | null = null;
  private lastPollTime = 0;
  private readonly POLL_INTERVAL_MS = 5000; // Poll every 5 seconds

  set<T>(key: string, configType: ConfigType, value: T, ttlMs?: number): void {
    this.cache.set(key, {
      value,
      version: this.versions[configType] || 0,
      expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
    });
  }

  get<T>(key: string, configType: ConfigType): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    // Check expiry
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    // Check version freshness
    const currentVersion = this.versions[configType] || 0;
    if (entry.version < currentVersion) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  invalidate(configType: ConfigType): void {
    // Increment version to invalidate all entries of this type
    this.versions[configType] = (this.versions[configType] || 0) + 1;
  }

  invalidateAll(): void {
    this.cache.clear();
    Object.keys(this.versions).forEach(key => {
      this.versions[key] = (this.versions[key] || 0) + 1;
    });
  }

  updateVersions(versions: Record<string, number>): void {
    Object.entries(versions).forEach(([type, version]) => {
      if (version > (this.versions[type] || 0)) {
        this.versions[type] = version;
      }
    });
  }

  getVersions(): Record<string, number> {
    return { ...this.versions };
  }
}

// ============================================================================
// Dynamic Configuration Engine Service
// ============================================================================

export class ConfigEngineService {
  private localCache = new LocalConfigCache();
  private instanceId: string | null = null;
  private serviceName: string;
  private serviceType: string;
  private pollInterval: NodeJS.Timeout | null = null;
  private changeHandlers: Map<ConfigType, Array<(version: number) => void>> = new Map();

  constructor(serviceName = 'unknown', serviceType = 'lambda') {
    this.serviceName = serviceName;
    this.serviceType = serviceType;
  }

  // ============================================================================
  // Initialization & Lifecycle
  // ============================================================================

  async initialize(): Promise<void> {
    // Register with the system
    await this.heartbeat();

    // Load current versions
    await this.checkFreshness();

    // Start polling for changes
    this.startPolling();
  }

  async shutdown(): Promise<void> {
    this.stopPolling();
    
    if (this.instanceId) {
      await executeStatement(
        `UPDATE service_instances SET status = 'terminated' WHERE instance_id = $1`,
        [{ name: 'instanceId', value: { stringValue: this.instanceId } }]
      ).catch(() => {}); // Ignore errors on shutdown
    }
  }

  private startPolling(): void {
    if (this.pollInterval) return;

    this.pollInterval = setInterval(async () => {
      try {
        await this.pollForChanges();
      } catch (error) {
        console.error('[ConfigEngine] Poll error:', error);
      }
    }, 5000); // Poll every 5 seconds
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  // ============================================================================
  // Version Management
  // ============================================================================

  async getVersion(configType: ConfigType): Promise<number> {
    const result = await executeStatement(
      `SELECT get_config_version($1)`,
      [{ name: 'configType', value: { stringValue: configType } }]
    );

    return Number((result.rows[0] as Record<string, unknown>)?.get_config_version || 0);
  }

  async getAllVersions(): Promise<Record<ConfigType, number>> {
    const result = await executeStatement(
      `SELECT config_type, current_version FROM config_version_counters`,
      []
    );

    const versions: Record<string, number> = {};
    for (const row of result.rows) {
      const r = row as Record<string, unknown>;
      versions[String(r.config_type)] = Number(r.current_version);
    }

    return versions as Record<ConfigType, number>;
  }

  async checkFreshness(): Promise<ConfigFreshness[]> {
    const localVersions = this.localCache.getVersions();

    const result = await executeStatement(
      `SELECT * FROM check_config_freshness($1)`,
      [{ name: 'versions', value: { stringValue: JSON.stringify(localVersions) } }]
    );

    const freshness: ConfigFreshness[] = result.rows.map(row => {
      const r = row as Record<string, unknown>;
      return {
        configType: String(r.config_type) as ConfigType,
        currentVersion: Number(r.current_version),
        serviceVersion: Number(r.service_version),
        needsUpdate: Boolean(r.needs_update),
      };
    });

    // Update local cache with current versions
    const serverVersions: Record<string, number> = {};
    freshness.forEach(f => {
      serverVersions[f.configType] = f.currentVersion;
    });
    this.localCache.updateVersions(serverVersions);

    return freshness;
  }

  // ============================================================================
  // Change Detection & Polling
  // ============================================================================

  async pollForChanges(): Promise<void> {
    const freshness = await this.checkFreshness();
    
    for (const item of freshness) {
      if (item.needsUpdate) {
        console.log(`[ConfigEngine] ${item.configType} updated: v${item.serviceVersion} → v${item.currentVersion}`);
        
        // Invalidate local cache for this config type
        this.localCache.invalidate(item.configType);
        
        // Notify handlers
        const handlers = this.changeHandlers.get(item.configType);
        if (handlers) {
          for (const handler of handlers) {
            try {
              handler(item.currentVersion);
            } catch (error) {
              console.error(`[ConfigEngine] Handler error for ${item.configType}:`, error);
            }
          }
        }
      }
    }

    // Update heartbeat
    await this.heartbeat();
  }

  async getPendingNotifications(): Promise<ConfigNotification[]> {
    if (!this.instanceId) return [];

    const localVersions = this.localCache.getVersions();

    const result = await executeStatement(
      `SELECT * FROM get_pending_notifications($1, $2)`,
      [
        { name: 'serviceId', value: { stringValue: this.instanceId } },
        { name: 'versions', value: { stringValue: JSON.stringify(localVersions) } },
      ]
    );

    return result.rows.map(row => {
      const r = row as Record<string, unknown>;
      return {
        notificationId: String(r.notification_id),
        configType: String(r.config_type) as ConfigType,
        versionNumber: Number(r.version_number),
        changeType: String(r.change_type),
        priority: String(r.priority) as ConfigNotification['priority'],
        requiresRestart: Boolean(r.requires_restart),
        payload: typeof r.notification_payload === 'string' 
          ? JSON.parse(r.notification_payload) 
          : (r.notification_payload as Record<string, unknown>) || {},
      };
    });
  }

  async acknowledgeNotifications(notificationIds: string[]): Promise<void> {
    if (!this.instanceId || notificationIds.length === 0) return;

    await executeStatement(
      `SELECT acknowledge_notifications($1, $2)`,
      [
        { name: 'serviceId', value: { stringValue: this.instanceId } },
        { name: 'notificationIds', value: { stringValue: `{${notificationIds.join(',')}}` } },
      ]
    );
  }

  // ============================================================================
  // Change Handlers
  // ============================================================================

  onConfigChange(configType: ConfigType, handler: (version: number) => void): void {
    if (!this.changeHandlers.has(configType)) {
      this.changeHandlers.set(configType, []);
    }
    this.changeHandlers.get(configType)!.push(handler);
  }

  offConfigChange(configType: ConfigType, handler: (version: number) => void): void {
    const handlers = this.changeHandlers.get(configType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index >= 0) {
        handlers.splice(index, 1);
      }
    }
  }

  // ============================================================================
  // Service Heartbeat
  // ============================================================================

  async heartbeat(): Promise<string> {
    const localVersions = this.localCache.getVersions();

    const result = await executeStatement(
      `SELECT service_heartbeat($1, $2, $3, $4)`,
      [
        { name: 'serviceName', value: { stringValue: this.serviceName } },
        { name: 'serviceType', value: { stringValue: this.serviceType } },
        { name: 'instanceId', value: this.instanceId ? { stringValue: this.instanceId } : { isNull: true } },
        { name: 'configVersions', value: { stringValue: JSON.stringify(localVersions) } },
      ]
    );

    this.instanceId = String((result.rows[0] as Record<string, unknown>)?.service_heartbeat || '');
    return this.instanceId;
  }

  // ============================================================================
  // Caching with Auto-Invalidation
  // ============================================================================

  cacheGet<T>(key: string, configType: ConfigType): T | null {
    return this.localCache.get<T>(key, configType);
  }

  cacheSet<T>(key: string, configType: ConfigType, value: T, ttlMs?: number): void {
    this.localCache.set(key, configType, value, ttlMs);
  }

  async cachedQuery<T>(
    key: string,
    configType: ConfigType,
    fetcher: () => Promise<T>,
    ttlMs?: number
  ): Promise<T> {
    // Check local cache first
    const cached = this.localCache.get<T>(key, configType);
    if (cached !== null) {
      return cached;
    }

    // Check database cache
    const dbCached = await executeStatement(
      `SELECT get_cached_config($1)`,
      [{ name: 'key', value: { stringValue: key } }]
    );

    const dbValue = (dbCached.rows[0] as Record<string, unknown>)?.get_cached_config;
    if (dbValue && dbValue !== null) {
      const value = typeof dbValue === 'string' ? JSON.parse(dbValue) : dbValue;
      this.localCache.set(key, configType, value, ttlMs);
      return value as T;
    }

    // Fetch fresh data
    const value = await fetcher();

    // Cache in both local and database
    this.localCache.set(key, configType, value, ttlMs);
    
    await executeStatement(
      `SELECT cache_config($1, $2, $3, $4)`,
      [
        { name: 'key', value: { stringValue: key } },
        { name: 'configType', value: { stringValue: configType } },
        { name: 'value', value: { stringValue: JSON.stringify(value) } },
        { name: 'ttl', value: ttlMs ? { longValue: Math.floor(ttlMs / 1000) } : { isNull: true } },
      ]
    );

    return value;
  }

  // ============================================================================
  // Manual Version Increment (for admin actions)
  // ============================================================================

  async incrementVersion(
    configType: ConfigType,
    changeType: string,
    options: {
      changeSource?: string;
      changedBy?: string;
      affectedKeys?: string[];
      changeSummary?: string;
      changePayload?: Record<string, unknown>;
    } = {}
  ): Promise<number> {
    const result = await executeStatement(
      `SELECT increment_config_version($1, $2, $3, $4, $5, $6, $7)`,
      [
        { name: 'configType', value: { stringValue: configType } },
        { name: 'changeType', value: { stringValue: changeType } },
        { name: 'changeSource', value: options.changeSource ? { stringValue: options.changeSource } : { isNull: true } },
        { name: 'changedBy', value: options.changedBy ? { stringValue: options.changedBy } : { isNull: true } },
        { name: 'affectedKeys', value: { stringValue: `{${(options.affectedKeys || []).join(',')}}` } },
        { name: 'changeSummary', value: options.changeSummary ? { stringValue: options.changeSummary } : { isNull: true } },
        { name: 'changePayload', value: { stringValue: JSON.stringify(options.changePayload || {}) } },
      ]
    );

    const newVersion = Number((result.rows[0] as Record<string, unknown>)?.increment_config_version || 0);
    
    // Update local cache version
    this.localCache.updateVersions({ [configType]: newVersion });
    
    return newVersion;
  }

  // ============================================================================
  // Version History
  // ============================================================================

  async getVersionHistory(configType: ConfigType, limit = 50): Promise<ConfigVersion[]> {
    const result = await executeStatement(
      `SELECT * FROM config_versions 
       WHERE config_type = $1 
       ORDER BY version_number DESC 
       LIMIT $2`,
      [
        { name: 'configType', value: { stringValue: configType } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    return result.rows.map(row => {
      const r = row as Record<string, unknown>;
      return {
        versionId: String(r.version_id),
        versionNumber: Number(r.version_number),
        configType: String(r.config_type) as ConfigType,
        changeType: String(r.change_type),
        changeSource: r.change_source ? String(r.change_source) : undefined,
        changedBy: r.changed_by ? String(r.changed_by) : undefined,
        affectedKeys: (r.affected_keys as string[]) || [],
        changeSummary: r.change_summary ? String(r.change_summary) : undefined,
        createdAt: String(r.created_at),
      };
    });
  }

  // ============================================================================
  // Service Registry
  // ============================================================================

  async getActiveServices(): Promise<ServiceInstance[]> {
    const result = await executeStatement(
      `SELECT * FROM service_instances 
       WHERE status = 'active' 
       ORDER BY service_name, last_heartbeat DESC`,
      []
    );

    return result.rows.map(row => {
      const r = row as Record<string, unknown>;
      return {
        instanceId: String(r.instance_id),
        serviceName: String(r.service_name),
        serviceType: String(r.service_type),
        configVersions: typeof r.config_versions === 'string' 
          ? JSON.parse(r.config_versions) 
          : (r.config_versions as Record<ConfigType, number>) || {},
        status: String(r.status),
        lastHeartbeat: String(r.last_heartbeat),
      };
    });
  }

  async getStaleServices(): Promise<ServiceInstance[]> {
    const result = await executeStatement(
      `SELECT si.*, 
              (SELECT jsonb_object_agg(config_type, current_version) FROM config_version_counters) as current_versions
       FROM service_instances si
       WHERE si.status = 'active'
         AND EXISTS (
           SELECT 1 FROM config_version_counters cvc
           WHERE cvc.current_version > COALESCE((si.config_versions->>cvc.config_type)::BIGINT, 0)
         )`,
      []
    );

    return result.rows.map(row => {
      const r = row as Record<string, unknown>;
      return {
        instanceId: String(r.instance_id),
        serviceName: String(r.service_name),
        serviceType: String(r.service_type),
        configVersions: typeof r.config_versions === 'string' 
          ? JSON.parse(r.config_versions) 
          : (r.config_versions as Record<ConfigType, number>) || {},
        status: String(r.status),
        lastHeartbeat: String(r.last_heartbeat),
      };
    });
  }

  // ============================================================================
  // Force Refresh
  // ============================================================================

  async forceRefresh(configType?: ConfigType): Promise<void> {
    if (configType) {
      this.localCache.invalidate(configType);
    } else {
      this.localCache.invalidateAll();
    }

    await this.checkFreshness();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const configEngine = new ConfigEngineService(
  process.env.SERVICE_NAME || 'radiant-service',
  process.env.SERVICE_TYPE || 'lambda'
);

// Auto-initialize on import (for Lambda)
if (typeof process !== 'undefined' && process.env.AWS_LAMBDA_FUNCTION_NAME) {
  configEngine.initialize().catch(console.error);
}
