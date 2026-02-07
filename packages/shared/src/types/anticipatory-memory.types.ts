/**
 * Anticipatory Memory Architecture v1.0.0
 * 
 * 5 leapfrog features that put RADIANT 3-5 years ahead of Claude's persistent memory:
 * 
 * 1. Autobiographical Knowledge Graph (AKG) — Living entity-relationship graph auto-extracted
 *    from every conversation. Not flat facts but traversable knowledge with temporal edges.
 * 
 * 2. Predictive Memory Prefetch — ML model trained on access patterns predicts what memories
 *    will be needed BEFORE the user asks. Speculative retrieval for zero-latency recall.
 * 
 * 3. Memory Contradiction Detector — Every new fact checked against existing graph.
 *    Contradictions flagged with source provenance, resolved by recency/confidence/user vote.
 * 
 * 4. Organizational Memory Mesh — Tenant-wide shared knowledge with privacy tiers
 *    (personal/team/org). Regulatory-compliant cross-pollination during Twilight Dreaming.
 *    GDPR/HIPAA/SOC2 consent tracking and data classification.
 * 
 * 5. Dream Insight Generator — During Twilight Dreaming, analyze memory patterns to
 *    generate proactive insights. Surface discoveries and recommendations autonomously.
 */

// =============================================================================
// 1. AUTOBIOGRAPHICAL KNOWLEDGE GRAPH (AKG)
// =============================================================================

/**
 * A node in the autobiographical knowledge graph.
 * Represents an entity (person, company, technology, concept, etc.)
 * extracted from user conversations.
 */
export interface AKGNode {
  nodeId: string;
  tenantId: string;
  userId: string;
  /** Entity type classification */
  entityType: AKGEntityType;
  /** The canonical name of the entity */
  label: string;
  /** Alternate names / aliases for this entity */
  aliases: string[];
  /** Structured properties extracted from conversations */
  properties: Record<string, unknown>;
  /** 1536-dimensional embedding for semantic search */
  embedding?: number[];
  /** Confidence that this entity exists and is correctly classified (0-1) */
  confidence: number;
  /** Number of conversations that mention this entity */
  mentionCount: number;
  /** First seen in a conversation */
  firstSeenAt: Date;
  /** Most recent conversation mention */
  lastSeenAt: Date;
  /** Importance score (0-1) based on frequency, recency, and centrality */
  importance: number;
  /** Source conversation IDs that contributed to this node */
  sourceConversationIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type AKGEntityType =
  | 'person'
  | 'organization'
  | 'project'
  | 'technology'
  | 'concept'
  | 'location'
  | 'event'
  | 'product'
  | 'skill'
  | 'preference'
  | 'goal'
  | 'problem'
  | 'decision'
  | 'custom';

/**
 * A directed edge in the knowledge graph.
 * Represents a relationship between two entities with temporal context.
 */
export interface AKGEdge {
  edgeId: string;
  tenantId: string;
  userId: string;
  /** Source node */
  sourceNodeId: string;
  /** Target node */
  targetNodeId: string;
  /** Relationship type */
  relationshipType: AKGRelationshipType;
  /** Human-readable label (e.g., "works at", "is building") */
  label: string;
  /** Edge properties (e.g., role, start_date, end_date) */
  properties: Record<string, unknown>;
  /** Confidence in this relationship (0-1) */
  confidence: number;
  /** When this relationship started (if known) */
  validFrom?: Date;
  /** When this relationship ended (if known, null = still active) */
  validUntil?: Date;
  /** Source conversation that established this edge */
  sourceConversationId: string;
  /** Weight for graph traversal (higher = stronger relationship) */
  weight: number;
  createdAt: Date;
  updatedAt: Date;
}

export type AKGRelationshipType =
  | 'works_at'
  | 'builds'
  | 'uses'
  | 'knows'
  | 'prefers'
  | 'manages'
  | 'created'
  | 'depends_on'
  | 'part_of'
  | 'located_in'
  | 'interested_in'
  | 'skilled_in'
  | 'concerned_about'
  | 'decided'
  | 'avoids'
  | 'collaborates_with'
  | 'reports_to'
  | 'owns'
  | 'studies'
  | 'custom';

/**
 * Result of an AKG extraction from a conversation turn.
 * The extraction pipeline runs after every AI response.
 */
export interface AKGExtractionResult {
  /** New nodes discovered */
  newNodes: AKGNode[];
  /** Existing nodes updated with new information */
  updatedNodes: Array<{ nodeId: string; updates: Partial<AKGNode> }>;
  /** New relationships discovered */
  newEdges: AKGEdge[];
  /** Existing edges updated */
  updatedEdges: Array<{ edgeId: string; updates: Partial<AKGEdge> }>;
  /** Contradictions detected during extraction */
  contradictions: MemoryContradiction[];
  /** Processing metadata */
  extractionLatencyMs: number;
  tokensUsed: number;
  modelUsed: string;
}

/**
 * Query for graph traversal — find related entities starting from a seed.
 */
export interface AKGGraphQuery {
  tenantId: string;
  userId: string;
  /** Starting node(s) for traversal */
  seedNodeIds?: string[];
  /** Or start from a natural language query */
  naturalLanguageQuery?: string;
  /** Maximum traversal depth */
  maxDepth: number;
  /** Minimum edge confidence to traverse */
  minEdgeConfidence: number;
  /** Filter by entity types */
  entityTypes?: AKGEntityType[];
  /** Filter by relationship types */
  relationshipTypes?: AKGRelationshipType[];
  /** Maximum nodes to return */
  limit: number;
  /** Include temporal edges (historical relationships) */
  includeHistorical: boolean;
}

/**
 * Result of a graph traversal query.
 */
export interface AKGGraphResult {
  nodes: AKGNode[];
  edges: AKGEdge[];
  /** Paths from seed to each result node */
  paths: Array<{ nodeIds: string[]; edgeIds: string[]; totalWeight: number }>;
  /** Context string suitable for injection into prompts */
  contextSummary: string;
  /** Estimated token count of the context summary */
  contextTokens: number;
  queryLatencyMs: number;
}

/**
 * AKG configuration per tenant.
 */
export interface AKGConfig {
  tenantId: string;
  enabled: boolean;
  /** Model to use for entity extraction (default: gpt-4o-mini for speed) */
  extractionModel: string;
  /** Minimum confidence to persist an extracted entity */
  minEntityConfidence: number;
  /** Minimum confidence to persist an extracted relationship */
  minEdgeConfidence: number;
  /** Maximum nodes per user (prevent unbounded growth) */
  maxNodesPerUser: number;
  /** Maximum edges per user */
  maxEdgesPerUser: number;
  /** Auto-prune nodes not seen in N days */
  pruneAfterDays: number;
  /** Entity types to extract (empty = all) */
  enabledEntityTypes: AKGEntityType[];
  /** Whether to generate embeddings for nodes */
  generateEmbeddings: boolean;
  /** Maximum tokens to use for extraction per conversation turn */
  maxExtractionTokens: number;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// 2. PREDICTIVE MEMORY PREFETCH
// =============================================================================

/**
 * An access pattern record used to train the prefetch model.
 * Tracks what memories were accessed, when, and in what context.
 */
export interface MemoryAccessPattern {
  patternId: string;
  tenantId: string;
  userId: string;
  /** What was accessed */
  accessedNodeIds: string[];
  /** What was the user's query/prompt that triggered access */
  triggerPromptHash: string;
  /** Time features */
  hourOfDay: number;
  dayOfWeek: number;
  /** Topic context at time of access */
  topicContext: string[];
  /** Session duration at time of access (seconds) */
  sessionDurationSec: number;
  /** Was this access useful? (did user continue in same topic) */
  wasUseful: boolean;
  /** Latency of the retrieval */
  retrievalLatencyMs: number;
  createdAt: Date;
}

/**
 * A prefetch prediction — what memories to pre-warm.
 */
export interface PrefetchPrediction {
  predictionId: string;
  tenantId: string;
  userId: string;
  /** Predicted node IDs to prefetch */
  predictedNodeIds: string[];
  /** Confidence per prediction (0-1) */
  confidences: number[];
  /** Features that drove the prediction */
  features: PrefetchFeatures;
  /** Whether the prediction was actually used (for feedback loop) */
  wasUsed?: boolean;
  /** Prediction latency */
  predictionLatencyMs: number;
  createdAt: Date;
}

export interface PrefetchFeatures {
  hourOfDay: number;
  dayOfWeek: number;
  recentTopics: string[];
  sessionAge: number;
  lastAccessedNodeIds: string[];
  userActivityLevel: 'low' | 'medium' | 'high';
}

/**
 * Prefetch configuration per tenant.
 */
export interface PrefetchConfig {
  tenantId: string;
  enabled: boolean;
  /** Maximum nodes to prefetch per prediction cycle */
  maxPrefetchNodes: number;
  /** Minimum confidence to trigger prefetch */
  minPrefetchConfidence: number;
  /** How often to run prediction (seconds) */
  predictionIntervalSec: number;
  /** Whether to use time-of-day features */
  useTemporalFeatures: boolean;
  /** Whether to use topic trajectory features */
  useTopicFeatures: boolean;
  /** Maximum prefetch cache size (entries) */
  maxCacheSize: number;
  /** Prefetch cache TTL (seconds) */
  cacheTtlSec: number;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// 3. MEMORY CONTRADICTION DETECTOR
// =============================================================================

/**
 * A detected contradiction between two memory facts.
 */
export interface MemoryContradiction {
  contradictionId: string;
  tenantId: string;
  userId: string;
  /** The new fact that triggered the contradiction */
  newFactNodeId: string;
  newFactText: string;
  newFactSource: string;
  newFactDate: Date;
  /** The existing fact that contradicts the new one */
  existingFactNodeId: string;
  existingFactText: string;
  existingFactSource: string;
  existingFactDate: Date;
  /** Type of contradiction */
  contradictionType: ContradictionType;
  /** Severity (0-1, where 1 = complete contradiction) */
  severity: number;
  /** Explanation of the contradiction */
  explanation: string;
  /** Current resolution status */
  status: ContradictionStatus;
  /** How it was resolved */
  resolution?: ContradictionResolution;
  /** Confidence in the contradiction detection (0-1) */
  detectionConfidence: number;
  createdAt: Date;
  resolvedAt?: Date;
}

export type ContradictionType =
  | 'factual'          // Direct factual conflict (e.g., "uses React" vs "uses Vue")
  | 'temporal'         // Timeline inconsistency (e.g., "started in 2020" vs "started in 2022")
  | 'preference'       // Changed preference (e.g., "prefers tabs" vs "prefers spaces")
  | 'relationship'     // Relationship conflict (e.g., "works at X" vs "works at Y")
  | 'quantitative'     // Numeric conflict (e.g., "team of 5" vs "team of 20")
  | 'sentiment';       // Sentiment shift (e.g., "loves Python" vs "frustrated with Python")

export type ContradictionStatus =
  | 'detected'         // Just found, not yet resolved
  | 'auto_resolved'    // Automatically resolved by recency/confidence rules
  | 'user_resolved'    // User explicitly chose which fact is correct
  | 'accepted'         // Both facts are valid (e.g., preference changed over time)
  | 'dismissed';       // False positive, not actually a contradiction

export interface ContradictionResolution {
  method: 'recency' | 'confidence' | 'user_choice' | 'both_valid' | 'dismissed';
  /** Which fact won (new or existing) */
  winner: 'new' | 'existing' | 'both' | 'neither';
  /** User's explanation if user_choice */
  userExplanation?: string;
  resolvedBy: string; // 'system' or userId
  resolvedAt: Date;
}

/**
 * Contradiction detection configuration per tenant.
 */
export interface ContradictionConfig {
  tenantId: string;
  enabled: boolean;
  /** Minimum similarity threshold to consider two facts as potentially contradictory */
  minSimilarityForCheck: number;
  /** Auto-resolve by recency if confidence gap > this threshold */
  autoResolveConfidenceGap: number;
  /** Auto-resolve by recency if time gap > this many days */
  autoResolveRecencyDays: number;
  /** Whether to prompt users to resolve contradictions */
  promptUserResolution: boolean;
  /** Maximum unresolved contradictions before alerting admin */
  maxUnresolvedAlert: number;
  /** Model to use for contradiction detection */
  detectionModel: string;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// 4. ORGANIZATIONAL MEMORY MESH
// =============================================================================

/**
 * Privacy tier for organizational memory.
 * Controls who can see and contribute to shared knowledge.
 * 
 * REGULATORY COMPLIANCE DESIGN:
 * - All shared memories require explicit consent (GDPR Art. 6/7)
 * - Data classification labels for HIPAA PHI detection
 * - Audit trail for every access and modification (SOC2)
 * - Right-to-erasure cascades through all tiers
 * - Consent can be revoked at any time
 * - No PHI/PII crosses privacy tier boundaries without classification check
 */
export type MemoryPrivacyTier =
  | 'personal'    // Only visible to the owning user
  | 'team'        // Visible to users in the same team/group
  | 'department'  // Visible to department-level users
  | 'org'         // Visible to all tenant users
  | 'public';     // Visible across tenants (extremely rare, requires admin approval)

/**
 * Data classification for regulatory compliance.
 * Every shared memory MUST have a classification before crossing privacy boundaries.
 * 
 * Named MemoryDataClassification to avoid conflict with DataClassification in
 * decision-artifact.types.ts (which has only 4 levels). This type adds PHI/PII
 * categories required for HIPAA compliance in memory sharing.
 */
export type MemoryDataClassification =
  | 'public'              // No restrictions
  | 'internal'            // Internal business information
  | 'confidential'        // Restricted access, business sensitive
  | 'highly_confidential' // PII, financial, strategic
  | 'phi'                 // HIPAA Protected Health Information
  | 'pii'                 // Personally Identifiable Information
  | 'restricted';         // Regulatory restricted (legal hold, etc.)

/**
 * A shared organizational memory node.
 * Derived from individual user knowledge with consent.
 */
export interface OrgMemoryNode {
  nodeId: string;
  tenantId: string;
  /** Privacy tier controlling visibility */
  privacyTier: MemoryPrivacyTier;
  /** Data classification for regulatory compliance */
  dataClassification: MemoryDataClassification;
  /** Team/department scope (for team/department tier) */
  scopeId?: string;
  /** The shared knowledge content */
  label: string;
  entityType: AKGEntityType;
  properties: Record<string, unknown>;
  /** Embedding for semantic search */
  embedding?: number[];
  /** Aggregated confidence from all contributing users */
  confidence: number;
  /** Number of users who contributed to this knowledge */
  contributorCount: number;
  /** Importance based on contributor count and recency */
  importance: number;
  /** Whether this node has been reviewed by an admin */
  adminReviewed: boolean;
  /** Whether PHI/PII scan has passed */
  complianceScanPassed: boolean;
  /** Last compliance scan date */
  lastComplianceScanAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Consent record for organizational memory sharing.
 * GDPR Art. 6(1)(a) — explicit consent for data processing.
 * Every user must consent before their memories contribute to org knowledge.
 */
export interface OrgMemoryConsent {
  consentId: string;
  tenantId: string;
  userId: string;
  /** What privacy tiers this user consents to share at */
  consentedTiers: MemoryPrivacyTier[];
  /** What data classifications this user allows to be shared */
  allowedClassifications: MemoryDataClassification[];
  /** What entity types this user allows to be shared */
  allowedEntityTypes: AKGEntityType[];
  /** Whether consent is currently active */
  isActive: boolean;
  /** GDPR: purpose of processing */
  processingPurpose: string;
  /** GDPR: legal basis */
  legalBasis: 'consent' | 'legitimate_interest' | 'contract' | 'legal_obligation';
  /** When consent was given */
  consentedAt: Date;
  /** When consent was last renewed */
  renewedAt?: Date;
  /** When consent was revoked (null = still active) */
  revokedAt?: Date;
  /** IP address at time of consent (for audit) */
  consentIpAddress?: string;
  /** User agent at time of consent */
  consentUserAgent?: string;
}

/**
 * Contribution record — tracks which user memories became org memories.
 * Required for GDPR right-to-erasure cascade.
 */
export interface OrgMemoryContribution {
  contributionId: string;
  tenantId: string;
  /** The user who contributed */
  userId: string;
  /** The user's personal AKG node that was shared */
  sourceNodeId: string;
  /** The org memory node that was created/updated */
  orgNodeId: string;
  /** The consent record that authorized this sharing */
  consentId: string;
  /** What was contributed (for audit trail) */
  contributedContent: string;
  /** Whether this contribution has been anonymized */
  isAnonymized: boolean;
  /** Whether this contribution was auto-shared or manually shared */
  sharingMethod: 'auto_twilight' | 'manual_share' | 'admin_promoted';
  createdAt: Date;
}

/**
 * Compliance audit log for org memory operations.
 * SOC2 Type II requirement: all data access and modifications must be logged.
 */
export interface OrgMemoryAuditEntry {
  auditId: string;
  tenantId: string;
  userId: string;
  /** What action was performed */
  action: OrgMemoryAuditAction;
  /** Target node */
  targetNodeId?: string;
  /** Details of the action */
  details: Record<string, unknown>;
  /** Regulatory framework this entry satisfies */
  complianceFramework: ('gdpr' | 'hipaa' | 'soc2' | 'ccpa')[];
  /** IP address of the actor */
  ipAddress?: string;
  createdAt: Date;
}

export type OrgMemoryAuditAction =
  | 'consent_granted'
  | 'consent_revoked'
  | 'memory_shared'
  | 'memory_accessed'
  | 'memory_modified'
  | 'memory_deleted'
  | 'erasure_requested'
  | 'erasure_completed'
  | 'compliance_scan'
  | 'admin_review'
  | 'classification_changed'
  | 'privacy_tier_changed'
  | 'phi_detected'
  | 'pii_detected';

/**
 * Organizational Memory Mesh configuration per tenant.
 */
export interface OrgMemoryConfig {
  tenantId: string;
  enabled: boolean;
  /** Require explicit consent from every user (recommended: true) */
  requireExplicitConsent: boolean;
  /** Default privacy tier for auto-shared memories */
  defaultPrivacyTier: MemoryPrivacyTier;
  /** Minimum number of contributors before org memory becomes visible */
  minContributorsForVisibility: number;
  /** Whether to auto-anonymize contributions */
  autoAnonymize: boolean;
  /** Whether to run PHI/PII scan before sharing */
  runComplianceScan: boolean;
  /** HIPAA compliance mode (stricter rules) */
  hipaaMode: boolean;
  /** Maximum org memory nodes per tenant */
  maxOrgNodes: number;
  /** Whether admins must review before memory becomes visible */
  requireAdminReview: boolean;
  /** Auto-share during Twilight Dreaming */
  autoShareDuringDreaming: boolean;
  /** Data retention period (days, 0 = indefinite) */
  retentionDays: number;
  /** Consent renewal interval (days, 0 = no renewal required) */
  consentRenewalDays: number;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// 5. DREAM INSIGHT GENERATOR
// =============================================================================

/**
 * An insight generated during Twilight Dreaming by analyzing memory patterns.
 */
export interface DreamInsight {
  insightId: string;
  tenantId: string;
  userId: string;
  /** Type of insight discovered */
  insightType: InsightType;
  /** Human-readable title */
  title: string;
  /** Detailed insight description */
  description: string;
  /** The evidence that supports this insight (node/edge references) */
  evidence: InsightEvidence[];
  /** Actionable recommendation (if applicable) */
  recommendation?: string;
  /** Confidence in the insight (0-1) */
  confidence: number;
  /** Relevance score (0-1) based on user's current context */
  relevance: number;
  /** Priority for surfacing (higher = surface sooner) */
  priority: number;
  /** Whether this insight has been surfaced to the user */
  surfaced: boolean;
  /** User's reaction to the insight (if surfaced) */
  userReaction?: InsightReaction;
  /** When this insight was generated */
  generatedDuringDreamCycle: string;
  /** Model used to generate the insight */
  modelUsed: string;
  /** Tokens consumed generating this insight */
  tokensUsed: number;
  createdAt: Date;
  surfacedAt?: Date;
}

export type InsightType =
  | 'pattern'            // Recurring behavioral pattern detected
  | 'trend'              // Trend over time (e.g., "increasing interest in Rust")
  | 'connection'         // Non-obvious connection between topics
  | 'knowledge_gap'      // Identified gap in user's knowledge graph
  | 'optimization'       // Suggestion to improve workflow/process
  | 'prediction'         // Predicted future need based on trajectory
  | 'contradiction'      // Surfacing an unresolved contradiction
  | 'milestone'          // Recognizing an achievement or milestone
  | 'risk'               // Potential risk identified from patterns
  | 'opportunity';       // Opportunity identified from knowledge gaps + trends

export interface InsightEvidence {
  /** AKG node or edge that supports this insight */
  sourceId: string;
  sourceType: 'node' | 'edge' | 'conversation' | 'pattern';
  /** Relevant text excerpt */
  excerpt: string;
  /** When this evidence was collected */
  timestamp: Date;
  /** Contribution weight to the insight (0-1) */
  weight: number;
}

export type InsightReaction =
  | 'helpful'            // User found it useful
  | 'obvious'            // Already knew this
  | 'irrelevant'         // Not applicable
  | 'incorrect'          // Wrong insight
  | 'acknowledged';      // Seen but no strong reaction

/**
 * Dream Insight Generator configuration per tenant.
 */
export interface DreamInsightConfig {
  tenantId: string;
  enabled: boolean;
  /** Model to use for insight generation */
  insightModel: string;
  /** Maximum insights to generate per dream cycle */
  maxInsightsPerCycle: number;
  /** Minimum confidence to persist an insight */
  minInsightConfidence: number;
  /** Maximum tokens to spend on insight generation per cycle */
  maxTokensPerCycle: number;
  /** Insight types to generate (empty = all) */
  enabledInsightTypes: InsightType[];
  /** Whether to proactively surface insights in conversations */
  proactiveSurfacing: boolean;
  /** Maximum unsurfaced insights before stopping generation */
  maxUnsurfacedInsights: number;
  /** Whether to include org memory in analysis */
  analyzeOrgMemory: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// AGGREGATED DASHBOARD TYPES
// =============================================================================

/**
 * Dashboard metrics for the Anticipatory Memory system.
 */
export interface AnticipatoryMemoryDashboard {
  tenantId: string;
  /** AKG stats */
  akg: {
    totalNodes: number;
    totalEdges: number;
    uniqueUsers: number;
    nodesByType: Record<AKGEntityType, number>;
    edgesByType: Record<AKGRelationshipType, number>;
    avgNodesPerUser: number;
    extractionSuccessRate: number;
    lastExtractionAt?: Date;
  };
  /** Prefetch stats */
  prefetch: {
    totalPredictions: number;
    predictionAccuracy: number;
    avgPrefetchLatencyMs: number;
    cacheHitRate: number;
    memoriesPrefetched: number;
    tokenseSaved: number;
  };
  /** Contradiction stats */
  contradictions: {
    totalDetected: number;
    unresolvedCount: number;
    autoResolvedCount: number;
    userResolvedCount: number;
    avgResolutionTimeHours: number;
    detectionAccuracy: number;
  };
  /** Org memory stats */
  orgMemory: {
    totalOrgNodes: number;
    activeConsents: number;
    totalContributions: number;
    complianceScansPassed: number;
    complianceScansFailed: number;
    nodesByPrivacyTier: Record<MemoryPrivacyTier, number>;
    nodesByClassification: Record<MemoryDataClassification, number>;
  };
  /** Dream insight stats */
  dreamInsights: {
    totalInsightsGenerated: number;
    insightsSurfaced: number;
    insightsHelpful: number;
    insightsByType: Record<InsightType, number>;
    avgConfidence: number;
    tokensConsumedTotal: number;
    lastDreamCycleAt?: Date;
  };
  /** Overall health */
  health: {
    akgHealthy: boolean;
    prefetchHealthy: boolean;
    contradictionDetectorHealthy: boolean;
    orgMemoryHealthy: boolean;
    dreamInsightHealthy: boolean;
    overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  };
  generatedAt: Date;
}
