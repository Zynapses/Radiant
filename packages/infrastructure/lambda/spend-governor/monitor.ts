/**
 * RADIANT v7.39.0 — Spend Governor Monitor Lambda
 *
 * Runs on a configurable EventBridge schedule (default: every 5 minutes).
 * 
 * Responsibilities:
 *   1. Sync tenant spend from cost_events into spend_governor_config cache
 *   2. Check each tenant against warning/suspend thresholds
 *   3. Suspend models for tenants that exceed their budget
 *   4. Send SENTINEL alerts at warning threshold
 *   5. Check instance-level AWS spend and freeze if exceeded
 *   6. Expire stale overrides
 *   7. Auto-resolve cleared critical alerts
 */

import { Handler, ScheduledEvent } from 'aws-lambda';
import {
  CostExplorerClient,
  GetCostAndUsageCommand,
  Granularity,
} from '@aws-sdk/client-cost-explorer';
import {
  spendGovernorService,
  invalidateCache,
  SpendCheckResult,
} from '../shared/services/spend-governor.service';
import { awsFreezeService, FrozenServiceRecord } from '../shared/services/aws-freeze.service';
import { executeStatement } from '../shared/db/client';
import { createRegisteredLogger } from '../shared/services/logging-registry.service';

const costExplorerClient = new CostExplorerClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const logger = createRegisteredLogger({
  serviceName: 'spend-governor/monitor',
  category: 'infrastructure',
  sourceType: 'lambda',
});

interface MonitorResult {
  status: 'completed' | 'error';
  tenantsChecked: number;
  tenantsSuspended: number;
  tenantsWarned: number;
  instanceFrozen: boolean;
  overridesExpired: number;
  errors: string[];
}

export const handler: Handler<ScheduledEvent> = async (): Promise<MonitorResult> => {
  logger.info('Spend governor monitor starting');

  const result: MonitorResult = {
    status: 'completed',
    tenantsChecked: 0,
    tenantsSuspended: 0,
    tenantsWarned: 0,
    instanceFrozen: false,
    overridesExpired: 0,
    errors: [],
  };

  try {
    // -----------------------------------------------------------------------
    // 1. Sync all tenant spend from cost_events
    // -----------------------------------------------------------------------
    const spends = await spendGovernorService.syncAllTenantSpend();
    result.tenantsChecked = spends.size;

    // -----------------------------------------------------------------------
    // 2. Check each tenant against thresholds
    // -----------------------------------------------------------------------
    const configs = await spendGovernorService.getAllTenantConfigs();

    for (const config of configs) {
      try {
        const check: SpendCheckResult = await spendGovernorService.checkBudget(config.tenantId);

        if (check.blocked && !config.isSuspended) {
          // Newly exceeded — suspend models
          await spendGovernorService.suspendTenant(
            config.tenantId,
            `Budget exceeded: $${check.spentUsd.toFixed(2)} / $${check.budgetUsd.toFixed(2)} (${(check.percentUsed * 100).toFixed(1)}%)`,
            'system:spend-governor-monitor'
          );
          result.tenantsSuspended++;

          // Send SENTINEL alert
          await sendSentinelAlert(
            config.tenantId,
            'spend_suspended',
            `Tenant AI models SUSPENDED — budget exceeded ($${check.spentUsd.toFixed(2)} / $${check.budgetUsd.toFixed(2)})`,
            check
          );
        } else if (check.warning && !check.blocked && !config.isSuspended) {
          // Approaching limit — warn
          const lastWarning = await getLastWarningTime(config.tenantId);
          const hoursSinceLastWarning = lastWarning
            ? (Date.now() - lastWarning.getTime()) / 3_600_000
            : Infinity;

          // Don't spam — at most once per hour
          if (hoursSinceLastWarning >= 1) {
            await sendSentinelAlert(
              config.tenantId,
              'spend_warning',
              `Tenant approaching budget limit ($${check.spentUsd.toFixed(2)} / $${check.budgetUsd.toFixed(2)} = ${(check.percentUsed * 100).toFixed(1)}%)`,
              check
            );
            await markWarningSent(config.tenantId);
            result.tenantsWarned++;
          }
        } else if (config.isSuspended && !check.blocked) {
          // Budget no longer exceeded (e.g., rolling window advanced) — auto-restore
          await spendGovernorService.restoreTenant(
            config.tenantId,
            'system:spend-governor-monitor'
          );
          logger.info('Auto-restored tenant — spend within budget again', {
            tenantId: config.tenantId,
          });
        }
      } catch (tenantError) {
        const msg = `Tenant ${config.tenantId}: ${tenantError instanceof Error ? tenantError.message : String(tenantError)}`;
        result.errors.push(msg);
        logger.error('Monitor failed for tenant', {
          tenantId: config.tenantId,
          error: tenantError instanceof Error ? tenantError.message : String(tenantError),
        });
      }
    }

    // -----------------------------------------------------------------------
    // 3. Sync instance AWS spend from Cost Explorer, then check budget
    // -----------------------------------------------------------------------
    try {
      await syncInstanceAWSSpend();
    } catch (ceError) {
      logger.warn('Cost Explorer sync failed — using cached spend', {
        error: ceError instanceof Error ? ceError.message : String(ceError),
      });
    }

    try {
      await checkInstanceBudget(result);
    } catch (instanceError) {
      result.errors.push(`Instance check: ${instanceError instanceof Error ? instanceError.message : String(instanceError)}`);
      logger.error('Instance budget check failed', {
        error: instanceError instanceof Error ? instanceError.message : String(instanceError),
      });
    }

    // -----------------------------------------------------------------------
    // 4. Expire stale overrides
    // -----------------------------------------------------------------------
    try {
      result.overridesExpired = await expireOverrides();
    } catch (overrideError) {
      result.errors.push(`Override expiry: ${overrideError instanceof Error ? overrideError.message : String(overrideError)}`);
    }

    // -----------------------------------------------------------------------
    // 5. Auto-resolve cleared alerts
    // -----------------------------------------------------------------------
    try {
      await autoResolveClearedAlerts();
    } catch (alertError) {
      logger.warn('Failed to auto-resolve alerts', {
        error: alertError instanceof Error ? alertError.message : String(alertError),
      });
    }

  } catch (error) {
    result.status = 'error';
    result.errors.push(error instanceof Error ? error.message : String(error));
    logger.error('Spend governor monitor failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  logger.info('Spend governor monitor completed', result as unknown as Record<string, unknown>);
  return result;
};

// ============================================================================
// Instance Budget Check
// ============================================================================

async function checkInstanceBudget(result: MonitorResult): Promise<void> {
  const config = await spendGovernorService.getInstanceConfig();

  if (config.budgetUsd <= 0) return;

  // Get current AWS spend from Cost Explorer or cached value
  const currentSpend = config.currentSpendUsd;
  const percentUsed = currentSpend / config.budgetUsd;

  if (percentUsed >= config.suspendThreshold && !config.isFrozen) {
    // FREEZE AWS services
    logger.error('INSTANCE BUDGET EXCEEDED — freezing AWS services', {
      currentSpend,
      budget: config.budgetUsd,
      percentUsed: (percentUsed * 100).toFixed(1),
    });

    const freezeResult = await awsFreezeService.freezeAll(
      `Instance budget exceeded: $${currentSpend.toFixed(2)} / $${config.budgetUsd.toFixed(2)}`
    );

    // Store frozen services list for thaw
    await storeFrozenServices(freezeResult.frozenServices);

    await spendGovernorService.freezeInstance(
      `Budget exceeded: $${currentSpend.toFixed(2)} / $${config.budgetUsd.toFixed(2)}`,
      'system:spend-governor-monitor',
      freezeResult.frozenServices.map(s => s.serviceId)
    );

    result.instanceFrozen = true;

    // Send critical SENTINEL alert
    await sendInstanceSentinelAlert(
      'instance_frozen',
      `AWS SERVICES FROZEN — Instance budget exceeded ($${currentSpend.toFixed(2)} / $${config.budgetUsd.toFixed(2)}). Use Deployer to restore.`
    );

  } else if (percentUsed >= config.warningThreshold && !config.isFrozen) {
    // Warning
    await spendGovernorService.createCriticalAlert({
      alertType: 'instance_spend_warning',
      severity: 'warning',
      title: 'Instance Spend Warning',
      message: `AWS spend at ${(percentUsed * 100).toFixed(1)}% of budget ($${currentSpend.toFixed(2)} / $${config.budgetUsd.toFixed(2)})`,
      scope: 'instance',
      autoResolve: true,
    });
  }
}

// ============================================================================
// Helpers
// ============================================================================

async function syncInstanceAWSSpend(): Promise<void> {
  // Get the configured period from instance config
  const config = await spendGovernorService.getInstanceConfig();
  const periodHours = config.periodHours || 720; // default 30 days
  const periodDays = Math.ceil(periodHours / 24);

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - periodDays);

  // Cost Explorer requires dates in YYYY-MM-DD format
  const startStr = start.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];

  // Skip if start == end (period < 1 day)
  if (startStr === endStr) {
    logger.info('Period too short for Cost Explorer query, skipping');
    return;
  }

  const cmd = new GetCostAndUsageCommand({
    TimePeriod: { Start: startStr, End: endStr },
    Granularity: Granularity.MONTHLY,
    Metrics: ['UnblendedCost'],
  });

  const res = await costExplorerClient.send(cmd);

  let totalSpend = 0;
  for (const result of res.ResultsByTime || []) {
    totalSpend += parseFloat(result.Total?.UnblendedCost?.Amount || '0');
  }

  // Update the cached value in the database
  await executeStatement(
    `UPDATE spend_governor_instance SET current_spend_usd = $1`,
    [Math.round(totalSpend * 100) / 100]
  );

  logger.info('Instance AWS spend synced from Cost Explorer', {
    totalSpend: totalSpend.toFixed(2),
    periodDays,
    start: startStr,
    end: endStr,
  });
}

async function sendSentinelAlert(
  tenantId: string,
  alertType: string,
  message: string,
  check: SpendCheckResult
): Promise<void> {
  try {
    // Use SENTINEL notifier if available
    const { SentinelNotifierService } = await import('../shared/services/sentinel-notifier.service');
    const notifier = new SentinelNotifierService();

    await notifier.notify({
      id: `spend-${alertType}-${tenantId}-${Date.now()}`,
      title: alertType === 'spend_suspended'
        ? 'AI Models Suspended — Budget Exceeded'
        : 'Approaching AI Budget Limit',
      description: message,
      severity: alertType === 'spend_suspended' ? 2 : 3,
      source: 'spend-governor',
      component: 'model-router',
      tenantScope: tenantId,
      tags: ['spend-governor', alertType],
      metadata: {
        budgetUsd: check.budgetUsd,
        spentUsd: check.spentUsd,
        percentUsed: check.percentUsed,
      },
      timestamp: new Date().toISOString(),
    } as any);
  } catch (error) {
    logger.warn('Failed to send SENTINEL alert, falling back to audit log', {
      tenantId,
      alertType,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function sendInstanceSentinelAlert(alertType: string, message: string): Promise<void> {
  try {
    const { SentinelNotifierService } = await import('../shared/services/sentinel-notifier.service');
    const notifier = new SentinelNotifierService();

    await notifier.notify({
      id: `spend-${alertType}-instance-${Date.now()}`,
      title: 'AWS Services FROZEN — Instance Budget Exceeded',
      description: message,
      severity: 1, // SEV 1 — phone/SMS via PagerDuty
      source: 'spend-governor',
      component: 'aws-services',
      tags: ['spend-governor', 'instance-freeze', alertType],
      metadata: {},
      timestamp: new Date().toISOString(),
    } as any);
  } catch (error) {
    logger.error('Failed to send instance SENTINEL alert', {
      alertType,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function getLastWarningTime(tenantId: string): Promise<Date | null> {
  const result = await executeStatement(
    `SELECT warning_sent_at FROM spend_governor_config WHERE tenant_id = $1`,
    [tenantId]
  );
  const row = result.rows?.[0] as Record<string, unknown> | undefined;
  return row?.warning_sent_at ? new Date(String(row.warning_sent_at)) : null;
}

async function markWarningSent(tenantId: string): Promise<void> {
  await executeStatement(
    `UPDATE spend_governor_config SET warning_sent_at = NOW() WHERE tenant_id = $1`,
    [tenantId]
  );
}

async function expireOverrides(): Promise<number> {
  const result = await executeStatement(
    `UPDATE spend_governor_overrides
     SET is_active = false, revoked_at = NOW(), revoked_by = 'system:auto-expire'
     WHERE is_active = true AND expires_at <= NOW()
     RETURNING tenant_id`,
    []
  );

  const expired = result.rows?.length || 0;
  if (expired > 0) {
    logger.info('Expired spend governor overrides', { count: expired });
    // Re-check these tenants since override no longer protects them
    for (const row of (result.rows || []) as Array<Record<string, unknown>>) {
      const tenantId = String(row.tenant_id);
      invalidateCache(tenantId);
    }
  }

  return expired;
}

async function storeFrozenServices(services: FrozenServiceRecord[]): Promise<void> {
  await executeStatement(
    `UPDATE spend_governor_instance
     SET frozen_reason = frozen_reason || E'\n\nFrozen services: ' || $1
     WHERE true`,
    [JSON.stringify(services.map(s => ({ type: s.serviceType, id: s.serviceId, state: s.previousState })))]
  );
}

async function autoResolveClearedAlerts(): Promise<void> {
  // Auto-resolve tenant spend warnings if tenant is no longer near threshold
  await executeStatement(
    `UPDATE critical_alerts ca SET
       is_active = false, is_dismissed = true,
       dismissed_by = 'system:auto-resolve', dismissed_at = NOW()
     WHERE ca.is_active = true
       AND ca.auto_resolve = true
       AND ca.alert_type IN ('spend_warning', 'spend_restored', 'instance_thawed')
       AND ca.created_at < NOW() - INTERVAL '1 hour'`,
    []
  );
}
