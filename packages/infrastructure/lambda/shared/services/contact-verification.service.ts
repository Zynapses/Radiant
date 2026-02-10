/**
 * RADIANT v7.34.0 — Contact Verification Service
 *
 * Handles sending and verifying 6-digit codes for both email and phone contacts.
 * - Phone: Amazon SNS (Transactional SMS)
 * - Email: Amazon SES
 * - Rate limiting: 3 attempts per 10 min, then cooldown
 * - Codes expire after 10 minutes
 * - bcrypt-hashed codes stored in DB
 */

import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';
import type {
  ContactType,
  UserContact,
  SendVerificationResponse,
  VerifyCodeResponse,
  VerificationError,
  VerificationLog,
} from '@radiant/shared/types/user-profile.types';

const VERIFICATION_CODE_LENGTH = 6;
const VERIFICATION_CODE_EXPIRY_MINUTES = 10;
const VERIFICATION_MAX_ATTEMPTS = 3;
const VERIFICATION_COOLDOWN_MINUTES = 10;
const BCRYPT_ROUNDS = 10;

export class ContactVerificationService {
  private snsClient: SNSClient;
  private sesClient: SESClient;
  private pool: Pool;
  private senderEmail: string;

  constructor(pool: Pool) {
    this.pool = pool;
    this.snsClient = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.sesClient = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.senderEmail = process.env.SES_SENDER_EMAIL || 'noreply@radiant.app';
  }

  // ===========================================================================
  // SEND VERIFICATION CODE
  // ===========================================================================

  async sendVerificationCode(
    contactId: string,
    userId: string,
    tenantId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<SendVerificationResponse> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);

      // Fetch contact
      const contactResult = await client.query(
        `SELECT * FROM user_contacts WHERE id = $1 AND user_id = $2 AND tenant_id = $3`,
        [contactId, userId, tenantId],
      );

      if (contactResult.rows.length === 0) {
        return {
          success: false,
          contactId,
          contactType: 'email',
          maskedValue: '',
          expiresAt: '',
          attemptsRemaining: 0,
          error: 'CONTACT_NOT_FOUND',
        };
      }

      const contact = contactResult.rows[0];

      // Already verified?
      if (contact.verification_status === 'verified') {
        return {
          success: false,
          contactId,
          contactType: contact.contact_type,
          maskedValue: this.maskValue(contact.value, contact.contact_type),
          expiresAt: '',
          attemptsRemaining: 0,
          error: 'ALREADY_VERIFIED',
        };
      }

      // Cooldown check — if max attempts exceeded recently
      if (contact.verification_attempts >= VERIFICATION_MAX_ATTEMPTS) {
        const cooldownEnd = contact.last_verification_sent_at
          ? new Date(contact.last_verification_sent_at).getTime() + VERIFICATION_COOLDOWN_MINUTES * 60 * 1000
          : 0;

        if (Date.now() < cooldownEnd) {
          return {
            success: false,
            contactId,
            contactType: contact.contact_type,
            maskedValue: this.maskValue(contact.value, contact.contact_type),
            expiresAt: '',
            attemptsRemaining: 0,
            error: 'COOLDOWN_ACTIVE',
          };
        }

        // Reset attempts after cooldown
        await client.query(
          `UPDATE user_contacts SET verification_attempts = 0, updated_at = NOW() WHERE id = $1`,
          [contactId],
        );
      }

      // Generate 6-digit code
      const code = this.generateCode();
      const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
      const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000);

      // Store hashed code
      await client.query(
        `UPDATE user_contacts
         SET verification_code_hash = $1,
             verification_expires_at = $2,
             verification_status = 'pending',
             last_verification_sent_at = NOW(),
             updated_at = NOW()
         WHERE id = $3`,
        [codeHash, expiresAt.toISOString(), contactId],
      );

      // Send the code
      try {
        if (contact.contact_type === 'phone') {
          await this.sendSmsCode(contact.value, code);
        } else {
          await this.sendEmailCode(contact.value, code);
        }
      } catch (deliveryError) {
        console.error('[ContactVerification] Delivery failed:', deliveryError);
        await this.logVerification(client, contactId, userId, tenantId, contact.contact_type, 'code_sent', contact.value, ipAddress, userAgent);
        await client.query('COMMIT');
        return {
          success: false,
          contactId,
          contactType: contact.contact_type,
          maskedValue: this.maskValue(contact.value, contact.contact_type),
          expiresAt: '',
          attemptsRemaining: VERIFICATION_MAX_ATTEMPTS - contact.verification_attempts,
          error: 'DELIVERY_FAILED',
        };
      }

      // Log successful send
      await this.logVerification(client, contactId, userId, tenantId, contact.contact_type, 'code_sent', contact.value, ipAddress, userAgent);

      await client.query('COMMIT');

      return {
        success: true,
        contactId,
        contactType: contact.contact_type,
        maskedValue: this.maskValue(contact.value, contact.contact_type),
        expiresAt: expiresAt.toISOString(),
        attemptsRemaining: VERIFICATION_MAX_ATTEMPTS - contact.verification_attempts,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[ContactVerification] sendVerificationCode error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // ===========================================================================
  // VERIFY CODE
  // ===========================================================================

  async verifyCode(
    contactId: string,
    code: string,
    userId: string,
    tenantId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<VerifyCodeResponse> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);

      // Fetch contact
      const contactResult = await client.query(
        `SELECT * FROM user_contacts WHERE id = $1 AND user_id = $2 AND tenant_id = $3`,
        [contactId, userId, tenantId],
      );

      if (contactResult.rows.length === 0) {
        return { success: false, contactId, verified: false, attemptsRemaining: 0, error: 'CONTACT_NOT_FOUND' };
      }

      const contact = contactResult.rows[0];

      // Already verified?
      if (contact.verification_status === 'verified') {
        return { success: true, contactId, verified: true, attemptsRemaining: 0 };
      }

      // No pending verification?
      if (!contact.verification_code_hash || !contact.verification_expires_at) {
        return { success: false, contactId, verified: false, attemptsRemaining: 0, error: 'INVALID_CODE' };
      }

      // Expired?
      if (new Date(contact.verification_expires_at) < new Date()) {
        await this.logVerification(client, contactId, userId, tenantId, contact.contact_type, 'code_expired', contact.value, ipAddress, userAgent);
        await client.query(
          `UPDATE user_contacts SET verification_status = 'expired', updated_at = NOW() WHERE id = $1`,
          [contactId],
        );
        await client.query('COMMIT');
        return { success: false, contactId, verified: false, attemptsRemaining: 0, error: 'CODE_EXPIRED' };
      }

      // Max attempts?
      if (contact.verification_attempts >= VERIFICATION_MAX_ATTEMPTS) {
        await this.logVerification(client, contactId, userId, tenantId, contact.contact_type, 'max_attempts', contact.value, ipAddress, userAgent);
        await client.query('COMMIT');
        return { success: false, contactId, verified: false, attemptsRemaining: 0, error: 'MAX_ATTEMPTS_EXCEEDED' };
      }

      // Increment attempts
      await client.query(
        `UPDATE user_contacts SET verification_attempts = verification_attempts + 1, updated_at = NOW() WHERE id = $1`,
        [contactId],
      );

      // Verify code
      const isValid = await bcrypt.compare(code, contact.verification_code_hash);

      if (!isValid) {
        const remaining = VERIFICATION_MAX_ATTEMPTS - (contact.verification_attempts + 1);
        await this.logVerification(client, contactId, userId, tenantId, contact.contact_type, 'code_failed', contact.value, ipAddress, userAgent);
        await client.query('COMMIT');
        return { success: false, contactId, verified: false, attemptsRemaining: Math.max(0, remaining), error: 'INVALID_CODE' };
      }

      // Mark verified
      await client.query(
        `UPDATE user_contacts
         SET verification_status = 'verified',
             verified_at = NOW(),
             verification_code_hash = NULL,
             verification_expires_at = NULL,
             verification_attempts = 0,
             updated_at = NOW()
         WHERE id = $1`,
        [contactId],
      );

      // Update profile completion status
      await this.updateProfileCompletionStatus(client, userId, contact.user_type, tenantId);

      await this.logVerification(client, contactId, userId, tenantId, contact.contact_type, 'code_verified', contact.value, ipAddress, userAgent);

      await client.query('COMMIT');

      return { success: true, contactId, verified: true, attemptsRemaining: VERIFICATION_MAX_ATTEMPTS };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[ContactVerification] verifyCode error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // ===========================================================================
  // SMS DELIVERY (Amazon SNS)
  // ===========================================================================

  private async sendSmsCode(phoneNumber: string, code: string): Promise<void> {
    const message = `Your RADIANT verification code is: ${code}. This code expires in ${VERIFICATION_CODE_EXPIRY_MINUTES} minutes. Do not share this code.`;

    await this.snsClient.send(new PublishCommand({
      PhoneNumber: phoneNumber,
      Message: message,
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional',
        },
        'AWS.SNS.SMS.SenderID': {
          DataType: 'String',
          StringValue: 'RADIANT',
        },
      },
    }));

    console.log(`[ContactVerification] SMS sent to ${this.maskValue(phoneNumber, 'phone')}`);
  }

  // ===========================================================================
  // EMAIL DELIVERY (Amazon SES)
  // ===========================================================================

  private async sendEmailCode(email: string, code: string): Promise<void> {
    await this.sesClient.send(new SendEmailCommand({
      Source: this.senderEmail,
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: {
          Data: `RADIANT — Your verification code is ${code}`,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
                <h2 style="color: #1e293b; margin-bottom: 8px;">Verify your email address</h2>
                <p style="color: #64748b; font-size: 14px;">Enter this code in RADIANT to verify <strong>${email}</strong>:</p>
                <div style="background: #f1f5f9; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
                  <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0f172a;">${code}</span>
                </div>
                <p style="color: #94a3b8; font-size: 12px;">This code expires in ${VERIFICATION_CODE_EXPIRY_MINUTES} minutes. If you didn't request this, ignore this email.</p>
              </div>
            `,
            Charset: 'UTF-8',
          },
          Text: {
            Data: `Your RADIANT verification code is: ${code}. This code expires in ${VERIFICATION_CODE_EXPIRY_MINUTES} minutes.`,
            Charset: 'UTF-8',
          },
        },
      },
    }));

    console.log(`[ContactVerification] Email sent to ${this.maskValue(email, 'email')}`);
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private generateCode(): string {
    const digits = '0123456789';
    let code = '';
    const randomBytes = new Uint8Array(VERIFICATION_CODE_LENGTH);
    crypto.getRandomValues(randomBytes);
    for (let i = 0; i < VERIFICATION_CODE_LENGTH; i++) {
      code += digits[randomBytes[i] % 10];
    }
    return code;
  }

  maskValue(value: string, contactType: ContactType): string {
    if (contactType === 'phone') {
      // +15551234567 → +1***4567
      if (value.length > 4) {
        return value.slice(0, 2) + '***' + value.slice(-4);
      }
      return '***';
    }
    // alice@company.com → a***@company.com
    const [local, domain] = value.split('@');
    if (local && domain) {
      return local[0] + '***@' + domain;
    }
    return '***';
  }

  private async logVerification(
    client: any,
    contactId: string,
    userId: string,
    tenantId: string,
    contactType: string,
    action: string,
    value: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await client.query(
      `INSERT INTO contact_verification_log
       (contact_id, user_id, tenant_id, contact_type, action, masked_value, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [contactId, userId, tenantId, contactType, action, this.maskValue(value, contactType as ContactType), ipAddress || null, userAgent || null],
    );
  }

  private async updateProfileCompletionStatus(
    client: any,
    userId: string,
    userType: string,
    tenantId: string,
  ): Promise<void> {
    // Check if user has at least one verified phone and verified email
    const phoneResult = await client.query(
      `SELECT COUNT(*) as cnt FROM user_contacts
       WHERE user_id = $1 AND user_type = $2 AND tenant_id = $3
         AND contact_type = 'phone' AND verification_status = 'verified'`,
      [userId, userType, tenantId],
    );

    const emailResult = await client.query(
      `SELECT COUNT(*) as cnt FROM user_contacts
       WHERE user_id = $1 AND user_type = $2 AND tenant_id = $3
         AND contact_type = 'email' AND verification_status = 'verified'`,
      [userId, userType, tenantId],
    );

    const phoneVerified = parseInt(phoneResult.rows[0]?.cnt || '0') > 0;
    const emailVerified = parseInt(emailResult.rows[0]?.cnt || '0') > 0;
    const profileComplete = phoneVerified && emailVerified;

    await client.query(
      `INSERT INTO user_profiles (user_id, user_type, tenant_id, phone_verified, email_verified, profile_complete, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id, user_type)
       DO UPDATE SET phone_verified = $4, email_verified = $5, profile_complete = $6, updated_at = NOW()`,
      [userId, userType, tenantId, phoneVerified, emailVerified, profileComplete],
    );
  }

  // ===========================================================================
  // CONTACT CRUD
  // ===========================================================================

  async addContact(
    userId: string,
    userType: string,
    tenantId: string,
    contactType: ContactType,
    value: string,
    label: string,
    customLabel?: string,
    countryCode?: string,
    isPrimary?: boolean,
  ): Promise<{ success: boolean; contact?: UserContact; error?: string }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);

      // Check duplicate (within same tenant)
      const dupCheck = await client.query(
        `SELECT id FROM user_contacts
         WHERE user_id = $1 AND user_type = $2 AND contact_type = $3 AND value = $4 AND tenant_id = $5`,
        [userId, userType, contactType, value, tenantId],
      );
      if (dupCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'DUPLICATE_CONTACT' };
      }

      // Validate format
      if (contactType === 'phone') {
        if (!/^\+[1-9]\d{1,14}$/.test(value)) {
          await client.query('ROLLBACK');
          return { success: false, error: 'INVALID_FORMAT' };
        }
        if (!countryCode || !/^[A-Z]{2}$/.test(countryCode)) {
          await client.query('ROLLBACK');
          return { success: false, error: 'INVALID_COUNTRY_CODE' };
        }
      } else {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
          await client.query('ROLLBACK');
          return { success: false, error: 'INVALID_FORMAT' };
        }
      }

      // Insert (trigger enforces max 3 per type)
      try {
        const result = await client.query(
          `INSERT INTO user_contacts
           (user_id, user_type, tenant_id, contact_type, label, custom_label, value, country_code, is_primary)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [userId, userType, tenantId, contactType, label, customLabel || null, value, countryCode || null, isPrimary || false],
        );
        await client.query('COMMIT');
        return { success: true, contact: this.mapContact(result.rows[0]) };
      } catch (err: any) {
        await client.query('ROLLBACK');
        if (err.message?.includes('Maximum')) {
          return { success: false, error: 'MAX_CONTACTS_REACHED' };
        }
        throw err;
      }
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async removeContact(
    contactId: string,
    userId: string,
    tenantId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);

      const contact = await client.query(
        `SELECT * FROM user_contacts WHERE id = $1 AND user_id = $2 AND tenant_id = $3`,
        [contactId, userId, tenantId],
      );

      if (contact.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'CONTACT_NOT_FOUND' };
      }

      const row = contact.rows[0];

      // Cannot remove login email
      if (row.is_login_contact) {
        await client.query('ROLLBACK');
        return { success: false, error: 'CANNOT_REMOVE_LOGIN_EMAIL' };
      }

      // Cannot remove last verified phone
      if (row.contact_type === 'phone' && row.verification_status === 'verified') {
        const phoneCount = await client.query(
          `SELECT COUNT(*) as cnt FROM user_contacts
           WHERE user_id = $1 AND user_type = $2 AND tenant_id = $3
             AND contact_type = 'phone' AND verification_status = 'verified' AND id != $4`,
          [userId, row.user_type, tenantId, contactId],
        );
        if (parseInt(phoneCount.rows[0].cnt) === 0) {
          await client.query('ROLLBACK');
          return { success: false, error: 'CANNOT_REMOVE_LAST_VERIFIED_PHONE' };
        }
      }

      // Also clean up any SENTINEL routing referencing this contact
      await client.query(`DELETE FROM sentinel_contact_routing WHERE contact_id = $1`, [contactId]);

      await client.query(`DELETE FROM user_contacts WHERE id = $1`, [contactId]);

      // Update profile completion
      await this.updateProfileCompletionStatus(client, userId, row.user_type, tenantId);

      await client.query('COMMIT');
      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listContacts(
    userId: string,
    userType: string,
    tenantId: string,
  ): Promise<UserContact[]> {
    const result = await this.pool.query(
      `SELECT * FROM user_contacts
       WHERE user_id = $1 AND user_type = $2 AND tenant_id = $3
       ORDER BY contact_type, is_primary DESC, created_at`,
      [userId, userType, tenantId],
    );
    return result.rows.map(this.mapContact);
  }

  async updateContact(
    contactId: string,
    userId: string,
    tenantId: string,
    updates: { label?: string; customLabel?: string; isPrimary?: boolean },
  ): Promise<{ success: boolean; contact?: UserContact }> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let paramIdx = 1;

    if (updates.label !== undefined) {
      setClauses.push(`label = $${paramIdx++}`);
      values.push(updates.label);
    }
    if (updates.customLabel !== undefined) {
      setClauses.push(`custom_label = $${paramIdx++}`);
      values.push(updates.customLabel);
    }
    if (updates.isPrimary !== undefined) {
      setClauses.push(`is_primary = $${paramIdx++}`);
      values.push(updates.isPrimary);
    }

    values.push(contactId, userId, tenantId);

    const result = await this.pool.query(
      `UPDATE user_contacts SET ${setClauses.join(', ')}
       WHERE id = $${paramIdx++} AND user_id = $${paramIdx++} AND tenant_id = $${paramIdx}
       RETURNING *`,
      values,
    );

    if (result.rows.length === 0) {
      return { success: false };
    }

    return { success: true, contact: this.mapContact(result.rows[0]) };
  }

  // ===========================================================================
  // PROFILE CRUD
  // ===========================================================================

  async getProfile(userId: string, userType: string, tenantId: string): Promise<any> {
    const [profileResult, contactsResult] = await Promise.all([
      this.pool.query(
        `SELECT * FROM user_profiles WHERE user_id = $1 AND user_type = $2 AND tenant_id = $3`,
        [userId, userType, tenantId],
      ),
      this.listContacts(userId, userType, tenantId),
    ]);

    const profile = profileResult.rows[0] || null;

    return {
      userId,
      userType,
      tenantId,
      bio: profile?.bio || null,
      timezone: profile?.timezone || 'UTC',
      locale: profile?.locale || 'en-US',
      dateFormat: profile?.date_format || 'MM/DD/YYYY',
      timeFormat: profile?.time_format || '12h',
      phoneVerified: profile?.phone_verified || false,
      emailVerified: profile?.email_verified || false,
      profileComplete: profile?.profile_complete || false,
      contacts: contactsResult,
      lastProfileUpdateAt: profile?.last_profile_update_at,
      createdAt: profile?.created_at,
      updatedAt: profile?.updated_at,
    };
  }

  async updateProfile(
    userId: string,
    userType: string,
    tenantId: string,
    updates: {
      bio?: string;
      timezone?: string;
      locale?: string;
      dateFormat?: string;
      timeFormat?: string;
    },
  ): Promise<any> {
    // Build a clean upsert: pass NULL for fields not in the update so COALESCE preserves existing values
    // For INSERT (new profile), DB column defaults handle missing values
    const bio = updates.bio !== undefined ? updates.bio : null;
    const timezone = updates.timezone !== undefined ? updates.timezone : null;
    const locale = updates.locale !== undefined ? updates.locale : null;
    const dateFormat = updates.dateFormat !== undefined ? updates.dateFormat : null;
    const timeFormat = updates.timeFormat !== undefined ? updates.timeFormat : null;

    await this.pool.query(
      `INSERT INTO user_profiles
       (user_id, user_type, tenant_id, bio, timezone, locale, date_format, time_format, updated_at, last_profile_update_at)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'UTC'), COALESCE($6, 'en-US'), COALESCE($7, 'MM/DD/YYYY'), COALESCE($8, '12h'), NOW(), NOW())
       ON CONFLICT (user_id, user_type)
       DO UPDATE SET
         bio = COALESCE($4, user_profiles.bio),
         timezone = COALESCE($5, user_profiles.timezone),
         locale = COALESCE($6, user_profiles.locale),
         date_format = COALESCE($7, user_profiles.date_format),
         time_format = COALESCE($8, user_profiles.time_format),
         updated_at = NOW(),
         last_profile_update_at = NOW()`,
      [userId, userType, tenantId, bio, timezone, locale, dateFormat, timeFormat],
    );

    return this.getProfile(userId, userType, tenantId);
  }

  // ===========================================================================
  // SENTINEL CONTACT ROUTING
  // ===========================================================================

  async getContactRoutes(adminId: string, tenantId: string): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT * FROM sentinel_contact_routing
       WHERE admin_id = $1 AND tenant_id = $2
       ORDER BY alert_category, min_severity`,
      [adminId, tenantId],
    );
    return result.rows.map(r => ({
      id: r.id,
      adminId: r.admin_id,
      tenantId: r.tenant_id,
      alertCategory: r.alert_category,
      minSeverity: r.min_severity,
      contactId: r.contact_id,
      contactSnapshot: {
        contactType: r.contact_type,
        value: r.contact_value,
        label: r.contact_label,
      },
      enabled: r.enabled,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async createContactRoute(
    adminId: string,
    tenantId: string,
    alertCategory: string,
    minSeverity: number,
    contactId: string,
  ): Promise<{ success: boolean; route?: any; error?: string }> {
    // Verify contact exists and is verified
    const contactResult = await this.pool.query(
      `SELECT * FROM user_contacts WHERE id = $1 AND user_id = $2 AND tenant_id = $3`,
      [contactId, adminId, tenantId],
    );

    if (contactResult.rows.length === 0) {
      return { success: false, error: 'CONTACT_NOT_FOUND' };
    }

    const contact = contactResult.rows[0];
    if (contact.verification_status !== 'verified') {
      return { success: false, error: 'CONTACT_NOT_VERIFIED' };
    }

    try {
      const result = await this.pool.query(
        `INSERT INTO sentinel_contact_routing
         (admin_id, tenant_id, alert_category, min_severity, contact_id, contact_type, contact_value, contact_label)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [adminId, tenantId, alertCategory, minSeverity, contactId, contact.contact_type, contact.value, contact.label],
      );

      return {
        success: true,
        route: {
          id: result.rows[0].id,
          adminId,
          tenantId,
          alertCategory,
          minSeverity,
          contactId,
          contactSnapshot: {
            contactType: contact.contact_type,
            value: contact.value,
            label: contact.label,
          },
          enabled: true,
          createdAt: result.rows[0].created_at,
          updatedAt: result.rows[0].updated_at,
        },
      };
    } catch (err: any) {
      if (err.code === '23505') { // unique violation
        return { success: false, error: 'DUPLICATE_ROUTE' };
      }
      throw err;
    }
  }

  async deleteContactRoute(routeId: string, adminId: string, tenantId: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM sentinel_contact_routing WHERE id = $1 AND admin_id = $2 AND tenant_id = $3`,
      [routeId, adminId, tenantId],
    );
    return (result.rowCount || 0) > 0;
  }

  async updateContactRoute(
    routeId: string,
    adminId: string,
    tenantId: string,
    updates: { minSeverity?: number; enabled?: boolean },
  ): Promise<boolean> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let paramIdx = 1;

    if (updates.minSeverity !== undefined) { setClauses.push(`min_severity = $${paramIdx++}`); values.push(updates.minSeverity); }
    if (updates.enabled !== undefined) { setClauses.push(`enabled = $${paramIdx++}`); values.push(updates.enabled); }

    values.push(routeId, adminId, tenantId);

    const result = await this.pool.query(
      `UPDATE sentinel_contact_routing SET ${setClauses.join(', ')}
       WHERE id = $${paramIdx++} AND admin_id = $${paramIdx++} AND tenant_id = $${paramIdx}`,
      values,
    );
    return (result.rowCount || 0) > 0;
  }

  // ===========================================================================
  // RESOLVE CONTACTS FOR SENTINEL ALERT
  // Called by SentinelNotifierService when dispatching alerts
  // ===========================================================================

  async resolveContactsForAlert(
    tenantId: string,
    alertCategory: string,
    severity: number,
  ): Promise<Array<{ adminId: string; contactType: ContactType; value: string; label: string }>> {
    const result = await this.pool.query(
      `SELECT * FROM resolve_sentinel_contacts($1, $2, $3)`,
      [tenantId, alertCategory, severity],
    );
    return result.rows.map(r => ({
      adminId: r.admin_id,
      contactType: r.contact_type as ContactType,
      value: r.contact_value,
      label: r.contact_label,
    }));
  }

  // ===========================================================================
  // RESOLVE SYSTEM ADMIN CONTACTS FOR SENTINEL ALERT
  // v7.38.0: System admins are global — no tenant scope
  // Called by SentinelNotifierService for ALL alerts (not just tenant-scoped)
  // ===========================================================================

  async resolveSystemAdminContacts(
    alertCategory: string,
    severity: number,
  ): Promise<Array<{ adminId: string; contactType: ContactType; value: string; label: string }>> {
    const result = await this.pool.query(
      `SELECT * FROM resolve_system_admin_contacts($1, $2)`,
      [alertCategory, severity],
    );
    return result.rows.map(r => ({
      adminId: r.admin_id,
      contactType: r.contact_type as ContactType,
      value: r.contact_value,
      label: r.contact_label,
    }));
  }

  // ===========================================================================
  // SYSTEM ADMIN CONTACT MANAGEMENT
  // v7.38.0: CRUD for system admin contacts (uses system_admin_contacts table)
  // ===========================================================================

  async getSystemAdminContacts(
    adminId: string,
  ): Promise<UserContact[]> {
    const result = await this.pool.query(
      `SELECT * FROM system_admin_contacts
       WHERE admin_id = $1
       ORDER BY contact_type, is_primary DESC, created_at`,
      [adminId],
    );
    return result.rows.map(r => this.mapSystemAdminContact(r));
  }

  async addSystemAdminContact(
    adminId: string,
    contactType: ContactType,
    value: string,
    label: string = 'work',
    customLabel?: string,
    countryCode?: string,
    isPrimary: boolean = false,
  ): Promise<{ success: boolean; contact?: UserContact; error?: string }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Check duplicate
      const dupCheck = await client.query(
        `SELECT id FROM system_admin_contacts
         WHERE admin_id = $1 AND contact_type = $2 AND value = $3`,
        [adminId, contactType, value],
      );
      if (dupCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'DUPLICATE_CONTACT' };
      }

      // Insert (trigger enforces max 3 per type)
      const result = await client.query(
        `INSERT INTO system_admin_contacts
         (admin_id, contact_type, label, custom_label, value, country_code, is_primary)
         VALUES ($1, $2, $3::contact_label, $4, $5, $6, $7)
         RETURNING *`,
        [adminId, contactType, label, customLabel || null, value, countryCode || null, isPrimary],
      );

      await client.query('COMMIT');
      return { success: true, contact: this.mapSystemAdminContact(result.rows[0]) };
    } catch (err: any) {
      await client.query('ROLLBACK');
      if (err.message?.includes('Maximum')) {
        return { success: false, error: 'MAX_CONTACTS_REACHED' };
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async removeSystemAdminContact(contactId: string, adminId: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const contact = await client.query(
        `SELECT * FROM system_admin_contacts WHERE id = $1 AND admin_id = $2`,
        [contactId, adminId],
      );
      if (contact.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      // Clean up SENTINEL routing referencing this contact
      await client.query(`DELETE FROM system_admin_alert_routing WHERE contact_id = $1`, [contactId]);
      await client.query(`DELETE FROM system_admin_contacts WHERE id = $1`, [contactId]);

      // Update system_admins phone/email verified flags
      await this.updateSystemAdminVerificationStatus(client, adminId);

      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async sendSystemAdminVerificationCode(
    contactId: string,
    adminId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<SendVerificationResponse> {
    // Reuse the same verification flow but query system_admin_contacts
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const contactResult = await client.query(
        `SELECT * FROM system_admin_contacts WHERE id = $1 AND admin_id = $2`,
        [contactId, adminId],
      );

      if (contactResult.rows.length === 0) {
        return {
          success: false, contactId, contactType: 'email',
          maskedValue: '', expiresAt: '', attemptsRemaining: 0,
          error: 'CONTACT_NOT_FOUND',
        };
      }

      const contact = contactResult.rows[0];

      if (contact.verification_status === 'verified') {
        return {
          success: false, contactId, contactType: contact.contact_type,
          maskedValue: this.maskValue(contact.value, contact.contact_type),
          expiresAt: '', attemptsRemaining: 0, error: 'ALREADY_VERIFIED',
        };
      }

      // Cooldown check
      if (contact.verification_attempts >= VERIFICATION_MAX_ATTEMPTS) {
        const cooldownEnd = contact.last_verification_sent_at
          ? new Date(contact.last_verification_sent_at).getTime() + VERIFICATION_COOLDOWN_MINUTES * 60 * 1000
          : 0;
        if (Date.now() < cooldownEnd) {
          return {
            success: false, contactId, contactType: contact.contact_type,
            maskedValue: this.maskValue(contact.value, contact.contact_type),
            expiresAt: '', attemptsRemaining: 0, error: 'COOLDOWN_ACTIVE',
          };
        }
        await client.query(
          `UPDATE system_admin_contacts SET verification_attempts = 0, updated_at = NOW() WHERE id = $1`,
          [contactId],
        );
      }

      // Generate and store code
      const code = this.generateCode();
      const bcrypt = await import('bcryptjs');
      const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
      const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000);

      await client.query(
        `UPDATE system_admin_contacts
         SET verification_code_hash = $1, verification_expires_at = $2,
             verification_status = 'pending', verification_attempts = verification_attempts + 1,
             last_verification_sent_at = NOW(), updated_at = NOW()
         WHERE id = $3`,
        [codeHash, expiresAt.toISOString(), contactId],
      );

      // Log
      await client.query(
        `INSERT INTO system_admin_contact_verification_log
         (contact_id, admin_id, contact_type, action, masked_value, ip_address, user_agent)
         VALUES ($1, $2, $3, 'code_sent', $4, $5::inet, $6)`,
        [contactId, adminId, contact.contact_type,
         this.maskValue(contact.value, contact.contact_type),
         ipAddress || null, userAgent || null],
      );

      // Send the code
      if (contact.contact_type === 'phone') {
        await this.sendSmsCode(contact.value, code);
      } else {
        await this.sendEmailCode(contact.value, code);
      }

      await client.query('COMMIT');

      return {
        success: true, contactId, contactType: contact.contact_type,
        maskedValue: this.maskValue(contact.value, contact.contact_type),
        expiresAt: expiresAt.toISOString(),
        attemptsRemaining: VERIFICATION_MAX_ATTEMPTS - (contact.verification_attempts + 1),
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async verifySystemAdminCode(
    contactId: string,
    adminId: string,
    code: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<VerifyCodeResponse> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const contactResult = await client.query(
        `SELECT * FROM system_admin_contacts WHERE id = $1 AND admin_id = $2`,
        [contactId, adminId],
      );

      if (contactResult.rows.length === 0) {
        return { success: false, contactId, verified: false, error: 'CONTACT_NOT_FOUND' };
      }

      const contact = contactResult.rows[0];

      if (contact.verification_status === 'verified') {
        return { success: true, contactId, verified: true };
      }

      if (!contact.verification_code_hash || !contact.verification_expires_at) {
        return { success: false, contactId, verified: false, error: 'NO_PENDING_CODE' };
      }

      if (new Date(contact.verification_expires_at) < new Date()) {
        await client.query(
          `UPDATE system_admin_contacts SET verification_status = 'expired', updated_at = NOW() WHERE id = $1`,
          [contactId],
        );
        await client.query('COMMIT');
        return { success: false, contactId, verified: false, error: 'CODE_EXPIRED' };
      }

      const bcrypt = await import('bcryptjs');
      const isValid = await bcrypt.compare(code, contact.verification_code_hash);

      if (!isValid) {
        await client.query(
          `INSERT INTO system_admin_contact_verification_log
           (contact_id, admin_id, contact_type, action, masked_value, ip_address, user_agent)
           VALUES ($1, $2, $3, 'code_failed', $4, $5::inet, $6)`,
          [contactId, adminId, contact.contact_type,
           this.maskValue(contact.value, contact.contact_type),
           ipAddress || null, userAgent || null],
        );
        await client.query('COMMIT');
        return { success: false, contactId, verified: false, error: 'INVALID_CODE' };
      }

      // Mark verified
      await client.query(
        `UPDATE system_admin_contacts
         SET verification_status = 'verified', verified_at = NOW(),
             verification_code_hash = NULL, verification_expires_at = NULL,
             updated_at = NOW()
         WHERE id = $1`,
        [contactId],
      );

      await client.query(
        `INSERT INTO system_admin_contact_verification_log
         (contact_id, admin_id, contact_type, action, masked_value, ip_address, user_agent)
         VALUES ($1, $2, $3, 'code_verified', $4, $5::inet, $6)`,
        [contactId, adminId, contact.contact_type,
         this.maskValue(contact.value, contact.contact_type),
         ipAddress || null, userAgent || null],
      );

      // Update system_admins verification flags
      await this.updateSystemAdminVerificationStatus(client, adminId);

      await client.query('COMMIT');
      return { success: true, contactId, verified: true };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  private async updateSystemAdminVerificationStatus(client: any, adminId: string): Promise<void> {
    const phoneResult = await client.query(
      `SELECT COUNT(*) as cnt FROM system_admin_contacts
       WHERE admin_id = $1 AND contact_type = 'phone' AND verification_status = 'verified'`,
      [adminId],
    );
    const emailResult = await client.query(
      `SELECT COUNT(*) as cnt FROM system_admin_contacts
       WHERE admin_id = $1 AND contact_type = 'email' AND verification_status = 'verified'`,
      [adminId],
    );

    await client.query(
      `UPDATE system_admins SET
         phone_verified = $2,
         email_verified = $3,
         updated_at = NOW()
       WHERE id = $1`,
      [adminId, parseInt(phoneResult.rows[0].cnt) > 0, parseInt(emailResult.rows[0].cnt) > 0],
    );
  }

  private mapSystemAdminContact(row: any): UserContact {
    return {
      id: row.id,
      userId: row.admin_id,
      userType: 'platform_admin',
      tenantId: '00000000-0000-0000-0000-000000000000',
      contactType: row.contact_type,
      label: row.label,
      customLabel: row.custom_label,
      value: row.value,
      countryCode: row.country_code,
      isPrimary: row.is_primary,
      isLoginContact: row.is_login_contact,
      verificationStatus: row.verification_status,
      verifiedAt: row.verified_at,
      verificationAttempts: row.verification_attempts,
      verificationExpiresAt: row.verification_expires_at,
      lastVerificationSentAt: row.last_verification_sent_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ===========================================================================
  // ROW MAPPER
  // ===========================================================================

  private mapContact(row: any): UserContact {
    return {
      id: row.id,
      userId: row.user_id,
      userType: row.user_type,
      tenantId: row.tenant_id,
      contactType: row.contact_type,
      label: row.label,
      customLabel: row.custom_label,
      value: row.value,
      countryCode: row.country_code,
      isPrimary: row.is_primary,
      isLoginContact: row.is_login_contact,
      verificationStatus: row.verification_status,
      verifiedAt: row.verified_at,
      verificationAttempts: row.verification_attempts,
      verificationExpiresAt: row.verification_expires_at,
      lastVerificationSentAt: row.last_verification_sent_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
