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
      // Use structured output format for Lambda CloudWatch
      const output = JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'warn',
        message: 'Missing environment variables',
        missingVars: missing,
      });
      process.stdout.write(output + '\n');
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

  // AI/LiteLLM Configuration
  get litellmBaseUrl(): string {
    return getEnvVar({
      key: 'LITELLM_BASE_URL',
      type: 'string',
      default: '',
    });
  }

  get litellmApiKey(): string {
    return getEnvVar({
      key: 'LITELLM_API_KEY',
      type: 'string',
      default: '',
    });
  }

  get bedrockEnabled(): boolean {
    return getEnvVar({
      key: 'BEDROCK_ENABLED',
      type: 'boolean',
      default: true,
    });
  }

  get openaiApiKey(): string {
    return getEnvVar({
      key: 'OPENAI_API_KEY',
      type: 'string',
      default: '',
    });
  }

  get anthropicApiKey(): string {
    return getEnvVar({
      key: 'ANTHROPIC_API_KEY',
      type: 'string',
      default: '',
    });
  }

  get googleApiKey(): string {
    return getEnvVar({
      key: 'GOOGLE_API_KEY',
      type: 'string',
      default: '',
    });
  }

  // Circuit Breaker Configuration
  get circuitBreakerFailureThreshold(): number {
    return getEnvVar({
      key: 'CIRCUIT_BREAKER_FAILURE_THRESHOLD',
      type: 'number',
      default: 5,
    });
  }

  get circuitBreakerResetTimeoutMs(): number {
    return getEnvVar({
      key: 'CIRCUIT_BREAKER_RESET_TIMEOUT_MS',
      type: 'number',
      default: 30000,
    });
  }

  get circuitBreakerHalfOpenRequests(): number {
    return getEnvVar({
      key: 'CIRCUIT_BREAKER_HALF_OPEN_REQUESTS',
      type: 'number',
      default: 3,
    });
  }

  // Retry Configuration
  get retryMaxAttempts(): number {
    return getEnvVar({
      key: 'RETRY_MAX_ATTEMPTS',
      type: 'number',
      default: 3,
    });
  }

  get retryInitialDelayMs(): number {
    return getEnvVar({
      key: 'RETRY_INITIAL_DELAY_MS',
      type: 'number',
      default: 1000,
    });
  }

  get retryMaxDelayMs(): number {
    return getEnvVar({
      key: 'RETRY_MAX_DELAY_MS',
      type: 'number',
      default: 30000,
    });
  }

  // Artifact Storage
  get artifactsBucket(): string {
    return getEnvVar({
      key: 'ARTIFACTS_BUCKET',
      type: 'string',
      default: `radiant-artifacts-${this.awsRegion}`,
    });
  }

  get artifactUrlExpirationSeconds(): number {
    return getEnvVar({
      key: 'ARTIFACT_URL_EXPIRATION',
      type: 'number',
      default: 3600,
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

// ============================================================================
// Startup Validation
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate all required environment variables at Lambda startup.
 * Call this in your handler's initialization code.
 */
export function validateEnvironment(requiredVars: string[] = []): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  const baseRequired = ['AWS_REGION'];
  const allRequired = [...new Set([...baseRequired, ...requiredVars])];

  for (const varName of allRequired) {
    if (!process.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  }

  // Check recommended variables
  const recommended = ['LOG_LEVEL', 'NODE_ENV'];
  for (const varName of recommended) {
    if (!process.env[varName]) {
      warnings.push(`Missing recommended environment variable: ${varName}`);
    }
  }

  // Validate DATABASE_URL format if present
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && !dbUrl.startsWith('postgres')) {
    errors.push('DATABASE_URL must be a valid PostgreSQL connection string');
  }

  // Validate LOG_LEVEL if present
  const logLevel = process.env.LOG_LEVEL;
  if (logLevel && !['debug', 'info', 'warn', 'error'].includes(logLevel)) {
    errors.push('LOG_LEVEL must be one of: debug, info, warn, error');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get a required environment variable with a helpful error message.
 * Use this instead of process.env.VAR! to get better error messages.
 * 
 * @example
 * const clusterArn = requireEnv('AURORA_CLUSTER_ARN');
 * const redisHost = requireEnv('REDIS_HOST', 'localhost');
 */
export function requireEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value !== undefined && value !== '') {
    return value;
  }
  if (defaultValue !== undefined) {
    return defaultValue;
  }
  throw new Error(
    `Required environment variable ${key} is not set. ` +
    `Ensure it is configured in the CDK stack or Lambda environment.`
  );
}

/**
 * Get an optional environment variable with a default.
 * Never throws - returns default if not set.
 */
export function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * Assert environment is valid, throwing if not.
 * Use this for fail-fast validation at startup.
 */
export function assertValidEnvironment(requiredVars: string[] = []): void {
  const result = validateEnvironment(requiredVars);
  
  if (result.warnings.length > 0 && process.env.NODE_ENV !== 'test') {
    const output = JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'warn',
      message: 'Environment validation warnings',
      warnings: result.warnings,
    });
    process.stdout.write(output + '\n');
  }

  if (!result.valid) {
    const error = new Error(`Environment validation failed: ${result.errors.join('; ')}`);
    error.name = 'ConfigurationError';
    throw error;
  }
}
