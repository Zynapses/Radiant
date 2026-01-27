/**
 * UDS Conversation Service
 * Manages conversation lifecycle with tiered storage
 * 
 * Supports:
 * - CRUD operations with encryption
 * - Time Machine (forking, checkpoints)
 * - Collaboration (sharing)
 * - Tier transitions (hot → warm → cold)
 */

import { executeStatement, stringParam, boolParam } from '../../db/client';
import { enhancedLogger as logger } from '../../logging/enhanced-logger';
import { udsEncryptionService } from './encryption.service';
import { udsAuditService } from './audit.service';
import { modelRouterService } from '../model-router.service';
import type {
  UDSConversation,
  UDSConversationCreate,
  UDSConversationUpdate,
  UDSConversationListOptions,
  UDSConversationSearchResult,
  UDSConversationStatus,
  UDSTier,
  IUDSConversationService,
} from '@radiant/shared';

// =============================================================================
// Service Implementation
// =============================================================================

class UDSConversationService implements IUDSConversationService {
  
  // ===========================================================================
  // CRUD Operations
  // ===========================================================================

  /**
   * Create a new conversation
   */
  async create(
    tenantId: string,
    userId: string,
    data: UDSConversationCreate
  ): Promise<UDSConversation> {
    logger.info('Creating conversation', { tenantId, userId });

    // Get encryption key
    const encryptionKey = await udsEncryptionService.getKeyInfo(tenantId, userId);
    
    // Get next sequence number for fork
    let forkSequenceNumber: number | undefined;
    if (data.parentConversationId && data.forkPointMessageId) {
      const seqResult = await executeStatement(
        `SELECT sequence_number FROM uds_messages 
         WHERE conversation_id = $1 AND id = $2`,
        [
          stringParam('conversationId', data.parentConversationId),
          stringParam('messageId', data.forkPointMessageId),
        ]
      );
      if (seqResult.rows?.length) {
        forkSequenceNumber = seqResult.rows[0].sequence_number as number;
      }
    }

    const result = await executeStatement(
      `INSERT INTO uds_conversations (
        tenant_id, user_id, title, model_id, system_prompt_id, persona_id,
        temperature, max_tokens, tags, parent_conversation_id, 
        fork_point_message_id, fork_sequence_number, branch_name, encryption_key_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('title', data.title || ''),
        stringParam('modelId', data.modelId || ''),
        stringParam('systemPromptId', data.systemPromptId || ''),
        stringParam('personaId', data.personaId || ''),
        stringParam('temperature', data.temperature?.toString() || ''),
        stringParam('maxTokens', data.maxTokens?.toString() || ''),
        stringParam('tags', `{${(data.tags || []).join(',')}}`),
        stringParam('parentConversationId', data.parentConversationId || ''),
        stringParam('forkPointMessageId', data.forkPointMessageId || ''),
        stringParam('forkSequenceNumber', forkSequenceNumber?.toString() || ''),
        stringParam('branchName', data.branchName || ''),
        stringParam('encryptionKeyId', encryptionKey?.id || ''),
      ]
    );

    const conversation = this.mapRow(result.rows[0]);

    // Audit log
    await udsAuditService.log(tenantId, userId, {
      eventType: 'conversation_created',
      eventCategory: 'conversation',
      resourceType: 'conversation',
      resourceId: conversation.id,
      action: 'create',
      actionDetails: {
        title: data.title,
        modelId: data.modelId,
        isForked: !!data.parentConversationId,
      },
    });

    logger.info('Conversation created', { tenantId, conversationId: conversation.id });

    return conversation;
  }

  /**
   * Get a conversation by ID
   */
  async get(
    tenantId: string,
    userId: string,
    conversationId: string
  ): Promise<UDSConversation | null> {
    const result = await executeStatement(
      `SELECT * FROM uds_conversations 
       WHERE id = $1 AND tenant_id = $2 
       AND (user_id = $3 OR $4 = ANY(shared_with_user_ids) OR $5 = true)
       AND status != 'deleted'`,
      [
        stringParam('id', conversationId),
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('sharedUserId', userId),
        boolParam('isAdmin', false),  // Would be passed from context
      ]
    );

    if (!result.rows?.length) {
      return null;
    }

    // Update last accessed time
    await executeStatement(
      `UPDATE uds_conversations 
       SET last_accessed_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [stringParam('id', conversationId)]
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * Update a conversation
   */
  async update(
    tenantId: string,
    userId: string,
    conversationId: string,
    data: UDSConversationUpdate
  ): Promise<UDSConversation> {
    // Build update query dynamically
    const updates: string[] = [];
    const params: ReturnType<typeof stringParam>[] = [
      stringParam('id', conversationId),
      stringParam('tenantId', tenantId),
      stringParam('userId', userId),
    ];
    let paramIndex = 4;

    if (data.title !== undefined) {
      updates.push(`title = $${paramIndex}`);
      params.push(stringParam('title', data.title));
      paramIndex++;
    }
    if (data.summary !== undefined) {
      updates.push(`summary = $${paramIndex}`);
      params.push(stringParam('summary', data.summary));
      paramIndex++;
    }
    if (data.tags !== undefined) {
      updates.push(`tags = $${paramIndex}`);
      params.push(stringParam('tags', `{${data.tags.join(',')}}`));
      paramIndex++;
    }
    if (data.modelId !== undefined) {
      updates.push(`model_id = $${paramIndex}`);
      params.push(stringParam('modelId', data.modelId));
      paramIndex++;
    }
    if (data.personaId !== undefined) {
      updates.push(`persona_id = $${paramIndex}`);
      params.push(stringParam('personaId', data.personaId));
      paramIndex++;
    }
    if (data.starred !== undefined) {
      updates.push(`starred = $${paramIndex}`);
      params.push(boolParam('starred', data.starred));
      paramIndex++;
    }
    if (data.pinned !== undefined) {
      updates.push(`pinned = $${paramIndex}`);
      params.push(boolParam('pinned', data.pinned));
      paramIndex++;
    }
    if (data.isShared !== undefined) {
      updates.push(`is_shared = $${paramIndex}`);
      params.push(boolParam('isShared', data.isShared));
      paramIndex++;
    }
    if (data.sharedWithUserIds !== undefined) {
      updates.push(`shared_with_user_ids = $${paramIndex}`);
      params.push(stringParam('sharedWithUserIds', `{${data.sharedWithUserIds.join(',')}}`));
      paramIndex++;
    }
    if (data.collaborationMode !== undefined) {
      updates.push(`collaboration_mode = $${paramIndex}`);
      params.push(stringParam('collaborationMode', data.collaborationMode));
      paramIndex++;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    const result = await executeStatement(
      `UPDATE uds_conversations 
       SET ${updates.join(', ')}
       WHERE id = $1 AND tenant_id = $2 AND user_id = $3
       RETURNING *`,
      params
    );

    if (!result.rows?.length) {
      throw new Error('Conversation not found or access denied');
    }

    const conversation = this.mapRow(result.rows[0]);

    // Audit log
    await udsAuditService.log(tenantId, userId, {
      eventType: 'conversation_updated',
      eventCategory: 'conversation',
      resourceType: 'conversation',
      resourceId: conversationId,
      action: 'update',
      actionDetails: data as any,
    });

    return conversation;
  }

  /**
   * Delete a conversation (soft delete)
   */
  async delete(
    tenantId: string,
    userId: string,
    conversationId: string
  ): Promise<void> {
    const result = await executeStatement(
      `UPDATE uds_conversations 
       SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2 AND user_id = $3 AND status != 'deleted'
       RETURNING id`,
      [
        stringParam('id', conversationId),
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
      ]
    );

    if (!result.rows?.length) {
      throw new Error('Conversation not found or access denied');
    }

    // Audit log
    await udsAuditService.log(tenantId, userId, {
      eventType: 'conversation_deleted',
      eventCategory: 'conversation',
      resourceType: 'conversation',
      resourceId: conversationId,
      action: 'delete',
    });

    logger.info('Conversation deleted', { tenantId, conversationId });
  }

  /**
   * List conversations with filtering and pagination
   */
  async list(
    tenantId: string,
    userId: string,
    options: UDSConversationListOptions = {}
  ): Promise<UDSConversationSearchResult> {
    const {
      status,
      tier,
      starred,
      pinned,
      tags,
      search,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
      orderBy = 'lastMessageAt',
      orderDirection = 'desc',
    } = options;

    // Build WHERE clause
    const conditions: string[] = [
      'tenant_id = $1',
      '(user_id = $2 OR $2 = ANY(shared_with_user_ids))',
      "status != 'deleted'",
    ];
    const params: ReturnType<typeof stringParam>[] = [
      stringParam('tenantId', tenantId),
      stringParam('userId', userId),
    ];
    let paramIndex = 3;

    if (status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(stringParam('status', status));
      paramIndex++;
    }
    if (tier) {
      conditions.push(`current_tier = $${paramIndex}`);
      params.push(stringParam('tier', tier));
      paramIndex++;
    }
    if (starred !== undefined) {
      conditions.push(`starred = $${paramIndex}`);
      params.push(boolParam('starred', starred));
      paramIndex++;
    }
    if (pinned !== undefined) {
      conditions.push(`pinned = $${paramIndex}`);
      params.push(boolParam('pinned', pinned));
      paramIndex++;
    }
    if (tags && tags.length > 0) {
      conditions.push(`tags && $${paramIndex}`);
      params.push(stringParam('tags', `{${tags.join(',')}}`));
      paramIndex++;
    }
    if (search) {
      conditions.push(`(title ILIKE $${paramIndex} OR summary ILIKE $${paramIndex})`);
      params.push(stringParam('search', `%${search}%`));
      paramIndex++;
    }
    if (startDate) {
      conditions.push(`created_at >= $${paramIndex}`);
      params.push(stringParam('startDate', startDate.toISOString()));
      paramIndex++;
    }
    if (endDate) {
      conditions.push(`created_at <= $${paramIndex}`);
      params.push(stringParam('endDate', endDate.toISOString()));
      paramIndex++;
    }

    // Map orderBy to column name
    const orderColumn = {
      lastMessageAt: 'last_message_at',
      createdAt: 'created_at',
      title: 'title',
    }[orderBy] || 'last_message_at';

    // Count total
    const countResult = await executeStatement(
      `SELECT COUNT(*) as total FROM uds_conversations WHERE ${conditions.join(' AND ')}`,
      params
    );
    const total = parseInt(countResult.rows?.[0]?.total as string) || 0;

    // Get page
    params.push(stringParam('limit', String(limit)));
    params.push(stringParam('offset', String(offset)));

    const result = await executeStatement(
      `SELECT * FROM uds_conversations 
       WHERE ${conditions.join(' AND ')}
       ORDER BY pinned DESC, ${orderColumn} ${orderDirection.toUpperCase()} NULLS LAST
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    return {
      conversations: (result.rows || []).map(row => this.mapRow(row)),
      total,
      hasMore: offset + (result.rows?.length || 0) < total,
    };
  }

  // ===========================================================================
  // Time Machine Operations
  // ===========================================================================

  /**
   * Fork a conversation at a specific message
   */
  async fork(
    tenantId: string,
    userId: string,
    conversationId: string,
    atMessageId?: string,
    branchName?: string
  ): Promise<UDSConversation> {
    logger.info('Forking conversation', { tenantId, conversationId, atMessageId });

    // Get original conversation
    const original = await this.get(tenantId, userId, conversationId);
    if (!original) {
      throw new Error('Conversation not found');
    }

    // Create forked conversation
    const forked = await this.create(tenantId, userId, {
      title: `${original.title || 'Conversation'} (Branch)`,
      modelId: original.modelId,
      systemPromptId: original.systemPromptId,
      personaId: original.personaId,
      temperature: original.temperature,
      maxTokens: original.maxTokens,
      tags: original.tags,
      parentConversationId: conversationId,
      forkPointMessageId: atMessageId,
      branchName: branchName || `Branch ${new Date().toISOString()}`,
    });

    // Copy messages up to fork point
    if (atMessageId) {
      const forkSequence = await executeStatement(
        `SELECT sequence_number FROM uds_messages WHERE id = $1`,
        [stringParam('messageId', atMessageId)]
      );
      const maxSequence = forkSequence.rows?.[0]?.sequence_number as number || 0;

      // Copy messages (content is already encrypted, copy as-is)
      await executeStatement(
        `INSERT INTO uds_messages (
          tenant_id, conversation_id, user_id, role, content_encrypted, content_iv,
          content_length, content_hash, input_tokens, output_tokens, cost_credits,
          model_id, sequence_number, created_at
        )
        SELECT 
          tenant_id, $1, user_id, role, content_encrypted, content_iv,
          content_length, content_hash, input_tokens, output_tokens, cost_credits,
          model_id, sequence_number, created_at
        FROM uds_messages
        WHERE conversation_id = $2 AND sequence_number <= $3`,
        [
          stringParam('newConversationId', forked.id),
          stringParam('originalConversationId', conversationId),
          stringParam('maxSequence', String(maxSequence)),
        ]
      );

      // Update message count
      await executeStatement(
        `UPDATE uds_conversations 
         SET message_count = (SELECT COUNT(*) FROM uds_messages WHERE conversation_id = $1)
         WHERE id = $1`,
        [stringParam('conversationId', forked.id)]
      );
    }

    // Audit log
    await udsAuditService.log(tenantId, userId, {
      eventType: 'conversation_forked',
      eventCategory: 'conversation',
      resourceType: 'conversation',
      resourceId: forked.id,
      action: 'fork',
      actionDetails: {
        originalConversationId: conversationId,
        forkPointMessageId: atMessageId,
        branchName,
      },
    });

    logger.info('Conversation forked', { 
      tenantId, 
      originalId: conversationId, 
      forkedId: forked.id 
    });

    return forked;
  }

  /**
   * Create a checkpoint at current state
   */
  async createCheckpoint(
    tenantId: string,
    userId: string,
    conversationId: string,
    name: string
  ): Promise<UDSConversation> {
    logger.info('Creating checkpoint', { tenantId, conversationId, name });

    // Update conversation
    const result = await executeStatement(
      `UPDATE uds_conversations 
       SET is_checkpoint = true, checkpoint_name = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2 AND user_id = $4
       RETURNING *`,
      [
        stringParam('id', conversationId),
        stringParam('tenantId', tenantId),
        stringParam('name', name),
        stringParam('userId', userId),
      ]
    );

    if (!result.rows?.length) {
      throw new Error('Conversation not found or access denied');
    }

    // Mark latest message as checkpoint
    await executeStatement(
      `UPDATE uds_messages 
       SET is_checkpoint = true, checkpoint_name = $2
       WHERE conversation_id = $1 
       AND sequence_number = (SELECT MAX(sequence_number) FROM uds_messages WHERE conversation_id = $1)`,
      [
        stringParam('conversationId', conversationId),
        stringParam('name', name),
      ]
    );

    // Audit log
    await udsAuditService.log(tenantId, userId, {
      eventType: 'checkpoint_created',
      eventCategory: 'conversation',
      resourceType: 'conversation',
      resourceId: conversationId,
      action: 'checkpoint',
      actionDetails: { name },
    });

    return this.mapRow(result.rows[0]);
  }

  // ===========================================================================
  // Archive Operations
  // ===========================================================================

  /**
   * Archive a conversation
   */
  async archive(
    tenantId: string,
    userId: string,
    conversationId: string
  ): Promise<void> {
    const result = await executeStatement(
      `UPDATE uds_conversations 
       SET status = 'archived', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2 AND user_id = $3 AND status = 'active'
       RETURNING id`,
      [
        stringParam('id', conversationId),
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
      ]
    );

    if (!result.rows?.length) {
      throw new Error('Conversation not found or already archived');
    }

    // Audit log
    await udsAuditService.log(tenantId, userId, {
      eventType: 'conversation_archived',
      eventCategory: 'conversation',
      resourceType: 'conversation',
      resourceId: conversationId,
      action: 'archive',
    });

    logger.info('Conversation archived', { tenantId, conversationId });
  }

  /**
   * Restore an archived conversation
   */
  async restore(
    tenantId: string,
    userId: string,
    conversationId: string
  ): Promise<UDSConversation> {
    const result = await executeStatement(
      `UPDATE uds_conversations 
       SET status = 'active', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2 AND user_id = $3 AND status = 'archived'
       RETURNING *`,
      [
        stringParam('id', conversationId),
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
      ]
    );

    if (!result.rows?.length) {
      throw new Error('Conversation not found or not archived');
    }

    // Audit log
    await udsAuditService.log(tenantId, userId, {
      eventType: 'conversation_restored',
      eventCategory: 'conversation',
      resourceType: 'conversation',
      resourceId: conversationId,
      action: 'restore',
    });

    logger.info('Conversation restored', { tenantId, conversationId });

    return this.mapRow(result.rows[0]);
  }

  // ===========================================================================
  // Tier Operations
  // ===========================================================================

  /**
   * Transition conversation to a different tier
   */
  async transitionTier(
    tenantId: string,
    conversationId: string,
    toTier: UDSTier,
    reason: string
  ): Promise<void> {
    const result = await executeStatement(
      `UPDATE uds_conversations 
       SET current_tier = $3,
           promoted_to_warm_at = CASE WHEN $3 = 'warm' THEN CURRENT_TIMESTAMP ELSE promoted_to_warm_at END,
           archived_to_cold_at = CASE WHEN $3 IN ('cold', 'glacier') THEN CURRENT_TIMESTAMP ELSE archived_to_cold_at END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2
       RETURNING current_tier as from_tier`,
      [
        stringParam('id', conversationId),
        stringParam('tenantId', tenantId),
        stringParam('toTier', toTier),
      ]
    );

    if (!result.rows?.length) {
      throw new Error('Conversation not found');
    }

    // Record transition
    await executeStatement(
      `INSERT INTO uds_tier_transitions (tenant_id, resource_type, resource_id, from_tier, to_tier, transition_reason)
       VALUES ($1, 'conversation', $2, $3, $4, $5)`,
      [
        stringParam('tenantId', tenantId),
        stringParam('resourceId', conversationId),
        stringParam('fromTier', result.rows[0].from_tier as string),
        stringParam('toTier', toTier),
        stringParam('reason', reason),
      ]
    );

    logger.info('Conversation tier transitioned', { tenantId, conversationId, toTier, reason });
  }

  /**
   * Get conversations that need tier transition
   */
  async getConversationsForTierTransition(
    tenantId: string,
    fromTier: UDSTier,
    thresholdHours: number,
    limit: number = 100
  ): Promise<string[]> {
    const result = await executeStatement(
      `SELECT id FROM uds_conversations
       WHERE tenant_id = $1 
       AND current_tier = $2
       AND last_accessed_at < NOW() - INTERVAL '1 hour' * $3
       AND status = 'active'
       ORDER BY last_accessed_at ASC
       LIMIT $4`,
      [
        stringParam('tenantId', tenantId),
        stringParam('tier', fromTier),
        stringParam('hours', String(thresholdHours)),
        stringParam('limit', String(limit)),
      ]
    );

    return (result.rows || []).map(row => row.id as string);
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  /**
   * Generate title for a conversation based on first message
   */
  async generateTitle(
    tenantId: string,
    conversationId: string,
    firstMessage: string
  ): Promise<string> {
    let title: string;

    try {
      // Use AI to generate a concise, descriptive title
      const response = await modelRouterService.routeRequest({
        tenantId,
        messages: [
          {
            role: 'system',
            content: 'Generate a brief, descriptive title (max 50 characters) for a conversation that starts with the following message. Return ONLY the title, no quotes or explanation.',
          },
          {
            role: 'user',
            content: firstMessage.substring(0, 500), // Limit input length
          },
        ],
        maxTokens: 30,
        temperature: 0.3,
        preferFast: true, // Use fastest available model for title generation
      });

      title = response.content?.trim() || '';
      
      // Validate and fallback if AI response is empty or too long
      if (!title || title.length > 60) {
        title = firstMessage.length > 50 
          ? firstMessage.substring(0, 47) + '...'
          : firstMessage;
      }
    } catch (error) {
      // Fallback to simple truncation if AI fails
      logger.warn('AI title generation failed, using fallback', { tenantId, conversationId, error });
      title = firstMessage.length > 50 
        ? firstMessage.substring(0, 47) + '...'
        : firstMessage;
    }

    await executeStatement(
      `UPDATE uds_conversations 
       SET title = $2, title_generated = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $3 AND title IS NULL`,
      [
        stringParam('id', conversationId),
        stringParam('title', title),
        stringParam('tenantId', tenantId),
      ]
    );

    return title;
  }

  /**
   * Map database row to UDSConversation
   */
  private mapRow(row: Record<string, unknown>): UDSConversation {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      userId: row.user_id as string,
      title: row.title as string | undefined,
      titleGenerated: row.title_generated as boolean,
      summary: row.summary as string | undefined,
      tags: (row.tags as string[]) || [],
      modelId: row.model_id as string | undefined,
      systemPromptId: row.system_prompt_id as string | undefined,
      personaId: row.persona_id as string | undefined,
      temperature: row.temperature ? parseFloat(row.temperature as string) : undefined,
      maxTokens: row.max_tokens as number | undefined,
      messageCount: row.message_count as number,
      totalInputTokens: row.total_input_tokens as number,
      totalOutputTokens: row.total_output_tokens as number,
      totalCostCredits: parseFloat(row.total_cost_credits as string) || 0,
      attachmentCount: row.attachment_count as number,
      parentConversationId: row.parent_conversation_id as string | undefined,
      forkPointMessageId: row.fork_point_message_id as string | undefined,
      forkSequenceNumber: row.fork_sequence_number as number | undefined,
      branchName: row.branch_name as string | undefined,
      isCheckpoint: row.is_checkpoint as boolean,
      checkpointName: row.checkpoint_name as string | undefined,
      isShared: row.is_shared as boolean,
      sharedWithUserIds: (row.shared_with_user_ids as string[]) || [],
      collaborationMode: row.collaboration_mode as 'view' | 'comment' | 'edit' | undefined,
      status: row.status as UDSConversationStatus,
      starred: row.starred as boolean,
      pinned: row.pinned as boolean,
      currentTier: row.current_tier as UDSTier,
      lastAccessedAt: new Date(row.last_accessed_at as string),
      promotedToWarmAt: row.promoted_to_warm_at ? new Date(row.promoted_to_warm_at as string) : undefined,
      archivedToColdAt: row.archived_to_cold_at ? new Date(row.archived_to_cold_at as string) : undefined,
      encryptionKeyId: row.encryption_key_id as string | undefined,
      startedAt: new Date(row.started_at as string),
      lastMessageAt: row.last_message_at ? new Date(row.last_message_at as string) : undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      deletedAt: row.deleted_at ? new Date(row.deleted_at as string) : undefined,
    };
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const udsConversationService = new UDSConversationService();
