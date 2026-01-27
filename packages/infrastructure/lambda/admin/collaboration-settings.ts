/**
 * RADIANT v5.18.0 - Collaboration Settings Admin API
 * Manages tenant and user collaboration settings
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = event.requestContext.authorizer?.tenantId;
  const userId = event.requestContext.authorizer?.userId;
  const path = event.path.replace('/api/admin/collaboration-settings', '');
  const method = event.httpMethod;

  try {
    await pool.query(`SET app.current_tenant_id = '${tenantId}'`);
    const body = event.body ? JSON.parse(event.body) : {};

    // =========================================================================
    // TENANT SETTINGS
    // =========================================================================

    // GET /tenant - Get tenant collaboration settings
    if (path === '/tenant' && method === 'GET') {
      const result = await pool.query(
        `SELECT * FROM tenant_collaboration_settings WHERE tenant_id = $1`,
        [tenantId]
      );
      
      if (result.rows.length === 0) {
        // Create default settings if not exists
        const insertResult = await pool.query(
          `INSERT INTO tenant_collaboration_settings (tenant_id) VALUES ($1) RETURNING *`,
          [tenantId]
        );
        return response(200, { data: insertResult.rows[0] });
      }
      
      return response(200, { data: result.rows[0] });
    }

    // PUT /tenant - Update tenant collaboration settings
    if (path === '/tenant' && method === 'PUT') {
      const fields = [
        'enable_collaborative_chat', 'enable_intra_tenant_chat', 'enable_guest_access',
        'enable_ai_facilitator', 'enable_branch_merge', 'enable_time_shifted_playback',
        'enable_ai_roundtable', 'enable_knowledge_graph', 'enable_media_notes', 'enable_attachments',
        'max_guests_per_session', 'max_guest_sessions_per_month', 'default_guest_permission',
        'guest_invite_expiry_hours', 'require_guest_email',
        'max_sessions_per_user', 'max_participants_per_session', 'max_branches_per_session',
        'max_recordings_per_session', 'max_roundtables_per_session',
        'max_attachment_size_mb', 'max_media_note_duration_seconds',
        'attachment_retention_days', 'recording_retention_days',
        'default_facilitator_persona', 'facilitator_intervention_frequency',
        'enable_viral_tracking', 'guest_conversion_incentive_credits', 'referrer_bonus_credits',
        'allow_user_override_facilitator', 'allow_user_override_branch_merge',
        'allow_user_override_playback', 'allow_user_override_roundtable',
        'allow_user_override_knowledge_graph', 'allow_user_override_guest_invite'
      ];

      const updates: string[] = [];
      const values: any[] = [tenantId];
      let paramIndex = 2;

      for (const field of fields) {
        if (body[field] !== undefined) {
          updates.push(`${field} = $${paramIndex}`);
          values.push(body[field]);
          paramIndex++;
        }
      }

      if (updates.length === 0) {
        return response(400, { error: 'No valid fields to update' });
      }

      const result = await pool.query(
        `INSERT INTO tenant_collaboration_settings (tenant_id) VALUES ($1)
         ON CONFLICT (tenant_id) DO UPDATE SET ${updates.join(', ')}, updated_at = NOW()
         RETURNING *`,
        values
      );

      return response(200, { data: result.rows[0] });
    }

    // =========================================================================
    // USER SETTINGS
    // =========================================================================

    // GET /user - Get current user's collaboration settings
    if (path === '/user' && method === 'GET') {
      const result = await pool.query(
        `SELECT * FROM user_collaboration_settings WHERE tenant_id = $1 AND user_id = $2`,
        [tenantId, userId]
      );

      if (result.rows.length === 0) {
        const insertResult = await pool.query(
          `INSERT INTO user_collaboration_settings (tenant_id, user_id) VALUES ($1, $2) RETURNING *`,
          [tenantId, userId]
        );
        return response(200, { data: insertResult.rows[0] });
      }

      return response(200, { data: result.rows[0] });
    }

    // GET /user/:userId - Get specific user's collaboration settings (admin only)
    if (path.match(/^\/user\/[^/]+$/) && method === 'GET') {
      const targetUserId = path.split('/')[2];
      const result = await pool.query(
        `SELECT * FROM user_collaboration_settings WHERE tenant_id = $1 AND user_id = $2`,
        [tenantId, targetUserId]
      );

      if (result.rows.length === 0) {
        return response(404, { error: 'User settings not found' });
      }

      return response(200, { data: result.rows[0] });
    }

    // PUT /user - Update current user's collaboration settings
    if (path === '/user' && method === 'PUT') {
      const fields = [
        'enable_ai_facilitator', 'enable_branch_merge', 'enable_time_shifted_playback',
        'enable_ai_roundtable', 'enable_knowledge_graph',
        'default_session_name_template', 'default_session_access_type', 'default_participant_permission',
        'preferred_facilitator_persona', 'facilitator_auto_summarize', 'facilitator_auto_action_items',
        'facilitator_ensure_participation', 'facilitator_keep_on_topic',
        'notify_on_guest_join', 'notify_on_branch_created', 'notify_on_merge_request',
        'notify_on_roundtable_complete', 'notify_on_annotation',
        'auto_start_recording', 'default_recording_type',
        'show_knowledge_graph_sidebar', 'show_participant_avatars', 
        'collapsed_participants_sidebar', 'preferred_view'
      ];

      const updates: string[] = [];
      const values: any[] = [tenantId, userId];
      let paramIndex = 3;

      for (const field of fields) {
        if (body[field] !== undefined) {
          updates.push(`${field} = $${paramIndex}`);
          values.push(body[field]);
          paramIndex++;
        }
      }

      if (updates.length === 0) {
        return response(400, { error: 'No valid fields to update' });
      }

      const result = await pool.query(
        `INSERT INTO user_collaboration_settings (tenant_id, user_id) VALUES ($1, $2)
         ON CONFLICT (tenant_id, user_id) DO UPDATE SET ${updates.join(', ')}, updated_at = NOW()
         RETURNING *`,
        values
      );

      return response(200, { data: result.rows[0] });
    }

    // =========================================================================
    // EFFECTIVE SETTINGS
    // =========================================================================

    // GET /effective - Get effective settings for current user (computed)
    if (path === '/effective' && method === 'GET') {
      const result = await pool.query(
        `SELECT * FROM get_effective_collaboration_settings($1, $2)`,
        [tenantId, userId]
      );

      return response(200, { data: result.rows[0] });
    }

    // GET /effective/:userId - Get effective settings for specific user (admin only)
    if (path.match(/^\/effective\/[^/]+$/) && method === 'GET') {
      const targetUserId = path.split('/')[2];
      const result = await pool.query(
        `SELECT * FROM get_effective_collaboration_settings($1, $2)`,
        [tenantId, targetUserId]
      );

      return response(200, { data: result.rows[0] });
    }

    // =========================================================================
    // DASHBOARD
    // =========================================================================

    // GET /dashboard - Get full dashboard data
    if (path === '/dashboard' && method === 'GET') {
      const [tenantSettings, userCount, guestStats, sessionStats] = await Promise.all([
        pool.query(`SELECT * FROM tenant_collaboration_settings WHERE tenant_id = $1`, [tenantId]),
        pool.query(`SELECT COUNT(*) as count FROM user_collaboration_settings WHERE tenant_id = $1`, [tenantId]),
        pool.query(`
          SELECT 
            COUNT(*) as total_guests,
            COUNT(*) FILTER (WHERE converted_to_user_id IS NOT NULL) as converted_guests,
            COUNT(*) FILTER (WHERE is_online) as online_guests
          FROM collaboration_guests 
          WHERE session_id IN (
            SELECT cs.id FROM collaborative_sessions cs WHERE cs.tenant_id = $1
          )
        `, [tenantId]),
        pool.query(`
          SELECT 
            COUNT(*) as total_sessions,
            COUNT(*) FILTER (WHERE is_active) as active_sessions,
            AVG(max_participants) as avg_max_participants
          FROM collaborative_sessions WHERE tenant_id = $1
        `, [tenantId])
      ]);

      // Create default tenant settings if not exists
      let tenant = tenantSettings.rows[0];
      if (!tenant) {
        const insertResult = await pool.query(
          `INSERT INTO tenant_collaboration_settings (tenant_id) VALUES ($1) RETURNING *`,
          [tenantId]
        );
        tenant = insertResult.rows[0];
      }

      return response(200, {
        data: {
          tenantSettings: tenant,
          stats: {
            usersWithSettings: parseInt(userCount.rows[0].count),
            totalGuests: parseInt(guestStats.rows[0]?.total_guests || '0'),
            convertedGuests: parseInt(guestStats.rows[0]?.converted_guests || '0'),
            onlineGuests: parseInt(guestStats.rows[0]?.online_guests || '0'),
            totalSessions: parseInt(sessionStats.rows[0]?.total_sessions || '0'),
            activeSessions: parseInt(sessionStats.rows[0]?.active_sessions || '0'),
            conversionRate: guestStats.rows[0]?.total_guests > 0
              ? (guestStats.rows[0]?.converted_guests / guestStats.rows[0]?.total_guests * 100).toFixed(1)
              : '0'
          }
        }
      });
    }

    return response(404, { error: 'Not found' });
  } catch (error: any) {
    // Error logged by main handler
    return response(500, { error: error.message || 'Internal server error' });
  }
}

function response(statusCode: number, body: any): APIGatewayProxyResult {
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
