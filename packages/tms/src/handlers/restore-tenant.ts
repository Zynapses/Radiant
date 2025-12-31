/**
 * RADIANT TMS - Restore Tenant Handler
 * POST /tenants/{tenantId}/restore
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { tenantService } from '../services/tenant.service';
import { notificationService } from '../services/notification.service';
import { RestoreTenantSchema } from '../types/tenant.types';
import { logger } from '../utils/logger';
import { executeStatement, uuidParam } from '../utils/db';
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

    // Add restoredBy from context if not provided
    const inputWithRestorer = {
      ...body as Record<string, unknown>,
      restoredBy: (body as Record<string, unknown>).restoredBy || ctx.userId || ctx.adminId,
    };

    const validationResult = RestoreTenantSchema.safeParse(inputWithRestorer);
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

    // Restore tenant
    const result = await tenantService.restoreTenant(tenantId, validationResult.data, ctx);

    logger.info({ tenantId, result }, 'Tenant restored via API');

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
    logger.error({ error: err.message, stack: err.stack }, 'Error restoring tenant');

    if (err.message.includes('not found')) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'NotFound', message: 'Tenant not found' }),
      };
    }

    if (err.message.includes('not pending deletion')) {
      return {
        statusCode: 409,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Conflict', message: err.message }),
      };
    }

    if (err.message.includes('verification') || err.message.includes('Invalid')) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Forbidden', message: err.message }),
      };
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'InternalServerError', message: 'An unexpected error occurred' }),
    };

  }
};

/**
 * Request Verification Code Handler
 * POST /tenants/{tenantId}/restore/request-code
 */
export const requestCodeHandler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const origin = event.headers['Origin'] || event.headers['origin'];
  const corsHeaders = getCorsHeaders(origin);

  try {
    const tenantId = event.pathParameters?.tenantId;
    if (!tenantId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'BadRequest', message: 'Tenant ID required' }),
      };
    }

    const ctx = extractContext(event);
    
    // Get tenant and user info
    const tenant = await tenantService.getTenantById(tenantId);
    if (!tenant) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'NotFound', message: 'Tenant not found' }),
      };
    }

    if (tenant.status !== 'pending_deletion') {
      return {
        statusCode: 409,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Conflict', message: 'Tenant is not pending deletion' }),
      };
    }

    // Get requestor's email
    const user = await executeStatement<{ email: string; displayName: string }>(
      `SELECT email, display_name as "displayName" FROM users WHERE id = $1::uuid`,
      [uuidParam('1', ctx.userId || '')]
    );

    if (!user || user.length === 0) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Forbidden', message: 'User not found' }),
      };
    }

    // Create verification code
    const code = await tenantService.createVerificationCode(
      ctx.userId || null,
      ctx.adminId || null,
      'restore_tenant',
      tenantId,
      15 // 15 minutes expiry
    );

    // Send verification code via email
    await notificationService.sendVerificationCode(
      { email: user[0].email, name: user[0].displayName },
      code,
      'restore_tenant',
      tenant.displayName,
      15
    );

    logger.info({ tenantId, email: user[0].email }, 'Restore verification code sent');

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Verification code sent to your email',
        expiresInMinutes: 15,
      }),
    };

  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'Error requesting restore code');

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'InternalServerError', message: 'An unexpected error occurred' }),
    };

  }
};
