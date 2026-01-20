/**
 * Think Tank UI Feedback Lambda
 * Handles user feedback on UI components and experiences
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { executeStatement, stringParam } from '../shared/db/client';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID,X-User-ID',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
};

interface UIFeedback {
  id: string;
  userId: string;
  sessionId: string | null;
  appId: string | null;
  componentPath: string | null;
  feedbackType: 'bug' | 'improvement' | 'feature_request' | 'confusion' | 'delight' | 'frustration' | 'other';
  feedbackText: string | null;
  suggestion: string | null;
  screenshotUrl: string | null;
  viewportWidth: number | null;
  viewportHeight: number | null;
  userAgent: string | null;
  urlPath: string | null;
  metadata: Record<string, unknown>;
  status: 'new' | 'reviewed' | 'accepted' | 'rejected' | 'implemented';
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const tenantId = event.requestContext.authorizer?.tenantId || event.headers['X-Tenant-ID'];
  const userId = event.requestContext.authorizer?.userId || event.headers['X-User-ID'];
  
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
        return await getFeedback(tenantId, event.queryStringParameters);
      case 'POST':
        return await createFeedback(tenantId, userId, JSON.parse(event.body || '{}'), event);
      case 'PUT':
        return await updateFeedbackStatus(tenantId, JSON.parse(event.body || '{}'), event);
      default:
        return {
          statusCode: 405,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('UI Feedback handler error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

async function getFeedback(
  tenantId: string,
  params: Record<string, string | undefined> | null
): Promise<APIGatewayProxyResult> {
  const feedbackType = params?.feedbackType;
  const status = params?.status;
  const appId = params?.appId;
  
  let query = `
    SELECT 
      id, user_id as "userId", session_id as "sessionId",
      app_id as "appId", component_path as "componentPath",
      feedback_type as "feedbackType", feedback_text as "feedbackText",
      suggestion, screenshot_url as "screenshotUrl",
      viewport_width as "viewportWidth", viewport_height as "viewportHeight",
      user_agent as "userAgent", url_path as "urlPath",
      metadata, status, reviewed_by as "reviewedBy",
      reviewed_at as "reviewedAt", created_at as "createdAt"
    FROM thinktank_ui_feedback
    WHERE tenant_id = $1
  `;
  const sqlParams = [stringParam('tenant_id', tenantId)];
  let paramIndex = 2;

  if (feedbackType && feedbackType !== 'all') {
    query += ` AND feedback_type = $${paramIndex}`;
    sqlParams.push(stringParam('feedback_type', feedbackType));
    paramIndex++;
  }

  if (status && status !== 'all') {
    query += ` AND status = $${paramIndex}`;
    sqlParams.push(stringParam('status', status));
    paramIndex++;
  }

  if (appId) {
    query += ` AND app_id = $${paramIndex}`;
    sqlParams.push(stringParam('app_id', appId));
  }

  query += ` ORDER BY created_at DESC LIMIT 500`;

  const result = await executeStatement(query, sqlParams);
  const feedback = result.rows as unknown as UIFeedback[];

  // Get stats
  const statsResult = await executeStatement(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'new') as new,
      COUNT(*) FILTER (WHERE status = 'reviewed') as reviewed,
      COUNT(*) FILTER (WHERE status = 'accepted') as accepted,
      COUNT(*) FILTER (WHERE status = 'implemented') as implemented,
      COUNT(*) FILTER (WHERE feedback_type = 'bug') as bugs,
      COUNT(*) FILTER (WHERE feedback_type = 'improvement') as improvements,
      COUNT(*) FILTER (WHERE feedback_type = 'feature_request') as feature_requests
    FROM thinktank_ui_feedback
    WHERE tenant_id = $1
  `, [stringParam('tenant_id', tenantId)]);

  const statsRow = statsResult.rows[0] as Record<string, number>;

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ 
      feedback,
      stats: {
        total: Number(statsRow.total) || 0,
        new: Number(statsRow.new) || 0,
        reviewed: Number(statsRow.reviewed) || 0,
        accepted: Number(statsRow.accepted) || 0,
        implemented: Number(statsRow.implemented) || 0,
        bugs: Number(statsRow.bugs) || 0,
        improvements: Number(statsRow.improvements) || 0,
        featureRequests: Number(statsRow.feature_requests) || 0,
      },
    }),
  };
}

async function createFeedback(
  tenantId: string,
  userId: string | undefined,
  body: {
    sessionId?: string;
    appId?: string;
    componentPath?: string;
    feedbackType: string;
    feedbackText?: string;
    suggestion?: string;
    screenshotUrl?: string;
    viewportWidth?: number;
    viewportHeight?: number;
    urlPath?: string;
    metadata?: Record<string, unknown>;
  },
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const {
    sessionId,
    appId,
    componentPath,
    feedbackType,
    feedbackText,
    suggestion,
    screenshotUrl,
    viewportWidth,
    viewportHeight,
    urlPath,
    metadata = {},
  } = body;

  if (!feedbackType) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'feedbackType is required' }),
    };
  }

  const validTypes = ['bug', 'improvement', 'feature_request', 'confusion', 'delight', 'frustration', 'other'];
  if (!validTypes.includes(feedbackType)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: `Invalid feedback type. Must be one of: ${validTypes.join(', ')}` }),
    };
  }

  const userAgent = event.headers['User-Agent'] || null;

  const result = await executeStatement(`
    INSERT INTO thinktank_ui_feedback (
      tenant_id, user_id, session_id, app_id, component_path,
      feedback_type, feedback_text, suggestion, screenshot_url,
      viewport_width, viewport_height, user_agent, url_path, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING id
  `, [
    stringParam('tenant_id', tenantId),
    stringParam('user_id', userId || 'anonymous'),
    stringParam('session_id', sessionId || ''),
    stringParam('app_id', appId || ''),
    stringParam('component_path', componentPath || ''),
    stringParam('feedback_type', feedbackType),
    stringParam('feedback_text', feedbackText || ''),
    stringParam('suggestion', suggestion || ''),
    stringParam('screenshot_url', screenshotUrl || ''),
    stringParam('viewport_width', viewportWidth?.toString() || ''),
    stringParam('viewport_height', viewportHeight?.toString() || ''),
    stringParam('user_agent', userAgent || ''),
    stringParam('url_path', urlPath || ''),
    stringParam('metadata', JSON.stringify(metadata)),
  ]);

  return {
    statusCode: 201,
    headers: corsHeaders,
    body: JSON.stringify({ 
      success: true, 
      id: (result.rows[0] as Record<string, string>).id,
      message: 'Feedback submitted successfully',
    }),
  };
}

async function updateFeedbackStatus(
  tenantId: string,
  body: { feedbackId: string; status: string; notes?: string },
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const { feedbackId, status } = body;

  if (!feedbackId || !status) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'feedbackId and status are required' }),
    };
  }

  const validStatuses = ['new', 'reviewed', 'accepted', 'rejected', 'implemented'];
  if (!validStatuses.includes(status)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }),
    };
  }

  const reviewerId = event.requestContext.authorizer?.userId || 'system';

  await executeStatement(`
    UPDATE thinktank_ui_feedback SET
      status = $3,
      reviewed_by = $4,
      reviewed_at = NOW()
    WHERE tenant_id = $1 AND id = $2
  `, [
    stringParam('tenant_id', tenantId),
    stringParam('id', feedbackId),
    stringParam('status', status),
    stringParam('reviewed_by', reviewerId),
  ]);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ success: true, message: `Feedback status updated to ${status}` }),
  };
}
