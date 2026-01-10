// ============================================================================
// RADIANT Artifact Engine - API Handlers
// packages/infrastructure/lambda/thinktank/artifact-engine.ts
// Version: 4.19.0
//
// Lambda handlers for artifact generation API endpoints.
// All handlers use standard RADIANT middleware for auth and tenant isolation.
// ============================================================================

import { APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { artifactEngineService } from '../shared/services/artifact-engine';
import { query } from '../shared/db/pool-manager';
import { logger } from '../shared/logging/enhanced-logger';

interface AuthContext {
  tenantId: string;
  userId: string;
  role?: string;
}

function getAuthContext(event: APIGatewayProxyEvent): AuthContext | null {
  const authorizer = event.requestContext?.authorizer;
  if (!authorizer || typeof authorizer !== 'object') return null;
  const auth = authorizer as Record<string, unknown>;
  if (typeof auth.tenantId !== 'string' || typeof auth.userId !== 'string') return null;
  return {
    tenantId: auth.tenantId,
    userId: auth.userId,
    role: typeof auth.role === 'string' ? auth.role : undefined,
  };
}

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}

function errorResponse(statusCode: number, message: string): APIGatewayProxyResult {
  return jsonResponse(statusCode, { error: message });
}

/**
 * POST /api/thinktank/artifacts/generate
 *
 * Start artifact generation from a prompt
 *
 * Request Body:
 * {
 *   prompt: string,           // Required: User's request
 *   chatId?: string,          // Optional: Link to chat
 *   canvasId?: string,        // Optional: Add to existing canvas
 *   mood?: string,            // Optional: Cato mood (affects creativity)
 *   constraints?: {           // Optional: Generation constraints
 *     maxLines?: number,
 *     targetComplexity?: 'simple' | 'moderate' | 'complex'
 *   }
 * }
 *
 * Response:
 * {
 *   sessionId: string,
 *   artifactId?: string,
 *   status: string,
 *   verificationStatus: string,
 *   code?: string,
 *   validation?: object,
 *   reflexionAttempts: number,
 *   tokensUsed: number,
 *   estimatedCost: number,
 *   generationTimeMs: number
 * }
 */
export const generateArtifact: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  try {
    const auth = getAuthContext(event);
    if (!auth) {
      return errorResponse(401, 'Unauthorized');
    }

    const body = JSON.parse(event.body || '{}');

    if (!body.prompt) {
      return errorResponse(400, 'Missing required field: prompt');
    }

    const result = await artifactEngineService.generate({
      tenantId: auth.tenantId,
      userId: auth.userId,
      chatId: body.chatId,
      canvasId: body.canvasId,
      prompt: body.prompt,
      mood: body.mood,
      constraints: body.constraints,
    });

    return jsonResponse(200, result);
  } catch (error: unknown) {
    logger.error('Artifact generation error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(500, message);
  }
};

/**
 * GET /api/thinktank/artifacts/sessions/{sessionId}
 *
 * Get session status and generation logs
 *
 * Response:
 * {
 *   session: object,
 *   logs: array
 * }
 */
export const getSessionStatus: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  try {
    const auth = getAuthContext(event);
    if (!auth) {
      return errorResponse(401, 'Unauthorized');
    }

    const sessionId = event.pathParameters?.sessionId;

    if (!sessionId) {
      return errorResponse(400, 'Missing sessionId parameter');
    }

    const result = await artifactEngineService.getSession(sessionId);

    if (!result) {
      return errorResponse(404, 'Session not found');
    }

    return jsonResponse(200, result);
  } catch (error: unknown) {
    logger.error('Get session error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(500, message);
  }
};

/**
 * GET /api/thinktank/artifacts/sessions/{sessionId}/logs
 *
 * Stream session logs for real-time updates (polling endpoint)
 *
 * Query Parameters:
 *   since?: string  - ISO timestamp to get logs after
 *
 * Response:
 * {
 *   logs: array,
 *   status: string,
 *   isComplete: boolean
 * }
 */
export const getSessionLogs: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  try {
    const auth = getAuthContext(event);
    if (!auth) {
      return errorResponse(401, 'Unauthorized');
    }

    const sessionId = event.pathParameters?.sessionId;
    const since = event.queryStringParameters?.since;

    if (!sessionId) {
      return errorResponse(400, 'Missing sessionId parameter');
    }

    let logsQuery = `
      SELECT * FROM artifact_generation_logs 
      WHERE session_id = $1
    `;
    const params: (string | Date)[] = [sessionId];

    if (since) {
      logsQuery += ` AND created_at > $2`;
      params.push(new Date(since));
    }

    logsQuery += ` ORDER BY created_at ASC`;

    const logsResult = await query(logsQuery, params);

    const statusResult = await query<{ status: string }>(
      `SELECT status FROM artifact_generation_sessions WHERE id = $1`,
      [sessionId]
    );

    const status = statusResult.rows[0]?.status || 'unknown';
    const isComplete = ['completed', 'failed', 'rejected'].includes(status);

    return jsonResponse(200, {
      logs: logsResult.rows,
      status,
      isComplete,
    });
  } catch (error: unknown) {
    logger.error('Get session logs error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(500, message);
  }
};

/**
 * GET /api/thinktank/artifacts/patterns
 *
 * Get available code patterns for UI suggestions
 *
 * Response:
 * [
 *   {
 *     id: string,
 *     pattern_name: string,
 *     pattern_type: string,
 *     description: string,
 *     usage_count: number,
 *     success_rate: number
 *   }
 * ]
 */
export const getPatterns: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  try {
    const auth = getAuthContext(event);
    if (!auth) {
      return errorResponse(401, 'Unauthorized');
    }

    const patterns = await artifactEngineService.getPatterns(auth.tenantId);

    return jsonResponse(200, patterns);
  } catch (error: unknown) {
    logger.error('Get patterns error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(500, message);
  }
};

/**
 * GET /api/thinktank/artifacts/allowlist
 *
 * Get dependency allowlist for this tenant
 *
 * Response:
 * [
 *   {
 *     package_name: string,
 *     package_version: string | null,
 *     reason: string,
 *     security_reviewed: boolean
 *   }
 * ]
 */
export const getAllowlist: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  try {
    const auth = getAuthContext(event);
    if (!auth) {
      return errorResponse(401, 'Unauthorized');
    }

    const result = await query(
      `SELECT package_name, package_version, reason, security_reviewed
       FROM artifact_dependency_allowlist
       WHERE is_active = TRUE AND (tenant_id IS NULL OR tenant_id = $1)
       ORDER BY package_name`,
      [auth.tenantId]
    );

    return jsonResponse(200, result.rows);
  } catch (error: unknown) {
    logger.error('Get allowlist error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(500, message);
  }
};

/**
 * GET /api/admin/artifact-engine/metrics
 *
 * Admin endpoint: Get artifact generation metrics
 *
 * Response:
 * {
 *   totalGenerated: number,
 *   successRate: number,
 *   averageGenerationTime: number,
 *   reflexionRate: number,
 *   totalTokens: number,
 *   totalCost: number,
 *   topIntents: array,
 *   recentSessions: array
 * }
 */
export const getAdminMetrics: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  try {
    const auth = getAuthContext(event);
    if (!auth) {
      return errorResponse(401, 'Unauthorized');
    }

    const metrics = await artifactEngineService.getMetrics(auth.tenantId);

    return jsonResponse(200, metrics);
  } catch (error: unknown) {
    logger.error('Get admin metrics error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(500, message);
  }
};

/**
 * GET /api/admin/artifact-engine/validation-rules
 *
 * Admin endpoint: Get all validation rules (CBFs)
 *
 * Response:
 * [
 *   {
 *     id: string,
 *     rule_name: string,
 *     rule_type: string,
 *     description: string,
 *     validation_pattern: string | null,
 *     severity: string,
 *     error_message: string,
 *     is_active: boolean
 *   }
 * ]
 */
export const getValidationRules: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  try {
    const auth = getAuthContext(event);
    if (!auth) {
      return errorResponse(401, 'Unauthorized');
    }

    const result = await query(
      `SELECT id, rule_name, rule_type, description, validation_pattern, severity, error_message, is_active
       FROM artifact_validation_rules
       ORDER BY rule_type, rule_name`
    );

    return jsonResponse(200, result.rows);
  } catch (error: unknown) {
    logger.error('Get validation rules error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(500, message);
  }
};

/**
 * PUT /api/admin/artifact-engine/validation-rules/{ruleId}
 *
 * Admin endpoint: Update a validation rule
 *
 * Request Body:
 * {
 *   is_active?: boolean,
 *   severity?: 'block' | 'warn' | 'log'
 * }
 */
export const updateValidationRule: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  try {
    const auth = getAuthContext(event);
    if (!auth) {
      return errorResponse(401, 'Unauthorized');
    }

    const ruleId = event.pathParameters?.ruleId;
    if (!ruleId) {
      return errorResponse(400, 'Missing ruleId parameter');
    }

    const body = JSON.parse(event.body || '{}');

    const updates: string[] = [];
    const params: (string | boolean)[] = [ruleId];
    let paramIndex = 2;

    if (body.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(body.is_active);
    }

    if (body.severity !== undefined) {
      if (!['block', 'warn', 'log'].includes(body.severity)) {
        return errorResponse(400, 'Invalid severity value');
      }
      updates.push(`severity = $${paramIndex++}`);
      params.push(body.severity);
    }

    if (updates.length === 0) {
      return errorResponse(400, 'No valid fields to update');
    }

    await query(
      `UPDATE artifact_validation_rules SET ${updates.join(', ')} WHERE id = $1`,
      params
    );

    return jsonResponse(200, { success: true });
  } catch (error: unknown) {
    logger.error('Update validation rule error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(500, message);
  }
};

/**
 * POST /api/admin/artifact-engine/allowlist
 *
 * Admin endpoint: Add package to tenant allowlist
 *
 * Request Body:
 * {
 *   package_name: string,
 *   package_version?: string,
 *   reason: string
 * }
 */
export const addToAllowlist: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  try {
    const auth = getAuthContext(event);
    if (!auth) {
      return errorResponse(401, 'Unauthorized');
    }

    const body = JSON.parse(event.body || '{}');

    if (!body.package_name) {
      return errorResponse(400, 'Missing required field: package_name');
    }

    const result = await query<{ id: string }>(
      `INSERT INTO artifact_dependency_allowlist (tenant_id, package_name, package_version, reason, security_reviewed, reviewed_by)
       VALUES ($1, $2, $3, $4, FALSE, $5)
       ON CONFLICT (tenant_id, package_name) DO UPDATE SET
         package_version = EXCLUDED.package_version,
         reason = EXCLUDED.reason,
         is_active = TRUE
       RETURNING id`,
      [auth.tenantId, body.package_name, body.package_version || null, body.reason || '', auth.userId]
    );

    return jsonResponse(201, { id: result.rows[0].id });
  } catch (error: unknown) {
    logger.error('Add to allowlist error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(500, message);
  }
};

/**
 * DELETE /api/admin/artifact-engine/allowlist/{packageName}
 *
 * Admin endpoint: Remove package from tenant allowlist
 */
export const removeFromAllowlist: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  try {
    const auth = getAuthContext(event);
    if (!auth) {
      return errorResponse(401, 'Unauthorized');
    }

    const packageName = event.pathParameters?.packageName;
    if (!packageName) {
      return errorResponse(400, 'Missing packageName parameter');
    }

    await query(
      `UPDATE artifact_dependency_allowlist 
       SET is_active = FALSE 
       WHERE tenant_id = $1 AND package_name = $2`,
      [auth.tenantId, decodeURIComponent(packageName)]
    );

    return jsonResponse(200, { success: true });
  } catch (error: unknown) {
    logger.error('Remove from allowlist error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(500, message);
  }
};

/**
 * GET /api/admin/artifact-engine/dashboard
 *
 * Admin endpoint: Get full dashboard data
 */
export const getDashboard: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  try {
    const auth = getAuthContext(event);
    if (!auth) {
      return errorResponse(401, 'Unauthorized');
    }

    const [metrics, patterns, rules, allowlist] = await Promise.all([
      artifactEngineService.getMetrics(auth.tenantId),
      artifactEngineService.getPatterns(auth.tenantId),
      query(
        `SELECT id, rule_name, rule_type, severity, is_active
         FROM artifact_validation_rules
         ORDER BY rule_type, rule_name`
      ),
      query(
        `SELECT package_name, security_reviewed
         FROM artifact_dependency_allowlist
         WHERE is_active = TRUE AND (tenant_id IS NULL OR tenant_id = $1)
         ORDER BY package_name`,
        [auth.tenantId]
      ),
    ]);

    return jsonResponse(200, {
      metrics,
      patterns,
      validationRules: rules.rows,
      allowlist: allowlist.rows,
    });
  } catch (error: unknown) {
    logger.error('Get dashboard error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(500, message);
  }
};

/**
 * Main handler - Routes requests to appropriate handler based on path and method
 */
export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const path = event.path || '';
  const method = event.httpMethod || 'GET';

  // Thinktank artifact routes
  if (path.includes('/thinktank/artifacts')) {
    if (path.endsWith('/generate') && method === 'POST') {
      return generateArtifact(event, {} as never, () => {}) as Promise<APIGatewayProxyResult>;
    }
    if (path.endsWith('/patterns') && method === 'GET') {
      return getPatterns(event, {} as never, () => {}) as Promise<APIGatewayProxyResult>;
    }
    if (path.endsWith('/allowlist') && method === 'GET') {
      return getAllowlist(event, {} as never, () => {}) as Promise<APIGatewayProxyResult>;
    }
    if (path.includes('/sessions/') && path.endsWith('/logs') && method === 'GET') {
      return getSessionLogs(event, {} as never, () => {}) as Promise<APIGatewayProxyResult>;
    }
    if (path.includes('/sessions/') && method === 'GET') {
      return getSessionStatus(event, {} as never, () => {}) as Promise<APIGatewayProxyResult>;
    }
  }

  // Admin artifact-engine routes
  if (path.includes('/admin/artifact-engine')) {
    if (path.endsWith('/dashboard') && method === 'GET') {
      return getDashboard(event, {} as never, () => {}) as Promise<APIGatewayProxyResult>;
    }
    if (path.endsWith('/metrics') && method === 'GET') {
      return getAdminMetrics(event, {} as never, () => {}) as Promise<APIGatewayProxyResult>;
    }
    if (path.endsWith('/validation-rules') && method === 'GET') {
      return getValidationRules(event, {} as never, () => {}) as Promise<APIGatewayProxyResult>;
    }
    if (path.includes('/validation-rules/') && method === 'PUT') {
      return updateValidationRule(event, {} as never, () => {}) as Promise<APIGatewayProxyResult>;
    }
    if (path.endsWith('/allowlist') && method === 'POST') {
      return addToAllowlist(event, {} as never, () => {}) as Promise<APIGatewayProxyResult>;
    }
    if (path.includes('/allowlist/') && method === 'DELETE') {
      return removeFromAllowlist(event, {} as never, () => {}) as Promise<APIGatewayProxyResult>;
    }
  }

  return errorResponse(404, `Not found: ${method} ${path}`);
};
