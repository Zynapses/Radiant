/**
 * RADIANT TMS - List Tenants Handler
 * GET /tenants
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { tenantService } from '../services/tenant.service';
import { ListTenantsSchema } from '../types/tenant.types';
import { logger } from '../utils/logger';
import { extractContext, getCorsHeaders } from '../utils/context';

export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const origin = event.headers['Origin'] || event.headers['origin'];
  const corsHeaders = getCorsHeaders(origin);

  try {
    const ctx = extractContext(event);

    // Only super admins can list all tenants
    if (!ctx.isSuperAdmin) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Forbidden', message: 'Super admin access required to list all tenants' }),
      };
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const input = {
      status: queryParams.status,
      type: queryParams.type,
      tier: queryParams.tier ? parseInt(queryParams.tier, 10) : undefined,
      limit: queryParams.limit ? parseInt(queryParams.limit, 10) : 50,
      offset: queryParams.offset ? parseInt(queryParams.offset, 10) : 0,
      search: queryParams.search,
      orderBy: queryParams.orderBy || 'created_at',
      orderDir: queryParams.orderDir || 'desc',
    };

    const validationResult = ListTenantsSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'ValidationError',
          message: 'Invalid query parameters',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        }),
      };
    }

    const result = await tenantService.listTenants(validationResult.data, ctx);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: result,
      }),
    };

  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'Error listing tenants');

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'InternalServerError', message: 'An unexpected error occurred' }),
    };

  }
};
