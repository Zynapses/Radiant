/**
 * UDS Message Service
 * Manages message lifecycle with encryption and streaming support
 * 
 * Supports:
 * - Encrypted message storage
 * - Streaming responses
 * - Checkpoints for Time Machine
 * - Attachments
 * - Token tracking
 */

import { executeStatement, stringParam, boolParam } from '../../db/client';
// @ts-ignore - redis module may not exist in all environments
import { getRedisClient } from '../../db/redis';
import { enhancedLogger as logger } from '../../logging/enhanced-logger';
import { udsEncryptionService } from './encryption.service';
import { udsAuditService } from './audit.service';
import { udsConversationService } from './conversation.service';
import type {
  UDSMessage,
  UDSMessageCreate,
  UDSMessageUpdate,
  UDSMessageListOptions,
  UDSMessageAttachment,
  UDSMessageRole,
  UDSTier,
  IUDSMessageService,
} from '@radiant/shared';

// =============================================================================
// Service Implementation
// =============================================================================

class UDSMessageService implements IUDSMessageService {

  // ===========================================================================
  // CRUD Operations
  // ===========================================================================

  /**
   * Create a new message with encryption
   */
  async create(
    tenantId: string,
    userId: string,
    conversationId: string,
    data: UDSMessageCreate
  ): Promise<UDSMessage> {
    logger.debug('Creating message', { tenantId, conversationId, role: data.role });

    // Encrypt content
    const encrypted = await udsEncryptionService.encrypt(tenantId, data.content, userId);
    const contentHash = udsEncryptionService.calculateHash(data.content);

    // Get next sequence number
    const seqResult = await executeStatement(
      `SELECT COALESCE(MAX(sequence_number), 0) + 1 as next_seq 
       FROM uds_messages WHERE conversation_id = $1`,
      [stringParam('conversationId', conversationId)]
    );
    const sequenceNumber = seqResult.rows?.[0]?.next_seq as number || 1;

    // Encrypt tool arguments/result if present
    let toolArgsEncrypted: Buffer | null = null;
    let toolResultEncrypted: Buffer | null = null;

    if (data.toolArguments) {
      const toolArgsEnc = await udsEncryptionService.encrypt(
        tenantId, 
        JSON.stringify(data.toolArguments), 
        userId
      );
      toolArgsEncrypted = toolArgsEnc.encrypted;
    }

    if (data.toolResult) {
      const toolResultEnc = await udsEncryptionService.encrypt(
        tenantId,
        JSON.stringify(data.toolResult),
        userId
      );
      toolResultEncrypted = toolResultEnc.encrypted;
    }

    const result = await executeStatement(
      `INSERT INTO uds_messages (
        tenant_id, conversation_id, user_id, role,
        content_encrypted, content_iv, content_length, content_hash,
        tool_call_id, tool_name, tool_arguments_encrypted, tool_result_encrypted,
        model_id, sequence_number, is_checkpoint, checkpoint_name,
        attachment_ids
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        stringParam('tenantId', tenantId),
        stringParam('conversationId', conversationId),
        stringParam('userId', userId),
        stringParam('role', data.role),
        stringParam('contentEncrypted', encrypted.encrypted.toString('base64')),
        stringParam('contentIv', encrypted.iv.toString('base64')),
        stringParam('contentLength', String(data.content.length)),
        stringParam('contentHash', contentHash),
        stringParam('toolCallId', data.toolCallId || ''),
        stringParam('toolName', data.toolName || ''),
        stringParam('toolArgsEncrypted', toolArgsEncrypted?.toString('base64') || ''),
        stringParam('toolResultEncrypted', toolResultEncrypted?.toString('base64') || ''),
        stringParam('modelId', data.modelId || ''),
        stringParam('sequenceNumber', String(sequenceNumber)),
        boolParam('isCheckpoint', data.isCheckpoint || false),
        stringParam('checkpointName', data.checkpointName || ''),
        stringParam('attachmentIds', `{${(data.attachmentIds || []).join(',')}}`),
      ]
    );

    const message = await this.mapRow(result.rows[0], tenantId, userId);

    // Generate title if this is first user message
    if (data.role === 'user' && sequenceNumber <= 2) {
      await udsConversationService.generateTitle(tenantId, conversationId, data.content);
    }

    logger.debug('Message created', { tenantId, conversationId, messageId: message.id });

    return message;
  }

  /**
   * Get a message by ID
   */
  async get(
    tenantId: string,
    userId: string,
    messageId: string
  ): Promise<UDSMessage | null> {
    const result = await executeStatement(
      `SELECT m.*, c.user_id as conversation_user_id, c.shared_with_user_ids
       FROM uds_messages m
       JOIN uds_conversations c ON m.conversation_id = c.id
       WHERE m.id = $1 AND m.tenant_id = $2
       AND (c.user_id = $3 OR $3 = ANY(c.shared_with_user_ids))`,
      [
        stringParam('id', messageId),
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
      ]
    );

    if (!result.rows?.length) {
      return null;
    }

    return this.mapRow(result.rows[0], tenantId, userId);
  }

  /**
   * Update a message
   */
  async update(
    tenantId: string,
    userId: string,
    messageId: string,
    data: UDSMessageUpdate
  ): Promise<UDSMessage> {
    // Get existing message
    const existing = await this.get(tenantId, userId, messageId);
    if (!existing) {
      throw new Error('Message not found or access denied');
    }

    const updates: string[] = [];
    const params: ReturnType<typeof stringParam>[] = [
      stringParam('id', messageId),
      stringParam('tenantId', tenantId),
    ];
    let paramIndex = 3;

    // Handle content update (re-encrypt)
    if (data.content !== undefined) {
      const encrypted = await udsEncryptionService.encrypt(tenantId, data.content, userId);
      const contentHash = udsEncryptionService.calculateHash(data.content);

      // Store original if first edit
      if (!existing.isEdited) {
        const originalEncrypted = await executeStatement(
          `SELECT content_encrypted FROM uds_messages WHERE id = $1`,
          [stringParam('id', messageId)]
        );
        if (originalEncrypted.rows?.[0]) {
          updates.push(`original_content_encrypted = content_encrypted`);
        }
      }

      updates.push(`content_encrypted = $${paramIndex}`);
      params.push(stringParam('contentEncrypted', encrypted.encrypted.toString('base64')));
      paramIndex++;

      updates.push(`content_iv = $${paramIndex}`);
      params.push(stringParam('contentIv', encrypted.iv.toString('base64')));
      paramIndex++;

      updates.push(`content_length = $${paramIndex}`);
      params.push(stringParam('contentLength', String(data.content.length)));
      paramIndex++;

      updates.push(`content_hash = $${paramIndex}`);
      params.push(stringParam('contentHash', contentHash));
      paramIndex++;

      updates.push(`is_edited = true`);
      updates.push(`edited_at = CURRENT_TIMESTAMP`);
      updates.push(`edit_count = edit_count + 1`);
    }

    if (data.userRating !== undefined) {
      updates.push(`user_rating = $${paramIndex}`);
      params.push(stringParam('userRating', String(data.userRating)));
      paramIndex++;
    }

    if (data.userFeedback !== undefined) {
      updates.push(`user_feedback = $${paramIndex}`);
      params.push(stringParam('userFeedback', data.userFeedback));
      paramIndex++;
    }

    if (data.flagged !== undefined) {
      updates.push(`flagged = $${paramIndex}`);
      params.push(boolParam('flagged', data.flagged));
      paramIndex++;
    }

    if (data.flagReason !== undefined) {
      updates.push(`flag_reason = $${paramIndex}`);
      params.push(stringParam('flagReason', data.flagReason));
      paramIndex++;
    }

    if (data.isCheckpoint !== undefined) {
      updates.push(`is_checkpoint = $${paramIndex}`);
      params.push(boolParam('isCheckpoint', data.isCheckpoint));
      paramIndex++;
    }

    if (data.checkpointName !== undefined) {
      updates.push(`checkpoint_name = $${paramIndex}`);
      params.push(stringParam('checkpointName', data.checkpointName));
      paramIndex++;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    const result = await executeStatement(
      `UPDATE uds_messages 
       SET ${updates.join(', ')}
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      params
    );

    if (!result.rows?.length) {
      throw new Error('Failed to update message');
    }

    // Audit log
    await udsAuditService.log(tenantId, userId, {
      eventType: 'message_updated',
      eventCategory: 'message',
      resourceType: 'message',
      resourceId: messageId,
      action: 'update',
      actionDetails: {
        contentChanged: data.content !== undefined,
        rating: data.userRating,
        flagged: data.flagged,
      },
    });

    return this.mapRow(result.rows[0], tenantId, userId);
  }

  /**
   * Delete a message
   */
  async delete(
    tenantId: string,
    userId: string,
    messageId: string
  ): Promise<void> {
    // Verify access
    const existing = await this.get(tenantId, userId, messageId);
    if (!existing) {
      throw new Error('Message not found or access denied');
    }

    // Only allow deleting own messages or if admin
    if (existing.userId !== userId) {
      throw new Error('Can only delete own messages');
    }

    await executeStatement(
      `DELETE FROM uds_messages WHERE id = $1 AND tenant_id = $2`,
      [
        stringParam('id', messageId),
        stringParam('tenantId', tenantId),
      ]
    );

    // Audit log
    await udsAuditService.log(tenantId, userId, {
      eventType: 'message_deleted',
      eventCategory: 'message',
      resourceType: 'message',
      resourceId: messageId,
      action: 'delete',
    });

    logger.info('Message deleted', { tenantId, messageId });
  }

  /**
   * List messages in a conversation
   */
  async list(
    tenantId: string,
    userId: string,
    options: UDSMessageListOptions
  ): Promise<UDSMessage[]> {
    const {
      conversationId,
      fromSequenceNumber,
      toSequenceNumber,
      checkpointsOnly,
      limit = 100,
      offset = 0,
    } = options;

    // Verify conversation access
    const conversation = await udsConversationService.get(tenantId, userId, conversationId);
    if (!conversation) {
      throw new Error('Conversation not found or access denied');
    }

    const conditions: string[] = [
      'tenant_id = $1',
      'conversation_id = $2',
    ];
    const params: ReturnType<typeof stringParam>[] = [
      stringParam('tenantId', tenantId),
      stringParam('conversationId', conversationId),
    ];
    let paramIndex = 3;

    if (fromSequenceNumber !== undefined) {
      conditions.push(`sequence_number >= $${paramIndex}`);
      params.push(stringParam('fromSeq', String(fromSequenceNumber)));
      paramIndex++;
    }

    if (toSequenceNumber !== undefined) {
      conditions.push(`sequence_number <= $${paramIndex}`);
      params.push(stringParam('toSeq', String(toSequenceNumber)));
      paramIndex++;
    }

    if (checkpointsOnly) {
      conditions.push('is_checkpoint = true');
    }

    params.push(stringParam('limit', String(limit)));
    params.push(stringParam('offset', String(offset)));

    const result = await executeStatement(
      `SELECT * FROM uds_messages 
       WHERE ${conditions.join(' AND ')}
       ORDER BY sequence_number ASC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    // Decrypt all messages
    const messages: UDSMessage[] = [];
    for (const row of result.rows || []) {
      messages.push(await this.mapRow(row, tenantId, userId));
    }

    return messages;
  }

  // ===========================================================================
  // Checkpoint Operations
  // ===========================================================================

  /**
   * Create a checkpoint at a specific message
   */
  async createCheckpoint(
    tenantId: string,
    userId: string,
    messageId: string,
    name: string
  ): Promise<UDSMessage> {
    return this.update(tenantId, userId, messageId, {
      isCheckpoint: true,
      checkpointName: name,
    });
  }

  /**
   * Get all checkpoints in a conversation
   */
  async getCheckpoints(
    tenantId: string,
    userId: string,
    conversationId: string
  ): Promise<UDSMessage[]> {
    return this.list(tenantId, userId, {
      conversationId,
      checkpointsOnly: true,
    });
  }

  // ===========================================================================
  // Streaming Operations
  // ===========================================================================

  /**
   * Start streaming a message
   */
  async streamStart(
    tenantId: string,
    userId: string,
    conversationId: string,
    messageId: string
  ): Promise<void> {
    await executeStatement(
      `UPDATE uds_messages 
       SET is_streaming = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2 AND conversation_id = $3`,
      [
        stringParam('id', messageId),
        stringParam('tenantId', tenantId),
        stringParam('conversationId', conversationId),
      ]
    );
  }

  /**
   * Append content to a streaming message via Redis
   */
  async streamAppend(
    tenantId: string,
    userId: string,
    messageId: string,
    content: string
  ): Promise<void> {
    const streamKey = `uds:stream:${tenantId}:${messageId}`;
    
    try {
      const redis = await getRedisClient();
      
      // Append to the stream content and update metadata
      await redis.append(streamKey, content);
      await redis.hset(`uds:stream:meta:${tenantId}:${messageId}`, {
        lastAppend: Date.now().toString(),
        totalLength: (await redis.strlen(streamKey)).toString(),
      });
      
      // Set TTL to auto-cleanup after 1 hour if not completed
      await redis.expire(streamKey, 3600);
      await redis.expire(`uds:stream:meta:${tenantId}:${messageId}`, 3600);
      
      // Publish to channel for real-time subscribers
      await redis.publish(`uds:stream:channel:${tenantId}:${messageId}`, content);
      
      logger.debug('Stream append', { tenantId, messageId, contentLength: content.length });
    } catch (error) {
      logger.warn('Failed to append to Redis stream, content will be in final message', { 
        tenantId, messageId, error 
      });
    }
  }

  /**
   * Complete a streaming message
   */
  async streamComplete(
    tenantId: string,
    userId: string,
    messageId: string,
    finalContent: string,
    tokens: { input: number; output: number }
  ): Promise<UDSMessage> {
    // Encrypt final content
    const encrypted = await udsEncryptionService.encrypt(tenantId, finalContent, userId);
    const contentHash = udsEncryptionService.calculateHash(finalContent);

    const result = await executeStatement(
      `UPDATE uds_messages 
       SET content_encrypted = $3,
           content_iv = $4,
           content_length = $5,
           content_hash = $6,
           input_tokens = $7,
           output_tokens = $8,
           is_streaming = false,
           stream_completed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [
        stringParam('id', messageId),
        stringParam('tenantId', tenantId),
        stringParam('contentEncrypted', encrypted.encrypted.toString('base64')),
        stringParam('contentIv', encrypted.iv.toString('base64')),
        stringParam('contentLength', String(finalContent.length)),
        stringParam('contentHash', contentHash),
        stringParam('inputTokens', String(tokens.input)),
        stringParam('outputTokens', String(tokens.output)),
      ]
    );

    if (!result.rows?.length) {
      throw new Error('Message not found');
    }

    return this.mapRow(result.rows[0], tenantId, userId);
  }

  // ===========================================================================
  // Token & Cost Tracking
  // ===========================================================================

  /**
   * Update token counts and cost for a message
   */
  async updateTokens(
    tenantId: string,
    messageId: string,
    inputTokens: number,
    outputTokens: number,
    costCredits: number,
    modelId?: string,
    modelResponseId?: string,
    finishReason?: string
  ): Promise<void> {
    await executeStatement(
      `UPDATE uds_messages 
       SET input_tokens = $3,
           output_tokens = $4,
           cost_credits = $5,
           model_id = COALESCE($6, model_id),
           model_response_id = $7,
           finish_reason = $8,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2`,
      [
        stringParam('id', messageId),
        stringParam('tenantId', tenantId),
        stringParam('inputTokens', String(inputTokens)),
        stringParam('outputTokens', String(outputTokens)),
        stringParam('costCredits', String(costCredits)),
        stringParam('modelId', modelId || ''),
        stringParam('modelResponseId', modelResponseId || ''),
        stringParam('finishReason', finishReason || ''),
      ]
    );
  }

  // ===========================================================================
  // Attachment Operations
  // ===========================================================================

  /**
   * Add an attachment to a message
   */
  async addAttachment(
    tenantId: string,
    messageId: string,
    attachment: {
      attachmentType: 'code' | 'image' | 'file' | 'link';
      contentType: string;
      mimeType?: string;
      language?: string;
      filename?: string;
      content?: string;
      uploadId?: string;
      altText?: string;
      caption?: string;
    }
  ): Promise<UDSMessageAttachment> {
    // Encrypt content if present
    let contentEncrypted: Buffer | null = null;
    let contentIv: Buffer | null = null;
    let contentSize: number | null = null;

    if (attachment.content) {
      const encrypted = await udsEncryptionService.encrypt(tenantId, attachment.content);
      contentEncrypted = encrypted.encrypted;
      contentIv = encrypted.iv;
      contentSize = attachment.content.length;
    }

    // Get next display order
    const orderResult = await executeStatement(
      `SELECT COALESCE(MAX(display_order), -1) + 1 as next_order 
       FROM uds_message_attachments WHERE message_id = $1`,
      [stringParam('messageId', messageId)]
    );
    const displayOrder = orderResult.rows?.[0]?.next_order as number || 0;

    const result = await executeStatement(
      `INSERT INTO uds_message_attachments (
        tenant_id, message_id, attachment_type, content_type, mime_type,
        language, filename, content_encrypted, content_iv, content_size,
        upload_id, display_order, alt_text, caption
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        stringParam('tenantId', tenantId),
        stringParam('messageId', messageId),
        stringParam('attachmentType', attachment.attachmentType),
        stringParam('contentType', attachment.contentType),
        stringParam('mimeType', attachment.mimeType || ''),
        stringParam('language', attachment.language || ''),
        stringParam('filename', attachment.filename || ''),
        stringParam('contentEncrypted', contentEncrypted?.toString('base64') || ''),
        stringParam('contentIv', contentIv?.toString('base64') || ''),
        stringParam('contentSize', contentSize?.toString() || ''),
        stringParam('uploadId', attachment.uploadId || ''),
        stringParam('displayOrder', String(displayOrder)),
        stringParam('altText', attachment.altText || ''),
        stringParam('caption', attachment.caption || ''),
      ]
    );

    // Update message attachment_ids array
    await executeStatement(
      `UPDATE uds_messages 
       SET attachment_ids = array_append(attachment_ids, $2)
       WHERE id = $1`,
      [
        stringParam('messageId', messageId),
        stringParam('attachmentId', result.rows[0].id as string),
      ]
    );

    return this.mapAttachmentRow(result.rows[0], tenantId);
  }

  /**
   * Get attachments for a message
   */
  async getAttachments(
    tenantId: string,
    messageId: string
  ): Promise<UDSMessageAttachment[]> {
    const result = await executeStatement(
      `SELECT * FROM uds_message_attachments 
       WHERE message_id = $1 AND tenant_id = $2
       ORDER BY display_order ASC`,
      [
        stringParam('messageId', messageId),
        stringParam('tenantId', tenantId),
      ]
    );

    const attachments: UDSMessageAttachment[] = [];
    for (const row of result.rows || []) {
      attachments.push(await this.mapAttachmentRow(row, tenantId));
    }

    return attachments;
  }

  // ===========================================================================
  // Search
  // ===========================================================================

  /**
   * Search messages by content hash (for deduplication)
   */
  async findByContentHash(
    tenantId: string,
    conversationId: string,
    contentHash: string
  ): Promise<UDSMessage | null> {
    const result = await executeStatement(
      `SELECT * FROM uds_messages 
       WHERE tenant_id = $1 AND conversation_id = $2 AND content_hash = $3
       LIMIT 1`,
      [
        stringParam('tenantId', tenantId),
        stringParam('conversationId', conversationId),
        stringParam('contentHash', contentHash),
      ]
    );

    if (!result.rows?.length) {
      return null;
    }

    // Get userId from conversation for decryption
    const convResult = await executeStatement(
      `SELECT user_id FROM uds_conversations WHERE id = $1`,
      [stringParam('id', conversationId)]
    );
    const userId = convResult.rows?.[0]?.user_id as string;

    return this.mapRow(result.rows[0], tenantId, userId);
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  /**
   * Map database row to UDSMessage with decryption
   */
  private async mapRow(
    row: Record<string, unknown>,
    tenantId: string,
    userId: string
  ): Promise<UDSMessage> {
    // Decrypt content
    let content = '';
    if (row.content_encrypted && row.content_iv) {
      const encryptedBuffer = Buffer.from(row.content_encrypted as string, 'base64');
      const ivBuffer = Buffer.from(row.content_iv as string, 'base64');
      content = await udsEncryptionService.decrypt(tenantId, encryptedBuffer, ivBuffer, userId);
    }

    // Decrypt tool arguments if present
    let toolArguments: Record<string, unknown> | undefined;
    if (row.tool_arguments_encrypted) {
      const encryptedBuffer = Buffer.from(row.tool_arguments_encrypted as string, 'base64');
      const ivBuffer = Buffer.from(row.content_iv as string, 'base64'); // Uses same IV
      const decrypted = await udsEncryptionService.decrypt(tenantId, encryptedBuffer, ivBuffer, userId);
      toolArguments = JSON.parse(decrypted);
    }

    // Decrypt tool result if present
    let toolResult: unknown;
    if (row.tool_result_encrypted) {
      const encryptedBuffer = Buffer.from(row.tool_result_encrypted as string, 'base64');
      const ivBuffer = Buffer.from(row.content_iv as string, 'base64');
      const decrypted = await udsEncryptionService.decrypt(tenantId, encryptedBuffer, ivBuffer, userId);
      toolResult = JSON.parse(decrypted);
    }

    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      conversationId: row.conversation_id as string,
      userId: row.user_id as string,
      role: row.role as UDSMessageRole,
      content,
      contentLength: row.content_length as number,
      toolCallId: row.tool_call_id as string | undefined,
      toolName: row.tool_name as string | undefined,
      toolArguments,
      toolResult,
      inputTokens: row.input_tokens as number | undefined,
      outputTokens: row.output_tokens as number | undefined,
      costCredits: row.cost_credits ? parseFloat(row.cost_credits as string) : undefined,
      modelId: row.model_id as string | undefined,
      modelResponseId: row.model_response_id as string | undefined,
      finishReason: row.finish_reason as string | undefined,
      attachmentIds: (row.attachment_ids as string[]) || [],
      sequenceNumber: row.sequence_number as number,
      isCheckpoint: row.is_checkpoint as boolean,
      checkpointName: row.checkpoint_name as string | undefined,
      isEdited: row.is_edited as boolean,
      editedAt: row.edited_at ? new Date(row.edited_at as string) : undefined,
      editCount: row.edit_count as number,
      userRating: row.user_rating as number | undefined,
      userFeedback: row.user_feedback as string | undefined,
      flagged: row.flagged as boolean,
      flagReason: row.flag_reason as string | undefined,
      isStreaming: row.is_streaming as boolean,
      streamCompletedAt: row.stream_completed_at ? new Date(row.stream_completed_at as string) : undefined,
      currentTier: row.current_tier as UDSTier,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  /**
   * Map attachment row with decryption
   */
  private async mapAttachmentRow(
    row: Record<string, unknown>,
    tenantId: string
  ): Promise<UDSMessageAttachment> {
    // Decrypt content if present
    let content: string | undefined;
    if (row.content_encrypted && row.content_iv) {
      const encryptedBuffer = Buffer.from(row.content_encrypted as string, 'base64');
      const ivBuffer = Buffer.from(row.content_iv as string, 'base64');
      content = await udsEncryptionService.decrypt(tenantId, encryptedBuffer, ivBuffer);
    }

    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      messageId: row.message_id as string,
      attachmentType: row.attachment_type as 'code' | 'image' | 'file' | 'link',
      contentType: row.content_type as any,
      mimeType: row.mime_type as string | undefined,
      language: row.language as string | undefined,
      filename: row.filename as string | undefined,
      content,
      contentSize: row.content_size as number | undefined,
      uploadId: row.upload_id as string | undefined,
      displayOrder: row.display_order as number,
      altText: row.alt_text as string | undefined,
      caption: row.caption as string | undefined,
      createdAt: new Date(row.created_at as string),
    };
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const udsMessageService = new UDSMessageService();
