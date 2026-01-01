/**
 * RADIANT v6.0.4 - AGI Brain Types
 * Project AWARE - Autonomous Wakefulness And Reasoning Engine
 * 
 * Defines types for the AGI Brain system including:
 * - SOFAI (System 1/2 routing)
 * - Context budgeting
 * - Flash facts
 * - Predictive uncertainty
 */

// =============================================================================
// System Level Types (SOFAI)
// =============================================================================

/**
 * SOFAI System Levels
 * - system1: Fast, intuitive responses (low compute)
 * - system1.5: Intermediate reasoning
 * - system2: Deep, deliberate reasoning (high compute)
 */
export type SystemLevel = 'system1' | 'system1.5' | 'system2';

/**
 * SOFAI routing decision
 */
export interface SofaiRoutingDecision {
  level: SystemLevel;
  confidence: number;            // 0-1, how confident in routing
  reasoning: string;             // Explanation for routing
  trust: number;                 // 1 - entropy, trust in prediction
  domainRisk: number;            // Domain-specific risk score
  computeCost: number;           // Estimated compute cost
  timestamp: Date;
}

/**
 * SOFAI configuration
 */
export interface SofaiConfig {
  system2Threshold: number;      // Default: 0.5
  domainRisks: Record<string, number>;
  enableSystem1_5: boolean;
  maxSystem2Latency: number;     // Max ms for System 2
}

export const DEFAULT_SOFAI_CONFIG: SofaiConfig = {
  system2Threshold: 0.5,
  domainRisks: {
    healthcare: 0.9,
    financial: 0.85,
    legal: 0.8,
    general: 0.3,
  },
  enableSystem1_5: true,
  maxSystem2Latency: 30000,
};

// =============================================================================
// Context Budget Types
// =============================================================================

/**
 * Context budget allocation
 * Ensures response reserve is always maintained
 */
export interface ContextBudget {
  systemCore: number;            // ~500 tokens - core system prompt
  complianceGuardrails: number;  // ~400 tokens - compliance rules
  flashFacts: number;            // ~200 tokens - critical facts
  ghostTokens: number;           // ~64 tokens - ghost vector projection
  userMessage: number;           // Priority 1 - user's input
  memories: number;              // Priority 2 - fills remainder
  responseReserve: number;       // MINIMUM 1000 tokens - CRITICAL
  totalInput: number;            // Sum of all input tokens
  compressionApplied: boolean;   // True if any compression needed
}

/**
 * Budget calculation result
 */
export interface BudgetCalculation {
  budget: ContextBudget;
  warnings: BudgetWarning[];
  valid: boolean;
}

export type BudgetWarning = 
  | 'user_message_truncated'
  | 'memories_omitted'
  | 'flash_facts_truncated'
  | 'approaching_limit';

// =============================================================================
// Flash Fact Types
// =============================================================================

/**
 * Flash fact types - safety-critical information
 */
export type FlashFactType = 
  | 'identity'      // User identity info
  | 'allergy'       // Medical allergies
  | 'medical'       // Medical conditions
  | 'preference'    // Strong preferences
  | 'constraint'    // Hard constraints
  | 'correction';   // User corrections

/**
 * Flash fact priority levels
 */
export type FlashFactPriority = 'critical' | 'high' | 'normal';

/**
 * Flash fact status
 */
export type FlashFactStatus = 
  | 'pending_dream'   // Waiting for dream consolidation
  | 'consolidated'    // Successfully consolidated
  | 'failed_retry';   // Failed, needs retry

/**
 * Flash fact entity
 */
export interface FlashFact {
  id: string;
  userId: string;
  tenantId: string;
  fact: string;                  // The fact content
  factType: FlashFactType;
  priority: FlashFactPriority;
  status: FlashFactStatus;
  retryCount: number;
  createdAt: Date;
  consolidatedAt: Date | null;
  expiresAt?: Date;              // Optional expiration
}

/**
 * Flash fact detection result
 */
export interface FlashFactDetection {
  detected: boolean;
  facts: Array<{
    fact: string;
    type: FlashFactType;
    priority: FlashFactPriority;
    confidence: number;
  }>;
}

// =============================================================================
// Predictive Uncertainty Types
// =============================================================================

/**
 * Predictive uncertainty output
 * Used for SOFAI routing decisions
 */
export interface PredictiveUncertaintyOutput {
  predictedEntropy: number;      // 0-1, higher = more uncertain
  confidenceInterval: [number, number];
  tokensAnalyzed: number;
  method: 'head' | 'heuristic';
}

/**
 * Uncertainty head configuration
 */
export interface UncertaintyHeadConfig {
  enabled: boolean;
  modelPath?: string;            // Path to trained uncertainty head
  fallbackToHeuristic: boolean;
}

// =============================================================================
// Brain Request/Response Types
// =============================================================================

/**
 * Brain inference request
 */
export interface BrainInferenceRequest {
  userId: string;
  tenantId: string;
  prompt: string;
  conversationHistory?: ConversationMessage[];
  domain?: string;
  forceSystemLevel?: SystemLevel;
  options?: BrainInferenceOptions;
}

/**
 * Conversation message
 */
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

/**
 * Brain inference options
 */
export interface BrainInferenceOptions {
  includeGhost: boolean;
  includeFlashFacts: boolean;
  includeMemories: boolean;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

/**
 * Brain inference response
 */
export interface BrainInferenceResponse {
  response: string;
  systemLevel: SystemLevel;
  routingDecision: SofaiRoutingDecision;
  budget: ContextBudget;
  ghostUpdated: boolean;
  flashFactsDetected: FlashFactDetection;
  latencyMs: number;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
}

// =============================================================================
// Assembled Context Types
// =============================================================================

/**
 * Assembled context for inference
 */
export interface AssembledContext {
  systemPrompt: string;          // Core system prompt
  userContext: string;           // Flash facts, user info
  conversationHistory: string;   // Formatted history
  complianceGuardrails: string;  // Immutable compliance rules
  ghostVector: Float32Array | null;
  flashFacts: FlashFact[];
  budget: ContextBudget;
  escapeApplied: boolean;        // XML escape applied
}

// =============================================================================
// Brain Status Types
// =============================================================================

/**
 * Brain system status
 */
export interface BrainStatus {
  healthy: boolean;
  activeGhosts: number;
  dreamsToday: number;
  pendingOversight: number;
  system2Rate: number;           // Percentage using System 2
  avgLatencyMs: number;
  lastDreamAt: Date | null;
  components: BrainComponentStatus[];
}

/**
 * Individual component status
 */
export interface BrainComponentStatus {
  name: string;
  healthy: boolean;
  latencyMs: number;
  lastError?: string;
  lastErrorAt?: Date;
}

// =============================================================================
// Personalization Types
// =============================================================================

/**
 * Personalization weights for three-tier learning
 */
export interface PersonalizationWeights {
  user: number;                  // Individual weight (0-1)
  tenant: number;                // Tenant aggregate weight (0-1)
  system: number;                // Global system weight (0-1)
}

export const DEFAULT_PERSONALIZATION_WEIGHTS: PersonalizationWeights = {
  user: 0.6,
  tenant: 0.3,
  system: 0.1,
};

/**
 * Personalization warmup status
 */
export interface PersonalizationWarmup {
  userId: string;
  tenantId: string;
  interactionCount: number;
  correctionCount: number;
  warmupComplete: boolean;
  currentWeight: number;         // Ramps up to full user weight
}

// =============================================================================
// Routing Log Types
// =============================================================================

/**
 * SOFAI routing log entry
 */
export interface SofaiRoutingLog {
  id: string;
  userId: string;
  tenantId: string;
  level: SystemLevel;
  trustScore: number;
  domainRisk: number;
  computeCost: number;
  reasoning: string;
  latencyMs: number;
  createdAt: Date;
}
