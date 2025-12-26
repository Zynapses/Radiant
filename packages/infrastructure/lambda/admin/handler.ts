/**
 * Admin Lambda Handler
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Logger } from '../shared/logger';
import { successResponse, errorResponse } from '../shared/response';
import { UnauthorizedError, NotFoundError, ValidationError, ForbiddenError } from '../shared/errors';
import { extractAuthContext, requireAdmin } from '../shared/auth';
import {
  listTenants,
  getTenantById,
  createTenant,
  listUsersByTenant,
  listAdministrators,
  getAdministratorById,
  listPendingInvitations,
  listPendingApprovalRequests,
  listAuditLogs,
  getUsageStats,
  listModels,
  listProviders,
  createAuditLog,
} from '../shared/db';

const logger = new Logger({ handler: 'admin' });

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  logger.setRequestId(requestId);

  const startTime = Date.now();
  const method = event.httpMethod;
  const path = event.path;

  logger.info('Admin request received', { method, path, requestId });

  try {
    const auth = extractAuthContext(event);
    requireAdmin(auth);
    
    logger.setUserId(auth.userId);

    await createAuditLog({
      actor_id: auth.userId,
      actor_type: 'admin',
      action: `${method} ${path}`,
      resource_type: 'admin_api',
      details: {
        path,
        method,
        ip: event.requestContext.identity?.sourceIp,
      },
      ip_address: event.requestContext.identity?.sourceIp,
      user_agent: event.headers['User-Agent'] || event.headers['user-agent'],
    });

    const result = await routeRequest(event, auth);

    logger.info('Admin request completed', {
      method,
      path,
      statusCode: result.statusCode,
      durationMs: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    logger.error('Admin request failed', error as Error, {
      method,
      path,
      durationMs: Date.now() - startTime,
    });

    return errorResponse(error as Error);
  }
}

async function routeRequest(
  event: APIGatewayProxyEvent,
  auth: { userId: string; isSuperAdmin: boolean }
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;
  const pathParts = path.split('/').filter(Boolean);

  if (pathParts[1] === 'health') {
    return handleHealth();
  }

  if (pathParts[1] === 'dashboard') {
    return handleDashboard();
  }

  if (pathParts[1] === 'tenants') {
    return handleTenants(event, method, pathParts[2]);
  }

  if (pathParts[1] === 'users') {
    return handleUsers(event, method, pathParts[2]);
  }

  if (pathParts[1] === 'administrators') {
    return handleAdministrators(event, method, pathParts[2]);
  }

  if (pathParts[1] === 'invitations') {
    return handleInvitations(event, method);
  }

  if (pathParts[1] === 'approvals') {
    return handleApprovals(event, method, pathParts[2], pathParts[3]);
  }

  if (pathParts[1] === 'billing') {
    return handleBilling(event, pathParts[2]);
  }

  if (pathParts[1] === 'audit-logs') {
    return handleAuditLogs(event);
  }

  if (pathParts[1] === 'models') {
    return handleModels(event, method, pathParts[2]);
  }

  if (pathParts[1] === 'providers') {
    return handleProviders(event, method, pathParts[2]);
  }

  throw new NotFoundError(`Admin route not found: ${method} ${path}`);
}

async function handleHealth(): Promise<APIGatewayProxyResult> {
  return successResponse({
    status: 'healthy',
    service: 'admin',
    version: process.env.RADIANT_VERSION || 'unknown',
    timestamp: new Date().toISOString(),
  });
}

async function handleDashboard(): Promise<APIGatewayProxyResult> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

  const tenants = await listTenants(10, 0);
  const admins = await listAdministrators(10, 0);
  const pendingApprovals = await listPendingApprovalRequests();

  return successResponse({
    stats: {
      tenants_count: tenants.length,
      admins_count: admins.length,
      pending_approvals: pendingApprovals.length,
    },
    recent_tenants: tenants.slice(0, 5),
    pending_approvals: pendingApprovals.slice(0, 5),
  });
}

async function handleTenants(
  event: APIGatewayProxyEvent,
  method: string,
  tenantId?: string
): Promise<APIGatewayProxyResult> {
  if (method === 'GET' && !tenantId) {
    const limit = parseInt(event.queryStringParameters?.limit || '100', 10);
    const offset = parseInt(event.queryStringParameters?.offset || '0', 10);
    const tenants = await listTenants(limit, offset);
    return successResponse({ data: tenants, count: tenants.length });
  }

  if (method === 'GET' && tenantId) {
    const tenant = await getTenantById(tenantId);
    if (!tenant) {
      throw new NotFoundError(`Tenant not found: ${tenantId}`);
    }
    return successResponse(tenant);
  }

  if (method === 'POST') {
    const body = JSON.parse(event.body || '{}');
    if (!body.name) {
      throw new ValidationError('name is required');
    }
    const tenant = await createTenant({
      name: body.name,
      display_name: body.display_name || body.name,
      domain: body.domain,
      settings: body.settings || {},
      status: 'active',
    });
    return successResponse(tenant, 201);
  }

  throw new NotFoundError(`Tenant operation not supported: ${method}`);
}

async function handleUsers(
  event: APIGatewayProxyEvent,
  method: string,
  userId?: string
): Promise<APIGatewayProxyResult> {
  const tenantId = event.queryStringParameters?.tenant_id;
  
  if (method === 'GET' && !userId && tenantId) {
    const limit = parseInt(event.queryStringParameters?.limit || '100', 10);
    const offset = parseInt(event.queryStringParameters?.offset || '0', 10);
    const users = await listUsersByTenant(tenantId, limit, offset);
    return successResponse({ data: users, count: users.length });
  }

  throw new NotFoundError(`User operation not supported: ${method}`);
}

async function handleAdministrators(
  event: APIGatewayProxyEvent,
  method: string,
  adminId?: string
): Promise<APIGatewayProxyResult> {
  if (method === 'GET' && !adminId) {
    const admins = await listAdministrators();
    return successResponse({ data: admins, count: admins.length });
  }

  if (method === 'GET' && adminId) {
    const admin = await getAdministratorById(adminId);
    if (!admin) {
      throw new NotFoundError(`Administrator not found: ${adminId}`);
    }
    return successResponse(admin);
  }

  throw new NotFoundError(`Administrator operation not supported: ${method}`);
}

async function handleInvitations(
  event: APIGatewayProxyEvent,
  method: string
): Promise<APIGatewayProxyResult> {
  if (method === 'GET') {
    const invitations = await listPendingInvitations();
    return successResponse({ data: invitations, count: invitations.length });
  }

  throw new NotFoundError(`Invitation operation not supported: ${method}`);
}

async function handleApprovals(
  event: APIGatewayProxyEvent,
  method: string,
  requestId?: string,
  action?: string
): Promise<APIGatewayProxyResult> {
  if (method === 'GET') {
    const approvals = await listPendingApprovalRequests();
    return successResponse({ data: approvals, count: approvals.length });
  }

  throw new NotFoundError(`Approval operation not supported: ${method}`);
}

async function handleBilling(
  event: APIGatewayProxyEvent,
  resource?: string
): Promise<APIGatewayProxyResult> {
  const tenantId = event.queryStringParameters?.tenant_id;
  
  if (resource === 'usage' && tenantId) {
    const startDate = event.queryStringParameters?.start_date || 
      new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const endDate = event.queryStringParameters?.end_date || new Date().toISOString();
    
    const stats = await getUsageStats(tenantId, startDate, endDate);
    return successResponse(stats);
  }

  return successResponse({ message: 'Billing endpoint' });
}

async function handleAuditLogs(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const filters = {
    tenantId: event.queryStringParameters?.tenant_id,
    actorId: event.queryStringParameters?.actor_id,
    action: event.queryStringParameters?.action,
    resourceType: event.queryStringParameters?.resource_type,
    startDate: event.queryStringParameters?.start_date,
    endDate: event.queryStringParameters?.end_date,
  };
  
  const limit = parseInt(event.queryStringParameters?.limit || '100', 10);
  const offset = parseInt(event.queryStringParameters?.offset || '0', 10);
  
  const logs = await listAuditLogs(filters, limit, offset);
  return successResponse({ data: logs, count: logs.length });
}

async function handleModels(
  event: APIGatewayProxyEvent,
  method: string,
  modelId?: string
): Promise<APIGatewayProxyResult> {
  if (method === 'GET') {
    const category = event.queryStringParameters?.category;
    const status = event.queryStringParameters?.status;
    const models = await listModels(category, status);
    return successResponse({ data: models, count: models.length });
  }

  throw new NotFoundError(`Model operation not supported: ${method}`);
}

async function handleProviders(
  event: APIGatewayProxyEvent,
  method: string,
  providerId?: string
): Promise<APIGatewayProxyResult> {
  if (method === 'GET') {
    const status = event.queryStringParameters?.status;
    const providers = await listProviders(status);
    return successResponse({ data: providers, count: providers.length });
  }

  throw new NotFoundError(`Provider operation not supported: ${method}`);
}
