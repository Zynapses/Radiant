// RADIANT v4.18.0 - Machine Learning Training Service
// Manages training data collection, model training, and continuous learning

import { SageMakerRuntimeClient, InvokeEndpointCommand } from '@aws-sdk/client-sagemaker-runtime';
import { executeStatement } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

const sagemakerClient = new SageMakerRuntimeClient({});

// ============================================================================
// Types
// ============================================================================

export interface RoutingTrainingSample {
  sampleId: string;
  taskText: string;
  detectedSpecialty?: string;
  detectedComplexity: 'simple' | 'moderate' | 'complex';
  modelsConsidered: string[];
  modelSelected: string;
  routingStrategy: string;
  qualityScore?: number;
  latencyMs?: number;
  costCents?: number;
  userFeedback?: 'positive' | 'negative' | 'neutral';
  wasGoodChoice?: boolean;
  createdAt: string;
}

export interface TrainingBatch {
  batchId: string;
  batchName: string;
  modelType: string;
  samplesCount: number;
  status: 'pending' | 'exporting' | 'training' | 'evaluating' | 'completed' | 'failed';
  sagemakerTrainingJob?: string;
  sagemakerEndpoint?: string;
  trainingMetrics?: Record<string, number>;
  evaluationMetrics?: Record<string, number>;
  createdAt: string;
  completedAt?: string;
}

export interface MLModelVersion {
  versionId: string;
  modelType: string;
  versionNumber: number;
  sagemakerEndpoint?: string;
  isActive: boolean;
  accuracy?: number;
  latencyP50Ms?: number;
  trafficPercentage: number;
  createdAt: string;
}

export interface AIModelInfo {
  modelId: string;
  provider: string;
  modelName: string;
  modelFamily?: string;
  version?: string;
  releaseDate?: string;
  capabilities: {
    reasoning: number;
    coding: number;
    math: number;
    creative: number;
    vision: number;
    speed: number;
    costEfficiency: number;
  };
  contextWindow?: number;
  maxOutputTokens?: number;
  supportsFunctions: boolean;
  supportsVision: boolean;
  inputPrice?: number;
  outputPrice?: number;
  isAvailable: boolean;
  isDeprecated: boolean;
}

export interface RoutingPrediction {
  recommendedModel: string;
  confidence: number;
  alternativeModels: Array<{ model: string; score: number }>;
  reasoning: string;
}

// ============================================================================
// ML Training Service
// ============================================================================

export class MLTrainingService {
  // ============================================================================
  // Training Data Collection
  // ============================================================================

  async recordRoutingDecision(
    tenantId: string,
    taskText: string,
    specialty: string | null,
    modelsConsidered: string[],
    modelSelected: string,
    strategy: string,
    qualityScore?: number,
    latencyMs?: number,
    costCents?: number
  ): Promise<string> {
    const result = await executeStatement(
      `SELECT record_routing_for_training($1, $2, $3, $4, $5, $6, $7, $8, $9) as sample_id`,
      [
        { name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } },
        { name: 'taskText', value: { stringValue: taskText.substring(0, 5000) } },
        { name: 'specialty', value: specialty ? { stringValue: specialty } : { isNull: true } },
        { name: 'modelsConsidered', value: { stringValue: `{${modelsConsidered.join(',')}}` } },
        { name: 'modelSelected', value: { stringValue: modelSelected } },
        { name: 'strategy', value: { stringValue: strategy } },
        { name: 'qualityScore', value: qualityScore !== undefined ? { doubleValue: qualityScore } : { isNull: true } },
        { name: 'latencyMs', value: latencyMs !== undefined ? { longValue: latencyMs } : { isNull: true } },
        { name: 'costCents', value: costCents !== undefined ? { doubleValue: costCents } : { isNull: true } },
      ]
    );

    return (result.rows[0] as { sample_id: string }).sample_id;
  }

  async updateFeedback(
    sampleId: string,
    feedback: 'positive' | 'negative' | 'neutral',
    feedbackText?: string
  ): Promise<void> {
    await executeStatement(
      `SELECT update_training_feedback($1, $2, $3)`,
      [
        { name: 'sampleId', value: { stringValue: sampleId } },
        { name: 'feedback', value: { stringValue: feedback } },
        { name: 'feedbackText', value: feedbackText ? { stringValue: feedbackText } : { isNull: true } },
      ]
    );
  }

  async getTrainingStats(): Promise<{
    totalSamples: number;
    unusedSamples: number;
    positiveRatio: number;
    topModels: Array<{ model: string; count: number; avgQuality: number }>;
  }> {
    const result = await executeStatement(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE used_for_training = false) as unused,
        AVG(CASE WHEN was_good_choice THEN 1.0 ELSE 0.0 END) as positive_ratio
      FROM ml_routing_training_data`,
      []
    );

    const topModelsResult = await executeStatement(
      `SELECT model_selected, COUNT(*) as count, AVG(quality_score) as avg_quality
       FROM ml_routing_training_data
       WHERE quality_score IS NOT NULL
       GROUP BY model_selected
       ORDER BY count DESC
       LIMIT 10`,
      []
    );

    const stats = result.rows[0] as Record<string, unknown>;
    return {
      totalSamples: Number(stats.total || 0),
      unusedSamples: Number(stats.unused || 0),
      positiveRatio: Number(stats.positive_ratio || 0),
      topModels: topModelsResult.rows.map(r => ({
        model: String((r as Record<string, unknown>).model_selected),
        count: Number((r as Record<string, unknown>).count),
        avgQuality: Number((r as Record<string, unknown>).avg_quality || 0),
      })),
    };
  }

  // ============================================================================
  // Training Batch Management
  // ============================================================================

  async createTrainingBatch(batchName: string, modelType: string, minSamples = 1000): Promise<TrainingBatch> {
    const result = await executeStatement(
      `SELECT * FROM export_training_batch($1, $2, $3)`,
      [
        { name: 'batchName', value: { stringValue: batchName } },
        { name: 'modelType', value: { stringValue: modelType } },
        { name: 'minSamples', value: { longValue: minSamples } },
      ]
    );

    const row = result.rows[0] as { batch_id: string; samples_exported: number };
    return this.getTrainingBatch(row.batch_id) as Promise<TrainingBatch>;
  }

  async getTrainingBatch(batchId: string): Promise<TrainingBatch | null> {
    const result = await executeStatement(
      `SELECT * FROM ml_training_batches WHERE batch_id = $1`,
      [{ name: 'batchId', value: { stringValue: batchId } }]
    );

    if (result.rows.length === 0) return null;
    return this.mapTrainingBatch(result.rows[0] as Record<string, unknown>);
  }

  async listTrainingBatches(limit = 20): Promise<TrainingBatch[]> {
    const result = await executeStatement(
      `SELECT * FROM ml_training_batches ORDER BY created_at DESC LIMIT $1`,
      [{ name: 'limit', value: { longValue: limit } }]
    );

    return result.rows.map(r => this.mapTrainingBatch(r as Record<string, unknown>));
  }

  async updateBatchStatus(
    batchId: string,
    status: TrainingBatch['status'],
    metrics?: Record<string, unknown>
  ): Promise<void> {
    const updates: string[] = [`status = $2`];
    const params: Array<{ name: string; value: Record<string, unknown> }> = [
      { name: 'batchId', value: { stringValue: batchId } },
      { name: 'status', value: { stringValue: status } },
    ];

    if (status === 'training') {
      updates.push(`started_at = NOW()`);
    }
    if (status === 'completed' || status === 'failed') {
      updates.push(`completed_at = NOW()`);
    }
    if (metrics) {
      if (status === 'training') {
        updates.push(`training_metrics = $${params.length + 1}`);
        params.push({ name: 'trainingMetrics', value: { stringValue: JSON.stringify(metrics) } });
      } else if (status === 'completed') {
        updates.push(`evaluation_metrics = $${params.length + 1}`);
        params.push({ name: 'evalMetrics', value: { stringValue: JSON.stringify(metrics) } });
      }
    }

    await executeStatement(
      `UPDATE ml_training_batches SET ${updates.join(', ')} WHERE batch_id = $1`,
      params
    );
  }

  // ============================================================================
  // Model Version Management
  // ============================================================================

  async createModelVersion(
    modelType: string,
    trainingBatchId: string,
    sagemakerEndpoint?: string
  ): Promise<MLModelVersion> {
    // Get next version number
    const versionResult = await executeStatement(
      `SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
       FROM ml_model_versions WHERE model_type = $1`,
      [{ name: 'modelType', value: { stringValue: modelType } }]
    );
    const nextVersion = Number((versionResult.rows[0] as { next_version: number }).next_version);

    const result = await executeStatement(
      `INSERT INTO ml_model_versions (model_type, version_number, training_batch_id, sagemaker_endpoint)
       VALUES ($1, $2, $3, $4)
       RETURNING version_id`,
      [
        { name: 'modelType', value: { stringValue: modelType } },
        { name: 'versionNumber', value: { longValue: nextVersion } },
        { name: 'batchId', value: { stringValue: trainingBatchId } },
        { name: 'endpoint', value: sagemakerEndpoint ? { stringValue: sagemakerEndpoint } : { isNull: true } },
      ]
    );

    const versionId = (result.rows[0] as { version_id: string }).version_id;
    return this.getModelVersion(versionId) as Promise<MLModelVersion>;
  }

  async getModelVersion(versionId: string): Promise<MLModelVersion | null> {
    const result = await executeStatement(
      `SELECT * FROM ml_model_versions WHERE version_id = $1`,
      [{ name: 'versionId', value: { stringValue: versionId } }]
    );

    if (result.rows.length === 0) return null;
    return this.mapModelVersion(result.rows[0] as Record<string, unknown>);
  }

  async getActiveModelVersion(modelType: string): Promise<MLModelVersion | null> {
    const result = await executeStatement(
      `SELECT * FROM ml_model_versions WHERE model_type = $1 AND is_active = true`,
      [{ name: 'modelType', value: { stringValue: modelType } }]
    );

    if (result.rows.length === 0) return null;
    return this.mapModelVersion(result.rows[0] as Record<string, unknown>);
  }

  async activateModelVersion(versionId: string): Promise<void> {
    // Get model type
    const version = await this.getModelVersion(versionId);
    if (!version) throw new Error('Version not found');

    // Deactivate all other versions of this type
    await executeStatement(
      `UPDATE ml_model_versions SET is_active = false, deactivated_at = NOW()
       WHERE model_type = $1 AND is_active = true`,
      [{ name: 'modelType', value: { stringValue: version.modelType } }]
    );

    // Activate this version
    await executeStatement(
      `UPDATE ml_model_versions SET is_active = true, activated_at = NOW(), traffic_percentage = 100
       WHERE version_id = $1`,
      [{ name: 'versionId', value: { stringValue: versionId } }]
    );
  }

  // ============================================================================
  // AI Model Registry
  // ============================================================================

  async getAvailableModels(options: {
    provider?: string;
    capability?: keyof AIModelInfo['capabilities'];
    minCapabilityScore?: number;
    supportsVision?: boolean;
  } = {}): Promise<AIModelInfo[]> {
    let sql = `SELECT * FROM ai_model_registry WHERE is_available = true AND is_deprecated = false`;
    const params: Array<{ name: string; value: Record<string, unknown> }> = [];

    if (options.provider) {
      sql += ` AND provider = $${params.length + 1}`;
      params.push({ name: 'provider', value: { stringValue: options.provider } });
    }

    if (options.capability && options.minCapabilityScore !== undefined) {
      const capColumn = `cap_${options.capability}`;
      sql += ` AND ${capColumn} >= $${params.length + 1}`;
      params.push({ name: 'minScore', value: { doubleValue: options.minCapabilityScore } });
    }

    if (options.supportsVision !== undefined) {
      sql += ` AND supports_vision = $${params.length + 1}`;
      params.push({ name: 'supportsVision', value: { booleanValue: options.supportsVision } });
    }

    sql += ` ORDER BY cap_reasoning DESC`;

    const result = await executeStatement(sql, params);
    return result.rows.map(r => this.mapAIModel(r as Record<string, unknown>));
  }

  async getModelById(modelId: string): Promise<AIModelInfo | null> {
    const result = await executeStatement(
      `SELECT * FROM ai_model_registry WHERE model_id = $1`,
      [{ name: 'modelId', value: { stringValue: modelId } }]
    );

    if (result.rows.length === 0) return null;
    return this.mapAIModel(result.rows[0] as Record<string, unknown>);
  }

  async getBestModelForTask(
    taskType: 'reasoning' | 'coding' | 'math' | 'creative' | 'vision' | 'speed' | 'cost',
    requireVision = false
  ): Promise<AIModelInfo | null> {
    const capColumn = taskType === 'cost' ? 'cap_cost_efficiency' : `cap_${taskType}`;
    
    const result = await executeStatement(
      `SELECT * FROM ai_model_registry 
       WHERE is_available = true AND is_deprecated = false
       ${requireVision ? 'AND supports_vision = true' : ''}
       ORDER BY ${capColumn} DESC
       LIMIT 1`,
      []
    );

    if (result.rows.length === 0) return null;
    return this.mapAIModel(result.rows[0] as Record<string, unknown>);
  }

  async updateModelAvailability(modelId: string, isAvailable: boolean): Promise<void> {
    await executeStatement(
      `UPDATE ai_model_registry SET is_available = $2, updated_at = NOW() WHERE model_id = $1`,
      [
        { name: 'modelId', value: { stringValue: modelId } },
        { name: 'isAvailable', value: { booleanValue: isAvailable } },
      ]
    );
  }

  async deprecateModel(modelId: string, successorModelId?: string): Promise<void> {
    await executeStatement(
      `UPDATE ai_model_registry SET 
        is_deprecated = true, 
        deprecation_date = CURRENT_DATE,
        is_latest = false,
        updated_at = NOW()
       WHERE model_id = $1`,
      [{ name: 'modelId', value: { stringValue: modelId } }]
    );

    if (successorModelId) {
      await executeStatement(
        `UPDATE ai_model_registry SET is_latest = true WHERE model_id = $1`,
        [{ name: 'successorId', value: { stringValue: successorModelId } }]
      );
    }
  }

  // ============================================================================
  // ML-Based Routing (when trained model is available)
  // ============================================================================

  async predictBestModel(
    taskText: string,
    specialty?: string,
    requireVision = false
  ): Promise<RoutingPrediction> {
    // Check if we have an active ML model
    const activeModel = await this.getActiveModelVersion('routing');

    if (activeModel?.sagemakerEndpoint) {
      try {
        const response = await sagemakerClient.send(
          new InvokeEndpointCommand({
            EndpointName: activeModel.sagemakerEndpoint,
            ContentType: 'application/json',
            Body: JSON.stringify({
              task_text: taskText,
              specialty: specialty || null,
              require_vision: requireVision,
            }),
          })
        );

        if (response.Body) {
          const result = JSON.parse(new TextDecoder().decode(response.Body));
          return {
            recommendedModel: result.recommended_model,
            confidence: result.confidence || 0.85,
            alternativeModels: result.alternatives || [],
            reasoning: 'ML model prediction based on trained routing model',
          };
        }
      } catch (error) {
        logger.warn('SageMaker prediction failed, falling back to heuristic', { 
          endpoint: activeModel.sagemakerEndpoint,
          error 
        });
        // Fall through to heuristic
      }
    }

    // Heuristic-based routing using historical data
    const result = await executeStatement(
      `SELECT get_ml_best_model($1, 'moderate') as best_model`,
      [{ name: 'specialty', value: specialty ? { stringValue: specialty } : { isNull: true } }]
    );

    const bestModel = (result.rows[0] as { best_model: string | null }).best_model;

    // Get alternatives
    const alternatives = await this.getAvailableModels({
      supportsVision: requireVision || undefined,
    });

    return {
      recommendedModel: bestModel || 'anthropic/claude-3-5-sonnet-20241022',
      confidence: activeModel ? 0.85 : 0.6, // Higher confidence if ML model is active
      alternativeModels: alternatives.slice(0, 5).map(m => ({
        model: m.modelId,
        score: m.capabilities.reasoning,
      })),
      reasoning: activeModel 
        ? 'ML model prediction based on historical performance'
        : 'Heuristic selection based on specialty and historical quality scores',
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private mapTrainingBatch(row: Record<string, unknown>): TrainingBatch {
    return {
      batchId: String(row.batch_id),
      batchName: String(row.batch_name),
      modelType: String(row.model_type),
      samplesCount: Number(row.samples_count || 0),
      status: row.status as TrainingBatch['status'],
      sagemakerTrainingJob: row.sagemaker_training_job ? String(row.sagemaker_training_job) : undefined,
      sagemakerEndpoint: row.sagemaker_endpoint ? String(row.sagemaker_endpoint) : undefined,
      trainingMetrics: row.training_metrics ? (typeof row.training_metrics === 'string' ? JSON.parse(row.training_metrics) : row.training_metrics) as Record<string, number> : undefined,
      evaluationMetrics: row.evaluation_metrics ? (typeof row.evaluation_metrics === 'string' ? JSON.parse(row.evaluation_metrics) : row.evaluation_metrics) as Record<string, number> : undefined,
      createdAt: String(row.created_at),
      completedAt: row.completed_at ? String(row.completed_at) : undefined,
    };
  }

  private mapModelVersion(row: Record<string, unknown>): MLModelVersion {
    return {
      versionId: String(row.version_id),
      modelType: String(row.model_type),
      versionNumber: Number(row.version_number),
      sagemakerEndpoint: row.sagemaker_endpoint ? String(row.sagemaker_endpoint) : undefined,
      isActive: Boolean(row.is_active),
      accuracy: row.accuracy ? Number(row.accuracy) : undefined,
      latencyP50Ms: row.latency_p50_ms ? Number(row.latency_p50_ms) : undefined,
      trafficPercentage: Number(row.traffic_percentage || 0),
      createdAt: String(row.created_at),
    };
  }

  private mapAIModel(row: Record<string, unknown>): AIModelInfo {
    return {
      modelId: String(row.model_id),
      provider: String(row.provider),
      modelName: String(row.model_name),
      modelFamily: row.model_family ? String(row.model_family) : undefined,
      version: row.version ? String(row.version) : undefined,
      releaseDate: row.release_date ? String(row.release_date) : undefined,
      capabilities: {
        reasoning: Number(row.cap_reasoning ?? 0.5),
        coding: Number(row.cap_coding ?? 0.5),
        math: Number(row.cap_math ?? 0.5),
        creative: Number(row.cap_creative ?? 0.5),
        vision: Number(row.cap_vision ?? 0),
        speed: Number(row.cap_speed ?? 0.5),
        costEfficiency: Number(row.cap_cost_efficiency ?? 0.5),
      },
      contextWindow: row.context_window ? Number(row.context_window) : undefined,
      maxOutputTokens: row.max_output_tokens ? Number(row.max_output_tokens) : undefined,
      supportsFunctions: Boolean(row.supports_functions),
      supportsVision: Boolean(row.supports_vision),
      inputPrice: row.input_price ? Number(row.input_price) : undefined,
      outputPrice: row.output_price ? Number(row.output_price) : undefined,
      isAvailable: Boolean(row.is_available ?? true),
      isDeprecated: Boolean(row.is_deprecated),
    };
  }
}

export const mlTrainingService = new MLTrainingService();
