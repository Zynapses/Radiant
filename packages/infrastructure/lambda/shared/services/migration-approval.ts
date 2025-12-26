import { executeStatement } from '../db/client';
import { createHash } from 'crypto';

type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed' | 'cancelled';
type Environment = 'development' | 'staging' | 'production';
type Decision = 'approved' | 'rejected';

interface ApprovalRequest {
  id: string;
  migrationName: string;
  migrationVersion: string;
  environment: Environment;
  status: ApprovalStatus;
  approvalsRequired: number;
  approvalsReceived: number;
  requestedBy: string;
  requestedAt: Date;
}

interface ApprovalPolicy {
  approvalsRequired: number;
  selfApprovalAllowed: boolean;
  autoApproveDevelopment: boolean;
}

export class MigrationApprovalService {
  async createRequest(
    tenantId: string,
    adminId: string,
    migrationName: string,
    migrationVersion: string,
    migrationSql: string,
    environment: Environment,
    reason?: string,
    rollbackSql?: string
  ): Promise<{ id: string; status: ApprovalStatus; approvalsRequired: number }> {
    // Get policy
    const policy = await this.getPolicy(tenantId, environment);
    
    let approvalsRequired = policy.approvalsRequired;
    if (environment === 'development' && policy.autoApproveDevelopment) {
      approvalsRequired = 0;
    }

    const checksum = createHash('sha256').update(migrationSql).digest('hex');
    const status: ApprovalStatus = approvalsRequired === 0 ? 'approved' : 'pending';

    const result = await executeStatement(
      `INSERT INTO migration_approval_requests 
       (tenant_id, migration_name, migration_version, migration_checksum, migration_sql,
        environment, requested_by, request_reason, approvals_required, status, rollback_sql)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'migrationName', value: { stringValue: migrationName } },
        { name: 'migrationVersion', value: { stringValue: migrationVersion } },
        { name: 'checksum', value: { stringValue: checksum } },
        { name: 'migrationSql', value: { stringValue: migrationSql } },
        { name: 'environment', value: { stringValue: environment } },
        { name: 'requestedBy', value: { stringValue: adminId } },
        { name: 'reason', value: reason ? { stringValue: reason } : { isNull: true } },
        { name: 'approvalsRequired', value: { longValue: approvalsRequired } },
        { name: 'status', value: { stringValue: status } },
        { name: 'rollbackSql', value: rollbackSql ? { stringValue: rollbackSql } : { isNull: true } },
      ]
    );

    return {
      id: String((result.rows[0] as Record<string, unknown>).id),
      status,
      approvalsRequired,
    };
  }

  async submitApproval(
    requestId: string,
    adminId: string,
    decision: Decision,
    reason?: string
  ): Promise<{ success: boolean; requestStatus: ApprovalStatus; canExecute: boolean }> {
    // Check if admin is the requestor
    const requestResult = await executeStatement(
      `SELECT mar.*, map.self_approval_allowed
       FROM migration_approval_requests mar
       LEFT JOIN migration_approval_policies map ON mar.tenant_id = map.tenant_id AND mar.environment = map.environment
       WHERE mar.id = $1`,
      [{ name: 'requestId', value: { stringValue: requestId } }]
    );

    if (requestResult.rows.length === 0) {
      throw new Error('Request not found');
    }

    const request = requestResult.rows[0] as Record<string, unknown>;
    
    if (String(request.requested_by) === adminId && !request.self_approval_allowed) {
      throw new Error('Self-approval is not allowed');
    }

    if (request.status !== 'pending') {
      throw new Error(`Request is already ${request.status}`);
    }

    // Check for duplicate approval
    const existingResult = await executeStatement(
      `SELECT id FROM migration_approvals WHERE request_id = $1 AND admin_id = $2`,
      [
        { name: 'requestId', value: { stringValue: requestId } },
        { name: 'adminId', value: { stringValue: adminId } },
      ]
    );

    if (existingResult.rows.length > 0) {
      throw new Error('You have already submitted a decision for this request');
    }

    // Insert approval (trigger will update request)
    await executeStatement(
      `INSERT INTO migration_approvals (request_id, admin_id, decision, reason)
       VALUES ($1, $2, $3, $4)`,
      [
        { name: 'requestId', value: { stringValue: requestId } },
        { name: 'adminId', value: { stringValue: adminId } },
        { name: 'decision', value: { stringValue: decision } },
        { name: 'reason', value: reason ? { stringValue: reason } : { isNull: true } },
      ]
    );

    // Get updated request status
    const updatedResult = await executeStatement(
      `SELECT status, approvals_received, approvals_required FROM migration_approval_requests WHERE id = $1`,
      [{ name: 'requestId', value: { stringValue: requestId } }]
    );

    const updated = updatedResult.rows[0] as Record<string, unknown>;
    const newStatus = updated.status as ApprovalStatus;
    const canExecute = newStatus === 'approved';

    return { success: true, requestStatus: newStatus, canExecute };
  }

  async executeRequest(requestId: string, adminId: string): Promise<{ success: boolean; executionTimeMs: number; error?: string }> {
    const requestResult = await executeStatement(
      `SELECT id, tenant_id, migration_name, migration_version, migration_sql, 
              migration_checksum, rollback_sql, environment, status, reason,
              approvals_required, approvals_received, requested_by, requested_at
       FROM migration_approval_requests WHERE id = $1`,
      [{ name: 'requestId', value: { stringValue: requestId } }]
    );

    if (requestResult.rows.length === 0) {
      throw new Error('Request not found');
    }

    const request = requestResult.rows[0] as Record<string, unknown>;

    if (request.status !== 'approved') {
      throw new Error(`Request must be approved before execution. Current status: ${request.status}`);
    }

    const startTime = Date.now();

    try {
      // Get the migration SQL from the request
      const migrationSql = request.migration_sql as string;
      
      if (!migrationSql || migrationSql.trim().length === 0) {
        throw new Error('Migration SQL is empty');
      }

      // Execute the migration SQL
      await executeStatement(migrationSql, []);

      const executionTimeMs = Date.now() - startTime;

      // Mark as executed
      await executeStatement(
        `UPDATE migration_approval_requests 
         SET status = 'executed', executed_at = NOW(), executed_by = $2, execution_time_ms = $3, updated_at = NOW()
         WHERE id = $1`,
        [
          { name: 'requestId', value: { stringValue: requestId } },
          { name: 'executedBy', value: { stringValue: adminId } },
          { name: 'executionTimeMs', value: { longValue: executionTimeMs } },
        ]
      );

      // Record in migration history
      await executeStatement(
        `INSERT INTO migration_history (migration_name, migration_version, executed_at, execution_time_ms, executed_by)
         VALUES ($1, $2, NOW(), $3, $4)
         ON CONFLICT (migration_name, migration_version) DO NOTHING`,
        [
          { name: 'migrationName', value: { stringValue: request.migration_name as string } },
          { name: 'migrationVersion', value: { stringValue: request.migration_version as string } },
          { name: 'executionTimeMs', value: { longValue: executionTimeMs } },
          { name: 'executedBy', value: { stringValue: adminId } },
        ]
      );

      return { success: true, executionTimeMs };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await executeStatement(
        `UPDATE migration_approval_requests 
         SET status = 'failed', execution_error = $2, execution_time_ms = $3, updated_at = NOW()
         WHERE id = $1`,
        [
          { name: 'requestId', value: { stringValue: requestId } },
          { name: 'error', value: { stringValue: errorMessage } },
          { name: 'executionTimeMs', value: { longValue: executionTimeMs } },
        ]
      );

      return { success: false, executionTimeMs, error: errorMessage };
    }
  }

  async getRequest(requestId: string): Promise<ApprovalRequest | null> {
    const result = await executeStatement(
      `SELECT * FROM migration_approval_requests WHERE id = $1`,
      [{ name: 'requestId', value: { stringValue: requestId } }]
    );

    if (result.rows.length === 0) return null;

    const r = result.rows[0] as Record<string, unknown>;
    return {
      id: String(r.id),
      migrationName: String(r.migration_name),
      migrationVersion: String(r.migration_version),
      environment: r.environment as Environment,
      status: r.status as ApprovalStatus,
      approvalsRequired: parseInt(String(r.approvals_required), 10),
      approvalsReceived: parseInt(String(r.approvals_received), 10),
      requestedBy: String(r.requested_by),
      requestedAt: new Date(String(r.requested_at)),
    };
  }

  async getPendingRequests(tenantId: string): Promise<ApprovalRequest[]> {
    const result = await executeStatement(
      `SELECT * FROM migration_approval_requests WHERE tenant_id = $1 AND status = 'pending' ORDER BY requested_at DESC`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return result.rows.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: String(r.id),
        migrationName: String(r.migration_name),
        migrationVersion: String(r.migration_version),
        environment: r.environment as Environment,
        status: r.status as ApprovalStatus,
        approvalsRequired: parseInt(String(r.approvals_required), 10),
        approvalsReceived: parseInt(String(r.approvals_received), 10),
        requestedBy: String(r.requested_by),
        requestedAt: new Date(String(r.requested_at)),
      };
    });
  }

  async getApprovals(requestId: string): Promise<unknown[]> {
    const result = await executeStatement(
      `SELECT * FROM migration_approvals WHERE request_id = $1 ORDER BY reviewed_at`,
      [{ name: 'requestId', value: { stringValue: requestId } }]
    );
    return result.rows;
  }

  async cancelRequest(requestId: string): Promise<void> {
    await executeStatement(
      `UPDATE migration_approval_requests SET status = 'cancelled', updated_at = NOW() WHERE id = $1 AND status = 'pending'`,
      [{ name: 'requestId', value: { stringValue: requestId } }]
    );
  }

  async setPolicy(
    tenantId: string,
    environment: Environment,
    policy: Partial<ApprovalPolicy>
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO migration_approval_policies 
       (tenant_id, environment, approvals_required, self_approval_allowed, auto_approve_development)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, environment) DO UPDATE SET
         approvals_required = COALESCE($3, migration_approval_policies.approvals_required),
         self_approval_allowed = COALESCE($4, migration_approval_policies.self_approval_allowed),
         auto_approve_development = COALESCE($5, migration_approval_policies.auto_approve_development),
         updated_at = NOW()`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'environment', value: { stringValue: environment } },
        { name: 'approvalsRequired', value: policy.approvalsRequired !== undefined ? { longValue: policy.approvalsRequired } : { isNull: true } },
        { name: 'selfApprovalAllowed', value: policy.selfApprovalAllowed !== undefined ? { booleanValue: policy.selfApprovalAllowed } : { isNull: true } },
        { name: 'autoApproveDevelopment', value: policy.autoApproveDevelopment !== undefined ? { booleanValue: policy.autoApproveDevelopment } : { isNull: true } },
      ]
    );
  }

  private async getPolicy(tenantId: string, environment: Environment): Promise<ApprovalPolicy> {
    const result = await executeStatement(
      `SELECT * FROM migration_approval_policies WHERE tenant_id = $1 AND environment = $2 AND is_active = true`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'environment', value: { stringValue: environment } },
      ]
    );

    if (result.rows.length === 0) {
      // Default policies
      return {
        approvalsRequired: environment === 'production' ? 2 : (environment === 'staging' ? 1 : 0),
        selfApprovalAllowed: false,
        autoApproveDevelopment: true,
      };
    }

    const r = result.rows[0] as Record<string, unknown>;
    return {
      approvalsRequired: parseInt(String(r.approvals_required), 10),
      selfApprovalAllowed: Boolean(r.self_approval_allowed),
      autoApproveDevelopment: Boolean(r.auto_approve_development),
    };
  }
}

export const migrationApprovalService = new MigrationApprovalService();
