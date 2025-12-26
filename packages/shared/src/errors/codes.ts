/**
 * RADIANT Error Codes
 * 
 * Standardized error codes for consistent API responses across all services.
 * Format: RADIANT_<CATEGORY>_<SPECIFIC_ERROR>
 */

export const ErrorCodes = {
  // Authentication errors (1xxx)
  AUTH_INVALID_TOKEN: 'RADIANT_AUTH_1001',
  AUTH_TOKEN_EXPIRED: 'RADIANT_AUTH_1002',
  AUTH_MISSING_TOKEN: 'RADIANT_AUTH_1003',
  AUTH_INVALID_API_KEY: 'RADIANT_AUTH_1004',
  AUTH_API_KEY_EXPIRED: 'RADIANT_AUTH_1005',
  AUTH_API_KEY_REVOKED: 'RADIANT_AUTH_1006',
  AUTH_INSUFFICIENT_SCOPE: 'RADIANT_AUTH_1007',
  AUTH_MFA_REQUIRED: 'RADIANT_AUTH_1008',
  AUTH_SESSION_EXPIRED: 'RADIANT_AUTH_1009',

  // Authorization errors (2xxx)
  AUTHZ_FORBIDDEN: 'RADIANT_AUTHZ_2001',
  AUTHZ_TENANT_MISMATCH: 'RADIANT_AUTHZ_2002',
  AUTHZ_ROLE_REQUIRED: 'RADIANT_AUTHZ_2003',
  AUTHZ_PERMISSION_DENIED: 'RADIANT_AUTHZ_2004',
  AUTHZ_RESOURCE_ACCESS_DENIED: 'RADIANT_AUTHZ_2005',
  AUTHZ_TIER_INSUFFICIENT: 'RADIANT_AUTHZ_2006',

  // Validation errors (3xxx)
  VALIDATION_REQUIRED_FIELD: 'RADIANT_VAL_3001',
  VALIDATION_INVALID_FORMAT: 'RADIANT_VAL_3002',
  VALIDATION_OUT_OF_RANGE: 'RADIANT_VAL_3003',
  VALIDATION_INVALID_TYPE: 'RADIANT_VAL_3004',
  VALIDATION_CONSTRAINT_VIOLATION: 'RADIANT_VAL_3005',
  VALIDATION_SCHEMA_MISMATCH: 'RADIANT_VAL_3006',
  VALIDATION_INVALID_JSON: 'RADIANT_VAL_3007',
  VALIDATION_MAX_LENGTH_EXCEEDED: 'RADIANT_VAL_3008',
  VALIDATION_MIN_LENGTH_REQUIRED: 'RADIANT_VAL_3009',

  // Resource errors (4xxx)
  RESOURCE_NOT_FOUND: 'RADIANT_RES_4001',
  RESOURCE_ALREADY_EXISTS: 'RADIANT_RES_4002',
  RESOURCE_DELETED: 'RADIANT_RES_4003',
  RESOURCE_LOCKED: 'RADIANT_RES_4004',
  RESOURCE_CONFLICT: 'RADIANT_RES_4005',
  RESOURCE_QUOTA_EXCEEDED: 'RADIANT_RES_4006',

  // Rate limiting errors (5xxx)
  RATE_LIMIT_EXCEEDED: 'RADIANT_RATE_5001',
  RATE_LIMIT_TENANT: 'RADIANT_RATE_5002',
  RATE_LIMIT_USER: 'RADIANT_RATE_5003',
  RATE_LIMIT_API_KEY: 'RADIANT_RATE_5004',
  RATE_LIMIT_MODEL: 'RADIANT_RATE_5005',
  RATE_LIMIT_BURST: 'RADIANT_RATE_5006',

  // AI/Model errors (6xxx)
  AI_MODEL_NOT_FOUND: 'RADIANT_AI_6001',
  AI_MODEL_UNAVAILABLE: 'RADIANT_AI_6002',
  AI_MODEL_OVERLOADED: 'RADIANT_AI_6003',
  AI_PROVIDER_ERROR: 'RADIANT_AI_6004',
  AI_CONTEXT_TOO_LONG: 'RADIANT_AI_6005',
  AI_CONTENT_FILTERED: 'RADIANT_AI_6006',
  AI_INVALID_REQUEST: 'RADIANT_AI_6007',
  AI_STREAMING_ERROR: 'RADIANT_AI_6008',
  AI_TIMEOUT: 'RADIANT_AI_6009',
  AI_THERMAL_COLD: 'RADIANT_AI_6010',

  // Billing errors (7xxx)
  BILLING_INSUFFICIENT_CREDITS: 'RADIANT_BILL_7001',
  BILLING_PAYMENT_REQUIRED: 'RADIANT_BILL_7002',
  BILLING_PAYMENT_FAILED: 'RADIANT_BILL_7003',
  BILLING_SUBSCRIPTION_EXPIRED: 'RADIANT_BILL_7004',
  BILLING_SUBSCRIPTION_CANCELLED: 'RADIANT_BILL_7005',
  BILLING_INVALID_COUPON: 'RADIANT_BILL_7006',
  BILLING_QUOTA_EXCEEDED: 'RADIANT_BILL_7007',

  // Storage errors (8xxx)
  STORAGE_QUOTA_EXCEEDED: 'RADIANT_STOR_8001',
  STORAGE_FILE_TOO_LARGE: 'RADIANT_STOR_8002',
  STORAGE_INVALID_FILE_TYPE: 'RADIANT_STOR_8003',
  STORAGE_UPLOAD_FAILED: 'RADIANT_STOR_8004',
  STORAGE_FILE_NOT_FOUND: 'RADIANT_STOR_8005',

  // Internal errors (9xxx)
  INTERNAL_ERROR: 'RADIANT_INT_9001',
  INTERNAL_DATABASE_ERROR: 'RADIANT_INT_9002',
  INTERNAL_CACHE_ERROR: 'RADIANT_INT_9003',
  INTERNAL_QUEUE_ERROR: 'RADIANT_INT_9004',
  INTERNAL_SERVICE_UNAVAILABLE: 'RADIANT_INT_9005',
  INTERNAL_DEPENDENCY_FAILURE: 'RADIANT_INT_9006',
  INTERNAL_CONFIGURATION_ERROR: 'RADIANT_INT_9007',
  INTERNAL_TIMEOUT: 'RADIANT_INT_9008',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Error code metadata for documentation and client handling
 */
export const ErrorCodeMetadata: Record<ErrorCode, {
  httpStatus: number;
  category: string;
  retryable: boolean;
  userMessage: string;
}> = {
  // Auth errors
  [ErrorCodes.AUTH_INVALID_TOKEN]: {
    httpStatus: 401,
    category: 'authentication',
    retryable: false,
    userMessage: 'Invalid authentication token. Please sign in again.',
  },
  [ErrorCodes.AUTH_TOKEN_EXPIRED]: {
    httpStatus: 401,
    category: 'authentication',
    retryable: false,
    userMessage: 'Your session has expired. Please sign in again.',
  },
  [ErrorCodes.AUTH_MISSING_TOKEN]: {
    httpStatus: 401,
    category: 'authentication',
    retryable: false,
    userMessage: 'Authentication required. Please sign in.',
  },
  [ErrorCodes.AUTH_INVALID_API_KEY]: {
    httpStatus: 401,
    category: 'authentication',
    retryable: false,
    userMessage: 'Invalid API key. Please check your credentials.',
  },
  [ErrorCodes.AUTH_API_KEY_EXPIRED]: {
    httpStatus: 401,
    category: 'authentication',
    retryable: false,
    userMessage: 'API key has expired. Please generate a new one.',
  },
  [ErrorCodes.AUTH_API_KEY_REVOKED]: {
    httpStatus: 401,
    category: 'authentication',
    retryable: false,
    userMessage: 'API key has been revoked.',
  },
  [ErrorCodes.AUTH_INSUFFICIENT_SCOPE]: {
    httpStatus: 403,
    category: 'authentication',
    retryable: false,
    userMessage: 'API key does not have required permissions.',
  },
  [ErrorCodes.AUTH_MFA_REQUIRED]: {
    httpStatus: 401,
    category: 'authentication',
    retryable: false,
    userMessage: 'Multi-factor authentication required.',
  },
  [ErrorCodes.AUTH_SESSION_EXPIRED]: {
    httpStatus: 401,
    category: 'authentication',
    retryable: false,
    userMessage: 'Session expired. Please sign in again.',
  },

  // Authorization errors
  [ErrorCodes.AUTHZ_FORBIDDEN]: {
    httpStatus: 403,
    category: 'authorization',
    retryable: false,
    userMessage: 'You do not have permission to perform this action.',
  },
  [ErrorCodes.AUTHZ_TENANT_MISMATCH]: {
    httpStatus: 403,
    category: 'authorization',
    retryable: false,
    userMessage: 'Access denied to this resource.',
  },
  [ErrorCodes.AUTHZ_ROLE_REQUIRED]: {
    httpStatus: 403,
    category: 'authorization',
    retryable: false,
    userMessage: 'Insufficient role permissions.',
  },
  [ErrorCodes.AUTHZ_PERMISSION_DENIED]: {
    httpStatus: 403,
    category: 'authorization',
    retryable: false,
    userMessage: 'Permission denied.',
  },
  [ErrorCodes.AUTHZ_RESOURCE_ACCESS_DENIED]: {
    httpStatus: 403,
    category: 'authorization',
    retryable: false,
    userMessage: 'You cannot access this resource.',
  },
  [ErrorCodes.AUTHZ_TIER_INSUFFICIENT]: {
    httpStatus: 403,
    category: 'authorization',
    retryable: false,
    userMessage: 'This feature requires a higher subscription tier.',
  },

  // Validation errors
  [ErrorCodes.VALIDATION_REQUIRED_FIELD]: {
    httpStatus: 400,
    category: 'validation',
    retryable: false,
    userMessage: 'Required field is missing.',
  },
  [ErrorCodes.VALIDATION_INVALID_FORMAT]: {
    httpStatus: 400,
    category: 'validation',
    retryable: false,
    userMessage: 'Invalid field format.',
  },
  [ErrorCodes.VALIDATION_OUT_OF_RANGE]: {
    httpStatus: 400,
    category: 'validation',
    retryable: false,
    userMessage: 'Value is out of allowed range.',
  },
  [ErrorCodes.VALIDATION_INVALID_TYPE]: {
    httpStatus: 400,
    category: 'validation',
    retryable: false,
    userMessage: 'Invalid data type.',
  },
  [ErrorCodes.VALIDATION_CONSTRAINT_VIOLATION]: {
    httpStatus: 400,
    category: 'validation',
    retryable: false,
    userMessage: 'Data constraint violation.',
  },
  [ErrorCodes.VALIDATION_SCHEMA_MISMATCH]: {
    httpStatus: 400,
    category: 'validation',
    retryable: false,
    userMessage: 'Request does not match expected format.',
  },
  [ErrorCodes.VALIDATION_INVALID_JSON]: {
    httpStatus: 400,
    category: 'validation',
    retryable: false,
    userMessage: 'Invalid JSON in request body.',
  },
  [ErrorCodes.VALIDATION_MAX_LENGTH_EXCEEDED]: {
    httpStatus: 400,
    category: 'validation',
    retryable: false,
    userMessage: 'Field exceeds maximum length.',
  },
  [ErrorCodes.VALIDATION_MIN_LENGTH_REQUIRED]: {
    httpStatus: 400,
    category: 'validation',
    retryable: false,
    userMessage: 'Field is too short.',
  },

  // Resource errors
  [ErrorCodes.RESOURCE_NOT_FOUND]: {
    httpStatus: 404,
    category: 'resource',
    retryable: false,
    userMessage: 'Resource not found.',
  },
  [ErrorCodes.RESOURCE_ALREADY_EXISTS]: {
    httpStatus: 409,
    category: 'resource',
    retryable: false,
    userMessage: 'Resource already exists.',
  },
  [ErrorCodes.RESOURCE_DELETED]: {
    httpStatus: 410,
    category: 'resource',
    retryable: false,
    userMessage: 'Resource has been deleted.',
  },
  [ErrorCodes.RESOURCE_LOCKED]: {
    httpStatus: 423,
    category: 'resource',
    retryable: true,
    userMessage: 'Resource is temporarily locked. Please try again.',
  },
  [ErrorCodes.RESOURCE_CONFLICT]: {
    httpStatus: 409,
    category: 'resource',
    retryable: true,
    userMessage: 'Conflict with current resource state.',
  },
  [ErrorCodes.RESOURCE_QUOTA_EXCEEDED]: {
    httpStatus: 429,
    category: 'resource',
    retryable: false,
    userMessage: 'Resource quota exceeded.',
  },

  // Rate limiting errors
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: {
    httpStatus: 429,
    category: 'rate_limit',
    retryable: true,
    userMessage: 'Too many requests. Please slow down.',
  },
  [ErrorCodes.RATE_LIMIT_TENANT]: {
    httpStatus: 429,
    category: 'rate_limit',
    retryable: true,
    userMessage: 'Organization rate limit exceeded.',
  },
  [ErrorCodes.RATE_LIMIT_USER]: {
    httpStatus: 429,
    category: 'rate_limit',
    retryable: true,
    userMessage: 'User rate limit exceeded.',
  },
  [ErrorCodes.RATE_LIMIT_API_KEY]: {
    httpStatus: 429,
    category: 'rate_limit',
    retryable: true,
    userMessage: 'API key rate limit exceeded.',
  },
  [ErrorCodes.RATE_LIMIT_MODEL]: {
    httpStatus: 429,
    category: 'rate_limit',
    retryable: true,
    userMessage: 'Model rate limit exceeded. Try a different model.',
  },
  [ErrorCodes.RATE_LIMIT_BURST]: {
    httpStatus: 429,
    category: 'rate_limit',
    retryable: true,
    userMessage: 'Burst limit exceeded. Please wait a moment.',
  },

  // AI errors
  [ErrorCodes.AI_MODEL_NOT_FOUND]: {
    httpStatus: 404,
    category: 'ai',
    retryable: false,
    userMessage: 'Model not found or not available.',
  },
  [ErrorCodes.AI_MODEL_UNAVAILABLE]: {
    httpStatus: 503,
    category: 'ai',
    retryable: true,
    userMessage: 'Model is temporarily unavailable.',
  },
  [ErrorCodes.AI_MODEL_OVERLOADED]: {
    httpStatus: 503,
    category: 'ai',
    retryable: true,
    userMessage: 'Model is overloaded. Please try again.',
  },
  [ErrorCodes.AI_PROVIDER_ERROR]: {
    httpStatus: 502,
    category: 'ai',
    retryable: true,
    userMessage: 'AI provider error. Retrying may help.',
  },
  [ErrorCodes.AI_CONTEXT_TOO_LONG]: {
    httpStatus: 400,
    category: 'ai',
    retryable: false,
    userMessage: 'Input exceeds model context limit.',
  },
  [ErrorCodes.AI_CONTENT_FILTERED]: {
    httpStatus: 400,
    category: 'ai',
    retryable: false,
    userMessage: 'Content was filtered by safety systems.',
  },
  [ErrorCodes.AI_INVALID_REQUEST]: {
    httpStatus: 400,
    category: 'ai',
    retryable: false,
    userMessage: 'Invalid AI request parameters.',
  },
  [ErrorCodes.AI_STREAMING_ERROR]: {
    httpStatus: 500,
    category: 'ai',
    retryable: true,
    userMessage: 'Streaming error occurred.',
  },
  [ErrorCodes.AI_TIMEOUT]: {
    httpStatus: 504,
    category: 'ai',
    retryable: true,
    userMessage: 'Request timed out. Please try again.',
  },
  [ErrorCodes.AI_THERMAL_COLD]: {
    httpStatus: 503,
    category: 'ai',
    retryable: true,
    userMessage: 'Model is warming up. Please wait a moment.',
  },

  // Billing errors
  [ErrorCodes.BILLING_INSUFFICIENT_CREDITS]: {
    httpStatus: 402,
    category: 'billing',
    retryable: false,
    userMessage: 'Insufficient credits. Please add more credits.',
  },
  [ErrorCodes.BILLING_PAYMENT_REQUIRED]: {
    httpStatus: 402,
    category: 'billing',
    retryable: false,
    userMessage: 'Payment required to continue.',
  },
  [ErrorCodes.BILLING_PAYMENT_FAILED]: {
    httpStatus: 402,
    category: 'billing',
    retryable: false,
    userMessage: 'Payment failed. Please update payment method.',
  },
  [ErrorCodes.BILLING_SUBSCRIPTION_EXPIRED]: {
    httpStatus: 402,
    category: 'billing',
    retryable: false,
    userMessage: 'Subscription has expired.',
  },
  [ErrorCodes.BILLING_SUBSCRIPTION_CANCELLED]: {
    httpStatus: 402,
    category: 'billing',
    retryable: false,
    userMessage: 'Subscription has been cancelled.',
  },
  [ErrorCodes.BILLING_INVALID_COUPON]: {
    httpStatus: 400,
    category: 'billing',
    retryable: false,
    userMessage: 'Invalid or expired coupon code.',
  },
  [ErrorCodes.BILLING_QUOTA_EXCEEDED]: {
    httpStatus: 429,
    category: 'billing',
    retryable: false,
    userMessage: 'Usage quota exceeded for billing period.',
  },

  // Storage errors
  [ErrorCodes.STORAGE_QUOTA_EXCEEDED]: {
    httpStatus: 413,
    category: 'storage',
    retryable: false,
    userMessage: 'Storage quota exceeded.',
  },
  [ErrorCodes.STORAGE_FILE_TOO_LARGE]: {
    httpStatus: 413,
    category: 'storage',
    retryable: false,
    userMessage: 'File exceeds maximum size limit.',
  },
  [ErrorCodes.STORAGE_INVALID_FILE_TYPE]: {
    httpStatus: 415,
    category: 'storage',
    retryable: false,
    userMessage: 'File type not supported.',
  },
  [ErrorCodes.STORAGE_UPLOAD_FAILED]: {
    httpStatus: 500,
    category: 'storage',
    retryable: true,
    userMessage: 'Upload failed. Please try again.',
  },
  [ErrorCodes.STORAGE_FILE_NOT_FOUND]: {
    httpStatus: 404,
    category: 'storage',
    retryable: false,
    userMessage: 'File not found.',
  },

  // Internal errors
  [ErrorCodes.INTERNAL_ERROR]: {
    httpStatus: 500,
    category: 'internal',
    retryable: true,
    userMessage: 'An unexpected error occurred.',
  },
  [ErrorCodes.INTERNAL_DATABASE_ERROR]: {
    httpStatus: 500,
    category: 'internal',
    retryable: true,
    userMessage: 'Database error. Please try again.',
  },
  [ErrorCodes.INTERNAL_CACHE_ERROR]: {
    httpStatus: 500,
    category: 'internal',
    retryable: true,
    userMessage: 'Cache error. Please try again.',
  },
  [ErrorCodes.INTERNAL_QUEUE_ERROR]: {
    httpStatus: 500,
    category: 'internal',
    retryable: true,
    userMessage: 'Processing error. Please try again.',
  },
  [ErrorCodes.INTERNAL_SERVICE_UNAVAILABLE]: {
    httpStatus: 503,
    category: 'internal',
    retryable: true,
    userMessage: 'Service temporarily unavailable.',
  },
  [ErrorCodes.INTERNAL_DEPENDENCY_FAILURE]: {
    httpStatus: 502,
    category: 'internal',
    retryable: true,
    userMessage: 'External service error.',
  },
  [ErrorCodes.INTERNAL_CONFIGURATION_ERROR]: {
    httpStatus: 500,
    category: 'internal',
    retryable: false,
    userMessage: 'Configuration error. Please contact support.',
  },
  [ErrorCodes.INTERNAL_TIMEOUT]: {
    httpStatus: 504,
    category: 'internal',
    retryable: true,
    userMessage: 'Request timed out.',
  },
};

/**
 * Get error metadata by code
 */
export function getErrorMetadata(code: ErrorCode) {
  return ErrorCodeMetadata[code] || ErrorCodeMetadata[ErrorCodes.INTERNAL_ERROR];
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(code: ErrorCode): boolean {
  return getErrorMetadata(code).retryable;
}

/**
 * i18n translation keys for error messages
 * These map to the localization registry
 */
export const ErrorTranslationKeys: Record<ErrorCode, string> = {
  // Auth errors
  [ErrorCodes.AUTH_INVALID_TOKEN]: 'error.auth.invalid_token',
  [ErrorCodes.AUTH_TOKEN_EXPIRED]: 'error.auth.token_expired',
  [ErrorCodes.AUTH_MISSING_TOKEN]: 'error.auth.missing_token',
  [ErrorCodes.AUTH_INVALID_API_KEY]: 'error.auth.invalid_api_key',
  [ErrorCodes.AUTH_API_KEY_EXPIRED]: 'error.auth.api_key_expired',
  [ErrorCodes.AUTH_API_KEY_REVOKED]: 'error.auth.api_key_revoked',
  [ErrorCodes.AUTH_INSUFFICIENT_SCOPE]: 'error.auth.insufficient_scope',
  [ErrorCodes.AUTH_MFA_REQUIRED]: 'error.auth.mfa_required',
  [ErrorCodes.AUTH_SESSION_EXPIRED]: 'error.auth.session_expired',
  // Authorization errors
  [ErrorCodes.AUTHZ_FORBIDDEN]: 'error.authz.forbidden',
  [ErrorCodes.AUTHZ_TENANT_MISMATCH]: 'error.authz.tenant_mismatch',
  [ErrorCodes.AUTHZ_ROLE_REQUIRED]: 'error.authz.role_required',
  [ErrorCodes.AUTHZ_PERMISSION_DENIED]: 'error.authz.permission_denied',
  [ErrorCodes.AUTHZ_RESOURCE_ACCESS_DENIED]: 'error.authz.resource_access_denied',
  [ErrorCodes.AUTHZ_TIER_INSUFFICIENT]: 'error.authz.tier_insufficient',
  // Validation errors
  [ErrorCodes.VALIDATION_REQUIRED_FIELD]: 'error.validation.required_field',
  [ErrorCodes.VALIDATION_INVALID_FORMAT]: 'error.validation.invalid_format',
  [ErrorCodes.VALIDATION_OUT_OF_RANGE]: 'error.validation.out_of_range',
  [ErrorCodes.VALIDATION_INVALID_TYPE]: 'error.validation.invalid_type',
  [ErrorCodes.VALIDATION_CONSTRAINT_VIOLATION]: 'error.validation.constraint_violation',
  [ErrorCodes.VALIDATION_SCHEMA_MISMATCH]: 'error.validation.schema_mismatch',
  [ErrorCodes.VALIDATION_INVALID_JSON]: 'error.validation.invalid_json',
  [ErrorCodes.VALIDATION_MAX_LENGTH_EXCEEDED]: 'error.validation.max_length_exceeded',
  [ErrorCodes.VALIDATION_MIN_LENGTH_REQUIRED]: 'error.validation.min_length_required',
  // Resource errors
  [ErrorCodes.RESOURCE_NOT_FOUND]: 'error.resource.not_found',
  [ErrorCodes.RESOURCE_ALREADY_EXISTS]: 'error.resource.already_exists',
  [ErrorCodes.RESOURCE_DELETED]: 'error.resource.deleted',
  [ErrorCodes.RESOURCE_LOCKED]: 'error.resource.locked',
  [ErrorCodes.RESOURCE_CONFLICT]: 'error.resource.conflict',
  [ErrorCodes.RESOURCE_QUOTA_EXCEEDED]: 'error.resource.quota_exceeded',
  // Rate limiting errors
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: 'error.rate_limit.exceeded',
  [ErrorCodes.RATE_LIMIT_TENANT]: 'error.rate_limit.tenant',
  [ErrorCodes.RATE_LIMIT_USER]: 'error.rate_limit.user',
  [ErrorCodes.RATE_LIMIT_API_KEY]: 'error.rate_limit.api_key',
  [ErrorCodes.RATE_LIMIT_MODEL]: 'error.rate_limit.model',
  [ErrorCodes.RATE_LIMIT_BURST]: 'error.rate_limit.burst',
  // AI errors
  [ErrorCodes.AI_MODEL_NOT_FOUND]: 'error.ai.model_not_found',
  [ErrorCodes.AI_MODEL_UNAVAILABLE]: 'error.ai.model_unavailable',
  [ErrorCodes.AI_MODEL_OVERLOADED]: 'error.ai.model_overloaded',
  [ErrorCodes.AI_PROVIDER_ERROR]: 'error.ai.provider_error',
  [ErrorCodes.AI_CONTEXT_TOO_LONG]: 'error.ai.context_too_long',
  [ErrorCodes.AI_CONTENT_FILTERED]: 'error.ai.content_filtered',
  [ErrorCodes.AI_INVALID_REQUEST]: 'error.ai.invalid_request',
  [ErrorCodes.AI_STREAMING_ERROR]: 'error.ai.streaming_error',
  [ErrorCodes.AI_TIMEOUT]: 'error.ai.timeout',
  [ErrorCodes.AI_THERMAL_COLD]: 'error.ai.thermal_cold',
  // Billing errors
  [ErrorCodes.BILLING_INSUFFICIENT_CREDITS]: 'error.billing.insufficient_credits',
  [ErrorCodes.BILLING_PAYMENT_REQUIRED]: 'error.billing.payment_required',
  [ErrorCodes.BILLING_PAYMENT_FAILED]: 'error.billing.payment_failed',
  [ErrorCodes.BILLING_SUBSCRIPTION_EXPIRED]: 'error.billing.subscription_expired',
  [ErrorCodes.BILLING_SUBSCRIPTION_CANCELLED]: 'error.billing.subscription_cancelled',
  [ErrorCodes.BILLING_INVALID_COUPON]: 'error.billing.invalid_coupon',
  [ErrorCodes.BILLING_QUOTA_EXCEEDED]: 'error.billing.quota_exceeded',
  // Storage errors
  [ErrorCodes.STORAGE_QUOTA_EXCEEDED]: 'error.storage.quota_exceeded',
  [ErrorCodes.STORAGE_FILE_TOO_LARGE]: 'error.storage.file_too_large',
  [ErrorCodes.STORAGE_INVALID_FILE_TYPE]: 'error.storage.invalid_file_type',
  [ErrorCodes.STORAGE_UPLOAD_FAILED]: 'error.storage.upload_failed',
  [ErrorCodes.STORAGE_FILE_NOT_FOUND]: 'error.storage.file_not_found',
  // Internal errors
  [ErrorCodes.INTERNAL_ERROR]: 'error.internal.error',
  [ErrorCodes.INTERNAL_DATABASE_ERROR]: 'error.internal.database_error',
  [ErrorCodes.INTERNAL_CACHE_ERROR]: 'error.internal.cache_error',
  [ErrorCodes.INTERNAL_QUEUE_ERROR]: 'error.internal.queue_error',
  [ErrorCodes.INTERNAL_SERVICE_UNAVAILABLE]: 'error.internal.service_unavailable',
  [ErrorCodes.INTERNAL_DEPENDENCY_FAILURE]: 'error.internal.dependency_failure',
  [ErrorCodes.INTERNAL_CONFIGURATION_ERROR]: 'error.internal.configuration_error',
  [ErrorCodes.INTERNAL_TIMEOUT]: 'error.internal.timeout',
};

/**
 * Get the i18n translation key for an error code
 */
export function getErrorTranslationKey(code: ErrorCode): string {
  return ErrorTranslationKeys[code] || ErrorTranslationKeys[ErrorCodes.INTERNAL_ERROR];
}
