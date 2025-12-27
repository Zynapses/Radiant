// RADIANT v4.18.0 - Model Metadata Service
// Comprehensive metadata with AI-powered internet research and admin control

import { executeStatement } from '../db/client';
import { modelRouterService } from './model-router.service';

// ============================================================================
// Types
// ============================================================================

export interface ModelMetadata {
  metadataId: string;
  modelId: string;
  provider: string;
  modelName: string;
  modelFamily?: string;
  version?: string;
  releaseDate?: string;
  
  // Capabilities
  capabilities: Record<string, number>;
  supportedModalities: { input: string[]; output: string[] };
  specialties: string[];
  weaknesses: string[];
  
  // Technical specs
  contextWindow?: number;
  maxOutputTokens?: number;
  trainingCutoff?: string;
  parameterCount?: number;
  architecture?: string;
  
  // Benchmarks
  benchmarks: Record<string, number>;
  benchmarkDate?: string;
  
  // Pricing
  inputPricePer1M?: number;
  outputPricePer1M?: number;
  priceCurrency: string;
  priceUpdatedAt?: string;
  
  // Availability
  regionsAvailable: string[];
  apiEndpoints: Record<string, string>;
  rateLimits: { rpm?: number; tpm?: number; rpd?: number };
  
  // Usage guidelines
  bestUseCases: string[];
  notRecommendedFor: string[];
  promptTips: string[];
  functionCallingSupport: boolean;
  jsonModeSupport: boolean;
  streamingSupport: boolean;
  
  // Quality scores
  reliabilityScore?: number;
  qualityScore?: number;
  speedScore?: number;
  valueScore?: number;
  
  // Metadata status
  metadataCompleteness: number;
  metadataConfidence: number;
  lastVerified?: string;
  
  // Flags
  isAvailable: boolean;
  isDeprecated: boolean;
  requiresApproval: boolean;
  
  // Admin
  adminNotes?: string;
  adminOverride: Record<string, unknown>;
  
  updatedAt: string;
}

export interface MetadataSource {
  sourceId: string;
  name: string;
  sourceType: string;
  url?: string;
  trustScore: number;
  isOfficial: boolean;
  refreshIntervalHours: number;
  lastFetched?: string;
  enabled: boolean;
}

export interface MetadataResearchResult {
  researchId: string;
  modelId: string;
  researchType: string;
  fieldsUpdated: string[];
  aiConfidence: number;
  aiReasoning?: string;
  conflictsDetected: Array<{ field: string; sources: string[]; values: unknown[] }>;
  status: string;
  completedAt?: string;
}

export interface ValidationResult {
  canAdd: boolean;
  errors: number;
  warnings: number;
  validationMessages: Array<{
    rule: string;
    field: string;
    severity: string;
    message: string;
  }>;
  completeness: number;
}

export interface RefreshSchedule {
  scheduleId: string;
  name: string;
  description?: string;
  scope: string;
  scopeFilter: Record<string, unknown>;
  scheduleType: string;
  cronExpression?: string;
  intervalHours?: number;
  researchDepth: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

// ============================================================================
// Model Metadata Service
// ============================================================================

export class ModelMetadataService {
  // ============================================================================
  // Metadata CRUD
  // ============================================================================

  async getMetadata(modelId: string): Promise<ModelMetadata | null> {
    const result = await executeStatement(
      `SELECT * FROM model_metadata WHERE model_id = $1`,
      [{ name: 'modelId', value: { stringValue: modelId } }]
    );

    if (result.rows.length === 0) return null;
    return this.mapMetadata(result.rows[0] as Record<string, unknown>);
  }

  async getAllMetadata(options: {
    provider?: string;
    family?: string;
    availableOnly?: boolean;
    minCompleteness?: number;
    limit?: number;
  } = {}): Promise<ModelMetadata[]> {
    let sql = `SELECT * FROM model_metadata WHERE 1=1`;
    const params: Array<{ name: string; value: { stringValue?: string; doubleValue?: number; longValue?: number } }> = [];

    if (options.provider) {
      sql += ` AND provider = $${params.length + 1}`;
      params.push({ name: 'provider', value: { stringValue: options.provider } });
    }

    if (options.family) {
      sql += ` AND model_family = $${params.length + 1}`;
      params.push({ name: 'family', value: { stringValue: options.family } });
    }

    if (options.availableOnly) {
      sql += ` AND is_available = true`;
    }

    if (options.minCompleteness !== undefined) {
      sql += ` AND metadata_completeness >= $${params.length + 1}`;
      params.push({ name: 'minCompleteness', value: { doubleValue: options.minCompleteness } });
    }

    sql += ` ORDER BY provider, model_name`;
    sql += ` LIMIT $${params.length + 1}`;
    params.push({ name: 'limit', value: { longValue: options.limit || 100 } });

    const result = await executeStatement(sql, params);
    return result.rows.map(row => this.mapMetadata(row as Record<string, unknown>));
  }

  async createMetadata(
    modelId: string,
    provider: string,
    modelName: string,
    data: Partial<ModelMetadata>
  ): Promise<ModelMetadata> {
    const result = await executeStatement(
      `INSERT INTO model_metadata (
        model_id, provider, model_name, model_family, context_window, max_output_tokens,
        capabilities, specialties, input_price_per_1m, output_price_per_1m,
        function_calling_support, json_mode_support, official_docs_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING metadata_id`,
      [
        { name: 'modelId', value: { stringValue: modelId } },
        { name: 'provider', value: { stringValue: provider } },
        { name: 'modelName', value: { stringValue: modelName } },
        { name: 'family', value: data.modelFamily ? { stringValue: data.modelFamily } : { isNull: true } },
        { name: 'contextWindow', value: data.contextWindow ? { longValue: data.contextWindow } : { isNull: true } },
        { name: 'maxOutput', value: data.maxOutputTokens ? { longValue: data.maxOutputTokens } : { isNull: true } },
        { name: 'capabilities', value: { stringValue: JSON.stringify(data.capabilities || {}) } },
        { name: 'specialties', value: { stringValue: `{${(data.specialties || []).join(',')}}` } },
        { name: 'inputPrice', value: data.inputPricePer1M ? { doubleValue: data.inputPricePer1M } : { isNull: true } },
        { name: 'outputPrice', value: data.outputPricePer1M ? { doubleValue: data.outputPricePer1M } : { isNull: true } },
        { name: 'functionCalling', value: { booleanValue: data.functionCallingSupport || false } },
        { name: 'jsonMode', value: { booleanValue: data.jsonModeSupport || false } },
        { name: 'docsUrl', value: { isNull: true } },
      ]
    );

    return (await this.getMetadata(modelId))!;
  }

  async updateMetadata(
    modelId: string,
    updates: Partial<ModelMetadata>,
    source = 'admin'
  ): Promise<ModelMetadata> {
    // Record what changed for history
    const existing = await this.getMetadata(modelId);
    
    const updateFields: string[] = [];
    const params: Array<{ name: string; value: Record<string, unknown> }> = [
      { name: 'modelId', value: { stringValue: modelId } },
    ];

    const fieldMappings: Record<string, string> = {
      modelName: 'model_name',
      modelFamily: 'model_family',
      contextWindow: 'context_window',
      maxOutputTokens: 'max_output_tokens',
      capabilities: 'capabilities',
      specialties: 'specialties',
      inputPricePer1M: 'input_price_per_1m',
      outputPricePer1M: 'output_price_per_1m',
      functionCallingSupport: 'function_calling_support',
      jsonModeSupport: 'json_mode_support',
      reliabilityScore: 'reliability_score',
      qualityScore: 'quality_score',
      isAvailable: 'is_available',
      adminNotes: 'admin_notes',
    };

    for (const [key, dbField] of Object.entries(fieldMappings)) {
      if (key in updates) {
        const value = (updates as Record<string, unknown>)[key];
        updateFields.push(`${dbField} = $${params.length + 1}`);
        
        if (typeof value === 'string') {
          params.push({ name: key, value: { stringValue: value } });
        } else if (typeof value === 'number') {
          if (Number.isInteger(value)) {
            params.push({ name: key, value: { longValue: value } });
          } else {
            params.push({ name: key, value: { doubleValue: value } });
          }
        } else if (typeof value === 'boolean') {
          params.push({ name: key, value: { booleanValue: value } });
        } else if (Array.isArray(value)) {
          params.push({ name: key, value: { stringValue: `{${value.join(',')}}` } });
        } else if (typeof value === 'object') {
          params.push({ name: key, value: { stringValue: JSON.stringify(value) } });
        }
      }
    }

    if (updateFields.length > 0) {
      updateFields.push(`verification_source = $${params.length + 1}`);
      params.push({ name: 'source', value: { stringValue: source } });
      
      updateFields.push(`last_verified = NOW()`);

      await executeStatement(
        `UPDATE model_metadata SET ${updateFields.join(', ')} WHERE model_id = $1`,
        params
      );
    }

    return (await this.getMetadata(modelId))!;
  }

  async adminOverride(modelId: string, field: string, value: unknown, notes?: string): Promise<void> {
    await executeStatement(
      `UPDATE model_metadata SET
        admin_override = admin_override || $2,
        admin_notes = COALESCE($3, admin_notes),
        updated_at = NOW()
      WHERE model_id = $1`,
      [
        { name: 'modelId', value: { stringValue: modelId } },
        { name: 'override', value: { stringValue: JSON.stringify({ [field]: value }) } },
        { name: 'notes', value: notes ? { stringValue: notes } : { isNull: true } },
      ]
    );
  }

  // ============================================================================
  // Validation
  // ============================================================================

  async validateMetadata(modelId: string): Promise<ValidationResult> {
    const result = await executeStatement(
      `SELECT can_add_model($1) as validation`,
      [{ name: 'modelId', value: { stringValue: modelId } }]
    );

    const validation = (result.rows[0] as { validation: string | Record<string, unknown> }).validation;
    const parsed = typeof validation === 'string' ? JSON.parse(validation) : validation;

    return {
      canAdd: parsed.can_add,
      errors: parsed.errors,
      warnings: parsed.warnings,
      validationMessages: parsed.validation_messages || [],
      completeness: parsed.completeness || 0,
    };
  }

  async canAddModel(modelId: string): Promise<boolean> {
    const validation = await this.validateMetadata(modelId);
    return validation.canAdd;
  }

  // ============================================================================
  // Internet Research (AI-Powered)
  // ============================================================================

  async researchModel(
    modelId: string,
    researchDepth: 'quick' | 'standard' | 'deep' = 'standard'
  ): Promise<MetadataResearchResult> {
    const startTime = Date.now();
    
    // Create research record
    const researchResult = await executeStatement(
      `INSERT INTO metadata_research_history (model_id, research_type, status)
       VALUES ($1, 'manual', 'in_progress')
       RETURNING research_id`,
      [{ name: 'modelId', value: { stringValue: modelId } }]
    );
    const researchId = (researchResult.rows[0] as { research_id: string }).research_id;

    try {
      // Get existing metadata
      const existing = await this.getMetadata(modelId);
      
      // Generate research prompt based on depth
      const researchPrompt = this.buildResearchPrompt(modelId, existing, researchDepth);
      
      // Use AI to research and synthesize information
      const response = await modelRouterService.invoke({
        modelId: 'anthropic/claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: researchPrompt }],
        maxTokens: 4096,
      });

      // Parse AI response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse AI research response');
      }

      const aiFindings = JSON.parse(jsonMatch[0]);
      
      // Merge findings with existing data
      const fieldsUpdated: string[] = [];
      const conflicts: Array<{ field: string; sources: string[]; values: unknown[] }> = [];

      if (aiFindings.metadata) {
        // Apply updates
        for (const [field, value] of Object.entries(aiFindings.metadata)) {
          if (value !== null && value !== undefined) {
            fieldsUpdated.push(field);
          }
        }

        // Update metadata if we have findings
        if (fieldsUpdated.length > 0) {
          await this.updateMetadata(modelId, aiFindings.metadata as Partial<ModelMetadata>, 'ai_research');
        }
      }

      // Check for conflicts
      if (aiFindings.conflicts) {
        conflicts.push(...aiFindings.conflicts);
      }

      // Update research record
      await executeStatement(
        `UPDATE metadata_research_history SET
          status = 'completed',
          fields_updated = $2,
          ai_synthesis = $3,
          ai_confidence = $4,
          ai_reasoning = $5,
          conflicts_detected = $6,
          requires_review = $7,
          completed_at = NOW(),
          duration_ms = $8
        WHERE research_id = $1`,
        [
          { name: 'researchId', value: { stringValue: researchId } },
          { name: 'fieldsUpdated', value: { stringValue: `{${fieldsUpdated.join(',')}}` } },
          { name: 'aiSynthesis', value: { stringValue: JSON.stringify(aiFindings) } },
          { name: 'aiConfidence', value: { doubleValue: aiFindings.confidence || 0.7 } },
          { name: 'aiReasoning', value: aiFindings.reasoning ? { stringValue: aiFindings.reasoning } : { isNull: true } },
          { name: 'conflicts', value: { stringValue: JSON.stringify(conflicts) } },
          { name: 'requiresReview', value: { booleanValue: conflicts.length > 0 || (aiFindings.confidence || 0.7) < 0.6 } },
          { name: 'duration', value: { longValue: Date.now() - startTime } },
        ]
      );

      return {
        researchId,
        modelId,
        researchType: 'manual',
        fieldsUpdated,
        aiConfidence: aiFindings.confidence || 0.7,
        aiReasoning: aiFindings.reasoning,
        conflictsDetected: conflicts,
        status: 'completed',
        completedAt: new Date().toISOString(),
      };
    } catch (error) {
      // Update research record with error
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await executeStatement(
        `UPDATE metadata_research_history SET
          status = 'failed',
          error_message = $2,
          completed_at = NOW(),
          duration_ms = $3
        WHERE research_id = $1`,
        [
          { name: 'researchId', value: { stringValue: researchId } },
          { name: 'error', value: { stringValue: errorMsg } },
          { name: 'duration', value: { longValue: Date.now() - startTime } },
        ]
      );

      throw error;
    }
  }

  private buildResearchPrompt(
    modelId: string,
    existing: ModelMetadata | null,
    depth: 'quick' | 'standard' | 'deep'
  ): string {
    const depthInstructions = {
      quick: 'Focus on pricing and availability updates only.',
      standard: 'Research capabilities, pricing, benchmarks, and recent updates.',
      deep: 'Comprehensive research including all technical specs, benchmarks, use cases, limitations, and recent news.',
    };

    return `You are researching AI model metadata for: ${modelId}

${depthInstructions[depth]}

Current metadata:
${existing ? JSON.stringify(existing, null, 2) : 'No existing metadata'}

Research and provide updated metadata. Use your knowledge to:
1. Verify/update technical specifications
2. Update pricing if changed
3. Add any missing capabilities or limitations
4. Note any recent updates or deprecations
5. Identify best use cases and limitations

Return JSON:
{
  "metadata": {
    "modelName": "...",
    "modelFamily": "...",
    "contextWindow": number,
    "maxOutputTokens": number,
    "capabilities": {"reasoning": 0-1, "coding": 0-1, ...},
    "specialties": ["...", "..."],
    "weaknesses": ["...", "..."],
    "inputPricePer1M": number,
    "outputPricePer1M": number,
    "benchmarks": {"mmlu": 0-1, "humaneval": 0-1, ...},
    "bestUseCases": ["...", "..."],
    "notRecommendedFor": ["...", "..."],
    "functionCallingSupport": boolean,
    "jsonModeSupport": boolean,
    "streamingSupport": boolean,
    "reliabilityScore": 0-1,
    "qualityScore": 0-1
  },
  "confidence": 0-1,
  "reasoning": "Brief explanation of findings",
  "sources_referenced": ["source1", "source2"],
  "conflicts": [
    {"field": "...", "sources": ["...", "..."], "values": [...]}
  ],
  "recent_changes": ["Notable recent updates..."],
  "deprecation_warning": null or "Warning message if deprecated"
}`;
  }

  async researchNewModel(
    provider: string,
    modelName: string
  ): Promise<{ modelId: string; metadata: ModelMetadata; validation: ValidationResult }> {
    const modelId = `${provider}/${modelName.toLowerCase().replace(/\s+/g, '-')}`;

    // First, use AI to gather initial metadata
    const prompt = `Research the AI model "${modelName}" from ${provider}.

Provide comprehensive metadata including:
- Technical specifications (context window, output limits, architecture)
- Capabilities (what it's good at)
- Pricing (input/output per 1M tokens)
- Benchmark scores if available
- Best use cases and limitations

Return JSON:
{
  "modelId": "${modelId}",
  "provider": "${provider}",
  "modelName": "${modelName}",
  "modelFamily": "...",
  "contextWindow": number,
  "maxOutputTokens": number,
  "capabilities": {"reasoning": 0-1, "coding": 0-1, ...},
  "specialties": ["...", "..."],
  "inputPricePer1M": number,
  "outputPricePer1M": number,
  "benchmarks": {...},
  "bestUseCases": ["...", "..."],
  "functionCallingSupport": boolean,
  "jsonModeSupport": boolean,
  "officialDocsUrl": "https://...",
  "confidence": 0-1
}`;

    const response = await modelRouterService.invoke({
      modelId: 'anthropic/claude-3-5-sonnet-20241022',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2048,
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to research model');
    }

    const research = JSON.parse(jsonMatch[0]);

    // Create metadata
    const metadata = await this.createMetadata(modelId, provider, modelName, research);

    // Validate
    const validation = await this.validateMetadata(modelId);

    return { modelId, metadata, validation };
  }

  // ============================================================================
  // Scheduled Refresh
  // ============================================================================

  async getRefreshSchedules(): Promise<RefreshSchedule[]> {
    const result = await executeStatement(
      `SELECT * FROM metadata_refresh_schedule ORDER BY name`,
      []
    );

    return result.rows.map(row => this.mapRefreshSchedule(row as Record<string, unknown>));
  }

  async createRefreshSchedule(schedule: Omit<RefreshSchedule, 'scheduleId'>): Promise<RefreshSchedule> {
    const result = await executeStatement(
      `INSERT INTO metadata_refresh_schedule (
        tenant_id, name, description, scope, scope_filter, schedule_type,
        cron_expression, interval_hours, research_depth, enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING schedule_id`,
      [
        { name: 'tenantId', value: { isNull: true } },
        { name: 'name', value: { stringValue: schedule.name } },
        { name: 'description', value: schedule.description ? { stringValue: schedule.description } : { isNull: true } },
        { name: 'scope', value: { stringValue: schedule.scope } },
        { name: 'scopeFilter', value: { stringValue: JSON.stringify(schedule.scopeFilter || {}) } },
        { name: 'scheduleType', value: { stringValue: schedule.scheduleType } },
        { name: 'cronExpression', value: schedule.cronExpression ? { stringValue: schedule.cronExpression } : { isNull: true } },
        { name: 'intervalHours', value: schedule.intervalHours ? { longValue: schedule.intervalHours } : { isNull: true } },
        { name: 'researchDepth', value: { stringValue: schedule.researchDepth } },
        { name: 'enabled', value: { booleanValue: schedule.enabled } },
      ]
    );

    const scheduleId = (result.rows[0] as { schedule_id: string }).schedule_id;
    return (await this.getRefreshSchedule(scheduleId))!;
  }

  async getRefreshSchedule(scheduleId: string): Promise<RefreshSchedule | null> {
    const result = await executeStatement(
      `SELECT * FROM metadata_refresh_schedule WHERE schedule_id = $1`,
      [{ name: 'scheduleId', value: { stringValue: scheduleId } }]
    );

    if (result.rows.length === 0) return null;
    return this.mapRefreshSchedule(result.rows[0] as Record<string, unknown>);
  }

  async updateRefreshSchedule(scheduleId: string, updates: Partial<RefreshSchedule>): Promise<void> {
    const updateFields: string[] = [];
    const params: Array<{ name: string; value: Record<string, unknown> }> = [
      { name: 'scheduleId', value: { stringValue: scheduleId } },
    ];

    if (updates.name !== undefined) {
      updateFields.push(`name = $${params.length + 1}`);
      params.push({ name: 'name', value: { stringValue: updates.name } });
    }
    if (updates.cronExpression !== undefined) {
      updateFields.push(`cron_expression = $${params.length + 1}`);
      params.push({ name: 'cron', value: { stringValue: updates.cronExpression } });
    }
    if (updates.intervalHours !== undefined) {
      updateFields.push(`interval_hours = $${params.length + 1}`);
      params.push({ name: 'interval', value: { longValue: updates.intervalHours } });
    }
    if (updates.researchDepth !== undefined) {
      updateFields.push(`research_depth = $${params.length + 1}`);
      params.push({ name: 'depth', value: { stringValue: updates.researchDepth } });
    }
    if (updates.enabled !== undefined) {
      updateFields.push(`enabled = $${params.length + 1}`);
      params.push({ name: 'enabled', value: { booleanValue: updates.enabled } });
    }

    if (updateFields.length > 0) {
      updateFields.push(`updated_at = NOW()`);
      await executeStatement(
        `UPDATE metadata_refresh_schedule SET ${updateFields.join(', ')} WHERE schedule_id = $1`,
        params
      );
    }
  }

  async runScheduledRefresh(scheduleId: string): Promise<{
    modelsRefreshed: number;
    errors: string[];
  }> {
    const schedule = await this.getRefreshSchedule(scheduleId);
    if (!schedule) throw new Error('Schedule not found');

    // Get models to refresh based on scope
    let modelsToRefresh: string[] = [];

    if (schedule.scope === 'all') {
      const result = await executeStatement(
        `SELECT model_id FROM model_metadata WHERE is_available = true`,
        []
      );
      modelsToRefresh = result.rows.map(r => (r as { model_id: string }).model_id);
    } else if (schedule.scope === 'provider') {
      const provider = (schedule.scopeFilter as { provider?: string }).provider;
      const result = await executeStatement(
        `SELECT model_id FROM model_metadata WHERE provider = $1 AND is_available = true`,
        [{ name: 'provider', value: { stringValue: provider || '' } }]
      );
      modelsToRefresh = result.rows.map(r => (r as { model_id: string }).model_id);
    }

    const errors: string[] = [];
    let modelsRefreshed = 0;

    for (const modelId of modelsToRefresh) {
      try {
        await this.researchModel(modelId, schedule.researchDepth as 'quick' | 'standard' | 'deep');
        modelsRefreshed++;
      } catch (error) {
        errors.push(`${modelId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Update schedule last run
    await executeStatement(
      `UPDATE metadata_refresh_schedule SET
        last_run = NOW(),
        last_run_status = $2
      WHERE schedule_id = $1`,
      [
        { name: 'scheduleId', value: { stringValue: scheduleId } },
        { name: 'status', value: { stringValue: errors.length === 0 ? 'success' : 'partial' } },
      ]
    );

    return { modelsRefreshed, errors };
  }

  // ============================================================================
  // Research History
  // ============================================================================

  async getResearchHistory(modelId?: string, limit = 50): Promise<MetadataResearchResult[]> {
    const result = await executeStatement(
      `SELECT * FROM metadata_research_history
       ${modelId ? 'WHERE model_id = $1' : ''}
       ORDER BY started_at DESC
       LIMIT $${modelId ? '2' : '1'}`,
      modelId
        ? [
            { name: 'modelId', value: { stringValue: modelId } },
            { name: 'limit', value: { longValue: limit } },
          ]
        : [{ name: 'limit', value: { longValue: limit } }]
    );

    return result.rows.map(row => this.mapResearchResult(row as Record<string, unknown>));
  }

  async approveResearch(researchId: string, approvedBy: string, notes?: string): Promise<void> {
    await executeStatement(
      `UPDATE metadata_research_history SET
        reviewed_by = $2,
        review_decision = 'approved',
        review_notes = $3,
        requires_review = false
      WHERE research_id = $1`,
      [
        { name: 'researchId', value: { stringValue: researchId } },
        { name: 'approvedBy', value: { stringValue: approvedBy } },
        { name: 'notes', value: notes ? { stringValue: notes } : { isNull: true } },
      ]
    );
  }

  // ============================================================================
  // Sources Management
  // ============================================================================

  async getSources(): Promise<MetadataSource[]> {
    const result = await executeStatement(
      `SELECT * FROM metadata_sources ORDER BY trust_score DESC, name`,
      []
    );

    return result.rows.map(row => this.mapSource(row as Record<string, unknown>));
  }

  async updateSource(sourceId: string, updates: Partial<MetadataSource>): Promise<void> {
    const updateFields: string[] = [];
    const params: Array<{ name: string; value: Record<string, unknown> }> = [
      { name: 'sourceId', value: { stringValue: sourceId } },
    ];

    if (updates.enabled !== undefined) {
      updateFields.push(`enabled = $${params.length + 1}`);
      params.push({ name: 'enabled', value: { booleanValue: updates.enabled } });
    }
    if (updates.trustScore !== undefined) {
      updateFields.push(`trust_score = $${params.length + 1}`);
      params.push({ name: 'trustScore', value: { doubleValue: updates.trustScore } });
    }
    if (updates.refreshIntervalHours !== undefined) {
      updateFields.push(`refresh_interval_hours = $${params.length + 1}`);
      params.push({ name: 'interval', value: { longValue: updates.refreshIntervalHours } });
    }

    if (updateFields.length > 0) {
      await executeStatement(
        `UPDATE metadata_sources SET ${updateFields.join(', ')} WHERE source_id = $1`,
        params
      );
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private mapMetadata(row: Record<string, unknown>): ModelMetadata {
    return {
      metadataId: String(row.metadata_id),
      modelId: String(row.model_id),
      provider: String(row.provider),
      modelName: String(row.model_name),
      modelFamily: row.model_family ? String(row.model_family) : undefined,
      version: row.version ? String(row.version) : undefined,
      releaseDate: row.release_date ? String(row.release_date) : undefined,
      capabilities: typeof row.capabilities === 'string' ? JSON.parse(row.capabilities) : (row.capabilities as Record<string, number>) || {},
      supportedModalities: typeof row.supported_modalities === 'string' ? JSON.parse(row.supported_modalities) : (row.supported_modalities as { input: string[]; output: string[] }) || { input: [], output: [] },
      specialties: (row.specialties as string[]) || [],
      weaknesses: (row.weaknesses as string[]) || [],
      contextWindow: row.context_window ? Number(row.context_window) : undefined,
      maxOutputTokens: row.max_output_tokens ? Number(row.max_output_tokens) : undefined,
      trainingCutoff: row.training_cutoff ? String(row.training_cutoff) : undefined,
      parameterCount: row.parameter_count ? Number(row.parameter_count) : undefined,
      architecture: row.architecture ? String(row.architecture) : undefined,
      benchmarks: typeof row.benchmarks === 'string' ? JSON.parse(row.benchmarks) : (row.benchmarks as Record<string, number>) || {},
      benchmarkDate: row.benchmark_date ? String(row.benchmark_date) : undefined,
      inputPricePer1M: row.input_price_per_1m ? Number(row.input_price_per_1m) : undefined,
      outputPricePer1M: row.output_price_per_1m ? Number(row.output_price_per_1m) : undefined,
      priceCurrency: String(row.price_currency || 'USD'),
      priceUpdatedAt: row.price_updated_at ? String(row.price_updated_at) : undefined,
      regionsAvailable: (row.regions_available as string[]) || [],
      apiEndpoints: typeof row.api_endpoints === 'string' ? JSON.parse(row.api_endpoints) : (row.api_endpoints as Record<string, string>) || {},
      rateLimits: typeof row.rate_limits === 'string' ? JSON.parse(row.rate_limits) : (row.rate_limits as { rpm?: number; tpm?: number; rpd?: number }) || {},
      bestUseCases: typeof row.best_use_cases === 'string' ? JSON.parse(row.best_use_cases) : (row.best_use_cases as string[]) || [],
      notRecommendedFor: typeof row.not_recommended_for === 'string' ? JSON.parse(row.not_recommended_for) : (row.not_recommended_for as string[]) || [],
      promptTips: typeof row.prompt_tips === 'string' ? JSON.parse(row.prompt_tips) : (row.prompt_tips as string[]) || [],
      functionCallingSupport: Boolean(row.function_calling_support),
      jsonModeSupport: Boolean(row.json_mode_support),
      streamingSupport: Boolean(row.streaming_support ?? true),
      reliabilityScore: row.reliability_score ? Number(row.reliability_score) : undefined,
      qualityScore: row.quality_score ? Number(row.quality_score) : undefined,
      speedScore: row.speed_score ? Number(row.speed_score) : undefined,
      valueScore: row.value_score ? Number(row.value_score) : undefined,
      metadataCompleteness: Number(row.metadata_completeness ?? 0),
      metadataConfidence: Number(row.metadata_confidence ?? 0.5),
      lastVerified: row.last_verified ? String(row.last_verified) : undefined,
      isAvailable: Boolean(row.is_available ?? true),
      isDeprecated: Boolean(row.is_deprecated),
      requiresApproval: Boolean(row.requires_approval),
      adminNotes: row.admin_notes ? String(row.admin_notes) : undefined,
      adminOverride: typeof row.admin_override === 'string' ? JSON.parse(row.admin_override) : (row.admin_override as Record<string, unknown>) || {},
      updatedAt: String(row.updated_at),
    };
  }

  private mapSource(row: Record<string, unknown>): MetadataSource {
    return {
      sourceId: String(row.source_id),
      name: String(row.name),
      sourceType: String(row.source_type),
      url: row.url ? String(row.url) : undefined,
      trustScore: Number(row.trust_score ?? 0.5),
      isOfficial: Boolean(row.is_official),
      refreshIntervalHours: Number(row.refresh_interval_hours ?? 24),
      lastFetched: row.last_fetched ? String(row.last_fetched) : undefined,
      enabled: Boolean(row.enabled ?? true),
    };
  }

  private mapRefreshSchedule(row: Record<string, unknown>): RefreshSchedule {
    return {
      scheduleId: String(row.schedule_id),
      name: String(row.name),
      description: row.description ? String(row.description) : undefined,
      scope: String(row.scope),
      scopeFilter: typeof row.scope_filter === 'string' ? JSON.parse(row.scope_filter) : (row.scope_filter as Record<string, unknown>) || {},
      scheduleType: String(row.schedule_type),
      cronExpression: row.cron_expression ? String(row.cron_expression) : undefined,
      intervalHours: row.interval_hours ? Number(row.interval_hours) : undefined,
      researchDepth: String(row.research_depth || 'standard'),
      enabled: Boolean(row.enabled ?? true),
      lastRun: row.last_run ? String(row.last_run) : undefined,
      nextRun: row.next_run ? String(row.next_run) : undefined,
    };
  }

  private mapResearchResult(row: Record<string, unknown>): MetadataResearchResult {
    return {
      researchId: String(row.research_id),
      modelId: String(row.model_id),
      researchType: String(row.research_type),
      fieldsUpdated: (row.fields_updated as string[]) || [],
      aiConfidence: Number(row.ai_confidence ?? 0.5),
      aiReasoning: row.ai_reasoning ? String(row.ai_reasoning) : undefined,
      conflictsDetected: typeof row.conflicts_detected === 'string' ? JSON.parse(row.conflicts_detected) : (row.conflicts_detected as Array<{ field: string; sources: string[]; values: unknown[] }>) || [],
      status: String(row.status),
      completedAt: row.completed_at ? String(row.completed_at) : undefined,
    };
  }
}

export const modelMetadataService = new ModelMetadataService();
