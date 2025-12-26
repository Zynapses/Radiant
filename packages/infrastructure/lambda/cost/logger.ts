// RADIANT v4.18.0 - Cost Logger Lambda Handler
// Tracks and logs AI usage costs in real-time

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Pool, PoolClient } from 'pg';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { logger } from '../shared/logger';

const sns = new SNSClient({});
const ses = new SESClient({});
const ALERT_TOPIC_ARN = process.env.COST_ALERT_TOPIC_ARN;
const ALERT_FROM_EMAIL = process.env.ALERT_FROM_EMAIL || process.env.FROM_EMAIL || '';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

export interface CostEvent {
  tenantId: string;
  userId: string;
  modelId: string;
  providerId: string;
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  requestId: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface CostSummary {
  daily: number;
  weekly: number;
  monthly: number;
  byModel: Record<string, number>;
  byProvider: Record<string, number>;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
}

export interface CostAlert {
  id: string;
  tenantId: string;
  alertType: 'threshold' | 'spike' | 'budget';
  threshold: number;
  currentValue: number;
  isTriggered: boolean;
  triggeredAt: string | null;
}

// POST /api/cost/log - Log a cost event
export async function logCost(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const costEvent: CostEvent = JSON.parse(event.body || '{}');
    const client = await pool.connect();

    try {
      // Insert cost event
      await client.query(
        `INSERT INTO cost_events (
          tenant_id, user_id, model_id, provider_id,
          input_tokens, output_tokens, input_cost, output_cost, total_cost,
          request_id, session_id, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          costEvent.tenantId,
          costEvent.userId,
          costEvent.modelId,
          costEvent.providerId,
          costEvent.inputTokens,
          costEvent.outputTokens,
          costEvent.inputCost,
          costEvent.outputCost,
          costEvent.totalCost,
          costEvent.requestId,
          costEvent.sessionId,
          JSON.stringify(costEvent.metadata || {}),
        ]
      );

      // Update daily aggregates
      await client.query(
        `INSERT INTO cost_daily_aggregates (
          tenant_id, date, total_cost, total_tokens, request_count
        ) VALUES ($1, CURRENT_DATE, $2, $3, 1)
        ON CONFLICT (tenant_id, date) DO UPDATE SET
          total_cost = cost_daily_aggregates.total_cost + $2,
          total_tokens = cost_daily_aggregates.total_tokens + $3,
          request_count = cost_daily_aggregates.request_count + 1`,
        [
          costEvent.tenantId,
          costEvent.totalCost,
          costEvent.inputTokens + costEvent.outputTokens,
        ]
      );

      // Check alerts
      await checkCostAlerts(client, costEvent.tenantId);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to log cost', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to log cost' }),
    };
  }
}

// GET /api/cost/summary - Get cost summary for tenant
export async function getCostSummary(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = event.queryStringParameters?.tenantId;
    if (!tenantId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'tenantId is required' }),
      };
    }

    const client = await pool.connect();

    try {
      // Get daily, weekly, monthly totals
      const summaryResult = await client.query(
        `
        SELECT 
          COALESCE(SUM(CASE WHEN date = CURRENT_DATE THEN total_cost ELSE 0 END), 0) as daily,
          COALESCE(SUM(CASE WHEN date >= CURRENT_DATE - 7 THEN total_cost ELSE 0 END), 0) as weekly,
          COALESCE(SUM(CASE WHEN date >= DATE_TRUNC('month', CURRENT_DATE) THEN total_cost ELSE 0 END), 0) as monthly
        FROM cost_daily_aggregates
        WHERE tenant_id = $1
        `,
        [tenantId]
      );

      // Get breakdown by model
      const modelResult = await client.query(
        `
        SELECT model_id, SUM(total_cost) as cost
        FROM cost_events
        WHERE tenant_id = $1 AND created_at >= CURRENT_DATE - 30
        GROUP BY model_id
        ORDER BY cost DESC
        LIMIT 10
        `,
        [tenantId]
      );

      // Get breakdown by provider
      const providerResult = await client.query(
        `
        SELECT provider_id, SUM(total_cost) as cost
        FROM cost_events
        WHERE tenant_id = $1 AND created_at >= CURRENT_DATE - 30
        GROUP BY provider_id
        ORDER BY cost DESC
        `,
        [tenantId]
      );

      // Calculate trend
      const trendResult = await client.query(
        `
        SELECT 
          COALESCE(SUM(CASE WHEN date >= CURRENT_DATE - 7 THEN total_cost ELSE 0 END), 0) as this_week,
          COALESCE(SUM(CASE WHEN date >= CURRENT_DATE - 14 AND date < CURRENT_DATE - 7 THEN total_cost ELSE 0 END), 0) as last_week
        FROM cost_daily_aggregates
        WHERE tenant_id = $1
        `,
        [tenantId]
      );

      const summary = summaryResult.rows[0];
      const trend = trendResult.rows[0];
      const thisWeek = parseFloat(trend.this_week) || 0;
      const lastWeek = parseFloat(trend.last_week) || 1;
      const trendPercent = ((thisWeek - lastWeek) / lastWeek) * 100;

      const byModel: Record<string, number> = {};
      modelResult.rows.forEach((row) => {
        byModel[row.model_id] = parseFloat(row.cost);
      });

      const byProvider: Record<string, number> = {};
      providerResult.rows.forEach((row) => {
        byProvider[row.provider_id] = parseFloat(row.cost);
      });

      const costSummary: CostSummary = {
        daily: parseFloat(summary.daily) || 0,
        weekly: parseFloat(summary.weekly) || 0,
        monthly: parseFloat(summary.monthly) || 0,
        byModel,
        byProvider,
        trend: trendPercent > 5 ? 'up' : trendPercent < -5 ? 'down' : 'stable',
        trendPercent: Math.abs(trendPercent),
      };

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(costSummary),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to get cost summary', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get summary' }),
    };
  }
}

// GET /api/cost/alerts - Get cost alerts
export async function getCostAlerts(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = event.queryStringParameters?.tenantId;
    if (!tenantId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'tenantId is required' }),
      };
    }

    const client = await pool.connect();

    try {
      const result = await client.query(
        `SELECT * FROM cost_alerts WHERE tenant_id = $1 ORDER BY created_at DESC`,
        [tenantId]
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(
          result.rows.map((row) => ({
            id: row.id,
            tenantId: row.tenant_id,
            alertType: row.alert_type,
            threshold: parseFloat(row.threshold),
            currentValue: parseFloat(row.current_value),
            isTriggered: row.is_triggered,
            triggeredAt: row.triggered_at,
          }))
        ),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to get cost alerts', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get alerts' }),
    };
  }
}

async function checkCostAlerts(client: PoolClient, tenantId: string): Promise<void> {
  // Get current month's cost
  const costResult = await client.query(
    `
    SELECT COALESCE(SUM(total_cost), 0) as monthly_cost
    FROM cost_daily_aggregates
    WHERE tenant_id = $1 AND date >= DATE_TRUNC('month', CURRENT_DATE)
    `,
    [tenantId]
  );

  const currentCost = parseFloat(costResult.rows[0].monthly_cost) || 0;

  // Check threshold alerts
  const alerts = await client.query(
    `SELECT * FROM cost_alerts WHERE tenant_id = $1 AND is_triggered = false`,
    [tenantId]
  );

  for (const alert of alerts.rows) {
    if (currentCost >= parseFloat(alert.threshold)) {
      await client.query(
        `UPDATE cost_alerts SET is_triggered = true, triggered_at = NOW(), current_value = $2 WHERE id = $1`,
        [alert.id, currentCost]
      );

      await sendCostAlertNotification(client, tenantId, alert, currentCost);
    }
  }
}

async function sendCostAlertNotification(
  client: PoolClient,
  tenantId: string,
  alert: { id: string; alert_type: string; threshold: string; notification_email?: string },
  currentCost: number
): Promise<void> {
  const alertMessage = {
    tenantId,
    alertId: alert.id,
    alertType: alert.alert_type,
    threshold: parseFloat(alert.threshold),
    currentCost,
    triggeredAt: new Date().toISOString(),
  };

  // Publish to SNS topic if configured
  if (ALERT_TOPIC_ARN) {
    try {
      await sns.send(new PublishCommand({
        TopicArn: ALERT_TOPIC_ARN,
        Message: JSON.stringify(alertMessage),
        Subject: `RADIANT Cost Alert: ${alert.alert_type} threshold exceeded`,
        MessageAttributes: {
          tenantId: { DataType: 'String', StringValue: tenantId },
          alertType: { DataType: 'String', StringValue: alert.alert_type },
        },
      }));
    } catch (error) {
      logger.error('Failed to publish SNS notification', error instanceof Error ? error : undefined);
    }
  }

  // Send email notification if email is configured
  const notificationEmail = alert.notification_email || await getTenantEmail(client, tenantId);
  if (notificationEmail) {
    try {
      await ses.send(new SendEmailCommand({
        Source: ALERT_FROM_EMAIL,
        Destination: { ToAddresses: [notificationEmail] },
        Message: {
          Subject: { Data: `RADIANT Cost Alert: ${alert.alert_type} threshold exceeded` },
          Body: {
            Html: {
              Data: `
                <h2>Cost Alert Triggered</h2>
                <p>Your ${alert.alert_type} cost alert has been triggered.</p>
                <ul>
                  <li><strong>Threshold:</strong> $${parseFloat(alert.threshold).toFixed(2)}</li>
                  <li><strong>Current Cost:</strong> $${currentCost.toFixed(2)}</li>
                  <li><strong>Triggered At:</strong> ${new Date().toISOString()}</li>
                </ul>
                <p>Please review your usage in the RADIANT dashboard.</p>
              `,
            },
            Text: {
              Data: `Cost Alert: Your ${alert.alert_type} threshold of $${parseFloat(alert.threshold).toFixed(2)} has been exceeded. Current cost: $${currentCost.toFixed(2)}`,
            },
          },
        },
      }));
    } catch (error) {
      logger.error('Failed to send email notification', error instanceof Error ? error : undefined);
    }
  }

  // Log the alert for audit
  logger.info('Cost alert triggered', {
    tenantId,
    alertType: alert.alert_type,
    threshold: parseFloat(alert.threshold),
    currentCost,
  });
}

async function getTenantEmail(client: PoolClient, tenantId: string): Promise<string | null> {
  const result = await client.query(
    `SELECT email FROM tenants WHERE id = $1`,
    [tenantId]
  );
  return result.rows[0]?.email || null;
}

// Lambda handler router
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  if (path === '/api/cost/log' && method === 'POST') {
    return logCost(event);
  }

  if (path === '/api/cost/summary' && method === 'GET') {
    return getCostSummary(event);
  }

  if (path === '/api/cost/alerts' && method === 'GET') {
    return getCostAlerts(event);
  }

  return {
    statusCode: 404,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Not found' }),
  };
}
