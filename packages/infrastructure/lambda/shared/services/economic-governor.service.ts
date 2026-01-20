// RADIANT v4.18.0 - Economic Governor Service
// Model Arbitrage & Cost Optimization
// Novel UI: "Fuel Gauge" - budget meter with cost tracking

import { executeStatement, stringParam, longParam, doubleParam, boolParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

export interface GovernorConfig {
  tenantId: string;
  enabled: boolean;
  mode: GovernorMode;
  budgetLimit: number;
  budgetUsed: number;
  budgetResetAt: string;
  costAlertThreshold: number;
  preferSelfHosted: boolean;
  qualityFloor: number;
  latencyTarget: number;
  modelTiers: ModelTier[];
  arbitrageRules: ArbitrageRule[];
  fallbackStrategy: FallbackStrategy;
}

export type GovernorMode = 'cost_minimizer' | 'quality_maximizer' | 'balanced' | 'latency_focused' | 'custom';
export type FallbackStrategy = 'cascade' | 'round_robin' | 'random' | 'none';

export interface ModelTier {
  name: string;
  models: string[];
  costPerToken: number;
  qualityScore: number;
  avgLatencyMs: number;
  priority: number;
}

export interface ArbitrageRule {
  id: string;
  name: string;
  condition: RuleCondition;
  action: RuleAction;
  enabled: boolean;
}

export interface RuleCondition {
  type: 'budget_threshold' | 'time_of_day' | 'task_complexity' | 'latency_requirement';
  value: unknown;
}

export interface RuleAction {
  type: 'switch_tier' | 'apply_discount' | 'rate_limit' | 'notify';
  params: Record<string, unknown>;
}

export interface ModelRecommendation {
  model: string;
  tier: string;
  estimatedCost: number;
  estimatedLatency: number;
  qualityScore: number;
  reason: string;
}

export interface CostMetrics {
  totalCost: number;
  costByModel: Record<string, number>;
  costByTier: Record<string, number>;
  tokensByModel: Record<string, number>;
  savingsFromArbitrage: number;
  period: string;
}

// ============================================================================
// Economic Governor Service
// ============================================================================

class EconomicGovernorService {
  private readonly DEFAULT_TIERS: ModelTier[] = [
    { name: 'economy', models: ['gpt-3.5-turbo', 'claude-instant'], costPerToken: 0.0001, qualityScore: 0.7, avgLatencyMs: 500, priority: 1 },
    { name: 'selfhosted', models: ['llama-3-70b', 'mixtral-8x7b'], costPerToken: 0.00005, qualityScore: 0.75, avgLatencyMs: 800, priority: 2 },
    { name: 'standard', models: ['gpt-4o-mini', 'claude-3-haiku'], costPerToken: 0.0005, qualityScore: 0.85, avgLatencyMs: 1000, priority: 3 },
    { name: 'premium', models: ['gpt-4o', 'claude-3-sonnet'], costPerToken: 0.002, qualityScore: 0.92, avgLatencyMs: 1500, priority: 4 },
    { name: 'flagship', models: ['gpt-4-turbo', 'claude-3-opus'], costPerToken: 0.006, qualityScore: 0.98, avgLatencyMs: 2000, priority: 5 },
  ];

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  async getConfig(tenantId: string): Promise<GovernorConfig> {
    try {
      const result = await executeStatement(
        `SELECT * FROM economic_governor_config WHERE tenant_id = :tenantId`,
        [stringParam('tenantId', tenantId)]
      );

      if (result.rows && result.rows.length > 0) {
        return this.parseConfig(result.rows[0] as Record<string, unknown>);
      }

      return {
        tenantId,
        enabled: true,
        mode: 'balanced',
        budgetLimit: 100,
        budgetUsed: 0,
        budgetResetAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        costAlertThreshold: 80,
        preferSelfHosted: true,
        qualityFloor: 0.7,
        latencyTarget: 2000,
        modelTiers: this.DEFAULT_TIERS,
        arbitrageRules: [],
        fallbackStrategy: 'cascade',
      };
    } catch (error) {
      logger.error('Failed to get governor config', { tenantId, error });
      throw error;
    }
  }

  async updateConfig(tenantId: string, updates: Partial<GovernorConfig>): Promise<GovernorConfig> {
    try {
      const current = await this.getConfig(tenantId);
      const merged = { ...current, ...updates };

      await executeStatement(
        `INSERT INTO economic_governor_config (
            tenant_id, enabled, mode, budget_limit, budget_used, budget_reset_at,
            cost_alert_threshold, prefer_self_hosted, quality_floor, latency_target,
            model_tiers, arbitrage_rules, fallback_strategy, updated_at
          ) VALUES (
            :tenantId, :enabled, :mode, :budgetLimit, :budgetUsed, :budgetResetAt,
            :costAlertThreshold, :preferSelfHosted, :qualityFloor, :latencyTarget,
            :modelTiers, :arbitrageRules, :fallbackStrategy, NOW()
          )
          ON CONFLICT (tenant_id) DO UPDATE SET
            enabled = :enabled, mode = :mode, budget_limit = :budgetLimit,
            budget_used = :budgetUsed, budget_reset_at = :budgetResetAt,
            cost_alert_threshold = :costAlertThreshold, prefer_self_hosted = :preferSelfHosted,
            quality_floor = :qualityFloor, latency_target = :latencyTarget,
            model_tiers = :modelTiers, arbitrage_rules = :arbitrageRules,
            fallback_strategy = :fallbackStrategy, updated_at = NOW()`,
        [
          stringParam('tenantId', tenantId),
          boolParam('enabled', merged.enabled),
          stringParam('mode', merged.mode),
          doubleParam('budgetLimit', merged.budgetLimit),
          doubleParam('budgetUsed', merged.budgetUsed),
          stringParam('budgetResetAt', merged.budgetResetAt),
          doubleParam('costAlertThreshold', merged.costAlertThreshold),
          boolParam('preferSelfHosted', merged.preferSelfHosted),
          doubleParam('qualityFloor', merged.qualityFloor),
          longParam('latencyTarget', merged.latencyTarget),
          stringParam('modelTiers', JSON.stringify(merged.modelTiers)),
          stringParam('arbitrageRules', JSON.stringify(merged.arbitrageRules)),
          stringParam('fallbackStrategy', merged.fallbackStrategy),
        ]
      );

      return merged;
    } catch (error) {
      logger.error('Failed to update governor config', { tenantId, error });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Model Recommendation
  // --------------------------------------------------------------------------

  async recommendModel(
    tenantId: string,
    taskComplexity: number,
    maxLatency?: number,
    minQuality?: number
  ): Promise<ModelRecommendation> {
    try {
      const config = await this.getConfig(tenantId);
      const tiers = config.modelTiers.length > 0 ? config.modelTiers : this.DEFAULT_TIERS;

      // Filter tiers based on requirements
      const eligibleTiers = tiers.filter(tier => {
        if (maxLatency && tier.avgLatencyMs > maxLatency) return false;
        if (minQuality && tier.qualityScore < minQuality) return false;
        if (tier.qualityScore < config.qualityFloor) return false;
        return true;
      });

      if (eligibleTiers.length === 0) {
        return { model: 'gpt-4o', tier: 'premium', estimatedCost: 0.002, estimatedLatency: 1500, qualityScore: 0.92, reason: 'No eligible tiers, using default' };
      }

      // Select based on mode
      let selectedTier: ModelTier;
      switch (config.mode) {
        case 'cost_minimizer':
          selectedTier = eligibleTiers.sort((a, b) => a.costPerToken - b.costPerToken)[0];
          break;
        case 'quality_maximizer':
          selectedTier = eligibleTiers.sort((a, b) => b.qualityScore - a.qualityScore)[0];
          break;
        case 'latency_focused':
          selectedTier = eligibleTiers.sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)[0];
          break;
        default:
          // Balanced: score = quality * 0.4 + (1 - cost_normalized) * 0.4 + (1 - latency_normalized) * 0.2
          selectedTier = eligibleTiers.sort((a, b) => {
            const scoreA = a.qualityScore * 0.4 + (1 - a.costPerToken / 0.01) * 0.4 + (1 - a.avgLatencyMs / 5000) * 0.2;
            const scoreB = b.qualityScore * 0.4 + (1 - b.costPerToken / 0.01) * 0.4 + (1 - b.avgLatencyMs / 5000) * 0.2;
            return scoreB - scoreA;
          })[0];
      }

      // Prefer self-hosted if enabled
      if (config.preferSelfHosted && selectedTier.name !== 'selfhosted') {
        const selfHosted = eligibleTiers.find(t => t.name === 'selfhosted');
        if (selfHosted && selfHosted.qualityScore >= config.qualityFloor) {
          selectedTier = selfHosted;
        }
      }

      const model = selectedTier.models[0];
      return {
        model,
        tier: selectedTier.name,
        estimatedCost: selectedTier.costPerToken * 1000,
        estimatedLatency: selectedTier.avgLatencyMs,
        qualityScore: selectedTier.qualityScore,
        reason: `Selected ${selectedTier.name} tier based on ${config.mode} mode`,
      };
    } catch (error) {
      logger.error('Failed to recommend model', { tenantId, error });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Cost Tracking
  // --------------------------------------------------------------------------

  async recordUsage(tenantId: string, model: string, tokens: number, cost: number, latencyMs: number): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO economic_governor_usage (tenant_id, model, tokens, cost, latency_ms, recorded_at)
          VALUES (:tenantId, :model, :tokens, :cost, :latencyMs, NOW())`,
        [
          stringParam('tenantId', tenantId),
          stringParam('model', model),
          longParam('tokens', tokens),
          doubleParam('cost', cost),
          longParam('latencyMs', latencyMs),
        ]
      );

      // Update budget used
      await executeStatement(
        `UPDATE economic_governor_config SET budget_used = budget_used + :cost, updated_at = NOW()
          WHERE tenant_id = :tenantId`,
        [doubleParam('cost', cost), stringParam('tenantId', tenantId)]
      );
    } catch (error) {
      logger.error('Failed to record usage', { tenantId, model, error });
      throw error;
    }
  }

  async getMetrics(tenantId: string, period: 'day' | 'week' | 'month' = 'day'): Promise<CostMetrics> {
    try {
      const interval = period === 'day' ? '1 day' : period === 'week' ? '7 days' : '30 days';

      const result = await executeStatement(
        `SELECT model, SUM(tokens) as tokens, SUM(cost) as cost
          FROM economic_governor_usage
          WHERE tenant_id = :tenantId AND recorded_at > NOW() - INTERVAL '${interval}'
          GROUP BY model`,
        [stringParam('tenantId', tenantId)]
      );

      const costByModel: Record<string, number> = {};
      const tokensByModel: Record<string, number> = {};
      let totalCost = 0;

      for (const row of (result.rows || []) as Record<string, unknown>[]) {
        const model = String(row.model);
        const cost = Number(row.cost) || 0;
        const tokens = Number(row.tokens) || 0;
        costByModel[model] = cost;
        tokensByModel[model] = tokens;
        totalCost += cost;
      }

      return {
        totalCost,
        costByModel,
        costByTier: {},
        tokensByModel,
        savingsFromArbitrage: 0,
        period,
      };
    } catch (error) {
      logger.error('Failed to get metrics', { tenantId, error });
      throw error;
    }
  }

  async getBudgetStatus(tenantId: string): Promise<{ limit: number; used: number; remaining: number; percentUsed: number; resetsAt: string }> {
    const config = await this.getConfig(tenantId);
    const remaining = config.budgetLimit - config.budgetUsed;
    const percentUsed = (config.budgetUsed / config.budgetLimit) * 100;

    return {
      limit: config.budgetLimit,
      used: config.budgetUsed,
      remaining,
      percentUsed,
      resetsAt: config.budgetResetAt,
    };
  }

  // --------------------------------------------------------------------------
  // Parse Helpers
  // --------------------------------------------------------------------------

  private parseConfig(row: Record<string, unknown>): GovernorConfig {
    return {
      tenantId: String(row.tenant_id || ''),
      enabled: Boolean(row.enabled),
      mode: String(row.mode || 'balanced') as GovernorMode,
      budgetLimit: Number(row.budget_limit) || 100,
      budgetUsed: Number(row.budget_used) || 0,
      budgetResetAt: String(row.budget_reset_at || ''),
      costAlertThreshold: Number(row.cost_alert_threshold) || 80,
      preferSelfHosted: Boolean(row.prefer_self_hosted),
      qualityFloor: Number(row.quality_floor) || 0.7,
      latencyTarget: Number(row.latency_target) || 2000,
      modelTiers: this.parseJson(row.model_tiers) || this.DEFAULT_TIERS,
      arbitrageRules: this.parseJson(row.arbitrage_rules) || [],
      fallbackStrategy: String(row.fallback_strategy || 'cascade') as FallbackStrategy,
    };
  }

  private parseJson<T>(value: unknown): T | null {
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return null; }
    }
    return value as T;
  }
}

export const economicGovernorService = new EconomicGovernorService();
