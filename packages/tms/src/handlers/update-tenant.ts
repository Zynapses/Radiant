/**
 * RADIANT TMS - Update Tenant Handler
 * PUT /tenants/{tenantId}
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { tenantService } from '../services/tenant.service';
import { UpdateTenantSchema } from '../types/tenant.types';
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

    // Check authorization - only tenant admins or super admins can update
    if (!ctx.isSuperAdmin && ctx.tenantId !== tenantId) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Forbidden', message: 'Access denied to this tenant' }),
      };
    }

    // Parse and validate input
    let body: unknown;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'BadRequest', message: 'Invalid JSON body' }),
      };
    }

    const validationResult = UpdateTenantSchema.safeParse(body);
    if (!validationResult.success) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'ValidationError',
          message: 'Validation failed',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        }),
      };
    }

    // Check if any updates provided
    if (Object.keys(validationResult.data).length === 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'BadRequest', message: 'No update fields provided' }),
      };
    }

    // Tier changes require super admin
    if (validationResult.data.tier !== undefined && !ctx.isSuperAdmin) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Forbidden', message: 'Tier changes require administrator privileges' }),
      };
    }

    // Update tenant
    const tenant = await tenantService.updateTenant(tenantId, validationResult.data, ctx);

    logger.info({ tenantId }, 'Tenant updated via API');

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
    logger.error({ error: err.message, stack: err.stack }, 'Error updating tenant');

    if (err.message.includes('not found')) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'NotFound', message: 'Tenant not found' }),
      };
    }

    if (err.message.includes('HIPAA')) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'BadRequest', message: err.message }),
      };
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'InternalServerError', message: 'An unexpected error occurred' }),
    };

  }
};
