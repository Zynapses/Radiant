/**
 * Consciousness Billing Integration Service
 * 
 * Integrates consciousness engine costs with the main RADIANT billing system.
 * - Tracks usage per tenant
 * - Deducts from credit balances
 * - Records in billing ledger
 * - Enforces spending limits
 */

import { executeStatement } from '../db/client';
import { logger } from '../logger';

export interface ConsciousnessUsageRecord {
  tenantId: string;
  userId?: string;
  usageType: 'model_invocation' | 'web_search' | 'deep_research' | 'thinking_session' | 'workflow_execution';
  quantity: number;
  unitCost: number;
  totalCost: number;
  metadata?: Record<string, unknown>;
}

export interface BillingResult {
  success: boolean;
  remainingCredits?: number;
  usageRecordId?: string;
  error?: string;
}

class ConsciousnessBillingService {
  /**
   * Record consciousness usage and deduct from tenant credits.
   */
  async recordUsage(usage: ConsciousnessUsageRecord): Promise<BillingResult> {
    try {
      // Check if tenant has sufficient credits
      const creditCheck = await this.checkCredits(usage.tenantId, usage.totalCost);
      if (!creditCheck.sufficient) {
        return {
          success: false,
          error: `Insufficient credits. Required: $${usage.totalCost.toFixed(4)}, Available: $${creditCheck.available.toFixed(4)}`,
          remainingCredits: creditCheck.available,
        };
      }

      // Begin transaction
      // 1. Deduct from credit balance
      await this.deductCredits(usage.tenantId, usage.totalCost);

      // 2. Record in consciousness usage log
      const usageRecordId = await this.logUsage(usage);

      // 3. Record in main billing ledger
      await this.recordInBillingLedger(usage, usageRecordId);

      // 4. Update aggregates
      await this.updateAggregates(usage);

      // Get new balance
      const newBalance = await this.getBalance(usage.tenantId);

      logger.info('Consciousness usage recorded', {
        tenantId: usage.tenantId,
        usageType: usage.usageType,
        totalCost: usage.totalCost,
        remainingCredits: newBalance,
      });

      return {
        success: true,
        usageRecordId,
        remainingCredits: newBalance,
      };
    } catch (error) {
      logger.error(`Failed to record consciousness usage: ${String(error)}`);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Check if tenant has sufficient credits.
   */
  async checkCredits(tenantId: string, requiredAmount: number): Promise<{
    sufficient: boolean;
    available: number;
  }> {
    const result = await executeStatement(
      `SELECT COALESCE(credit_balance, 0) as balance 
       FROM tenant_billing 
       WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const balance = Number((result.rows?.[0] as Record<string, unknown>)?.balance) || 0;

    return {
      sufficient: balance >= requiredAmount,
      available: balance,
    };
  }

  /**
   * Deduct credits from tenant balance.
   */
  private async deductCredits(tenantId: string, amount: number): Promise<void> {
    await executeStatement(
      `UPDATE tenant_billing 
       SET credit_balance = credit_balance - $2,
           consciousness_spend_total = COALESCE(consciousness_spend_total, 0) + $2,
           updated_at = NOW()
       WHERE tenant_id = $1`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'amount', value: { doubleValue: amount } },
      ]
    );
  }

  /**
   * Log usage to consciousness-specific table.
   */
  private async logUsage(usage: ConsciousnessUsageRecord): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO consciousness_usage_log 
       (tenant_id, user_id, usage_type, quantity, unit_cost, total_cost, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
       RETURNING id`,
      [
        { name: 'tenantId', value: { stringValue: usage.tenantId } },
        { name: 'userId', value: usage.userId ? { stringValue: usage.userId } : { isNull: true } },
        { name: 'usageType', value: { stringValue: usage.usageType } },
        { name: 'quantity', value: { doubleValue: usage.quantity } },
        { name: 'unitCost', value: { doubleValue: usage.unitCost } },
        { name: 'totalCost', value: { doubleValue: usage.totalCost } },
        { name: 'metadata', value: { stringValue: JSON.stringify(usage.metadata || {}) } },
      ]
    );

    return String((result.rows?.[0] as Record<string, unknown>)?.id);
  }

  /**
   * Record in main billing ledger for unified billing view.
   */
  private async recordInBillingLedger(usage: ConsciousnessUsageRecord, usageRecordId: string): Promise<void> {
    await executeStatement(
      `INSERT INTO billing_ledger 
       (tenant_id, entry_type, category, description, amount, reference_type, reference_id, created_at)
       VALUES ($1, 'debit', 'consciousness', $2, $3, 'consciousness_usage', $4, NOW())`,
      [
        { name: 'tenantId', value: { stringValue: usage.tenantId } },
        { name: 'description', value: { stringValue: `Consciousness ${usage.usageType}: ${usage.quantity} units` } },
        { name: 'amount', value: { doubleValue: usage.totalCost } },
        { name: 'referenceId', value: { stringValue: usageRecordId } },
      ]
    );
  }

  /**
   * Update daily/monthly aggregates.
   */
  private async updateAggregates(usage: ConsciousnessUsageRecord): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    await executeStatement(
      `INSERT INTO consciousness_cost_aggregates 
       (tenant_id, date, total_tokens, total_cost_usd, invocation_count, search_count, workflow_count)
       VALUES ($1, $2, 0, $3, 
         CASE WHEN $4 = 'model_invocation' THEN 1 ELSE 0 END,
         CASE WHEN $4 IN ('web_search', 'deep_research') THEN 1 ELSE 0 END,
         CASE WHEN $4 = 'workflow_execution' THEN 1 ELSE 0 END)
       ON CONFLICT (tenant_id, date) 
       DO UPDATE SET 
         total_cost_usd = consciousness_cost_aggregates.total_cost_usd + $3,
         invocation_count = consciousness_cost_aggregates.invocation_count + 
           CASE WHEN $4 = 'model_invocation' THEN 1 ELSE 0 END,
         search_count = consciousness_cost_aggregates.search_count + 
           CASE WHEN $4 IN ('web_search', 'deep_research') THEN 1 ELSE 0 END,
         workflow_count = consciousness_cost_aggregates.workflow_count + 
           CASE WHEN $4 = 'workflow_execution' THEN 1 ELSE 0 END,
         updated_at = NOW()`,
      [
        { name: 'tenantId', value: { stringValue: usage.tenantId } },
        { name: 'date', value: { stringValue: today } },
        { name: 'cost', value: { doubleValue: usage.totalCost } },
        { name: 'usageType', value: { stringValue: usage.usageType } },
      ]
    );
  }

  /**
   * Get current credit balance.
   */
  async getBalance(tenantId: string): Promise<number> {
    const result = await executeStatement(
      `SELECT COALESCE(credit_balance, 0) as balance 
       FROM tenant_billing 
       WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return Number((result.rows?.[0] as Record<string, unknown>)?.balance) || 0;
  }

  /**
   * Get consciousness usage summary for a tenant.
   */
  async getUsageSummary(tenantId: string, period: 'day' | 'week' | 'month'): Promise<{
    totalCost: number;
    byType: Record<string, { count: number; cost: number }>;
    trend: Array<{ date: string; cost: number }>;
  }> {
    const intervalMap = {
      day: '1 day',
      week: '7 days',
      month: '30 days',
    };
    const interval = intervalMap[period];

    // Total and by type
    const summaryResult = await executeStatement(
      `SELECT 
        usage_type,
        COUNT(*) as count,
        SUM(total_cost) as total_cost
       FROM consciousness_usage_log
       WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '${interval}'
       GROUP BY usage_type`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const byType: Record<string, { count: number; cost: number }> = {};
    let totalCost = 0;

    for (const row of summaryResult.rows || []) {
      const r = row as Record<string, unknown>;
      const usageType = String(r.usage_type);
      const count = Number(r.count) || 0;
      const cost = Number(r.total_cost) || 0;
      byType[usageType] = { count, cost };
      totalCost += cost;
    }

    // Daily trend
    const trendResult = await executeStatement(
      `SELECT 
        DATE(created_at) as date,
        SUM(total_cost) as cost
       FROM consciousness_usage_log
       WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '${interval}'
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const trend = (trendResult.rows || []).map((row: Record<string, unknown>) => ({
      date: String(row.date),
      cost: Number(row.cost) || 0,
    }));

    return { totalCost, byType, trend };
  }

  /**
   * Get pricing for consciousness features.
   */
  getPricing(): Record<string, { unit: string; pricePerUnit: number }> {
    return {
      model_invocation: { unit: '1K tokens', pricePerUnit: 0.01 },
      web_search: { unit: 'search', pricePerUnit: 0.001 },
      deep_research: { unit: 'job', pricePerUnit: 0.05 },
      thinking_session: { unit: 'session', pricePerUnit: 0.10 },
      workflow_execution: { unit: 'execution', pricePerUnit: 0.02 },
    };
  }

  /**
   * Estimate cost for an operation before executing.
   */
  estimateCost(usageType: string, quantity: number): number {
    const pricing = this.getPricing();
    const typePrice = pricing[usageType];
    if (!typePrice) return 0;
    return quantity * typePrice.pricePerUnit;
  }
}

export const consciousnessBillingService = new ConsciousnessBillingService();
