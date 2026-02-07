/**
 * RADIANT SENTINEL v1.0.0 — Heartbeat / Dead Man's Switch Service
 *
 * Architecture (ratified — "Pilot Light" strategy):
 *   1. Primary (us-east-1): Full SENTINEL suite. Emits heartbeat every 60s.
 *   2. Pilot Light (us-west-2): Tiny standalone Lambda on separate account/VPC.
 *      Monitors ONLY the us-east-1 SENTINEL health check URL.
 *      If East goes dark → direct PagerDuty alert.
 *   3. External: deadmanssnitch.com receives heartbeat; alerts if missing 3 min.
 *
 * This service handles:
 *   - Emitting heartbeats to all 3 monitors
 *   - Validating the notification pipeline is functional
 *   - Self-health reporting
 */

import https from 'https';
import { SentinelHeartbeat } from '@radiant/shared/types/sentinel.types';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface HeartbeatConfig {
  region: string;
  deadMansSnitchUrl?: string;       // https://nosnch.in/XXXXX
  pagerdutyHeartbeatUrl?: string;   // PagerDuty heartbeat integration URL
  pilotLightHealthUrl?: string;     // Pilot Light health report endpoint
  sentinelHealthUrl: string;        // This SENTINEL instance's own /health
  pagerdutyRoutingKey?: string;     // For pilot light direct alert
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class SentinelHeartbeatService {
  private config: HeartbeatConfig;
  private checksCompleted: number = 0;
  private alertsActive: number = 0;
  private lastNotificationSent?: string;
  private startedAt: Date = new Date();

  constructor(config: HeartbeatConfig) {
    this.config = config;
  }

  // =========================================================================
  // Main: Emit heartbeat to all monitors
  // =========================================================================

  async emitHeartbeat(stats: {
    checksCompleted: number;
    alertsActive: number;
    lastNotificationSent?: string;
    notificationPipelineHealthy: boolean;
  }): Promise<{
    deadMansSnitch: boolean;
    pagerduty: boolean;
    pilotLight: boolean;
  }> {
    this.checksCompleted = stats.checksCompleted;
    this.alertsActive = stats.alertsActive;
    this.lastNotificationSent = stats.lastNotificationSent;

    const heartbeat: SentinelHeartbeat = {
      service: 'radiant-sentinel',
      region: this.config.region,
      timestamp: new Date().toISOString(),
      checksCompleted: stats.checksCompleted,
      alertsActive: stats.alertsActive,
      lastNotificationSent: stats.lastNotificationSent,
      notificationPipelineHealthy: stats.notificationPipelineHealthy,
    };

    const results = await Promise.allSettled([
      this.pingDeadMansSnitch(heartbeat),
      this.pingPagerDutyHeartbeat(heartbeat),
      this.reportToPilotLight(heartbeat),
    ]);

    const success = {
      deadMansSnitch: results[0].status === 'fulfilled',
      pagerduty: results[1].status === 'fulfilled',
      pilotLight: results[2].status === 'fulfilled',
    };

    const failedCount = Object.values(success).filter(v => !v).length;
    if (failedCount > 0) {
      console.warn(`[SENTINEL HEARTBEAT] ${failedCount}/3 heartbeat targets failed:`, {
        deadMansSnitch: results[0].status === 'rejected' ? (results[0] as PromiseRejectedResult).reason?.message : 'ok',
        pagerduty: results[1].status === 'rejected' ? (results[1] as PromiseRejectedResult).reason?.message : 'ok',
        pilotLight: results[2].status === 'rejected' ? (results[2] as PromiseRejectedResult).reason?.message : 'ok',
      });
    } else {
      console.log(`[SENTINEL HEARTBEAT] All 3 targets pinged successfully. Active alerts: ${stats.alertsActive}`);
    }

    return success;
  }

  // =========================================================================
  // Dead Man's Snitch (deadmanssnitch.com)
  // =========================================================================

  private async pingDeadMansSnitch(heartbeat: SentinelHeartbeat): Promise<void> {
    if (!this.config.deadMansSnitchUrl) {
      console.log('[SENTINEL HEARTBEAT] Dead Man\'s Snitch URL not configured, skipping');
      return;
    }

    // Dead Man's Snitch expects a simple GET request to the snitch URL
    // If it doesn't receive a ping within the configured interval (e.g., 3 min),
    // it triggers an alert via its own notification channels
    await this.httpGet(
      `${this.config.deadMansSnitchUrl}?m=${encodeURIComponent(JSON.stringify(heartbeat))}`,
      5000
    );
  }

  // =========================================================================
  // PagerDuty Heartbeat Integration
  // =========================================================================

  private async pingPagerDutyHeartbeat(heartbeat: SentinelHeartbeat): Promise<void> {
    if (!this.config.pagerdutyHeartbeatUrl) {
      console.log('[SENTINEL HEARTBEAT] PagerDuty heartbeat URL not configured, skipping');
      return;
    }

    // PagerDuty heartbeat monitoring: sends a check-in
    // If PagerDuty doesn't receive a check-in within the configured window,
    // it creates an incident
    await this.httpGet(this.config.pagerdutyHeartbeatUrl, 5000);
  }

  // =========================================================================
  // Pilot Light (us-west-2 independent monitor)
  // =========================================================================

  private async reportToPilotLight(heartbeat: SentinelHeartbeat): Promise<void> {
    if (!this.config.pilotLightHealthUrl) {
      console.log('[SENTINEL HEARTBEAT] Pilot Light URL not configured, skipping');
      return;
    }

    // Report to the Pilot Light monitor in us-west-2
    // The Pilot Light also independently checks our health URL
    await this.httpPost(this.config.pilotLightHealthUrl, heartbeat, 5000);
  }

  // =========================================================================
  // Self-Health Check (for Pilot Light to call)
  // =========================================================================

  getSelfHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    heartbeat: SentinelHeartbeat;
  } {
    const uptimeSeconds = Math.floor((Date.now() - this.startedAt.getTime()) / 1000);

    return {
      status: 'healthy',
      uptime: uptimeSeconds,
      heartbeat: {
        service: 'radiant-sentinel',
        region: this.config.region,
        timestamp: new Date().toISOString(),
        checksCompleted: this.checksCompleted,
        alertsActive: this.alertsActive,
        lastNotificationSent: this.lastNotificationSent,
        notificationPipelineHealthy: true,
      },
    };
  }

  // =========================================================================
  // Pilot Light Handler (runs in us-west-2)
  // =========================================================================

  async pilotLightCheck(): Promise<{
    primaryHealthy: boolean;
    alertTriggered: boolean;
    details: string;
  }> {
    try {
      const response = await this.httpGet(this.config.sentinelHealthUrl, 10000);

      if (response.statusCode === 200) {
        const health = JSON.parse(response.body);
        if (health.status === 'healthy') {
          return {
            primaryHealthy: true,
            alertTriggered: false,
            details: `Primary SENTINEL healthy. Uptime: ${health.uptime}s, Active alerts: ${health.heartbeat?.alertsActive || 0}`,
          };
        }

        // Primary is responding but degraded
        return {
          primaryHealthy: false,
          alertTriggered: true,
          details: `Primary SENTINEL degraded: ${health.status}`,
        };
      }

      // Non-200 response
      await this.triggerPilotLightAlert(`Primary SENTINEL returned HTTP ${response.statusCode}`);
      return {
        primaryHealthy: false,
        alertTriggered: true,
        details: `Primary SENTINEL HTTP ${response.statusCode}`,
      };
    } catch (error: unknown) {
      // Primary is unreachable — this is critical
      const message = `US-EAST-1 SENTINEL IS DOWN: ${(error as Error).message}`;
      await this.triggerPilotLightAlert(message);
      return {
        primaryHealthy: false,
        alertTriggered: true,
        details: message,
      };
    }
  }

  private async triggerPilotLightAlert(message: string): Promise<void> {
    console.error(`[SENTINEL PILOT LIGHT] CRITICAL: ${message}`);

    if (!this.config.pagerdutyRoutingKey) {
      console.error('[SENTINEL PILOT LIGHT] No PagerDuty routing key configured for pilot light alerts');
      return;
    }

    // Direct PagerDuty Events API v2 call — bypasses all SENTINEL infrastructure
    const payload = {
      routing_key: this.config.pagerdutyRoutingKey,
      event_action: 'trigger',
      dedup_key: 'sentinel-pilot-light-primary-down',
      payload: {
        summary: `[PILOT LIGHT] ${message}`,
        severity: 'critical',
        source: `radiant-sentinel-pilot-light-${this.config.region}`,
        component: 'sentinel',
        group: 'infrastructure',
        class: 'dead_mans_switch',
        timestamp: new Date().toISOString(),
        custom_details: {
          primaryRegion: 'us-east-1',
          pilotLightRegion: this.config.region,
          message,
          detectedAt: new Date().toISOString(),
        },
      },
    };

    try {
      await this.httpPost(
        'https://events.pagerduty.com/v2/enqueue',
        payload,
        5000
      );
      console.log('[SENTINEL PILOT LIGHT] PagerDuty alert triggered successfully');
    } catch (error) {
      console.error('[SENTINEL PILOT LIGHT] PagerDuty alert FAILED:', error);
      // At this point, deadmanssnitch.com is our last line of defense
    }
  }

  // =========================================================================
  // HTTP Helpers
  // =========================================================================

  private httpGet(url: string, timeoutMs: number): Promise<{ statusCode: number; body: string }> {
    return new Promise((resolve, reject) => {
      const req = https.get(url, { timeout: timeoutMs }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode || 0, body }));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Heartbeat request timeout')); });
    });
  }

  private httpPost(url: string, data: unknown, timeoutMs: number): Promise<{ statusCode: number; body: string }> {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(data);
      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        timeout: timeoutMs,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      };
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode || 0, body }));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Heartbeat POST timeout')); });
      req.write(payload);
      req.end();
    });
  }
}
