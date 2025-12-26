/**
 * RADIANT v4.18.0 - Credential Sanitizer
 * Prevents credential exposure in logs and error messages
 */

/**
 * Patterns that might contain credentials
 */
const CREDENTIAL_PATTERNS = [
  // AWS Access Key ID (starts with AKIA, ABIA, ACCA, ASIA)
  /A[KBS]IA[A-Z0-9]{16}/g,
  // AWS Secret Access Key (40 char base64-ish)
  /(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/g,
  // Generic API keys in common formats
  /(?:api[_-]?key|apikey|secret|password|token|bearer|authorization)["\s:=]+["']?[A-Za-z0-9/+=_-]{16,}["']?/gi,
  // JWT tokens
  /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  // Connection strings with passwords
  /(?:postgres|mysql|mongodb|redis):\/\/[^:]+:[^@]+@/gi,
  // Base64 encoded secrets (common lengths)
  /(?:secret|key|password|token)["\s:=]+["']?[A-Za-z0-9+/]{32,}={0,2}["']?/gi,
];

/**
 * Headers that should never be logged
 */
const SENSITIVE_HEADERS = [
  'authorization',
  'x-api-key',
  'x-auth-token',
  'cookie',
  'set-cookie',
  'x-amz-security-token',
  'x-amz-credential',
];

/**
 * Sanitize a string to remove potential credentials
 */
export function sanitizeString(input: string): string {
  let result = input;
  
  for (const pattern of CREDENTIAL_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  
  return result;
}

/**
 * Sanitize an error object for logging
 */
export function sanitizeError(error: Error): { message: string; stack?: string; name: string } {
  return {
    name: error.name,
    message: sanitizeString(error.message),
    stack: error.stack ? sanitizeString(error.stack) : undefined,
  };
}

/**
 * Sanitize headers object for logging
 */
export function sanitizeHeaders(headers: Record<string, string | undefined>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    
    if (SENSITIVE_HEADERS.includes(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else if (value) {
      sanitized[key] = sanitizeString(value);
    }
  }
  
  return sanitized;
}

/**
 * Sanitize an object for logging (deep)
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    // Check if key suggests sensitive data
    if (
      lowerKey.includes('password') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('token') ||
      lowerKey.includes('key') ||
      lowerKey.includes('credential') ||
      lowerKey.includes('auth')
    ) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      result[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        result[key] = value.map(item => 
          typeof item === 'string' 
            ? sanitizeString(item) 
            : typeof item === 'object' && item !== null
              ? sanitizeObject(item as Record<string, unknown>)
              : item
        );
      } else {
        result[key] = sanitizeObject(value as Record<string, unknown>);
      }
    } else {
      result[key] = value;
    }
  }
  
  return result as T;
}

/**
 * Create a safe error response (for API responses)
 */
export function createSafeErrorResponse(error: Error, includeStack = false): {
  error: {
    message: string;
    code?: string;
    stack?: string;
  };
} {
  const sanitized = sanitizeError(error);
  
  return {
    error: {
      message: sanitized.message,
      code: (error as Error & { code?: string }).code,
      ...(includeStack && process.env.NODE_ENV !== 'production' ? { stack: sanitized.stack } : {}),
    },
  };
}

/**
 * Wrap a logger to automatically sanitize all output
 */
export function createSanitizedLogger(baseLogger: {
  info: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}): typeof baseLogger {
  const sanitizeArg = (arg: unknown): unknown => {
    if (typeof arg === 'string') {
      return sanitizeString(arg);
    }
    if (arg instanceof Error) {
      return sanitizeError(arg);
    }
    if (typeof arg === 'object' && arg !== null) {
      return sanitizeObject(arg as Record<string, unknown>);
    }
    return arg;
  };

  return {
    info: (...args: unknown[]) => baseLogger.info(...args.map(sanitizeArg)),
    error: (...args: unknown[]) => baseLogger.error(...args.map(sanitizeArg)),
    warn: (...args: unknown[]) => baseLogger.warn(...args.map(sanitizeArg)),
    debug: (...args: unknown[]) => baseLogger.debug(...args.map(sanitizeArg)),
  };
}
