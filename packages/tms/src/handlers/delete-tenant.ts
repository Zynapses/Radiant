/**
 * RADIANT TMS - Delete Tenant Handler (Soft Delete)
 * DELETE /tenants/{tenantId}
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { tenantService } from '../services/tenant.service';
import { notificationService } from '../services/notification.service';
import { SoftDeleteTenantSchema } from '../types/tenant.types';
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

    // Only tenant owners or super admins can delete
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

    // Add initiatedBy from context if not provided
    const inputWithInitiator = {
      ...body as Record<string, unknown>,
      initiatedBy: (body as Record<string, unknown>).initiatedBy || ctx.userId || ctx.adminId,
    };

    const validationResult = SoftDeleteTenantSchema.safeParse(inputWithInitiator);
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

    // Soft delete tenant
    const result = await tenantService.softDeleteTenant(tenantId, validationResult.data, ctx);

    // Send notifications if requested
    if (validationResult.data.notifyUsers) {
      try {
        // Get all active users for this tenant
        const users = await executeStatement<{ email: string; displayName: string }>(
          `SELECT u.email, u.display_name as "displayName"
           FROM users u
           JOIN tenant_user_memberships m ON u.id = m.user_id
           WHERE m.tenant_id = $1::uuid AND m.status = 'active'`,
          [uuidParam('1', tenantId)]
        );

        const tenant = await tenantService.getTenantById(tenantId);
        
        if (users.length > 0 && tenant) {
          const daysRemaining = Math.ceil((new Date(result.deletionScheduledAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          const notificationType = daysRemaining >= 7 ? '7_day' : daysRemaining >= 3 ? '3_day' : '1_day';
          
          await notificationService.sendDeletionWarning(
            tenantId,
            tenant.displayName,
            users.map(u => ({ email: u.email, name: u.displayName })),
            daysRemaining,
            notificationType
          );
        }
      } catch (notifyError) {
        logger.error({ tenantId, error: notifyError }, 'Failed to send deletion notifications');
        // Don't fail the deletion operation
      }
    }

    logger.info({ tenantId, result }, 'Tenant soft deleted via API');

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
    logger.error({ error: err.message, stack: err.stack }, 'Error deleting tenant');

    if (err.message.includes('not found')) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'NotFound', message: 'Tenant not found' }),
      };
    }

    if (err.message.includes('cannot be deleted')) {
      return {
        statusCode: 409,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Conflict', message: err.message }),
      };
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'InternalServerError', message: 'An unexpected error occurred' }),
    };

  }
};
