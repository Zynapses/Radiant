/**
 * LIVS Configuration Service
 * 
 * Manages LIVS configuration hierarchy: System → Tenant → User
 * 
 * @version 1.0.0
 * @since v6.3.0
 */

import { Pool } from 'pg';
import {
  LIVSConfiguration,
  DEFAULT_LIVS_CONFIG,
  InterrogationDepth,
  LIVSCostMode
} from '@radiant/shared';

export interface LIVSConfigServiceDeps {
  pool: Pool;
}

export class LIVSConfigService {
  private pool: Pool;

  constructor(deps: LIVSConfigServiceDeps) {
    this.pool = deps.pool;
  }

  /**
   * Get LIVS configuration for a tenant
   * Returns default config if none exists
   */
  async getConfig(tenantId: string): Promise<LIVSConfiguration> {
    const result = await this.pool.query(
      `SELECT config FROM livs_config WHERE tenant_id = $1`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return DEFAULT_LIVS_CONFIG;
    }

    return this.mergeWithDefaults(result.rows[0].config);
  }

  /**
   * Update LIVS configuration for a tenant
   */
  async updateConfig(
    tenantId: string,
    config: Partial<LIVSConfiguration>,
    updatedBy?: string
  ): Promise<LIVSConfiguration> {
    const currentConfig = await this.getConfig(tenantId);
    const mergedConfig = this.deepMerge(currentConfig as unknown as Record<string, unknown>, config as unknown as Record<string, unknown>) as unknown as LIVSConfiguration;

    await this.pool.query(
      `INSERT INTO livs_config (tenant_id, config, updated_at, updated_by)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (tenant_id) DO UPDATE SET
         config = $2,
         updated_at = NOW(),
         updated_by = $3`,
      [tenantId, JSON.stringify(mergedConfig), updatedBy]
    );

    return mergedConfig;
  }

  /**
   * Reset configuration to defaults
   */
  async resetConfig(tenantId: string, updatedBy?: string): Promise<LIVSConfiguration> {
    await this.pool.query(
      `DELETE FROM livs_config WHERE tenant_id = $1`,
      [tenantId]
    );

    return DEFAULT_LIVS_CONFIG;
  }

  /**
   * Check if LIVS is enabled for a tenant
   */
  async isEnabled(tenantId: string): Promise<boolean> {
    const config = await this.getConfig(tenantId);
    return config.enabled;
  }

  /**
   * Check if individual interrogation is enabled
   */
  async isInterrogationEnabled(tenantId: string): Promise<boolean> {
    const config = await this.getConfig(tenantId);
    return config.enabled && config.individualInterrogation.enabled;
  }

  /**
   * Check if orchestration integrity is enabled
   */
  async isOrchestrationIntegrityEnabled(tenantId: string): Promise<boolean> {
    const config = await this.getConfig(tenantId);
    return config.enabled && config.orchestrationIntegrity.enabled;
  }

  /**
   * Get the effective interrogation depth for a query
   */
  async getEffectiveDepth(
    tenantId: string,
    options?: {
      domain?: string;
      queryType?: string;
      suspicionLevel?: number;
    }
  ): Promise<InterrogationDepth> {
    const config = await this.getConfig(tenantId);
    
    if (!config.enabled || !config.individualInterrogation.enabled) {
      return 0;
    }

    let depth = config.individualInterrogation.defaultDepth;

    // Auto-escalate if suspicion level is high
    if (
      config.individualInterrogation.autoEscalate &&
      options?.suspicionLevel &&
      options.suspicionLevel > config.individualInterrogation.escalationThreshold
    ) {
      depth = Math.min(depth + 1, 4) as InterrogationDepth;
    }

    return depth;
  }

  /**
   * Get the cost multiplier limit
   */
  async getMaxCostMultiplier(tenantId: string): Promise<number> {
    const config = await this.getConfig(tenantId);
    return config.maxInterrogationCostMultiplier;
  }

  /**
   * Get the interrogator model (different from original to prevent self-validation)
   */
  async getInterrogatorModel(
    tenantId: string,
    originalModelId: string
  ): Promise<string> {
    const config = await this.getConfig(tenantId);
    
    // If specified, use that
    if (config.individualInterrogation.interrogatorModel) {
      return config.individualInterrogation.interrogatorModel;
    }

    // Otherwise, pick a different model based on cost mode
    const interrogatorModels: Record<LIVSCostMode, string[]> = {
      economy: ['claude-3-haiku-20240307', 'gpt-4o-mini'],
      balanced: ['claude-3-5-sonnet-20241022', 'gpt-4o'],
      thorough: ['claude-3-opus-20240229', 'gpt-4-turbo']
    };

    const candidates = interrogatorModels[config.costMode];
    
    // Pick one that's different from the original
    for (const model of candidates) {
      if (model !== originalModelId) {
        return model;
      }
    }

    // Fallback
    return candidates[0];
  }

  /**
   * Merge config with defaults to ensure all fields exist
   */
  private mergeWithDefaults(config: Partial<LIVSConfiguration>): LIVSConfiguration {
    return this.deepMerge(DEFAULT_LIVS_CONFIG as unknown as Record<string, unknown>, config as unknown as Record<string, unknown>) as unknown as LIVSConfiguration;
  }

  /**
   * Deep merge two objects
   */
  private deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
    const result = { ...target };
    
    for (const key of Object.keys(source) as Array<keyof T>) {
      const sourceValue = source[key];
      const targetValue = target[key];
      
      if (
        sourceValue !== undefined &&
        typeof sourceValue === 'object' &&
        sourceValue !== null &&
        !Array.isArray(sourceValue) &&
        typeof targetValue === 'object' &&
        targetValue !== null &&
        !Array.isArray(targetValue)
      ) {
        result[key] = this.deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        ) as T[keyof T];
      } else if (sourceValue !== undefined) {
        result[key] = sourceValue as T[keyof T];
      }
    }
    
    return result;
  }
}
