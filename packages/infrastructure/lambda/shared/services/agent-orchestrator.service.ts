/**
 * RADIANT Agent Orchestrator Service
 * 
 * Manages multi-agent coordination:
 * 1. Agent Registry - Track all active agents
 * 2. Dependency Management - Track inter-agent dependencies
 * 3. Cycle Detection - Prevent deadlocks from circular dependencies
 * 4. Resource Locking - Prevent race conditions on shared resources
 * 
 * Architecture:
 * - Agents register when they start
 * - Dependencies are declared before waiting
 * - Cycle detection runs before creating dependencies
 * - Resource locks are acquired before accessing shared resources
 */

import { Client } from 'pg';
import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

export interface AgentRegistration {
  tenantId: string;
  agentType: string;
  agentInstanceId: string;
  sessionId?: string;
  flyteExecutionId?: string;
  flyteNodeId?: string;
  metadata?: Record<string, unknown>;
}

export interface RegisteredAgent {
  id: string;
  tenantId: string;
  agentType: string;
  agentInstanceId: string;
  sessionId?: string;
  status: 'active' | 'waiting' | 'blocked' | 'completed' | 'failed' | 'hydrated';
  blockedReason?: string;
  blockedByAgentId?: string;
  blockedByResourceId?: string;
  isHydrated: boolean;
  startedAt: Date;
  lastHeartbeatAt: Date;
}

export interface DependencyDeclaration {
  tenantId: string;
  dependentAgentId: string;
  dependencyAgentId: string;
  dependencyType: 'data' | 'approval' | 'resource' | 'sequence';
  waitKey: string;
  timeoutSeconds?: number;
}

export interface DependencyStatus {
  id: string;
  status: 'pending' | 'satisfied' | 'failed' | 'timeout';
  waitValue?: unknown;
  satisfiedAt?: Date;
}

export interface ResourceLockRequest {
  tenantId: string;
  agentId: string;
  agentType: string;
  resourceUri: string;
  lockType: 'read' | 'write' | 'exclusive';
  timeoutSeconds?: number;
  waitIfLocked?: boolean;
}

export interface ResourceLockResult {
  success: boolean;
  lockId?: string;
  waitPosition?: number;
  holderAgentId?: string;
  estimatedWaitSeconds?: number;
}

export interface CycleDetectionResult {
  hasCycle: boolean;
  cyclePath?: string[];
  affectedAgents?: string[];
}

// ============================================================================
// Service
// ============================================================================

class AgentOrchestratorService {
  private db: Client | null = null;
  private redis: Redis | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize database and Redis connections
   */
  async initialize(db: Client, redis?: Redis): Promise<void> {
    this.db = db;
    this.redis = redis || null;
    logger.info('AgentOrchestratorService initialized');
  }

  // ============================================================================
  // Agent Registry
  // ============================================================================

  /**
   * Register a new agent
   */
  async registerAgent(params: AgentRegistration): Promise<RegisteredAgent> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.query(
      `INSERT INTO agent_registry (
        tenant_id, agent_type, agent_instance_id, session_id,
        flyte_execution_id, flyte_node_id, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (tenant_id, agent_instance_id) 
      DO UPDATE SET 
        status = 'active',
        last_heartbeat_at = NOW(),
        completed_at = NULL
      RETURNING *`,
      [
        params.tenantId,
        params.agentType,
        params.agentInstanceId,
        params.sessionId,
        params.flyteExecutionId,
        params.flyteNodeId,
        JSON.stringify(params.metadata || {}),
      ]
    );

    const row = result.rows[0];
    
    // Log event
    await this.logEvent(params.tenantId, 'agent_registered', {
      agentId: row.id,
      agentType: params.agentType,
      agentInstanceId: params.agentInstanceId,
    });

    logger.info('Agent registered', {
      agentId: row.id,
      agentType: params.agentType,
      tenantId: params.tenantId,
    });

    return this.mapAgentRow(row);
  }

  /**
   * Update agent heartbeat
   */
  async heartbeat(agentId: string): Promise<void> {
    if (!this.db) return;

    await this.db.query(
      `UPDATE agent_registry SET last_heartbeat_at = NOW() WHERE id = $1`,
      [agentId]
    );
  }

  /**
   * Update agent status
   */
  async updateAgentStatus(
    agentId: string,
    status: RegisteredAgent['status'],
    details?: { blockedReason?: string; blockedByAgentId?: string; blockedByResourceId?: string }
  ): Promise<void> {
    if (!this.db) return;

    await this.db.query(
      `UPDATE agent_registry 
       SET status = $1, blocked_reason = $2, blocked_by_agent_id = $3, blocked_by_resource_id = $4,
           completed_at = CASE WHEN $1 IN ('completed', 'failed') THEN NOW() ELSE NULL END
       WHERE id = $5`,
      [
        status,
        details?.blockedReason,
        details?.blockedByAgentId,
        details?.blockedByResourceId,
        agentId,
      ]
    );
  }

  /**
   * Get agent by ID
   */
  async getAgent(agentId: string): Promise<RegisteredAgent | null> {
    if (!this.db) return null;

    const result = await this.db.query(
      `SELECT * FROM agent_registry WHERE id = $1`,
      [agentId]
    );

    if (result.rows.length === 0) return null;
    return this.mapAgentRow(result.rows[0]);
  }

  /**
   * Get all active agents for a tenant
   */
  async getActiveAgents(tenantId: string): Promise<RegisteredAgent[]> {
    if (!this.db) return [];

    const result = await this.db.query(
      `SELECT * FROM agent_registry 
       WHERE tenant_id = $1 AND status NOT IN ('completed', 'failed')
       ORDER BY started_at DESC`,
      [tenantId]
    );

    return result.rows.map(row => this.mapAgentRow(row));
  }

  // ============================================================================
  // Dependency Management
  // ============================================================================

  /**
   * Declare a dependency between agents
   * Returns error if this would create a cycle
   */
  async declareDependency(params: DependencyDeclaration): Promise<{
    success: boolean;
    dependencyId?: string;
    cycleDetected?: CycleDetectionResult;
  }> {
    if (!this.db) throw new Error('Database not initialized');

    // First, check for cycles
    const cycleResult = await this.detectCycle(
      params.dependentAgentId,
      params.dependencyAgentId
    );

    if (cycleResult.hasCycle) {
      // Log the cycle detection
      await this.logEvent(params.tenantId, 'cycle_detected', {
        dependentAgentId: params.dependentAgentId,
        dependencyAgentId: params.dependencyAgentId,
        cyclePath: cycleResult.cyclePath,
      });

      logger.warn('Cycle detected in agent dependencies', {
        tenantId: params.tenantId,
        cyclePath: cycleResult.cyclePath,
      });

      // Notify affected agents via intervention card
      await this.createInterventionCard(params.tenantId, cycleResult);

      return {
        success: false,
        cycleDetected: cycleResult,
      };
    }

    // Create the dependency
    const timeoutSeconds = params.timeoutSeconds || 3600;
    const result = await this.db.query(
      `INSERT INTO agent_dependencies (
        tenant_id, dependent_agent_id, dependency_agent_id,
        dependency_type, wait_key, timeout_seconds, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW() + ($6 || ' seconds')::INTERVAL)
      ON CONFLICT (dependent_agent_id, dependency_agent_id, wait_key) DO NOTHING
      RETURNING id`,
      [
        params.tenantId,
        params.dependentAgentId,
        params.dependencyAgentId,
        params.dependencyType,
        params.waitKey,
        timeoutSeconds,
      ]
    );

    if (result.rows.length === 0) {
      // Dependency already exists
      const existing = await this.db.query(
        `SELECT id FROM agent_dependencies 
         WHERE dependent_agent_id = $1 AND dependency_agent_id = $2 AND wait_key = $3`,
        [params.dependentAgentId, params.dependencyAgentId, params.waitKey]
      );
      return { success: true, dependencyId: existing.rows[0]?.id };
    }

    const dependencyId = result.rows[0].id;

    // Update dependent agent status
    await this.updateAgentStatus(params.dependentAgentId, 'waiting', {
      blockedReason: `Waiting for ${params.waitKey} from agent`,
      blockedByAgentId: params.dependencyAgentId,
    });

    // Log event
    await this.logEvent(params.tenantId, 'dependency_created', {
      dependencyId,
      dependentAgentId: params.dependentAgentId,
      dependencyAgentId: params.dependencyAgentId,
      waitKey: params.waitKey,
    });

    logger.info('Dependency declared', {
      dependencyId,
      tenantId: params.tenantId,
      waitKey: params.waitKey,
    });

    return { success: true, dependencyId };
  }

  /**
   * Satisfy a dependency
   */
  async satisfyDependency(
    tenantId: string,
    dependentAgentId: string,
    waitKey: string,
    value: unknown
  ): Promise<{ success: boolean; affectedCount: number }> {
    if (!this.db) throw new Error('Database not initialized');

    // Find and update matching dependencies
    const result = await this.db.query(
      `UPDATE agent_dependencies
       SET status = 'satisfied', satisfied_at = NOW(), wait_value = $1
       WHERE tenant_id = $2 AND dependent_agent_id = $3 AND wait_key = $4 AND status = 'pending'
       RETURNING id, dependent_agent_id`,
      [JSON.stringify(value), tenantId, dependentAgentId, waitKey]
    );

    if (result.rows.length === 0) {
      return { success: false, affectedCount: 0 };
    }

    // Update agent status back to active
    await this.updateAgentStatus(dependentAgentId, 'active');

    // Notify agent via Redis
    if (this.redis) {
      await this.redis.publish(
        `agent:${dependentAgentId}:dependency_satisfied`,
        JSON.stringify({
          waitKey,
          value,
          timestamp: new Date().toISOString(),
        })
      );
    }

    // Log event
    await this.logEvent(tenantId, 'dependency_satisfied', {
      dependentAgentId,
      waitKey,
      affectedCount: result.rows.length,
    });

    return { success: true, affectedCount: result.rows.length };
  }

  /**
   * Get pending dependencies for an agent
   */
  async getPendingDependencies(agentId: string): Promise<DependencyStatus[]> {
    if (!this.db) return [];

    const result = await this.db.query(
      `SELECT * FROM agent_dependencies
       WHERE dependent_agent_id = $1 AND status = 'pending'`,
      [agentId]
    );

    return result.rows.map(row => ({
      id: row.id,
      status: row.status,
      waitValue: row.wait_value ? JSON.parse(row.wait_value) : undefined,
      satisfiedAt: row.satisfied_at,
    }));
  }

  // ============================================================================
  // Cycle Detection
  // ============================================================================

  /**
   * Detect if adding a dependency would create a cycle
   */
  async detectCycle(
    dependentAgentId: string,
    dependencyAgentId: string
  ): Promise<CycleDetectionResult> {
    if (!this.db) return { hasCycle: false };

    // Use the database function for cycle detection
    const result = await this.db.query(
      `SELECT detect_dependency_cycle($1, $2) as has_cycle`,
      [dependentAgentId, dependencyAgentId]
    );

    if (!result.rows[0].has_cycle) {
      return { hasCycle: false };
    }

    // Build the cycle path for debugging
    const cyclePath = await this.buildCyclePath(dependentAgentId, dependencyAgentId);

    return {
      hasCycle: true,
      cyclePath,
      affectedAgents: cyclePath,
    };
  }

  private async buildCyclePath(
    startAgentId: string,
    endAgentId: string
  ): Promise<string[]> {
    if (!this.db) return [startAgentId, endAgentId];

    const path: string[] = [startAgentId];
    let currentId = endAgentId;
    const visited = new Set<string>([startAgentId]);

    // BFS to find path
    while (currentId && !visited.has(currentId)) {
      path.push(currentId);
      visited.add(currentId);

      const result = await this.db.query(
        `SELECT dependency_agent_id FROM agent_dependencies
         WHERE dependent_agent_id = $1 AND status = 'pending'
         LIMIT 1`,
        [currentId]
      );

      if (result.rows.length === 0) break;
      currentId = result.rows[0].dependency_agent_id;

      if (currentId === startAgentId) {
        path.push(startAgentId); // Complete the cycle
        break;
      }
    }

    return path;
  }

  private async createInterventionCard(
    tenantId: string,
    cycleResult: CycleDetectionResult
  ): Promise<void> {
    if (!this.db) return;

    // Create a HITL decision for the cycle
    await this.db.query(
      `INSERT INTO pending_decisions (
        tenant_id, session_id, question, context, domain, urgency,
        timeout_seconds, expires_at, flyte_execution_id, flyte_node_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + '1 hour'::INTERVAL, $8, $9)`,
      [
        tenantId,
        uuidv4(),
        `Agents are stuck in a circular dependency. Please manually provide data to break the cycle.`,
        JSON.stringify({
          type: 'cycle_intervention',
          cyclePath: cycleResult.cyclePath,
          affectedAgents: cycleResult.affectedAgents,
        }),
        'general',
        'critical',
        3600,
        `cycle-${uuidv4()}`,
        'orchestrator',
      ]
    );

    // Notify via Redis
    if (this.redis) {
      await this.redis.publish(
        `decision_pending:${tenantId}`,
        JSON.stringify({
          type: 'cycle_intervention',
          urgency: 'critical',
          cyclePath: cycleResult.cyclePath,
          timestamp: new Date().toISOString(),
        })
      );
    }
  }

  // ============================================================================
  // Resource Locking
  // ============================================================================

  /**
   * Acquire a resource lock
   */
  async acquireResourceLock(params: ResourceLockRequest): Promise<ResourceLockResult> {
    if (!this.db) throw new Error('Database not initialized');

    const timeoutSeconds = params.timeoutSeconds || 300;
    const waitIfLocked = params.waitIfLocked !== false;

    // Use the database function
    const result = await this.db.query(
      `SELECT * FROM acquire_resource_lock($1, $2, $3, $4, $5, $6)`,
      [
        params.tenantId,
        params.resourceUri,
        params.agentId,
        params.agentType,
        params.lockType,
        timeoutSeconds,
      ]
    );

    const row = result.rows[0];

    if (row.success) {
      // Log event
      await this.logEvent(params.tenantId, 'lock_acquired', {
        lockId: row.lock_id,
        resourceUri: params.resourceUri,
        agentId: params.agentId,
        lockType: params.lockType,
      });

      logger.info('Resource lock acquired', {
        lockId: row.lock_id,
        resourceUri: params.resourceUri,
      });

      return {
        success: true,
        lockId: row.lock_id,
      };
    } else {
      // Lock is held by another agent
      if (waitIfLocked) {
        // Update agent status to blocked
        await this.updateAgentStatus(params.agentId, 'blocked', {
          blockedReason: `Waiting for resource: ${params.resourceUri}`,
          blockedByResourceId: row.lock_id,
        });

        // Log event
        await this.logEvent(params.tenantId, 'lock_denied', {
          lockId: row.lock_id,
          resourceUri: params.resourceUri,
          agentId: params.agentId,
          waitPosition: row.wait_position,
          holderAgentId: row.holder_agent_id,
        });

        logger.info('Resource lock denied, waiting in queue', {
          resourceUri: params.resourceUri,
          waitPosition: row.wait_position,
        });

        return {
          success: false,
          lockId: row.lock_id,
          waitPosition: row.wait_position,
          holderAgentId: row.holder_agent_id,
          estimatedWaitSeconds: row.wait_position * 30, // Rough estimate
        };
      } else {
        return {
          success: false,
          holderAgentId: row.holder_agent_id,
        };
      }
    }
  }

  /**
   * Release a resource lock
   */
  async releaseResourceLock(
    lockId: string,
    agentId: string
  ): Promise<{ success: boolean; nextAgentId?: string }> {
    if (!this.db) throw new Error('Database not initialized');

    // Use the database function
    const result = await this.db.query(
      `SELECT * FROM release_resource_lock($1, $2)`,
      [lockId, agentId]
    );

    const row = result.rows[0];

    if (row.success) {
      // Get tenant ID for logging
      const lockResult = await this.db.query(
        `SELECT tenant_id, resource_uri FROM resource_locks WHERE id = $1`,
        [lockId]
      );

      if (lockResult.rows.length > 0) {
        const { tenant_id, resource_uri } = lockResult.rows[0];

        // Log event
        await this.logEvent(tenant_id, 'lock_released', {
          lockId,
          resourceUri: resource_uri,
          agentId,
          nextAgentId: row.next_agent_id,
        });

        // Notify next agent in queue
        if (row.next_agent_id && this.redis) {
          await this.redis.publish(
            `agent:${row.next_agent_id}:lock_available`,
            JSON.stringify({
              lockId,
              resourceUri: resource_uri,
              timestamp: new Date().toISOString(),
            })
          );
        }
      }

      logger.info('Resource lock released', {
        lockId,
        nextAgentId: row.next_agent_id,
      });

      return {
        success: true,
        nextAgentId: row.next_agent_id,
      };
    }

    return { success: false };
  }

  /**
   * Get active locks for a tenant
   */
  async getActiveLocks(tenantId: string): Promise<Array<{
    id: string;
    resourceUri: string;
    resourceType: string;
    lockType: string;
    holderAgentId: string;
    holderAgentType: string;
    acquiredAt: Date;
    expiresAt: Date;
    waitQueueLength: number;
  }>> {
    if (!this.db) return [];

    const result = await this.db.query(
      `SELECT *, array_length(wait_queue, 1) as wait_queue_length
       FROM resource_locks
       WHERE tenant_id = $1 AND released_at IS NULL AND expires_at > NOW()
       ORDER BY acquired_at DESC`,
      [tenantId]
    );

    return result.rows.map(row => ({
      id: row.id,
      resourceUri: row.resource_uri,
      resourceType: row.resource_type,
      lockType: row.lock_type,
      holderAgentId: row.holder_agent_id,
      holderAgentType: row.holder_agent_type,
      acquiredAt: row.acquired_at,
      expiresAt: row.expires_at,
      waitQueueLength: row.wait_queue_length || 0,
    }));
  }

  /**
   * Force release expired locks (cleanup job)
   */
  async cleanupExpiredLocks(): Promise<number> {
    if (!this.db) return 0;

    const result = await this.db.query(
      `UPDATE resource_locks
       SET released_at = NOW()
       WHERE released_at IS NULL AND expires_at < NOW()
       RETURNING id, tenant_id, holder_agent_id, wait_queue`,
    );

    let notifiedCount = 0;

    // Notify waiting agents
    for (const row of result.rows) {
      // Log timeout event
      await this.logEvent(row.tenant_id, 'lock_timeout', {
        lockId: row.id,
        holderAgentId: row.holder_agent_id,
      });

      // Notify first agent in wait queue
      if (row.wait_queue && row.wait_queue.length > 0 && this.redis) {
        await this.redis.publish(
          `agent:${row.wait_queue[0]}:lock_available`,
          JSON.stringify({
            lockId: row.id,
            reason: 'timeout',
            timestamp: new Date().toISOString(),
          })
        );
        notifiedCount++;
      }
    }

    if (result.rows.length > 0) {
      logger.info('Cleaned up expired locks', {
        count: result.rows.length,
        notifiedCount,
      });
    }

    return result.rows.length;
  }

  // ============================================================================
  // Dashboard & Stats
  // ============================================================================

  /**
   * Get orchestration dashboard data
   */
  async getDashboardData(tenantId: string): Promise<{
    activeAgents: number;
    waitingAgents: number;
    blockedAgents: number;
    pendingDependencies: number;
    activeLocks: number;
    cyclesDetectedToday: number;
    recentEvents: Array<{ type: string; timestamp: Date; details: unknown }>;
  }> {
    if (!this.db) {
      return {
        activeAgents: 0,
        waitingAgents: 0,
        blockedAgents: 0,
        pendingDependencies: 0,
        activeLocks: 0,
        cyclesDetectedToday: 0,
        recentEvents: [],
      };
    }

    const [agentStats, depStats, lockStats, cycleStats, events] = await Promise.all([
      this.db.query(
        `SELECT status, COUNT(*) as count FROM agent_registry
         WHERE tenant_id = $1 AND status NOT IN ('completed', 'failed')
         GROUP BY status`,
        [tenantId]
      ),
      this.db.query(
        `SELECT COUNT(*) as count FROM agent_dependencies
         WHERE tenant_id = $1 AND status = 'pending'`,
        [tenantId]
      ),
      this.db.query(
        `SELECT COUNT(*) as count FROM resource_locks
         WHERE tenant_id = $1 AND released_at IS NULL AND expires_at > NOW()`,
        [tenantId]
      ),
      this.db.query(
        `SELECT COUNT(*) as count FROM blackboard_events
         WHERE tenant_id = $1 AND event_type = 'cycle_detected'
           AND created_at > NOW() - INTERVAL '24 hours'`,
        [tenantId]
      ),
      this.db.query(
        `SELECT event_type, created_at, details FROM blackboard_events
         WHERE tenant_id = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [tenantId]
      ),
    ]);

    const statusCounts = agentStats.rows.reduce((acc, row) => {
      acc[row.status] = parseInt(row.count, 10);
      return acc;
    }, {} as Record<string, number>);

    return {
      activeAgents: statusCounts.active || 0,
      waitingAgents: statusCounts.waiting || 0,
      blockedAgents: statusCounts.blocked || 0,
      pendingDependencies: parseInt(depStats.rows[0]?.count || '0', 10),
      activeLocks: parseInt(lockStats.rows[0]?.count || '0', 10),
      cyclesDetectedToday: parseInt(cycleStats.rows[0]?.count || '0', 10),
      recentEvents: events.rows.map(row => ({
        type: row.event_type,
        timestamp: row.created_at,
        details: row.details,
      })),
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private mapAgentRow(row: Record<string, unknown>): RegisteredAgent {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      agentType: row.agent_type as string,
      agentInstanceId: row.agent_instance_id as string,
      sessionId: row.session_id as string | undefined,
      status: row.status as RegisteredAgent['status'],
      blockedReason: row.blocked_reason as string | undefined,
      blockedByAgentId: row.blocked_by_agent_id as string | undefined,
      blockedByResourceId: row.blocked_by_resource_id as string | undefined,
      isHydrated: row.is_hydrated as boolean,
      startedAt: row.started_at as Date,
      lastHeartbeatAt: row.last_heartbeat_at as Date,
    };
  }

  private async logEvent(
    tenantId: string,
    eventType: string,
    details: Record<string, unknown>
  ): Promise<void> {
    if (!this.db) return;

    await this.db.query(
      `INSERT INTO blackboard_events (tenant_id, event_type, details)
       VALUES ($1, $2, $3)`,
      [tenantId, eventType, JSON.stringify(details)]
    );
  }
}

// Export singleton
export const agentOrchestratorService = new AgentOrchestratorService();
