/**
 * Cato HITL Integration Service
 * 
 * Extension to CatoSafetyPipeline for Mission Control HITL.
 * Creates HITL decisions from Cato epistemic recovery failures.
 */

import { Redis } from 'ioredis';
import { Client } from 'pg';

// ============================================================================
// TYPES
// ============================================================================

export interface HitlEscalationResult {
  escalated: boolean;
  decisionId?: string;
  reason: string;
}

export interface EscalateToHitlParams {
  tenantId: string;
  sessionId: string;
  userId: string;
  catoEscalationId: string;
  domain: 'medical' | 'financial' | 'legal' | 'general';
  question: string;
  context: Record<string, unknown>;
  flyteExecutionId: string;
  flyteNodeId: string;
  recoveryAttempt: number;
}

export interface SyncResolutionParams {
  decisionId: string;
  catoEscalationId: string;
  resolution: string;
  guidance: string;
  resolvedBy: string;
}

interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

// ============================================================================
// DOMAIN TIMEOUTS
// ============================================================================

const DOMAIN_TIMEOUTS: Record<string, number> = {
  medical: 300,
  financial: 600,
  legal: 900,
  general: 1800,
};

// ============================================================================
// SERVICE
// ============================================================================

export class CatoHitlIntegration {
  constructor(
    private readonly redis: Redis,
    private readonly db: Client,
    private readonly logger: Logger
  ) {}

  /**
   * Called by EpistemicRecoveryService after 3 failed attempts.
   * Creates a HITL decision and links to Cato escalation.
   */
  async escalateToHitl(params: EscalateToHitlParams): Promise<HitlEscalationResult> {
    const configResult = await this.db.query(
      `SELECT default_timeout_seconds FROM decision_domain_config 
       WHERE (tenant_id = $1 OR tenant_id IS NULL) AND domain = $2
       ORDER BY tenant_id NULLS LAST LIMIT 1`,
      [params.tenantId, params.domain]
    );

    const timeoutSeconds = configResult.rows[0]?.default_timeout_seconds ?? DOMAIN_TIMEOUTS[params.domain] ?? 1800;
    const expiresAt = new Date(Date.now() + timeoutSeconds * 1000).toISOString();

    const result = await this.db.query(
      `INSERT INTO pending_decisions 
       (tenant_id, session_id, question, context, domain, urgency, 
        timeout_seconds, expires_at, flyte_execution_id, flyte_node_id,
        cato_escalation_id, cato_session_id, epistemic_recovery_attempt)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        params.tenantId,
        params.sessionId,
        params.question,
        JSON.stringify(params.context),
        params.domain,
        params.domain === 'medical' ? 'critical' : 'high',
        timeoutSeconds,
        expiresAt,
        params.flyteExecutionId,
        params.flyteNodeId,
        params.catoEscalationId,
        params.sessionId,
        params.recoveryAttempt,
      ]
    );

    const decisionId = result.rows[0].id;

    await this.redis.publish(
      `decision_pending:${params.tenantId}`,
      JSON.stringify({
        decisionId,
        question: params.question,
        domain: params.domain,
        urgency: params.domain === 'medical' ? 'critical' : 'high',
        source: 'cato_epistemic_recovery',
        recoveryAttempt: params.recoveryAttempt,
        timestamp: new Date().toISOString(),
      })
    );

    this.logger.info('HITL escalation created from Cato', {
      decisionId,
      catoEscalationId: params.catoEscalationId,
      domain: params.domain,
      recoveryAttempt: params.recoveryAttempt,
    });

    return {
      escalated: true,
      decisionId,
      reason: `Epistemic recovery failed after ${params.recoveryAttempt} attempts`,
    };
  }

  /**
   * Called when Mission Control decision is resolved.
   * Updates the linked Cato escalation.
   */
  async syncResolutionToCato(params: SyncResolutionParams): Promise<void> {
    await this.db.query(
      `UPDATE cato_human_escalations 
       SET status = 'RESOLVED',
           human_decision = $1,
           human_response = $2,
           responded_by = $3,
           responded_at = NOW()
       WHERE id = $4`,
      [
        params.resolution.toUpperCase(),
        params.guidance,
        params.resolvedBy,
        params.catoEscalationId,
      ]
    );

    this.logger.info('Cato escalation synced with Mission Control resolution', {
      decisionId: params.decisionId,
      catoEscalationId: params.catoEscalationId,
      resolution: params.resolution,
    });
  }

  /**
   * Determine domain based on context.
   */
  determineDomain(context: Record<string, unknown>): 'medical' | 'financial' | 'legal' | 'general' {
    if (context.patientId || context.diagnosis || context.treatment || context.medicalRecord) {
      return 'medical';
    }
    if (context.accountId || context.transactionId || context.portfolio || context.investment) {
      return 'financial';
    }
    if (context.caseNumber || context.legalMatter || context.contract || context.lawsuit) {
      return 'legal';
    }
    return 'general';
  }

  /**
   * Create a Cato escalation record and immediately escalate to HITL.
   * Used when epistemic recovery exhausts all attempts.
   */
  async createCatoEscalationWithHitl(params: {
    tenantId: string;
    sessionId: string;
    userId: string;
    originalTask: string;
    rejectionHistory: unknown[];
    recoveryAttempts: number;
    lastError: string;
    flyteExecutionId: string;
    flyteNodeId: string;
    context: Record<string, unknown>;
  }): Promise<HitlEscalationResult> {
    const escalationResult = await this.db.query(
      `INSERT INTO cato_human_escalations 
       (tenant_id, session_id, escalation_reason, rejection_history, recovery_attempts, status)
       VALUES ($1, $2, $3, $4, $5, 'PENDING')
       RETURNING id`,
      [
        params.tenantId,
        params.sessionId,
        `Epistemic recovery exhausted after ${params.recoveryAttempts} attempts`,
        JSON.stringify(params.rejectionHistory),
        params.recoveryAttempts,
      ]
    );

    const catoEscalationId = escalationResult.rows[0].id;
    const domain = this.determineDomain(params.context);

    const question = `Agent requires human guidance after ${params.recoveryAttempts} failed recovery attempts.

Original task: ${params.originalTask}

Last error: ${params.lastError}

Please review and provide guidance on how to proceed.`;

    return this.escalateToHitl({
      tenantId: params.tenantId,
      sessionId: params.sessionId,
      userId: params.userId,
      catoEscalationId,
      domain,
      question,
      context: {
        rejectionHistory: params.rejectionHistory,
        recoveryAttempts: params.recoveryAttempts,
        lastError: params.lastError,
        originalTask: params.originalTask,
      },
      flyteExecutionId: params.flyteExecutionId,
      flyteNodeId: params.flyteNodeId,
      recoveryAttempt: params.recoveryAttempts,
    });
  }

  /**
   * Check if a decision should be escalated based on Cato CBF violations.
   */
  async shouldEscalateForCbfViolation(params: {
    tenantId: string;
    violationType: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }): Promise<boolean> {
    if (params.severity === 'critical') {
      return true;
    }

    const configResult = await this.db.query(
      `SELECT allow_auto_resolve FROM decision_domain_config 
       WHERE (tenant_id = $1 OR tenant_id IS NULL) AND domain = 'general'
       ORDER BY tenant_id NULLS LAST LIMIT 1`,
      [params.tenantId]
    );

    const allowAutoResolve = configResult.rows[0]?.allow_auto_resolve ?? false;
    return !allowAutoResolve && params.severity === 'high';
  }
}

export function createCatoHitlIntegration(
  redis: Redis,
  db: Client,
  logger: Logger
): CatoHitlIntegration {
  return new CatoHitlIntegration(redis, db, logger);
}
