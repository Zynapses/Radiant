/**
 * RADIANT v4.18.0 - Data Lake Lifecycle Manager Service
 *
 * Orchestrates the full data lifecycle for the S3-based data lake:
 *   1. Registers new Firehose-delivered partitions in the location index
 *   2. Transitions objects between storage tiers (hot → warm → cold → glacier → deep)
 *   3. Expires data past retention (deletes from S3 and queues Glacier deletions)
 *   4. Applies S3 Object Lock for immutable/compliance data
 *   5. Updates Glue partition metadata
 *   6. Reports CloudWatch metrics for observability
 *
 * Runs hourly via EventBridge-scheduled Lambda.
 * Replaces the old LogIndexerService tier transitions and expiry logic.
 *
 * Tier Strategy (using S3 storage classes):
 *   hot      (0-30d)   → S3 Intelligent-Tiering Frequent Access
 *   warm     (30-90d)  → S3 Intelligent-Tiering Infrequent Access
 *   cold     (90d-7yr) → S3 Glacier Instant Retrieval
 *   glacier  (7yr+)    → S3 Glacier Flexible Retrieval
 *   deep     (reg hold)→ S3 Glacier Deep Archive
 */

import { Pool } from 'pg';
import {
  S3Client,
  ListObjectsV2Command,
  CopyObjectCommand,
  PutObjectTaggingCommand,
  PutObjectLegalHoldCommand,
  PutObjectRetentionCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import {
  GlueClient,
  CreatePartitionCommand,
  GetTableCommand,
  BatchCreatePartitionCommand,
} from '@aws-sdk/client-glue';
import {
  CloudWatchClient,
  PutMetricDataCommand,
} from '@aws-sdk/client-cloudwatch';
import { createRegisteredLogger } from './logging-registry.service';
import { DataLocationIndexService, DataStorageTier } from './data-location-index.service';
import { GlacierLifecycleService } from './glacier-lifecycle.service';

const REGION = process.env.AWS_REGION || 'us-east-1';
const DATA_LAKE_BUCKET = process.env.DATA_LAKE_BUCKET || 'radiant-data-lake';
const GLUE_DATABASE = process.env.GLUE_DATABASE || 'radiant_data_lake';
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';

const s3Client = new S3Client({ region: REGION });
const glueClient = new GlueClient({ region: REGION });
const cwClient = new CloudWatchClient({ region: REGION });

const logger = createRegisteredLogger({
  serviceName: 'data-lake/lifecycle-manager',
  category: 'infrastructure',
  sourceType: 'lambda',
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LifecycleRunResult {
  // Partition registration
  partitionsDiscovered: number;
  partitionsRegistered: number;

  // Tier transitions
  hotToWarm: number;
  warmToCold: number;
  coldToGlacier: number;
  glacierToDeep: number;

  // Expiry
  s3ObjectsExpired: number;
  glacierDeletionsQueued: number;
  glacierDeletionsExecuted: number;

  // Object lock
  objectLocksApplied: number;

  // Glue
  gluePartitionsAdded: number;

  // Errors
  errors: Array<{ phase: string; error: string }>;

  // Timing
  durationMs: number;
}

interface DataTypeConfig {
  id: string;
  typeKey: string;
  glueTableName: string;
  s3PrefixPattern: string;
  defaultHotDays: number;
  defaultWarmDays: number;
  defaultColdDays: number;
  defaultGlacierDays: number | null;
  defaultRetentionDays: number;
  supportsImmutable: boolean;
  glacierMinStorageDays: number;
  deepArchiveMinStorageDays: number;
}

interface TenantRetentionConfig {
  tenantId: string;
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

export class DataLakeLifecycleManagerService {
  private locationIndex: DataLocationIndexService;
  private glacierLifecycle: GlacierLifecycleService;

  constructor(private pool: Pool) {
    this.locationIndex = new DataLocationIndexService(pool);
    this.glacierLifecycle = new GlacierLifecycleService(pool);
  }

  // =========================================================================
  // MAIN: Run the hourly lifecycle cycle
  // =========================================================================

  async runLifecycleCycle(): Promise<LifecycleRunResult> {
    const start = Date.now();
    const result: LifecycleRunResult = {
      partitionsDiscovered: 0,
      partitionsRegistered: 0,
      hotToWarm: 0,
      warmToCold: 0,
      coldToGlacier: 0,
      glacierToDeep: 0,
      s3ObjectsExpired: 0,
      glacierDeletionsQueued: 0,
      glacierDeletionsExecuted: 0,
      objectLocksApplied: 0,
      gluePartitionsAdded: 0,
      errors: [],
    };

    try {
      // 1. Get all active data types
      const dataTypes = await this.getActiveDataTypes();

      // 2. Discover new partitions from Firehose deliveries
      for (const dt of dataTypes) {
        try {
          const discovered = await this.discoverNewPartitions(dt);
          result.partitionsDiscovered += discovered.discovered;
          result.partitionsRegistered += discovered.registered;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          result.errors.push({ phase: `discover:${dt.typeKey}`, error: msg });
        }
      }

      // 3. Transition tiers for all tenants
      try {
        const transitions = await this.transitionAllTiers(dataTypes);
        result.hotToWarm = transitions.hotToWarm;
        result.warmToCold = transitions.warmToCold;
        result.coldToGlacier = transitions.coldToGlacier;
        result.glacierToDeep = transitions.glacierToDeep;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        result.errors.push({ phase: 'transition_tiers', error: msg });
      }

      // 4. Expire data past retention
      try {
        const expiry = await this.expireData();
        result.s3ObjectsExpired = expiry.s3Deleted;
        result.glacierDeletionsQueued = expiry.glacierQueued;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        result.errors.push({ phase: 'expire_data', error: msg });
      }

      // 5. Process Glacier deletion queue
      try {
        const glacierResult = await this.glacierLifecycle.processQueue();
        result.glacierDeletionsExecuted = glacierResult.glacierDeleted + glacierResult.immediateDeleted;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        result.errors.push({ phase: 'glacier_queue', error: msg });
      }

      // 6. Apply Object Lock for immutable data
      try {
        result.objectLocksApplied = await this.applyObjectLocks();
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        result.errors.push({ phase: 'object_locks', error: msg });
      }

      // 7. Update Glue partitions
      try {
        result.gluePartitionsAdded = await this.updateGluePartitions(dataTypes);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        result.errors.push({ phase: 'glue_partitions', error: msg });
      }

      // 8. Update sync state
      await this.updateSyncState(dataTypes, result);

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push({ phase: 'lifecycle_cycle', error: msg });
      logger.error('Lifecycle cycle failed', error as Error);
    }

    result.durationMs = Date.now() - start;

    // 9. Publish CloudWatch metrics
    await this.publishMetrics(result);

    logger.info('Lifecycle cycle complete', {
      partitionsRegistered: result.partitionsRegistered,
      transitions: result.hotToWarm + result.warmToCold + result.coldToGlacier + result.glacierToDeep,
      expired: result.s3ObjectsExpired,
      glacierQueued: result.glacierDeletionsQueued,
      glacierExecuted: result.glacierDeletionsExecuted,
      errors: result.errors.length,
      durationMs: result.durationMs,
    });

    return result;
  }

  // =========================================================================
  // PHASE 1: Discover new Firehose-delivered partitions
  // =========================================================================

  private async discoverNewPartitions(dt: DataTypeConfig): Promise<{
    discovered: number;
    registered: number;
  }> {
    let discovered = 0;
    let registered = 0;

    // List S3 objects in the data type's prefix that haven't been indexed yet
    // We look at the last 2 hours to catch any delayed deliveries
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 3600000);

    // Build prefix: data/{tenant_id}/{type_key}/{yyyy}/{mm}/{dd}/{hh}/
    // Since we don't know tenant IDs, list at the type level
    const basePrefix = `data/`;

    let continuationToken: string | undefined;
    do {
      const response = await s3Client.send(new ListObjectsV2Command({
        Bucket: DATA_LAKE_BUCKET,
        Prefix: basePrefix,
        Delimiter: '/',
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }));

      // Iterate through tenant prefixes
      if (response.CommonPrefixes) {
        for (const tenantPrefix of response.CommonPrefixes) {
          if (!tenantPrefix.Prefix) continue;
          const typePrefix = `${tenantPrefix.Prefix}${dt.typeKey}/`;

          // Check for recent partitions
          const recentPartitions = await this.findRecentPartitions(
            typePrefix, twoHoursAgo, now
          );

          for (const partition of recentPartitions) {
            discovered++;

            // Check if already indexed
            const existing = await this.locationIndex.findByS3Key(
              DATA_LAKE_BUCKET, partition.key
            );
            if (existing) continue;

            // Extract tenant ID from prefix
            const tenantId = this.extractTenantId(tenantPrefix.Prefix);
            if (!tenantId) continue;

            // Register in location index
            const retentionDays = await this.getEffectiveRetention(tenantId, dt.id);

            await this.locationIndex.registerLocation({
              dataTypeId: dt.id,
              tenantId,
              partitionHour: partition.hour,
              s3Bucket: DATA_LAKE_BUCKET,
              s3Key: partition.key,
              s3Region: REGION,
              s3StorageClass: 'INTELLIGENT_TIERING',
              recordCount: partition.estimatedRecords,
              byteSize: partition.size,
              compressedSize: partition.size, // Parquet is already compressed
              fileFormat: 'parquet',
              etag: partition.etag,
              retentionExpiresAt: new Date(now.getTime() + retentionDays * 86400000),
              immutable: dt.supportsImmutable,
            });

            registered++;
          }
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return { discovered, registered };
  }

  private async findRecentPartitions(
    typePrefix: string,
    startTime: Date,
    endTime: Date
  ): Promise<Array<{ key: string; size: number; hour: Date; etag: string; estimatedRecords: number }>> {
    const partitions: Array<{ key: string; size: number; hour: Date; etag: string; estimatedRecords: number }> = [];

    // Iterate date/hour range
    const current = new Date(startTime);
    current.setUTCMinutes(0, 0, 0);

    while (current <= endTime) {
      const yyyy = current.getUTCFullYear();
      const mm = String(current.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(current.getUTCDate()).padStart(2, '0');
      const hh = String(current.getUTCHours()).padStart(2, '0');

      const hourPrefix = `${typePrefix}${yyyy}/${mm}/${dd}/${hh}/`;

      try {
        const response = await s3Client.send(new ListObjectsV2Command({
          Bucket: DATA_LAKE_BUCKET,
          Prefix: hourPrefix,
          MaxKeys: 100,
        }));

        if (response.Contents) {
          for (const obj of response.Contents) {
            if (obj.Key && obj.Size && obj.Size > 0) {
              partitions.push({
                key: obj.Key,
                size: obj.Size,
                hour: new Date(current),
                etag: obj.ETag || '',
                estimatedRecords: Math.ceil(obj.Size / 512), // rough estimate
              });
            }
          }
        }
      } catch {
        // Prefix may not exist yet
      }

      current.setUTCHours(current.getUTCHours() + 1);
    }

    return partitions;
  }

  // =========================================================================
  // PHASE 3: Transition tiers based on age
  // =========================================================================

  private async transitionAllTiers(dataTypes: DataTypeConfig[]): Promise<{
    hotToWarm: number;
    warmToCold: number;
    coldToGlacier: number;
    glacierToDeep: number;
  }> {
    const counts = { hotToWarm: 0, warmToCold: 0, coldToGlacier: 0, glacierToDeep: 0 };

    // Get all unique tenants with data
    const tenantsResult = await this.pool.query(
      `SELECT DISTINCT tenant_id FROM data_location_index`
    );

    for (const tenantRow of tenantsResult.rows) {
      const tenantId = tenantRow.tenant_id as string;

      for (const dt of dataTypes) {
        const retention = await this.resolveRetention(tenantId, dt);

        // Hot → Warm (past hot_days)
        const hotCutoff = new Date(Date.now() - retention.hotDays * 86400000);
        const hotResult = await this.pool.query(
          `UPDATE data_location_index
           SET storage_tier = 'warm', tier_transitioned_at = NOW(), updated_at = NOW()
           WHERE tenant_id = $1 AND data_type_id = $2
             AND storage_tier = 'hot' AND partition_hour < $3
           RETURNING id`,
          [tenantId, dt.id, hotCutoff]
        );
        counts.hotToWarm += hotResult.rowCount || 0;

        // Warm → Cold (past hot_days + warm_days)
        const warmCutoff = new Date(Date.now() - (retention.hotDays + retention.warmDays) * 86400000);
        const warmResult = await this.pool.query(
          `UPDATE data_location_index
           SET storage_tier = 'cold', tier_transitioned_at = NOW(), updated_at = NOW()
           WHERE tenant_id = $1 AND data_type_id = $2
             AND storage_tier = 'warm' AND partition_hour < $3
           RETURNING id`,
          [tenantId, dt.id, warmCutoff]
        );
        counts.warmToCold += warmResult.rowCount || 0;

        // Cold → Glacier (past hot + warm + cold days)
        if (retention.coldDays > 0) {
          const coldCutoff = new Date(Date.now() - (retention.hotDays + retention.warmDays + retention.coldDays) * 86400000);
          const coldResult = await this.pool.query(
            `UPDATE data_location_index
             SET storage_tier = 'glacier',
                 glacier_archived_at = NOW(),
                 glacier_storage_class = 'GLACIER',
                 tier_transitioned_at = NOW(),
                 updated_at = NOW()
             WHERE tenant_id = $1 AND data_type_id = $2
               AND storage_tier = 'cold' AND partition_hour < $3
             RETURNING id`,
            [tenantId, dt.id, coldCutoff]
          );
          counts.coldToGlacier += coldResult.rowCount || 0;

          // For these objects, update the S3 storage class via lifecycle policy
          // (handled by S3 bucket lifecycle configuration, not per-object)
        }

        // Glacier → Deep Archive (if glacier_days configured, past total of all previous)
        if (retention.glacierDays && retention.glacierDays > 0) {
          const glacierCutoff = new Date(
            Date.now() - (retention.hotDays + retention.warmDays + retention.coldDays + retention.glacierDays) * 86400000
          );
          const glacierResult = await this.pool.query(
            `UPDATE data_location_index
             SET storage_tier = 'deep_archive',
                 glacier_storage_class = 'DEEP_ARCHIVE',
                 tier_transitioned_at = NOW(),
                 updated_at = NOW()
             WHERE tenant_id = $1 AND data_type_id = $2
               AND storage_tier = 'glacier' AND partition_hour < $3
             RETURNING id`,
            [tenantId, dt.id, glacierCutoff]
          );
          counts.glacierToDeep += glacierResult.rowCount || 0;
        }
      }
    }

    return counts;
  }

  // =========================================================================
  // PHASE 4: Expire data past retention
  // =========================================================================

  private async expireData(): Promise<{ s3Deleted: number; glacierQueued: number }> {
    let s3Deleted = 0;
    let glacierQueued = 0;

    // Find expired, non-immutable locations
    const expired = await this.locationIndex.findExpired({
      excludeImmutable: true,
      limit: 500,
    });

    // Separate by tier
    const s3Objects: Array<{ bucket: string; key: string; locationId: string }> = [];
    const glacierObjects: string[] = [];

    for (const loc of expired) {
      if (loc.storageTier === 'hot' || loc.storageTier === 'warm' || loc.storageTier === 'cold') {
        s3Objects.push({
          bucket: loc.s3Bucket,
          key: loc.s3Key,
          locationId: loc.id,
        });
      } else if (loc.storageTier === 'glacier' || loc.storageTier === 'deep_archive') {
        glacierObjects.push(loc.id);
      }
    }

    // Delete S3 objects in bulk
    if (s3Objects.length > 0) {
      const bulkResult = await this.glacierLifecycle.bulkDeleteS3Objects(s3Objects);
      s3Deleted = bulkResult.deleted;
    }

    // Queue Glacier deletions (cost-aware)
    for (const locationId of glacierObjects) {
      try {
        await this.glacierLifecycle.queueDeletion(locationId, 'retention_expiry');
        glacierQueued++;
      } catch (error) {
        logger.error('Failed to queue glacier deletion', error as Error, { locationId });
      }
    }

    return { s3Deleted, glacierQueued };
  }

  // =========================================================================
  // PHASE 6: Apply Object Lock for compliance data
  // =========================================================================

  private async applyObjectLocks(): Promise<number> {
    let applied = 0;

    // Find immutable locations without object lock
    const result = await this.pool.query(
      `SELECT dli.id, dli.s3_bucket, dli.s3_key, dli.retention_expires_at
       FROM data_location_index dli
       WHERE dli.immutable = true
         AND dli.object_lock_mode IS NULL
         AND dli.storage_tier IN ('hot', 'warm')
       LIMIT 100`
    );

    for (const row of result.rows) {
      try {
        // Apply S3 Object Lock in GOVERNANCE mode
        // (COMPLIANCE mode cannot be shortened — use GOVERNANCE unless regulatory requirement)
        await s3Client.send(new PutObjectRetentionCommand({
          Bucket: row.s3_bucket as string,
          Key: row.s3_key as string,
          Retention: {
            Mode: 'GOVERNANCE',
            RetainUntilDate: new Date(row.retention_expires_at as string),
          },
        }));

        await this.locationIndex.setObjectLock(
          row.id as string,
          'GOVERNANCE',
          new Date(row.retention_expires_at as string)
        );

        applied++;
      } catch (error) {
        // Object Lock requires bucket to have Object Lock enabled
        // This is a CDK-level configuration — log but don't fail
        logger.warn('Failed to apply Object Lock', {
          locationId: row.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return applied;
  }

  // =========================================================================
  // PHASE 7: Update Glue partitions
  // =========================================================================

  private async updateGluePartitions(dataTypes: DataTypeConfig[]): Promise<number> {
    let added = 0;

    for (const dt of dataTypes) {
      try {
        // Check if Glue table exists
        try {
          await glueClient.send(new GetTableCommand({
            DatabaseName: GLUE_DATABASE,
            Name: dt.glueTableName,
          }));
        } catch {
          // Table doesn't exist — will be created by CDK
          continue;
        }

        // Find partitions registered in the last 2 hours that haven't been added to Glue
        const recentLocations = await this.pool.query(
          `SELECT DISTINCT
             EXTRACT(YEAR FROM partition_hour)::INTEGER as year,
             EXTRACT(MONTH FROM partition_hour)::INTEGER as month,
             EXTRACT(DAY FROM partition_hour)::INTEGER as day,
             EXTRACT(HOUR FROM partition_hour)::INTEGER as hour,
             tenant_id
           FROM data_location_index
           WHERE data_type_id = $1
             AND created_at > NOW() - INTERVAL '2 hours'
           LIMIT 100`,
          [dt.id]
        );

        if (recentLocations.rows.length === 0) continue;

        // Batch create partitions
        const partitionInputs = recentLocations.rows.map(row => {
          const year = String(row.year);
          const month = String(row.month).padStart(2, '0');
          const day = String(row.day).padStart(2, '0');
          const hour = String(row.hour).padStart(2, '0');
          const tenantId = row.tenant_id as string;

          return {
            Values: [tenantId, year, month, day, hour],
            StorageDescriptor: {
              Location: `s3://${DATA_LAKE_BUCKET}/data/${tenantId}/${dt.typeKey}/${year}/${month}/${day}/${hour}/`,
              InputFormat: 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat',
              OutputFormat: 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat',
              SerdeInfo: {
                SerializationLibrary: 'org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe',
              },
              Compressed: true,
            },
          };
        });

        // BatchCreatePartition max 100 per call
        for (let i = 0; i < partitionInputs.length; i += 100) {
          const chunk = partitionInputs.slice(i, i + 100);
          try {
            await glueClient.send(new BatchCreatePartitionCommand({
              DatabaseName: GLUE_DATABASE,
              TableName: dt.glueTableName,
              PartitionInputList: chunk,
            }));
            added += chunk.length;
          } catch (error) {
            // AlreadyExistsException is expected for existing partitions
            const err = error as { name?: string };
            if (err.name !== 'AlreadyExistsException') {
              logger.warn('Glue partition creation failed', {
                table: dt.glueTableName,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
        }
      } catch (error) {
        logger.error('Glue partition update failed', error as Error, { typeKey: dt.typeKey });
      }
    }

    return added;
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  private async getActiveDataTypes(): Promise<DataTypeConfig[]> {
    const result = await this.pool.query(
      `SELECT * FROM data_type_registry WHERE is_active = true ORDER BY type_key`
    );
    return result.rows.map(row => ({
      id: row.id as string,
      typeKey: row.type_key as string,
      glueTableName: row.glue_table_name as string,
      s3PrefixPattern: row.s3_prefix_pattern as string,
      defaultHotDays: row.default_hot_days as number,
      defaultWarmDays: row.default_warm_days as number,
      defaultColdDays: row.default_cold_days as number,
      defaultGlacierDays: row.default_glacier_days as number | null,
      defaultRetentionDays: row.default_retention_days as number,
      supportsImmutable: row.supports_immutable as boolean,
      glacierMinStorageDays: row.glacier_min_storage_days as number,
      deepArchiveMinStorageDays: row.deep_archive_min_storage_days as number,
    }));
  }

  private async resolveRetention(tenantId: string, dt: DataTypeConfig): Promise<TenantRetentionConfig> {
    const result = await this.pool.query(
      `SELECT * FROM resolve_data_retention($1, $2)`,
      [tenantId, dt.id]
    );

    if (result.rows.length === 0) {
      return {
        tenantId,
        retentionDays: dt.defaultRetentionDays,
        hotDays: dt.defaultHotDays,
        warmDays: dt.defaultWarmDays,
        coldDays: dt.defaultColdDays,
        glacierDays: dt.defaultGlacierDays,
        immutable: dt.supportsImmutable,
        source: 'default',
      };
    }

    const row = result.rows[0];
    return {
      tenantId,
      retentionDays: row.retention_days as number,
      hotDays: row.hot_days as number,
      warmDays: row.warm_days as number,
      coldDays: row.cold_days as number,
      glacierDays: row.glacier_days as number | null,
      immutable: row.immutable as boolean,
      source: row.source as string,
    };
  }

  private async getEffectiveRetention(tenantId: string, dataTypeId: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT retention_days FROM resolve_data_retention($1, $2)`,
      [tenantId, dataTypeId]
    );
    return (result.rows[0]?.retention_days as number) || 90;
  }

  private extractTenantId(prefix: string): string | null {
    // Prefix format: data/{tenant_id}/
    const parts = prefix.split('/').filter(Boolean);
    if (parts.length >= 2 && parts[0] === 'data') {
      return parts[1];
    }
    return null;
  }

  private async updateSyncState(
    dataTypes: DataTypeConfig[],
    result: LifecycleRunResult
  ): Promise<void> {
    for (const dt of dataTypes) {
      await this.pool.query(
        `INSERT INTO data_lake_sync_state (data_type_id, last_lifecycle_run, last_lifecycle_duration_ms, lifecycle_errors)
         VALUES ($1, NOW(), $2, $3)
         ON CONFLICT (data_type_id) DO UPDATE SET
           last_lifecycle_run = NOW(),
           last_lifecycle_duration_ms = EXCLUDED.last_lifecycle_duration_ms,
           lifecycle_errors = CASE WHEN $3 > 0 THEN data_lake_sync_state.lifecycle_errors + $3 ELSE data_lake_sync_state.lifecycle_errors END,
           updated_at = NOW()`,
        [dt.id, result.durationMs, result.errors.length]
      );
    }
  }

  private async publishMetrics(result: LifecycleRunResult): Promise<void> {
    const namespace = `RADIANT/DataLake/${ENVIRONMENT}`;
    const timestamp = new Date();

    try {
      await cwClient.send(new PutMetricDataCommand({
        Namespace: namespace,
        MetricData: [
          { MetricName: 'PartitionsRegistered', Value: result.partitionsRegistered, Unit: 'Count', Timestamp: timestamp },
          { MetricName: 'TierTransitions', Value: result.hotToWarm + result.warmToCold + result.coldToGlacier + result.glacierToDeep, Unit: 'Count', Timestamp: timestamp },
          { MetricName: 'HotToWarm', Value: result.hotToWarm, Unit: 'Count', Timestamp: timestamp },
          { MetricName: 'WarmToCold', Value: result.warmToCold, Unit: 'Count', Timestamp: timestamp },
          { MetricName: 'ColdToGlacier', Value: result.coldToGlacier, Unit: 'Count', Timestamp: timestamp },
          { MetricName: 'S3ObjectsExpired', Value: result.s3ObjectsExpired, Unit: 'Count', Timestamp: timestamp },
          { MetricName: 'GlacierDeletionsQueued', Value: result.glacierDeletionsQueued, Unit: 'Count', Timestamp: timestamp },
          { MetricName: 'GlacierDeletionsExecuted', Value: result.glacierDeletionsExecuted, Unit: 'Count', Timestamp: timestamp },
          { MetricName: 'ObjectLocksApplied', Value: result.objectLocksApplied, Unit: 'Count', Timestamp: timestamp },
          { MetricName: 'LifecycleErrors', Value: result.errors.length, Unit: 'Count', Timestamp: timestamp },
          { MetricName: 'LifecycleDurationMs', Value: result.durationMs, Unit: 'Milliseconds', Timestamp: timestamp },
        ],
      }));
    } catch (error) {
      logger.warn('Failed to publish CloudWatch metrics', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
