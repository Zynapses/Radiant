import { SageMakerClient, DescribeEndpointCommand } from '@aws-sdk/client-sagemaker';
import { executeStatement } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

export type ThermalState = 'off' | 'cold' | 'warm' | 'hot' | 'automatic';
export type ModelHostingTier = 'hot' | 'warm' | 'cold' | 'off';

interface ThermalConfig {
  warmDurationMinutes: number;
  hotThresholdRequestsPerMinute: number;
  coldThresholdIdleMinutes: number;
}

const DEFAULT_CONFIG: ThermalConfig = {
  warmDurationMinutes: 30,
  hotThresholdRequestsPerMinute: 10,
  coldThresholdIdleMinutes: 15,
};

export class ThermalStateService {
  private sagemaker: SageMakerClient;
  private config: ThermalConfig;

  constructor(config: Partial<ThermalConfig> = {}) {
    this.sagemaker = new SageMakerClient({});
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async getThermalState(modelId: string): Promise<ThermalState> {
    const result = await executeStatement(
      `SELECT thermal_state, warm_until, auto_thermal_enabled FROM models WHERE id = $1`,
      [{ name: 'id', value: { stringValue: modelId } }]
    );

    if (result.rows.length === 0) {
      throw new Error(`Model ${modelId} not found`);
    }

    const row = result.rows[0] as Record<string, unknown>;
    const thermalState = (row.thermal_state as string || 'cold') as ThermalState;
    const warmUntil = row.warm_until as string | null;
    const autoThermalEnabled = row.auto_thermal_enabled as boolean;

    if (autoThermalEnabled && warmUntil && new Date(warmUntil) < new Date()) {
      await this.transitionToCold(modelId);
      return 'cold';
    }

    return thermalState;
  }

  async warmUp(modelId: string, durationMinutes?: number): Promise<void> {
    const duration = durationMinutes ?? this.config.warmDurationMinutes;
    const warmUntil = new Date(Date.now() + duration * 60 * 1000);

    await executeStatement(
      `UPDATE models SET thermal_state = 'warm', warm_until = $2 WHERE id = $1`,
      [
        { name: 'id', value: { stringValue: modelId } },
        { name: 'warmUntil', value: { stringValue: warmUntil.toISOString() } },
      ]
    );

    const model = await this.getModel(modelId);
    if (model.endpointName) {
      await this.ensureEndpointRunning(model.endpointName);
    }
  }

  async transitionToCold(modelId: string): Promise<void> {
    await executeStatement(
      `UPDATE models SET thermal_state = 'cold', warm_until = NULL WHERE id = $1`,
      [{ name: 'id', value: { stringValue: modelId } }]
    );
  }

  async transitionToHot(modelId: string): Promise<void> {
    await executeStatement(
      `UPDATE models SET thermal_state = 'hot' WHERE id = $1`,
      [{ name: 'id', value: { stringValue: modelId } }]
    );
  }

  async checkAndUpdateThermalState(modelId: string): Promise<ThermalState> {
    const recentRequests = await this.getRecentRequestCount(modelId);

    if (recentRequests >= this.config.hotThresholdRequestsPerMinute) {
      await this.transitionToHot(modelId);
      return 'hot';
    }

    const lastRequestMinutes = await this.getMinutesSinceLastRequest(modelId);
    if (lastRequestMinutes > this.config.coldThresholdIdleMinutes) {
      await this.transitionToCold(modelId);
      return 'cold';
    }

    return this.getThermalState(modelId);
  }

  private async getModel(modelId: string): Promise<{ endpointName?: string }> {
    const result = await executeStatement(
      `SELECT config FROM models WHERE id = $1`,
      [{ name: 'id', value: { stringValue: modelId } }]
    );

    if (result.rows.length === 0) {
      throw new Error(`Model ${modelId} not found`);
    }

    const row = result.rows[0] as Record<string, unknown>;
    const config = typeof row.config === 'string' ? JSON.parse(row.config) : (row.config || {});
    return { endpointName: config.endpoint_name };
  }

  private async ensureEndpointRunning(endpointName: string): Promise<void> {
    try {
      const command = new DescribeEndpointCommand({ EndpointName: endpointName });
      const response = await this.sagemaker.send(command);

      if (response.EndpointStatus !== 'InService') {
        logger.debug(`Endpoint ${endpointName} status: ${response.EndpointStatus}`);
      }
    } catch (error) {
      logger.error(`Failed to check endpoint ${endpointName}`, error);
    }
  }

  private async getRecentRequestCount(modelId: string): Promise<number> {
    const result = await executeStatement(
      `SELECT COUNT(*) FROM usage_events 
       WHERE model_id = $1 AND created_at > NOW() - INTERVAL '1 minute'`,
      [{ name: 'modelId', value: { stringValue: modelId } }]
    );

    const row = result.rows[0] as Record<string, unknown> | undefined;
    return parseInt(String(row?.count ?? 0), 10);
  }

  private async getMinutesSinceLastRequest(modelId: string): Promise<number> {
    const result = await executeStatement(
      `SELECT EXTRACT(EPOCH FROM (NOW() - MAX(created_at))) / 60 
       FROM usage_events WHERE model_id = $1`,
      [{ name: 'modelId', value: { stringValue: modelId } }]
    );

    const row = result.rows[0] as Record<string, unknown> | undefined;
    return parseFloat(String(row?.extract ?? 999));
  }
}

export const thermalStateService = new ThermalStateService();

// ============================================================================
// Integration with Inference Components
// ============================================================================

/**
 * Map thermal state to model hosting tier for inference components
 */
export function thermalStateToTier(state: ThermalState): ModelHostingTier {
  switch (state) {
    case 'hot': return 'hot';
    case 'warm': return 'warm';
    case 'cold': return 'cold';
    case 'off': return 'off';
    case 'automatic': return 'warm'; // Default automatic to warm
    default: return 'cold';
  }
}

/**
 * Map model hosting tier to thermal state
 */
export function tierToThermalState(tier: ModelHostingTier): ThermalState {
  return tier as ThermalState;
}

/**
 * Get comprehensive thermal info for a model including inference component status
 */
export async function getModelThermalInfo(modelId: string): Promise<{
  modelId: string;
  thermalState: ThermalState;
  hostingTier: ModelHostingTier;
  isInferenceComponent: boolean;
  componentStatus?: string;
  lastLoadedAt?: string;
  loadTimeMs?: number;
  currentCopies?: number;
  requestsLast24h: number;
  avgLatencyMs?: number;
  estimatedMonthlyCost: number;
}> {
  // Get thermal state
  let thermalState: ThermalState = 'cold';
  try {
    thermalState = await thermalStateService.getThermalState(modelId);
  } catch {
    // Model might not be in models table
  }

  // Get inference component info if exists
  const componentResult = await executeStatement(
    `SELECT ic.*, ta.current_tier, ta.current_monthly_cost
     FROM inference_components ic
     LEFT JOIN tier_assignments ta ON ic.model_id = ta.model_id
     WHERE ic.model_id = $1 AND ic.status != 'deleting'`,
    [{ name: 'modelId', value: { stringValue: modelId } }]
  );

  const isInferenceComponent = componentResult.rows.length > 0;
  let hostingTier: ModelHostingTier = thermalStateToTier(thermalState);
  let componentStatus: string | undefined;
  let lastLoadedAt: string | undefined;
  let loadTimeMs: number | undefined;
  let currentCopies: number | undefined;
  let avgLatencyMs: number | undefined;
  let estimatedMonthlyCost = 0;

  if (isInferenceComponent) {
    const row = componentResult.rows[0] as Record<string, unknown>;
    hostingTier = (row.current_tier as ModelHostingTier) || 'warm';
    componentStatus = row.status as string;
    lastLoadedAt = row.last_loaded_at as string | undefined;
    loadTimeMs = row.load_time_ms ? Number(row.load_time_ms) : undefined;
    currentCopies = row.current_copies ? Number(row.current_copies) : 0;
    avgLatencyMs = row.avg_latency_ms ? Number(row.avg_latency_ms) : undefined;
    estimatedMonthlyCost = row.current_monthly_cost ? Number(row.current_monthly_cost) : 100;
  }

  // Get usage stats
  const usageResult = await executeStatement(
    `SELECT COUNT(*) as count FROM usage_events 
     WHERE model_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
    [{ name: 'modelId', value: { stringValue: modelId } }]
  );
  const requestsLast24h = parseInt(String((usageResult.rows[0] as Record<string, unknown>)?.count ?? 0), 10);

  return {
    modelId,
    thermalState,
    hostingTier,
    isInferenceComponent,
    componentStatus,
    lastLoadedAt,
    loadTimeMs,
    currentCopies,
    requestsLast24h,
    avgLatencyMs,
    estimatedMonthlyCost,
  };
}

/**
 * Get thermal info for all self-hosted models
 */
export async function getAllModelsThermalInfo(tenantId: string): Promise<Array<{
  modelId: string;
  modelName: string;
  thermalState: ThermalState;
  hostingTier: ModelHostingTier;
  isInferenceComponent: boolean;
  componentStatus?: string;
  lastLoadedAt?: string;
  loadTimeMs?: number;
  currentCopies?: number;
  requestsLast24h: number;
  avgLatencyMs?: number;
  estimatedMonthlyCost: number;
}>> {
  // Get all self-hosted models with their tier assignments and component info
  const result = await executeStatement(
    `SELECT 
       mr.model_id,
       mr.name as model_name,
       COALESCE(ta.current_tier, 'cold') as hosting_tier,
       ic.component_id,
       ic.status as component_status,
       ic.last_loaded_at,
       ic.load_time_ms,
       ic.current_copies,
       ic.avg_latency_ms,
       COALESCE(ta.current_monthly_cost, 0) as estimated_monthly_cost,
       (SELECT COUNT(*) FROM usage_events ue 
        WHERE ue.model_id = mr.model_id AND ue.created_at > NOW() - INTERVAL '24 hours') as requests_24h
     FROM model_registry mr
     LEFT JOIN tier_assignments ta ON mr.model_id = ta.model_id
     LEFT JOIN inference_components ic ON mr.model_id = ic.model_id AND ic.status != 'deleting'
     WHERE mr.tenant_id = $1 AND mr.source = 'self_hosted'
     ORDER BY requests_24h DESC`,
    [{ name: 'tenantId', value: { stringValue: tenantId } }]
  );

  return result.rows.map((row: Record<string, unknown>) => ({
    modelId: String(row.model_id),
    modelName: String(row.model_name || row.model_id),
    thermalState: tierToThermalState((row.hosting_tier as ModelHostingTier) || 'cold'),
    hostingTier: (row.hosting_tier as ModelHostingTier) || 'cold',
    isInferenceComponent: !!row.component_id,
    componentStatus: row.component_status as string | undefined,
    lastLoadedAt: row.last_loaded_at as string | undefined,
    loadTimeMs: row.load_time_ms ? Number(row.load_time_ms) : undefined,
    currentCopies: row.current_copies ? Number(row.current_copies) : undefined,
    requestsLast24h: parseInt(String(row.requests_24h ?? 0), 10),
    avgLatencyMs: row.avg_latency_ms ? Number(row.avg_latency_ms) : undefined,
    estimatedMonthlyCost: Number(row.estimated_monthly_cost || 0),
  }));
}
