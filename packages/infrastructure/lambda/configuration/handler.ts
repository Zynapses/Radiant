import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { configurationService } from '../shared/services';
import { extractAuthContext } from '../shared/auth';
import { success, handleError } from '../shared/response';
import { ValidationError } from '../shared/errors';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const user = extractAuthContext(event);
    const path = event.path;
    const method = event.httpMethod;

    // GET /configuration/categories - Get all categories
    if (method === 'GET' && path.endsWith('/categories')) {
      const categories = await configurationService.getCategories();
      return success({ categories });
    }

    // GET /configuration/:key - Get single config value
    if (method === 'GET' && path.includes('/configuration/') && !path.endsWith('/categories') && !path.endsWith('/audit')) {
      const key = path.split('/configuration/')[1];
      const config = await configurationService.getConfigWithMetadata(key, user.tenantId);
      
      if (!config) {
        throw new ValidationError(`Configuration not found: ${key}`);
      }

      return success(config);
    }

    // GET /configuration/category/:categoryId - Get configs by category
    if (method === 'GET' && path.includes('/category/')) {
      const categoryId = path.split('/category/')[1];
      const configs = await configurationService.getConfigsByCategory(categoryId, user.tenantId);
      return success({ configs });
    }

    // PUT /configuration/:key - Update config value (admin only)
    if (method === 'PUT' && path.includes('/configuration/')) {
      const key = path.split('/configuration/')[1];
      const body = JSON.parse(event.body || '{}');

      if (body.value === undefined) {
        throw new ValidationError('value is required');
      }

      await configurationService.setConfig(key, body.value, user.userId);
      return success({ updated: true });
    }

    // POST /configuration/override - Set tenant override
    if (method === 'POST' && path.endsWith('/override')) {
      const body = JSON.parse(event.body || '{}');

      if (!body.key || body.value === undefined) {
        throw new ValidationError('key and value are required');
      }

      await configurationService.setTenantOverride(
        user.tenantId,
        body.key,
        body.value,
        body.reason,
        user.userId,
        body.expiresAt ? new Date(body.expiresAt) : undefined
      );

      return success({ overrideSet: true });
    }

    // DELETE /configuration/override/:key - Remove tenant override
    if (method === 'DELETE' && path.includes('/override/')) {
      const key = path.split('/override/')[1];

      await configurationService.removeTenantOverride(user.tenantId, key, user.userId);
      return success({ overrideRemoved: true });
    }

    // GET /configuration/audit - Get audit log
    if (method === 'GET' && path.endsWith('/audit')) {
      const key = event.queryStringParameters?.key;
      const limit = parseInt(event.queryStringParameters?.limit || '50', 10);

      const auditLog = await configurationService.getAuditLog(key, user.tenantId, limit);
      return success({ auditLog });
    }

    throw new ValidationError(`Unknown route: ${method} ${path}`);
  } catch (error) {
    return handleError(error);
  }
}
