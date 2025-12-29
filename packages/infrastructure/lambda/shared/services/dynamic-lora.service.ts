// Dynamic LoRA Swapping Service
// Hot-swappable domain expertise adapters

import { executeStatement, stringParam } from '../db/client';
import type {
  LoRAAdapter,
  LoRALoadRequest,
  LoRALoadResult,
  DynamicLoRAConfig,
  LoRADomain,
} from '@radiant/shared';
import crypto from 'crypto';

const DEFAULT_CONFIG: DynamicLoRAConfig = {
  enabled: false,
  registryBucket: 'radiant-lora-adapters',
  cacheSize: 5,
  preloadDomains: ['coding', 'legal'],
  maxLoadTimeMs: 5000,
  fallbackToBase: true,
  autoSelectByDomain: true,
};

interface AdapterCache {
  adapterId: string;
  loadedAt: Date;
  lastUsedAt: Date;
  useCount: number;
}

class DynamicLoRAService {
  private loadedAdapters: Map<string, AdapterCache> = new Map();

  /**
   * Get best adapter for detected domain
   */
  async selectAdapterForDomain(
    tenantId: string,
    domain: string,
    subdomain?: string
  ): Promise<LoRAAdapter | null> {
    // Map domain to LoRA domain
    const loraDomain = this.mapToLoRADomain(domain);
    if (!loraDomain) return null;

    // Find best matching adapter
    const result = await executeStatement({
      sql: `
        SELECT * FROM lora_adapters
        WHERE (tenant_id = $1::uuid OR tenant_id IS NULL)
        AND domain = $2
        AND is_active = true
        AND is_verified = true
        ${subdomain ? `AND (subdomain = $3 OR subdomain IS NULL)` : ''}
        ORDER BY 
          CASE WHEN tenant_id = $1::uuid THEN 0 ELSE 1 END,
          CASE WHEN subdomain = $3 THEN 0 ELSE 1 END,
          benchmark_score DESC NULLS LAST
        LIMIT 1
      `,
      parameters: [
        stringParam('tenantId', tenantId),
        stringParam('domain', loraDomain),
        stringParam('subdomain', subdomain || ''),
      ],
    });

    if (!result.rows?.length) return null;

    return this.mapRowToAdapter(result.rows[0]);
  }

  /**
   * Load an adapter into memory
   */
  async loadAdapter(request: LoRALoadRequest): Promise<LoRALoadResult> {
    const startTime = Date.now();

    try {
      // Check if already loaded
      if (this.loadedAdapters.has(request.adapterId)) {
        const cached = this.loadedAdapters.get(request.adapterId)!;
        cached.lastUsedAt = new Date();
        cached.useCount++;
        return {
          success: true,
          adapterId: request.adapterId,
          loadTimeMs: 0,
        };
      }

      // Get adapter details
      const adapter = await this.getAdapter(request.adapterId);
      if (!adapter) {
        return {
          success: false,
          adapterId: request.adapterId,
          loadTimeMs: Date.now() - startTime,
          error: 'Adapter not found',
        };
      }

      // Evict if cache full
      await this.evictIfNeeded();

      // Load from S3 to SageMaker endpoint
      // This would call SageMaker API to load the adapter
      await this.loadToEndpoint(adapter, request.baseModelEndpoint);

      // Add to cache
      this.loadedAdapters.set(request.adapterId, {
        adapterId: request.adapterId,
        loadedAt: new Date(),
        lastUsedAt: new Date(),
        useCount: 1,
      });

      // Update stats
      await this.recordAdapterLoad(request.adapterId);

      const loadTimeMs = Date.now() - startTime;

      return {
        success: true,
        adapterId: request.adapterId,
        loadTimeMs,
      };
    } catch (error) {
      return {
        success: false,
        adapterId: request.adapterId,
        loadTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Unload an adapter from memory
   */
  async unloadAdapter(adapterId: string): Promise<void> {
    if (!this.loadedAdapters.has(adapterId)) return;

    // Would call SageMaker API to unload
    this.loadedAdapters.delete(adapterId);
  }

  /**
   * Get adapter by ID
   */
  async getAdapter(adapterId: string): Promise<LoRAAdapter | null> {
    const result = await executeStatement({
      sql: `SELECT * FROM lora_adapters WHERE id = $1::uuid`,
      parameters: [stringParam('id', adapterId)],
    });

    if (!result.rows?.length) return null;
    return this.mapRowToAdapter(result.rows[0]);
  }

  /**
   * List adapters for a domain
   */
  async listAdaptersForDomain(
    tenantId: string,
    domain: LoRADomain
  ): Promise<LoRAAdapter[]> {
    const result = await executeStatement({
      sql: `
        SELECT * FROM lora_adapters
        WHERE (tenant_id = $1::uuid OR tenant_id IS NULL)
        AND domain = $2
        AND is_active = true
        ORDER BY benchmark_score DESC NULLS LAST
      `,
      parameters: [
        stringParam('tenantId', tenantId),
        stringParam('domain', domain),
      ],
    });

    return (result.rows || []).map(row => this.mapRowToAdapter(row));
  }

  /**
   * Register a new adapter
   */
  async registerAdapter(adapter: Omit<LoRAAdapter, 'id' | 'createdAt' | 'updatedAt' | 'timesLoaded'>): Promise<LoRAAdapter> {
    const id = crypto.randomUUID();
    const now = new Date();

    await executeStatement({
      sql: `
        INSERT INTO lora_adapters (
          id, tenant_id, name, description, domain, subdomain,
          s3_bucket, s3_key, size_bytes, checksum,
          base_model, rank, alpha, target_modules,
          benchmark_score, avg_latency_ms, load_time_ms,
          times_loaded, is_active, is_verified,
          created_at, updated_at
        ) VALUES (
          $1::uuid, $2::uuid, $3, $4, $5, $6,
          $7, $8, $9, $10,
          $11, $12, $13, $14::text[],
          $15, $16, $17,
          0, $18, $19,
          $20, $21
        )
      `,
      parameters: [
        stringParam('id', id),
        stringParam('tenantId', adapter.tenantId || ''),
        stringParam('name', adapter.name),
        stringParam('description', adapter.description),
        stringParam('domain', adapter.domain),
        stringParam('subdomain', adapter.subdomain || ''),
        stringParam('s3Bucket', adapter.s3Bucket),
        stringParam('s3Key', adapter.s3Key),
        stringParam('sizeBytes', String(adapter.sizeBytes)),
        stringParam('checksum', adapter.checksum),
        stringParam('baseModel', adapter.baseModel),
        stringParam('rank', String(adapter.rank)),
        stringParam('alpha', String(adapter.alpha)),
        stringParam('targetModules', `{${adapter.targetModules.join(',')}}`),
        stringParam('benchmarkScore', adapter.benchmarkScore ? String(adapter.benchmarkScore) : ''),
        stringParam('avgLatencyMs', adapter.avgLatencyMs ? String(adapter.avgLatencyMs) : ''),
        stringParam('loadTimeMs', adapter.loadTimeMs ? String(adapter.loadTimeMs) : ''),
        stringParam('isActive', String(adapter.isActive)),
        stringParam('isVerified', String(adapter.isVerified)),
        stringParam('createdAt', now.toISOString()),
        stringParam('updatedAt', now.toISOString()),
      ],
    });

    return {
      ...adapter,
      id,
      timesLoaded: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Update adapter benchmarks
   */
  async updateBenchmarks(
    adapterId: string,
    benchmarkScore: number,
    avgLatencyMs: number
  ): Promise<void> {
    await executeStatement({
      sql: `
        UPDATE lora_adapters
        SET benchmark_score = $1, avg_latency_ms = $2, updated_at = NOW()
        WHERE id = $3::uuid
      `,
      parameters: [
        stringParam('benchmarkScore', String(benchmarkScore)),
        stringParam('avgLatencyMs', String(avgLatencyMs)),
        stringParam('id', adapterId),
      ],
    });
  }

  /**
   * Get currently loaded adapters
   */
  getLoadedAdapters(): Map<string, AdapterCache> {
    return new Map(this.loadedAdapters);
  }

  /**
   * Preload adapters for specified domains
   */
  async preloadAdapters(
    tenantId: string,
    domains: LoRADomain[],
    baseModelEndpoint: string
  ): Promise<LoRALoadResult[]> {
    const results: LoRALoadResult[] = [];

    for (const domain of domains) {
      const adapter = await this.selectAdapterForDomain(tenantId, domain);
      if (adapter) {
        const result = await this.loadAdapter({
          adapterId: adapter.id,
          baseModelEndpoint,
          priority: 'low',
        });
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Map general domain to LoRA domain
   */
  private mapToLoRADomain(domain: string): LoRADomain | null {
    const mapping: Record<string, LoRADomain> = {
      'law': 'legal',
      'legal': 'legal',
      'medicine': 'medical',
      'healthcare': 'medical',
      'medical': 'medical',
      'finance': 'financial',
      'economics': 'financial',
      'financial': 'financial',
      'science': 'scientific',
      'research': 'scientific',
      'scientific': 'scientific',
      'programming': 'coding',
      'software': 'coding',
      'coding': 'coding',
      'writing': 'creative_writing',
      'creative': 'creative_writing',
      'creative_writing': 'creative_writing',
      'translation': 'translation',
      'language': 'translation',
      'support': 'customer_support',
      'customer_support': 'customer_support',
      'documentation': 'technical_writing',
      'technical_writing': 'technical_writing',
    };

    const lower = domain.toLowerCase();
    return mapping[lower] || null;
  }

  /**
   * Load adapter to SageMaker endpoint
   */
  private async loadToEndpoint(
    adapter: LoRAAdapter,
    endpoint: string
  ): Promise<void> {
    // Would call SageMaker to load adapter
    // Placeholder for actual implementation
    console.log(`Loading adapter ${adapter.id} to endpoint ${endpoint}`);
    
    // Simulate load time
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Evict least recently used adapter if cache is full
   */
  private async evictIfNeeded(): Promise<void> {
    const config = await this.getConfig('default');
    
    if (this.loadedAdapters.size >= config.cacheSize) {
      let oldestId = '';
      let oldestTime = new Date();

      for (const [id, cache] of this.loadedAdapters) {
        if (cache.lastUsedAt < oldestTime) {
          oldestTime = cache.lastUsedAt;
          oldestId = id;
        }
      }

      if (oldestId) {
        await this.unloadAdapter(oldestId);
      }
    }
  }

  /**
   * Record adapter load in database
   */
  private async recordAdapterLoad(adapterId: string): Promise<void> {
    await executeStatement({
      sql: `
        UPDATE lora_adapters
        SET times_loaded = times_loaded + 1, last_loaded_at = NOW()
        WHERE id = $1::uuid
      `,
      parameters: [stringParam('id', adapterId)],
    });
  }

  /**
   * Map database row to adapter
   */
  private mapRowToAdapter(row: Record<string, unknown>): LoRAAdapter {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string | undefined,
      name: row.name as string,
      description: row.description as string,
      domain: row.domain as LoRADomain,
      subdomain: row.subdomain as string | undefined,
      s3Bucket: row.s3_bucket as string,
      s3Key: row.s3_key as string,
      sizeBytes: parseInt(row.size_bytes as string),
      checksum: row.checksum as string,
      baseModel: row.base_model as string,
      rank: parseInt(row.rank as string),
      alpha: parseFloat(row.alpha as string),
      targetModules: (row.target_modules || []) as string[],
      benchmarkScore: row.benchmark_score ? parseFloat(row.benchmark_score as string) : undefined,
      avgLatencyMs: row.avg_latency_ms ? parseInt(row.avg_latency_ms as string) : undefined,
      loadTimeMs: row.load_time_ms ? parseInt(row.load_time_ms as string) : undefined,
      timesLoaded: parseInt(row.times_loaded as string) || 0,
      lastLoadedAt: row.last_loaded_at ? new Date(row.last_loaded_at as string) : undefined,
      isActive: row.is_active as boolean,
      isVerified: row.is_verified as boolean,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  /**
   * Get configuration
   */
  async getConfig(tenantId: string): Promise<DynamicLoRAConfig> {
    const result = await executeStatement({
      sql: `SELECT dynamic_lora FROM cognitive_architecture_config WHERE tenant_id = $1::uuid`,
      parameters: [stringParam('tenantId', tenantId)],
    });

    if (result.rows?.length && result.rows[0].dynamic_lora) {
      return result.rows[0].dynamic_lora as DynamicLoRAConfig;
    }

    return DEFAULT_CONFIG;
  }
}

export const dynamicLoRAService = new DynamicLoRAService();
