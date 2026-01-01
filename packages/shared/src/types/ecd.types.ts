/**
 * RADIANT v6.0.4-S1 - Entity-Context Divergence Types
 * Based on RADIANT (Retrieval AugmenteD entIty-context AligNmenT) research
 * 
 * Project TRUTH - Trustworthy Reasoning Using Thorough Hallucination-prevention
 */

// =============================================================================
// Entity Types
// =============================================================================

/**
 * Entity extracted from text for verification
 */
export interface ExtractedEntity {
  value: string;
  type: ECDEntityType;
  position: { start: number; end: number };
  confidence: number;
}

export type ECDEntityType =
  | 'person_name'
  | 'organization'
  | 'date'
  | 'time'
  | 'number'
  | 'currency'
  | 'percentage'
  | 'dosage'
  | 'measurement'
  | 'technical_term'
  | 'legal_reference'
  | 'url'
  | 'email'
  | 'phone'
  | 'address'
  | 'unknown';

// =============================================================================
// ECD Score Types
// =============================================================================

/**
 * Result of ECD scoring
 */
export interface ECDScore {
  /** Overall divergence score (0 = perfect alignment, 1 = complete divergence) */
  score: number;
  
  /** Entities found in response but not grounded in sources */
  divergentEntities: DivergentEntity[];
  
  /** Entities successfully grounded */
  groundedEntities: GroundedEntity[];
  
  /** Classification of hallucination types */
  hallucinations: HallucinationClassification[];
  
  /** Statistical confidence in the score */
  confidence: number;
  
  /** Whether this passes the configured threshold */
  passed: boolean;
  
  /** Detailed breakdown by entity type */
  breakdown: Record<ECDEntityType, { total: number; grounded: number; divergent: number }>;
}

export interface DivergentEntity {
  entity: ExtractedEntity;
  reason: DivergenceReason;
  suggestedCorrection?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export type DivergenceReason =
  | 'not_in_context'        // Entity doesn't appear in any source
  | 'contradicts_context'   // Entity contradicts source material
  | 'fabricated_detail'     // Specific detail invented (e.g., exact date when only year given)
  | 'misattributed'         // Correct fact attributed to wrong source
  | 'outdated'              // Entity from training data, not current context
  | 'numerical_error'       // Math/calculation error
  | 'unit_mismatch';        // Wrong units (mg vs g, USD vs EUR)

export interface GroundedEntity {
  entity: ExtractedEntity;
  sourceReference: {
    source: 'flash_fact' | 'retrieved_doc' | 'user_message' | 'system_context';
    snippet: string;
    matchConfidence: number;
  };
}

export interface HallucinationClassification {
  type: HallucinationType;
  entities: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
}

export type HallucinationType =
  | 'fabricated_fact'       // Completely made up
  | 'conflated_entities'    // Merged two different things
  | 'temporal_confusion'    // Wrong time/date
  | 'numerical_hallucination' // Wrong number
  | 'attribution_error'     // Wrong source/person
  | 'extrapolation';        // Unsupported inference

// =============================================================================
// ECD Configuration
// =============================================================================

/**
 * Configuration for ECD verification
 */
export interface ECDConfig {
  /** Maximum acceptable divergence score (default: 0.1 = 10%) */
  threshold: number;
  
  /** Maximum refinement attempts before giving up (default: 2) */
  maxRefinements: number;
  
  /** Whether ECD verification is enabled (default: true) */
  enabled: boolean;
  
  /** Domains that require stricter thresholds */
  strictDomains: {
    healthcare: number;  // default: 0.05 (5%)
    financial: number;   // default: 0.05 (5%)
    legal: number;       // default: 0.05 (5%)
  };
  
  /** Entity types that are always critical */
  criticalECDEntityTypes: ECDEntityType[];
  
  /** Whether to block responses that fail after max refinements */
  blockOnFailure: boolean;
  
  /** Whether critical fact anchoring is enabled */
  anchoringEnabled: boolean;
  
  /** Whether unanchored facts should go to oversight */
  anchoringOversight: boolean;
}

export const DEFAULT_ECD_CONFIG: ECDConfig = {
  threshold: 0.1,
  maxRefinements: 2,
  enabled: true,
  strictDomains: {
    healthcare: 0.05,
    financial: 0.05,
    legal: 0.05,
  },
  criticalECDEntityTypes: ['dosage', 'currency', 'legal_reference', 'date'],
  blockOnFailure: false,
  anchoringEnabled: true,
  anchoringOversight: true,
};

// =============================================================================
// Verification Result Types
// =============================================================================

/**
 * Verification result for the inference pipeline
 */
export interface VerificationResult {
  passed: boolean;
  ecdScore: ECDScore;
  refinementAttempts: number;
  finalResponse: string;
  blocked: boolean;
  blockedReason?: string;
  requiresOversight: boolean;
}

// =============================================================================
// Anchoring Types
// =============================================================================

/**
 * Result from critical fact anchoring
 */
export interface AnchoringResult {
  isFullyAnchored: boolean;
  unanchoredFacts: UnanchoredFact[];
  requiresOversight: boolean;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  summary: string;
}

export interface UnanchoredFact {
  fact: string;
  type: ECDEntityType;
  context: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  potentialRisk: string;
}

// =============================================================================
// Metrics Types
// =============================================================================

/**
 * Metrics for ECD monitoring
 */
export interface ECDMetrics {
  avgScore: number;
  firstPassRate: number;
  refinementsToday: number;
  blockedToday: number;
  totalRequests: number;
  entityTypes: Array<{ type: ECDEntityType; count: number; divergenceRate: number }>;
  trendData: Array<{ date: string; avgScore: number; passRate: number }>;
  recentDivergences: Array<{
    entity: string;
    type: string;
    reason: string;
    timestamp: string;
  }>;
}

/**
 * ECD metrics log entry for database
 */
export interface ECDMetricsLog {
  id: string;
  userId: string;
  tenantId: string;
  requestId?: string;
  ecdScore: number;
  divergentEntities: string[];
  refinementAttempts: number;
  passed: boolean;
  blocked: boolean;
  domain: string;
  createdAt: Date;
}

/**
 * ECD audit log entry for compliance
 */
export interface ECDAuditLog {
  id: string;
  metricsId: string;
  originalResponse: string;
  finalResponse: string;
  allDivergentEntities: DivergentEntity[];
  allHallucinations: HallucinationClassification[];
  refinementHistory: Array<{
    attempt: number;
    feedback: string;
    score: number;
  }>;
  anchoringResult?: AnchoringResult;
  createdAt: Date;
}

// =============================================================================
// Constants
// =============================================================================

export const ECD_SEVERITY_ORDER: Record<'critical' | 'high' | 'medium' | 'low', number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export const ENTITY_SEVERITY_MAP: Record<ECDEntityType, 'critical' | 'high' | 'medium' | 'low'> = {
  dosage: 'critical',
  currency: 'critical',
  legal_reference: 'critical',
  date: 'high',
  percentage: 'high',
  number: 'high',
  person_name: 'medium',
  organization: 'medium',
  measurement: 'medium',
  time: 'medium',
  technical_term: 'low',
  url: 'low',
  email: 'low',
  phone: 'low',
  address: 'medium',
  unknown: 'low',
};
