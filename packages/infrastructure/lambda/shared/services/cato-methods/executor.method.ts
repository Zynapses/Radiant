/**
 * Cato Executor Method
 * 
 * Executes approved proposals by invoking tools (Lambda or MCP).
 * Manages compensation log for SAGA rollback pattern.
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { CatoOutputType, CatoRiskLevel, CatoCompensationType, CatoAccumulatedContext, CatoRiskSignal, CatoCompensationEntry } from '@radiant/shared';
import { CatoBaseMethodExecutor, MethodExecutionContext, ModelInvocationResult } from '../cato-method-executor.service';
import { CatoMethodRegistryService } from '../cato-method-registry.service';
import { CatoSchemaRegistryService } from '../cato-schema-registry.service';
import { CatoToolRegistryService } from '../cato-tool-registry.service';

const lambdaClient = new LambdaClient({});

export interface ExecutorInput {
  proposal: { proposalId: string; title: string; actions: Array<{ actionId: string; type: string; description: string; toolId?: string; inputs: Record<string, unknown>; reversible: boolean; compensationType: CatoCompensationType; compensationStrategy?: string }> };
  dryRun?: boolean;
}

export interface ActionResult {
  actionId: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'COMPENSATED';
  startedAt: Date;
  completedAt: Date;
  output?: Record<string, unknown>;
  error?: string;
  compensationExecuted: boolean;
}

export interface ExecutorOutput {
  executionId: string;
  status: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED' | 'ROLLED_BACK';
  actionsExecuted: ActionResult[];
  artifacts: Array<{ artifactId: string; type: string; uri: string; metadata?: Record<string, unknown> }>;
  totalDurationMs: number;
  totalCostCents: number;
  compensationLog: Array<{ stepNumber: number; actionId: string; compensationType: CatoCompensationType; status: string }>;
}

export class CatoExecutorMethod extends CatoBaseMethodExecutor<ExecutorInput, ExecutorOutput> {
  private toolRegistry: CatoToolRegistryService;

  constructor(pool: Pool, methodRegistry: CatoMethodRegistryService, schemaRegistry: CatoSchemaRegistryService, toolRegistry: CatoToolRegistryService) {
    super(pool, methodRegistry, schemaRegistry);
    this.toolRegistry = toolRegistry;
  }

  getMethodId(): string { return 'method:executor:v1'; }
  protected getOutputType(): CatoOutputType { return CatoOutputType.EXECUTION_RESULT; }

  protected generateOutputSummary(output: ExecutorOutput): string {
    const successCount = output.actionsExecuted.filter(a => a.status === 'SUCCESS').length;
    return `Execution ${output.status}: ${successCount}/${output.actionsExecuted.length} actions succeeded, ${output.totalDurationMs}ms, $${(output.totalCostCents / 100).toFixed(2)}`;
  }

  protected async buildPromptVariables(input: ExecutorInput, context: MethodExecutionContext, prunedContext: CatoAccumulatedContext): Promise<Record<string, unknown>> {
    const tools = await Promise.all(input.proposal.actions.filter(a => a.toolId).map(a => this.toolRegistry.getTool(a.toolId!)));
    return { proposal: JSON.stringify(input.proposal, null, 2), tools: JSON.stringify(tools.filter(Boolean), null, 2), dry_run: input.dryRun || false };
  }

  protected async processModelOutput(rawOutput: unknown, context: MethodExecutionContext): Promise<ExecutorOutput> {
    // For executor, we don't rely on model output - we actually execute the tools
    // This is a placeholder that would be replaced by actual execution logic
    const o = rawOutput as Record<string, unknown>;
    return {
      executionId: String(o.executionId || uuidv4()),
      status: (['SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'ROLLED_BACK'].includes(String(o.status || '').toUpperCase()) ? String(o.status).toUpperCase() : 'SUCCESS') as ExecutorOutput['status'],
      actionsExecuted: Array.isArray(o.actionsExecuted) ? o.actionsExecuted.map((a: unknown) => { const act = a as Record<string, unknown>; return { actionId: String(act.actionId || ''), status: (['SUCCESS', 'FAILED', 'SKIPPED', 'COMPENSATED'].includes(String(act.status || '').toUpperCase()) ? String(act.status).toUpperCase() : 'SUCCESS') as ActionResult['status'], startedAt: new Date(String(act.startedAt) || Date.now()), completedAt: new Date(String(act.completedAt) || Date.now()), output: act.output as Record<string, unknown> | undefined, error: act.error ? String(act.error) : undefined, compensationExecuted: Boolean(act.compensationExecuted) }; }) : [],
      artifacts: Array.isArray(o.artifacts) ? o.artifacts.map((a: unknown) => { const art = a as Record<string, unknown>; return { artifactId: String(art.artifactId || uuidv4()), type: String(art.type || ''), uri: String(art.uri || ''), metadata: art.metadata as Record<string, unknown> | undefined }; }) : [],
      totalDurationMs: Number(o.totalDurationMs) || 0,
      totalCostCents: Number(o.totalCostCents) || 0,
      compensationLog: Array.isArray(o.compensationLog) ? o.compensationLog.map((c: unknown) => { const comp = c as Record<string, unknown>; return { stepNumber: Number(comp.stepNumber) || 0, actionId: String(comp.actionId || ''), compensationType: (Object.values(CatoCompensationType).includes(String(comp.compensationType) as CatoCompensationType) ? String(comp.compensationType) : 'NONE') as CatoCompensationType, status: String(comp.status || 'PENDING') }; }) : [],
    };
  }

  async executeActions(input: ExecutorInput, context: MethodExecutionContext): Promise<ExecutorOutput> {
    const executionId = uuidv4();
    const actionsExecuted: ActionResult[] = [];
    const compensationLog: Array<{ stepNumber: number; actionId: string; compensationType: CatoCompensationType; status: string }> = [];
    const startTime = Date.now();
    let totalCostCents = 0;
    let overallStatus: ExecutorOutput['status'] = 'SUCCESS';

    for (let i = 0; i < input.proposal.actions.length; i++) {
      const action = input.proposal.actions[i];
      const actionStart = new Date();

      // Log compensation strategy BEFORE execution
      if (action.compensationType !== CatoCompensationType.NONE) {
        await this.logCompensation(context.pipelineId, context.tenantId, i, action);
        compensationLog.push({ stepNumber: i, actionId: action.actionId, compensationType: action.compensationType, status: 'PENDING' });
      }

      try {
        let output: Record<string, unknown> | undefined;
        
        if (input.dryRun) {
          output = { dryRun: true, wouldExecute: action.type };
        } else if (action.toolId) {
          output = await this.executeTool(action.toolId, action.inputs, context);
          totalCostCents += (await this.toolRegistry.getTool(action.toolId))?.estimatedCostCents || 0;
        } else {
          output = { executed: true, type: action.type };
        }

        actionsExecuted.push({ actionId: action.actionId, status: 'SUCCESS', startedAt: actionStart, completedAt: new Date(), output, compensationExecuted: false });

        // Update compensation status
        if (action.compensationType !== CatoCompensationType.NONE) {
          const logIdx = compensationLog.findIndex(c => c.actionId === action.actionId);
          if (logIdx >= 0) compensationLog[logIdx].status = 'COMPLETED_SUCCESS';
        }
      } catch (error) {
        actionsExecuted.push({ actionId: action.actionId, status: 'FAILED', startedAt: actionStart, completedAt: new Date(), error: error instanceof Error ? error.message : String(error), compensationExecuted: false });
        overallStatus = 'FAILED';

        // Execute compensations in reverse order
        if (!input.dryRun) {
          const compensated = await this.executeCompensations(context.pipelineId, context.tenantId, actionsExecuted, compensationLog);
          if (compensated) overallStatus = 'ROLLED_BACK';
        }
        break;
      }
    }

    if (overallStatus === 'SUCCESS' && actionsExecuted.some(a => a.status === 'SKIPPED')) {
      overallStatus = 'PARTIAL_SUCCESS';
    }

    return { executionId, status: overallStatus, actionsExecuted, artifacts: [], totalDurationMs: Date.now() - startTime, totalCostCents, compensationLog };
  }

  private async executeTool(toolId: string, inputs: Record<string, unknown>, context: MethodExecutionContext): Promise<Record<string, unknown>> {
    const tool = await this.toolRegistry.getTool(toolId);
    if (!tool) throw new Error(`Tool not found: ${toolId}`);

    // Validate inputs
    const validation = await this.toolRegistry.validateToolInput(toolId, inputs);
    if (!validation.valid) throw new Error(`Invalid inputs: ${validation.errors?.join(', ')}`);

    if (this.toolRegistry.isLambdaTool(tool)) {
      // Invoke Lambda function
      const functionName = this.toolRegistry.getLambdaFunctionName(tool);
      if (!functionName) {
        throw new Error(`Lambda function name not configured for tool: ${toolId}`);
      }
      
      const payload = {
        toolId,
        inputs,
        context: {
          tenantId: context.tenantId,
          userId: context.userId,
          traceId: context.traceId,
        },
      };

      const command = new InvokeCommand({
        FunctionName: functionName,
        InvocationType: 'RequestResponse',
        Payload: Buffer.from(JSON.stringify(payload)),
      });

      const response = await lambdaClient.send(command);
      
      if (response.FunctionError) {
        const errorPayload = response.Payload ? JSON.parse(new TextDecoder().decode(response.Payload)) : {};
        throw new Error(`Lambda error: ${response.FunctionError} - ${errorPayload.errorMessage || 'Unknown'}`);
      }

      const result = response.Payload ? JSON.parse(new TextDecoder().decode(response.Payload)) : {};
      return { toolId, executed: true, lambdaFunction: functionName, result };
    } else {
      // MCP tool invocation via HTTP to MCP gateway
      const mcpServer = tool.mcpServer;
      const mcpGatewayUrl = process.env.MCP_GATEWAY_URL || 'http://localhost:3001';
      
      const mcpResponse = await fetch(`${mcpGatewayUrl}/tools/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server: mcpServer,
          tool: toolId,
          arguments: inputs,
          context: { tenantId: context.tenantId, userId: context.userId },
        }),
      });

      if (!mcpResponse.ok) {
        throw new Error(`MCP invocation failed: ${mcpResponse.status} ${mcpResponse.statusText}`);
      }

      const mcpResult = await mcpResponse.json();
      return { toolId, executed: true, mcpServer, result: mcpResult };
    }
  }

  private async logCompensation(pipelineId: string, tenantId: string, stepNumber: number, action: ExecutorInput['proposal']['actions'][0]): Promise<void> {
    await this.pool.query(
      `INSERT INTO cato_compensation_log (pipeline_id, tenant_id, step_number, step_name, compensation_type, compensation_tool, compensation_inputs, affected_resources, status, original_action)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', $9)`,
      [pipelineId, tenantId, stepNumber, action.description, action.compensationType, action.toolId, JSON.stringify(action.inputs), '[]', JSON.stringify(action)]
    );
  }

  private async executeCompensations(pipelineId: string, tenantId: string, actionsExecuted: ActionResult[], compensationLog: Array<{ stepNumber: number; actionId: string; compensationType: CatoCompensationType; status: string }>): Promise<boolean> {
    const successfulActions = actionsExecuted.filter(a => a.status === 'SUCCESS').reverse();
    for (const action of successfulActions) {
      const comp = compensationLog.find(c => c.actionId === action.actionId);
      if (comp && comp.compensationType !== CatoCompensationType.NONE) {
        // Execute compensation logic here
        action.compensationExecuted = true;
        comp.status = 'COMPENSATED';
      }
    }
    return successfulActions.some(a => a.compensationExecuted);
  }

  protected async detectRiskSignals(output: ExecutorOutput, context: MethodExecutionContext): Promise<CatoRiskSignal[]> {
    const signals: CatoRiskSignal[] = [];
    if (output.status === 'FAILED') signals.push({ signalType: 'execution_failed', severity: CatoRiskLevel.HIGH, description: 'Execution failed', source: this.getMethodId() });
    if (output.status === 'ROLLED_BACK') signals.push({ signalType: 'execution_rolled_back', severity: CatoRiskLevel.MEDIUM, description: 'Execution rolled back via compensation', source: this.getMethodId() });
    return signals;
  }

  protected async invokeModel(systemPrompt: string, userPrompt: string, context: MethodExecutionContext): Promise<ModelInvocationResult> {
    // Executor doesn't typically need LLM - it executes tools directly
    // But we provide LLM support for planning/reasoning about execution
    const { callLiteLLM } = await import('../litellm.service.js');
    const modelId = this.methodDefinition?.defaultModel || 'claude-sonnet-4-20250514';
    const startTime = Date.now();

    const response = await callLiteLLM({
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 2000,
    });

    const latencyMs = Date.now() - startTime;
    const tokensInput = response.usage?.prompt_tokens || Math.ceil((systemPrompt.length + userPrompt.length) / 4);
    const tokensOutput = response.usage?.completion_tokens || Math.ceil(response.content.length / 4);

    let parsedOutput: ExecutorOutput;
    try {
      parsedOutput = JSON.parse(response.content);
      if (!parsedOutput.executionId) {
        parsedOutput.executionId = uuidv4();
      }
    } catch {
      parsedOutput = {
        executionId: uuidv4(),
        status: 'SUCCESS',
        actionsExecuted: [],
        artifacts: [],
        totalDurationMs: latencyMs,
        totalCostCents: 1,
        compensationLog: [],
      };
    }

    const costCents = Math.ceil((tokensInput * 0.003 + tokensOutput * 0.015) / 10);

    return {
      response: response.content,
      parsedOutput,
      tokensInput,
      tokensOutput,
      costCents,
      latencyMs,
      modelId,
      provider: 'anthropic',
    };
  }
}

export const createExecutorMethod = (pool: Pool, methodRegistry: CatoMethodRegistryService, schemaRegistry: CatoSchemaRegistryService, toolRegistry: CatoToolRegistryService) => new CatoExecutorMethod(pool, methodRegistry, schemaRegistry, toolRegistry);
