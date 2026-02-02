/**
 * Cartridge Vault Types (Keyhole Pattern)
 * 
 * Secrets management for cartridges - cartridges declare required secrets
 * but never contain actual credentials. Service Layer fetches from Genesis Vault.
 * 
 * @version 1.0.0
 * @since v6.2.0
 */

// =============================================================================
// Vault Secret Types
// =============================================================================

/**
 * Categories of secrets a cartridge can require
 */
export type VaultSecretCategory = 
  | 'api_key'           // External API keys (OpenAI, Stripe, etc.)
  | 'database'          // Database credentials
  | 'oauth'             // OAuth client credentials
  | 'encryption'        // Encryption keys
  | 'webhook'           // Webhook signing secrets
  | 'custom';           // Custom tenant secrets

/**
 * Secret requirement in vault.req
 */
export interface VaultSecretRequirement {
  /** Unique key name (e.g., "STRIPE_API_KEY") */
  key: string;
  
  /** Human-readable description */
  description: string;
  
  /** Category of secret */
  category: VaultSecretCategory;
  
  /** Whether this secret is required (vs optional) */
  required: boolean;
  
  /** Environment variables to check as fallback */
  envFallback?: string[];
  
  /** Validation pattern (regex) */
  validationPattern?: string;
  
  /** Example value format (for documentation) */
  exampleFormat?: string;
}

/**
 * Vault requirements manifest (vault.req in .RADz)
 */
export interface CartridgeVaultManifest {
  /** Schema version */
  version: '1.0';
  
  /** Cartridge ID this manifest belongs to */
  cartridgeId: string;
  
  /** Required secrets */
  requires: VaultSecretRequirement[];
  
  /** Optional secrets */
  optional?: VaultSecretRequirement[];
  
  /** Notes for administrators */
  notes?: string;
}

// =============================================================================
// Vault Storage
// =============================================================================

/**
 * Stored secret in Genesis Vault
 */
export interface VaultSecret {
  /** Unique identifier */
  id: string;
  
  /** Tenant ID */
  tenantId: string;
  
  /** Secret key name */
  key: string;
  
  /** Category */
  category: VaultSecretCategory;
  
  /** Description */
  description: string;
  
  /** Encrypted value (KMS encrypted) */
  encryptedValue: string;
  
  /** KMS key ARN used for encryption */
  kmsKeyArn: string;
  
  /** Version for rotation tracking */
  version: number;
  
  /** Created timestamp */
  createdAt: string;
  
  /** Last updated timestamp */
  updatedAt: string;
  
  /** Last accessed timestamp (for auditing) */
  lastAccessedAt?: string;
  
  /** Access count */
  accessCount: number;
  
  /** Expiration date (optional) */
  expiresAt?: string;
  
  /** Whether secret is active */
  isActive: boolean;
  
  /** Rotation schedule (cron expression) */
  rotationSchedule?: string;
  
  /** Last rotation timestamp */
  lastRotatedAt?: string;
}

/**
 * Secret access log entry
 */
export interface VaultAccessLog {
  id: string;
  tenantId: string;
  secretId: string;
  secretKey: string;
  accessedBy: string;
  accessType: 'read' | 'write' | 'rotate' | 'delete';
  cartridgeId?: string;
  operationId?: string;
  success: boolean;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

// =============================================================================
// Keyhole Pattern Operations
// =============================================================================

/**
 * Result of checking vault requirements
 */
export interface VaultRequirementCheck {
  /** Whether all required secrets are available */
  satisfied: boolean;
  
  /** List of missing required secrets */
  missingRequired: string[];
  
  /** List of missing optional secrets */
  missingOptional: string[];
  
  /** List of available secrets */
  available: string[];
  
  /** Secrets with validation errors */
  validationErrors: {
    key: string;
    error: string;
  }[];
  
  /** Secrets expiring soon (within 30 days) */
  expiringSoon: {
    key: string;
    expiresAt: string;
  }[];
}

/**
 * Injected secrets context for runtime
 * IMPORTANT: This is only available in Service Layer, never passed to models
 */
export interface VaultSecretsContext {
  /** Operation ID for audit trail */
  operationId: string;
  
  /** Cartridge ID these secrets are for */
  cartridgeId: string;
  
  /** Tenant ID */
  tenantId: string;
  
  /** Available secrets (keys only, values fetched on-demand) */
  availableKeys: string[];
  
  /** Get a secret value (triggers audit log) */
  getSecret: (key: string) => Promise<string | null>;
  
  /** Check if a secret exists */
  hasSecret: (key: string) => boolean;
}

// =============================================================================
// Admin Dashboard Types
// =============================================================================

/**
 * Vault dashboard summary
 */
export interface VaultDashboard {
  /** Total secrets stored */
  totalSecrets: number;
  
  /** Secrets by category */
  byCategory: Record<VaultSecretCategory, number>;
  
  /** Secrets expiring within 30 days */
  expiringSoon: number;
  
  /** Secrets accessed in last 24h */
  recentlyAccessed: number;
  
  /** Recent access log */
  recentAccess: VaultAccessLog[];
  
  /** Cartridges with unmet requirements */
  cartridgesWithMissingSecrets: {
    cartridgeId: string;
    cartridgeName: string;
    missingSecrets: string[];
  }[];
}

/**
 * Secret creation request
 */
export interface CreateVaultSecretRequest {
  key: string;
  value: string;
  category: VaultSecretCategory;
  description: string;
  expiresAt?: string;
  rotationSchedule?: string;
}

/**
 * Secret update request
 */
export interface UpdateVaultSecretRequest {
  value?: string;
  description?: string;
  expiresAt?: string;
  rotationSchedule?: string;
  isActive?: boolean;
}

/**
 * Rotate secret request
 */
export interface RotateVaultSecretRequest {
  newValue: string;
  reason: string;
}

// =============================================================================
// Merkle Audit Trail (from Cato spec v4.21.0)
// =============================================================================

/**
 * Merkle entry for tamper-evident vault access log
 * Implements append-only audit trail per CATO_INVARIANTS
 */
export interface VaultMerkleEntry {
  /** Entry ID */
  entryId: string;
  
  /** Tenant ID */
  tenantId: string;
  
  /** Previous entry hash (chain) */
  previousHash: string;
  
  /** Current entry hash */
  currentHash: string;
  
  /** Merkle root at this point */
  merkleRoot: string;
  
  /** Access log ID this entry covers */
  accessLogId: string;
  
  /** Entry data hash */
  dataHash: string;
  
  /** Created timestamp */
  createdAt: string;
}

/**
 * Chain of custody for secrets (from Curator spec)
 */
export interface VaultChainOfCustody {
  /** Secret ID */
  secretId: string;
  
  /** Events in the chain */
  events: VaultCustodyEvent[];
  
  /** SHA-256 tamper-evident signature */
  signature: string;
}

export interface VaultCustodyEvent {
  /** Event type */
  type: 'create' | 'read' | 'update' | 'rotate' | 'delete' | 'revoke';
  
  /** Actor (user/service) */
  actor: string;
  
  /** Timestamp */
  timestamp: string;
  
  /** Description */
  description: string;
  
  /** Previous event hash */
  previousHash?: string;
  
  /** Event hash */
  eventHash: string;
}

// =============================================================================
// Control Barrier Functions (from Cato spec v4.21.0)
// =============================================================================

/**
 * CBF for vault access - hard constraints that NEVER relax
 */
export interface VaultCBFDefinition {
  /** Barrier ID */
  barrierId: string;
  
  /** Barrier type */
  barrierType: 'secret_access' | 'rotation_required' | 'expiry_check' | 'authorization';
  
  /** Is this critical (blocks immediately)? */
  isCritical: boolean;
  
  /** Enforcement mode - always ENFORCE for CBFs */
  enforcementMode: 'ENFORCE';
  
  /** Threshold configuration */
  thresholdConfig: {
    /** Max access count before rotation required */
    maxAccessCount?: number;
    /** Max days before expiry warning */
    expiryWarningDays?: number;
    /** Required authorization level */
    minAuthorizationLevel?: 'service' | 'user' | 'admin' | 'system';
  };
}

export interface VaultCBFResult {
  /** All barriers passed? */
  passed: boolean;
  
  /** Which barrier blocked (if any) */
  blockedBy?: string;
  
  /** Barrier results */
  barriers: {
    barrierId: string;
    passed: boolean;
    message?: string;
  }[];
}

// =============================================================================
// Governance Presets (from Cato spec v4.21.0)
// =============================================================================

/**
 * Governance preset for vault access friction
 */
export type VaultGovernancePreset = 'PARANOID' | 'BALANCED' | 'COWBOY';

export interface VaultGovernanceConfig {
  /** Preset name */
  preset: VaultGovernancePreset;
  
  /** Require approval for new secrets? */
  requireApprovalForCreate: boolean;
  
  /** Require approval for rotations? */
  requireApprovalForRotate: boolean;
  
  /** Max secret value length */
  maxSecretLength: number;
  
  /** Auto-expire secrets after days (0 = never) */
  autoExpireDays: number;
  
  /** Log all access (even reads)? */
  logAllAccess: boolean;
  
  /** Require MFA for access? */
  requireMfa: boolean;
}

export const VAULT_GOVERNANCE_PRESETS: Record<VaultGovernancePreset, VaultGovernanceConfig> = {
  PARANOID: {
    preset: 'PARANOID',
    requireApprovalForCreate: true,
    requireApprovalForRotate: true,
    maxSecretLength: 4096,
    autoExpireDays: 90,
    logAllAccess: true,
    requireMfa: true,
  },
  BALANCED: {
    preset: 'BALANCED',
    requireApprovalForCreate: false,
    requireApprovalForRotate: false,
    maxSecretLength: 8192,
    autoExpireDays: 365,
    logAllAccess: true,
    requireMfa: false,
  },
  COWBOY: {
    preset: 'COWBOY',
    requireApprovalForCreate: false,
    requireApprovalForRotate: false,
    maxSecretLength: 16384,
    autoExpireDays: 0,
    logAllAccess: false,
    requireMfa: false,
  },
};

// =============================================================================
// Export
// =============================================================================

export type {
  VaultSecretCategory as SecretCategory,
};
