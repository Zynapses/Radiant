/**
 * RADIANT v5.0 - Agent Execution Worker Lambda
 * 
 * Trigger: SQS queue
 * Purpose: Process agent OODA loop iterations asynchronously
 */

import { SQSHandler, SQSRecord } from 'aws-lambda';
import { executeStatement, stringParam, longParam, doubleParam } from '../shared/db/client';
import { enhancedLogger } from '../shared/logging/enhanced-logger';
import { agentRuntimeService, snapshotCaptureService } from '../shared/services/sovereign-mesh';

interface IterationResult {
  phase: string;
  nextPhase: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  action?: string;
  modelUsed?: string;
  cost: number;
  tokens: number;
  memory: Record<string, unknown>;
  isComplete: boolean;
  needsApproval: boolean;
  approvalReason?: string;
  summary?: string;
}

const logger = enhancedLogger;

interface ExecutionMessage {
  type: 'start' | 'iterate' | 'resume' | 'cancel';
  executionId: string;
  tenantId: string;
  agentId?: string;
  goal?: string;
  constraints?: Record<string, unknown>;
  modifications?: Record<string, unknown>;
  reason?: string;
}

export const handler: SQSHandler = async (event): Promise<void> => {
  logger.info('Processing agent execution messages', { count: event.Records.length });

  for (const record of event.Records) {
    try {
      await processRecord(record);
    } catch (error: any) {
      logger.error('Failed to process execution message', { 
        messageId: record.messageId,
        error: error.message,
      });
      throw error;
    }
  }
};

async function processRecord(record: SQSRecord): Promise<void> {
  const message: ExecutionMessage = JSON.parse(record.body);
  logger.info('Processing execution message', { type: message.type, executionId: message.executionId });

  switch (message.type) {
    case 'start':
      await handleStart(message);
      break;
    case 'iterate':
      await handleIterate(message);
      break;
    case 'resume':
      await handleResume(message);
      break;
    case 'cancel':
      await handleCancel(message);
      break;
    default:
      logger.warn('Unknown message type', { type: message.type });
  }
}

async function handleStart(message: ExecutionMessage): Promise<void> {
  const { executionId, tenantId, agentId, goal, constraints } = message;

  // Verify execution exists and is in pending state
  const execution = await getExecution(executionId);
  if (!execution || execution.status !== 'pending') {
    logger.warn('Execution not found or not pending', { executionId, status: execution?.status });
    return;
  }

  // Update to running
  await updateExecutionStatus(executionId, 'running', 'observe');

  // Capture initial snapshot
  await snapshotCaptureService.captureSnapshot({
    executionId,
    tenantId,
    stepNumber: 0,
    stepType: 'start',
    inputState: { goal, constraints },
    outputState: {},
    metadata: { agentId },
  });

  // Run first iteration
  await runIteration(executionId, tenantId);
}

async function handleIterate(message: ExecutionMessage): Promise<void> {
  const { executionId, tenantId } = message;

  const execution = await getExecution(executionId);
  if (!execution || execution.status !== 'running') {
    logger.info('Execution not running, skipping iteration', { executionId, status: execution?.status });
    return;
  }

  await runIteration(executionId, tenantId);
}

async function handleResume(message: ExecutionMessage): Promise<void> {
  const { executionId, tenantId, modifications } = message;

  const execution = await getExecution(executionId);
  if (!execution || execution.status !== 'paused') {
    logger.warn('Execution not paused, cannot resume', { executionId, status: execution?.status });
    return;
  }

  // Apply modifications if any
  if (modifications) {
    await applyModifications(executionId, modifications);
  }

  // Update to running and continue
  await updateExecutionStatus(executionId, 'running', execution.current_phase as string);
  await runIteration(executionId, tenantId);
}

async function handleCancel(message: ExecutionMessage): Promise<void> {
  const { executionId, reason } = message;

  await executeStatement(
    `UPDATE agent_executions SET 
       status = 'cancelled',
       completed_at = NOW(),
       output_summary = :reason
     WHERE id = :executionId AND status IN ('pending', 'running', 'paused')`,
    [stringParam('executionId', executionId), stringParam('reason', reason || 'Cancelled by user')]
  );

  logger.info('Execution cancelled', { executionId, reason });
}

async function runIteration(executionId: string, tenantId: string): Promise<void> {
  const execution = await getExecution(executionId);
  if (!execution) return;

  const currentIteration = (execution.current_iteration as number) || 0;
  const maxIterations = (execution.max_iterations as number) || 50;
  const budgetAllocated = parseFloat(execution.budget_allocated as string) || 0;
  const budgetConsumed = parseFloat(execution.budget_consumed as string) || 0;

  // Check iteration limit
  if (currentIteration >= maxIterations) {
    await completeExecution(executionId, 'Reached maximum iterations');
    return;
  }

  // Check budget
  if (budgetConsumed >= budgetAllocated) {
    await completeExecution(executionId, 'Budget exhausted');
    return;
  }

  // Check timeout
  const startedAt = new Date(execution.started_at as string);
  const timeoutMinutes = (execution.timeout_minutes as number) || 30;
  const now = new Date();
  if ((now.getTime() - startedAt.getTime()) > timeoutMinutes * 60 * 1000) {
    await completeExecution(executionId, 'Execution timed out');
    return;
  }

  try {
    // Run OODA iteration via agent runtime service
    const oodaResult = await agentRuntimeService.runOODAIteration(executionId, tenantId);
    
    // Map OODA result to iteration result format
    const result: IterationResult = {
      phase: oodaResult.nextPhase,
      nextPhase: oodaResult.nextPhase,
      input: {},
      output: {},
      cost: 0,
      tokens: 0,
      memory: {},
      isComplete: oodaResult.completed,
      needsApproval: false,
    };

    // Capture snapshot
    await snapshotCaptureService.captureSnapshot({
      executionId,
      tenantId,
      stepNumber: currentIteration + 1,
      stepType: result.phase,
      inputState: result.input,
      outputState: result.output,
      modelId: result.modelUsed,
      costUsd: result.cost,
      tokensUsed: result.tokens,
      metadata: {
        phase: result.phase,
        action: result.action,
      },
    });

    // Update execution state
    await executeStatement(
      `UPDATE agent_executions SET
         current_iteration = :iteration,
         current_phase = :phase,
         budget_consumed = budget_consumed + :cost,
         working_memory = :memory::jsonb,
         updated_at = NOW()
       WHERE id = :executionId`,
      [
        stringParam('executionId', executionId),
        longParam('iteration', currentIteration + 1),
        stringParam('phase', result.nextPhase),
        doubleParam('cost', result.cost || 0),
        stringParam('memory', JSON.stringify(result.memory || {})),
      ]
    );

    // Check if complete
    if (result.isComplete) {
      await completeExecution(executionId, result.summary || 'Goal achieved');
      return;
    }

    // Check if needs HITL approval
    if (result.needsApproval) {
      await pauseForApproval(executionId, tenantId, result.approvalReason || 'Approval required');
      return;
    }

    // Queue next iteration
    await queueNextIteration(executionId, tenantId);
  } catch (error: any) {
    logger.error('Iteration failed', { executionId, error: error.message });
    await failExecution(executionId, error.message);
  }
}

async function getExecution(executionId: string): Promise<Record<string, unknown> | null> {
  const result = await executeStatement(
    `SELECT * FROM agent_executions WHERE id = :executionId`,
    [stringParam('executionId', executionId)]
  );
  return result.rows?.[0] || null;
}

async function updateExecutionStatus(
  executionId: string,
  status: string,
  phase: string
): Promise<void> {
  await executeStatement(
    `UPDATE agent_executions SET status = :status, current_phase = :phase, updated_at = NOW()
     WHERE id = :executionId`,
    [stringParam('executionId', executionId), stringParam('status', status), stringParam('phase', phase)]
  );
}

async function completeExecution(executionId: string, summary: string): Promise<void> {
  await executeStatement(
    `UPDATE agent_executions SET 
       status = 'completed',
       completed_at = NOW(),
       output_summary = :summary
     WHERE id = :executionId`,
    [stringParam('executionId', executionId), stringParam('summary', summary)]
  );
  logger.info('Execution completed', { executionId, summary });
}

async function failExecution(executionId: string, error: string): Promise<void> {
  await executeStatement(
    `UPDATE agent_executions SET 
       status = 'failed',
       completed_at = NOW(),
       error_message = :error
     WHERE id = :executionId`,
    [stringParam('executionId', executionId), stringParam('error', error)]
  );
  logger.error('Execution failed', { executionId, error });
}

async function pauseForApproval(executionId: string, tenantId: string, reason: string): Promise<void> {
  await executeStatement(
    `UPDATE agent_executions SET status = 'paused', updated_at = NOW() WHERE id = :executionId`,
    [stringParam('executionId', executionId)]
  );

  // Create HITL approval request
  await executeStatement(
    `INSERT INTO hitl_approval_requests (
       tenant_id, queue_id, agent_execution_id, request_type, request_summary, priority
     ) SELECT 
       :tenantId,
       q.id,
       :executionId,
       'agent_plan',
       :reason,
       'normal'
     FROM hitl_queue_configs q
     WHERE q.tenant_id = :tenantId AND q.name = 'Agent Plan Approval'
     LIMIT 1`,
    [
      stringParam('tenantId', tenantId),
      stringParam('executionId', executionId),
      stringParam('reason', reason),
    ]
  );

  logger.info('Execution paused for approval', { executionId, reason });
}

async function applyModifications(executionId: string, modifications: Record<string, unknown>): Promise<void> {
  await executeStatement(
    `UPDATE agent_executions SET 
       working_memory = working_memory || :modifications::jsonb,
       updated_at = NOW()
     WHERE id = :executionId`,
    [stringParam('executionId', executionId), stringParam('modifications', JSON.stringify(modifications))]
  );
}

async function queueNextIteration(executionId: string, tenantId: string): Promise<void> {
  // In production, this would send a message to SQS
  // For now, we log it - the CDK stack will handle actual queueing
  logger.info('Queueing next iteration', { executionId, tenantId });
  
  // Simulate immediate processing for sync execution mode
  // In async mode, this would be handled by SQS
}
