/**
 * Two-Person Approval Workflow Lambda
 * Production deployments require separate initiator and approver
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../shared/logger.js';
import { success, created, handleError } from '../shared/response.js';
import { extractAuthContext, requireAdmin, requirePermission, AuthContext } from '../shared/auth.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../shared/errors.js';
import { executeStatement, toSqlParams } from '../shared/db/client.js';
import { createAuditLog } from '../shared/db/queries.js';
import { createApprovalSchema, processApprovalSchema, ApprovalStatus, AdminRole } from '../shared/admin/types.js';
import { calculateExpiry, isExpired } from '../shared/admin/tokens.js';
import { sendEmail, generateApprovalEmail } from '../shared/admin/email.js';

const logger = new Logger({ handler: 'approvals' });

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
  const requestLogger = logger.child({ requestId: context.awsRequestId, path: event.path });

  try {
    const auth = extractAuthContext(event);
    requireAdmin(auth);

    const approvalId = event.pathParameters?.approvalId;
    const action = event.path.split('/').pop();

    switch (event.httpMethod) {
      case 'GET':
        if (approvalId) return await handleGetApproval(approvalId, auth, requestLogger);
        return await handleListApprovals(event, auth, requestLogger);
      case 'POST':
        if (action === 'process' && approvalId) return await handleProcessApproval(approvalId, event, auth, requestLogger);
        return await handleCreateApproval(event, auth, requestLogger);
      case 'DELETE':
        if (!approvalId) throw new ValidationError('Approval ID required');
        return await handleCancelApproval(approvalId, event, auth, requestLogger);
      default:
        throw new ValidationError(`Method ${event.httpMethod} not allowed`);
    }
  } catch (error) {
    return handleError(error, requestLogger);
  }
}

async function handleCreateApproval(event: APIGatewayProxyEvent, auth: AuthContext, logger: Logger): Promise<APIGatewayProxyResult> {
  requirePermission(auth, 'approvals:initiate');

  const body = event.body ? JSON.parse(event.body) : {};
  const parseResult = createApprovalSchema.safeParse(body);
  if (!parseResult.success) throw new ValidationError('Invalid request body', parseResult.error.flatten().fieldErrors as Record<string, string[]>);

  const { type, action, resourceType, resourceId, details, priority, notes, expiresInHours } = parseResult.data;
  const requiresTwoPersonApproval = auth.environment === 'prod';

  const requesterResult = await executeStatement<{ first_name: string; last_name: string }>(
    `SELECT first_name, last_name FROM administrators WHERE id = :id`,
    toSqlParams({ id: auth.userId })
  );
  const requesterName = requesterResult.rows[0] ? `${requesterResult.rows[0].first_name} ${requesterResult.rows[0].last_name}` : 'Unknown';

  const approvalId = uuidv4();
  const expiresAt = calculateExpiry(expiresInHours || 24);

  await executeStatement(
    `INSERT INTO approval_requests (id, type, app_id, tenant_id, environment, requested_by, requested_at, expires_at, status, action, resource_type, resource_id, details, priority, notes, requires_two_person, created_at)
     VALUES (:id, :type, :appId, :tenantId, :environment, :requestedBy, NOW(), :expiresAt, 'pending', :action, :resourceType, :resourceId, :details, :priority, :notes, :requiresTwoPerson, NOW())`,
    toSqlParams({
      id: approvalId, type, appId: auth.appId, tenantId: auth.tenantId, environment: auth.environment,
      requestedBy: auth.userId, expiresAt, action, resourceType, resourceId,
      details: JSON.stringify(details), priority: priority || 'medium', notes: notes || null, requiresTwoPerson: requiresTwoPersonApproval,
    })
  );

  if (requiresTwoPersonApproval) {
    await notifyApprovers(approvalId, auth, requesterName, logger);
  }

  await createAuditLog({
    tenant_id: auth.tenantId, actor_id: auth.userId, actor_type: 'admin',
    action: 'approval.create', resource_type: 'approval_request', resource_id: approvalId,
    details: { type, resourceType, resourceId, requiresTwoPersonApproval },
    ip_address: event.requestContext.identity?.sourceIp || undefined,
    user_agent: event.headers['User-Agent'] || undefined,
  });

  logger.info('Approval request created', { approvalId, type, requestedBy: auth.userId, requiresTwoPersonApproval });
  return created({
    approval: { id: approvalId, type, status: 'pending', action, resourceType, resourceId, priority: priority || 'medium', expiresAt, requiresTwoPersonApproval, createdAt: new Date().toISOString() },
  });
}

async function handleProcessApproval(approvalId: string, event: APIGatewayProxyEvent, auth: AuthContext, logger: Logger): Promise<APIGatewayProxyResult> {
  requirePermission(auth, 'approvals:*');

  const body = event.body ? JSON.parse(event.body) : {};
  const parseResult = processApprovalSchema.safeParse(body);
  if (!parseResult.success) throw new ValidationError('Invalid request body', parseResult.error.flatten().fieldErrors as Record<string, string[]>);

  const { action, reason } = parseResult.data;

  const result = await executeStatement<Record<string, unknown>>(
    `SELECT * FROM approval_requests WHERE id = :id AND tenant_id = :tenantId`,
    toSqlParams({ id: approvalId, tenantId: auth.tenantId })
  );
  if (result.rowCount === 0) throw new NotFoundError('Approval request not found');

  const approval = result.rows[0];
  if (approval.status !== 'pending') throw new ValidationError(`Cannot process ${approval.status} approval request`);
  if (isExpired(approval.expires_at as string)) {
    await executeStatement(`UPDATE approval_requests SET status = 'expired' WHERE id = :id`, toSqlParams({ id: approvalId }));
    throw new ValidationError('This approval request has expired');
  }

  if (approval.requires_two_person && approval.requested_by === auth.userId) {
    throw new ForbiddenError('You cannot approve your own request. Production deployments require approval from a different administrator.');
  }

  const newStatus: ApprovalStatus = action === 'approve' ? 'approved' : 'rejected';
  await executeStatement(
    `UPDATE approval_requests SET status = :status, approved_by = :approvedBy, approved_at = NOW(), rejected_reason = :reason WHERE id = :id`,
    toSqlParams({ id: approvalId, status: newStatus, approvedBy: auth.userId, reason: action === 'reject' ? reason : null })
  );

  if (action === 'approve') {
    await executeApprovedAction(approval, logger);
  }

  await createAuditLog({
    tenant_id: auth.tenantId, actor_id: auth.userId, actor_type: 'admin',
    action: `approval.${action}`, resource_type: 'approval_request', resource_id: approvalId,
    details: { type: approval.type, resourceType: approval.resource_type, resourceId: approval.resource_id, reason },
    ip_address: event.requestContext.identity?.sourceIp || undefined,
    user_agent: event.headers['User-Agent'] || undefined,
  });

  logger.info('Approval request processed', { approvalId, action, processedBy: auth.userId });
  return success({ approval: { id: approvalId, status: newStatus, processedBy: auth.userId, processedAt: new Date().toISOString(), reason: action === 'reject' ? reason : undefined } });
}

async function executeApprovedAction(approval: Record<string, unknown>, logger: Logger): Promise<void> {
  logger.info('Executing approved action', { type: approval.type, resourceType: approval.resource_type, resourceId: approval.resource_id });
  
  const details = typeof approval.details === 'string' ? JSON.parse(approval.details) : approval.details || {};
  
  switch (approval.type) {
    case 'deployment':
      break;
    case 'promotion':
      await executeStatement(
        `UPDATE deployments SET promoted_to = :targetEnv, promoted_at = NOW() WHERE id = :id`,
        toSqlParams({ id: approval.resource_id, targetEnv: details?.targetEnv })
      );
      break;
    case 'model_activation':
      await executeStatement(
        `UPDATE ai_models SET status = :status, thermal_state = :thermalState, updated_at = NOW() WHERE id = :id`,
        toSqlParams({ id: details?.modelId, status: details?.newStatus, thermalState: details?.thermalState })
      );
      break;
    case 'provider_change':
      await executeStatement(
        `UPDATE ai_providers SET config = :config, updated_at = NOW() WHERE id = :id`,
        toSqlParams({ id: details?.providerId, config: JSON.stringify(details?.config) })
      );
      break;
    case 'user_role_change':
      await executeStatement(
        `UPDATE administrators SET role = :role, updated_at = NOW() WHERE id = :id`,
        toSqlParams({ id: details?.userId, role: details?.newRole })
      );
      break;
    case 'billing_change':
      await executeStatement(
        `UPDATE billing_settings SET margin_percent = COALESCE(:marginPercent, margin_percent), tax_percent = COALESCE(:taxPercent, tax_percent), updated_at = NOW() WHERE tenant_id = :tenantId`,
        toSqlParams({ tenantId: details?.tenantId, marginPercent: details?.settings?.marginPercent, taxPercent: details?.settings?.taxPercent })
      );
      break;
    default:
      logger.warn('Unknown approval type', { type: approval.type });
  }
}

async function notifyApprovers(approvalId: string, auth: AuthContext, requesterName: string, logger: Logger): Promise<void> {
  const result = await executeStatement<{ id: string; email: string; first_name: string; last_name: string }>(
    `SELECT id, email, first_name, last_name FROM administrators WHERE tenant_id = :tenantId AND id != :userId AND status = 'active' AND role IN ('super_admin', 'admin')`,
    toSqlParams({ tenantId: auth.tenantId, userId: auth.userId })
  );
  if (result.rowCount === 0) { logger.warn('No other admins available to approve'); return; }

  const appResult = await executeStatement<{ name: string }>(
    `SELECT name FROM apps WHERE id = :id`,
    toSqlParams({ id: auth.appId })
  );
  const appName = appResult.rows[0]?.name || auth.appId;

  const approvalResult = await executeStatement<Record<string, unknown>>(
    `SELECT * FROM approval_requests WHERE id = :id`,
    toSqlParams({ id: approvalId })
  );
  const approval = approvalResult.rows[0];

  for (const admin of result.rows) {
    const approveUrl = `${process.env.ADMIN_URL}/approvals/${approvalId}?action=approve`;
    const rejectUrl = `${process.env.ADMIN_URL}/approvals/${approvalId}?action=reject`;
    const emailContent = generateApprovalEmail({
      approverName: admin.first_name, requesterName, appName, environment: auth.environment,
      action: approval.action as string, resourceType: approval.resource_type as string, resourceId: approval.resource_id as string,
      approveUrl, rejectUrl, expiresAt: approval.expires_at as string,
    });
    await sendEmail({ to: admin.email, subject: `⚠️ Approval Required: ${approval.action} - ${appName}`, html: emailContent.html, text: emailContent.text }, logger);
  }
  logger.info('Approvers notified', { approvalId, notifiedCount: result.rowCount });
}

async function handleListApprovals(event: APIGatewayProxyEvent, auth: AuthContext, logger: Logger): Promise<APIGatewayProxyResult> {
  requirePermission(auth, 'approvals:read');

  const status = event.queryStringParameters?.status;
  const pendingForMe = event.queryStringParameters?.pendingForMe === 'true';
  const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
  const offset = parseInt(event.queryStringParameters?.offset || '0', 10);

  let sql = `SELECT ar.*, req.first_name as requester_first_name, req.last_name as requester_last_name
             FROM approval_requests ar LEFT JOIN administrators req ON ar.requested_by = req.id WHERE ar.tenant_id = :tenantId`;
  const params: Record<string, unknown> = { tenantId: auth.tenantId };

  if (status) {
    sql += ` AND ar.status = :status`;
    params.status = status;
  }
  if (pendingForMe) {
    sql += ` AND ar.status = 'pending' AND ar.requested_by != :userId`;
    params.userId = auth.userId;
  }
  sql += ` ORDER BY ar.created_at DESC LIMIT :limit OFFSET :offset`;
  params.limit = limit;
  params.offset = offset;

  const result = await executeStatement<Record<string, unknown>>(sql, toSqlParams(params));
  const approvals = result.rows.map(row => ({
    id: row.id, type: row.type, status: row.status, environment: row.environment, action: row.action,
    resourceType: row.resource_type, resourceId: row.resource_id, priority: row.priority,
    requestedBy: { id: row.requested_by, name: `${row.requester_first_name} ${row.requester_last_name}` },
    requestedAt: row.requested_at, expiresAt: row.expires_at, requiresTwoPersonApproval: row.requires_two_person,
    canApprove: row.status === 'pending' && row.requested_by !== auth.userId,
  }));

  return success({ approvals, pagination: { limit, offset, hasMore: approvals.length === limit } });
}

async function handleGetApproval(approvalId: string, auth: AuthContext, logger: Logger): Promise<APIGatewayProxyResult> {
  requirePermission(auth, 'approvals:read');

  const result = await executeStatement<Record<string, unknown>>(
    `SELECT ar.*, req.first_name as requester_first_name, req.last_name as requester_last_name, req.email as requester_email
     FROM approval_requests ar LEFT JOIN administrators req ON ar.requested_by = req.id WHERE ar.id = :id AND ar.tenant_id = :tenantId`,
    toSqlParams({ id: approvalId, tenantId: auth.tenantId })
  );
  if (result.rowCount === 0) throw new NotFoundError('Approval request not found');

  const row = result.rows[0];
  return success({
    approval: {
      id: row.id, type: row.type, status: row.status, environment: row.environment, action: row.action,
      resourceType: row.resource_type, resourceId: row.resource_id, details: row.details, priority: row.priority, notes: row.notes,
      requestedBy: { id: row.requested_by, name: `${row.requester_first_name} ${row.requester_last_name}`, email: row.requester_email },
      requestedAt: row.requested_at, expiresAt: row.expires_at, requiresTwoPersonApproval: row.requires_two_person,
      canApprove: row.status === 'pending' && row.requested_by !== auth.userId,
    },
  });
}

async function handleCancelApproval(approvalId: string, event: APIGatewayProxyEvent, auth: AuthContext, logger: Logger): Promise<APIGatewayProxyResult> {
  const result = await executeStatement<Record<string, unknown>>(
    `SELECT * FROM approval_requests WHERE id = :id AND tenant_id = :tenantId`,
    toSqlParams({ id: approvalId, tenantId: auth.tenantId })
  );
  if (result.rowCount === 0) throw new NotFoundError('Approval request not found');

  const approval = result.rows[0];
  if (approval.requested_by !== auth.userId && auth.role !== AdminRole.SUPER_ADMIN) {
    throw new ForbiddenError('Only the requester or a super admin can cancel this request');
  }
  if (approval.status !== 'pending') throw new ValidationError(`Cannot cancel ${approval.status} approval request`);

  await executeStatement(`UPDATE approval_requests SET status = 'cancelled' WHERE id = :id`, toSqlParams({ id: approvalId }));
  await createAuditLog({
    tenant_id: auth.tenantId, actor_id: auth.userId, actor_type: 'admin',
    action: 'approval.cancel', resource_type: 'approval_request', resource_id: approvalId,
    details: { type: approval.type },
    ip_address: event.requestContext.identity?.sourceIp || undefined,
    user_agent: event.headers['User-Agent'] || undefined,
  });

  logger.info('Approval request cancelled', { approvalId });
  return success({ message: 'Approval request cancelled' });
}
