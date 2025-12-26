"use strict";
/**
 * RADIANT v4.17.0 - Administrator Types
 * SINGLE SOURCE OF TRUTH
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_PERMISSIONS = void 0;
exports.ROLE_PERMISSIONS = {
    super_admin: {
        canManageAdmins: true,
        canManageModels: true,
        canManageProviders: true,
        canManageBilling: true,
        canDeploy: true,
        canApprove: true,
        canViewAuditLogs: true,
    },
    admin: {
        canManageAdmins: true,
        canManageModels: true,
        canManageProviders: true,
        canManageBilling: true,
        canDeploy: true,
        canApprove: true,
        canViewAuditLogs: true,
    },
    operator: {
        canManageAdmins: false,
        canManageModels: true,
        canManageProviders: true,
        canManageBilling: false,
        canDeploy: true,
        canApprove: false,
        canViewAuditLogs: false,
    },
    auditor: {
        canManageAdmins: false,
        canManageModels: false,
        canManageProviders: false,
        canManageBilling: false,
        canDeploy: false,
        canApprove: false,
        canViewAuditLogs: true,
    },
};
//# sourceMappingURL=admin.types.js.map