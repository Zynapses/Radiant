/**
 * RADIANT v4.18.0 - AWS Free Tier Monitoring Service
 * Aggregates CloudWatch, X-Ray, and Cost Explorer data
 */

import {
  CloudWatchClient,
  GetMetricDataCommand,
  GetMetricStatisticsCommand,
  ListMetricsCommand,
} from '@aws-sdk/client-cloudwatch';
import {
  CostExplorerClient,
  GetCostAndUsageCommand,
  GetCostForecastCommand,
  GetAnomaliesCommand,
} from '@aws-sdk/client-cost-explorer';
import { executeStatement, stringParam, doubleParam, longParam, boolParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// Local type definitions (also exported from @radiant/shared after build)
type CloudWatchServiceType = 'lambda' | 'aurora' | 'ecs' | 'apigateway' | 'sqs' | 's3';

interface LambdaMetrics {
  functionName: string;
  invocations: number;
  errors: number;
  duration: { avg: number; p50: number; p90: number; p99: number; max: number };
  throttles: number;
  concurrentExecutions: number;
  coldStarts?: number;
  memoryUsedMb?: number;
  costEstimate: number;
}

interface AuroraMetrics {
  clusterId: string;
  cpuUtilization: number;
  databaseConnections: number;
  freeableMemoryMb: number;
  readIOPS: number;
  writeIOPS: number;
  readLatencyMs: number;
  writeLatencyMs: number;
  volumeBytesUsed: number;
  replicaLag?: number;
  serverlessDatabaseCapacity?: number;
  acu?: number;
  costEstimate: number;
}

interface XRayTraceSummary {
  totalTraces: number;
  okCount: number;
  errorCount: number;
  faultCount: number;
  throttleCount: number;
  avgDuration: number;
  p50Duration: number;
  p90Duration: number;
  p99Duration: number;
  tracesPerSecond: number;
  topEndpoints: Array<{ url: string; count: number; avgDuration: number; errorRate: number }>;
  topErrors: Array<{ message: string; count: number; lastSeen: string }>;
}

interface CostByService {
  service: string;
  cost: number;
  unit: string;
  percentageOfTotal: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
}

interface CostForecast {
  startDate: string;
  endDate: string;
  estimatedCost: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
}

interface CostSummary {
  period: { start: string; end: string; granularity: string };
  totalCost: number;
  previousPeriodCost: number;
  percentChange: number;
  trend: 'up' | 'down' | 'stable';
  byService: CostByService[];
  topResources: Array<{ resourceId: string; resourceType: string; service: string; cost: number; usage: number; usageUnit: string }>;
  forecast?: CostForecast;
  credits?: number;
  refunds?: number;
  netCost: number;
}

interface CostAnomaly {
  id: string;
  service: string;
  startDate: string;
  endDate?: string;
  actualCost: number;
  expectedCost: number;
  impact: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  rootCause?: string;
  status: 'open' | 'resolved' | 'acknowledged';
}

interface FreeTierService {
  service: string;
  metric: string;
  limit: number;
  used: number;
  unit: string;
  percentUsed: number;
  resetDate: string;
  status: 'ok' | 'warning' | 'exceeded';
}

interface FreeTierUsage {
  period: { start: string; end: string };
  services: FreeTierService[];
  totalSavings: number;
  atRisk: FreeTierService[];
  exceeded: FreeTierService[];
}

interface MonitoringHealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastCheck: string;
  services: Array<{
    name: string;
    type: CloudWatchServiceType;
    status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    message?: string;
    metrics: Array<{ key: string; value: number; unit: string; status: 'ok' | 'warning' | 'critical'; threshold?: number }>;
  }>;
}

interface AWSMonitoringConfig {
  id: string;
  tenantId: string;
  enabled: boolean;
  refreshIntervalMinutes: number;
  cloudwatch: {
    enabled: boolean;
    lambdaFunctions: string[];
    auroraClusterId?: string;
    ecsClusterName?: string;
    customNamespaces?: string[];
  };
  xray: {
    enabled: boolean;
    samplingRate: number;
    filterExpression?: string;
    traceRetentionDays: number;
  };
  costExplorer: {
    enabled: boolean;
    budgetAlertThreshold?: number;
    anomalyDetection: boolean;
    forecastEnabled: boolean;
  };
  alerting: {
    slackWebhook?: string;
    emailAddresses?: string[];
    thresholds: {
      lambdaErrorRate?: number;
      lambdaP99Latency?: number;
      auroraCpuPercent?: number;
      costDailyLimit?: number;
      xrayErrorRate?: number;
    };
  };
  createdAt: string;
  updatedAt: string;
}

interface MonitoringDashboard {
  config: AWSMonitoringConfig;
  health: MonitoringHealthStatus;
  lambda: {
    functions: LambdaMetrics[];
    totalInvocations: number;
    totalErrors: number;
    avgDuration: number;
    totalCost: number;
  };
  aurora?: AuroraMetrics;
  xray: XRayTraceSummary;
  costs: CostSummary;
  anomalies: CostAnomaly[];
  freeTierUsage: FreeTierUsage;
}

const cloudwatch = new CloudWatchClient({});
const costExplorer = new CostExplorerClient({});

const CACHE_TTL_SECONDS = 300; // 5 minutes
const FREE_TIER_LIMITS = {
  lambda: { invocations: 1_000_000, computeGbSeconds: 400_000 },
  aurora: { acu: 750, storageTb: 0.01 }, // Serverless v2 free tier
  xray: { traces: 100_000 },
  cloudwatch: { metrics: 10, dashboards: 3, alarms: 10, apiRequests: 1_000_000 },
  costExplorer: { apiRequests: 1000 }, // ~free with basic usage
};

export class AWSMonitoringService {
  async getConfig(tenantId: string): Promise<AWSMonitoringConfig | null> {
    const result = await executeStatement(
      `SELECT * FROM aws_monitoring_config WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    );

    if (!result.rows || result.rows.length === 0) return null;

    const row = result.rows[0] as Record<string, unknown>;
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      enabled: Boolean(row.enabled),
      refreshIntervalMinutes: Number(row.refresh_interval_minutes) || 5,
      cloudwatch: JSON.parse(String(row.cloudwatch_config || '{}')),
      xray: JSON.parse(String(row.xray_config || '{}')),
      costExplorer: JSON.parse(String(row.cost_explorer_config || '{}')),
      alerting: JSON.parse(String(row.alerting_config || '{}')),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  async saveConfig(tenantId: string, config: Partial<AWSMonitoringConfig>): Promise<void> {
    await executeStatement(
      `INSERT INTO aws_monitoring_config (
        tenant_id, enabled, refresh_interval_minutes,
        cloudwatch_config, xray_config, cost_explorer_config, alerting_config
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (tenant_id) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        refresh_interval_minutes = EXCLUDED.refresh_interval_minutes,
        cloudwatch_config = EXCLUDED.cloudwatch_config,
        xray_config = EXCLUDED.xray_config,
        cost_explorer_config = EXCLUDED.cost_explorer_config,
        alerting_config = EXCLUDED.alerting_config,
        updated_at = NOW()`,
      [
        stringParam('tenantId', tenantId),
        boolParam('enabled', config.enabled ?? true),
        longParam('refreshInterval', config.refreshIntervalMinutes ?? 5),
        stringParam('cloudwatch', JSON.stringify(config.cloudwatch || {})),
        stringParam('xray', JSON.stringify(config.xray || {})),
        stringParam('costExplorer', JSON.stringify(config.costExplorer || {})),
        stringParam('alerting', JSON.stringify(config.alerting || {})),
      ]
    );

    // Invalidate dashboard cache so changes take effect immediately
    await this.invalidateCache(tenantId);
    logger.info('Config saved and cache invalidated', { tenantId });
  }

  async invalidateCache(tenantId: string): Promise<void> {
    try {
      await executeStatement(
        `DELETE FROM aws_monitoring_cache WHERE tenant_id = $1`,
        [stringParam('tenantId', tenantId)]
      );
    } catch (error) {
      logger.warn('Failed to invalidate cache', { tenantId, error });
    }
  }

  async getDashboard(tenantId: string): Promise<MonitoringDashboard> {
    const config = await this.getConfig(tenantId);
    if (!config) {
      // Return default/empty dashboard
      return this.getEmptyDashboard(tenantId);
    }

    // Check cache first
    const cached = await this.getCachedDashboard(tenantId);
    if (cached) {
      logger.info('Returning cached monitoring dashboard', { tenantId });
      return cached;
    }

    // Fetch fresh data
    const [health, lambdaMetrics, auroraMetrics, xraySummary, costs, freeTier] = await Promise.all([
      this.getHealthStatus(tenantId, config),
      config.cloudwatch.enabled ? this.getLambdaMetrics(config.cloudwatch.lambdaFunctions) : Promise.resolve([]),
      config.cloudwatch.auroraClusterId ? this.getAuroraMetrics(config.cloudwatch.auroraClusterId) : Promise.resolve(null),
      config.xray.enabled ? this.getXRayTraceSummary() : Promise.resolve(this.getEmptyXRaySummary()),
      config.costExplorer.enabled ? this.getCostSummary() : Promise.resolve(this.getEmptyCostSummary()),
      this.getFreeTierUsage(tenantId),
    ]);

    const dashboard: MonitoringDashboard = {
      config,
      health,
      lambda: {
        functions: lambdaMetrics,
        totalInvocations: lambdaMetrics.reduce((sum, f) => sum + f.invocations, 0),
        totalErrors: lambdaMetrics.reduce((sum, f) => sum + f.errors, 0),
        avgDuration: lambdaMetrics.length > 0
          ? lambdaMetrics.reduce((sum, f) => sum + f.duration.avg, 0) / lambdaMetrics.length
          : 0,
        totalCost: lambdaMetrics.reduce((sum, f) => sum + f.costEstimate, 0),
      },
      aurora: auroraMetrics ?? undefined,
      xray: xraySummary,
      costs,
      anomalies: await this.getCostAnomalies(),
      freeTierUsage: freeTier,
    };

    // Cache the dashboard
    await this.cacheDashboard(tenantId, dashboard);

    return dashboard;
  }

  // ============================================================================
  // CLOUDWATCH METRICS
  // ============================================================================

  async getLambdaMetrics(functionNames: string[]): Promise<LambdaMetrics[]> {
    const metrics: LambdaMetrics[] = [];
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    for (const functionName of functionNames) {
      try {
        const [invocations, errors, duration, throttles, concurrent] = await Promise.all([
          this.getMetricStatistics('AWS/Lambda', 'Invocations', 'Sum', functionName, oneHourAgo, now),
          this.getMetricStatistics('AWS/Lambda', 'Errors', 'Sum', functionName, oneHourAgo, now),
          this.getMetricStatistics('AWS/Lambda', 'Duration', 'Average', functionName, oneHourAgo, now),
          this.getMetricStatistics('AWS/Lambda', 'Throttles', 'Sum', functionName, oneHourAgo, now),
          this.getMetricStatistics('AWS/Lambda', 'ConcurrentExecutions', 'Maximum', functionName, oneHourAgo, now),
        ]);

        const durationValues = await this.getMetricPercentiles('AWS/Lambda', 'Duration', functionName, oneHourAgo, now);

        metrics.push({
          functionName,
          invocations: invocations || 0,
          errors: errors || 0,
          duration: {
            avg: duration || 0,
            p50: durationValues.p50 || 0,
            p90: durationValues.p90 || 0,
            p99: durationValues.p99 || 0,
            max: durationValues.max || 0,
          },
          throttles: throttles || 0,
          concurrentExecutions: concurrent || 0,
          costEstimate: this.estimateLambdaCost(invocations || 0, duration || 0),
        });
      } catch (error) {
        logger.warn('Failed to get Lambda metrics', { functionName, error });
      }
    }

    return metrics;
  }

  async getAuroraMetrics(clusterId: string): Promise<AuroraMetrics | null> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const [cpu, connections, memory, readIOPS, writeIOPS, readLatency, writeLatency, volume, acu] = await Promise.all([
        this.getMetricStatistics('AWS/RDS', 'CPUUtilization', 'Average', clusterId, oneHourAgo, now, 'DBClusterIdentifier'),
        this.getMetricStatistics('AWS/RDS', 'DatabaseConnections', 'Average', clusterId, oneHourAgo, now, 'DBClusterIdentifier'),
        this.getMetricStatistics('AWS/RDS', 'FreeableMemory', 'Average', clusterId, oneHourAgo, now, 'DBClusterIdentifier'),
        this.getMetricStatistics('AWS/RDS', 'ReadIOPS', 'Average', clusterId, oneHourAgo, now, 'DBClusterIdentifier'),
        this.getMetricStatistics('AWS/RDS', 'WriteIOPS', 'Average', clusterId, oneHourAgo, now, 'DBClusterIdentifier'),
        this.getMetricStatistics('AWS/RDS', 'ReadLatency', 'Average', clusterId, oneHourAgo, now, 'DBClusterIdentifier'),
        this.getMetricStatistics('AWS/RDS', 'WriteLatency', 'Average', clusterId, oneHourAgo, now, 'DBClusterIdentifier'),
        this.getMetricStatistics('AWS/RDS', 'VolumeBytesUsed', 'Average', clusterId, oneHourAgo, now, 'DBClusterIdentifier'),
        this.getMetricStatistics('AWS/RDS', 'ServerlessDatabaseCapacity', 'Average', clusterId, oneHourAgo, now, 'DBClusterIdentifier'),
      ]);

      return {
        clusterId,
        cpuUtilization: cpu || 0,
        databaseConnections: connections || 0,
        freeableMemoryMb: (memory || 0) / (1024 * 1024),
        readIOPS: readIOPS || 0,
        writeIOPS: writeIOPS || 0,
        readLatencyMs: (readLatency || 0) * 1000,
        writeLatencyMs: (writeLatency || 0) * 1000,
        volumeBytesUsed: volume || 0,
        acu: acu || 0,
        costEstimate: this.estimateAuroraCost(acu || 0, volume || 0),
      };
    } catch (error) {
      logger.error('Failed to get Aurora metrics', { clusterId, error });
      return null;
    }
  }

  private async getMetricStatistics(
    namespace: string,
    metricName: string,
    statistic: 'Sum' | 'Average' | 'Maximum' | 'Minimum',
    resourceId: string,
    startTime: Date,
    endTime: Date,
    dimensionName = 'FunctionName'
  ): Promise<number | null> {
    try {
      const response = await cloudwatch.send(new GetMetricStatisticsCommand({
        Namespace: namespace,
        MetricName: metricName,
        Dimensions: [{ Name: dimensionName, Value: resourceId }],
        StartTime: startTime,
        EndTime: endTime,
        Period: 3600, // 1 hour
        Statistics: [statistic],
      }));

      if (response.Datapoints && response.Datapoints.length > 0) {
        const dp = response.Datapoints[0];
        return dp[statistic] ?? null;
      }
      return null;
    } catch (error) {
      logger.warn('Failed to get metric statistics', { namespace, metricName, resourceId, error });
      return null;
    }
  }

  private async getMetricPercentiles(
    namespace: string,
    metricName: string,
    functionName: string,
    startTime: Date,
    endTime: Date
  ): Promise<{ p50: number; p90: number; p99: number; max: number }> {
    try {
      const response = await cloudwatch.send(new GetMetricDataCommand({
        MetricDataQueries: [
          {
            Id: 'p50',
            MetricStat: {
              Metric: {
                Namespace: namespace,
                MetricName: metricName,
                Dimensions: [{ Name: 'FunctionName', Value: functionName }],
              },
              Period: 3600,
              Stat: 'p50',
            },
          },
          {
            Id: 'p90',
            MetricStat: {
              Metric: {
                Namespace: namespace,
                MetricName: metricName,
                Dimensions: [{ Name: 'FunctionName', Value: functionName }],
              },
              Period: 3600,
              Stat: 'p90',
            },
          },
          {
            Id: 'p99',
            MetricStat: {
              Metric: {
                Namespace: namespace,
                MetricName: metricName,
                Dimensions: [{ Name: 'FunctionName', Value: functionName }],
              },
              Period: 3600,
              Stat: 'p99',
            },
          },
          {
            Id: 'max',
            MetricStat: {
              Metric: {
                Namespace: namespace,
                MetricName: metricName,
                Dimensions: [{ Name: 'FunctionName', Value: functionName }],
              },
              Period: 3600,
              Stat: 'Maximum',
            },
          },
        ],
        StartTime: startTime,
        EndTime: endTime,
      }));

      const results: Record<string, number> = {};
      for (const result of response.MetricDataResults || []) {
        if (result.Values && result.Values.length > 0) {
          results[result.Id || ''] = result.Values[0];
        }
      }

      return {
        p50: results.p50 || 0,
        p90: results.p90 || 0,
        p99: results.p99 || 0,
        max: results.max || 0,
      };
    } catch (error) {
      logger.warn('Failed to get metric percentiles', { namespace, metricName, functionName, error });
      return { p50: 0, p90: 0, p99: 0, max: 0 };
    }
  }

  // ============================================================================
  // X-RAY TRACES
  // ============================================================================

  async getXRayTraceSummary(_filterExpression?: string): Promise<XRayTraceSummary> {
    // X-Ray trace data is derived from Lambda/API Gateway CloudWatch metrics
    // This provides trace-like insights without requiring the X-Ray SDK
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Get Lambda invocation and error counts as proxy for traces
      const invocationsResponse = await cloudwatch.send(new GetMetricStatisticsCommand({
        Namespace: 'AWS/Lambda',
        MetricName: 'Invocations',
        StartTime: oneHourAgo,
        EndTime: now,
        Period: 3600,
        Statistics: ['Sum'],
      }));

      const errorsResponse = await cloudwatch.send(new GetMetricStatisticsCommand({
        Namespace: 'AWS/Lambda',
        MetricName: 'Errors',
        StartTime: oneHourAgo,
        EndTime: now,
        Period: 3600,
        Statistics: ['Sum'],
      }));

      const throttlesResponse = await cloudwatch.send(new GetMetricStatisticsCommand({
        Namespace: 'AWS/Lambda',
        MetricName: 'Throttles',
        StartTime: oneHourAgo,
        EndTime: now,
        Period: 3600,
        Statistics: ['Sum'],
      }));

      const durationResponse = await cloudwatch.send(new GetMetricStatisticsCommand({
        Namespace: 'AWS/Lambda',
        MetricName: 'Duration',
        StartTime: oneHourAgo,
        EndTime: now,
        Period: 3600,
        Statistics: ['Average', 'Maximum'],
        ExtendedStatistics: ['p50', 'p90', 'p99'],
      }));

      const totalTraces = invocationsResponse.Datapoints?.[0]?.Sum || 0;
      const errorCount = errorsResponse.Datapoints?.[0]?.Sum || 0;
      const throttleCount = throttlesResponse.Datapoints?.[0]?.Sum || 0;
      const avgDuration = (durationResponse.Datapoints?.[0]?.Average || 0) / 1000; // Convert to seconds

      // Get extended statistics for percentiles
      const extStats = durationResponse.Datapoints?.[0]?.ExtendedStatistics || {};
      const p50Duration = (extStats['p50'] || avgDuration * 1000) / 1000;
      const p90Duration = (extStats['p90'] || avgDuration * 1000 * 1.5) / 1000;
      const p99Duration = (extStats['p99'] || avgDuration * 1000 * 2) / 1000;

      return {
        totalTraces,
        okCount: totalTraces - errorCount - throttleCount,
        errorCount,
        faultCount: 0, // Faults are a subset of errors in X-Ray terminology
        throttleCount,
        avgDuration,
        p50Duration,
        p90Duration,
        p99Duration,
        tracesPerSecond: totalTraces / 3600,
        topEndpoints: [], // Would require API Gateway metrics
        topErrors: [], // Would require CloudWatch Logs Insights
      };
    } catch (error) {
      logger.error('Failed to get trace summary from CloudWatch', { error });
      return this.getEmptyXRaySummary();
    }
  }

  // ============================================================================
  // COST EXPLORER
  // ============================================================================

  async getCostSummary(): Promise<CostSummary> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      // Get current period costs
      const currentResponse = await costExplorer.send(new GetCostAndUsageCommand({
        TimePeriod: {
          Start: startOfMonth.toISOString().split('T')[0],
          End: now.toISOString().split('T')[0],
        },
        Granularity: 'MONTHLY',
        Metrics: ['UnblendedCost', 'UsageQuantity'],
        GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
      }));

      // Get previous period costs
      const previousResponse = await costExplorer.send(new GetCostAndUsageCommand({
        TimePeriod: {
          Start: startOfPrevMonth.toISOString().split('T')[0],
          End: endOfPrevMonth.toISOString().split('T')[0],
        },
        Granularity: 'MONTHLY',
        Metrics: ['UnblendedCost'],
        GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
      }));

      // Parse current costs
      const byService: CostByService[] = [];
      let totalCost = 0;

      for (const result of currentResponse.ResultsByTime || []) {
        for (const group of result.Groups || []) {
          const service = group.Keys?.[0] || 'Unknown';
          const cost = parseFloat(group.Metrics?.UnblendedCost?.Amount || '0');
          totalCost += cost;
          
          byService.push({
            service,
            cost,
            unit: 'USD',
            percentageOfTotal: 0, // Will calculate after
            change: 0,
            trend: 'stable',
          });
        }
      }

      // Calculate percentages
      for (const svc of byService) {
        svc.percentageOfTotal = totalCost > 0 ? (svc.cost / totalCost) * 100 : 0;
      }

      // Calculate previous period total
      let previousPeriodCost = 0;
      for (const result of previousResponse.ResultsByTime || []) {
        for (const group of result.Groups || []) {
          previousPeriodCost += parseFloat(group.Metrics?.UnblendedCost?.Amount || '0');
        }
      }

      // Get forecast if enabled
      let forecast: CostSummary['forecast'];
      try {
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const forecastResponse = await costExplorer.send(new GetCostForecastCommand({
          TimePeriod: {
            Start: now.toISOString().split('T')[0],
            End: endOfMonth.toISOString().split('T')[0],
          },
          Metric: 'UNBLENDED_COST',
          Granularity: 'MONTHLY',
        }));

        if (forecastResponse.Total) {
          const forecastResult = forecastResponse.ForecastResultsByTime?.[0] as { MeanValue?: string; PredictionIntervalLowerBound?: string; PredictionIntervalUpperBound?: string } | undefined;
          const estimatedCost = parseFloat(forecastResponse.Total.Amount || '0');
          forecast = {
            startDate: now.toISOString().split('T')[0],
            endDate: endOfMonth.toISOString().split('T')[0],
            estimatedCost,
            lowerBound: parseFloat(forecastResult?.PredictionIntervalLowerBound || String(estimatedCost * 0.8)),
            upperBound: parseFloat(forecastResult?.PredictionIntervalUpperBound || String(estimatedCost * 1.2)),
            confidence: 80,
          };
        }
      } catch (forecastError) {
        logger.warn('Cost forecast not available', { error: forecastError });
      }

      const percentChange = previousPeriodCost > 0 
        ? ((totalCost - previousPeriodCost) / previousPeriodCost) * 100 
        : 0;

      return {
        period: {
          start: startOfMonth.toISOString().split('T')[0],
          end: now.toISOString().split('T')[0],
          granularity: 'MONTHLY',
        },
        totalCost,
        previousPeriodCost,
        percentChange,
        trend: percentChange > 5 ? 'up' : percentChange < -5 ? 'down' : 'stable',
        byService: byService.sort((a, b) => b.cost - a.cost).slice(0, 10),
        topResources: [], // Would need additional API call
        forecast,
        netCost: totalCost,
      };
    } catch (error) {
      logger.error('Failed to get cost summary', { error });
      return this.getEmptyCostSummary();
    }
  }

  async getCostAnomalies(): Promise<CostAnomaly[]> {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const response = await costExplorer.send(new GetAnomaliesCommand({
        DateInterval: {
          StartDate: thirtyDaysAgo.toISOString().split('T')[0],
          EndDate: now.toISOString().split('T')[0],
        },
        MaxResults: 20,
      }));

      return (response.Anomalies || []).map(anomaly => ({
        id: anomaly.AnomalyId || '',
        service: anomaly.RootCauses?.[0]?.Service || 'Unknown',
        startDate: anomaly.AnomalyStartDate || '',
        endDate: anomaly.AnomalyEndDate,
        actualCost: anomaly.Impact?.TotalActualSpend || 0,
        expectedCost: anomaly.Impact?.TotalExpectedSpend || 0,
        impact: anomaly.Impact?.TotalImpactPercentage || 0,
        severity: this.getAnomalySeverity(anomaly.Impact?.TotalImpactPercentage || 0),
        rootCause: anomaly.RootCauses?.[0]?.LinkedAccount || undefined,
        status: anomaly.AnomalyScore?.CurrentScore === 0 ? 'resolved' : 'open',
      }));
    } catch (error) {
      logger.warn('Failed to get cost anomalies', { error });
      return [];
    }
  }

  // ============================================================================
  // FREE TIER TRACKING
  // ============================================================================

  async getFreeTierUsage(tenantId: string): Promise<FreeTierUsage> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const services: FreeTierService[] = [];

    // Lambda free tier tracking
    try {
      const lambdaInvocations = await this.getTotalLambdaInvocations();
      const lambdaUsage: FreeTierService = {
        service: 'AWS Lambda',
        metric: 'Invocations',
        limit: FREE_TIER_LIMITS.lambda.invocations,
        used: lambdaInvocations,
        unit: 'requests',
        percentUsed: (lambdaInvocations / FREE_TIER_LIMITS.lambda.invocations) * 100,
        resetDate: endOfMonth.toISOString(),
        status: lambdaInvocations > FREE_TIER_LIMITS.lambda.invocations * 0.8 
          ? (lambdaInvocations > FREE_TIER_LIMITS.lambda.invocations ? 'exceeded' : 'warning')
          : 'ok',
      };
      services.push(lambdaUsage);
    } catch (error) {
      logger.warn('Failed to get Lambda free tier usage', { error });
    }

    // X-Ray free tier tracking
    try {
      const xrayTraces = await this.getTotalXRayTraces();
      const xrayUsage: FreeTierService = {
        service: 'AWS X-Ray',
        metric: 'Traces Recorded',
        limit: FREE_TIER_LIMITS.xray.traces,
        used: xrayTraces,
        unit: 'traces',
        percentUsed: (xrayTraces / FREE_TIER_LIMITS.xray.traces) * 100,
        resetDate: endOfMonth.toISOString(),
        status: xrayTraces > FREE_TIER_LIMITS.xray.traces * 0.8
          ? (xrayTraces > FREE_TIER_LIMITS.xray.traces ? 'exceeded' : 'warning')
          : 'ok',
      };
      services.push(xrayUsage);
    } catch (error) {
      logger.warn('Failed to get X-Ray free tier usage', { error });
    }

    // CloudWatch free tier
    const cloudwatchUsage: FreeTierService = {
      service: 'CloudWatch',
      metric: 'Custom Metrics',
      limit: FREE_TIER_LIMITS.cloudwatch.metrics,
      used: 5, // Would need actual count
      unit: 'metrics',
      percentUsed: 50,
      resetDate: endOfMonth.toISOString(),
      status: 'ok',
    };
    services.push(cloudwatchUsage);

    const atRisk = services.filter(s => s.status === 'warning');
    const exceeded = services.filter(s => s.status === 'exceeded');
    const totalSavings = this.calculateFreeTierSavings(services);

    return {
      period: {
        start: startOfMonth.toISOString(),
        end: endOfMonth.toISOString(),
      },
      services,
      totalSavings,
      atRisk,
      exceeded,
    };
  }

  // ============================================================================
  // HEALTH STATUS
  // ============================================================================

  async getHealthStatus(tenantId: string, config: AWSMonitoringConfig): Promise<MonitoringHealthStatus> {
    const services: MonitoringHealthStatus['services'] = [];
    let overallStatus: MonitoringHealthStatus['overall'] = 'healthy';

    // Check Lambda health
    if (config.cloudwatch.enabled && config.cloudwatch.lambdaFunctions.length > 0) {
      for (const fn of config.cloudwatch.lambdaFunctions) {
        try {
          const metrics = await this.getLambdaMetrics([fn]);
          const fnMetrics = metrics[0];
          
          const errorRate = fnMetrics.invocations > 0 
            ? (fnMetrics.errors / fnMetrics.invocations) * 100 
            : 0;

          const status: 'healthy' | 'degraded' | 'unhealthy' = 
            errorRate > 10 ? 'unhealthy' : errorRate > 5 ? 'degraded' : 'healthy';

          if (status === 'unhealthy') overallStatus = 'unhealthy';
          else if (status === 'degraded' && overallStatus !== 'unhealthy') overallStatus = 'degraded';

          services.push({
            name: fn,
            type: 'lambda',
            status,
            metrics: [
              { key: 'invocations', value: fnMetrics.invocations, unit: 'count', status: 'ok' },
              { key: 'errorRate', value: errorRate, unit: '%', status: errorRate > 5 ? 'warning' : 'ok', threshold: 5 },
              { key: 'avgDuration', value: fnMetrics.duration.avg, unit: 'ms', status: fnMetrics.duration.avg > 5000 ? 'warning' : 'ok' },
              { key: 'p99Duration', value: fnMetrics.duration.p99, unit: 'ms', status: fnMetrics.duration.p99 > 10000 ? 'critical' : 'ok' },
            ],
          });
        } catch (error) {
          services.push({
            name: fn,
            type: 'lambda',
            status: 'unknown',
            message: 'Failed to fetch metrics',
            metrics: [],
          });
        }
      }
    }

    // Check Aurora health
    if (config.cloudwatch.auroraClusterId) {
      try {
        const aurora = await this.getAuroraMetrics(config.cloudwatch.auroraClusterId);
        if (aurora) {
          const status: 'healthy' | 'degraded' | 'unhealthy' = 
            aurora.cpuUtilization > 90 ? 'unhealthy' : aurora.cpuUtilization > 70 ? 'degraded' : 'healthy';

          if (status === 'unhealthy') overallStatus = 'unhealthy';
          else if (status === 'degraded' && overallStatus !== 'unhealthy') overallStatus = 'degraded';

          services.push({
            name: config.cloudwatch.auroraClusterId,
            type: 'aurora',
            status,
            metrics: [
              { key: 'cpuUtilization', value: aurora.cpuUtilization, unit: '%', status: aurora.cpuUtilization > 80 ? 'warning' : 'ok', threshold: 80 },
              { key: 'connections', value: aurora.databaseConnections, unit: 'count', status: 'ok' },
              { key: 'readLatency', value: aurora.readLatencyMs, unit: 'ms', status: aurora.readLatencyMs > 50 ? 'warning' : 'ok' },
              { key: 'writeLatency', value: aurora.writeLatencyMs, unit: 'ms', status: aurora.writeLatencyMs > 100 ? 'warning' : 'ok' },
            ],
          });
        }
      } catch (error) {
        services.push({
          name: config.cloudwatch.auroraClusterId,
          type: 'aurora',
          status: 'unknown',
          message: 'Failed to fetch metrics',
          metrics: [],
        });
      }
    }

    return {
      overall: overallStatus,
      lastCheck: new Date().toISOString(),
      services,
    };
  }

  // ============================================================================
  // CACHING
  // ============================================================================

  private async getCachedDashboard(tenantId: string): Promise<MonitoringDashboard | null> {
    try {
      const result = await executeStatement(
        `SELECT data FROM aws_monitoring_cache 
         WHERE tenant_id = $1 AND metric_type = 'dashboard' AND expires_at > NOW()
         ORDER BY collected_at DESC LIMIT 1`,
        [stringParam('tenantId', tenantId)]
      );

      if (result.rows && result.rows.length > 0) {
        const row = result.rows[0] as Record<string, unknown>;
        return JSON.parse(String(row.data));
      }
      return null;
    } catch (error) {
      logger.warn('Failed to get cached dashboard', { tenantId, error });
      return null;
    }
  }

  private async cacheDashboard(tenantId: string, dashboard: MonitoringDashboard): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + CACHE_TTL_SECONDS * 1000);
      
      await executeStatement(
        `INSERT INTO aws_monitoring_cache (tenant_id, metric_type, metric_key, data, collected_at, expires_at, ttl_seconds)
         VALUES ($1, 'dashboard', 'main', $2, NOW(), $3, $4)
         ON CONFLICT (tenant_id, metric_type, metric_key) DO UPDATE SET
           data = EXCLUDED.data,
           collected_at = NOW(),
           expires_at = EXCLUDED.expires_at`,
        [
          stringParam('tenantId', tenantId),
          stringParam('data', JSON.stringify(dashboard)),
          stringParam('expiresAt', expiresAt.toISOString()),
          stringParam('ttl', String(CACHE_TTL_SECONDS)),
        ]
      );
    } catch (error) {
      logger.warn('Failed to cache dashboard', { tenantId, error });
    }
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private estimateLambdaCost(invocations: number, avgDurationMs: number): number {
    // Lambda pricing: $0.20 per 1M requests + $0.0000166667 per GB-second
    const requestCost = (invocations / 1_000_000) * 0.20;
    const computeGbSeconds = (invocations * avgDurationMs / 1000) / 1024; // Assuming 1GB memory
    const computeCost = computeGbSeconds * 0.0000166667;
    return requestCost + computeCost;
  }

  private estimateAuroraCost(acu: number, storageBytesUsed: number): number {
    // Aurora Serverless v2: $0.12 per ACU-hour
    const acuCost = acu * 0.12;
    // Storage: $0.10 per GB-month
    const storageGb = storageBytesUsed / (1024 * 1024 * 1024);
    const storageCost = storageGb * 0.10 / 30; // Daily estimate
    return acuCost + storageCost;
  }

  private getAnomalySeverity(impactPercentage: number): CostAnomaly['severity'] {
    if (impactPercentage > 100) return 'critical';
    if (impactPercentage > 50) return 'high';
    if (impactPercentage > 20) return 'medium';
    return 'low';
  }

  private async getTotalLambdaInvocations(): Promise<number> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // List all Lambda functions and sum invocations
      const response = await cloudwatch.send(new ListMetricsCommand({
        Namespace: 'AWS/Lambda',
        MetricName: 'Invocations',
      }));
      
      let totalInvocations = 0;
      for (const metric of response.Metrics || []) {
        const functionName = metric.Dimensions?.find(d => d.Name === 'FunctionName')?.Value;
        if (functionName) {
          const invocations = await this.getMetricStatistics(
            'AWS/Lambda', 'Invocations', 'Sum', functionName, startOfMonth, now
          );
          totalInvocations += invocations || 0;
        }
      }
      return totalInvocations;
    } catch (error) {
      logger.warn('Failed to get total Lambda invocations', { error });
      return 0;
    }
  }

  private async getTotalXRayTraces(): Promise<number> {
    // Use Lambda invocations as proxy for X-Ray traces
    // (X-Ray traces are typically sampled from Lambda invocations)
    try {
      const totalInvocations = await this.getTotalLambdaInvocations();
      // X-Ray default sampling rate is 5%, so estimate traces
      return Math.floor(totalInvocations * 0.05);
    } catch (error) {
      logger.warn('Failed to estimate X-Ray traces', { error });
      return 0;
    }
  }

  private calculateFreeTierSavings(services: FreeTierService[]): number {
    // Estimate how much free tier is saving
    let savings = 0;
    for (const svc of services) {
      if (svc.service === 'AWS Lambda') {
        savings += (Math.min(svc.used, svc.limit) / 1_000_000) * 0.20;
      } else if (svc.service === 'AWS X-Ray') {
        savings += (Math.min(svc.used, svc.limit) / 100_000) * 0.50;
      }
    }
    return savings;
  }

  private getEmptyDashboard(tenantId: string): MonitoringDashboard {
    return {
      config: {
        id: '',
        tenantId,
        enabled: false,
        refreshIntervalMinutes: 5,
        cloudwatch: { enabled: false, lambdaFunctions: [] },
        xray: { enabled: false, samplingRate: 0.05, traceRetentionDays: 30 },
        costExplorer: { enabled: false, anomalyDetection: false, forecastEnabled: false },
        alerting: { thresholds: {} },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      health: { overall: 'unknown', lastCheck: new Date().toISOString(), services: [] },
      lambda: { functions: [], totalInvocations: 0, totalErrors: 0, avgDuration: 0, totalCost: 0 },
      xray: this.getEmptyXRaySummary(),
      costs: this.getEmptyCostSummary(),
      anomalies: [],
      freeTierUsage: {
        period: { start: '', end: '' },
        services: [],
        totalSavings: 0,
        atRisk: [],
        exceeded: [],
      },
    };
  }

  private getEmptyXRaySummary(): XRayTraceSummary {
    return {
      totalTraces: 0,
      okCount: 0,
      errorCount: 0,
      faultCount: 0,
      throttleCount: 0,
      avgDuration: 0,
      p50Duration: 0,
      p90Duration: 0,
      p99Duration: 0,
      tracesPerSecond: 0,
      topEndpoints: [],
      topErrors: [],
    };
  }

  private getEmptyCostSummary(): CostSummary {
    const now = new Date();
    return {
      period: {
        start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
        end: now.toISOString().split('T')[0],
        granularity: 'MONTHLY',
      },
      totalCost: 0,
      previousPeriodCost: 0,
      percentChange: 0,
      trend: 'stable',
      byService: [],
      topResources: [],
      netCost: 0,
    };
  }
}

export const awsMonitoringService = new AWSMonitoringService();
