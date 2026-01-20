/**
 * Magic Carpet Types
 * 
 * "We are building 'The Magic Carpet.' You don't drive it. You don't write code 
 * for it. You just say where you want to go, and the ground beneath you reshapes 
 * itself to take you there instantly."
 * 
 * The Magic Carpet is the unified navigation and experience paradigm for Think Tank.
 * It wraps the Reality Engine capabilities into a cohesive user experience.
 * 
 * @module @radiant/shared/types/magic-carpet
 */

// =============================================================================
// MAGIC CARPET CORE
// The unified experience layer
// =============================================================================

export interface MagicCarpet {
  id: string;
  tenantId: string;
  userId: string;
  
  // Current state
  destination: CarpetDestination | null;
  mode: CarpetMode;
  altitude: CarpetAltitude;
  
  // Reality Engine integration
  realityEngineSessionId: string;
  
  // Navigation history
  journey: CarpetJourneyPoint[];
  currentPosition: number;
  
  // Customization
  theme: CarpetTheme;
  preferences: CarpetPreferences;
  
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// DESTINATIONS
// Where the user wants to go (intent-driven navigation)
// =============================================================================

export interface CarpetDestination {
  id: string;
  type: DestinationType;
  name: string;
  description?: string;
  icon: string;
  
  // What the destination looks like
  layout: CarpetLayout;
  
  // How to get there
  morphSequence?: CarpetMorphStep[];
  
  // Metadata
  estimatedArrivalMs?: number;
  wasPreCognized?: boolean;
}

export type DestinationType = 
  | 'dashboard'      // Overview/home
  | 'workspace'      // Active work area
  | 'timeline'       // Reality Scrubber view
  | 'multiverse'     // Quantum Futures view
  | 'oracle'         // Pre-Cognition insights
  | 'workshop'       // Building/creating
  | 'gallery'        // Viewing outputs
  | 'vault'          // Saved items
  | 'custom';        // User-defined

export interface CarpetLayout {
  id: string;
  type: 'floating' | 'docked' | 'fullscreen' | 'split' | 'overlay';
  regions: CarpetRegion[];
  transitions: CarpetTransition;
}

export interface CarpetRegion {
  id: string;
  name: string;
  position: 'center' | 'north' | 'south' | 'east' | 'west' | 'floating';
  size: { width: string; height: string };
  content: CarpetContent;
  isCollapsible?: boolean;
  isResizable?: boolean;
}

export type CarpetContent = 
  | { type: 'morphic'; componentId: string; props: Record<string, unknown> }
  | { type: 'chat'; mode: 'embedded' | 'floating' | 'sidebar' }
  | { type: 'timeline'; view: 'scrubber' | 'list' | 'graph' }
  | { type: 'branches'; view: 'split' | 'tabs' | 'carousel' }
  | { type: 'predictions'; view: 'cards' | 'list' }
  | { type: 'custom'; render: string };

// =============================================================================
// MODES
// How the carpet behaves
// =============================================================================

export type CarpetMode = 
  | 'resting'        // Waiting for destination (chat-first)
  | 'flying'         // Morphing/transitioning
  | 'hovering'       // Arrived, actively working
  | 'exploring'      // Quantum Futures - multiple realities
  | 'rewinding'      // Reality Scrubber - time traveling
  | 'anticipating';  // Pre-Cognition active

export type CarpetAltitude = 
  | 'ground'         // Simple chat mode
  | 'low'            // Light morphing (single component)
  | 'medium'         // Full workspace
  | 'high'           // Complex multi-component layout
  | 'stratosphere';  // Maximum capability mode

// =============================================================================
// JOURNEY & NAVIGATION
// Where the user has been
// =============================================================================

export interface CarpetJourneyPoint {
  id: string;
  destination: CarpetDestination;
  arrivedAt: Date;
  departedAt?: Date;
  snapshotId?: string; // Links to Reality Scrubber
  
  // What happened here
  actions: CarpetAction[];
  aiInteractions: number;
  morphCount: number;
}

export interface CarpetAction {
  id: string;
  type: CarpetActionType;
  timestamp: Date;
  description: string;
  undoable: boolean;
}

export type CarpetActionType = 
  | 'morph'           // UI morphed
  | 'create'          // Something created
  | 'edit'            // Something modified
  | 'delete'          // Something removed
  | 'branch'          // Quantum split
  | 'collapse'        // Quantum collapse
  | 'scrub'           // Time travel
  | 'bookmark'        // Created checkpoint
  | 'eject';          // Exported to app

// =============================================================================
// MORPHING & TRANSITIONS
// How the carpet transforms
// =============================================================================

export interface CarpetMorphStep {
  id: string;
  order: number;
  type: 'fade' | 'slide' | 'scale' | 'dissolve' | 'ripple' | 'warp';
  durationMs: number;
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring';
  affectedRegions: string[];
}

export interface CarpetTransition {
  enter: CarpetMorphStep[];
  exit: CarpetMorphStep[];
  defaultDurationMs: number;
}

// =============================================================================
// THEME & CUSTOMIZATION
// How the carpet looks
// =============================================================================

export interface CarpetTheme {
  name: string;
  mode: 'light' | 'dark' | 'system';
  
  // Colors
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  
  // Carpet-specific styling
  carpetGradient: string[];        // The "fabric" gradient
  carpetPattern?: CarpetPattern;   // Optional decorative pattern
  glowColor: string;               // Magic glow effect
  trailEffect: boolean;            // Leave visual trail when flying
  
  // Typography
  fontFamily: string;
  fontSize: 'sm' | 'md' | 'lg';
  
  // Effects
  blur: boolean;
  shadows: boolean;
  animations: boolean;
}

export type CarpetPattern = 
  | 'none'
  | 'geometric'
  | 'persian'
  | 'stars'
  | 'waves'
  | 'circuits'
  | 'custom';

export interface CarpetPreferences {
  // Navigation
  autoFly: boolean;              // Auto-morph on intent detection
  smoothTransitions: boolean;    // Animated vs instant
  showJourneyTrail: boolean;     // Show navigation history
  
  // Pre-Cognition
  preCognitionEnabled: boolean;
  showPredictions: boolean;      // Show suggested destinations
  telepathyIntensity: 'subtle' | 'moderate' | 'aggressive';
  
  // Reality Scrubber
  showTimeline: boolean;         // Always show timeline scrubber
  autoSnapshot: boolean;         // Automatic checkpoints
  snapshotInterval: number;      // Seconds between auto-snapshots
  
  // Quantum Futures
  maxParallelRealities: number;  // Max branches visible
  autoCompare: boolean;          // Auto-compare when branching
  
  // Accessibility
  reducedMotion: boolean;
  highContrast: boolean;
  screenReaderMode: boolean;
}

// =============================================================================
// NAVIGATION COMMANDS
// How users control the carpet
// =============================================================================

export type CarpetCommand = 
  | { type: 'fly'; destination: string | CarpetDestination }
  | { type: 'land' }                                          // Return to chat
  | { type: 'ascend' }                                        // Increase complexity
  | { type: 'descend' }                                       // Simplify
  | { type: 'rewind'; to: string | Date | number }           // Time travel
  | { type: 'branch'; options: string[] }                    // Split realities
  | { type: 'collapse'; winner: string }                     // Pick winner
  | { type: 'bookmark'; label: string }                      // Save checkpoint
  | { type: 'eject'; framework: string }                     // Export
  | { type: 'predict' };                                     // Force prediction

export interface CarpetCommandResult {
  success: boolean;
  command: CarpetCommand;
  previousState: CarpetMode;
  newState: CarpetMode;
  destination?: CarpetDestination;
  durationMs: number;
  message?: string;
}

// =============================================================================
// MAGIC CARPET UI COMPONENTS
// The visual vocabulary
// =============================================================================

export interface CarpetNavigator {
  // The main navigation UI
  position: 'bottom' | 'top' | 'floating';
  showDestinations: boolean;
  showJourney: boolean;
  showTimeline: boolean;
  showPredictions: boolean;
}

export interface CarpetCompass {
  // Shows available destinations
  destinations: CarpetDestination[];
  recommendedDestination?: CarpetDestination;
  recentDestinations: CarpetDestination[];
}

export interface CarpetMinimap {
  // Overview of current journey
  showBranches: boolean;
  showBookmarks: boolean;
  interactive: boolean;
}

// =============================================================================
// EVENTS
// What happens on the carpet
// =============================================================================

export type CarpetEvent = 
  | { type: 'takeoff'; destination: CarpetDestination }
  | { type: 'landing'; destination: CarpetDestination }
  | { type: 'altitude_change'; from: CarpetAltitude; to: CarpetAltitude }
  | { type: 'mode_change'; from: CarpetMode; to: CarpetMode }
  | { type: 'branch_created'; branchId: string }
  | { type: 'branch_collapsed'; winnerId: string }
  | { type: 'time_travel'; to: Date }
  | { type: 'prediction_ready'; predictions: CarpetDestination[] }
  | { type: 'prediction_used'; predictionId: string }
  | { type: 'journey_updated'; position: number };

export interface CarpetEventHandler {
  (event: CarpetEvent): void | Promise<void>;
}

// =============================================================================
// API TYPES
// =============================================================================

export interface CarpetInitRequest {
  tenantId: string;
  userId: string;
  theme?: Partial<CarpetTheme>;
  preferences?: Partial<CarpetPreferences>;
}

export interface CarpetInitResponse {
  carpet: MagicCarpet;
  availableDestinations: CarpetDestination[];
  predictions: CarpetDestination[];
}

export interface CarpetFlyRequest {
  carpetId: string;
  destination: string | CarpetDestination;
  instant?: boolean;
}

export interface CarpetFlyResponse {
  success: boolean;
  destination: CarpetDestination;
  transitionDurationMs: number;
  wasPreCognized: boolean;
}
