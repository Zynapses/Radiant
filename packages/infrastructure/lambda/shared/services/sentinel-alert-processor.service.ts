/**
 * RADIANT SENTINEL v1.0.0 — Alert Processor
 *
 * Receives raw alerts from the watchdog and:
 *   1. Scores severity using the multi-factor matrix
 *   2. Deduplicates by deduplicationKey (increment occurrenceCount)
 *   3. Correlates related alerts into a single incident
 *   4. Persists to DynamoDB (active) and Aurora (history)
 *   5. Dispatches to the notification pipeline
 */

import { Pool } from 'pg';
import {
  SentinelAlert,
  SentinelAlertCategory,
  SentinelAlertStatus,
  SentinelIncident,
  SentinelIncidentStatus,
  SentinelSeverity,
  SentinelComplianceContext,
  SeverityScoringFactors,
  SEVERITY_FACTOR_WEIGHTS,
} from '@radiant/shared/types/sentinel.types';
import { createRegisteredLogger } from './logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'sentinel/alert-processor',
  category: 'security',
  sourceType: 'application',
});

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface AlertProcessorConfig {
  deduplicationWindowMs: number;   // default 300_000 (5 min)
  correlationWindowMs: number;     // default 300_000 (5 min)
  autoIncidentSeverityThreshold: SentinelSeverity; // SEV ≤ this auto-creates incident
}

const DEFAULT_CONFIG: AlertProcessorConfig = {
  deduplicationWindowMs: 300_000,
  correlationWindowMs: 300_000,
  autoIncidentSeverityThreshold: 2,
};

// ---------------------------------------------------------------------------
// In-Memory Alert Store (DynamoDB in production)
// ---------------------------------------------------------------------------

interface ActiveAlertEntry {
  alert: SentinelAlert;
  lastUpdated: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class SentinelAlertProcessorService {
  private pool: Pool;
  private config: AlertProcessorConfig;
  private activeAlerts: Map<string, ActiveAlertEntry> = new Map();
  private activeIncidents: Map<string, SentinelIncident> = new Map();

  constructor(pool: Pool, config?: Partial<AlertProcessorConfig>) {
    this.pool = pool;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // =========================================================================
  // Main Entry Point: Process a batch of raw alerts
  // =========================================================================

  async processAlerts(rawAlerts: SentinelAlert[]): Promise<{
    newAlerts: SentinelAlert[];
    deduplicated: SentinelAlert[];
    incidents: SentinelIncident[];
  }> {
    const newAlerts: SentinelAlert[] = [];
    const deduplicated: SentinelAlert[] = [];
    const incidentCandidates: SentinelAlert[] = [];

    for (const raw of rawAlerts) {
      const scored = this.scoreSeverity(raw);
      const enriched = this.enrichComplianceContext(scored);

      const existing = this.activeAlerts.get(enriched.deduplicationKey);
      if (existing && (Date.now() - existing.lastUpdated) < this.config.deduplicationWindowMs) {
        existing.alert.occurrenceCount += 1;
        existing.alert.lastOccurrenceAt = enriched.lastOccurrenceAt;
        existing.lastUpdated = Date.now();

        if (existing.alert.occurrenceCount >= 3 && existing.alert.severity > 2) {
          existing.alert.severity = Math.max(1, existing.alert.severity - 1) as SentinelSeverity;
        }
        deduplicated.push(existing.alert);
      } else {
        this.activeAlerts.set(enriched.deduplicationKey, {
          alert: enriched,
          lastUpdated: Date.now(),
        });
        newAlerts.push(enriched);
      }

      if (enriched.severity <= this.config.autoIncidentSeverityThreshold) {
        incidentCandidates.push(enriched);
      }
    }

    const incidents = this.correlateIntoIncidents(incidentCandidates);

    await this.persistAlerts(newAlerts);
    await this.persistIncidents(incidents);

    this.pruneStaleAlerts();

    return { newAlerts, deduplicated, incidents };
  }

  // =========================================================================
  // Severity Scoring
  // =========================================================================

  scoreSeverity(alert: SentinelAlert): SentinelAlert {
    const factors = this.extractScoringFactors(alert);
    const score = this.calculateSeverityScore(factors);

    const anyForceSev1 =
      factors.dataRisk === 'confirmed_breach' ||
      factors.dataRisk === 'confirmed_loss' ||
      factors.userImpact === 'total' ||
      factors.complianceTrigger === 'breach_notification_required';

    if (anyForceSev1) {
      alert.severity = 1;
      return alert;
    }

    if (score >= 0.8) alert.severity = 1;
    else if (score >= 0.6) alert.severity = 2;
    else if (score >= 0.4) alert.severity = 3;
    else if (score >= 0.2) alert.severity = 4;
    else alert.severity = 5;

    return alert;
  }

  private extractScoringFactors(alert: SentinelAlert): SeverityScoringFactors {
    let userImpact: SeverityScoringFactors['userImpact'] = 'none';
    if (alert.tenantScope === 'all') userImpact = 'total';
    else if (alert.tenantScope === 'multi') userImpact = 'significant';
    else if (alert.tenantScope === 'single') userImpact = 'moderate';
    else if (alert.category === 'performance') userImpact = 'minor';

    let blastRadius: SeverityScoringFactors['blastRadius'] = 'single_component';
    if (alert.tenantScope === 'all') blastRadius = 'all_regions';
    else if (alert.tenantScope === 'multi') blastRadius = 'multi_tenant';
    else if (alert.tenantScope === 'single') blastRadius = 'single_tenant';

    let dataRisk: SeverityScoringFactors['dataRisk'] = 'none';
    if (alert.category === 'security') {
      const details = alert.details as Record<string, unknown>;
      if (details.breachConfirmed) dataRisk = 'confirmed_breach';
      else if (details.dataLoss) dataRisk = 'confirmed_loss';
      else dataRisk = 'potential_exposure';
    }

    let complianceTrigger: SeverityScoringFactors['complianceTrigger'] = 'none';
    if (alert.complianceContext.length > 0 && alert.complianceContext[0] !== 'none') {
      if (alert.category === 'security') complianceTrigger = 'breach_notification_required';
      else if (alert.category === 'compliance') complianceTrigger = 'control_failure';
      else complianceTrigger = 'audit_gap';
    }

    return {
      userImpact,
      blastRadius,
      dataRisk,
      complianceTrigger,
      durationMinutes: 0,
    };
  }

  private calculateSeverityScore(factors: SeverityScoringFactors): number {
    const impactScores: Record<string, number> = {
      none: 0, minor: 0.25, moderate: 0.5, significant: 0.75, total: 1.0,
    };
    const radiusScores: Record<string, number> = {
      single_component: 0, single_tenant: 0.25, multi_tenant: 0.5,
      single_region: 0.75, all_regions: 1.0,
    };
    const dataRiskScores: Record<string, number> = {
      none: 0, potential_exposure: 0.5, confirmed_breach: 0.9, confirmed_loss: 1.0,
    };
    const complianceScores: Record<string, number> = {
      none: 0, audit_gap: 0.3, control_failure: 0.6, breach_notification_required: 1.0,
    };

    const durationScore = Math.min(factors.durationMinutes / 30, 1.0);

    return (
      (impactScores[factors.userImpact] || 0) * SEVERITY_FACTOR_WEIGHTS.userImpact +
      (radiusScores[factors.blastRadius] || 0) * SEVERITY_FACTOR_WEIGHTS.blastRadius +
      (dataRiskScores[factors.dataRisk] || 0) * SEVERITY_FACTOR_WEIGHTS.dataRisk +
      (complianceScores[factors.complianceTrigger] || 0) * SEVERITY_FACTOR_WEIGHTS.complianceTrigger +
      durationScore * SEVERITY_FACTOR_WEIGHTS.durationMinutes
    );
  }

  // =========================================================================
  // Compliance Context Enrichment
  // =========================================================================

  private enrichComplianceContext(alert: SentinelAlert): SentinelAlert {
    if (alert.complianceContext.length > 0 && alert.complianceContext[0] !== 'none') {
      return alert;
    }

    const contexts: SentinelComplianceContext[] = [];

    if (alert.category === 'security' && alert.severity <= 2) {
      contexts.push('hipaa', 'gdpr', 'soc2');
    } else if (alert.category === 'compliance') {
      contexts.push('soc2');
      const details = alert.details as Record<string, unknown>;
      if (details.auditLogGap) contexts.push('hipaa');
      if (details.personalData) contexts.push('gdpr');
    } else if (alert.category === 'data' && alert.severity <= 2) {
      contexts.push('hipaa', 'soc2');
    }

    alert.complianceContext = contexts.length > 0 ? contexts : ['none'];
    return alert;
  }

  // =========================================================================
  // Correlation: Group related alerts into incidents
  // =========================================================================

  private correlateIntoIncidents(alerts: SentinelAlert[]): SentinelIncident[] {
    const newIncidents: SentinelIncident[] = [];
    const grouped = new Map<string, SentinelAlert[]>();

    for (const alert of alerts) {
      const correlationKey = `${alert.service}:${alert.category}`;

      const existingIncident = Array.from(this.activeIncidents.values()).find(inc =>
        inc.service === alert.service &&
        inc.category === alert.category &&
        inc.status !== 'resolved' &&
        inc.status !== 'postmortem' &&
        (new Date(alert.createdAt).getTime() - new Date(inc.createdAt).getTime()) < this.config.correlationWindowMs
      );

      if (existingIncident) {
        if (!existingIncident.alertIds.includes(alert.alertId)) {
          existingIncident.alertIds.push(alert.alertId);
        }
        if (alert.severity < existingIncident.severity) {
          existingIncident.severity = alert.severity;
        }
        existingIncident.updatedAt = new Date().toISOString();
        alert.incidentId = existingIncident.id;
        continue;
      }

      if (!grouped.has(correlationKey)) {
        grouped.set(correlationKey, []);
      }
      grouped.get(correlationKey)!.push(alert);
    }

    for (const [, groupAlerts] of grouped) {
      if (groupAlerts.length === 0) continue;

      const worstSeverity = Math.min(...groupAlerts.map(a => a.severity)) as SentinelSeverity;
      const primary = groupAlerts[0];

      const incident: SentinelIncident = {
        id: this.generateUuid(),
        severity: worstSeverity,
        status: 'detected',
        title: groupAlerts.length === 1
          ? primary.title
          : `${groupAlerts.length} related alerts: ${primary.service} / ${primary.category}`,
        description: primary.message,
        category: primary.category,
        service: primary.service,
        region: primary.region,
        tenantScope: primary.tenantScope,
        affectedTenantIds: primary.affectedTenantIds,
        complianceContext: primary.complianceContext,
        alertIds: groupAlerts.map(a => a.alertId),
        autoRemediationAttempted: false,
        autoRemediationSucceeded: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      for (const a of groupAlerts) {
        a.incidentId = incident.id;
      }

      this.activeIncidents.set(incident.id, incident);
      newIncidents.push(incident);
    }

    return newIncidents;
  }

  // =========================================================================
  // Persistence (Aurora — long-term history)
  // =========================================================================

  private async persistAlerts(alerts: SentinelAlert[]): Promise<void> {
    if (alerts.length === 0) return;
    // DynamoDB write would go here in production
    // Aurora write for historical record:
    const client = await this.pool.connect();
    try {
      for (const alert of alerts) {
        if (alert.incidentId) {
          await client.query(
            `INSERT INTO sentinel_incident_timeline (incident_id, event_type, actor, message, details)
             VALUES ($1, 'alert_fired', 'system', $2, $3)
             ON CONFLICT DO NOTHING`,
            [alert.incidentId, alert.title, JSON.stringify({ alertId: alert.alertId, severity: alert.severity })]
          );
        }
      }
    } finally {
      client.release();
    }
  }

  private async persistIncidents(incidents: SentinelIncident[]): Promise<void> {
    if (incidents.length === 0) return;
    const client = await this.pool.connect();
    try {
      for (const incident of incidents) {
        await client.query(
          `INSERT INTO sentinel_incidents
           (id, tenant_id, severity, status, title, description, category, service, region,
            tenant_scope, affected_tenant_ids, compliance_context, alert_ids,
            auto_remediation_attempted, auto_remediation_succeeded)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           ON CONFLICT (id) DO UPDATE SET
             severity = EXCLUDED.severity,
             alert_ids = EXCLUDED.alert_ids,
             updated_at = NOW()`,
          [
            incident.id,
            '00000000-0000-0000-0000-000000000000', // platform-level tenant
            incident.severity,
            incident.status,
            incident.title,
            incident.description,
            incident.category,
            incident.service,
            incident.region,
            incident.tenantScope,
            incident.affectedTenantIds || [],
            incident.complianceContext,
            incident.alertIds,
            incident.autoRemediationAttempted,
            incident.autoRemediationSucceeded,
          ]
        );
      }
    } finally {
      client.release();
    }
  }

  // =========================================================================
  // Query Methods (for Admin API)
  // =========================================================================

  async getDashboard(tenantId: string): Promise<{
    alertsBySeverity: Record<number, number>;
    alertsByCategory: Record<string, number>;
    activeIncidents: SentinelIncident[];
    recentAlerts: SentinelAlert[];
    metrics: Record<string, number>;
  }> {
    const client = await this.pool.connect();
    try {
      const incidentsResult = await client.query(
        `SELECT * FROM sentinel_incidents
         WHERE status NOT IN ('resolved', 'postmortem')
         ORDER BY severity ASC, created_at DESC
         LIMIT 50`
      );

      const metricsResult = await client.query(
        `SELECT
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as total_incidents_24h,
           AVG(EXTRACT(EPOCH FROM (acknowledged_at - created_at)) / 60)
             FILTER (WHERE acknowledged_at IS NOT NULL AND created_at > NOW() - INTERVAL '7 days') as avg_mtta_minutes,
           AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60)
             FILTER (WHERE resolved_at IS NOT NULL AND created_at > NOW() - INTERVAL '7 days') as avg_mttr_minutes,
           COUNT(*) FILTER (WHERE severity = 1 AND created_at > NOW() - INTERVAL '24 hours') as sev1_24h,
           COUNT(*) FILTER (WHERE severity = 2 AND created_at > NOW() - INTERVAL '24 hours') as sev2_24h,
           COUNT(*) FILTER (WHERE severity = 3 AND created_at > NOW() - INTERVAL '24 hours') as sev3_24h,
           COUNT(*) FILTER (WHERE auto_remediation_attempted AND created_at > NOW() - INTERVAL '24 hours') as auto_remediation_24h
         FROM sentinel_incidents`
      );

      const m = metricsResult.rows[0] || {};
      const alertsBySev: Record<number, number> = {};
      const alertsByCat: Record<string, number> = {};

      for (const entry of this.activeAlerts.values()) {
        alertsBySev[entry.alert.severity] = (alertsBySev[entry.alert.severity] || 0) + 1;
        alertsByCat[entry.alert.category] = (alertsByCat[entry.alert.category] || 0) + 1;
      }

      return {
        alertsBySeverity: alertsBySev,
        alertsByCategory: alertsByCat,
        activeIncidents: incidentsResult.rows,
        recentAlerts: Array.from(this.activeAlerts.values())
          .sort((a, b) => b.lastUpdated - a.lastUpdated)
          .slice(0, 50)
          .map(e => e.alert),
        metrics: {
          totalIncidents24h: parseInt(m.total_incidents_24h || '0'),
          avgMttaMinutes: parseFloat(m.avg_mtta_minutes || '0'),
          avgMttrMinutes: parseFloat(m.avg_mttr_minutes || '0'),
          sev1Count24h: parseInt(m.sev1_24h || '0'),
          sev2Count24h: parseInt(m.sev2_24h || '0'),
          sev3Count24h: parseInt(m.sev3_24h || '0'),
          autoRemediation24h: parseInt(m.auto_remediation_24h || '0'),
          activeAlerts: this.activeAlerts.size,
        },
      };
    } finally {
      client.release();
    }
  }

  async getIncidents(filters: {
    status?: SentinelIncidentStatus;
    severity?: SentinelSeverity;
    limit?: number;
    offset?: number;
  }): Promise<{ incidents: SentinelIncident[]; total: number }> {
    const client = await this.pool.connect();
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (filters.status) {
        conditions.push(`status = $${idx++}`);
        params.push(filters.status);
      }
      if (filters.severity) {
        conditions.push(`severity = $${idx++}`);
        params.push(filters.severity);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      const countResult = await client.query(
        `SELECT COUNT(*) FROM sentinel_incidents ${where}`, params
      );
      const result = await client.query(
        `SELECT * FROM sentinel_incidents ${where}
         ORDER BY severity ASC, created_at DESC
         LIMIT ${limit} OFFSET ${offset}`,
        params
      );

      return {
        incidents: result.rows,
        total: parseInt(countResult.rows[0].count),
      };
    } finally {
      client.release();
    }
  }

  async getIncidentTimeline(incidentId: string): Promise<unknown[]> {
    const result = await this.pool.query(
      `SELECT * FROM sentinel_incident_timeline WHERE incident_id = $1 ORDER BY created_at ASC`,
      [incidentId]
    );
    return result.rows;
  }

  async acknowledgeIncident(incidentId: string, userId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `UPDATE sentinel_incidents SET status = 'triaged', acknowledged_at = NOW(), commander_id = $2, updated_at = NOW()
         WHERE id = $1`, [incidentId, userId]
      );
      await client.query(
        `INSERT INTO sentinel_incident_timeline (incident_id, event_type, actor, message)
         VALUES ($1, 'acknowledged', $2, 'Incident acknowledged')`,
        [incidentId, userId]
      );
    } finally {
      client.release();
    }
  }

  async updateIncidentStatus(incidentId: string, status: SentinelIncidentStatus, userId: string, note?: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      const updates: string[] = [`status = $2`, `updated_at = NOW()`];
      if (status === 'resolved') {
        updates.push(`resolved_at = NOW()`);
        updates.push(`duration_seconds = EXTRACT(EPOCH FROM (NOW() - created_at))::INTEGER`);
      }

      await client.query(
        `UPDATE sentinel_incidents SET ${updates.join(', ')} WHERE id = $1`,
        [incidentId, status]
      );
      await client.query(
        `INSERT INTO sentinel_incident_timeline (incident_id, event_type, actor, message)
         VALUES ($1, 'status_change', $2, $3)`,
        [incidentId, userId, note || `Status changed to ${status}`]
      );
    } finally {
      client.release();
    }
  }

  // =========================================================================
  // Housekeeping
  // =========================================================================

  private pruneStaleAlerts(): void {
    const cutoff = Date.now() - this.config.deduplicationWindowMs * 2;
    for (const [key, entry] of this.activeAlerts) {
      if (entry.lastUpdated < cutoff && entry.alert.status === 'resolved') {
        this.activeAlerts.delete(key);
      }
    }
  }

  private generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
}
