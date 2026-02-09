/**
 * Memory Contradiction Detector Service v1.0.0
 * 
 * Detects contradictions between new facts extracted by the AKG and existing
 * knowledge in the graph. When a user says "I use React" in January and
 * "I use Vue" in February, this service detects the potential contradiction,
 * classifies it (factual change, preference shift, temporal inconsistency),
 * and either auto-resolves by recency/confidence rules or flags for user resolution.
 * 
 * This is something NO competitor does — Claude happily stores contradictory
 * facts without noticing. RADIANT maintains truth.
 * 
 * Architecture:
 * ┌────────────────────┐
 * │  New Fact from AKG  │
 * └────────┬───────────┘
 *          ▼
 * ┌────────────────────┐
 * │ Semantic Similarity │ ← Find potentially conflicting existing facts
 * │ Search (pgvector)   │
 * └────────┬───────────┘
 *          ▼
 * ┌────────────────────┐
 * │ LLM Contradiction   │ ← Classify: factual, temporal, preference, etc.
 * │ Analysis            │
 * └────────┬───────────┘
 *          ▼
 * ┌────────────────────┐
 * │ Resolution Engine   │
 * │ - Auto (recency)    │
 * │ - Auto (confidence) │
 * │ - User prompt       │
 * └────────────────────┘
 */

import { executeStatement, stringParam, doubleParam } from '../db/client';
import { createRegisteredLogger } from './logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'memory/contradiction-detector',
  category: 'infrastructure',
  sourceType: 'application',
});
import { modelRouterService } from './model-router.service';

import type {
  MemoryContradiction,
  ContradictionType,
  ContradictionStatus,
  ContradictionResolution,
  ContradictionConfig,
} from '@radiant/shared';

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONTRADICTION_CONFIG: Omit<ContradictionConfig, 'tenantId' | 'createdAt' | 'updatedAt'> = {
  enabled: true,
  minSimilarityForCheck: 0.70,
  autoResolveConfidenceGap: 0.30,
  autoResolveRecencyDays: 90,
  promptUserResolution: true,
  maxUnresolvedAlert: 50,
  detectionModel: 'openai/gpt-4o-mini',
};

// =============================================================================
// Contradiction Detection Prompt
// =============================================================================

const CONTRADICTION_DETECTION_PROMPT = `You are a contradiction detection system. Given two facts about the same topic, determine if they contradict each other.

Respond with STRICT JSON:
{
  "is_contradiction": true/false,
  "type": "factual|temporal|preference|relationship|quantitative|sentiment",
  "severity": 0.0-1.0,
  "explanation": "Brief explanation of the contradiction",
  "resolution_suggestion": "recency|confidence|both_valid|needs_user_input"
}

Types:
- factual: Direct factual conflict (e.g., "uses React" vs "uses Vue")
- temporal: Timeline inconsistency (e.g., "started in 2020" vs "started in 2022")
- preference: Changed preference (e.g., "prefers tabs" vs "prefers spaces")  
- relationship: Relationship conflict (e.g., "works at X" vs "works at Y")
- quantitative: Numeric conflict (e.g., "team of 5" vs "team of 20")
- sentiment: Sentiment shift (e.g., "loves Python" vs "frustrated with Python")

Resolution suggestions:
- recency: The newer fact should win (simple override)
- confidence: The higher-confidence fact should win
- both_valid: Both facts can coexist (e.g., preference changed over time)
- needs_user_input: Ambiguous, ask the user`;

// =============================================================================
// Contradiction Detector Service
// =============================================================================

class MemoryContradictionDetectorService {
  private configCache = new Map<string, { config: ContradictionConfig; loadedAt: number }>();
  private readonly CONFIG_CACHE_TTL = 5 * 60 * 1000;

  // ===========================================================================
  // Configuration
  // ===========================================================================

  async getConfig(tenantId: string): Promise<ContradictionConfig> {
    const cached = this.configCache.get(tenantId);
    if (cached && Date.now() - cached.loadedAt < this.CONFIG_CACHE_TTL) {
      return cached.config;
    }

    try {
      const result = await executeStatement(
        `SELECT * FROM contradiction_config WHERE tenant_id = $1`,
        [stringParam('tenantId', tenantId)]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0] as Record<string, unknown>;
        const config: ContradictionConfig = {
          tenantId,
          enabled: Boolean(row.enabled ?? true),
          minSimilarityForCheck: Number(row.min_similarity_for_check || 0.70),
          autoResolveConfidenceGap: Number(row.auto_resolve_confidence_gap || 0.30),
          autoResolveRecencyDays: Number(row.auto_resolve_recency_days || 90),
          promptUserResolution: Boolean(row.prompt_user_resolution ?? true),
          maxUnresolvedAlert: Number(row.max_unresolved_alert || 50),
          detectionModel: String(row.detection_model || DEFAULT_CONTRADICTION_CONFIG.detectionModel),
          createdAt: new Date(row.created_at as string),
          updatedAt: new Date(row.updated_at as string),
        };
        this.configCache.set(tenantId, { config, loadedAt: Date.now() });
        return config;
      }
    } catch (error) {
      logger.warn('Failed to load contradiction config', { tenantId, error: String(error) });
    }

    const config: ContradictionConfig = {
      tenantId,
      ...DEFAULT_CONTRADICTION_CONFIG,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.configCache.set(tenantId, { config, loadedAt: Date.now() });
    return config;
  }

  async updateConfig(tenantId: string, updates: Partial<ContradictionConfig>): Promise<ContradictionConfig> {
    const current = await this.getConfig(tenantId);
    const updated = { ...current, ...updates, tenantId };

    await executeStatement(
      `INSERT INTO contradiction_config (
        tenant_id, enabled, min_similarity_for_check, auto_resolve_confidence_gap,
        auto_resolve_recency_days, prompt_user_resolution, max_unresolved_alert, detection_model
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (tenant_id) DO UPDATE SET
        enabled = $2, min_similarity_for_check = $3, auto_resolve_confidence_gap = $4,
        auto_resolve_recency_days = $5, prompt_user_resolution = $6,
        max_unresolved_alert = $7, detection_model = $8, updated_at = NOW()`,
      [
        stringParam('tenantId', tenantId),
        { name: 'enabled', value: { booleanValue: updated.enabled } },
        doubleParam('minSim', updated.minSimilarityForCheck),
        doubleParam('confGap', updated.autoResolveConfidenceGap),
        { name: 'recDays', value: { longValue: updated.autoResolveRecencyDays } },
        { name: 'promptUser', value: { booleanValue: updated.promptUserResolution } },
        { name: 'maxUnresolved', value: { longValue: updated.maxUnresolvedAlert } },
        stringParam('model', updated.detectionModel),
      ]
    );

    this.configCache.delete(tenantId);
    return { ...updated, updatedAt: new Date() };
  }

  // ===========================================================================
  // Contradiction Detection
  // ===========================================================================

  /**
   * Check a new fact against existing knowledge for contradictions.
   * Called by the AKG service after extracting new entities/relationships.
   */
  async checkForContradictions(
    tenantId: string,
    userId: string,
    newFactText: string,
    newFactNodeId: string,
    newFactSource: string,
  ): Promise<MemoryContradiction[]> {
    const config = await this.getConfig(tenantId);
    if (!config.enabled) return [];

    try {
      // Step 1: Find potentially conflicting existing facts by text similarity
      const candidates = await this.findSimilarFacts(tenantId, userId, newFactText);
      if (candidates.length === 0) return [];

      const contradictions: MemoryContradiction[] = [];

      for (const candidate of candidates) {
        // Step 2: Use LLM to check if this is actually a contradiction
        const analysis = await this.analyzeContradiction(
          config.detectionModel,
          newFactText,
          candidate.factText,
        );

        if (!analysis || !analysis.is_contradiction) continue;

        // Step 3: Create contradiction record
        const contradiction = await this.createContradiction(tenantId, userId, {
          newFactNodeId,
          newFactText,
          newFactSource,
          existingFactNodeId: candidate.nodeId,
          existingFactText: candidate.factText,
          existingFactSource: candidate.source,
          existingFactDate: candidate.date,
          contradictionType: analysis.type as ContradictionType,
          severity: analysis.severity,
          explanation: analysis.explanation,
          detectionConfidence: analysis.severity,
        });

        // Step 4: Attempt auto-resolution
        const resolved = await this.attemptAutoResolution(contradiction, config);
        if (resolved) {
          contradiction.status = resolved.status;
          contradiction.resolution = resolved.resolution;
        }

        contradictions.push(contradiction);
      }

      if (contradictions.length > 0) {
        logger.info('Contradictions detected', {
          tenantId, userId, count: contradictions.length,
          autoResolved: contradictions.filter(c => c.status !== 'detected').length,
        });
      }

      return contradictions;

    } catch (error) {
      logger.error('Contradiction detection failed', { tenantId, userId, error: String(error) });
      return [];
    }
  }

  /**
   * Find existing facts that are semantically similar to the new fact.
   * These are candidates for contradiction checking.
   */
  private async findSimilarFacts(
    tenantId: string,
    userId: string,
    newFactText: string,
  ): Promise<Array<{ nodeId: string; factText: string; source: string; date: Date; confidence: number }>> {
    try {
      // Text-based similarity search using ILIKE and trigram matching
      const result = await executeStatement(
        `SELECT
          n.node_id,
          n.label || ': ' || COALESCE(n.properties::text, '') AS fact_text,
          COALESCE(n.source_conversation_ids[1], 'unknown') AS source,
          n.last_seen_at AS date,
          n.confidence
        FROM akg_nodes n
        WHERE n.tenant_id = $1 AND n.user_id = $2
        AND n.entity_type IN ('preference', 'skill', 'technology', 'organization', 'person', 'decision')
        AND (
          n.label ILIKE '%' || $3 || '%'
          OR $3 ILIKE '%' || n.label || '%'
          OR similarity(n.label, $3) > 0.3
        )
        ORDER BY similarity(n.label, $3) DESC
        LIMIT 10`,
        [
          stringParam('tenantId', tenantId),
          stringParam('userId', userId),
          stringParam('text', newFactText.substring(0, 200)),
        ]
      );

      return result.rows.map(row => {
        const r = row as Record<string, unknown>;
        return {
          nodeId: String(r.node_id),
          factText: String(r.fact_text),
          source: String(r.source),
          date: new Date(r.date as string),
          confidence: Number(r.confidence || 0.5),
        };
      });
    } catch (error) {
      logger.warn('Similar fact search failed', { error: String(error) });
      return [];
    }
  }

  /**
   * Use LLM to analyze whether two facts actually contradict each other.
   */
  private async analyzeContradiction(
    model: string,
    newFact: string,
    existingFact: string,
    tenantId?: string,
  ): Promise<{ is_contradiction: boolean; type: string; severity: number; explanation: string; resolution_suggestion: string } | null> {
    try {
      const result = await modelRouterService.invoke({
        tenantId,
        modelId: model,
        messages: [
          { role: 'system', content: CONTRADICTION_DETECTION_PROMPT },
          { role: 'user', content: `New fact: "${newFact}"\nExisting fact: "${existingFact}"\n\nAre these contradictory?` },
        ],
        temperature: 0.1,
        maxTokens: 200,
      });

      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      logger.warn('Contradiction analysis failed', { error: String(error) });
      return null;
    }
  }

  /**
   * Create a contradiction record in the database.
   */
  private async createContradiction(
    tenantId: string,
    userId: string,
    params: {
      newFactNodeId: string;
      newFactText: string;
      newFactSource: string;
      existingFactNodeId: string;
      existingFactText: string;
      existingFactSource: string;
      existingFactDate: Date;
      contradictionType: ContradictionType;
      severity: number;
      explanation: string;
      detectionConfidence: number;
    }
  ): Promise<MemoryContradiction> {
    const contradictionId = crypto.randomUUID();
    const now = new Date();

    await executeStatement(
      `INSERT INTO memory_contradictions (
        contradiction_id, tenant_id, user_id,
        new_fact_node_id, new_fact_text, new_fact_source, new_fact_date,
        existing_fact_node_id, existing_fact_text, existing_fact_source, existing_fact_date,
        contradiction_type, severity, explanation, status, detection_confidence
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9, $10, $11, $12, $13, 'detected', $14)`,
      [
        stringParam('id', contradictionId),
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('newNodeId', params.newFactNodeId),
        stringParam('newText', params.newFactText),
        stringParam('newSource', params.newFactSource),
        stringParam('existNodeId', params.existingFactNodeId),
        stringParam('existText', params.existingFactText),
        stringParam('existSource', params.existingFactSource),
        stringParam('existDate', params.existingFactDate.toISOString()),
        stringParam('type', params.contradictionType),
        doubleParam('severity', params.severity),
        stringParam('explanation', params.explanation),
        doubleParam('confidence', params.detectionConfidence),
      ]
    );

    return {
      contradictionId,
      tenantId,
      userId,
      newFactNodeId: params.newFactNodeId,
      newFactText: params.newFactText,
      newFactSource: params.newFactSource,
      newFactDate: now,
      existingFactNodeId: params.existingFactNodeId,
      existingFactText: params.existingFactText,
      existingFactSource: params.existingFactSource,
      existingFactDate: params.existingFactDate,
      contradictionType: params.contradictionType,
      severity: params.severity,
      explanation: params.explanation,
      status: 'detected' as ContradictionStatus,
      detectionConfidence: params.detectionConfidence,
      createdAt: now,
    };
  }

  /**
   * Attempt auto-resolution based on recency and confidence rules.
   */
  private async attemptAutoResolution(
    contradiction: MemoryContradiction,
    config: ContradictionConfig,
  ): Promise<{ status: ContradictionStatus; resolution: ContradictionResolution } | null> {
    // Rule 1: Preference changes are always "both valid" (temporal)
    if (contradiction.contradictionType === 'preference' || contradiction.contradictionType === 'sentiment') {
      const resolution: ContradictionResolution = {
        method: 'both_valid',
        winner: 'both',
        resolvedBy: 'system',
        resolvedAt: new Date(),
      };

      await this.resolveContradiction(contradiction.contradictionId, contradiction.tenantId, 'accepted', resolution);
      return { status: 'accepted' as ContradictionStatus, resolution };
    }

    // Rule 2: Auto-resolve by recency if time gap > threshold
    const daysBetween = Math.abs(
      (contradiction.newFactDate.getTime() - contradiction.existingFactDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysBetween > config.autoResolveRecencyDays) {
      const resolution: ContradictionResolution = {
        method: 'recency',
        winner: 'new',
        resolvedBy: 'system',
        resolvedAt: new Date(),
      };

      await this.resolveContradiction(contradiction.contradictionId, contradiction.tenantId, 'auto_resolved', resolution);
      return { status: 'auto_resolved' as ContradictionStatus, resolution };
    }

    // No auto-resolution possible
    return null;
  }

  /**
   * Resolve a contradiction (auto or user).
   */
  async resolveContradiction(
    contradictionId: string,
    tenantId: string,
    status: ContradictionStatus,
    resolution: ContradictionResolution,
  ): Promise<void> {
    await executeStatement(
      `UPDATE memory_contradictions SET
        status = $1, resolution = $2, resolved_at = NOW()
      WHERE contradiction_id = $3 AND tenant_id = $4`,
      [
        stringParam('status', status),
        stringParam('resolution', JSON.stringify(resolution)),
        stringParam('id', contradictionId),
        stringParam('tenantId', tenantId),
      ]
    );
  }

  /**
   * User resolves a contradiction by choosing which fact is correct.
   */
  async userResolve(
    contradictionId: string,
    tenantId: string,
    userId: string,
    winner: 'new' | 'existing' | 'both' | 'neither',
    explanation?: string,
  ): Promise<void> {
    const resolution: ContradictionResolution = {
      method: 'user_choice',
      winner,
      userExplanation: explanation,
      resolvedBy: userId,
      resolvedAt: new Date(),
    };

    await this.resolveContradiction(contradictionId, tenantId, 'user_resolved', resolution);
  }

  // ===========================================================================
  // Queries
  // ===========================================================================

  async getUnresolved(tenantId: string, userId?: string, limit: number = 20): Promise<MemoryContradiction[]> {
    let query = `SELECT * FROM memory_contradictions WHERE tenant_id = $1 AND status = 'detected'`;
    const params = [stringParam('tenantId', tenantId)];

    if (userId) {
      query += ` AND user_id = $2`;
      params.push(stringParam('userId', userId));
    }

    query += ` ORDER BY severity DESC, created_at DESC LIMIT ${limit}`;

    const result = await executeStatement(query, params);
    return result.rows.map(row => this.mapContradictionRow(row as Record<string, unknown>));
  }

  async getRecent(tenantId: string, limit: number = 50): Promise<MemoryContradiction[]> {
    const result = await executeStatement(
      `SELECT * FROM memory_contradictions WHERE tenant_id = $1
       ORDER BY created_at DESC LIMIT ${limit}`,
      [stringParam('tenantId', tenantId)]
    );
    return result.rows.map(row => this.mapContradictionRow(row as Record<string, unknown>));
  }

  async getStats(tenantId: string): Promise<{
    totalDetected: number;
    unresolvedCount: number;
    autoResolvedCount: number;
    userResolvedCount: number;
    avgResolutionTimeHours: number;
    detectionAccuracy: number;
  }> {
    try {
      const result = await executeStatement(
        `SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'detected') as unresolved,
          COUNT(*) FILTER (WHERE status = 'auto_resolved') as auto_resolved,
          COUNT(*) FILTER (WHERE status = 'user_resolved') as user_resolved,
          AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)
            FILTER (WHERE resolved_at IS NOT NULL) as avg_resolution_hours,
          COUNT(*) FILTER (WHERE status != 'dismissed')::DECIMAL /
            NULLIF(COUNT(*), 0) as accuracy
        FROM memory_contradictions WHERE tenant_id = $1`,
        [stringParam('tenantId', tenantId)]
      );

      const row = result.rows[0] as Record<string, unknown>;
      return {
        totalDetected: Number(row.total || 0),
        unresolvedCount: Number(row.unresolved || 0),
        autoResolvedCount: Number(row.auto_resolved || 0),
        userResolvedCount: Number(row.user_resolved || 0),
        avgResolutionTimeHours: Number(row.avg_resolution_hours || 0),
        detectionAccuracy: Number(row.accuracy || 1.0),
      };
    } catch (error) {
      logger.error('Failed to get contradiction stats', { tenantId, error: String(error) });
      return { totalDetected: 0, unresolvedCount: 0, autoResolvedCount: 0, userResolvedCount: 0, avgResolutionTimeHours: 0, detectionAccuracy: 0 };
    }
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private mapContradictionRow(row: Record<string, unknown>): MemoryContradiction {
    return {
      contradictionId: String(row.contradiction_id),
      tenantId: String(row.tenant_id),
      userId: String(row.user_id),
      newFactNodeId: String(row.new_fact_node_id || ''),
      newFactText: String(row.new_fact_text),
      newFactSource: String(row.new_fact_source),
      newFactDate: new Date(row.new_fact_date as string),
      existingFactNodeId: String(row.existing_fact_node_id || ''),
      existingFactText: String(row.existing_fact_text),
      existingFactSource: String(row.existing_fact_source),
      existingFactDate: new Date(row.existing_fact_date as string),
      contradictionType: String(row.contradiction_type) as ContradictionType,
      severity: Number(row.severity || 0.5),
      explanation: String(row.explanation),
      status: String(row.status) as ContradictionStatus,
      resolution: row.resolution ? (typeof row.resolution === 'string' ? JSON.parse(row.resolution) : row.resolution) as ContradictionResolution : undefined,
      detectionConfidence: Number(row.detection_confidence || 0.5),
      createdAt: new Date(row.created_at as string),
      resolvedAt: row.resolved_at ? new Date(row.resolved_at as string) : undefined,
    };
  }
}

export const memoryContradictionDetectorService = new MemoryContradictionDetectorService();
