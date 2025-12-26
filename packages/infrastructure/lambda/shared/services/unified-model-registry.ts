import { executeStatement, toSqlParams } from '../db/client';
import type { SqlParameter } from '@aws-sdk/client-rds-data';

export type ModelCategory = 'vision' | 'audio' | 'scientific' | 'medical' | 'geospatial' | '3d' | 'llm' | 'embedding' | 'code';
export type ModelSource = 'external' | 'self-hosted';
export type ThermalState = 'OFF' | 'COLD' | 'WARM' | 'HOT';
export type ProviderHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface UnifiedModel {
  id: string;
  modelId: string;
  name: string;
  displayName: string;
  description?: string;
  provider: string;
  source: ModelSource;
  category: ModelCategory;
  specialty?: string;
  capabilities: string[];
  inputModalities: string[];
  outputModalities: string[];
  contextWindow?: number;
  maxOutput?: number;
  inputPricePer1M: number;
  outputPricePer1M: number;
  hourlyRate?: number;
  minTier: number;
  thermalState?: ThermalState;
  warmupTimeSeconds?: number;
  license: string;
  commercialUseAllowed: boolean;
  enabled: boolean;
  deprecated: boolean;
  status: string;
}

export interface ProviderHealth {
  id: string;
  providerId: string;
  region: string;
  status: ProviderHealthStatus;
  avgLatencyMs?: number;
  p95LatencyMs?: number;
  p99LatencyMs?: number;
  errorRate?: number;
  successRate?: number;
  lastCheckAt: Date;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
  lastError?: string;
}

export interface SyncResult {
  syncType: string;
  modelsUpdated: number;
  modelsAdded: number;
  modelsRemoved: number;
  errors: string[];
  durationMs: number;
}

export interface ModelSelectionCriteria {
  tenantId: string;
  category?: ModelCategory;
  capabilities?: string[];
  inputModality?: string;
  outputModality?: string;
  maxLatencyMs?: number;
  maxCostPer1M?: number;
  minTier?: number;
  preferSelfHosted?: boolean;
  excludeDeprecated?: boolean;
  requireCommercialUse?: boolean;
}

export class UnifiedModelRegistry {
  async getAllModels(options?: { includeDisabled?: boolean; includeDeprecated?: boolean }): Promise<UnifiedModel[]> {
    let sql = `
      SELECT * FROM unified_model_registry
      WHERE 1=1
    `;

    if (!options?.includeDisabled) {
      sql += ` AND enabled = true`;
    }
    if (!options?.includeDeprecated) {
      sql += ` AND deprecated = false`;
    }

    sql += ` ORDER BY source, category, display_name`;

    const result = await executeStatement(sql, []);
    return result.rows as unknown as UnifiedModel[];
  }

  async getModel(modelId: string): Promise<UnifiedModel | null> {
    const result = await executeStatement(
      `SELECT * FROM unified_model_registry WHERE model_id = $1`,
      [{ name: 'modelId', value: { stringValue: modelId } }]
    );

    return result.rows.length > 0 ? (result.rows[0] as unknown as UnifiedModel) : null;
  }

  async getModelsByCategory(category: ModelCategory): Promise<UnifiedModel[]> {
    const result = await executeStatement(
      `SELECT * FROM unified_model_registry 
       WHERE category = $1 AND enabled = true AND deprecated = false
       ORDER BY source, display_name`,
      [{ name: 'category', value: { stringValue: category } }]
    );

    return result.rows as unknown as UnifiedModel[];
  }

  async getModelsByProvider(provider: string): Promise<UnifiedModel[]> {
    const result = await executeStatement(
      `SELECT * FROM unified_model_registry 
       WHERE provider = $1 AND enabled = true AND deprecated = false
       ORDER BY display_name`,
      [{ name: 'provider', value: { stringValue: provider } }]
    );

    return result.rows as unknown as UnifiedModel[];
  }

  async getModelsByCapability(capability: string): Promise<UnifiedModel[]> {
    const result = await executeStatement(
      `SELECT * FROM unified_model_registry 
       WHERE $1 = ANY(capabilities) AND enabled = true AND deprecated = false
       ORDER BY source, display_name`,
      [{ name: 'capability', value: { stringValue: capability } }]
    );

    return result.rows as unknown as UnifiedModel[];
  }

  async selectBestModel(criteria: ModelSelectionCriteria): Promise<UnifiedModel | null> {
    let sql = `
      SELECT umr.*, ph.status as provider_status, ph.avg_latency_ms
      FROM unified_model_registry umr
      LEFT JOIN provider_health ph ON umr.provider = ph.provider_id
      WHERE umr.enabled = true
    `;
    const params: SqlParameter[] = [];
    let paramIndex = 1;

    if (criteria.excludeDeprecated !== false) {
      sql += ` AND umr.deprecated = false`;
    }

    if (criteria.category) {
      sql += ` AND umr.category = $${paramIndex++}`;
      params.push({ name: 'category', value: { stringValue: criteria.category } });
    }

    if (criteria.capabilities && criteria.capabilities.length > 0) {
      sql += ` AND umr.capabilities && $${paramIndex++}::text[]`;
      params.push({ name: 'capabilities', value: { stringValue: `{${criteria.capabilities.join(',')}}` } });
    }

    if (criteria.inputModality) {
      sql += ` AND $${paramIndex++} = ANY(umr.input_modalities)`;
      params.push({ name: 'inputModality', value: { stringValue: criteria.inputModality } });
    }

    if (criteria.outputModality) {
      sql += ` AND $${paramIndex++} = ANY(umr.output_modalities)`;
      params.push({ name: 'outputModality', value: { stringValue: criteria.outputModality } });
    }

    if (criteria.minTier) {
      sql += ` AND umr.min_tier <= $${paramIndex++}`;
      params.push({ name: 'minTier', value: { longValue: criteria.minTier } });
    }

    if (criteria.maxCostPer1M) {
      sql += ` AND umr.input_price_per_1m <= $${paramIndex++}`;
      params.push({ name: 'maxCost', value: { doubleValue: criteria.maxCostPer1M } });
    }

    if (criteria.requireCommercialUse) {
      sql += ` AND umr.commercial_use_allowed = true`;
    }

    sql += ` ORDER BY`;
    if (criteria.preferSelfHosted) {
      sql += ` CASE WHEN umr.source = 'self-hosted' THEN 0 ELSE 1 END,`;
    }
    sql += ` COALESCE(ph.avg_latency_ms, 999999) ASC, umr.input_price_per_1m ASC`;
    sql += ` LIMIT 1`;

    const result = await executeStatement(sql, params);
    return result.rows.length > 0 ? (result.rows[0] as unknown as UnifiedModel) : null;
  }

  async getProviderHealth(providerId: string, region?: string): Promise<ProviderHealth | null> {
    const result = await executeStatement(
      `SELECT * FROM provider_health WHERE provider_id = $1 AND region = $2`,
      [
        { name: 'providerId', value: { stringValue: providerId } },
        { name: 'region', value: { stringValue: region || 'us-east-1' } },
      ]
    );

    return result.rows.length > 0 ? (result.rows[0] as unknown as ProviderHealth) : null;
  }

  async updateProviderHealth(
    providerId: string,
    region: string,
    health: Partial<ProviderHealth>
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO provider_health (provider_id, region, status, avg_latency_ms, p95_latency_ms, p99_latency_ms, error_rate, success_rate, last_check_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (provider_id, region)
       DO UPDATE SET
         status = EXCLUDED.status,
         avg_latency_ms = EXCLUDED.avg_latency_ms,
         p95_latency_ms = EXCLUDED.p95_latency_ms,
         p99_latency_ms = EXCLUDED.p99_latency_ms,
         error_rate = EXCLUDED.error_rate,
         success_rate = EXCLUDED.success_rate,
         last_check_at = NOW(),
         updated_at = NOW()`,
      [
        { name: 'providerId', value: { stringValue: providerId } },
        { name: 'region', value: { stringValue: region } },
        { name: 'status', value: { stringValue: health.status || 'unknown' } },
        { name: 'avgLatency', value: health.avgLatencyMs ? { longValue: health.avgLatencyMs } : { isNull: true } },
        { name: 'p95Latency', value: health.p95LatencyMs ? { longValue: health.p95LatencyMs } : { isNull: true } },
        { name: 'p99Latency', value: health.p99LatencyMs ? { longValue: health.p99LatencyMs } : { isNull: true } },
        { name: 'errorRate', value: health.errorRate ? { doubleValue: health.errorRate } : { isNull: true } },
        { name: 'successRate', value: health.successRate ? { doubleValue: health.successRate } : { isNull: true } },
      ]
    );
  }

  async getAllProviderHealth(): Promise<ProviderHealth[]> {
    const result = await executeStatement(
      `SELECT * FROM provider_health ORDER BY provider_id, region`,
      []
    );

    return result.rows as unknown as ProviderHealth[];
  }

  async getUnhealthyProviders(): Promise<ProviderHealth[]> {
    const result = await executeStatement(
      `SELECT * FROM provider_health 
       WHERE status IN ('degraded', 'unhealthy')
       ORDER BY status DESC, last_check_at DESC`,
      []
    );

    return result.rows as unknown as ProviderHealth[];
  }

  async logSync(syncResult: SyncResult): Promise<void> {
    await executeStatement(
      `INSERT INTO registry_sync_log (sync_type, models_updated, models_added, models_removed, errors, duration_ms)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [
        { name: 'syncType', value: { stringValue: syncResult.syncType } },
        { name: 'modelsUpdated', value: { longValue: syncResult.modelsUpdated } },
        { name: 'modelsAdded', value: { longValue: syncResult.modelsAdded } },
        { name: 'modelsRemoved', value: { longValue: syncResult.modelsRemoved } },
        { name: 'errors', value: { stringValue: JSON.stringify(syncResult.errors) } },
        { name: 'durationMs', value: { longValue: syncResult.durationMs } },
      ]
    );
  }

  async getRecentSyncs(limit: number = 10): Promise<SyncResult[]> {
    const result = await executeStatement(
      `SELECT * FROM registry_sync_log ORDER BY created_at DESC LIMIT $1`,
      [{ name: 'limit', value: { longValue: limit } }]
    );

    return result.rows as unknown as SyncResult[];
  }

  async getModelStats(): Promise<{
    totalModels: number;
    externalModels: number;
    selfHostedModels: number;
    byCategory: Record<string, number>;
    byProvider: Record<string, number>;
    enabledCount: number;
    deprecatedCount: number;
  }> {
    const result = await executeStatement(
      `SELECT 
         COUNT(*) as total_models,
         COUNT(*) FILTER (WHERE source = 'external') as external_models,
         COUNT(*) FILTER (WHERE source = 'self-hosted') as self_hosted_models,
         COUNT(*) FILTER (WHERE enabled = true) as enabled_count,
         COUNT(*) FILTER (WHERE deprecated = true) as deprecated_count
       FROM unified_model_registry`,
      []
    );

    const categoryResult = await executeStatement(
      `SELECT category, COUNT(*) as count FROM unified_model_registry GROUP BY category`,
      []
    );

    const providerResult = await executeStatement(
      `SELECT provider, COUNT(*) as count FROM unified_model_registry GROUP BY provider`,
      []
    );

    const stats = result.rows[0] as Record<string, unknown>;
    const byCategory: Record<string, number> = {};
    const byProvider: Record<string, number> = {};

    for (const row of categoryResult.rows as Array<{ category: string; count: number }>) {
      byCategory[row.category] = Number(row.count);
    }

    for (const row of providerResult.rows as Array<{ provider: string; count: number }>) {
      byProvider[row.provider] = Number(row.count);
    }

    return {
      totalModels: Number(stats.total_models || 0),
      externalModels: Number(stats.external_models || 0),
      selfHostedModels: Number(stats.self_hosted_models || 0),
      enabledCount: Number(stats.enabled_count || 0),
      deprecatedCount: Number(stats.deprecated_count || 0),
      byCategory,
      byProvider,
    };
  }

  async updateModelStatus(modelId: string, updates: { enabled?: boolean; deprecated?: boolean; status?: string }): Promise<void> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: SqlParameter[] = [
      { name: 'modelId', value: { stringValue: modelId } },
    ];
    let paramIndex = 2;

    if (updates.enabled !== undefined) {
      setClauses.push(`enabled = $${paramIndex++}`);
      params.push({ name: 'enabled', value: { booleanValue: updates.enabled } });
    }
    if (updates.deprecated !== undefined) {
      setClauses.push(`deprecated = $${paramIndex++}`);
      params.push({ name: 'deprecated', value: { booleanValue: updates.deprecated } });
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      params.push({ name: 'status', value: { stringValue: updates.status } });
    }

    await executeStatement(
      `UPDATE self_hosted_models SET ${setClauses.join(', ')} WHERE model_id = $1`,
      params
    );
  }

  async searchModels(query: string, limit: number = 20): Promise<UnifiedModel[]> {
    const result = await executeStatement(
      `SELECT * FROM unified_model_registry 
       WHERE enabled = true AND deprecated = false
         AND (
           display_name ILIKE $1 
           OR model_id ILIKE $1 
           OR description ILIKE $1
           OR $2 = ANY(capabilities)
         )
       ORDER BY display_name
       LIMIT $3`,
      [
        { name: 'query', value: { stringValue: `%${query}%` } },
        { name: 'queryExact', value: { stringValue: query.toLowerCase() } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    return result.rows as unknown as UnifiedModel[];
  }

  async getModelsForTier(tier: number): Promise<UnifiedModel[]> {
    const result = await executeStatement(
      `SELECT * FROM unified_model_registry 
       WHERE enabled = true AND deprecated = false AND min_tier <= $1
       ORDER BY source, category, display_name`,
      [{ name: 'tier', value: { longValue: tier } }]
    );

    return result.rows as unknown as UnifiedModel[];
  }
}

export const unifiedModelRegistry = new UnifiedModelRegistry();
