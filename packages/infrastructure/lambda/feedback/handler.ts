import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { feedbackLearningService } from '../shared/services';
import { extractAuthContext } from '../shared/auth';
import { success, handleError } from '../shared/response';
import { ValidationError } from '../shared/errors';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const user = extractAuthContext(event);
    const path = event.path;
    const method = event.httpMethod;

    // POST /feedback/manifest - Create execution manifest
    if (method === 'POST' && path.endsWith('/manifest')) {
      const body = JSON.parse(event.body || '{}');
      
      const outputId = await feedbackLearningService.createManifest({
        tenantId: user.tenantId,
        userId: user.userId,
        conversationId: body.conversationId,
        messageId: body.messageId,
        requestType: body.requestType || 'chat',
        taskType: body.taskType,
        domainMode: body.domainMode,
        modelsUsed: body.modelsUsed || [],
        modelVersions: body.modelVersions,
        orchestrationId: body.orchestrationId,
        orchestrationName: body.orchestrationName,
        servicesUsed: body.servicesUsed,
        thermalStates: body.thermalStates,
        providerHealth: body.providerHealth,
        brainReasoning: body.brainReasoning,
        brainConfidence: body.brainConfidence,
        wasUserOverride: body.wasUserOverride,
        inputTokens: body.inputTokens,
        outputTokens: body.outputTokens,
        totalLatencyMs: body.totalLatencyMs,
        timeToFirstTokenMs: body.timeToFirstTokenMs,
        totalCost: body.totalCost,
        wasStreamed: body.wasStreamed,
      });

      return success({ outputId });
    }

    // POST /feedback/explicit - Record explicit feedback
    if (method === 'POST' && path.endsWith('/explicit')) {
      const body = JSON.parse(event.body || '{}');
      
      if (!body.outputId || !body.rating) {
        throw new ValidationError('outputId and rating are required');
      }

      await feedbackLearningService.recordExplicitFeedback(
        body.outputId,
        user.tenantId,
        user.userId,
        body.rating,
        body.categories,
        body.textFeedback
      );

      return success({ recorded: true });
    }

    // POST /feedback/implicit - Record implicit signal
    if (method === 'POST' && path.endsWith('/implicit')) {
      const body = JSON.parse(event.body || '{}');
      
      if (!body.outputId || !body.signalType) {
        throw new ValidationError('outputId and signalType are required');
      }

      await feedbackLearningService.recordImplicitSignal(
        body.outputId,
        user.tenantId,
        user.userId,
        body.signalType,
        body.signalData
      );

      return success({ recorded: true });
    }

    // GET /feedback/score - Get model score
    if (method === 'GET' && path.endsWith('/score')) {
      const modelId = event.queryStringParameters?.modelId;
      const taskType = event.queryStringParameters?.taskType || 'general';
      const scope = event.queryStringParameters?.scope || 'user';

      if (!modelId) {
        throw new ValidationError('modelId is required');
      }

      const scopeId = scope === 'user' ? user.userId : (scope === 'tenant' ? user.tenantId : undefined);
      const score = await feedbackLearningService.getModelScore(modelId, taskType, scope as 'user' | 'tenant' | 'global', scopeId);

      return success({ score });
    }

    // POST /feedback/recommend - Get recommended model
    if (method === 'POST' && path.endsWith('/recommend')) {
      const body = JSON.parse(event.body || '{}');
      
      if (!body.taskType || !body.availableModels?.length) {
        throw new ValidationError('taskType and availableModels are required');
      }

      const recommendation = await feedbackLearningService.getRecommendedModel(
        body.taskType,
        user.tenantId,
        user.userId,
        body.availableModels
      );

      return success(recommendation);
    }

    throw new ValidationError(`Unknown route: ${method} ${path}`);
  } catch (error) {
    return handleError(error);
  }
}
