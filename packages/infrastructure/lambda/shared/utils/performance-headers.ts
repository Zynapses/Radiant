// RADIANT v4.18.3 - Performance Headers Utility
// Adds X-Radiant-* headers to API responses for debugging and optimization

import type { RouterPerformanceMetrics } from '../services/agi-brain-planner.service';

export interface PerformanceHeaders {
  'X-Radiant-Router-Latency': string;
  'X-Radiant-Domain-Detection-Ms': string;
  'X-Radiant-Model-Selection-Ms': string;
  'X-Radiant-Plan-Generation-Ms': string;
  'X-Radiant-Cost-Cents': string;
  'X-Radiant-Model-Cost-Per-1k': string;
  'X-Radiant-Cache-Hit': string;
}

/**
 * Convert RouterPerformanceMetrics to HTTP headers
 */
export function getPerformanceHeaders(metrics: RouterPerformanceMetrics): PerformanceHeaders {
  return {
    'X-Radiant-Router-Latency': String(metrics.routerLatencyMs),
    'X-Radiant-Domain-Detection-Ms': String(metrics.domainDetectionMs),
    'X-Radiant-Model-Selection-Ms': String(metrics.modelSelectionMs),
    'X-Radiant-Plan-Generation-Ms': String(metrics.planGenerationMs),
    'X-Radiant-Cost-Cents': String(metrics.estimatedCostCents.toFixed(4)),
    'X-Radiant-Model-Cost-Per-1k': String(metrics.modelCostPer1kTokens.toFixed(6)),
    'X-Radiant-Cache-Hit': metrics.cacheHit ? 'true' : 'false',
  };
}

/**
 * Add performance headers to an existing headers object
 */
export function addPerformanceHeaders(
  existingHeaders: Record<string, string>,
  metrics: RouterPerformanceMetrics
): Record<string, string> {
  return {
    ...existingHeaders,
    ...getPerformanceHeaders(metrics),
  };
}

/**
 * Create a standard API response with performance headers
 */
export function createResponseWithMetrics<T>(
  statusCode: number,
  body: T,
  metrics: RouterPerformanceMetrics,
  additionalHeaders?: Record<string, string>
): {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
} {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': Object.keys(getPerformanceHeaders(metrics)).join(', '),
      ...getPerformanceHeaders(metrics),
      ...additionalHeaders,
    },
    body: JSON.stringify(body),
  };
}
