import { executeStatement } from '../db/client';

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
}

export const workflowEngine = new WorkflowEngine();
