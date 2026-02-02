/**
 * Cartridge Operations Admin API Handler
 * 
 * Manages long-running cartridge operations with Time Machine integration
 * for checkpointing and resume capability.
 * 
 * @version 1.0.0
 * @since v6.2.0
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { cartridgeOperationsService } from '../shared/services/cartridge-operations.service';
import { logger } from '../shared/logging/enhanced-logger';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const path = event.path.replace(/^\/api\/admin\/cartridge-operations/, '');
  const method = event.httpMethod;
  const tenantId = event.requestContext.authorizer?.tenantId || 'default';
  const userId = event.requestContext.authorizer?.userId || 'admin';

  logger.info('Cartridge Operations API request', { path, method, tenantId });

  try {
    // GET /dashboard - Get operations dashboard
    if (method === 'GET' && path === '/dashboard') {
      const dashboard = await cartridgeOperationsService.getDashboard(tenantId);
      return { statusCode: 200, headers, body: JSON.stringify(dashboard) };
    }

    // GET / - List operations
    if (method === 'GET' && (path === '' || path === '/')) {
      const status = event.queryStringParameters?.status as any;
      const type = event.queryStringParameters?.type as any;
      const limit = parseInt(event.queryStringParameters?.limit || '20', 10);
      const offset = parseInt(event.queryStringParameters?.offset || '0', 10);
      
      const operations = await cartridgeOperationsService.listOperations(tenantId, {
        status,
        type,
        limit,
        offset,
      });
      return { statusCode: 200, headers, body: JSON.stringify({ operations }) };
    }

    // POST / - Start a new operation
    if (method === 'POST' && (path === '' || path === '/')) {
      const body = JSON.parse(event.body || '{}');
      const operation = await cartridgeOperationsService.startOperation(tenantId, userId, body);
      return { statusCode: 201, headers, body: JSON.stringify(operation) };
    }

    // GET /:id - Get operation details
    const opMatch = path.match(/^\/([^/]+)$/);
    if (method === 'GET' && opMatch) {
      const operationId = opMatch[1];
      const operation = await cartridgeOperationsService.getOperation(operationId, tenantId);
      return { statusCode: 200, headers, body: JSON.stringify(operation) };
    }

    // GET /:id/events - Get operation events
    const eventsMatch = path.match(/^\/([^/]+)\/events$/);
    if (method === 'GET' && eventsMatch) {
      const operationId = eventsMatch[1];
      const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
      const events = await cartridgeOperationsService.getEvents(operationId, limit);
      return { statusCode: 200, headers, body: JSON.stringify({ events }) };
    }

    // POST /:id/pause - Pause operation
    const pauseMatch = path.match(/^\/([^/]+)\/pause$/);
    if (method === 'POST' && pauseMatch) {
      const operationId = pauseMatch[1];
      await cartridgeOperationsService.pauseOperation(operationId, tenantId);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // POST /:id/resume - Resume operation
    const resumeMatch = path.match(/^\/([^/]+)\/resume$/);
    if (method === 'POST' && resumeMatch) {
      const operationId = resumeMatch[1];
      const body = JSON.parse(event.body || '{}');
      const operation = await cartridgeOperationsService.resumeOperation(tenantId, {
        operationId,
        ...body,
      });
      return { statusCode: 200, headers, body: JSON.stringify(operation) };
    }

    // POST /:id/cancel - Cancel operation
    const cancelMatch = path.match(/^\/([^/]+)\/cancel$/);
    if (method === 'POST' && cancelMatch) {
      const operationId = cancelMatch[1];
      const body = JSON.parse(event.body || '{}');
      await cartridgeOperationsService.cancelOperation(operationId, tenantId, body.reason || 'User cancelled');
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // POST /:id/rollback - Rollback operation
    const rollbackMatch = path.match(/^\/([^/]+)\/rollback$/);
    if (method === 'POST' && rollbackMatch) {
      const operationId = rollbackMatch[1];
      const body = JSON.parse(event.body || '{}');
      const operation = await cartridgeOperationsService.rollbackOperation(tenantId, {
        operationId,
        checkpointId: body.checkpointId,
        reason: body.reason,
      });
      return { statusCode: 200, headers, body: JSON.stringify(operation) };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found', path, method }),
    };
  } catch (error) {
    logger.error('Cartridge Operations API error', { error: String(error), path, method });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: String(error) }),
    };
  }
}
