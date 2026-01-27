/**
 * Structured Logging for Admin Dashboard
 * 
 * Provides consistent logging with:
 * - Log levels (debug, info, warn, error)
 * - Structured context
 * - Environment-aware output
 * - Remote logging support (future)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  component?: string;
  action?: string;
  userId?: string;
  tenantId?: string;
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
    stack?: string;
  };
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private minLevel: LogLevel;
  private defaultContext: LogContext;
  private isDevelopment: boolean;

  constructor(context: LogContext = {}) {
    this.minLevel = (process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel) || 'info';
    this.defaultContext = context;
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
  }

  private formatEntry(level: LogLevel, message: string, context?: LogContext, error?: Error): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.defaultContext, ...context },
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    };
  }

  private output(entry: LogEntry): void {
    if (this.isDevelopment) {
      // Pretty output for development
      const prefix = `[${entry.level.toUpperCase()}]`;
      const contextStr = entry.context && Object.keys(entry.context).length > 0
        ? ` ${JSON.stringify(entry.context)}`
        : '';
      
      switch (entry.level) {
        case 'debug':
          console.debug(`${prefix} ${entry.message}${contextStr}`);
          break;
        case 'info':
          console.info(`${prefix} ${entry.message}${contextStr}`);
          break;
        case 'warn':
          console.warn(`${prefix} ${entry.message}${contextStr}`);
          break;
        case 'error':
          console.error(`${prefix} ${entry.message}${contextStr}`, entry.error?.stack || '');
          break;
      }
    } else {
      // Structured JSON for production (for log aggregation)
      console.log(JSON.stringify(entry));
    }
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      this.output(this.formatEntry('debug', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      this.output(this.formatEntry('info', message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      this.output(this.formatEntry('warn', message, context));
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.shouldLog('error')) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.output(this.formatEntry('error', message, context, err));
    }
  }

  child(context: LogContext): Logger {
    const childLogger = new Logger({ ...this.defaultContext, ...context });
    return childLogger;
  }
}

// Singleton instance
export const logger = new Logger();

// Factory for component-specific loggers
export function createLogger(component: string): Logger {
  return new Logger({ component });
}

// Named exports for convenience
export const logDebug = (message: string, context?: LogContext) => logger.debug(message, context);
export const logInfo = (message: string, context?: LogContext) => logger.info(message, context);
export const logWarn = (message: string, context?: LogContext) => logger.warn(message, context);
export const logError = (message: string, error?: Error | unknown, context?: LogContext) => logger.error(message, error, context);

export default logger;
