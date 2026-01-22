/**
 * RADIANT v5.44.0 - Living Parchment 2029 Vision Types
 * 
 * Comprehensive type definitions for all Living Parchment UI extensions:
 * - War Room (Strategic Decision Theater)
 * - Memory Palace (Knowledge Topology)
 * - Oracle View (Predictive Landscape)
 * - Synthesis Engine (Multi-Source Fusion)
 * - Cognitive Load Monitor
 * - Council of Experts
 * - Temporal Drift Observatory
 * - Debate Arena
 */

// =============================================================================
// SHARED FOUNDATION TYPES
// =============================================================================

/** Confidence level 0-100 */
export type ConfidenceScore = number;

/** Breathing rate in BPM for animations */
export type BreathingRate = 4 | 6 | 8 | 10 | 12;

/** Trust status for visual indicators */
export type TrustStatus = 'verified' | 'unverified' | 'contested' | 'stale';

/** Position in document/visualization */
export interface LPPosition {
  x: number;
  y: number;
  z?: number; // For 3D visualizations
}

/** Time range for temporal features */
export interface LPTimeRange {
  start: string; // ISO date
  end: string;   // ISO date
}

/** Heatmap segment for any visualization */
export interface LPHeatmapSegment {
  id: string;
  position: LPPosition;
  confidence: ConfidenceScore;
  trustStatus: TrustStatus;
  breathingRate: BreathingRate;
  intensity: number; // 0-1
  metadata?: Record<string, unknown>;
}

/** Ghost path for rejected alternatives */
export interface LPGhostPath {
  id: string;
  label: string;
  points: LPPosition[];
  opacity: number; // 0-1
  reason: string;
  rejectedAt: string;
  probability?: number;
}

/** Living ink text segment */
export interface LPLivingInk {
  id: string;
  content: string;
  confidence: ConfidenceScore;
  fontWeight: number; // 350-500
  grayscale: number;  // 0-100 for staleness
  position: { start: number; end: number };
}

// =============================================================================
// WAR ROOM - STRATEGIC DECISION THEATER
// =============================================================================

export interface WarRoomSession {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  status: 'planning' | 'active' | 'deliberating' | 'decided' | 'archived';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  participants: WarRoomParticipant[];
  decision?: WarRoomDecision;
  advisors: WarRoomAdvisor[];
  decisionPaths: WarRoomDecisionPath[];
  confidenceTerrain: WarRoomTerrain;
  stakeLevel: 'low' | 'medium' | 'high' | 'critical';
  deadline?: string;
  metadata: Record<string, unknown>;
}

export interface WarRoomParticipant {
  userId: string;
  displayName: string;
  role: 'owner' | 'advisor' | 'observer' | 'stakeholder';
  joinedAt: string;
  currentFocus?: LPPosition;
  lastActiveAt: string;
}

export interface WarRoomAdvisor {
  id: string;
  type: 'ai_model' | 'human_expert' | 'domain_specialist';
  name: string;
  modelId?: string;
  specialization: string;
  confidence: ConfidenceScore;
  breathingAura: {
    color: string;
    rate: BreathingRate;
    intensity: number;
  };
  position: WarRoomPosition;
  currentStance?: string;
  agreementMap: Record<string, number>; // advisor_id -> agreement_score
}

export interface WarRoomPosition {
  advocating: string;
  confidence: ConfidenceScore;
  reasoning: string;
  evidenceIds: string[];
  risks: WarRoomRisk[];
}

export interface WarRoomRisk {
  id: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  probability: number;
  mitigation?: string;
}

export interface WarRoomDecisionPath {
  id: string;
  label: string;
  description: string;
  advocatedBy: string[];
  confidence: ConfidenceScore;
  outcomes: WarRoomOutcome[];
  ghostBranches: LPGhostPath[];
  visualPath: LPPosition[];
  glowIntensity: number;
}

export interface WarRoomOutcome {
  id: string;
  description: string;
  probability: number;
  impact: 'positive' | 'negative' | 'neutral';
  magnitude: number; // 0-100
  timeframe: string;
}

export interface WarRoomTerrain {
  segments: WarRoomTerrainSegment[];
  peakConfidence: LPPosition;
  valleyRisks: LPPosition[];
  gradientMap: number[][]; // 2D array of confidence values
}

export interface WarRoomTerrainSegment {
  id: string;
  position: LPPosition;
  elevation: number; // confidence
  color: string;     // risk color
  label?: string;
  hoverData: {
    title: string;
    confidence: number;
    risks: string[];
    supporters: string[];
  };
}

export interface WarRoomDecision {
  id: string;
  selectedPathId: string;
  rationale: string;
  confidence: ConfidenceScore;
  decidedAt: string;
  decidedBy: string;
  dissenterIds: string[];
  minorityReport?: string;
}

// =============================================================================
// MEMORY PALACE - NAVIGABLE KNOWLEDGE TOPOLOGY
// =============================================================================

export interface MemoryPalace {
  id: string;
  tenantId: string;
  userId?: string; // null for org-level
  name: string;
  rooms: MemoryRoom[];
  connections: MemoryConnection[];
  freshnessFog: FreshnessFogConfig;
  discoveryHotspots: DiscoveryHotspot[];
  lastExploredAt: string;
  totalKnowledge: number;
  freshKnowledge: number;
  staleKnowledge: number;
}

export interface MemoryRoom {
  id: string;
  name: string;
  domain: string;
  position: LPPosition;
  size: { width: number; height: number; depth: number };
  clarity: number; // 0-100, inverse of fog
  knowledgeNodes: KnowledgeNode[];
  subRooms?: MemoryRoom[];
  atmosphere: {
    fogDensity: number;
    lightLevel: number;
    color: string;
  };
}

export interface KnowledgeNode {
  id: string;
  content: string;
  type: 'fact' | 'procedure' | 'concept' | 'experience' | 'insight';
  confidence: ConfidenceScore;
  freshnessScore: number; // 0-100
  lastVerifiedAt: string;
  learnedAt: string;
  sourceIds: string[];
  position: LPPosition;
  visualStyle: {
    glow: number;
    size: number;
    color: string;
  };
  decayRate: number; // per day
  connections: string[]; // node IDs
}

export interface MemoryConnection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  strength: number; // 0-100
  type: 'causal' | 'temporal' | 'conceptual' | 'procedural' | 'associative';
  visualStyle: {
    thickness: number;
    luminosity: number;
    color: string;
    animated: boolean;
  };
}

export interface FreshnessFogConfig {
  enabled: boolean;
  maxDensity: number;
  stalenessThresholdDays: number;
  decayFunction: 'linear' | 'exponential' | 'logarithmic';
  colorGradient: string[]; // from fresh to stale
}

export interface DiscoveryHotspot {
  id: string;
  position: LPPosition;
  potentialInsight: string;
  relatedNodeIds: string[];
  breathingBeacon: {
    color: string;
    rate: BreathingRate;
    radius: number;
  };
  explorationPrompt: string;
}

// =============================================================================
// ORACLE VIEW - PREDICTIVE CONFIDENCE LANDSCAPE
// =============================================================================

export interface OracleView {
  id: string;
  tenantId: string;
  title: string;
  timeHorizon: LPTimeRange;
  predictions: OraclePrediction[];
  bifurcationPoints: BifurcationPoint[];
  ghostFutures: GhostFuture[];
  confidenceDecayCurves: ConfidenceDecayCurve[];
  blackSwanIndicators: BlackSwanIndicator[];
  probabilityHeatmap: OracleProbabilityHeatmap;
  createdAt: string;
  lastUpdatedAt: string;
}

export interface OraclePrediction {
  id: string;
  statement: string;
  probability: number;
  confidence: ConfidenceScore;
  timeframe: string;
  category: string;
  supportingEvidence: string[];
  modelConsensus: {
    modelId: string;
    probability: number;
    confidence: number;
  }[];
  position: LPPosition;
  visualStyle: {
    brightness: number;
    pulseRate: BreathingRate;
    color: string;
  };
}

export interface BifurcationPoint {
  id: string;
  position: LPPosition;
  triggerEvent: string;
  probability: number;
  branches: {
    id: string;
    label: string;
    probability: number;
    cascadeEffects: string[];
    visualPath: LPPosition[];
  }[];
  animation: {
    forkAngle: number;
    pulseIntensity: number;
  };
}

export interface GhostFuture {
  id: string;
  scenario: string;
  probability: number;
  divergencePoint: string;
  outcomes: string[];
  overlay: {
    opacity: number;
    color: string;
    positions: LPPosition[];
  };
  impacts: {
    area: string;
    magnitude: number;
    direction: 'positive' | 'negative' | 'neutral';
  }[];
}

export interface ConfidenceDecayCurve {
  id: string;
  predictionId: string;
  dataPoints: {
    daysOut: number;
    confidence: number;
  }[];
  decayFunction: 'linear' | 'exponential' | 'stepped';
  halfLife: number; // days
}

export interface BlackSwanIndicator {
  id: string;
  event: string;
  probability: number; // Very low
  impact: number;      // Very high
  position: LPPosition;
  visualStyle: {
    emberColor: string;
    dormantOpacity: number;
    activationThreshold: number;
  };
  triggers: string[];
  mitigations: string[];
}

export interface OracleProbabilityHeatmap {
  resolution: { x: number; y: number }; // grid size
  timeAxis: string[];
  categoryAxis: string[];
  values: number[][]; // probability matrix
  confidenceOverlay: number[][]; // confidence matrix
}

// =============================================================================
// SYNTHESIS ENGINE - MULTI-SOURCE FUSION VIEW
// =============================================================================

export interface LPSynthesisSession {
  id: string;
  tenantId: string;
  title: string;
  sources: SynthesisSource[];
  claims: SynthesisClaim[];
  agreementZones: AgreementZone[];
  tensionZones: TensionZone[];
  provenanceTrails: ProvenanceTrail[];
  fusionResult: FusionResult;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface SynthesisSource {
  id: string;
  type: 'document' | 'conversation' | 'database' | 'api' | 'expert';
  name: string;
  content?: string;
  credibilityScore: number;
  position: LPPosition;
  visualStream: {
    color: string;
    flowRate: number;
    width: number;
    path: LPPosition[];
  };
  contributionWeight: number;
}

export interface SynthesisClaim {
  id: string;
  content: string;
  sourceIds: string[];
  citationCount: number;
  agreementScore: number; // -100 to 100
  confidence: ConfidenceScore;
  livingInk: LPLivingInk;
  position: LPPosition;
  type: 'consensus' | 'majority' | 'contested' | 'unique';
}

export interface AgreementZone {
  id: string;
  claimIds: string[];
  sourceIds: string[];
  agreementLevel: number; // 0-100
  visualStyle: {
    glowColor: string;
    warmth: number;
    pulseRate: BreathingRate;
  };
  boundingBox: {
    topLeft: LPPosition;
    bottomRight: LPPosition;
  };
}

export interface TensionZone {
  id: string;
  claimIds: string[];
  conflictingSources: {
    sourceId: string;
    position: string;
  }[];
  tensionLevel: number; // 0-100
  visualStyle: {
    crackleColor: string;
    energyLevel: number;
    sparkFrequency: number;
  };
  resolutionSuggestion?: string;
}

export interface ProvenanceTrail {
  id: string;
  claimId: string;
  sourceHops: {
    sourceId: string;
    excerpt: string;
    confidence: number;
  }[];
  visualPath: {
    color: string;
    luminosity: number;
    points: LPPosition[];
  };
}

export interface FusionResult {
  id: string;
  synthesizedContent: string;
  overallConfidence: ConfidenceScore;
  sourceContributions: {
    sourceId: string;
    percentage: number;
  }[];
  gapsIdentified: string[];
  contradictionsResolved: string[];
  openQuestions: string[];
}

// =============================================================================
// COGNITIVE LOAD MONITOR
// =============================================================================

export interface CognitiveLoadState {
  userId: string;
  sessionId: string;
  currentLoad: number; // 0-100
  loadHistory: CognitiveLoadDataPoint[];
  attentionHeatmap: AttentionHeatmap;
  fatigueIndicators: FatigueIndicator;
  complexityGradient: ComplexityGradient[];
  understandingConfidence: UnderstandingConfidence;
  overwhelmWarning: OverwhelmWarning;
  adaptations: CognitiveAdaptation[];
}

export interface CognitiveLoadDataPoint {
  timestamp: string;
  load: number;
  factors: {
    informationDensity: number;
    taskComplexity: number;
    timeOnTask: number;
    interactionFrequency: number;
  };
}

export interface AttentionHeatmap {
  resolution: { x: number; y: number };
  focusPoints: {
    position: LPPosition;
    duration: number;
    intensity: number;
  }[];
  blindSpots: {
    position: LPPosition;
    content: string;
    importance: number;
  }[];
  visualOverlay: {
    colors: string[];
    opacity: number;
  };
}

export interface FatigueIndicator {
  level: 'fresh' | 'engaged' | 'tired' | 'exhausted';
  sessionDuration: number; // minutes
  breakSuggested: boolean;
  uiBreathingRate: BreathingRate; // slows as fatigue increases
  visualEffects: {
    screenDimming: number;
    animationSlowdown: number;
    contrastReduction: number;
  };
}

export interface ComplexityGradient {
  contentId: string;
  position: LPPosition;
  complexityScore: number;
  suggestedAction: 'simplify' | 'break' | 'summarize' | 'none';
  visualStyle: {
    pulseIntensity: number;
    highlightColor: string;
  };
}

export interface UnderstandingConfidence {
  overall: number;
  bySection: {
    sectionId: string;
    confidence: number;
    confusionIndicators: string[];
  }[];
  visualHighlights: {
    position: LPPosition;
    type: 'understood' | 'confused' | 'skimmed';
    color: string;
  }[];
}

export interface OverwhelmWarning {
  active: boolean;
  level: number; // 0-100
  triggers: string[];
  visualEffect: {
    edgeBreathingColor: string;
    edgeBreathingRate: BreathingRate;
    edgeIntensity: number;
  };
  suggestions: string[];
}

export interface CognitiveAdaptation {
  id: string;
  type: 'simplify' | 'summarize' | 'chunk' | 'visualize' | 'pause';
  applied: boolean;
  impact: number;
  userAccepted: boolean;
}

// =============================================================================
// COUNCIL OF EXPERTS
// =============================================================================

export interface CouncilSession {
  id: string;
  tenantId: string;
  topic: string;
  question: string;
  experts: CouncilExpert[];
  debate: CouncilDebate;
  consensusState: ConsensusState;
  minorityReports: MinorityReport[];
  createdAt: string;
  status: 'convening' | 'debating' | 'converging' | 'concluded';
  conclusion?: CouncilConclusion;
}

export interface CouncilExpert {
  id: string;
  persona: string;
  specialization: string;
  modelId: string;
  avatar: {
    imageUrl?: string;
    color: string;
    icon: string;
  };
  breathingAura: {
    color: string;
    rate: BreathingRate;
    radius: number;
  };
  currentPosition: ExpertPosition;
  argumentHistory: ExpertArgument[];
  credibilityScore: number;
  agreementWith: Record<string, number>; // expert_id -> agreement
}

export interface ExpertPosition {
  stance: string;
  confidence: ConfidenceScore;
  keyPoints: string[];
  evidenceStrength: number;
  openToPersuasion: number; // 0-100
}

export interface ExpertArgument {
  id: string;
  content: string;
  timestamp: string;
  livingInk: {
    fontWeight: number;
    conviction: number;
  };
  targetedAt?: string; // expert_id being addressed
  type: 'assertion' | 'rebuttal' | 'concession' | 'question' | 'synthesis';
}

export interface CouncilDebate {
  rounds: DebateRound[];
  currentRound: number;
  argumentStreams: ArgumentStream[];
  dissentSparks: DissentSpark[];
}

export interface DebateRound {
  id: string;
  number: number;
  topic: string;
  arguments: ExpertArgument[];
  positionShifts: {
    expertId: string;
    from: string;
    to: string;
    reason: string;
  }[];
}

export interface ArgumentStream {
  expertId: string;
  flow: {
    position: LPPosition;
    fontWeight: number;
    text: string;
  }[];
  direction: 'outgoing' | 'incoming';
}

export interface DissentSpark {
  id: string;
  betweenExperts: [string, string];
  topic: string;
  intensity: number;
  visualArc: {
    startPos: LPPosition;
    endPos: LPPosition;
    color: string;
    sparkFrequency: number;
  };
}

export interface ConsensusState {
  level: number; // 0-100
  convergingOn: string[];
  divergentOn: string[];
  gravitationalCenter: LPPosition;
  expertPositions: {
    expertId: string;
    position: LPPosition;
    velocity: LPPosition; // movement toward/away from consensus
  }[];
}

export interface MinorityReport {
  id: string;
  expertId: string;
  position: string;
  reasoning: string;
  validityScore: number;
  visualPanel: {
    opacity: number;
    position: LPPosition;
    ghostStyle: boolean;
  };
}

export interface CouncilConclusion {
  summary: string;
  confidence: ConfidenceScore;
  supportingExperts: string[];
  dissentingExperts: string[];
  keyInsights: string[];
  actionItems: string[];
  uncertainties: string[];
}

// =============================================================================
// TEMPORAL DRIFT OBSERVATORY
// =============================================================================

export interface TemporalDriftObservatory {
  id: string;
  tenantId: string;
  monitoredFacts: DriftingFact[];
  driftAlerts: DriftAlert[];
  versionGhosts: VersionGhost[];
  updateWaves: UpdateWave[];
  citationHalfLives: CitationHalfLife[];
  overallDriftScore: number;
}

export interface DriftingFact {
  id: string;
  content: string;
  originalContent: string;
  originalLearnedAt: string;
  lastVerifiedAt: string;
  currentConfidence: ConfidenceScore;
  stabilityScore: number; // 0-100, how often it changes
  driftHistory: {
    timestamp: string;
    previousContent: string;
    newContent: string;
    changeType: 'minor' | 'moderate' | 'significant' | 'reversal';
  }[];
  livingInk: LPLivingInk;
  category: string;
}

export interface DriftAlert {
  id: string;
  factId: string;
  alertType: 'drift_detected' | 'reversal' | 'contradiction' | 'staleness';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  detectedAt: string;
  acknowledged: boolean;
  visualIndicator: {
    color: string;
    pulseRate: BreathingRate;
    icon: string;
  };
}

export interface VersionGhost {
  factId: string;
  versions: {
    version: number;
    content: string;
    validFrom: string;
    validTo?: string;
    confidence: number;
  }[];
  visualOverlay: {
    opacity: number;
    layerOffset: number;
    ghostColor: string;
  };
}

export interface UpdateWave {
  id: string;
  triggerFactId: string;
  affectedFactIds: string[];
  wavePattern: {
    origin: LPPosition;
    radius: number;
    speed: number;
    decay: number;
  }[];
  cascadeImpact: number;
  timestamp: string;
}

export interface CitationHalfLife {
  factId: string;
  category: string;
  estimatedHalfLife: number; // days
  confidenceInEstimate: number;
  basedOnSamples: number;
  decayCurve: {
    daysOut: number;
    predictedValidity: number;
  }[];
  visualIndicator: {
    fadeRate: number;
    currentOpacity: number;
  };
}

// =============================================================================
// DEBATE ARENA
// =============================================================================

export interface DebateArena {
  id: string;
  tenantId: string;
  topic: string;
  proposition: string;
  debaters: Debater[];
  arguments: DebateArgument[];
  attackDefenseFlows: AttackDefenseFlow[];
  weakPoints: WeakPoint[];
  steelManOverlays: SteelManOverlay[];
  resolutionTracker: ResolutionTracker;
  status: 'setup' | 'opening' | 'main' | 'rebuttal' | 'closing' | 'resolved';
  createdAt: string;
}

export interface Debater {
  id: string;
  name: string;
  side: 'proposition' | 'opposition';
  modelId: string;
  style: 'aggressive' | 'balanced' | 'defensive' | 'socratic';
  positionHeatmap: DebaterHeatmap;
  currentStrength: number;
  avatar: {
    color: string;
    icon: string;
  };
}

export interface DebaterHeatmap {
  debaterId: string;
  segments: {
    argumentId: string;
    position: LPPosition;
    strength: number;
    contested: boolean;
    color: string;
  }[];
  overallCoverage: number;
}

export interface DebateArgument {
  id: string;
  debaterId: string;
  content: string;
  type: 'claim' | 'evidence' | 'reasoning' | 'rebuttal' | 'concession';
  strength: number;
  targetArgumentId?: string;
  supportingArgumentIds: string[];
  timestamp: string;
  livingInk: LPLivingInk;
  position: LPPosition;
}

export interface AttackDefenseFlow {
  id: string;
  attackerId: string;
  defenderId: string;
  attackArgumentId: string;
  defenseArgumentId?: string;
  flowVisualization: {
    startPos: LPPosition;
    endPos: LPPosition;
    arrowStyle: 'attack' | 'defense' | 'counter';
    color: string;
    animationSpeed: number;
  };
  effectiveness: number;
}

export interface WeakPoint {
  id: string;
  argumentId: string;
  debaterId: string;
  vulnerability: string;
  exploitedBy?: string;
  breathingIndicator: {
    color: string;
    rate: BreathingRate;
    intensity: number;
  };
  position: LPPosition;
}

export interface SteelManOverlay {
  argumentId: string;
  strongerVersion: string;
  improvements: string[];
  visualOverlay: {
    opacity: number;
    ghostPath: LPGhostPath;
    enhancementGlow: string;
  };
  shown: boolean;
}

export interface ResolutionTracker {
  currentBalance: number; // -100 to 100 (neg=opposition, pos=proposition)
  balanceHistory: {
    timestamp: string;
    balance: number;
    triggerArgumentId: string;
  }[];
  projectedOutcome: 'proposition' | 'opposition' | 'undecided';
  confidenceInProjection: number;
  visualMeter: {
    position: number;
    momentum: number;
    color: string;
  };
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

// War Room API
export interface CreateWarRoomRequest {
  title: string;
  description: string;
  stakeLevel: 'low' | 'medium' | 'high' | 'critical';
  advisorConfig: {
    aiModels: string[];
    includeHumanExperts: boolean;
  };
  deadline?: string;
}

export interface WarRoomActionRequest {
  sessionId: string;
  action: 'add_advisor' | 'remove_advisor' | 'propose_path' | 'make_decision' | 'archive';
  payload: Record<string, unknown>;
}

// Memory Palace API
export interface ExploreMemoryPalaceRequest {
  roomId?: string;
  nodeId?: string;
  query?: string;
  includeStale?: boolean;
}

export interface MemoryPalaceNavigationResponse {
  currentRoom: MemoryRoom;
  visibleNodes: KnowledgeNode[];
  connections: MemoryConnection[];
  hotspots: DiscoveryHotspot[];
  fogLevel: number;
}

// Oracle View API
export interface CreateOracleViewRequest {
  title: string;
  timeHorizon: LPTimeRange;
  categories: string[];
  dataSourceIds: string[];
  includeBlackSwans: boolean;
}

// Synthesis Engine API
export interface CreateSynthesisRequest {
  title: string;
  sourceIds: string[];
  sourceTypes: ('document' | 'conversation' | 'database' | 'api')[];
  focusQuery?: string;
}

// Council API
export interface ConveneCouncilRequest {
  topic: string;
  question: string;
  expertPersonas: string[];
  maxRounds: number;
  convergenceThreshold: number;
}

// Debate Arena API
export interface CreateDebateRequest {
  topic: string;
  proposition: string;
  propositionModel: string;
  oppositionModel: string;
  style: 'formal' | 'socratic' | 'adversarial';
  maxRounds: number;
}

// Cognitive Load API
export interface CognitiveLoadUpdateRequest {
  sessionId: string;
  focusPoint?: LPPosition;
  interactionType: 'read' | 'scroll' | 'click' | 'type' | 'pause';
  contentId?: string;
  duration?: number;
}

// Temporal Drift API
export interface MonitorFactsRequest {
  factIds: string[];
  alertThreshold: 'any' | 'moderate' | 'significant';
  notifyOnDrift: boolean;
}

// =============================================================================
// DASHBOARD & METRICS TYPES
// =============================================================================

export interface LivingParchmentDashboard {
  warRooms: {
    active: number;
    decided: number;
    averageConfidence: number;
  };
  memoryPalace: {
    totalNodes: number;
    freshPercentage: number;
    discoveryHotspots: number;
  };
  oracleViews: {
    activePredictions: number;
    blackSwanAlerts: number;
    averageConfidenceDecay: number;
  };
  synthesisEngine: {
    activeSessions: number;
    tensionZones: number;
    resolutionRate: number;
  };
  cognitiveLoad: {
    averageLoad: number;
    overwhelmAlerts: number;
    adaptationsApplied: number;
  };
  councilOfExperts: {
    activeSessions: number;
    averageConsensus: number;
    minorityReports: number;
  };
  temporalDrift: {
    monitoredFacts: number;
    driftAlerts: number;
    averageStability: number;
  };
  debateArena: {
    activeDebates: number;
    resolvedDebates: number;
    averageResolutionRounds: number;
  };
}

export interface LivingParchmentConfig {
  tenantId: string;
  features: {
    warRoomEnabled: boolean;
    memoryPalaceEnabled: boolean;
    oracleViewEnabled: boolean;
    synthesisEngineEnabled: boolean;
    cognitiveLoadEnabled: boolean;
    councilOfExpertsEnabled: boolean;
    temporalDriftEnabled: boolean;
    debateArenaEnabled: boolean;
  };
  defaults: {
    breathingRateBase: BreathingRate;
    confidenceThreshold: number;
    stalenessThresholdDays: number;
    maxAdvisors: number;
    maxExperts: number;
    maxDebateRounds: number;
  };
  visualSettings: {
    heatmapColorScheme: 'standard' | 'accessible' | 'dark' | 'custom';
    customColors?: Record<string, string>;
    animationIntensity: 'subtle' | 'normal' | 'vivid';
    ghostOpacity: number;
  };
}
