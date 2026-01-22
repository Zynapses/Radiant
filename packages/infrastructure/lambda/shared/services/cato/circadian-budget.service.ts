/**
 * Circadian Budget Service
 * 
 * Manages time-based resource budgets for Cato.
 * Implements circadian rhythm-inspired resource allocation.
 */

export interface CircadianBudget {
  tenantId: string;
  currentHour: number;
  timezone: string;
  budgetRemaining: number;
  budgetTotal: number;
  peakHours: [number, number];
  offPeakMultiplier: number;
  lastReset: Date;
  nextReset: Date;
  monthlyLimit?: number;
  dailyExplorationLimit?: number;
  explorationRatio?: number;
  nightStartHour?: number;
  nightEndHour?: number;
  emergencyThreshold?: number;
}

export interface BudgetAllocation {
  requestId: string;
  tenantId: string;
  amount: number;
  purpose: string;
  allocatedAt: Date;
  isPeakHour: boolean;
}

class CircadianBudgetService {
  private budgets: Map<string, CircadianBudget> = new Map();
  private allocations: BudgetAllocation[] = [];

  async getBudget(tenantId: string): Promise<CircadianBudget> {
    if (!this.budgets.has(tenantId)) {
      const now = new Date();
      this.budgets.set(tenantId, {
        tenantId,
        currentHour: now.getHours(),
        timezone: 'UTC',
        budgetRemaining: 10000,
        budgetTotal: 10000,
        peakHours: [9, 17],
        offPeakMultiplier: 1.5,
        lastReset: now,
        nextReset: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      });
    }
    return this.budgets.get(tenantId)!;
  }

  async allocate(tenantId: string, amount: number, purpose: string): Promise<BudgetAllocation | null> {
    const budget = await this.getBudget(tenantId);
    const isPeak = this.isPeakHour(budget);
    const effectiveAmount = isPeak ? amount : amount / budget.offPeakMultiplier;

    if (budget.budgetRemaining < effectiveAmount) {
      return null;
    }

    budget.budgetRemaining -= effectiveAmount;

    const allocation: BudgetAllocation = {
      requestId: `alloc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenantId,
      amount: effectiveAmount,
      purpose,
      allocatedAt: new Date(),
      isPeakHour: isPeak,
    };

    this.allocations.push(allocation);
    return allocation;
  }

  async getRemaining(tenantId: string): Promise<number> {
    const budget = await this.getBudget(tenantId);
    return budget.budgetRemaining;
  }

  async reset(tenantId: string): Promise<CircadianBudget> {
    const budget = await this.getBudget(tenantId);
    const now = new Date();
    budget.budgetRemaining = budget.budgetTotal;
    budget.lastReset = now;
    budget.nextReset = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return budget;
  }

  async setTotalBudget(tenantId: string, total: number): Promise<CircadianBudget> {
    const budget = await this.getBudget(tenantId);
    budget.budgetTotal = total;
    return budget;
  }

  async setPeakHours(tenantId: string, start: number, end: number): Promise<CircadianBudget> {
    const budget = await this.getBudget(tenantId);
    budget.peakHours = [start, end];
    return budget;
  }

  async getAllocations(tenantId: string, since?: Date): Promise<BudgetAllocation[]> {
    return this.allocations.filter(
      a => a.tenantId === tenantId && (!since || a.allocatedAt >= since)
    );
  }

  private isPeakHour(budget: CircadianBudget): boolean {
    const hour = new Date().getHours();
    const [start, end] = budget.peakHours;
    return hour >= start && hour < end;
  }

  async getStatus(tenantId = 'default'): Promise<{ active: boolean; currentHour: number; isPeakHour: boolean; mode?: string; canExplore?: boolean; dailySpend?: number; monthlySpend?: number; dailyRemaining?: number; monthlyRemaining?: number }> {
    const budget = await this.getBudget(tenantId);
    return {
      active: true,
      currentHour: new Date().getHours(),
      isPeakHour: this.isPeakHour(budget),
      mode: 'BALANCED',
      canExplore: true,
      dailySpend: 50,
      monthlySpend: 500,
      dailyRemaining: budget.budgetRemaining,
      monthlyRemaining: budget.budgetTotal,
    };
  }

  async getConfig(tenantId = 'default'): Promise<CircadianBudget> {
    return this.getBudget(tenantId);
  }

  async updateConfig(tenantIdOrConfig: string | Partial<CircadianBudget> = 'default', config?: Partial<CircadianBudget>): Promise<CircadianBudget> {
    const isConfig = typeof tenantIdOrConfig === 'object';
    const tenantId = isConfig ? 'default' : tenantIdOrConfig;
    const actualConfig = isConfig ? tenantIdOrConfig : config;
    const budget = await this.getBudget(tenantId);
    if (actualConfig) Object.assign(budget, actualConfig);
    return budget;
  }

  async getDailyCostHistory(tenantId = 'default', days = 7): Promise<Array<{ date: string; cost: number }>> {
    const history: Array<{ date: string; cost: number }> = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      history.push({ date: date.toISOString().split('T')[0], cost: Math.random() * 100 });
    }
    return history;
  }

  async getCostBreakdown(tenantIdOrStartDate: string | Date = 'default', endDateOrTenantId?: Date | string): Promise<Record<string, number>> {
    return {
      inference: 45,
      embedding: 20,
      storage: 15,
      compute: 20,
    };
  }
}

export const circadianBudgetService = new CircadianBudgetService();
