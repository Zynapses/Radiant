/**
 * Cato Compensation Service (SAGA Pattern)
 * 
 * Manages compensating transactions for rollback when pipeline execution fails.
 * Implements actual compensation execution via tools, database operations, and notifications.
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { CatoCompensationType, CatoCompensationEntry, CatoAffectedResource } from '@radiant/shared';
import { CatoToolRegistryService } from './cato-tool-registry.service';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

const lambdaClient = new LambdaClient({});
const snsClient = new SNSClient({});

// Notification configuration
const COMPENSATION_SNS_TOPIC_ARN = process.env.COMPENSATION_SNS_TOPIC_ARN;
const MCP_GATEWAY_URL = process.env.MCP_GATEWAY_URL || 'http://localhost:3001';

export class CatoCompensationService {
  private pool: Pool;
  private toolRegistry: CatoToolRegistryService;

  constructor(pool: Pool, toolRegistry: CatoToolRegistryService) {
    this.pool = pool;
    this.toolRegistry = toolRegistry;
  }

  async logCompensation(
    pipelineId: string,
    tenantId: string,
    stepNumber: number,
    stepName: string,
    compensationType: CatoCompensationType,
    compensationTool: string | undefined,
    compensationInputs: Record<string, unknown> | undefined,
    affectedResources: CatoAffectedResource[],
    originalAction: Record<string, unknown>,
    originalResult?: Record<string, unknown>
  ): Promise<string> {
    const id = uuidv4();
    
    await this.pool.query(
      `INSERT INTO cato_compensation_log (
        id, pipeline_id, tenant_id, step_number, step_name,
        compensation_type, compensation_tool, compensation_inputs,
        affected_resources, status, priority,
        original_action, original_result
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING', $10, $11, $12)`,
      [
        id, pipelineId, tenantId, stepNumber, stepName,
        compensationType, compensationTool, 
        compensationInputs ? JSON.stringify(compensationInputs) : null,
        JSON.stringify(affectedResources), stepNumber,
        JSON.stringify(originalAction),
        originalResult ? JSON.stringify(originalResult) : null,
      ]
    );

    return id;
  }

  async executeCompensations(pipelineId: string, tenantId: string): Promise<{ executed: number; failed: number }> {
    // Get pending compensations in reverse order (LIFO for SAGA)
    const result = await this.pool.query(
      `SELECT * FROM cato_compensation_log
       WHERE pipeline_id = $1 AND tenant_id = $2 AND status = 'PENDING'
       ORDER BY step_number DESC`,
      [pipelineId, tenantId]
    );

    let executed = 0;
    let failed = 0;

    for (const row of result.rows) {
      const entry = this.mapRowToEntry(row);
      
      try {
        await this.executeCompensation(entry);
        executed++;
      } catch (error) {
        failed++;
        await this.markCompensationFailed(entry.id, error instanceof Error ? error.message : String(error));
      }
    }

    return { executed, failed };
  }

  private async executeCompensation(entry: CatoCompensationEntry): Promise<void> {
    await this.updateCompensationStatus(entry.id, 'EXECUTING');

    switch (entry.compensationType) {
      case CatoCompensationType.DELETE:
        await this.executeDeleteCompensation(entry);
        break;
      case CatoCompensationType.RESTORE:
        await this.executeRestoreCompensation(entry);
        break;
      case CatoCompensationType.NOTIFY:
        await this.executeNotifyCompensation(entry);
        break;
      case CatoCompensationType.MANUAL:
        await this.flagForManualCompensation(entry);
        break;
      case CatoCompensationType.NONE:
        // No compensation needed
        break;
    }

    await this.markCompensationCompleted(entry.id);
  }

  private async executeDeleteCompensation(entry: CatoCompensationEntry): Promise<void> {
    const results: Array<{ resourceId: string; success: boolean; error?: string }> = [];

    for (const resource of entry.affectedResources) {
      if (resource.action === 'CREATE') {
        try {
          // If a compensation tool is specified, use it
          if (entry.compensationTool) {
            await this.invokeCompensationTool(entry.compensationTool, {
              operation: 'DELETE',
              resourceType: resource.resourceType,
              resourceId: resource.resourceId,
              tenantId: entry.tenantId,
              pipelineId: entry.pipelineId,
            });
          } else {
            // Use generic resource deletion based on resource type
            await this.deleteResourceByType(entry.tenantId, resource);
          }

          logger.info('Compensation DELETE executed', {
            resourceType: resource.resourceType,
            resourceId: resource.resourceId,
            pipelineId: entry.pipelineId,
          });
          results.push({ resourceId: resource.resourceId, success: true });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.error('Compensation DELETE failed', {
            resourceType: resource.resourceType,
            resourceId: resource.resourceId,
            error: errorMsg,
          });
          results.push({ resourceId: resource.resourceId, success: false, error: errorMsg });
        }
      }
    }

    // Log results to the compensation entry
    await this.updateCompensationResult(entry.id, { deleteResults: results });

    // If any deletions failed, throw to mark overall compensation as failed
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      throw new Error(`Failed to delete ${failures.length} resources: ${failures.map(f => f.resourceId).join(', ')}`);
    }
  }

  private async executeRestoreCompensation(entry: CatoCompensationEntry): Promise<void> {
    const results: Array<{ resourceId: string; success: boolean; error?: string }> = [];

    for (const resource of entry.affectedResources) {
      if (resource.previousState && (resource.action === 'UPDATE' || resource.action === 'DELETE')) {
        try {
          // If a compensation tool is specified, use it
          if (entry.compensationTool) {
            await this.invokeCompensationTool(entry.compensationTool, {
              operation: 'RESTORE',
              resourceType: resource.resourceType,
              resourceId: resource.resourceId,
              previousState: resource.previousState,
              tenantId: entry.tenantId,
              pipelineId: entry.pipelineId,
            });
          } else {
            // Use generic resource restoration based on resource type
            await this.restoreResourceByType(entry.tenantId, resource);
          }

          logger.info('Compensation RESTORE executed', {
            resourceType: resource.resourceType,
            resourceId: resource.resourceId,
            pipelineId: entry.pipelineId,
          });
          results.push({ resourceId: resource.resourceId, success: true });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.error('Compensation RESTORE failed', {
            resourceType: resource.resourceType,
            resourceId: resource.resourceId,
            error: errorMsg,
          });
          results.push({ resourceId: resource.resourceId, success: false, error: errorMsg });
        }
      }
    }

    // Log results to the compensation entry
    await this.updateCompensationResult(entry.id, { restoreResults: results });

    // If any restorations failed, throw to mark overall compensation as failed
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      throw new Error(`Failed to restore ${failures.length} resources: ${failures.map(f => f.resourceId).join(', ')}`);
    }
  }

  private async executeNotifyCompensation(entry: CatoCompensationEntry): Promise<void> {
    const notification = {
      type: 'CATO_COMPENSATION_REQUIRED',
      pipelineId: entry.pipelineId,
      tenantId: entry.tenantId,
      stepNumber: entry.stepNumber,
      stepName: entry.stepName,
      affectedResources: entry.affectedResources.map(r => ({
        resourceType: r.resourceType,
        resourceId: r.resourceId,
        action: r.action,
      })),
      originalAction: entry.originalAction,
      timestamp: new Date().toISOString(),
    };

    // Send SNS notification if configured
    if (COMPENSATION_SNS_TOPIC_ARN) {
      try {
        await snsClient.send(new PublishCommand({
          TopicArn: COMPENSATION_SNS_TOPIC_ARN,
          Subject: `[CATO] Compensation Required - Pipeline ${entry.pipelineId}`,
          Message: JSON.stringify(notification, null, 2),
          MessageAttributes: {
            tenantId: { DataType: 'String', StringValue: entry.tenantId },
            pipelineId: { DataType: 'String', StringValue: entry.pipelineId },
            compensationType: { DataType: 'String', StringValue: entry.compensationType },
          },
        }));
        logger.info('Compensation notification sent via SNS', {
          pipelineId: entry.pipelineId,
          stepNumber: entry.stepNumber,
        });
      } catch (error) {
        logger.error('Failed to send SNS notification', { error });
        // Don't throw - notification failure shouldn't fail the compensation
      }
    }

    // Also store notification in database for audit trail
    await this.pool.query(
      `INSERT INTO cato_compensation_notifications (
        id, tenant_id, pipeline_id, compensation_id, notification_type,
        notification_payload, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'SENT', NOW())
      ON CONFLICT DO NOTHING`,
      [
        uuidv4(),
        entry.tenantId,
        entry.pipelineId,
        entry.id,
        'COMPENSATION_REQUIRED',
        JSON.stringify(notification),
      ]
    );

    logger.info('Compensation NOTIFY executed', {
      pipelineId: entry.pipelineId,
      stepNumber: entry.stepNumber,
      stepName: entry.stepName,
    });
  }

  /**
   * Invoke a compensation tool via Lambda or MCP
   */
  private async invokeCompensationTool(
    toolId: string,
    inputs: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const tool = await this.toolRegistry.getTool(toolId);
    if (!tool) {
      throw new Error(`Compensation tool not found: ${toolId}`);
    }

    if (this.toolRegistry.isLambdaTool(tool)) {
      const functionName = this.toolRegistry.getLambdaFunctionName(tool);
      if (!functionName) {
        throw new Error(`Lambda function name not configured for tool: ${toolId}`);
      }

      const command = new InvokeCommand({
        FunctionName: functionName,
        InvocationType: 'RequestResponse',
        Payload: Buffer.from(JSON.stringify({ toolId, inputs, isCompensation: true })),
      });

      const response = await lambdaClient.send(command);

      if (response.FunctionError) {
        const errorPayload = response.Payload ? JSON.parse(new TextDecoder().decode(response.Payload)) : {};
        throw new Error(`Lambda compensation error: ${response.FunctionError} - ${errorPayload.errorMessage || 'Unknown'}`);
      }

      return response.Payload ? JSON.parse(new TextDecoder().decode(response.Payload)) : {};
    } else {
      // MCP tool invocation
      const mcpServer = tool.mcpServer;
      const mcpResponse = await fetch(`${MCP_GATEWAY_URL}/tools/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server: mcpServer,
          tool: toolId,
          arguments: inputs,
          isCompensation: true,
        }),
      });

      if (!mcpResponse.ok) {
        throw new Error(`MCP compensation invocation failed: ${mcpResponse.status}`);
      }

      return (await mcpResponse.json()) as Record<string, unknown>;
    }
  }

  /**
   * Generic resource deletion based on resource type
   */
  private async deleteResourceByType(
    tenantId: string,
    resource: CatoAffectedResource
  ): Promise<void> {
    const { resourceType, resourceId } = resource;

    // Map resource types to their respective tables
    const tableMap: Record<string, string> = {
      'cato_pipeline_execution': 'cato_pipeline_executions',
      'cato_method_invocation': 'cato_method_invocations',
      'cato_envelope': 'cato_pipeline_envelopes',
      'conversation': 'uds_conversations',
      'message': 'uds_messages',
      'upload': 'uds_uploads',
      'knowledge_node': 'cortex_knowledge_nodes',
      'knowledge_edge': 'cortex_knowledge_edges',
    };

    const tableName = tableMap[resourceType.toLowerCase()];
    if (tableName) {
      // Soft delete if the table supports it, otherwise hard delete
      const softDeleteResult = await this.pool.query(
        `UPDATE ${tableName} SET deleted_at = NOW(), updated_at = NOW() 
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [resourceId, tenantId]
      );

      if (softDeleteResult.rowCount === 0) {
        // Try hard delete if soft delete didn't work (no deleted_at column)
        await this.pool.query(
          `DELETE FROM ${tableName} WHERE id = $1 AND tenant_id = $2`,
          [resourceId, tenantId]
        );
      }
    } else {
      logger.warn('Unknown resource type for deletion', { resourceType, resourceId });
      throw new Error(`Unknown resource type: ${resourceType}`);
    }
  }

  /**
   * Generic resource restoration based on resource type
   */
  private async restoreResourceByType(
    tenantId: string,
    resource: CatoAffectedResource
  ): Promise<void> {
    const { resourceType, resourceId, previousState } = resource;

    if (!previousState) {
      throw new Error(`No previous state available for resource: ${resourceId}`);
    }

    const tableMap: Record<string, string> = {
      'cato_pipeline_execution': 'cato_pipeline_executions',
      'cato_method_invocation': 'cato_method_invocations',
      'cato_envelope': 'cato_pipeline_envelopes',
      'conversation': 'uds_conversations',
      'message': 'uds_messages',
      'upload': 'uds_uploads',
      'knowledge_node': 'cortex_knowledge_nodes',
      'knowledge_edge': 'cortex_knowledge_edges',
    };

    const tableName = tableMap[resourceType.toLowerCase()];
    if (tableName) {
      // Build UPDATE statement from previousState
      const state = previousState as Record<string, unknown>;
      const columns = Object.keys(state).filter(k => k !== 'id' && k !== 'tenant_id');
      
      if (columns.length > 0) {
        const setClause = columns.map((col, i) => `${col} = $${i + 3}`).join(', ');
        const values = columns.map(col => state[col]);

        await this.pool.query(
          `UPDATE ${tableName} SET ${setClause}, updated_at = NOW() 
           WHERE id = $1 AND tenant_id = $2`,
          [resourceId, tenantId, ...values]
        );
      }
    } else {
      logger.warn('Unknown resource type for restoration', { resourceType, resourceId });
      throw new Error(`Unknown resource type: ${resourceType}`);
    }
  }

  /**
   * Update compensation entry with execution result
   */
  private async updateCompensationResult(
    id: string,
    result: Record<string, unknown>
  ): Promise<void> {
    await this.pool.query(
      `UPDATE cato_compensation_log SET result = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(result), id]
    );
  }

  private async flagForManualCompensation(entry: CatoCompensationEntry): Promise<void> {
    await this.pool.query(
      `UPDATE cato_compensation_log SET
        status = 'PENDING_MANUAL',
        updated_at = NOW()
      WHERE id = $1`,
      [entry.id]
    );
  }

  private async updateCompensationStatus(id: string, status: string): Promise<void> {
    await this.pool.query(
      `UPDATE cato_compensation_log SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, id]
    );
  }

  private async markCompensationCompleted(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE cato_compensation_log SET
        status = 'COMPLETED',
        executed_at = NOW(),
        updated_at = NOW()
      WHERE id = $1`,
      [id]
    );
  }

  private async markCompensationFailed(id: string, error: string): Promise<void> {
    await this.pool.query(
      `UPDATE cato_compensation_log SET
        status = 'FAILED',
        error = $1,
        retry_count = retry_count + 1,
        updated_at = NOW()
      WHERE id = $2`,
      [error, id]
    );
  }

  async getPendingCompensations(tenantId: string): Promise<CatoCompensationEntry[]> {
    const result = await this.pool.query(
      `SELECT * FROM cato_compensation_log
       WHERE tenant_id = $1 AND status IN ('PENDING', 'PENDING_MANUAL')
       ORDER BY created_at DESC`,
      [tenantId]
    );
    return result.rows.map(row => this.mapRowToEntry(row));
  }

  async getCompensationsByPipeline(pipelineId: string): Promise<CatoCompensationEntry[]> {
    const result = await this.pool.query(
      `SELECT * FROM cato_compensation_log WHERE pipeline_id = $1 ORDER BY step_number DESC`,
      [pipelineId]
    );
    return result.rows.map(row => this.mapRowToEntry(row));
  }

  private mapRowToEntry(row: Record<string, unknown>): CatoCompensationEntry {
    return {
      id: row.id as string,
      pipelineId: row.pipeline_id as string,
      tenantId: row.tenant_id as string,
      invocationId: row.invocation_id as string | undefined,
      stepNumber: row.step_number as number,
      stepName: row.step_name as string | undefined,
      compensationType: row.compensation_type as CatoCompensationType,
      compensationTool: row.compensation_tool as string | undefined,
      compensationInputs: row.compensation_inputs as Record<string, unknown> | undefined,
      compensationDeadline: row.compensation_deadline ? new Date(row.compensation_deadline as string) : undefined,
      affectedResources: row.affected_resources as CatoAffectedResource[],
      status: row.status as 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'SKIPPED',
      priority: row.priority as number,
      executedAt: row.executed_at ? new Date(row.executed_at as string) : undefined,
      result: row.result as Record<string, unknown> | undefined,
      error: row.error as string | undefined,
      retryCount: row.retry_count as number,
      originalAction: row.original_action as Record<string, unknown>,
      originalResult: row.original_result as Record<string, unknown> | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

export const createCatoCompensationService = (pool: Pool, toolRegistry: CatoToolRegistryService): CatoCompensationService => {
  return new CatoCompensationService(pool, toolRegistry);
};
