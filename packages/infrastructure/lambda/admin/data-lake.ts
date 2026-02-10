/**
 * RADIANT v4.18.0 - Data Lake Admin API Handler
 *
 * Endpoints:
 *   GET  /admin/data-lake/stats                - Global stats (tier counts, totals)
 *   GET  /admin/data-lake/tiers                - Tier breakdown
 *   GET  /admin/data-lake/data-types           - Registered data types
 *   GET  /admin/data-lake/glacier-queue        - Glacier deletion queue stats
 *   GET  /admin/data-lake/lifecycle-status      - Lifecycle manager status
 *   GET  /admin/data-lake/tenant/:tenantId     - Per-tenant stats
 *   POST /admin/data-lake/query                - Execute Athena query
 *   POST /admin/data-lake/reconcile            - Trigger manual reconciliation
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { Pool } from 'pg';
import { getDbPool } from '../shared/services/database';
import { successResponse, errorResponse } from '../shared/response';
import { NotFoundError, ValidationError } from '../shared/errors';
import { createRegisteredLogger } from '../shared/services/logging-registry.service';
import { DataLakeQueryService } from '../shared/services/data-lake-query.service';
import { RetentionReconcilerService } from '../shared/services/retention-reconciler.service';

const logger = createRegisteredLogger({
  serviceName: 'admin/data-lake',
  category: 'infrastructure',
  sourceType: 'lambda',
});

let pool: Pool | null = null;

async function ensurePool(): Promise<Pool> {
  if (!pool) {
    pool = await getDbPool();
  }
  return pool;
}

export async function handleDataLake(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const pathParts = event.path.split('/').filter(Boolean);
  // pathParts: ['admin', 'data-lake', <action>, ...]
  const action = pathParts[2];
  const subAction = pathParts[3];

  try {
    if (method === 'GET' && action === 'stats') {
      return getGlobalStats();
    }

    if (method === 'GET' && action === 'tiers') {
      return getTierBreakdown();
    }

    if (method === 'GET' && action === 'data-types') {
      return getDataTypes();
    }

    if (method === 'GET' && action === 'glacier-queue') {
      return getGlacierQueueStats();
    }

    if (method === 'GET' && action === 'lifecycle-status') {
      return getLifecycleStatus();
    }

    if (method === 'GET' && action === 'tenant' && subAction) {
      return getTenantStats(subAction);
    }

    if (method === 'POST' && action === 'query') {
      const body = JSON.parse(event.body || '{}');
      return executeQuery(body);
    }

    if (method === 'POST' && action === 'reconcile') {
      const body = JSON.parse(event.body || '{}');
      return triggerReconciliation(body);
    }

    return errorResponse(new NotFoundError(`Not found: ${method} /admin/data-lake/${action || ''}`));
  } catch (error) {
    logger.error('Data lake admin request failed', error as Error, { action });
    return errorResponse(error as Error);
  }
}

// =========================================================================
// GET /admin/data-lake/stats
// =========================================================================

async function getGlobalStats(): Promise<APIGatewayProxyResult> {
  const db = await ensurePool();

  const statsResult = await db.query(`
    SELECT
      COUNT(*) as total_locations,
      COALESCE(SUM(record_count), 0) as total_records,
      COALESCE(SUM(byte_size), 0) as total_bytes,
      COALESCE(SUM(compressed_size), 0) as total_compressed_bytes,
      COUNT(DISTINCT tenant_id) as unique_tenants,
      COUNT(DISTINCT data_type_id) as unique_data_types,
      MIN(partition_hour) as oldest_data,
      MAX(partition_hour) as newest_data,
      COUNT(*) FILTER (WHERE immutable = true) as immutable_count,
      COUNT(*) FILTER (WHERE retention_expires_at < NOW()) as expired_count
    FROM data_location_index
  `);

  const tierResult = await db.query(`
    SELECT storage_tier, COUNT(*) as count
    FROM data_location_index
    GROUP BY storage_tier
  `);

  const row = statsResult.rows[0];
  const tierCounts: Record<string, number> = {};
  for (const tr of tierResult.rows) {
    tierCounts[tr.storage_tier as string] = parseInt(String(tr.count), 10);
  }

  return successResponse({
    totalLocations: parseInt(String(row.total_locations), 10),
    totalRecords: parseInt(String(row.total_records), 10),
    totalBytes: parseInt(String(row.total_bytes), 10),
    totalCompressedBytes: parseInt(String(row.total_compressed_bytes), 10),
    uniqueTenants: parseInt(String(row.unique_tenants), 10),
    uniqueDataTypes: parseInt(String(row.unique_data_types), 10),
    oldestData: row.oldest_data,
    newestData: row.newest_data,
    immutableCount: parseInt(String(row.immutable_count), 10),
    expiredCount: parseInt(String(row.expired_count), 10),
    tierCounts,
  });
}

// =========================================================================
// GET /admin/data-lake/tiers
// =========================================================================

async function getTierBreakdown(): Promise<APIGatewayProxyResult> {
  const db = await ensurePool();

  const result = await db.query(`
    SELECT
      storage_tier as tier,
      COUNT(*) as total_partitions,
      COALESCE(SUM(record_count), 0) as total_records,
      COALESCE(SUM(byte_size), 0) as total_bytes,
      COALESCE(SUM(compressed_size), 0) as total_compressed_bytes,
      MIN(partition_hour) as oldest_data,
      MAX(partition_hour) as newest_data
    FROM data_location_index
    GROUP BY storage_tier
    ORDER BY CASE storage_tier
      WHEN 'hot' THEN 1
      WHEN 'warm' THEN 2
      WHEN 'cold' THEN 3
      WHEN 'glacier' THEN 4
      WHEN 'deep_archive' THEN 5
    END
  `);

  return successResponse(result.rows.map(row => ({
    tier: row.tier,
    totalPartitions: parseInt(String(row.total_partitions), 10),
    totalRecords: parseInt(String(row.total_records), 10),
    totalBytes: parseInt(String(row.total_bytes), 10),
    totalCompressedBytes: parseInt(String(row.total_compressed_bytes), 10),
    oldestData: row.oldest_data,
    newestData: row.newest_data,
  })));
}

// =========================================================================
// GET /admin/data-lake/data-types
// =========================================================================

async function getDataTypes(): Promise<APIGatewayProxyResult> {
  const queryService = new DataLakeQueryService(await ensurePool());
  const dataTypes = await queryService.getDataTypes();
  return successResponse(dataTypes);
}

// =========================================================================
// GET /admin/data-lake/glacier-queue
// =========================================================================

async function getGlacierQueueStats(): Promise<APIGatewayProxyResult> {
  const db = await ensurePool();

  const result = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'queued') as total_queued,
      COUNT(*) FILTER (WHERE status = 'eligible') as total_eligible,
      COUNT(*) FILTER (WHERE status = 'executing') as total_executing,
      COUNT(*) FILTER (WHERE status = 'completed') as total_completed,
      COUNT(*) FILTER (WHERE status = 'failed') as total_failed,
      COALESCE(SUM(estimated_cost_usd) FILTER (WHERE status IN ('queued', 'eligible')), 0) as estimated_pending_cost_usd,
      MIN(eligible_after) FILTER (WHERE status = 'queued' AND eligible_after > NOW()) as next_eligible_at
    FROM glacier_deletion_queue
  `);

  const row = result.rows[0];
  return successResponse({
    totalQueued: parseInt(String(row.total_queued), 10),
    totalEligible: parseInt(String(row.total_eligible), 10),
    totalExecuting: parseInt(String(row.total_executing), 10),
    totalCompleted: parseInt(String(row.total_completed), 10),
    totalFailed: parseInt(String(row.total_failed), 10),
    estimatedPendingCostUsd: parseFloat(String(row.estimated_pending_cost_usd)),
    nextEligibleAt: row.next_eligible_at,
  });
}

// =========================================================================
// GET /admin/data-lake/lifecycle-status
// =========================================================================

async function getLifecycleStatus(): Promise<APIGatewayProxyResult> {
  const db = await ensurePool();

  const result = await db.query(`
    SELECT
      MAX(last_lifecycle_run) as last_run,
      MAX(last_lifecycle_duration_ms) as last_duration_ms,
      COALESCE(SUM(lifecycle_errors), 0) as total_errors
    FROM data_lake_sync_state
  `);

  const row = result.rows[0];
  return successResponse({
    lastRun: row.last_run,
    lastDurationMs: parseInt(String(row.last_duration_ms || 0), 10),
    totalErrors: parseInt(String(row.total_errors), 10),
  });
}

// =========================================================================
// GET /admin/data-lake/tenant/:tenantId
// =========================================================================

async function getTenantStats(tenantId: string): Promise<APIGatewayProxyResult> {
  const db = await ensurePool();

  const result = await db.query(`
    SELECT
      storage_tier as tier,
      COUNT(*) as total_partitions,
      COALESCE(SUM(record_count), 0) as total_records,
      COALESCE(SUM(byte_size), 0) as total_bytes,
      MIN(partition_hour) as oldest_data,
      MAX(partition_hour) as newest_data
    FROM data_location_index
    WHERE tenant_id = $1
    GROUP BY storage_tier
    ORDER BY storage_tier
  `, [tenantId]);

  const retentionResult = await db.query(`
    SELECT tdr.*, dtr.type_key, dtr.display_name
    FROM tenant_data_retention tdr
    JOIN data_type_registry dtr ON dtr.id = tdr.data_type_id
    WHERE tdr.tenant_id = $1
  `, [tenantId]);

  return successResponse({
    tenantId,
    tiers: result.rows.map(row => ({
      tier: row.tier,
      totalPartitions: parseInt(String(row.total_partitions), 10),
      totalRecords: parseInt(String(row.total_records), 10),
      totalBytes: parseInt(String(row.total_bytes), 10),
      oldestData: row.oldest_data,
      newestData: row.newest_data,
    })),
    retentionOverrides: retentionResult.rows.map(row => ({
      dataTypeKey: row.type_key,
      displayName: row.display_name,
      retentionDays: row.retention_days,
      hotDays: row.hot_days,
      warmDays: row.warm_days,
      coldDays: row.cold_days,
      glacierDays: row.glacier_days,
      immutable: row.immutable,
      source: row.source,
    })),
  });
}

// =========================================================================
// POST /admin/data-lake/query
// =========================================================================

async function executeQuery(body: {
  sql?: string;
  tenantId?: string;
  dataTypeKey?: string;
  startDate?: string;
  endDate?: string;
  filters?: Record<string, string | number | boolean>;
  limit?: number;
}): Promise<APIGatewayProxyResult> {
  const queryService = new DataLakeQueryService(await ensurePool());

  if (body.sql) {
    // Raw SQL query
    const result = await queryService.executeQuery(body.sql);
    return successResponse(result);
  }

  // Structured query
  if (!body.tenantId || !body.dataTypeKey) {
    return errorResponse(new ValidationError('tenantId and dataTypeKey are required for structured queries'));
  }

  const result = await queryService.queryEvents({
    tenantId: body.tenantId,
    dataTypeKey: body.dataTypeKey,
    startDate: body.startDate,
    endDate: body.endDate,
    filters: body.filters,
    limit: body.limit,
  });

  return successResponse(result);
}

// =========================================================================
// POST /admin/data-lake/reconcile
// =========================================================================

async function triggerReconciliation(body: {
  tenantId: string;
  dataTypeId?: string;
  triggerDetail?: string;
}): Promise<APIGatewayProxyResult> {
  if (!body.tenantId) {
    return errorResponse(new ValidationError('tenantId is required'));
  }

  const reconciler = new RetentionReconcilerService(await ensurePool());
  const result = await reconciler.reconcile({
    tenantId: body.tenantId,
    dataTypeId: body.dataTypeId,
    triggerType: 'admin_override',
    triggerDetail: body.triggerDetail || 'Manual trigger from admin dashboard',
    performedBy: 'admin',
  });

  return successResponse(result);
}
