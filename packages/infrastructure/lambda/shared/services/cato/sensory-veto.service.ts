/**
 * RADIANT Genesis Cato Sensory Veto Service
 * Provides hard stops that cannot be overridden
 *
 * Veto signals are emergency stops triggered by critical system events.
 * Unlike CBF violations which can trigger recovery, vetos are absolute.
 * 
 * Integrates with CloudWatch Alarms for automatic veto activation.
 */

import { query } from '../database';
import { CloudWatchClient, DescribeAlarmsCommand, StateValue } from '@aws-sdk/client-cloudwatch';
import { VetoSignal, VetoResult, VetoSeverity, ExecutionContext } from './types';

// Active veto signals (updated by monitoring systems and CloudWatch)
const activeVetoSignals: Map<string, VetoSignal[]> = new Map();

// CloudWatch client (lazy initialized)
let cloudWatchClient: CloudWatchClient | null = null;

const getCloudWatchClient = (): CloudWatchClient => {
  if (!cloudWatchClient) {
    cloudWatchClient = new CloudWatchClient({ region: process.env.AWS_REGION || 'us-east-1' });
  }
  return cloudWatchClient;
};

// CloudWatch alarm to veto signal mapping
const CLOUDWATCH_ALARM_MAPPING: Record<string, {
  signal: keyof typeof VETO_SIGNALS;
  severity: VetoSeverity;
}> = {
  'radiant-system-cpu-critical': { signal: 'SYSTEM_OVERLOAD', severity: 'emergency' },
  'radiant-system-memory-critical': { signal: 'SYSTEM_OVERLOAD', severity: 'emergency' },
  'radiant-security-breach': { signal: 'DATA_BREACH_DETECTED', severity: 'emergency' },
  'radiant-compliance-alert': { signal: 'COMPLIANCE_VIOLATION', severity: 'critical' },
  'radiant-anomaly-detection': { signal: 'ANOMALY_DETECTED', severity: 'warning' },
  'radiant-model-health': { signal: 'MODEL_UNAVAILABLE', severity: 'warning' },
};

// Veto signal definitions
const VETO_SIGNALS = {
  SYSTEM_OVERLOAD: {
    signal: 'SYSTEM_OVERLOAD',
    severity: 'emergency' as VetoSeverity,
    description: 'System resources critically overloaded',
  },
  DATA_BREACH_DETECTED: {
    signal: 'DATA_BREACH_DETECTED',
    severity: 'emergency' as VetoSeverity,
    description: 'Potential data breach detected',
  },
  COMPLIANCE_VIOLATION: {
    signal: 'COMPLIANCE_VIOLATION',
    severity: 'critical' as VetoSeverity,
    description: 'Regulatory compliance violation detected',
  },
  ANOMALY_DETECTED: {
    signal: 'ANOMALY_DETECTED',
    severity: 'warning' as VetoSeverity,
    description: 'Behavioral anomaly detected',
  },
  TENANT_SUSPENDED: {
    signal: 'TENANT_SUSPENDED',
    severity: 'emergency' as VetoSeverity,
    description: 'Tenant account suspended',
  },
  MODEL_UNAVAILABLE: {
    signal: 'MODEL_UNAVAILABLE',
    severity: 'warning' as VetoSeverity,
    description: 'Required model is unavailable',
  },
};

export class SensoryVetoService {
  /**
   * Check for active veto signals
   */
  async checkVetoSignals(context: ExecutionContext): Promise<VetoResult> {
    const tenantVetos = activeVetoSignals.get(context.tenantId) || [];
    const globalVetos = activeVetoSignals.get('global') || [];

    const allVetos = [...tenantVetos, ...globalVetos];
    const activeVetos = allVetos.filter((v) => this.isVetoActive(v));

    if (activeVetos.length === 0) {
      return {
        hasActiveVeto: false,
        activeVetos: [],
        enforcedGamma: 0,
        escalated: false,
      };
    }

    // Find highest severity veto
    const maxSeverity = this.getMaxSeverity(activeVetos);
    const enforcedGamma = this.getGammaForSeverity(maxSeverity);
    const shouldEscalate = maxSeverity === 'emergency';

    // Record veto event
    for (const veto of activeVetos) {
      await this.recordVetoEvent(context.tenantId, context.sessionId, veto, enforcedGamma);
    }

    return {
      hasActiveVeto: true,
      activeVetos,
      enforcedGamma,
      escalated: shouldEscalate,
    };
  }

  /**
   * Activate a veto signal
   */
  activateVeto(
    scope: string, // tenantId or 'global'
    signal: keyof typeof VETO_SIGNALS,
    source: string
  ): void {
    const signalDef = VETO_SIGNALS[signal];
    const vetoSignal: VetoSignal = {
      signal: signalDef.signal,
      severity: signalDef.severity,
      source,
      timestamp: Date.now(),
    };

    const existing = activeVetoSignals.get(scope) || [];
    existing.push(vetoSignal);
    activeVetoSignals.set(scope, existing);

    console.warn(`[CATO Veto] Activated: ${signal} for ${scope} from ${source}`);
  }

  /**
   * Deactivate a veto signal
   */
  deactivateVeto(scope: string, signal: string): void {
    const existing = activeVetoSignals.get(scope) || [];
    const filtered = existing.filter((v) => v.signal !== signal);
    activeVetoSignals.set(scope, filtered);

    console.log(`[CATO Veto] Deactivated: ${signal} for ${scope}`);
  }

  /**
   * Check if a veto is still active (not expired)
   */
  private isVetoActive(veto: VetoSignal): boolean {
    const maxAge = this.getMaxAgeForSeverity(veto.severity);
    return Date.now() - veto.timestamp < maxAge;
  }

  /**
   * Get maximum age for veto severity
   */
  private getMaxAgeForSeverity(severity: VetoSeverity): number {
    switch (severity) {
      case 'emergency':
        return 24 * 60 * 60 * 1000; // 24 hours
      case 'critical':
        return 60 * 60 * 1000; // 1 hour
      case 'warning':
        return 5 * 60 * 1000; // 5 minutes
      default:
        return 5 * 60 * 1000;
    }
  }

  /**
   * Get maximum severity from list of vetos
   */
  private getMaxSeverity(vetos: VetoSignal[]): VetoSeverity {
    const severityOrder: VetoSeverity[] = ['warning', 'critical', 'emergency'];
    let maxIndex = 0;

    for (const veto of vetos) {
      const index = severityOrder.indexOf(veto.severity);
      if (index > maxIndex) {
        maxIndex = index;
      }
    }

    return severityOrder[maxIndex];
  }

  /**
   * Get enforced gamma for severity
   */
  private getGammaForSeverity(severity: VetoSeverity): number {
    switch (severity) {
      case 'emergency':
        return 0.1; // Almost no confidence
      case 'critical':
        return 0.5; // Very limited confidence
      case 'warning':
        return 1.0; // Reduced confidence
      default:
        return 1.0;
    }
  }

  /**
   * Record veto event to database
   */
  private async recordVetoEvent(
    tenantId: string,
    sessionId: string,
    veto: VetoSignal,
    enforcedGamma: number
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO cato_veto_log (
          tenant_id, session_id, signal, action_taken, enforced_gamma, context, escalated
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          tenantId,
          sessionId,
          veto.signal,
          'BLOCKED',
          enforcedGamma,
          JSON.stringify({
            severity: veto.severity,
            source: veto.source,
            timestamp: veto.timestamp,
          }),
          veto.severity === 'emergency',
        ]
      );
    } catch (error) {
      console.error('[CATO Veto] Failed to record event:', error);
    }
  }

  /**
   * Get active vetos for a tenant
   */
  getActiveVetos(tenantId: string): VetoSignal[] {
    const tenantVetos = activeVetoSignals.get(tenantId) || [];
    const globalVetos = activeVetoSignals.get('global') || [];
    return [...tenantVetos, ...globalVetos].filter((v) => this.isVetoActive(v));
  }

  /**
   * Clear all vetos for a tenant (admin action)
   */
  clearTenantVetos(tenantId: string): void {
    activeVetoSignals.delete(tenantId);
    console.log(`[CATO Veto] Cleared all vetos for tenant ${tenantId}`);
  }

  /**
   * Sync veto signals from CloudWatch Alarms
   * Should be called periodically or on-demand
   */
  async syncFromCloudWatch(): Promise<void> {
    const alarmPrefix = process.env.CATO_CLOUDWATCH_ALARM_PREFIX || 'radiant-';
    
    try {
      const command = new DescribeAlarmsCommand({
        AlarmNamePrefix: alarmPrefix,
        StateValue: StateValue.ALARM,
      });

      const response = await getCloudWatchClient().send(command);
      const alarmsInAlarm = response.MetricAlarms || [];

      // Clear CloudWatch-sourced vetos first
      this.clearCloudWatchVetos();

      // Process each alarm in ALARM state
      for (const alarm of alarmsInAlarm) {
        const alarmName = alarm.AlarmName || '';
        const mapping = CLOUDWATCH_ALARM_MAPPING[alarmName];

        if (mapping) {
          this.activateVeto('global', mapping.signal, `CloudWatch:${alarmName}`);
          console.log(`[CATO Veto] Activated from CloudWatch alarm: ${alarmName}`);
        } else {
          // Check for tenant-specific alarms (pattern: radiant-{tenantId}-{type})
          const tenantMatch = alarmName.match(/^radiant-([a-z0-9-]+)-(cpu|memory|quota)/);
          if (tenantMatch) {
            const tenantId = tenantMatch[1];
            const alarmType = tenantMatch[2];
            
            let signal: keyof typeof VETO_SIGNALS = 'SYSTEM_OVERLOAD';
            if (alarmType === 'quota') {
              signal = 'TENANT_SUSPENDED';
            }
            
            this.activateVeto(tenantId, signal, `CloudWatch:${alarmName}`);
            console.log(`[CATO Veto] Activated tenant veto from CloudWatch: ${alarmName}`);
          }
        }
      }

      console.log(`[CATO Veto] CloudWatch sync complete. ${alarmsInAlarm.length} alarms in ALARM state.`);
    } catch (error) {
      console.error('[CATO Veto] CloudWatch sync failed:', error);
    }
  }

  /**
   * Clear vetos that came from CloudWatch (for re-sync)
   */
  private clearCloudWatchVetos(): void {
    for (const [scope, vetos] of activeVetoSignals) {
      const filtered = vetos.filter(v => !v.source.startsWith('CloudWatch:'));
      if (filtered.length === 0) {
        activeVetoSignals.delete(scope);
      } else {
        activeVetoSignals.set(scope, filtered);
      }
    }
  }

  /**
   * Check if CloudWatch integration is enabled
   */
  isCloudWatchEnabled(): boolean {
    return !!process.env.CATO_CLOUDWATCH_ALARM_PREFIX;
  }

  /**
   * Handle CloudWatch Alarm state change (called from SNS/EventBridge)
   */
  async handleAlarmStateChange(event: {
    alarmName: string;
    newState: 'ALARM' | 'OK' | 'INSUFFICIENT_DATA';
    reason?: string;
  }): Promise<void> {
    const { alarmName, newState, reason } = event;
    const mapping = CLOUDWATCH_ALARM_MAPPING[alarmName];

    if (newState === 'ALARM') {
      if (mapping) {
        this.activateVeto('global', mapping.signal, `CloudWatch:${alarmName}`);
      }
      
      // Record to database
      await this.recordCloudWatchEvent(alarmName, newState, reason);
    } else if (newState === 'OK') {
      // Deactivate veto when alarm clears
      if (mapping) {
        this.deactivateVeto('global', mapping.signal);
      }
      
      // Check for tenant-specific alarms
      const tenantMatch = alarmName.match(/^radiant-([a-z0-9-]+)-/);
      if (tenantMatch) {
        const tenantId = tenantMatch[1];
        // Clear any vetos for this tenant from this alarm
        const tenantVetos = activeVetoSignals.get(tenantId) || [];
        const filtered = tenantVetos.filter(v => v.source !== `CloudWatch:${alarmName}`);
        activeVetoSignals.set(tenantId, filtered);
      }
    }
  }

  /**
   * Record CloudWatch event to database
   */
  private async recordCloudWatchEvent(
    alarmName: string,
    state: string,
    reason?: string
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO cato_veto_log (
          tenant_id, session_id, signal, action_taken, enforced_gamma, context, escalated
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          'system',
          'cloudwatch-sync',
          `CLOUDWATCH_${state}`,
          state === 'ALARM' ? 'ACTIVATED' : 'CLEARED',
          state === 'ALARM' ? 0.1 : 1.0,
          JSON.stringify({ alarmName, state, reason, timestamp: Date.now() }),
          state === 'ALARM',
        ]
      );
    } catch (error) {
      console.error('[CATO Veto] Failed to record CloudWatch event:', error);
    }
  }
}

export const sensoryVetoService = new SensoryVetoService();
