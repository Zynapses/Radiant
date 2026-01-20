/**
 * RADIANT v5.0 - HITL SLA Monitor Lambda
 * 
 * Scheduled: Every minute
 * Purpose: Monitor approval SLAs, escalate expired requests, send notifications
 */

import { ScheduledHandler } from 'aws-lambda';
import { executeStatement, stringParam, longParam } from '../shared/db/client';
import { enhancedLogger } from '../shared/logging/enhanced-logger';
import { notificationService } from '../shared/services/sovereign-mesh/notification.service';

const logger = enhancedLogger;

export const handler: ScheduledHandler = async (_event): Promise<void> => {
  logger.info('Starting HITL SLA monitor');

  try {
    // Process expired requests
    const expiredCount = await processExpiredRequests();
    
    // Process requests needing escalation
    const escalatedCount = await processEscalations();
    
    // Update SLA metrics
    await updateSLAMetrics();

    logger.info('HITL SLA monitor completed', { expiredCount, escalatedCount });
  } catch (error: any) {
    logger.error('HITL SLA monitor failed', { error: error.message });
    throw error;
  }
};

async function processExpiredRequests(): Promise<number> {
  // Find expired pending requests
  const expired = await executeStatement(
    `SELECT r.id, r.queue_id, q.on_timeout_action
     FROM hitl_approval_requests r
     JOIN hitl_queue_configs q ON r.queue_id = q.id
     WHERE r.status = 'pending' AND r.expires_at < NOW()
     LIMIT 100`,
    []
  );

  const rows = expired.rows || [];
  if (rows.length === 0) {
    return 0;
  }

  let processedCount = 0;

  for (const request of rows) {
    const id = extractValue(request.id) as string;
    const action = extractValue(request.on_timeout_action) as string;

    try {
      switch (action) {
        case 'escalate':
          await escalateRequest(id);
          break;
        case 'auto_approve':
          await autoApproveRequest(id);
          break;
        case 'reject':
        default:
          await rejectRequest(id, 'Request expired');
          break;
      }
      processedCount++;
    } catch (error: any) {
      logger.warn('Failed to process expired request', { id, error: error.message });
    }
  }

  return processedCount;
}

async function processEscalations(): Promise<number> {
  // Find requests that need escalation (escalated but still pending after escalation timeout)
  const needsEscalation = await executeStatement(
    `SELECT r.id, r.escalation_level, q.max_escalation_level, q.on_escalation_exhausted
     FROM hitl_approval_requests r
     JOIN hitl_queue_configs q ON r.queue_id = q.id
     WHERE r.status = 'escalated' 
     AND r.escalated_at < NOW() - INTERVAL '30 minutes'
     LIMIT 100`,
    []
  );

  const rows = needsEscalation.rows || [];
  if (rows.length === 0) {
    return 0;
  }

  let escalatedCount = 0;

  for (const request of rows) {
    const id = extractValue(request.id) as string;
    const currentLevel = extractValue(request.escalation_level) as number;
    const maxLevel = extractValue(request.max_escalation_level) as number;
    const exhaustedAction = extractValue(request.on_escalation_exhausted) as string;

    try {
      if (currentLevel >= maxLevel) {
        // Escalation exhausted
        switch (exhaustedAction) {
          case 'auto_approve':
            await autoApproveRequest(id);
            break;
          case 'reject':
          default:
            await rejectRequest(id, 'Escalation exhausted');
            break;
        }
      } else {
        // Escalate to next level
        await escalateRequest(id);
      }
      escalatedCount++;
    } catch (error: any) {
      logger.warn('Failed to process escalation', { id, error: error.message });
    }
  }

  return escalatedCount;
}

async function escalateRequest(id: string): Promise<void> {
  // Get request details for notification
  const reqResult = await executeStatement(
    `SELECT r.tenant_id, r.escalation_level FROM hitl_approval_requests r WHERE r.id = :id`,
    [stringParam('id', id)]
  );
  const reqRow = reqResult.rows?.[0];
  const tenantId = extractValue(reqRow?.tenant_id) as string;
  const currentLevel = (extractValue(reqRow?.escalation_level) as number) || 0;

  await executeStatement(
    `UPDATE hitl_approval_requests SET
       status = 'escalated',
       escalated_at = NOW(),
       escalation_level = escalation_level + 1,
       expires_at = NOW() + INTERVAL '30 minutes'
     WHERE id = :id`,
    [stringParam('id', id)]
  );

  // Send escalation notification
  if (tenantId) {
    try {
      await notificationService.sendEscalationNotification(tenantId, id, currentLevel + 1);
    } catch (err: any) {
      logger.warn('Failed to send escalation notification', { id, error: err.message });
    }
  }
  
  logger.info('Request escalated', { id, newLevel: currentLevel + 1 });
}

async function autoApproveRequest(id: string): Promise<void> {
  await executeStatement(
    `UPDATE hitl_approval_requests SET
       status = 'auto_approved',
       resolved_at = NOW(),
       resolution_action = 'auto_approved',
       resolution_notes = 'Auto-approved due to timeout'
     WHERE id = :id`,
    [stringParam('id', id)]
  );

  // Resume associated agent execution if exists
  const result = await executeStatement(
    `SELECT agent_execution_id FROM hitl_approval_requests WHERE id = :id`,
    [stringParam('id', id)]
  );
  
  const executionId = extractValue(result.rows?.[0]?.agent_execution_id);
  if (executionId) {
    await executeStatement(
      `UPDATE agent_executions SET status = 'running' WHERE id = :executionId AND status = 'paused'`,
      [stringParam('executionId', executionId as string)]
    );
  }

  logger.info('Request auto-approved', { id });
}

async function rejectRequest(id: string, reason: string): Promise<void> {
  await executeStatement(
    `UPDATE hitl_approval_requests SET
       status = 'expired',
       resolved_at = NOW(),
       resolution_action = 'rejected',
       resolution_notes = :reason
     WHERE id = :id`,
    [stringParam('id', id), stringParam('reason', reason)]
  );

  // Cancel associated agent execution if exists
  const result = await executeStatement(
    `SELECT agent_execution_id FROM hitl_approval_requests WHERE id = :id`,
    [stringParam('id', id)]
  );
  
  const executionId = extractValue(result.rows?.[0]?.agent_execution_id);
  if (executionId) {
    await executeStatement(
      `UPDATE agent_executions SET status = 'cancelled', output_summary = :reason WHERE id = :executionId`,
      [stringParam('executionId', executionId as string), stringParam('reason', reason)]
    );
  }

  logger.info('Request rejected', { id, reason });
}

async function updateSLAMetrics(): Promise<void> {
  // Update daily SLA metrics for each queue
  await executeStatement(
    `INSERT INTO hitl_sla_metrics (queue_id, metric_date, total_requests, approved_count, rejected_count, 
      expired_count, escalated_count, avg_resolution_time, within_sla_count, sla_breach_count)
     SELECT 
       r.queue_id,
       CURRENT_DATE,
       COUNT(*),
       COUNT(*) FILTER (WHERE r.status = 'approved'),
       COUNT(*) FILTER (WHERE r.status = 'rejected'),
       COUNT(*) FILTER (WHERE r.status = 'expired'),
       COUNT(*) FILTER (WHERE r.status = 'escalated'),
       AVG(EXTRACT(EPOCH FROM (r.resolved_at - r.created_at)) / 60)::INTEGER,
       COUNT(*) FILTER (WHERE r.resolved_at IS NOT NULL AND r.resolved_at <= r.expires_at),
       COUNT(*) FILTER (WHERE r.resolved_at IS NOT NULL AND r.resolved_at > r.expires_at)
     FROM hitl_approval_requests r
     WHERE DATE(r.created_at) = CURRENT_DATE
     GROUP BY r.queue_id
     ON CONFLICT (queue_id, metric_date) DO UPDATE SET
       total_requests = EXCLUDED.total_requests,
       approved_count = EXCLUDED.approved_count,
       rejected_count = EXCLUDED.rejected_count,
       expired_count = EXCLUDED.expired_count,
       escalated_count = EXCLUDED.escalated_count,
       avg_resolution_time = EXCLUDED.avg_resolution_time,
       within_sla_count = EXCLUDED.within_sla_count,
       sla_breach_count = EXCLUDED.sla_breach_count`,
    []
  );
}

function extractValue(field: unknown): unknown {
  if (!field) return null;
  if (typeof field === 'object') {
    if ('stringValue' in field) return (field as { stringValue: string }).stringValue;
    if ('longValue' in field) return (field as { longValue: number }).longValue;
  }
  return field;
}
