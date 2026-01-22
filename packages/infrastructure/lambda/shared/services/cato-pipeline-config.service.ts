/**
 * Cato Pipeline Configuration Service
 * 
 * Manages admin-configurable parameters for the Cato Method Pipeline.
 * Allows administrators to customize pipeline behavior per tenant.
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { CatoRiskLevel, CatoCompensationType, CATO_GOVERNANCE_PRESETS } from '@radiant/shared';

export interface CatoPipelineConfig {
  id: string;
  tenantId: string;
  
  // Governance Settings
  governancePreset: 'COWBOY' | 'BALANCED' | 'PARANOID';
  customRiskThresholds?: {
    autoExecute: number;
    checkpoint: number;
    veto: number;
  };
  
  // Method Execution Settings
  defaultModel: string;
  fallbackModel: string;
  maxMethodRetries: number;
  methodTimeoutMs: number;
  
  // Cost & Usage Limits
  maxPipelineCostCents: number;
  maxDailyPipelineCostCents: number;
  maxConcurrentPipelines: number;
  
  // Context Settings
  defaultContextStrategy: 'FULL' | 'SUMMARY' | 'TAIL' | 'RELEVANT' | 'MINIMAL';
  maxContextTokens: number;
  contextTailCount: number;
  
  // Compensation Settings
  enableAutoCompensation: boolean;
  compensationTimeoutMs: number;
  maxCompensationRetries: number;
  
  // Audit Settings
  enableMerkleAudit: boolean;
  auditRetentionDays: number;
  enablePromptAudit: boolean;
  
  // Feature Flags
  enableCritics: boolean;
  enableRedTeam: boolean;
  enableWarRoom: boolean;
  
  // Notification Settings
  notifyOnCheckpoint: boolean;
  notifyOnVeto: boolean;
  notifyOnFailure: boolean;
  notificationWebhookUrl?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_CONFIG: Omit<CatoPipelineConfig, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'> = {
  governancePreset: 'BALANCED',
  defaultModel: 'claude-sonnet-4-20250514',
  fallbackModel: 'gpt-4o',
  maxMethodRetries: 3,
  methodTimeoutMs: 30000,
  maxPipelineCostCents: 1000,
  maxDailyPipelineCostCents: 10000,
  maxConcurrentPipelines: 10,
  defaultContextStrategy: 'RELEVANT',
  maxContextTokens: 8000,
  contextTailCount: 5,
  enableAutoCompensation: true,
  compensationTimeoutMs: 60000,
  maxCompensationRetries: 3,
  enableMerkleAudit: true,
  auditRetentionDays: 2555,
  enablePromptAudit: true,
  enableCritics: true,
  enableRedTeam: false,
  enableWarRoom: true,
  notifyOnCheckpoint: true,
  notifyOnVeto: true,
  notifyOnFailure: true,
};

export class CatoPipelineConfigService {
  private pool: Pool;
  private configCache: Map<string, { config: CatoPipelineConfig; cachedAt: number }> = new Map();
  private cacheTtlMs = 60000;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async getConfig(tenantId: string): Promise<CatoPipelineConfig> {
    // Check cache
    const cached = this.configCache.get(tenantId);
    if (cached && Date.now() - cached.cachedAt < this.cacheTtlMs) {
      return cached.config;
    }

    const result = await this.pool.query(
      'SELECT * FROM cato_pipeline_config WHERE tenant_id = $1',
      [tenantId]
    );

    if (result.rows.length === 0) {
      return this.createDefaultConfig(tenantId);
    }

    const config = this.mapRowToConfig(result.rows[0]);
    this.configCache.set(tenantId, { config, cachedAt: Date.now() });
    return config;
  }

  async createDefaultConfig(tenantId: string): Promise<CatoPipelineConfig> {
    const id = uuidv4();
    const now = new Date();

    await this.pool.query(
      `INSERT INTO cato_pipeline_config (
        id, tenant_id, governance_preset, default_model, fallback_model,
        max_method_retries, method_timeout_ms, max_pipeline_cost_cents,
        max_daily_pipeline_cost_cents, max_concurrent_pipelines,
        default_context_strategy, max_context_tokens, context_tail_count,
        enable_auto_compensation, compensation_timeout_ms, max_compensation_retries,
        enable_merkle_audit, audit_retention_days, enable_prompt_audit,
        enable_critics, enable_red_team, enable_war_room,
        notify_on_checkpoint, notify_on_veto, notify_on_failure
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)`,
      [
        id, tenantId, DEFAULT_CONFIG.governancePreset, DEFAULT_CONFIG.defaultModel,
        DEFAULT_CONFIG.fallbackModel, DEFAULT_CONFIG.maxMethodRetries, DEFAULT_CONFIG.methodTimeoutMs,
        DEFAULT_CONFIG.maxPipelineCostCents, DEFAULT_CONFIG.maxDailyPipelineCostCents,
        DEFAULT_CONFIG.maxConcurrentPipelines, DEFAULT_CONFIG.defaultContextStrategy,
        DEFAULT_CONFIG.maxContextTokens, DEFAULT_CONFIG.contextTailCount,
        DEFAULT_CONFIG.enableAutoCompensation, DEFAULT_CONFIG.compensationTimeoutMs,
        DEFAULT_CONFIG.maxCompensationRetries, DEFAULT_CONFIG.enableMerkleAudit,
        DEFAULT_CONFIG.auditRetentionDays, DEFAULT_CONFIG.enablePromptAudit,
        DEFAULT_CONFIG.enableCritics, DEFAULT_CONFIG.enableRedTeam, DEFAULT_CONFIG.enableWarRoom,
        DEFAULT_CONFIG.notifyOnCheckpoint, DEFAULT_CONFIG.notifyOnVeto, DEFAULT_CONFIG.notifyOnFailure,
      ]
    );

    const config: CatoPipelineConfig = {
      id,
      tenantId,
      ...DEFAULT_CONFIG,
      createdAt: now,
      updatedAt: now,
    };

    this.configCache.set(tenantId, { config, cachedAt: Date.now() });
    return config;
  }

  async updateConfig(tenantId: string, updates: Partial<CatoPipelineConfig>): Promise<CatoPipelineConfig> {
    const current = await this.getConfig(tenantId);

    const updateFields: string[] = [];
    const updateValues: unknown[] = [];
    let paramIdx = 1;

    const allowedFields: (keyof CatoPipelineConfig)[] = [
      'governancePreset', 'customRiskThresholds', 'defaultModel', 'fallbackModel',
      'maxMethodRetries', 'methodTimeoutMs', 'maxPipelineCostCents',
      'maxDailyPipelineCostCents', 'maxConcurrentPipelines', 'defaultContextStrategy',
      'maxContextTokens', 'contextTailCount', 'enableAutoCompensation',
      'compensationTimeoutMs', 'maxCompensationRetries', 'enableMerkleAudit',
      'auditRetentionDays', 'enablePromptAudit', 'enableCritics', 'enableRedTeam',
      'enableWarRoom', 'notifyOnCheckpoint', 'notifyOnVeto', 'notifyOnFailure',
      'notificationWebhookUrl',
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        const dbField = this.camelToSnake(field);
        updateFields.push(`${dbField} = $${paramIdx++}`);
        updateValues.push(field === 'customRiskThresholds' ? JSON.stringify(updates[field]) : updates[field]);
      }
    }

    if (updateFields.length === 0) {
      return current;
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(tenantId);

    await this.pool.query(
      `UPDATE cato_pipeline_config SET ${updateFields.join(', ')} WHERE tenant_id = $${paramIdx}`,
      updateValues
    );

    this.configCache.delete(tenantId);
    return this.getConfig(tenantId);
  }

  async getRiskThresholds(tenantId: string): Promise<{ autoExecute: number; checkpoint: number; veto: number }> {
    const config = await this.getConfig(tenantId);
    
    if (config.customRiskThresholds) {
      return config.customRiskThresholds;
    }

    const preset = CATO_GOVERNANCE_PRESETS[config.governancePreset];
    return {
      autoExecute: preset.riskThresholds.autoExecute,
      checkpoint: (preset.riskThresholds as any).checkpoint,
      veto: preset.riskThresholds.veto,
    };
  }

  async checkCostLimits(tenantId: string, proposedCostCents: number): Promise<{ allowed: boolean; reason?: string }> {
    const config = await this.getConfig(tenantId);

    if (proposedCostCents > config.maxPipelineCostCents) {
      return { allowed: false, reason: `Cost ${proposedCostCents}¢ exceeds max pipeline cost ${config.maxPipelineCostCents}¢` };
    }

    // Check daily limit
    const dailyResult = await this.pool.query(
      `SELECT COALESCE(SUM(total_cost_cents), 0) as daily_cost
       FROM cato_pipeline_executions
       WHERE tenant_id = $1 AND started_at > NOW() - INTERVAL '24 hours'`,
      [tenantId]
    );
    const dailyCost = Number(dailyResult.rows[0]?.daily_cost || 0);

    if (dailyCost + proposedCostCents > config.maxDailyPipelineCostCents) {
      return { allowed: false, reason: `Daily cost limit reached: ${dailyCost}¢ + ${proposedCostCents}¢ > ${config.maxDailyPipelineCostCents}¢` };
    }

    return { allowed: true };
  }

  async checkConcurrencyLimits(tenantId: string): Promise<{ allowed: boolean; reason?: string }> {
    const config = await this.getConfig(tenantId);

    const result = await this.pool.query(
      `SELECT COUNT(*) as running_count
       FROM cato_pipeline_executions
       WHERE tenant_id = $1 AND status IN ('PENDING', 'RUNNING', 'CHECKPOINT_WAITING')`,
      [tenantId]
    );
    const runningCount = Number(result.rows[0]?.running_count || 0);

    if (runningCount >= config.maxConcurrentPipelines) {
      return { allowed: false, reason: `Max concurrent pipelines reached: ${runningCount}/${config.maxConcurrentPipelines}` };
    }

    return { allowed: true };
  }

  async isFeatureEnabled(tenantId: string, feature: 'critics' | 'redTeam' | 'warRoom'): Promise<boolean> {
    const config = await this.getConfig(tenantId);
    switch (feature) {
      case 'critics': return config.enableCritics;
      case 'redTeam': return config.enableRedTeam;
      case 'warRoom': return config.enableWarRoom;
      default: return false;
    }
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  private mapRowToConfig(row: Record<string, unknown>): CatoPipelineConfig {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      governancePreset: row.governance_preset as 'COWBOY' | 'BALANCED' | 'PARANOID',
      customRiskThresholds: row.custom_risk_thresholds as CatoPipelineConfig['customRiskThresholds'],
      defaultModel: row.default_model as string,
      fallbackModel: row.fallback_model as string,
      maxMethodRetries: row.max_method_retries as number,
      methodTimeoutMs: row.method_timeout_ms as number,
      maxPipelineCostCents: row.max_pipeline_cost_cents as number,
      maxDailyPipelineCostCents: row.max_daily_pipeline_cost_cents as number,
      maxConcurrentPipelines: row.max_concurrent_pipelines as number,
      defaultContextStrategy: row.default_context_strategy as CatoPipelineConfig['defaultContextStrategy'],
      maxContextTokens: row.max_context_tokens as number,
      contextTailCount: row.context_tail_count as number,
      enableAutoCompensation: row.enable_auto_compensation as boolean,
      compensationTimeoutMs: row.compensation_timeout_ms as number,
      maxCompensationRetries: row.max_compensation_retries as number,
      enableMerkleAudit: row.enable_merkle_audit as boolean,
      auditRetentionDays: row.audit_retention_days as number,
      enablePromptAudit: row.enable_prompt_audit as boolean,
      enableCritics: row.enable_critics as boolean,
      enableRedTeam: row.enable_red_team as boolean,
      enableWarRoom: row.enable_war_room as boolean,
      notifyOnCheckpoint: row.notify_on_checkpoint as boolean,
      notifyOnVeto: row.notify_on_veto as boolean,
      notifyOnFailure: row.notify_on_failure as boolean,
      notificationWebhookUrl: row.notification_webhook_url as string | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

export const createCatoPipelineConfigService = (pool: Pool): CatoPipelineConfigService => {
  return new CatoPipelineConfigService(pool);
};
