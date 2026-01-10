/**
 * Chat Completions Handler
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Logger } from '../shared/logger';
import { successResponse, streamingResponse, errorResponse } from '../shared/response';
import { ValidationError } from '../shared/errors';
import { extractUserFromEvent } from '../shared/auth';
import { getLiteLLMClient } from '../shared/litellm';
import { sanitizePHI, containsPHI } from '../shared/phi';
import { recordUsageEvent, getModelByName } from '../shared/db';
import { catoSafetyPipeline } from '../shared/services/cato/safety-pipeline.service';
import type { ExecutionContext, Policy, TenantSettings } from '../shared/services/cato/types';
import type { ChatCompletionRequest, ChatMessage } from '../shared/litellm/types';

const logger = new Logger({ handler: 'chat' });

interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  user?: string;
}

export async function handleChat(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();
  const user = await extractUserFromEvent(event);
  
  if (!user) {
    return errorResponse(new ValidationError('User context required'));
  }

  const body = JSON.parse(event.body || '{}') as ChatRequest;
  
  if (!body.model) {
    return errorResponse(new ValidationError('model is required'));
  }
  
  if (!body.messages || body.messages.length === 0) {
    return errorResponse(new ValidationError('messages array is required'));
  }

  logger.info('Chat completion request', {
    model: body.model,
    messageCount: body.messages.length,
    stream: body.stream,
    tenantId: user.tenantId,
  });

  const model = await getModelByName(body.model);
  if (!model) {
    return errorResponse(new ValidationError(`Model not found: ${body.model}`));
  }

  const sanitizedMessages = sanitizeMessages(body.messages);

  const litellmRequest: ChatCompletionRequest = {
    model: model.config.litellm_model_name || body.model,
    messages: sanitizedMessages,
    temperature: body.temperature,
    max_tokens: body.max_tokens,
    top_p: body.top_p,
    stream: body.stream,
    user: user.userId,
    metadata: {
      tenant_id: user.tenantId,
      user_id: user.userId,
      request_id: event.requestContext.requestId,
    },
  };

  try {
    const client = getLiteLLMClient();

    if (body.stream) {
      return streamingResponse(async function* () {
        let totalInputTokens = 0;
        let totalOutputTokens = 0;

        for await (const chunk of client.chatCompletionStream(litellmRequest)) {
          yield `data: ${JSON.stringify(chunk)}\n\n`;
          
          if (chunk.usage) {
            totalInputTokens = chunk.usage.prompt_tokens;
            totalOutputTokens = chunk.usage.completion_tokens;
          }
        }

        yield 'data: [DONE]\n\n';

        await recordUsage(
          user.tenantId,
          user.userId,
          model.id,
          model.provider_id,
          event.requestContext.requestId,
          totalInputTokens,
          totalOutputTokens,
          model.input_cost_per_1k,
          model.output_cost_per_1k,
          Date.now() - startTime,
          'success'
        );
      });
    }

    const response = await client.chatCompletion(litellmRequest);

    // Genesis Cato Safety Pipeline check on response
    const generatedText = response.choices?.[0]?.message?.content || '';
    if (generatedText) {
      const lastMessage = body.messages[body.messages.length - 1];
      const promptText = typeof lastMessage?.content === 'string' 
        ? lastMessage.content 
        : JSON.stringify(lastMessage?.content || '');
      
      const safetyResult = await evaluateCatoSafety(
        user.tenantId,
        user.userId,
        event.requestContext.requestId,
        String(promptText),
        String(generatedText),
        body.model
      );

      if (!safetyResult.allowed) {
        logger.warn('Cato safety blocked response', {
          blockedBy: safetyResult.blockedBy,
          recommendation: safetyResult.recommendation,
        });
        // Return safe alternative or blocked message
        return successResponse({
          ...response,
          choices: [{
            ...response.choices[0],
            message: {
              role: 'assistant',
              content: safetyResult.recommendation || 
                'I apologize, but I cannot provide that response due to safety constraints. Please rephrase your request.',
            },
            finish_reason: 'safety_filter',
          }],
          cato_safety: {
            blocked: true,
            blockedBy: safetyResult.blockedBy,
            recommendation: safetyResult.recommendation,
          },
        });
      }
    }

    await recordUsage(
      user.tenantId,
      user.userId,
      model.id,
      model.provider_id,
      event.requestContext.requestId,
      response.usage.prompt_tokens,
      response.usage.completion_tokens,
      model.input_cost_per_1k,
      model.output_cost_per_1k,
      Date.now() - startTime,
      'success'
    );

    return successResponse(response);
  } catch (error) {
    logger.error('Chat completion failed', error as Error);

    await recordUsage(
      user.tenantId,
      user.userId,
      model.id,
      model.provider_id,
      event.requestContext.requestId,
      0,
      0,
      0,
      0,
      Date.now() - startTime,
      'error',
      (error as Error).message
    );

    return errorResponse(error as Error);
  }
}

function sanitizeMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map(msg => {
    if (typeof msg.content === 'string') {
      const result = sanitizePHI(msg.content);
      return {
        ...msg,
        content: result.sanitizedText,
      };
    }
    return msg;
  });
}

async function evaluateCatoSafety(
  tenantId: string,
  userId: string,
  sessionId: string,
  prompt: string,
  generatedResponse: string,
  modelId: string
): Promise<{ allowed: boolean; blockedBy?: string; recommendation?: string }> {
  try {
    const tenantSettings: TenantSettings = {
      gammaMax: 5.0,
      emergencyThreshold: 0.5,
      sensoryFloor: 0.3,
      hardCostCeiling: 100,
      rateLimit: 100,
      enableSemanticEntropy: true,
      enableRedundantPerception: true,
      enableFractureDetection: true,
    };

    const context: ExecutionContext = {
      tenantId,
      userId,
      sessionId,
      epistemicUncertainty: 0.3,
      sensoryPrecision: 0.7,
      activePersona: 'balanced',
      systemState: {
        tenantId,
        userId,
        sessionId,
        epistemicUncertainty: 0.3,
        sensoryPrecision: 0.7,
        activePersona: 'balanced',
        tenantSettings,
        currentCost: 0,
        requestCount: 1,
      },
    };

    const policy: Policy = {
      id: sessionId,
      action: {
        type: 'chat_completion',
        model: modelId,
        estimatedCost: 0.01,
        containsPHI: false,
        containsPII: false,
        isDestructive: false,
        parameters: { prompt },
      },
      requestedGamma: 2.0,
      priority: 1,
    };

    const result = await catoSafetyPipeline.evaluateAction({
      prompt,
      proposedPolicy: policy,
      generatedResponse,
      actorModel: modelId,
      context,
    });

    return {
      allowed: result.allowed,
      blockedBy: result.blockedBy,
      recommendation: result.recommendation,
    };
  } catch (error) {
    logger.error('Cato safety evaluation failed', error as Error);
    // Fail open on error but log for investigation
    return { allowed: true };
  }
}

async function recordUsage(
  tenantId: string,
  userId: string,
  modelId: string,
  providerId: string,
  requestId: string,
  inputTokens: number,
  outputTokens: number,
  inputCostPer1k: number,
  outputCostPer1k: number,
  latencyMs: number,
  status: 'success' | 'error' | 'timeout',
  errorMessage?: string
): Promise<void> {
  try {
    const inputCost = (inputTokens / 1000) * inputCostPer1k;
    const outputCost = (outputTokens / 1000) * outputCostPer1k;
    const markup = 1.4;

    await recordUsageEvent({
      tenant_id: tenantId,
      user_id: userId,
      model_id: modelId,
      provider_id: providerId,
      request_id: requestId,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
      input_cost: inputCost * markup,
      output_cost: outputCost * markup,
      total_cost: (inputCost + outputCost) * markup,
      latency_ms: latencyMs,
      status,
      error_message: errorMessage,
    });
  } catch (error) {
    logger.error('Failed to record usage', error as Error);
  }
}
