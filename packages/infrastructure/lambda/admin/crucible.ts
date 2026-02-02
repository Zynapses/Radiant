/**
 * The Crucible - Admin API Handler
 * 
 * Endpoints for managing Crucible configuration, viewing sessions, and audit.
 * 
 * Base path: /api/admin/crucible
 * 
 * @version 1.0.0
 * @since v6.4.0
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';
import { CrucibleService } from '../shared/services/crucible';
import {
  CrucibleConfig,
  CrucibleDashboardData,
  CrucibleCostMode,
} from '@radiant/shared';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

import { CrucibleConfigService } from '../shared/services/crucible';

const crucibleService = new CrucibleService(pool);
const configService = new CrucibleConfigService(pool);

function getTenantId(event: APIGatewayProxyEvent): string {
  const tenantId = event.requestContext.authorizer?.claims?.['custom:tenant_id'];
  if (!tenantId) {
    throw new Error('Tenant ID not found in request context');
  }
  return tenantId;
}

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

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path.replace('/api/admin/crucible', '');

  try {
    const tenantId = getTenantId(event);

    // Set tenant context for RLS
    await pool.query(`SET app.current_tenant_id = '${tenantId}'`);

    // GET /dashboard - Full dashboard data
    if (method === 'GET' && path === '/dashboard') {
      const dashboard = await getDashboard(tenantId);
      return response(200, dashboard);
    }

    // GET /config - Get configuration
    if (method === 'GET' && path === '/config') {
      const config = await crucibleService.getConfig(tenantId);
      return response(200, config);
    }

    // PUT /config - Update configuration
    if (method === 'PUT' && path === '/config') {
      const updates = JSON.parse(event.body || '{}');
      const config = await crucibleService.updateConfig(tenantId, updates);
      return response(200, config);
    }

    // GET /sessions - List recent sessions
    if (method === 'GET' && path === '/sessions') {
      const limit = parseInt(event.queryStringParameters?.limit || '20');
      const sessions = await crucibleService.getRecentSessions(tenantId, limit);
      return response(200, { sessions });
    }

    // GET /sessions/:id - Get session details
    const sessionMatch = path.match(/^\/sessions\/([a-f0-9-]+)$/);
    if (method === 'GET' && sessionMatch) {
      const sessionId = sessionMatch[1];
      const session = await crucibleService.getSession(sessionId);
      if (!session) {
        return response(404, { error: 'Session not found' });
      }
      return response(200, session);
    }

    // GET /sessions/:id/questions - Get session questions
    const questionsMatch = path.match(/^\/sessions\/([a-f0-9-]+)\/questions$/);
    if (method === 'GET' && questionsMatch) {
      const sessionId = questionsMatch[1];
      const questions = await crucibleService.getSessionQuestions(sessionId);
      return response(200, { questions });
    }

    // GET /performance - Model performance stats
    if (method === 'GET' && path === '/performance') {
      const limit = parseInt(event.queryStringParameters?.limit || '10');
      const performance = await crucibleService.getModelPerformance(tenantId, limit);
      return response(200, { models: performance });
    }

    // GET /insights - Learning insights
    if (method === 'GET' && path === '/insights') {
      const insights = await getInsights(tenantId);
      return response(200, { insights });
    }

    // GET /audit - Audit log
    if (method === 'GET' && path === '/audit') {
      const limit = parseInt(event.queryStringParameters?.limit || '50');
      const audit = await getAuditLog(tenantId, limit);
      return response(200, { entries: audit });
    }

    // GET /stats - Statistics
    if (method === 'GET' && path === '/stats') {
      const stats = await getStats(tenantId);
      return response(200, stats);
    }

    // =========================================================================
    // System Config Endpoints (Radiant Admin Only)
    // =========================================================================

    // GET /system-config - Get system-wide defaults
    if (method === 'GET' && path === '/system-config') {
      const systemConfig = await configService.getSystemConfig();
      return response(200, systemConfig);
    }

    // PUT /system-config - Update system-wide defaults
    if (method === 'PUT' && path === '/system-config') {
      const updates = JSON.parse(event.body || '{}');
      const systemConfig = await configService.updateSystemConfig({
        defaultMaxQuestions: updates.defaultMaxQuestions,
        questionTimeoutSeconds: updates.questionTimeoutSeconds,
        sessionTimeoutSeconds: updates.sessionTimeoutSeconds,
        minLlmsForCrucible: updates.minLlmsForCrucible,
        defaultCostMode: updates.defaultCostMode,
        costModeQuestionLimits: updates.costModeQuestionLimits,
        circularCitationPenalty: updates.circularCitationPenalty,
        allowTenantOverride: updates.allowTenantOverride,
        allowUserOverride: updates.allowUserOverride,
      });
      return response(200, systemConfig);
    }

    // GET /tenants - Get all tenant configs (for system admin visibility)
    if (method === 'GET' && path === '/tenants') {
      const result = await pool.query(
        `SELECT tc.*, t.name as tenant_name
         FROM crucible_tenant_config tc
         JOIN tenants t ON tc.tenant_id = t.id
         ORDER BY t.name`
      );
      return response(200, { tenants: result.rows });
    }

    return response(404, { error: 'Not found' });
  } catch (error) {
    console.error('Crucible API error:', error);
    return response(500, {
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}

async function getDashboard(tenantId: string): Promise<CrucibleDashboardData> {
  const config = await crucibleService.getConfig(tenantId);
  const recentSessions = await crucibleService.getRecentSessions(tenantId, 10);
  const topPerformingModels = await crucibleService.getModelPerformance(tenantId, 5);

  // Get stats
  const statsResult = await pool.query(
    `SELECT 
      COUNT(*) as total_sessions,
      COUNT(*) FILTER (WHERE started_at > NOW() - INTERVAL '24 hours') as sessions_today,
      AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000) as avg_duration,
      AVG(total_questions_asked) as avg_questions
     FROM crucible_sessions 
     WHERE tenant_id = $1 AND status = 'completed'`,
    [tenantId]
  );

  const stats = statsResult.rows[0];

  // Get circular citations in last 24h
  const circularResult = await pool.query(
    `SELECT COALESCE(SUM(circular_citations), 0) as total
     FROM crucible_participants p
     JOIN crucible_sessions s ON p.session_id = s.id
     WHERE s.tenant_id = $1 AND s.started_at > NOW() - INTERVAL '24 hours'`,
    [tenantId]
  );

  // Get recent insights
  const insightsResult = await pool.query(
    `SELECT * FROM crucible_learning_insights 
     WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '7 days'
     ORDER BY created_at DESC LIMIT 10`,
    [tenantId]
  );

  return {
    config,
    totalSessions: parseInt(stats.total_sessions || '0'),
    sessionsToday: parseInt(stats.sessions_today || '0'),
    avgSessionDuration: parseFloat(stats.avg_duration || '0'),
    avgQuestionsPerSession: parseFloat(stats.avg_questions || '0'),
    circularCitationsLast24h: parseInt(circularResult.rows[0]?.total || '0'),
    topPerformingModels,
    recentSessions,
    recentInsights: insightsResult.rows.map(row => ({
      type: row.insight_type,
      modelId: row.model_id,
      description: row.description,
      confidence: parseFloat(row.confidence),
      actionable: row.actionable,
    })),
  };
}

async function getInsights(tenantId: string): Promise<unknown[]> {
  const result = await pool.query(
    `SELECT * FROM crucible_learning_insights 
     WHERE tenant_id = $1
     ORDER BY created_at DESC LIMIT 100`,
    [tenantId]
  );

  return result.rows.map(row => ({
    id: row.id,
    sessionId: row.session_id,
    type: row.insight_type,
    modelId: row.model_id,
    description: row.description,
    confidence: parseFloat(row.confidence),
    actionable: row.actionable,
    applied: row.applied,
    appliedAt: row.applied_at,
    createdAt: row.created_at,
  }));
}

async function getAuditLog(tenantId: string, limit: number): Promise<unknown[]> {
  const result = await pool.query(
    `SELECT * FROM crucible_audit_log 
     WHERE tenant_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [tenantId, limit]
  );

  return result.rows.map(row => ({
    id: row.id,
    sessionId: row.session_id,
    eventType: row.event_type,
    eventData: row.event_data,
    actorId: row.actor_id,
    createdAt: row.created_at,
  }));
}

async function getStats(tenantId: string): Promise<unknown> {
  // Session stats by status
  const statusStats = await pool.query(
    `SELECT status, COUNT(*) as count 
     FROM crucible_sessions WHERE tenant_id = $1 
     GROUP BY status`,
    [tenantId]
  );

  // Question type distribution
  const questionStats = await pool.query(
    `SELECT q.question_type, COUNT(*) as count
     FROM crucible_questions q
     JOIN crucible_sessions s ON q.session_id = s.id
     WHERE s.tenant_id = $1
     GROUP BY q.question_type`,
    [tenantId]
  );

  // Quality distribution
  const qualityStats = await pool.query(
    `SELECT q.quality_score, COUNT(*) as count
     FROM crucible_questions q
     JOIN crucible_sessions s ON q.session_id = s.id
     WHERE s.tenant_id = $1 AND q.quality_score IS NOT NULL
     GROUP BY q.quality_score`,
    [tenantId]
  );

  // Daily session counts (last 30 days)
  const dailyStats = await pool.query(
    `SELECT DATE(started_at) as date, COUNT(*) as count
     FROM crucible_sessions 
     WHERE tenant_id = $1 AND started_at > NOW() - INTERVAL '30 days'
     GROUP BY DATE(started_at)
     ORDER BY date`,
    [tenantId]
  );

  return {
    sessionsByStatus: statusStats.rows.reduce((acc, row) => {
      acc[row.status] = parseInt(row.count);
      return acc;
    }, {} as Record<string, number>),
    questionsByType: questionStats.rows.reduce((acc, row) => {
      acc[row.question_type] = parseInt(row.count);
      return acc;
    }, {} as Record<string, number>),
    questionsByQuality: qualityStats.rows.reduce((acc, row) => {
      acc[row.quality_score] = parseInt(row.count);
      return acc;
    }, {} as Record<string, number>),
    dailySessions: dailyStats.rows.map(row => ({
      date: row.date,
      count: parseInt(row.count),
    })),
  };
}
