// RADIANT v4.18.0 - Internet Learning Admin API
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { internetLearningService } from '../shared/services/internet-learning.service';
import { extractAuthContext } from '../shared/auth';
import { success, handleError } from '../shared/response';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const user = extractAuthContext(event);
    const path = event.path;
    const method = event.httpMethod;

    // GET /admin/internet-learning/config
    if (method === 'GET' && path.endsWith('/config')) {
      const config = await internetLearningService.getConfig(user.tenantId);
      return success(config);
    }

    // PUT /admin/internet-learning/config
    if (method === 'PUT' && path.endsWith('/config')) {
      const body = JSON.parse(event.body || '{}');
      await internetLearningService.saveConfig(user.tenantId, body);
      return success({ updated: true });
    }

    // GET /admin/internet-learning/sources
    if (method === 'GET' && path.endsWith('/sources')) {
      const sources = await internetLearningService.getSources(user.tenantId);
      return success({ sources });
    }

    // POST /admin/internet-learning/sources
    if (method === 'POST' && path.endsWith('/sources')) {
      const { url, type, priority } = JSON.parse(event.body || '{}');
      const sourceId = await internetLearningService.addSource(user.tenantId, url, type || 'knowledge_base', priority || 1);
      return success({ sourceId });
    }

    // POST /admin/internet-learning/fetch
    if (method === 'POST' && path.endsWith('/fetch')) {
      const { url } = JSON.parse(event.body || '{}');
      const content = await internetLearningService.fetchUrl(user.tenantId, url);
      return success({ fetched: !!content, contentLength: content?.length || 0 });
    }

    return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
  } catch (error) {
    return handleError(error);
  }
}
