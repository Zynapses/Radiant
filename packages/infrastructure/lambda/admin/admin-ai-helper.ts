// RADIANT v4.18.0 - Admin AI Helper API
// Admin endpoints for the Bedrock-powered AI assistant
// Base: /api/admin/ai-helper/*
// ============================================================================

import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createRegisteredLogger } from '../shared/services/logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'admin/admin-ai-helper',
  category: 'audit',
  sourceType: 'lambda',
});
import { adminAIHelperService } from '../shared/services/admin-ai-helper.service';

// ============================================================================
// Response Helpers
// ============================================================================

const jsonResponse = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(body),
});

const getTenantId = (event: APIGatewayProxyEvent): string =>
  event.requestContext.authorizer?.tenantId || event.headers['x-tenant-id'] || '';

const getUserId = (event: APIGatewayProxyEvent): string =>
  event.requestContext.authorizer?.userId || event.headers['x-user-id'] || '';

// ============================================================================
// Handler
// ============================================================================

export const handler: APIGatewayProxyHandler = async (event) => {
  const { httpMethod, path, body } = event;
  const tenantId = getTenantId(event);
  const userId = getUserId(event);

  if (!tenantId) {
    return jsonResponse(401, { error: 'Unauthorized - tenant ID required' });
  }

  logger.info('Admin AI Helper API request', { method: httpMethod, path, tenantId });

  try {
    const segments = path.replace(/^\/api\/admin\/ai-helper\/?/, '').split('/').filter(Boolean);
    const action = segments[0] || '';

    // POST /api/admin/ai-helper/chat
    if (httpMethod === 'POST' && action === 'chat') {
      const { message, adminPage, pageContext, conversationHistory, maxTokens, temperature } = body ? JSON.parse(body) : {};

      if (!message || !adminPage) {
        return jsonResponse(400, { error: 'message and adminPage are required' });
      }

      const response = await adminAIHelperService.chat({
        tenantId,
        userId,
        adminPage,
        message,
        pageContext,
        conversationHistory,
        maxTokens,
        temperature,
      });

      return jsonResponse(200, response);
    }

    // GET /api/admin/ai-helper/history?page=xxx
    if (httpMethod === 'GET' && action === 'history') {
      const qs = event.queryStringParameters || {};
      const adminPage = qs.page || 'default';
      const limit = Number(qs.limit || 50);

      const history = await adminAIHelperService.getConversationHistory(tenantId, userId, adminPage, limit);
      return jsonResponse(200, { history });
    }

    // DELETE /api/admin/ai-helper/history?page=xxx
    if (httpMethod === 'DELETE' && action === 'history') {
      const qs = event.queryStringParameters || {};
      const adminPage = qs.page || 'default';

      await adminAIHelperService.clearConversation(tenantId, userId, adminPage);
      return jsonResponse(200, { success: true });
    }

    // GET /api/admin/ai-helper/usage
    if (httpMethod === 'GET' && action === 'usage') {
      const summary = await adminAIHelperService.getUsageSummary(tenantId);
      return jsonResponse(200, summary);
    }

    return jsonResponse(404, { error: 'Not found', path });
  } catch (error) {
    logger.error('Admin AI Helper API error', { error: String(error), path });
    return jsonResponse(500, { error: error instanceof Error ? error.message : 'Internal server error' });
  }
};
