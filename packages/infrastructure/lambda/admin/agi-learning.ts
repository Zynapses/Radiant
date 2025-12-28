// RADIANT v4.18.0 - AGI Learning Admin API
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { backgroundLearningService, ThrottleLevel } from '../shared/services/background-learning.service';
import { extractAuthContext } from '../shared/auth';
import { success, handleError } from '../shared/response';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const user = extractAuthContext(event);
    const path = event.path;
    const method = event.httpMethod;

    // GET /admin/agi-learning/status
    if (method === 'GET' && path.endsWith('/status')) {
      const status = await backgroundLearningService.getStatus(user.tenantId);
      return success(status);
    }

    // GET /admin/agi-learning/costs
    if (method === 'GET' && path.endsWith('/costs')) {
      const costs = await backgroundLearningService.getCosts(user.tenantId);
      return success(costs);
    }

    // GET /admin/agi-learning/config
    if (method === 'GET' && path.endsWith('/config')) {
      const config = await backgroundLearningService.getConfig(user.tenantId);
      return success(config);
    }

    // PUT /admin/agi-learning/config
    if (method === 'PUT' && path.endsWith('/config')) {
      const body = JSON.parse(event.body || '{}');
      await backgroundLearningService.saveConfig(user.tenantId, body);
      const config = await backgroundLearningService.getConfig(user.tenantId);
      return success(config);
    }

    // PUT /admin/agi-learning/throttle
    if (method === 'PUT' && path.endsWith('/throttle')) {
      const { level } = JSON.parse(event.body || '{}');
      await backgroundLearningService.setThrottle(user.tenantId, level as ThrottleLevel);
      return success({ throttleLevel: level });
    }

    // POST /admin/agi-learning/start
    if (method === 'POST' && path.endsWith('/start')) {
      await backgroundLearningService.startLearning(user.tenantId);
      return success({ started: true });
    }

    // POST /admin/agi-learning/stop
    if (method === 'POST' && path.endsWith('/stop')) {
      await backgroundLearningService.stopLearning(user.tenantId);
      return success({ stopped: true });
    }

    return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
  } catch (error) {
    return handleError(error);
  }
}
