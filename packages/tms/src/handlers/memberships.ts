/**
 * RADIANT TMS - Membership Handlers
 * GET/POST/PUT/DELETE /tenants/{tenantId}/users
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { tenantService } from '../services/tenant.service';
import { AddMembershipSchema, UpdateMembershipSchema } from '../types/tenant.types';
import { logger } from '../utils/logger';
import { extractContext, getCorsHeaders, validateUUID } from '../utils/context';

/**
 * List tenant memberships
 * GET /tenants/{tenantId}/users
 */
export const listMembershipsHandler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const origin = event.headers['Origin'] || event.headers['origin'];
  const corsHeaders = getCorsHeaders(origin);

  try {
    const tenantId = event.pathParameters?.tenantId;
    if (!tenantId || !validateUUID(tenantId)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'BadRequest', message: 'Valid tenant ID required' }),
      };
    }

    const ctx = extractContext(event);
    
    // Check authorization
    if (!ctx.isSuperAdmin && ctx.tenantId !== tenantId) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Forbidden', message: 'Access denied to this tenant' }),
      };
    }

    const result = await tenantService.listMemberships(tenantId, ctx);

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
    logger.error({ error: err.message, stack: err.stack }, 'Error listing memberships');

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'InternalServerError', message: 'An unexpected error occurred' }),
    };

  }
};

/**
 * Add user to tenant
 * POST /tenants/{tenantId}/users
 */
export const addMembershipHandler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const origin = event.headers['Origin'] || event.headers['origin'];
  const corsHeaders = getCorsHeaders(origin);

  try {
    const tenantId = event.pathParameters?.tenantId;
    if (!tenantId || !validateUUID(tenantId)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'BadRequest', message: 'Valid tenant ID required' }),
      };
    }

    const ctx = extractContext(event);
    
    // Check authorization - only admins can add members
    if (!ctx.isSuperAdmin && ctx.tenantId !== tenantId) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Forbidden', message: 'Access denied to this tenant' }),
      };
    }

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

    const inputWithContext = {
      ...body as Record<string, unknown>,
      tenantId,
      invitedBy: (body as Record<string, unknown>).invitedBy || ctx.userId || ctx.adminId,
    };

    const validationResult = AddMembershipSchema.safeParse(inputWithContext);
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

    const result = await tenantService.addMembership(validationResult.data, ctx);

    logger.info({ tenantId, email: validationResult.data.userEmail }, 'Membership added');

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
    logger.error({ error: err.message, stack: err.stack }, 'Error adding membership');

    if (err.message.includes('already has membership')) {
      return {
        statusCode: 409,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Conflict', message: err.message }),
      };
    }

    if (err.message.includes('not found') || err.message.includes('deleted')) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'NotFound', message: err.message }),
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
 * Update membership
 * PUT /tenants/{tenantId}/users/{userId}
 */
export const updateMembershipHandler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const origin = event.headers['Origin'] || event.headers['origin'];
  const corsHeaders = getCorsHeaders(origin);

  try {
    const tenantId = event.pathParameters?.tenantId;
    const userId = event.pathParameters?.userId;
    
    if (!tenantId || !validateUUID(tenantId)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'BadRequest', message: 'Valid tenant ID required' }),
      };
    }
    if (!userId || !validateUUID(userId)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'BadRequest', message: 'Valid user ID required' }),
      };
    }

    const ctx = extractContext(event);
    
    // Check authorization
    if (!ctx.isSuperAdmin && ctx.tenantId !== tenantId) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Forbidden', message: 'Access denied to this tenant' }),
      };
    }

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

    const validationResult = UpdateMembershipSchema.safeParse(body);
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

    const result = await tenantService.updateMembership(tenantId, userId, validationResult.data, ctx);

    logger.info({ tenantId, userId }, 'Membership updated');

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
    logger.error({ error: err.message, stack: err.stack }, 'Error updating membership');

    if (err.message.includes('not found')) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'NotFound', message: 'Membership not found' }),
      };
    }

    if (err.message.includes('last owner')) {
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

/**
 * Remove user from tenant
 * DELETE /tenants/{tenantId}/users/{userId}
 */
export const removeMembershipHandler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const origin = event.headers['Origin'] || event.headers['origin'];
  const corsHeaders = getCorsHeaders(origin);

  try {
    const tenantId = event.pathParameters?.tenantId;
    const userId = event.pathParameters?.userId;
    
    if (!tenantId || !validateUUID(tenantId)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'BadRequest', message: 'Valid tenant ID required' }),
      };
    }
    if (!userId || !validateUUID(userId)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'BadRequest', message: 'Valid user ID required' }),
      };
    }

    const ctx = extractContext(event);
    
    // Check authorization
    if (!ctx.isSuperAdmin && ctx.tenantId !== tenantId) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Forbidden', message: 'Access denied to this tenant' }),
      };
    }

    await tenantService.removeMembership(tenantId, userId, ctx);

    logger.info({ tenantId, userId }, 'Membership removed');

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Membership removed successfully',
      }),
    };

  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'Error removing membership');

    if (err.message.includes('not found')) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'NotFound', message: 'Membership not found' }),
      };
    }

    if (err.message.includes('last owner')) {
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
