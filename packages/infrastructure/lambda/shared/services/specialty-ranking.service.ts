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
}

export const specialtyRankingService = new SpecialtyRankingService();
