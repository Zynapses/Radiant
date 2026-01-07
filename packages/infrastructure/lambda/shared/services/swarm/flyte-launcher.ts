/**
 * FlyteLauncher - Bridge between RADIANT and Flyte Workflow Orchestration
 * 
 * Handles:
 * - Launching Flyte workflows with S3-offloaded inputs
 * - Sending signals to resume paused workflows
 * - Aborting workflows on timeout
 * - Querying workflow status
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

// ============================================================================
// TYPES
// ============================================================================

export interface FlyteWorkflowInput {
  s3_uri: string;
  swarm_id: string;
  tenant_id: string;
  session_id: string;
  user_id: string;
  hitl_domain: string;
}

export interface FlyteExecutionStatus {
  executionId: string;
  phase: 'UNDEFINED' | 'QUEUED' | 'RUNNING' | 'SUCCEEDING' | 'SUCCEEDED' | 'FAILING' | 'FAILED' | 'ABORTED' | 'TIMED_OUT';
  startedAt?: string;
  duration?: string;
  error?: string;
}

export interface FlyteSignalPayload {
  resolution: 'approved' | 'rejected' | 'modified';
  guidance: string;
  resolved_by: string;
  resolved_at: string;
}

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

// ============================================================================
// FLYTE LAUNCHER IMPLEMENTATION
// ============================================================================

export class FlyteLauncher {
  private readonly s3Client: S3Client;

  constructor(
    private readonly flyteAdminUrl: string,
    private readonly project: string,
    private readonly domain: string,
    private readonly logger: Logger
  ) {
    this.s3Client = new S3Client({});
  }

  /**
   * Launch a Flyte workflow with the given inputs
   * Input data is already uploaded to S3 - we pass the URI
   */
  async launchWorkflow(
    workflowName: string,
    input: FlyteWorkflowInput
  ): Promise<string> {
    const executionName = `${workflowName}-${input.swarm_id.substring(0, 8)}-${Date.now()}`;

    this.logger.info('Launching Flyte workflow', {
      workflowName,
      executionName,
      s3Uri: input.s3_uri,
      tenantId: input.tenant_id,
    });

    const payload = {
      project: this.project,
      domain: this.domain,
      name: executionName,
      spec: {
        launch_plan: {
          resource_type: 'LAUNCH_PLAN',
          project: this.project,
          domain: this.domain,
          name: workflowName,
          version: 'latest',
        },
        inputs: {
          literals: {
            s3_uri: {
              scalar: {
                primitive: {
                  string_value: input.s3_uri,
                },
              },
            },
            swarm_id: {
              scalar: {
                primitive: {
                  string_value: input.swarm_id,
                },
              },
            },
            tenant_id: {
              scalar: {
                primitive: {
                  string_value: input.tenant_id,
                },
              },
            },
            session_id: {
              scalar: {
                primitive: {
                  string_value: input.session_id,
                },
              },
            },
            user_id: {
              scalar: {
                primitive: {
                  string_value: input.user_id,
                },
              },
            },
            hitl_domain: {
              scalar: {
                primitive: {
                  string_value: input.hitl_domain,
                },
              },
            },
          },
        },
      },
    };

    const response = await fetch(`${this.flyteAdminUrl}/api/v1/executions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error('Failed to launch Flyte workflow', {
        status: response.status,
        error: errorText,
      });
      throw new Error(`Flyte launch failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const executionId = result.id?.name || executionName;

    this.logger.info('Flyte workflow launched successfully', {
      executionId,
      workflowName,
    });

    return executionId;
  }

  /**
   * Send a signal to a paused Flyte workflow to resume execution
   */
  async sendSignal(
    executionId: string,
    signalId: string,
    payload: FlyteSignalPayload
  ): Promise<void> {
    this.logger.info('Sending signal to Flyte workflow', {
      executionId,
      signalId,
    });

    const signalPayload = {
      id: {
        execution_id: {
          project: this.project,
          domain: this.domain,
          name: executionId,
        },
        signal_id: signalId,
      },
      value: {
        scalar: {
          generic: {
            fields: {
              resolution: { string_value: payload.resolution },
              guidance: { string_value: payload.guidance },
              resolved_by: { string_value: payload.resolved_by },
              resolved_at: { string_value: payload.resolved_at },
            },
          },
        },
      },
    };

    const response = await fetch(`${this.flyteAdminUrl}/api/v1/signals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(signalPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error('Failed to send Flyte signal', {
        executionId,
        signalId,
        status: response.status,
        error: errorText,
      });
      throw new Error(`Flyte signal failed: ${response.status} - ${errorText}`);
    }

    this.logger.info('Flyte signal sent successfully', {
      executionId,
      signalId,
    });
  }

  /**
   * Get the status of a Flyte workflow execution
   */
  async getExecutionStatus(executionId: string): Promise<FlyteExecutionStatus> {
    const response = await fetch(
      `${this.flyteAdminUrl}/api/v1/executions/${this.project}/${this.domain}/${executionId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get execution status: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    return {
      executionId,
      phase: result.closure?.phase || 'UNDEFINED',
      startedAt: result.closure?.started_at,
      duration: result.closure?.duration,
      error: result.closure?.error?.message,
    };
  }

  /**
   * Abort a running Flyte workflow execution
   */
  async abortExecution(executionId: string, reason: string): Promise<void> {
    this.logger.info('Aborting Flyte execution', {
      executionId,
      reason,
    });

    const response = await fetch(
      `${this.flyteAdminUrl}/api/v1/executions/${this.project}/${this.domain}/${executionId}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cause: reason,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error('Failed to abort Flyte execution', {
        executionId,
        status: response.status,
        error: errorText,
      });
      throw new Error(`Flyte abort failed: ${response.status} - ${errorText}`);
    }

    this.logger.info('Flyte execution aborted successfully', {
      executionId,
    });
  }

  /**
   * List active executions for a tenant
   */
  async listActiveExecutions(tenantId: string): Promise<FlyteExecutionStatus[]> {
    const response = await fetch(
      `${this.flyteAdminUrl}/api/v1/executions/${this.project}/${this.domain}?` +
      `filters=eq(phase,RUNNING)&limit=100`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list executions: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const executions: FlyteExecutionStatus[] = [];

    for (const exec of result.executions || []) {
      executions.push({
        executionId: exec.id?.name || '',
        phase: exec.closure?.phase || 'UNDEFINED',
        startedAt: exec.closure?.started_at,
        duration: exec.closure?.duration,
        error: exec.closure?.error?.message,
      });
    }

    return executions;
  }

  /**
   * Get the output of a completed Flyte execution
   */
  async getExecutionOutput(executionId: string): Promise<Record<string, unknown>> {
    const response = await fetch(
      `${this.flyteAdminUrl}/api/v1/data/executions/${this.project}/${this.domain}/${executionId}/outputs`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get execution output: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return this.parseFlyteOutputs(result);
  }

  private parseFlyteOutputs(outputs: Record<string, unknown>): Record<string, unknown> {
    const parsed: Record<string, unknown> = {};

    const literals = (outputs as any).outputs?.literals || {};
    for (const [key, value] of Object.entries(literals)) {
      const literalValue = value as any;
      if (literalValue?.scalar?.primitive?.string_value !== undefined) {
        parsed[key] = literalValue.scalar.primitive.string_value;
      } else if (literalValue?.scalar?.primitive?.integer !== undefined) {
        parsed[key] = literalValue.scalar.primitive.integer;
      } else if (literalValue?.scalar?.primitive?.float_value !== undefined) {
        parsed[key] = literalValue.scalar.primitive.float_value;
      } else if (literalValue?.scalar?.primitive?.boolean !== undefined) {
        parsed[key] = literalValue.scalar.primitive.boolean;
      } else if (literalValue?.scalar?.generic) {
        parsed[key] = literalValue.scalar.generic;
      } else {
        parsed[key] = literalValue;
      }
    }

    return parsed;
  }
}
