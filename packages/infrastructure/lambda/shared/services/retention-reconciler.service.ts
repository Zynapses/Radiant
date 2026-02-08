/**
 * RADIANT v4.18.0 - Retention Reconciler Service
 *
 * Handles retention policy changes triggered by:
 *   1. Compliance license activation/deactivation (e.g., tenant enables HIPAA)
 *   2. Admin manual overrides (e.g., extend retention for legal hold)
 *   3. Scheduled policy reviews (quarterly compliance check)
 *   4. Data type registry updates (new default retention values)
 *
 * When retention changes, this service:
 *   - Re-evaluates all data for the affected tenant+data_type
 *   - Extends retention expiry on existing data (if retention increased)
 *   - Queues deletion of data past new limit (if retention decreased)
 *   - Applies/removes S3 Object Lock (if immutability changed)
 *   - Cancels pending Glacier deletions (if retention extended)
 *   - Logs everything in retention_reconciliation_log
 *
 * Triggered by:
 *   - SQS message from tenant_licenses table trigger
 *   - Admin API call for manual override
 *   - Scheduled Lambda for periodic reviews
 */

import { Pool } from 'pg';
import { createRegisteredLogger } from './logging-registry.service';
import { DataLocationIndexService, DataStorageTier } from './data-location-index.service';
import { GlacierLifecycleService } from './glacier-lifecycle.service';

const logger = createRegisteredLogger({
  serviceName: 'data-lake/retention-reconciler',
  category: 'compliance',
  sourceType: 'lambda',
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReconciliationRequest {
  tenantId: string;
  dataTypeId?: string;           // NULL = all data types
  triggerType: 'compliance_license_change' | 'admin_override' | 'policy_update' | 'scheduled_review';
  triggerDetail?: string;
  performedBy: string;
}

export interface ReconciliationResult {
  tenantId: string;
  dataTypesEvaluated: number;
  retentionExtended: number;
  retentionShortened: number;
  objectsRetagged: number;
  objectsQueuedForDeletion: number;
  objectLocksApplied: number;
  objectLocksRemoved: number;
  glacierDeletesCancelled: number;
  errors: string[];
  durationMs: number;
}

interface RetentionState {
  retentionDays: number;
  hotDays: number;
  warmDays: number;
  coldDays: number;
  glacierDays: number | null;
  immutable: boolean;
  source: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class RetentionReconcilerService {
  private locationIndex: DataLocationIndexService;
  private glacierLifecycle: GlacierLifecycleService;

  constructor(private pool: Pool) {
    this.locationIndex = new DataLocationIndexService(pool);
    this.glacierLifecycle = new GlacierLifecycleService(pool);
  }

  // =========================================================================
  // RECONCILE: Main entry point
  // =========================================================================

  async reconcile(request: ReconciliationRequest): Promise<ReconciliationResult> {
    const start = Date.now();
    const result: ReconciliationResult = {
      tenantId: request.tenantId,
      dataTypesEvaluated: 0,
      retentionExtended: 0,
      retentionShortened: 0,
      objectsRetagged: 0,
      objectsQueuedForDeletion: 0,
      objectLocksApplied: 0,
      objectLocksRemoved: 0,
      glacierDeletesCancelled: 0,
      errors: [],
      durationMs: 0,
    };

    try {
      // Get data types to evaluate
      let dataTypes: Array<{ id: string; typeKey: string }>;
      if (request.dataTypeId) {
        const dtResult = await this.pool.query(
          `SELECT id, type_key FROM data_type_registry WHERE id = $1`,
          [request.dataTypeId]
        );
        dataTypes = dtResult.rows.map(r => ({ id: r.id as string, typeKey: r.type_key as string }));
      } else {
        const dtResult = await this.pool.query(
          `SELECT id, type_key FROM data_type_registry WHERE is_active = true`
        );
        dataTypes = dtResult.rows.map(r => ({ id: r.id as string, typeKey: r.type_key as string }));
      }

      for (const dt of dataTypes) {
        result.dataTypesEvaluated++;

        try {
          // Get the NEW effective retention
          const newRetention = await this.resolveRetention(request.tenantId, dt.id);

          // Get what the retention WAS before this change (from location index)
          const previousRetention = await this.getPreviousRetention(request.tenantId, dt.id);

          // Determine what changed
          const retentionChanged = !previousRetention ||
            previousRetention.retentionDays !== newRetention.retentionDays;
          const immutableChanged = !previousRetention ||
            previousRetention.immutable !== newRetention.immutable;

          if (!retentionChanged && !immutableChanged) continue;

          // Log the change
          const logId = await this.logReconciliation(request, dt.id, previousRetention, newRetention);

          // Apply changes to existing data
          if (retentionChanged) {
            if (!previousRetention || newRetention.retentionDays > previousRetention.retentionDays) {
              // Retention INCREASED: extend expiry on all existing data
              const extended = await this.extendRetention(
                request.tenantId, dt.id, newRetention.retentionDays
              );
              result.retentionExtended += extended;
              result.objectsRetagged += extended;

              // Cancel any pending Glacier deletions for this data
              const cancelled = await this.cancelPendingDeletions(request.tenantId, dt.id);
              result.glacierDeletesCancelled += cancelled;

            } else {
              // Retention DECREASED: queue deletion of data past new limit
              const queued = await this.shortenRetention(
                request.tenantId, dt.id, newRetention.retentionDays
              );
              result.retentionShortened += queued.retagged;
              result.objectsQueuedForDeletion += queued.deletionQueued;
            }
          }

          // Handle immutability changes
          if (immutableChanged) {
            if (newRetention.immutable) {
              // Immutability ADDED: apply Object Lock to all existing data
              const locked = await this.applyImmutability(
                request.tenantId, dt.id, newRetention.retentionDays
              );
              result.objectLocksApplied += locked;
            } else {
              // Immutability REMOVED: only possible if no active compliance requires it
              // Object Lock in GOVERNANCE mode can be overridden; COMPLIANCE mode cannot
              logger.warn('Immutability removal requested', {
                tenantId: request.tenantId,
                dataTypeId: dt.id,
              });
              // We log but don't remove Object Lock — it must expire naturally
            }
          }

          // Update the reconciliation log with results
          await this.updateReconciliationLog(logId, result);

        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          result.errors.push(`${dt.typeKey}: ${msg}`);
          logger.error('Reconciliation failed for data type', error as Error, {
            tenantId: request.tenantId,
            dataTypeKey: dt.typeKey,
          });
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push(`global: ${msg}`);
      logger.error('Reconciliation failed', error as Error, { tenantId: request.tenantId });
    }

    result.durationMs = Date.now() - start;

    logger.info('Reconciliation complete', {
      tenantId: request.tenantId,
      trigger: request.triggerType,
      dataTypesEvaluated: result.dataTypesEvaluated,
      retentionExtended: result.retentionExtended,
      retentionShortened: result.retentionShortened,
      objectsQueuedForDeletion: result.objectsQueuedForDeletion,
      errors: result.errors.length,
      durationMs: result.durationMs,
    });

    return result;
  }

  // =========================================================================
  // EXTEND RETENTION: Increase expiry on existing data
  // =========================================================================

  private async extendRetention(
    tenantId: string, dataTypeId: string, newRetentionDays: number
  ): Promise<number> {
    // Calculate new expiry based on partition date + new retention
    const result = await this.pool.query(
      `UPDATE data_location_index
       SET retention_expires_at = partition_hour + ($1 || ' days')::INTERVAL,
           updated_at = NOW()
       WHERE tenant_id = $2 AND data_type_id = $3
         AND retention_expires_at < partition_hour + ($1 || ' days')::INTERVAL
       RETURNING id`,
      [newRetentionDays, tenantId, dataTypeId]
    );
    return result.rowCount || 0;
  }

  // =========================================================================
  // SHORTEN RETENTION: Queue deletion of data past new limit
  // =========================================================================

  private async shortenRetention(
    tenantId: string, dataTypeId: string, newRetentionDays: number
  ): Promise<{ retagged: number; deletionQueued: number }> {
    const cutoffDate = new Date(Date.now() - newRetentionDays * 86400000);

    // Update retention_expires_at on data within the new window
    const retagged = await this.pool.query(
      `UPDATE data_location_index
       SET retention_expires_at = partition_hour + ($1 || ' days')::INTERVAL,
           updated_at = NOW()
       WHERE tenant_id = $2 AND data_type_id = $3
         AND immutable = false
         AND partition_hour >= $4
       RETURNING id`,
      [newRetentionDays, tenantId, dataTypeId, cutoffDate]
    );

    // For data OLDER than the new cutoff, set expiry to now (will be cleaned up by lifecycle)
    const toExpire = await this.pool.query(
      `UPDATE data_location_index
       SET retention_expires_at = NOW(),
           updated_at = NOW()
       WHERE tenant_id = $1 AND data_type_id = $2
         AND immutable = false
         AND partition_hour < $3
       RETURNING id, storage_tier`,
      [tenantId, dataTypeId, cutoffDate]
    );

    let deletionQueued = 0;
    for (const row of toExpire.rows) {
      const tier = row.storage_tier as DataStorageTier;
      if (tier === 'glacier' || tier === 'deep_archive') {
        try {
          await this.glacierLifecycle.queueDeletion(row.id as string, 'retention_shortened');
          deletionQueued++;
        } catch {
          // Will be picked up by next lifecycle run
        }
      }
    }

    return {
      retagged: (retagged.rowCount || 0),
      deletionQueued,
    };
  }

  // =========================================================================
  // APPLY IMMUTABILITY: Set Object Lock on existing data
  // =========================================================================

  private async applyImmutability(
    tenantId: string, dataTypeId: string, retentionDays: number
  ): Promise<number> {
    const result = await this.pool.query(
      `SELECT id, partition_hour FROM data_location_index
       WHERE tenant_id = $1 AND data_type_id = $2
         AND immutable = false
         AND storage_tier IN ('hot', 'warm')
       LIMIT 500`,
      [tenantId, dataTypeId]
    );

    let locked = 0;
    for (const row of result.rows) {
      const retainUntil = new Date(
        new Date(row.partition_hour as string).getTime() + retentionDays * 86400000
      );
      try {
        await this.locationIndex.setObjectLock(
          row.id as string,
          'GOVERNANCE',
          retainUntil
        );
        locked++;
      } catch {
        // Object Lock may not be enabled on bucket
      }
    }

    return locked;
  }

  // =========================================================================
  // CANCEL PENDING GLACIER DELETIONS
  // =========================================================================

  private async cancelPendingDeletions(
    tenantId: string, dataTypeId: string
  ): Promise<number> {
    const result = await this.pool.query(
      `UPDATE glacier_deletion_queue gdq
       SET status = 'cancelled', updated_at = NOW()
       FROM data_location_index dli
       WHERE gdq.data_location_id = dli.id
         AND dli.tenant_id = $1
         AND dli.data_type_id = $2
         AND gdq.status IN ('queued', 'eligible')
       RETURNING gdq.id`,
      [tenantId, dataTypeId]
    );
    return result.rowCount || 0;
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  private async resolveRetention(tenantId: string, dataTypeId: string): Promise<RetentionState> {
    const result = await this.pool.query(
      `SELECT * FROM resolve_data_retention($1, $2)`,
      [tenantId, dataTypeId]
    );

    if (result.rows.length === 0) {
      // Fall back to default from registry
      const dtResult = await this.pool.query(
        `SELECT * FROM data_type_registry WHERE id = $1`, [dataTypeId]
      );
      const dt = dtResult.rows[0];
      return {
        retentionDays: dt.default_retention_days as number,
        hotDays: dt.default_hot_days as number,
        warmDays: dt.default_warm_days as number,
        coldDays: dt.default_cold_days as number,
        glacierDays: dt.default_glacier_days as number | null,
        immutable: dt.supports_immutable as boolean,
        source: 'default',
      };
    }

    const row = result.rows[0];
    return {
      retentionDays: row.retention_days as number,
      hotDays: row.hot_days as number,
      warmDays: row.warm_days as number,
      coldDays: row.cold_days as number,
      glacierDays: row.glacier_days as number | null,
      immutable: row.immutable as boolean,
      source: row.source as string,
    };
  }

  private async getPreviousRetention(
    tenantId: string, dataTypeId: string
  ): Promise<RetentionState | null> {
    // Look at the most recent reconciliation log for this tenant+data_type
    const result = await this.pool.query(
      `SELECT new_retention_days, new_tier_config, new_immutable
       FROM retention_reconciliation_log
       WHERE tenant_id = $1 AND data_type_id = $2 AND success = true
       ORDER BY created_at DESC LIMIT 1`,
      [tenantId, dataTypeId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const tierConfig = (row.new_tier_config || {}) as Record<string, number | null>;
    return {
      retentionDays: row.new_retention_days as number,
      hotDays: (tierConfig.hot_days as number) || 30,
      warmDays: (tierConfig.warm_days as number) || 60,
      coldDays: (tierConfig.cold_days as number) || 2465,
      glacierDays: (tierConfig.glacier_days as number | null) || null,
      immutable: row.new_immutable as boolean,
      source: 'previous_reconciliation',
    };
  }

  private async logReconciliation(
    request: ReconciliationRequest,
    dataTypeId: string,
    previous: RetentionState | null,
    current: RetentionState
  ): Promise<string> {
    const result = await this.pool.query(
      `INSERT INTO retention_reconciliation_log (
        tenant_id, data_type_id, trigger_type, trigger_detail,
        previous_retention_days, new_retention_days,
        previous_tier_config, new_tier_config,
        previous_immutable, new_immutable,
        performed_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        request.tenantId, dataTypeId,
        request.triggerType, request.triggerDetail || null,
        previous?.retentionDays || null, current.retentionDays,
        previous ? JSON.stringify({
          hot_days: previous.hotDays,
          warm_days: previous.warmDays,
          cold_days: previous.coldDays,
          glacier_days: previous.glacierDays,
        }) : null,
        JSON.stringify({
          hot_days: current.hotDays,
          warm_days: current.warmDays,
          cold_days: current.coldDays,
          glacier_days: current.glacierDays,
        }),
        previous?.immutable ?? null, current.immutable,
        request.performedBy,
      ]
    );
    return result.rows[0].id as string;
  }

  private async updateReconciliationLog(
    logId: string,
    result: ReconciliationResult
  ): Promise<void> {
    await this.pool.query(
      `UPDATE retention_reconciliation_log SET
        objects_retagged = $1,
        objects_deleted = $2,
        object_locks_applied = $3,
        glacier_deletes_queued = $4,
        success = $5,
        error_message = $6
       WHERE id = $7`,
      [
        result.objectsRetagged,
        result.objectsQueuedForDeletion,
        result.objectLocksApplied,
        result.objectsQueuedForDeletion,
        result.errors.length === 0,
        result.errors.length > 0 ? result.errors.join('; ') : null,
        logId,
      ]
    );
  }
}
