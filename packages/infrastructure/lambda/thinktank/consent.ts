/**
 * Think Tank GDPR Consent Management Lambda
 * Handles user consent for data processing, marketing, analytics, and AI training
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { executeStatement, stringParam } from '../shared/db/client';

type SqlParameter = ReturnType<typeof stringParam>;

function boolParam(name: string, value: boolean): SqlParameter {
  return { name, value: { booleanValue: value } };
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

interface UserConsent {
  id: string;
  userId: string;
  email: string;
  consentType: 'data_processing' | 'marketing' | 'analytics' | 'ai_training';
  granted: boolean;
  grantedAt: string | null;
  withdrawnAt: string | null;
  ipAddress: string;
  userAgent: string;
}

interface ConsentStats {
  total: number;
  granted: number;
  withdrawn: number;
  byType: {
    data_processing: number;
    marketing: number;
    analytics: number;
    ai_training: number;
  };
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
        return await getConsents(tenantId, event.queryStringParameters);
      case 'POST':
        return await createConsent(tenantId, JSON.parse(event.body || '{}'), event);
      case 'PUT':
        return await updateConsent(tenantId, JSON.parse(event.body || '{}'));
      case 'DELETE':
        return await withdrawConsent(tenantId, event.queryStringParameters);
      default:
        return {
          statusCode: 405,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('Consent handler error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

async function getConsents(
  tenantId: string,
  params: Record<string, string> | null
): Promise<APIGatewayProxyResult> {
  const consentType = params?.consentType;
  
  let query = `
    SELECT 
      id, user_id as "userId", email, consent_type as "consentType",
      granted, granted_at as "grantedAt", withdrawn_at as "withdrawnAt",
      ip_address as "ipAddress", user_agent as "userAgent"
    FROM thinktank_user_consents
    WHERE tenant_id = $1
  `;
  const sqlParams: SqlParameter[] = [stringParam('tenant_id', tenantId)];

  if (consentType && consentType !== 'all') {
    query += ` AND consent_type = $2`;
    sqlParams.push(stringParam('consent_type', consentType));
  }

  query += ` ORDER BY created_at DESC LIMIT 500`;

  const result = await executeStatement(query, sqlParams);
  const consents = result.rows as UserConsent[];

  // Get stats
  const statsResult = await executeStatement(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE granted = true) as granted,
      COUNT(*) FILTER (WHERE granted = false) as withdrawn,
      COUNT(*) FILTER (WHERE consent_type = 'data_processing' AND granted = true) as data_processing,
      COUNT(*) FILTER (WHERE consent_type = 'marketing' AND granted = true) as marketing,
      COUNT(*) FILTER (WHERE consent_type = 'analytics' AND granted = true) as analytics,
      COUNT(*) FILTER (WHERE consent_type = 'ai_training' AND granted = true) as ai_training
    FROM thinktank_user_consents
    WHERE tenant_id = $1
  `, [stringParam('tenant_id', tenantId)]);

  const statsRow = statsResult.rows[0] as Record<string, number>;
  const stats: ConsentStats = {
    total: Number(statsRow.total) || 0,
    granted: Number(statsRow.granted) || 0,
    withdrawn: Number(statsRow.withdrawn) || 0,
    byType: {
      data_processing: Number(statsRow.data_processing) || 0,
      marketing: Number(statsRow.marketing) || 0,
      analytics: Number(statsRow.analytics) || 0,
      ai_training: Number(statsRow.ai_training) || 0,
    },
  };

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ consents, stats }),
  };
}

async function createConsent(
  tenantId: string,
  body: { userId: string; email: string; consentType: string; granted?: boolean },
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const { userId, email, consentType, granted = true } = body;

  if (!userId || !email || !consentType) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'userId, email, and consentType are required' }),
    };
  }

  const validTypes = ['data_processing', 'marketing', 'analytics', 'ai_training'];
  if (!validTypes.includes(consentType)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: `Invalid consent type. Must be one of: ${validTypes.join(', ')}` }),
    };
  }

  const ipAddress = event.requestContext.identity?.sourceIp || '0.0.0.0';
  const userAgent = event.headers['User-Agent'] || 'Unknown';

  const result = await executeStatement(`
    INSERT INTO thinktank_user_consents (
      tenant_id, user_id, email, consent_type, granted, granted_at, ip_address, user_agent
    ) VALUES ($1, $2, $3, $4, $5, CASE WHEN $5 THEN NOW() ELSE NULL END, $6, $7)
    ON CONFLICT (tenant_id, user_id, consent_type) DO UPDATE SET
      granted = EXCLUDED.granted,
      granted_at = CASE WHEN EXCLUDED.granted THEN NOW() ELSE thinktank_user_consents.granted_at END,
      withdrawn_at = CASE WHEN NOT EXCLUDED.granted THEN NOW() ELSE NULL END,
      ip_address = EXCLUDED.ip_address,
      user_agent = EXCLUDED.user_agent,
      updated_at = NOW()
    RETURNING id
  `, [
    stringParam('tenant_id', tenantId),
    stringParam('user_id', userId),
    stringParam('email', email),
    stringParam('consent_type', consentType),
    boolParam('granted', granted),
    stringParam('ip_address', ipAddress),
    stringParam('user_agent', userAgent),
  ]);

  return {
    statusCode: 201,
    headers: corsHeaders,
    body: JSON.stringify({ 
      success: true, 
      id: (result.rows[0] as Record<string, string>).id,
      message: granted ? 'Consent granted' : 'Consent recorded as withdrawn',
    }),
  };
}

async function updateConsent(
  tenantId: string,
  body: { userId: string; consentType: string; granted: boolean }
): Promise<APIGatewayProxyResult> {
  const { userId, consentType, granted } = body;

  if (!userId || !consentType || granted === undefined) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'userId, consentType, and granted are required' }),
    };
  }

  await executeStatement(`
    UPDATE thinktank_user_consents SET
      granted = $3,
      granted_at = CASE WHEN $3 THEN NOW() ELSE granted_at END,
      withdrawn_at = CASE WHEN NOT $3 THEN NOW() ELSE NULL END,
      updated_at = NOW()
    WHERE tenant_id = $1 AND user_id = $2 AND consent_type = $4
  `, [
    stringParam('tenant_id', tenantId),
    stringParam('user_id', userId),
    boolParam('granted', granted),
    stringParam('consent_type', consentType),
  ]);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ success: true, message: granted ? 'Consent granted' : 'Consent withdrawn' }),
  };
}

async function withdrawConsent(
  tenantId: string,
  params: Record<string, string> | null
): Promise<APIGatewayProxyResult> {
  const userId = params?.userId;
  const consentType = params?.consentType;

  if (!userId || !consentType) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'userId and consentType query parameters are required' }),
    };
  }

  await executeStatement(`
    UPDATE thinktank_user_consents SET
      granted = false,
      withdrawn_at = NOW(),
      updated_at = NOW()
    WHERE tenant_id = $1 AND user_id = $2 AND consent_type = $3
  `, [
    stringParam('tenant_id', tenantId),
    stringParam('user_id', userId),
    stringParam('consent_type', consentType),
  ]);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ success: true, message: 'Consent withdrawn successfully' }),
  };
}
