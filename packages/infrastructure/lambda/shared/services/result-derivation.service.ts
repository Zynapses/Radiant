// RADIANT v4.18.0 - Result Derivation Service
// Aggregates and provides comprehensive execution history for Think Tank results

import { executeStatement } from '../utils/database';
import type {
  ResultDerivation,
  DerivationPlan,
  DerivationStep,
  ModelUsageRecord,
  WorkflowExecution,
  WorkflowPhase,
  DomainDetectionRecord,
  OrchestrationRecord,
  QualityMetrics,
  TimingRecord,
  CostRecord,
  DerivationSummary,
  DerivationTimeline,
  DerivationTimelineEvent,
  ListDerivationsRequest,
  DerivationAnalytics,
} from '@radiant/shared';

// ============================================================================
// Types
// ============================================================================

interface CreateDerivationInput {
  sessionId: string;
  promptId: string;
  tenantId: string;
  userId: string;
  originalPrompt: string;
}

interface RecordModelUsageInput {
  derivationId: string;
  modelId: string;
  modelDisplayName: string;
  modelFamily: string;
  provider: 'self-hosted' | 'external';
  purpose: string;
  stepId?: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  inputCost: number;
  outputCost: number;
  selectionReason: string;
  qualityTier: 'premium' | 'standard' | 'economy';
}

interface UpdateStepInput {
  derivationId: string;
  stepId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  modelId?: string;
  modelDisplayName?: string;
  durationMs?: number;
  error?: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// Service
// ============================================================================

class ResultDerivationService {
  
  /**
   * Create a new derivation record when a prompt execution starts
   */
  async createDerivation(input: CreateDerivationInput): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO result_derivations (
         session_id, prompt_id, tenant_id, user_id, original_prompt, status
       ) VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING id`,
      [
        { name: 'sessionId', value: { stringValue: input.sessionId } },
        { name: 'promptId', value: { stringValue: input.promptId } },
        { name: 'tenantId', value: { stringValue: input.tenantId } },
        { name: 'userId', value: { stringValue: input.userId } },
        { name: 'prompt', value: { stringValue: input.originalPrompt } },
      ]
    );
    
    return result.records?.[0]?.[0]?.stringValue || '';
  }
  
  /**
   * Record the plan that was generated for execution
   */
  async recordPlan(
    derivationId: string,
    plan: DerivationPlan
  ): Promise<void> {
    await executeStatement(
      `UPDATE result_derivations SET
         plan = $2,
         plan_mode = $3,
         plan_generated_at = $4,
         plan_generation_latency_ms = $5
       WHERE id = $1`,
      [
        { name: 'id', value: { stringValue: derivationId } },
        { name: 'plan', value: { stringValue: JSON.stringify(plan) } },
        { name: 'mode', value: { stringValue: plan.mode } },
        { name: 'generatedAt', value: { stringValue: plan.generatedAt.toISOString() } },
        { name: 'latency', value: { longValue: plan.generationLatencyMs } },
      ]
    );
    
    // Record individual steps
    for (const step of plan.steps) {
      await this.recordStep(derivationId, step);
    }
  }
  
  /**
   * Record a step in the plan
   */
  async recordStep(
    derivationId: string,
    step: DerivationStep
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO derivation_steps (
         derivation_id, step_id, step_number, step_type, name, description, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (derivation_id, step_id) DO UPDATE SET
         status = $7`,
      [
        { name: 'derivationId', value: { stringValue: derivationId } },
        { name: 'stepId', value: { stringValue: step.stepId } },
        { name: 'stepNumber', value: { longValue: step.stepNumber } },
        { name: 'stepType', value: { stringValue: step.type } },
        { name: 'name', value: { stringValue: step.name } },
        { name: 'description', value: { stringValue: step.description } },
        { name: 'status', value: { stringValue: step.status } },
      ]
    );
  }
  
  /**
   * Update a step's status and details
   */
  async updateStep(input: UpdateStepInput): Promise<void> {
    await executeStatement(
      `UPDATE derivation_steps SET
         status = $3,
         model_id = COALESCE($4, model_id),
         model_display_name = COALESCE($5, model_display_name),
         duration_ms = COALESCE($6, duration_ms),
         error = $7,
         details = COALESCE($8, details),
         completed_at = CASE WHEN $3 IN ('completed', 'failed', 'skipped') THEN NOW() ELSE completed_at END,
         started_at = CASE WHEN $3 = 'in_progress' AND started_at IS NULL THEN NOW() ELSE started_at END
       WHERE derivation_id = $1 AND step_id = $2`,
      [
        { name: 'derivationId', value: { stringValue: input.derivationId } },
        { name: 'stepId', value: { stringValue: input.stepId } },
        { name: 'status', value: { stringValue: input.status } },
        { name: 'modelId', value: input.modelId ? { stringValue: input.modelId } : { isNull: true } },
        { name: 'modelDisplayName', value: input.modelDisplayName ? { stringValue: input.modelDisplayName } : { isNull: true } },
        { name: 'durationMs', value: input.durationMs ? { longValue: input.durationMs } : { isNull: true } },
        { name: 'error', value: input.error ? { stringValue: input.error } : { isNull: true } },
        { name: 'details', value: input.details ? { stringValue: JSON.stringify(input.details) } : { isNull: true } },
      ]
    );
  }
  
  /**
   * Record model usage during execution
   */
  async recordModelUsage(input: RecordModelUsageInput): Promise<void> {
    await executeStatement(
      `INSERT INTO derivation_model_usage (
         derivation_id, model_id, model_display_name, model_family, provider,
         purpose, step_id, input_tokens, output_tokens, total_tokens,
         latency_ms, input_cost, output_cost, total_cost,
         selection_reason, quality_tier
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        { name: 'derivationId', value: { stringValue: input.derivationId } },
        { name: 'modelId', value: { stringValue: input.modelId } },
        { name: 'modelDisplayName', value: { stringValue: input.modelDisplayName } },
        { name: 'modelFamily', value: { stringValue: input.modelFamily } },
        { name: 'provider', value: { stringValue: input.provider } },
        { name: 'purpose', value: { stringValue: input.purpose } },
        { name: 'stepId', value: input.stepId ? { stringValue: input.stepId } : { isNull: true } },
        { name: 'inputTokens', value: { longValue: input.inputTokens } },
        { name: 'outputTokens', value: { longValue: input.outputTokens } },
        { name: 'totalTokens', value: { longValue: input.inputTokens + input.outputTokens } },
        { name: 'latencyMs', value: { longValue: input.latencyMs } },
        { name: 'inputCost', value: { doubleValue: input.inputCost } },
        { name: 'outputCost', value: { doubleValue: input.outputCost } },
        { name: 'totalCost', value: { doubleValue: input.inputCost + input.outputCost } },
        { name: 'selectionReason', value: { stringValue: input.selectionReason } },
        { name: 'qualityTier', value: { stringValue: input.qualityTier } },
      ]
    );
  }
  
  /**
   * Record domain detection results
   */
  async recordDomainDetection(
    derivationId: string,
    detection: DomainDetectionRecord
  ): Promise<void> {
    await executeStatement(
      `UPDATE result_derivations SET
         domain_detection = $2,
         detected_field = $3,
         detected_domain = $4,
         detected_subspecialty = $5,
         domain_confidence = $6
       WHERE id = $1`,
      [
        { name: 'id', value: { stringValue: derivationId } },
        { name: 'detection', value: { stringValue: JSON.stringify(detection) } },
        { name: 'field', value: { stringValue: detection.detectedField } },
        { name: 'domain', value: { stringValue: detection.detectedDomain } },
        { name: 'subspecialty', value: detection.detectedSubspecialty ? { stringValue: detection.detectedSubspecialty } : { isNull: true } },
        { name: 'confidence', value: { doubleValue: detection.domainConfidence } },
      ]
    );
  }
  
  /**
   * Record orchestration details
   */
  async recordOrchestration(
    derivationId: string,
    orchestration: OrchestrationRecord
  ): Promise<void> {
    await executeStatement(
      `UPDATE result_derivations SET
         orchestration = $2,
         model_selection_strategy = $3,
         complexity_score = $4
       WHERE id = $1`,
      [
        { name: 'id', value: { stringValue: derivationId } },
        { name: 'orchestration', value: { stringValue: JSON.stringify(orchestration) } },
        { name: 'strategy', value: { stringValue: orchestration.modelSelectionStrategy } },
        { name: 'complexity', value: { doubleValue: orchestration.complexityScore } },
      ]
    );
  }
  
  /**
   * Record workflow execution
   */
  async recordWorkflow(
    derivationId: string,
    workflow: WorkflowExecution
  ): Promise<void> {
    await executeStatement(
      `UPDATE result_derivations SET
         workflow = $2,
         workflow_type = $3,
         workflow_status = $4
       WHERE id = $1`,
      [
        { name: 'id', value: { stringValue: derivationId } },
        { name: 'workflow', value: { stringValue: JSON.stringify(workflow) } },
        { name: 'type', value: { stringValue: workflow.workflowType } },
        { name: 'status', value: { stringValue: workflow.overallStatus } },
      ]
    );
  }
  
  /**
   * Complete the derivation with final response and metrics
   */
  async completeDerivation(
    derivationId: string,
    finalResponse: string,
    quality: QualityMetrics,
    timing: TimingRecord,
    costs: CostRecord
  ): Promise<void> {
    await executeStatement(
      `UPDATE result_derivations SET
         final_response = $2,
         quality_metrics = $3,
         overall_quality_score = $4,
         timing = $5,
         total_duration_ms = $6,
         costs = $7,
         total_cost = $8,
         status = 'completed',
         completed_at = NOW()
       WHERE id = $1`,
      [
        { name: 'id', value: { stringValue: derivationId } },
        { name: 'response', value: { stringValue: finalResponse } },
        { name: 'quality', value: { stringValue: JSON.stringify(quality) } },
        { name: 'qualityScore', value: { doubleValue: quality.overallScore } },
        { name: 'timing', value: { stringValue: JSON.stringify(timing) } },
        { name: 'durationMs', value: { longValue: timing.totalDurationMs } },
        { name: 'costs', value: { stringValue: JSON.stringify(costs) } },
        { name: 'totalCost', value: { doubleValue: costs.totalCost } },
      ]
    );
  }
  
  /**
   * Mark derivation as failed
   */
  async failDerivation(derivationId: string, error: string): Promise<void> {
    await executeStatement(
      `UPDATE result_derivations SET
         status = 'failed',
         error = $2,
         completed_at = NOW()
       WHERE id = $1`,
      [
        { name: 'id', value: { stringValue: derivationId } },
        { name: 'error', value: { stringValue: error } },
      ]
    );
  }
  
  /**
   * Get full derivation history
   */
  async getDerivation(derivationId: string): Promise<ResultDerivation | null> {
    const result = await executeStatement(
      `SELECT 
         rd.*,
         (SELECT json_agg(ds.* ORDER BY ds.step_number) FROM derivation_steps ds WHERE ds.derivation_id = rd.id) as steps,
         (SELECT json_agg(dmu.*) FROM derivation_model_usage dmu WHERE dmu.derivation_id = rd.id) as model_usage
       FROM result_derivations rd
       WHERE rd.id = $1`,
      [{ name: 'id', value: { stringValue: derivationId } }]
    );
    
    if (!result.records || result.records.length === 0) {
      return null;
    }
    
    return this.mapRecordToDerivation(result.records[0]);
  }
  
  /**
   * Get derivation by prompt ID
   */
  async getDerivationByPromptId(promptId: string): Promise<ResultDerivation | null> {
    const result = await executeStatement(
      `SELECT 
         rd.*,
         (SELECT json_agg(ds.* ORDER BY ds.step_number) FROM derivation_steps ds WHERE ds.derivation_id = rd.id) as steps,
         (SELECT json_agg(dmu.*) FROM derivation_model_usage dmu WHERE dmu.derivation_id = rd.id) as model_usage
       FROM result_derivations rd
       WHERE rd.prompt_id = $1
       ORDER BY rd.created_at DESC
       LIMIT 1`,
      [{ name: 'promptId', value: { stringValue: promptId } }]
    );
    
    if (!result.records || result.records.length === 0) {
      return null;
    }
    
    return this.mapRecordToDerivation(result.records[0]);
  }
  
  /**
   * List derivations with filtering
   */
  async listDerivations(request: ListDerivationsRequest): Promise<DerivationSummary[]> {
    let sql = `
      SELECT 
        id, original_prompt, final_response, plan_mode,
        detected_domain, total_duration_ms, total_cost, overall_quality_score,
        created_at,
        (SELECT COUNT(*) FROM derivation_model_usage dmu WHERE dmu.derivation_id = rd.id) as models_used_count,
        (SELECT model_display_name FROM derivation_model_usage dmu WHERE dmu.derivation_id = rd.id AND dmu.purpose = 'primary_generation' LIMIT 1) as primary_model
      FROM result_derivations rd
      WHERE 1=1
    `;
    const params: Array<{ name: string; value: Record<string, unknown> }> = [];
    let paramIndex = 1;
    
    if (request.sessionId) {
      sql += ` AND session_id = $${paramIndex++}`;
      params.push({ name: 'sessionId', value: { stringValue: request.sessionId } });
    }
    
    if (request.userId) {
      sql += ` AND user_id = $${paramIndex++}`;
      params.push({ name: 'userId', value: { stringValue: request.userId } });
    }
    
    if (request.startDate) {
      sql += ` AND created_at >= $${paramIndex++}`;
      params.push({ name: 'startDate', value: { stringValue: request.startDate.toISOString() } });
    }
    
    if (request.endDate) {
      sql += ` AND created_at <= $${paramIndex++}`;
      params.push({ name: 'endDate', value: { stringValue: request.endDate.toISOString() } });
    }
    
    sql += ` ORDER BY created_at DESC`;
    sql += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push({ name: 'limit', value: { longValue: request.limit || 20 } });
    params.push({ name: 'offset', value: { longValue: request.offset || 0 } });
    
    const result = await executeStatement(sql, params);
    
    return (result.records || []).map(record => this.mapRecordToSummary(record));
  }
  
  /**
   * Get derivation timeline for visualization
   */
  async getDerivationTimeline(derivationId: string): Promise<DerivationTimeline> {
    const derivation = await this.getDerivation(derivationId);
    if (!derivation) {
      return { events: [] };
    }
    
    const events: DerivationTimelineEvent[] = [];
    
    // Plan start event
    if (derivation.plan) {
      events.push({
        timestamp: derivation.plan.generatedAt,
        eventType: 'plan_start',
        title: 'Plan Generated',
        description: `${derivation.plan.mode} mode with ${derivation.plan.steps.length} steps`,
        durationMs: derivation.plan.generationLatencyMs,
      });
      
      // Step events
      for (const step of derivation.plan.steps) {
        if (step.startedAt) {
          events.push({
            timestamp: step.startedAt,
            eventType: 'step_start',
            title: `Started: ${step.name}`,
            description: step.description,
          });
        }
        
        if (step.completedAt) {
          events.push({
            timestamp: step.completedAt,
            eventType: 'step_complete',
            title: `Completed: ${step.name}`,
            description: step.status === 'completed' ? 'Success' : step.error || 'Failed',
            durationMs: step.durationMs,
            modelId: step.modelId,
          });
        }
      }
    }
    
    // Model call events
    for (const usage of derivation.modelsUsed) {
      events.push({
        timestamp: derivation.createdAt, // Approximate
        eventType: 'model_call',
        title: `Model: ${usage.modelDisplayName}`,
        description: `${usage.purpose}: ${usage.totalTokens} tokens`,
        durationMs: usage.latencyMs,
        modelId: usage.modelId,
        details: {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cost: usage.totalCost,
        },
      });
    }
    
    // Completion event
    if (derivation.completedAt) {
      events.push({
        timestamp: derivation.completedAt,
        eventType: 'complete',
        title: 'Execution Complete',
        description: `Quality: ${derivation.qualityMetrics.overallScore}/100, Cost: $${derivation.costs.totalCost.toFixed(4)}`,
        durationMs: derivation.timing.totalDurationMs,
      });
    }
    
    // Sort by timestamp
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    return { events };
  }
  
  /**
   * Get analytics for derivations
   */
  async getAnalytics(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<DerivationAnalytics> {
    const result = await executeStatement(
      `SELECT
         COUNT(*) as total,
         AVG(total_duration_ms) as avg_duration,
         AVG(total_cost) as avg_cost,
         AVG(overall_quality_score) as avg_quality,
         json_object_agg(plan_mode, mode_count) as mode_distribution,
         json_object_agg(detected_domain, domain_count) as domain_distribution
       FROM (
         SELECT 
           plan_mode,
           detected_domain,
           total_duration_ms,
           total_cost,
           overall_quality_score,
           COUNT(*) OVER (PARTITION BY plan_mode) as mode_count,
           COUNT(*) OVER (PARTITION BY detected_domain) as domain_count
         FROM result_derivations
         WHERE tenant_id = $1
         AND created_at >= $2
         AND created_at <= $3
       ) sub`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'startDate', value: { stringValue: startDate.toISOString() } },
        { name: 'endDate', value: { stringValue: endDate.toISOString() } },
      ]
    );
    
    // Get top models
    const modelResult = await executeStatement(
      `SELECT 
         model_id, 
         COUNT(*) as usage_count,
         AVG(overall_quality_score) as avg_quality
       FROM derivation_model_usage dmu
       JOIN result_derivations rd ON dmu.derivation_id = rd.id
       WHERE rd.tenant_id = $1
       AND rd.created_at >= $2
       AND rd.created_at <= $3
       GROUP BY model_id
       ORDER BY usage_count DESC
       LIMIT 10`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'startDate', value: { stringValue: startDate.toISOString() } },
        { name: 'endDate', value: { stringValue: endDate.toISOString() } },
      ]
    );
    
    const record = result.records?.[0];
    
    return {
      totalDerivations: Number(record?.[0]?.longValue || 0),
      averageDurationMs: Number(record?.[1]?.doubleValue || 0),
      averageCost: Number(record?.[2]?.doubleValue || 0),
      averageQualityScore: Number(record?.[3]?.doubleValue || 0),
      modeDistribution: record?.[4]?.stringValue ? JSON.parse(record[4].stringValue) : {},
      domainDistribution: record?.[5]?.stringValue ? JSON.parse(record[5].stringValue) : {},
      topModels: (modelResult.records || []).map(r => ({
        modelId: r[0]?.stringValue || '',
        usageCount: Number(r[1]?.longValue || 0),
        avgQuality: Number(r[2]?.doubleValue || 0),
      })),
    };
  }
  
  // ============================================================================
  // Private Methods
  // ============================================================================
  
  private mapRecordToDerivation(record: unknown[]): ResultDerivation {
    // This is a simplified mapping - actual implementation would parse all fields
    const r = record as Array<{ stringValue?: string; longValue?: number; doubleValue?: number; booleanValue?: boolean }>;
    
    return {
      id: r[0]?.stringValue || '',
      sessionId: r[1]?.stringValue || '',
      promptId: r[2]?.stringValue || '',
      tenantId: r[3]?.stringValue || '',
      userId: r[4]?.stringValue || '',
      originalPrompt: r[5]?.stringValue || '',
      finalResponse: r[6]?.stringValue || '',
      plan: r[7]?.stringValue ? JSON.parse(r[7].stringValue) : {} as DerivationPlan,
      modelsUsed: r[8]?.stringValue ? JSON.parse(r[8].stringValue) : [],
      workflow: r[9]?.stringValue ? JSON.parse(r[9].stringValue) : {} as WorkflowExecution,
      domainDetection: r[10]?.stringValue ? JSON.parse(r[10].stringValue) : {} as DomainDetectionRecord,
      orchestration: r[11]?.stringValue ? JSON.parse(r[11].stringValue) : {} as OrchestrationRecord,
      qualityMetrics: r[12]?.stringValue ? JSON.parse(r[12].stringValue) : {} as QualityMetrics,
      timing: r[13]?.stringValue ? JSON.parse(r[13].stringValue) : {} as TimingRecord,
      costs: r[14]?.stringValue ? JSON.parse(r[14].stringValue) : {} as CostRecord,
      createdAt: new Date(r[15]?.stringValue || ''),
      completedAt: new Date(r[16]?.stringValue || ''),
    };
  }
  
  private mapRecordToSummary(record: unknown[]): DerivationSummary {
    const r = record as Array<{ stringValue?: string; longValue?: number; doubleValue?: number }>;
    
    return {
      id: r[0]?.stringValue || '',
      promptPreview: (r[1]?.stringValue || '').slice(0, 100),
      responsePreview: (r[2]?.stringValue || '').slice(0, 200),
      mode: (r[3]?.stringValue || 'thinking') as DerivationSummary['mode'],
      domain: r[4]?.stringValue || 'general',
      totalDurationMs: Number(r[5]?.longValue || 0),
      totalCost: Number(r[6]?.doubleValue || 0),
      qualityScore: Number(r[7]?.doubleValue || 0),
      createdAt: new Date(r[8]?.stringValue || ''),
      modelsUsedCount: Number(r[9]?.longValue || 0),
      primaryModel: r[10]?.stringValue || 'Unknown',
    };
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const resultDerivationService = new ResultDerivationService();
