// RADIANT v5.53.0 - UEP v1.0 to v2.0 Migration Service
// Provides backward compatibility and migration utilities

import * as crypto from 'crypto';
import {
  UEPEnvelope,
  UEPSourceCard,
  UEPSourceType,
  UEPPayload,
  UEPTracingInfo,
  UEPConfidenceScore,
  UEPRiskSignal,
  UEPComplianceInfo,
  UEPMetrics,
  UEP_SPEC_VERSION,
} from '@radiant/shared';

// Import v1.0 types from cato-pipeline
import {
  CatoMethodEnvelope,
  CatoMethodType,
  CatoConfidenceFactor,
  CatoRiskSignal,
  CatoModelUsage,
} from '@radiant/shared';

/**
 * Map v1.0 CatoMethodType to v2.0 UEPSourceType
 */
const METHOD_TYPE_MAP: Record<string, UEPSourceType> = {
  OBSERVER: 'method',
  PROPOSER: 'method',
  DECIDER: 'method',
  VALIDATOR: 'method',
  EXECUTOR: 'method',
  RED_TEAM: 'method',
  CRITIC: 'method',
  SECURITY_CRITIC: 'method',
  EFFICIENCY_CRITIC: 'method',
  FACTUAL_CRITIC: 'method',
  COMPLIANCE_CRITIC: 'method',
};

/**
 * UEP Migration Service
 * 
 * Provides utilities for:
 * - Converting v1.0 CatoMethodEnvelope to v2.0 UEPEnvelope
 * - Validating v1.0 envelope compatibility
 * - Batch migration of historical envelopes
 */
export class UEPMigrationService {
  /**
   * Convert a v1.0 CatoMethodEnvelope to v2.0 UEPEnvelope
   */
  migrateToV2<T>(v1Envelope: CatoMethodEnvelope<T>): UEPEnvelope<T> {
    return {
      // Identity
      envelopeId: v1Envelope.envelopeId,
      specversion: UEP_SPEC_VERSION,
      type: 'method.output',
      timestamp: v1Envelope.timestamp instanceof Date 
        ? v1Envelope.timestamp.toISOString() 
        : v1Envelope.timestamp,
      
      // Source
      source: this.migrateSource(v1Envelope),
      
      // Destination
      destination: v1Envelope.destination ? {
        destinationId: v1Envelope.destination.methodId,
        destinationType: 'method',
        routingReason: v1Envelope.destination.routingReason,
      } : undefined,
      
      // Payload
      payload: this.migratePayload(v1Envelope),
      
      // Tracing
      tracing: this.migrateTracing(v1Envelope),
      
      // Governance
      confidence: v1Envelope.confidence ? this.migrateConfidence(v1Envelope.confidence) : undefined,
      riskSignals: v1Envelope.riskSignals?.map(s => this.migrateRiskSignal(s)),
      compliance: v1Envelope.compliance ? this.migrateCompliance(v1Envelope.compliance) : undefined,
      
      // Metrics
      metrics: this.migrateMetrics(v1Envelope),
      
      // Extensions (preserve v1.0-specific fields)
      extensions: {
        legacyEnvelopeVersion: v1Envelope.envelopeVersion,
        legacySequence: v1Envelope.sequence,
        legacyOutputSummary: v1Envelope.output.summary,
        legacyOutputType: v1Envelope.output.outputType,
        legacyPipelineId: v1Envelope.pipelineId,
        legacyTenantId: v1Envelope.tenantId,
        legacyContextStrategy: v1Envelope.contextStrategy,
        migratedAt: new Date().toISOString(),
        migratedFrom: 'UEP/1.0',
      },
    };
  }

  /**
   * Migrate source information
   */
  private migrateSource<T>(v1: CatoMethodEnvelope<T>): UEPSourceCard {
    const sourceType = METHOD_TYPE_MAP[v1.source.methodType] || 'method';
    
    // Extract AI model info from v1 models array
    const primaryModel = v1.models?.[0];
    
    return {
      sourceId: v1.source.methodId,
      sourceType,
      name: v1.source.methodName,
      version: v1.envelopeVersion || '1.0.0',
      registryRef: {
        registry: 'cato-method',
        lookupKey: v1.source.methodId,
        registryVersion: v1.envelopeVersion,
      },
      aiModel: primaryModel ? {
        provider: primaryModel.provider || 'unknown',
        modelId: primaryModel.modelId,
        temperature: primaryModel.temperature,
        mode: primaryModel.mode,
      } : undefined,
      executionContext: {
        pipelineId: v1.pipelineId,
        tenantId: v1.tenantId,
      },
    };
  }

  /**
   * Migrate payload
   */
  private migratePayload<T>(v1: CatoMethodEnvelope<T>): UEPPayload<T> {
    const dataJson = JSON.stringify(v1.output.data);
    
    return {
      contentType: 'application/json',
      delivery: 'inline',
      data: v1.output.data,
      schema: {
        schemaRef: v1.output.schemaRef,
        schemaVersion: '1.0.0',
      },
      hash: {
        algorithm: 'sha256',
        value: v1.output.hash || crypto.createHash('sha256').update(dataJson).digest('hex'),
      },
      sizeBytes: Buffer.byteLength(dataJson, 'utf8'),
    };
  }

  /**
   * Migrate tracing
   */
  private migrateTracing<T>(v1: CatoMethodEnvelope<T>): UEPTracingInfo {
    return {
      traceId: v1.tracing.traceId,
      spanId: v1.tracing.spanId,
      parentSpanId: v1.tracing.parentSpanId,
    };
  }

  /**
   * Migrate confidence
   */
  private migrateConfidence(v1Confidence: {
    score: number;
    factors: CatoConfidenceFactor[];
  }): UEPConfidenceScore {
    return {
      score: v1Confidence.score,
      factors: v1Confidence.factors.map(f => ({
        factor: f.factor,
        value: f.value,
        weight: f.weight,
      })),
    };
  }

  /**
   * Migrate risk signal
   */
  private migrateRiskSignal(v1Signal: CatoRiskSignal): UEPRiskSignal {
    return {
      signalId: v1Signal.signalId || crypto.randomUUID(),
      signalType: v1Signal.signalType,
      severity: v1Signal.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
      description: v1Signal.description,
      source: v1Signal.source,
      mitigationSuggestion: v1Signal.mitigationSuggestion,
    };
  }

  /**
   * Migrate compliance
   */
  private migrateCompliance(v1Compliance: {
    frameworks: string[];
    dataClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
    containsPii: boolean;
    containsPhi: boolean;
    retentionDays?: number;
  }): UEPComplianceInfo {
    return {
      frameworks: v1Compliance.frameworks,
      dataClassification: v1Compliance.dataClassification,
      containsPii: v1Compliance.containsPii,
      containsPhi: v1Compliance.containsPhi,
      retentionDays: v1Compliance.retentionDays,
    };
  }

  /**
   * Migrate metrics
   */
  private migrateMetrics<T>(v1: CatoMethodEnvelope<T>): UEPMetrics {
    const primaryModel = v1.models?.[0];
    
    return {
      durationMs: v1.durationMs,
      costCents: v1.costCents,
      tokensUsed: v1.tokensUsed,
      modelId: primaryModel?.modelId,
      provider: primaryModel?.provider,
    };
  }

  /**
   * Validate that a v1.0 envelope can be migrated
   */
  validateV1Envelope<T>(v1: CatoMethodEnvelope<T>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Required fields
    if (!v1.envelopeId) errors.push('Missing envelopeId');
    if (!v1.source?.methodId) errors.push('Missing source.methodId');
    if (!v1.source?.methodType) errors.push('Missing source.methodType');
    if (!v1.output?.data) errors.push('Missing output.data');
    if (!v1.tracing?.traceId) errors.push('Missing tracing.traceId');
    if (!v1.tracing?.spanId) errors.push('Missing tracing.spanId');
    
    // Type validation
    if (v1.source?.methodType && !METHOD_TYPE_MAP[v1.source.methodType]) {
      errors.push(`Unknown methodType: ${v1.source.methodType}`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if an envelope is v1.0 or v2.0
   */
  detectVersion(envelope: unknown): '1.0' | '2.0' | 'unknown' {
    if (!envelope || typeof envelope !== 'object') {
      return 'unknown';
    }
    
    const e = envelope as Record<string, unknown>;
    
    // v2.0 indicators
    if (e.specversion === '2.0') return '2.0';
    if ('payload' in e && 'source' in e && typeof (e.source as Record<string, unknown>)?.sourceType === 'string') {
      return '2.0';
    }
    
    // v1.0 indicators
    if ('envelopeVersion' in e) return '1.0';
    if ('output' in e && 'source' in e && typeof (e.source as Record<string, unknown>)?.methodType === 'string') {
      return '1.0';
    }
    
    return 'unknown';
  }

  /**
   * Auto-migrate envelope if needed
   */
  ensureV2<T>(envelope: CatoMethodEnvelope<T> | UEPEnvelope<T>): UEPEnvelope<T> {
    const version = this.detectVersion(envelope);
    
    if (version === '2.0') {
      return envelope as UEPEnvelope<T>;
    }
    
    if (version === '1.0') {
      return this.migrateToV2(envelope as CatoMethodEnvelope<T>);
    }
    
    throw new Error('Cannot determine envelope version for migration');
  }

  /**
   * Convert v2.0 envelope back to v1.0 format (for backward compatibility)
   */
  downgradeToV1<T>(v2Envelope: UEPEnvelope<T>): CatoMethodEnvelope<T> {
    const extensions = v2Envelope.extensions || {};
    
    return {
      envelopeId: v2Envelope.envelopeId,
      pipelineId: (extensions.legacyPipelineId as string) || 
        v2Envelope.source.executionContext?.pipelineId || 
        '',
      tenantId: (extensions.legacyTenantId as string) || 
        v2Envelope.source.executionContext?.tenantId || 
        '',
      sequence: (extensions.legacySequence as number) || 0,
      envelopeVersion: (extensions.legacyEnvelopeVersion as string) || '5.0',
      
      source: {
        methodId: v2Envelope.source.sourceId,
        methodType: this.inferMethodType(v2Envelope.source),
        methodName: v2Envelope.source.name,
      },
      
      destination: v2Envelope.destination ? {
        methodId: v2Envelope.destination.destinationId,
        routingReason: v2Envelope.destination.routingReason || '',
      } : undefined,
      
      output: {
        outputType: (extensions.legacyOutputType as string) || 'UNKNOWN',
        schemaRef: v2Envelope.payload.schema?.schemaRef || '',
        data: v2Envelope.payload.data as T,
        hash: v2Envelope.payload.hash?.value || '',
        summary: (extensions.legacyOutputSummary as string) || '',
      },
      
      confidence: v2Envelope.confidence ? {
        score: v2Envelope.confidence.score,
        factors: v2Envelope.confidence.factors,
      } : { score: 0, factors: [] },
      
      contextStrategy: (extensions.legacyContextStrategy as string) || 'FULL',
      context: { history: [], originalCount: 0, prunedCount: 0, totalTokensEstimate: 0 },
      
      riskSignals: v2Envelope.riskSignals?.map(s => ({
        signalId: s.signalId,
        signalType: s.signalType,
        severity: s.severity,
        description: s.description,
        source: s.source,
        mitigationSuggestion: s.mitigationSuggestion,
      })) || [],
      
      tracing: {
        traceId: v2Envelope.tracing.traceId,
        spanId: v2Envelope.tracing.spanId,
        parentSpanId: v2Envelope.tracing.parentSpanId,
      },
      
      compliance: v2Envelope.compliance ? {
        frameworks: v2Envelope.compliance.frameworks,
        dataClassification: v2Envelope.compliance.dataClassification,
        containsPii: v2Envelope.compliance.containsPii,
        containsPhi: v2Envelope.compliance.containsPhi,
        retentionDays: v2Envelope.compliance.retentionDays,
      } : {
        frameworks: [],
        dataClassification: 'INTERNAL',
        containsPii: false,
        containsPhi: false,
      },
      
      models: v2Envelope.source.aiModel ? [{
        modelId: v2Envelope.source.aiModel.modelId,
        provider: v2Envelope.source.aiModel.provider,
        temperature: v2Envelope.source.aiModel.temperature,
        mode: v2Envelope.source.aiModel.mode,
        tokensUsed: v2Envelope.metrics?.tokensUsed || 0,
        costCents: v2Envelope.metrics?.costCents || 0,
        durationMs: v2Envelope.metrics?.durationMs || 0,
      }] : [],
      
      durationMs: v2Envelope.metrics?.durationMs || 0,
      costCents: v2Envelope.metrics?.costCents || 0,
      tokensUsed: v2Envelope.metrics?.tokensUsed || 0,
      timestamp: new Date(v2Envelope.timestamp),
    };
  }

  /**
   * Infer v1.0 method type from v2.0 source
   */
  private inferMethodType(source: UEPSourceCard): CatoMethodType {
    // Try to infer from sourceId
    const id = source.sourceId.toLowerCase();
    if (id.includes('observer')) return 'OBSERVER' as CatoMethodType;
    if (id.includes('proposer')) return 'PROPOSER' as CatoMethodType;
    if (id.includes('decider')) return 'DECIDER' as CatoMethodType;
    if (id.includes('validator')) return 'VALIDATOR' as CatoMethodType;
    if (id.includes('executor')) return 'EXECUTOR' as CatoMethodType;
    if (id.includes('red_team') || id.includes('red-team')) return 'RED_TEAM' as CatoMethodType;
    if (id.includes('critic')) return 'CRITIC' as CatoMethodType;
    
    // Default to generic
    return 'OBSERVER' as CatoMethodType;
  }
}

// Singleton instance
export const uepMigrationService = new UEPMigrationService();

export default UEPMigrationService;
