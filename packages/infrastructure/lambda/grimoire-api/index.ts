/**
 * Grimoire API Lambda Handler
 * RADIANT v5.0.2 - System Evolution
 * 
 * REST API for managing The Grimoire (procedural memory system).
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Client } from 'pg';
import { Logger } from '../shared/logger';

const logger = new Logger({ appId: 'grimoire-api' });

let dbClient: Client | null = null;

async function getDbClient(): Promise<Client> {
  if (!dbClient) {
    const { SecretsManager } = await import('@aws-sdk/client-secrets-manager');
    const sm = new SecretsManager({});
    const secretArn = process.env.DB_SECRET_ARN;
    
    if (!secretArn) {
      throw new Error('DB_SECRET_ARN not configured');
    }
    
    const secretResponse = await sm.getSecretValue({ SecretId: secretArn });
    const secret = JSON.parse(secretResponse.SecretString || '{}');
    
    dbClient = new Client({
      host: secret.host,
      database: secret.dbname,
      user: secret.username,
      password: secret.password,
      port: secret.port || 5432,
      ssl: { rejectUnauthorized: false }
    });
    
    await dbClient.connect();
  }
  return dbClient;
}

interface AuthContext {
  tenantId: string;
  userId: string;
  role: string;
}

function extractAuth(event: APIGatewayProxyEvent): AuthContext {
  const claims = event.requestContext.authorizer?.claims || {};
  return {
    tenantId: claims['custom:tenant_id'] || event.headers['x-tenant-id'] || '',
    userId: claims.sub || '',
    role: claims['custom:role'] || 'user'
  };
}

async function withTenantContext<T>(
  db: Client,
  tenantId: string,
  fn: () => Promise<T>
): Promise<T> {
  await db.query(`SET app.current_tenant_id = $1`, [tenantId]);
  try {
    return await fn();
  } finally {
    await db.query(`RESET app.current_tenant_id`);
  }
}

function createResponse(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID'
    },
    body: JSON.stringify(body)
  };
}

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const { tenantId, role } = extractAuth(event);
  
  if (!tenantId) {
    return createResponse(401, { error: 'Tenant ID required' });
  }
  
  const path = event.path;
  const method = event.httpMethod;
  
  logger.info('Grimoire API request', { path, method, tenantId });
  
  try {
    const db = await getDbClient();
    
    // GET /api/thinktank/grimoire/heuristics
    if (path.endsWith('/heuristics') && method === 'GET') {
      return await listHeuristics(event, db, tenantId);
    }
    
    // POST /api/thinktank/grimoire/heuristics
    if (path.endsWith('/heuristics') && method === 'POST') {
      return await addHeuristic(event, db, tenantId, role);
    }
    
    // DELETE /api/thinktank/grimoire/heuristics/:id
    if (path.includes('/heuristics/') && method === 'DELETE') {
      const id = path.split('/').pop();
      return await deleteHeuristic(db, tenantId, role, id || '');
    }
    
    // POST /api/thinktank/grimoire/heuristics/:id/reinforce
    if (path.includes('/reinforce') && method === 'POST') {
      const parts = path.split('/');
      const id = parts[parts.length - 2];
      return await reinforceHeuristic(event, db, tenantId, id);
    }
    
    // GET /api/thinktank/grimoire/stats
    if (path.endsWith('/stats') && method === 'GET') {
      return await getStats(db, tenantId);
    }
    
    return createResponse(404, { error: 'Not found' });
    
  } catch (error: any) {
    logger.error('Grimoire API error', error);
    return createResponse(500, { error: error.message || 'Internal server error' });
  }
}

async function listHeuristics(
  event: APIGatewayProxyEvent,
  db: Client,
  tenantId: string
): Promise<APIGatewayProxyResult> {
  const params = event.queryStringParameters || {};
  const domain = params.domain;
  const search = params.search;
  const limit = Math.min(parseInt(params.limit || '100', 10), 500);
  const offset = parseInt(params.offset || '0', 10);
  
  return withTenantContext(db, tenantId, async () => {
    let query = `
      SELECT id, domain, heuristic_text, confidence_score, 
             source_execution_id, created_at, updated_at, expires_at
      FROM knowledge_heuristics
      WHERE expires_at > NOW()
    `;
    const queryParams: any[] = [];
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
    
    const result = await db.query(query, queryParams);
    
    return createResponse(200, {
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
  db: Client,
  tenantId: string,
  role: string
): Promise<APIGatewayProxyResult> {
  if (!['admin', 'super_admin'].includes(role)) {
    return createResponse(403, { error: 'Admin role required' });
  }
  
  let body: { domain?: string; heuristic_text?: string; confidence?: number };
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return createResponse(400, { error: 'Invalid JSON body' });
  }
  
  const { domain, heuristic_text, confidence } = body;
  
  if (!domain || !heuristic_text) {
    return createResponse(400, { error: 'domain and heuristic_text are required' });
  }
  
  if (heuristic_text.length < 20 || heuristic_text.length > 500) {
    return createResponse(400, { error: 'Heuristic must be 20-500 characters' });
  }
  
  return withTenantContext(db, tenantId, async () => {
    const result = await db.query(`
      INSERT INTO knowledge_heuristics 
      (tenant_id, domain, heuristic_text, confidence_score, source_execution_id)
      VALUES ($1, $2, $3, $4, 'manual')
      ON CONFLICT (tenant_id, domain, heuristic_text) DO NOTHING
      RETURNING id
    `, [tenantId, domain, heuristic_text, confidence || 0.7]);
    
    if (result.rowCount === 0) {
      return createResponse(409, { error: 'Heuristic already exists' });
    }
    
    logger.info('Heuristic added', { tenantId, domain, id: result.rows[0].id });
    
    return createResponse(201, { 
      success: true, 
      id: result.rows[0].id 
    });
  });
}

async function deleteHeuristic(
  db: Client,
  tenantId: string,
  role: string,
  id: string
): Promise<APIGatewayProxyResult> {
  if (!['admin', 'super_admin'].includes(role)) {
    return createResponse(403, { error: 'Admin role required' });
  }
  
  return withTenantContext(db, tenantId, async () => {
    const result = await db.query(`
      DELETE FROM knowledge_heuristics
      WHERE id = $1 AND tenant_id = $2
    `, [id, tenantId]);
    
    if (result.rowCount === 0) {
      return createResponse(404, { error: 'Heuristic not found' });
    }
    
    logger.info('Heuristic deleted', { tenantId, id });
    
    return createResponse(200, { success: true });
  });
}

async function reinforceHeuristic(
  event: APIGatewayProxyEvent,
  db: Client,
  tenantId: string,
  id: string
): Promise<APIGatewayProxyResult> {
  let body: { positive?: boolean };
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return createResponse(400, { error: 'Invalid JSON body' });
  }
  
  const positive = body.positive !== false;
  
  return withTenantContext(db, tenantId, async () => {
    let result;
    if (positive) {
      result = await db.query(`
        UPDATE knowledge_heuristics
        SET confidence_score = LEAST(confidence_score + 0.1, 1.0),
            updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2
        RETURNING confidence_score
      `, [id, tenantId]);
    } else {
      result = await db.query(`
        UPDATE knowledge_heuristics
        SET confidence_score = GREATEST(confidence_score - 0.2, 0),
            updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2
        RETURNING confidence_score
      `, [id, tenantId]);
    }
    
    if (result.rowCount === 0) {
      return createResponse(404, { error: 'Heuristic not found' });
    }
    
    return createResponse(200, { 
      success: true,
      new_confidence: parseFloat(result.rows[0].confidence_score)
    });
  });
}

async function getStats(
  db: Client,
  tenantId: string
): Promise<APIGatewayProxyResult> {
  return withTenantContext(db, tenantId, async () => {
    const result = await db.query(`
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
    `, [tenantId]);
    
    const byDomain: Record<string, any> = {};
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
    
    return createResponse(200, {
      total_heuristics: totalHeuristics,
      total_high_confidence: totalHighConfidence,
      total_expiring_soon: totalExpiringSoon,
      by_domain: byDomain,
      domain_count: Object.keys(byDomain).length
    });
  });
}
