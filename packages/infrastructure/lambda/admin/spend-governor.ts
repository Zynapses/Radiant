// RADIANT v7.39.0 - Spend Governor Admin API
// Handles all /admin/spend-governor/* and /admin/critical-alerts/* routes

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { spendGovernorService } from '../shared/services/spend-governor.service';
import { awsFreezeService, FrozenServiceRecord } from '../shared/services/aws-freeze.service';
import { executeStatement } from '../shared/db/client';
import { success, handleError } from '../shared/response';
import { ValidationError, NotFoundError } from '../shared/errors';
import { createRegisteredLogger } from '../shared/services/logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'admin/spend-governor',
  category: 'audit',
  sourceType: 'lambda',
});

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const path = event.path;
    const method = event.httpMethod;
    const pathParts = path.split('/').filter(Boolean);

    // Determine if this is a spend-governor or critical-alerts route
    // pathParts: ['admin', 'spend-governor', ...] or ['admin', 'critical-alerts', ...]
    const domain = pathParts[1]; // 'spend-governor' or 'critical-alerts'

    if (domain === 'critical-alerts') {
      return handleCriticalAlerts(event, method, pathParts);
    }

    if (domain === 'spend-governor') {
      return handleSpendGovernor(event, method, pathParts);
    }

    throw new NotFoundError(`Unknown spend governor route: ${method} ${path}`);
  } catch (error) {
    return handleError(error);
  }
}

// ============================================================================
// Spend Governor Routes
// ============================================================================

async function handleSpendGovernor(
  event: APIGatewayProxyEvent,
  method: string,
  pathParts: string[]
): Promise<APIGatewayProxyResult> {
  const resource = pathParts[2]; // 'instance', 'tenants', 'audit'
  const resourceId = pathParts[3]; // tenant ID or action
  const action = pathParts[4]; // 'restore', 'freeze', 'thaw'

  // ---- Instance Routes ----
  if (resource === 'instance') {
    // GET /admin/spend-governor/instance
    if (method === 'GET' && !resourceId) {
      const config = await spendGovernorService.getInstanceConfig();
      return success(config);
    }

    // PUT /admin/spend-governor/instance
    if (method === 'PUT' && !resourceId) {
      const body = JSON.parse(event.body || '{}');
      await executeStatement(
        `UPDATE spend_governor_instance SET
           budget_usd = COALESCE($1, budget_usd),
           period_hours = COALESCE($2, period_hours),
           warning_threshold = COALESCE($3, warning_threshold),
           suspend_threshold = COALESCE($4, suspend_threshold),
           cost_report_interval_hours = COALESCE($5, cost_report_interval_hours)`,
        [
          body.budgetUsd ?? null,
          body.periodHours ?? null,
          body.warningThreshold ?? null,
          body.suspendThreshold ?? null,
          body.costReportIntervalHours ?? null,
        ]
      );

      logger.info('Instance budget updated', {
        budgetUsd: body.budgetUsd,
        periodHours: body.periodHours,
      });

      await executeStatement(
        `SELECT record_spend_event($1, $2, $3, $4, $5, $6, $7, $8::JSONB)`,
        [null, 'instance_budget_set', 'instance', body.budgetUsd ?? 0, 0, 'Admin dashboard update', 'admin', '{}']
      );

      const config = await spendGovernorService.getInstanceConfig();
      return success(config);
    }

    // POST /admin/spend-governor/instance/freeze
    if (method === 'POST' && resourceId === 'freeze') {
      const body = JSON.parse(event.body || '{}');
      const reason = body.reason || 'Manual freeze from Admin Dashboard';

      const freezeResult = await awsFreezeService.freezeAll(reason);

      // Store frozen services for later thaw
      await executeStatement(
        `UPDATE spend_governor_instance SET
           is_frozen = true,
           frozen_at = NOW(),
           frozen_reason = $1`,
        [reason]
      );

      // Store frozen service records for thaw recovery
      if (freezeResult.frozenServices.length > 0) {
        await executeStatement(
          `UPDATE spend_governor_instance SET
             frozen_reason = frozen_reason || E'\n\nFrozen services: ' || $1
           WHERE is_frozen = true`,
          [JSON.stringify(freezeResult.frozenServices)]
        );
      }

      await executeStatement(
        `SELECT record_spend_event($1, $2, $3, $4, $5, $6, $7, $8::JSONB)`,
        [null, 'instance_frozen', 'instance', 0, 0, reason, 'admin', JSON.stringify({ frozenCount: freezeResult.frozenServices.length })]
      );

      await spendGovernorService.createCriticalAlert({
        alertType: 'instance_frozen',
        severity: 'critical',
        title: 'AWS Services Frozen',
        message: reason,
        scope: 'instance',
        autoResolve: true,
      });

      logger.info('Instance manually frozen', { reason, frozenCount: freezeResult.frozenServices.length });
      return success({ frozen: true, frozenServices: freezeResult.frozenServices.length });
    }

    // POST /admin/spend-governor/instance/thaw
    if (method === 'POST' && resourceId === 'thaw') {
      // Recover frozen service records from DB
      const configResult = await executeStatement(
        `SELECT frozen_reason FROM spend_governor_instance WHERE is_frozen = true`,
        []
      );
      let frozenServices: FrozenServiceRecord[] = [];
      if (configResult.rows?.length) {
        const frozenReason = String((configResult.rows[0] as Record<string, unknown>).frozen_reason || '');
        const jsonMatch = frozenReason.match(/Frozen services: (\[.+\])/);
        if (jsonMatch) {
          try { frozenServices = JSON.parse(jsonMatch[1]); } catch { /* ignore */ }
        }
      }

      const thawResult = await awsFreezeService.thawAll(frozenServices);

      await executeStatement(
        `UPDATE spend_governor_instance SET
           is_frozen = false,
           frozen_at = NULL,
           frozen_reason = NULL`,
        []
      );

      await executeStatement(
        `SELECT record_spend_event($1, $2, $3, $4, $5, $6, $7, $8::JSONB)`,
        [null, 'instance_thawed', 'instance', 0, 0, 'Manual thaw from Admin Dashboard', 'admin', JSON.stringify({ restoredCount: thawResult.restoredServices.length })]
      );

      // Auto-resolve frozen alerts
      await executeStatement(
        `UPDATE critical_alerts SET is_active = false
         WHERE alert_type = 'instance_frozen' AND is_active = true`,
        []
      );

      logger.info('Instance manually thawed', { restoredCount: thawResult.restoredServices.length });
      return success({ thawed: true, restoredServices: thawResult.restoredServices.length });
    }
  }

  // ---- Tenant Routes ----
  if (resource === 'tenants') {
    // GET /admin/spend-governor/tenants
    if (method === 'GET' && !resourceId) {
      const result = await executeStatement(
        `SELECT
           id, tenant_id, budget_usd, period_hours,
           warning_threshold, suspend_threshold, per_model_limit_usd,
           is_enabled, is_suspended, suspended_at, current_spend_usd,
           created_at
         FROM spend_governor_config
         ORDER BY current_spend_usd DESC`,
        []
      );

      const tenants = (result.rows || []).map((row: unknown) => {
        const r = row as Record<string, unknown>;
        return {
          tenantId: r.tenant_id,
          budgetUsd: Number(r.budget_usd),
          periodHours: Number(r.period_hours),
          warningThreshold: Number(r.warning_threshold),
          suspendThreshold: Number(r.suspend_threshold),
          perModelLimitUsd: Number(r.per_model_limit_usd),
          isEnabled: Boolean(r.is_enabled),
          isSuspended: Boolean(r.is_suspended),
          suspendedAt: r.suspended_at ? String(r.suspended_at) : null,
          currentSpendUsd: Number(r.current_spend_usd),
        };
      });

      return success(tenants);
    }

    // POST /admin/spend-governor/tenants/:tenantId/restore
    if (method === 'POST' && resourceId && action === 'restore') {
      await spendGovernorService.restoreTenant(resourceId, 'admin');

      logger.info('Tenant manually restored', { tenantId: resourceId });
      return success({ restored: true, tenantId: resourceId });
    }

    // GET /admin/spend-governor/tenants/:tenantId
    if (method === 'GET' && resourceId && !action) {
      const result = await executeStatement(
        `SELECT * FROM spend_governor_config WHERE tenant_id = $1`,
        [resourceId]
      );
      if (!result.rows?.length) {
        throw new NotFoundError(`Tenant config not found: ${resourceId}`);
      }
      const r = result.rows[0] as Record<string, unknown>;
      return success({
        tenantId: r.tenant_id,
        budgetUsd: Number(r.budget_usd),
        periodHours: Number(r.period_hours),
        warningThreshold: Number(r.warning_threshold),
        suspendThreshold: Number(r.suspend_threshold),
        perModelLimitUsd: Number(r.per_model_limit_usd),
        isEnabled: Boolean(r.is_enabled),
        isSuspended: Boolean(r.is_suspended),
        suspendedAt: r.suspended_at ? String(r.suspended_at) : null,
        currentSpendUsd: Number(r.current_spend_usd),
      });
    }

    // PUT /admin/spend-governor/tenants/:tenantId
    if (method === 'PUT' && resourceId && !action) {
      const body = JSON.parse(event.body || '{}');
      await executeStatement(
        `INSERT INTO spend_governor_config (tenant_id, budget_usd, period_hours, warning_threshold, suspend_threshold, per_model_limit_usd, is_enabled)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (tenant_id) DO UPDATE SET
           budget_usd = COALESCE($2, spend_governor_config.budget_usd),
           period_hours = COALESCE($3, spend_governor_config.period_hours),
           warning_threshold = COALESCE($4, spend_governor_config.warning_threshold),
           suspend_threshold = COALESCE($5, spend_governor_config.suspend_threshold),
           per_model_limit_usd = COALESCE($6, spend_governor_config.per_model_limit_usd),
           is_enabled = COALESCE($7, spend_governor_config.is_enabled)`,
        [
          resourceId,
          body.budgetUsd ?? 1000,
          body.periodHours ?? 720,
          body.warningThreshold ?? 0.90,
          body.suspendThreshold ?? 1.00,
          body.perModelLimitUsd ?? 0,
          body.isEnabled ?? true,
        ]
      );

      await executeStatement(
        `SELECT record_spend_event($1, $2, $3, $4, $5, $6, $7, $8::JSONB)`,
        [resourceId, 'budget_set', 'tenant', body.budgetUsd ?? 0, 0, 'Admin dashboard update', 'admin', '{}']
      );

      return success({ updated: true, tenantId: resourceId });
    }
  }

  // ---- Audit Log Routes ----
  if (resource === 'audit') {
    // GET /admin/spend-governor/audit
    if (method === 'GET') {
      const limit = parseInt(event.queryStringParameters?.limit || '100', 10);
      const offset = parseInt(event.queryStringParameters?.offset || '0', 10);

      const result = await executeStatement(
        `SELECT id, tenant_id, action, scope, budget_usd, spent_usd,
                percent_used, reason, performed_by, metadata, created_at
         FROM spend_governor_audit
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      return success(result.rows || []);
    }
  }

  throw new NotFoundError(`Spend governor route not found: ${event.httpMethod} ${event.path}`);
}

// ============================================================================
// Critical Alerts Routes
// ============================================================================

async function handleCriticalAlerts(
  event: APIGatewayProxyEvent,
  method: string,
  pathParts: string[]
): Promise<APIGatewayProxyResult> {
  const alertId = pathParts[2];
  const action = pathParts[3]; // 'dismiss'

  // GET /admin/critical-alerts
  if (method === 'GET' && !alertId) {
    const result = await executeStatement(
      `SELECT id, alert_type, severity, title, message, scope,
              tenant_id, is_active, is_dismissed, created_at
       FROM critical_alerts
       WHERE is_active = true AND is_dismissed = false
       ORDER BY
         CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
         created_at DESC`,
      []
    );

    const alerts = (result.rows || []).map((row: unknown) => {
      const r = row as Record<string, unknown>;
      return {
        id: r.id,
        alertType: r.alert_type,
        severity: r.severity,
        title: r.title,
        message: r.message,
        scope: r.scope,
        tenantId: r.tenant_id || null,
        createdAt: r.created_at,
      };
    });

    return success(alerts);
  }

  // POST /admin/critical-alerts/:id/dismiss
  if (method === 'POST' && alertId && action === 'dismiss') {
    await executeStatement(
      `UPDATE critical_alerts SET
         is_dismissed = true,
         dismissed_by = 'admin'
       WHERE id = $1`,
      [alertId]
    );

    logger.info('Critical alert dismissed', { alertId });
    return success({ dismissed: true, alertId });
  }

  throw new NotFoundError(`Critical alerts route not found: ${method} ${event.path}`);
}
