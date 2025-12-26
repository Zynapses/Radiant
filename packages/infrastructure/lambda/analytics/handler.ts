import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, handleError } from '../shared/response';
import { extractUserFromEvent, type AuthContext } from '../shared/auth';
import { UnauthorizedError, NotFoundError, ValidationError } from '../shared/errors';
import { metricsCollector } from '../shared/services';
import { executeStatement } from '../shared/db/client';

type PeriodType = 'hourly' | 'daily' | 'weekly' | 'monthly';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;

  try {
    const user = await extractUserFromEvent(event);
    if (!user) {
      return handleError(new UnauthorizedError('Authentication required'));
    }

    // GET /analytics/usage - Get usage metrics
    if (method === 'GET' && path.endsWith('/usage')) {
      return handleGetUsage(event, user);
    }

    // GET /analytics/aggregated - Get aggregated metrics
    if (method === 'GET' && path.endsWith('/aggregated')) {
      return handleGetAggregated(event, user);
    }

    // GET /analytics/models - Get model usage breakdown
    if (method === 'GET' && path.endsWith('/models')) {
      return handleGetModelUsage(event, user);
    }

    // GET /analytics/costs - Get cost breakdown
    if (method === 'GET' && path.endsWith('/costs')) {
      return handleGetCosts(event, user);
    }

    // GET /analytics/dashboard - Get dashboard summary
    if (method === 'GET' && path.endsWith('/dashboard')) {
      return handleGetDashboard(user);
    }

    return handleError(new NotFoundError('Endpoint not found'));
  } catch (error) {
    console.error('Analytics error:', error);
    return handleError(error);
  }
}

async function handleGetUsage(
  event: APIGatewayProxyEvent,
  user: AuthContext
): Promise<APIGatewayProxyResult> {
  const startDate = event.queryStringParameters?.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const endDate = event.queryStringParameters?.endDate || new Date().toISOString();
  const metricType = event.queryStringParameters?.metricType;

  let sql = `SELECT metric_type, metric_name, SUM(metric_value) as total_value,
                    COUNT(*) as count
             FROM usage_metrics
             WHERE tenant_id = $1 
             AND recorded_at >= $2 AND recorded_at <= $3`;
  
  const params = [
    { name: 'tenantId', value: { stringValue: user.tenantId } },
    { name: 'startDate', value: { stringValue: startDate } },
    { name: 'endDate', value: { stringValue: endDate } },
  ];

  if (metricType) {
    sql += ` AND metric_type = $4`;
    params.push({ name: 'metricType', value: { stringValue: metricType } });
  }

  sql += ` GROUP BY metric_type, metric_name ORDER BY total_value DESC`;

  const result = await executeStatement(sql, params);

  return success({ usage: result.rows });
}

async function handleGetAggregated(
  event: APIGatewayProxyEvent,
  user: AuthContext
): Promise<APIGatewayProxyResult> {
  const periodType = (event.queryStringParameters?.periodType || 'daily') as PeriodType;
  const startDate = event.queryStringParameters?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const endDate = event.queryStringParameters?.endDate || new Date().toISOString();

  const validPeriods: PeriodType[] = ['hourly', 'daily', 'weekly', 'monthly'];
  if (!validPeriods.includes(periodType)) {
    return handleError(new ValidationError(`Invalid periodType. Must be one of: ${validPeriods.join(', ')}`));
  }

  const metrics = await metricsCollector.getAggregatedMetrics(
    user.tenantId,
    periodType,
    new Date(startDate),
    new Date(endDate)
  );

  return success({ metrics });
}

async function handleGetModelUsage(
  event: APIGatewayProxyEvent,
  user: AuthContext
): Promise<APIGatewayProxyResult> {
  const days = parseInt(event.queryStringParameters?.days || '7', 10);

  const result = await executeStatement(
    `SELECT 
       model_id,
       COUNT(*) as request_count,
       SUM(input_tokens) as total_input_tokens,
       SUM(output_tokens) as total_output_tokens,
       SUM(cost) as total_cost,
       AVG(latency_ms) as avg_latency_ms
     FROM usage_events
     WHERE tenant_id = $1 AND created_at > NOW() - $2 * INTERVAL '1 day'
     GROUP BY model_id
     ORDER BY request_count DESC`,
    [
      { name: 'tenantId', value: { stringValue: user.tenantId } },
      { name: 'days', value: { longValue: days } },
    ]
  );

  return success({ models: result.rows });
}

async function handleGetCosts(
  event: APIGatewayProxyEvent,
  user: AuthContext
): Promise<APIGatewayProxyResult> {
  const days = parseInt(event.queryStringParameters?.days || '30', 10);
  const groupBy = event.queryStringParameters?.groupBy || 'day';

  const dateFormat = groupBy === 'hour' ? 'YYYY-MM-DD HH24:00' : 'YYYY-MM-DD';

  const result = await executeStatement(
    `SELECT 
       TO_CHAR(created_at, '${dateFormat}') as period,
       SUM(cost) as total_cost,
       COUNT(*) as request_count
     FROM usage_events
     WHERE tenant_id = $1 AND created_at > NOW() - $2 * INTERVAL '1 day'
     GROUP BY period
     ORDER BY period`,
    [
      { name: 'tenantId', value: { stringValue: user.tenantId } },
      { name: 'days', value: { longValue: days } },
    ]
  );

  return success({ costs: result.rows });
}

async function handleGetDashboard(
  user: AuthContext
): Promise<APIGatewayProxyResult> {
  // Get today's stats
  const todayResult = await executeStatement(
    `SELECT 
       COUNT(*) as requests_today,
       SUM(input_tokens + output_tokens) as tokens_today,
       SUM(cost) as cost_today
     FROM usage_events
     WHERE tenant_id = $1 AND created_at > CURRENT_DATE`,
    [{ name: 'tenantId', value: { stringValue: user.tenantId } }]
  );

  // Get this month's stats
  const monthResult = await executeStatement(
    `SELECT 
       COUNT(*) as requests_month,
       SUM(input_tokens + output_tokens) as tokens_month,
       SUM(cost) as cost_month
     FROM usage_events
     WHERE tenant_id = $1 AND created_at > DATE_TRUNC('month', CURRENT_DATE)`,
    [{ name: 'tenantId', value: { stringValue: user.tenantId } }]
  );

  // Get active users count
  const usersResult = await executeStatement(
    `SELECT COUNT(DISTINCT user_id) as active_users
     FROM usage_events
     WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '7 days'`,
    [{ name: 'tenantId', value: { stringValue: user.tenantId } }]
  );

  // Get top models
  const topModelsResult = await executeStatement(
    `SELECT model_id, COUNT(*) as count
     FROM usage_events
     WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '7 days'
     GROUP BY model_id
     ORDER BY count DESC
     LIMIT 5`,
    [{ name: 'tenantId', value: { stringValue: user.tenantId } }]
  );

  const today = todayResult.rows[0] as Record<string, unknown>;
  const month = monthResult.rows[0] as Record<string, unknown>;
  const users = usersResult.rows[0] as Record<string, unknown>;

  return success({
    today: {
      requests: parseInt(String(today?.requests_today ?? 0), 10),
      tokens: parseInt(String(today?.tokens_today ?? 0), 10),
      cost: parseFloat(String(today?.cost_today ?? 0)),
    },
    month: {
      requests: parseInt(String(month?.requests_month ?? 0), 10),
      tokens: parseInt(String(month?.tokens_month ?? 0), 10),
      cost: parseFloat(String(month?.cost_month ?? 0)),
    },
    activeUsers: parseInt(String(users?.active_users ?? 0), 10),
    topModels: topModelsResult.rows,
  });
}
