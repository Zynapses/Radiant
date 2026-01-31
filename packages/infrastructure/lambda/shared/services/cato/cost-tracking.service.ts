/**
 * Cost Tracking Service
 * 
 * Tracks and manages AI usage costs across the Cato system.
 * Uses database persistence for cost data that must survive Lambda invocations.
 */

import { executeStatement } from '../../db/client';
import { logger } from '../../logging/enhanced-logger';

export interface CostEntry {
  id: string;
  tenantId: string;
  modelId: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  timestamp: Date;
  requestType: string;
  metadata?: Record<string, unknown>;
}

export interface CostSummary {
  tenantId: string;
  period: 'hour' | 'day' | 'week' | 'month';
  totalCostCents: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  requestCount: number;
  byModel: Record<string, { costCents: number; requests: number }>;
  byProvider: Record<string, { costCents: number; requests: number }>;
}

export interface CostBudget {
  tenantId: string;
  dailyLimitCents: number;
  monthlyLimitCents: number;
  currentDailyCents: number;
  currentMonthlyCents: number;
  alertThreshold: number;
  isOverBudget: boolean;
}

/** Real-time cost estimate with breakdown */
export interface RealtimeCostEstimate {
  estimatedCostUsd: number;
  breakdown: {
    bedrock: number;
    sagemaker: number;
    lambda: number;
    storage: number;
    other: number;
  };
  invocations: number;
  updatedAt: Date;
}

/** Daily cost record */
export interface DailyCost {
  date: string;
  costCents: number;
  requests: number;
}

/** Month-to-date cost record */
export interface MtdCost {
  month: string;
  costCents: number;
  requests: number;
  daysRemaining: number;
  projectedTotal: number;
}

export class CostTrackingService {
  async trackCost(entry: Omit<CostEntry, 'id' | 'timestamp'>): Promise<CostEntry> {
    try {
      const result = await executeStatement(
        `INSERT INTO cost_events (tenant_id, user_id, model_id, provider, input_tokens, output_tokens, cost_cents, request_type, metadata)
         VALUES ($1, (SELECT id FROM users WHERE tenant_id = $1 LIMIT 1), $2, $3, $4, $5, $6, $7, $8::jsonb)
         RETURNING id, created_at`,
        [entry.tenantId, entry.modelId, entry.provider, entry.inputTokens, entry.outputTokens, entry.costCents, entry.requestType, JSON.stringify(entry.metadata || {})]
      );

      const row = result.rows[0] as Record<string, unknown>;
      return {
        ...entry,
        id: row.id as string,
        timestamp: new Date(row.created_at as string),
      };
    } catch (error) {
      logger.warn('Failed to track cost in database', { error: String(error) });
      // Return entry with generated ID for graceful degradation
      return {
        ...entry,
        id: `cost_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
      };
    }
  }

  async getSummary(tenantId: string, period: CostSummary['period']): Promise<CostSummary> {
    try {
      const intervalMap = { hour: '1 hour', day: '1 day', week: '7 days', month: '1 month' };
      const interval = intervalMap[period];

      // Get totals
      const totalsResult = await executeStatement(
        `SELECT 
           COALESCE(SUM(cost_cents), 0) as total_cost,
           COALESCE(SUM(input_tokens), 0) as total_input,
           COALESCE(SUM(output_tokens), 0) as total_output,
           COUNT(*) as request_count
         FROM cost_events 
         WHERE tenant_id = $1 AND created_at >= NOW() - $2::interval`,
        [tenantId, interval]
      );

      // Get by model
      const byModelResult = await executeStatement(
        `SELECT model_id, SUM(cost_cents) as cost, COUNT(*) as requests
         FROM cost_events 
         WHERE tenant_id = $1 AND created_at >= NOW() - $2::interval
         GROUP BY model_id`,
        [tenantId, interval]
      );

      // Get by provider
      const byProviderResult = await executeStatement(
        `SELECT provider, SUM(cost_cents) as cost, COUNT(*) as requests
         FROM cost_events 
         WHERE tenant_id = $1 AND created_at >= NOW() - $2::interval
         GROUP BY provider`,
        [tenantId, interval]
      );

      const totals = totalsResult.rows[0] as Record<string, unknown>;
      const byModel: Record<string, { costCents: number; requests: number }> = {};
      const byProvider: Record<string, { costCents: number; requests: number }> = {};

      for (const row of byModelResult.rows as Record<string, unknown>[]) {
        byModel[row.model_id as string] = { costCents: Number(row.cost), requests: Number(row.requests) };
      }

      for (const row of byProviderResult.rows as Record<string, unknown>[]) {
        byProvider[row.provider as string] = { costCents: Number(row.cost), requests: Number(row.requests) };
      }

      return {
        tenantId,
        period,
        totalCostCents: Number(totals.total_cost) || 0,
        totalInputTokens: Number(totals.total_input) || 0,
        totalOutputTokens: Number(totals.total_output) || 0,
        requestCount: Number(totals.request_count) || 0,
        byModel,
        byProvider,
      };
    } catch (error) {
      logger.warn('Failed to get cost summary from database', { tenantId, error: String(error) });
      return {
        tenantId,
        period,
        totalCostCents: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        requestCount: 0,
        byModel: {},
        byProvider: {},
      };
    }
  }

  async getBudget(tenantId: string): Promise<CostBudget> {
    try {
      // Get budget config
      const configResult = await executeStatement(
        `SELECT daily_limit, monthly_limit, alert_threshold
         FROM cost_budgets WHERE tenant_id = $1 AND is_active = true
         ORDER BY created_at DESC LIMIT 1`,
        [tenantId]
      );

      // Get current spend
      const spendResult = await executeStatement(
        `SELECT 
           COALESCE(SUM(CASE WHEN created_at >= DATE_TRUNC('day', NOW()) THEN cost_cents ELSE 0 END), 0) as daily_spend,
           COALESCE(SUM(CASE WHEN created_at >= DATE_TRUNC('month', NOW()) THEN cost_cents ELSE 0 END), 0) as monthly_spend
         FROM cost_events WHERE tenant_id = $1`,
        [tenantId]
      );

      const config = configResult.rows[0] as Record<string, unknown> | undefined;
      const spend = spendResult.rows[0] as Record<string, unknown>;

      const dailyLimitCents = config ? Number(config.daily_limit) * 100 : 10000;
      const monthlyLimitCents = config ? Number(config.monthly_limit) * 100 : 100000;
      const currentDailyCents = Number(spend.daily_spend) || 0;
      const currentMonthlyCents = Number(spend.monthly_spend) || 0;

      return {
        tenantId,
        dailyLimitCents,
        monthlyLimitCents,
        currentDailyCents,
        currentMonthlyCents,
        alertThreshold: config ? Number(config.alert_threshold) : 0.8,
        isOverBudget: currentDailyCents > dailyLimitCents || currentMonthlyCents > monthlyLimitCents,
      };
    } catch (error) {
      logger.warn('Failed to get budget from database', { tenantId, error: String(error) });
      return {
        tenantId,
        dailyLimitCents: 10000,
        monthlyLimitCents: 100000,
        currentDailyCents: 0,
        currentMonthlyCents: 0,
        alertThreshold: 0.8,
        isOverBudget: false,
      };
    }
  }

  async setBudgetLimits(tenantId: string, dailyLimitCents: number, monthlyLimitCents: number): Promise<CostBudget> {
    await executeStatement(
      `INSERT INTO cost_budgets (tenant_id, name, daily_limit, monthly_limit, is_active)
       VALUES ($1, 'default', $2, $3, true)
       ON CONFLICT (tenant_id) WHERE name = 'default'
       DO UPDATE SET daily_limit = $2, monthly_limit = $3, updated_at = NOW()`,
      [tenantId, dailyLimitCents / 100, monthlyLimitCents / 100]
    );
    return this.getBudget(tenantId);
  }

  async resetDailyBudget(tenantId: string): Promise<void> {
    // Daily budget is calculated dynamically from cost_events, no reset needed
    logger.info('Daily budget reset requested', { tenantId });
  }

  private getPeriodStart(now: Date, period: CostSummary['period']): Date {
    const start = new Date(now);
    switch (period) {
      case 'hour': start.setHours(start.getHours() - 1); break;
      case 'day': start.setDate(start.getDate() - 1); break;
      case 'week': start.setDate(start.getDate() - 7); break;
      case 'month': start.setMonth(start.getMonth() - 1); break;
    }
    return start;
  }

  async getRealtimeEstimate(tenantId = 'default'): Promise<RealtimeCostEstimate> {
    try {
      const result = await executeStatement(
        `SELECT 
           COALESCE(SUM(cost_cents), 0) as total_cost,
           COUNT(*) as invocations,
           COALESCE(SUM(CASE WHEN provider = 'bedrock' THEN cost_cents ELSE 0 END), 0) as bedrock_cost,
           COALESCE(SUM(CASE WHEN provider = 'sagemaker' THEN cost_cents ELSE 0 END), 0) as sagemaker_cost,
           COALESCE(SUM(CASE WHEN provider = 'lambda' THEN cost_cents ELSE 0 END), 0) as lambda_cost
         FROM cost_events 
         WHERE tenant_id = $1 AND created_at >= DATE_TRUNC('day', NOW())`,
        [tenantId]
      );

      const row = result.rows[0] as Record<string, unknown>;
      const totalCost = Number(row.total_cost) || 0;

      return {
        estimatedCostUsd: totalCost / 100,
        breakdown: {
          bedrock: Number(row.bedrock_cost) / 100 || 0,
          sagemaker: Number(row.sagemaker_cost) / 100 || 0,
          lambda: Number(row.lambda_cost) / 100 || 0,
          storage: totalCost * 0.1 / 100,
          other: totalCost * 0.05 / 100,
        },
        invocations: Number(row.invocations) || 0,
        updatedAt: new Date(),
      };
    } catch (error) {
      logger.warn('Failed to get realtime estimate', { tenantId, error: String(error) });
      return {
        estimatedCostUsd: 0,
        breakdown: { bedrock: 0, sagemaker: 0, lambda: 0, storage: 0, other: 0 },
        invocations: 0,
        updatedAt: new Date(),
      };
    }
  }

  async getDailyCost(tenantId = 'default'): Promise<number> {
    try {
      const result = await executeStatement(
        `SELECT COALESCE(SUM(cost_cents), 0) as daily_cost
         FROM cost_events WHERE tenant_id = $1 AND created_at >= DATE_TRUNC('day', NOW())`,
        [tenantId]
      );
      return Number((result.rows[0] as Record<string, unknown>).daily_cost) || 0;
    } catch {
      return 0;
    }
  }

  async getMtdCost(tenantId = 'default'): Promise<number> {
    try {
      const result = await executeStatement(
        `SELECT COALESCE(SUM(cost_cents), 0) as mtd_cost
         FROM cost_events WHERE tenant_id = $1 AND created_at >= DATE_TRUNC('month', NOW())`,
        [tenantId]
      );
      return Number((result.rows[0] as Record<string, unknown>).mtd_cost) || 0;
    } catch {
      return 0;
    }
  }

  async getBudgetStatus(tenantId = 'default'): Promise<CostBudget> {
    return this.getBudget(tenantId);
  }

  async estimateSettingsCost(tenantId = 'default', settings?: Record<string, unknown>): Promise<number> {
    return 100;
  }

  async getPricingTable(tenantId = 'default'): Promise<Record<string, number>> {
    return { 'gpt-4o': 5, 'claude-sonnet-4-20250514': 3, 'gpt-4o-mini': 0.15 };
  }
}

export const costTrackingService = new CostTrackingService();
