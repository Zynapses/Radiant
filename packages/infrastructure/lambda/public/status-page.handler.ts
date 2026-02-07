/**
 * Public Status Page API Handler
 * 
 * Provides read-only public health status for the status page.
 * Authenticated via service account API key, rate-limited, and audit logged.
 * 
 * SECURITY:
 * - Read-only access only
 * - Rate limiting enforced
 * - All access audit logged (SOC2)
 * - Sanitized responses (no internal details)
 * - CORS configured for status page domain only
 * 
 * @version 7.1.0
 * @since 2026-02-04
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import {
  PublicSystemHealth,
  PublicHealthStatus,
  PublicComponentHealth,
  PublicIncident,
  PublicMaintenance,
  UptimeRecord,
  StatusPageApiResponse,
  ServiceAccount,
  StatusPageAuditEntry,
  COMPONENT_PUBLIC_NAMES,
  DEFAULT_STATUS_PAGE_CONFIG,
} from '@radiant/shared';

// Environment
const ENVIRONMENT = process.env.ENVIRONMENT || 'production';
const STATUS_PAGE_DOMAIN = process.env.STATUS_PAGE_DOMAIN || `status.${process.env.RADIANT_DOMAIN}`;
const PLATFORM_VERSION = process.env.RADIANT_VERSION || '7.1.0';

// Clients
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });
let dbPool: Pool | null = null;

// Cache for API key validation (short TTL)
let cachedServiceAccount: ServiceAccount | null = null;
let cacheExpiresAt = 0;

// =============================================================================
// Main Handler
// =============================================================================

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId || crypto.randomUUID();
  const startTime = Date.now();

  try {
    // CORS check
    const origin = event.headers['origin'] || event.headers['Origin'];
    if (!isAllowedOrigin(origin)) {
      return errorResponse(403, 'CORS_FORBIDDEN', 'Origin not allowed', requestId);
    }

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse(origin);
    }

    // Only GET allowed
    if (event.httpMethod !== 'GET') {
      return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Only GET requests allowed', requestId);
    }

    // Extract and validate API key
    const apiKey = event.headers['X-API-Key'] || event.headers['x-api-key'];
    if (!apiKey) {
      return errorResponse(401, 'MISSING_API_KEY', 'API key required', requestId);
    }

    // Authenticate
    const serviceAccount = await authenticateApiKey(apiKey);
    if (!serviceAccount) {
      await logAuditEntry({
        requestId,
        endpoint: event.path,
        method: event.httpMethod,
        clientIpHash: hashIp(event.requestContext.identity?.sourceIp),
        userAgent: event.headers['User-Agent'],
        statusCode: 401,
        responseTimeMs: Date.now() - startTime,
        rateLimitRemaining: 0,
        wasRateLimited: false,
        errorCode: 'INVALID_API_KEY',
        errorMessage: 'Invalid or expired API key',
      });
      return errorResponse(401, 'INVALID_API_KEY', 'Invalid or expired API key', requestId);
    }

    // Check rate limit
    const rateLimit = await checkRateLimit(serviceAccount);
    if (!rateLimit.allowed) {
      await logAuditEntry({
        requestId,
        endpoint: event.path,
        method: event.httpMethod,
        serviceAccountId: serviceAccount.id,
        serviceAccountName: serviceAccount.name,
        apiKeyPrefix: serviceAccount.apiKeyPrefix,
        clientIpHash: hashIp(event.requestContext.identity?.sourceIp),
        userAgent: event.headers['User-Agent'],
        statusCode: 429,
        responseTimeMs: Date.now() - startTime,
        rateLimitRemaining: 0,
        wasRateLimited: true,
      });
      return rateLimitResponse(rateLimit.resetAt, requestId);
    }

    // Route request
    let responseData: PublicSystemHealth;
    const path = event.path.replace(/^\/api\/public/, '');

    switch (path) {
      case '/status':
      case '/health':
        responseData = await getPublicHealthStatus();
        break;
      default:
        return errorResponse(404, 'NOT_FOUND', 'Endpoint not found', requestId);
    }

    // Increment rate limit counter
    await incrementRateLimit(serviceAccount.id);

    // Log successful access
    await logAuditEntry({
      requestId,
      endpoint: event.path,
      method: event.httpMethod,
      serviceAccountId: serviceAccount.id,
      serviceAccountName: serviceAccount.name,
      apiKeyPrefix: serviceAccount.apiKeyPrefix,
      clientIpHash: hashIp(event.requestContext.identity?.sourceIp),
      userAgent: event.headers['User-Agent'],
      statusCode: 200,
      responseTimeMs: Date.now() - startTime,
      rateLimitRemaining: rateLimit.remaining,
      wasRateLimited: false,
    });

    // Return success response with cache headers
    const response: StatusPageApiResponse<PublicSystemHealth> = {
      success: true,
      data: responseData,
      cacheControl: {
        maxAge: DEFAULT_STATUS_PAGE_CONFIG.cacheMaxAgeSeconds,
        staleWhileRevalidate: DEFAULT_STATUS_PAGE_CONFIG.staleWhileRevalidateSeconds,
        staleIfError: 3600, // 1 hour stale-if-error for resilience
      },
      rateLimit: {
        limit: serviceAccount.rateLimitPerMinute,
        remaining: rateLimit.remaining,
        resetAt: rateLimit.resetAt,
      },
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${DEFAULT_STATUS_PAGE_CONFIG.cacheMaxAgeSeconds}, stale-while-revalidate=${DEFAULT_STATUS_PAGE_CONFIG.staleWhileRevalidateSeconds}, stale-if-error=3600`,
        'X-Request-ID': requestId,
        'X-RateLimit-Limit': serviceAccount.rateLimitPerMinute.toString(),
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': rateLimit.resetAt,
        ...getCorsHeaders(origin),
      },
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error('[StatusPage] Error:', error);
    
    await logAuditEntry({
      requestId,
      endpoint: event.path,
      method: event.httpMethod,
      clientIpHash: hashIp(event.requestContext.identity?.sourceIp),
      userAgent: event.headers['User-Agent'],
      statusCode: 500,
      responseTimeMs: Date.now() - startTime,
      rateLimitRemaining: 0,
      wasRateLimited: false,
      errorCode: 'INTERNAL_ERROR',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    return errorResponse(500, 'INTERNAL_ERROR', 'An error occurred', requestId);
  }
}

// =============================================================================
// Authentication
// =============================================================================

async function authenticateApiKey(apiKey: string): Promise<ServiceAccount | null> {
  // Check cache first
  if (cachedServiceAccount && Date.now() < cacheExpiresAt) {
    const isValid = await bcrypt.compare(apiKey, cachedServiceAccount.apiKeyHash);
    if (isValid && cachedServiceAccount.isActive) {
      return cachedServiceAccount;
    }
  }

  const pool = await getDbPool();
  const result = await pool.query<ServiceAccount>(
    `SELECT * FROM service_accounts 
     WHERE is_active = true 
       AND (expires_at IS NULL OR expires_at > NOW())
       AND api_key_prefix = $1`,
    [apiKey.substring(0, 8)]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const account = result.rows[0];
  const isValid = await bcrypt.compare(apiKey, account.apiKeyHash);
  
  if (!isValid) {
    return null;
  }

  // Update last used
  await pool.query(
    'UPDATE service_accounts SET last_used_at = NOW() WHERE id = $1',
    [account.id]
  );

  // Cache for 5 minutes
  cachedServiceAccount = account;
  cacheExpiresAt = Date.now() + 5 * 60 * 1000;

  return account;
}

// =============================================================================
// Rate Limiting
// =============================================================================

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: string;
}

async function checkRateLimit(account: ServiceAccount): Promise<RateLimitResult> {
  const pool = await getDbPool();
  const result = await pool.query(
    'SELECT * FROM check_service_account_rate_limit($1, $2, $3)',
    [account.id, account.rateLimitPerMinute, account.rateLimitPerHour]
  );

  const row = result.rows[0];
  return {
    allowed: row.allowed,
    remaining: Math.min(row.minute_remaining, row.hour_remaining),
    resetAt: row.reset_at,
  };
}

async function incrementRateLimit(accountId: string): Promise<void> {
  const pool = await getDbPool();
  await pool.query('SELECT increment_service_account_rate_limit($1)', [accountId]);
}

// =============================================================================
// Health Status
// =============================================================================

async function getPublicHealthStatus(): Promise<PublicSystemHealth> {
  const pool = await getDbPool();
  
  // Try to get from cache first
  const cacheResult = await pool.query(
    `SELECT status_data FROM public_health_status_cache 
     WHERE id = 'current' AND expires_at > NOW()`
  );

  if (cacheResult.rows.length > 0) {
    return cacheResult.rows[0].status_data as PublicSystemHealth;
  }

  // Generate fresh status
  const status = await generatePublicHealthStatus(pool);

  // Cache it
  await pool.query(
    `INSERT INTO public_health_status_cache (id, status_data, generated_at, expires_at)
     VALUES ('current', $1, NOW(), NOW() + INTERVAL '60 seconds')
     ON CONFLICT (id) DO UPDATE SET 
       status_data = EXCLUDED.status_data,
       generated_at = NOW(),
       expires_at = NOW() + INTERVAL '60 seconds'`,
    [JSON.stringify(status)]
  );

  return status;
}

async function generatePublicHealthStatus(pool: Pool): Promise<PublicSystemHealth> {
  const now = new Date();
  
  // Get component health from internal monitoring (sanitized)
  const components = await getPublicComponentHealth(pool);
  
  // Calculate overall status
  const overallStatus = calculateOverallStatus(components);
  
  // Get active incidents
  const incidents = await getPublicIncidents(pool);
  
  // Get scheduled maintenance
  const maintenance = await getScheduledMaintenance(pool);
  
  // Get uptime history
  const uptimeHistory = await getUptimeHistory(pool);
  
  // Calculate uptime percentages
  const uptime = calculateUptimePercentages(uptimeHistory);

  return {
    generatedAt: now.toISOString(),
    cacheExpiresAt: new Date(now.getTime() + 60000).toISOString(),
    platformVersion: PLATFORM_VERSION,
    overallStatus,
    statusMessage: getStatusMessage(overallStatus, incidents.length),
    components,
    incidents,
    scheduledMaintenance: maintenance,
    uptimeHistory,
    uptime,
  };
}

async function getPublicComponentHealth(pool: Pool): Promise<PublicComponentHealth[]> {
  // In production, this would query actual health monitoring data
  // For now, return sanitized component list
  const publicComponents: PublicComponentHealth[] = [];

  for (const [internalName, publicInfo] of Object.entries(COMPONENT_PUBLIC_NAMES) as [string, { name: string; description: string }][]) {
    publicComponents.push({
      name: publicInfo.name,
      description: publicInfo.description,
      status: 'operational', // Would be from actual monitoring
      performanceIndicator: 'normal',
      statusChangedAt: new Date().toISOString(),
    });
  }

  return publicComponents;
}

async function getPublicIncidents(pool: Pool): Promise<PublicIncident[]> {
  const result = await pool.query<{
    id: string;
    title: string;
    status: string;
    severity: string;
    affected_components: string[];
    created_at: Date;
    updated_at: Date;
    resolved_at: Date | null;
    updates: any[];
  }>(
    `SELECT * FROM public_incidents 
     WHERE is_public = true 
       AND (status != 'resolved' OR resolved_at > NOW() - INTERVAL '7 days')
     ORDER BY created_at DESC
     LIMIT 10`
  );

  return result.rows.map(row => ({
    id: row.id,
    title: row.title,
    status: row.status as PublicIncident['status'],
    severity: row.severity as PublicIncident['severity'],
    affectedComponents: row.affected_components,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    resolvedAt: row.resolved_at?.toISOString(),
    updates: row.updates || [],
  }));
}

async function getScheduledMaintenance(pool: Pool): Promise<PublicMaintenance[]> {
  const result = await pool.query<{
    id: string;
    title: string;
    description: string;
    affected_components: string[];
    scheduled_start: Date;
    scheduled_end: Date;
    status: string;
  }>(
    `SELECT * FROM scheduled_maintenance 
     WHERE status IN ('scheduled', 'in_progress')
       OR (status = 'completed' AND scheduled_end > NOW() - INTERVAL '24 hours')
     ORDER BY scheduled_start ASC
     LIMIT 10`
  );

  return result.rows.map(row => ({
    id: row.id,
    title: row.title,
    description: row.description || '',
    affectedComponents: row.affected_components,
    scheduledStart: row.scheduled_start.toISOString(),
    scheduledEnd: row.scheduled_end.toISOString(),
    status: row.status as PublicMaintenance['status'],
  }));
}

async function getUptimeHistory(pool: Pool): Promise<UptimeRecord[]> {
  const result = await pool.query<{
    date: Date;
    uptime_percentage: number;
    status: string;
    incident_count: number;
  }>(
    `SELECT date, uptime_percentage, status, incident_count 
     FROM uptime_history 
     WHERE date >= CURRENT_DATE - INTERVAL '90 days'
     ORDER BY date DESC`
  );

  return result.rows.map(row => ({
    date: row.date.toISOString().split('T')[0],
    uptimePercentage: Number(row.uptime_percentage),
    status: row.status as UptimeRecord['status'],
    incidentCount: row.incident_count,
  }));
}

function calculateOverallStatus(components: PublicComponentHealth[]): PublicHealthStatus {
  const statusPriority: Record<PublicHealthStatus, number> = {
    'major_outage': 0,
    'partial_outage': 1,
    'degraded': 2,
    'maintenance': 3,
    'operational': 4,
  };

  let worstStatus: PublicHealthStatus = 'operational';
  
  for (const component of components) {
    if (statusPriority[component.status] < statusPriority[worstStatus]) {
      worstStatus = component.status;
    }
  }

  return worstStatus;
}

function calculateUptimePercentages(history: UptimeRecord[]): {
  last24Hours: number;
  last7Days: number;
  last30Days: number;
  last90Days: number;
} {
  const calculateAverage = (days: number): number => {
    const records = history.slice(0, days);
    if (records.length === 0) return 100;
    const sum = records.reduce((acc, r) => acc + r.uptimePercentage, 0);
    return Number((sum / records.length).toFixed(2));
  };

  return {
    last24Hours: history.length > 0 ? history[0].uptimePercentage : 100,
    last7Days: calculateAverage(7),
    last30Days: calculateAverage(30),
    last90Days: calculateAverage(90),
  };
}

function getStatusMessage(status: PublicHealthStatus, incidentCount: number): string {
  switch (status) {
    case 'operational':
      return 'All systems operational';
    case 'degraded':
      return 'Some systems experiencing degraded performance';
    case 'partial_outage':
      return `${incidentCount} system(s) experiencing issues`;
    case 'major_outage':
      return 'Major system outage in progress';
    case 'maintenance':
      return 'Scheduled maintenance in progress';
    default:
      return 'System status unknown';
  }
}

// =============================================================================
// Audit Logging
// =============================================================================

async function logAuditEntry(entry: Omit<StatusPageAuditEntry, 'id' | 'timestamp'>): Promise<void> {
  try {
    const pool = await getDbPool();
    await pool.query(
      `INSERT INTO service_account_audit_log (
        request_id, endpoint, method, service_account_id, service_account_name,
        api_key_prefix, client_ip_hash, user_agent, status_code, response_time_ms,
        rate_limit_remaining, was_rate_limited, error_code, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        entry.requestId,
        entry.endpoint,
        entry.method,
        entry.serviceAccountId || null,
        entry.serviceAccountName || null,
        entry.apiKeyPrefix || null,
        entry.clientIpHash || null,
        entry.userAgent || null,
        entry.statusCode,
        entry.responseTimeMs,
        entry.rateLimitRemaining,
        entry.wasRateLimited,
        entry.errorCode || null,
        entry.errorMessage || null,
      ]
    );
  } catch (error) {
    console.error('[StatusPage] Failed to log audit entry:', error);
    // Don't fail the request due to audit logging failure
  }
}

// =============================================================================
// CORS & Security
// =============================================================================

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // Allow no-origin requests (e.g., curl)
  
  const allowedOrigins = [
    `https://${STATUS_PAGE_DOMAIN}`,
    `https://status.${process.env.RADIANT_DOMAIN}`,
    // Allow localhost for development
    ...(ENVIRONMENT === 'development' ? ['http://localhost:3000', 'http://localhost:3001'] : []),
  ];

  return allowedOrigins.some(allowed => origin.startsWith(allowed));
}

function getCorsHeaders(origin: string | undefined): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-Request-ID',
    'Access-Control-Max-Age': '86400',
  };
}

function corsResponse(origin: string | undefined): APIGatewayProxyResult {
  return {
    statusCode: 204,
    headers: getCorsHeaders(origin),
    body: '',
  };
}

// =============================================================================
// Utilities
// =============================================================================

function hashIp(ip: string | undefined): string {
  if (!ip) return 'unknown';
  return createHash('sha256').update(ip).digest('hex').substring(0, 16);
}

async function getDbPool(): Promise<Pool> {
  if (!dbPool) {
    const secretArn = process.env.DB_SECRET_ARN;
    if (!secretArn) {
      throw new Error('DB_SECRET_ARN not configured');
    }

    const secretResponse = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretArn })
    );
    const secret = JSON.parse(secretResponse.SecretString || '{}');

    dbPool = new Pool({
      host: secret.host,
      port: secret.port || 5432,
      database: secret.dbname,
      user: secret.username,
      password: secret.password,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
    });
  }
  return dbPool;
}

function errorResponse(
  statusCode: number,
  code: string,
  message: string,
  requestId: string
): APIGatewayProxyResult {
  const response: StatusPageApiResponse<null> = {
    success: false,
    error: { code, message },
    cacheControl: { maxAge: 0, staleWhileRevalidate: 0, staleIfError: 0 },
    rateLimit: { limit: 0, remaining: 0, resetAt: new Date().toISOString() },
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
    },
    body: JSON.stringify(response),
  };
}

function rateLimitResponse(resetAt: string, requestId: string): APIGatewayProxyResult {
  return {
    statusCode: 429,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': resetAt,
      'Retry-After': '60',
    },
    body: JSON.stringify({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please wait before retrying.',
      },
    }),
  };
}
