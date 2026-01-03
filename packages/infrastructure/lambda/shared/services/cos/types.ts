/**
 * RADIANT COS Types v6.0.5
 * Consciousness Operating System shared type definitions
 * 
 * Cross-AI Validated: Claude Opus 4.5 ✅ | Gemini ✅
 */

// ============================================================================
// GHOST VECTOR TYPES
// ============================================================================

export interface GhostVector {
  id: string;
  userId: string;
  tenantId: string;
  
  // 4096-dimensional vector from model hidden states
  vector: number[];
  vectorDimension: 4096;
  
  // Version gating - prevents personality discontinuity on model upgrades
  modelVersion: string;
  modelFamily: string;
  
  // Affective state components (7-hour half-life)
  affectiveState: {
    valence: number;      // -1 to 1 (negative to positive)
    arousal: number;      // 0 to 1 (calm to excited)
    dominance: number;    // 0 to 1 (submissive to dominant)
  };
  
  // Working context (12-minute half-life)
  workingContext: {
    topics: string[];
    entities: string[];
    recentIntents: string[];
  };
  
  // Curiosity state (45-minute half-life)
  curiosityState: {
    exploredTopics: string[];
    pendingQuestions: string[];
    interestLevel: number;
  };
  
  // Decay constants (Gemini validated)
  decayConstants: {
    affective: number;      // 0.0000275 = 7-hour half-life
    workingContext: number; // 0.00096 = 12-minute half-life
    curiosity: number;      // 0.00025 = 45-minute half-life
  };
  
  // Metadata
  lastUpdated: Date;
  lastReanchoredAt: Date;
  turnsSinceReanchor: number;
  createdAt: Date;
}

// Default decay constants
export const DEFAULT_DECAY_CONSTANTS = {
  affective: 0.0000275,      // 7-hour half-life
  workingContext: 0.00096,   // 12-minute half-life
  curiosity: 0.00025,        // 45-minute half-life
} as const;

// ============================================================================
// FLASH FACT TYPES (Dual-Write Buffer)
// ============================================================================

export type FlashFactType = 'identity' | 'allergy' | 'medical' | 'preference' | 'correction';
export type FlashFactStatus = 'pending_dream' | 'consolidated' | 'failed_retry' | 'orphan_recovered';

export interface FlashFact {
  id: string;
  userId: string;
  tenantId: string;
  
  fact: string;
  factType: FlashFactType;
  isSafetyCritical: boolean;
  
  status: FlashFactStatus;
  retryCount: number;
  
  redisKey: string;
  postgresId?: string;
  
  createdAt: Date;
  consolidatedAt?: Date;
  expiresAt: Date;  // 7-day TTL safety net
}

// Flash fact detection patterns (Gemini validated)
export interface FlashPattern {
  pattern: RegExp;
  type: FlashFactType;
  critical: boolean;
}

export const FLASH_PATTERNS: readonly FlashPattern[] = [
  { pattern: /my name is (\w+)/i, type: 'identity', critical: false },
  { pattern: /i('m| am) allergic to (.+)/i, type: 'allergy', critical: true },
  { pattern: /i have (.+) (disease|condition)/i, type: 'medical', critical: true },
  { pattern: /i prefer (.+)/i, type: 'preference', critical: false },
  { pattern: /don't (ever |)(.+)/i, type: 'preference', critical: false },
  { pattern: /always remember (.+)/i, type: 'preference', critical: false },
  { pattern: /i told you (.+)/i, type: 'correction', critical: false },
] as const;

// ============================================================================
// SOFAI ROUTER TYPES
// ============================================================================

export type SOFAIDecision = 'SYSTEM_1' | 'SYSTEM_2';

export interface SOFAIRoutingContext {
  query: string;
  domain: string;
  domainRisk: number;
  uncertaintyEstimate: number;
  trustLevel: number;
  system1Cost: number;
  system2Cost: number;
  budgetRemaining: number;
}

export interface SOFAIRoutingResult {
  decision: SOFAIDecision;
  confidence: number;
  reasoning: string;
  estimatedLatency: number;
  estimatedCost: number;
}

// High-risk domains (Gemini: mandatory System 2)
export const HIGH_RISK_DOMAINS = ['healthcare', 'financial', 'legal'] as const;
export type HighRiskDomain = typeof HIGH_RISK_DOMAINS[number];

// ============================================================================
// DREAMING TYPES
// ============================================================================

export type DreamTrigger = 'TWILIGHT' | 'STARVATION';
export type DreamStatus = 'scheduled' | 'running' | 'completed' | 'failed';

export interface DreamJob {
  id: string;
  tenantId: string;
  trigger: DreamTrigger;
  scheduledAt: Date;
  status: DreamStatus;
  startedAt?: Date;
  completedAt?: Date;
  flashFactsConsolidated: number;
  ghostVectorsReanchored: number;
  loraUpdatesApplied: number;
  errorMessage?: string;
  retryCount: number;
}

export interface TenantDreamConfig {
  tenantId: string;
  timezone: string;
  twilightHour: number;        // Default: 4 (4 AM local)
  starvationThresholdHours: number;  // Default: 30
  lastDreamAt?: Date;
}

// ============================================================================
// HUMAN OVERSIGHT TYPES (EU AI Act Article 14)
// ============================================================================

export type OversightStatus = 'pending_approval' | 'approved' | 'rejected' | 'escalated' | 'auto_rejected';
export type OversightItemType = 'system_insight' | 'lora_update' | 'high_risk_response';

export interface HumanOversightItem {
  id: string;
  tenantId: string;
  itemType: OversightItemType;
  content: string;
  context: Record<string, unknown>;
  status: OversightStatus;
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewNotes?: string;
  escalateAfterDays: number;     // Default: 3
  autoRejectAfterDays: number;   // Default: 7 (Gemini: "Silence ≠ Consent")
}

// Default oversight timeouts
export const OVERSIGHT_DEFAULTS = {
  escalateAfterDays: 3,
  autoRejectAfterDays: 7,
} as const;

// ============================================================================
// THREE-TIER LEARNING TYPES
// ============================================================================

export interface ThreeTierWeights {
  user: number;
  tenant: number;
  system: number;
}

export interface PersonalizationState {
  userId: string;
  interactionCount: number;
  correctionCount: number;
  warmupProgress: number;          // Logarithmic (60% by turn 3)
  correctionRate: number;
  isOpinionated: boolean;          // true if correctionRate > 0.6 in first 5 turns
  weights: ThreeTierWeights;
}

// ============================================================================
// TOKEN BUDGET TYPES
// ============================================================================

export interface TokenBudgetReserved {
  response: number;              // 1000 minimum (Gemini critical fix)
  systemPrompt: number;
  compliance: number;
}

export interface TokenBudget {
  total: number;
  reserved: TokenBudgetReserved;
  available: number;
  ghostContext: number;
  flashFacts: number;
  conversationHistory: number;
}

export interface ModelConfig {
  contextWindow: number;
  inputLimit: number;
  outputLimit: number;
}

// Model configurations
export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'gpt-4-turbo': { contextWindow: 128000, inputLimit: 120000, outputLimit: 8000 },
  'gpt-4o': { contextWindow: 128000, inputLimit: 120000, outputLimit: 8000 },
  'claude-3-opus': { contextWindow: 200000, inputLimit: 195000, outputLimit: 5000 },
  'claude-3-sonnet': { contextWindow: 200000, inputLimit: 195000, outputLimit: 5000 },
  'claude-3-haiku': { contextWindow: 200000, inputLimit: 195000, outputLimit: 5000 },
  'gemini-1.5-pro': { contextWindow: 1000000, inputLimit: 990000, outputLimit: 10000 },
  'gemini-1.5-flash': { contextWindow: 1000000, inputLimit: 990000, outputLimit: 10000 },
  'llama-3-70b': { contextWindow: 8192, inputLimit: 7000, outputLimit: 1192 },
  'llama-3-8b': { contextWindow: 8192, inputLimit: 7000, outputLimit: 1192 },
  'mistral-large': { contextWindow: 32768, inputLimit: 30000, outputLimit: 2768 },
};

// ============================================================================
// DIFFERENTIAL PRIVACY TYPES
// ============================================================================

export interface DifferentialPrivacyResult {
  originalValue: number;
  noisyValue: number;
  noiseScale: number;
  epsilon: number;
  sensitivityClipped: boolean;     // MUST be true (Gemini critical fix)
  clippedCount: number;
}

export interface DifferentialPrivacyConfig {
  epsilon: number;                 // Default: 0.5
  minTenants: number;              // Default: 10
  sensitivityBound: number;        // Default: 1 (each tenant = 1 vote)
}

export const DP_DEFAULTS: DifferentialPrivacyConfig = {
  epsilon: 0.5,
  minTenants: 10,
  sensitivityBound: 1,
};

// ============================================================================
// COMPLIANCE SANDWICH TYPES
// ============================================================================

export interface TenantComplianceRules {
  tenantId: string;
  rules: string[];
  blockedCapabilities: string[];
  requiredDisclosures: string[];
}

export interface ComplianceSandwichParams {
  systemPrompt: string;
  userPreferences: string;
  currentMessage: string;
  tenantRules: TenantComplianceRules;
}

// ============================================================================
// UNCERTAINTY HEAD TYPES
// ============================================================================

export interface UncertaintyEstimate {
  epistemic: number;       // Model uncertainty (what it doesn't know)
  aleatoric: number;       // Data uncertainty (inherent randomness)
  combined: number;        // Weighted combination
  shouldEscalate: boolean; // true if combined > threshold
}

export const UNCERTAINTY_THRESHOLDS = {
  escalation: 0.7,
  system2Routing: 0.6,
  highConfidence: 0.3,
} as const;

// ============================================================================
// RE-ANCHOR TYPES
// ============================================================================

export interface ReanchorJob {
  ghostId: string;
  userId: string;
  tenantId: string;
  scheduledAt: Date;
  priority: 'normal' | 'high';
}

export const REANCHOR_CONFIG = {
  baseInterval: 15,      // Re-anchor every 15 turns
  jitter: 3,             // +/- 3 turns (12-18 range)
  maxLatencyMs: 100,     // Async to avoid latency spike
} as const;

// ============================================================================
// COS CONFIGURATION
// ============================================================================

export interface COSConfig {
  enabled: boolean;
  ghostVectorsEnabled: boolean;
  flashFactsEnabled: boolean;
  dreamingEnabled: boolean;
  humanOversightEnabled: boolean;
  differentialPrivacyEnabled: boolean;
  
  // vLLM requirement
  vllmReturnHiddenStates: boolean;
  
  // Safety invariants (from Genesis Cato)
  cbfEnforcementMode: 'ENFORCE';  // NEVER relax
  gammaBoostAllowed: false;        // NEVER boost
}

export const DEFAULT_COS_CONFIG: COSConfig = {
  enabled: true,
  ghostVectorsEnabled: true,
  flashFactsEnabled: true,
  dreamingEnabled: true,
  humanOversightEnabled: true,
  differentialPrivacyEnabled: true,
  vllmReturnHiddenStates: true,
  cbfEnforcementMode: 'ENFORCE',
  gammaBoostAllowed: false,
};
