/**
 * Grimoire API Lambda Handler
 * RADIANT v5.0.2 - System Evolution
 * 
 * REST API for managing The Grimoire (procedural memory system).
 * Uses shared utilities to avoid code duplication.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PoolClient } from 'pg';
import { Logger } from '../shared/logger';
import { success, handleError } from '../shared/response';
import { 
  withSecureDBContext, 
  isTenantAdmin,
  AuthContext 
} from '../shared/services/db-context.service';
import { ValidationError, UnauthorizedError, NotFoundError, ConflictError } from '../shared/errors';

const logger = new Logger({ appId: 'grimoire-api' });

function extractAuthFromEvent(event: APIGatewayProxyEvent): AuthContext {
  const claims = event.requestContext.authorizer?.claims || {};
  const authorizer = event.requestContext.authorizer || {};
  return {
    tenantId: claims['custom:tenant_id'] || authorizer.tenant_id || event.headers['x-tenant-id'] || '',
    userId: claims.sub || authorizer.user_id || '',
    permissionLevel: (claims['custom:role'] || authorizer.permission_level || 'user') as any,
    scopes: [],
    groups: []
  };
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const authContext = extractAuthFromEvent(event);
  
  if (!authContext.tenantId) {
    return handleError(new UnauthorizedError('Tenant ID required'));
  }
  
  const path = event.path;
  const method = event.httpMethod;
  
  logger.info('Grimoire API request', { path, method, tenantId: authContext.tenantId });
  
  try {
    // GET /api/thinktank/grimoire/heuristics
    if (path.endsWith('/heuristics') && method === 'GET') {
      return await listHeuristics(event, authContext);
    }
    
    // POST /api/thinktank/grimoire/heuristics
    if (path.endsWith('/heuristics') && method === 'POST') {
      return await addHeuristic(event, authContext);
    }
    
    // DELETE /api/thinktank/grimoire/heuristics/:id
    if (path.includes('/heuristics/') && method === 'DELETE') {
      const id = path.split('/').pop() || '';
      return await deleteHeuristic(id, authContext);
    }
    
    // POST /api/thinktank/grimoire/heuristics/:id/reinforce
    if (path.includes('/reinforce') && method === 'POST') {
      const parts = path.split('/');
      const id = parts[parts.length - 2];
      return await reinforceHeuristic(event, id, authContext);
    }
    
    // GET /api/thinktank/grimoire/stats
    if (path.endsWith('/stats') && method === 'GET') {
      return await getStats(authContext);
    }
    
    return handleError(new NotFoundError('Endpoint not found'));
    
  } catch (error: unknown) {
    logger.error('Grimoire API error', error as Error);
    return handleError(error);
  }
}

async function listHeuristics(
  event: APIGatewayProxyEvent,
  authContext: AuthContext
): Promise<APIGatewayProxyResult> {
  const params = event.queryStringParameters || {};
  const domain = params.domain;
  const search = params.search;
  const limit = Math.min(parseInt(params.limit || '100', 10), 500);
  const offset = parseInt(params.offset || '0', 10);
  
  return withSecureDBContext(authContext, async (client: PoolClient) => {
    let query = `
      SELECT id, domain, heuristic_text, confidence_score, 
             source_execution_id, created_at, updated_at, expires_at
      FROM knowledge_heuristics
      WHERE expires_at > NOW()
    `;
    const queryParams: (string | number)[] = [];
    let paramIndex = 1;
    
    if (domain && domain !== 'all') {
      query += ` AND domain = $${paramIndex++}`;
      queryParams.push(domain);
    }
    
    if (search) {
      query += ` AND heuristic_text ILIKE $${paramIndex++}`;
      queryParams.push(`%${search}%`);
    }
    
    query += ` ORDER BY confidence_score DESC, created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    queryParams.push(limit, offset);
    
    const result = await client.query(query, queryParams);
    
    return success({
      heuristics: result.rows.map(row => ({
        id: row.id,
        domain: row.domain,
        heuristic_text: row.heuristic_text,
        confidence_score: parseFloat(row.confidence_score),
        source_execution_id: row.source_execution_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
        expires_at: row.expires_at
      })),
      total: result.rowCount
    });
  });
}

async function addHeuristic(
  event: APIGatewayProxyEvent,
  authContext: AuthContext
): Promise<APIGatewayProxyResult> {
  if (!isTenantAdmin(authContext)) {
    return handleError(new UnauthorizedError('Admin role required'));
  }
  
  let body: { domain?: string; heuristic_text?: string; confidence?: number };
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return handleError(new ValidationError('Invalid JSON body'));
  }
  
  const { domain, heuristic_text, confidence } = body;
  
  if (!domain || !heuristic_text) {
    return handleError(new ValidationError('domain and heuristic_text are required'));
  }
  
  if (heuristic_text.length < 20 || heuristic_text.length > 500) {
    return handleError(new ValidationError('Heuristic must be 20-500 characters'));
  }
  
  return withSecureDBContext(authContext, async (client: PoolClient) => {
    const result = await client.query(`
      INSERT INTO knowledge_heuristics 
      (tenant_id, domain, heuristic_text, confidence_score, source_execution_id)
      VALUES ($1, $2, $3, $4, 'manual')
      ON CONFLICT (tenant_id, domain, heuristic_text) DO NOTHING
      RETURNING id
    `, [authContext.tenantId, domain, heuristic_text, confidence || 0.7]);
    
    if (result.rowCount === 0) {
      return handleError(new ConflictError('Heuristic already exists'));
    }
    
    logger.info('Heuristic added', { tenantId: authContext.tenantId, domain, id: result.rows[0].id });
    
    return success({ id: result.rows[0].id }, 201);
  });
}

async function deleteHeuristic(
  id: string,
  authContext: AuthContext
): Promise<APIGatewayProxyResult> {
  if (!isTenantAdmin(authContext)) {
    return handleError(new UnauthorizedError('Admin role required'));
  }
  
  return withSecureDBContext(authContext, async (client: PoolClient) => {
    const result = await client.query(`
      DELETE FROM knowledge_heuristics
      WHERE id = $1 AND tenant_id = $2
    `, [id, authContext.tenantId]);
    
    if (result.rowCount === 0) {
      return handleError(new NotFoundError('Heuristic not found'));
    }
    
    logger.info('Heuristic deleted', { tenantId: authContext.tenantId, id });
    
    return success({ deleted: true });
  });
}

async function reinforceHeuristic(
  event: APIGatewayProxyEvent,
  id: string,
  authContext: AuthContext
): Promise<APIGatewayProxyResult> {
  let body: { positive?: boolean };
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return handleError(new ValidationError('Invalid JSON body'));
  }
  
  const positive = body.positive !== false;
  
  return withSecureDBContext(authContext, async (client: PoolClient) => {
    const query = positive
      ? `UPDATE knowledge_heuristics
         SET confidence_score = LEAST(confidence_score + 0.1, 1.0), updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2
         RETURNING confidence_score`
      : `UPDATE knowledge_heuristics
         SET confidence_score = GREATEST(confidence_score - 0.2, 0), updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2
         RETURNING confidence_score`;
    
    const result = await client.query(query, [id, authContext.tenantId]);
    
    if (result.rowCount === 0) {
      return handleError(new NotFoundError('Heuristic not found'));
    }
    
    return success({ new_confidence: parseFloat(result.rows[0].confidence_score) });
  });
}

async function getStats(authContext: AuthContext): Promise<APIGatewayProxyResult> {
  return withSecureDBContext(authContext, async (client: PoolClient) => {
    const result = await client.query(`
      SELECT 
        domain,
        COUNT(*) as total,
        AVG(confidence_score) as avg_confidence,
        COUNT(*) FILTER (WHERE confidence_score >= 0.8) as high_confidence,
        COUNT(*) FILTER (WHERE expires_at < NOW() + INTERVAL '7 days') as expiring_soon,
        MAX(created_at) as last_added
      FROM knowledge_heuristics
      WHERE expires_at > NOW() AND tenant_id = $1
      GROUP BY domain
    `, [authContext.tenantId]);
    
    const byDomain: Record<string, unknown> = {};
    let totalHeuristics = 0;
    let totalHighConfidence = 0;
    let totalExpiringSoon = 0;
    
    for (const row of result.rows) {
      const stats = {
        total: parseInt(row.total),
        avg_confidence: parseFloat(row.avg_confidence) || 0,
        high_confidence: parseInt(row.high_confidence),
        expiring_soon: parseInt(row.expiring_soon),
        last_added: row.last_added
      };
      byDomain[row.domain] = stats;
      totalHeuristics += stats.total;
      totalHighConfidence += stats.high_confidence;
      totalExpiringSoon += stats.expiring_soon;
    }
    
    return success({
      total_heuristics: totalHeuristics,
      total_high_confidence: totalHighConfidence,
      total_expiring_soon: totalExpiringSoon,
      by_domain: byDomain,
      domain_count: Object.keys(byDomain).length
    });
  });
}
