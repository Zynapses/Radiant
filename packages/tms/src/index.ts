/**
 * RADIANT TMS - Tenant Management Service
 * Main entry point for package exports
 */

// Types
export * from './types/tenant.types';

// Services
export { tenantService } from './services/tenant.service';
export { notificationService } from './services/notification.service';

// Handlers
export { handler as createTenantHandler } from './handlers/create-tenant';
export { handler as getTenantHandler } from './handlers/get-tenant';
export { handler as updateTenantHandler } from './handlers/update-tenant';
export { handler as deleteTenantHandler } from './handlers/delete-tenant';
export { handler as restoreTenantHandler, requestCodeHandler as requestRestoreCodeHandler } from './handlers/restore-tenant';
export { handler as phantomTenantHandler } from './handlers/phantom-tenant';
export { handler as listTenantsHandler } from './handlers/list-tenants';
export {
  listMembershipsHandler,
  addMembershipHandler,
  updateMembershipHandler,
  removeMembershipHandler,
} from './handlers/memberships';
export {
  hardDeleteJobHandler,
  deletionNotificationJobHandler,
  orphanCheckJobHandler,
  complianceReportJobHandler,
} from './handlers/scheduled-jobs';

// Utilities
export { logger, createChildLogger } from './utils/logger';
export {
  executeStatement,
  executeStatementSingle,
  withTransaction,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  setTenantContext,
  clearTenantContext,
  param,
  jsonParam,
  uuidParam,
  timestampParam,
} from './utils/db';
export {
  extractContext,
  getCorsHeaders,
  validateUUID,
  errorResponse,
  successResponse,
} from './utils/context';
