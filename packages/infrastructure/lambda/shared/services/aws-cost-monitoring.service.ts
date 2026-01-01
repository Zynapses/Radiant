// RADIANT v4.18.0 - AWS Cost Monitoring Service
// Note: @aws-sdk/client-cost-explorer added to package.json dependencies
import { CostExplorerClient, GetCostAndUsageCommand, Granularity, GroupDefinitionType, ResultByTime } from '@aws-sdk/client-cost-explorer';
import { executeStatement } from '../db/client';

export interface CostSummary {
  totalCost: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  forecastedMonthEnd: number;
  percentChange: number;
  error?: string; // Set when Cost Explorer unavailable
}

export interface ServiceCost {
  serviceName: string;
  cost: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
}

export interface DailyCost {
  date: string;
  cost: number;
  services: Record<string, number>;
}

export interface CostAlert {
  alertId: string;
  alertType: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  currentValue: number;
  createdAt: string;
}

export interface CostReport {
  summary: CostSummary;
  serviceBreakdown: ServiceCost[];
  dailyCosts: DailyCost[];
  alerts: CostAlert[];
  lastUpdated: string;
  hasErrors?: boolean; // True if any data fetch failed
}

export class AWSCostMonitoringService {
  private costExplorer: CostExplorerClient;
  private cache: Map<string, { data: unknown; expiry: number }> = new Map();

  constructor() {
    this.costExplorer = new CostExplorerClient({ region: process.env.AWS_REGION || 'us-east-1' });
  }

  async getCostReport(tenantId: string, days = 30): Promise<CostReport> {
    const [summary, serviceBreakdown, dailyCosts, alerts] = await Promise.all([
      this.getCostSummary(days),
      this.getServiceBreakdown(days),
      this.getDailyCosts(days),
      this.getCostAlerts(tenantId),
    ]);
    return { summary, serviceBreakdown, dailyCosts, alerts, lastUpdated: new Date().toISOString() };
  }

  async getCostSummary(days = 30): Promise<CostSummary> {
    const end = new Date(), start = new Date();
    start.setDate(start.getDate() - days);
    try {
      const cost = await this.fetchCost(start, end);
      const prevStart = new Date(start), prevEnd = new Date(start);
      prevStart.setDate(prevStart.getDate() - days);
      const prevCost = await this.fetchCost(prevStart, prevEnd);
      return {
        totalCost: cost, currency: 'USD',
        periodStart: start.toISOString().split('T')[0],
        periodEnd: end.toISOString().split('T')[0],
        forecastedMonthEnd: cost * 1.1,
        percentChange: prevCost > 0 ? ((cost - prevCost) / prevCost) * 100 : 0,
      };
    } catch (error) {
      return this.emptySummary(days, String(error));
    }
  }

  private async fetchCost(start: Date, end: Date): Promise<number> {
    const cmd = new GetCostAndUsageCommand({
      TimePeriod: { Start: start.toISOString().split('T')[0], End: end.toISOString().split('T')[0] },
      Granularity: Granularity.MONTHLY, Metrics: ['UnblendedCost'],
    });
    const res = await this.costExplorer.send(cmd);
    let total = 0;
    for (const result of res.ResultsByTime || []) {
      total += parseFloat(result.Total?.UnblendedCost?.Amount || '0');
    }
    return total;
  }

  async getServiceBreakdown(days = 30): Promise<ServiceCost[]> {
    const end = new Date(), start = new Date();
    start.setDate(start.getDate() - days);
    try {
      const cmd = new GetCostAndUsageCommand({
        TimePeriod: { Start: start.toISOString().split('T')[0], End: end.toISOString().split('T')[0] },
        Granularity: Granularity.MONTHLY, Metrics: ['UnblendedCost'],
        GroupBy: [{ Type: GroupDefinitionType.DIMENSION, Key: 'SERVICE' }],
      });
      const res = await this.costExplorer.send(cmd);
      const costs: Record<string, number> = {};
      for (const r of res.ResultsByTime || []) {
        for (const g of r.Groups || []) {
          const svc = g.Keys?.[0] || 'Unknown';
          costs[svc] = (costs[svc] || 0) + parseFloat(g.Metrics?.UnblendedCost?.Amount || '0');
        }
      }
      const total = Object.values(costs).reduce((a, b) => a + b, 0);
      return Object.entries(costs).map(([serviceName, cost]) => ({
        serviceName, cost: Math.round(cost * 100) / 100,
        percentage: total > 0 ? Math.round((cost / total) * 10000) / 100 : 0, trend: 'stable' as const,
      })).sort((a, b) => b.cost - a.cost);
    } catch {
      return []; // Return empty array on error
    }
  }

  async getDailyCosts(days = 30): Promise<DailyCost[]> {
    const end = new Date(), start = new Date();
    start.setDate(start.getDate() - days);
    try {
      const cmd = new GetCostAndUsageCommand({
        TimePeriod: { Start: start.toISOString().split('T')[0], End: end.toISOString().split('T')[0] },
        Granularity: Granularity.DAILY, Metrics: ['UnblendedCost'],
        GroupBy: [{ Type: GroupDefinitionType.DIMENSION, Key: 'SERVICE' }],
      });
      const res = await this.costExplorer.send(cmd);
      return (res.ResultsByTime || []).map(r => {
        const services: Record<string, number> = {};
        let cost = 0;
        for (const g of r.Groups || []) {
          const c = parseFloat(g.Metrics?.UnblendedCost?.Amount || '0');
          services[g.Keys?.[0] || 'Unknown'] = c; cost += c;
        }
        return { date: r.TimePeriod?.Start || '', cost: Math.round(cost * 100) / 100, services };
      });
    } catch {
      return []; // Return empty array on error
    }
  }

  async getCostAlerts(tenantId: string): Promise<CostAlert[]> {
    const res = await executeStatement(
      `SELECT * FROM cost_alerts WHERE tenant_id = $1 AND resolved = false ORDER BY created_at DESC LIMIT 10`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    ).catch(() => ({ rows: [] }));
    return res.rows.map((r: Record<string, unknown>) => ({
      alertId: String(r.alert_id), alertType: String(r.alert_type),
      severity: String(r.severity) as 'info' | 'warning' | 'critical',
      message: String(r.message), currentValue: Number(r.current_value), createdAt: String(r.created_at),
    }));
  }

  async saveCostSnapshot(tenantId: string, report: CostReport): Promise<void> {
    await executeStatement(
      `INSERT INTO cost_snapshots (tenant_id, total_cost, service_breakdown, daily_costs) VALUES ($1, $2, $3, $4)`,
      [
        { name: 't', value: { stringValue: tenantId } },
        { name: 'c', value: { doubleValue: report.summary.totalCost } },
        { name: 's', value: { stringValue: JSON.stringify(report.serviceBreakdown) } },
        { name: 'd', value: { stringValue: JSON.stringify(report.dailyCosts) } },
      ]
    );
  }

  private emptySummary(days: number, error: string): CostSummary {
    return {
      totalCost: 0,
      currency: 'USD',
      periodStart: new Date(Date.now() - days * 86400000).toISOString().split('T')[0],
      periodEnd: new Date().toISOString().split('T')[0],
      forecastedMonthEnd: 0,
      percentChange: 0,
      error: `Cost Explorer unavailable: ${error}`,
    };
  }
}

export const awsCostMonitoringService = new AWSCostMonitoringService();
