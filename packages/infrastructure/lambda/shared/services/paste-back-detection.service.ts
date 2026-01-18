// RADIANT v5.12.0 - Paste-Back Detection Service
// Detects when users paste errors immediately after AI generation
// "The strongest negative signal available"

import { executeStatement, stringParam, longParam, boolParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { episodeLoggerService } from './episode-logger.service';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface PasteBackEvent {
  id: string;
  episode_id: string;
  tenant_id: string;
  user_id: string;
  pasted_content_hash: string;
  time_since_generation_ms: number;
  is_error_content: boolean;
  created_at: Date;
}

export interface PasteBackConfig {
  enabled: boolean;
  detection_window_ms: number;
  error_patterns: string[];
  min_content_length: number;
}

export interface PasteBackStats {
  total_paste_backs: number;
  error_paste_backs: number;
  avg_time_to_paste_ms: number;
  paste_back_rate: number;
}

// ============================================================================
// Paste-Back Detection Service
// ============================================================================

class PasteBackDetectionService {
  private initialized = false;
  private readonly defaultConfig: PasteBackConfig = {
    enabled: true,
    detection_window_ms: 30000, // 30 seconds
    error_patterns: [
      'error:',
      'Error:',
      'ERROR:',
      'exception',
      'Exception',
      'EXCEPTION',
      'Traceback',
      'TypeError',
      'ReferenceError',
      'SyntaxError',
      'failed',
      'FAILED',
      'undefined is not',
      'cannot read property',
      'is not defined',
      'stack trace',
      'at line',
      'npm ERR!',
      'ENOENT',
      'EACCES',
      'Module not found',
      'Cannot find module',
      'Unexpected token',
      'Invalid',
      'INVALID',
    ],
    min_content_length: 20,
  };

  // Track recent generations for correlation
  private recentGenerations: Map<string, { episodeId: string; timestamp: number }> = new Map();

  /**
   * Initialize service and restore recent generations from database
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const result = await executeStatement(
        `SELECT cache_key, episode_id, generated_at FROM recent_generations_cache WHERE expires_at > NOW()`,
        []
      );

      for (const row of (result.rows || []) as Array<{ cache_key: string; episode_id: string; generated_at: string }>) {
        this.recentGenerations.set(row.cache_key, {
          episodeId: row.episode_id,
          timestamp: new Date(row.generated_at).getTime(),
        });
      }

      this.initialized = true;
      logger.info('Paste-Back Detection initialized', { restoredGenerations: this.recentGenerations.size });
    } catch (error) {
      logger.error('Failed to initialize Paste-Back Detection', { error });
      this.initialized = true;
    }
  }

  /**
   * Persist a recent generation to database
   */
  private async persistGeneration(
    key: string,
    tenantId: string,
    userId: string,
    sessionId: string,
    episodeId: string,
    timestamp: number
  ): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO recent_generations_cache (
          cache_key, tenant_id, user_id, session_id, episode_id, generated_at, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '5 minutes')
        ON CONFLICT (cache_key) DO UPDATE SET
          episode_id = EXCLUDED.episode_id,
          generated_at = EXCLUDED.generated_at,
          expires_at = NOW() + INTERVAL '5 minutes'`,
        [
          stringParam('cacheKey', key),
          stringParam('tenantId', tenantId),
          stringParam('userId', userId),
          stringParam('sessionId', sessionId),
          stringParam('episodeId', episodeId),
          stringParam('generatedAt', new Date(timestamp).toISOString()),
        ]
      );
    } catch (error) {
      logger.error('Failed to persist generation', { key, error });
    }
  }

  /**
   * Remove a generation from persistence
   */
  private async removeGenerationFromCache(key: string): Promise<void> {
    try {
      await executeStatement(
        `DELETE FROM recent_generations_cache WHERE cache_key = $1`,
        [stringParam('cacheKey', key)]
      );
    } catch (error) {
      logger.error('Failed to remove generation from cache', { key, error });
    }
  }

  /**
   * Record that a generation just happened (call after AI responds)
   */
  async recordGeneration(
    tenantId: string,
    userId: string,
    sessionId: string,
    episodeId: string
  ): Promise<void> {
    await this.initialize();
    
    const key = `${tenantId}:${userId}:${sessionId}`;
    const timestamp = Date.now();
    
    this.recentGenerations.set(key, {
      episodeId,
      timestamp,
    });

    // Persist for restart recovery
    await this.persistGeneration(key, tenantId, userId, sessionId, episodeId, timestamp);

    // Cleanup old entries periodically
    if (Math.random() < 0.05) {
      this.cleanupOldGenerations();
    }
  }

  /**
   * Analyze user input for paste-back patterns
   * Call this when user sends a message
   */
  async analyzeInput(
    tenantId: string,
    userId: string,
    sessionId: string,
    content: string,
    config?: Partial<PasteBackConfig>
  ): Promise<PasteBackEvent | null> {
    const effectiveConfig = { ...this.defaultConfig, ...config };

    if (!effectiveConfig.enabled) {
      return null;
    }

    if (content.length < effectiveConfig.min_content_length) {
      return null;
    }

    const key = `${tenantId}:${userId}:${sessionId}`;
    const recentGen = this.recentGenerations.get(key);

    if (!recentGen) {
      return null;
    }

    const timeSinceGeneration = Date.now() - recentGen.timestamp;

    // Check if within detection window
    if (timeSinceGeneration > effectiveConfig.detection_window_ms) {
      return null;
    }

    // Check if content looks like an error
    const isError = this.detectErrorContent(content, effectiveConfig.error_patterns);

    if (!isError) {
      // Not an error paste-back, but could still be relevant
      // Only track if it looks like pasted content (multi-line, code-like)
      if (!this.looksLikePastedContent(content)) {
        return null;
      }
    }

    // Record the paste-back event
    const event = await this.recordPasteBack({
      episode_id: recentGen.episodeId,
      tenant_id: tenantId,
      user_id: userId,
      content,
      time_since_generation_ms: timeSinceGeneration,
      is_error_content: isError,
    });

    // If it's an error, this is a critical signal
    if (isError) {
      await episodeLoggerService.recordPasteBackError(recentGen.episodeId);
      logger.warn('Error paste-back detected', {
        episodeId: recentGen.episodeId,
        timeSinceMs: timeSinceGeneration,
      });
    }

    // Clear the generation tracking (one-time detection)
    this.recentGenerations.delete(key);
    await this.removeGenerationFromCache(key);

    return event;
  }

  /**
   * Get paste-back statistics for a tenant
   */
  async getStats(tenantId: string, since?: Date): Promise<PasteBackStats> {
    let query = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_error_content) as errors,
        AVG(time_since_generation_ms) as avg_time
      FROM paste_back_events
      WHERE tenant_id = $1
    `;
    const params = [stringParam('tenantId', tenantId)];

    if (since) {
      query += ` AND created_at > $2`;
      params.push(stringParam('since', since.toISOString()));
    }

    const result = await executeStatement(query, params);
    const stats = result.rows?.[0] as {
      total: number;
      errors: number;
      avg_time: number;
    } | undefined;

    // Get total episodes to calculate rate
    const episodesResult = await executeStatement(
      `SELECT COUNT(*) as count FROM learning_episodes WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    );
    const totalEpisodes = Number((episodesResult.rows?.[0] as { count: number })?.count || 1);

    return {
      total_paste_backs: Number(stats?.total || 0),
      error_paste_backs: Number(stats?.errors || 0),
      avg_time_to_paste_ms: Number(stats?.avg_time || 0),
      paste_back_rate: Number(stats?.total || 0) / totalEpisodes,
    };
  }

  /**
   * Get recent paste-back events for debugging
   */
  async getRecentEvents(
    tenantId: string,
    limit: number = 20
  ): Promise<PasteBackEvent[]> {
    const result = await executeStatement(
      `SELECT * FROM paste_back_events 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [
        stringParam('tenantId', tenantId),
        longParam('limit', limit),
      ]
    );

    return this.parseEventRows(result.rows || []);
  }

  /**
   * Get episodes with paste-back errors for analysis
   */
  async getProblematicEpisodes(
    tenantId: string,
    limit: number = 50
  ): Promise<Array<{ episode_id: string; paste_back_count: number; last_paste_back: Date }>> {
    const result = await executeStatement(
      `SELECT 
        episode_id,
        COUNT(*) as paste_back_count,
        MAX(created_at) as last_paste_back
       FROM paste_back_events
       WHERE tenant_id = $1 AND is_error_content = true
       GROUP BY episode_id
       ORDER BY paste_back_count DESC
       LIMIT $2`,
      [
        stringParam('tenantId', tenantId),
        longParam('limit', limit),
      ]
    );

    return (result.rows || []).map((row: unknown) => {
      const r = row as Record<string, unknown>;
      return {
        episode_id: r.episode_id as string,
        paste_back_count: Number(r.paste_back_count || 0),
        last_paste_back: new Date(r.last_paste_back as string),
      };
    });
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private detectErrorContent(content: string, patterns: string[]): boolean {
    const lowerContent = content.toLowerCase();

    for (const pattern of patterns) {
      if (lowerContent.includes(pattern.toLowerCase())) {
        return true;
      }
    }

    // Check for stack trace patterns
    if (/at\s+\w+\s+\(.+:\d+:\d+\)/.test(content)) {
      return true;
    }

    // Check for common error code patterns
    if (/exit code [1-9]|exit status [1-9]|returned [1-9]/i.test(content)) {
      return true;
    }

    return false;
  }

  private looksLikePastedContent(content: string): boolean {
    // Multi-line content
    if (content.split('\n').length > 3) {
      return true;
    }

    // Contains code-like patterns
    if (/[{}\[\]();]/.test(content)) {
      return true;
    }

    // Contains file paths
    if (/\/[\w/]+\.\w+/.test(content)) {
      return true;
    }

    // Contains common code keywords
    if (/\b(function|const|let|var|import|export|class|def|return)\b/.test(content)) {
      return true;
    }

    return false;
  }

  private async recordPasteBack(input: {
    episode_id: string;
    tenant_id: string;
    user_id: string;
    content: string;
    time_since_generation_ms: number;
    is_error_content: boolean;
  }): Promise<PasteBackEvent> {
    const id = uuidv4();
    const contentHash = crypto.createHash('sha256')
      .update(input.content)
      .digest('hex')
      .substring(0, 64);

    const event: PasteBackEvent = {
      id,
      episode_id: input.episode_id,
      tenant_id: input.tenant_id,
      user_id: input.user_id,
      pasted_content_hash: contentHash,
      time_since_generation_ms: input.time_since_generation_ms,
      is_error_content: input.is_error_content,
      created_at: new Date(),
    };

    await executeStatement(
      `INSERT INTO paste_back_events (
        id, episode_id, tenant_id, user_id, pasted_content_hash,
        time_since_generation_ms, is_error_content, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        stringParam('id', id),
        stringParam('episodeId', input.episode_id),
        stringParam('tenantId', input.tenant_id),
        stringParam('userId', input.user_id),
        stringParam('contentHash', contentHash),
        longParam('timeSince', input.time_since_generation_ms),
        boolParam('isError', input.is_error_content),
      ]
    );

    return event;
  }

  private cleanupOldGenerations(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    for (const [key, gen] of this.recentGenerations.entries()) {
      if (now - gen.timestamp > maxAge) {
        this.recentGenerations.delete(key);
      }
    }
  }

  private parseEventRows(rows: unknown[]): PasteBackEvent[] {
    return rows.map((row: unknown) => {
      const r = row as Record<string, unknown>;
      return {
        id: r.id as string,
        episode_id: r.episode_id as string,
        tenant_id: r.tenant_id as string,
        user_id: r.user_id as string,
        pasted_content_hash: r.pasted_content_hash as string,
        time_since_generation_ms: Number(r.time_since_generation_ms || 0),
        is_error_content: Boolean(r.is_error_content),
        created_at: new Date(r.created_at as string),
      };
    });
  }
}

export const pasteBackDetectionService = new PasteBackDetectionService();
