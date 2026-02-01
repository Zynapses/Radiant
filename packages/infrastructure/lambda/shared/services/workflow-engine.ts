import { executeStatement } from '../db/client';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { uepNodeService, type NodeExecutionContext, type WorkflowUEPEnvelope } from './workflow/index.js';
// v5.53.1 Gemini Enhancement: CRDT Workflow Service for collaborative editing
import { crdtWorkflowService, type CRDTOperation, type CRDTWorkflowState } from './workflow/crdt-workflow.service';

type WorkflowStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'retrying';
type TaskType = 'model_inference' | 'transformation' | 'condition' | 'parallel' | 'aggregation' | 'external_api' | 'human_review';

interface WorkflowDefinition {
  name: string;
  description?: string;
  category: 'generation' | 'analysis' | 'transformation' | 'pipeline' | 'custom';
  dagDefinition: Record<string, unknown>;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  defaultParameters?: Record<string, unknown>;
  timeoutSeconds?: number;
  maxRetries?: number;
  minTier?: number;
}

interface TaskDefinition {
  taskId: string;
  name: string;
  description?: string;
  taskType: TaskType;
  modelId?: string;
  serviceId?: string;
  config?: Record<string, unknown>;
  inputMapping?: Record<string, unknown>;
  outputMapping?: Record<string, unknown>;
  sequenceOrder?: number;
  dependsOn?: string[];
  conditionExpression?: string;
  timeoutSeconds?: number;
}

/**
 * UEP-aware execution options for workflows
 */
interface UEPExecutionOptions {
  enableUEP?: boolean;
  complianceFrameworks?: string[];
  traceId?: string;
  parentSpanId?: string;
}

export class WorkflowEngine {
  async createWorkflow(workflowId: string, definition: WorkflowDefinition): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO workflow_definitions 
       (workflow_id, name, description, category, dag_definition, input_schema, output_schema,
        default_parameters, timeout_seconds, max_retries, min_tier)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        { name: 'workflowId', value: { stringValue: workflowId } },
        { name: 'name', value: { stringValue: definition.name } },
        { name: 'description', value: definition.description ? { stringValue: definition.description } : { isNull: true } },
        { name: 'category', value: { stringValue: definition.category } },
        { name: 'dagDefinition', value: { stringValue: JSON.stringify(definition.dagDefinition) } },
        { name: 'inputSchema', value: { stringValue: JSON.stringify(definition.inputSchema || {}) } },
        { name: 'outputSchema', value: { stringValue: JSON.stringify(definition.outputSchema || {}) } },
        { name: 'defaultParameters', value: { stringValue: JSON.stringify(definition.defaultParameters || {}) } },
        { name: 'timeoutSeconds', value: { longValue: definition.timeoutSeconds || 3600 } },
        { name: 'maxRetries', value: { longValue: definition.maxRetries || 3 } },
        { name: 'minTier', value: { longValue: definition.minTier || 1 } },
      ]
    );

    return String((result.rows[0] as Record<string, unknown>)?.id || '');
  }

  async addTask(workflowId: string, task: TaskDefinition): Promise<string> {
    // Get workflow UUID
    const workflowResult = await executeStatement(
      `SELECT id FROM workflow_definitions WHERE workflow_id = $1`,
      [{ name: 'workflowId', value: { stringValue: workflowId } }]
    );

    if (workflowResult.rows.length === 0) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const workflowUuid = String((workflowResult.rows[0] as Record<string, unknown>)?.id);

    const result = await executeStatement(
      `INSERT INTO workflow_tasks 
       (workflow_id, task_id, name, description, task_type, model_id, service_id,
        config, input_mapping, output_mapping, sequence_order, depends_on, condition_expression, timeout_seconds)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      [
        { name: 'workflowUuid', value: { stringValue: workflowUuid } },
        { name: 'taskId', value: { stringValue: task.taskId } },
        { name: 'name', value: { stringValue: task.name } },
        { name: 'description', value: task.description ? { stringValue: task.description } : { isNull: true } },
        { name: 'taskType', value: { stringValue: task.taskType } },
        { name: 'modelId', value: task.modelId ? { stringValue: task.modelId } : { isNull: true } },
        { name: 'serviceId', value: task.serviceId ? { stringValue: task.serviceId } : { isNull: true } },
        { name: 'config', value: { stringValue: JSON.stringify(task.config || {}) } },
        { name: 'inputMapping', value: { stringValue: JSON.stringify(task.inputMapping || {}) } },
        { name: 'outputMapping', value: { stringValue: JSON.stringify(task.outputMapping || {}) } },
        { name: 'sequenceOrder', value: { longValue: task.sequenceOrder || 0 } },
        { name: 'dependsOn', value: { stringValue: `{${(task.dependsOn || []).join(',')}}` } },
        { name: 'conditionExpression', value: task.conditionExpression ? { stringValue: task.conditionExpression } : { isNull: true } },
        { name: 'timeoutSeconds', value: { longValue: task.timeoutSeconds || 300 } },
      ]
    );

    return String((result.rows[0] as Record<string, unknown>)?.id || '');
  }

  async getWorkflow(workflowId: string): Promise<unknown> {
    const result = await executeStatement(
      `SELECT * FROM workflow_definitions WHERE workflow_id = $1`,
      [{ name: 'workflowId', value: { stringValue: workflowId } }]
    );
    return result.rows[0];
  }

  async getWorkflowTasks(workflowId: string): Promise<unknown[]> {
    const result = await executeStatement(
      `SELECT wt.* FROM workflow_tasks wt
       JOIN workflow_definitions wd ON wt.workflow_id = wd.id
       WHERE wd.workflow_id = $1
       ORDER BY wt.sequence_order`,
      [{ name: 'workflowId', value: { stringValue: workflowId } }]
    );
    return result.rows;
  }

  async startExecution(
    workflowId: string,
    tenantId: string,
    userId: string,
    inputParameters: Record<string, unknown>,
    priority: number = 5
  ): Promise<string> {
    // Get workflow UUID
    const workflowResult = await executeStatement(
      `SELECT id, default_parameters FROM workflow_definitions WHERE workflow_id = $1 AND is_active = true`,
      [{ name: 'workflowId', value: { stringValue: workflowId } }]
    );

    if (workflowResult.rows.length === 0) {
      throw new Error(`Workflow ${workflowId} not found or inactive`);
    }

    const workflow = workflowResult.rows[0] as Record<string, unknown>;
    const workflowUuid = String(workflow.id);
    const defaultParams = typeof workflow.default_parameters === 'string' 
      ? JSON.parse(workflow.default_parameters) 
      : (workflow.default_parameters || {});

    // Merge default parameters with input
    const resolvedParameters = { ...defaultParams, ...inputParameters };

    const result = await executeStatement(
      `INSERT INTO workflow_executions 
       (workflow_id, tenant_id, user_id, input_parameters, resolved_parameters, priority, started_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'running')
       RETURNING id`,
      [
        { name: 'workflowUuid', value: { stringValue: workflowUuid } },
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'inputParameters', value: { stringValue: JSON.stringify(inputParameters) } },
        { name: 'resolvedParameters', value: { stringValue: JSON.stringify(resolvedParameters) } },
        { name: 'priority', value: { longValue: priority } },
      ]
    );

    return String((result.rows[0] as Record<string, unknown>)?.id || '');
  }

  async getExecution(executionId: string): Promise<unknown> {
    const result = await executeStatement(
      `SELECT we.*, wd.workflow_id, wd.name as workflow_name
       FROM workflow_executions we
       JOIN workflow_definitions wd ON we.workflow_id = wd.id
       WHERE we.id = $1`,
      [{ name: 'executionId', value: { stringValue: executionId } }]
    );
    return result.rows[0];
  }

  async updateExecutionStatus(
    executionId: string,
    status: WorkflowStatus,
    output?: Record<string, unknown>,
    error?: { message: string; details?: Record<string, unknown> }
  ): Promise<void> {
    const setClauses = ['status = $2', 'updated_at = NOW()'];
    const params: Array<{ name: string; value: { stringValue: string } }> = [
      { name: 'executionId', value: { stringValue: executionId } },
      { name: 'status', value: { stringValue: status } },
    ];

    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      setClauses.push('completed_at = NOW()');
      setClauses.push(`duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000`);
    }

    if (output) {
      params.push({ name: 'output', value: { stringValue: JSON.stringify(output) } });
      setClauses.push(`output_data = $${params.length}`);
    }

    if (error) {
      params.push({ name: 'errorMessage', value: { stringValue: error.message } });
      setClauses.push(`error_message = $${params.length}`);
      if (error.details) {
        params.push({ name: 'errorDetails', value: { stringValue: JSON.stringify(error.details) } });
        setClauses.push(`error_details = $${params.length}`);
      }
    }

    await executeStatement(
      `UPDATE workflow_executions SET ${setClauses.join(', ')} WHERE id = $1`,
      params as Parameters<typeof executeStatement>[1]
    );
  }

  async startTaskExecution(executionId: string, taskId: string, inputData: Record<string, unknown>): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO task_executions 
       (workflow_execution_id, task_id, input_data, started_at, status)
       VALUES ($1, $2, $3, NOW(), 'running')
       RETURNING id`,
      [
        { name: 'executionId', value: { stringValue: executionId } },
        { name: 'taskId', value: { stringValue: taskId } },
        { name: 'inputData', value: { stringValue: JSON.stringify(inputData) } },
      ]
    );

    return String((result.rows[0] as Record<string, unknown>)?.id || '');
  }

  async completeTaskExecution(
    taskExecutionId: string,
    status: TaskStatus,
    outputData?: Record<string, unknown>,
    error?: { message: string; code?: string },
    costUsd?: number
  ): Promise<void> {
    const setClauses = ['status = $2', 'completed_at = NOW()', `duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000`];
    const params: Array<{ name: string; value: { stringValue?: string; doubleValue?: number } }> = [
      { name: 'taskExecutionId', value: { stringValue: taskExecutionId } },
      { name: 'status', value: { stringValue: status } },
    ];

    if (outputData) {
      params.push({ name: 'outputData', value: { stringValue: JSON.stringify(outputData) } });
      setClauses.push(`output_data = $${params.length}`);
    }

    if (error) {
      params.push({ name: 'errorMessage', value: { stringValue: error.message } });
      setClauses.push(`error_message = $${params.length}`);
      if (error.code) {
        params.push({ name: 'errorCode', value: { stringValue: error.code } });
        setClauses.push(`error_code = $${params.length}`);
      }
    }

    if (costUsd !== undefined) {
      params.push({ name: 'costUsd', value: { doubleValue: costUsd } });
      setClauses.push(`cost_usd = $${params.length}`);
    }

    await executeStatement(
      `UPDATE task_executions SET ${setClauses.join(', ')} WHERE id = $1`,
      params as Parameters<typeof executeStatement>[1]
    );
  }

  async getTaskExecutions(executionId: string): Promise<unknown[]> {
    const result = await executeStatement(
      `SELECT * FROM task_executions WHERE workflow_execution_id = $1 ORDER BY started_at`,
      [{ name: 'executionId', value: { stringValue: executionId } }]
    );
    return result.rows;
  }

  async getUserExecutions(tenantId: string, userId: string, limit: number = 50): Promise<unknown[]> {
    const result = await executeStatement(
      `SELECT we.*, wd.workflow_id, wd.name as workflow_name
       FROM workflow_executions we
       JOIN workflow_definitions wd ON we.workflow_id = wd.id
       WHERE we.tenant_id = $1 AND we.user_id = $2
       ORDER BY we.created_at DESC
       LIMIT ${limit}`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
      ]
    );
    return result.rows;
  }

  async cancelExecution(executionId: string): Promise<void> {
    await this.updateExecutionStatus(executionId, 'cancelled');
    
    // Cancel any running tasks
    await executeStatement(
      `UPDATE task_executions SET status = 'skipped', completed_at = NOW() 
       WHERE workflow_execution_id = $1 AND status IN ('pending', 'running')`,
      [{ name: 'executionId', value: { stringValue: executionId } }]
    );
  }

  // ==========================================================================
  // UEP-Aware Execution Methods
  // ==========================================================================

  /**
   * Start workflow execution with UEP envelope wrapping
   * All node inputs/outputs are wrapped in UEP v2.0 envelopes
   */
  async startExecutionWithUEP(
    workflowId: string,
    workflowCode: string,
    tenantId: string,
    userId: string,
    inputParameters: Record<string, unknown>,
    options: UEPExecutionOptions = {}
  ): Promise<{ executionId: string; traceId: string; workflowSpanId: string }> {
    // Generate tracing IDs
    const traceId = options.traceId || uuidv4();
    const workflowSpanId = crypto.randomBytes(8).toString('hex');
    
    // Start execution
    const executionId = await this.startExecution(
      workflowId,
      tenantId,
      userId,
      inputParameters
    );
    
    // Update with UEP tracing info
    await executeStatement(
      `UPDATE workflow_executions 
       SET trace_id = $2, workflow_span_id = $3, compliance_frameworks = $4
       WHERE id = $1`,
      [
        { name: 'executionId', value: { stringValue: executionId } },
        { name: 'traceId', value: { stringValue: traceId } },
        { name: 'workflowSpanId', value: { stringValue: workflowSpanId } },
        { name: 'frameworks', value: { stringValue: `{${(options.complianceFrameworks || []).join(',')}}` } },
      ]
    );
    
    // Create root UEP envelope for workflow
    const rootContext: NodeExecutionContext = {
      workflowId,
      workflowCode,
      executionId,
      tenantId,
      userId,
      traceId,
      workflowSpanId,
      stepOrder: 0,
      inputEnvelopes: [],
      parameters: inputParameters,
      complianceFrameworks: options.complianceFrameworks || [],
    };
    
    const rootEnvelope = uepNodeService.createInputEnvelope(
      'workflow_start',
      'Workflow Start',
      'start',
      inputParameters,
      rootContext
    );
    
    // Store root envelope
    await uepNodeService.storeEnvelope(rootEnvelope);
    
    // Update execution with root envelope
    await executeStatement(
      `UPDATE workflow_executions SET root_envelope_id = $2 WHERE id = $1`,
      [
        { name: 'executionId', value: { stringValue: executionId } },
        { name: 'envelopeId', value: { stringValue: rootEnvelope.envelopeId } },
      ]
    );
    
    return { executionId, traceId, workflowSpanId };
  }

  /**
   * Execute a task node with UEP envelope wrapping
   */
  async executeTaskWithUEP(
    executionId: string,
    taskId: string,
    taskName: string,
    taskType: TaskType,
    input: unknown,
    context: NodeExecutionContext,
    sourceEnvelope?: WorkflowUEPEnvelope
  ): Promise<{ taskExecutionId: string; inputEnvelope: WorkflowUEPEnvelope }> {
    // Create input envelope
    const nodeType = this.mapTaskTypeToNodeType(taskType);
    const inputEnvelope = uepNodeService.createInputEnvelope(
      taskId,
      taskName,
      nodeType,
      input,
      context,
      sourceEnvelope
    );
    
    // Start task execution
    const taskExecutionId = await this.startTaskExecution(
      executionId,
      taskId,
      input as Record<string, unknown>
    );
    
    // Update with envelope info
    await executeStatement(
      `UPDATE task_executions 
       SET input_envelope_id = $2, span_id = $3
       WHERE id = $1`,
      [
        { name: 'taskExecutionId', value: { stringValue: taskExecutionId } },
        { name: 'envelopeId', value: { stringValue: inputEnvelope.envelopeId } },
        { name: 'spanId', value: { stringValue: inputEnvelope.tracing.spanId } },
      ]
    );
    
    return { taskExecutionId, inputEnvelope };
  }

  /**
   * Complete a task node with UEP output envelope
   */
  async completeTaskWithUEP(
    taskExecutionId: string,
    inputEnvelope: WorkflowUEPEnvelope,
    output: unknown,
    options: {
      status: TaskStatus;
      usage: { inputTokens: number; outputTokens: number; costCents: number; latencyMs: number };
      modelInfo?: { modelId: string; mode?: string };
      error?: { message: string; code?: string };
    }
  ): Promise<WorkflowUEPEnvelope> {
    // Complete the output envelope
    const outputEnvelope = uepNodeService.completeOutputEnvelope(
      inputEnvelope,
      output,
      {
        modelInfo: options.modelInfo,
        usage: {
          inputTokens: options.usage.inputTokens,
          outputTokens: options.usage.outputTokens,
          totalTokens: options.usage.inputTokens + options.usage.outputTokens,
          costCents: options.usage.costCents,
          latencyMs: options.usage.latencyMs,
        },
      }
    );
    
    // Store output envelope
    await uepNodeService.storeEnvelope(outputEnvelope);
    
    // Complete task execution
    await this.completeTaskExecution(
      taskExecutionId,
      options.status,
      output as Record<string, unknown>,
      options.error,
      options.usage.costCents / 100
    );
    
    // Update with output envelope
    await executeStatement(
      `UPDATE task_executions SET output_envelope_id = $2 WHERE id = $1`,
      [
        { name: 'taskExecutionId', value: { stringValue: taskExecutionId } },
        { name: 'envelopeId', value: { stringValue: outputEnvelope.envelopeId } },
      ]
    );
    
    return outputEnvelope;
  }

  /**
   * Get UEP context for continuing workflow execution
   */
  async getUEPContext(executionId: string): Promise<NodeExecutionContext | null> {
    const result = await executeStatement(
      `SELECT we.*, wd.workflow_id as workflow_code
       FROM workflow_executions we
       JOIN workflow_definitions wd ON we.workflow_id = wd.id
       WHERE we.id = $1`,
      [{ name: 'executionId', value: { stringValue: executionId } }]
    );
    
    if (result.rows.length === 0) return null;
    
    const execution = result.rows[0] as Record<string, unknown>;
    
    return {
      workflowId: String(execution.workflow_id),
      workflowCode: String(execution.workflow_code || ''),
      executionId,
      tenantId: String(execution.tenant_id),
      userId: String(execution.user_id || ''),
      traceId: String(execution.trace_id || ''),
      workflowSpanId: String(execution.workflow_span_id || ''),
      stepOrder: 0,
      inputEnvelopes: [],
      parameters: typeof execution.resolved_parameters === 'string'
        ? JSON.parse(execution.resolved_parameters)
        : (execution.resolved_parameters as Record<string, unknown>) || {},
      complianceFrameworks: (execution.compliance_frameworks as string[]) || [],
    };
  }

  private mapTaskTypeToNodeType(taskType: TaskType): 'ai_inference' | 'condition' | 'transform' | 'aggregate' | 'parallel_split' | 'parallel_join' | 'human_review' | 'external_api' | 'start' | 'end' {
    const mapping: Record<TaskType, 'ai_inference' | 'condition' | 'transform' | 'aggregate' | 'parallel_split' | 'parallel_join' | 'human_review' | 'external_api' | 'start' | 'end'> = {
      'model_inference': 'ai_inference',
      'transformation': 'transform',
      'condition': 'condition',
      'parallel': 'parallel_split',
      'aggregation': 'aggregate',
      'external_api': 'external_api',
      'human_review': 'human_review',
    };
    return mapping[taskType] || 'transform';
  }

  // ==========================================================================
  // CRDT Collaborative Editing (v5.53.1 Gemini Enhancement)
  // ==========================================================================

  /**
   * Initialize collaborative editing session for a workflow
   * Creates a CRDT state that can be shared across multiple editors
   */
  async initializeCollaborativeSession(
    workflowId: string,
    tenantId: string,
    userId: string
  ): Promise<{ sessionId: string; state: ReturnType<typeof crdtWorkflowService.getWorkflowState> }> {
    // Get existing workflow definition
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // Initialize CRDT state from current workflow
    const workflowData = workflow as Record<string, unknown>;
    const dagDefinition = typeof workflowData.dag_definition === 'string'
      ? JSON.parse(workflowData.dag_definition)
      : workflowData.dag_definition || {};

    // Get or create CRDT state
    const crdtState = crdtWorkflowService.getOrCreateWorkflow(workflowId);

    // Populate from existing workflow if state is empty
    if (crdtState.nodes.size === 0 && dagDefinition.nodes) {
      for (const node of dagDefinition.nodes) {
        crdtWorkflowService.addNode(workflowId, userId, {
          type: node.type || 'method',
          label: node.name || node.label || '',
          position: node.position || { x: 0, y: 0 },
          config: node.config || {},
          createdBy: userId,
        });
      }
    }

    // Join the session as a collaborator
    crdtWorkflowService.updatePresence(workflowId, userId, {
      userId,
      userName: userId,
      cursor: undefined,
      selectedNodeIds: [],
    });

    const state = crdtWorkflowService.getWorkflowState(workflowId);
    return { sessionId: workflowId, state };
  }

  /**
   * Apply a collaborative edit operation to the workflow
   * Uses CRDT to ensure conflict-free merging
   */
  applyCollaborativeEdit(
    workflowId: string,
    userId: string,
    operationType: 'insert_node' | 'delete_node' | 'update_node' | 'move_node' | 'insert_edge' | 'delete_edge',
    targetId: string,
    payload: unknown
  ): CRDTOperation {
    return crdtWorkflowService.applyLocalOperation(workflowId, userId, operationType, targetId, payload);
  }

  /**
   * Get current collaborative state for a workflow
   */
  getCollaborativeState(workflowId: string): ReturnType<typeof crdtWorkflowService.getWorkflowState> {
    return crdtWorkflowService.getWorkflowState(workflowId);
  }

  /**
   * Get operations since a specific version (for sync)
   */
  getOperationsSince(workflowId: string, sinceVersion: number): CRDTOperation[] {
    return crdtWorkflowService.getOperationsSince(workflowId, sinceVersion);
  }

  /**
   * Merge remote operations from another collaborator
   */
  mergeRemoteOperations(
    workflowId: string,
    operations: CRDTOperation[]
  ): { merged: number; conflicts: number } {
    return crdtWorkflowService.mergeState(workflowId, operations);
  }

  /**
   * Save collaborative changes to the database
   * Converts CRDT state back to workflow definition
   */
  async saveCollaborativeChanges(
    workflowId: string,
    _tenantId: string,
    _userId: string
  ): Promise<void> {
    const state = crdtWorkflowService.getWorkflowState(workflowId);
    if (!state) {
      throw new Error(`No collaborative state for workflow ${workflowId}`);
    }

    // Convert CRDT state back to DAG definition
    const dagDefinition = {
      nodes: state.nodes.map(node => ({
        id: node.nodeId,
        type: node.type,
        label: node.label,
        config: node.config,
        position: node.position,
      })),
      edges: state.edges.map(edge => ({
        id: edge.edgeId,
        source: edge.sourceNodeId,
        target: edge.targetNodeId,
        condition: edge.condition,
      })),
    };

    // Update workflow definition
    await executeStatement(
      `UPDATE workflow_definitions 
       SET dag_definition = $2, updated_at = NOW()
       WHERE workflow_id = $1`,
      [
        { name: 'workflowId', value: { stringValue: workflowId } },
        { name: 'dagDefinition', value: { stringValue: JSON.stringify(dagDefinition) } },
      ]
    );
  }

  /**
   * Update collaborator presence (cursor position, selection)
   */
  updateCollaboratorPresence(
    workflowId: string,
    userId: string,
    presence: { cursor?: { x: number; y: number }; selectedNodeIds?: string[] }
  ): void {
    crdtWorkflowService.updatePresence(workflowId, userId, presence);
  }

  /**
   * Cleanup stale collaborator presence
   */
  cleanupCollaboratorPresence(workflowId: string): string[] {
    return crdtWorkflowService.cleanupPresence(workflowId);
  }

  /**
   * Get all collaborators currently in a session
   */
  getSessionCollaborators(workflowId: string): ReturnType<typeof crdtWorkflowService.getCollaborators> {
    return crdtWorkflowService.getCollaborators(workflowId);
  }

  /**
   * Generate a consistent color for a collaborator based on their ID
   */
  private generateCollaboratorColor(userId: string): string {
    const colors = [
      '#ef4444', '#f97316', '#eab308', '#22c55e', 
      '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'
    ];
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }
}

export const workflowEngine = new WorkflowEngine();
