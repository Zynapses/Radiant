/**
 * RADIANT v4.18.0 - Glacier Lifecycle Service
 *
 * Manages cost-aware deletion of Glacier and Deep Archive objects.
 *
 * Key insight: Glacier charges for early deletion:
 *   - Glacier Flexible Retrieval: prorated for items < 90 days old
 *   - Deep Archive: prorated for items < 180 days old
 *
 * This service queues deletions and executes them only when the minimum
 * storage period has passed (free deletion), unless an admin forces
 * immediate deletion or the cost savings of waiting are negligible.
 *
 * Decision logic:
 *   1. If retention expired AND past minimum storage period → delete immediately
 *   2. If retention expired AND NOT past min period → queue until eligible
 *   3. If force_immediate = true → delete now (admin override, logs the extra cost)
 *   4. If early delete cost < $0.01 → delete immediately (not worth tracking)
 *
 * Also handles:
 *   - S3 Standard/IA object deletion (immediate, no min storage)
 *   - Bulk deletion batching (S3 DeleteObjects API, 1000 per batch)
 *   - Glacier vault archive deletion
 *   - Deletion audit trail
 */

import { Pool } from 'pg';
import {
  S3Client,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import {
  GlacierClient,
  DeleteArchiveCommand,
} from '@aws-sdk/client-glacier';
import { createRegisteredLogger } from './logging-registry.service';
import { DataLocationIndexService, DataStorageTier } from './data-location-index.service';

const REGION = process.env.AWS_REGION || 'us-east-1';
const s3Client = new S3Client({ region: REGION });
const glacierClient = new GlacierClient({ region: REGION });

const logger = createRegisteredLogger({
  serviceName: 'data-lake/glacier-lifecycle',
  category: 'infrastructure',
  sourceType: 'application',
});

// Threshold below which early-delete cost is not worth tracking
const NEGLIGIBLE_COST_USD = 0.01;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GlacierDeleteStatus = 'queued' | 'eligible' | 'executing' | 'completed' | 'failed' | 'cancelled';

export interface GlacierDeletionQueueEntry {
  id: string;
  dataLocationId: string;
  tenantId: string;
  s3Bucket: string;
  s3Key: string;
  glacierVaultName: string | null;
  glacierArchiveId: string | null;
  glacierStorageClass: string;
  archivedAt: string;
  minStorageDays: number;
  earliestFreeDelete: string;
  retentionExpiredAt: string;
  byteSize: number;
  estimatedEarlyDeleteCostUsd: number;
  estimatedWaitStorageCostUsd: number;
  status: GlacierDeleteStatus;
  forceImmediate: boolean;
  reason: string | null;
  createdAt: string;
}

export interface DeletionRunResult {
  s3Deleted: number;
  glacierDeleted: number;
  queuedForLater: number;
  immediateDeleted: number;
  errors: number;
  costSaved: number;     // USD saved by waiting vs immediate deletion
  costIncurred: number;  // USD of early deletion charges incurred
  durationMs: number;
}

export interface DeletionQueueStats {
  totalQueued: number;
  totalEligible: number;
  totalExecuting: number;
  totalCompleted: number;
  totalFailed: number;
  estimatedPendingCostUsd: number;
  nextEligibleAt: string | null;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class GlacierLifecycleService {
  private locationIndex: DataLocationIndexService;

  constructor(private pool: Pool) {
    this.locationIndex = new DataLocationIndexService(pool);
  }

  // =========================================================================
  // QUEUE DELETION: Evaluate and queue a Glacier object for deletion
  // =========================================================================

  async queueDeletion(
    dataLocationId: string,
    reason: string,
    forceImmediate?: boolean
  ): Promise<{ action: 'deleted' | 'queued'; costUsd: number }> {
    // Get location details
    const locResult = await this.pool.query(
      `SELECT dli.*, dtr.glacier_min_storage_days, dtr.deep_archive_min_storage_days
       FROM data_location_index dli
       JOIN data_type_registry dtr ON dtr.id = dli.data_type_id
       WHERE dli.id = $1`,
      [dataLocationId]
    );

    if (locResult.rows.length === 0) {
      throw new Error(`Data location ${dataLocationId} not found`);
    }

    const loc = locResult.rows[0];
    const storageTier = loc.storage_tier as DataStorageTier;

    // Non-Glacier: delete immediately from S3
    if (storageTier === 'hot' || storageTier === 'warm') {
      await this.deleteS3Object(loc.s3_bucket as string, loc.s3_key as string);
      await this.locationIndex.deleteLocation(dataLocationId);
      return { action: 'deleted', costUsd: 0 };
    }

    // Glacier/Deep Archive: evaluate cost
    const glacierStorageClass = (loc.glacier_storage_class as string) || (storageTier === 'deep_archive' ? 'DEEP_ARCHIVE' : 'GLACIER');
    const archivedAt = loc.glacier_archived_at as Date || loc.tier_transitioned_at as Date || loc.created_at as Date;
    const minDays = glacierStorageClass === 'DEEP_ARCHIVE'
      ? (loc.deep_archive_min_storage_days as number || 180)
      : (loc.glacier_min_storage_days as number || 90);
    const now = new Date();
    const daysSinceArchive = Math.floor((now.getTime() - new Date(archivedAt).getTime()) / 86400000);
    const earliestFreeDelete = new Date(new Date(archivedAt).getTime() + minDays * 86400000);

    // Calculate early deletion cost
    const earlyDeleteCost = await this.calculateEarlyDeleteCost(
      parseInt(loc.byte_size as string, 10) || 0,
      glacierStorageClass,
      new Date(archivedAt),
      now
    );

    // Calculate cost of waiting (storage cost for remaining days)
    const remainingDays = Math.max(0, minDays - daysSinceArchive);
    const gb = (parseInt(loc.byte_size as string, 10) || 0) / 1073741824;
    const monthlyRate = glacierStorageClass === 'DEEP_ARCHIVE' ? 0.00099 : 0.0036;
    const waitCost = (remainingDays / 30) * monthlyRate * gb;

    // Decision: delete now or queue?
    if (daysSinceArchive >= minDays || forceImmediate || earlyDeleteCost < NEGLIGIBLE_COST_USD) {
      // Delete immediately
      await this.deleteGlacierObject(loc);
      await this.locationIndex.deleteLocation(dataLocationId);

      // Record the deletion
      await this.recordDeletionEvent(dataLocationId, loc.tenant_id as string, 'completed', earlyDeleteCost, reason);
      return { action: 'deleted', costUsd: earlyDeleteCost };
    }

    // Queue for later deletion
    await this.pool.query(
      `INSERT INTO glacier_deletion_queue (
        data_location_id, tenant_id, s3_bucket, s3_key,
        glacier_vault_name, glacier_archive_id, glacier_storage_class,
        archived_at, min_storage_days, earliest_free_delete,
        retention_expired_at, byte_size,
        estimated_early_delete_cost_usd, estimated_wait_storage_cost_usd,
        status, force_immediate, reason
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'queued', $15, $16)
      ON CONFLICT DO NOTHING`,
      [
        dataLocationId, loc.tenant_id, loc.s3_bucket, loc.s3_key,
        loc.glacier_vault_name, loc.glacier_archive_id, glacierStorageClass,
        archivedAt, minDays, earliestFreeDelete,
        now, loc.byte_size,
        earlyDeleteCost, waitCost,
        forceImmediate || false, reason,
      ]
    );

    logger.info('Glacier deletion queued', {
      locationId: dataLocationId,
      storageClass: glacierStorageClass,
      daysSinceArchive,
      minDays,
      earlyDeleteCost,
      waitCost,
      eligibleAt: earliestFreeDelete.toISOString(),
    });

    return { action: 'queued', costUsd: 0 };
  }

  // =========================================================================
  // PROCESS QUEUE: Execute eligible deletions from the queue
  // Called by the lifecycle manager Lambda on a schedule
  // =========================================================================

  async processQueue(batchSize: number = 100): Promise<DeletionRunResult> {
    const startTime = Date.now();
    const result: DeletionRunResult = {
      s3Deleted: 0,
      glacierDeleted: 0,
      queuedForLater: 0,
      immediateDeleted: 0,
      errors: 0,
      costSaved: 0,
      costIncurred: 0,
      durationMs: 0,
    };

    // 1. Find entries that have passed their minimum storage period
    const eligibleResult = await this.pool.query(
      `UPDATE glacier_deletion_queue
       SET status = 'eligible', updated_at = NOW()
       WHERE status = 'queued' AND earliest_free_delete <= NOW()
       RETURNING *`
    );

    // 2. Process eligible entries
    const eligible = eligibleResult.rows;
    for (const entry of eligible) {
      try {
        await this.pool.query(
          `UPDATE glacier_deletion_queue SET status = 'executing', delete_attempted_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [entry.id]
        );

        // Delete from S3/Glacier
        await this.deleteGlacierObject(entry);

        // Remove from location index
        await this.locationIndex.deleteLocation(entry.data_location_id as string);

        // Mark as completed
        await this.pool.query(
          `UPDATE glacier_deletion_queue SET status = 'completed', delete_completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [entry.id]
        );

        result.glacierDeleted++;
        result.costSaved += parseFloat(entry.estimated_early_delete_cost_usd as string) || 0;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const retries = (entry.retry_count as number) || 0;
        await this.pool.query(
          `UPDATE glacier_deletion_queue SET status = 'failed', error_message = $1, retry_count = $2, updated_at = NOW() WHERE id = $3`,
          [msg, retries + 1, entry.id]
        );
        result.errors++;
        logger.error('Glacier deletion failed', error as Error, { entryId: entry.id });
      }
    }

    // 3. Process force-immediate entries (admin overrides)
    const forceResult = await this.pool.query(
      `SELECT * FROM glacier_deletion_queue WHERE status = 'queued' AND force_immediate = true LIMIT $1`,
      [batchSize]
    );

    for (const entry of forceResult.rows) {
      try {
        await this.deleteGlacierObject(entry);
        await this.locationIndex.deleteLocation(entry.data_location_id as string);

        const cost = parseFloat(entry.estimated_early_delete_cost_usd as string) || 0;
        result.costIncurred += cost;

        await this.pool.query(
          `UPDATE glacier_deletion_queue SET status = 'completed', delete_completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [entry.id]
        );
        result.immediateDeleted++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        await this.pool.query(
          `UPDATE glacier_deletion_queue SET status = 'failed', error_message = $1, retry_count = retry_count + 1, updated_at = NOW() WHERE id = $2`,
          [msg, entry.id]
        );
        result.errors++;
      }
    }

    // 4. Retry failed entries (max 3 retries)
    const retryResult = await this.pool.query(
      `SELECT * FROM glacier_deletion_queue WHERE status = 'failed' AND retry_count < 3 LIMIT $1`,
      [batchSize]
    );

    for (const entry of retryResult.rows) {
      try {
        await this.deleteGlacierObject(entry);
        await this.locationIndex.deleteLocation(entry.data_location_id as string);
        await this.pool.query(
          `UPDATE glacier_deletion_queue SET status = 'completed', delete_completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [entry.id]
        );
        result.glacierDeleted++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        await this.pool.query(
          `UPDATE glacier_deletion_queue SET status = 'failed', error_message = $1, retry_count = retry_count + 1, updated_at = NOW() WHERE id = $2`,
          [msg, entry.id]
        );
        result.errors++;
      }
    }

    result.durationMs = Date.now() - startTime;

    logger.info('Glacier deletion queue processed', {
      glacierDeleted: result.glacierDeleted,
      immediateDeleted: result.immediateDeleted,
      errors: result.errors,
      costSaved: result.costSaved,
      costIncurred: result.costIncurred,
      durationMs: result.durationMs,
    });

    return result;
  }

  // =========================================================================
  // GET QUEUE STATS
  // =========================================================================

  async getQueueStats(): Promise<DeletionQueueStats> {
    const result = await this.pool.query(
      `SELECT
        SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as total_queued,
        SUM(CASE WHEN status = 'eligible' THEN 1 ELSE 0 END) as total_eligible,
        SUM(CASE WHEN status = 'executing' THEN 1 ELSE 0 END) as total_executing,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as total_completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as total_failed,
        SUM(CASE WHEN status = 'queued' THEN estimated_early_delete_cost_usd ELSE 0 END) as pending_cost
       FROM glacier_deletion_queue`
    );

    const nextResult = await this.pool.query(
      `SELECT MIN(earliest_free_delete) as next_eligible
       FROM glacier_deletion_queue WHERE status = 'queued'`
    );

    const row = result.rows[0];
    return {
      totalQueued: parseInt(row.total_queued as string, 10) || 0,
      totalEligible: parseInt(row.total_eligible as string, 10) || 0,
      totalExecuting: parseInt(row.total_executing as string, 10) || 0,
      totalCompleted: parseInt(row.total_completed as string, 10) || 0,
      totalFailed: parseInt(row.total_failed as string, 10) || 0,
      estimatedPendingCostUsd: parseFloat(row.pending_cost as string) || 0,
      nextEligibleAt: nextResult.rows[0]?.next_eligible
        ? (nextResult.rows[0].next_eligible as Date).toISOString()
        : null,
    };
  }

  // =========================================================================
  // CANCEL QUEUED DELETION (e.g., retention extended)
  // =========================================================================

  async cancelDeletion(dataLocationId: string): Promise<void> {
    await this.pool.query(
      `UPDATE glacier_deletion_queue SET status = 'cancelled', updated_at = NOW()
       WHERE data_location_id = $1 AND status IN ('queued', 'eligible')`,
      [dataLocationId]
    );
  }

  // =========================================================================
  // DELETE S3 OBJECTS IN BULK (for non-Glacier tiers)
  // =========================================================================

  async bulkDeleteS3Objects(
    objects: Array<{ bucket: string; key: string; locationId: string }>
  ): Promise<{ deleted: number; errors: number }> {
    let deleted = 0;
    let errors = 0;

    // Group by bucket
    const byBucket = new Map<string, Array<{ key: string; locationId: string }>>();
    for (const obj of objects) {
      const existing = byBucket.get(obj.bucket) || [];
      existing.push({ key: obj.key, locationId: obj.locationId });
      byBucket.set(obj.bucket, existing);
    }

    for (const [bucket, items] of byBucket) {
      // S3 DeleteObjects supports max 1000 per call
      for (let i = 0; i < items.length; i += 1000) {
        const chunk = items.slice(i, i + 1000);
        try {
          await s3Client.send(new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: {
              Objects: chunk.map(item => ({ Key: item.key })),
              Quiet: true,
            },
          }));

          // Remove from location index
          const locationIds = chunk.map(item => item.locationId);
          await this.locationIndex.bulkDeleteLocations(locationIds);
          deleted += chunk.length;
        } catch (error) {
          logger.error('Bulk S3 delete failed', error as Error, { bucket, count: chunk.length });
          errors += chunk.length;
        }
      }
    }

    return { deleted, errors };
  }

  // =========================================================================
  // PRIVATE: Delete a single Glacier/S3 object
  // =========================================================================

  private async deleteGlacierObject(entry: Record<string, unknown>): Promise<void> {
    const bucket = entry.s3_bucket as string;
    const key = entry.s3_key as string;
    const glacierArchiveId = entry.glacier_archive_id as string | null;
    const glacierVaultName = entry.glacier_vault_name as string | null;

    // If object has a Glacier vault archive, delete from the vault
    if (glacierArchiveId && glacierVaultName) {
      await glacierClient.send(new DeleteArchiveCommand({
        vaultName: glacierVaultName,
        archiveId: glacierArchiveId,
      } as any));
    }

    // Also delete the S3 object (may be the same object transitioned via lifecycle)
    if (bucket && key) {
      try {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        }));
      } catch (error) {
        // Object might already be deleted or moved; not critical if vault delete succeeded
        const err = error as { name?: string };
        if (err.name !== 'NoSuchKey') {
          throw error;
        }
      }
    }
  }

  // =========================================================================
  // PRIVATE: Delete a single S3 Standard object
  // =========================================================================

  private async deleteS3Object(bucket: string, key: string): Promise<void> {
    await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }

  // =========================================================================
  // PRIVATE: Calculate early deletion cost
  // =========================================================================

  private async calculateEarlyDeleteCost(
    byteSize: number,
    storageClass: string,
    archivedAt: Date,
    deleteAt: Date
  ): Promise<number> {
    const result = await this.pool.query(
      `SELECT calculate_glacier_early_delete_cost($1, $2, $3, $4) as cost`,
      [byteSize, storageClass, archivedAt, deleteAt]
    );
    return parseFloat(result.rows[0]?.cost as string) || 0;
  }

  // =========================================================================
  // PRIVATE: Record deletion event in reconciliation log
  // =========================================================================

  private async recordDeletionEvent(
    dataLocationId: string,
    tenantId: string,
    status: string,
    costUsd: number,
    reason: string
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO retention_reconciliation_log (
        tenant_id, trigger_type, trigger_detail, objects_deleted, success, performed_by
      ) VALUES ($1, 'retention_expiry', $2, 1, true, 'glacier-lifecycle-service')`,
      [tenantId, `Deleted ${dataLocationId}: ${reason} (cost: $${costUsd.toFixed(4)})`]
    );
  }
}
