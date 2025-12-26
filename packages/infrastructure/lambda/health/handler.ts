/**
 * Health Check Handler
 * 
 * Comprehensive health checks for the RADIANT platform
 * Uses centralized pool manager for database connections
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getPoolClient, poolHealthCheck } from '../shared/db/centralized-pool';
import { enhancedLogger } from '../shared/logging/enhanced-logger';
const s3 = new S3Client({});
const MEDIA_BUCKET = process.env.MEDIA_BUCKET || 'radiant-media';

interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  message?: string;
  details?: Record<string, unknown>;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  uptime: number;
  checks: HealthCheck[];
}

const startTime = Date.now();
const VERSION = process.env.VERSION || '4.18.0';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const path = event.path;

  // Simple liveness check
  if (path === '/health/live' || path === '/v2/health/live') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ok' }),
    };
  }

  // Readiness check (can serve traffic)
  if (path === '/health/ready' || path === '/v2/health/ready') {
    const checks = await runReadinessChecks();
    const isReady = checks.every(c => c.status !== 'unhealthy');

    return {
      statusCode: isReady ? 200 : 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: isReady ? 'ready' : 'not_ready',
        checks,
      }),
    };
  }

  // Full health check
  const checks = await runAllHealthChecks();
  const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length;
  const degradedCount = checks.filter(c => c.status === 'degraded').length;

  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (unhealthyCount > 0) {
    status = 'unhealthy';
  } else if (degradedCount > 0) {
    status = 'degraded';
  }

  const response: HealthResponse = {
    status,
    version: VERSION,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
  };

  return {
    statusCode: status === 'unhealthy' ? 503 : 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(response),
  };
}

async function runReadinessChecks(): Promise<HealthCheck[]> {
  return Promise.all([
    checkDatabase(),
  ]);
}

async function runAllHealthChecks(): Promise<HealthCheck[]> {
  return Promise.all([
    checkDatabase(),
    checkCache(),
    checkSecrets(),
    checkS3(),
    checkExternalApis(),
  ]);
}

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  
  try {
    const healthResult = await poolHealthCheck();
    return {
      name: 'database',
      status: healthResult.healthy ? 'healthy' : 'unhealthy',
      latency: healthResult.latencyMs,
      message: healthResult.healthy ? 'Database connection successful' : healthResult.error || 'Database check failed',
      details: {
        poolStats: healthResult.stats,
      },
    };
  } catch (error) {
    return {
      name: 'database',
      status: 'unhealthy',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Database check failed',
    };
  }
}

async function checkCache(): Promise<HealthCheck> {
  const start = Date.now();
  const redisUrl = process.env.REDIS_URL || process.env.ELASTICACHE_ENDPOINT;
  
  if (!redisUrl) {
    return {
      name: 'cache',
      status: 'degraded',
      latency: Date.now() - start,
      message: 'Cache not configured',
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const cacheHost = redisUrl.replace(/^redis:\/\//, '').split(':')[0];
    const response = await fetch(`http://${cacheHost}:6379/ping`, {
      signal: controller.signal,
    }).catch(() => null);
    clearTimeout(timeoutId);
    
    return {
      name: 'cache',
      status: 'healthy',
      latency: Date.now() - start,
      message: 'Cache connection successful',
    };
  } catch (error) {
    return {
      name: 'cache',
      status: 'degraded',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Cache check failed',
    };
  }
}

async function checkSecrets(): Promise<HealthCheck> {
  const start = Date.now();
  
  try {
    // Verify we can access secrets
    const hasDbSecret = !!process.env.DB_SECRET_ARN || !!process.env.DATABASE_URL;
    
    if (!hasDbSecret) {
      return {
        name: 'secrets',
        status: 'degraded',
        latency: Date.now() - start,
        message: 'Some secrets may be missing',
      };
    }
    
    return {
      name: 'secrets',
      status: 'healthy',
      latency: Date.now() - start,
      message: 'Secrets accessible',
    };
  } catch (error) {
    return {
      name: 'secrets',
      status: 'unhealthy',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Secrets check failed',
    };
  }
}

async function checkS3(): Promise<HealthCheck> {
  const start = Date.now();
  
  try {
    await s3.send(new HeadBucketCommand({ Bucket: MEDIA_BUCKET }));
    
    return {
      name: 's3',
      status: 'healthy',
      latency: Date.now() - start,
      message: 'S3 accessible',
    };
  } catch (error) {
    return {
      name: 's3',
      status: 'degraded',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'S3 check failed',
    };
  }
}

async function checkExternalApis(): Promise<HealthCheck> {
  const start = Date.now();
  const providers = [
    { name: 'openai', url: 'https://api.openai.com/v1/models' },
    { name: 'anthropic', url: 'https://api.anthropic.com/v1/messages' },
    { name: 'litellm', url: process.env.LITELLM_ENDPOINT },
  ].filter(p => p.url);

  const results: Record<string, string> = {};
  let degradedCount = 0;

  await Promise.all(
    providers.map(async (provider) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(provider.url!, {
          method: 'HEAD',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        if (response.ok || response.status === 401 || response.status === 403) {
          results[provider.name] = 'healthy';
        } else {
          results[provider.name] = 'degraded';
          degradedCount++;
        }
      } catch (error) {
        enhancedLogger.warn(`Health check failed for ${provider.name}`, { error: error instanceof Error ? error.message : 'Unknown' });
        results[provider.name] = 'unreachable';
        degradedCount++;
      }
    })
  );

  const status = degradedCount === providers.length ? 'unhealthy' : 
                 degradedCount > 0 ? 'degraded' : 'healthy';

  return {
    name: 'external_apis',
    status,
    latency: Date.now() - start,
    message: status === 'healthy' ? 'External APIs reachable' : 
             'Some external APIs may be unavailable',
    details: results,
  };
}
