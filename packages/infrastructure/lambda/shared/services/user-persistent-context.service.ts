// RADIANT v4.18.0 - User Persistent Context Service
// Solves the LLM's fundamental problem of forgetting context day-to-day
// Provides user-level persistent storage that works across all sessions and conversations

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { executeStatement } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { modelRouterService } from './model-router.service';

// ============================================================================
// Types
// ============================================================================

export type UserContextType = 
  | 'fact'           // Facts about the user (name, job, location, etc.)
  | 'preference'     // User preferences (communication style, topics, etc.)
  | 'instruction'    // Standing instructions ("always use metric", "be concise")
  | 'relationship'   // Relationship context (family, colleagues, etc.)
  | 'project'        // Ongoing projects or goals
  | 'skill'          // User's skills and expertise
  | 'history'        // Important past interactions summary
  | 'correction';    // Corrections to AI understanding

export interface UserContextEntry {
  entryId: string;
  userId: string;
  tenantId: string;
  contextType: UserContextType;
  content: string;
  importance: number;        // 0-1, higher = more important to include
  confidence: number;        // 0-1, how confident we are this is accurate
  source: 'explicit' | 'inferred' | 'conversation';
  sourceConversationId?: string;
  expiresAt?: string;
  lastUsedAt?: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserContextSummary {
  userId: string;
  totalEntries: number;
  entriesByType: Record<UserContextType, number>;
  lastUpdated: string;
  contextQuality: number;    // 0-1, overall quality of stored context
}

export interface RetrievedContext {
  entries: UserContextEntry[];
  systemPromptInjection: string;
  totalRelevance: number;
  retrievalTimeMs: number;
}

export interface ContextExtractionResult {
  extracted: Array<{
    type: UserContextType;
    content: string;
    confidence: number;
  }>;
  corrections: string[];
}

// ============================================================================
// User Persistent Context Service
// ============================================================================

class UserPersistentContextService {
  private bedrock: BedrockRuntimeClient;
  private contextCache: Map<string, { entries: UserContextEntry[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 60000; // 1 minute cache

  constructor() {
    this.bedrock = new BedrockRuntimeClient({});
  }

  // ============================================================================
  // Core CRUD Operations
  // ============================================================================

  /**
   * Create a new context entry for a user (alias for addContext)
   */
  async createContext(
    tenantId: string,
    userId: string,
    contextType: UserContextType,
    content: string,
    options?: {
      importance?: number;
      confidence?: number;
      source?: 'explicit' | 'inferred' | 'conversation';
      sourceConversationId?: string;
      expiresAt?: Date;
    }
  ): Promise<string> {
    return this.addContext(tenantId, userId, contextType, content, options);
  }

  /**
   * Add or update a context entry for a user
   */
  async addContext(
    tenantId: string,
    userId: string,
    contextType: UserContextType,
    content: string,
    options?: {
      importance?: number;
      confidence?: number;
      source?: 'explicit' | 'inferred' | 'conversation';
      sourceConversationId?: string;
      expiresAt?: Date;
    }
  ): Promise<string> {
    const embedding = await this.generateEmbedding(content);
    
    // Check for similar existing context to update instead of duplicate
    const similar = await this.findSimilarContext(tenantId, userId, content, 0.9);
    
    if (similar.length > 0) {
      // Update existing entry instead of creating duplicate
      const existing = similar[0];
      await this.updateContext(existing.entryId, {
        content,
        confidence: Math.max(existing.confidence, options?.confidence || 0.8),
        importance: Math.max(existing.importance, options?.importance || 0.5),
      });
      this.invalidateCache(userId);
      return existing.entryId;
    }
    
    const result = await executeStatement(
      `INSERT INTO user_persistent_context (
        tenant_id, user_id, context_type, content, content_embedding,
        importance, confidence, source, source_conversation_id, expires_at
      ) VALUES ($1, $2, $3, $4, $5::vector, $6, $7, $8, $9, $10)
      RETURNING entry_id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'contextType', value: { stringValue: contextType } },
        { name: 'content', value: { stringValue: content } },
        { name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } },
        { name: 'importance', value: { doubleValue: options?.importance || 0.5 } },
        { name: 'confidence', value: { doubleValue: options?.confidence || 0.8 } },
        { name: 'source', value: { stringValue: options?.source || 'explicit' } },
        { name: 'conversationId', value: options?.sourceConversationId 
          ? { stringValue: options.sourceConversationId } 
          : { isNull: true } },
        { name: 'expiresAt', value: options?.expiresAt 
          ? { stringValue: options.expiresAt.toISOString() } 
          : { isNull: true } },
      ]
    );
    
    this.invalidateCache(userId);
    return String((result.rows[0] as Record<string, unknown>).entry_id);
  }

  /**
   * Update an existing context entry
   */
  async updateContext(
    entryId: string,
    updates: Partial<{
      content: string;
      importance: number;
      confidence: number;
      expiresAt: Date | null;
    }>
  ): Promise<void> {
    const sets: string[] = ['updated_at = NOW()'];
    const params: Array<{ name: string; value: unknown }> = [
      { name: 'entryId', value: { stringValue: entryId } },
    ];
    
    if (updates.content !== undefined) {
      const embedding = await this.generateEmbedding(updates.content);
      sets.push(`content = $${params.length + 1}`);
      params.push({ name: 'content', value: { stringValue: updates.content } });
      sets.push(`content_embedding = $${params.length + 1}::vector`);
      params.push({ name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } });
    }
    if (updates.importance !== undefined) {
      sets.push(`importance = $${params.length + 1}`);
      params.push({ name: 'importance', value: { doubleValue: updates.importance } });
    }
    if (updates.confidence !== undefined) {
      sets.push(`confidence = $${params.length + 1}`);
      params.push({ name: 'confidence', value: { doubleValue: updates.confidence } });
    }
    if (updates.expiresAt !== undefined) {
      sets.push(`expires_at = $${params.length + 1}`);
      params.push({ name: 'expiresAt', value: updates.expiresAt 
        ? { stringValue: updates.expiresAt.toISOString() } 
        : { isNull: true } });
    }
    
    await executeStatement(
      `UPDATE user_persistent_context SET ${sets.join(', ')} WHERE entry_id = $1`,
      params as Parameters<typeof executeStatement>[1]
    );
  }

  /**
   * Delete a context entry
   */
  async deleteContext(entryId: string, userId: string): Promise<void> {
    await executeStatement(
      `DELETE FROM user_persistent_context WHERE entry_id = $1`,
      [{ name: 'entryId', value: { stringValue: entryId } }]
    );
    this.invalidateCache(userId);
  }

  /**
   * Get all context for a user
   */
  async getUserContext(
    tenantId: string,
    userId: string,
    options?: {
      types?: UserContextType[];
      minImportance?: number;
      limit?: number;
    }
  ): Promise<UserContextEntry[]> {
    let query = `
      SELECT * FROM user_persistent_context 
      WHERE tenant_id = $1 AND user_id = $2
      AND (expires_at IS NULL OR expires_at > NOW())
    `;
    const params: Array<{ name: string; value: unknown }> = [
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'userId', value: { stringValue: userId } },
    ];
    
    if (options?.types && options.types.length > 0) {
      query += ` AND context_type = ANY($${params.length + 1}::text[])`;
      params.push({ name: 'types', value: { stringValue: `{${options.types.join(',')}}` } });
    }
    if (options?.minImportance !== undefined) {
      query += ` AND importance >= $${params.length + 1}`;
      params.push({ name: 'minImportance', value: { doubleValue: options.minImportance } });
    }
    
    query += ` ORDER BY importance DESC, updated_at DESC`;
    
    if (options?.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push({ name: 'limit', value: { longValue: options.limit } });
    }
    
    const result = await executeStatement(query, params as Parameters<typeof executeStatement>[1]);
    return result.rows.map(row => this.mapContextEntry(row as Record<string, unknown>));
  }

  // ============================================================================
  // Context Retrieval for Chat
  // ============================================================================

  /**
   * Retrieve relevant context for a conversation prompt
   * This is the key method that solves the "forgetting context" problem
   */
  async retrieveContextForPrompt(
    tenantId: string,
    userId: string,
    prompt: string,
    conversationHistory?: string[],
    options?: {
      maxEntries?: number;
      minRelevance?: number;
      includeTypes?: UserContextType[];
    }
  ): Promise<RetrievedContext> {
    const startTime = Date.now();
    const maxEntries = options?.maxEntries || 10;
    const minRelevance = options?.minRelevance || 0.3;
    
    // Build search context from prompt + recent history
    const searchContext = [
      prompt,
      ...(conversationHistory?.slice(-3) || []),
    ].join('\n');
    
    const embedding = await this.generateEmbedding(searchContext);
    
    // Retrieve semantically relevant context
    let query = `
      SELECT *, 
        1 - (content_embedding <=> $3::vector) as relevance
      FROM user_persistent_context
      WHERE tenant_id = $1 AND user_id = $2
      AND (expires_at IS NULL OR expires_at > NOW())
      AND 1 - (content_embedding <=> $3::vector) >= $4
    `;
    const params: Array<{ name: string; value: unknown }> = [
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'userId', value: { stringValue: userId } },
      { name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } },
      { name: 'minRelevance', value: { doubleValue: minRelevance } },
    ];
    
    if (options?.includeTypes && options.includeTypes.length > 0) {
      query += ` AND context_type = ANY($${params.length + 1}::text[])`;
      params.push({ name: 'types', value: { stringValue: `{${options.includeTypes.join(',')}}` } });
    }
    
    query += ` ORDER BY (relevance * importance * confidence) DESC LIMIT $${params.length + 1}`;
    params.push({ name: 'limit', value: { longValue: maxEntries } });
    
    const result = await executeStatement(query, params as Parameters<typeof executeStatement>[1]);
    
    const entries = result.rows.map(row => ({
      ...this.mapContextEntry(row as Record<string, unknown>),
      relevance: Number((row as Record<string, unknown>).relevance || 0),
    }));
    
    // Also get high-importance "always include" context
    const alwaysInclude = await this.getHighImportanceContext(tenantId, userId, maxEntries);
    
    // Merge and dedupe
    const entryIds = new Set(entries.map(e => e.entryId));
    const merged = [
      ...entries,
      ...alwaysInclude.filter(e => !entryIds.has(e.entryId)),
    ].slice(0, maxEntries);
    
    // Update usage stats
    await this.updateUsageStats(merged.map(e => e.entryId));
    
    // Generate system prompt injection
    const systemPromptInjection = this.generateContextInjection(merged);
    
    const totalRelevance = merged.length > 0 
      ? merged.reduce((sum, e) => sum + ((e as { relevance?: number }).relevance ?? e.importance), 0) / merged.length
      : 0;
    
    return {
      entries: merged,
      systemPromptInjection,
      totalRelevance,
      retrievalTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Get high-importance context that should always be included
   */
  private async getHighImportanceContext(
    tenantId: string,
    userId: string,
    limit: number
  ): Promise<UserContextEntry[]> {
    const result = await executeStatement(
      `SELECT * FROM user_persistent_context
       WHERE tenant_id = $1 AND user_id = $2
       AND importance >= 0.9
       AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY importance DESC, context_type
       LIMIT $3`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );
    
    return result.rows.map(row => this.mapContextEntry(row as Record<string, unknown>));
  }

  /**
   * Generate system prompt injection from context entries
   */
  private generateContextInjection(entries: UserContextEntry[]): string {
    if (entries.length === 0) return '';
    
    const grouped: Record<string, string[]> = {};
    
    for (const entry of entries) {
      if (!grouped[entry.contextType]) {
        grouped[entry.contextType] = [];
      }
      grouped[entry.contextType].push(entry.content);
    }
    
    const parts: string[] = ['<user_context>'];
    parts.push('The following is persistent context about this user that you should remember:');
    parts.push('');
    
    // Order: instructions first, then facts, then others
    const typeOrder: UserContextType[] = [
      'instruction', 'fact', 'preference', 'relationship', 
      'project', 'skill', 'history', 'correction'
    ];
    
    const typeLabels: Record<UserContextType, string> = {
      instruction: 'Standing Instructions',
      fact: 'User Facts',
      preference: 'User Preferences',
      relationship: 'Relationships',
      project: 'Ongoing Projects',
      skill: 'User Skills',
      history: 'Relevant History',
      correction: 'Corrections',
    };
    
    for (const type of typeOrder) {
      if (grouped[type] && grouped[type].length > 0) {
        parts.push(`**${typeLabels[type]}:**`);
        for (const content of grouped[type]) {
          parts.push(`- ${content}`);
        }
        parts.push('');
      }
    }
    
    parts.push('</user_context>');
    parts.push('');
    parts.push('Use this context to personalize your responses. Do not ask the user for information you already have.');
    
    return parts.join('\n');
  }

  // ============================================================================
  // Context Extraction from Conversations
  // ============================================================================

  /**
   * Extract learnable context from a conversation
   * Called after each conversation to update user's persistent context
   */
  async extractContextFromConversation(
    tenantId: string,
    userId: string,
    conversationId: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<ContextExtractionResult> {
    // Build conversation text
    const conversationText = messages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n\n');
    
    // Use LLM to extract learnable facts
    const prompt = `Analyze this conversation and extract any facts, preferences, or instructions about the user that should be remembered for future conversations.

CONVERSATION:
${conversationText.substring(0, 4000)}

Extract ONLY factual information explicitly stated or strongly implied by the USER (not the assistant).
For each item, specify:
- type: fact | preference | instruction | relationship | project | skill
- content: A clear, concise statement
- confidence: 0.5-1.0 how confident you are

Also note any corrections the user made to previous AI understanding.

Return JSON:
{
  "extracted": [
    {"type": "fact", "content": "User's name is John", "confidence": 0.95},
    {"type": "preference", "content": "User prefers concise answers", "confidence": 0.8}
  ],
  "corrections": ["User clarified they work in finance, not tech"]
}

Only include items you're confident about. Quality over quantity.`;

    try {
      const response = await modelRouterService.invoke({
        modelId: await this.getExtractionModel(),
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 1024,
      });
      
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { extracted: [], corrections: [] };
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Store extracted context
      for (const item of parsed.extracted || []) {
        if (item.confidence >= 0.7) {
          await this.addContext(tenantId, userId, item.type, item.content, {
            confidence: item.confidence,
            source: 'conversation',
            sourceConversationId: conversationId,
            importance: this.getDefaultImportance(item.type),
          });
        }
      }
      
      // Handle corrections - lower confidence of contradicted entries
      for (const correction of parsed.corrections || []) {
        await this.handleCorrection(tenantId, userId, correction);
      }
      
      return {
        extracted: parsed.extracted || [],
        corrections: parsed.corrections || [],
      };
    } catch (error) {
      logger.error('Context extraction failed', { error, userId, conversationId });
      return { extracted: [], corrections: [] };
    }
  }

  private getDefaultImportance(type: UserContextType): number {
    const defaults: Record<UserContextType, number> = {
      instruction: 0.95,    // Instructions are always important
      fact: 0.7,
      preference: 0.8,
      relationship: 0.6,
      project: 0.75,
      skill: 0.6,
      history: 0.5,
      correction: 0.9,
    };
    return defaults[type] || 0.5;
  }

  private async handleCorrection(tenantId: string, userId: string, correction: string): Promise<void> {
    // Find potentially contradicted entries
    const similar = await this.findSimilarContext(tenantId, userId, correction, 0.6);
    
    for (const entry of similar) {
      // Lower confidence of potentially wrong entries
      await this.updateContext(entry.entryId, {
        confidence: Math.max(0.1, entry.confidence - 0.3),
      });
    }
    
    // Add the correction as a new entry
    await this.addContext(tenantId, userId, 'correction', correction, {
      confidence: 0.9,
      importance: 0.9,
      source: 'conversation',
    });
  }

  // ============================================================================
  // User Context Summary
  // ============================================================================

  async getContextSummary(tenantId: string, userId: string): Promise<UserContextSummary> {
    const result = await executeStatement(
      `SELECT 
        COUNT(*) as total,
        context_type,
        MAX(updated_at) as last_updated,
        AVG(confidence) as avg_confidence
      FROM user_persistent_context
      WHERE tenant_id = $1 AND user_id = $2
      AND (expires_at IS NULL OR expires_at > NOW())
      GROUP BY context_type`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
      ]
    );
    
    let totalEntries = 0;
    let lastUpdated = '';
    let totalConfidence = 0;
    const entriesByType: Record<string, number> = {};
    
    for (const row of result.rows) {
      const r = row as Record<string, unknown>;
      const count = Number(r.total || 0);
      totalEntries += count;
      entriesByType[String(r.context_type)] = count;
      
      const updated = String(r.last_updated || '');
      if (updated > lastUpdated) lastUpdated = updated;
      
      totalConfidence += Number(r.avg_confidence || 0) * count;
    }
    
    return {
      userId,
      totalEntries,
      entriesByType: entriesByType as Record<UserContextType, number>,
      lastUpdated,
      contextQuality: totalEntries > 0 ? totalConfidence / totalEntries : 0,
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async findSimilarContext(
    tenantId: string,
    userId: string,
    content: string,
    minSimilarity: number
  ): Promise<UserContextEntry[]> {
    const embedding = await this.generateEmbedding(content);
    
    const result = await executeStatement(
      `SELECT *, 1 - (content_embedding <=> $3::vector) as similarity
       FROM user_persistent_context
       WHERE tenant_id = $1 AND user_id = $2
       AND 1 - (content_embedding <=> $3::vector) >= $4
       ORDER BY similarity DESC
       LIMIT 5`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } },
        { name: 'minSimilarity', value: { doubleValue: minSimilarity } },
      ]
    );
    
    return result.rows.map(row => this.mapContextEntry(row as Record<string, unknown>));
  }

  private async updateUsageStats(entryIds: string[]): Promise<void> {
    if (entryIds.length === 0) return;
    
    await executeStatement(
      `UPDATE user_persistent_context 
       SET usage_count = usage_count + 1, last_used_at = NOW()
       WHERE entry_id = ANY($1::uuid[])`,
      [{ name: 'entryIds', value: { stringValue: `{${entryIds.join(',')}}` } }]
    );
  }

  private invalidateCache(userId: string): void {
    this.contextCache.delete(userId);
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.bedrock.send(
        new InvokeModelCommand({
          modelId: 'amazon.titan-embed-text-v1',
          body: JSON.stringify({ inputText: text.substring(0, 8000) }),
          contentType: 'application/json',
        })
      );
      
      const result = JSON.parse(new TextDecoder().decode(response.body));
      return result.embedding;
    } catch (error) {
      logger.error('Embedding generation error', { error });
      return new Array(1536).fill(0);
    }
  }

  private async getExtractionModel(): Promise<string> {
    // Prefer fast, cheap model for extraction
    return 'anthropic/claude-3-haiku';
  }

  private mapContextEntry(row: Record<string, unknown>): UserContextEntry {
    return {
      entryId: String(row.entry_id),
      userId: String(row.user_id),
      tenantId: String(row.tenant_id),
      contextType: row.context_type as UserContextType,
      content: String(row.content),
      importance: Number(row.importance || 0.5),
      confidence: Number(row.confidence || 0.8),
      source: (row.source as UserContextEntry['source']) || 'explicit',
      sourceConversationId: row.source_conversation_id ? String(row.source_conversation_id) : undefined,
      expiresAt: row.expires_at ? String(row.expires_at) : undefined,
      lastUsedAt: row.last_used_at ? String(row.last_used_at) : undefined,
      usageCount: Number(row.usage_count || 0),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }
}

export const userPersistentContextService = new UserPersistentContextService();
