/**
 * Think Tank UI Improvement Sessions Lambda
 * Handles AI-assisted UI improvement sessions
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { executeStatement, stringParam } from '../shared/db/client';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID,X-User-ID',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
};

interface UIImprovementSession {
  id: string;
  userId: string;
  appId: string;
  initialSnapshot: Record<string, unknown>;
  currentSnapshot: Record<string, unknown> | null;
  improvementsApplied: Record<string, unknown>[];
  status: 'active' | 'completed' | 'cancelled' | 'failed';
  startedAt: string;
  completedAt: string | null;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const tenantId = event.requestContext.authorizer?.tenantId || event.headers['X-Tenant-ID'];
  const userId = event.requestContext.authorizer?.userId || event.headers['X-User-ID'];
  
  if (!tenantId || !userId) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Tenant ID and User ID required' }),
    };
  }

  const path = event.path;
  const action = path.split('/').pop();

  try {
    if (event.httpMethod === 'GET') {
      return await getSessions(tenantId, userId);
    }
    
    if (event.httpMethod === 'POST') {
      if (action === 'start') {
        return await startSession(tenantId, userId, JSON.parse(event.body || '{}'));
      }
      if (action === 'request') {
        return await requestImprovement(tenantId, userId, JSON.parse(event.body || '{}'));
      }
      if (action === 'apply') {
        return await applyImprovement(tenantId, userId, JSON.parse(event.body || '{}'));
      }
      if (action === 'complete') {
        return await completeSession(tenantId, userId, JSON.parse(event.body || '{}'));
      }
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  } catch (error) {
    console.error('UI Improvement handler error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

async function getSessions(
  tenantId: string,
  userId: string
): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(`
    SELECT 
      id, user_id as "userId", app_id as "appId",
      initial_snapshot as "initialSnapshot",
      current_snapshot as "currentSnapshot",
      improvements_applied as "improvementsApplied",
      status, started_at as "startedAt",
      completed_at as "completedAt"
    FROM thinktank_ui_improvement_sessions
    WHERE tenant_id = $1 AND user_id = $2
    ORDER BY started_at DESC
    LIMIT 50
  `, [
    stringParam('tenant_id', tenantId),
    stringParam('user_id', userId),
  ]);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ sessions: result.rows }),
  };
}

async function startSession(
  tenantId: string,
  userId: string,
  body: { appId: string; currentSnapshot: Record<string, unknown> }
): Promise<APIGatewayProxyResult> {
  const { appId, currentSnapshot } = body;

  if (!appId || !currentSnapshot) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'appId and currentSnapshot are required' }),
    };
  }

  // Check for existing active session
  const existingResult = await executeStatement(`
    SELECT id FROM thinktank_ui_improvement_sessions
    WHERE tenant_id = $1 AND user_id = $2 AND app_id = $3 AND status = 'active'
    LIMIT 1
  `, [
    stringParam('tenant_id', tenantId),
    stringParam('user_id', userId),
    stringParam('app_id', appId),
  ]);

  if (existingResult.rows.length > 0) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        sessionId: (existingResult.rows[0] as Record<string, string>).id,
        isExisting: true,
      }),
    };
  }

  const result = await executeStatement(`
    INSERT INTO thinktank_ui_improvement_sessions (
      tenant_id, user_id, app_id, initial_snapshot, current_snapshot
    ) VALUES ($1, $2, $3, $4, $4)
    RETURNING id, started_at as "startedAt"
  `, [
    stringParam('tenant_id', tenantId),
    stringParam('user_id', userId),
    stringParam('app_id', appId),
    stringParam('snapshot', JSON.stringify(currentSnapshot)),
  ]);

  const row = result.rows[0] as Record<string, string>;

  return {
    statusCode: 201,
    headers: corsHeaders,
    body: JSON.stringify({ 
      sessionId: row.id,
      startedAt: row.startedAt,
      isExisting: false,
    }),
  };
}

async function requestImprovement(
  tenantId: string,
  userId: string,
  body: { sessionId: string; userRequest: string; currentSnapshot: Record<string, unknown> }
): Promise<APIGatewayProxyResult> {
  const { sessionId, userRequest, currentSnapshot } = body;

  if (!sessionId || !userRequest) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'sessionId and userRequest are required' }),
    };
  }

  // Verify session exists and is active
  const sessionResult = await executeStatement(`
    SELECT id, app_id FROM thinktank_ui_improvement_sessions
    WHERE tenant_id = $1 AND user_id = $2 AND id = $3 AND status = 'active'
  `, [
    stringParam('tenant_id', tenantId),
    stringParam('user_id', userId),
    stringParam('session_id', sessionId),
  ]);

  if (sessionResult.rows.length === 0) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Active session not found' }),
    };
  }

  // Generate improvement suggestion (mock for now - would integrate with AI)
  const improvement = {
    id: `imp_${Date.now()}`,
    request: userRequest,
    timestamp: new Date().toISOString(),
    suggestion: {
      type: 'style_change',
      description: `Suggested improvement based on: "${userRequest}"`,
      changes: [
        { path: 'styles.primary', value: '#3B82F6' },
        { path: 'layout.padding', value: 16 },
      ],
    },
    status: 'pending',
  };

  // Update session with current snapshot
  if (currentSnapshot) {
    await executeStatement(`
      UPDATE thinktank_ui_improvement_sessions SET
        current_snapshot = $4,
        updated_at = NOW()
      WHERE tenant_id = $1 AND user_id = $2 AND id = $3
    `, [
      stringParam('tenant_id', tenantId),
      stringParam('user_id', userId),
      stringParam('session_id', sessionId),
      stringParam('snapshot', JSON.stringify(currentSnapshot)),
    ]);
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ 
      success: true,
      improvement,
    }),
  };
}

async function applyImprovement(
  tenantId: string,
  userId: string,
  body: { sessionId: string; improvementId: string; improvement: Record<string, unknown> }
): Promise<APIGatewayProxyResult> {
  const { sessionId, improvementId, improvement } = body;

  if (!sessionId || !improvementId || !improvement) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'sessionId, improvementId, and improvement are required' }),
    };
  }

  await executeStatement(`
    UPDATE thinktank_ui_improvement_sessions SET
      improvements_applied = array_append(improvements_applied, $4::jsonb),
      updated_at = NOW()
    WHERE tenant_id = $1 AND user_id = $2 AND id = $3 AND status = 'active'
  `, [
    stringParam('tenant_id', tenantId),
    stringParam('user_id', userId),
    stringParam('session_id', sessionId),
    stringParam('improvement', JSON.stringify({ ...improvement, id: improvementId, appliedAt: new Date().toISOString() })),
  ]);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ success: true, message: 'Improvement applied' }),
  };
}

async function completeSession(
  tenantId: string,
  userId: string,
  body: { sessionId: string; finalSnapshot?: Record<string, unknown> }
): Promise<APIGatewayProxyResult> {
  const { sessionId, finalSnapshot } = body;

  if (!sessionId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'sessionId is required' }),
    };
  }

  await executeStatement(`
    UPDATE thinktank_ui_improvement_sessions SET
      status = 'completed',
      current_snapshot = COALESCE($4, current_snapshot),
      completed_at = NOW(),
      updated_at = NOW()
    WHERE tenant_id = $1 AND user_id = $2 AND id = $3
  `, [
    stringParam('tenant_id', tenantId),
    stringParam('user_id', userId),
    stringParam('session_id', sessionId),
    finalSnapshot ? stringParam('snapshot', JSON.stringify(finalSnapshot)) : stringParam('snapshot', ''),
  ]);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ success: true, message: 'Session completed' }),
  };
}
