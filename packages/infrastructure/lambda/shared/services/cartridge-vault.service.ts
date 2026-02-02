/**
 * Cartridge Vault Service (Keyhole Pattern)
 * 
 * Manages secrets for cartridges - cartridges declare required secrets
 * but never contain actual credentials. Service Layer fetches from Genesis Vault.
 * 
 * @version 1.0.0
 * @since v6.2.0
 */

import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';
import { executeStatement } from '../db/client';
import { logger } from '../logging/enhanced-logger';
import crypto from 'crypto';

import type {
  VaultSecret,
  VaultAccessLog,
  VaultSecretCategory,
  VaultSecretRequirement,
  CartridgeVaultManifest,
  VaultRequirementCheck,
  VaultSecretsContext,
  VaultDashboard,
  CreateVaultSecretRequest,
  UpdateVaultSecretRequest,
  RotateVaultSecretRequest,
} from '@radiant/shared';

const kmsClient = new KMSClient({});

const KMS_KEY_ARN = process.env.VAULT_KMS_KEY_ARN || process.env.KMS_KEY_ARN || '';

export class CartridgeVaultService {
  /**
   * Store a new secret in the vault
   */
  async createSecret(
    tenantId: string,
    request: CreateVaultSecretRequest,
    createdBy: string
  ): Promise<VaultSecret> {
    const encryptedValue = await this.encryptValue(request.value);

    const result = await executeStatement(
      `INSERT INTO vault_secrets (
        tenant_id, key, category, description, encrypted_value, kms_key_arn,
        expires_at, rotation_schedule
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, tenant_id, key, category, description, encrypted_value,
        kms_key_arn, version, access_count, last_accessed_at, is_active,
        expires_at, rotation_schedule, last_rotated_at, created_at, updated_at`,
      [
        tenantId,
        request.key,
        request.category,
        request.description,
        encryptedValue,
        KMS_KEY_ARN,
        request.expiresAt || null,
        request.rotationSchedule || null,
      ]
    );

    await this.logAccess(tenantId, result.rows[0].id as string, request.key, createdBy, 'write', true);

    return this.mapSecret(result.rows[0]);
  }

  /**
   * Get a secret value (decrypted)
   */
  async getSecretValue(
    tenantId: string,
    key: string,
    accessedBy: string,
    cartridgeId?: string,
    operationId?: string
  ): Promise<string | null> {
    const result = await executeStatement(
      `UPDATE vault_secrets 
       SET access_count = access_count + 1, last_accessed_at = NOW()
       WHERE tenant_id = $1 AND key = $2 AND is_active = true
       RETURNING id, encrypted_value, kms_key_arn`,
      [tenantId, key]
    );

    if (result.rows.length === 0) {
      await this.logAccess(tenantId, '', key, accessedBy, 'read', false, 'Secret not found', cartridgeId, operationId);
      return null;
    }

    const row = result.rows[0] as { id: string; encrypted_value: string; kms_key_arn: string };
    
    try {
      const decrypted = await this.decryptValue(row.encrypted_value);
      await this.logAccess(tenantId, row.id, key, accessedBy, 'read', true, undefined, cartridgeId, operationId);
      return decrypted;
    } catch (error) {
      await this.logAccess(tenantId, row.id, key, accessedBy, 'read', false, String(error), cartridgeId, operationId);
      throw error;
    }
  }

  /**
   * Update a secret
   */
  async updateSecret(
    tenantId: string,
    key: string,
    request: UpdateVaultSecretRequest,
    updatedBy: string
  ): Promise<VaultSecret> {
    const updates: string[] = [];
    const values: unknown[] = [tenantId, key];
    let paramIndex = 3;

    if (request.value !== undefined) {
      const encryptedValue = await this.encryptValue(request.value);
      updates.push(`encrypted_value = $${paramIndex++}`);
      values.push(encryptedValue);
      updates.push(`version = version + 1`);
    }

    if (request.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(request.description);
    }

    if (request.expiresAt !== undefined) {
      updates.push(`expires_at = $${paramIndex++}`);
      values.push(request.expiresAt);
    }

    if (request.rotationSchedule !== undefined) {
      updates.push(`rotation_schedule = $${paramIndex++}`);
      values.push(request.rotationSchedule);
    }

    if (request.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(request.isActive);
    }

    if (updates.length === 0) {
      throw new Error('No updates provided');
    }

    const result = await executeStatement(
      `UPDATE vault_secrets SET ${updates.join(', ')}
       WHERE tenant_id = $1 AND key = $2
       RETURNING id, tenant_id, key, category, description, encrypted_value,
         kms_key_arn, version, access_count, last_accessed_at, is_active,
         expires_at, rotation_schedule, last_rotated_at, created_at, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error(`Secret not found: ${key}`);
    }

    await this.logAccess(tenantId, result.rows[0].id as string, key, updatedBy, 'write', true);

    return this.mapSecret(result.rows[0]);
  }

  /**
   * Rotate a secret (creates history entry)
   */
  async rotateSecret(
    tenantId: string,
    key: string,
    request: RotateVaultSecretRequest,
    rotatedBy: string
  ): Promise<VaultSecret> {
    // Get current secret
    const current = await executeStatement(
      `SELECT id, encrypted_value, kms_key_arn, version FROM vault_secrets
       WHERE tenant_id = $1 AND key = $2 AND is_active = true`,
      [tenantId, key]
    );

    if (current.rows.length === 0) {
      throw new Error(`Secret not found: ${key}`);
    }

    const currentRow = current.rows[0] as { id: string; encrypted_value: string; kms_key_arn: string; version: number };

    // Store in history
    await executeStatement(
      `INSERT INTO vault_secret_history (secret_id, tenant_id, version, encrypted_value, kms_key_arn, rotated_by, rotation_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [currentRow.id, tenantId, currentRow.version, currentRow.encrypted_value, currentRow.kms_key_arn, rotatedBy, request.reason]
    );

    // Update with new value
    const encryptedValue = await this.encryptValue(request.newValue);
    const result = await executeStatement(
      `UPDATE vault_secrets SET encrypted_value = $3, version = version + 1, last_rotated_at = NOW()
       WHERE tenant_id = $1 AND key = $2
       RETURNING id, tenant_id, key, category, description, encrypted_value,
         kms_key_arn, version, access_count, last_accessed_at, is_active,
         expires_at, rotation_schedule, last_rotated_at, created_at, updated_at`,
      [tenantId, key, encryptedValue]
    );

    await this.logAccess(tenantId, currentRow.id, key, rotatedBy, 'rotate', true);

    logger.info('Secret rotated', { tenantId, key, newVersion: result.rows[0].version });

    return this.mapSecret(result.rows[0]);
  }

  /**
   * Delete a secret
   */
  async deleteSecret(tenantId: string, key: string, deletedBy: string): Promise<void> {
    const result = await executeStatement(
      `DELETE FROM vault_secrets WHERE tenant_id = $1 AND key = $2 RETURNING id`,
      [tenantId, key]
    );

    if (result.rows.length === 0) {
      throw new Error(`Secret not found: ${key}`);
    }

    await this.logAccess(tenantId, result.rows[0].id as string, key, deletedBy, 'delete', true);
  }

  /**
   * List all secrets for a tenant (without values)
   */
  async listSecrets(tenantId: string, category?: VaultSecretCategory): Promise<VaultSecret[]> {
    let query = `SELECT id, tenant_id, key, category, description, '' as encrypted_value,
                   kms_key_arn, version, access_count, last_accessed_at, is_active,
                   expires_at, rotation_schedule, last_rotated_at, created_at, updated_at
                 FROM vault_secrets WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];

    if (category) {
      query += ` AND category = $2`;
      params.push(category);
    }

    query += ` ORDER BY key`;

    const result = await executeStatement(query, params);
    return result.rows.map(row => this.mapSecret(row));
  }

  /**
   * Check vault requirements for a cartridge
   */
  async checkRequirements(
    tenantId: string,
    manifest: CartridgeVaultManifest
  ): Promise<VaultRequirementCheck> {
    const allRequirements = [...manifest.requires, ...(manifest.optional || [])];
    const requiredKeys = new Set(manifest.requires.map(r => r.key));

    const result = await executeStatement(
      `SELECT key, is_active, expires_at FROM vault_secrets
       WHERE tenant_id = $1 AND key = ANY($2)`,
      [tenantId, allRequirements.map(r => r.key)] as unknown[]
    );

    const available = new Map<string, { isActive: boolean; expiresAt: string | null }>();
    for (const row of result.rows) {
      const r = row as { key: string; is_active: boolean; expires_at: string | null };
      available.set(r.key, { isActive: r.is_active, expiresAt: r.expires_at });
    }

    const missingRequired: string[] = [];
    const missingOptional: string[] = [];
    const availableKeys: string[] = [];
    const expiringSoon: { key: string; expiresAt: string }[] = [];
    const validationErrors: { key: string; error: string }[] = [];

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    for (const req of allRequirements) {
      const secret = available.get(req.key);
      
      if (!secret || !secret.isActive) {
        if (requiredKeys.has(req.key)) {
          missingRequired.push(req.key);
        } else {
          missingOptional.push(req.key);
        }
      } else {
        availableKeys.push(req.key);
        
        if (secret.expiresAt && new Date(secret.expiresAt) < thirtyDaysFromNow) {
          expiringSoon.push({ key: req.key, expiresAt: secret.expiresAt });
        }
      }
    }

    return {
      satisfied: missingRequired.length === 0,
      missingRequired,
      missingOptional,
      available: availableKeys,
      validationErrors,
      expiringSoon,
    };
  }

  /**
   * Store vault requirements from a cartridge
   */
  async storeRequirements(
    tenantId: string,
    cartridgeId: string,
    manifest: CartridgeVaultManifest
  ): Promise<void> {
    // Clear existing requirements
    await executeStatement(
      `DELETE FROM cartridge_vault_requirements WHERE cartridge_id = $1 AND tenant_id = $2`,
      [cartridgeId, tenantId]
    );

    const allRequirements = [
      ...manifest.requires.map(r => ({ ...r, isRequired: true })),
      ...(manifest.optional || []).map(r => ({ ...r, isRequired: false })),
    ];

    for (const req of allRequirements) {
      await executeStatement(
        `INSERT INTO cartridge_vault_requirements (
          cartridge_id, tenant_id, secret_key, description, category, is_required,
          validation_pattern, example_format, env_fallback
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          cartridgeId,
          tenantId,
          req.key,
          req.description,
          req.category,
          req.isRequired,
          req.validationPattern || null,
          req.exampleFormat || null,
          req.envFallback ? JSON.stringify(req.envFallback) : null,
        ]
      );
    }

    // Update satisfaction status
    await this.updateRequirementSatisfaction(tenantId, cartridgeId);
  }

  /**
   * Update requirement satisfaction status
   */
  async updateRequirementSatisfaction(tenantId: string, cartridgeId: string): Promise<void> {
    await executeStatement(
      `UPDATE cartridge_vault_requirements r
       SET is_satisfied = EXISTS (
         SELECT 1 FROM vault_secrets s
         WHERE s.tenant_id = r.tenant_id AND s.key = r.secret_key AND s.is_active = true
       ), last_checked_at = NOW()
       WHERE r.tenant_id = $1 AND r.cartridge_id = $2`,
      [tenantId, cartridgeId]
    );
  }

  /**
   * Create a secrets context for runtime (Keyhole Pattern)
   */
  createSecretsContext(
    tenantId: string,
    cartridgeId: string,
    availableKeys: string[],
    operationId: string
  ): VaultSecretsContext {
    const service = this;
    
    return {
      operationId,
      cartridgeId,
      tenantId,
      availableKeys,
      
      async getSecret(key: string): Promise<string | null> {
        if (!availableKeys.includes(key)) {
          logger.warn('Attempted to access unavailable secret', { tenantId, cartridgeId, key });
          return null;
        }
        return service.getSecretValue(tenantId, key, 'service_layer', cartridgeId, operationId);
      },
      
      hasSecret(key: string): boolean {
        return availableKeys.includes(key);
      },
    };
  }

  /**
   * Get vault dashboard data
   */
  async getDashboard(tenantId: string): Promise<VaultDashboard> {
    const [stats, accessLog, cartridgesWithMissing] = await Promise.all([
      executeStatement(
        `SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE category = 'api_key') as api_key_count,
          COUNT(*) FILTER (WHERE category = 'database') as database_count,
          COUNT(*) FILTER (WHERE category = 'oauth') as oauth_count,
          COUNT(*) FILTER (WHERE category = 'encryption') as encryption_count,
          COUNT(*) FILTER (WHERE category = 'webhook') as webhook_count,
          COUNT(*) FILTER (WHERE category = 'custom') as custom_count,
          COUNT(*) FILTER (WHERE expires_at IS NOT NULL AND expires_at < NOW() + INTERVAL '30 days') as expiring_soon,
          COUNT(*) FILTER (WHERE last_accessed_at >= NOW() - INTERVAL '24 hours') as recently_accessed
         FROM vault_secrets WHERE tenant_id = $1 AND is_active = true`,
        [tenantId]
      ),
      executeStatement(
        `SELECT id, tenant_id, secret_id, secret_key, accessed_by, access_type,
           cartridge_id, operation_id, success, error_message, ip_address, user_agent, timestamp
         FROM vault_access_log
         WHERE tenant_id = $1 AND timestamp >= NOW() - INTERVAL '24 hours'
         ORDER BY timestamp DESC LIMIT 50`,
        [tenantId]
      ),
      executeStatement(
        `SELECT r.cartridge_id, c.name as cartridge_name, array_agg(r.secret_key) as missing_secrets
         FROM cartridge_vault_requirements r
         LEFT JOIN cartridges c ON c.id = r.cartridge_id
         WHERE r.tenant_id = $1 AND r.is_required = true AND r.is_satisfied = false
         GROUP BY r.cartridge_id, c.name`,
        [tenantId]
      ),
    ]);

    const statsRow = stats.rows[0] as Record<string, number>;

    return {
      totalSecrets: Number(statsRow.total),
      byCategory: {
        api_key: Number(statsRow.api_key_count),
        database: Number(statsRow.database_count),
        oauth: Number(statsRow.oauth_count),
        encryption: Number(statsRow.encryption_count),
        webhook: Number(statsRow.webhook_count),
        custom: Number(statsRow.custom_count),
      },
      expiringSoon: Number(statsRow.expiring_soon),
      recentlyAccessed: Number(statsRow.recently_accessed),
      recentAccess: accessLog.rows.map(row => this.mapAccessLog(row)),
      cartridgesWithMissingSecrets: cartridgesWithMissing.rows.map(row => ({
        cartridgeId: (row as Record<string, unknown>).cartridge_id as string,
        cartridgeName: (row as Record<string, unknown>).cartridge_name as string || 'Unknown',
        missingSecrets: (row as Record<string, unknown>).missing_secrets as string[],
      })),
    };
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  private async encryptValue(value: string): Promise<string> {
    if (!KMS_KEY_ARN) {
      // Fallback for local development
      const cipher = crypto.createCipher('aes-256-cbc', 'dev-key-not-for-production');
      let encrypted = cipher.update(value, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      return encrypted;
    }

    const command = new EncryptCommand({
      KeyId: KMS_KEY_ARN,
      Plaintext: Buffer.from(value, 'utf8'),
    });
    const response = await kmsClient.send(command);
    return Buffer.from(response.CiphertextBlob!).toString('base64');
  }

  private async decryptValue(encryptedValue: string): Promise<string> {
    if (!KMS_KEY_ARN) {
      // Fallback for local development
      const decipher = crypto.createDecipher('aes-256-cbc', 'dev-key-not-for-production');
      let decrypted = decipher.update(encryptedValue, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }

    const command = new DecryptCommand({
      CiphertextBlob: Buffer.from(encryptedValue, 'base64'),
    });
    const response = await kmsClient.send(command);
    return Buffer.from(response.Plaintext!).toString('utf8');
  }

  private async logAccess(
    tenantId: string,
    secretId: string,
    secretKey: string,
    accessedBy: string,
    accessType: 'read' | 'write' | 'rotate' | 'delete',
    success: boolean,
    errorMessage?: string,
    cartridgeId?: string,
    operationId?: string
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO vault_access_log (tenant_id, secret_id, secret_key, accessed_by, access_type, cartridge_id, operation_id, success, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [tenantId, secretId || null, secretKey, accessedBy, accessType, cartridgeId || null, operationId || null, success, errorMessage || null]
    );
  }

  private mapSecret(row: Record<string, unknown>): VaultSecret {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      key: row.key as string,
      category: row.category as VaultSecretCategory,
      description: row.description as string,
      encryptedValue: row.encrypted_value as string,
      kmsKeyArn: row.kms_key_arn as string,
      version: row.version as number,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
      lastAccessedAt: row.last_accessed_at ? (row.last_accessed_at as Date).toISOString() : undefined,
      accessCount: row.access_count as number,
      expiresAt: row.expires_at ? (row.expires_at as Date).toISOString() : undefined,
      isActive: row.is_active as boolean,
      rotationSchedule: row.rotation_schedule as string | undefined,
      lastRotatedAt: row.last_rotated_at ? (row.last_rotated_at as Date).toISOString() : undefined,
    };
  }

  private mapAccessLog(row: Record<string, unknown>): VaultAccessLog {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      secretId: row.secret_id as string,
      secretKey: row.secret_key as string,
      accessedBy: row.accessed_by as string,
      accessType: row.access_type as 'read' | 'write' | 'rotate' | 'delete',
      cartridgeId: row.cartridge_id as string | undefined,
      operationId: row.operation_id as string | undefined,
      success: row.success as boolean,
      errorMessage: row.error_message as string | undefined,
      ipAddress: row.ip_address as string | undefined,
      userAgent: row.user_agent as string | undefined,
      timestamp: (row.timestamp as Date).toISOString(),
    };
  }
}

export const cartridgeVaultService = new CartridgeVaultService();
