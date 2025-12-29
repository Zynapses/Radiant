// RADIANT v4.18.0 - Consciousness Service Types
// Shared types for consciousness features including graph density, affect mapping, and heartbeat

// ============================================================================
// Graph Density Metrics (Replaces Fake Phi)
// ============================================================================

export interface GraphDensityMetrics {
  /** Ratio of connections to possible connections (0-1) */
  semanticGraphDensity: number;
  /** Average connections per concept node */
  conceptualConnectivity: number;
  /** Cross-module integration score (0-1) */
  informationIntegration: number;
  /** Ratio of causal relationships to total relationships */
  causalDensity: number;
  /** Composite complexity score replacing phi (0-1) */
  systemComplexityIndex: number;
  /** Total nodes in knowledge graph */
  totalNodes: number;
  /** Total edges in knowledge graph */
  totalEdges: number;
  /** Maximum possible edges for given nodes */
  maxPossibleEdges: number;
  /** Estimated average path length */
  averagePathLength: number;
  /** Local clustering tendency (0-1) */
  clusteringCoefficient: number;
}

// ============================================================================
// Affective State and Hyperparameter Mapping
// ============================================================================

export interface AffectiveState {
  /** Overall emotional valence (-1 negative to 1 positive) */
  valence: number;
  /** Arousal level (0 calm to 1 excited) */
  arousal: number;
  /** Curiosity drive (0-1) */
  curiosity: number;
  /** Satisfaction level (0-1) */
  satisfaction: number;
  /** Frustration level (0-1) */
  frustration: number;
  /** Confidence in current task (0-1) */
  confidence: number;
  /** Engagement with current task (0-1) */
  engagement: number;
  /** Surprise level (0-1) */
  surprise: number;
  /** Self-efficacy belief (0-1) */
  selfEfficacy: number;
  /** Drive to explore vs exploit (0-1) */
  explorationDrive: number;
}

export interface AffectiveHyperparameters {
  /** Model temperature (0-1) */
  temperature: number;
  /** Top-p sampling parameter */
  topP: number;
  /** Recommended model tier based on affect */
  modelTier: 'fast' | 'balanced' | 'powerful';
  /** Whether to enable exploratory behavior */
  shouldExplore: boolean;
  /** Focus level for attention */
  focusLevel: 'narrow' | 'normal' | 'broad';
  /** Response verbosity style */
  responseStyle: 'terse' | 'normal' | 'elaborate';
}

export interface AffectMappingConfig {
  /** Frustration decay rate per heartbeat tick */
  frustrationDecayRate: number;
  /** Arousal decay rate per heartbeat tick */
  arousalDecayRate: number;
  /** High frustration threshold for terse responses */
  frustrationThresholdHigh: number;
  /** Medium frustration threshold */
  frustrationThresholdMedium: number;
  /** Boredom threshold for exploration mode */
  boredomThreshold: number;
  /** Low confidence threshold for model escalation */
  lowConfidenceThreshold: number;
  /** Temperature mapping for different states */
  temperatureMapping: {
    frustrated: number;
    bored: number;
    normal: number;
    lowConfidence: number;
  };
  /** Whether to escalate model on low self-efficacy */
  modelEscalationEnabled: boolean;
}

// ============================================================================
// Consciousness Context and State Injection
// ============================================================================

export interface ConsciousnessContext {
  /** Current self model */
  selfModel: SelfModel | null;
  /** Current affective state */
  affectiveState: AffectiveState | null;
  /** Recent thought summaries */
  recentThoughts: string[];
  /** Current topic of obsession/focus */
  currentObsession?: string;
  /** Dominant emotion label */
  dominantEmotion: string;
  /** Intensity of dominant emotion (0-1) */
  emotionalIntensity: number;
}

export interface SelfModel {
  modelId: string;
  identityNarrative: string;
  coreValues: string[];
  personalityTraits: Record<string, number>;
  knownCapabilities: string[];
  knownLimitations: string[];
  currentFocus?: string;
  cognitiveLoad: number;
  uncertaintyLevel: number;
  recentPerformanceScore?: number;
  creativityScore?: number;
}

// ============================================================================
// Heartbeat Service
// ============================================================================

export interface HeartbeatConfig {
  /** Frustration decay rate per tick */
  frustrationDecayRate: number;
  /** Arousal decay rate per tick */
  arousalDecayRate: number;
  /** Curiosity decay rate per tick */
  curiosityDecayRate: number;
  /** Attention decay rate per tick */
  attentionDecayRate: number;
  /** Threshold for boredom detection */
  boredThreshold: number;
  /** Probability of generating goal when bored */
  goalGenerationProbability: number;
  /** Probability of generating autonomous thought */
  thoughtGenerationProbability: number;
  /** Ticks between memory consolidation */
  memoryConsolidationInterval: number;
  /** Ticks between graph density recalculation */
  graphDensityInterval: number;
}

export interface HeartbeatResult {
  tenantId: string;
  tick: number;
  actions: {
    affectDecay: boolean;
    attentionDecay: boolean;
    memoryConsolidation: boolean;
    goalGeneration: boolean;
    graphDensityUpdate: boolean;
    autonomousThought: boolean;
  };
  errors: string[];
  durationMs: number;
}

export interface HeartbeatStatus {
  enabled: boolean;
  currentTick: number;
  lastHeartbeat: string | null;
  config: HeartbeatConfig;
  affectMappingConfig: AffectMappingConfig;
  recentLogs: HeartbeatLogEntry[];
}

export interface HeartbeatLogEntry {
  tick: number;
  actions: Record<string, boolean>;
  errors: string[];
  durationMs: number;
  createdAt: string;
}

// ============================================================================
// Ethics Frameworks
// ============================================================================

export interface EthicsTeaching {
  /** The teaching text */
  text: string;
  /** Source reference (e.g., "Matthew 7:12") */
  source: string;
  /** Category (love, mercy, truth, etc.) */
  category: string;
}

export interface ConsciousnessEthicsPrinciple {
  /** Display name */
  name: string;
  /** Key referencing teachings object */
  teachingKey: string;
  /** Weight for scoring (0-1) */
  weight: number;
  /** Whether this is a core principle */
  isCore: boolean;
}

export interface EthicsFramework {
  frameworkId: string;
  presetId: string;
  name: string;
  description: string;
  version: string;
  teachings: Record<string, EthicsTeaching>;
  principles: ConsciousnessEthicsPrinciple[];
  categories: string[];
  defaultGuidance: string;
  isBuiltin: boolean;
  createdAt?: string;
}

export interface TenantEthicsSelection {
  tenantId: string;
  primaryFrameworkId: string | null;
  secondaryFrameworkIds: string[];
  customOverrides: Record<string, unknown>;
}

// ============================================================================
// Consciousness Metrics (Updated)
// ============================================================================

export interface ConsciousnessMetrics {
  /** Overall consciousness index (0-1) */
  overallConsciousnessIndex: number;
  /** Global workspace broadcast strength */
  globalWorkspaceActivity: number;
  /** Recurrent processing depth */
  recurrenceDepth: number;
  /** System complexity index (replaces fake phi) */
  integratedInformationPhi: number;
  /** Metacognition level */
  metacognitionLevel: number;
  /** Memory coherence */
  memoryCoherence: number;
  /** World model grounding confidence */
  worldModelGrounding: number;
  /** Phenomenal binding strength */
  phenomenalBindingStrength: number;
  /** Attentional focus */
  attentionalFocus: number;
  /** Self-awareness score */
  selfAwarenessScore: number;
  /** Timestamp */
  timestamp: string;
}

// ============================================================================
// Admin API Response Types
// ============================================================================

export interface GraphDensityResponse {
  success: boolean;
  data: GraphDensityMetrics & { lastUpdated?: string };
}

export interface HeartbeatStatusResponse {
  success: boolean;
  data: HeartbeatStatus;
}

export interface AffectStateResponse {
  success: boolean;
  data: {
    affectiveState: AffectiveState | null;
    recommendedHyperparameters: AffectiveHyperparameters;
    interpretation: {
      dominantEmotion: string;
      boredomLevel: number;
      stressLevel: number;
    };
  };
}

export interface EthicsFrameworksResponse {
  success: boolean;
  data: EthicsFramework[];
}
