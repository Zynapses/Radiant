/**
 * RADIANT v4.18.0 - Error Message Sanitizer
 * 
 * Prevents sensitive information from leaking in error messages.
 * Sanitizes connection strings, API keys, and other secrets.
 */

// Patterns that indicate sensitive data
const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Database connection strings
  { pattern: /postgres(ql)?:\/\/[^@]+@[^\s]+/gi, replacement: 'postgres://[REDACTED]' },
  { pattern: /mysql:\/\/[^@]+@[^\s]+/gi, replacement: 'mysql://[REDACTED]' },
  { pattern: /mongodb(\+srv)?:\/\/[^@]+@[^\s]+/gi, replacement: 'mongodb://[REDACTED]' },
  { pattern: /redis:\/\/[^@]*@?[^\s]+/gi, replacement: 'redis://[REDACTED]' },
  
  // API keys and tokens (common formats)
  { pattern: /sk-[a-zA-Z0-9]{20,}/g, replacement: 'sk-[REDACTED]' },
  { pattern: /pk-[a-zA-Z0-9]{20,}/g, replacement: 'pk-[REDACTED]' },
  { pattern: /api[_-]?key[=:]\s*['"]?[a-zA-Z0-9_-]{16,}['"]?/gi, replacement: 'api_key=[REDACTED]' },
  { pattern: /bearer\s+[a-zA-Z0-9_.-]+/gi, replacement: 'Bearer [REDACTED]' },
  { pattern: /authorization[=:]\s*['"]?[a-zA-Z0-9_.-]+['"]?/gi, replacement: 'authorization=[REDACTED]' },
  
  // AWS credentials
  { pattern: /AKIA[0-9A-Z]{16}/g, replacement: '[AWS_ACCESS_KEY_REDACTED]' },
  { pattern: /aws[_-]?secret[_-]?access[_-]?key[=:]\s*['"]?[a-zA-Z0-9/+=]{40}['"]?/gi, replacement: 'aws_secret_access_key=[REDACTED]' },
  
  // Passwords in connection strings or configs
  { pattern: /password[=:]\s*['"]?[^\s'"&]+['"]?/gi, replacement: 'password=[REDACTED]' },
  { pattern: /passwd[=:]\s*['"]?[^\s'"&]+['"]?/gi, replacement: 'passwd=[REDACTED]' },
  { pattern: /pwd[=:]\s*['"]?[^\s'"&]+['"]?/gi, replacement: 'pwd=[REDACTED]' },
  
  // JWT tokens
  { pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, replacement: '[JWT_REDACTED]' },
  
  // Email addresses (optional - uncomment if needed)
  // { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL_REDACTED]' },
  
  // IP addresses with ports (internal network info)
  { pattern: /\b(?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}:\d+\b/g, replacement: '[INTERNAL_IP_REDACTED]' },
];

/**
 * Sanitize a string to remove sensitive information
 */
export function sanitizeErrorMessage(message: string): string {
  let sanitized = message;
  
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  
  return sanitized;
}

/**
 * Sanitize an Error object
 */
export function sanitizeError(error: Error): Error {
  const sanitizedMessage = sanitizeErrorMessage(error.message);
  const sanitizedError = new Error(sanitizedMessage);
  sanitizedError.name = error.name;
  
  if (error.stack) {
    sanitizedError.stack = sanitizeErrorMessage(error.stack);
  }
  
  return sanitizedError;
}

/**
 * Create a safe error message for client responses
 * In production, returns generic message; in dev, returns sanitized details
 */
export function toClientError(error: unknown, genericMessage: string = 'An unexpected error occurred'): string {
  if (process.env.NODE_ENV === 'production') {
    return genericMessage;
  }
  
  if (error instanceof Error) {
    return sanitizeErrorMessage(error.message);
  }
  
  return genericMessage;
}

/**
 * Wrap a function to sanitize any errors it throws
 */
export function withSanitizedErrors<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof Error) {
        throw sanitizeError(error);
      }
      throw error;
    }
  }) as T;
}

/**
 * Safe error logging - sanitizes before logging
 */
export function logSafeError(
  logger: { error: (msg: string, meta?: Record<string, unknown>) => void },
  message: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  const sanitizedMessage = error instanceof Error 
    ? sanitizeErrorMessage(error.message)
    : 'Unknown error';
    
  const sanitizedStack = error instanceof Error && error.stack
    ? sanitizeErrorMessage(error.stack)
    : undefined;

  logger.error(message, {
    ...context,
    error: sanitizedMessage,
    stack: sanitizedStack,
  });
}

/**
 * Check if a string contains potential secrets
 */
export function containsSensitiveData(text: string): boolean {
  return SENSITIVE_PATTERNS.some(({ pattern }) => pattern.test(text));
}
