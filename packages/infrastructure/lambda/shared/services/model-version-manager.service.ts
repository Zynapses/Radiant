// RADIANT v5.2.4 - Model Version Manager Service
// Handles S3 storage, thermal status, and version lifecycle management

import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import {
  SageMakerClient,
  DescribeEndpointCommand,
} from '@aws-sdk/client-sagemaker';
import { executeStatement } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import type {
  ModelVersion,
  ModelThermalState,
  DownloadStatus,
  ModelDeploymentStatus,
  ModelStorageInfo,
  ListModelVersionsRequest,
  ModelVersionDashboard,
} from '@radiant/shared';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_S3_BUCKET = process.env.MODEL_STORAGE_BUCKET || 'radiant-models';
const DEFAULT_S3_PREFIX = process.env.MODEL_STORAGE_PREFIX || 'models/';
const DEFAULT_REGION = process.env.AWS_REGION || 'us-east-1';

// ============================================================================
// Model Version Manager Service
// ============================================================================

class ModelVersionManagerService {
  private s3: S3Client;
  private sagemaker: SageMakerClient;

  constructor() {
    this.s3 = new S3Client({ region: DEFAULT_REGION });
    this.sagemaker = new SageMakerClient({ region: DEFAULT_REGION });
  }

  // ============================================================================
  // Model Version CRUD
  // ============================================================================

  async getModelVersion(id: string): Promise<ModelVersion | null> {
    const result = await executeStatement(
      `SELECT * FROM v_model_versions_with_stats WHERE id = $1`,
      [{ name: 'id', value: { stringValue: id } }]
    );
    if (!result.rows || result.rows.length === 0) return null;
    return this.mapModelVersionRow(result.rows[0]);
  }

  async listModelVersions(params: ListModelVersionsRequest): Promise<{
    versions: ModelVersion[];
    total: number;
  }> {
    let sql = `SELECT * FROM v_model_versions_with_stats WHERE 1=1`;
    const queryParams: Array<{ name: string; value: Record<string, unknown> }> = [];
    let paramIndex = 1;

    if (params.family) {
      sql += ` AND family = $${paramIndex++}`;
      queryParams.push({ name: 'family', value: { stringValue: params.family } });
    }
    if (params.thermalState) {
      sql += ` AND thermal_state = $${paramIndex++}`;
      queryParams.push({ name: 'thermal', value: { stringValue: params.thermalState } });
    }
    if (params.downloadStatus) {
      sql += ` AND download_status = $${paramIndex++}`;
      queryParams.push({ name: 'download', value: { stringValue: params.downloadStatus } });
    }
    if (params.isActive !== undefined) {
      sql += ` AND is_active = $${paramIndex++}`;
      queryParams.push({ name: 'active', value: { booleanValue: params.isActive } });
    }

    const countResult = await executeStatement(
      sql.replace('SELECT *', 'SELECT COUNT(*)'),
      queryParams
    );
    const total = Number((countResult.rows?.[0] as Record<string, unknown>)?.count || 0);

    sql += ` ORDER BY thermal_priority, family, version DESC`;
    sql += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    queryParams.push({ name: 'limit', value: { longValue: params.limit || 50 } });
    queryParams.push({ name: 'offset', value: { longValue: params.offset || 0 } });

    const result = await executeStatement(sql, queryParams);
    return {
      versions: (result.rows || []).map(row => this.mapModelVersionRow(row)),
      total,
    };
  }

  async createModelVersion(params: {
    modelId: string;
    family: string;
    version: string;
    huggingfaceId?: string;
    displayName?: string;
    description?: string;
    parameterCount?: string;
    capabilities?: string[];
    instanceType?: string;
    thermalState?: ModelThermalState;
  }): Promise<ModelVersion> {
    const s3KeyPrefix = `${DEFAULT_S3_PREFIX}${params.family}/${params.modelId}/${params.version}/`;

    const result = await executeStatement(
      `INSERT INTO model_versions (
         model_id, family, version, huggingface_id, discovery_source,
         s3_bucket, s3_key_prefix, s3_region,
         display_name, description, parameter_count,
         capabilities, thermal_state, instance_type
       ) VALUES ($1, $2, $3, $4, 'manual', $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        { name: 'modelId', value: { stringValue: params.modelId } },
        { name: 'family', value: { stringValue: params.family } },
        { name: 'version', value: { stringValue: params.version } },
        { name: 'hfId', value: params.huggingfaceId ? { stringValue: params.huggingfaceId } : { isNull: true } },
        { name: 's3Bucket', value: { stringValue: DEFAULT_S3_BUCKET } },
        { name: 's3Prefix', value: { stringValue: s3KeyPrefix } },
        { name: 's3Region', value: { stringValue: DEFAULT_REGION } },
        { name: 'displayName', value: params.displayName ? { stringValue: params.displayName } : { isNull: true } },
        { name: 'description', value: params.description ? { stringValue: params.description } : { isNull: true } },
        { name: 'paramCount', value: params.parameterCount ? { stringValue: params.parameterCount } : { isNull: true } },
        { name: 'capabilities', value: { stringValue: `{${(params.capabilities || ['chat']).join(',')}}` } },
        { name: 'thermal', value: { stringValue: params.thermalState || 'off' } },
        { name: 'instanceType', value: params.instanceType ? { stringValue: params.instanceType } : { isNull: true } },
      ]
    );

    const id = String(result.rows?.[0]?.id || '');
    const version = await this.getModelVersion(id);
    if (!version) throw new Error('Failed to create model version');

    logger.info('Created model version', { id, modelId: params.modelId, version: params.version });
    return version;
  }

  async updateModelVersion(
    id: string,
    updates: Partial<{
      thermalState: ModelThermalState;
      isActive: boolean;
      isDefaultForFamily: boolean;
      displayName: string;
      autoThermalEnabled: boolean;
    }>
  ): Promise<ModelVersion> {
    const fields: string[] = [];
    const params: Array<{ name: string; value: Record<string, unknown> }> = [
      { name: 'id', value: { stringValue: id } },
    ];
    let idx = 2;

    if (updates.thermalState !== undefined) {
      fields.push(`thermal_state = $${idx++}`);
      params.push({ name: 'thermal', value: { stringValue: updates.thermalState } });
    }
    if (updates.isActive !== undefined) {
      fields.push(`is_active = $${idx++}`);
      params.push({ name: 'active', value: { booleanValue: updates.isActive } });
    }
    if (updates.isDefaultForFamily !== undefined) {
      fields.push(`is_default_for_family = $${idx++}`);
      params.push({ name: 'default', value: { booleanValue: updates.isDefaultForFamily } });
    }
    if (updates.displayName !== undefined) {
      fields.push(`display_name = $${idx++}`);
      params.push({ name: 'displayName', value: { stringValue: updates.displayName } });
    }
    if (updates.autoThermalEnabled !== undefined) {
      fields.push(`auto_thermal_enabled = $${idx++}`);
      params.push({ name: 'autoThermal', value: { booleanValue: updates.autoThermalEnabled } });
    }

    if (fields.length > 0) {
      await executeStatement(
        `UPDATE model_versions SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $1`,
        params
      );
    }

    const version = await this.getModelVersion(id);
    if (!version) throw new Error('Model version not found');
    return version;
  }

  // ============================================================================
  // Thermal State Management
  // ============================================================================

  async setThermalState(
    id: string,
    thermalState: ModelThermalState,
    warmDurationMinutes?: number
  ): Promise<{ previousState: ModelThermalState; newState: ModelThermalState }> {
    const current = await this.getModelVersion(id);
    if (!current) throw new Error('Model version not found');

    const previousState = current.thermalState;
    let warmUntil: Date | null = null;

    if (thermalState === 'warm' && warmDurationMinutes) {
      warmUntil = new Date(Date.now() + warmDurationMinutes * 60 * 1000);
    }

    await executeStatement(
      `UPDATE model_versions SET 
         thermal_state = $2,
         target_thermal_state = $2,
         warm_until = $3,
         thermal_state_changed_at = NOW(),
         updated_at = NOW()
       WHERE id = $1`,
      [
        { name: 'id', value: { stringValue: id } },
        { name: 'thermal', value: { stringValue: thermalState } },
        { name: 'warmUntil', value: warmUntil ? { stringValue: warmUntil.toISOString() } : { isNull: true } },
      ]
    );

    logger.info('Thermal state changed', { id, previousState, newState: thermalState });
    return { previousState, newState: thermalState };
  }

  async bulkSetThermalState(
    ids: string[],
    thermalState: ModelThermalState
  ): Promise<number> {
    if (ids.length === 0) return 0;

    const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
    const params = [
      { name: 'thermal', value: { stringValue: thermalState } },
      ...ids.map((id, i) => ({ name: `id${i}`, value: { stringValue: id } })),
    ];

    await executeStatement(
      `UPDATE model_versions SET 
         thermal_state = $1,
         thermal_state_changed_at = NOW(),
         updated_at = NOW()
       WHERE id IN (${placeholders})`,
      params
    );

    return ids.length;
  }

  // ============================================================================
  // S3 Storage Management
  // ============================================================================

  async getStorageInfo(id: string): Promise<ModelStorageInfo | null> {
    const version = await this.getModelVersion(id);
    if (!version || !version.s3Bucket || !version.s3KeyPrefix) return null;

    const files: Array<{ key: string; size: number; lastModified: Date }> = [];
    let totalSize = 0;
    let continuationToken: string | undefined;

    do {
      const command = new ListObjectsV2Command({
        Bucket: version.s3Bucket,
        Prefix: version.s3KeyPrefix,
        ContinuationToken: continuationToken,
      });

      const response = await this.s3.send(command);

      for (const obj of response.Contents || []) {
        if (obj.Key && obj.Size !== undefined) {
          files.push({
            key: obj.Key,
            size: obj.Size,
            lastModified: obj.LastModified || new Date(),
          });
          totalSize += obj.Size;
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return {
      modelVersionId: id,
      s3Bucket: version.s3Bucket,
      s3KeyPrefix: version.s3KeyPrefix,
      s3Region: version.s3Region,
      files,
      totalSize,
      fileCount: files.length,
    };
  }

  async deleteS3Storage(id: string): Promise<number> {
    const storageInfo = await this.getStorageInfo(id);
    if (!storageInfo || storageInfo.files.length === 0) return 0;

    const deleteObjects = storageInfo.files.map(f => ({ Key: f.key }));
    const batchSize = 1000;
    let deleted = 0;

    for (let i = 0; i < deleteObjects.length; i += batchSize) {
      const batch = deleteObjects.slice(i, i + batchSize);
      const command = new DeleteObjectsCommand({
        Bucket: storageInfo.s3Bucket,
        Delete: { Objects: batch },
      });

      await this.s3.send(command);
      deleted += batch.length;
    }

    await executeStatement(
      `UPDATE model_versions SET storage_size_bytes = 0, updated_at = NOW() WHERE id = $1`,
      [{ name: 'id', value: { stringValue: id } }]
    );

    logger.info('Deleted S3 storage', { id, filesDeleted: deleted });
    return deleted;
  }

  // ============================================================================
  // Dashboard
  // ============================================================================

  async getDashboard(): Promise<ModelVersionDashboard> {
    const statsResult = await executeStatement(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE is_active) as active,
         COUNT(*) FILTER (WHERE download_status = 'completed') as downloaded,
         COUNT(*) FILTER (WHERE deployment_status = 'deployed') as deployed,
         COUNT(*) FILTER (WHERE thermal_state = 'hot') as hot,
         COUNT(*) FILTER (WHERE thermal_state = 'warm') as warm,
         COUNT(*) FILTER (WHERE thermal_state = 'cold') as cold,
         COUNT(*) FILTER (WHERE thermal_state = 'off') as off_state,
         COALESCE(SUM(storage_size_bytes), 0) as total_storage
       FROM model_versions`,
      []
    );

    const stats = statsResult.rows?.[0] as Record<string, unknown> || {};

    const familyResult = await executeStatement(
      `SELECT 
         family,
         COUNT(*) as total_versions,
         COUNT(*) FILTER (WHERE is_active) as active_versions,
         MAX(version) as latest_version,
         EXISTS(SELECT 1 FROM model_family_watchlist w WHERE w.family = mv.family AND w.is_enabled) as is_watched
       FROM model_versions mv
       GROUP BY family
       ORDER BY family`,
      []
    );

    const recentDiscoveries = await executeStatement(
      `SELECT * FROM model_versions WHERE discovery_source = 'huggingface_api'
       ORDER BY discovered_at DESC LIMIT 5`,
      []
    );

    const deletionStats = await executeStatement(
      `SELECT 
         COUNT(*) FILTER (WHERE status = 'pending') as pending,
         COUNT(*) FILTER (WHERE status = 'blocked') as blocked,
         COUNT(*) FILTER (WHERE status = 'processing') as processing
       FROM model_deletion_queue`,
      []
    );
    const delStats = deletionStats.rows?.[0] as Record<string, unknown> || {};

    const lastJobResult = await executeStatement(
      `SELECT * FROM model_discovery_jobs ORDER BY created_at DESC LIMIT 1`,
      []
    );

    return {
      totalVersions: Number(stats.total || 0),
      activeVersions: Number(stats.active || 0),
      downloadedVersions: Number(stats.downloaded || 0),
      deployedVersions: Number(stats.deployed || 0),
      thermalBreakdown: {
        hot: Number(stats.hot || 0),
        warm: Number(stats.warm || 0),
        cold: Number(stats.cold || 0),
        off: Number(stats.off_state || 0),
      },
      familyBreakdown: (familyResult.rows || []).map((row: Record<string, unknown>) => ({
        family: String(row.family),
        totalVersions: Number(row.total_versions || 0),
        activeVersions: Number(row.active_versions || 0),
        latestVersion: String(row.latest_version || ''),
        isWatched: Boolean(row.is_watched),
      })),
      recentDiscoveries: (recentDiscoveries.rows || []).map(r => this.mapModelVersionRow(r)),
      recentDownloads: [],
      deletionQueueSummary: {
        pending: Number(delStats.pending || 0),
        blocked: Number(delStats.blocked || 0),
        processing: Number(delStats.processing || 0),
      },
      lastDiscoveryJob: lastJobResult.rows?.[0] ? this.mapDiscoveryJob(lastJobResult.rows[0]) : undefined,
      nextScheduledDiscovery: undefined,
      totalStorageBytes: Number(stats.total_storage || 0),
      storageByFamily: {},
    };
  }

  // ============================================================================
  // Mapping Helpers
  // ============================================================================

  private mapModelVersionRow(row: Record<string, unknown>): ModelVersion {
    return {
      id: String(row.id),
      modelId: String(row.model_id),
      family: String(row.family),
      version: String(row.version),
      huggingfaceId: row.huggingface_id ? String(row.huggingface_id) : undefined,
      huggingfaceRevision: row.huggingface_revision ? String(row.huggingface_revision) : undefined,
      discoveredAt: new Date(String(row.discovered_at)),
      discoverySource: String(row.discovery_source || 'manual') as ModelVersion['discoverySource'],
      s3Bucket: row.s3_bucket ? String(row.s3_bucket) : undefined,
      s3KeyPrefix: row.s3_key_prefix ? String(row.s3_key_prefix) : undefined,
      s3Region: String(row.s3_region || DEFAULT_REGION),
      storageSizeBytes: row.storage_size_bytes ? Number(row.storage_size_bytes) : undefined,
      downloadStatus: String(row.download_status || 'pending') as DownloadStatus,
      downloadProgressPct: Number(row.download_progress_pct || 0),
      downloadStartedAt: row.download_started_at ? new Date(String(row.download_started_at)) : undefined,
      downloadCompletedAt: row.download_completed_at ? new Date(String(row.download_completed_at)) : undefined,
      downloadError: row.download_error ? String(row.download_error) : undefined,
      thermalState: String(row.thermal_state || 'off') as ModelThermalState,
      targetThermalState: row.target_thermal_state ? String(row.target_thermal_state) as ModelThermalState : undefined,
      thermalStateChangedAt: row.thermal_state_changed_at ? new Date(String(row.thermal_state_changed_at)) : undefined,
      autoThermalEnabled: Boolean(row.auto_thermal_enabled),
      warmUntil: row.warm_until ? new Date(String(row.warm_until)) : undefined,
      sagemakerEndpointName: row.sagemaker_endpoint_name ? String(row.sagemaker_endpoint_name) : undefined,
      sagemakerEndpointConfig: row.sagemaker_endpoint_config ? String(row.sagemaker_endpoint_config) : undefined,
      sagemakerModelName: row.sagemaker_model_name ? String(row.sagemaker_model_name) : undefined,
      inferenceComponentId: row.inference_component_id ? String(row.inference_component_id) : undefined,
      deploymentStatus: String(row.deployment_status || 'not_deployed') as ModelDeploymentStatus,
      displayName: row.display_name ? String(row.display_name) : undefined,
      description: row.description ? String(row.description) : undefined,
      parameterCount: row.parameter_count ? String(row.parameter_count) : undefined,
      contextWindow: row.context_window ? Number(row.context_window) : undefined,
      maxOutputTokens: row.max_output_tokens ? Number(row.max_output_tokens) : undefined,
      capabilities: (row.capabilities as string[]) || [],
      inputModalities: (row.input_modalities as string[]) || ['text'],
      outputModalities: (row.output_modalities as string[]) || ['text'],
      license: row.license ? String(row.license) : undefined,
      commercialUse: Boolean(row.commercial_use ?? true),
      instanceType: row.instance_type ? String(row.instance_type) : undefined,
      minVramGb: row.min_vram_gb ? Number(row.min_vram_gb) : undefined,
      quantization: row.quantization ? String(row.quantization) : undefined,
      tensorParallelism: Number(row.tensor_parallelism || 1),
      pricingInputPer1M: row.pricing_input_per_1m ? Number(row.pricing_input_per_1m) : undefined,
      pricingOutputPer1M: row.pricing_output_per_1m ? Number(row.pricing_output_per_1m) : undefined,
      totalRequests: Number(row.total_requests || 0),
      lastRequestAt: row.last_request_at ? new Date(String(row.last_request_at)) : undefined,
      isActive: Boolean(row.is_active),
      isDefaultForFamily: Boolean(row.is_default_for_family),
      activeSessions: row.active_sessions ? Number(row.active_sessions) : undefined,
      totalSessions: row.total_sessions ? Number(row.total_sessions) : undefined,
      thermalPriority: row.thermal_priority ? Number(row.thermal_priority) : undefined,
      createdAt: new Date(String(row.created_at)),
      updatedAt: new Date(String(row.updated_at)),
    };
  }

  private mapDiscoveryJob(row: Record<string, unknown>): ModelVersionDashboard['lastDiscoveryJob'] {
    return {
      id: String(row.id),
      jobType: String(row.job_type || 'scheduled') as 'scheduled' | 'manual' | 'webhook',
      triggeredBy: row.triggered_by ? String(row.triggered_by) : undefined,
      status: String(row.status || 'pending') as 'pending' | 'running' | 'completed' | 'failed' | 'cancelled',
      startedAt: row.started_at ? new Date(String(row.started_at)) : undefined,
      completedAt: row.completed_at ? new Date(String(row.completed_at)) : undefined,
      durationMs: row.duration_ms ? Number(row.duration_ms) : undefined,
      familiesChecked: Number(row.families_checked || 0),
      modelsDiscovered: Number(row.models_discovered || 0),
      modelsAdded: Number(row.models_added || 0),
      downloadsStarted: Number(row.downloads_started || 0),
      errors: [],
      warnings: [],
      familyResults: {},
      createdAt: new Date(String(row.created_at)),
    };
  }
}

export const modelVersionManagerService = new ModelVersionManagerService();
