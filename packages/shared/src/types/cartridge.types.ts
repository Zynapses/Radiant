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

// =============================================================================
// Universal Cartridge System (PROMPT-50)
// =============================================================================

/**
 * Cartridge type classification for the Universal Cartridge System.
 * Extends legacy CartridgeScope with fine-grained types.
 */
export type UniversalCartridgeType =
  | 'base'         // Foundation cartridge (platform-wide)
  | 'domain'       // Domain-specific intelligence
  | 'tenant'       // Tenant-specific overrides
  | 'community'    // Community-contributed
  | 'personality'  // CATO personality pack
  | 'knowledge'    // Knowledge-only cartridge
  | 'soft_rom'     // Brain learning delta export
  | 'firmware';    // Safety floor (super_admin only)

/**
 * Universal cartridge status lifecycle
 */
export type UniversalCartridgeStatus =
  | 'uploaded'     // File uploaded, not yet validated
  | 'validating'   // Validation in progress
  | 'validated'    // Passed validation, ready for install
  | 'failed'       // Validation or install failed
  | 'installed'    // At least one active installation
  | 'active'       // Currently active in a tenant stack
  | 'archived';    // Soft-deleted

/**
 * Target service registry entry.
 * Defines which services a cartridge can target.
 */
export interface CartridgeTargetService {
  id: string;
  service_key: string;
  display_name: string;
  description?: string;
  required_sections: string[];
  optional_sections: string[];
  validation_rules: Record<string, unknown>;
  is_active: boolean;
  min_radiant_version?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Section spec for a target service.
 * Defines what files are expected in each section.
 */
export interface CartridgeTargetSectionSpec {
  id: string;
  target_service_id: string;
  section_key: string;
  display_name: string;
  description?: string;
  file_specs: CartridgeSectionFileSpec[];
  json_schemas?: Record<string, unknown>;
  is_required_for_target: boolean;
  created_at: string;
}

export interface CartridgeSectionFileSpec {
  filename: string;
  description: string;
  format: string;
  required: boolean;
  max_size_mb?: number;
  dtype?: string;
  schema_ref?: string;
  input_dim?: number;
  output_dim?: number;
}

/**
 * Universal cartridge record (cartridge_universal table).
 */
export interface UniversalCartridge {
  id: string;
  tenant_id: string | null;
  cartridge_type: UniversalCartridgeType;
  name: string;
  display_name: string;
  version: string;
  description?: string;
  author_name?: string;
  author_email?: string;
  author_org_id?: string;
  targets: string[];
  sections_present: string[];
  manifest: Record<string, unknown>;
  storage_ref: string;
  storage_bucket: string;
  total_size_bytes: number;
  checksum_sha256: string;
  signing_key_id?: string;
  signature_valid: boolean;
  compatibility?: Record<string, unknown>;
  tier_requirements?: Record<string, unknown>;
  marketplace_listing_id?: string;
  is_published: boolean;
  status: UniversalCartridgeStatus;
  validation_results?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Installation merge strategy
 */
export type CartridgeMergeStrategy = 'replace' | 'merge' | 'additive';

/**
 * Cartridge installation record (cartridge_installations table).
 */
export interface CartridgeInstallation {
  id: string;
  tenant_id: string;
  cartridge_id: string;
  stack_priority: number;
  installation_status: 'installing' | 'active' | 'updating' | 'uninstalling' | 'failed' | 'disabled';
  installed_by?: string;
  merge_strategy: CartridgeMergeStrategy;
  configuration_overrides?: Record<string, unknown>;
  installed_at: string;
  last_health_check?: string;
  health_status?: string;
  updated_at: string;
  // Joined from cartridge_universal
  name?: string;
  display_name?: string;
  version?: string;
  cartridge_type?: UniversalCartridgeType;
  targets?: string[];
  sections_present?: string[];
  cartridge_status?: UniversalCartridgeStatus;
}

/**
 * Resolved cartridge state (cartridge_resolved_state table).
 */
export interface CartridgeResolvedState {
  id: string;
  tenant_id: string;
  resolved_firmware: Record<string, unknown>;
  resolved_sections: Record<string, {
    cartridge_id: string;
    cartridge_name: string;
    cartridge_type: string;
    priority: number;
  }>;
  resolution_log: string[];
  resolved_at: string;
}

/**
 * Cartridge audit log entry.
 */
export interface CartridgeAuditEntry {
  id: string;
  tenant_id?: string;
  cartridge_id?: string;
  action: string;
  actor_id?: string;
  details?: Record<string, unknown>;
  created_at: string;
  cartridge_name?: string;
  cartridge_version?: string;
}

/**
 * Upload response from the cartridge-system/upload endpoint.
 */
export interface CartridgeUploadResponse {
  cartridge_id: string;
  upload_url: string;
  storage_ref: string;
  expires_at: string;
}

/**
 * Request body for uploading a new universal cartridge.
 */
export interface UploadUniversalCartridgeRequest {
  name: string;
  display_name: string;
  version: string;
  cartridge_type: UniversalCartridgeType;
  targets: string[];
  description?: string;
}

/**
 * Request body for installing a cartridge.
 */
export interface InstallCartridgeRequest {
  stack_priority?: number;
  merge_strategy?: CartridgeMergeStrategy;
  configuration_overrides?: Record<string, unknown>;
}

/**
 * Request body for reordering the cartridge stack.
 */
export interface ReorderStackRequest {
  installations: Array<{
    installation_id: string;
    stack_priority: number;
  }>;
}

// ============================================================================
// OMEGA CARTRIDGE INTEGRATION TYPES (PROMPT-52)
// ============================================================================

/**
 * OMEGA brain boot status after cartridge loading.
 */
export type OmegaCartridgeBootStatus = 'not_booted' | 'active' | 'factory_defaults' | 'degraded';

/**
 * Chemical configuration for OMEGA Ambition system.
 */
export interface OmegaChemicalConfig {
  initial: number;
  min: number;
  max: number;
  decay_rate?: number;
  growth_rate?: number;
  q_reward_threshold?: number;
  reward_on_high_q?: number;
  q_frustration_threshold?: number;
  growth_on_low_q?: number;
  reduction_on_success?: number;
  novelty_sensitivity?: number;
  exploration_bias?: number;
  self_analysis_trigger?: number;
  rfm_accuracy_sensitivity?: number;
  rfm_recalibration_trigger?: number;
}

/**
 * Ambition configuration loaded from cartridge ambition_config.json.
 */
export interface OmegaAmbitionConfig {
  chemicals: {
    dopamine: OmegaChemicalConfig;
    entropy: OmegaChemicalConfig;
    curiosity: OmegaChemicalConfig;
    frustration: OmegaChemicalConfig;
    satisfaction: OmegaChemicalConfig;
  };
  self_optimization: {
    enabled: boolean;
    allowed_adjustments: string[];
    forbidden_adjustments: string[];
    max_scaling_request_percent: number;
  };
  internet_research?: {
    enabled: boolean;
    max_queries_per_cycle: number;
    entropy_trigger: number;
    allowed_domains?: string[];
    forbidden_topics?: string[];
  };
}

/**
 * Firmware configuration loaded from cartridge.
 * Veto thresholds use min() rule — most restrictive wins.
 */
export interface OmegaFirmwareConfig {
  veto_thresholds: {
    categories: Record<string, {
      min_threshold: number;
      description?: string;
    }>;
  };
  parameter_bounds?: Record<string, { min: number; max: number }>;
  development_schedule?: OmegaDevelopmentScheduleConfig;
  action_gate_config?: OmegaActionGateConfig;
}

/**
 * Development schedule phases from cartridge.
 */
export interface OmegaDevelopmentScheduleConfig {
  phases: Array<{
    name: string;
    start_cycle: number;
    end_cycle: number;
    plasticity: number;
    learning_rate: number;
    exploration_bias: number;
  }>;
  current_phase_override?: string;
}

/**
 * Action gate configuration from cartridge.
 */
export interface OmegaActionGateConfig {
  gates: Record<string, {
    enabled: boolean;
    min_confidence: number;
    requires_approval: boolean;
    max_per_hour?: number;
  }>;
}

/**
 * Soft ROM delta — brain's accumulated learning on top of cartridge base.
 */
export interface OmegaSoftRomDelta {
  version: string;
  tenant_id: string;
  total_deltas: number;
  new_connections: number;
  created_at: string;
}

/**
 * Soft ROM preferences — brain's self-optimization state.
 */
export interface OmegaSoftRomPreferences {
  requested_scaling: Record<string, number>;
  theta_override: number | null;
  plasticity_override: number | null;
  research_topics_pending: string[];
  optimization_history: Array<{
    adjustment: string;
    old_value: number;
    new_value: number;
    timestamp: string;
  }>;
  updated_at: string;
}

/**
 * Cartridge health check result.
 */
export interface OmegaCartridgeHealthCheck {
  healthy: boolean;
  resolved_state_exists: boolean;
  firmware_loaded: boolean;
  qnode_weights_loaded: boolean;
  soft_rom_loaded: boolean;
  knowledge_loaded: boolean;
  issues: string[];
  checked_at: string;
}

/**
 * Knowledge fact loaded from cartridge.
 */
export interface OmegaKnowledgeFact {
  id: string;
  text: string;
  source: string;
  priority: number;
  category: string;
}

/**
 * OMEGA brain state summary (admin API response).
 */
export interface OmegaBrainStateSummary {
  brain_id: string;
  tenant_id: string;
  hilbert_dimension: number;
  norm: number;
  entropy: number;
  dopamine: number;
  total_cycles: number;
  loaded_firmware_id: string | null;
  helix_rule_count: number;
  unitarity_mode: string;
  cartridge_boot_status: OmegaCartridgeBootStatus;
  cartridge_boot_duration_ms: number;
  firmware_enforcement_count: number;
  soft_rom_version: string | null;
  knowledge_fact_count: number;
  ambition_chemicals: Record<string, number> | null;
}

/**
 * EventBridge event for cartridge changes relevant to OMEGA.
 */
export interface OmegaCartridgeEvent {
  source: string;
  detail_type: string;
  detail: {
    tenant_id: string;
    cartridge_id?: string;
    cartridge_name?: string;
    target_service?: string;
    action?: string;
    timestamp?: string;
  };
}

// ============================================================================
// GLOBAL BRAIN TYPES (PROMPT-53)
// ============================================================================

export type GlobalBrainEnrollmentTier = 'none' | 'standard' | 'premium' | 'research';
export type GlobalBrainGradientType = 'omega_qnode' | 'cortex_performance' | 'cato_fitness';
export type GlobalBrainGradientStatus = 'uploaded' | 'validated' | 'aggregating' | 'aggregated' | 'expired';
export type GlobalBrainRoundType = 'omega_qnode' | 'cortex_networks' | 'full';
export type GlobalBrainRoundStatus = 'collecting' | 'aggregating' | 'completed' | 'failed' | 'cancelled';
export type GlobalBrainPipelineType = 'base' | 'domain_refresh' | 'emergency_patch';
export type GlobalBrainPipelineStatus =
  | 'scheduled' | 'collecting_rounds' | 'averaging' | 'building_cartridge'
  | 'validating' | 'publishing' | 'completed' | 'failed';

export interface GlobalBrainPrivacyConfig {
  dp_epsilon: number;
  dp_delta: number;
  dp_clip_norm: number;
  noise_multiplier: number;
  min_participation_rounds: number;
  gradient_retention_days: number;
}

export interface GlobalBrainDataConsent {
  allow_omega_gradients: boolean;
  allow_cortex_metrics: boolean;
  allow_cato_metadata: boolean;
  allow_cross_domain: boolean;
  phi_exclusion: boolean;
}

export interface GlobalBrainEnrollment {
  id: string;
  tenant_id: string;
  enrolled: boolean;
  enrollment_tier: GlobalBrainEnrollmentTier;
  privacy_config: GlobalBrainPrivacyConfig;
  data_consent: GlobalBrainDataConsent;
  enrolled_at: string | null;
  last_contribution: string | null;
  total_contributions: number;
  contribution_quality_score: number;
  created_at: string;
  updated_at: string;
}

export interface GlobalBrainGradient {
  id: string;
  tenant_id: string;
  gradient_type: GlobalBrainGradientType;
  dream_cycle_id: string | null;
  round_id: string | null;
  storage_ref: string;
  size_bytes: number;
  dp_noise_applied: boolean;
  dp_epsilon_used: number | null;
  dp_delta_used: number | null;
  clip_norm_used: number | null;
  quality_score: number | null;
  metadata: Record<string, unknown> | null;
  status: GlobalBrainGradientStatus;
  uploaded_at: string;
  expires_at: string;
}

export interface GlobalBrainRound {
  id: string;
  round_number: number;
  round_type: GlobalBrainRoundType;
  status: GlobalBrainRoundStatus;
  target_participants: number;
  actual_participants: number;
  aggregation_config: Record<string, unknown>;
  result_storage_ref: string | null;
  result_checksum: string | null;
  quality_metrics: Record<string, unknown> | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface GlobalBrainCartridgePipeline {
  id: string;
  pipeline_type: GlobalBrainPipelineType;
  status: GlobalBrainPipelineStatus;
  input_rounds: string[];
  output_cartridge_id: string | null;
  target_version: string | null;
  config: Record<string, unknown>;
  progress: Record<string, unknown> | null;
  scheduled_for: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface GlobalBrainStats {
  enrollment: {
    enrolled_count: number;
    total_count: number;
    avg_quality: number | null;
    total_contributions: number;
  };
  gradients: {
    total_gradients: number;
    pending: number;
    aggregated: number;
    total_bytes: number;
    unique_contributors: number;
  };
  rounds: {
    total_rounds: number;
    completed: number;
    active: number;
    avg_participants: number | null;
  };
  pipelines: {
    total_pipelines: number;
    completed: number;
    scheduled: number;
  };
}
