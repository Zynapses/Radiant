/**
 * RADIANT Cartridge System Types
 * Portable AI brains (.RADz files) for export/import of neural intelligence
 * 
 * A Cartridge is a self-contained AI intelligence package containing:
 * - AXIOM Scorers (ONNX format)
 * - Domain Expert networks (system cartridges)
 * - LoRA adapters
 * - Curator knowledge (golden rules, ontology, safety matrix)
 * - Ghost vector compression model
 * 
 * v6.1.0: Domain experts are now system cartridges with:
 * - System-wide registry with full audit trail
 * - Tenant visibility toggles (enabled by default, can hide)
 * - Thermal state management for inference optimization
 * - Compliance tracking (HIPAA, SOC2, GDPR)
 */

// =============================================================================
// Cartridge Scope & Visibility
// =============================================================================

/**
 * Cartridge Scope Hierarchy:
 * - 'system': Platform-wide, managed by Radiant Admin only. Visible to all tenants.
 * - 'tenant': Organization-wide, managed by Tenant Admin. Cannot be disabled by users.
 * - 'user': Personal cartridges, managed by individual users. Can be toggled on/off.
 */
export type CartridgeScope = 'system' | 'tenant' | 'user';

/**
 * Cartridge Category - distinguishes domain expert cartridges from general cartridges
 * - 'general': Standard cartridge with mixed content
 * - 'domain_expert': Contains domain-specific neural networks (7 per domain)
 */
export type CartridgeCategory = 'general' | 'domain_expert';

/**
 * Thermal state for cartridge inference optimization
 * Matches the domain expert thermal state management
 */
export type CartridgeThermalState = 'cold' | 'warming' | 'warm' | 'hot';

export type CartridgeStatus = 
  | 'draft'       // Being created
  | 'validating'  // Running validation checks
  | 'ready'       // Available for use
  | 'importing'   // Being imported
  | 'active'      // Currently in use
  | 'archived'    // Soft-deleted
  | 'failed';     // Validation/import failed

// =============================================================================
// Cartridge Manifest (manifest.json inside .RADz)
// =============================================================================

export interface CartridgeManifest {
  // Identity
  version: string;                    // Semantic version of cartridge
  radiantVersion: string;             // Minimum RADIANT version required
  cartridgeId: string;                // Unique identifier
  name: string;                       // Human-readable name
  description?: string;               // Optional description
  
  // Timestamps
  created: string;                    // ISO timestamp
  createdBy: string;                  // User/system that created it
  modified?: string;                  // Last modification timestamp
  
  // Contents
  domains: string[];                  // Domain IDs included
  hasLoraAdapters: boolean;
  hasCuratorKnowledge: boolean;
  hasGhostCompression: boolean;
  hasDomainExperts: boolean;
  
  // Network versions
  cortexVersions: {
    pattern?: string;
    routing?: string;
    topology?: string;
    clarion?: string;
    combination?: string;
    user?: string;
  };
  
  // Compatibility
  targetModels: string[];             // LLMs this cartridge is optimized for
  requiredCapabilities: string[];     // e.g., "vision", "code", "reasoning"
  
  // Security
  signature?: string;                 // Cryptographic signature
  signedBy?: string;                  // Signing authority
  encryptionKeyId?: string;           // If encrypted
  checksums: {                        // SHA-256 checksums for each component
    cortex?: Record<string, string>;
    domain?: Record<string, Record<string, string>>;
    lora?: Record<string, string>;
    curator?: Record<string, string>;
    ghost?: string;
  };
  
  // Scope
  scope: CartridgeScope;
  tenantId?: string;
  userId?: string;
  
  // Behavior flags
  allowUserOverride: boolean;         // Can user cartridges modify this?
  overridableFields: string[];        // e.g., ["pricing", "verbosity"]
  
  // Metadata
  tags?: string[];
  metadata?: Record<string, unknown>;
  
  // v6.1.0: Domain Expert Cartridge fields
  category?: CartridgeCategory;
  domainId?: string;                  // For domain_expert category
  thermalState?: CartridgeThermalState;
  
  // v6.2.0: Vault requirements (Keyhole Pattern)
  vaultRequirements?: {
    version: '1.0';
    cartridgeId: string;
    requires: Array<{
      key: string;
      description: string;
      category: 'api_key' | 'database' | 'oauth' | 'encryption' | 'webhook' | 'custom';
      required: boolean;
    }>;
    optional?: Array<{
      key: string;
      description: string;
      category: 'api_key' | 'database' | 'oauth' | 'encryption' | 'webhook' | 'custom';
      required: boolean;
    }>;
    notes?: string;
  };
  
  // v6.2.0: RNIR source path (if included)
  rnirPath?: string;
}

// =============================================================================
// Cartridge Contents Structure
// =============================================================================

export interface CartridgeContents {
  manifest: CartridgeManifest;
  
  // CORTEX networks (ONNX format)
  cortex?: {
    patternNetwork?: Uint8Array;
    routingNetwork?: Uint8Array;
    topologyNetwork?: Uint8Array;
    clarionNetwork?: Uint8Array;
    combinationNetwork?: Uint8Array;
    userNetwork?: Uint8Array;
  };
  
  // Domain Expert networks
  domainExperts?: Record<string, {
    entityClassifier?: Uint8Array;
    contraindicationNet?: Uint8Array;
    protocolMatcher?: Uint8Array;
    severityAssessor?: Uint8Array;
    personalizationNet?: Uint8Array;
    citationNetwork?: Uint8Array;
    orchestrationSelector?: Uint8Array;
  }>;
  
  // LoRA adapters (safetensors format)
  lora?: {
    adapters: Record<string, Uint8Array>;
  };
  
  // Curator knowledge
  curator?: {
    goldenRules?: CuratorGoldenRules;
    ontology?: CuratorOntology;
    safetyMatrix?: CuratorSafetyMatrix;
  };
  
  // Ghost vector compression
  ghost?: {
    compressionModel?: Uint8Array;
  };
}

// =============================================================================
// Curator Knowledge Types (embedded in cartridge)
// =============================================================================

export interface CuratorGoldenRules {
  version: string;
  rules: Array<{
    id: string;
    priority: number;          // 1-100, higher = more important
    condition: string;         // Condition expression
    action: 'block' | 'warn' | 'allow' | 'modify';
    message?: string;          // User-facing message
    metadata?: Record<string, unknown>;
  }>;
}

export interface CuratorOntology {
  version: string;
  entities: Array<{
    id: string;
    name: string;
    type: string;
    aliases?: string[];
    parentId?: string;
    metadata?: Record<string, unknown>;
  }>;
  relationships: Array<{
    sourceId: string;
    targetId: string;
    type: string;
    weight?: number;
  }>;
}

export interface CuratorSafetyMatrix {
  version: string;
  entries: Array<{
    entityId: string;
    actionId: string;
    safetyLevel: 'safe' | 'caution' | 'contraindicated';
    explanation: string;
    sourceReference?: string;
    verifiedBy?: string;
    verifiedAt?: string;
  }>;
}

// =============================================================================
// Cartridge Database Entity
// =============================================================================

export interface Cartridge {
  id: string;
  tenantId: string;
  userId?: string;              // Only for user-scope cartridges
  
  // Identity
  name: string;
  description?: string;
  version: string;
  scope: CartridgeScope;
  status: CartridgeStatus;
  
  // Storage
  storageKey: string;           // S3 key for .RADz file
  storageBucket: string;
  fileSizeBytes: number;
  checksum: string;             // SHA-256 of entire .RADz
  
  // Contents summary (from manifest)
  domains: string[];
  hasLoraAdapters: boolean;
  hasCuratorKnowledge: boolean;
  hasGhostCompression: boolean;
  hasDomainExperts: boolean;
  
  // Behavior
  allowUserOverride: boolean;
  overridableFields: string[];
  
  // Activation
  isEnabled: boolean;           // For user cartridges, can be toggled
  activatedAt?: Date;
  activatedBy?: string;
  
  // Metadata
  tags?: string[];
  metadata?: Record<string, unknown>;
  
  // Audit
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  archivedAt?: Date;
  archivedBy?: string;
}

// =============================================================================
// Cartridge Stack (Resolution Order)
// =============================================================================

export interface CartridgeStackEntry {
  cartridge: Cartridge;
  position: number;             // Order in stack (lower = applied first)
  isEnabled: boolean;
  canDisable: boolean;          // User cartridges: true, Tenant: false
  canOverride: boolean;         // Based on allowUserOverride flag
}

export interface CartridgeStack {
  tenantId: string;
  userId?: string;
  
  // System cartridges (Platform-wide, CANNOT be disabled or modified by tenants)
  systemStack: CartridgeStackEntry[];
  
  // Tenant cartridges (CANNOT be disabled by users)
  tenantStack: CartridgeStackEntry[];
  
  // User cartridges (CAN be disabled)
  userStack: CartridgeStackEntry[];
  
  // Resolved effective cartridge (merged: system → tenant → user)
  effectiveCartridge?: {
    domains: string[];
    cortexVersions: Record<string, string>;
    loraAdapters: string[];
    goldenRulesCount: number;
    safetyMatrixEntriesCount: number;
  };
}

// =============================================================================
// API Request/Response Types
// =============================================================================

export interface CreateCartridgeRequest {
  name: string;
  description?: string;
  scope: CartridgeScope;
  domains: string[];
  includeLoraAdapters?: boolean;
  includeCuratorKnowledge?: boolean;
  includeGhostCompression?: boolean;
  includeDomainExperts?: boolean;
  allowUserOverride?: boolean;
  overridableFields?: string[];
  tags?: string[];
}

export interface ExportCartridgeRequest {
  scope: CartridgeScope;
  tenantId: string;
  userId?: string;              // Required if scope='user'
  domains: string[];
  includeLora: boolean;
  includeCurator: boolean;
  includeGhost: boolean;
  includeDomainExperts: boolean;
  encryptionKey?: string;       // Optional encryption
}

export interface ExportCartridgeResponse {
  cartridgeId: string;
  downloadUrl: string;
  expiresAt: string;
  estimatedSizeBytes: number;
  // PKI v8.0: Signature data (optional if signing fails)
  signatureBlock?: import('./cartridge-pki.types').CartridgeSignatureBlock;
  metadata?: import('./cartridge-pki.types').CartridgeMetadata;
}

export interface ImportCartridgeRequest {
  scope: CartridgeScope;
  tenantId: string;
  userId?: string;
  fileKey: string;              // S3 key of uploaded .RADz file
  validateSignature: boolean;
  mergeStrategy: 'replace' | 'merge';
  activateImmediately?: boolean;
}

export interface ImportCartridgeResponse {
  cartridgeId: string;
  status: CartridgeStatus;
  validationErrors?: string[];
  manifest?: CartridgeManifest;
  // PKI v8.0: Signature verification result
  signatureVerification?: import('./cartridge-pki.types').CartridgeVerificationResult;
}

export interface CartridgeListRequest {
  scope?: CartridgeScope;
  tenantId: string;
  userId?: string;
  status?: CartridgeStatus;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

export interface CartridgeListResponse {
  cartridges: Cartridge[];
  total: number;
  limit: number;
  offset: number;
}

export interface UpdateCartridgeRequest {
  name?: string;
  description?: string;
  status?: CartridgeStatus;     // For activation/deactivation
  isEnabled?: boolean;          // Only for user-scope cartridges
  allowUserOverride?: boolean;
  overridableFields?: string[];
  tags?: string[];
}

export interface CartridgeStackRequest {
  tenantId: string;
  userId?: string;
}

export interface ReorderCartridgeStackRequest {
  cartridgeIds: string[];       // Ordered list of cartridge IDs
}

// =============================================================================
// Cartridge Validation
// =============================================================================

export interface CartridgeValidationResult {
  isValid: boolean;
  errors: CartridgeValidationError[];
  warnings: CartridgeValidationWarning[];
  manifest?: CartridgeManifest;
}

export interface CartridgeValidationError {
  code: string;
  message: string;
  field?: string;
  details?: Record<string, unknown>;
}

export interface CartridgeValidationWarning {
  code: string;
  message: string;
  field?: string;
}

// =============================================================================
// Constants
// =============================================================================

export const CARTRIDGE_FILE_EXTENSION = '.radz';
export const CARTRIDGE_MIME_TYPE = 'application/x-radiant-cartridge';
export const CARTRIDGE_MAX_SIZE_BYTES = 500 * 1024 * 1024; // 500MB
export const CARTRIDGE_MANIFEST_FILENAME = 'manifest.json';

export const CARTRIDGE_DIRECTORIES = {
  cortex: 'cortex/',
  domain: 'domain/',
  lora: 'lora/',
  curator: 'curator/',
  ghost: 'ghost/',
} as const;

export const CORTEX_NETWORK_FILES = {
  pattern: 'pattern_network.onnx',
  routing: 'routing_network.onnx',
  topology: 'topology_network.onnx',
  clarion: 'clarion_network.onnx',
  combination: 'combination_network.onnx',
  user: 'user_network.onnx',
} as const;

export const DOMAIN_EXPERT_FILES = {
  entityClassifier: 'entity_classifier.onnx',
  contraindicationNet: 'contraindication_net.onnx',
  protocolMatcher: 'protocol_matcher.onnx',
  severityAssessor: 'severity_assessor.onnx',
  personalizationNet: 'personalization_net.onnx',
  citationNetwork: 'citation_network.onnx',
  orchestrationSelector: 'orchestration_selector.onnx',
} as const;

export const CURATOR_FILES = {
  goldenRules: 'golden_rules.json',
  ontology: 'ontology.json',
  safetyMatrix: 'safety_matrix.json',
} as const;

export const CARTRIDGE_VALIDATION_CODES = {
  // Errors
  INVALID_MANIFEST: 'INVALID_MANIFEST',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INCOMPATIBLE_VERSION: 'INCOMPATIBLE_VERSION',
  SIGNATURE_INVALID: 'SIGNATURE_INVALID',
  CHECKSUM_MISMATCH: 'CHECKSUM_MISMATCH',
  CORRUPTED_FILE: 'CORRUPTED_FILE',
  NETWORK_LOAD_FAILED: 'NETWORK_LOAD_FAILED',
  
  // Warnings
  DEPRECATED_FORMAT: 'DEPRECATED_FORMAT',
  MISSING_OPTIONAL: 'MISSING_OPTIONAL',
  VERSION_MISMATCH: 'VERSION_MISMATCH',
} as const;

// =============================================================================
// System Cartridge Registry (v6.1.0)
// =============================================================================

/**
 * Audit action types for system cartridge operations
 */
export type SystemCartridgeAuditAction = 
  | 'created'
  | 'updated'
  | 'deleted'
  | 'enabled'
  | 'disabled'
  | 'thermal_state_changed'
  | 'version_upgraded';

/**
 * Audit log entry for system cartridge operations
 * Required for HIPAA, SOC2, GDPR compliance
 */
export interface SystemCartridgeAuditEntry {
  id: string;
  cartridgeId: string;
  action: SystemCartridgeAuditAction;
  performedBy: string;                // User ID of admin
  performedByEmail?: string;          // Email for audit trail
  performedAt: Date;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  reason?: string;                    // Optional reason for change
  ipAddress?: string;                 // For security audit
  userAgent?: string;                 // For security audit
  complianceFlags?: string[];         // e.g., ['HIPAA', 'SOC2']
}

/**
 * Tenant visibility preference for a system cartridge
 * Default: enabled (visible to all users in tenant)
 * When disabled: completely hidden from tenant users
 */
export interface TenantCartridgeVisibility {
  tenantId: string;
  cartridgeId: string;
  isVisible: boolean;                 // Default: true
  disabledAt?: Date;
  disabledBy?: string;                // Tenant admin who disabled
  disabledReason?: string;
  enabledAt?: Date;
  enabledBy?: string;
}

/**
 * System cartridge registry entry
 * Extends base Cartridge with system-specific fields
 */
export interface SystemCartridgeEntry extends Cartridge {
  // Registry fields
  registeredAt: Date;
  registeredBy: string;               // Super admin who registered
  registeredVia: 'radz_import' | 'curator';
  
  // Domain expert fields (for category='domain_expert')
  category: CartridgeCategory;
  domainId?: string;
  domainDisplayName?: string;
  
  // Thermal state management
  thermalState: CartridgeThermalState;
  thermalStateChangedAt?: Date;
  lastInferenceAt?: Date;
  inferenceCount: number;
  
  // Version management
  previousVersionId?: string;
  versionHistory: string[];           // Array of previous cartridge IDs
  
  // Compliance
  complianceReviewedAt?: Date;
  complianceReviewedBy?: string;
  complianceNotes?: string;
}

/**
 * Request to register a system cartridge (admin only)
 */
export interface RegisterSystemCartridgeRequest {
  // For RADz import
  fileKey?: string;                   // S3 key of uploaded .RADz file
  
  // For Curator creation
  name?: string;
  description?: string;
  domainId?: string;                  // Required for domain_expert category
  category: CartridgeCategory;
  
  // Registration context
  registeredVia: 'radz_import' | 'curator';
  reason?: string;                    // Audit trail reason
}

/**
 * Request to update tenant visibility for a system cartridge
 */
export interface UpdateTenantVisibilityRequest {
  cartridgeId: string;
  isVisible: boolean;
  reason?: string;
}

/**
 * System cartridge dashboard summary
 */
export interface SystemCartridgeDashboard {
  summary: {
    totalSystemCartridges: number;
    totalDomainExperts: number;
    totalGeneralCartridges: number;
    thermalStates: {
      cold: number;
      warming: number;
      warm: number;
      hot: number;
    };
    recentAuditActions: number;       // Last 24 hours
  };
  cartridges: SystemCartridgeEntry[];
  recentAudit: SystemCartridgeAuditEntry[];
  tenantsWithHiddenCartridges: number;
}

/**
 * List system cartridges request
 */
export interface ListSystemCartridgesRequest {
  category?: CartridgeCategory;
  thermalState?: CartridgeThermalState;
  domainId?: string;
  includeAuditHistory?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * List system cartridges response
 */
export interface ListSystemCartridgesResponse {
  cartridges: SystemCartridgeEntry[];
  total: number;
  limit: number;
  offset: number;
}
