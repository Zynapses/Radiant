/**
 * RADIANT v4.18.0 — Single-Tenant User & Licensing Types (v7.23.0)
 *
 * Architecture:
 *   Each user belongs to EXACTLY ONE tenant (users.tenant_id NOT NULL).
 *   Same email can exist in multiple tenants as separate user records.
 *   Licensing is flexible and multi-dimensional (seats, storage, retention, compliance).
 *
 * Replaces: v7.22.0 multi-tenant membership model
 */

// =============================================================================
// USER (Single-Tenant)
// =============================================================================

export type UserStatus = 'active' | 'suspended' | 'pending' | 'invited' | 'deactivated';

export type TenantRole = 'standard_user' | 'tenant_admin' | 'tenant_owner' | 'viewer';

export interface TenantUser {
  id: string;
  tenantId: string;
  cognitoUserId: string;
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  emailVerified: boolean;

  role: string;
  tenantRole: TenantRole;
  status: UserStatus;

  hasAccessThinkTank: boolean;
  hasAccessCurator: boolean;
  hasAccessDojo: boolean;
  hasAccessCatoTrainer: boolean;
  hasAccessGenesis: boolean;
  hasAccessTenantAdmin: boolean;

  ssoProvider?: string;
  ssoProviderUserId?: string;

  mfaEnabled: boolean;
  mfaMethods: string[];

  invitationToken?: string;
  invitationExpiresAt?: string;
  invitedBy?: string;

  deactivatedAt?: string;
  deactivatedBy?: string;
  deactivationReason?: string;
  deletionRequestedAt?: string;
  deletionScheduledFor?: string;

  lastLoginAt?: string;
  loginCount: number;
  lastActiveAt?: string;
  messageCount: number;
  tokenUsage: number;

  permissions: Record<string, boolean>;
  settings: Record<string, unknown>;

  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// LICENSING
// =============================================================================

export type LicenseType = 'seat' | 'storage' | 'retention' | 'compliance' | 'feature' | 'api_rate' | 'addon';

export type AppId = 'think_tank' | 'curator' | 'dojo' | 'cato_trainer' | 'genesis' | 'platform';

export type LicenseUnit = 'user' | 'gb' | 'days' | 'requests' | 'boolean' | 'token' | 'unit';

export type ComplianceFeatureCode =
  | 'hipaa' | 'hipaa_retention' | 'gdpr' | 'soc2' | 'ccpa'
  | 'iso27001' | 'data_residency' | 'enhanced_audit'
  | 'pci_dss' | 'fedramp' | 'hitrust' | 'eu_ai_act';

export type AddonFeatureCode =
  | 'custom_models' | 'dedicated_support' | 'white_label'
  | 'sso_enterprise' | 'advanced_analytics';

export type FeatureCode = ComplianceFeatureCode | AddonFeatureCode | string;

export interface TenantLicense {
  id: string;
  tenantId: string;
  licenseType: LicenseType;
  appId: AppId;
  featureCode?: FeatureCode;
  quantity: number;
  used: number;
  reserved: number;
  unit: LicenseUnit;
  includedInTier: number;
  additionalPurchased: number;
  pricePerUnitCents?: number;
  overageAllowed: boolean;
  overagePricePerUnitCents?: number;
  isActive: boolean;
  expiresAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type LicenseCatalogCategory = 'app_access' | 'capacity' | 'compliance' | 'addon';

export interface LicenseCatalogEntry {
  id: string;
  licenseType: LicenseType;
  appId: AppId;
  featureCode?: FeatureCode;
  displayName: string;
  description?: string;
  category: LicenseCatalogCategory;
  unit: LicenseUnit;
  defaultPricePerUnitCents?: number;
  includedTier1: number;
  includedTier2: number;
  includedTier3: number;
  includedTier4: number;
  includedTier5: number;
  minQuantity: number;
  maxQuantity?: number;
  requiresLicenseIds?: string[];
  isPublic: boolean;
  sortOrder: number;
}

export type LicenseAuditAction =
  | 'created' | 'activated' | 'deactivated' | 'quantity_changed'
  | 'used_changed' | 'reserved_changed' | 'expired' | 'renewed'
  | 'overage_triggered' | 'tier_upgrade' | 'tier_downgrade';

export interface LicenseAuditRecord {
  id: string;
  tenantId: string;
  licenseId?: string;
  action: LicenseAuditAction;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  performedBy?: string;
  performedByApp?: AdminApp;
  reason?: string;
  createdAt: string;
}

// =============================================================================
// LICENSE CHECK (API middleware)
// =============================================================================

export interface LicenseRequirement {
  appId: AppId;
  licenseType?: LicenseType;
  featureCode?: FeatureCode;
  checkSeat?: boolean;
  checkFeature?: boolean;
}

export interface LicenseCheckResult {
  allowed: boolean;
  error?: 'LICENSE_REQUIRED' | 'SEAT_NOT_ASSIGNED' | 'SEAT_LIMIT_REACHED';
  licenseType?: LicenseType;
  appId?: AppId;
  featureCode?: FeatureCode;
  message?: string;
  contact?: string;
  upgradeUrl?: string;
}

// =============================================================================
// TENANT AUTH CONFIG
// =============================================================================

export interface TenantAuthConfig {
  tenantId: string;
  allowPasswordLogin: boolean;
  allowGoogleLogin: boolean;
  allowAppleLogin: boolean;
  allowMicrosoftLogin: boolean;
  requireSsoOnly: boolean;
  requireMfa: boolean;
  ssoProviderType?: 'saml' | 'oidc';
  ssoMetadataUrl?: string;
  ssoEntityId?: string;
  sessionTimeoutMinutes: number;
  maxFailedAttempts: number;
  lockoutDurationMinutes: number;
  invitationExpiryDays: number;
  hipaaMode: boolean;
  updatedAt: string;
  updatedBy?: string;
}

// =============================================================================
// ADMIN ACTIONS
// =============================================================================

export type UserAdminAction =
  | 'user_invited' | 'user_activated' | 'user_deactivated' | 'user_reactivated'
  | 'role_changed' | 'feature_toggled' | 'app_access_changed'
  | 'deletion_requested' | 'deletion_cancelled' | 'deletion_executed'
  | 'cognito_disabled' | 'cognito_enabled'
  | 'mfa_enabled' | 'mfa_disabled'
  | 'license_created' | 'license_changed' | 'seat_consumed' | 'seat_released';

export type AdminApp = 'radiant_admin' | 'thinktank_admin' | 'thinktank_tenant_admin' | 'system' | 'billing' | 'api';

export interface UserAdminActionRecord {
  id: string;
  userId?: string;
  tenantId?: string;
  action: UserAdminAction;
  details: Record<string, unknown>;
  performedBy?: string;
  adminApp: AdminApp;
  ipAddress?: string;
  createdAt: string;
}

// =============================================================================
// SAFETY FUNCTION RESPONSES
// =============================================================================

export interface DeactivateUserResult {
  success: boolean;
  seatsFreed: string[];
  message: string;
}

export interface RequestDeletionResult {
  success: boolean;
  legalHolds: number;
  retentionDays: number;
  blockedReason?: string;
  scheduledFor?: string;
  message: string;
}

// =============================================================================
// API REQUESTS
// =============================================================================

export interface InviteUserRequest {
  email: string;
  tenantRole?: TenantRole;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  hasAccessThinkTank?: boolean;
  hasAccessCurator?: boolean;
  hasAccessDojo?: boolean;
  hasAccessCatoTrainer?: boolean;
  hasAccessGenesis?: boolean;
  hasAccessTenantAdmin?: boolean;
}

export interface UpdateUserRequest {
  tenantRole?: TenantRole;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  hasAccessThinkTank?: boolean;
  hasAccessCurator?: boolean;
  hasAccessDojo?: boolean;
  hasAccessCatoTrainer?: boolean;
  hasAccessGenesis?: boolean;
  hasAccessTenantAdmin?: boolean;
  mfaEnabled?: boolean;
  permissions?: Record<string, boolean>;
}

export interface DeactivateUserRequest {
  userId: string;
  reason?: string;
}

export interface RequestUserDeletionRequest {
  userId: string;
  reason?: string;
}

export interface UpdateTenantAuthConfigRequest {
  allowPasswordLogin?: boolean;
  allowGoogleLogin?: boolean;
  allowAppleLogin?: boolean;
  allowMicrosoftLogin?: boolean;
  requireSsoOnly?: boolean;
  requireMfa?: boolean;
  ssoProviderType?: 'saml' | 'oidc';
  ssoMetadataUrl?: string;
  ssoEntityId?: string;
  sessionTimeoutMinutes?: number;
  maxFailedAttempts?: number;
  lockoutDurationMinutes?: number;
  invitationExpiryDays?: number;
  hipaaMode?: boolean;
}
