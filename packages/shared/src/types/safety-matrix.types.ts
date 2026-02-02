/**
 * RADIANT Safety Matrix Manager Types
 * Entity-Action Contraindication Grid for Domain Expert Cortex
 * 
 * The Safety Matrix defines which entities CANNOT be combined with which actions
 * in safety-critical domains (healthcare, legal, finance, etc.).
 * 
 * Examples:
 * - Healthcare: "Aspirin" entity + "prescribe to" action + "patient on blood thinners" = CONTRAINDICATED
 * - Legal: "Minor" entity + "enter contract with" action = CONTRAINDICATED
 * - Finance: "Accredited investor only" security + "sell to" retail investor = CONTRAINDICATED
 */

// =============================================================================
// Core Types
// =============================================================================

export type ContraindicationSeverity = 'absolute' | 'relative' | 'caution' | 'monitor';

export type EntityCategory =
  | 'medication'
  | 'condition'
  | 'procedure'
  | 'patient_group'
  | 'legal_entity'
  | 'document_type'
  | 'financial_instrument'
  | 'regulatory_status'
  | 'custom';

export type ActionCategory =
  | 'prescribe'
  | 'recommend'
  | 'combine_with'
  | 'administer_to'
  | 'advise'
  | 'execute'
  | 'transfer'
  | 'disclose'
  | 'custom';

// =============================================================================
// Entity Types
// =============================================================================

export interface SafetyEntity {
  id: string;
  tenantId: string;
  domainId: string;
  
  // Core info
  name: string;
  description?: string;
  category: EntityCategory;
  subcategory?: string;
  
  // Identifiers (domain-specific)
  externalIds?: {
    rxcui?: string;        // RxNorm for medications
    icd10?: string;        // ICD-10 for conditions
    cpt?: string;          // CPT for procedures
    cusip?: string;        // CUSIP for securities
    lei?: string;          // LEI for legal entities
  };
  
  // Classification
  tags: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  
  // Usage stats
  contraindicationCount: number;
  lastUsedAt?: string;
  
  // Audit
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  verified: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
}

// =============================================================================
// Action Types
// =============================================================================

export interface SafetyAction {
  id: string;
  tenantId: string;
  domainId: string;
  
  // Core info
  name: string;
  description?: string;
  category: ActionCategory;
  
  // Verb forms
  verbPresent: string;     // "prescribe"
  verbPast: string;        // "prescribed"
  verbGerund: string;      // "prescribing"
  
  // Classification
  tags: string[];
  requiresConfirmation: boolean;
  
  // Usage stats
  contraindicationCount: number;
  
  // Audit
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// =============================================================================
// Contraindication Types
// =============================================================================

export interface Contraindication {
  id: string;
  tenantId: string;
  domainId: string;
  
  // The contraindication pair
  entityId: string;
  actionId: string;
  
  // Optional second entity (for entity+entity contraindications)
  secondEntityId?: string;
  
  // Severity
  severity: ContraindicationSeverity;
  
  // Details
  reason: string;
  clinicalEvidence?: string;
  regulatoryReference?: string;
  
  // Conditions (when the contraindication applies)
  conditions?: Array<{
    field: string;           // e.g., "patient.age", "patient.conditions"
    operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'not_contains';
    value: string | number | string[];
  }>;
  
  // Exceptions (when the contraindication does NOT apply)
  exceptions?: string[];
  
  // Alternative suggestions
  alternatives?: string[];
  
  // Override policy
  allowOverride: boolean;
  overrideRequires?: 'documentation' | 'supervisor' | 'specialist' | 'none';
  
  // ML model confidence (if detected by Contraindication Net)
  mlConfidence?: number;
  mlModelVersion?: string;
  
  // Status
  status: 'active' | 'pending_review' | 'deprecated' | 'rejected';
  effectiveDate?: string;
  expirationDate?: string;
  
  // Audit
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  
  // Denormalized for display
  entityName?: string;
  actionName?: string;
  secondEntityName?: string;
}

// =============================================================================
// Matrix Grid Types
// =============================================================================

export interface SafetyMatrixCell {
  entityId: string;
  actionId: string;
  contraindication?: Contraindication;
  severity?: ContraindicationSeverity;
  hasContraindication: boolean;
}

export interface SafetyMatrixRow {
  entity: SafetyEntity;
  cells: SafetyMatrixCell[];
}

export interface SafetyMatrixGrid {
  domainId: string;
  domainName: string;
  entities: SafetyEntity[];
  actions: SafetyAction[];
  rows: SafetyMatrixRow[];
  totalContraindications: number;
  lastUpdated: string;
}

// =============================================================================
// Dashboard Types
// =============================================================================

export interface SafetyMatrixDashboard {
  summary: {
    totalEntities: number;
    totalActions: number;
    totalContraindications: number;
    pendingReview: number;
    byDomain: Array<{
      domainId: string;
      domainName: string;
      entityCount: number;
      actionCount: number;
      contraindicationCount: number;
    }>;
    bySeverity: Record<ContraindicationSeverity, number>;
  };
  recentContraindications: Contraindication[];
  pendingReviewItems: Contraindication[];
  topEntities: Array<{
    entity: SafetyEntity;
    contraindicationCount: number;
  }>;
}

// =============================================================================
// Check Types
// =============================================================================

export interface ContraindicationCheckRequest {
  tenantId: string;
  domainId: string;
  
  // What we're checking
  entityId?: string;
  entityName?: string;
  actionId?: string;
  actionName?: string;
  secondEntityId?: string;
  secondEntityName?: string;
  
  // Context for conditional contraindications
  context?: Record<string, unknown>;
  
  // Options
  includeAlternatives?: boolean;
  includeMlSuggestions?: boolean;
}

export interface ContraindicationCheckResult {
  hasContraindication: boolean;
  contraindications: Contraindication[];
  severity: ContraindicationSeverity | null;
  
  // Formatted message
  message?: string;
  
  // Suggested alternatives
  alternatives?: Array<{
    type: 'entity' | 'action';
    id: string;
    name: string;
    reason: string;
  }>;
  
  // ML suggestions (if Contraindication Net detected additional risks)
  mlSuggestions?: Array<{
    entityId: string;
    actionId: string;
    confidence: number;
    reason: string;
  }>;
  
  // Override info
  canOverride: boolean;
  overrideRequirements?: string;
}

// =============================================================================
// API Request/Response Types
// =============================================================================

export interface ListEntitiesRequest {
  tenantId: string;
  domainId: string;
  category?: EntityCategory;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListEntitiesResponse {
  entities: SafetyEntity[];
  total: number;
}

export interface CreateEntityRequest {
  domainId: string;
  name: string;
  description?: string;
  category: EntityCategory;
  subcategory?: string;
  externalIds?: SafetyEntity['externalIds'];
  tags?: string[];
  riskLevel?: SafetyEntity['riskLevel'];
}

export interface CreateActionRequest {
  domainId: string;
  name: string;
  description?: string;
  category: ActionCategory;
  verbPresent: string;
  verbPast: string;
  verbGerund: string;
  tags?: string[];
  requiresConfirmation?: boolean;
}

export interface CreateContraindicationRequest {
  domainId: string;
  entityId: string;
  actionId: string;
  secondEntityId?: string;
  severity: ContraindicationSeverity;
  reason: string;
  clinicalEvidence?: string;
  regulatoryReference?: string;
  conditions?: Contraindication['conditions'];
  exceptions?: string[];
  alternatives?: string[];
  allowOverride?: boolean;
  overrideRequires?: Contraindication['overrideRequires'];
}

export interface UpdateContraindicationRequest {
  severity?: ContraindicationSeverity;
  reason?: string;
  clinicalEvidence?: string;
  regulatoryReference?: string;
  conditions?: Contraindication['conditions'];
  exceptions?: string[];
  alternatives?: string[];
  allowOverride?: boolean;
  overrideRequires?: Contraindication['overrideRequires'];
  status?: Contraindication['status'];
}

export interface ReviewContraindicationRequest {
  approved: boolean;
  notes?: string;
}

export interface GetMatrixGridRequest {
  tenantId: string;
  domainId: string;
  entityCategory?: EntityCategory;
  actionCategory?: ActionCategory;
  entityLimit?: number;
  actionLimit?: number;
}

// =============================================================================
// Constants
// =============================================================================

export const SEVERITY_COLORS: Record<ContraindicationSeverity, string> = {
  absolute: '#ef4444',     // red-500
  relative: '#f97316',     // orange-500
  caution: '#eab308',      // yellow-500
  monitor: '#22c55e',      // green-500
};

export const SEVERITY_LABELS: Record<ContraindicationSeverity, string> = {
  absolute: 'Absolute (Never)',
  relative: 'Relative (Usually Avoid)',
  caution: 'Caution (Consider Risks)',
  monitor: 'Monitor (Proceed with Care)',
};

export const SEVERITY_WEIGHTS: Record<ContraindicationSeverity, number> = {
  absolute: 1.0,
  relative: 0.75,
  caution: 0.5,
  monitor: 0.25,
};

export const ENTITY_CATEGORY_LABELS: Record<EntityCategory, string> = {
  medication: 'Medication',
  condition: 'Condition',
  procedure: 'Procedure',
  patient_group: 'Patient Group',
  legal_entity: 'Legal Entity',
  document_type: 'Document Type',
  financial_instrument: 'Financial Instrument',
  regulatory_status: 'Regulatory Status',
  custom: 'Custom',
};

export const ACTION_CATEGORY_LABELS: Record<ActionCategory, string> = {
  prescribe: 'Prescribe',
  recommend: 'Recommend',
  combine_with: 'Combine With',
  administer_to: 'Administer To',
  advise: 'Advise',
  execute: 'Execute',
  transfer: 'Transfer',
  disclose: 'Disclose',
  custom: 'Custom',
};
