import { executeStatement } from '../db/client';
import { specialtyRankingService, type SpecialtyCategory } from './specialty-ranking.service';

export type TaskType = 'chat' | 'code' | 'analysis' | 'creative' | 'vision' | 'audio';

// Map task types to specialty categories
const TASK_TO_SPECIALTY: Record<TaskType, SpecialtyCategory> = {
  chat: 'conversation',
  code: 'coding',
  analysis: 'analysis',
  creative: 'creative',
  vision: 'vision',
  audio: 'audio',
};

interface RoutingContext {
  tenantId: string;
  userId: string;
  taskType: TaskType;
  inputTokenEstimate: number;
  maxLatencyMs?: number;
  maxCost?: number;
  preferredProvider?: string;
  requiresVision?: boolean;
  requiresAudio?: boolean;
}

interface RoutingResult {
  model: string;
  provider: string;
  reason: string;
  estimatedCost: number;
  estimatedLatencyMs: number;
  confidence: number;
}

interface ModelPerformance {
  avgLatencyMs: number;
  successRate: number;
}

interface ModelScore {
  costScore: number;
  latencyScore: number;
  qualityScore: number;
  reliabilityScore: number;
  estimatedCost: number;
  estimatedLatency: number;
  total: number;
}

interface CandidateModel {
  model_id: string;
  provider: string;
  input_cost_per_1k: number;
  output_cost_per_1k: number;
}

interface RoutingConditions {
  task_type?: TaskType;
  min_tokens?: number;
  max_tokens?: number;
  max_latency_ms?: number;
}

const TASK_QUALITY_SCORES: Record<string, Record<string, number>> = {
  code: { 
    'claude-3-5-sonnet-20241022': 0.95, 
    'gpt-4o': 0.90, 
    'deepseek-chat': 0.88,
    'grok-2': 0.85 
  },
  creative: { 
    'claude-3-opus-20240229': 0.95, 
    'gpt-4o': 0.88, 
    'gemini-1.5-pro': 0.85 
  },
  analysis: { 
    'claude-3-opus-20240229': 0.95, 
    'o1': 0.95, 
    'gemini-1.5-pro': 0.88 
  },
  vision: { 
    'gpt-4o': 0.95, 
    'claude-3-5-sonnet-20241022': 0.92, 
    'gemini-1.5-pro': 0.90 
  },
  chat: { 
    'gpt-4o': 0.90, 
    'claude-3-5-sonnet-20241022': 0.90, 
    'gemini-1.5-pro': 0.88 
  },
  audio: { 
    'gpt-4o-audio-preview': 0.90 
  },
};

const PROVIDER_MAP: Record<string, string> = {
  'claude-3-opus-20240229': 'anthropic',
  'claude-3-5-sonnet-20241022': 'anthropic',
  'claude-3-5-haiku-20241022': 'anthropic',
  'gpt-4o': 'openai',
  'gpt-4o-mini': 'openai',
  'o1': 'openai',
  'o1-mini': 'openai',
  'gemini-1.5-pro': 'google',
  'gemini-2.0-flash-exp': 'google',
  'grok-2': 'xai',
  'deepseek-chat': 'deepseek',
};

export class BrainRouter {
  private performanceCache: Map<string, ModelPerformance> = new Map();

  async route(context: RoutingContext): Promise<RoutingResult> {
    // 1. Check tenant-specific rules first
    const customRule = await this.checkCustomRules(context);
    if (customRule) return customRule;

    // 2. Get available models for task type
    const candidates = await this.getCandidateModels(context);

    if (candidates.length === 0) {
      return this.getDefaultRoute(context);
    }

    // 3. Score each candidate
    const scored = await Promise.all(
      candidates.map(async (model) => ({
        model,
        score: await this.scoreModel(model, context),
      }))
    );

    // 4. Sort by score and return best match
    scored.sort((a, b) => b.score.total - a.score.total);
    const best = scored[0];

    // 5. Log the routing decision
    await this.logRoutingDecision(context, best.model, best.score);

    return {
      model: best.model.model_id,
      provider: best.model.provider || PROVIDER_MAP[best.model.model_id] || 'unknown',
      reason: this.formatReason(best.score),
      estimatedCost: best.score.estimatedCost,
      estimatedLatencyMs: best.score.estimatedLatency,
      confidence: best.score.total,
    };
  }

  private async checkCustomRules(context: RoutingContext): Promise<RoutingResult | null> {
    const result = await executeStatement(
      `SELECT * FROM brain_routing_rules
       WHERE (tenant_id IS NULL OR tenant_id = $1)
       AND is_active = true
       ORDER BY priority ASC
       LIMIT 10`,
      [{ name: 'tenantId', value: { stringValue: context.tenantId } }]
    );

    if (result.rows.length === 0) return null;

    for (const row of result.rows) {
      const r = row as Record<string, unknown>;
      const conditions = typeof r.conditions === 'string' ? JSON.parse(r.conditions) : (r.conditions || {});
      if (this.matchesConditions(conditions, context)) {
        const targetModel = String(r.target_model || '');
        return {
          model: targetModel,
          provider: PROVIDER_MAP[targetModel] || 'unknown',
          reason: `Matched rule: ${r.name}`,
          estimatedCost: 0,
          estimatedLatencyMs: 0,
          confidence: 1.0,
        };
      }
    }

    return null;
  }

  private async getCandidateModels(context: RoutingContext): Promise<CandidateModel[]> {
    const result = await executeStatement(
      `SELECT id as model_id, name, provider_id, config, 
              input_cost_per_1k, output_cost_per_1k
       FROM models 
       WHERE status = 'active'
       LIMIT 20`,
      []
    );

    if (result.rows.length === 0) return [];

    return result.rows.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        model_id: String(r.name || ''),
        provider: String(r.provider_id || ''),
        input_cost_per_1k: parseFloat(String(r.input_cost_per_1k || 0)),
        output_cost_per_1k: parseFloat(String(r.output_cost_per_1k || 0)),
      };
    });
  }

  private async scoreModel(model: CandidateModel, context: RoutingContext): Promise<ModelScore> {
    const perf = await this.getModelPerformance(model.model_id);

    const costScore = this.scoreCost(model, context);
    const latencyScore = this.scoreLatency(perf, context);
    const qualityScore = await this.scoreQuality(model, context);
    const reliabilityScore = perf.successRate;

    const estimatedCost = this.estimateCost(model, context.inputTokenEstimate);
    const estimatedLatency = perf.avgLatencyMs;

    return {
      costScore,
      latencyScore,
      qualityScore,
      reliabilityScore,
      estimatedCost,
      estimatedLatency,
      total:
        costScore * 0.20 +
        latencyScore * 0.20 +
        qualityScore * 0.45 +  // Increased weight for specialty ranking
        reliabilityScore * 0.15,
    };
  }

  private scoreCost(model: CandidateModel, context: RoutingContext): number {
    if (!context.maxCost) return 0.5;
    const estimated = this.estimateCost(model, context.inputTokenEstimate);
    if (estimated > context.maxCost) return 0;
    return 1 - estimated / context.maxCost;
  }

  private scoreLatency(perf: ModelPerformance, context: RoutingContext): number {
    if (!context.maxLatencyMs) return 0.5;
    if (perf.avgLatencyMs > context.maxLatencyMs) return 0;
    return 1 - perf.avgLatencyMs / context.maxLatencyMs;
  }

  private async scoreQuality(model: CandidateModel, context: RoutingContext): Promise<number> {
    // First try to get specialty ranking from database
    const specialty = TASK_TO_SPECIALTY[context.taskType];
    if (specialty) {
      try {
        const rankings = await specialtyRankingService.getModelRankings(model.model_id);
        const ranking = rankings.find(r => r.specialty === specialty);
        if (ranking) {
          return ranking.proficiencyScore / 100; // Convert 0-100 to 0-1
        }
      } catch {
        // Fall through to hardcoded scores
      }
    }
    // Fallback to hardcoded scores
    const taskScores = TASK_QUALITY_SCORES[context.taskType] || {};
    return taskScores[model.model_id] ?? 0.7;
  }

  private estimateCost(model: CandidateModel, inputTokens: number): number {
    const outputEstimate = inputTokens * 1.5;
    return (
      (inputTokens * model.input_cost_per_1k) / 1000 +
      (outputEstimate * model.output_cost_per_1k) / 1000
    );
  }

  private async getModelPerformance(modelId: string): Promise<ModelPerformance> {
    if (this.performanceCache.has(modelId)) {
      return this.performanceCache.get(modelId)!;
    }

    const result = await executeStatement(
      `SELECT 
         AVG(latency_ms) as avg_latency,
         COUNT(CASE WHEN success THEN 1 END)::float / NULLIF(COUNT(*), 0)::float as success_rate
       FROM brain_routing_history
       WHERE selected_model = $1
       AND created_at > NOW() - INTERVAL '7 days'`,
      [{ name: 'modelId', value: { stringValue: modelId } }]
    );

    const row = result.rows[0] as Record<string, unknown> | undefined;
    const perf: ModelPerformance = {
      avgLatencyMs: parseFloat(String(row?.avg_latency ?? 1000)),
      successRate: parseFloat(String(row?.success_rate ?? 0.9)),
    };

    this.performanceCache.set(modelId, perf);
    return perf;
  }

  private formatReason(score: ModelScore): string {
    const factors: string[] = [];
    if (score.costScore > 0.8) factors.push('cost-effective');
    if (score.latencyScore > 0.8) factors.push('fast');
    if (score.qualityScore > 0.8) factors.push('high-quality');
    if (score.reliabilityScore > 0.95) factors.push('reliable');
    return factors.join(', ') || 'balanced choice';
  }

  private matchesConditions(conditions: RoutingConditions, context: RoutingContext): boolean {
    if (conditions.task_type && conditions.task_type !== context.taskType) return false;
    if (conditions.min_tokens && context.inputTokenEstimate < conditions.min_tokens) return false;
    if (conditions.max_tokens && context.inputTokenEstimate > conditions.max_tokens) return false;
    if (conditions.max_latency_ms && context.maxLatencyMs && context.maxLatencyMs > conditions.max_latency_ms) return false;
    return true;
  }

  private async logRoutingDecision(context: RoutingContext, model: CandidateModel, score: ModelScore): Promise<void> {
    await executeStatement(
      `INSERT INTO brain_routing_history 
       (tenant_id, user_id, task_type, selected_model, selection_reason, input_tokens, cost)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        { name: 'tenantId', value: { stringValue: context.tenantId } },
        { name: 'userId', value: { stringValue: context.userId } },
        { name: 'taskType', value: { stringValue: context.taskType } },
        { name: 'model', value: { stringValue: model.model_id } },
        { name: 'reason', value: { stringValue: this.formatReason(score) } },
        { name: 'tokens', value: { longValue: context.inputTokenEstimate } },
        { name: 'cost', value: { doubleValue: score.estimatedCost } },
      ]
    );
  }

  private getDefaultRoute(context: RoutingContext): RoutingResult {
    return {
      model: 'gpt-4o',
      provider: 'openai',
      reason: 'default fallback',
      estimatedCost: 0.01,
      estimatedLatencyMs: 1000,
      confidence: 0.5,
    };
  }
}

export const brainRouter = new BrainRouter();
