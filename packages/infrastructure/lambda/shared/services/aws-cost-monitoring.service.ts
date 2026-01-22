// RADIANT v5.38.0 - AWS Cost Monitoring Service
// Note: @aws-sdk/client-cost-explorer added to package.json dependencies
import { CostExplorerClient, GetCostAndUsageCommand, Granularity, GroupDefinitionType, ResultByTime } from '@aws-sdk/client-cost-explorer';
import { executeStatement, stringParam, longParam } from '../db/client';

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

// Infrastructure Scaling Cost Line Items
export interface InfrastructureScalingCosts {
  groupName: 'Infrastructure Scaling';
  totalCost: number;
  estimatedMonthlyCost: number;
  tier: string;
  targetSessions: number;
  lineItems: InfrastructureLineItem[];
  costPerSession: number;
  lastUpdated: string;
}

export interface InfrastructureLineItem {
  component: string;
  description: string;
  baseCost: number;
  usageCost: number;
  totalCost: number;
  unit: string;
  quantity: number;
  pricePerUnit: number;
  percentage: number;
}

export interface CostReport {
  summary: CostSummary;
  serviceBreakdown: ServiceCost[];
  dailyCosts: DailyCost[];
  alerts: CostAlert[];
  infrastructureScaling?: InfrastructureScalingCosts;
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
    const [summary, serviceBreakdown, dailyCosts, alerts, infrastructureScaling] = await Promise.all([
      this.getCostSummary(days),
      this.getServiceBreakdown(days),
      this.getDailyCosts(days),
      this.getCostAlerts(tenantId),
      this.getInfrastructureScalingCosts(tenantId),
    ]);
    return { summary, serviceBreakdown, dailyCosts, alerts, infrastructureScaling, lastUpdated: new Date().toISOString() };
  }

  async getInfrastructureScalingCosts(tenantId: string): Promise<InfrastructureScalingCosts | undefined> {
    try {
      // Get active scaling profile
      const profileResult = await executeStatement(
        `SELECT * FROM sovereign_mesh_scaling_profiles 
         WHERE tenant_id = :tenantId AND is_active = true
         LIMIT 1`,
        [stringParam('tenantId', tenantId)]
      );

      if (!profileResult.rows?.[0]) {
        return undefined;
      }

      const profile = profileResult.rows[0];
      const tier = String(profile.tier);
      const targetSessions = parseInt(String(profile.target_sessions), 10);
      const estimatedMonthlyCost = parseFloat(String(profile.estimated_monthly_cost)) || 0;

      // Calculate component costs
      const lineItems: InfrastructureLineItem[] = [];

      // Lambda costs
      const lambdaProvisioned = parseInt(String(profile.lambda_provisioned_concurrency), 10);
      const lambdaMemory = parseInt(String(profile.lambda_memory_mb), 10);
      const lambdaCost = lambdaProvisioned * (lambdaMemory / 1024) * 0.000004167 * 3600 * 24 * 30;
      if (lambdaCost > 0) {
        lineItems.push({
          component: 'Lambda',
          description: `Provisioned concurrency (${lambdaProvisioned} instances × ${lambdaMemory}MB)`,
          baseCost: lambdaCost,
          usageCost: 0,
          totalCost: lambdaCost,
          unit: 'GB-second',
          quantity: lambdaProvisioned * (lambdaMemory / 1024) * 24 * 30,
          pricePerUnit: 0.000004167,
          percentage: 0,
        });
      }

      // Aurora costs
      const auroraMin = parseFloat(String(profile.aurora_min_capacity_acu));
      const auroraMax = parseFloat(String(profile.aurora_max_capacity_acu));
      const auroraReplicas = parseInt(String(profile.aurora_read_replica_count), 10);
      const avgAcu = (auroraMin + auroraMax) / 2;
      const auroraCost = avgAcu * 0.12 * 24 * 30 * (1 + auroraReplicas * 0.5);
      lineItems.push({
        component: 'Aurora',
        description: `Serverless v2 (${auroraMin}-${auroraMax} ACU, ${auroraReplicas} replicas)`,
        baseCost: auroraCost,
        usageCost: 0,
        totalCost: auroraCost,
        unit: 'ACU-hour',
        quantity: avgAcu * 24 * 30,
        pricePerUnit: 0.12,
        percentage: 0,
      });

      // Redis costs
      const redisNodeType = String(profile.redis_node_type);
      const redisShards = parseInt(String(profile.redis_num_shards), 10);
      const redisReplicas = parseInt(String(profile.redis_replicas_per_shard), 10);
      const nodePrice: Record<string, number> = {
        'cache.t4g.micro': 0.016, 'cache.t4g.small': 0.032,
        'cache.r6g.large': 0.182, 'cache.r6g.xlarge': 0.364, 'cache.r6g.2xlarge': 0.728,
      };
      const redisUnitPrice = nodePrice[redisNodeType] || 0.182;
      const nodeCount = redisShards * (1 + redisReplicas);
      const redisCost = nodeCount * redisUnitPrice * 24 * 30;
      lineItems.push({
        component: 'Redis',
        description: `ElastiCache ${redisNodeType} (${redisShards} shards × ${1 + redisReplicas} nodes)`,
        baseCost: redisCost,
        usageCost: 0,
        totalCost: redisCost,
        unit: 'node-hour',
        quantity: nodeCount * 24 * 30,
        pricePerUnit: redisUnitPrice,
        percentage: 0,
      });

      // API Gateway costs
      const apiRateLimit = parseInt(String(profile.api_throttling_rate_limit), 10);
      const estimatedRequests = apiRateLimit * 0.1 * 3600 * 24 * 30; // 10% avg utilization
      const apiCost = (estimatedRequests / 1000000) * 1.00;
      lineItems.push({
        component: 'API Gateway',
        description: `HTTP API (${apiRateLimit.toLocaleString()} RPS limit)`,
        baseCost: 0,
        usageCost: apiCost,
        totalCost: apiCost,
        unit: 'million requests',
        quantity: estimatedRequests / 1000000,
        pricePerUnit: 1.00,
        percentage: 0,
      });

      // SQS costs
      const sqsStandard = parseInt(String(profile.sqs_standard_queue_count), 10);
      const sqsFifo = parseInt(String(profile.sqs_fifo_queue_count), 10);
      const sqsCost = sqsStandard * 0.40 + sqsFifo * 0.50; // Assume 1M messages/queue
      lineItems.push({
        component: 'SQS',
        description: `${sqsStandard} standard + ${sqsFifo} FIFO queues`,
        baseCost: 0,
        usageCost: sqsCost,
        totalCost: sqsCost,
        unit: 'million requests',
        quantity: sqsStandard + sqsFifo,
        pricePerUnit: 0.40,
        percentage: 0,
      });

      // CloudFront costs (if enabled)
      const cloudFrontEnabled = profile.api_enable_cloudfront === true || profile.api_enable_cloudfront === 'true';
      if (cloudFrontEnabled) {
        const cfRequests = estimatedRequests;
        const cfDataGb = estimatedRequests * 0.0001; // 100KB avg response
        const cfCost = (cfRequests / 10000) * 0.01 + cfDataGb * 0.085;
        lineItems.push({
          component: 'CloudFront',
          description: 'Edge distribution for global access',
          baseCost: 0,
          usageCost: cfCost,
          totalCost: cfCost,
          unit: 'GB + requests',
          quantity: cfDataGb,
          pricePerUnit: 0.085,
          percentage: 0,
        });
      }

      // Calculate total and percentages
      const totalCost = lineItems.reduce((sum, item) => sum + item.totalCost, 0);
      lineItems.forEach(item => {
        item.percentage = totalCost > 0 ? (item.totalCost / totalCost) * 100 : 0;
      });

      // Sort by cost descending
      lineItems.sort((a, b) => b.totalCost - a.totalCost);

      return {
        groupName: 'Infrastructure Scaling',
        totalCost,
        estimatedMonthlyCost,
        tier,
        targetSessions,
        lineItems,
        costPerSession: targetSessions > 0 ? totalCost / targetSessions : 0,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      // Return undefined if scaling tables don't exist or error occurs
      return undefined;
    }
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
