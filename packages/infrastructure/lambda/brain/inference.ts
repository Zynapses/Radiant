/**
 * RADIANT v6.0.4 - Brain Inference Lambda
 * Main entry point for AGI Brain inference requests
 * 
 * Orchestrates:
 * - Ghost Vector loading/saving
 * - SOFAI routing
 * - Context assembly (Compliance Sandwich)
 * - Flash fact detection
 * - Async re-anchoring
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import { executeStatement } from '../shared/db/client';
import { brainConfigService } from '../shared/services/brain-config.service';
import { ghostManagerService } from '../shared/services/ghost-manager.service';
import { flashBufferService } from '../shared/services/flash-buffer.service';
import { sofaiRouterService } from '../shared/services/sofai-router.service';
import { contextAssemblerService } from '../shared/services/context-assembler.service';
import { oversightService } from '../shared/services/oversight.service';
import {
  BrainInferenceRequest,
  BrainInferenceResponse,
  SystemLevel,
  ConversationMessage,
} from '@radiant/shared';
import { embeddingService } from '../shared/services/embedding.service';
import { ecdVerificationService } from '../shared/services/ecd-verification.service';

// =============================================================================
// Redis Initialization
// =============================================================================

let redisClient: Redis | null = null;
let servicesInitialized = false;

async function initializeServices(): Promise<void> {
  if (servicesInitialized) return;

  const redisUrl = process.env.REDIS_URL || process.env.REDIS_ENDPOINT;
  if (redisUrl && !redisClient) {
    try {
      redisClient = new Redis(redisUrl);
      redisClient.on('error', (err) => {
        logger.error('Redis connection error', { error: String(err) });
      });

      // Initialize services with Redis client
      const redisAdapter = {
        get: async (key: string) => redisClient?.get(key) ?? null,
        set: async (key: string, value: string, options?: { EX?: number }) => {
          if (options?.EX) {
            await redisClient?.setex(key, options.EX, value);
          } else {
            await redisClient?.set(key, value);
          }
        },
        lpush: async (key: string, ...values: string[]) => redisClient?.lpush(key, ...values) ?? 0,
        lrange: async (key: string, start: number, stop: number) => redisClient?.lrange(key, start, stop) ?? [],
        ltrim: async (key: string, start: number, stop: number) => { await redisClient?.ltrim(key, start, stop); },
        expire: async (key: string, seconds: number) => { await redisClient?.expire(key, seconds); },
        del: async (key: string) => { await redisClient?.del(key); },
      };

      flashBufferService.initialize(redisAdapter);
      ghostManagerService.initialize(redisAdapter);
      logger.info('Brain services initialized with Redis');
    } catch (err) {
      logger.warn('Redis unavailable, services running without cache', { error: String(err) });
    }
  }

  servicesInitialized = true;
}

// =============================================================================
// Response Helpers
// =============================================================================

function success(body: unknown): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}

function error(statusCode: number, message: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({ error: message }),
  };
}

// =============================================================================
// Main Handler
// =============================================================================

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();
  const requestId = uuidv4();

  // Initialize services on cold start
  await initializeServices();

  try {
    // Parse request
    if (!event.body) {
      return error(400, 'Request body is required');
    }

    const request: BrainInferenceRequest = JSON.parse(event.body);
    const { userId, tenantId, prompt, conversationHistory, domain, forceSystemLevel, options } = request;

    if (!userId || !tenantId || !prompt) {
      return error(400, 'userId, tenantId, and prompt are required');
    }

    logger.info('Brain inference started', { requestId, userId, tenantId, promptLength: prompt.length });

    // Set tenant context for RLS
    await executeStatement(`SELECT set_config('app.current_tenant_id', $1, true)`, [
      { name: 'tenantId', value: { stringValue: tenantId } },
    ]);

    // ===========================================================================
    // Step 1: Load Ghost Vector (if enabled)
    // ===========================================================================
    let ghostVector: Float32Array | null = null;
    let ghostUpdated = false;

    if (options?.includeGhost !== false) {
      const ghostResult = await ghostManagerService.loadGhost(userId, tenantId);
      
      if (ghostResult.found && ghostResult.versionMatch) {
        ghostVector = ghostResult.vector;
        logger.debug('Ghost loaded', { userId, turnCount: ghostResult.turnCount });
      } else if (!ghostResult.versionMatch && ghostResult.found) {
        logger.info('Ghost version mismatch - cold start', { userId });
      }
    }

    // ===========================================================================
    // Step 2: SOFAI Routing
    // ===========================================================================
    const routingDecision = await sofaiRouterService.route({
      prompt,
      userId,
      tenantId,
      domain,
      forceLevel: forceSystemLevel,
    });

    logger.debug('SOFAI routing complete', {
      level: routingDecision.level,
      trust: routingDecision.trust,
      domainRisk: routingDecision.domainRisk,
    });

    // ===========================================================================
    // Step 3: Assemble Context (Compliance Sandwich)
    // ===========================================================================
    const assembledContext = await contextAssemblerService.assemble({
      userId,
      tenantId,
      prompt,
      conversationHistory: conversationHistory as ConversationMessage[],
      ghostVector,
      domain: domain || sofaiRouterService.detectDomain(prompt),
    });

    const contextValidation = contextAssemblerService.validateContext(assembledContext);
    if (!contextValidation.valid) {
      logger.warn('Context validation warnings', { warnings: contextValidation.warnings });
    }

    // ===========================================================================
    // Step 4: Call LLM with ECD Verification (Truth Engine™)
    // ===========================================================================
    const detectedDomain = domain || sofaiRouterService.detectDomain(prompt);
    
    // Use ECD verification service for verified inference
    const verificationResult = await ecdVerificationService.executeWithVerification({
      userId,
      tenantId,
      requestId,
      prompt,
      sourceContext: assembledContext.userContext,
      flashFacts: assembledContext.flashFacts.map(f => f.fact),
      retrievedDocs: [], // Add retrieved docs if available
      domain: detectedDomain,
      generateResponse: async (refinedPrompt: string) => {
        const result = await callLLM(
          contextAssemblerService.formatForModel({
            ...assembledContext,
            userContext: refinedPrompt,
          }),
          routingDecision.level,
          options
        );
        return result.response;
      },
    });

    // Get final LLM response with token usage
    const llmResponse = await callLLM(
      contextAssemblerService.formatForModel(assembledContext),
      routingDecision.level,
      options
    );
    
    // Use verified response if ECD passed, otherwise use verification result
    const finalResponse = verificationResult.passed 
      ? llmResponse.response 
      : verificationResult.finalResponse;

    logger.debug('ECD verification complete', {
      passed: verificationResult.passed,
      ecdScore: verificationResult.ecdScore.score,
      refinementAttempts: verificationResult.refinementAttempts,
      blocked: verificationResult.blocked,
    });

    // ===========================================================================
    // Step 5: Detect Flash Facts
    // ===========================================================================
    const flashFactsDetected = flashBufferService.detectFlashFacts(prompt);

    if (flashFactsDetected.detected) {
      for (const fact of flashFactsDetected.facts) {
        await flashBufferService.storeFact(userId, tenantId, fact);
      }
      logger.info('Flash facts stored', { count: flashFactsDetected.facts.length });
    }

    // ===========================================================================
    // Step 6: Check for Re-anchoring (async)
    // ===========================================================================
    if (options?.includeGhost !== false) {
      const needsReanchor = await ghostManagerService.checkReAnchorNeeded(userId, tenantId);
      
      if (needsReanchor) {
        // Fire-and-forget re-anchoring
        ghostManagerService.reAnchorAsync(
          userId,
          tenantId,
          [prompt, llmResponse.response],
          async (history) => {
            // Generate ghost vector from conversation history
            const combinedText = history.join(' ').slice(0, 8000);
            const result = await embeddingService.generateEmbedding(combinedText);
            const ghostVector = new Float32Array(4096);
            const len = Math.min(result.embedding.length, 4096);
            for (let i = 0; i < len; i++) {
              ghostVector[i] = result.embedding[i];
            }
            return ghostVector;
          }
        );
        ghostUpdated = true;
      } else {
        // Increment turn count
        await ghostManagerService.incrementTurnCount(userId, tenantId);
      }
    }

    // ===========================================================================
    // Step 7: Check for Human Oversight (high-risk domains + ECD failures)
    // ===========================================================================
    if (oversightService.requiresOversight(detectedDomain) || verificationResult.requiresOversight) {
      // For high-risk domains or ECD failures, consider submitting to oversight
      logger.debug('Oversight may be required', { 
        domain: detectedDomain,
        ecdRequiresOversight: verificationResult.requiresOversight,
      });
    }

    // ===========================================================================
    // Step 8: Log Inference
    // ===========================================================================
    await logInference({
      requestId,
      userId,
      tenantId,
      systemLevel: routingDecision.level,
      ghostLoaded: ghostVector !== null,
      ghostUpdated,
      flashFactsCount: flashFactsDetected.facts.length,
      memoriesCount: assembledContext.flashFacts.length,
      contextTokens: contextValidation.totalTokens,
      responseTokens: llmResponse.tokenUsage.output,
      totalTokens: llmResponse.tokenUsage.total,
      latencyMs: Date.now() - startTime,
      modelUsed: llmResponse.model,
    });

    // ===========================================================================
    // Build Response
    // ===========================================================================
    const response: BrainInferenceResponse = {
      response: finalResponse,
      systemLevel: routingDecision.level,
      routingDecision,
      budget: assembledContext.budget,
      ghostUpdated,
      flashFactsDetected,
      latencyMs: Date.now() - startTime,
      tokenUsage: llmResponse.tokenUsage,
      // ECD verification metadata
      verification: {
        passed: verificationResult.passed,
        ecdScore: verificationResult.ecdScore.score,
        refinementAttempts: verificationResult.refinementAttempts,
        blocked: verificationResult.blocked,
      },
    };

    logger.info('Brain inference complete', {
      requestId,
      latencyMs: response.latencyMs,
      systemLevel: response.systemLevel,
    });

    return success(response);
  } catch (err) {
    logger.error('Brain inference failed', { requestId, error: String(err) });
    return error(500, `Inference failed: ${String(err)}`);
  }
}

// =============================================================================
// LLM Call - Routes through LiteLLM proxy
// =============================================================================

interface LLMResponse {
  response: string;
  model: string;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
}

const LITELLM_ENDPOINT = process.env.LITELLM_ENDPOINT || 'http://localhost:4000';

async function callLLM(
  formattedContext: string,
  systemLevel: SystemLevel,
  options?: { maxTokens?: number; temperature?: number }
): Promise<LLMResponse> {
  // Select model based on system level
  const model = systemLevel === 'system2' 
    ? process.env.SYSTEM2_MODEL || 'llama3-70b-instruct'
    : systemLevel === 'system1.5' 
      ? process.env.SYSTEM15_MODEL || 'llama3-8b-instruct'
      : process.env.SYSTEM1_MODEL || 'llama3-8b-instruct';

  const maxTokens = options?.maxTokens || 2048;
  const temperature = options?.temperature ?? (systemLevel === 'system2' ? 0.7 : 0.3);

  try {
    // Call LiteLLM proxy
    const response = await fetch(`${LITELLM_ENDPOINT}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LITELLM_API_KEY || ''}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: formattedContext },
        ],
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LiteLLM error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      model: string;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    return {
      response: data.choices[0]?.message?.content || '',
      model: data.model || model,
      tokenUsage: {
        input: data.usage?.prompt_tokens || 0,
        output: data.usage?.completion_tokens || 0,
        total: data.usage?.total_tokens || 0,
      },
    };
  } catch (error) {
    logger.error('LLM call failed', { model, error: String(error) });
    
    // Fallback for development/testing
    if (process.env.NODE_ENV === 'development') {
      return {
        response: `[Dev mode - LLM unavailable] System ${systemLevel} would respond here.`,
        model,
        tokenUsage: {
          input: Math.ceil(formattedContext.length / 4),
          output: 50,
          total: Math.ceil(formattedContext.length / 4) + 50,
        },
      };
    }
    throw error;
  }
}

// =============================================================================
// Logging
// =============================================================================

async function logInference(data: {
  requestId: string;
  userId: string;
  tenantId: string;
  systemLevel: SystemLevel;
  ghostLoaded: boolean;
  ghostUpdated: boolean;
  flashFactsCount: number;
  memoriesCount: number;
  contextTokens: number;
  responseTokens: number;
  totalTokens: number;
  latencyMs: number;
  modelUsed: string;
}): Promise<void> {
  try {
    await executeStatement(
      `INSERT INTO brain_inference_log 
       (id, user_id, tenant_id, system_level, ghost_loaded, ghost_updated,
        flash_facts_count, memories_count, context_tokens, response_tokens,
        total_tokens, latency_ms, model_used)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        { name: 'id', value: { stringValue: data.requestId } },
        { name: 'userId', value: { stringValue: data.userId } },
        { name: 'tenantId', value: { stringValue: data.tenantId } },
        { name: 'systemLevel', value: { stringValue: data.systemLevel } },
        { name: 'ghostLoaded', value: { booleanValue: data.ghostLoaded } },
        { name: 'ghostUpdated', value: { booleanValue: data.ghostUpdated } },
        { name: 'flashFactsCount', value: { longValue: data.flashFactsCount } },
        { name: 'memoriesCount', value: { longValue: data.memoriesCount } },
        { name: 'contextTokens', value: { longValue: data.contextTokens } },
        { name: 'responseTokens', value: { longValue: data.responseTokens } },
        { name: 'totalTokens', value: { longValue: data.totalTokens } },
        { name: 'latencyMs', value: { longValue: data.latencyMs } },
        { name: 'modelUsed', value: { stringValue: data.modelUsed } },
      ]
    );
  } catch (error) {
    logger.warn(`Failed to log inference: ${String(error)}`);
  }
}
