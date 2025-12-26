/**
 * RADIANT SDK Error Classes
 */

export class RadiantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RadiantError';
    Object.setPrototypeOf(this, RadiantError.prototype);
  }
}

export class APIError extends RadiantError {
  public readonly status: number;
  public readonly code: string;
  public readonly requestId?: string;

  constructor(
    message: string,
    status: number,
    code: string,
    requestId?: string
  ) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

export class AuthenticationError extends APIError {
  constructor(message: string, requestId?: string) {
    super(message, 401, 'authentication_error', requestId);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class RateLimitError extends APIError {
  public readonly retryAfter?: number;

  constructor(message: string, retryAfter?: number, requestId?: string) {
    super(message, 429, 'rate_limit_error', requestId);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

export class ValidationError extends APIError {
  public readonly errors: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    errors: Array<{ field: string; message: string }>,
    requestId?: string
  ) {
    super(message, 400, 'validation_error', requestId);
    this.name = 'ValidationError';
    this.errors = errors;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class InsufficientCreditsError extends APIError {
  public readonly required: number;
  public readonly available: number;

  constructor(
    message: string,
    required: number,
    available: number,
    requestId?: string
  ) {
    super(message, 402, 'insufficient_credits', requestId);
    this.name = 'InsufficientCreditsError';
    this.required = required;
    this.available = available;
    Object.setPrototypeOf(this, InsufficientCreditsError.prototype);
  }
}

export class NotFoundError extends APIError {
  constructor(message: string, requestId?: string) {
    super(message, 404, 'not_found', requestId);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class ServerError extends APIError {
  constructor(message: string, requestId?: string) {
    super(message, 500, 'server_error', requestId);
    this.name = 'ServerError';
    Object.setPrototypeOf(this, ServerError.prototype);
  }
}
