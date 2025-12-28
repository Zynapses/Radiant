/**
 * Audit Trail Service
 * 
 * Comprehensive audit logging for security and compliance
 */

import { DynamoDBClient, PutItemCommand, QueryCommand, QueryCommandInput, AttributeValue } from '@aws-sdk/client-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../logger';

const dynamodb = new DynamoDBClient({});
const s3 = new S3Client({});

const AUDIT_TABLE = process.env.AUDIT_TABLE || 'radiant-audit-logs';
const AUDIT_BUCKET = process.env.AUDIT_BUCKET || 'radiant-audit-archive';

export type AuditAction =
  | 'create' | 'read' | 'update' | 'delete'
  | 'login' | 'logout' | 'login_failed'
  | 'api_key_created' | 'api_key_revoked'
  | 'permission_granted' | 'permission_revoked'
  | 'config_changed' | 'export' | 'import';

export type AuditResource =
  | 'user' | 'tenant' | 'api_key' | 'model'
  | 'webhook' | 'config' | 'billing' | 'subscription'
  | 'batch_job' | 'audit_log' | 'notification';

export interface AuditEntry {
  id: string;
  tenantId: string;
  userId?: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  description: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface AuditContext {
  tenantId: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

// Buffer for batch writing
const auditBuffer: AuditEntry[] = [];
const BUFFER_SIZE = 25;
const FLUSH_INTERVAL = 5000;

let flushTimer: NodeJS.Timeout | null = null;

/**
 * Log an audit event
 */
export async function logAudit(
  context: AuditContext,
  action: AuditAction,
  resource: AuditResource,
  options: {
    resourceId?: string;
    description: string;
    metadata?: Record<string, unknown>;
    severity?: 'info' | 'warning' | 'critical';
  }
): Promise<void> {
  const entry: AuditEntry = {
    id: generateId(),
    tenantId: context.tenantId,
    userId: context.userId,
    action,
    resource,
    resourceId: options.resourceId,
    description: options.description,
    metadata: options.metadata,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    requestId: context.requestId,
    timestamp: new Date().toISOString(),
    severity: options.severity || 'info',
  };

  // Add to buffer
  auditBuffer.push(entry);

  // Flush if buffer is full or critical event
  if (auditBuffer.length >= BUFFER_SIZE || entry.severity === 'critical') {
    await flushAuditLogs();
  } else {
    startFlushTimer();
  }
}

/**
 * Quick audit helpers
 */
export const Audit = {
  create: (ctx: AuditContext, resource: AuditResource, resourceId: string, description: string) =>
    logAudit(ctx, 'create', resource, { resourceId, description }),

  read: (ctx: AuditContext, resource: AuditResource, resourceId: string, description: string) =>
    logAudit(ctx, 'read', resource, { resourceId, description }),

  update: (ctx: AuditContext, resource: AuditResource, resourceId: string, description: string, changes?: Record<string, unknown>) =>
    logAudit(ctx, 'update', resource, { resourceId, description, metadata: { changes } }),

  delete: (ctx: AuditContext, resource: AuditResource, resourceId: string, description: string) =>
    logAudit(ctx, 'delete', resource, { resourceId, description, severity: 'warning' }),

  login: (ctx: AuditContext, userId: string, success: boolean) =>
    logAudit(ctx, success ? 'login' : 'login_failed', 'user', {
      resourceId: userId,
      description: success ? 'User logged in' : 'Failed login attempt',
      severity: success ? 'info' : 'warning',
    }),

  apiKeyCreated: (ctx: AuditContext, keyId: string, keyName: string) =>
    logAudit(ctx, 'api_key_created', 'api_key', {
      resourceId: keyId,
      description: `API key "${keyName}" created`,
      metadata: { keyName },
    }),

  apiKeyRevoked: (ctx: AuditContext, keyId: string, keyName: string) =>
    logAudit(ctx, 'api_key_revoked', 'api_key', {
      resourceId: keyId,
      description: `API key "${keyName}" revoked`,
      metadata: { keyName },
      severity: 'warning',
    }),

  configChanged: (ctx: AuditContext, key: string, oldValue: unknown, newValue: unknown) =>
    logAudit(ctx, 'config_changed', 'config', {
      resourceId: key,
      description: `Configuration "${key}" changed`,
      metadata: { oldValue, newValue },
      severity: 'warning',
    }),
};

/**
 * Query audit logs
 */
export async function queryAuditLogs(
  tenantId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    action?: AuditAction;
    resource?: AuditResource;
    userId?: string;
    limit?: number;
  }
): Promise<AuditEntry[]> {
  const { startDate, endDate, action, resource, userId, limit = 100 } = options || {};

  let filterExpression = '';
  const expressionAttributeValues: Record<string, AttributeValue> = {
    ':pk': { S: `TENANT#${tenantId}` },
  };

  if (startDate) {
    filterExpression += '#ts >= :startDate';
    expressionAttributeValues[':startDate'] = { S: startDate };
  }

  if (endDate) {
    if (filterExpression) filterExpression += ' AND ';
    filterExpression += '#ts <= :endDate';
    expressionAttributeValues[':endDate'] = { S: endDate };
  }

  if (action) {
    if (filterExpression) filterExpression += ' AND ';
    filterExpression += '#action = :action';
    expressionAttributeValues[':action'] = { S: action };
  }

  if (resource) {
    if (filterExpression) filterExpression += ' AND ';
    filterExpression += '#resource = :resource';
    expressionAttributeValues[':resource'] = { S: resource };
  }

  if (userId) {
    if (filterExpression) filterExpression += ' AND ';
    filterExpression += 'user_id = :userId';
    expressionAttributeValues[':userId'] = { S: userId };
  }

  const params: QueryCommandInput = {
    TableName: AUDIT_TABLE,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: expressionAttributeValues as Record<string, AttributeValue>,
    Limit: limit,
    ScanIndexForward: false, // Most recent first
  };

  if (filterExpression) {
    params.FilterExpression = filterExpression;
    params.ExpressionAttributeNames = {
      '#ts': 'timestamp',
      '#action': 'action',
      '#resource': 'resource',
    };
  }

  const result = await dynamodb.send(new QueryCommand(params));

  return (result.Items || []).map(itemToAuditEntry);
}

/**
 * Export audit logs to S3 for archival
 */
export async function exportAuditLogs(
  tenantId: string,
  startDate: string,
  endDate: string
): Promise<{ key: string; count: number }> {
  const logs = await queryAuditLogs(tenantId, {
    startDate,
    endDate,
    limit: 10000,
  });

  const key = `${tenantId}/${startDate.substring(0, 7)}/audit-${startDate}-${endDate}.json`;

  await s3.send(new PutObjectCommand({
    Bucket: AUDIT_BUCKET,
    Key: key,
    Body: JSON.stringify(logs, null, 2),
    ContentType: 'application/json',
  }));

  return { key, count: logs.length };
}

/**
 * Flush buffered audit logs to database
 */
async function flushAuditLogs(): Promise<void> {
  if (auditBuffer.length === 0) return;

  const entries = auditBuffer.splice(0, auditBuffer.length);

  const writePromises = entries.map(entry =>
    dynamodb.send(new PutItemCommand({
      TableName: AUDIT_TABLE,
      Item: {
        pk: { S: `TENANT#${entry.tenantId}` },
        sk: { S: `LOG#${entry.timestamp}#${entry.id}` },
        id: { S: entry.id },
        tenant_id: { S: entry.tenantId },
        user_id: entry.userId ? { S: entry.userId } : { NULL: true },
        action: { S: entry.action },
        resource: { S: entry.resource },
        resource_id: entry.resourceId ? { S: entry.resourceId } : { NULL: true },
        description: { S: entry.description },
        metadata: entry.metadata ? { S: JSON.stringify(entry.metadata) } : { NULL: true },
        ip_address: entry.ipAddress ? { S: entry.ipAddress } : { NULL: true },
        user_agent: entry.userAgent ? { S: entry.userAgent } : { NULL: true },
        request_id: entry.requestId ? { S: entry.requestId } : { NULL: true },
        timestamp: { S: entry.timestamp },
        severity: { S: entry.severity },
        ttl: { N: String(Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60) }, // 90 days
      },
    }))
  );

  await Promise.all(writePromises);
}

/**
 * Schedule flush for end of Lambda execution.
 * Uses a short timeout that will execute before Lambda freezes,
 * but prefer calling ensureAuditLogsFlushed() explicitly.
 */
function startFlushTimer(): void {
  if (flushTimer) return;
  // Use shorter timeout for Lambda (500ms instead of 5s)
  // This ensures flush happens before Lambda context freezes
  const LAMBDA_SAFE_TIMEOUT = 500;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    await flushAuditLogs();
  }, LAMBDA_SAFE_TIMEOUT);
}

/**
 * Ensure all buffered audit logs are flushed.
 * Call this at the end of Lambda handlers.
 */
export async function ensureAuditLogsFlushed(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flushAuditLogs();
}

/**
 * Wrapper for Lambda handlers that ensures audit logs are flushed
 */
export function withAuditFlush<TEvent, TResult>(
  handler: (event: TEvent) => Promise<TResult>
): (event: TEvent) => Promise<TResult> {
  return async (event: TEvent) => {
    try {
      return await handler(event);
    } finally {
      await ensureAuditLogsFlushed().catch(err => {
        logger.error('Failed to flush audit logs', err instanceof Error ? err : new Error(String(err)));
      });
    }
  };
}

function generateId(): string {
  return 'aud_' + crypto.randomUUID().replace(/-/g, '');
}

function itemToAuditEntry(item: Record<string, AttributeValue>): AuditEntry {
  return {
    id: item.id?.S || '',
    tenantId: item.tenant_id?.S || '',
    userId: item.user_id?.S,
    action: item.action?.S as AuditAction,
    resource: item.resource?.S as AuditResource,
    resourceId: item.resource_id?.S,
    description: item.description?.S || '',
    metadata: item.metadata?.S ? JSON.parse(item.metadata.S) : undefined,
    ipAddress: item.ip_address?.S,
    userAgent: item.user_agent?.S,
    requestId: item.request_id?.S,
    timestamp: item.timestamp?.S || '',
    severity: item.severity?.S as 'info' | 'warning' | 'critical',
  };
}
