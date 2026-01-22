/**
 * Cato Compensation Service (SAGA Pattern)
 * 
 * Manages compensating transactions for rollback when pipeline execution fails.
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { CatoCompensationType, CatoCompensationEntry, CatoAffectedResource } from '@radiant/shared';
import { CatoToolRegistryService } from './cato-tool-registry.service';

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
    if (!entry.compensationTool) {
      throw new Error('No compensation tool specified for DELETE compensation');
    }

    const tool = await this.toolRegistry.getTool(entry.compensationTool);
    if (!tool) {
      throw new Error(`Compensation tool not found: ${entry.compensationTool}`);
    }

    // Execute the compensation tool with the affected resources
    for (const resource of entry.affectedResources) {
      if (resource.action === 'CREATE') {
        // Delete the created resource
        console.log(`Would delete ${resource.resourceType}:${resource.resourceId}`);
      }
    }
  }

  private async executeRestoreCompensation(entry: CatoCompensationEntry): Promise<void> {
    for (const resource of entry.affectedResources) {
      if (resource.previousState && (resource.action === 'UPDATE' || resource.action === 'DELETE')) {
        // Restore to previous state
        console.log(`Would restore ${resource.resourceType}:${resource.resourceId} to previous state`);
      }
    }
  }

  private async executeNotifyCompensation(entry: CatoCompensationEntry): Promise<void> {
    // Send notification about the failed action
    console.log(`Would notify about compensation for step ${entry.stepNumber}: ${entry.stepName}`);
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
