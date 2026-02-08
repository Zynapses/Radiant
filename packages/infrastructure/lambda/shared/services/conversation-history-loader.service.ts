/**
 * RADIANT v7.43.0 - Conversation History Loader Service
 * 
 * Standard entry point for loading conversation history and feeding it to the
 * Context Assembler. Solves the audit finding that each caller independently
 * fetches/decrypts history with no standard approach.
 * 
 * Features:
 *  - Load full or windowed history from UDS
 *  - Cross-session continuity (load prior conversation for a new session)
 *  - Cross-model continuity (same messages regardless of model switch)
 *  - Token-aware truncation (fit history within a token budget)
 *  - Integrates with context-assembler.service.ts
 */

import { createRegisteredLogger } from './logging-registry.service';
import { udsMessageService } from './uds/message.service';
import { udsConversationService } from './uds/conversation.service';

const logger = createRegisteredLogger({
  serviceName: 'conversation-history-loader',
  category: 'platform',
  sourceType: 'application',
});

// =============================================================================
// Types
// =============================================================================

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  modelId?: string;
  timestamp?: string;
  toolCallId?: string;
  toolName?: string;
  sequenceNumber?: number;
}

export interface LoadHistoryRequest {
  tenantId: string;
  userId: string;
  conversationId: string;
  maxMessages?: number;       // Default: 50
  maxTokenBudget?: number;    // If set, truncate to fit within this token count
  includeSystemMessages?: boolean; // Default: false
  sinceSequenceNumber?: number;    // Load only messages after this sequence
}

export interface LoadHistoryResult {
  messages: ConversationMessage[];
  conversationTitle: string;
  conversationModelId: string;
  totalMessageCount: number;
  loadedMessageCount: number;
  truncated: boolean;
  estimatedTokens: number;
  oldestMessageTimestamp?: string;
  newestMessageTimestamp?: string;
}

export interface CrossSessionRequest {
  tenantId: string;
  userId: string;
  newConversationId?: string;  // The new conversation (may not have messages yet)
  previousConversationId?: string; // Explicitly provide prior conversation
  maxMessages?: number;
  maxTokenBudget?: number;
}

// =============================================================================
// Token Estimation
// =============================================================================

function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token for English text
  return Math.ceil(text.length / 4);
}

function estimateMessageTokens(msg: ConversationMessage): number {
  // Each message has ~4 tokens of overhead (role, delimiters)
  return 4 + estimateTokens(msg.content);
}

// =============================================================================
// Service
// =============================================================================

class ConversationHistoryLoaderService {

  /**
   * Load conversation history for context assembly.
   * This is the PRIMARY entry point for any service needing chat history.
   */
  async loadHistory(request: LoadHistoryRequest): Promise<LoadHistoryResult> {
    const {
      tenantId, userId, conversationId,
      maxMessages = 50,
      maxTokenBudget,
      includeSystemMessages = false,
      sinceSequenceNumber,
    } = request;

    // Load conversation metadata
    const conversation = await udsConversationService.get(tenantId, userId, conversationId);
    if (!conversation) {
      logger.warn('Conversation not found for history load', { tenantId, conversationId });
      return {
        messages: [],
        conversationTitle: 'Unknown',
        conversationModelId: '',
        totalMessageCount: 0,
        loadedMessageCount: 0,
        truncated: false,
        estimatedTokens: 0,
      };
    }

    // Load messages from UDS (decrypted)
    const allMessages = await udsMessageService.list(tenantId, userId, {
      conversationId,
      limit: maxMessages * 2, // Fetch extra in case we filter some out
      offset: 0,
    });

    // Filter by sequence number if requested
    let filtered = sinceSequenceNumber
      ? allMessages.filter(m => m.sequenceNumber > sinceSequenceNumber)
      : allMessages;

    // Filter out system messages unless requested
    if (!includeSystemMessages) {
      filtered = filtered.filter(m => m.role !== 'system');
    }

    // Convert to standard format
    let messages: ConversationMessage[] = filtered.map(m => ({
      role: m.role as ConversationMessage['role'],
      content: m.content,
      modelId: m.modelId || undefined,
      timestamp: m.createdAt.toISOString(),
      toolCallId: m.toolCallId || undefined,
      toolName: m.toolName || undefined,
      sequenceNumber: m.sequenceNumber,
    }));

    // Truncate to maxMessages (keep most recent)
    const totalBeforeTruncation = messages.length;
    if (messages.length > maxMessages) {
      messages = messages.slice(-maxMessages);
    }

    // Token-aware truncation
    let truncated = messages.length < totalBeforeTruncation;
    if (maxTokenBudget) {
      let tokenCount = 0;
      const fittingMessages: ConversationMessage[] = [];
      
      // Walk backwards from most recent, accumulating tokens
      for (let i = messages.length - 1; i >= 0; i--) {
        const msgTokens = estimateMessageTokens(messages[i]);
        if (tokenCount + msgTokens > maxTokenBudget) {
          truncated = true;
          break;
        }
        tokenCount += msgTokens;
        fittingMessages.unshift(messages[i]);
      }
      messages = fittingMessages;
    }

    const estimatedTokens = messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0);

    return {
      messages,
      conversationTitle: conversation.title || 'Untitled',
      conversationModelId: conversation.modelId || '',
      totalMessageCount: allMessages.length,
      loadedMessageCount: messages.length,
      truncated,
      estimatedTokens,
      oldestMessageTimestamp: messages.length > 0 ? messages[0].timestamp : undefined,
      newestMessageTimestamp: messages.length > 0 ? messages[messages.length - 1].timestamp : undefined,
    };
  }

  /**
   * Load cross-session context: when a user starts a new session/conversation,
   * load relevant context from their most recent prior conversation.
   */
  async loadCrossSessionContext(request: CrossSessionRequest): Promise<LoadHistoryResult> {
    const { tenantId, userId, previousConversationId, maxMessages = 20, maxTokenBudget } = request;

    let priorConversationId = previousConversationId;

    // If no explicit prior conversation, find the most recent one
    if (!priorConversationId) {
      const conversations = await udsConversationService.list(tenantId, userId, {
        limit: 2,
        offset: 0,
      });

      if (conversations.length === 0) {
        return {
          messages: [],
          conversationTitle: '',
          conversationModelId: '',
          totalMessageCount: 0,
          loadedMessageCount: 0,
          truncated: false,
          estimatedTokens: 0,
        };
      }

      // Use the most recent conversation (skip the current new one if it exists)
      priorConversationId = conversations[0].id;
      if (request.newConversationId && conversations[0].id === request.newConversationId && conversations.length > 1) {
        priorConversationId = conversations[1].id;
      }
    }

    // Load the prior conversation's history
    return this.loadHistory({
      tenantId,
      userId,
      conversationId: priorConversationId,
      maxMessages,
      maxTokenBudget,
      includeSystemMessages: false,
    });
  }

  /**
   * Load history and format it for direct use with the Context Assembler.
   * Returns the messages in the format expected by context-assembler.service.ts.
   */
  async loadForContextAssembly(
    tenantId: string,
    userId: string,
    conversationId: string,
    tokenBudget?: number
  ): Promise<ConversationMessage[]> {
    const result = await this.loadHistory({
      tenantId,
      userId,
      conversationId,
      maxMessages: 100,
      maxTokenBudget: tokenBudget,
      includeSystemMessages: false,
    });

    if (result.loadedMessageCount > 0) {
      logger.info('Loaded conversation history for context assembly', {
        tenantId, conversationId,
        messageCount: result.loadedMessageCount,
        estimatedTokens: result.estimatedTokens,
        truncated: result.truncated,
      });
    }

    return result.messages;
  }
}

// Singleton
export const conversationHistoryLoader = new ConversationHistoryLoaderService();
