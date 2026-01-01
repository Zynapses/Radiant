/**
 * RADIANT v6.0.4 - Compliance Sandwich Types
 * Secure context assembly with XML escaping
 * 
 * The Compliance Sandwich ensures:
 * 1. System Core (top bun) - immutable system instructions
 * 2. User Context (filling) - escaped user data, flash facts, memories
 * 3. Compliance Guardrails (bottom bun) - immutable tenant policy
 * 
 * All user-provided content is XML-escaped to prevent injection attacks.
 */

// =============================================================================
// Compliance Sandwich Configuration
// =============================================================================

/**
 * Fixed token budgets for sandwich layers
 */
export interface SandwichBudgets {
  systemCore: number;            // Default: 500 tokens
  complianceGuardrails: number;  // Default: 400 tokens
  flashFacts: number;            // Default: 200 tokens
  ghostTokens: number;           // Default: 64 tokens
}

/**
 * Compliance Sandwich configuration
 */
export interface ComplianceSandwichConfig {
  fixedBudgets: SandwichBudgets;
  responseReserve: number;       // Default: 1000 tokens - CRITICAL
  modelContextLimit: number;     // Default: 8192 tokens
  enableXmlEscaping: boolean;    // Default: true - CRITICAL
  enableInjectionDetection: boolean; // Default: true
}

export const DEFAULT_SANDWICH_CONFIG: ComplianceSandwichConfig = {
  fixedBudgets: {
    systemCore: 500,
    complianceGuardrails: 400,
    flashFacts: 200,
    ghostTokens: 64,
  },
  responseReserve: 1000,
  modelContextLimit: 8192,
  enableXmlEscaping: true,
  enableInjectionDetection: true,
};

// =============================================================================
// Tenant Compliance Policy Types
// =============================================================================

/**
 * Tenant compliance policy
 */
export interface TenantCompliancePolicy {
  id: string;
  tenantId: string;
  policyText: string;            // The compliance policy text
  immutable: boolean;            // Cannot be overridden by users
  rules: ComplianceRule[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Individual compliance rule
 */
export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  ruleText: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  enabled: boolean;
}

/**
 * Tenant compliance policy database record
 */
export interface TenantCompliancePolicyRecord {
  id: string;
  tenant_id: string;
  policy_text: string;
  immutable: boolean;
  rules_json: string;
  created_at: Date;
  updated_at: Date;
}

// =============================================================================
// Differential Privacy Types
// =============================================================================

/**
 * Differential privacy configuration
 */
export interface DifferentialPrivacyConfig {
  epsilon: number;               // Default: 0.5 - privacy budget
  sensitivity: number;           // Default: 1 - clamped sensitivity
  maxContributionPerTenant: number; // Default: 1 - max votes per tenant
  minTenantCount: number;        // Default: 10 - min tenants for aggregation
  minSemanticDiversity: number;  // Default: 5 - min semantic clusters
}

export const DEFAULT_DP_CONFIG: DifferentialPrivacyConfig = {
  epsilon: 0.5,
  sensitivity: 1,
  maxContributionPerTenant: 1,
  minTenantCount: 10,
  minSemanticDiversity: 5,
};

/**
 * Aggregation result with privacy guarantees
 */
export interface PrivateAggregationResult {
  value: number;
  noiseAdded: number;
  tenantCount: number;
  semanticDiversity: number;
  privacyBudgetUsed: number;
  meetsThresholds: boolean;
}

// =============================================================================
// Human Oversight Types
// =============================================================================

/**
 * High-risk domains requiring oversight
 */
export type HighRiskDomain = 'healthcare' | 'financial' | 'legal';

export const HIGH_RISK_DOMAINS: readonly HighRiskDomain[] = ['healthcare', 'financial', 'legal'] as const;

/**
 * Oversight queue item status
 */
export type OversightStatus = 
  | 'pending'      // Awaiting review
  | 'approved'     // Approved by reviewer
  | 'rejected'     // Rejected by reviewer
  | 'modified'     // Modified by reviewer
  | 'escalated'    // Escalated for senior review
  | 'expired';     // Auto-rejected after timeout

/**
 * Oversight queue item
 */
export interface OversightQueueItem {
  id: string;
  insightId: string;
  tenantId: string;
  insightJson: Record<string, unknown>;
  domain: HighRiskDomain | 'general';
  status: OversightStatus;
  assignedTo: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
  escalatedAt: Date | null;
  expiresAt: Date;
}

/**
 * Oversight queue item database record
 */
export interface OversightQueueItemRecord {
  id: string;
  insight_id: string;
  tenant_id: string;
  insight_json: string;
  domain: string;
  status: string;
  assigned_to: string | null;
  created_at: Date;
  reviewed_at: Date | null;
  escalated_at: Date | null;
  expires_at: Date;
}

/**
 * Oversight decision
 */
export interface OversightDecision {
  id: string;
  insightId: string;
  reviewerId: string;
  decision: 'approved' | 'rejected' | 'modified';
  reasoning: string;
  originalInsight: string;
  modifiedInsight: string | null;
  attestation: string;
  reviewedAt: Date;
}

/**
 * Oversight decision database record
 */
export interface OversightDecisionRecord {
  id: string;
  insight_id: string;
  reviewer_id: string;
  decision: string;
  reasoning: string;
  original_insight: string;
  modified_insight: string | null;
  attestation: string;
  reviewed_at: Date;
}

// =============================================================================
// Oversight Queue Statistics
// =============================================================================

/**
 * Oversight queue statistics
 */
export interface OversightQueueStats {
  pending: number;
  escalated: number;
  approvedToday: number;
  rejectedToday: number;
  expiredToday: number;
  avgReviewTimeMs: number;
  oldestPendingAt: Date | null;
  byDomain: Record<string, number>;
  byReviewer: Array<{
    reviewerId: string;
    reviewCount: number;
    avgTimeMs: number;
  }>;
}

// =============================================================================
// Injection Detection Types
// =============================================================================

/**
 * Compliance injection attempt detection result
 */
export interface ComplianceInjectionDetectionResult {
  detected: boolean;
  attempts: ComplianceInjectionAttempt[];
  sanitizedInput: string;
}

/**
 * Individual compliance injection attempt
 */
export interface ComplianceInjectionAttempt {
  type: 'xml_tag' | 'escape_sequence' | 'control_char' | 'prompt_leak';
  location: number;
  content: string;
  severity: 'critical' | 'high' | 'medium';
}

// =============================================================================
// Audit Types
// =============================================================================

/**
 * Audit tier configuration
 */
export interface AuditTierConfig {
  hotDays: number;               // Days in PostgreSQL (default: 30)
  warmDays: number;              // Days in ClickHouse (default: 90)
  archiveYears: number;          // Years in Glacier (default: 7)
}

export const DEFAULT_AUDIT_TIER_CONFIG: AuditTierConfig = {
  hotDays: 30,
  warmDays: 90,
  archiveYears: 7,
};

/**
 * Audit log entry for compliance tracking
 */
export interface ComplianceAuditLog {
  id: string;
  tenantId: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  details: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: Date;
  tier: 'hot' | 'warm' | 'archive';
}

// =============================================================================
// Compliance Constants
// =============================================================================

export const OVERSIGHT_TIMEOUT_DAYS = 7;
export const OVERSIGHT_ESCALATION_DAYS = 3;
export const MIN_TENANTS_FOR_AGGREGATION = 10;
export const MIN_TENANTS_HIGH_RISK = 20;

/**
 * Protected XML tags that must never appear in user input
 */
export const PROTECTED_XML_TAGS = [
  'system_core',
  'user_context',
  'conversation',
  'compliance_guardrails',
  'flash_facts',
  'ghost_state',
  'memories',
] as const;

export type ProtectedXmlTag = typeof PROTECTED_XML_TAGS[number];
