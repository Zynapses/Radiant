/**
 * RADIANT v4.18.0 — Intrusion Detection Analyzer Lambda
 *
 * EventBridge-scheduled Lambda that runs periodic analysis:
 *  1. Correlates recent intrusion events into incidents
 *  2. Updates user access baselines (UEBA)
 *  3. Cleans up expired IP blocks and old events
 *  4. Publishes CloudWatch metrics
 *
 * Schedule: Every 1 minute for correlation, every 1 hour for baselines/cleanup
 *
 * Standards:
 *  - NIST CSF DE.AE-04: Estimated impact and scope of adverse events
 *  - NIST CSF DE.AE-08: Incidents declared when criteria met
 *  - CIS Control 8.11: Conduct audit log reviews
 *  - ISO 27001 A.8.16: Monitoring activities
 */

import {
  CloudWatchClient,
  PutMetricDataCommand,
} from '@aws-sdk/client-cloudwatch';
import { executeStatement, stringParam, longParam } from '../shared/db/client';
import { createRegisteredLogger } from '../shared/services/logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'intrusion-detection/analyzer',
  category: 'security',
  sourceType: 'lambda',
});

const cloudwatch = new CloudWatchClient({});

// ============================================================================
// Types
// ============================================================================

interface AnalyzerEvent {
  source: string;
  'detail-type': string;
  detail: {
    mode: 'correlate' | 'baseline' | 'cleanup' | 'full';
  };
}

interface CorrelationGroup {
  detectorId: string;
  sourceIp: string;
  tenantId: string | null;
  severity: string;
  eventCount: number;
  firstEventAt: string;
  lastEventAt: string;
  mitreTechniques: string[];
  affectedUsers: string[];
}

// ============================================================================
// Handler
// ============================================================================

export async function handler(event: AnalyzerEvent): Promise<{ statusCode: number; body: string }> {
  const mode = event?.detail?.mode || 'full';
  const startTime = Date.now();

  logger.info('Intrusion detection analyzer started', { mode });

  try {
    const results: Record<string, unknown> = {};

    if (mode === 'correlate' || mode === 'full') {
      results.correlation = await correlateEvents();
    }

    if (mode === 'baseline' || mode === 'full') {
      results.baselines = await updateBaselines();
    }

    if (mode === 'cleanup' || mode === 'full') {
      results.cleanup = await cleanupExpiredData();
    }

    // Always publish metrics
    results.metrics = await publishMetrics();

    const durationMs = Date.now() - startTime;
    logger.info('Intrusion detection analyzer completed', { mode, durationMs, results });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, mode, durationMs, results }),
    };
  } catch (err) {
    logger.error('Intrusion detection analyzer failed', err as Error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: String(err) }),
    };
  }
}

// ============================================================================
// 1. Event Correlation — group related events into incidents
// (NIST CSF DE.AE-04, DE.AE-08)
// ============================================================================

async function correlateEvents(): Promise<{
  groupsFound: number;
  incidentsCreated: number;
  incidentsUpdated: number;
}> {
  let incidentsCreated = 0;
  let incidentsUpdated = 0;

  // Find clusters of events from same source IP / detector in last 5 minutes
  // that haven't been assigned to an incident yet
  const groupsResult = await executeStatement(
    `SELECT
      detector_id,
      source_ip::text as source_ip,
      tenant_id::text as tenant_id,
      MAX(severity::text) as max_severity,
      COUNT(*) as event_count,
      MIN(created_at)::text as first_event,
      MAX(created_at)::text as last_event,
      array_to_json(array_agg(DISTINCT mitre_technique) FILTER (WHERE mitre_technique IS NOT NULL AND mitre_technique != '')) as mitre_techniques,
      array_to_json(array_agg(DISTINCT user_id::text) FILTER (WHERE user_id IS NOT NULL)) as affected_users
    FROM intrusion_events
    WHERE created_at > now() - interval '5 minutes'
      AND correlated_incident_id IS NULL
      AND severity IN ('high', 'critical')
    GROUP BY detector_id, source_ip, tenant_id
    HAVING COUNT(*) >= 3
    ORDER BY MAX(severity::text) DESC, COUNT(*) DESC`,
    []
  );

  const groups: CorrelationGroup[] = (groupsResult.rows || []).map((row: Record<string, unknown>) => ({
    detectorId: String(row.detector_id),
    sourceIp: String(row.source_ip),
    tenantId: row.tenant_id ? String(row.tenant_id) : null,
    severity: String(row.max_severity),
    eventCount: Number(row.event_count),
    firstEventAt: String(row.first_event),
    lastEventAt: String(row.last_event),
    mitreTechniques: (row.mitre_techniques as string[]) || [],
    affectedUsers: (row.affected_users as string[]) || [],
  }));

  for (const group of groups) {
    try {
      // Check if there's an existing open incident for this source
      const existingResult = await executeStatement(
        `SELECT id::text as id, event_count FROM intrusion_incidents
         WHERE status IN ('open', 'investigating')
           AND $1::inet = ANY(source_ips)
           AND (tenant_id IS NULL OR tenant_id = NULLIF($2, '')::uuid)
           AND last_event_at > now() - interval '30 minutes'
         ORDER BY last_event_at DESC
         LIMIT 1`,
        [
          stringParam('ip', group.sourceIp),
          stringParam('tenant', group.tenantId || ''),
        ]
      );

      let incidentId: string;

      if (existingResult.rows && existingResult.rows.length > 0) {
        // Update existing incident
        incidentId = String(existingResult.rows[0].id);
        await executeStatement(
          `UPDATE intrusion_incidents SET
            event_count = event_count + $1,
            last_event_at = $2::timestamptz,
            severity = CASE WHEN $3::intrusion_severity > severity THEN $3::intrusion_severity ELSE severity END,
            updated_at = now()
          WHERE id = $4::uuid`,
          [
            longParam('count', group.eventCount),
            stringParam('lastEvent', group.lastEventAt),
            stringParam('severity', group.severity),
            stringParam('id', incidentId),
          ]
        );
        incidentsUpdated++;
      } else {
        // Create new incident
        const title = `${group.detectorId.replace(/_/g, ' ')} from ${group.sourceIp}`;
        const description = `${group.eventCount} ${group.severity} events detected by ${group.detectorId} from IP ${group.sourceIp}`;

        const insertResult = await executeStatement(
          `INSERT INTO intrusion_incidents (
            tenant_id, title, description, severity, status,
            source_ips, event_count, first_event_at, last_event_at
          ) VALUES (NULLIF($1, '')::uuid, $2, $3, $4::intrusion_severity, 'open',
                    ARRAY[$5::inet], $6, $7::timestamptz, $8::timestamptz)
          RETURNING id::text as id`,
          [
            stringParam('tenant', group.tenantId || ''),
            stringParam('title', title),
            stringParam('desc', description),
            stringParam('severity', group.severity),
            stringParam('ip', group.sourceIp),
            longParam('count', group.eventCount),
            stringParam('first', group.firstEventAt),
            stringParam('last', group.lastEventAt),
          ]
        );
        incidentId = String(insertResult.rows?.[0]?.id);
        incidentsCreated++;

        logger.warn(`New intrusion incident created: ${title}`, {
          incidentId,
          severity: group.severity,
          eventCount: group.eventCount,
          sourceIp: group.sourceIp,
        });
      }

      // Link uncorrelated events to the incident
      await executeStatement(
        `UPDATE intrusion_events
         SET correlated_incident_id = $1::uuid
         WHERE detector_id = $2
           AND source_ip = $3::inet
           AND (tenant_id IS NULL OR tenant_id = NULLIF($4, '')::uuid)
           AND correlated_incident_id IS NULL
           AND created_at > now() - interval '5 minutes'`,
        [
          stringParam('incidentId', incidentId),
          stringParam('detector', group.detectorId),
          stringParam('ip', group.sourceIp),
          stringParam('tenant', group.tenantId || ''),
        ]
      );

    } catch (err) {
      logger.error('Failed to correlate event group', err as Error, {
        detector: group.detectorId,
        ip: group.sourceIp,
      });
    }
  }

  return {
    groupsFound: groups.length,
    incidentsCreated,
    incidentsUpdated,
  };
}

// ============================================================================
// 2. User Access Baseline Updates (UEBA)
// (NIST CSF DE.AE-05: criteria for adverse event alerting)
// ============================================================================

async function updateBaselines(): Promise<{ usersUpdated: number }> {
  // Aggregate last 24h of user activity into baselines
  // Only update for users with significant activity
  const result = await executeStatement(
    `INSERT INTO user_access_baselines (tenant_id, user_id, typical_hours, typical_countries,
      typical_ips, typical_user_agents, avg_requests_per_hour, typical_endpoints, sample_count, last_updated)
    SELECT
      ie.tenant_id,
      ie.user_id,
      array_agg(DISTINCT EXTRACT(HOUR FROM ie.created_at)::int),
      array_agg(DISTINCT ie.geo_country) FILTER (WHERE ie.geo_country IS NOT NULL AND ie.geo_country != ''),
      array_agg(DISTINCT ie.source_ip),
      array_agg(DISTINCT ie.user_agent) FILTER (WHERE ie.user_agent IS NOT NULL AND ie.user_agent != ''),
      COUNT(*)::real / GREATEST(EXTRACT(EPOCH FROM (MAX(ie.created_at) - MIN(ie.created_at))) / 3600.0, 1),
      array_agg(DISTINCT ie.request_path) FILTER (WHERE ie.request_path IS NOT NULL),
      COUNT(*),
      now()
    FROM intrusion_events ie
    WHERE ie.user_id IS NOT NULL
      AND ie.tenant_id IS NOT NULL
      AND ie.created_at > now() - interval '24 hours'
    GROUP BY ie.tenant_id, ie.user_id
    HAVING COUNT(*) >= 10
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET
      typical_hours = (
        SELECT array_agg(DISTINCT h) FROM unnest(
          user_access_baselines.typical_hours || EXCLUDED.typical_hours
        ) h
      ),
      typical_countries = (
        SELECT array_agg(DISTINCT c) FROM unnest(
          user_access_baselines.typical_countries || EXCLUDED.typical_countries
        ) c WHERE c IS NOT NULL
      ),
      typical_ips = (
        SELECT array_agg(DISTINCT ip) FROM (
          SELECT unnest(EXCLUDED.typical_ips) as ip
          UNION
          SELECT unnest(user_access_baselines.typical_ips)
        ) sub
      ),
      avg_requests_per_hour = (user_access_baselines.avg_requests_per_hour * 0.7 + EXCLUDED.avg_requests_per_hour * 0.3),
      sample_count = user_access_baselines.sample_count + EXCLUDED.sample_count,
      last_updated = now()`,
    []
  );

  const usersUpdated = result.numberOfRecordsUpdated || 0;
  logger.info(`Updated ${usersUpdated} user access baselines`);

  return { usersUpdated };
}

// ============================================================================
// 3. Cleanup expired data
// (CIS Control 8.11: audit log reviews)
// ============================================================================

async function cleanupExpiredData(): Promise<{
  expiredBlocksRemoved: number;
  expiredIndicatorsRemoved: number;
  resolvedIncidents: number;
  accountsAutoUnlocked: number;
}> {
  // Remove expired IP blocks
  const blocksResult = await executeStatement(
    `DELETE FROM ip_blocklist WHERE NOT is_permanent AND expires_at < now()`,
    []
  );
  const expiredBlocksRemoved = blocksResult.numberOfRecordsUpdated || 0;

  // Remove expired threat indicators
  const indicatorsResult = await executeStatement(
    `DELETE FROM threat_indicators WHERE expires_at IS NOT NULL AND expires_at < now()`,
    []
  );
  const expiredIndicatorsRemoved = indicatorsResult.numberOfRecordsUpdated || 0;

  // Auto-resolve old incidents that haven't had activity in 24h
  const incidentsResult = await executeStatement(
    `UPDATE intrusion_incidents
     SET status = 'resolved',
         resolved_at = now(),
         resolution_notes = 'Auto-resolved: no activity for 24 hours'
     WHERE status IN ('open', 'investigating')
       AND last_event_at < now() - interval '24 hours'`,
    []
  );
  const resolvedIncidents = incidentsResult.numberOfRecordsUpdated || 0;

  // Auto-unlock expired account lockouts (NIST SP 800-63B §5.2.8)
  const unlockResult = await executeStatement(
    `SELECT unlocked_count FROM auto_unlock_expired_accounts()`,
    []
  );
  const accountsAutoUnlocked = Number(unlockResult.rows?.[0]?.unlocked_count) || 0;

  if (expiredBlocksRemoved > 0 || expiredIndicatorsRemoved > 0 || resolvedIncidents > 0 || accountsAutoUnlocked > 0) {
    logger.info('Cleanup completed', {
      expiredBlocksRemoved,
      expiredIndicatorsRemoved,
      resolvedIncidents,
      accountsAutoUnlocked,
    });
  }

  if (accountsAutoUnlocked > 0) {
    logger.warn(`Auto-unlocked ${accountsAutoUnlocked} expired account lockouts`);
  }

  return { expiredBlocksRemoved, expiredIndicatorsRemoved, resolvedIncidents, accountsAutoUnlocked };
}

// ============================================================================
// 4. Publish CloudWatch Metrics
// ============================================================================

async function publishMetrics(): Promise<{ published: boolean }> {
  const namespace = 'RADIANT/IntrusionDetection';

  try {
    // Get counts from last 5 minutes
    const [statsResult, blockedResult, incidentsResult, lockedAccountsResult] = await Promise.all([
      executeStatement(
        `SELECT
          COUNT(*) as total_events,
          COUNT(*) FILTER (WHERE severity = 'critical') as critical_events,
          COUNT(*) FILTER (WHERE severity = 'high') as high_events,
          COUNT(DISTINCT source_ip) as unique_ips,
          COUNT(DISTINCT detector_id) as active_detectors
        FROM intrusion_events
        WHERE created_at > now() - interval '5 minutes'`,
        []
      ),
      executeStatement(
        `SELECT COUNT(*) as cnt FROM ip_blocklist
         WHERE is_permanent OR expires_at > now()`,
        []
      ),
      executeStatement(
        `SELECT COUNT(*) as cnt FROM intrusion_incidents
         WHERE status IN ('open', 'investigating')`,
        []
      ),
      executeStatement(
        `SELECT COUNT(*) as cnt,
                COUNT(*) FILTER (WHERE account_lock_permanent) as permanent_cnt
         FROM users WHERE account_locked = true`,
        []
      ),
    ]);

    const stats = statsResult.rows?.[0] || {};
    const blockedIps = Number(blockedResult.rows?.[0]?.cnt) || 0;
    const activeIncidents = Number(incidentsResult.rows?.[0]?.cnt) || 0;
    const lockedAccounts = Number(lockedAccountsResult.rows?.[0]?.cnt) || 0;
    const permanentLocks = Number(lockedAccountsResult.rows?.[0]?.permanent_cnt) || 0;

    const timestamp = new Date();

    await cloudwatch.send(new PutMetricDataCommand({
      Namespace: namespace,
      MetricData: [
        {
          MetricName: 'IntrusionEventsDetected',
          Value: Number(stats.total_events) || 0,
          Unit: 'Count',
          Timestamp: timestamp,
        },
        {
          MetricName: 'CriticalIntrusionEvents',
          Value: Number(stats.critical_events) || 0,
          Unit: 'Count',
          Timestamp: timestamp,
        },
        {
          MetricName: 'HighIntrusionEvents',
          Value: Number(stats.high_events) || 0,
          Unit: 'Count',
          Timestamp: timestamp,
        },
        {
          MetricName: 'UniqueAttackSourceIPs',
          Value: Number(stats.unique_ips) || 0,
          Unit: 'Count',
          Timestamp: timestamp,
        },
        {
          MetricName: 'BlockedIPs',
          Value: blockedIps,
          Unit: 'Count',
          Timestamp: timestamp,
        },
        {
          MetricName: 'ActiveIncidents',
          Value: activeIncidents,
          Unit: 'Count',
          Timestamp: timestamp,
        },
        {
          MetricName: 'LockedAccounts',
          Value: lockedAccounts,
          Unit: 'Count',
          Timestamp: timestamp,
        },
        {
          MetricName: 'PermanentAccountLocks',
          Value: permanentLocks,
          Unit: 'Count',
          Timestamp: timestamp,
        },
      ],
    }));

    return { published: true };
  } catch (err) {
    logger.error('Failed to publish CloudWatch metrics', err as Error);
    return { published: false };
  }
}
