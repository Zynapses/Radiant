/**
 * RADIANT v4.18.0 — Automated Threat Response Service
 *
 * Executes response actions triggered by the intrusion detection engine:
 *  - IP banning (temporary + permanent with escalation)
 *  - Session termination
 *  - Account lockout
 *  - WAF IP set synchronization
 *  - Adaptive rate limit adjustments
 *
 * Standards:
 *  - NIST SP 800-94 §4.4: Active response capabilities
 *  - NIST CSF RS.RP-01: Incident response execution
 *  - CIS Control 13.6: Network-based IDS/IPS deployed
 *  - SOC 2 CC7.4: Incident response activities
 */

import { executeStatement, stringParam, longParam, doubleParam, boolParam } from '../db/client';
import { createRegisteredLogger } from './logging-registry.service';
import { securityAlertService } from './security-alert.service';
import { IntrusionSeverity, ResponseAction } from './intrusion-detection.service';
import * as crypto from 'crypto';

const logger = createRegisteredLogger({
  serviceName: 'security/threat-response',
  category: 'security',
  sourceType: 'application',
});

// ============================================================================
// Types
// ============================================================================

export interface ThreatResponseRequest {
  sourceIp: string;
  tenantId?: string;
  userId?: string;
  sessionId?: string;
  detectorId: string;
  severity: IntrusionSeverity;
  confidence: number;
  actions: ResponseAction[];
  reason: string;
  details: Record<string, unknown>;
}

export interface ThreatResponseResult {
  responseId: string;
  actionsExecuted: ResponseAction[];
  actionsSkipped: { action: ResponseAction; reason: string }[];
  errors: string[];
}

export interface IPBlockEntry {
  id: string;
  ipAddress: string;
  reason: string;
  detectorId?: string;
  severity: IntrusionSeverity;
  source: string;
  blockedAt: Date;
  expiresAt?: Date;
  isPermanent: boolean;
  hitCount: number;
  tenantId?: string;
}

export interface RIDPSConfig {
  enabled: boolean;
  autoBlockEnabled: boolean;
  autoBlockMinSeverity: IntrusionSeverity;
  autoBlockMinConfidence: number;
  ipBanDurationMinutes: number;
  permanentBanThreshold: number;
  wafSyncEnabled: boolean;
  sentinelEscalationEnabled: boolean;
  baselineLearningDays: number;
  eventRetentionDays: number;
}

// ============================================================================
// Threat Response Service
// ============================================================================

class ThreatResponseService {
  private config: RIDPSConfig | null = null;
  private configLoadedAt = 0;
  private configCacheTtlMs = 60000;

  // --------------------------------------------------------------------------
  // Execute Response
  // --------------------------------------------------------------------------

  async executeResponse(request: ThreatResponseRequest): Promise<ThreatResponseResult> {
    const result: ThreatResponseResult = {
      responseId: crypto.randomUUID(),
      actionsExecuted: [],
      actionsSkipped: [],
      errors: [],
    };

    const config = await this.getConfig();
    if (!config.enabled) {
      result.actionsSkipped.push({ action: 'log_only', reason: 'RIDPS disabled' });
      return result;
    }

    // Check if auto-block is allowed for this severity/confidence
    const severityOrder: IntrusionSeverity[] = ['low', 'medium', 'high', 'critical'];
    const meetsAutoBlockThreshold =
      config.autoBlockEnabled &&
      severityOrder.indexOf(request.severity) >= severityOrder.indexOf(config.autoBlockMinSeverity) &&
      request.confidence >= config.autoBlockMinConfidence;

    for (const action of request.actions) {
      try {
        switch (action) {
          case 'log_only':
            // Already handled by detection engine
            result.actionsExecuted.push(action);
            break;

          case 'rate_limit':
            // Rate limit is enforced by middleware reading detection results
            result.actionsExecuted.push(action);
            break;

          case 'challenge':
            // Challenge (e.g., CAPTCHA) is handled by frontend reading response headers
            result.actionsExecuted.push(action);
            break;

          case 'block_request':
            // Already blocked by middleware
            result.actionsExecuted.push(action);
            break;

          case 'ban_ip':
            if (meetsAutoBlockThreshold) {
              await this.banIp(request, config);
              result.actionsExecuted.push(action);
            } else {
              result.actionsSkipped.push({
                action,
                reason: `Auto-block threshold not met (severity: ${request.severity}, confidence: ${request.confidence})`,
              });
            }
            break;

          case 'kill_session':
            if (request.sessionId) {
              await this.killSession(request);
              result.actionsExecuted.push(action);
            } else {
              result.actionsSkipped.push({ action, reason: 'No session ID available' });
            }
            break;

          case 'lock_account':
            if (request.userId && meetsAutoBlockThreshold) {
              await this.lockAccount(request);
              result.actionsExecuted.push(action);
            } else {
              result.actionsSkipped.push({
                action,
                reason: request.userId ? 'Auto-block threshold not met' : 'No user ID available',
              });
            }
            break;

          case 'alert_admin':
            await this.alertAdmin(request);
            result.actionsExecuted.push(action);
            break;

          case 'escalate_sentinel':
            if (config.sentinelEscalationEnabled) {
              await this.escalateSentinel(request);
              result.actionsExecuted.push(action);
            } else {
              result.actionsSkipped.push({ action, reason: 'SENTINEL escalation disabled' });
            }
            break;

          case 'waf_block':
            if (config.wafSyncEnabled) {
              await this.syncToWaf(request);
              result.actionsExecuted.push(action);
            } else {
              result.actionsSkipped.push({ action, reason: 'WAF sync disabled' });
            }
            break;

          default:
            result.actionsSkipped.push({ action, reason: 'Unknown action' });
        }
      } catch (err) {
        const errMsg = `Action ${action} failed: ${String(err)}`;
        result.errors.push(errMsg);
        logger.error(errMsg, err as Error);
      }
    }

    // Persist response record
    await this.persistResponse(request, result);

    return result;
  }

  // --------------------------------------------------------------------------
  // IP Ban Management
  // --------------------------------------------------------------------------

  private async banIp(request: ThreatResponseRequest, config: RIDPSConfig): Promise<void> {
    const durationMinutes = request.severity === 'critical'
      ? config.ipBanDurationMinutes * 24  // 24x duration for critical
      : config.ipBanDurationMinutes;

    // Check how many times this IP has been banned before
    const priorBans = await this.getPriorBanCount(request.sourceIp);
    const isPermanent = priorBans >= config.permanentBanThreshold;

    await executeStatement(
      `INSERT INTO ip_blocklist (ip_address, reason, detector_id, severity, source, tenant_id,
                                  expires_at, is_permanent)
       VALUES ($1::inet, $2, $3, $4::intrusion_severity, 'auto', NULLIF($5, '')::uuid,
               CASE WHEN $6::boolean THEN NULL ELSE now() + ($7 || ' minutes')::interval END,
               $6::boolean)
       ON CONFLICT (ip_address, tenant_id) DO UPDATE SET
         reason = EXCLUDED.reason,
         severity = CASE WHEN ip_blocklist.severity::text < EXCLUDED.severity::text
                    THEN EXCLUDED.severity ELSE ip_blocklist.severity END,
         expires_at = CASE WHEN EXCLUDED.is_permanent THEN NULL
                      ELSE GREATEST(ip_blocklist.expires_at, EXCLUDED.expires_at) END,
         is_permanent = ip_blocklist.is_permanent OR EXCLUDED.is_permanent`,
      [
        stringParam('ip', request.sourceIp),
        stringParam('reason', request.reason),
        stringParam('detector', request.detectorId),
        stringParam('severity', request.severity),
        stringParam('tenant', request.tenantId || ''),
        boolParam('permanent', isPermanent),
        stringParam('duration', String(durationMinutes)),
      ]
    );

    logger.warn(`IP banned: ${request.sourceIp}`, {
      duration: isPermanent ? 'permanent' : `${durationMinutes}m`,
      severity: request.severity,
      priorBans,
      detector: request.detectorId,
    });
  }

  private async getPriorBanCount(ip: string): Promise<number> {
    try {
      const result = await executeStatement(
        `SELECT COUNT(*) as cnt FROM intrusion_events
         WHERE source_ip = $1::inet AND response_action = 'ban_ip'
           AND created_at > now() - interval '30 days'`,
        [stringParam('ip', ip)]
      );
      return Number(result.rows?.[0]?.cnt) || 0;
    } catch {
      return 0;
    }
  }

  async unbanIp(ip: string, tenantId?: string, adminId?: string): Promise<boolean> {
    try {
      const result = await executeStatement(
        `DELETE FROM ip_blocklist
         WHERE ip_address = $1::inet AND (tenant_id IS NULL OR tenant_id = $2::uuid)
         RETURNING id`,
        [
          stringParam('ip', ip),
          stringParam('tenant', tenantId || '00000000-0000-0000-0000-000000000000'),
        ]
      );
      const removed = (result.rows?.length || 0) > 0;
      if (removed) {
        logger.info(`IP unbanned: ${ip}`, { adminId, tenantId });
      }
      return removed;
    } catch (err) {
      logger.error('Failed to unban IP', err as Error);
      return false;
    }
  }

  async getBlockedIps(tenantId?: string, limit = 100): Promise<IPBlockEntry[]> {
    let query = `SELECT * FROM ip_blocklist WHERE (is_permanent OR expires_at > now())`;
    const params = [];
    let idx = 1;

    if (tenantId) {
      query += ` AND (tenant_id IS NULL OR tenant_id = $${idx}::uuid)`;
      params.push(stringParam('tenant', tenantId));
      idx++;
    }

    query += ` ORDER BY blocked_at DESC LIMIT $${idx}`;
    params.push(longParam('limit', limit));

    const result = await executeStatement(query, params);

    return (result.rows || []).map(row => ({
      id: String(row.id),
      ipAddress: String(row.ip_address),
      reason: String(row.reason),
      detectorId: row.detector_id ? String(row.detector_id) : undefined,
      severity: String(row.severity) as IntrusionSeverity,
      source: String(row.source),
      blockedAt: new Date(row.blocked_at as string),
      expiresAt: row.expires_at ? new Date(row.expires_at as string) : undefined,
      isPermanent: Boolean(row.is_permanent),
      hitCount: Number(row.hit_count),
      tenantId: row.tenant_id ? String(row.tenant_id) : undefined,
    }));
  }

  // --------------------------------------------------------------------------
  // Session Management
  // --------------------------------------------------------------------------

  private async killSession(request: ThreatResponseRequest): Promise<void> {
    // Invalidate session in database
    try {
      await executeStatement(
        `UPDATE user_sessions SET revoked = true, revoked_reason = $1
         WHERE session_id = $2 AND (tenant_id IS NULL OR tenant_id = $3::uuid)`,
        [
          stringParam('reason', `RIDPS: ${request.reason}`),
          stringParam('sessionId', request.sessionId!),
          stringParam('tenant', request.tenantId || ''),
        ]
      );
      logger.warn(`Session killed: ${request.sessionId?.substring(0, 8)}...`, {
        userId: request.userId,
        detector: request.detectorId,
      });
    } catch (err) {
      // Session table might not exist or have different schema — log but don't fail
      logger.warn('Session kill attempted (table may not exist)', { sessionId: request.sessionId });
    }
  }

  // --------------------------------------------------------------------------
  // Account Lockout — Progressive Duration
  //
  // Policy (configurable per-tenant via lockout_policy table):
  //   1st offense:        30 min auto-unlock
  //   2nd offense (7d):   2 hour auto-unlock
  //   3rd offense (7d):   24 hour auto-unlock
  //   4th+ offense (30d): Permanent — requires admin review
  //
  // Standards: NIST SP 800-63B §5.2.8, CIS Control 6.2
  // --------------------------------------------------------------------------

  private async lockAccount(request: ThreatResponseRequest): Promise<void> {
    if (!request.userId || !request.tenantId) {
      logger.warn('lockAccount called without userId or tenantId', { request });
      return;
    }

    try {
      // Calculate progressive duration via DB function
      const durationResult = await executeStatement(
        `SELECT offense_number, duration_minutes, is_permanent, locked_until::text as locked_until
         FROM calculate_lockout_duration($1::uuid, $2::uuid)`,
        [
          stringParam('tenant', request.tenantId),
          stringParam('user', request.userId),
        ]
      );

      const row = durationResult.rows?.[0];
      const offenseNumber = Number(row?.offense_number) || 1;
      const durationMinutes = row?.duration_minutes ? Number(row.duration_minutes) : null;
      const isPermanent = Boolean(row?.is_permanent);
      const lockedUntil = row?.locked_until ? String(row.locked_until) : null;

      // Map detector to reason type
      const reasonType = this.mapDetectorToReasonType(request.detectorId);

      // Record in lockout history
      const historyResult = await executeStatement(
        `INSERT INTO account_lockout_history (
          tenant_id, user_id, reason_type, reason_text, severity, detector_id,
          source_ip, offense_number, duration_minutes, locked_until, is_permanent, metadata
        ) VALUES (
          $1::uuid, $2::uuid, $3::lockout_reason_type, $4, $5::intrusion_severity, $6,
          $7::inet, $8, $9, $10::timestamptz, $11, $12::jsonb
        ) RETURNING id::text as id`,
        [
          stringParam('tenant', request.tenantId),
          stringParam('user', request.userId),
          stringParam('reasonType', reasonType),
          stringParam('reason', `RIDPS: ${request.reason}`),
          stringParam('severity', request.severity),
          stringParam('detector', request.detectorId),
          stringParam('ip', request.sourceIp),
          longParam('offense', offenseNumber),
          durationMinutes ? longParam('duration', durationMinutes) : stringParam('duration', ''),
          stringParam('until', lockedUntil || ''),
          boolParam('permanent', isPermanent),
          stringParam('meta', JSON.stringify(request.details || {})),
        ]
      );
      const lockoutId = String(historyResult.rows?.[0]?.id || '');

      // Lock the user account
      await executeStatement(
        `UPDATE users SET
          account_locked = true,
          account_locked_reason = $1,
          account_locked_at = now(),
          account_locked_until = NULLIF($2, '')::timestamptz,
          account_lock_count = account_lock_count + 1,
          account_lock_permanent = $3,
          last_lockout_id = NULLIF($4, '')::uuid
         WHERE id = $5::uuid AND (tenant_id IS NULL OR tenant_id = NULLIF($6, '')::uuid)`,
        [
          stringParam('reason', `RIDPS: ${request.reason}`),
          stringParam('until', lockedUntil || ''),
          boolParam('permanent', isPermanent),
          stringParam('lockoutId', lockoutId),
          stringParam('userId', request.userId),
          stringParam('tenant', request.tenantId || ''),
        ]
      );

      const durationStr = isPermanent ? 'PERMANENT' : `${durationMinutes}m`;
      logger.warn(`Account locked (offense #${offenseNumber}, ${durationStr}): ${request.userId.substring(0, 8)}...`, {
        detector: request.detectorId,
        severity: request.severity,
        offenseNumber,
        durationMinutes,
        isPermanent,
      });
    } catch (err) {
      logger.error('Account lock failed', err as Error, { userId: request.userId });
    }
  }

  private mapDetectorToReasonType(detectorId: string): string {
    const map: Record<string, string> = {
      brute_force_auth: 'brute_force',
      credential_stuffing: 'credential_stuffing',
      impossible_travel: 'impossible_travel',
      session_hijacking: 'session_hijack',
      account_takeover: 'account_takeover',
      privilege_escalation: 'privilege_escalation',
      cross_tenant_probe: 'cross_tenant_probe',
    };
    return map[detectorId] || 'other';
  }

  async manualKillSession(sessionId: string, tenantId: string, adminId: string, reason?: string): Promise<boolean> {
    try {
      await executeStatement(
        `UPDATE user_sessions SET revoked = true, revoked_reason = $1
         WHERE session_id = $2 AND (tenant_id IS NULL OR tenant_id = NULLIF($3, '')::uuid)`,
        [
          stringParam('reason', reason || `Manual kill by admin ${adminId}`),
          stringParam('sessionId', sessionId),
          stringParam('tenant', tenantId || ''),
        ]
      );
      logger.warn(`Session manually killed: ${sessionId.substring(0, 8)}...`, { adminId, tenantId });
      return true;
    } catch (err) {
      logger.error('Manual session kill failed', err as Error);
      return false;
    }
  }

  async manualLockAccount(userId: string, tenantId: string, adminId: string, reason?: string, permanent = true): Promise<boolean> {
    try {
      // Record in history
      await executeStatement(
        `INSERT INTO account_lockout_history (
          tenant_id, user_id, reason_type, reason_text, severity,
          offense_number, is_permanent, metadata
        ) VALUES (
          NULLIF($1, '')::uuid, $2::uuid, 'admin_manual', $3, 'high'::intrusion_severity,
          COALESCE((SELECT account_lock_count FROM users WHERE id = $2::uuid LIMIT 1), 0) + 1,
          $4, $5::jsonb
        ) RETURNING id::text as id`,
        [
          stringParam('tenant', tenantId || ''),
          stringParam('user', userId),
          stringParam('reason', reason || `Manual lock by admin ${adminId}`),
          boolParam('permanent', permanent),
          stringParam('meta', JSON.stringify({ adminId })),
        ]
      );

      // Lock the user
      await executeStatement(
        `UPDATE users SET
          account_locked = true,
          account_locked_reason = $1,
          account_locked_at = now(),
          account_locked_until = NULL,
          account_lock_count = account_lock_count + 1,
          account_lock_permanent = $2
         WHERE id = $3::uuid AND (tenant_id IS NULL OR tenant_id = NULLIF($4, '')::uuid)`,
        [
          stringParam('reason', reason || `Manual lock by admin ${adminId}`),
          boolParam('permanent', permanent),
          stringParam('userId', userId),
          stringParam('tenant', tenantId || ''),
        ]
      );
      logger.warn(`Account manually locked: ${userId.substring(0, 8)}...`, { adminId, tenantId, permanent });
      return true;
    } catch (err) {
      logger.error('Manual account lock failed', err as Error);
      return false;
    }
  }

  async unlockAccount(userId: string, tenantId: string, adminId: string, notes?: string): Promise<boolean> {
    try {
      // Clear lockout on user
      await executeStatement(
        `UPDATE users SET
          account_locked = false,
          account_locked_reason = NULL,
          account_locked_at = NULL,
          account_locked_until = NULL,
          account_lock_permanent = false
         WHERE id = $1::uuid AND (tenant_id IS NULL OR tenant_id = NULLIF($2, '')::uuid)`,
        [stringParam('userId', userId), stringParam('tenant', tenantId || '')]
      );

      // Resolve active lockout history entries
      await executeStatement(
        `UPDATE account_lockout_history SET
          status = 'admin_unlocked',
          resolved_at = now(),
          resolved_by = NULLIF($1, '')::uuid,
          resolution_notes = $2
         WHERE user_id = $3::uuid
           AND (tenant_id IS NULL OR tenant_id = NULLIF($4, '')::uuid)
           AND status = 'active'`,
        [
          stringParam('admin', adminId),
          stringParam('notes', notes || `Unlocked by admin ${adminId}`),
          stringParam('user', userId),
          stringParam('tenant', tenantId || ''),
        ]
      );

      logger.info(`Account unlocked: ${userId.substring(0, 8)}...`, { adminId });
      return true;
    } catch (err) {
      logger.error('Failed to unlock account', err as Error);
      return false;
    }
  }

  async getLockedAccounts(tenantId?: string, limit = 50): Promise<Array<{
    userId: string;
    email: string;
    displayName: string;
    lockedAt: string;
    lockedUntil: string | null;
    reason: string;
    isPermanent: boolean;
    lockCount: number;
    lastLockoutId: string | null;
  }>> {
    let query = `SELECT id::text as user_id, email, display_name, account_locked_at::text as locked_at,
                        account_locked_until::text as locked_until, account_locked_reason as reason,
                        account_lock_permanent as is_permanent, account_lock_count as lock_count,
                        last_lockout_id::text as last_lockout_id
                 FROM users WHERE account_locked = true`;
    const params: ReturnType<typeof stringParam>[] = [];
    let idx = 1;

    if (tenantId) {
      query += ` AND tenant_id = $${idx}::uuid`;
      params.push(stringParam('tenant', tenantId));
      idx++;
    }

    query += ` ORDER BY account_locked_at DESC LIMIT $${idx}`;
    params.push(longParam('limit', limit));

    const result = await executeStatement(query, params);
    return (result.rows || []).map(row => ({
      userId: String(row.user_id),
      email: String(row.email || ''),
      displayName: String(row.display_name || ''),
      lockedAt: String(row.locked_at || ''),
      lockedUntil: row.locked_until ? String(row.locked_until) : null,
      reason: String(row.reason || ''),
      isPermanent: Boolean(row.is_permanent),
      lockCount: Number(row.lock_count) || 0,
      lastLockoutId: row.last_lockout_id ? String(row.last_lockout_id) : null,
    }));
  }

  async getLockoutHistory(userId: string, tenantId?: string, limit = 20): Promise<Array<{
    id: string;
    reasonType: string;
    reasonText: string;
    severity: string;
    detectorId: string | null;
    sourceIp: string | null;
    incidentId: string | null;
    offenseNumber: number;
    durationMinutes: number | null;
    lockedAt: string;
    lockedUntil: string | null;
    isPermanent: boolean;
    status: string;
    resolvedAt: string | null;
    resolvedBy: string | null;
    resolutionNotes: string | null;
  }>> {
    const result = await executeStatement(
      `SELECT id::text, reason_type, reason_text, severity::text, detector_id,
              source_ip::text, incident_id::text,
              offense_number, duration_minutes, locked_at::text, locked_until::text,
              is_permanent, status::text, resolved_at::text, resolved_by::text, resolution_notes
       FROM account_lockout_history
       WHERE user_id = $1::uuid AND (tenant_id IS NULL OR tenant_id = NULLIF($2, '')::uuid)
       ORDER BY created_at DESC LIMIT $3`,
      [
        stringParam('user', userId),
        stringParam('tenant', tenantId || ''),
        longParam('limit', limit),
      ]
    );
    return (result.rows || []).map(row => ({
      id: String(row.id),
      reasonType: String(row.reason_type),
      reasonText: String(row.reason_text),
      severity: String(row.severity),
      detectorId: row.detector_id ? String(row.detector_id) : null,
      sourceIp: row.source_ip ? String(row.source_ip) : null,
      incidentId: row.incident_id ? String(row.incident_id) : null,
      offenseNumber: Number(row.offense_number),
      durationMinutes: row.duration_minutes ? Number(row.duration_minutes) : null,
      lockedAt: String(row.locked_at),
      lockedUntil: row.locked_until ? String(row.locked_until) : null,
      isPermanent: Boolean(row.is_permanent),
      status: String(row.status),
      resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
      resolvedBy: row.resolved_by ? String(row.resolved_by) : null,
      resolutionNotes: row.resolution_notes ? String(row.resolution_notes) : null,
    }));
  }

  // --------------------------------------------------------------------------
  // Alert & Escalation
  // --------------------------------------------------------------------------

  private async alertAdmin(request: ThreatResponseRequest): Promise<void> {
    if (!request.tenantId) return;

    const severityMap: Record<IntrusionSeverity, 'info' | 'warning' | 'critical'> = {
      low: 'info',
      medium: 'info',
      high: 'warning',
      critical: 'critical',
    };

    await securityAlertService.sendAlert(request.tenantId, {
      type: `intrusion_${request.detectorId}`,
      severity: severityMap[request.severity],
      title: `[RIDPS] ${request.reason}`,
      message: `Intrusion detected by ${request.detectorId} (confidence: ${(request.confidence * 100).toFixed(0)}%).\nSource IP: ${request.sourceIp}\nSeverity: ${request.severity.toUpperCase()}`,
      metadata: request.details,
    });
  }

  private async escalateSentinel(request: ThreatResponseRequest): Promise<void> {
    // SENTINEL picks up fatal-level security logs
    logger.fatal('SENTINEL ESCALATION: Intrusion response', undefined, {
      responseType: 'intrusion_escalation',
      detector: request.detectorId,
      severity: request.severity,
      confidence: request.confidence,
      sourceIp: request.sourceIp,
      tenantId: request.tenantId,
      userId: request.userId,
      reason: request.reason,
    });
  }

  // --------------------------------------------------------------------------
  // WAF Synchronization (Phase D placeholder — needs CDK IP set)
  // --------------------------------------------------------------------------

  private async syncToWaf(request: ThreatResponseRequest): Promise<void> {
    // This will be implemented in Phase D when CDK creates a WAF IP set
    // For now, log the intent
    logger.info('WAF sync requested (pending Phase D implementation)', {
      ip: request.sourceIp,
      severity: request.severity,
    });
  }

  // --------------------------------------------------------------------------
  // Persistence
  // --------------------------------------------------------------------------

  private async persistResponse(
    request: ThreatResponseRequest,
    result: ThreatResponseResult
  ): Promise<void> {
    try {
      // Update the corresponding intrusion event with the response details
      await executeStatement(
        `UPDATE intrusion_events
         SET response_detail = $1::jsonb
         WHERE id = (
           SELECT id FROM intrusion_events
           WHERE detector_id = $2 AND source_ip = $3::inet
             AND created_at > now() - interval '5 minutes'
           ORDER BY created_at DESC LIMIT 1
         )`,
        [
          stringParam('detail', JSON.stringify({
            responseId: result.responseId,
            actionsExecuted: result.actionsExecuted,
            actionsSkipped: result.actionsSkipped.map(s => s.action),
            errors: result.errors,
          })),
          stringParam('detector', request.detectorId),
          stringParam('ip', request.sourceIp),
        ]
      );
    } catch {
      // Non-critical
    }
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  async getConfig(): Promise<RIDPSConfig> {
    const now = Date.now();
    if (this.config && now - this.configLoadedAt < this.configCacheTtlMs) {
      return this.config;
    }

    try {
      const result = await executeStatement(
        `SELECT * FROM ridps_config LIMIT 1`,
        []
      );

      if (result.rows && result.rows.length > 0) {
        const row = result.rows[0];
        this.config = {
          enabled: Boolean(row.enabled),
          autoBlockEnabled: Boolean(row.auto_block_enabled),
          autoBlockMinSeverity: String(row.auto_block_min_severity) as IntrusionSeverity,
          autoBlockMinConfidence: Number(row.auto_block_min_confidence),
          ipBanDurationMinutes: Number(row.ip_ban_duration_minutes),
          permanentBanThreshold: Number(row.permanent_ban_threshold),
          wafSyncEnabled: Boolean(row.waf_sync_enabled),
          sentinelEscalationEnabled: Boolean(row.sentinel_escalation_enabled),
          baselineLearningDays: Number(row.baseline_learning_days),
          eventRetentionDays: Number(row.event_retention_days),
        };
      } else {
        this.config = this.getDefaultConfig();
      }

      this.configLoadedAt = now;
    } catch (err) {
      logger.error('Failed to load RIDPS config', err as Error);
      if (!this.config) {
        this.config = this.getDefaultConfig();
      }
    }

    return this.config;
  }

  async updateConfig(updates: Partial<RIDPSConfig>): Promise<void> {
    const setClauses: string[] = [];
    const params: ReturnType<typeof stringParam>[] = [];
    let idx = 1;

    const fieldMap: Record<string, string> = {
      enabled: 'enabled',
      autoBlockEnabled: 'auto_block_enabled',
      autoBlockMinSeverity: 'auto_block_min_severity',
      autoBlockMinConfidence: 'auto_block_min_confidence',
      ipBanDurationMinutes: 'ip_ban_duration_minutes',
      permanentBanThreshold: 'permanent_ban_threshold',
      wafSyncEnabled: 'waf_sync_enabled',
      sentinelEscalationEnabled: 'sentinel_escalation_enabled',
      baselineLearningDays: 'baseline_learning_days',
      eventRetentionDays: 'event_retention_days',
    };

    for (const [key, dbCol] of Object.entries(fieldMap)) {
      if (key in updates) {
        setClauses.push(`${dbCol} = $${idx}`);
        params.push(stringParam(key, String((updates as Record<string, unknown>)[key])));
        idx++;
      }
    }

    if (setClauses.length === 0) return;

    setClauses.push('updated_at = now()');

    await executeStatement(
      `UPDATE ridps_config SET ${setClauses.join(', ')}`,
      params
    );

    // Invalidate cache
    this.config = null;
    this.configLoadedAt = 0;
  }

  private getDefaultConfig(): RIDPSConfig {
    return {
      enabled: true,
      autoBlockEnabled: false,
      autoBlockMinSeverity: 'high',
      autoBlockMinConfidence: 0.8,
      ipBanDurationMinutes: 60,
      permanentBanThreshold: 5,
      wafSyncEnabled: false,
      sentinelEscalationEnabled: true,
      baselineLearningDays: 14,
      eventRetentionDays: 90,
    };
  }

  // --------------------------------------------------------------------------
  // Incident Management (for admin dashboard)
  // --------------------------------------------------------------------------

  async getRecentEvents(
    options: { tenantId?: string; severity?: IntrusionSeverity; detectorId?: string; limit?: number; since?: Date }
  ): Promise<Array<{
    id: string;
    detectorId: string;
    mitreTechnique?: string;
    severity: IntrusionSeverity;
    confidence: number;
    sourceIp: string;
    userId?: string;
    requestPath?: string;
    details: Record<string, unknown>;
    responseAction: string;
    createdAt: Date;
  }>> {
    let query = `SELECT * FROM intrusion_events WHERE 1=1`;
    const params: ReturnType<typeof stringParam>[] = [];
    let idx = 1;

    if (options.tenantId) {
      query += ` AND tenant_id = $${idx}::uuid`;
      params.push(stringParam('tenant', options.tenantId));
      idx++;
    }
    if (options.severity) {
      query += ` AND severity = $${idx}::intrusion_severity`;
      params.push(stringParam('severity', options.severity));
      idx++;
    }
    if (options.detectorId) {
      query += ` AND detector_id = $${idx}`;
      params.push(stringParam('detector', options.detectorId));
      idx++;
    }
    if (options.since) {
      query += ` AND created_at >= $${idx}`;
      params.push(stringParam('since', options.since.toISOString()));
      idx++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${idx}`;
    params.push(longParam('limit', options.limit || 100));

    const result = await executeStatement(query, params);

    return (result.rows || []).map(row => ({
      id: String(row.id),
      detectorId: String(row.detector_id),
      mitreTechnique: row.mitre_technique ? String(row.mitre_technique) : undefined,
      severity: String(row.severity) as IntrusionSeverity,
      confidence: Number(row.confidence),
      sourceIp: String(row.source_ip),
      userId: row.user_id ? String(row.user_id) : undefined,
      requestPath: row.request_path ? String(row.request_path) : undefined,
      details: (row.details as Record<string, unknown>) || {},
      responseAction: String(row.response_action),
      createdAt: new Date(row.created_at as string),
    }));
  }

  async getIncidents(
    options: { tenantId?: string; status?: string; limit?: number }
  ): Promise<Array<{
    id: string;
    title: string;
    severity: IntrusionSeverity;
    status: string;
    mitreTechniques: string[];
    eventCount: number;
    firstEventAt: Date;
    lastEventAt: Date;
    sourceIps: string[];
    createdAt: Date;
  }>> {
    let query = `SELECT * FROM intrusion_incidents WHERE 1=1`;
    const params: ReturnType<typeof stringParam>[] = [];
    let idx = 1;

    if (options.tenantId) {
      query += ` AND tenant_id = $${idx}::uuid`;
      params.push(stringParam('tenant', options.tenantId));
      idx++;
    }
    if (options.status) {
      query += ` AND status = $${idx}::intrusion_status`;
      params.push(stringParam('status', options.status));
      idx++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${idx}`;
    params.push(longParam('limit', options.limit || 50));

    const result = await executeStatement(query, params);

    return (result.rows || []).map(row => ({
      id: String(row.id),
      title: String(row.title),
      severity: String(row.severity) as IntrusionSeverity,
      status: String(row.status),
      mitreTechniques: (row.mitre_techniques as string[]) || [],
      eventCount: Number(row.event_count),
      firstEventAt: new Date(row.first_event_at as string),
      lastEventAt: new Date(row.last_event_at as string),
      sourceIps: ((row.source_ips as string[]) || []).map(String),
      createdAt: new Date(row.created_at as string),
    }));
  }

  /** Get summary stats for the admin dashboard */
  async getDashboardStats(tenantId?: string): Promise<{
    totalEvents24h: number;
    criticalEvents24h: number;
    blockedIps: number;
    activeIncidents: number;
    topDetectors: Array<{ detectorId: string; count: number }>;
    topSourceIps: Array<{ ip: string; count: number }>;
  }> {
    const tenantFilter = tenantId ? `AND tenant_id = '${tenantId}'` : '';

    try {
      const [eventsResult, blockedResult, incidentsResult, detectorsResult, ipsResult] = await Promise.all([
        executeStatement(
          `SELECT COUNT(*) as total,
                  COUNT(*) FILTER (WHERE severity = 'critical') as critical
           FROM intrusion_events WHERE created_at > now() - interval '24 hours' ${tenantFilter}`,
          []
        ),
        executeStatement(
          `SELECT COUNT(*) as cnt FROM ip_blocklist WHERE is_permanent OR expires_at > now()`,
          []
        ),
        executeStatement(
          `SELECT COUNT(*) as cnt FROM intrusion_incidents WHERE status IN ('open', 'investigating') ${tenantFilter}`,
          []
        ),
        executeStatement(
          `SELECT detector_id, COUNT(*) as cnt FROM intrusion_events
           WHERE created_at > now() - interval '24 hours' ${tenantFilter}
           GROUP BY detector_id ORDER BY cnt DESC LIMIT 5`,
          []
        ),
        executeStatement(
          `SELECT source_ip::text as ip, COUNT(*) as cnt FROM intrusion_events
           WHERE created_at > now() - interval '24 hours' ${tenantFilter}
           GROUP BY source_ip ORDER BY cnt DESC LIMIT 5`,
          []
        ),
      ]);

      return {
        totalEvents24h: Number(eventsResult.rows?.[0]?.total) || 0,
        criticalEvents24h: Number(eventsResult.rows?.[0]?.critical) || 0,
        blockedIps: Number(blockedResult.rows?.[0]?.cnt) || 0,
        activeIncidents: Number(incidentsResult.rows?.[0]?.cnt) || 0,
        topDetectors: (detectorsResult.rows || []).map(r => ({
          detectorId: String(r.detector_id),
          count: Number(r.cnt),
        })),
        topSourceIps: (ipsResult.rows || []).map(r => ({
          ip: String(r.ip),
          count: Number(r.cnt),
        })),
      };
    } catch (err) {
      logger.error('Failed to get dashboard stats', err as Error);
      return {
        totalEvents24h: 0,
        criticalEvents24h: 0,
        blockedIps: 0,
        activeIncidents: 0,
        topDetectors: [],
        topSourceIps: [],
      };
    }
  }
}

// ============================================================================
// Singleton
// ============================================================================

export const threatResponseService = new ThreatResponseService();
