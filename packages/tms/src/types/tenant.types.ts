/**
 * RADIANT TMS - Tenant Types
 * Complete type definitions for Tenant Management Service
 */

import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const TenantType = {
  ORGANIZATION: 'organization',
  INDIVIDUAL: 'individual',
} as const;

export const TenantStatus = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  PENDING: 'pending',
  PENDING_DELETION: 'pending_deletion',
  DELETED: 'deleted',
} as const;

export const MembershipRole = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  VIEWER: 'viewer',
} as const;

export const MembershipStatus = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  INVITED: 'invited',
} as const;

export const ComplianceFramework = {
  HIPAA: 'hipaa',
  SOC2: 'soc2',
  GDPR: 'gdpr',
} as const;

export const VerificationOperation = {
  RESTORE_TENANT: 'restore_tenant',
  HARD_DELETE: 'hard_delete',
  TRANSFER_OWNERSHIP: 'transfer_ownership',
  COMPLIANCE_OVERRIDE: 'compliance_override',
} as const;

export const RiskLevel = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

export const CreateTenantSchema = z.object({
  name: z.string().min(1).max(100),
  displayName: z.string().min(1).max(200),
  type: z.enum(['organization', 'individual']).default('organization'),
  tier: z.number().int().min(1).max(5).default(1),
  primaryRegion: z.string().default('us-east-1'),
  complianceMode: z.array(z.enum(['hipaa', 'soc2', 'gdpr'])).default([]),
  retentionDays: z.number().int().min(7).max(730).optional(),
  adminEmail: z.string().email(),
  adminName: z.string().min(1).max(200),
  adminCognitoId: z.string().min(1).max(128).optional(),
  domain: z.string().max(255).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const UpdateTenantSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  displayName: z.string().min(1).max(200).optional(),
  tier: z.number().int().min(1).max(5).optional(),
  complianceMode: z.array(z.enum(['hipaa', 'soc2', 'gdpr'])).optional(),
  retentionDays: z.number().int().min(7).max(730).optional(),
  domain: z.string().max(255).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
  settings: z.record(z.unknown()).optional(),
});

export const SoftDeleteTenantSchema = z.object({
  initiatedBy: z.string().uuid(),
  reason: z.string().min(1).max(1000),
  notifyUsers: z.boolean().default(true),
});

export const RestoreTenantSchema = z.object({
  restoredBy: z.string().uuid(),
  verificationCode: z.string().length(6),
});

export const CreatePhantomTenantSchema = z.object({
  userEmail: z.string().email(),
  userDisplayName: z.string().min(1).max(200).optional(),
  cognitoUserId: z.string().min(1).max(128),
});

export const AddMembershipSchema = z.object({
  tenantId: z.string().uuid(),
  userEmail: z.string().email(),
  role: z.enum(['owner', 'admin', 'member', 'viewer']).default('member'),
  invitedBy: z.string().uuid(),
  sendInvitation: z.boolean().default(true),
});

export const UpdateMembershipSchema = z.object({
  role: z.enum(['owner', 'admin', 'member', 'viewer']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
});

export const ListTenantsSchema = z.object({
  status: z.enum(['active', 'suspended', 'pending', 'pending_deletion', 'deleted']).optional(),
  type: z.enum(['organization', 'individual']).optional(),
  tier: z.number().int().min(1).max(5).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  search: z.string().max(100).optional(),
  orderBy: z.enum(['name', 'created_at', 'updated_at', 'tier']).default('created_at'),
  orderDir: z.enum(['asc', 'desc']).default('desc'),
});

export const CreateVerificationCodeSchema = z.object({
  userId: z.string().uuid().optional(),
  adminId: z.string().uuid().optional(),
  operation: z.enum(['restore_tenant', 'hard_delete', 'transfer_ownership', 'compliance_override']),
  resourceId: z.string().uuid(),
  expiresMinutes: z.number().int().min(5).max(60).default(15),
  deliveryMethod: z.enum(['email', 'sms']).default('email'),
});

export const VerifyCodeSchema = z.object({
  userId: z.string().uuid().optional(),
  adminId: z.string().uuid().optional(),
  operation: z.enum(['restore_tenant', 'hard_delete', 'transfer_ownership', 'compliance_override']),
  resourceId: z.string().uuid(),
  code: z.string().length(6),
});

// ============================================================================
// TYPES (derived from enums)
// ============================================================================

export type TenantType = typeof TenantType[keyof typeof TenantType];
export type TenantStatus = typeof TenantStatus[keyof typeof TenantStatus];
export type MembershipRole = typeof MembershipRole[keyof typeof MembershipRole];
export type MembershipStatus = typeof MembershipStatus[keyof typeof MembershipStatus];
export type ComplianceFramework = typeof ComplianceFramework[keyof typeof ComplianceFramework];
export type VerificationOperation = typeof VerificationOperation[keyof typeof VerificationOperation];
export type RiskLevel = typeof RiskLevel[keyof typeof RiskLevel];

// ============================================================================
// INPUT TYPES (derived from schemas)
// ============================================================================

export type CreateTenantInput = z.infer<typeof CreateTenantSchema>;
export type UpdateTenantInput = z.infer<typeof UpdateTenantSchema>;
export type SoftDeleteTenantInput = z.infer<typeof SoftDeleteTenantSchema>;
export type RestoreTenantInput = z.infer<typeof RestoreTenantSchema>;
export type CreatePhantomTenantInput = z.infer<typeof CreatePhantomTenantSchema>;
export type AddMembershipInput = z.infer<typeof AddMembershipSchema>;
export type UpdateMembershipInput = z.infer<typeof UpdateMembershipSchema>;
export type ListTenantsInput = z.infer<typeof ListTenantsSchema>;
export type CreateVerificationCodeInput = z.infer<typeof CreateVerificationCodeSchema>;
export type VerifyCodeInput = z.infer<typeof VerifyCodeSchema>;

// ============================================================================
// ENTITY INTERFACES
// ============================================================================

export interface Tenant {
  id: string;
  name: string;
  displayName: string;
  domain: string | null;
  type: TenantType;
  status: TenantStatus;
  tier: number;
  primaryRegion: string;
  complianceMode: ComplianceFramework[];
  retentionDays: number;
  deletionScheduledAt: string | null;
  deletionRequestedBy: string | null;
  stripeCustomerId: string | null;
  kmsKeyArn: string | null;
  settings: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TenantUser {
  id: string;
  tenantId: string;
  cognitoUserId: string;
  email: string;
  displayName: string | null;
  role: string;
  status: string;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TenantMembership {
  id: string;
  tenantId: string;
  userId: string;
  role: MembershipRole;
  status: MembershipStatus;
  joinedAt: string;
  invitedBy: string | null;
  invitationToken: string | null;
  invitationExpiresAt: string | null;
  lastActiveAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenantSummary extends Tenant {
  activeUsers: number;
  suspendedUsers: number;
  invitedUsers: number;
  owners: number;
  admins: number;
}

export interface TenantAuditLog {
  id: string;
  tenantId: string | null;
  userId: string | null;
  adminId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  traceId: string | null;
  createdAt: string;
}

export interface VerificationCode {
  id: string;
  userId: string | null;
  adminId: string | null;
  operation: VerificationOperation;
  resourceId: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: string;
  verifiedAt: string | null;
  createdAt: string;
}

export interface RiskAcceptance {
  id: string;
  tenantId: string;
  controlId: string;
  controlFramework: ComplianceFramework;
  riskDescription: string;
  mitigatingControls: string | null;
  businessJustification: string;
  riskLevel: RiskLevel;
  acceptedBy: string;
  approvedBy: string | null;
  expiresAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'renewed';
  renewalCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RetentionSetting {
  id: string;
  settingKey: string;
  settingValue: unknown;
  description: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeletionNotification {
  id: string;
  tenantId: string;
  notificationType: '7_day' | '3_day' | '1_day' | 'deleted';
  sentTo: string[];
  sentAt: string;
  deliveryStatus: 'pending' | 'sent' | 'failed' | 'bounced';
  errorMessage: string | null;
  createdAt: string;
}

// ============================================================================
// RESULT INTERFACES
// ============================================================================

export interface CreateTenantResult {
  tenant: Tenant;
  adminUser: TenantUser;
  membership: TenantMembership;
}

export interface SoftDeleteResult {
  tenantId: string;
  status: TenantStatus;
  deletionScheduledAt: string;
  retentionDays: number;
  affectedUsers: {
    total: number;
    willBeDeleted: number;
    willRemain: number;
  };
  notificationsSent: boolean;
}

export interface RestoreResult {
  tenantId: string;
  status: TenantStatus;
  restoredAt: string;
  restoredBy: string;
}

export interface PhantomTenantResult {
  tenantId: string;
  userId: string;
  tenantName: string;
  isExisting: boolean;
}

export interface HardDeleteResult {
  tenantId: string;
  tenantName: string;
  deletedAt: string;
  usersDeleted: number;
  usersRetained: number;
  s3ObjectsDeleted: number;
  kmsKeyScheduledForDeletion: boolean;
}

export interface MembershipResult {
  membership: TenantMembership;
  user: TenantUser;
  invitationSent: boolean;
}

export interface VerificationResult {
  valid: boolean;
  error?: string;
  message?: string;
  attemptsRemaining?: number;
  verifiedAt?: string;
}

export interface ListTenantsResult {
  tenants: TenantSummary[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface ListMembershipsResult {
  memberships: (TenantMembership & { user: TenantUser })[];
  total: number;
}

export interface OrphanCheckResult {
  orphansFound: number;
  orphansDeleted: number;
  orphanUsers: Array<{
    userId: string;
    email: string;
    deletedAt: string;
  }>;
}

export interface ComplianceReportResult {
  generatedAt: string;
  tenantId?: string;
  totalTenants: number;
  complianceBreakdown: {
    hipaa: number;
    soc2: number;
    gdpr: number;
    none: number;
  };
  riskAcceptances: {
    pending: number;
    approved: number;
    expired: number;
  };
  retentionCompliance: {
    compliant: number;
    nonCompliant: number;
  };
}

// ============================================================================
// API CONTEXT
// ============================================================================

export interface TmsContext {
  tenantId?: string;
  userId?: string;
  adminId?: string;
  isSuperAdmin: boolean;
  ipAddress?: string;
  userAgent?: string;
  traceId?: string;
}

// ============================================================================
// EVENT TYPES (for EventBridge/SNS)
// ============================================================================

export interface TenantEvent {
  eventType: 
    | 'tenant.created'
    | 'tenant.updated'
    | 'tenant.soft_deleted'
    | 'tenant.restored'
    | 'tenant.hard_deleted'
    | 'tenant.deletion_scheduled'
    | 'tenant.deletion_cancelled';
  tenantId: string;
  timestamp: string;
  payload: Record<string, unknown>;
  actor: {
    type: 'user' | 'admin' | 'system';
    id: string;
  };
}

export interface MembershipEvent {
  eventType:
    | 'membership.created'
    | 'membership.updated'
    | 'membership.deleted'
    | 'membership.invitation_sent'
    | 'membership.invitation_accepted';
  tenantId: string;
  userId: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface UserEvent {
  eventType:
    | 'user.created'
    | 'user.orphaned'
    | 'user.deleted';
  userId: string;
  timestamp: string;
  payload: Record<string, unknown>;
}
