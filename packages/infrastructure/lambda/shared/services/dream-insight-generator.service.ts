/**
 * Dream Insight Generator Service v1.0.0
 * 
 * During Twilight Dreaming, analyzes memory patterns across the AKG to
 * generate proactive insights. Instead of just consolidating memories,
 * RADIANT DISCOVERS things the user hasn't noticed yet.
 * 
 * Examples:
 * - "You've been debugging auth issues for 2 weeks — consider a systematic auth audit"
 * - "Your interest in Rust has been growing — here are your TypeScript projects that could benefit"
 * - "You mentioned wanting to learn K8s in January but haven't explored it since"
 * - "3 of your projects depend on a library with a known vulnerability"
 * 
 * This is something NO competitor does. Claude and GPT are purely reactive.
 * RADIANT thinks about you while you sleep.
 * 
 * Architecture:
 * ┌──────────────────────────────────┐
 * │  Twilight Dreaming (2 AM UTC)    │
 * │                                   │
 * │  ┌──────────────┐                │
 * │  │ Pattern       │ → Find recurring topics, behaviors   │
 * │  │ Detection     │                                      │
 * │  └──────┬───────┘                │
 * │         ▼                        │
 * │  ┌──────────────┐                │
 * │  │ Trend         │ → Detect growing/declining interests │
 * │  │ Analysis      │                                      │
 * │  └──────┬───────┘                │
 * │         ▼                        │
 * │  ┌──────────────┐                │
 * │  │ Connection    │ → Find non-obvious links            │
 * │  │ Discovery     │                                      │
 * │  └──────┬───────┘                │
 * │         ▼                        │
 * │  ┌──────────────┐                │
 * │  │ Gap           │ → Identify knowledge gaps           │
 * │  │ Analysis      │                                      │
 * │  └──────┬───────┘                │
 * │         ▼                        │
 * │  ┌──────────────┐                │
 * │  │ LLM Insight   │ → Generate human-readable insights  │
 * │  │ Generation    │                                      │
 * │  └──────────────┘                │
 * └──────────────────────────────────┘
 */

import { executeStatement, stringParam, doubleParam } from '../db/client';
import { createRegisteredLogger } from './logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'dream/insight-generator',
  category: 'infrastructure',
  sourceType: 'application',
});
import { modelRouterService } from './model-router.service';

import type {
  DreamInsight,
  InsightType,
  InsightEvidence,
  InsightReaction,
  DreamInsightConfig,
} from '@radiant/shared';

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_DREAM_CONFIG: Omit<DreamInsightConfig, 'tenantId' | 'createdAt' | 'updatedAt'> = {
  enabled: true,
  insightModel: 'anthropic/claude-3.5-sonnet',
  maxInsightsPerCycle: 10,
  minInsightConfidence: 0.60,
  maxTokensPerCycle: 5000,
  enabledInsightTypes: [],
  proactiveSurfacing: true,
  maxUnsurfacedInsights: 50,
  analyzeOrgMemory: false,
};

// =============================================================================
// Insight Generation Prompt
// =============================================================================

const INSIGHT_GENERATION_PROMPT = `You are an insight generation system. Given a user's knowledge graph summary, generate actionable insights.

Types of insights to look for:
- pattern: Recurring behavioral patterns (e.g., "You debug auth issues every Monday")
- trend: Trends over time (e.g., "Your interest in Rust has been growing since March")
- connection: Non-obvious connections between topics
- knowledge_gap: Gaps in the user's knowledge graph
- optimization: Workflow improvements
- prediction: Predicted future needs
- milestone: Recognizing achievements
- risk: Potential risks from patterns
- opportunity: Opportunities from knowledge gaps + trends

Output STRICT JSON array:
[
  {
    "type": "pattern|trend|connection|knowledge_gap|optimization|prediction|milestone|risk|opportunity",
    "title": "Brief title (max 80 chars)",
    "description": "Detailed description (2-4 sentences)",
    "recommendation": "Actionable recommendation (1-2 sentences)",
    "confidence": 0.0-1.0,
    "relevance": 0.0-1.0,
    "evidence_refs": ["node_label_1", "node_label_2"]
  }
]

Rules:
- Only generate insights you are confident about (>0.6)
- Be specific, not generic ("Your React projects" not "your projects")
- Include actionable recommendations when possible
- Maximum 5 insights per analysis
- Don't generate obvious or trivial insights`;

// =============================================================================
// Dream Insight Generator Service
// =============================================================================

class DreamInsightGeneratorService {
  private configCache = new Map<string, { config: DreamInsightConfig; loadedAt: number }>();
  private readonly CONFIG_CACHE_TTL = 5 * 60 * 1000;

  // ===========================================================================
  // Configuration
  // ===========================================================================

  async getConfig(tenantId: string): Promise<DreamInsightConfig> {
    const cached = this.configCache.get(tenantId);
    if (cached && Date.now() - cached.loadedAt < this.CONFIG_CACHE_TTL) {
      return cached.config;
    }

    try {
      const result = await executeStatement(
        `SELECT * FROM dream_insight_config WHERE tenant_id = $1`,
        [stringParam('tenantId', tenantId)]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0] as Record<string, unknown>;
        const config: DreamInsightConfig = {
          tenantId,
          enabled: Boolean(row.enabled ?? true),
          insightModel: String(row.insight_model || DEFAULT_DREAM_CONFIG.insightModel),
          maxInsightsPerCycle: Number(row.max_insights_per_cycle || 10),
          minInsightConfidence: Number(row.min_insight_confidence || 0.60),
          maxTokensPerCycle: Number(row.max_tokens_per_cycle || 5000),
          enabledInsightTypes: (row.enabled_insight_types as InsightType[]) || [],
          proactiveSurfacing: Boolean(row.proactive_surfacing ?? true),
          maxUnsurfacedInsights: Number(row.max_unsurfaced_insights || 50),
          analyzeOrgMemory: Boolean(row.analyze_org_memory ?? false),
          createdAt: new Date(row.created_at as string),
          updatedAt: new Date(row.updated_at as string),
        };
        this.configCache.set(tenantId, { config, loadedAt: Date.now() });
        return config;
      }
    } catch (error) {
      logger.warn('Failed to load dream insight config', { tenantId, error: String(error) });
    }

    const config: DreamInsightConfig = {
      tenantId,
      ...DEFAULT_DREAM_CONFIG,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.configCache.set(tenantId, { config, loadedAt: Date.now() });
    return config;
  }

  async updateConfig(tenantId: string, updates: Partial<DreamInsightConfig>): Promise<DreamInsightConfig> {
    const current = await this.getConfig(tenantId);
    const updated = { ...current, ...updates, tenantId };

    await executeStatement(
      `INSERT INTO dream_insight_config (
        tenant_id, enabled, insight_model, max_insights_per_cycle,
        min_insight_confidence, max_tokens_per_cycle, enabled_insight_types,
        proactive_surfacing, max_unsurfaced_insights, analyze_org_memory
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (tenant_id) DO UPDATE SET
        enabled = $2, insight_model = $3, max_insights_per_cycle = $4,
        min_insight_confidence = $5, max_tokens_per_cycle = $6,
        enabled_insight_types = $7, proactive_surfacing = $8,
        max_unsurfaced_insights = $9, analyze_org_memory = $10, updated_at = NOW()`,
      [
        stringParam('tenantId', tenantId),
        { name: 'enabled', value: { booleanValue: updated.enabled } },
        stringParam('model', updated.insightModel),
        { name: 'maxInsights', value: { longValue: updated.maxInsightsPerCycle } },
        doubleParam('minConf', updated.minInsightConfidence),
        { name: 'maxTokens', value: { longValue: updated.maxTokensPerCycle } },
        stringParam('types', `{${updated.enabledInsightTypes.join(',')}}`),
        { name: 'proactive', value: { booleanValue: updated.proactiveSurfacing } },
        { name: 'maxUnsurfaced', value: { longValue: updated.maxUnsurfacedInsights } },
        { name: 'orgMemory', value: { booleanValue: updated.analyzeOrgMemory } },
      ]
    );

    this.configCache.delete(tenantId);
    return { ...updated, updatedAt: new Date() };
  }

  // ===========================================================================
  // Insight Generation (called during Twilight Dreaming)
  // ===========================================================================

  /**
   * Generate insights for a specific user during a dream cycle.
   * This is the main entry point called by the Twilight Dreaming scheduler.
   */
  async generateInsightsForUser(
    tenantId: string,
    userId: string,
    dreamCycleId: string,
  ): Promise<DreamInsight[]> {
    const config = await this.getConfig(tenantId);
    if (!config.enabled) return [];

    // Check unsurfaced insight limit
    const unsurfacedCount = await this.getUnsurfacedCount(tenantId, userId);
    if (unsurfacedCount >= config.maxUnsurfacedInsights) {
      logger.info('Max unsurfaced insights reached, skipping generation', {
        tenantId, userId, unsurfacedCount, max: config.maxUnsurfacedInsights,
      });
      return [];
    }

    try {
      // Step 1: Build knowledge graph summary for this user
      const graphSummary = await this.buildGraphSummary(tenantId, userId);
      if (!graphSummary || graphSummary.length < 100) {
        logger.debug('Insufficient graph data for insight generation', { tenantId, userId });
        return [];
      }

      // Step 2: Build trend data (what topics are growing/declining)
      const trendData = await this.buildTrendData(tenantId, userId);

      // Step 3: Call LLM to generate insights
      const prompt = `User's Knowledge Graph Summary:\n${graphSummary}\n\nTrend Data (last 30 days):\n${trendData}\n\nGenerate insights based on this user's knowledge and activity patterns.`;

      const llmResult = await modelRouterService.invoke({
        tenantId,
        modelId: config.insightModel,
        messages: [
          { role: 'system', content: INSIGHT_GENERATION_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        maxTokens: config.maxTokensPerCycle,
      });

      // Step 4: Parse insights
      const rawInsights = this.parseInsightResponse(llmResult.content);
      if (!rawInsights || rawInsights.length === 0) {
        logger.debug('No insights generated', { tenantId, userId });
        return [];
      }

      // Step 5: Filter and persist insights
      const insights: DreamInsight[] = [];
      const tokensUsed = llmResult.content.length / 4; // approximate

      for (const raw of rawInsights.slice(0, config.maxInsightsPerCycle)) {
        if (raw.confidence < config.minInsightConfidence) continue;

        // Filter by enabled types
        if (config.enabledInsightTypes.length > 0 && !config.enabledInsightTypes.includes(raw.type as InsightType)) continue;

        // Check for duplicate insights (similar title in last 7 days)
        const isDuplicate = await this.checkDuplicateInsight(tenantId, userId, raw.title);
        if (isDuplicate) continue;

        const insight = await this.persistInsight(tenantId, userId, {
          insightType: raw.type as InsightType,
          title: raw.title,
          description: raw.description,
          recommendation: raw.recommendation,
          confidence: raw.confidence,
          relevance: raw.relevance,
          evidence: (raw.evidence_refs || []).map((ref: string) => ({
            sourceId: ref,
            sourceType: 'node' as const,
            excerpt: ref,
            timestamp: new Date(),
            weight: 0.5,
          })),
          dreamCycleId,
          modelUsed: config.insightModel,
          tokensUsed: Math.ceil(tokensUsed / rawInsights.length),
        });

        insights.push(insight);
      }

      logger.info('Dream insights generated', {
        tenantId, userId, dreamCycleId,
        generated: insights.length,
        totalTokens: tokensUsed,
      });

      return insights;

    } catch (error) {
      logger.error('Dream insight generation failed', { tenantId, userId, dreamCycleId, error: String(error) });
      return [];
    }
  }

  /**
   * Generate insights for ALL users of a tenant during Twilight Dreaming.
   */
  async generateInsightsForTenant(tenantId: string, dreamCycleId: string): Promise<{
    usersProcessed: number;
    totalInsights: number;
    errors: number;
  }> {
    let usersProcessed = 0;
    let totalInsights = 0;
    let errors = 0;

    try {
      // Get all active users with AKG data
      const usersResult = await executeStatement(
        `SELECT DISTINCT user_id FROM akg_nodes
         WHERE tenant_id = $1 AND last_seen_at > NOW() - INTERVAL '30 days'
         LIMIT 1000`,
        [stringParam('tenantId', tenantId)]
      );

      for (const row of usersResult.rows) {
        const userId = String((row as Record<string, unknown>).user_id);
        try {
          const insights = await this.generateInsightsForUser(tenantId, userId, dreamCycleId);
          totalInsights += insights.length;
          usersProcessed++;
        } catch (error) {
          errors++;
          logger.warn('Failed to generate insights for user', { tenantId, userId, error: String(error) });
        }
      }
    } catch (error) {
      logger.error('Tenant-wide insight generation failed', { tenantId, error: String(error) });
      errors++;
    }

    return { usersProcessed, totalInsights, errors };
  }

  // ===========================================================================
  // Insight Surfacing
  // ===========================================================================

  /**
   * Get the next best insight to surface to a user.
   * Called during conversation to proactively share discoveries.
   */
  async getNextInsightToSurface(tenantId: string, userId: string): Promise<DreamInsight | null> {
    const config = await this.getConfig(tenantId);
    if (!config.proactiveSurfacing) return null;

    const result = await executeStatement(
      `SELECT * FROM dream_insights
       WHERE tenant_id = $1 AND user_id = $2 AND surfaced = false
       ORDER BY priority DESC, relevance DESC, confidence DESC
       LIMIT 1`,
      [stringParam('tenantId', tenantId), stringParam('userId', userId)]
    );

    if (result.rows.length === 0) return null;
    return this.mapInsightRow(result.rows[0] as Record<string, unknown>);
  }

  /**
   * Mark an insight as surfaced (shown to user).
   */
  async markSurfaced(insightId: string, tenantId: string): Promise<void> {
    await executeStatement(
      `UPDATE dream_insights SET surfaced = true, surfaced_at = NOW()
       WHERE insight_id = $1 AND tenant_id = $2`,
      [stringParam('id', insightId), stringParam('tenantId', tenantId)]
    );
  }

  /**
   * Record user's reaction to a surfaced insight (for feedback loop).
   */
  async recordReaction(insightId: string, tenantId: string, reaction: InsightReaction): Promise<void> {
    await executeStatement(
      `UPDATE dream_insights SET user_reaction = $1
       WHERE insight_id = $2 AND tenant_id = $3`,
      [
        stringParam('reaction', reaction),
        stringParam('id', insightId),
        stringParam('tenantId', tenantId),
      ]
    );
  }

  // ===========================================================================
  // Analysis Helpers
  // ===========================================================================

  /**
   * Build a text summary of the user's knowledge graph for LLM analysis.
   */
  private async buildGraphSummary(tenantId: string, userId: string): Promise<string> {
    try {
      // Get top nodes by importance
      const nodesResult = await executeStatement(
        `SELECT label, entity_type, properties, importance, mention_count, first_seen_at, last_seen_at
         FROM akg_nodes
         WHERE tenant_id = $1 AND user_id = $2
         ORDER BY importance DESC
         LIMIT 50`,
        [stringParam('tenantId', tenantId), stringParam('userId', userId)]
      );

      // Get top edges
      const edgesResult = await executeStatement(
        `SELECT
          s.label as source_label, t.label as target_label,
          e.relationship_type, e.label as edge_label,
          e.weight, e.valid_from, e.valid_until
         FROM akg_edges e
         JOIN akg_nodes s ON e.source_node_id = s.node_id
         JOIN akg_nodes t ON e.target_node_id = t.node_id
         WHERE e.tenant_id = $1 AND e.user_id = $2
         ORDER BY e.weight DESC
         LIMIT 80`,
        [stringParam('tenantId', tenantId), stringParam('userId', userId)]
      );

      const lines: string[] = ['Entities:'];
      for (const row of nodesResult.rows) {
        const r = row as Record<string, unknown>;
        const props = r.properties ? JSON.stringify(r.properties).substring(0, 100) : '';
        lines.push(`- ${r.label} (${r.entity_type}, importance: ${Number(r.importance).toFixed(2)}, mentions: ${r.mention_count}, first: ${String(r.first_seen_at).split('T')[0]}, last: ${String(r.last_seen_at).split('T')[0]})${props ? ` ${props}` : ''}`);
      }

      lines.push('\nRelationships:');
      for (const row of edgesResult.rows) {
        const r = row as Record<string, unknown>;
        let line = `- ${r.source_label} ${r.edge_label} ${r.target_label} (weight: ${Number(r.weight).toFixed(2)})`;
        if (r.valid_from) line += ` since ${String(r.valid_from).split('T')[0]}`;
        if (r.valid_until) line += ` until ${String(r.valid_until).split('T')[0]}`;
        lines.push(line);
      }

      return lines.join('\n');
    } catch (error) {
      logger.warn('Failed to build graph summary', { tenantId, userId, error: String(error) });
      return '';
    }
  }

  /**
   * Build trend data showing growing/declining topics.
   */
  private async buildTrendData(tenantId: string, userId: string): Promise<string> {
    try {
      // Compare last 7 days vs previous 23 days
      const result = await executeStatement(
        `WITH recent AS (
          SELECT label, entity_type, mention_count
          FROM akg_nodes
          WHERE tenant_id = $1 AND user_id = $2
          AND last_seen_at > NOW() - INTERVAL '7 days'
        ),
        older AS (
          SELECT label, entity_type, mention_count
          FROM akg_nodes
          WHERE tenant_id = $1 AND user_id = $2
          AND last_seen_at BETWEEN NOW() - INTERVAL '30 days' AND NOW() - INTERVAL '7 days'
        )
        SELECT
          COALESCE(r.label, o.label) as label,
          COALESCE(r.entity_type, o.entity_type) as entity_type,
          COALESCE(r.mention_count, 0) as recent_mentions,
          COALESCE(o.mention_count, 0) as older_mentions,
          CASE
            WHEN COALESCE(o.mention_count, 0) = 0 THEN 'new'
            WHEN COALESCE(r.mention_count, 0) > COALESCE(o.mention_count, 0) THEN 'growing'
            WHEN COALESCE(r.mention_count, 0) < COALESCE(o.mention_count, 0) THEN 'declining'
            ELSE 'stable'
          END as trend
        FROM recent r
        FULL OUTER JOIN older o ON r.label = o.label
        ORDER BY COALESCE(r.mention_count, 0) DESC
        LIMIT 30`,
        [stringParam('tenantId', tenantId), stringParam('userId', userId)]
      );

      const lines: string[] = [];
      for (const row of result.rows) {
        const r = row as Record<string, unknown>;
        lines.push(`- ${r.label} (${r.entity_type}): ${r.trend} (recent: ${r.recent_mentions}, prev: ${r.older_mentions})`);
      }

      return lines.length > 0 ? lines.join('\n') : 'No trend data available (new user or insufficient activity)';
    } catch (error) {
      logger.warn('Failed to build trend data', { tenantId, userId, error: String(error) });
      return 'Trend data unavailable';
    }
  }

  // ===========================================================================
  // Persistence
  // ===========================================================================

  private async persistInsight(
    tenantId: string,
    userId: string,
    params: {
      insightType: InsightType;
      title: string;
      description: string;
      recommendation?: string;
      confidence: number;
      relevance: number;
      evidence: InsightEvidence[];
      dreamCycleId: string;
      modelUsed: string;
      tokensUsed: number;
    }
  ): Promise<DreamInsight> {
    const insightId = crypto.randomUUID();
    const priority = Math.round(params.confidence * 50 + params.relevance * 50);

    await executeStatement(
      `INSERT INTO dream_insights (
        insight_id, tenant_id, user_id, insight_type, title, description,
        evidence, recommendation, confidence, relevance, priority,
        generated_during_dream_cycle, model_used, tokens_used
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        stringParam('id', insightId),
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('type', params.insightType),
        stringParam('title', params.title),
        stringParam('desc', params.description),
        stringParam('evidence', JSON.stringify(params.evidence)),
        params.recommendation ? stringParam('rec', params.recommendation) : { name: 'rec', value: { isNull: true } },
        doubleParam('conf', params.confidence),
        doubleParam('rel', params.relevance),
        { name: 'priority', value: { longValue: priority } },
        stringParam('cycle', params.dreamCycleId),
        stringParam('model', params.modelUsed),
        { name: 'tokens', value: { longValue: params.tokensUsed } },
      ]
    );

    return {
      insightId,
      tenantId,
      userId,
      insightType: params.insightType,
      title: params.title,
      description: params.description,
      evidence: params.evidence,
      recommendation: params.recommendation,
      confidence: params.confidence,
      relevance: params.relevance,
      priority,
      surfaced: false,
      generatedDuringDreamCycle: params.dreamCycleId,
      modelUsed: params.modelUsed,
      tokensUsed: params.tokensUsed,
      createdAt: new Date(),
    };
  }

  private async checkDuplicateInsight(tenantId: string, userId: string, title: string): Promise<boolean> {
    try {
      const result = await executeStatement(
        `SELECT COUNT(*) as count FROM dream_insights
         WHERE tenant_id = $1 AND user_id = $2
         AND similarity(title, $3) > 0.7
         AND created_at > NOW() - INTERVAL '7 days'`,
        [
          stringParam('tenantId', tenantId),
          stringParam('userId', userId),
          stringParam('title', title),
        ]
      );
      return Number((result.rows[0] as Record<string, unknown>)?.count || 0) > 0;
    } catch {
      return false;
    }
  }

  private async getUnsurfacedCount(tenantId: string, userId: string): Promise<number> {
    try {
      const result = await executeStatement(
        `SELECT COUNT(*) as count FROM dream_insights
         WHERE tenant_id = $1 AND user_id = $2 AND surfaced = false`,
        [stringParam('tenantId', tenantId), stringParam('userId', userId)]
      );
      return Number((result.rows[0] as Record<string, unknown>)?.count || 0);
    } catch {
      return 0;
    }
  }

  // ===========================================================================
  // Queries & Stats
  // ===========================================================================

  async getRecentInsights(tenantId: string, userId?: string, limit: number = 20): Promise<DreamInsight[]> {
    let query = `SELECT * FROM dream_insights WHERE tenant_id = $1`;
    const params = [stringParam('tenantId', tenantId)];

    if (userId) {
      query += ` AND user_id = $2`;
      params.push(stringParam('userId', userId));
    }

    query += ` ORDER BY created_at DESC LIMIT ${limit}`;

    const result = await executeStatement(query, params);
    return result.rows.map(row => this.mapInsightRow(row as Record<string, unknown>));
  }

  async getStats(tenantId: string): Promise<{
    totalInsightsGenerated: number;
    insightsSurfaced: number;
    insightsHelpful: number;
    insightsByType: Record<string, number>;
    avgConfidence: number;
    tokensConsumedTotal: number;
    lastDreamCycleAt?: Date;
  }> {
    try {
      const result = await executeStatement(
        `SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE surfaced = true) as surfaced,
          COUNT(*) FILTER (WHERE user_reaction = 'helpful') as helpful,
          insight_type, COUNT(*) as type_count,
          AVG(confidence) as avg_conf,
          SUM(tokens_used) as total_tokens,
          MAX(created_at) as last_cycle
        FROM dream_insights WHERE tenant_id = $1
        GROUP BY insight_type`,
        [stringParam('tenantId', tenantId)]
      );

      let total = 0;
      let surfaced = 0;
      let helpful = 0;
      let avgConf = 0;
      let totalTokens = 0;
      let lastCycle: Date | undefined;
      const byType: Record<string, number> = {};

      for (const row of result.rows) {
        const r = row as Record<string, unknown>;
        total += Number(r.total || 0);
        surfaced += Number(r.surfaced || 0);
        helpful += Number(r.helpful || 0);
        avgConf = Number(r.avg_conf || 0);
        totalTokens += Number(r.total_tokens || 0);
        if (r.last_cycle) lastCycle = new Date(r.last_cycle as string);
        byType[String(r.insight_type)] = Number(r.type_count || 0);
      }

      return {
        totalInsightsGenerated: total,
        insightsSurfaced: surfaced,
        insightsHelpful: helpful,
        insightsByType: byType,
        avgConfidence: avgConf,
        tokensConsumedTotal: totalTokens,
        lastDreamCycleAt: lastCycle,
      };
    } catch (error) {
      logger.error('Failed to get dream insight stats', { tenantId, error: String(error) });
      return {
        totalInsightsGenerated: 0, insightsSurfaced: 0, insightsHelpful: 0,
        insightsByType: {}, avgConfidence: 0, tokensConsumedTotal: 0,
      };
    }
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private parseInsightResponse(content: string): Array<{
    type: string; title: string; description: string;
    recommendation?: string; confidence: number; relevance: number;
    evidence_refs: string[];
  }> | null {
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return null;
      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private mapInsightRow(row: Record<string, unknown>): DreamInsight {
    return {
      insightId: String(row.insight_id),
      tenantId: String(row.tenant_id),
      userId: String(row.user_id),
      insightType: String(row.insight_type) as InsightType,
      title: String(row.title),
      description: String(row.description),
      evidence: typeof row.evidence === 'string' ? JSON.parse(row.evidence) : (row.evidence as InsightEvidence[]) || [],
      recommendation: row.recommendation ? String(row.recommendation) : undefined,
      confidence: Number(row.confidence || 0.5),
      relevance: Number(row.relevance || 0.5),
      priority: Number(row.priority || 50),
      surfaced: Boolean(row.surfaced),
      userReaction: row.user_reaction ? String(row.user_reaction) as InsightReaction : undefined,
      generatedDuringDreamCycle: String(row.generated_during_dream_cycle || ''),
      modelUsed: String(row.model_used),
      tokensUsed: Number(row.tokens_used || 0),
      createdAt: new Date(row.created_at as string),
      surfacedAt: row.surfaced_at ? new Date(row.surfaced_at as string) : undefined,
    };
  }
}

export const dreamInsightGeneratorService = new DreamInsightGeneratorService();
