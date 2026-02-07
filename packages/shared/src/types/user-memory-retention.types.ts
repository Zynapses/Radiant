/**
 * User Memory Retention & Profile Types v1.1.0
 * 
 * Unified memory retention policy hierarchy:
 *   Platform Default (Radiant Admin)
 *     → Tenant Override (Think Tank Admin)
 *       → Tenant Admin Override (Think Tank Tenant Admin)
 * 
 * User Memory Profile:
 *   Consolidated cross-chat, cross-model memory profile
 *   that persists across all sessions, all conversations,
 *   and all models for a given user.
 */

// =============================================================================
// Retention Policy Hierarchy
// =============================================================================

/**
 * Memory retention scope — who set this policy?
 */
export type RetentionPolicyScope = 'platform' | 'tenant' | 'tenant_admin';

/**
 * Memory retention tier — what storage class?
 */
export type MemoryStorageTier = 'hot' | 'warm' | 'cold' | 'archive';

/**
 * What type of memory does this retention policy apply to?
 */
export type RetentionTargetType =
  | 'all'                    // Applies to all memory types
  | 'conversation_history'   // Raw conversation transcripts
  | 'user_context'           // User persistent context (facts, prefs)
  | 'akg_nodes'              // AKG knowledge graph nodes
  | 'akg_edges'              // AKG knowledge graph edges
  | 'memories'               // General memory store entries
  | 'preferences'            // User preferences
  | 'dream_insights'         // Generated insights
  | 'access_patterns'        // Prefetch training data
  | 'uploaded_documents'     // User-uploaded files (PDFs, images, code, etc.)
  | 'downloaded_files';      // AI-generated or retrieved files available for download

/**
 * Platform-level default retention policy.
 * Set by Radiant super-admin. Applies to ALL tenants unless overridden.
 */
export interface PlatformRetentionPolicy {
  policyId: string;
  scope: 'platform';
  targetType: RetentionTargetType;
  
  // Core retention settings
  retentionDays: number;            // 0 = unlimited/indefinite
  maxStoragePerUserMb: number;      // 0 = unlimited
  maxEntriesPerUser: number;        // 0 = unlimited
  
  // Tiered storage thresholds
  hotTierDays: number;              // Days in hot storage (default: 30)
  warmTierDays: number;             // Days in warm storage (default: 180)
  coldTierDays: number;             // Days in cold storage (default: 365)
  archiveAfterDays: number;         // Days before archival (0 = never)
  
  // Auto-pruning
  autoPruneEnabled: boolean;
  pruneMinImportance: number;       // Only prune below this importance (0-1)
  pruneMinAccessCount: number;      // Only prune below this access count
  
  // Feature toggles
  sessionToSessionMemoryEnabled: boolean;  // Master toggle for cross-session memory
  conversationHistoryEnabled: boolean;     // Store full conversation history
  autoExtractEnabled: boolean;             // Auto-extract facts from conversations
  userCanDeleteOwnMemory: boolean;         // Allow users to manage their own memory
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tenant-level retention override.
 * Set by Think Tank Admin. Overrides platform defaults for this tenant.
 */
export interface TenantRetentionOverride {
  overrideId: string;
  tenantId: string;
  scope: 'tenant';
  targetType: RetentionTargetType;
  
  // All fields are optional — only override what you want to change
  retentionDays?: number;
  maxStoragePerUserMb?: number;
  maxEntriesPerUser?: number;
  hotTierDays?: number;
  warmTierDays?: number;
  coldTierDays?: number;
  archiveAfterDays?: number;
  autoPruneEnabled?: boolean;
  pruneMinImportance?: number;
  pruneMinAccessCount?: number;
  sessionToSessionMemoryEnabled?: boolean;
  conversationHistoryEnabled?: boolean;
  autoExtractEnabled?: boolean;
  userCanDeleteOwnMemory?: boolean;
  
  overriddenBy: string;           // Admin user ID who set this
  overrideReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tenant Admin retention override.
 * Set by Think Tank Tenant Admin. Overrides tenant-level for their scope.
 * CANNOT exceed tenant-level limits (e.g., can reduce retention but not extend beyond tenant max).
 */
export interface TenantAdminRetentionOverride {
  overrideId: string;
  tenantId: string;
  scope: 'tenant_admin';
  targetType: RetentionTargetType;
  
  // Same optional override fields
  retentionDays?: number;
  maxStoragePerUserMb?: number;
  maxEntriesPerUser?: number;
  hotTierDays?: number;
  warmTierDays?: number;
  sessionToSessionMemoryEnabled?: boolean;
  conversationHistoryEnabled?: boolean;
  autoExtractEnabled?: boolean;
  userCanDeleteOwnMemory?: boolean;
  
  overriddenBy: string;
  overrideReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Effective (resolved) retention policy for a tenant after merging hierarchy.
 */
export interface EffectiveRetentionPolicy {
  tenantId: string;
  targetType: RetentionTargetType;
  
  // Resolved values (platform → tenant → tenant_admin)
  retentionDays: number;
  maxStoragePerUserMb: number;
  maxEntriesPerUser: number;
  hotTierDays: number;
  warmTierDays: number;
  coldTierDays: number;
  archiveAfterDays: number;
  autoPruneEnabled: boolean;
  pruneMinImportance: number;
  pruneMinAccessCount: number;
  sessionToSessionMemoryEnabled: boolean;
  conversationHistoryEnabled: boolean;
  autoExtractEnabled: boolean;
  userCanDeleteOwnMemory: boolean;
  
  // Provenance — where each value came from
  sources: Record<string, RetentionPolicyScope>;
  
  resolvedAt: Date;
}

// =============================================================================
// User Memory Profile
// =============================================================================

/**
 * Unified user memory profile — the single source of truth for what
 * the AI knows about a user across ALL chats and ALL models.
 */
export interface UserMemoryProfile {
  profileId: string;
  tenantId: string;
  userId: string;
  
  // Profile metadata
  totalMemoryEntries: number;
  totalStorageBytes: number;
  currentStorageTier: MemoryStorageTier;
  profileQuality: number;           // 0-1, overall richness of profile
  
  // Memory counts by category
  factsCount: number;
  preferencesCount: number;
  instructionsCount: number;
  projectsCount: number;
  skillsCount: number;
  relationshipsCount: number;
  correctionsCount: number;
  akgNodesCount: number;
  akgEdgesCount: number;
  conversationMemoriesCount: number;
  uploadedDocumentsCount: number;
  uploadedDocumentsTotalBytes: number;
  downloadedFilesCount: number;
  downloadedFilesTotalBytes: number;
  
  // Activity
  lastInteractionAt: Date;
  lastMemoryUpdateAt: Date;
  totalConversations: number;
  totalModelsUsed: number;
  modelsUsed: string[];              // Model IDs this user has interacted with
  
  // Retention
  effectiveRetention: EffectiveRetentionPolicy;
  oldestMemoryAt?: Date;
  nextPruneAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Memory profile summary for injection into prompts.
 * This is what gets sent to EVERY model for EVERY chat.
 */
export interface UserMemoryProfileSummary {
  userId: string;
  tenantId: string;
  
  // Key facts (ordered by importance)
  facts: Array<{ content: string; importance: number; confidence: number }>;
  
  // Active preferences
  preferences: Array<{ key: string; value: string; confidence: number }>;
  
  // Standing instructions
  instructions: string[];
  
  // Active projects/goals
  projects: Array<{ name: string; status: string }>;
  
  // Known skills
  skills: string[];
  
  // Recent corrections
  corrections: Array<{ content: string; correctedAt: Date }>;
  
  // AKG context (top entities)
  topEntities: Array<{ label: string; type: string; importance: number }>;
  
  // Uploaded documents available across all chats/models
  uploadedDocuments: Array<{
    filename: string;
    contentType: string;
    fileSizeBytes: number;
    extractedSummary?: string;
    uploadedAt: Date;
  }>;
  
  // Downloaded/generated files available across all chats/models
  downloadedFiles: Array<{
    filename: string;
    contentType: string;
    fileSizeBytes: number;
    description?: string;
    createdAt: Date;
  }>;
  
  // Formatted system prompt injection
  systemPromptInjection: string;
  
  // Metadata
  profileCompleteness: number;       // 0-1
  lastUpdated: Date;
  tokenEstimate: number;
}

// =============================================================================
// Admin Dashboard Types
// =============================================================================

/**
 * Memory dashboard data for admin UIs.
 */
export interface MemoryRetentionDashboard {
  // Platform-level stats
  platformPolicy: PlatformRetentionPolicy;
  
  // Tenant-level
  tenantOverride?: TenantRetentionOverride;
  tenantAdminOverride?: TenantAdminRetentionOverride;
  effectivePolicy: EffectiveRetentionPolicy;
  
  // Usage stats
  totalUsers: number;
  totalMemoryEntries: number;
  totalStorageBytes: number;
  avgEntriesPerUser: number;
  avgStoragePerUserMb: number;
  
  // Storage tier distribution
  hotTierEntries: number;
  warmTierEntries: number;
  coldTierEntries: number;
  archiveTierEntries: number;
  
  // Health
  usersNearStorageLimit: number;
  entriesPendingPrune: number;
  lastPruneAt?: Date;
  nextScheduledPrune?: Date;
  
  generatedAt: Date;
}

/**
 * User memory management view for admins.
 */
export interface UserMemoryAdminView {
  userId: string;
  userName?: string;
  email?: string;
  
  profile: UserMemoryProfile;
  
  // Storage breakdown
  storageByType: Record<string, number>;  // bytes by memory type
  entriesByType: Record<string, number>;
  
  // Activity
  recentConversations: number;            // last 7 days
  memoryGrowthRate: number;               // entries per day
  estimatedStorageIn30Days: number;
  
  // Compliance
  hasActiveConsent: boolean;
  lastConsentAt?: Date;
  pendingErasureRequest: boolean;
}
