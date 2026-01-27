/**
 * UDS Admin API Lambda Handler
 * Admin endpoints for User Data Service management
 * 
 * Base Path: /api/admin/uds
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { 
  udsConversationService,
  udsMessageService,
  udsAuditService,
  udsUploadService,
  udsTierCoordinatorService,
  udsErasureService,
  udsEncryptionService,
} from '../shared/services/uds';
import { executeStatement, stringParam } from '../shared/db/client';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

// =============================================================================
// Types
// =============================================================================

interface RequestContext {
  tenantId: string;
  userId: string;
  isAdmin: boolean;
}

// =============================================================================
// Helpers
// =============================================================================

const response = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-Id',
  },
  body: JSON.stringify(body),
});

const success = (data: unknown) => response(200, { success: true, data });
const created = (data: unknown) => response(201, { success: true, data });
const noContent = () => response(204, null);
const badRequest = (message: string) => response(400, { success: false, error: { code: 'BAD_REQUEST', message } });
const unauthorized = () => response(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
const forbidden = () => response(403, { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
const notFound = (message: string) => response(404, { success: false, error: { code: 'NOT_FOUND', message } });
const serverError = (message: string) => response(500, { success: false, error: { code: 'SERVER_ERROR', message } });

const getContext = (event: any): RequestContext | null => {
  const tenantId = event.requestContext?.authorizer?.tenantId || event.headers?.['x-tenant-id'];
  const userId = event.requestContext?.authorizer?.userId;
  const isAdmin = event.requestContext?.authorizer?.isAdmin === true;

  if (!tenantId || !userId) {
    return null;
  }

  return { tenantId, userId, isAdmin };
};

const parseBody = <T>(event: any): T | null => {
  try {
    return event.body ? JSON.parse(event.body) : null;
  } catch {
    return null;
  }
};

// =============================================================================
// Handler
// =============================================================================

export const handler: APIGatewayProxyHandler = async (event) => {
  const method = event.httpMethod;
  const path = event.path.replace(/^\/api\/admin\/uds/, '');
  const pathParts = path.split('/').filter(Boolean);

  logger.info('UDS Admin API request', { method, path, pathParts });

  try {
    const ctx = getContext(event);
    if (!ctx) {
      return unauthorized();
    }
    if (!ctx.isAdmin) {
      return forbidden();
    }

    // Set security context for RLS
    await executeStatement(
      `SELECT set_config('app.current_tenant_id', $1, true);
       SELECT set_config('app.current_user_id', $2, true);
       SELECT set_config('app.is_admin', 'true', true);`,
      [stringParam('tenantId', ctx.tenantId), stringParam('userId', ctx.userId)]
    );

    // Route handling
    const resource = pathParts[0];

    switch (resource) {
      // =========================================================================
      // Dashboard
      // =========================================================================
      case 'dashboard':
        if (method === 'GET') {
          return await getDashboard(ctx);
        }
        break;

      // =========================================================================
      // Config
      // =========================================================================
      case 'config':
        if (method === 'GET') {
          return await getConfig(ctx);
        }
        if (method === 'PUT') {
          return await updateConfig(ctx, parseBody(event));
        }
        break;

      // =========================================================================
      // Conversations
      // =========================================================================
      case 'conversations':
        if (pathParts.length === 1) {
          if (method === 'GET') {
            return await listConversations(ctx, event.queryStringParameters || {});
          }
        } else if (pathParts.length === 2) {
          const conversationId = pathParts[1];
          if (method === 'GET') {
            return await getConversation(ctx, conversationId);
          }
          if (method === 'DELETE') {
            return await deleteConversation(ctx, conversationId);
          }
        } else if (pathParts.length === 3 && pathParts[2] === 'messages') {
          const conversationId = pathParts[1];
          if (method === 'GET') {
            return await listMessages(ctx, conversationId, event.queryStringParameters || {});
          }
        }
        break;

      // =========================================================================
      // Uploads
      // =========================================================================
      case 'uploads':
        if (pathParts.length === 1) {
          if (method === 'GET') {
            return await listUploads(ctx, event.queryStringParameters || {});
          }
        } else if (pathParts.length === 2) {
          const uploadId = pathParts[1];
          if (method === 'GET') {
            return await getUpload(ctx, uploadId);
          }
          if (method === 'DELETE') {
            return await deleteUpload(ctx, uploadId);
          }
        }
        break;

      // =========================================================================
      // Audit Log
      // =========================================================================
      case 'audit':
        if (pathParts.length === 1) {
          if (method === 'GET') {
            return await listAuditLog(ctx, event.queryStringParameters || {});
          }
        } else if (pathParts[1] === 'verify') {
          if (method === 'POST') {
            return await verifyAuditChain(ctx, parseBody(event));
          }
        } else if (pathParts[1] === 'export') {
          if (method === 'POST') {
            return await exportAuditLog(ctx, parseBody(event));
          }
        } else if (pathParts[1] === 'merkle-trees') {
          if (method === 'GET') {
            return await listMerkleTrees(ctx);
          }
        }
        break;

      // =========================================================================
      // Tier Management
      // =========================================================================
      case 'tiers':
        if (pathParts.length === 1) {
          if (method === 'GET') {
            return await getTierHealth(ctx);
          }
        } else if (pathParts[1] === 'metrics') {
          if (method === 'GET') {
            return await getTierMetrics(ctx, event.queryStringParameters || {});
          }
        } else if (pathParts[1] === 'promote') {
          if (method === 'POST') {
            return await triggerPromotion(ctx, parseBody(event));
          }
        } else if (pathParts[1] === 'archive') {
          if (method === 'POST') {
            return await triggerArchival(ctx);
          }
        } else if (pathParts[1] === 'retrieve') {
          if (method === 'POST') {
            return await triggerRetrieval(ctx, parseBody(event));
          }
        } else if (pathParts[1] === 'housekeeping') {
          if (method === 'POST') {
            return await runHousekeeping(ctx);
          }
        }
        break;

      // =========================================================================
      // GDPR Erasure
      // =========================================================================
      case 'erasure':
        if (pathParts.length === 1) {
          if (method === 'GET') {
            return await listErasureRequests(ctx);
          }
          if (method === 'POST') {
            return await createErasureRequest(ctx, parseBody(event));
          }
        } else if (pathParts.length === 2) {
          const requestId = pathParts[1];
          if (method === 'GET') {
            return await getErasureRequest(ctx, requestId);
          }
          if (method === 'DELETE') {
            return await cancelErasureRequest(ctx, requestId);
          }
        }
        break;

      // =========================================================================
      // Encryption
      // =========================================================================
      case 'encryption':
        if (pathParts[1] === 'keys') {
          if (method === 'GET') {
            return await getEncryptionKeys(ctx);
          }
        } else if (pathParts[1] === 'rotate') {
          if (method === 'POST') {
            return await rotateEncryptionKey(ctx, parseBody(event));
          }
        }
        break;

      // =========================================================================
      // Statistics
      // =========================================================================
      case 'stats':
        if (method === 'GET') {
          return await getStatistics(ctx, event.queryStringParameters || {});
        }
        break;
    }

    return notFound(`Unknown endpoint: ${method} ${path}`);

  } catch (error) {
    logger.error('UDS Admin API error', { error, path, method });
    return serverError(error instanceof Error ? error.message : 'Unknown error');
  }
};

// =============================================================================
// Dashboard
// =============================================================================

async function getDashboard(ctx: RequestContext) {
  const [health, config, stats] = await Promise.all([
    udsTierCoordinatorService.getHealth(ctx.tenantId),
    getConfigInternal(ctx.tenantId),
    getStatsInternal(ctx.tenantId),
  ]);

  return success({
    health,
    config,
    stats,
    timestamp: new Date().toISOString(),
  });
}

// =============================================================================
// Config
// =============================================================================

async function getConfig(ctx: RequestContext) {
  const config = await getConfigInternal(ctx.tenantId);
  return success(config);
}

async function getConfigInternal(tenantId: string) {
  const result = await executeStatement(
    `SELECT * FROM uds_config WHERE tenant_id = $1`,
    [stringParam('tenantId', tenantId)]
  );
  return result.rows?.[0] || null;
}

async function updateConfig(ctx: RequestContext, body: any) {
  if (!body) {
    return badRequest('Request body required');
  }

  const updates: string[] = [];
  const params: any[] = [stringParam('tenantId', ctx.tenantId)];
  let paramIndex = 2;

  const allowedFields = [
    'hot_session_ttl_seconds', 'hot_message_ttl_seconds', 'hot_cache_max_conversations',
    'warm_retention_days', 'warm_full_text_search_enabled', 'warm_vector_search_enabled',
    'cold_compression_enabled', 'cold_retention_years',
    'max_upload_size_mb', 'allowed_file_types', 'virus_scan_enabled',
    'encryption_enabled', 'per_user_encryption_keys', 'audit_log_enabled', 'merkle_chain_enabled',
    'gdpr_auto_delete_enabled', 'gdpr_retention_days', 'gdpr_anonymize_on_delete',
  ];

  for (const field of allowedFields) {
    const camelField = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (body[camelField] !== undefined) {
      updates.push(`${field} = $${paramIndex}`);
      params.push(stringParam(field, String(body[camelField])));
      paramIndex++;
    }
  }

  if (updates.length === 0) {
    return badRequest('No valid fields to update');
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');

  await executeStatement(
    `UPDATE uds_config SET ${updates.join(', ')} WHERE tenant_id = $1`,
    params
  );

  return success(await getConfigInternal(ctx.tenantId));
}

// =============================================================================
// Conversations
// =============================================================================

async function listConversations(ctx: RequestContext, query: Record<string, string>) {
  const result = await udsConversationService.list(ctx.tenantId, ctx.userId, {
    status: query.status as any,
    tier: query.tier as any,
    search: query.search,
    limit: parseInt(query.limit) || 50,
    offset: parseInt(query.offset) || 0,
  });
  return success(result);
}

async function getConversation(ctx: RequestContext, conversationId: string) {
  const conversation = await udsConversationService.get(ctx.tenantId, ctx.userId, conversationId);
  if (!conversation) {
    return notFound('Conversation not found');
  }
  return success(conversation);
}

async function deleteConversation(ctx: RequestContext, conversationId: string) {
  await udsConversationService.delete(ctx.tenantId, ctx.userId, conversationId);
  return noContent();
}

// =============================================================================
// Messages
// =============================================================================

async function listMessages(ctx: RequestContext, conversationId: string, query: Record<string, string>) {
  const messages = await udsMessageService.list(ctx.tenantId, ctx.userId, {
    conversationId,
    limit: parseInt(query.limit) || 100,
    offset: parseInt(query.offset) || 0,
    checkpointsOnly: query.checkpointsOnly === 'true',
  });
  return success(messages);
}

// =============================================================================
// Uploads
// =============================================================================

async function listUploads(ctx: RequestContext, query: Record<string, string>) {
  const uploads = await udsUploadService.list(ctx.tenantId, ctx.userId, {
    contentType: query.contentType as any,
    status: query.status as any,
    search: query.search,
    limit: parseInt(query.limit) || 50,
    offset: parseInt(query.offset) || 0,
  });
  return success(uploads);
}

async function getUpload(ctx: RequestContext, uploadId: string) {
  const upload = await udsUploadService.get(ctx.tenantId, ctx.userId, uploadId);
  if (!upload) {
    return notFound('Upload not found');
  }
  return success(upload);
}

async function deleteUpload(ctx: RequestContext, uploadId: string) {
  await udsUploadService.delete(ctx.tenantId, ctx.userId, uploadId);
  return noContent();
}

// =============================================================================
// Audit Log
// =============================================================================

async function listAuditLog(ctx: RequestContext, query: Record<string, string>) {
  const entries = await udsAuditService.list(ctx.tenantId, {
    userId: query.userId,
    eventType: query.eventType,
    eventCategory: query.eventCategory as any,
    resourceType: query.resourceType,
    resourceId: query.resourceId,
    startDate: query.startDate ? new Date(query.startDate) : undefined,
    endDate: query.endDate ? new Date(query.endDate) : undefined,
    limit: parseInt(query.limit) || 100,
    offset: parseInt(query.offset) || 0,
  });
  return success(entries);
}

async function verifyAuditChain(ctx: RequestContext, body: any) {
  if (!body?.fromSequence || !body?.toSequence) {
    return badRequest('fromSequence and toSequence required');
  }

  const result = await udsAuditService.verify(
    ctx.tenantId,
    body.fromSequence,
    body.toSequence
  );
  return success(result);
}

async function exportAuditLog(ctx: RequestContext, body: any) {
  if (!body?.startDate || !body?.endDate) {
    return badRequest('startDate and endDate required');
  }

  const exported = await udsAuditService.export(
    ctx.tenantId,
    new Date(body.startDate),
    new Date(body.endDate),
    body.format || 'json'
  );
  return success({ data: exported, format: body.format || 'json' });
}

async function listMerkleTrees(ctx: RequestContext) {
  const trees = await udsAuditService.getMerkleTrees(ctx.tenantId);
  return success(trees);
}

// =============================================================================
// Tier Management
// =============================================================================

async function getTierHealth(ctx: RequestContext) {
  const health = await udsTierCoordinatorService.getHealth(ctx.tenantId);
  return success(health);
}

async function getTierMetrics(ctx: RequestContext, query: Record<string, string>) {
  const metrics = await udsTierCoordinatorService.getMetrics(
    ctx.tenantId,
    (query.period as 'hour' | 'day' | 'week') || 'day'
  );
  return success(metrics);
}

async function triggerPromotion(ctx: RequestContext, body: any) {
  const result = await udsTierCoordinatorService.promoteHotToWarm(ctx.tenantId);
  return success(result);
}

async function triggerArchival(ctx: RequestContext) {
  const result = await udsTierCoordinatorService.archiveWarmToCold(ctx.tenantId);
  return success(result);
}

async function triggerRetrieval(ctx: RequestContext, body: any) {
  if (!body?.resourceIds?.length) {
    return badRequest('resourceIds array required');
  }

  const result = await udsTierCoordinatorService.retrieveColdToWarm(
    ctx.tenantId,
    body.resourceIds
  );
  return success(result);
}

async function runHousekeeping(ctx: RequestContext) {
  await udsTierCoordinatorService.runHousekeeping(ctx.tenantId);
  return success({ message: 'Housekeeping started' });
}

// =============================================================================
// GDPR Erasure
// =============================================================================

async function listErasureRequests(ctx: RequestContext) {
  const requests = await udsErasureService.list(ctx.tenantId);
  return success(requests);
}

async function createErasureRequest(ctx: RequestContext, body: any) {
  if (!body?.scope) {
    return badRequest('scope required');
  }

  const request = await udsErasureService.request(ctx.tenantId, ctx.userId, {
    scope: body.scope,
    userId: body.userId,
    conversationId: body.conversationId,
    eraseConversations: body.eraseConversations,
    eraseMessages: body.eraseMessages,
    eraseUploads: body.eraseUploads,
    eraseAuditLog: body.eraseAuditLog,
    eraseFromBackups: body.eraseFromBackups,
    anonymizeRemaining: body.anonymizeRemaining,
    legalBasis: body.legalBasis,
    legalReference: body.legalReference,
    scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
  });
  return created(request);
}

async function getErasureRequest(ctx: RequestContext, requestId: string) {
  const request = await udsErasureService.get(ctx.tenantId, requestId);
  if (!request) {
    return notFound('Erasure request not found');
  }
  return success(request);
}

async function cancelErasureRequest(ctx: RequestContext, requestId: string) {
  await udsErasureService.cancel(ctx.tenantId, requestId);
  return noContent();
}

// =============================================================================
// Encryption
// =============================================================================

async function getEncryptionKeys(ctx: RequestContext) {
  const result = await executeStatement(
    `SELECT id, tenant_id, user_id, key_id, key_type, algorithm, version, is_active, created_at, rotated_at
     FROM uds_encryption_keys WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [stringParam('tenantId', ctx.tenantId)]
  );
  return success(result.rows || []);
}

async function rotateEncryptionKey(ctx: RequestContext, body: any) {
  const newKey = await udsEncryptionService.rotateKey(ctx.tenantId, body?.userId);
  return success(newKey);
}

// =============================================================================
// Statistics
// =============================================================================

async function getStatistics(ctx: RequestContext, query: Record<string, string>) {
  const stats = await getStatsInternal(ctx.tenantId);
  return success(stats);
}

async function getStatsInternal(tenantId: string) {
  const [conversations, messages, uploads, audit] = await Promise.all([
    executeStatement(
      `SELECT 
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status = 'active') as active,
         COUNT(*) FILTER (WHERE status = 'archived') as archived,
         COUNT(*) FILTER (WHERE current_tier = 'hot') as hot,
         COUNT(*) FILTER (WHERE current_tier = 'warm') as warm,
         COUNT(*) FILTER (WHERE current_tier = 'cold') as cold
       FROM uds_conversations WHERE tenant_id = $1 AND status != 'deleted'`,
      [stringParam('tenantId', tenantId)]
    ),
    executeStatement(
      `SELECT 
         COUNT(*) as total,
         SUM(input_tokens) as total_input_tokens,
         SUM(output_tokens) as total_output_tokens,
         SUM(cost_credits) as total_cost
       FROM uds_messages WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    ),
    executeStatement(
      `SELECT 
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status = 'ready') as ready,
         COUNT(*) FILTER (WHERE status = 'processing') as processing,
         SUM(file_size_bytes) as total_size
       FROM uds_uploads WHERE tenant_id = $1 AND status != 'deleted'`,
      [stringParam('tenantId', tenantId)]
    ),
    executeStatement(
      `SELECT 
         COUNT(*) as total,
         MIN(created_at) as first_entry,
         MAX(created_at) as last_entry
       FROM uds_audit_log WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    ),
  ]);

  return {
    conversations: conversations.rows?.[0] || {},
    messages: messages.rows?.[0] || {},
    uploads: uploads.rows?.[0] || {},
    audit: audit.rows?.[0] || {},
  };
}
