/**
 * Environment Configuration
 * 
 * Type-safe environment variable access and validation
 */

export type Environment = 'development' | 'staging' | 'production';

/**
 * Environment configuration schema
 */
export interface EnvironmentConfig {
  // General
  environment: Environment;
  version: string;
  debug: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';

  // API
  apiBaseUrl: string;
  apiVersion: string;

  // Database
  databaseUrl?: string;
  databasePoolSize: number;

  // Cache
  redisUrl?: string;
  cacheTtl: number;

  // Auth
  jwtSecret?: string;
  jwtExpiresIn: string;
  cognitoUserPoolId?: string;
  cognitoClientId?: string;

  // AWS
  awsRegion: string;
  awsAccountId?: string;

  // AI Providers
  openaiApiKey?: string;
  anthropicApiKey?: string;
  googleApiKey?: string;

  // Email
  fromEmail: string;
  fromName: string;

  // Features
  features: {
    streaming: boolean;
    functionCalling: boolean;
    vision: boolean;
    batch: boolean;
    webhooks: boolean;
    multiRegion: boolean;
  };

  // Rate Limits
  rateLimits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

/**
 * Get environment configuration
 */
export function getConfig(): EnvironmentConfig {
  return {
    // General
    environment: getEnv('NODE_ENV', 'development') as Environment,
    version: getEnv('VERSION', '4.18.0'),
    debug: getBoolEnv('DEBUG', false),
    logLevel: getEnv('LOG_LEVEL', 'info') as EnvironmentConfig['logLevel'],

    // API
    apiBaseUrl: getEnv('API_BASE_URL', ''),
    apiVersion: getEnv('API_VERSION', 'v2'),

    // Database
    databaseUrl: getEnv('DATABASE_URL'),
    databasePoolSize: getIntEnv('DATABASE_POOL_SIZE', 10),

    // Cache
    redisUrl: getEnv('REDIS_URL'),
    cacheTtl: getIntEnv('CACHE_TTL', 300),

    // Auth
    jwtSecret: getEnv('JWT_SECRET'),
    jwtExpiresIn: getEnv('JWT_EXPIRES_IN', '24h'),
    cognitoUserPoolId: getEnv('COGNITO_USER_POOL_ID'),
    cognitoClientId: getEnv('COGNITO_CLIENT_ID'),

    // AWS
    awsRegion: getEnv('AWS_REGION', 'us-east-1'),
    awsAccountId: getEnv('AWS_ACCOUNT_ID'),

    // AI Providers
    openaiApiKey: getEnv('OPENAI_API_KEY'),
    anthropicApiKey: getEnv('ANTHROPIC_API_KEY'),
    googleApiKey: getEnv('GOOGLE_API_KEY'),

    // Email
    fromEmail: getEnv('FROM_EMAIL', ''),
    fromName: getEnv('FROM_NAME', 'RADIANT'),

    // Features
    features: {
      streaming: getBoolEnv('FEATURE_STREAMING', true),
      functionCalling: getBoolEnv('FEATURE_FUNCTION_CALLING', true),
      vision: getBoolEnv('FEATURE_VISION', true),
      batch: getBoolEnv('FEATURE_BATCH', true),
      webhooks: getBoolEnv('FEATURE_WEBHOOKS', true),
      multiRegion: getBoolEnv('FEATURE_MULTI_REGION', false),
    },

    // Rate Limits
    rateLimits: {
      requestsPerMinute: getIntEnv('RATE_LIMIT_REQUESTS', 100),
      tokensPerMinute: getIntEnv('RATE_LIMIT_TOKENS', 100000),
    },
  };
}

/**
 * Validate required environment variables
 */
export function validateConfig(requiredVars: string[]): { valid: boolean; missing: string[] } {
  const missing = requiredVars.filter(name => !process.env[name]);
  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
}

/**
 * Check if running in staging
 */
export function isStaging(): boolean {
  return process.env.NODE_ENV === 'staging';
}

/**
 * Get current environment
 */
export function getEnvironment(): Environment {
  const env = process.env.NODE_ENV;
  if (env === 'production' || env === 'staging') {
    return env;
  }
  return 'development';
}

// ============================================================================
// Helper Functions
// ============================================================================

function getEnv(name: string): string | undefined;
function getEnv(name: string, defaultValue: string): string;
function getEnv(name: string, defaultValue?: string): string | undefined {
  return process.env[name] ?? defaultValue;
}

export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getIntEnv(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export function getFloatEnv(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getBoolEnv(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

export function getArrayEnv(name: string, defaultValue: string[] = []): string[] {
  const value = process.env[name];
  if (!value) return defaultValue;
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

export function getJsonEnv<T>(name: string, defaultValue: T): T {
  const value = process.env[name];
  if (!value) return defaultValue;
  try {
    return JSON.parse(value) as T;
  } catch {
    return defaultValue;
  }
}

// ============================================================================
// Environment Variable Reference
// ============================================================================

/**
 * Required environment variables by environment
 */
export const RequiredEnvVars = {
  development: [],
  staging: [
    'DATABASE_URL',
    'COGNITO_USER_POOL_ID',
    'COGNITO_CLIENT_ID',
  ],
  production: [
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'COGNITO_USER_POOL_ID',
    'COGNITO_CLIENT_ID',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
  ],
};

/**
 * Validate environment for current stage
 */
export function validateEnvironment(): void {
  const env = getEnvironment();
  const required = RequiredEnvVars[env];
  const { valid, missing } = validateConfig(required);

  if (!valid) {
    throw new Error(`Missing required environment variables for ${env}: ${missing.join(', ')}`);
  }
}
