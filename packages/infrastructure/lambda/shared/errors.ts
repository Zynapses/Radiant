/**
 * Custom error types for API responses
 */

export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;
  readonly isOperational = true;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
    };
  }
}

export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly code: string = 'VALIDATION_ERROR';
  readonly details?: Record<string, string[]>;

  constructor(message: string, details?: Record<string, string[]>) {
    super(message);
    this.details = details;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      details: this.details,
    };
  }
}

export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly code = 'UNAUTHORIZED';

  constructor(message = 'Authentication required') {
    super(message);
  }
}

export class ForbiddenError extends AppError {
  readonly statusCode = 403;
  readonly code: string = 'FORBIDDEN';

  constructor(message = 'Access denied') {
    super(message);
  }
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code: string = 'NOT_FOUND';
  readonly resource?: string;

  constructor(resource?: string) {
    super(resource ? `${resource} not found` : 'Resource not found');
    this.resource = resource;
  }
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code = 'CONFLICT';

  constructor(message: string) {
    super(message);
  }
}

export class RateLimitError extends AppError {
  readonly statusCode = 429;
  readonly code = 'RATE_LIMITED';
  readonly retryAfter?: number;

  constructor(retryAfter?: number) {
    super('Rate limit exceeded');
    this.retryAfter = retryAfter;
  }
}

export class InternalError extends AppError {
  readonly statusCode = 500;
  readonly code: string = 'INTERNAL_ERROR';

  constructor(message = 'An unexpected error occurred') {
    super(message);
  }
}

export class ProviderError extends AppError {
  readonly statusCode = 502;
  readonly code = 'PROVIDER_ERROR';
  readonly provider?: string;

  constructor(message: string, provider?: string) {
    super(message);
    this.provider = provider;
  }
}

export class ServiceUnavailableError extends AppError {
  readonly statusCode = 503;
  readonly code = 'SERVICE_UNAVAILABLE';

  constructor(message = 'Service temporarily unavailable') {
    super(message);
  }
}

export function isOperationalError(error: unknown): error is AppError {
  return error instanceof AppError && error.isOperational;
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new InternalError(error.message);
  }

  return new InternalError('Unknown error occurred');
}

// ============================================================================
// Additional Domain-Specific Errors
// ============================================================================

export class ModelNotFoundError extends NotFoundError {
  readonly code = 'MODEL_NOT_FOUND';

  constructor(modelId?: string) {
    super(modelId ? `Model ${modelId}` : 'Model');
  }
}

export class TenantNotFoundError extends NotFoundError {
  readonly code = 'TENANT_NOT_FOUND';

  constructor(tenantId?: string) {
    super(tenantId ? `Tenant ${tenantId}` : 'Tenant');
  }
}

export class UserNotFoundError extends NotFoundError {
  readonly code = 'USER_NOT_FOUND';

  constructor(userId?: string) {
    super(userId ? `User ${userId}` : 'User');
  }
}

export class TeamLimitExceededError extends AppError {
  readonly statusCode = 400;
  readonly code = 'TEAM_LIMIT_EXCEEDED';
  readonly limit: number;

  constructor(limit: number) {
    super(`Team member limit of ${limit} reached`);
    this.limit = limit;
  }
}

export class CredentialNotFoundError extends NotFoundError {
  readonly code = 'CREDENTIAL_NOT_FOUND';

  constructor(credentialId?: string) {
    super(credentialId ? `Credential ${credentialId}` : 'Credential');
  }
}

export class InvitationInvalidError extends AppError {
  readonly statusCode = 400;
  readonly code = 'INVITATION_INVALID';

  constructor(message = 'Invalid or expired invitation') {
    super(message);
  }
}

export class RoleChangeError extends ForbiddenError {
  readonly code = 'ROLE_CHANGE_FORBIDDEN';

  constructor(message: string) {
    super(message);
  }
}

export class CanvasNotFoundError extends NotFoundError {
  readonly code = 'CANVAS_NOT_FOUND';

  constructor(canvasId?: string) {
    super(canvasId ? `Canvas ${canvasId}` : 'Canvas');
  }
}

export class PersonaNotFoundError extends NotFoundError {
  readonly code = 'PERSONA_NOT_FOUND';

  constructor(personaId?: string) {
    super(personaId ? `Persona ${personaId}` : 'Persona');
  }
}

export class VaultNotFoundError extends NotFoundError {
  readonly code = 'VAULT_NOT_FOUND';

  constructor(vaultId?: string) {
    super(vaultId ? `Vault ${vaultId}` : 'Vault');
  }
}

export class ConfigurationError extends AppError {
  readonly statusCode = 500;
  readonly code: string = 'CONFIGURATION_ERROR';
  readonly missingKey?: string;

  constructor(message: string, missingKey?: string) {
    super(message);
    this.missingKey = missingKey;
  }
}

export class DatabaseError extends InternalError {
  override readonly code: string = 'DATABASE_ERROR';

  constructor(message = 'Database operation failed') {
    super(message);
  }
}

export class TransactionError extends DatabaseError {
  readonly code = 'TRANSACTION_ERROR';

  constructor(message = 'Failed to begin transaction') {
    super(message);
  }
}

export class QueryError extends DatabaseError {
  readonly code = 'QUERY_ERROR';

  constructor(message: string) {
    super(message);
  }
}

export class DateTimeError extends ValidationError {
  readonly code = 'DATETIME_ERROR';

  constructor(message: string) {
    super(message);
  }
}

export class DurationError extends ValidationError {
  readonly code = 'DURATION_ERROR';

  constructor(duration: string) {
    super(`Invalid duration format: ${duration}`);
  }
}

export class MissingParameterError extends ValidationError {
  readonly code = 'MISSING_PARAMETER';

  constructor(parameterName: string, parameterType: 'path' | 'query' | 'body' = 'path') {
    super(`Missing required ${parameterType} parameter: ${parameterName}`, { [parameterName]: ['required'] });
  }
}

export class OpenAIConfigError extends ConfigurationError {
  override readonly code: string = 'OPENAI_NOT_CONFIGURED';

  constructor() {
    super('OpenAI API key not configured for transcription', 'OPENAI_API_KEY');
  }
}

export class StripeConfigError extends ConfigurationError {
  override readonly code: string = 'STRIPE_NOT_CONFIGURED';

  constructor() {
    super('Stripe secret ARN not configured', 'STRIPE_SECRET_ARN');
  }
}
