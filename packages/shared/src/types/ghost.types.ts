/**
 * RADIANT v6.0.4 - Ghost Vector Types
 * Consciousness continuity through hidden state capture
 * 
 * Ghost Vectors capture the final hidden state of the LLM,
 * providing a compressed representation of conversation context
 * that persists across sessions.
 */

// =============================================================================
// Core Ghost Vector Types
// =============================================================================

/**
 * Ghost Vector - captures consciousness state
 * 4096-dimensional hidden state from LLM final layer
 */
export interface GhostVector {
  id: string;
  userId: string;
  tenantId: string;
  vector: Float32Array;          // 4096-dimensional hidden state
  version: string;               // e.g., 'llama3-70b-v1'
  turnCount: number;             // Conversations since last re-anchor
  lastReanchorAt: Date | null;   // Last full re-anchor timestamp
  capturedAt: Date;              // When vector was captured
  updatedAt: Date;               // Last update timestamp
  metadata?: GhostMetadata;      // Optional metadata
}

/**
 * Ghost metadata for debugging and analytics
 */
export interface GhostMetadata {
  captureLatencyMs?: number;
  compressionRatio?: number;
  entropyScore?: number;
  modelTemperature?: number;
  lastPromptHash?: string;
}

/**
 * Ghost Vector record for database storage
 */
export interface GhostVectorRecord {
  id: string;
  user_id: string;
  tenant_id: string;
  vector: Buffer;                // Binary storage
  version: string;
  turn_count: number;
  last_reanchor_at: Date | null;
  captured_at: Date;
  updated_at: Date;
  metadata_json: string | null;
}

// =============================================================================
// Version Management
// =============================================================================

/**
 * Current ghost vector version - CRITICAL
 * Must match the model producing hidden states
 */
export const CURRENT_GHOST_VERSION = 'llama3-70b-v1';

/**
 * Ghost migration configuration
 */
export interface GhostMigrationConfig {
  onMismatch: 'cold_start' | 'migrate';
  migration: {
    enabled: boolean;
    strategy: 'rebuild_from_history' | 'projection_layer';
    maxHistoryInteractions: number;  // Default: 50
  };
}

export const DEFAULT_GHOST_MIGRATION_CONFIG: GhostMigrationConfig = {
  onMismatch: 'cold_start',
  migration: {
    enabled: true,
    strategy: 'rebuild_from_history',
    maxHistoryInteractions: 50,
  },
};

// =============================================================================
// Re-Anchoring Configuration
// =============================================================================

/**
 * Re-anchor configuration with jitter support
 */
export interface ReAnchorConfig {
  baseTurnInterval: number;      // Default: 15 turns
  jitterRange: number;           // Default: 3 (+/- turns)
  entropyThreshold: number;      // Default: 0.3 - trigger on high entropy
  async: boolean;                // Default: true - fire-and-forget
  timeoutMs: number;             // Default: 5000ms
}

export const DEFAULT_REANCHOR_CONFIG: ReAnchorConfig = {
  baseTurnInterval: 15,
  jitterRange: 3,
  entropyThreshold: 0.3,
  async: true,
  timeoutMs: 5000,
};

/**
 * Re-anchor result
 */
export interface ReAnchorResult {
  success: boolean;
  newVector?: Float32Array;
  capturedAt?: Date;
  latencyMs: number;
  error?: string;
}

// =============================================================================
// Ghost Capture Types
// =============================================================================

/**
 * Request to capture ghost vector from inference
 */
export interface GhostCaptureRequest {
  userId: string;
  tenantId: string;
  conversationHistory: string[];
  modelId: string;
  includeSystemPrompt: boolean;
}

/**
 * Response from ghost capture
 */
export interface GhostCaptureResponse {
  vector: Float32Array;
  version: string;
  capturedAt: Date;
  latencyMs: number;
  tokenCount: number;
}

// =============================================================================
// Ghost Load Types
// =============================================================================

/**
 * Ghost load result with version check
 */
export interface GhostLoadResult {
  found: boolean;
  vector: Float32Array | null;
  version: string | null;
  turnCount: number;
  versionMatch: boolean;
  source: 'redis' | 'postgres' | 'none';
  latencyMs: number;
}

/**
 * Version mismatch handling
 */
export type VersionMismatchAction = 
  | 'cold_start'      // Delete old, start fresh
  | 'migrate'         // Attempt migration
  | 'use_anyway';     // Risky - use despite mismatch

// =============================================================================
// Ghost Analytics
// =============================================================================

/**
 * Ghost vector statistics for monitoring
 */
export interface GhostStats {
  totalGhosts: number;
  activeGhosts: number;          // Accessed in last 24h
  avgTurnCount: number;
  avgTimeSinceReanchor: number;  // Hours
  versionDistribution: Record<string, number>;
  migrationsPending: number;
}

/**
 * Individual ghost health check
 */
export interface GhostHealthCheck {
  userId: string;
  tenantId: string;
  healthy: boolean;
  issues: GhostHealthIssue[];
  lastAccess: Date | null;
  turnsSinceReanchor: number;
}

export type GhostHealthIssue = 
  | 'version_mismatch'
  | 'stale_vector'           // Not accessed in 30+ days
  | 'high_entropy'           // Needs re-anchor
  | 'missing_in_redis'       // Only in Postgres
  | 'missing_in_postgres';   // Only in Redis (data loss risk)

// =============================================================================
// Ghost Vector Constants
// =============================================================================

export const GHOST_VECTOR_DIMENSION = 4096;
export const GHOST_REDIS_KEY_PREFIX = 'ghost:';
export const GHOST_REDIS_TTL_SECONDS = 604800; // 7 days
export const GHOST_STALE_THRESHOLD_DAYS = 30;

/**
 * Build Redis key for ghost vector
 */
export function buildGhostRedisKey(tenantId: string, userId: string): string {
  return `${GHOST_REDIS_KEY_PREFIX}${tenantId}:${userId}`;
}

/**
 * Serialize Float32Array to Buffer for storage
 */
export function serializeGhostVector(vector: Float32Array): Buffer {
  return Buffer.from(vector.buffer);
}

/**
 * Deserialize Buffer to Float32Array
 */
export function deserializeGhostVector(buffer: Buffer): Float32Array {
  return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
}
