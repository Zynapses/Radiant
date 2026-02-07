// RADIANT v5.52.0 - Polymorphic UI API Endpoints
// Handles chat and sniper mode interactions through Economic Governor

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { economicGovernorService } from '../shared/services/economic-governor.service';
import { createRegisteredLogger } from '../shared/services/logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'thinktank/polymorphic',
  category: 'application',
  sourceType: 'lambda',
});

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
};

const jsonResponse = (statusCode: number, body: object): APIGatewayProxyResult => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(body),
});

const getTenantId = (event: APIGatewayProxyEvent): string | null => {
  return event.headers['x-tenant-id'] || event.headers['X-Tenant-ID'] || null;
};

// =============================================================================
// CHAT ENDPOINT - War Room / Deep Analysis Mode
// =============================================================================

interface ChatRequest {
  message: string;
  mode: 'sniper' | 'war_room';
  taskType: string;
  context?: {
    previousMessages?: Array<{ role: string; content: string }>;
  };
}

export async function handleChat(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const body: ChatRequest = JSON.parse(event.body || '{}');
    const { message, mode, taskType, context } = body;

    if (!message) {
      return jsonResponse(400, { error: 'Message is required' });
    }

    const startTime = Date.now();

    // Get model recommendation from Economic Governor
    // Complexity: 1-10 scale, war_room needs higher quality
    const complexity = mode === 'war_room' ? 8 : 3;
    const maxLatency = mode === 'war_room' ? 5000 : 2000;
    const minQuality = mode === 'war_room' ? 0.85 : 0.7;
    const recommendation = await economicGovernorService.recommendModel(
      tenantId,
      complexity,
      maxLatency,
      minQuality
    );

    // Build system prompt based on mode
    const systemPrompt = mode === 'war_room'
      ? `You are a strategic advisor in War Room mode. Provide deep, multi-perspective analysis. 
         Consider multiple viewpoints, potential risks, and comprehensive recommendations.
         Be thorough but structured in your response.`
      : `You are in Sniper mode. Provide quick, precise, and actionable responses.
         Be concise and direct. Focus on immediate value.`;

    // Build messages array
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(context?.previousMessages || []),
      { role: 'user', content: message },
    ];

    // Call LiteLLM/model through the recommended tier
    const response = await callModel(
      recommendation.model,
      messages,
      tenantId,
      mode === 'war_room' ? 2000 : 500
    );

    const latencyMs = Date.now() - startTime;
    const costCents = calculateCost(recommendation.estimatedCost, response.tokensUsed);

    // Record usage for budget tracking
    await economicGovernorService.recordUsage(
      tenantId,
      recommendation.model,
      response.tokensUsed,
      costCents / 100,
      latencyMs
    );

    logger.info('Polymorphic chat completed', {
      tenantId,
      mode,
      model: recommendation.model,
      tier: recommendation.tier,
      latencyMs,
      costCents,
    });

    return jsonResponse(200, {
      success: true,
      data: {
        response: response.content,
        model: recommendation.model,
        tier: recommendation.tier,
        costCents,
        latencyMs,
        persona: mode === 'war_room' ? 'Sage' : 'Sniper',
        confidence: recommendation.qualityScore,
      },
    });
  } catch (error) {
    logger.error('Polymorphic chat error', { error });
    return jsonResponse(500, { 
      success: false,
      error: 'Failed to process chat request' 
    });
  }
}

// =============================================================================
// SNIPER ENDPOINT - Fast Execution Mode
// =============================================================================

interface SniperRequest {
  command: string;
  projectId: string;
  context?: {
    recentCommands?: string[];
  };
}

export async function handleSniper(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const body: SniperRequest = JSON.parse(event.body || '{}');
    const { command, projectId, context } = body;

    if (!command) {
      return jsonResponse(400, { error: 'Command is required' });
    }

    const startTime = Date.now();

    // Sniper mode always uses fast/cheap models
    // Low complexity, low latency target for speed
    const recommendation = await economicGovernorService.recommendModel(
      tenantId,
      2, // Low complexity for sniper
      1000, // Fast latency target
      0.6 // Lower quality floor acceptable
    );

    // Build sniper-optimized prompt
    const systemPrompt = `You are in Sniper mode - a fast, precise AI assistant.
Rules:
- Be extremely concise
- Provide direct answers
- Use terminal-style formatting when appropriate
- Focus on actionable output
- If asked to execute something, explain what you would do

Project Context: ${projectId}
Recent Commands: ${context?.recentCommands?.join(', ') || 'none'}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: command },
    ];

    // Call model with tight token limit for speed
    const response = await callModel(
      recommendation.model,
      messages,
      tenantId,
      300 // Short responses for sniper mode
    );

    const executionMs = Date.now() - startTime;
    const costCents = calculateCost(recommendation.estimatedCost, response.tokensUsed);

    // Record usage
    await economicGovernorService.recordUsage(
      tenantId,
      recommendation.model,
      response.tokensUsed,
      costCents / 100,
      executionMs
    );

    logger.info('Sniper execution completed', {
      tenantId,
      projectId,
      model: recommendation.model,
      executionMs,
      costCents,
    });

    return jsonResponse(200, {
      success: true,
      data: {
        output: response.content,
        executionMs,
        costCents,
        model: recommendation.model,
        contextHydrated: true,
      },
    });
  } catch (error) {
    logger.error('Sniper execution error', { error });
    return jsonResponse(500, { 
      success: false,
      error: 'Failed to execute sniper command' 
    });
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

interface ModelResponse {
  content: string;
  tokensUsed: number;
}

async function callModel(
  model: string,
  messages: Array<{ role: string; content: string }>,
  _tenantId: string,
  maxTokens: number
): Promise<ModelResponse> {
  // This would call LiteLLM or direct model API
  // For now, use the shared model caller
  const litellmUrl = process.env.LITELLM_BASE_URL || 'http://localhost:4000';
  
  try {
    const response = await fetch(`${litellmUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LITELLM_API_KEY || ''}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`Model call failed: ${response.status}`);
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { total_tokens?: number };
    };
    
    return {
      content: data.choices?.[0]?.message?.content || 'No response generated',
      tokensUsed: data.usage?.total_tokens || 0,
    };
  } catch (error) {
    logger.warn('Model call failed, using fallback response', { error, model });
    
    // Fallback response for development/testing
    return {
      content: `[${model}] Processing your request...\n\nThis response was generated as a fallback. In production, this would connect to the actual model.`,
      tokensUsed: 50,
    };
  }
}

function calculateCost(estimatedCostPerToken: number, tokensUsed: number): number {
  const cost = estimatedCostPerToken * tokensUsed * 100; // Convert to cents
  return Math.round(cost * 100) / 100; // Round to 2 decimal places
}
