/**
 * Reality Engine Types
 * 
 * The Reality Engine is the core runtime that powers Think Tank's supernatural capabilities:
 * - Morphic UI: Interface that shapeshifts to user intent
 * - Reality Scrubber: Time travel for logic and state
 * - Quantum Futures: Parallel reality branching and A/B testing
 * - Pre-Cognition: Speculative execution that anticipates user needs
 * 
 * @module @radiant/shared/types/reality-engine
 */

// =============================================================================
// MORPHIC UI (formerly Liquid Interface)
// "Stop hunting for the right tool. Radiant is a Morphic Surface that shapeshifts instantly."
// =============================================================================

export type MorphicMode = 
  | 'dormant'      // Chat mode, no active morph
  | 'morphing'     // Transition animation in progress
  | 'active'       // Morphed UI is live
  | 'dissolving';  // Returning to chat

export type MorphicIntent = 
  | 'data_analysis'    // → DataGrid, Charts
  | 'tracking'         // → Kanban, Calendar, Timeline
  | 'visualization'    // → Charts, Maps, Diagrams
  | 'planning'         // → GanttChart, Kanban, Calendar
  | 'calculation'      // → Calculator, Spreadsheet
  | 'design'           // → Whiteboard, MindMap
  | 'coding'           // → CodeEditor, Terminal
  | 'writing'          // → RichTextEditor, Markdown
  | 'finance'          // → Invoice, Ledger, Calculator
  | 'communication';   // → EmailComposer, ChatPanel

export interface MorphicComponent {
  id: string;
  name: string;
  displayName: string;
  category: MorphicComponentCategory;
  description: string;
  icon: string;
  schema: MorphicComponentSchema;
  defaultProps: Record<string, unknown>;
  ghostBindings: MorphicGhostBinding[];
  intentTriggers: MorphicIntent[];
  previewImageUrl?: string;
}

export type MorphicComponentCategory = 
  | 'data'           // DataGrid, Table, TreeView
  | 'visualization'  // Charts, Maps, Diagrams
  | 'productivity'   // Kanban, Calendar, Timeline
  | 'finance'        // Invoice, Ledger, Calculator
  | 'code'           // CodeEditor, Terminal, DiffViewer
  | 'ai'             // ChatPanel, SuggestionList
  | 'input'          // Forms, Sliders, Selectors
  | 'media'          // ImageGallery, VideoPlayer
  | 'layout';        // SplitPane, Tabs, Modal

export interface MorphicComponentSchema {
  type: 'object';
  properties: Record<string, MorphicPropertySchema>;
  required?: string[];
}

export interface MorphicPropertySchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  default?: unknown;
  enum?: string[];
  items?: MorphicPropertySchema;
  uiControl?: MorphicUIControl;
}

export type MorphicUIControl = 
  | { type: 'slider'; min: number; max: number; step: number }
  | { type: 'toggle' }
  | { type: 'select'; options: { label: string; value: string }[] }
  | { type: 'color' }
  | { type: 'text' }
  | { type: 'number' }
  | { type: 'date' }
  | { type: 'hidden' };

export interface MorphicGhostBinding {
  componentProp: string;
  contextKey: string;
  direction: 'ui_to_ai' | 'ai_to_ui' | 'bidirectional';
  debounceMs?: number;
  transform?: string; // JavaScript expression
}

export interface MorphicSession {
  id: string;
  tenantId: string;
  userId: string;
  conversationId: string;
  mode: MorphicMode;
  activeLayout: MorphicLayout | null;
  ghostState: MorphicGhostState;
  realityId: string; // Links to current reality timeline
  createdAt: Date;
  updatedAt: Date;
}

export interface MorphicLayout {
  id: string;
  type: 'single' | 'split' | 'grid' | 'stack';
  components: MorphicLayoutNode[];
  theme?: MorphicTheme;
}

export interface MorphicLayoutNode {
  id: string;
  componentId: string;
  componentType: string;
  props: Record<string, unknown>;
  position: { x: number; y: number; w: number; h: number };
  ghostBindings: MorphicGhostBinding[];
}

export interface MorphicGhostState {
  values: Record<string, unknown>;
  lastUpdated: Date;
  pendingAIReactions: MorphicAIReaction[];
}

export interface MorphicAIReaction {
  id: string;
  type: 'speak' | 'update' | 'morph' | 'suggest' | 'highlight';
  payload: unknown;
  priority: 'low' | 'medium' | 'high' | 'critical';
  expiresAt?: Date;
}

export interface MorphicTheme {
  mode: 'light' | 'dark' | 'system';
  primaryColor: string;
  accentColor: string;
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'full';
}

// =============================================================================
// REALITY SCRUBBER (formerly Chronos)
// "We replaced 'Undo' with Time Travel."
// =============================================================================

export interface RealitySnapshot {
  id: string;
  tenantId: string;
  userId: string;
  sessionId: string;
  realityId: string;
  timestamp: Date;
  label?: string;
  
  // State captures
  vfsHash: string;           // Virtual File System hash
  vfsSnapshot: Buffer | null; // Compressed VFS state (lazy loaded)
  dbSnapshot: Buffer | null;  // PGLite database snapshot
  ghostState: MorphicGhostState;
  chatContext: RealityChatContext;
  layoutState: MorphicLayout | null;
  
  // Metadata
  triggerEvent: RealityTriggerEvent;
  byteSize: number;
  isAutoSnapshot: boolean;
  isBookmarked: boolean;
  
  createdAt: Date;
}

export type RealityTriggerEvent = 
  | 'user_action'       // User explicitly triggered
  | 'ai_generation'     // AI generated content
  | 'db_mutation'       // Database was modified
  | 'file_change'       // VFS file was changed
  | 'morph_transition'  // UI morphed
  | 'branch_create'     // New quantum branch created
  | 'auto_interval'     // Automatic periodic snapshot
  | 'checkpoint';       // User-created bookmark

export interface RealityChatContext {
  messages: RealityChatMessage[];
  systemPrompt: string;
  activeToolCalls: string[];
}

export interface RealityChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface RealityTimeline {
  id: string;
  tenantId: string;
  userId: string;
  sessionId: string;
  
  // Timeline structure
  snapshots: RealityTimelinePoint[];
  currentPosition: number; // Index into snapshots
  
  // Branching
  parentTimelineId: string | null;
  branchPoint: number | null; // Index where this branched from parent
  childTimelineIds: string[];
  
  // Metadata
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RealityTimelinePoint {
  snapshotId: string;
  timestamp: Date;
  label?: string;
  triggerEvent: RealityTriggerEvent;
  isBookmarked: boolean;
  thumbnailUrl?: string; // Visual preview of UI state
}

export interface RealityScrubRequest {
  sessionId: string;
  targetSnapshotId?: string;
  targetTimestamp?: Date;
  targetPosition?: number; // Relative: -1 = previous, +1 = next
}

export interface RealityScrubResponse {
  success: boolean;
  previousPosition: number;
  newPosition: number;
  restoredSnapshot: RealitySnapshot;
  affectedComponents: string[];
  scrubDurationMs: number;
}

// =============================================================================
// QUANTUM FUTURES (formerly Multiverse)
// "Why choose one strategy? Split the timeline."
// =============================================================================

export interface QuantumBranch {
  id: string;
  tenantId: string;
  userId: string;
  sessionId: string;
  
  // Branch identity
  name: string;
  description?: string;
  color: string; // For visual distinction
  icon: string;
  
  // State
  timelineId: string;
  status: QuantumBranchStatus;
  
  // Comparison metrics
  metrics: QuantumBranchMetrics;
  
  // Relationship
  parentBranchId: string | null;
  siblingBranchIds: string[];
  
  createdAt: Date;
  updatedAt: Date;
  collapsedAt?: Date;
}

export type QuantumBranchStatus = 
  | 'active'      // Being worked on
  | 'paused'      // Temporarily inactive
  | 'comparing'   // Side-by-side comparison mode
  | 'winner'      // Selected as the winning reality
  | 'collapsed'   // Discarded/merged
  | 'archived';   // Stored in dream memory

export interface QuantumBranchMetrics {
  // Performance metrics
  completionRate: number;      // 0-1, how "done" is this branch
  complexityScore: number;     // Estimated complexity
  costEstimate: number;        // API/compute cost so far
  
  // Quality metrics
  validationErrors: number;
  warningCount: number;
  testsPassed: number;
  testsTotal: number;
  
  // User engagement
  interactionCount: number;
  timeSpentMs: number;
  lastInteraction: Date;
}

export interface QuantumSplit {
  id: string;
  sessionId: string;
  
  // The split configuration
  parentBranchId: string;
  prompt: string; // What caused the split
  
  // The resulting branches
  branches: QuantumBranch[];
  
  // UI state
  viewMode: QuantumViewMode;
  activeComparison: QuantumComparison | null;
  
  createdAt: Date;
}

export type QuantumViewMode = 
  | 'single'      // One branch visible
  | 'split'       // Two branches side-by-side
  | 'grid'        // Up to 4 branches in grid
  | 'timeline';   // All branches on timeline view

export interface QuantumComparison {
  leftBranchId: string;
  rightBranchId: string;
  diffHighlights: QuantumDiff[];
  syncScroll: boolean;
  showMetrics: boolean;
}

export interface QuantumDiff {
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  path: string; // Component or file path
  leftValue?: unknown;
  rightValue?: unknown;
  description: string;
}

export interface QuantumCollapseRequest {
  sessionId: string;
  winningBranchId: string;
  losingBranchIds: string[];
  archiveToMemory: boolean; // Store in dream/grimoire?
}

export interface QuantumCollapseResponse {
  success: boolean;
  collapsedBranchCount: number;
  archivedToMemoryId?: string;
  newActiveTimelineId: string;
}

// =============================================================================
// PRE-COGNITION (formerly Shadow Reasoning)
// "Radiant answers before you ask."
// =============================================================================

export interface PreCognitionPrediction {
  id: string;
  tenantId: string;
  userId: string;
  sessionId: string;
  
  // What was predicted
  predictedIntent: MorphicIntent;
  predictedPrompt: string;
  confidence: number; // 0-1
  
  // The pre-computed solution
  solution: PreCognitionSolution;
  
  // Lifecycle
  status: PreCognitionStatus;
  computeTimeMs: number;
  createdAt: Date;
  expiresAt: Date;
  usedAt?: Date;
}

export type PreCognitionStatus = 
  | 'computing'   // Being generated in background
  | 'ready'       // Available for instant delivery
  | 'used'        // User triggered, prediction was served
  | 'expired'     // TTL exceeded, discarded
  | 'superseded'; // Newer prediction replaced this

export interface PreCognitionSolution {
  type: 'morph' | 'code' | 'data' | 'action';
  
  // Pre-generated content
  morphLayout?: MorphicLayout;
  generatedCode?: PreCognitionCodeArtifact[];
  generatedData?: Record<string, unknown>;
  suggestedActions?: PreCognitionAction[];
  
  // Response ready to serve
  preRenderedResponse?: string;
  preRenderedUI?: string; // Serialized React component tree
}

export interface PreCognitionCodeArtifact {
  filename: string;
  language: string;
  content: string;
  vfsPath: string;
}

export interface PreCognitionAction {
  id: string;
  label: string;
  icon: string;
  type: 'button' | 'link' | 'menu';
  handler: string; // Action identifier
  priority: number;
}

export interface PreCognitionQueue {
  sessionId: string;
  predictions: PreCognitionPrediction[];
  maxSize: number;
  computeBudgetMs: number; // Max time to spend on predictions
  lastRefresh: Date;
}

export interface PreCognitionConfig {
  enabled: boolean;
  maxPredictions: number;           // How many futures to pre-compute
  predictionTTLMs: number;          // How long predictions stay valid
  computeBudgetMs: number;          // Time budget for background compute
  minConfidenceThreshold: number;   // Only cache predictions above this
  useGenesisModel: boolean;         // Use fast local model for predictions
  genesisModelId: string;           // Which Genesis model to use
}

// =============================================================================
// REALITY ENGINE CORE
// The unified runtime powering all supernatural capabilities
// =============================================================================

export interface RealityEngineSession {
  id: string;
  tenantId: string;
  userId: string;
  conversationId: string;
  
  // Current state
  morphicSession: MorphicSession;
  activeTimeline: RealityTimeline;
  activeBranch: QuantumBranch;
  preCognitionQueue: PreCognitionQueue;
  
  // Configuration
  config: RealityEngineConfig;
  
  // Metrics
  metrics: RealityEngineMetrics;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface RealityEngineConfig {
  // Feature toggles
  morphicUIEnabled: boolean;
  realityScrubberEnabled: boolean;
  quantumFuturesEnabled: boolean;
  preCognitionEnabled: boolean;
  
  // Behavior
  autoSnapshotIntervalMs: number;
  maxSnapshotsPerSession: number;
  maxBranchesPerSession: number;
  codeCurtainDefault: boolean; // Hide code by default
  ephemeralByDefault: boolean; // Apps dissolve when topic changes
  
  // Pre-Cognition
  preCognition: PreCognitionConfig;
}

export interface RealityEngineMetrics {
  // Usage
  totalScrubs: number;
  totalBranches: number;
  totalMorphs: number;
  preCognitionHits: number;
  preCognitionMisses: number;
  
  // Performance
  avgScrubTimeMs: number;
  avgMorphTimeMs: number;
  avgPredictionAccuracy: number;
  
  // Cost
  snapshotStorageBytes: number;
  computeTimeMs: number;
  estimatedCostCents: number;
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

export interface RealityEngineInitRequest {
  tenantId: string;
  userId: string;
  conversationId: string;
  config?: Partial<RealityEngineConfig>;
}

export interface RealityEngineInitResponse {
  session: RealityEngineSession;
  initialSnapshot: RealitySnapshot;
}

export interface MorphicMorphRequest {
  sessionId: string;
  intent?: MorphicIntent;
  prompt?: string;
  targetComponents?: string[];
  preserveState?: boolean;
}

export interface MorphicMorphResponse {
  success: boolean;
  layout: MorphicLayout;
  transitionDurationMs: number;
  ghostBindingsCreated: number;
  wasPreCognized: boolean; // Was this instant because of pre-cognition?
}

export interface QuantumSplitRequest {
  sessionId: string;
  prompt: string;
  branchNames: string[];
  branchDescriptions?: string[];
  autoCompare?: boolean;
}

export interface QuantumSplitResponse {
  success: boolean;
  split: QuantumSplit;
  branches: QuantumBranch[];
  comparisonReady: boolean;
}

// =============================================================================
// EJECT TYPES (Export to App)
// =============================================================================

export interface RealityEjectRequest {
  sessionId: string;
  branchId?: string; // Which quantum branch to eject
  framework: RealityEjectFramework;
  options: RealityEjectOptions;
}

export type RealityEjectFramework = 
  | 'nextjs'
  | 'vite'
  | 'remix'
  | 'astro';

export interface RealityEjectOptions {
  projectName: string;
  includeDatabase: boolean;      // Include PGLite → Postgres migration
  includeAI: boolean;            // Include AI integration code
  includeRealityScrubber: boolean; // Include time-travel in ejected app
  theme: MorphicTheme;
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun';
}

export interface RealityEjectResponse {
  success: boolean;
  projectId: string;
  files: RealityEjectFile[];
  totalFiles: number;
  totalBytes: number;
  downloadUrl?: string;
  deployUrl?: string;
}

export interface RealityEjectFile {
  path: string;
  content: string;
  language: string;
  isGenerated: boolean;
}

// =============================================================================
// EVENT TYPES
// =============================================================================

export type RealityEngineEvent = 
  | { type: 'morph_started'; layout: MorphicLayout }
  | { type: 'morph_completed'; layout: MorphicLayout; durationMs: number }
  | { type: 'snapshot_created'; snapshot: RealitySnapshot }
  | { type: 'scrub_started'; targetPosition: number }
  | { type: 'scrub_completed'; response: RealityScrubResponse }
  | { type: 'branch_created'; branch: QuantumBranch }
  | { type: 'branch_collapsed'; winnerId: string; losers: string[] }
  | { type: 'precognition_ready'; prediction: PreCognitionPrediction }
  | { type: 'precognition_used'; predictionId: string; latencyMs: number }
  | { type: 'ghost_update'; key: string; value: unknown }
  | { type: 'ai_reaction'; reaction: MorphicAIReaction };

export interface RealityEngineEventHandler {
  (event: RealityEngineEvent): void | Promise<void>;
}
