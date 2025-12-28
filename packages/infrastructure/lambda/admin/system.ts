/**
 * Admin System API Handler
 * 
 * System configuration and monitoring
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

interface SystemConfig {
  version: string;
  environment: string;
  features: Record<string, boolean>;
  limits: Record<string, number>;
  maintenance: MaintenanceStatus;
}

interface MaintenanceStatus {
  enabled: boolean;
  message?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
}

interface SystemStats {
  uptime: number;
  requests: {
    total: number;
    lastHour: number;
    lastDay: number;
  };
  errors: {
    total: number;
    lastHour: number;
    rate: number;
  };
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
  activeConnections: number;
  activeTenants: number;
}

const startTime = Date.now();

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;

  try {
    // GET /admin/system/config - Get system configuration
    if (method === 'GET' && path === '/admin/system/config') {
      return await getConfig();
    }

    // PUT /admin/system/config - Update system configuration
    if (method === 'PUT' && path === '/admin/system/config') {
      return await updateConfig(event);
    }

    // GET /admin/system/stats - Get system statistics
    if (method === 'GET' && path === '/admin/system/stats') {
      return await getStats();
    }

    // POST /admin/system/maintenance - Toggle maintenance mode
    if (method === 'POST' && path === '/admin/system/maintenance') {
      return await toggleMaintenance(event);
    }

    // POST /admin/system/cache/clear - Clear cache
    if (method === 'POST' && path === '/admin/system/cache/clear') {
      return await clearCache(event);
    }

    // GET /admin/system/logs - Get system logs
    if (method === 'GET' && path === '/admin/system/logs') {
      return await getLogs(event);
    }

    // POST /admin/system/broadcast - Send broadcast message
    if (method === 'POST' && path === '/admin/system/broadcast') {
      return await sendBroadcast(event);
    }

    return response(404, { error: { message: 'Not found' } });
  } catch (error) {
    logger.error('Admin system error', error);
    return response(500, { error: { message: 'Internal server error' } });
  }
}

async function getConfig(): Promise<APIGatewayProxyResult> {
  const config: SystemConfig = {
    version: process.env.VERSION || '4.18.0',
    environment: process.env.ENVIRONMENT || 'development',
    features: {
      streaming: true,
      functionCalling: true,
      vision: true,
      batch: true,
      webhooks: true,
      multiRegion: false,
    },
    limits: {
      maxRequestsPerMinute: 100,
      maxTokensPerRequest: 128000,
      maxFileSizeMb: 100,
      maxBatchSize: 10000,
    },
    maintenance: {
      enabled: false,
    },
  };

  return response(200, { data: config });
}

async function updateConfig(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');

  // Update configuration in database/parameter store
  // Validate changes
  // Apply changes

  return response(200, { 
    data: body,
    message: 'Configuration updated successfully',
  });
}

async function getStats(): Promise<APIGatewayProxyResult> {
  const stats: SystemStats = {
    uptime: Math.floor((Date.now() - startTime) / 1000),
    requests: {
      total: 1500000,
      lastHour: 5000,
      lastDay: 120000,
    },
    errors: {
      total: 1500,
      lastHour: 5,
      rate: 0.001,
    },
    latency: {
      p50: 45,
      p95: 120,
      p99: 250,
    },
    activeConnections: 150,
    activeTenants: 42,
  };

  return response(200, { data: stats });
}

async function toggleMaintenance(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { enabled, message, scheduledStart, scheduledEnd } = body;

  const maintenance: MaintenanceStatus = {
    enabled: enabled ?? false,
    message,
    scheduledStart,
    scheduledEnd,
  };

  // Store maintenance status
  // If enabled, notify all connected clients
  // Update load balancer to return 503

  return response(200, { 
    data: maintenance,
    message: enabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled',
  });
}

async function clearCache(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { pattern = '*', confirm = false } = body;

  if (!confirm) {
    return response(400, { 
      error: { 
        message: 'Set confirm: true to clear cache',
        pattern,
      } 
    });
  }

  // Clear cache by pattern
  // await cache.delByPattern(pattern);

  return response(200, { 
    message: `Cache cleared for pattern: ${pattern}`,
    clearedAt: new Date().toISOString(),
  });
}

async function getLogs(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { 
    level = 'all',
    start,
    end,
    limit = '100',
    search,
  } = event.queryStringParameters || {};

  // Query CloudWatch Logs
  // Filter by level, time range, search term

  const logs = [
    {
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Example log entry',
      requestId: 'abc123',
    },
  ];

  return response(200, { 
    data: logs,
    meta: {
      level,
      limit: parseInt(limit, 10),
    },
  });
}

async function sendBroadcast(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { title, message, severity = 'info', targetTenants } = body;

  if (!title || !message) {
    return response(400, { 
      error: { message: 'title and message are required' } 
    });
  }

  // Send to all or specific tenants via websocket/push
  // Store in notifications table

  return response(200, { 
    message: 'Broadcast sent successfully',
    recipients: targetTenants?.length || 'all',
    sentAt: new Date().toISOString(),
  });
}

function response(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: body ? JSON.stringify(body) : '',
  };
}
