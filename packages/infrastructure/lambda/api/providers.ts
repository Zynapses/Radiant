/**
 * Providers Handler
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Logger } from '../shared/logger';
import { successResponse, errorResponse } from '../shared/response';
import { NotFoundError } from '../shared/errors';
import { listProviders, getProviderById } from '../shared/db';

const logger = new Logger({ handler: 'providers' });

export async function handleProviders(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const providerId = event.pathParameters?.providerId;

  if (providerId) {
    return getProvider(providerId);
  }

  return listAllProviders(event);
}

async function getProvider(providerId: string): Promise<APIGatewayProxyResult> {
  logger.info('Get provider', { providerId });

  const provider = await getProviderById(providerId);
  
  if (!provider) {
    return errorResponse(new NotFoundError(`Provider not found: ${providerId}`));
  }

  return successResponse({
    id: provider.id,
    name: provider.name,
    display_name: provider.display_name,
    type: provider.type,
    category: provider.category,
    status: provider.status,
    health_status: provider.health_status,
    created_at: provider.created_at,
  });
}

async function listAllProviders(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const status = event.queryStringParameters?.status;

  logger.info('List providers', { status });

  const providers = await listProviders(status);

  return successResponse({
    object: 'list',
    data: providers.map(provider => ({
      id: provider.id,
      name: provider.name,
      display_name: provider.display_name,
      type: provider.type,
      category: provider.category,
      status: provider.status,
      health_status: provider.health_status,
      created_at: provider.created_at,
    })),
  });
}
