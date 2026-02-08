/**
 * RADIANT v4.18.0 - Data Location Index Service
 *
 * Fast lookup service for finding data stored in S3/Glacier.
 * This is the "phone book" — given a tenant, data type, and time range,
 * it returns the exact S3 keys or Glacier archive IDs where the data lives.
 *
 * Features:
 *   - Sub-second lookups by tenant + type + date range using indexed queries
 *   - Glacier-aware: knows which objects are in Glacier and their restore status
 *   - Storage tier tracking with automatic tier transition recording
 *   - Access counting for Intelligent-Tiering optimization
 *   - Bulk operations for lifecycle management (expire, transition, lock)
 *
 * The data_location_index table is the ONLY place in PostgreSQL that tracks
 * data lake objects. All actual data is in S3/Glacier. This index is small
 * (~200 bytes per row) even at billions of objects.
 */

import { Pool } from 'pg';
import { createRegisteredLogger } from './logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'data-lake/location-index',
  category: 'infrastructure',
  sourceType: 'application',
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DataStorageTier = 'hot' | 'warm' | 'cold' | 'glacier' | 'deep_archive';

export interface DataLocation {
  id: string;
  dataTypeId: string;
  dataTypeKey: string;
  dataTypeDisplay: string;
  tenantId: string;
  partitionDate: string;
  partitionHour: string;
  storageTier: DataStorageTier;
  s3Bucket: string;
  s3Key: string;
  s3Region: string;
  s3StorageClass: string;
  glacierVaultName: string | null;
  glacierArchiveId: string | null;
  glacierArchivedAt: string | null;
  glacierStorageClass: string | null;
  recordCount: number;
  byteSize: number;
  compressedSize: number;
  fileFormat: string;
  sha256Hash: string | null;
  etag: string | null;
  retentionExpiresAt: string | null;
  immutable: boolean;
  objectLockMode: string | null;
  objectLockUntil: string | null;
  tierTransitionedAt: string | null;
  lastAccessedAt: string | null;
  accessCount: number;
  createdAt: string;
}

export interface DataLocationSummary {
  dataTypeKey: string;
  dataTypeDisplay: string;
  storageTier: DataStorageTier;
  totalRecords: number;
  totalBytes: number;
  totalPartitions: number;
  oldestPartition: string | null;
  newestPartition: string | null;
}

export interface StorageTierBreakdown {
  tier: DataStorageTier;
  totalPartitions: number;
  totalRecords: number;
  totalBytes: number;
  totalCompressedBytes: number;
  oldestData: string | null;
  newestData: string | null;
}

export interface RegisterLocationParams {
  dataTypeId: string;
  tenantId: string;
  partitionHour: Date;
  s3Bucket: string;
  s3Key: string;
  s3Region?: string;
  s3StorageClass?: string;
  recordCount: number;
  byteSize: number;
  compressedSize: number;
  fileFormat?: string;
  sha256Hash?: string;
  etag?: string;
  retentionExpiresAt: Date;
  immutable?: boolean;
}

export interface FindLocationsParams {
  tenantId: string;
  dataTypeKey?: string;
  dataTypeId?: string;
  startDate?: string;
  endDate?: string;
  storageTier?: DataStorageTier;
  limit?: number;
  offset?: number;
}

export interface GlacierLocationInfo {
  locationId: string;
  s3Bucket: string;
  s3Key: string;
  glacierArchiveId: string | null;
  glacierStorageClass: string | null;
  glacierArchivedAt: string | null;
  byteSize: number;
  retentionExpiresAt: string | null;
  immutable: boolean;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class DataLocationIndexService {
  constructor(private pool: Pool) {}

  // =========================================================================
  // REGISTER: Record a new data partition landing in S3
  // =========================================================================

  async registerLocation(params: RegisterLocationParams): Promise<string> {
    const partitionDate = new Date(params.partitionHour);
    partitionDate.setUTCMinutes(0, 0, 0);
    const dateOnly = partitionDate.toISOString().split('T')[0];

    const result = await this.pool.query(
      `INSERT INTO data_location_index (
        data_type_id, tenant_id, partition_hour, partition_date,
        storage_tier, s3_bucket, s3_key, s3_region, s3_storage_class,
        record_count, byte_size, compressed_size, file_format,
        sha256_hash, etag, retention_expires_at, immutable
      ) VALUES ($1, $2, $3, $4, 'hot', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT DO NOTHING
      RETURNING id`,
      [
        params.dataTypeId, params.tenantId,
        params.partitionHour, dateOnly,
        params.s3Bucket, params.s3Key,
        params.s3Region || 'us-east-1',
        params.s3StorageClass || 'INTELLIGENT_TIERING',
        params.recordCount, params.byteSize, params.compressedSize,
        params.fileFormat || 'parquet',
        params.sha256Hash || null, params.etag || null,
        params.retentionExpiresAt, params.immutable || false,
      ]
    );

    return result.rows[0]?.id as string;
  }

  // =========================================================================
  // FIND: Fast lookup by tenant + type + time range
  // =========================================================================

  async findLocations(params: FindLocationsParams): Promise<{
    locations: DataLocation[];
    total: number;
  }> {
    const conditions: string[] = ['dli.tenant_id = $1'];
    const queryParams: unknown[] = [params.tenantId];
    let idx = 2;

    if (params.dataTypeKey) {
      conditions.push(`dtr.type_key = $${idx}`);
      queryParams.push(params.dataTypeKey);
      idx++;
    }
    if (params.dataTypeId) {
      conditions.push(`dli.data_type_id = $${idx}`);
      queryParams.push(params.dataTypeId);
      idx++;
    }
    if (params.startDate) {
      conditions.push(`dli.partition_date >= $${idx}::DATE`);
      queryParams.push(params.startDate);
      idx++;
    }
    if (params.endDate) {
      conditions.push(`dli.partition_date <= $${idx}::DATE`);
      queryParams.push(params.endDate);
      idx++;
    }
    if (params.storageTier) {
      conditions.push(`dli.storage_tier = $${idx}::data_storage_tier`);
      queryParams.push(params.storageTier);
      idx++;
    }

    const where = conditions.join(' AND ');

    // Get count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM data_location_index dli
       JOIN data_type_registry dtr ON dtr.id = dli.data_type_id
       WHERE ${where}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].count as string, 10);

    // Get results
    const limit = params.limit || 100;
    const offset = params.offset || 0;
    queryParams.push(limit, offset);

    const result = await this.pool.query(
      `SELECT dli.*, dtr.type_key, dtr.display_name
       FROM data_location_index dli
       JOIN data_type_registry dtr ON dtr.id = dli.data_type_id
       WHERE ${where}
       ORDER BY dli.partition_date DESC, dli.partition_hour DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      queryParams
    );

    // Record access
    if (result.rows.length > 0) {
      const ids = result.rows.map(r => r.id);
      await this.pool.query(
        `UPDATE data_location_index SET last_accessed_at = NOW(), access_count = access_count + 1
         WHERE id = ANY($1::uuid[])`,
        [ids]
      ).catch(() => {}); // non-critical
    }

    return {
      locations: result.rows.map(this.mapLocation),
      total,
    };
  }

  // =========================================================================
  // FIND BY S3 KEY: Reverse lookup from S3 key to location record
  // =========================================================================

  async findByS3Key(bucket: string, key: string): Promise<DataLocation | null> {
    const result = await this.pool.query(
      `SELECT dli.*, dtr.type_key, dtr.display_name
       FROM data_location_index dli
       JOIN data_type_registry dtr ON dtr.id = dli.data_type_id
       WHERE dli.s3_bucket = $1 AND dli.s3_key = $2`,
      [bucket, key]
    );
    return result.rows.length > 0 ? this.mapLocation(result.rows[0]) : null;
  }

  // =========================================================================
  // FIND BY GLACIER ARCHIVE: Lookup by Glacier archive ID
  // =========================================================================

  async findByGlacierArchive(archiveId: string): Promise<DataLocation | null> {
    const result = await this.pool.query(
      `SELECT dli.*, dtr.type_key, dtr.display_name
       FROM data_location_index dli
       JOIN data_type_registry dtr ON dtr.id = dli.data_type_id
       WHERE dli.glacier_archive_id = $1`,
      [archiveId]
    );
    return result.rows.length > 0 ? this.mapLocation(result.rows[0]) : null;
  }

  // =========================================================================
  // SUMMARY: Get storage summary by type and tier for a tenant
  // =========================================================================

  async getStorageSummary(tenantId: string): Promise<DataLocationSummary[]> {
    const result = await this.pool.query(
      `SELECT
         dtr.type_key,
         dtr.display_name,
         dli.storage_tier,
         COUNT(*) as total_partitions,
         SUM(dli.record_count) as total_records,
         SUM(dli.byte_size) as total_bytes,
         MIN(dli.partition_date) as oldest_partition,
         MAX(dli.partition_date) as newest_partition
       FROM data_location_index dli
       JOIN data_type_registry dtr ON dtr.id = dli.data_type_id
       WHERE dli.tenant_id = $1
       GROUP BY dtr.type_key, dtr.display_name, dli.storage_tier
       ORDER BY dtr.type_key, dli.storage_tier`,
      [tenantId]
    );

    return result.rows.map(row => ({
      dataTypeKey: row.type_key as string,
      dataTypeDisplay: row.display_name as string,
      storageTier: row.storage_tier as DataStorageTier,
      totalRecords: parseInt(row.total_records as string, 10) || 0,
      totalBytes: parseInt(row.total_bytes as string, 10) || 0,
      totalPartitions: parseInt(row.total_partitions as string, 10) || 0,
      oldestPartition: row.oldest_partition ? String(row.oldest_partition) : null,
      newestPartition: row.newest_partition ? String(row.newest_partition) : null,
    }));
  }

  // =========================================================================
  // TIER BREAKDOWN: Global storage breakdown by tier
  // =========================================================================

  async getTierBreakdown(tenantId?: string): Promise<StorageTierBreakdown[]> {
    const params: unknown[] = [];
    let where = '';
    if (tenantId) {
      where = 'WHERE dli.tenant_id = $1';
      params.push(tenantId);
    }

    const result = await this.pool.query(
      `SELECT
         dli.storage_tier,
         COUNT(*) as total_partitions,
         SUM(dli.record_count) as total_records,
         SUM(dli.byte_size) as total_bytes,
         SUM(dli.compressed_size) as total_compressed_bytes,
         MIN(dli.partition_date) as oldest_data,
         MAX(dli.partition_date) as newest_data
       FROM data_location_index dli
       ${where}
       GROUP BY dli.storage_tier
       ORDER BY dli.storage_tier`,
      params
    );

    return result.rows.map(row => ({
      tier: row.storage_tier as DataStorageTier,
      totalPartitions: parseInt(row.total_partitions as string, 10) || 0,
      totalRecords: parseInt(row.total_records as string, 10) || 0,
      totalBytes: parseInt(row.total_bytes as string, 10) || 0,
      totalCompressedBytes: parseInt(row.total_compressed_bytes as string, 10) || 0,
      oldestData: row.oldest_data ? String(row.oldest_data) : null,
      newestData: row.newest_data ? String(row.newest_data) : null,
    }));
  }

  // =========================================================================
  // TRANSITION TIER: Update storage tier for a location
  // =========================================================================

  async transitionTier(
    locationId: string,
    newTier: DataStorageTier,
    glacierInfo?: {
      vaultName?: string;
      archiveId?: string;
      storageClass?: string;
    }
  ): Promise<void> {
    await this.pool.query(
      `UPDATE data_location_index SET
        storage_tier = $1::data_storage_tier,
        glacier_vault_name = COALESCE($2, glacier_vault_name),
        glacier_archive_id = COALESCE($3, glacier_archive_id),
        glacier_archived_at = CASE WHEN $1 IN ('glacier', 'deep_archive') THEN NOW() ELSE glacier_archived_at END,
        glacier_storage_class = COALESCE($4, glacier_storage_class),
        tier_transitioned_at = NOW(),
        updated_at = NOW()
      WHERE id = $5`,
      [
        newTier,
        glacierInfo?.vaultName || null,
        glacierInfo?.archiveId || null,
        glacierInfo?.storageClass || null,
        locationId,
      ]
    );
  }

  // =========================================================================
  // BULK TRANSITION: Transition multiple locations at once
  // =========================================================================

  async bulkTransitionTier(
    locationIds: string[],
    newTier: DataStorageTier
  ): Promise<number> {
    const result = await this.pool.query(
      `UPDATE data_location_index SET
        storage_tier = $1::data_storage_tier,
        glacier_archived_at = CASE WHEN $1 IN ('glacier', 'deep_archive') THEN NOW() ELSE glacier_archived_at END,
        tier_transitioned_at = NOW(),
        updated_at = NOW()
      WHERE id = ANY($2::uuid[])
      RETURNING id`,
      [newTier, locationIds]
    );
    return result.rowCount || 0;
  }

  // =========================================================================
  // FIND EXPIRED: Get locations past their retention expiry (for deletion)
  // =========================================================================

  async findExpired(options?: {
    limit?: number;
    excludeImmutable?: boolean;
    tier?: DataStorageTier;
  }): Promise<DataLocation[]> {
    const conditions: string[] = ['dli.retention_expires_at < NOW()'];
    const params: unknown[] = [];
    let idx = 1;

    if (options?.excludeImmutable !== false) {
      conditions.push('dli.immutable = false');
    }
    if (options?.tier) {
      conditions.push(`dli.storage_tier = $${idx}::data_storage_tier`);
      params.push(options.tier);
      idx++;
    }

    params.push(options?.limit || 500);

    const result = await this.pool.query(
      `SELECT dli.*, dtr.type_key, dtr.display_name
       FROM data_location_index dli
       JOIN data_type_registry dtr ON dtr.id = dli.data_type_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY dli.retention_expires_at ASC
       LIMIT $${idx}`,
      params
    );

    return result.rows.map(this.mapLocation);
  }

  // =========================================================================
  // FIND GLACIER LOCATIONS: Get all Glacier-tier locations for deletion queue
  // =========================================================================

  async findGlacierLocations(options?: {
    tenantId?: string;
    expired?: boolean;
    limit?: number;
  }): Promise<GlacierLocationInfo[]> {
    const conditions: string[] = ["dli.storage_tier IN ('glacier', 'deep_archive')"];
    const params: unknown[] = [];
    let idx = 1;

    if (options?.tenantId) {
      conditions.push(`dli.tenant_id = $${idx}`);
      params.push(options.tenantId);
      idx++;
    }
    if (options?.expired) {
      conditions.push('dli.retention_expires_at < NOW()');
    }

    params.push(options?.limit || 500);

    const result = await this.pool.query(
      `SELECT dli.id, dli.s3_bucket, dli.s3_key,
              dli.glacier_archive_id, dli.glacier_storage_class,
              dli.glacier_archived_at, dli.byte_size,
              dli.retention_expires_at, dli.immutable
       FROM data_location_index dli
       WHERE ${conditions.join(' AND ')}
       ORDER BY dli.glacier_archived_at ASC
       LIMIT $${idx}`,
      params
    );

    return result.rows.map(row => ({
      locationId: row.id as string,
      s3Bucket: row.s3_bucket as string,
      s3Key: row.s3_key as string,
      glacierArchiveId: row.glacier_archive_id as string | null,
      glacierStorageClass: row.glacier_storage_class as string | null,
      glacierArchivedAt: row.glacier_archived_at ? (row.glacier_archived_at as Date).toISOString() : null,
      byteSize: parseInt(row.byte_size as string, 10) || 0,
      retentionExpiresAt: row.retention_expires_at ? (row.retention_expires_at as Date).toISOString() : null,
      immutable: row.immutable as boolean,
    }));
  }

  // =========================================================================
  // DELETE: Remove location record (after S3/Glacier object is deleted)
  // =========================================================================

  async deleteLocation(locationId: string): Promise<void> {
    await this.pool.query('DELETE FROM data_location_index WHERE id = $1', [locationId]);
  }

  async bulkDeleteLocations(locationIds: string[]): Promise<number> {
    const result = await this.pool.query(
      'DELETE FROM data_location_index WHERE id = ANY($1::uuid[]) RETURNING id',
      [locationIds]
    );
    return result.rowCount || 0;
  }

  // =========================================================================
  // APPLY OBJECT LOCK: Set S3 Object Lock on immutable locations
  // =========================================================================

  async setObjectLock(
    locationId: string,
    mode: 'GOVERNANCE' | 'COMPLIANCE',
    retainUntil: Date
  ): Promise<void> {
    await this.pool.query(
      `UPDATE data_location_index SET
        object_lock_mode = $1,
        object_lock_until = $2,
        immutable = true,
        updated_at = NOW()
      WHERE id = $3`,
      [mode, retainUntil, locationId]
    );
  }

  // =========================================================================
  // UPDATE RETENTION: Change retention expiry for locations
  // =========================================================================

  async updateRetention(
    locationIds: string[],
    newExpiresAt: Date,
    immutable?: boolean
  ): Promise<number> {
    const result = await this.pool.query(
      `UPDATE data_location_index SET
        retention_expires_at = $1,
        immutable = COALESCE($2, immutable),
        updated_at = NOW()
      WHERE id = ANY($3::uuid[]) AND (immutable = false OR $2 = true)
      RETURNING id`,
      [newExpiresAt, immutable ?? null, locationIds]
    );
    return result.rowCount || 0;
  }

  // =========================================================================
  // STATS: Get overall data lake stats
  // =========================================================================

  async getGlobalStats(): Promise<{
    totalLocations: number;
    totalRecords: number;
    totalBytes: number;
    totalCompressedBytes: number;
    tierCounts: Record<string, number>;
    uniqueTenants: number;
    uniqueDataTypes: number;
    oldestData: string | null;
    newestData: string | null;
    immutableCount: number;
    expiredCount: number;
  }> {
    const result = await this.pool.query(
      `SELECT
        COUNT(*) as total_locations,
        SUM(record_count) as total_records,
        SUM(byte_size) as total_bytes,
        SUM(compressed_size) as total_compressed_bytes,
        COUNT(DISTINCT tenant_id) as unique_tenants,
        COUNT(DISTINCT data_type_id) as unique_data_types,
        MIN(partition_date) as oldest_data,
        MAX(partition_date) as newest_data,
        SUM(CASE WHEN immutable THEN 1 ELSE 0 END) as immutable_count,
        SUM(CASE WHEN retention_expires_at < NOW() THEN 1 ELSE 0 END) as expired_count
      FROM data_location_index`
    );

    const tierResult = await this.pool.query(
      `SELECT storage_tier, COUNT(*) as cnt FROM data_location_index GROUP BY storage_tier`
    );

    const tierCounts: Record<string, number> = {};
    for (const row of tierResult.rows) {
      tierCounts[row.storage_tier as string] = parseInt(row.cnt as string, 10);
    }

    const row = result.rows[0];
    return {
      totalLocations: parseInt(row.total_locations as string, 10) || 0,
      totalRecords: parseInt(row.total_records as string, 10) || 0,
      totalBytes: parseInt(row.total_bytes as string, 10) || 0,
      totalCompressedBytes: parseInt(row.total_compressed_bytes as string, 10) || 0,
      tierCounts,
      uniqueTenants: parseInt(row.unique_tenants as string, 10) || 0,
      uniqueDataTypes: parseInt(row.unique_data_types as string, 10) || 0,
      oldestData: row.oldest_data ? String(row.oldest_data) : null,
      newestData: row.newest_data ? String(row.newest_data) : null,
      immutableCount: parseInt(row.immutable_count as string, 10) || 0,
      expiredCount: parseInt(row.expired_count as string, 10) || 0,
    };
  }

  // =========================================================================
  // MAPPER
  // =========================================================================

  private mapLocation(row: Record<string, unknown>): DataLocation {
    return {
      id: row.id as string,
      dataTypeId: row.data_type_id as string,
      dataTypeKey: (row.type_key as string) || '',
      dataTypeDisplay: (row.display_name as string) || '',
      tenantId: row.tenant_id as string,
      partitionDate: row.partition_date ? String(row.partition_date) : '',
      partitionHour: row.partition_hour ? (row.partition_hour as Date).toISOString() : '',
      storageTier: row.storage_tier as DataStorageTier,
      s3Bucket: row.s3_bucket as string,
      s3Key: row.s3_key as string,
      s3Region: row.s3_region as string,
      s3StorageClass: row.s3_storage_class as string,
      glacierVaultName: row.glacier_vault_name as string | null,
      glacierArchiveId: row.glacier_archive_id as string | null,
      glacierArchivedAt: row.glacier_archived_at ? (row.glacier_archived_at as Date).toISOString() : null,
      glacierStorageClass: row.glacier_storage_class as string | null,
      recordCount: parseInt(row.record_count as string, 10) || 0,
      byteSize: parseInt(row.byte_size as string, 10) || 0,
      compressedSize: parseInt(row.compressed_size as string, 10) || 0,
      fileFormat: row.file_format as string,
      sha256Hash: row.sha256_hash as string | null,
      etag: row.etag as string | null,
      retentionExpiresAt: row.retention_expires_at ? (row.retention_expires_at as Date).toISOString() : null,
      immutable: row.immutable as boolean,
      objectLockMode: row.object_lock_mode as string | null,
      objectLockUntil: row.object_lock_until ? (row.object_lock_until as Date).toISOString() : null,
      tierTransitionedAt: row.tier_transitioned_at ? (row.tier_transitioned_at as Date).toISOString() : null,
      lastAccessedAt: row.last_accessed_at ? (row.last_accessed_at as Date).toISOString() : null,
      accessCount: parseInt(row.access_count as string, 10) || 0,
      createdAt: (row.created_at as Date).toISOString(),
    };
  }
}
