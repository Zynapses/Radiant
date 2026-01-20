/**
 * RADIANT v4.18.0 - Liquid Interface Types
 * "Don't Build the Tool. BE the Tool."
 * 
 * The chat interface morphs into the tool the user needs.
 * Data talk → Spreadsheet. Logic talk → Calculator. Design talk → Canvas.
 */

// ============================================================================
// Core Liquid Types
// ============================================================================

/**
 * The current mode of the Liquid Interface
 */
export type LiquidMode = 
  | 'chat'          // Normal conversation
  | 'morphed'       // UI has transformed into a tool
  | 'transitioning' // Animating between states
  | 'ejecting';     // Preparing for export

/**
 * Component categories in the registry
 */
export type ComponentCategory =
  | 'data'          // DataGrid, Chart, Table, Pivot
  | 'input'         // Form, Slider, Toggle, DatePicker
  | 'layout'        // Split, Stack, Tabs, Accordion
  | 'visualization' // Chart, Graph, Map, Timeline
  | 'productivity'  // Kanban, Calendar, Gantt, Todo
  | 'code'          // CodeEditor, Terminal, Diff
  | 'media'         // ImageGallery, VideoPlayer, AudioWave
  | 'ai'            // AIChat, SuggestionPanel, InsightCard
  | 'finance'       // Invoice, Budget, Expense, Portfolio
  | 'custom';       // User-defined components

/**
 * A registered component in the Liquid system
 */
export interface LiquidComponent {
  id: string;
  name: string;
  category: ComponentCategory;
  description: string;
  
  // Schema definition
  propsSchema: JSONSchema;
  eventsSchema: JSONSchema;
  
  // Capabilities
  supportsInteraction: boolean;
  supportsDataBinding: boolean;
  supportsAIContext: boolean;
  
  // Rendering hints
  defaultSize: { width: number; height: number };
  resizable: boolean;
  
  // Component metadata
  icon: string;
  color: string;
  tags: string[];
}

/**
 * JSON Schema type for component props/events
 */
export interface JSONSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  description?: string;
  default?: unknown;
  enum?: unknown[];
}

// ============================================================================
// Liquid Schema (What the LLM outputs)
// ============================================================================

/**
 * The schema streamed by the LLM to morph the UI
 * This is the "Lego Protocol" - components compose via JSON, not code
 */
export interface LiquidSchema {
  version: '1.0';
  id: string;
  
  // What triggered this morph
  intent: LiquidIntent;
  
  // The layout structure
  layout: LayoutNode;
  
  // Initial data to populate components
  initialData: Record<string, unknown>;
  
  // Ghost state bindings (AI <-> UI)
  bindings: GhostBinding[];
  
  // AI overlay configuration
  aiOverlay: AIOverlayConfig;
  
  // Eject configuration
  ejectConfig?: EjectConfig;
}

/**
 * Detected intent that triggered the morph
 */
export interface LiquidIntent {
  category: IntentCategory;
  action: string;
  confidence: number;
  entities: Record<string, string>;
  suggestedComponents: string[];
}

export type IntentCategory =
  | 'data_analysis'     // "Help me with this spreadsheet"
  | 'tracking'          // "Track my invoices"
  | 'visualization'     // "Show me a chart of..."
  | 'planning'          // "Plan my project"
  | 'calculation'       // "Calculate..."
  | 'design'            // "Design a..."
  | 'coding'            // "Build me a..."
  | 'writing'           // "Write a..."
  | 'general';          // Default chat

/**
 * Layout node - recursive structure for UI composition
 */
export interface LayoutNode {
  type: LayoutType;
  id: string;
  
  // For container types
  children?: LayoutNode[];
  direction?: 'horizontal' | 'vertical';
  sizes?: number[];  // Flex ratios
  
  // For component types
  component?: string;  // Component ID from registry
  props?: Record<string, unknown>;
  
  // Styling
  style?: Record<string, string | number>;
  className?: string;
}

export type LayoutType =
  | 'root'
  | 'split'
  | 'stack'
  | 'tabs'
  | 'overlay'
  | 'component';

// ============================================================================
// Ghost State (Two-Way AI <-> UI Binding)
// ============================================================================

/**
 * A binding between UI state and AI context
 * This is how the AI "sees" user interactions
 */
export interface GhostBinding {
  id: string;
  
  // Source (UI side)
  sourceComponent: string;
  sourceProperty: string;
  
  // Target (AI context)
  contextKey: string;
  
  // Binding behavior
  direction: 'ui_to_ai' | 'ai_to_ui' | 'bidirectional';
  debounceMs?: number;
  
  // Transform
  transform?: BindingTransform;
  
  // Trigger AI reaction on change
  triggerReaction?: boolean;
  reactionPrompt?: string;
}

/**
 * Transform applied during binding sync
 */
export interface BindingTransform {
  type: 'identity' | 'format' | 'aggregate' | 'filter' | 'custom';
  config?: Record<string, unknown>;
}

/**
 * Event sent to AI when user interacts with UI
 */
export interface GhostEvent {
  id: string;
  timestamp: string;
  
  // Source
  componentId: string;
  componentType: string;
  
  // Event details
  action: string;  // 'click', 'change', 'select', 'drag', etc.
  payload: Record<string, unknown>;
  
  // Current state snapshot
  currentState: Record<string, unknown>;
  
  // User context
  userId: string;
  sessionId: string;
}

/**
 * AI reaction to a ghost event
 */
export interface AIReaction {
  id: string;
  eventId: string;
  
  // Response type
  type: 'speak' | 'update' | 'morph' | 'suggest';
  
  // For 'speak': What the AI says
  message?: string;
  
  // For 'update': State changes to apply
  stateUpdates?: Record<string, unknown>;
  
  // For 'morph': New schema to apply
  newSchema?: LiquidSchema;
  
  // For 'suggest': Suggestions to show
  suggestions?: AISuggestion[];
}

export interface AISuggestion {
  id: string;
  text: string;
  action: string;
  confidence: number;
}

// ============================================================================
// AI Overlay Configuration
// ============================================================================

/**
 * How the AI chat appears alongside the morphed UI
 */
export interface AIOverlayConfig {
  mode: AIOverlayMode;
  position?: 'left' | 'right' | 'bottom' | 'floating';
  width?: number | string;
  height?: number | string;
  
  // Behavior
  autoHide: boolean;
  showOnHover: boolean;
  showSuggestions: boolean;
  
  // Voice
  voiceEnabled: boolean;
  autoSpeak: boolean;
}

export type AIOverlayMode = 
  | 'hidden'      // No visible chat
  | 'minimal'     // Small floating bubble
  | 'sidebar'     // Side panel
  | 'overlay'     // Transparent overlay
  | 'integrated'; // Embedded in layout

// ============================================================================
// Eject & Deploy Configuration
// ============================================================================

/**
 * Configuration for ejecting the liquid app to real code
 */
export interface EjectConfig {
  // Target framework
  framework: 'nextjs' | 'vite' | 'remix' | 'astro';
  
  // Features to include
  features: EjectFeature[];
  
  // Dependency handling
  dependencies: EjectDependency[];
  
  // Secrets handling
  secrets: EjectSecret[];
  
  // Deploy target
  deployTarget?: 'vercel' | 'netlify' | 'github' | 'zip';
}

export type EjectFeature = 
  | 'database'      // Include PGLite → Postgres migration
  | 'auth'          // Include auth scaffolding
  | 'api'           // Include API routes
  | 'ai'            // Include AI integration
  | 'realtime';     // Include websocket support

export interface EjectDependency {
  name: string;
  version: string;
  required: boolean;
  devOnly: boolean;
}

export interface EjectSecret {
  name: string;
  description: string;
  required: boolean;
  envKey: string;
  fallback?: 'prompt' | 'mock' | 'error';
}

/**
 * Result of an eject operation
 */
export interface EjectResult {
  id: string;
  status: 'success' | 'partial' | 'failed';
  
  // Generated artifacts
  files: EjectFile[];
  
  // Instructions
  setupInstructions: string[];
  envExample: string;
  
  // Deploy info
  deployUrl?: string;
  repoUrl?: string;
  
  // Warnings
  warnings: string[];
}

export interface EjectFile {
  path: string;
  content: string;
  type: 'source' | 'config' | 'asset' | 'doc';
}

// ============================================================================
// Client-Side Database (PGLite)
// ============================================================================

/**
 * Browser-based Postgres instance configuration
 */
export interface PGLiteConfig {
  enabled: boolean;
  
  // Schema to initialize
  schema: PGLiteSchema[];
  
  // Seed data
  seedData: Record<string, unknown[]>;
  
  // Persistence
  persistMode: 'memory' | 'indexeddb' | 'opfs';
  
  // Sync with server (optional)
  syncEnabled: boolean;
  syncEndpoint?: string;
}

export interface PGLiteSchema {
  tableName: string;
  columns: PGLiteColumn[];
  indexes?: string[];
}

export interface PGLiteColumn {
  name: string;
  type: 'text' | 'integer' | 'real' | 'boolean' | 'timestamp' | 'json';
  nullable?: boolean;
  primaryKey?: boolean;
  defaultValue?: unknown;
}

// ============================================================================
// Liquid Session State
// ============================================================================

/**
 * Complete state of a liquid interface session
 */
export interface LiquidSession {
  id: string;
  tenantId: string;
  userId: string;
  
  // Current state
  mode: LiquidMode;
  currentSchema?: LiquidSchema;
  
  // Ghost state store
  ghostState: Record<string, unknown>;
  
  // Event history
  eventHistory: GhostEvent[];
  reactionHistory: AIReaction[];
  
  // Database state
  pglite?: PGLiteConfig;
  
  // Conversation context
  conversationId: string;
  messageCount: number;
  
  // Timestamps
  createdAt: string;
  lastActivityAt: string;
  morphedAt?: string;
}

/**
 * Transition animation configuration
 */
export interface MorphTransition {
  type: 'fade' | 'slide' | 'expand' | 'dissolve' | 'morph';
  duration: number;
  easing: string;
  staggerChildren: boolean;
}

// ============================================================================
// Component Registry Types
// ============================================================================

/**
 * Full component registry with all available components
 */
export interface ComponentRegistry {
  version: string;
  components: LiquidComponent[];
  categories: CategoryInfo[];
  
  // Quick lookup
  byId: Record<string, LiquidComponent>;
  byCategory: Record<ComponentCategory, LiquidComponent[]>;
}

export interface CategoryInfo {
  id: ComponentCategory;
  name: string;
  description: string;
  icon: string;
  componentCount: number;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface MorphRequest {
  tenantId: string;
  userId: string;
  sessionId?: string;
  
  // Input
  message: string;
  attachments?: string[];
  
  // Context
  currentState?: Record<string, unknown>;
  conversationHistory?: Array<{ role: string; content: string }>;
}

export interface MorphResponse {
  sessionId: string;
  
  // Decision
  shouldMorph: boolean;
  intent?: LiquidIntent;
  
  // If morphing
  schema?: LiquidSchema;
  transition?: MorphTransition;
  
  // AI response
  aiMessage?: string;
  suggestions?: AISuggestion[];
}

export interface GhostEventRequest {
  sessionId: string;
  event: GhostEvent;
}

export interface GhostEventResponse {
  reaction: AIReaction;
  stateUpdates?: Record<string, unknown>;
}

export interface EjectRequest {
  sessionId: string;
  config: EjectConfig;
}

export interface EjectResponse {
  result: EjectResult;
}

// ============================================================================
// Ghost State Snapshot
// ============================================================================

/**
 * Snapshot of the current ghost state for debugging/inspection
 */
export interface GhostStateSnapshot {
  sessionId: string;
  timestamp: string;
  values: Record<string, unknown>;
  dirtyKeys: string[];
  bindingCount: number;
}
