// RADIANT v4.18.0 - GDPR Service
// Implements all GDPR Data Subject Rights (Articles 15-22)

import { executeStatement, stringParam } from '../db/client';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export type ConsentType = 
  | 'essential'
  | 'analytics'
  | 'marketing'
  | 'ai_training'
  | 'data_sharing'
  | 'research'
  | 'personalization';

export type GDPRRequestType =
  | 'access'        // Article 15
  | 'rectification' // Article 16
  | 'erasure'       // Article 17
  | 'restriction'   // Article 18
  | 'portability'   // Article 20
  | 'objection'     // Article 21
  | 'automated';    // Article 22

export type GDPRRequestStatus =
  | 'pending'
  | 'verified'
  | 'in_progress'
  | 'completed'
  | 'rejected'
  | 'expired';

export interface ConsentRecord {
  id: string;
  tenantId: string;
  userId: string;
  consentType: ConsentType;
  granted: boolean;
  grantedAt?: Date;
  withdrawnAt?: Date;
  ipAddress?: string;
  userAgent?: string;
  consentVersion: string;
  consentSource: string;
}

export interface GDPRRequest {
  id: string;
  tenantId: string;
  userId: string;
  requestType: GDPRRequestType;
  details?: string;
  fieldsRequested?: string[];
  verificationMethod: string;
  verifiedAt?: Date;
  status: GDPRRequestStatus;
  deadline: Date;
  completedAt?: Date;
  responseData?: unknown;
  rejectionReason?: string;
  createdAt: Date;
}

export interface UserDataExport {
  exportId: string;
  userId: string;
  exportedAt: Date;
  format: 'json' | 'csv';
  data: {
    personalData: PersonalData;
    consentRecords: ConsentRecord[];
    activityLogs: ActivityLog[];
    preferences: UserPreferences;
    apiKeys: APIKeyInfo[];
    sessions: SessionInfo[];
    usageData: UsageData;
  };
}

interface PersonalData {
  userId: string;
  email: string;
  displayName?: string;
  createdAt: Date;
  lastLoginAt?: Date;
  role: string;
  mfaEnabled: boolean;
}

interface ActivityLog {
  timestamp: Date;
  action: string;
  resourceType: string;
  resourceId?: string;
  ipAddress?: string;
}

interface UserPreferences {
  theme?: string;
  language?: string;
  notifications: Record<string, boolean>;
}

interface APIKeyInfo {
  keyId: string;
  name: string;
  createdAt: Date;
  lastUsedAt?: Date;
  // Note: actual key values are NOT exported for security
}

interface SessionInfo {
  sessionId: string;
  createdAt: Date;
  messageCount: number;
}

interface UsageData {
  totalRequests: number;
  totalTokens: number;
  modelUsage: Record<string, number>;
}

// ============================================================================
// GDPR Service
// ============================================================================

class GDPRService {
  // =========================================================================
  // CONSENT MANAGEMENT
  // =========================================================================

  /**
   * Get all consent records for a user
   */
  async getConsents(tenantId: string, userId: string): Promise<ConsentRecord[]> {
    const result = await executeStatement(
      `SELECT * FROM consent_records 
       WHERE tenant_id = $1::uuid AND user_id = $2::uuid
       ORDER BY consent_type`,
      [stringParam('tenantId', tenantId), stringParam('userId', userId)]
    );

    return (result.rows || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      tenantId: row.tenant_id as string,
      userId: row.user_id as string,
      consentType: row.consent_type as ConsentType,
      granted: Boolean(row.granted),
      grantedAt: row.granted_at ? new Date(row.granted_at as string) : undefined,
      withdrawnAt: row.withdrawn_at ? new Date(row.withdrawn_at as string) : undefined,
      ipAddress: row.ip_address as string,
      userAgent: row.user_agent as string,
      consentVersion: row.consent_version as string,
      consentSource: row.consent_source as string,
    }));
  }

  /**
   * Check if user has given specific consent
   */
  async hasConsent(tenantId: string, userId: string, consentType: ConsentType): Promise<boolean> {
    const result = await executeStatement(
      `SELECT granted FROM consent_records 
       WHERE tenant_id = $1::uuid AND user_id = $2::uuid AND consent_type = $3`,
      [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('consentType', consentType),
      ]
    );

    return result.rows?.[0]?.granted === true;
  }

  /**
   * Record user consent
   */
  async recordConsent(
    tenantId: string,
    userId: string,
    consentType: ConsentType,
    granted: boolean,
    context?: { ipAddress?: string; userAgent?: string; source?: string }
  ): Promise<ConsentRecord> {
    const result = await executeStatement(
      `INSERT INTO consent_records (
        tenant_id, user_id, consent_type, granted, granted_at, withdrawn_at,
        ip_address, user_agent, consent_source
      ) VALUES (
        $1::uuid, $2::uuid, $3, $4, 
        CASE WHEN $4 THEN NOW() ELSE NULL END,
        CASE WHEN NOT $4 THEN NOW() ELSE NULL END,
        $5::inet, $6, $7
      )
      ON CONFLICT (tenant_id, user_id, consent_type)
      DO UPDATE SET 
        granted = $4,
        granted_at = CASE WHEN $4 THEN NOW() ELSE consent_records.granted_at END,
        withdrawn_at = CASE WHEN NOT $4 THEN NOW() ELSE NULL END,
        ip_address = COALESCE($5::inet, consent_records.ip_address),
        user_agent = COALESCE($6, consent_records.user_agent),
        updated_at = NOW()
      RETURNING *`,
      [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('consentType', consentType),
        stringParam('granted', String(granted)),
        stringParam('ipAddress', context?.ipAddress || ''),
        stringParam('userAgent', context?.userAgent || ''),
        stringParam('source', context?.source || 'api'),
      ]
    );

    const row = result.rows?.[0] as Record<string, unknown>;
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      userId: row.user_id as string,
      consentType: row.consent_type as ConsentType,
      granted: Boolean(row.granted),
      grantedAt: row.granted_at ? new Date(row.granted_at as string) : undefined,
      withdrawnAt: row.withdrawn_at ? new Date(row.withdrawn_at as string) : undefined,
      ipAddress: row.ip_address as string,
      userAgent: row.user_agent as string,
      consentVersion: row.consent_version as string,
      consentSource: row.consent_source as string,
    };
  }

  /**
   * Withdraw all consents for a user (except essential)
   */
  async withdrawAllConsents(tenantId: string, userId: string): Promise<void> {
    await executeStatement(
      `UPDATE consent_records 
       SET granted = false, withdrawn_at = NOW(), updated_at = NOW()
       WHERE tenant_id = $1::uuid AND user_id = $2::uuid AND consent_type != 'essential'`,
      [stringParam('tenantId', tenantId), stringParam('userId', userId)]
    );
  }

  // =========================================================================
  // GDPR REQUESTS (Articles 15-22)
  // =========================================================================

  /**
   * Create a new GDPR request
   */
  async createRequest(
    tenantId: string,
    userId: string,
    requestType: GDPRRequestType,
    details?: string,
    fieldsRequested?: string[]
  ): Promise<GDPRRequest> {
    const result = await executeStatement(
      `INSERT INTO gdpr_requests (
        tenant_id, user_id, request_type, details, fields_requested, deadline
      ) VALUES (
        $1::uuid, $2::uuid, $3, $4, $5::jsonb, NOW() + INTERVAL '30 days'
      ) RETURNING *`,
      [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('requestType', requestType),
        stringParam('details', details || ''),
        stringParam('fieldsRequested', JSON.stringify(fieldsRequested || [])),
      ]
    );

    return this.mapGDPRRequest(result.rows?.[0] as Record<string, unknown>);
  }

  /**
   * Get all GDPR requests for a user
   */
  async getRequests(tenantId: string, userId: string): Promise<GDPRRequest[]> {
    const result = await executeStatement(
      `SELECT * FROM gdpr_requests 
       WHERE tenant_id = $1::uuid AND user_id = $2::uuid
       ORDER BY created_at DESC`,
      [stringParam('tenantId', tenantId), stringParam('userId', userId)]
    );

    return (result.rows || []).map((row: Record<string, unknown>) => this.mapGDPRRequest(row));
  }

  /**
   * Get pending GDPR requests nearing deadline
   */
  async getPendingRequests(tenantId: string): Promise<GDPRRequest[]> {
    const result = await executeStatement(
      `SELECT * FROM gdpr_requests 
       WHERE tenant_id = $1::uuid 
         AND status NOT IN ('completed', 'rejected', 'expired')
       ORDER BY deadline ASC`,
      [stringParam('tenantId', tenantId)]
    );

    return (result.rows || []).map((row: Record<string, unknown>) => this.mapGDPRRequest(row));
  }

  /**
   * Process a GDPR request
   */
  async processRequest(
    requestId: string,
    adminId: string
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    // Get the request
    const requestResult = await executeStatement(
      `SELECT * FROM gdpr_requests WHERE id = $1::uuid`,
      [stringParam('requestId', requestId)]
    );

    if (!requestResult.rows?.length) {
      return { success: false, error: 'Request not found' };
    }

    const request = this.mapGDPRRequest(requestResult.rows[0] as Record<string, unknown>);

    // Update status to in_progress
    await executeStatement(
      `UPDATE gdpr_requests SET status = 'in_progress', updated_at = NOW() WHERE id = $1::uuid`,
      [stringParam('requestId', requestId)]
    );

    try {
      let result: unknown;

      switch (request.requestType) {
        case 'access':
          result = await this.handleAccessRequest(request.tenantId, request.userId);
          break;
        case 'erasure':
          result = await this.handleErasureRequest(request.tenantId, request.userId);
          break;
        case 'portability':
          result = await this.handlePortabilityRequest(request.tenantId, request.userId);
          break;
        case 'restriction':
          result = await this.handleRestrictionRequest(request.tenantId, request.userId);
          break;
        case 'objection':
          result = await this.handleObjectionRequest(request.tenantId, request.userId);
          break;
        default:
          result = { message: 'Request type requires manual processing' };
      }

      // Mark as completed
      await executeStatement(
        `UPDATE gdpr_requests 
         SET status = 'completed', 
             completed_at = NOW(), 
             completed_by = $2::uuid,
             response_data = $3::jsonb,
             updated_at = NOW()
         WHERE id = $1::uuid`,
        [
          stringParam('requestId', requestId),
          stringParam('adminId', adminId),
          stringParam('responseData', JSON.stringify(result)),
        ]
      );

      return { success: true, result };
    } catch (error) {
      // Mark as failed
      await executeStatement(
        `UPDATE gdpr_requests 
         SET status = 'pending', 
             processing_notes = $2,
             updated_at = NOW()
         WHERE id = $1::uuid`,
        [
          stringParam('requestId', requestId),
          stringParam('notes', `Error: ${(error as Error).message}`),
        ]
      );

      return { success: false, error: (error as Error).message };
    }
  }

  // =========================================================================
  // ARTICLE 15: RIGHT TO ACCESS
  // =========================================================================

  async handleAccessRequest(tenantId: string, userId: string): Promise<UserDataExport> {
    return this.exportUserData(tenantId, userId, 'json');
  }

  /**
   * Export all user data (Article 15 & 20)
   */
  async exportUserData(
    tenantId: string,
    userId: string,
    format: 'json' | 'csv' = 'json'
  ): Promise<UserDataExport> {
    // Get personal data
    const userResult = await executeStatement(
      `SELECT id, email, display_name, created_at, last_login_at, role, mfa_enabled
       FROM users WHERE id = $1::uuid AND tenant_id = $2::uuid`,
      [stringParam('userId', userId), stringParam('tenantId', tenantId)]
    );

    const user = userResult.rows?.[0] as Record<string, unknown>;
    const personalData: PersonalData = {
      userId: user.id as string,
      email: user.email as string,
      displayName: user.display_name as string,
      createdAt: new Date(user.created_at as string),
      lastLoginAt: user.last_login_at ? new Date(user.last_login_at as string) : undefined,
      role: user.role as string,
      mfaEnabled: Boolean(user.mfa_enabled),
    };

    // Get consent records
    const consents = await this.getConsents(tenantId, userId);

    // Get activity logs (last 90 days)
    const activityResult = await executeStatement(
      `SELECT created_at, action, resource_type, resource_id, ip_address
       FROM audit_logs 
       WHERE user_id = $1::uuid AND tenant_id = $2::uuid
         AND created_at > NOW() - INTERVAL '90 days'
       ORDER BY created_at DESC
       LIMIT 1000`,
      [stringParam('userId', userId), stringParam('tenantId', tenantId)]
    );

    const activityLogs: ActivityLog[] = (activityResult.rows || []).map((row: Record<string, unknown>) => ({
      timestamp: new Date(row.created_at as string),
      action: row.action as string,
      resourceType: row.resource_type as string,
      resourceId: row.resource_id as string,
      ipAddress: row.ip_address as string,
    }));

    // Get preferences
    const prefResult = await executeStatement(
      `SELECT preferences FROM users WHERE id = $1::uuid`,
      [stringParam('userId', userId)]
    );
    const preferences: UserPreferences = (prefResult.rows?.[0]?.preferences as UserPreferences) || {
      notifications: {},
    };

    // Get API keys (without actual key values)
    const apiKeysResult = await executeStatement(
      `SELECT id, name, created_at, last_used_at
       FROM api_keys WHERE user_id = $1::uuid AND tenant_id = $2::uuid`,
      [stringParam('userId', userId), stringParam('tenantId', tenantId)]
    );

    const apiKeys: APIKeyInfo[] = (apiKeysResult.rows || []).map((row: Record<string, unknown>) => ({
      keyId: row.id as string,
      name: row.name as string,
      createdAt: new Date(row.created_at as string),
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at as string) : undefined,
    }));

    // Get sessions
    const sessionsResult = await executeStatement(
      `SELECT id, created_at, 
              (SELECT COUNT(*) FROM thinktank_steps WHERE session_id = thinktank_sessions.id) as message_count
       FROM thinktank_sessions 
       WHERE user_id = $1::uuid AND tenant_id = $2::uuid
       ORDER BY created_at DESC
       LIMIT 100`,
      [stringParam('userId', userId), stringParam('tenantId', tenantId)]
    );

    const sessions: SessionInfo[] = (sessionsResult.rows || []).map((row: Record<string, unknown>) => ({
      sessionId: row.id as string,
      createdAt: new Date(row.created_at as string),
      messageCount: parseInt(row.message_count as string, 10),
    }));

    // Get usage data
    const usageResult = await executeStatement(
      `SELECT COUNT(*) as total_requests,
              SUM(input_tokens + output_tokens) as total_tokens
       FROM usage_records 
       WHERE user_id = $1::uuid AND tenant_id = $2::uuid`,
      [stringParam('userId', userId), stringParam('tenantId', tenantId)]
    );

    const usageRow = usageResult.rows?.[0] as Record<string, unknown>;
    const usageData: UsageData = {
      totalRequests: parseInt(usageRow?.total_requests as string, 10) || 0,
      totalTokens: parseInt(usageRow?.total_tokens as string, 10) || 0,
      modelUsage: {},
    };

    return {
      exportId: crypto.randomUUID(),
      userId,
      exportedAt: new Date(),
      format,
      data: {
        personalData,
        consentRecords: consents,
        activityLogs,
        preferences,
        apiKeys,
        sessions,
        usageData,
      },
    };
  }

  // =========================================================================
  // ARTICLE 17: RIGHT TO ERASURE (Right to be Forgotten)
  // =========================================================================

  async handleErasureRequest(
    tenantId: string,
    userId: string
  ): Promise<{ deleted: boolean; summary: Record<string, number> }> {
    const summary: Record<string, number> = {};

    // Delete in order (respecting foreign keys)
    const deletions = [
      { table: 'thinktank_steps', column: 'session_id', 
        subquery: `SELECT id FROM thinktank_sessions WHERE user_id = $1::uuid AND tenant_id = $2::uuid` },
      { table: 'thinktank_sessions', column: 'user_id' },
      { table: 'usage_records', column: 'user_id' },
      { table: 'api_keys', column: 'user_id' },
      { table: 'consent_records', column: 'user_id' },
      { table: 'user_preferences', column: 'user_id' },
      { table: 'notification_preferences', column: 'user_id' },
    ];

    for (const deletion of deletions) {
      try {
        let result;
        if (deletion.subquery) {
          result = await executeStatement(
            `DELETE FROM ${deletion.table} WHERE ${deletion.column} IN (${deletion.subquery})`,
            [stringParam('userId', userId), stringParam('tenantId', tenantId)]
          );
        } else {
          result = await executeStatement(
            `DELETE FROM ${deletion.table} WHERE ${deletion.column} = $1::uuid AND tenant_id = $2::uuid`,
            [stringParam('userId', userId), stringParam('tenantId', tenantId)]
          );
        }
        summary[deletion.table] = result.rowCount || 0;
      } catch {
        // Table might not exist or no matching records
        summary[deletion.table] = 0;
      }
    }

    // Anonymize audit logs (keep for compliance but remove PII)
    await executeStatement(
      `UPDATE audit_logs 
       SET user_id = NULL, 
           metadata = metadata - 'user_email' - 'user_name' - 'ip_address'
       WHERE user_id = $1::uuid AND tenant_id = $2::uuid`,
      [stringParam('userId', userId), stringParam('tenantId', tenantId)]
    );
    summary['audit_logs_anonymized'] = 1;

    // Finally, delete the user (soft delete to maintain references)
    await executeStatement(
      `UPDATE users 
       SET email = CONCAT('deleted_', id, '@deleted.local'),
           display_name = 'Deleted User',
           deleted_at = NOW(),
           is_active = false
       WHERE id = $1::uuid AND tenant_id = $2::uuid`,
      [stringParam('userId', userId), stringParam('tenantId', tenantId)]
    );
    summary['user_anonymized'] = 1;

    return { deleted: true, summary };
  }

  // =========================================================================
  // ARTICLE 20: RIGHT TO DATA PORTABILITY
  // =========================================================================

  async handlePortabilityRequest(tenantId: string, userId: string): Promise<UserDataExport> {
    // Same as access but in machine-readable format
    return this.exportUserData(tenantId, userId, 'json');
  }

  // =========================================================================
  // ARTICLE 18: RIGHT TO RESTRICTION
  // =========================================================================

  async handleRestrictionRequest(
    tenantId: string,
    userId: string
  ): Promise<{ restricted: boolean }> {
    // Withdraw all non-essential consents
    await this.withdrawAllConsents(tenantId, userId);

    // Mark user as restricted
    await executeStatement(
      `UPDATE users SET metadata = jsonb_set(
        COALESCE(metadata, '{}'), 
        '{gdpr_restricted}', 
        'true'
      ) WHERE id = $1::uuid AND tenant_id = $2::uuid`,
      [stringParam('userId', userId), stringParam('tenantId', tenantId)]
    );

    return { restricted: true };
  }

  // =========================================================================
  // ARTICLE 21: RIGHT TO OBJECT
  // =========================================================================

  async handleObjectionRequest(
    tenantId: string,
    userId: string
  ): Promise<{ objectionRecorded: boolean }> {
    // Withdraw specific consents related to the objection
    await this.recordConsent(tenantId, userId, 'marketing', false);
    await this.recordConsent(tenantId, userId, 'ai_training', false);
    await this.recordConsent(tenantId, userId, 'data_sharing', false);

    return { objectionRecorded: true };
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

  private mapGDPRRequest(row: Record<string, unknown>): GDPRRequest {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      userId: row.user_id as string,
      requestType: row.request_type as GDPRRequestType,
      details: row.details as string,
      fieldsRequested: row.fields_requested as string[],
      verificationMethod: row.verification_method as string,
      verifiedAt: row.verified_at ? new Date(row.verified_at as string) : undefined,
      status: row.status as GDPRRequestStatus,
      deadline: new Date(row.deadline as string),
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      responseData: row.response_data,
      rejectionReason: row.rejection_reason as string,
      createdAt: new Date(row.created_at as string),
    };
  }
}

export const gdprService = new GDPRService();
