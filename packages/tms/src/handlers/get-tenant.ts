/**
 * RADIANT TMS - Get Tenant Handler
 * GET /tenants/{tenantId}
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { tenantService } from '../services/tenant.service';
import { logger } from '../utils/logger';
import { extractContext, getCorsHeaders, validateUUID } from '../utils/context';

export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const origin = event.headers['Origin'] || event.headers['origin'];
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Get tenant ID from path
    const tenantId = event.pathParameters?.tenantId;
    if (!tenantId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'BadRequest', message: 'Tenant ID required' }),
      };
    }

    // Validate UUID format
    if (!validateUUID(tenantId)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'BadRequest', message: 'Invalid tenant ID format' }),
      };
    }

    const ctx = extractContext(event);

    // Check authorization - user can only get their own tenant unless super admin
    if (!ctx.isSuperAdmin && ctx.tenantId !== tenantId) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Forbidden', message: 'Access denied to this tenant' }),
      };
    }

    // Determine if we need summary (with user counts) or basic tenant
    const includeSummary = event.queryStringParameters?.summary === 'true';

    const tenant = includeSummary 
      ? await tenantService.getTenantSummary(tenantId)
      : await tenantService.getTenantById(tenantId);

    if (!tenant) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'NotFound', message: 'Tenant not found' }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: tenant,
      }),
    };

  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'Error getting tenant');

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'InternalServerError', message: 'An unexpected error occurred' }),
    };

  }
};
