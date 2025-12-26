import { SageMakerClient, DescribeEndpointCommand } from '@aws-sdk/client-sagemaker';
import { executeStatement } from '../db/client';

export type ThermalState = 'off' | 'cold' | 'warm' | 'hot' | 'automatic';

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
        console.log(`Endpoint ${endpointName} status: ${response.EndpointStatus}`);
      }
    } catch (error) {
      console.error(`Failed to check endpoint ${endpointName}:`, error);
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
