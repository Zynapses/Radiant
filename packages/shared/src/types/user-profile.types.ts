/**
 * RADIANT v4.18.0 — Unified User Profile & Multi-Contact System (v7.34.0)
 *
 * Architecture:
 *   Every user (end-user AND platform admin) has a unified profile with:
 *   - Up to 3 verified email addresses
 *   - Up to 3 verified phone numbers (E.164 format)
 *   - Bio, timezone, locale, avatar
 *   - Login email MUST be verified
 *   - At least 1 verified phone REQUIRED (MFA)
 *
 * Contact Routing (SENTINEL integration):
 *   Admins can map specific contacts to alert categories/severity levels.
 *   e.g., "Send SEV 1 security alerts to my on-call phone AND work email"
 *
 * Shared across ALL apps: Think Tank, Curator, Genesis, Dojo, RADIANT Admin.
 * Policy: /.windsurf/workflows/user-profile-consistency.md
 */

// =============================================================================
// CONSTANTS
// =============================================================================

export const MAX_EMAILS_PER_USER = 3;
export const MAX_PHONES_PER_USER = 3;
export const MAX_CONTACTS_PER_USER = MAX_EMAILS_PER_USER + MAX_PHONES_PER_USER; // 6

export const VERIFICATION_CODE_LENGTH = 6;
export const VERIFICATION_CODE_EXPIRY_MINUTES = 10;
export const VERIFICATION_MAX_ATTEMPTS = 3;
export const VERIFICATION_COOLDOWN_MINUTES = 10; // After max attempts, wait 10 min

// =============================================================================
// CONTACT TYPES
// =============================================================================

export type ContactType = 'email' | 'phone';

export type ContactLabel = 'work' | 'personal' | 'on_call' | 'backup' | 'custom';

export type ContactVerificationStatus = 'unverified' | 'pending' | 'verified' | 'expired';

export interface UserContact {
  id: string;
  userId: string;
  userType: UserType;
  tenantId: string;
  contactType: ContactType;
  label: ContactLabel;
  customLabel?: string; // When label = 'custom'
  value: string; // E.164 phone (+15551234567) or email (alice@company.com)
  countryCode?: string; // ISO 3166-1 alpha-2 (US, GB, DE) — phones only
  isPrimary: boolean; // One primary per contact type
  isLoginContact: boolean; // The email used for login — cannot be deleted
  verificationStatus: ContactVerificationStatus;
  verifiedAt?: string;
  verificationAttempts: number;
  verificationExpiresAt?: string;
  lastVerificationSentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type UserType = 'end_user' | 'platform_admin';

// =============================================================================
// USER PROFILE (Unified across all apps)
// =============================================================================

export interface UserProfile {
  userId: string;
  userType: UserType;
  tenantId: string;

  // Identity
  email: string; // Primary login email (always verified)
  displayName: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  bio?: string;

  // Locale
  timezone: string; // IANA timezone (e.g., 'America/New_York')
  locale: string; // BCP 47 (e.g., 'en-US')
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  timeFormat: '12h' | '24h';

  // Contact directory
  contacts: UserContact[];

  // Compliance
  phoneVerified: boolean; // At least one phone is verified (REQUIRED)
  emailVerified: boolean; // Login email is verified (REQUIRED)
  profileComplete: boolean; // All mandatory fields filled

  // Metadata
  lastProfileUpdateAt?: string;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// PROFILE COMPLETENESS REQUIREMENTS
// =============================================================================

export interface ProfileCompletionRequirements {
  requireVerifiedPhone: boolean; // Always true — needed for MFA
  requireVerifiedEmail: boolean; // Always true — login email
  requireDisplayName: boolean;
  requireTimezone: boolean;
  enforced: boolean; // If true, incomplete profile shows persistent banner
}

export const DEFAULT_PROFILE_REQUIREMENTS: ProfileCompletionRequirements = {
  requireVerifiedPhone: true,
  requireVerifiedEmail: true,
  requireDisplayName: true,
  requireTimezone: true,
  enforced: true,
};

// =============================================================================
// VERIFICATION FLOW
// =============================================================================

export interface SendVerificationRequest {
  contactId: string;
}

export interface SendVerificationResponse {
  success: boolean;
  contactId: string;
  contactType: ContactType;
  maskedValue: string; // +1***4567 or a***@company.com
  expiresAt: string;
  attemptsRemaining: number;
  error?: VerificationError;
}

export type VerificationError =
  | 'CONTACT_NOT_FOUND'
  | 'ALREADY_VERIFIED'
  | 'MAX_ATTEMPTS_EXCEEDED'
  | 'COOLDOWN_ACTIVE'
  | 'RATE_LIMITED'
  | 'DELIVERY_FAILED'
  | 'INVALID_CONTACT'
  | 'NO_PENDING_CODE';

export interface VerifyCodeRequest {
  contactId: string;
  code: string; // 6-digit code
}

export interface VerifyCodeResponse {
  success: boolean;
  contactId: string;
  verified: boolean;
  attemptsRemaining?: number;
  error?: VerificationError | 'INVALID_CODE' | 'CODE_EXPIRED';
}

export interface VerificationLog {
  id: string;
  contactId: string;
  userId: string;
  tenantId: string;
  contactType: ContactType;
  action: 'code_sent' | 'code_verified' | 'code_failed' | 'code_expired' | 'max_attempts';
  maskedValue: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// =============================================================================
// CONTACT CRUD
// =============================================================================

export interface AddContactRequest {
  contactType: ContactType;
  value: string;
  label: ContactLabel;
  customLabel?: string;
  countryCode?: string; // Required for phone
  isPrimary?: boolean;
}

export interface AddContactResponse {
  success: boolean;
  contact?: UserContact;
  error?: 'MAX_CONTACTS_REACHED' | 'DUPLICATE_CONTACT' | 'INVALID_FORMAT' | 'INVALID_COUNTRY_CODE';
}

export interface UpdateContactRequest {
  contactId: string;
  label?: ContactLabel;
  customLabel?: string;
  isPrimary?: boolean;
}

export interface RemoveContactRequest {
  contactId: string;
}

export interface RemoveContactResponse {
  success: boolean;
  error?: 'CONTACT_NOT_FOUND' | 'CANNOT_REMOVE_LOGIN_EMAIL' | 'CANNOT_REMOVE_LAST_VERIFIED_PHONE';
}

// =============================================================================
// PROFILE UPDATE
// =============================================================================

export interface UpdateProfileRequest {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  timezone?: string;
  locale?: string;
  dateFormat?: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  timeFormat?: '12h' | '24h';
}

export interface UpdateProfileResponse {
  success: boolean;
  profile: UserProfile;
}

// =============================================================================
// SENTINEL CONTACT ROUTING
// =============================================================================

export type SentinelAlertCategory =
  | 'infrastructure' | 'security' | 'compliance' | 'application'
  | 'ai_model' | 'data' | 'billing' | 'performance'
  | 'availability' | 'tenant' | '*';

export type SentinelSeverityLevel = 1 | 2 | 3 | 4 | 5;

export interface SentinelContactRoute {
  id: string;
  adminId: string;
  tenantId: string;
  alertCategory: SentinelAlertCategory; // '*' = all categories
  minSeverity: SentinelSeverityLevel; // Only route alerts at this severity or higher (1=most severe)
  contactId: string; // FK → user_contacts (must be verified)
  contactSnapshot: { // Denormalized for fast lookup at alert time
    contactType: ContactType;
    value: string;
    label: ContactLabel;
  };
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContactRouteRequest {
  alertCategory: SentinelAlertCategory;
  minSeverity: SentinelSeverityLevel;
  contactId: string;
}

export interface CreateContactRouteResponse {
  success: boolean;
  route?: SentinelContactRoute;
  error?: 'CONTACT_NOT_VERIFIED' | 'CONTACT_NOT_FOUND' | 'DUPLICATE_ROUTE' | 'MAX_ROUTES_EXCEEDED';
}

export interface UpdateContactRouteRequest {
  routeId: string;
  minSeverity?: SentinelSeverityLevel;
  enabled?: boolean;
}

export interface DeleteContactRouteRequest {
  routeId: string;
}

export interface AdminContactRoutingSummary {
  adminId: string;
  adminName: string;
  routes: SentinelContactRoute[];
  contacts: UserContact[]; // Only verified contacts
  uncoveredCategories: SentinelAlertCategory[]; // Categories with no routing rule
  hasSev1Coverage: boolean; // At least one route covers SEV 1
}

// =============================================================================
// PROFILE API ENDPOINTS (for reference)
// =============================================================================

/**
 * Profile API — Base: /api/profile
 *
 * GET    /                     → Get current user's profile
 * PUT    /                     → Update profile fields
 * POST   /avatar               → Upload avatar (multipart)
 *
 * GET    /contacts              → List all contacts
 * POST   /contacts              → Add a new contact
 * PUT    /contacts/:id          → Update contact label/primary
 * DELETE /contacts/:id          → Remove a contact
 *
 * POST   /contacts/:id/send-code    → Send verification code (SMS or email)
 * POST   /contacts/:id/verify       → Verify code
 * POST   /contacts/:id/resend       → Resend verification code
 *
 * --- SENTINEL Routing (admin-only) ---
 * GET    /sentinel/routes       → List admin's contact routing rules
 * POST   /sentinel/routes       → Create a routing rule
 * PUT    /sentinel/routes/:id   → Update a routing rule
 * DELETE /sentinel/routes/:id   → Delete a routing rule
 * GET    /sentinel/coverage     → Coverage summary (uncovered categories, SEV 1 gaps)
 */

// =============================================================================
// SYSTEM ADMINISTRATOR TYPES (Feature B)
// =============================================================================

export type SystemAdminRole = 'super_admin' | 'admin' | 'operator' | 'auditor';

export interface SystemAdminPermissionSet {
  // Admin management
  canCreateAdmins: boolean;
  canDeleteAdmins: boolean;
  canChangeAdminRoles: boolean;
  canCreateSuperAdmins: boolean;

  // Tenant management
  canCreateTenants: boolean;
  canDeleteTenants: boolean;
  canManageTenants: boolean;
  canViewTenants: boolean;

  // User management
  canManageUsers: boolean;
  canViewUsers: boolean;

  // Models & AI
  canManageModels: boolean;
  canManageProviders: boolean;
  canViewModels: boolean;

  // System configuration
  canManageSystemConfig: boolean;
  canManageSecurityPolicies: boolean;
  canViewConfig: boolean;

  // Billing
  canManageBilling: boolean;
  canViewBilling: boolean;

  // Deployment
  canDeploy: boolean;
  canApprove: boolean;

  // Monitoring
  canAccessSentinel: boolean;
  canManageSentinel: boolean;

  // Audit
  canViewAuditLogs: boolean;
  canExportAuditLogs: boolean;

  // System admin management
  canManageSystemAdmins: boolean; // Create/modify/deactivate other system admins
}

export const SYSTEM_ADMIN_PERMISSIONS: Record<SystemAdminRole, SystemAdminPermissionSet> = {
  super_admin: {
    canCreateAdmins: true,
    canDeleteAdmins: true,
    canChangeAdminRoles: true,
    canCreateSuperAdmins: true,
    canCreateTenants: true,
    canDeleteTenants: true,
    canManageTenants: true,
    canViewTenants: true,
    canManageUsers: true,
    canViewUsers: true,
    canManageModels: true,
    canManageProviders: true,
    canViewModels: true,
    canManageSystemConfig: true,
    canManageSecurityPolicies: true,
    canViewConfig: true,
    canManageBilling: true,
    canViewBilling: true,
    canDeploy: true,
    canApprove: true,
    canAccessSentinel: true,
    canManageSentinel: true,
    canViewAuditLogs: true,
    canExportAuditLogs: true,
    canManageSystemAdmins: true,
  },
  // admin: Platform infrastructure admin
  admin: {
    canCreateAdmins: false,
    canDeleteAdmins: false,
    canChangeAdminRoles: false,
    canCreateSuperAdmins: false,
    canCreateTenants: true,
    canDeleteTenants: false,
    canManageTenants: true,
    canViewTenants: true,
    canManageUsers: true,
    canViewUsers: true,
    canManageModels: true,
    canManageProviders: true,
    canViewModels: true,
    canManageSystemConfig: true,
    canManageSecurityPolicies: false,
    canViewConfig: true,
    canManageBilling: true,
    canViewBilling: true,
    canDeploy: true,
    canApprove: true,
    canAccessSentinel: true,
    canManageSentinel: false,
    canViewAuditLogs: true,
    canExportAuditLogs: true,
    canManageSystemAdmins: false,
  },
  // operator: Operations
  operator: {
    canCreateAdmins: false,
    canDeleteAdmins: false,
    canChangeAdminRoles: false,
    canCreateSuperAdmins: false,
    canCreateTenants: false,
    canDeleteTenants: false,
    canManageTenants: false,
    canViewTenants: true,
    canManageUsers: false,
    canViewUsers: true,
    canManageModels: true,
    canManageProviders: true,
    canViewModels: true,
    canManageSystemConfig: false,
    canManageSecurityPolicies: false,
    canViewConfig: true,
    canManageBilling: false,
    canViewBilling: false,
    canDeploy: true,
    canApprove: false,
    canAccessSentinel: true,
    canManageSentinel: false,
    canViewAuditLogs: true,
    canExportAuditLogs: false,
    canManageSystemAdmins: false,
  },
  // auditor: Read-only
  auditor: {
    canCreateAdmins: false,
    canDeleteAdmins: false,
    canChangeAdminRoles: false,
    canCreateSuperAdmins: false,
    canCreateTenants: false,
    canDeleteTenants: false,
    canManageTenants: false,
    canViewTenants: true,
    canManageUsers: false,
    canViewUsers: true,
    canManageModels: false,
    canManageProviders: false,
    canViewModels: true,
    canManageSystemConfig: false,
    canManageSecurityPolicies: false,
    canViewConfig: false,
    canManageBilling: false,
    canViewBilling: true,
    canDeploy: false,
    canApprove: false,
    canAccessSentinel: false,
    canManageSentinel: false,
    canViewAuditLogs: true,
    canExportAuditLogs: true,
    canManageSystemAdmins: false,
  },
};

// =============================================================================
// ADMIN ROUTE PROTECTION
// =============================================================================

export type AdminRouteCategory =
  | 'dashboard'
  | 'admin_management'
  | 'tenant_management'
  | 'user_management'
  | 'model_management'
  | 'system_config'
  | 'security'
  | 'billing'
  | 'deployment'
  | 'sentinel'
  | 'audit'
  | 'analytics'
  | 'operations';

export interface AdminRoutePermission {
  path: string; // Route path pattern (e.g., '/administrators', '/sentinel/*')
  category: AdminRouteCategory;
  requiredPermission: keyof SystemAdminPermissionSet;
  minRole?: SystemAdminRole; // Minimum role level required
}

export const ADMIN_ROUTE_PERMISSIONS: AdminRoutePermission[] = [
  // Dashboard — all roles
  { path: '/', category: 'dashboard', requiredPermission: 'canViewTenants' },
  { path: '/health', category: 'dashboard', requiredPermission: 'canViewTenants' },

  // Admin management — super_admin only
  { path: '/administrators', category: 'admin_management', requiredPermission: 'canCreateAdmins', minRole: 'super_admin' },
  { path: '/administrators/*', category: 'admin_management', requiredPermission: 'canCreateAdmins', minRole: 'super_admin' },

  // Tenant management
  { path: '/tenants', category: 'tenant_management', requiredPermission: 'canViewTenants' },
  { path: '/tenants/*', category: 'tenant_management', requiredPermission: 'canManageTenants' },

  // User management
  { path: '/users', category: 'user_management', requiredPermission: 'canViewUsers' },
  { path: '/users/*', category: 'user_management', requiredPermission: 'canManageUsers' },
  { path: '/user-registry', category: 'user_management', requiredPermission: 'canViewUsers' },
  { path: '/invitations', category: 'user_management', requiredPermission: 'canManageUsers' },

  // Models & AI
  { path: '/models', category: 'model_management', requiredPermission: 'canViewModels' },
  { path: '/models/*', category: 'model_management', requiredPermission: 'canManageModels' },
  { path: '/providers', category: 'model_management', requiredPermission: 'canManageProviders' },
  { path: '/model-registry', category: 'model_management', requiredPermission: 'canViewModels' },

  // System config — super_admin + admin
  { path: '/settings', category: 'system_config', requiredPermission: 'canViewConfig' },
  { path: '/settings/*', category: 'system_config', requiredPermission: 'canManageSystemConfig' },
  { path: '/configuration', category: 'system_config', requiredPermission: 'canManageSystemConfig' },
  { path: '/system-config', category: 'system_config', requiredPermission: 'canManageSystemConfig' },

  // Security — super_admin only
  { path: '/security', category: 'security', requiredPermission: 'canManageSecurityPolicies', minRole: 'super_admin' },
  { path: '/security/*', category: 'security', requiredPermission: 'canManageSecurityPolicies', minRole: 'super_admin' },

  // Billing
  { path: '/billing', category: 'billing', requiredPermission: 'canViewBilling' },
  { path: '/billing/*', category: 'billing', requiredPermission: 'canManageBilling' },
  { path: '/pricing', category: 'billing', requiredPermission: 'canManageBilling' },

  // SENTINEL
  { path: '/sentinel', category: 'sentinel', requiredPermission: 'canAccessSentinel' },
  { path: '/sentinel/*', category: 'sentinel', requiredPermission: 'canAccessSentinel' },

  // Audit
  { path: '/audit-logs', category: 'audit', requiredPermission: 'canViewAuditLogs' },
  { path: '/aws-logs', category: 'audit', requiredPermission: 'canViewAuditLogs' },
  { path: '/log-retention', category: 'audit', requiredPermission: 'canViewAuditLogs' },
  { path: '/compliance', category: 'audit', requiredPermission: 'canViewAuditLogs' },
  { path: '/compliance/*', category: 'audit', requiredPermission: 'canViewAuditLogs' },

  // Analytics
  { path: '/analytics', category: 'analytics', requiredPermission: 'canViewTenants' },
  { path: '/analytics/*', category: 'analytics', requiredPermission: 'canViewTenants' },
  { path: '/metrics', category: 'analytics', requiredPermission: 'canViewTenants' },
  { path: '/reports', category: 'analytics', requiredPermission: 'canViewTenants' },
  { path: '/reports/*', category: 'analytics', requiredPermission: 'canViewTenants' },

  // Deployments — operator+
  { path: '/deployments', category: 'deployment', requiredPermission: 'canDeploy' },
  { path: '/deployments/*', category: 'deployment', requiredPermission: 'canDeploy' },
];

// =============================================================================
// ADMIN BOOTSTRAP
// =============================================================================

export interface AdminBootstrapConfig {
  isFirstAdmin: boolean; // Auto-assigned super_admin
  requireMfa: boolean; // super_admin MUST have MFA enabled
  requireVerifiedPhone: boolean; // super_admin MUST have verified phone
}

export const ADMIN_BOOTSTRAP_DEFAULTS: AdminBootstrapConfig = {
  isFirstAdmin: false,
  requireMfa: true,
  requireVerifiedPhone: true,
};

// =============================================================================
// TENANT PROVISIONING (Sign-Up → Provision → First User = tenant_admin)
// =============================================================================

/**
 * Role domains — RADIANT platform vs. tenant:
 *
 * PLATFORM (RADIANT Admin):
 *   super_admin → inherits admin + RADIANT Admin + ALL RADIANT app access
 *   admin       → platform admin, NO RADIANT app access
 *   operator    → operations, NO RADIANT app access
 *   auditor     → read-only, NO RADIANT app access
 *
 * TENANT (Customer side):
 *   tenant_admin   → full tenant control, assigned to first sign-up user
 *   tenant_owner   → ownership rights (billing, deletion)
 *   standard_user  → regular user
 *   viewer         → read-only user
 */

export type TenantProvisioningStatus =
  | 'pending'          // Sign-up received, awaiting email verification
  | 'email_verified'   // Email verified, awaiting phone verification
  | 'phone_verified'   // Phone verified, provisioning tenant
  | 'provisioning'     // Creating tenant + user records
  | 'provisioned'      // Tenant + first user created
  | 'invitation_sent'  // Invitation sent to first user
  | 'active'           // First user accepted invitation, tenant active
  | 'failed'           // Provisioning failed
  | 'expired';         // Sign-up expired (not verified in time)

export interface TenantSignUpRequest {
  email: string;                    // Login email (must be verified)
  phone: string;                    // Phone number E.164 (must be verified)
  phoneCountryCode: string;         // 2-letter country code
  firstName: string;
  lastName: string;
  displayName?: string;
  organizationName: string;         // Tenant display name
  organizationSlug?: string;        // URL-safe slug (auto-generated if blank)
  tier: 'FREE' | 'STARTER' | 'PRO' | 'SCALE' | 'ENTERPRISE';
  referralSource?: string;          // How they found us
  marketingConsent?: boolean;
}

export interface TenantProvisioningRecord {
  id: string;
  email: string;
  phone: string;
  phoneCountryCode: string;
  firstName: string;
  lastName: string;
  displayName: string;
  organizationName: string;
  organizationSlug: string;
  tier: string;
  status: TenantProvisioningStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  emailVerificationSentAt?: string;
  phoneVerificationSentAt?: string;
  emailVerifiedAt?: string;
  phoneVerifiedAt?: string;
  tenantId?: string;                // Set after provisioning
  userId?: string;                  // Set after provisioning
  invitationToken?: string;         // Set after invitation sent
  invitationSentAt?: string;
  invitationExpiresAt?: string;
  invitationAcceptedAt?: string;
  failureReason?: string;
  referralSource?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;                // Sign-up expires if not completed
}

export interface TenantProvisioningResult {
  success: boolean;
  provisioningId: string;
  status: TenantProvisioningStatus;
  tenantId?: string;
  userId?: string;
  error?: string;
}

export const TENANT_PROVISIONING_DEFAULTS = {
  signUpExpiryHours: 48,            // Sign-up expires after 48 hours
  invitationExpiryHours: 72,        // Invitation expires after 72 hours
  firstUserRole: 'tenant_admin' as const,
  firstUserApps: {
    hasAccessThinkTank: true,
    hasAccessCurator: true,
    hasAccessDojo: false,
    hasAccessCatoTrainer: false,
    hasAccessGenesis: false,
    hasAccessTenantAdmin: true,
  },
};
