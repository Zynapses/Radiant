/**
 * Cato Method Executor Service
 * 
 * Base service for executing methods in the pipeline.
 * Handles model invocation, prompt rendering, and envelope creation.
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import {
  CatoMethodDefinition,
  CatoMethodEnvelope,
  CatoMethodOutput,
  CatoOutputType,
  CatoContextStrategy,
  CatoAccumulatedContext,
  CatoConfidenceFactor,
  CatoRiskSignal,
  CatoModelUsage,
  CatoComplianceContext,
  CatoMethodType,
  CreateEnvelopeInput,
} from '@radiant/shared';
import { CatoMethodRegistryService } from './cato-method-registry.service';
import { CatoSchemaRegistryService } from './cato-schema-registry.service';
import { ModelRouterService, modelRouterService, ModelRequest, ModelResponse } from './model-router.service.js';

export interface MethodExecutionContext {
  pipelineId: string;
  tenantId: string;
  userId?: string;
  traceId: string;
  parentSpanId?: string;
  sequence: number;
  previousEnvelopes: CatoMethodEnvelope[];
  originalRequest: Record<string, unknown>;
  governancePreset: 'COWBOY' | 'BALANCED' | 'PARANOID';
  complianceFrameworks: string[];
}

export interface MethodExecutionResult<T = unknown> {
  envelope: CatoMethodEnvelope<T>;
  invocationId: string;
  durationMs: number;
  tokensUsed: number;
  costCents: number;
}

export interface ModelInvocationResult {
  response: string;
  parsedOutput: unknown;
  tokensInput: number;
  tokensOutput: number;
  costCents: number;
  latencyMs: number;
  modelId: string;
  provider: string;
}

export abstract class CatoBaseMethodExecutor<TInput = unknown, TOutput = unknown> {
  protected pool: Pool;
  protected methodRegistry: CatoMethodRegistryService;
  protected schemaRegistry: CatoSchemaRegistryService;
  protected modelRouter: ModelRouterService;
  protected methodDefinition: CatoMethodDefinition | null = null;

  constructor(
    pool: Pool,
    methodRegistry: CatoMethodRegistryService,
    schemaRegistry: CatoSchemaRegistryService,
    modelRouter?: ModelRouterService
  ) {
    this.pool = pool;
    this.methodRegistry = methodRegistry;
    this.schemaRegistry = schemaRegistry;
    this.modelRouter = modelRouter || modelRouterService;
  }

  abstract getMethodId(): string;

  async initialize(): Promise<void> {
    this.methodDefinition = await this.methodRegistry.getMethod(this.getMethodId());
    if (!this.methodDefinition) {
      throw new Error(`Method not found: ${this.getMethodId()}`);
    }
  }

  async execute(
    input: TInput,
    context: MethodExecutionContext
  ): Promise<MethodExecutionResult<TOutput>> {
    if (!this.methodDefinition) {
      await this.initialize();
    }

    const startTime = Date.now();
    const spanId = this.generateSpanId();
    const invocationId = uuidv4();

    // Record invocation start
    await this.recordInvocationStart(invocationId, context, spanId);

    try {
      // Apply context strategy
      const prunedContext = await this.applyContextStrategy(
        context.previousEnvelopes,
        this.methodDefinition!.contextStrategy.strategy
      );

      // Build prompt variables
      const promptVariables = await this.buildPromptVariables(input, context, prunedContext);

      // Render prompts
      const { systemPrompt, userPrompt } = await this.methodRegistry.renderPrompt(
        this.getMethodId(),
        promptVariables
      );

      // Invoke model
      const modelResult = await this.invokeModel(systemPrompt, userPrompt || '', context);

      // Process output
      const processedOutput = await this.processModelOutput(modelResult.parsedOutput, context);

      // Calculate confidence
      const confidence = await this.calculateConfidence(processedOutput, modelResult, context);

      // Detect risk signals
      const riskSignals = await this.detectRiskSignals(processedOutput, context);

      // Create envelope
      const envelope = await this.createEnvelope(
        processedOutput,
        confidence,
        riskSignals,
        prunedContext,
        context,
        spanId,
        modelResult
      );

      // Record invocation completion
      const durationMs = Date.now() - startTime;
      await this.recordInvocationComplete(
        invocationId,
        envelope,
        modelResult,
        durationMs
      );

      // Record audit prompt
      await this.recordAuditPrompt(
        context,
        invocationId,
        systemPrompt,
        userPrompt || '',
        promptVariables,
        modelResult
      );

      return {
        envelope,
        invocationId,
        durationMs,
        tokensUsed: modelResult.tokensInput + modelResult.tokensOutput,
        costCents: modelResult.costCents,
      };
    } catch (error) {
      await this.recordInvocationError(invocationId, error);
      throw error;
    }
  }

  protected abstract buildPromptVariables(
    input: TInput,
    context: MethodExecutionContext,
    prunedContext: CatoAccumulatedContext
  ): Promise<Record<string, unknown>>;

  protected abstract processModelOutput(
    rawOutput: unknown,
    context: MethodExecutionContext
  ): Promise<TOutput>;

  protected abstract getOutputType(): CatoOutputType;

  protected abstract generateOutputSummary(output: TOutput): string;

  protected async calculateConfidence(
    output: TOutput,
    modelResult: ModelInvocationResult,
    context: MethodExecutionContext
  ): Promise<{ score: number; factors: CatoConfidenceFactor[] }> {
    // Default confidence calculation - can be overridden
    const factors: CatoConfidenceFactor[] = [
      {
        factor: 'model_confidence',
        score: 0.8,
        weight: 0.5,
        reasoning: 'Based on model output quality',
      },
      {
        factor: 'context_completeness',
        score: context.previousEnvelopes.length > 0 ? 0.9 : 0.7,
        weight: 0.3,
        reasoning: 'Based on available context',
      },
      {
        factor: 'input_clarity',
        score: 0.85,
        weight: 0.2,
        reasoning: 'Based on input specification',
      },
    ];

    const score = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
    return { score, factors };
  }

  protected async detectRiskSignals(
    output: TOutput,
    context: MethodExecutionContext
  ): Promise<CatoRiskSignal[]> {
    // Default - no risk signals. Override in subclasses for specific detection
    return [];
  }

  protected async applyContextStrategy(
    envelopes: CatoMethodEnvelope[],
    strategy: CatoContextStrategy,
    executionContext?: MethodExecutionContext
  ): Promise<CatoAccumulatedContext> {
    const originalCount = envelopes.length;
    let prunedEnvelopes: CatoMethodEnvelope[] = [];

    switch (strategy) {
      case CatoContextStrategy.FULL:
        prunedEnvelopes = envelopes;
        break;

      case CatoContextStrategy.MINIMAL:
        prunedEnvelopes = [];
        break;

      case CatoContextStrategy.TAIL:
        const tailCount = this.methodDefinition?.contextStrategy.tailCount || 5;
        prunedEnvelopes = envelopes.slice(-tailCount);
        break;

      case CatoContextStrategy.RELEVANT:
        const acceptedTypes = this.methodDefinition?.acceptsOutputTypes || [];
        prunedEnvelopes = envelopes.filter(e => 
          acceptedTypes.includes(e.output.outputType)
        );
        break;

      case CatoContextStrategy.SUMMARY:
        // Use LLM to create intelligent summary of context
        prunedEnvelopes = await this.summarizeEnvelopes(envelopes, executionContext);
        break;

      default:
        prunedEnvelopes = envelopes;
    }

    // Estimate tokens (rough approximation)
    const totalTokensEstimate = prunedEnvelopes.reduce((sum, e) => {
      const jsonStr = JSON.stringify(e.output.data);
      return sum + Math.ceil(jsonStr.length / 4);
    }, 0);

    return {
      history: prunedEnvelopes,
      pruningApplied: strategy,
      originalCount,
      prunedCount: prunedEnvelopes.length,
      totalTokensEstimate,
    };
  }

  protected async invokeModel(
    systemPrompt: string,
    userPrompt: string,
    context: MethodExecutionContext
  ): Promise<ModelInvocationResult> {
    const startTime = Date.now();
    
    // Select appropriate model based on method requirements
    const modelId = this.selectModelForMethod(context);
    
    // Build the request for the model router
    const request: ModelRequest = {
      modelId,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      systemPrompt,
      maxTokens: 4096,
      temperature: 0.7,
      tenantId: context.tenantId,
    };

    // Invoke model through the router (handles fallbacks, rate limiting, etc.)
    const response: ModelResponse = await this.modelRouter.invoke(request);

    // Parse output from response
    let parsedOutput: unknown;
    try {
      parsedOutput = JSON.parse(response.content);
    } catch {
      // If not JSON, use raw content
      parsedOutput = { content: response.content };
    }

    return {
      response: response.content,
      parsedOutput,
      tokensInput: response.inputTokens,
      tokensOutput: response.outputTokens,
      costCents: response.costCents,
      latencyMs: response.latencyMs,
      modelId: response.modelUsed,
      provider: response.provider,
    };
  }

  /**
   * Select the appropriate model for this method based on requirements
   * Subclasses can override for specific model preferences
   */
  protected selectModelForMethod(context: MethodExecutionContext): string {
    // Default to Claude 3.5 Sonnet for most methods - good balance of capability/cost
    // Subclasses can override for specific requirements (e.g., GPT-4o for vision)
    return 'anthropic/claude-3-5-sonnet-20241022';
  }

  protected async createEnvelope(
    output: TOutput,
    confidence: { score: number; factors: CatoConfidenceFactor[] },
    riskSignals: CatoRiskSignal[],
    prunedContext: CatoAccumulatedContext,
    context: MethodExecutionContext,
    spanId: string,
    modelResult: ModelInvocationResult
  ): Promise<CatoMethodEnvelope<TOutput>> {
    const envelopeId = uuidv4();
    const outputHash = this.hashOutput(output);

    const envelope: CatoMethodEnvelope<TOutput> = {
      envelopeId,
      pipelineId: context.pipelineId,
      tenantId: context.tenantId,
      sequence: context.sequence,
      envelopeVersion: '5.0',
      source: {
        methodId: this.getMethodId(),
        methodType: this.methodDefinition!.methodType,
        methodName: this.methodDefinition!.name,
      },
      output: {
        outputType: this.getOutputType(),
        schemaRef: this.methodDefinition!.outputSchemaRef || '',
        data: output,
        hash: outputHash,
        summary: this.generateOutputSummary(output),
      },
      confidence,
      contextStrategy: prunedContext.pruningApplied,
      context: prunedContext,
      riskSignals,
      tracing: {
        traceId: context.traceId,
        spanId,
        parentSpanId: context.parentSpanId,
      },
      compliance: {
        frameworks: context.complianceFrameworks,
        dataClassification: 'INTERNAL',
        containsPii: false,
        containsPhi: false,
      },
      models: [{
        modelId: modelResult.modelId,
        provider: modelResult.provider,
        tokensInput: modelResult.tokensInput,
        tokensOutput: modelResult.tokensOutput,
        costCents: modelResult.costCents,
        latencyMs: modelResult.latencyMs,
      }],
      durationMs: modelResult.latencyMs,
      costCents: modelResult.costCents,
      tokensUsed: modelResult.tokensInput + modelResult.tokensOutput,
      timestamp: new Date(),
    };

    // Persist envelope to database
    await this.persistEnvelope(envelope);

    return envelope;
  }

  protected async persistEnvelope(envelope: CatoMethodEnvelope<TOutput>): Promise<void> {
    await this.pool.query(
      `INSERT INTO cato_pipeline_envelopes (
        envelope_id, pipeline_id, tenant_id, sequence, envelope_version,
        source_method_id, source_method_type, source_method_name,
        destination_method_id, routing_reason,
        output_type, output_schema_ref, output_data, output_data_hash, output_summary,
        confidence_score, confidence_factors,
        context_strategy, context,
        risk_signals,
        trace_id, span_id, parent_span_id,
        compliance_frameworks, data_classification, contains_pii, contains_phi,
        models_used, duration_ms, cost_cents, tokens_used,
        timestamp
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27,
        $28, $29, $30, $31, $32
      )`,
      [
        envelope.envelopeId,
        envelope.pipelineId,
        envelope.tenantId,
        envelope.sequence,
        envelope.envelopeVersion,
        envelope.source.methodId,
        envelope.source.methodType,
        envelope.source.methodName,
        envelope.destination?.methodId || null,
        envelope.destination?.routingReason || null,
        envelope.output.outputType,
        envelope.output.schemaRef,
        JSON.stringify(envelope.output.data),
        envelope.output.hash,
        envelope.output.summary,
        envelope.confidence.score,
        JSON.stringify(envelope.confidence.factors),
        envelope.contextStrategy,
        JSON.stringify(envelope.context),
        JSON.stringify(envelope.riskSignals),
        envelope.tracing.traceId,
        envelope.tracing.spanId,
        envelope.tracing.parentSpanId || null,
        envelope.compliance.frameworks,
        envelope.compliance.dataClassification,
        envelope.compliance.containsPii,
        envelope.compliance.containsPhi,
        JSON.stringify(envelope.models),
        envelope.durationMs,
        envelope.costCents,
        envelope.tokensUsed,
        envelope.timestamp,
      ]
    );
  }

  protected async recordInvocationStart(
    invocationId: string,
    context: MethodExecutionContext,
    spanId: string
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO cato_method_invocations (
        id, pipeline_id, tenant_id, method_id, method_name, method_type,
        sequence, status, trace_id, span_id, started_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [
        invocationId,
        context.pipelineId,
        context.tenantId,
        this.getMethodId(),
        this.methodDefinition!.name,
        this.methodDefinition!.methodType,
        context.sequence,
        'RUNNING',
        context.traceId,
        spanId,
      ]
    );
  }

  protected async recordInvocationComplete(
    invocationId: string,
    envelope: CatoMethodEnvelope<TOutput>,
    modelResult: ModelInvocationResult,
    durationMs: number
  ): Promise<void> {
    await this.pool.query(
      `UPDATE cato_method_invocations SET
        envelope_id = $1,
        output_envelope_ref = $1,
        models_used = $2,
        status = 'COMPLETED',
        duration_ms = $3,
        cost_cents = $4,
        tokens_input = $5,
        tokens_output = $6,
        completed_at = NOW()
      WHERE id = $7`,
      [
        envelope.envelopeId,
        JSON.stringify([{
          modelId: modelResult.modelId,
          provider: modelResult.provider,
          tokensInput: modelResult.tokensInput,
          tokensOutput: modelResult.tokensOutput,
          costCents: modelResult.costCents,
          latencyMs: modelResult.latencyMs,
        }]),
        durationMs,
        modelResult.costCents,
        modelResult.tokensInput,
        modelResult.tokensOutput,
        invocationId,
      ]
    );
  }

  protected async recordInvocationError(
    invocationId: string,
    error: unknown
  ): Promise<void> {
    const errorObj = {
      code: 'METHOD_EXECUTION_ERROR',
      message: error instanceof Error ? error.message : String(error),
      recoverable: false,
    };

    await this.pool.query(
      `UPDATE cato_method_invocations SET
        status = 'FAILED',
        error = $1,
        completed_at = NOW()
      WHERE id = $2`,
      [JSON.stringify(errorObj), invocationId]
    );
  }

  protected async recordAuditPrompt(
    context: MethodExecutionContext,
    invocationId: string,
    systemPrompt: string,
    userPrompt: string,
    promptVariables: Record<string, unknown>,
    modelResult: ModelInvocationResult
  ): Promise<void> {
    const contentHash = crypto
      .createHash('sha256')
      .update(systemPrompt + userPrompt + modelResult.response)
      .digest('hex');

    await this.pool.query(
      `INSERT INTO cato_audit_prompt_records (
        pipeline_id, tenant_id, invocation_id, prompt_sequence,
        prompt_type, model_id, model_provider,
        system_prompt, user_prompt, prompt_variables,
        model_response, response_metadata,
        compliance_frameworks, contains_pii, contains_phi, pii_redacted,
        tokens_input, tokens_output, cost_cents, latency_ms,
        prompt_sent_at, response_received_at, content_hash
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        NOW() - INTERVAL '1 millisecond' * $20, NOW(), $21
      )`,
      [
        context.pipelineId,
        context.tenantId,
        invocationId,
        1,
        'method_execution',
        modelResult.modelId,
        modelResult.provider,
        systemPrompt,
        userPrompt,
        JSON.stringify(promptVariables),
        modelResult.response,
        JSON.stringify({ parsedOutput: modelResult.parsedOutput }),
        context.complianceFrameworks,
        false,
        false,
        false,
        modelResult.tokensInput,
        modelResult.tokensOutput,
        modelResult.costCents,
        modelResult.latencyMs,
        contentHash,
      ]
    );
  }

  protected hashOutput(output: TOutput): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(output))
      .digest('hex');
  }

  protected generateSpanId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Summarize envelopes using LLM for intelligent context pruning
   * Returns key envelopes with middle ones summarized into their output data
   */
  protected async summarizeEnvelopes(
    envelopes: CatoMethodEnvelope[],
    context?: MethodExecutionContext
  ): Promise<CatoMethodEnvelope[]> {
    if (envelopes.length <= 3) {
      return envelopes;
    }

    try {
      // Build summary request for the middle envelopes
      const middleEnvelopes = envelopes.slice(1, -1);
      const summaryContent = middleEnvelopes.map((e, i) => 
        `[${i + 1}] Output: ${JSON.stringify(e.output.data).substring(0, 500)}`
      ).join('\n\n');

      const summaryRequest: ModelRequest = {
        modelId: 'groq/llama-3.1-8b-instant', // Fast model for summarization
        messages: [{
          role: 'user',
          content: `Summarize the following method execution outputs into a concise context summary. 
Focus on key decisions, outputs, and any important state changes.

${summaryContent}

Provide a JSON response with format: { "summary": "...", "keyPoints": ["...", "..."] }`
        }],
        systemPrompt: 'You are a context summarization assistant. Provide concise, accurate summaries.',
        maxTokens: 1000,
        temperature: 0.3,
        tenantId: context?.tenantId || 'system',
      };

      const response = await this.modelRouter.invoke(summaryRequest);
      
      // Parse summary
      let summaryData: { summary: string; keyPoints: string[] };
      try {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        summaryData = jsonMatch ? JSON.parse(jsonMatch[0]) : { 
          summary: response.content, 
          keyPoints: [] 
        };
      } catch {
        summaryData = { summary: response.content, keyPoints: [] };
      }

      // Modify the first envelope to include summary in its output
      const firstEnvelope = { ...envelopes[0] };
      const outputData = firstEnvelope.output.data as Record<string, unknown>;
      outputData._contextSummary = summaryData;
      outputData._summarizedEnvelopeCount = middleEnvelopes.length;

      // Return first (with summary) and last envelope
      return [firstEnvelope, envelopes[envelopes.length - 1]];
    } catch {
      // Fallback: just take first and last if summarization fails
      return [envelopes[0], envelopes[envelopes.length - 1]];
    }
  }
}

// Types already exported at definition above
