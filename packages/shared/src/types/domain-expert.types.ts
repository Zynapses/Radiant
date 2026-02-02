/**
 * RADIANT Domain Expert Cortex Types
 * 7 specialized neural networks per domain for deep domain expertise
 * 
 * Each domain (healthcare, legal, finance, etc.) has its own set of:
 * 1. Entity Classifier - Classifies domain-specific entities
 * 2. Contraindication Net - Flags dangerous/incompatible combinations
 * 3. Protocol Matcher - Matches to standard protocols/procedures
 * 4. Severity Assessor - Assesses severity/urgency levels
 * 5. Personalization Net - Personalizes based on user history
 * 6. Citation Network - Finds relevant citations/references
 * 7. Orchestration Selector - Selects optimal orchestration mode
 */

// =============================================================================
// Domain Expert Network Types
// =============================================================================

export type DomainExpertNetworkType =
  | 'entity_classifier'
  | 'contraindication_net'
  | 'protocol_matcher'
  | 'severity_assessor'
  | 'personalization_net'
  | 'citation_network'
  | 'orchestration_selector';

export type DomainExpertStatus = 'active' | 'training' | 'validating' | 'inactive' | 'failed';

export interface DomainExpertNetworkConfig {
  type: DomainExpertNetworkType;
  name: string;
  description: string;
  defaultParameters: number;     // ~4M each
  inputDim: number;
  outputDim: number;
  layers: number[];
  activationFunction: 'relu' | 'gelu' | 'silu';
  dropoutRate: number;
}

export const DOMAIN_EXPERT_NETWORK_CONFIGS: Record<DomainExpertNetworkType, DomainExpertNetworkConfig> = {
  entity_classifier: {
    type: 'entity_classifier',
    name: 'Entity Classifier',
    description: 'Classifies domain-specific entities (e.g., medications, legal terms, financial instruments)',
    defaultParameters: 4000000,
    inputDim: 768,
    outputDim: 512,
    layers: [768, 1024, 1024, 512],
    activationFunction: 'gelu',
    dropoutRate: 0.1,
  },
  contraindication_net: {
    type: 'contraindication_net',
    name: 'Contraindication Network',
    description: 'Flags dangerous or incompatible combinations (drug interactions, legal conflicts)',
    defaultParameters: 4000000,
    inputDim: 1024,
    outputDim: 256,
    layers: [1024, 1024, 512, 256],
    activationFunction: 'relu',
    dropoutRate: 0.15,
  },
  protocol_matcher: {
    type: 'protocol_matcher',
    name: 'Protocol Matcher',
    description: 'Matches queries to standard protocols and procedures',
    defaultParameters: 4000000,
    inputDim: 768,
    outputDim: 256,
    layers: [768, 1024, 512, 256],
    activationFunction: 'gelu',
    dropoutRate: 0.1,
  },
  severity_assessor: {
    type: 'severity_assessor',
    name: 'Severity Assessor',
    description: 'Assesses severity and urgency levels for prioritization',
    defaultParameters: 4000000,
    inputDim: 512,
    outputDim: 64,
    layers: [512, 512, 256, 64],
    activationFunction: 'relu',
    dropoutRate: 0.1,
  },
  personalization_net: {
    type: 'personalization_net',
    name: 'Personalization Network',
    description: 'Personalizes responses based on user history and preferences',
    defaultParameters: 4000000,
    inputDim: 640,
    outputDim: 256,
    layers: [640, 512, 384, 256],
    activationFunction: 'gelu',
    dropoutRate: 0.05,
  },
  citation_network: {
    type: 'citation_network',
    name: 'Citation Network',
    description: 'Finds and ranks relevant citations, references, and sources',
    defaultParameters: 4000000,
    inputDim: 768,
    outputDim: 128,
    layers: [768, 512, 256, 128],
    activationFunction: 'gelu',
    dropoutRate: 0.1,
  },
  orchestration_selector: {
    type: 'orchestration_selector',
    name: 'Orchestration Selector',
    description: 'Selects optimal orchestration mode and model combination',
    defaultParameters: 4000000,
    inputDim: 512,
    outputDim: 128,
    layers: [512, 384, 256, 128],
    activationFunction: 'relu',
    dropoutRate: 0.1,
  },
};

// =============================================================================
// Domain Configuration
// =============================================================================

export interface DomainExpertConfig {
  domainId: string;               // e.g., 'healthcare', 'legal', 'finance'
  displayName: string;
  isTrainingDomain: boolean;      // If true, shows "Example Domain" badge
  enabled: boolean;
  
  // Entity configuration
  numEntities: number;            // Number of entity types in this domain
  numActions: number;             // Number of action types
  numProtocols: number;           // Number of standard protocols
  
  // Safety configuration
  safetyThreshold: number;        // 0.0-1.0, minimum 0.5 for safety-critical domains
  citationRequired: boolean;      // Require citations for all responses
  
  // Model preferences
  defaultModels: string[];        // Preferred models for this domain
  safetyModel: string;            // Model for safety checks
  
  // Network overrides (optional per-domain customization)
  networkOverrides?: Partial<Record<DomainExpertNetworkType, {
    parameters?: number;
    inputDim?: number;
    outputDim?: number;
  }>>;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// =============================================================================
// Domain Expert Instance (Deployed Network)
// =============================================================================

export interface DomainExpertNetwork {
  id: string;
  tenantId: string;
  domainId: string;
  networkType: DomainExpertNetworkType;
  
  // Version and status
  version: string;
  status: DomainExpertStatus;
  
  // Network parameters
  parameters: number;
  inputDim: number;
  outputDim: number;
  
  // Storage
  storageKey: string;             // S3 key for ONNX file
  storageBucket: string;
  fileSizeBytes: number;
  checksum: string;
  
  // Performance metrics
  latencyP50Ms: number;
  latencyP99Ms: number;
  errorRate: number;
  requestsPerSecond: number;
  
  // Training info
  trainedAt?: string;
  trainedBy?: string;
  trainingDatasetId?: string;
  trainingMetrics?: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    lossValue: number;
  };
  
  // Audit
  createdAt: string;
  updatedAt: string;
  deployedAt?: string;
  deployedBy?: string;
}

// =============================================================================
// Domain Expert Suite (All 7 Networks for a Domain)
// =============================================================================

export interface DomainExpertSuite {
  domainId: string;
  domainName: string;
  config: DomainExpertConfig;
  networks: Record<DomainExpertNetworkType, DomainExpertNetwork | null>;
  completeness: number;           // 0-100%, how many of 7 networks are deployed
  status: 'complete' | 'partial' | 'none';
  totalParameters: number;        // Sum of all network parameters
  lastUpdated: string;
}

// =============================================================================
// Inference Types
// =============================================================================

export interface DomainExpertInferenceRequest {
  tenantId: string;
  domainId: string;
  networkType: DomainExpertNetworkType;
  input: {
    embedding: number[];          // Input embedding vector
    context?: Record<string, unknown>;
    userId?: string;              // For personalization
  };
  options?: {
    temperature?: number;
    topK?: number;
    threshold?: number;
  };
}

export interface DomainExpertInferenceResult {
  networkType: DomainExpertNetworkType;
  domainId: string;
  output: number[];               // Output embedding/scores
  confidence: number;
  latencyMs: number;
  
  // Type-specific interpretations
  interpretation?: {
    // For entity_classifier
    entities?: Array<{ id: string; name: string; score: number }>;
    // For contraindication_net
    contraindications?: Array<{ entityA: string; entityB: string; severity: string; reason: string }>;
    // For protocol_matcher
    protocols?: Array<{ id: string; name: string; matchScore: number }>;
    // For severity_assessor
    severity?: { level: 'low' | 'medium' | 'high' | 'critical'; score: number; factors: string[] };
    // For citation_network
    citations?: Array<{ id: string; title: string; relevanceScore: number }>;
    // For orchestration_selector
    orchestration?: { mode: string; models: string[]; confidence: number };
  };
}

// =============================================================================
// Training Types
// =============================================================================

export type TrainingStatus = 'pending' | 'preparing' | 'training' | 'validating' | 'completed' | 'failed';

export interface DomainExpertTrainingJob {
  id: string;
  tenantId: string;
  domainId: string;
  networkType: DomainExpertNetworkType;
  
  // Status
  status: TrainingStatus;
  progressPercent: number;
  currentEpoch: number;
  totalEpochs: number;
  
  // Configuration
  config: {
    learningRate: number;
    batchSize: number;
    epochs: number;
    warmupSteps: number;
    weightDecay: number;
    earlyStopping: boolean;
    earlyStoppingPatience: number;
  };
  
  // Dataset
  datasetId: string;
  datasetSize: number;
  trainSplit: number;
  validationSplit: number;
  
  // Metrics (updated during training)
  metrics?: {
    trainingLoss: number[];
    validationLoss: number[];
    accuracy: number[];
    bestEpoch: number;
    bestAccuracy: number;
  };
  
  // Output
  outputNetworkId?: string;
  outputVersion?: string;
  
  // Timing
  startedAt?: string;
  completedAt?: string;
  estimatedTimeRemaining?: number;
  
  // Audit
  createdAt: string;
  createdBy: string;
  error?: string;
}

// =============================================================================
// API Request/Response Types
// =============================================================================

export interface ListDomainExpertsRequest {
  tenantId: string;
  domainId?: string;
  networkType?: DomainExpertNetworkType;
  status?: DomainExpertStatus;
  limit?: number;
  offset?: number;
}

export interface ListDomainExpertsResponse {
  suites: DomainExpertSuite[];
  total: number;
}

export interface CreateDomainConfigRequest {
  domainId: string;
  displayName: string;
  isTrainingDomain?: boolean;
  numEntities: number;
  numActions: number;
  numProtocols: number;
  safetyThreshold: number;
  citationRequired?: boolean;
  defaultModels?: string[];
  safetyModel?: string;
}

export interface UpdateDomainConfigRequest {
  displayName?: string;
  isTrainingDomain?: boolean;
  enabled?: boolean;
  numEntities?: number;
  numActions?: number;
  numProtocols?: number;
  safetyThreshold?: number;
  citationRequired?: boolean;
  defaultModels?: string[];
  safetyModel?: string;
}

export interface DeployNetworkRequest {
  tenantId: string;
  domainId: string;
  networkType: DomainExpertNetworkType;
  version: string;
  storageKey: string;
  parameters?: number;
}

export interface StartTrainingRequest {
  tenantId: string;
  domainId: string;
  networkType: DomainExpertNetworkType;
  datasetId: string;
  config?: Partial<DomainExpertTrainingJob['config']>;
}

// =============================================================================
// Dashboard Types
// =============================================================================

export interface DomainExpertDashboard {
  summary: {
    totalDomains: number;
    domainsWithExperts: number;
    totalNetworks: number;
    activeNetworks: number;
    trainingJobs: number;
    totalParameters: number;
  };
  domains: DomainExpertSuite[];
  recentTrainingJobs: DomainExpertTrainingJob[];
  alerts: Array<{
    id: string;
    severity: 'info' | 'warning' | 'error';
    message: string;
    domainId?: string;
    networkType?: DomainExpertNetworkType;
    createdAt: string;
  }>;
}

// =============================================================================
// Predefined Domains
// =============================================================================

export const PREDEFINED_DOMAINS: Partial<DomainExpertConfig>[] = [
  {
    domainId: 'healthcare',
    displayName: 'Healthcare',
    isTrainingDomain: false,
    numEntities: 50000,
    numActions: 1000,
    numProtocols: 500,
    safetyThreshold: 0.95,
    citationRequired: true,
  },
  {
    domainId: 'legal',
    displayName: 'Legal',
    isTrainingDomain: false,
    numEntities: 30000,
    numActions: 500,
    numProtocols: 200,
    safetyThreshold: 0.90,
    citationRequired: true,
  },
  {
    domainId: 'finance',
    displayName: 'Finance',
    isTrainingDomain: false,
    numEntities: 25000,
    numActions: 800,
    numProtocols: 300,
    safetyThreshold: 0.85,
    citationRequired: true,
  },
  {
    domainId: 'fitness',
    displayName: 'Fitness & Wellness',
    isTrainingDomain: true,  // Example domain for testing
    numEntities: 5000,
    numActions: 200,
    numProtocols: 100,
    safetyThreshold: 0.70,
    citationRequired: false,
  },
  {
    domainId: 'education',
    displayName: 'Education',
    isTrainingDomain: false,
    numEntities: 10000,
    numActions: 300,
    numProtocols: 150,
    safetyThreshold: 0.60,
    citationRequired: false,
  },
  {
    domainId: 'technology',
    displayName: 'Technology',
    isTrainingDomain: false,
    numEntities: 15000,
    numActions: 400,
    numProtocols: 100,
    safetyThreshold: 0.50,
    citationRequired: false,
  },
];
