/**
 * UEP v2.0 Integration Service
 * 
 * Provides adapters and utilities for integrating UEP v2.0 envelopes
 * across all RADIANT services:
 * - Model Router responses
 * - Cato Pipeline envelopes (v1 → v2 migration)
 * - AGI Orchestrator outputs
 * - Brain Router responses
 * - Response Synthesis results
 * 
 * This centralizes UEP envelope creation and ensures consistent
 * tracing, compliance, and storage across the platform.
 */

import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { enhancedLogger as logger } from '../../logging/enhanced-logger';
import { uepStorageAdapter } from './uds-storage-adapter.service';
import type { StoredEnvelope, UEPStorageOptions } from './uds-storage-adapter.service';

// =============================================================================
// Types
// =============================================================================

export interface UEPEnvelope {
  envelopeId: string;
  specversion: '2.0';
  type: string;
  source: UEPSource;
  payload: UEPPayload;
  tracing: UEPTracing;
  compliance?: UEPCompliance;
  riskSignals?: UEPRiskSignals;
  extensions?: Record<string, unknown>;
}

export interface UEPSource {
  system: 'RADIANT';
  component: string;
  version: string;
  tenantId: string;
  userId?: string;
  sessionId?: string;
}

export interface UEPPayload {
  input: UEPInput;
  output?: UEPOutput;
  metadata?: Record<string, unknown>;
}

export interface UEPInput {
  type: 'text' | 'multimodal' | 'structured';
  content: unknown;
  tokens?: number;
}

export interface UEPOutput {
  type: 'text' | 'multimodal' | 'structured' | 'stream';
  content: unknown;
  tokens?: number;
  finishReason?: string;
}

export interface UEPTracing {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  pipelineId?: string;
  methodId?: string;
  sequence?: number;
  timestamp: string;
  durationMs?: number;
}

export interface UEPCompliance {
  frameworks: string[];
  dataClassification: 'public' | 'internal' | 'confidential' | 'restricted';
  containsPHI: boolean;
  containsPII: boolean;
  retentionDays: number;
  auditRequired: boolean;
}

export interface UEPRiskSignals {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  scores: {
    safety: number;
    compliance: number;
    quality: number;
    cost: number;
  };
  flags: string[];
  mitigations?: string[];
}

// Model Router Response type
export interface ModelResponse {
  content: string;
  modelUsed: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costCents: number;
  cached: boolean;
  loraAdapterUsed?: string;
}

// Cato v1 Envelope (for migration)
export interface CatoMethodEnvelopeV1 {
  envelopeId: string;
  methodId: string;
  methodVersion: string;
  pipelineId: string;
  sequence: number;
  traceId: string;
  input: Record<string, unknown>;
  output?: {
    status: string;
    data?: Record<string, unknown>;
    error?: { code: string; message: string };
  };
  riskSignals?: {
    level: string;
    scores: Record<string, number>;
    flags: string[];
  };
  metadata?: Record<string, unknown>;
  createdAt: string;
  completedAt?: string;
}

// =============================================================================
// Constants
// =============================================================================

const RADIANT_VERSION = process.env.RADIANT_VERSION || '5.52.58';
const DEFAULT_RETENTION_DAYS = 90;
const PHI_RETENTION_DAYS = 2190; // 6 years for HIPAA

// =============================================================================
// Integration Service
// =============================================================================

class UEPIntegrationService {
  private traceIdMap = new Map<string, string>();

  // ===========================================================================
  // Model Router Integration
  // ===========================================================================

  /**
   * Wrap a Model Router response in a UEP v2.0 envelope
   */
  wrapModelResponse(
    tenantId: string,
    request: {
      modelId: string;
      messages: Array<{ role: string; content: string }>;
      systemPrompt?: string;
    },
    response: ModelResponse,
    options: {
      userId?: string;
      sessionId?: string;
      traceId?: string;
      parentSpanId?: string;
      pipelineId?: string;
      complianceFrameworks?: string[];
    } = {}
  ): UEPEnvelope {
    const traceId = options.traceId || this.generateTraceId();
    const spanId = this.generateSpanId();

    return {
      envelopeId: uuidv4(),
      specversion: '2.0',
      type: 'ai.model.response',
      source: {
        system: 'RADIANT',
        component: 'model-router',
        version: RADIANT_VERSION,
        tenantId,
        userId: options.userId,
        sessionId: options.sessionId,
      },
      payload: {
        input: {
          type: 'text',
          content: {
            modelId: request.modelId,
            messages: request.messages,
            systemPrompt: request.systemPrompt,
          },
          tokens: response.inputTokens,
        },
        output: {
          type: 'text',
          content: response.content,
          tokens: response.outputTokens,
          finishReason: 'stop',
        },
        metadata: {
          provider: response.provider,
          modelUsed: response.modelUsed,
          latencyMs: response.latencyMs,
          costCents: response.costCents,
          cached: response.cached,
          loraAdapterUsed: response.loraAdapterUsed,
        },
      },
      tracing: {
        traceId,
        spanId,
        parentSpanId: options.parentSpanId,
        pipelineId: options.pipelineId,
        timestamp: new Date().toISOString(),
        durationMs: response.latencyMs,
      },
      compliance: this.buildCompliance(options.complianceFrameworks),
    };
  }

  // ===========================================================================
  // Cato Pipeline Integration (v1 → v2 Migration)
  // ===========================================================================

  /**
   * Migrate a Cato v1 envelope to UEP v2.0 format
   */
  migrateCatoEnvelope(
    tenantId: string,
    v1Envelope: CatoMethodEnvelopeV1,
    options: {
      userId?: string;
      complianceFrameworks?: string[];
    } = {}
  ): UEPEnvelope {
    return {
      envelopeId: v1Envelope.envelopeId,
      specversion: '2.0',
      type: `cato.method.${v1Envelope.methodId}`,
      source: {
        system: 'RADIANT',
        component: 'cato-pipeline',
        version: RADIANT_VERSION,
        tenantId,
        userId: options.userId,
      },
      payload: {
        input: {
          type: 'structured',
          content: v1Envelope.input,
        },
        output: v1Envelope.output ? {
          type: 'structured',
          content: v1Envelope.output.data,
          finishReason: v1Envelope.output.status,
        } : undefined,
        metadata: {
          methodId: v1Envelope.methodId,
          methodVersion: v1Envelope.methodVersion,
          ...v1Envelope.metadata,
        },
      },
      tracing: {
        traceId: v1Envelope.traceId,
        spanId: this.generateSpanId(),
        pipelineId: v1Envelope.pipelineId,
        methodId: v1Envelope.methodId,
        sequence: v1Envelope.sequence,
        timestamp: v1Envelope.createdAt,
        durationMs: v1Envelope.completedAt 
          ? new Date(v1Envelope.completedAt).getTime() - new Date(v1Envelope.createdAt).getTime()
          : undefined,
      },
      compliance: this.buildCompliance(options.complianceFrameworks),
      riskSignals: v1Envelope.riskSignals ? {
        overallRisk: this.mapRiskLevel(v1Envelope.riskSignals.level),
        scores: {
          safety: v1Envelope.riskSignals.scores.safety || 1.0,
          compliance: v1Envelope.riskSignals.scores.compliance || 1.0,
          quality: v1Envelope.riskSignals.scores.quality || 1.0,
          cost: v1Envelope.riskSignals.scores.cost || 1.0,
        },
        flags: v1Envelope.riskSignals.flags,
      } : undefined,
    };
  }

  /**
   * Create a new Cato method envelope in UEP v2.0 format
   */
  createCatoEnvelope(
    tenantId: string,
    methodId: string,
    input: Record<string, unknown>,
    options: {
      userId?: string;
      pipelineId?: string;
      traceId?: string;
      sequence?: number;
      methodVersion?: string;
      governancePreset?: string;
      complianceFrameworks?: string[];
    } = {}
  ): UEPEnvelope {
    const traceId = options.traceId || this.generateTraceId();
    const pipelineId = options.pipelineId || uuidv4();

    return {
      envelopeId: uuidv4(),
      specversion: '2.0',
      type: `cato.method.${methodId}`,
      source: {
        system: 'RADIANT',
        component: 'cato-pipeline',
        version: RADIANT_VERSION,
        tenantId,
        userId: options.userId,
      },
      payload: {
        input: {
          type: 'structured',
          content: input,
        },
        metadata: {
          methodId,
          methodVersion: options.methodVersion || 'v1',
          governancePreset: options.governancePreset || 'BALANCED',
        },
      },
      tracing: {
        traceId,
        spanId: this.generateSpanId(),
        pipelineId,
        methodId,
        sequence: options.sequence ?? 0,
        timestamp: new Date().toISOString(),
      },
      compliance: this.buildCompliance(options.complianceFrameworks),
    };
  }

  /**
   * Complete a Cato envelope with output
   */
  completeCatoEnvelope(
    envelope: UEPEnvelope,
    output: Record<string, unknown>,
    options: {
      status?: string;
      riskSignals?: UEPRiskSignals;
      durationMs?: number;
    } = {}
  ): UEPEnvelope {
    return {
      ...envelope,
      payload: {
        ...envelope.payload,
        output: {
          type: 'structured',
          content: output,
          finishReason: options.status || 'completed',
        },
      },
      tracing: {
        ...envelope.tracing,
        durationMs: options.durationMs,
      },
      riskSignals: options.riskSignals,
    };
  }

  // ===========================================================================
  // AGI Orchestrator Integration
  // ===========================================================================

  /**
   * Create envelope for AGI orchestration result
   */
  wrapAGIOrchestration(
    tenantId: string,
    orchestrationType: string,
    input: {
      prompt: string;
      context?: Record<string, unknown>;
      mode?: string;
    },
    result: {
      response: string;
      modelsUsed: string[];
      totalTokens: number;
      totalCost: number;
      latencyMs: number;
      reasoning?: string;
    },
    options: {
      userId?: string;
      sessionId?: string;
      traceId?: string;
      complianceFrameworks?: string[];
    } = {}
  ): UEPEnvelope {
    const traceId = options.traceId || this.generateTraceId();

    return {
      envelopeId: uuidv4(),
      specversion: '2.0',
      type: `agi.orchestration.${orchestrationType}`,
      source: {
        system: 'RADIANT',
        component: 'agi-orchestrator',
        version: RADIANT_VERSION,
        tenantId,
        userId: options.userId,
        sessionId: options.sessionId,
      },
      payload: {
        input: {
          type: 'text',
          content: input,
        },
        output: {
          type: 'text',
          content: result.response,
          tokens: result.totalTokens,
          finishReason: 'completed',
        },
        metadata: {
          orchestrationType,
          mode: input.mode,
          modelsUsed: result.modelsUsed,
          latencyMs: result.latencyMs,
          costCents: result.totalCost,
          reasoning: result.reasoning,
        },
      },
      tracing: {
        traceId,
        spanId: this.generateSpanId(),
        timestamp: new Date().toISOString(),
        durationMs: result.latencyMs,
      },
      compliance: this.buildCompliance(options.complianceFrameworks),
    };
  }

  // ===========================================================================
  // Brain Router Integration
  // ===========================================================================

  /**
   * Wrap Brain Router response in UEP envelope
   */
  wrapBrainResponse(
    tenantId: string,
    request: {
      prompt: string;
      domain?: string;
      subdomain?: string;
      preferredModel?: string;
    },
    response: {
      content: string;
      selectedModel: string;
      proficiencyScore: number;
      inputTokens: number;
      outputTokens: number;
      latencyMs: number;
      costCents: number;
    },
    options: {
      userId?: string;
      sessionId?: string;
      conversationId?: string;
      traceId?: string;
      complianceFrameworks?: string[];
    } = {}
  ): UEPEnvelope {
    const traceId = options.traceId || this.generateTraceId();

    return {
      envelopeId: uuidv4(),
      specversion: '2.0',
      type: 'brain.router.response',
      source: {
        system: 'RADIANT',
        component: 'cognitive-brain',
        version: RADIANT_VERSION,
        tenantId,
        userId: options.userId,
        sessionId: options.sessionId,
      },
      payload: {
        input: {
          type: 'text',
          content: request,
        },
        output: {
          type: 'text',
          content: response.content,
          tokens: response.outputTokens,
          finishReason: 'stop',
        },
        metadata: {
          domain: request.domain,
          subdomain: request.subdomain,
          selectedModel: response.selectedModel,
          proficiencyScore: response.proficiencyScore,
          conversationId: options.conversationId,
          latencyMs: response.latencyMs,
          costCents: response.costCents,
        },
      },
      tracing: {
        traceId,
        spanId: this.generateSpanId(),
        timestamp: new Date().toISOString(),
        durationMs: response.latencyMs,
      },
      compliance: this.buildCompliance(options.complianceFrameworks),
    };
  }

  // ===========================================================================
  // Response Synthesis Integration
  // ===========================================================================

  /**
   * Wrap synthesized response in UEP envelope
   */
  wrapSynthesizedResponse(
    tenantId: string,
    synthesisType: 'merge' | 'rank' | 'debate' | 'ensemble',
    inputs: Array<{
      modelId: string;
      response: string;
      confidence?: number;
    }>,
    result: {
      synthesizedResponse: string;
      confidence: number;
      reasoning?: string;
      selectedSources: string[];
      latencyMs: number;
    },
    options: {
      userId?: string;
      traceId?: string;
      pipelineId?: string;
      complianceFrameworks?: string[];
    } = {}
  ): UEPEnvelope {
    const traceId = options.traceId || this.generateTraceId();

    return {
      envelopeId: uuidv4(),
      specversion: '2.0',
      type: `synthesis.${synthesisType}`,
      source: {
        system: 'RADIANT',
        component: 'response-synthesis',
        version: RADIANT_VERSION,
        tenantId,
        userId: options.userId,
      },
      payload: {
        input: {
          type: 'structured',
          content: {
            synthesisType,
            inputs,
          },
        },
        output: {
          type: 'text',
          content: result.synthesizedResponse,
          finishReason: 'synthesized',
        },
        metadata: {
          confidence: result.confidence,
          reasoning: result.reasoning,
          selectedSources: result.selectedSources,
          inputCount: inputs.length,
          latencyMs: result.latencyMs,
        },
      },
      tracing: {
        traceId,
        spanId: this.generateSpanId(),
        pipelineId: options.pipelineId,
        timestamp: new Date().toISOString(),
        durationMs: result.latencyMs,
      },
      compliance: this.buildCompliance(options.complianceFrameworks),
    };
  }

  // ===========================================================================
  // Storage Integration
  // ===========================================================================

  /**
   * Store envelope using UDS tiered storage
   */
  async storeEnvelope(
    envelope: UEPEnvelope,
    options: UEPStorageOptions = {}
  ): Promise<StoredEnvelope> {
    const storageOptions: UEPStorageOptions = {
      ...options,
      pipelineId: options.pipelineId || envelope.tracing.pipelineId,
      traceId: options.traceId || envelope.tracing.traceId,
      compliance: envelope.compliance ? {
        frameworks: envelope.compliance.frameworks,
        dataClassification: envelope.compliance.dataClassification,
        retentionDays: envelope.compliance.retentionDays,
      } : undefined,
    };

    return uepStorageAdapter.store(
      envelope.source.tenantId,
      envelope,
      storageOptions
    );
  }

  /**
   * Store multiple envelopes
   */
  async storeEnvelopes(
    envelopes: UEPEnvelope[],
    options: UEPStorageOptions = {}
  ): Promise<StoredEnvelope[]> {
    if (envelopes.length === 0) return [];
    const tenantId = envelopes[0].source.tenantId;
    return uepStorageAdapter.storeBatch(tenantId, envelopes, options);
  }

  /**
   * Retrieve envelope by ID
   */
  async getEnvelope(
    tenantId: string,
    envelopeId: string
  ): Promise<StoredEnvelope | null> {
    return uepStorageAdapter.get(tenantId, envelopeId);
  }

  /**
   * Query envelopes by trace or pipeline
   */
  async queryEnvelopes(options: {
    tenantId: string;
    pipelineId?: string;
    traceId?: string;
    type?: string;
    limit?: number;
  }) {
    return uepStorageAdapter.query(options);
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private generateTraceId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private generateSpanId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  private mapRiskLevel(level: string): UEPRiskSignals['overallRisk'] {
    switch (level.toLowerCase()) {
      case 'critical':
      case 'extreme':
        return 'critical';
      case 'high':
        return 'high';
      case 'medium':
      case 'moderate':
        return 'medium';
      default:
        return 'low';
    }
  }

  private buildCompliance(frameworks?: string[]): UEPCompliance {
    const hasHIPAA = frameworks?.includes('HIPAA');
    return {
      frameworks: frameworks || [],
      dataClassification: hasHIPAA ? 'restricted' : 'internal',
      containsPHI: false, // Will be detected by compliance service
      containsPII: false, // Will be detected by compliance service
      retentionDays: hasHIPAA ? PHI_RETENTION_DAYS : DEFAULT_RETENTION_DAYS,
      auditRequired: !!frameworks?.length,
    };
  }

  /**
   * Create a child span for distributed tracing
   */
  createChildSpan(parentEnvelope: UEPEnvelope): { traceId: string; spanId: string; parentSpanId: string } {
    return {
      traceId: parentEnvelope.tracing.traceId,
      spanId: this.generateSpanId(),
      parentSpanId: parentEnvelope.tracing.spanId,
    };
  }

  /**
   * Link envelopes for distributed trace
   */
  linkEnvelopes(envelopes: UEPEnvelope[]): UEPEnvelope[] {
    if (envelopes.length === 0) return [];
    
    const traceId = envelopes[0].tracing.traceId;
    return envelopes.map((env, i) => ({
      ...env,
      tracing: {
        ...env.tracing,
        traceId,
        parentSpanId: i > 0 ? envelopes[i - 1].tracing.spanId : undefined,
        sequence: i,
      },
    }));
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const uepIntegrationService = new UEPIntegrationService();
export { UEPIntegrationService };
export default uepIntegrationService;
