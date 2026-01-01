import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { executeStatement } from '../db/client';

export interface UserPreference {
  key: string;
  value: unknown;
  confidence: number;
}

export interface UserMemory {
  id?: string;
  type: string;
  content: string;
  importance: number;
  similarity?: number;
}

export interface BehaviorPattern {
  patternType: string;
  patternData: Record<string, unknown>;
  occurrenceCount: number;
}

export interface ConversationMessage {
  role: string;
  content: string;
}

export class PreferenceEngine {
  private bedrock: BedrockRuntimeClient;

  constructor() {
    this.bedrock = new BedrockRuntimeClient({});
  }

  async learnFromConversation(
    tenantId: string,
    userId: string,
    messages: ConversationMessage[]
  ): Promise<void> {
    const preferences = await this.extractPreferences(messages);
    for (const pref of preferences) {
      await this.updatePreference(tenantId, userId, pref.key, pref.value, pref.confidence);
    }

    const memories = await this.extractMemories(messages);
    for (const memory of memories) {
      await this.storeMemory(tenantId, userId, memory);
    }

    await this.updateBehaviorPatterns(tenantId, userId, messages);
  }

  async getRelevantMemories(
    tenantId: string,
    userId: string,
    query: string,
    limit: number = 5
  ): Promise<UserMemory[]> {
    const embedding = await this.generateEmbedding(query);
    const embeddingStr = `[${embedding.join(',')}]`;

    const result = await executeStatement(
      `SELECT id, content, importance, memory_type,
              1 - (embedding <=> $4::vector) as similarity
       FROM user_memory
       WHERE tenant_id = $1 AND user_id = $2
       AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY embedding <=> $4::vector
       LIMIT $3`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'limit', value: { longValue: limit } },
        { name: 'embedding', value: { stringValue: embeddingStr } },
      ]
    );

    for (const row of result.rows as Array<{ id: string }>) {
      await executeStatement(
        `UPDATE user_memory SET access_count = access_count + 1, last_accessed = NOW() WHERE id = $1`,
        [{ name: 'id', value: { stringValue: row.id } }]
      );
    }

    return result.rows as unknown as UserMemory[];
  }

  async getPreferences(
    tenantId: string,
    userId: string
  ): Promise<Record<string, { value: unknown; confidence: number }>> {
    const result = await executeStatement(
      `SELECT preference_key, preference_value, confidence
       FROM user_preferences
       WHERE tenant_id = $1 AND user_id = $2
       ORDER BY confidence DESC`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
      ]
    );

    const prefs: Record<string, { value: unknown; confidence: number }> = {};
    for (const row of result.rows as Array<{
      preference_key: string;
      preference_value: unknown;
      confidence: number;
    }>) {
      prefs[row.preference_key] = {
        value: row.preference_value,
        confidence: row.confidence,
      };
    }
    return prefs;
  }

  async getBehaviorPatterns(tenantId: string, userId: string): Promise<BehaviorPattern[]> {
    const result = await executeStatement(
      `SELECT pattern_type, pattern_data, occurrence_count
       FROM user_behavior_patterns
       WHERE tenant_id = $1 AND user_id = $2
       ORDER BY occurrence_count DESC
       LIMIT 20`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
      ]
    );

    return (result.rows as Array<{
      pattern_type: string;
      pattern_data: Record<string, unknown>;
      occurrence_count: number;
    }>).map((row) => ({
      patternType: row.pattern_type,
      patternData: row.pattern_data,
      occurrenceCount: row.occurrence_count,
    }));
  }

  async deleteUserData(tenantId: string, userId: string): Promise<void> {
    await executeStatement(
      `DELETE FROM user_preferences WHERE tenant_id = $1 AND user_id = $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
      ]
    );

    await executeStatement(
      `DELETE FROM user_memory WHERE tenant_id = $1 AND user_id = $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
      ]
    );

    await executeStatement(
      `DELETE FROM user_behavior_patterns WHERE tenant_id = $1 AND user_id = $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
      ]
    );
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.bedrock.send(
      new InvokeModelCommand({
        modelId: 'amazon.titan-embed-text-v1',
        body: JSON.stringify({ inputText: text }),
        contentType: 'application/json',
      })
    );

    const result = JSON.parse(new TextDecoder().decode(response.body));
    return result.embedding;
  }

  private async extractPreferences(messages: ConversationMessage[]): Promise<UserPreference[]> {
    if (messages.length === 0) return [];

    const conversationText = messages.map((m) => `${m.role}: ${m.content}`).join('\n');

    try {
      const response = await this.bedrock.send(
        new InvokeModelCommand({
          modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
          body: JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 1024,
            messages: [
              {
                role: 'user',
                content: `Extract user preferences from this conversation. Return a JSON array with objects containing "key" (string), "value" (any), and "confidence" (number 0-1).

Examples of preferences: preferred_language, response_style, expertise_level, topic_interests, formatting_preferences.

Conversation:
${conversationText}

Return only valid JSON array, no other text.`,
              },
            ],
          }),
          contentType: 'application/json',
        })
      );

      const result = JSON.parse(new TextDecoder().decode(response.body));
      const text = result.content?.[0]?.text || '[]';
      return JSON.parse(text) as UserPreference[];
    } catch (error) {
      // Return empty array on parsing failure
      return [];
    }
  }

  private async extractMemories(messages: ConversationMessage[]): Promise<UserMemory[]> {
    if (messages.length === 0) return [];

    const conversationText = messages.map((m) => `${m.role}: ${m.content}`).join('\n');

    try {
      const response = await this.bedrock.send(
        new InvokeModelCommand({
          modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
          body: JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 1024,
            messages: [
              {
                role: 'user',
                content: `Extract important facts or memories from this conversation that should be remembered for future interactions. Return a JSON array with objects containing "type" (string: "fact", "preference", "context"), "content" (string), and "importance" (number 0-1).

Conversation:
${conversationText}

Return only valid JSON array, no other text.`,
              },
            ],
          }),
          contentType: 'application/json',
        })
      );

      const result = JSON.parse(new TextDecoder().decode(response.body));
      const text = result.content?.[0]?.text || '[]';
      return JSON.parse(text) as UserMemory[];
    } catch (error) {
      // Return empty array on parsing failure
      return [];
    }
  }

  private async updatePreference(
    tenantId: string,
    userId: string,
    key: string,
    value: unknown,
    confidence: number
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO user_preferences (tenant_id, user_id, preference_key, preference_value, confidence)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       ON CONFLICT (tenant_id, user_id, preference_key)
       DO UPDATE SET 
           preference_value = EXCLUDED.preference_value,
           confidence = GREATEST(user_preferences.confidence, EXCLUDED.confidence),
           updated_at = NOW()`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'key', value: { stringValue: key } },
        { name: 'value', value: { stringValue: JSON.stringify(value) } },
        { name: 'confidence', value: { doubleValue: confidence } },
      ]
    );
  }

  private async storeMemory(tenantId: string, userId: string, memory: UserMemory): Promise<void> {
    const embedding = await this.generateEmbedding(memory.content);
    const embeddingStr = `[${embedding.join(',')}]`;

    await executeStatement(
      `INSERT INTO user_memory (tenant_id, user_id, memory_type, content, embedding, importance)
       VALUES ($1, $2, $3, $4, $5::vector, $6)`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'memoryType', value: { stringValue: memory.type } },
        { name: 'content', value: { stringValue: memory.content } },
        { name: 'embedding', value: { stringValue: embeddingStr } },
        { name: 'importance', value: { doubleValue: memory.importance } },
      ]
    );
  }

  private async updateBehaviorPatterns(
    tenantId: string,
    userId: string,
    messages: ConversationMessage[]
  ): Promise<void> {
    const patterns = this.detectPatterns(messages);

    for (const pattern of patterns) {
      await executeStatement(
        `INSERT INTO user_behavior_patterns (tenant_id, user_id, pattern_type, pattern_data)
         VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (tenant_id, user_id, pattern_type)
         DO UPDATE SET 
             occurrence_count = user_behavior_patterns.occurrence_count + 1,
             last_occurred = NOW(),
             pattern_data = user_behavior_patterns.pattern_data || EXCLUDED.pattern_data`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'userId', value: { stringValue: userId } },
          { name: 'patternType', value: { stringValue: pattern.type } },
          { name: 'patternData', value: { stringValue: JSON.stringify(pattern.data) } },
        ]
      );
    }
  }

  private detectPatterns(
    messages: ConversationMessage[]
  ): Array<{ type: string; data: Record<string, unknown> }> {
    const patterns: Array<{ type: string; data: Record<string, unknown> }> = [];

    const userMessages = messages.filter((m) => m.role === 'user');
    if (userMessages.length === 0) return patterns;

    const avgLength = userMessages.reduce((sum, m) => sum + m.content.length, 0) / userMessages.length;
    patterns.push({
      type: 'message_length',
      data: { averageLength: Math.round(avgLength), messageCount: userMessages.length },
    });

    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    patterns.push({
      type: 'activity_time',
      data: { timeOfDay, hour },
    });

    const hasCode = userMessages.some((m) => m.content.includes('```') || m.content.includes('function'));
    if (hasCode) {
      patterns.push({
        type: 'code_interaction',
        data: { detected: true },
      });
    }

    return patterns;
  }
}

export const preferenceEngine = new PreferenceEngine();
