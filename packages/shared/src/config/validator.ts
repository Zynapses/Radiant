/**
 * Environment Configuration Validator
 * 
 * RADIANT v5.2.0 - Production Hardening
 * 
 * Validates required environment variables on Lambda startup.
 * Fails fast if critical configuration is missing.
 * 
 * Usage:
 *   import { validateEnvironment } from '@radiant/shared/config/validator';
 *   
 *   // At Lambda cold start
 *   validateEnvironment();
 */

export interface EnvironmentRequirement {
  /** Environment variable name */
  name: string;
  /** Whether this variable is required (default: true) */
  required?: boolean;
  /** Description of the variable for error messages */
  description?: string;
  /** Default value if not required and not set */
  defaultValue?: string;
  /** Validation function for the value */
  validate?: (value: string) => boolean;
  /** Error message if validation fails */
  validationMessage?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  resolvedConfig: Record<string, string>;
}

/**
 * Critical configuration error thrown when required environment variables are missing.
 * This should crash the Lambda on cold start, not during request handling.
 */
export class CriticalConfigurationError extends Error {
  readonly isCriticalConfig = true;
  
  constructor(
    message: string,
    public readonly missingVariables: string[],
    public readonly validationErrors: string[]
  ) {
    super(message);
    this.name = 'CriticalConfigurationError';
  }
}

/**
 * Core environment variables required for RADIANT to function.
 */
export const CORE_REQUIREMENTS: EnvironmentRequirement[] = [
  {
    name: 'LITELLM_PROXY_URL',
    required: true,
    description: 'URL of the LiteLLM proxy for AI model access',
    validate: (v) => v.startsWith('http://') || v.startsWith('https://'),
    validationMessage: 'Must be a valid HTTP/HTTPS URL',
  },
  {
    name: 'DB_SECRET_ARN',
    required: true,
    description: 'ARN of the AWS Secrets Manager secret containing database credentials',
    validate: (v) => v.startsWith('arn:aws:secretsmanager:'),
    validationMessage: 'Must be a valid AWS Secrets Manager ARN',
  },
  {
    name: 'DB_CLUSTER_ARN',
    required: true,
    description: 'ARN of the Aurora database cluster',
    validate: (v) => v.startsWith('arn:aws:rds:'),
    validationMessage: 'Must be a valid AWS RDS ARN',
  },
  {
    name: 'AWS_REGION',
    required: true,
    description: 'AWS region for service calls',
    defaultValue: 'us-east-1',
  },
];

/**
 * Optional but recommended environment variables.
 */
export const RECOMMENDED_REQUIREMENTS: EnvironmentRequirement[] = [
  {
    name: 'LITELLM_API_KEY',
    required: false,
    description: 'API key for LiteLLM authentication',
  },
  {
    name: 'REDIS_URL',
    required: false,
    description: 'Redis URL for rate limiting and caching',
    validate: (v) => v.startsWith('redis://') || v.startsWith('rediss://'),
    validationMessage: 'Must be a valid Redis URL',
  },
  {
    name: 'CATO_API_URL',
    required: false,
    description: 'URL of the Cato safety service',
  },
  {
    name: 'MISSION_CONTROL_URL',
    required: false,
    description: 'URL of Mission Control for HITL workflows',
  },
  {
    name: 'LOG_LEVEL',
    required: false,
    description: 'Logging level (debug, info, warn, error)',
    defaultValue: 'info',
    validate: (v) => ['debug', 'info', 'warn', 'error'].includes(v.toLowerCase()),
    validationMessage: 'Must be one of: debug, info, warn, error',
  },
  {
    name: 'RADIANT_ENV',
    required: false,
    description: 'Environment name (development, staging, production)',
    defaultValue: 'development',
    validate: (v) => ['development', 'staging', 'production'].includes(v.toLowerCase()),
    validationMessage: 'Must be one of: development, staging, production',
  },
];

/**
 * Feature-specific environment variables.
 */
export const FEATURE_REQUIREMENTS: Record<string, EnvironmentRequirement[]> = {
  consciousness: [
    {
      name: 'CONSCIOUSNESS_ENABLED',
      required: false,
      description: 'Enable consciousness engine features',
      defaultValue: 'true',
    },
    {
      name: 'UNSLOTH_TRAINING_ENDPOINT',
      required: false,
      description: 'Endpoint for Unsloth LoRA training',
    },
  ],
  grimoire: [
    {
      name: 'GRIMOIRE_ENABLED',
      required: false,
      description: 'Enable The Grimoire procedural memory',
      defaultValue: 'true',
    },
  ],
  governor: [
    {
      name: 'GOVERNOR_MODE',
      required: false,
      description: 'Economic Governor mode (performance, balanced, cost_saver, off)',
      defaultValue: 'balanced',
      validate: (v) => ['performance', 'balanced', 'cost_saver', 'off'].includes(v),
      validationMessage: 'Must be one of: performance, balanced, cost_saver, off',
    },
  ],
  rateLimit: [
    {
      name: 'RATE_LIMIT_ENABLED',
      required: false,
      description: 'Enable rate limiting',
      defaultValue: 'true',
    },
    {
      name: 'RATE_LIMIT_REQUESTS_PER_MINUTE',
      required: false,
      description: 'Default requests per minute limit',
      defaultValue: '100',
      validate: (v) => !isNaN(parseInt(v, 10)) && parseInt(v, 10) > 0,
      validationMessage: 'Must be a positive integer',
    },
  ],
};

/**
 * Validate a single environment requirement.
 */
function validateRequirement(
  req: EnvironmentRequirement
): { value: string | undefined; error?: string; warning?: string } {
  const value = process.env[req.name];
  
  // Check if required and missing
  if (req.required !== false && !value) {
    return {
      value: undefined,
      error: `Missing required environment variable: ${req.name}${req.description ? ` (${req.description})` : ''}`,
    };
  }
  
  // Use default if not set
  if (!value && req.defaultValue !== undefined) {
    return { value: req.defaultValue };
  }
  
  // Warn if recommended but not set
  if (!value && req.required === false && !req.defaultValue) {
    return {
      value: undefined,
      warning: `Recommended environment variable not set: ${req.name}${req.description ? ` (${req.description})` : ''}`,
    };
  }
  
  // Validate value if validator provided
  if (value && req.validate && !req.validate(value)) {
    return {
      value,
      error: `Invalid value for ${req.name}: ${req.validationMessage || 'validation failed'}`,
    };
  }
  
  return { value };
}

/**
 * Validate environment configuration.
 * 
 * @param requirements Array of requirements to validate
 * @param throwOnError Whether to throw CriticalConfigurationError on missing required vars
 * @returns Validation result with errors, warnings, and resolved config
 */
export function validateConfig(
  requirements: EnvironmentRequirement[],
  throwOnError: boolean = false
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const resolvedConfig: Record<string, string> = {};
  
  for (const req of requirements) {
    const result = validateRequirement(req);
    
    if (result.error) {
      errors.push(result.error);
    }
    if (result.warning) {
      warnings.push(result.warning);
    }
    if (result.value !== undefined) {
      resolvedConfig[req.name] = result.value;
    }
  }
  
  const valid = errors.length === 0;
  
  if (!valid && throwOnError) {
    const missingVars = requirements
      .filter(r => r.required !== false && !process.env[r.name])
      .map(r => r.name);
    
    throw new CriticalConfigurationError(
      `Critical configuration errors:\n${errors.join('\n')}`,
      missingVars,
      errors
    );
  }
  
  return { valid, errors, warnings, resolvedConfig };
}

/**
 * Validate all core environment variables.
 * Call this at Lambda cold start to fail fast on missing config.
 * 
 * @throws CriticalConfigurationError if required variables are missing
 */
export function validateEnvironment(): ValidationResult {
  console.log('[CONFIG] Validating environment configuration...');
  
  // Validate core requirements (will throw on error)
  const coreResult = validateConfig(CORE_REQUIREMENTS, true);
  
  // Validate recommended (warnings only)
  const recommendedResult = validateConfig(RECOMMENDED_REQUIREMENTS, false);
  
  // Log warnings
  for (const warning of recommendedResult.warnings) {
    console.warn(`[CONFIG WARNING] ${warning}`);
  }
  
  // Merge results
  const result: ValidationResult = {
    valid: coreResult.valid,
    errors: [...coreResult.errors, ...recommendedResult.errors],
    warnings: [...coreResult.warnings, ...recommendedResult.warnings],
    resolvedConfig: { ...coreResult.resolvedConfig, ...recommendedResult.resolvedConfig },
  };
  
  console.log(`[CONFIG] Environment validation complete. Valid: ${result.valid}, Warnings: ${result.warnings.length}`);
  
  return result;
}

/**
 * Validate feature-specific environment variables.
 * Call this when enabling specific features.
 * 
 * @param featureName Name of the feature to validate
 * @param throwOnError Whether to throw on missing required vars
 */
export function validateFeatureConfig(
  featureName: keyof typeof FEATURE_REQUIREMENTS,
  throwOnError: boolean = false
): ValidationResult {
  const requirements = FEATURE_REQUIREMENTS[featureName];
  
  if (!requirements) {
    return {
      valid: true,
      errors: [],
      warnings: [`Unknown feature: ${featureName}`],
      resolvedConfig: {},
    };
  }
  
  return validateConfig(requirements, throwOnError);
}

/**
 * Get a required environment variable or throw.
 * Use this for inline validation of critical config.
 * 
 * @param name Environment variable name
 * @param description Description for error message
 * @throws CriticalConfigurationError if not set
 */
export function requireEnv(name: string, description?: string): string {
  const value = process.env[name];
  
  if (!value) {
    throw new CriticalConfigurationError(
      `Required environment variable not set: ${name}${description ? ` (${description})` : ''}`,
      [name],
      [`Missing: ${name}`]
    );
  }
  
  return value;
}

/**
 * Get an optional environment variable with a default.
 * 
 * @param name Environment variable name
 * @param defaultValue Default value if not set
 */
export function getEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

/**
 * Get an optional environment variable as a number.
 * 
 * @param name Environment variable name
 * @param defaultValue Default value if not set or invalid
 */
export function getEnvNumber(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;
  
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get an optional environment variable as a boolean.
 * 
 * @param name Environment variable name
 * @param defaultValue Default value if not set
 */
export function getEnvBoolean(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (!value) return defaultValue;
  
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Check if running in production environment.
 */
export function isProduction(): boolean {
  return getEnv('RADIANT_ENV', 'development').toLowerCase() === 'production';
}

/**
 * Check if running in development environment.
 */
export function isDevelopment(): boolean {
  return getEnv('RADIANT_ENV', 'development').toLowerCase() === 'development';
}
