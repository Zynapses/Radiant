// AGI Persistent Learning Service
// Learns from prompts and ideas to improve future suggestions

import { executeStatement, stringParam } from '../db/client';
import crypto from 'crypto';

export interface LearnedPrompt {
  id: string;
  promptText: string;
  promptHash: string;
  promptCategory: string;
  domainId?: string;
  domainName?: string;
  timesUsed: number;
  avgRating?: number;
  successRate?: number;
  bestOrchestrationMode?: string;
  bestModel?: string;
  commonRefinements?: string[];
  commonFollowUps?: string[];
}

export interface LearnedIdea {
  id: string;
  ideaCategory: string;
  ideaTitleTemplate: string;
  ideaDescriptionTemplate: string;
  suggestedPromptTemplate?: string;
  timesShown: number;
  timesClicked: number;
  clickRate: number;
  avgFollowUpRating?: number;
}

export interface LearningEvent {
  id: string;
  eventType: 'prompt_submitted' | 'idea_clicked' | 'response_rated' | 'suggestion_selected';
  promptText?: string;
  promptHash?: string;
  ideaId?: string;
  rating?: number;
  orchestrationMode?: string;
  domainId?: string;
}

class AGILearningService {
  /**
   * Learn from a submitted prompt
   */
  async learnFromPrompt(
    tenantId: string,
    userId: string,
    promptText: string,
    options: {
      domainId?: string;
      domainName?: string;
      orchestrationMode?: string;
      rating?: number;
      embedding?: number[];
    } = {}
  ): Promise<string> {
    const embeddingStr = options.embedding 
      ? `[${options.embedding.join(',')}]` 
      : null;

    const result = await executeStatement({
      sql: `
        SELECT learn_from_prompt(
          $1::uuid,
          $2::uuid,
          $3,
          ${embeddingStr ? '$4::vector' : 'NULL'},
          $5::uuid,
          $6,
          $7,
          $8
        ) as learned_id
      `,
      parameters: [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('promptText', promptText),
        ...(embeddingStr ? [stringParam('embedding', embeddingStr)] : []),
        stringParam('domainId', options.domainId || ''),
        stringParam('domainName', options.domainName || ''),
        stringParam('orchestrationMode', options.orchestrationMode || ''),
        stringParam('rating', options.rating ? String(options.rating) : ''),
      ],
    });

    return result.rows?.[0]?.learned_id || '';
  }

  /**
   * Learn from an idea click
   */
  async learnFromIdeaClick(
    tenantId: string,
    userId: string,
    ideaId: string,
    options: {
      sourcePromptHash?: string;
      ideaCategory?: string;
      ideaTitle?: string;
      suggestedPrompt?: string;
    } = {}
  ): Promise<void> {
    await executeStatement({
      sql: `
        SELECT learn_from_idea_click(
          $1::uuid,
          $2::uuid,
          $3::uuid,
          $4,
          $5,
          $6,
          $7
        )
      `,
      parameters: [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('ideaId', ideaId),
        stringParam('sourcePromptHash', options.sourcePromptHash || ''),
        stringParam('ideaCategory', options.ideaCategory || ''),
        stringParam('ideaTitle', options.ideaTitle || ''),
        stringParam('suggestedPrompt', options.suggestedPrompt || ''),
      ],
    });
  }

  /**
   * Record outcome for a learning event (e.g., user rated the response)
   */
  async recordOutcome(
    eventId: string,
    rating: number,
    success?: boolean
  ): Promise<void> {
    await executeStatement({
      sql: `SELECT record_learning_outcome($1::uuid, $2, $3)`,
      parameters: [
        stringParam('eventId', eventId),
        stringParam('rating', String(rating)),
        stringParam('success', success !== undefined ? String(success) : ''),
      ],
    });
  }

  /**
   * Get learned ideas for a prompt
   */
  async getLearnedIdeasForPrompt(
    tenantId: string,
    promptText: string,
    domainId?: string,
    limit: number = 5
  ): Promise<LearnedIdea[]> {
    const promptHash = crypto.createHash('sha256').update(promptText).digest('hex');

    const result = await executeStatement({
      sql: `
        SELECT * FROM get_learned_ideas_for_prompt(
          $1::uuid,
          $2,
          $3::uuid,
          $4
        )
      `,
      parameters: [
        stringParam('tenantId', tenantId),
        stringParam('promptHash', promptHash),
        stringParam('domainId', domainId || ''),
        stringParam('limit', String(limit)),
      ],
    });

    return (result.rows || []).map(row => ({
      id: row.idea_id as string,
      ideaCategory: row.idea_category as string,
      ideaTitleTemplate: row.idea_title as string,
      ideaDescriptionTemplate: '',
      suggestedPromptTemplate: row.suggested_prompt as string,
      timesShown: 0,
      timesClicked: 0,
      clickRate: parseFloat(row.click_rate as string) || 0,
    }));
  }

  /**
   * Get similar learned prompts
   */
  async getSimilarLearnedPrompts(
    tenantId: string,
    promptEmbedding: number[],
    limit: number = 5
  ): Promise<LearnedPrompt[]> {
    const embeddingStr = `[${promptEmbedding.join(',')}]`;

    const result = await executeStatement({
      sql: `
        SELECT 
          id, prompt_text, prompt_hash, prompt_category,
          domain_id, domain_name, times_used, avg_rating,
          success_rate, best_orchestration_mode, best_model,
          common_refinements, common_follow_ups,
          1 - (prompt_embedding <=> $1::vector) as similarity
        FROM agi_learned_prompts
        WHERE tenant_id = $2::uuid
          AND prompt_embedding IS NOT NULL
          AND success_rate > 0.5
        ORDER BY prompt_embedding <=> $1::vector
        LIMIT $3
      `,
      parameters: [
        stringParam('embedding', embeddingStr),
        stringParam('tenantId', tenantId),
        stringParam('limit', String(limit)),
      ],
    });

    return (result.rows || []).map(row => ({
      id: row.id as string,
      promptText: row.prompt_text as string,
      promptHash: row.prompt_hash as string,
      promptCategory: row.prompt_category as string,
      domainId: row.domain_id as string,
      domainName: row.domain_name as string,
      timesUsed: parseInt(row.times_used as string) || 0,
      avgRating: parseFloat(row.avg_rating as string),
      successRate: parseFloat(row.success_rate as string),
      bestOrchestrationMode: row.best_orchestration_mode as string,
      bestModel: row.best_model as string,
      commonRefinements: row.common_refinements as string[],
      commonFollowUps: row.common_follow_ups as string[],
    }));
  }

  /**
   * Record a prompt refinement (when user edits their prompt)
   */
  async recordPromptRefinement(
    tenantId: string,
    originalPromptHash: string,
    refinedPrompt: string
  ): Promise<void> {
    await executeStatement({
      sql: `
        UPDATE agi_learned_prompts
        SET common_refinements = array_append(
          COALESCE(common_refinements, '{}'),
          $1
        ),
        last_updated_at = NOW()
        WHERE tenant_id = $2::uuid
          AND prompt_hash = $3
      `,
      parameters: [
        stringParam('refinedPrompt', refinedPrompt),
        stringParam('tenantId', tenantId),
        stringParam('originalHash', originalPromptHash),
      ],
    });
  }

  /**
   * Record a follow-up prompt
   */
  async recordFollowUp(
    tenantId: string,
    originalPromptHash: string,
    followUpPrompt: string
  ): Promise<void> {
    await executeStatement({
      sql: `
        UPDATE agi_learned_prompts
        SET common_follow_ups = array_append(
          COALESCE(common_follow_ups, '{}'),
          $1
        ),
        last_updated_at = NOW()
        WHERE tenant_id = $2::uuid
          AND prompt_hash = $3
      `,
      parameters: [
        stringParam('followUpPrompt', followUpPrompt),
        stringParam('tenantId', tenantId),
        stringParam('originalHash', originalPromptHash),
      ],
    });
  }

  /**
   * Get learning statistics for a tenant
   */
  async getLearningStats(tenantId: string): Promise<{
    totalLearnedPrompts: number;
    totalLearnedIdeas: number;
    avgPromptSuccessRate: number;
    avgIdeaClickRate: number;
    topCategories: { category: string; count: number }[];
  }> {
    const promptStats = await executeStatement({
      sql: `
        SELECT 
          COUNT(*) as total,
          AVG(success_rate) as avg_success_rate
        FROM agi_learned_prompts
        WHERE tenant_id = $1::uuid
      `,
      parameters: [stringParam('tenantId', tenantId)],
    });

    const ideaStats = await executeStatement({
      sql: `
        SELECT 
          COUNT(*) as total,
          AVG(click_rate) as avg_click_rate
        FROM agi_learned_ideas
        WHERE tenant_id = $1::uuid
      `,
      parameters: [stringParam('tenantId', tenantId)],
    });

    const categoryStats = await executeStatement({
      sql: `
        SELECT prompt_category as category, COUNT(*) as count
        FROM agi_learned_prompts
        WHERE tenant_id = $1::uuid
        GROUP BY prompt_category
        ORDER BY count DESC
        LIMIT 5
      `,
      parameters: [stringParam('tenantId', tenantId)],
    });

    const promptRow = promptStats.rows?.[0] || {};
    const ideaRow = ideaStats.rows?.[0] || {};

    return {
      totalLearnedPrompts: parseInt(promptRow.total as string) || 0,
      totalLearnedIdeas: parseInt(ideaRow.total as string) || 0,
      avgPromptSuccessRate: parseFloat(promptRow.avg_success_rate as string) || 0,
      avgIdeaClickRate: parseFloat(ideaRow.avg_click_rate as string) || 0,
      topCategories: (categoryStats.rows || []).map(row => ({
        category: row.category as string,
        count: parseInt(row.count as string) || 0,
      })),
    };
  }

  /**
   * Helper to generate prompt hash
   */
  generatePromptHash(promptText: string): string {
    return crypto.createHash('sha256').update(promptText).digest('hex');
  }
}

export const agiLearningService = new AGILearningService();
