/**
 * RADIANT v4.18.0 — Threat Intelligence Service
 *
 * Manages threat indicators (IOCs), IP reputation data, and known-bad patterns.
 * Provides a local threat intelligence database supplemented by external feeds.
 *
 * Standards:
 *  - MITRE ATT&CK: Technique-mapped indicators
 *  - CIS Control 13.3: Centralized security event alerting
 *  - NIST CSF DE.CM-08: Vulnerability scans performed
 *  - ISO 27001 A.5.7: Threat intelligence
 */

import { executeStatement, stringParam, longParam, doubleParam, boolParam } from '../db/client';
import { createRegisteredLogger } from './logging-registry.service';
import * as crypto from 'crypto';

const logger = createRegisteredLogger({
  serviceName: 'security/threat-intelligence',
  category: 'security',
  sourceType: 'application',
});

// ============================================================================
// Types
// ============================================================================

export type IndicatorType = 'ip' | 'cidr' | 'user_agent' | 'pattern' | 'email_domain' | 'country';

export interface ThreatIndicator {
  id: string;
  indicatorType: IndicatorType;
  indicatorValue: string;
  threatType: string;
  confidence: number;
  source: string;
  firstSeen: Date;
  lastSeen: Date;
  hitCount: number;
  isActive: boolean;
  metadata: Record<string, unknown>;
  expiresAt?: Date;
}

export interface IPReputation {
  ip: string;
  score: number; // 0 = clean, 100 = malicious
  categories: string[];
  source: string;
  lastChecked: Date;
  reports: number;
}

// ============================================================================
// Known malicious patterns (built-in — no external dependency)
// ============================================================================

const KNOWN_BAD_USER_AGENTS = [
  'sqlmap',
  'nikto',
  'nmap',
  'masscan',
  'zgrab',
  'gobuster',
  'dirbuster',
  'wfuzz',
  'hydra',
  'burpsuite',
  'nuclei',
  'httpx',
  'python-requests/2.', // Often used in automated attacks (but also legitimate)
];

const KNOWN_BAD_PATHS = [
  '/.env',
  '/wp-admin',
  '/wp-login.php',
  '/xmlrpc.php',
  '/phpmyadmin',
  '/.git/config',
  '/.aws/credentials',
  '/actuator/health',
  '/api/v1/pods',
  '/server-status',
  '/.well-known/security.txt',  // Not bad, but probing
  '/debug/pprof',
  '/metrics',
  '/_config.yml',
];

// ============================================================================
// Threat Intelligence Service
// ============================================================================

class ThreatIntelligenceService {
  private indicatorCache: Map<string, ThreatIndicator> = new Map();
  private cacheLoadedAt = 0;
  private cacheTtlMs = 300000; // 5 min cache

  // --------------------------------------------------------------------------
  // Indicator Management
  // --------------------------------------------------------------------------

  async addIndicator(indicator: Omit<ThreatIndicator, 'id' | 'firstSeen' | 'lastSeen' | 'hitCount'>): Promise<ThreatIndicator> {
    const id = crypto.randomUUID();

    await executeStatement(
      `INSERT INTO threat_indicators (id, indicator_type, indicator_value, threat_type, confidence,
                                       source, is_active, metadata, expires_at)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
       ON CONFLICT (indicator_type, indicator_value) DO UPDATE SET
         confidence = GREATEST(threat_indicators.confidence, EXCLUDED.confidence),
         last_seen = now(),
         hit_count = threat_indicators.hit_count + 1,
         is_active = EXCLUDED.is_active,
         metadata = threat_indicators.metadata || EXCLUDED.metadata`,
      [
        stringParam('id', id),
        stringParam('type', indicator.indicatorType),
        stringParam('value', indicator.indicatorValue),
        stringParam('threatType', indicator.threatType),
        doubleParam('confidence', indicator.confidence),
        stringParam('source', indicator.source),
        boolParam('active', indicator.isActive),
        stringParam('metadata', JSON.stringify(indicator.metadata || {})),
        stringParam('expires', indicator.expiresAt?.toISOString() || ''),
      ]
    );

    // Invalidate cache
    this.cacheLoadedAt = 0;

    logger.info('Threat indicator added', {
      type: indicator.indicatorType,
      value: indicator.indicatorValue,
      threatType: indicator.threatType,
    });

    return {
      ...indicator,
      id,
      firstSeen: new Date(),
      lastSeen: new Date(),
      hitCount: 0,
    };
  }

  async removeIndicator(id: string): Promise<boolean> {
    const result = await executeStatement(
      `DELETE FROM threat_indicators WHERE id = $1::uuid RETURNING id`,
      [stringParam('id', id)]
    );
    this.cacheLoadedAt = 0;
    return (result.rows?.length || 0) > 0;
  }

  async getIndicators(options?: {
    type?: IndicatorType;
    threatType?: string;
    activeOnly?: boolean;
    limit?: number;
  }): Promise<ThreatIndicator[]> {
    let query = `SELECT * FROM threat_indicators WHERE 1=1`;
    const params: ReturnType<typeof stringParam>[] = [];
    let idx = 1;

    if (options?.type) {
      query += ` AND indicator_type = $${idx}`;
      params.push(stringParam('type', options.type));
      idx++;
    }
    if (options?.threatType) {
      query += ` AND threat_type = $${idx}`;
      params.push(stringParam('threatType', options.threatType));
      idx++;
    }
    if (options?.activeOnly !== false) {
      query += ` AND is_active = true`;
    }

    query += ` ORDER BY last_seen DESC LIMIT $${idx}`;
    params.push(longParam('limit', options?.limit || 200));

    const result = await executeStatement(query, params);

    return (result.rows || []).map(row => ({
      id: String(row.id),
      indicatorType: String(row.indicator_type) as IndicatorType,
      indicatorValue: String(row.indicator_value),
      threatType: String(row.threat_type),
      confidence: Number(row.confidence),
      source: String(row.source),
      firstSeen: new Date(row.first_seen as string),
      lastSeen: new Date(row.last_seen as string),
      hitCount: Number(row.hit_count),
      isActive: Boolean(row.is_active),
      metadata: (row.metadata as Record<string, unknown>) || {},
      expiresAt: row.expires_at ? new Date(row.expires_at as string) : undefined,
    }));
  }

  // --------------------------------------------------------------------------
  // Fast Lookups (used by detectors)
  // --------------------------------------------------------------------------

  /** Check if a user-agent matches known scanning tools */
  isKnownBadUserAgent(userAgent: string): { isBad: boolean; matchedPattern?: string } {
    if (!userAgent) return { isBad: false };
    const ua = userAgent.toLowerCase();

    for (const pattern of KNOWN_BAD_USER_AGENTS) {
      if (ua.includes(pattern.toLowerCase())) {
        return { isBad: true, matchedPattern: pattern };
      }
    }
    return { isBad: false };
  }

  /** Check if a path is commonly probed in attacks */
  isKnownBadPath(path: string): { isBad: boolean; matchedPattern?: string } {
    if (!path) return { isBad: false };
    const p = path.toLowerCase();

    for (const pattern of KNOWN_BAD_PATHS) {
      if (p.startsWith(pattern.toLowerCase())) {
        return { isBad: true, matchedPattern: pattern };
      }
    }
    return { isBad: false };
  }

  /** Check if an IP has threat indicators */
  async checkIpReputation(ip: string): Promise<IPReputation | null> {
    try {
      const result = await executeStatement(
        `SELECT * FROM threat_indicators
         WHERE indicator_type = 'ip' AND indicator_value = $1 AND is_active = true
         LIMIT 1`,
        [stringParam('ip', ip)]
      );

      if (!result.rows || result.rows.length === 0) return null;

      const row = result.rows[0];
      const metadata = (row.metadata as Record<string, unknown>) || {};

      return {
        ip,
        score: Number(row.confidence) * 100,
        categories: [(row.threat_type as string) || 'unknown'],
        source: String(row.source),
        lastChecked: new Date(row.last_seen as string),
        reports: Number(row.hit_count),
      };
    } catch (err) {
      logger.error('IP reputation check failed', err as Error);
      return null;
    }
  }

  /** Record a hit against a threat indicator */
  async recordIndicatorHit(indicatorType: IndicatorType, indicatorValue: string): Promise<void> {
    try {
      await executeStatement(
        `UPDATE threat_indicators SET hit_count = hit_count + 1, last_seen = now()
         WHERE indicator_type = $1 AND indicator_value = $2 AND is_active = true`,
        [stringParam('type', indicatorType), stringParam('value', indicatorValue)]
      );
    } catch {
      // Non-critical
    }
  }

  // --------------------------------------------------------------------------
  // Bulk Import (for external threat feeds)
  // --------------------------------------------------------------------------

  async importIndicators(indicators: Array<{
    type: IndicatorType;
    value: string;
    threatType: string;
    confidence: number;
    source: string;
  }>): Promise<{ imported: number; updated: number; errors: number }> {
    let imported = 0;
    let updated = 0;
    let errors = 0;

    for (const ind of indicators) {
      try {
        const result = await executeStatement(
          `INSERT INTO threat_indicators (indicator_type, indicator_value, threat_type, confidence, source)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (indicator_type, indicator_value) DO UPDATE SET
             confidence = GREATEST(threat_indicators.confidence, EXCLUDED.confidence),
             last_seen = now(),
             hit_count = threat_indicators.hit_count + 1
           RETURNING (xmax = 0) as is_insert`,
          [
            stringParam('type', ind.type),
            stringParam('value', ind.value),
            stringParam('threatType', ind.threatType),
            doubleParam('confidence', ind.confidence),
            stringParam('source', ind.source),
          ]
        );

        if (result.rows?.[0]?.is_insert) {
          imported++;
        } else {
          updated++;
        }
      } catch {
        errors++;
      }
    }

    this.cacheLoadedAt = 0;
    logger.info('Threat indicators imported', { imported, updated, errors });
    return { imported, updated, errors };
  }

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  async getStats(): Promise<{
    totalIndicators: number;
    activeIndicators: number;
    byType: Record<string, number>;
    byThreatType: Record<string, number>;
    topSources: Array<{ source: string; count: number }>;
  }> {
    try {
      const [totalResult, typeResult, threatResult, sourceResult] = await Promise.all([
        executeStatement(
          `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_active) as active FROM threat_indicators`,
          []
        ),
        executeStatement(
          `SELECT indicator_type, COUNT(*) as cnt FROM threat_indicators WHERE is_active GROUP BY indicator_type`,
          []
        ),
        executeStatement(
          `SELECT threat_type, COUNT(*) as cnt FROM threat_indicators WHERE is_active GROUP BY threat_type ORDER BY cnt DESC LIMIT 10`,
          []
        ),
        executeStatement(
          `SELECT source, COUNT(*) as cnt FROM threat_indicators WHERE is_active GROUP BY source ORDER BY cnt DESC LIMIT 5`,
          []
        ),
      ]);

      const byType: Record<string, number> = {};
      for (const row of (typeResult.rows || [])) {
        byType[String(row.indicator_type)] = Number(row.cnt);
      }

      const byThreatType: Record<string, number> = {};
      for (const row of (threatResult.rows || [])) {
        byThreatType[String(row.threat_type)] = Number(row.cnt);
      }

      return {
        totalIndicators: Number(totalResult.rows?.[0]?.total) || 0,
        activeIndicators: Number(totalResult.rows?.[0]?.active) || 0,
        byType,
        byThreatType,
        topSources: (sourceResult.rows || []).map(r => ({
          source: String(r.source),
          count: Number(r.cnt),
        })),
      };
    } catch (err) {
      logger.error('Failed to get threat intel stats', err as Error);
      return { totalIndicators: 0, activeIndicators: 0, byType: {}, byThreatType: {}, topSources: [] };
    }
  }
}

// ============================================================================
// Singleton
// ============================================================================

export const threatIntelligenceService = new ThreatIntelligenceService();
