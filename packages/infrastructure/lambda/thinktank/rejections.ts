/**
 * Think Tank Rejection Notifications Lambda
 * Handles rejection notifications when user requests are blocked
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { executeStatement, stringParam } from '../shared/db/client';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
};

interface Rejection {
  id: string;
  userId: string;
  conversationId: string | null;
  messageId: string | null;
  rejectionType: string;
  rejectionReason: string;
  originalPrompt: string | null;
  modelId: string | null;
  severity: 'info' | 'warning' | 'error' | 'critical';
  isRead: boolean;
  isDismissed: boolean;
  readAt: string | null;
  dismissedAt: string | null;
  metadata: Record<string, unknown>;
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

  const path = event.path;
  const pathParts = path.split('/').filter(Boolean);
  const notificationId = pathParts[pathParts.length - 2] === 'rejections' ? null : pathParts[pathParts.length - 2];
  const action = pathParts[pathParts.length - 1];

  try {
    // Route based on path pattern
    if (event.httpMethod === 'GET' && !notificationId) {
      return await getRejections(tenantId, userId);
    }
    
    if (event.httpMethod === 'POST') {
      return await createRejection(tenantId, JSON.parse(event.body || '{}'));
    }
    
    if (event.httpMethod === 'PATCH' && notificationId && action === 'read') {
      return await markAsRead(tenantId, notificationId);
    }
    
    if (event.httpMethod === 'DELETE' && notificationId && action === 'dismiss') {
      return await dismissRejection(tenantId, notificationId);
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  } catch (error) {
    console.error('Rejections handler error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

async function getRejections(
  tenantId: string,
  userId: string | undefined
): Promise<APIGatewayProxyResult> {
  let query = `
    SELECT 
      id, user_id as "userId", 
      conversation_id as "conversationId",
      message_id as "messageId",
      rejection_type as "rejectionType",
      rejection_reason as "rejectionReason",
      original_prompt as "originalPrompt",
      model_id as "modelId",
      severity, is_read as "isRead",
      is_dismissed as "isDismissed",
      read_at as "readAt",
      dismissed_at as "dismissedAt",
      metadata, created_at as "createdAt"
    FROM thinktank_rejections
    WHERE tenant_id = $1
      AND is_dismissed = false
  `;
  
  const params = [stringParam('tenant_id', tenantId)];
  
  if (userId) {
    query += ` AND user_id = $2`;
    params.push(stringParam('user_id', userId));
  }
  
  query += ` ORDER BY created_at DESC LIMIT 100`;

  const result = await executeStatement(query, params);
  const rejections = result.rows as unknown as Rejection[];

  // Count unread
  const unreadResult = await executeStatement(`
    SELECT COUNT(*) as count
    FROM thinktank_rejections
    WHERE tenant_id = $1 AND is_read = false AND is_dismissed = false
    ${userId ? 'AND user_id = $2' : ''}
  `, params);
  
  const unreadCount = Number((unreadResult.rows[0] as Record<string, number>)?.count) || 0;

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ 
      data: {
        hasRejections: rejections.length > 0,
        rejections,
        unreadCount,
      }
    }),
  };
}

async function createRejection(
  tenantId: string,
  body: {
    userId: string;
    conversationId?: string;
    messageId?: string;
    rejectionType: string;
    rejectionReason: string;
    originalPrompt?: string;
    modelId?: string;
    severity?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<APIGatewayProxyResult> {
  const {
    userId,
    conversationId,
    messageId,
    rejectionType,
    rejectionReason,
    originalPrompt,
    modelId,
    severity = 'info',
    metadata = {},
  } = body;

  if (!userId || !rejectionType || !rejectionReason) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'userId, rejectionType, and rejectionReason are required' }),
    };
  }

  const validTypes = ['content_policy', 'rate_limit', 'token_limit', 'model_unavailable', 'safety_filter', 'domain_restriction', 'cost_limit', 'other'];
  if (!validTypes.includes(rejectionType)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: `Invalid rejection type. Must be one of: ${validTypes.join(', ')}` }),
    };
  }

  const validSeverities = ['info', 'warning', 'error', 'critical'];
  if (!validSeverities.includes(severity)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` }),
    };
  }

  const result = await executeStatement(`
    INSERT INTO thinktank_rejections (
      tenant_id, user_id, conversation_id, message_id,
      rejection_type, rejection_reason, original_prompt,
      model_id, severity, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id
  `, [
    stringParam('tenant_id', tenantId),
    stringParam('user_id', userId),
    conversationId ? stringParam('conversation_id', conversationId) : stringParam('conversation_id', ''),
    messageId ? stringParam('message_id', messageId) : stringParam('message_id', ''),
    stringParam('rejection_type', rejectionType),
    stringParam('rejection_reason', rejectionReason),
    originalPrompt ? stringParam('original_prompt', originalPrompt) : stringParam('original_prompt', ''),
    modelId ? stringParam('model_id', modelId) : stringParam('model_id', ''),
    stringParam('severity', severity),
    stringParam('metadata', JSON.stringify(metadata)),
  ]);

  return {
    statusCode: 201,
    headers: corsHeaders,
    body: JSON.stringify({ 
      success: true, 
      id: (result.rows[0] as Record<string, string>).id,
    }),
  };
}

async function markAsRead(
  tenantId: string,
  notificationId: string
): Promise<APIGatewayProxyResult> {
  await executeStatement(`
    UPDATE thinktank_rejections SET
      is_read = true,
      read_at = NOW()
    WHERE tenant_id = $1 AND id = $2
  `, [
    stringParam('tenant_id', tenantId),
    stringParam('id', notificationId),
  ]);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ success: true }),
  };
}

async function dismissRejection(
  tenantId: string,
  notificationId: string
): Promise<APIGatewayProxyResult> {
  await executeStatement(`
    UPDATE thinktank_rejections SET
      is_dismissed = true,
      dismissed_at = NOW()
    WHERE tenant_id = $1 AND id = $2
  `, [
    stringParam('tenant_id', tenantId),
    stringParam('id', notificationId),
  ]);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ success: true }),
  };
}
