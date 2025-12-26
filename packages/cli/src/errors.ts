/**
 * CLI Error Handling
 * Provides structured error handling for the CLI
 */

import chalk from 'chalk';

export class CLIError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'CLI_ERROR',
    public readonly exitCode: number = 1
  ) {
    super(message);
    this.name = 'CLIError';
  }
}

export class ConfigurationError extends CLIError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR', 1);
    this.name = 'ConfigurationError';
  }
}

export class AuthenticationError extends CLIError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR', 1);
    this.name = 'AuthenticationError';
  }
}

export class APIError extends CLIError {
  constructor(message: string, public readonly statusCode?: number) {
    super(message, 'API_ERROR', 1);
    this.name = 'APIError';
  }
}

export class ValidationError extends CLIError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 1);
    this.name = 'ValidationError';
  }
}

/**
 * Handle CLI errors consistently
 */
export function handleError(error: unknown): never {
  if (error instanceof CLIError) {
    console.error(chalk.red(`Error [${error.code}]:`), error.message);
    process.exit(error.exitCode);
  }
  
  if (error instanceof Error) {
    console.error(chalk.red('Error:'), error.message);
    if (process.env.DEBUG) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
  
  console.error(chalk.red('Unknown error:'), String(error));
  process.exit(1);
}

/**
 * Wrap an async command handler with error handling
 */
export function withErrorHandler<T extends (...args: unknown[]) => Promise<void>>(
  handler: T
): T {
  return (async (...args: unknown[]) => {
    try {
      await handler(...args);
    } catch (error) {
      handleError(error);
    }
  }) as T;
}

/**
 * Assert a condition, throwing a CLIError if false
 */
export function assertOrExit(condition: unknown, message: string, code = 'ASSERTION_FAILED'): asserts condition {
  if (!condition) {
    throw new CLIError(message, code);
  }
}
