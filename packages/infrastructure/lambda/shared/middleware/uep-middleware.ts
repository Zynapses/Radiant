/**
 * UEP Middleware
 * 
 * Express/Lambda middleware for automatic UEP v2.0 envelope wrapping.
 * Use in Think Tank and other API handlers for consistent envelope generation.
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// =============================================================================
// Types
// =============================================================================

export interface UEPMiddlewareOptions {
  component: string;
  storeEnvelopes?: boolean;
  complianceFrameworks?: string[];
  includeTraceHeaders?: boolean;
}

export interface UEPRequestContext {
  envelopeId: string;
  traceId: string;
  spanId: string;
  tenantId: string;
  userId?: string;
  sessionId?: string;
  startTime: number;
}

export interface UEPEnvelopeResponse {
  envelope: {
    envelopeId: string;
    specversion: '2.0';
    type: string;
    source: {
      system: 'RADIANT';
      component: string;
      version: string;
      tenantId: string;
      userId?: string;
      sessionId?: string;
    };
    payload: {
      input: {
        type: 'text' | 'structured';
        content: unknown;
      };
      output: {
        type: 'text' | 'structured';
        content: unknown;
        finishReason?: string;
      };
      metadata?: Record<string, unknown>;
    };
    tracing: {
      traceId: string;
      spanId: string;
      parentSpanId?: string;
      timestamp: string;
      durationMs: number;
    };
    compliance?: {
      frameworks: string[];
      dataClassification: string;
      auditRequired: boolean;
    };
  };
  data: unknown;
}

// =============================================================================
// Constants
// =============================================================================

const RADIANT_VERSION = process.env.RADIANT_VERSION || '5.52.58';
const TRACE_HEADER = 'x-trace-id';
const SPAN_HEADER = 'x-span-id';
const PARENT_SPAN_HEADER = 'x-parent-span-id';

// =============================================================================
// Context Extraction
// =============================================================================

/**
 * Extract UEP context from request
 */
export function extractUEPContext(
  event: APIGatewayProxyEvent,
  tenantId: string,
  userId?: string
): UEPRequestContext {
  const headers = event.headers || {};
  
  return {
    envelopeId: uuidv4(),
    traceId: headers[TRACE_HEADER] || headers['X-Trace-Id'] || crypto.randomBytes(16).toString('hex'),
    spanId: crypto.randomBytes(8).toString('hex'),
    tenantId,
    userId,
    sessionId: headers['x-session-id'] || headers['X-Session-Id'],
    startTime: Date.now(),
  };
}

/**
 * Get trace headers for downstream calls
 */
export function getTraceHeaders(ctx: UEPRequestContext): Record<string, string> {
  return {
    [TRACE_HEADER]: ctx.traceId,
    [SPAN_HEADER]: ctx.spanId,
    [PARENT_SPAN_HEADER]: ctx.spanId, // Current becomes parent for child
  };
}

// =============================================================================
// Envelope Wrapping
// =============================================================================

/**
 * Wrap API response in UEP envelope
 */
export function wrapResponse(
  ctx: UEPRequestContext,
  eventType: string,
  input: unknown,
  output: unknown,
  options: UEPMiddlewareOptions,
  metadata?: Record<string, unknown>
): UEPEnvelopeResponse {
  const durationMs = Date.now() - ctx.startTime;

  return {
    envelope: {
      envelopeId: ctx.envelopeId,
      specversion: '2.0',
      type: eventType,
      source: {
        system: 'RADIANT',
        component: options.component,
        version: RADIANT_VERSION,
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        sessionId: ctx.sessionId,
      },
      payload: {
        input: {
          type: typeof input === 'string' ? 'text' : 'structured',
          content: input,
        },
        output: {
          type: typeof output === 'string' ? 'text' : 'structured',
          content: output,
          finishReason: 'completed',
        },
        metadata,
      },
      tracing: {
        traceId: ctx.traceId,
        spanId: ctx.spanId,
        timestamp: new Date().toISOString(),
        durationMs,
      },
      compliance: options.complianceFrameworks?.length ? {
        frameworks: options.complianceFrameworks,
        dataClassification: 'internal',
        auditRequired: true,
      } : undefined,
    },
    data: output,
  };
}

/**
 * Create Lambda response with UEP envelope
 */
export function createUEPResponse(
  ctx: UEPRequestContext,
  statusCode: number,
  eventType: string,
  input: unknown,
  output: unknown,
  options: UEPMiddlewareOptions,
  metadata?: Record<string, unknown>
): APIGatewayProxyResult {
  const wrapped = wrapResponse(ctx, eventType, input, output, options, metadata);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID,X-Trace-Id,X-Span-Id',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  };

  if (options.includeTraceHeaders) {
    headers[TRACE_HEADER] = ctx.traceId;
    headers[SPAN_HEADER] = ctx.spanId;
    headers['x-envelope-id'] = ctx.envelopeId;
  }

  return {
    statusCode,
    headers,
    body: JSON.stringify(wrapped),
  };
}

/**
 * Create error response with UEP envelope
 */
export function createUEPErrorResponse(
  ctx: UEPRequestContext,
  statusCode: number,
  errorCode: string,
  message: string,
  input: unknown,
  options: UEPMiddlewareOptions
): APIGatewayProxyResult {
  const wrapped = wrapResponse(
    ctx,
    'error',
    input,
    { error: errorCode, message },
    options,
    { errorCode, statusCode }
  );

  wrapped.envelope.payload.output.finishReason = 'error';

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID,X-Trace-Id,X-Span-Id',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      ...(options.includeTraceHeaders ? {
        [TRACE_HEADER]: ctx.traceId,
        [SPAN_HEADER]: ctx.spanId,
        'x-envelope-id': ctx.envelopeId,
      } : {}),
    },
    body: JSON.stringify(wrapped),
  };
}

// =============================================================================
// Think Tank Specific Helpers
// =============================================================================

/**
 * Wrap Think Tank chat response
 */
export function wrapChatResponse(
  ctx: UEPRequestContext,
  prompt: string,
  response: {
    content: string;
    modelId: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    costCents?: number;
  },
  options: UEPMiddlewareOptions & {
    conversationId?: string;
    messageId?: string;
  }
): UEPEnvelopeResponse {
  return wrapResponse(
    ctx,
    'thinktank.chat.response',
    { prompt },
    response.content,
    options,
    {
      modelId: response.modelId,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      latencyMs: response.latencyMs,
      costCents: response.costCents,
      conversationId: options.conversationId,
      messageId: options.messageId,
    }
  );
}

/**
 * Wrap Think Tank orchestration response (Council of Rivals, etc.)
 */
export function wrapOrchestrationResponse(
  ctx: UEPRequestContext,
  orchestrationType: string,
  prompt: string,
  response: {
    content: string;
    modelsUsed: string[];
    totalTokens: number;
    totalCost: number;
    latencyMs: number;
    reasoning?: string;
  },
  options: UEPMiddlewareOptions
): UEPEnvelopeResponse {
  return wrapResponse(
    ctx,
    `thinktank.orchestration.${orchestrationType}`,
    { prompt, orchestrationType },
    response.content,
    options,
    {
      orchestrationType,
      modelsUsed: response.modelsUsed,
      totalTokens: response.totalTokens,
      totalCost: response.totalCost,
      latencyMs: response.latencyMs,
      reasoning: response.reasoning,
    }
  );
}

/**
 * Wrap artifact generation response
 */
export function wrapArtifactResponse(
  ctx: UEPRequestContext,
  artifactType: string,
  prompt: string,
  artifact: {
    artifactId: string;
    content: string;
    language?: string;
    title?: string;
  },
  options: UEPMiddlewareOptions
): UEPEnvelopeResponse {
  return wrapResponse(
    ctx,
    `thinktank.artifact.${artifactType}`,
    { prompt, artifactType },
    artifact,
    options,
    {
      artifactId: artifact.artifactId,
      artifactType,
      language: artifact.language,
    }
  );
}

// =============================================================================
// Cato Method Helpers
// =============================================================================

/**
 * Wrap Cato method execution
 */
export function wrapCatoMethodExecution(
  ctx: UEPRequestContext,
  methodId: string,
  input: Record<string, unknown>,
  output: Record<string, unknown>,
  options: UEPMiddlewareOptions & {
    pipelineId: string;
    sequence: number;
    methodVersion?: string;
    riskSignals?: {
      level: string;
      scores: Record<string, number>;
      flags: string[];
    };
  }
): UEPEnvelopeResponse {
  const wrapped = wrapResponse(
    ctx,
    `cato.method.${methodId.replace('method:', '').replace(':v1', '')}`,
    input,
    output,
    options,
    {
      methodId,
      methodVersion: options.methodVersion || 'v1',
      pipelineId: options.pipelineId,
      sequence: options.sequence,
    }
  );

  // Add pipeline tracing
  (wrapped.envelope.tracing as Record<string, unknown>).pipelineId = options.pipelineId;
  (wrapped.envelope.tracing as Record<string, unknown>).methodId = methodId;
  (wrapped.envelope.tracing as Record<string, unknown>).sequence = options.sequence;

  // Add risk signals if present
  if (options.riskSignals) {
    (wrapped.envelope as Record<string, unknown>).riskSignals = {
      overallRisk: options.riskSignals.level.toLowerCase(),
      scores: {
        safety: options.riskSignals.scores.safety || 1.0,
        compliance: options.riskSignals.scores.compliance || 1.0,
        quality: options.riskSignals.scores.quality || 1.0,
        cost: options.riskSignals.scores.cost || 1.0,
      },
      flags: options.riskSignals.flags,
    };
  }

  return wrapped;
}

// =============================================================================
// Storage Integration
// =============================================================================

/**
 * Store envelope asynchronously (fire-and-forget)
 */
export async function storeEnvelopeAsync(envelope: UEPEnvelopeResponse['envelope']): Promise<void> {
  try {
    // Dynamic import to avoid circular dependency
    const { uepStorageAdapter } = await import('../services/uep/index.js');
    
    await uepStorageAdapter.store(
      envelope.source.tenantId,
      { envelopeId: envelope.envelopeId, ...envelope },
      {
        traceId: envelope.tracing.traceId,
        pipelineId: (envelope.tracing as Record<string, unknown>).pipelineId as string | undefined,
      }
    );
  } catch (error) {
    logger.warn('Failed to store UEP envelope', { 
      envelopeId: envelope.envelopeId, 
      error: error instanceof Error ? error.message : 'unknown' 
    });
  }
}

export default {
  extractUEPContext,
  getTraceHeaders,
  wrapResponse,
  createUEPResponse,
  createUEPErrorResponse,
  wrapChatResponse,
  wrapOrchestrationResponse,
  wrapArtifactResponse,
  wrapCatoMethodExecution,
  storeEnvelopeAsync,
};
