/**
 * RADIANT v6.0.4 - Human Oversight Service
 * EU AI Act Article 14 compliance for high-risk domains
 * 
 * Key Features:
 * - 7-day auto-reject rule ("Silence ≠ Consent")
 * - 3-day escalation threshold
 * - High-risk domain detection (healthcare, financial, legal)
 */

import { v4 as uuidv4 } from 'uuid';
import { executeStatement } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { brainConfigService } from './brain-config.service';
import {
  type OversightQueueItem,
  type OversightStatus,
  type OversightDecision,
  type OversightQueueStats,
  type HighRiskDomain,
  HIGH_RISK_DOMAINS,
} from '@radiant/shared';

// =============================================================================
// Oversight Service
// =============================================================================

class OversightService {
  // ===========================================================================
  // Submit to Oversight
  // ===========================================================================

  /**
   * Submit an insight to human oversight queue
   */
  async submitToOversight(
    insightId: string,
    insightJson: Record<string, unknown>,
    domain: HighRiskDomain | 'general',
    tenantId: string
  ): Promise<OversightQueueItem> {
    const timeoutDays = await brainConfigService.getNumber('OVERSIGHT_TIMEOUT_DAYS', 7);

    const item: OversightQueueItem = {
      id: uuidv4(),
      insightId,
      tenantId,
      insightJson,
      domain,
      status: 'pending',
      assignedTo: null,
      createdAt: new Date(),
      reviewedAt: null,
      escalatedAt: null,
      expiresAt: new Date(Date.now() + timeoutDays * 24 * 60 * 60 * 1000),
    };

    try {
      await executeStatement(
        `INSERT INTO oversight_queue 
         (id, insight_id, tenant_id, insight_json, domain, status, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          { name: 'id', value: { stringValue: item.id } },
          { name: 'insightId', value: { stringValue: item.insightId } },
          { name: 'tenantId', value: { stringValue: item.tenantId } },
          { name: 'insightJson', value: { stringValue: JSON.stringify(item.insightJson) } },
          { name: 'domain', value: { stringValue: item.domain } },
          { name: 'status', value: { stringValue: item.status } },
          { name: 'expiresAt', value: { stringValue: item.expiresAt.toISOString() } },
        ]
      );

      logger.info('Submitted to oversight', {
        insightId,
        domain,
        tenantId,
        expiresAt: item.expiresAt,
      });

      return item;
    } catch (error) {
      logger.error(`Failed to submit to oversight: ${String(error)}`);
      throw error;
    }
  }

  /**
   * Check if domain requires oversight
   */
  requiresOversight(domain: string): boolean {
    return HIGH_RISK_DOMAINS.includes(domain as HighRiskDomain);
  }

  // ===========================================================================
  // Review Actions
  // ===========================================================================

  /**
   * Approve an oversight item
   */
  async approve(
    insightId: string,
    reviewerId: string,
    reasoning: string,
    attestation: string
  ): Promise<OversightDecision> {
    return this.recordDecision(insightId, reviewerId, 'approved', reasoning, attestation);
  }

  /**
   * Reject an oversight item
   */
  async reject(
    insightId: string,
    reviewerId: string,
    reasoning: string,
    attestation: string
  ): Promise<OversightDecision> {
    return this.recordDecision(insightId, reviewerId, 'rejected', reasoning, attestation);
  }

  /**
   * Modify an oversight item
   */
  async modify(
    insightId: string,
    reviewerId: string,
    reasoning: string,
    modifiedInsight: string,
    attestation: string
  ): Promise<OversightDecision> {
    return this.recordDecision(insightId, reviewerId, 'modified', reasoning, attestation, modifiedInsight);
  }

  /**
   * Record a decision
   */
  private async recordDecision(
    insightId: string,
    reviewerId: string,
    decision: 'approved' | 'rejected' | 'modified',
    reasoning: string,
    attestation: string,
    modifiedInsight?: string
  ): Promise<OversightDecision> {
    // Get original insight
    const original = await this.getByInsightId(insightId);
    if (!original) {
      throw new Error(`Insight ${insightId} not found in oversight queue`);
    }

    const decisionRecord: OversightDecision = {
      id: uuidv4(),
      insightId,
      reviewerId,
      decision,
      reasoning,
      originalInsight: JSON.stringify(original.insightJson),
      modifiedInsight: modifiedInsight || null,
      attestation,
      reviewedAt: new Date(),
    };

    try {
      // Update queue item
      await executeStatement(
        `UPDATE oversight_queue 
         SET status = $1, reviewed_at = NOW()
         WHERE insight_id = $2`,
        [
          { name: 'status', value: { stringValue: decision } },
          { name: 'insightId', value: { stringValue: insightId } },
        ]
      );

      // Record decision
      await executeStatement(
        `INSERT INTO oversight_decisions 
         (id, insight_id, reviewer_id, decision, reasoning, original_insight, modified_insight, attestation)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          { name: 'id', value: { stringValue: decisionRecord.id } },
          { name: 'insightId', value: { stringValue: decisionRecord.insightId } },
          { name: 'reviewerId', value: { stringValue: decisionRecord.reviewerId } },
          { name: 'decision', value: { stringValue: decisionRecord.decision } },
          { name: 'reasoning', value: { stringValue: decisionRecord.reasoning } },
          { name: 'originalInsight', value: { stringValue: decisionRecord.originalInsight } },
          { name: 'modifiedInsight', value: decisionRecord.modifiedInsight ? { stringValue: decisionRecord.modifiedInsight } : { isNull: true } },
          { name: 'attestation', value: { stringValue: decisionRecord.attestation } },
        ]
      );

      logger.info('Oversight decision recorded', {
        insightId,
        decision,
        reviewerId,
      });

      return decisionRecord;
    } catch (error) {
      logger.error(`Failed to record decision: ${String(error)}`);
      throw error;
    }
  }

  /**
   * Assign item to reviewer
   */
  async assignToReviewer(insightId: string, reviewerId: string): Promise<void> {
    try {
      await executeStatement(
        `UPDATE oversight_queue 
         SET assigned_to = $1
         WHERE insight_id = $2 AND status = 'pending'`,
        [
          { name: 'reviewerId', value: { stringValue: reviewerId } },
          { name: 'insightId', value: { stringValue: insightId } },
        ]
      );
    } catch (error) {
      logger.error(`Failed to assign reviewer: ${String(error)}`);
      throw error;
    }
  }

  // ===========================================================================
  // Timeout Processing
  // ===========================================================================

  /**
   * Process oversight timeouts - CRITICAL
   * "Silence ≠ Consent" - auto-reject after 7 days
   */
  async processTimeouts(): Promise<{ expired: number; escalated: number }> {
    const [timeoutDays, escalationDays] = await Promise.all([
      brainConfigService.getNumber('OVERSIGHT_TIMEOUT_DAYS', 7),
      brainConfigService.getNumber('OVERSIGHT_ESCALATION_DAYS', 3),
    ]);

    let expired = 0;
    let escalated = 0;

    try {
      // Auto-reject expired items (7-day rule)
      const expiredResult = await executeStatement(
        `UPDATE oversight_queue 
         SET status = 'expired'
         WHERE status IN ('pending', 'escalated') 
         AND expires_at < NOW()
         RETURNING id`,
        []
      );
      expired = expiredResult.rowCount || 0;

      // Escalate items approaching timeout (3-day threshold)
      const escalationThreshold = new Date(Date.now() - escalationDays * 24 * 60 * 60 * 1000);
      const escalateResult = await executeStatement(
        `UPDATE oversight_queue 
         SET status = 'escalated', escalated_at = NOW()
         WHERE status = 'pending' 
         AND created_at < $1
         AND expires_at >= NOW()
         RETURNING id`,
        [{ name: 'threshold', value: { stringValue: escalationThreshold.toISOString() } }]
      );
      escalated = escalateResult.rowCount || 0;

      logger.info('Oversight timeouts processed', { expired, escalated });
    } catch (error) {
      logger.error(`Failed to process timeouts: ${String(error)}`);
    }

    return { expired, escalated };
  }

  // ===========================================================================
  // Queries
  // ===========================================================================

  /**
   * Get oversight item by insight ID
   */
  async getByInsightId(insightId: string): Promise<OversightQueueItem | null> {
    try {
      const result = await executeStatement(
        `SELECT id, insight_id, tenant_id, insight_json, domain, status, 
                assigned_to, created_at, reviewed_at, escalated_at, expires_at
         FROM oversight_queue
         WHERE insight_id = $1`,
        [{ name: 'insightId', value: { stringValue: insightId } }]
      );

      if (result.rows.length > 0) {
        return this.mapRowToItem(result.rows[0] as Record<string, unknown>);
      }
    } catch (error) {
      logger.error(`Failed to get oversight item: ${String(error)}`);
    }

    return null;
  }

  /**
   * Get pending items for a tenant
   */
  async getPendingItems(tenantId: string, limit: number = 50): Promise<OversightQueueItem[]> {
    try {
      const result = await executeStatement(
        `SELECT id, insight_id, tenant_id, insight_json, domain, status,
                assigned_to, created_at, reviewed_at, escalated_at, expires_at
         FROM oversight_queue
         WHERE tenant_id = $1 AND status IN ('pending', 'escalated')
         ORDER BY 
           CASE status WHEN 'escalated' THEN 0 ELSE 1 END,
           created_at ASC
         LIMIT $2`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'limit', value: { longValue: limit } },
        ]
      );

      return result.rows.map(row => this.mapRowToItem(row as Record<string, unknown>));
    } catch (error) {
      logger.error(`Failed to get pending items: ${String(error)}`);
      return [];
    }
  }

  /**
   * Get items assigned to a reviewer
   */
  async getAssignedItems(reviewerId: string): Promise<OversightQueueItem[]> {
    try {
      const result = await executeStatement(
        `SELECT id, insight_id, tenant_id, insight_json, domain, status,
                assigned_to, created_at, reviewed_at, escalated_at, expires_at
         FROM oversight_queue
         WHERE assigned_to = $1 AND status IN ('pending', 'escalated')
         ORDER BY expires_at ASC`,
        [{ name: 'reviewerId', value: { stringValue: reviewerId } }]
      );

      return result.rows.map(row => this.mapRowToItem(row as Record<string, unknown>));
    } catch (error) {
      logger.error(`Failed to get assigned items: ${String(error)}`);
      return [];
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(tenantId?: string): Promise<OversightQueueStats> {
    try {
      let whereClause = '';
      const params: Array<{ name: string; value: { stringValue: string } }> = [];

      if (tenantId) {
        whereClause = 'WHERE tenant_id = $1';
        params.push({ name: 'tenantId', value: { stringValue: tenantId } });
      }

      const result = await executeStatement(
        `SELECT 
           COUNT(*) FILTER (WHERE status = 'pending') as pending,
           COUNT(*) FILTER (WHERE status = 'escalated') as escalated,
           COUNT(*) FILTER (WHERE status = 'approved' AND reviewed_at > NOW() - INTERVAL '24 hours') as approved_today,
           COUNT(*) FILTER (WHERE status = 'rejected' AND reviewed_at > NOW() - INTERVAL '24 hours') as rejected_today,
           COUNT(*) FILTER (WHERE status = 'expired' AND expires_at > NOW() - INTERVAL '24 hours') as expired_today,
           MIN(created_at) FILTER (WHERE status = 'pending') as oldest_pending,
           domain,
           COUNT(*) as domain_count
         FROM oversight_queue
         ${whereClause}
         GROUP BY domain`,
        params
      );

      let pending = 0;
      let escalated = 0;
      let approvedToday = 0;
      let rejectedToday = 0;
      let expiredToday = 0;
      let oldestPendingAt: Date | null = null;
      const byDomain: Record<string, number> = {};

      for (const row of result.rows) {
        const r = row as Record<string, unknown>;
        pending += Number(r.pending) || 0;
        escalated += Number(r.escalated) || 0;
        approvedToday += Number(r.approved_today) || 0;
        rejectedToday += Number(r.rejected_today) || 0;
        expiredToday += Number(r.expired_today) || 0;
        
        if (r.oldest_pending && (!oldestPendingAt || new Date(r.oldest_pending as string) < oldestPendingAt)) {
          oldestPendingAt = new Date(r.oldest_pending as string);
        }
        
        byDomain[r.domain as string] = Number(r.domain_count) || 0;
      }

      return {
        pending,
        escalated,
        approvedToday,
        rejectedToday,
        expiredToday,
        avgReviewTimeMs: 0, // Would need separate query
        oldestPendingAt,
        byDomain,
        byReviewer: [], // Would need separate query
      };
    } catch (error) {
      logger.error(`Failed to get queue stats: ${String(error)}`);
      return {
        pending: 0,
        escalated: 0,
        approvedToday: 0,
        rejectedToday: 0,
        expiredToday: 0,
        avgReviewTimeMs: 0,
        oldestPendingAt: null,
        byDomain: {},
        byReviewer: [],
      };
    }
  }

  /**
   * Map database row to OversightQueueItem
   */
  private mapRowToItem(row: Record<string, unknown>): OversightQueueItem {
    return {
      id: row.id as string,
      insightId: row.insight_id as string,
      tenantId: row.tenant_id as string,
      insightJson: JSON.parse(row.insight_json as string),
      domain: row.domain as HighRiskDomain | 'general',
      status: row.status as OversightStatus,
      assignedTo: row.assigned_to as string | null,
      createdAt: new Date(row.created_at as string),
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at as string) : null,
      escalatedAt: row.escalated_at ? new Date(row.escalated_at as string) : null,
      expiresAt: new Date(row.expires_at as string),
    };
  }
}

// Export singleton instance
export const oversightService = new OversightService();

// Export class for testing
export { OversightService };
