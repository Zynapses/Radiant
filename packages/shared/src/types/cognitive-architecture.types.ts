// Cognitive Architecture Types
// Advanced reasoning capabilities: Tree of Thoughts, GraphRAG, Deep Research,
// Dynamic LoRA, and Generative UI

// ============================================================================
// 1. TREE OF THOUGHTS (System 2 Reasoning)
// ============================================================================

export type ThoughtNodeStatus = 'pending' | 'evaluating' | 'selected' | 'pruned' | 'terminal';

export interface ThoughtNode {
  id: string;
  parentId: string | null;
  depth: number;
  thought: string;
  score: number; // 0-1, evaluated by scoring model
  confidence: number;
  reasoning: string; // Why this thought was generated
  children: ThoughtNode[];
  status: ThoughtNodeStatus;
  evaluationModel?: string;
  tokenCount: number;
  createdAt: Date;
}

export interface ReasoningTree {
  id: string;
  tenantId: string;
  userId: string;
  planId?: string;
  
  // Problem
  originalPrompt: string;
  problemType: 'math' | 'logic' | 'planning' | 'code' | 'analysis' | 'general';
  
  // Tree structure
  rootNode: ThoughtNode;
  totalNodes: number;
  maxDepth: number;
  branchingFactor: number; // Thoughts per branch (default: 3)
  
  // Configuration
  config: TreeOfThoughtsConfig;
  
  // Search state
  currentBestPath: string[]; // Node IDs
  currentBestScore: number;
  exploredPaths: number;
  prunedPaths: number;
  
  // Time budget
  thinkingTimeMs: number; // User-specified thinking time
  elapsedTimeMs: number;
  
  // Result
  finalAnswer?: string;
  finalConfidence?: number;
  
  status: 'thinking' | 'complete' | 'timeout' | 'error';
  startedAt: Date;
  completedAt?: Date;
}

export interface TreeOfThoughtsConfig {
  enabled: boolean;
  maxDepth: number; // Default: 5
  branchingFactor: number; // Default: 3
  pruneThreshold: number; // Score below which to prune (default: 0.3)
  selectionStrategy: 'greedy' | 'beam' | 'mcts'; // Default: beam
  beamWidth: number; // For beam search (default: 2)
  mctsIterations: number; // For MCTS (default: 100)
  scoringModel: string; // Model for evaluation
  generationModel: string; // Model for thought generation
  defaultThinkingTimeMs: number; // Default: 30000 (30 seconds)
  maxThinkingTimeMs: number; // Max allowed (default: 300000 = 5 min)
  problemTypes: ('math' | 'logic' | 'planning' | 'code' | 'analysis' | 'general')[];
}

export const DEFAULT_TOT_CONFIG: TreeOfThoughtsConfig = {
  enabled: true,
  maxDepth: 5,
  branchingFactor: 3,
  pruneThreshold: 0.3,
  selectionStrategy: 'beam',
  beamWidth: 2,
  mctsIterations: 100,
  scoringModel: 'gpt-4o-mini',
  generationModel: 'gpt-4o',
  defaultThinkingTimeMs: 30000,
  maxThinkingTimeMs: 300000,
  problemTypes: ['math', 'logic', 'planning', 'code', 'analysis'],
};

// ============================================================================
// 2. GRAPHRAG (Structured Knowledge Mapping)
// ============================================================================

export type EntityType = 
  | 'person' | 'organization' | 'document' | 'concept' 
  | 'event' | 'location' | 'product' | 'technology'
  | 'metric' | 'date' | 'custom';

export type RelationshipType =
  | 'authored_by' | 'depends_on' | 'blocked_by' | 'related_to'
  | 'part_of' | 'caused_by' | 'precedes' | 'follows'
  | 'mentions' | 'contradicts' | 'supports' | 'defines'
  | 'located_in' | 'works_for' | 'owns' | 'custom';

export interface KnowledgeEntity {
  id: string;
  tenantId: string;
  type: EntityType;
  name: string;
  description?: string;
  properties: Record<string, unknown>;
  sourceDocumentIds: string[];
  embedding?: number[]; // For hybrid search
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeRelationship {
  id: string;
  tenantId: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: RelationshipType;
  description?: string;
  weight: number; // 0-1, strength of relationship
  properties: Record<string, unknown>;
  sourceDocumentIds: string[];
  confidence: number;
  createdAt: Date;
}

export interface KnowledgeTriple {
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  sourceChunk?: string;
}

export interface GraphQuery {
  startEntities: string[]; // Entity names or IDs to start from
  maxHops: number; // How many relationship hops (default: 3)
  relationshipTypes?: RelationshipType[];
  entityTypes?: EntityType[];
  minConfidence?: number;
  limit?: number;
}

export interface GraphQueryResult {
  entities: KnowledgeEntity[];
  relationships: KnowledgeRelationship[];
  paths: {
    nodes: string[];
    relationships: string[];
    totalWeight: number;
  }[];
  reasoning: string; // Natural language explanation of connections
}

export interface GraphRAGConfig {
  enabled: boolean;
  extractionModel: string; // Model for entity/relationship extraction
  maxEntitiesPerDocument: number;
  maxRelationshipsPerDocument: number;
  minConfidenceThreshold: number;
  enableHybridSearch: boolean; // Combine graph + vector
  graphWeight: number; // Weight for graph results (0-1)
  vectorWeight: number; // Weight for vector results (0-1)
  maxHops: number;
  neptuneclusterEndpoint?: string;
}

export const DEFAULT_GRAPHRAG_CONFIG: GraphRAGConfig = {
  enabled: true,
  extractionModel: 'gpt-4o-mini',
  maxEntitiesPerDocument: 50,
  maxRelationshipsPerDocument: 100,
  minConfidenceThreshold: 0.7,
  enableHybridSearch: true,
  graphWeight: 0.6,
  vectorWeight: 0.4,
  maxHops: 3,
};

// ============================================================================
// 3. DEEP RESEARCH AGENTS
// ============================================================================

export type ResearchJobStatus = 
  | 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export type ResearchSourceType = 
  | 'web' | 'pdf' | 'api' | 'database' | 'internal_docs';

export interface ResearchSource {
  id: string;
  type: ResearchSourceType;
  url?: string;
  title: string;
  content?: string;
  summary?: string;
  relevanceScore: number;
  credibilityScore: number;
  extractedAt: Date;
  metadata: Record<string, unknown>;
}

export interface ResearchJob {
  id: string;
  tenantId: string;
  userId: string;
  
  // Query
  query: string;
  researchType: 'competitive_analysis' | 'market_research' | 'technical_review' | 
                'literature_review' | 'fact_check' | 'general';
  scope: 'narrow' | 'medium' | 'broad';
  
  // Configuration
  config: DeepResearchConfig;
  
  // Progress
  status: ResearchJobStatus;
  progress: number; // 0-100
  currentPhase: 'planning' | 'gathering' | 'analyzing' | 'synthesizing' | 'reviewing';
  
  // Sources
  sourcesFound: number;
  sourcesProcessed: number;
  sources: ResearchSource[];
  
  // Output
  briefingDocument?: string;
  executiveSummary?: string;
  keyFindings?: string[];
  recommendations?: string[];
  
  // Timing
  estimatedCompletionMs: number;
  actualDurationMs?: number;
  queuedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  
  // Notification
  notificationSent: boolean;
  notificationChannel: 'email' | 'push' | 'in_app';
}

export interface DeepResearchConfig {
  enabled: boolean;
  maxSources: number;
  maxDepth: number; // Recursive link following depth
  maxDurationMs: number;
  allowedSourceTypes: ResearchSourceType[];
  requireCredibleSources: boolean;
  minSourceCredibility: number;
  browserAgent: 'playwright' | 'puppeteer';
  parallelRequests: number;
  respectRobotsTxt: boolean;
  outputFormat: 'markdown' | 'html' | 'pdf';
}

export const DEFAULT_RESEARCH_CONFIG: DeepResearchConfig = {
  enabled: true,
  maxSources: 50,
  maxDepth: 2,
  maxDurationMs: 1800000, // 30 minutes
  allowedSourceTypes: ['web', 'pdf', 'api'],
  requireCredibleSources: true,
  minSourceCredibility: 0.6,
  browserAgent: 'playwright',
  parallelRequests: 5,
  respectRobotsTxt: true,
  outputFormat: 'markdown',
};

// ============================================================================
// 4. DYNAMIC LORA SWAPPING
// ============================================================================

export type LoRADomain = 
  | 'legal' | 'medical' | 'financial' | 'scientific'
  | 'coding' | 'creative_writing' | 'translation'
  | 'customer_support' | 'technical_writing' | 'custom';

export interface LoRAAdapter {
  id: string;
  tenantId?: string; // null = global
  
  // Identification
  name: string;
  description: string;
  domain: LoRADomain;
  subdomain?: string; // e.g., "california_property_law"
  
  // Storage
  s3Bucket: string;
  s3Key: string;
  sizeBytes: number;
  checksum: string;
  
  // Compatibility
  baseModel: string; // e.g., "llama-3-70b"
  rank: number; // LoRA rank (e.g., 16, 32, 64)
  alpha: number; // LoRA alpha
  targetModules: string[]; // Which layers (e.g., ["q_proj", "v_proj"])
  
  // Performance
  benchmarkScore?: number;
  avgLatencyMs?: number;
  loadTimeMs?: number;
  
  // Usage
  timesLoaded: number;
  lastLoadedAt?: Date;
  
  // Status
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoRALoadRequest {
  adapterId: string;
  baseModelEndpoint: string;
  priority: 'low' | 'normal' | 'high';
}

export interface LoRALoadResult {
  success: boolean;
  adapterId: string;
  loadTimeMs: number;
  error?: string;
}

export interface DynamicLoRAConfig {
  enabled: boolean;
  registryBucket: string;
  cacheSize: number; // How many adapters to keep in memory
  preloadDomains: LoRADomain[]; // Domains to preload
  maxLoadTimeMs: number;
  fallbackToBase: boolean; // If adapter load fails, use base model
  autoSelectByDomain: boolean; // Auto-select adapter based on detected domain
}

export const DEFAULT_LORA_CONFIG: DynamicLoRAConfig = {
  enabled: false, // Requires SageMaker setup
  registryBucket: 'radiant-lora-adapters',
  cacheSize: 5,
  preloadDomains: ['coding', 'legal'],
  maxLoadTimeMs: 5000,
  fallbackToBase: true,
  autoSelectByDomain: true,
};

// ============================================================================
// 5. GENERATIVE UI (App Factory)
// ============================================================================

export type UIComponentType = 
  | 'chart' | 'table' | 'calculator' | 'form' | 'timeline'
  | 'comparison' | 'diagram' | 'map' | 'kanban' | 'calendar'
  | 'code_editor' | 'markdown_viewer' | 'image_gallery' | 'custom';

export interface UIComponentSchema {
  id: string;
  type: UIComponentType;
  title: string;
  description?: string;
  
  // Data
  data: unknown;
  dataSchema?: Record<string, unknown>; // JSON Schema for data
  
  // Interactivity
  interactive: boolean;
  inputs?: UIInput[];
  outputs?: UIOutput[];
  
  // Styling
  width?: 'small' | 'medium' | 'large' | 'full';
  height?: 'auto' | 'small' | 'medium' | 'large';
  theme?: 'light' | 'dark' | 'auto';
  
  // Component-specific config
  config: Record<string, unknown>;
}

export interface UIInput {
  id: string;
  label: string;
  type: 'text' | 'number' | 'slider' | 'select' | 'checkbox' | 'date' | 'color';
  defaultValue?: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: unknown }[];
  required?: boolean;
}

export interface UIOutput {
  id: string;
  label: string;
  type: 'text' | 'number' | 'chart' | 'table';
  format?: string; // e.g., "currency", "percentage"
  computeFrom?: string; // Expression to compute from inputs
}

export interface GeneratedUI {
  id: string;
  tenantId: string;
  userId: string;
  conversationId?: string;
  messageId?: string;
  
  // Generation context
  prompt: string;
  generatedFrom: 'explicit_request' | 'auto_detected' | 'template';
  
  // Components
  components: UIComponentSchema[];
  layout: 'single' | 'grid' | 'tabs' | 'accordion';
  
  // Metadata
  generationModel: string;
  generationTimeMs: number;
  
  // User interaction
  interactionCount: number;
  lastInteractedAt?: Date;
  userRating?: number;
  
  createdAt: Date;
}

export interface GenerativeUIConfig {
  enabled: boolean;
  generationModel: string;
  allowedComponentTypes: UIComponentType[];
  maxComponentsPerResponse: number;
  autoDetectOpportunities: boolean; // Auto-generate UI when appropriate
  autoDetectTriggers: string[]; // Keywords that trigger UI generation
  defaultTheme: 'light' | 'dark' | 'auto';
}

export const DEFAULT_GENUI_CONFIG: GenerativeUIConfig = {
  enabled: true,
  generationModel: 'gpt-4o',
  allowedComponentTypes: ['chart', 'table', 'calculator', 'comparison', 'timeline'],
  maxComponentsPerResponse: 3,
  autoDetectOpportunities: true,
  autoDetectTriggers: ['compare', 'calculate', 'visualize', 'chart', 'table', 'timeline'],
  defaultTheme: 'auto',
};

// ============================================================================
// UNIFIED COGNITIVE ARCHITECTURE CONFIG
// ============================================================================

export interface CognitiveArchitectureConfig {
  treeOfThoughts: TreeOfThoughtsConfig;
  graphRAG: GraphRAGConfig;
  deepResearch: DeepResearchConfig;
  dynamicLoRA: DynamicLoRAConfig;
  generativeUI: GenerativeUIConfig;
}

export const DEFAULT_COGNITIVE_CONFIG: CognitiveArchitectureConfig = {
  treeOfThoughts: DEFAULT_TOT_CONFIG,
  graphRAG: DEFAULT_GRAPHRAG_CONFIG,
  deepResearch: DEFAULT_RESEARCH_CONFIG,
  dynamicLoRA: DEFAULT_LORA_CONFIG,
  generativeUI: DEFAULT_GENUI_CONFIG,
};
