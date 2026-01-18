// RADIANT v5.12.0 - Tool Entropy Service
// Tracks tool co-occurrence patterns for auto-chaining
// "If users frequently chain Tool A and Tool B, auto-chain them"

import { executeStatement, stringParam, longParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

export interface ToolEntropyPattern {
  pattern_id: string;
  tenant_id: string | null;
  user_id: string | null;
  tool_a: string;
  tool_b: string;
  co_occurrence_count: number;
  avg_time_between_ms: number;
  is_auto_chain_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ToolChainSuggestion {
  tool_a: string;
  tool_b: string;
  confidence: number;
  reason: string;
  auto_chain_available: boolean;
}

export interface ToolUsageEvent {
  tenant_id: string;
  user_id: string;
  session_id: string;
  tool_name: string;
  timestamp: Date;
}

// ============================================================================
// Tool Entropy Service
// ============================================================================

class ToolEntropyService {
  private readonly AUTO_CHAIN_THRESHOLD = 5;
  private readonly TIME_WINDOW_MS = 60000; // 1 minute window for co-occurrence
  private recentToolUsage: Map<string, ToolUsageEvent[]> = new Map();
  private initialized = false;

  /**
   * Initialize service and restore tool usage sessions from database
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Get distinct session keys with recent activity
      const keysResult = await executeStatement(
        `SELECT DISTINCT session_key FROM tool_usage_sessions WHERE expires_at > NOW()`,
        []
      );

      for (const row of (keysResult.rows || []) as Array<{ session_key: string }>) {
        const usageResult = await executeStatement(
          `SELECT tool_name, used_at, tenant_id, user_id, session_id 
           FROM tool_usage_sessions 
           WHERE session_key = $1 AND expires_at > NOW()
           ORDER BY used_at DESC LIMIT 10`,
          [stringParam('sessionKey', row.session_key)]
        );

        const events: ToolUsageEvent[] = (usageResult.rows || []).map((r: unknown) => {
          const usage = r as { tool_name: string; used_at: string; tenant_id: string; user_id: string; session_id: string };
          return {
            tenant_id: usage.tenant_id,
            user_id: usage.user_id,
            session_id: usage.session_id,
            tool_name: usage.tool_name,
            timestamp: new Date(usage.used_at),
          };
        });

        if (events.length > 0) {
          this.recentToolUsage.set(row.session_key, events);
        }
      }

      this.initialized = true;
      logger.info('Tool Entropy initialized', { restoredSessions: this.recentToolUsage.size });
    } catch (error) {
      logger.error('Failed to initialize Tool Entropy', { error });
      this.initialized = true;
    }
  }

  /**
   * Persist a tool usage event to database
   */
  private async persistToolUsage(sessionKey: string, event: ToolUsageEvent): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO tool_usage_sessions (
          session_key, tenant_id, user_id, session_id, tool_name, used_at, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '10 minutes')`,
        [
          stringParam('sessionKey', sessionKey),
          stringParam('tenantId', event.tenant_id),
          stringParam('userId', event.user_id),
          stringParam('sessionId', event.session_id),
          stringParam('toolName', event.tool_name),
          stringParam('usedAt', event.timestamp.toISOString()),
        ]
      );
    } catch (error) {
      logger.error('Failed to persist tool usage', { sessionKey, error });
    }
  }

  /**
   * Record a tool usage event
   */
  async recordToolUsage(event: ToolUsageEvent): Promise<void> {
    await this.initialize();
    const sessionKey = `${event.tenant_id}:${event.user_id}:${event.session_id}`;
    
    // Get recent tools for this session
    const recentTools = this.recentToolUsage.get(sessionKey) || [];
    
    // Check for co-occurrence with recent tools
    for (const recent of recentTools) {
      const timeDiff = event.timestamp.getTime() - recent.timestamp.getTime();
      
      if (timeDiff <= this.TIME_WINDOW_MS && timeDiff > 0) {
        // Record co-occurrence
        await this.recordCoOccurrence(
          event.tenant_id,
          event.user_id,
          recent.tool_name,
          event.tool_name,
          timeDiff
        );
      }
    }

    // Add to recent tools (keep last 10)
    recentTools.push(event);
    if (recentTools.length > 10) {
      recentTools.shift();
    }
    this.recentToolUsage.set(sessionKey, recentTools);

    // Persist for restart recovery
    await this.persistToolUsage(sessionKey, event);

    // Clean up old sessions periodically
    if (Math.random() < 0.01) {
      this.cleanupOldSessions();
    }
  }

  /**
   * Get chain suggestions for a tool
   */
  async getChainSuggestions(
    tenantId: string,
    userId: string,
    currentTool: string,
    limit: number = 3
  ): Promise<ToolChainSuggestion[]> {
    // Get user-specific patterns
    const userResult = await executeStatement(
      `SELECT * FROM tool_entropy_patterns 
       WHERE tenant_id = $1 AND user_id = $2 AND tool_a = $3
       ORDER BY co_occurrence_count DESC
       LIMIT $4`,
      [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('toolA', currentTool),
        longParam('limit', limit),
      ]
    );

    // Get global patterns
    const globalResult = await executeStatement(
      `SELECT * FROM tool_entropy_patterns 
       WHERE tenant_id IS NULL AND user_id IS NULL AND tool_a = $1
       ORDER BY co_occurrence_count DESC
       LIMIT $2`,
      [
        stringParam('toolA', currentTool),
        longParam('limit', limit),
      ]
    );

    const userPatterns = this.parsePatternRows(userResult.rows || []);
    const globalPatterns = this.parsePatternRows(globalResult.rows || []);

    // Combine and dedupe
    const suggestions: ToolChainSuggestion[] = [];
    const seenTools = new Set<string>();

    for (const pattern of [...userPatterns, ...globalPatterns]) {
      if (seenTools.has(pattern.tool_b)) continue;
      seenTools.add(pattern.tool_b);

      const confidence = this.calculateConfidence(pattern);
      
      if (confidence > 0.3) {
        suggestions.push({
          tool_a: pattern.tool_a,
          tool_b: pattern.tool_b,
          confidence,
          reason: this.generateReason(pattern),
          auto_chain_available: pattern.is_auto_chain_enabled,
        });
      }
    }

    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  /**
   * Enable auto-chaining for a pattern
   */
  async enableAutoChain(patternId: string): Promise<void> {
    await executeStatement(
      `UPDATE tool_entropy_patterns 
       SET is_auto_chain_enabled = true, updated_at = NOW()
       WHERE pattern_id = $1`,
      [stringParam('patternId', patternId)]
    );
    logger.info('Auto-chain enabled', { patternId });
  }

  /**
   * Disable auto-chaining for a pattern
   */
  async disableAutoChain(patternId: string): Promise<void> {
    await executeStatement(
      `UPDATE tool_entropy_patterns 
       SET is_auto_chain_enabled = false, updated_at = NOW()
       WHERE pattern_id = $1`,
      [stringParam('patternId', patternId)]
    );
  }

  /**
   * Get patterns for admin dashboard
   */
  async getPatterns(
    tenantId: string,
    userId?: string,
    limit: number = 50
  ): Promise<ToolEntropyPattern[]> {
    let query = `SELECT * FROM tool_entropy_patterns WHERE tenant_id = $1`;
    const params = [stringParam('tenantId', tenantId)];

    if (userId) {
      query += ` AND user_id = $2`;
      params.push(stringParam('userId', userId));
    }

    query += ` ORDER BY co_occurrence_count DESC LIMIT $${params.length + 1}`;
    params.push(longParam('limit', limit));

    const result = await executeStatement(query, params);
    return this.parsePatternRows(result.rows || []);
  }

  /**
   * Run nightly job to promote high-frequency patterns to global
   */
  async runPromotionJob(): Promise<{ promoted: number }> {
    // Find patterns that occur frequently across many users
    const result = await executeStatement(
      `INSERT INTO tool_entropy_patterns (pattern_id, tenant_id, user_id, tool_a, tool_b, co_occurrence_count, avg_time_between_ms, is_auto_chain_enabled, created_at, updated_at)
       SELECT 
         gen_random_uuid(), NULL, NULL, tool_a, tool_b,
         SUM(co_occurrence_count), AVG(avg_time_between_ms),
         CASE WHEN SUM(co_occurrence_count) >= 20 THEN true ELSE false END,
         NOW(), NOW()
       FROM tool_entropy_patterns
       WHERE tenant_id IS NOT NULL
       GROUP BY tool_a, tool_b
       HAVING SUM(co_occurrence_count) >= 10
       ON CONFLICT (tenant_id, user_id, tool_a, tool_b) DO UPDATE SET
         co_occurrence_count = tool_entropy_patterns.co_occurrence_count + EXCLUDED.co_occurrence_count,
         updated_at = NOW()
       RETURNING pattern_id`,
      []
    );

    const promoted = result.rows?.length || 0;
    logger.info('Tool entropy promotion completed', { promoted });
    return { promoted };
  }

  /**
   * Get entropy statistics
   */
  async getStats(): Promise<{
    totalPatterns: number;
    autoChainEnabled: number;
    topPatterns: ToolEntropyPattern[];
  }> {
    const countResult = await executeStatement(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_auto_chain_enabled) as auto_enabled
       FROM tool_entropy_patterns`,
      []
    );

    const topResult = await executeStatement(
      `SELECT * FROM tool_entropy_patterns 
       ORDER BY co_occurrence_count DESC 
       LIMIT 10`,
      []
    );

    const counts = countResult.rows?.[0] as { total: number; auto_enabled: number } | undefined;

    return {
      totalPatterns: Number(counts?.total || 0),
      autoChainEnabled: Number(counts?.auto_enabled || 0),
      topPatterns: this.parsePatternRows(topResult.rows || []),
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async recordCoOccurrence(
    tenantId: string,
    userId: string,
    toolA: string,
    toolB: string,
    timeBetweenMs: number
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO tool_entropy_patterns (
        pattern_id, tenant_id, user_id, tool_a, tool_b,
        co_occurrence_count, avg_time_between_ms, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, 1, $6, NOW(), NOW())
      ON CONFLICT (tenant_id, user_id, tool_a, tool_b) DO UPDATE SET
        co_occurrence_count = tool_entropy_patterns.co_occurrence_count + 1,
        avg_time_between_ms = (tool_entropy_patterns.avg_time_between_ms + $6) / 2,
        is_auto_chain_enabled = CASE 
          WHEN tool_entropy_patterns.co_occurrence_count + 1 >= $7 THEN true 
          ELSE tool_entropy_patterns.is_auto_chain_enabled 
        END,
        updated_at = NOW()`,
      [
        stringParam('patternId', uuidv4()),
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('toolA', toolA),
        stringParam('toolB', toolB),
        longParam('timeBetween', timeBetweenMs),
        longParam('threshold', this.AUTO_CHAIN_THRESHOLD),
      ]
    );
  }

  private calculateConfidence(pattern: ToolEntropyPattern): number {
    // Base confidence from occurrence count
    const countScore = Math.min(1.0, pattern.co_occurrence_count / 10);
    
    // Boost for fast transitions (under 5 seconds)
    const speedBoost = pattern.avg_time_between_ms < 5000 ? 0.2 : 0;
    
    // Boost for auto-chain enabled
    const autoChainBoost = pattern.is_auto_chain_enabled ? 0.1 : 0;

    return Math.min(1.0, countScore * 0.7 + speedBoost + autoChainBoost);
  }

  private generateReason(pattern: ToolEntropyPattern): string {
    const timeDesc = pattern.avg_time_between_ms < 5000 
      ? 'immediately' 
      : pattern.avg_time_between_ms < 30000 
        ? 'quickly' 
        : 'often';

    return `Users ${timeDesc} use ${pattern.tool_b} after ${pattern.tool_a} (${pattern.co_occurrence_count} times)`;
  }

  private cleanupOldSessions(): void {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes

    for (const [key, events] of this.recentToolUsage.entries()) {
      const recentEvents = events.filter(
        (e) => now - e.timestamp.getTime() < maxAge
      );
      
      if (recentEvents.length === 0) {
        this.recentToolUsage.delete(key);
      } else {
        this.recentToolUsage.set(key, recentEvents);
      }
    }
  }

  private parsePatternRows(rows: unknown[]): ToolEntropyPattern[] {
    return rows.map((row: unknown) => {
      const r = row as Record<string, unknown>;
      return {
        pattern_id: r.pattern_id as string,
        tenant_id: r.tenant_id as string | null,
        user_id: r.user_id as string | null,
        tool_a: r.tool_a as string,
        tool_b: r.tool_b as string,
        co_occurrence_count: Number(r.co_occurrence_count || 0),
        avg_time_between_ms: Number(r.avg_time_between_ms || 0),
        is_auto_chain_enabled: Boolean(r.is_auto_chain_enabled),
        created_at: new Date(r.created_at as string),
        updated_at: new Date(r.updated_at as string),
      };
    });
  }
}

export const toolEntropyService = new ToolEntropyService();
