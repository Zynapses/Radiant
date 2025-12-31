/**
 * RADIANT TMS - Tenant Service
 * Complete implementation of tenant lifecycle management
 */

import { v4 as uuidv4 } from 'uuid';
import { KMSClient, CreateKeyCommand, ScheduleKeyDeletionCommand } from '@aws-sdk/client-kms';
import { S3Client, DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import * as AWSXRay from 'aws-xray-sdk';
import { SqlParameter } from '@aws-sdk/client-rds-data';
import {
  executeStatement,
  executeStatementSingle,
  withTransaction,
  param,
  jsonParam,
  uuidParam,
  timestampParam,
  setTenantContext,
} from '../utils/db';
import { logger } from '../utils/logger';
import {
  Tenant,
  TenantSummary,
  TenantUser,
  TenantMembership,
  TenantAuditLog,
  CreateTenantInput,
  CreateTenantResult,
  UpdateTenantInput,
  SoftDeleteTenantInput,
  SoftDeleteResult,
  RestoreTenantInput,
  RestoreResult,
  CreatePhantomTenantInput,
  PhantomTenantResult,
  AddMembershipInput,
  MembershipResult,
  UpdateMembershipInput,
  ListTenantsInput,
  ListTenantsResult,
  ListMembershipsResult,
  HardDeleteResult,
  TenantStatus,
  TmsContext,
  RetentionSetting,
} from '../types/tenant.types';

const rawKmsClient = new KMSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const rawS3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

const kmsClient = process.env.AWS_XRAY_DAEMON_ADDRESS
  ? AWSXRay.captureAWSv3Client(rawKmsClient)
  : rawKmsClient;

const s3Client = process.env.AWS_XRAY_DAEMON_ADDRESS
  ? AWSXRay.captureAWSv3Client(rawS3Client)
  : rawS3Client;

const DATA_BUCKET = process.env.DATA_BUCKET || 'radiant-data';
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';

class TenantService {
  // ============================================================================
  // CREATE TENANT
  // ============================================================================

  async createTenant(input: CreateTenantInput, ctx: TmsContext): Promise<CreateTenantResult> {
    const tenantId = uuidv4();
    const userId = uuidv4();
    const membershipId = uuidv4();

    logger.info({ tenantId, adminEmail: input.adminEmail }, 'Creating new tenant');

    return withTransaction(async (txId) => {
      // Get retention settings for compliance
      const retentionSettings = await this.getRetentionSettings();
      let retentionDays = input.retentionDays ?? 30;

      // HIPAA minimum retention override
      if (input.complianceMode.includes('hipaa')) {
        const hipaaMinDays = Number(retentionSettings.find(s => s.settingKey === 'hipaa_min_retention_days')?.settingValue) || 90;
        if (retentionDays < hipaaMinDays) {
          retentionDays = hipaaMinDays;
          logger.info({ tenantId, retentionDays }, 'Enforcing HIPAA minimum retention');
        }
      }

      // Create KMS key for Tier 3+ tenants
      let kmsKeyArn: string | null = null;
      if (input.tier >= 3) {
        try {
          const kmsResponse = await kmsClient.send(new CreateKeyCommand({
            Description: `RADIANT tenant key: ${input.displayName} (${tenantId})`,
            KeyUsage: 'ENCRYPT_DECRYPT',
            Origin: 'AWS_KMS',
            Tags: [
              { TagKey: 'TenantId', TagValue: tenantId },
              { TagKey: 'Environment', TagValue: ENVIRONMENT },
              { TagKey: 'ManagedBy', TagValue: 'RADIANT-TMS' },
            ],
          }));
          kmsKeyArn = kmsResponse.KeyMetadata?.Arn || null;
          logger.info({ tenantId, kmsKeyArn }, 'Created KMS key for tenant');
        } catch (error) {
          logger.error({ tenantId, error }, 'Failed to create KMS key');
          // Continue without KMS key - not fatal
        }
      }

      // Insert tenant
      await executeStatement(
        `INSERT INTO tenants (
          id, name, display_name, domain, type, status, tier, primary_region,
          compliance_mode, retention_days, kms_key_arn, metadata, settings
        ) VALUES (
          $1::uuid, $2, $3, $4, $5, 'active', $6, $7,
          $8::jsonb, $9, $10, $11::jsonb, '{}'::jsonb
        )`,
        [
          uuidParam('1', tenantId),
          param('2', input.name),
          param('3', input.displayName),
          param('4', input.domain || null),
          param('5', input.type),
          param('6', input.tier),
          param('7', input.primaryRegion),
          jsonParam('8', input.complianceMode),
          param('9', retentionDays),
          param('10', kmsKeyArn),
          jsonParam('11', input.metadata || {}),
        ],
        txId
      );

      // Create admin user
      const cognitoId = input.adminCognitoId || `manual_${uuidv4()}`;
      await executeStatement(
        `INSERT INTO users (
          id, tenant_id, cognito_user_id, email, display_name, role, status
        ) VALUES (
          $1::uuid, $2::uuid, $3, $4, $5, 'admin', 'active'
        )`,
        [
          uuidParam('1', userId),
          uuidParam('2', tenantId),
          param('3', cognitoId),
          param('4', input.adminEmail),
          param('5', input.adminName),
        ],
        txId
      );

      // Create owner membership
      await executeStatement(
        `INSERT INTO tenant_user_memberships (
          id, tenant_id, user_id, role, status, joined_at
        ) VALUES (
          $1::uuid, $2::uuid, $3::uuid, 'owner', 'active', NOW()
        )`,
        [
          uuidParam('1', membershipId),
          uuidParam('2', tenantId),
          uuidParam('3', userId),
        ],
        txId
      );

      // Audit log
      await this.auditLog(
        tenantId,
        userId,
        ctx.adminId,
        'tenant_created',
        'tenant',
        tenantId,
        null,
        { name: input.name, displayName: input.displayName, tier: input.tier, adminEmail: input.adminEmail },
        ctx,
        txId
      );

      logger.info({ tenantId, userId, membershipId }, 'Tenant created successfully');

      // Fetch and return created entities
      const tenant = await this.getTenantById(tenantId, txId);
      const adminUser = await executeStatementSingle<TenantUser>(
        `SELECT * FROM users WHERE id = $1::uuid`,
        [uuidParam('1', userId)],
        txId
      );
      const membership = await executeStatementSingle<TenantMembership>(
        `SELECT * FROM tenant_user_memberships WHERE id = $1::uuid`,
        [uuidParam('1', membershipId)],
        txId
      );

      return {
        tenant: tenant!,
        adminUser: adminUser!,
        membership: membership!,
      };
    });
  }

  // ============================================================================
  // GET TENANT
  // ============================================================================

  async getTenantById(tenantId: string, transactionId?: string): Promise<Tenant | null> {
    return executeStatementSingle<Tenant>(
      `SELECT 
        id, name, display_name, domain, type, status, tier, primary_region,
        compliance_mode, retention_days, deletion_scheduled_at, deletion_requested_by,
        stripe_customer_id, kms_key_arn, settings, metadata, created_at, updated_at
      FROM tenants WHERE id = $1::uuid`,
      [uuidParam('1', tenantId)],
      transactionId
    );
  }

  async getTenantSummary(tenantId: string): Promise<TenantSummary | null> {
    return executeStatementSingle<TenantSummary>(
      `SELECT * FROM v_tms_tenant_summary WHERE tenant_id = $1::uuid`,
      [uuidParam('1', tenantId)]
    );
  }

  // ============================================================================
  // UPDATE TENANT
  // ============================================================================

  async updateTenant(tenantId: string, input: UpdateTenantInput, ctx: TmsContext): Promise<Tenant> {
    logger.info({ tenantId, input }, 'Updating tenant');

    return withTransaction(async (txId) => {
      // Get current tenant state for audit
      const currentTenant = await this.getTenantById(tenantId, txId);
      if (!currentTenant) {
        throw new Error(`Tenant not found: ${tenantId}`);
      }

      // Build update fields
      const updates: string[] = ['updated_at = NOW()'];
      const params: SqlParameter[] = [];
      let paramIndex = 1;

      if (input.name !== undefined) {
        updates.push(`name = $${paramIndex}`);
        params.push(param(String(paramIndex++), input.name));
      }
      if (input.displayName !== undefined) {
        updates.push(`display_name = $${paramIndex}`);
        params.push(param(String(paramIndex++), input.displayName));
      }
      if (input.tier !== undefined) {
        updates.push(`tier = $${paramIndex}`);
        params.push(param(String(paramIndex++), input.tier));
      }
      if (input.complianceMode !== undefined) {
        updates.push(`compliance_mode = $${paramIndex}::jsonb`);
        params.push(jsonParam(String(paramIndex++), input.complianceMode));
      }
      if (input.retentionDays !== undefined) {
        // Validate HIPAA minimum
        if (currentTenant.complianceMode.includes('hipaa') || input.complianceMode?.includes('hipaa')) {
          const retentionSettings = await this.getRetentionSettings();
          const hipaaMinDays = Number(retentionSettings.find(s => s.settingKey === 'hipaa_min_retention_days')?.settingValue) || 90;
          if (input.retentionDays < hipaaMinDays) {
            throw new Error(`HIPAA compliance requires minimum ${hipaaMinDays} day retention`);
          }
        }
        updates.push(`retention_days = $${paramIndex}`);
        params.push(param(String(paramIndex++), input.retentionDays));
      }
      if (input.domain !== undefined) {
        updates.push(`domain = $${paramIndex}`);
        params.push(param(String(paramIndex++), input.domain));
      }
      if (input.metadata !== undefined) {
        updates.push(`metadata = $${paramIndex}::jsonb`);
        params.push(jsonParam(String(paramIndex++), input.metadata));
      }
      if (input.settings !== undefined) {
        updates.push(`settings = $${paramIndex}::jsonb`);
        params.push(jsonParam(String(paramIndex++), input.settings));
      }

      // Add tenant ID as last param
      params.push(uuidParam(String(paramIndex), tenantId));

      await executeStatement(
        `UPDATE tenants SET ${updates.join(', ')} WHERE id = $${paramIndex}::uuid`,
        params,
        txId
      );

      // Audit log
      await this.auditLog(
        tenantId,
        ctx.userId,
        ctx.adminId,
        'tenant_updated',
        'tenant',
        tenantId,
        { name: currentTenant.name, tier: currentTenant.tier },
        input,
        ctx,
        txId
      );

      const updatedTenant = await this.getTenantById(tenantId, txId);
      logger.info({ tenantId }, 'Tenant updated successfully');
      return updatedTenant!;
    });
  }

  // ============================================================================
  // SOFT DELETE TENANT
  // ============================================================================

  async softDeleteTenant(tenantId: string, input: SoftDeleteTenantInput, ctx: TmsContext): Promise<SoftDeleteResult> {
    logger.info({ tenantId, reason: input.reason }, 'Soft deleting tenant');

    return withTransaction(async (txId) => {
      const tenant = await this.getTenantById(tenantId, txId);
      if (!tenant) {
        throw new Error(`Tenant not found: ${tenantId}`);
      }

      if (tenant.status !== 'active' && tenant.status !== 'suspended') {
        throw new Error(`Tenant cannot be deleted: status is ${tenant.status}`);
      }

      const deletionScheduledAt = new Date();
      deletionScheduledAt.setDate(deletionScheduledAt.getDate() + tenant.retentionDays);

      // Update tenant status
      await executeStatement(
        `UPDATE tenants SET 
          status = 'pending_deletion',
          deletion_scheduled_at = $1::timestamptz,
          deletion_requested_by = $2::uuid,
          updated_at = NOW()
        WHERE id = $3::uuid`,
        [
          timestampParam('1', deletionScheduledAt),
          uuidParam('2', input.initiatedBy),
          uuidParam('3', tenantId),
        ],
        txId
      );

      // Count affected users
      const userCounts = await executeStatementSingle<{ total: number; willBeDeleted: number }>(
        `SELECT 
          COUNT(DISTINCT tum.user_id)::integer as total,
          COUNT(DISTINCT tum.user_id) FILTER (
            WHERE (SELECT COUNT(*) FROM tenant_user_memberships m2 
                   WHERE m2.user_id = tum.user_id AND m2.status = 'active') = 1
          )::integer as will_be_deleted
        FROM tenant_user_memberships tum
        WHERE tum.tenant_id = $1::uuid AND tum.status = 'active'`,
        [uuidParam('1', tenantId)],
        txId
      );

      const total = userCounts?.total || 0;
      const willBeDeleted = userCounts?.willBeDeleted || 0;

      // Audit log
      await this.auditLog(
        tenantId,
        ctx.userId,
        ctx.adminId,
        'tenant_soft_deleted',
        'tenant',
        tenantId,
        { status: tenant.status },
        { 
          status: 'pending_deletion', 
          reason: input.reason, 
          deletionScheduledAt: deletionScheduledAt.toISOString(),
          affectedUsers: total,
          usersToBeDeleted: willBeDeleted,
        },
        ctx,
        txId
      );

      logger.info({ 
        tenantId, 
        deletionScheduledAt: deletionScheduledAt.toISOString(),
        affectedUsers: total,
      }, 'Tenant soft deleted');

      return {
        tenantId,
        status: TenantStatus.PENDING_DELETION,
        deletionScheduledAt: deletionScheduledAt.toISOString(),
        retentionDays: tenant.retentionDays,
        affectedUsers: {
          total,
          willBeDeleted,
          willRemain: total - willBeDeleted,
        },
        notificationsSent: input.notifyUsers,
      };
    });
  }

  // ============================================================================
  // RESTORE TENANT
  // ============================================================================

  async restoreTenant(tenantId: string, input: RestoreTenantInput, ctx: TmsContext): Promise<RestoreResult> {
    logger.info({ tenantId }, 'Restoring tenant');

    return withTransaction(async (txId) => {
      const tenant = await this.getTenantById(tenantId, txId);
      if (!tenant) {
        throw new Error(`Tenant not found: ${tenantId}`);
      }

      if (tenant.status !== 'pending_deletion') {
        throw new Error(`Tenant is not pending deletion: status is ${tenant.status}`);
      }

      // Verify the verification code
      const verifyResult = await executeStatementSingle<{ valid: boolean; error?: string; message?: string }>(
        `SELECT * FROM tms_verify_code($1::uuid, $2::uuid, 'restore_tenant', $3::uuid, $4)`,
        [
          ctx.userId ? uuidParam('1', ctx.userId) : param('1', null),
          ctx.adminId ? uuidParam('2', ctx.adminId) : param('2', null),
          uuidParam('3', tenantId),
          param('4', input.verificationCode),
        ],
        txId
      );

      if (!verifyResult?.valid) {
        throw new Error(verifyResult?.message || 'Invalid verification code');
      }

      // Restore tenant
      await executeStatement(
        `UPDATE tenants SET 
          status = 'active',
          deletion_scheduled_at = NULL,
          deletion_requested_by = NULL,
          updated_at = NOW()
        WHERE id = $1::uuid`,
        [uuidParam('1', tenantId)],
        txId
      );

      // Audit log
      await this.auditLog(
        tenantId,
        ctx.userId,
        ctx.adminId,
        'tenant_restored',
        'tenant',
        tenantId,
        { status: 'pending_deletion' },
        { status: 'active', restoredBy: input.restoredBy },
        ctx,
        txId
      );

      logger.info({ tenantId, restoredBy: input.restoredBy }, 'Tenant restored');

      return {
        tenantId,
        status: TenantStatus.ACTIVE,
        restoredAt: new Date().toISOString(),
        restoredBy: input.restoredBy,
      };
    });
  }

  // ============================================================================
  // HARD DELETE TENANT (Called by scheduled job)
  // ============================================================================

  async hardDeleteTenant(tenantId: string, ctx: TmsContext): Promise<HardDeleteResult> {
    logger.info({ tenantId }, 'Hard deleting tenant');

    const tenant = await this.getTenantById(tenantId);
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    if (tenant.status !== 'pending_deletion') {
      throw new Error(`Tenant is not pending deletion: status is ${tenant.status}`);
    }

    // Delete S3 data
    let s3ObjectsDeleted = 0;
    try {
      s3ObjectsDeleted = await this.deleteS3TenantData(tenantId);
    } catch (error) {
      logger.error({ tenantId, error }, 'Failed to delete S3 data');
    }

    // Schedule KMS key deletion
    let kmsKeyScheduledForDeletion = false;
    if (tenant.kmsKeyArn) {
      try {
        await kmsClient.send(new ScheduleKeyDeletionCommand({
          KeyId: tenant.kmsKeyArn,
          PendingWindowInDays: 7,
        }));
        kmsKeyScheduledForDeletion = true;
        logger.info({ tenantId, kmsKeyArn: tenant.kmsKeyArn }, 'KMS key scheduled for deletion');
      } catch (error) {
        logger.error({ tenantId, error }, 'Failed to schedule KMS key deletion');
      }
    }

    // Execute database hard delete
    const deleteResult = await executeStatementSingle<{
      deletedTenantId: string;
      deletedTenantName: string;
      deletedAt: string;
      usersDeleted: number;
      usersRetained: number;
    }>(
      `SELECT * FROM tms_process_scheduled_deletions() 
       WHERE deleted_tenant_id = $1::uuid LIMIT 1`,
      [uuidParam('1', tenantId)]
    );

    if (!deleteResult) {
      throw new Error('Hard delete failed - no result returned');
    }

    logger.info({
      tenantId,
      usersDeleted: deleteResult.usersDeleted,
      usersRetained: deleteResult.usersRetained,
      s3ObjectsDeleted,
      kmsKeyScheduledForDeletion,
    }, 'Tenant hard deleted');

    return {
      tenantId,
      tenantName: deleteResult.deletedTenantName,
      deletedAt: deleteResult.deletedAt,
      usersDeleted: deleteResult.usersDeleted,
      usersRetained: deleteResult.usersRetained,
      s3ObjectsDeleted,
      kmsKeyScheduledForDeletion,
    };
  }

  private async deleteS3TenantData(tenantId: string): Promise<number> {
    const prefix = `tenants/${tenantId}/`;
    let continuationToken: string | undefined;
    let totalDeleted = 0;

    do {
      const listResult = await s3Client.send(new ListObjectsV2Command({
        Bucket: DATA_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }));

      if (listResult.Contents && listResult.Contents.length > 0) {
        await s3Client.send(new DeleteObjectsCommand({
          Bucket: DATA_BUCKET,
          Delete: {
            Objects: listResult.Contents.map(obj => ({ Key: obj.Key! })),
          },
        }));

        totalDeleted += listResult.Contents.length;
        logger.info({ tenantId, count: listResult.Contents.length }, 'Deleted S3 objects batch');
      }

      continuationToken = listResult.NextContinuationToken;
    } while (continuationToken);

    return totalDeleted;
  }

  // ============================================================================
  // PHANTOM TENANT (Individual User Signup)
  // ============================================================================

  async createPhantomTenant(input: CreatePhantomTenantInput, ctx: TmsContext): Promise<PhantomTenantResult> {
    logger.info({ email: input.userEmail }, 'Creating phantom tenant');

    const result = await executeStatementSingle<{
      tenantId: string;
      userId: string;
      tenantName: string;
    }>(
      `SELECT * FROM tms_create_phantom_tenant($1, $2, $3)`,
      [
        param('1', input.userEmail),
        param('2', input.userDisplayName || null),
        param('3', input.cognitoUserId),
      ]
    );

    if (!result) {
      throw new Error('Failed to create phantom tenant');
    }

    // Check if this was an existing user
    const existingCheck = await executeStatementSingle<{ count: number }>(
      `SELECT COUNT(*)::integer as count FROM tenant_user_memberships 
       WHERE user_id = $1::uuid`,
      [uuidParam('1', result.userId)]
    );

    const isExisting = (existingCheck?.count || 0) > 1;

    logger.info({ 
      tenantId: result.tenantId, 
      userId: result.userId, 
      isExisting 
    }, 'Phantom tenant operation complete');

    return {
      tenantId: result.tenantId,
      userId: result.userId,
      tenantName: result.tenantName,
      isExisting,
    };
  }

  // ============================================================================
  // LIST TENANTS
  // ============================================================================

  async listTenants(input: ListTenantsInput, ctx: TmsContext): Promise<ListTenantsResult> {
    const conditions: string[] = [];
    const params: SqlParameter[] = [];
    let paramIndex = 1;

    if (input.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(param(String(paramIndex++), input.status));
    }
    if (input.type) {
      conditions.push(`type = $${paramIndex}`);
      params.push(param(String(paramIndex++), input.type));
    }
    if (input.tier) {
      conditions.push(`tier = $${paramIndex}`);
      params.push(param(String(paramIndex++), input.tier));
    }
    if (input.search) {
      conditions.push(`(name ILIKE $${paramIndex} OR display_name ILIKE $${paramIndex})`);
      params.push(param(String(paramIndex++), `%${input.search}%`));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderColumn = input.orderBy === 'name' ? 'name' : 
                        input.orderBy === 'tier' ? 'tier' : 
                        input.orderBy === 'updated_at' ? 'updated_at' : 'created_at';

    // Get total count
    const countResult = await executeStatementSingle<{ count: number }>(
      `SELECT COUNT(*)::integer as count FROM v_tms_tenant_summary ${whereClause}`,
      params
    );
    const total = countResult?.count || 0;

    // Get tenants with pagination
    params.push(param(String(paramIndex++), input.limit));
    params.push(param(String(paramIndex++), input.offset));

    const tenants = await executeStatement<TenantSummary>(
      `SELECT * FROM v_tms_tenant_summary ${whereClause} 
       ORDER BY ${orderColumn} ${input.orderDir.toUpperCase()}
       LIMIT $${paramIndex - 2} OFFSET $${paramIndex - 1}`,
      params
    );

    return {
      tenants,
      total,
      limit: input.limit,
      offset: input.offset,
      hasMore: input.offset + tenants.length < total,
    };
  }

  // ============================================================================
  // MEMBERSHIP MANAGEMENT
  // ============================================================================

  async addMembership(input: AddMembershipInput, ctx: TmsContext): Promise<MembershipResult> {
    logger.info({ tenantId: input.tenantId, email: input.userEmail, role: input.role }, 'Adding membership');

    return withTransaction(async (txId) => {
      // Check if tenant exists and is active
      const tenant = await this.getTenantById(input.tenantId, txId);
      if (!tenant || tenant.status === 'deleted') {
        throw new Error(`Tenant not found or deleted: ${input.tenantId}`);
      }

      // Check if user exists or create new
      let user = await executeStatementSingle<TenantUser>(
        `SELECT * FROM users WHERE email = $1`,
        [param('1', input.userEmail)],
        txId
      );

      let isNewUser = false;
      if (!user) {
        // Create new user (will need Cognito setup later)
        const userId = uuidv4();
        await executeStatement(
          `INSERT INTO users (id, tenant_id, cognito_user_id, email, display_name, role, status)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5, 'user', 'pending')`,
          [
            uuidParam('1', userId),
            uuidParam('2', input.tenantId),
            param('3', `pending_${userId}`),
            param('4', input.userEmail),
            param('5', input.userEmail.split('@')[0]),
          ],
          txId
        );
        user = await executeStatementSingle<TenantUser>(
          `SELECT * FROM users WHERE id = $1::uuid`,
          [uuidParam('1', userId)],
          txId
        );
        isNewUser = true;
      }

      // Check if membership already exists
      const existingMembership = await executeStatementSingle<TenantMembership>(
        `SELECT * FROM tenant_user_memberships 
         WHERE tenant_id = $1::uuid AND user_id = $2::uuid`,
        [uuidParam('1', input.tenantId), uuidParam('2', user!.id)],
        txId
      );

      if (existingMembership) {
        throw new Error(`User already has membership in this tenant`);
      }

      // Create membership
      const membershipId = uuidv4();
      const invitationToken = input.sendInvitation ? uuidv4() : null;
      const invitationExpires = input.sendInvitation 
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        : null;

      await executeStatement(
        `INSERT INTO tenant_user_memberships (
          id, tenant_id, user_id, role, status, invited_by, 
          invitation_token, invitation_expires_at
        ) VALUES (
          $1::uuid, $2::uuid, $3::uuid, $4, $5, $6::uuid, $7, $8::timestamptz
        )`,
        [
          uuidParam('1', membershipId),
          uuidParam('2', input.tenantId),
          uuidParam('3', user!.id),
          param('4', input.role),
          param('5', input.sendInvitation ? 'invited' : 'active'),
          uuidParam('6', input.invitedBy),
          param('7', invitationToken),
          invitationExpires ? timestampParam('8', invitationExpires) : param('8', null),
        ],
        txId
      );

      const membership = await executeStatementSingle<TenantMembership>(
        `SELECT * FROM tenant_user_memberships WHERE id = $1::uuid`,
        [uuidParam('1', membershipId)],
        txId
      );

      // Audit log
      await this.auditLog(
        input.tenantId,
        ctx.userId,
        ctx.adminId,
        'membership_created',
        'membership',
        membershipId,
        null,
        { email: input.userEmail, role: input.role, isNewUser },
        ctx,
        txId
      );

      logger.info({ membershipId, tenantId: input.tenantId, userId: user!.id }, 'Membership created');

      return {
        membership: membership!,
        user: user!,
        invitationSent: input.sendInvitation,
      };
    });
  }

  async updateMembership(
    tenantId: string,
    userId: string,
    input: UpdateMembershipInput,
    ctx: TmsContext
  ): Promise<TenantMembership> {
    logger.info({ tenantId, userId, input }, 'Updating membership');

    return withTransaction(async (txId) => {
      const membership = await executeStatementSingle<TenantMembership>(
        `SELECT * FROM tenant_user_memberships 
         WHERE tenant_id = $1::uuid AND user_id = $2::uuid`,
        [uuidParam('1', tenantId), uuidParam('2', userId)],
        txId
      );

      if (!membership) {
        throw new Error('Membership not found');
      }

      // Prevent demoting the last owner
      if (membership.role === 'owner' && input.role && input.role !== 'owner') {
        const ownerCount = await executeStatementSingle<{ count: number }>(
          `SELECT COUNT(*)::integer as count FROM tenant_user_memberships 
           WHERE tenant_id = $1::uuid AND role = 'owner' AND status = 'active'`,
          [uuidParam('1', tenantId)],
          txId
        );
        if ((ownerCount?.count || 0) <= 1) {
          throw new Error('Cannot demote the last owner');
        }
      }

      const updates: string[] = ['updated_at = NOW()'];
      const params: SqlParameter[] = [];
      let paramIndex = 1;

      if (input.role) {
        updates.push(`role = $${paramIndex}`);
        params.push(param(String(paramIndex++), input.role));
      }
      if (input.status) {
        updates.push(`status = $${paramIndex}`);
        params.push(param(String(paramIndex++), input.status));
      }

      params.push(uuidParam(String(paramIndex++), tenantId));
      params.push(uuidParam(String(paramIndex), userId));

      await executeStatement(
        `UPDATE tenant_user_memberships SET ${updates.join(', ')} 
         WHERE tenant_id = $${paramIndex - 1}::uuid AND user_id = $${paramIndex}::uuid`,
        params,
        txId
      );

      // Audit log
      await this.auditLog(
        tenantId,
        ctx.userId,
        ctx.adminId,
        'membership_updated',
        'membership',
        membership.id,
        { role: membership.role, status: membership.status },
        input,
        ctx,
        txId
      );

      const updatedMembership = await executeStatementSingle<TenantMembership>(
        `SELECT * FROM tenant_user_memberships 
         WHERE tenant_id = $1::uuid AND user_id = $2::uuid`,
        [uuidParam('1', tenantId), uuidParam('2', userId)],
        txId
      );

      return updatedMembership!;
    });
  }

  async removeMembership(tenantId: string, userId: string, ctx: TmsContext): Promise<void> {
    logger.info({ tenantId, userId }, 'Removing membership');

    await withTransaction(async (txId) => {
      const membership = await executeStatementSingle<TenantMembership>(
        `SELECT * FROM tenant_user_memberships 
         WHERE tenant_id = $1::uuid AND user_id = $2::uuid`,
        [uuidParam('1', tenantId), uuidParam('2', userId)],
        txId
      );

      if (!membership) {
        throw new Error('Membership not found');
      }

      // Prevent removing the last owner
      if (membership.role === 'owner') {
        const ownerCount = await executeStatementSingle<{ count: number }>(
          `SELECT COUNT(*)::integer as count FROM tenant_user_memberships 
           WHERE tenant_id = $1::uuid AND role = 'owner' AND status = 'active'`,
          [uuidParam('1', tenantId)],
          txId
        );
        if ((ownerCount?.count || 0) <= 1) {
          throw new Error('Cannot remove the last owner');
        }
      }

      // Delete membership (trigger will handle orphan check)
      await executeStatement(
        `DELETE FROM tenant_user_memberships 
         WHERE tenant_id = $1::uuid AND user_id = $2::uuid`,
        [uuidParam('1', tenantId), uuidParam('2', userId)],
        txId
      );

      // Audit log
      await this.auditLog(
        tenantId,
        ctx.userId,
        ctx.adminId,
        'membership_removed',
        'membership',
        membership.id,
        { role: membership.role },
        null,
        ctx,
        txId
      );

      logger.info({ tenantId, userId }, 'Membership removed');
    });
  }

  async listMemberships(tenantId: string, ctx: TmsContext): Promise<ListMembershipsResult> {
    const memberships = await executeStatement<TenantMembership & { user: TenantUser }>(
      `SELECT 
        m.*,
        jsonb_build_object(
          'id', u.id,
          'tenantId', u.tenant_id,
          'cognitoUserId', u.cognito_user_id,
          'email', u.email,
          'displayName', u.display_name,
          'role', u.role,
          'status', u.status,
          'createdAt', u.created_at,
          'updatedAt', u.updated_at
        ) as user
      FROM tenant_user_memberships m
      JOIN users u ON m.user_id = u.id
      WHERE m.tenant_id = $1::uuid
      ORDER BY m.joined_at ASC`,
      [uuidParam('1', tenantId)]
    );

    return {
      memberships,
      total: memberships.length,
    };
  }

  // ============================================================================
  // RETENTION SETTINGS
  // ============================================================================

  async getRetentionSettings(): Promise<RetentionSetting[]> {
    return executeStatement<RetentionSetting>(
      `SELECT * FROM tms_retention_settings ORDER BY setting_key`
    );
  }

  async updateRetentionSetting(key: string, value: unknown, adminId: string): Promise<RetentionSetting> {
    await executeStatement(
      `UPDATE tms_retention_settings 
       SET setting_value = $1::jsonb, updated_by = $2::uuid, updated_at = NOW()
       WHERE setting_key = $3`,
      [jsonParam('1', value), uuidParam('2', adminId), param('3', key)]
    );

    const setting = await executeStatementSingle<RetentionSetting>(
      `SELECT * FROM tms_retention_settings WHERE setting_key = $1`,
      [param('1', key)]
    );

    return setting!;
  }

  // ============================================================================
  // VERIFICATION CODES
  // ============================================================================

  async createVerificationCode(
    userId: string | null,
    adminId: string | null,
    operation: string,
    resourceId: string,
    expiresMinutes: number = 15
  ): Promise<string> {
    const result = await executeStatementSingle<{ tmsCreateVerificationCode: string }>(
      `SELECT tms_create_verification_code($1::uuid, $2::uuid, $3, $4::uuid, $5) as code`,
      [
        userId ? uuidParam('1', userId) : param('1', null),
        adminId ? uuidParam('2', adminId) : param('2', null),
        param('3', operation),
        uuidParam('4', resourceId),
        param('5', expiresMinutes),
      ]
    );

    if (!result) {
      throw new Error('Failed to create verification code');
    }

    return result.tmsCreateVerificationCode;
  }

  // ============================================================================
  // AUDIT LOG
  // ============================================================================

  private async auditLog(
    tenantId: string | null,
    userId: string | null | undefined,
    adminId: string | null | undefined,
    action: string,
    resourceType: string,
    resourceId: string,
    oldValue: Record<string, unknown> | null,
    newValue: Record<string, unknown> | null,
    ctx: TmsContext,
    transactionId?: string
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO tms_audit_log (
        tenant_id, user_id, admin_id, action, resource_type, resource_id,
        old_value, new_value, ip_address, user_agent, trace_id
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, $4, $5, $6,
        $7::jsonb, $8::jsonb, $9::inet, $10, $11
      )`,
      [
        tenantId ? uuidParam('1', tenantId) : param('1', null),
        userId ? uuidParam('2', userId) : param('2', null),
        adminId ? uuidParam('3', adminId) : param('3', null),
        param('4', action),
        param('5', resourceType),
        param('6', resourceId),
        oldValue ? jsonParam('7', oldValue) : param('7', null),
        newValue ? jsonParam('8', newValue) : param('8', null),
        ctx.ipAddress ? param('9', ctx.ipAddress) : param('9', null),
        param('10', ctx.userAgent || null),
        param('11', ctx.traceId || null),
      ],
      transactionId
    );
  }

  async getAuditLogs(
    tenantId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<TenantAuditLog[]> {
    return executeStatement<TenantAuditLog>(
      `SELECT * FROM tms_audit_log 
       WHERE tenant_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [uuidParam('1', tenantId), param('2', limit), param('3', offset)]
    );
  }
}

export const tenantService = new TenantService();
