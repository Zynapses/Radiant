/**
 * RADIANT v4.18.0 - User Registry Service
 * 
 * Core service for user-application assignments, consent management,
 * DSAR processing, break glass, and legal hold operations.
 */

import { PoolClient } from 'pg';
import {
  AuthContext,
  UserApplicationAssignment,
  AssignAppRequest,
  RevokeAppRequest,
  ConsentRecord,
  RecordConsentRequest,
  WithdrawConsentRequest,
  ConsentWithdrawalResult,
  DataRetentionObligation,
  ApplyLegalHoldRequest,
  ReleaseLegalHoldRequest,
  LegalHoldResult,
  BreakGlassAccessLog,
  InitiateBreakGlassRequest,
  EndBreakGlassRequest,
  BreakGlassResult,
  DSARRequest,
  ProcessDSARRequest,
  DSARResult,
  CrossBorderTransferCheck,
  UserRegistryDashboard,
  SecretRotationResult,
  ApplicationExtended,
} from '@radiant/shared/types/user-registry.types';
import { withSecureDBContext, isRadiantAdmin, isTenantAdmin } from './db-context.service';

// ============================================================================
// USER APPLICATION ASSIGNMENTS
// ============================================================================

export async function assignUserToApp(
  client: PoolClient,
  authContext: AuthContext,
  request: AssignAppRequest
): Promise<UserApplicationAssignment> {
  const { userId, appId, assignmentType = 'standard', appPermissions = {}, expiresAt } = request;
  
  const result = await client.query<UserApplicationAssignment>(
    `INSERT INTO user_application_assignments 
     (user_id, app_id, tenant_id, assignment_type, app_permissions, granted_by, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, app_id) DO UPDATE SET
       assignment_type = EXCLUDED.assignment_type,
       app_permissions = EXCLUDED.app_permissions,
       expires_at = EXCLUDED.expires_at,
       revoked_at = NULL,
       revoked_by = NULL,
       updated_at = NOW()
     RETURNING *`,
    [userId, appId, authContext.tenantId, assignmentType, appPermissions, authContext.userId, expiresAt]
  );
  
  return result.rows[0];
}

export async function revokeUserFromApp(
  client: PoolClient,
  authContext: AuthContext,
  request: RevokeAppRequest
): Promise<UserApplicationAssignment | null> {
  const { userId, appId } = request;
  
  const result = await client.query<UserApplicationAssignment>(
    `UPDATE user_application_assignments
     SET revoked_at = NOW(), revoked_by = $3, updated_at = NOW()
     WHERE user_id = $1 AND app_id = $2 AND tenant_id = $4 AND revoked_at IS NULL
     RETURNING *`,
    [userId, appId, authContext.userId, authContext.tenantId]
  );
  
  return result.rows[0] || null;
}

export async function getUserAssignments(
  client: PoolClient,
  userId: string
): Promise<UserApplicationAssignment[]> {
  const result = await client.query<UserApplicationAssignment>(
    `SELECT * FROM user_application_assignments
     WHERE user_id = $1 AND revoked_at IS NULL
     AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY granted_at DESC`,
    [userId]
  );
  
  return result.rows;
}

export async function getAppUsers(
  client: PoolClient,
  appId: string
): Promise<UserApplicationAssignment[]> {
  const result = await client.query<UserApplicationAssignment>(
    `SELECT uaa.*, u.email, u.display_name
     FROM user_application_assignments uaa
     JOIN users u ON u.id = uaa.user_id
     WHERE uaa.app_id = $1 AND uaa.revoked_at IS NULL
     AND (uaa.expires_at IS NULL OR uaa.expires_at > NOW())
     ORDER BY uaa.granted_at DESC`,
    [appId]
  );
  
  return result.rows;
}

// ============================================================================
// CONSENT MANAGEMENT
// ============================================================================

export async function recordConsent(
  client: PoolClient,
  authContext: AuthContext,
  request: RecordConsentRequest
): Promise<ConsentRecord> {
  const result = await client.query<ConsentRecord>(
    `INSERT INTO consent_records (
       user_id, tenant_id, jurisdiction, purpose_code, purpose_description,
       lawful_basis, consent_given, consent_timestamp, consent_version,
       consent_method, consent_language, third_party_sharing_authorized,
       authorized_third_parties, sale_of_data_authorized, parent_guardian_id,
       verification_method
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING *`,
    [
      request.userId,
      authContext.tenantId,
      request.jurisdiction,
      request.purposeCode,
      request.purposeDescription,
      request.lawfulBasis,
      request.consentGiven,
      request.consentVersion,
      request.consentMethod,
      request.consentLanguage,
      request.thirdPartySharingAuthorized || false,
      request.authorizedThirdParties ? JSON.stringify(request.authorizedThirdParties) : null,
      request.saleOfDataAuthorized || false,
      request.parentGuardianId,
      request.verificationMethod,
    ]
  );
  
  return result.rows[0];
}

export async function withdrawConsent(
  client: PoolClient,
  request: WithdrawConsentRequest
): Promise<ConsentWithdrawalResult> {
  const result = await client.query<{ success: boolean; user_id: string; purpose_code: string; withdrawn_at: Date }>(
    `SELECT * FROM withdraw_consent($1, $2, $3)`,
    [request.userId, request.purposeCode, request.reason]
  );
  
  const data = result.rows[0];
  return {
    success: data?.success ?? false,
    userId: data?.user_id,
    purposeCode: data?.purpose_code,
    withdrawnAt: data?.withdrawn_at,
    reason: !data?.success ? 'No active consent found for this purpose' : undefined,
  };
}

export async function getUserConsents(
  client: PoolClient,
  userId: string,
  activeOnly: boolean = true
): Promise<ConsentRecord[]> {
  const query = activeOnly
    ? `SELECT * FROM consent_records WHERE user_id = $1 AND withdrawal_timestamp IS NULL ORDER BY consent_timestamp DESC`
    : `SELECT * FROM consent_records WHERE user_id = $1 ORDER BY consent_timestamp DESC`;
  
  const result = await client.query<ConsentRecord>(query, [userId]);
  return result.rows;
}

export async function checkConsentStatus(
  client: PoolClient,
  userId: string,
  purposeCode: string
): Promise<{ hasConsent: boolean; consent?: ConsentRecord }> {
  const result = await client.query<ConsentRecord>(
    `SELECT * FROM consent_records
     WHERE user_id = $1 AND purpose_code = $2
     AND consent_given = true AND withdrawal_timestamp IS NULL
     ORDER BY consent_timestamp DESC LIMIT 1`,
    [userId, purposeCode]
  );
  
  return {
    hasConsent: result.rows.length > 0,
    consent: result.rows[0],
  };
}

// ============================================================================
// LEGAL HOLD
// ============================================================================

export async function applyLegalHold(
  client: PoolClient,
  authContext: AuthContext,
  request: ApplyLegalHoldRequest
): Promise<LegalHoldResult> {
  const result = await client.query<LegalHoldResult>(
    `SELECT * FROM apply_legal_hold($1, $2, $3, $4)`,
    [request.userId, request.reason, request.caseId, authContext.userId]
  );
  
  return result.rows[0];
}

export async function releaseLegalHold(
  client: PoolClient,
  authContext: AuthContext,
  request: ReleaseLegalHoldRequest
): Promise<LegalHoldResult> {
  const result = await client.query<LegalHoldResult>(
    `SELECT * FROM release_legal_hold($1, $2, $3, $4)`,
    [request.userId, request.releaseReason, request.caseId, authContext.userId]
  );
  
  return result.rows[0];
}

export async function getUserRetentionObligations(
  client: PoolClient,
  userId: string
): Promise<DataRetentionObligation[]> {
  const result = await client.query<DataRetentionObligation>(
    `SELECT * FROM data_retention_obligations
     WHERE user_id = $1
     ORDER BY legal_hold DESC, retention_expires DESC`,
    [userId]
  );
  
  return result.rows;
}

export async function getActiveLegalHolds(
  client: PoolClient,
  tenantId?: string
): Promise<DataRetentionObligation[]> {
  const query = tenantId
    ? `SELECT * FROM data_retention_obligations WHERE legal_hold = true AND tenant_id = $1 ORDER BY legal_hold_set_at DESC`
    : `SELECT * FROM data_retention_obligations WHERE legal_hold = true ORDER BY legal_hold_set_at DESC`;
  
  const result = await client.query<DataRetentionObligation>(
    query,
    tenantId ? [tenantId] : []
  );
  
  return result.rows;
}

// ============================================================================
// BREAK GLASS ACCESS
// ============================================================================

export async function initiateBreakGlass(
  client: PoolClient,
  authContext: AuthContext,
  request: InitiateBreakGlassRequest
): Promise<BreakGlassResult> {
  // Must be radiant admin
  if (!isRadiantAdmin(authContext)) {
    return {
      success: false,
      error: 'Break Glass requires Radiant Admin privileges',
    };
  }
  
  const result = await client.query<BreakGlassResult>(
    `SELECT * FROM initiate_break_glass($1, $2, $3, $4, $5)`,
    [
      authContext.userId,
      request.tenantId,
      request.accessReason,
      request.incidentTicket,
      request.approvedBy,
    ]
  );
  
  return result.rows[0];
}

export async function endBreakGlass(
  client: PoolClient,
  authContext: AuthContext,
  request: EndBreakGlassRequest
): Promise<BreakGlassResult> {
  const result = await client.query<BreakGlassResult>(
    `SELECT * FROM end_break_glass($1, $2, $3)`,
    [request.accessId, authContext.userId, JSON.stringify(request.actionsPerformed || [])]
  );
  
  return result.rows[0];
}

export async function getBreakGlassLogs(
  client: PoolClient,
  tenantId?: string,
  limit: number = 100
): Promise<BreakGlassAccessLog[]> {
  const query = tenantId
    ? `SELECT * FROM break_glass_access_log WHERE tenant_id = $1 ORDER BY access_started_at DESC LIMIT $2`
    : `SELECT * FROM break_glass_access_log ORDER BY access_started_at DESC LIMIT $1`;
  
  const result = await client.query<BreakGlassAccessLog>(
    query,
    tenantId ? [tenantId, limit] : [limit]
  );
  
  return result.rows;
}

export async function getActiveBreakGlassSessions(
  client: PoolClient
): Promise<BreakGlassAccessLog[]> {
  const result = await client.query<BreakGlassAccessLog>(
    `SELECT * FROM break_glass_access_log
     WHERE access_ended_at IS NULL
     ORDER BY access_started_at DESC`
  );
  
  return result.rows;
}

// ============================================================================
// DSAR (DATA SUBJECT ACCESS REQUEST)
// ============================================================================

export async function processDSAR(
  client: PoolClient,
  authContext: AuthContext,
  request: ProcessDSARRequest
): Promise<DSARResult> {
  const result = await client.query<DSARResult>(
    `SELECT * FROM process_dsar_request($1, $2, $3)`,
    [request.userId, request.requestType, authContext.userId]
  );
  
  return result.rows[0];
}

export async function getDSARRequests(
  client: PoolClient,
  tenantId: string,
  status?: string
): Promise<DSARRequest[]> {
  const query = status
    ? `SELECT * FROM dsar_requests WHERE tenant_id = $1 AND status = $2 ORDER BY received_at DESC`
    : `SELECT * FROM dsar_requests WHERE tenant_id = $1 ORDER BY received_at DESC`;
  
  const result = await client.query<DSARRequest>(
    query,
    status ? [tenantId, status] : [tenantId]
  );
  
  return result.rows;
}

export async function getUserDSARRequests(
  client: PoolClient,
  userId: string
): Promise<DSARRequest[]> {
  const result = await client.query<DSARRequest>(
    `SELECT * FROM dsar_requests WHERE user_id = $1 ORDER BY received_at DESC`,
    [userId]
  );
  
  return result.rows;
}

export async function updateDSARStatus(
  client: PoolClient,
  requestId: string,
  status: string,
  processingNotes?: string
): Promise<DSARRequest | null> {
  const result = await client.query<DSARRequest>(
    `UPDATE dsar_requests
     SET status = $2, processing_notes = COALESCE($3, processing_notes), updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [requestId, status, processingNotes]
  );
  
  return result.rows[0] || null;
}

// ============================================================================
// CROSS-BORDER TRANSFER
// ============================================================================

export async function checkCrossBorderTransfer(
  client: PoolClient,
  userId: string,
  targetRegion: string
): Promise<CrossBorderTransferCheck> {
  const result = await client.query<CrossBorderTransferCheck>(
    `SELECT * FROM check_cross_border_transfer($1, $2)`,
    [userId, targetRegion]
  );
  
  return result.rows[0];
}

// ============================================================================
// CREDENTIAL ROTATION
// ============================================================================

export async function verifyAppCredentials(
  client: PoolClient,
  appId: string,
  secret: string
): Promise<boolean> {
  const result = await client.query<{ verify_app_credentials: boolean }>(
    `SELECT verify_app_credentials($1, $2)`,
    [appId, secret]
  );
  
  return result.rows[0]?.verify_app_credentials ?? false;
}

export async function rotateAppSecret(
  client: PoolClient,
  appId: string,
  newSecret: string,
  rotationWindowHours: number = 24
): Promise<SecretRotationResult> {
  const result = await client.query<SecretRotationResult>(
    `SELECT * FROM rotate_app_secret($1, $2, $3)`,
    [appId, newSecret, rotationWindowHours]
  );
  
  return result.rows[0];
}

export async function setAppSecret(
  client: PoolClient,
  appId: string,
  secret: string
): Promise<boolean> {
  const result = await client.query<{ set_app_secret: boolean }>(
    `SELECT set_app_secret($1, $2)`,
    [appId, secret]
  );
  
  return result.rows[0]?.set_app_secret ?? false;
}

export async function clearExpiredRotationWindows(
  client: PoolClient
): Promise<number> {
  const result = await client.query<{ clear_expired_rotation_windows: number }>(
    `SELECT clear_expired_rotation_windows()`
  );
  
  return result.rows[0]?.clear_expired_rotation_windows ?? 0;
}

// ============================================================================
// DASHBOARD
// ============================================================================

export async function getUserRegistryDashboard(
  client: PoolClient,
  tenantId: string
): Promise<UserRegistryDashboard> {
  const [stats, recentAssignments, recentConsents, recentDSARs, tenantInfo] = await Promise.all([
    client.query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE tenant_id = $1) as total_users,
        (SELECT COUNT(*) FROM users WHERE tenant_id = $1 AND status = 'active') as active_users,
        (SELECT COUNT(*) FROM registered_apps WHERE tenant_id = $1 OR tenant_id IS NULL) as total_apps,
        (SELECT COUNT(*) FROM registered_apps WHERE (tenant_id = $1 OR tenant_id IS NULL) AND status = 'active') as active_apps,
        (SELECT COUNT(*) FROM user_application_assignments WHERE tenant_id = $1 AND revoked_at IS NULL) as total_assignments,
        (SELECT COUNT(*) FROM consent_records WHERE tenant_id = $1 AND consent_given = true AND withdrawal_timestamp IS NULL) as active_consents,
        (SELECT COUNT(*) FROM dsar_requests WHERE tenant_id = $1 AND status IN ('pending', 'in_progress')) as pending_dsars,
        (SELECT COUNT(*) FROM data_retention_obligations WHERE tenant_id = $1 AND legal_hold = true) as active_legal_holds
    `, [tenantId]),
    client.query<UserApplicationAssignment>(
      `SELECT * FROM user_application_assignments WHERE tenant_id = $1 ORDER BY granted_at DESC LIMIT 10`,
      [tenantId]
    ),
    client.query<ConsentRecord>(
      `SELECT * FROM consent_records WHERE tenant_id = $1 ORDER BY consent_timestamp DESC LIMIT 10`,
      [tenantId]
    ),
    client.query<DSARRequest>(
      `SELECT * FROM dsar_requests WHERE tenant_id = $1 ORDER BY received_at DESC LIMIT 10`,
      [tenantId]
    ),
    client.query(
      `SELECT data_region, allowed_regions, compliance_frameworks FROM tenants WHERE id = $1`,
      [tenantId]
    ),
  ]);
  
  const s = stats.rows[0];
  const t = tenantInfo.rows[0];
  
  return {
    tenantId,
    stats: {
      totalUsers: parseInt(s.total_users),
      activeUsers: parseInt(s.active_users),
      totalApps: parseInt(s.total_apps),
      activeApps: parseInt(s.active_apps),
      totalAssignments: parseInt(s.total_assignments),
      activeConsents: parseInt(s.active_consents),
      pendingDSARs: parseInt(s.pending_dsars),
      activeLegalHolds: parseInt(s.active_legal_holds),
    },
    recentActivity: {
      recentAssignments: recentAssignments.rows,
      recentConsents: recentConsents.rows,
      recentDSARs: recentDSARs.rows,
    },
    complianceStatus: {
      gdprCompliant: t?.compliance_frameworks?.includes('GDPR') ?? false,
      ccpaCompliant: t?.compliance_frameworks?.includes('CCPA') ?? false,
      coppaCompliant: t?.compliance_frameworks?.includes('COPPA') ?? false,
      dataRegion: t?.data_region ?? 'us-east-1',
      allowedRegions: t?.allowed_regions ?? ['us-east-1'],
    },
  };
}

export const userRegistryService = {
  // Assignments
  assignUserToApp,
  revokeUserFromApp,
  getUserAssignments,
  getAppUsers,
  // Consent
  recordConsent,
  withdrawConsent,
  getUserConsents,
  checkConsentStatus,
  // Legal Hold
  applyLegalHold,
  releaseLegalHold,
  getUserRetentionObligations,
  getActiveLegalHolds,
  // Break Glass
  initiateBreakGlass,
  endBreakGlass,
  getBreakGlassLogs,
  getActiveBreakGlassSessions,
  // DSAR
  processDSAR,
  getDSARRequests,
  getUserDSARRequests,
  updateDSARStatus,
  // Cross-Border
  checkCrossBorderTransfer,
  // Credentials
  verifyAppCredentials,
  rotateAppSecret,
  setAppSecret,
  clearExpiredRotationWindows,
  // Dashboard
  getUserRegistryDashboard,
};

export default userRegistryService;
