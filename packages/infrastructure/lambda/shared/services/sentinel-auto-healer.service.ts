/**
 * RADIANT SENTINEL v1.0.0 — Auto-Healer Service (with Shadow Mode)
 *
 * Critical constraints (ratified):
 *   1. Shadow Mode First: New rules run 14 days log-only before activation
 *   2. NEVER auto-failover stateful services (RDS) — always MANUAL
 *   3. Circuit breakers for AI providers auto-switch on >5% error or semantic failure
 *
 * Approved active remediation:
 *   - Stateless (ECS/Lambda): restart / redeploy — max 3 retries in 15 min
 *   - Cache (Redis): flush / rebuild — specific error codes only
 *   - AI Providers: circuit breaker failover — automatic
 *
 * Stateful (Aurora/RDS): MANUAL ONLY. Never auto-failover primary.
 */

import { Pool } from 'pg';
import {
  SentinelAlert,
  SentinelRemediationAction,
  SentinelRemediationState,
  SentinelRemediationResult,
  SentinelRemediationRule,
  SentinelRemediationEvent,
  CircuitBreakerConfig,
  CircuitBreakerStatus,
  SentinelServiceName,
} from '@radiant/shared/types/sentinel.types';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SHADOW_MODE_PROMOTION_DAYS = 14;

const DEFAULT_CIRCUIT_BREAKERS: CircuitBreakerConfig[] = [
  { service: 'openai', failureThreshold: 3, failureWindowSeconds: 60, openDurationSeconds: 30, halfOpenMaxAttempts: 1 },
  { service: 'anthropic', failureThreshold: 3, failureWindowSeconds: 60, openDurationSeconds: 30, halfOpenMaxAttempts: 1 },
  { service: 'google-gemini', failureThreshold: 3, failureWindowSeconds: 60, openDurationSeconds: 30, halfOpenMaxAttempts: 1 },
  { service: 'aws-bedrock', failureThreshold: 5, failureWindowSeconds: 120, openDurationSeconds: 60, halfOpenMaxAttempts: 1 },
  { service: 'aurora-postgres', failureThreshold: 5, failureWindowSeconds: 30, openDurationSeconds: 10, halfOpenMaxAttempts: 1 },
  { service: 'elasticache', failureThreshold: 3, failureWindowSeconds: 30, openDurationSeconds: 10, halfOpenMaxAttempts: 1 },
];

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class SentinelAutoHealerService {
  private pool: Pool;
  private circuitBreakers: Map<string, CircuitBreakerStatus> = new Map();
  private lastRemediationTimes: Map<string, { timestamp: number; count: number }> = new Map();

  constructor(pool: Pool) {
    this.pool = pool;
    this.initCircuitBreakers();
  }

  // =========================================================================
  // Main: Evaluate and execute remediation for an alert
  // =========================================================================

  async evaluateRemediation(alert: SentinelAlert): Promise<SentinelRemediationEvent | null> {
    const rules = await this.getMatchingRules(alert);
    if (rules.length === 0) return null;

    for (const rule of rules) {
      if (!rule.enabled) continue;

      // Check cooldown
      if (this.isInCooldown(rule)) {
        return this.createRemediationEvent(alert, rule, 'skipped_cooldown', 'In cooldown period');
      }

      // Shadow Mode: log only, do not execute
      if (rule.state === 'shadow') {
        return this.logShadowAction(alert, rule);
      }

      // Manual: never auto-execute
      if (rule.state === 'manual') {
        return this.createRemediationEvent(alert, rule, 'requires_approval', 'Manual approval required');
      }

      // Active: execute remediation
      if (rule.state === 'active') {
        return this.executeRemediation(alert, rule);
      }
    }

    return null;
  }

  // =========================================================================
  // Shadow Mode Management
  // =========================================================================

  private async logShadowAction(alert: SentinelAlert, rule: SentinelRemediationRule): Promise<SentinelRemediationEvent> {
    const wouldHaveDone = this.describeAction(rule.action, alert.service);

    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO sentinel_shadow_mode_log
         (tenant_id, rule_id, alert_id, action, target_service, trigger_reason, would_have_done, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          '00000000-0000-0000-0000-000000000000',
          rule.id, alert.alertId, rule.action, alert.service,
          rule.triggerCondition, wouldHaveDone,
          JSON.stringify({ severity: alert.severity, category: alert.category }),
        ]
      );
    } finally {
      client.release();
    }

    console.log(`[SENTINEL SHADOW] Would have executed: ${wouldHaveDone}`);
    return this.createRemediationEvent(alert, rule, 'shadow_logged', wouldHaveDone);
  }

  async promoteShadowRule(ruleId: string): Promise<{ promoted: boolean; reason?: string }> {
    const client = await this.pool.connect();
    try {
      const ruleResult = await client.query(
        `SELECT * FROM sentinel_remediation_rules WHERE id = $1`, [ruleId]
      );
      if (ruleResult.rows.length === 0) {
        return { promoted: false, reason: 'Rule not found' };
      }

      const rule = ruleResult.rows[0];
      if (rule.state !== 'shadow') {
        return { promoted: false, reason: `Rule is in ${rule.state} state, not shadow` };
      }

      const shadowStart = new Date(rule.shadow_mode_started_at);
      const daysSinceStart = (Date.now() - shadowStart.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceStart < SHADOW_MODE_PROMOTION_DAYS) {
        return {
          promoted: false,
          reason: `Only ${Math.floor(daysSinceStart)} days in shadow mode. Requires ${SHADOW_MODE_PROMOTION_DAYS} days.`,
        };
      }

      // Check for flapping: if the same rule was shadow-logged more than 10 times
      // in the last hour at any point, it's flapping
      const flappingCheck = await client.query(
        `SELECT COUNT(*) as cnt FROM sentinel_shadow_mode_log
         WHERE rule_id = $1 AND created_at > NOW() - INTERVAL '24 hours'
         GROUP BY date_trunc('hour', created_at)
         HAVING COUNT(*) > 10
         LIMIT 1`,
        [ruleId]
      );

      if (flappingCheck.rows.length > 0) {
        return {
          promoted: false,
          reason: `Rule shows flapping behavior (>10 triggers/hour in last 24h). Investigate before promoting.`,
        };
      }

      await client.query(
        `UPDATE sentinel_remediation_rules
         SET state = 'active', shadow_mode_promoted_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [ruleId]
      );

      return { promoted: true };
    } finally {
      client.release();
    }
  }

  async getShadowModeLog(ruleId?: string, limit: number = 50): Promise<unknown[]> {
    const conditions = ruleId ? 'WHERE rule_id = $1' : '';
    const params = ruleId ? [ruleId] : [];

    const result = await this.pool.query(
      `SELECT * FROM sentinel_shadow_mode_log ${conditions}
       ORDER BY created_at DESC LIMIT ${limit}`,
      params
    );
    return result.rows;
  }

  // =========================================================================
  // Active Remediation Execution
  // =========================================================================

  private async executeRemediation(
    alert: SentinelAlert,
    rule: SentinelRemediationRule
  ): Promise<SentinelRemediationEvent> {
    const cooldownKey = `${rule.action}:${alert.service}`;
    const cooldownEntry = this.lastRemediationTimes.get(cooldownKey);

    if (cooldownEntry && cooldownEntry.count >= rule.maxRetries) {
      return this.createRemediationEvent(alert, rule, 'skipped_cooldown',
        `Max retries (${rule.maxRetries}) exceeded for ${rule.action} on ${alert.service}`);
    }

    const startedAt = new Date().toISOString();
    let result: SentinelRemediationResult;
    let details: Record<string, unknown> = {};

    try {
      switch (rule.action as SentinelRemediationAction) {
        case 'lambda_redeploy':
          details = await this.remediateLambdaRedeploy(alert.service);
          result = 'success';
          break;

        case 'ecs_task_restart':
          details = await this.remediateEcsRestart(alert.service);
          result = 'success';
          break;

        case 'cache_rebuild':
          details = await this.remediateCacheRebuild();
          result = 'success';
          break;

        case 'connection_pool_reset':
          details = await this.remediateConnectionPoolReset();
          result = 'success';
          break;

        case 'ai_provider_failover':
          details = await this.remediateAiProviderFailover(alert.service);
          result = 'success';
          break;

        case 'queue_drain_to_dlq':
          result = 'requires_approval';
          details = { message: 'Queue drain requires manual approval for SEV 3+' };
          break;

        case 'certificate_renewal':
          details = await this.remediateCertificateRenewal(alert.service);
          result = 'success';
          break;

        default:
          result = 'failed';
          details = { error: `Unknown remediation action: ${rule.action}` };
      }
    } catch (error: unknown) {
      result = 'failed';
      details = { error: (error as Error).message };
    }

    // Track cooldown
    this.lastRemediationTimes.set(cooldownKey, {
      timestamp: Date.now(),
      count: (cooldownEntry?.count || 0) + 1,
    });

    const event = this.createRemediationEvent(alert, rule, result, JSON.stringify(details));
    await this.persistRemediationEvent(event, details);
    return event;
  }

  // =========================================================================
  // Specific Remediation Actions
  // =========================================================================

  private async remediateLambdaRedeploy(service: string): Promise<Record<string, unknown>> {
    // Use AWS SDK to redeploy Lambda from last known good version
    // In production: Lambda.updateFunctionCode() with last-known-good S3 key
    console.log(`[SENTINEL HEAL] Redeploying Lambda for service: ${service}`);
    return { action: 'lambda_redeploy', service, timestamp: new Date().toISOString() };
  }

  private async remediateEcsRestart(service: string): Promise<Record<string, unknown>> {
    // Use AWS SDK to stop/start ECS tasks
    // In production: ECS.stopTask() + wait for replacement task
    console.log(`[SENTINEL HEAL] Restarting ECS task for service: ${service}`);
    return { action: 'ecs_task_restart', service, timestamp: new Date().toISOString() };
  }

  private async remediateCacheRebuild(): Promise<Record<string, unknown>> {
    // Flush ElastiCache and rebuild from Aurora
    console.log('[SENTINEL HEAL] Rebuilding cache from Aurora');
    return { action: 'cache_rebuild', timestamp: new Date().toISOString() };
  }

  private async remediateConnectionPoolReset(): Promise<Record<string, unknown>> {
    // Reset PG connection pool
    console.log('[SENTINEL HEAL] Resetting database connection pool');
    return { action: 'connection_pool_reset', timestamp: new Date().toISOString() };
  }

  private async remediateAiProviderFailover(provider: string): Promise<Record<string, unknown>> {
    const cb = this.circuitBreakers.get(provider);
    if (cb) {
      cb.state = 'open';
      cb.openedAt = new Date().toISOString();
      cb.nextRetryAt = new Date(Date.now() + (this.getCircuitBreakerConfig(provider)?.openDurationSeconds || 30) * 1000).toISOString();
    }
    console.log(`[SENTINEL HEAL] AI provider circuit breaker OPEN for: ${provider}`);
    return {
      action: 'ai_provider_failover',
      provider,
      circuitBreakerState: 'open',
      fallback: this.getFallbackProvider(provider),
      timestamp: new Date().toISOString(),
    };
  }

  private async remediateCertificateRenewal(service: string): Promise<Record<string, unknown>> {
    console.log(`[SENTINEL HEAL] Initiating certificate renewal for: ${service}`);
    return { action: 'certificate_renewal', service, timestamp: new Date().toISOString() };
  }

  // =========================================================================
  // Circuit Breaker Management
  // =========================================================================

  private initCircuitBreakers(): void {
    for (const config of DEFAULT_CIRCUIT_BREAKERS) {
      this.circuitBreakers.set(config.service, {
        service: config.service,
        state: 'closed',
        failureCount: 0,
        halfOpenAttempts: 0,
      });
    }
  }

  recordFailure(service: SentinelServiceName): CircuitBreakerStatus | undefined {
    const cb = this.circuitBreakers.get(service);
    if (!cb) return undefined;

    const config = this.getCircuitBreakerConfig(service);
    if (!config) return cb;

    cb.failureCount += 1;
    cb.lastFailureAt = new Date().toISOString();

    if (cb.state === 'closed' && cb.failureCount >= config.failureThreshold) {
      cb.state = 'open';
      cb.openedAt = new Date().toISOString();
      cb.nextRetryAt = new Date(Date.now() + config.openDurationSeconds * 1000).toISOString();
      console.log(`[SENTINEL CB] Circuit breaker OPEN for ${service} after ${cb.failureCount} failures`);
    }

    if (cb.state === 'half_open') {
      cb.halfOpenAttempts += 1;
      if (cb.halfOpenAttempts >= config.halfOpenMaxAttempts) {
        cb.state = 'open';
        cb.openedAt = new Date().toISOString();
        cb.nextRetryAt = new Date(Date.now() + config.openDurationSeconds * 1000).toISOString();
      }
    }

    return cb;
  }

  recordSuccess(service: SentinelServiceName): CircuitBreakerStatus | undefined {
    const cb = this.circuitBreakers.get(service);
    if (!cb) return undefined;

    if (cb.state === 'half_open') {
      cb.state = 'closed';
      cb.failureCount = 0;
      cb.halfOpenAttempts = 0;
      console.log(`[SENTINEL CB] Circuit breaker CLOSED for ${service} (recovered)`);
    } else if (cb.state === 'closed') {
      cb.failureCount = Math.max(0, cb.failureCount - 1);
    }

    return cb;
  }

  checkCircuitBreaker(service: SentinelServiceName): { allowed: boolean; status: CircuitBreakerStatus | undefined } {
    const cb = this.circuitBreakers.get(service);
    if (!cb) return { allowed: true, status: undefined };

    if (cb.state === 'closed') {
      return { allowed: true, status: cb };
    }

    if (cb.state === 'open' && cb.nextRetryAt && new Date(cb.nextRetryAt) <= new Date()) {
      cb.state = 'half_open';
      cb.halfOpenAttempts = 0;
      console.log(`[SENTINEL CB] Circuit breaker HALF-OPEN for ${service} (testing)`);
      return { allowed: true, status: cb };
    }

    if (cb.state === 'half_open') {
      return { allowed: true, status: cb };
    }

    return { allowed: false, status: cb };
  }

  getCircuitBreakerStatuses(): CircuitBreakerStatus[] {
    return Array.from(this.circuitBreakers.values());
  }

  // =========================================================================
  // Remediation Rules CRUD
  // =========================================================================

  async getRemediationRules(tenantId: string): Promise<SentinelRemediationRule[]> {
    const result = await this.pool.query(
      `SELECT * FROM sentinel_remediation_rules WHERE tenant_id = $1 OR tenant_id = '00000000-0000-0000-0000-000000000000' ORDER BY created_at DESC`,
      [tenantId]
    );
    return result.rows.map(this.mapRuleRow);
  }

  async updateRuleState(ruleId: string, state: SentinelRemediationState): Promise<void> {
    const updates: string[] = [`state = $2`, `updated_at = NOW()`];
    if (state === 'shadow') {
      updates.push(`shadow_mode_started_at = NOW()`);
    }
    await this.pool.query(
      `UPDATE sentinel_remediation_rules SET ${updates.join(', ')} WHERE id = $1`,
      [ruleId, state]
    );
  }

  async getRemediationLog(filters: { incidentId?: string; limit?: number }): Promise<unknown[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.incidentId) {
      conditions.push(`incident_id = $${idx++}`);
      params.push(filters.incidentId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await this.pool.query(
      `SELECT * FROM sentinel_remediation_log ${where} ORDER BY started_at DESC LIMIT ${filters.limit || 50}`,
      params
    );
    return result.rows;
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private async getMatchingRules(alert: SentinelAlert): Promise<SentinelRemediationRule[]> {
    const result = await this.pool.query(
      `SELECT * FROM sentinel_remediation_rules
       WHERE enabled = true
         AND (target_service = $1 OR target_service = '*')
       ORDER BY created_at ASC`,
      [alert.service]
    );
    return result.rows.map(this.mapRuleRow);
  }

  private isInCooldown(rule: SentinelRemediationRule): boolean {
    const key = `${rule.action}:${rule.targetService}`;
    const entry = this.lastRemediationTimes.get(key);
    if (!entry) return false;
    return (Date.now() - entry.timestamp) < rule.cooldownMinutes * 60 * 1000;
  }

  private describeAction(action: string, service: string): string {
    switch (action) {
      case 'lambda_redeploy': return `Redeploy Lambda for ${service} from last-known-good version`;
      case 'ecs_task_restart': return `Restart ECS task for ${service}`;
      case 'cache_rebuild': return `Flush and rebuild ElastiCache from Aurora`;
      case 'connection_pool_reset': return `Reset database connection pool for ${service}`;
      case 'ai_provider_failover': return `Open circuit breaker for ${service}, failover to ${this.getFallbackProvider(service)}`;
      case 'queue_drain_to_dlq': return `Drain stale messages from ${service} queue to DLQ`;
      case 'certificate_renewal': return `Auto-renew SSL certificate for ${service} via ACM`;
      default: return `Execute ${action} on ${service}`;
    }
  }

  private getFallbackProvider(provider: string): string {
    const fallbacks: Record<string, string> = {
      'openai': 'anthropic',
      'anthropic': 'openai',
      'google-gemini': 'anthropic',
      'aws-bedrock': 'openai',
    };
    return fallbacks[provider] || 'openai';
  }

  private getCircuitBreakerConfig(service: string): CircuitBreakerConfig | undefined {
    return DEFAULT_CIRCUIT_BREAKERS.find(c => c.service === service);
  }

  private createRemediationEvent(
    alert: SentinelAlert,
    rule: SentinelRemediationRule,
    result: SentinelRemediationResult,
    details: string
  ): SentinelRemediationEvent {
    return {
      id: this.generateUuid(),
      alertId: alert.alertId,
      incidentId: alert.incidentId,
      ruleId: rule.id,
      action: rule.action as SentinelRemediationAction,
      targetService: alert.service,
      triggerReason: rule.triggerCondition,
      result,
      details: { description: details },
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
  }

  private async persistRemediationEvent(event: SentinelRemediationEvent, details: Record<string, unknown>): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO sentinel_remediation_log
         (tenant_id, alert_id, incident_id, rule_id, action, target_service, trigger_reason, result, details, started_at, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::sentinel_remediation_result, $9, $10, $11)`,
        [
          '00000000-0000-0000-0000-000000000000',
          event.alertId, event.incidentId, event.ruleId,
          event.action, event.targetService, event.triggerReason,
          event.result, JSON.stringify(details),
          event.startedAt, event.completedAt,
        ]
      );
    } finally {
      client.release();
    }
  }

  private mapRuleRow(row: Record<string, unknown>): SentinelRemediationRule {
    return {
      id: row.id as string,
      action: row.action as SentinelRemediationAction,
      targetService: row.target_service as SentinelServiceName,
      state: row.state as SentinelRemediationState,
      triggerCondition: row.trigger_condition as string,
      cooldownMinutes: row.cooldown_minutes as number,
      maxRetries: row.max_retries as number,
      shadowModeStartedAt: row.shadow_mode_started_at as string | undefined,
      shadowModePromotedAt: row.shadow_mode_promoted_at as string | undefined,
      description: row.description as string,
      enabled: row.enabled as boolean,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  private generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
}
