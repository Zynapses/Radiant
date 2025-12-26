export * from './client';
export * from './types';
export * from './typed-query';
export * from './field-guards';
export * from './centralized-pool';
// Note: pool-manager.ts is deprecated in favor of centralized-pool.ts
// Import directly from pool-manager if legacy support needed

export {
  getTenantById,
  getTenantByDomain,
  listTenants,
  createTenant,
  getUserById,
  getUserByCognitoId,
  listUsersByTenant,
  getAdministratorById,
  getAdministratorByCognitoId,
  listAdministrators,
  getProviderById,
  listProviders,
  updateProviderHealth,
  getModelById,
  getModelByName,
  listModels,
  recordUsageEvent,
  getUsageStats,
  createAuditLog,
  listAuditLogs,
  getInvitationByToken,
  listPendingInvitations,
  getApprovalRequestById,
  listPendingApprovalRequests,
} from './queries';
