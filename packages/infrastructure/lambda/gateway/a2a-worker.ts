/**
 * RADIANT A2A (Agent-to-Agent) Worker Lambda
 * 
 * Production NATS consumer for A2A protocol messages.
 * Handles agent-to-agent communication with mTLS authentication.
 * 
 * Architecture:
 * - Go Gateway terminates WebSocket/SSE connections
 * - Gateway authenticates A2A agents via mTLS certificates
 * - Messages published to NATS JetStream
 * - This worker consumes and processes A2A requests
 * - Responses dual-published to NATS and stored for resume
 * 
 * A2A Protocol Features:
 * - Agent registration and discovery
 * - Direct agent-to-agent messaging
 * - Resource sharing and locking
 * - Collaborative task execution
 * - Event broadcasting
 */

import { Handler, SQSEvent, SQSRecord } from 'aws-lambda';
import { connect, NatsConnection, JetStreamClient, JetStreamManager, AckPolicy, DeliverPolicy } from 'nats';
import { logger } from '../shared/logger';
import { MetricUnit, Metrics } from '@aws-lambda-powertools/metrics';
import { executeStatement } from '../shared/utils/db';
import { cedarAuthorizationService, Principal } from '../shared/services/cedar/cedar-authorization.service';

const metrics = new Metrics({ namespace: 'RADIANT/A2A', serviceName: 'a2a-worker' });

// ============================================================================
// Types
// ============================================================================

interface A2AMessage {
  messageId: string;
  sessionId: string;
  tenantId: string;
  fromAgentId: string;
  toAgentId?: string;  // null = broadcast
  securityContext: {
    principal_id: string;
    principal_type: 'agent';
    tenant_id: string;
    agent_type: string;
    scopes: string[];
    mtls_verified: boolean;
    cert_fingerprint?: string;
  };
  protocol: 'a2a';
  protocolVersion: string;
  messageType: A2AMessageType;
  payload: A2APayload;
  receivedAt: string;
}

type A2AMessageType = 
  | 'register'
  | 'discover'
  | 'message'
  | 'broadcast'
  | 'request'
  | 'response'
  | 'subscribe'
  | 'unsubscribe'
  | 'heartbeat'
  | 'acquire_lock'
  | 'release_lock'
  | 'task_start'
  | 'task_update'
  | 'task_complete';

interface A2APayload {
  // Common fields
  requestId?: string;
  correlationId?: string;
  
  // Registration
  agentName?: string;
  agentType?: string;
  agentVersion?: string;
  capabilities?: string[];
  webhookUrl?: string;
  
  // Discovery
  filterType?: string;
  filterCapabilities?: string[];
  
  // Messaging
  content?: unknown;
  contentType?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  ttlSeconds?: number;
  
  // Resource locking
  resourceUri?: string;
  lockType?: 'read' | 'write' | 'exclusive';
  lockTimeout?: number;
  
  // Task coordination
  taskId?: string;
  taskType?: string;
  taskStatus?: string;
  taskProgress?: number;
  taskResult?: unknown;
  
  // Subscription
  topic?: string;
  filter?: Record<string, unknown>;
}

interface A2AResponse {
  messageId: string;
  correlationId?: string;
  success: boolean;
  messageType: string;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

// ============================================================================
// A2A Worker Service
// ============================================================================

export class A2AWorkerService {
  private nats: NatsConnection | null = null;
  private js: JetStreamClient | null = null;
  private jsm: JetStreamManager | null = null;

  async initialize(): Promise<void> {
    const natsUrl = process.env.NATS_URL || 'nats://nats.gateway.radiant.internal:4222';
    
    try {
      this.nats = await connect({
        servers: natsUrl,
        name: 'radiant-a2a-worker',
        reconnect: true,
        maxReconnectAttempts: -1,
        reconnectTimeWait: 1000,
      });

      this.js = this.nats.jetstream();
      this.jsm = await this.nats.jetstreamManager();

      // Ensure A2A stream exists
      try {
        await this.jsm.streams.add({
          name: 'A2A',
          subjects: ['a2a.>'],
          retention: 'limits' as any,
          max_msgs: 1000000,
          max_age: 24 * 60 * 60 * 1e9, // 24 hours in nanoseconds
          storage: 'file' as any,
          replicas: 1,
        });
      } catch (e: any) {
        if (!e.message?.includes('already in use')) {
          throw e;
        }
      }

      logger.info('A2A Worker initialized', { natsUrl });
    } catch (error) {
      logger.error('Failed to initialize A2A Worker', { error });
      throw error;
    }
  }

  async processMessage(message: A2AMessage): Promise<A2AResponse> {
    const startTime = Date.now();
    
    logger.info('Processing A2A message', {
      messageId: message.messageId,
      messageType: message.messageType,
      fromAgentId: message.fromAgentId,
      toAgentId: message.toAgentId,
    });

    try {
      // Verify mTLS if required
      if (!message.securityContext.mtls_verified) {
        const policy = await this.getInterfacePolicy(message.tenantId);
        if (policy?.require_mtls) {
          return this.createError(message, 'MTLS_REQUIRED', 'mTLS authentication required for A2A');
        }
      }

      // Build principal for authorization
      const principal = this.buildPrincipal(message.securityContext);

      // Route by message type
      let response: A2AResponse;
      switch (message.messageType) {
        case 'register':
          response = await this.handleRegister(message, principal);
          break;
        case 'discover':
          response = await this.handleDiscover(message, principal);
          break;
        case 'message':
        case 'request':
          response = await this.handleDirectMessage(message, principal);
          break;
        case 'broadcast':
          response = await this.handleBroadcast(message, principal);
          break;
        case 'response':
          response = await this.handleResponse(message, principal);
          break;
        case 'subscribe':
          response = await this.handleSubscribe(message, principal);
          break;
        case 'unsubscribe':
          response = await this.handleUnsubscribe(message, principal);
          break;
        case 'heartbeat':
          response = await this.handleHeartbeat(message, principal);
          break;
        case 'acquire_lock':
          response = await this.handleAcquireLock(message, principal);
          break;
        case 'release_lock':
          response = await this.handleReleaseLock(message, principal);
          break;
        case 'task_start':
        case 'task_update':
        case 'task_complete':
          response = await this.handleTaskEvent(message, principal);
          break;
        default:
          response = this.createError(message, 'UNKNOWN_MESSAGE_TYPE', `Unknown message type: ${message.messageType}`);
      }

      // Publish response to NATS
      await this.publishResponse(message, response);

      // Log audit
      await this.logAudit(message, response, Date.now() - startTime);

      metrics.addMetric('A2AMessageProcessed', MetricUnit.Count, 1);
      metrics.addMetric(`A2A_${message.messageType}`, MetricUnit.Count, 1);
      metrics.addMetric('A2ALatency', MetricUnit.Milliseconds, Date.now() - startTime);

      return response;
    } catch (error) {
      logger.error('A2A message processing failed', { error, messageId: message.messageId });
      metrics.addMetric('A2AMessageFailed', MetricUnit.Count, 1);
      return this.createError(message, 'PROCESSING_ERROR', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // ============================================================================
  // Message Handlers
  // ============================================================================

  private async handleRegister(message: A2AMessage, principal: Principal): Promise<A2AResponse> {
    const { agentName, agentType, agentVersion, capabilities, webhookUrl } = message.payload;

    if (!agentName || !agentType) {
      return this.createError(message, 'INVALID_PAYLOAD', 'agentName and agentType are required');
    }

    // Check authorization
    const authResult = await cedarAuthorizationService.authorize({
      principal,
      action: 'a2a:register',
      resource: {
        type: 'A2ARegistry',
        id: message.tenantId,
        tenantId: message.tenantId,
      },
      context: { agentType },
    });

    if (!authResult.allowed) {
      return this.createError(message, 'UNAUTHORIZED', 'Agent registration not authorized');
    }

    // Register agent
    const result = await executeStatement(`
      INSERT INTO a2a_registered_agents (
        tenant_id, agent_id, agent_name, agent_type, agent_version,
        supported_operations, webhook_url, status, last_heartbeat_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW())
      ON CONFLICT (tenant_id, agent_id) DO UPDATE SET
        agent_name = EXCLUDED.agent_name,
        agent_version = EXCLUDED.agent_version,
        supported_operations = EXCLUDED.supported_operations,
        webhook_url = EXCLUDED.webhook_url,
        status = 'active',
        last_heartbeat_at = NOW(),
        updated_at = NOW()
      RETURNING id, created_at
    `, [
      { name: 'tenantId', value: { stringValue: message.tenantId } },
      { name: 'agentId', value: { stringValue: message.fromAgentId } },
      { name: 'agentName', value: { stringValue: agentName } },
      { name: 'agentType', value: { stringValue: agentType } },
      { name: 'agentVersion', value: agentVersion ? { stringValue: agentVersion } : { isNull: true } },
      { name: 'capabilities', value: { stringValue: `{${(capabilities || []).join(',')}}` } },
      { name: 'webhookUrl', value: webhookUrl ? { stringValue: webhookUrl } : { isNull: true } },
    ]);

    return {
      messageId: message.messageId,
      correlationId: message.payload.correlationId,
      success: true,
      messageType: 'register_ack',
      data: {
        agentId: message.fromAgentId,
        registrationId: result.rows[0]?.id,
        status: 'active',
      },
      timestamp: new Date().toISOString(),
    };
  }

  private async handleDiscover(message: A2AMessage, principal: Principal): Promise<A2AResponse> {
    const { filterType, filterCapabilities } = message.payload;

    // Find matching agents
    let query = `
      SELECT agent_id, agent_name, agent_type, agent_version, 
             supported_operations, status, last_heartbeat_at
      FROM a2a_registered_agents
      WHERE tenant_id = $1 AND status = 'active'
    `;
    const params: any[] = [
      { name: 'tenantId', value: { stringValue: message.tenantId } },
    ];

    if (filterType) {
      query += ` AND agent_type = $2`;
      params.push({ name: 'filterType', value: { stringValue: filterType } });
    }

    if (filterCapabilities && filterCapabilities.length > 0) {
      query += ` AND supported_operations && $${params.length + 1}`;
      params.push({ name: 'filterCaps', value: { stringValue: `{${filterCapabilities.join(',')}}` } });
    }

    query += ` ORDER BY last_heartbeat_at DESC LIMIT 100`;

    const result = await executeStatement(query, params);

    return {
      messageId: message.messageId,
      correlationId: message.payload.correlationId,
      success: true,
      messageType: 'discover_response',
      data: {
        agents: result.rows.map((row: any) => ({
          agentId: row.agent_id,
          agentName: row.agent_name,
          agentType: row.agent_type,
          agentVersion: row.agent_version,
          capabilities: row.supported_operations,
          status: row.status,
          lastSeen: row.last_heartbeat_at,
        })),
        total: result.rows.length,
      },
      timestamp: new Date().toISOString(),
    };
  }

  private async handleDirectMessage(message: A2AMessage, principal: Principal): Promise<A2AResponse> {
    if (!message.toAgentId) {
      return this.createError(message, 'INVALID_PAYLOAD', 'toAgentId is required for direct messages');
    }

    // Verify target agent exists
    const targetResult = await executeStatement(`
      SELECT id, status, webhook_url FROM a2a_registered_agents
      WHERE tenant_id = $1 AND agent_id = $2
    `, [
      { name: 'tenantId', value: { stringValue: message.tenantId } },
      { name: 'agentId', value: { stringValue: message.toAgentId } },
    ]);

    if (targetResult.rows.length === 0) {
      return this.createError(message, 'AGENT_NOT_FOUND', `Agent ${message.toAgentId} not found`);
    }

    const target = targetResult.rows[0] as any;
    if (target.status !== 'active') {
      return this.createError(message, 'AGENT_UNAVAILABLE', `Agent ${message.toAgentId} is ${target.status}`);
    }

    // Publish to target agent's NATS subject
    if (this.js) {
      await this.js.publish(`a2a.${message.tenantId}.${message.toAgentId}`, JSON.stringify({
        type: message.messageType,
        fromAgentId: message.fromAgentId,
        requestId: message.payload.requestId,
        correlationId: message.payload.correlationId,
        content: message.payload.content,
        contentType: message.payload.contentType,
        priority: message.payload.priority,
        timestamp: new Date().toISOString(),
      }));
    }

    // Update sender's request count
    await executeStatement(`
      UPDATE a2a_registered_agents SET
        total_requests = total_requests + 1,
        last_request_at = NOW()
      WHERE tenant_id = $1 AND agent_id = $2
    `, [
      { name: 'tenantId', value: { stringValue: message.tenantId } },
      { name: 'agentId', value: { stringValue: message.fromAgentId } },
    ]);

    return {
      messageId: message.messageId,
      correlationId: message.payload.correlationId,
      success: true,
      messageType: 'message_ack',
      data: {
        delivered: true,
        toAgentId: message.toAgentId,
      },
      timestamp: new Date().toISOString(),
    };
  }

  private async handleBroadcast(message: A2AMessage, principal: Principal): Promise<A2AResponse> {
    const { topic, content, contentType, priority } = message.payload;

    if (!topic) {
      return this.createError(message, 'INVALID_PAYLOAD', 'topic is required for broadcasts');
    }

    // Publish to broadcast topic
    if (this.js) {
      await this.js.publish(`a2a.${message.tenantId}.broadcast.${topic}`, JSON.stringify({
        type: 'broadcast',
        fromAgentId: message.fromAgentId,
        topic,
        content,
        contentType,
        priority,
        timestamp: new Date().toISOString(),
      }));
    }

    return {
      messageId: message.messageId,
      correlationId: message.payload.correlationId,
      success: true,
      messageType: 'broadcast_ack',
      data: {
        topic,
        broadcast: true,
      },
      timestamp: new Date().toISOString(),
    };
  }

  private async handleResponse(message: A2AMessage, principal: Principal): Promise<A2AResponse> {
    // Forward response to original requester
    if (message.toAgentId && this.js) {
      await this.js.publish(`a2a.${message.tenantId}.${message.toAgentId}.response`, JSON.stringify({
        type: 'response',
        fromAgentId: message.fromAgentId,
        correlationId: message.payload.correlationId,
        content: message.payload.content,
        timestamp: new Date().toISOString(),
      }));
    }

    return {
      messageId: message.messageId,
      correlationId: message.payload.correlationId,
      success: true,
      messageType: 'response_ack',
      data: { delivered: true },
      timestamp: new Date().toISOString(),
    };
  }

  private async handleSubscribe(message: A2AMessage, principal: Principal): Promise<A2AResponse> {
    const { topic, filter } = message.payload;

    if (!topic) {
      return this.createError(message, 'INVALID_PAYLOAD', 'topic is required');
    }

    // Store subscription (in-memory for this worker, also persisted)
    await executeStatement(`
      INSERT INTO a2a_subscriptions (tenant_id, agent_id, topic, filter_config, subscribed_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (tenant_id, agent_id, topic) DO UPDATE SET
        filter_config = EXCLUDED.filter_config,
        subscribed_at = NOW()
    `, [
      { name: 'tenantId', value: { stringValue: message.tenantId } },
      { name: 'agentId', value: { stringValue: message.fromAgentId } },
      { name: 'topic', value: { stringValue: topic } },
      { name: 'filter', value: filter ? { stringValue: JSON.stringify(filter) } : { isNull: true } },
    ]);

    return {
      messageId: message.messageId,
      correlationId: message.payload.correlationId,
      success: true,
      messageType: 'subscribe_ack',
      data: { topic, subscribed: true },
      timestamp: new Date().toISOString(),
    };
  }

  private async handleUnsubscribe(message: A2AMessage, principal: Principal): Promise<A2AResponse> {
    const { topic } = message.payload;

    if (!topic) {
      return this.createError(message, 'INVALID_PAYLOAD', 'topic is required');
    }

    await executeStatement(`
      DELETE FROM a2a_subscriptions
      WHERE tenant_id = $1 AND agent_id = $2 AND topic = $3
    `, [
      { name: 'tenantId', value: { stringValue: message.tenantId } },
      { name: 'agentId', value: { stringValue: message.fromAgentId } },
      { name: 'topic', value: { stringValue: topic } },
    ]);

    return {
      messageId: message.messageId,
      correlationId: message.payload.correlationId,
      success: true,
      messageType: 'unsubscribe_ack',
      data: { topic, unsubscribed: true },
      timestamp: new Date().toISOString(),
    };
  }

  private async handleHeartbeat(message: A2AMessage, principal: Principal): Promise<A2AResponse> {
    await executeStatement(`
      UPDATE a2a_registered_agents SET
        last_heartbeat_at = NOW(),
        status = 'active'
      WHERE tenant_id = $1 AND agent_id = $2
    `, [
      { name: 'tenantId', value: { stringValue: message.tenantId } },
      { name: 'agentId', value: { stringValue: message.fromAgentId } },
    ]);

    return {
      messageId: message.messageId,
      success: true,
      messageType: 'heartbeat_ack',
      data: { timestamp: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    };
  }

  private async handleAcquireLock(message: A2AMessage, principal: Principal): Promise<A2AResponse> {
    const { resourceUri, lockType, lockTimeout } = message.payload;

    if (!resourceUri || !lockType) {
      return this.createError(message, 'INVALID_PAYLOAD', 'resourceUri and lockType are required');
    }

    // Try to acquire lock via agent orchestrator
    const result = await executeStatement(`
      SELECT acquire_resource_lock($1, $2, $3, $4, $5) as lock_result
    `, [
      { name: 'tenantId', value: { stringValue: message.tenantId } },
      { name: 'resourceUri', value: { stringValue: resourceUri } },
      { name: 'agentId', value: { stringValue: message.fromAgentId } },
      { name: 'lockType', value: { stringValue: lockType } },
      { name: 'timeout', value: { longValue: lockTimeout || 300 } },
    ]);

    const lockResult = result.rows[0]?.lock_result;

    if (lockResult?.acquired) {
      return {
        messageId: message.messageId,
        correlationId: message.payload.correlationId,
        success: true,
        messageType: 'lock_acquired',
        data: {
          lockId: lockResult.lock_id,
          resourceUri,
          lockType,
          expiresAt: lockResult.expires_at,
        },
        timestamp: new Date().toISOString(),
      };
    } else {
      return this.createError(message, 'LOCK_FAILED', lockResult?.reason || 'Could not acquire lock');
    }
  }

  private async handleReleaseLock(message: A2AMessage, principal: Principal): Promise<A2AResponse> {
    const { resourceUri } = message.payload;

    if (!resourceUri) {
      return this.createError(message, 'INVALID_PAYLOAD', 'resourceUri is required');
    }

    await executeStatement(`
      SELECT release_resource_lock($1, $2, $3) as released
    `, [
      { name: 'tenantId', value: { stringValue: message.tenantId } },
      { name: 'resourceUri', value: { stringValue: resourceUri } },
      { name: 'agentId', value: { stringValue: message.fromAgentId } },
    ]);

    return {
      messageId: message.messageId,
      correlationId: message.payload.correlationId,
      success: true,
      messageType: 'lock_released',
      data: { resourceUri, released: true },
      timestamp: new Date().toISOString(),
    };
  }

  private async handleTaskEvent(message: A2AMessage, principal: Principal): Promise<A2AResponse> {
    const { taskId, taskType, taskStatus, taskProgress, taskResult } = message.payload;

    // Broadcast task event to subscribed agents
    if (this.js) {
      await this.js.publish(`a2a.${message.tenantId}.tasks.${taskId || 'new'}`, JSON.stringify({
        type: message.messageType,
        fromAgentId: message.fromAgentId,
        taskId,
        taskType,
        taskStatus,
        taskProgress,
        taskResult,
        timestamp: new Date().toISOString(),
      }));
    }

    return {
      messageId: message.messageId,
      correlationId: message.payload.correlationId,
      success: true,
      messageType: `${message.messageType}_ack`,
      data: { taskId, acknowledged: true },
      timestamp: new Date().toISOString(),
    };
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private buildPrincipal(securityContext: A2AMessage['securityContext']): Principal {
    return {
      type: 'Agent',
      id: securityContext.principal_id,
      tenantId: securityContext.tenant_id,
      role: 'agent',
      tier: 'standard',
      scopes: securityContext.scopes || ['a2a:basic'],
      labels: [securityContext.agent_type],
      namespace: 'a2a',
      active: true,
    };
  }

  private createError(message: A2AMessage, code: string, errorMessage: string): A2AResponse {
    return {
      messageId: message.messageId,
      correlationId: message.payload.correlationId,
      success: false,
      messageType: 'error',
      error: { code, message: errorMessage },
      timestamp: new Date().toISOString(),
    };
  }

  private async getInterfacePolicy(tenantId: string): Promise<any> {
    const result = await executeStatement(`
      SELECT * FROM interface_access_policies
      WHERE (tenant_id = $1 OR tenant_id IS NULL)
        AND interface_type = 'a2a'
        AND is_enabled = true
      ORDER BY tenant_id NULLS LAST
      LIMIT 1
    `, [{ name: 'tenantId', value: { stringValue: tenantId } }]);

    return result.rows[0];
  }

  private async publishResponse(message: A2AMessage, response: A2AResponse): Promise<void> {
    if (!this.js) return;

    try {
      // Publish to response subject
      await this.js.publish(
        `a2a.${message.tenantId}.${message.fromAgentId}.response`,
        JSON.stringify(response)
      );
    } catch (error) {
      logger.error('Failed to publish A2A response', { error, messageId: message.messageId });
    }
  }

  private async logAudit(message: A2AMessage, response: A2AResponse, durationMs: number): Promise<void> {
    try {
      await executeStatement(`
        INSERT INTO api_key_audit_log (
          tenant_id, action, interface_type, a2a_agent_id, a2a_operation,
          success, error_code, error_message, metadata
        ) VALUES ($1, $2, 'a2a', $3, $4, $5, $6, $7, $8)
      `, [
        { name: 'tenantId', value: { stringValue: message.tenantId } },
        { name: 'action', value: { stringValue: response.success ? 'a2a_auth_success' : 'a2a_auth_failure' } },
        { name: 'agentId', value: { stringValue: message.fromAgentId } },
        { name: 'operation', value: { stringValue: message.messageType } },
        { name: 'success', value: { booleanValue: response.success } },
        { name: 'errorCode', value: response.error?.code ? { stringValue: response.error.code } : { isNull: true } },
        { name: 'errorMsg', value: response.error?.message ? { stringValue: response.error.message } : { isNull: true } },
        { name: 'metadata', value: { stringValue: JSON.stringify({ durationMs, messageId: message.messageId }) } },
      ]);
    } catch (error) {
      logger.warn('Failed to log A2A audit', { error });
    }
  }

  async shutdown(): Promise<void> {
    if (this.nats) {
      await this.nats.drain();
      await this.nats.close();
    }
  }
}

// ============================================================================
// Lambda Handler
// ============================================================================

const workerService = new A2AWorkerService();
let initialized = false;

export const handler: Handler<SQSEvent> = async (event) => {
  if (!initialized) {
    await workerService.initialize();
    initialized = true;
  }

  const results: Array<{ messageId: string; success: boolean }> = [];

  for (const record of event.Records) {
    try {
      const message: A2AMessage = JSON.parse(record.body);
      const response = await workerService.processMessage(message);
      results.push({ messageId: message.messageId, success: response.success });
    } catch (error) {
      logger.error('Failed to process SQS record', { error, messageId: record.messageId });
      results.push({ messageId: record.messageId, success: false });
    }
  }

  // Return failed message IDs for retry
  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    return {
      batchItemFailures: failures.map(f => ({ itemIdentifier: f.messageId })),
    };
  }

  return { batchItemFailures: [] };
};

export { A2AWorkerService, handler as a2aWorkerHandler };
