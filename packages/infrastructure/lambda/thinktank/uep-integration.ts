/**
 * Think Tank UEP Integration
 * 
 * Provides UEP v2.0 envelope wrapping for all Think Tank prompt flows:
 * - Chat responses
 * - Orchestration (Council of Rivals, etc.)
 * - Artifact generation
 * - Brain plan execution
 * 
 * This ensures all AI interactions are:
 * - Traceable with distributed tracing
 * - Compliant with regulatory frameworks
 * - Stored in UDS tiered storage for scale
 */

import type { APIGatewayProxyEvent } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

// =============================================================================
// Types
// =============================================================================

export interface ThinkTankUEPContext {
  envelopeId: string;
  traceId: string;
  spanId: string;
  tenantId: string;
  userId: string;
  sessionId?: string;
  conversationId?: string;
  startTime: number;
}

export interface UEPEnvelope {
  envelopeId: string;
  specversion: '2.0';
  type: string;
  source: {
    system: 'RADIANT';
    component: 'think-tank';
    version: string;
    tenantId: string;
    userId: string;
    sessionId?: string;
  };
  payload: {
    input: { type: string; content: unknown };
    output: { type: string; content: unknown; finishReason?: string };
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
}

export interface ChatResponse {
  content: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costCents?: number;
}

export interface OrchestrationResponse {
  content: string;
  modelsUsed: string[];
  totalTokens: number;
  totalCost: number;
  latencyMs: number;
  reasoning?: string;
}

// =============================================================================
// Constants
// =============================================================================

const RADIANT_VERSION = process.env.RADIANT_VERSION || '5.52.58';
const TRACE_HEADER = 'x-trace-id';

// =============================================================================
// Context Management
// =============================================================================

/**
 * Extract UEP context from Think Tank request
 */
export function extractContext(
  event: APIGatewayProxyEvent,
  tenantId: string,
  userId: string,
  conversationId?: string
): ThinkTankUEPContext {
  const headers = event.headers || {};
  
  return {
    envelopeId: uuidv4(),
    traceId: headers[TRACE_HEADER] || headers['X-Trace-Id'] || crypto.randomBytes(16).toString('hex'),
    spanId: crypto.randomBytes(8).toString('hex'),
    tenantId,
    userId,
    sessionId: headers['x-session-id'] || headers['X-Session-Id'],
    conversationId,
    startTime: Date.now(),
  };
}

/**
 * Create child context for nested operations
 */
export function createChildContext(parent: ThinkTankUEPContext): ThinkTankUEPContext {
  return {
    ...parent,
    envelopeId: uuidv4(),
    spanId: crypto.randomBytes(8).toString('hex'),
    startTime: Date.now(),
  };
}

// =============================================================================
// Envelope Creation
// =============================================================================

/**
 * Wrap Think Tank chat response in UEP envelope
 */
export function wrapChatResponse(
  ctx: ThinkTankUEPContext,
  prompt: string,
  response: ChatResponse,
  options: {
    messageId?: string;
    complianceFrameworks?: string[];
  } = {}
): UEPEnvelope {
  const durationMs = Date.now() - ctx.startTime;

  return {
    envelopeId: ctx.envelopeId,
    specversion: '2.0',
    type: 'thinktank.chat.response',
    source: {
      system: 'RADIANT',
      component: 'think-tank',
      version: RADIANT_VERSION,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      sessionId: ctx.sessionId,
    },
    payload: {
      input: {
        type: 'text',
        content: { prompt },
      },
      output: {
        type: 'text',
        content: response.content,
        finishReason: 'stop',
      },
      metadata: {
        modelId: response.modelId,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        latencyMs: response.latencyMs,
        costCents: response.costCents,
        conversationId: ctx.conversationId,
        messageId: options.messageId,
      },
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
  };
}

/**
 * Wrap orchestration response (Council of Rivals, etc.)
 */
export function wrapOrchestrationResponse(
  ctx: ThinkTankUEPContext,
  orchestrationType: string,
  prompt: string,
  response: OrchestrationResponse,
  options: {
    complianceFrameworks?: string[];
  } = {}
): UEPEnvelope {
  const durationMs = Date.now() - ctx.startTime;

  return {
    envelopeId: ctx.envelopeId,
    specversion: '2.0',
    type: `thinktank.orchestration.${orchestrationType}`,
    source: {
      system: 'RADIANT',
      component: 'think-tank',
      version: RADIANT_VERSION,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      sessionId: ctx.sessionId,
    },
    payload: {
      input: {
        type: 'text',
        content: { prompt, orchestrationType },
      },
      output: {
        type: 'text',
        content: response.content,
        finishReason: 'completed',
      },
      metadata: {
        orchestrationType,
        modelsUsed: response.modelsUsed,
        totalTokens: response.totalTokens,
        totalCost: response.totalCost,
        latencyMs: response.latencyMs,
        reasoning: response.reasoning,
        conversationId: ctx.conversationId,
      },
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
  };
}

/**
 * Wrap artifact generation response
 */
export function wrapArtifactResponse(
  ctx: ThinkTankUEPContext,
  artifactType: string,
  prompt: string,
  artifact: {
    artifactId: string;
    content: string;
    language?: string;
    title?: string;
  },
  options: {
    complianceFrameworks?: string[];
  } = {}
): UEPEnvelope {
  const durationMs = Date.now() - ctx.startTime;

  return {
    envelopeId: ctx.envelopeId,
    specversion: '2.0',
    type: `thinktank.artifact.${artifactType}`,
    source: {
      system: 'RADIANT',
      component: 'think-tank',
      version: RADIANT_VERSION,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      sessionId: ctx.sessionId,
    },
    payload: {
      input: {
        type: 'text',
        content: { prompt, artifactType },
      },
      output: {
        type: 'structured',
        content: artifact,
        finishReason: 'completed',
      },
      metadata: {
        artifactId: artifact.artifactId,
        artifactType,
        language: artifact.language,
        conversationId: ctx.conversationId,
      },
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
  };
}

/**
 * Wrap Brain Plan execution response
 */
export function wrapBrainPlanResponse(
  ctx: ThinkTankUEPContext,
  planType: string,
  prompt: string,
  response: {
    content: string;
    selectedModel: string;
    proficiencyScore: number;
    domain?: string;
    subdomain?: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    costCents?: number;
  },
  options: {
    complianceFrameworks?: string[];
  } = {}
): UEPEnvelope {
  const durationMs = Date.now() - ctx.startTime;

  return {
    envelopeId: ctx.envelopeId,
    specversion: '2.0',
    type: `thinktank.brainplan.${planType}`,
    source: {
      system: 'RADIANT',
      component: 'think-tank',
      version: RADIANT_VERSION,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      sessionId: ctx.sessionId,
    },
    payload: {
      input: {
        type: 'text',
        content: { prompt, planType },
      },
      output: {
        type: 'text',
        content: response.content,
        finishReason: 'stop',
      },
      metadata: {
        selectedModel: response.selectedModel,
        proficiencyScore: response.proficiencyScore,
        domain: response.domain,
        subdomain: response.subdomain,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        latencyMs: response.latencyMs,
        costCents: response.costCents,
        conversationId: ctx.conversationId,
      },
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
  };
}

// =============================================================================
// Storage Integration
// =============================================================================

/**
 * Store envelope to UDS tiered storage (async, fire-and-forget)
 */
export async function storeEnvelope(envelope: UEPEnvelope): Promise<void> {
  try {
    // Dynamic import to avoid circular dependency
    const { uepStorageAdapter } = await import('../shared/services/uep/index.js');
    
    await uepStorageAdapter.store(
      envelope.source.tenantId,
      { envelopeId: envelope.envelopeId, ...envelope },
      {
        traceId: envelope.tracing.traceId,
        compliance: envelope.compliance ? {
          frameworks: envelope.compliance.frameworks,
          dataClassification: envelope.compliance.dataClassification,
        } : undefined,
      }
    );
  } catch (error) {
    logger.warn('Failed to store Think Tank UEP envelope', { 
      envelopeId: envelope.envelopeId, 
      error: error instanceof Error ? error.message : 'unknown' 
    });
  }
}

/**
 * Store envelope and return - convenience for inline use
 */
export async function storeAndReturn<T>(envelope: UEPEnvelope, data: T): Promise<{ envelope: UEPEnvelope; data: T }> {
  // Fire-and-forget storage
  storeEnvelope(envelope).catch(() => {});
  return { envelope, data };
}

// =============================================================================
// Response Helpers
// =============================================================================

/**
 * Create API response with UEP envelope included
 */
export function createEnvelopedResponse(
  statusCode: number,
  envelope: UEPEnvelope,
  data: unknown
): { statusCode: number; headers: Record<string, string>; body: string } {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID,X-Trace-Id',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'x-trace-id': envelope.tracing.traceId,
      'x-envelope-id': envelope.envelopeId,
    },
    body: JSON.stringify({
      envelope,
      data,
    }),
  };
}

/**
 * Create API response without envelope (for backward compatibility)
 * Still stores envelope asynchronously
 */
export function createCompatibleResponse(
  statusCode: number,
  envelope: UEPEnvelope,
  data: unknown
): { statusCode: number; headers: Record<string, string>; body: string } {
  // Store envelope asynchronously
  storeEnvelope(envelope).catch(() => {});

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID,X-Trace-Id',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'x-trace-id': envelope.tracing.traceId,
      'x-envelope-id': envelope.envelopeId,
    },
    body: JSON.stringify(data),
  };
}

export default {
  extractContext,
  createChildContext,
  wrapChatResponse,
  wrapOrchestrationResponse,
  wrapArtifactResponse,
  wrapBrainPlanResponse,
  storeEnvelope,
  storeAndReturn,
  createEnvelopedResponse,
  createCompatibleResponse,
};
