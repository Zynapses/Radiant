/**
 * RADIANT v4.18.0 - AWS Free Tier Monitoring Types
 * CloudWatch, X-Ray, and Cost Explorer integration for infrastructure visibility
 */

// ============================================================================
// SECTION 1: CLOUDWATCH METRICS (Free Tier: 10 custom metrics, 1M API requests)
// ============================================================================

export type CloudWatchServiceType = 'lambda' | 'aurora' | 'ecs' | 'apigateway' | 'sqs' | 's3';

export interface CloudWatchMetricDatapoint {
  timestamp: string;
  value: number;
  unit: string;
  statistic: 'Average' | 'Sum' | 'Minimum' | 'Maximum' | 'SampleCount';
}

export interface CloudWatchMetric {
  namespace: string;
  metricName: string;
  dimensions: Record<string, string>;
  datapoints: CloudWatchMetricDatapoint[];
  period: number; // seconds
}

export interface LambdaMetrics {
  functionName: string;
  invocations: number;
  errors: number;
  duration: {
    avg: number;
    p50: number;
    p90: number;
    p99: number;
    max: number;
  };
  throttles: number;
  concurrentExecutions: number;
  coldStarts?: number;
  memoryUsedMb?: number;
  costEstimate: number;
}

export interface AuroraMetrics {
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
  acu?: number; // Aurora Capacity Units
  costEstimate: number;
}

export interface ECSMetrics {
  clusterName: string;
  serviceName: string;
  runningTasksCount: number;
  desiredTasksCount: number;
  cpuUtilization: number;
  memoryUtilization: number;
  networkRxBytes: number;
  networkTxBytes: number;
  costEstimate: number;
}

export interface APIGatewayMetrics {
  apiId: string;
  apiName: string;
  requestCount: number;
  latency: {
    avg: number;
    p50: number;
    p90: number;
  };
  error4xxCount: number;
  error5xxCount: number;
  cacheHitCount?: number;
  cacheMissCount?: number;
}

// ============================================================================
// SECTION 2: X-RAY TRACES (Free Tier: 100,000 traces/month)
// ============================================================================

export type TraceStatus = 'ok' | 'error' | 'fault' | 'throttle';

export interface XRayServiceNode {
  name: string;
  type: string; // 'AWS::Lambda', 'AWS::RDS', 'AWS::ECS', etc.
  state: 'active' | 'unknown';
  edges: {
    targetId: string;
    summaryStatistics: {
      totalCount: number;
      errorStatistics: {
        throttleCount: number;
        otherCount: number;
        totalCount: number;
      };
      faultStatistics: {
        otherCount: number;
        totalCount: number;
      };
      okCount: number;
      totalResponseTime: number;
    };
  }[];
  summaryStatistics: {
    totalCount: number;
    okCount: number;
    errorCount: number;
    faultCount: number;
    totalResponseTime: number;
  };
  responseTimeHistogram?: {
    value: number;
    count: number;
  }[];
}

export interface XRayTrace {
  traceId: string;
  duration: number;
  status: TraceStatus;
  startTime: string;
  endTime: string;
  segments: XRaySegment[];
  annotations?: Record<string, string | number | boolean>;
  http?: {
    method: string;
    url: string;
    statusCode: number;
  };
}

export interface XRaySegment {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  fault: boolean;
  error: boolean;
  throttle: boolean;
  subsegments?: XRaySegment[];
  annotations?: Record<string, string | number | boolean>;
  metadata?: Record<string, unknown>;
  aws?: {
    operation?: string;
    region?: string;
    resourceName?: string;
  };
}

export interface XRayServiceGraph {
  startTime: string;
  endTime: string;
  services: XRayServiceNode[];
  containsOldData: boolean;
}

export interface XRayTraceSummary {
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
  topEndpoints: {
    url: string;
    count: number;
    avgDuration: number;
    errorRate: number;
  }[];
  topErrors: {
    message: string;
    count: number;
    lastSeen: string;
  }[];
}

// ============================================================================
// SECTION 3: COST EXPLORER (Effectively free with basic usage)
// ============================================================================

export type CostGranularity = 'DAILY' | 'MONTHLY' | 'HOURLY';

export interface CostByService {
  service: string;
  cost: number;
  unit: string;
  percentageOfTotal: number;
  change: number; // percentage change from previous period
  trend: 'up' | 'down' | 'stable';
}

export interface CostByResource {
  resourceId: string;
  resourceType: string;
  service: string;
  cost: number;
  usage: number;
  usageUnit: string;
}

export interface CostTimeSeries {
  date: string;
  totalCost: number;
  services: {
    service: string;
    cost: number;
  }[];
}

export interface CostForecast {
  startDate: string;
  endDate: string;
  estimatedCost: number;
  lowerBound: number;
  upperBound: number;
  confidence: number; // 0-100
}

export interface CostSummary {
  period: {
    start: string;
    end: string;
    granularity: CostGranularity;
  };
  totalCost: number;
  previousPeriodCost: number;
  percentChange: number;
  trend: 'up' | 'down' | 'stable';
  byService: CostByService[];
  topResources: CostByResource[];
  forecast?: CostForecast;
  credits?: number;
  refunds?: number;
  netCost: number;
}

export interface CostAnomaly {
  id: string;
  service: string;
  startDate: string;
  endDate?: string;
  actualCost: number;
  expectedCost: number;
  impact: number; // percentage above expected
  severity: 'low' | 'medium' | 'high' | 'critical';
  rootCause?: string;
  status: 'open' | 'resolved' | 'acknowledged';
}

// ============================================================================
// SECTION 4: COMBINED MONITORING DASHBOARD
// ============================================================================

export interface AWSMonitoringConfig {
  id: string;
  tenantId: string;
  enabled: boolean;
  refreshIntervalMinutes: number;
  cloudwatch: {
    enabled: boolean;
    lambdaFunctions: string[]; // function names to monitor
    auroraClusterId?: string;
    ecsClusterName?: string;
    customNamespaces?: string[];
  };
  xray: {
    enabled: boolean;
    samplingRate: number; // 0-1
    filterExpression?: string;
    traceRetentionDays: number;
  };
  costExplorer: {
    enabled: boolean;
    budgetAlertThreshold?: number; // percentage
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

export interface MonitoringHealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastCheck: string;
  services: {
    name: string;
    type: CloudWatchServiceType;
    status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    message?: string;
    metrics: {
      key: string;
      value: number;
      unit: string;
      status: 'ok' | 'warning' | 'critical';
      threshold?: number;
    }[];
  }[];
}

export interface MonitoringDashboard {
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
  ecs?: ECSMetrics[];
  apiGateway?: APIGatewayMetrics[];
  xray: XRayTraceSummary;
  serviceGraph?: XRayServiceGraph;
  costs: CostSummary;
  anomalies: CostAnomaly[];
  freeTierUsage: FreeTierUsage;
}

// ============================================================================
// SECTION 5: FREE TIER TRACKING
// ============================================================================

export interface FreeTierService {
  service: string;
  metric: string;
  limit: number;
  used: number;
  unit: string;
  percentUsed: number;
  resetDate: string;
  status: 'ok' | 'warning' | 'exceeded';
}

export interface FreeTierUsage {
  period: {
    start: string;
    end: string;
  };
  services: FreeTierService[];
  totalSavings: number;
  atRisk: FreeTierService[];
  exceeded: FreeTierService[];
}

// ============================================================================
// SECTION 6: OVERLAY TYPES (For Smart Visual Overlays)
// ============================================================================

export type OverlayType = 
  | 'cost_on_metrics'      // Show cost impact on service metrics
  | 'latency_on_traces'    // Show latency distribution on trace data
  | 'errors_on_services'   // Show error rates overlaid on service graph
  | 'forecast_on_cost'     // Show forecast overlaid on historical cost
  | 'free_tier_on_usage'   // Show free tier limits on usage graphs
  | 'health_on_topology';  // Show health status on service topology

export interface OverlayConfig {
  type: OverlayType;
  enabled: boolean;
  opacity: number; // 0-1
  colorScheme: 'default' | 'accessible' | 'dark' | 'light';
  showLegend: boolean;
  animateTransitions: boolean;
}

export interface ChartDataPoint {
  x: number | string; // timestamp or category
  y: number;
  label?: string;
  color?: string;
  metadata?: Record<string, unknown>;
}

export interface ChartSeries {
  id: string;
  name: string;
  type: 'line' | 'bar' | 'area' | 'scatter';
  data: ChartDataPoint[];
  color?: string;
  yAxis?: 'left' | 'right';
  overlay?: boolean;
}

export interface MonitoringChart {
  id: string;
  title: string;
  subtitle?: string;
  series: ChartSeries[];
  xAxis: {
    type: 'time' | 'category' | 'number';
    label?: string;
  };
  yAxis: {
    left: { label: string; min?: number; max?: number };
    right?: { label: string; min?: number; max?: number };
  };
  overlays?: OverlayConfig[];
  annotations?: {
    x?: number | string;
    y?: number;
    label: string;
    type: 'line' | 'point' | 'region';
  }[];
}

// ============================================================================
// SECTION 7: API REQUEST/RESPONSE TYPES
// ============================================================================

export interface MonitoringQueryParams {
  startTime?: string;
  endTime?: string;
  period?: number; // seconds
  services?: CloudWatchServiceType[];
  includeXRay?: boolean;
  includeCosts?: boolean;
  includeForecasts?: boolean;
}

export interface MonitoringResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
  cached: boolean;
  nextRefresh?: string;
  error?: string;
}

export interface RefreshMonitoringRequest {
  services?: CloudWatchServiceType[];
  forceRefresh?: boolean;
}

export interface UpdateMonitoringConfigRequest {
  cloudwatch?: Partial<AWSMonitoringConfig['cloudwatch']>;
  xray?: Partial<AWSMonitoringConfig['xray']>;
  costExplorer?: Partial<AWSMonitoringConfig['costExplorer']>;
  alerting?: Partial<AWSMonitoringConfig['alerting']>;
  refreshIntervalMinutes?: number;
}

// ============================================================================
// SECTION 8: CACHED METRICS (For Database Storage)
// ============================================================================

export interface CachedMetricsEntry {
  id: string;
  tenantId: string;
  metricType: 'lambda' | 'aurora' | 'ecs' | 'xray' | 'cost' | 'health';
  metricKey: string;
  data: Record<string, unknown>;
  collectedAt: string;
  expiresAt: string;
  ttlSeconds: number;
}

export interface MetricsAggregation {
  tenantId: string;
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';
  periodStart: string;
  periodEnd: string;
  lambdaSummary?: {
    totalInvocations: number;
    totalErrors: number;
    avgDuration: number;
    totalCost: number;
  };
  auroraSummary?: {
    avgCpu: number;
    avgConnections: number;
    peakConnections: number;
    totalIOPS: number;
  };
  xraySummary?: {
    totalTraces: number;
    errorRate: number;
    avgLatency: number;
    p99Latency: number;
  };
  costSummary?: {
    totalCost: number;
    topService: string;
    topServiceCost: number;
  };
}
