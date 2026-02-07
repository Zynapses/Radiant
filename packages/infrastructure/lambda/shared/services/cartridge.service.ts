/**
 * RADIANT Cartridge Service
 * Manages portable AI brains (.RADz files) - export, import, and stack resolution
 */

import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { executeStatement, stringParam, boolParam } from '../db/client';
import { createRegisteredLogger } from './logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'cartridge/main',
  category: 'infrastructure',
  sourceType: 'application',
});
import { createHash } from 'crypto';
import type {
  Cartridge,
  CartridgeManifest,
  CartridgeScope,
  CartridgeStatus,
  CartridgeStack,
  CartridgeStackEntry,
  CartridgeValidationResult,
  ExportCartridgeRequest,
  ImportCartridgeRequest,
  CartridgeListRequest,
  CartridgeListResponse,
  CreateCartridgeRequest,
  UpdateCartridgeRequest,
  CARTRIDGE_FILE_EXTENSION,
  CARTRIDGE_MANIFEST_FILENAME,
  CARTRIDGE_VALIDATION_CODES,
} from '@radiant/shared';
import { cartridgePKIService } from './cartridge-pki.service';
import { cartridgeVaultService } from './cartridge-vault.service';
import { cartridgeRNIRService } from './cartridge-rnir.service';
import { cartridgeOperationsService } from './cartridge-operations.service';
import type {
  CartridgeSignatureBlock,
  CartridgeMetadata,
  CartridgeVerificationResult,
} from './cartridge-pki.types';

// Extended response types with PKI fields (until shared package is rebuilt)
interface ExportCartridgeResponse {
  cartridgeId: string;
  downloadUrl: string;
  expiresAt: string;
  estimatedSizeBytes: number;
  signatureBlock?: CartridgeSignatureBlock;
  metadata?: CartridgeMetadata;
}

interface ImportCartridgeResponse {
  cartridgeId: string;
  status: CartridgeStatus;
  validationErrors?: string[];
  manifest?: CartridgeManifest;
  signatureVerification?: CartridgeVerificationResult;
}

// =============================================================================
// Constants
// =============================================================================

const CARTRIDGE_BUCKET = process.env.CARTRIDGE_BUCKET || 'radiant-cartridges';
const PRESIGNED_URL_EXPIRY = 3600; // 1 hour
const SIGNATURE_FILENAME = 'signature.sig';
const METADATA_FILENAME = 'meta.json';

// =============================================================================
// Service
// =============================================================================

class CartridgeService {
  private s3Client: S3Client;

  constructor() {
    this.s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
  }

  // ===========================================================================
  // CRUD Operations
  // ===========================================================================

  /**
   * Create a new cartridge record (before export)
   */
  async createCartridge(
    tenantId: string,
    userId: string,
    request: CreateCartridgeRequest
  ): Promise<Cartridge> {
    try {
      const id = crypto.randomUUID();
      const now = new Date();

      const result = await executeStatement(
        `INSERT INTO cartridges (
          id, tenant_id, user_id, name, description, version, scope, status,
          domains, has_lora_adapters, has_curator_knowledge, has_ghost_compression,
          has_domain_experts, allow_user_override, overridable_fields, tags,
          is_enabled, created_at, created_by, updated_at
        ) VALUES (
          :id, :tenant_id, :user_id, :name, :description, '1.0.0', :scope, 'draft',
          :domains, :has_lora, :has_curator, :has_ghost, :has_domain,
          :allow_override, :overridable_fields, :tags,
          true, :created_at, :created_by, :updated_at
        ) RETURNING *`,
        [
          stringParam('id', id),
          stringParam('tenant_id', tenantId),
          stringParam('user_id', request.scope === 'user' ? userId : ''),
          stringParam('name', request.name),
          stringParam('description', request.description || ''),
          stringParam('scope', request.scope),
          stringParam('domains', JSON.stringify(request.domains)),
          boolParam('has_lora', request.includeLoraAdapters || false),
          boolParam('has_curator', request.includeCuratorKnowledge || false),
          boolParam('has_ghost', request.includeGhostCompression || false),
          boolParam('has_domain', request.includeDomainExperts || false),
          boolParam('allow_override', request.allowUserOverride ?? true),
          stringParam('overridable_fields', JSON.stringify(request.overridableFields || [])),
          stringParam('tags', JSON.stringify(request.tags || [])),
          stringParam('created_at', now.toISOString()),
          stringParam('created_by', userId),
          stringParam('updated_at', now.toISOString()),
        ]
      );

      logger.info('Cartridge created', { id, tenantId, scope: request.scope });
      return this.mapRowToCartridge(result.rows?.[0] || { id });
    } catch (error) {
      logger.error('Failed to create cartridge', { error, tenantId });
      throw error;
    }
  }

  /**
   * Get a cartridge by ID
   */
  async getCartridge(cartridgeId: string, tenantId: string): Promise<Cartridge | null> {
    try {
      const result = await executeStatement(
        `SELECT * FROM cartridges 
         WHERE id = :id AND tenant_id = :tenant_id AND archived_at IS NULL`,
        [stringParam('id', cartridgeId), stringParam('tenant_id', tenantId)]
      );

      if (!result.rows?.length) return null;
      return this.mapRowToCartridge(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get cartridge', { error, cartridgeId });
      throw error;
    }
  }

  /**
   * List cartridges with filtering
   */
  async listCartridges(request: CartridgeListRequest): Promise<CartridgeListResponse> {
    try {
      const limit = request.limit || 50;
      const offset = request.offset || 0;

      let whereClause = 'tenant_id = :tenant_id';
      const params = [stringParam('tenant_id', request.tenantId)];

      if (request.scope) {
        whereClause += ' AND scope = :scope';
        params.push(stringParam('scope', request.scope));
      }

      if (request.userId) {
        whereClause += ' AND (scope = \'tenant\' OR user_id = :user_id)';
        params.push(stringParam('user_id', request.userId));
      }

      if (request.status) {
        whereClause += ' AND status = :status';
        params.push(stringParam('status', request.status));
      }

      if (!request.includeArchived) {
        whereClause += ' AND archived_at IS NULL';
      }

      const countResult = await executeStatement(
        `SELECT COUNT(*) as total FROM cartridges WHERE ${whereClause}`,
        params
      );

      const result = await executeStatement(
        `SELECT * FROM cartridges 
         WHERE ${whereClause}
         ORDER BY created_at DESC
         LIMIT ${limit} OFFSET ${offset}`,
        params
      );

      return {
        cartridges: (result.rows || []).map((row: Record<string, unknown>) => this.mapRowToCartridge(row)),
        total: Number(countResult.rows?.[0]?.total || 0),
        limit,
        offset,
      };
    } catch (error) {
      logger.error('Failed to list cartridges', { error, tenantId: request.tenantId });
      throw error;
    }
  }

  /**
   * Update a cartridge
   */
  async updateCartridge(
    cartridgeId: string,
    tenantId: string,
    userId: string,
    request: UpdateCartridgeRequest
  ): Promise<Cartridge> {
    try {
      const updates: string[] = [];
      const params = [
        stringParam('id', cartridgeId),
        stringParam('tenant_id', tenantId),
      ];

      if (request.name !== undefined) {
        updates.push('name = :name');
        params.push(stringParam('name', request.name));
      }

      if (request.description !== undefined) {
        updates.push('description = :description');
        params.push(stringParam('description', request.description));
      }

      if (request.isEnabled !== undefined) {
        updates.push('is_enabled = :is_enabled');
        params.push(boolParam('is_enabled', request.isEnabled));
      }

      if (request.allowUserOverride !== undefined) {
        updates.push('allow_user_override = :allow_override');
        params.push(boolParam('allow_override', request.allowUserOverride));
      }

      if (request.overridableFields !== undefined) {
        updates.push('overridable_fields = :overridable_fields');
        params.push(stringParam('overridable_fields', JSON.stringify(request.overridableFields)));
      }

      if (request.tags !== undefined) {
        updates.push('tags = :tags');
        params.push(stringParam('tags', JSON.stringify(request.tags)));
      }

      updates.push('updated_at = NOW()');

      const result = await executeStatement(
        `UPDATE cartridges SET ${updates.join(', ')}
         WHERE id = :id AND tenant_id = :tenant_id
         RETURNING *`,
        params
      );

      if (!result.rows?.length) {
        throw new Error('Cartridge not found');
      }

      logger.info('Cartridge updated', { cartridgeId, tenantId });
      return this.mapRowToCartridge(result.rows[0]);
    } catch (error) {
      logger.error('Failed to update cartridge', { error, cartridgeId });
      throw error;
    }
  }

  /**
   * Archive (soft-delete) a cartridge
   */
  async archiveCartridge(
    cartridgeId: string,
    tenantId: string,
    userId: string
  ): Promise<void> {
    try {
      await executeStatement(
        `UPDATE cartridges 
         SET archived_at = NOW(), archived_by = :user_id, status = 'archived'
         WHERE id = :id AND tenant_id = :tenant_id`,
        [
          stringParam('id', cartridgeId),
          stringParam('tenant_id', tenantId),
          stringParam('user_id', userId),
        ]
      );

      logger.info('Cartridge archived', { cartridgeId, tenantId, userId });
    } catch (error) {
      logger.error('Failed to archive cartridge', { error, cartridgeId });
      throw error;
    }
  }

  // ===========================================================================
  // Export / Import
  // ===========================================================================

  /**
   * Export a cartridge to .RADz file
   */
  async exportCartridge(
    tenantId: string,
    userId: string,
    request: ExportCartridgeRequest
  ): Promise<ExportCartridgeResponse> {
    try {
      // Create cartridge record
      const cartridge = await this.createCartridge(tenantId, userId, {
        name: `Export-${new Date().toISOString().slice(0, 10)}`,
        scope: request.scope,
        domains: request.domains,
        includeLoraAdapters: request.includeLora,
        includeCuratorKnowledge: request.includeCurator,
        includeGhostCompression: request.includeGhost,
        includeDomainExperts: request.includeDomainExperts,
      });

      // Build manifest
      const manifest: CartridgeManifest = {
        version: '1.0.0',
        radiantVersion: '6.0.0',
        cartridgeId: cartridge.id,
        name: cartridge.name,
        created: new Date().toISOString(),
        createdBy: userId,
        domains: request.domains,
        hasLoraAdapters: request.includeLora,
        hasCuratorKnowledge: request.includeCurator,
        hasGhostCompression: request.includeGhost,
        hasDomainExperts: request.includeDomainExperts,
        cortexVersions: {},
        targetModels: [],
        requiredCapabilities: [],
        checksums: {},
        scope: request.scope,
        tenantId: request.tenantId,
        userId: request.userId,
        allowUserOverride: request.scope === 'tenant',
        overridableFields: [],
      };

      // In production, this would:
      // 1. Gather all network files from S3
      // 2. Bundle into ZIP archive
      // 3. Upload to cartridge bucket
      // For now, we create a placeholder

      const storageKey = `${tenantId}/${request.scope}/${cartridge.id}.radz`;
      const manifestJson = JSON.stringify(manifest, null, 2);

      await this.s3Client.send(new PutObjectCommand({
        Bucket: CARTRIDGE_BUCKET,
        Key: storageKey,
        Body: manifestJson,
        ContentType: 'application/json',
      }));

      // Calculate content hash for signing
      const contentHash = this.calculateChecksum(manifestJson);

      // Update cartridge with storage info
      await executeStatement(
        `UPDATE cartridges 
         SET storage_key = :storage_key, storage_bucket = :bucket, 
             file_size_bytes = :size, checksum = :checksum, status = 'ready'
         WHERE id = :id`,
        [
          stringParam('id', cartridge.id),
          stringParam('storage_key', storageKey),
          stringParam('bucket', CARTRIDGE_BUCKET),
          stringParam('size', String(manifestJson.length)),
          stringParam('checksum', contentHash),
        ]
      );

      // Sign the cartridge (Signing Ceremony)
      let signatureBlock: CartridgeSignatureBlock | undefined;
      let metadata: CartridgeMetadata | undefined;
      try {
        const signResult = await cartridgePKIService.signCartridge(
          tenantId,
          cartridge.id,
          manifest.name,
          manifest.version,
          contentHash,
          userId
        );
        signatureBlock = signResult.signatureBlock;
        metadata = signResult.metadata;
        metadata.file_size_bytes = manifestJson.length;

        // Store signature.sig in the cartridge
        const signatureKey = `${tenantId}/${request.scope}/${cartridge.id}/${SIGNATURE_FILENAME}`;
        await this.s3Client.send(new PutObjectCommand({
          Bucket: CARTRIDGE_BUCKET,
          Key: signatureKey,
          Body: JSON.stringify(signatureBlock, null, 2),
          ContentType: 'application/json',
        }));

        // Store meta.json sidecar for web publishing
        const metadataKey = `${tenantId}/${request.scope}/${cartridge.id}/${METADATA_FILENAME}`;
        await this.s3Client.send(new PutObjectCommand({
          Bucket: CARTRIDGE_BUCKET,
          Key: metadataKey,
          Body: JSON.stringify(metadata, null, 2),
          ContentType: 'application/json',
        }));

        logger.info('Cartridge signed', { cartridgeId: cartridge.id, tenantId });
      } catch (signError) {
        logger.warn('Cartridge signing failed, exporting unsigned', { 
          cartridgeId: cartridge.id, 
          error: signError 
        });
      }

      // v6.2.0: Generate RNIR source code if Curator knowledge is included
      if (request.includeCurator) {
        try {
          const rnirResult = await cartridgeRNIRService.generateFromCurator(tenantId, {
            cartridgeId: cartridge.id,
            domains: request.domains,
            minQuality: 0.7,
            maxExamplesPerDomain: 100,
          });
          if (rnirResult.success) {
            logger.info('RNIR generated for cartridge', { 
              cartridgeId: cartridge.id, 
              examplesGenerated: rnirResult.examplesGenerated 
            });
          }
        } catch (rnirError) {
          logger.warn('RNIR generation failed, continuing export', { 
            cartridgeId: cartridge.id, 
            error: String(rnirError) 
          });
        }
      }

      // Generate presigned download URL
      const downloadUrl = await getSignedUrl(
        this.s3Client,
        new GetObjectCommand({
          Bucket: CARTRIDGE_BUCKET,
          Key: storageKey,
        }),
        { expiresIn: PRESIGNED_URL_EXPIRY }
      );

      logger.info('Cartridge exported', { 
        cartridgeId: cartridge.id, 
        tenantId, 
        signed: !!signatureBlock 
      });

      return {
        cartridgeId: cartridge.id,
        downloadUrl,
        expiresAt: new Date(Date.now() + PRESIGNED_URL_EXPIRY * 1000).toISOString(),
        estimatedSizeBytes: manifestJson.length,
        signatureBlock,
        metadata,
      };
    } catch (error) {
      logger.error('Failed to export cartridge', { error, tenantId });
      throw error;
    }
  }

  /**
   * Import a cartridge from .RADz file
   */
  async importCartridge(
    tenantId: string,
    userId: string,
    request: ImportCartridgeRequest
  ): Promise<ImportCartridgeResponse> {
    try {
      // Fetch and validate the uploaded file
      const validation = await this.validateCartridgeFile(request.fileKey);
      
      if (!validation.isValid) {
        return {
          cartridgeId: '',
          status: 'failed',
          validationErrors: validation.errors.map(e => e.message),
        };
      }

      const manifest = validation.manifest!;

      // v6.2.0: Check vault requirements (Keyhole Pattern)
      if (manifest.vaultRequirements) {
        try {
          const vaultCheck = await cartridgeVaultService.checkRequirements(tenantId, manifest.vaultRequirements);
          if (!vaultCheck.satisfied) {
            logger.warn('Cartridge import has missing vault secrets', {
              fileKey: request.fileKey,
              missingRequired: vaultCheck.missingRequired,
            });
            // Don't block import, but log warning - admin can add secrets later
          }
          if (vaultCheck.expiringSoon.length > 0) {
            logger.warn('Cartridge vault secrets expiring soon', {
              fileKey: request.fileKey,
              expiringSoon: vaultCheck.expiringSoon,
            });
          }
        } catch (vaultError) {
          logger.warn('Vault check failed, continuing import', { error: String(vaultError) });
        }
      }

      // PKI v8.0: Verify signature if required
      let signatureVerification;
      if (request.validateSignature) {
        const signatureResult = await this.verifyCartridgeSignature(request.fileKey, manifest);
        signatureVerification = signatureResult;

        // Reject import if signature validation is required and fails
        if (!signatureResult.isValid) {
          logger.warn('Cartridge import rejected: invalid signature', {
            fileKey: request.fileKey,
            status: signatureResult.status,
            errors: signatureResult.errors,
          });
          return {
            cartridgeId: '',
            status: 'failed',
            validationErrors: [
              `Signature verification failed: ${signatureResult.status}`,
              ...signatureResult.errors,
            ],
            signatureVerification,
          };
        }
        logger.info('Cartridge signature verified', { 
          fileKey: request.fileKey,
          signedBy: signatureResult.signedBy,
        });
      }

      // Create cartridge record
      const id = crypto.randomUUID();
      const now = new Date();

      await executeStatement(
        `INSERT INTO cartridges (
          id, tenant_id, user_id, name, description, version, scope, status,
          storage_key, storage_bucket, domains, has_lora_adapters, 
          has_curator_knowledge, has_ghost_compression, has_domain_experts,
          allow_user_override, overridable_fields, is_enabled,
          is_signed, signed_at,
          created_at, created_by, updated_at
        ) VALUES (
          :id, :tenant_id, :user_id, :name, :description, :version, :scope, :status,
          :storage_key, :bucket, :domains, :has_lora, :has_curator, :has_ghost, :has_domain,
          :allow_override, :overridable_fields, :is_enabled,
          :is_signed, :signed_at,
          :created_at, :created_by, :updated_at
        )`,
        [
          stringParam('id', id),
          stringParam('tenant_id', tenantId),
          stringParam('user_id', request.scope === 'user' ? (request.userId || userId) : ''),
          stringParam('name', manifest.name),
          stringParam('description', manifest.description || ''),
          stringParam('version', manifest.version),
          stringParam('scope', request.scope),
          stringParam('status', request.activateImmediately ? 'active' : 'ready'),
          stringParam('storage_key', request.fileKey),
          stringParam('bucket', CARTRIDGE_BUCKET),
          stringParam('domains', JSON.stringify(manifest.domains)),
          boolParam('has_lora', manifest.hasLoraAdapters),
          boolParam('has_curator', manifest.hasCuratorKnowledge),
          boolParam('has_ghost', manifest.hasGhostCompression),
          boolParam('has_domain', manifest.hasDomainExperts),
          boolParam('allow_override', manifest.allowUserOverride),
          stringParam('overridable_fields', JSON.stringify(manifest.overridableFields)),
          boolParam('is_enabled', true),
          boolParam('is_signed', signatureVerification?.isValid || false),
          stringParam('signed_at', signatureVerification?.isValid ? now.toISOString() : ''),
          stringParam('created_at', now.toISOString()),
          stringParam('created_by', userId),
          stringParam('updated_at', now.toISOString()),
        ]
      );

      logger.info('Cartridge imported', { 
        cartridgeId: id, 
        tenantId,
        signatureVerified: signatureVerification?.isValid || false,
      });

      // v6.2.0: Store vault requirements from manifest (Keyhole Pattern)
      if (manifest.vaultRequirements) {
        try {
          await cartridgeVaultService.storeRequirements(tenantId, id, manifest.vaultRequirements as any);
          logger.info('Vault requirements stored for cartridge', { cartridgeId: id });
        } catch (vaultError) {
          logger.warn('Failed to store vault requirements', { 
            cartridgeId: id, 
            error: String(vaultError) 
          });
        }
      }

      return {
        cartridgeId: id,
        status: request.activateImmediately ? 'active' : 'ready',
        manifest,
        signatureVerification,
      };
    } catch (error) {
      logger.error('Failed to import cartridge', { error, tenantId });
      throw error;
    }
  }

  /**
   * Verify cartridge signature during import
   * PKI v8.0: Fetches signature.sig from the cartridge and verifies
   */
  private async verifyCartridgeSignature(
    fileKey: string,
    manifest: CartridgeManifest
  ): Promise<CartridgeVerificationResult> {
    try {
      // Derive signature file key from cartridge key
      const signatureKey = fileKey.replace(/\.radz$/, `/${SIGNATURE_FILENAME}`);
      
      // Fetch signature.sig
      const signatureResponse = await this.s3Client.send(new GetObjectCommand({
        Bucket: CARTRIDGE_BUCKET,
        Key: signatureKey,
      }));

      const signatureBody = await signatureResponse.Body?.transformToString();
      if (!signatureBody) {
        return {
          status: 'missing_signature',
          isValid: false,
          authorSignatureValid: false,
          platformSignatureValid: false,
          hashValid: false,
          certificateChainValid: false,
          notExpired: true,
          notRevoked: true,
          verifiedAt: new Date(),
          errors: ['signature.sig file not found in cartridge'],
          warnings: [],
        };
      }

      const signatureBlock = JSON.parse(signatureBody) as CartridgeSignatureBlock;

      // Fetch the cartridge content and calculate hash
      const cartridgeResponse = await this.s3Client.send(new GetObjectCommand({
        Bucket: CARTRIDGE_BUCKET,
        Key: fileKey,
      }));
      const cartridgeContent = await cartridgeResponse.Body?.transformToString();
      const contentHash = this.calculateChecksum(cartridgeContent || '');

      // Verify using PKI service
      return await cartridgePKIService.verifyCartridge(signatureBlock, contentHash);
    } catch (error) {
      logger.error('Failed to verify cartridge signature', { error, fileKey });
      return {
        status: 'corrupted',
        isValid: false,
        authorSignatureValid: false,
        platformSignatureValid: false,
        hashValid: false,
        certificateChainValid: false,
        notExpired: true,
        notRevoked: true,
        verifiedAt: new Date(),
        errors: [error instanceof Error ? error.message : 'Unknown verification error'],
        warnings: [],
      };
    }
  }

  // ===========================================================================
  // Stack Resolution
  // ===========================================================================

  /**
   * Get the cartridge stack for a user
   * System cartridges: Platform-wide, visible by default but can be hidden by tenant admin
   * Tenant cartridges: CANNOT be disabled by users
   * User cartridges: CAN be disabled
   * 
   * v6.1.0: System cartridges now respect tenant visibility settings.
   * If a tenant admin has hidden a system cartridge, it won't appear in the stack.
   */
  async getCartridgeStack(tenantId: string, userId?: string): Promise<CartridgeStack> {
    try {
      // Get system cartridges that are visible to this tenant
      // Default is visible (when no entry exists in tenant_cartridge_visibility)
      // Only hidden when is_visible = false in tenant_cartridge_visibility
      const systemResult = await executeStatement(
        `SELECT c.* FROM cartridges c
         LEFT JOIN tenant_cartridge_visibility tcv 
           ON c.id = tcv.cartridge_id AND tcv.tenant_id = :tenant_id
         WHERE c.scope = 'system' 
           AND c.status = 'active'
           AND c.archived_at IS NULL
           AND COALESCE(tcv.is_visible, true) = true
         ORDER BY c.created_at ASC`,
        [stringParam('tenant_id', tenantId)]
      );

      const systemStack: CartridgeStackEntry[] = (systemResult.rows || []).map(
        (row: Record<string, unknown>, index: number) => ({
          cartridge: this.mapRowToCartridge(row),
          position: index,
          isEnabled: true, // Always enabled
          canDisable: false, // CANNOT be disabled
          canOverride: false, // System cartridges cannot be overridden
        })
      );

      // Get tenant cartridges (always active, cannot be disabled by users)
      const tenantResult = await executeStatement(
        `SELECT * FROM cartridges 
         WHERE tenant_id = :tenant_id 
           AND scope = 'tenant' 
           AND status = 'active'
           AND archived_at IS NULL
         ORDER BY created_at ASC`,
        [stringParam('tenant_id', tenantId)]
      );

      const tenantStack: CartridgeStackEntry[] = (tenantResult.rows || []).map(
        (row: Record<string, unknown>, index: number) => ({
          cartridge: this.mapRowToCartridge(row),
          position: systemStack.length + index,
          isEnabled: true, // Always enabled
          canDisable: false, // CANNOT be disabled by users
          canOverride: Boolean(row.allow_user_override),
        })
      );

      // Get user cartridges if userId provided
      let userStack: CartridgeStackEntry[] = [];
      if (userId) {
        const userResult = await executeStatement(
          `SELECT * FROM cartridges 
           WHERE tenant_id = :tenant_id 
             AND scope = 'user'
             AND user_id = :user_id
             AND status IN ('active', 'ready')
             AND archived_at IS NULL
           ORDER BY created_at ASC`,
          [stringParam('tenant_id', tenantId), stringParam('user_id', userId)]
        );

        userStack = (userResult.rows || []).map(
          (row: Record<string, unknown>, index: number) => ({
            cartridge: this.mapRowToCartridge(row),
            position: systemStack.length + tenantStack.length + index,
            isEnabled: Boolean(row.is_enabled),
            canDisable: true, // CAN be disabled
            canOverride: true,
          })
        );
      }

      // Calculate effective cartridge (merged: system → tenant → user)
      const allEnabled = [
        ...systemStack.filter(e => e.isEnabled),
        ...tenantStack.filter(e => e.isEnabled),
        ...userStack.filter(e => e.isEnabled),
      ];

      const domains = new Set<string>();
      const cortexVersions: Record<string, string> = {};
      const loraAdapters: string[] = [];
      let goldenRulesCount = 0;
      let safetyMatrixEntriesCount = 0;

      for (const entry of allEnabled) {
        entry.cartridge.domains.forEach(d => domains.add(d));
        if (entry.cartridge.hasLoraAdapters) {
          loraAdapters.push(entry.cartridge.id);
        }
        if (entry.cartridge.hasCuratorKnowledge) {
          goldenRulesCount++;
          safetyMatrixEntriesCount++;
        }
      }

      return {
        tenantId,
        userId,
        systemStack,
        tenantStack,
        userStack,
        effectiveCartridge: {
          domains: Array.from(domains),
          cortexVersions,
          loraAdapters,
          goldenRulesCount,
          safetyMatrixEntriesCount,
        },
      };
    } catch (error) {
      logger.error('Failed to get cartridge stack', { error, tenantId, userId });
      throw error;
    }
  }

  /**
   * List system cartridges (Radiant Admin only)
   */
  async listSystemCartridges(): Promise<CartridgeListResponse> {
    try {
      const result = await executeStatement(
        `SELECT * FROM cartridges 
         WHERE scope = 'system' AND archived_at IS NULL
         ORDER BY created_at DESC`,
        []
      );

      const countResult = await executeStatement(
        `SELECT COUNT(*) as total FROM cartridges WHERE scope = 'system' AND archived_at IS NULL`,
        []
      );

      return {
        cartridges: (result.rows || []).map((row: Record<string, unknown>) => this.mapRowToCartridge(row)),
        total: Number(countResult.rows?.[0]?.total || 0),
        limit: 100,
        offset: 0,
      };
    } catch (error) {
      logger.error('Failed to list system cartridges', { error });
      throw error;
    }
  }

  /**
   * Create a system cartridge (Radiant Admin only)
   */
  async createSystemCartridge(
    userId: string,
    request: CreateCartridgeRequest
  ): Promise<Cartridge> {
    try {
      const id = crypto.randomUUID();
      const now = new Date();

      const result = await executeStatement(
        `INSERT INTO cartridges (
          id, tenant_id, user_id, name, description, version, scope, status,
          domains, has_lora_adapters, has_curator_knowledge, has_ghost_compression,
          has_domain_experts, allow_user_override, overridable_fields, tags,
          is_enabled, created_at, created_by, updated_at
        ) VALUES (
          :id, 'SYSTEM', '', :name, :description, '1.0.0', 'system', 'draft',
          :domains, :has_lora, :has_curator, :has_ghost, :has_domain,
          false, '[]', :tags,
          true, :created_at, :created_by, :updated_at
        ) RETURNING *`,
        [
          stringParam('id', id),
          stringParam('name', request.name),
          stringParam('description', request.description || ''),
          stringParam('domains', JSON.stringify(request.domains)),
          boolParam('has_lora', request.includeLoraAdapters || false),
          boolParam('has_curator', request.includeCuratorKnowledge || false),
          boolParam('has_ghost', request.includeGhostCompression || false),
          boolParam('has_domain', request.includeDomainExperts || false),
          stringParam('tags', JSON.stringify(request.tags || [])),
          stringParam('created_at', now.toISOString()),
          stringParam('created_by', userId),
          stringParam('updated_at', now.toISOString()),
        ]
      );

      logger.info('System cartridge created', { id });
      return this.mapRowToCartridge(result.rows?.[0] || { id });
    } catch (error) {
      logger.error('Failed to create system cartridge', { error });
      throw error;
    }
  }

  /**
   * Toggle a user cartridge on/off
   * Tenant cartridges CANNOT be toggled
   */
  async toggleUserCartridge(
    cartridgeId: string,
    tenantId: string,
    userId: string,
    enabled: boolean
  ): Promise<Cartridge> {
    try {
      // Verify it's a user cartridge
      const cartridge = await this.getCartridge(cartridgeId, tenantId);
      if (!cartridge) {
        throw new Error('Cartridge not found');
      }

      if (cartridge.scope !== 'user') {
        throw new Error('Cannot toggle tenant cartridges - they are always active');
      }

      if (cartridge.userId !== userId) {
        throw new Error('Cannot toggle another user\'s cartridge');
      }

      return await this.updateCartridge(cartridgeId, tenantId, userId, {
        isEnabled: enabled,
      });
    } catch (error) {
      logger.error('Failed to toggle cartridge', { error, cartridgeId });
      throw error;
    }
  }

  // ===========================================================================
  // Validation
  // ===========================================================================

  /**
   * Validate a cartridge file
   */
  async validateCartridgeFile(fileKey: string): Promise<CartridgeValidationResult> {
    try {
      // Fetch file from S3
      const response = await this.s3Client.send(new GetObjectCommand({
        Bucket: CARTRIDGE_BUCKET,
        Key: fileKey,
      }));

      const body = await response.Body?.transformToString();
      if (!body) {
        return {
          isValid: false,
          errors: [{ code: 'CORRUPTED_FILE', message: 'Empty or corrupted file' }],
          warnings: [],
        };
      }

      // Parse manifest
      let manifest: CartridgeManifest;
      try {
        manifest = JSON.parse(body);
      } catch {
        return {
          isValid: false,
          errors: [{ code: 'INVALID_MANIFEST', message: 'Invalid JSON in manifest' }],
          warnings: [],
        };
      }

      // Validate required fields
      const errors: Array<{ code: string; message: string; field?: string }> = [];
      const warnings: Array<{ code: string; message: string }> = [];

      if (!manifest.version) {
        errors.push({ code: 'MISSING_REQUIRED_FIELD', message: 'Missing version', field: 'version' });
      }

      if (!manifest.radiantVersion) {
        errors.push({ code: 'MISSING_REQUIRED_FIELD', message: 'Missing radiantVersion', field: 'radiantVersion' });
      }

      if (!manifest.scope) {
        errors.push({ code: 'MISSING_REQUIRED_FIELD', message: 'Missing scope', field: 'scope' });
      }

      // Check version compatibility
      if (manifest.radiantVersion && !this.isVersionCompatible(manifest.radiantVersion)) {
        errors.push({
          code: 'INCOMPATIBLE_VERSION',
          message: `Cartridge requires RADIANT ${manifest.radiantVersion}, current is 6.0.0`,
        });
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        manifest: errors.length === 0 ? manifest : undefined,
      };
    } catch (error) {
      logger.error('Failed to validate cartridge file', { error, fileKey });
      return {
        isValid: false,
        errors: [{ code: 'CORRUPTED_FILE', message: 'Failed to read cartridge file' }],
        warnings: [],
      };
    }
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private mapRowToCartridge(row: Record<string, unknown>): Cartridge {
    return {
      id: String(row.id || ''),
      tenantId: String(row.tenant_id || ''),
      userId: row.user_id ? String(row.user_id) : undefined,
      name: String(row.name || ''),
      description: row.description ? String(row.description) : undefined,
      version: String(row.version || '1.0.0'),
      scope: (row.scope as CartridgeScope) || 'tenant',
      status: (row.status as CartridgeStatus) || 'draft',
      storageKey: String(row.storage_key || ''),
      storageBucket: String(row.storage_bucket || CARTRIDGE_BUCKET),
      fileSizeBytes: Number(row.file_size_bytes) || 0,
      checksum: String(row.checksum || ''),
      domains: row.domains ? JSON.parse(String(row.domains)) : [],
      hasLoraAdapters: Boolean(row.has_lora_adapters),
      hasCuratorKnowledge: Boolean(row.has_curator_knowledge),
      hasGhostCompression: Boolean(row.has_ghost_compression),
      hasDomainExperts: Boolean(row.has_domain_experts),
      allowUserOverride: Boolean(row.allow_user_override),
      overridableFields: row.overridable_fields ? JSON.parse(String(row.overridable_fields)) : [],
      isEnabled: Boolean(row.is_enabled),
      activatedAt: row.activated_at ? new Date(String(row.activated_at)) : undefined,
      activatedBy: row.activated_by ? String(row.activated_by) : undefined,
      tags: row.tags ? JSON.parse(String(row.tags)) : [],
      metadata: row.metadata ? JSON.parse(String(row.metadata)) : {},
      createdAt: new Date(String(row.created_at || new Date())),
      createdBy: String(row.created_by || ''),
      updatedAt: new Date(String(row.updated_at || new Date())),
      archivedAt: row.archived_at ? new Date(String(row.archived_at)) : undefined,
      archivedBy: row.archived_by ? String(row.archived_by) : undefined,
    };
  }

  private calculateChecksum(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  private isVersionCompatible(requiredVersion: string): boolean {
    // Simple semver check - in production use proper semver library
    const [reqMajor] = requiredVersion.split('.').map(Number);
    const currentMajor = 6;
    return reqMajor <= currentMajor;
  }
}

export const cartridgeService = new CartridgeService();
