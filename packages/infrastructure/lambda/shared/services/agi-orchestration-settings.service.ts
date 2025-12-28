// RADIANT v4.18.0 - AGI Orchestration Settings Service
// Manages adjustable weights, thresholds, and configuration for all AGI services

import { executeStatement } from '../db/client';
import type { SqlParameter } from '@aws-sdk/client-rds-data';

// ============================================================================
// Types
// ============================================================================

export type AGIServiceId =
  | 'consciousness'
  | 'metacognition'
  | 'moral_compass'
  | 'self_improvement'
  | 'domain_taxonomy'
  | 'brain_router'
  | 'confidence_calibration'
  | 'error_detection'
  | 'knowledge_graph'
  | 'proactive_assistance'
  | 'analogical_reasoning'
  | 'world_model'
  | 'episodic_memory'
  | 'theory_of_mind'
  | 'goal_planning'
  | 'causal_reasoning'
  | 'multimodal_binding'
  | 'response_synthesis';

export type ConsciousnessIndicator =
  | 'global_workspace'
  | 'recurrent_processing'
  | 'integrated_information'
  | 'self_modeling'
  | 'persistent_memory'
  | 'world_model_grounding';

export interface AGIServiceWeight {
  serviceId: AGIServiceId;
  weight: number;
  enabled: boolean;
  priority: number;
  minLatencyMs: number;
  maxCostCents: number;
  bedrockOptimized: boolean;
  // Auto mode fields
  autoMode: boolean;
  autoWeight?: number;
  userOverride: boolean;
  lastAutoTunedAt?: string;
}

export interface ConsciousnessIndicatorWeight {
  indicatorId: ConsciousnessIndicator;
  weight: number;
  enabled: boolean;
  cycleDepth: number;
  integrationThreshold: number;
  // Auto mode fields
  autoMode: boolean;
  userOverride: boolean;
}

export interface DecisionWeights {
  domainDetectionWeight: number;
  proficiencyMatchWeight: number;
  subspecialtyWeight: number;
  modelQualityWeight: number;
  modelCostWeight: number;
  modelLatencyWeight: number;
  modelSpecialtyWeight: number;
  modelReliabilityWeight: number;
  globalWorkspaceWeight: number;
  recurrentProcessingWeight: number;
  integratedInformationWeight: number;
  selfModelingWeight: number;
  moralCompassWeight: number;
  ethicalGuardrailWeight: number;
  confidenceCalibrationWeight: number;
  errorDetectionWeight: number;
  selfImprovementWeight: number;
}

export interface DecisionThresholds {
  minConfidenceForAction: number;
  minDomainMatchScore: number;
  maxUncertaintyForDirectResponse: number;
  escalationThreshold: number;
  moralConcernThreshold: number;
  selfImprovementTriggerThreshold: number;
}

export interface OrchestrationStage {
  stageId: string;
  stageName: string;
  stageOrder: number;
  services: AGIServiceId[];
  parallelExecution: boolean;
  timeoutMs: number;
  failureMode: 'skip' | 'retry' | 'abort';
  retryCount: number;
  cacheDurationMs: number;
}

export interface OrchestrationPipeline {
  pipelineId: string;
  pipelineName: string;
  description: string;
  isDefault: boolean;
  stages: OrchestrationStage[];
  globalTimeoutMs: number;
  maxCostCents: number;
  optimizationMode: 'quality' | 'speed' | 'cost' | 'balanced';
}

export interface BedrockConfig {
  enabled: boolean;
  preferBedrockModels: boolean;
  bedrockRegion: string;
  knowledgeBaseId?: string;
  guardrailId?: string;
  agentId?: string;
  promptFlowId?: string;
  useBedrockAgents: boolean;
  useKnowledgeBases: boolean;
  useGuardrails: boolean;
}

export interface PerformanceTuningConfig {
  maxConcurrentServices: number;
  defaultTimeoutMs: number;
  cachingEnabled: boolean;
  cacheTtlMs: number;
  batchingEnabled: boolean;
  batchSize: number;
  adaptiveThrottling: boolean;
  warmupEnabled: boolean;
}

export interface SelfImprovementConfig {
  enabled: boolean;
  learningRate: number;
  explorationRate: number;
  feedbackWeight: number;
  performanceWeight: number;
  autoTuneWeights: boolean;
  autoTuneIntervalHours: number;
  minSamplesForTuning: number;
}

export interface ParameterDefault {
  category: string;
  name: string;
  defaultValue: number;
  minValue?: number;
  maxValue?: number;
  currentValue: number;
  autoMode: boolean;
  userOverride: boolean;
  description?: string;
}

export interface AGIOrchestrationSettings {
  serviceWeights: AGIServiceWeight[];
  consciousnessWeights: ConsciousnessIndicatorWeight[];
  decisionWeights: DecisionWeights;
  decisionThresholds: DecisionThresholds;
  defaultPipeline: OrchestrationPipeline | null;
  bedrockConfig: BedrockConfig;
  performanceTuning: PerformanceTuningConfig;
  selfImprovementConfig: SelfImprovementConfig;
}

export interface ServiceHealthStatus {
  serviceId: AGIServiceId;
  serviceName: string;
  enabled: boolean;
  weight: number;
  avgLatencyMs: number;
  errorRate: number;
  invocationCount: number;
  lastInvoked: string | null;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'disabled';
}

export interface OrchestrationRequest {
  requestId: string;
  tenantId: string;
  userId: string;
  startedAt: string;
  completedAt: string | null;
  status: string;
  detectedFieldId: string | null;
  detectedDomainId: string | null;
  selectedModel: string | null;
  totalLatencyMs: number | null;
  estimatedCostCents: number | null;
  servicesInvoked: unknown[];
  decisionsLog: unknown[];
}

// ============================================================================
// AGI Orchestration Settings Service
// ============================================================================

export class AGIOrchestrationSettingsService {
  // ============================================================================
  // Service Weights
  // ============================================================================

  async getServiceWeights(tenantId: string | null = null): Promise<AGIServiceWeight[]> {
    const result = await executeStatement(
      `SELECT * FROM agi_service_weights 
       WHERE tenant_id IS NOT DISTINCT FROM $1
       ORDER BY priority DESC, service_id`,
      [{ name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } }]
    );

    // If tenant-specific not found, get global defaults
    if (result.rows.length === 0 && tenantId) {
      return this.getServiceWeights(null);
    }

    return result.rows.map(row => this.mapServiceWeight(row as Record<string, unknown>));
  }

  async updateServiceWeight(
    tenantId: string | null,
    serviceId: AGIServiceId,
    updates: Partial<AGIServiceWeight>,
    updatedBy: string
  ): Promise<void> {
    const fields: string[] = [];
    const params: SqlParameter[] = [
      { name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } },
      { name: 'serviceId', value: { stringValue: serviceId } },
    ];
    let paramIndex = 3;

    if (updates.weight !== undefined) {
      fields.push(`weight = $${paramIndex}`);
      params.push({ name: `p${paramIndex}`, value: { doubleValue: updates.weight } });
      paramIndex++;
    }
    if (updates.enabled !== undefined) {
      fields.push(`enabled = $${paramIndex}`);
      params.push({ name: `p${paramIndex}`, value: { booleanValue: updates.enabled } });
      paramIndex++;
    }
    if (updates.priority !== undefined) {
      fields.push(`priority = $${paramIndex}`);
      params.push({ name: `p${paramIndex}`, value: { longValue: updates.priority } });
      paramIndex++;
    }
    if (updates.minLatencyMs !== undefined) {
      fields.push(`min_latency_ms = $${paramIndex}`);
      params.push({ name: `p${paramIndex}`, value: { longValue: updates.minLatencyMs } });
      paramIndex++;
    }
    if (updates.maxCostCents !== undefined) {
      fields.push(`max_cost_cents = $${paramIndex}`);
      params.push({ name: `p${paramIndex}`, value: { doubleValue: updates.maxCostCents } });
      paramIndex++;
    }
    if (updates.bedrockOptimized !== undefined) {
      fields.push(`bedrock_optimized = $${paramIndex}`);
      params.push({ name: `p${paramIndex}`, value: { booleanValue: updates.bedrockOptimized } });
      paramIndex++;
    }

    fields.push(`updated_at = NOW()`);
    fields.push(`updated_by = $${paramIndex}`);
    params.push({ name: 'updatedBy', value: { stringValue: updatedBy } });

    await executeStatement(
      `UPDATE agi_service_weights SET ${fields.join(', ')}
       WHERE tenant_id IS NOT DISTINCT FROM $1 AND service_id = $2`,
      params
    );
  }

  async bulkUpdateServiceWeights(
    tenantId: string | null,
    weights: Array<{ serviceId: AGIServiceId; weight: number; enabled: boolean; priority: number }>,
    updatedBy: string
  ): Promise<void> {
    for (const w of weights) {
      await executeStatement(
        `INSERT INTO agi_service_weights (tenant_id, service_id, weight, enabled, priority, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (tenant_id, service_id) DO UPDATE SET
           weight = $3, enabled = $4, priority = $5, updated_by = $6, updated_at = NOW()`,
        [
          { name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } },
          { name: 'serviceId', value: { stringValue: w.serviceId } },
          { name: 'weight', value: { doubleValue: w.weight } },
          { name: 'enabled', value: { booleanValue: w.enabled } },
          { name: 'priority', value: { longValue: w.priority } },
          { name: 'updatedBy', value: { stringValue: updatedBy } },
        ]
      );
    }
  }

  // ============================================================================
  // Consciousness Weights
  // ============================================================================

  async getConsciousnessWeights(tenantId: string | null = null): Promise<ConsciousnessIndicatorWeight[]> {
    const result = await executeStatement(
      `SELECT * FROM agi_consciousness_weights 
       WHERE tenant_id IS NOT DISTINCT FROM $1
       ORDER BY indicator_id`,
      [{ name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } }]
    );

    if (result.rows.length === 0 && tenantId) {
      return this.getConsciousnessWeights(null);
    }

    return result.rows.map(row => this.mapConsciousnessWeight(row as Record<string, unknown>));
  }

  async updateConsciousnessWeight(
    tenantId: string | null,
    indicatorId: ConsciousnessIndicator,
    updates: Partial<ConsciousnessIndicatorWeight>
  ): Promise<void> {
    const fields: string[] = [];
    const params: SqlParameter[] = [
      { name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } },
      { name: 'indicatorId', value: { stringValue: indicatorId } },
    ];
    let paramIndex = 3;

    if (updates.weight !== undefined) {
      fields.push(`weight = $${paramIndex}`);
      params.push({ name: `p${paramIndex}`, value: { doubleValue: updates.weight } });
      paramIndex++;
    }
    if (updates.enabled !== undefined) {
      fields.push(`enabled = $${paramIndex}`);
      params.push({ name: `p${paramIndex}`, value: { booleanValue: updates.enabled } });
      paramIndex++;
    }
    if (updates.cycleDepth !== undefined) {
      fields.push(`cycle_depth = $${paramIndex}`);
      params.push({ name: `p${paramIndex}`, value: { longValue: updates.cycleDepth } });
      paramIndex++;
    }
    if (updates.integrationThreshold !== undefined) {
      fields.push(`integration_threshold = $${paramIndex}`);
      params.push({ name: `p${paramIndex}`, value: { doubleValue: updates.integrationThreshold } });
      paramIndex++;
    }

    fields.push(`updated_at = NOW()`);

    await executeStatement(
      `UPDATE agi_consciousness_weights SET ${fields.join(', ')}
       WHERE tenant_id IS NOT DISTINCT FROM $1 AND indicator_id = $2`,
      params
    );
  }

  // ============================================================================
  // Decision Weights
  // ============================================================================

  async getDecisionWeights(tenantId: string | null = null): Promise<DecisionWeights> {
    const result = await executeStatement(
      `SELECT * FROM agi_decision_weights WHERE tenant_id IS NOT DISTINCT FROM $1`,
      [{ name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } }]
    );

    if (result.rows.length === 0) {
      if (tenantId) return this.getDecisionWeights(null);
      return this.getDefaultDecisionWeights();
    }

    return this.mapDecisionWeights(result.rows[0] as Record<string, unknown>);
  }

  async updateDecisionWeights(
    tenantId: string | null,
    weights: Partial<DecisionWeights>,
    updatedBy: string
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO agi_decision_weights (tenant_id, 
        domain_detection_weight, proficiency_match_weight, subspecialty_weight,
        model_quality_weight, model_cost_weight, model_latency_weight, 
        model_specialty_weight, model_reliability_weight,
        global_workspace_weight, recurrent_processing_weight, 
        integrated_information_weight, self_modeling_weight,
        moral_compass_weight, ethical_guardrail_weight,
        confidence_calibration_weight, error_detection_weight, self_improvement_weight,
        updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      ON CONFLICT (tenant_id) DO UPDATE SET
        domain_detection_weight = COALESCE($2, agi_decision_weights.domain_detection_weight),
        proficiency_match_weight = COALESCE($3, agi_decision_weights.proficiency_match_weight),
        subspecialty_weight = COALESCE($4, agi_decision_weights.subspecialty_weight),
        model_quality_weight = COALESCE($5, agi_decision_weights.model_quality_weight),
        model_cost_weight = COALESCE($6, agi_decision_weights.model_cost_weight),
        model_latency_weight = COALESCE($7, agi_decision_weights.model_latency_weight),
        model_specialty_weight = COALESCE($8, agi_decision_weights.model_specialty_weight),
        model_reliability_weight = COALESCE($9, agi_decision_weights.model_reliability_weight),
        global_workspace_weight = COALESCE($10, agi_decision_weights.global_workspace_weight),
        recurrent_processing_weight = COALESCE($11, agi_decision_weights.recurrent_processing_weight),
        integrated_information_weight = COALESCE($12, agi_decision_weights.integrated_information_weight),
        self_modeling_weight = COALESCE($13, agi_decision_weights.self_modeling_weight),
        moral_compass_weight = COALESCE($14, agi_decision_weights.moral_compass_weight),
        ethical_guardrail_weight = COALESCE($15, agi_decision_weights.ethical_guardrail_weight),
        confidence_calibration_weight = COALESCE($16, agi_decision_weights.confidence_calibration_weight),
        error_detection_weight = COALESCE($17, agi_decision_weights.error_detection_weight),
        self_improvement_weight = COALESCE($18, agi_decision_weights.self_improvement_weight),
        updated_by = $19, updated_at = NOW()`,
      [
        { name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } },
        { name: 'p2', value: weights.domainDetectionWeight !== undefined ? { doubleValue: weights.domainDetectionWeight } : { isNull: true } },
        { name: 'p3', value: weights.proficiencyMatchWeight !== undefined ? { doubleValue: weights.proficiencyMatchWeight } : { isNull: true } },
        { name: 'p4', value: weights.subspecialtyWeight !== undefined ? { doubleValue: weights.subspecialtyWeight } : { isNull: true } },
        { name: 'p5', value: weights.modelQualityWeight !== undefined ? { doubleValue: weights.modelQualityWeight } : { isNull: true } },
        { name: 'p6', value: weights.modelCostWeight !== undefined ? { doubleValue: weights.modelCostWeight } : { isNull: true } },
        { name: 'p7', value: weights.modelLatencyWeight !== undefined ? { doubleValue: weights.modelLatencyWeight } : { isNull: true } },
        { name: 'p8', value: weights.modelSpecialtyWeight !== undefined ? { doubleValue: weights.modelSpecialtyWeight } : { isNull: true } },
        { name: 'p9', value: weights.modelReliabilityWeight !== undefined ? { doubleValue: weights.modelReliabilityWeight } : { isNull: true } },
        { name: 'p10', value: weights.globalWorkspaceWeight !== undefined ? { doubleValue: weights.globalWorkspaceWeight } : { isNull: true } },
        { name: 'p11', value: weights.recurrentProcessingWeight !== undefined ? { doubleValue: weights.recurrentProcessingWeight } : { isNull: true } },
        { name: 'p12', value: weights.integratedInformationWeight !== undefined ? { doubleValue: weights.integratedInformationWeight } : { isNull: true } },
        { name: 'p13', value: weights.selfModelingWeight !== undefined ? { doubleValue: weights.selfModelingWeight } : { isNull: true } },
        { name: 'p14', value: weights.moralCompassWeight !== undefined ? { doubleValue: weights.moralCompassWeight } : { isNull: true } },
        { name: 'p15', value: weights.ethicalGuardrailWeight !== undefined ? { doubleValue: weights.ethicalGuardrailWeight } : { isNull: true } },
        { name: 'p16', value: weights.confidenceCalibrationWeight !== undefined ? { doubleValue: weights.confidenceCalibrationWeight } : { isNull: true } },
        { name: 'p17', value: weights.errorDetectionWeight !== undefined ? { doubleValue: weights.errorDetectionWeight } : { isNull: true } },
        { name: 'p18', value: weights.selfImprovementWeight !== undefined ? { doubleValue: weights.selfImprovementWeight } : { isNull: true } },
        { name: 'updatedBy', value: { stringValue: updatedBy } },
      ]
    );
  }

  // ============================================================================
  // Decision Thresholds
  // ============================================================================

  async getDecisionThresholds(tenantId: string | null = null): Promise<DecisionThresholds> {
    const result = await executeStatement(
      `SELECT * FROM agi_decision_thresholds WHERE tenant_id IS NOT DISTINCT FROM $1`,
      [{ name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } }]
    );

    if (result.rows.length === 0) {
      if (tenantId) return this.getDecisionThresholds(null);
      return this.getDefaultDecisionThresholds();
    }

    return this.mapDecisionThresholds(result.rows[0] as Record<string, unknown>);
  }

  async updateDecisionThresholds(
    tenantId: string | null,
    thresholds: Partial<DecisionThresholds>
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO agi_decision_thresholds (tenant_id,
        min_confidence_for_action, min_domain_match_score,
        max_uncertainty_for_direct_response, escalation_threshold,
        moral_concern_threshold, self_improvement_trigger_threshold
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (tenant_id) DO UPDATE SET
        min_confidence_for_action = COALESCE($2, agi_decision_thresholds.min_confidence_for_action),
        min_domain_match_score = COALESCE($3, agi_decision_thresholds.min_domain_match_score),
        max_uncertainty_for_direct_response = COALESCE($4, agi_decision_thresholds.max_uncertainty_for_direct_response),
        escalation_threshold = COALESCE($5, agi_decision_thresholds.escalation_threshold),
        moral_concern_threshold = COALESCE($6, agi_decision_thresholds.moral_concern_threshold),
        self_improvement_trigger_threshold = COALESCE($7, agi_decision_thresholds.self_improvement_trigger_threshold),
        updated_at = NOW()`,
      [
        { name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } },
        { name: 'p2', value: thresholds.minConfidenceForAction !== undefined ? { doubleValue: thresholds.minConfidenceForAction } : { isNull: true } },
        { name: 'p3', value: thresholds.minDomainMatchScore !== undefined ? { doubleValue: thresholds.minDomainMatchScore } : { isNull: true } },
        { name: 'p4', value: thresholds.maxUncertaintyForDirectResponse !== undefined ? { doubleValue: thresholds.maxUncertaintyForDirectResponse } : { isNull: true } },
        { name: 'p5', value: thresholds.escalationThreshold !== undefined ? { doubleValue: thresholds.escalationThreshold } : { isNull: true } },
        { name: 'p6', value: thresholds.moralConcernThreshold !== undefined ? { doubleValue: thresholds.moralConcernThreshold } : { isNull: true } },
        { name: 'p7', value: thresholds.selfImprovementTriggerThreshold !== undefined ? { doubleValue: thresholds.selfImprovementTriggerThreshold } : { isNull: true } },
      ]
    );
  }

  // ============================================================================
  // Pipelines
  // ============================================================================

  async getPipelines(tenantId: string | null = null): Promise<OrchestrationPipeline[]> {
    const result = await executeStatement(
      `SELECT * FROM agi_orchestration_pipelines 
       WHERE tenant_id IS NOT DISTINCT FROM $1
       ORDER BY is_default DESC, pipeline_name`,
      [{ name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } }]
    );

    if (result.rows.length === 0 && tenantId) {
      return this.getPipelines(null);
    }

    return result.rows.map(row => this.mapPipeline(row as Record<string, unknown>));
  }

  async getDefaultPipeline(tenantId: string | null = null): Promise<OrchestrationPipeline | null> {
    const pipelines = await this.getPipelines(tenantId);
    return pipelines.find(p => p.isDefault) || pipelines[0] || null;
  }

  // ============================================================================
  // Bedrock Config
  // ============================================================================

  async getBedrockConfig(tenantId: string | null = null): Promise<BedrockConfig> {
    const result = await executeStatement(
      `SELECT * FROM agi_bedrock_config WHERE tenant_id IS NOT DISTINCT FROM $1`,
      [{ name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } }]
    );

    if (result.rows.length === 0) {
      if (tenantId) return this.getBedrockConfig(null);
      return this.getDefaultBedrockConfig();
    }

    return this.mapBedrockConfig(result.rows[0] as Record<string, unknown>);
  }

  async updateBedrockConfig(tenantId: string | null, config: Partial<BedrockConfig>): Promise<void> {
    await executeStatement(
      `INSERT INTO agi_bedrock_config (tenant_id,
        enabled, prefer_bedrock_models, bedrock_region,
        knowledge_base_id, guardrail_id, agent_id, prompt_flow_id,
        use_bedrock_agents, use_knowledge_bases, use_guardrails
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (tenant_id) DO UPDATE SET
        enabled = COALESCE($2, agi_bedrock_config.enabled),
        prefer_bedrock_models = COALESCE($3, agi_bedrock_config.prefer_bedrock_models),
        bedrock_region = COALESCE($4, agi_bedrock_config.bedrock_region),
        knowledge_base_id = COALESCE($5, agi_bedrock_config.knowledge_base_id),
        guardrail_id = COALESCE($6, agi_bedrock_config.guardrail_id),
        agent_id = COALESCE($7, agi_bedrock_config.agent_id),
        prompt_flow_id = COALESCE($8, agi_bedrock_config.prompt_flow_id),
        use_bedrock_agents = COALESCE($9, agi_bedrock_config.use_bedrock_agents),
        use_knowledge_bases = COALESCE($10, agi_bedrock_config.use_knowledge_bases),
        use_guardrails = COALESCE($11, agi_bedrock_config.use_guardrails),
        updated_at = NOW()`,
      [
        { name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } },
        { name: 'p2', value: config.enabled !== undefined ? { booleanValue: config.enabled } : { isNull: true } },
        { name: 'p3', value: config.preferBedrockModels !== undefined ? { booleanValue: config.preferBedrockModels } : { isNull: true } },
        { name: 'p4', value: config.bedrockRegion ? { stringValue: config.bedrockRegion } : { isNull: true } },
        { name: 'p5', value: config.knowledgeBaseId ? { stringValue: config.knowledgeBaseId } : { isNull: true } },
        { name: 'p6', value: config.guardrailId ? { stringValue: config.guardrailId } : { isNull: true } },
        { name: 'p7', value: config.agentId ? { stringValue: config.agentId } : { isNull: true } },
        { name: 'p8', value: config.promptFlowId ? { stringValue: config.promptFlowId } : { isNull: true } },
        { name: 'p9', value: config.useBedrockAgents !== undefined ? { booleanValue: config.useBedrockAgents } : { isNull: true } },
        { name: 'p10', value: config.useKnowledgeBases !== undefined ? { booleanValue: config.useKnowledgeBases } : { isNull: true } },
        { name: 'p11', value: config.useGuardrails !== undefined ? { booleanValue: config.useGuardrails } : { isNull: true } },
      ]
    );
  }

  // ============================================================================
  // Performance Tuning
  // ============================================================================

  async getPerformanceTuning(tenantId: string | null = null): Promise<PerformanceTuningConfig> {
    const result = await executeStatement(
      `SELECT * FROM agi_performance_tuning WHERE tenant_id IS NOT DISTINCT FROM $1`,
      [{ name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } }]
    );

    if (result.rows.length === 0) {
      if (tenantId) return this.getPerformanceTuning(null);
      return this.getDefaultPerformanceTuning();
    }

    return this.mapPerformanceTuning(result.rows[0] as Record<string, unknown>);
  }

  // ============================================================================
  // Self-Improvement Config
  // ============================================================================

  async getSelfImprovementConfig(tenantId: string | null = null): Promise<SelfImprovementConfig> {
    const result = await executeStatement(
      `SELECT * FROM agi_self_improvement_config WHERE tenant_id IS NOT DISTINCT FROM $1`,
      [{ name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } }]
    );

    if (result.rows.length === 0) {
      if (tenantId) return this.getSelfImprovementConfig(null);
      return this.getDefaultSelfImprovementConfig();
    }

    return this.mapSelfImprovementConfig(result.rows[0] as Record<string, unknown>);
  }

  async updateSelfImprovementConfig(tenantId: string | null, config: Partial<SelfImprovementConfig>): Promise<void> {
    await executeStatement(
      `INSERT INTO agi_self_improvement_config (tenant_id,
        enabled, learning_rate, exploration_rate, feedback_weight, performance_weight,
        auto_tune_weights, auto_tune_interval_hours, min_samples_for_tuning
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (tenant_id) DO UPDATE SET
        enabled = COALESCE($2, agi_self_improvement_config.enabled),
        learning_rate = COALESCE($3, agi_self_improvement_config.learning_rate),
        exploration_rate = COALESCE($4, agi_self_improvement_config.exploration_rate),
        feedback_weight = COALESCE($5, agi_self_improvement_config.feedback_weight),
        performance_weight = COALESCE($6, agi_self_improvement_config.performance_weight),
        auto_tune_weights = COALESCE($7, agi_self_improvement_config.auto_tune_weights),
        auto_tune_interval_hours = COALESCE($8, agi_self_improvement_config.auto_tune_interval_hours),
        min_samples_for_tuning = COALESCE($9, agi_self_improvement_config.min_samples_for_tuning),
        updated_at = NOW()`,
      [
        { name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } },
        { name: 'p2', value: config.enabled !== undefined ? { booleanValue: config.enabled } : { isNull: true } },
        { name: 'p3', value: config.learningRate !== undefined ? { doubleValue: config.learningRate } : { isNull: true } },
        { name: 'p4', value: config.explorationRate !== undefined ? { doubleValue: config.explorationRate } : { isNull: true } },
        { name: 'p5', value: config.feedbackWeight !== undefined ? { doubleValue: config.feedbackWeight } : { isNull: true } },
        { name: 'p6', value: config.performanceWeight !== undefined ? { doubleValue: config.performanceWeight } : { isNull: true } },
        { name: 'p7', value: config.autoTuneWeights !== undefined ? { booleanValue: config.autoTuneWeights } : { isNull: true } },
        { name: 'p8', value: config.autoTuneIntervalHours !== undefined ? { longValue: config.autoTuneIntervalHours } : { isNull: true } },
        { name: 'p9', value: config.minSamplesForTuning !== undefined ? { longValue: config.minSamplesForTuning } : { isNull: true } },
      ]
    );
  }

  // ============================================================================
  // Get All Settings
  // ============================================================================

  async getAllSettings(tenantId: string | null = null): Promise<AGIOrchestrationSettings> {
    const [
      serviceWeights,
      consciousnessWeights,
      decisionWeights,
      decisionThresholds,
      defaultPipeline,
      bedrockConfig,
      performanceTuning,
      selfImprovementConfig,
    ] = await Promise.all([
      this.getServiceWeights(tenantId),
      this.getConsciousnessWeights(tenantId),
      this.getDecisionWeights(tenantId),
      this.getDecisionThresholds(tenantId),
      this.getDefaultPipeline(tenantId),
      this.getBedrockConfig(tenantId),
      this.getPerformanceTuning(tenantId),
      this.getSelfImprovementConfig(tenantId),
    ]);

    return {
      serviceWeights,
      consciousnessWeights,
      decisionWeights,
      decisionThresholds,
      defaultPipeline,
      bedrockConfig,
      performanceTuning,
      selfImprovementConfig,
    };
  }

  // ============================================================================
  // Service Health & Monitoring
  // ============================================================================

  async getServiceHealth(tenantId: string | null = null): Promise<ServiceHealthStatus[]> {
    const weights = await this.getServiceWeights(tenantId);
    
    const result = await executeStatement(
      `SELECT 
        service_id,
        SUM(invocation_count) as total_invocations,
        SUM(success_count) as total_success,
        SUM(error_count) as total_errors,
        AVG(avg_latency_ms) as avg_latency,
        MAX(period_end) as last_invoked
       FROM agi_service_health
       WHERE (tenant_id IS NOT DISTINCT FROM $1) AND period_start > NOW() - INTERVAL '24 hours'
       GROUP BY service_id`,
      [{ name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } }]
    );

    const healthMap = new Map<string, Record<string, unknown>>();
    for (const row of result.rows) {
      const r = row as Record<string, unknown>;
      healthMap.set(String(r.service_id), r);
    }

    return weights.map(w => {
      const health = healthMap.get(w.serviceId);
      const invocations = health ? parseInt(String(health.total_invocations || 0), 10) : 0;
      const errors = health ? parseInt(String(health.total_errors || 0), 10) : 0;
      const errorRate = invocations > 0 ? errors / invocations : 0;
      const avgLatency = health ? parseFloat(String(health.avg_latency || 0)) : 0;

      let status: 'healthy' | 'degraded' | 'unhealthy' | 'disabled' = 'healthy';
      if (!w.enabled) status = 'disabled';
      else if (errorRate > 0.5) status = 'unhealthy';
      else if (errorRate > 0.1 || avgLatency > w.minLatencyMs) status = 'degraded';

      return {
        serviceId: w.serviceId,
        serviceName: this.getServiceDisplayName(w.serviceId),
        enabled: w.enabled,
        weight: w.weight,
        avgLatencyMs: avgLatency,
        errorRate,
        invocationCount: invocations,
        lastInvoked: health ? String(health.last_invoked) : null,
        status,
      };
    });
  }

  async getRecentRequests(tenantId: string, limit: number = 20): Promise<OrchestrationRequest[]> {
    const result = await executeStatement(
      `SELECT * FROM agi_orchestration_requests 
       WHERE tenant_id = $1
       ORDER BY started_at DESC
       LIMIT $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    return result.rows.map(row => this.mapOrchestrationRequest(row as Record<string, unknown>));
  }

  async logOrchestrationRequest(request: Partial<OrchestrationRequest>): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO agi_orchestration_requests (
        tenant_id, user_id, request_id, status,
        detected_field_id, detected_domain_id, detected_subspecialty_id, domain_confidence,
        selected_model, fallback_models, model_selection_reason,
        total_latency_ms, domain_detection_ms, model_selection_ms, consciousness_ms, ethics_ms, generation_ms,
        estimated_cost_cents, tokens_used,
        services_invoked, decisions_log, consciousness_state, ethics_evaluation
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING id`,
      [
        { name: 'p1', value: { stringValue: request.tenantId || '' } },
        { name: 'p2', value: { stringValue: request.userId || '' } },
        { name: 'p3', value: { stringValue: request.requestId || '' } },
        { name: 'p4', value: { stringValue: request.status || 'in_progress' } },
        { name: 'p5', value: request.detectedFieldId ? { stringValue: request.detectedFieldId } : { isNull: true } },
        { name: 'p6', value: request.detectedDomainId ? { stringValue: request.detectedDomainId } : { isNull: true } },
        { name: 'p7', value: { isNull: true } },
        { name: 'p8', value: { isNull: true } },
        { name: 'p9', value: request.selectedModel ? { stringValue: request.selectedModel } : { isNull: true } },
        { name: 'p10', value: { isNull: true } },
        { name: 'p11', value: { isNull: true } },
        { name: 'p12', value: request.totalLatencyMs !== undefined ? { longValue: request.totalLatencyMs } : { isNull: true } },
        { name: 'p13', value: { isNull: true } },
        { name: 'p14', value: { isNull: true } },
        { name: 'p15', value: { isNull: true } },
        { name: 'p16', value: { isNull: true } },
        { name: 'p17', value: { isNull: true } },
        { name: 'p18', value: request.estimatedCostCents !== undefined ? { doubleValue: request.estimatedCostCents } : { isNull: true } },
        { name: 'p19', value: { isNull: true } },
        { name: 'p20', value: { stringValue: JSON.stringify(request.servicesInvoked || []) } },
        { name: 'p21', value: { stringValue: JSON.stringify(request.decisionsLog || []) } },
        { name: 'p22', value: { isNull: true } },
        { name: 'p23', value: { isNull: true } },
      ]
    );

    return String((result.rows[0] as Record<string, unknown>).id);
  }

  // ============================================================================
  // Parameter Defaults
  // ============================================================================

  async getParameterDefaults(tenantId: string | null = null): Promise<ParameterDefault[]> {
    const result = await executeStatement(
      `SELECT * FROM agi_parameter_defaults 
       WHERE tenant_id IS NOT DISTINCT FROM $1
       ORDER BY parameter_category, parameter_name`,
      [{ name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } }]
    );

    if (result.rows.length === 0 && tenantId) {
      return this.getParameterDefaults(null);
    }

    return result.rows.map(row => this.mapParameterDefault(row as Record<string, unknown>));
  }

  async getParametersByCategory(tenantId: string | null, category: string): Promise<ParameterDefault[]> {
    const result = await executeStatement(
      `SELECT * FROM agi_parameter_defaults 
       WHERE tenant_id IS NOT DISTINCT FROM $1 AND parameter_category = $2
       ORDER BY parameter_name`,
      [
        { name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } },
        { name: 'category', value: { stringValue: category } },
      ]
    );

    if (result.rows.length === 0 && tenantId) {
      return this.getParametersByCategory(null, category);
    }

    return result.rows.map(row => this.mapParameterDefault(row as Record<string, unknown>));
  }

  async updateParameter(
    tenantId: string | null,
    category: string,
    name: string,
    value: number,
    autoMode: boolean = true,
    userOverride: boolean = false
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO agi_parameter_defaults (tenant_id, parameter_category, parameter_name, current_value, auto_mode, user_override, default_value)
       SELECT $1, $2, $3, $4, $5, $6, COALESCE(
         (SELECT default_value FROM agi_parameter_defaults WHERE tenant_id IS NULL AND parameter_category = $2 AND parameter_name = $3),
         $4
       )
       ON CONFLICT (tenant_id, parameter_category, parameter_name) DO UPDATE SET
         current_value = $4, auto_mode = $5, user_override = $6, updated_at = NOW()`,
      [
        { name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } },
        { name: 'category', value: { stringValue: category } },
        { name: 'name', value: { stringValue: name } },
        { name: 'value', value: { doubleValue: value } },
        { name: 'autoMode', value: { booleanValue: autoMode } },
        { name: 'userOverride', value: { booleanValue: userOverride } },
      ]
    );
  }

  async resetParametersToDefaults(tenantId: string | null): Promise<void> {
    if (tenantId) {
      // Delete tenant-specific overrides, falling back to global defaults
      await executeStatement(
        `DELETE FROM agi_parameter_defaults WHERE tenant_id = $1`,
        [{ name: 'tenantId', value: { stringValue: tenantId } }]
      );
    } else {
      // Reset global defaults to their original values
      await executeStatement(
        `UPDATE agi_parameter_defaults 
         SET current_value = default_value, auto_mode = true, user_override = false, updated_at = NOW()
         WHERE tenant_id IS NULL`,
        []
      );
    }
  }

  // ============================================================================
  // Performance Tuning Update
  // ============================================================================

  async updatePerformanceTuning(tenantId: string | null, config: Partial<PerformanceTuningConfig>): Promise<void> {
    await executeStatement(
      `INSERT INTO agi_performance_tuning (tenant_id,
        max_concurrent_services, default_timeout_ms, caching_enabled, cache_ttl_ms,
        batching_enabled, batch_size, adaptive_throttling, warmup_enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (tenant_id) DO UPDATE SET
        max_concurrent_services = COALESCE($2, agi_performance_tuning.max_concurrent_services),
        default_timeout_ms = COALESCE($3, agi_performance_tuning.default_timeout_ms),
        caching_enabled = COALESCE($4, agi_performance_tuning.caching_enabled),
        cache_ttl_ms = COALESCE($5, agi_performance_tuning.cache_ttl_ms),
        batching_enabled = COALESCE($6, agi_performance_tuning.batching_enabled),
        batch_size = COALESCE($7, agi_performance_tuning.batch_size),
        adaptive_throttling = COALESCE($8, agi_performance_tuning.adaptive_throttling),
        warmup_enabled = COALESCE($9, agi_performance_tuning.warmup_enabled),
        updated_at = NOW()`,
      [
        { name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } },
        { name: 'p2', value: config.maxConcurrentServices !== undefined ? { longValue: config.maxConcurrentServices } : { isNull: true } },
        { name: 'p3', value: config.defaultTimeoutMs !== undefined ? { longValue: config.defaultTimeoutMs } : { isNull: true } },
        { name: 'p4', value: config.cachingEnabled !== undefined ? { booleanValue: config.cachingEnabled } : { isNull: true } },
        { name: 'p5', value: config.cacheTtlMs !== undefined ? { longValue: config.cacheTtlMs } : { isNull: true } },
        { name: 'p6', value: config.batchingEnabled !== undefined ? { booleanValue: config.batchingEnabled } : { isNull: true } },
        { name: 'p7', value: config.batchSize !== undefined ? { longValue: config.batchSize } : { isNull: true } },
        { name: 'p8', value: config.adaptiveThrottling !== undefined ? { booleanValue: config.adaptiveThrottling } : { isNull: true } },
        { name: 'p9', value: config.warmupEnabled !== undefined ? { booleanValue: config.warmupEnabled } : { isNull: true } },
      ]
    );
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getServiceDisplayName(serviceId: AGIServiceId): string {
    const names: Record<AGIServiceId, string> = {
      consciousness: 'Consciousness',
      metacognition: 'Metacognition',
      moral_compass: 'Moral Compass',
      self_improvement: 'Self-Improvement',
      domain_taxonomy: 'Domain Taxonomy',
      brain_router: 'Brain Router',
      confidence_calibration: 'Confidence Calibration',
      error_detection: 'Error Detection',
      knowledge_graph: 'Knowledge Graph',
      proactive_assistance: 'Proactive Assistance',
      analogical_reasoning: 'Analogical Reasoning',
      world_model: 'World Model',
      episodic_memory: 'Episodic Memory',
      theory_of_mind: 'Theory of Mind',
      goal_planning: 'Goal Planning',
      causal_reasoning: 'Causal Reasoning',
      multimodal_binding: 'Multimodal Binding',
      response_synthesis: 'Response Synthesis',
    };
    return names[serviceId] || serviceId;
  }

  private mapServiceWeight(row: Record<string, unknown>): AGIServiceWeight {
    return {
      serviceId: String(row.service_id) as AGIServiceId,
      weight: parseFloat(String(row.weight || 1)),
      enabled: row.enabled === true,
      priority: parseInt(String(row.priority || 5), 10),
      minLatencyMs: parseInt(String(row.min_latency_ms || 5000), 10),
      maxCostCents: parseFloat(String(row.max_cost_cents || 10)),
      bedrockOptimized: row.bedrock_optimized === true,
      autoMode: row.auto_mode !== false,
      autoWeight: row.auto_weight ? parseFloat(String(row.auto_weight)) : undefined,
      userOverride: row.user_override === true,
      lastAutoTunedAt: row.last_auto_tuned_at ? String(row.last_auto_tuned_at) : undefined,
    };
  }

  private mapConsciousnessWeight(row: Record<string, unknown>): ConsciousnessIndicatorWeight {
    return {
      indicatorId: String(row.indicator_id) as ConsciousnessIndicator,
      weight: parseFloat(String(row.weight || 1)),
      enabled: row.enabled === true,
      cycleDepth: parseInt(String(row.cycle_depth || 3), 10),
      integrationThreshold: parseFloat(String(row.integration_threshold || 0.5)),
      autoMode: row.auto_mode !== false,
      userOverride: row.user_override === true,
    };
  }

  private mapDecisionWeights(row: Record<string, unknown>): DecisionWeights {
    return {
      domainDetectionWeight: parseFloat(String(row.domain_detection_weight || 0.8)),
      proficiencyMatchWeight: parseFloat(String(row.proficiency_match_weight || 0.7)),
      subspecialtyWeight: parseFloat(String(row.subspecialty_weight || 0.5)),
      modelQualityWeight: parseFloat(String(row.model_quality_weight || 0.8)),
      modelCostWeight: parseFloat(String(row.model_cost_weight || 0.5)),
      modelLatencyWeight: parseFloat(String(row.model_latency_weight || 0.6)),
      modelSpecialtyWeight: parseFloat(String(row.model_specialty_weight || 0.7)),
      modelReliabilityWeight: parseFloat(String(row.model_reliability_weight || 0.9)),
      globalWorkspaceWeight: parseFloat(String(row.global_workspace_weight || 0.7)),
      recurrentProcessingWeight: parseFloat(String(row.recurrent_processing_weight || 0.6)),
      integratedInformationWeight: parseFloat(String(row.integrated_information_weight || 0.5)),
      selfModelingWeight: parseFloat(String(row.self_modeling_weight || 0.6)),
      moralCompassWeight: parseFloat(String(row.moral_compass_weight || 0.9)),
      ethicalGuardrailWeight: parseFloat(String(row.ethical_guardrail_weight || 1.0)),
      confidenceCalibrationWeight: parseFloat(String(row.confidence_calibration_weight || 0.7)),
      errorDetectionWeight: parseFloat(String(row.error_detection_weight || 0.8)),
      selfImprovementWeight: parseFloat(String(row.self_improvement_weight || 0.4)),
    };
  }

  private getDefaultDecisionWeights(): DecisionWeights {
    return {
      domainDetectionWeight: 0.8,
      proficiencyMatchWeight: 0.7,
      subspecialtyWeight: 0.5,
      modelQualityWeight: 0.8,
      modelCostWeight: 0.5,
      modelLatencyWeight: 0.6,
      modelSpecialtyWeight: 0.7,
      modelReliabilityWeight: 0.9,
      globalWorkspaceWeight: 0.7,
      recurrentProcessingWeight: 0.6,
      integratedInformationWeight: 0.5,
      selfModelingWeight: 0.6,
      moralCompassWeight: 0.9,
      ethicalGuardrailWeight: 1.0,
      confidenceCalibrationWeight: 0.7,
      errorDetectionWeight: 0.8,
      selfImprovementWeight: 0.4,
    };
  }

  private mapDecisionThresholds(row: Record<string, unknown>): DecisionThresholds {
    return {
      minConfidenceForAction: parseFloat(String(row.min_confidence_for_action || 0.6)),
      minDomainMatchScore: parseFloat(String(row.min_domain_match_score || 50)),
      maxUncertaintyForDirectResponse: parseFloat(String(row.max_uncertainty_for_direct_response || 0.4)),
      escalationThreshold: parseFloat(String(row.escalation_threshold || 0.3)),
      moralConcernThreshold: parseFloat(String(row.moral_concern_threshold || 0.7)),
      selfImprovementTriggerThreshold: parseFloat(String(row.self_improvement_trigger_threshold || 0.5)),
    };
  }

  private getDefaultDecisionThresholds(): DecisionThresholds {
    return {
      minConfidenceForAction: 0.6,
      minDomainMatchScore: 50,
      maxUncertaintyForDirectResponse: 0.4,
      escalationThreshold: 0.3,
      moralConcernThreshold: 0.7,
      selfImprovementTriggerThreshold: 0.5,
    };
  }

  private mapPipeline(row: Record<string, unknown>): OrchestrationPipeline {
    let stages: OrchestrationStage[] = [];
    try {
      stages = typeof row.stages === 'string' ? JSON.parse(row.stages) : (row.stages as OrchestrationStage[]) || [];
    } catch { stages = []; }

    return {
      pipelineId: String(row.id),
      pipelineName: String(row.pipeline_name),
      description: String(row.description || ''),
      isDefault: row.is_default === true,
      stages,
      globalTimeoutMs: parseInt(String(row.global_timeout_ms || 30000), 10),
      maxCostCents: parseFloat(String(row.max_cost_cents || 50)),
      optimizationMode: (String(row.optimization_mode || 'balanced') as OrchestrationPipeline['optimizationMode']),
    };
  }

  private mapBedrockConfig(row: Record<string, unknown>): BedrockConfig {
    return {
      enabled: row.enabled === true,
      preferBedrockModels: row.prefer_bedrock_models === true,
      bedrockRegion: String(row.bedrock_region || 'us-east-1'),
      knowledgeBaseId: row.knowledge_base_id ? String(row.knowledge_base_id) : undefined,
      guardrailId: row.guardrail_id ? String(row.guardrail_id) : undefined,
      agentId: row.agent_id ? String(row.agent_id) : undefined,
      promptFlowId: row.prompt_flow_id ? String(row.prompt_flow_id) : undefined,
      useBedrockAgents: row.use_bedrock_agents === true,
      useKnowledgeBases: row.use_knowledge_bases === true,
      useGuardrails: row.use_guardrails === true,
    };
  }

  private getDefaultBedrockConfig(): BedrockConfig {
    return {
      enabled: false,
      preferBedrockModels: false,
      bedrockRegion: 'us-east-1',
      useBedrockAgents: false,
      useKnowledgeBases: false,
      useGuardrails: false,
    };
  }

  private mapPerformanceTuning(row: Record<string, unknown>): PerformanceTuningConfig {
    return {
      maxConcurrentServices: parseInt(String(row.max_concurrent_services || 5), 10),
      defaultTimeoutMs: parseInt(String(row.default_timeout_ms || 10000), 10),
      cachingEnabled: row.caching_enabled !== false,
      cacheTtlMs: parseInt(String(row.cache_ttl_ms || 300000), 10),
      batchingEnabled: row.batching_enabled === true,
      batchSize: parseInt(String(row.batch_size || 10), 10),
      adaptiveThrottling: row.adaptive_throttling !== false,
      warmupEnabled: row.warmup_enabled !== false,
    };
  }

  private getDefaultPerformanceTuning(): PerformanceTuningConfig {
    return {
      maxConcurrentServices: 5,
      defaultTimeoutMs: 10000,
      cachingEnabled: true,
      cacheTtlMs: 300000,
      batchingEnabled: false,
      batchSize: 10,
      adaptiveThrottling: true,
      warmupEnabled: true,
    };
  }

  private mapSelfImprovementConfig(row: Record<string, unknown>): SelfImprovementConfig {
    return {
      enabled: row.enabled !== false,
      learningRate: parseFloat(String(row.learning_rate || 0.1)),
      explorationRate: parseFloat(String(row.exploration_rate || 0.2)),
      feedbackWeight: parseFloat(String(row.feedback_weight || 0.6)),
      performanceWeight: parseFloat(String(row.performance_weight || 0.4)),
      autoTuneWeights: row.auto_tune_weights === true,
      autoTuneIntervalHours: parseInt(String(row.auto_tune_interval_hours || 24), 10),
      minSamplesForTuning: parseInt(String(row.min_samples_for_tuning || 100), 10),
    };
  }

  private getDefaultSelfImprovementConfig(): SelfImprovementConfig {
    return {
      enabled: true,
      learningRate: 0.1,
      explorationRate: 0.2,
      feedbackWeight: 0.6,
      performanceWeight: 0.4,
      autoTuneWeights: false,
      autoTuneIntervalHours: 24,
      minSamplesForTuning: 100,
    };
  }

  private mapOrchestrationRequest(row: Record<string, unknown>): OrchestrationRequest {
    return {
      requestId: String(row.request_id),
      tenantId: String(row.tenant_id),
      userId: String(row.user_id),
      startedAt: String(row.started_at),
      completedAt: row.completed_at ? String(row.completed_at) : null,
      status: String(row.status || 'unknown'),
      detectedFieldId: row.detected_field_id ? String(row.detected_field_id) : null,
      detectedDomainId: row.detected_domain_id ? String(row.detected_domain_id) : null,
      selectedModel: row.selected_model ? String(row.selected_model) : null,
      totalLatencyMs: row.total_latency_ms ? parseInt(String(row.total_latency_ms), 10) : null,
      estimatedCostCents: row.estimated_cost_cents ? parseFloat(String(row.estimated_cost_cents)) : null,
      servicesInvoked: typeof row.services_invoked === 'string' ? JSON.parse(row.services_invoked) : row.services_invoked || [],
      decisionsLog: typeof row.decisions_log === 'string' ? JSON.parse(row.decisions_log) : row.decisions_log || [],
    };
  }

  private mapParameterDefault(row: Record<string, unknown>): ParameterDefault {
    return {
      category: String(row.parameter_category),
      name: String(row.parameter_name),
      defaultValue: parseFloat(String(row.default_value || 0)),
      minValue: row.min_value !== null ? parseFloat(String(row.min_value)) : undefined,
      maxValue: row.max_value !== null ? parseFloat(String(row.max_value)) : undefined,
      currentValue: parseFloat(String(row.current_value || row.default_value || 0)),
      autoMode: row.auto_mode !== false,
      userOverride: row.user_override === true,
      description: row.description ? String(row.description) : undefined,
    };
  }
}

export const agiOrchestrationSettingsService = new AGIOrchestrationSettingsService();
