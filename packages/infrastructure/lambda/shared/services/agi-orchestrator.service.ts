// RADIANT v4.18.0 - AGI Orchestrator Service
// Intelligent routing to specialist models for superior intelligence
// Supports ensemble patterns, self-hosted models, and mixture-of-experts
// Full AGI integration with moral compass, confidence calibration, and self-awareness

import { executeStatement } from '../db/client';
import { modelRouterService, ModelResponse } from './model-router.service';
import { moralCompassService, MoralEvaluation } from './moral-compass.service';
import { agiCompleteService, CalibratedConfidence } from './agi-complete.service';
import { selfImprovementService } from './self-improvement.service';
import { domainTaxonomyService, type DomainDetectionResult, type ProficiencyScores } from './domain-taxonomy.service';

// ============================================================================
// Types
// ============================================================================

export interface Specialty {
  specialtyId: string;
  name: string;
  category: string;
  description?: string;
  preferredModels: string[];
  fallbackModels: string[];
  preferSelfHosted: boolean;
}

export interface EnsemblePattern {
  patternId: string;
  name: string;
  patternType: 'voting' | 'chain' | 'debate' | 'verify' | 'specialize' | 'mixture_of_experts';
  modelsToUse: string[];
  combinationStrategy: string;
  debateRounds?: number;
  minAgreementThreshold: number;
}

// ============================================================================
// AGI Configuration Types
// ============================================================================

export interface AGIConfig {
  // Master toggle
  enabled: boolean;
  
  // Moral Compass
  moralCompass: {
    enabled: boolean;
    enforcementMode: 'strict' | 'balanced' | 'advisory';
    blockOnViolation: boolean;
    includeReasoningInResponse: boolean;
  };
  
  // Confidence Calibration
  confidenceCalibration: {
    enabled: boolean;
    domain?: string;
    includeUncertaintySources: boolean;
    minConfidenceThreshold: number;
  };
  
  // Self-Improvement
  selfImprovement: {
    enabled: boolean;
    recordPerformance: boolean;
    generateImprovementIdeas: boolean;
  };
  
  // Context Adaptation
  contextAdaptation: {
    enabled: boolean;
    detectContext: boolean;
    applyAdaptations: boolean;
  };
  
  // Proactive Assistance
  proactiveAssistance: {
    enabled: boolean;
    detectPatterns: boolean;
    generateSuggestions: boolean;
  };
  
  // Knowledge Graph
  knowledgeGraph: {
    enabled: boolean;
    queryRelevantKnowledge: boolean;
    extractAndStore: boolean;
  };
}

export const DEFAULT_AGI_CONFIG: AGIConfig = {
  enabled: true,
  moralCompass: {
    enabled: true,
    enforcementMode: 'strict',
    blockOnViolation: true,
    includeReasoningInResponse: false,
  },
  confidenceCalibration: {
    enabled: true,
    includeUncertaintySources: true,
    minConfidenceThreshold: 0.3,
  },
  selfImprovement: {
    enabled: true,
    recordPerformance: true,
    generateImprovementIdeas: false,
  },
  contextAdaptation: {
    enabled: true,
    detectContext: true,
    applyAdaptations: true,
  },
  proactiveAssistance: {
    enabled: false,
    detectPatterns: false,
    generateSuggestions: false,
  },
  knowledgeGraph: {
    enabled: false,
    queryRelevantKnowledge: false,
    extractAndStore: false,
  },
};

export interface OrchestrationRequest {
  taskDescription: string;
  tenantId: string;
  sessionId?: string;
  userId?: string;
  preferredStrategy?: 'single' | 'ensemble' | 'chain' | 'parallel';
  maxModels?: number;
  qualityPriority?: number; // 0-1
  maxLatencyMs?: number;
  forceSpecialty?: string;
  forceModels?: string[];
  
  // AGI Configuration - can override defaults per request
  agi?: Partial<AGIConfig>;
  
  // Domain Taxonomy Integration
  useDomainTaxonomy?: boolean;  // Enable domain-aware model selection
  domainOverride?: {
    field_id?: string;
    domain_id?: string;
    subspecialty_id?: string;
  };
}

export interface OrchestrationResult {
  requestId: string;
  finalResult: string;
  detectedSpecialty?: string;
  modelsUsed: string[];
  modelResults: Array<{
    model: string;
    result: string;
    latencyMs: number;
    quality?: number;
  }>;
  combinationMethod?: string;
  finalQualityScore?: number;
  agreementLevel?: number;
  totalLatencyMs: number;
  totalCostCents: number;
  
  // AGI Results
  agi?: {
    moralEvaluation?: MoralEvaluation;
    morallyApproved: boolean;
    moralReasoning?: string;
    confidenceCalibration?: CalibratedConfidence;
    contextDetected?: Record<string, unknown>;
    adaptationsApplied?: string[];
    knowledgeUsed?: string[];
    improvementIdeasGenerated?: number;
    agiProcessingTimeMs: number;
  };
  
  // Domain Taxonomy Results
  domainDetection?: {
    fieldId?: string;
    fieldName?: string;
    domainId?: string;
    domainName?: string;
    subspecialtyId?: string;
    subspecialtyName?: string;
    detectionConfidence: number;
    mergedProficiencies: ProficiencyScores;
  };
}

export interface ModelSpecialtyPerformance {
  modelId: string;
  specialtyName: string;
  avgQualityScore: number;
  avgLatencyMs: number;
  specialtyRank: number;
}

export interface SelfHostedPool {
  poolId: string;
  modelId: string;
  thermalState: 'OFF' | 'COLD' | 'WARM' | 'HOT';
  currentInstances: number;
  healthyInstances: number;
  currentUtilization: number;
}

// ============================================================================
// AGI Orchestrator Service
// ============================================================================

export class AGIOrchestratorService {
  // ============================================================================
  // Auto-Sync with Model Registry
  // ============================================================================

  async syncWithRegistry(): Promise<{ modelsSynced: number; modelsRemoved: number; errors: string[] }> {
    const result = await executeStatement(
      `SELECT * FROM sync_orchestration_from_registry()`,
      []
    );

    const row = result.rows[0] as Record<string, unknown>;
    return {
      modelsSynced: Number(row.models_synced || 0),
      modelsRemoved: Number(row.models_removed || 0),
      errors: (row.errors as string[]) || [],
    };
  }

  async registerNewModel(
    modelId: string,
    provider: string,
    source: 'external' | 'self-hosted',
    capabilities: string[],
    qualityTier: 1 | 2 | 3 = 2
  ): Promise<void> {
    await executeStatement(
      `SELECT register_model_with_orchestration($1, $2, $3, $4, $5, $6)`,
      [
        { name: 'modelId', value: { stringValue: modelId } },
        { name: 'provider', value: { stringValue: provider } },
        { name: 'source', value: { stringValue: source } },
        { name: 'capabilities', value: { stringValue: `{${capabilities.join(',')}}` } },
        { name: 'isFast', value: { booleanValue: capabilities.includes('fast') } },
        { name: 'qualityTier', value: { longValue: qualityTier } },
      ]
    );
  }

  async unregisterModel(modelId: string): Promise<void> {
    await executeStatement(
      `SELECT unregister_model_from_orchestration($1)`,
      [{ name: 'modelId', value: { stringValue: modelId } }]
    );
  }

  async getRecentModelChanges(limit = 50): Promise<Array<{
    eventType: string;
    modelId?: string;
    provider?: string;
    changeDetails: Record<string, unknown>;
    createdAt: string;
  }>> {
    const result = await executeStatement(
      `SELECT event_type, model_id, provider, change_details, created_at 
       FROM model_registry_events 
       ORDER BY created_at DESC 
       LIMIT $1`,
      [{ name: 'limit', value: { longValue: limit } }]
    );

    return result.rows.map(row => {
      const r = row as Record<string, unknown>;
      return {
        eventType: String(r.event_type),
        modelId: r.model_id ? String(r.model_id) : undefined,
        provider: r.provider ? String(r.provider) : undefined,
        changeDetails: typeof r.change_details === 'string' 
          ? JSON.parse(r.change_details) 
          : (r.change_details as Record<string, unknown>) || {},
        createdAt: String(r.created_at),
      };
    });
  }

  async getSyncHistory(limit = 20): Promise<Array<{
    syncId: string;
    syncType: string;
    modelsSynced: number;
    modelsRemoved: number;
    errors: string[];
    durationMs: number;
    completedAt?: string;
  }>> {
    const result = await executeStatement(
      `SELECT * FROM orchestration_sync_log ORDER BY started_at DESC LIMIT $1`,
      [{ name: 'limit', value: { longValue: limit } }]
    );

    return result.rows.map(row => {
      const r = row as Record<string, unknown>;
      return {
        syncId: String(r.sync_id),
        syncType: String(r.sync_type),
        modelsSynced: Number(r.models_synced || 0),
        modelsRemoved: Number(r.models_removed || 0),
        errors: (r.errors as string[]) || [],
        durationMs: Number(r.duration_ms || 0),
        completedAt: r.completed_at ? String(r.completed_at) : undefined,
      };
    });
  }

  // ============================================================================
  // Main Orchestration with Full AGI Integration
  // ============================================================================

  async orchestrate(request: OrchestrationRequest): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    const agiStartTime = Date.now();

    // Merge AGI config with defaults
    const agiConfig = this.mergeAGIConfig(request.agi);

    // =========================================================================
    // AGI PRE-PROCESSING
    // =========================================================================
    
    let moralEvaluation: MoralEvaluation | undefined;
    let morallyApproved = true;
    let moralReasoning: string | undefined;
    let contextDetected: Record<string, unknown> | undefined;
    let adaptationsApplied: string[] = [];
    let knowledgeUsed: string[] = [];

    // 1. MORAL COMPASS CHECK (if enabled)
    if (agiConfig.enabled && agiConfig.moralCompass.enabled) {
      const { proceed, reason, evaluation } = await moralCompassService.shouldProceed(
        request.tenantId,
        request.taskDescription
      );
      
      moralEvaluation = evaluation;
      morallyApproved = proceed;
      moralReasoning = reason;

      // Block if configured to do so on violation
      if (!proceed && agiConfig.moralCompass.blockOnViolation) {
        const agiProcessingTimeMs = Date.now() - agiStartTime;
        return {
          requestId,
          finalResult: agiConfig.moralCompass.includeReasoningInResponse
            ? `I cannot assist with this request. ${reason}`
            : 'I cannot assist with this request as it conflicts with my ethical guidelines.',
          modelsUsed: [],
          modelResults: [],
          totalLatencyMs: Date.now() - startTime,
          totalCostCents: 0,
          agi: {
            moralEvaluation,
            morallyApproved: false,
            moralReasoning: reason,
            agiProcessingTimeMs,
          },
        };
      }
    }

    // 2. CONTEXT DETECTION (if enabled)
    if (agiConfig.enabled && agiConfig.contextAdaptation.enabled && agiConfig.contextAdaptation.detectContext) {
      try {
        const contextState = await agiCompleteService.detectContext(
          request.tenantId,
          request.sessionId || 'default',
          request.taskDescription
        );
        contextDetected = {
          user: contextState.userContext,
          task: contextState.taskContext,
          domain: contextState.domainContext,
        };
      } catch { /* context detection failed, continue */ }
    }

    // 3. KNOWLEDGE GRAPH QUERY (if enabled)
    if (agiConfig.enabled && agiConfig.knowledgeGraph.enabled && agiConfig.knowledgeGraph.queryRelevantKnowledge) {
      try {
        const relevantKnowledge = await agiCompleteService.queryKnowledgeGraph(
          request.tenantId,
          request.taskDescription
        );
        knowledgeUsed = relevantKnowledge.slice(0, 5).map(k => k.node.name);
      } catch { /* knowledge query failed, continue */ }
    }

    // 4. PROACTIVE PATTERN DETECTION (if enabled)
    if (agiConfig.enabled && agiConfig.proactiveAssistance.enabled && agiConfig.proactiveAssistance.detectPatterns && request.userId) {
      try {
        await agiCompleteService.detectBehaviorPattern(
          request.tenantId,
          request.userId,
          'orchestration_request',
          { task: request.taskDescription.substring(0, 200) }
        );
      } catch { /* pattern detection failed, continue */ }
    }

    // =========================================================================
    // STANDARD ORCHESTRATION (with Domain Taxonomy Integration)
    // =========================================================================

    // 5. Domain detection (if enabled) - enhances specialty detection
    let domainResult: DomainDetectionResult | undefined;
    let domainProficiencies: ProficiencyScores | undefined;
    
    if (request.useDomainTaxonomy !== false) {  // Enabled by default
      try {
        domainResult = await domainTaxonomyService.detectDomain(request.taskDescription, {
          include_subspecialties: true,
          min_confidence: 0.3,
          max_results: 3,
          manual_override: request.domainOverride,
        });
        
        if (domainResult.detection_confidence > 0.3) {
          domainProficiencies = domainResult.merged_proficiencies;
          
          // Add domain to context detection
          if (contextDetected) {
            contextDetected.domainTaxonomy = {
              fieldId: domainResult.primary_field?.field_id,
              domainId: domainResult.primary_domain?.domain_id,
              subspecialtyId: domainResult.primary_subspecialty?.subspecialty_id,
              confidence: domainResult.detection_confidence,
            };
          }
        }
      } catch { /* domain detection failed, continue with standard flow */ }
    }

    // 6. Detect specialty (enhanced with domain if available)
    let specialty: string | null = request.forceSpecialty || null;
    if (!specialty) {
      // Map domain to specialty if detected
      if (domainResult?.primary_domain) {
        specialty = this.mapDomainToSpecialty(domainResult.primary_domain.domain_id);
      }
      // Fallback to legacy detection
      if (!specialty) {
        specialty = await this.detectSpecialty(request.taskDescription);
      }
    }

    // 7. Get orchestration settings
    const settings = await this.getSettings(request.tenantId);

    // 8. Determine routing strategy
    const strategy = request.preferredStrategy || 
      (settings?.allow_ensemble && request.qualityPriority && request.qualityPriority > 0.8 ? 'ensemble' : 'single');

    // 9. Select models (domain-aware if proficiencies available)
    const maxModels = request.maxModels || (settings?.max_models_per_request as number | undefined) || 3;
    let models: string[];
    
    if (request.forceModels) {
      models = request.forceModels;
    } else if (domainProficiencies) {
      // Use domain taxonomy for model selection
      models = await this.selectModelsWithProficiencies(
        request.tenantId,
        domainProficiencies,
        maxModels
      );
    } else {
      // Fallback to specialty-based selection
      models = await this.selectModels(
        request.tenantId,
        specialty,
        strategy,
        maxModels
      );
    }

    // 9. Execute based on strategy
    let result: OrchestrationResult;

    switch (strategy) {
      case 'ensemble':
        result = await this.executeEnsemble(request.tenantId, request.taskDescription, models, specialty, agiConfig);
        break;
      case 'chain':
        result = await this.executeChain(request.tenantId, request.taskDescription, models, specialty, agiConfig);
        break;
      case 'parallel':
        result = await this.executeParallel(request.tenantId, request.taskDescription, models, specialty, agiConfig);
        break;
      default:
        result = await this.executeSingle(request.tenantId, request.taskDescription, models[0], specialty, agiConfig);
    }

    result.requestId = requestId;
    result.detectedSpecialty = specialty || undefined;

    // =========================================================================
    // AGI POST-PROCESSING
    // =========================================================================

    let confidenceCalibration: CalibratedConfidence | undefined;
    let improvementIdeasGenerated = 0;

    // 10. CONFIDENCE CALIBRATION (if enabled)
    if (agiConfig.enabled && agiConfig.confidenceCalibration.enabled && result.finalQualityScore !== undefined) {
      try {
        confidenceCalibration = await agiCompleteService.calibrateConfidence(
          request.tenantId,
          agiConfig.confidenceCalibration.domain || specialty || 'general',
          result.finalQualityScore
        );

        // Warn if confidence is below threshold
        if (confidenceCalibration.calibratedConfidence < agiConfig.confidenceCalibration.minConfidenceThreshold) {
          result.finalResult += '\n\n*Note: This response has lower confidence than usual. Please verify the information independently.*';
        }
      } catch { /* calibration failed, continue */ }
    }

    // 11. CONTEXT ADAPTATION OF OUTPUT (if enabled)
    if (agiConfig.enabled && agiConfig.contextAdaptation.enabled && agiConfig.contextAdaptation.applyAdaptations && contextDetected) {
      try {
        const contextState = {
          contextId: '',
          userContext: contextDetected.user as Record<string, unknown> || {},
          taskContext: contextDetected.task as Record<string, unknown> || {},
          domainContext: contextDetected.domain as Record<string, unknown> || {},
          temporalContext: {},
          currentAdaptations: {},
        };
        const adaptations = await agiCompleteService.getAdaptations(request.tenantId, contextState);
        
        if (Object.keys(adaptations.styleAdaptations).length > 0 || Object.keys(adaptations.formatAdaptations).length > 0) {
          result.finalResult = await agiCompleteService.applyAdaptations(result.finalResult, adaptations);
          adaptationsApplied = Object.keys(adaptations.styleAdaptations);
        }
      } catch { /* adaptation failed, continue */ }
    }

    // 12. KNOWLEDGE EXTRACTION (if enabled)
    if (agiConfig.enabled && agiConfig.knowledgeGraph.enabled && agiConfig.knowledgeGraph.extractAndStore) {
      try {
        await agiCompleteService.extractKnowledgeFromText(request.tenantId, result.finalResult);
      } catch { /* extraction failed, continue */ }
    }

    // 13. SELF-IMPROVEMENT RECORDING (if enabled)
    if (agiConfig.enabled && agiConfig.selfImprovement.enabled && agiConfig.selfImprovement.recordPerformance) {
      try {
        await selfImprovementService.recordSelfAwareness(
          request.tenantId,
          specialty || 'general',
          result.finalQualityScore || 0.7,
          1 - (result.finalQualityScore || 0.7),
          result.finalQualityScore
        );
      } catch { /* recording failed, continue */ }
    }

    // 14. GENERATE IMPROVEMENT IDEAS (if enabled and quality is low)
    if (agiConfig.enabled && agiConfig.selfImprovement.enabled && agiConfig.selfImprovement.generateImprovementIdeas) {
      if (result.finalQualityScore !== undefined && result.finalQualityScore < 0.6) {
        try {
          await selfImprovementService.createIdea(
            request.tenantId,
            `Improve ${specialty || 'general'} responses`,
            `Response quality was ${(result.finalQualityScore * 100).toFixed(0)}% for task type: ${specialty || 'general'}`,
            'performance',
            'performance_analysis',
            { confidence: 0.6 }
          );
          improvementIdeasGenerated = 1;
        } catch { /* idea creation failed, continue */ }
      }
    }

    const agiProcessingTimeMs = Date.now() - agiStartTime;

    // Add AGI results
    result.agi = {
      moralEvaluation,
      morallyApproved,
      moralReasoning,
      confidenceCalibration,
      contextDetected,
      adaptationsApplied,
      knowledgeUsed,
      improvementIdeasGenerated,
      agiProcessingTimeMs,
    };

    // Add domain detection results
    if (domainResult && domainResult.detection_confidence > 0) {
      result.domainDetection = {
        fieldId: domainResult.primary_field?.field_id,
        fieldName: domainResult.primary_field?.field_name,
        domainId: domainResult.primary_domain?.domain_id,
        domainName: domainResult.primary_domain?.domain_name,
        subspecialtyId: domainResult.primary_subspecialty?.subspecialty_id,
        subspecialtyName: domainResult.primary_subspecialty?.subspecialty_name,
        detectionConfidence: domainResult.detection_confidence,
        mergedProficiencies: domainResult.merged_proficiencies,
      };
    }

    result.totalLatencyMs = Date.now() - startTime;

    // 15. Record results
    await this.recordOrchestration(request.tenantId, result, strategy);

    return result;
  }

  // Merge user AGI config with defaults
  private mergeAGIConfig(userConfig?: Partial<AGIConfig>): AGIConfig {
    if (!userConfig) return { ...DEFAULT_AGI_CONFIG };

    return {
      enabled: userConfig.enabled ?? DEFAULT_AGI_CONFIG.enabled,
      moralCompass: { ...DEFAULT_AGI_CONFIG.moralCompass, ...userConfig.moralCompass },
      confidenceCalibration: { ...DEFAULT_AGI_CONFIG.confidenceCalibration, ...userConfig.confidenceCalibration },
      selfImprovement: { ...DEFAULT_AGI_CONFIG.selfImprovement, ...userConfig.selfImprovement },
      contextAdaptation: { ...DEFAULT_AGI_CONFIG.contextAdaptation, ...userConfig.contextAdaptation },
      proactiveAssistance: { ...DEFAULT_AGI_CONFIG.proactiveAssistance, ...userConfig.proactiveAssistance },
      knowledgeGraph: { ...DEFAULT_AGI_CONFIG.knowledgeGraph, ...userConfig.knowledgeGraph },
    };
  }

  // ============================================================================
  // Specialty Detection
  // ============================================================================

  async detectSpecialty(taskDescription: string): Promise<string | null> {
    const result = await executeStatement(
      `SELECT detect_specialty($1)`,
      [{ name: 'task', value: { stringValue: taskDescription } }]
    );

    const detected = (result.rows[0] as Record<string, unknown>)?.detect_specialty;
    return detected ? String(detected) : null;
  }

  async getSpecialties(): Promise<Specialty[]> {
    const result = await executeStatement(
      `SELECT * FROM model_specialties ORDER BY category, name`,
      []
    );

    return result.rows.map(row => this.mapSpecialty(row as Record<string, unknown>));
  }

  async getSpecialtyPerformance(specialty: string): Promise<ModelSpecialtyPerformance[]> {
    const result = await executeStatement(
      `SELECT * FROM model_specialty_performance 
       WHERE specialty_name = $1 
       ORDER BY specialty_rank ASC NULLS LAST`,
      [{ name: 'specialty', value: { stringValue: specialty } }]
    );

    return result.rows.map(row => this.mapSpecialtyPerformance(row as Record<string, unknown>));
  }

  // ============================================================================
  // Model Selection
  // ============================================================================

  async selectModels(
    tenantId: string,
    specialty: string | null,
    strategy: string,
    maxModels: number
  ): Promise<string[]> {
    const models: string[] = [];

    if (specialty) {
      // Get best model for specialty
      const bestModel = await this.getBestModelForSpecialty(tenantId, specialty);
      if (bestModel) models.push(bestModel);

      // For ensemble, get additional models
      if (strategy === 'ensemble' || strategy === 'parallel') {
        const additionalModels = await this.getAdditionalModelsForSpecialty(specialty, maxModels - 1);
        models.push(...additionalModels.filter(m => !models.includes(m)));
      }
    }

    // Ensure we have at least one model
    if (models.length === 0) {
      models.push('anthropic/claude-3-5-sonnet-20241022');
    }

    return models.slice(0, maxModels);
  }

  async getBestModelForSpecialty(tenantId: string, specialty: string): Promise<string | null> {
    const settings = await this.getSettings(tenantId);
    
    // Check for tenant-specific override
    const overrides = settings?.specialty_model_overrides as Record<string, string> | undefined;
    if (overrides && overrides[specialty]) {
      return overrides[specialty];
    }

    // Use database function
    const preferSelfHosted = Boolean(settings?.prefer_self_hosted);
    const result = await executeStatement(
      `SELECT get_best_model_for_specialty($1, $2)`,
      [
        { name: 'specialty', value: { stringValue: specialty } },
        { name: 'preferSelfHosted', value: { booleanValue: preferSelfHosted } },
      ]
    );

    const model = (result.rows[0] as Record<string, unknown>)?.get_best_model_for_specialty;
    return model ? String(model) : null;
  }

  async getAdditionalModelsForSpecialty(specialty: string, count: number): Promise<string[]> {
    const result = await executeStatement(
      `SELECT preferred_models, fallback_models FROM model_specialties WHERE name = $1`,
      [{ name: 'specialty', value: { stringValue: specialty } }]
    );

    if (result.rows.length === 0) return [];

    const row = result.rows[0] as Record<string, unknown>;
    const preferred = (row.preferred_models as string[]) || [];
    const fallback = (row.fallback_models as string[]) || [];

    return [...preferred.slice(1), ...fallback].slice(0, count);
  }

  // Map domain IDs to legacy specialty names
  private mapDomainToSpecialty(domainId: string): string | null {
    const domainToSpecialty: Record<string, string> = {
      // Computer Science & IT
      'software_engineering': 'coding',
      'web_development': 'coding',
      'cybersecurity': 'security',
      'machine_learning': 'reasoning',
      'deep_learning': 'reasoning',
      'nlp': 'reasoning',
      // Sciences
      'physics': 'science',
      'chemistry': 'science',
      'biology': 'science',
      // Medicine
      'clinical_medicine': 'medical',
      'pharmacology': 'medical',
      // Business
      'finance': 'finance',
      'marketing': 'creative',
      // Law
      'corporate_law': 'legal',
      'intellectual_property': 'legal',
      // Arts
      'visual_arts': 'creative',
      'graphic_design': 'creative',
      // Analysis domains
      'data_science': 'analysis',
      'statistics': 'math',
    };
    
    return domainToSpecialty[domainId] || null;
  }

  // Select models based on domain proficiency requirements
  async selectModelsWithProficiencies(
    tenantId: string,
    proficiencies: ProficiencyScores,
    maxModels: number
  ): Promise<string[]> {
    try {
      const matches = await domainTaxonomyService.getMatchingModels(proficiencies, {
        max_models: maxModels,
        min_match_score: 50,
        include_self_hosted: true,
      });

      if (matches.length > 0) {
        return matches.map(m => m.model_id);
      }
    } catch { /* domain matching failed, fall back to default */ }

    // Fallback to default model
    return ['anthropic/claude-3-5-sonnet-20241022'];
  }

  // ============================================================================
  // Execution Strategies
  // ============================================================================

  async executeSingle(
    tenantId: string,
    task: string,
    modelId: string,
    specialty: string | null,
    agiConfig?: AGIConfig
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();

    try {
      const response = await modelRouterService.invoke({
        modelId,
        messages: [{ role: 'user', content: task }],
      });

      // Assess quality
      const quality = await this.assessQuality(response.content, task);

      // Record performance
      if (specialty) {
        await this.recordSpecialtyPerformance(modelId, specialty, true, quality, response.latencyMs, response.costCents);
      }

      return {
        requestId: '',
        finalResult: response.content,
        modelsUsed: [modelId],
        modelResults: [{
          model: modelId,
          result: response.content,
          latencyMs: response.latencyMs,
          quality,
        }],
        finalQualityScore: quality,
        totalLatencyMs: Date.now() - startTime,
        totalCostCents: response.costCents,
      };
    } catch (error) {
      // Try fallback
      const fallback = await this.getFallbackModel(modelId, specialty);
      if (fallback && fallback !== modelId) {
        return this.executeSingle(tenantId, task, fallback, specialty);
      }
      throw error;
    }
  }

  async executeEnsemble(
    tenantId: string,
    task: string,
    models: string[],
    specialty: string | null,
    agiConfig?: AGIConfig
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const modelResults: OrchestrationResult['modelResults'] = [];
    let totalCost = 0;

    // Execute all models in parallel
    const responses = await Promise.allSettled(
      models.map(async (modelId) => {
        const response = await modelRouterService.invoke({
          modelId,
          messages: [{ role: 'user', content: task }],
        });
        return { modelId, response };
      })
    );

    // Collect results
    for (const result of responses) {
      if (result.status === 'fulfilled') {
        const { modelId, response } = result.value;
        const quality = await this.assessQuality(response.content, task);
        
        modelResults.push({
          model: modelId,
          result: response.content,
          latencyMs: response.latencyMs,
          quality,
        });
        totalCost += response.costCents;

        if (specialty) {
          await this.recordSpecialtyPerformance(modelId, specialty, true, quality, response.latencyMs, response.costCents);
        }
      }
    }

    if (modelResults.length === 0) {
      throw new Error('All models failed');
    }

    // Combine results
    const { finalResult, combinationMethod, agreementLevel } = await this.combineResults(
      modelResults,
      'weighted_average',
      task
    );

    const avgQuality = modelResults.reduce((sum, r) => sum + (r.quality || 0), 0) / modelResults.length;

    return {
      requestId: '',
      finalResult,
      modelsUsed: modelResults.map(r => r.model),
      modelResults,
      combinationMethod,
      finalQualityScore: avgQuality,
      agreementLevel,
      totalLatencyMs: Date.now() - startTime,
      totalCostCents: totalCost,
    };
  }

  async executeChain(
    tenantId: string,
    task: string,
    models: string[],
    specialty: string | null,
    agiConfig?: AGIConfig
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const modelResults: OrchestrationResult['modelResults'] = [];
    let totalCost = 0;
    let currentInput = task;

    for (let i = 0; i < models.length; i++) {
      const modelId = models[i];
      const isLast = i === models.length - 1;

      const prompt = i === 0 
        ? currentInput 
        : `Previous analysis:\n${currentInput}\n\n${isLast ? 'Provide the final answer:' : 'Build on this analysis:'}`;

      const response = await modelRouterService.invoke({
        modelId,
        messages: [{ role: 'user', content: prompt }],
      });

      const quality = await this.assessQuality(response.content, task);

      modelResults.push({
        model: modelId,
        result: response.content,
        latencyMs: response.latencyMs,
        quality,
      });
      totalCost += response.costCents;
      currentInput = response.content;

      if (specialty) {
        await this.recordSpecialtyPerformance(modelId, specialty, true, quality, response.latencyMs, response.costCents);
      }
    }

    const avgQuality = modelResults.reduce((sum, r) => sum + (r.quality || 0), 0) / modelResults.length;

    return {
      requestId: '',
      finalResult: currentInput,
      modelsUsed: models,
      modelResults,
      combinationMethod: 'chain',
      finalQualityScore: avgQuality,
      totalLatencyMs: Date.now() - startTime,
      totalCostCents: totalCost,
    };
  }

  async executeParallel(
    tenantId: string,
    task: string,
    models: string[],
    specialty: string | null,
    agiConfig?: AGIConfig
  ): Promise<OrchestrationResult> {
    // Same as ensemble but uses best result instead of combining
    const ensembleResult = await this.executeEnsemble(tenantId, task, models, specialty);

    // Select best result
    const bestResult = ensembleResult.modelResults.reduce((best, current) => 
      (current.quality || 0) > (best.quality || 0) ? current : best
    );

    return {
      ...ensembleResult,
      finalResult: bestResult.result,
      combinationMethod: 'best_result',
    };
  }

  async executeDebate(
    tenantId: string,
    task: string,
    models: string[],
    rounds: number = 3
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const modelResults: OrchestrationResult['modelResults'] = [];
    let totalCost = 0;

    // Initial responses
    const initialResponses: Array<{ model: string; response: string }> = [];
    
    for (const modelId of models.slice(0, 2)) {
      const response = await modelRouterService.invoke({
        modelId,
        messages: [{ role: 'user', content: task }],
      });
      initialResponses.push({ model: modelId, response: response.content });
      totalCost += response.costCents;
    }

    // Debate rounds
    let lastResponses = initialResponses;
    
    for (let round = 0; round < rounds; round++) {
      const newResponses: typeof lastResponses = [];
      
      for (let i = 0; i < lastResponses.length; i++) {
        const myResponse = lastResponses[i];
        const otherResponse = lastResponses[(i + 1) % lastResponses.length];
        
        const debatePrompt = `Original question: ${task}

Your previous answer: ${myResponse.response}

Another perspective: ${otherResponse.response}

Consider both perspectives. If the other view has merit, incorporate it. If you disagree, explain why. Provide your refined answer.`;

        const response = await modelRouterService.invoke({
          modelId: myResponse.model,
          messages: [{ role: 'user', content: debatePrompt }],
        });
        
        newResponses.push({ model: myResponse.model, response: response.content });
        totalCost += response.costCents;
        
        modelResults.push({
          model: myResponse.model,
          result: response.content,
          latencyMs: response.latencyMs,
        });
      }
      
      lastResponses = newResponses;
    }

    // Synthesize final answer
    const synthesisPrompt = `Original question: ${task}

After debate, here are the final positions:
${lastResponses.map((r, i) => `Model ${i + 1}: ${r.response}`).join('\n\n')}

Synthesize these into a single, best answer:`;

    const synthesizer = models[0];
    const finalResponse = await modelRouterService.invoke({
      modelId: synthesizer,
      messages: [{ role: 'user', content: synthesisPrompt }],
    });
    totalCost += finalResponse.costCents;

    return {
      requestId: '',
      finalResult: finalResponse.content,
      modelsUsed: models.slice(0, 2),
      modelResults,
      combinationMethod: 'debate',
      totalLatencyMs: Date.now() - startTime,
      totalCostCents: totalCost,
    };
  }

  // ============================================================================
  // Result Combination
  // ============================================================================

  async combineResults(
    results: OrchestrationResult['modelResults'],
    strategy: string,
    originalTask: string
  ): Promise<{ finalResult: string; combinationMethod: string; agreementLevel?: number }> {
    if (results.length === 1) {
      return { finalResult: results[0].result, combinationMethod: 'single' };
    }

    // Calculate agreement
    const agreementLevel = await this.calculateAgreement(results.map(r => r.result));

    if (agreementLevel > 0.9) {
      // High agreement - use highest quality result
      const best = results.reduce((a, b) => (a.quality || 0) > (b.quality || 0) ? a : b);
      return { finalResult: best.result, combinationMethod: 'high_agreement', agreementLevel };
    }

    if (strategy === 'weighted_average' || strategy === 'synthesis') {
      // Use LLM to synthesize
      const synthesisPrompt = `Original task: ${originalTask}

Multiple AI models provided these responses:
${results.map((r, i) => `Model ${i + 1} (quality: ${((r.quality || 0) * 100).toFixed(0)}%): ${r.result}`).join('\n\n')}

Synthesize these into a single, optimal response that incorporates the best elements from each:`;

      const synthesis = await modelRouterService.invoke({
        modelId: 'anthropic/claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: synthesisPrompt }],
        maxTokens: 4096,
      });

      return { finalResult: synthesis.content, combinationMethod: 'synthesis', agreementLevel };
    }

    // Majority vote / best confidence
    const best = results.reduce((a, b) => (a.quality || 0) > (b.quality || 0) ? a : b);
    return { finalResult: best.result, combinationMethod: 'best_confidence', agreementLevel };
  }

  async calculateAgreement(responses: string[]): Promise<number> {
    if (responses.length < 2) return 1;

    // Use LLM to assess semantic similarity
    const prompt = `Rate the semantic agreement between these responses on a scale of 0-1:

Response 1: ${responses[0].substring(0, 500)}

Response 2: ${responses[1].substring(0, 500)}

${responses.length > 2 ? `Response 3: ${responses[2].substring(0, 500)}` : ''}

Return only a number between 0 and 1:`;

    try {
      const response = await modelRouterService.invoke({
        modelId: 'anthropic/claude-3-haiku',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 10,
      });

      const score = parseFloat(response.content.trim());
      return isNaN(score) ? 0.5 : Math.min(1, Math.max(0, score));
    } catch {
      return 0.5;
    }
  }

  // ============================================================================
  // Quality Assessment
  // ============================================================================

  async assessQuality(response: string, task: string): Promise<number> {
    const prompt = `Rate the quality of this response to the task on a scale of 0-1.

Task: ${task.substring(0, 500)}

Response: ${response.substring(0, 1000)}

Consider: relevance, accuracy, completeness, clarity.
Return only a number between 0 and 1:`;

    try {
      const assessment = await modelRouterService.invoke({
        modelId: 'anthropic/claude-3-haiku',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 10,
      });

      const score = parseFloat(assessment.content.trim());
      return isNaN(score) ? 0.7 : Math.min(1, Math.max(0, score));
    } catch {
      return 0.7;
    }
  }

  // ============================================================================
  // Self-Hosted Model Management
  // ============================================================================

  async getSelfHostedPools(tenantId: string): Promise<SelfHostedPool[]> {
    const result = await executeStatement(
      `SELECT * FROM self_hosted_model_pools 
       WHERE tenant_id = $1 OR tenant_id IS NULL
       ORDER BY model_id`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return result.rows.map(row => this.mapSelfHostedPool(row as Record<string, unknown>));
  }

  async warmupModel(poolId: string): Promise<void> {
    await executeStatement(
      `UPDATE self_hosted_model_pools SET
        thermal_state = 'WARM',
        updated_at = NOW()
      WHERE pool_id = $1`,
      [{ name: 'poolId', value: { stringValue: poolId } }]
    );
  }

  async getWarmModels(): Promise<string[]> {
    const result = await executeStatement(
      `SELECT model_id FROM self_hosted_model_pools 
       WHERE thermal_state IN ('WARM', 'HOT') AND healthy_instances > 0`,
      []
    );

    return result.rows.map(row => (row as { model_id: string }).model_id);
  }

  // ============================================================================
  // Performance Recording
  // ============================================================================

  async recordSpecialtyPerformance(
    modelId: string,
    specialty: string,
    success: boolean,
    quality: number,
    latencyMs: number,
    costCents: number
  ): Promise<void> {
    await executeStatement(
      `SELECT record_specialty_performance($1, $2, $3, $4, $5, $6)`,
      [
        { name: 'modelId', value: { stringValue: modelId } },
        { name: 'specialty', value: { stringValue: specialty } },
        { name: 'success', value: { booleanValue: success } },
        { name: 'quality', value: { doubleValue: quality } },
        { name: 'latencyMs', value: { longValue: latencyMs } },
        { name: 'costCents', value: { doubleValue: costCents } },
      ]
    );
  }

  async recordOrchestration(
    tenantId: string,
    result: OrchestrationResult,
    strategy: string
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO orchestration_requests (
        tenant_id, task_description, detected_specialty, routing_strategy,
        models_invoked, model_results, final_result, combination_method,
        final_quality_score, agreement_level, total_latency_ms, total_cost_cents
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'task', value: { stringValue: result.finalResult.substring(0, 500) } },
        { name: 'specialty', value: result.detectedSpecialty ? { stringValue: result.detectedSpecialty } : { isNull: true } },
        { name: 'strategy', value: { stringValue: strategy } },
        { name: 'models', value: { stringValue: `{${result.modelsUsed.join(',')}}` } },
        { name: 'modelResults', value: { stringValue: JSON.stringify(result.modelResults) } },
        { name: 'finalResult', value: { stringValue: result.finalResult.substring(0, 10000) } },
        { name: 'combination', value: result.combinationMethod ? { stringValue: result.combinationMethod } : { isNull: true } },
        { name: 'quality', value: result.finalQualityScore ? { doubleValue: result.finalQualityScore } : { isNull: true } },
        { name: 'agreement', value: result.agreementLevel ? { doubleValue: result.agreementLevel } : { isNull: true } },
        { name: 'latency', value: { longValue: result.totalLatencyMs } },
        { name: 'cost', value: { doubleValue: result.totalCostCents } },
      ]
    );
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  async getSettings(tenantId: string): Promise<Record<string, unknown> | null> {
    const result = await executeStatement(
      `SELECT * FROM orchestration_settings WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return result.rows.length > 0 ? (result.rows[0] as Record<string, unknown>) : null;
  }

  async getFallbackModel(failedModel: string, specialty: string | null): Promise<string | null> {
    if (specialty) {
      const result = await executeStatement(
        `SELECT fallback_models FROM model_specialties WHERE name = $1`,
        [{ name: 'specialty', value: { stringValue: specialty } }]
      );

      if (result.rows.length > 0) {
        const fallbacks = (result.rows[0] as { fallback_models: string[] }).fallback_models;
        const available = fallbacks.find(m => m !== failedModel);
        if (available) return available;
      }
    }

    // Default fallback
    const defaults = ['anthropic/claude-3-5-sonnet-20241022', 'openai/gpt-4o', 'google/gemini-1.5-pro'];
    return defaults.find(m => m !== failedModel) || null;
  }

  private mapSpecialty(row: Record<string, unknown>): Specialty {
    return {
      specialtyId: String(row.specialty_id),
      name: String(row.name),
      category: String(row.category),
      description: row.description ? String(row.description) : undefined,
      preferredModels: (row.preferred_models as string[]) || [],
      fallbackModels: (row.fallback_models as string[]) || [],
      preferSelfHosted: Boolean(row.prefer_self_hosted ?? false),
    };
  }

  private mapSpecialtyPerformance(row: Record<string, unknown>): ModelSpecialtyPerformance {
    return {
      modelId: String(row.model_id),
      specialtyName: String(row.specialty_name),
      avgQualityScore: Number(row.avg_quality_score ?? 0),
      avgLatencyMs: Number(row.avg_latency_ms ?? 0),
      specialtyRank: Number(row.specialty_rank ?? 999),
    };
  }

  private mapSelfHostedPool(row: Record<string, unknown>): SelfHostedPool {
    return {
      poolId: String(row.pool_id),
      modelId: String(row.model_id),
      thermalState: (row.thermal_state as SelfHostedPool['thermalState']) || 'COLD',
      currentInstances: Number(row.current_instances ?? 0),
      healthyInstances: Number(row.healthy_instances ?? 0),
      currentUtilization: Number(row.current_utilization ?? 0),
    };
  }
}

export const agiOrchestratorService = new AGIOrchestratorService();
