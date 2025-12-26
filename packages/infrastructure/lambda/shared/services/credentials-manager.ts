import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';
import { executeStatement } from '../db/client';

type CredentialType = 'api_key' | 'oauth_token' | 'password' | 'certificate' | 'ssh_key' | 'other';
type AccessType = 'read' | 'create' | 'update' | 'rotate' | 'delete';

interface CredentialMetadata {
  description?: string;
  tags?: string[];
  provider?: string;
  [key: string]: unknown;
}

export class CredentialsManager {
  private kms: KMSClient;

  constructor() {
    this.kms = new KMSClient({});
  }

  async createVault(
    tenantId: string,
    vaultName: string,
    description?: string,
    createdBy?: string
  ): Promise<string> {
    const keyArn = this.getKeyArnForTenant(tenantId);

    const result = await executeStatement(
      `INSERT INTO credential_vaults (tenant_id, vault_name, description, encryption_key_arn, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'vaultName', value: { stringValue: vaultName } },
        { name: 'description', value: description ? { stringValue: description } : { isNull: true } },
        { name: 'keyArn', value: { stringValue: keyArn } },
        { name: 'createdBy', value: createdBy ? { stringValue: createdBy } : { isNull: true } },
      ]
    );

    return String((result.rows[0] as Record<string, unknown>)?.id || '');
  }

  async storeCredential(
    vaultId: string,
    name: string,
    type: CredentialType,
    value: string,
    metadata?: CredentialMetadata,
    createdBy?: string,
    expiresAt?: Date
  ): Promise<string> {
    const vault = await this.getVault(vaultId);
    const encrypted = await this.encrypt(value, vault.encryption_key_arn);

    const result = await executeStatement(
      `INSERT INTO stored_credentials 
       (vault_id, credential_name, credential_type, encrypted_value, metadata, created_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        { name: 'vaultId', value: { stringValue: vaultId } },
        { name: 'name', value: { stringValue: name } },
        { name: 'type', value: { stringValue: type } },
        { name: 'encrypted', value: { blobValue: encrypted } },
        { name: 'metadata', value: { stringValue: JSON.stringify(metadata || {}) } },
        { name: 'createdBy', value: createdBy ? { stringValue: createdBy } : { isNull: true } },
        { name: 'expiresAt', value: expiresAt ? { stringValue: expiresAt.toISOString() } : { isNull: true } },
      ]
    );

    return String((result.rows[0] as Record<string, unknown>)?.id || '');
  }

  async getCredential(
    credentialId: string,
    accessedBy: string,
    accessReason: string,
    sourceIp?: string
  ): Promise<string> {
    const result = await executeStatement(
      `SELECT sc.encrypted_value, cv.encryption_key_arn
       FROM stored_credentials sc
       JOIN credential_vaults cv ON sc.vault_id = cv.id
       WHERE sc.id = $1 AND sc.is_active = true`,
      [{ name: 'credentialId', value: { stringValue: credentialId } }]
    );

    if (result.rows.length === 0) {
      await this.logAccess(credentialId, accessedBy, 'read', accessReason, sourceIp ?? null, false);
      throw new Error('Credential not found or inactive');
    }

    const row = result.rows[0] as Record<string, unknown>;
    const encryptedValue = row.encrypted_value as Uint8Array;
    const keyArn = row.encryption_key_arn as string;

    const decrypted = await this.decrypt(encryptedValue, keyArn);
    await this.logAccess(credentialId, accessedBy, 'read', accessReason, sourceIp ?? null, true);

    return decrypted;
  }

  async rotateCredential(
    credentialId: string,
    newValue: string,
    rotatedBy: string
  ): Promise<void> {
    const result = await executeStatement(
      `SELECT sc.vault_id, cv.encryption_key_arn
       FROM stored_credentials sc
       JOIN credential_vaults cv ON sc.vault_id = cv.id
       WHERE sc.id = $1`,
      [{ name: 'credentialId', value: { stringValue: credentialId } }]
    );

    if (result.rows.length === 0) {
      throw new Error('Credential not found');
    }

    const row = result.rows[0] as Record<string, unknown>;
    const keyArn = row.encryption_key_arn as string;
    const encrypted = await this.encrypt(newValue, keyArn);

    await executeStatement(
      `UPDATE stored_credentials
       SET encrypted_value = $2, last_rotated = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [
        { name: 'credentialId', value: { stringValue: credentialId } },
        { name: 'encrypted', value: { blobValue: encrypted } },
      ]
    );

    await this.logAccess(credentialId, rotatedBy, 'rotate', 'Credential rotation', null, true);
  }

  async listCredentials(vaultId: string): Promise<unknown[]> {
    const result = await executeStatement(
      `SELECT id, credential_name, credential_type, metadata, expires_at, 
              last_rotated, is_active, created_at
       FROM stored_credentials
       WHERE vault_id = $1
       ORDER BY credential_name`,
      [{ name: 'vaultId', value: { stringValue: vaultId } }]
    );

    return result.rows;
  }

  async getExpiringCredentials(tenantId: string, daysAhead: number = 30): Promise<unknown[]> {
    const result = await executeStatement(
      `SELECT sc.id, sc.credential_name, sc.credential_type, sc.expires_at, cv.vault_name
       FROM stored_credentials sc
       JOIN credential_vaults cv ON sc.vault_id = cv.id
       WHERE cv.tenant_id = $1
       AND sc.is_active = true
       AND sc.expires_at IS NOT NULL
       AND sc.expires_at < NOW() + $2 * INTERVAL '1 day'
       ORDER BY sc.expires_at`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'daysAhead', value: { longValue: daysAhead } },
      ]
    );

    return result.rows;
  }

  private async getVault(vaultId: string): Promise<{ encryption_key_arn: string }> {
    const result = await executeStatement(
      `SELECT encryption_key_arn FROM credential_vaults WHERE id = $1`,
      [{ name: 'vaultId', value: { stringValue: vaultId } }]
    );

    if (result.rows.length === 0) {
      throw new Error('Vault not found');
    }

    const row = result.rows[0] as Record<string, unknown>;
    return { encryption_key_arn: String(row.encryption_key_arn) };
  }

  private async encrypt(plaintext: string, keyArn: string): Promise<Uint8Array> {
    const response = await this.kms.send(
      new EncryptCommand({
        KeyId: keyArn,
        Plaintext: Buffer.from(plaintext),
      })
    );
    return response.CiphertextBlob!;
  }

  private async decrypt(ciphertext: Uint8Array, keyArn: string): Promise<string> {
    const response = await this.kms.send(
      new DecryptCommand({
        KeyId: keyArn,
        CiphertextBlob: ciphertext,
      })
    );
    return Buffer.from(response.Plaintext!).toString();
  }

  private getKeyArnForTenant(tenantId: string): string {
    const accountId = process.env.AWS_ACCOUNT_ID || '000000000000';
    const region = process.env.AWS_REGION || 'us-east-1';
    return `arn:aws:kms:${region}:${accountId}:alias/radiant-${tenantId}`;
  }

  private async logAccess(
    credentialId: string,
    accessedBy: string,
    accessType: AccessType,
    accessReason: string,
    sourceIp: string | null,
    success: boolean
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO credential_access_log 
       (credential_id, accessed_by, access_type, access_reason, source_ip, success)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        { name: 'credentialId', value: { stringValue: credentialId } },
        { name: 'accessedBy', value: { stringValue: accessedBy } },
        { name: 'accessType', value: { stringValue: accessType } },
        { name: 'accessReason', value: { stringValue: accessReason } },
        { name: 'sourceIp', value: sourceIp ? { stringValue: sourceIp } : { isNull: true } },
        { name: 'success', value: { booleanValue: success } },
      ]
    );
  }
}

export const credentialsManager = new CredentialsManager();
