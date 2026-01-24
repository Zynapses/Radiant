/**
 * Cost Tracking Service
 * 
 * Tracks and manages AI usage costs across the Cato system.
 */

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
  private entries: CostEntry[] = [];
  private budgets: Map<string, CostBudget> = new Map();

  async trackCost(entry: Omit<CostEntry, 'id' | 'timestamp'>): Promise<CostEntry> {
    const fullEntry: CostEntry = {
      ...entry,
      id: `cost_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    this.entries.push(fullEntry);
    await this.updateBudget(entry.tenantId, entry.costCents);
    return fullEntry;
  }

  async getSummary(tenantId: string, period: CostSummary['period']): Promise<CostSummary> {
    const now = new Date();
    const periodStart = this.getPeriodStart(now, period);
    
    const periodEntries = this.entries.filter(
      e => e.tenantId === tenantId && e.timestamp >= periodStart
    );

    const byModel: Record<string, { costCents: number; requests: number }> = {};
    const byProvider: Record<string, { costCents: number; requests: number }> = {};

    let totalCostCents = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (const entry of periodEntries) {
      totalCostCents += entry.costCents;
      totalInputTokens += entry.inputTokens;
      totalOutputTokens += entry.outputTokens;

      if (!byModel[entry.modelId]) byModel[entry.modelId] = { costCents: 0, requests: 0 };
      byModel[entry.modelId].costCents += entry.costCents;
      byModel[entry.modelId].requests += 1;

      if (!byProvider[entry.provider]) byProvider[entry.provider] = { costCents: 0, requests: 0 };
      byProvider[entry.provider].costCents += entry.costCents;
      byProvider[entry.provider].requests += 1;
    }

    return {
      tenantId,
      period,
      totalCostCents,
      totalInputTokens,
      totalOutputTokens,
      requestCount: periodEntries.length,
      byModel,
      byProvider,
    };
  }

  async getBudget(tenantId: string): Promise<CostBudget> {
    if (!this.budgets.has(tenantId)) {
      this.budgets.set(tenantId, {
        tenantId,
        dailyLimitCents: 10000,
        monthlyLimitCents: 100000,
        currentDailyCents: 0,
        currentMonthlyCents: 0,
        alertThreshold: 0.8,
        isOverBudget: false,
      });
    }
    return this.budgets.get(tenantId)!;
  }

  async setBudgetLimits(tenantId: string, dailyLimitCents: number, monthlyLimitCents: number): Promise<CostBudget> {
    const budget = await this.getBudget(tenantId);
    budget.dailyLimitCents = dailyLimitCents;
    budget.monthlyLimitCents = monthlyLimitCents;
    budget.isOverBudget = budget.currentDailyCents > dailyLimitCents || budget.currentMonthlyCents > monthlyLimitCents;
    return budget;
  }

  async resetDailyBudget(tenantId: string): Promise<void> {
    const budget = await this.getBudget(tenantId);
    budget.currentDailyCents = 0;
    budget.isOverBudget = false;
  }

  private async updateBudget(tenantId: string, costCents: number): Promise<void> {
    const budget = await this.getBudget(tenantId);
    budget.currentDailyCents += costCents;
    budget.currentMonthlyCents += costCents;
    budget.isOverBudget = budget.currentDailyCents > budget.dailyLimitCents || 
                          budget.currentMonthlyCents > budget.monthlyLimitCents;
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
    const budget = await this.getBudget(tenantId);
    return {
      estimatedCostUsd: budget.currentDailyCents / 100,
      breakdown: {
        bedrock: budget.currentDailyCents * 0.4 / 100,
        sagemaker: budget.currentDailyCents * 0.3 / 100,
        lambda: budget.currentDailyCents * 0.15 / 100,
        storage: budget.currentDailyCents * 0.1 / 100,
        other: budget.currentDailyCents * 0.05 / 100,
      },
      invocations: this.entries.filter(e => e.tenantId === tenantId).length,
      updatedAt: new Date(),
    };
  }

  async getDailyCost(tenantId = 'default'): Promise<number> {
    const budget = await this.getBudget(tenantId);
    return budget.currentDailyCents;
  }

  async getMtdCost(tenantId = 'default'): Promise<number> {
    const budget = await this.getBudget(tenantId);
    return budget.currentMonthlyCents;
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
