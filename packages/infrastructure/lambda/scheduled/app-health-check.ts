/**
 * RADIANT v5.0 - App Health Check Lambda
 * 
 * Scheduled: Every hour
 * Purpose: Check health of top apps by usage, update status, log results
 */

import { ScheduledHandler } from 'aws-lambda';
import { executeStatement, stringParam, longParam } from '../shared/db/client';
import { enhancedLogger } from '../shared/logging/enhanced-logger';

const logger = enhancedLogger;

interface HealthCheckResult {
  appId: string;
  appName: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  responseTimeMs: number;
  errorMessage?: string;
  checkedEndpoint?: string;
}

export const handler: ScheduledHandler = async (_event): Promise<void> => {
  logger.info('Starting app health check');

  try {
    // Get top 100 apps by usage
    const appsResult = await executeStatement(
      `SELECT id, name, display_name, health_check_url, health_check_method, health_check_headers
       FROM apps 
       WHERE is_active = true AND health_check_url IS NOT NULL
       ORDER BY usage_count_30d DESC NULLS LAST
       LIMIT 100`,
      []
    );

    const apps = appsResult.rows || [];
    logger.info(`Checking ${apps.length} apps`);

    const results: HealthCheckResult[] = [];
    let healthyCount = 0;
    let degradedCount = 0;
    let unhealthyCount = 0;

    for (const app of apps) {
      const appId = app.id as string;
      const appName = app.name as string;
      const healthCheckUrl = app.health_check_url as string;
      const method = (app.health_check_method as string) || 'GET';
      const headers = parseHeaders(app.health_check_headers);

      const result = await checkAppHealth(appId, appName, healthCheckUrl, method, headers);
      results.push(result);

      switch (result.status) {
        case 'healthy':
          healthyCount++;
          break;
        case 'degraded':
          degradedCount++;
          break;
        case 'unhealthy':
          unhealthyCount++;
          break;
      }

      // Update app health status
      await updateAppHealthStatus(appId, result);

      // Log health check
      await logHealthCheck(appId, result);
    }

    logger.info('App health check completed', {
      total: apps.length,
      healthy: healthyCount,
      degraded: degradedCount,
      unhealthy: unhealthyCount,
    });
  } catch (error: any) {
    logger.error('App health check failed', { error: error.message });
    throw error;
  }
};

async function checkAppHealth(
  appId: string,
  appName: string,
  url: string,
  method: string,
  headers: Record<string, string>
): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(url, {
      method,
      headers: {
        'User-Agent': 'RADIANT-HealthCheck/1.0',
        ...headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTimeMs = Date.now() - startTime;

    if (response.ok) {
      return {
        appId,
        appName,
        status: responseTimeMs > 5000 ? 'degraded' : 'healthy',
        responseTimeMs,
        checkedEndpoint: url,
      };
    } else {
      return {
        appId,
        appName,
        status: response.status >= 500 ? 'unhealthy' : 'degraded',
        responseTimeMs,
        errorMessage: `HTTP ${response.status}: ${response.statusText}`,
        checkedEndpoint: url,
      };
    }
  } catch (error: any) {
    const responseTimeMs = Date.now() - startTime;
    return {
      appId,
      appName,
      status: 'unhealthy',
      responseTimeMs,
      errorMessage: error.name === 'AbortError' ? 'Request timed out' : error.message,
      checkedEndpoint: url,
    };
  }
}

async function updateAppHealthStatus(appId: string, result: HealthCheckResult): Promise<void> {
  await executeStatement(
    `UPDATE apps SET 
       health_status = :status::app_health_status,
       last_health_check = NOW(),
       last_health_check_response_ms = :responseMs,
       last_health_check_error = :error
     WHERE id = :appId`,
    [
      stringParam('appId', appId),
      stringParam('status', result.status),
      longParam('responseMs', result.responseTimeMs),
      stringParam('error', result.errorMessage || ''),
    ]
  );
}

async function logHealthCheck(appId: string, result: HealthCheckResult): Promise<void> {
  await executeStatement(
    `INSERT INTO app_health_checks (app_id, status, response_time_ms, error_message, checked_endpoint)
     VALUES (:appId, :status::app_health_status, :responseMs, :error, :endpoint)`,
    [
      stringParam('appId', appId),
      stringParam('status', result.status),
      longParam('responseMs', result.responseTimeMs),
      stringParam('error', result.errorMessage || ''),
      stringParam('endpoint', result.checkedEndpoint || ''),
    ]
  );
}

function parseHeaders(headersJson: unknown): Record<string, string> {
  if (!headersJson) return {};
  if (typeof headersJson === 'string') {
    try {
      return JSON.parse(headersJson);
    } catch {
      return {};
    }
  }
  return {};
}
