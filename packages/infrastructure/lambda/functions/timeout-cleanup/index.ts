/**
 * Timeout Cleanup Lambda
 * 
 * Scheduled function that:
 * - Expires pending decisions past their timeout
 * - Escalates critical decisions via PagerDuty/Slack
 * - Updates Flyte workflows for expired decisions
 * - Maintains audit trail
 */

import { ScheduledHandler } from 'aws-lambda';
import { Client } from 'pg';
import { Redis } from 'ioredis';
import { SecretsManager } from '@aws-sdk/client-secrets-manager';
import { FlyteLauncher } from '../../shared/services/swarm/flyte-launcher';
import { requireEnv } from '../../shared/config/env';

// ============================================================================
// TYPES
// ============================================================================

interface ExpiredDecision {
  id: string;
  tenantId: string;
  domain: string;
  question: string;
  flyteExecutionId: string;
  flyteNodeId: string;
  catoEscalationId?: string;
}

interface DomainConfig {
  domain: string;
  autoEscalate: boolean;
  escalationChannel: string;
  escalationTarget: string;
  escalationTimeoutSeconds: number;
}

interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

const logger: Logger = {
  info: (message, meta) => console.log(JSON.stringify({ level: 'info', message, ...meta })),
  warn: (message, meta) => console.warn(JSON.stringify({ level: 'warn', message, ...meta })),
  error: (message, meta) => console.error(JSON.stringify({ level: 'error', message, ...meta })),
};

const secretsManager = new SecretsManager({});

let dbClient: Client | null = null;
let redis: Redis | null = null;
let flyteLauncher: FlyteLauncher | null = null;

async function initializeConnections(): Promise<void> {
  if (!dbClient) {
    const secret = await secretsManager.getSecretValue({
      SecretId: requireEnv('DB_SECRET_ARN'),
    });
    if (!secret.SecretString) {
      throw new Error('Database secret is empty or binary - expected JSON string');
    }
    const credentials = JSON.parse(secret.SecretString);

    dbClient = new Client({
      host: credentials.host,
      port: credentials.port,
      database: credentials.dbname,
      user: credentials.username,
      password: credentials.password,
      // Note: rejectUnauthorized: false is acceptable for Aurora within AWS VPC
      // Aurora uses AWS-managed certificates that may not chain to public CAs
      ssl: { rejectUnauthorized: false },
    });
    await dbClient.connect();
  }

  if (!redis) {
    redis = new Redis({
      host: requireEnv('REDIS_HOST'),
      port: parseInt(requireEnv('REDIS_PORT'), 10),
    });
  }

  if (!flyteLauncher) {
    flyteLauncher = new FlyteLauncher(
      requireEnv('FLYTE_ADMIN_URL'),
      'radiant',
      process.env.NODE_ENV === 'prod' ? 'production' : 'development',
      logger
    );
  }
}

// ============================================================================
// ESCALATION HANDLERS
// ============================================================================

async function escalateViaPagerDuty(
  decision: ExpiredDecision,
  config: DomainConfig
): Promise<void> {
  const routingKey = process.env.PAGERDUTY_ROUTING_KEY;
  if (!routingKey) {
    logger.warn('PagerDuty routing key not configured');
    return;
  }

  const payload = {
    routing_key: routingKey,
    event_action: 'trigger',
    dedup_key: decision.id,
    payload: {
      summary: `[${decision.domain.toUpperCase()}] Decision timeout: ${decision.question.substring(0, 100)}`,
      severity: decision.domain === 'medical' ? 'critical' : 'warning',
      source: 'radiant-mission-control',
      custom_details: {
        decision_id: decision.id,
        tenant_id: decision.tenantId,
        domain: decision.domain,
        question: decision.question,
        flyte_execution_id: decision.flyteExecutionId,
      },
    },
  };

  const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    logger.error('PagerDuty escalation failed', {
      decisionId: decision.id,
      status: response.status,
    });
  } else {
    logger.info('PagerDuty escalation sent', { decisionId: decision.id });
  }
}

async function escalateViaSlack(
  decision: ExpiredDecision,
  config: DomainConfig
): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    logger.warn('Slack webhook URL not configured');
    return;
  }

  const domainEmoji: Record<string, string> = {
    medical: '🏥',
    financial: '💰',
    legal: '⚖️',
    general: '💬',
  };

  const payload = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${domainEmoji[decision.domain] || '⚠️'} Decision Timeout Alert`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Domain:*\n${decision.domain.charAt(0).toUpperCase() + decision.domain.slice(1)}`,
          },
          {
            type: 'mrkdwn',
            text: `*Decision ID:*\n\`${decision.id.substring(0, 8)}...\``,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Question:*\n${decision.question.substring(0, 500)}`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View in Dashboard',
            },
            url: `https://admin.radiant.io/decisions/${decision.id}`,
            style: 'primary',
          },
        ],
      },
    ],
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    logger.error('Slack escalation failed', {
      decisionId: decision.id,
      status: response.status,
    });
  } else {
    logger.info('Slack escalation sent', { decisionId: decision.id });
  }
}

async function escalateViaEmail(
  decision: ExpiredDecision,
  config: DomainConfig
): Promise<void> {
  logger.info('Email escalation would be sent', {
    decisionId: decision.id,
    target: config.escalationTarget,
  });
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

async function processExpiredDecisions(): Promise<{
  expired: number;
  escalated: number;
  aborted: number;
}> {
  await initializeConnections();

  let expired = 0;
  let escalated = 0;
  let aborted = 0;

  const expiredResult = await dbClient!.query(`
    UPDATE pending_decisions 
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'pending' AND expires_at < NOW()
    RETURNING id, tenant_id, domain, question, flyte_execution_id, flyte_node_id, cato_escalation_id
  `);

  for (const row of expiredResult.rows) {
    const decision: ExpiredDecision = {
      id: row.id,
      tenantId: row.tenant_id,
      domain: row.domain,
      question: row.question,
      flyteExecutionId: row.flyte_execution_id,
      flyteNodeId: row.flyte_node_id,
      catoEscalationId: row.cato_escalation_id,
    };

    expired++;

    await dbClient!.query(
      `INSERT INTO decision_audit (decision_id, tenant_id, action, actor_type, details)
       VALUES ($1, $2, 'expired', 'system', $3)`,
      [decision.id, decision.tenantId, JSON.stringify({ expired_at: new Date().toISOString() })]
    );

    await redis!.publish(
      `decision_expired:${decision.tenantId}`,
      JSON.stringify({
        decisionId: decision.id,
        domain: decision.domain,
        timestamp: new Date().toISOString(),
      })
    );

    const configResult = await dbClient!.query(
      `SELECT * FROM decision_domain_config 
       WHERE (tenant_id = $1 OR tenant_id IS NULL) AND domain = $2
       ORDER BY tenant_id NULLS LAST LIMIT 1`,
      [decision.tenantId, decision.domain]
    );

    const config: DomainConfig = configResult.rows[0] || {
      domain: decision.domain,
      autoEscalate: true,
      escalationChannel: 'slack',
      escalationTarget: '',
      escalationTimeoutSeconds: 300,
    };

    if (decision.domain === 'medical' || decision.domain === 'financial') {
      await escalateViaPagerDuty(decision, config);

      await dbClient!.query(
        `UPDATE pending_decisions SET status = 'escalated' WHERE id = $1`,
        [decision.id]
      );

      escalated++;
    } else if (config.autoEscalate) {
      switch (config.escalationChannel) {
        case 'pagerduty':
          await escalateViaPagerDuty(decision, config);
          break;
        case 'slack':
          await escalateViaSlack(decision, config);
          break;
        case 'email':
          await escalateViaEmail(decision, config);
          break;
      }

      escalated++;

      try {
        await flyteLauncher!.abortExecution(
          decision.flyteExecutionId,
          `Decision ${decision.id} expired without human response`
        );
        aborted++;
      } catch (error) {
        logger.error('Failed to abort Flyte execution', {
          decisionId: decision.id,
          executionId: decision.flyteExecutionId,
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    } else {
      try {
        await flyteLauncher!.abortExecution(
          decision.flyteExecutionId,
          `Decision ${decision.id} expired without human response`
        );
        aborted++;
      } catch (error) {
        logger.error('Failed to abort Flyte execution', {
          decisionId: decision.id,
          executionId: decision.flyteExecutionId,
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }

    if (decision.catoEscalationId) {
      await dbClient!.query(
        `UPDATE cato_human_escalations 
         SET status = 'EXPIRED'
         WHERE id = $1`,
        [decision.catoEscalationId]
      );
    }
  }

  return { expired, escalated, aborted };
}

// ============================================================================
// LAMBDA HANDLER
// ============================================================================

export const handler: ScheduledHandler = async () => {
  const startTime = Date.now();

  try {
    const result = await processExpiredDecisions();

    const duration = Date.now() - startTime;

    logger.info('Timeout cleanup completed', {
      ...result,
      durationMs: duration,
    });

    // ScheduledHandler returns void
  } catch (error) {
    logger.error('Timeout cleanup failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });

    throw error;
  }
};
