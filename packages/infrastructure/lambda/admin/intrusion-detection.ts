/**
 * RADIANT v4.18.0 — Intrusion Detection Admin API Handler
 *
 * Admin API routes for managing the RIDPS:
 *  GET  /admin/intrusion-detection/dashboard    — Dashboard stats
 *  GET  /admin/intrusion-detection/events       — Recent events
 *  GET  /admin/intrusion-detection/incidents     — Incidents list
 *  GET  /admin/intrusion-detection/blocked-ips   — Blocked IP list
 *  POST /admin/intrusion-detection/blocked-ips   — Manual IP block
 *  DELETE /admin/intrusion-detection/blocked-ips/:ip — Unblock IP
 *  GET  /admin/intrusion-detection/config        — RIDPS config
 *  PUT  /admin/intrusion-detection/config        — Update config
 *  GET  /admin/intrusion-detection/detectors     — List detectors
 *  PUT  /admin/intrusion-detection/detectors/:id — Update detector rule
 *  GET  /admin/intrusion-detection/threat-intel   — Threat indicators
 *  POST /admin/intrusion-detection/threat-intel   — Add indicator
 *  POST /admin/intrusion-detection/threat-intel/import — Bulk import
 *  DELETE /admin/intrusion-detection/threat-intel/:id — Remove indicator
 *  POST /admin/intrusion-detection/sessions/kill  — Kill session (manual)
 *  POST /admin/intrusion-detection/accounts/lock  — Lock account (manual)
 *  POST /admin/intrusion-detection/accounts/unlock — Unlock account (manual)
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createRegisteredLogger } from '../shared/services/logging-registry.service';
import { threatResponseService } from '../shared/services/threat-response.service';
import { threatDetectionEngine, IntrusionSeverity } from '../shared/services/intrusion-detection.service';
import { threatIntelligenceService } from '../shared/services/threat-intelligence.service';
import { executeStatement, stringParam, boolParam } from '../shared/db/client';
import { logAudit, AuditContext } from '../shared/services/audit';

const logger = createRegisteredLogger({
  serviceName: 'admin/intrusion-detection',
  category: 'security',
  sourceType: 'lambda',
});

function json(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export async function handleIntrusionDetection(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path.replace(/^\/admin\/intrusion-detection\/?/, '');
  const tenantId = (event as any).auth?.tenantId;

  try {
    // --- Dashboard Stats ---
    if (path === 'dashboard' && method === 'GET') {
      const stats = await threatResponseService.getDashboardStats(tenantId);
      const engineMetrics = threatDetectionEngine.getMetrics();
      const windowStats = threatDetectionEngine.getWindowStats();

      return json(200, {
        ...stats,
        engine: {
          ...engineMetrics,
          ...windowStats,
          detectorCount: threatDetectionEngine.getRegisteredDetectors().length,
        },
      });
    }

    // --- Recent Events ---
    if (path === 'events' && method === 'GET') {
      const severity = event.queryStringParameters?.severity as IntrusionSeverity | undefined;
      const detectorId = event.queryStringParameters?.detector;
      const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
      const since = event.queryStringParameters?.since
        ? new Date(event.queryStringParameters.since)
        : undefined;

      const events = await threatResponseService.getRecentEvents({
        tenantId,
        severity,
        detectorId,
        limit: Math.min(limit, 500),
        since,
      });

      return json(200, { events, count: events.length });
    }

    // --- Incidents ---
    if (path === 'incidents' && method === 'GET') {
      const status = event.queryStringParameters?.status;
      const limit = parseInt(event.queryStringParameters?.limit || '50', 10);

      const incidents = await threatResponseService.getIncidents({
        tenantId,
        status,
        limit: Math.min(limit, 200),
      });

      return json(200, { incidents, count: incidents.length });
    }

    // --- Update Incident Status ---
    if (path.startsWith('incidents/') && method === 'PUT') {
      const incidentId = path.replace('incidents/', '');
      const body = JSON.parse(event.body || '{}');

      const newStatus = body.status || 'investigating';
      await executeStatement(
        `UPDATE intrusion_incidents SET
           status = $1::intrusion_status,
           resolution_notes = COALESCE(NULLIF($2, ''), resolution_notes),
           resolved_at = CASE WHEN $1 = 'resolved' THEN now() ELSE resolved_at END,
           resolved_by = CASE WHEN $1 = 'resolved' THEN NULLIF($3, '')::uuid ELSE resolved_by END,
           updated_at = now()
         WHERE id = $4::uuid`,
        [
          stringParam('status', newStatus),
          stringParam('notes', body.resolutionNotes || ''),
          stringParam('admin', (event as any).auth?.userId || ''),
          stringParam('id', incidentId),
        ]
      );

      const auditCtx = buildAuditCtx(event, tenantId);
      await logAudit(auditCtx, 'incident_updated', 'intrusion_incident', {
        resourceId: incidentId,
        description: `Incident ${incidentId} status changed to ${newStatus}`,
        metadata: { incidentId, newStatus, resolutionNotes: body.resolutionNotes },
        severity: newStatus === 'resolved' || newStatus === 'false_positive' ? 'info' : 'warning',
      });

      return json(200, { success: true, incidentId, status: newStatus });
    }

    // --- Blocked IPs: List ---
    if (path === 'blocked-ips' && method === 'GET') {
      const blockedIps = await threatResponseService.getBlockedIps(tenantId);
      return json(200, { blockedIps, count: blockedIps.length });
    }

    // --- Blocked IPs: Manual Block ---
    if (path === 'blocked-ips' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      if (!body.ip) return json(400, { error: 'ip required' });

      await executeStatement(
        `INSERT INTO ip_blocklist (ip_address, reason, severity, source, tenant_id,
                                    expires_at, is_permanent, created_by, notes)
         VALUES ($1::inet, $2, $3::intrusion_severity, 'manual', NULLIF($4, '')::uuid,
                 CASE WHEN $5::boolean THEN NULL ELSE now() + ($6 || ' minutes')::interval END,
                 $5::boolean, NULLIF($7, '')::uuid, $8)
         ON CONFLICT (ip_address, tenant_id) DO UPDATE SET
           reason = EXCLUDED.reason,
           severity = EXCLUDED.severity,
           expires_at = EXCLUDED.expires_at,
           is_permanent = EXCLUDED.is_permanent,
           notes = EXCLUDED.notes`,
        [
          stringParam('ip', body.ip),
          stringParam('reason', body.reason || 'Manual block by admin'),
          stringParam('severity', body.severity || 'high'),
          stringParam('tenant', tenantId || ''),
          boolParam('permanent', body.permanent || false),
          stringParam('duration', String(body.durationMinutes || 60)),
          stringParam('admin', (event as any).auth?.userId || ''),
          stringParam('notes', body.notes || ''),
        ]
      );

      const auditCtx = buildAuditCtx(event, tenantId);
      await logAudit(auditCtx, 'ip_blocked', 'ip_blocklist', {
        resourceId: body.ip,
        description: `Manual IP block: ${body.ip} — ${body.reason || 'No reason'}`,
        metadata: { ip: body.ip, reason: body.reason, severity: body.severity, permanent: body.permanent },
        severity: 'warning',
      });

      logger.info(`Manual IP block: ${body.ip}`, {
        admin: (event as any).auth?.userId,
        reason: body.reason,
      });

      return json(201, { success: true, ip: body.ip });
    }

    // --- Blocked IPs: Unblock ---
    if (path.startsWith('blocked-ips/') && method === 'DELETE') {
      const ip = decodeURIComponent(path.replace('blocked-ips/', ''));
      const adminId = (event as any).auth?.userId;
      const removed = await threatResponseService.unbanIp(ip, tenantId, adminId);

      if (removed) {
        const auditCtx = buildAuditCtx(event, tenantId);
        await logAudit(auditCtx, 'ip_unblocked', 'ip_blocklist', {
          resourceId: ip,
          description: `IP unblocked: ${ip}`,
          severity: 'warning',
        });
      }

      return json(200, { success: removed, ip });
    }

    // --- Config: Get ---
    if (path === 'config' && method === 'GET') {
      const config = await threatResponseService.getConfig();
      return json(200, config);
    }

    // --- Config: Update ---
    if (path === 'config' && method === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      await threatResponseService.updateConfig(body);
      const updated = await threatResponseService.getConfig();

      const auditCtx = buildAuditCtx(event, tenantId);
      await logAudit(auditCtx, 'config_changed', 'config', {
        resourceId: 'ridps_config',
        description: `RIDPS config updated: ${Object.keys(body).join(', ')}`,
        metadata: { changes: body },
        severity: 'warning',
      });

      logger.info('RIDPS config updated', {
        admin: (event as any).auth?.userId,
        changes: Object.keys(body),
      });

      return json(200, updated);
    }

    // --- Detectors: List ---
    if (path === 'detectors' && method === 'GET') {
      const detectors = threatDetectionEngine.getRegisteredDetectors();

      // Enrich with rule config from DB
      const rulesResult = await executeStatement(
        `SELECT detector_id, enabled, severity_override, threshold_config, response_actions,
                cooldown_seconds, mitre_technique, standard_refs, description
         FROM detection_rules WHERE tenant_id IS NULL ORDER BY detector_id`,
        []
      );

      const rules = (rulesResult.rows || []).map(row => ({
        detectorId: String(row.detector_id),
        enabled: Boolean(row.enabled),
        severityOverride: row.severity_override ? String(row.severity_override) : null,
        thresholdConfig: row.threshold_config,
        responseActions: row.response_actions,
        cooldownSeconds: Number(row.cooldown_seconds),
        mitreTechnique: row.mitre_technique ? String(row.mitre_technique) : null,
        standardRefs: row.standard_refs || [],
        description: row.description ? String(row.description) : null,
      }));

      return json(200, { detectors, rules });
    }

    // --- Detectors: Update Rule ---
    if (path.startsWith('detectors/') && method === 'PUT') {
      const detectorId = path.replace('detectors/', '');
      const body = JSON.parse(event.body || '{}');

      const setClauses: string[] = ['updated_at = now()'];
      const params: ReturnType<typeof stringParam>[] = [];
      let idx = 1;

      if ('enabled' in body) {
        setClauses.push(`enabled = $${idx}`);
        params.push(boolParam('enabled', body.enabled));
        idx++;
      }
      if ('thresholdConfig' in body) {
        setClauses.push(`threshold_config = $${idx}::jsonb`);
        params.push(stringParam('config', JSON.stringify(body.thresholdConfig)));
        idx++;
      }
      if ('responseActions' in body) {
        setClauses.push(`response_actions = $${idx}::response_action[]`);
        params.push(stringParam('actions', `{${body.responseActions.join(',')}}`));
        idx++;
      }
      if ('cooldownSeconds' in body) {
        setClauses.push(`cooldown_seconds = $${idx}`);
        params.push(stringParam('cooldown', String(body.cooldownSeconds)));
        idx++;
      }

      params.push(stringParam('detector', detectorId));

      await executeStatement(
        `UPDATE detection_rules SET ${setClauses.join(', ')}
         WHERE detector_id = $${idx} AND tenant_id IS NULL`,
        params
      );

      // Force engine to reload rules
      await threatDetectionEngine.reloadRules();

      const auditCtx = buildAuditCtx(event, tenantId);
      await logAudit(auditCtx, 'detector_toggled', 'detection_rule', {
        resourceId: detectorId,
        description: `Detector ${detectorId} updated: ${Object.keys(body).join(', ')}`,
        metadata: { detectorId, changes: body },
        severity: 'info',
      });

      return json(200, { success: true, detectorId });
    }

    // --- Threat Intelligence: List ---
    if (path === 'threat-intel' && method === 'GET') {
      const type = event.queryStringParameters?.type;
      const limit = parseInt(event.queryStringParameters?.limit || '100', 10);

      const indicators = await threatIntelligenceService.getIndicators({
        type: type as any,
        limit: Math.min(limit, 500),
      });
      const stats = await threatIntelligenceService.getStats();

      return json(200, { indicators, stats, count: indicators.length });
    }

    // --- Threat Intelligence: Add ---
    if (path === 'threat-intel' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      if (!body.type || !body.value || !body.threatType) {
        return json(400, { error: 'type, value, and threatType required' });
      }

      const indicator = await threatIntelligenceService.addIndicator({
        indicatorType: body.type,
        indicatorValue: body.value,
        threatType: body.threatType,
        confidence: body.confidence || 0.8,
        source: 'admin_manual',
        isActive: true,
        metadata: body.metadata || {},
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      });

      const auditCtx = buildAuditCtx(event, tenantId);
      await logAudit(auditCtx, 'threat_intel_added', 'threat_indicator', {
        resourceId: body.value,
        description: `Threat indicator added: ${body.type}=${body.value} (${body.threatType})`,
        metadata: { type: body.type, value: body.value, threatType: body.threatType },
        severity: 'info',
      });

      return json(201, indicator);
    }

    // --- Threat Intelligence: Import Bulk ---
    if (path === 'threat-intel/import' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      if (!Array.isArray(body.indicators)) {
        return json(400, { error: 'indicators array required' });
      }

      const result = await threatIntelligenceService.importIndicators(body.indicators);
      return json(200, result);
    }

    // --- Threat Intelligence: Delete ---
    if (path.startsWith('threat-intel/') && method === 'DELETE') {
      const indicatorId = path.replace('threat-intel/', '');
      const removed = await threatIntelligenceService.removeIndicator(indicatorId);

      if (removed) {
        const auditCtx = buildAuditCtx(event, tenantId);
        await logAudit(auditCtx, 'threat_intel_removed', 'threat_indicator', {
          resourceId: indicatorId,
          description: `Threat indicator removed: ${indicatorId}`,
          severity: 'info',
        });
      }

      return json(200, { success: removed });
    }

    // --- Manual Session Kill ---
    if (path === 'sessions/kill' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      if (!body.sessionId) return json(400, { error: 'sessionId required' });

      const adminId = (event as any).auth?.userId || '';
      const killed = await threatResponseService.manualKillSession(
        body.sessionId, tenantId, adminId, body.reason
      );

      const auditCtx = buildAuditCtx(event, tenantId);
      await logAudit(auditCtx, 'session_killed', 'user_session', {
        resourceId: body.sessionId,
        description: `Session killed: ${body.sessionId} — ${body.reason || 'Manual admin action'}`,
        metadata: { sessionId: body.sessionId, reason: body.reason },
        severity: 'warning',
      });

      return json(200, { success: killed, sessionId: body.sessionId });
    }

    // --- Manual Account Lock ---
    if (path === 'accounts/lock' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      if (!body.userId) return json(400, { error: 'userId required' });

      const adminId = (event as any).auth?.userId || '';
      const locked = await threatResponseService.manualLockAccount(
        body.userId, tenantId, adminId, body.reason
      );

      const auditCtx = buildAuditCtx(event, tenantId);
      await logAudit(auditCtx, 'account_locked', 'user', {
        resourceId: body.userId,
        description: `Account locked: ${body.userId} — ${body.reason || 'Manual admin action'}`,
        metadata: { userId: body.userId, reason: body.reason },
        severity: 'critical',
      });

      return json(200, { success: locked, userId: body.userId });
    }

    // --- Manual Account Unlock ---
    if (path === 'accounts/unlock' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      if (!body.userId) return json(400, { error: 'userId required' });

      const adminId = (event as any).auth?.userId || '';
      const unlocked = await threatResponseService.unlockAccount(
        body.userId, tenantId, adminId
      );

      const auditCtx = buildAuditCtx(event, tenantId);
      await logAudit(auditCtx, 'account_unlocked', 'user', {
        resourceId: body.userId,
        description: `Account unlocked: ${body.userId}`,
        severity: 'warning',
      });

      return json(200, { success: unlocked, userId: body.userId });
    }

    // --- Locked Accounts: List ---
    if (path === 'locked-accounts' && method === 'GET') {
      const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
      const locked = await threatResponseService.getLockedAccounts(tenantId, Math.min(limit, 200));
      return json(200, { lockedAccounts: locked, count: locked.length });
    }

    // --- Locked Accounts: Lockout History for User ---
    if (path.startsWith('locked-accounts/') && path.endsWith('/history') && method === 'GET') {
      const userId = path.replace('locked-accounts/', '').replace('/history', '');
      const limit = parseInt(event.queryStringParameters?.limit || '20', 10);
      const history = await threatResponseService.getLockoutHistory(userId, tenantId, Math.min(limit, 100));
      return json(200, { history, count: history.length });
    }

    // --- Lockout Policy: Get ---
    if (path === 'lockout-policy' && method === 'GET') {
      const result = await executeStatement(
        `SELECT * FROM lockout_policy
         WHERE tenant_id = $1::uuid OR tenant_id IS NULL
         ORDER BY tenant_id NULLS LAST LIMIT 1`,
        [stringParam('tenant', tenantId || '00000000-0000-0000-0000-000000000000')]
      );
      const row = result.rows?.[0];
      if (!row) return json(200, { policy: null });

      return json(200, {
        policy: {
          tenantId: row.tenant_id ? String(row.tenant_id) : null,
          duration1st: Number(row.duration_1st),
          duration2nd: Number(row.duration_2nd),
          duration3rd: Number(row.duration_3rd),
          permanentAfter: Number(row.permanent_after),
          offenseWindowDays: Number(row.offense_window_days),
          permanentWindowDays: Number(row.permanent_window_days),
          selfServiceEnabled: Boolean(row.self_service_enabled),
          selfServiceMaxOffense: Number(row.self_service_max_offense),
          selfServiceMethod: String(row.self_service_method),
          autoUnlockEnabled: Boolean(row.auto_unlock_enabled),
          notifyUserOnLock: Boolean(row.notify_user_on_lock),
          notifyAdminOnPermanent: Boolean(row.notify_admin_on_permanent),
        },
      });
    }

    // --- Lockout Policy: Update ---
    if (path === 'lockout-policy' && method === 'PUT') {
      const body = JSON.parse(event.body || '{}');

      const setClauses: string[] = ['updated_at = now()'];
      const params: ReturnType<typeof stringParam>[] = [];
      let idx = 1;

      const fieldMap: Record<string, { col: string; type: 'int' | 'bool' | 'str' }> = {
        duration1st: { col: 'duration_1st', type: 'int' },
        duration2nd: { col: 'duration_2nd', type: 'int' },
        duration3rd: { col: 'duration_3rd', type: 'int' },
        permanentAfter: { col: 'permanent_after', type: 'int' },
        offenseWindowDays: { col: 'offense_window_days', type: 'int' },
        permanentWindowDays: { col: 'permanent_window_days', type: 'int' },
        selfServiceEnabled: { col: 'self_service_enabled', type: 'bool' },
        selfServiceMaxOffense: { col: 'self_service_max_offense', type: 'int' },
        selfServiceMethod: { col: 'self_service_method', type: 'str' },
        autoUnlockEnabled: { col: 'auto_unlock_enabled', type: 'bool' },
        notifyUserOnLock: { col: 'notify_user_on_lock', type: 'bool' },
        notifyAdminOnPermanent: { col: 'notify_admin_on_permanent', type: 'bool' },
      };

      for (const [key, { col, type }] of Object.entries(fieldMap)) {
        if (key in body) {
          setClauses.push(`${col} = $${idx}`);
          if (type === 'bool') {
            params.push(boolParam(key, body[key]));
          } else {
            params.push(stringParam(key, String(body[key])));
          }
          idx++;
        }
      }

      if (setClauses.length > 1) {
        // Upsert: update tenant-specific or global
        params.push(stringParam('tenant', tenantId || ''));
        await executeStatement(
          `INSERT INTO lockout_policy (tenant_id, ${Object.entries(fieldMap).filter(([k]) => k in body).map(([, v]) => v.col).join(', ')})
           VALUES (NULLIF($${idx}, '')::uuid, ${setClauses.slice(1).map((_, i) => `$${i + 1}`).join(', ')})
           ON CONFLICT (tenant_id) DO UPDATE SET ${setClauses.join(', ')}`,
          params
        );

        const auditCtx = buildAuditCtx(event, tenantId);
        await logAudit(auditCtx, 'config_changed', 'config', {
          resourceId: 'lockout_policy',
          description: `Lockout policy updated: ${Object.keys(body).join(', ')}`,
          metadata: { changes: body },
          severity: 'warning',
        });
      }

      return json(200, { success: true });
    }

    return json(404, { error: 'Not found' });

  } catch (err) {
    logger.error('Intrusion detection admin handler error', err as Error);
    return json(500, { error: 'Internal server error' });
  }
}

function buildAuditCtx(event: APIGatewayProxyEvent, tenantId: string): AuditContext {
  return {
    tenantId: tenantId || '',
    userId: (event as any).auth?.userId,
    ipAddress: event.requestContext?.identity?.sourceIp,
    userAgent: event.headers?.['User-Agent'] || event.headers?.['user-agent'],
    requestId: event.requestContext?.requestId,
  };
}
