/**
 * RADIANT v4.18.56 - Admin Metrics API Handler
 * Comprehensive metrics endpoints for billing, performance, failures, violations, and logs
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';
import { MetricsCollectionService } from '../shared/services/metrics-collection.service';
import { LearningInfluenceService } from '../shared/services/learning-hierarchy.service';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const metricsService = new MetricsCollectionService(pool);
const learningService = new LearningInfluenceService(pool);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const path = event.path.replace('/api/admin/metrics', '');
  const method = event.httpMethod;
  const tenantId = event.requestContext.authorizer?.tenantId;
  const userId = event.requestContext.authorizer?.userId;
  const isSuperAdmin = event.requestContext.authorizer?.isSuperAdmin === 'true';

  if (!tenantId && !isSuperAdmin) {
    return response(401, { error: 'Unauthorized' });
  }

  // Set tenant context for RLS
  if (tenantId) {
    await pool.query(`SET app.current_tenant_id = '${tenantId}'`);
  }
  if (isSuperAdmin) {
    await pool.query(`SET app.is_super_admin = true`);
  }

  try {
    // ========================================================================
    // DASHBOARD
    // ========================================================================
    if (path === '/dashboard' && method === 'GET') {
      const startDate = event.queryStringParameters?.startDate || getDefaultStartDate();
      const endDate = event.queryStringParameters?.endDate || new Date().toISOString().split('T')[0];
      
      const dashboard = await metricsService.getDashboard(tenantId!, startDate, endDate);
      return response(200, { success: true, data: dashboard });
    }

    // ========================================================================
    // SUMMARY
    // ========================================================================
    if (path === '/summary' && method === 'GET') {
      const startDate = event.queryStringParameters?.startDate || getDefaultStartDate();
      const endDate = event.queryStringParameters?.endDate || new Date().toISOString().split('T')[0];
      
      const summary = await metricsService.getMetricsSummary(tenantId!, startDate, endDate);
      return response(200, { success: true, data: summary });
    }

    // ========================================================================
    // BILLING METRICS
    // ========================================================================
    if (path === '/billing' && method === 'GET') {
      const params = parseQueryParams(event);
      const metrics = await metricsService.getBillingMetrics(tenantId!, params);
      return response(200, { success: true, data: metrics });
    }

    if (path === '/billing' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const id = await metricsService.recordBillingMetric({
        tenantId: tenantId!,
        userId: body.userId,
        modelId: body.modelId,
        providerId: body.providerId,
        inputTokens: body.inputTokens,
        outputTokens: body.outputTokens,
        costCents: body.costCents,
        storageBytesUsed: body.storageBytesUsed,
        computeSeconds: body.computeSeconds,
        success: body.success,
      });
      return response(201, { success: true, data: { id } });
    }

    // ========================================================================
    // PERFORMANCE METRICS
    // ========================================================================
    if (path === '/performance' && method === 'GET') {
      const params = parseQueryParams(event);
      const metrics = await metricsService.getPerformanceMetrics(tenantId!, params);
      return response(200, { success: true, data: metrics });
    }

    if (path === '/performance/latency' && method === 'GET') {
      const startDate = event.queryStringParameters?.startDate || getDefaultStartDate();
      const endDate = event.queryStringParameters?.endDate || new Date().toISOString().split('T')[0];
      
      const percentiles = await metricsService.getLatencyPercentiles(tenantId!, startDate, endDate);
      return response(200, { success: true, data: percentiles });
    }

    if (path === '/performance' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const id = await metricsService.recordPerformanceMetric({
        tenantId: tenantId!,
        userId: body.userId,
        endpoint: body.endpoint,
        method: body.method,
        modelId: body.modelId,
        providerId: body.providerId,
        totalLatencyMs: body.totalLatencyMs,
        timeToFirstTokenMs: body.timeToFirstTokenMs,
        inferenceTimeMs: body.inferenceTimeMs,
        statusCode: body.statusCode,
        success: body.success,
        requestSizeBytes: body.requestSizeBytes,
        responseSizeBytes: body.responseSizeBytes,
      });
      return response(201, { success: true, data: { id } });
    }

    // ========================================================================
    // FAILURES
    // ========================================================================
    if (path === '/failures' && method === 'GET') {
      const params = parseQueryParams(event);
      const severity = event.queryStringParameters?.severity;
      const unresolved = event.queryStringParameters?.unresolved === 'true';
      
      const failures = await metricsService.getFailures(tenantId!, { ...params, severity, unresolved });
      return response(200, { success: true, data: failures });
    }

    if (path === '/failures' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const id = await metricsService.recordFailure({
        tenantId: tenantId!,
        userId: body.userId,
        failureType: body.failureType,
        severity: body.severity,
        endpoint: body.endpoint,
        modelId: body.modelId,
        providerId: body.providerId,
        orchestrationId: body.orchestrationId,
        conversationId: body.conversationId,
        errorCode: body.errorCode,
        errorMessage: body.errorMessage,
        errorStack: body.errorStack,
        requestId: body.requestId,
      });
      return response(201, { success: true, data: { id } });
    }

    if (path.match(/^\/failures\/[^/]+\/resolve$/) && method === 'POST') {
      const failureId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      
      await metricsService.resolveFailure(failureId, body.notes || '', tenantId!);
      return response(200, { success: true });
    }

    // ========================================================================
    // VIOLATIONS
    // ========================================================================
    if (path === '/violations' && method === 'GET') {
      const params = parseQueryParams(event);
      const violationType = event.queryStringParameters?.violationType;
      const unreviewed = event.queryStringParameters?.unreviewed === 'true';
      
      const violations = await metricsService.getViolations(tenantId!, { ...params, violationType, unreviewed });
      return response(200, { success: true, data: violations });
    }

    if (path === '/violations' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const id = await metricsService.recordViolation({
        tenantId: tenantId!,
        userId: body.userId,
        violationType: body.violationType,
        severity: body.severity,
        conversationId: body.conversationId,
        messageId: body.messageId,
        modelId: body.modelId,
        promptSnippet: body.promptSnippet,
        detectionMethod: body.detectionMethod,
        confidence: body.confidence,
        actionTaken: body.actionTaken,
      });
      return response(201, { success: true, data: { id } });
    }

    if (path.match(/^\/violations\/[^/]+\/review$/) && method === 'POST') {
      const violationId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      
      await metricsService.reviewViolation(
        violationId,
        userId!,
        body.outcome,
        body.falsePositive === true,
        tenantId!
      );
      return response(200, { success: true });
    }

    // ========================================================================
    // LOGS
    // ========================================================================
    if (path === '/logs' && method === 'GET') {
      const params = parseQueryParams(event);
      const logLevel = event.queryStringParameters?.logLevel;
      const logSource = event.queryStringParameters?.logSource;
      
      const logs = await metricsService.getLogs(
        isSuperAdmin ? null : tenantId!,
        { ...params, logLevel, logSource }
      );
      return response(200, { success: true, data: logs });
    }

    if (path === '/logs' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const id = await metricsService.log({
        tenantId: tenantId,
        userId: body.userId,
        logLevel: body.logLevel,
        logSource: body.logSource,
        logCategory: body.logCategory,
        message: body.message,
        requestId: body.requestId,
        traceId: body.traceId,
        data: body.data,
        durationMs: body.durationMs,
      });
      return response(201, { success: true, data: { id } });
    }

    // ========================================================================
    // LEARNING INFLUENCE
    // ========================================================================
    if (path === '/learning/influence' && method === 'GET') {
      const decisionType = event.queryStringParameters?.decisionType || 'general';
      const context = event.queryStringParameters?.context 
        ? JSON.parse(event.queryStringParameters.context) 
        : {};
      
      const influence = await learningService.getLearningInfluence(
        tenantId!,
        userId!,
        decisionType,
        context
      );
      return response(200, { success: true, data: influence });
    }

    if (path === '/learning/config' && method === 'GET') {
      const config = await learningService.getInfluenceConfig(tenantId!);
      return response(200, { success: true, data: config });
    }

    if (path === '/learning/config' && method === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      const config = await learningService.setInfluenceConfig({
        tenantId: tenantId!,
        userWeight: body.userWeight,
        tenantWeight: body.tenantWeight,
        globalWeight: body.globalWeight,
        dimensionOverrides: body.dimensionOverrides,
        enableUserLearning: body.enableUserLearning,
        enableTenantAggregation: body.enableTenantAggregation,
        enableGlobalLearning: body.enableGlobalLearning,
        contributeToGlobal: body.contributeToGlobal,
      });
      return response(200, { success: true, data: config });
    }

    if (path === '/learning/tenant' && method === 'GET') {
      const learning = await learningService.getTenantLearning(tenantId!);
      return response(200, { success: true, data: learning });
    }

    if (path === '/learning/global' && method === 'GET') {
      const learning = await learningService.getGlobalLearning();
      return response(200, { success: true, data: learning });
    }

    if (path === '/learning/model-performance' && method === 'GET') {
      const taskType = event.queryStringParameters?.taskType;
      const scope = event.queryStringParameters?.scope || 'tenant';
      
      if (scope === 'global') {
        const performance = await learningService.getGlobalModelPerformance(taskType);
        return response(200, { success: true, data: performance });
      } else {
        const performance = await learningService.getTenantModelPerformance(tenantId!, taskType);
        return response(200, { success: true, data: performance });
      }
    }

    if (path === '/learning/event' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const eventId = await learningService.recordLearningEvent({
        tenantId: tenantId!,
        userId: userId!,
        eventType: body.eventType,
        learningDimension: body.learningDimension,
        eventData: body.eventData,
        impactScore: body.impactScore,
      });
      return response(201, { success: true, data: { eventId } });
    }

    // ========================================================================
    // SNAPSHOTS & RECOVERY
    // ========================================================================
    if (path === '/learning/snapshots' && method === 'GET') {
      const scopeType = (event.queryStringParameters?.scopeType || 'tenant') as 'user' | 'tenant' | 'global';
      const scopeId = scopeType === 'tenant' ? tenantId : event.queryStringParameters?.scopeId;
      
      const snapshot = await learningService.getLatestSnapshot(scopeType, scopeId || undefined);
      return response(200, { success: true, data: snapshot });
    }

    if (path === '/learning/snapshots' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const scopeType = body.scopeType || 'tenant';
      const scopeId = scopeType === 'tenant' ? tenantId : body.scopeId;
      
      const snapshotId = await learningService.createSnapshot(
        scopeType,
        scopeId,
        tenantId
      );
      return response(201, { success: true, data: { snapshotId } });
    }

    if (path.match(/^\/learning\/snapshots\/[^/]+\/recover$/) && method === 'POST') {
      const snapshotId = path.split('/')[3];
      
      const recoveryLog = await learningService.recoverFromSnapshot(snapshotId, tenantId);
      return response(200, { success: true, data: recoveryLog });
    }

    if (path === '/learning/recovery-logs' && method === 'GET') {
      const limit = parseInt(event.queryStringParameters?.limit || '20');
      
      const logs = await learningService.getRecoveryLogs(tenantId, limit);
      return response(200, { success: true, data: logs });
    }

    // ========================================================================
    // USER PREFERENCES (Think Tank Rules included)
    // ========================================================================
    if (path === '/learning/user-preferences' && method === 'GET') {
      const targetUserId = event.queryStringParameters?.userId || userId;
      
      const preferences = await learningService.getUserPreferences(tenantId!, targetUserId!);
      return response(200, { success: true, data: preferences });
    }

    if (path === '/learning/user-preferences' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const targetUserId = body.userId || userId;
      
      const preference = await learningService.setUserPreference({
        tenantId: tenantId!,
        userId: targetUserId!,
        preferenceKey: body.preferenceKey,
        preferenceCategory: body.preferenceCategory,
        preferenceValue: body.preferenceValue,
        confidence: body.confidence,
        learnedFrom: body.learnedFrom,
      });
      return response(201, { success: true, data: preference });
    }

    // ========================================================================
    // AGGREGATE TENANT METRICS (Super Admin only)
    // ========================================================================
    if (path === '/aggregate/tenants' && method === 'GET' && isSuperAdmin) {
      const startDate = event.queryStringParameters?.startDate || getDefaultStartDate();
      const endDate = event.queryStringParameters?.endDate || new Date().toISOString().split('T')[0];
      
      const result = await pool.query(
        `SELECT 
          t.id as tenant_id,
          t.name as tenant_name,
          COALESCE(SUM(bm.total_cost_cents), 0) as total_cost_cents,
          COALESCE(SUM(bm.total_tokens), 0) as total_tokens,
          COALESCE(SUM(bm.api_calls), 0) as total_api_calls,
          COUNT(DISTINCT bm.user_id) as active_users,
          (SELECT COUNT(*) FROM failure_events fe WHERE fe.tenant_id = t.id 
           AND fe.occurred_at >= $1 AND fe.occurred_at <= $2) as failure_count,
          (SELECT COUNT(*) FROM prompt_violations pv WHERE pv.tenant_id = t.id 
           AND pv.occurred_at >= $1 AND pv.occurred_at <= $2) as violation_count
        FROM tenants t
        LEFT JOIN billing_metrics bm ON bm.tenant_id = t.id 
          AND bm.period_date >= $1 AND bm.period_date <= $2
        GROUP BY t.id, t.name
        ORDER BY total_cost_cents DESC`,
        [startDate, endDate]
      );
      
      return response(200, { success: true, data: result.rows });
    }

    if (path === '/aggregate/global-learning' && method === 'POST' && isSuperAdmin) {
      await learningService.runGlobalAggregation();
      return response(200, { success: true, message: 'Global aggregation completed' });
    }

    return response(404, { error: 'Not found' });

  } catch (error) {
    console.error('Metrics API error:', error);
    return response(500, { 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

function response(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    },
    body: JSON.stringify(body),
  };
}

function parseQueryParams(event: APIGatewayProxyEvent) {
  return {
    startDate: event.queryStringParameters?.startDate || getDefaultStartDate(),
    endDate: event.queryStringParameters?.endDate || new Date().toISOString().split('T')[0],
    userId: event.queryStringParameters?.userId,
    modelId: event.queryStringParameters?.modelId,
    providerId: event.queryStringParameters?.providerId,
    limit: parseInt(event.queryStringParameters?.limit || '100'),
    offset: parseInt(event.queryStringParameters?.offset || '0'),
  };
}

function getDefaultStartDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().split('T')[0];
}
