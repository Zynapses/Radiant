/**
 * RADIANT TMS - Create Tenant Handler
 * POST /tenants
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { tenantService } from '../services/tenant.service';
import { CreateTenantSchema } from '../types/tenant.types';
import { logger } from '../utils/logger';
import { extractContext, getCorsHeaders, errorResponse, successResponse } from '../utils/context';

export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const origin = event.headers['Origin'] || event.headers['origin'];
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Verify authorization
    const authHeader = event.headers['Authorization'] || event.headers['authorization'];
    if (!authHeader) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Unauthorized', message: 'Authorization header required' }),
      };
    }

    // For internal service calls or admin dashboard
    const isInternalService = authHeader.startsWith('Internal-Service-Token ');
    const isBearerToken = authHeader.startsWith('Bearer ');
    
    if (!isInternalService && !isBearerToken) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Unauthorized', message: 'Invalid authorization format' }),
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

    const validationResult = CreateTenantSchema.safeParse(body);
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

    const ctx = extractContext(event);

    // Create tenant
    const result = await tenantService.createTenant(validationResult.data, ctx);

    logger.info({ 
      tenantId: result.tenant.id, 
      adminEmail: validationResult.data.adminEmail 
    }, 'Tenant created via API');

    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: result,
      }),
    };

  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'Error creating tenant');

    // Handle specific errors
    if (err.message.includes('duplicate key') || err.message.includes('already exists')) {
      return {
        statusCode: 409,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Conflict', message: 'A tenant with this name already exists' }),
      };
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'InternalServerError', message: 'An unexpected error occurred' }),
    };

  }
};
