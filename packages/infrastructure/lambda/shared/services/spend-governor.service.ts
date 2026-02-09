/**
 * RADIANT v7.39.0 — Spend Governor Service
 *
 * Two-layer spend control:
 *   Layer 1: Global instance budget — tracks total AWS spend, can freeze services
 *   Layer 2: Per-tenant AI budget — gates model router, suspends models per tenant
 *
 * Features:
 *   - Flexible time periods (any number of hours or days)
 *   - In-memory budget cache with 60s TTL for sub-ms gate checks
 *   - SENTINEL alerts at configurable warning threshold
 *   - Model quarantine via drift-correction service at suspend threshold
 *   - AWS service freeze/thaw via aws-freeze.service
 *   - Scheduled cost reports to super admins
 *   - Critical alert banner integration
 */

import { executeStatement } from '../db/client';
import { RadiantError, ErrorCodes } from '../errors/radiant-error';
import { createRegisteredLogger } from './logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'spend-governor',
  category: 'infrastructure',
  sourceType: 'application',
});

// ============================================================================
// Types
// ============================================================================

export interface SpendCheckResult {
  blocked: boolean;
  warning: boolean;
  percentUsed: number;
  budgetUsd: number;
  spentUsd: number;
  reason: string;
  hasOverride: boolean;
}

export interface TenantBudgetConfig {
  tenantId: string;
  budgetUsd: number;
  periodHours: number;
  warningThreshold: number;
  suspendThreshold: number;
  perModelLimitUsd: number;
  isEnabled: boolean;
  isSuspended: boolean;
  suspendedAt: string | null;
  currentSpendUsd: number;
}

export interface InstanceBudgetConfig {
  budgetUsd: number;
  periodHours: number;
  warningThreshold: number;
  suspendThreshold: number;
  isFrozen: boolean;
  frozenAt: string | null;
  frozenReason: string | null;
  currentSpendUsd: number;
  costReportIntervalHours: number;
  lastCostReportAt: string | null;
}

export interface SpendSummary {
  totalSpendUsd: number;
  totalRequests: number;
  byModel: Record<string, { costUsd: number; requests: number }>;
  byProvider: Record<string, { costUsd: number; requests: number }>;
  periodStart: string;
  periodEnd: string;
}

export interface CostReportData {
  scope: 'instance' | 'tenant';
  tenantId?: string;
  periodStart: string;
  periodEnd: string;
  totalSpendUsd: number;
  aiSpendUsd: number;
  awsSpendUsd: number;
  breakdown: Record<string, unknown>;
}

interface CacheEntry {
  result: SpendCheckResult;
  expiresAt: number;
}

// ============================================================================
// In-Memory Budget Cache
// ============================================================================

const CACHE_TTL_MS = 60_000; // 60 seconds
const budgetCache = new Map<string, CacheEntry>();

function getCachedCheck(tenantId: string): SpendCheckResult | null {
  const entry = budgetCache.get(tenantId);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.result;
  }
  if (entry) {
    budgetCache.delete(tenantId);
  }
  return null;
}

function setCachedCheck(tenantId: string, result: SpendCheckResult): void {
  budgetCache.set(tenantId, {
    result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function invalidateCache(tenantId?: string): void {
  if (tenantId) {
    budgetCache.delete(tenantId);
  } else {
    budgetCache.clear();
  }
}

// ============================================================================
// Service
// ============================================================================

export class SpendGovernorService {

  // --------------------------------------------------------------------------
  // Layer 2: Per-Tenant Budget Check (called from model router)
  // --------------------------------------------------------------------------

  async checkBudget(tenantId: string, modelId?: string): Promise<SpendCheckResult> {
    // Fast path: check in-memory cache
    const cached = getCachedCheck(tenantId);
    if (cached) {
      return cached;
    }

    try {
      const result = await executeStatement(
        `SELECT * FROM check_spend_budget($1::UUID)`,
        [tenantId]
      );

      if (!result.rows || result.rows.length === 0) {
        const noConfig: SpendCheckResult = {
          blocked: false, warning: false, percentUsed: 0,
          budgetUsd: 0, spentUsd: 0, reason: '', hasOverride: false,
        };
        setCachedCheck(tenantId, noConfig);
        return noConfig;
      }

      const row = result.rows[0] as Record<string, unknown>;
      const check: SpendCheckResult = {
        blocked: Boolean(row.blocked),
        warning: Boolean(row.warning),
        percentUsed: Number(row.percent_used) || 0,
        budgetUsd: Number(row.budget_usd) || 0,
        spentUsd: Number(row.spent_usd) || 0,
        reason: String(row.reason || ''),
        hasOverride: Boolean(row.has_override),
      };

      setCachedCheck(tenantId, check);
      return check;
    } catch (error) {
      logger.error('Failed to check spend budget', {
        tenantId,
        modelId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Fail open — don't block requests if the governor itself fails
      return {
        blocked: false, warning: false, percentUsed: 0,
        budgetUsd: 0, spentUsd: 0, reason: 'governor_error', hasOverride: false,
      };
    }
  }

  // --------------------------------------------------------------------------
  // Throw if blocked (convenience for model router)
  // --------------------------------------------------------------------------

  async enforceOrThrow(tenantId: string, modelId: string): Promise<SpendCheckResult> {
    const check = await this.checkBudget(tenantId, modelId);

    if (check.blocked) {
      logger.error('Spend governor BLOCKED model invocation', {
        tenantId,
        modelId,
        budgetUsd: check.budgetUsd,
        spentUsd: check.spentUsd,
        percentUsed: check.percentUsed,
        reason: check.reason,
      });

      throw new RadiantError({
        code: ErrorCodes.SPEND_LIMIT_EXCEEDED,
        message: 'Service temporarily unavailable. Please try again later.',
        details: {
          tenantId,
          modelId,
          internalReason: check.reason,
        },
      });
    }

    if (check.warning) {
      logger.warn('Spend governor warning: approaching budget limit', {
        tenantId,
        modelId,
        percentUsed: check.percentUsed,
        budgetUsd: check.budgetUsd,
        spentUsd: check.spentUsd,
      });
    }

    return check;
  }

  // --------------------------------------------------------------------------
  // Layer 2: Tenant Budget Management
  // --------------------------------------------------------------------------

  async getTenantConfig(tenantId: string): Promise<TenantBudgetConfig | null> {
    const result = await executeStatement(
      `SELECT * FROM spend_governor_config WHERE tenant_id = $1`,
      [tenantId]
    );
    if (!result.rows || result.rows.length === 0) return null;
    const row = result.rows[0] as Record<string, unknown>;
    return this.mapTenantConfig(row);
  }

  async getAllTenantConfigs(): Promise<TenantBudgetConfig[]> {
    const result = await executeStatement(
      `SELECT * FROM spend_governor_config WHERE is_enabled = true ORDER BY current_spend_usd DESC`,
      []
    );
    return (result.rows || []).map((row: unknown) =>
      this.mapTenantConfig(row as Record<string, unknown>)
    );
  }

  async setTenantBudget(
    tenantId: string,
    budgetUsd: number,
    periodHours: number,
    performedBy: string,
    options?: {
      warningThreshold?: number;
      suspendThreshold?: number;
      perModelLimitUsd?: number;
    }
  ): Promise<TenantBudgetConfig> {
    const warning = options?.warningThreshold ?? 0.90;
    const suspend = options?.suspendThreshold ?? 1.00;
    const perModel = options?.perModelLimitUsd ?? 0;

    await executeStatement(
      `INSERT INTO spend_governor_config (
         tenant_id, budget_usd, period_hours, warning_threshold,
         suspend_threshold, per_model_limit_usd, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (tenant_id) DO UPDATE SET
         budget_usd = $2, period_hours = $3, warning_threshold = $4,
         suspend_threshold = $5, per_model_limit_usd = $6, updated_at = NOW()`,
      [tenantId, budgetUsd, periodHours, warning, suspend, perModel, performedBy]
    );

    await this.recordAudit(tenantId, 'budget_set', 'tenant', budgetUsd, 0,
      `Budget set to $${budgetUsd} / ${periodHours}h`, performedBy);

    invalidateCache(tenantId);
    return (await this.getTenantConfig(tenantId))!;
  }

  async increaseBudget(
    tenantId: string,
    newBudgetUsd: number,
    performedBy: string
  ): Promise<TenantBudgetConfig> {
    const current = await this.getTenantConfig(tenantId);
    if (!current) {
      throw new RadiantError({
        code: ErrorCodes.RESOURCE_NOT_FOUND,
        message: `No spend governor config for tenant ${tenantId}`,
      });
    }

    await executeStatement(
      `UPDATE spend_governor_config
       SET budget_usd = $2, is_suspended = false, suspended_at = NULL,
           suspended_reason = NULL, updated_at = NOW()
       WHERE tenant_id = $1`,
      [tenantId, newBudgetUsd]
    );

    // If tenant was suspended, unquarantine spend-suspended models
    if (current.isSuspended) {
      await this.unquarantineSpendSuspendedModels(tenantId);

      await this.createCriticalAlert({
        alertType: 'spend_restored',
        severity: 'info',
        title: 'AI Models Restored',
        message: `Budget increased to $${newBudgetUsd}. All spend-suspended models have been restored.`,
        scope: 'tenant',
        tenantId,
        autoResolve: true,
      });
    }

    await this.recordAudit(tenantId, 'budget_increased', 'tenant', newBudgetUsd,
      current.currentSpendUsd,
      `Budget increased from $${current.budgetUsd} to $${newBudgetUsd}`, performedBy);

    invalidateCache(tenantId);
    return (await this.getTenantConfig(tenantId))!;
  }

  async suspendTenant(tenantId: string, reason: string, performedBy: string): Promise<void> {
    await executeStatement(
      `UPDATE spend_governor_config
       SET is_suspended = true, suspended_at = NOW(), suspended_reason = $2, updated_at = NOW()
       WHERE tenant_id = $1`,
      [tenantId, reason]
    );

    // Quarantine all models for this tenant
    await this.quarantineAllModels(tenantId, reason);

    await this.createCriticalAlert({
      alertType: 'spend_suspended',
      severity: 'critical',
      title: 'AI Models Suspended — Budget Exceeded',
      message: `Tenant budget exceeded. All AI models have been suspended. Reason: ${reason}`,
      scope: 'tenant',
      tenantId,
      autoResolve: true,
    });

    await this.recordAudit(tenantId, 'models_suspended', 'tenant', 0, 0, reason, performedBy);
    invalidateCache(tenantId);

    logger.error('Spend governor: tenant models SUSPENDED', {
      tenantId,
      reason,
      performedBy,
    });
  }

  async restoreTenant(tenantId: string, performedBy: string): Promise<void> {
    await executeStatement(
      `UPDATE spend_governor_config
       SET is_suspended = false, suspended_at = NULL, suspended_reason = NULL, updated_at = NOW()
       WHERE tenant_id = $1`,
      [tenantId]
    );

    await this.unquarantineSpendSuspendedModels(tenantId);

    await this.createCriticalAlert({
      alertType: 'spend_restored',
      severity: 'info',
      title: 'AI Models Restored',
      message: `AI models have been manually restored by an administrator.`,
      scope: 'tenant',
      tenantId,
      autoResolve: true,
    });

    await this.recordAudit(tenantId, 'models_restored', 'tenant', 0, 0,
      'Manual restoration', performedBy);
    invalidateCache(tenantId);
  }

  async grantOverride(
    tenantId: string,
    durationHours: number,
    grantedBy: string,
    reason?: string
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + durationHours * 3600_000).toISOString();

    await executeStatement(
      `INSERT INTO spend_governor_overrides (
         tenant_id, scope, granted_by, expires_at, reason
       ) VALUES ($1, 'tenant', $2, $3, $4)`,
      [tenantId, grantedBy, expiresAt, reason || `Override granted for ${durationHours}h`]
    );

    // Temporarily unsuspend
    await executeStatement(
      `UPDATE spend_governor_config
       SET is_suspended = false, suspended_at = NULL, updated_at = NOW()
       WHERE tenant_id = $1`,
      [tenantId]
    );

    await this.unquarantineSpendSuspendedModels(tenantId);

    await this.recordAudit(tenantId, 'override_granted', 'tenant', 0, 0,
      `Override for ${durationHours}h until ${expiresAt}`, grantedBy);
    invalidateCache(tenantId);
  }

  // --------------------------------------------------------------------------
  // Layer 1: Instance Budget Management
  // --------------------------------------------------------------------------

  async getInstanceConfig(): Promise<InstanceBudgetConfig> {
    const result = await executeStatement(
      `SELECT * FROM spend_governor_instance LIMIT 1`, []
    );
    if (!result.rows || result.rows.length === 0) {
      return {
        budgetUsd: 5000, periodHours: 720, warningThreshold: 0.90,
        suspendThreshold: 1.00, isFrozen: false, frozenAt: null,
        frozenReason: null, currentSpendUsd: 0,
        costReportIntervalHours: 24, lastCostReportAt: null,
      };
    }
    const row = result.rows[0] as Record<string, unknown>;
    return {
      budgetUsd: Number(row.budget_usd) || 5000,
      periodHours: Number(row.period_hours) || 720,
      warningThreshold: Number(row.warning_threshold) || 0.90,
      suspendThreshold: Number(row.suspend_threshold) || 1.00,
      isFrozen: Boolean(row.is_frozen),
      frozenAt: row.frozen_at ? String(row.frozen_at) : null,
      frozenReason: row.frozen_reason ? String(row.frozen_reason) : null,
      currentSpendUsd: Number(row.current_spend_usd) || 0,
      costReportIntervalHours: Number(row.cost_report_interval_hours) || 24,
      lastCostReportAt: row.last_cost_report_at ? String(row.last_cost_report_at) : null,
    };
  }

  async setInstanceBudget(
    budgetUsd: number,
    periodHours: number,
    performedBy: string,
    options?: {
      warningThreshold?: number;
      suspendThreshold?: number;
      costReportIntervalHours?: number;
    }
  ): Promise<InstanceBudgetConfig> {
    await executeStatement(
      `UPDATE spend_governor_instance SET
         budget_usd = $1, period_hours = $2,
         warning_threshold = COALESCE($3, warning_threshold),
         suspend_threshold = COALESCE($4, suspend_threshold),
         cost_report_interval_hours = COALESCE($5, cost_report_interval_hours),
         updated_at = NOW()`,
      [
        budgetUsd, periodHours,
        options?.warningThreshold ?? null,
        options?.suspendThreshold ?? null,
        options?.costReportIntervalHours ?? null,
      ]
    );

    await this.recordAudit(null, 'instance_budget_set', 'instance', budgetUsd, 0,
      `Instance budget set to $${budgetUsd} / ${periodHours}h`, performedBy);

    return this.getInstanceConfig();
  }

  async freezeInstance(reason: string, performedBy: string, frozenServices?: string[]): Promise<void> {
    await executeStatement(
      `UPDATE spend_governor_instance SET
         is_frozen = true, frozen_at = NOW(), frozen_reason = $1, updated_at = NOW()`,
      [reason]
    );

    await this.createCriticalAlert({
      alertType: 'instance_frozen',
      severity: 'critical',
      title: 'AWS Services FROZEN — Budget Exceeded',
      message: `Instance budget exceeded. AWS services have been frozen to prevent further charges. Reason: ${reason}. Use Deployer to restore.`,
      scope: 'instance',
      autoResolve: false,
    });

    await this.recordAudit(null, 'instance_frozen', 'instance', 0, 0, reason, performedBy, {
      frozenServices: frozenServices || [],
    });

    logger.error('Spend governor: AWS services FROZEN', { reason, performedBy, frozenServices });
  }

  async thawInstance(performedBy: string): Promise<void> {
    await executeStatement(
      `UPDATE spend_governor_instance SET
         is_frozen = false, frozen_at = NULL, frozen_reason = NULL, updated_at = NOW()`,
      []
    );

    // Dismiss the frozen alert
    await executeStatement(
      `UPDATE critical_alerts SET
         is_active = false, is_dismissed = true, dismissed_by = $1, dismissed_at = NOW()
       WHERE alert_type = 'instance_frozen' AND is_active = true`,
      [performedBy]
    );

    await this.createCriticalAlert({
      alertType: 'instance_thawed',
      severity: 'info',
      title: 'AWS Services Restored',
      message: 'Instance has been unfrozen. All services are being restored.',
      scope: 'instance',
      autoResolve: true,
    });

    await this.recordAudit(null, 'instance_thawed', 'instance', 0, 0,
      'Instance unfrozen', performedBy);

    logger.info('Spend governor: AWS services THAWED', { performedBy });
  }

  // --------------------------------------------------------------------------
  // Spend Sync — update cached spend from cost_events
  // --------------------------------------------------------------------------

  async syncTenantSpend(tenantId: string): Promise<number> {
    const config = await this.getTenantConfig(tenantId);
    if (!config) return 0;

    const result = await executeStatement(
      `SELECT COALESCE(SUM(cost_cents), 0) / 100.0 AS spend_usd
       FROM cost_events
       WHERE tenant_id = $1
         AND created_at >= NOW() - ($2 || ' hours')::INTERVAL`,
      [tenantId, config.periodHours]
    );

    const spendUsd = Number((result.rows?.[0] as Record<string, unknown>)?.spend_usd) || 0;

    await executeStatement(
      `UPDATE spend_governor_config
       SET current_spend_usd = $2, last_spend_sync = NOW(), updated_at = NOW()
       WHERE tenant_id = $1`,
      [tenantId, spendUsd]
    );

    invalidateCache(tenantId);
    return spendUsd;
  }

  async syncAllTenantSpend(): Promise<Map<string, number>> {
    const configs = await this.getAllTenantConfigs();
    const spends = new Map<string, number>();

    for (const config of configs) {
      const spend = await this.syncTenantSpend(config.tenantId);
      spends.set(config.tenantId, spend);
    }

    return spends;
  }

  async updateInstanceSpend(spendUsd: number): Promise<void> {
    await executeStatement(
      `UPDATE spend_governor_instance
       SET current_spend_usd = $1, last_spend_sync = NOW(), updated_at = NOW()`,
      [spendUsd]
    );
  }

  // --------------------------------------------------------------------------
  // Spend Summary
  // --------------------------------------------------------------------------

  async getSpendSummary(tenantId: string, periodHours?: number): Promise<SpendSummary> {
    const config = await this.getTenantConfig(tenantId);
    const hours = periodHours ?? config?.periodHours ?? 720;

    const result = await executeStatement(
      `SELECT * FROM get_spend_summary($1::UUID, $2)`,
      [tenantId, hours]
    );

    if (!result.rows || result.rows.length === 0) {
      return {
        totalSpendUsd: 0, totalRequests: 0,
        byModel: {}, byProvider: {},
        periodStart: new Date(Date.now() - hours * 3600_000).toISOString(),
        periodEnd: new Date().toISOString(),
      };
    }

    const row = result.rows[0] as Record<string, unknown>;
    return {
      totalSpendUsd: Number(row.total_spend_usd) || 0,
      totalRequests: Number(row.total_requests) || 0,
      byModel: (row.by_model as Record<string, { costUsd: number; requests: number }>) || {},
      byProvider: (row.by_provider as Record<string, { costUsd: number; requests: number }>) || {},
      periodStart: String(row.period_start),
      periodEnd: String(row.period_end),
    };
  }

  // --------------------------------------------------------------------------
  // Cost Reports
  // --------------------------------------------------------------------------

  async recordCostReport(report: CostReportData, recipients: string[]): Promise<void> {
    await executeStatement(
      `INSERT INTO spend_governor_cost_reports (
         report_type, scope, tenant_id, period_start, period_end,
         total_spend_usd, ai_spend_usd, aws_spend_usd, breakdown, recipients
       ) VALUES ('scheduled', $1, $2, $3, $4, $5, $6, $7, $8::JSONB, $9::JSONB)`,
      [
        report.scope,
        report.tenantId || null,
        report.periodStart,
        report.periodEnd,
        report.totalSpendUsd,
        report.aiSpendUsd,
        report.awsSpendUsd,
        JSON.stringify(report.breakdown),
        JSON.stringify(recipients),
      ]
    );

    await executeStatement(
      `UPDATE spend_governor_instance SET last_cost_report_at = NOW(), updated_at = NOW()`,
      []
    );
  }

  async shouldSendCostReport(): Promise<boolean> {
    const config = await this.getInstanceConfig();
    if (!config.lastCostReportAt) return true;

    const lastReport = new Date(config.lastCostReportAt).getTime();
    const intervalMs = config.costReportIntervalHours * 3600_000;
    return Date.now() - lastReport >= intervalMs;
  }

  // --------------------------------------------------------------------------
  // Critical Alerts
  // --------------------------------------------------------------------------

  async createCriticalAlert(params: {
    alertType: string;
    severity: 'warning' | 'critical' | 'info';
    title: string;
    message: string;
    scope: 'instance' | 'tenant';
    tenantId?: string;
    autoResolve?: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    // Auto-dismiss previous alerts of the same type for the same scope
    if (params.autoResolve) {
      await executeStatement(
        `UPDATE critical_alerts SET is_active = false, is_dismissed = true,
           dismissed_by = 'system:auto-resolve', dismissed_at = NOW()
         WHERE alert_type = $1 AND scope = $2 AND is_active = true
           AND ($3::UUID IS NULL OR tenant_id = $3::UUID)`,
        [params.alertType, params.scope, params.tenantId || null]
      );
    }

    const result = await executeStatement(
      `INSERT INTO critical_alerts (
         alert_type, severity, title, message, scope, tenant_id,
         auto_resolve, metadata
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::JSONB)
       RETURNING id`,
      [
        params.alertType, params.severity, params.title, params.message,
        params.scope, params.tenantId || null,
        params.autoResolve ?? false,
        JSON.stringify(params.metadata || {}),
      ]
    );

    return String((result.rows?.[0] as Record<string, unknown>)?.id);
  }

  async getActiveCriticalAlerts(): Promise<Array<{
    id: string;
    alertType: string;
    severity: string;
    title: string;
    message: string;
    scope: string;
    tenantId: string | null;
    createdAt: string;
  }>> {
    const result = await executeStatement(
      `SELECT id, alert_type, severity, title, message, scope, tenant_id, created_at
       FROM critical_alerts
       WHERE is_active = true AND is_dismissed = false
       ORDER BY
         CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
         created_at DESC
       LIMIT 20`,
      []
    );

    return (result.rows || []).map((row: unknown) => {
      const r = row as Record<string, unknown>;
      return {
        id: String(r.id),
        alertType: String(r.alert_type),
        severity: String(r.severity),
        title: String(r.title),
        message: String(r.message),
        scope: String(r.scope),
        tenantId: r.tenant_id ? String(r.tenant_id) : null,
        createdAt: String(r.created_at),
      };
    });
  }

  async dismissCriticalAlert(alertId: string, dismissedBy: string): Promise<void> {
    await executeStatement(
      `UPDATE critical_alerts SET
         is_dismissed = true, dismissed_by = $2, dismissed_at = NOW(), updated_at = NOW()
       WHERE id = $1::UUID`,
      [alertId, dismissedBy]
    );
  }

  // --------------------------------------------------------------------------
  // Audit Log
  // --------------------------------------------------------------------------

  async getAuditLog(options?: {
    tenantId?: string;
    scope?: 'tenant' | 'instance';
    limit?: number;
  }): Promise<Array<Record<string, unknown>>> {
    const limit = options?.limit ?? 50;
    let query = `SELECT * FROM spend_governor_audit WHERE 1=1`;
    const params: unknown[] = [];
    let paramIdx = 1;

    if (options?.tenantId) {
      query += ` AND tenant_id = $${paramIdx}::UUID`;
      params.push(options.tenantId);
      paramIdx++;
    }
    if (options?.scope) {
      query += ` AND scope = $${paramIdx}`;
      params.push(options.scope);
      paramIdx++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIdx}`;
    params.push(limit);

    const result = await executeStatement(query, params);
    return (result.rows || []) as Array<Record<string, unknown>>;
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private async quarantineAllModels(tenantId: string, reason: string): Promise<void> {
    try {
      const { driftCorrectionService } = await import('./drift-correction.service.js');
      // Get all models with spend for this tenant
      const result = await executeStatement(
        `SELECT DISTINCT model_id FROM cost_events
         WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '30 days'`,
        [tenantId]
      );

      const models = (result.rows || []).map((r: unknown) =>
        String((r as Record<string, unknown>).model_id)
      );

      for (const modelId of models) {
        try {
          await driftCorrectionService.quarantineModel(
            tenantId, modelId,
            `spend_limit:${reason}`,
            0, // No auto-release — manual only
            'system:spend-governor'
          );
        } catch (qErr) {
          logger.warn('Failed to quarantine model for spend limit', {
            tenantId, modelId, error: qErr instanceof Error ? qErr.message : String(qErr),
          });
        }
      }

      logger.info('Quarantined all models for spend-suspended tenant', {
        tenantId, modelCount: models.length, models,
      });
    } catch (error) {
      logger.error('Failed to quarantine models', {
        tenantId, error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async unquarantineSpendSuspendedModels(tenantId: string): Promise<void> {
    try {
      const { driftCorrectionService } = await import('./drift-correction.service.js');
      // Only unquarantine models that were quarantined by the spend governor
      const result = await executeStatement(
        `SELECT model_id FROM model_weight_config
         WHERE tenant_id = $1 AND is_quarantined = true
           AND quarantine_reason LIKE 'spend_limit:%'`,
        [tenantId]
      );

      const models = (result.rows || []).map((r: unknown) =>
        String((r as Record<string, unknown>).model_id)
      );

      for (const modelId of models) {
        try {
          await driftCorrectionService.unquarantineModel(
            tenantId, modelId,
            'system:spend-governor'
          );
        } catch (uErr) {
          logger.warn('Failed to unquarantine model', {
            tenantId, modelId, error: uErr instanceof Error ? uErr.message : String(uErr),
          });
        }
      }

      logger.info('Unquarantined spend-suspended models', {
        tenantId, modelCount: models.length, models,
      });
    } catch (error) {
      logger.error('Failed to unquarantine models', {
        tenantId, error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async recordAudit(
    tenantId: string | null,
    action: string,
    scope: string,
    budgetUsd: number,
    spentUsd: number,
    reason: string,
    performedBy: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      await executeStatement(
        `SELECT record_spend_event($1, $2, $3, $4, $5, $6, $7, $8::JSONB)`,
        [
          tenantId, action, scope, budgetUsd, spentUsd,
          reason, performedBy, JSON.stringify(metadata || {}),
        ]
      );
    } catch (error) {
      logger.warn('Failed to record spend audit', {
        action, tenantId, error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private mapTenantConfig(row: Record<string, unknown>): TenantBudgetConfig {
    return {
      tenantId: String(row.tenant_id),
      budgetUsd: Number(row.budget_usd) || 0,
      periodHours: Number(row.period_hours) || 720,
      warningThreshold: Number(row.warning_threshold) || 0.90,
      suspendThreshold: Number(row.suspend_threshold) || 1.00,
      perModelLimitUsd: Number(row.per_model_limit_usd) || 0,
      isEnabled: Boolean(row.is_enabled),
      isSuspended: Boolean(row.is_suspended),
      suspendedAt: row.suspended_at ? String(row.suspended_at) : null,
      currentSpendUsd: Number(row.current_spend_usd) || 0,
    };
  }
}

export const spendGovernorService = new SpendGovernorService();
