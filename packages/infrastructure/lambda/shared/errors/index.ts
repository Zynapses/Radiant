/**
 * RADIANT v4.18.0 - Unified Error Module
 * 
 * Export all error types from a single location for consistency.
 * Use RadiantError for new code; AppError classes for legacy compatibility.
 */

// Import for internal use
import { RadiantError, isRadiantError as _isRadiantError } from './radiant-error';
import { AppError, isOperationalError as _isOperationalError } from '../errors';

// Export RadiantError and related utilities
export {
  RadiantError,
  ErrorCodes,
  type ErrorCode,
  type RadiantErrorOptions,
  authError,
  validationError,
  resourceNotFoundError,
  rateLimitError,
  aiError,
  billingError,
  internalError,
  isRadiantError,
  toRadiantError,
} from './radiant-error';

// Re-export legacy AppError classes for backward compatibility
export {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  InternalError,
  ProviderError,
  ServiceUnavailableError,
  isOperationalError,
  toAppError,
  // Domain-specific errors
  ModelNotFoundError,
  TenantNotFoundError,
  UserNotFoundError,
  TeamLimitExceededError,
  CredentialNotFoundError,
  InvitationInvalidError,
  RoleChangeError,
  CanvasNotFoundError,
  PersonaNotFoundError,
  VaultNotFoundError,
  ConfigurationError,
  DatabaseError,
  TransactionError,
  QueryError,
  DateTimeError,
  DurationError,
  MissingParameterError,
  OpenAIConfigError,
  StripeConfigError,
} from '../errors';

// ============================================================================
// Error Conversion Utilities
// ============================================================================

/**
 * Convert any error to a consistent API response format
 */
export function errorToResponse(error: unknown, requestId?: string): {
  statusCode: number;
  body: string;
  headers: Record<string, string>;
} {
  let statusCode = 500;
  let body: Record<string, unknown>;

  // Check for RadiantError using type guard
  if (_isRadiantError(error)) {
    statusCode = error.httpStatus;
    body = error.toResponse(requestId);
  } else if (_isOperationalError(error)) {
    statusCode = error.statusCode;
    body = {
      error: {
        code: error.code,
        message: error.message,
        ...(requestId && { requestId }),
      },
    };
  } else if (error instanceof Error) {
    body = {
      error: {
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'production' 
          ? 'An unexpected error occurred'
          : error.message,
        ...(requestId && { requestId }),
      },
    };
  } else {
    body = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        ...(requestId && { requestId }),
      },
    };
  }

  return {
    statusCode,
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  };
}

/**
 * Type guard to check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (_isRadiantError(error)) {
    return error.retryable;
  }
  
  // Default: network errors and 5xx are retryable
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('econnrefused')
    );
  }
  
  return false;
}

// ============================================================================
// Service Error Handling Utilities
// ============================================================================

import { enhancedLogger } from '../logging/enhanced-logger';

/**
 * Standardized error handler for service methods.
 * Use this to ensure consistent logging and error transformation.
 * 
 * @example
 * async myMethod() {
 *   return handleServiceError('MyService.myMethod', async () => {
 *     // ... method implementation
 *   });
 * }
 */
export async function handleServiceError<T>(
  context: string,
  fn: () => Promise<T>,
  options?: {
    rethrow?: boolean;
    defaultValue?: T;
    logLevel?: 'error' | 'warn' | 'info';
  }
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const logLevel = options?.logLevel ?? 'error';
    enhancedLogger[logLevel](`${context} failed`, { 
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error 
    });
    
    if (options?.rethrow !== false) {
      throw error;
    }
    
    if (options?.defaultValue !== undefined) {
      return options.defaultValue;
    }
    
    throw error;
  }
}

/**
 * Wrap a sync function with error handling.
 */
export function handleServiceErrorSync<T>(
  context: string,
  fn: () => T,
  options?: {
    rethrow?: boolean;
    defaultValue?: T;
    logLevel?: 'error' | 'warn' | 'info';
  }
): T {
  try {
    return fn();
  } catch (error) {
    const logLevel = options?.logLevel ?? 'error';
    enhancedLogger[logLevel](`${context} failed`, { 
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error 
    });
    
    if (options?.rethrow !== false) {
      throw error;
    }
    
    if (options?.defaultValue !== undefined) {
      return options.defaultValue;
    }
    
    throw error;
  }
}

/**
 * Safe JSON parse with error handling.
 */
export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Extract error message from any error type.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}
