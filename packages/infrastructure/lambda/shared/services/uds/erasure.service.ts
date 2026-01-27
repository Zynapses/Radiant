/**
 * UDS GDPR Erasure Service
 * Handles right-to-be-forgotten requests across all tiers
 * 
 * Compliance:
 * - GDPR Article 17 (Right to Erasure)
 * - CCPA (Right to Delete)
 * - HIPAA (with appropriate safeguards)
 * 
 * Features:
 * - Multi-tier erasure (Hot → Warm → Cold → Glacier)
 * - Verification hash for audit trail
 * - Optional anonymization for statistical retention
 * - Backup erasure scheduling
 */

import { S3Client, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { DynamoDBClient, DeleteItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { createHash } from 'crypto';
import Redis from 'ioredis';
import { executeStatement, stringParam, boolParam } from '../../db/client';
import { enhancedLogger as logger } from '../../logging/enhanced-logger';
import { udsAuditService } from './audit.service';
import type {
  UDSErasureRequest,
  UDSErasureRequestCreate,
  UDSErasureStatus,
  UDSErasureScope,
  IUDSErasureService,
} from '@radiant/shared';

// Redis client for cache clearing during erasure
let redisClient: Redis | null = null;

async function getRedisClient(): Promise<Redis | null> {
  if (!redisClient && process.env.REDIS_ENDPOINT) {
    try {
      redisClient = new Redis(process.env.REDIS_ENDPOINT, {
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        lazyConnect: true,
      });
      await redisClient.connect();
    } catch (error) {
      logger.warn('Failed to connect to Redis for UDS erasure', { error });
      return null;
    }
  }
  return redisClient;
}

// =============================================================================
// Constants
// =============================================================================

const BATCH_SIZE = 100;
const ANONYMIZATION_PLACEHOLDER = '[REDACTED]';

// =============================================================================
// Service Implementation
// =============================================================================

class UDSErasureService implements IUDSErasureService {
  private s3Client: S3Client;
  private uploadBucket: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    this.uploadBucket = process.env.UDS_UPLOAD_BUCKET || 'radiant-uds-uploads';
  }

  // ===========================================================================
  // Request Management
  // ===========================================================================

  /**
   * Create an erasure request
   */
  async request(
    tenantId: string,
    requestedByUserId: string,
    data: UDSErasureRequestCreate
  ): Promise<UDSErasureRequest> {
    logger.info('Creating erasure request', { 
      tenantId, 
      scope: data.scope, 
      userId: data.userId 
    });

    // Validate scope
    if (data.scope === 'user' && !data.userId) {
      throw new Error('User ID required for user-scope erasure');
    }
    if (data.scope === 'conversation' && !data.conversationId) {
      throw new Error('Conversation ID required for conversation-scope erasure');
    }

    const result = await executeStatement(
      `INSERT INTO uds_erasure_requests (
        tenant_id, user_id, conversation_id, requested_by_user_id,
        scope, erase_conversations, erase_messages, erase_uploads,
        erase_audit_log, erase_from_backups, anonymize_remaining,
        legal_basis, legal_reference, scheduled_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        stringParam('tenantId', tenantId),
        stringParam('userId', data.userId || ''),
        stringParam('conversationId', data.conversationId || ''),
        stringParam('requestedByUserId', requestedByUserId),
        stringParam('scope', data.scope),
        boolParam('eraseConversations', data.eraseConversations ?? true),
        boolParam('eraseMessages', data.eraseMessages ?? true),
        boolParam('eraseUploads', data.eraseUploads ?? true),
        boolParam('eraseAuditLog', data.eraseAuditLog ?? false),
        boolParam('eraseFromBackups', data.eraseFromBackups ?? false),
        boolParam('anonymizeRemaining', data.anonymizeRemaining ?? true),
        stringParam('legalBasis', data.legalBasis || 'gdpr_article_17'),
        stringParam('legalReference', data.legalReference || ''),
        stringParam('scheduledAt', data.scheduledAt?.toISOString() || ''),
      ]
    );

    const request = this.mapRow(result.rows[0]);

    // Audit log
    await udsAuditService.log(tenantId, requestedByUserId, {
      eventType: 'erasure_requested',
      eventCategory: 'gdpr',
      resourceType: 'erasure_request',
      resourceId: request.id,
      action: 'create',
      actionDetails: {
        scope: data.scope,
        targetUserId: data.userId,
        targetConversationId: data.conversationId,
        legalBasis: data.legalBasis,
      },
    });

    // If not scheduled for later, process immediately
    if (!data.scheduledAt || data.scheduledAt <= new Date()) {
      // Process async
      this.process(request.id).catch(err => 
        logger.error('Erasure processing failed', { requestId: request.id, err })
      );
    }

    logger.info('Erasure request created', { requestId: request.id });

    return request;
  }

  /**
   * Get an erasure request
   */
  async get(tenantId: string, requestId: string): Promise<UDSErasureRequest | null> {
    const result = await executeStatement(
      `SELECT * FROM uds_erasure_requests WHERE id = $1 AND tenant_id = $2`,
      [
        stringParam('id', requestId),
        stringParam('tenantId', tenantId),
      ]
    );

    if (!result.rows?.length) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  /**
   * List erasure requests
   */
  async list(tenantId: string): Promise<UDSErasureRequest[]> {
    const result = await executeStatement(
      `SELECT * FROM uds_erasure_requests 
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [stringParam('tenantId', tenantId)]
    );

    return (result.rows || []).map(row => this.mapRow(row));
  }

  /**
   * Cancel a pending erasure request
   */
  async cancel(tenantId: string, requestId: string): Promise<void> {
    const request = await this.get(tenantId, requestId);
    if (!request) {
      throw new Error('Erasure request not found');
    }

    if (request.status !== 'pending') {
      throw new Error(`Cannot cancel request with status: ${request.status}`);
    }

    await executeStatement(
      `UPDATE uds_erasure_requests 
       SET status = 'failed', error_message = 'Cancelled by user', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2`,
      [
        stringParam('id', requestId),
        stringParam('tenantId', tenantId),
      ]
    );

    // Audit log
    await udsAuditService.log(tenantId, null, {
      eventType: 'erasure_cancelled',
      eventCategory: 'gdpr',
      resourceType: 'erasure_request',
      resourceId: requestId,
      action: 'cancel',
    });

    logger.info('Erasure request cancelled', { requestId });
  }

  // ===========================================================================
  // Processing
  // ===========================================================================

  /**
   * Process an erasure request
   */
  async process(requestId: string): Promise<void> {
    logger.info('Processing erasure request', { requestId });

    const result = await executeStatement(
      `SELECT * FROM uds_erasure_requests WHERE id = $1`,
      [stringParam('id', requestId)]
    );

    if (!result.rows?.length) {
      throw new Error('Erasure request not found');
    }

    const request = this.mapRow(result.rows[0]);
    const tenantId = request.tenantId;

    // Update status to processing
    await this.updateStatus(requestId, 'processing');
    await executeStatement(
      `UPDATE uds_erasure_requests SET started_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [stringParam('id', requestId)]
    );

    try {
      // Process each tier
      await this.processHotTier(requestId, request);
      await this.updateTierStatus(requestId, 'hot', 'completed');

      await this.processWarmTier(requestId, request);
      await this.updateTierStatus(requestId, 'warm', 'completed');

      await this.processColdTier(requestId, request);
      await this.updateTierStatus(requestId, 'cold', 'completed');

      // Handle backups if requested
      if (request.eraseFromBackups) {
        await this.scheduleBackupErasure(requestId, request);
        await this.updateTierStatus(requestId, 'backup', 'processing');
      } else {
        await this.updateTierStatus(requestId, 'backup', 'completed');
      }

      // Generate verification hash
      const verificationHash = await this.generateVerificationHash(request);

      // Mark as completed
      await executeStatement(
        `UPDATE uds_erasure_requests 
         SET status = 'completed', 
             completed_at = CURRENT_TIMESTAMP,
             verification_hash = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [
          stringParam('id', requestId),
          stringParam('hash', verificationHash),
        ]
      );

      // Audit log
      await udsAuditService.log(tenantId, null, {
        eventType: 'erasure_completed',
        eventCategory: 'gdpr',
        eventSeverity: 'info',
        resourceType: 'erasure_request',
        resourceId: requestId,
        action: 'complete',
        actionDetails: {
          conversationsDeleted: request.conversationsDeleted,
          messagesDeleted: request.messagesDeleted,
          uploadsDeleted: request.uploadsDeleted,
          bytesDeleted: request.bytesDeleted,
          verificationHash,
        },
      });

      logger.info('Erasure request completed', { requestId, verificationHash });

    } catch (error) {
      logger.error('Erasure request failed', { requestId, error });

      await executeStatement(
        `UPDATE uds_erasure_requests 
         SET status = 'failed', 
             error_message = $2,
             retry_count = retry_count + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [
          stringParam('id', requestId),
          stringParam('error', String(error)),
        ]
      );

      throw error;
    }
  }

  /**
   * Process Hot Tier erasure (Redis + DynamoDB caches)
   */
  private async processHotTier(
    requestId: string,
    request: UDSErasureRequest
  ): Promise<void> {
    logger.info('Processing Hot Tier erasure', { requestId });

    const dynamoClient = new DynamoDBClient({});
    const dynamoTable = process.env.UDS_HOT_TABLE || 'radiant-uds-hot';

    // Clear Redis cache for user/tenant data
    try {
      const redis = await getRedisClient();
      const cachePatterns = [
        `uds:conv:${request.tenantId}:${(request as any).targetUserId || '*'}:*`,
        `uds:msg:${request.tenantId}:${(request as any).targetUserId || '*'}:*`,
        `uds:session:${request.tenantId}:${(request as any).targetUserId || '*'}:*`,
      ];

      for (const pattern of cachePatterns) {
        const keys = await (redis as any).keys(pattern);
        if (keys.length > 0) {
          await (redis as any).del(...keys);
          logger.info('Cleared Redis cache keys', { pattern, count: keys.length });
        }
      }
    } catch (error) {
      logger.warn('Failed to clear Redis cache', { requestId, error });
    }

    // Clear DynamoDB hot tier data
    try {
      const queryCommand = new QueryCommand({
        TableName: dynamoTable,
        KeyConditionExpression: 'tenant_id = :tid',
        FilterExpression: (request as any).targetUserId ? 'user_id = :uid' : undefined,
        ExpressionAttributeValues: {
          ':tid': { S: request.tenantId },
          ...((request as any).targetUserId ? { ':uid': { S: (request as any).targetUserId } } : {}),
        },
      });

      const result = await dynamoClient.send(queryCommand);
      for (const item of result.Items || []) {
        await dynamoClient.send(new DeleteItemCommand({
          TableName: dynamoTable,
          Key: {
            tenant_id: item.tenant_id,
            id: item.id,
          },
        }));
      }
      logger.info('Cleared DynamoDB hot tier', { requestId, itemsDeleted: result.Items?.length || 0 });
    } catch (error) {
      logger.warn('Failed to clear DynamoDB cache', { requestId, error });
    }

    // Also process database hot tier records
    if (request.eraseConversations) {
      await this.eraseConversations(request, 'hot');
    }
  }

  /**
   * Process Warm Tier erasure
   */
  private async processWarmTier(
    requestId: string,
    request: UDSErasureRequest
  ): Promise<void> {
    logger.info('Processing Warm Tier erasure', { requestId });

    if (request.eraseConversations) {
      await this.eraseConversations(request, 'warm');
    }

    if (request.eraseMessages) {
      await this.eraseMessages(request);
    }

    if (request.eraseUploads) {
      await this.eraseUploads(request);
    }

    // Anonymize remaining data if requested
    if (request.anonymizeRemaining) {
      await this.anonymizeRemainingData(request);
    }
  }

  /**
   * Process Cold Tier erasure
   */
  private async processColdTier(
    requestId: string,
    request: UDSErasureRequest
  ): Promise<void> {
    logger.info('Processing Cold Tier erasure', { requestId });

    // Cold tier includes S3/Iceberg archived data
    if (request.eraseConversations) {
      await this.eraseConversations(request, 'cold');
      await this.eraseConversations(request, 'glacier');
    }

    // Erase archived uploads from S3
    if (request.eraseUploads) {
      await this.eraseArchivedUploads(request);
    }
  }

  // ===========================================================================
  // Erasure Operations
  // ===========================================================================

  /**
   * Erase conversations
   */
  private async eraseConversations(
    request: UDSErasureRequest,
    tier: string
  ): Promise<void> {
    const conditions: string[] = ['tenant_id = $1', 'current_tier = $2'];
    const params = [
      stringParam('tenantId', request.tenantId),
      stringParam('tier', tier),
    ];

    if (request.scope === 'user' && request.userId) {
      conditions.push('user_id = $3');
      params.push(stringParam('userId', request.userId));
    } else if (request.scope === 'conversation' && request.conversationId) {
      conditions.push('id = $3');
      params.push(stringParam('conversationId', request.conversationId));
    }

    // Get count first
    const countResult = await executeStatement(
      `SELECT COUNT(*) as count FROM uds_conversations WHERE ${conditions.join(' AND ')}`,
      params
    );
    const count = parseInt(countResult.rows?.[0]?.count as string) || 0;

    // Delete in batches
    let deleted = 0;
    while (deleted < count) {
      await executeStatement(
        `DELETE FROM uds_conversations 
         WHERE id IN (
           SELECT id FROM uds_conversations 
           WHERE ${conditions.join(' AND ')}
           LIMIT ${BATCH_SIZE}
         )`,
        params
      );
      deleted += BATCH_SIZE;
    }

    // Update progress
    await executeStatement(
      `UPDATE uds_erasure_requests 
       SET conversations_deleted = conversations_deleted + $2
       WHERE id = $1`,
      [
        stringParam('id', request.id),
        stringParam('count', String(count)),
      ]
    );
  }

  /**
   * Erase messages
   */
  private async eraseMessages(request: UDSErasureRequest): Promise<void> {
    const conditions: string[] = ['m.tenant_id = $1'];
    const params = [stringParam('tenantId', request.tenantId)];

    if (request.scope === 'user' && request.userId) {
      conditions.push('m.user_id = $2');
      params.push(stringParam('userId', request.userId));
    } else if (request.scope === 'conversation' && request.conversationId) {
      conditions.push('m.conversation_id = $2');
      params.push(stringParam('conversationId', request.conversationId));
    }

    // Get count
    const countResult = await executeStatement(
      `SELECT COUNT(*) as count FROM uds_messages m WHERE ${conditions.join(' AND ')}`,
      params
    );
    const count = parseInt(countResult.rows?.[0]?.count as string) || 0;

    // Delete attachments first
    await executeStatement(
      `DELETE FROM uds_message_attachments 
       WHERE message_id IN (
         SELECT m.id FROM uds_messages m WHERE ${conditions.join(' AND ')}
       )`,
      params
    );

    // Delete messages
    await executeStatement(
      `DELETE FROM uds_messages m WHERE ${conditions.join(' AND ')}`,
      params
    );

    // Update progress
    await executeStatement(
      `UPDATE uds_erasure_requests 
       SET messages_deleted = messages_deleted + $2
       WHERE id = $1`,
      [
        stringParam('id', request.id),
        stringParam('count', String(count)),
      ]
    );
  }

  /**
   * Erase uploads
   */
  private async eraseUploads(request: UDSErasureRequest): Promise<void> {
    const conditions: string[] = ['tenant_id = $1'];
    const params = [stringParam('tenantId', request.tenantId)];

    if (request.scope === 'user' && request.userId) {
      conditions.push('user_id = $2');
      params.push(stringParam('userId', request.userId));
    } else if (request.scope === 'conversation' && request.conversationId) {
      conditions.push('conversation_id = $2');
      params.push(stringParam('conversationId', request.conversationId));
    }

    // Get uploads to delete
    const uploads = await executeStatement(
      `SELECT id, storage_bucket, storage_key, thumbnail_key, file_size_bytes 
       FROM uds_uploads WHERE ${conditions.join(' AND ')}`,
      params
    );

    let bytesDeleted = 0;

    for (const upload of uploads.rows || []) {
      try {
        // Delete from S3
        await this.s3Client.send(new DeleteObjectCommand({
          Bucket: upload.storage_bucket as string,
          Key: upload.storage_key as string,
        }));

        // Delete thumbnail if exists
        if (upload.thumbnail_key) {
          await this.s3Client.send(new DeleteObjectCommand({
            Bucket: upload.storage_bucket as string,
            Key: upload.thumbnail_key as string,
          }));
        }

        bytesDeleted += parseInt(upload.file_size_bytes as string) || 0;
      } catch (error) {
        logger.warn('Failed to delete S3 object', { 
          uploadId: upload.id, 
          key: upload.storage_key,
          error 
        });
      }
    }

    // Delete from database
    await executeStatement(
      `DELETE FROM uds_uploads WHERE ${conditions.join(' AND ')}`,
      params
    );

    // Update progress
    await executeStatement(
      `UPDATE uds_erasure_requests 
       SET uploads_deleted = uploads_deleted + $2, bytes_deleted = bytes_deleted + $3
       WHERE id = $1`,
      [
        stringParam('id', request.id),
        stringParam('count', String(uploads.rows?.length || 0)),
        stringParam('bytes', String(bytesDeleted)),
      ]
    );
  }

  /**
   * Erase archived uploads from S3 (cold tier)
   */
  private async eraseArchivedUploads(request: UDSErasureRequest): Promise<void> {
    // List and delete all objects with the user's prefix
    const prefix = request.scope === 'user' && request.userId
      ? `${request.tenantId}/${request.userId}/`
      : `${request.tenantId}/`;

    let continuationToken: string | undefined;

    do {
      const listResult = await this.s3Client.send(new ListObjectsV2Command({
        Bucket: this.uploadBucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }));

      for (const object of listResult.Contents || []) {
        if (object.Key) {
          await this.s3Client.send(new DeleteObjectCommand({
            Bucket: this.uploadBucket,
            Key: object.Key,
          }));
        }
      }

      continuationToken = listResult.NextContinuationToken;
    } while (continuationToken);
  }

  /**
   * Anonymize remaining data (for statistical retention)
   */
  private async anonymizeRemainingData(request: UDSErasureRequest): Promise<void> {
    if (request.scope !== 'user' || !request.userId) {
      return;
    }

    // Anonymize user references in audit log (if not erasing audit)
    if (!request.eraseAuditLog) {
      await executeStatement(
        `UPDATE uds_audit_log 
         SET user_id = NULL,
             ip_address = NULL,
             user_agent = '${ANONYMIZATION_PLACEHOLDER}',
             metadata = jsonb_set(metadata, '{anonymized}', 'true')
         WHERE tenant_id = $1 AND user_id = $2`,
        [
          stringParam('tenantId', request.tenantId),
          stringParam('userId', request.userId),
        ]
      );
    }

    // Anonymize search index
    await executeStatement(
      `DELETE FROM uds_search_index WHERE tenant_id = $1 AND user_id = $2`,
      [
        stringParam('tenantId', request.tenantId),
        stringParam('userId', request.userId),
      ]
    );
  }

  /**
   * Schedule backup erasure (handled by separate process)
   */
  private async scheduleBackupErasure(
    requestId: string,
    request: UDSErasureRequest
  ): Promise<void> {
    const queueUrl = process.env.UDS_BACKUP_ERASURE_QUEUE_URL;

    if (!queueUrl) {
      logger.warn('Backup erasure queue not configured, marking as pending manual review', { requestId });
      await this.updateTierStatus(requestId, 'backup', 'pending');
      return;
    }

    try {
      const sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });

      // Queue backup erasure job
      await sqsClient.send(new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify({
          type: 'backup_erasure',
          requestId,
          tenantId: request.tenantId,
          userId: request.userId,
          scope: request.scope,
          requestedAt: new Date().toISOString(),
          tasks: [
            { action: 'identify_snapshots', status: 'pending' },
            { action: 'mark_exclusions', status: 'pending' },
            { action: 'verify_erasure', status: 'pending' },
          ],
        }),
        MessageAttributes: {
          tenantId: { DataType: 'String', StringValue: request.tenantId },
          requestId: { DataType: 'String', StringValue: requestId },
        },
      }));

      logger.info('Backup erasure job queued', { requestId, tenantId: request.tenantId });
      await this.updateTierStatus(requestId, 'backup', 'in_progress');

      // Record in database for tracking
      await executeStatement(
        `INSERT INTO uds_erasure_backup_jobs (request_id, tenant_id, user_id, status, queued_at)
         VALUES ($1, $2, $3, 'queued', CURRENT_TIMESTAMP)
         ON CONFLICT (request_id) DO UPDATE SET status = 'queued', queued_at = CURRENT_TIMESTAMP`,
        [
          stringParam('requestId', requestId),
          stringParam('tenantId', request.tenantId),
          stringParam('userId', request.userId),
        ]
      );
    } catch (error) {
      logger.error('Failed to queue backup erasure job', { requestId, error });
      await this.updateTierStatus(requestId, 'backup', 'failed');
      throw error;
    }
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  /**
   * Update overall status
   */
  private async updateStatus(requestId: string, status: UDSErasureStatus): Promise<void> {
    await executeStatement(
      `UPDATE uds_erasure_requests SET status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [
        stringParam('id', requestId),
        stringParam('status', status),
      ]
    );
  }

  /**
   * Update tier-specific status
   */
  private async updateTierStatus(
    requestId: string,
    tier: 'hot' | 'warm' | 'cold' | 'backup',
    status: UDSErasureStatus
  ): Promise<void> {
    const column = `${tier}_tier_status`;
    await executeStatement(
      `UPDATE uds_erasure_requests SET ${column} = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [
        stringParam('id', requestId),
        stringParam('status', status),
      ]
    );
  }

  /**
   * Generate verification hash for completed erasure
   */
  private async generateVerificationHash(request: UDSErasureRequest): Promise<string> {
    const data = [
      request.id,
      request.tenantId,
      request.userId || '',
      request.conversationId || '',
      request.scope,
      new Date().toISOString(),
      request.conversationsDeleted.toString(),
      request.messagesDeleted.toString(),
      request.uploadsDeleted.toString(),
      request.bytesDeleted.toString(),
    ].join('|');

    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Map database row to UDSErasureRequest
   */
  private mapRow(row: Record<string, unknown>): UDSErasureRequest {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      userId: row.user_id as string | undefined,
      conversationId: row.conversation_id as string | undefined,
      requestedByUserId: row.requested_by_user_id as string,
      scope: row.scope as UDSErasureScope,
      eraseConversations: row.erase_conversations as boolean,
      eraseMessages: row.erase_messages as boolean,
      eraseUploads: row.erase_uploads as boolean,
      eraseAuditLog: row.erase_audit_log as boolean,
      eraseFromBackups: row.erase_from_backups as boolean,
      anonymizeRemaining: row.anonymize_remaining as boolean,
      status: row.status as UDSErasureStatus,
      hotTierStatus: row.hot_tier_status as UDSErasureStatus,
      warmTierStatus: row.warm_tier_status as UDSErasureStatus,
      coldTierStatus: row.cold_tier_status as UDSErasureStatus,
      backupStatus: row.backup_status as UDSErasureStatus,
      conversationsDeleted: row.conversations_deleted as number,
      messagesDeleted: row.messages_deleted as number,
      uploadsDeleted: row.uploads_deleted as number,
      bytesDeleted: parseInt(row.bytes_deleted as string) || 0,
      verificationHash: row.verification_hash as string | undefined,
      legalBasis: row.legal_basis as string | undefined,
      legalReference: row.legal_reference as string | undefined,
      scheduledAt: row.scheduled_at ? new Date(row.scheduled_at as string) : undefined,
      startedAt: row.started_at ? new Date(row.started_at as string) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      errorMessage: row.error_message as string | undefined,
      retryCount: row.retry_count as number,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const udsErasureService = new UDSErasureService();
