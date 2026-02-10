/**
 * RADIANT Cartridge PKI Types
 * Cryptographic signing and verification for .RADz cartridges
 * 
 * Security Architecture v8.0:
 * - Radiant Root CA → Tenant Intermediate CA → Cartridge Signatures
 * - Dual signatures: author_check (tenant) + platform_check (Radiant)
 * - SHA-256 hash + asymmetric encryption (Ed25519)
 * - Federated trust for multi-cluster deployments
 */

// =============================================================================
// Certificate Hierarchy
// =============================================================================

/**
 * Certificate type in the PKI hierarchy
 */
export type CertificateType = 'root' | 'intermediate' | 'signing';

/**
 * Certificate status
 */
export type CertificateStatus = 'active' | 'revoked' | 'expired' | 'pending';

/**
 * Key algorithm - Ed25519 recommended for performance and security
 */
export type KeyAlgorithm = 'ed25519' | 'rsa-pss-4096' | 'ecdsa-p256';

/**
 * Radiant Root CA Certificate
 * Generated at Genesis, stored offline/HSM
 * Signs all Tenant Intermediate CAs
 */
export interface RootCACertificate {
  id: string;
  clusterId: string;                    // e.g., "us-east-1-prod"
  clusterName: string;                  // e.g., "Radiant Commercial US-East"
  publicKey: string;                    // PEM-encoded public key
  fingerprint: string;                  // SHA-256 of public key
  algorithm: KeyAlgorithm;
  validFrom: Date;
  validUntil: Date;
  status: CertificateStatus;
  createdAt: Date;
  metadata?: {
    environment: 'production' | 'staging' | 'development';
    region: string;
    version: string;
  };
}

/**
 * Tenant Intermediate CA Certificate
 * Signed by Root CA, stored in Cartridge Vault (HSM)
 * Signs cartridges for this tenant
 */
export interface TenantCACertificate {
  id: string;
  tenantId: string;
  tenantName: string;
  rootCaId: string;                     // Which Root CA signed this
  publicKey: string;                    // PEM-encoded public key
  fingerprint: string;                  // SHA-256 of public key
  algorithm: KeyAlgorithm;
  validFrom: Date;
  validUntil: Date;
  status: CertificateStatus;
  signedByRootAt: Date;
  rootSignature: string;                // Root CA's signature over this cert
  createdAt: Date;
  revokedAt?: Date;
  revokedReason?: string;
}

/**
 * Signing key for cartridge operations
 * Derived from Tenant CA, used for actual signing
 */
export interface CartridgeSigningKey {
  id: string;
  tenantId: string;
  tenantCaId: string;                   // Parent Tenant CA
  keyId: string;                        // AWS KMS key ID or internal ID
  keyArn?: string;                      // AWS KMS ARN if using KMS
  publicKey: string;                    // PEM-encoded public key
  fingerprint: string;
  algorithm: KeyAlgorithm;
  purpose: 'author' | 'platform';       // Author = tenant, Platform = Radiant
  validFrom: Date;
  validUntil: Date;
  status: CertificateStatus;
  createdAt: Date;
  lastUsedAt?: Date;
  usageCount: number;
}

// =============================================================================
// Cluster Compatibility
// =============================================================================

/**
 * RADIANT apps that can use cartridges
 * Each Radiant cluster typically serves one system with multiple apps
 */
export type RadiantApp = 
  | 'radiant_admin'           // Platform administration
  | 'thinktank_admin'         // Think Tank tenant administration
  | 'thinktank'               // Think Tank consumer app
  | 'curator'                 // Knowledge management
  | 'service_layer';          // MCP/A2A/API services

/**
 * Cluster compatibility profile
 * Embedded in signature to verify cartridge compatibility before import
 */
export interface ClusterCompatibility {
  // Source cluster identification
  sourceClusterId: string;              // e.g., "us-east-1-prod"
  sourceClusterName: string;            // e.g., "Radiant Commercial US-East"
  sourceClusterVersion: string;         // e.g., "6.1.0"
  
  // Platform version requirements
  minPlatformVersion: string;           // Minimum RADIANT version required
  maxPlatformVersion?: string;          // Optional: max version (for deprecated features)
  
  // App compatibility - which apps can use this cartridge
  compatibleApps: RadiantApp[];         // e.g., ['curator', 'thinktank']
  
  // Feature requirements - what the cartridge needs to function
  requiredFeatures?: string[];          // e.g., ['ghost_vectors', 'lora_adapters']
  
  // Environment
  environment: 'production' | 'staging' | 'development';
  
  // Optional: specific tenant IDs this cartridge is intended for
  // Empty = available to all tenants (within federation trust)
  intendedTenantIds?: string[];
}

/**
 * Compatibility check result
 */
export interface CompatibilityCheckResult {
  isCompatible: boolean;
  
  // Individual checks
  versionCompatible: boolean;
  appsCompatible: boolean;
  featuresAvailable: boolean;
  tenantAllowed: boolean;
  environmentCompatible: boolean;
  
  // Details
  sourceCluster: string;
  targetCluster: string;
  
  // Issues found
  incompatibilities: string[];
  warnings: string[];
}

// =============================================================================
// Cartridge Signatures
// =============================================================================

/**
 * Signature type
 */
export type SignatureType = 'author' | 'platform';

/**
 * Individual signature on a cartridge
 */
export interface CartridgeSignature {
  type: SignatureType;
  signerId: string;                     // Tenant ID (author) or Cluster ID (platform)
  signerName: string;                   // Display name for verification
  keyId: string;                        // Signing key ID
  keyFingerprint: string;               // For verification without fetching full key
  algorithm: KeyAlgorithm;
  signature: string;                    // Base64-encoded signature
  signedAt: Date;
  signedHash: string;                   // SHA-256 hash that was signed
  certificateChain?: string[];          // Optional: full cert chain for verification
}

/**
 * Complete signature block for a cartridge
 * Stored as signature.sig in .radz container
 */
export interface CartridgeSignatureBlock {
  version: '1.0';
  cartridgeId: string;
  cartridgeName: string;
  cartridgeVersion: string;
  
  // The hash of the cartridge contents (excluding signature.sig)
  contentHash: string;                  // SHA-256 of all other files
  hashAlgorithm: 'sha256';
  
  // Dual signatures
  authorSignature: CartridgeSignature;  // Tenant's signature
  platformSignature: CartridgeSignature; // Radiant's counter-signature
  
  // Metadata
  signedAt: Date;
  expiresAt?: Date;                     // Optional expiration
  
  // Trust chain
  trustChain: {
    rootCaFingerprint: string;
    tenantCaFingerprint: string;
    clusterId: string;
  };
  
  // Cluster compatibility (v6.1.0+)
  // Used to verify cartridge can be imported into target cluster
  compatibility: ClusterCompatibility;
}

/**
 * Lightweight metadata for web publishing
 * The meta.json sidecar file
 */
export interface CartridgeMetadata {
  cartridge_id: string;                 // e.g., "com.mcdonalds.cashier"
  name: string;
  description?: string;
  version: string;
  
  // Signatures (base64, truncated for display)
  signatures: {
    author_check: string;               // First 16 chars of author signature
    platform_check: string;             // First 16 chars of platform signature
  };
  
  // Verification
  hash: string;                         // "sha256:e3b0c44..."
  hash_algorithm: 'sha256';
  
  // Download
  download_url: string;
  file_size_bytes: number;
  
  // Trust
  signed_by: string;                    // Tenant name
  verified_by: string;                  // Cluster name (e.g., "Radiant US-East")
  signed_at: string;                    // ISO timestamp
  
  // Namespace
  namespace: {
    cluster_id: string;
    tenant_id: string;
    full_id: string;                    // "us-east-1-prod.mcdonalds.cashier-v4"
  };
  
  // Compatibility (v6.1.0+)
  compatibility: {
    min_version: string;                // Minimum RADIANT version required
    apps: RadiantApp[];                 // Compatible apps
    features?: string[];                // Required features
    environment: string;                // production/staging/development
  };
}

// =============================================================================
// Verification
// =============================================================================

/**
 * Cartridge signature verification result
 */
export type CartridgeSignatureVerificationStatus = 
  | 'valid'                             // All signatures valid
  | 'invalid_author'                    // Author signature failed
  | 'invalid_platform'                  // Platform signature failed
  | 'expired'                           // Signatures expired
  | 'revoked'                           // Certificate revoked
  | 'untrusted'                         // Root CA not in trust store
  | 'missing_signature'                 // No signature.sig found
  | 'hash_mismatch'                     // Content hash doesn't match
  | 'corrupted'                         // File corruption
  | 'incompatible_version'              // Platform version not compatible
  | 'incompatible_apps'                 // Target apps not supported
  | 'incompatible_features'             // Required features not available
  | 'incompatible_environment';         // Environment mismatch (prod vs dev)

/**
 * Detailed verification result
 */
export interface CartridgeVerificationResult {
  status: CartridgeSignatureVerificationStatus;
  isValid: boolean;
  
  // Individual checks
  authorSignatureValid: boolean;
  platformSignatureValid: boolean;
  hashValid: boolean;
  certificateChainValid: boolean;
  notExpired: boolean;
  notRevoked: boolean;
  
  // Compatibility checks (v6.1.0+)
  compatibilityCheck?: CompatibilityCheckResult;
  
  // Details
  verifiedAt: Date;
  cartridgeId?: string;
  cartridgeVersion?: string;
  signedBy?: string;
  verifiedBy?: string;
  
  // Source cluster info (for federation)
  sourceCluster?: {
    id: string;
    name: string;
    version: string;
  };
  
  // Errors
  errors: string[];
  warnings: string[];
}

// =============================================================================
// Federated Trust
// =============================================================================

/**
 * Trust store entry for cross-cluster trust
 * Allows "Radiant Defense" to trust cartridges from "Radiant Commercial"
 */
export interface TrustedRootCA {
  id: string;
  clusterId: string;                    // Foreign cluster ID
  clusterName: string;
  publicKey: string;
  fingerprint: string;
  addedAt: Date;
  addedBy: string;                      // Admin who added
  expiresAt?: Date;
  isActive: boolean;
  trustLevel: 'full' | 'limited';       // Limited = only specific tenants
  allowedTenantIds?: string[];          // For limited trust
}

// =============================================================================
// API Request/Response Types
// =============================================================================

/**
 * Request to sign a cartridge
 */
export interface SignCartridgeRequest {
  cartridgeId: string;
  contentHash: string;                  // Pre-computed SHA-256 of contents
  signingKeyId?: string;                // Optional: use specific key
}

/**
 * Response from signing
 */
export interface SignCartridgeResponse {
  signatureBlock: CartridgeSignatureBlock;
  metadata: CartridgeMetadata;
}

/**
 * Request to verify a cartridge
 */
export interface VerifyCartridgeRequest {
  signatureBlock: CartridgeSignatureBlock;
  contentHash: string;                  // SHA-256 of downloaded content
  trustStoreId?: string;                // Optional: use specific trust store
}

/**
 * Request to generate tenant CA
 */
export interface GenerateTenantCARequest {
  tenantId: string;
  tenantName: string;
  validityDays?: number;                // Default: 365 * 5 (5 years)
  algorithm?: KeyAlgorithm;             // Default: 'ed25519'
}

/**
 * Request to revoke a certificate
 */
export interface RevokeCertificateRequest {
  certificateId: string;
  certificateType: CertificateType;
  reason: string;
  revokedBy: string;
}

/**
 * Request to add trusted Root CA (federation)
 */
export interface AddTrustedRootRequest {
  clusterId: string;
  clusterName: string;
  publicKey: string;
  trustLevel: 'full' | 'limited';
  allowedTenantIds?: string[];
  expiresAt?: Date;
}

// =============================================================================
// Dashboard Types
// =============================================================================

/**
 * PKI dashboard summary
 */
export interface PKIDashboard {
  rootCA: {
    clusterId: string;
    fingerprint: string;
    validUntil: Date;
    status: CertificateStatus;
  };
  tenantCAs: {
    total: number;
    active: number;
    expiringSoon: number;               // Within 30 days
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

/**
 * PKI audit log entry
 */
export interface PKIAuditEntry {
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
