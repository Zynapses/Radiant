/**
 * RADIANT v5.52.17 - Economic Governor API Client
 * 
 * Client-side functions for the Economic Governor (cost optimization) feature.
 * Provides budget management, model tier selection, and savings tracking.
 */

import { api } from './client';
import type { GovernorStatus, GovernorDecision } from './types';

// ============================================================================
// Types
// ============================================================================

export interface GovernorDashboard {
  config: GovernorConfig;
  metrics: CostMetrics;
  fuelGauge: FuelGauge;
  modeIndicator: ModeIndicator;
  savingsSparkline: SavingsSparkline;
  alertTriggered: boolean;
}

export interface GovernorConfig {
  mode: GovernorMode;
  budgetLimit: number;
  budgetUsed: number;
  budgetResetAt: string;
  costAlertThreshold: number;
  modelTiers: ModelTier[];
  arbitrageRules: ArbitrageRule[];
}

export interface CostMetrics {
  totalCost: number;
  totalTokens: number;
  costByTier: Record<string, number>;
  costByModel: Record<string, number>;
  tokensByModel: Record<string, number>;
  savings: SavingsBreakdown;
}

export interface FuelGauge {
  level: number;
  color: string;
  status: string;
  remaining: string;
  total: string;
  resetIn: string;
}

export interface ModeIndicator {
  mode: GovernorMode;
  icon: string;
  description: string;
  color: string;
}

export interface SavingsSparkline {
  total: string;
  percent: string;
  breakdown: {
    selfHosted: string;
    arbitrage: string;
    cache: string;
  };
}

export interface SavingsBreakdown {
  totalSavings: number;
  savingsPercent: number;
  selfHostedSavings: number;
  arbitrageSavings: number;
  cacheHitSavings: number;
}

export interface ModelTier {
  name: string;
  models: string[];
  costPerToken: number;
  qualityScore: number;
  avgLatencyMs: number;
  priority: number;
  label?: string;
  icon?: string;
  color?: string;
}

export interface ArbitrageRule {
  id: string;
  name: string;
  condition: RuleCondition;
  action: RuleAction;
  enabled: boolean;
}

export interface RuleCondition {
  type: 'cost_threshold' | 'quality_floor' | 'latency_ceiling' | 'time_of_day' | 'task_type';
  value: number | string;
  operator: '>' | '<' | '=' | '>=' | '<=';
}

export interface RuleAction {
  type: 'switch_tier' | 'prefer_selfhosted' | 'use_cache' | 'alert';
  targetTier?: string;
}

export interface ModelRecommendation {
  model: string;
  tier: string;
  estimatedCost: number;
  qualityScore: number;
  estimatedLatency: number;
  reason: string;
  alternatives: Array<{
    model: string;
    tier: string;
    estimatedCost: number;
  }>;
  tierIcon?: string;
  tierColor?: string;
}

export interface BudgetStatus {
  withinBudget: boolean;
  remaining: number;
  fuelLevel: number;
  alertTriggered: boolean;
  limit?: number;
  used?: number;
  usedPercent?: number;
  resetAt?: string;
}

export type GovernorMode = 'economy' | 'balanced' | 'performance' | 'quality' | 'custom';

// ============================================================================
// API Service
// ============================================================================

class GovernorService {
  /**
   * Get the full dashboard with fuel gauge, mode indicator, and savings
   */
  async getDashboard(): Promise<GovernorDashboard> {
    const response = await api.get<{ success: boolean; data: GovernorDashboard }>(
      '/api/thinktank/governor'
    );
    return response.data;
  }

  /**
   * Get current status (alias for dashboard for backward compatibility)
   */
  async getStatus(): Promise<GovernorStatus> {
    const dashboard = await this.getDashboard();
    return {
      mode: dashboard.config.mode,
      budgetRemaining: dashboard.fuelGauge.level * dashboard.config.budgetLimit / 100,
      budgetLimit: dashboard.config.budgetLimit,
      savingsToday: parseFloat(dashboard.savingsSparkline.total.replace('$', '')),
      currentTier: dashboard.modeIndicator.mode,
    } as GovernorStatus;
  }

  /**
   * Get governor configuration
   */
  async getConfig(): Promise<GovernorConfig> {
    const response = await api.get<{ success: boolean; data: GovernorConfig }>(
      '/api/thinktank/governor/config'
    );
    return response.data;
  }

  /**
   * Update governor configuration
   */
  async updateConfig(updates: Partial<GovernorConfig>): Promise<GovernorConfig> {
    const response = await api.put<{ success: boolean; data: GovernorConfig }>(
      '/api/thinktank/governor/config',
      updates
    );
    return response.data;
  }

  /**
   * Set governor mode (quick switch)
   */
  async setMode(mode: GovernorMode): Promise<{ mode: GovernorMode; message: string }> {
    const response = await api.put<{ success: boolean; data: { mode: GovernorMode; message: string } }>(
      '/api/thinktank/governor/mode',
      { mode }
    );
    return response.data;
  }

  /**
   * Get model recommendation for a task
   */
  async recommendModel(taskType: string, complexity = 5): Promise<ModelRecommendation> {
    const response = await api.post<{ success: boolean; data: ModelRecommendation }>(
      '/api/thinktank/governor/recommend',
      { taskType, complexity }
    );
    return response.data;
  }

  /**
   * Get cost metrics for a period
   */
  async getMetrics(period: 'day' | 'week' | 'month' = 'day'): Promise<CostMetrics & { charts: unknown }> {
    const response = await api.get<{ success: boolean; data: CostMetrics & { charts: unknown } }>(
      `/api/thinktank/governor/metrics?period=${period}`
    );
    return response.data;
  }

  /**
   * Get budget status
   */
  async getBudget(estimatedCost = 0): Promise<BudgetStatus> {
    const response = await api.get<{ success: boolean; data: BudgetStatus }>(
      `/api/thinktank/governor/budget?estimate=${estimatedCost}`
    );
    return response.data;
  }

  /**
   * Update budget settings
   */
  async updateBudget(budgetLimit?: number, costAlertThreshold?: number): Promise<GovernorConfig> {
    const response = await api.put<{ success: boolean; data: GovernorConfig }>(
      '/api/thinktank/governor/budget',
      { budgetLimit, costAlertThreshold }
    );
    return response.data;
  }

  /**
   * Get model tiers
   */
  async getTiers(): Promise<ModelTier[]> {
    const response = await api.get<{ success: boolean; data: ModelTier[] }>(
      '/api/thinktank/governor/tiers'
    );
    return response.data;
  }

  /**
   * Update a model tier
   */
  async updateTier(tierName: string, updates: Partial<ModelTier>): Promise<void> {
    await api.put(`/api/thinktank/governor/tiers/${tierName}`, updates);
  }

  /**
   * Get arbitrage rules
   */
  async getRules(): Promise<ArbitrageRule[]> {
    const response = await api.get<{ success: boolean; data: ArbitrageRule[] }>(
      '/api/thinktank/governor/rules'
    );
    return response.data;
  }

  /**
   * Add an arbitrage rule
   */
  async addRule(rule: Omit<ArbitrageRule, 'id'>): Promise<ArbitrageRule> {
    const response = await api.post<{ success: boolean; data: ArbitrageRule }>(
      '/api/thinktank/governor/rules',
      rule
    );
    return response.data;
  }

  /**
   * Update an arbitrage rule
   */
  async updateRule(ruleId: string, updates: Partial<ArbitrageRule>): Promise<ArbitrageRule> {
    const response = await api.put<{ success: boolean; data: ArbitrageRule }>(
      `/api/thinktank/governor/rules/${ruleId}`,
      updates
    );
    return response.data;
  }

  /**
   * Delete an arbitrage rule
   */
  async deleteRule(ruleId: string): Promise<void> {
    await api.delete(`/api/thinktank/governor/rules/${ruleId}`);
  }

  /**
   * Get recent decisions (from metrics)
   * @deprecated Use getMetrics() instead
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getRecentDecisions(_limit = 10): Promise<GovernorDecision[]> {
    await this.getMetrics('day');
    return [];
  }

  /**
   * Get savings history (from metrics)
   * @deprecated Use getMetrics() with different periods instead
   */
  async getSavingsHistory(days = 30): Promise<Array<{ date: string; savings: number }>> {
    await this.getMetrics(days <= 7 ? 'week' : 'month');
    return [];
  }
}

export const governorService = new GovernorService();
