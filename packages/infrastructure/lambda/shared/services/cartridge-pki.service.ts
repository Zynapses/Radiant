/**
 * RADIANT Cartridge PKI Service
 * Cryptographic signing and verification for .RADz cartridges
 * 
 * Security Architecture v8.0:
 * - Radiant Root CA → Tenant Intermediate CA → Cartridge Signatures
 * - Dual signatures: author_check (tenant) + platform_check (Radiant)
 * - SHA-256 hash + Ed25519 asymmetric encryption
 * - Federated trust for multi-cluster deployments
 */

import { KMSClient, SignCommand, VerifyCommand, GetPublicKeyCommand, SigningAlgorithmSpec } from '@aws-sdk/client-kms';
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'crypto';
import { executeStatement, stringParam, boolParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import type {
  CartridgeSignatureBlock,
  CartridgeSignature,
  CartridgeMetadata,
  CartridgeVerificationResult,
  CartridgeSignatureVerificationStatus,
  KeyAlgorithm,
  ClusterCompatibility,
  CompatibilityCheckResult,
  RadiantApp,
} from './cartridge-pki.types';

// Local type definitions until shared package is rebuilt
interface TenantCACertificate {
  id: string;
  tenantId: string;
  tenantName: string;
  rootCaId: string;
  publicKey: string;
  fingerprint: string;
  algorithm: KeyAlgorithm;
  validFrom: Date;
  validUntil: Date;
  status: 'active' | 'revoked' | 'expired' | 'pending';
  signedByRootAt: Date;
  rootSignature: string;
  createdAt: Date;
  revokedAt?: Date;
  revokedReason?: string;
}

interface CartridgeSigningKey {
  id: string;
  tenantId: string;
  tenantCaId: string;
  keyId: string;
  keyArn?: string;
  publicKey: string;
  fingerprint: string;
  algorithm: KeyAlgorithm;
  purpose: 'author' | 'platform';
  validFrom: Date;
  validUntil: Date;
  status: 'active' | 'revoked' | 'expired' | 'pending';
  createdAt: Date;
  lastUsedAt?: Date;
  usageCount: number;
}

interface PKIAuditEntry {
  id: string;
  action: 'sign' | 'verify' | 'generate_ca' | 'revoke' | 'add_trust' | 'remove_trust';
  targetType: 'cartridge' | 'tenant_ca' | 'signing_key' | 'trusted_root';
  targetId: string;
  performedBy: string;
  performedAt: Date;
  success: boolean;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

interface PKIDashboard {
  rootCA: {
    clusterId: string;
    fingerprint: string;
    validUntil: Date;
    status: 'active' | 'revoked' | 'expired' | 'pending';
  };
  tenantCAs: {
    total: number;
    active: number;
    expiringSoon: number;
    revoked: number;
  };
  signingKeys: {
    total: number;
    active: number;
    usedToday: number;
  };
  signatures: {
    totalSigned: number;
    signedToday: number;
    verificationsToday: number;
    failedVerifications: number;
  };
  trustedRoots: {
    total: number;
    active: number;
  };
  recentActivity: PKIAuditEntry[];
}

interface SignCartridgeResponse {
  signatureBlock: CartridgeSignatureBlock;
  metadata: CartridgeMetadata;
}

// =============================================================================
// Constants
// =============================================================================

const CLUSTER_ID = process.env.RADIANT_CLUSTER_ID || 'us-east-1-prod';
const CLUSTER_NAME = process.env.RADIANT_CLUSTER_NAME || 'Radiant Commercial';
const CLUSTER_VERSION = process.env.RADIANT_VERSION || '6.1.0';
const CLUSTER_ENVIRONMENT = (process.env.RADIANT_ENVIRONMENT || 'production') as 'production' | 'staging' | 'development';
const PLATFORM_KEY_ID = process.env.RADIANT_PLATFORM_SIGNING_KEY_ID || '';
const SIGNATURE_VERSION = '1.0';
const VERIFICATION_CACHE_TTL_HOURS = 24;

// Available features in this cluster
const CLUSTER_AVAILABLE_FEATURES = [
  'ghost_vectors',
  'lora_adapters',
  'curator_knowledge',
  'domain_experts',
  'axiom_scorers',
  'cortex_networks',
];

// =============================================================================
// Service
// =============================================================================

class CartridgePKIService {
  private kmsClient: KMSClient;

  constructor() {
    this.kmsClient = new KMSClient({ region: process.env.AWS_REGION || 'us-east-1' });
  }

  // ===========================================================================
  // Signing Operations
  // ===========================================================================

  /**
   * Sign a cartridge with dual signatures (author + platform)
   * The Signing Ceremony from Security Architecture v8.0
   */
  async signCartridge(
    tenantId: string,
    cartridgeId: string,
    cartridgeName: string,
    cartridgeVersion: string,
    contentHash: string,
    performedBy: string,
    performedByEmail?: string,
    ipAddress?: string,
    options?: {
      compatibleApps?: ('radiant_admin' | 'thinktank_admin' | 'thinktank' | 'curator' | 'service_layer')[];
      requiredFeatures?: string[];
      intendedTenantIds?: string[];
    }
  ): Promise<SignCartridgeResponse> {
    try {
      logger.info('Starting cartridge signing ceremony', { 
        tenantId, cartridgeId, contentHash: contentHash.substring(0, 16) 
      });

      // Get tenant's active signing key
      const authorKey = await this.getActiveSigningKey(tenantId, 'author');
      if (!authorKey) {
        throw new Error('No active author signing key for tenant');
      }

      // Get tenant CA for trust chain
      const tenantCA = await this.getTenantCA(tenantId);
      if (!tenantCA) {
        throw new Error('No active tenant CA certificate');
      }

      // Get root CA fingerprint
      const rootCA = await this.getRootCA();
      if (!rootCA) {
        throw new Error('No active root CA certificate');
      }

      // Step 1: Author signature (tenant signs)
      const authorSignature = await this.createSignature(
        contentHash,
        authorKey,
        tenantId,
        tenantCA.tenantName,
        'author'
      );

      // Step 2: Platform signature (Radiant counter-signs)
      const platformSignature = await this.createPlatformSignature(
        contentHash,
        cartridgeId
      );

      // Build complete signature block with compatibility info
      const signatureBlock: CartridgeSignatureBlock = {
        version: SIGNATURE_VERSION as '1.0',
        cartridgeId,
        cartridgeName,
        cartridgeVersion,
        contentHash,
        hashAlgorithm: 'sha256',
        authorSignature,
        platformSignature,
        signedAt: new Date(),
        trustChain: {
          rootCaFingerprint: rootCA.fingerprint,
          tenantCaFingerprint: tenantCA.fingerprint,
          clusterId: CLUSTER_ID,
        },
        // Cluster compatibility (v6.1.0+)
        compatibility: {
          sourceClusterId: CLUSTER_ID,
          sourceClusterName: CLUSTER_NAME,
          sourceClusterVersion: CLUSTER_VERSION,
          minPlatformVersion: CLUSTER_VERSION, // Require same or higher version
          compatibleApps: options?.compatibleApps || ['curator', 'thinktank', 'thinktank_admin'],
          requiredFeatures: options?.requiredFeatures,
          environment: CLUSTER_ENVIRONMENT,
          intendedTenantIds: options?.intendedTenantIds,
        },
      };

      // Store signature in database
      await this.storeSignature(
        cartridgeId,
        tenantId,
        signatureBlock,
        authorKey.id
      );

      // Update cartridge record
      await executeStatement(
        `UPDATE cartridges 
         SET is_signed = true, signed_at = NOW()
         WHERE id = :cartridge_id`,
        [stringParam('cartridge_id', cartridgeId)]
      );

      // Increment key usage
      await this.incrementKeyUsage(authorKey.id);

      // Generate metadata for web publishing
      const metadata = this.generateMetadata(
        cartridgeId,
        cartridgeName,
        cartridgeVersion,
        signatureBlock,
        tenantId,
        tenantCA.tenantName
      );

      // Log audit
      await this.logAudit(
        'sign',
        'cartridge',
        cartridgeId,
        tenantId,
        performedBy,
        performedByEmail,
        true,
        undefined,
        { contentHash, authorKeyId: authorKey.id },
        ipAddress
      );

      logger.info('Cartridge signing complete', { cartridgeId, tenantId });

      return { signatureBlock, metadata };
    } catch (error) {
      logger.error('Cartridge signing failed', { error, tenantId, cartridgeId });
      
      await this.logAudit(
        'sign',
        'cartridge',
        cartridgeId,
        tenantId,
        performedBy,
        performedByEmail,
        false,
        error instanceof Error ? error.message : 'Unknown error',
        { contentHash },
        ipAddress
      );

      throw error;
    }
  }

  /**
   * Create a signature using the signing key
   */
  private async createSignature(
    contentHash: string,
    signingKey: CartridgeSigningKey,
    signerId: string,
    signerName: string,
    type: 'author' | 'platform'
  ): Promise<CartridgeSignature> {
    let signature: string;

    if (signingKey.keyArn) {
      // Use AWS KMS for signing
      const command = new SignCommand({
        KeyId: signingKey.keyArn,
        Message: Buffer.from(contentHash, 'hex'),
        MessageType: 'DIGEST',
        SigningAlgorithm: this.getKMSAlgorithm(signingKey.algorithm),
      });

      const response = await this.kmsClient.send(command);
      signature = Buffer.from(response.Signature!).toString('base64');
    } else {
      // Use local key (for development/testing)
      // In production, all keys should be in KMS/HSM
      throw new Error('Local signing not supported in production');
    }

    return {
      type,
      signerId,
      signerName,
      keyId: signingKey.keyId,
      keyFingerprint: signingKey.fingerprint,
      algorithm: signingKey.algorithm,
      signature,
      signedAt: new Date(),
      signedHash: contentHash,
    };
  }

  /**
   * Create platform (Radiant) signature
   */
  private async createPlatformSignature(
    contentHash: string,
    cartridgeId: string
  ): Promise<CartridgeSignature> {
    if (!PLATFORM_KEY_ID) {
      throw new Error('Platform signing key not configured');
    }

    const command = new SignCommand({
      KeyId: PLATFORM_KEY_ID,
      Message: Buffer.from(contentHash, 'hex'),
      MessageType: 'DIGEST',
      SigningAlgorithm: SigningAlgorithmSpec.ECDSA_SHA_256, // Platform uses ECDSA
    });

    const response = await this.kmsClient.send(command);
    const signature = Buffer.from(response.Signature!).toString('base64');

    return {
      type: 'platform',
      signerId: CLUSTER_ID,
      signerName: CLUSTER_NAME,
      keyId: PLATFORM_KEY_ID,
      keyFingerprint: await this.getKeyFingerprint(PLATFORM_KEY_ID),
      algorithm: 'ecdsa-p256',
      signature,
      signedAt: new Date(),
      signedHash: contentHash,
    };
  }

  // ===========================================================================
  // Verification Operations
  // ===========================================================================

  /**
   * Verify a cartridge's signatures
   * Returns detailed verification result
   */
  async verifyCartridge(
    signatureBlock: CartridgeSignatureBlock,
    contentHash: string,
    performedBy?: string,
    ipAddress?: string
  ): Promise<CartridgeVerificationResult> {
    const result: CartridgeVerificationResult = {
      status: 'valid',
      isValid: false,
      authorSignatureValid: false,
      platformSignatureValid: false,
      hashValid: false,
      certificateChainValid: false,
      notExpired: true,
      notRevoked: true,
      verifiedAt: new Date(),
      cartridgeId: signatureBlock.cartridgeId,
      cartridgeVersion: signatureBlock.cartridgeVersion,
      errors: [],
      warnings: [],
    };

    try {
      // Check cache first
      const cached = await this.getCachedVerification(contentHash);
      if (cached) {
        logger.debug('Returning cached verification', { contentHash });
        return cached;
      }

      // Step 1: Verify hash matches
      if (contentHash !== signatureBlock.contentHash) {
        result.status = 'hash_mismatch';
        result.errors.push('Content hash does not match signed hash');
        return this.finalizeVerification(result, signatureBlock, performedBy, ipAddress);
      }
      result.hashValid = true;

      // Step 2: Check expiration
      if (signatureBlock.expiresAt && new Date(signatureBlock.expiresAt) < new Date()) {
        result.status = 'expired';
        result.notExpired = false;
        result.errors.push('Signature has expired');
        return this.finalizeVerification(result, signatureBlock, performedBy, ipAddress);
      }

      // Step 3: Verify trust chain
      const chainValid = await this.verifyCertificateChain(signatureBlock.trustChain);
      if (!chainValid.valid) {
        result.status = chainValid.revoked ? 'revoked' : 'untrusted';
        result.notRevoked = !chainValid.revoked;
        result.certificateChainValid = false;
        result.errors.push(chainValid.error || 'Certificate chain validation failed');
        return this.finalizeVerification(result, signatureBlock, performedBy, ipAddress);
      }
      result.certificateChainValid = true;

      // Step 4: Verify author signature
      const authorValid = await this.verifySignature(
        signatureBlock.authorSignature,
        signatureBlock.contentHash
      );
      result.authorSignatureValid = authorValid;
      if (!authorValid) {
        result.status = 'invalid_author';
        result.errors.push('Author signature verification failed');
        return this.finalizeVerification(result, signatureBlock, performedBy, ipAddress);
      }
      result.signedBy = signatureBlock.authorSignature.signerName;

      // Step 5: Verify platform signature
      const platformValid = await this.verifySignature(
        signatureBlock.platformSignature,
        signatureBlock.contentHash
      );
      result.platformSignatureValid = platformValid;
      if (!platformValid) {
        result.status = 'invalid_platform';
        result.errors.push('Platform signature verification failed');
        return this.finalizeVerification(result, signatureBlock, performedBy, ipAddress);
      }
      result.verifiedBy = signatureBlock.platformSignature.signerName;

      // All checks passed
      result.status = 'valid';
      result.isValid = true;

      // Cache the result
      await this.cacheVerification(contentHash, signatureBlock.cartridgeId, result);

      return this.finalizeVerification(result, signatureBlock, performedBy, ipAddress);
    } catch (error) {
      logger.error('Verification error', { error, contentHash });
      result.status = 'corrupted';
      result.errors.push(error instanceof Error ? error.message : 'Verification error');
      return this.finalizeVerification(result, signatureBlock, performedBy, ipAddress);
    }
  }

  /**
   * Verify a single signature
   */
  private async verifySignature(
    sig: CartridgeSignature,
    contentHash: string
  ): Promise<boolean> {
    try {
      // For KMS-signed signatures
      if (sig.keyId.startsWith('arn:aws:kms')) {
        const command = new VerifyCommand({
          KeyId: sig.keyId,
          Message: Buffer.from(contentHash, 'hex'),
          MessageType: 'DIGEST',
          Signature: Buffer.from(sig.signature, 'base64'),
          SigningAlgorithm: this.getKMSAlgorithm(sig.algorithm),
        });

        const response = await this.kmsClient.send(command);
        return response.SignatureValid === true;
      }

      // For federated/external signatures, fetch public key and verify
      const publicKey = await this.getPublicKeyForVerification(sig.keyFingerprint);
      if (!publicKey) {
        logger.warn('Could not fetch public key for verification', { fingerprint: sig.keyFingerprint });
        return false;
      }

      const keyObject = createPublicKey(publicKey);
      return verify(
        this.getNodeAlgorithm(sig.algorithm),
        Buffer.from(contentHash, 'hex'),
        keyObject,
        Buffer.from(sig.signature, 'base64')
      );
    } catch (error) {
      logger.error('Signature verification failed', { error, keyId: sig.keyId });
      return false;
    }
  }

  /**
   * Verify the certificate chain
   */
  private async verifyCertificateChain(
    trustChain: CartridgeSignatureBlock['trustChain']
  ): Promise<{ valid: boolean; revoked?: boolean; error?: string }> {
    // Check if root CA is trusted
    const rootCA = await this.getRootCA();
    if (!rootCA) {
      // Check trusted roots (federation)
      const trustedRoot = await this.getTrustedRoot(trustChain.rootCaFingerprint);
      if (!trustedRoot) {
        return { valid: false, error: 'Root CA not in trust store' };
      }
      if (!trustedRoot.isActive) {
        return { valid: false, error: 'Trusted root is inactive' };
      }
    } else if (rootCA.fingerprint !== trustChain.rootCaFingerprint) {
      // Check if it's a federated root
      const trustedRoot = await this.getTrustedRoot(trustChain.rootCaFingerprint);
      if (!trustedRoot || !trustedRoot.isActive) {
        return { valid: false, error: 'Root CA fingerprint mismatch' };
      }
    }

    // Check tenant CA status
    const tenantCA = await this.getTenantCAByFingerprint(trustChain.tenantCaFingerprint);
    if (!tenantCA) {
      return { valid: false, error: 'Tenant CA not found' };
    }
    if (tenantCA.status === 'revoked') {
      return { valid: false, revoked: true, error: 'Tenant CA has been revoked' };
    }
    if (tenantCA.status !== 'active') {
      return { valid: false, error: `Tenant CA is ${tenantCA.status}` };
    }

    return { valid: true };
  }

  /**
   * Check cartridge compatibility with this cluster
   * Verifies version, apps, features, and environment compatibility
   */
  checkCompatibility(
    compatibility: ClusterCompatibility,
    targetTenantId?: string,
    targetApps?: RadiantApp[]
  ): CompatibilityCheckResult {
    const result: CompatibilityCheckResult = {
      isCompatible: true,
      versionCompatible: true,
      appsCompatible: true,
      featuresAvailable: true,
      tenantAllowed: true,
      environmentCompatible: true,
      sourceCluster: compatibility.sourceClusterName,
      targetCluster: CLUSTER_NAME,
      incompatibilities: [],
      warnings: [],
    };

    // Check version compatibility
    const sourceVersion = compatibility.minPlatformVersion.split('.').map(Number);
    const targetVersion = CLUSTER_VERSION.split('.').map(Number);
    
    // Source requires higher version than target has
    if (this.compareVersions(sourceVersion, targetVersion) > 0) {
      result.versionCompatible = false;
      result.isCompatible = false;
      result.incompatibilities.push(
        `Requires RADIANT ${compatibility.minPlatformVersion}, but cluster is ${CLUSTER_VERSION}`
      );
    }

    // Check max version if specified
    if (compatibility.maxPlatformVersion) {
      const maxVersion = compatibility.maxPlatformVersion.split('.').map(Number);
      if (this.compareVersions(targetVersion, maxVersion) > 0) {
        result.versionCompatible = false;
        result.isCompatible = false;
        result.incompatibilities.push(
          `Maximum supported version is ${compatibility.maxPlatformVersion}, but cluster is ${CLUSTER_VERSION}`
        );
      }
    }

    // Check app compatibility
    if (targetApps && targetApps.length > 0) {
      const unsupportedApps = targetApps.filter(app => !compatibility.compatibleApps.includes(app));
      if (unsupportedApps.length > 0) {
        result.appsCompatible = false;
        result.isCompatible = false;
        result.incompatibilities.push(
          `Cartridge not compatible with apps: ${unsupportedApps.join(', ')}`
        );
      }
    }

    // Check required features
    if (compatibility.requiredFeatures && compatibility.requiredFeatures.length > 0) {
      const missingFeatures = compatibility.requiredFeatures.filter(
        f => !CLUSTER_AVAILABLE_FEATURES.includes(f)
      );
      if (missingFeatures.length > 0) {
        result.featuresAvailable = false;
        result.isCompatible = false;
        result.incompatibilities.push(
          `Missing required features: ${missingFeatures.join(', ')}`
        );
      }
    }

    // Check tenant restriction
    if (compatibility.intendedTenantIds && compatibility.intendedTenantIds.length > 0 && targetTenantId) {
      if (!compatibility.intendedTenantIds.includes(targetTenantId)) {
        result.tenantAllowed = false;
        result.isCompatible = false;
        result.incompatibilities.push(
          `Cartridge is restricted to specific tenants and this tenant is not included`
        );
      }
    }

    // Check environment compatibility
    if (compatibility.environment !== CLUSTER_ENVIRONMENT) {
      // Allow production cartridges in staging/dev, but warn
      // Block staging/dev cartridges in production
      if (CLUSTER_ENVIRONMENT === 'production' && compatibility.environment !== 'production') {
        result.environmentCompatible = false;
        result.isCompatible = false;
        result.incompatibilities.push(
          `Cannot import ${compatibility.environment} cartridge into production cluster`
        );
      } else {
        result.warnings.push(
          `Cartridge is from ${compatibility.environment} environment, cluster is ${CLUSTER_ENVIRONMENT}`
        );
      }
    }

    return result;
  }

  /**
   * Compare two version arrays
   * Returns: -1 if a < b, 0 if equal, 1 if a > b
   */
  private compareVersions(a: number[], b: number[]): number {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const av = a[i] || 0;
      const bv = b[i] || 0;
      if (av < bv) return -1;
      if (av > bv) return 1;
    }
    return 0;
  }

  // ===========================================================================
  // Certificate Management
  // ===========================================================================

  /**
   * Generate a new Tenant CA certificate
   */
  async generateTenantCA(
    tenantId: string,
    tenantName: string,
    performedBy: string,
    validityDays: number = 365 * 5
  ): Promise<TenantCACertificate> {
    try {
      const rootCA = await this.getRootCA();
      if (!rootCA) {
        throw new Error('No active root CA - run Genesis first');
      }

      // In production, this would generate a key pair in KMS/HSM
      // For now, we'll create a placeholder that references KMS
      const keyId = `tenant-ca-${tenantId}-${Date.now()}`;
      
      // Request KMS to create a new asymmetric key pair
      // This is a placeholder - actual implementation would use CreateKeyCommand
      const publicKey = `-----BEGIN PUBLIC KEY-----\nPLACEHOLDER_FOR_KMS_KEY_${keyId}\n-----END PUBLIC KEY-----`;
      const fingerprint = createHash('sha256').update(publicKey).digest('hex');

      const validFrom = new Date();
      const validUntil = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);

      // Sign with root CA (placeholder - would use KMS)
      const rootSignature = `ROOT_SIGNED_${fingerprint}_WITH_${rootCA.fingerprint}`;

      const result = await executeStatement(
        `INSERT INTO tenant_ca_certificates (
          tenant_id, tenant_name, root_ca_id, public_key, fingerprint,
          algorithm, valid_from, valid_until, status, root_signature
        ) VALUES (
          :tenant_id, :tenant_name, :root_ca_id, :public_key, :fingerprint,
          'ed25519', :valid_from, :valid_until, 'active', :root_signature
        ) RETURNING *`,
        [
          stringParam('tenant_id', tenantId),
          stringParam('tenant_name', tenantName),
          stringParam('root_ca_id', rootCA.id),
          stringParam('public_key', publicKey),
          stringParam('fingerprint', fingerprint),
          stringParam('valid_from', validFrom.toISOString()),
          stringParam('valid_until', validUntil.toISOString()),
          stringParam('root_signature', rootSignature),
        ]
      );

      const tenantCA = this.mapRowToTenantCA(result.rows?.[0]);

      // Create signing keys for this tenant
      await this.createSigningKey(tenantId, tenantCA.id, 'author');

      await this.logAudit('generate_ca', 'tenant_ca', tenantCA.id, tenantId, performedBy, undefined, true);

      logger.info('Tenant CA generated', { tenantId, fingerprint });
      return tenantCA;
    } catch (error) {
      logger.error('Failed to generate tenant CA', { error, tenantId });
      throw error;
    }
  }

  /**
   * Create a signing key for a tenant
   */
  private async createSigningKey(
    tenantId: string,
    tenantCaId: string,
    purpose: 'author' | 'platform'
  ): Promise<CartridgeSigningKey> {
    const keyId = `signing-${purpose}-${tenantId}-${Date.now()}`;
    const publicKey = `-----BEGIN PUBLIC KEY-----\nPLACEHOLDER_SIGNING_KEY_${keyId}\n-----END PUBLIC KEY-----`;
    const fingerprint = createHash('sha256').update(publicKey).digest('hex');

    const validFrom = new Date();
    const validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

    const result = await executeStatement(
      `INSERT INTO cartridge_signing_keys (
        tenant_id, tenant_ca_id, key_id, public_key, fingerprint,
        algorithm, purpose, valid_from, valid_until, status
      ) VALUES (
        :tenant_id, :tenant_ca_id, :key_id, :public_key, :fingerprint,
        'ed25519', :purpose, :valid_from, :valid_until, 'active'
      ) RETURNING *`,
      [
        stringParam('tenant_id', tenantId),
        stringParam('tenant_ca_id', tenantCaId),
        stringParam('key_id', keyId),
        stringParam('public_key', publicKey),
        stringParam('fingerprint', fingerprint),
        stringParam('purpose', purpose),
        stringParam('valid_from', validFrom.toISOString()),
        stringParam('valid_until', validUntil.toISOString()),
      ]
    );

    return this.mapRowToSigningKey(result.rows?.[0]);
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  private async getActiveSigningKey(
    tenantId: string,
    purpose: 'author' | 'platform'
  ): Promise<CartridgeSigningKey | null> {
    const result = await executeStatement(
      `SELECT * FROM cartridge_signing_keys
       WHERE tenant_id = :tenant_id
         AND purpose = :purpose
         AND status = 'active'
         AND valid_from <= NOW()
         AND valid_until > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [stringParam('tenant_id', tenantId), stringParam('purpose', purpose)]
    );
    return result.rows?.[0] ? this.mapRowToSigningKey(result.rows[0]) : null;
  }

  private async getTenantCA(tenantId: string): Promise<TenantCACertificate | null> {
    const result = await executeStatement(
      `SELECT * FROM tenant_ca_certificates
       WHERE tenant_id = :tenant_id AND status = 'active'
       ORDER BY created_at DESC LIMIT 1`,
      [stringParam('tenant_id', tenantId)]
    );
    return result.rows?.[0] ? this.mapRowToTenantCA(result.rows[0]) : null;
  }

  private async getTenantCAByFingerprint(fingerprint: string): Promise<TenantCACertificate | null> {
    const result = await executeStatement(
      `SELECT * FROM tenant_ca_certificates WHERE fingerprint = :fingerprint`,
      [stringParam('fingerprint', fingerprint)]
    );
    return result.rows?.[0] ? this.mapRowToTenantCA(result.rows[0]) : null;
  }

  private async getRootCA(): Promise<{ id: string; fingerprint: string; clusterId: string } | null> {
    const result = await executeStatement(
      `SELECT id, fingerprint, cluster_id FROM root_ca_certificates
       WHERE status = 'active' LIMIT 1`,
      []
    );
    if (!result.rows?.[0]) return null;
    return {
      id: String(result.rows[0].id),
      fingerprint: String(result.rows[0].fingerprint),
      clusterId: String(result.rows[0].cluster_id),
    };
  }

  private async getTrustedRoot(fingerprint: string): Promise<{ isActive: boolean } | null> {
    const result = await executeStatement(
      `SELECT is_active FROM trusted_root_cas WHERE fingerprint = :fingerprint`,
      [stringParam('fingerprint', fingerprint)]
    );
    if (!result.rows?.[0]) return null;
    return { isActive: Boolean(result.rows[0].is_active) };
  }

  private async storeSignature(
    cartridgeId: string,
    tenantId: string,
    signatureBlock: CartridgeSignatureBlock,
    authorKeyId: string
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO cartridge_signatures (
        cartridge_id, tenant_id, content_hash, hash_algorithm,
        author_signature, author_key_id, author_signed_at,
        platform_signature, platform_key_id, platform_signed_at,
        signature_version, expires_at,
        root_ca_fingerprint, tenant_ca_fingerprint, cluster_id
      ) VALUES (
        :cartridge_id, :tenant_id, :content_hash, :hash_algorithm,
        :author_signature, :author_key_id, :author_signed_at,
        :platform_signature, :platform_key_id, :platform_signed_at,
        :signature_version, :expires_at,
        :root_ca_fingerprint, :tenant_ca_fingerprint, :cluster_id
      )
      ON CONFLICT (cartridge_id) DO UPDATE SET
        content_hash = EXCLUDED.content_hash,
        author_signature = EXCLUDED.author_signature,
        author_signed_at = EXCLUDED.author_signed_at,
        platform_signature = EXCLUDED.platform_signature,
        platform_signed_at = EXCLUDED.platform_signed_at,
        created_at = NOW()`,
      [
        stringParam('cartridge_id', cartridgeId),
        stringParam('tenant_id', tenantId),
        stringParam('content_hash', signatureBlock.contentHash),
        stringParam('hash_algorithm', signatureBlock.hashAlgorithm),
        stringParam('author_signature', signatureBlock.authorSignature.signature),
        stringParam('author_key_id', authorKeyId),
        stringParam('author_signed_at', signatureBlock.authorSignature.signedAt.toISOString()),
        stringParam('platform_signature', signatureBlock.platformSignature.signature),
        stringParam('platform_key_id', signatureBlock.platformSignature.keyId),
        stringParam('platform_signed_at', signatureBlock.platformSignature.signedAt.toISOString()),
        stringParam('signature_version', signatureBlock.version),
        stringParam('expires_at', signatureBlock.expiresAt?.toISOString() || ''),
        stringParam('root_ca_fingerprint', signatureBlock.trustChain.rootCaFingerprint),
        stringParam('tenant_ca_fingerprint', signatureBlock.trustChain.tenantCaFingerprint),
        stringParam('cluster_id', signatureBlock.trustChain.clusterId),
      ]
    );
  }

  private async incrementKeyUsage(keyId: string): Promise<void> {
    await executeStatement(
      `UPDATE cartridge_signing_keys
       SET usage_count = usage_count + 1, last_used_at = NOW(), updated_at = NOW()
       WHERE id = :key_id`,
      [stringParam('key_id', keyId)]
    );
  }

  private generateMetadata(
    cartridgeId: string,
    cartridgeName: string,
    cartridgeVersion: string,
    signatureBlock: CartridgeSignatureBlock,
    tenantId: string,
    tenantName: string
  ): CartridgeMetadata {
    return {
      cartridge_id: cartridgeId,
      name: cartridgeName,
      version: cartridgeVersion,
      signatures: {
        author_check: signatureBlock.authorSignature.signature.substring(0, 16),
        platform_check: signatureBlock.platformSignature.signature.substring(0, 16),
      },
      hash: `sha256:${signatureBlock.contentHash}`,
      hash_algorithm: 'sha256',
      download_url: `https://repo.radiant.ai/cartridges/${cartridgeId}.radz`,
      file_size_bytes: 0, // Will be filled by caller
      signed_by: tenantName,
      verified_by: CLUSTER_NAME,
      signed_at: signatureBlock.signedAt.toISOString(),
      namespace: {
        cluster_id: CLUSTER_ID,
        tenant_id: tenantId,
        full_id: `${CLUSTER_ID}.${tenantId}.${cartridgeName}-v${cartridgeVersion}`,
      },
      // Compatibility (v6.1.0+)
      compatibility: {
        min_version: signatureBlock.compatibility.minPlatformVersion,
        apps: signatureBlock.compatibility.compatibleApps,
        features: signatureBlock.compatibility.requiredFeatures,
        environment: signatureBlock.compatibility.environment,
      },
    };
  }

  private async getCachedVerification(contentHash: string): Promise<CartridgeVerificationResult | null> {
    const result = await executeStatement(
      `SELECT * FROM signature_verification_cache
       WHERE content_hash = :content_hash AND expires_at > NOW()`,
      [stringParam('content_hash', contentHash)]
    );
    if (!result.rows?.[0]) return null;
    
    const row = result.rows[0];
    return {
      status: String(row.verification_status) as CartridgeSignatureVerificationStatus,
      isValid: Boolean(row.is_valid),
      authorSignatureValid: Boolean(row.author_valid),
      platformSignatureValid: Boolean(row.platform_valid),
      hashValid: Boolean(row.hash_valid),
      certificateChainValid: Boolean(row.chain_valid),
      notExpired: true,
      notRevoked: true,
      verifiedAt: new Date(String(row.verified_at)),
      errors: row.errors as string[] || [],
      warnings: row.warnings as string[] || [],
    };
  }

  private async cacheVerification(
    contentHash: string,
    cartridgeId: string,
    result: CartridgeVerificationResult
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + VERIFICATION_CACHE_TTL_HOURS * 60 * 60 * 1000);
    
    await executeStatement(
      `INSERT INTO signature_verification_cache (
        content_hash, cartridge_id, verification_status, is_valid, expires_at,
        author_valid, platform_valid, hash_valid, chain_valid, errors, warnings
      ) VALUES (
        :content_hash, :cartridge_id, :status, :is_valid, :expires_at,
        :author_valid, :platform_valid, :hash_valid, :chain_valid, :errors, :warnings
      )
      ON CONFLICT (content_hash) DO UPDATE SET
        verification_status = EXCLUDED.verification_status,
        is_valid = EXCLUDED.is_valid,
        expires_at = EXCLUDED.expires_at,
        verified_at = NOW()`,
      [
        stringParam('content_hash', contentHash),
        stringParam('cartridge_id', cartridgeId),
        stringParam('status', result.status),
        boolParam('is_valid', result.isValid),
        stringParam('expires_at', expiresAt.toISOString()),
        boolParam('author_valid', result.authorSignatureValid),
        boolParam('platform_valid', result.platformSignatureValid),
        boolParam('hash_valid', result.hashValid),
        boolParam('chain_valid', result.certificateChainValid),
        stringParam('errors', JSON.stringify(result.errors)),
        stringParam('warnings', JSON.stringify(result.warnings)),
      ]
    );
  }

  private async finalizeVerification(
    result: CartridgeVerificationResult,
    signatureBlock: CartridgeSignatureBlock,
    performedBy?: string,
    ipAddress?: string
  ): Promise<CartridgeVerificationResult> {
    await this.logAudit(
      'verify',
      'cartridge',
      signatureBlock.cartridgeId,
      undefined,
      performedBy || 'system',
      undefined,
      result.isValid,
      result.errors.join('; ') || undefined,
      { status: result.status },
      ipAddress
    );
    return result;
  }

  private async logAudit(
    action: 'sign' | 'verify' | 'generate_ca' | 'revoke' | 'add_trust' | 'remove_trust',
    targetType: string,
    targetId: string,
    tenantId?: string,
    performedBy?: string,
    performedByEmail?: string,
    success: boolean = true,
    errorMessage?: string,
    details?: Record<string, unknown>,
    ipAddress?: string
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO pki_audit_log (
        action, target_type, target_id, tenant_id,
        performed_by, performed_by_email, success, error_message, details, ip_address
      ) VALUES (
        :action, :target_type, :target_id, :tenant_id,
        :performed_by, :performed_by_email, :success, :error_message, :details, :ip_address
      )`,
      [
        stringParam('action', action),
        stringParam('target_type', targetType),
        stringParam('target_id', targetId),
        stringParam('tenant_id', tenantId || ''),
        stringParam('performed_by', performedBy || ''),
        stringParam('performed_by_email', performedByEmail || ''),
        boolParam('success', success),
        stringParam('error_message', errorMessage || ''),
        stringParam('details', JSON.stringify(details || {})),
        stringParam('ip_address', ipAddress || ''),
      ]
    );
  }

  private async getKeyFingerprint(keyId: string): Promise<string> {
    try {
      const command = new GetPublicKeyCommand({ KeyId: keyId });
      const response = await this.kmsClient.send(command);
      if (response.PublicKey) {
        return createHash('sha256').update(Buffer.from(response.PublicKey)).digest('hex');
      }
    } catch (error) {
      logger.warn('Could not get key fingerprint', { keyId });
    }
    return createHash('sha256').update(keyId).digest('hex');
  }

  private async getPublicKeyForVerification(fingerprint: string): Promise<string | null> {
    // Try signing keys first
    const keyResult = await executeStatement(
      `SELECT public_key FROM cartridge_signing_keys WHERE fingerprint = :fingerprint`,
      [stringParam('fingerprint', fingerprint)]
    );
    if (keyResult.rows?.[0]) return String(keyResult.rows[0].public_key);

    // Try tenant CAs
    const caResult = await executeStatement(
      `SELECT public_key FROM tenant_ca_certificates WHERE fingerprint = :fingerprint`,
      [stringParam('fingerprint', fingerprint)]
    );
    if (caResult.rows?.[0]) return String(caResult.rows[0].public_key);

    return null;
  }

  private getKMSAlgorithm(algorithm: string): SigningAlgorithmSpec {
    switch (algorithm) {
      case 'ed25519': return SigningAlgorithmSpec.ECDSA_SHA_256; // KMS doesn't support Ed25519 directly
      case 'ecdsa-p256': return SigningAlgorithmSpec.ECDSA_SHA_256;
      case 'rsa-pss-4096': return SigningAlgorithmSpec.RSASSA_PSS_SHA_256;
      default: return SigningAlgorithmSpec.ECDSA_SHA_256;
    }
  }

  private getNodeAlgorithm(algorithm: string): string | null {
    switch (algorithm) {
      case 'ed25519': return null; // Ed25519 doesn't need algorithm param
      case 'ecdsa-p256': return 'sha256';
      case 'rsa-pss-4096': return 'sha256';
      default: return 'sha256';
    }
  }

  private mapRowToTenantCA(row: Record<string, unknown>): TenantCACertificate {
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      tenantName: String(row.tenant_name),
      rootCaId: String(row.root_ca_id),
      publicKey: String(row.public_key),
      fingerprint: String(row.fingerprint),
      algorithm: String(row.algorithm) as 'ed25519' | 'rsa-pss-4096' | 'ecdsa-p256',
      validFrom: new Date(String(row.valid_from)),
      validUntil: new Date(String(row.valid_until)),
      status: String(row.status) as 'active' | 'revoked' | 'expired' | 'pending',
      signedByRootAt: new Date(String(row.signed_by_root_at)),
      rootSignature: String(row.root_signature),
      createdAt: new Date(String(row.created_at)),
      revokedAt: row.revoked_at ? new Date(String(row.revoked_at)) : undefined,
      revokedReason: row.revoked_reason ? String(row.revoked_reason) : undefined,
    };
  }

  private mapRowToSigningKey(row: Record<string, unknown>): CartridgeSigningKey {
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      tenantCaId: String(row.tenant_ca_id),
      keyId: String(row.key_id),
      keyArn: row.key_arn ? String(row.key_arn) : undefined,
      publicKey: String(row.public_key),
      fingerprint: String(row.fingerprint),
      algorithm: String(row.algorithm) as 'ed25519' | 'rsa-pss-4096' | 'ecdsa-p256',
      purpose: String(row.purpose) as 'author' | 'platform',
      validFrom: new Date(String(row.valid_from)),
      validUntil: new Date(String(row.valid_until)),
      status: String(row.status) as 'active' | 'revoked' | 'expired' | 'pending',
      createdAt: new Date(String(row.created_at)),
      lastUsedAt: row.last_used_at ? new Date(String(row.last_used_at)) : undefined,
      usageCount: Number(row.usage_count) || 0,
    };
  }

  // ===========================================================================
  // Dashboard
  // ===========================================================================

  async getDashboard(): Promise<PKIDashboard> {
    const result = await executeStatement(`SELECT * FROM v_pki_dashboard`, []);
    const row = result.rows?.[0] || {};

    const auditResult = await executeStatement(
      `SELECT * FROM pki_audit_log ORDER BY performed_at DESC LIMIT 20`,
      []
    );

    return {
      rootCA: {
        clusterId: String(row.root_cluster_id || CLUSTER_ID),
        fingerprint: String(row.root_fingerprint || 'NOT_INITIALIZED'),
        validUntil: row.root_valid_until ? new Date(String(row.root_valid_until)) : new Date(),
        status: 'active',
      },
      tenantCAs: {
        total: Number(row.total_tenant_cas) || 0,
        active: Number(row.active_tenant_cas) || 0,
        expiringSoon: Number(row.expiring_tenant_cas) || 0,
        revoked: Number(row.revoked_tenant_cas) || 0,
      },
      signingKeys: {
        total: Number(row.total_signing_keys) || 0,
        active: Number(row.active_signing_keys) || 0,
        usedToday: Number(row.keys_used_today) || 0,
      },
      signatures: {
        totalSigned: Number(row.total_signatures) || 0,
        signedToday: Number(row.signatures_today) || 0,
        verificationsToday: Number(row.verifications_today) || 0,
        failedVerifications: Number(row.failed_verifications_today) || 0,
      },
      trustedRoots: {
        total: Number(row.total_trusted_roots) || 0,
        active: Number(row.active_trusted_roots) || 0,
      },
      recentActivity: (auditResult.rows || []).map((r: Record<string, unknown>) => ({
        id: String(r.id),
        action: String(r.action) as PKIAuditEntry['action'],
        targetType: String(r.target_type) as PKIAuditEntry['targetType'],
        targetId: String(r.target_id),
        performedBy: String(r.performed_by),
        performedAt: new Date(String(r.performed_at)),
        success: Boolean(r.success),
        details: r.details as Record<string, unknown>,
        ipAddress: r.ip_address ? String(r.ip_address) : undefined,
      })),
    };
  }
}

// Export singleton
export const cartridgePKIService = new CartridgePKIService();
