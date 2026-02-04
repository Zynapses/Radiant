// RADIANT Autonomous Organism - Integration Service
// Connects organism services with BrainRouter and orchestration layer
// Version: 1.0.0

import { enhancedLogger as logger } from '../../logging/enhanced-logger';
import { mcpServerManager } from './mcp-server-manager.service';
import { neuralSchemaRegistry } from './neural-schema-registry.service';
import { liquidCompute } from './liquid-compute.service';
import { ghostSimulation } from './ghost-simulation.service';
import { economicCortex } from './economic-cortex.service';
import { embeddingService } from '../embedding.service';

// ============================================================================
// Types
// ============================================================================

interface OrganismRoutingRequest {
  tenantId: string;
  userId: string;
  intent: string;
  taskType: string;
  context?: Record<string, unknown>;
  constraints?: {
    maxLatencyMs?: number;
    maxCostPerRequest?: number;
    dataSensitivity?: 'public' | 'internal' | 'confidential' | 'restricted';
    preferredLocation?: 'browser' | 'local' | 'edge' | 'cloud';
    requiresGPU?: boolean;
  };
}

interface OrganismRoutingResult {
  selectedServer?: {
    serverId: string;
    name: string;
    url?: string;
    confidence: number;
  };
  selectedTool?: {
    toolId: string;
    name: string;
    description: string;
    confidence: number;
  };
  computeLocation: {
    location: 'browser' | 'local' | 'edge' | 'cloud';
    reason: string;
    estimatedLatencyMs: number;
    estimatedCost: number;
  };
  ghostPrediction?: {
    predictedSatisfaction: number;
    predictedFrustration: number;
    confidence: number;
    recommendation: string;
  };
  economicDecision?: {
    approved: boolean;
    originalCost: number;
    negotiatedCost: number;
    savings: number;
    alternativeUsed: boolean;
  };
  routingMetadata: {
    totalLatencyMs: number;
    servicesUsed: string[];
    confidenceScore: number;
  };
}

interface OrganismExecutionContext {
  tenantId: string;
  userId: string;
  sessionId: string;
  requestId: string;
  startTime: number;
}

// ============================================================================
// Organism Integration Service
// ============================================================================

class OrganismIntegrationService {
  private initialized = false;

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.info('Initializing Organism Integration Service');

    try {
      // Initialize all organism services
      await Promise.all([
        mcpServerManager.initialize(),
        neuralSchemaRegistry.initialize(),
      ]);

      this.initialized = true;
      logger.info('Organism Integration Service initialized');
    } catch (error) {
      logger.error('Failed to initialize Organism Integration Service:', error);
      throw error;
    }
  }

  // ==========================================================================
  // ROUTING
  // ==========================================================================

  async routeRequest(request: OrganismRoutingRequest): Promise<OrganismRoutingResult> {
    const startTime = Date.now();
    const servicesUsed: string[] = [];

    try {
      // 1. Generate intent embedding
      const intentEmbedding = await this.generateIntentEmbedding(request.intent);
      servicesUsed.push('embedding');

      // 2. Find best MCP server via Neural Affinity Routing
      const serverDecision = await mcpServerManager.routeByNeuralAffinity(
        intentEmbedding,
        {
          maxLatencyMs: request.constraints?.maxLatencyMs,
          maxCostPerCall: request.constraints?.maxCostPerRequest,
          requiredCapabilities: [],
        }
      );
      servicesUsed.push('mcp-server-manager');

      // 3. Find best tool for the intent
      const tools = await neuralSchemaRegistry.findToolsByIntent(
        intentEmbedding,
        5,
        {
          maxCost: request.constraints?.maxCostPerRequest,
        }
      );
      servicesUsed.push('neural-schema-registry');

      const selectedTool = tools.length > 0 ? tools[0] : undefined;

      // 4. Select compute location via Liquid Compute
      const computeDecision = await liquidCompute.selectComputeLocation(
        request.tenantId,
        {
          toolId: selectedTool?.toolId || 'unknown',
          minMemoryMb: 256,
          requiresGPU: request.constraints?.requiresGPU || false,
          requiredCapabilities: [],
          estimatedExecutionMs: selectedTool?.avgExecutionMs || 1000,
          dataSensitivity: request.constraints?.dataSensitivity || 'public',
        },
        {
          maxLatencyMs: request.constraints?.maxLatencyMs,
        }
      );
      servicesUsed.push('liquid-compute');

      // 5. Run Ghost simulation for prediction (if user exists)
      let ghostPrediction: OrganismRoutingResult['ghostPrediction'];
      try {
        const simulation = await ghostSimulation.runSimulation(
          request.userId,
          request.tenantId,
          'user_reaction',
          selectedTool?.toolId || '',
          request.intent,
          request.context || {}
        );
        
        const confidenceNum = simulation.confidence === 'high' ? 0.9 : 
          simulation.confidence === 'medium' ? 0.7 : 
          simulation.confidence === 'low' ? 0.5 : 0.3;
        
        ghostPrediction = {
          predictedSatisfaction: simulation.prediction?.predictedSatisfaction || 0.7,
          predictedFrustration: simulation.prediction?.predictedFrustration || 0.1,
          confidence: confidenceNum,
          recommendation: confidenceNum > 0.7 ? 'proceed' : 'verify',
        };
        servicesUsed.push('ghost-simulation');
      } catch {
        // Ghost simulation is optional
      }

      // 6. Economic negotiation
      let economicDecision: OrganismRoutingResult['economicDecision'];
      const estimatedCost = (selectedTool?.estimatedCostPerCall || 0.01) + computeDecision.estimatedCost;
      
      try {
        const negotiation = await economicCortex.negotiateCost(
          request.tenantId,
          request.intent,
          estimatedCost,
          {
            requiredQuality: 0.8,
            maxLatencyMs: request.constraints?.maxLatencyMs,
            allowDowngrade: true,
          }
        );

        economicDecision = {
          approved: negotiation.approved,
          originalCost: negotiation.estimatedCost,
          negotiatedCost: negotiation.finalCost,
          savings: negotiation.savingsAchieved,
          alternativeUsed: negotiation.selectedAlternative !== undefined,
        };
        servicesUsed.push('economic-cortex');
      } catch {
        // Economic negotiation is optional
        economicDecision = {
          approved: true,
          originalCost: estimatedCost,
          negotiatedCost: estimatedCost,
          savings: 0,
          alternativeUsed: false,
        };
      }

      // Build result
      const totalLatencyMs = Date.now() - startTime;
      
      // Calculate overall confidence
      const topCandidate = serverDecision.candidates?.[0];
      const serverConfidence = topCandidate?.finalScore || 0.5;
      const confidenceFactors = [
        serverConfidence,
        selectedTool ? 0.8 : 0.3,
        ghostPrediction?.confidence || 0.5,
      ];
      const avgConfidence = confidenceFactors.reduce((a, b) => a + b, 0) / confidenceFactors.length;

      return {
        selectedServer: topCandidate ? {
          serverId: topCandidate.toolId, // toolId contains the server reference
          name: topCandidate.toolId,
          url: undefined,
          confidence: serverConfidence,
        } : undefined,
        selectedTool: selectedTool ? {
          toolId: selectedTool.toolId,
          name: selectedTool.name,
          description: selectedTool.description,
          confidence: 0.8, // Would be from search score
        } : undefined,
        computeLocation: {
          location: computeDecision.selectedLocation,
          reason: computeDecision.reason,
          estimatedLatencyMs: computeDecision.estimatedLatencyMs,
          estimatedCost: computeDecision.estimatedCost,
        },
        ghostPrediction,
        economicDecision,
        routingMetadata: {
          totalLatencyMs,
          servicesUsed,
          confidenceScore: avgConfidence,
        },
      };
    } catch (error) {
      logger.error('Organism routing failed:', error);
      throw error;
    }
  }

  // ==========================================================================
  // TOOL EXECUTION
  // ==========================================================================

  async executeWithOrganism(
    context: OrganismExecutionContext,
    toolId: string,
    input: Record<string, unknown>
  ): Promise<{
    output: unknown;
    metrics: {
      executionTimeMs: number;
      computeLocation: string;
      cost: number;
      success: boolean;
    };
  }> {
    const startTime = Date.now();

    try {
      // Get tool schema
      const tool = neuralSchemaRegistry.getSchema(toolId);
      if (!tool) {
        throw new Error(`Tool not found: ${toolId}`);
      }

      // Select compute location
      const computeDecision = await liquidCompute.selectComputeLocation(
        context.tenantId,
        {
          toolId,
          minMemoryMb: 256,
          requiresGPU: false,
          requiredCapabilities: [],
          estimatedExecutionMs: tool.avgExecutionMs,
          dataSensitivity: tool.sensitivityLevel,
        },
        {}
      );

      // Execute tool (placeholder - would integrate with actual MCP client)
      const output = await this.executeToolOnLocation(
        tool,
        input,
        computeDecision.selectedLocation
      );

      const executionTimeMs = Date.now() - startTime;

      // Record metrics
      await neuralSchemaRegistry.updateToolMetrics(toolId, {
        toolId,
        success: true,
        latencyMs: executionTimeMs,
        cost: computeDecision.estimatedCost,
      });

      // Record spending
      await economicCortex.recordSpending(
        context.tenantId,
        computeDecision.estimatedCost,
        tool.name,
        { toolId, sessionId: context.sessionId }
      );

      // Update ghost vector (via running a simulation to update the vector)
      try {
        await ghostSimulation.runSimulation(
          context.userId,
          context.tenantId,
          'outcome_prediction',
          toolId,
          'Tool execution completed',
          { success: true, latencyMs: executionTimeMs }
        );
      } catch {
        // Ghost update is optional
      }

      return {
        output,
        metrics: {
          executionTimeMs,
          computeLocation: computeDecision.selectedLocation,
          cost: computeDecision.estimatedCost,
          success: true,
        },
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      // Record failure
      await neuralSchemaRegistry.updateToolMetrics(toolId, {
        toolId,
        success: false,
        latencyMs: executionTimeMs,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  private async executeToolOnLocation(
    tool: { serverId: string; name: string },
    input: Record<string, unknown>,
    location: string
  ): Promise<unknown> {
    // Placeholder for actual tool execution
    // Would integrate with MCP client based on location
    logger.info(`Executing tool ${tool.name} on ${location}`);
    
    // Simulate execution
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return { result: 'Tool executed successfully', input };
  }

  // ==========================================================================
  // BRAIN ROUTER INTEGRATION
  // ==========================================================================

  async enhanceBrainRouterContext(
    tenantId: string,
    userId: string,
    taskType: string,
    originalContext: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    // Get ghost prediction for user
    let ghostContext: Record<string, unknown> = {};
    try {
      const vector = await ghostSimulation.getOrCreateGhostVector(userId, tenantId);
      ghostContext = {
        userConfidence: vector.confidenceScore,
        interactionCount: vector.interactionCount,
        hasGhostVector: true,
      };
    } catch {
      ghostContext = { hasGhostVector: false };
    }

    // Get economic context
    let economicContext: Record<string, unknown> = {};
    try {
      const config = economicCortex.getConfig(tenantId);
      if (config) {
        economicContext = {
          negotiationStrategy: config.negotiationStrategy,
          preferSelfHosted: config.preferSelfHosted,
          qualityFloor: config.qualityFloor,
        };
      }
    } catch {
      // Ignore
    }

    // Get available tools for task type
    const availableTools = neuralSchemaRegistry.getAllSchemas()
      .filter(t => t.primaryDomain === taskType || t.secondaryDomains.includes(taskType))
      .slice(0, 10)
      .map(t => ({ toolId: t.toolId, name: t.name, category: t.category }));

    return {
      ...originalContext,
      organism: {
        ghost: ghostContext,
        economic: economicContext,
        availableTools,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private async generateIntentEmbedding(intent: string): Promise<Float32Array> {
    try {
      const result = await embeddingService.generateEmbedding(intent);
      return new Float32Array(result.embedding);
    } catch (error) {
      logger.warn('Failed to generate intent embedding:', error);
      return new Float32Array(1536);
    }
  }

  // ==========================================================================
  // GETTERS
  // ==========================================================================

  isInitialized(): boolean {
    return this.initialized;
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const organismIntegration = new OrganismIntegrationService();
export { OrganismIntegrationService };
