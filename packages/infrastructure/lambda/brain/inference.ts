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
    // Step 4: Call LLM (placeholder - integrate with actual inference)
    // ===========================================================================
    const llmResponse = await callLLM(
      contextAssemblerService.formatForModel(assembledContext),
      routingDecision.level,
      options
    );

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
            // Placeholder for actual ghost capture
            return new Float32Array(4096);
          }
        );
        ghostUpdated = true;
      } else {
        // Increment turn count
        await ghostManagerService.incrementTurnCount(userId, tenantId);
      }
    }

    // ===========================================================================
    // Step 7: Check for Human Oversight (high-risk domains)
    // ===========================================================================
    const detectedDomain = domain || sofaiRouterService.detectDomain(prompt);
    if (oversightService.requiresOversight(detectedDomain)) {
      // For high-risk domains, consider submitting to oversight
      // This is typically done for generated insights, not raw responses
      logger.debug('High-risk domain detected', { domain: detectedDomain });
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
      response: llmResponse.response,
      systemLevel: routingDecision.level,
      routingDecision,
      budget: assembledContext.budget,
      ghostUpdated,
      flashFactsDetected,
      latencyMs: Date.now() - startTime,
      tokenUsage: llmResponse.tokenUsage,
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
// LLM Call (placeholder)
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

async function callLLM(
  formattedContext: string,
  systemLevel: SystemLevel,
  options?: { maxTokens?: number; temperature?: number }
): Promise<LLMResponse> {
  // TODO: Integrate with actual LLM inference
  // This would call SageMaker, LiteLLM, or external APIs based on systemLevel
  
  const model = systemLevel === 'system2' 
    ? 'llama3-70b' 
    : systemLevel === 'system1.5' 
      ? 'llama3-8b' 
      : 'llama3-8b-fast';

  // Placeholder response
  return {
    response: '[Brain response placeholder - integrate with LLM]',
    model,
    tokenUsage: {
      input: Math.ceil(formattedContext.length / 4),
      output: 50,
      total: Math.ceil(formattedContext.length / 4) + 50,
    },
  };
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
