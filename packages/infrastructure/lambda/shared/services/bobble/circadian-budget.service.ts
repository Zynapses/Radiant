/**
 * Bobble Circadian Budget Manager
 * 
 * Manages Bobble's operational budget with day/night modes.
 * Default: $500/month, $15/day exploration cap (admin-configurable)
 * 
 * @see /docs/bobble/adr/005-circadian-budget.md
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../../logger';

export enum OperatingMode {
  DAY = 'day',          // 6 AM - 2 AM: Queue curiosity, serve users
  NIGHT = 'night',      // 2 AM - 6 AM: Batch process exploration
  EMERGENCY = 'emergency' // Over budget: minimal operations
}

export interface BudgetConfig {
  monthlyLimit: number;        // Default: $500
  dailyExplorationLimit: number; // Default: $15
  explorationRatio: number;    // Default: 0.20
  nightStartHour: number;      // Default: 2 (2 AM UTC)
  nightEndHour: number;        // Default: 6 (6 AM UTC)
  emergencyThreshold: number;  // Default: 0.90
}

export interface BudgetStatus {
  mode: OperatingMode;
  dailySpend: number;
  monthlySpend: number;
  dailyRemaining: number;
  monthlyRemaining: number;
  canExplore: boolean;
  nextModeChange: Date;
  config: BudgetConfig;
}

export interface CostRecord {
  timestamp: Date;
  amount: number;
  category: 'inference' | 'curiosity' | 'grounding' | 'consolidation';
  model: string;
  tokensInput: number;
  tokensOutput: number;
}

const DEFAULT_CONFIG: BudgetConfig = {
  monthlyLimit: 500,
  dailyExplorationLimit: 15,
  explorationRatio: 0.20,
  nightStartHour: 2,
  nightEndHour: 6,
  emergencyThreshold: 0.90
};

/**
 * Circadian Budget Manager for Bobble.
 * 
 * Implements day/night operational modes with hard budget caps to prevent
 * runaway costs from autonomous curiosity.
 */
export class CircadianBudgetService {
  private readonly docClient: DynamoDBDocumentClient;
  private readonly configTable: string;
  private readonly costsTable: string;
  private config: BudgetConfig | null = null;
  private lastConfigRefresh: Date | null = null;
  private dailySpend = 0;
  private monthlySpend = 0;
  private lastSpendRefresh: Date | null = null;

  constructor(
    configTable: string = process.env.BOBBLE_CONFIG_TABLE || 'bobble-config',
    costsTable: string = process.env.BOBBLE_COSTS_TABLE || 'bobble-costs',
    region: string = process.env.AWS_REGION || 'us-east-1'
  ) {
    const client = new DynamoDBClient({ region });
    this.docClient = DynamoDBDocumentClient.from(client);
    this.configTable = configTable;
    this.costsTable = costsTable;
  }

  /**
   * Get current budget configuration, refreshing from DynamoDB if stale.
   */
  async getConfig(): Promise<BudgetConfig> {
    const now = new Date();

    // Refresh config every 5 minutes
    if (
      this.config === null ||
      this.lastConfigRefresh === null ||
      now.getTime() - this.lastConfigRefresh.getTime() > 300000
    ) {
      try {
        const response = await this.docClient.send(new GetCommand({
          TableName: this.configTable,
          Key: { pk: 'CONFIG', sk: 'BUDGET' }
        }));

        if (response.Item) {
          this.config = {
            monthlyLimit: response.Item.monthlyLimit ?? DEFAULT_CONFIG.monthlyLimit,
            dailyExplorationLimit: response.Item.dailyExplorationLimit ?? DEFAULT_CONFIG.dailyExplorationLimit,
            explorationRatio: response.Item.explorationRatio ?? DEFAULT_CONFIG.explorationRatio,
            nightStartHour: response.Item.nightStartHour ?? DEFAULT_CONFIG.nightStartHour,
            nightEndHour: response.Item.nightEndHour ?? DEFAULT_CONFIG.nightEndHour,
            emergencyThreshold: response.Item.emergencyThreshold ?? DEFAULT_CONFIG.emergencyThreshold
          };
        } else {
          this.config = { ...DEFAULT_CONFIG };
        }

        this.lastConfigRefresh = now;

        // Refresh spend counters
        await this.refreshSpendCounters();

      } catch (error) {
        logger.error(`Failed to get budget config: ${String(error)}`);
        this.config = { ...DEFAULT_CONFIG };
      }
    }

    return this.config;
  }

  /**
   * Update budget configuration.
   */
  async updateConfig(updates: Partial<BudgetConfig>): Promise<void> {
    const current = await this.getConfig();
    const newConfig = { ...current, ...updates };

    await this.docClient.send(new PutCommand({
      TableName: this.configTable,
      Item: {
        pk: 'CONFIG',
        sk: 'BUDGET',
        ...newConfig,
        updatedAt: new Date().toISOString()
      }
    }));

    this.config = newConfig;
    this.lastConfigRefresh = new Date();

    logger.info('Budget config updated', { updates });
  }

  /**
   * Determine current operating mode based on time and budget.
   */
  async getMode(): Promise<OperatingMode> {
    const config = await this.getConfig();
    const now = new Date();
    const hour = now.getUTCHours();

    // Check emergency (budget exhausted)
    if (this.monthlySpend >= config.monthlyLimit * config.emergencyThreshold) {
      return OperatingMode.EMERGENCY;
    }

    // Check daily exploration limit exceeded
    if (this.dailySpend >= config.dailyExplorationLimit) {
      return OperatingMode.DAY; // No exploration but still serving users
    }

    // Check time of day
    if (hour >= config.nightStartHour && hour < config.nightEndHour) {
      return OperatingMode.NIGHT;
    }

    return OperatingMode.DAY;
  }

  /**
   * Check if exploration is currently allowed.
   */
  async canExplore(): Promise<boolean> {
    const mode = await this.getMode();
    if (mode === OperatingMode.EMERGENCY) {
      return false;
    }

    const config = await this.getConfig();
    return this.dailySpend < config.dailyExplorationLimit;
  }

  /**
   * Check if it's night mode (batch processing allowed).
   */
  async isNightMode(): Promise<boolean> {
    const mode = await this.getMode();
    return mode === OperatingMode.NIGHT;
  }

  /**
   * Record a cost incurrence.
   */
  async recordCost(
    amount: number,
    category: 'inference' | 'curiosity' | 'grounding' | 'consolidation',
    model: string,
    tokensInput: number = 0,
    tokensOutput: number = 0
  ): Promise<void> {
    const now = new Date();
    const month = now.toISOString().slice(0, 7); // YYYY-MM
    const day = now.toISOString().slice(0, 10);  // YYYY-MM-DD

    try {
      await this.docClient.send(new PutCommand({
        TableName: this.costsTable,
        Item: {
          pk: `COST#${month}`,
          sk: now.toISOString(),
          amount,
          category,
          model,
          day,
          tokensInput,
          tokensOutput
        }
      }));

      // Update local counters
      this.dailySpend += amount;
      this.monthlySpend += amount;

      logger.debug('Cost recorded', { amount, category, model });

    } catch (error) {
      logger.error(`Failed to record cost: ${String(error)}`);
    }
  }

  /**
   * Get current budget status for display.
   */
  async getStatus(): Promise<BudgetStatus> {
    const config = await this.getConfig();
    const mode = await this.getMode();
    const canExplore = await this.canExplore();

    // Calculate next mode change
    const now = new Date();
    const hour = now.getUTCHours();
    let nextModeChange: Date;

    if (hour < config.nightStartHour) {
      nextModeChange = new Date(now);
      nextModeChange.setUTCHours(config.nightStartHour, 0, 0, 0);
    } else if (hour < config.nightEndHour) {
      nextModeChange = new Date(now);
      nextModeChange.setUTCHours(config.nightEndHour, 0, 0, 0);
    } else {
      nextModeChange = new Date(now);
      nextModeChange.setUTCDate(nextModeChange.getUTCDate() + 1);
      nextModeChange.setUTCHours(config.nightStartHour, 0, 0, 0);
    }

    return {
      mode,
      dailySpend: this.dailySpend,
      monthlySpend: this.monthlySpend,
      dailyRemaining: Math.max(0, config.dailyExplorationLimit - this.dailySpend),
      monthlyRemaining: Math.max(0, config.monthlyLimit - this.monthlySpend),
      canExplore,
      nextModeChange,
      config
    };
  }

  /**
   * Get cost breakdown by category for a time period.
   */
  async getCostBreakdown(
    startDate: Date,
    endDate: Date
  ): Promise<Record<string, number>> {
    const month = startDate.toISOString().slice(0, 7);

    try {
      const response = await this.docClient.send(new QueryCommand({
        TableName: this.costsTable,
        KeyConditionExpression: 'pk = :pk AND sk BETWEEN :start AND :end',
        ExpressionAttributeValues: {
          ':pk': `COST#${month}`,
          ':start': startDate.toISOString(),
          ':end': endDate.toISOString()
        }
      }));

      const breakdown: Record<string, number> = {
        inference: 0,
        curiosity: 0,
        grounding: 0,
        consolidation: 0,
        total: 0
      };

      for (const item of response.Items || []) {
        const category = item.category as string;
        const amount = item.amount as number;
        breakdown[category] = (breakdown[category] || 0) + amount;
        breakdown.total += amount;
      }

      return breakdown;

    } catch (error) {
      logger.error(`Failed to get cost breakdown: ${String(error)}`);
      return { inference: 0, curiosity: 0, grounding: 0, consolidation: 0, total: 0 };
    }
  }

  /**
   * Get daily cost history for the current month.
   */
  async getDailyCostHistory(): Promise<Array<{ date: string; amount: number }>> {
    const now = new Date();
    const month = now.toISOString().slice(0, 7);

    try {
      const response = await this.docClient.send(new QueryCommand({
        TableName: this.costsTable,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: {
          ':pk': `COST#${month}`
        }
      }));

      // Aggregate by day
      const dailyTotals: Record<string, number> = {};

      for (const item of response.Items || []) {
        const day = item.day as string;
        const amount = item.amount as number;
        dailyTotals[day] = (dailyTotals[day] || 0) + amount;
      }

      return Object.entries(dailyTotals)
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => a.date.localeCompare(b.date));

    } catch (error) {
      logger.error(`Failed to get daily cost history: ${String(error)}`);
      return [];
    }
  }

  /**
   * Refresh spend counters from DynamoDB.
   */
  private async refreshSpendCounters(): Promise<void> {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const month = now.toISOString().slice(0, 7);

    // Skip if recently refreshed
    if (
      this.lastSpendRefresh &&
      now.getTime() - this.lastSpendRefresh.getTime() < 60000
    ) {
      return;
    }

    try {
      const response = await this.docClient.send(new QueryCommand({
        TableName: this.costsTable,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: {
          ':pk': `COST#${month}`
        }
      }));

      this.monthlySpend = 0;
      this.dailySpend = 0;

      for (const item of response.Items || []) {
        const amount = item.amount as number;
        this.monthlySpend += amount;

        if (item.day === today) {
          this.dailySpend += amount;
        }
      }

      this.lastSpendRefresh = now;

    } catch (error) {
      logger.error(`Failed to refresh spend counters: ${String(error)}`);
    }
  }

  /**
   * Reset daily spend counter (called at midnight UTC).
   */
  async resetDailySpend(): Promise<void> {
    this.dailySpend = 0;
    logger.info('Daily spend counter reset');
  }

  /**
   * Reset monthly spend counter (called on first of month).
   */
  async resetMonthlySpend(): Promise<void> {
    this.monthlySpend = 0;
    this.dailySpend = 0;
    logger.info('Monthly spend counter reset');
  }
}

// Export singleton instance
export const circadianBudgetService = new CircadianBudgetService();
