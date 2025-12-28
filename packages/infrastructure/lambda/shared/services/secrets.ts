/**
 * Secrets Management Service
 * 
 * Securely retrieve and cache secrets from AWS Secrets Manager
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
  CreateSecretCommand,
  UpdateSecretCommand,
  DeleteSecretCommand,
  DescribeSecretCommand,
} from '@aws-sdk/client-secrets-manager';
import { logger } from '../logger';

const secretsManager = new SecretsManagerClient({});

// In-memory cache for secrets
const secretsCache: Map<string, { value: string; expiresAt: number }> = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get a secret value by name
 */
export async function getSecret(secretName: string): Promise<string> {
  // Check cache first
  const cached = secretsCache.get(secretName);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const response = await secretsManager.send(new GetSecretValueCommand({
      SecretId: secretName,
    }));

    const value = response.SecretString || '';
    
    // Cache the secret
    secretsCache.set(secretName, {
      value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return value;
  } catch (error) {
    logger.error(`Failed to retrieve secret ${secretName}`, error instanceof Error ? error : new Error(String(error)));
    throw new Error(`Secret not found: ${secretName}`);
  }
}

/**
 * Get a secret as JSON
 */
export async function getSecretJson<T = Record<string, unknown>>(secretName: string): Promise<T> {
  const value = await getSecret(secretName);
  return JSON.parse(value) as T;
}

/**
 * Get a specific field from a JSON secret
 */
export async function getSecretField(secretName: string, field: string): Promise<string> {
  const secret = await getSecretJson(secretName);
  const value = (secret as Record<string, unknown>)[field];
  if (value === undefined) {
    throw new Error(`Field ${field} not found in secret ${secretName}`);
  }
  return String(value);
}

/**
 * Create a new secret
 */
export async function createSecret(
  name: string,
  value: string | Record<string, unknown>,
  description?: string
): Promise<{ arn: string; name: string }> {
  const secretString = typeof value === 'string' ? value : JSON.stringify(value);

  const response = await secretsManager.send(new CreateSecretCommand({
    Name: name,
    SecretString: secretString,
    Description: description,
  }));

  return {
    arn: response.ARN!,
    name: response.Name!,
  };
}

/**
 * Update an existing secret
 */
export async function updateSecret(
  name: string,
  value: string | Record<string, unknown>
): Promise<void> {
  const secretString = typeof value === 'string' ? value : JSON.stringify(value);

  await secretsManager.send(new UpdateSecretCommand({
    SecretId: name,
    SecretString: secretString,
  }));

  // Invalidate cache
  secretsCache.delete(name);
}

/**
 * Delete a secret
 */
export async function deleteSecret(
  name: string,
  forceDelete: boolean = false
): Promise<void> {
  await secretsManager.send(new DeleteSecretCommand({
    SecretId: name,
    ForceDeleteWithoutRecovery: forceDelete,
  }));

  // Remove from cache
  secretsCache.delete(name);
}

/**
 * Check if a secret exists
 */
export async function secretExists(name: string): Promise<boolean> {
  try {
    await secretsManager.send(new DescribeSecretCommand({
      SecretId: name,
    }));
    return true;
  } catch (error) {
    // Secret doesn't exist or access denied
    return false;
  }
}

/**
 * Invalidate cached secret
 */
export function invalidateSecret(secretName: string): void {
  secretsCache.delete(secretName);
}

/**
 * Clear all cached secrets
 */
export function clearSecretsCache(): void {
  secretsCache.clear();
}

// ============================================================================
// Pre-defined Secret Names
// ============================================================================

export const SecretNames = {
  // Database
  DATABASE_URL: 'radiant/database/url',
  DATABASE_CREDENTIALS: 'radiant/database/credentials',

  // AI Providers
  OPENAI_API_KEY: 'radiant/providers/openai',
  ANTHROPIC_API_KEY: 'radiant/providers/anthropic',
  GOOGLE_API_KEY: 'radiant/providers/google',
  COHERE_API_KEY: 'radiant/providers/cohere',
  MISTRAL_API_KEY: 'radiant/providers/mistral',

  // Infrastructure
  REDIS_URL: 'radiant/cache/redis',
  STRIPE_SECRET_KEY: 'radiant/billing/stripe',
  SENDGRID_API_KEY: 'radiant/email/sendgrid',

  // Auth
  JWT_SECRET: 'radiant/auth/jwt-secret',
  ENCRYPTION_KEY: 'radiant/auth/encryption-key',

  // Webhooks
  WEBHOOK_SIGNING_KEY: 'radiant/webhooks/signing-key',
};

/**
 * Get database connection string
 */
export async function getDatabaseUrl(): Promise<string> {
  try {
    return await getSecret(SecretNames.DATABASE_URL);
  } catch (error) {
    // Fallback to environment variable when Secrets Manager unavailable
    return process.env.DATABASE_URL || '';
  }
}

/**
 * Get AI provider API key
 */
export async function getProviderApiKey(provider: string): Promise<string> {
  const secretName = `radiant/providers/${provider.toLowerCase()}`;
  try {
    return await getSecret(secretName);
  } catch (error) {
    // Fallback to environment variable when Secrets Manager unavailable
    const envKey = `${provider.toUpperCase()}_API_KEY`;
    return process.env[envKey] || '';
  }
}
