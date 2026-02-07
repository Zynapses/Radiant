// RADIANT v4.18.0 - Bedrock Model Polling & Auto-Upgrade Lambda
// EventBridge scheduled handler: polls Bedrock for new models, runs auto-upgrade,
// and triggers drift correction for all active tenants.
// ============================================================================

import { Handler, ScheduledEvent } from 'aws-lambda';
import { executeStatement, stringParam } from '../shared/db/client';
import { createRegisteredLogger } from '../shared/services/logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'security/bedrock-poll',
  category: 'security',
  sourceType: 'lambda',
});
import { bedrockModelDiscoveryService } from '../shared/services/bedrock-model-discovery.service';
import { driftCorrectionService } from '../shared/services/drift-correction.service';

// ============================================================================
// Handler
// ============================================================================

export const handler: Handler<ScheduledEvent> = async (event) => {
  logger.info('Bedrock poll + drift correction scheduled task started', {
    time: event.time,
    source: event.source,
  });

  const results = {
    bedrockPoll: { newModels: 0, updatedModels: 0, totalModels: 0, deactivatedModels: 0 },
    autoUpgrades: [] as Array<{ tenantId: string; upgraded: boolean; from: string; to: string | null }>,
    driftCorrections: [] as Array<{ tenantId: string; modelsChecked: number; actionsApplied: number }>,
    errors: [] as string[],
  };

  // =========================================================================
  // 1. Poll Bedrock for model updates (global, not per-tenant)
  // =========================================================================
  try {
    results.bedrockPoll = await bedrockModelDiscoveryService.pollAndSyncModels();
    logger.info('Bedrock model poll complete', results.bedrockPoll);
  } catch (error) {
    const msg = `Bedrock poll failed: ${error instanceof Error ? error.message : String(error)}`;
    logger.error(msg);
    results.errors.push(msg);
  }

  // =========================================================================
  // 2. Get all active tenants with AI helper config
  // =========================================================================
  let tenantIds: string[] = [];
  try {
    const tenantsResult = await executeStatement(
      `SELECT t.id FROM tenants t WHERE t.status = 'active'`,
      []
    );
    tenantIds = (tenantsResult.rows || []).map(r => String(r.id));
  } catch (error) {
    const msg = `Failed to get tenants: ${error instanceof Error ? error.message : String(error)}`;
    logger.error(msg);
    results.errors.push(msg);
    return results;
  }

  // =========================================================================
  // 3. For each tenant: check poll due, auto-upgrade, drift correction
  // =========================================================================
  for (const tenantId of tenantIds) {
    try {
      // Check if this tenant's poll interval has elapsed
      const pollDue = await bedrockModelDiscoveryService.isPollDue(tenantId);

      if (pollDue) {
        // Record the poll
        await bedrockModelDiscoveryService.recordPoll(tenantId);

        // Run auto-upgrade if enabled
        const upgradeResult = await bedrockModelDiscoveryService.checkAndAutoUpgrade(tenantId);
        results.autoUpgrades.push({
          tenantId,
          upgraded: upgradeResult.upgraded,
          from: upgradeResult.previousModelId,
          to: upgradeResult.newModelId,
        });
      }

      // Run drift correction for all active models
      const correctionResults = await driftCorrectionService.checkAndCorrectAllModels(tenantId);
      const actionsApplied = correctionResults.filter(r => r.actionTaken !== 'none' && r.actionTaken !== 'error').length;

      results.driftCorrections.push({
        tenantId,
        modelsChecked: correctionResults.length,
        actionsApplied,
      });

      if (actionsApplied > 0) {
        logger.info('Drift corrections applied', { tenantId, actionsApplied, results: correctionResults.filter(r => r.actionTaken !== 'none') });
      }

    } catch (error) {
      const msg = `Tenant ${tenantId} processing failed: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(msg);
      results.errors.push(msg);
    }
  }

  // =========================================================================
  // Summary
  // =========================================================================
  const summary = {
    tenantsProcessed: tenantIds.length,
    bedrockNewModels: results.bedrockPoll.newModels,
    bedrockUpdatedModels: results.bedrockPoll.updatedModels,
    autoUpgradeCount: results.autoUpgrades.filter(u => u.upgraded).length,
    totalDriftChecks: results.driftCorrections.reduce((s, d) => s + d.modelsChecked, 0),
    totalDriftActions: results.driftCorrections.reduce((s, d) => s + d.actionsApplied, 0),
    errors: results.errors.length,
  };

  logger.info('Bedrock poll + drift correction task complete', summary);

  return { statusCode: 200, body: JSON.stringify(summary) };
};
