/**
 * Shared utilities index
 * Re-exports all utilities for convenient imports
 */

// Parsing utilities
export {
  safeJsonParse,
  parseJsonOrDefault,
  parseJsonOrThrow,
  safeParseInt,
  safeParseFloat,
  parsePagination,
  parseBoolean,
  safeParseDate,
  parseEnum,
  parseStringArray,
  validateBodySize,
} from './parsing';

// Request utilities
export {
  parseRequest,
  successResponse,
  errorResponse,
  errors,
  withErrorHandling,
  getPathParam,
  getQueryParam,
  getQueryParamInt,
} from './request';
export type { ParsedRequest, RequestParseOptions } from './request';

// Retry and timeout utilities
export {
  withRetry,
  withTimeout,
  fetchWithTimeout,
  isRetryableError,
  isRetryableHttpStatus,
  TimeoutError,
  RetryError,
} from './retry';
export type { RetryOptions } from './retry';

// ID generation utilities
export {
  generateId,
  generateTenantId,
  generateUserId,
  generateApiKeyId,
  generateSessionId,
  generateRequestId,
  generateNotificationId,
  generateAuditId,
  generateWebhookId,
  generateInvitationId,
  generateModelId,
  generateConversationId,
  generateMessageId,
  generateScheduleId,
  generateAlertId,
  generateShortId,
  isValidId,
} from './ids';

// Validation schemas
export {
  paginationSchema,
  uuidSchema,
  emailSchema,
  tenantIdSchema,
  apiKeySchema,
  createTenantSchema,
  updateTenantSchema,
  createModelSchema,
  updateModelSchema,
  chatMessageSchema,
  chatCompletionSchema,
  createWebhookSchema,
  createCostAlertSchema,
  createScheduleSchema,
  validateBody,
  validateQuery,
} from './validation';
