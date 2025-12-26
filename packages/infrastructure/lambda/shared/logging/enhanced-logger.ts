/**
 * RADIANT v4.18.0 - Enhanced Logger with Request Context
 * 
 * Structured logging with automatic request ID propagation,
 * sensitive field redaction, and configurable log levels.
 */

import { getRequestContext, getLoggableContext } from '../utils/request-context';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  requestId?: string;
  tenantId?: string;
  userId?: string;
  appId?: string;
  environment?: string;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    code?: string;
    stack?: string;
  };
  duration?: number;
  [key: string]: unknown;
}

interface LoggerConfig {
  minLevel: LogLevel;
  includeStackTraces: boolean;
  redactSensitiveFields: boolean;
  sensitiveFieldPatterns: string[];
  maxMessageLength: number;
  structuredLogging: boolean;
  performanceLogging: boolean;
  slowRequestThresholdMs: number;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Default sensitive field patterns
const DEFAULT_SENSITIVE_PATTERNS = [
  'password',
  'token',
  'secret',
  'key',
  'authorization',
  'cookie',
  'credit_card',
  'creditcard',
  'ssn',
  'api_key',
  'apikey',
  'private',
  'credential',
];

// Default configuration from environment
function getDefaultConfig(): LoggerConfig {
  return {
    minLevel: (process.env.LOG_LEVEL as LogLevel) || 'info',
    includeStackTraces: process.env.LOG_INCLUDE_STACK !== 'false',
    redactSensitiveFields: process.env.LOG_REDACT_SENSITIVE !== 'false',
    sensitiveFieldPatterns: DEFAULT_SENSITIVE_PATTERNS,
    maxMessageLength: parseInt(process.env.LOG_MAX_MESSAGE_LENGTH || '10000', 10),
    structuredLogging: process.env.LOG_STRUCTURED !== 'false',
    performanceLogging: process.env.LOG_PERFORMANCE !== 'false',
    slowRequestThresholdMs: parseInt(process.env.LOG_SLOW_THRESHOLD_MS || '5000', 10),
  };
}

export class EnhancedLogger {
  private baseContext: LogContext;
  private config: LoggerConfig;
  private startTime: number;

  constructor(context: LogContext = {}, config?: Partial<LoggerConfig>) {
    this.baseContext = context;
    this.config = { ...getDefaultConfig(), ...config };
    this.startTime = Date.now();
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel];
  }

  private redactValue(key: string, value: unknown): unknown {
    if (!this.config.redactSensitiveFields) return value;

    const lowerKey = key.toLowerCase();
    const isSensitive = this.config.sensitiveFieldPatterns.some(
      pattern => lowerKey.includes(pattern.toLowerCase())
    );

    if (isSensitive) {
      return '[REDACTED]';
    }

    if (typeof value === 'object' && value !== null) {
      return this.redactObject(value as Record<string, unknown>);
    }

    return value;
  }

  private redactObject(obj: Record<string, unknown>): Record<string, unknown> {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      redacted[key] = this.redactValue(key, value);
    }
    return redacted;
  }

  private truncateMessage(message: string): string {
    if (message.length <= this.config.maxMessageLength) return message;
    return message.substring(0, this.config.maxMessageLength) + '... [truncated]';
  }

  private getContextFromRequest(): LogContext {
    const reqContext = getLoggableContext();
    return {
      ...this.baseContext,
      ...reqContext,
      environment: process.env.ENVIRONMENT || process.env.NODE_ENV,
    };
  }

  private formatEntry(
    level: LogLevel,
    message: string,
    extra?: Record<string, unknown>
  ): LogEntry {
    const context = this.getContextFromRequest();
    const duration = Date.now() - this.startTime;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: this.truncateMessage(message),
      context,
      duration,
    };

    if (extra) {
      const redactedExtra = this.redactObject(extra);
      Object.assign(entry, redactedExtra);
    }

    return entry;
  }

  private output(level: LogLevel, entry: LogEntry): void {
    const output = this.config.structuredLogging
      ? JSON.stringify(entry)
      : `[${entry.timestamp}] ${level.toUpperCase()}: ${entry.message}`;

    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }

  private log(level: LogLevel, message: string, extra?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;
    const entry = this.formatEntry(level, message, extra);
    this.output(level, entry);
  }

  debug(message: string, extra?: Record<string, unknown>): void {
    this.log('debug', message, extra);
  }

  info(message: string, extra?: Record<string, unknown>): void {
    this.log('info', message, extra);
  }

  warn(message: string, extra?: Record<string, unknown>): void {
    this.log('warn', message, extra);
  }

  error(message: string, error?: Error | unknown, extra?: Record<string, unknown>): void {
    const errorInfo = error instanceof Error
      ? {
          error: {
            name: error.name,
            message: error.message,
            code: (error as Error & { code?: string }).code,
            ...(this.config.includeStackTraces && { stack: error.stack }),
          },
        }
      : error
      ? { errorDetails: error }
      : {};

    this.log('error', message, { ...extra, ...errorInfo });
  }

  /**
   * Log slow operations
   */
  slow(operation: string, durationMs: number, extra?: Record<string, unknown>): void {
    if (durationMs >= this.config.slowRequestThresholdMs) {
      this.warn(`Slow operation: ${operation}`, { 
        durationMs, 
        threshold: this.config.slowRequestThresholdMs,
        ...extra 
      });
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): EnhancedLogger {
    return new EnhancedLogger(
      { ...this.baseContext, ...additionalContext },
      this.config
    );
  }

  /**
   * Create a timer for measuring operation duration
   */
  startTimer(operation: string): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      if (this.config.performanceLogging) {
        this.debug(`${operation} completed`, { durationMs: duration });
      }
      this.slow(operation, duration);
    };
  }

  /**
   * Log with automatic timing
   */
  async timed<T>(
    operation: string,
    fn: () => Promise<T>,
    extra?: Record<string, unknown>
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      
      if (this.config.performanceLogging) {
        this.debug(`${operation} completed`, { durationMs: duration, ...extra });
      }
      this.slow(operation, duration, extra);
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(`${operation} failed`, error, { durationMs: duration, ...extra });
      throw error;
    }
  }

  /**
   * Update configuration
   */
  configure(updates: Partial<LoggerConfig>): void {
    Object.assign(this.config, updates);
  }

  /**
   * Get current configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }
}

// Singleton instance
export const enhancedLogger = new EnhancedLogger({
  appId: process.env.APP_ID,
  environment: process.env.ENVIRONMENT,
});

// Convenience export for compatibility
export const logger = enhancedLogger;

// Type-safe log function
export function log(
  level: LogLevel,
  message: string,
  extra?: Record<string, unknown>
): void {
  enhancedLogger[level](message, extra);
}
