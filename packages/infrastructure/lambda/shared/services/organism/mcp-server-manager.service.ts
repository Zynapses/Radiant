// RADIANT Autonomous Organism - MCP Server Manager
// Neural Affinity Routing for optimal tool selection
// Version: 1.0.0

import { randomUUID } from 'crypto';
import { executeStatement, stringParam, longParam, doubleParam, boolParam } from '../../db/client';
import { createRegisteredLogger } from '../logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'organism/mcp-server-manager',
  category: 'infrastructure',
  sourceType: 'application',
});
import { embeddingService } from '../embedding.service';
// Types are defined locally to avoid import issues
type MCPTransport = 'stdio' | 'sse' | 'streamable-http' | 'websocket' | 'wasm-local';
type MCPAuthType = 'none' | 'api_key' | 'oauth2' | 'jwt' | 'mtls';
type MCPServerStatus = 'active' | 'disabled' | 'deprecated' | 'pending_review';
type MCPHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

interface RoutingConstraints {
  maxLatencyMs?: number;
  maxCostPerCall?: number;
  requiredCapabilities?: string[];
  excludeServers?: string[];
  preferLocal?: boolean;
  privacyLevel?: 'local-only' | 'tenant-cloud' | 'multi-tenant';
  budgetRemaining?: number;
  requireApproval?: boolean;
}

interface NeuralAffinityScore {
  toolId: string;
  semanticSimilarity: number;
  domainProficiency: number;
  errorPenalty: number;
  latencyScore: number;
  costScore: number;
  finalScore: number;
  scoringFactors: string[];
}

interface NeuralRoutingDecision {
  decisionId: string;
  intentEmbedding: Float32Array;
  constraints: RoutingConstraints;
  candidates: NeuralAffinityScore[];
  selectedToolId: string;
  selectionReason: string;
  fallbackTools: string[];
  routingTimeMs: number;
  candidatesEvaluated: number;
}

export interface MCPServerConfig {
  serverId: string;
  name: string;
  description: string;
  transport: MCPTransport;
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  domainAffinity: string[];
  embeddingVector?: Float32Array;
  proficiencyScores: Record<string, number>;
  neuralAffinityModel: string;
  healthEndpoint?: string;
  lastHealthCheck?: Date;
  healthStatus: MCPHealthStatus;
  errorRate: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  costPerCall: number;
  totalCallsToday: number;
  totalCostToday: number;
  budgetLimit?: number;
  authType: MCPAuthType;
  credentials?: { encrypted: string; keyId: string; algorithm: string };
  credentialRotationDays?: number;
  supportedCapabilities: string[];
  maxConcurrentCalls: number;
  timeout: number;
  retryConfig: RetryConfig;
  status: MCPServerStatus;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

const NEURAL_AFFINITY_WEIGHTS = {
  semanticSimilarity: 0.35,
  domainProficiency: 0.25,
  errorPenalty: 0.20,
  latencyScore: 0.10,
  costScore: 0.10,
};

// ============================================================================
// MCP Server Manager Service
// ============================================================================

class MCPServerManagerService {
  private servers: Map<string, MCPServerConfig> = new Map();
  private serverEmbeddings: Map<string, Float32Array> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  async initialize(): Promise<void> {
    logger.info('Initializing MCP Server Manager');
    await this.loadServersFromDatabase();
    this.startHealthChecks();
    logger.info(`MCP Server Manager initialized with ${this.servers.size} servers`);
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down MCP Server Manager');
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }

  // ==========================================================================
  // SERVER REGISTRATION
  // ==========================================================================

  async registerServer(config: Omit<MCPServerConfig, 'serverId' | 'createdAt' | 'updatedAt'>): Promise<MCPServerConfig> {
    const serverId = randomUUID();
    const now = new Date();

    // Generate embedding for the server description
    const embedding = await this.generateServerEmbedding(config.name, config.description, config.domainAffinity);

    const server: MCPServerConfig = {
      ...config,
      serverId,
      embeddingVector: embedding,
      retryConfig: config.retryConfig || DEFAULT_RETRY_CONFIG,
      createdAt: now,
      updatedAt: now,
    };

    // Store in memory
    this.servers.set(serverId, server);
    this.serverEmbeddings.set(serverId, embedding);

    // Persist to database
    await this.saveServerToDatabase(server);

    logger.info(`Registered MCP server: ${server.name} (${serverId})`);
    return server;
  }

  async updateServer(serverId: string, updates: Partial<MCPServerConfig>): Promise<MCPServerConfig | null> {
    const server = this.servers.get(serverId);
    if (!server) {
      return null;
    }

    const updated: MCPServerConfig = {
      ...server,
      ...updates,
      serverId, // Prevent overwriting
      createdAt: server.createdAt, // Prevent overwriting
      updatedAt: new Date(),
    };

    // Regenerate embedding if description or domains changed
    if (updates.description || updates.domainAffinity) {
      const embedding = await this.generateServerEmbedding(
        updated.name,
        updated.description,
        updated.domainAffinity
      );
      updated.embeddingVector = embedding;
      this.serverEmbeddings.set(serverId, embedding);
    }

    this.servers.set(serverId, updated);
    await this.saveServerToDatabase(updated);

    logger.info(`Updated MCP server: ${updated.name} (${serverId})`);
    return updated;
  }

  async removeServer(serverId: string): Promise<boolean> {
    const server = this.servers.get(serverId);
    if (!server) {
      return false;
    }

    this.servers.delete(serverId);
    this.serverEmbeddings.delete(serverId);

    await executeStatement({
      sql: `UPDATE mcp_servers SET status = 'disabled', updated_at = NOW() WHERE server_id = :serverId`,
      parameters: [stringParam('serverId', serverId)],
    });

    logger.info(`Removed MCP server: ${server.name} (${serverId})`);
    return true;
  }

  // ==========================================================================
  // NEURAL AFFINITY ROUTING
  // ==========================================================================

  async routeByNeuralAffinity(
    intentEmbedding: Float32Array,
    constraints: RoutingConstraints = {}
  ): Promise<NeuralRoutingDecision> {
    const decisionId = randomUUID();
    const startTime = Date.now();

    // Get all active servers
    const activeServers = Array.from(this.servers.values()).filter(
      s => s.status === 'active' && s.healthStatus !== 'unhealthy'
    );

    // Calculate affinity scores for each server
    const candidates: NeuralAffinityScore[] = [];

    for (const server of activeServers) {
      // Apply exclusion filter
      if (constraints.excludeServers?.includes(server.serverId)) {
        continue;
      }

      // Apply capability filter
      if (constraints.requiredCapabilities) {
        const hasAllCapabilities = constraints.requiredCapabilities.every(
          cap => server.supportedCapabilities.includes(cap)
        );
        if (!hasAllCapabilities) {
          continue;
        }
      }

      // Calculate affinity score
      const score = await this.calculateAffinityScore(server, intentEmbedding, constraints);
      candidates.push(score);
    }

    // Sort by final score
    candidates.sort((a, b) => b.finalScore - a.finalScore);

    // Select the best candidate
    const selected = candidates[0];
    if (!selected) {
      throw new Error('No suitable MCP server found for the given intent');
    }

    const decision: NeuralRoutingDecision = {
      decisionId,
      intentEmbedding,
      constraints,
      candidates,
      selectedToolId: selected.toolId,
      selectionReason: selected.scoringFactors.join('; '),
      fallbackTools: candidates.slice(1, 4).map(c => c.toolId),
      routingTimeMs: Date.now() - startTime,
      candidatesEvaluated: candidates.length,
    };

    // Log the decision
    await this.logRoutingDecision(decision);

    return decision;
  }

  private async calculateAffinityScore(
    server: MCPServerConfig,
    intentEmbedding: Float32Array,
    constraints: RoutingConstraints
  ): Promise<NeuralAffinityScore> {
    const serverEmbedding = this.serverEmbeddings.get(server.serverId);
    const scoringFactors: string[] = [];

    // 1. Semantic similarity (cosine similarity)
    let semanticSimilarity = 0;
    if (serverEmbedding) {
      semanticSimilarity = this.cosineSimilarity(intentEmbedding, serverEmbedding);
      scoringFactors.push(`semantic: ${semanticSimilarity.toFixed(3)}`);
    }

    // 2. Domain proficiency
    const domainProficiency = this.calculateDomainProficiency(server);
    scoringFactors.push(`domain: ${domainProficiency.toFixed(3)}`);

    // 3. Error penalty (1 - error_rate)
    const errorPenalty = 1 - server.errorRate;
    scoringFactors.push(`error_penalty: ${errorPenalty.toFixed(3)}`);

    // 4. Latency score (normalized, lower is better)
    let latencyScore = 1;
    if (constraints.maxLatencyMs && server.avgLatencyMs > 0) {
      latencyScore = Math.max(0, 1 - (server.avgLatencyMs / constraints.maxLatencyMs));
      scoringFactors.push(`latency: ${latencyScore.toFixed(3)}`);
    }

    // 5. Cost score (normalized, lower is better)
    let costScore = 1;
    if (constraints.maxCostPerCall && server.costPerCall > 0) {
      costScore = Math.max(0, 1 - (server.costPerCall / constraints.maxCostPerCall));
      scoringFactors.push(`cost: ${costScore.toFixed(3)}`);
    }

    // Calculate weighted final score
    const finalScore =
      NEURAL_AFFINITY_WEIGHTS.semanticSimilarity * semanticSimilarity +
      NEURAL_AFFINITY_WEIGHTS.domainProficiency * domainProficiency +
      NEURAL_AFFINITY_WEIGHTS.errorPenalty * errorPenalty +
      NEURAL_AFFINITY_WEIGHTS.latencyScore * latencyScore +
      NEURAL_AFFINITY_WEIGHTS.costScore * costScore;

    scoringFactors.push(`final: ${finalScore.toFixed(3)}`);

    return {
      toolId: server.serverId,
      semanticSimilarity,
      domainProficiency,
      errorPenalty,
      latencyScore,
      costScore,
      finalScore,
      scoringFactors,
    };
  }

  private calculateDomainProficiency(server: MCPServerConfig): number {
    const proficiencies = Object.values(server.proficiencyScores);
    if (proficiencies.length === 0) {
      return 0.5; // Default neutral score
    }
    return proficiencies.reduce((a, b) => a + b, 0) / proficiencies.length;
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  // ==========================================================================
  // SERVER DISCOVERY & HEALTH
  // ==========================================================================

  async discoverServer(url: string): Promise<Partial<MCPServerConfig> | null> {
    try {
      // Try to fetch server info via well-known endpoint
      const response = await fetch(`${url}/.well-known/mcp-server`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return null;
      }

      const info = await response.json() as {
        name?: string;
        description?: string;
        domains?: string[];
        capabilities?: string[];
        healthEndpoint?: string;
        transport?: MCPTransport;
      };
      
      return {
        name: info.name || 'Unknown Server',
        description: info.description || '',
        transport: this.detectTransport(url, info),
        url,
        domainAffinity: info.domains || [],
        supportedCapabilities: info.capabilities || [],
        healthEndpoint: info.healthEndpoint || `${url}/health`,
      };
    } catch (error) {
      logger.warn(`Failed to discover MCP server at ${url}:`, error);
      return null;
    }
  }

  private detectTransport(url: string, info: any): MCPTransport {
    if (info.transport) return info.transport;
    if (url.startsWith('ws://') || url.startsWith('wss://')) return 'websocket';
    if (url.includes('/sse')) return 'sse';
    return 'streamable-http';
  }

  async checkServerHealth(serverId: string): Promise<MCPHealthStatus> {
    const server = this.servers.get(serverId);
    if (!server || !server.healthEndpoint) {
      return 'unknown';
    }

    try {
      const startTime = Date.now();
      const response = await fetch(server.healthEndpoint, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        await this.updateServerHealth(serverId, 'unhealthy', latency);
        return 'unhealthy';
      }

      const body = await response.json() as { status?: string };
      const status: MCPHealthStatus = body.status === 'ok' ? 'healthy' : 
        body.status === 'degraded' ? 'degraded' : 'unhealthy';

      await this.updateServerHealth(serverId, status, latency);
      return status;
    } catch (error) {
      await this.updateServerHealth(serverId, 'unhealthy');
      return 'unhealthy';
    }
  }

  private async updateServerHealth(
    serverId: string,
    status: MCPHealthStatus,
    latencyMs?: number
  ): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) return;

    server.healthStatus = status;
    server.lastHealthCheck = new Date();

    if (latencyMs !== undefined) {
      // Update latency with exponential moving average
      const alpha = 0.2;
      server.avgLatencyMs = alpha * latencyMs + (1 - alpha) * server.avgLatencyMs;
    }

    this.servers.set(serverId, server);
  }

  private startHealthChecks(): void {
    // Check health every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      for (const serverId of Array.from(this.servers.keys())) {
        await this.checkServerHealth(serverId);
      }
    }, 30000);
  }

  // ==========================================================================
  // EMBEDDING GENERATION
  // ==========================================================================

  private async generateServerEmbedding(
    name: string,
    description: string,
    domains: string[]
  ): Promise<Float32Array> {
    const text = `${name}: ${description}. Domains: ${domains.join(', ')}`;
    
    try {
      const result = await embeddingService.generateEmbedding(text);
      return new Float32Array(result.embedding);
    } catch (error) {
      logger.warn('Failed to generate embedding, using zero vector:', error);
      return new Float32Array(1536); // Return zero vector as fallback
    }
  }

  // ==========================================================================
  // DATABASE OPERATIONS
  // ==========================================================================

  private async loadServersFromDatabase(): Promise<void> {
    try {
      const result = await executeStatement({
        sql: `
          SELECT * FROM mcp_servers 
          WHERE status != 'disabled'
          ORDER BY created_at DESC
        `,
        parameters: [],
      });

      for (const row of result.rows || []) {
        const server = this.rowToServer(row);
        this.servers.set(server.serverId, server);
        
        if (server.embeddingVector) {
          this.serverEmbeddings.set(server.serverId, server.embeddingVector);
        }
      }
    } catch (error) {
      logger.error('Failed to load MCP servers from database:', error);
    }
  }

  private async saveServerToDatabase(server: MCPServerConfig): Promise<void> {
    try {
      await executeStatement({
        sql: `
          INSERT INTO mcp_servers (
            server_id, name, description, transport, url, command, args, env,
            domain_affinity, embedding_vector, proficiency_scores, neural_affinity_model,
            health_endpoint, health_status, error_rate, avg_latency_ms,
            p50_latency_ms, p95_latency_ms, p99_latency_ms,
            cost_per_call, total_calls_today, total_cost_today, budget_limit,
            auth_type, credentials_encrypted, supported_capabilities,
            max_concurrent_calls, timeout_ms, retry_config, status,
            created_at, updated_at
          ) VALUES (
            :serverId, :name, :description, :transport, :url, :command, :args, :env,
            :domainAffinity, :embeddingVector, :proficiencyScores, :neuralAffinityModel,
            :healthEndpoint, :healthStatus, :errorRate, :avgLatencyMs,
            :p50LatencyMs, :p95LatencyMs, :p99LatencyMs,
            :costPerCall, :totalCallsToday, :totalCostToday, :budgetLimit,
            :authType, :credentialsEncrypted, :supportedCapabilities,
            :maxConcurrentCalls, :timeoutMs, :retryConfig, :status,
            :createdAt, :updatedAt
          )
          ON CONFLICT (server_id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            transport = EXCLUDED.transport,
            url = EXCLUDED.url,
            domain_affinity = EXCLUDED.domain_affinity,
            embedding_vector = EXCLUDED.embedding_vector,
            proficiency_scores = EXCLUDED.proficiency_scores,
            health_status = EXCLUDED.health_status,
            error_rate = EXCLUDED.error_rate,
            avg_latency_ms = EXCLUDED.avg_latency_ms,
            status = EXCLUDED.status,
            updated_at = EXCLUDED.updated_at
        `,
        parameters: [
          stringParam('serverId', server.serverId),
          stringParam('name', server.name),
          stringParam('description', server.description),
          stringParam('transport', server.transport),
          stringParam('url', server.url || ''),
          stringParam('command', server.command || ''),
          stringParam('args', JSON.stringify(server.args || [])),
          stringParam('env', JSON.stringify(server.env || {})),
          stringParam('domainAffinity', JSON.stringify(server.domainAffinity)),
          stringParam('embeddingVector', server.embeddingVector ? this.float32ArrayToBase64(server.embeddingVector) : ''),
          stringParam('proficiencyScores', JSON.stringify(server.proficiencyScores)),
          stringParam('neuralAffinityModel', server.neuralAffinityModel),
          stringParam('healthEndpoint', server.healthEndpoint || ''),
          stringParam('healthStatus', server.healthStatus),
          doubleParam('errorRate', server.errorRate),
          doubleParam('avgLatencyMs', server.avgLatencyMs),
          doubleParam('p50LatencyMs', server.p50LatencyMs),
          doubleParam('p95LatencyMs', server.p95LatencyMs),
          doubleParam('p99LatencyMs', server.p99LatencyMs),
          doubleParam('costPerCall', server.costPerCall),
          longParam('totalCallsToday', server.totalCallsToday),
          doubleParam('totalCostToday', server.totalCostToday),
          doubleParam('budgetLimit', server.budgetLimit || 0),
          stringParam('authType', server.authType),
          stringParam('credentialsEncrypted', server.credentials?.encrypted || ''),
          stringParam('supportedCapabilities', JSON.stringify(server.supportedCapabilities)),
          longParam('maxConcurrentCalls', server.maxConcurrentCalls),
          longParam('timeoutMs', server.timeout),
          stringParam('retryConfig', JSON.stringify(server.retryConfig)),
          stringParam('status', server.status),
          stringParam('createdAt', server.createdAt.toISOString()),
          stringParam('updatedAt', server.updatedAt.toISOString()),
        ],
      });
    } catch (error) {
      logger.error(`Failed to save MCP server ${server.serverId}:`, error);
      throw error;
    }
  }

  private async logRoutingDecision(decision: NeuralRoutingDecision): Promise<void> {
    try {
      await executeStatement({
        sql: `
          INSERT INTO mcp_routing_decisions (
            decision_id, selected_tool_id, selection_reason,
            fallback_tools, routing_time_ms, candidates_evaluated,
            created_at
          ) VALUES (
            :decisionId, :selectedToolId, :selectionReason,
            :fallbackTools, :routingTimeMs, :candidatesEvaluated,
            NOW()
          )
        `,
        parameters: [
          stringParam('decisionId', decision.decisionId),
          stringParam('selectedToolId', decision.selectedToolId),
          stringParam('selectionReason', decision.selectionReason),
          stringParam('fallbackTools', JSON.stringify(decision.fallbackTools)),
          longParam('routingTimeMs', decision.routingTimeMs),
          longParam('candidatesEvaluated', decision.candidatesEvaluated),
        ],
      });
    } catch (error) {
      logger.warn('Failed to log routing decision:', error);
    }
  }

  private rowToServer(row: Record<string, unknown>): MCPServerConfig {
    const getString = (key: string): string => String(row[key] || '');
    const getNumber = (key: string): number => Number(row[key]) || 0;
    const getDate = (key: string): Date | undefined => row[key] ? new Date(String(row[key])) : undefined;
    const parseJSON = (key: string, fallback: unknown = {}): unknown => {
      try {
        const val = row[key];
        return typeof val === 'string' ? JSON.parse(val) : (val || fallback);
      } catch {
        return fallback;
      }
    };
    
    return {
      serverId: getString('server_id'),
      name: getString('name'),
      description: getString('description'),
      transport: (getString('transport') || 'streamable-http') as MCPTransport,
      url: getString('url') || undefined,
      command: getString('command') || undefined,
      args: parseJSON('args', []) as string[],
      env: parseJSON('env', {}) as Record<string, string>,
      domainAffinity: parseJSON('domain_affinity', []) as string[],
      embeddingVector: getString('embedding_vector') ? this.base64ToFloat32Array(getString('embedding_vector')) : undefined,
      proficiencyScores: parseJSON('proficiency_scores', {}) as Record<string, number>,
      neuralAffinityModel: getString('neural_affinity_model') || 'cortex-routing-v1',
      healthEndpoint: getString('health_endpoint') || undefined,
      lastHealthCheck: getDate('last_health_check'),
      healthStatus: (getString('health_status') || 'unknown') as MCPHealthStatus,
      errorRate: getNumber('error_rate'),
      avgLatencyMs: getNumber('avg_latency_ms'),
      p50LatencyMs: getNumber('p50_latency_ms'),
      p95LatencyMs: getNumber('p95_latency_ms'),
      p99LatencyMs: getNumber('p99_latency_ms'),
      costPerCall: getNumber('cost_per_call'),
      totalCallsToday: getNumber('total_calls_today'),
      totalCostToday: getNumber('total_cost_today'),
      budgetLimit: getNumber('budget_limit') || undefined,
      authType: (getString('auth_type') || 'none') as MCPAuthType,
      credentials: getString('credentials_encrypted') ? { encrypted: getString('credentials_encrypted'), keyId: '', algorithm: 'AES-256-GCM' } : undefined,
      supportedCapabilities: parseJSON('supported_capabilities', []) as string[],
      maxConcurrentCalls: getNumber('max_concurrent_calls') || 10,
      timeout: getNumber('timeout_ms') || 30000,
      retryConfig: parseJSON('retry_config', DEFAULT_RETRY_CONFIG) as RetryConfig,
      status: (getString('status') || 'active') as MCPServerStatus,
      createdAt: getDate('created_at') || new Date(),
      updatedAt: getDate('updated_at') || new Date(),
      lastUsedAt: getDate('last_used_at'),
    };
  }

  private float32ArrayToBase64(arr: Float32Array): string {
    const buffer = Buffer.from(arr.buffer);
    return buffer.toString('base64');
  }

  private base64ToFloat32Array(base64: string): Float32Array {
    const buffer = Buffer.from(base64, 'base64');
    return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
  }

  // ==========================================================================
  // GETTERS
  // ==========================================================================

  getServer(serverId: string): MCPServerConfig | undefined {
    return this.servers.get(serverId);
  }

  getAllServers(): MCPServerConfig[] {
    return Array.from(this.servers.values());
  }

  getActiveServers(): MCPServerConfig[] {
    return Array.from(this.servers.values()).filter(s => s.status === 'active');
  }

  getHealthyServers(): MCPServerConfig[] {
    return Array.from(this.servers.values()).filter(
      s => s.status === 'active' && s.healthStatus === 'healthy'
    );
  }

  // ==========================================================================
  // METRICS
  // ==========================================================================

  async updateServerMetrics(
    serverId: string,
    success: boolean,
    latencyMs: number,
    cost?: number
  ): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) return;

    // Update error rate with exponential moving average
    const alpha = 0.1;
    const errorValue = success ? 0 : 1;
    server.errorRate = alpha * errorValue + (1 - alpha) * server.errorRate;

    // Update latency
    server.avgLatencyMs = alpha * latencyMs + (1 - alpha) * server.avgLatencyMs;

    // Update usage
    server.totalCallsToday++;
    server.lastUsedAt = new Date();

    if (cost) {
      server.totalCostToday += cost;
    }

    this.servers.set(serverId, server);
  }

  async resetDailyMetrics(): Promise<void> {
    for (const [serverId, server] of Array.from(this.servers)) {
      server.totalCallsToday = 0;
      server.totalCostToday = 0;
      this.servers.set(serverId, server);
    }
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const mcpServerManager = new MCPServerManagerService();
export { MCPServerManagerService };
