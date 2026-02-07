// RADIANT Autonomous Organism - Enhanced Economic Cortex
// Autonomous budget management and cost optimization
// Version: 1.0.0

import { randomUUID } from 'crypto';
import { executeStatement, stringParam, longParam, doubleParam, boolParam } from '../../db/client';
import { createRegisteredLogger } from '../logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'organism/economic-cortex',
  category: 'infrastructure',
  sourceType: 'application',
});

// ============================================================================
// Types
// ============================================================================

type BudgetScope = 'tenant' | 'user' | 'session' | 'task';
type BudgetAlertLevel = 'info' | 'warning' | 'critical' | 'exceeded';
type NegotiationStrategy = 'aggressive' | 'balanced' | 'conservative';
type BudgetPeriod = 'daily' | 'weekly' | 'monthly' | 'session' | 'task';

interface Budget {
  budgetId: string;
  scope: BudgetScope;
  scopeId: string;
  totalBudget: number;
  usedBudget: number;
  reservedBudget: number;
  periodType: BudgetPeriod;
  periodStart: Date;
  periodEnd: Date;
  hardLimit: boolean;
  autoRenew: boolean;
  avgDailySpend: number;
  projectedEndOfPeriod: number;
}

interface BudgetAlert {
  alertId: string;
  budgetId: string;
  thresholdPercent: number;
  level: BudgetAlertLevel;
  notifyAdmin: boolean;
  notifyUser: boolean;
  pauseExecution: boolean;
  switchToLowerTier: boolean;
  triggered: boolean;
  triggeredAt?: Date;
}

interface CostAlternative {
  alternativeId: string;
  description: string;
  estimatedCost: number;
  costSavingsPercent: number;
  qualityImpact: number;
  latencyImpact: number;
  capabilityLoss?: string[];
  recommendationScore: number;
}

interface CostNegotiation {
  negotiationId: string;
  tenantId: string;
  requestedAction: string;
  estimatedCost: number;
  availableBudget: number;
  strategy: NegotiationStrategy;
  alternatives: CostAlternative[];
  selectedAlternative?: CostAlternative;
  approved: boolean;
  finalCost: number;
  savingsAchieved: number;
  negotiatedAt: Date;
  executedAt?: Date;
}

interface EconomicCortexConfig {
  tenantId: string;
  budgets: Budget[];
  alertThresholds: BudgetAlert[];
  preferSelfHosted: boolean;
  qualityFloor: number;
  latencyTarget: number;
  autonomousBudgetNegotiation: boolean;
  negotiationStrategy: NegotiationStrategy;
  autoScaleOnDemand: boolean;
  cryptoWalletEnabled: boolean;
  cryptoWalletAddress?: string;
  micropaymentThreshold?: number;
}

interface ModelTier {
  name: string;
  models: string[];
  costPerToken: number;
  qualityScore: number;
  avgLatencyMs: number;
  priority: number;
}

interface SpendingAnalytics {
  totalSpend: number;
  spendByModel: Record<string, number>;
  spendByTier: Record<string, number>;
  spendByDay: Array<{ date: string; amount: number }>;
  projectedMonthlySpend: number;
  savingsFromOptimization: number;
  budgetUtilization: number;
}

// ============================================================================
// Enhanced Economic Cortex Service
// ============================================================================

class EconomicCortexService {
  private configs: Map<string, EconomicCortexConfig> = new Map();
  private budgets: Map<string, Budget> = new Map();
  private alerts: Map<string, BudgetAlert[]> = new Map();
  private negotiations: Map<string, CostNegotiation[]> = new Map();
  private spendingHistory: Map<string, Array<{ timestamp: Date; amount: number; model: string }>> = new Map();

  private readonly MODEL_TIERS: ModelTier[] = [
    { name: 'economy', models: ['gpt-3.5-turbo', 'claude-instant'], costPerToken: 0.0001, qualityScore: 0.7, avgLatencyMs: 500, priority: 1 },
    { name: 'selfhosted', models: ['llama-3-70b', 'mixtral-8x7b'], costPerToken: 0.00005, qualityScore: 0.75, avgLatencyMs: 800, priority: 2 },
    { name: 'standard', models: ['gpt-4o-mini', 'claude-3-haiku'], costPerToken: 0.0005, qualityScore: 0.85, avgLatencyMs: 1000, priority: 3 },
    { name: 'premium', models: ['gpt-4o', 'claude-3-sonnet'], costPerToken: 0.002, qualityScore: 0.92, avgLatencyMs: 1500, priority: 4 },
    { name: 'flagship', models: ['gpt-4-turbo', 'claude-3-opus', 'claude-sonnet-4'], costPerToken: 0.006, qualityScore: 0.98, avgLatencyMs: 2000, priority: 5 },
  ];

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================

  async initializeTenant(tenantId: string, config?: Partial<EconomicCortexConfig>): Promise<EconomicCortexConfig> {
    const defaultBudget = this.createDefaultBudget(tenantId, 'tenant');
    
    const fullConfig: EconomicCortexConfig = {
      tenantId,
      budgets: [defaultBudget],
      alertThresholds: this.createDefaultAlerts(defaultBudget.budgetId),
      preferSelfHosted: true,
      qualityFloor: 0.7,
      latencyTarget: 2000,
      autonomousBudgetNegotiation: true,
      negotiationStrategy: 'balanced',
      autoScaleOnDemand: false,
      cryptoWalletEnabled: false,
      ...config,
    };

    this.configs.set(tenantId, fullConfig);
    this.budgets.set(defaultBudget.budgetId, defaultBudget);
    this.alerts.set(tenantId, fullConfig.alertThresholds);

    await this.saveConfigToDatabase(fullConfig);

    logger.info(`Economic Cortex initialized for tenant: ${tenantId}`);
    return fullConfig;
  }

  private createDefaultBudget(scopeId: string, scope: BudgetScope): Budget {
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    return {
      budgetId: randomUUID(),
      scope,
      scopeId,
      totalBudget: 1000, // $1000 default monthly budget
      usedBudget: 0,
      reservedBudget: 0,
      periodType: 'monthly',
      periodStart: new Date(now.getFullYear(), now.getMonth(), 1),
      periodEnd: endOfMonth,
      hardLimit: false,
      autoRenew: true,
      avgDailySpend: 0,
      projectedEndOfPeriod: 0,
    };
  }

  private createDefaultAlerts(budgetId: string): BudgetAlert[] {
    return [
      {
        alertId: randomUUID(),
        budgetId,
        thresholdPercent: 50,
        level: 'info',
        notifyAdmin: false,
        notifyUser: true,
        pauseExecution: false,
        switchToLowerTier: false,
        triggered: false,
      },
      {
        alertId: randomUUID(),
        budgetId,
        thresholdPercent: 75,
        level: 'warning',
        notifyAdmin: true,
        notifyUser: true,
        pauseExecution: false,
        switchToLowerTier: true,
        triggered: false,
      },
      {
        alertId: randomUUID(),
        budgetId,
        thresholdPercent: 90,
        level: 'critical',
        notifyAdmin: true,
        notifyUser: true,
        pauseExecution: false,
        switchToLowerTier: true,
        triggered: false,
      },
      {
        alertId: randomUUID(),
        budgetId,
        thresholdPercent: 100,
        level: 'exceeded',
        notifyAdmin: true,
        notifyUser: true,
        pauseExecution: true,
        switchToLowerTier: true,
        triggered: false,
      },
    ];
  }

  // ==========================================================================
  // BUDGET MANAGEMENT
  // ==========================================================================

  async getBudget(budgetId: string): Promise<Budget | undefined> {
    return this.budgets.get(budgetId);
  }

  async getTenantBudgets(tenantId: string): Promise<Budget[]> {
    const config = this.configs.get(tenantId);
    if (!config) return [];
    
    return config.budgets.map(b => this.budgets.get(b.budgetId)).filter((b): b is Budget => b !== undefined);
  }

  async reserveBudget(budgetId: string, amount: number): Promise<boolean> {
    const budget = this.budgets.get(budgetId);
    if (!budget) return false;

    const available = budget.totalBudget - budget.usedBudget - budget.reservedBudget;
    if (amount > available && budget.hardLimit) {
      return false;
    }

    budget.reservedBudget += amount;
    this.budgets.set(budgetId, budget);
    
    return true;
  }

  async commitBudget(budgetId: string, reservedAmount: number, actualAmount: number): Promise<void> {
    const budget = this.budgets.get(budgetId);
    if (!budget) return;

    budget.reservedBudget = Math.max(0, budget.reservedBudget - reservedAmount);
    budget.usedBudget += actualAmount;
    
    // Update projections
    this.updateBudgetProjections(budget);
    
    // Check alerts
    await this.checkBudgetAlerts(budget);

    this.budgets.set(budgetId, budget);
  }

  async releaseBudget(budgetId: string, amount: number): Promise<void> {
    const budget = this.budgets.get(budgetId);
    if (!budget) return;

    budget.reservedBudget = Math.max(0, budget.reservedBudget - amount);
    this.budgets.set(budgetId, budget);
  }

  private updateBudgetProjections(budget: Budget): void {
    const now = new Date();
    const daysElapsed = Math.max(1, (now.getTime() - budget.periodStart.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(1, (budget.periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    budget.avgDailySpend = budget.usedBudget / daysElapsed;
    budget.projectedEndOfPeriod = budget.usedBudget + (budget.avgDailySpend * daysRemaining);
  }

  private async checkBudgetAlerts(budget: Budget): Promise<void> {
    const tenantAlerts = this.alerts.get(budget.scopeId) || [];
    const utilization = (budget.usedBudget / budget.totalBudget) * 100;

    for (const alert of tenantAlerts) {
      if (alert.budgetId !== budget.budgetId) continue;
      
      if (utilization >= alert.thresholdPercent && !alert.triggered) {
        alert.triggered = true;
        alert.triggeredAt = new Date();

        logger.warn(`Budget alert triggered: ${alert.level}`, {
          budgetId: budget.budgetId,
          utilization: `${utilization.toFixed(1)}%`,
          threshold: `${alert.thresholdPercent}%`,
        });

        // Execute alert actions
        if (alert.notifyAdmin) {
          await this.notifyAdmin(budget, alert);
        }
        if (alert.notifyUser) {
          await this.notifyUser(budget, alert);
        }
      }
    }

    this.alerts.set(budget.scopeId, tenantAlerts);
  }

  private async notifyAdmin(budget: Budget, alert: BudgetAlert): Promise<void> {
    // Placeholder for admin notification
    logger.info(`Admin notification: Budget ${budget.budgetId} reached ${alert.thresholdPercent}%`);
  }

  private async notifyUser(budget: Budget, alert: BudgetAlert): Promise<void> {
    // Placeholder for user notification
    logger.info(`User notification: Budget ${budget.budgetId} reached ${alert.thresholdPercent}%`);
  }

  // ==========================================================================
  // COST NEGOTIATION
  // ==========================================================================

  async negotiateCost(
    tenantId: string,
    requestedAction: string,
    estimatedCost: number,
    options: {
      requiredQuality?: number;
      maxLatencyMs?: number;
      allowDowngrade?: boolean;
    } = {}
  ): Promise<CostNegotiation> {
    const config = this.configs.get(tenantId);
    if (!config) {
      throw new Error(`Tenant ${tenantId} not initialized`);
    }

    const tenantBudgets = await this.getTenantBudgets(tenantId);
    const primaryBudget = tenantBudgets[0];
    const availableBudget = primaryBudget 
      ? primaryBudget.totalBudget - primaryBudget.usedBudget - primaryBudget.reservedBudget
      : 0;

    const negotiationId = randomUUID();
    
    // Generate alternatives
    const alternatives = this.generateCostAlternatives(
      estimatedCost,
      options.requiredQuality || config.qualityFloor,
      options.maxLatencyMs || config.latencyTarget,
      config.preferSelfHosted
    );

    // Select best alternative based on strategy
    const selectedAlternative = this.selectAlternative(
      alternatives,
      config.negotiationStrategy,
      availableBudget,
      options.allowDowngrade ?? true
    );

    const negotiation: CostNegotiation = {
      negotiationId,
      tenantId,
      requestedAction,
      estimatedCost,
      availableBudget,
      strategy: config.negotiationStrategy,
      alternatives,
      selectedAlternative,
      approved: selectedAlternative !== undefined,
      finalCost: selectedAlternative?.estimatedCost || estimatedCost,
      savingsAchieved: selectedAlternative 
        ? estimatedCost - selectedAlternative.estimatedCost 
        : 0,
      negotiatedAt: new Date(),
    };

    // Store negotiation
    if (!this.negotiations.has(tenantId)) {
      this.negotiations.set(tenantId, []);
    }
    this.negotiations.get(tenantId)!.push(negotiation);

    // Keep only last 100 negotiations per tenant
    const tenantNegotiations = this.negotiations.get(tenantId)!;
    if (tenantNegotiations.length > 100) {
      tenantNegotiations.shift();
    }

    logger.info(`Cost negotiation completed: ${negotiationId}`, {
      tenantId,
      estimatedCost,
      finalCost: negotiation.finalCost,
      savingsPercent: ((negotiation.savingsAchieved / estimatedCost) * 100).toFixed(1),
    });

    return negotiation;
  }

  private generateCostAlternatives(
    estimatedCost: number,
    requiredQuality: number,
    maxLatencyMs: number,
    preferSelfHosted: boolean
  ): CostAlternative[] {
    const alternatives: CostAlternative[] = [];

    // Sort tiers by cost (ascending)
    const sortedTiers = [...this.MODEL_TIERS].sort((a, b) => a.costPerToken - b.costPerToken);

    for (const tier of sortedTiers) {
      // Skip if quality is below floor
      if (tier.qualityScore < requiredQuality) continue;
      
      // Skip if latency exceeds target
      if (tier.avgLatencyMs > maxLatencyMs) continue;

      // Calculate estimated cost for this tier
      const tierCost = estimatedCost * (tier.costPerToken / this.MODEL_TIERS[2].costPerToken); // Relative to standard tier

      // Calculate recommendation score
      let score = 0;
      score += (1 - tierCost / estimatedCost) * 0.4; // Cost savings weight
      score += tier.qualityScore * 0.3; // Quality weight
      score += (1 - tier.avgLatencyMs / maxLatencyMs) * 0.2; // Latency weight
      
      // Bonus for self-hosted if preferred
      if (preferSelfHosted && tier.name === 'selfhosted') {
        score += 0.1;
      }

      alternatives.push({
        alternativeId: randomUUID(),
        description: `Use ${tier.name} tier (${tier.models.join(', ')})`,
        estimatedCost: tierCost,
        costSavingsPercent: ((estimatedCost - tierCost) / estimatedCost) * 100,
        qualityImpact: tier.qualityScore - 0.85, // Relative to standard
        latencyImpact: tier.avgLatencyMs / 1000, // Multiplier
        capabilityLoss: tier.priority < 3 ? ['Advanced reasoning', 'Complex analysis'] : undefined,
        recommendationScore: score,
      });
    }

    // Sort by recommendation score
    return alternatives.sort((a, b) => b.recommendationScore - a.recommendationScore);
  }

  private selectAlternative(
    alternatives: CostAlternative[],
    strategy: NegotiationStrategy,
    availableBudget: number,
    allowDowngrade: boolean
  ): CostAlternative | undefined {
    if (alternatives.length === 0) return undefined;

    // Filter by budget
    const affordableAlternatives = alternatives.filter(a => a.estimatedCost <= availableBudget);
    if (affordableAlternatives.length === 0) {
      if (!allowDowngrade) return undefined;
      // Return cheapest option even if over budget
      return alternatives[alternatives.length - 1];
    }

    switch (strategy) {
      case 'aggressive':
        // Pick the cheapest option
        return affordableAlternatives.reduce((cheapest, current) => 
          current.estimatedCost < cheapest.estimatedCost ? current : cheapest
        );
      
      case 'conservative':
        // Pick the highest quality option within budget
        return affordableAlternatives.reduce((best, current) => 
          current.qualityImpact > best.qualityImpact ? current : best
        );
      
      case 'balanced':
      default:
        // Pick highest recommendation score within budget
        return affordableAlternatives[0]; // Already sorted by score
    }
  }

  // ==========================================================================
  // MODEL RECOMMENDATION
  // ==========================================================================

  async recommendModel(
    tenantId: string,
    taskType: string,
    options: {
      requiredQuality?: number;
      maxLatencyMs?: number;
      maxCostPerRequest?: number;
    } = {}
  ): Promise<{
    model: string;
    tier: string;
    estimatedCost: number;
    estimatedLatency: number;
    qualityScore: number;
    reason: string;
  }> {
    const config = this.configs.get(tenantId);
    const qualityFloor = options.requiredQuality || config?.qualityFloor || 0.7;
    const latencyTarget = options.maxLatencyMs || config?.latencyTarget || 2000;
    const maxCost = options.maxCostPerRequest || 0.1;

    // Find eligible tiers
    const eligibleTiers = this.MODEL_TIERS.filter(tier => 
      tier.qualityScore >= qualityFloor &&
      tier.avgLatencyMs <= latencyTarget &&
      tier.costPerToken * 1000 <= maxCost // Assuming ~1000 tokens
    );

    if (eligibleTiers.length === 0) {
      // Fallback to economy tier
      const economyTier = this.MODEL_TIERS[0];
      return {
        model: economyTier.models[0],
        tier: economyTier.name,
        estimatedCost: economyTier.costPerToken * 1000,
        estimatedLatency: economyTier.avgLatencyMs,
        qualityScore: economyTier.qualityScore,
        reason: 'No tier meets all constraints, using economy tier',
      };
    }

    // Prefer self-hosted if configured
    if (config?.preferSelfHosted) {
      const selfHostedTier = eligibleTiers.find(t => t.name === 'selfhosted');
      if (selfHostedTier) {
        return {
          model: selfHostedTier.models[0],
          tier: selfHostedTier.name,
          estimatedCost: selfHostedTier.costPerToken * 1000,
          estimatedLatency: selfHostedTier.avgLatencyMs,
          qualityScore: selfHostedTier.qualityScore,
          reason: 'Self-hosted tier preferred and eligible',
        };
      }
    }

    // Select best value tier (quality per cost)
    const bestValue = eligibleTiers.reduce((best, current) => {
      const currentValue = current.qualityScore / (current.costPerToken * 1000);
      const bestValueScore = best.qualityScore / (best.costPerToken * 1000);
      return currentValue > bestValueScore ? current : best;
    });

    return {
      model: bestValue.models[0],
      tier: bestValue.name,
      estimatedCost: bestValue.costPerToken * 1000,
      estimatedLatency: bestValue.avgLatencyMs,
      qualityScore: bestValue.qualityScore,
      reason: `Best value tier for task: ${taskType}`,
    };
  }

  // ==========================================================================
  // SPENDING TRACKING
  // ==========================================================================

  async recordSpending(
    tenantId: string,
    amount: number,
    model: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    // Record in history
    if (!this.spendingHistory.has(tenantId)) {
      this.spendingHistory.set(tenantId, []);
    }
    
    this.spendingHistory.get(tenantId)!.push({
      timestamp: new Date(),
      amount,
      model,
    });

    // Keep only last 1000 records per tenant
    const history = this.spendingHistory.get(tenantId)!;
    if (history.length > 1000) {
      history.shift();
    }

    // Update budget
    const budgets = await this.getTenantBudgets(tenantId);
    if (budgets.length > 0) {
      const primaryBudget = budgets[0];
      await this.commitBudget(primaryBudget.budgetId, 0, amount);
    }

    // Persist to database
    await this.saveSpendingToDatabase(tenantId, amount, model, metadata);
  }

  async getSpendingAnalytics(tenantId: string): Promise<SpendingAnalytics> {
    const history = this.spendingHistory.get(tenantId) || [];
    const budgets = await this.getTenantBudgets(tenantId);
    const primaryBudget = budgets[0];

    // Calculate totals
    let totalSpend = 0;
    const spendByModel: Record<string, number> = {};
    const spendByTier: Record<string, number> = {};
    const spendByDay: Record<string, number> = {};

    for (const record of history) {
      totalSpend += record.amount;
      
      // By model
      spendByModel[record.model] = (spendByModel[record.model] || 0) + record.amount;
      
      // By tier
      const tier = this.MODEL_TIERS.find(t => t.models.includes(record.model));
      if (tier) {
        spendByTier[tier.name] = (spendByTier[tier.name] || 0) + record.amount;
      }
      
      // By day
      const day = record.timestamp.toISOString().split('T')[0];
      spendByDay[day] = (spendByDay[day] || 0) + record.amount;
    }

    // Calculate projections
    const daysWithData = Object.keys(spendByDay).length;
    const avgDailySpend = daysWithData > 0 ? totalSpend / daysWithData : 0;
    const projectedMonthlySpend = avgDailySpend * 30;

    // Calculate savings
    const negotiations = this.negotiations.get(tenantId) || [];
    const savingsFromOptimization = negotiations.reduce((sum, n) => sum + n.savingsAchieved, 0);

    // Budget utilization
    const budgetUtilization = primaryBudget 
      ? (primaryBudget.usedBudget / primaryBudget.totalBudget) * 100 
      : 0;

    return {
      totalSpend,
      spendByModel,
      spendByTier,
      spendByDay: Object.entries(spendByDay).map(([date, amount]) => ({ date, amount })),
      projectedMonthlySpend,
      savingsFromOptimization,
      budgetUtilization,
    };
  }

  // ==========================================================================
  // DATABASE OPERATIONS
  // ==========================================================================

  private async saveConfigToDatabase(config: EconomicCortexConfig): Promise<void> {
    await executeStatement({
      sql: `
        INSERT INTO economic_cortex_configs (
          tenant_id, budgets, alert_thresholds, prefer_self_hosted,
          quality_floor, latency_target, autonomous_budget_negotiation,
          negotiation_strategy, auto_scale_on_demand,
          crypto_wallet_enabled, crypto_wallet_address, micropayment_threshold,
          created_at, updated_at
        ) VALUES (
          :tenantId, :budgets, :alertThresholds, :preferSelfHosted,
          :qualityFloor, :latencyTarget, :autonomousBudgetNegotiation,
          :negotiationStrategy, :autoScaleOnDemand,
          :cryptoWalletEnabled, :cryptoWalletAddress, :micropaymentThreshold,
          NOW(), NOW()
        )
        ON CONFLICT (tenant_id) DO UPDATE SET
          budgets = EXCLUDED.budgets,
          alert_thresholds = EXCLUDED.alert_thresholds,
          prefer_self_hosted = EXCLUDED.prefer_self_hosted,
          quality_floor = EXCLUDED.quality_floor,
          latency_target = EXCLUDED.latency_target,
          autonomous_budget_negotiation = EXCLUDED.autonomous_budget_negotiation,
          negotiation_strategy = EXCLUDED.negotiation_strategy,
          auto_scale_on_demand = EXCLUDED.auto_scale_on_demand,
          updated_at = NOW()
      `,
      parameters: [
        stringParam('tenantId', config.tenantId),
        stringParam('budgets', JSON.stringify(config.budgets)),
        stringParam('alertThresholds', JSON.stringify(config.alertThresholds)),
        boolParam('preferSelfHosted', config.preferSelfHosted),
        doubleParam('qualityFloor', config.qualityFloor),
        longParam('latencyTarget', config.latencyTarget),
        boolParam('autonomousBudgetNegotiation', config.autonomousBudgetNegotiation),
        stringParam('negotiationStrategy', config.negotiationStrategy),
        boolParam('autoScaleOnDemand', config.autoScaleOnDemand),
        boolParam('cryptoWalletEnabled', config.cryptoWalletEnabled),
        stringParam('cryptoWalletAddress', config.cryptoWalletAddress || ''),
        doubleParam('micropaymentThreshold', config.micropaymentThreshold || 0),
      ],
    });
  }

  private async saveSpendingToDatabase(
    tenantId: string,
    amount: number,
    model: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await executeStatement({
      sql: `
        INSERT INTO economic_cortex_spending (
          spending_id, tenant_id, amount, model, metadata, created_at
        ) VALUES (
          :spendingId, :tenantId, :amount, :model, :metadata, NOW()
        )
      `,
      parameters: [
        stringParam('spendingId', randomUUID()),
        stringParam('tenantId', tenantId),
        doubleParam('amount', amount),
        stringParam('model', model),
        stringParam('metadata', JSON.stringify(metadata || {})),
      ],
    });
  }

  // ==========================================================================
  // GETTERS
  // ==========================================================================

  getConfig(tenantId: string): EconomicCortexConfig | undefined {
    return this.configs.get(tenantId);
  }

  getNegotiationHistory(tenantId: string): CostNegotiation[] {
    return this.negotiations.get(tenantId) || [];
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const economicCortex = new EconomicCortexService();
export { EconomicCortexService };
