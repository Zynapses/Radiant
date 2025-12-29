// Success Memory RAG Service
// Stores and retrieves high-rated interactions for few-shot learning

import { executeStatement, stringParam, numberParam } from '../db/client';
import type {
  GoldInteraction,
  GoldInteractionMatch,
  ResponseStructure,
  ImplicitSignals,
  TaskType,
  SuccessMemoryConfig,
} from '@radiant/shared';

const DEFAULT_CONFIG: SuccessMemoryConfig = {
  enabled: true,
  minRatingForGold: 4,
  maxGoldInteractions: 1000,
  retrievalCount: 3,
  similarityThreshold: 0.75,
};

class SuccessMemoryService {
  private config: SuccessMemoryConfig = DEFAULT_CONFIG;

  /**
   * Record a gold interaction (high-rated response)
   */
  async recordGoldInteraction(
    tenantId: string,
    userId: string,
    promptText: string,
    promptEmbedding: number[],
    responseText: string,
    rating: number,
    options: {
      conversationId?: string;
      messageId?: string;
      responseStructure?: ResponseStructure;
      explicitFeedback?: string;
      implicitSignals?: ImplicitSignals;
      domainId?: string;
      orchestrationMode?: string;
      modelUsed?: string;
      taskType?: TaskType;
    } = {}
  ): Promise<string | null> {
    if (!this.config.enabled) return null;
    if (rating < this.config.minRatingForGold) return null;

    // Check if we've hit the max limit for this user
    const countResult = await executeStatement({
      sql: `
        SELECT COUNT(*) as count 
        FROM user_gold_interactions 
        WHERE user_id = :userId::uuid
      `,
      parameters: [stringParam('userId', userId)],
    });

    const currentCount = parseInt(countResult.rows?.[0]?.count || '0');
    
    // If at limit, delete oldest interaction
    if (currentCount >= this.config.maxGoldInteractions) {
      await executeStatement({
        sql: `
          DELETE FROM user_gold_interactions
          WHERE id = (
            SELECT id FROM user_gold_interactions
            WHERE user_id = :userId::uuid
            ORDER BY created_at ASC
            LIMIT 1
          )
        `,
        parameters: [stringParam('userId', userId)],
      });
    }

    // Insert new gold interaction
    const embeddingStr = `[${promptEmbedding.join(',')}]`;
    
    const result = await executeStatement({
      sql: `
        INSERT INTO user_gold_interactions (
          tenant_id, user_id, conversation_id, message_id,
          prompt_text, prompt_embedding, prompt_tokens,
          response_text, response_structure, response_tokens,
          rating, explicit_feedback, implicit_signals,
          domain_id, orchestration_mode, model_used, task_type
        ) VALUES (
          :tenantId::uuid, :userId::uuid, 
          NULLIF(:conversationId, '')::uuid, NULLIF(:messageId, '')::uuid,
          :promptText, :embedding::vector, :promptTokens,
          :responseText, :responseStructure::jsonb, :responseTokens,
          :rating, :feedback, :signals::jsonb,
          NULLIF(:domainId, '')::uuid, :orchestrationMode, :modelUsed, :taskType
        )
        RETURNING id
      `,
      parameters: [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('conversationId', options.conversationId || ''),
        stringParam('messageId', options.messageId || ''),
        stringParam('promptText', promptText),
        stringParam('embedding', embeddingStr),
        numberParam('promptTokens', Math.ceil(promptText.length / 4)),
        stringParam('responseText', responseText),
        stringParam('responseStructure', JSON.stringify(options.responseStructure || {})),
        numberParam('responseTokens', Math.ceil(responseText.length / 4)),
        numberParam('rating', rating),
        stringParam('feedback', options.explicitFeedback || ''),
        stringParam('signals', JSON.stringify(options.implicitSignals || {})),
        stringParam('domainId', options.domainId || ''),
        stringParam('orchestrationMode', options.orchestrationMode || ''),
        stringParam('modelUsed', options.modelUsed || ''),
        stringParam('taskType', options.taskType || ''),
      ],
    });

    return result.rows?.[0]?.id || null;
  }

  /**
   * Retrieve similar gold interactions for few-shot injection
   */
  async retrieveSimilarInteractions(
    userId: string,
    promptEmbedding: number[],
    taskType?: TaskType,
    limit?: number
  ): Promise<GoldInteractionMatch[]> {
    if (!this.config.enabled) return [];

    const embeddingStr = `[${promptEmbedding.join(',')}]`;
    const retrievalLimit = limit || this.config.retrievalCount;

    const result = await executeStatement({
      sql: `
        SELECT 
          id, tenant_id, user_id, conversation_id, message_id,
          prompt_text, response_text, response_structure,
          rating, explicit_feedback, implicit_signals,
          domain_id, orchestration_mode, model_used, task_type,
          times_retrieved, last_retrieved_at, retrieval_success_rate,
          created_at,
          1 - (prompt_embedding <=> :embedding::vector) as similarity
        FROM user_gold_interactions
        WHERE user_id = :userId::uuid
          AND rating >= :minRating
          ${taskType ? 'AND task_type = :taskType' : ''}
        ORDER BY prompt_embedding <=> :embedding::vector
        LIMIT :limit
      `,
      parameters: [
        stringParam('userId', userId),
        stringParam('embedding', embeddingStr),
        numberParam('minRating', this.config.minRatingForGold),
        numberParam('limit', retrievalLimit),
        ...(taskType ? [stringParam('taskType', taskType)] : []),
      ],
    });

    const matches: GoldInteractionMatch[] = [];
    
    for (const row of result.rows || []) {
      const similarity = parseFloat(row.similarity);
      
      // Filter by similarity threshold
      if (similarity < this.config.similarityThreshold) continue;

      matches.push({
        interaction: {
          id: row.id,
          tenantId: row.tenant_id,
          userId: row.user_id,
          conversationId: row.conversation_id,
          messageId: row.message_id,
          promptText: row.prompt_text,
          responseText: row.response_text,
          responseStructure: row.response_structure,
          rating: row.rating,
          explicitFeedback: row.explicit_feedback,
          implicitSignals: row.implicit_signals,
          domainId: row.domain_id,
          orchestrationMode: row.orchestration_mode,
          modelUsed: row.model_used,
          taskType: row.task_type,
          timesRetrieved: row.times_retrieved,
          lastRetrievedAt: row.last_retrieved_at ? new Date(row.last_retrieved_at) : undefined,
          retrievalSuccessRate: row.retrieval_success_rate,
          createdAt: new Date(row.created_at),
        },
        similarity,
      });
    }

    // Update retrieval stats for returned interactions
    if (matches.length > 0) {
      const ids = matches.map(m => m.interaction.id);
      await this.updateRetrievalStats(ids);
    }

    return matches;
  }

  /**
   * Update retrieval statistics
   */
  private async updateRetrievalStats(interactionIds: string[]): Promise<void> {
    await executeStatement({
      sql: `
        UPDATE user_gold_interactions
        SET times_retrieved = times_retrieved + 1,
            last_retrieved_at = NOW()
        WHERE id = ANY(:ids::uuid[])
      `,
      parameters: [
        stringParam('ids', `{${interactionIds.join(',')}}`),
      ],
    });
  }

  /**
   * Format gold interactions as few-shot examples for system prompt
   */
  formatAsFewShotExamples(matches: GoldInteractionMatch[]): string {
    if (matches.length === 0) return '';

    const examples = matches.map((match, i) => {
      const structure = match.interaction.responseStructure;
      const structureHint = structure?.format 
        ? `[Format: ${structure.format}${structure.tone ? `, Tone: ${structure.tone}` : ''}]`
        : '';

      return `
<example_${i + 1}>
<user_query>${match.interaction.promptText}</user_query>
<preferred_response>${match.interaction.responseText}</preferred_response>
${structureHint}
</example_${i + 1}>`;
    }).join('\n');

    return `
The user has rated the following interactions highly. Use them as guidance for tone, format, and style:
${examples}
`;
  }

  /**
   * Record that a retrieval led to a good outcome
   */
  async recordRetrievalSuccess(
    interactionId: string,
    wasSuccessful: boolean
  ): Promise<void> {
    await executeStatement({
      sql: `
        UPDATE user_gold_interactions
        SET retrieval_success_rate = COALESCE(
          (retrieval_success_rate * (times_retrieved - 1) + :success) / times_retrieved,
          :success::decimal
        )
        WHERE id = :id::uuid
      `,
      parameters: [
        stringParam('id', interactionId),
        numberParam('success', wasSuccessful ? 1 : 0),
      ],
    });
  }

  /**
   * Get user's gold interaction stats
   */
  async getUserStats(userId: string): Promise<{
    totalInteractions: number;
    avgRating: number;
    topTaskTypes: { type: string; count: number }[];
    avgRetrievalSuccess: number;
  }> {
    const result = await executeStatement({
      sql: `
        SELECT 
          COUNT(*) as total,
          AVG(rating) as avg_rating,
          AVG(COALESCE(retrieval_success_rate, 0)) as avg_retrieval_success
        FROM user_gold_interactions
        WHERE user_id = :userId::uuid
      `,
      parameters: [stringParam('userId', userId)],
    });

    const taskResult = await executeStatement({
      sql: `
        SELECT task_type, COUNT(*) as count
        FROM user_gold_interactions
        WHERE user_id = :userId::uuid AND task_type IS NOT NULL
        GROUP BY task_type
        ORDER BY count DESC
        LIMIT 5
      `,
      parameters: [stringParam('userId', userId)],
    });

    const row = result.rows?.[0];
    return {
      totalInteractions: parseInt(row?.total || '0'),
      avgRating: parseFloat(row?.avg_rating || '0'),
      avgRetrievalSuccess: parseFloat(row?.avg_retrieval_success || '0'),
      topTaskTypes: (taskResult.rows || []).map(r => ({
        type: r.task_type,
        count: parseInt(r.count),
      })),
    };
  }

  /**
   * Delete old or low-performing gold interactions
   */
  async cleanup(userId: string): Promise<number> {
    const result = await executeStatement({
      sql: `
        DELETE FROM user_gold_interactions
        WHERE user_id = :userId::uuid
          AND (
            -- Delete if retrieval success rate is below 30% after 5+ retrievals
            (times_retrieved >= 5 AND retrieval_success_rate < 0.3)
            -- Or if older than 6 months and never retrieved
            OR (created_at < NOW() - INTERVAL '6 months' AND times_retrieved = 0)
          )
        RETURNING id
      `,
      parameters: [stringParam('userId', userId)],
    });

    return result.rows?.length || 0;
  }

  setConfig(config: Partial<SuccessMemoryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): SuccessMemoryConfig {
    return { ...this.config };
  }
}

export const successMemoryService = new SuccessMemoryService();
