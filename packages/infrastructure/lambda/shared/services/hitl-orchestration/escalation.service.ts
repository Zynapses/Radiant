/**
 * RADIANT v5.33.0 - Escalation Chain Service
 * 
 * Manages configurable multi-level escalation paths for HITL requests.
 * Supports user → manager → auto-resolution patterns with flexible rules.
 */

import { executeStatement, stringParam, longParam } from '../../db/client';
import { logger } from '../../utils/logger';
import { notificationService } from '../sovereign-mesh/notification.service';

// Using enhanced logger from utils

// ============================================================================
// TYPES
// ============================================================================

export interface EscalationLevel {
  level: number;
  assignees: EscalationAssignee[];
  timeoutMinutes: number;
  notificationConfig: {
    email: boolean;
    slack: boolean;
    inApp: boolean;
    reminder: boolean;
    reminderIntervalMinutes?: number;
  };
}

export interface EscalationAssignee {
  type: 'user' | 'role' | 'group' | 'on_call';
  id: string;
  name?: string;
}

export interface EscalationChain {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  levels: EscalationLevel[];
  finalAction: 'reject' | 'approve' | 'use_default' | 'notify_admin';
  finalActionParams?: Record<string, unknown>;
  appliesToQueues?: string[];
  appliesToRequestTypes?: string[];
  priorityFilter?: string[];
  isActive: boolean;
}

export interface EscalationState {
  requestId: string;
  chainId: string;
  currentLevel: number;
  escalatedAt: Date;
  levelStartedAt: Date;
  notificationsSent: number;
  lastNotificationAt?: Date;
}

// ============================================================================
// CHAIN MANAGEMENT
// ============================================================================

async function createEscalationChain(
  tenantId: string,
  chain: Omit<EscalationChain, 'id' | 'tenantId' | 'isActive'>
): Promise<string> {
  const result = await executeStatement({
    sql: `
      INSERT INTO hitl_escalation_chains (
        tenant_id, name, description, levels, final_action, final_action_params,
        applies_to_queues, applies_to_request_types, priority_filter
      ) VALUES (
        :tenantId, :name, :description, :levels::jsonb, :finalAction, :finalActionParams::jsonb,
        :appliesToQueues, :appliesToRequestTypes, :priorityFilter
      )
      RETURNING id
    `,
    parameters: [
      stringParam('tenantId', tenantId),
      stringParam('name', chain.name),
      stringParam('description', chain.description || ''),
      stringParam('levels', JSON.stringify(chain.levels)),
      stringParam('finalAction', chain.finalAction),
      stringParam('finalActionParams', JSON.stringify(chain.finalActionParams || {})),
      stringParam('appliesToQueues', chain.appliesToQueues?.join(',') || ''),
      stringParam('appliesToRequestTypes', chain.appliesToRequestTypes?.join(',') || ''),
      stringParam('priorityFilter', chain.priorityFilter?.join(',') || ''),
    ],
  });

  const chainId = result.rows![0].id as string;
  logger.info('Created escalation chain', { tenantId, chainId, name: chain.name });
  return chainId;
}

async function updateEscalationChain(
  chainId: string,
  updates: Partial<Omit<EscalationChain, 'id' | 'tenantId'>>
): Promise<void> {
  const setClauses: string[] = [];
  const parameters = [stringParam('chainId', chainId)];

  if (updates.name !== undefined) {
    setClauses.push('name = :name');
    parameters.push(stringParam('name', updates.name));
  }
  if (updates.description !== undefined) {
    setClauses.push('description = :description');
    parameters.push(stringParam('description', updates.description));
  }
  if (updates.levels !== undefined) {
    setClauses.push('levels = :levels::jsonb');
    parameters.push(stringParam('levels', JSON.stringify(updates.levels)));
  }
  if (updates.finalAction !== undefined) {
    setClauses.push('final_action = :finalAction');
    parameters.push(stringParam('finalAction', updates.finalAction));
  }
  if (updates.isActive !== undefined) {
    setClauses.push('is_active = :isActive');
    parameters.push(stringParam('isActive', String(updates.isActive)));
  }

  if (setClauses.length === 0) return;

  setClauses.push('updated_at = NOW()');

  await executeStatement({
    sql: `UPDATE hitl_escalation_chains SET ${setClauses.join(', ')} WHERE id = :chainId`,
    parameters,
  });

  logger.info('Updated escalation chain', { chainId, updates: Object.keys(updates) });
}

async function getEscalationChain(chainId: string): Promise<EscalationChain | null> {
  const result = await executeStatement({
    sql: `SELECT * FROM hitl_escalation_chains WHERE id = :chainId`,
    parameters: [stringParam('chainId', chainId)],
  });

  if (!result.rows || result.rows.length === 0) return null;

  const row = result.rows[0];
  return parseChainRow(row);
}

async function getEscalationChains(tenantId: string): Promise<EscalationChain[]> {
  const result = await executeStatement({
    sql: `
      SELECT * FROM hitl_escalation_chains
      WHERE tenant_id = :tenantId AND is_active = true
      ORDER BY name
    `,
    parameters: [stringParam('tenantId', tenantId)],
  });

  return (result.rows || []).map(parseChainRow);
}

function parseChainRow(row: Record<string, unknown>): EscalationChain {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    levels: row.levels as EscalationLevel[],
    finalAction: row.final_action as EscalationChain['finalAction'],
    finalActionParams: row.final_action_params as Record<string, unknown> | undefined,
    appliesToQueues: row.applies_to_queues 
      ? (row.applies_to_queues as string).split(',').filter(Boolean)
      : undefined,
    appliesToRequestTypes: row.applies_to_request_types
      ? (row.applies_to_request_types as string).split(',').filter(Boolean)
      : undefined,
    priorityFilter: row.priority_filter
      ? (row.priority_filter as string).split(',').filter(Boolean)
      : undefined,
    isActive: row.is_active as boolean,
  };
}

// ============================================================================
// CHAIN MATCHING
// ============================================================================

async function findMatchingChain(
  tenantId: string,
  queueId: string,
  requestType: string,
  priority: string
): Promise<EscalationChain | null> {
  const chains = await getEscalationChains(tenantId);
  
  for (const chain of chains) {
    // Check queue filter
    if (chain.appliesToQueues && chain.appliesToQueues.length > 0) {
      if (!chain.appliesToQueues.includes(queueId)) continue;
    }

    // Check request type filter
    if (chain.appliesToRequestTypes && chain.appliesToRequestTypes.length > 0) {
      if (!chain.appliesToRequestTypes.includes(requestType)) continue;
    }

    // Check priority filter
    if (chain.priorityFilter && chain.priorityFilter.length > 0) {
      if (!chain.priorityFilter.includes(priority)) continue;
    }

    return chain;
  }

  return null;
}

// ============================================================================
// ESCALATION EXECUTION
// ============================================================================

async function escalateRequest(
  tenantId: string,
  requestId: string,
  chainId: string,
  currentLevel: number = 0
): Promise<{ success: boolean; newLevel: number; assignees: EscalationAssignee[] }> {
  const chain = await getEscalationChain(chainId);
  if (!chain) {
    logger.error('Escalation chain not found', { chainId });
    return { success: false, newLevel: currentLevel, assignees: [] };
  }

  const newLevel = currentLevel + 1;

  // Check if we've exhausted all levels
  if (newLevel > chain.levels.length) {
    logger.info('Escalation exhausted, executing final action', {
      requestId,
      chainId,
      finalAction: chain.finalAction,
    });
    await executeFinalAction(tenantId, requestId, chain);
    return { success: true, newLevel, assignees: [] };
  }

  const level = chain.levels[newLevel - 1];
  
  // Update request escalation status
  await executeStatement({
    sql: `
      UPDATE hitl_approval_requests
      SET escalated_at = NOW(),
          escalation_level = :newLevel,
          status = 'escalated'
      WHERE id = :requestId
    `,
    parameters: [
      stringParam('requestId', requestId),
      longParam('newLevel', newLevel),
    ],
  });

  // Send notifications to new assignees
  for (const assignee of level.assignees) {
    await sendEscalationNotification(
      tenantId,
      requestId,
      assignee,
      newLevel,
      level.notificationConfig
    );
  }

  logger.info('Escalated request to next level', {
    requestId,
    chainId,
    newLevel,
    assignees: level.assignees.length,
  });

  return { success: true, newLevel, assignees: level.assignees };
}

async function sendEscalationNotification(
  tenantId: string,
  requestId: string,
  assignee: EscalationAssignee,
  level: number,
  config: EscalationLevel['notificationConfig']
): Promise<void> {
  // Get request details
  const requestResult = await executeStatement({
    sql: `
      SELECT r.*, q.name as queue_name
      FROM hitl_approval_requests r
      JOIN hitl_queue_configs q ON q.id = r.queue_id
      WHERE r.id = :requestId
    `,
    parameters: [stringParam('requestId', requestId)],
  });

  if (!requestResult.rows || requestResult.rows.length === 0) return;

  const request = requestResult.rows[0];
  
  // Resolve assignee to user ID(s)
  const userIds = await resolveAssigneeToUsers(tenantId, assignee);
  
  for (const _userId of userIds) {
    await notificationService.sendEscalationNotification(
      tenantId,
      requestId,
      level
    );
  }
}

async function resolveAssigneeToUsers(
  tenantId: string,
  assignee: EscalationAssignee
): Promise<string[]> {
  switch (assignee.type) {
    case 'user':
      return [assignee.id];
    
    case 'role':
      // Get users with this role
      const roleResult = await executeStatement({
        sql: `
          SELECT u.id FROM users u
          WHERE u.tenant_id = :tenantId
            AND u.role = :role
            AND u.is_active = true
        `,
        parameters: [
          stringParam('tenantId', tenantId),
          stringParam('role', assignee.id),
        ],
      });
      return (roleResult.rows || []).map(r => r.id as string);
    
    case 'group':
      // Get users in this group
      const groupResult = await executeStatement({
        sql: `
          SELECT user_id FROM user_groups
          WHERE group_id = :groupId
        `,
        parameters: [stringParam('groupId', assignee.id)],
      });
      return (groupResult.rows || []).map(r => r.user_id as string);
    
    case 'on_call':
      // Get current on-call user from on_call_schedules table
      // Supports PagerDuty webhook integration via on_call_source field
      const onCallResult = await executeStatement({
        sql: `
          SELECT user_id FROM on_call_schedules
          WHERE schedule_id = :scheduleId
          AND start_time <= NOW()
          AND end_time > NOW()
          AND is_active = true
          ORDER BY priority ASC
          LIMIT 1
        `,
        parameters: [stringParam('scheduleId', assignee.id)],
      });
      
      if (onCallResult.rows && onCallResult.rows.length > 0) {
        return [onCallResult.rows[0].user_id as string];
      }
      
      // Fallback: Check for PagerDuty integration
      const pagerDutyKey = process.env.PAGERDUTY_API_KEY;
      const assigneeWithMeta = assignee as EscalationAssignee & { metadata?: { pagerdutyScheduleId?: string } };
      if (pagerDutyKey && assigneeWithMeta.metadata?.pagerdutyScheduleId) {
        try {
          const pdResponse = await fetch(
            `https://api.pagerduty.com/oncalls?schedule_ids[]=${assigneeWithMeta.metadata.pagerdutyScheduleId}`,
            {
              headers: {
                'Authorization': `Token token=${pagerDutyKey}`,
                'Content-Type': 'application/json',
              },
            }
          );
          if (pdResponse.ok) {
            const pdData = await pdResponse.json() as { oncalls?: Array<{ user?: { id: string } }> };
            const oncallUsers = pdData.oncalls?.map(oc => oc.user?.id).filter(Boolean) as string[];
            return oncallUsers || [];
          }
        } catch (error) {
          logger.error('PagerDuty integration failed', { error, assignee });
        }
      }
      
      logger.warn('No on-call user found', { assignee });
      return [];
    
    default:
      return [];
  }
}

async function executeFinalAction(
  tenantId: string,
  requestId: string,
  chain: EscalationChain
): Promise<void> {
  switch (chain.finalAction) {
    case 'reject':
      await executeStatement({
        sql: `
          UPDATE hitl_approval_requests
          SET status = 'rejected',
              resolved_at = NOW(),
              resolution_action = 'rejected',
              resolution_notes = 'Auto-rejected: Escalation chain exhausted'
          WHERE id = :requestId
        `,
        parameters: [stringParam('requestId', requestId)],
      });
      break;

    case 'approve':
      await executeStatement({
        sql: `
          UPDATE hitl_approval_requests
          SET status = 'auto_approved',
              resolved_at = NOW(),
              resolution_action = 'approved',
              resolution_notes = 'Auto-approved: Escalation chain exhausted'
          WHERE id = :requestId
        `,
        parameters: [stringParam('requestId', requestId)],
      });
      break;

    case 'use_default':
      const defaultValue = chain.finalActionParams?.defaultValue;
      await executeStatement({
        sql: `
          UPDATE hitl_approval_requests
          SET status = 'auto_approved',
              resolved_at = NOW(),
              resolution_action = 'approved',
              resolution_notes = 'Auto-approved with default value: Escalation chain exhausted',
              resolution_modifications = :defaultValue::jsonb
          WHERE id = :requestId
        `,
        parameters: [
          stringParam('requestId', requestId),
          stringParam('defaultValue', JSON.stringify(defaultValue)),
        ],
      });
      break;

    case 'notify_admin':
      // Send notification to tenant admins
      const adminResult = await executeStatement({
        sql: `
          SELECT id FROM users 
          WHERE tenant_id = :tenantId 
            AND role = 'admin' 
            AND is_active = true
        `,
        parameters: [stringParam('tenantId', tenantId)],
      });
      
      for (const _admin of adminResult.rows || []) {
        await notificationService.sendEscalationNotification(
          tenantId,
          requestId,
          chain.levels.length + 1
        );
      }
      break;
  }

  logger.info('Executed final escalation action', {
    requestId,
    chainId: chain.id,
    action: chain.finalAction,
  });
}

// ============================================================================
// TIMEOUT CHECKING
// ============================================================================

async function checkEscalationTimeouts(tenantId: string): Promise<number> {
  // Find requests that have exceeded their current level timeout
  const result = await executeStatement({
    sql: `
      SELECT r.id, r.queue_id, r.request_type, r.priority, r.escalation_level,
             q.escalation_path
      FROM hitl_approval_requests r
      JOIN hitl_queue_configs q ON q.id = r.queue_id
      WHERE r.tenant_id = :tenantId
        AND r.status IN ('pending', 'escalated')
        AND r.escalated_at IS NOT NULL
        AND r.escalated_at < NOW() - INTERVAL '1 minute' * COALESCE(q.escalation_timeout_minutes, 30)
    `,
    parameters: [stringParam('tenantId', tenantId)],
  });

  let escalatedCount = 0;

  for (const row of result.rows || []) {
    // Find matching chain
    const chain = await findMatchingChain(
      tenantId,
      row.queue_id as string,
      row.request_type as string,
      row.priority as string
    );

    if (chain) {
      await escalateRequest(
        tenantId,
        row.id as string,
        chain.id,
        row.escalation_level as number
      );
      escalatedCount++;
    }
  }

  if (escalatedCount > 0) {
    logger.info('Escalated timed-out requests', { tenantId, count: escalatedCount });
  }

  return escalatedCount;
}

// ============================================================================
// STATISTICS
// ============================================================================

async function getEscalationStatistics(tenantId: string): Promise<{
  totalEscalations: number;
  avgEscalationLevel: number;
  finalActionCounts: Record<string, number>;
  avgTimeToResolution: number;
  byChain: Array<{ chainId: string; name: string; count: number }>;
}> {
  const statsResult = await executeStatement({
    sql: `
      SELECT 
        COUNT(CASE WHEN escalation_level > 0 THEN 1 END) as total_escalations,
        AVG(escalation_level) as avg_level,
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))) as avg_resolution_time
      FROM hitl_approval_requests
      WHERE tenant_id = :tenantId
        AND created_at > NOW() - INTERVAL '30 days'
    `,
    parameters: [stringParam('tenantId', tenantId)],
  });

  const actionResult = await executeStatement({
    sql: `
      SELECT resolution_action, COUNT(*) as count
      FROM hitl_approval_requests
      WHERE tenant_id = :tenantId
        AND created_at > NOW() - INTERVAL '30 days'
        AND resolution_action IS NOT NULL
      GROUP BY resolution_action
    `,
    parameters: [stringParam('tenantId', tenantId)],
  });

  const stats = statsResult.rows?.[0] || {};
  const finalActionCounts: Record<string, number> = {};
  
  for (const row of actionResult.rows || []) {
    finalActionCounts[row.resolution_action as string] = Number(row.count);
  }

  return {
    totalEscalations: Number(stats.total_escalations) || 0,
    avgEscalationLevel: Number(stats.avg_level) || 0,
    finalActionCounts,
    avgTimeToResolution: Number(stats.avg_resolution_time) || 0,
    byChain: [], // Would need additional tracking
  };
}

export const escalationService = {
  createEscalationChain,
  updateEscalationChain,
  getEscalationChain,
  getEscalationChains,
  findMatchingChain,
  escalateRequest,
  checkEscalationTimeouts,
  getEscalationStatistics,
};
