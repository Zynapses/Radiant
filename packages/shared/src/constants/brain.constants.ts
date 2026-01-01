/**
 * RADIANT v6.0.4 - AGI Brain Constants
 * Project AWARE - Autonomous Wakefulness And Reasoning Engine
 * 
 * Central location for all brain-related constants.
 * All configurable values should be in admin-config.types.ts instead.
 */

// =============================================================================
// Version Constants
// =============================================================================

/**
 * Current Ghost Vector model version
 * CRITICAL: Must match the model producing hidden states
 */
export const CURRENT_GHOST_VERSION = 'llama3-70b-v1';

/**
 * Ghost vector dimension (LLaMA 3 70B hidden state size)
 */
export const GHOST_VECTOR_DIMENSION = 4096;

/**
 * API version for brain endpoints
 */
export const BRAIN_API_VERSION = 'v6.0.4';

// =============================================================================
// Token Budget Constants
// =============================================================================

/**
 * Minimum response reserve - CRITICAL
 * Always maintain at least 1000 tokens for response generation
 */
export const MIN_RESPONSE_RESERVE = 1000;

/**
 * Default context budget allocations
 */
export const DEFAULT_CONTEXT_BUDGETS = {
  SYSTEM_CORE: 500,
  COMPLIANCE_GUARDRAILS: 400,
  FLASH_FACTS: 200,
  GHOST_TOKENS: 64,
  MAX_USER_MESSAGE: 4000,
  DEFAULT_MODEL_LIMIT: 8192,
} as const;

/**
 * Maximum context window by model
 */
export const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'llama3-70b': 8192,
  'llama3-8b': 8192,
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,
  'gpt-4': 8192,
  'gpt-4-turbo': 128000,
  'gpt-4o': 128000,
  'default': 8192,
};

// =============================================================================
// Re-anchoring Constants
// =============================================================================

/**
 * Default turn interval between ghost re-anchoring
 */
export const DEFAULT_REANCHOR_INTERVAL = 15;

/**
 * Default jitter range (+/- turns) to prevent thundering herd
 */
export const DEFAULT_JITTER_RANGE = 3;

/**
 * Entropy threshold that triggers early re-anchoring
 */
export const DEFAULT_ENTROPY_THRESHOLD = 0.3;

/**
 * Re-anchor timeout in milliseconds
 */
export const REANCHOR_TIMEOUT_MS = 5000;

// =============================================================================
// Flash Fact Constants
// =============================================================================

/**
 * Flash fact types and their priorities
 */
export const FLASH_FACT_PRIORITIES: Record<string, 'critical' | 'high' | 'normal'> = {
  identity: 'high',
  allergy: 'critical',
  medical: 'critical',
  preference: 'normal',
  constraint: 'high',
  correction: 'high',
};

/**
 * Default Redis TTL for flash facts (7 days in seconds)
 */
export const FLASH_REDIS_TTL_SECONDS = 604800;

/**
 * Maximum flash facts per user in context
 */
export const MAX_FLASH_FACTS_PER_USER = 10;

// =============================================================================
// Dreaming Constants
// =============================================================================

/**
 * Default twilight hour (4 AM local time)
 */
export const DEFAULT_TWILIGHT_HOUR = 4;

/**
 * Maximum hours between dreams (starvation trigger)
 */
export const DEFAULT_STARVATION_HOURS = 30;

/**
 * Minimum hours since last dream for twilight trigger
 */
export const MIN_HOURS_SINCE_DREAM_TWILIGHT = 20;

/**
 * Minimum hours since last dream for low traffic trigger
 */
export const MIN_HOURS_SINCE_DREAM_LOW_TRAFFIC = 6;

/**
 * Low traffic threshold percentage
 */
export const DEFAULT_LOW_TRAFFIC_THRESHOLD = 20;

/**
 * Maximum concurrent dream jobs
 */
export const MAX_CONCURRENT_DREAMS = 100;

/**
 * Stagger delay between dream jobs (minutes)
 */
export const DREAM_STAGGER_MINUTES = 5;

/**
 * Dream scheduler check interval (minutes)
 */
export const DREAM_CHECK_INTERVAL_MINUTES = 15;

// =============================================================================
// SOFAI Constants
// =============================================================================

/**
 * System levels for SOFAI routing
 */
export const SYSTEM_LEVELS = {
  SYSTEM1: 'system1',
  SYSTEM1_5: 'system1.5',
  SYSTEM2: 'system2',
} as const;

/**
 * Default System 2 threshold
 */
export const DEFAULT_SYSTEM2_THRESHOLD = 0.5;

/**
 * Default domain risk scores
 */
export const DEFAULT_DOMAIN_RISKS: Record<string, number> = {
  healthcare: 0.9,
  financial: 0.85,
  legal: 0.8,
  education: 0.4,
  general: 0.3,
  creative: 0.2,
};

/**
 * High-risk domains requiring human oversight
 */
export const HIGH_RISK_DOMAINS = ['healthcare', 'financial', 'legal'] as const;

// =============================================================================
// Privacy Constants
// =============================================================================

/**
 * Default differential privacy epsilon
 */
export const DEFAULT_DP_EPSILON = 0.5;

/**
 * Minimum tenants for privacy aggregation
 */
export const MIN_TENANTS_FOR_AGGREGATION = 10;

/**
 * Minimum tenants for high-risk domain aggregation
 */
export const MIN_TENANTS_HIGH_RISK = 20;

/**
 * Minimum semantic diversity for aggregation
 */
export const MIN_SEMANTIC_DIVERSITY = 5;

// =============================================================================
// Oversight Constants
// =============================================================================

/**
 * Oversight timeout in days (auto-reject)
 * "Silence ≠ Consent"
 */
export const OVERSIGHT_TIMEOUT_DAYS = 7;

/**
 * Escalation threshold in days
 */
export const OVERSIGHT_ESCALATION_DAYS = 3;

// =============================================================================
// Personalization Constants
// =============================================================================

/**
 * Default personalization weights
 */
export const DEFAULT_PERSONALIZATION_WEIGHTS = {
  USER: 0.6,
  TENANT: 0.3,
  SYSTEM: 0.1,
} as const;

/**
 * Warmup threshold (interactions to full user weight)
 */
export const DEFAULT_WARMUP_THRESHOLD = 10;

/**
 * Velocity threshold (corrections for fast-track)
 */
export const DEFAULT_VELOCITY_THRESHOLD = 3;

// =============================================================================
// Cache Constants
// =============================================================================

/**
 * Redis key prefixes
 */
export const REDIS_KEY_PREFIXES = {
  GHOST: 'ghost:',
  FLASH_FACTS: 'flash_facts:',
  CONFIG: 'config:',
  DREAM_LOCK: 'dream_lock:',
  SESSION: 'session:',
} as const;

/**
 * Cache TTLs in seconds
 */
export const CACHE_TTLS = {
  CONFIG: 300,           // 5 minutes
  GHOST: 604800,         // 7 days
  FLASH_FACTS: 604800,   // 7 days
  SESSION: 86400,        // 24 hours
  DREAM_LOCK: 3600,      // 1 hour
} as const;

// =============================================================================
// Compliance Sandwich Constants
// =============================================================================

/**
 * Protected XML tags that must never appear in user content
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

/**
 * Compliance sandwich section markers
 */
export const SANDWICH_MARKERS = {
  SYSTEM_CORE_START: '<system_core>',
  SYSTEM_CORE_END: '</system_core>',
  USER_CONTEXT_START: '<user_context>',
  USER_CONTEXT_END: '</user_context>',
  CONVERSATION_START: '<conversation>',
  CONVERSATION_END: '</conversation>',
  COMPLIANCE_START: '<compliance_guardrails>',
  COMPLIANCE_END: '</compliance_guardrails>',
} as const;

// =============================================================================
// Audit Constants
// =============================================================================

/**
 * Audit tier configuration (days/years)
 */
export const AUDIT_TIER_CONFIG = {
  HOT_DAYS: 30,      // PostgreSQL
  WARM_DAYS: 90,     // ClickHouse
  ARCHIVE_YEARS: 7,  // Glacier
} as const;

// =============================================================================
// SageMaker/vLLM Constants
// =============================================================================

/**
 * vLLM configuration for ghost vector extraction
 */
export const VLLM_CONFIG = {
  RETURN_HIDDEN_STATES: true,
  HIDDEN_STATE_LAYER: -1,  // Last layer
} as const;

/**
 * Default SageMaker endpoint names
 */
export const SAGEMAKER_ENDPOINTS = {
  INFERENCE: 'radiant-llama3-70b',
  EMBEDDING: 'radiant-embedding',
  GHOST_CAPTURE: 'radiant-ghost-capture',
} as const;
