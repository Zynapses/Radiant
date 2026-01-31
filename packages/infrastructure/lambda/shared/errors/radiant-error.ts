/**
 * RADIANT Error Classes with i18n Support
 * 
 * Standardized error handling that integrates with the localization system.
 */

// Error codes are duplicated here to avoid cross-package import issues in Lambda
// These must be kept in sync with @radiant/shared/errors/codes

export const ErrorCodes = {
  AUTH_INVALID_TOKEN: 'RADIANT_AUTH_1001',
  AUTH_TOKEN_EXPIRED: 'RADIANT_AUTH_1002',
  AUTH_MISSING_TOKEN: 'RADIANT_AUTH_1003',
  AUTH_INVALID_API_KEY: 'RADIANT_AUTH_1004',
  AUTH_INSUFFICIENT_SCOPE: 'RADIANT_AUTH_1007',
  AUTHZ_FORBIDDEN: 'RADIANT_AUTHZ_2001',
  AUTHZ_PERMISSION_DENIED: 'RADIANT_AUTHZ_2004',
  AUTHZ_TIER_INSUFFICIENT: 'RADIANT_AUTHZ_2006',
  VALIDATION_REQUIRED_FIELD: 'RADIANT_VAL_3001',
  VALIDATION_INVALID_FORMAT: 'RADIANT_VAL_3002',
  RESOURCE_NOT_FOUND: 'RADIANT_RES_4001',
  RESOURCE_ALREADY_EXISTS: 'RADIANT_RES_4002',
  RESOURCE_LOCKED: 'RADIANT_RES_4004',
  RATE_LIMIT_EXCEEDED: 'RADIANT_RATE_5001',
  AI_MODEL_NOT_FOUND: 'RADIANT_AI_6001',
  AI_MODEL_UNAVAILABLE: 'RADIANT_AI_6002',
  AI_PROVIDER_ERROR: 'RADIANT_AI_6004',
  AI_TIMEOUT: 'RADIANT_AI_6009',
  BILLING_INSUFFICIENT_CREDITS: 'RADIANT_BILL_7001',
  BILLING_PAYMENT_REQUIRED: 'RADIANT_BILL_7002',
  INTERNAL_ERROR: 'RADIANT_INT_9001',
  INTERNAL_DATABASE_ERROR: 'RADIANT_INT_9002',
  INTERNAL_CONFIGURATION_ERROR: 'RADIANT_INT_9007',
  INTERNAL_TIMEOUT: 'RADIANT_INT_9008',
} as const;

export type ErrorCode = string;

const ErrorMetadata: Record<string, { httpStatus: number; category: string; retryable: boolean; userMessage: string }> = {
  [ErrorCodes.AUTH_INVALID_TOKEN]: { httpStatus: 401, category: 'auth', retryable: false, userMessage: 'Invalid authentication token' },
  [ErrorCodes.AUTH_TOKEN_EXPIRED]: { httpStatus: 401, category: 'auth', retryable: false, userMessage: 'Session expired' },
  [ErrorCodes.AUTH_MISSING_TOKEN]: { httpStatus: 401, category: 'auth', retryable: false, userMessage: 'Authentication required' },
  [ErrorCodes.AUTHZ_FORBIDDEN]: { httpStatus: 403, category: 'authz', retryable: false, userMessage: 'Permission denied' },
  [ErrorCodes.VALIDATION_REQUIRED_FIELD]: { httpStatus: 400, category: 'validation', retryable: false, userMessage: 'Required field missing' },
  [ErrorCodes.RESOURCE_NOT_FOUND]: { httpStatus: 404, category: 'resource', retryable: false, userMessage: 'Resource not found' },
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: { httpStatus: 429, category: 'rate_limit', retryable: true, userMessage: 'Rate limit exceeded' },
  [ErrorCodes.AI_PROVIDER_ERROR]: { httpStatus: 502, category: 'ai', retryable: true, userMessage: 'AI provider error' },
  [ErrorCodes.AI_TIMEOUT]: { httpStatus: 504, category: 'ai', retryable: true, userMessage: 'Request timed out' },
  [ErrorCodes.BILLING_INSUFFICIENT_CREDITS]: { httpStatus: 402, category: 'billing', retryable: false, userMessage: 'Insufficient credits' },
  [ErrorCodes.INTERNAL_ERROR]: { httpStatus: 500, category: 'internal', retryable: true, userMessage: 'An unexpected error occurred' },
  [ErrorCodes.INTERNAL_DATABASE_ERROR]: { httpStatus: 500, category: 'internal', retryable: true, userMessage: 'Database error' },
  [ErrorCodes.INTERNAL_CONFIGURATION_ERROR]: { httpStatus: 500, category: 'internal', retryable: false, userMessage: 'Configuration error' },
};

function getErrorMetadata(code: ErrorCode) {
  return ErrorMetadata[code] || ErrorMetadata[ErrorCodes.INTERNAL_ERROR];
}

function getErrorTranslationKey(code: ErrorCode): string {
  const category = code.split('_')[1]?.toLowerCase() || 'internal';
  const name = code.split('_').slice(2).join('_').toLowerCase() || 'error';
  return `error.${category}.${name}`;
}

export interface RadiantErrorOptions {
  code: ErrorCode;
  message?: string;
  details?: Record<string, unknown>;
  cause?: Error;
  field?: string;
  resourceType?: string;
  resourceId?: string;
}

/**
 * Base error class for all RADIANT errors
 * Supports i18n translations and structured error data
 */
export class RadiantError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly category: string;
  public readonly retryable: boolean;
  public readonly details: Record<string, unknown>;
  public readonly field?: string;
  public readonly resourceType?: string;
  public readonly resourceId?: string;
  public readonly translationKey: string;
  public readonly timestamp: string;
  public readonly requestId?: string;
  public override cause?: Error;

  constructor(options: RadiantErrorOptions) {
    const metadata = getErrorMetadata(options.code);
    super(options.message || metadata.userMessage);
    
    this.name = 'RadiantError';
    this.code = options.code;
    this.httpStatus = metadata.httpStatus;
    this.category = metadata.category;
    this.retryable = metadata.retryable;
    this.details = options.details || {};
    this.field = options.field;
    this.resourceType = options.resourceType;
    this.resourceId = options.resourceId;
    this.translationKey = getErrorTranslationKey(options.code);
    this.timestamp = new Date().toISOString();
    
    if (options.cause) {
      this.cause = options.cause;
    }

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Get localized error message for a specific language
   */
  async getLocalizedMessage(languageCode: string): Promise<string> {
    try {
      // Lazy import to avoid circular dependency
      const { localizationService } = await import('../services/localization.js');
      const translation = await localizationService.getTranslation(
        this.translationKey, 
        languageCode
      );
      
      // Replace placeholders in translation
      let localizedMessage = translation;
      for (const [key, value] of Object.entries(this.details)) {
        localizedMessage = localizedMessage.replace(`{${key}}`, String(value));
      }
      
      return localizedMessage;
    } catch (translationError) {
      // Fallback to default message if translation fails
      console.debug('Translation failed, using default message:', translationError instanceof Error ? translationError.message : 'unknown');
      return this.message;
    }
  }

  /**
   * Convert to API response format
   */
  toResponse(requestId?: string, languageCode?: string): {
    error: {
      code: string;
      message: string;
      details?: Record<string, unknown>;
      field?: string;
      resourceType?: string;
      resourceId?: string;
      retryable: boolean;
      timestamp: string;
      requestId?: string;
    };
  } {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: Object.keys(this.details).length > 0 ? this.details : undefined,
        field: this.field,
        resourceType: this.resourceType,
        resourceId: this.resourceId,
        retryable: this.retryable,
        timestamp: this.timestamp,
        requestId: requestId || this.requestId,
      },
    };
  }

  /**
   * Convert to API response format with localized message
   */
  async toLocalizedResponse(
    languageCode: string,
    requestId?: string
  ): Promise<ReturnType<typeof this.toResponse>> {
    const localizedMessage = await this.getLocalizedMessage(languageCode);
    return {
      error: {
        ...this.toResponse(requestId).error,
        message: localizedMessage,
      },
    };
  }
}

// Convenience error factory functions

export function authError(
  code: ErrorCode = ErrorCodes.AUTH_INVALID_TOKEN,
  message?: string,
  details?: Record<string, unknown>
): RadiantError {
  return new RadiantError({ code, message, details });
}

export function validationError(
  field: string,
  message?: string,
  code: ErrorCode = ErrorCodes.VALIDATION_REQUIRED_FIELD
): RadiantError {
  return new RadiantError({ code, message, field, details: { field } });
}

export function resourceNotFoundError(
  resourceType: string,
  resourceId: string
): RadiantError {
  return new RadiantError({
    code: ErrorCodes.RESOURCE_NOT_FOUND,
    resourceType,
    resourceId,
    details: { resourceType, resourceId },
    message: `${resourceType} not found: ${resourceId}`,
  });
}

export function rateLimitError(
  code: ErrorCode = ErrorCodes.RATE_LIMIT_EXCEEDED,
  retryAfter?: number
): RadiantError {
  return new RadiantError({
    code,
    details: retryAfter ? { retryAfter } : {},
  });
}

export function aiError(
  code: ErrorCode = ErrorCodes.AI_PROVIDER_ERROR,
  message?: string,
  provider?: string
): RadiantError {
  return new RadiantError({
    code,
    message,
    details: provider ? { provider } : {},
  });
}

export function billingError(
  code: ErrorCode = ErrorCodes.BILLING_INSUFFICIENT_CREDITS,
  details?: Record<string, unknown>
): RadiantError {
  return new RadiantError({ code, details });
}

export function internalError(
  message?: string,
  cause?: Error
): RadiantError {
  return new RadiantError({
    code: ErrorCodes.INTERNAL_ERROR,
    message: message || 'An unexpected error occurred',
    cause,
  });
}

/**
 * Check if an error is a RadiantError
 */
export function isRadiantError(error: unknown): error is RadiantError {
  return error instanceof RadiantError;
}

/**
 * Convert any error to a RadiantError
 */
export function toRadiantError(error: unknown): RadiantError {
  if (isRadiantError(error)) {
    return error;
  }
  
  if (error instanceof Error) {
    return new RadiantError({
      code: ErrorCodes.INTERNAL_ERROR,
      message: error.message,
      cause: error,
    });
  }
  
  return new RadiantError({
    code: ErrorCodes.INTERNAL_ERROR,
    message: String(error),
  });
}
