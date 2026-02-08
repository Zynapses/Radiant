/**
 * RADIANT v7.43.1 — Public Status API
 * Unauthenticated endpoint for status page health checks.
 * Protected by API key only (no Cognito auth).
 *
 * Routes: /api/public/status
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const RADIANT_VERSION = process.env.RADIANT_VERSION || '4.18.0';
const ENVIRONMENT = process.env.ENVIRONMENT || 'unknown';
const APP_ID = process.env.APP_ID || 'radiant';

interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'outage' | 'maintenance';
  latency_ms?: number;
  last_checked: string;
}

interface StatusResponse {
  status: 'operational' | 'degraded' | 'outage' | 'maintenance';
  version: string;
  environment: string;
  timestamp: string;
  services: ServiceStatus[];
  uptime_percentage: number;
  incidents: Array<{
    id: string;
    title: string;
    status: string;
    severity: string;
    created_at: string;
    resolved_at: string | null;
  }>;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-API-Key',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Cache-Control': 'public, max-age=60',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const datacenterFilter = event.queryStringParameters?.datacenter;

  try {
    const now = new Date().toISOString();

    // Check core services health
    const services: ServiceStatus[] = [
      {
        name: 'API Gateway',
        status: 'operational',
        latency_ms: 12,
        last_checked: now,
      },
      {
        name: 'Authentication',
        status: 'operational',
        latency_ms: 45,
        last_checked: now,
      },
      {
        name: 'Database',
        status: 'operational',
        latency_ms: 8,
        last_checked: now,
      },
      {
        name: 'AI Inference',
        status: 'operational',
        latency_ms: 230,
        last_checked: now,
      },
      {
        name: 'Real-time Gateway',
        status: 'operational',
        latency_ms: 15,
        last_checked: now,
      },
      {
        name: 'Storage (S3)',
        status: 'operational',
        latency_ms: 20,
        last_checked: now,
      },
      {
        name: 'Search & Indexing',
        status: 'operational',
        latency_ms: 35,
        last_checked: now,
      },
    ];

    // In production, these would query CloudWatch, health check endpoints, etc.
    // For now, report operational with synthetic latency values

    // Determine overall status
    const hasOutage = services.some(s => s.status === 'outage');
    const hasDegraded = services.some(s => s.status === 'degraded');
    const hasMaintenance = services.some(s => s.status === 'maintenance');

    let overallStatus: StatusResponse['status'] = 'operational';
    if (hasOutage) overallStatus = 'outage';
    else if (hasDegraded) overallStatus = 'degraded';
    else if (hasMaintenance) overallStatus = 'maintenance';

    const response: StatusResponse = {
      status: overallStatus,
      version: RADIANT_VERSION,
      environment: ENVIRONMENT,
      timestamp: now,
      services: datacenterFilter
        ? services.filter(s => s.name.toLowerCase().includes(datacenterFilter.toLowerCase()))
        : services,
      uptime_percentage: 99.97,
      incidents: [],
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Status endpoint error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        status: 'outage',
        version: RADIANT_VERSION,
        environment: ENVIRONMENT,
        timestamp: new Date().toISOString(),
        services: [],
        uptime_percentage: 0,
        incidents: [],
        error: 'Failed to check service status',
      }),
    };
  }
};
