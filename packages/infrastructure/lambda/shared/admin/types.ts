/**
 * Admin-specific types for RADIANT v2.2.0
 */

import { z } from 'zod';

export const AdminRole = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  OPERATOR: 'operator',
  AUDITOR: 'auditor',
} as const;

export type AdminRoleType = typeof AdminRole[keyof typeof AdminRole];

export const ROLE_HIERARCHY: Record<AdminRoleType, number> = {
  [AdminRole.SUPER_ADMIN]: 100,
  [AdminRole.ADMIN]: 75,
  [AdminRole.OPERATOR]: 50,
  [AdminRole.AUDITOR]: 25,
};

export const ROLE_PERMISSIONS: Record<AdminRoleType, string[]> = {
  [AdminRole.SUPER_ADMIN]: [
    'admin:*',
    'billing:*',
    'settings:*',
    'deployments:*',
    'approvals:*',
    'audit:*',
  ],
  [AdminRole.ADMIN]: [
    'admin:read',
    'admin:write',
    'billing:read',
    'settings:read',
    'settings:write',
    'deployments:read',
    'deployments:write',
    'approvals:read',
    'approvals:initiate',
  ],
  [AdminRole.OPERATOR]: [
    'admin:read',
    'billing:read',
    'settings:read',
    'deployments:read',
  ],
  [AdminRole.AUDITOR]: [
    'admin:read',
    'billing:read',
    'audit:read',
  ],
};

export interface Invitation {
  id: string;
  email: string;
  role: AdminRoleType;
  invitedBy: string;
  invitedByName: string;
  appId: string;
  tenantId: string;
  environment: 'dev' | 'staging' | 'prod';
  token: string;
  tokenHash: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  createdAt: string;
  acceptedAt?: string;
  acceptedByIp?: string;
}

export const createInvitationSchema = z.object({
  email: z.string().email(),
  role: z.enum(['super_admin', 'admin', 'operator', 'auditor']),
  message: z.string().max(500).optional(),
  expiresInHours: z.number().int().min(1).max(168).default(48),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(32),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  password: z.string().min(12).max(128),
  mfaMethod: z.enum(['authenticator', 'sms', 'email']).default('authenticator'),
  phone: z.string().optional(),
});

export type ApprovalType = 
  | 'deployment'
  | 'promotion'
  | 'model_activation'
  | 'provider_change'
  | 'user_role_change'
  | 'billing_change';

export type ApprovalStatus = 
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'cancelled';

export interface ApprovalRequest {
  id: string;
  type: ApprovalType;
  appId: string;
  tenantId: string;
  environment: 'dev' | 'staging' | 'prod';
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  expiresAt: string;
  status: ApprovalStatus;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectedReason?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details: Record<string, unknown>;
  priority: 'low' | 'medium' | 'high' | 'critical';
  notes?: string;
}

export const createApprovalSchema = z.object({
  type: z.enum([
    'deployment', 'promotion', 'model_activation',
    'provider_change', 'user_role_change', 'billing_change',
  ]),
  action: z.string(),
  resourceType: z.string(),
  resourceId: z.string(),
  details: z.record(z.unknown()),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  notes: z.string().max(1000).optional(),
  expiresInHours: z.number().int().min(1).max(168).default(24),
});

export const processApprovalSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(500).optional(),
});
