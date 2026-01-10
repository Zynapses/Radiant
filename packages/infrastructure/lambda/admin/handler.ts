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

    const result = await routeRequest(event, auth, context);

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
  auth: { userId: string; isSuperAdmin: boolean },
  context: Context
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

  // Compliance - delegate to dedicated handlers
  if (pathParts[1] === 'compliance') {
    if (pathParts[2] === 'checklists') {
      const { handler: checklistHandler } = await import('./checklist-registry.js');
      return checklistHandler(event);
    }
    if (pathParts[2] === 'regulatory-standards') {
      const mod = await import('./regulatory-standards.js');
      return mod.handler(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
    }
    if (pathParts[2] === 'self-audit') {
      const mod = await import('./self-audit.js');
      return (mod.getDashboard(event, {} as any, () => {}) || successResponse({ message: 'Not found' })) as APIGatewayProxyResult;
    }
  }

  // Security - delegate to dedicated handlers
  if (pathParts[1] === 'security') {
    if (pathParts[2] === 'schedules') {
      const mod = await import('./security-schedules.js');
      return mod.handler(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
    }
    const mod = await import('./security.js');
    return mod.handler(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
  }

  // System configuration
  if (pathParts[1] === 'system') {
    if (pathParts[2] === 'config') {
      const mod = await import('./system-config.js');
      return mod.handler(event) as Promise<APIGatewayProxyResult>;
    }
    const mod = await import('./system.js');
    return mod.handler(event) as Promise<APIGatewayProxyResult>;
  }

  // Time Machine
  if (pathParts[1] === 'time-machine') {
    const { handler: timeMachineHandler } = await import('./time-machine.js');
    return timeMachineHandler(event);
  }

  // Orchestration methods
  if (pathParts[1] === 'orchestration' && pathParts[2] === 'methods') {
    const { handler: methodsHandler } = await import('./orchestration-methods.js');
    return methodsHandler(event);
  }

  // Pricing
  if (pathParts[1] === 'pricing') {
    const { handler: pricingHandler } = await import('./pricing.js');
    return pricingHandler(event);
  }

  // AWS costs
  if (pathParts[1] === 'aws-costs') {
    const { handler: awsCostsHandler } = await import('./aws-costs.js');
    return awsCostsHandler(event);
  }

  // Ethics
  if (pathParts[1] === 'ethics') {
    const { handler: ethicsHandler } = await import('./ethics.js');
    return ethicsHandler(event);
  }

  // Specialty rankings
  if (pathParts[1] === 'specialty-rankings') {
    const { handler: rankingsHandler } = await import('./specialty-rankings.js');
    return rankingsHandler(event);
  }

  // AGI learning
  if (pathParts[1] === 'agi-learning') {
    const { handler: agiLearningHandler } = await import('./agi-learning.js');
    return agiLearningHandler(event);
  }

  // Internet learning
  if (pathParts[1] === 'internet-learning') {
    const { handler: internetLearningHandler } = await import('./internet-learning.js');
    return internetLearningHandler(event);
  }

  // Enhanced learning
  if (pathParts[1] === 'enhanced-learning') {
    const mod = await import('./enhanced-learning.js');
    return (mod.getConfig(event, {} as any, () => {}) || successResponse({ message: 'Not found' })) as APIGatewayProxyResult;
  }

  // Logs (AWS logs)
  if (pathParts[1] === 'logs') {
    const { handler: logsHandler } = await import('./logs.js');
    return logsHandler(event);
  }

  // Consciousness
  if (pathParts[1] === 'consciousness') {
    if (pathParts[2] === 'engine') {
      const mod = await import('./consciousness-engine.js');
      return (mod.getDashboard(event, {} as any, () => {}) || successResponse({ message: 'Not found' })) as APIGatewayProxyResult;
    }
    if (pathParts[2] === 'evolution') {
      const mod = await import('./consciousness-evolution.js');
      return (mod.getPredictionMetrics(event, {} as any, () => {}) || successResponse({ message: 'Not found' })) as APIGatewayProxyResult;
    }
    const mod = await import('./consciousness.js');
    return (mod.getConsciousnessMetrics(event, {} as any, () => {}) || successResponse({ message: 'Not found' })) as APIGatewayProxyResult;
  }

  // Ego system
  if (pathParts[1] === 'ego') {
    const mod = await import('./ego.js');
    return (mod.getEgoDashboard(event, {} as any, () => {}) || successResponse({ message: 'Not found' })) as APIGatewayProxyResult;
  }

  // Formal reasoning
  if (pathParts[1] === 'formal-reasoning') {
    const mod = await import('./formal-reasoning.js');
    return mod.handler(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
  }

  // Domain ethics
  if (pathParts[1] === 'domain-ethics') {
    const mod = await import('./domain-ethics.js');
    return (mod.listFrameworks(event, {} as any, () => {}) || successResponse({ message: 'Not found' })) as APIGatewayProxyResult;
  }

  // Ethics-free reasoning
  if (pathParts[1] === 'ethics-free-reasoning') {
    const mod = await import('./ethics-free-reasoning.js');
    return mod.handler(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
  }

  // Cato services
  if (pathParts[1] === 'cato') {
    if (pathParts[2] === 'genesis') {
      const mod = await import('./cato-genesis.js');
      return mod.handler(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
    }
    if (pathParts[2] === 'dialogue') {
      const mod = await import('./cato-dialogue.js');
      return (mod.dialogue(event, {} as any, () => {}) || successResponse({ message: 'Not found' })) as APIGatewayProxyResult;
    }
    if (pathParts[2] === 'global') {
      const mod = await import('./cato-global.js');
      return mod.handler(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
    }
  }

  // Model coordination
  if (pathParts[1] === 'model-coordination') {
    const mod = await import('./model-coordination.js');
    return (mod.getSyncConfig(event, {} as any, () => {}) || successResponse({ message: 'Not found' })) as APIGatewayProxyResult;
  }

  // Model proficiency
  if (pathParts[1] === 'model-proficiency') {
    const mod = await import('./model-proficiency.js');
    return (mod.getAllRankings(event, {} as any, () => {}) || successResponse({ message: 'Not found' })) as APIGatewayProxyResult;
  }

  // Infrastructure tier
  if (pathParts[1] === 'infrastructure-tier') {
    const mod = await import('./infrastructure-tier.js');
    return mod.handler(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
  }

  // Library registry
  if (pathParts[1] === 'library-registry') {
    const mod = await import('./library-registry.js');
    return mod.handler(event, {} as any, () => {}) as Promise<APIGatewayProxyResult>;
  }

  // Inference components
  if (pathParts[1] === 'inference-components') {
    const mod = await import('./inference-components.js');
    return (mod.getConfig(event, {} as any, () => {}) || successResponse({ message: 'Not found' })) as APIGatewayProxyResult;
  }

  // User Registry - assignments, consent, DSAR, break glass, legal hold
  if (pathParts[1] === 'user-registry') {
    const { handler: userRegistryHandler } = await import('./user-registry.js');
    return userRegistryHandler(event);
  }

  // Brain v6.0.4 - AGI Brain admin
  if (pathParts[1] === 'brain') {
    const { handler: brainHandler } = await import('./brain.js');
    return brainHandler(event);
  }

  // Metrics & Learning
  if (pathParts[1] === 'metrics') {
    const { handler: metricsHandler } = await import('./metrics.js');
    return metricsHandler(event);
  }

  // Translation middleware
  if (pathParts[1] === 'translation') {
    const { handler: translationHandler } = await import('./translation.js');
    return translationHandler(event);
  }

  // Cognition v6.1.0 - Advanced Cognition Services
  if (pathParts[1] === 'cognition') {
    const { handler: cognitionHandler } = await import('./cognition.js');
    return cognitionHandler(event);
  }

  // Genesis Cato Safety Architecture
  if (pathParts[1] === 'cato') {
    const mod = await import('./cato.js');
    return mod.handler(event, context) as Promise<APIGatewayProxyResult>;
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
