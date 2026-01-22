/**
 * RADIANT v5.38.0 - Sovereign Mesh SQS Dispatcher Service
 * 
 * Handles actual SQS message dispatch for agent execution iterations.
 * This fixes the broken async flow where queueNextIteration() only logged.
 */

import { SQSClient, SendMessageCommand, SendMessageBatchCommand, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import { enhancedLogger } from '../../logging/enhanced-logger';
import { executeStatement, stringParam } from '../../db/client';

const logger = enhancedLogger;

// ============================================================================
// TYPES
// ============================================================================

export interface ExecutionMessage {
  type: 'start' | 'iterate' | 'resume' | 'cancel';
  executionId: string;
  tenantId: string;
  agentId?: string;
  goal?: string;
  constraints?: Record<string, unknown>;
  modifications?: Record<string, unknown>;
  reason?: string;
  priority?: 'low' | 'normal' | 'high';
  scheduledFor?: string; // ISO timestamp for delayed messages
}

export interface DispatchResult {
  success: boolean;
  messageId?: string;
  error?: string;
  queueUrl: string;
}

export interface QueueMetrics {
  approximateMessages: number;
  approximateMessagesNotVisible: number;
  approximateMessagesDelayed: number;
}

export interface TenantQueueInfo {
  queueUrl: string;
  dlqUrl?: string;
  isFifo: boolean;
  isDedicated: boolean;
}

// ============================================================================
// SQS DISPATCHER SERVICE
// ============================================================================

class SQSDispatcherService {
  private sqsClient: SQSClient;
  private defaultQueueUrl: string;
  private tenantQueueCache: Map<string, { info: TenantQueueInfo; cachedAt: number }> = new Map();
  private readonly TENANT_QUEUE_CACHE_TTL = 300000; // 5 minutes

  constructor() {
    this.sqsClient = new SQSClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    this.defaultQueueUrl = process.env.AGENT_EXECUTION_QUEUE_URL || '';
  }

  /**
   * Queue the next iteration for an execution
   */
  async queueNextIteration(executionId: string, tenantId: string): Promise<DispatchResult> {
    const message: ExecutionMessage = {
      type: 'iterate',
      executionId,
      tenantId,
    };

    return this.dispatch(message);
  }

  /**
   * Queue a new execution start
   */
  async queueExecutionStart(
    executionId: string,
    tenantId: string,
    agentId: string,
    goal: string,
    constraints?: Record<string, unknown>
  ): Promise<DispatchResult> {
    const message: ExecutionMessage = {
      type: 'start',
      executionId,
      tenantId,
      agentId,
      goal,
      constraints,
    };

    return this.dispatch(message);
  }

  /**
   * Queue execution resume after HITL approval
   */
  async queueExecutionResume(
    executionId: string,
    tenantId: string,
    modifications?: Record<string, unknown>
  ): Promise<DispatchResult> {
    const message: ExecutionMessage = {
      type: 'resume',
      executionId,
      tenantId,
      modifications,
    };

    return this.dispatch(message);
  }

  /**
   * Queue execution cancellation
   */
  async queueExecutionCancel(
    executionId: string,
    tenantId: string,
    reason?: string
  ): Promise<DispatchResult> {
    const message: ExecutionMessage = {
      type: 'cancel',
      executionId,
      tenantId,
      reason,
    };

    return this.dispatch(message);
  }

  /**
   * Dispatch a message to the appropriate queue
   */
  async dispatch(message: ExecutionMessage): Promise<DispatchResult> {
    try {
      // Get the queue URL for this tenant
      const queueInfo = await this.getQueueForTenant(message.tenantId);
      const queueUrl = queueInfo.queueUrl;

      if (!queueUrl) {
        throw new Error('No queue URL available');
      }

      // Build SQS message
      const messageBody = JSON.stringify(message);
      const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: messageBody,
        MessageAttributes: {
          tenantId: {
            DataType: 'String',
            StringValue: message.tenantId,
          },
          executionId: {
            DataType: 'String',
            StringValue: message.executionId,
          },
          messageType: {
            DataType: 'String',
            StringValue: message.type,
          },
        },
        // For FIFO queues
        ...(queueInfo.isFifo && {
          MessageGroupId: message.tenantId, // Group by tenant for ordering
          MessageDeduplicationId: `${message.executionId}-${message.type}-${Date.now()}`,
        }),
        // For delayed messages
        ...(message.scheduledFor && {
          DelaySeconds: Math.max(0, Math.min(900, Math.floor(
            (new Date(message.scheduledFor).getTime() - Date.now()) / 1000
          ))),
        }),
      });

      const response = await this.sqsClient.send(command);

      logger.info('Message dispatched to SQS', {
        executionId: message.executionId,
        messageId: response.MessageId,
        queueUrl,
        type: message.type,
      });

      return {
        success: true,
        messageId: response.MessageId,
        queueUrl,
      };
    } catch (error: any) {
      logger.error('Failed to dispatch message to SQS', {
        executionId: message.executionId,
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
        queueUrl: this.defaultQueueUrl,
      };
    }
  }

  /**
   * Dispatch multiple messages in a batch
   */
  async dispatchBatch(messages: ExecutionMessage[]): Promise<DispatchResult[]> {
    if (messages.length === 0) {
      return [];
    }

    // Group messages by tenant for potential dedicated queues
    const messagesByTenant = new Map<string, ExecutionMessage[]>();
    for (const msg of messages) {
      const existing = messagesByTenant.get(msg.tenantId) || [];
      existing.push(msg);
      messagesByTenant.set(msg.tenantId, existing);
    }

    const results: DispatchResult[] = [];

    for (const [tenantId, tenantMessages] of messagesByTenant) {
      const queueInfo = await this.getQueueForTenant(tenantId);

      // SQS batch limit is 10 messages
      for (let i = 0; i < tenantMessages.length; i += 10) {
        const batch = tenantMessages.slice(i, i + 10);

        try {
          const command = new SendMessageBatchCommand({
            QueueUrl: queueInfo.queueUrl,
            Entries: batch.map((msg, idx) => ({
              Id: `${idx}`,
              MessageBody: JSON.stringify(msg),
              MessageAttributes: {
                tenantId: { DataType: 'String', StringValue: msg.tenantId },
                executionId: { DataType: 'String', StringValue: msg.executionId },
                messageType: { DataType: 'String', StringValue: msg.type },
              },
              ...(queueInfo.isFifo && {
                MessageGroupId: msg.tenantId,
                MessageDeduplicationId: `${msg.executionId}-${msg.type}-${Date.now()}-${idx}`,
              }),
            })),
          });

          const response = await this.sqsClient.send(command);

          // Map results back
          for (const successful of response.Successful || []) {
            results.push({
              success: true,
              messageId: successful.MessageId,
              queueUrl: queueInfo.queueUrl,
            });
          }

          for (const failed of response.Failed || []) {
            results.push({
              success: false,
              error: failed.Message,
              queueUrl: queueInfo.queueUrl,
            });
          }
        } catch (error: any) {
          // Mark all in batch as failed
          for (const msg of batch) {
            results.push({
              success: false,
              error: error.message,
              queueUrl: queueInfo.queueUrl,
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Get queue metrics
   */
  async getQueueMetrics(queueUrl?: string): Promise<QueueMetrics> {
    const url = queueUrl || this.defaultQueueUrl;

    try {
      const command = new GetQueueAttributesCommand({
        QueueUrl: url,
        AttributeNames: [
          'ApproximateNumberOfMessages',
          'ApproximateNumberOfMessagesNotVisible',
          'ApproximateNumberOfMessagesDelayed',
        ],
      });

      const response = await this.sqsClient.send(command);

      return {
        approximateMessages: parseInt(response.Attributes?.ApproximateNumberOfMessages || '0', 10),
        approximateMessagesNotVisible: parseInt(response.Attributes?.ApproximateNumberOfMessagesNotVisible || '0', 10),
        approximateMessagesDelayed: parseInt(response.Attributes?.ApproximateNumberOfMessagesDelayed || '0', 10),
      };
    } catch (error: any) {
      logger.error('Failed to get queue metrics', { queueUrl: url, error: error.message });
      return {
        approximateMessages: 0,
        approximateMessagesNotVisible: 0,
        approximateMessagesDelayed: 0,
      };
    }
  }

  /**
   * Get the appropriate queue for a tenant (shared or dedicated)
   */
  private async getQueueForTenant(tenantId: string): Promise<TenantQueueInfo> {
    // Check cache first
    const cached = this.tenantQueueCache.get(tenantId);
    if (cached && Date.now() - cached.cachedAt < this.TENANT_QUEUE_CACHE_TTL) {
      return cached.info;
    }

    try {
      // Check if tenant has a dedicated queue
      const result = await executeStatement(
        `SELECT queue_url, dlq_url, is_fifo 
         FROM sovereign_mesh_tenant_queues 
         WHERE tenant_id = :tenantId 
           AND queue_type = 'agent_execution' 
           AND is_active = true`,
        [stringParam('tenantId', tenantId)]
      );

      if (result.rows?.[0]) {
        const row = result.rows[0];
        const info: TenantQueueInfo = {
          queueUrl: row.queue_url as string,
          dlqUrl: row.dlq_url as string | undefined,
          isFifo: row.is_fifo as boolean,
          isDedicated: true,
        };
        this.tenantQueueCache.set(tenantId, { info, cachedAt: Date.now() });
        return info;
      }
    } catch (error) {
      // Fall through to default
      logger.warn('Failed to check for dedicated tenant queue', { tenantId, error });
    }

    // Use default shared queue
    const defaultInfo: TenantQueueInfo = {
      queueUrl: this.defaultQueueUrl,
      isFifo: this.defaultQueueUrl.endsWith('.fifo'),
      isDedicated: false,
    };
    this.tenantQueueCache.set(tenantId, { info: defaultInfo, cachedAt: Date.now() });
    return defaultInfo;
  }

  /**
   * Clear tenant queue cache (call when queue config changes)
   */
  clearTenantQueueCache(tenantId?: string): void {
    if (tenantId) {
      this.tenantQueueCache.delete(tenantId);
    } else {
      this.tenantQueueCache.clear();
    }
  }

  /**
   * Set default queue URL (for testing or dynamic config)
   */
  setDefaultQueueUrl(url: string): void {
    this.defaultQueueUrl = url;
  }
}

// Export singleton instance
export const sqsDispatcherService = new SQSDispatcherService();
