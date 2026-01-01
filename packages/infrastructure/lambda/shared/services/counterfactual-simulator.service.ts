/**
 * Counterfactual Simulator Service
 * Tracks "what-if" alternative paths to improve model selection.
 * RADIANT v6.1.0
 */

import type { CounterfactualResult } from '@radiant/shared';
import { COUNTERFACTUAL_SAMPLING_STRATEGIES, COUNTERFACTUAL_MAX_DAILY_SIMULATIONS } from '@radiant/shared/constants';
import { getDbPool } from './database';
import { callLiteLLM } from './litellm.service';
import { rewardModel } from './reward-model.service';

export class CounterfactualSimulatorService {
  private dailySimulationCount: Map<string, number> = new Map();
  private lastResetDate: string = '';
  
  shouldSample(reason: CounterfactualResult['sampleReason']): boolean {
    const strategy = COUNTERFACTUAL_SAMPLING_STRATEGIES.find(s => s.reason === reason);
    if (!strategy) return false;
    return Math.random() < strategy.rate;
  }
  
  async recordCandidate(
    requestId: string,
    tenantId: string,
    originalModel: string,
    alternativeModels: string[],
    prompt: string,
    originalResponse: string,
    originalLatencyMs?: number,
    originalCost?: number
  ): Promise<string> {
    const pool = await getDbPool();
    const id = crypto.randomUUID();
    
    await pool.query(`
      INSERT INTO counterfactual_candidates (
        id, request_id, tenant_id, original_model, alternative_models,
        prompt, original_response, original_latency_ms, original_cost, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    `, [
      id, requestId, tenantId, originalModel, alternativeModels,
      prompt, originalResponse, originalLatencyMs, originalCost,
    ]);
    
    return id;
  }
  
  async simulateAlternative(
    candidateId: string,
    alternativeModel: string,
    sampleReason: CounterfactualResult['sampleReason']
  ): Promise<CounterfactualResult | null> {
    const pool = await getDbPool();
    
    const candidateResult = await pool.query(`
      SELECT * FROM counterfactual_candidates WHERE id = $1
    `, [candidateId]);
    
    if (candidateResult.rows.length === 0) return null;
    
    const candidate = candidateResult.rows[0];
    const tenantId = candidate.tenant_id;
    
    if (!this.checkDailyLimit(tenantId)) {
      console.log(`Daily simulation limit reached for tenant ${tenantId}`);
      return null;
    }
    
    const startTime = Date.now();
    let alternativeResponse: string | null = null;
    let alternativeLatencyMs: number | null = null;
    let alternativeCost: number | null = null;
    
    try {
      const response = await callLiteLLM({
        model: alternativeModel,
        messages: [{ role: 'user', content: candidate.prompt }],
        temperature: 0.7,
        max_tokens: 4096,
      });
      
      alternativeResponse = response.content;
      alternativeLatencyMs = Date.now() - startTime;
      alternativeCost = this.estimateCost(alternativeModel, candidate.prompt.length, alternativeResponse.length);
    } catch (error) {
      console.error(`Failed to simulate alternative model ${alternativeModel}:`, error);
    }
    
    let originalRewardScore: number | null = null;
    let alternativeRewardScore: number | null = null;
    let preferredByReward: CounterfactualResult['preferredByReward'] = null;
    
    if (alternativeResponse) {
      const rewardContext = {
        userId: 'system',
        tenantId,
        conversationHistory: [],
        originalPrompt: candidate.prompt,
        domainIds: [],
        userPreferences: {
          responseLength: 'balanced' as const,
          formalityLevel: 'professional' as const,
          preferredModels: [],
        },
      };
      
      try {
        const [origScore, altScore] = await Promise.all([
          rewardModel.scoreResponse(candidate.original_response, rewardContext),
          rewardModel.scoreResponse(alternativeResponse, rewardContext),
        ]);
        
        originalRewardScore = origScore.overall;
        alternativeRewardScore = altScore.overall;
        
        const delta = alternativeRewardScore - originalRewardScore;
        if (delta > 0.05) preferredByReward = 'alternative';
        else if (delta < -0.05) preferredByReward = 'original';
        else preferredByReward = 'equal';
      } catch (error) {
        console.error('Failed to score responses:', error);
      }
    }
    
    const result: CounterfactualResult = {
      id: crypto.randomUUID(),
      traceId: candidateId,
      tenantId,
      originalModel: candidate.original_model,
      originalResponse: candidate.original_response,
      originalLatencyMs: candidate.original_latency_ms,
      originalCost: candidate.original_cost ? parseFloat(candidate.original_cost) : null,
      originalRewardScore,
      alternativeModel,
      alternativeResponse,
      alternativeLatencyMs,
      alternativeCost,
      alternativeRewardScore,
      preferredByReward,
      qualityDelta: alternativeRewardScore !== null && originalRewardScore !== null
        ? alternativeRewardScore - originalRewardScore
        : null,
      costDelta: alternativeCost !== null && candidate.original_cost
        ? alternativeCost - parseFloat(candidate.original_cost)
        : null,
      sampleReason,
      createdAt: new Date(),
    };
    
    await this.saveSimulation(result);
    this.incrementDailyCount(tenantId);
    
    return result;
  }
  
  async getSimulations(
    tenantId: string,
    options: {
      sampleReason?: CounterfactualResult['sampleReason'];
      preferredByReward?: CounterfactualResult['preferredByReward'];
      limit?: number;
    } = {}
  ): Promise<CounterfactualResult[]> {
    const pool = await getDbPool();
    let query = `SELECT * FROM counterfactual_simulations WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let idx = 2;
    
    if (options.sampleReason) {
      query += ` AND sample_reason = $${idx++}`;
      params.push(options.sampleReason);
    }
    if (options.preferredByReward) {
      query += ` AND preferred_by_reward = $${idx++}`;
      params.push(options.preferredByReward);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${idx}`;
    params.push(options.limit || 100);
    
    const result = await pool.query(query, params);
    return result.rows.map(this.rowToResult);
  }
  
  async getInsights(tenantId: string): Promise<{
    totalSimulations: number;
    alternativePreferredRate: number;
    avgQualityDelta: number;
    avgCostDelta: number;
    modelComparisons: Array<{
      originalModel: string;
      alternativeModel: string;
      alternativeWinRate: number;
      count: number;
    }>;
  }> {
    const pool = await getDbPool();
    
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        AVG(CASE WHEN preferred_by_reward = 'alternative' THEN 1 ELSE 0 END) as alt_preferred_rate,
        AVG(quality_delta) as avg_quality_delta,
        AVG(cost_delta) as avg_cost_delta
      FROM counterfactual_simulations
      WHERE tenant_id = $1 AND preferred_by_reward IS NOT NULL
    `, [tenantId]);
    
    const comparisonsResult = await pool.query(`
      SELECT 
        original_model, alternative_model,
        COUNT(*) as count,
        AVG(CASE WHEN preferred_by_reward = 'alternative' THEN 1 ELSE 0 END) as alt_win_rate
      FROM counterfactual_simulations
      WHERE tenant_id = $1 AND preferred_by_reward IS NOT NULL
      GROUP BY original_model, alternative_model
      ORDER BY count DESC
      LIMIT 20
    `, [tenantId]);
    
    const stats = statsResult.rows[0];
    
    return {
      totalSimulations: parseInt(stats.total),
      alternativePreferredRate: parseFloat(stats.alt_preferred_rate) || 0,
      avgQualityDelta: parseFloat(stats.avg_quality_delta) || 0,
      avgCostDelta: parseFloat(stats.avg_cost_delta) || 0,
      modelComparisons: comparisonsResult.rows.map(row => ({
        originalModel: row.original_model,
        alternativeModel: row.alternative_model,
        alternativeWinRate: parseFloat(row.alt_win_rate),
        count: parseInt(row.count),
      })),
    };
  }
  
  private async saveSimulation(result: CounterfactualResult): Promise<void> {
    const pool = await getDbPool();
    
    await pool.query(`
      INSERT INTO counterfactual_simulations (
        id, trace_id, tenant_id, original_model, original_response,
        original_latency_ms, original_cost, original_reward_score,
        alternative_model, alternative_response, alternative_latency_ms,
        alternative_cost, alternative_reward_score, preferred_by_reward,
        quality_delta, cost_delta, sample_reason, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
    `, [
      result.id, result.traceId, result.tenantId, result.originalModel,
      result.originalResponse, result.originalLatencyMs, result.originalCost,
      result.originalRewardScore, result.alternativeModel, result.alternativeResponse,
      result.alternativeLatencyMs, result.alternativeCost, result.alternativeRewardScore,
      result.preferredByReward, result.qualityDelta, result.costDelta, result.sampleReason,
    ]);
  }
  
  private checkDailyLimit(tenantId: string): boolean {
    this.resetDailyCountIfNeeded();
    const count = this.dailySimulationCount.get(tenantId) || 0;
    return count < COUNTERFACTUAL_MAX_DAILY_SIMULATIONS;
  }
  
  private incrementDailyCount(tenantId: string): void {
    const count = this.dailySimulationCount.get(tenantId) || 0;
    this.dailySimulationCount.set(tenantId, count + 1);
  }
  
  private resetDailyCountIfNeeded(): void {
    const today = new Date().toISOString().split('T')[0];
    if (this.lastResetDate !== today) {
      this.dailySimulationCount.clear();
      this.lastResetDate = today;
    }
  }
  
  private estimateCost(model: string, inputLength: number, outputLength: number): number {
    const inputTokens = Math.ceil(inputLength / 4);
    const outputTokens = Math.ceil(outputLength / 4);
    
    const costs: Record<string, { input: number; output: number }> = {
      'claude-sonnet-4': { input: 3.0, output: 15.0 },
      'claude-opus-4-5-extended': { input: 15.0, output: 75.0 },
      'gpt-4o': { input: 2.5, output: 10.0 },
      'gemini-2-5-pro': { input: 1.25, output: 5.0 },
    };
    
    const modelCosts = costs[model] || { input: 1.0, output: 3.0 };
    return (inputTokens * modelCosts.input + outputTokens * modelCosts.output) / 1_000_000;
  }
  
  private rowToResult(row: any): CounterfactualResult {
    return {
      id: row.id,
      traceId: row.trace_id,
      tenantId: row.tenant_id,
      originalModel: row.original_model,
      originalResponse: row.original_response,
      originalLatencyMs: row.original_latency_ms,
      originalCost: row.original_cost ? parseFloat(row.original_cost) : null,
      originalRewardScore: row.original_reward_score ? parseFloat(row.original_reward_score) : null,
      alternativeModel: row.alternative_model,
      alternativeResponse: row.alternative_response,
      alternativeLatencyMs: row.alternative_latency_ms,
      alternativeCost: row.alternative_cost ? parseFloat(row.alternative_cost) : null,
      alternativeRewardScore: row.alternative_reward_score ? parseFloat(row.alternative_reward_score) : null,
      preferredByReward: row.preferred_by_reward,
      qualityDelta: row.quality_delta ? parseFloat(row.quality_delta) : null,
      costDelta: row.cost_delta ? parseFloat(row.cost_delta) : null,
      sampleReason: row.sample_reason,
      createdAt: new Date(row.created_at),
    };
  }
}

export const counterfactualSimulator = new CounterfactualSimulatorService();
