// RADIANT v5.35.0 - Council of Rivals Admin API
// War Room backend for multi-agent adversarial debates

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { councilOfRivalsService } from '../shared/services/council-of-rivals.service';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-Id',
};

function success(data: unknown): APIGatewayProxyResult {
  return { statusCode: 200, headers, body: JSON.stringify(data) };
}

function error(statusCode: number, message: string): APIGatewayProxyResult {
  return { statusCode, headers, body: JSON.stringify({ error: message }) };
}

export const handler: APIGatewayProxyHandler = async (event) => {
  const tenantId = event.requestContext.authorizer?.claims?.['custom:tenant_id'] 
    || event.headers['X-Tenant-Id'] 
    || 'default';
  
  const path = event.path.replace('/api/admin/council', '');
  const method = event.httpMethod;

  logger.info('Council API request', { path, method, tenantId });

  try {
    // GET /list - List all councils
    if (method === 'GET' && path === '/list') {
      const councils = await councilOfRivalsService.listCouncils(tenantId);
      return success(councils);
    }

    // GET /presets - Get preset council configurations
    if (method === 'GET' && path === '/presets') {
      const presets = await councilOfRivalsService.getPresetConfigurations();
      return success(presets);
    }

    // POST / - Create a new council
    if (method === 'POST' && path === '') {
      const body = JSON.parse(event.body || '{}');
      const council = await councilOfRivalsService.createCouncil(tenantId, {
        name: body.name,
        description: body.description || '',
        members: body.members,
        moderator: body.moderator,
        rules: body.rules,
        createdBy: event.requestContext.authorizer?.claims?.sub || 'admin',
      });
      return success(council);
    }

    // POST /from-preset - Create council from preset
    if (method === 'POST' && path === '/from-preset') {
      const body = JSON.parse(event.body || '{}');
      const council = await councilOfRivalsService.createFromPreset(
        tenantId,
        body.preset,
        event.requestContext.authorizer?.claims?.sub || 'admin'
      );
      return success(council);
    }

    // GET /:councilId - Get a specific council
    const councilIdMatch = path.match(/^\/([^/]+)$/);
    if (method === 'GET' && councilIdMatch && !path.includes('/debates')) {
      const councilId = councilIdMatch[1];
      const council = await councilOfRivalsService.getCouncil(tenantId, councilId);
      if (!council) {
        return error(404, 'Council not found');
      }
      return success(council);
    }

    // DELETE /:councilId - Delete a council
    if (method === 'DELETE' && councilIdMatch) {
      const councilId = councilIdMatch[1];
      await councilOfRivalsService.deleteCouncil(tenantId, councilId);
      return success({ deleted: true });
    }

    // ============================================================
    // Debate endpoints
    // ============================================================

    // GET /debates/recent - Get recent debates across all councils
    if (method === 'GET' && path === '/debates/recent') {
      const limit = parseInt(event.queryStringParameters?.limit || '10');
      const debates = await councilOfRivalsService.getRecentDebates(tenantId, limit);
      return success(debates);
    }

    // POST /debates - Start a new debate
    if (method === 'POST' && path === '/debates') {
      const body = JSON.parse(event.body || '{}');
      const debate = await councilOfRivalsService.startDebate(
        tenantId,
        body.councilId,
        body.topic,
        body.context || ''
      );
      return success(debate);
    }

    // GET /debates/:debateId - Get a specific debate
    const debateIdMatch = path.match(/^\/debates\/([^/]+)$/);
    if (method === 'GET' && debateIdMatch) {
      const debateId = debateIdMatch[1];
      const debate = await councilOfRivalsService.getDebate(tenantId, debateId);
      if (!debate) {
        return error(404, 'Debate not found');
      }
      return success(debate);
    }

    // POST /debates/:debateId/advance - Advance debate to next round
    const advanceMatch = path.match(/^\/debates\/([^/]+)\/advance$/);
    if (method === 'POST' && advanceMatch) {
      const debateId = advanceMatch[1];
      const debate = await councilOfRivalsService.advanceDebate(tenantId, debateId);
      return success(debate);
    }

    // POST /debates/:debateId/conclude - Force conclude a debate
    const concludeMatch = path.match(/^\/debates\/([^/]+)\/conclude$/);
    if (method === 'POST' && concludeMatch) {
      const debateId = concludeMatch[1];
      const debate = await councilOfRivalsService.concludeDebate(tenantId, debateId);
      return success(debate);
    }

    // POST /debates/:debateId/cancel - Cancel a debate
    const cancelMatch = path.match(/^\/debates\/([^/]+)\/cancel$/);
    if (method === 'POST' && cancelMatch) {
      const debateId = cancelMatch[1];
      await councilOfRivalsService.cancelDebate(tenantId, debateId);
      return success({ cancelled: true });
    }

    // ============================================================
    // Statistics endpoints
    // ============================================================

    // GET /statistics - Get debate statistics
    if (method === 'GET' && path === '/statistics') {
      const stats = await councilOfRivalsService.getStatistics(tenantId);
      return success(stats);
    }

    return error(404, `Unknown endpoint: ${method} ${path}`);
  } catch (err) {
    logger.error('Council API error', { path, method, error: err });
    return error(500, err instanceof Error ? err.message : 'Internal server error');
  }
};
