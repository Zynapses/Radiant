// RADIANT v4.18.0 - Specialty Ranking Service
// AI-powered proficiency ranking for models and modes

import { executeStatement } from '../db/client';
import { modelRouterService } from './model-router.service';

// Specialty Categories
export const SPECIALTY_CATEGORIES = {
  reasoning: { name: 'Reasoning & Logic', icon: '🧠', color: 'purple' },
  coding: { name: 'Code Generation', icon: '💻', color: 'blue' },
  math: { name: 'Mathematics', icon: '📐', color: 'green' },
  creative: { name: 'Creative Writing', icon: '✍️', color: 'pink' },
  analysis: { name: 'Data Analysis', icon: '📊', color: 'orange' },
  research: { name: 'Research & Synthesis', icon: '🔬', color: 'cyan' },
  legal: { name: 'Legal & Compliance', icon: '⚖️', color: 'gray' },
  medical: { name: 'Medical & Healthcare', icon: '🏥', color: 'red' },
  finance: { name: 'Finance & Trading', icon: '💰', color: 'emerald' },
  science: { name: 'Scientific', icon: '🔭', color: 'indigo' },
  debugging: { name: 'Debugging & QA', icon: '🐛', color: 'amber' },
  architecture: { name: 'System Architecture', icon: '🏗️', color: 'slate' },
  security: { name: 'Security', icon: '🔐', color: 'rose' },
  vision: { name: 'Vision & Images', icon: '👁️', color: 'violet' },
  audio: { name: 'Audio & Speech', icon: '🎤', color: 'fuchsia' },
  conversation: { name: 'Conversational', icon: '💬', color: 'lime' },
  instruction: { name: 'Instruction Following', icon: '📋', color: 'stone' },
  speed: { name: 'Low Latency', icon: '⚡', color: 'yellow' },
  accuracy: { name: 'High Accuracy', icon: '🎯', color: 'green' },
  safety: { name: 'Safety & Alignment', icon: '🛡️', color: 'emerald' },
} as const;

export type SpecialtyCategory = keyof typeof SPECIALTY_CATEGORIES;

// Orchestration Modes (thinking styles)
export const ORCHESTRATION_MODES = {
  thinking: { name: 'Thinking', description: 'Standard reasoning with step-by-step analysis', icon: '💭' },
  extended_thinking: { name: 'Extended Thinking', description: 'Deep multi-step reasoning for complex problems', icon: '🧠' },
  research: { name: 'Research', description: 'Information gathering and synthesis', icon: '🔬' },
  creative: { name: 'Creative', description: 'Divergent thinking and idea generation', icon: '🎨' },
  analytical: { name: 'Analytical', description: 'Data analysis and pattern recognition', icon: '📊' },
  coding: { name: 'Coding', description: 'Code generation and debugging', icon: '💻' },
  conversational: { name: 'Conversational', description: 'Natural dialogue and engagement', icon: '💬' },
  fast: { name: 'Fast', description: 'Quick responses with minimal latency', icon: '⚡' },
  precise: { name: 'Precise', description: 'High accuracy with verification', icon: '🎯' },
  balanced: { name: 'Balanced', description: 'Optimal cost/quality/speed tradeoff', icon: '⚖️' },
} as const;

export type OrchestrationMode = keyof typeof ORCHESTRATION_MODES;

// Scoring weight configuration
export interface ScoringWeights {
  benchmarkWeight: number;    // 0-1: weight for published benchmarks
  communityWeight: number;    // 0-1: weight for community reviews
  internalWeight: number;     // 0-1: weight for internal usage data
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  benchmarkWeight: 0.5,
  communityWeight: 0.3,
  internalWeight: 0.2,
};

// Research schedule configuration
export interface ResearchSchedule {
  scheduleId: string;
  name: string;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'manual';
  cronExpression?: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  targetScope: 'all' | 'specialty' | 'mode' | 'model';
  targetFilter?: string;
}

// Mode ranking for orchestration
export interface ModeRanking {
  rankingId: string;
  mode: OrchestrationMode;
  modelId: string;
  provider: string;
  score: number;
  tier: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  strengths: string[];
  weaknesses: string[];
  recommendedFor: string[];
  notRecommendedFor: string[];
  confidence: number;
  isLocked: boolean;
  adminOverride?: number;
  updatedAt: string;
}

export interface SpecialtyRanking {
  rankingId: string;
  modelId: string;
  provider: string;
  specialty: SpecialtyCategory;
  proficiencyScore: number;
  benchmarkScore: number;
  communityScore: number;
  internalScore: number;
  rank: number;
  percentile: number;
  tier: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  confidence: number;
  dataPoints: number;
  lastResearched: string;
  researchSources: string[];
  trend: 'improving' | 'stable' | 'declining';
  adminOverride?: number;
  isLocked: boolean;
  updatedAt: string;
}

export interface RankingResearchResult {
  researchId: string;
  modelsResearched: number;
  specialtiesUpdated: number;
  rankingsChanged: number;
  duration: number;
  aiConfidence: number;
  completedAt: string;
}

export class SpecialtyRankingService {
  
  async getModelRankings(modelId: string): Promise<SpecialtyRanking[]> {
    const result = await executeStatement(
      `SELECT * FROM specialty_rankings WHERE model_id = $1 ORDER BY proficiency_score DESC`,
      [{ name: 'modelId', value: { stringValue: modelId } }]
    );
    return result.rows.map(row => this.mapRanking(row as Record<string, unknown>));
  }

  async getBestModelForSpecialty(
    specialty: SpecialtyCategory,
    options: { excludeModels?: string[]; minScore?: number } = {}
  ): Promise<{ modelId: string; score: number; tier: string } | null> {
    let sql = `
      SELECT sr.model_id, sr.proficiency_score, sr.tier
      FROM specialty_rankings sr
      JOIN model_metadata mm ON sr.model_id = mm.model_id
      WHERE sr.specialty = $1 AND mm.is_available = true
    `;
    const params: Array<{ name: string; value: Record<string, unknown> }> = [
      { name: 'specialty', value: { stringValue: specialty } },
    ];

    if (options.minScore) {
      sql += ` AND sr.proficiency_score >= $2`;
      params.push({ name: 'minScore', value: { doubleValue: options.minScore } });
    }

    sql += ` ORDER BY COALESCE(sr.admin_override, sr.proficiency_score) DESC LIMIT 1`;

    const result = await executeStatement(sql, params);
    if (result.rows.length === 0) return null;

    const row = result.rows[0] as Record<string, unknown>;
    return {
      modelId: String(row.model_id),
      score: Number(row.proficiency_score),
      tier: String(row.tier),
    };
  }

  async getSpecialtyLeaderboard(specialty: SpecialtyCategory, limit = 20): Promise<{
    specialty: SpecialtyCategory;
    rankings: Array<{ rank: number; modelId: string; provider: string; score: number; tier: string }>;
  }> {
    const result = await executeStatement(
      `SELECT sr.*, mm.model_name, mm.provider
       FROM specialty_rankings sr
       JOIN model_metadata mm ON sr.model_id = mm.model_id
       WHERE sr.specialty = $1 AND mm.is_available = true
       ORDER BY COALESCE(sr.admin_override, sr.proficiency_score) DESC
       LIMIT $2`,
      [
        { name: 'specialty', value: { stringValue: specialty } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    return {
      specialty,
      rankings: result.rows.map((row, i) => {
        const r = row as Record<string, unknown>;
        return {
          rank: i + 1,
          modelId: String(r.model_id),
          provider: String(r.provider),
          score: Number(r.proficiency_score),
          tier: String(r.tier),
        };
      }),
    };
  }

  async researchModelProficiency(modelId: string): Promise<RankingResearchResult> {
    const startTime = Date.now();
    const specialties = Object.keys(SPECIALTY_CATEGORIES) as SpecialtyCategory[];

    const prompt = `Research AI model proficiency for: ${modelId}

Search for benchmarks, reviews, and community feedback to rank this model's proficiency across these specialties:
${specialties.map(s => `- ${s}: ${SPECIALTY_CATEGORIES[s].name}`).join('\n')}

For each specialty, provide:
- proficiencyScore: 0-100 overall score
- benchmarkScore: 0-100 from published benchmarks (MMLU, HumanEval, etc.)
- communityScore: 0-100 from community reviews
- tier: S/A/B/C/D/F classification
- confidence: 0-1 confidence in this assessment
- sources: array of sources used

Return JSON:
{
  "specialties": {
    "reasoning": { "proficiencyScore": 85, "benchmarkScore": 88, "communityScore": 82, "tier": "A", "confidence": 0.9, "sources": ["MMLU benchmark", "..."] },
    ...
  },
  "overallConfidence": 0.85,
  "summary": "Brief assessment summary"
}`;

    const response = await modelRouterService.invoke({
      modelId: 'anthropic/claude-3-5-sonnet-20241022',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 4096,
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Failed to parse research response');

    const findings = JSON.parse(jsonMatch[0]);
    let rankingsChanged = 0;

    for (const [specialty, data] of Object.entries(findings.specialties || {})) {
      const d = data as { proficiencyScore: number; benchmarkScore: number; communityScore: number; tier: string; confidence: number; sources: string[] };
      await this.upsertRanking(modelId, specialty as SpecialtyCategory, d);
      rankingsChanged++;
    }

    await this.recalculateGlobalRanks();

    return {
      researchId: `research-${Date.now()}`,
      modelsResearched: 1,
      specialtiesUpdated: rankingsChanged,
      rankingsChanged,
      duration: Date.now() - startTime,
      aiConfidence: findings.overallConfidence || 0.8,
      completedAt: new Date().toISOString(),
    };
  }

  async researchSpecialtyRankings(specialty: SpecialtyCategory): Promise<RankingResearchResult> {
    const startTime = Date.now();

    const modelsResult = await executeStatement(
      `SELECT model_id, provider, model_name FROM model_metadata WHERE is_available = true LIMIT 50`,
      []
    );
    const models = modelsResult.rows as Array<{ model_id: string; provider: string; model_name: string }>;

    const prompt = `Rank these AI models for "${SPECIALTY_CATEGORIES[specialty].name}" proficiency:

${models.map(m => `- ${m.model_id} (${m.model_name})`).join('\n')}

Search benchmarks, reviews, and community feedback. Return JSON:
{
  "rankings": [
    { "modelId": "provider/model", "score": 95, "tier": "S", "reasoning": "..." },
    ...
  ],
  "sources": ["source1", "source2"],
  "confidence": 0.85
}

Order by score descending. Be accurate based on real benchmark data.`;

    const response = await modelRouterService.invoke({
      modelId: 'anthropic/claude-3-5-sonnet-20241022',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 4096,
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Failed to parse rankings');

    const findings = JSON.parse(jsonMatch[0]);
    let rankingsChanged = 0;

    for (const r of findings.rankings || []) {
      await this.upsertRanking(r.modelId, specialty, {
        proficiencyScore: r.score,
        benchmarkScore: r.score,
        communityScore: r.score,
        tier: r.tier,
        confidence: findings.confidence || 0.8,
        sources: findings.sources || [],
      });
      rankingsChanged++;
    }

    await this.recalculateGlobalRanks(specialty);

    return {
      researchId: `research-${Date.now()}`,
      modelsResearched: models.length,
      specialtiesUpdated: 1,
      rankingsChanged,
      duration: Date.now() - startTime,
      aiConfidence: findings.confidence || 0.8,
      completedAt: new Date().toISOString(),
    };
  }

  async adminOverrideRanking(modelId: string, specialty: SpecialtyCategory, score: number, notes?: string): Promise<void> {
    await executeStatement(
      `UPDATE specialty_rankings SET admin_override = $3, admin_notes = $4, is_locked = true WHERE model_id = $1 AND specialty = $2`,
      [
        { name: 'modelId', value: { stringValue: modelId } },
        { name: 'specialty', value: { stringValue: specialty } },
        { name: 'score', value: { doubleValue: score } },
        { name: 'notes', value: notes ? { stringValue: notes } : { isNull: true } },
      ]
    );
  }

  async unlockRanking(modelId: string, specialty: SpecialtyCategory): Promise<void> {
    await executeStatement(
      `UPDATE specialty_rankings SET admin_override = NULL, is_locked = false WHERE model_id = $1 AND specialty = $2`,
      [
        { name: 'modelId', value: { stringValue: modelId } },
        { name: 'specialty', value: { stringValue: specialty } },
      ]
    );
  }

  private async upsertRanking(modelId: string, specialty: SpecialtyCategory, data: {
    proficiencyScore: number;
    benchmarkScore: number;
    communityScore: number;
    tier: string;
    confidence: number;
    sources: string[];
  }): Promise<void> {
    const provider = modelId.split('/')[0];
    await executeStatement(
      `INSERT INTO specialty_rankings (model_id, provider, specialty, proficiency_score, benchmark_score, community_score, tier, confidence, research_sources, last_researched)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (model_id, specialty) DO UPDATE SET
         proficiency_score = $4, benchmark_score = $5, community_score = $6, tier = $7, confidence = $8, research_sources = $9, last_researched = NOW(), updated_at = NOW()
       WHERE specialty_rankings.is_locked = false`,
      [
        { name: 'modelId', value: { stringValue: modelId } },
        { name: 'provider', value: { stringValue: provider } },
        { name: 'specialty', value: { stringValue: specialty } },
        { name: 'proficiency', value: { doubleValue: data.proficiencyScore } },
        { name: 'benchmark', value: { doubleValue: data.benchmarkScore } },
        { name: 'community', value: { doubleValue: data.communityScore } },
        { name: 'tier', value: { stringValue: data.tier } },
        { name: 'confidence', value: { doubleValue: data.confidence } },
        { name: 'sources', value: { stringValue: JSON.stringify(data.sources) } },
      ]
    );
  }

  private async recalculateGlobalRanks(specialty?: SpecialtyCategory): Promise<void> {
    const specialties = specialty ? [specialty] : Object.keys(SPECIALTY_CATEGORIES) as SpecialtyCategory[];
    for (const s of specialties) {
      await executeStatement(
        `WITH ranked AS (
          SELECT ranking_id, ROW_NUMBER() OVER (ORDER BY COALESCE(admin_override, proficiency_score) DESC) as new_rank,
                 PERCENT_RANK() OVER (ORDER BY COALESCE(admin_override, proficiency_score) ASC) * 100 as new_percentile
          FROM specialty_rankings WHERE specialty = $1
        )
        UPDATE specialty_rankings SET rank = ranked.new_rank, percentile = ranked.new_percentile
        FROM ranked WHERE specialty_rankings.ranking_id = ranked.ranking_id`,
        [{ name: 'specialty', value: { stringValue: s } }]
      );
    }
  }

  private mapRanking(row: Record<string, unknown>): SpecialtyRanking {
    return {
      rankingId: String(row.ranking_id || ''),
      modelId: String(row.model_id),
      provider: String(row.provider),
      specialty: String(row.specialty) as SpecialtyCategory,
      proficiencyScore: Number(row.proficiency_score || 0),
      benchmarkScore: Number(row.benchmark_score || 0),
      communityScore: Number(row.community_score || 0),
      internalScore: Number(row.internal_score || 0),
      rank: Number(row.rank || 0),
      percentile: Number(row.percentile || 0),
      tier: (String(row.tier || 'C')) as SpecialtyRanking['tier'],
      confidence: Number(row.confidence || 0.5),
      dataPoints: Number(row.data_points || 0),
      lastResearched: String(row.last_researched || ''),
      researchSources: JSON.parse(String(row.research_sources || '[]')),
      trend: (String(row.trend || 'stable')) as SpecialtyRanking['trend'],
      adminOverride: row.admin_override ? Number(row.admin_override) : undefined,
      isLocked: Boolean(row.is_locked),
      updatedAt: String(row.updated_at || ''),
    };
  }

  // ============================================================================
  // Mode Rankings
  // ============================================================================

  async getModeRankings(mode: OrchestrationMode): Promise<ModeRanking[]> {
    const result = await executeStatement(
      `SELECT * FROM mode_model_rankings WHERE mode = $1 ORDER BY COALESCE(admin_override, score) DESC`,
      [{ name: 'mode', value: { stringValue: mode } }]
    );
    return result.rows.map(row => this.mapModeRanking(row as Record<string, unknown>));
  }

  async getBestModelForMode(
    mode: OrchestrationMode,
    options: { excludeModels?: string[]; minScore?: number } = {}
  ): Promise<{ modelId: string; score: number; tier: string } | null> {
    let sql = `
      SELECT mr.model_id, mr.score, mr.tier
      FROM mode_model_rankings mr
      JOIN model_metadata mm ON mr.model_id = mm.model_id
      WHERE mr.mode = $1 AND mm.is_available = true
    `;
    const params: Array<{ name: string; value: Record<string, unknown> }> = [
      { name: 'mode', value: { stringValue: mode } },
    ];

    if (options.minScore) {
      sql += ` AND COALESCE(mr.admin_override, mr.score) >= $2`;
      params.push({ name: 'minScore', value: { doubleValue: options.minScore } });
    }

    sql += ` ORDER BY COALESCE(mr.admin_override, mr.score) DESC LIMIT 1`;

    const result = await executeStatement(sql, params);
    if (result.rows.length === 0) return null;

    const row = result.rows[0] as Record<string, unknown>;
    return {
      modelId: String(row.model_id),
      score: Number(row.score),
      tier: String(row.tier),
    };
  }

  async researchModeRankings(mode: OrchestrationMode): Promise<RankingResearchResult> {
    const startTime = Date.now();
    const modeInfo = ORCHESTRATION_MODES[mode];

    const modelsResult = await executeStatement(
      `SELECT model_id, provider, model_name FROM model_metadata WHERE is_available = true LIMIT 50`,
      []
    );
    const models = modelsResult.rows as Array<{ model_id: string; provider: string; model_name: string }>;

    const prompt = `Rank these AI models for "${modeInfo.name}" orchestration mode.

Mode: ${modeInfo.name}
Description: ${modeInfo.description}

Models to rank:
${models.map(m => `- ${m.model_id} (${m.model_name})`).join('\n')}

For each model, evaluate:
- How well suited is it for ${modeInfo.name} mode?
- What are its strengths in this mode?
- What are its limitations?

Return JSON:
{
  "rankings": [
    { "modelId": "provider/model", "score": 95, "tier": "S", "strengths": ["..."], "weaknesses": ["..."], "recommendedFor": ["..."] }
  ],
  "sources": ["source1", "source2"],
  "confidence": 0.85
}`;

    const response = await modelRouterService.invoke({
      modelId: 'anthropic/claude-3-5-sonnet-20241022',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 4096,
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Failed to parse mode rankings');

    const findings = JSON.parse(jsonMatch[0]);
    let rankingsChanged = 0;

    for (const r of findings.rankings || []) {
      await this.upsertModeRanking(mode, r.modelId, {
        score: r.score,
        tier: r.tier,
        strengths: r.strengths || [],
        weaknesses: r.weaknesses || [],
        recommendedFor: r.recommendedFor || [],
        confidence: findings.confidence || 0.8,
      });
      rankingsChanged++;
    }

    return {
      researchId: `research-mode-${Date.now()}`,
      modelsResearched: models.length,
      specialtiesUpdated: 1,
      rankingsChanged,
      duration: Date.now() - startTime,
      aiConfidence: findings.confidence || 0.8,
      completedAt: new Date().toISOString(),
    };
  }

  private async upsertModeRanking(mode: OrchestrationMode, modelId: string, data: {
    score: number;
    tier: string;
    strengths: string[];
    weaknesses: string[];
    recommendedFor: string[];
    confidence: number;
  }): Promise<void> {
    const provider = modelId.split('/')[0];
    await executeStatement(
      `INSERT INTO mode_model_rankings (mode, model_id, provider, score, tier, strengths, weaknesses, recommended_for, confidence)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (mode, model_id) DO UPDATE SET
         score = $4, tier = $5, strengths = $6, weaknesses = $7, recommended_for = $8, confidence = $9, updated_at = NOW()
       WHERE mode_model_rankings.is_locked = false`,
      [
        { name: 'mode', value: { stringValue: mode } },
        { name: 'modelId', value: { stringValue: modelId } },
        { name: 'provider', value: { stringValue: provider } },
        { name: 'score', value: { doubleValue: data.score } },
        { name: 'tier', value: { stringValue: data.tier } },
        { name: 'strengths', value: { stringValue: JSON.stringify(data.strengths) } },
        { name: 'weaknesses', value: { stringValue: JSON.stringify(data.weaknesses) } },
        { name: 'recommendedFor', value: { stringValue: JSON.stringify(data.recommendedFor) } },
        { name: 'confidence', value: { doubleValue: data.confidence } },
      ]
    );
  }

  // ============================================================================
  // Scoring Weights
  // ============================================================================

  async getScoringWeights(): Promise<ScoringWeights> {
    const result = await executeStatement(
      `SELECT config_value FROM system_config WHERE config_key = 'specialty_ranking_weights'`,
      []
    );
    if (result.rows.length === 0) return DEFAULT_SCORING_WEIGHTS;
    const row = result.rows[0] as { config_value: string };
    return JSON.parse(row.config_value);
  }

  async updateScoringWeights(weights: ScoringWeights): Promise<void> {
    // Normalize weights to sum to 1
    const total = weights.benchmarkWeight + weights.communityWeight + weights.internalWeight;
    const normalized: ScoringWeights = {
      benchmarkWeight: weights.benchmarkWeight / total,
      communityWeight: weights.communityWeight / total,
      internalWeight: weights.internalWeight / total,
    };

    await executeStatement(
      `INSERT INTO system_config (config_key, config_value, description)
       VALUES ('specialty_ranking_weights', $1, 'Weights for specialty ranking calculation')
       ON CONFLICT (config_key) DO UPDATE SET config_value = $1, updated_at = NOW()`,
      [{ name: 'weights', value: { stringValue: JSON.stringify(normalized) } }]
    );
  }

  // ============================================================================
  // Research Schedules
  // ============================================================================

  async getResearchSchedules(): Promise<ResearchSchedule[]> {
    const result = await executeStatement(
      `SELECT * FROM ranking_research_schedules ORDER BY name`,
      []
    );
    return result.rows.map(row => this.mapSchedule(row as Record<string, unknown>));
  }

  async updateResearchSchedule(scheduleId: string, updates: Partial<ResearchSchedule>): Promise<void> {
    const fields: string[] = [];
    const params: Array<{ name: string; value: Record<string, unknown> }> = [
      { name: 'scheduleId', value: { stringValue: scheduleId } },
    ];

    if (updates.frequency !== undefined) {
      fields.push(`frequency = $${params.length + 1}`);
      params.push({ name: 'frequency', value: { stringValue: updates.frequency } });
    }
    if (updates.cronExpression !== undefined) {
      fields.push(`cron_expression = $${params.length + 1}`);
      params.push({ name: 'cron', value: { stringValue: updates.cronExpression } });
    }
    if (updates.enabled !== undefined) {
      fields.push(`enabled = $${params.length + 1}`);
      params.push({ name: 'enabled', value: { booleanValue: updates.enabled } });
    }

    if (fields.length > 0) {
      await executeStatement(
        `UPDATE ranking_research_schedules SET ${fields.join(', ')}, updated_at = NOW() WHERE schedule_id = $1`,
        params
      );
    }
  }

  async triggerResearchNow(scope: 'all' | 'specialty' | 'mode', target?: string): Promise<RankingResearchResult> {
    if (scope === 'specialty' && target) {
      return this.researchSpecialtyRankings(target as SpecialtyCategory);
    } else if (scope === 'mode' && target) {
      return this.researchModeRankings(target as OrchestrationMode);
    } else {
      // Research all
      const specialties = Object.keys(SPECIALTY_CATEGORIES) as SpecialtyCategory[];
      const modes = Object.keys(ORCHESTRATION_MODES) as OrchestrationMode[];
      let total = 0;

      for (const s of specialties.slice(0, 5)) { // Limit to avoid timeout
        const result = await this.researchSpecialtyRankings(s);
        total += result.rankingsChanged;
      }
      for (const m of modes.slice(0, 3)) {
        const result = await this.researchModeRankings(m);
        total += result.rankingsChanged;
      }

      return {
        researchId: `full-research-${Date.now()}`,
        modelsResearched: total,
        specialtiesUpdated: specialties.length,
        rankingsChanged: total,
        duration: 0,
        aiConfidence: 0.8,
        completedAt: new Date().toISOString(),
      };
    }
  }

  private mapModeRanking(row: Record<string, unknown>): ModeRanking {
    return {
      rankingId: String(row.ranking_id || ''),
      mode: String(row.mode) as OrchestrationMode,
      modelId: String(row.model_id),
      provider: String(row.provider),
      score: Number(row.score || 0),
      tier: String(row.tier || 'C') as ModeRanking['tier'],
      strengths: JSON.parse(String(row.strengths || '[]')),
      weaknesses: JSON.parse(String(row.weaknesses || '[]')),
      recommendedFor: JSON.parse(String(row.recommended_for || '[]')),
      notRecommendedFor: JSON.parse(String(row.not_recommended_for || '[]')),
      confidence: Number(row.confidence || 0.5),
      isLocked: Boolean(row.is_locked),
      adminOverride: row.admin_override ? Number(row.admin_override) : undefined,
      updatedAt: String(row.updated_at || ''),
    };
  }

  private mapSchedule(row: Record<string, unknown>): ResearchSchedule {
    return {
      scheduleId: String(row.schedule_id || ''),
      name: String(row.name || ''),
      frequency: String(row.frequency || 'daily') as ResearchSchedule['frequency'],
      cronExpression: row.cron_expression ? String(row.cron_expression) : undefined,
      enabled: Boolean(row.enabled),
      lastRun: row.last_run ? String(row.last_run) : undefined,
      nextRun: row.next_run ? String(row.next_run) : undefined,
      targetScope: String(row.target_scope || 'all') as ResearchSchedule['targetScope'],
      targetFilter: row.target_filter ? String(row.target_filter) : undefined,
    };
  }
}

export const specialtyRankingService = new SpecialtyRankingService();
