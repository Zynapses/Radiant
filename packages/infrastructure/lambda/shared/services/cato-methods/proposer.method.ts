/**
 * Cato Proposer Method
 * 
 * Generates action proposals based on observations. Creates structured plans
 * with reversibility information, cost estimates, and alternative approaches.
 */

import { Pool } from 'pg';
import {
  CatoOutputType,
  CatoRiskLevel,
  CatoAccumulatedContext,
  CatoRiskSignal,
  CatoCompensationType,
} from '@radiant/shared';
import {
  CatoBaseMethodExecutor,
  MethodExecutionContext,
  ModelInvocationResult,
} from '../cato-method-executor.service';
import { CatoMethodRegistryService } from '../cato-method-registry.service';
import { CatoSchemaRegistryService } from '../cato-schema-registry.service';
import { CatoToolRegistryService } from '../cato-tool-registry.service';

export interface ProposerInput {
  observation: {
    category: string;
    subcategory?: string;
    confidence: number;
    reasoning: string;
    domain: { detected: string; confidence: number };
    complexity: string;
    requiredCapabilities: string[];
    ambiguities: Array<{ aspect: string; description: string }>;
  };
  userRequest: string;
  availableTools?: string[];
  constraints?: {
    maxCostCents?: number;
    maxDurationMs?: number;
    mustBeReversible?: boolean;
    allowedRiskLevels?: CatoRiskLevel[];
  };
  additionalInstructions?: string;
}

export interface ProposedAction {
  actionId: string;
  type: string;
  description: string;
  toolId?: string;
  inputs: Record<string, unknown>;
  reversible: boolean;
  compensationType: CatoCompensationType;
  compensationStrategy?: string;
  estimatedCostCents: number;
  estimatedDurationMs: number;
  riskLevel: CatoRiskLevel;
  dependencies: string[];
}

export interface ProposerOutput {
  proposalId: string;
  title: string;
  actions: ProposedAction[];
  rationale: string;
  estimatedImpact: {
    costCents: number;
    durationMs: number;
    riskLevel: CatoRiskLevel;
  };
  alternatives: Array<{
    title: string;
    rationale: string;
    tradeoffs: string;
    estimatedImpact: {
      costCents: number;
      durationMs: number;
      riskLevel: CatoRiskLevel;
    };
  }>;
  prerequisites: string[];
  assumptions: string[];
  warnings: string[];
}

export class CatoProposerMethod extends CatoBaseMethodExecutor<ProposerInput, ProposerOutput> {
  private toolRegistry: CatoToolRegistryService;

  constructor(
    pool: Pool,
    methodRegistry: CatoMethodRegistryService,
    schemaRegistry: CatoSchemaRegistryService,
    toolRegistry: CatoToolRegistryService
  ) {
    super(pool, methodRegistry, schemaRegistry);
    this.toolRegistry = toolRegistry;
  }

  getMethodId(): string {
    return 'method:proposer:v1';
  }

  protected getOutputType(): CatoOutputType {
    return CatoOutputType.PROPOSAL;
  }

  protected generateOutputSummary(output: ProposerOutput): string {
    const actionCount = output.actions.length;
    const totalCost = output.estimatedImpact.costCents;
    const risk = output.estimatedImpact.riskLevel;
    return `Proposal "${output.title}": ${actionCount} action(s), ` +
      `$${(totalCost / 100).toFixed(2)} estimated cost, ${risk} risk`;
  }

  protected async buildPromptVariables(
    input: ProposerInput,
    context: MethodExecutionContext,
    prunedContext: CatoAccumulatedContext
  ): Promise<Record<string, unknown>> {
    // Get available tools
    const tools = await this.toolRegistry.listTools({
      tenantId: context.tenantId,
      enabled: true,
    });

    const toolDescriptions = tools
      .filter(t => !input.availableTools || input.availableTools.includes(t.toolId))
      .map(t => `- ${t.toolId}: ${t.description} (Risk: ${t.riskCategory}, Reversible: ${t.isReversible})`)
      .join('\n');

    return {
      observation: JSON.stringify(input.observation, null, 2),
      user_request: input.userRequest,
      available_tools: toolDescriptions || 'No tools available',
      constraints: input.constraints
        ? JSON.stringify(input.constraints, null, 2)
        : 'No specific constraints',
      additional_instructions: input.additionalInstructions || '',
      governance_preset: context.governancePreset,
    };
  }

  protected async processModelOutput(
    rawOutput: unknown,
    context: MethodExecutionContext
  ): Promise<ProposerOutput> {
    const output = rawOutput as Record<string, unknown>;

    // Generate proposal ID if not provided
    const proposalId = String(output.proposalId || `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

    // Process actions
    const actions: ProposedAction[] = Array.isArray(output.actions)
      ? await Promise.all(output.actions.map(async (a: unknown, idx: number) => {
          const action = a as Record<string, unknown>;
          return this.processAction(action, idx);
        }))
      : [];

    // Calculate aggregate impact
    const totalCost = actions.reduce((sum, a) => sum + a.estimatedCostCents, 0);
    const totalDuration = actions.reduce((sum, a) => sum + a.estimatedDurationMs, 0);
    const maxRisk = this.getMaxRiskLevel(actions.map(a => a.riskLevel));

    const processed: ProposerOutput = {
      proposalId,
      title: String(output.title || 'Untitled Proposal'),
      actions,
      rationale: String(output.rationale || 'No rationale provided'),
      estimatedImpact: {
        costCents: totalCost,
        durationMs: totalDuration,
        riskLevel: maxRisk,
      },
      alternatives: Array.isArray(output.alternatives)
        ? output.alternatives.map((alt: unknown) => {
            const a = alt as Record<string, unknown>;
            return {
              title: String(a.title || ''),
              rationale: String(a.rationale || ''),
              tradeoffs: String(a.tradeoffs || ''),
              estimatedImpact: {
                costCents: Number((a.estimatedImpact as Record<string, unknown>)?.costCents) || 0,
                durationMs: Number((a.estimatedImpact as Record<string, unknown>)?.durationMs) || 0,
                riskLevel: this.parseRiskLevel((a.estimatedImpact as Record<string, unknown>)?.riskLevel),
              },
            };
          })
        : [],
      prerequisites: Array.isArray(output.prerequisites)
        ? (output.prerequisites as string[])
        : [],
      assumptions: Array.isArray(output.assumptions)
        ? (output.assumptions as string[])
        : [],
      warnings: Array.isArray(output.warnings)
        ? (output.warnings as string[])
        : [],
    };

    return processed;
  }

  private async processAction(action: Record<string, unknown>, index: number): Promise<ProposedAction> {
    const actionId = String(action.actionId || `act_${index + 1}`);
    const toolId = action.toolId ? String(action.toolId) : undefined;

    // If tool specified, get tool details for accurate risk/reversibility
    let toolInfo = null;
    if (toolId) {
      toolInfo = await this.toolRegistry.getTool(toolId);
    }

    return {
      actionId,
      type: String(action.type || 'UNKNOWN'),
      description: String(action.description || ''),
      toolId,
      inputs: (action.inputs as Record<string, unknown>) || {},
      reversible: toolInfo?.isReversible !== undefined ? toolInfo.isReversible : Boolean(action.reversible),
      compensationType: toolInfo?.compensationType ?? this.parseCompensationType(action.compensationType),
      compensationStrategy: action.compensationStrategy ? String(action.compensationStrategy) : undefined,
      estimatedCostCents: toolInfo?.estimatedCostCents ?? (Number(action.estimatedCostCents) || 0),
      estimatedDurationMs: Number(action.estimatedDurationMs) || 1000,
      riskLevel: toolInfo?.riskCategory ?? this.parseRiskLevel(action.riskLevel),
      dependencies: Array.isArray(action.dependencies)
        ? (action.dependencies as string[])
        : [],
    };
  }

  protected async detectRiskSignals(
    output: ProposerOutput,
    context: MethodExecutionContext
  ): Promise<CatoRiskSignal[]> {
    const signals: CatoRiskSignal[] = [];

    // Check for irreversible actions
    const irreversibleActions = output.actions.filter(a => !a.reversible);
    if (irreversibleActions.length > 0) {
      signals.push({
        signalType: 'irreversible_actions',
        severity: CatoRiskLevel.MEDIUM,
        description: `${irreversibleActions.length} irreversible action(s) in proposal`,
        source: this.getMethodId(),
        mitigations: [
          'Require explicit approval at CP2',
          'Create backup before execution',
          'Consider alternative reversible approaches',
        ],
      });
    }

    // Check for high cost
    if (output.estimatedImpact.costCents > 100) {
      signals.push({
        signalType: 'high_cost',
        severity: output.estimatedImpact.costCents > 1000 ? CatoRiskLevel.HIGH : CatoRiskLevel.MEDIUM,
        description: `Estimated cost: $${(output.estimatedImpact.costCents / 100).toFixed(2)}`,
        source: this.getMethodId(),
        mitigations: ['Request cost approval', 'Consider cheaper alternatives'],
      });
    }

    // Check for high-risk actions
    const highRiskActions = output.actions.filter(
      a => a.riskLevel === CatoRiskLevel.HIGH || a.riskLevel === CatoRiskLevel.CRITICAL
    );
    if (highRiskActions.length > 0) {
      signals.push({
        signalType: 'high_risk_actions',
        severity: highRiskActions.some(a => a.riskLevel === CatoRiskLevel.CRITICAL)
          ? CatoRiskLevel.CRITICAL
          : CatoRiskLevel.HIGH,
        description: `${highRiskActions.length} high/critical risk action(s)`,
        source: this.getMethodId(),
        mitigations: [
          'Require security review',
          'Enable dry-run mode',
          'Add additional checkpoints',
        ],
      });
    }

    // Check for many assumptions
    if (output.assumptions.length > 3) {
      signals.push({
        signalType: 'many_assumptions',
        severity: CatoRiskLevel.LOW,
        description: `Proposal relies on ${output.assumptions.length} assumptions`,
        source: this.getMethodId(),
        mitigations: ['Validate assumptions before execution', 'Request clarification'],
      });
    }

    // Check for warnings
    if (output.warnings.length > 0) {
      signals.push({
        signalType: 'proposal_warnings',
        severity: CatoRiskLevel.MEDIUM,
        description: `${output.warnings.length} warning(s): ${output.warnings.join('; ')}`,
        source: this.getMethodId(),
      });
    }

    return signals;
  }

  private parseRiskLevel(value: unknown): CatoRiskLevel {
    const str = String(value || 'MEDIUM').toUpperCase();
    const valid = Object.values(CatoRiskLevel);
    return valid.includes(str as CatoRiskLevel) ? str as CatoRiskLevel : CatoRiskLevel.MEDIUM;
  }

  private parseCompensationType(value: unknown): CatoCompensationType {
    const str = String(value || 'NONE').toUpperCase();
    const valid = Object.values(CatoCompensationType);
    return valid.includes(str as CatoCompensationType) ? str as CatoCompensationType : CatoCompensationType.NONE;
  }

  private getMaxRiskLevel(levels: CatoRiskLevel[]): CatoRiskLevel {
    const order = [
      CatoRiskLevel.NONE,
      CatoRiskLevel.LOW,
      CatoRiskLevel.MEDIUM,
      CatoRiskLevel.HIGH,
      CatoRiskLevel.CRITICAL,
    ];
    let maxIndex = 0;
    for (const level of levels) {
      const idx = order.indexOf(level);
      if (idx > maxIndex) maxIndex = idx;
    }
    return order[maxIndex];
  }

  protected async invokeModel(
    systemPrompt: string,
    userPrompt: string,
    context: MethodExecutionContext
  ): Promise<ModelInvocationResult> {
    const { callLiteLLM } = await import('../litellm.service.js');
    const modelId = this.methodDefinition?.defaultModel || 'claude-sonnet-4-20250514';
    const startTime = Date.now();

    const response = await callLiteLLM({
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 4000,
    });

    const latencyMs = Date.now() - startTime;
    const tokensInput = response.usage?.prompt_tokens || Math.ceil((systemPrompt.length + userPrompt.length) / 4);
    const tokensOutput = response.usage?.completion_tokens || Math.ceil(response.content.length / 4);

    let parsedOutput: ProposerOutput;
    try {
      parsedOutput = JSON.parse(response.content);
      // Ensure proposalId exists
      if (!parsedOutput.proposalId) {
        parsedOutput.proposalId = `prop_${Date.now()}`;
      }
    } catch {
      // If JSON parsing fails, construct a default response
      parsedOutput = {
        proposalId: `prop_${Date.now()}`,
        title: 'Parsed from unstructured response',
        actions: [{
          actionId: 'act_fallback',
          type: 'ANALYZE',
          description: response.content.substring(0, 500),
          reversible: true,
          compensationType: CatoCompensationType.NONE,
          estimatedCostCents: 5,
          estimatedDurationMs: 2000,
          riskLevel: CatoRiskLevel.MEDIUM,
          inputs: {},
          dependencies: [],
        }],
        rationale: response.content,
        estimatedImpact: { costCents: 5, durationMs: 2000, riskLevel: CatoRiskLevel.MEDIUM },
        alternatives: [],
        prerequisites: [],
        assumptions: [],
        warnings: ['Response was not in expected JSON format'],
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

export const createProposerMethod = (
  pool: Pool,
  methodRegistry: CatoMethodRegistryService,
  schemaRegistry: CatoSchemaRegistryService,
  toolRegistry: CatoToolRegistryService
): CatoProposerMethod => {
  return new CatoProposerMethod(pool, methodRegistry, schemaRegistry, toolRegistry);
};
