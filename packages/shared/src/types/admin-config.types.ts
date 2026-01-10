/**
 * RADIANT v6.0.4 - Admin-Configurable Parameters Types
 * All values editable via Admin Dashboard
 * 
 * This file defines the structure for admin-configurable parameters
 * that control the AGI Brain system behavior.
 */

// =============================================================================
// Parameter Types
// =============================================================================

/**
 * Parameter value types
 */
export type ParameterType = 'number' | 'string' | 'boolean' | 'select' | 'json';

/**
 * Parameter constraints
 */
export interface ParameterConstraints {
  min?: number;
  max?: number;
  step?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  options?: Array<{ label: string; value: unknown }>;
}

/**
 * Admin parameter definition
 */
export interface AdminParameter {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  key: string;
  type: ParameterType;
  value: unknown;
  defaultValue: unknown;
  constraints?: ParameterConstraints;
  requiresRestart: boolean;
  dangerous: boolean;
  lastModifiedBy: string | null;
  lastModifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Parameter category
 */
export interface ParameterCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  displayOrder: number;
  parameters: AdminParameter[];
}

/**
 * Admin parameter database record
 */
export interface AdminParameterRecord {
  id: string;
  key: string;
  value: string;                 // JSON-encoded
  category: string;
  description: string | null;
  constraints_json: string | null;
  dangerous: boolean;
  requires_restart: boolean;
  default_value: string;         // JSON-encoded
  last_modified_by: string | null;
  last_modified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// =============================================================================
// Parameter Categories
// =============================================================================

/**
 * All parameter category IDs
 */
export type ParameterCategoryId = 
  | 'ghost'
  | 'dreaming'
  | 'context'
  | 'flash'
  | 'privacy'
  | 'sofai'
  | 'personalization'
  | 'audit';

/**
 * Parameter category definitions
 */
export const PARAMETER_CATEGORIES: Record<ParameterCategoryId, { name: string; description: string; icon: string }> = {
  ghost: {
    name: 'Ghost Vectors',
    description: 'Consciousness continuity and re-anchoring settings',
    icon: 'brain',
  },
  dreaming: {
    name: 'Dreaming',
    description: 'Memory consolidation and twilight dreaming settings',
    icon: 'moon',
  },
  context: {
    name: 'Context Budget',
    description: 'Token allocation and context window settings',
    icon: 'calculator',
  },
  flash: {
    name: 'Flash Buffer',
    description: 'Flash fact storage and retrieval settings',
    icon: 'zap',
  },
  privacy: {
    name: 'Privacy & Oversight',
    description: 'Differential privacy and human oversight settings',
    icon: 'shield',
  },
  sofai: {
    name: 'SOFAI Routing',
    description: 'System 1/2 routing and domain risk settings',
    icon: 'git-branch',
  },
  personalization: {
    name: 'Personalization',
    description: 'Three-tier learning weight settings',
    icon: 'user',
  },
  audit: {
    name: 'Audit',
    description: 'Audit log retention and archival settings',
    icon: 'file-text',
  },
};

// =============================================================================
// Parameter Keys
// =============================================================================

/**
 * All configuration parameter keys
 */
export const PARAMETER_KEYS = {
  // Ghost Vector Parameters
  GHOST_CURRENT_VERSION: 'GHOST_CURRENT_VERSION',
  GHOST_REANCHOR_INTERVAL: 'GHOST_REANCHOR_INTERVAL',
  GHOST_JITTER_RANGE: 'GHOST_JITTER_RANGE',
  GHOST_ENTROPY_THRESHOLD: 'GHOST_ENTROPY_THRESHOLD',
  GHOST_MIGRATION_ENABLED: 'GHOST_MIGRATION_ENABLED',
  GHOST_SEMANTIC_PRESERVATION_ENABLED: 'GHOST_SEMANTIC_PRESERVATION_ENABLED',
  
  // Dreaming Parameters
  DREAM_TWILIGHT_HOUR: 'DREAM_TWILIGHT_HOUR',
  DREAM_STARVATION_HOURS: 'DREAM_STARVATION_HOURS',
  DREAM_MAX_CONCURRENT: 'DREAM_MAX_CONCURRENT',
  DREAM_STAGGER_MINUTES: 'DREAM_STAGGER_MINUTES',
  DREAM_LOW_TRAFFIC_THRESHOLD: 'DREAM_LOW_TRAFFIC_THRESHOLD',
  
  // Context Budget Parameters
  CONTEXT_RESPONSE_RESERVE: 'CONTEXT_RESPONSE_RESERVE',
  CONTEXT_MODEL_LIMIT: 'CONTEXT_MODEL_LIMIT',
  CONTEXT_MAX_USER_MESSAGE: 'CONTEXT_MAX_USER_MESSAGE',
  CONTEXT_SYSTEM_CORE_BUDGET: 'CONTEXT_SYSTEM_CORE_BUDGET',
  CONTEXT_COMPLIANCE_BUDGET: 'CONTEXT_COMPLIANCE_BUDGET',
  CONTEXT_FLASH_FACTS_BUDGET: 'CONTEXT_FLASH_FACTS_BUDGET',
  CONTEXT_GHOST_TOKENS: 'CONTEXT_GHOST_TOKENS',
  
  // Flash Buffer Parameters
  FLASH_REDIS_TTL_HOURS: 'FLASH_REDIS_TTL_HOURS',
  FLASH_MAX_FACTS_PER_USER: 'FLASH_MAX_FACTS_PER_USER',
  FLASH_RECONCILIATION_INTERVAL: 'FLASH_RECONCILIATION_INTERVAL',
  
  // Privacy Parameters
  PRIVACY_DP_EPSILON: 'PRIVACY_DP_EPSILON',
  PRIVACY_MIN_TENANTS: 'PRIVACY_MIN_TENANTS',
  PRIVACY_MIN_TENANTS_HIGHRISK: 'PRIVACY_MIN_TENANTS_HIGHRISK',
  OVERSIGHT_TIMEOUT_DAYS: 'OVERSIGHT_TIMEOUT_DAYS',
  OVERSIGHT_ESCALATION_DAYS: 'OVERSIGHT_ESCALATION_DAYS',
  
  // SOFAI Parameters
  SOFAI_SYSTEM2_THRESHOLD: 'SOFAI_SYSTEM2_THRESHOLD',
  SOFAI_HEALTHCARE_RISK: 'SOFAI_HEALTHCARE_RISK',
  SOFAI_FINANCIAL_RISK: 'SOFAI_FINANCIAL_RISK',
  SOFAI_LEGAL_RISK: 'SOFAI_LEGAL_RISK',
  SOFAI_ENABLE_SYSTEM1_5: 'SOFAI_ENABLE_SYSTEM1_5',
  
  // Personalization Parameters
  PERSONALIZATION_WARMUP_THRESHOLD: 'PERSONALIZATION_WARMUP_THRESHOLD',
  PERSONALIZATION_VELOCITY_THRESHOLD: 'PERSONALIZATION_VELOCITY_THRESHOLD',
  PERSONALIZATION_TENANT_WEIGHT: 'PERSONALIZATION_TENANT_WEIGHT',
  PERSONALIZATION_SYSTEM_WEIGHT: 'PERSONALIZATION_SYSTEM_WEIGHT',
  
  // Audit Parameters
  AUDIT_HOT_DAYS: 'AUDIT_HOT_DAYS',
  AUDIT_WARM_DAYS: 'AUDIT_WARM_DAYS',
  AUDIT_ARCHIVE_YEARS: 'AUDIT_ARCHIVE_YEARS',
} as const;

export type ParameterKey = typeof PARAMETER_KEYS[keyof typeof PARAMETER_KEYS];

// =============================================================================
// Default Parameter Values
// =============================================================================

/**
 * Default values for all parameters
 */
export const DEFAULT_PARAMETER_VALUES: Record<ParameterKey, unknown> = {
  // Ghost
  GHOST_CURRENT_VERSION: 'llama3-70b-v1',
  GHOST_REANCHOR_INTERVAL: 15,
  GHOST_JITTER_RANGE: 3,
  GHOST_ENTROPY_THRESHOLD: 0.3,
  GHOST_MIGRATION_ENABLED: true,
  GHOST_SEMANTIC_PRESERVATION_ENABLED: true,
  
  // Dreaming
  DREAM_TWILIGHT_HOUR: 4,
  DREAM_STARVATION_HOURS: 30,
  DREAM_MAX_CONCURRENT: 100,
  DREAM_STAGGER_MINUTES: 5,
  DREAM_LOW_TRAFFIC_THRESHOLD: 20,
  
  // Context
  CONTEXT_RESPONSE_RESERVE: 1000,
  CONTEXT_MODEL_LIMIT: 8192,
  CONTEXT_MAX_USER_MESSAGE: 4000,
  CONTEXT_SYSTEM_CORE_BUDGET: 500,
  CONTEXT_COMPLIANCE_BUDGET: 400,
  CONTEXT_FLASH_FACTS_BUDGET: 200,
  CONTEXT_GHOST_TOKENS: 64,
  
  // Flash
  FLASH_REDIS_TTL_HOURS: 168,
  FLASH_MAX_FACTS_PER_USER: 10,
  FLASH_RECONCILIATION_INTERVAL: 60,
  
  // Privacy
  PRIVACY_DP_EPSILON: 0.5,
  PRIVACY_MIN_TENANTS: 10,
  PRIVACY_MIN_TENANTS_HIGHRISK: 20,
  OVERSIGHT_TIMEOUT_DAYS: 7,
  OVERSIGHT_ESCALATION_DAYS: 3,
  
  // SOFAI
  SOFAI_SYSTEM2_THRESHOLD: 0.5,
  SOFAI_HEALTHCARE_RISK: 0.9,
  SOFAI_FINANCIAL_RISK: 0.85,
  SOFAI_LEGAL_RISK: 0.8,
  SOFAI_ENABLE_SYSTEM1_5: true,
  
  // Personalization
  PERSONALIZATION_WARMUP_THRESHOLD: 10,
  PERSONALIZATION_VELOCITY_THRESHOLD: 3,
  PERSONALIZATION_TENANT_WEIGHT: 0.3,
  PERSONALIZATION_SYSTEM_WEIGHT: 0.1,
  
  // Audit
  AUDIT_HOT_DAYS: 30,
  AUDIT_WARM_DAYS: 90,
  AUDIT_ARCHIVE_YEARS: 7,
};

// =============================================================================
// Parameter Definitions with Constraints
// =============================================================================

/**
 * Full parameter definitions with constraints
 */
export const PARAMETER_DEFINITIONS: Array<{
  key: ParameterKey;
  category: ParameterCategoryId;
  name: string;
  description: string;
  type: ParameterType;
  defaultValue: unknown;
  constraints?: ParameterConstraints;
  dangerous: boolean;
  requiresRestart: boolean;
}> = [
  // Ghost Parameters
  {
    key: 'GHOST_CURRENT_VERSION',
    category: 'ghost',
    name: 'Ghost Version',
    description: 'Model version for ghost vectors. Changing causes cold starts.',
    type: 'string',
    defaultValue: 'llama3-70b-v1',
    dangerous: true,
    requiresRestart: false,
  },
  {
    key: 'GHOST_REANCHOR_INTERVAL',
    category: 'ghost',
    name: 'Re-anchor Interval',
    description: 'Number of turns between ghost re-anchoring.',
    type: 'number',
    defaultValue: 15,
    constraints: { min: 5, max: 50, step: 1 },
    dangerous: false,
    requiresRestart: false,
  },
  {
    key: 'GHOST_JITTER_RANGE',
    category: 'ghost',
    name: 'Jitter Range',
    description: 'Random +/- turns to prevent thundering herd.',
    type: 'number',
    defaultValue: 3,
    constraints: { min: 0, max: 10, step: 1 },
    dangerous: false,
    requiresRestart: false,
  },
  {
    key: 'GHOST_ENTROPY_THRESHOLD',
    category: 'ghost',
    name: 'Entropy Threshold',
    description: 'Entropy level that triggers re-anchoring.',
    type: 'number',
    defaultValue: 0.3,
    constraints: { min: 0.1, max: 1.0, step: 0.1 },
    dangerous: false,
    requiresRestart: false,
  },
  {
    key: 'GHOST_MIGRATION_ENABLED',
    category: 'ghost',
    name: 'Migration Enabled',
    description: 'Allow ghost migration on version mismatch.',
    type: 'boolean',
    defaultValue: true,
    dangerous: false,
    requiresRestart: false,
  },
  
  // Dreaming Parameters
  {
    key: 'DREAM_TWILIGHT_HOUR',
    category: 'dreaming',
    name: 'Twilight Hour',
    description: 'Local hour for twilight dreaming (0-23).',
    type: 'number',
    defaultValue: 4,
    constraints: { min: 0, max: 23, step: 1 },
    dangerous: false,
    requiresRestart: false,
  },
  {
    key: 'DREAM_STARVATION_HOURS',
    category: 'dreaming',
    name: 'Starvation Hours',
    description: 'Maximum hours without dreaming before forced trigger.',
    type: 'number',
    defaultValue: 30,
    constraints: { min: 12, max: 72, step: 1 },
    dangerous: false,
    requiresRestart: false,
  },
  {
    key: 'DREAM_MAX_CONCURRENT',
    category: 'dreaming',
    name: 'Max Concurrent Dreams',
    description: 'Maximum parallel dream jobs.',
    type: 'number',
    defaultValue: 100,
    constraints: { min: 10, max: 500, step: 10 },
    dangerous: false,
    requiresRestart: false,
  },
  {
    key: 'DREAM_STAGGER_MINUTES',
    category: 'dreaming',
    name: 'Stagger Minutes',
    description: 'Delay between dream job starts.',
    type: 'number',
    defaultValue: 5,
    constraints: { min: 1, max: 30, step: 1 },
    dangerous: false,
    requiresRestart: false,
  },
  {
    key: 'DREAM_LOW_TRAFFIC_THRESHOLD',
    category: 'dreaming',
    name: 'Low Traffic Threshold',
    description: 'Traffic percentage below which dreaming triggers.',
    type: 'number',
    defaultValue: 20,
    constraints: { min: 5, max: 50, step: 5 },
    dangerous: false,
    requiresRestart: false,
  },
  
  // Context Budget Parameters
  {
    key: 'CONTEXT_RESPONSE_RESERVE',
    category: 'context',
    name: 'Response Reserve',
    description: 'Minimum tokens reserved for response. CRITICAL.',
    type: 'number',
    defaultValue: 1000,
    constraints: { min: 500, max: 2000, step: 100 },
    dangerous: false,
    requiresRestart: false,
  },
  {
    key: 'CONTEXT_MODEL_LIMIT',
    category: 'context',
    name: 'Model Context Limit',
    description: 'Maximum context window for the model.',
    type: 'number',
    defaultValue: 8192,
    constraints: { min: 4096, max: 131072, step: 1024 },
    dangerous: true,
    requiresRestart: false,
  },
  {
    key: 'CONTEXT_MAX_USER_MESSAGE',
    category: 'context',
    name: 'Max User Message',
    description: 'Maximum tokens for user message.',
    type: 'number',
    defaultValue: 4000,
    constraints: { min: 1000, max: 8000, step: 500 },
    dangerous: false,
    requiresRestart: false,
  },
  
  // Flash Buffer Parameters
  {
    key: 'FLASH_REDIS_TTL_HOURS',
    category: 'flash',
    name: 'Redis TTL (hours)',
    description: 'Hours to keep flash facts in Redis.',
    type: 'number',
    defaultValue: 168,
    constraints: { min: 24, max: 720, step: 24 },
    dangerous: false,
    requiresRestart: false,
  },
  {
    key: 'FLASH_MAX_FACTS_PER_USER',
    category: 'flash',
    name: 'Max Facts Per User',
    description: 'Maximum flash facts to include in context.',
    type: 'number',
    defaultValue: 10,
    constraints: { min: 5, max: 50, step: 5 },
    dangerous: false,
    requiresRestart: false,
  },
  {
    key: 'FLASH_RECONCILIATION_INTERVAL',
    category: 'flash',
    name: 'Reconciliation Interval',
    description: 'Minutes between reconciliation checks.',
    type: 'number',
    defaultValue: 60,
    constraints: { min: 15, max: 240, step: 15 },
    dangerous: false,
    requiresRestart: false,
  },
  
  // Privacy Parameters
  {
    key: 'PRIVACY_DP_EPSILON',
    category: 'privacy',
    name: 'DP Epsilon',
    description: 'Differential privacy budget. Lower = more private.',
    type: 'number',
    defaultValue: 0.5,
    constraints: { min: 0.1, max: 2.0, step: 0.1 },
    dangerous: true,
    requiresRestart: false,
  },
  {
    key: 'PRIVACY_MIN_TENANTS',
    category: 'privacy',
    name: 'Min Tenants',
    description: 'Minimum tenants for aggregation.',
    type: 'number',
    defaultValue: 10,
    constraints: { min: 5, max: 50, step: 5 },
    dangerous: true,
    requiresRestart: false,
  },
  {
    key: 'PRIVACY_MIN_TENANTS_HIGHRISK',
    category: 'privacy',
    name: 'Min Tenants (High Risk)',
    description: 'Minimum tenants for high-risk domain aggregation.',
    type: 'number',
    defaultValue: 20,
    constraints: { min: 10, max: 100, step: 10 },
    dangerous: true,
    requiresRestart: false,
  },
  {
    key: 'OVERSIGHT_TIMEOUT_DAYS',
    category: 'privacy',
    name: 'Oversight Timeout',
    description: 'Days before auto-reject (Silence ≠ Consent).',
    type: 'number',
    defaultValue: 7,
    constraints: { min: 3, max: 30, step: 1 },
    dangerous: false,
    requiresRestart: false,
  },
  {
    key: 'OVERSIGHT_ESCALATION_DAYS',
    category: 'privacy',
    name: 'Escalation Threshold',
    description: 'Days before escalation.',
    type: 'number',
    defaultValue: 3,
    constraints: { min: 1, max: 14, step: 1 },
    dangerous: false,
    requiresRestart: false,
  },
  
  // SOFAI Parameters
  {
    key: 'SOFAI_SYSTEM2_THRESHOLD',
    category: 'sofai',
    name: 'System 2 Threshold',
    description: 'Threshold for routing to System 2.',
    type: 'number',
    defaultValue: 0.5,
    constraints: { min: 0.1, max: 1.0, step: 0.1 },
    dangerous: false,
    requiresRestart: false,
  },
  {
    key: 'SOFAI_HEALTHCARE_RISK',
    category: 'sofai',
    name: 'Healthcare Risk',
    description: 'Risk score for healthcare domain.',
    type: 'number',
    defaultValue: 0.9,
    constraints: { min: 0.5, max: 1.0, step: 0.05 },
    dangerous: false,
    requiresRestart: false,
  },
  {
    key: 'SOFAI_FINANCIAL_RISK',
    category: 'sofai',
    name: 'Financial Risk',
    description: 'Risk score for financial domain.',
    type: 'number',
    defaultValue: 0.85,
    constraints: { min: 0.5, max: 1.0, step: 0.05 },
    dangerous: false,
    requiresRestart: false,
  },
  {
    key: 'SOFAI_LEGAL_RISK',
    category: 'sofai',
    name: 'Legal Risk',
    description: 'Risk score for legal domain.',
    type: 'number',
    defaultValue: 0.8,
    constraints: { min: 0.5, max: 1.0, step: 0.05 },
    dangerous: false,
    requiresRestart: false,
  },
  
  // Personalization Parameters
  {
    key: 'PERSONALIZATION_WARMUP_THRESHOLD',
    category: 'personalization',
    name: 'Warmup Threshold',
    description: 'Interactions before full user weight.',
    type: 'number',
    defaultValue: 10,
    constraints: { min: 5, max: 50, step: 5 },
    dangerous: false,
    requiresRestart: false,
  },
  {
    key: 'PERSONALIZATION_VELOCITY_THRESHOLD',
    category: 'personalization',
    name: 'Velocity Threshold',
    description: 'Corrections for fast-track personalization.',
    type: 'number',
    defaultValue: 3,
    constraints: { min: 2, max: 10, step: 1 },
    dangerous: false,
    requiresRestart: false,
  },
  {
    key: 'PERSONALIZATION_TENANT_WEIGHT',
    category: 'personalization',
    name: 'Tenant Weight',
    description: 'Default weight for tenant learning.',
    type: 'number',
    defaultValue: 0.3,
    constraints: { min: 0.1, max: 0.5, step: 0.05 },
    dangerous: false,
    requiresRestart: false,
  },
  {
    key: 'PERSONALIZATION_SYSTEM_WEIGHT',
    category: 'personalization',
    name: 'System Weight',
    description: 'Default weight for system learning.',
    type: 'number',
    defaultValue: 0.1,
    constraints: { min: 0.05, max: 0.3, step: 0.05 },
    dangerous: false,
    requiresRestart: false,
  },
  
  // Audit Parameters
  {
    key: 'AUDIT_HOT_DAYS',
    category: 'audit',
    name: 'Hot Storage Days',
    description: 'Days to keep audit logs in PostgreSQL.',
    type: 'number',
    defaultValue: 30,
    constraints: { min: 7, max: 90, step: 7 },
    dangerous: false,
    requiresRestart: false,
  },
  {
    key: 'AUDIT_WARM_DAYS',
    category: 'audit',
    name: 'Warm Storage Days',
    description: 'Days to keep audit logs in ClickHouse.',
    type: 'number',
    defaultValue: 90,
    constraints: { min: 30, max: 365, step: 30 },
    dangerous: false,
    requiresRestart: false,
  },
  {
    key: 'AUDIT_ARCHIVE_YEARS',
    category: 'audit',
    name: 'Archive Years',
    description: 'Years to keep audit logs in Glacier.',
    type: 'number',
    defaultValue: 7,
    constraints: { min: 1, max: 10, step: 1 },
    dangerous: true,
    requiresRestart: false,
  },
];

// =============================================================================
// Config Change Types
// =============================================================================

/**
 * Configuration change history entry
 */
export interface ConfigHistoryEntry {
  id: string;
  configKey: ParameterKey;
  oldValue: unknown;
  newValue: unknown;
  changedBy: string;
  changeReason: string | null;
  changedAt: Date;
}

/**
 * Configuration update request
 */
export interface ConfigUpdateRequest {
  key: ParameterKey;
  value: unknown;
  reason?: string;
}

/**
 * Configuration update response
 */
export interface ConfigUpdateResponse {
  success: boolean;
  key: ParameterKey;
  oldValue: unknown;
  newValue: unknown;
  warnings: string[];
  requiresRestart: boolean;
}
