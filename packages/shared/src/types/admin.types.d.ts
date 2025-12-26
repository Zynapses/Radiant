/**
 * RADIANT v4.18.0 - Administrator Types
 * SINGLE SOURCE OF TRUTH
 */
import type { Environment } from './environment.types';
export interface Administrator {
    id: string;
    cognitoUserId: string;
    email: string;
    firstName: string;
    lastName: string;
    displayName: string;
    role: AdminRole;
    appId: string;
    tenantId: string;
    mfaEnabled: boolean;
    mfaMethod?: 'totp' | 'sms';
    status: AdminStatus;
    profile: AdminProfile;
    createdAt: Date;
    updatedAt: Date;
    createdBy?: string;
    lastLoginAt?: Date;
}
export type AdminRole = 'super_admin' | 'admin' | 'operator' | 'auditor';
export type AdminStatus = 'active' | 'inactive' | 'suspended' | 'pending';
export interface AdminRolePermissions {
    canManageAdmins: boolean;
    canManageModels: boolean;
    canManageProviders: boolean;
    canManageBilling: boolean;
    canDeploy: boolean;
    canApprove: boolean;
    canViewAuditLogs: boolean;
}
export declare const ROLE_PERMISSIONS: Record<AdminRole, AdminRolePermissions>;
export interface AdminProfile {
    timezone: string;
    language: string;
    dateFormat: string;
    timeFormat: string;
    currency: string;
    notifications: NotificationPreferences;
    ui: UIPreferences;
}
export interface NotificationPreferences {
    emailAlerts: boolean;
    slackAlerts: boolean;
    smsAlerts: boolean;
    alertTypes: string[];
}
export interface UIPreferences {
    theme: 'light' | 'dark' | 'system';
    sidebarCollapsed: boolean;
    defaultEnvironment: Environment;
    tableRowsPerPage: number;
}
export interface Invitation {
    id: string;
    email: string;
    role: AdminRole;
    invitedBy: string;
    appId: string;
    tenantId: string;
    environment?: Environment;
    tokenHash: string;
    expiresAt: Date;
    status: InvitationStatus;
    message?: string;
    createdAt: Date;
    acceptedAt?: Date;
}
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
export interface ApprovalRequest {
    id: string;
    type: ApprovalType;
    action: string;
    targetId: string;
    targetType: string;
    requestedBy: string;
    appId: string;
    tenantId: string;
    environment: Environment;
    status: ApprovalStatus;
    details: Record<string, unknown>;
    requiredApprovers: number;
    approvals: ApprovalVote[];
    expiresAt: Date;
    createdAt: Date;
    completedAt?: Date;
}
export type ApprovalType = 'deployment' | 'promotion' | 'config_change' | 'admin_action';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export interface ApprovalVote {
    adminId: string;
    vote: 'approve' | 'reject';
    comment?: string;
    votedAt: Date;
}
//# sourceMappingURL=admin.types.d.ts.map