/**
 * RADIANT v4.18.0 - AWS Free Tier Monitoring Admin API
 * Endpoints for CloudWatch, X-Ray, and Cost Explorer monitoring
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { awsMonitoringService } from '../shared/services/aws-monitoring.service';
import { monitoringNotificationsService } from '../shared/services/aws-monitoring-notifications.service';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

// Response helpers
const createResponse = (statusCode: number, data: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

const createErrorResponse = (statusCode: number, message: string): APIGatewayProxyResult => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ success: false, error: message }),
});

// Get tenant ID from event (from auth middleware)
const getTenantId = (event: APIGatewayProxyEvent): string | null => {
  return event.requestContext.authorizer?.tenantId || null;
};

// Local type definitions
interface UpdateMonitoringConfigRequest {
  cloudwatch?: { enabled?: boolean; lambdaFunctions?: string[]; auroraClusterId?: string };
  xray?: { enabled?: boolean; samplingRate?: number; filterExpression?: string };
  costExplorer?: { enabled?: boolean; anomalyDetection?: boolean; forecastEnabled?: boolean };
  alerting?: { thresholds?: Record<string, number> };
  refreshIntervalMinutes?: number;
}

interface RefreshMonitoringRequest {
  services?: string[];
  forceRefresh?: boolean;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const path = event.path.replace('/api/admin/aws-monitoring', '');
  const method = event.httpMethod;

  try {
    const tenantId = getTenantId(event);
    if (!tenantId) {
      return createErrorResponse(401, 'Unauthorized');
    }

    // Route handling
    if (method === 'GET' && path === '/dashboard') {
      return await getDashboard(tenantId, event);
    }

    if (method === 'GET' && path === '/config') {
      return await getConfig(tenantId);
    }

    if (method === 'PUT' && path === '/config') {
      return await updateConfig(tenantId, event);
    }

    if (method === 'POST' && path === '/refresh') {
      return await refreshMetrics(tenantId, event);
    }

    if (method === 'GET' && path === '/lambda') {
      return await getLambdaMetrics(tenantId, event);
    }

    if (method === 'GET' && path === '/aurora') {
      return await getAuroraMetrics(tenantId);
    }

    if (method === 'GET' && path === '/xray') {
      return await getXRayData(tenantId, event);
    }

    if (method === 'GET' && path === '/xray/service-graph') {
      return await getServiceGraph(tenantId);
    }

    if (method === 'GET' && path === '/costs') {
      return await getCosts(tenantId, event);
    }

    if (method === 'GET' && path === '/costs/anomalies') {
      return await getCostAnomalies(tenantId);
    }

    if (method === 'GET' && path === '/free-tier') {
      return await getFreeTierUsage(tenantId);
    }

    if (method === 'GET' && path === '/health') {
      return await getHealthStatus(tenantId);
    }

    if (method === 'GET' && path === '/charts/lambda-invocations') {
      return await getLambdaInvocationsChart(tenantId, event);
    }

    if (method === 'GET' && path === '/charts/cost-trend') {
      return await getCostTrendChart(tenantId, event);
    }

    if (method === 'GET' && path === '/charts/latency-distribution') {
      return await getLatencyDistributionChart(tenantId, event);
    }

    // ========== NOTIFICATION ROUTES ==========
    
    // Notification Targets (admin-settable phone/email)
    if (method === 'GET' && path === '/notifications/targets') {
      return await getNotificationTargets(tenantId);
    }
    if (method === 'POST' && path === '/notifications/targets') {
      return await addNotificationTarget(tenantId, event);
    }
    if (method === 'PUT' && path.startsWith('/notifications/targets/')) {
      const targetId = path.split('/').pop() || '';
      return await updateNotificationTarget(tenantId, targetId, event);
    }
    if (method === 'DELETE' && path.startsWith('/notifications/targets/')) {
      const targetId = path.split('/').pop() || '';
      return await deleteNotificationTarget(tenantId, targetId);
    }

    // Spend Thresholds (hourly/daily/weekly/monthly)
    if (method === 'GET' && path === '/notifications/spend-thresholds') {
      return await getSpendThresholds(tenantId);
    }
    if (method === 'POST' && path === '/notifications/spend-thresholds') {
      return await setSpendThreshold(tenantId, event);
    }
    if (method === 'PUT' && path.startsWith('/notifications/spend-thresholds/')) {
      const thresholdId = path.split('/').pop() || '';
      return await updateSpendThreshold(tenantId, thresholdId, event);
    }
    if (method === 'DELETE' && path.startsWith('/notifications/spend-thresholds/')) {
      const thresholdId = path.split('/').pop() || '';
      return await deleteSpendThreshold(tenantId, thresholdId);
    }

    // Metric Thresholds
    if (method === 'GET' && path === '/notifications/metric-thresholds') {
      return await getMetricThresholds(tenantId);
    }
    if (method === 'POST' && path === '/notifications/metric-thresholds') {
      return await setMetricThreshold(tenantId, event);
    }

    // Spend Summary (real-time hourly/daily/weekly/monthly)
    if (method === 'GET' && path === '/notifications/spend-summary') {
      return await getSpendSummary(tenantId);
    }

    // Notification Log
    if (method === 'GET' && path === '/notifications/log') {
      return await getNotificationLog(tenantId, event);
    }

    // Chargeable Tier Status
    if (method === 'GET' && path === '/chargeable-status') {
      return await getChargeableStatus(tenantId);
    }

    // Check and send notifications (can be called by EventBridge)
    if (method === 'POST' && path === '/notifications/check') {
      return await checkAndNotify(tenantId);
    }

    // ========== FREE TIER SETTINGS ROUTES ==========
    
    // Get all service tier settings (free tier ON by default)
    if (method === 'GET' && path === '/tier-settings') {
      return await getFreeTierSettings(tenantId);
    }
    
    // Toggle paid tier for a specific service (slider button)
    if (method === 'POST' && path === '/tier-settings/toggle-paid') {
      return await toggleServicePaidTier(tenantId, event);
    }
    
    // Enable/disable auto-scale to paid when free tier exceeded
    if (method === 'POST' && path === '/tier-settings/auto-scale') {
      return await setServiceAutoScale(tenantId, event);
    }
    
    // Set budget cap for paid tier
    if (method === 'POST' && path === '/tier-settings/budget-cap') {
      return await setServiceBudgetCap(tenantId, event);
    }

    return createErrorResponse(404, 'Not Found');
  } catch (error) {
    logger.error('AWS Monitoring API error', { path, method, error });
    return createErrorResponse(500, error instanceof Error ? error.message : 'Internal Server Error');
  }
};

// ============================================================================
// DASHBOARD
// ============================================================================

async function getDashboard(
  tenantId: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const dashboard = await awsMonitoringService.getDashboard(tenantId);
  
  return createResponse(200, {
    success: true,
    data: dashboard,
    timestamp: new Date().toISOString(),
    cached: false, // Service handles caching internally
  });
}

// ============================================================================
// CONFIGURATION
// ============================================================================

async function getConfig(tenantId: string): Promise<APIGatewayProxyResult> {
  const config = await awsMonitoringService.getConfig(tenantId);
  
  if (!config) {
    // Return default config
    return createResponse(200, {
      success: true,
      data: {
        tenantId,
        enabled: false,
        refreshIntervalMinutes: 5,
        cloudwatch: {
          enabled: true,
          lambdaFunctions: [],
        },
        xray: {
          enabled: true,
          samplingRate: 0.05,
          traceRetentionDays: 30,
        },
        costExplorer: {
          enabled: true,
          anomalyDetection: true,
          forecastEnabled: true,
        },
        alerting: {
          thresholds: {
            lambdaErrorRate: 5,
            lambdaP99Latency: 10000,
            auroraCpuPercent: 80,
            xrayErrorRate: 5,
          },
        },
      },
    });
  }
  
  return createResponse(200, {
    success: true,
    data: config,
  });
}

async function updateConfig(
  tenantId: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body: UpdateMonitoringConfigRequest = JSON.parse(event.body || '{}');
  
  // Build config with required defaults for nested objects
  await awsMonitoringService.saveConfig(tenantId, {
    tenantId,
    enabled: true,
    refreshIntervalMinutes: body.refreshIntervalMinutes ?? 5,
    cloudwatch: body.cloudwatch ? {
      enabled: body.cloudwatch.enabled ?? true,
      lambdaFunctions: body.cloudwatch.lambdaFunctions ?? [],
      auroraClusterId: body.cloudwatch.auroraClusterId,
    } : undefined,
    xray: body.xray ? {
      enabled: body.xray.enabled ?? true,
      samplingRate: body.xray.samplingRate ?? 0.05,
      filterExpression: body.xray.filterExpression,
      traceRetentionDays: 30,
    } : undefined,
    costExplorer: body.costExplorer ? {
      enabled: body.costExplorer.enabled ?? true,
      anomalyDetection: body.costExplorer.anomalyDetection ?? true,
      forecastEnabled: body.costExplorer.forecastEnabled ?? true,
    } : undefined,
    alerting: body.alerting ? {
      thresholds: body.alerting.thresholds ?? {},
    } : undefined,
  });
  
  return createResponse(200, {
    success: true,
    message: 'Configuration updated',
  });
}

// ============================================================================
// METRICS REFRESH
// ============================================================================

async function refreshMetrics(
  tenantId: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body: RefreshMonitoringRequest = JSON.parse(event.body || '{}');
  
  // Force refresh by getting fresh dashboard
  const dashboard = await awsMonitoringService.getDashboard(tenantId);
  
  return createResponse(200, {
    success: true,
    data: dashboard,
    timestamp: new Date().toISOString(),
    message: 'Metrics refreshed',
  });
}

// ============================================================================
// LAMBDA METRICS
// ============================================================================

async function getLambdaMetrics(
  tenantId: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const config = await awsMonitoringService.getConfig(tenantId);
  
  if (!config?.cloudwatch.enabled) {
    return createResponse(200, {
      success: true,
      data: { functions: [] },
      message: 'CloudWatch monitoring not enabled',
    });
  }
  
  const dashboard = await awsMonitoringService.getDashboard(tenantId);
  
  return createResponse(200, {
    success: true,
    data: {
      functions: dashboard.lambda.functions,
      summary: {
        totalInvocations: dashboard.lambda.totalInvocations,
        totalErrors: dashboard.lambda.totalErrors,
        avgDuration: dashboard.lambda.avgDuration,
        totalCost: dashboard.lambda.totalCost,
      },
    },
  });
}

// ============================================================================
// AURORA METRICS
// ============================================================================

async function getAuroraMetrics(tenantId: string): Promise<APIGatewayProxyResult> {
  const dashboard = await awsMonitoringService.getDashboard(tenantId);
  
  return createResponse(200, {
    success: true,
    data: dashboard.aurora || null,
  });
}

// ============================================================================
// X-RAY
// ============================================================================

async function getXRayData(
  tenantId: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const filterExpression = event.queryStringParameters?.filter;
  
  const summary = await awsMonitoringService.getXRayTraceSummary(filterExpression);
  
  return createResponse(200, {
    success: true,
    data: summary,
  });
}

async function getServiceGraph(tenantId: string): Promise<APIGatewayProxyResult> {
  // Service graph is derived from X-Ray trace data
  // Currently returns null as we use CloudWatch metrics for trace-like data
  return createResponse(200, {
    success: true,
    data: null,
    message: 'Service graph requires X-Ray SDK. Use /xray for trace summary.',
  });
}

// ============================================================================
// COSTS
// ============================================================================

async function getCosts(
  tenantId: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const dashboard = await awsMonitoringService.getDashboard(tenantId);
  
  return createResponse(200, {
    success: true,
    data: dashboard.costs,
  });
}

async function getCostAnomalies(tenantId: string): Promise<APIGatewayProxyResult> {
  const anomalies = await awsMonitoringService.getCostAnomalies();
  
  return createResponse(200, {
    success: true,
    data: anomalies,
  });
}

// ============================================================================
// FREE TIER
// ============================================================================

async function getFreeTierUsage(tenantId: string): Promise<APIGatewayProxyResult> {
  const usage = await awsMonitoringService.getFreeTierUsage(tenantId);
  
  return createResponse(200, {
    success: true,
    data: usage,
  });
}

// ============================================================================
// HEALTH
// ============================================================================

async function getHealthStatus(tenantId: string): Promise<APIGatewayProxyResult> {
  const dashboard = await awsMonitoringService.getDashboard(tenantId);
  
  return createResponse(200, {
    success: true,
    data: dashboard.health,
  });
}

// ============================================================================
// CHARTS (Pre-formatted for visualization)
// ============================================================================

async function getLambdaInvocationsChart(
  tenantId: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const period = event.queryStringParameters?.period || '24h';
  const dashboard = await awsMonitoringService.getDashboard(tenantId);
  
  // Build chart data from Lambda metrics
  const chartData = {
    id: 'lambda-invocations',
    title: 'Lambda Invocations',
    subtitle: `Last ${period}`,
    series: dashboard.lambda.functions.map(fn => ({
      id: fn.functionName,
      name: fn.functionName.replace('radiant-', '').replace(/-/g, ' '),
      type: 'bar' as const,
      data: [
        { x: fn.functionName, y: fn.invocations, label: `${fn.invocations.toLocaleString()} invocations` },
      ],
      color: fn.errors > 0 ? '#ef4444' : '#22c55e',
    })),
    xAxis: { type: 'category' as const, label: 'Function' },
    yAxis: { left: { label: 'Invocations' } },
    overlays: [
      {
        type: 'cost_on_metrics' as const,
        enabled: true,
        opacity: 0.7,
        colorScheme: 'default' as const,
        showLegend: true,
        animateTransitions: true,
      },
    ],
    annotations: dashboard.lambda.functions
      .filter(fn => fn.errors > 0)
      .map(fn => ({
        x: fn.functionName,
        label: `${fn.errors} errors`,
        type: 'point' as const,
      })),
  };
  
  return createResponse(200, {
    success: true,
    data: chartData,
  });
}

async function getCostTrendChart(
  tenantId: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const dashboard = await awsMonitoringService.getDashboard(tenantId);
  
  const chartData = {
    id: 'cost-trend',
    title: 'Cost Trend by Service',
    subtitle: 'Month to date',
    series: [
      {
        id: 'actual',
        name: 'Actual Cost',
        type: 'area' as const,
        data: dashboard.costs.byService.map((svc, i) => ({
          x: svc.service,
          y: svc.cost,
          label: `$${svc.cost.toFixed(2)}`,
        })),
        color: '#3b82f6',
      },
      ...(dashboard.costs.forecast ? [{
        id: 'forecast',
        name: 'Forecast',
        type: 'line' as const,
        data: [
          {
            x: 'End of Month',
            y: dashboard.costs.forecast.estimatedCost,
            label: `$${dashboard.costs.forecast.estimatedCost.toFixed(2)} (forecast)`,
          },
        ],
        color: '#f59e0b',
        overlay: true,
      }] : []),
    ],
    xAxis: { type: 'category' as const, label: 'Service' },
    yAxis: { 
      left: { label: 'Cost (USD)' },
      right: dashboard.costs.forecast ? { label: 'Forecast' } : undefined,
    },
    overlays: [
      {
        type: 'forecast_on_cost' as const,
        enabled: !!dashboard.costs.forecast,
        opacity: 0.5,
        colorScheme: 'default' as const,
        showLegend: true,
        animateTransitions: true,
      },
    ],
  };
  
  return createResponse(200, {
    success: true,
    data: chartData,
  });
}

async function getLatencyDistributionChart(
  tenantId: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const dashboard = await awsMonitoringService.getDashboard(tenantId);
  
  const chartData = {
    id: 'latency-distribution',
    title: 'Latency Distribution',
    subtitle: 'Lambda function durations',
    series: [
      {
        id: 'p50',
        name: 'P50',
        type: 'bar' as const,
        data: dashboard.lambda.functions.map(fn => ({
          x: fn.functionName.replace('radiant-', ''),
          y: fn.duration.p50,
        })),
        color: '#22c55e',
      },
      {
        id: 'p90',
        name: 'P90',
        type: 'bar' as const,
        data: dashboard.lambda.functions.map(fn => ({
          x: fn.functionName.replace('radiant-', ''),
          y: fn.duration.p90,
        })),
        color: '#f59e0b',
      },
      {
        id: 'p99',
        name: 'P99',
        type: 'bar' as const,
        data: dashboard.lambda.functions.map(fn => ({
          x: fn.functionName.replace('radiant-', ''),
          y: fn.duration.p99,
        })),
        color: '#ef4444',
      },
    ],
    xAxis: { type: 'category' as const, label: 'Function' },
    yAxis: { left: { label: 'Duration (ms)' } },
    overlays: [
      {
        type: 'latency_on_traces' as const,
        enabled: true,
        opacity: 0.8,
        colorScheme: 'default' as const,
        showLegend: true,
        animateTransitions: true,
      },
    ],
  };
  
  return createResponse(200, {
    success: true,
    data: chartData,
  });
}

// ============================================================================
// NOTIFICATION TARGETS
// ============================================================================

async function getNotificationTargets(tenantId: string): Promise<APIGatewayProxyResult> {
  const targets = await monitoringNotificationsService.getNotificationTargets(tenantId);
  return createResponse(200, { success: true, data: targets });
}

async function addNotificationTarget(
  tenantId: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { type, value, name } = body;
  
  if (!type || !value || !name) {
    return createErrorResponse(400, 'Missing required fields: type, value, name');
  }
  
  const target = await monitoringNotificationsService.addNotificationTarget(tenantId, type, value, name);
  return createResponse(201, { success: true, data: target });
}

async function updateNotificationTarget(
  tenantId: string,
  targetId: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  await monitoringNotificationsService.updateNotificationTarget(tenantId, targetId, body);
  return createResponse(200, { success: true, message: 'Target updated' });
}

async function deleteNotificationTarget(
  tenantId: string,
  targetId: string
): Promise<APIGatewayProxyResult> {
  await monitoringNotificationsService.deleteNotificationTarget(tenantId, targetId);
  return createResponse(200, { success: true, message: 'Target deleted' });
}

// ============================================================================
// SPEND THRESHOLDS (hourly/daily/weekly/monthly)
// ============================================================================

async function getSpendThresholds(tenantId: string): Promise<APIGatewayProxyResult> {
  const thresholds = await monitoringNotificationsService.getSpendThresholds(tenantId);
  return createResponse(200, { success: true, data: thresholds });
}

async function setSpendThreshold(
  tenantId: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { period, thresholdAmount, warningPercent } = body;
  
  if (!period || thresholdAmount === undefined) {
    return createErrorResponse(400, 'Missing required fields: period, thresholdAmount');
  }
  
  const threshold = await monitoringNotificationsService.setSpendThreshold(
    tenantId, period, thresholdAmount, warningPercent
  );
  return createResponse(201, { success: true, data: threshold });
}

async function updateSpendThreshold(
  tenantId: string,
  thresholdId: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  await monitoringNotificationsService.updateSpendThreshold(tenantId, thresholdId, body);
  return createResponse(200, { success: true, message: 'Threshold updated' });
}

async function deleteSpendThreshold(
  tenantId: string,
  thresholdId: string
): Promise<APIGatewayProxyResult> {
  await monitoringNotificationsService.deleteSpendThreshold(tenantId, thresholdId);
  return createResponse(200, { success: true, message: 'Threshold deleted' });
}

// ============================================================================
// METRIC THRESHOLDS
// ============================================================================

async function getMetricThresholds(tenantId: string): Promise<APIGatewayProxyResult> {
  const thresholds = await monitoringNotificationsService.getMetricThresholds(tenantId);
  return createResponse(200, { success: true, data: thresholds });
}

async function setMetricThreshold(
  tenantId: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { metricType, thresholdValue, comparison } = body;
  
  if (!metricType || thresholdValue === undefined) {
    return createErrorResponse(400, 'Missing required fields: metricType, thresholdValue');
  }
  
  const threshold = await monitoringNotificationsService.setMetricThreshold(
    tenantId, metricType, thresholdValue, comparison
  );
  return createResponse(201, { success: true, data: threshold });
}

// ============================================================================
// SPEND SUMMARY & NOTIFICATIONS
// ============================================================================

async function getSpendSummary(tenantId: string): Promise<APIGatewayProxyResult> {
  const summary = await monitoringNotificationsService.getSpendSummary(tenantId);
  return createResponse(200, { success: true, data: summary });
}

async function getNotificationLog(
  tenantId: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
  const log = await monitoringNotificationsService.getNotificationLog(tenantId, limit);
  return createResponse(200, { success: true, data: log });
}

async function getChargeableStatus(tenantId: string): Promise<APIGatewayProxyResult> {
  const status = await monitoringNotificationsService.checkChargeableScaling(tenantId);
  return createResponse(200, { success: true, data: status });
}

async function checkAndNotify(tenantId: string): Promise<APIGatewayProxyResult> {
  await monitoringNotificationsService.checkAndNotifyThresholds(tenantId);
  return createResponse(200, { success: true, message: 'Threshold check completed' });
}

// ============================================================================
// FREE TIER SETTINGS (Admin toggles for paid tier)
// ============================================================================

async function getFreeTierSettings(tenantId: string): Promise<APIGatewayProxyResult> {
  const settings = await monitoringNotificationsService.getFreeTierSettings(tenantId);
  
  // If no settings exist yet, initialize them (all services default to free tier ON)
  if (settings.length === 0) {
    const initialized = await monitoringNotificationsService.initializeFreeTierSettingsForTenant(tenantId);
    return createResponse(200, { success: true, data: initialized });
  }
  
  return createResponse(200, { success: true, data: settings });
}

async function toggleServicePaidTier(
  tenantId: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { service, enabled, maxBudget } = body;
  
  if (!service || enabled === undefined) {
    return createErrorResponse(400, 'Missing required fields: service, enabled');
  }
  
  // Get admin email from auth context for audit trail
  const adminEmail = event.requestContext.authorizer?.email || 'unknown';
  
  const setting = await monitoringNotificationsService.togglePaidTier(
    tenantId, service, enabled, adminEmail, maxBudget
  );
  
  return createResponse(200, { 
    success: true, 
    data: setting,
    message: enabled 
      ? `Paid tier enabled for ${service}. Charges may apply beyond free tier limits.`
      : `Paid tier disabled for ${service}. Service will be limited to free tier.`
  });
}

async function setServiceAutoScale(
  tenantId: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { service, autoScale } = body;
  
  if (!service || autoScale === undefined) {
    return createErrorResponse(400, 'Missing required fields: service, autoScale');
  }
  
  const setting = await monitoringNotificationsService.setAutoScaleToPaid(
    tenantId, service, autoScale
  );
  
  return createResponse(200, { 
    success: true, 
    data: setting,
    message: autoScale 
      ? `Auto-scale to paid tier enabled for ${service}. Service will automatically upgrade when free tier is exceeded.`
      : `Auto-scale disabled for ${service}. Service will stop at free tier limits.`
  });
}

async function setServiceBudgetCap(
  tenantId: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { service, maxBudget } = body;
  
  if (!service) {
    return createErrorResponse(400, 'Missing required field: service');
  }
  
  const setting = await monitoringNotificationsService.setBudgetCap(
    tenantId, service, maxBudget ?? null
  );
  
  return createResponse(200, { 
    success: true, 
    data: setting,
    message: maxBudget 
      ? `Budget cap set to $${maxBudget} for ${service}.`
      : `Budget cap removed for ${service}.`
  });
}
