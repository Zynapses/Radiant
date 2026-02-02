/**
 * RADIANT Neural Operations Center Types
 * Types for the Neural Operations dashboard showing CORTEX network status,
 * shadow validation, thermal state, and regional deployment status.
 */

// =============================================================================
// CORTEX Network Types
// =============================================================================

export type CortexNetworkId = 
  | 'pattern'      // Pattern Network - ranks similar past prompts
  | 'routing'      // Routing Network - selects AI model for task
  | 'topology'     // Topology Network - chooses orchestration mode
  | 'clarion'      // CLARION Network - ranks clarifying questions
  | 'combination'  // Combination Network - scores model combinations
  | 'user';        // User Network - personalizes via Ghost Vector

export interface CortexNetworkStatus {
  id: CortexNetworkId;
  name: string;
  version: string;
  status: 'active' | 'degraded' | 'offline' | 'shadow';
  parameters: number;           // e.g., 1200000 for ~1.2M
  requestsPerSecond: number;
  latencyP50Ms: number;
  latencyP99Ms: number;
  errorRate: number;            // 0.0 to 1.0
  lastUpdated: string;          // ISO timestamp
  lastDeployedAt: string;       // ISO timestamp
  region: string;
}

export interface CortexNetworkMetrics {
  networkId: CortexNetworkId;
  timestamp: string;
  requestCount: number;
  errorCount: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p99LatencyMs: number;
  memoryUsageMb: number;
  cpuUtilization: number;       // 0.0 to 1.0
}

// =============================================================================
// Shadow Validation Types
// =============================================================================

export type ShadowStatus = 'pending' | 'running' | 'passed' | 'failed' | 'aborted';

export interface ShadowValidation {
  id: string;
  networkId: CortexNetworkId;
  networkName: string;
  currentVersion: string;
  candidateVersion: string;
  status: ShadowStatus;
  startedAt: string;
  estimatedEndAt: string;
  progressPercent: number;      // 0 to 100
  durationMinutes: number;
  metrics: {
    errorRate: number;          // Threshold: > 0.1% = FAIL
    latencyDeltaMs: number;     // Threshold: > +50ms = WARN
    outputDivergencePercent: number; // Threshold: > 15% = WARN
    memoryOverheadPercent: number;   // Threshold: > +20% = WARN
  };
  warnings: string[];
  canAbort: boolean;
}

// =============================================================================
// Regional Status Types
// =============================================================================

export type NeuralThermalState = 'cold' | 'warming' | 'warm' | 'hot';

export interface RegionStatus {
  regionId: string;             // e.g., 'us-east-1'
  regionName: string;           // e.g., 'US East (N. Virginia)'
  status: 'online' | 'degraded' | 'offline';
  thermalState: NeuralThermalState;
  activeCartridge?: {
    id: string;
    name: string;
    version: string;
  };
  networks: {
    total: number;
    active: number;
    degraded: number;
    offline: number;
  };
  latencyMs: number;            // Average response latency
  requestsPerSecond: number;
  lastHealthCheck: string;
}

export interface ThermalStateOverride {
  regionId: string;
  targetState: NeuralThermalState;
  reason: string;
  createdBy: string;
  createdAt: string;
  expiresAt?: string;
  autoRevert: boolean;
}

// =============================================================================
// Deployment History Types
// =============================================================================

export type NeuralDeploymentStatus = 'pending' | 'deploying' | 'promoted' | 'rejected' | 'rolled_back';

export interface NetworkDeployment {
  id: string;
  networkId: CortexNetworkId;
  networkName: string;
  version: string;
  previousVersion?: string;
  status: NeuralDeploymentStatus;
  deployedAt: string;
  deployedBy: string;
  region: string;
  shadowValidationId?: string;
  rollbackReason?: string;
}

// =============================================================================
// Dashboard Data Types
// =============================================================================

export interface NeuralOperationsDashboard {
  summary: {
    systemStatus: 'healthy' | 'degraded' | 'critical';
    networksActive: number;
    networksTotal: number;
    regionsOnline: number;
    regionsTotal: number;
    alertCount: number;
  };
  networks: CortexNetworkStatus[];
  shadowValidations: ShadowValidation[];
  regions: RegionStatus[];
  recentDeployments: NetworkDeployment[];
  alerts: NeuralAlert[];
}

export interface NeuralAlert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  networkId?: CortexNetworkId;
  regionId?: string;
  createdAt: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

// =============================================================================
// API Request/Response Types
// =============================================================================

export interface GetNeuralDashboardRequest {
  includeMetrics?: boolean;
  includeHistory?: boolean;
  regionsFilter?: string[];
}

export interface NetworkMetricsRequest {
  networkId: CortexNetworkId;
  startTime: string;
  endTime: string;
  granularity: 'minute' | 'hour' | 'day';
}

export interface ThermalOverrideRequest {
  regionId: string;
  targetState: NeuralThermalState;
  reason: string;
  durationMinutes?: number;
  autoRevert?: boolean;
}

export interface AbortShadowRequest {
  validationId: string;
  reason: string;
}

export interface AcknowledgeAlertRequest {
  alertId: string;
}

// =============================================================================
// Constants
// =============================================================================

export const CORTEX_NETWORK_CONFIG: Record<CortexNetworkId, {
  name: string;
  description: string;
  parameters: number;
  inputDim: number;
  outputDim: number;
  layers: number[];
}> = {
  pattern: {
    name: 'Pattern Network',
    description: 'Ranks similar past prompts for context retrieval',
    parameters: 1200000,
    inputDim: 768,
    outputDim: 128,
    layers: [768, 512, 256, 128],
  },
  routing: {
    name: 'Routing Network',
    description: 'Selects optimal AI model for the task',
    parameters: 200000,
    inputDim: 512,
    outputDim: 106,  // Number of available models
    layers: [512, 256, 128],
  },
  topology: {
    name: 'Topology Network',
    description: 'Chooses orchestration mode and pipeline',
    parameters: 800000,
    inputDim: 1024,
    outputDim: 256,
    layers: [1024, 512, 256, 256],
  },
  clarion: {
    name: 'CLARION Network',
    description: 'Ranks clarifying questions by relevance',
    parameters: 200000,
    inputDim: 512,
    outputDim: 64,
    layers: [512, 256, 128],
  },
  combination: {
    name: 'Combination Network',
    description: 'Scores multi-model combinations',
    parameters: 50000,
    inputDim: 256,
    outputDim: 1,
    layers: [256, 128, 64, 1],
  },
  user: {
    name: 'User Network',
    description: 'Personalizes responses via Ghost Vector',
    parameters: 50000,
    inputDim: 128,
    outputDim: 64,
    layers: [128, 64, 32, 64],
  },
};

export const THERMAL_STATE_CONFIG: Record<NeuralThermalState, {
  label: string;
  color: string;
  description: string;
  latencyRange: string;
}> = {
  cold: {
    label: 'Cold',
    color: 'blue',
    description: 'No cartridge installed, minimal resources',
    latencyRange: '30-60s warmup',
  },
  warming: {
    label: 'Warming',
    color: 'yellow',
    description: 'Cartridge installing, scaling up',
    latencyRange: '10-30s',
  },
  warm: {
    label: 'Warm',
    color: 'green',
    description: 'Cartridge active, full inference capability',
    latencyRange: '<100ms',
  },
  hot: {
    label: 'Hot',
    color: 'red',
    description: 'High demand, auto-scaled resources',
    latencyRange: '<50ms',
  },
};

export const SHADOW_THRESHOLDS = {
  errorRateMax: 0.001,          // 0.1% - immediate FAIL
  latencyDeltaWarn: 50,         // +50ms - extend window
  divergenceWarn: 0.15,         // 15% - extend window
  memoryOverheadWarn: 0.20,     // +20% - investigate
  defaultDurationMinutes: 60,
} as const;
