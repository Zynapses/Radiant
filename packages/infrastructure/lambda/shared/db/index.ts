export * from './client';
export * from './types';
export * from './typed-query';
export * from './field-guards';
export * from './centralized-pool';
// Note: pool-manager.ts is deprecated in favor of centralized-pool.ts
// Import directly from pool-manager if legacy support needed

import { poolQuery, poolTransaction, getPoolClient } from './centralized-pool';

/**
 * Legacy compatibility wrapper - returns a db client interface
 * that matches the old pg Pool interface for existing code
 */
export function getDbClient() {
  return {
    query: async <T = Record<string, unknown>>(text: string, values?: unknown[]) => {
      return poolQuery<T>(text, values);
    },
    connect: getPoolClient,
    transaction: poolTransaction,
  };
}

/**
 * Alias for backward compatibility
 */
export const query = async <T = Record<string, unknown>>(text: string, values?: unknown[]) => {
  return poolQuery<T>(text, values);
};

export const transaction = poolTransaction;

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
