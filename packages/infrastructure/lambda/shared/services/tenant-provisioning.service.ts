/**
 * RADIANT v7.35.0 — Tenant Provisioning Service
 *
 * Handles the full lifecycle of tenant sign-up from marketing/sales websites:
 *   1. Sign-up request (email + phone + org details)
 *   2. Email verification (6-digit code via SES)
 *   3. Phone verification (6-digit code via SNS)
 *   4. Tenant provisioning (create tenant + first user as tenant_admin)
 *   5. Invitation sent to first user
 *   6. First user accepts invitation → tenant active
 *
 * The first user is ALWAYS assigned tenant_admin role.
 * v7.52.0: Only super_admin exists in Pool B with full RADIANT app access.
 */

import { Pool, PoolClient } from 'pg';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import type {
  TenantSignUpRequest,
  TenantProvisioningRecord,
  TenantProvisioningResult,
  TenantProvisioningStatus,
} from '@radiant/shared/types/user-profile.types';
import {
  TENANT_PROVISIONING_DEFAULTS,
} from '@radiant/shared/types/user-profile.types';

// =============================================================================
// SERVICE
// =============================================================================

export class TenantProvisioningService {
  private pool: Pool;
  private snsClient: SNSClient;
  private sesClient: SESClient;
  private senderEmail: string;
  private dashboardUrl: string;

  constructor(pool: Pool) {
    this.pool = pool;
    this.snsClient = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.sesClient = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.senderEmail = process.env.SES_SENDER_EMAIL || 'noreply@radiant.app';
    this.dashboardUrl = process.env.ADMIN_DASHBOARD_URL || 'https://admin.radiant.app';
  }

  // ===========================================================================
  // STEP 1: Initiate Sign-Up
  // ===========================================================================

  async initiateSignUp(
    req: TenantSignUpRequest,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TenantProvisioningResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Validate E.164 phone
      if (!/^\+[1-9]\d{1,14}$/.test(req.phone)) {
        return { success: false, provisioningId: '', status: 'failed', error: 'INVALID_PHONE_FORMAT' };
      }

      // Validate email
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(req.email)) {
        return { success: false, provisioningId: '', status: 'failed', error: 'INVALID_EMAIL_FORMAT' };
      }

      // Check for existing pending sign-up
      const existing = await client.query(
        `SELECT id, status FROM tenant_provisioning
         WHERE email = $1 AND status IN ('pending', 'email_verified', 'phone_verified', 'provisioning')`,
        [req.email],
      );
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          provisioningId: existing.rows[0].id,
          status: existing.rows[0].status,
          error: 'SIGNUP_ALREADY_IN_PROGRESS',
        };
      }

      // Check if email already exists as an active tenant user
      const existingUser = await client.query(
        `SELECT id FROM users WHERE email = $1 AND status = 'active' LIMIT 1`,
        [req.email],
      );
      if (existingUser.rows.length > 0) {
        await client.query('ROLLBACK');
        return { success: false, provisioningId: '', status: 'failed', error: 'EMAIL_ALREADY_REGISTERED' };
      }

      // Generate slug
      const slug = req.organizationSlug || this.generateSlug(req.organizationName);

      // Check slug uniqueness
      const slugCheck = await client.query(
        `SELECT id FROM tenants WHERE slug = $1
         UNION
         SELECT id FROM tenant_provisioning WHERE organization_slug = $1 AND status NOT IN ('failed', 'expired')`,
        [slug],
      );
      if (slugCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return { success: false, provisioningId: '', status: 'failed', error: 'ORGANIZATION_SLUG_TAKEN' };
      }

      // Create provisioning record
      const expiresAt = new Date(Date.now() + TENANT_PROVISIONING_DEFAULTS.signUpExpiryHours * 60 * 60 * 1000);

      const result = await client.query(
        `INSERT INTO tenant_provisioning
         (email, phone, phone_country_code, first_name, last_name, display_name,
          organization_name, organization_slug, tier, referral_source,
          marketing_consent, ip_address, user_agent, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING id, status`,
        [
          req.email, req.phone, req.phoneCountryCode,
          req.firstName, req.lastName,
          req.displayName || `${req.firstName} ${req.lastName}`,
          req.organizationName, slug, req.tier || 'FREE',
          req.referralSource || null, req.marketingConsent || false,
          ipAddress || null, userAgent || null, expiresAt.toISOString(),
        ],
      );

      const provisioningId = result.rows[0].id;

      // Log event
      await this.logEvent(client, provisioningId, 'signup_initiated', null, 'pending', {
        email: req.email,
        organization: req.organizationName,
        tier: req.tier,
      }, ipAddress);

      // Send email verification code
      await this.sendEmailVerification(client, provisioningId, req.email);

      await client.query('COMMIT');

      return {
        success: true,
        provisioningId,
        status: 'pending',
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[TenantProvisioning] Sign-up error:', error);
      return {
        success: false,
        provisioningId: '',
        status: 'failed',
        error: (error as Error).message,
      };
    } finally {
      client.release();
    }
  }

  // ===========================================================================
  // STEP 2: Verify Email
  // ===========================================================================

  async verifyEmail(
    provisioningId: string,
    code: string,
    ipAddress?: string,
  ): Promise<TenantProvisioningResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const row = await this.getProvisioningRow(client, provisioningId);
      if (!row) {
        await client.query('ROLLBACK');
        return { success: false, provisioningId, status: 'failed', error: 'NOT_FOUND' };
      }

      if (row.status !== 'pending') {
        await client.query('ROLLBACK');
        return { success: false, provisioningId, status: row.status, error: 'INVALID_STATUS' };
      }

      if (row.expires_at < new Date()) {
        await client.query(`UPDATE tenant_provisioning SET status = 'expired' WHERE id = $1`, [provisioningId]);
        await client.query('COMMIT');
        return { success: false, provisioningId, status: 'expired', error: 'SIGNUP_EXPIRED' };
      }

      if (row.email_verification_attempts >= 5) {
        await client.query('ROLLBACK');
        return { success: false, provisioningId, status: 'pending', error: 'MAX_ATTEMPTS_EXCEEDED' };
      }

      // Increment attempts
      await client.query(
        `UPDATE tenant_provisioning SET email_verification_attempts = email_verification_attempts + 1 WHERE id = $1`,
        [provisioningId],
      );

      // Check code
      const codeMatch = await bcrypt.compare(code, row.email_verification_code_hash || '');
      if (!codeMatch) {
        await this.logEvent(client, provisioningId, 'email_verify_failed', 'pending', 'pending', {
          attempts: row.email_verification_attempts + 1,
        }, ipAddress);
        await client.query('COMMIT');
        return {
          success: false,
          provisioningId,
          status: 'pending',
          error: 'INVALID_CODE',
        };
      }

      // Mark email verified
      await client.query(
        `UPDATE tenant_provisioning
         SET email_verified = true, email_verified_at = NOW(), status = 'email_verified'
         WHERE id = $1`,
        [provisioningId],
      );

      await this.logEvent(client, provisioningId, 'email_verified', 'pending', 'email_verified', null, ipAddress);

      // Send phone verification code
      await this.sendPhoneVerification(client, provisioningId, row.phone);

      await client.query('COMMIT');

      return { success: true, provisioningId, status: 'email_verified' };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[TenantProvisioning] Email verify error:', error);
      return { success: false, provisioningId, status: 'failed', error: (error as Error).message };
    } finally {
      client.release();
    }
  }

  // ===========================================================================
  // STEP 3: Verify Phone
  // ===========================================================================

  async verifyPhone(
    provisioningId: string,
    code: string,
    ipAddress?: string,
  ): Promise<TenantProvisioningResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const row = await this.getProvisioningRow(client, provisioningId);
      if (!row) {
        await client.query('ROLLBACK');
        return { success: false, provisioningId, status: 'failed', error: 'NOT_FOUND' };
      }

      if (row.status !== 'email_verified') {
        await client.query('ROLLBACK');
        return { success: false, provisioningId, status: row.status, error: 'INVALID_STATUS' };
      }

      if (row.expires_at < new Date()) {
        await client.query(`UPDATE tenant_provisioning SET status = 'expired' WHERE id = $1`, [provisioningId]);
        await client.query('COMMIT');
        return { success: false, provisioningId, status: 'expired', error: 'SIGNUP_EXPIRED' };
      }

      if (row.phone_verification_attempts >= 5) {
        await client.query('ROLLBACK');
        return { success: false, provisioningId, status: 'email_verified', error: 'MAX_ATTEMPTS_EXCEEDED' };
      }

      await client.query(
        `UPDATE tenant_provisioning SET phone_verification_attempts = phone_verification_attempts + 1 WHERE id = $1`,
        [provisioningId],
      );

      const codeMatch = await bcrypt.compare(code, row.phone_verification_code_hash || '');
      if (!codeMatch) {
        await this.logEvent(client, provisioningId, 'phone_verify_failed', 'email_verified', 'email_verified', {
          attempts: row.phone_verification_attempts + 1,
        }, ipAddress);
        await client.query('COMMIT');
        return { success: false, provisioningId, status: 'email_verified', error: 'INVALID_CODE' };
      }

      await client.query(
        `UPDATE tenant_provisioning
         SET phone_verified = true, phone_verified_at = NOW(), status = 'phone_verified'
         WHERE id = $1`,
        [provisioningId],
      );

      await this.logEvent(client, provisioningId, 'phone_verified', 'email_verified', 'phone_verified', null, ipAddress);

      await client.query('COMMIT');

      // Auto-provision now that both are verified
      return this.provisionTenant(provisioningId, ipAddress);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[TenantProvisioning] Phone verify error:', error);
      return { success: false, provisioningId, status: 'failed', error: (error as Error).message };
    } finally {
      client.release();
    }
  }

  // ===========================================================================
  // STEP 4: Provision Tenant + First User
  // ===========================================================================

  async provisionTenant(
    provisioningId: string,
    ipAddress?: string,
  ): Promise<TenantProvisioningResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const row = await this.getProvisioningRow(client, provisioningId);
      if (!row) {
        await client.query('ROLLBACK');
        return { success: false, provisioningId, status: 'failed', error: 'NOT_FOUND' };
      }

      if (row.status !== 'phone_verified') {
        await client.query('ROLLBACK');
        return { success: false, provisioningId, status: row.status, error: 'INVALID_STATUS' };
      }

      // Mark as provisioning
      await client.query(
        `UPDATE tenant_provisioning SET status = 'provisioning' WHERE id = $1`,
        [provisioningId],
      );

      await this.logEvent(client, provisioningId, 'provisioning_started', 'phone_verified', 'provisioning', null, ipAddress);

      // Create tenant
      const tenantResult = await client.query(
        `INSERT INTO tenants (name, slug, tier, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'active', NOW(), NOW())
         RETURNING id`,
        [row.organization_name, row.organization_slug, row.tier],
      );
      const tenantId = tenantResult.rows[0].id;

      // Generate invitation token
      const invitationToken = randomBytes(32).toString('hex');
      const invitationExpiresAt = new Date(
        Date.now() + TENANT_PROVISIONING_DEFAULTS.invitationExpiryHours * 60 * 60 * 1000,
      );

      // Create first user as tenant_admin
      const apps = TENANT_PROVISIONING_DEFAULTS.firstUserApps;
      const userResult = await client.query(
        `INSERT INTO users
         (tenant_id, email, display_name, first_name, last_name,
          role, tenant_role, status,
          email_verified,
          has_access_think_tank, has_access_curator, has_access_dojo,
          has_access_cato_trainer, has_access_omega_lab, has_access_tenant_admin,
          invitation_token, invitation_expires_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5,
          'user', $6, 'invited',
          true,
          $7, $8, $9, $10, $11, $12,
          $13, $14, NOW(), NOW())
         RETURNING id`,
        [
          tenantId, row.email,
          row.display_name || `${row.first_name} ${row.last_name}`,
          row.first_name, row.last_name,
          TENANT_PROVISIONING_DEFAULTS.firstUserRole,
          apps.hasAccessThinkTank, apps.hasAccessCurator, apps.hasAccessDojo,
          apps.hasAccessCatoTrainer, apps.hasAccessOmegaLab, apps.hasAccessTenantAdmin,
          invitationToken, invitationExpiresAt.toISOString(),
        ],
      );
      const userId = userResult.rows[0].id;

      // Add verified email contact
      await client.query(
        `SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId],
      );
      await client.query(
        `INSERT INTO user_contacts
         (user_id, user_type, tenant_id, contact_type, label, value,
          is_primary, is_login_contact, verification_status, verified_at)
         VALUES ($1, 'end_user', $2, 'email', 'work', $3,
          true, true, 'verified', NOW())`,
        [userId, tenantId, row.email],
      );

      // Add verified phone contact
      await client.query(
        `INSERT INTO user_contacts
         (user_id, user_type, tenant_id, contact_type, label, value,
          country_code, is_primary, verification_status, verified_at)
         VALUES ($1, 'end_user', $2, 'phone', 'work', $3,
          $4, true, 'verified', NOW())`,
        [userId, tenantId, row.phone, row.phone_country_code],
      );

      // Create user profile
      await client.query(
        `INSERT INTO user_profiles
         (user_id, user_type, tenant_id, phone_verified, email_verified, profile_complete)
         VALUES ($1, 'end_user', $2, true, true, true)`,
        [userId, tenantId],
      );

      // Update provisioning record
      await client.query(
        `UPDATE tenant_provisioning
         SET status = 'provisioned', tenant_id = $2, user_id = $3,
             invitation_token = $4, invitation_sent_at = NOW(),
             invitation_expires_at = $5
         WHERE id = $1`,
        [provisioningId, tenantId, userId, invitationToken, invitationExpiresAt.toISOString()],
      );

      await this.logEvent(client, provisioningId, 'tenant_provisioned', 'provisioning', 'provisioned', {
        tenantId, userId, slug: row.organization_slug,
      }, ipAddress);

      await client.query('COMMIT');

      // Send invitation email (outside transaction)
      await this.sendInvitationEmail(row.email, row.first_name, row.organization_name, invitationToken);

      // Update status to invitation_sent
      await this.pool.query(
        `UPDATE tenant_provisioning SET status = 'invitation_sent' WHERE id = $1`,
        [provisioningId],
      );

      return {
        success: true,
        provisioningId,
        status: 'invitation_sent',
        tenantId,
        userId,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[TenantProvisioning] Provision error:', error);

      // Mark as failed
      try {
        await this.pool.query(
          `UPDATE tenant_provisioning SET status = 'failed', failure_reason = $2 WHERE id = $1`,
          [provisioningId, (error as Error).message],
        );
      } catch (logErr) {
        console.error('[TenantProvisioning] Failed to log failure:', logErr);
      }

      return {
        success: false,
        provisioningId,
        status: 'failed',
        error: (error as Error).message,
      };
    } finally {
      client.release();
    }
  }

  // ===========================================================================
  // STEP 5: Accept Invitation
  // ===========================================================================

  async acceptInvitation(
    invitationToken: string,
    ipAddress?: string,
  ): Promise<TenantProvisioningResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const row = await client.query(
        `SELECT * FROM tenant_provisioning
         WHERE invitation_token = $1 AND status = 'invitation_sent'`,
        [invitationToken],
      );

      if (row.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, provisioningId: '', status: 'failed', error: 'INVALID_INVITATION' };
      }

      const prov = row.rows[0];

      if (prov.invitation_expires_at < new Date()) {
        await client.query('ROLLBACK');
        return { success: false, provisioningId: prov.id, status: 'expired', error: 'INVITATION_EXPIRED' };
      }

      // Activate the user
      await client.query(
        `UPDATE users SET status = 'active', invitation_token = NULL, updated_at = NOW()
         WHERE id = $1`,
        [prov.user_id],
      );

      // Activate the tenant (if not already)
      await client.query(
        `UPDATE tenants SET status = 'active', updated_at = NOW()
         WHERE id = $1 AND status != 'active'`,
        [prov.tenant_id],
      );

      // Update provisioning record
      await client.query(
        `UPDATE tenant_provisioning
         SET status = 'active', invitation_accepted_at = NOW()
         WHERE id = $1`,
        [prov.id],
      );

      await this.logEvent(client, prov.id, 'invitation_accepted', 'invitation_sent', 'active', {
        tenantId: prov.tenant_id,
        userId: prov.user_id,
      }, ipAddress);

      await client.query('COMMIT');

      return {
        success: true,
        provisioningId: prov.id,
        status: 'active',
        tenantId: prov.tenant_id,
        userId: prov.user_id,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[TenantProvisioning] Accept invitation error:', error);
      return { success: false, provisioningId: '', status: 'failed', error: (error as Error).message };
    } finally {
      client.release();
    }
  }

  // ===========================================================================
  // QUERY: Get provisioning status
  // ===========================================================================

  async getProvisioningStatus(provisioningId: string): Promise<TenantProvisioningRecord | null> {
    const result = await this.pool.query(
      `SELECT * FROM tenant_provisioning WHERE id = $1`,
      [provisioningId],
    );
    if (result.rows.length === 0) return null;
    return this.mapRecord(result.rows[0]);
  }

  // ===========================================================================
  // RESEND: Verification codes
  // ===========================================================================

  async resendEmailCode(provisioningId: string): Promise<{ success: boolean; error?: string }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const row = await this.getProvisioningRow(client, provisioningId);
      if (!row || row.status !== 'pending') {
        await client.query('ROLLBACK');
        return { success: false, error: 'INVALID_STATUS' };
      }
      await this.sendEmailVerification(client, provisioningId, row.email);
      await client.query('COMMIT');
      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      return { success: false, error: (error as Error).message };
    } finally {
      client.release();
    }
  }

  async resendPhoneCode(provisioningId: string): Promise<{ success: boolean; error?: string }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const row = await this.getProvisioningRow(client, provisioningId);
      if (!row || row.status !== 'email_verified') {
        await client.query('ROLLBACK');
        return { success: false, error: 'INVALID_STATUS' };
      }
      await this.sendPhoneVerification(client, provisioningId, row.phone);
      await client.query('COMMIT');
      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      return { success: false, error: (error as Error).message };
    } finally {
      client.release();
    }
  }

  // ===========================================================================
  // INTERNAL: Verification code senders
  // ===========================================================================

  private async sendEmailVerification(client: PoolClient, provisioningId: string, email: string): Promise<void> {
    const code = this.generateCode();
    const hash = await bcrypt.hash(code, 10);

    await client.query(
      `UPDATE tenant_provisioning
       SET email_verification_code_hash = $2, email_verification_sent_at = NOW(),
           email_verification_attempts = 0
       WHERE id = $1`,
      [provisioningId, hash],
    );

    await this.sesClient.send(new SendEmailCommand({
      Source: this.senderEmail,
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: { Data: `Your RADIANT verification code: ${code}`, Charset: 'UTF-8' },
        Body: {
          Html: {
            Data: `
              <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
                <h2 style="color: #0f172a; margin-bottom: 8px;">Verify your email</h2>
                <p style="color: #475569;">Enter this code to continue your RADIANT sign-up:</p>
                <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                  <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1e293b;">${code}</span>
                </div>
                <p style="color: #94a3b8; font-size: 13px;">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
              </div>
            `,
            Charset: 'UTF-8',
          },
          Text: { Data: `Your RADIANT verification code is: ${code}\n\nThis code expires in 10 minutes.`, Charset: 'UTF-8' },
        },
      },
    }));

    console.log(`[TenantProvisioning] Email verification sent to ${email.split('@')[0][0]}***@${email.split('@')[1]}`);
  }

  private async sendPhoneVerification(client: PoolClient, provisioningId: string, phone: string): Promise<void> {
    const code = this.generateCode();
    const hash = await bcrypt.hash(code, 10);

    await client.query(
      `UPDATE tenant_provisioning
       SET phone_verification_code_hash = $2, phone_verification_sent_at = NOW(),
           phone_verification_attempts = 0
       WHERE id = $1`,
      [provisioningId, hash],
    );

    await this.snsClient.send(new PublishCommand({
      PhoneNumber: phone,
      Message: `Your RADIANT verification code is: ${code}`,
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
        'AWS.SNS.SMS.SenderID': { DataType: 'String', StringValue: 'RADIANT' },
      },
    }));

    console.log(`[TenantProvisioning] Phone verification sent to ***${phone.slice(-4)}`);
  }

  private async sendInvitationEmail(email: string, firstName: string, orgName: string, token: string): Promise<void> {
    const acceptUrl = `${this.dashboardUrl}/accept-invitation?token=${token}`;

    await this.sesClient.send(new SendEmailCommand({
      Source: this.senderEmail,
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: { Data: `Welcome to RADIANT — ${orgName} is ready`, Charset: 'UTF-8' },
        Body: {
          Html: {
            Data: `
              <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
                <h2 style="color: #0f172a;">Welcome, ${firstName}!</h2>
                <p style="color: #475569;">Your organization <strong>${orgName}</strong> has been provisioned on RADIANT.</p>
                <p style="color: #475569;">As the first user, you've been assigned the <strong>Tenant Admin</strong> role with full control of your organization.</p>
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${acceptUrl}" style="display: inline-block; padding: 14px 32px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Accept Invitation & Get Started</a>
                </div>
                <p style="color: #94a3b8; font-size: 13px;">This invitation expires in ${TENANT_PROVISIONING_DEFAULTS.invitationExpiryHours} hours.</p>
              </div>
            `,
            Charset: 'UTF-8',
          },
          Text: {
            Data: `Welcome ${firstName}! Your organization ${orgName} is ready on RADIANT.\n\nAccept your invitation: ${acceptUrl}\n\nYou've been assigned Tenant Admin role. This invitation expires in ${TENANT_PROVISIONING_DEFAULTS.invitationExpiryHours} hours.`,
            Charset: 'UTF-8',
          },
        },
      },
    }));

    console.log(`[TenantProvisioning] Invitation sent to ${email.split('@')[0][0]}***@${email.split('@')[1]} for org "${orgName}"`);
  }

  // ===========================================================================
  // INTERNAL: Helpers
  // ===========================================================================

  private async getProvisioningRow(client: PoolClient, id: string): Promise<any> {
    const result = await client.query(
      `SELECT * FROM tenant_provisioning WHERE id = $1 FOR UPDATE`,
      [id],
    );
    return result.rows[0] || null;
  }

  private async logEvent(
    client: PoolClient,
    provisioningId: string,
    event: string,
    oldStatus: TenantProvisioningStatus | null,
    newStatus: TenantProvisioningStatus,
    details: Record<string, any> | null,
    ipAddress?: string,
  ): Promise<void> {
    await client.query(
      `INSERT INTO tenant_provisioning_log
       (provisioning_id, event, old_status, new_status, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [provisioningId, event, oldStatus, newStatus, details ? JSON.stringify(details) : null, ipAddress || null],
    );
  }

  private generateCode(): string {
    const digits = '0123456789';
    const bytes = randomBytes(6);
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += digits[bytes[i] % 10];
    }
    return code;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100)
      || `org-${randomBytes(4).toString('hex')}`;
  }

  private mapRecord(row: any): TenantProvisioningRecord {
    return {
      id: row.id,
      email: row.email,
      phone: row.phone,
      phoneCountryCode: row.phone_country_code,
      firstName: row.first_name,
      lastName: row.last_name,
      displayName: row.display_name,
      organizationName: row.organization_name,
      organizationSlug: row.organization_slug,
      tier: row.tier,
      status: row.status,
      emailVerified: row.email_verified,
      phoneVerified: row.phone_verified,
      emailVerificationSentAt: row.email_verification_sent_at?.toISOString(),
      phoneVerificationSentAt: row.phone_verification_sent_at?.toISOString(),
      emailVerifiedAt: row.email_verified_at?.toISOString(),
      phoneVerifiedAt: row.phone_verified_at?.toISOString(),
      tenantId: row.tenant_id,
      userId: row.user_id,
      invitationToken: undefined, // Never expose token
      invitationSentAt: row.invitation_sent_at?.toISOString(),
      invitationExpiresAt: row.invitation_expires_at?.toISOString(),
      invitationAcceptedAt: row.invitation_accepted_at?.toISOString(),
      failureReason: row.failure_reason,
      referralSource: row.referral_source,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
    };
  }
}
