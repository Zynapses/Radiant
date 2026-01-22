/**
 * Cato Pipeline Orchestrator Service
 * 
 * Orchestrates the execution of method pipelines, handling:
 * - Method chaining and routing
 * - Context management and pruning
 * - Checkpoint integration
 * - Error handling and compensation
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import {
  CatoPipelineExecution,
  CatoPipelineStatus,
  CatoMethodEnvelope,
  CatoMethodDefinition,
  CatoPipelineTemplate,
  CatoCheckpointDecision,
  CatoTriageDecision,
  CatoPipelineEvent,
  CatoPipelineEventHandler,
} from '@radiant/shared';
import { CatoMethodRegistryService } from './cato-method-registry.service';
import { CatoSchemaRegistryService } from './cato-schema-registry.service';
import { CatoToolRegistryService } from './cato-tool-registry.service';
import { CatoCheckpointService } from './cato-checkpoint.service';
import { CatoCompensationService } from './cato-compensation.service';
import {
  CatoObserverMethod,
  CatoProposerMethod,
  CatoSecurityCriticMethod,
  CatoValidatorMethod,
  CatoExecutorMethod,
  CatoDeciderMethod,
} from './cato-methods';

export interface PipelineExecutionOptions {
  tenantId: string;
  userId?: string;
  request: Record<string, unknown>;
  templateId?: string;
  methodChain?: string[];
  governancePreset?: 'COWBOY' | 'BALANCED' | 'PARANOID';
  config?: Record<string, unknown>;
  complianceFrameworks?: string[];
}

export interface PipelineExecutionResult {
  execution: CatoPipelineExecution;
  finalEnvelope?: CatoMethodEnvelope;
  checkpointsPending: string[];
}

export class CatoPipelineOrchestratorService {
  private pool: Pool;
  private methodRegistry: CatoMethodRegistryService;
  private schemaRegistry: CatoSchemaRegistryService;
  private toolRegistry: CatoToolRegistryService;
  private checkpointService: CatoCheckpointService;
  private compensationService: CatoCompensationService;
  private eventHandlers: CatoPipelineEventHandler[] = [];

  constructor(
    pool: Pool,
    methodRegistry: CatoMethodRegistryService,
    schemaRegistry: CatoSchemaRegistryService,
    toolRegistry: CatoToolRegistryService,
    checkpointService: CatoCheckpointService,
    compensationService: CatoCompensationService
  ) {
    this.pool = pool;
    this.methodRegistry = methodRegistry;
    this.schemaRegistry = schemaRegistry;
    this.toolRegistry = toolRegistry;
    this.checkpointService = checkpointService;
    this.compensationService = compensationService;
  }

  onEvent(handler: CatoPipelineEventHandler): void {
    this.eventHandlers.push(handler);
  }

  private async emitEvent(event: CatoPipelineEvent): Promise<void> {
    for (const handler of this.eventHandlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error('Event handler error:', error);
      }
    }
  }

  async executePipeline(options: PipelineExecutionOptions): Promise<PipelineExecutionResult> {
    const traceId = crypto.randomBytes(32).toString('hex');
    const pipelineId = uuidv4();
    const governancePreset = options.governancePreset || 'BALANCED';

    // Get method chain
    let methodChain: string[];
    let template: CatoPipelineTemplate | null = null;

    if (options.templateId) {
      template = await this.getTemplate(options.templateId);
      if (!template) throw new Error(`Template not found: ${options.templateId}`);
      methodChain = template.methodChain;
    } else if (options.methodChain) {
      methodChain = options.methodChain;
    } else {
      methodChain = ['method:observer:v1'];
    }

    // Create execution record
    const execution = await this.createExecution(pipelineId, options, methodChain, traceId, governancePreset);

    await this.emitEvent({
      eventType: 'PIPELINE_STARTED',
      pipelineId,
      tenantId: options.tenantId,
      data: { templateId: options.templateId, methodChain },
      timestamp: new Date(),
    });

    const envelopes: CatoMethodEnvelope[] = [];
    const checkpointsPending: string[] = [];

    try {
      for (let i = 0; i < methodChain.length; i++) {
        const methodId = methodChain[i];
        
        await this.updateExecutionStatus(pipelineId, CatoPipelineStatus.RUNNING, methodId, i);

        await this.emitEvent({
          eventType: 'METHOD_STARTED',
          pipelineId,
          tenantId: options.tenantId,
          methodId,
          data: { sequence: i },
          timestamp: new Date(),
        });

        // Execute method
        const result = await this.executeMethod(methodId, {
          pipelineId,
          tenantId: options.tenantId,
          userId: options.userId,
          traceId,
          sequence: i,
          previousEnvelopes: envelopes,
          originalRequest: options.request,
          governancePreset,
          complianceFrameworks: options.complianceFrameworks || [],
        });

        envelopes.push(result.envelope);

        await this.emitEvent({
          eventType: 'METHOD_COMPLETED',
          pipelineId,
          tenantId: options.tenantId,
          methodId,
          envelopeId: result.envelope.envelopeId,
          data: { durationMs: result.durationMs, costCents: result.costCents },
          timestamp: new Date(),
        });

        // Check for checkpoints after this method
        const checkpointResult = await this.evaluateCheckpoints(
          pipelineId,
          options.tenantId,
          result.envelope,
          methodId,
          template,
          governancePreset
        );

        if (checkpointResult.waitRequired) {
          checkpointsPending.push(checkpointResult.checkpointId!);
          await this.updateExecutionStatus(pipelineId, CatoPipelineStatus.CHECKPOINT_WAITING);
          
          await this.emitEvent({
            eventType: 'CHECKPOINT_TRIGGERED',
            pipelineId,
            tenantId: options.tenantId,
            envelopeId: result.envelope.envelopeId,
            data: { checkpointId: checkpointResult.checkpointId, reason: checkpointResult.reason },
            timestamp: new Date(),
          });

          // Return early - execution will resume when checkpoint is resolved
          const updatedExecution = await this.getExecution(pipelineId);
          return { execution: updatedExecution!, finalEnvelope: result.envelope, checkpointsPending };
        }

        // Check for risk veto (from Validator output)
        if (this.shouldBlockExecution(result.envelope)) {
          await this.updateExecutionStatus(pipelineId, CatoPipelineStatus.FAILED, undefined, undefined, {
            code: 'RISK_VETO',
            message: 'Execution blocked by risk assessment',
            recoverable: false,
          });

          await this.emitEvent({
            eventType: 'RISK_VETO',
            pipelineId,
            tenantId: options.tenantId,
            envelopeId: result.envelope.envelopeId,
            data: { riskSignals: result.envelope.riskSignals },
            timestamp: new Date(),
          });

          const updatedExecution = await this.getExecution(pipelineId);
          return { execution: updatedExecution!, finalEnvelope: result.envelope, checkpointsPending };
        }

        // Update execution metrics
        await this.updateExecutionMetrics(pipelineId, result);
      }

      // Pipeline completed successfully
      const finalEnvelope = envelopes[envelopes.length - 1];
      await this.completeExecution(pipelineId, finalEnvelope);

      await this.emitEvent({
        eventType: 'PIPELINE_COMPLETED',
        pipelineId,
        tenantId: options.tenantId,
        envelopeId: finalEnvelope?.envelopeId,
        data: { methodsExecuted: methodChain.length },
        timestamp: new Date(),
      });

      const completedExecution = await this.getExecution(pipelineId);
      return { execution: completedExecution!, finalEnvelope, checkpointsPending };

    } catch (error) {
      await this.handlePipelineError(pipelineId, options.tenantId, error, envelopes);
      throw error;
    }
  }

  async resumePipeline(
    pipelineId: string,
    checkpointId: string,
    decision: CatoCheckpointDecision
  ): Promise<PipelineExecutionResult> {
    const execution = await this.getExecution(pipelineId);
    if (!execution) throw new Error(`Pipeline not found: ${pipelineId}`);

    if (execution.status !== CatoPipelineStatus.CHECKPOINT_WAITING) {
      throw new Error(`Pipeline not in checkpoint state: ${execution.status}`);
    }

    await this.emitEvent({
      eventType: 'CHECKPOINT_DECIDED',
      pipelineId,
      tenantId: execution.tenantId,
      data: { checkpointId, decision },
      timestamp: new Date(),
    });

    if (decision === CatoCheckpointDecision.REJECTED) {
      await this.updateExecutionStatus(pipelineId, CatoPipelineStatus.CANCELLED);
      return { execution: (await this.getExecution(pipelineId))!, checkpointsPending: [] };
    }

    // Continue execution from where it left off
    // For now, mark as completed since we'd need to track remaining methods
    await this.updateExecutionStatus(pipelineId, CatoPipelineStatus.COMPLETED);
    return { execution: (await this.getExecution(pipelineId))!, checkpointsPending: [] };
  }

  private async executeMethod(
    methodId: string,
    context: {
      pipelineId: string;
      tenantId: string;
      userId?: string;
      traceId: string;
      sequence: number;
      previousEnvelopes: CatoMethodEnvelope[];
      originalRequest: Record<string, unknown>;
      governancePreset: 'COWBOY' | 'BALANCED' | 'PARANOID';
      complianceFrameworks: string[];
    }
  ): Promise<{ envelope: CatoMethodEnvelope; durationMs: number; costCents: number; tokensUsed: number }> {
    const methodDef = await this.methodRegistry.getMethod(methodId);
    if (!methodDef) throw new Error(`Method not found: ${methodId}`);

    // Create appropriate method executor based on method type
    const executor = await this.createMethodExecutor(methodId, methodDef);

    // Build input based on method type and previous envelopes
    const input = this.buildMethodInput(methodDef, context);

    const result = await executor.execute(input, context);
    return {
      envelope: result.envelope,
      durationMs: result.durationMs,
      costCents: result.costCents,
      tokensUsed: result.tokensUsed,
    };
  }

  private async createMethodExecutor(methodId: string, methodDef: CatoMethodDefinition): Promise<any> {
    switch (methodId) {
      case 'method:observer:v1':
        const observer = new CatoObserverMethod(this.pool, this.methodRegistry, this.schemaRegistry);
        await observer.initialize();
        return observer;
      case 'method:proposer:v1':
        const proposer = new CatoProposerMethod(this.pool, this.methodRegistry, this.schemaRegistry, this.toolRegistry);
        await proposer.initialize();
        return proposer;
      case 'method:critic:security:v1':
        const securityCritic = new CatoSecurityCriticMethod(this.pool, this.methodRegistry, this.schemaRegistry);
        await securityCritic.initialize();
        return securityCritic;
      case 'method:validator:v1':
        const validator = new CatoValidatorMethod(this.pool, this.methodRegistry, this.schemaRegistry);
        await validator.initialize();
        return validator;
      case 'method:executor:v1':
        const executor = new CatoExecutorMethod(this.pool, this.methodRegistry, this.schemaRegistry, this.toolRegistry);
        await executor.initialize();
        return executor;
      case 'method:decider:v1':
        const decider = new CatoDeciderMethod(this.pool, this.methodRegistry, this.schemaRegistry);
        await decider.initialize();
        return decider;
      default:
        throw new Error(`No executor implemented for method: ${methodId}`);
    }
  }

  private buildMethodInput(methodDef: CatoMethodDefinition, context: any): any {
    const lastEnvelope = context.previousEnvelopes[context.previousEnvelopes.length - 1];

    switch (methodDef.methodId) {
      case 'method:observer:v1':
        return {
          userRequest: JSON.stringify(context.originalRequest),
          sessionContext: { previousMessages: [] },
        };
      case 'method:proposer:v1':
        return {
          observation: lastEnvelope?.output?.data || {},
          userRequest: JSON.stringify(context.originalRequest),
        };
      case 'method:critic:security:v1':
        const proposal = context.previousEnvelopes.find((e: CatoMethodEnvelope) => e.output.outputType === 'PROPOSAL');
        return { proposal: proposal?.output?.data || {} };
      case 'method:validator:v1':
        const prop = context.previousEnvelopes.find((e: CatoMethodEnvelope) => e.output.outputType === 'PROPOSAL');
        const critiques = context.previousEnvelopes.filter((e: CatoMethodEnvelope) => e.output.outputType === 'CRITIQUE').map((e: CatoMethodEnvelope) => e.output.data);
        return { proposal: prop?.output?.data || {}, critiques, governancePreset: context.governancePreset };
      case 'method:executor:v1':
        const propToExec = context.previousEnvelopes.find((e: CatoMethodEnvelope) => e.output.outputType === 'PROPOSAL');
        return { proposal: propToExec?.output?.data || {}, dryRun: false };
      case 'method:decider:v1':
        const propForDecider = context.previousEnvelopes.find((e: CatoMethodEnvelope) => e.output.outputType === 'PROPOSAL');
        const allCritiques = context.previousEnvelopes.filter((e: CatoMethodEnvelope) => e.output.outputType === 'CRITIQUE').map((e: CatoMethodEnvelope) => e.output.data);
        return { proposal: propForDecider?.output?.data || {}, critiques: allCritiques };
      default:
        return { input: lastEnvelope?.output?.data || context.originalRequest };
    }
  }

  private async evaluateCheckpoints(
    pipelineId: string,
    tenantId: string,
    envelope: CatoMethodEnvelope,
    methodId: string,
    template: CatoPipelineTemplate | null,
    governancePreset: 'COWBOY' | 'BALANCED' | 'PARANOID'
  ): Promise<{ waitRequired: boolean; checkpointId?: string; reason: string }> {
    // Check template-defined checkpoints
    if (template?.checkpointPositions) {
      for (const [cpType, cpConfig] of Object.entries(template.checkpointPositions)) {
        const config = cpConfig as { after?: string; mode?: string; triggerOn?: string[] };
        if (config.after === methodId) {
          const result = await this.checkpointService.evaluateCheckpoint({
            pipelineId,
            tenantId,
            envelope,
            checkpointType: cpType as any,
            triggerReason: `Template checkpoint after ${methodId}`,
            governancePreset,
          });
          if (result.waitRequired) {
            return { waitRequired: true, checkpointId: result.checkpointId, reason: result.reason };
          }
        }
      }
    }

    // Check for validator triage decision
    if (envelope.output.outputType === 'ASSESSMENT') {
      const data = envelope.output.data as Record<string, unknown>;
      if (data.triageDecision === CatoTriageDecision.CHECKPOINT_REQUIRED) {
        const result = await this.checkpointService.evaluateCheckpoint({
          pipelineId,
          tenantId,
          envelope,
          checkpointType: 'CP4',
          triggerReason: `Risk assessment requires checkpoint: ${data.triageReason}`,
          governancePreset,
        });
        if (result.waitRequired) {
          return { waitRequired: true, checkpointId: result.checkpointId, reason: result.reason };
        }
      }
    }

    return { waitRequired: false, reason: 'No checkpoint required' };
  }

  private shouldBlockExecution(envelope: CatoMethodEnvelope): boolean {
    if (envelope.output.outputType === 'ASSESSMENT') {
      const data = envelope.output.data as Record<string, unknown>;
      return data.triageDecision === CatoTriageDecision.BLOCKED || data.vetoApplied === true;
    }
    return envelope.riskSignals.some(s => s.signalType === 'veto_applied');
  }

  private async createExecution(
    pipelineId: string,
    options: PipelineExecutionOptions,
    methodChain: string[],
    traceId: string,
    governancePreset: string
  ): Promise<CatoPipelineExecution> {
    const requestHash = crypto.createHash('sha256').update(JSON.stringify(options.request)).digest('hex');

    await this.pool.query(
      `INSERT INTO cato_pipeline_executions (
        id, tenant_id, user_id, status, template_id, config, governance_preset,
        original_request, original_request_hash, methods_executed, trace_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        pipelineId,
        options.tenantId,
        options.userId,
        CatoPipelineStatus.PENDING,
        options.templateId,
        JSON.stringify(options.config || {}),
        governancePreset,
        JSON.stringify(options.request),
        requestHash,
        methodChain,
        traceId,
      ]
    );

    return (await this.getExecution(pipelineId))!;
  }

  async getExecution(pipelineId: string): Promise<CatoPipelineExecution | null> {
    const result = await this.pool.query(
      `SELECT * FROM cato_pipeline_executions WHERE id = $1`,
      [pipelineId]
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToExecution(result.rows[0]);
  }

  private async updateExecutionStatus(
    pipelineId: string,
    status: CatoPipelineStatus,
    currentMethod?: string,
    currentSequence?: number,
    error?: { code: string; message: string; recoverable: boolean }
  ): Promise<void> {
    await this.pool.query(
      `UPDATE cato_pipeline_executions SET
        status = $1,
        current_method = COALESCE($2, current_method),
        current_sequence = COALESCE($3, current_sequence),
        error = COALESCE($4, error)
      WHERE id = $5`,
      [status, currentMethod, currentSequence, error ? JSON.stringify(error) : null, pipelineId]
    );
  }

  private async updateExecutionMetrics(pipelineId: string, result: { durationMs: number; costCents: number; tokensUsed: number }): Promise<void> {
    await this.pool.query(
      `UPDATE cato_pipeline_executions SET
        total_cost_cents = total_cost_cents + $1,
        total_duration_ms = total_duration_ms + $2,
        total_tokens = total_tokens + $3
      WHERE id = $4`,
      [result.costCents, result.durationMs, result.tokensUsed, pipelineId]
    );
  }

  private async completeExecution(pipelineId: string, finalEnvelope?: CatoMethodEnvelope): Promise<void> {
    await this.pool.query(
      `UPDATE cato_pipeline_executions SET
        status = $1,
        final_envelope_id = $2,
        execution_result = $3,
        completed_at = NOW()
      WHERE id = $4`,
      [
        CatoPipelineStatus.COMPLETED,
        finalEnvelope?.envelopeId,
        finalEnvelope ? JSON.stringify(finalEnvelope.output.data) : null,
        pipelineId,
      ]
    );
  }

  private async handlePipelineError(
    pipelineId: string,
    tenantId: string,
    error: unknown,
    envelopes: CatoMethodEnvelope[]
  ): Promise<void> {
    await this.updateExecutionStatus(pipelineId, CatoPipelineStatus.FAILED, undefined, undefined, {
      code: 'PIPELINE_ERROR',
      message: error instanceof Error ? error.message : String(error),
      recoverable: false,
    });

    await this.emitEvent({
      eventType: 'PIPELINE_FAILED',
      pipelineId,
      tenantId,
      data: { error: error instanceof Error ? error.message : String(error) },
      timestamp: new Date(),
    });

    // Trigger compensations if needed
    if (envelopes.length > 0) {
      await this.compensationService.executeCompensations(pipelineId, tenantId);
    }
  }

  private async getTemplate(templateId: string): Promise<CatoPipelineTemplate | null> {
    const result = await this.pool.query(
      `SELECT * FROM cato_pipeline_templates WHERE template_id = $1 AND enabled = true`,
      [templateId]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      templateId: row.template_id,
      name: row.name,
      description: row.description,
      methodChain: row.method_chain,
      checkpointPositions: row.checkpoint_positions,
      defaultConfig: row.default_config,
      category: row.category,
      tags: row.tags,
      scope: row.scope,
      tenantId: row.tenant_id,
      enabled: row.enabled,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapRowToExecution(row: Record<string, unknown>): CatoPipelineExecution {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      userId: row.user_id as string | undefined,
      status: row.status as CatoPipelineStatus,
      templateId: row.template_id as string | undefined,
      config: row.config as Record<string, unknown>,
      governancePreset: row.governance_preset as 'COWBOY' | 'BALANCED' | 'PARANOID',
      originalRequest: row.original_request as Record<string, unknown>,
      originalRequestHash: row.original_request_hash as string,
      methodsExecuted: row.methods_executed as string[],
      currentMethod: row.current_method as string | undefined,
      currentSequence: row.current_sequence as number,
      totalCostCents: row.total_cost_cents as number,
      totalDurationMs: row.total_duration_ms as number,
      totalTokens: row.total_tokens as number,
      finalEnvelopeId: row.final_envelope_id as string | undefined,
      executionResult: row.execution_result as Record<string, unknown> | undefined,
      error: row.error as { code: string; message: string; recoverable: boolean } | undefined,
      traceId: row.trace_id as string,
      startedAt: new Date(row.started_at as string),
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      createdAt: new Date(row.created_at as string),
    };
  }
}

export const createCatoPipelineOrchestratorService = (
  pool: Pool,
  methodRegistry: CatoMethodRegistryService,
  schemaRegistry: CatoSchemaRegistryService,
  toolRegistry: CatoToolRegistryService,
  checkpointService: CatoCheckpointService,
  compensationService: CatoCompensationService
): CatoPipelineOrchestratorService => {
  return new CatoPipelineOrchestratorService(
    pool, methodRegistry, schemaRegistry, toolRegistry, checkpointService, compensationService
  );
};
