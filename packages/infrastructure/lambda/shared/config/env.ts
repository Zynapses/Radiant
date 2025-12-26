/**
 * Environment Variable Configuration with Validation
 * 
 * Centralized environment variable access with type safety,
 * defaults, and validation.
 */

// Note: RadiantError import would create circular dependency, use inline error
// import { RadiantError } from '../errors/radiant-error';

type EnvVarType = 'string' | 'number' | 'boolean' | 'json';

interface EnvVarConfig<T> {
  key: string;
  type: EnvVarType;
  required?: boolean;
  default?: T;
  validator?: (value: T) => boolean;
  validatorMessage?: string;
}

function parseEnvValue<T>(value: string | undefined, type: EnvVarType, defaultValue?: T): T | undefined {
  if (value === undefined || value === '') {
    return defaultValue;
  }

  switch (type) {
    case 'string':
      return value as T;
    case 'number': {
      const num = parseInt(value, 10);
      if (isNaN(num)) return defaultValue;
      return num as T;
    }
    case 'boolean':
      return (value.toLowerCase() === 'true' || value === '1') as T;
    case 'json':
      try {
        return JSON.parse(value) as T;
      } catch (parseError) {
        console.debug('Failed to parse JSON env var, using default:', parseError instanceof Error ? parseError.message : 'unknown');
        return defaultValue;
      }
    default:
      return value as T;
  }
}

function getEnvVar<T>(config: EnvVarConfig<T>): T {
  const value = parseEnvValue<T>(process.env[config.key], config.type, config.default);

  if (value === undefined && config.required) {
    const error = new Error(`Required environment variable ${config.key} is not set`);
    error.name = 'ConfigurationError';
    throw error;
  }

  if (value !== undefined && config.validator && !config.validator(value)) {
    const error = new Error(config.validatorMessage || `Invalid value for environment variable ${config.key}`);
    error.name = 'ConfigurationError';
    throw error;
  }

  return value as T;
}

/**
 * Environment configuration singleton
 */
class EnvironmentConfig {
  private static instance: EnvironmentConfig;
  private cache: Map<string, unknown> = new Map();

  private constructor() {
    // Initialize and validate on construction
    this.validate();
  }

  static getInstance(): EnvironmentConfig {
    if (!EnvironmentConfig.instance) {
      EnvironmentConfig.instance = new EnvironmentConfig();
    }
    return EnvironmentConfig.instance;
  }

  private validate(): void {
    // Validate required environment variables on startup
    const requiredVars = [
      'DATABASE_URL',
      'AWS_REGION',
    ];

    const missing = requiredVars.filter(v => !process.env[v]);
    
    if (missing.length > 0 && process.env.NODE_ENV !== 'test') {
      console.warn(`[Config] Missing environment variables: ${missing.join(', ')}`);
    }
  }

  // Database Configuration
  get databaseUrl(): string {
    return getEnvVar({
      key: 'DATABASE_URL',
      type: 'string',
      required: process.env.NODE_ENV !== 'test',
      default: 'postgresql://localhost:5432/radiant',
    });
  }

  get databasePoolMin(): number {
    return getEnvVar({
      key: 'DB_POOL_MIN',
      type: 'number',
      default: 1,
    });
  }

  get databasePoolMax(): number {
    return getEnvVar({
      key: 'DB_POOL_MAX',
      type: 'number',
      default: 10,
    });
  }

  // AWS Configuration
  get awsRegion(): string {
    return getEnvVar({
      key: 'AWS_REGION',
      type: 'string',
      default: process.env.AWS_DEFAULT_REGION || 'us-east-1',
    });
  }

  get primaryRegion(): string {
    return getEnvVar({
      key: 'PRIMARY_REGION',
      type: 'string',
      default: this.awsRegion,
    });
  }

  get secondaryRegions(): string[] {
    return getEnvVar({
      key: 'SECONDARY_REGIONS',
      type: 'json',
      default: [],
    });
  }

  get allRegions(): string[] {
    return [this.primaryRegion, ...this.secondaryRegions];
  }

  // S3 Configuration
  get mediaBucket(): string {
    return getEnvVar({
      key: 'MEDIA_BUCKET',
      type: 'string',
      default: `radiant-media-${this.awsRegion}`,
    });
  }

  get releasesBucket(): string {
    return getEnvVar({
      key: 'RELEASES_BUCKET',
      type: 'string',
      default: `radiant-releases-${this.awsRegion}`,
    });
  }

  // Cognito Configuration
  get cognitoUserPoolId(): string {
    return getEnvVar({
      key: 'COGNITO_USER_POOL_ID',
      type: 'string',
      required: false,
      default: '',
    });
  }

  get cognitoClientId(): string {
    return getEnvVar({
      key: 'COGNITO_CLIENT_ID',
      type: 'string',
      required: false,
      default: '',
    });
  }

  // API Configuration
  get apiBaseUrl(): string {
    return getEnvVar({
      key: 'API_BASE_URL',
      type: 'string',
      default: '',
    });
  }

  get corsOrigins(): string[] {
    return getEnvVar({
      key: 'CORS_ORIGINS',
      type: 'json',
      default: ['*'],
    });
  }

  // Feature Flags
  get enableAuditLogging(): boolean {
    return getEnvVar({
      key: 'ENABLE_AUDIT_LOGGING',
      type: 'boolean',
      default: true,
    });
  }

  get enableMetrics(): boolean {
    return getEnvVar({
      key: 'ENABLE_METRICS',
      type: 'boolean',
      default: true,
    });
  }

  get enableThinkTank(): boolean {
    return getEnvVar({
      key: 'ENABLE_THINKTANK',
      type: 'boolean',
      default: false,
    });
  }

  // Rate Limiting
  get rateLimitRequests(): number {
    return getEnvVar({
      key: 'RATE_LIMIT_REQUESTS',
      type: 'number',
      default: 100,
    });
  }

  get rateLimitWindow(): number {
    return getEnvVar({
      key: 'RATE_LIMIT_WINDOW_MS',
      type: 'number',
      default: 60000,
    });
  }

  // Timeouts (in milliseconds)
  get defaultTimeout(): number {
    return getEnvVar({
      key: 'DEFAULT_TIMEOUT_MS',
      type: 'number',
      default: 30000,
    });
  }

  get aiRequestTimeout(): number {
    return getEnvVar({
      key: 'AI_REQUEST_TIMEOUT_MS',
      type: 'number',
      default: 120000,
    });
  }

  // Logging
  get logLevel(): string {
    return getEnvVar({
      key: 'LOG_LEVEL',
      type: 'string',
      default: 'info',
      validator: (v) => ['debug', 'info', 'warn', 'error'].includes(v),
      validatorMessage: 'LOG_LEVEL must be one of: debug, info, warn, error',
    });
  }

  // Environment
  get nodeEnv(): string {
    return getEnvVar({
      key: 'NODE_ENV',
      type: 'string',
      default: 'development',
    });
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }

  // Cache control
  clearCache(): void {
    this.cache.clear();
  }
}

export const env = EnvironmentConfig.getInstance();

// Re-export for convenience
export { getEnvVar, EnvVarConfig };
