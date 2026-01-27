/**
 * UDS Encryption Service
 * Handles AES-256-GCM encryption/decryption for user data
 * 
 * Uses AWS KMS for key management with envelope encryption:
 * - Master Key (KMS) encrypts Data Keys
 * - Data Keys (DEK) encrypt actual content
 * - Per-tenant keys with optional per-user keys
 */

import { KMSClient, GenerateDataKeyCommand, DecryptCommand, EncryptCommand } from '@aws-sdk/client-kms';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { executeStatement, stringParam } from '../../db/client';
import { enhancedLogger as logger } from '../../logging/enhanced-logger';
import type { UDSEncryptionKey } from '@radiant/shared';

// =============================================================================
// Constants
// =============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;  // 96 bits for GCM
const AUTH_TAG_LENGTH = 16;  // 128 bits
const KEY_SPEC = 'AES_256';

// Cache for data keys (short-lived)
const dataKeyCache = new Map<string, { key: Buffer; expiresAt: Date }>();
const KEY_CACHE_TTL_MS = 5 * 60 * 1000;  // 5 minutes

// =============================================================================
// Types
// =============================================================================

export interface EncryptedData {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  keyId: string;
  keyVersion: number;
}

export interface EncryptedField {
  encrypted: Buffer;
  iv: Buffer;
}

interface DataKeyResult {
  plaintextKey: Buffer;
  encryptedKey: Buffer;
  keyId: string;
}

// =============================================================================
// Service
// =============================================================================

class UDSEncryptionService {
  private kmsClient: KMSClient;
  private kmsKeyAlias: string;

  constructor() {
    this.kmsClient = new KMSClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    this.kmsKeyAlias = process.env.UDS_KMS_KEY_ALIAS || 'alias/radiant-uds-master';
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Encrypt content for a tenant/user
   */
  async encrypt(
    tenantId: string,
    content: string | Buffer,
    userId?: string
  ): Promise<EncryptedField> {
    const contentBuffer = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
    
    // Get or create data encryption key
    const dataKey = await this.getDataKey(tenantId, userId);
    
    // Generate random IV
    const iv = randomBytes(IV_LENGTH);
    
    // Encrypt with AES-256-GCM
    const cipher = createCipheriv(ALGORITHM, dataKey.plaintextKey, iv, { authTagLength: AUTH_TAG_LENGTH });
    const encrypted = Buffer.concat([cipher.update(contentBuffer), cipher.final()]);
    const authTag = cipher.getAuthTag();
    
    // Combine ciphertext and auth tag
    const combined = Buffer.concat([encrypted, authTag]);
    
    return {
      encrypted: combined,
      iv,
    };
  }

  /**
   * Decrypt content for a tenant/user
   */
  async decrypt(
    tenantId: string,
    encrypted: Buffer,
    iv: Buffer,
    userId?: string
  ): Promise<string> {
    // Get data encryption key
    const dataKey = await this.getDataKey(tenantId, userId);
    
    // Split ciphertext and auth tag
    const authTag = encrypted.slice(-AUTH_TAG_LENGTH);
    const ciphertext = encrypted.slice(0, -AUTH_TAG_LENGTH);
    
    // Decrypt with AES-256-GCM
    const decipher = createDecipheriv(ALGORITHM, dataKey.plaintextKey, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    
    return decrypted.toString('utf8');
  }

  /**
   * Encrypt multiple fields efficiently (same key)
   */
  async encryptFields(
    tenantId: string,
    fields: Record<string, string | null | undefined>,
    userId?: string
  ): Promise<Record<string, EncryptedField | null>> {
    const result: Record<string, EncryptedField | null> = {};
    
    // Get key once for all fields
    const dataKey = await this.getDataKey(tenantId, userId);
    
    for (const [key, value] of Object.entries(fields)) {
      if (value === null || value === undefined) {
        result[key] = null;
        continue;
      }
      
      const contentBuffer = Buffer.from(value, 'utf8');
      const iv = randomBytes(IV_LENGTH);
      
      const cipher = createCipheriv(ALGORITHM, dataKey.plaintextKey, iv, { authTagLength: AUTH_TAG_LENGTH });
      const encrypted = Buffer.concat([cipher.update(contentBuffer), cipher.final()]);
      const authTag = cipher.getAuthTag();
      
      result[key] = {
        encrypted: Buffer.concat([encrypted, authTag]),
        iv,
      };
    }
    
    return result;
  }

  /**
   * Decrypt multiple fields efficiently
   */
  async decryptFields(
    tenantId: string,
    fields: Record<string, { encrypted: Buffer; iv: Buffer } | null>,
    userId?: string
  ): Promise<Record<string, string | null>> {
    const result: Record<string, string | null> = {};
    
    // Get key once for all fields
    const dataKey = await this.getDataKey(tenantId, userId);
    
    for (const [key, value] of Object.entries(fields)) {
      if (value === null) {
        result[key] = null;
        continue;
      }
      
      const authTag = value.encrypted.slice(-AUTH_TAG_LENGTH);
      const ciphertext = value.encrypted.slice(0, -AUTH_TAG_LENGTH);
      
      const decipher = createDecipheriv(ALGORITHM, dataKey.plaintextKey, value.iv, { authTagLength: AUTH_TAG_LENGTH });
      decipher.setAuthTag(authTag);
      
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      result[key] = decrypted.toString('utf8');
    }
    
    return result;
  }

  /**
   * Calculate SHA-256 hash of content
   */
  calculateHash(content: string | Buffer): string {
    const hash = createHash('sha256');
    hash.update(typeof content === 'string' ? content : content.toString('utf8'));
    return hash.digest('hex');
  }

  /**
   * Get encryption key info for a tenant
   */
  async getKeyInfo(tenantId: string, userId?: string): Promise<UDSEncryptionKey | null> {
    const result = await executeStatement(
      `SELECT * FROM uds_encryption_keys 
       WHERE tenant_id = $1 
       AND ($2::UUID IS NULL AND user_id IS NULL OR user_id = $2)
       AND is_active = true
       ORDER BY version DESC LIMIT 1`,
      [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId || ''),
      ]
    );

    if (!result.rows?.length) {
      return null;
    }

    return this.mapKeyRow(result.rows[0]);
  }

  /**
   * Rotate encryption key for a tenant
   */
  async rotateKey(tenantId: string, userId?: string): Promise<UDSEncryptionKey> {
    logger.info('Rotating encryption key', { tenantId, userId });

    // Get current key version
    const currentKey = await this.getKeyInfo(tenantId, userId);
    const newVersion = (currentKey?.version || 0) + 1;

    // Deactivate old key
    if (currentKey) {
      await executeStatement(
        `UPDATE uds_encryption_keys SET is_active = false WHERE id = $1`,
        [stringParam('id', currentKey.id)]
      );
    }

    // Create new key entry
    const keyId = `aws/kms/uds-${tenantId}${userId ? `-${userId}` : ''}-v${newVersion}`;
    const keyType = userId ? 'user' : 'tenant';

    const result = await executeStatement(
      `INSERT INTO uds_encryption_keys (tenant_id, user_id, key_id, key_type, version)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId || ''),
        stringParam('keyId', keyId),
        stringParam('keyType', keyType),
        stringParam('version', String(newVersion)),
      ]
    );

    // Clear cache for this tenant/user
    this.clearCache(tenantId, userId);

    logger.info('Encryption key rotated', { tenantId, userId, newVersion });

    return this.mapKeyRow(result.rows[0]);
  }

  /**
   * Initialize encryption for a tenant
   */
  async initializeTenant(tenantId: string): Promise<UDSEncryptionKey> {
    logger.info('Initializing encryption for tenant', { tenantId });

    // Check if key exists
    const existing = await this.getKeyInfo(tenantId);
    if (existing) {
      return existing;
    }

    // Create initial key entry
    const keyId = `aws/kms/uds-${tenantId}-v1`;

    const result = await executeStatement(
      `INSERT INTO uds_encryption_keys (tenant_id, key_id, key_type, version)
       VALUES ($1, $2, 'tenant', 1)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [
        stringParam('tenantId', tenantId),
        stringParam('keyId', keyId),
      ]
    );

    if (!result.rows?.length) {
      // Race condition - key was created by another process
      const created = await this.getKeyInfo(tenantId);
      if (created) return created;
      throw new Error('Failed to initialize encryption for tenant');
    }

    return this.mapKeyRow(result.rows[0]);
  }

  /**
   * Re-encrypt content with new key (for key rotation)
   */
  async reEncrypt(
    tenantId: string,
    encrypted: Buffer,
    iv: Buffer,
    oldUserId?: string,
    newUserId?: string
  ): Promise<EncryptedField> {
    // Decrypt with old key
    const plaintext = await this.decrypt(tenantId, encrypted, iv, oldUserId);
    
    // Encrypt with new key
    return this.encrypt(tenantId, plaintext, newUserId);
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Get data encryption key (from cache or generate new)
   */
  private async getDataKey(tenantId: string, userId?: string): Promise<DataKeyResult> {
    const cacheKey = this.getCacheKey(tenantId, userId);
    
    // Check cache
    const cached = dataKeyCache.get(cacheKey);
    if (cached && cached.expiresAt > new Date()) {
      return {
        plaintextKey: cached.key,
        encryptedKey: Buffer.alloc(0),  // Not needed for cached key
        keyId: cacheKey,
      };
    }

    // Generate new data key from KMS
    const command = new GenerateDataKeyCommand({
      KeyId: this.kmsKeyAlias,
      KeySpec: KEY_SPEC,
      EncryptionContext: {
        tenantId,
        ...(userId && { userId }),
        service: 'uds',
      },
    });

    try {
      const response = await this.kmsClient.send(command);
      
      if (!response.Plaintext || !response.CiphertextBlob) {
        throw new Error('KMS did not return key material');
      }

      const plaintextKey = Buffer.from(response.Plaintext);
      const encryptedKey = Buffer.from(response.CiphertextBlob);

      // Cache the key
      dataKeyCache.set(cacheKey, {
        key: plaintextKey,
        expiresAt: new Date(Date.now() + KEY_CACHE_TTL_MS),
      });

      return {
        plaintextKey,
        encryptedKey,
        keyId: cacheKey,
      };
    } catch (error) {
      logger.error('Failed to generate data key', { tenantId, userId, error });
      throw new Error('Encryption service unavailable');
    }
  }

  /**
   * Clear cache for tenant/user
   */
  private clearCache(tenantId: string, userId?: string): void {
    const cacheKey = this.getCacheKey(tenantId, userId);
    dataKeyCache.delete(cacheKey);
  }

  /**
   * Generate cache key
   */
  private getCacheKey(tenantId: string, userId?: string): string {
    return userId ? `${tenantId}:${userId}` : tenantId;
  }

  /**
   * Map database row to UDSEncryptionKey
   */
  private mapKeyRow(row: Record<string, unknown>): UDSEncryptionKey {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      userId: row.user_id as string | undefined,
      keyId: row.key_id as string,
      keyType: row.key_type as 'tenant' | 'user' | 'conversation',
      algorithm: row.algorithm as string,
      version: row.version as number,
      isActive: row.is_active as boolean,
      createdAt: new Date(row.created_at as string),
      rotatedAt: row.rotated_at ? new Date(row.rotated_at as string) : undefined,
      expiresAt: row.expires_at ? new Date(row.expires_at as string) : undefined,
    };
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const udsEncryptionService = new UDSEncryptionService();
