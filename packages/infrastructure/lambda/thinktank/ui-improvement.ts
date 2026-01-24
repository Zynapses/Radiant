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

  // Generate improvement suggestion using AI
  const improvement = await generateAIImprovement(
    userRequest,
    currentSnapshot,
    tenantId
  );

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

/**
 * Generate AI-powered UI improvement suggestions
 */
async function generateAIImprovement(
  userRequest: string,
  currentSnapshot: Record<string, unknown> | null,
  tenantId: string
): Promise<{
  id: string;
  request: string;
  timestamp: string;
  suggestion: {
    type: string;
    description: string;
    changes: { path: string; value: unknown }[];
  };
  status: string;
}> {
  const improvementId = `imp_${Date.now()}`;
  
  try {
    // Build prompt for UI improvement analysis
    const systemPrompt = `You are a UI/UX design expert. Analyze the user's improvement request and current UI state to suggest specific changes.
    
Output a JSON object with:
- type: One of "style_change", "layout_change", "component_add", "component_remove", "accessibility"
- description: Clear explanation of the improvement
- changes: Array of {path: "dotted.path.to.property", value: newValue}

Only output valid JSON. Consider accessibility, usability, and modern design principles.`;

    const userPrompt = `User request: "${userRequest}"

Current UI state:
${currentSnapshot ? JSON.stringify(currentSnapshot, null, 2).slice(0, 2000) : 'No snapshot provided'}

Suggest specific UI improvements.`;

    // Use LiteLLM/model router for AI generation
    const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');
    const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

    const response = await bedrockClient.send(new InvokeModelCommand({
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 1024,
        messages: [
          { role: 'user', content: `${systemPrompt}\n\n${userPrompt}` }
        ],
      }),
    }));

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const aiContent = responseBody.content?.[0]?.text || '';
    
    // Parse AI response
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        id: improvementId,
        request: userRequest,
        timestamp: new Date().toISOString(),
        suggestion: {
          type: parsed.type || 'style_change',
          description: parsed.description || `AI-suggested improvement for: "${userRequest}"`,
          changes: Array.isArray(parsed.changes) ? parsed.changes : [],
        },
        status: 'pending',
      };
    }
  } catch (error) {
    console.error('AI improvement generation failed:', error);
  }

  // Fallback to rule-based suggestions if AI fails
  return generateRuleBasedImprovement(userRequest, currentSnapshot, improvementId);
}

/**
 * Generate rule-based UI improvement suggestions as fallback
 */
function generateRuleBasedImprovement(
  userRequest: string,
  currentSnapshot: Record<string, unknown> | null,
  improvementId: string
): {
  id: string;
  request: string;
  timestamp: string;
  suggestion: {
    type: string;
    description: string;
    changes: { path: string; value: unknown }[];
  };
  status: string;
} {
  const request = userRequest.toLowerCase();
  
  // Pattern matching for common UI improvement requests
  const patterns: Array<{
    keywords: string[];
    type: string;
    description: string;
    changes: { path: string; value: unknown }[];
  }> = [
    {
      keywords: ['dark', 'dark mode', 'night'],
      type: 'style_change',
      description: 'Switch to dark mode theme',
      changes: [
        { path: 'theme.mode', value: 'dark' },
        { path: 'colors.background', value: '#1a1a2e' },
        { path: 'colors.text', value: '#ffffff' },
      ],
    },
    {
      keywords: ['light', 'light mode', 'bright'],
      type: 'style_change',
      description: 'Switch to light mode theme',
      changes: [
        { path: 'theme.mode', value: 'light' },
        { path: 'colors.background', value: '#ffffff' },
        { path: 'colors.text', value: '#1a1a2e' },
      ],
    },
    {
      keywords: ['bigger', 'larger', 'increase size', 'more space'],
      type: 'layout_change',
      description: 'Increase spacing and element sizes',
      changes: [
        { path: 'layout.padding', value: 24 },
        { path: 'layout.gap', value: 16 },
        { path: 'typography.baseSize', value: 18 },
      ],
    },
    {
      keywords: ['compact', 'smaller', 'dense', 'less space'],
      type: 'layout_change',
      description: 'Reduce spacing for compact layout',
      changes: [
        { path: 'layout.padding', value: 8 },
        { path: 'layout.gap', value: 4 },
        { path: 'typography.baseSize', value: 14 },
      ],
    },
    {
      keywords: ['accessible', 'accessibility', 'contrast'],
      type: 'accessibility',
      description: 'Improve accessibility with higher contrast',
      changes: [
        { path: 'accessibility.highContrast', value: true },
        { path: 'colors.primary', value: '#0066CC' },
        { path: 'typography.lineHeight', value: 1.6 },
      ],
    },
    {
      keywords: ['modern', 'fresh', 'update'],
      type: 'style_change',
      description: 'Apply modern design styling',
      changes: [
        { path: 'styles.borderRadius', value: 12 },
        { path: 'styles.shadows', value: true },
        { path: 'colors.primary', value: '#3B82F6' },
      ],
    },
  ];

  // Find matching pattern
  for (const pattern of patterns) {
    if (pattern.keywords.some(kw => request.includes(kw))) {
      return {
        id: improvementId,
        request: userRequest,
        timestamp: new Date().toISOString(),
        suggestion: {
          type: pattern.type,
          description: pattern.description,
          changes: pattern.changes,
        },
        status: 'pending',
      };
    }
  }

  // Default suggestion if no pattern matches
  return {
    id: improvementId,
    request: userRequest,
    timestamp: new Date().toISOString(),
    suggestion: {
      type: 'style_change',
      description: `Suggested improvement based on: "${userRequest}"`,
      changes: [
        { path: 'styles.updated', value: true },
      ],
    },
    status: 'pending',
  };
}
