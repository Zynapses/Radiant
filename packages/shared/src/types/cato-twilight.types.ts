/**
 * RADIANT CATO Twilight Dreaming Types
 * 30% Invention Minimum Enforcement & PromptBreeder 9-Operator System
 * 
 * "Twilight Dreaming" is the period when CATO is not actively responding
 * to requests but is instead evolving prompts, generating inventions,
 * and exploring creative spaces to ensure 30% novelty in responses.
 */

// =============================================================================
// PromptBreeder Operator Types
// =============================================================================

export type PromptBreederOperator =
  | 'zero_order_hypermutation'      // Random mutations to prompt
  | 'first_order_hypermutation'     // Mutations guided by gradient-like signals
  | 'estimation_of_distribution'    // Learn distribution of good prompts
  | 'lineage_based_mutation'        // Mutations based on ancestry
  | 'crossover'                     // Combine two prompts
  | 'lamarckian_mutation'           // Mutations that persist across generations
  | 'context_shuffling'             // Reorder/shuffle context elements
  | 'working_memory_expansion'      // Expand relevant context
  | 'elm';                          // Extreme Learning Mutation - radical changes

export interface PromptBreederOperatorConfig {
  operator: PromptBreederOperator;
  name: string;
  description: string;
  weight: number;                   // Selection probability (0.0-1.0)
  enabled: boolean;
  parameters: Record<string, unknown>;
}

export const DEFAULT_OPERATOR_CONFIGS: Record<PromptBreederOperator, PromptBreederOperatorConfig> = {
  zero_order_hypermutation: {
    operator: 'zero_order_hypermutation',
    name: 'Zero-Order Hypermutation',
    description: 'Random mutations without gradient guidance',
    weight: 0.15,
    enabled: true,
    parameters: { mutationRate: 0.1, maxMutations: 5 },
  },
  first_order_hypermutation: {
    operator: 'first_order_hypermutation',
    name: 'First-Order Hypermutation',
    description: 'Gradient-guided mutations based on fitness landscape',
    weight: 0.20,
    enabled: true,
    parameters: { learningRate: 0.01, gradientSteps: 3 },
  },
  estimation_of_distribution: {
    operator: 'estimation_of_distribution',
    name: 'Estimation of Distribution',
    description: 'Learn and sample from distribution of successful prompts',
    weight: 0.15,
    enabled: true,
    parameters: { populationSize: 50, eliteRatio: 0.2 },
  },
  lineage_based_mutation: {
    operator: 'lineage_based_mutation',
    name: 'Lineage-Based Mutation',
    description: 'Mutations influenced by prompt ancestry',
    weight: 0.10,
    enabled: true,
    parameters: { ancestryDepth: 5, inheritanceWeight: 0.3 },
  },
  crossover: {
    operator: 'crossover',
    name: 'Crossover',
    description: 'Combine elements from two parent prompts',
    weight: 0.15,
    enabled: true,
    parameters: { crossoverPoints: 2, uniformRate: 0.5 },
  },
  lamarckian_mutation: {
    operator: 'lamarckian_mutation',
    name: 'Lamarckian Mutation',
    description: 'Persist successful adaptations across generations',
    weight: 0.10,
    enabled: true,
    parameters: { acquisitionRate: 0.1, retentionThreshold: 0.8 },
  },
  context_shuffling: {
    operator: 'context_shuffling',
    name: 'Context Shuffling',
    description: 'Reorder context elements to discover new patterns',
    weight: 0.05,
    enabled: true,
    parameters: { shuffleRatio: 0.3, preserveStructure: true },
  },
  working_memory_expansion: {
    operator: 'working_memory_expansion',
    name: 'Working Memory Expansion',
    description: 'Expand relevant context from memory',
    weight: 0.05,
    enabled: true,
    parameters: { expansionFactor: 1.5, relevanceThreshold: 0.7 },
  },
  elm: {
    operator: 'elm',
    name: 'Extreme Learning Mutation',
    description: 'Radical, exploratory mutations for breakthrough discoveries',
    weight: 0.05,
    enabled: true,
    parameters: { extremityLevel: 0.8, safetyBound: true },
  },
};

// =============================================================================
// Prompt Evolution Types
// =============================================================================

export interface PromptGenome {
  id: string;
  tenantId: string;
  
  // Core content
  systemPrompt: string;
  taskContext: string;
  constraints: string[];
  examples: string[];
  
  // Metadata
  generation: number;              // Evolution generation
  parentIds: string[];             // Parent genome IDs (1 or 2)
  operatorUsed: PromptBreederOperator;
  
  // Fitness metrics
  fitness: number;                 // 0.0-1.0 overall fitness
  noveltyScore: number;            // 0.0-1.0 novelty measure
  qualityScore: number;            // 0.0-1.0 quality measure
  safetyScore: number;             // 0.0-1.0 safety compliance
  
  // Usage stats
  usageCount: number;
  successRate: number;
  avgResponseQuality: number;
  
  // Lineage
  ancestry: string[];              // Full ancestry chain
  mutations: string[];             // Mutations applied
  
  // Status
  status: 'active' | 'archived' | 'testing' | 'champion';
  isChampion: boolean;             // Current best performer
  
  // Timestamps
  createdAt: string;
  evaluatedAt?: string;
  archivedAt?: string;
}

export interface PromptPopulation {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  
  // Population config
  targetSize: number;              // Target population size
  eliteCount: number;              // Number of elites to preserve
  mutationRate: number;            // Base mutation rate
  crossoverRate: number;           // Crossover probability
  
  // Current state
  generation: number;
  currentSize: number;
  championId?: string;
  avgFitness: number;
  maxFitness: number;
  diversityIndex: number;          // Population diversity measure
  
  // Operator weights (can override defaults)
  operatorWeights: Partial<Record<PromptBreederOperator, number>>;
  
  // Evolution history
  fitnessHistory: Array<{ generation: number; avg: number; max: number }>;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  lastEvolutionAt?: string;
}

// =============================================================================
// 30% Invention Enforcement Types
// =============================================================================

export interface InventionMetrics {
  tenantId: string;
  userId?: string;
  sessionId?: string;
  
  // Current metrics
  totalResponses: number;
  inventiveResponses: number;      // Responses with novelty > threshold
  inventionRate: number;           // inventiveResponses / totalResponses
  
  // Rolling window (last N responses)
  windowSize: number;
  windowInventionRate: number;
  
  // Targets
  targetInventionRate: number;     // Default 0.30 (30%)
  currentDeficit: number;          // How far below target
  
  // Enforcement state
  enforcementMode: 'passive' | 'active' | 'aggressive';
  consecutiveNonInventive: number;
  lastInventiveAt?: string;
  
  // Period metrics
  periodStart: string;
  periodEnd?: string;
}

export interface InventionEnforcementConfig {
  tenantId: string;
  
  // Target
  targetInventionRate: number;     // 0.0-1.0, default 0.30
  minInventionRate: number;        // Minimum acceptable, default 0.20
  maxInventionRate: number;        // Maximum (to prevent chaos), default 0.50
  
  // Detection thresholds
  noveltyThreshold: number;        // Min novelty to count as inventive
  creativityThreshold: number;     // Min creativity score
  
  // Enforcement
  enforcementEnabled: boolean;
  passiveModeBelowTarget: number;  // Switch to active at this deficit
  activeModeBelowTarget: number;   // Switch to aggressive at this deficit
  
  // Twilight Dreaming schedule
  dreamingEnabled: boolean;
  dreamingSchedule: 'continuous' | 'scheduled' | 'on_demand';
  dreamingWindowStart?: string;    // e.g., "02:00" UTC
  dreamingWindowEnd?: string;      // e.g., "06:00" UTC
  dreamingFrequencyMinutes: number;
  
  // Safety
  maxInventionPerSession: number;  // Cap per session
  safetyOverrideInvention: boolean; // Safety always overrides invention
  
  createdAt: string;
  updatedAt: string;
}

export interface InventionCandidate {
  id: string;
  tenantId: string;
  
  // Source
  source: 'twilight_dreaming' | 'user_interaction' | 'prompt_evolution';
  populationId?: string;
  genomeId?: string;
  
  // Content
  inventionType: 'prompt_pattern' | 'response_template' | 'reasoning_chain' | 'creative_format';
  content: string;
  description?: string;
  
  // Scores
  noveltyScore: number;
  utilityScore: number;
  safetyScore: number;
  overallScore: number;
  
  // Evaluation
  status: 'pending' | 'evaluated' | 'approved' | 'rejected' | 'deployed';
  evaluatedBy?: string;
  evaluationNotes?: string;
  
  // Usage tracking
  usageCount: number;
  successRate: number;
  
  // Timestamps
  createdAt: string;
  evaluatedAt?: string;
  deployedAt?: string;
}

// =============================================================================
// Twilight Dreaming Session Types
// =============================================================================

export type DreamingSessionStatus = 'scheduled' | 'running' | 'paused' | 'completed' | 'failed';

export interface TwilightDreamingSession {
  id: string;
  tenantId: string;
  
  // Session info
  status: DreamingSessionStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  
  // Evolution stats
  populationId: string;
  startGeneration: number;
  endGeneration?: number;
  generationsEvolved: number;
  
  // Operator usage
  operatorUsage: Record<PromptBreederOperator, number>;
  
  // Results
  genomesCreated: number;
  genomesEvaluated: number;
  inventionsCandidated: number;
  inventionsApproved: number;
  
  // Fitness improvements
  startAvgFitness: number;
  endAvgFitness?: number;
  fitnessImprovement?: number;
  
  // Champion tracking
  newChampionFound: boolean;
  newChampionId?: string;
  newChampionFitness?: number;
  
  // Error tracking
  error?: string;
  
  // Timestamps
  scheduledAt: string;
  createdAt: string;
}

// =============================================================================
// API Request/Response Types
// =============================================================================

export interface StartDreamingSessionRequest {
  tenantId: string;
  populationId?: string;           // Use existing or create new
  generationsToEvolve?: number;    // Default: 10
  operatorOverrides?: Partial<Record<PromptBreederOperator, number>>;
}

export interface StartDreamingSessionResponse {
  sessionId: string;
  status: DreamingSessionStatus;
  populationId: string;
  estimatedDurationMs: number;
}

export interface GetDreamingDashboardRequest {
  tenantId: string;
}

export interface DreamingDashboard {
  summary: {
    totalPopulations: number;
    totalGenomes: number;
    totalInventions: number;
    approvedInventions: number;
    avgFitnessAllPopulations: number;
    currentInventionRate: number;
    targetInventionRate: number;
  };
  
  activeSession?: TwilightDreamingSession;
  recentSessions: TwilightDreamingSession[];
  
  populations: Array<{
    population: PromptPopulation;
    topGenomes: PromptGenome[];
  }>;
  
  inventionMetrics: InventionMetrics;
  enforcementConfig: InventionEnforcementConfig;
  
  recentInventions: InventionCandidate[];
}

export interface EvolvePopulationRequest {
  tenantId: string;
  populationId: string;
  generations?: number;
  operators?: PromptBreederOperator[];
}

export interface EvaluateGenomeRequest {
  tenantId: string;
  genomeId: string;
  testPrompts: string[];
  evaluationCriteria?: {
    noveltyWeight: number;
    qualityWeight: number;
    safetyWeight: number;
  };
}

export interface ApproveInventionRequest {
  inventionId: string;
  notes?: string;
  deployImmediately?: boolean;
}

export interface UpdateEnforcementConfigRequest {
  targetInventionRate?: number;
  enforcementEnabled?: boolean;
  dreamingEnabled?: boolean;
  dreamingSchedule?: 'continuous' | 'scheduled' | 'on_demand';
  dreamingWindowStart?: string;
  dreamingWindowEnd?: string;
}

// =============================================================================
// Constants
// =============================================================================

export const INVENTION_RATE_TARGET = 0.30;  // 30% invention minimum
export const INVENTION_RATE_MIN = 0.20;     // Minimum acceptable
export const INVENTION_RATE_MAX = 0.50;     // Maximum to prevent chaos

export const DEFAULT_POPULATION_SIZE = 100;
export const DEFAULT_ELITE_COUNT = 10;
export const DEFAULT_MUTATION_RATE = 0.1;
export const DEFAULT_CROSSOVER_RATE = 0.7;

export const DREAMING_FREQUENCY_MINUTES = 60;  // Default: hourly
export const GENERATIONS_PER_SESSION = 10;

export const NOVELTY_THRESHOLD = 0.6;         // Min score to be "inventive"
export const CREATIVITY_THRESHOLD = 0.5;      // Min creativity score
