/**
 * RADIANT v4.18.0 - Multi-Application User Registry Types
 * 
 * Types for auth context, consent management, DSAR, break glass,
 * legal hold, and credential rotation.
 */

// ============================================================================
// AUTH CONTEXT TYPES
// ============================================================================

export type PermissionLevel = 'radiant_admin' | 'tenant_admin' | 'app_admin' | 'user';

export interface AuthContext {
  tenantId: string;
  userId: string;
  permissionLevel: PermissionLevel;
  appId?: string;
  jurisdiction?: string;
  dataRegion?: string;
  breakGlassMode?: boolean;
  scopes?: string[];
  groups?: string[];
}

export interface TokenClaims {
  sub: string;
  iss: string;
  client_id?: string;
  token_use: 'access' | 'id';
  scope?: string;
  'custom:tenant_id'?: string;
  'custom:app_uid'?: string;
  'custom:permission_level'?: string;
  'custom:role'?: string;
  'custom:jurisdiction'?: string;
  'custom:data_region'?: string;
  'custom:app_assignments'?: string;
  'custom:rate_limit_tier'?: string;
  'cognito:groups'?: string[];
  exp: number;
  iat: number;
}

// ============================================================================
// TENANT TYPES (EXTENDED)
// ============================================================================

export type TenantTier = 'free' | 'standard' | 'professional' | 'enterprise';
export type TenantStatus = 'active' | 'suspended' | 'pending' | 'deleted';

export interface TenantDataSovereignty {
  dataRegion: string;
  allowedRegions: string[];
  complianceFrameworks: string[];
  dataProcessingAgreementSignedAt?: Date;
}

export interface TenantExtended {
  id: string;
  name: string;
  displayName: string;
  domain?: string;
  settings: Record<string, unknown>;
  status: TenantStatus;
  tier: TenantTier;
  dataSovereignty: TenantDataSovereignty;
  primaryContactEmail?: string;
  billingEmail?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// USER TYPES (EXTENDED)
// ============================================================================

export type UserStatus = 'active' | 'suspended' | 'pending' | 'deleted';
export type AgeBracket = 'under_13' | '13_to_17' | '18_plus' | 'unknown';

export interface UserCompliance {
  jurisdiction?: string;
  ageBracket?: AgeBracket;
  mfaEnabled: boolean;
  emailVerified: boolean;
}

export interface UserExtended {
  id: string;
  tenantId: string;
  cognitoUserId: string;
  email: string;
  displayName?: string;
  role: string;
  status: UserStatus;
  settings: Record<string, unknown>;
  compliance: UserCompliance;
  avatarUrl?: string;
  locale: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  createdByAppId?: string;
  deletedAt?: Date;
  anonymizedAt?: Date;
}

// ============================================================================
// APPLICATION TYPES
// ============================================================================

export type AppType = 'web' | 'mobile' | 'api' | 'service' | 'desktop';
export type RegisteredAppStatus = 'active' | 'suspended' | 'revoked' | 'pending';
export type RateLimitTier = 'free' | 'standard' | 'premium' | 'unlimited';

export interface ApplicationCredentials {
  clientSecretHash?: string;
  previousSecretHash?: string;
  secretRotationAt?: Date;
  secretRotationWindowHours: number;
  secretsManagerArn?: string;
}

export interface ApplicationExtended {
  id: string;
  tenantId?: string;
  displayName: string;
  description?: string;
  appType: AppType;
  status: RegisteredAppStatus;
  permissions: Record<string, unknown>;
  rateLimitTier: RateLimitTier;
  allowedOrigins: string[];
  allowedRedirectUris: string[];
  cognitoUserPoolId?: string;
  cognitoClientId?: string;
  apiBaseUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface SecretRotationResult {
  success: boolean;
  appId?: string;
  rotationWindowHours?: number;
  bothSecretsValidUntil?: Date;
  error?: string;
}

// ============================================================================
// USER APPLICATION ASSIGNMENT TYPES
// ============================================================================

export type AssignmentType = 'standard' | 'admin' | 'readonly' | 'trial';

export interface UserApplicationAssignment {
  id: string;
  userId: string;
  appId: string;
  tenantId: string;
  assignmentType: AssignmentType;
  appPermissions: Record<string, unknown>;
  grantedAt: Date;
  grantedBy?: string;
  expiresAt?: Date;
  revokedAt?: Date;
  revokedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssignAppRequest {
  userId: string;
  appId: string;
  assignmentType?: AssignmentType;
  appPermissions?: Record<string, unknown>;
  expiresAt?: Date;
}

export interface RevokeAppRequest {
  userId: string;
  appId: string;
  reason?: string;
}

// ============================================================================
// CONSENT TYPES (GDPR/CCPA/COPPA)
// ============================================================================

export type LawfulBasis = 
  | 'consent' 
  | 'contract' 
  | 'legal_obligation' 
  | 'vital_interests' 
  | 'public_interest' 
  | 'legitimate_interests';

export type ConsentMethod = 
  | 'explicit_checkbox' 
  | 'click_accept' 
  | 'implicit' 
  | 'parent_consent' 
  | 'verified_parent' 
  | 'double_opt_in';

export type ParentVerificationMethod = 
  | 'credit_card' 
  | 'video_conference' 
  | 'signed_form' 
  | 'government_id' 
  | 'knowledge_based' 
  | 'toll_free_call';

export interface ConsentRecord {
  id: string;
  userId: string;
  tenantId: string;
  jurisdiction: string;
  purposeCode: string;
  purposeDescription: string;
  lawfulBasis: LawfulBasis;
  consentGiven: boolean;
  consentTimestamp: Date;
  consentVersion: string;
  consentMethod: ConsentMethod;
  consentLanguage: string;
  consentIpAddress?: string;
  consentUserAgent?: string;
  thirdPartySharingAuthorized: boolean;
  authorizedThirdParties?: Record<string, unknown>;
  saleOfDataAuthorized: boolean;
  withdrawalTimestamp?: Date;
  withdrawalMethod?: string;
  withdrawalReason?: string;
  parentGuardianId?: string;
  verificationMethod?: ParentVerificationMethod;
  verificationCompletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecordConsentRequest {
  userId: string;
  jurisdiction: string;
  purposeCode: string;
  purposeDescription: string;
  lawfulBasis: LawfulBasis;
  consentGiven: boolean;
  consentVersion: string;
  consentMethod: ConsentMethod;
  consentLanguage: string;
  thirdPartySharingAuthorized?: boolean;
  authorizedThirdParties?: Record<string, unknown>;
  saleOfDataAuthorized?: boolean;
  parentGuardianId?: string;
  verificationMethod?: ParentVerificationMethod;
}

export interface WithdrawConsentRequest {
  userId: string;
  purposeCode: string;
  reason?: string;
}

export interface ConsentWithdrawalResult {
  success: boolean;
  userId?: string;
  purposeCode?: string;
  withdrawnAt?: Date;
  reason?: string;
}

// ============================================================================
// DATA RETENTION / LEGAL HOLD TYPES
// ============================================================================

export type RetentionCategory = 
  | 'regulatory' 
  | 'contractual' 
  | 'legal_hold' 
  | 'litigation' 
  | 'audit' 
  | 'business';

export interface DataRetentionObligation {
  id: string;
  userId: string;
  tenantId: string;
  tableName: string;
  recordId: string;
  retentionReason: string;
  retentionCategory: RetentionCategory;
  retentionExpires: Date;
  legalHold: boolean;
  legalHoldReason?: string;
  legalHoldSetBy?: string;
  legalHoldSetAt?: Date;
  legalHoldCaseId?: string;
  createdAt: Date;
  createdBy?: string;
  releasedAt?: Date;
  releasedBy?: string;
}

export interface ApplyLegalHoldRequest {
  userId: string;
  reason: string;
  caseId?: string;
}

export interface ReleaseLegalHoldRequest {
  userId: string;
  releaseReason: string;
  caseId?: string;
}

export interface LegalHoldResult {
  success: boolean;
  userId: string;
  legalHoldActive?: boolean;
  reason?: string;
  caseId?: string;
  recordsUpdated?: number;
  holdsReleased?: number;
  releaseReason?: string;
}

// ============================================================================
// BREAK GLASS ACCESS TYPES
// ============================================================================

export interface BreakGlassAccessLog {
  id: string;
  adminUserId: string;
  adminEmail: string;
  adminIpAddress?: string;
  adminUserAgent?: string;
  tenantId: string;
  accessedResources: string[];
  accessReason: string;
  accessJustification?: string;
  incidentTicket?: string;
  approvedBy?: string;
  approvalTimestamp?: Date;
  accessStartedAt: Date;
  accessEndedAt?: Date;
  actionsPerformed: Record<string, unknown>[];
  dataExported: boolean;
  dataModified: boolean;
  createdAt: Date;
}

export interface InitiateBreakGlassRequest {
  tenantId: string;
  accessReason: string;
  incidentTicket?: string;
  approvedBy?: string;
}

export interface EndBreakGlassRequest {
  accessId: string;
  actionsPerformed?: Record<string, unknown>[];
}

export interface BreakGlassResult {
  success: boolean;
  accessId?: string;
  message?: string;
  instructions?: string;
  endedAt?: Date;
  durationMinutes?: number;
  error?: string;
}

// ============================================================================
// DSAR (DATA SUBJECT ACCESS REQUEST) TYPES
// ============================================================================

export type DSARRequestType = 
  | 'access' 
  | 'delete' 
  | 'portability' 
  | 'rectification' 
  | 'restriction' 
  | 'objection';

export type DSARRequestSource = 
  | 'user_portal' 
  | 'email' 
  | 'api' 
  | 'legal' 
  | 'regulator';

export type DSARStatus = 
  | 'pending' 
  | 'in_progress' 
  | 'awaiting_verification' 
  | 'completed' 
  | 'rejected' 
  | 'partially_completed';

export interface DSARRequest {
  id: string;
  userId: string;
  tenantId: string;
  requestType: DSARRequestType;
  requestSource: DSARRequestSource;
  status: DSARStatus;
  receivedAt: Date;
  acknowledgedAt?: Date;
  dueDate: Date;
  completedAt?: Date;
  identityVerified: boolean;
  verificationMethod?: string;
  verifiedAt?: Date;
  verifiedBy?: string;
  responseData?: Record<string, unknown>;
  rejectionReason?: string;
  retentionBlocks?: Record<string, unknown>;
  processedBy?: string;
  processingNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProcessDSARRequest {
  userId: string;
  requestType: DSARRequestType;
}

export interface DSARResult {
  requestId: string;
  requestType: DSARRequestType;
  generatedAt?: Date;
  status?: string;
  actionTaken?: string;
  userProfile?: Record<string, unknown>;
  applicationAssignments?: Record<string, unknown>[];
  consentRecords?: Record<string, unknown>[];
  dataRetentionHolds?: Record<string, unknown>[];
  retainedData?: Record<string, unknown>;
  reason?: string;
  format?: string;
  schemaVersion?: string;
  data?: Record<string, unknown>;
}

// ============================================================================
// CROSS-BORDER TRANSFER TYPES
// ============================================================================

export type TransferMechanism = 
  | 'same_region' 
  | 'pre_approved_region' 
  | 'adequacy_decision' 
  | 'explicit_consent' 
  | 'sccs' 
  | 'bcr';

export interface CrossBorderTransferCheck {
  allowed: boolean;
  mechanism?: TransferMechanism;
  reason?: string;
  requiredAction?: string;
  sourceRegion?: string;
  targetRegion?: string;
  userJurisdiction?: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface UserRegistryDashboard {
  tenantId: string;
  stats: {
    totalUsers: number;
    activeUsers: number;
    totalApps: number;
    activeApps: number;
    totalAssignments: number;
    activeConsents: number;
    pendingDSARs: number;
    activeLegalHolds: number;
  };
  recentActivity: {
    recentAssignments: UserApplicationAssignment[];
    recentConsents: ConsentRecord[];
    recentDSARs: DSARRequest[];
  };
  complianceStatus: {
    gdprCompliant: boolean;
    ccpaCompliant: boolean;
    coppaCompliant: boolean;
    dataRegion: string;
    allowedRegions: string[];
  };
}

export interface BreakGlassAuditReport {
  totalAccesses: number;
  activeAccesses: number;
  accessLogs: BreakGlassAccessLog[];
  avgDurationMinutes: number;
  byTenant: Record<string, number>;
  byAdmin: Record<string, number>;
}
