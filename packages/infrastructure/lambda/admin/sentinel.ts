/**
 * RADIANT SENTINEL v1.0.0 — Admin API Lambda Handler
 *
 * Base path: /api/admin/sentinel
 *
 * Endpoints:
 *   GET  /dashboard                      - Full SENTINEL dashboard
 *   GET  /health                         - SENTINEL self-health (for Pilot Light)
 *   POST /alerts/process                 - Process incoming alerts (from SNS)
 *   GET  /alerts                         - List active alerts
 *   GET  /incidents                      - List incidents
 *   GET  /incidents/:id                  - Get incident detail + timeline
 *   POST /incidents/:id/acknowledge      - Acknowledge an incident
 *   PUT  /incidents/:id/status           - Update incident status
 *   GET  /health-map                     - Service health grid
 *   POST /synthetic/run                  - Trigger synthetic health checks
 *   POST /semantic/run                   - Trigger semantic AI probes
 *   GET  /remediation/rules              - List remediation rules
 *   PUT  /remediation/rules/:id/state    - Update rule state (shadow/active/manual)
 *   POST /remediation/rules/:id/promote  - Promote shadow rule to active
 *   GET  /remediation/log                - Remediation audit log
 *   GET  /shadow-mode/log                - Shadow mode "would have done" log
 *   GET  /evidence                       - List evidence snapshots
 *   GET  /evidence/:incidentId           - Evidence for specific incident
 *   POST /evidence/:incidentId/verify    - Verify evidence integrity
 *   GET  /circuit-breakers               - Circuit breaker statuses
 *   GET  /postmortems                    - List postmortems
 *   POST /postmortems                    - Create postmortem
 *   GET  /playbooks                      - List playbooks
 *   GET  /preferences                    - Get alert preferences for current user
 *   PUT  /preferences                    - Update alert preferences
 *   GET  /notifications                  - Notification delivery log
 *   POST /heartbeat/emit                 - Manually trigger heartbeat
 *   GET  /heartbeat/status               - Heartbeat / Dead Man's Switch status
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { Pool } from 'pg';
import { getDbPool } from '../shared/services/database';
import { SentinelAlertProcessorService } from '../shared/services/sentinel-alert-processor.service';
import { SentinelWatchdogService } from '../shared/services/sentinel-watchdog.service';
import { SentinelNotifierService } from '../shared/services/sentinel-notifier.service';
import { SentinelAutoHealerService } from '../shared/services/sentinel-auto-healer.service';
import { SentinelEvidenceLockerService } from '../shared/services/sentinel-evidence-locker.service';
import { SentinelHeartbeatService } from '../shared/services/sentinel-heartbeat.service';

// ---------------------------------------------------------------------------
// Shared instances (reused across warm Lambda invocations)
// ---------------------------------------------------------------------------

let pool: Pool;
let alertProcessor: SentinelAlertProcessorService;
let watchdog: SentinelWatchdogService;
let notifier: SentinelNotifierService;
let autoHealer: SentinelAutoHealerService;
let evidenceLocker: SentinelEvidenceLockerService;
let heartbeat: SentinelHeartbeatService;

async function initServices(): Promise<void> {
  if (pool) return;

  pool = await getDbPool();

  alertProcessor = new SentinelAlertProcessorService(pool);

  watchdog = new SentinelWatchdogService(pool, {
    region: process.env.AWS_REGION || 'us-east-1',
    environment: (process.env.ENVIRONMENT || 'production') as 'production' | 'staging' | 'development',
    dynamoTableName: process.env.SENTINEL_ALERTS_TABLE || 'sentinel-alerts',
    alertQueueUrl: process.env.SENTINEL_ALERT_QUEUE_URL || '',
  });

  notifier = new SentinelNotifierService(pool, {
    pagerdutyRoutingKey: process.env.PAGERDUTY_ROUTING_KEY || '',
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioFromNumber: process.env.TWILIO_FROM_NUMBER,
    twilioEmergencyNumbers: (process.env.TWILIO_EMERGENCY_NUMBERS || '').split(',').filter(Boolean),
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
    slackCriticalChannelId: process.env.SLACK_CRITICAL_CHANNEL_ID,
  });

  autoHealer = new SentinelAutoHealerService(pool);

  evidenceLocker = new SentinelEvidenceLockerService(pool, {
    s3Bucket: process.env.SENTINEL_EVIDENCE_BUCKET || 'radiant-sentinel-evidence',
    lockRetentionDays: 365,
    windowBeforeMinutes: 30,
    windowAfterMinutes: 30,
    region: process.env.AWS_REGION || 'us-east-1',
    cloudwatchLogGroups: (process.env.CLOUDWATCH_LOG_GROUPS || '').split(',').filter(Boolean),
  });

  heartbeat = new SentinelHeartbeatService({
    region: process.env.AWS_REGION || 'us-east-1',
    deadMansSnitchUrl: process.env.DEAD_MANS_SNITCH_URL,
    pagerdutyHeartbeatUrl: process.env.PAGERDUTY_HEARTBEAT_URL,
    pilotLightHealthUrl: process.env.PILOT_LIGHT_HEALTH_URL,
    sentinelHealthUrl: process.env.SENTINEL_HEALTH_URL || 'https://admin.radiant.app/api/admin/sentinel/health',
    pagerdutyRoutingKey: process.env.PAGERDUTY_ROUTING_KEY,
  });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  await initServices();

  const method = event.httpMethod;
  const path = event.path.replace(/^\/api\/admin\/sentinel/, '') || '/';
  const tenantId = event.requestContext?.authorizer?.tenantId || '00000000-0000-0000-0000-000000000000';
  const userId = event.requestContext?.authorizer?.userId || 'system';

  try {
    await pool.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);

    // -----------------------------------------------------------------------
    // Dashboard
    // -----------------------------------------------------------------------
    if (method === 'GET' && path === '/dashboard') {
      const dashboard = await alertProcessor.getDashboard(tenantId);
      const healthMap = watchdog.getHealthMap();
      const cbStatuses = autoHealer.getCircuitBreakerStatuses();
      return ok({ ...dashboard, serviceHealthMap: healthMap, circuitBreakers: cbStatuses });
    }

    // -----------------------------------------------------------------------
    // Self-Health (for Pilot Light)
    // -----------------------------------------------------------------------
    if (method === 'GET' && path === '/health') {
      const health = heartbeat.getSelfHealth();
      return ok(health);
    }

    // -----------------------------------------------------------------------
    // Process Alerts (from SNS / CloudWatch)
    // -----------------------------------------------------------------------
    if (method === 'POST' && path === '/alerts/process') {
      const body = JSON.parse(event.body || '{}');
      const alerts = Array.isArray(body.alerts) ? body.alerts : [body];

      const processed = await alertProcessor.processAlerts(alerts);

      // Notify for new incidents
      for (const incident of processed.incidents) {
        await notifier.notifyForIncident(incident, processed.newAlerts.filter(a => a.incidentId === incident.id));
      }

      // Evaluate remediation for new alerts
      for (const alert of processed.newAlerts) {
        await autoHealer.evaluateRemediation(alert);
      }

      return ok({
        newAlerts: processed.newAlerts.length,
        deduplicated: processed.deduplicated.length,
        incidents: processed.incidents.length,
      });
    }

    // -----------------------------------------------------------------------
    // Alerts
    // -----------------------------------------------------------------------
    if (method === 'GET' && path === '/alerts') {
      const dashboard = await alertProcessor.getDashboard(tenantId);
      return ok({ alerts: dashboard.recentAlerts });
    }

    // -----------------------------------------------------------------------
    // Incidents
    // -----------------------------------------------------------------------
    if (method === 'GET' && path === '/incidents') {
      const status = event.queryStringParameters?.status;
      const severity = event.queryStringParameters?.severity ? parseInt(event.queryStringParameters.severity) : undefined;
      const limit = event.queryStringParameters?.limit ? parseInt(event.queryStringParameters.limit) : 50;
      const offset = event.queryStringParameters?.offset ? parseInt(event.queryStringParameters.offset) : 0;

      const result = await alertProcessor.getIncidents({
        status: status as any,
        severity: severity as any,
        limit,
        offset,
      });
      return ok(result);
    }

    const incidentDetailMatch = path.match(/^\/incidents\/([a-f0-9-]+)$/);
    if (method === 'GET' && incidentDetailMatch) {
      const incidentId = incidentDetailMatch[1];
      const incidents = await alertProcessor.getIncidents({ limit: 1 });
      const incident = incidents.incidents.find(i => i.id === incidentId);
      const timeline = await alertProcessor.getIncidentTimeline(incidentId);
      return ok({ incident, timeline });
    }

    const incidentAckMatch = path.match(/^\/incidents\/([a-f0-9-]+)\/acknowledge$/);
    if (method === 'POST' && incidentAckMatch) {
      await alertProcessor.acknowledgeIncident(incidentAckMatch[1], userId);
      return ok({ acknowledged: true });
    }

    const incidentStatusMatch = path.match(/^\/incidents\/([a-f0-9-]+)\/status$/);
    if (method === 'PUT' && incidentStatusMatch) {
      const body = JSON.parse(event.body || '{}');
      await alertProcessor.updateIncidentStatus(incidentStatusMatch[1], body.status, userId, body.note);
      return ok({ updated: true });
    }

    // -----------------------------------------------------------------------
    // Health Map
    // -----------------------------------------------------------------------
    if (method === 'GET' && path === '/health-map') {
      return ok({ services: watchdog.getHealthMap() });
    }

    // -----------------------------------------------------------------------
    // Synthetic & Semantic Checks
    // -----------------------------------------------------------------------
    if (method === 'POST' && path === '/synthetic/run') {
      const body = JSON.parse(event.body || '{}');
      const alerts = await watchdog.runSyntheticChecks(body.baseUrls || {});
      if (alerts.length > 0) {
        await alertProcessor.processAlerts(alerts);
      }
      return ok({ checksRun: 5, alertsGenerated: alerts.length, alerts });
    }

    if (method === 'POST' && path === '/semantic/run') {
      const { results, alerts } = await watchdog.runSemanticProbes();
      if (alerts.length > 0) {
        await alertProcessor.processAlerts(alerts);
      }
      return ok({ results, alertsGenerated: alerts.length });
    }

    // -----------------------------------------------------------------------
    // Remediation Rules
    // -----------------------------------------------------------------------
    if (method === 'GET' && path === '/remediation/rules') {
      const rules = await autoHealer.getRemediationRules(tenantId);
      return ok({ rules });
    }

    const ruleStateMatch = path.match(/^\/remediation\/rules\/([a-f0-9-]+)\/state$/);
    if (method === 'PUT' && ruleStateMatch) {
      const body = JSON.parse(event.body || '{}');
      await autoHealer.updateRuleState(ruleStateMatch[1], body.state);
      return ok({ updated: true });
    }

    const rulePromoteMatch = path.match(/^\/remediation\/rules\/([a-f0-9-]+)\/promote$/);
    if (method === 'POST' && rulePromoteMatch) {
      const result = await autoHealer.promoteShadowRule(rulePromoteMatch[1]);
      return ok(result);
    }

    if (method === 'GET' && path === '/remediation/log') {
      const incidentId = event.queryStringParameters?.incidentId;
      const limit = event.queryStringParameters?.limit ? parseInt(event.queryStringParameters.limit) : 50;
      const log = await autoHealer.getRemediationLog({ incidentId, limit });
      return ok({ log });
    }

    // -----------------------------------------------------------------------
    // Shadow Mode Log
    // -----------------------------------------------------------------------
    if (method === 'GET' && path === '/shadow-mode/log') {
      const ruleId = event.queryStringParameters?.ruleId;
      const limit = event.queryStringParameters?.limit ? parseInt(event.queryStringParameters.limit) : 50;
      const log = await autoHealer.getShadowModeLog(ruleId || undefined, limit);
      return ok({ log });
    }

    // -----------------------------------------------------------------------
    // Evidence Locker
    // -----------------------------------------------------------------------
    if (method === 'GET' && path === '/evidence') {
      const evidence = await evidenceLocker.getRecentEvidence();
      return ok({ evidence });
    }

    const evidenceIncidentMatch = path.match(/^\/evidence\/([a-f0-9-]+)$/);
    if (method === 'GET' && evidenceIncidentMatch) {
      const evidence = await evidenceLocker.getEvidenceForIncident(evidenceIncidentMatch[1]);
      return ok({ evidence });
    }

    const evidenceVerifyMatch = path.match(/^\/evidence\/([a-f0-9-]+)\/verify$/);
    if (method === 'POST' && evidenceVerifyMatch) {
      const result = await evidenceLocker.verifyEvidenceIntegrity(evidenceVerifyMatch[1]);
      return ok(result);
    }

    // -----------------------------------------------------------------------
    // Circuit Breakers
    // -----------------------------------------------------------------------
    if (method === 'GET' && path === '/circuit-breakers') {
      return ok({ circuitBreakers: autoHealer.getCircuitBreakerStatuses() });
    }

    // -----------------------------------------------------------------------
    // Postmortems
    // -----------------------------------------------------------------------
    if (method === 'GET' && path === '/postmortems') {
      const result = await pool.query(
        `SELECT * FROM sentinel_postmortems ORDER BY created_at DESC LIMIT 50`
      );
      return ok({ postmortems: result.rows });
    }

    if (method === 'POST' && path === '/postmortems') {
      const body = JSON.parse(event.body || '{}');
      const result = await pool.query(
        `INSERT INTO sentinel_postmortems
         (tenant_id, incident_id, title, summary, root_cause, impact_summary, timeline_summary,
          what_went_well, what_went_wrong, action_items, participants, ai_drafted_summary, published)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          tenantId, body.incidentId, body.title, body.summary, body.rootCause,
          body.impactSummary, body.timelineSummary,
          body.whatWentWell || [], body.whatWentWrong || [],
          JSON.stringify(body.actionItems || []), body.participants || [],
          body.aiDraftedSummary, body.published || false,
        ]
      );

      // Update incident with postmortem link
      await pool.query(
        `UPDATE sentinel_incidents SET postmortem_id = $1, status = 'postmortem', updated_at = NOW()
         WHERE id = $2`,
        [result.rows[0].id, body.incidentId]
      );

      return ok({ postmortem: result.rows[0] }, 201);
    }

    // -----------------------------------------------------------------------
    // Playbooks
    // -----------------------------------------------------------------------
    if (method === 'GET' && path === '/playbooks') {
      const result = await pool.query(
        `SELECT * FROM sentinel_playbooks ORDER BY name ASC`
      );
      return ok({ playbooks: result.rows });
    }

    // -----------------------------------------------------------------------
    // Alert Preferences
    // -----------------------------------------------------------------------
    if (method === 'GET' && path === '/preferences') {
      const prefs = await notifier.getAlertPreferences(userId);
      return ok({ preferences: prefs });
    }

    if (method === 'PUT' && path === '/preferences') {
      const body = JSON.parse(event.body || '{}');
      await notifier.upsertAlertPreferences({ ...body, userId }, tenantId);
      return ok({ updated: true });
    }

    // -----------------------------------------------------------------------
    // Notifications Log
    // -----------------------------------------------------------------------
    if (method === 'GET' && path === '/notifications') {
      const limit = event.queryStringParameters?.limit ? parseInt(event.queryStringParameters.limit) : 50;
      const result = await pool.query(
        `SELECT * FROM sentinel_notifications ORDER BY created_at DESC LIMIT $1`,
        [limit]
      );
      return ok({ notifications: result.rows });
    }

    // -----------------------------------------------------------------------
    // Heartbeat / Dead Man's Switch
    // -----------------------------------------------------------------------
    if (method === 'POST' && path === '/heartbeat/emit') {
      const dashboard = await alertProcessor.getDashboard(tenantId);
      const result = await heartbeat.emitHeartbeat({
        checksCompleted: dashboard.metrics.activeAlerts || 0,
        alertsActive: dashboard.metrics.activeAlerts || 0,
        notificationPipelineHealthy: true,
      });
      return ok(result);
    }

    if (method === 'GET' && path === '/heartbeat/status') {
      const health = heartbeat.getSelfHealth();
      return ok(health);
    }

    // -----------------------------------------------------------------------
    // 404
    // -----------------------------------------------------------------------
    return { statusCode: 404, body: JSON.stringify({ error: `Not found: ${method} ${path}` }), headers: corsHeaders() };

  } catch (error: unknown) {
    console.error('[SENTINEL API] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: (error as Error).message }),
      headers: corsHeaders(),
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ok(body: unknown, statusCode: number = 200): APIGatewayProxyResult {
  return {
    statusCode,
    body: JSON.stringify(body),
    headers: corsHeaders(),
  };
}

function corsHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}
