/**
 * RADIANT v5.12.2 - S3 Storage Management Admin API
 * 
 * Provides endpoints for viewing storage stats and managing offloading configuration.
 */

import { APIGatewayProxyHandler } from 'aws-lambda';
import { executeStatement, stringParam, intParam, boolParam } from '../shared/utils/db';
import { s3ContentOffloadService } from '../shared/services/s3-content-offload.service';
import { logger } from '../shared/utils/logger';
import { withAdminAuth, getTenantId } from '../shared/utils/auth';

// ============================================================================
// Types
// ============================================================================

interface StorageStats {
  total_objects: number;
  total_size_bytes: number;
  total_size_mb: number;
  total_size_gb: number;
  by_table: Record<string, {
    count: number;
    size_bytes: number;
    size_mb: number;
    compressed_count: number;
    avg_size_bytes: number;
  }>;
  pending_deletion: number;
  orphan_queue: {
    pending: number;
    processing: number;
    completed_today: number;
    failed: number;
  };
  dedup_savings: {
    unique_hashes: number;
    total_references: number;
    savings_percent: number;
  };
}

interface OffloadingConfig {
  id: string;
  tenant_id: string;
  offloading_enabled: boolean;
  auto_offload_on_insert: boolean;
  auto_offload_threshold_bytes: number;
  offload_messages: boolean;
  offload_memories: boolean;
  offload_episodes: boolean;
  offload_training_data: boolean;
  compression_enabled: boolean;
  compression_algorithm: string;
  compression_threshold_bytes: number;
  orphan_grace_period_hours: number;
  auto_cleanup_enabled: boolean;
  content_bucket: string;
  content_prefix: string;
}

// ============================================================================
// Handlers
// ============================================================================

/**
 * GET /api/admin/s3-storage/dashboard
 * Get comprehensive storage dashboard data
 */
export const getDashboard: APIGatewayProxyHandler = withAdminAuth(async (event) => {
  const tenantId = getTenantId(event);

  try {
    // Get storage stats by table
    const statsResult = await executeStatement(
      `SELECT 
        source_table,
        COUNT(*) as total_objects,
        SUM(size_bytes) as total_size_bytes,
        COUNT(*) FILTER (WHERE compression != 'none') as compressed_count,
        AVG(size_bytes) as avg_size_bytes,
        COUNT(*) FILTER (WHERE marked_for_deletion) as pending_deletion
      FROM s3_content_registry
      WHERE tenant_id = $1
      GROUP BY source_table`,
      [stringParam('tenantId', tenantId)]
    );

    // Get orphan queue stats
    const orphanResult = await executeStatement(
      `SELECT 
        deletion_status,
        COUNT(*) as count
      FROM s3_orphan_queue oq
      JOIN s3_content_registry r ON r.id = oq.original_registry_id
      WHERE r.tenant_id = $1
      GROUP BY deletion_status`,
      [stringParam('tenantId', tenantId)]
    );

    // Get completed today
    const completedTodayResult = await executeStatement(
      `SELECT COUNT(*) as count
      FROM s3_orphan_queue oq
      JOIN s3_content_registry r ON r.id = oq.original_registry_id
      WHERE r.tenant_id = $1 
      AND oq.deletion_status = 'completed'
      AND oq.deleted_at >= CURRENT_DATE`,
      [stringParam('tenantId', tenantId)]
    );

    // Get dedup savings
    const dedupResult = await executeStatement(
      `SELECT 
        COUNT(DISTINCT content_hash) as unique_hashes,
        SUM(reference_count) as total_references
      FROM s3_content_registry
      WHERE tenant_id = $1 AND marked_for_deletion = false`,
      [stringParam('tenantId', tenantId)]
    );

    // Get config
    const configResult = await executeStatement(
      `SELECT * FROM s3_offloading_config WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    );

    // Build response
    const stats: StorageStats = {
      total_objects: 0,
      total_size_bytes: 0,
      total_size_mb: 0,
      total_size_gb: 0,
      by_table: {},
      pending_deletion: 0,
      orphan_queue: {
        pending: 0,
        processing: 0,
        completed_today: 0,
        failed: 0,
      },
      dedup_savings: {
        unique_hashes: 0,
        total_references: 0,
        savings_percent: 0,
      },
    };

    // Process stats by table
    for (const row of (statsResult.rows || []) as Array<{
      source_table: string;
      total_objects: string;
      total_size_bytes: string;
      compressed_count: string;
      avg_size_bytes: string;
      pending_deletion: string;
    }>) {
      const count = parseInt(row.total_objects, 10);
      const sizeBytes = parseInt(row.total_size_bytes, 10);
      
      stats.total_objects += count;
      stats.total_size_bytes += sizeBytes;
      stats.pending_deletion += parseInt(row.pending_deletion, 10);
      
      stats.by_table[row.source_table] = {
        count,
        size_bytes: sizeBytes,
        size_mb: sizeBytes / (1024 * 1024),
        compressed_count: parseInt(row.compressed_count, 10),
        avg_size_bytes: parseFloat(row.avg_size_bytes),
      };
    }

    stats.total_size_mb = stats.total_size_bytes / (1024 * 1024);
    stats.total_size_gb = stats.total_size_bytes / (1024 * 1024 * 1024);

    // Process orphan stats
    for (const row of (orphanResult.rows || []) as Array<{ deletion_status: string; count: string }>) {
      const count = parseInt(row.count, 10);
      if (row.deletion_status === 'pending') stats.orphan_queue.pending = count;
      if (row.deletion_status === 'processing') stats.orphan_queue.processing = count;
      if (row.deletion_status === 'failed') stats.orphan_queue.failed = count;
    }

    if (completedTodayResult.rows && completedTodayResult.rows.length > 0) {
      stats.orphan_queue.completed_today = parseInt((completedTodayResult.rows[0] as { count: string }).count, 10);
    }

    // Process dedup stats
    if (dedupResult.rows && dedupResult.rows.length > 0) {
      const dedup = dedupResult.rows[0] as { unique_hashes: string; total_references: string };
      const uniqueHashes = parseInt(dedup.unique_hashes, 10);
      const totalRefs = parseInt(dedup.total_references, 10);
      
      stats.dedup_savings.unique_hashes = uniqueHashes;
      stats.dedup_savings.total_references = totalRefs;
      stats.dedup_savings.savings_percent = totalRefs > 0 
        ? ((totalRefs - uniqueHashes) / totalRefs) * 100 
        : 0;
    }

    // Get config or defaults
    let config: OffloadingConfig | null = null;
    if (configResult.rows && configResult.rows.length > 0) {
      config = configResult.rows[0] as OffloadingConfig;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        stats,
        config,
        tables: [
          { name: 'thinktank_messages', display: 'Messages', description: 'User chat messages' },
          { name: 'memories', display: 'Memories', description: 'Persistent user memories' },
          { name: 'learning_episodes', display: 'Learning Episodes', description: 'Draft and final content' },
          { name: 'rejected_prompt_archive', display: 'Rejected Prompts', description: 'Rejected prompt history' },
          { name: 'shadow_learning_log', display: 'Shadow Learning', description: 'Self-training data' },
        ],
      }),
    };
  } catch (error) {
    logger.error('Failed to get S3 storage dashboard', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to get storage dashboard' }),
    };
  }
});

/**
 * GET /api/admin/s3-storage/config
 * Get offloading configuration
 */
export const getConfig: APIGatewayProxyHandler = withAdminAuth(async (event) => {
  const tenantId = getTenantId(event);

  try {
    const result = await executeStatement(
      `SELECT * FROM s3_offloading_config WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    );

    if (result.rows && result.rows.length > 0) {
      return {
        statusCode: 200,
        body: JSON.stringify(result.rows[0]),
      };
    }

    // Return defaults if no config exists
    return {
      statusCode: 200,
      body: JSON.stringify({
        tenant_id: tenantId,
        offloading_enabled: true,
        auto_offload_on_insert: false,
        auto_offload_threshold_bytes: 10000,
        offload_messages: true,
        offload_memories: true,
        offload_episodes: true,
        offload_training_data: true,
        compression_enabled: true,
        compression_algorithm: 'gzip',
        compression_threshold_bytes: 1000,
        orphan_grace_period_hours: 24,
        auto_cleanup_enabled: true,
        content_bucket: process.env.RADIANT_CONTENT_BUCKET || 'radiant-content',
        content_prefix: 'content/',
      }),
    };
  } catch (error) {
    logger.error('Failed to get S3 config', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to get configuration' }),
    };
  }
});

/**
 * PUT /api/admin/s3-storage/config
 * Update offloading configuration
 */
export const updateConfig: APIGatewayProxyHandler = withAdminAuth(async (event) => {
  const tenantId = getTenantId(event);
  const body = JSON.parse(event.body || '{}');

  try {
    await executeStatement(
      `INSERT INTO s3_offloading_config (
        tenant_id, offloading_enabled, auto_offload_on_insert, auto_offload_threshold_bytes,
        offload_messages, offload_memories, offload_episodes, offload_training_data,
        compression_enabled, compression_algorithm, compression_threshold_bytes,
        orphan_grace_period_hours, auto_cleanup_enabled, content_bucket, content_prefix,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW()
      )
      ON CONFLICT (tenant_id) DO UPDATE SET
        offloading_enabled = EXCLUDED.offloading_enabled,
        auto_offload_on_insert = EXCLUDED.auto_offload_on_insert,
        auto_offload_threshold_bytes = EXCLUDED.auto_offload_threshold_bytes,
        offload_messages = EXCLUDED.offload_messages,
        offload_memories = EXCLUDED.offload_memories,
        offload_episodes = EXCLUDED.offload_episodes,
        offload_training_data = EXCLUDED.offload_training_data,
        compression_enabled = EXCLUDED.compression_enabled,
        compression_algorithm = EXCLUDED.compression_algorithm,
        compression_threshold_bytes = EXCLUDED.compression_threshold_bytes,
        orphan_grace_period_hours = EXCLUDED.orphan_grace_period_hours,
        auto_cleanup_enabled = EXCLUDED.auto_cleanup_enabled,
        content_bucket = EXCLUDED.content_bucket,
        content_prefix = EXCLUDED.content_prefix,
        updated_at = NOW()`,
      [
        stringParam('tenantId', tenantId),
        boolParam('offloadingEnabled', body.offloading_enabled ?? true),
        boolParam('autoOffloadOnInsert', body.auto_offload_on_insert ?? false),
        intParam('autoOffloadThresholdBytes', body.auto_offload_threshold_bytes ?? 10000),
        boolParam('offloadMessages', body.offload_messages ?? true),
        boolParam('offloadMemories', body.offload_memories ?? true),
        boolParam('offloadEpisodes', body.offload_episodes ?? true),
        boolParam('offloadTrainingData', body.offload_training_data ?? true),
        boolParam('compressionEnabled', body.compression_enabled ?? true),
        stringParam('compressionAlgorithm', body.compression_algorithm ?? 'gzip'),
        intParam('compressionThresholdBytes', body.compression_threshold_bytes ?? 1000),
        intParam('orphanGracePeriodHours', body.orphan_grace_period_hours ?? 24),
        boolParam('autoCleanupEnabled', body.auto_cleanup_enabled ?? true),
        stringParam('contentBucket', body.content_bucket ?? 'radiant-content'),
        stringParam('contentPrefix', body.content_prefix ?? 'content/'),
      ]
    );

    logger.info('S3 offloading config updated', { tenantId });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    logger.error('Failed to update S3 config', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to update configuration' }),
    };
  }
});

/**
 * POST /api/admin/s3-storage/trigger-cleanup
 * Manually trigger orphan cleanup
 */
export const triggerCleanup: APIGatewayProxyHandler = withAdminAuth(async (event) => {
  const tenantId = getTenantId(event);

  try {
    const result = await s3ContentOffloadService.processOrphanQueue(50);

    logger.info('Manual cleanup triggered', { tenantId, result });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        deleted: result.processed,
        failed: result.failed,
      }),
    };
  } catch (error) {
    logger.error('Failed to trigger cleanup', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to trigger cleanup' }),
    };
  }
});

/**
 * GET /api/admin/s3-storage/orphans
 * Get orphan queue details
 */
export const getOrphans: APIGatewayProxyHandler = withAdminAuth(async (event) => {
  const tenantId = getTenantId(event);
  const status = event.queryStringParameters?.status || 'pending';
  const limit = parseInt(event.queryStringParameters?.limit || '50', 10);

  try {
    const result = await executeStatement(
      `SELECT 
        oq.id,
        oq.s3_bucket,
        oq.s3_key,
        oq.reason,
        oq.queued_at,
        oq.delete_after,
        oq.deletion_status,
        oq.error_message,
        r.source_table,
        r.size_bytes
      FROM s3_orphan_queue oq
      LEFT JOIN s3_content_registry r ON r.id = oq.original_registry_id
      WHERE (r.tenant_id = $1 OR r.tenant_id IS NULL)
      AND oq.deletion_status = $2
      ORDER BY oq.queued_at DESC
      LIMIT $3`,
      [
        stringParam('tenantId', tenantId),
        stringParam('status', status),
        intParam('limit', limit),
      ]
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        orphans: result.rows || [],
        count: (result.rows || []).length,
      }),
    };
  } catch (error) {
    logger.error('Failed to get orphans', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to get orphan queue' }),
    };
  }
});

/**
 * GET /api/admin/s3-storage/history
 * Get storage history/trends
 */
export const getHistory: APIGatewayProxyHandler = withAdminAuth(async (event) => {
  const tenantId = getTenantId(event);
  const days = parseInt(event.queryStringParameters?.days || '30', 10);

  try {
    const result = await executeStatement(
      `SELECT 
        DATE(created_at) as date,
        source_table,
        COUNT(*) as objects_added,
        SUM(size_bytes) as bytes_added
      FROM s3_content_registry
      WHERE tenant_id = $1
      AND created_at >= NOW() - ($2 || ' days')::INTERVAL
      GROUP BY DATE(created_at), source_table
      ORDER BY date DESC`,
      [
        stringParam('tenantId', tenantId),
        intParam('days', days),
      ]
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        history: result.rows || [],
      }),
    };
  } catch (error) {
    logger.error('Failed to get storage history', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to get storage history' }),
    };
  }
});

// Export handler map
export const handler: APIGatewayProxyHandler = async (event, context) => {
  const path = event.path;
  const method = event.httpMethod;

  if (path.endsWith('/dashboard') && method === 'GET') {
    return getDashboard(event, context, () => {});
  }
  if (path.endsWith('/config') && method === 'GET') {
    return getConfig(event, context, () => {});
  }
  if (path.endsWith('/config') && method === 'PUT') {
    return updateConfig(event, context, () => {});
  }
  if (path.endsWith('/trigger-cleanup') && method === 'POST') {
    return triggerCleanup(event, context, () => {});
  }
  if (path.endsWith('/orphans') && method === 'GET') {
    return getOrphans(event, context, () => {});
  }
  if (path.endsWith('/history') && method === 'GET') {
    return getHistory(event, context, () => {});
  }

  return {
    statusCode: 404,
    body: JSON.stringify({ error: 'Not found' }),
  };
};
