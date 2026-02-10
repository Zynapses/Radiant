/**
 * The Crucible - Think Tank User API Handler
 * 
 * Allows users to view their Crucible config and set per-method/workflow preferences.
 * Also provides session visibility during workflow execution.
 * 
 * Base path: /api/thinktank/crucible
 * 
 * @version 1.0.0
 * @since v6.4.0
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDbPool } from '../shared/services/database';
import { CrucibleConfigService, CrucibleService } from '../shared/services/crucible';

let configService: CrucibleConfigService;
let crucibleService: CrucibleService;

async function initServices() {
  if (!configService) {
    const pool = await getDbPool();
    configService = new CrucibleConfigService(pool);
    crucibleService = new CrucibleService(pool);
  }
}

function getTenantId(event: APIGatewayProxyEvent): string {
  const tenantId = event.requestContext.authorizer?.claims?.['custom:tenant_id'];
  if (!tenantId) {
    throw new Error('Tenant ID not found in request context');
  }
  return tenantId;
}

function getUserId(event: APIGatewayProxyEvent): string {
  const userId = event.requestContext.authorizer?.claims?.sub;
  if (!userId) {
    throw new Error('User ID not found in request context');
  }
  return userId;
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
  const path = event.path.replace('/api/thinktank/crucible', '');

  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    await initServices();
    const pool = await getDbPool();

    // Set context for RLS (parameterized)
    await pool.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
    await pool.query(`SELECT set_config('app.current_user_id', $1, false)`, [userId]);

    // GET /config - Get resolved config for current user
    if (method === 'GET' && path === '/config') {
      const methodId = event.queryStringParameters?.method_id;
      const workflowId = event.queryStringParameters?.workflow_id;

      const resolved = await configService.getResolvedConfig(tenantId, userId, methodId, workflowId);

      // Check if user can see deliberation
      if (!resolved.showDeliberationToUsers) {
        return response(200, {
          enabled: resolved.enabled && resolved.autoEnableForMultiLlm,
          visible: false,
          message: 'Deliberation visibility is disabled for this tenant',
        });
      }

      return response(200, {
        ...resolved,
        visible: true,
        canOverride: true, // Already checked in getResolvedConfig
      });
    }

    // GET /preferences - Get user's preferences
    if (method === 'GET' && path === '/preferences') {
      const prefs = await configService.getUserPreferences(tenantId, userId);
      return response(200, { preferences: prefs });
    }

    // POST /preferences - Create/update preference
    if (method === 'POST' && path === '/preferences') {
      const body = JSON.parse(event.body || '{}');

      if (!body.scope) {
        return response(400, { error: 'scope is required' });
      }

      const pref = await configService.upsertUserPreference(tenantId, userId, {
        scope: body.scope,
        methodId: body.methodId,
        workflowId: body.workflowId,
        maxQuestions: body.maxQuestions,
        costMode: body.costMode,
        enabled: body.enabled,
      });

      return response(200, pref);
    }

    // DELETE /preferences/:id - Delete a preference
    const deleteMatch = path.match(/^\/preferences\/([a-f0-9-]+)$/);
    if (method === 'DELETE' && deleteMatch) {
      const prefId = deleteMatch[1];
      await configService.deleteUserPreference(tenantId, userId, prefId);
      return response(200, { message: 'Preference deleted' });
    }

    // GET /sessions/active - Get user's active Crucible sessions
    if (method === 'GET' && path === '/sessions/active') {
      const result = await pool.query(
        `SELECT s.*, 
          (SELECT COUNT(*) FROM crucible_participants WHERE session_id = s.id) as participant_count
         FROM crucible_sessions s
         WHERE s.tenant_id = $1 
           AND s.status NOT IN ('completed', 'failed', 'timeout')
         ORDER BY s.started_at DESC
         LIMIT 10`,
        [tenantId]
      );

      return response(200, {
        sessions: result.rows.map(row => ({
          sessionId: row.id,
          methodName: row.method_name,
          status: row.status,
          participantCount: parseInt(row.participant_count),
          totalQuestionsAsked: row.total_questions_asked,
          questionsRemaining: row.questions_remaining,
          startedAt: row.started_at,
        })),
      });
    }

    // GET /sessions/:id - Get session details (for live view)
    const sessionMatch = path.match(/^\/sessions\/([a-f0-9-]+)$/);
    if (method === 'GET' && sessionMatch) {
      const sessionId = sessionMatch[1];

      // Check visibility permission
      const tenantConfig = await configService.getTenantConfig(tenantId);
      if (tenantConfig && !tenantConfig.showDeliberationToUsers) {
        return response(403, { error: 'Deliberation visibility is disabled for this tenant' });
      }

      const session = await crucibleService.getSession(sessionId);
      if (!session) {
        return response(404, { error: 'Session not found' });
      }

      return response(200, session);
    }

    // GET /sessions/:id/stream - Get session events for live updates
    const streamMatch = path.match(/^\/sessions\/([a-f0-9-]+)\/stream$/);
    if (method === 'GET' && streamMatch) {
      const sessionId = streamMatch[1];
      const since = event.queryStringParameters?.since;

      // Check visibility permission
      const tenantConfig = await configService.getTenantConfig(tenantId);
      if (tenantConfig && !tenantConfig.showDeliberationToUsers) {
        return response(403, { error: 'Deliberation visibility is disabled' });
      }

      // Get recent questions/answers for live streaming
      const result = await pool.query(
        `SELECT 
          q.id as question_id,
          q.question_number,
          q.question_type,
          q.question_text,
          q.quality_score,
          q.asked_at,
          pa.model_name as asker_model,
          pt.model_name as target_model,
          a.id as answer_id,
          a.answer_text,
          a.circular_citation_detected,
          a.answered_at
         FROM crucible_questions q
         JOIN crucible_participants pa ON q.asker_id = pa.id
         JOIN crucible_participants pt ON q.target_id = pt.id
         LEFT JOIN crucible_answers a ON a.question_id = q.id
         WHERE q.session_id = $1
         ${since ? 'AND q.asked_at > $2' : ''}
         ORDER BY q.question_number ASC`,
        since ? [sessionId, since] : [sessionId]
      );

      return response(200, {
        events: result.rows.map(row => ({
          questionId: row.question_id,
          questionNumber: row.question_number,
          questionType: row.question_type,
          questionText: row.question_text,
          qualityScore: row.quality_score,
          askedAt: row.asked_at,
          askerModel: row.asker_model,
          targetModel: row.target_model,
          answer: row.answer_id ? {
            answerId: row.answer_id,
            answerText: row.answer_text,
            circularCitationDetected: row.circular_citation_detected,
            answeredAt: row.answered_at,
          } : null,
        })),
      });
    }

    // GET /method/:methodId/config - Get resolved config for a specific method
    const methodConfigMatch = path.match(/^\/method\/([^/]+)\/config$/);
    if (method === 'GET' && methodConfigMatch) {
      const methodId = methodConfigMatch[1];
      const workflowId = event.queryStringParameters?.workflow_id;

      const resolved = await configService.getResolvedConfig(tenantId, userId, methodId, workflowId);
      return response(200, resolved);
    }

    // PUT /method/:methodId/questions - Set max questions for a method
    const methodQuestionsMatch = path.match(/^\/method\/([^/]+)\/questions$/);
    if (method === 'PUT' && methodQuestionsMatch) {
      const methodId = methodQuestionsMatch[1];
      const body = JSON.parse(event.body || '{}');

      if (typeof body.maxQuestions !== 'number' || body.maxQuestions < 1 || body.maxQuestions > 10) {
        return response(400, { error: 'maxQuestions must be between 1 and 10' });
      }

      const workflowId = body.workflowId;
      const scope = workflowId ? 'method_in_workflow' : 'method';

      const pref = await configService.upsertUserPreference(tenantId, userId, {
        scope,
        methodId,
        workflowId,
        maxQuestions: body.maxQuestions,
      });

      return response(200, pref);
    }

    return response(404, { error: 'Not found' });
  } catch (error) {
    console.error('Think Tank Crucible API error:', error);
    return response(500, {
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
