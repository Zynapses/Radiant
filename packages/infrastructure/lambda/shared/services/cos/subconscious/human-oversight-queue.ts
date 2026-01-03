/**
 * HumanOversightQueue v6.0.5
 * 
 * PURPOSE: EU AI Act Article 14 compliance - human oversight for high-risk AI
 * 
 * WORKFLOW:
 *   pending → 3 days → escalated → 7 days → auto_rejected
 * 
 * Gemini mandate: "Silence ≠ Consent" (FDA/SOC 2 requirement)
 *   - Items that aren't reviewed within 7 days are AUTO-REJECTED
 *   - This ensures no AI decisions slip through without human review
 *   - Audit trail maintained for compliance
 * 
 * Location: packages/infrastructure/lambda/shared/services/cos/subconscious/human-oversight-queue.ts
 */

import { query } from '../../database';
import { 
  HumanOversightItem, 
  OversightStatus, 
  OversightItemType,
  HIGH_RISK_DOMAINS,
  OVERSIGHT_DEFAULTS,
} from '../types';

export interface SubmitOversightParams {
  tenantId: string;
  itemType: OversightItemType;
  content: string;
  context: Record<string, unknown>;
  escalateAfterDays?: number;
  autoRejectAfterDays?: number;
}

export interface OversightDecision {
  itemId: string;
  decision: 'approved' | 'rejected';
  reviewedBy: string;
  reviewNotes?: string;
}

export interface TimeoutProcessingResult {
  escalated: number;
  autoRejected: number;
}

/**
 * HumanOversightQueue - Human-in-the-loop for high-risk AI decisions
 * 
 * Implements EU AI Act Article 14 requirements:
 * - High-risk AI systems require human oversight
 * - Humans can intervene, override, or stop AI decisions
 * - Decisions are logged for auditability
 * 
 * Key behaviors:
 * - Items pending > 3 days → escalated to senior reviewer
 * - Items pending > 7 days → auto-rejected (Silence ≠ Consent)
 * - All decisions logged with reviewer identity
 */
export class HumanOversightQueue {
  private readonly DEFAULT_ESCALATE_DAYS = OVERSIGHT_DEFAULTS.escalateAfterDays;
  private readonly DEFAULT_AUTO_REJECT_DAYS = OVERSIGHT_DEFAULTS.autoRejectAfterDays;
  
  /**
   * Submit item for human oversight review
   * 
   * @param params - Item details
   * @returns Created oversight item
   */
  async submit(params: SubmitOversightParams): Promise<HumanOversightItem> {
    const id = crypto.randomUUID();
    const now = new Date();
    
    const item: HumanOversightItem = {
      id,
      tenantId: params.tenantId,
      itemType: params.itemType,
      content: params.content,
      context: params.context,
      status: 'pending_approval',
      createdAt: now,
      escalateAfterDays: params.escalateAfterDays ?? this.DEFAULT_ESCALATE_DAYS,
      autoRejectAfterDays: params.autoRejectAfterDays ?? this.DEFAULT_AUTO_REJECT_DAYS,
    };
    
    await query(
      `INSERT INTO cos_human_oversight 
       (id, tenant_id, item_type, content, context, status, 
        escalate_after_days, auto_reject_after_days, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id, params.tenantId, params.itemType, params.content, 
        JSON.stringify(params.context), 'pending_approval',
        item.escalateAfterDays, item.autoRejectAfterDays, now
      ]
    );
    
    console.log(`[COS Oversight] Item submitted: ${id} (type: ${params.itemType})`);
    return item;
  }
  
  /**
   * Record human decision on an oversight item
   */
  async recordDecision(decision: OversightDecision): Promise<HumanOversightItem> {
    const status: OversightStatus = decision.decision === 'approved' ? 'approved' : 'rejected';
    
    await query(
      `UPDATE cos_human_oversight 
       SET status = $1, reviewed_at = NOW(), reviewed_by = $2, review_notes = $3
       WHERE id = $4`,
      [status, decision.reviewedBy, decision.reviewNotes || null, decision.itemId]
    );
    
    // Log audit trail
    await this.logAuditEvent(decision.itemId, status, decision.reviewedBy, decision.reviewNotes);
    
    console.log(`[COS Oversight] Decision recorded: ${decision.itemId} → ${status} by ${decision.reviewedBy}`);
    
    return this.getItem(decision.itemId);
  }
  
  /**
   * Process timeout escalations and auto-rejections
   * 
   * CRITICAL: "Silence ≠ Consent" - items not reviewed are rejected
   * This is required for FDA/SOC 2 compliance.
   * 
   * @returns Count of escalated and auto-rejected items
   */
  async processTimeouts(): Promise<TimeoutProcessingResult> {
    // Escalate items pending > escalate_after_days
    const escalatedResult = await query(
      `UPDATE cos_human_oversight 
       SET status = 'escalated'
       WHERE status = 'pending_approval' 
       AND created_at < NOW() - (escalate_after_days || ' days')::INTERVAL
       RETURNING id`
    );
    
    // Auto-reject items pending > auto_reject_after_days
    // Gemini: "Silence ≠ Consent" - unapproved items must be rejected
    const rejectedResult = await query(
      `UPDATE cos_human_oversight 
       SET status = 'auto_rejected', 
           review_notes = 'Auto-rejected: Silence ≠ Consent policy (no review within timeout)'
       WHERE status IN ('pending_approval', 'escalated') 
       AND created_at < NOW() - (auto_reject_after_days || ' days')::INTERVAL
       RETURNING id`
    );
    
    const escalatedCount = escalatedResult.rowCount || 0;
    const autoRejectedCount = rejectedResult.rowCount || 0;
    
    if (escalatedCount > 0) {
      console.log(`[COS Oversight] Escalated ${escalatedCount} items`);
    }
    
    if (autoRejectedCount > 0) {
      console.warn(`[COS Oversight] Auto-rejected ${autoRejectedCount} items (Silence ≠ Consent)`);
      
      // Log each auto-rejection for audit
      for (const row of rejectedResult.rows) {
        await this.logAuditEvent(row.id, 'auto_rejected', 'SYSTEM', 'Silence ≠ Consent timeout');
      }
    }
    
    return { escalated: escalatedCount, autoRejected: autoRejectedCount };
  }
  
  /**
   * Check if a domain requires human oversight
   */
  requiresOversight(domain: string): boolean {
    const normalized = domain.toLowerCase();
    return HIGH_RISK_DOMAINS.includes(normalized as typeof HIGH_RISK_DOMAINS[number]) ||
           normalized.includes('health') ||
           normalized.includes('medical') ||
           normalized.includes('financial') ||
           normalized.includes('legal');
  }
  
  /**
   * Get pending items for a tenant
   */
  async getPendingItems(tenantId: string): Promise<HumanOversightItem[]> {
    const result = await query(
      `SELECT * FROM cos_human_oversight 
       WHERE tenant_id = $1 AND status IN ('pending_approval', 'escalated')
       ORDER BY 
         CASE status WHEN 'escalated' THEN 0 ELSE 1 END,
         created_at ASC`,
      [tenantId]
    );
    
    return result.rows.map(this.rowToItem);
  }
  
  /**
   * Get escalated items (priority queue)
   */
  async getEscalatedItems(tenantId?: string): Promise<HumanOversightItem[]> {
    const whereClause = tenantId 
      ? 'WHERE tenant_id = $1 AND status = $2'
      : 'WHERE status = $1';
    const params = tenantId ? [tenantId, 'escalated'] : ['escalated'];
    
    const result = await query(
      `SELECT * FROM cos_human_oversight ${whereClause} ORDER BY created_at ASC`,
      params
    );
    
    return result.rows.map(this.rowToItem);
  }
  
  /**
   * Get item by ID
   */
  async getItem(itemId: string): Promise<HumanOversightItem> {
    const result = await query(
      `SELECT * FROM cos_human_oversight WHERE id = $1`,
      [itemId]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`Oversight item not found: ${itemId}`);
    }
    
    return this.rowToItem(result.rows[0]);
  }
  
  /**
   * Get oversight history for audit
   */
  async getHistory(params: {
    tenantId?: string;
    status?: OversightStatus;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<HumanOversightItem[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;
    
    if (params.tenantId) {
      conditions.push(`tenant_id = $${paramIndex++}`);
      values.push(params.tenantId);
    }
    if (params.status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(params.status);
    }
    if (params.startDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      values.push(params.startDate);
    }
    if (params.endDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      values.push(params.endDate);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitClause = params.limit ? `LIMIT ${params.limit}` : 'LIMIT 1000';
    
    const result = await query(
      `SELECT * FROM cos_human_oversight ${whereClause} ORDER BY created_at DESC ${limitClause}`,
      values
    );
    
    return result.rows.map(this.rowToItem);
  }
  
  /**
   * Get queue statistics
   */
  async getStats(tenantId?: string): Promise<{
    pending: number;
    escalated: number;
    approved: number;
    rejected: number;
    autoRejected: number;
    avgReviewTimeHours: number;
    oldestPendingDays: number;
  }> {
    const whereClause = tenantId ? 'WHERE tenant_id = $1' : '';
    const params = tenantId ? [tenantId] : [];
    
    const result = await query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'pending_approval') as pending,
        COUNT(*) FILTER (WHERE status = 'escalated') as escalated,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE status = 'auto_rejected') as auto_rejected,
        AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at)) / 3600) 
          FILTER (WHERE reviewed_at IS NOT NULL) as avg_review_hours,
        MAX(EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400) 
          FILTER (WHERE status IN ('pending_approval', 'escalated')) as oldest_pending_days
       FROM cos_human_oversight ${whereClause}`,
      params
    );
    
    const row = result.rows[0];
    return {
      pending: parseInt(row.pending) || 0,
      escalated: parseInt(row.escalated) || 0,
      approved: parseInt(row.approved) || 0,
      rejected: parseInt(row.rejected) || 0,
      autoRejected: parseInt(row.auto_rejected) || 0,
      avgReviewTimeHours: parseFloat(row.avg_review_hours) || 0,
      oldestPendingDays: parseFloat(row.oldest_pending_days) || 0,
    };
  }
  
  /**
   * Log audit event
   */
  private async logAuditEvent(
    itemId: string, 
    action: string, 
    actor: string, 
    notes?: string
  ): Promise<void> {
    await query(
      `INSERT INTO cos_oversight_audit_log 
       (id, oversight_item_id, action, actor, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [crypto.randomUUID(), itemId, action, actor, notes || null]
    );
  }
  
  private rowToItem(row: Record<string, unknown>): HumanOversightItem {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      itemType: row.item_type as OversightItemType,
      content: row.content as string,
      context: JSON.parse(row.context as string || '{}'),
      status: row.status as OversightStatus,
      createdAt: new Date(row.created_at as string),
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at as string) : undefined,
      reviewedBy: row.reviewed_by as string | undefined,
      reviewNotes: row.review_notes as string | undefined,
      escalateAfterDays: row.escalate_after_days as number,
      autoRejectAfterDays: row.auto_reject_after_days as number,
    };
  }
}

/**
 * Singleton instance
 */
export const humanOversightQueue = new HumanOversightQueue();
