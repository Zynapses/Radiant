/**
 * Inference Student Service
 * Manages fine-tuned student models that mimic teacher reasoning.
 * RADIANT v6.1.0
 */

import type { StudentVersion, StudentInferenceRequest, StudentInferenceResponse } from '@radiant/shared';
import { STUDENT_TRAINING_CONFIG, STUDENT_INFERENCE_DEFAULTS } from '@radiant/shared/constants';
import { getDbPool } from './database';
import { SageMakerRuntimeClient, InvokeEndpointCommand } from '@aws-sdk/client-sagemaker-runtime';

export class InferenceStudentService {
  private sagemakerClient: SageMakerRuntimeClient;
  private activeVersionCache: Map<string, StudentVersion> = new Map();
  
  constructor() {
    this.sagemakerClient = new SageMakerRuntimeClient({});
  }
  
  async generate(request: StudentInferenceRequest): Promise<StudentInferenceResponse> {
    const startTime = Date.now();
    const activeVersion = await this.getActiveVersion(request.tenantId);
    
    if (!activeVersion || !activeVersion.sagemakerEndpointName) {
      throw new Error(`No active student model for tenant ${request.tenantId}`);
    }
    
    const n = Math.min(
      request.n ?? STUDENT_INFERENCE_DEFAULTS.defaultN,
      STUDENT_INFERENCE_DEFAULTS.maxN
    );
    
    const responses: string[] = [];
    let totalTokens = 0;
    
    for (let i = 0; i < n; i++) {
      const result = await this.invokeEndpoint(
        activeVersion.sagemakerEndpointName,
        request.prompt,
        request.context,
        {
          temperature: request.temperature ?? STUDENT_INFERENCE_DEFAULTS.defaultTemperature,
          max_tokens: request.maxTokens ?? STUDENT_INFERENCE_DEFAULTS.defaultMaxTokens,
          seed: i > 0 ? Date.now() + i : undefined,
        }
      );
      
      responses.push(result.text);
      totalTokens += result.tokensUsed;
    }
    
    return {
      responses,
      latencyMs: Date.now() - startTime,
      tokensUsed: totalTokens,
      modelVersion: activeVersion.versionNumber,
    };
  }
  
  async generateSingle(
    prompt: string,
    context: Record<string, unknown>,
    tenantId: string,
    userId: string
  ): Promise<string> {
    const result = await this.generate({ prompt, context, tenantId, userId, n: 1 });
    return result.responses[0];
  }
  
  async generateMultiple(
    prompt: string,
    context: Record<string, unknown>,
    tenantId: string,
    userId: string,
    n: number = 4
  ): Promise<string[]> {
    const result = await this.generate({ prompt, context, tenantId, userId, n });
    return result.responses;
  }
  
  private async invokeEndpoint(
    endpointName: string,
    prompt: string,
    context: Record<string, unknown>,
    options: { temperature: number; max_tokens: number; seed?: number }
  ): Promise<{ text: string; tokensUsed: number }> {
    const payload = JSON.stringify({
      inputs: prompt,
      parameters: {
        temperature: options.temperature,
        max_new_tokens: options.max_tokens,
        do_sample: options.temperature > 0,
        seed: options.seed,
        return_full_text: false,
      },
      context: context,
    });
    
    const command = new InvokeEndpointCommand({
      EndpointName: endpointName,
      ContentType: 'application/json',
      Body: payload,
    });
    
    const response = await this.sagemakerClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.Body));
    
    return {
      text: responseBody[0]?.generated_text || responseBody.generated_text || '',
      tokensUsed: responseBody.details?.generated_tokens || 0,
    };
  }
  
  async getActiveVersion(tenantId: string): Promise<StudentVersion | null> {
    if (this.activeVersionCache.has(tenantId)) {
      return this.activeVersionCache.get(tenantId)!;
    }
    
    const pool = await getDbPool();
    const result = await pool.query(`
      SELECT * FROM inference_student_versions
      WHERE tenant_id = $1 AND is_active = true
      ORDER BY version_number DESC LIMIT 1
    `, [tenantId]);
    
    if (result.rows.length === 0) return null;
    
    const version = this.rowToVersion(result.rows[0]);
    this.activeVersionCache.set(tenantId, version);
    return version;
  }
  
  async getAllVersions(tenantId: string): Promise<StudentVersion[]> {
    const pool = await getDbPool();
    const result = await pool.query(`
      SELECT * FROM inference_student_versions
      WHERE tenant_id = $1
      ORDER BY version_number DESC
    `, [tenantId]);
    
    return result.rows.map(this.rowToVersion);
  }
  
  async deploy(
    tenantId: string,
    trainingJobId: string,
    modelArtifactS3: string
  ): Promise<StudentVersion> {
    const pool = await getDbPool();
    
    const versionResult = await pool.query(`
      SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
      FROM inference_student_versions WHERE tenant_id = $1
    `, [tenantId]);
    
    const versionNumber = versionResult.rows[0].next_version;
    const endpointName = `radiant-student-${tenantId.slice(0, 8)}-v${versionNumber}`;
    
    await this.createSagemakerEndpoint(endpointName, modelArtifactS3);
    
    const id = crypto.randomUUID();
    await pool.query(`
      INSERT INTO inference_student_versions (
        id, tenant_id, version_number, base_model, training_job_id,
        sagemaker_endpoint_name, is_active, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, false, NOW())
    `, [id, tenantId, versionNumber, 'llama-3-70b', trainingJobId, endpointName]);
    
    return {
      id,
      tenantId,
      versionNumber,
      baseModel: 'llama-3-70b',
      trainingJobId,
      trainingExamplesCount: 0,
      trainingEpochs: STUDENT_TRAINING_CONFIG.defaultEpochs,
      accuracyScore: null,
      latencyP50Ms: null,
      latencyP99Ms: null,
      sagemakerEndpointName: endpointName,
      isActive: false,
      promotedAt: null,
      createdAt: new Date(),
    };
  }
  
  async promote(tenantId: string, versionId: string): Promise<void> {
    const pool = await getDbPool();
    
    await pool.query(`
      UPDATE inference_student_versions SET is_active = false
      WHERE tenant_id = $1 AND is_active = true
    `, [tenantId]);
    
    await pool.query(`
      UPDATE inference_student_versions SET is_active = true, promoted_at = NOW()
      WHERE id = $1 AND tenant_id = $2
    `, [versionId, tenantId]);
    
    this.activeVersionCache.delete(tenantId);
  }
  
  async rollback(tenantId: string): Promise<StudentVersion | null> {
    const pool = await getDbPool();
    
    const result = await pool.query(`
      SELECT * FROM inference_student_versions
      WHERE tenant_id = $1 AND promoted_at IS NOT NULL
      ORDER BY promoted_at DESC OFFSET 1 LIMIT 1
    `, [tenantId]);
    
    if (result.rows.length === 0) return null;
    
    const previousVersion = this.rowToVersion(result.rows[0]);
    await this.promote(tenantId, previousVersion.id);
    return previousVersion;
  }
  
  async updateMetrics(
    versionId: string,
    metrics: { accuracyScore?: number; latencyP50Ms?: number; latencyP99Ms?: number }
  ): Promise<void> {
    const pool = await getDbPool();
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;
    
    if (metrics.accuracyScore !== undefined) {
      updates.push(`accuracy_score = $${idx++}`);
      values.push(metrics.accuracyScore);
    }
    if (metrics.latencyP50Ms !== undefined) {
      updates.push(`latency_p50_ms = $${idx++}`);
      values.push(metrics.latencyP50Ms);
    }
    if (metrics.latencyP99Ms !== undefined) {
      updates.push(`latency_p99_ms = $${idx++}`);
      values.push(metrics.latencyP99Ms);
    }
    
    if (updates.length > 0) {
      values.push(versionId);
      await pool.query(`
        UPDATE inference_student_versions SET ${updates.join(', ')}
        WHERE id = $${idx}
      `, values);
    }
  }
  
  private async createSagemakerEndpoint(endpointName: string, modelArtifactS3: string): Promise<void> {
    console.log(`Creating SageMaker endpoint: ${endpointName} from ${modelArtifactS3}`);
  }
  
  clearCache(tenantId?: string): void {
    if (tenantId) {
      this.activeVersionCache.delete(tenantId);
    } else {
      this.activeVersionCache.clear();
    }
  }
  
  private rowToVersion(row: any): StudentVersion {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      versionNumber: row.version_number,
      baseModel: row.base_model,
      trainingJobId: row.training_job_id,
      trainingExamplesCount: row.training_examples_count || 0,
      trainingEpochs: row.training_epochs || STUDENT_TRAINING_CONFIG.defaultEpochs,
      accuracyScore: row.accuracy_score ? parseFloat(row.accuracy_score) : null,
      latencyP50Ms: row.latency_p50_ms,
      latencyP99Ms: row.latency_p99_ms,
      sagemakerEndpointName: row.sagemaker_endpoint_name,
      isActive: row.is_active,
      promotedAt: row.promoted_at ? new Date(row.promoted_at) : null,
      createdAt: new Date(row.created_at),
    };
  }
}

export const inferenceStudent = new InferenceStudentService();
