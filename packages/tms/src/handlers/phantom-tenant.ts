/**
 * RADIANT TMS - Phantom Tenant Handler
 * POST /phantom-tenant
 * 
 * Creates an individual "phantom" tenant for new user signups.
 * Called during Cognito Post-Confirmation or first login.
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { tenantService } from '../services/tenant.service';
import { CreatePhantomTenantSchema } from '../types/tenant.types';
import { logger } from '../utils/logger';
import { extractContext, getCorsHeaders } from '../utils/context';

export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const origin = event.headers['Origin'] || event.headers['origin'];
  const corsHeaders = getCorsHeaders(origin);

  try {
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

    const validationResult = CreatePhantomTenantSchema.safeParse(body);
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

    // Create phantom tenant
    const result = await tenantService.createPhantomTenant(validationResult.data, ctx);

    logger.info({
      tenantId: result.tenantId,
      userId: result.userId,
      email: validationResult.data.userEmail,
      isExisting: result.isExisting,
    }, 'Phantom tenant operation completed');

    return {
      statusCode: result.isExisting ? 200 : 201,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: result,
        message: result.isExisting 
          ? 'User already exists, returned existing tenant'
          : 'Phantom tenant created successfully',
      }),
    };

  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'Error creating phantom tenant');

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'InternalServerError', message: 'An unexpected error occurred' }),
    };

  }
};
