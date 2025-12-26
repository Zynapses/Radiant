import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { neuralOrchestrationService } from '../shared/services';
import { extractAuthContext } from '../shared/auth';
import { success, handleError } from '../shared/response';
import { ValidationError } from '../shared/errors';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const user = extractAuthContext(event);
    const path = event.path;
    const method = event.httpMethod;

    // POST /orchestration/match-patterns - Find matching patterns
    if (method === 'POST' && path.endsWith('/match-patterns')) {
      const body = JSON.parse(event.body || '{}');
      
      if (!body.query) {
        throw new ValidationError('query is required');
      }

      const patterns = await neuralOrchestrationService.findMatchingPatterns(
        body.query,
        body.limit || 5,
        body.minSimilarity || 0.7
      );

      return success({ patterns });
    }

    // POST /orchestration/match-workflows - Find matching workflows
    if (method === 'POST' && path.endsWith('/match-workflows')) {
      const body = JSON.parse(event.body || '{}');
      
      if (!body.query) {
        throw new ValidationError('query is required');
      }

      const workflows = await neuralOrchestrationService.findMatchingWorkflows(
        body.query,
        body.limit || 5,
        body.minSimilarity || 0.7
      );

      return success({ workflows });
    }

    // POST /orchestration/select - Select best orchestration
    if (method === 'POST' && path.endsWith('/select')) {
      const body = JSON.parse(event.body || '{}');
      
      if (!body.query || !body.taskType) {
        throw new ValidationError('query and taskType are required');
      }

      const selection = await neuralOrchestrationService.selectOrchestration(
        user.tenantId,
        user.userId,
        body.query,
        body.taskType,
        body.constraints
      );

      return success(selection);
    }

    // GET /orchestration/user-model - Get user neural model
    if (method === 'GET' && path.endsWith('/user-model')) {
      const model = await neuralOrchestrationService.getOrCreateUserNeuralModel(
        user.tenantId,
        user.userId
      );

      return success(model);
    }

    // POST /orchestration/user-preferences - Update user preferences
    if (method === 'POST' && path.endsWith('/user-preferences')) {
      const body = JSON.parse(event.body || '{}');

      await neuralOrchestrationService.updateUserPreferences(
        user.tenantId,
        user.userId,
        {
          modelId: body.modelId,
          modelScore: body.modelScore,
          patternId: body.patternId,
          workflowId: body.workflowId,
        }
      );

      return success({ updated: true });
    }

    // GET /orchestration/pattern-categories - Get pattern categories
    if (method === 'GET' && path.endsWith('/pattern-categories')) {
      const categories = await neuralOrchestrationService.getPatternCategories();
      return success({ categories });
    }

    // GET /orchestration/workflow-categories - Get workflow categories
    if (method === 'GET' && path.endsWith('/workflow-categories')) {
      const categories = await neuralOrchestrationService.getWorkflowCategories();
      return success({ categories });
    }

    // GET /orchestration/patterns/:categoryId - Get patterns by category
    if (method === 'GET' && path.includes('/patterns/')) {
      const categoryId = path.split('/patterns/')[1];
      const patterns = await neuralOrchestrationService.getPatternsByCategory(categoryId);
      return success({ patterns });
    }

    // GET /orchestration/workflows/:categoryId - Get workflows by category
    if (method === 'GET' && path.includes('/workflows/')) {
      const categoryId = path.split('/workflows/')[1];
      const workflows = await neuralOrchestrationService.getWorkflowsByCategory(categoryId);
      return success({ workflows });
    }

    // POST /orchestration/record-pattern-usage - Record pattern usage
    if (method === 'POST' && path.endsWith('/record-pattern-usage')) {
      const body = JSON.parse(event.body || '{}');
      
      if (!body.patternId) {
        throw new ValidationError('patternId is required');
      }

      await neuralOrchestrationService.recordPatternUsage(body.patternId, body.satisfactionScore);
      return success({ recorded: true });
    }

    // POST /orchestration/record-workflow-usage - Record workflow usage
    if (method === 'POST' && path.endsWith('/record-workflow-usage')) {
      const body = JSON.parse(event.body || '{}');
      
      if (!body.workflowId) {
        throw new ValidationError('workflowId is required');
      }

      await neuralOrchestrationService.recordWorkflowUsage(body.workflowId, body.qualityScore);
      return success({ recorded: true });
    }

    throw new ValidationError(`Unknown route: ${method} ${path}`);
  } catch (error) {
    return handleError(error);
  }
}
