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

// Request context (request ID propagation)
export * from './request-context';

// Input sanitization
export * from './input-sanitization';

// Standardized error responses
export * from './error-response';

// Safe JSON utilities (with Zod schema validation)
export {
  safeJsonParse as safeJson,
  safeJsonParseResult,
  parseJsonWithSchema,
  parseJsonWithSchemaOrThrow,
  parseEventBody,
  parseJsonField,
  safeJsonStringify,
} from './safe-json';
export type { SafeParseResult } from './safe-json';

// Date/time utilities (UTC-first)
export {
  utcNow,
  unixTimestamp,
  unixTimestampMs,
  parseToUtc,
  toUtcIsoString,
  toDbTimestamp,
  fromDbTimestamp,
  startOfDayUtc,
} from './datetime';

// Circuit breaker for external service calls
export { CircuitBreaker, CircuitBreakerStats } from './circuit-breaker';

// Nullish value utilities (null/undefined standardization)
export {
  isNullish,
  isNotNullish,
  nullToUndefined,
  undefinedToNull,
  withDefault,
  withDefaultLazy,
  mapNullish,
  filterNullish,
  sanitizeDbRow,
  omitUndefined,
  omitUndefinedDeep,
  assertNotNullish,
  coalesce,
} from './nullish';
