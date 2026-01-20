// RADIANT v4.18.0 - Security Signals Service (SSF/CAEP Integration)
// Shared Signals Framework & Continuous Access Evaluation
// Novel UI: "Security Shield" - real-time threat visualization

import { executeStatement, stringParam, longParam, boolParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

export interface SecuritySignal {
  id: string;
  tenantId: string;
  type: SignalType;
  severity: SignalSeverity;
  source: SignalSource;
  subject: SignalSubject;
  event: SecurityEvent;
  context: SignalContext;
  actions: SignalAction[];
  status: SignalStatus;
  resolvedAt?: string;
  resolvedBy?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type SignalType =
  | 'session_revoked' | 'credential_change' | 'token_claims_change'
  | 'device_compliance' | 'risk_change' | 'assurance_level_change'
  | 'anomaly_detected' | 'threat_detected' | 'policy_violation';

export type SignalSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type SignalSource = 'identity_provider' | 'device_management' | 'threat_intelligence' | 'behavioral_analytics' | 'manual_report' | 'automated_scan';
export type SignalStatus = 'active' | 'investigating' | 'resolved' | 'dismissed';

export interface SignalSubject {
  type: 'user' | 'session' | 'device' | 'application';
  id: string;
  name?: string;
  email?: string;
}

export interface SecurityEvent {
  type: string;
  timestamp: string;
  description: string;
  details: Record<string, unknown>;
  indicators?: string[];
}

export interface SignalContext {
  ipAddress?: string;
  userAgent?: string;
  location?: { country?: string; region?: string; city?: string };
  deviceId?: string;
  sessionId?: string;
  riskScore?: number;
}

export interface SignalAction {
  type: ActionType;
  status: 'pending' | 'executed' | 'failed' | 'skipped';
  executedAt?: string;
  result?: string;
}

export type ActionType = 'notify_admin' | 'notify_user' | 'revoke_session' | 'require_mfa' | 'block_access' | 'quarantine' | 'log_only' | 'escalate';

export interface SecurityPolicy {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  enabled: boolean;
  triggers: PolicyTrigger[];
  actions: ActionType[];
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyTrigger {
  signalType: SignalType;
  severityThreshold: SignalSeverity;
  conditions?: Record<string, unknown>;
}

export interface SecurityDashboard {
  shieldStatus: 'secure' | 'warning' | 'alert' | 'critical';
  activeSignals: number;
  criticalSignals: number;
  signalsToday: number;
  riskLevel: 'low' | 'moderate' | 'elevated' | 'high' | 'critical';
  recentSignals: SecuritySignal[];
  signalsByType: Record<string, number>;
  signalsBySeverity: Record<string, number>;
}

// ============================================================================
// Security Signals Service
// ============================================================================

class SecuritySignalsService {
  // --------------------------------------------------------------------------
  // Signal Management
  // --------------------------------------------------------------------------

  async createSignal(
    tenantId: string,
    signal: Omit<SecuritySignal, 'id' | 'tenantId' | 'status' | 'actions' | 'createdAt' | 'updatedAt'>
  ): Promise<SecuritySignal> {
    try {
      const id = `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Get matching policies for automatic actions
      const policies = await this.getMatchingPolicies(tenantId, signal.type, signal.severity);
      const actions: SignalAction[] = [];
      for (const policy of policies) {
        for (const actionType of policy.actions) {
          actions.push({ type: actionType, status: 'pending' });
        }
      }

      await executeStatement(
        `INSERT INTO security_signals (id, tenant_id, type, severity, source, subject, event, context, actions, status, metadata, created_at, updated_at)
          VALUES (:id, :tenantId, :type, :severity, :source, :subject, :event, :context, :actions, 'active', :metadata, NOW(), NOW())`,
        [
          stringParam('id', id),
          stringParam('tenantId', tenantId),
          stringParam('type', signal.type),
          stringParam('severity', signal.severity),
          stringParam('source', signal.source),
          stringParam('subject', JSON.stringify(signal.subject)),
          stringParam('event', JSON.stringify(signal.event)),
          stringParam('context', JSON.stringify(signal.context)),
          stringParam('actions', JSON.stringify(actions)),
          stringParam('metadata', JSON.stringify(signal.metadata || {})),
        ]
      );

      logger.warn('Security signal created', { tenantId, id, type: signal.type, severity: signal.severity });

      const createdSignal: SecuritySignal = {
        id,
        tenantId,
        ...signal,
        actions,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Execute automatic actions
      await this.executeActions(createdSignal);

      return createdSignal;
    } catch (error) {
      logger.error('Failed to create security signal', { tenantId, error });
      throw error;
    }
  }

  async getSignal(tenantId: string, signalId: string): Promise<SecuritySignal | null> {
    try {
      const result = await executeStatement(
        `SELECT * FROM security_signals WHERE tenant_id = :tenantId AND id = :signalId`,
        [stringParam('tenantId', tenantId), stringParam('signalId', signalId)]
      );

      if (result.rows && result.rows.length > 0) {
        return this.parseSignal(result.rows[0] as Record<string, unknown>);
      }
      return null;
    } catch (error) {
      logger.error('Failed to get security signal', { tenantId, signalId, error });
      throw error;
    }
  }

  async listSignals(
    tenantId: string,
    options: { type?: SignalType; severity?: SignalSeverity; status?: SignalStatus; limit?: number; offset?: number } = {}
  ): Promise<{ signals: SecuritySignal[]; total: number }> {
    try {
      let sql = `SELECT * FROM security_signals WHERE tenant_id = :tenantId`;
      let countSql = `SELECT COUNT(*) as total FROM security_signals WHERE tenant_id = :tenantId`;
      const params = [stringParam('tenantId', tenantId)];

      if (options.type) {
        sql += ` AND type = :type`;
        countSql += ` AND type = :type`;
        params.push(stringParam('type', options.type));
      }
      if (options.severity) {
        sql += ` AND severity = :severity`;
        countSql += ` AND severity = :severity`;
        params.push(stringParam('severity', options.severity));
      }
      if (options.status) {
        sql += ` AND status = :status`;
        countSql += ` AND status = :status`;
        params.push(stringParam('status', options.status));
      }

      sql += ` ORDER BY created_at DESC`;
      const limitParams = [...params];
      if (options.limit) {
        sql += ` LIMIT :limit`;
        limitParams.push(longParam('limit', options.limit));
      }
      if (options.offset) {
        sql += ` OFFSET :offset`;
        limitParams.push(longParam('offset', options.offset));
      }

      const [result, countResult] = await Promise.all([
        executeStatement(sql, limitParams),
        executeStatement(countSql, params),
      ]);

      const signals = (result.rows || []).map(row => this.parseSignal(row as Record<string, unknown>));
      const total = Number((countResult.rows?.[0] as Record<string, unknown>)?.total) || 0;

      return { signals, total };
    } catch (error) {
      logger.error('Failed to list security signals', { tenantId, error });
      throw error;
    }
  }

  async updateSignalStatus(tenantId: string, signalId: string, status: SignalStatus, resolvedBy?: string): Promise<SecuritySignal | null> {
    try {
      const resolvedAt = (status === 'resolved' || status === 'dismissed') ? 'NOW()' : 'NULL';

      await executeStatement(
        `UPDATE security_signals SET status = :status, resolved_at = ${resolvedAt}, resolved_by = :resolvedBy, updated_at = NOW()
          WHERE tenant_id = :tenantId AND id = :signalId`,
        [
          stringParam('status', status),
          stringParam('resolvedBy', resolvedBy || ''),
          stringParam('tenantId', tenantId),
          stringParam('signalId', signalId),
        ]
      );

      return this.getSignal(tenantId, signalId);
    } catch (error) {
      logger.error('Failed to update signal status', { tenantId, signalId, error });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Policy Management
  // --------------------------------------------------------------------------

  async createPolicy(
    tenantId: string,
    policy: Omit<SecurityPolicy, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>
  ): Promise<SecurityPolicy> {
    try {
      const id = `policy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await executeStatement(
        `INSERT INTO security_policies (id, tenant_id, name, description, enabled, triggers, actions, priority, created_at, updated_at)
          VALUES (:id, :tenantId, :name, :description, :enabled, :triggers, :actions, :priority, NOW(), NOW())`,
        [
          stringParam('id', id),
          stringParam('tenantId', tenantId),
          stringParam('name', policy.name),
          stringParam('description', policy.description || ''),
          boolParam('enabled', policy.enabled),
          stringParam('triggers', JSON.stringify(policy.triggers)),
          stringParam('actions', JSON.stringify(policy.actions)),
          longParam('priority', policy.priority || 5),
        ]
      );

      return {
        id,
        tenantId,
        ...policy,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to create security policy', { tenantId, error });
      throw error;
    }
  }

  async listPolicies(tenantId: string): Promise<SecurityPolicy[]> {
    try {
      const result = await executeStatement(
        `SELECT * FROM security_policies WHERE tenant_id = :tenantId ORDER BY priority ASC`,
        [stringParam('tenantId', tenantId)]
      );

      return (result.rows || []).map(row => this.parsePolicy(row as Record<string, unknown>));
    } catch (error) {
      logger.error('Failed to list security policies', { tenantId, error });
      throw error;
    }
  }

  async updatePolicy(tenantId: string, policyId: string, updates: Partial<SecurityPolicy>): Promise<SecurityPolicy | null> {
    try {
      const existing = await this.getPolicy(tenantId, policyId);
      if (!existing) return null;

      const merged = { ...existing, ...updates };

      await executeStatement(
        `UPDATE security_policies SET name = :name, description = :description, enabled = :enabled, triggers = :triggers, actions = :actions, priority = :priority, updated_at = NOW()
          WHERE tenant_id = :tenantId AND id = :policyId`,
        [
          stringParam('name', merged.name),
          stringParam('description', merged.description),
          boolParam('enabled', merged.enabled),
          stringParam('triggers', JSON.stringify(merged.triggers)),
          stringParam('actions', JSON.stringify(merged.actions)),
          longParam('priority', merged.priority),
          stringParam('tenantId', tenantId),
          stringParam('policyId', policyId),
        ]
      );

      return { ...merged, updatedAt: new Date().toISOString() };
    } catch (error) {
      logger.error('Failed to update security policy', { tenantId, policyId, error });
      throw error;
    }
  }

  async getPolicy(tenantId: string, policyId: string): Promise<SecurityPolicy | null> {
    try {
      const result = await executeStatement(
        `SELECT * FROM security_policies WHERE tenant_id = :tenantId AND id = :policyId`,
        [stringParam('tenantId', tenantId), stringParam('policyId', policyId)]
      );

      if (result.rows && result.rows.length > 0) {
        return this.parsePolicy(result.rows[0] as Record<string, unknown>);
      }
      return null;
    } catch (error) {
      logger.error('Failed to get security policy', { tenantId, policyId, error });
      throw error;
    }
  }

  async deletePolicy(tenantId: string, policyId: string): Promise<boolean> {
    try {
      const result = await executeStatement(
        `DELETE FROM security_policies WHERE tenant_id = :tenantId AND id = :policyId`,
        [stringParam('tenantId', tenantId), stringParam('policyId', policyId)]
      );
      return (result.rowCount || 0) > 0;
    } catch (error) {
      logger.error('Failed to delete security policy', { tenantId, policyId, error });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Dashboard
  // --------------------------------------------------------------------------

  async getDashboard(tenantId: string): Promise<SecurityDashboard> {
    try {
      const activeResult = await executeStatement(
        `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE severity = 'critical') as critical
          FROM security_signals WHERE tenant_id = :tenantId AND status = 'active'`,
        [stringParam('tenantId', tenantId)]
      );

      const todayResult = await executeStatement(
        `SELECT COUNT(*) as total FROM security_signals
          WHERE tenant_id = :tenantId AND created_at > NOW() - INTERVAL '1 day'`,
        [stringParam('tenantId', tenantId)]
      );

      const { signals: recentSignals } = await this.listSignals(tenantId, { limit: 10 });

      const activeRow = activeResult.rows?.[0] as Record<string, unknown> | undefined;
      const todayRow = todayResult.rows?.[0] as Record<string, unknown> | undefined;

      const activeSignals = Number(activeRow?.total) || 0;
      const criticalSignals = Number(activeRow?.critical) || 0;
      const signalsToday = Number(todayRow?.total) || 0;

      const riskLevel = this.calculateRiskLevel(activeSignals, criticalSignals);
      const shieldStatus = this.calculateShieldStatus(criticalSignals, activeSignals);

      return {
        shieldStatus,
        activeSignals,
        criticalSignals,
        signalsToday,
        riskLevel,
        recentSignals,
        signalsByType: {},
        signalsBySeverity: {},
      };
    } catch (error) {
      logger.error('Failed to get security dashboard', { tenantId, error });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // SSF/CAEP Event Ingestion
  // --------------------------------------------------------------------------

  async ingestSSFEvent(tenantId: string, event: { type: string; subject: { format: string; value: string }; claims: Record<string, unknown>; timestamp: string }): Promise<SecuritySignal> {
    const typeMapping: Record<string, SignalType> = {
      'session-revoked': 'session_revoked',
      'token-claims-change': 'token_claims_change',
      'credential-change': 'credential_change',
    };

    return this.createSignal(tenantId, {
      type: typeMapping[event.type] || 'anomaly_detected',
      severity: 'medium',
      source: 'identity_provider',
      subject: { type: 'user', id: event.subject.value },
      event: { type: event.type, timestamp: event.timestamp, description: `SSF Event: ${event.type}`, details: event.claims },
      context: {},
      metadata: { ssfEvent: true },
    });
  }

  async ingestCAEPEvent(tenantId: string, event: { type: string; subject: { user?: string; device?: string }; reason?: string; riskLevel?: number; timestamp: string }): Promise<SecuritySignal> {
    const typeMapping: Record<string, SignalType> = {
      'device-compliance-change': 'device_compliance',
      'risk-change': 'risk_change',
      'assurance-level-change': 'assurance_level_change',
    };

    return this.createSignal(tenantId, {
      type: typeMapping[event.type] || 'risk_change',
      severity: this.riskToSeverity(event.riskLevel || 50),
      source: 'device_management',
      subject: { type: event.subject.device ? 'device' : 'user', id: event.subject.device || event.subject.user || 'unknown' },
      event: { type: event.type, timestamp: event.timestamp, description: event.reason || `CAEP Event: ${event.type}`, details: { riskLevel: event.riskLevel } },
      context: { riskScore: event.riskLevel },
      metadata: { caepEvent: true },
    });
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private async getMatchingPolicies(tenantId: string, signalType: SignalType, severity: SignalSeverity): Promise<SecurityPolicy[]> {
    const policies = await this.listPolicies(tenantId);
    const severityOrder: SignalSeverity[] = ['info', 'low', 'medium', 'high', 'critical'];

    return policies.filter(policy => {
      if (!policy.enabled) return false;
      return policy.triggers.some(trigger => {
        if (trigger.signalType !== signalType) return false;
        const triggerIdx = severityOrder.indexOf(trigger.severityThreshold);
        const signalIdx = severityOrder.indexOf(severity);
        return signalIdx >= triggerIdx;
      });
    });
  }

  private async executeActions(signal: SecuritySignal): Promise<void> {
    for (const action of signal.actions) {
      try {
        if (action.type === 'notify_admin' || action.type === 'log_only') {
          logger.warn(`Security alert: ${signal.type}`, { signalId: signal.id, severity: signal.severity });
          action.status = 'executed';
        } else {
          action.status = 'pending';
        }
        action.executedAt = new Date().toISOString();
      } catch {
        action.status = 'failed';
      }
    }

    await executeStatement(
      `UPDATE security_signals SET actions = :actions, updated_at = NOW() WHERE id = :signalId`,
      [stringParam('actions', JSON.stringify(signal.actions)), stringParam('signalId', signal.id)]
    );
  }

  private calculateRiskLevel(active: number, critical: number): 'low' | 'moderate' | 'elevated' | 'high' | 'critical' {
    if (critical >= 3) return 'critical';
    if (critical >= 1 || active >= 10) return 'high';
    if (active >= 5) return 'elevated';
    if (active >= 1) return 'moderate';
    return 'low';
  }

  private calculateShieldStatus(critical: number, active: number): 'secure' | 'warning' | 'alert' | 'critical' {
    if (critical >= 1) return 'critical';
    if (active >= 5) return 'alert';
    if (active >= 1) return 'warning';
    return 'secure';
  }

  private riskToSeverity(risk: number): SignalSeverity {
    if (risk >= 90) return 'critical';
    if (risk >= 70) return 'high';
    if (risk >= 50) return 'medium';
    if (risk >= 30) return 'low';
    return 'info';
  }

  private parseSignal(row: Record<string, unknown>): SecuritySignal {
    return {
      id: String(row.id || ''),
      tenantId: String(row.tenant_id || ''),
      type: String(row.type || 'anomaly_detected') as SignalType,
      severity: String(row.severity || 'medium') as SignalSeverity,
      source: String(row.source || 'manual_report') as SignalSource,
      subject: this.parseJson(row.subject) || { type: 'user', id: 'unknown' },
      event: this.parseJson(row.event) || { type: '', timestamp: '', description: '', details: {} },
      context: this.parseJson(row.context) || {},
      actions: this.parseJson(row.actions) || [],
      status: String(row.status || 'active') as SignalStatus,
      resolvedAt: row.resolved_at ? String(row.resolved_at) : undefined,
      resolvedBy: row.resolved_by ? String(row.resolved_by) : undefined,
      metadata: this.parseJson(row.metadata) || {},
      createdAt: String(row.created_at || ''),
      updatedAt: String(row.updated_at || ''),
    };
  }

  private parsePolicy(row: Record<string, unknown>): SecurityPolicy {
    return {
      id: String(row.id || ''),
      tenantId: String(row.tenant_id || ''),
      name: String(row.name || ''),
      description: String(row.description || ''),
      enabled: Boolean(row.enabled),
      triggers: this.parseJson(row.triggers) || [],
      actions: this.parseJson(row.actions) || [],
      priority: Number(row.priority) || 5,
      createdAt: String(row.created_at || ''),
      updatedAt: String(row.updated_at || ''),
    };
  }

  private parseJson<T>(value: unknown): T | null {
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return null; }
    }
    return value as T;
  }
}

export const securitySignalsService = new SecuritySignalsService();
