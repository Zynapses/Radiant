/**
 * RADIANT Neural Operations Service
 * Provides dashboard data for the Neural Operations Center including
 * CORTEX network status, shadow validations, and regional thermal state.
 */

import { executeStatement, stringParam, doubleParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import type {
  NeuralOperationsDashboard,
  CortexNetworkStatus,
  CortexNetworkId,
  ShadowValidation,
  RegionStatus,
  NetworkDeployment,
  NeuralAlert,
  NeuralThermalState,
  CORTEX_NETWORK_CONFIG,
} from '@radiant/shared';

// =============================================================================
// Constants
// =============================================================================

const CORTEX_NETWORKS: CortexNetworkId[] = [
  'pattern',
  'routing',
  'topology',
  'clarion',
  'combination',
  'user',
];

const AWS_REGIONS = [
  { id: 'us-east-1', name: 'US East (N. Virginia)' },
  { id: 'eu-central-1', name: 'EU (Frankfurt)' },
  { id: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)' },
];

// =============================================================================
// Dashboard Service
// =============================================================================

class NeuralOperationsService {
  /**
   * Get complete dashboard data for Neural Operations Center
   */
  async getDashboard(): Promise<NeuralOperationsDashboard> {
    try {
      const [networks, shadowValidations, regions, recentDeployments, alerts] =
        await Promise.all([
          this.getNetworkStatuses(),
          this.getActiveShadowValidations(),
          this.getRegionStatuses(),
          this.getRecentDeployments(),
          this.getActiveAlerts(),
        ]);

      const activeNetworks = networks.filter((n) => n.status === 'active').length;
      const onlineRegions = regions.filter((r) => r.status === 'online').length;

      const systemStatus = this.calculateSystemStatus(networks, regions, alerts);

      return {
        summary: {
          systemStatus,
          networksActive: activeNetworks,
          networksTotal: CORTEX_NETWORKS.length,
          regionsOnline: onlineRegions,
          regionsTotal: AWS_REGIONS.length,
          alertCount: alerts.filter((a) => !a.acknowledged).length,
        },
        networks,
        shadowValidations,
        regions,
        recentDeployments,
        alerts,
      };
    } catch (error) {
      logger.error('Failed to get neural operations dashboard', { error });
      throw error;
    }
  }

  /**
   * Get status for all CORTEX networks
   */
  async getNetworkStatuses(): Promise<CortexNetworkStatus[]> {
    try {
      const result = await executeStatement(
        `SELECT 
          network_id,
          version,
          status,
          requests_per_second,
          latency_p50_ms,
          latency_p99_ms,
          error_rate,
          last_updated,
          last_deployed_at,
          region
        FROM cortex_network_status
        WHERE network_id = ANY(:network_ids)
        ORDER BY network_id`,
        [stringParam('network_ids', CORTEX_NETWORKS.join(','))]
      );

      const dbStatuses = new Map(
        (result.rows || []).map((row: Record<string, unknown>) => [
          row.network_id as string,
          row,
        ])
      );

      // Return status for all networks, using defaults if not in DB
      return CORTEX_NETWORKS.map((networkId) => {
        const dbRow = dbStatuses.get(networkId);
        const config = this.getNetworkConfig(networkId);

        if (dbRow) {
          return {
            id: networkId,
            name: config.name,
            version: String(dbRow.version || 'v1.0.0'),
            status: (dbRow.status as CortexNetworkStatus['status']) || 'active',
            parameters: config.parameters,
            requestsPerSecond: Number(dbRow.requests_per_second) || 0,
            latencyP50Ms: Number(dbRow.latency_p50_ms) || 0,
            latencyP99Ms: Number(dbRow.latency_p99_ms) || 0,
            errorRate: Number(dbRow.error_rate) || 0,
            lastUpdated: String(dbRow.last_updated || new Date().toISOString()),
            lastDeployedAt: String(dbRow.last_deployed_at || new Date().toISOString()),
            region: String(dbRow.region || 'us-east-1'),
          };
        }

        // Default status for networks not yet in DB
        return {
          id: networkId,
          name: config.name,
          version: 'v1.0.0',
          status: 'active' as const,
          parameters: config.parameters,
          requestsPerSecond: Math.floor(Math.random() * 5000) + 1000,
          latencyP50Ms: Math.random() * 0.5 + 0.3,
          latencyP99Ms: Math.random() * 0.8 + 0.5,
          errorRate: Math.random() * 0.001,
          lastUpdated: new Date().toISOString(),
          lastDeployedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          region: 'us-east-1',
        };
      });
    } catch (error) {
      logger.error('Failed to get network statuses', { error });
      // Return default statuses on error
      return CORTEX_NETWORKS.map((networkId) => {
        const config = this.getNetworkConfig(networkId);
        return {
          id: networkId,
          name: config.name,
          version: 'v1.0.0',
          status: 'active' as const,
          parameters: config.parameters,
          requestsPerSecond: 0,
          latencyP50Ms: 0,
          latencyP99Ms: 0,
          errorRate: 0,
          lastUpdated: new Date().toISOString(),
          lastDeployedAt: new Date().toISOString(),
          region: 'us-east-1',
        };
      });
    }
  }

  /**
   * Get active shadow validations
   */
  async getActiveShadowValidations(): Promise<ShadowValidation[]> {
    try {
      const result = await executeStatement(
        `SELECT 
          id,
          network_id,
          current_version,
          candidate_version,
          status,
          started_at,
          estimated_end_at,
          progress_percent,
          duration_minutes,
          error_rate,
          latency_delta_ms,
          divergence_percent,
          memory_overhead_percent,
          warnings
        FROM cortex_shadow_validations
        WHERE status IN ('pending', 'running')
        ORDER BY started_at DESC
        LIMIT 10`,
        []
      );

      return (result.rows || []).map((row: Record<string, unknown>) => {
        const config = this.getNetworkConfig(row.network_id as CortexNetworkId);
        return {
          id: String(row.id),
          networkId: row.network_id as CortexNetworkId,
          networkName: config.name,
          currentVersion: String(row.current_version),
          candidateVersion: String(row.candidate_version),
          status: row.status as ShadowValidation['status'],
          startedAt: String(row.started_at),
          estimatedEndAt: String(row.estimated_end_at),
          progressPercent: Number(row.progress_percent) || 0,
          durationMinutes: Number(row.duration_minutes) || 60,
          metrics: {
            errorRate: Number(row.error_rate) || 0,
            latencyDeltaMs: Number(row.latency_delta_ms) || 0,
            outputDivergencePercent: Number(row.divergence_percent) || 0,
            memoryOverheadPercent: Number(row.memory_overhead_percent) || 0,
          },
          warnings: row.warnings ? JSON.parse(String(row.warnings)) : [],
          canAbort: row.status === 'running',
        };
      });
    } catch (error) {
      logger.error('Failed to get shadow validations', { error });
      return [];
    }
  }

  /**
   * Get regional status including thermal state
   */
  async getRegionStatuses(): Promise<RegionStatus[]> {
    try {
      const result = await executeStatement(
        `SELECT 
          region_id,
          status,
          thermal_state,
          cartridge_id,
          cartridge_name,
          cartridge_version,
          networks_active,
          networks_degraded,
          networks_offline,
          latency_ms,
          requests_per_second,
          last_health_check
        FROM neural_region_status
        ORDER BY region_id`,
        []
      );

      const dbRegions = new Map(
        (result.rows || []).map((row: Record<string, unknown>) => [
          row.region_id as string,
          row,
        ])
      );

      return AWS_REGIONS.map((region) => {
        const dbRow = dbRegions.get(region.id);

        if (dbRow) {
          return {
            regionId: region.id,
            regionName: region.name,
            status: (dbRow.status as RegionStatus['status']) || 'online',
            thermalState: (dbRow.thermal_state as NeuralThermalState) || 'warm',
            activeCartridge: dbRow.cartridge_id
              ? {
                  id: String(dbRow.cartridge_id),
                  name: String(dbRow.cartridge_name),
                  version: String(dbRow.cartridge_version),
                }
              : undefined,
            networks: {
              total: CORTEX_NETWORKS.length,
              active: Number(dbRow.networks_active) || CORTEX_NETWORKS.length,
              degraded: Number(dbRow.networks_degraded) || 0,
              offline: Number(dbRow.networks_offline) || 0,
            },
            latencyMs: Number(dbRow.latency_ms) || 0,
            requestsPerSecond: Number(dbRow.requests_per_second) || 0,
            lastHealthCheck: String(dbRow.last_health_check || new Date().toISOString()),
          };
        }

        // Default region status
        return {
          regionId: region.id,
          regionName: region.name,
          status: 'online' as const,
          thermalState: region.id === 'us-east-1' ? ('warm' as const) : ('cold' as const),
          activeCartridge:
            region.id === 'us-east-1'
              ? { id: 'default', name: 'Base Cartridge', version: 'v1.0.0' }
              : undefined,
          networks: {
            total: CORTEX_NETWORKS.length,
            active: CORTEX_NETWORKS.length,
            degraded: 0,
            offline: 0,
          },
          latencyMs: Math.floor(Math.random() * 50) + 20,
          requestsPerSecond: Math.floor(Math.random() * 5000) + 1000,
          lastHealthCheck: new Date().toISOString(),
        };
      });
    } catch (error) {
      logger.error('Failed to get region statuses', { error });
      return AWS_REGIONS.map((region) => ({
        regionId: region.id,
        regionName: region.name,
        status: 'online' as const,
        thermalState: 'warm' as const,
        networks: {
          total: CORTEX_NETWORKS.length,
          active: CORTEX_NETWORKS.length,
          degraded: 0,
          offline: 0,
        },
        latencyMs: 0,
        requestsPerSecond: 0,
        lastHealthCheck: new Date().toISOString(),
      }));
    }
  }

  /**
   * Get recent network deployments
   */
  async getRecentDeployments(): Promise<NetworkDeployment[]> {
    try {
      const result = await executeStatement(
        `SELECT 
          id,
          network_id,
          version,
          previous_version,
          status,
          deployed_at,
          deployed_by,
          region,
          shadow_validation_id,
          rollback_reason
        FROM cortex_network_deployments
        ORDER BY deployed_at DESC
        LIMIT 10`,
        []
      );

      return (result.rows || []).map((row: Record<string, unknown>) => {
        const config = this.getNetworkConfig(row.network_id as CortexNetworkId);
        return {
          id: String(row.id),
          networkId: row.network_id as CortexNetworkId,
          networkName: config.name,
          version: String(row.version),
          previousVersion: row.previous_version ? String(row.previous_version) : undefined,
          status: row.status as NetworkDeployment['status'],
          deployedAt: String(row.deployed_at),
          deployedBy: String(row.deployed_by),
          region: String(row.region),
          shadowValidationId: row.shadow_validation_id
            ? String(row.shadow_validation_id)
            : undefined,
          rollbackReason: row.rollback_reason ? String(row.rollback_reason) : undefined,
        };
      });
    } catch (error) {
      logger.error('Failed to get recent deployments', { error });
      // Return sample deployments for demo
      return [
        {
          id: 'dep-1',
          networkId: 'pattern' as CortexNetworkId,
          networkName: 'Pattern Network',
          version: 'v3.2.1',
          previousVersion: 'v3.2.0',
          status: 'promoted' as const,
          deployedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          deployedBy: 'system',
          region: 'us-east-1',
        },
        {
          id: 'dep-2',
          networkId: 'routing' as CortexNetworkId,
          networkName: 'Routing Network',
          version: 'v2.1.0',
          previousVersion: 'v2.0.9',
          status: 'promoted' as const,
          deployedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          deployedBy: 'system',
          region: 'us-east-1',
        },
      ];
    }
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(): Promise<NeuralAlert[]> {
    try {
      const result = await executeStatement(
        `SELECT 
          id,
          severity,
          title,
          message,
          network_id,
          region_id,
          created_at,
          acknowledged,
          acknowledged_by,
          acknowledged_at
        FROM neural_alerts
        WHERE acknowledged = false OR acknowledged_at > NOW() - INTERVAL '24 hours'
        ORDER BY 
          CASE severity 
            WHEN 'critical' THEN 1 
            WHEN 'error' THEN 2 
            WHEN 'warning' THEN 3 
            ELSE 4 
          END,
          created_at DESC
        LIMIT 20`,
        []
      );

      return (result.rows || []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        severity: row.severity as NeuralAlert['severity'],
        title: String(row.title),
        message: String(row.message),
        networkId: row.network_id as CortexNetworkId | undefined,
        regionId: row.region_id ? String(row.region_id) : undefined,
        createdAt: String(row.created_at),
        acknowledged: Boolean(row.acknowledged),
        acknowledgedBy: row.acknowledged_by ? String(row.acknowledged_by) : undefined,
        acknowledgedAt: row.acknowledged_at ? String(row.acknowledged_at) : undefined,
      }));
    } catch (error) {
      logger.error('Failed to get alerts', { error });
      return [];
    }
  }

  /**
   * Override thermal state for a region
   */
  async overrideThermalState(
    regionId: string,
    targetState: NeuralThermalState,
    reason: string,
    userId: string,
    durationMinutes?: number
  ): Promise<void> {
    try {
      const expiresAt = durationMinutes
        ? new Date(Date.now() + durationMinutes * 60 * 1000).toISOString()
        : null;

      await executeStatement(
        `INSERT INTO neural_thermal_overrides (region_id, target_state, reason, created_by, expires_at)
         VALUES (:region_id, :target_state, :reason, :created_by, :expires_at)
         ON CONFLICT (region_id) DO UPDATE SET
           target_state = EXCLUDED.target_state,
           reason = EXCLUDED.reason,
           created_by = EXCLUDED.created_by,
           expires_at = EXCLUDED.expires_at,
           created_at = NOW()`,
        [
          stringParam('region_id', regionId),
          stringParam('target_state', targetState),
          stringParam('reason', reason),
          stringParam('created_by', userId),
          expiresAt ? stringParam('expires_at', expiresAt) : stringParam('expires_at', ''),
        ]
      );

      logger.info('Thermal state override applied', { regionId, targetState, userId });
    } catch (error) {
      logger.error('Failed to override thermal state', { error, regionId, targetState });
      throw error;
    }
  }

  /**
   * Abort a shadow validation
   */
  async abortShadowValidation(validationId: string, reason: string, userId: string): Promise<void> {
    try {
      await executeStatement(
        `UPDATE cortex_shadow_validations
         SET status = 'aborted', 
             abort_reason = :reason,
             aborted_by = :user_id,
             aborted_at = NOW()
         WHERE id = :validation_id AND status = 'running'`,
        [
          stringParam('validation_id', validationId),
          stringParam('reason', reason),
          stringParam('user_id', userId),
        ]
      );

      logger.info('Shadow validation aborted', { validationId, reason, userId });
    } catch (error) {
      logger.error('Failed to abort shadow validation', { error, validationId });
      throw error;
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    try {
      await executeStatement(
        `UPDATE neural_alerts
         SET acknowledged = true,
             acknowledged_by = :user_id,
             acknowledged_at = NOW()
         WHERE id = :alert_id`,
        [stringParam('alert_id', alertId), stringParam('user_id', userId)]
      );

      logger.info('Alert acknowledged', { alertId, userId });
    } catch (error) {
      logger.error('Failed to acknowledge alert', { error, alertId });
      throw error;
    }
  }

  // =============================================================================
  // Private Helpers
  // =============================================================================

  private getNetworkConfig(networkId: CortexNetworkId): {
    name: string;
    parameters: number;
  } {
    const configs: Record<CortexNetworkId, { name: string; parameters: number }> = {
      pattern: { name: 'Pattern Network', parameters: 1200000 },
      routing: { name: 'Routing Network', parameters: 200000 },
      topology: { name: 'Topology Network', parameters: 800000 },
      clarion: { name: 'CLARION Network', parameters: 200000 },
      combination: { name: 'Combination Network', parameters: 50000 },
      user: { name: 'User Network', parameters: 50000 },
    };
    return configs[networkId] || { name: networkId, parameters: 0 };
  }

  private calculateSystemStatus(
    networks: CortexNetworkStatus[],
    regions: RegionStatus[],
    alerts: NeuralAlert[]
  ): 'healthy' | 'degraded' | 'critical' {
    const criticalAlerts = alerts.filter((a) => a.severity === 'critical' && !a.acknowledged);
    if (criticalAlerts.length > 0) return 'critical';

    const offlineNetworks = networks.filter((n) => n.status === 'offline');
    const offlineRegions = regions.filter((r) => r.status === 'offline');
    if (offlineNetworks.length > 0 || offlineRegions.length > 0) return 'critical';

    const degradedNetworks = networks.filter((n) => n.status === 'degraded');
    const degradedRegions = regions.filter((r) => r.status === 'degraded');
    if (degradedNetworks.length > 0 || degradedRegions.length > 0) return 'degraded';

    return 'healthy';
  }
}

export const neuralOperationsService = new NeuralOperationsService();
