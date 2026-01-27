/**
 * RADIANT Cortex Graph-RAG Knowledge Engine Types
 * 
 * Graph-based Retrieval Augmented Generation for persistent knowledge
 * with entity relationships, temporal awareness, and multi-tenant isolation.
 */

// ============================================================================
// KNOWLEDGE GRAPH ENTITIES
// ============================================================================

export type CortexEntityType = 
  | 'person'
  | 'organization'
  | 'concept'
  | 'event'
  | 'location'
  | 'document'
  | 'topic'
  | 'skill'
  | 'project'
  | 'product'
  | 'custom';

export interface CortexKnowledgeEntity {
  id: string;
  tenantId: string;
  type: CortexEntityType;
  name: string;
  description?: string;
  aliases?: string[];
  properties: Record<string, unknown>;
  embedding?: number[];
  embeddingModel?: string;
  confidence: number;
  source: EntitySource;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt?: string;
  accessCount: number;
  isActive: boolean;
}

export interface EntitySource {
  type: 'conversation' | 'document' | 'api' | 'manual' | 'inference';
  id?: string;
  url?: string;
  timestamp: string;
  userId?: string;
}

// ============================================================================
// KNOWLEDGE GRAPH RELATIONSHIPS
// ============================================================================

export type CortexRelationshipType =
  | 'is_a'
  | 'part_of'
  | 'related_to'
  | 'works_for'
  | 'located_in'
  | 'created_by'
  | 'mentioned_in'
  | 'depends_on'
  | 'similar_to'
  | 'opposite_of'
  | 'causes'
  | 'follows'
  | 'precedes'
  | 'custom';

export interface CortexKnowledgeRelationship {
  id: string;
  tenantId: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: CortexRelationshipType;
  customType?: string;
  weight: number;
  confidence: number;
  properties: Record<string, unknown>;
  bidirectional: boolean;
  validFrom?: string;
  validUntil?: string;
  source: EntitySource;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// KNOWLEDGE CHUNKS (for RAG retrieval)
// ============================================================================

export interface KnowledgeChunk {
  id: string;
  tenantId: string;
  entityId?: string;
  content: string;
  contentHash: string;
  embedding: number[];
  embeddingModel: string;
  metadata: ChunkMetadata;
  source: EntitySource;
  createdAt: string;
  updatedAt: string;
}

export interface ChunkMetadata {
  documentId?: string;
  conversationId?: string;
  messageId?: string;
  pageNumber?: number;
  sectionTitle?: string;
  language?: string;
  wordCount: number;
  tokenCount: number;
}

// ============================================================================
// GRAPH QUERIES & RETRIEVAL
// ============================================================================

export interface CortexGraphQuery {
  query: string;
  tenantId: string;
  userId?: string;
  filters?: CortexGraphQueryFilters;
  options?: CortexGraphQueryOptions;
}

export interface CortexGraphQueryFilters {
  entityTypes?: CortexEntityType[];
  relationshipTypes?: CortexRelationshipType[];
  dateRange?: {
    start: string;
    end: string;
  };
  minConfidence?: number;
  sources?: string[];
  excludeEntityIds?: string[];
}

export interface CortexGraphQueryOptions {
  maxResults?: number;
  maxDepth?: number;
  includeRelationships?: boolean;
  includeChunks?: boolean;
  embeddingSearch?: boolean;
  hybridSearch?: boolean;
  rerank?: boolean;
}

export interface CortexGraphQueryResult {
  entities: CortexKnowledgeEntity[];
  relationships: CortexKnowledgeRelationship[];
  chunks: KnowledgeChunk[];
  subgraph?: CortexGraphSubgraph;
  queryEmbedding?: number[];
  processingTimeMs: number;
  totalMatches: number;
}

export interface CortexGraphSubgraph {
  nodes: CortexGraphNode[];
  edges: CortexGraphEdge[];
}

export interface CortexGraphNode {
  id: string;
  type: CortexEntityType;
  label: string;
  properties: Record<string, unknown>;
  relevanceScore: number;
}

export interface CortexGraphEdge {
  id: string;
  source: string;
  target: string;
  type: CortexRelationshipType;
  label: string;
  weight: number;
}

// ============================================================================
// KNOWLEDGE INGESTION
// ============================================================================

export interface IngestRequest {
  tenantId: string;
  userId?: string;
  source: IngestSource;
  options?: IngestOptions;
}

export interface IngestSource {
  type: 'text' | 'document' | 'url' | 'conversation';
  content?: string;
  documentId?: string;
  url?: string;
  conversationId?: string;
  metadata?: Record<string, unknown>;
}

export interface IngestOptions {
  extractEntities?: boolean;
  extractRelationships?: boolean;
  createChunks?: boolean;
  chunkSize?: number;
  chunkOverlap?: number;
  embeddingModel?: string;
  entityExtractionModel?: string;
  deduplicateEntities?: boolean;
  mergeThreshold?: number;
}

export interface IngestResult {
  success: boolean;
  entitiesCreated: number;
  entitiesMerged: number;
  relationshipsCreated: number;
  chunksCreated: number;
  errors?: string[];
  processingTimeMs: number;
}

// ============================================================================
// CORTEX CONFIGURATION
// ============================================================================

export interface CortexConfig {
  id: string;
  tenantId: string;
  
  // Feature toggles
  enableGraphRag: boolean;
  enableEntityExtraction: boolean;
  enableRelationshipInference: boolean;
  enableTemporalTracking: boolean;
  enableAutoMerge: boolean;
  
  // Model configuration
  embeddingModel: string;
  embeddingDimensions: number;
  entityExtractionModel: string;
  rerankingModel?: string;
  
  // Chunking configuration
  defaultChunkSize: number;
  defaultChunkOverlap: number;
  maxChunksPerDocument: number;
  
  // Retrieval configuration
  defaultMaxResults: number;
  defaultMaxDepth: number;
  minRelevanceScore: number;
  hybridSearchAlpha: number;
  
  // Maintenance
  autoCleanupEnabled: boolean;
  cleanupThresholdDays: number;
  maxEntitiesPerTenant: number;
  maxChunksPerTenant: number;
  
  updatedAt: string;
  updatedBy?: string;
}

// ============================================================================
// CORTEX DASHBOARD
// ============================================================================

export interface CortexDashboard {
  tenantId: string;
  config: CortexConfig;
  stats: CortexStats;
  recentActivity: CortexActivity[];
  topEntities: CortexEntitySummary[];
  graphHealth: CortexGraphHealth;
}

export interface CortexStats {
  totalEntities: number;
  totalRelationships: number;
  totalChunks: number;
  entitiesByType: Record<CortexEntityType, number>;
  relationshipsByType: Record<CortexRelationshipType, number>;
  averageConfidence: number;
  storageUsedBytes: number;
  queriesLast24h: number;
  ingestsLast24h: number;
}

export interface CortexActivity {
  id: string;
  type: 'query' | 'ingest' | 'entity_created' | 'entity_merged' | 'cleanup';
  description: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface CortexEntitySummary {
  id: string;
  type: CortexEntityType;
  name: string;
  relationshipCount: number;
  accessCount: number;
  lastAccessedAt?: string;
}

export interface CortexGraphHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  embeddingServiceStatus: 'up' | 'down' | 'degraded';
  vectorIndexStatus: 'synced' | 'syncing' | 'stale';
  lastSyncAt?: string;
  orphanedEntities: number;
  duplicateCandidates: number;
  issues?: string[];
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface CortexCreateEntityRequest {
  type: CortexEntityType;
  name: string;
  description?: string;
  aliases?: string[];
  properties?: Record<string, unknown>;
  source?: Partial<EntitySource>;
}

export interface UpdateEntityRequest {
  name?: string;
  description?: string;
  aliases?: string[];
  properties?: Record<string, unknown>;
  isActive?: boolean;
}

export interface CortexCreateRelationshipRequest {
  sourceEntityId: string;
  targetEntityId: string;
  type: CortexRelationshipType;
  customType?: string;
  weight?: number;
  properties?: Record<string, unknown>;
  bidirectional?: boolean;
  validFrom?: string;
  validUntil?: string;
}

export interface CortexSearchEntitiesRequest {
  query: string;
  types?: CortexEntityType[];
  limit?: number;
  offset?: number;
  includeInactive?: boolean;
}

export interface CortexSearchEntitiesResponse {
  entities: CortexKnowledgeEntity[];
  total: number;
  hasMore: boolean;
}

export interface CortexGetGraphNeighborsRequest {
  entityId: string;
  depth?: number;
  relationshipTypes?: CortexRelationshipType[];
  maxNodes?: number;
}

export interface MergeEntitiesRequest {
  primaryEntityId: string;
  secondaryEntityIds: string[];
  mergeStrategy?: 'keep_primary' | 'combine' | 'latest';
}
