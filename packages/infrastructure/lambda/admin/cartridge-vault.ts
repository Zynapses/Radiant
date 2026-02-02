/**
 * Cartridge Vault Admin API Handler
 * 
 * Manages secrets for the Keyhole Pattern - cartridges declare required
 * secrets but never contain credentials.
 * 
 * @version 1.0.0
 * @since v6.2.0
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { cartridgeVaultService } from '../shared/services/cartridge-vault.service';
import { logger } from '../shared/logging/enhanced-logger';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const path = event.path.replace(/^\/api\/admin\/vault/, '');
  const method = event.httpMethod;
  const tenantId = event.requestContext.authorizer?.tenantId || 'default';
  const userId = event.requestContext.authorizer?.userId || 'admin';

  logger.info('Vault API request', { path, method, tenantId });

  try {
    // GET /dashboard - Get vault dashboard
    if (method === 'GET' && path === '/dashboard') {
      const dashboard = await cartridgeVaultService.getDashboard(tenantId);
      return { statusCode: 200, headers, body: JSON.stringify(dashboard) };
    }

    // GET /secrets - List all secrets
    if (method === 'GET' && path === '/secrets') {
      const category = event.queryStringParameters?.category as any;
      const secrets = await cartridgeVaultService.listSecrets(tenantId, category);
      return { statusCode: 200, headers, body: JSON.stringify({ secrets }) };
    }

    // POST /secrets - Create a new secret
    if (method === 'POST' && path === '/secrets') {
      const body = JSON.parse(event.body || '{}');
      const secret = await cartridgeVaultService.createSecret(tenantId, body, userId);
      return { statusCode: 201, headers, body: JSON.stringify(secret) };
    }

    // GET /secrets/:key - Get secret metadata (not value)
    const secretKeyMatch = path.match(/^\/secrets\/([^/]+)$/);
    if (method === 'GET' && secretKeyMatch) {
      const key = decodeURIComponent(secretKeyMatch[1]);
      const secrets = await cartridgeVaultService.listSecrets(tenantId);
      const secret = secrets.find(s => s.key === key);
      if (!secret) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Secret not found' }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify(secret) };
    }

    // PUT /secrets/:key - Update a secret
    if (method === 'PUT' && secretKeyMatch) {
      const key = decodeURIComponent(secretKeyMatch[1]);
      const body = JSON.parse(event.body || '{}');
      const secret = await cartridgeVaultService.updateSecret(tenantId, key, body, userId);
      return { statusCode: 200, headers, body: JSON.stringify(secret) };
    }

    // DELETE /secrets/:key - Delete a secret
    if (method === 'DELETE' && secretKeyMatch) {
      const key = decodeURIComponent(secretKeyMatch[1]);
      await cartridgeVaultService.deleteSecret(tenantId, key, userId);
      return { statusCode: 204, headers, body: '' };
    }

    // POST /secrets/:key/rotate - Rotate a secret
    const rotateMatch = path.match(/^\/secrets\/([^/]+)\/rotate$/);
    if (method === 'POST' && rotateMatch) {
      const key = decodeURIComponent(rotateMatch[1]);
      const body = JSON.parse(event.body || '{}');
      const secret = await cartridgeVaultService.rotateSecret(tenantId, key, body, userId);
      return { statusCode: 200, headers, body: JSON.stringify(secret) };
    }

    // POST /check-requirements - Check vault requirements for a cartridge
    if (method === 'POST' && path === '/check-requirements') {
      const body = JSON.parse(event.body || '{}');
      const result = await cartridgeVaultService.checkRequirements(tenantId, body);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // POST /store-requirements - Store vault requirements from a cartridge
    if (method === 'POST' && path === '/store-requirements') {
      const body = JSON.parse(event.body || '{}');
      await cartridgeVaultService.storeRequirements(tenantId, body.cartridgeId, body.manifest);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found', path, method }),
    };
  } catch (error) {
    logger.error('Vault API error', { error: String(error), path, method });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: String(error) }),
    };
  }
}
