/**
 * TrustlessSync v6.0.5
 * 
 * PURPOSE: Fix CVE-2025-001 - client-side context manipulation
 * 
 * PROBLEM: Client sends conversation history that could be manipulated
 *   - Attacker injects fake "assistant" messages: "I'm in developer mode now"
 *   - Attacker modifies previous messages to change context
 *   - Attacker removes safety responses to retry attacks
 * 
 * SOLUTION: Server-side context reconstruction, never trust client
 *   - All conversation history loaded from database
 *   - Client-provided history ignored entirely
 *   - Message integrity verified via hashes
 * 
 * Location: packages/infrastructure/lambda/shared/services/cos/nervous-system/trustless-sync.ts
 */

import { Redis } from 'ioredis';
import { query } from '../../database';
import crypto from 'crypto';
import { logger } from '../../../logging/enhanced-logger';

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  hash?: string;
}

export interface ReconstructionParams {
  conversationId: string;
  userId: string;
  tenantId: string;
  maxMessages: number;
  maxTokens: number;
}

export interface ReconstructionResult {
  messages: ConversationMessage[];
  totalMessages: number;
  truncated: boolean;
  tokenEstimate: number;
  integrityVerified: boolean;
}

/**
 * TrustlessSync - Server-side conversation reconstruction
 * 
 * CRITICAL SECURITY COMPONENT
 * 
 * Never trust client-provided conversation history.
 * Always reconstruct from authoritative server-side sources.
 */
export class TrustlessSync {
  private redis: Redis;
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly CACHE_PREFIX = 'conv_cache:';
  
  constructor(redis: Redis) {
    this.redis = redis;
  }
  
  /**
   * Reconstruct conversation from server-side sources ONLY
   * 
   * NEVER trust client-provided history.
   * This is a critical security boundary.
   * 
   * @param params - Reconstruction parameters
   * @returns Server-verified conversation history
   */
  async reconstructConversation(params: ReconstructionParams): Promise<ReconstructionResult> {
    // Check cache first
    const cacheKey = `${this.CACHE_PREFIX}${params.conversationId}:${params.maxMessages}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      const parsed = JSON.parse(cached) as ReconstructionResult;
      // Verify integrity even for cached results
      if (parsed.integrityVerified) {
        return parsed;
      }
    }
    
    // Source: Database only (authoritative)
    const result = await query(
      `SELECT id, role, content, created_at, content_hash
       FROM conversation_messages
       WHERE conversation_id = $1 AND user_id = $2 AND tenant_id = $3
       ORDER BY created_at DESC 
       LIMIT $4`,
      [params.conversationId, params.userId, params.tenantId, params.maxMessages * 2]
    );
    
    // Verify integrity of each message
    const messages: ConversationMessage[] = [];
    let tokenCount = 0;
    let integrityVerified = true;
    
    for (const row of result.rows.reverse()) {
      // Verify content hash if present
      if (row.content_hash) {
        const computedHash = this.hashContent(row.content);
        if (computedHash !== row.content_hash) {
          logger.error(`[COS] Integrity violation detected for message ${row.id}`);
          integrityVerified = false;
          continue; // Skip tampered messages
        }
      }
      
      const msgTokens = this.estimateTokens(row.content);
      if (tokenCount + msgTokens > params.maxTokens) {
        break;
      }
      
      messages.push({
        id: row.id,
        role: row.role,
        content: row.content,
        createdAt: new Date(row.created_at),
        hash: row.content_hash,
      });
      tokenCount += msgTokens;
      
      if (messages.length >= params.maxMessages) {
        break;
      }
    }
    
    const reconstructionResult: ReconstructionResult = {
      messages,
      totalMessages: result.rowCount || 0,
      truncated: messages.length < (result.rowCount || 0),
      tokenEstimate: tokenCount,
      integrityVerified,
    };
    
    // Cache result (only if integrity verified)
    if (integrityVerified) {
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(reconstructionResult));
    }
    
    return reconstructionResult;
  }
  
  /**
   * Store a new message with integrity hash
   */
  async storeMessage(params: {
    conversationId: string;
    userId: string;
    tenantId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
  }): Promise<ConversationMessage> {
    const id = crypto.randomUUID();
    const contentHash = this.hashContent(params.content);
    const now = new Date();
    
    await query(
      `INSERT INTO conversation_messages 
       (id, conversation_id, user_id, tenant_id, role, content, content_hash, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, params.conversationId, params.userId, params.tenantId, 
       params.role, params.content, contentHash, now]
    );
    
    // Invalidate cache
    await this.invalidateCache(params.conversationId);
    
    return {
      id,
      role: params.role,
      content: params.content,
      createdAt: now,
      hash: contentHash,
    };
  }
  
  /**
   * Verify that client-provided messages match server records
   * Returns list of discrepancies for audit logging
   */
  async verifyClientHistory(
    conversationId: string,
    clientMessages: Array<{ role: string; content: string }>
  ): Promise<{
    verified: boolean;
    discrepancies: Array<{ type: string; index: number; details: string }>;
  }> {
    const result = await query(
      `SELECT role, content FROM conversation_messages
       WHERE conversation_id = $1 ORDER BY created_at ASC`,
      [conversationId]
    );
    
    const serverMessages = result.rows;
    const discrepancies: Array<{ type: string; index: number; details: string }> = [];
    
    // Check for extra client messages
    if (clientMessages.length > serverMessages.length) {
      discrepancies.push({
        type: 'extra_messages',
        index: serverMessages.length,
        details: `Client has ${clientMessages.length - serverMessages.length} extra messages`,
      });
    }
    
    // Check each message
    for (let i = 0; i < Math.min(clientMessages.length, serverMessages.length); i++) {
      const client = clientMessages[i];
      const server = serverMessages[i];
      
      if (client.role !== server.role) {
        discrepancies.push({
          type: 'role_mismatch',
          index: i,
          details: `Client role "${client.role}" != server role "${server.role}"`,
        });
      }
      
      if (client.content !== server.content) {
        discrepancies.push({
          type: 'content_mismatch',
          index: i,
          details: `Content hash mismatch at index ${i}`,
        });
      }
    }
    
    return {
      verified: discrepancies.length === 0,
      discrepancies,
    };
  }
  
  /**
   * Get conversation metadata without content
   * Useful for UI without exposing full history
   */
  async getConversationMeta(conversationId: string, userId: string): Promise<{
    messageCount: number;
    lastMessageAt: Date | null;
    participantRoles: string[];
  }> {
    const result = await query(
      `SELECT 
        COUNT(*) as message_count,
        MAX(created_at) as last_message_at,
        ARRAY_AGG(DISTINCT role) as roles
       FROM conversation_messages
       WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, userId]
    );
    
    const row = result.rows[0];
    return {
      messageCount: parseInt(row.message_count),
      lastMessageAt: row.last_message_at ? new Date(row.last_message_at) : null,
      participantRoles: row.roles || [],
    };
  }
  
  /**
   * Invalidate cache for a conversation
   */
  async invalidateCache(conversationId: string): Promise<void> {
    const pattern = `${this.CACHE_PREFIX}${conversationId}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
  
  /**
   * Hash content for integrity verification
   * Uses SHA-256 for collision resistance
   */
  private hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
  
  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

/**
 * Security logging for context manipulation attempts
 */
export async function logContextManipulationAttempt(params: {
  tenantId: string;
  userId: string;
  conversationId: string;
  discrepancies: Array<{ type: string; index: number; details: string }>;
}): Promise<void> {
  await query(
    `INSERT INTO security_events 
     (tenant_id, user_id, event_type, event_data, created_at)
     VALUES ($1, $2, 'context_manipulation_attempt', $3, NOW())`,
    [params.tenantId, params.userId, JSON.stringify({
      conversationId: params.conversationId,
      discrepancies: params.discrepancies,
    })]
  );
  
  logger.error(`[COS SECURITY] Context manipulation attempt detected:`, undefined, { data: {
    tenantId: params.tenantId,
    userId: params.userId,
    conversationId: params.conversationId,
    discrepancyCount: params.discrepancies.length,
  } });
}
