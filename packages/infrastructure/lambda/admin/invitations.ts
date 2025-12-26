/**
 * Administrator Invitation Lambda
 * Handles email-based administrator invitations with secure tokens
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../shared/logger.js';
import { success, created, handleError } from '../shared/response.js';
import { extractAuthContext, requireAdmin, requirePermission } from '../shared/auth.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../shared/errors.js';
import { executeStatement, toSqlParams } from '../shared/db/client.js';
import { createAuditLog } from '../shared/db/queries.js';
import { createInvitationSchema, acceptInvitationSchema, ROLE_HIERARCHY, AdminRoleType } from '../shared/admin/types.js';
import { generateInvitationToken, hashToken, calculateExpiry, isExpired } from '../shared/admin/tokens.js';
import { sendEmail, generateInvitationEmail } from '../shared/admin/email.js';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
  AdminSetUserMFAPreferenceCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const logger = new Logger({ handler: 'invitations' });
const cognitoClient = new CognitoIdentityProviderClient({});

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const requestLogger = logger.child({ requestId: context.awsRequestId, path: event.path });

  try {
    const invitationId = event.pathParameters?.invitationId;
    const action = event.path.split('/').pop();

    switch (event.httpMethod) {
      case 'GET':
        if (invitationId) return await handleGetInvitation(invitationId, event, requestLogger);
        return await handleListInvitations(event, requestLogger);

      case 'POST':
        if (action === 'accept') return await handleAcceptInvitation(event, requestLogger);
        if (action === 'resend' && invitationId) return await handleResendInvitation(invitationId, event, requestLogger);
        return await handleCreateInvitation(event, requestLogger);

      case 'DELETE':
        if (!invitationId) throw new ValidationError('Invitation ID required');
        return await handleRevokeInvitation(invitationId, event, requestLogger);

      default:
        throw new ValidationError(`Method ${event.httpMethod} not allowed`);
    }
  } catch (error) {
    return handleError(error, requestLogger);
  }
}

async function handleCreateInvitation(event: APIGatewayProxyEvent, logger: Logger): Promise<APIGatewayProxyResult> {
  const auth = extractAuthContext(event);
  requireAdmin(auth);
  requirePermission(auth, 'admin:write');

  const body = event.body ? JSON.parse(event.body) : {};
  const parseResult = createInvitationSchema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError('Invalid request body', parseResult.error.flatten().fieldErrors as Record<string, string[]>);
  }

  const { email, role, message, expiresInHours } = parseResult.data;

  if (ROLE_HIERARCHY[role as AdminRoleType] > ROLE_HIERARCHY[auth.role as AdminRoleType]) {
    throw new ForbiddenError('Cannot invite administrator with higher role than your own');
  }

  const existingAdmin = await executeStatement(
    `SELECT id FROM administrators WHERE email = :email AND tenant_id = :tenantId`,
    toSqlParams({ email, tenantId: auth.tenantId })
  );
  if (existingAdmin.rowCount > 0) {
    throw new ValidationError('An administrator with this email already exists');
  }

  const pendingInvitation = await executeStatement(
    `SELECT id FROM invitations WHERE email = :email AND tenant_id = :tenantId AND status = 'pending' AND expires_at > NOW()`,
    toSqlParams({ email, tenantId: auth.tenantId })
  );
  if (pendingInvitation.rowCount > 0) {
    throw new ValidationError('A pending invitation already exists for this email');
  }

  const { token, tokenHash } = generateInvitationToken();
  const expiresAt = calculateExpiry(expiresInHours || 48);
  const invitationId = uuidv4();

  const inviterResult = await executeStatement<{ first_name: string; last_name: string }>(
    `SELECT first_name, last_name FROM administrators WHERE id = :id`,
    toSqlParams({ id: auth.userId })
  );
  const inviterName = inviterResult.rows[0] ? `${inviterResult.rows[0].first_name} ${inviterResult.rows[0].last_name}` : 'An administrator';

  const appResult = await executeStatement<{ name: string }>(
    `SELECT name FROM apps WHERE id = :id`,
    toSqlParams({ id: auth.appId })
  );
  const appName = appResult.rows[0]?.name || auth.appId;

  await executeStatement(
    `INSERT INTO invitations (id, email, role, invited_by, app_id, tenant_id, environment, token_hash, expires_at, status, message, created_at)
     VALUES (:id, :email, :role, :invitedBy, :appId, :tenantId, :environment, :tokenHash, :expiresAt, 'pending', :message, NOW())`,
    toSqlParams({
      id: invitationId, email, role, invitedBy: auth.userId, appId: auth.appId,
      tenantId: auth.tenantId, environment: auth.environment, tokenHash, expiresAt, message: message || null,
    })
  );

  const acceptUrl = `${process.env.ADMIN_URL}/invite/accept?token=${token}`;
  const emailContent = generateInvitationEmail({
    inviteeName: '', inviterName, role, appName,
    environment: auth.environment, acceptUrl, expiresAt, message,
  });
  await sendEmail({ to: email, subject: `You've been invited to ${appName}`, html: emailContent.html, text: emailContent.text }, logger);

  await createAuditLog({
    tenant_id: auth.tenantId, actor_id: auth.userId, actor_type: 'admin',
    action: 'invitation.create', resource_type: 'invitation', resource_id: invitationId,
    details: { email, role, expiresAt },
    ip_address: event.requestContext.identity?.sourceIp || undefined,
    user_agent: event.headers['User-Agent'] || undefined,
  });

  logger.info('Invitation created and sent', { invitationId, email, role });
  return created({ invitation: { id: invitationId, email, role, status: 'pending', expiresAt, createdAt: new Date().toISOString() } });
}

async function handleAcceptInvitation(event: APIGatewayProxyEvent, logger: Logger): Promise<APIGatewayProxyResult> {
  const body = event.body ? JSON.parse(event.body) : {};
  const parseResult = acceptInvitationSchema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError('Invalid request body', parseResult.error.flatten().fieldErrors as Record<string, string[]>);
  }

  const { token, firstName, lastName, password, mfaMethod, phone } = parseResult.data;

  const tokenHash = hashToken(token);
  const inviteResult = await executeStatement<Record<string, unknown>>(
    `SELECT * FROM invitations WHERE token_hash = :tokenHash AND status = 'pending'`,
    toSqlParams({ tokenHash })
  );
  if (inviteResult.rowCount === 0) throw new NotFoundError('Invalid or expired invitation');

  const invitation = inviteResult.rows[0];
  if (isExpired(invitation.expires_at as string)) {
    await executeStatement(`UPDATE invitations SET status = 'expired' WHERE id = :id`, toSqlParams({ id: invitation.id }));
    throw new ValidationError('This invitation has expired');
  }

  if (invitation.environment === 'prod' && mfaMethod === 'sms' && !phone) {
    throw new ValidationError('Phone number required for SMS MFA');
  }

  const userPoolId = process.env.ADMIN_USER_POOL_ID;
  const adminUserId = uuidv4();

  await cognitoClient.send(new AdminCreateUserCommand({
    UserPoolId: userPoolId,
    Username: invitation.email as string,
    TemporaryPassword: password,
    UserAttributes: [
      { Name: 'email', Value: invitation.email as string },
      { Name: 'email_verified', Value: 'true' },
      { Name: 'given_name', Value: firstName },
      { Name: 'family_name', Value: lastName },
      { Name: 'custom:adminId', Value: adminUserId },
      { Name: 'custom:tenantId', Value: invitation.tenant_id as string },
      { Name: 'custom:role', Value: invitation.role as string },
    ],
    MessageAction: 'SUPPRESS',
  }));

  await cognitoClient.send(new AdminAddUserToGroupCommand({
    UserPoolId: userPoolId,
    Username: invitation.email as string,
    GroupName: invitation.role as string,
  }));

  if (invitation.environment === 'prod') {
    await cognitoClient.send(new AdminSetUserMFAPreferenceCommand({
      UserPoolId: userPoolId,
      Username: invitation.email as string,
      SoftwareTokenMfaSettings: mfaMethod === 'authenticator' ? { Enabled: true, PreferredMfa: true } : undefined,
      SMSMfaSettings: mfaMethod === 'sms' ? { Enabled: true, PreferredMfa: true } : undefined,
    }));
  }

  await executeStatement(
    `INSERT INTO administrators (id, cognito_user_id, email, first_name, last_name, display_name, role, app_id, tenant_id, mfa_enabled, mfa_method, status, created_at, updated_at, created_by, invitation_id)
     VALUES (:id, :cognitoUserId, :email, :firstName, :lastName, :displayName, :role, :appId, :tenantId, :mfaEnabled, :mfaMethod, 'active', NOW(), NOW(), :createdBy, :invitationId)`,
    toSqlParams({
      id: adminUserId, cognitoUserId: invitation.email, email: invitation.email as string, firstName, lastName,
      displayName: `${firstName} ${lastName}`, role: invitation.role as string, appId: invitation.app_id as string,
      tenantId: invitation.tenant_id as string, mfaEnabled: invitation.environment === 'prod',
      mfaMethod: mfaMethod, createdBy: invitation.invited_by as string, invitationId: invitation.id as string,
    })
  );

  await executeStatement(
    `INSERT INTO admin_profiles (admin_id, notifications, timezone, language, date_format, time_format, currency, theme, default_environment, sidebar_collapsed, table_rows_per_page, updated_at)
     VALUES (:adminId, :notifications, 'America/New_York', 'en', 'MM/DD/YYYY', '12h', 'USD', 'system', :defaultEnv, false, 25, NOW())`,
    toSqlParams({
      adminId: adminUserId,
      notifications: JSON.stringify({ method: 'email', frequency: 'immediate', categories: { security: true, billing: true, deployments: true, approvals: true, system: true } }),
      defaultEnv: invitation.environment as string,
    })
  );

  await executeStatement(
    `UPDATE invitations SET status = 'accepted', accepted_at = NOW(), accepted_by_ip = :ip WHERE id = :id`,
    toSqlParams({ id: invitation.id as string, ip: event.requestContext.identity?.sourceIp || null })
  );

  await createAuditLog({
    tenant_id: invitation.tenant_id as string, actor_id: adminUserId, actor_type: 'admin',
    action: 'invitation.accept', resource_type: 'invitation', resource_id: invitation.id as string,
    details: { email: invitation.email as string, role: invitation.role as string, firstName, lastName },
    ip_address: event.requestContext.identity?.sourceIp || undefined,
    user_agent: event.headers['User-Agent'] || undefined,
  });

  logger.info('Invitation accepted', { invitationId: invitation.id, adminUserId, email: invitation.email });
  return success({
    message: 'Invitation accepted successfully',
    adminUser: { id: adminUserId, email: invitation.email, firstName, lastName, role: invitation.role, mfaRequired: invitation.environment === 'prod' },
  });
}

async function handleListInvitations(event: APIGatewayProxyEvent, logger: Logger): Promise<APIGatewayProxyResult> {
  const auth = extractAuthContext(event);
  requireAdmin(auth);
  requirePermission(auth, 'admin:read');

  const status = event.queryStringParameters?.status;
  const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
  const offset = parseInt(event.queryStringParameters?.offset || '0', 10);

  let sql = `SELECT i.*, a.first_name as inviter_first_name, a.last_name as inviter_last_name
             FROM invitations i LEFT JOIN administrators a ON i.invited_by = a.id WHERE i.tenant_id = :tenantId`;
  const params: Record<string, unknown> = { tenantId: auth.tenantId };

  if (status) {
    sql += ` AND i.status = :status`;
    params.status = status;
  }
  sql += ` ORDER BY i.created_at DESC LIMIT :limit OFFSET :offset`;
  params.limit = limit;
  params.offset = offset;

  const result = await executeStatement<Record<string, unknown>>(sql, toSqlParams(params));
  const invitations = result.rows.map(row => ({
    id: row.id, email: row.email, role: row.role, status: row.status, environment: row.environment,
    invitedBy: { id: row.invited_by, name: row.inviter_first_name ? `${row.inviter_first_name} ${row.inviter_last_name}` : 'Unknown' },
    message: row.message, expiresAt: row.expires_at, createdAt: row.created_at, acceptedAt: row.accepted_at,
  }));

  return success({ invitations, pagination: { limit, offset, hasMore: invitations.length === limit } });
}

async function handleGetInvitation(invitationId: string, event: APIGatewayProxyEvent, logger: Logger): Promise<APIGatewayProxyResult> {
  const auth = extractAuthContext(event);
  requireAdmin(auth);
  requirePermission(auth, 'admin:read');

  const result = await executeStatement<Record<string, unknown>>(
    `SELECT i.*, a.first_name as inviter_first_name, a.last_name as inviter_last_name
     FROM invitations i LEFT JOIN administrators a ON i.invited_by = a.id WHERE i.id = :id AND i.tenant_id = :tenantId`,
    toSqlParams({ id: invitationId, tenantId: auth.tenantId })
  );
  if (result.rowCount === 0) throw new NotFoundError('Invitation not found');

  const row = result.rows[0];
  return success({
    invitation: {
      id: row.id, email: row.email, role: row.role, status: row.status, environment: row.environment,
      invitedBy: { id: row.invited_by, name: `${row.inviter_first_name} ${row.inviter_last_name}` },
      message: row.message, expiresAt: row.expires_at, createdAt: row.created_at, acceptedAt: row.accepted_at,
    },
  });
}

async function handleResendInvitation(invitationId: string, event: APIGatewayProxyEvent, logger: Logger): Promise<APIGatewayProxyResult> {
  const auth = extractAuthContext(event);
  requireAdmin(auth);
  requirePermission(auth, 'admin:write');

  const result = await executeStatement<Record<string, unknown>>(
    `SELECT * FROM invitations WHERE id = :id AND tenant_id = :tenantId`,
    toSqlParams({ id: invitationId, tenantId: auth.tenantId })
  );
  if (result.rowCount === 0) throw new NotFoundError('Invitation not found');

  const invitation = result.rows[0];
  if (invitation.status !== 'pending') throw new ValidationError(`Cannot resend ${invitation.status} invitation`);

  const { token, tokenHash } = generateInvitationToken();
  const expiresAt = calculateExpiry(48);

  await executeStatement(
    `UPDATE invitations SET token_hash = :tokenHash, expires_at = :expiresAt WHERE id = :id`,
    toSqlParams({ id: invitationId, tokenHash, expiresAt })
  );

  const inviterResult = await executeStatement<{ first_name: string; last_name: string }>(
    `SELECT first_name, last_name FROM administrators WHERE id = :id`,
    toSqlParams({ id: auth.userId })
  );
  const inviterName = inviterResult.rows[0] ? `${inviterResult.rows[0].first_name} ${inviterResult.rows[0].last_name}` : 'An administrator';

  const appResult = await executeStatement<{ name: string }>(
    `SELECT name FROM apps WHERE id = :id`,
    toSqlParams({ id: auth.appId })
  );
  const appName = appResult.rows[0]?.name || auth.appId;

  const acceptUrl = `${process.env.ADMIN_URL}/invite/accept?token=${token}`;
  const emailContent = generateInvitationEmail({
    inviteeName: '', inviterName, role: invitation.role as string, appName,
    environment: invitation.environment as string, acceptUrl, expiresAt, message: invitation.message as string | undefined,
  });
  await sendEmail({ to: invitation.email as string, subject: `Reminder: You've been invited to ${appName}`, html: emailContent.html, text: emailContent.text }, logger);

  logger.info('Invitation resent', { invitationId, email: invitation.email });
  return success({ message: 'Invitation resent successfully', expiresAt });
}

async function handleRevokeInvitation(invitationId: string, event: APIGatewayProxyEvent, logger: Logger): Promise<APIGatewayProxyResult> {
  const auth = extractAuthContext(event);
  requireAdmin(auth);
  requirePermission(auth, 'admin:write');

  const result = await executeStatement<Record<string, unknown>>(
    `SELECT * FROM invitations WHERE id = :id AND tenant_id = :tenantId`,
    toSqlParams({ id: invitationId, tenantId: auth.tenantId })
  );
  if (result.rowCount === 0) throw new NotFoundError('Invitation not found');

  const invitation = result.rows[0];
  if (invitation.status !== 'pending') throw new ValidationError(`Cannot revoke ${invitation.status} invitation`);

  await executeStatement(`UPDATE invitations SET status = 'revoked' WHERE id = :id`, toSqlParams({ id: invitationId }));

  await createAuditLog({
    tenant_id: auth.tenantId, actor_id: auth.userId, actor_type: 'admin',
    action: 'invitation.revoke', resource_type: 'invitation', resource_id: invitationId,
    details: { email: invitation.email as string },
    ip_address: event.requestContext.identity?.sourceIp || undefined,
    user_agent: event.headers['User-Agent'] || undefined,
  });

  logger.info('Invitation revoked', { invitationId, email: invitation.email });
  return success({ message: 'Invitation revoked successfully' });
}
