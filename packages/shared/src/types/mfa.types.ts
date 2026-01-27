/**
 * RADIANT v5.52.28 - MFA Types (PROMPT-41B)
 * 
 * Two-Factor Authentication types for role-based MFA enforcement.
 */

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface MFAConfig {
  mfaRequiredRoles: string[];
  mfaUiVisibleRoles: string[];
  mfaCanDisableRoles: string[];
  mfaMethodsAllowed: MFAMethod[];
  totpIssuer: string;
  totpAlgorithm: 'SHA1' | 'SHA256' | 'SHA512';
  totpDigits: number;
  totpPeriodSeconds: number;
  totpWindow: number;
  backupCodesCount: number;
  backupCodesLength: number;
  deviceTrustEnabled: boolean;
  deviceTrustDays: number;
  maxTrustedDevicesPerUser: number;
  mfaMaxAttempts: number;
  mfaLockoutMinutes: number;
}

export const MFA_CONFIG_DEFAULTS: MFAConfig = {
  mfaRequiredRoles: [
    'tenant_admin',
    'tenant_owner',
    'super_admin',
    'admin',
    'operator',
    'auditor',
  ],
  mfaUiVisibleRoles: [
    'tenant_admin',
    'tenant_owner',
    'super_admin',
    'admin',
    'operator',
    'auditor',
  ],
  mfaCanDisableRoles: [],
  mfaMethodsAllowed: ['totp'],
  totpIssuer: 'RADIANT',
  totpAlgorithm: 'SHA1',
  totpDigits: 6,
  totpPeriodSeconds: 30,
  totpWindow: 1,
  backupCodesCount: 10,
  backupCodesLength: 8,
  deviceTrustEnabled: true,
  deviceTrustDays: 30,
  maxTrustedDevicesPerUser: 5,
  mfaMaxAttempts: 3,
  mfaLockoutMinutes: 5,
};

// ============================================================================
// MFA METHOD TYPES
// ============================================================================

export type MFAMethod = 'totp' | 'sms' | 'webauthn';

export type MFAUserType = 'tenant_user' | 'platform_admin';

export type MFAEventType =
  | 'enrollment_started'
  | 'enrollment_completed'
  | 'enrollment_failed'
  | 'verification_success'
  | 'verification_failed'
  | 'backup_code_used'
  | 'backup_codes_regenerated'
  | 'device_trusted'
  | 'device_revoked'
  | 'lockout_triggered'
  | 'lockout_cleared';

// ============================================================================
// ENROLLMENT TYPES
// ============================================================================

export interface MFAEnrollmentStartResponse {
  secret: string;
  uri: string;
  qrCodeDataUrl?: string;
}

export interface MFAEnrollmentVerifyRequest {
  code: string;
}

export interface MFAEnrollmentVerifyResponse {
  success: boolean;
  backupCodes: string[];
}

// ============================================================================
// VERIFICATION TYPES
// ============================================================================

export interface MFAVerifyRequest {
  code: string;
  type: 'totp' | 'backup';
  rememberDevice?: boolean;
  deviceFingerprint?: string;
}

export interface MFAVerifyResponse {
  success: boolean;
  deviceToken?: string;
  remainingAttempts?: number;
  lockoutUntil?: string;
}

// ============================================================================
// STATUS TYPES
// ============================================================================

export interface MFAStatus {
  enabled: boolean;
  enrolledAt?: string;
  method?: MFAMethod;
  backupCodesRemaining: number;
  trustedDevices: MFATrustedDevice[];
  isRequired: boolean;
  canDisable: boolean;
}

export interface MFATrustedDevice {
  id: string;
  deviceName: string;
  trustedAt: string;
  lastUsedAt?: string;
  expiresAt: string;
  current: boolean;
}

// ============================================================================
// BACKUP CODES TYPES
// ============================================================================

export interface MFABackupCode {
  id: string;
  codeHash: string;
  isUsed: boolean;
  usedAt?: string;
  usedIp?: string;
  createdAt: string;
}

export interface MFARegenerateBackupCodesResponse {
  codes: string[];
}

// ============================================================================
// AUDIT TYPES
// ============================================================================

export interface MFAAuditLogEntry {
  id: string;
  userType: MFAUserType;
  userId: string;
  tenantId?: string;
  eventType: MFAEventType;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// ============================================================================
// LOGIN FLOW TYPES
// ============================================================================

export interface MFALoginCheckResponse {
  mfaRequired: boolean;
  mfaEnrolled: boolean;
  deviceTrusted: boolean;
  role: string;
}

export type MFAAuthStep = 
  | 'credentials' 
  | 'mfa_enroll'
  | 'mfa_verify'
  | 'complete';

export interface MFAAuthState {
  step: MFAAuthStep;
  email: string;
  mfaRequired: boolean;
  mfaEnrolled: boolean;
  deviceTrusted: boolean;
  error?: string;
  loading: boolean;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface MFAEnrollStartRequest {
  email: string;
}

export interface MFATrustDeviceRequest {
  deviceName: string;
  deviceFingerprint?: string;
}

export interface MFARevokeDeviceRequest {
  deviceId: string;
}

export interface MFASettingsUpdateRequest {
  enabled?: boolean;
}

// ============================================================================
// ROLE CHECKING HELPERS
// ============================================================================

export function isMFARequired(role: string, config: MFAConfig = MFA_CONFIG_DEFAULTS): boolean {
  return config.mfaRequiredRoles.includes(role);
}

export function isMFAVisible(role: string, config: MFAConfig = MFA_CONFIG_DEFAULTS): boolean {
  return config.mfaUiVisibleRoles.includes(role);
}

export function canDisableMFA(role: string, config: MFAConfig = MFA_CONFIG_DEFAULTS): boolean {
  return config.mfaCanDisableRoles.includes(role);
}
