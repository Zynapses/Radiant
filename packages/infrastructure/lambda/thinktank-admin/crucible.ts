/**
 * The Crucible - Think Tank Admin API Handler
 * 
 * Allows tenant admins to configure Crucible settings for their tenant.
 * These override system defaults but can be overridden by user preferences.
 * 
 * Base path: /api/thinktank-admin/crucible
 * 
 * @version 1.0.0
 * @since v6.4.0
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';
import { CrucibleConfigService } from '../shared/services/crucible';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

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
  const path = event.path.replace('/api/thinktank-admin/crucible', '');

  try {
    const tenantId = getTenantId(event);

    // Set tenant context for RLS
    await pool.query(`SET app.current_tenant_id = '${tenantId}'`);
    await pool.query(`SET app.current_role = 'tenant_admin'`);

    // GET /config - Get tenant config with system defaults
    if (method === 'GET' && path === '/config') {
      const systemConfig = await configService.getSystemConfig();
      const tenantConfig = await configService.getTenantConfig(tenantId);

      return response(200, {
        system: systemConfig,
        tenant: tenantConfig,
        effective: {
          maxQuestions: tenantConfig?.maxQuestionsOverride ?? systemConfig.defaultMaxQuestions,
          questionTimeoutSeconds: tenantConfig?.questionTimeoutOverride ?? systemConfig.questionTimeoutSeconds,
          sessionTimeoutSeconds: tenantConfig?.sessionTimeoutOverride ?? systemConfig.sessionTimeoutSeconds,
          minLlmsForCrucible: tenantConfig?.minLlmsOverride ?? systemConfig.minLlmsForCrucible,
          costMode: tenantConfig?.costModeOverride ?? systemConfig.defaultCostMode,
          costModeQuestionLimits: tenantConfig?.costModeLimitsOverride ?? systemConfig.costModeQuestionLimits,
          circularCitationPenalty: tenantConfig?.circularPenaltyOverride ?? systemConfig.circularCitationPenalty,
          allowUserOverride: tenantConfig?.allowUserOverride ?? true,
          showDeliberationToUsers: tenantConfig?.showDeliberationToUsers ?? true,
          autoEnableForMultiLlm: tenantConfig?.autoEnableForMultiLlm ?? true,
        },
        canOverride: systemConfig.allowTenantOverride,
      });
    }

    // PUT /config - Update tenant config
    if (method === 'PUT' && path === '/config') {
      const systemConfig = await configService.getSystemConfig();
      if (!systemConfig.allowTenantOverride) {
        return response(403, { error: 'Tenant overrides are disabled by system administrator' });
      }

      const updates = JSON.parse(event.body || '{}');
      const tenantConfig = await configService.upsertTenantConfig(tenantId, {
        maxQuestionsOverride: updates.maxQuestions,
        questionTimeoutOverride: updates.questionTimeoutSeconds,
        sessionTimeoutOverride: updates.sessionTimeoutSeconds,
        minLlmsOverride: updates.minLlmsForCrucible,
        costModeOverride: updates.costMode,
        costModeLimitsOverride: updates.costModeQuestionLimits,
        circularPenaltyOverride: updates.circularCitationPenalty,
        allowUserOverride: updates.allowUserOverride,
        showDeliberationToUsers: updates.showDeliberationToUsers,
        autoEnableForMultiLlm: updates.autoEnableForMultiLlm,
      });

      return response(200, tenantConfig);
    }

    // DELETE /config/:field - Reset a specific override to system default
    const resetMatch = path.match(/^\/config\/([a-z_]+)$/);
    if (method === 'DELETE' && resetMatch) {
      const field = resetMatch[1];
      const fieldMap: Record<string, string> = {
        max_questions: 'maxQuestionsOverride',
        question_timeout: 'questionTimeoutOverride',
        session_timeout: 'sessionTimeoutOverride',
        min_llms: 'minLlmsOverride',
        cost_mode: 'costModeOverride',
        cost_mode_limits: 'costModeLimitsOverride',
        circular_penalty: 'circularPenaltyOverride',
      };

      const configField = fieldMap[field];
      if (!configField) {
        return response(400, { error: `Unknown field: ${field}` });
      }

      await pool.query(
        `UPDATE crucible_tenant_config 
         SET ${field}_override = NULL, updated_at = NOW() 
         WHERE tenant_id = $1`,
        [tenantId]
      );

      return response(200, { message: `Reset ${field} to system default` });
    }

    // GET /users - Get user preference summary for tenant
    if (method === 'GET' && path === '/users') {
      const result = await pool.query(
        `SELECT 
          user_id,
          COUNT(*) as preference_count,
          MAX(updated_at) as last_updated
         FROM crucible_user_preferences
         WHERE tenant_id = $1
         GROUP BY user_id
         ORDER BY last_updated DESC
         LIMIT 100`,
        [tenantId]
      );

      return response(200, { users: result.rows });
    }

    // GET /users/:userId/preferences - Get user's preferences
    const userPrefsMatch = path.match(/^\/users\/([a-f0-9-]+)\/preferences$/);
    if (method === 'GET' && userPrefsMatch) {
      const userId = userPrefsMatch[1];
      const prefs = await configService.getUserPreferences(tenantId, userId);
      return response(200, { preferences: prefs });
    }

    // GET /stats - Get Crucible usage stats for tenant
    if (method === 'GET' && path === '/stats') {
      const stats = await pool.query(
        `SELECT 
          COUNT(*) as total_sessions,
          COUNT(*) FILTER (WHERE started_at > NOW() - INTERVAL '24 hours') as sessions_today,
          COUNT(*) FILTER (WHERE started_at > NOW() - INTERVAL '7 days') as sessions_week,
          AVG(total_questions_asked) as avg_questions,
          AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds
         FROM crucible_sessions
         WHERE tenant_id = $1 AND status = 'completed'`,
        [tenantId]
      );

      const prefsCount = await pool.query(
        `SELECT 
          COUNT(DISTINCT user_id) as users_with_preferences,
          COUNT(*) as total_preferences
         FROM crucible_user_preferences
         WHERE tenant_id = $1`,
        [tenantId]
      );

      return response(200, {
        sessions: stats.rows[0],
        preferences: prefsCount.rows[0],
      });
    }

    return response(404, { error: 'Not found' });
  } catch (error) {
    console.error('Think Tank Admin Crucible API error:', error);
    return response(500, {
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
