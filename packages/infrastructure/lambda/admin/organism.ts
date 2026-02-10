// RADIANT Admin API - Autonomous Organism Management
// Endpoints for MCP Servers, Tool Schemas, Tool Forge, Liquid Compute, Ghost Simulation
// Version: 1.0.0

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createRegisteredLogger } from '../shared/services/logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'admin/organism',
  category: 'audit',
  sourceType: 'lambda',
});
import { 
  mcpServerManager, 
  neuralSchemaRegistry, 
  toolForge, 
  liquidCompute, 
  ghostSimulation,
  economicCortex 
} from '../shared/services/organism';

// ============================================================================
// HANDLER
// ============================================================================

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const path = event.path.replace('/api/admin/organism', '');
  const method = event.httpMethod;
  const tenantId = event.requestContext.authorizer?.tenantId || 'default';

  logger.info(`Organism Admin API: ${method} ${path}`, { tenantId });

  try {
    // MCP Server endpoints
    if (path.startsWith('/mcp-servers')) {
      return await handleMCPServers(path, method, event, tenantId);
    }

    // Tool Schema endpoints
    if (path.startsWith('/tools')) {
      return await handleTools(path, method, event, tenantId);
    }

    // Tool Forge endpoints
    if (path.startsWith('/genesis')) {
      return await handleToolForge(path, method, event, tenantId);
    }

    // Liquid Compute endpoints
    if (path.startsWith('/compute')) {
      return await handleCompute(path, method, event, tenantId);
    }

    // Ghost Simulation endpoints
    if (path.startsWith('/ghost')) {
      return await handleGhost(path, method, event, tenantId);
    }

    // Economic Cortex endpoints
    if (path.startsWith('/economic')) {
      return await handleEconomic(path, method, event, tenantId);
    }

    // Dashboard endpoint
    if (path === '/dashboard' || path === '') {
      return await handleDashboard(tenantId);
    }

    return notFound(`Unknown path: ${path}`);
  } catch (error) {
    logger.error('Organism Admin API error:', error);
    return serverError(error instanceof Error ? error.message : 'Unknown error');
  }
}

// ============================================================================
// DASHBOARD
// ============================================================================

async function handleDashboard(tenantId: string): Promise<APIGatewayProxyResult> {
  const [
    mcpServers,
    toolSchemas,
    computeTopology,
    ghostStats,
    economicConfig
  ] = await Promise.all([
    mcpServerManager.getAllServers(),
    neuralSchemaRegistry.getAllSchemas(),
    liquidCompute.getDecisionHistory(tenantId),
    ghostSimulation.getSimulationStats(tenantId),
    economicCortex.getConfig(tenantId),
  ]);

  const healthyServers = mcpServers.filter(s => s.healthStatus === 'healthy').length;
  const totalTools = toolSchemas.length;

  return success({
    overview: {
      mcpServers: {
        total: mcpServers.length,
        healthy: healthyServers,
        unhealthy: mcpServers.length - healthyServers,
      },
      tools: {
        total: totalTools,
        byCategory: groupBy(toolSchemas, 'category'),
      },
      compute: {
        recentDecisions: computeTopology.length,
        locationDistribution: liquidCompute.getLocationDistribution(tenantId),
      },
      ghost: ghostStats,
      economic: economicConfig ? {
        budgetUtilization: 0, // Will be calculated
        negotiationStrategy: economicConfig.negotiationStrategy,
        preferSelfHosted: economicConfig.preferSelfHosted,
      } : null,
    },
    recentActivity: {
      lastMCPHealthCheck: mcpServers[0]?.lastHealthCheck,
      lastComputeDecision: computeTopology[computeTopology.length - 1]?.selectedLocation,
      lastGhostSimulation: ghostStats.totalSimulations > 0,
    },
  });
}

// ============================================================================
// MCP SERVER HANDLERS
// ============================================================================

async function handleMCPServers(
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
  tenantId: string
): Promise<APIGatewayProxyResult> {
  const subPath = path.replace('/mcp-servers', '');

  // GET /mcp-servers - List all servers
  if (subPath === '' && method === 'GET') {
    const servers = await mcpServerManager.getAllServers();
    return success({ servers });
  }

  // POST /mcp-servers - Register new server
  if (subPath === '' && method === 'POST') {
    const body = parseBody<{
      name: string;
      description?: string;
      transport?: string;
      url?: string;
      command?: string;
      args?: string[];
      env?: Record<string, string>;
      domainAffinity?: string[];
      authType?: string;
      supportedCapabilities?: string[];
    }>(event);
    const server = await mcpServerManager.registerServer({
      name: body.name || 'Unnamed Server',
      description: body.description || '',
      transport: (body.transport || 'streamable-http') as any,
      url: body.url,
      command: body.command,
      args: body.args || [],
      env: body.env || {},
      domainAffinity: body.domainAffinity || [],
      authType: (body.authType || 'none') as any,
      supportedCapabilities: body.supportedCapabilities || [],
      proficiencyScores: {},
      neuralAffinityModel: 'cortex-routing-v1',
      healthStatus: 'unknown' as any,
      errorRate: 0,
      avgLatencyMs: 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      costPerCall: 0,
      totalCallsToday: 0,
      totalCostToday: 0,
      maxConcurrentCalls: 10,
      timeout: 30000,
      retryConfig: { maxAttempts: 3, initialDelayMs: 1000, maxDelayMs: 30000, backoffMultiplier: 2 },
      status: 'active' as any,
    });
    return success({ server }, 201);
  }

  // GET /mcp-servers/:id - Get server details
  const serverIdMatch = subPath.match(/^\/([a-f0-9-]+)$/);
  if (serverIdMatch && method === 'GET') {
    const server = await mcpServerManager.getServer(serverIdMatch[1]);
    if (!server) return notFound('Server not found');
    return success({ server });
  }

  // PUT /mcp-servers/:id - Update server
  if (serverIdMatch && method === 'PUT') {
    const body = parseBody(event);
    await mcpServerManager.updateServer(serverIdMatch[1], body);
    const server = await mcpServerManager.getServer(serverIdMatch[1]);
    return success({ server });
  }

  // DELETE /mcp-servers/:id - Remove server
  if (serverIdMatch && method === 'DELETE') {
    await mcpServerManager.removeServer(serverIdMatch[1]);
    return success({ message: 'Server removed' });
  }

  // POST /mcp-servers/:id/health - Check server health
  const healthMatch = subPath.match(/^\/([a-f0-9-]+)\/health$/);
  if (healthMatch && method === 'POST') {
    const status = await mcpServerManager.checkServerHealth(healthMatch[1]);
    return success({ serverId: healthMatch[1], status });
  }

  // POST /mcp-servers/discover - Discover server from URL
  if (subPath === '/discover' && method === 'POST') {
    const body = parseBody<{ url: string }>(event);
    const info = await mcpServerManager.discoverServer(body.url || '');
    return success({ discovered: info });
  }

  // POST /mcp-servers/route - Route intent to best server
  if (subPath === '/route' && method === 'POST') {
    const body = parseBody<{ intentEmbedding?: number[]; constraints?: Record<string, any> }>(event);
    const embedding = body.intentEmbedding 
      ? new Float32Array(body.intentEmbedding) 
      : new Float32Array(1536);
    const decision = await mcpServerManager.routeByNeuralAffinity(
      embedding,
      body.constraints || {}
    );
    return success({ decision });
  }

  return notFound(`Unknown MCP servers endpoint: ${subPath}`);
}

// ============================================================================
// TOOL SCHEMA HANDLERS
// ============================================================================

async function handleTools(
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
  tenantId: string
): Promise<APIGatewayProxyResult> {
  const subPath = path.replace('/tools', '');

  // GET /tools - List all tools
  if (subPath === '' && method === 'GET') {
    const category = event.queryStringParameters?.category;
    const domain = event.queryStringParameters?.domain;
    
    let schemas = neuralSchemaRegistry.getAllSchemas();
    
    if (category) {
      schemas = schemas.filter(s => s.category === category);
    }
    if (domain) {
      schemas = schemas.filter(s => s.primaryDomain === domain || s.secondaryDomains.includes(domain));
    }
    
    return success({ tools: schemas });
  }

  // POST /tools - Register new tool
  if (subPath === '' && method === 'POST') {
    const body = parseBody(event);
    const tool = await neuralSchemaRegistry.registerTool({
      serverId: body.serverId,
      name: body.name,
      description: body.description,
      inputSchemaJSON: body.inputSchema || {},
      outputSchemaJSON: body.outputSchema || {},
      category: body.category || 'data_retrieval',
      tags: body.tags || [],
      isStructuredOutput: body.isStructuredOutput || false,
      successRate: 1,
      avgExecutionMs: 0,
      usageCount: 0,
      primaryDomain: body.primaryDomain || 'general',
      secondaryDomains: body.secondaryDomains || [],
      proficiencyByModel: body.proficiencyByModel || {},
      requiredPermissions: body.requiredPermissions || [],
      sensitivityLevel: body.sensitivityLevel || 'public',
      estimatedCostPerCall: body.estimatedCostPerCall || 0,
      version: body.version || '1.0.0',
    });
    return success({ tool }, 201);
  }

  // GET /tools/:id - Get tool details
  const toolIdMatch = subPath.match(/^\/([a-f0-9-]+)$/);
  if (toolIdMatch && method === 'GET') {
    const tool = neuralSchemaRegistry.getSchema(toolIdMatch[1]);
    if (!tool) return notFound('Tool not found');
    return success({ tool });
  }

  // POST /tools/search - Search tools by query
  if (subPath === '/search' && method === 'POST') {
    const body = parseBody<{ query: string; maxResults?: number; categories?: string[]; domains?: string[]; maxCost?: number; minSuccessRate?: number; tags?: string[] }>(event);
    const results = await neuralSchemaRegistry.findToolsByQuery(
      body.query || '', 
      body.maxResults || 10,
      {
        categories: body.categories as any,
        domains: body.domains,
        maxCost: body.maxCost,
        minSuccessRate: body.minSuccessRate,
        tags: body.tags,
      }
    );
    return success({ results });
  }

  // POST /tools/find-by-intent - Neural tool discovery
  if (subPath === '/find-by-intent' && method === 'POST') {
    const body = parseBody<{ intent: string; maxResults?: number }>(event);
    const { embeddingService } = await import('../shared/services/embedding.service.js');
    let intentEmbedding: Float32Array;
    try {
      const result = await embeddingService.generateEmbedding(body.intent);
      intentEmbedding = new Float32Array(result.embedding);
    } catch (err) {
      logger.warn('Embedding generation failed for intent, using zero vector', { error: String(err) });
      intentEmbedding = new Float32Array(1536);
    }
    const tools = await neuralSchemaRegistry.findToolsByIntent(intentEmbedding, body.maxResults || 5);
    return success({ tools });
  }

  // POST /tools/:id/execution - Record tool execution
  const executionMatch = subPath.match(/^\/([a-f0-9-]+)\/execution$/);
  if (executionMatch && method === 'POST') {
    const body = parseBody<{ success: boolean; latencyMs: number; cost?: number; error?: string }>(event);
    await neuralSchemaRegistry.updateToolMetrics(executionMatch[1], {
      toolId: executionMatch[1],
      success: body.success,
      latencyMs: body.latencyMs,
      cost: body.cost,
      error: body.error,
    });
    return success({ message: 'Execution recorded' });
  }

  return notFound(`Unknown tools endpoint: ${subPath}`);
}

// ============================================================================
// TOOL FORGE HANDLERS
// ============================================================================

async function handleToolForge(
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
  tenantId: string
): Promise<APIGatewayProxyResult> {
  const subPath = path.replace('/genesis', ''); // Route path kept for backward compat
  const userId = event.requestContext.authorizer?.userId || 'system';

  // GET /genesis/requests - List tool generation requests
  if (subPath === '/requests' && method === 'GET') {
    // Would need to implement listing from database
    return success({ requests: [] });
  }

  // POST /genesis/requests - Create new tool generation request
  if (subPath === '/requests' && method === 'POST') {
    const body = parseBody(event);
    const request = await toolForge.createToolRequest({
      tenantId,
      userId,
      targetService: body.targetService,
      targetCapability: body.targetCapability,
      naturalLanguageSpec: body.spec || body.naturalLanguageSpec,
      userContext: body.userContext,
      securityLevel: body.securityLevel,
    });
    return success({ request }, 201);
  }

  // GET /genesis/requests/:id - Get request status
  const requestIdMatch = subPath.match(/^\/requests\/([a-f0-9-]+)$/);
  if (requestIdMatch && method === 'GET') {
    const request = await toolForge.getRequestStatus(requestIdMatch[1]);
    if (!request) return notFound('Request not found');
    return success({ request });
  }

  // GET /genesis/requests/:id/result - Get generation result
  const resultMatch = subPath.match(/^\/requests\/([a-f0-9-]+)\/result$/);
  if (resultMatch && method === 'GET') {
    const result = await toolForge.getResult(resultMatch[1]);
    if (!result) return notFound('Result not found');
    return success({ result });
  }

  return notFound(`Unknown tool-forge endpoint: ${subPath}`);
}

// ============================================================================
// LIQUID COMPUTE HANDLERS
// ============================================================================

async function handleCompute(
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
  tenantId: string
): Promise<APIGatewayProxyResult> {
  const subPath = path.replace('/compute', '');

  // GET /compute/topology - Get compute topology
  if (subPath === '/topology' && method === 'GET') {
    const history = liquidCompute.getDecisionHistory(tenantId);
    const distribution = liquidCompute.getLocationDistribution(tenantId);
    const avgLatency = liquidCompute.getAverageLatency(tenantId);
    const totalCost = liquidCompute.getTotalCost(tenantId);
    
    return success({
      topology: {
        recentDecisions: history.slice(-20),
        locationDistribution: distribution,
        metrics: {
          avgLatency,
          totalCost,
        },
      },
    });
  }

  // PUT /compute/topology - Update topology configuration
  if (subPath === '/topology' && method === 'PUT') {
    const body = parseBody<any>(event);
    const topology = await liquidCompute.registerTopology(tenantId, body);
    return success({ topology });
  }

  // POST /compute/browser-capabilities - Update browser capabilities
  if (subPath === '/browser-capabilities' && method === 'POST') {
    const body = parseBody<{
      wasmSupported: boolean;
      webGPUSupported: boolean;
      maxMemoryMb: number;
      estimatedComputeScore: number;
      supportedModels: string[];
    }>(event);
    await liquidCompute.updateBrowserCapabilities(tenantId, {
      wasmSupported: body.wasmSupported ?? true,
      webGPUSupported: body.webGPUSupported ?? false,
      maxMemoryMb: body.maxMemoryMb ?? 2048,
      estimatedComputeScore: body.estimatedComputeScore ?? 0.5,
      supportedModels: body.supportedModels ?? [],
    });
    return success({ message: 'Browser capabilities updated' });
  }

  // POST /compute/local-capabilities - Update local capabilities
  if (subPath === '/local-capabilities' && method === 'POST') {
    const body = parseBody<{
      available: boolean;
      platform: 'macos' | 'windows' | 'linux';
      gpuAvailable: boolean;
      gpuModel?: string;
      memoryGb: number;
      supportedModels: string[];
    }>(event);
    await liquidCompute.updateLocalCapabilities(tenantId, {
      available: body.available ?? true,
      platform: body.platform ?? 'macos',
      gpuAvailable: body.gpuAvailable ?? false,
      gpuModel: body.gpuModel,
      memoryGb: body.memoryGb ?? 16,
      supportedModels: body.supportedModels ?? [],
    });
    return success({ message: 'Local capabilities updated' });
  }

  // POST /compute/select - Select compute location for a tool
  if (subPath === '/select' && method === 'POST') {
    const body = parseBody<any>(event);
    const decision = await liquidCompute.selectComputeLocation(
      tenantId,
      {
        toolId: body.toolId,
        minMemoryMb: body.minMemoryMb || 256,
        requiresGPU: body.requiresGPU || false,
        requiredCapabilities: body.requiredCapabilities || [],
        estimatedExecutionMs: body.estimatedExecutionMs || 1000,
        dataSensitivity: body.dataSensitivity || 'public',
      },
      body.constraints || {}
    );
    return success({ decision });
  }

  return notFound(`Unknown compute endpoint: ${subPath}`);
}

// ============================================================================
// GHOST SIMULATION HANDLERS
// ============================================================================

async function handleGhost(
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
  tenantId: string
): Promise<APIGatewayProxyResult> {
  const subPath = path.replace('/ghost', '');

  // GET /ghost/stats - Get simulation statistics
  if (subPath === '/stats' && method === 'GET') {
    const stats = ghostSimulation.getSimulationStats(tenantId);
    return success({ stats });
  }

  // GET /ghost/simulations - Get recent simulations
  if (subPath === '/simulations' && method === 'GET') {
    const simulations = ghostSimulation.getRecentSimulations(tenantId);
    return success({ simulations });
  }

  // POST /ghost/simulate - Run a simulation
  if (subPath === '/simulate' && method === 'POST') {
    const body = parseBody(event);
    const userId = body.userId || event.requestContext.authorizer?.userId || 'anonymous';
    
    const simulation = await ghostSimulation.runSimulation(
      userId,
      tenantId,
      body.type || 'user_reaction',
      body.toolId || '',
      body.proposedAction,
      body.context || {}
    );
    return success({ simulation });
  }

  // GET /ghost/vectors/:userId - Get user's ghost vector info
  const vectorMatch = subPath.match(/^\/vectors\/([a-f0-9-]+)$/);
  if (vectorMatch && method === 'GET') {
    const vector = await ghostSimulation.getOrCreateGhostVector(vectorMatch[1], tenantId);
    return success({
      vector: {
        userId: vector.userId,
        interactionCount: vector.interactionCount,
        confidenceScore: vector.confidenceScore,
        lastUpdated: vector.lastUpdated,
        decayRate: vector.decayRate,
      },
    });
  }

  // POST /ghost/calibrate - Calibrate predictions
  if (subPath === '/calibrate' && method === 'POST') {
    const body = parseBody(event);
    await ghostSimulation.calibrate(body.userId, tenantId, {
      simulationId: body.simulationId,
      actualSatisfaction: body.actualSatisfaction,
      actualFrustration: body.actualFrustration,
      actualOutcome: body.actualOutcome,
    });
    return success({ message: 'Calibration recorded' });
  }

  // GET /ghost/calibration/:userId - Get calibration metrics
  const calibrationMatch = subPath.match(/^\/calibration\/([a-f0-9-]+)$/);
  if (calibrationMatch && method === 'GET') {
    const calibration = ghostSimulation.getCalibration(calibrationMatch[1], tenantId);
    return success({ calibration });
  }

  return notFound(`Unknown ghost endpoint: ${subPath}`);
}

// ============================================================================
// ECONOMIC CORTEX HANDLERS
// ============================================================================

async function handleEconomic(
  path: string,
  method: string,
  event: APIGatewayProxyEvent,
  tenantId: string
): Promise<APIGatewayProxyResult> {
  const subPath = path.replace('/economic', '');

  // GET /economic/config - Get economic config
  if (subPath === '/config' && method === 'GET') {
    let config = economicCortex.getConfig(tenantId);
    if (!config) {
      config = await economicCortex.initializeTenant(tenantId);
    }
    return success({ config });
  }

  // PUT /economic/config - Update economic config
  if (subPath === '/config' && method === 'PUT') {
    const body = parseBody(event);
    const config = await economicCortex.initializeTenant(tenantId, body);
    return success({ config });
  }

  // GET /economic/budgets - Get budgets
  if (subPath === '/budgets' && method === 'GET') {
    const budgets = await economicCortex.getTenantBudgets(tenantId);
    return success({ budgets });
  }

  // GET /economic/analytics - Get spending analytics
  if (subPath === '/analytics' && method === 'GET') {
    const analytics = await economicCortex.getSpendingAnalytics(tenantId);
    return success({ analytics });
  }

  // POST /economic/negotiate - Negotiate cost
  if (subPath === '/negotiate' && method === 'POST') {
    const body = parseBody(event);
    const negotiation = await economicCortex.negotiateCost(
      tenantId,
      body.requestedAction,
      body.estimatedCost,
      {
        requiredQuality: body.requiredQuality,
        maxLatencyMs: body.maxLatencyMs,
        allowDowngrade: body.allowDowngrade,
      }
    );
    return success({ negotiation });
  }

  // POST /economic/recommend-model - Get model recommendation
  if (subPath === '/recommend-model' && method === 'POST') {
    const body = parseBody(event);
    const recommendation = await economicCortex.recommendModel(
      tenantId,
      body.taskType,
      {
        requiredQuality: body.requiredQuality,
        maxLatencyMs: body.maxLatencyMs,
        maxCostPerRequest: body.maxCostPerRequest,
      }
    );
    return success({ recommendation });
  }

  // POST /economic/record-spend - Record spending
  if (subPath === '/record-spend' && method === 'POST') {
    const body = parseBody(event);
    await economicCortex.recordSpending(
      tenantId,
      body.amount,
      body.model,
      body.metadata
    );
    return success({ message: 'Spending recorded' });
  }

  // GET /economic/negotiations - Get negotiation history
  if (subPath === '/negotiations' && method === 'GET') {
    const negotiations = economicCortex.getNegotiationHistory(tenantId);
    return success({ negotiations });
  }

  return notFound(`Unknown economic endpoint: ${subPath}`);
}

// ============================================================================
// HELPERS
// ============================================================================

function parseBody<T = Record<string, any>>(event: APIGatewayProxyEvent): T {
  if (!event.body) return {} as T;
  try {
    return JSON.parse(event.body) as T;
  } catch {
    return {} as T;
  }
}

function groupBy<T>(items: T[], key: keyof T): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of items) {
    const value = String(item[key]);
    result[value] = (result[value] || 0) + 1;
  }
  return result;
}

function success(data: unknown, statusCode = 200): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(data),
  };
}

function notFound(message: string): APIGatewayProxyResult {
  return {
    statusCode: 404,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({ error: message }),
  };
}

function serverError(message: string): APIGatewayProxyResult {
  return {
    statusCode: 500,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({ error: message }),
  };
}
