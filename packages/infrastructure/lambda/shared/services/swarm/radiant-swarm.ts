/**
 * RadiantSwarm - Scatter-Gather Orchestrator for AI Agent Execution
 * 
 * This is the entry point for all multi-agent reasoning tasks. It implements
 * scatter-gather parallelism where agent failures don't block the swarm.
 * 
 * Key Design Decisions:
 * - Uses Promise.allSettled() for fault tolerance
 * - Delegates complex workflows to Flyte for durability
 * - Integrates with Cato for safety enforcement
 * - Emits Redis events for real-time UI updates
 */

import { v4 as uuidv4 } from 'uuid';
import { Redis } from 'ioredis';
import { FlyteLauncher, FlyteWorkflowInput } from './flyte-launcher';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// ============================================================================
// TYPES
// ============================================================================

export interface SwarmRequest {
  tenantId: string;
  sessionId: string;
  userId: string;
  
  task: SwarmTask;
  agents: AgentConfig[];
  options?: SwarmOptions;
}

export interface SwarmTask {
  type: 'chat' | 'research' | 'code' | 'analysis' | 'creative';
  prompt: string;
  context?: Record<string, unknown>;
  attachments?: Attachment[];
  systemPrompt?: string;
}

export interface AgentConfig {
  agentId: string;
  role: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  tools?: string[];
}

export interface Attachment {
  type: 'image' | 'document' | 'code' | 'url';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface SwarmOptions {
  mode?: 'parallel' | 'sequential' | 'hierarchical';
  timeoutMs?: number;
  perAgentTimeoutMs?: number;
  enableHitl?: boolean;
  hitlDomain?: 'medical' | 'financial' | 'legal' | 'general';
  qualityThreshold?: number;
  consensusRequired?: boolean;
  minAgentAgreement?: number;
}

export interface SwarmResult {
  swarmId: string;
  status: 'completed' | 'partial' | 'failed' | 'pending_human';
  agentResults: AgentResult[];
  synthesis?: SynthesizedResult;
  pendingDecisionId?: string;
  flyteExecutionId?: string;
  metrics: SwarmMetrics;
}

export interface AgentResult {
  agentId: string;
  status: 'success' | 'failed' | 'timeout' | 'rejected';
  response?: string;
  error?: string;
  latencyMs: number;
  tokensUsed?: number;
  safetyPassed: boolean;
  safetyViolations?: string[];
}

export interface SynthesizedResult {
  response: string;
  confidence: number;
  sources: string[];
  requiresHumanReview: boolean;
  reviewReason?: string;
}

export interface SwarmMetrics {
  totalLatencyMs: number;
  agentCount: number;
  successCount: number;
  failureCount: number;
  totalTokensUsed: number;
  estimatedCostUsd: number;
}

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

// ============================================================================
// RADIANT SWARM IMPLEMENTATION
// ============================================================================

export class RadiantSwarm {
  private readonly flyteLauncher: FlyteLauncher;
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(
    private readonly redis: Redis,
    private readonly logger: Logger,
    flyteAdminUrl: string,
    flyteProject: string,
    flyteDomain: string
  ) {
    this.flyteLauncher = new FlyteLauncher(
      flyteAdminUrl,
      flyteProject,
      flyteDomain,
      logger
    );
    this.s3Client = new S3Client({});
    this.bucketName = process.env.RADIANT_DATA_BUCKET || 'radiant-data';
  }

  async execute(request: SwarmRequest): Promise<SwarmResult> {
    const swarmId = uuidv4();
    const startTime = Date.now();

    this.logger.info('Swarm execution started', {
      swarmId,
      tenantId: request.tenantId,
      taskType: request.task.type,
      agentCount: request.agents.length,
      enableHitl: request.options?.enableHitl,
    });

    await this.publishEvent(request.tenantId, 'swarm_started', {
      swarmId,
      sessionId: request.sessionId,
      taskType: request.task.type,
      agentCount: request.agents.length,
    });

    try {
      if (request.options?.enableHitl) {
        return await this.executeWithFlyte(swarmId, request, startTime);
      }

      return await this.executeDirectly(swarmId, request, startTime);
    } catch (error) {
      this.logger.error('Swarm execution failed', {
        swarmId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      await this.publishEvent(request.tenantId, 'swarm_failed', {
        swarmId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        swarmId,
        status: 'failed',
        agentResults: [],
        metrics: {
          totalLatencyMs: Date.now() - startTime,
          agentCount: request.agents.length,
          successCount: 0,
          failureCount: request.agents.length,
          totalTokensUsed: 0,
          estimatedCostUsd: 0,
        },
      };
    }
  }

  private async executeDirectly(
    swarmId: string,
    request: SwarmRequest,
    startTime: number
  ): Promise<SwarmResult> {
    const mode = request.options?.mode || 'parallel';
    let agentResults: AgentResult[];

    switch (mode) {
      case 'parallel':
        agentResults = await this.executeParallel(request);
        break;
      case 'sequential':
        agentResults = await this.executeSequential(request);
        break;
      case 'hierarchical':
        agentResults = await this.executeHierarchical(request);
        break;
      default:
        agentResults = await this.executeParallel(request);
    }

    const successCount = agentResults.filter(r => r.status === 'success').length;
    const failureCount = agentResults.filter(r => r.status !== 'success').length;
    const totalTokensUsed = agentResults.reduce((sum, r) => sum + (r.tokensUsed || 0), 0);

    let synthesis: SynthesizedResult | undefined;
    if (successCount > 0) {
      synthesis = await this.synthesizeResults(request, agentResults);
    }

    const totalLatencyMs = Date.now() - startTime;

    await this.publishEvent(request.tenantId, 'swarm_completed', {
      swarmId,
      status: failureCount === 0 ? 'completed' : 'partial',
      successCount,
      failureCount,
      latencyMs: totalLatencyMs,
    });

    return {
      swarmId,
      status: successCount === 0 ? 'failed' : failureCount === 0 ? 'completed' : 'partial',
      agentResults,
      synthesis,
      metrics: {
        totalLatencyMs,
        agentCount: request.agents.length,
        successCount,
        failureCount,
        totalTokensUsed,
        estimatedCostUsd: this.estimateCost(totalTokensUsed),
      },
    };
  }

  private async executeWithFlyte(
    swarmId: string,
    request: SwarmRequest,
    startTime: number
  ): Promise<SwarmResult> {
    const s3Uri = await this.uploadInputToS3(swarmId, request);

    const flyteInput: FlyteWorkflowInput = {
      s3_uri: s3Uri,
      swarm_id: swarmId,
      tenant_id: request.tenantId,
      session_id: request.sessionId,
      user_id: request.userId,
      hitl_domain: request.options?.hitlDomain || 'general',
    };

    const executionId = await this.flyteLauncher.launchWorkflow(
      'think_tank_hitl_workflow',
      flyteInput
    );

    this.logger.info('Flyte workflow launched', {
      swarmId,
      executionId,
      hitlDomain: request.options?.hitlDomain,
    });

    await this.publishEvent(request.tenantId, 'swarm_pending_human', {
      swarmId,
      executionId,
      hitlDomain: request.options?.hitlDomain,
    });

    return {
      swarmId,
      status: 'pending_human',
      agentResults: [],
      flyteExecutionId: executionId,
      metrics: {
        totalLatencyMs: Date.now() - startTime,
        agentCount: request.agents.length,
        successCount: 0,
        failureCount: 0,
        totalTokensUsed: 0,
        estimatedCostUsd: 0,
      },
    };
  }

  private async uploadInputToS3(swarmId: string, request: SwarmRequest): Promise<string> {
    const key = `bronze/swarm-inputs/${request.tenantId}/${swarmId}.json`;
    
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: JSON.stringify({
        task: request.task,
        agents: request.agents,
        options: request.options,
        metadata: {
          tenantId: request.tenantId,
          sessionId: request.sessionId,
          userId: request.userId,
          createdAt: new Date().toISOString(),
        },
      }),
      ContentType: 'application/json',
    }));

    return `s3://${this.bucketName}/${key}`;
  }

  private async executeParallel(request: SwarmRequest): Promise<AgentResult[]> {
    const perAgentTimeout = request.options?.perAgentTimeoutMs || 30000;

    const promises = request.agents.map(agent =>
      this.executeAgent(request, agent, perAgentTimeout)
    );

    const results = await Promise.allSettled(promises);

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        agentId: request.agents[index].agentId,
        status: 'failed' as const,
        error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
        latencyMs: perAgentTimeout,
        safetyPassed: false,
      };
    });
  }

  private async executeSequential(request: SwarmRequest): Promise<AgentResult[]> {
    const results: AgentResult[] = [];
    const perAgentTimeout = request.options?.perAgentTimeoutMs || 30000;

    for (const agent of request.agents) {
      try {
        const result = await this.executeAgent(request, agent, perAgentTimeout);
        results.push(result);

        if (result.status !== 'success') {
          break;
        }
      } catch (error) {
        results.push({
          agentId: agent.agentId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          latencyMs: 0,
          safetyPassed: false,
        });
        break;
      }
    }

    return results;
  }

  private async executeHierarchical(request: SwarmRequest): Promise<AgentResult[]> {
    if (request.agents.length < 2) {
      return this.executeParallel(request);
    }

    const [coordinator, ...workers] = request.agents;
    const perAgentTimeout = request.options?.perAgentTimeoutMs || 30000;

    const coordinatorResult = await this.executeAgent(request, coordinator, perAgentTimeout);
    
    if (coordinatorResult.status !== 'success') {
      return [coordinatorResult];
    }

    const workerPromises = workers.map(worker =>
      this.executeAgent(request, worker, perAgentTimeout, coordinatorResult.response)
    );

    const workerResults = await Promise.allSettled(workerPromises);

    return [
      coordinatorResult,
      ...workerResults.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        }
        return {
          agentId: workers[index].agentId,
          status: 'failed' as const,
          error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
          latencyMs: perAgentTimeout,
          safetyPassed: false,
        };
      }),
    ];
  }

  private async executeAgent(
    request: SwarmRequest,
    agent: AgentConfig,
    timeoutMs: number,
    coordinatorGuidance?: string
  ): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const prompt = coordinatorGuidance
        ? `${request.task.prompt}\n\nCoordinator guidance: ${coordinatorGuidance}`
        : request.task.prompt;

      const litellmUrl = process.env.LITELLM_PROXY_URL || 'http://localhost:4000';
      const litellmKey = process.env.LITELLM_API_KEY || '';

      const response = await fetch(`${litellmUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${litellmKey}`,
          'X-Tenant-ID': request.tenantId,
        },
        body: JSON.stringify({
          model: agent.model,
          messages: [
            ...(request.task.systemPrompt ? [{ role: 'system', content: request.task.systemPrompt }] : []),
            { role: 'user', content: prompt },
          ],
          temperature: agent.temperature ?? 0.7,
          max_tokens: agent.maxTokens ?? 2048,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LiteLLM error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const latencyMs = Date.now() - startTime;

      const content = data.choices?.[0]?.message?.content || '';
      const tokensUsed = data.usage?.total_tokens || 0;

      const safetyResult = await this.checkSafety(request.tenantId, content);

      if (!safetyResult.passed) {
        return {
          agentId: agent.agentId,
          status: 'rejected',
          error: 'Content failed safety check',
          latencyMs,
          tokensUsed,
          safetyPassed: false,
          safetyViolations: safetyResult.violations,
        };
      }

      return {
        agentId: agent.agentId,
        status: 'success',
        response: content,
        latencyMs,
        tokensUsed,
        safetyPassed: true,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      if (error instanceof Error && error.name === 'AbortError') {
        return {
          agentId: agent.agentId,
          status: 'timeout',
          error: `Agent timed out after ${timeoutMs}ms`,
          latencyMs,
          safetyPassed: false,
        };
      }

      return {
        agentId: agent.agentId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        latencyMs,
        safetyPassed: false,
      };
    }
  }

  private async checkSafety(
    tenantId: string,
    content: string
  ): Promise<{ passed: boolean; violations: string[] }> {
    try {
      const catoUrl = process.env.CATO_SAFETY_URL;
      if (!catoUrl) {
        return { passed: true, violations: [] };
      }

      const response = await fetch(`${catoUrl}/api/safety/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId,
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        this.logger.warn('Safety check failed, allowing by default', { tenantId });
        return { passed: true, violations: [] };
      }

      const result = await response.json();
      return {
        passed: result.passed ?? true,
        violations: result.violations ?? [],
      };
    } catch (error) {
      this.logger.warn('Safety check error, allowing by default', {
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return { passed: true, violations: [] };
    }
  }

  private async synthesizeResults(
    request: SwarmRequest,
    agentResults: AgentResult[]
  ): Promise<SynthesizedResult> {
    const successfulResults = agentResults.filter(r => r.status === 'success' && r.response);

    if (successfulResults.length === 0) {
      return {
        response: '',
        confidence: 0,
        sources: [],
        requiresHumanReview: true,
        reviewReason: 'No successful agent responses',
      };
    }

    if (successfulResults.length === 1) {
      return {
        response: successfulResults[0].response!,
        confidence: 0.7,
        sources: [successfulResults[0].agentId],
        requiresHumanReview: false,
      };
    }

    const synthesisPrompt = `You are a synthesis expert. Combine the following expert responses into a single coherent answer.

Original question: ${request.task.prompt}

Expert responses:
${successfulResults.map((r, i) => `Expert ${i + 1} (${r.agentId}): ${r.response}`).join('\n\n')}

Provide a synthesized answer that incorporates the best insights from all experts.`;

    try {
      const litellmUrl = process.env.LITELLM_PROXY_URL || 'http://localhost:4000';
      const litellmKey = process.env.LITELLM_API_KEY || '';

      const response = await fetch(`${litellmUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${litellmKey}`,
          'X-Tenant-ID': request.tenantId,
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview',
          messages: [{ role: 'user', content: synthesisPrompt }],
          temperature: 0.3,
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        throw new Error('Synthesis failed');
      }

      const data = await response.json();
      const synthesizedContent = data.choices?.[0]?.message?.content || '';

      const agreementScore = this.calculateAgreement(successfulResults);
      const requiresHumanReview = agreementScore < (request.options?.minAgentAgreement || 0.6);

      return {
        response: synthesizedContent,
        confidence: agreementScore,
        sources: successfulResults.map(r => r.agentId),
        requiresHumanReview,
        reviewReason: requiresHumanReview ? 'Low agent agreement' : undefined,
      };
    } catch (error) {
      return {
        response: successfulResults[0].response!,
        confidence: 0.5,
        sources: successfulResults.map(r => r.agentId),
        requiresHumanReview: true,
        reviewReason: 'Synthesis failed, using first response',
      };
    }
  }

  private calculateAgreement(results: AgentResult[]): number {
    if (results.length < 2) return 1.0;

    const responses = results.map(r => r.response?.toLowerCase() || '');
    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < responses.length; i++) {
      for (let j = i + 1; j < responses.length; j++) {
        totalSimilarity += this.jaccardSimilarity(responses[i], responses[j]);
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  private jaccardSimilarity(a: string, b: string): number {
    const setA = new Set(a.split(/\s+/));
    const setB = new Set(b.split(/\s+/));
    
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private estimateCost(tokens: number): number {
    const costPer1kTokens = 0.002;
    return (tokens / 1000) * costPer1kTokens;
  }

  private async publishEvent(
    tenantId: string,
    eventType: string,
    data: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.redis.publish(
        `swarm_event:${tenantId}`,
        JSON.stringify({
          type: eventType,
          data,
          timestamp: new Date().toISOString(),
        })
      );
    } catch (error) {
      this.logger.warn('Failed to publish swarm event', {
        tenantId,
        eventType,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }
}

export function createRadiantSwarm(
  redis: Redis,
  logger: Logger,
  flyteAdminUrl?: string,
  flyteProject?: string,
  flyteDomain?: string
): RadiantSwarm {
  return new RadiantSwarm(
    redis,
    logger,
    flyteAdminUrl || process.env.FLYTE_ADMIN_URL || 'http://localhost:30080',
    flyteProject || process.env.FLYTE_PROJECT || 'radiant',
    flyteDomain || process.env.FLYTE_DOMAIN || 'development'
  );
}
