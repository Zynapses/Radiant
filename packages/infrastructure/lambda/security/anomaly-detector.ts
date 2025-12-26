// RADIANT v4.18.0 - Anomaly Detector Lambda Handler
// Security anomaly detection and intrusion prevention

import { APIGatewayProxyEvent, APIGatewayProxyResult, ScheduledEvent } from 'aws-lambda';
import { PoolClient } from 'pg';
import { getPoolClient } from '../shared/db/centralized-pool';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import { corsHeaders } from '../shared/middleware/api-response';

export interface SecurityAnomaly {
  id: string;
  tenantId: string;
  anomalyType: 'geographic' | 'session_hijack' | 'brute_force' | 'rate_limit' | 'credential_stuffing';
  severity: 'critical' | 'high' | 'medium' | 'low';
  userId?: string;
  ipAddress: string;
  details: Record<string, unknown>;
  isResolved: boolean;
  detectedAt: string;
}

export interface SecurityMetrics {
  totalAnomalies24h: number;
  criticalCount: number;
  highCount: number;
  blockedIps: number;
  suspiciousLogins: number;
  activeThreats: number;
}

// VPN/Known IP Whitelist Configuration
export interface IPWhitelistConfig {
  tenantId: string;
  whitelistedRanges: string[]; // CIDR notation: "10.0.0.0/8", "192.168.1.0/24"
  whitelistedIps: string[];    // Individual IPs
  description: string;
  createdAt: string;
  updatedAt: string;
}

// Check if IP is in whitelist (for VPN false positive prevention)
async function isIPWhitelisted(client: PoolClient, tenantId: string, ipAddress: string): Promise<boolean> {
  // Check individual IP whitelist
  const ipResult = await client.query(
    `SELECT 1 FROM ip_whitelist 
     WHERE tenant_id = $1 
     AND (ip_address = $2 OR $2 <<= ip_range::inet)
     AND is_active = true
     LIMIT 1`,
    [tenantId, ipAddress]
  );
  
  if (ipResult.rows.length > 0) {
    return true;
  }
  
  // Check tenant VPN configuration
  const vpnResult = await client.query(
    `SELECT vpn_ip_ranges FROM tenant_security_config 
     WHERE tenant_id = $1`,
    [tenantId]
  );
  
  if (vpnResult.rows.length > 0 && vpnResult.rows[0].vpn_ip_ranges) {
    const vpnRanges: string[] = vpnResult.rows[0].vpn_ip_ranges;
    // Check if IP falls within any VPN range using PostgreSQL inet operators
    for (const range of vpnRanges) {
      const rangeCheck = await client.query(
        `SELECT $1::inet <<= $2::inet as is_in_range`,
        [ipAddress, range]
      );
      if (rangeCheck.rows[0]?.is_in_range) {
        return true;
      }
    }
  }
  
  return false;
}

// Deduplicate repeated alerts for same user/type within time window
async function shouldSuppressAlert(
  client: PoolClient, 
  tenantId: string, 
  userId: string | undefined, 
  anomalyType: string,
  suppressionWindowMinutes: number = 60
): Promise<boolean> {
  if (!userId) return false;
  
  const result = await client.query(
    `SELECT COUNT(*) as count FROM security_anomalies
     WHERE tenant_id = $1 
     AND user_id = $2 
     AND anomaly_type = $3
     AND detected_at > NOW() - INTERVAL '${suppressionWindowMinutes} minutes'
     AND is_resolved = false`,
    [tenantId, userId, anomalyType]
  );
  
  // Suppress if there's already an unresolved alert of this type
  return parseInt(result.rows[0].count, 10) > 0;
}

// Detect geographic anomalies (impossible travel)
async function detectGeographicAnomalies(client: PoolClient, tenantId: string): Promise<SecurityAnomaly[]> {
  const anomalies: SecurityAnomaly[] = [];

  const result = await client.query(
    `
    WITH user_locations AS (
      SELECT 
        user_id,
        ip_address,
        geo_location,
        created_at,
        LAG(geo_location) OVER (PARTITION BY user_id ORDER BY created_at) as prev_location,
        LAG(created_at) OVER (PARTITION BY user_id ORDER BY created_at) as prev_time
      FROM auth_events
      WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '1 hour'
    )
    SELECT * FROM user_locations
    WHERE prev_location IS NOT NULL
      AND geo_location != prev_location
      AND EXTRACT(EPOCH FROM (created_at - prev_time)) < 3600
    `,
    [tenantId]
  );

  for (const row of result.rows) {
    anomalies.push({
      id: crypto.randomUUID(),
      tenantId,
      anomalyType: 'geographic',
      severity: 'high',
      userId: row.user_id,
      ipAddress: row.ip_address,
      details: {
        previousLocation: row.prev_location,
        currentLocation: row.geo_location,
        timeDifferenceSeconds: row.time_diff,
      },
      isResolved: false,
      detectedAt: new Date().toISOString(),
    });
  }

  return anomalies;
}

// Detect session hijacking attempts (with VPN whitelist support)
async function detectSessionHijacking(client: PoolClient, tenantId: string): Promise<SecurityAnomaly[]> {
  const anomalies: SecurityAnomaly[] = [];

  const result = await client.query(
    `
    SELECT 
      s.user_id,
      s.id as session_id,
      COUNT(DISTINCT a.ip_address) as ip_count,
      array_agg(DISTINCT a.ip_address) as ip_addresses
    FROM sessions s
    JOIN auth_events a ON s.id = a.session_id
    WHERE s.tenant_id = $1 
      AND a.created_at > NOW() - INTERVAL '1 hour'
      AND s.is_active = true
    GROUP BY s.user_id, s.id
    HAVING COUNT(DISTINCT a.ip_address) > 2
    `,
    [tenantId]
  );

  for (const row of result.rows) {
    const ipAddresses: string[] = row.ip_addresses;
    
    // Filter out whitelisted IPs (VPN exit nodes, known corporate IPs)
    const nonWhitelistedIps: string[] = [];
    for (const ip of ipAddresses) {
      const isWhitelisted = await isIPWhitelisted(client, tenantId, ip);
      if (!isWhitelisted) {
        nonWhitelistedIps.push(ip);
      }
    }
    
    // Only flag if there are still multiple non-whitelisted IPs
    if (nonWhitelistedIps.length > 2) {
      // Check for alert suppression (avoid flooding)
      const shouldSuppress = await shouldSuppressAlert(client, tenantId, row.user_id, 'session_hijack');
      if (shouldSuppress) {
        continue;
      }
      
      anomalies.push({
        id: crypto.randomUUID(),
        tenantId,
        anomalyType: 'session_hijack',
        severity: 'critical',
        userId: row.user_id,
        ipAddress: nonWhitelistedIps[0],
        details: {
          sessionId: row.session_id,
          ipCount: nonWhitelistedIps.length,
          ipAddresses: nonWhitelistedIps,
          whitelistedIpsFiltered: ipAddresses.length - nonWhitelistedIps.length,
        },
        isResolved: false,
        detectedAt: new Date().toISOString(),
      });
    }
  }

  return anomalies;
}

// Detect brute force attacks
async function detectBruteForce(client: PoolClient, tenantId: string): Promise<SecurityAnomaly[]> {
  const anomalies: SecurityAnomaly[] = [];

  const result = await client.query(
    `
    SELECT 
      ip_address,
      COUNT(*) as failed_attempts,
      array_agg(DISTINCT email) as attempted_emails
    FROM auth_events
    WHERE tenant_id = $1 
      AND event_type = 'login_failed'
      AND created_at > NOW() - INTERVAL '15 minutes'
    GROUP BY ip_address
    HAVING COUNT(*) > 10
    `,
    [tenantId]
  );

  for (const row of result.rows) {
    anomalies.push({
      id: crypto.randomUUID(),
      tenantId,
      anomalyType: 'brute_force',
      severity: row.failed_attempts > 50 ? 'critical' : 'high',
      ipAddress: row.ip_address,
      details: {
        failedAttempts: row.failed_attempts,
        attemptedEmails: row.attempted_emails,
      },
      isResolved: false,
      detectedAt: new Date().toISOString(),
    });
  }

  return anomalies;
}

// Detect credential stuffing
async function detectCredentialStuffing(client: PoolClient, tenantId: string): Promise<SecurityAnomaly[]> {
  const anomalies: SecurityAnomaly[] = [];

  const result = await client.query(
    `
    SELECT 
      ip_address,
      COUNT(DISTINCT email) as unique_emails,
      COUNT(*) as total_attempts
    FROM auth_events
    WHERE tenant_id = $1 
      AND event_type = 'login_failed'
      AND created_at > NOW() - INTERVAL '1 hour'
    GROUP BY ip_address
    HAVING COUNT(DISTINCT email) > 20
    `,
    [tenantId]
  );

  for (const row of result.rows) {
    anomalies.push({
      id: crypto.randomUUID(),
      tenantId,
      anomalyType: 'credential_stuffing',
      severity: 'critical',
      ipAddress: row.ip_address,
      details: {
        uniqueEmails: row.unique_emails,
        totalAttempts: row.total_attempts,
      },
      isResolved: false,
      detectedAt: new Date().toISOString(),
    });
  }

  return anomalies;
}

// Run all anomaly detection
async function runAnomalyDetection(tenantId?: string): Promise<SecurityAnomaly[]> {
  const client = await getPoolClient();
  const allAnomalies: SecurityAnomaly[] = [];

  try {
    // Get all tenants if not specified
    const tenants = tenantId
      ? [{ id: tenantId }]
      : (await client.query('SELECT id FROM tenants WHERE is_active = true')).rows;

    for (const tenant of tenants) {
      const geoAnomalies = await detectGeographicAnomalies(client, tenant.id);
      const sessionAnomalies = await detectSessionHijacking(client, tenant.id);
      const bruteForceAnomalies = await detectBruteForce(client, tenant.id);
      const stuffingAnomalies = await detectCredentialStuffing(client, tenant.id);

      const anomalies = [
        ...geoAnomalies,
        ...sessionAnomalies,
        ...bruteForceAnomalies,
        ...stuffingAnomalies,
      ];

      // Store anomalies
      for (const anomaly of anomalies) {
        await client.query(
          `INSERT INTO security_anomalies (
            id, tenant_id, anomaly_type, severity, user_id, ip_address, details, detected_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO NOTHING`,
          [
            anomaly.id,
            anomaly.tenantId,
            anomaly.anomalyType,
            anomaly.severity,
            anomaly.userId,
            anomaly.ipAddress,
            JSON.stringify(anomaly.details),
            anomaly.detectedAt,
          ]
        );
      }

      allAnomalies.push(...anomalies);
    }

    return allAnomalies;
  } finally {
    client.release();
  }
}

// GET /api/security/anomalies
export async function getAnomalies(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = event.queryStringParameters?.tenantId;
    const severity = event.queryStringParameters?.severity;
    const limit = parseInt(event.queryStringParameters?.limit || '100', 10);

    const client = await getPoolClient();

    try {
      let query = `SELECT * FROM security_anomalies WHERE 1=1`;
      const params: (string | number)[] = [];
      let paramIndex = 1;

      if (tenantId) {
        query += ` AND tenant_id = $${paramIndex++}`;
        params.push(tenantId);
      }

      if (severity) {
        query += ` AND severity = $${paramIndex++}`;
        params.push(severity);
      }

      query += ` ORDER BY detected_at DESC LIMIT $${paramIndex}`;
      params.push(limit);

      const result = await client.query(query, params);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(
          result.rows.map((row) => ({
            id: row.id,
            tenantId: row.tenant_id,
            anomalyType: row.anomaly_type,
            severity: row.severity,
            userId: row.user_id,
            ipAddress: row.ip_address,
            details: row.details,
            isResolved: row.is_resolved,
            detectedAt: row.detected_at,
          }))
        ),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to get anomalies', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get anomalies' }),
    };
  }
}

// GET /api/security/metrics
export async function getSecurityMetrics(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = event.queryStringParameters?.tenantId;
    const client = await getPoolClient();

    try {
      const metricsQuery = tenantId
        ? `
          SELECT 
            COUNT(*) FILTER (WHERE detected_at > NOW() - INTERVAL '24 hours') as total_24h,
            COUNT(*) FILTER (WHERE severity = 'critical' AND NOT is_resolved) as critical_count,
            COUNT(*) FILTER (WHERE severity = 'high' AND NOT is_resolved) as high_count,
            COUNT(*) FILTER (WHERE NOT is_resolved) as active_threats
          FROM security_anomalies
          WHERE tenant_id = $1
        `
        : `
          SELECT 
            COUNT(*) FILTER (WHERE detected_at > NOW() - INTERVAL '24 hours') as total_24h,
            COUNT(*) FILTER (WHERE severity = 'critical' AND NOT is_resolved) as critical_count,
            COUNT(*) FILTER (WHERE severity = 'high' AND NOT is_resolved) as high_count,
            COUNT(*) FILTER (WHERE NOT is_resolved) as active_threats
          FROM security_anomalies
        `;

      const result = await client.query(metricsQuery, tenantId ? [tenantId] : []);
      const metrics = result.rows[0];

      // Query blocked IPs from blocklist table
      const blockedIpsQuery = tenantId
        ? `SELECT COUNT(*) as count FROM ip_blocklist WHERE tenant_id = $1 AND is_active = true AND (expires_at IS NULL OR expires_at > NOW())`
        : `SELECT COUNT(*) as count FROM ip_blocklist WHERE is_active = true AND (expires_at IS NULL OR expires_at > NOW())`;
      const blockedIpsResult = await client.query(blockedIpsQuery, tenantId ? [tenantId] : []);
      const blockedIps = parseInt(blockedIpsResult.rows[0]?.count, 10) || 0;

      // Query suspicious logins from auth events (failed logins in last 24h)
      const suspiciousLoginsQuery = tenantId
        ? `SELECT COUNT(*) as count FROM auth_events WHERE tenant_id = $1 AND event_type = 'login_failed' AND created_at > NOW() - INTERVAL '24 hours'`
        : `SELECT COUNT(*) as count FROM auth_events WHERE event_type = 'login_failed' AND created_at > NOW() - INTERVAL '24 hours'`;
      const suspiciousLoginsResult = await client.query(suspiciousLoginsQuery, tenantId ? [tenantId] : []);
      const suspiciousLogins = parseInt(suspiciousLoginsResult.rows[0]?.count, 10) || 0;

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          totalAnomalies24h: parseInt(metrics.total_24h, 10) || 0,
          criticalCount: parseInt(metrics.critical_count, 10) || 0,
          highCount: parseInt(metrics.high_count, 10) || 0,
          blockedIps,
          suspiciousLogins,
          activeThreats: parseInt(metrics.active_threats, 10) || 0,
        }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to get security metrics', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get metrics' }),
    };
  }
}

// POST /api/security/scan - Trigger manual scan
export async function triggerScan(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const { tenantId } = JSON.parse(event.body || '{}');
    const anomalies = await runAnomalyDetection(tenantId);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        anomaliesDetected: anomalies.length,
        anomalies,
      }),
    };
  } catch (error) {
    logger.error('Failed to run scan', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to run scan' }),
    };
  }
}

// Scheduled handler
export async function scheduledHandler(event: ScheduledEvent): Promise<void> {
  logger.info('Running scheduled anomaly detection');
  const anomalies = await runAnomalyDetection();
  logger.info('Anomaly detection complete', { anomalyCount: anomalies.length });
}

// Lambda handler router
export async function handler(
  event: APIGatewayProxyEvent | ScheduledEvent
): Promise<APIGatewayProxyResult | void> {
  if ('httpMethod' in event) {
    const path = event.path;
    const method = event.httpMethod;

    if (path === '/api/security/anomalies' && method === 'GET') {
      return getAnomalies(event);
    }

    if (path === '/api/security/metrics' && method === 'GET') {
      return getSecurityMetrics(event);
    }

    if (path === '/api/security/scan' && method === 'POST') {
      return triggerScan(event);
    }

    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Not found' }),
    };
  } else {
    return scheduledHandler(event);
  }
}
