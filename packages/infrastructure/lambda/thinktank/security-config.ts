/**
 * Think Tank Security Configuration Lambda
 * Handles security settings for Think Tank tenants
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { executeStatement, stringParam } from '../shared/db/client';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID',
  'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
};

interface SecurityConfig {
  id: string;
  tenantId: string;
  rateLimitEnabled: boolean;
  rateLimitRequestsPerMinute: number;
  rateLimitTokensPerMinute: number;
  ipWhitelist: string[];
  ipBlacklist: string[];
  contentFilteringEnabled: boolean;
  contentFilteringLevel: 'minimal' | 'standard' | 'strict';
  piiDetectionEnabled: boolean;
  piiRedactionEnabled: boolean;
  auditLoggingEnabled: boolean;
  sessionTimeoutMinutes: number;
  maxConcurrentSessions: number;
  require2fa: boolean;
  allowedDomains: string[];
  blockedKeywords: string[];
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const tenantId = event.requestContext.authorizer?.tenantId || event.headers['X-Tenant-ID'];
  if (!tenantId) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Tenant ID required' }),
    };
  }

  try {
    switch (event.httpMethod) {
      case 'GET':
        return await getSecurityConfig(tenantId);
      case 'PUT':
        return await updateSecurityConfig(tenantId, JSON.parse(event.body || '{}'));
      default:
        return {
          statusCode: 405,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('Security config handler error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

async function getSecurityConfig(tenantId: string): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(`
    SELECT 
      id, tenant_id as "tenantId",
      rate_limit_enabled as "rateLimitEnabled",
      rate_limit_requests_per_minute as "rateLimitRequestsPerMinute",
      rate_limit_tokens_per_minute as "rateLimitTokensPerMinute",
      ip_whitelist as "ipWhitelist",
      ip_blacklist as "ipBlacklist",
      content_filtering_enabled as "contentFilteringEnabled",
      content_filtering_level as "contentFilteringLevel",
      pii_detection_enabled as "piiDetectionEnabled",
      pii_redaction_enabled as "piiRedactionEnabled",
      audit_logging_enabled as "auditLoggingEnabled",
      session_timeout_minutes as "sessionTimeoutMinutes",
      max_concurrent_sessions as "maxConcurrentSessions",
      require_2fa as "require2fa",
      allowed_domains as "allowedDomains",
      blocked_keywords as "blockedKeywords"
    FROM thinktank_security_config
    WHERE tenant_id = $1
  `, [stringParam('tenant_id', tenantId)]);

  if (result.rows.length === 0) {
    // Return defaults if no config exists
    const defaultConfig: Partial<SecurityConfig> = {
      rateLimitEnabled: true,
      rateLimitRequestsPerMinute: 60,
      rateLimitTokensPerMinute: 100000,
      ipWhitelist: [],
      ipBlacklist: [],
      contentFilteringEnabled: true,
      contentFilteringLevel: 'standard',
      piiDetectionEnabled: true,
      piiRedactionEnabled: false,
      auditLoggingEnabled: true,
      sessionTimeoutMinutes: 60,
      maxConcurrentSessions: 5,
      require2fa: false,
      allowedDomains: [],
      blockedKeywords: [],
    };
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ config: defaultConfig, isDefault: true }),
    };
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ config: result.rows[0], isDefault: false }),
  };
}

async function updateSecurityConfig(
  tenantId: string,
  body: Partial<SecurityConfig>
): Promise<APIGatewayProxyResult> {
  const {
    rateLimitEnabled,
    rateLimitRequestsPerMinute,
    rateLimitTokensPerMinute,
    ipWhitelist,
    ipBlacklist,
    contentFilteringEnabled,
    contentFilteringLevel,
    piiDetectionEnabled,
    piiRedactionEnabled,
    auditLoggingEnabled,
    sessionTimeoutMinutes,
    maxConcurrentSessions,
    require2fa,
    allowedDomains,
    blockedKeywords,
  } = body;

  // Validate content filtering level
  if (contentFilteringLevel && !['minimal', 'standard', 'strict'].includes(contentFilteringLevel)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Invalid content filtering level' }),
    };
  }

  await executeStatement(`
    INSERT INTO thinktank_security_config (
      tenant_id,
      rate_limit_enabled,
      rate_limit_requests_per_minute,
      rate_limit_tokens_per_minute,
      ip_whitelist,
      ip_blacklist,
      content_filtering_enabled,
      content_filtering_level,
      pii_detection_enabled,
      pii_redaction_enabled,
      audit_logging_enabled,
      session_timeout_minutes,
      max_concurrent_sessions,
      require_2fa,
      allowed_domains,
      blocked_keywords
    ) VALUES (
      $1,
      COALESCE($2, true),
      COALESCE($3, 60),
      COALESCE($4, 100000),
      COALESCE($5, '{}'),
      COALESCE($6, '{}'),
      COALESCE($7, true),
      COALESCE($8, 'standard'),
      COALESCE($9, true),
      COALESCE($10, false),
      COALESCE($11, true),
      COALESCE($12, 60),
      COALESCE($13, 5),
      COALESCE($14, false),
      COALESCE($15, '{}'),
      COALESCE($16, '{}')
    )
    ON CONFLICT (tenant_id) DO UPDATE SET
      rate_limit_enabled = COALESCE($2, thinktank_security_config.rate_limit_enabled),
      rate_limit_requests_per_minute = COALESCE($3, thinktank_security_config.rate_limit_requests_per_minute),
      rate_limit_tokens_per_minute = COALESCE($4, thinktank_security_config.rate_limit_tokens_per_minute),
      ip_whitelist = COALESCE($5, thinktank_security_config.ip_whitelist),
      ip_blacklist = COALESCE($6, thinktank_security_config.ip_blacklist),
      content_filtering_enabled = COALESCE($7, thinktank_security_config.content_filtering_enabled),
      content_filtering_level = COALESCE($8, thinktank_security_config.content_filtering_level),
      pii_detection_enabled = COALESCE($9, thinktank_security_config.pii_detection_enabled),
      pii_redaction_enabled = COALESCE($10, thinktank_security_config.pii_redaction_enabled),
      audit_logging_enabled = COALESCE($11, thinktank_security_config.audit_logging_enabled),
      session_timeout_minutes = COALESCE($12, thinktank_security_config.session_timeout_minutes),
      max_concurrent_sessions = COALESCE($13, thinktank_security_config.max_concurrent_sessions),
      require_2fa = COALESCE($14, thinktank_security_config.require_2fa),
      allowed_domains = COALESCE($15, thinktank_security_config.allowed_domains),
      blocked_keywords = COALESCE($16, thinktank_security_config.blocked_keywords),
      updated_at = NOW()
  `, [
    stringParam('tenant_id', tenantId),
    rateLimitEnabled !== undefined ? stringParam('rate_limit_enabled', String(rateLimitEnabled)) : stringParam('rate_limit_enabled', 'NULL'),
    rateLimitRequestsPerMinute !== undefined ? stringParam('rate_limit_requests_per_minute', String(rateLimitRequestsPerMinute)) : stringParam('rate_limit_requests_per_minute', 'NULL'),
    rateLimitTokensPerMinute !== undefined ? stringParam('rate_limit_tokens_per_minute', String(rateLimitTokensPerMinute)) : stringParam('rate_limit_tokens_per_minute', 'NULL'),
    ipWhitelist ? stringParam('ip_whitelist', `{${ipWhitelist.join(',')}}`) : stringParam('ip_whitelist', 'NULL'),
    ipBlacklist ? stringParam('ip_blacklist', `{${ipBlacklist.join(',')}}`) : stringParam('ip_blacklist', 'NULL'),
    contentFilteringEnabled !== undefined ? stringParam('content_filtering_enabled', String(contentFilteringEnabled)) : stringParam('content_filtering_enabled', 'NULL'),
    contentFilteringLevel ? stringParam('content_filtering_level', contentFilteringLevel) : stringParam('content_filtering_level', 'NULL'),
    piiDetectionEnabled !== undefined ? stringParam('pii_detection_enabled', String(piiDetectionEnabled)) : stringParam('pii_detection_enabled', 'NULL'),
    piiRedactionEnabled !== undefined ? stringParam('pii_redaction_enabled', String(piiRedactionEnabled)) : stringParam('pii_redaction_enabled', 'NULL'),
    auditLoggingEnabled !== undefined ? stringParam('audit_logging_enabled', String(auditLoggingEnabled)) : stringParam('audit_logging_enabled', 'NULL'),
    sessionTimeoutMinutes !== undefined ? stringParam('session_timeout_minutes', String(sessionTimeoutMinutes)) : stringParam('session_timeout_minutes', 'NULL'),
    maxConcurrentSessions !== undefined ? stringParam('max_concurrent_sessions', String(maxConcurrentSessions)) : stringParam('max_concurrent_sessions', 'NULL'),
    require2fa !== undefined ? stringParam('require_2fa', String(require2fa)) : stringParam('require_2fa', 'NULL'),
    allowedDomains ? stringParam('allowed_domains', `{${allowedDomains.join(',')}}`) : stringParam('allowed_domains', 'NULL'),
    blockedKeywords ? stringParam('blocked_keywords', `{${blockedKeywords.join(',')}}`) : stringParam('blocked_keywords', 'NULL'),
  ]);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ success: true, message: 'Security configuration updated' }),
  };
}
