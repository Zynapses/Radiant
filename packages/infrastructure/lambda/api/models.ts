/**
 * Models Handler
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Logger } from '../shared/logger';
import { successResponse, errorResponse } from '../shared/response';
import { NotFoundError } from '../shared/errors';
import { listModels, getModelById } from '../shared/db';

const logger = new Logger({ handler: 'models' });

export async function handleModels(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const modelId = event.pathParameters?.modelId;

  if (modelId) {
    return getModel(modelId);
  }

  return listAllModels(event);
}

async function getModel(modelId: string): Promise<APIGatewayProxyResult> {
  logger.info('Get model', { modelId });

  const model = await getModelById(modelId);
  
  if (!model) {
    return errorResponse(new NotFoundError(`Model not found: ${modelId}`));
  }

  return successResponse({
    id: model.id,
    object: 'model',
    created: Date.parse(model.created_at) / 1000,
    owned_by: model.provider_id,
    name: model.name,
    display_name: model.display_name,
    category: model.category,
    capabilities: model.capabilities,
    context_window: model.context_window,
    max_output_tokens: model.max_output_tokens,
    pricing: {
      input_per_1k: model.input_cost_per_1k,
      output_per_1k: model.output_cost_per_1k,
    },
    status: model.status,
  });
}

async function listAllModels(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const category = event.queryStringParameters?.category;
  const status = event.queryStringParameters?.status || 'active';

  logger.info('List models', { category, status });

  const models = await listModels(category, status);

  return successResponse({
    object: 'list',
    data: models.map(model => ({
      id: model.id,
      object: 'model',
      created: Date.parse(model.created_at) / 1000,
      owned_by: model.provider_id,
      name: model.name,
      display_name: model.display_name,
      category: model.category,
      capabilities: model.capabilities,
      context_window: model.context_window,
      max_output_tokens: model.max_output_tokens,
      pricing: {
        input_per_1k: model.input_cost_per_1k,
        output_per_1k: model.output_cost_per_1k,
      },
      status: model.status,
    })),
  });
}
