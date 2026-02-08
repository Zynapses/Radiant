/**
 * RADIANT v4.18.0 — Real-Time Intrusion Detection & Prevention System (RIDPS)
 *
 * Core detection engine that:
 *  1. Ingests security-relevant events from API middleware
 *  2. Maintains in-memory sliding windows per source IP / user / tenant
 *  3. Dispatches events to registered detectors
 *  4. Correlates signals into incidents
 *  5. Triggers automated response actions
 *
 * Standards:
 *  - NIST SP 800-94: IDPS architecture (signature + anomaly + stateful analysis)
 *  - NIST CSF 2.0: DE.CM (continuous monitoring), DE.AE (adverse event analysis)
 *  - MITRE ATT&CK Cloud: technique-mapped detectors
 *  - OWASP ASVS 4.0: V7 (logging), V11 (business logic)
 *  - CIS Controls v8: 8 (audit log), 13 (network monitoring)
 *  - SOC 2 CC7.2/CC7.3: system monitoring & anomaly detection
 *  - ISO 27001 A.8.15/A.8.16: logging & monitoring activities
 */

import { executeStatement, stringParam, longParam, doubleParam, boolParam } from '../db/client';
import { createRegisteredLogger } from './logging-registry.service';
import { securityAlertService, SecurityAlert } from './security-alert.service';
import { securityProtectionService } from './security-protection.service';
import { logAudit } from './audit';
import * as crypto from 'crypto';

const logger = createRegisteredLogger({
  serviceName: 'security/intrusion-detection',
  category: 'security',
  sourceType: 'application',
});

// ============================================================================
// Types
// ============================================================================

export type IntrusionSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ResponseAction =
  | 'log_only' | 'rate_limit' | 'challenge' | 'block_request'
  | 'ban_ip' | 'kill_session' | 'lock_account' | 'alert_admin'
  | 'escalate_sentinel' | 'waf_block';

/** Raw request metadata fed by the middleware */
export interface RequestSignal {
  requestId: string;
  timestamp: Date;
  sourceIp: string;
  method: string;
  path: string;
  statusCode?: number;
  userAgent?: string;
  tenantId?: string;
  userId?: string;
  sessionId?: string;
  authSuccess?: boolean;
  authMethod?: string;
  responseBytes?: number;
  durationMs?: number;
  errorCode?: string;
  body?: string;
  headers?: Record<string, string>;
  geoCountry?: string;
  geoCity?: string;
  geoLat?: number;
  geoLon?: number;
}

/** Output from a detector */
export interface DetectionResult {
  detected: boolean;
  detectorId: string;
  mitreTechnique?: string;
  severity: IntrusionSeverity;
  confidence: number;
  title: string;
  message: string;
  details: Record<string, unknown>;
  recommendedActions: ResponseAction[];
}

/** Detector interface — all detectors implement this */
export interface ThreatDetector {
  id: string;
  mitreTechnique?: string;
  standardRefs: string[];
  analyze(signal: RequestSignal, windows: SlidingWindowStore): DetectionResult | null;
}

/** Detection rule from database */
export interface DetectionRule {
  detectorId: string;
  enabled: boolean;
  severityOverride?: IntrusionSeverity;
  thresholdConfig: Record<string, unknown>;
  responseActions: ResponseAction[];
  cooldownSeconds: number;
  mitreTechnique?: string;
  standardRefs: string[];
}

/** Persisted intrusion event */
export interface IntrusionEvent {
  id: string;
  tenantId?: string;
  detectorId: string;
  mitreTechnique?: string;
  severity: IntrusionSeverity;
  confidence: number;
  sourceIp?: string;
  userId?: string;
  sessionId?: string;
  requestPath?: string;
  requestMethod?: string;
  userAgent?: string;
  geoCountry?: string;
  geoCity?: string;
  details: Record<string, unknown>;
  responseAction: ResponseAction;
  responseDetail: Record<string, unknown>;
  correlatedIncidentId?: string;
  createdAt: Date;
}

// ============================================================================
// Sliding Window Store — in-memory per Lambda instance
// (NIST 800-94 §4.1: stateful protocol analysis)
// ============================================================================

interface WindowEntry {
  timestamp: number;
  data: Record<string, unknown>;
}

export class SlidingWindowStore {
  private windows: Map<string, WindowEntry[]> = new Map();
  private maxWindowSize = 10000;
  private cleanupInterval: number;
  private lastCleanup = 0;

  constructor(cleanupIntervalMs = 30000) {
    this.cleanupInterval = cleanupIntervalMs;
  }

  /** Add an entry to a named window */
  push(windowKey: string, data: Record<string, unknown>): void {
    if (!this.windows.has(windowKey)) {
      this.windows.set(windowKey, []);
    }
    const entries = this.windows.get(windowKey)!;
    entries.push({ timestamp: Date.now(), data });

    // Cap size
    if (entries.length > this.maxWindowSize) {
      entries.splice(0, entries.length - this.maxWindowSize);
    }

    this.maybeCleanup();
  }

  /** Get entries in a time window (ms) */
  getWindow(windowKey: string, windowMs: number): WindowEntry[] {
    const entries = this.windows.get(windowKey);
    if (!entries) return [];
    const cutoff = Date.now() - windowMs;
    return entries.filter(e => e.timestamp >= cutoff);
  }

  /** Count entries in a time window */
  countInWindow(windowKey: string, windowMs: number): number {
    return this.getWindow(windowKey, windowMs).length;
  }

  /** Count entries matching a predicate in a time window */
  countMatching(
    windowKey: string,
    windowMs: number,
    predicate: (data: Record<string, unknown>) => boolean
  ): number {
    return this.getWindow(windowKey, windowMs).filter(e => predicate(e.data)).length;
  }

  /** Get unique values for a field in a time window */
  uniqueValues(windowKey: string, windowMs: number, field: string): Set<unknown> {
    const entries = this.getWindow(windowKey, windowMs);
    return new Set(entries.map(e => e.data[field]).filter(v => v !== undefined));
  }

  /** Get the last entry for a window key */
  getLast(windowKey: string): WindowEntry | undefined {
    const entries = this.windows.get(windowKey);
    if (!entries || entries.length === 0) return undefined;
    return entries[entries.length - 1];
  }

  /** Periodic cleanup of expired entries */
  private maybeCleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanup < this.cleanupInterval) return;
    this.lastCleanup = now;

    const maxAge = 15 * 60 * 1000; // 15 minutes max retention
    for (const [key, entries] of this.windows) {
      const cutoff = now - maxAge;
      const filtered = entries.filter(e => e.timestamp >= cutoff);
      if (filtered.length === 0) {
        this.windows.delete(key);
      } else {
        this.windows.set(key, filtered);
      }
    }
  }

  /** Get stats for monitoring */
  getStats(): { windowCount: number; totalEntries: number } {
    let totalEntries = 0;
    for (const entries of this.windows.values()) {
      totalEntries += entries.length;
    }
    return { windowCount: this.windows.size, totalEntries };
  }
}

// ============================================================================
// Cooldown Tracker — prevents alert storms
// ============================================================================

class CooldownTracker {
  private cooldowns: Map<string, number> = new Map();

  isInCooldown(key: string, cooldownMs: number): boolean {
    const lastFired = this.cooldowns.get(key);
    if (!lastFired) return false;
    return Date.now() - lastFired < cooldownMs;
  }

  markFired(key: string): void {
    this.cooldowns.set(key, Date.now());
  }

  cleanup(): void {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 min max
    for (const [key, time] of this.cooldowns) {
      if (now - time > maxAge) {
        this.cooldowns.delete(key);
      }
    }
  }
}

// ============================================================================
// Threat Detection Engine
// ============================================================================

export class ThreatDetectionEngine {
  private detectors: Map<string, ThreatDetector> = new Map();
  private windows: SlidingWindowStore = new SlidingWindowStore();
  private cooldowns: CooldownTracker = new CooldownTracker();
  private rules: Map<string, DetectionRule> = new Map();
  private rulesLoadedAt = 0;
  private rulesCacheTtlMs = 60000; // Reload rules every 60s
  private enabled = true;

  // Metrics counters (per Lambda instance)
  private metrics = {
    signalsProcessed: 0,
    detectionsTriggered: 0,
    ipsBanned: 0,
    sessionsKilled: 0,
    alertsSent: 0,
  };

  /** Register a detector */
  registerDetector(detector: ThreatDetector): void {
    this.detectors.set(detector.id, detector);
    logger.info(`Registered intrusion detector: ${detector.id}`, {
      mitre: detector.mitreTechnique,
      standards: detector.standardRefs,
    });
  }

  /** Process an incoming request signal — called from middleware */
  async processSignal(signal: RequestSignal): Promise<DetectionResult[]> {
    if (!this.enabled) return [];
    this.metrics.signalsProcessed++;

    // Populate sliding windows with signal data
    this.populateWindows(signal);

    // Ensure rules are loaded
    await this.ensureRulesLoaded();

    // Check IP blocklist first
    const blocked = await this.isIpBlocked(signal.sourceIp, signal.tenantId);
    if (blocked) {
      logger.warn('Request from blocked IP', {
        ip: signal.sourceIp,
        reason: blocked.reason,
      });
      // Record the hit
      this.recordBlocklistHit(signal.sourceIp, signal.tenantId);
      return [{
        detected: true,
        detectorId: 'ip_blocklist',
        severity: blocked.severity as IntrusionSeverity || 'high',
        confidence: 1.0,
        title: 'Blocked IP',
        message: `Request from blocked IP: ${blocked.reason}`,
        details: { ip: signal.sourceIp, reason: blocked.reason },
        recommendedActions: ['block_request'],
      }];
    }

    // Run all enabled detectors
    const results: DetectionResult[] = [];

    for (const [detectorId, detector] of this.detectors) {
      try {
        const rule = this.rules.get(detectorId) || this.getDefaultRule(detectorId);
        if (!rule.enabled) continue;

        const result = detector.analyze(signal, this.windows);
        if (!result || !result.detected) continue;

        // Apply rule overrides
        if (rule.severityOverride) {
          result.severity = rule.severityOverride;
        }
        result.recommendedActions = rule.responseActions;

        // Check cooldown
        const cooldownKey = `${detectorId}:${signal.sourceIp}:${signal.tenantId || 'global'}`;
        if (this.cooldowns.isInCooldown(cooldownKey, rule.cooldownSeconds * 1000)) {
          continue;
        }
        this.cooldowns.markFired(cooldownKey);

        this.metrics.detectionsTriggered++;
        results.push(result);

        // Persist event
        await this.persistEvent(signal, result);

        // Log detection
        logger.warn(`Intrusion detected: ${result.detectorId}`, {
          severity: result.severity,
          confidence: result.confidence,
          mitre: result.mitreTechnique,
          ip: signal.sourceIp,
          tenant: signal.tenantId,
          user: signal.userId,
          title: result.title,
        });

      } catch (err) {
        logger.error(`Detector ${detectorId} failed`, err as Error, {
          signal: { ip: signal.sourceIp, path: signal.path },
        });
      }
    }

    // Execute response actions for all detections
    if (results.length > 0) {
      await this.executeResponses(signal, results);
    }

    return results;
  }

  // --------------------------------------------------------------------------
  // Window Population
  // --------------------------------------------------------------------------

  private populateWindows(signal: RequestSignal): void {
    const ip = signal.sourceIp;
    const tenant = signal.tenantId || 'unknown';
    const user = signal.userId || 'anonymous';

    // Per-IP windows
    this.windows.push(`ip:${ip}:requests`, {
      method: signal.method,
      path: signal.path,
      statusCode: signal.statusCode,
      userId: signal.userId,
      tenantId: signal.tenantId,
      authSuccess: signal.authSuccess,
      responseBytes: signal.responseBytes,
    });

    // Auth failure tracking
    if (signal.authSuccess === false) {
      this.windows.push(`ip:${ip}:auth_failures`, {
        userId: signal.userId,
        method: signal.authMethod,
        path: signal.path,
      });
      this.windows.push(`tenant:${tenant}:auth_failures`, {
        ip,
        userId: signal.userId,
      });
    }

    // Auth success tracking (for session/geo analysis)
    if (signal.authSuccess === true && signal.userId) {
      this.windows.push(`user:${user}:auth_success`, {
        ip,
        geoCountry: signal.geoCountry,
        geoCity: signal.geoCity,
        geoLat: signal.geoLat,
        geoLon: signal.geoLon,
        userAgent: signal.userAgent,
        sessionId: signal.sessionId,
      });
    }

    // Per-user request tracking
    if (signal.userId) {
      this.windows.push(`user:${user}:requests`, {
        ip,
        method: signal.method,
        path: signal.path,
        statusCode: signal.statusCode,
        responseBytes: signal.responseBytes,
      });
    }

    // Error tracking per IP
    if (signal.statusCode && signal.statusCode >= 400) {
      this.windows.push(`ip:${ip}:errors`, {
        statusCode: signal.statusCode,
        path: signal.path,
        errorCode: signal.errorCode,
      });
    }

    // Per-tenant request tracking
    this.windows.push(`tenant:${tenant}:requests`, {
      ip,
      userId: signal.userId,
      method: signal.method,
      path: signal.path,
      statusCode: signal.statusCode,
    });
  }

  // --------------------------------------------------------------------------
  // Rule Management
  // --------------------------------------------------------------------------

  private async ensureRulesLoaded(): Promise<void> {
    const now = Date.now();
    if (now - this.rulesLoadedAt < this.rulesCacheTtlMs && this.rules.size > 0) return;

    try {
      const result = await executeStatement(
        `SELECT detector_id, enabled, severity_override, threshold_config, response_actions,
                cooldown_seconds, mitre_technique, standard_refs
         FROM detection_rules
         WHERE tenant_id IS NULL AND enabled = true
         ORDER BY detector_id`,
        []
      );

      this.rules.clear();
      for (const row of (result.rows || [])) {
        this.rules.set(String(row.detector_id), {
          detectorId: String(row.detector_id),
          enabled: Boolean(row.enabled),
          severityOverride: row.severity_override ? String(row.severity_override) as IntrusionSeverity : undefined,
          thresholdConfig: (row.threshold_config as Record<string, unknown>) || {},
          responseActions: (row.response_actions as ResponseAction[]) || ['log_only'],
          cooldownSeconds: Number(row.cooldown_seconds) || 300,
          mitreTechnique: row.mitre_technique ? String(row.mitre_technique) : undefined,
          standardRefs: (row.standard_refs as string[]) || [],
        });
      }

      this.rulesLoadedAt = now;
      logger.debug(`Loaded ${this.rules.size} detection rules`);
    } catch (err) {
      logger.error('Failed to load detection rules', err as Error);
      // Keep stale rules rather than running with none
    }
  }

  private getDefaultRule(detectorId: string): DetectionRule {
    return {
      detectorId,
      enabled: true,
      thresholdConfig: {},
      responseActions: ['log_only'],
      cooldownSeconds: 300,
      standardRefs: [],
    };
  }

  /** Get threshold config for a detector (used by detectors to read tunable params) */
  getThresholdConfig(detectorId: string): Record<string, unknown> {
    return this.rules.get(detectorId)?.thresholdConfig || {};
  }

  // --------------------------------------------------------------------------
  // IP Blocklist
  // --------------------------------------------------------------------------

  private async isIpBlocked(ip: string, tenantId?: string): Promise<{ reason: string; severity: string } | null> {
    try {
      const result = await executeStatement(
        `SELECT reason, severity FROM ip_blocklist
         WHERE ip_address = $1::inet
           AND (tenant_id IS NULL OR tenant_id = $2::uuid)
           AND (is_permanent OR expires_at > now())
         LIMIT 1`,
        [
          stringParam('ip', ip),
          stringParam('tenantId', tenantId || '00000000-0000-0000-0000-000000000000'),
        ]
      );

      if (result.rows && result.rows.length > 0) {
        return {
          reason: String(result.rows[0].reason),
          severity: String(result.rows[0].severity),
        };
      }
      return null;
    } catch (err) {
      logger.error('IP blocklist check failed', err as Error);
      return null; // Fail open to avoid blocking legitimate traffic
    }
  }

  private async recordBlocklistHit(ip: string, tenantId?: string): Promise<void> {
    try {
      await executeStatement(
        `UPDATE ip_blocklist SET hit_count = hit_count + 1, last_hit_at = now()
         WHERE ip_address = $1::inet AND (tenant_id IS NULL OR tenant_id = $2::uuid)
           AND (is_permanent OR expires_at > now())`,
        [
          stringParam('ip', ip),
          stringParam('tenantId', tenantId || '00000000-0000-0000-0000-000000000000'),
        ]
      );
    } catch {
      // Non-critical — don't fail the request
    }
  }

  // --------------------------------------------------------------------------
  // Event Persistence
  // --------------------------------------------------------------------------

  private async persistEvent(signal: RequestSignal, result: DetectionResult): Promise<string> {
    const eventId = crypto.randomUUID();
    try {
      await executeStatement(
        `INSERT INTO intrusion_events (
          id, tenant_id, detector_id, mitre_technique, severity, confidence,
          source_ip, user_id, session_id, request_path, request_method,
          user_agent, geo_country, geo_city, geo_lat, geo_lon,
          details, response_action, response_detail
        ) VALUES (
          $1::uuid, NULLIF($2, '')::uuid, $3, NULLIF($4, ''), $5::intrusion_severity, $6,
          $7::inet, NULLIF($8, '')::uuid, NULLIF($9, ''), $10, $11,
          NULLIF($12, ''), NULLIF($13, ''), NULLIF($14, ''), $15, $16,
          $17::jsonb, $18::response_action, $19::jsonb
        )`,
        [
          stringParam('id', eventId),
          stringParam('tenantId', signal.tenantId || ''),
          stringParam('detectorId', result.detectorId),
          stringParam('mitre', result.mitreTechnique || ''),
          stringParam('severity', result.severity),
          doubleParam('confidence', result.confidence),
          stringParam('sourceIp', signal.sourceIp),
          stringParam('userId', signal.userId || ''),
          stringParam('sessionId', signal.sessionId || ''),
          stringParam('path', signal.path),
          stringParam('method', signal.method),
          stringParam('ua', signal.userAgent || ''),
          stringParam('country', signal.geoCountry || ''),
          stringParam('city', signal.geoCity || ''),
          doubleParam('lat', signal.geoLat || 0),
          doubleParam('lon', signal.geoLon || 0),
          stringParam('details', JSON.stringify(result.details)),
          stringParam('responseAction', result.recommendedActions[0] || 'log_only'),
          stringParam('responseDetail', JSON.stringify({})),
        ]
      );
    } catch (err) {
      logger.error('Failed to persist intrusion event', err as Error);
    }
    return eventId;
  }

  // --------------------------------------------------------------------------
  // Response Execution
  // --------------------------------------------------------------------------

  private async executeResponses(signal: RequestSignal, results: DetectionResult[]): Promise<void> {
    // Collect all unique actions
    const actions = new Set<ResponseAction>();
    let maxSeverity: IntrusionSeverity = 'low';
    const severityOrder: IntrusionSeverity[] = ['low', 'medium', 'high', 'critical'];

    for (const r of results) {
      for (const a of r.recommendedActions) {
        actions.add(a);
      }
      if (severityOrder.indexOf(r.severity) > severityOrder.indexOf(maxSeverity)) {
        maxSeverity = r.severity;
      }
    }

    // Feed detection into security events log for audit hotspot analysis
    this.logToSecurityEvents(signal, results, maxSeverity).catch(() => {});

    // Feed detection into audit trail
    if (signal.tenantId) {
      logAudit(
        { tenantId: signal.tenantId, userId: signal.userId, ipAddress: signal.sourceIp },
        'intrusion_detected',
        'intrusion_event',
        {
          description: `Intrusion detected: ${results.map(r => r.detectorId).join(', ')}`,
          metadata: {
            detectors: results.map(r => r.detectorId),
            severity: maxSeverity,
            sourceIp: signal.sourceIp,
            mitreTechniques: results.map(r => r.mitreTechnique).filter(Boolean),
          },
          severity: maxSeverity === 'critical' ? 'critical' : maxSeverity === 'high' ? 'warning' : 'info',
        }
      ).catch(() => {});
    }

    // Execute each action type
    for (const action of actions) {
      try {
        switch (action) {
          case 'ban_ip':
            await this.banIp(signal, results, maxSeverity);
            break;
          case 'alert_admin':
            await this.alertAdmin(signal, results, maxSeverity);
            break;
          case 'escalate_sentinel':
            await this.escalateSentinel(signal, results, maxSeverity);
            break;
          case 'log_only':
            // Already logged
            break;
          // rate_limit, challenge, block_request, kill_session, lock_account
          // are handled by the middleware based on the returned DetectionResult
          default:
            break;
        }
      } catch (err) {
        logger.error(`Response action ${action} failed`, err as Error);
      }
    }
  }

  private async banIp(
    signal: RequestSignal,
    results: DetectionResult[],
    severity: IntrusionSeverity
  ): Promise<void> {
    const reasons = results.map(r => r.title).join('; ');
    const durationMinutes = severity === 'critical' ? 1440 : 60; // 24h for critical, 1h otherwise

    try {
      await executeStatement(
        `INSERT INTO ip_blocklist (ip_address, reason, detector_id, severity, source, tenant_id, expires_at)
         VALUES ($1::inet, $2, $3, $4::intrusion_severity, 'auto', NULLIF($5, '')::uuid,
                 now() + ($6 || ' minutes')::interval)
         ON CONFLICT (ip_address, tenant_id) DO UPDATE SET
           reason = EXCLUDED.reason,
           severity = EXCLUDED.severity,
           expires_at = GREATEST(ip_blocklist.expires_at, EXCLUDED.expires_at)`,
        [
          stringParam('ip', signal.sourceIp),
          stringParam('reason', reasons),
          stringParam('detector', results[0].detectorId),
          stringParam('severity', severity),
          stringParam('tenant', signal.tenantId || ''),
          stringParam('duration', String(durationMinutes)),
        ]
      );
      this.metrics.ipsBanned++;
      logger.warn(`IP banned: ${signal.sourceIp}`, { duration: durationMinutes, reasons });
    } catch (err) {
      logger.error('Failed to ban IP', err as Error);
    }
  }

  private async alertAdmin(
    signal: RequestSignal,
    results: DetectionResult[],
    severity: IntrusionSeverity
  ): Promise<void> {
    if (!signal.tenantId) return;

    const alertSeverity = severity === 'critical' ? 'critical' :
                          severity === 'high' ? 'warning' : 'info';

    const alert: SecurityAlert = {
      type: 'intrusion_detection',
      severity: alertSeverity as 'info' | 'warning' | 'critical',
      title: `Intrusion Detected: ${results.map(r => r.title).join(', ')}`,
      message: results.map(r => `[${r.severity.toUpperCase()}] ${r.message}`).join('\n'),
      metadata: {
        sourceIp: signal.sourceIp,
        userId: signal.userId,
        detectors: results.map(r => ({
          id: r.detectorId,
          mitre: r.mitreTechnique,
          confidence: r.confidence,
        })),
        requestPath: signal.path,
        requestMethod: signal.method,
      },
    };

    try {
      await securityAlertService.sendAlert(signal.tenantId, alert);
      this.metrics.alertsSent++;
    } catch (err) {
      logger.error('Failed to send intrusion alert', err as Error);
    }
  }

  private async escalateSentinel(
    signal: RequestSignal,
    results: DetectionResult[],
    severity: IntrusionSeverity
  ): Promise<void> {
    // Log for SENTINEL pickup — the notifier service polls for critical security events
    logger.fatal('SENTINEL ESCALATION: Intrusion detected', undefined, {
      severity,
      detectors: results.map(r => r.detectorId),
      mitreTechniques: results.map(r => r.mitreTechnique).filter(Boolean),
      sourceIp: signal.sourceIp,
      tenantId: signal.tenantId,
      userId: signal.userId,
    });
  }

  // --------------------------------------------------------------------------
  // Security Events Log Integration (for audit hotspot analysis)
  // --------------------------------------------------------------------------

  private async logToSecurityEvents(
    signal: RequestSignal,
    results: DetectionResult[],
    maxSeverity: IntrusionSeverity,
  ): Promise<void> {
    if (!signal.tenantId) return;

    const severityMap: Record<IntrusionSeverity, 'info' | 'warning' | 'critical'> = {
      low: 'info',
      medium: 'info',
      high: 'warning',
      critical: 'critical',
    };

    try {
      await securityProtectionService.logSecurityEvent(signal.tenantId, {
        eventType: 'intrusion_detection',
        severity: severityMap[maxSeverity],
        eventSource: `ridps:${results.map(r => r.detectorId).join(',')}`,
        requestId: signal.requestId,
        details: {
          detectors: results.map(r => ({
            id: r.detectorId,
            mitre: r.mitreTechnique,
            severity: r.severity,
            confidence: r.confidence,
          })),
          sourceIp: signal.sourceIp,
          path: signal.path,
          method: signal.method,
          responseActions: results.flatMap(r => r.recommendedActions),
        },
        actionTaken: results.flatMap(r => r.recommendedActions).join(', ') || 'log_only',
      }, signal.userId);
    } catch {
      // Non-critical — don't fail the detection pipeline
    }
  }

  // --------------------------------------------------------------------------
  // Public API for Admin Dashboard / Deployer
  // --------------------------------------------------------------------------

  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  getWindowStats(): ReturnType<SlidingWindowStore['getStats']> {
    return this.windows.getStats();
  }

  getRegisteredDetectors(): Array<{ id: string; mitre?: string; standards: string[] }> {
    return Array.from(this.detectors.values()).map(d => ({
      id: d.id,
      mitre: d.mitreTechnique,
      standards: d.standardRefs,
    }));
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    logger.info(`RIDPS ${enabled ? 'enabled' : 'disabled'}`);
  }

  /** Force-reload rules from DB */
  async reloadRules(): Promise<void> {
    this.rulesLoadedAt = 0;
    await this.ensureRulesLoaded();
  }
}

// ============================================================================
// Singleton
// ============================================================================

export const threatDetectionEngine = new ThreatDetectionEngine();
