/**
 * RADIANT Admin API - Security Policy Management
 * 
 * Endpoints for managing the dynamic security policy registry:
 * - CRUD operations for policies
 * - Violation log access
 * - Statistics and analytics
 * - Policy testing
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  securityPolicyService,
  SecurityPolicyCreate,
  SecurityPolicyUpdate,
  SecurityPolicyCategory,
  SecuritySeverity,
  SecurityPolicyAction,
  SecurityDetectionMethod,
} from '../shared/services/security-policy.service';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

interface RequestContext {
  tenantId: string;
  userId: string;
  isAdmin: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getRequestContext(event: APIGatewayProxyEvent): RequestContext {
  const claims = event.requestContext.authorizer?.claims || {};
  return {
    tenantId: claims['custom:tenant_id'] || claims.tenant_id || '',
    userId: claims.sub || '',
    isAdmin: claims['custom:role'] === 'admin' || claims.role === 'admin',
  };
}

function success(data: unknown, statusCode = 200): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(data),
  };
}

function error(message: string, statusCode = 400): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({ error: message }),
  };
}

// ============================================================================
// Main Handler
// ============================================================================

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { httpMethod, path, pathParameters, queryStringParameters } = event;
  const ctx = getRequestContext(event);

  logger.info('Security policies admin request', { method: httpMethod, path, tenantId: ctx.tenantId });

  if (!ctx.tenantId) {
    return error('Unauthorized - no tenant context', 401);
  }

  try {
    // Route requests
    const resource = path.split('/').pop();

    // GET /admin/security-policies - List all policies
    if (httpMethod === 'GET' && !pathParameters?.id) {
      return await listPolicies(ctx, queryStringParameters);
    }

    // GET /admin/security-policies/:id - Get single policy
    if (httpMethod === 'GET' && pathParameters?.id && resource !== 'violations' && resource !== 'stats' && resource !== 'test') {
      return await getPolicy(ctx, pathParameters.id);
    }

    // POST /admin/security-policies - Create policy
    if (httpMethod === 'POST' && !pathParameters?.id) {
      return await createPolicy(ctx, event.body);
    }

    // PUT /admin/security-policies/:id - Update policy
    if (httpMethod === 'PUT' && pathParameters?.id) {
      return await updatePolicy(ctx, pathParameters.id, event.body);
    }

    // DELETE /admin/security-policies/:id - Delete policy
    if (httpMethod === 'DELETE' && pathParameters?.id) {
      return await deletePolicy(ctx, pathParameters.id);
    }

    // POST /admin/security-policies/:id/toggle - Toggle policy
    if (httpMethod === 'POST' && pathParameters?.id && path.includes('/toggle')) {
      return await togglePolicy(ctx, pathParameters.id, event.body);
    }

    // GET /admin/security-policies/violations - List violations
    if (httpMethod === 'GET' && path.includes('/violations')) {
      return await listViolations(ctx, queryStringParameters);
    }

    // POST /admin/security-policies/violations/:id/false-positive - Mark false positive
    if (httpMethod === 'POST' && path.includes('/false-positive')) {
      const violationId = pathParameters?.violationId || pathParameters?.id;
      return await markFalsePositive(ctx, violationId!, event.body);
    }

    // GET /admin/security-policies/stats - Get statistics
    if (httpMethod === 'GET' && path.includes('/stats')) {
      return await getStats(ctx, queryStringParameters);
    }

    // POST /admin/security-policies/test - Test input against policies
    if (httpMethod === 'POST' && path.includes('/test')) {
      return await testInput(ctx, event.body);
    }

    // GET /admin/security-policies/categories - Get policy categories
    if (httpMethod === 'GET' && path.includes('/categories')) {
      return await getCategories();
    }

    return error('Not found', 404);
  } catch (err) {
    logger.error('Security policies admin error', { error: err, path, method: httpMethod });
    return error(err instanceof Error ? err.message : 'Internal server error', 500);
  }
}

// ============================================================================
// Endpoint Handlers
// ============================================================================

/**
 * List all security policies
 */
async function listPolicies(
  ctx: RequestContext,
  params: Record<string, string | undefined> | null
): Promise<APIGatewayProxyResult> {
  const includeGlobal = params?.includeGlobal !== 'false';
  const policies = await securityPolicyService.getAllPolicies(ctx.tenantId, includeGlobal);

  return success({
    policies,
    total: policies.length,
    globalCount: policies.filter(p => p.tenantId === null).length,
    tenantCount: policies.filter(p => p.tenantId !== null).length,
  });
}

/**
 * Get a single policy
 */
async function getPolicy(
  ctx: RequestContext,
  policyId: string
): Promise<APIGatewayProxyResult> {
  const policy = await securityPolicyService.getPolicy(ctx.tenantId, policyId);

  if (!policy) {
    return error('Policy not found', 404);
  }

  return success({ policy });
}

/**
 * Create a new policy
 */
async function createPolicy(
  ctx: RequestContext,
  body: string | null
): Promise<APIGatewayProxyResult> {
  if (!body) {
    return error('Request body required');
  }

  const data = JSON.parse(body) as SecurityPolicyCreate;

  // Validate required fields
  if (!data.name || !data.category || !data.detectionMethod || !data.severity || !data.action) {
    return error('Missing required fields: name, category, detectionMethod, severity, action');
  }

  // Validate pattern for regex detection
  if (data.detectionMethod === 'regex' && data.pattern) {
    try {
      new RegExp(data.pattern);
    } catch {
      return error('Invalid regex pattern');
    }
  }

  const policy = await securityPolicyService.createPolicy(ctx.tenantId, {
    ...data,
    tenantId: ctx.tenantId, // Force tenant context
  });

  logger.info('Security policy created', { policyId: policy.id, name: policy.name, tenantId: ctx.tenantId });

  return success({ policy }, 201);
}

/**
 * Update a policy
 */
async function updatePolicy(
  ctx: RequestContext,
  policyId: string,
  body: string | null
): Promise<APIGatewayProxyResult> {
  if (!body) {
    return error('Request body required');
  }

  const data = JSON.parse(body) as SecurityPolicyUpdate;

  // Validate pattern if provided
  if (data.pattern) {
    try {
      new RegExp(data.pattern);
    } catch {
      return error('Invalid regex pattern');
    }
  }

  try {
    const policy = await securityPolicyService.updatePolicy(ctx.tenantId, policyId, data);

    if (!policy) {
      return error('Policy not found', 404);
    }

    logger.info('Security policy updated', { policyId, tenantId: ctx.tenantId });

    return success({ policy });
  } catch (err) {
    if (err instanceof Error && err.message.includes('system policies')) {
      return error('Cannot modify system policies', 403);
    }
    throw err;
  }
}

/**
 * Delete a policy
 */
async function deletePolicy(
  ctx: RequestContext,
  policyId: string
): Promise<APIGatewayProxyResult> {
  try {
    const deleted = await securityPolicyService.deletePolicy(ctx.tenantId, policyId);

    if (!deleted) {
      return error('Policy not found', 404);
    }

    logger.info('Security policy deleted', { policyId, tenantId: ctx.tenantId });

    return success({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message.includes('system policies')) {
      return error('Cannot delete system policies', 403);
    }
    throw err;
  }
}

/**
 * Toggle policy enabled status
 */
async function togglePolicy(
  ctx: RequestContext,
  policyId: string,
  body: string | null
): Promise<APIGatewayProxyResult> {
  const data = body ? JSON.parse(body) : {};
  const enabled = data.enabled !== false;

  const toggled = await securityPolicyService.togglePolicy(ctx.tenantId, policyId, enabled);

  if (!toggled) {
    return error('Policy not found', 404);
  }

  logger.info('Security policy toggled', { policyId, enabled, tenantId: ctx.tenantId });

  return success({ success: true, enabled });
}

/**
 * List security violations
 */
async function listViolations(
  ctx: RequestContext,
  params: Record<string, string | undefined> | null
): Promise<APIGatewayProxyResult> {
  const violations = await securityPolicyService.getViolations(ctx.tenantId, {
    limit: params?.limit ? parseInt(params.limit) : 100,
    offset: params?.offset ? parseInt(params.offset) : 0,
    policyId: params?.policyId,
    severity: params?.severity as SecuritySeverity | undefined,
    startDate: params?.startDate ? new Date(params.startDate) : undefined,
    endDate: params?.endDate ? new Date(params.endDate) : undefined,
  });

  return success({ violations, count: violations.length });
}

/**
 * Mark a violation as false positive
 */
async function markFalsePositive(
  ctx: RequestContext,
  violationId: string,
  body: string | null
): Promise<APIGatewayProxyResult> {
  const data = body ? JSON.parse(body) : {};

  const marked = await securityPolicyService.markFalsePositive(
    ctx.tenantId,
    violationId,
    ctx.userId,
    data.notes
  );

  if (!marked) {
    return error('Violation not found', 404);
  }

  logger.info('Violation marked as false positive', { violationId, reviewerId: ctx.userId });

  return success({ success: true });
}

/**
 * Get security statistics
 */
async function getStats(
  ctx: RequestContext,
  params: Record<string, string | undefined> | null
): Promise<APIGatewayProxyResult> {
  const days = params?.days ? parseInt(params.days) : 30;
  const stats = await securityPolicyService.getStats(ctx.tenantId, days);

  return success({ stats, periodDays: days });
}

/**
 * Test input against policies
 */
async function testInput(
  ctx: RequestContext,
  body: string | null
): Promise<APIGatewayProxyResult> {
  if (!body) {
    return error('Request body required');
  }

  const data = JSON.parse(body);
  if (!data.input) {
    return error('Input text required');
  }

  // Run security check without logging (test mode)
  const result = await securityPolicyService.checkInput(ctx.tenantId, data.input, {
    userId: ctx.userId,
  });

  return success({
    allowed: result.allowed,
    violationCount: result.violations.length,
    violations: result.violations.map(v => ({
      policyName: v.policyName,
      category: v.category,
      severity: v.severity,
      action: v.action,
      matchedPattern: v.matchedPattern,
    })),
    blockedBy: result.blockedBy ? {
      policyName: result.blockedBy.policyName,
      severity: result.blockedBy.severity,
      message: result.blockedBy.customMessage,
    } : null,
    warnings: result.warnings.map(w => ({
      policyName: w.policyName,
      message: w.customMessage,
    })),
  });
}

/**
 * Get available categories, severities, actions, and detection methods
 */
async function getCategories(): Promise<APIGatewayProxyResult> {
  const categories: Array<{ value: SecurityPolicyCategory; label: string; description: string }> = [
    { value: 'prompt_injection', label: 'Prompt Injection', description: 'Direct/indirect prompt injection attempts' },
    { value: 'system_leak', label: 'System Leak', description: 'Attempts to reveal system architecture/prompts' },
    { value: 'sql_injection', label: 'SQL Injection', description: 'SQL injection attempts in prompts' },
    { value: 'data_exfiltration', label: 'Data Exfiltration', description: 'Unauthorized data download attempts' },
    { value: 'cross_tenant', label: 'Cross-Tenant', description: 'Cross-tenant data access attempts' },
    { value: 'privilege_escalation', label: 'Privilege Escalation', description: 'Attempts to gain elevated permissions' },
    { value: 'jailbreak', label: 'Jailbreak', description: 'Attempts to bypass safety measures' },
    { value: 'encoding_attack', label: 'Encoding Attack', description: 'Base64, Unicode, multi-language obfuscation' },
    { value: 'payload_splitting', label: 'Payload Splitting', description: 'Fragmented malicious prompts' },
    { value: 'pii_exposure', label: 'PII Exposure', description: 'Attempts to extract PII' },
    { value: 'rate_abuse', label: 'Rate Abuse', description: 'Rapid-fire or resource exhaustion attacks' },
    { value: 'custom', label: 'Custom', description: 'Custom tenant-defined policies' },
  ];

  const severities: Array<{ value: SecuritySeverity; label: string; color: string }> = [
    { value: 'critical', label: 'Critical', color: '#dc2626' },
    { value: 'high', label: 'High', color: '#ea580c' },
    { value: 'medium', label: 'Medium', color: '#ca8a04' },
    { value: 'low', label: 'Low', color: '#2563eb' },
    { value: 'info', label: 'Info', color: '#6b7280' },
  ];

  const actions: Array<{ value: SecurityPolicyAction; label: string; description: string }> = [
    { value: 'block', label: 'Block', description: 'Block the request entirely' },
    { value: 'warn', label: 'Warn', description: 'Allow but warn user' },
    { value: 'redact', label: 'Redact', description: 'Redact sensitive parts' },
    { value: 'rate_limit', label: 'Rate Limit', description: 'Apply rate limiting' },
    { value: 'require_approval', label: 'Require Approval', description: 'Require human approval' },
    { value: 'log_only', label: 'Log Only', description: 'Log but take no action' },
    { value: 'escalate', label: 'Escalate', description: 'Escalate to security team' },
  ];

  const detectionMethods: Array<{ value: SecurityDetectionMethod; label: string; description: string }> = [
    { value: 'regex', label: 'Regular Expression', description: 'Pattern matching with regex' },
    { value: 'keyword', label: 'Keyword', description: 'Simple keyword/phrase detection' },
    { value: 'semantic', label: 'Semantic', description: 'AI-based semantic analysis' },
    { value: 'heuristic', label: 'Heuristic', description: 'Rule-based heuristic detection' },
    { value: 'embedding_similarity', label: 'Embedding Similarity', description: 'Vector similarity to known attacks' },
    { value: 'composite', label: 'Composite', description: 'Combination of multiple methods' },
  ];

  return success({ categories, severities, actions, detectionMethods });
}
