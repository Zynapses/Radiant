/**
 * Environment Variable Utilities
 * 
 * Provides safe access to environment variables with validation
 */

import { ConfigurationError } from '../errors';

/**
 * Get a required environment variable, throwing if not set
 */
export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new ConfigurationError(`Required environment variable ${name} is not set`, name);
  }
  return value;
}

/**
 * Get an optional environment variable with a default value
 */
export function getOptionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

/**
 * Get an optional environment variable, returning undefined if not set
 */
export function getEnv(name: string): string | undefined {
  return process.env[name];
}

/**
 * Get a boolean environment variable
 */
export function getBoolEnv(name: string, defaultValue = false): boolean {
  const value = process.env[name];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Get a numeric environment variable
 */
export function getNumericEnv(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;
  const num = parseInt(value, 10);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Validate that all required environment variables are set
 * Call this at Lambda cold start to fail fast
 */
export function validateRequiredEnvVars(names: string[]): void {
  const missing = names.filter(name => !process.env[name]);
  if (missing.length > 0) {
    throw new ConfigurationError(
      `Missing required environment variables: ${missing.join(', ')}`,
      missing[0]
    );
  }
}

/**
 * Get environment with type-safe defaults
 */
export const env = {
  get NODE_ENV() { return getOptionalEnv('NODE_ENV', 'development'); },
  get ENVIRONMENT() { return getOptionalEnv('ENVIRONMENT', 'development'); },
  get AWS_REGION() { return getOptionalEnv('AWS_REGION', 'us-east-1'); },
  get LOG_LEVEL() { return getOptionalEnv('LOG_LEVEL', 'info'); },
  
  isProduction: () => env.ENVIRONMENT === 'production',
  isDevelopment: () => env.ENVIRONMENT === 'development',
  isTest: () => env.NODE_ENV === 'test',
};
