/**
 * UDS Tier Coordinator Service
 * Orchestrates data movement between Hot → Warm → Cold → Glacier tiers
 * 
 * Tier Strategy:
 * - Hot (0-24h): DynamoDB + ElastiCache - real-time access
 * - Warm (1-90 days): Aurora PostgreSQL - active data
 * - Cold (90 days - 7 years): S3 Iceberg - archived data
 * - Glacier (7+ years): S3 Glacier - deep archive
 */

import { executeStatement, stringParam, boolParam } from '../../db/client';
import { enhancedLogger as logger } from '../../logging/enhanced-logger';
import { udsAuditService } from './audit.service';
import type {
  UDSTier,
  UDSTierHealth,
  UDSTierAlert,
  UDSDataFlowMetrics,
} from '@radiant/shared';

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_HOT_TO_WARM_HOURS = 24;
const DEFAULT_WARM_TO_COLD_DAYS = 90;
const DEFAULT_COLD_TO_GLACIER_YEARS = 7;

const BATCH_SIZE = 1000;

// =============================================================================
// Types
// =============================================================================

interface TierConfig {
  tenantId: string;
  hotToWarmHours: number;
  warmToColdDays: number;
  coldToGlacierYears: number;
  enableAutoPromotion: boolean;
  enableAutoArchival: boolean;
}

interface PromotionResult {
  promoted: number;
  errors: number;
  details?: string[];
}

// Interface matching @radiant/shared IUDSTierService (with compatible result types)
interface IUDSTierService {
  getHealth(tenantId: string): Promise<UDSTierHealth[]>;
  promoteHotToWarm(tenantId: string): Promise<PromotionResult>;
  archiveWarmToCold(tenantId: string): Promise<PromotionResult>;
  retrieveColdToWarm(tenantId: string, resourceIds: string[]): Promise<PromotionResult>;
  getMetrics(tenantId: string, period: 'hour' | 'day' | 'week'): Promise<UDSDataFlowMetrics[]>;
}

// =============================================================================
// Service Implementation
// =============================================================================

class UDSTierCoordinatorService implements IUDSTierService {

  // ===========================================================================
  // Configuration
  // ===========================================================================

  /**
   * Get tier configuration for a tenant
   */
  async getConfig(tenantId: string): Promise<TierConfig> {
    const result = await executeStatement(
      `SELECT * FROM uds_config WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    );

    if (!result.rows?.length) {
      return {
        tenantId,
        hotToWarmHours: DEFAULT_HOT_TO_WARM_HOURS,
        warmToColdDays: DEFAULT_WARM_TO_COLD_DAYS,
        coldToGlacierYears: DEFAULT_COLD_TO_GLACIER_YEARS,
        enableAutoPromotion: true,
        enableAutoArchival: true,
      };
    }

    const row = result.rows[0];
    return {
      tenantId,
      hotToWarmHours: (row.hot_session_ttl_seconds as number) / 3600 || DEFAULT_HOT_TO_WARM_HOURS,
      warmToColdDays: row.warm_retention_days as number || DEFAULT_WARM_TO_COLD_DAYS,
      coldToGlacierYears: row.cold_retention_years as number || DEFAULT_COLD_TO_GLACIER_YEARS,
      enableAutoPromotion: row.hot_tier_enabled as boolean ?? true,
      enableAutoArchival: row.cold_tier_enabled as boolean ?? true,
    };
  }

  // ===========================================================================
  // Tier Health
  // ===========================================================================

  /**
   * Get health status of all tiers
   */
  async getHealth(tenantId: string): Promise<UDSTierHealth[]> {
    const tiers: UDSTier[] = ['hot', 'warm', 'cold', 'glacier'];
    const health: UDSTierHealth[] = [];

    for (const tier of tiers) {
      const tierHealth = await this.getTierHealth(tenantId, tier);
      health.push(tierHealth);
    }

    return health;
  }

  /**
   * Get health for a specific tier
   */
  private async getTierHealth(tenantId: string, tier: UDSTier): Promise<UDSTierHealth> {
    // Get counts and metrics
    const conversationCount = await this.getConversationCount(tenantId, tier);
    const messageCount = await this.getMessageCount(tenantId, tier);
    const uploadCount = await this.getUploadCount(tenantId, tier);

    // Get storage size estimate
    const storageBytes = await this.getStorageSize(tenantId, tier);

    // Check for alerts
    const alerts = await this.checkTierAlerts(tenantId, tier, {
      conversationCount,
      messageCount,
      uploadCount,
      storageBytes,
    });

    // Determine status
    const status = alerts.some(a => a.severity === 'critical') 
      ? 'critical' 
      : alerts.some(a => a.severity === 'warning')
        ? 'degraded'
        : 'healthy';

    return {
      tier,
      status,
      metrics: {
        itemCount: conversationCount + messageCount + uploadCount,
        storageBytes,
        cacheHitRate: tier === 'hot' ? await this.getCacheHitRate(tenantId) : undefined,
        latencyP99Ms: await this.getLatencyP99(tenantId, tier),
        errorRate: await this.getErrorRate(tenantId, tier),
      },
      alerts,
      lastChecked: new Date(),
    };
  }

  /**
   * Check for tier alerts
   */
  private async checkTierAlerts(
    tenantId: string,
    tier: UDSTier,
    metrics: {
      conversationCount: number;
      messageCount: number;
      uploadCount: number;
      storageBytes: number;
    }
  ): Promise<UDSTierAlert[]> {
    const alerts: UDSTierAlert[] = [];

    // Hot tier alerts
    if (tier === 'hot') {
      if (metrics.conversationCount > 10000) {
        alerts.push({
          id: crypto.randomUUID(),
          tier,
          severity: 'warning',
          metric: 'hot_conversation_count',
          threshold: 10000,
          currentValue: metrics.conversationCount,
          message: 'Hot tier has high conversation count - consider tuning TTL',
          triggeredAt: new Date(),
        });
      }
    }

    // Warm tier alerts
    if (tier === 'warm') {
      if (metrics.storageBytes > 100 * 1024 * 1024 * 1024) {  // 100GB
        alerts.push({
          id: crypto.randomUUID(),
          tier,
          severity: 'warning',
          metric: 'warm_storage_size',
          threshold: 100 * 1024 * 1024 * 1024,
          currentValue: metrics.storageBytes,
          message: 'Warm tier storage exceeds 100GB',
          triggeredAt: new Date(),
        });
      }
    }

    // Cold tier alerts
    if (tier === 'cold') {
      if (metrics.storageBytes > 1024 * 1024 * 1024 * 1024) {  // 1TB
        alerts.push({
          id: crypto.randomUUID(),
          tier,
          severity: 'info',
          metric: 'cold_storage_size',
          threshold: 1024 * 1024 * 1024 * 1024,
          currentValue: metrics.storageBytes,
          message: 'Cold tier storage exceeds 1TB - review retention policy',
          triggeredAt: new Date(),
        });
      }
    }

    return alerts;
  }

  // ===========================================================================
  // Tier Transitions
  // ===========================================================================

  /**
   * Promote data from Hot to Warm tier
   */
  async promoteHotToWarm(tenantId: string): Promise<PromotionResult> {
    logger.info('Starting Hot → Warm promotion', { tenantId });

    const config = await this.getConfig(tenantId);
    if (!config.enableAutoPromotion) {
      return { promoted: 0, errors: 0, details: ['Auto-promotion disabled'] };
    }

    let promoted = 0;
    let errors = 0;
    const details: string[] = [];

    // Promote conversations
    const conversations = await executeStatement(
      `SELECT id FROM uds_conversations
       WHERE tenant_id = $1 
       AND current_tier = 'hot'
       AND last_accessed_at < NOW() - INTERVAL '1 hour' * $2
       LIMIT $3`,
      [
        stringParam('tenantId', tenantId),
        stringParam('hours', String(config.hotToWarmHours)),
        stringParam('limit', String(BATCH_SIZE)),
      ]
    );

    for (const row of conversations.rows || []) {
      try {
        await this.transitionResource(tenantId, 'conversation', row.id as string, 'hot', 'warm', 'ttl_expiry');
        promoted++;
      } catch (error) {
        errors++;
        details.push(`Failed to promote conversation ${row.id}: ${error}`);
      }
    }

    // Promote messages
    const messages = await executeStatement(
      `SELECT m.id FROM uds_messages m
       JOIN uds_conversations c ON m.conversation_id = c.id
       WHERE m.tenant_id = $1 
       AND m.current_tier = 'hot'
       AND c.last_accessed_at < NOW() - INTERVAL '1 hour' * $2
       LIMIT $3`,
      [
        stringParam('tenantId', tenantId),
        stringParam('hours', String(config.hotToWarmHours)),
        stringParam('limit', String(BATCH_SIZE)),
      ]
    );

    for (const row of messages.rows || []) {
      try {
        await this.transitionResource(tenantId, 'message', row.id as string, 'hot', 'warm', 'ttl_expiry');
        promoted++;
      } catch (error) {
        errors++;
      }
    }

    // Record metrics
    await this.recordDataFlow(tenantId, 'hot_to_warm', promoted);

    logger.info('Hot → Warm promotion complete', { tenantId, promoted, errors });

    return { promoted, errors, details };
  }

  /**
   * Archive data from Warm to Cold tier
   */
  async archiveWarmToCold(tenantId: string): Promise<PromotionResult> {
    logger.info('Starting Warm → Cold archival', { tenantId });

    const config = await this.getConfig(tenantId);
    if (!config.enableAutoArchival) {
      return { promoted: 0, errors: 0, details: ['Auto-archival disabled'] };
    }

    let archived = 0;
    let errors = 0;
    const details: string[] = [];

    // Archive old conversations
    const conversations = await executeStatement(
      `SELECT id FROM uds_conversations
       WHERE tenant_id = $1 
       AND current_tier = 'warm'
       AND status = 'archived'
       AND last_accessed_at < NOW() - INTERVAL '1 day' * $2
       LIMIT $3`,
      [
        stringParam('tenantId', tenantId),
        stringParam('days', String(config.warmToColdDays)),
        stringParam('limit', String(BATCH_SIZE)),
      ]
    );

    for (const row of conversations.rows || []) {
      try {
        await this.transitionResource(tenantId, 'conversation', row.id as string, 'warm', 'cold', 'archival');
        archived++;
      } catch (error) {
        errors++;
        details.push(`Failed to archive conversation ${row.id}: ${error}`);
      }
    }

    // Archive uploads not accessed recently
    const uploads = await executeStatement(
      `SELECT id FROM uds_uploads
       WHERE tenant_id = $1 
       AND current_tier = 'warm'
       AND status = 'ready'
       AND last_accessed_at < NOW() - INTERVAL '1 day' * $2
       LIMIT $3`,
      [
        stringParam('tenantId', tenantId),
        stringParam('days', String(config.warmToColdDays)),
        stringParam('limit', String(BATCH_SIZE)),
      ]
    );

    for (const row of uploads.rows || []) {
      try {
        await this.transitionResource(tenantId, 'upload', row.id as string, 'warm', 'cold', 'archival');
        archived++;
      } catch (error) {
        errors++;
      }
    }

    // Record metrics
    await this.recordDataFlow(tenantId, 'warm_to_cold', archived);

    logger.info('Warm → Cold archival complete', { tenantId, archived, errors });

    return { promoted: archived, errors, details };
  }

  /**
   * Retrieve data from Cold to Warm tier
   */
  async retrieveColdToWarm(
    tenantId: string,
    resourceIds: string[]
  ): Promise<PromotionResult> {
    logger.info('Starting Cold → Warm retrieval', { tenantId, count: resourceIds.length });

    let retrieved = 0;
    let errors = 0;
    const details: string[] = [];

    for (const resourceId of resourceIds) {
      try {
        // Determine resource type
        const resourceType = await this.getResourceType(tenantId, resourceId);
        if (!resourceType) {
          errors++;
          details.push(`Resource ${resourceId} not found`);
          continue;
        }

        await this.transitionResource(tenantId, resourceType, resourceId, 'cold', 'warm', 'manual');
        retrieved++;
      } catch (error) {
        errors++;
        details.push(`Failed to retrieve ${resourceId}: ${error}`);
      }
    }

    // Record metrics
    await this.recordDataFlow(tenantId, 'cold_to_warm', retrieved);

    logger.info('Cold → Warm retrieval complete', { tenantId, retrieved, errors });

    return { promoted: retrieved, errors, details };
  }

  /**
   * Transition a resource between tiers
   */
  private async transitionResource(
    tenantId: string,
    resourceType: 'conversation' | 'message' | 'upload',
    resourceId: string,
    fromTier: UDSTier,
    toTier: UDSTier,
    reason: string
  ): Promise<void> {
    const table = resourceType === 'conversation' 
      ? 'uds_conversations'
      : resourceType === 'message'
        ? 'uds_messages'
        : 'uds_uploads';

    // Get current size for metrics
    const sizeResult = await executeStatement(
      resourceType === 'upload'
        ? `SELECT file_size_bytes as size FROM ${table} WHERE id = $1`
        : `SELECT 0 as size FROM ${table} WHERE id = $1`,
      [stringParam('id', resourceId)]
    );
    const sizeBytes = parseInt(sizeResult.rows?.[0]?.size as string) || 0;

    const startTime = Date.now();

    // Update tier
    await executeStatement(
      `UPDATE ${table} 
       SET current_tier = $2,
           ${toTier === 'warm' ? 'promoted_to_warm_at = CURRENT_TIMESTAMP,' : ''}
           ${toTier === 'cold' || toTier === 'glacier' ? 'archived_to_cold_at = CURRENT_TIMESTAMP,' : ''}
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $3`,
      [
        stringParam('id', resourceId),
        stringParam('tier', toTier),
        stringParam('tenantId', tenantId),
      ]
    );

    const durationMs = Date.now() - startTime;

    // Record transition
    await executeStatement(
      `INSERT INTO uds_tier_transitions (tenant_id, resource_type, resource_id, from_tier, to_tier, transition_reason, size_bytes, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        stringParam('tenantId', tenantId),
        stringParam('resourceType', resourceType),
        stringParam('resourceId', resourceId),
        stringParam('fromTier', fromTier),
        stringParam('toTier', toTier),
        stringParam('reason', reason),
        stringParam('sizeBytes', String(sizeBytes)),
        stringParam('durationMs', String(durationMs)),
      ]
    );

    // Audit log
    await udsAuditService.log(tenantId, null, {
      eventType: 'tier_transition',
      eventCategory: 'system',
      resourceType,
      resourceId,
      action: 'tier_transition',
      actionDetails: { fromTier, toTier, reason, durationMs },
    });
  }

  // ===========================================================================
  // Metrics
  // ===========================================================================

  /**
   * Get data flow metrics
   */
  async getMetrics(
    tenantId: string,
    period: 'hour' | 'day' | 'week' = 'day'
  ): Promise<UDSDataFlowMetrics[]> {
    const result = await executeStatement(
      `SELECT * FROM uds_data_flow_metrics 
       WHERE tenant_id = $1 AND period = $2
       ORDER BY period_start DESC
       LIMIT 24`,
      [
        stringParam('tenantId', tenantId),
        stringParam('period', period),
      ]
    );

    return (result.rows || []).map(row => this.mapMetricsRow(row));
  }

  /**
   * Record data flow metrics
   */
  private async recordDataFlow(
    tenantId: string,
    flowType: 'hot_to_warm' | 'warm_to_cold' | 'cold_to_warm',
    count: number
  ): Promise<void> {
    const periodStart = new Date();
    periodStart.setMinutes(0, 0, 0);

    const column = flowType === 'hot_to_warm'
      ? 'hot_to_warm_count'
      : flowType === 'warm_to_cold'
        ? 'warm_to_cold_count'
        : 'cold_to_warm_count';

    await executeStatement(
      `INSERT INTO uds_data_flow_metrics (tenant_id, period, period_start, ${column})
       VALUES ($1, 'hour', $2, $3)
       ON CONFLICT (tenant_id, period, period_start)
       DO UPDATE SET ${column} = uds_data_flow_metrics.${column} + $3`,
      [
        stringParam('tenantId', tenantId),
        stringParam('periodStart', periodStart.toISOString()),
        stringParam('count', String(count)),
      ]
    );
  }

  /**
   * Update tier counts in metrics
   */
  async updateTierCounts(tenantId: string): Promise<void> {
    const periodStart = new Date();
    periodStart.setMinutes(0, 0, 0);

    // Get counts for each tier
    const counts = {
      hot: { conversations: 0, messages: 0 },
      warm: { conversations: 0, messages: 0 },
      cold: { conversations: 0, retrieval: 0 },
    };

    for (const tier of ['hot', 'warm', 'cold'] as const) {
      counts[tier].conversations = await this.getConversationCount(tenantId, tier);
      if (tier !== 'cold') {
        counts[tier].messages = await this.getMessageCount(tenantId, tier);
      }
    }

    await executeStatement(
      `INSERT INTO uds_data_flow_metrics (
        tenant_id, period, period_start,
        hot_conversations_count, hot_messages_count,
        warm_conversations_count, warm_messages_count,
        cold_conversations_count
      ) VALUES ($1, 'hour', $2, $3, $4, $5, $6, $7)
       ON CONFLICT (tenant_id, period, period_start)
       DO UPDATE SET 
         hot_conversations_count = $3,
         hot_messages_count = $4,
         warm_conversations_count = $5,
         warm_messages_count = $6,
         cold_conversations_count = $7`,
      [
        stringParam('tenantId', tenantId),
        stringParam('periodStart', periodStart.toISOString()),
        stringParam('hotConv', String(counts.hot.conversations)),
        stringParam('hotMsg', String(counts.hot.messages)),
        stringParam('warmConv', String(counts.warm.conversations)),
        stringParam('warmMsg', String(counts.warm.messages)),
        stringParam('coldConv', String(counts.cold.conversations)),
      ]
    );
  }

  // ===========================================================================
  // Housekeeping
  // ===========================================================================

  /**
   * Run all housekeeping tasks
   */
  async runHousekeeping(tenantId: string): Promise<void> {
    logger.info('Running UDS housekeeping', { tenantId });

    // Update tier counts
    await this.updateTierCounts(tenantId);

    // Promote hot to warm
    await this.promoteHotToWarm(tenantId);

    // Archive warm to cold
    await this.archiveWarmToCold(tenantId);

    // Clean up deleted items
    await this.cleanupDeleted(tenantId);

    logger.info('UDS housekeeping complete', { tenantId });
  }

  /**
   * Clean up soft-deleted items past retention
   */
  private async cleanupDeleted(tenantId: string): Promise<void> {
    // Delete conversations marked as deleted for 30+ days
    await executeStatement(
      `DELETE FROM uds_conversations 
       WHERE tenant_id = $1 
       AND status = 'deleted' 
       AND deleted_at < NOW() - INTERVAL '30 days'`,
      [stringParam('tenantId', tenantId)]
    );

    // Delete uploads marked as deleted for 30+ days
    await executeStatement(
      `DELETE FROM uds_uploads 
       WHERE tenant_id = $1 
       AND status = 'deleted' 
       AND deleted_at < NOW() - INTERVAL '30 days'`,
      [stringParam('tenantId', tenantId)]
    );
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private async getConversationCount(tenantId: string, tier: UDSTier): Promise<number> {
    const result = await executeStatement(
      `SELECT COUNT(*) as count FROM uds_conversations 
       WHERE tenant_id = $1 AND current_tier = $2 AND status != 'deleted'`,
      [stringParam('tenantId', tenantId), stringParam('tier', tier)]
    );
    return parseInt(result.rows?.[0]?.count as string) || 0;
  }

  private async getMessageCount(tenantId: string, tier: UDSTier): Promise<number> {
    const result = await executeStatement(
      `SELECT COUNT(*) as count FROM uds_messages 
       WHERE tenant_id = $1 AND current_tier = $2`,
      [stringParam('tenantId', tenantId), stringParam('tier', tier)]
    );
    return parseInt(result.rows?.[0]?.count as string) || 0;
  }

  private async getUploadCount(tenantId: string, tier: UDSTier): Promise<number> {
    const result = await executeStatement(
      `SELECT COUNT(*) as count FROM uds_uploads 
       WHERE tenant_id = $1 AND current_tier = $2 AND status != 'deleted'`,
      [stringParam('tenantId', tenantId), stringParam('tier', tier)]
    );
    return parseInt(result.rows?.[0]?.count as string) || 0;
  }

  private async getStorageSize(tenantId: string, tier: UDSTier): Promise<number> {
    const result = await executeStatement(
      `SELECT COALESCE(SUM(file_size_bytes), 0) as size FROM uds_uploads 
       WHERE tenant_id = $1 AND current_tier = $2 AND status != 'deleted'`,
      [stringParam('tenantId', tenantId), stringParam('tier', tier)]
    );
    return parseInt(result.rows?.[0]?.size as string) || 0;
  }

  private async getCacheHitRate(tenantId: string): Promise<number> {
    const result = await executeStatement(
      `SELECT 
         CASE WHEN (hot_cache_hits + hot_cache_misses) > 0 
         THEN hot_cache_hits::FLOAT / (hot_cache_hits + hot_cache_misses) 
         ELSE 0 END as hit_rate
       FROM uds_data_flow_metrics 
       WHERE tenant_id = $1 AND period = 'hour'
       ORDER BY period_start DESC LIMIT 1`,
      [stringParam('tenantId', tenantId)]
    );
    return parseFloat(result.rows?.[0]?.hit_rate as string) || 0;
  }

  private async getLatencyP99(tenantId: string, tier: UDSTier): Promise<number | undefined> {
    const column = tier === 'warm' ? 'warm_query_latency_p99_ms' : 'cold_retrieval_latency_p99_ms';
    const result = await executeStatement(
      `SELECT ${column} as latency FROM uds_data_flow_metrics 
       WHERE tenant_id = $1 AND period = 'hour'
       ORDER BY period_start DESC LIMIT 1`,
      [stringParam('tenantId', tenantId)]
    );
    return result.rows?.[0]?.latency as number | undefined;
  }

  private async getErrorRate(tenantId: string, tier: UDSTier): Promise<number> {
    const result = await executeStatement(
      `SELECT 
         COUNT(*) FILTER (WHERE success = false) as errors,
         COUNT(*) as total
       FROM uds_tier_transitions
       WHERE tenant_id = $1 AND target_tier = $2 AND created_at > NOW() - INTERVAL '1 hour'`,
      [stringParam('tenantId', tenantId), stringParam('tier', tier)]
    );
    const errors = Number(result.rows?.[0]?.errors || 0);
    const total = Number(result.rows?.[0]?.total || 0);
    return total > 0 ? errors / total : 0;
  }

  private async getResourceType(
    tenantId: string,
    resourceId: string
  ): Promise<'conversation' | 'message' | 'upload' | null> {
    // Check conversations
    const convResult = await executeStatement(
      `SELECT id FROM uds_conversations WHERE id = $1 AND tenant_id = $2`,
      [stringParam('id', resourceId), stringParam('tenantId', tenantId)]
    );
    if (convResult.rows?.length) return 'conversation';

    // Check messages
    const msgResult = await executeStatement(
      `SELECT id FROM uds_messages WHERE id = $1 AND tenant_id = $2`,
      [stringParam('id', resourceId), stringParam('tenantId', tenantId)]
    );
    if (msgResult.rows?.length) return 'message';

    // Check uploads
    const uploadResult = await executeStatement(
      `SELECT id FROM uds_uploads WHERE id = $1 AND tenant_id = $2`,
      [stringParam('id', resourceId), stringParam('tenantId', tenantId)]
    );
    if (uploadResult.rows?.length) return 'upload';

    return null;
  }

  private mapMetricsRow(row: Record<string, unknown>): UDSDataFlowMetrics {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      period: row.period as 'hour' | 'day' | 'week',
      periodStart: new Date(row.period_start as string),
      hotConversationsCount: (row.hot_conversations_count as number) || 0,
      hotMessagesCount: (row.hot_messages_count as number) || 0,
      hotCacheHits: (row.hot_cache_hits as number) || 0,
      hotCacheMisses: (row.hot_cache_misses as number) || 0,
      warmConversationsCount: (row.warm_conversations_count as number) || 0,
      warmMessagesCount: (row.warm_messages_count as number) || 0,
      warmQueryCount: (row.warm_query_count as number) || 0,
      warmQueryLatencyP99Ms: row.warm_query_latency_p99_ms as number | undefined,
      coldConversationsCount: (row.cold_conversations_count as number) || 0,
      coldRetrievalCount: (row.cold_retrieval_count as number) || 0,
      coldRetrievalLatencyP99Ms: row.cold_retrieval_latency_p99_ms as number | undefined,
      hotToWarmCount: (row.hot_to_warm_count as number) || 0,
      warmToColdCount: (row.warm_to_cold_count as number) || 0,
      coldToWarmCount: (row.cold_to_warm_count as number) || 0,
      totalStorageBytes: parseInt(row.total_storage_bytes as string) || 0,
      hotStorageBytes: parseInt(row.hot_storage_bytes as string) || 0,
      warmStorageBytes: parseInt(row.warm_storage_bytes as string) || 0,
      coldStorageBytes: parseInt(row.cold_storage_bytes as string) || 0,
      createdAt: new Date(row.created_at as string),
    };
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const udsTierCoordinatorService = new UDSTierCoordinatorService();
