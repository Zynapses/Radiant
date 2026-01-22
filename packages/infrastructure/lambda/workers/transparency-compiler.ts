/**
 * RADIANT v5.0 - Transparency Compiler Lambda
 * 
 * Trigger: SQS queue
 * Purpose: Pre-compute decision explanations for Cato transparency layer
 */

import { SQSHandler, SQSRecord } from 'aws-lambda';
import { executeStatement, stringParam } from '../shared/db/client';
import { enhancedLogger } from '../shared/logging/enhanced-logger';
import { aiHelperService } from '../shared/services/sovereign-mesh';

const logger = enhancedLogger;

interface CompileMessage {
  type: 'compile_explanation';
  decisionEventId: string;
  tenantId: string;
  tiers?: ('summary' | 'standard' | 'detailed' | 'audit')[];
}

interface DecisionEvent {
  id: string;
  tenantId: string;
  decisionType: string;
  inputContext: Record<string, unknown>;
  candidateModels: string[];
  selectedModel: string;
  selectionReason: string;
  estimatedCost: number;
  actualCost: number;
  safetyScore: number;
  governorState: Record<string, unknown>;
  cbfEvaluations: Record<string, unknown>;
  warRoomDeliberations?: Array<{
    phase: string;
    participantModel: string;
    argument: string;
    vote: string;
  }>;
}

export const handler: SQSHandler = async (event): Promise<void> => {
  logger.info('Processing transparency compilation messages', { count: event.Records.length });

  for (const record of event.Records) {
    try {
      await processRecord(record);
    } catch (error: any) {
      logger.error('Failed to process compilation message', { 
        messageId: record.messageId,
        error: error.message,
      });
      throw error;
    }
  }
};

async function processRecord(record: SQSRecord): Promise<void> {
  const message: CompileMessage = JSON.parse(record.body);
  
  if (message.type !== 'compile_explanation') {
    logger.warn('Unknown message type', { type: message.type });
    return;
  }

  const { decisionEventId, tenantId, tiers = ['summary', 'standard', 'detailed', 'audit'] } = message;
  
  logger.info('Compiling explanations', { decisionEventId, tiers });

  // Get decision event details
  const decisionEvent = await getDecisionEvent(decisionEventId);
  if (!decisionEvent) {
    logger.warn('Decision event not found', { decisionEventId });
    return;
  }

  // Get war room deliberations if any
  const deliberations = await getWarRoomDeliberations(decisionEventId);
  decisionEvent.warRoomDeliberations = deliberations;

  // Compile explanations for each tier
  for (const tier of tiers) {
    try {
      const explanation = await compileExplanation(decisionEvent, tier, tenantId);
      await storeExplanation(decisionEventId, tier, explanation);
      logger.debug('Explanation compiled', { decisionEventId, tier });
    } catch (error: any) {
      logger.warn('Failed to compile explanation', { decisionEventId, tier, error: error.message });
    }
  }

  logger.info('Explanations compiled', { decisionEventId, tiersCompiled: tiers.length });
}

async function getDecisionEvent(decisionEventId: string): Promise<DecisionEvent | null> {
  const result = await executeStatement(
    `SELECT * FROM cato_decision_events WHERE id = :id`,
    [stringParam('id', decisionEventId)]
  );

  if (!result.rows?.[0]) return null;

  const row = result.rows[0];
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    decisionType: row.decision_type as string,
    inputContext: parseJson(row.input_context),
    candidateModels: parseArray(row.candidate_models),
    selectedModel: row.selected_model as string,
    selectionReason: row.selection_reason as string,
    estimatedCost: parseFloat(row.estimated_cost as string) || 0,
    actualCost: parseFloat(row.actual_cost as string) || 0,
    safetyScore: parseFloat(row.safety_score as string) || 0,
    governorState: parseJson(row.governor_state),
    cbfEvaluations: parseJson(row.cbf_evaluations),
  };
}

async function getWarRoomDeliberations(decisionEventId: string): Promise<Array<{
  phase: string;
  participantModel: string;
  argument: string;
  vote: string;
}>> {
  const result = await executeStatement(
    `SELECT * FROM cato_war_room_deliberations WHERE decision_event_id = :id ORDER BY phase_order`,
    [stringParam('id', decisionEventId)]
  );

  return (result.rows || []).map(row => ({
    phase: row.phase as string,
    participantModel: row.participant_model as string,
    argument: row.argument as string,
    vote: row.vote as string,
  }));
}

async function compileExplanation(
  event: DecisionEvent,
  tier: 'summary' | 'standard' | 'detailed' | 'audit',
  tenantId: string
): Promise<{
  explanation: string;
  keyFactors: string[];
  alternativesConsidered: string[];
  confidenceScore: number;
}> {
  const prompts: Record<string, string> = {
    summary: `Provide a 1-2 sentence summary of why ${event.selectedModel} was selected. Be concise and user-friendly.`,
    standard: `Explain the decision to select ${event.selectedModel}. Include key factors and alternatives considered. Target a power user audience.`,
    detailed: `Provide a comprehensive explanation of the model selection decision for ${event.selectedModel}. Include:
- All factors considered
- Why alternatives were rejected
- Cost and safety analysis
- Governor and CBF evaluation summary
Target an admin audience.`,
    audit: `Generate a complete audit trail explanation for the decision to select ${event.selectedModel}. Include:
- Full reasoning chain
- All candidates evaluated with scores
- Complete safety analysis
- Governor state and CBF evaluations
- War room deliberations (if applicable)
- Timestamps and latency
This is for compliance purposes.`,
  };

  const context = {
    decisionType: event.decisionType,
    selectedModel: event.selectedModel,
    selectionReason: event.selectionReason,
    candidates: event.candidateModels,
    estimatedCost: event.estimatedCost,
    actualCost: event.actualCost,
    safetyScore: event.safetyScore,
    governorState: event.governorState,
    cbfEvaluations: event.cbfEvaluations,
    warRoomDeliberations: event.warRoomDeliberations,
  };

  // Use AI Helper for explanation generation
  try {
    const result = await (aiHelperService as any).explain(
      {
        action: 'model_selection',
        input: event.inputContext,
        output: { selectedModel: event.selectedModel },
        context: {
          ...context,
          explanationTier: tier,
          prompt: prompts[tier],
        },
      },
      tenantId
    );

    return {
      explanation: (result as any).explanation,
      keyFactors: extractKeyFactors(event, tier),
      alternativesConsidered: event.candidateModels.filter(m => m !== event.selectedModel),
      confidenceScore: event.safetyScore,
    };
  } catch (error) {
    // Fallback to template-based explanation
    return generateTemplateExplanation(event, tier);
  }
}

function extractKeyFactors(event: DecisionEvent, tier: string): string[] {
  const factors: string[] = [];

  if (event.selectionReason) {
    factors.push(event.selectionReason);
  }

  if (event.safetyScore >= 0.9) {
    factors.push('High safety score');
  }

  if (event.actualCost < event.estimatedCost * 0.8) {
    factors.push('Cost-optimized selection');
  }

  if (tier === 'detailed' || tier === 'audit') {
    if (event.governorState.precision) {
      factors.push(`Precision: ${event.governorState.precision}`);
    }
    if (event.cbfEvaluations.passed) {
      factors.push('All safety barriers passed');
    }
  }

  return factors;
}

function generateTemplateExplanation(
  event: DecisionEvent,
  tier: 'summary' | 'standard' | 'detailed' | 'audit'
): {
  explanation: string;
  keyFactors: string[];
  alternativesConsidered: string[];
  confidenceScore: number;
} {
  const templates: Record<string, (e: DecisionEvent) => string> = {
    summary: (e) => `Selected ${e.selectedModel} based on ${e.selectionReason}.`,
    standard: (e) => `Model Selection: ${e.selectedModel}\n\nReason: ${e.selectionReason}\n\nAlternatives considered: ${e.candidateModels.join(', ')}\n\nSafety score: ${e.safetyScore.toFixed(2)}`,
    detailed: (e) => `# Model Selection Decision\n\n## Selected Model\n${e.selectedModel}\n\n## Selection Reason\n${e.selectionReason}\n\n## Candidates Evaluated\n${e.candidateModels.map(m => `- ${m}`).join('\n')}\n\n## Safety Analysis\n- Safety Score: ${e.safetyScore.toFixed(2)}\n- Estimated Cost: $${e.estimatedCost.toFixed(4)}\n- Actual Cost: $${e.actualCost.toFixed(4)}\n\n## Governor State\n${JSON.stringify(e.governorState, null, 2)}`,
    audit: (e) => `# Audit Trail: Model Selection Decision\n\nEvent ID: ${e.id}\nTenant ID: ${e.tenantId}\nDecision Type: ${e.decisionType}\n\n## Selected Model\n${e.selectedModel}\n\n## Selection Reason\n${e.selectionReason}\n\n## All Candidates\n${e.candidateModels.map(m => `- ${m}`).join('\n')}\n\n## Cost Analysis\n- Estimated: $${e.estimatedCost.toFixed(4)}\n- Actual: $${e.actualCost.toFixed(4)}\n\n## Safety Evaluation\n- Score: ${e.safetyScore.toFixed(4)}\n\n## Governor State\n\`\`\`json\n${JSON.stringify(e.governorState, null, 2)}\n\`\`\`\n\n## CBF Evaluations\n\`\`\`json\n${JSON.stringify(e.cbfEvaluations, null, 2)}\n\`\`\`\n\n## War Room Deliberations\n${e.warRoomDeliberations?.map(d => `### ${d.phase}\n- Model: ${d.participantModel}\n- Argument: ${d.argument}\n- Vote: ${d.vote}`).join('\n\n') || 'N/A'}`,
  };

  return {
    explanation: templates[tier](event),
    keyFactors: extractKeyFactors(event, tier),
    alternativesConsidered: event.candidateModels.filter(m => m !== event.selectedModel),
    confidenceScore: event.safetyScore,
  };
}

async function storeExplanation(
  decisionEventId: string,
  tier: 'summary' | 'standard' | 'detailed' | 'audit',
  explanation: {
    explanation: string;
    keyFactors: string[];
    alternativesConsidered: string[];
    confidenceScore: number;
  }
): Promise<void> {
  await executeStatement(
    `INSERT INTO cato_decision_explanations (
       decision_event_id, tier, explanation, key_factors, alternatives_considered, confidence_score
     ) VALUES (
       :eventId, :tier::explanation_tier, :explanation, :keyFactors::jsonb, :alternatives::jsonb, :confidence
     )
     ON CONFLICT (decision_event_id, tier) DO UPDATE SET
       explanation = EXCLUDED.explanation,
       key_factors = EXCLUDED.key_factors,
       alternatives_considered = EXCLUDED.alternatives_considered,
       confidence_score = EXCLUDED.confidence_score,
       updated_at = NOW()`,
    [
      stringParam('eventId', decisionEventId),
      stringParam('tier', tier),
      stringParam('explanation', explanation.explanation),
      stringParam('keyFactors', JSON.stringify(explanation.keyFactors)),
      stringParam('alternatives', JSON.stringify(explanation.alternativesConsidered)),
      stringParam('confidence', explanation.confidenceScore.toString()),
    ]
  );
}

function parseJson(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return {}; }
  }
  return value as Record<string, unknown>;
}

function parseArray(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return value.replace(/[{}]/g, '').split(',').filter(Boolean); }
  }
  return [];
}
