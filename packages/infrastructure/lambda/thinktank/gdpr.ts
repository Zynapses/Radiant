/**
 * Think Tank GDPR Data Requests Lambda
 * Handles data export, deletion, access, and rectification requests
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { executeStatement, stringParam } from '../shared/db/client';

type SqlParameter = ReturnType<typeof stringParam>;

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
};

interface GDPRRequest {
  id: string;
  userId: string;
  email: string;
  requestType: 'export' | 'delete' | 'access' | 'rectify' | 'restrict';
  status: 'pending' | 'processing' | 'completed' | 'rejected' | 'cancelled';
  requestedAt: string;
  processedAt: string | null;
  processedBy: string | null;
  notes: string | null;
  exportFileUrl: string | null;
  exportFileExpiresAt: string | null;
}

interface GDPRStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  byType: {
    export: number;
    delete: number;
    access: number;
    rectify: number;
    restrict: number;
  };
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const tenantId = event.requestContext.authorizer?.tenantId || event.headers['X-Tenant-ID'];
  if (!tenantId) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Tenant ID required' }),
    };
  }

  try {
    switch (event.httpMethod) {
      case 'GET':
        return await getRequests(tenantId, event.queryStringParameters);
      case 'POST':
        return await createRequest(tenantId, JSON.parse(event.body || '{}'));
      case 'PATCH':
        return await updateRequest(tenantId, JSON.parse(event.body || '{}'), event);
      case 'DELETE':
        return await cancelRequest(tenantId, event.queryStringParameters);
      default:
        return {
          statusCode: 405,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('GDPR handler error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

async function getRequests(
  tenantId: string,
  params: Record<string, string> | null
): Promise<APIGatewayProxyResult> {
  const status = params?.status;
  const requestType = params?.requestType;
  
  let query = `
    SELECT 
      id, user_id as "userId", email, 
      request_type as "requestType", status,
      requested_at as "requestedAt", processed_at as "processedAt",
      processed_by as "processedBy", notes,
      export_file_url as "exportFileUrl", 
      export_file_expires_at as "exportFileExpiresAt"
    FROM thinktank_gdpr_requests
    WHERE tenant_id = $1
  `;
  const sqlParams: SqlParameter[] = [stringParam('tenant_id', tenantId)];
  let paramIndex = 2;

  if (status && status !== 'all') {
    query += ` AND status = $${paramIndex}`;
    sqlParams.push(stringParam('status', status));
    paramIndex++;
  }

  if (requestType && requestType !== 'all') {
    query += ` AND request_type = $${paramIndex}`;
    sqlParams.push(stringParam('request_type', requestType));
  }

  query += ` ORDER BY requested_at DESC LIMIT 500`;

  const result = await executeStatement(query, sqlParams);
  const requests = result.rows as GDPRRequest[];

  // Get stats
  const statsResult = await executeStatement(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'pending') as pending,
      COUNT(*) FILTER (WHERE status = 'processing') as processing,
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      COUNT(*) FILTER (WHERE request_type = 'export') as export,
      COUNT(*) FILTER (WHERE request_type = 'delete') as delete,
      COUNT(*) FILTER (WHERE request_type = 'access') as access,
      COUNT(*) FILTER (WHERE request_type = 'rectify') as rectify,
      COUNT(*) FILTER (WHERE request_type = 'restrict') as restrict
    FROM thinktank_gdpr_requests
    WHERE tenant_id = $1
  `, [stringParam('tenant_id', tenantId)]);

  const statsRow = statsResult.rows[0] as Record<string, number>;
  const stats: GDPRStats = {
    total: Number(statsRow.total) || 0,
    pending: Number(statsRow.pending) || 0,
    processing: Number(statsRow.processing) || 0,
    completed: Number(statsRow.completed) || 0,
    byType: {
      export: Number(statsRow.export) || 0,
      delete: Number(statsRow.delete) || 0,
      access: Number(statsRow.access) || 0,
      rectify: Number(statsRow.rectify) || 0,
      restrict: Number(statsRow.restrict) || 0,
    },
  };

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ requests, stats }),
  };
}

async function createRequest(
  tenantId: string,
  body: { userId: string; email: string; requestType: string }
): Promise<APIGatewayProxyResult> {
  const { userId, email, requestType } = body;

  if (!userId || !email || !requestType) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'userId, email, and requestType are required' }),
    };
  }

  const validTypes = ['export', 'delete', 'access', 'rectify', 'restrict'];
  if (!validTypes.includes(requestType)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: `Invalid request type. Must be one of: ${validTypes.join(', ')}` }),
    };
  }

  // Check for existing pending request of same type
  const existingResult = await executeStatement(`
    SELECT id FROM thinktank_gdpr_requests
    WHERE tenant_id = $1 AND user_id = $2 AND request_type = $3 AND status IN ('pending', 'processing')
    LIMIT 1
  `, [
    stringParam('tenant_id', tenantId),
    stringParam('user_id', userId),
    stringParam('request_type', requestType),
  ]);

  if (existingResult.rows.length > 0) {
    return {
      statusCode: 409,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'A request of this type is already pending or processing for this user',
        existingRequestId: (existingResult.rows[0] as Record<string, string>).id,
      }),
    };
  }

  const result = await executeStatement(`
    INSERT INTO thinktank_gdpr_requests (
      tenant_id, user_id, email, request_type, status
    ) VALUES ($1, $2, $3, $4, 'pending')
    RETURNING id, requested_at as "requestedAt"
  `, [
    stringParam('tenant_id', tenantId),
    stringParam('user_id', userId),
    stringParam('email', email),
    stringParam('request_type', requestType),
  ]);

  const row = result.rows[0] as Record<string, string>;

  return {
    statusCode: 201,
    headers: corsHeaders,
    body: JSON.stringify({ 
      success: true, 
      id: row.id,
      requestedAt: row.requestedAt,
      message: `GDPR ${requestType} request created successfully`,
    }),
  };
}

async function updateRequest(
  tenantId: string,
  body: { requestId: string; status: string; notes?: string; exportFileUrl?: string },
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const { requestId, status, notes, exportFileUrl } = body;

  if (!requestId || !status) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'requestId and status are required' }),
    };
  }

  const validStatuses = ['pending', 'processing', 'completed', 'rejected', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }),
    };
  }

  const adminId = event.requestContext.authorizer?.userId || 'system';
  const isTerminal = ['completed', 'rejected', 'cancelled'].includes(status);

  let updateQuery = `
    UPDATE thinktank_gdpr_requests SET
      status = $3,
      updated_at = NOW()
  `;
  const sqlParams: SqlParameter[] = [
    stringParam('tenant_id', tenantId),
    stringParam('request_id', requestId),
    stringParam('status', status),
  ];
  let paramIndex = 4;

  if (isTerminal) {
    updateQuery += `, processed_at = NOW(), processed_by = $${paramIndex}`;
    sqlParams.push(stringParam('processed_by', adminId));
    paramIndex++;
  }

  if (notes !== undefined) {
    updateQuery += `, notes = $${paramIndex}`;
    sqlParams.push(stringParam('notes', notes));
    paramIndex++;
  }

  if (exportFileUrl) {
    updateQuery += `, export_file_url = $${paramIndex}, export_file_expires_at = NOW() + INTERVAL '7 days'`;
    sqlParams.push(stringParam('export_file_url', exportFileUrl));
  }

  updateQuery += ` WHERE tenant_id = $1 AND id = $2 RETURNING id`;

  const result = await executeStatement(updateQuery, sqlParams);

  if (result.rows.length === 0) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request not found' }),
    };
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ success: true, message: `Request status updated to ${status}` }),
  };
}

async function cancelRequest(
  tenantId: string,
  params: Record<string, string> | null
): Promise<APIGatewayProxyResult> {
  const requestId = params?.requestId;

  if (!requestId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'requestId query parameter is required' }),
    };
  }

  const result = await executeStatement(`
    UPDATE thinktank_gdpr_requests SET
      status = 'cancelled',
      updated_at = NOW()
    WHERE tenant_id = $1 AND id = $2 AND status IN ('pending', 'processing')
    RETURNING id
  `, [
    stringParam('tenant_id', tenantId),
    stringParam('request_id', requestId),
  ]);

  if (result.rows.length === 0) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request not found or already processed' }),
    };
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ success: true, message: 'Request cancelled successfully' }),
  };
}
