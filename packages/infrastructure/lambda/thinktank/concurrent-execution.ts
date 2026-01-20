/**
 * Concurrent Task Execution API Handler
 * 
 * Moat #17: Split-pane UI (2-4 simultaneous tasks), WebSocket multiplexing,
 * background queue with progress tracking.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { concurrentExecutionService } from '../shared/services/concurrent-execution.service';

const logger = new Logger({ serviceName: 'concurrent-execution-api' });

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const tenantId = event.requestContext.authorizer?.tenantId;
  const userId = event.requestContext.authorizer?.userId;

  if (!tenantId || !userId) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  const path = event.path.replace('/api/thinktank/concurrent', '');
  const method = event.httpMethod;

  try {
    // GET /config - Get configuration
    if (path === '/config' && method === 'GET') {
      const config = await concurrentExecutionService.getConfig(tenantId);
      return {
        statusCode: 200,
        body: JSON.stringify(config),
      };
    }

    // PUT /config - Update configuration
    if (path === '/config' && method === 'PUT') {
      const updates = JSON.parse(event.body || '{}');
      const config = await concurrentExecutionService.updateConfig(tenantId, updates);
      return {
        statusCode: 200,
        body: JSON.stringify(config),
      };
    }

    // POST /tasks - Create a new task
    if (path === '/tasks' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const task = await concurrentExecutionService.createTask(
        tenantId,
        userId,
        body.sessionId,
        body.paneId,
        body.taskType,
        body.prompt,
        {
          priority: body.priority,
          modelId: body.modelId,
          metadata: body.metadata,
        }
      );
      return {
        statusCode: 201,
        body: JSON.stringify(task),
      };
    }

    // GET /tasks/:taskId - Get task status
    const taskMatch = path.match(/^\/tasks\/([^/]+)$/);
    if (taskMatch && method === 'GET') {
      const taskId = taskMatch[1];
      const task = await concurrentExecutionService.getTaskStatus(tenantId, userId, taskId);
      if (!task) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Task not found' }),
        };
      }
      return {
        statusCode: 200,
        body: JSON.stringify(task),
      };
    }

    // DELETE /tasks/:taskId - Cancel task
    if (taskMatch && method === 'DELETE') {
      const taskId = taskMatch[1];
      const cancelled = await concurrentExecutionService.cancelTask(tenantId, userId, taskId);
      return {
        statusCode: cancelled ? 200 : 404,
        body: JSON.stringify({ cancelled }),
      };
    }

    // GET /queue - Get queue status
    if (path === '/queue' && method === 'GET') {
      const queue = await concurrentExecutionService.getQueueStatus(tenantId, userId);
      return {
        statusCode: 200,
        body: JSON.stringify(queue || { queuedTasks: [], runningTasks: [], completedTasks: [] }),
      };
    }

    // POST /panes - Create split pane configuration
    if (path === '/panes' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const config = await concurrentExecutionService.createSplitPaneConfig(
        userId,
        body.layout || 'horizontal-2'
      );
      return {
        statusCode: 201,
        body: JSON.stringify(config),
      };
    }

    // POST /compare - Compare tasks
    if (path === '/compare' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const comparison = await concurrentExecutionService.compareTasks(
        tenantId,
        body.taskIds
      );
      return {
        statusCode: 200,
        body: JSON.stringify(comparison),
      };
    }

    // POST /merge - Merge tasks
    if (path === '/merge' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const merged = await concurrentExecutionService.mergeTasks(
        tenantId,
        body.taskIds,
        body.strategy || 'best-of'
      );
      return {
        statusCode: 200,
        body: JSON.stringify({ merged }),
      };
    }

    // GET /metrics - Get metrics
    if (path === '/metrics' && method === 'GET') {
      const period = event.queryStringParameters?.period || 'day';
      const metrics = await concurrentExecutionService.getMetrics(tenantId, period);
      return {
        statusCode: 200,
        body: JSON.stringify(metrics),
      };
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Not found' }),
    };
  } catch (error) {
    logger.error('Error in concurrent execution handler', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: (error as Error).message }),
    };
  }
}
