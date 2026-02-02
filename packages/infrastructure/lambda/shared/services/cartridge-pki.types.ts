/**
 * Cartridge PKI Types - Local re-export for Lambda services
 * These types are defined in @radiant/shared but re-exported here
 * to avoid build order dependencies
 */

export type CertificateStatus = 'active' | 'revoked' | 'expired' | 'pending';
export type KeyAlgorithm = 'ed25519' | 'rsa-pss-4096' | 'ecdsa-p256';
export type SignatureType = 'author' | 'platform';

// Cluster Compatibility (v6.1.0+)
export type RadiantApp = 
  | 'radiant_admin'
  | 'thinktank_admin'
  | 'thinktank'
  | 'curator'
  | 'service_layer';

export interface ClusterCompatibility {
  sourceClusterId: string;
  sourceClusterName: string;
  sourceClusterVersion: string;
  minPlatformVersion: string;
  maxPlatformVersion?: string;
  compatibleApps: RadiantApp[];
  requiredFeatures?: string[];
  environment: 'production' | 'staging' | 'development';
  intendedTenantIds?: string[];
}

export interface CompatibilityCheckResult {
  isCompatible: boolean;
  versionCompatible: boolean;
  appsCompatible: boolean;
  featuresAvailable: boolean;
  tenantAllowed: boolean;
  environmentCompatible: boolean;
  sourceCluster: string;
  targetCluster: string;
  incompatibilities: string[];
  warnings: string[];
}

export interface CartridgeSignature {
  type: SignatureType;
  signerId: string;
  signerName: string;
  keyId: string;
  keyFingerprint: string;
  algorithm: KeyAlgorithm;
  signature: string;
  signedAt: Date;
  signedHash: string;
  certificateChain?: string[];
}

export interface CartridgeSignatureBlock {
  version: '1.0';
  cartridgeId: string;
  cartridgeName: string;
  cartridgeVersion: string;
  contentHash: string;
  hashAlgorithm: 'sha256';
  authorSignature: CartridgeSignature;
  platformSignature: CartridgeSignature;
  signedAt: Date;
  expiresAt?: Date;
  trustChain: {
    rootCaFingerprint: string;
    tenantCaFingerprint: string;
    clusterId: string;
  };
  // Cluster compatibility (v6.1.0+)
  compatibility: ClusterCompatibility;
}

export interface CartridgeMetadata {
  cartridge_id: string;
  name: string;
  description?: string;
  version: string;
  signatures: {
    author_check: string;
    platform_check: string;
  };
  hash: string;
  hash_algorithm: 'sha256';
  download_url: string;
  file_size_bytes: number;
  signed_by: string;
  verified_by: string;
  signed_at: string;
  namespace: {
    cluster_id: string;
    tenant_id: string;
    full_id: string;
  };
  // Compatibility (v6.1.0+)
  compatibility: {
    min_version: string;
    apps: RadiantApp[];
    features?: string[];
    environment: string;
  };
}

export type CartridgeSignatureVerificationStatus = 
  | 'valid'
  | 'invalid_author'
  | 'invalid_platform'
  | 'expired'
  | 'revoked'
  | 'untrusted'
  | 'missing_signature'
  | 'hash_mismatch'
  | 'corrupted'
  | 'incompatible_version'
  | 'incompatible_apps'
  | 'incompatible_features'
  | 'incompatible_environment';

export interface CartridgeVerificationResult {
  status: CartridgeSignatureVerificationStatus;
  isValid: boolean;
  authorSignatureValid: boolean;
  platformSignatureValid: boolean;
  hashValid: boolean;
  certificateChainValid: boolean;
  notExpired: boolean;
  notRevoked: boolean;
  // Compatibility checks (v6.1.0+)
  compatibilityCheck?: CompatibilityCheckResult;
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
  errors: string[];
  warnings: string[];
}
