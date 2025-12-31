/**
 * RADIANT TMS - Structured Logger
 * Pino-based logging with X-Ray trace correlation
 */

import pino from 'pino';

const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST;

// In Lambda or test environments, use plain JSON logging
// In development, try to use pino-pretty if available
let loggerOptions: pino.LoggerOptions = {
  name: 'radiant-tms',
  level: process.env.LOG_LEVEL || (isTest ? 'silent' : 'info'),
};

if (isLambda || isTest) {
  loggerOptions.formatters = {
    level: (label) => ({ level: label }),
  };
  loggerOptions.messageKey = 'message';
  loggerOptions.timestamp = () => `,"timestamp":"${new Date().toISOString()}"`;
} else {
  loggerOptions.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  };
}

export const logger = pino(loggerOptions);

export function createChildLogger(bindings: Record<string, unknown>): pino.Logger {
  return logger.child(bindings);
}

export function logWithTrace(
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  data?: Record<string, unknown>,
  traceId?: string
): void {
  const logData = {
    ...data,
    ...(traceId ? { traceId } : {}),
  };

  logger[level](logData, message);
}
