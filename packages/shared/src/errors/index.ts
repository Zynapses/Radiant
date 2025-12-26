/**
 * RADIANT Error Module
 * 
 * Centralized error handling with standardized codes
 */

export { ErrorCodes, ErrorCodeMetadata, getErrorMetadata, isRetryableError } from './codes';
export type { ErrorCode } from './codes';

import { ErrorCodes, getErrorMetadata, type ErrorCode } from './codes';

/**
 * Base error class for all RADIANT errors
 */
export class RadiantError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly category: string;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;
  readonly requestId?: string;
  readonly timestamp: string;
  readonly originalCause?: Error;

  constructor(
    code: ErrorCode,
    message?: string,
    options?: {
      details?: Record<string, unknown>;
      requestId?: string;
      cause?: Error;
    }
  ) {
    const metadata = getErrorMetadata(code);
    super(message || metadata.userMessage);
    
    this.name = 'RadiantError';
    this.code = code;
    this.statusCode = metadata.httpStatus;
    this.category = metadata.category;
    this.retryable = metadata.retryable;
    this.details = options?.details;
    this.requestId = options?.requestId;
    this.timestamp = new Date().toISOString();
    this.originalCause = options?.cause;

    Error.captureStackTrace?.(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        category: this.category,
        retryable: this.retryable,
        ...(this.details && { details: this.details }),
        ...(this.requestId && { requestId: this.requestId }),
        timestamp: this.timestamp,
      },
    };
  }

  toResponse() {
    return {
      statusCode: this.statusCode,
      headers: {
        'Content-Type': 'application/json',
        ...(this.retryable && { 'Retry-After': '5' }),
      },
      body: JSON.stringify(this.toJSON()),
    };
  }
}

// Convenience factory functions
export const createAuthError = (code: ErrorCode, message?: string, details?: Record<string, unknown>) =>
  new RadiantError(code, message, { details });

export const createValidationError = (message: string, field?: string) =>
  new RadiantError(ErrorCodes.VALIDATION_REQUIRED_FIELD, message, {
    details: field ? { field } : undefined,
  });

export const createNotFoundError = (resource: string, id?: string) =>
  new RadiantError(ErrorCodes.RESOURCE_NOT_FOUND, `${resource} not found`, {
    details: { resource, ...(id && { id }) },
  });

export const createRateLimitError = (retryAfter?: number) =>
  new RadiantError(ErrorCodes.RATE_LIMIT_EXCEEDED, undefined, {
    details: retryAfter ? { retryAfter } : undefined,
  });

export const createAIError = (code: ErrorCode, provider?: string, model?: string) =>
  new RadiantError(code, undefined, {
    details: { provider, model },
  });

export const createBillingError = (code: ErrorCode, balance?: number) =>
  new RadiantError(code, undefined, {
    details: balance !== undefined ? { currentBalance: balance } : undefined,
  });

/**
 * Convert unknown error to RadiantError
 */
export function toRadiantError(error: unknown, requestId?: string): RadiantError {
  if (error instanceof RadiantError) {
    return error;
  }

  if (error instanceof Error) {
    return new RadiantError(ErrorCodes.INTERNAL_ERROR, error.message, {
      requestId,
      cause: error,
    });
  }

  return new RadiantError(ErrorCodes.INTERNAL_ERROR, 'Unknown error occurred', {
    requestId,
  });
}

/**
 * Check if error is a RadiantError
 */
export function isRadiantError(error: unknown): error is RadiantError {
  return error instanceof RadiantError;
}
