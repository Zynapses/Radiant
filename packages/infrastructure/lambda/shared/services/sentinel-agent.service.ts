// RADIANT v4.18.0 - Sentinel Agent Service
// Event-Driven Autonomous Agents
// Novel UI: "Watchtower Dashboard" - castle towers watching domains

import { executeStatement, stringParam, longParam, boolParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

export interface SentinelAgent {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  type: AgentType;
  status: AgentStatus;
  watchDomain: string;
  triggers: AgentTrigger[];
  actions: AgentAction[];
  conditions: AgentCondition[];
  cooldownMinutes: number;
  lastTriggeredAt?: string;
  triggerCount: number;
  enabled: boolean;
  priority: number;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type AgentType = 'monitor' | 'guardian' | 'scout' | 'herald' | 'arbiter';
export type AgentStatus = 'idle' | 'watching' | 'triggered' | 'cooldown' | 'disabled';

export interface AgentTrigger {
  type: string;
  condition: Record<string, unknown>;
}

export interface AgentAction {
  type: string;
  params: Record<string, unknown>;
}

export interface AgentCondition {
  field: string;
  operator: string;
  value: unknown;
}

export interface SentinelEvent {
  id: string;
  sentinelId: string;
  tenantId: string;
  triggerType: string;
  triggerData: Record<string, unknown>;
  actionsTaken: AgentAction[];
  status: 'success' | 'partial' | 'failed';
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

// ============================================================================
// Sentinel Agent Service
// ============================================================================

class SentinelAgentService {
  // --------------------------------------------------------------------------
  // Agent CRUD
  // --------------------------------------------------------------------------

  async createAgent(
    tenantId: string,
    agent: Omit<SentinelAgent, 'id' | 'tenantId' | 'status' | 'lastTriggeredAt' | 'triggerCount' | 'createdAt' | 'updatedAt'>
  ): Promise<SentinelAgent> {
    try {
      const id = `sentinel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await executeStatement(
        `INSERT INTO sentinel_agents (
            id, tenant_id, name, description, type, status, watch_domain,
            triggers, actions, conditions, cooldown_minutes, trigger_count,
            enabled, priority, metadata, created_by, created_at, updated_at
          ) VALUES (
            :id, :tenantId, :name, :description, :type, 'idle', :watchDomain,
            :triggers, :actions, :conditions, :cooldownMinutes, 0,
            :enabled, :priority, :metadata, :createdBy, NOW(), NOW()
          )`,
        [
          stringParam('id', id),
          stringParam('tenantId', tenantId),
          stringParam('name', agent.name),
          stringParam('description', agent.description || ''),
          stringParam('type', agent.type),
          stringParam('watchDomain', agent.watchDomain),
          stringParam('triggers', JSON.stringify(agent.triggers)),
          stringParam('actions', JSON.stringify(agent.actions)),
          stringParam('conditions', JSON.stringify(agent.conditions || [])),
          longParam('cooldownMinutes', agent.cooldownMinutes || 5),
          boolParam('enabled', agent.enabled !== false),
          longParam('priority', agent.priority || 5),
          stringParam('metadata', JSON.stringify(agent.metadata || {})),
          stringParam('createdBy', agent.createdBy),
        ]
      );

      logger.info('Created sentinel agent', { tenantId, id, name: agent.name });

      return {
        id,
        tenantId,
        ...agent,
        status: 'idle',
        triggerCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to create sentinel agent', { tenantId, error });
      throw error;
    }
  }

  async getAgent(tenantId: string, agentId: string): Promise<SentinelAgent | null> {
    try {
      const result = await executeStatement(
        `SELECT * FROM sentinel_agents WHERE tenant_id = :tenantId AND id = :agentId`,
        [stringParam('tenantId', tenantId), stringParam('agentId', agentId)]
      );

      if (result.rows && result.rows.length > 0) {
        return this.parseAgent(result.rows[0] as Record<string, unknown>);
      }
      return null;
    } catch (error) {
      logger.error('Failed to get sentinel agent', { tenantId, agentId, error });
      throw error;
    }
  }

  async updateAgent(tenantId: string, agentId: string, updates: Partial<SentinelAgent>): Promise<SentinelAgent | null> {
    try {
      const existing = await this.getAgent(tenantId, agentId);
      if (!existing) return null;

      const merged = { ...existing, ...updates };

      await executeStatement(
        `UPDATE sentinel_agents SET
            name = :name, description = :description, type = :type,
            watch_domain = :watchDomain, triggers = :triggers, actions = :actions,
            conditions = :conditions, cooldown_minutes = :cooldownMinutes,
            enabled = :enabled, priority = :priority, metadata = :metadata,
            updated_at = NOW()
          WHERE tenant_id = :tenantId AND id = :agentId`,
        [
          stringParam('name', merged.name),
          stringParam('description', merged.description),
          stringParam('type', merged.type),
          stringParam('watchDomain', merged.watchDomain),
          stringParam('triggers', JSON.stringify(merged.triggers)),
          stringParam('actions', JSON.stringify(merged.actions)),
          stringParam('conditions', JSON.stringify(merged.conditions)),
          longParam('cooldownMinutes', merged.cooldownMinutes),
          boolParam('enabled', merged.enabled),
          longParam('priority', merged.priority),
          stringParam('metadata', JSON.stringify(merged.metadata)),
          stringParam('tenantId', tenantId),
          stringParam('agentId', agentId),
        ]
      );

      return { ...merged, updatedAt: new Date().toISOString() };
    } catch (error) {
      logger.error('Failed to update sentinel agent', { tenantId, agentId, error });
      throw error;
    }
  }

  async deleteAgent(tenantId: string, agentId: string): Promise<boolean> {
    try {
      const result = await executeStatement(
        `DELETE FROM sentinel_agents WHERE tenant_id = :tenantId AND id = :agentId`,
        [stringParam('tenantId', tenantId), stringParam('agentId', agentId)]
      );
      return (result.rowCount || 0) > 0;
    } catch (error) {
      logger.error('Failed to delete sentinel agent', { tenantId, agentId, error });
      throw error;
    }
  }

  async listAgents(
    tenantId: string,
    options: { type?: AgentType; enabled?: boolean; limit?: number; offset?: number } = {}
  ): Promise<{ agents: SentinelAgent[]; total: number }> {
    try {
      let sql = `SELECT * FROM sentinel_agents WHERE tenant_id = :tenantId`;
      let countSql = `SELECT COUNT(*) as total FROM sentinel_agents WHERE tenant_id = :tenantId`;
      const params = [stringParam('tenantId', tenantId)];

      if (options.type) {
        sql += ` AND type = :type`;
        countSql += ` AND type = :type`;
        params.push(stringParam('type', options.type));
      }
      if (options.enabled !== undefined) {
        sql += ` AND enabled = :enabled`;
        countSql += ` AND enabled = :enabled`;
        params.push(boolParam('enabled', options.enabled));
      }

      sql += ` ORDER BY priority ASC, updated_at DESC`;
      const limitParams = [...params];
      if (options.limit) {
        sql += ` LIMIT :limit`;
        limitParams.push(longParam('limit', options.limit));
      }
      if (options.offset) {
        sql += ` OFFSET :offset`;
        limitParams.push(longParam('offset', options.offset));
      }

      const [result, countResult] = await Promise.all([
        executeStatement(sql, limitParams),
        executeStatement(countSql, params),
      ]);

      const agents = (result.rows || []).map(row => this.parseAgent(row as Record<string, unknown>));
      const total = Number((countResult.rows?.[0] as Record<string, unknown>)?.total) || 0;

      return { agents, total };
    } catch (error) {
      logger.error('Failed to list sentinel agents', { tenantId, error });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Agent Operations
  // --------------------------------------------------------------------------

  async triggerAgent(tenantId: string, agentId: string, triggerData: Record<string, unknown>): Promise<SentinelEvent> {
    try {
      const agent = await this.getAgent(tenantId, agentId);
      if (!agent) throw new Error('Agent not found');
      if (!agent.enabled) throw new Error('Agent is disabled');

      // Check cooldown
      if (agent.lastTriggeredAt) {
        const cooldownEnd = new Date(agent.lastTriggeredAt).getTime() + agent.cooldownMinutes * 60 * 1000;
        if (Date.now() < cooldownEnd) {
          throw new Error('Agent is in cooldown');
        }
      }

      const eventId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const startTime = Date.now();

      // Execute actions
      const actionsTaken: AgentAction[] = [];
      let status: 'success' | 'partial' | 'failed' = 'success';

      for (const action of agent.actions) {
        try {
          await this.executeAction(action, triggerData);
          actionsTaken.push(action);
        } catch {
          status = actionsTaken.length > 0 ? 'partial' : 'failed';
        }
      }

      const durationMs = Date.now() - startTime;

      // Record event
      await executeStatement(
        `INSERT INTO sentinel_events (id, sentinel_id, tenant_id, trigger_type, trigger_data, actions_taken, status, started_at, completed_at, duration_ms)
          VALUES (:id, :sentinelId, :tenantId, :triggerType, :triggerData, :actionsTaken, :status, :startedAt, NOW(), :durationMs)`,
        [
          stringParam('id', eventId),
          stringParam('sentinelId', agentId),
          stringParam('tenantId', tenantId),
          stringParam('triggerType', 'manual'),
          stringParam('triggerData', JSON.stringify(triggerData)),
          stringParam('actionsTaken', JSON.stringify(actionsTaken)),
          stringParam('status', status),
          stringParam('startedAt', new Date(startTime).toISOString()),
          longParam('durationMs', durationMs),
        ]
      );

      // Update agent
      await executeStatement(
        `UPDATE sentinel_agents SET status = 'cooldown', last_triggered_at = NOW(), trigger_count = trigger_count + 1, updated_at = NOW()
          WHERE id = :agentId`,
        [stringParam('agentId', agentId)]
      );

      return {
        id: eventId,
        sentinelId: agentId,
        tenantId,
        triggerType: 'manual',
        triggerData,
        actionsTaken,
        status,
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        durationMs,
      };
    } catch (error) {
      logger.error('Failed to trigger agent', { tenantId, agentId, error });
      throw error;
    }
  }

  private async executeAction(action: AgentAction, context: Record<string, unknown>): Promise<void> {
    logger.info('Executing sentinel action', { action, context });
    // Action execution would integrate with other services
  }

  async enableAgent(tenantId: string, agentId: string): Promise<void> {
    await executeStatement(
      `UPDATE sentinel_agents SET enabled = true, status = 'watching', updated_at = NOW() WHERE tenant_id = :tenantId AND id = :agentId`,
      [stringParam('tenantId', tenantId), stringParam('agentId', agentId)]
    );
  }

  async disableAgent(tenantId: string, agentId: string): Promise<void> {
    await executeStatement(
      `UPDATE sentinel_agents SET enabled = false, status = 'disabled', updated_at = NOW() WHERE tenant_id = :tenantId AND id = :agentId`,
      [stringParam('tenantId', tenantId), stringParam('agentId', agentId)]
    );
  }

  // --------------------------------------------------------------------------
  // Events
  // --------------------------------------------------------------------------

  async getAgentEvents(tenantId: string, agentId: string, limit = 50): Promise<SentinelEvent[]> {
    try {
      const result = await executeStatement(
        `SELECT * FROM sentinel_events WHERE tenant_id = :tenantId AND sentinel_id = :agentId ORDER BY started_at DESC LIMIT :limit`,
        [stringParam('tenantId', tenantId), stringParam('agentId', agentId), longParam('limit', limit)]
      );

      return (result.rows || []).map(row => this.parseEvent(row as Record<string, unknown>));
    } catch (error) {
      logger.error('Failed to get agent events', { tenantId, agentId, error });
      throw error;
    }
  }

  async getAllEvents(tenantId: string, options: { limit?: number } = {}): Promise<SentinelEvent[]> {
    try {
      const result = await executeStatement(
        `SELECT * FROM sentinel_events WHERE tenant_id = :tenantId ORDER BY started_at DESC LIMIT :limit`,
        [stringParam('tenantId', tenantId), longParam('limit', options.limit || 100)]
      );

      return (result.rows || []).map(row => this.parseEvent(row as Record<string, unknown>));
    } catch (error) {
      logger.error('Failed to get all events', { tenantId, error });
      throw error;
    }
  }

  async getStats(tenantId: string): Promise<{
    totalAgents: number;
    activeAgents: number;
    totalEvents: number;
    eventsToday: number;
    triggersToday: number;
    successRate: number;
    byType: Record<string, number>;
  }> {
    try {
      const [agentStats, eventStats, todayStats, typeStats] = await Promise.all([
        executeStatement(
          `SELECT COUNT(*) as total, SUM(CASE WHEN enabled = true THEN 1 ELSE 0 END) as active FROM sentinel_agents WHERE tenant_id = :tenantId`,
          [stringParam('tenantId', tenantId)]
        ),
        executeStatement(
          `SELECT COUNT(*) as total, SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success FROM sentinel_events WHERE tenant_id = :tenantId`,
          [stringParam('tenantId', tenantId)]
        ),
        executeStatement(
          `SELECT COUNT(*) as today FROM sentinel_events WHERE tenant_id = :tenantId AND started_at >= CURRENT_DATE`,
          [stringParam('tenantId', tenantId)]
        ),
        executeStatement(
          `SELECT type, COUNT(*) as count FROM sentinel_agents WHERE tenant_id = :tenantId GROUP BY type`,
          [stringParam('tenantId', tenantId)]
        ),
      ]);

      const totalAgents = Number((agentStats.rows?.[0] as Record<string, unknown>)?.total) || 0;
      const activeAgents = Number((agentStats.rows?.[0] as Record<string, unknown>)?.active) || 0;
      const totalEvents = Number((eventStats.rows?.[0] as Record<string, unknown>)?.total) || 0;
      const successEvents = Number((eventStats.rows?.[0] as Record<string, unknown>)?.success) || 0;
      const eventsToday = Number((todayStats.rows?.[0] as Record<string, unknown>)?.today) || 0;

      const byType: Record<string, number> = {};
      for (const row of (typeStats.rows || []) as Record<string, unknown>[]) {
        byType[String(row.type)] = Number(row.count) || 0;
      }

      return {
        totalAgents,
        activeAgents,
        totalEvents,
        eventsToday,
        triggersToday: eventsToday,
        successRate: totalEvents > 0 ? successEvents / totalEvents : 1,
        byType,
      };
    } catch (error) {
      logger.error('Failed to get stats', { tenantId, error });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Parse Helpers
  // --------------------------------------------------------------------------

  private parseAgent(row: Record<string, unknown>): SentinelAgent {
    return {
      id: String(row.id || ''),
      tenantId: String(row.tenant_id || ''),
      name: String(row.name || ''),
      description: String(row.description || ''),
      type: String(row.type || 'monitor') as AgentType,
      status: String(row.status || 'idle') as AgentStatus,
      watchDomain: String(row.watch_domain || ''),
      triggers: this.parseJson(row.triggers) || [],
      actions: this.parseJson(row.actions) || [],
      conditions: this.parseJson(row.conditions) || [],
      cooldownMinutes: Number(row.cooldown_minutes) || 5,
      lastTriggeredAt: row.last_triggered_at ? String(row.last_triggered_at) : undefined,
      triggerCount: Number(row.trigger_count) || 0,
      enabled: Boolean(row.enabled),
      priority: Number(row.priority) || 5,
      metadata: this.parseJson(row.metadata) || {},
      createdBy: String(row.created_by || ''),
      createdAt: String(row.created_at || ''),
      updatedAt: String(row.updated_at || ''),
    };
  }

  private parseEvent(row: Record<string, unknown>): SentinelEvent {
    return {
      id: String(row.id || ''),
      sentinelId: String(row.sentinel_id || ''),
      tenantId: String(row.tenant_id || ''),
      triggerType: String(row.trigger_type || ''),
      triggerData: this.parseJson(row.trigger_data) || {},
      actionsTaken: this.parseJson(row.actions_taken) || [],
      status: String(row.status || 'success') as 'success' | 'partial' | 'failed',
      startedAt: String(row.started_at || ''),
      completedAt: String(row.completed_at || ''),
      durationMs: Number(row.duration_ms) || 0,
    };
  }

  private parseJson<T>(value: unknown): T | null {
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return null; }
    }
    return value as T;
  }
}

export const sentinelAgentService = new SentinelAgentService();
