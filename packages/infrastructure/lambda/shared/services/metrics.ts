/**
 * Metrics Collection Service
 * 
 * Collects and publishes custom metrics to CloudWatch
 */

import { CloudWatchClient, PutMetricDataCommand, StandardUnit, Dimension } from '@aws-sdk/client-cloudwatch';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

const cloudwatch = new CloudWatchClient({});
const NAMESPACE = process.env.METRICS_NAMESPACE || 'Radiant';
const ENVIRONMENT = process.env.ENVIRONMENT || 'development';

// Batch metrics for efficiency
const metricBuffer: MetricData[] = [];
const BUFFER_SIZE = 20;
const FLUSH_INTERVAL = 10000; // 10 seconds

interface MetricData {
  name: string;
  value: number;
  unit: StandardUnit;
  dimensions: Dimension[];
  timestamp: Date;
}

/**
 * Record a counter metric
 */
export function incrementCounter(
  name: string,
  value: number = 1,
  dimensions?: Record<string, string>
): void {
  addMetric(name, value, StandardUnit.Count, dimensions);
}

/**
 * Record a gauge metric
 */
export function recordGauge(
  name: string,
  value: number,
  dimensions?: Record<string, string>
): void {
  addMetric(name, value, StandardUnit.None, dimensions);
}

/**
 * Record a timing metric (in milliseconds)
 */
export function recordTiming(
  name: string,
  durationMs: number,
  dimensions?: Record<string, string>
): void {
  addMetric(name, durationMs, StandardUnit.Milliseconds, dimensions);
}

/**
 * Record a size metric (in bytes)
 */
export function recordSize(
  name: string,
  bytes: number,
  dimensions?: Record<string, string>
): void {
  addMetric(name, bytes, StandardUnit.Bytes, dimensions);
}

/**
 * Time an async operation
 */
export async function timeAsync<T>(
  name: string,
  fn: () => Promise<T>,
  dimensions?: Record<string, string>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    recordTiming(name, Date.now() - start, { ...dimensions, status: 'success' });
    return result;
  } catch (error) {
    recordTiming(name, Date.now() - start, { ...dimensions, status: 'error' });
    throw error;
  }
}

/**
 * Add a metric to the buffer
 */
function addMetric(
  name: string,
  value: number,
  unit: StandardUnit,
  dimensions?: Record<string, string>
): void {
  const dims: Dimension[] = [
    { Name: 'Environment', Value: ENVIRONMENT },
  ];

  if (dimensions) {
    for (const [key, val] of Object.entries(dimensions)) {
      dims.push({ Name: key, Value: val });
    }
  }

  metricBuffer.push({
    name,
    value,
    unit,
    dimensions: dims,
    timestamp: new Date(),
  });

  // Flush if buffer is full
  if (metricBuffer.length >= BUFFER_SIZE) {
    flushMetrics().catch(err => logger.error('Failed to auto-flush metrics', err));
  }
}

/**
 * Flush metrics to CloudWatch
 */
export async function flushMetrics(): Promise<void> {
  if (metricBuffer.length === 0) return;

  const metrics = metricBuffer.splice(0, metricBuffer.length);

  try {
    await cloudwatch.send(new PutMetricDataCommand({
      Namespace: NAMESPACE,
      MetricData: metrics.map(m => ({
        MetricName: m.name,
        Value: m.value,
        Unit: m.unit,
        Dimensions: m.dimensions,
        Timestamp: m.timestamp,
      })),
    }));
  } catch (error) {
    logger.error('Failed to publish metrics', error);
    // Re-add failed metrics to buffer (with limit)
    if (metricBuffer.length < BUFFER_SIZE * 2) {
      metricBuffer.push(...metrics);
    }
  }
}

// ============================================================================
// Pre-defined Metrics
// ============================================================================

export const Metrics = {
  // API Metrics
  apiRequest: (endpoint: string, method: string, statusCode: number) => {
    incrementCounter('APIRequests', 1, { endpoint, method, statusCode: String(statusCode) });
  },

  apiLatency: (endpoint: string, method: string, durationMs: number) => {
    recordTiming('APILatency', durationMs, { endpoint, method });
  },

  apiError: (endpoint: string, errorCode: string) => {
    incrementCounter('APIErrors', 1, { endpoint, errorCode });
  },

  // AI Metrics
  aiRequest: (model: string, provider: string) => {
    incrementCounter('AIRequests', 1, { model, provider });
  },

  aiTokens: (model: string, promptTokens: number, completionTokens: number) => {
    recordGauge('AIPromptTokens', promptTokens, { model });
    recordGauge('AICompletionTokens', completionTokens, { model });
  },

  aiLatency: (model: string, durationMs: number) => {
    recordTiming('AILatency', durationMs, { model });
  },

  aiError: (model: string, errorType: string) => {
    incrementCounter('AIErrors', 1, { model, errorType });
  },

  // Billing Metrics
  billingCreditsUsed: (tenantId: string, amount: number) => {
    recordGauge('CreditsUsed', amount, { tenantId });
  },

  billingLowBalance: (tenantId: string, balance: number) => {
    recordGauge('LowBalance', balance, { tenantId });
  },

  // Rate Limiting Metrics
  rateLimitHit: (tenantId: string, endpoint: string) => {
    incrementCounter('RateLimitHits', 1, { tenantId, endpoint });
  },

  // Batch Processing Metrics
  batchJobStarted: (jobType: string) => {
    incrementCounter('BatchJobsStarted', 1, { jobType });
  },

  batchJobCompleted: (jobType: string, itemCount: number, durationMs: number) => {
    incrementCounter('BatchJobsCompleted', 1, { jobType });
    recordGauge('BatchJobItems', itemCount, { jobType });
    recordTiming('BatchJobDuration', durationMs, { jobType });
  },

  batchJobFailed: (jobType: string, errorType: string) => {
    incrementCounter('BatchJobsFailed', 1, { jobType, errorType });
  },

  // Webhook Metrics
  webhookDelivery: (eventType: string, success: boolean) => {
    incrementCounter('WebhookDeliveries', 1, { eventType, success: String(success) });
  },

  webhookLatency: (eventType: string, durationMs: number) => {
    recordTiming('WebhookLatency', durationMs, { eventType });
  },

  // Cache Metrics
  cacheHit: (cacheType: string) => {
    incrementCounter('CacheHits', 1, { cacheType });
  },

  cacheMiss: (cacheType: string) => {
    incrementCounter('CacheMisses', 1, { cacheType });
  },

  // Authentication Metrics
  authSuccess: (method: string) => {
    incrementCounter('AuthSuccess', 1, { method });
  },

  authFailure: (method: string, reason: string) => {
    incrementCounter('AuthFailures', 1, { method, reason });
  },
};

// ============================================================================
// Lambda-safe flush management
// ============================================================================

/**
 * Flush metrics at the end of Lambda execution.
 * Call this in your handler's finally block or use withMetricsFlush wrapper.
 * Avoids global setInterval which is problematic in Lambda environments.
 */
export async function ensureMetricsFlushed(): Promise<void> {
  await flushMetrics();
}

/**
 * Wrapper for Lambda handlers that ensures metrics are flushed
 */
export function withMetricsFlush<TEvent, TResult>(
  handler: (event: TEvent) => Promise<TResult>
): (event: TEvent) => Promise<TResult> {
  return async (event: TEvent) => {
    try {
      return await handler(event);
    } finally {
      await flushMetrics().catch(err => {
        // Log but don't throw - metrics flush failure shouldn't break the handler
        logger.error('Failed to flush metrics', err);
      });
    }
  };
}
