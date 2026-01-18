// RADIANT v5.12.4 - Episode Logger Service
// Tracks behavioral episodes (state transitions) rather than raw chat logs
// Captures how users solve problems with rich feedback signals
// Uses PersistenceGuard for atomic writes with integrity checks

import { executeStatement, stringParam, doubleParam, boolParam, longParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { v4 as uuidv4 } from 'uuid';
import { persistenceGuard } from './persistence-guard.service';

// ============================================================================
// Types
// ============================================================================

export interface EpisodeMetrics {
  paste_back_error: boolean;
  edit_distance: number;
  time_to_commit_ms: number | null;
  user_edits_count: number;
  session_abandoned: boolean;
  sandbox_passed: boolean | null;
  confidence_at_generation: number;
}

export interface ToolStep {
  tool: string;
  status: 'success' | 'fail' | 'pending' | 'skipped';
  error_type?: string;
  duration_ms?: number;
  input_hash?: string;
  output_hash?: string;
}

export interface Episode {
  episode_id: string;
  tenant_id: string;
  user_id: string;
  session_id: string;
  goal_intent: string;
  workflow_trace: ToolStep[];
  outcome_signal: 'positive' | 'negative' | 'neutral' | 'pending';
  metrics: EpisodeMetrics;
  draft_content?: string;
  final_content?: string;
  created_at: Date;
  completed_at?: Date;
}

export interface EpisodeCreateInput {
  tenant_id: string;
  user_id: string;
  session_id: string;
  goal_intent: string;
  draft_content?: string;
}

// ============================================================================
// Episode Logger Service
// ============================================================================

class EpisodeLoggerService {
  private activeEpisodes: Map<string, Episode> = new Map();
  private initialized = false;

  // Schema for episode validation - enforces data completeness
  private static readonly EPISODE_SCHEMA: Record<string, string> = {
    episode_id: 'string',
    tenant_id: 'string',
    user_id: 'string',
    session_id: 'string',
    goal_intent: 'string',
    workflow_trace: 'array',
    outcome_signal: 'string',
    metrics: 'object',
  };

  /**
   * Initialize service and restore active episodes from database
   * Uses PersistenceGuard for integrity verification
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // First, recover any incomplete transactions
      const tenantId = process.env.DEFAULT_TENANT_ID || 'system';
      await persistenceGuard.recoverIncompleteTransactions(tenantId);

      const result = await executeStatement(
        `SELECT episode_id, episode_data FROM active_episodes_cache WHERE expires_at > NOW()`,
        []
      );

      let restored = 0;
      let skipped = 0;

      for (const row of (result.rows || []) as Array<{ episode_id: string; episode_data: string }>) {
        try {
          const episode = JSON.parse(row.episode_data) as Episode;
          
          // Validate data completeness using PersistenceGuard
          const validation = persistenceGuard.validateForPersistence(episode, EpisodeLoggerService.EPISODE_SCHEMA);
          if (!validation.valid) {
            logger.warn('Skipping incomplete episode on restore', { 
              episodeId: row.episode_id, 
              errors: validation.errors 
            });
            skipped++;
            continue;
          }

          episode.created_at = new Date(episode.created_at);
          if (episode.completed_at) {
            episode.completed_at = new Date(episode.completed_at);
          }
          this.activeEpisodes.set(row.episode_id, episode);
          restored++;
        } catch (error) {
          logger.warn('Skipping malformed episode', { episodeId: row.episode_id, error });
          skipped++;
        }
      }

      this.initialized = true;
      logger.info('Episode Logger initialized', { restored, skipped });
    } catch (error) {
      logger.error('Failed to initialize Episode Logger', { error });
      this.initialized = true; // Continue without restored data
    }
  }

  /**
   * Persist an active episode to database cache
   * Uses PersistenceGuard for atomic writes with integrity verification
   */
  private async persistActiveEpisode(episode: Episode): Promise<void> {
    // Validate data completeness BEFORE persisting - NO EXCEPTIONS
    const validation = persistenceGuard.validateForPersistence(episode, EpisodeLoggerService.EPISODE_SCHEMA);
    if (!validation.valid) {
      logger.error('Cannot persist incomplete episode', { 
        episodeId: episode.episode_id, 
        errors: validation.errors 
      });
      throw new Error(`Episode validation failed: ${validation.errors.join(', ')}`);
    }

    try {
      // Use atomic persistence with checksum
      await persistenceGuard.persistAtomic(
        episode.tenant_id,
        'active_episodes_cache',
        episode.episode_id,
        episode,
        EpisodeLoggerService.EPISODE_SCHEMA
      );

      // Also write to the cache table for quick access
      await executeStatement(
        `INSERT INTO active_episodes_cache (
          episode_id, tenant_id, user_id, session_id, episode_data, 
          last_activity_at, expires_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW() + INTERVAL '1 hour')
        ON CONFLICT (episode_id) DO UPDATE SET
          episode_data = EXCLUDED.episode_data,
          last_activity_at = NOW(),
          expires_at = NOW() + INTERVAL '1 hour'`,
        [
          stringParam('episodeId', episode.episode_id),
          stringParam('tenantId', episode.tenant_id),
          stringParam('userId', episode.user_id),
          stringParam('sessionId', episode.session_id),
          stringParam('episodeData', JSON.stringify(episode)),
        ]
      );

      logger.debug('Episode persisted with integrity check', { 
        episodeId: episode.episode_id, 
        checksum: validation.checksum 
      });
    } catch (error) {
      logger.error('Failed to persist active episode', { episodeId: episode.episode_id, error });
      throw error;
    }
  }

  /**
   * Remove episode from persistence cache
   */
  private async removeFromCache(episodeId: string): Promise<void> {
    try {
      await executeStatement(
        `DELETE FROM active_episodes_cache WHERE episode_id = $1`,
        [stringParam('episodeId', episodeId)]
      );
    } catch (error) {
      logger.error('Failed to remove episode from cache', { episodeId, error });
    }
  }

  /**
   * Start a new episode for tracking
   */
  async startEpisode(input: EpisodeCreateInput): Promise<string> {
    await this.initialize();
    const episodeId = uuidv4();
    
    const episode: Episode = {
      episode_id: episodeId,
      tenant_id: input.tenant_id,
      user_id: input.user_id,
      session_id: input.session_id,
      goal_intent: input.goal_intent,
      workflow_trace: [],
      outcome_signal: 'pending',
      metrics: {
        paste_back_error: false,
        edit_distance: 0,
        time_to_commit_ms: null,
        user_edits_count: 0,
        session_abandoned: false,
        sandbox_passed: null,
        confidence_at_generation: 0.5,
      },
      draft_content: input.draft_content,
      created_at: new Date(),
    };

    this.activeEpisodes.set(episodeId, episode);

    // Persist to cache for restart recovery
    await this.persistActiveEpisode(episode);

    await executeStatement(
      `INSERT INTO learning_episodes (
        episode_id, tenant_id, user_id, session_id, goal_intent,
        workflow_trace, outcome_signal, metrics, draft_content, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        stringParam('episodeId', episodeId),
        stringParam('tenantId', input.tenant_id),
        stringParam('userId', input.user_id),
        stringParam('sessionId', input.session_id),
        stringParam('goalIntent', input.goal_intent),
        stringParam('workflowTrace', JSON.stringify([])),
        stringParam('outcomeSignal', 'pending'),
        stringParam('metrics', JSON.stringify(episode.metrics)),
        stringParam('draftContent', input.draft_content || ''),
        stringParam('createdAt', episode.created_at.toISOString()),
      ]
    );

    logger.info('Episode started', { episodeId, goalIntent: input.goal_intent });
    return episodeId;
  }

  /**
   * Add a tool step to an active episode
   */
  async addToolStep(episodeId: string, step: ToolStep): Promise<void> {
    const episode = this.activeEpisodes.get(episodeId);
    if (!episode) {
      logger.warn('Episode not found in memory, fetching from DB', { episodeId });
      return;
    }

    episode.workflow_trace.push(step);

    await executeStatement(
      `UPDATE learning_episodes 
       SET workflow_trace = $2, updated_at = NOW()
       WHERE episode_id = $1`,
      [
        stringParam('episodeId', episodeId),
        stringParam('workflowTrace', JSON.stringify(episode.workflow_trace)),
      ]
    );
  }

  /**
   * Record a paste-back error (user pasted error immediately after generation)
   * This is the STRONGEST negative signal available
   */
  async recordPasteBackError(episodeId: string): Promise<void> {
    const episode = this.activeEpisodes.get(episodeId);
    if (!episode) return;

    episode.metrics.paste_back_error = true;
    episode.outcome_signal = 'negative';

    await this.updateMetrics(episodeId, episode.metrics);
    await this.updateOutcomeSignal(episodeId, 'negative');

    logger.info('Paste-back error recorded', { episodeId });
  }

  /**
   * Record user edits to the AI-generated content
   * Calculates edit distance between draft and final
   */
  async recordUserEdit(
    episodeId: string,
    finalContent: string
  ): Promise<void> {
    const episode = this.activeEpisodes.get(episodeId);
    if (!episode) return;

    episode.final_content = finalContent;
    episode.metrics.user_edits_count++;

    if (episode.draft_content) {
      episode.metrics.edit_distance = this.calculateEditDistance(
        episode.draft_content,
        finalContent
      );
    }

    await executeStatement(
      `UPDATE learning_episodes 
       SET final_content = $2, metrics = $3, updated_at = NOW()
       WHERE episode_id = $1`,
      [
        stringParam('episodeId', episodeId),
        stringParam('finalContent', finalContent),
        stringParam('metrics', JSON.stringify(episode.metrics)),
      ]
    );
  }

  /**
   * Record sandbox execution result
   */
  async recordSandboxResult(episodeId: string, passed: boolean): Promise<void> {
    const episode = this.activeEpisodes.get(episodeId);
    if (!episode) return;

    episode.metrics.sandbox_passed = passed;
    
    if (!passed) {
      episode.outcome_signal = 'negative';
    }

    await this.updateMetrics(episodeId, episode.metrics);
  }

  /**
   * Record time to commit (git commit after code generation)
   */
  async recordCommit(episodeId: string): Promise<void> {
    const episode = this.activeEpisodes.get(episodeId);
    if (!episode) return;

    const now = Date.now();
    episode.metrics.time_to_commit_ms = now - episode.created_at.getTime();

    await this.updateMetrics(episodeId, episode.metrics);
  }

  /**
   * Complete an episode with final outcome
   */
  async completeEpisode(
    episodeId: string,
    outcome?: 'positive' | 'negative' | 'neutral'
  ): Promise<Episode | null> {
    const episode = this.activeEpisodes.get(episodeId);
    if (!episode) return null;

    // Determine outcome if not provided
    if (!outcome) {
      outcome = this.deriveOutcome(episode);
    }

    episode.outcome_signal = outcome;
    episode.completed_at = new Date();

    await executeStatement(
      `UPDATE learning_episodes 
       SET outcome_signal = $2, metrics = $3, completed_at = $4, updated_at = NOW()
       WHERE episode_id = $1`,
      [
        stringParam('episodeId', episodeId),
        stringParam('outcomeSignal', outcome),
        stringParam('metrics', JSON.stringify(episode.metrics)),
        stringParam('completedAt', episode.completed_at.toISOString()),
      ]
    );

    this.activeEpisodes.delete(episodeId);

    // Remove from persistence cache
    await this.removeFromCache(episodeId);

    logger.info('Episode completed', { episodeId, outcome });
    return episode;
  }

  /**
   * Mark episode as abandoned (user left without completing)
   */
  async abandonEpisode(episodeId: string): Promise<void> {
    const episode = this.activeEpisodes.get(episodeId);
    if (!episode) return;

    episode.metrics.session_abandoned = true;
    episode.outcome_signal = 'negative';

    await this.completeEpisode(episodeId, 'negative');
  }

  /**
   * Get episodes for training (positive or negative outcomes)
   */
  async getTrainingEpisodes(
    tenantId: string,
    options: {
      outcome?: 'positive' | 'negative';
      limit?: number;
      since?: Date;
    } = {}
  ): Promise<Episode[]> {
    let query = `
      SELECT * FROM learning_episodes 
      WHERE tenant_id = $1 
      AND completed_at IS NOT NULL
    `;
    const params = [stringParam('tenantId', tenantId)];

    if (options.outcome) {
      query += ` AND outcome_signal = $${params.length + 1}`;
      params.push(stringParam('outcome', options.outcome));
    }

    if (options.since) {
      query += ` AND completed_at > $${params.length + 1}`;
      params.push(stringParam('since', options.since.toISOString()));
    }

    query += ` ORDER BY completed_at DESC LIMIT $${params.length + 1}`;
    params.push(longParam('limit', options.limit || 100));

    const result = await executeStatement(query, params);
    
    return (result.rows || []).map((row: Record<string, unknown>) => ({
      episode_id: row.episode_id as string,
      tenant_id: row.tenant_id as string,
      user_id: row.user_id as string,
      session_id: row.session_id as string,
      goal_intent: row.goal_intent as string,
      workflow_trace: JSON.parse(row.workflow_trace as string || '[]'),
      outcome_signal: row.outcome_signal as Episode['outcome_signal'],
      metrics: JSON.parse(row.metrics as string || '{}'),
      draft_content: row.draft_content as string,
      final_content: row.final_content as string,
      created_at: new Date(row.created_at as string),
      completed_at: row.completed_at ? new Date(row.completed_at as string) : undefined,
    }));
  }

  /**
   * Get DPO training pairs (winner/loser) for Cato training
   */
  async getDPOTrainingPairs(
    limit: number = 100,
    since?: Date
  ): Promise<Array<{ winner: Episode; loser: Episode }>> {
    const positiveEpisodes = await this.getGlobalTrainingEpisodes('positive', limit, since);
    const negativeEpisodes = await this.getGlobalTrainingEpisodes('negative', limit, since);

    const pairs: Array<{ winner: Episode; loser: Episode }> = [];

    // Match by similar goal_intent
    for (const winner of positiveEpisodes) {
      const loser = negativeEpisodes.find(
        (e) => this.isSimilarIntent(winner.goal_intent, e.goal_intent)
      );
      if (loser) {
        pairs.push({ winner, loser });
      }
    }

    return pairs;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async updateMetrics(episodeId: string, metrics: EpisodeMetrics): Promise<void> {
    await executeStatement(
      `UPDATE learning_episodes SET metrics = $2, updated_at = NOW() WHERE episode_id = $1`,
      [
        stringParam('episodeId', episodeId),
        stringParam('metrics', JSON.stringify(metrics)),
      ]
    );
  }

  private async updateOutcomeSignal(
    episodeId: string,
    outcome: Episode['outcome_signal']
  ): Promise<void> {
    await executeStatement(
      `UPDATE learning_episodes SET outcome_signal = $2, updated_at = NOW() WHERE episode_id = $1`,
      [
        stringParam('episodeId', episodeId),
        stringParam('outcome', outcome),
      ]
    );
  }

  private deriveOutcome(episode: Episode): 'positive' | 'negative' | 'neutral' {
    const { metrics } = episode;

    // Strong negative signals
    if (metrics.paste_back_error) return 'negative';
    if (metrics.session_abandoned) return 'negative';
    if (metrics.sandbox_passed === false) return 'negative';

    // Strong positive signals
    if (metrics.sandbox_passed && metrics.edit_distance < 0.1) return 'positive';
    if (metrics.time_to_commit_ms && metrics.time_to_commit_ms < 60000) return 'positive';

    // Moderate signals
    if (metrics.edit_distance < 0.3) return 'positive';
    if (metrics.edit_distance > 0.7) return 'negative';

    return 'neutral';
  }

  private calculateEditDistance(draft: string, final: string): number {
    if (!draft || !final) return 0;
    
    // Levenshtein distance normalized by length
    const maxLen = Math.max(draft.length, final.length);
    if (maxLen === 0) return 0;

    const distance = this.levenshtein(draft, final);
    return distance / maxLen;
  }

  private levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  private async getGlobalTrainingEpisodes(
    outcome: 'positive' | 'negative',
    limit: number,
    since?: Date
  ): Promise<Episode[]> {
    let query = `
      SELECT * FROM learning_episodes 
      WHERE outcome_signal = $1 
      AND completed_at IS NOT NULL
    `;
    const params = [stringParam('outcome', outcome)];

    if (since) {
      query += ` AND completed_at > $${params.length + 1}`;
      params.push(stringParam('since', since.toISOString()));
    }

    query += ` ORDER BY completed_at DESC LIMIT $${params.length + 1}`;
    params.push(longParam('limit', limit));

    const result = await executeStatement(query, params);
    
    return (result.rows || []).map((row: Record<string, unknown>) => ({
      episode_id: row.episode_id as string,
      tenant_id: row.tenant_id as string,
      user_id: row.user_id as string,
      session_id: row.session_id as string,
      goal_intent: row.goal_intent as string,
      workflow_trace: JSON.parse(row.workflow_trace as string || '[]'),
      outcome_signal: row.outcome_signal as Episode['outcome_signal'],
      metrics: JSON.parse(row.metrics as string || '{}'),
      draft_content: row.draft_content as string,
      final_content: row.final_content as string,
      created_at: new Date(row.created_at as string),
      completed_at: row.completed_at ? new Date(row.completed_at as string) : undefined,
    }));
  }

  private isSimilarIntent(a: string, b: string): boolean {
    // Simple similarity check - could be enhanced with embeddings
    const wordsA = a.toLowerCase().split(/\s+/);
    const wordsB = b.toLowerCase().split(/\s+/);
    const intersection = wordsA.filter((w) => wordsB.includes(w));
    return intersection.length >= Math.min(wordsA.length, wordsB.length) * 0.5;
  }
}

export const episodeLoggerService = new EpisodeLoggerService();
