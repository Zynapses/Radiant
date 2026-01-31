// RADIANT v5.2.4 - Model Deletion Queue Service
// Handles soft deletes with usage tracking and queue management

import { executeStatement } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { modelVersionManagerService } from './model-version-manager.service';
import type {
  ModelDeletionQueueItem,
  DeletionQueueStatus,
  ModelUsageSession,
  DeletionQueueDashboard,
  ListDeletionQueueRequest,
  QueueModelForDeletionRequest,
} from '@radiant/shared';

// ============================================================================
// Model Deletion Queue Service
// ============================================================================

class ModelDeletionQueueService {
  // ============================================================================
  // Queue Management
  // ============================================================================

  async queueModelForDeletion(params: QueueModelForDeletionRequest): Promise<ModelDeletionQueueItem> {
    // Check if already in queue
    const existing = await executeStatement(
      `SELECT id FROM model_deletion_queue 
       WHERE model_version_id = $1 AND status NOT IN ('completed', 'cancelled')`,
      [{ name: 'versionId', value: { stringValue: params.modelVersionId } }]
    );

    if (existing.rows && existing.rows.length > 0) {
      throw new Error('Model version is already queued for deletion');
    }

    // Check if model has active sessions
    const hasActiveSessions = await this.checkActiveSessions(params.modelVersionId);
    const initialStatus: DeletionQueueStatus = hasActiveSessions ? 'blocked' : 'pending';

    const result = await executeStatement(
      `INSERT INTO model_deletion_queue (
         model_version_id, requested_by, reason, priority,
         status, active_sessions_count, delete_s3_data
       ) VALUES ($1, $2, $3, $4, $5, 
         (SELECT COUNT(*) FROM model_usage_sessions WHERE model_version_id = $1 AND ended_at IS NULL),
         $6
       ) RETURNING id`,
      [
        { name: 'versionId', value: { stringValue: params.modelVersionId } },
        { name: 'requestedBy', value: params.requestedBy ? { stringValue: params.requestedBy } : { isNull: true } },
        { name: 'reason', value: params.reason ? { stringValue: params.reason } : { isNull: true } },
        { name: 'priority', value: { longValue: params.priority || 5 } },
        { name: 'status', value: { stringValue: initialStatus } },
        { name: 'deleteS3', value: { booleanValue: params.deleteS3Data ?? true } },
      ]
    );

    const id = String(result.rows?.[0]?.id || '');
    
    // Deactivate the model version immediately
    await modelVersionManagerService.updateModelVersion(params.modelVersionId, { isActive: false });

    logger.info('Model queued for deletion', {
      queueId: id,
      modelVersionId: params.modelVersionId,
      status: initialStatus,
      hasActiveSessions,
    });

    const item = await this.getQueueItem(id);
    if (!item) throw new Error('Failed to queue model for deletion');
    return item;
  }

  async getQueueItem(id: string): Promise<ModelDeletionQueueItem | null> {
    const result = await executeStatement(
      `SELECT dq.*, mv.model_id, mv.family, mv.version, mv.display_name
       FROM model_deletion_queue dq
       JOIN model_versions mv ON dq.model_version_id = mv.id
       WHERE dq.id = $1`,
      [{ name: 'id', value: { stringValue: id } }]
    );

    if (!result.rows || result.rows.length === 0) return null;
    return this.mapQueueItemRow(result.rows[0]);
  }

  async listQueueItems(params: ListDeletionQueueRequest): Promise<{
    items: ModelDeletionQueueItem[];
    total: number;
  }> {
    let sql = `SELECT dq.*, mv.model_id, mv.family, mv.version, mv.display_name
               FROM model_deletion_queue dq
               JOIN model_versions mv ON dq.model_version_id = mv.id
               WHERE 1=1`;
    const queryParams: Array<{ name: string; value: Record<string, unknown> }> = [];
    let paramIndex = 1;

    if (params.status) {
      sql += ` AND dq.status = $${paramIndex++}`;
      queryParams.push({ name: 'status', value: { stringValue: params.status } });
    }
    if (params.family) {
      sql += ` AND mv.family = $${paramIndex++}`;
      queryParams.push({ name: 'family', value: { stringValue: params.family } });
    }

    const countResult = await executeStatement(
      sql.replace(/SELECT dq\.\*, .*? FROM/, 'SELECT COUNT(*) FROM'),
      queryParams
    );
    const total = Number((countResult.rows?.[0] as Record<string, unknown>)?.count || 0);

    sql += ` ORDER BY dq.priority ASC, dq.queued_at ASC`;
    sql += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    queryParams.push({ name: 'limit', value: { longValue: params.limit || 50 } });
    queryParams.push({ name: 'offset', value: { longValue: params.offset || 0 } });

    const result = await executeStatement(sql, queryParams);
    return {
      items: (result.rows || []).map(row => this.mapQueueItemRow(row)),
      total,
    };
  }

  async cancelDeletion(id: string, cancelledBy?: string): Promise<ModelDeletionQueueItem> {
    const item = await this.getQueueItem(id);
    if (!item) throw new Error('Queue item not found');
    if (item.status === 'completed') throw new Error('Cannot cancel completed deletion');
    if (item.status === 'processing') throw new Error('Cannot cancel deletion in progress');

    await executeStatement(
      `UPDATE model_deletion_queue SET 
         status = 'cancelled', 
         cancelled_at = NOW(),
         cancelled_by = $2
       WHERE id = $1`,
      [
        { name: 'id', value: { stringValue: id } },
        { name: 'cancelledBy', value: cancelledBy ? { stringValue: cancelledBy } : { isNull: true } },
      ]
    );

    // Reactivate the model version
    await modelVersionManagerService.updateModelVersion(item.modelVersionId, { isActive: true });

    logger.info('Deletion cancelled', { queueId: id, cancelledBy });
    return (await this.getQueueItem(id))!;
  }

  async updatePriority(id: string, priority: number): Promise<ModelDeletionQueueItem> {
    await executeStatement(
      `UPDATE model_deletion_queue SET priority = $2 WHERE id = $1`,
      [
        { name: 'id', value: { stringValue: id } },
        { name: 'priority', value: { longValue: priority } },
      ]
    );
    return (await this.getQueueItem(id))!;
  }

  // ============================================================================
  // Deletion Processing
  // ============================================================================

  async processNextInQueue(): Promise<ModelDeletionQueueItem | null> {
    // Find next pending item with no active sessions
    const result = await executeStatement(
      `SELECT dq.id FROM model_deletion_queue dq
       WHERE dq.status = 'pending'
       AND NOT EXISTS (
         SELECT 1 FROM model_usage_sessions 
         WHERE model_version_id = dq.model_version_id AND ended_at IS NULL
       )
       ORDER BY dq.priority ASC, dq.queued_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
      []
    );

    if (!result.rows || result.rows.length === 0) return null;

    const id = String(result.rows[0].id);
    return this.processDeletion(id);
  }

  async processDeletion(id: string): Promise<ModelDeletionQueueItem> {
    const item = await this.getQueueItem(id);
    if (!item) throw new Error('Queue item not found');
    if (item.status !== 'pending') throw new Error(`Cannot process item with status: ${item.status}`);

    // Check again for active sessions
    const hasActiveSessions = await this.checkActiveSessions(item.modelVersionId);
    if (hasActiveSessions) {
      await executeStatement(
        `UPDATE model_deletion_queue SET status = 'blocked', 
         active_sessions_count = (SELECT COUNT(*) FROM model_usage_sessions 
           WHERE model_version_id = $2 AND ended_at IS NULL)
         WHERE id = $1`,
        [
          { name: 'id', value: { stringValue: id } },
          { name: 'versionId', value: { stringValue: item.modelVersionId } },
        ]
      );
      throw new Error('Model has active sessions');
    }

    // Start processing
    await executeStatement(
      `UPDATE model_deletion_queue SET status = 'processing', started_at = NOW() WHERE id = $1`,
      [{ name: 'id', value: { stringValue: id } }]
    );

    try {
      let s3FilesDeleted = 0;
      let s3BytesDeleted = 0;

      // Delete S3 data if requested
      if (item.deleteS3Data) {
        const storageInfo = await modelVersionManagerService.getStorageInfo(item.modelVersionId);
        if (storageInfo) {
          s3BytesDeleted = storageInfo.totalSize;
          s3FilesDeleted = await modelVersionManagerService.deleteS3Storage(item.modelVersionId);
        }
      }

      // Mark model version as deleted
      await executeStatement(
        `UPDATE model_versions SET 
           is_active = false, 
           deployment_status = 'not_deployed',
           thermal_state = 'off'
         WHERE id = $1`,
        [{ name: 'id', value: { stringValue: item.modelVersionId } }]
      );

      // Complete the deletion
      await executeStatement(
        `UPDATE model_deletion_queue SET 
           status = 'completed',
           completed_at = NOW(),
           s3_files_deleted = $2,
           s3_bytes_deleted = $3
         WHERE id = $1`,
        [
          { name: 'id', value: { stringValue: id } },
          { name: 'filesDeleted', value: { longValue: s3FilesDeleted } },
          { name: 'bytesDeleted', value: { longValue: s3BytesDeleted } },
        ]
      );

      logger.info('Deletion completed', {
        queueId: id,
        modelVersionId: item.modelVersionId,
        s3FilesDeleted,
        s3BytesDeleted,
      });

      return (await this.getQueueItem(id))!;
    } catch (error) {
      // Mark as failed
      await executeStatement(
        `UPDATE model_deletion_queue SET 
           status = 'pending',
           error = $2,
           retry_count = retry_count + 1
         WHERE id = $1`,
        [
          { name: 'id', value: { stringValue: id } },
          { name: 'error', value: { stringValue: String(error) } },
        ]
      );
      throw error;
    }
  }

  async refreshBlockedItems(): Promise<number> {
    // Find blocked items that no longer have active sessions
    const result = await executeStatement(
      `UPDATE model_deletion_queue SET status = 'pending', active_sessions_count = 0
       WHERE status = 'blocked'
       AND NOT EXISTS (
         SELECT 1 FROM model_usage_sessions 
         WHERE model_version_id = model_deletion_queue.model_version_id AND ended_at IS NULL
       )
       RETURNING id`,
      []
    );

    const unblocked = result.rows?.length || 0;
    if (unblocked > 0) {
      logger.info('Unblocked deletion queue items', { count: unblocked });
    }
    return unblocked;
  }

  // ============================================================================
  // Usage Session Tracking
  // ============================================================================

  async startUsageSession(params: {
    modelVersionId: string;
    userId?: string;
    tenantId?: string;
    sessionType: string;
    endpointName?: string;
  }): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO model_usage_sessions (model_version_id, user_id, tenant_id, session_type, endpoint_name)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        { name: 'versionId', value: { stringValue: params.modelVersionId } },
        { name: 'userId', value: params.userId ? { stringValue: params.userId } : { isNull: true } },
        { name: 'tenantId', value: params.tenantId ? { stringValue: params.tenantId } : { isNull: true } },
        { name: 'sessionType', value: { stringValue: params.sessionType } },
        { name: 'endpointName', value: params.endpointName ? { stringValue: params.endpointName } : { isNull: true } },
      ]
    );

    const id = String(result.rows?.[0]?.id || '');

    // Update active sessions count on model version
    await executeStatement(
      `UPDATE model_versions SET total_requests = total_requests + 1, last_request_at = NOW()
       WHERE id = $1`,
      [{ name: 'id', value: { stringValue: params.modelVersionId } }]
    );

    return id;
  }

  async endUsageSession(sessionId: string, stats?: {
    requestCount?: number;
    inputTokens?: number;
    outputTokens?: number;
  }): Promise<void> {
    await executeStatement(
      `UPDATE model_usage_sessions SET 
         ended_at = NOW(),
         request_count = $2,
         input_tokens = $3,
         output_tokens = $4
       WHERE id = $1`,
      [
        { name: 'id', value: { stringValue: sessionId } },
        { name: 'requests', value: stats?.requestCount ? { longValue: stats.requestCount } : { isNull: true } },
        { name: 'inputTokens', value: stats?.inputTokens ? { longValue: stats.inputTokens } : { isNull: true } },
        { name: 'outputTokens', value: stats?.outputTokens ? { longValue: stats.outputTokens } : { isNull: true } },
      ]
    );

    // Check if any blocked deletions can proceed
    await this.refreshBlockedItems();
  }

  async getActiveSessions(modelVersionId: string): Promise<ModelUsageSession[]> {
    const result = await executeStatement(
      `SELECT * FROM model_usage_sessions 
       WHERE model_version_id = $1 AND ended_at IS NULL
       ORDER BY started_at DESC`,
      [{ name: 'versionId', value: { stringValue: modelVersionId } }]
    );

    return (result.rows || []).map(row => this.mapUsageSessionRow(row));
  }

  private async checkActiveSessions(modelVersionId: string): Promise<boolean> {
    const result = await executeStatement(
      `SELECT EXISTS(
         SELECT 1 FROM model_usage_sessions 
         WHERE model_version_id = $1 AND ended_at IS NULL
       ) as has_sessions`,
      [{ name: 'versionId', value: { stringValue: modelVersionId } }]
    );
    return Boolean(result.rows?.[0]?.has_sessions);
  }

  // ============================================================================
  // Dashboard
  // ============================================================================

  async getDashboard(): Promise<DeletionQueueDashboard> {
    const statsResult = await executeStatement(
      `SELECT 
         COUNT(*) FILTER (WHERE status = 'pending') as pending,
         COUNT(*) FILTER (WHERE status = 'blocked') as blocked,
         COUNT(*) FILTER (WHERE status = 'processing') as processing,
         COUNT(*) FILTER (WHERE status = 'completed') as completed,
         COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
         COUNT(*) FILTER (WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours') as completed_24h,
         COALESCE(SUM(s3_bytes_deleted) FILTER (WHERE status = 'completed'), 0) as total_bytes_deleted
       FROM model_deletion_queue`,
      []
    );

    const stats = statsResult.rows?.[0] as Record<string, unknown> || {};

    const pendingResult = await executeStatement(
      `SELECT dq.*, mv.model_id, mv.family, mv.version, mv.display_name
       FROM model_deletion_queue dq
       JOIN model_versions mv ON dq.model_version_id = mv.id
       WHERE dq.status IN ('pending', 'blocked', 'processing')
       ORDER BY dq.priority ASC, dq.queued_at ASC
       LIMIT 10`,
      []
    );

    const recentResult = await executeStatement(
      `SELECT dq.*, mv.model_id, mv.family, mv.version, mv.display_name
       FROM model_deletion_queue dq
       JOIN model_versions mv ON dq.model_version_id = mv.id
       WHERE dq.status = 'completed'
       ORDER BY dq.completed_at DESC
       LIMIT 5`,
      []
    );

    const blockedResult = await executeStatement(
      `SELECT dq.*, mv.model_id, mv.family, mv.version, mv.display_name
       FROM model_deletion_queue dq
       JOIN model_versions mv ON dq.model_version_id = mv.id
       WHERE dq.status = 'blocked'
       ORDER BY dq.queued_at ASC
       LIMIT 10`,
      []
    );

    const sessionsResult = await executeStatement(
      `SELECT model_version_id, COUNT(*) as session_count
       FROM model_usage_sessions
       WHERE ended_at IS NULL
       GROUP BY model_version_id`,
      []
    );

    const activeSessions: Record<string, number> = {};
    for (const row of sessionsResult.rows || []) {
      activeSessions[String(row.model_version_id)] = Number(row.session_count);
    }

    return {
      pending: Number(stats.pending || 0),
      blocked: Number(stats.blocked || 0),
      processing: Number(stats.processing || 0),
      completed: Number(stats.completed || 0),
      cancelled: Number(stats.cancelled || 0),
      completedLast24h: Number(stats.completed_24h || 0),
      totalBytesFreed: Number(stats.total_bytes_deleted || 0),
      pendingItems: (pendingResult.rows || []).map(row => this.mapQueueItemRow(row)),
      recentlyCompleted: (recentResult.rows || []).map(row => this.mapQueueItemRow(row)),
      blockedItems: (blockedResult.rows || []).map(row => this.mapQueueItemRow(row)),
      activeSessionsByModel: activeSessions,
    };
  }

  // ============================================================================
  // Mapping Helpers
  // ============================================================================

  private mapQueueItemRow(row: Record<string, unknown>): ModelDeletionQueueItem {
    return {
      id: String(row.id),
      modelVersionId: String(row.model_version_id),
      modelId: String(row.model_id),
      family: String(row.family),
      version: String(row.version),
      displayName: row.display_name ? String(row.display_name) : undefined,
      status: String(row.status) as DeletionQueueStatus,
      queuedAt: new Date(String(row.queued_at)),
      requestedBy: row.requested_by ? String(row.requested_by) : undefined,
      reason: row.reason ? String(row.reason) : undefined,
      priority: Number(row.priority || 5),
      activeSessionsCount: Number(row.active_sessions_count || 0),
      deleteS3Data: Boolean(row.delete_s3_data),
      startedAt: row.started_at ? new Date(String(row.started_at)) : undefined,
      completedAt: row.completed_at ? new Date(String(row.completed_at)) : undefined,
      cancelledAt: row.cancelled_at ? new Date(String(row.cancelled_at)) : undefined,
      cancelledBy: row.cancelled_by ? String(row.cancelled_by) : undefined,
      retryCount: Number(row.retry_count || 0),
      maxRetries: Number(row.max_retries || 3),
      error: row.error ? String(row.error) : undefined,
      s3FilesDeleted: row.s3_files_deleted ? Number(row.s3_files_deleted) : undefined,
      s3BytesDeleted: row.s3_bytes_deleted ? Number(row.s3_bytes_deleted) : undefined,
    };
  }

  private mapUsageSessionRow(row: Record<string, unknown>): ModelUsageSession {
    return {
      id: String(row.id),
      modelVersionId: String(row.model_version_id),
      userId: row.user_id ? String(row.user_id) : undefined,
      tenantId: row.tenant_id ? String(row.tenant_id) : undefined,
      sessionType: String(row.session_type),
      endpointName: row.endpoint_name ? String(row.endpoint_name) : undefined,
      startedAt: new Date(String(row.started_at)),
      endedAt: row.ended_at ? new Date(String(row.ended_at)) : undefined,
      requestCount: row.request_count ? Number(row.request_count) : undefined,
      inputTokens: row.input_tokens ? Number(row.input_tokens) : undefined,
      outputTokens: row.output_tokens ? Number(row.output_tokens) : undefined,
    };
  }
}

export const modelDeletionQueueService = new ModelDeletionQueueService();
