/**
 * RADIANT v5.52.26 - OAuth Signing Key Management
 * 
 * Generates and manages RSA key pairs for JWT signing.
 * Keys are stored in AWS Secrets Manager.
 */

import { SecretsManagerClient, CreateSecretCommand, GetSecretValueCommand, UpdateSecretCommand } from '@aws-sdk/client-secrets-manager';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const secretsManager = new SecretsManagerClient({});

interface SigningKey {
  kid: string;
  publicKeyPem: string;
  privateKeySecretArn: string;
  algorithm: 'RS256';
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
}

interface JWK {
  kty: 'RSA';
  kid: string;
  use: 'sig';
  alg: 'RS256';
  n: string;
  e: string;
}

/**
 * Generate a new RSA key pair for JWT signing
 */
export async function generateSigningKey(
  tenantId: string,
  environment: string,
  appId: string
): Promise<SigningKey> {
  const kid = uuidv4();
  
  // Generate RSA key pair
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  // Store private key in Secrets Manager
  const secretName = `${appId}/${environment}/oauth/signing-key/${kid}`;
  
  const createSecretResponse = await secretsManager.send(new CreateSecretCommand({
    Name: secretName,
    SecretString: privateKey,
    Description: `OAuth JWT signing key for tenant ${tenantId}`,
    Tags: [
      { Key: 'tenant_id', Value: tenantId },
      { Key: 'environment', Value: environment },
      { Key: 'purpose', Value: 'oauth-jwt-signing' },
      { Key: 'kid', Value: kid },
    ],
  }));

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year

  return {
    kid,
    publicKeyPem: publicKey,
    privateKeySecretArn: createSecretResponse.ARN!,
    algorithm: 'RS256',
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    isActive: true,
  };
}

/**
 * Get private key from Secrets Manager for signing
 */
export async function getPrivateKey(secretArn: string): Promise<string> {
  const response = await secretsManager.send(new GetSecretValueCommand({
    SecretId: secretArn,
  }));

  if (!response.SecretString) {
    throw new Error('Private key not found in secret');
  }

  return response.SecretString;
}

/**
 * Convert PEM public key to JWK format for JWKS endpoint
 */
export function publicKeyToJWK(publicKeyPem: string, kid: string): JWK {
  const publicKey = crypto.createPublicKey(publicKeyPem);
  const jwk = publicKey.export({ format: 'jwk' });

  return {
    kty: 'RSA',
    kid,
    use: 'sig',
    alg: 'RS256',
    n: jwk.n as string,
    e: jwk.e as string,
  };
}

/**
 * Sign a JWT with the private key
 */
export async function signJWT(
  payload: Record<string, unknown>,
  privateKeySecretArn: string,
  kid: string
): Promise<string> {
  const privateKeyPem = await getPrivateKey(privateKeySecretArn);

  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  const signature = sign.sign(privateKeyPem);

  const encodedSignature = base64UrlEncode(signature);

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

/**
 * Verify a JWT signature
 */
export function verifyJWT(
  token: string,
  publicKeyPem: string
): { valid: boolean; payload?: Record<string, unknown>; error?: string } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid token format' };
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(signatureInput);
    
    const signature = base64UrlDecode(encodedSignature);
    const isValid = verify.verify(publicKeyPem, signature);

    if (!isValid) {
      return { valid: false, error: 'Invalid signature' };
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload).toString());

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, error: 'Token expired' };
    }

    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Verification failed' };
  }
}

/**
 * Base64 URL encode
 */
function base64UrlEncode(input: string | Buffer): string {
  const buffer = typeof input === 'string' ? Buffer.from(input) : input;
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Base64 URL decode
 */
function base64UrlDecode(input: string): Buffer {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64');
}

interface DbClient {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
}

/**
 * Store a signing key in the database
 */
export async function storeSigningKey(
  dbClient: DbClient,
  tenantId: string,
  signingKey: SigningKey
): Promise<void> {
  await dbClient.query(
    `INSERT INTO oauth_signing_keys (
      kid, tenant_id, public_key_pem, private_key_secret_arn, 
      algorithm, created_at, expires_at, is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      signingKey.kid,
      tenantId,
      signingKey.publicKeyPem,
      signingKey.privateKeySecretArn,
      signingKey.algorithm,
      signingKey.createdAt,
      signingKey.expiresAt,
      signingKey.isActive,
    ]
  );
}

/**
 * Get active signing keys for a tenant
 */
export async function getActiveSigningKeys(
  dbClient: DbClient,
  tenantId: string
): Promise<SigningKey[]> {
  const result = await dbClient.query(
    `SELECT kid, public_key_pem, private_key_secret_arn, algorithm, 
            created_at, expires_at, is_active
     FROM oauth_signing_keys
     WHERE tenant_id = $1 AND is_active = true
     ORDER BY created_at DESC`,
    [tenantId]
  );

  return (result.rows as Record<string, unknown>[]).map(row => ({
    kid: row.kid as string,
    publicKeyPem: row.public_key_pem as string,
    privateKeySecretArn: row.private_key_secret_arn as string,
    algorithm: row.algorithm as 'RS256',
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string,
    isActive: row.is_active as boolean,
  }));
}

/**
 * Get the current signing key (most recently created active key)
 */
export async function getCurrentSigningKey(
  dbClient: DbClient,
  tenantId: string
): Promise<SigningKey | null> {
  const keys = await getActiveSigningKeys(dbClient, tenantId);
  return keys.length > 0 ? keys[0] : null;
}

/**
 * Mark old signing keys as inactive
 */
export async function deactivateOldKeys(
  dbClient: DbClient,
  tenantId: string,
  keepKid: string
): Promise<number> {
  const result = await dbClient.query(
    `UPDATE oauth_signing_keys
     SET is_active = false, deactivated_at = NOW()
     WHERE tenant_id = $1 AND is_active = true AND kid != $2
     RETURNING kid`,
    [tenantId, keepKid]
  );

  return result.rows.length;
}

/**
 * Rotate signing keys (generate new, mark old as inactive)
 */
export async function rotateSigningKeys(
  tenantId: string,
  environment: string,
  appId: string,
  dbClient: DbClient
): Promise<SigningKey> {
  // Generate new key
  const newKey = await generateSigningKey(tenantId, environment, appId);

  // Store the new key in the database
  await storeSigningKey(dbClient, tenantId, newKey);

  // Mark old keys as inactive (keep them for verification of existing tokens)
  const deactivatedCount = await deactivateOldKeys(dbClient, tenantId, newKey.kid);
  
  if (deactivatedCount > 0) {
    console.log(`Deactivated ${deactivatedCount} old signing keys for tenant ${tenantId}`);
  }

  return newKey;
}

/**
 * Get all signing keys for JWKS endpoint (includes recently deactivated for grace period)
 */
export async function getJWKSKeys(
  dbClient: DbClient,
  tenantId: string
): Promise<JWK[]> {
  // Include keys deactivated within the last 24 hours for token verification grace period
  const result = await dbClient.query(
    `SELECT kid, public_key_pem
     FROM oauth_signing_keys
     WHERE tenant_id = $1 
       AND (is_active = true OR deactivated_at > NOW() - INTERVAL '24 hours')
     ORDER BY is_active DESC, created_at DESC`,
    [tenantId]
  );

  return (result.rows as Record<string, unknown>[]).map(row => 
    publicKeyToJWK(row.public_key_pem as string, row.kid as string)
  );
}

/**
 * Clean up expired keys from database and Secrets Manager
 */
export async function cleanupExpiredKeys(
  dbClient: DbClient,
  tenantId: string
): Promise<number> {
  // Find keys that expired more than 30 days ago
  const result = await dbClient.query(
    `SELECT kid, private_key_secret_arn
     FROM oauth_signing_keys
     WHERE tenant_id = $1 
       AND expires_at < NOW() - INTERVAL '30 days'
       AND is_active = false`,
    [tenantId]
  );

  const keysToDelete = result.rows as Array<{ kid: string; private_key_secret_arn: string }>;
  
  for (const key of keysToDelete) {
    try {
      // Delete from Secrets Manager (mark for deletion)
      await secretsManager.send(new UpdateSecretCommand({
        SecretId: key.private_key_secret_arn,
        Description: 'EXPIRED - Scheduled for deletion',
      }));
      
      // Delete from database
      await dbClient.query(
        `DELETE FROM oauth_signing_keys WHERE kid = $1 AND tenant_id = $2`,
        [key.kid, tenantId]
      );
    } catch (error) {
      console.error(`Failed to cleanup key ${key.kid}:`, error);
    }
  }

  return keysToDelete.length;
}
