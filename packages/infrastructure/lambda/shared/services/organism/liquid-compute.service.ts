// RADIANT Autonomous Organism - Liquid Compute Topology
// Dynamic compute location selection: Browser, Local, Edge, Cloud
// Version: 1.0.0

import { randomUUID } from 'crypto';
import { executeStatement, stringParam, longParam, doubleParam, boolParam } from '../../db/client';
import { createRegisteredLogger } from '../logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'organism/liquid-compute',
  category: 'infrastructure',
  sourceType: 'application',
});

// ============================================================================
// Types
// ============================================================================

type ComputeLocation = 'browser' | 'local' | 'edge' | 'cloud';
type ComputeReason = 'privacy' | 'latency' | 'cost' | 'capability' | 'availability' | 'user_preference';
type ToolSensitivity = 'public' | 'internal' | 'confidential' | 'restricted';

interface LiquidComputeDecision {
  decisionId: string;
  toolId: string;
  selectedLocation: ComputeLocation;
  reason: ComputeReason;
  alternatives: Array<{
    location: ComputeLocation;
    score: number;
    disqualifyReason?: string;
  }>;
  executionEndpoint: string;
  estimatedLatencyMs: number;
  estimatedCost: number;
}

interface ComputeTopology {
  tenantId: string;
  browserCapabilities: BrowserCapabilities;
  localCapabilities?: LocalCapabilities;
  edgeLocations: EdgeLocation[];
  cloudRegions: CloudRegion[];
  defaultLocation: ComputeLocation;
  domainLocationOverrides: Record<string, ComputeLocation>;
  sensitivityLocationRules: Record<ToolSensitivity, ComputeLocation[]>;
}

interface BrowserCapabilities {
  wasmSupported: boolean;
  webGPUSupported: boolean;
  maxMemoryMb: number;
  estimatedComputeScore: number;
  supportedModels: string[];
}

interface LocalCapabilities {
  available: boolean;
  platform: 'macos' | 'windows' | 'linux';
  gpuAvailable: boolean;
  gpuModel?: string;
  memoryGb: number;
  supportedModels: string[];
}

interface EdgeLocation {
  locationId: string;
  region: string;
  provider: 'cloudflare' | 'lambda_edge' | 'fastly' | 'vercel';
  latencyFromUserMs: number;
  capabilities: string[];
  costMultiplier: number;
}

interface CloudRegion {
  regionId: string;
  provider: 'aws' | 'gcp' | 'azure';
  region: string;
  latencyFromUserMs: number;
  costPerRequest: number;
  availableServices: string[];
}

interface ComputeConstraints {
  maxLatencyMs?: number;
  maxCostPerRequest?: number;
  requiredCapabilities?: string[];
  privacyLevel?: 'local-only' | 'tenant-cloud' | 'multi-tenant';
  preferLocal?: boolean;
  toolSensitivity?: ToolSensitivity;
}

interface ToolRequirements {
  toolId: string;
  minMemoryMb: number;
  requiresGPU: boolean;
  requiredCapabilities: string[];
  estimatedExecutionMs: number;
  dataSensitivity: ToolSensitivity;
}

// ============================================================================
// Liquid Compute Service
// ============================================================================

class LiquidComputeService {
  private topologies: Map<string, ComputeTopology> = new Map();
  private decisionHistory: Map<string, LiquidComputeDecision[]> = new Map();
  
  // Scoring weights for location selection
  private readonly SCORING_WEIGHTS = {
    latency: 0.30,
    cost: 0.20,
    privacy: 0.25,
    capability: 0.15,
    availability: 0.10,
  };

  // Default edge locations
  private readonly DEFAULT_EDGE_LOCATIONS: EdgeLocation[] = [
    { locationId: 'edge-us-east', region: 'us-east-1', provider: 'lambda_edge', latencyFromUserMs: 20, capabilities: ['basic', 'transform'], costMultiplier: 1.2 },
    { locationId: 'edge-us-west', region: 'us-west-2', provider: 'lambda_edge', latencyFromUserMs: 40, capabilities: ['basic', 'transform'], costMultiplier: 1.2 },
    { locationId: 'edge-eu-west', region: 'eu-west-1', provider: 'lambda_edge', latencyFromUserMs: 80, capabilities: ['basic', 'transform'], costMultiplier: 1.3 },
    { locationId: 'edge-ap-northeast', region: 'ap-northeast-1', provider: 'lambda_edge', latencyFromUserMs: 120, capabilities: ['basic', 'transform'], costMultiplier: 1.4 },
  ];

  // Default cloud regions
  private readonly DEFAULT_CLOUD_REGIONS: CloudRegion[] = [
    { regionId: 'cloud-us-east-1', provider: 'aws', region: 'us-east-1', latencyFromUserMs: 50, costPerRequest: 0.001, availableServices: ['lambda', 'sagemaker', 'bedrock'] },
    { regionId: 'cloud-us-west-2', provider: 'aws', region: 'us-west-2', latencyFromUserMs: 70, costPerRequest: 0.001, availableServices: ['lambda', 'sagemaker', 'bedrock'] },
    { regionId: 'cloud-eu-west-1', provider: 'aws', region: 'eu-west-1', latencyFromUserMs: 100, costPerRequest: 0.0012, availableServices: ['lambda', 'sagemaker'] },
  ];

  // ==========================================================================
  // TOPOLOGY MANAGEMENT
  // ==========================================================================

  async registerTopology(tenantId: string, topology: Partial<ComputeTopology>): Promise<ComputeTopology> {
    const fullTopology: ComputeTopology = {
      tenantId,
      browserCapabilities: topology.browserCapabilities || {
        wasmSupported: true,
        webGPUSupported: false,
        maxMemoryMb: 2048,
        estimatedComputeScore: 0.5,
        supportedModels: [],
      },
      localCapabilities: topology.localCapabilities,
      edgeLocations: topology.edgeLocations || this.DEFAULT_EDGE_LOCATIONS,
      cloudRegions: topology.cloudRegions || this.DEFAULT_CLOUD_REGIONS,
      defaultLocation: topology.defaultLocation || 'cloud',
      domainLocationOverrides: topology.domainLocationOverrides || {},
      sensitivityLocationRules: topology.sensitivityLocationRules || {
        'public': ['browser', 'local', 'edge', 'cloud'],
        'internal': ['local', 'edge', 'cloud'],
        'confidential': ['local', 'cloud'],
        'restricted': ['local'],
      },
    };

    this.topologies.set(tenantId, fullTopology);
    await this.saveTopologyToDatabase(fullTopology);

    logger.info(`Registered compute topology for tenant: ${tenantId}`);
    return fullTopology;
  }

  async updateBrowserCapabilities(tenantId: string, capabilities: BrowserCapabilities): Promise<void> {
    const topology = this.topologies.get(tenantId);
    if (!topology) {
      await this.registerTopology(tenantId, { browserCapabilities: capabilities });
      return;
    }

    topology.browserCapabilities = capabilities;
    this.topologies.set(tenantId, topology);
  }

  async updateLocalCapabilities(tenantId: string, capabilities: LocalCapabilities): Promise<void> {
    const topology = this.topologies.get(tenantId);
    if (!topology) {
      await this.registerTopology(tenantId, { localCapabilities: capabilities });
      return;
    }

    topology.localCapabilities = capabilities;
    this.topologies.set(tenantId, topology);
  }

  // ==========================================================================
  // COMPUTE LOCATION DECISION
  // ==========================================================================

  async selectComputeLocation(
    tenantId: string,
    toolRequirements: ToolRequirements,
    constraints: ComputeConstraints = {}
  ): Promise<LiquidComputeDecision> {
    const decisionId = randomUUID();
    const topology = await this.getTopology(tenantId);

    // Evaluate each location
    const alternatives: Array<{
      location: ComputeLocation;
      score: number;
      disqualifyReason?: string;
    }> = [];

    // Evaluate Browser
    const browserResult = this.evaluateBrowser(topology, toolRequirements, constraints);
    alternatives.push({ location: 'browser', ...browserResult });

    // Evaluate Local
    const localResult = this.evaluateLocal(topology, toolRequirements, constraints);
    alternatives.push({ location: 'local', ...localResult });

    // Evaluate Edge
    const edgeResult = this.evaluateEdge(topology, toolRequirements, constraints);
    alternatives.push({ location: 'edge', ...edgeResult });

    // Evaluate Cloud
    const cloudResult = this.evaluateCloud(topology, toolRequirements, constraints);
    alternatives.push({ location: 'cloud', ...cloudResult });

    // Sort by score and select the best qualified option
    alternatives.sort((a, b) => b.score - a.score);
    
    const selected = alternatives.find(a => !a.disqualifyReason) || alternatives[0];
    const reason = this.determineReason(selected, constraints, toolRequirements);

    const decision: LiquidComputeDecision = {
      decisionId,
      toolId: toolRequirements.toolId,
      selectedLocation: selected.location,
      reason,
      alternatives,
      executionEndpoint: this.getEndpoint(selected.location, topology),
      estimatedLatencyMs: this.estimateLatency(selected.location, topology),
      estimatedCost: this.estimateCost(selected.location, topology, toolRequirements),
    };

    // Log decision
    await this.logDecision(tenantId, decision);

    logger.info(`Compute location selected: ${selected.location}`, {
      decisionId,
      toolId: toolRequirements.toolId,
      reason,
      score: selected.score,
    });

    return decision;
  }

  private evaluateBrowser(
    topology: ComputeTopology,
    requirements: ToolRequirements,
    constraints: ComputeConstraints
  ): { score: number; disqualifyReason?: string } {
    let score = 0;
    
    // Check capabilities
    if (!topology.browserCapabilities.wasmSupported) {
      return { score: 0, disqualifyReason: 'WASM not supported' };
    }

    // Check memory
    if (requirements.minMemoryMb > topology.browserCapabilities.maxMemoryMb) {
      return { score: 0, disqualifyReason: 'Insufficient memory' };
    }

    // Check GPU requirement
    if (requirements.requiresGPU && !topology.browserCapabilities.webGPUSupported) {
      return { score: 0, disqualifyReason: 'GPU required but not available' };
    }

    // Check sensitivity rules
    const allowedLocations = topology.sensitivityLocationRules[requirements.dataSensitivity] || [];
    if (!allowedLocations.includes('browser')) {
      return { score: 0, disqualifyReason: 'Data sensitivity restriction' };
    }

    // Privacy constraint - browser is best for privacy
    if (constraints.privacyLevel === 'local-only') {
      score += this.SCORING_WEIGHTS.privacy * 1.0;
    } else {
      score += this.SCORING_WEIGHTS.privacy * 0.9;
    }

    // Latency - browser is fastest (no network)
    score += this.SCORING_WEIGHTS.latency * 1.0;

    // Cost - browser is free
    score += this.SCORING_WEIGHTS.cost * 1.0;

    // Capability - depends on what browser can do
    const capabilityScore = topology.browserCapabilities.estimatedComputeScore;
    score += this.SCORING_WEIGHTS.capability * capabilityScore;

    // Availability - browser is always available
    score += this.SCORING_WEIGHTS.availability * 1.0;

    return { score };
  }

  private evaluateLocal(
    topology: ComputeTopology,
    requirements: ToolRequirements,
    constraints: ComputeConstraints
  ): { score: number; disqualifyReason?: string } {
    if (!topology.localCapabilities?.available) {
      return { score: 0, disqualifyReason: 'Local compute not available' };
    }

    let score = 0;

    // Check GPU requirement
    if (requirements.requiresGPU && !topology.localCapabilities.gpuAvailable) {
      return { score: 0, disqualifyReason: 'GPU required but not available' };
    }

    // Check sensitivity rules
    const allowedLocations = topology.sensitivityLocationRules[requirements.dataSensitivity] || [];
    if (!allowedLocations.includes('local')) {
      return { score: 0, disqualifyReason: 'Data sensitivity restriction' };
    }

    // Privacy - local is excellent for privacy
    score += this.SCORING_WEIGHTS.privacy * 1.0;

    // Latency - local is very fast
    score += this.SCORING_WEIGHTS.latency * 0.95;

    // Cost - local has hardware cost but no per-request cost
    score += this.SCORING_WEIGHTS.cost * 0.9;

    // Capability - depends on local hardware
    const capabilityScore = topology.localCapabilities.gpuAvailable ? 0.9 : 0.6;
    score += this.SCORING_WEIGHTS.capability * capabilityScore;

    // Availability - depends on device being on
    score += this.SCORING_WEIGHTS.availability * 0.7;

    // Bonus if user prefers local
    if (constraints.preferLocal) {
      score *= 1.2;
    }

    return { score };
  }

  private evaluateEdge(
    topology: ComputeTopology,
    requirements: ToolRequirements,
    constraints: ComputeConstraints
  ): { score: number; disqualifyReason?: string } {
    if (topology.edgeLocations.length === 0) {
      return { score: 0, disqualifyReason: 'No edge locations available' };
    }

    let score = 0;

    // Check sensitivity rules
    const allowedLocations = topology.sensitivityLocationRules[requirements.dataSensitivity] || [];
    if (!allowedLocations.includes('edge')) {
      return { score: 0, disqualifyReason: 'Data sensitivity restriction' };
    }

    // Check privacy constraint
    if (constraints.privacyLevel === 'local-only') {
      return { score: 0, disqualifyReason: 'Privacy requires local-only' };
    }

    // Find best edge location
    const bestEdge = topology.edgeLocations.reduce((best, current) =>
      current.latencyFromUserMs < best.latencyFromUserMs ? current : best
    );

    // Privacy - edge is moderate for privacy
    score += this.SCORING_WEIGHTS.privacy * 0.6;

    // Latency - edge is good
    const latencyScore = Math.max(0, 1 - (bestEdge.latencyFromUserMs / 100));
    score += this.SCORING_WEIGHTS.latency * latencyScore;

    // Cost - edge has moderate cost
    const costScore = Math.max(0, 1 - (bestEdge.costMultiplier - 1));
    score += this.SCORING_WEIGHTS.cost * costScore;

    // Capability - edge has limited capabilities
    const hasRequiredCaps = requirements.requiredCapabilities.every(
      cap => bestEdge.capabilities.includes(cap) || bestEdge.capabilities.includes('basic')
    );
    score += this.SCORING_WEIGHTS.capability * (hasRequiredCaps ? 0.5 : 0);

    // Availability - edge is highly available
    score += this.SCORING_WEIGHTS.availability * 0.95;

    return { score };
  }

  private evaluateCloud(
    topology: ComputeTopology,
    requirements: ToolRequirements,
    constraints: ComputeConstraints
  ): { score: number; disqualifyReason?: string } {
    if (topology.cloudRegions.length === 0) {
      return { score: 0, disqualifyReason: 'No cloud regions available' };
    }

    let score = 0;

    // Check sensitivity rules
    const allowedLocations = topology.sensitivityLocationRules[requirements.dataSensitivity] || [];
    if (!allowedLocations.includes('cloud')) {
      return { score: 0, disqualifyReason: 'Data sensitivity restriction' };
    }

    // Check privacy constraint
    if (constraints.privacyLevel === 'local-only') {
      return { score: 0, disqualifyReason: 'Privacy requires local-only' };
    }

    // Find best cloud region
    const bestCloud = topology.cloudRegions.reduce((best, current) =>
      current.latencyFromUserMs < best.latencyFromUserMs ? current : best
    );

    // Privacy - cloud is moderate for privacy
    score += this.SCORING_WEIGHTS.privacy * 0.5;

    // Latency - cloud is moderate
    const latencyScore = Math.max(0, 1 - (bestCloud.latencyFromUserMs / 200));
    score += this.SCORING_WEIGHTS.latency * latencyScore;

    // Cost - cloud has per-request cost
    const costScore = Math.max(0, 1 - (bestCloud.costPerRequest * 100));
    score += this.SCORING_WEIGHTS.cost * costScore;

    // Capability - cloud has full capabilities
    score += this.SCORING_WEIGHTS.capability * 1.0;

    // Availability - cloud is highly available
    score += this.SCORING_WEIGHTS.availability * 0.99;

    return { score };
  }

  private determineReason(
    selected: { location: ComputeLocation; score: number; disqualifyReason?: string },
    constraints: ComputeConstraints,
    requirements: ToolRequirements
  ): ComputeReason {
    if (constraints.privacyLevel === 'local-only') return 'privacy';
    if (constraints.preferLocal && selected.location === 'local') return 'user_preference';
    if (constraints.maxLatencyMs && selected.location === 'browser') return 'latency';
    if (requirements.dataSensitivity === 'restricted') return 'privacy';
    if (selected.location === 'cloud' && requirements.requiresGPU) return 'capability';
    return 'cost';
  }

  private getEndpoint(location: ComputeLocation, topology: ComputeTopology): string {
    switch (location) {
      case 'browser':
        return 'wasm://local';
      case 'local':
        return `local://${topology.localCapabilities?.platform || 'unknown'}`;
      case 'edge':
        const bestEdge = topology.edgeLocations[0];
        return `https://edge.radiant.ai/${bestEdge?.region || 'default'}`;
      case 'cloud':
        const bestCloud = topology.cloudRegions[0];
        return `https://api.radiant.ai/${bestCloud?.region || 'us-east-1'}`;
      default:
        return 'https://api.radiant.ai/us-east-1';
    }
  }

  private estimateLatency(location: ComputeLocation, topology: ComputeTopology): number {
    switch (location) {
      case 'browser': return 5;
      case 'local': return 10;
      case 'edge': return topology.edgeLocations[0]?.latencyFromUserMs || 30;
      case 'cloud': return topology.cloudRegions[0]?.latencyFromUserMs || 100;
      default: return 100;
    }
  }

  private estimateCost(
    location: ComputeLocation,
    topology: ComputeTopology,
    requirements: ToolRequirements
  ): number {
    switch (location) {
      case 'browser': return 0;
      case 'local': return 0;
      case 'edge': 
        const edgeCost = topology.edgeLocations[0]?.costMultiplier || 1.2;
        return 0.0001 * edgeCost;
      case 'cloud': 
        return topology.cloudRegions[0]?.costPerRequest || 0.001;
      default: return 0.001;
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private async getTopology(tenantId: string): Promise<ComputeTopology> {
    let topology = this.topologies.get(tenantId);
    if (!topology) {
      topology = await this.loadTopologyFromDatabase(tenantId);
      if (!topology) {
        topology = await this.registerTopology(tenantId, {});
      }
    }
    return topology;
  }

  // ==========================================================================
  // DATABASE OPERATIONS
  // ==========================================================================

  private async saveTopologyToDatabase(topology: ComputeTopology): Promise<void> {
    await executeStatement({
      sql: `
        INSERT INTO liquid_compute_topologies (
          tenant_id, browser_capabilities, local_capabilities,
          edge_locations, cloud_regions, default_location,
          domain_location_overrides, sensitivity_location_rules,
          created_at, updated_at
        ) VALUES (
          :tenantId, :browserCapabilities, :localCapabilities,
          :edgeLocations, :cloudRegions, :defaultLocation,
          :domainLocationOverrides, :sensitivityLocationRules,
          NOW(), NOW()
        )
        ON CONFLICT (tenant_id) DO UPDATE SET
          browser_capabilities = EXCLUDED.browser_capabilities,
          local_capabilities = EXCLUDED.local_capabilities,
          edge_locations = EXCLUDED.edge_locations,
          cloud_regions = EXCLUDED.cloud_regions,
          default_location = EXCLUDED.default_location,
          domain_location_overrides = EXCLUDED.domain_location_overrides,
          sensitivity_location_rules = EXCLUDED.sensitivity_location_rules,
          updated_at = NOW()
      `,
      parameters: [
        stringParam('tenantId', topology.tenantId),
        stringParam('browserCapabilities', JSON.stringify(topology.browserCapabilities)),
        stringParam('localCapabilities', JSON.stringify(topology.localCapabilities || null)),
        stringParam('edgeLocations', JSON.stringify(topology.edgeLocations)),
        stringParam('cloudRegions', JSON.stringify(topology.cloudRegions)),
        stringParam('defaultLocation', topology.defaultLocation),
        stringParam('domainLocationOverrides', JSON.stringify(topology.domainLocationOverrides)),
        stringParam('sensitivityLocationRules', JSON.stringify(topology.sensitivityLocationRules)),
      ],
    });
  }

  private async loadTopologyFromDatabase(tenantId: string): Promise<ComputeTopology | null> {
    const result = await executeStatement({
      sql: `SELECT * FROM liquid_compute_topologies WHERE tenant_id = :tenantId`,
      parameters: [stringParam('tenantId', tenantId)],
    });

    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return this.rowToTopology(row);
  }

  private async logDecision(tenantId: string, decision: LiquidComputeDecision): Promise<void> {
    // Store in memory
    if (!this.decisionHistory.has(tenantId)) {
      this.decisionHistory.set(tenantId, []);
    }
    const history = this.decisionHistory.get(tenantId)!;
    history.push(decision);
    
    // Keep only last 100 decisions per tenant
    if (history.length > 100) {
      history.shift();
    }

    // Persist to database
    await executeStatement({
      sql: `
        INSERT INTO liquid_compute_decisions (
          decision_id, tenant_id, tool_id, selected_location, reason,
          alternatives, execution_endpoint, estimated_latency_ms,
          estimated_cost, created_at
        ) VALUES (
          :decisionId, :tenantId, :toolId, :selectedLocation, :reason,
          :alternatives, :executionEndpoint, :estimatedLatencyMs,
          :estimatedCost, NOW()
        )
      `,
      parameters: [
        stringParam('decisionId', decision.decisionId),
        stringParam('tenantId', tenantId),
        stringParam('toolId', decision.toolId),
        stringParam('selectedLocation', decision.selectedLocation),
        stringParam('reason', decision.reason),
        stringParam('alternatives', JSON.stringify(decision.alternatives)),
        stringParam('executionEndpoint', decision.executionEndpoint),
        longParam('estimatedLatencyMs', decision.estimatedLatencyMs),
        doubleParam('estimatedCost', decision.estimatedCost),
      ],
    });
  }

  private rowToTopology(row: Record<string, unknown>): ComputeTopology {
    const getString = (key: string): string => String(row[key] || '');
    const parseJSON = <T>(key: string, fallback: T): T => {
      try {
        const val = row[key];
        return typeof val === 'string' ? JSON.parse(val) : (val as T || fallback);
      } catch {
        return fallback;
      }
    };

    return {
      tenantId: getString('tenant_id'),
      browserCapabilities: parseJSON('browser_capabilities', {
        wasmSupported: true,
        webGPUSupported: false,
        maxMemoryMb: 2048,
        estimatedComputeScore: 0.5,
        supportedModels: [],
      }),
      localCapabilities: parseJSON('local_capabilities', undefined),
      edgeLocations: parseJSON('edge_locations', this.DEFAULT_EDGE_LOCATIONS),
      cloudRegions: parseJSON('cloud_regions', this.DEFAULT_CLOUD_REGIONS),
      defaultLocation: (getString('default_location') || 'cloud') as ComputeLocation,
      domainLocationOverrides: parseJSON('domain_location_overrides', {}),
      sensitivityLocationRules: parseJSON('sensitivity_location_rules', {
        'public': ['browser', 'local', 'edge', 'cloud'],
        'internal': ['local', 'edge', 'cloud'],
        'confidential': ['local', 'cloud'],
        'restricted': ['local'],
      }),
    };
  }

  // ==========================================================================
  // METRICS
  // ==========================================================================

  getDecisionHistory(tenantId: string): LiquidComputeDecision[] {
    return this.decisionHistory.get(tenantId) || [];
  }

  getLocationDistribution(tenantId: string): Record<ComputeLocation, number> {
    const history = this.decisionHistory.get(tenantId) || [];
    const distribution: Record<ComputeLocation, number> = {
      browser: 0,
      local: 0,
      edge: 0,
      cloud: 0,
    };

    for (const decision of history) {
      distribution[decision.selectedLocation]++;
    }

    return distribution;
  }

  getAverageLatency(tenantId: string): number {
    const history = this.decisionHistory.get(tenantId) || [];
    if (history.length === 0) return 0;

    const total = history.reduce((sum, d) => sum + d.estimatedLatencyMs, 0);
    return total / history.length;
  }

  getTotalCost(tenantId: string): number {
    const history = this.decisionHistory.get(tenantId) || [];
    return history.reduce((sum, d) => sum + d.estimatedCost, 0);
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const liquidCompute = new LiquidComputeService();
export { LiquidComputeService };
