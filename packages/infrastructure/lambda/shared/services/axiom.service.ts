/**
 * AXIOM Service - Adaptive eXpert Intelligence Optimization Module
 * 
 * Transforms vague user queries into optimized prompts that consistently
 * outperform human-written instructions.
 * 
 * Key Features:
 * - [AXIOM:DOMAIN] Domain signature management
 * - [AXIOM:PATTERN] Pattern storage and retrieval
 * - [AXIOM:COMPILE] Prompt compilation pipeline
 * - [AXIOM:ROUTE] Model routing and selection
 * - [AXIOM:VARIANT] Model-specific prompt variants
 * 
 * @version 2.0.0
 * @since RADIANT v6.0.0
 */

import { executeStatement, stringParam, doubleParam, longParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { clarionService } from './clarion.service';
import { domainTaxonomyService } from './domain-taxonomy.service';
import { axiomNeuralCortexService } from './axiom-neural-cortex.service';
import { v4 as uuidv4 } from 'uuid';
import type {
  AxiomDomainSignature,
  AxiomPromptPattern,
  AxiomCompiledPrompt,
  AxiomModelSelection,
  AxiomFilledTemplate,
  AxiomCompilationStatus,
  AxiomModelVariantRules,
  ClarionSession,
  ClarionAnswer,
  ClarionCompilerClarificationRequest,
  AxiomStartSessionRequest,
  AxiomSessionResponse,
  AxiomCompileRequest,
  AxiomCompileResponse,
  AxiomForgeState,
  AxiomWorkflowProgress,
  AxiomModelScoreBar,
} from '@radiant/shared';

// =============================================================================
// [AXIOM:CORE] Constants
// =============================================================================

const DEFAULTS = {
  maxPatternsRetrieved: 5,
  minPatternScore: 0.3,
  compilationTimeoutMs: 5000,
  variantGenerationCount: 3,
};

// =============================================================================
// [AXIOM:CORE] Service Class
// =============================================================================

class AxiomService {

  // ===========================================================================
  // [AXIOM:CORE] Session Management (orchestrates CLARION + compilation)
  // ===========================================================================

  /**
   * Start a full AXIOM session (includes CLARION questioning)
   */
  async startSession(request: AxiomStartSessionRequest): Promise<AxiomSessionResponse> {
    // Start CLARION session for questioning
    const clarionSession = await clarionService.startSession({
      tenantId: request.tenantId,
      userId: request.userId,
      query: request.query,
      locale: request.locale,
      chainId: request.chainId,
      conversationId: request.conversationId,
    });

    // Get first question
    const firstQuestion = await clarionService.selectNextQuestion(clarionSession);

    return {
      sessionId: clarionSession.sessionId,
      status: clarionSession.status,
      domain: clarionSession.domain,
      domainConfidence: clarionSession.currentConfidence,
      currentQuestion: firstQuestion || undefined,
      questionNumber: 1,
      totalQuestionsMax: 5,
      modelPredictions: clarionSession.modelPredictions,
      readyToCompile: firstQuestion === null,
    };
  }

  /**
   * Get full forge state for UI
   */
  async getForgeState(sessionId: string): Promise<AxiomForgeState | null> {
    const session = await clarionService.getSession(sessionId);
    if (!session) return null;

    const currentQuestion = await clarionService.selectNextQuestion(session);
    const workflow = this.buildWorkflowProgress(session, currentQuestion !== null);

    // Build question history
    const history: Array<{ question: any; answer: ClarionAnswer }> = [];
    for (const qId of session.askedQuestions) {
      if (session.answers[qId]) {
        const question = await clarionService.getQuestion(qId);
        if (question) {
          history.push({ question, answer: session.answers[qId] });
        }
      }
    }

    // Build model score bars
    const modelScores: AxiomModelScoreBar[] = session.modelPredictions.map((p, i) => ({
      modelId: p.modelId,
      modelName: p.modelName,
      provider: p.provider,
      score: Math.round(p.score * 100),
      isLeading: i === 0,
      reasons: p.reasons,
    }));

    // Sort by score
    modelScores.sort((a, b) => b.score - a.score);
    if (modelScores.length > 0) {
      modelScores[0].isLeading = true;
      for (let i = 1; i < modelScores.length; i++) {
        modelScores[i].isLeading = false;
      }
    }

    return {
      sessionId: session.sessionId,
      status: session.status,
      workflow,
      domain: {
        path: session.domain.split('.'),
        name: session.domain,
        confidence: session.currentConfidence,
      },
      questions: {
        current: currentQuestion || undefined,
        answered: Object.keys(session.answers).length,
        total: 5,
        history,
      },
      modelScores,
      isStreaming: false,
    };
  }

  /**
   * Build workflow progress for UI
   */
  private buildWorkflowProgress(session: ClarionSession, clarifying: boolean): AxiomWorkflowProgress {
    const steps: AxiomWorkflowProgress['steps'] = [
      { step: 'classify', label: 'Classify Domain', status: 'completed' },
      { step: 'clarify', label: 'Gather Context', status: clarifying ? 'active' : 'completed' },
      { step: 'compile', label: 'Compile Prompt', status: session.status === 'ready_to_compile' ? 'active' : 'pending' },
      { step: 'route', label: 'Select Model', status: 'pending' },
    ];

    let currentStep: AxiomWorkflowProgress['currentStep'] = 'classify';
    let progress = 25;

    if (session.status === 'active') {
      currentStep = 'clarify';
      progress = 25 + (Object.keys(session.answers).length / 5) * 25;
    } else if (session.status === 'ready_to_compile') {
      currentStep = 'compile';
      progress = 50;
    } else if (session.status === 'completed') {
      currentStep = 'route';
      progress = 100;
      steps.forEach(s => s.status = 'completed');
    }

    return { currentStep, steps, overallProgress: Math.round(progress) };
  }

  // ===========================================================================
  // [AXIOM:DOMAIN] Domain Signature Management
  // ===========================================================================

  /**
   * Get domain signature for a domain
   */
  async getDomainSignature(domainId: string, tenantId?: string): Promise<AxiomDomainSignature | null> {
    const result = await executeStatement(
      `SELECT * FROM axiom_domain_signatures
       WHERE domain_id = $1 AND (tenant_id IS NULL OR tenant_id = $2)
       AND is_active = true
       ORDER BY tenant_id NULLS LAST
       LIMIT 1`,
      [
        stringParam('domainId', domainId),
        stringParam('tenantId', tenantId || ''),
      ]
    );

    if (result.rows.length === 0) {
      // Return default signature for unknown domains
      return this.getDefaultSignature(domainId);
    }

    return this.parseSignatureRow(result.rows[0] as Record<string, unknown>);
  }

  /**
   * Get default signature for domains without custom templates
   */
  private getDefaultSignature(domainId: string): AxiomDomainSignature {
    return {
      domainId,
      domainPath: domainId.split('.'),
      template: {
        systemPrompt: `You are an expert assistant specializing in ${domainId.replace(/\./g, ' ')}. 
Provide accurate, helpful, and well-structured responses.
Approach tasks thoughtfully and explain your reasoning when appropriate.`,
        userPromptPrefix: '',
        userPromptSuffix: '',
        slots: {},
      },
      modelPreferences: {
        primary: [],
        fallback: [],
        avoid: [],
        proficiencyRequirements: {},
      },
      version: '1.0.0',
      effectivenessScore: 0.5,
      usageCount: 0,
      lastUpdated: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Create or update domain signature
   */
  async saveDomainSignature(signature: AxiomDomainSignature, tenantId?: string): Promise<void> {
    await executeStatement(
      `INSERT INTO axiom_domain_signatures (
        domain_id, tenant_id, domain_path, template, model_preferences,
        version, effectiveness_score, usage_count, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      ON CONFLICT (domain_id) DO UPDATE SET
        template = EXCLUDED.template,
        model_preferences = EXCLUDED.model_preferences,
        version = EXCLUDED.version,
        updated_at = NOW()`,
      [
        stringParam('domainId', signature.domainId),
        stringParam('tenantId', tenantId || ''),
        stringParam('domainPath', JSON.stringify(signature.domainPath)),
        stringParam('template', JSON.stringify(signature.template)),
        stringParam('modelPreferences', JSON.stringify(signature.modelPreferences)),
        stringParam('version', signature.version),
        doubleParam('effectivenessScore', signature.effectivenessScore),
        longParam('usageCount', signature.usageCount),
      ]
    );
  }

  // ===========================================================================
  // [AXIOM:PATTERN] Pattern Retrieval
  // ===========================================================================

  /**
   * Retrieve relevant patterns for compilation
   */
  async retrievePatterns(
    domainId: string,
    contextEmbedding?: number[],
    tenantId?: string,
    limit: number = DEFAULTS.maxPatternsRetrieved
  ): Promise<AxiomPromptPattern[]> {
    // If we have an embedding, use vector similarity
    if (contextEmbedding && contextEmbedding.length > 0) {
      const result = await executeStatement(
        `SELECT *, 1 - (embedding <=> $1::vector) as similarity
         FROM axiom_prompt_patterns
         WHERE domain_id = $2 AND is_active = true
         AND (tenant_id IS NULL OR tenant_id = $3)
         ORDER BY similarity DESC
         LIMIT $4`,
        [
          stringParam('embedding', `[${contextEmbedding.join(',')}]`),
          stringParam('domainId', domainId),
          stringParam('tenantId', tenantId || ''),
          longParam('limit', limit),
        ]
      );

      return result.rows.map(row => this.parsePatternRow(row as Record<string, unknown>));
    }

    // Fallback: retrieve by success rate and usage
    const result = await executeStatement(
      `SELECT * FROM axiom_prompt_patterns
       WHERE domain_id = $1 AND is_active = true
       AND (tenant_id IS NULL OR tenant_id = $2)
       ORDER BY success_rate DESC, usage_count DESC
       LIMIT $3`,
      [
        stringParam('domainId', domainId),
        stringParam('tenantId', tenantId || ''),
        longParam('limit', limit),
      ]
    );

    return result.rows.map(row => this.parsePatternRow(row as Record<string, unknown>));
  }

  /**
   * Save a new pattern
   */
  async savePattern(pattern: Omit<AxiomPromptPattern, 'patternId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const patternId = `pattern-${uuidv4()}`;

    await executeStatement(
      `INSERT INTO axiom_prompt_patterns (
        pattern_id, tenant_id, domain_id, pattern_type, content,
        usage_count, success_rate, origin, parent_patterns,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
      [
        stringParam('patternId', patternId),
        stringParam('tenantId', pattern.tenantId || ''),
        stringParam('domainId', pattern.domainId),
        stringParam('patternType', pattern.type),
        stringParam('content', pattern.content),
        longParam('usageCount', pattern.usageCount),
        doubleParam('successRate', pattern.successRate),
        stringParam('origin', pattern.origin),
        stringParam('parentPatterns', JSON.stringify(pattern.parentPatterns || [])),
      ]
    );

    return patternId;
  }

  // ===========================================================================
  // [AXIOM:COMPILE] Prompt Compilation
  // ===========================================================================

  /**
   * Compile prompt from CLARION session
   */
  async compilePrompt(request: AxiomCompileRequest): Promise<AxiomCompileResponse> {
    const session = await clarionService.getSession(request.sessionId);
    if (!session) {
      return {
        sessionId: request.sessionId,
        status: 'failed',
        compiledPrompt: {
          status: 'failed',
          errors: ['Session not found'],
        },
      };
    }

    // Get domain signature
    const signature = await this.getDomainSignature(session.domain, session.tenantId);
    if (!signature) {
      return {
        sessionId: request.sessionId,
        status: 'failed',
        compiledPrompt: {
          status: 'failed',
          errors: ['Domain signature not found'],
        },
      };
    }

    // Check for missing required slots
    const missingSlots = this.findMissingRequiredSlots(signature, session.answers);
    if (missingSlots.length > 0 && !request.forceCompile) {
      // Request clarification from CLARION
      const clarificationRequest: ClarionCompilerClarificationRequest = {
        sessionId: session.sessionId,
        ambiguityType: 'missing_slot',
        details: { slotName: missingSlots[0] },
        suggestedQuestions: missingSlots
          .map(slot => signature.template.slots[slot]?.mapsToQuestion)
          .filter((q): q is string => !!q),
        priority: 'required',
      };

      const clarificationQuestion = await clarionService.handleCompilerClarification(clarificationRequest);

      return {
        sessionId: request.sessionId,
        status: 'awaiting_clarification',
        clarificationNeeded: clarificationRequest,
        compiledPrompt: {
          status: 'awaiting_clarification',
          missingSlots,
        },
      };
    }

    // Fill template slots
    const filledTemplate = this.fillTemplateSlots(signature.template, session.answers);

    // Retrieve relevant patterns
    const patterns = await this.retrievePatterns(session.domain, undefined, session.tenantId);

    // Merge patterns into template
    const enhancedPrompt = this.mergePatterns(filledTemplate, patterns);

    // Select model
    const selectedModel = await this.selectModel(session, signature);

    // Generate model-specific variant
    const finalPrompt = await this.generateModelVariant(enhancedPrompt, selectedModel);

    // Record compilation
    const compilationId = await this.recordCompilation({
      sessionId: session.sessionId,
      tenantId: session.tenantId,
      userId: session.userId,
      domainId: session.domain,
      compiledPrompt: finalPrompt,
      modelSelected: selectedModel,
      patternsUsed: patterns.map(p => p.patternId),
    });

    logger.info('[AXIOM:COMPILE] Prompt compiled', {
      sessionId: session.sessionId,
      compilationId,
      domain: session.domain,
      model: selectedModel.modelId,
    });

    return {
      sessionId: request.sessionId,
      status: 'ready',
      compiledPrompt: {
        status: 'ready',
        prompt: finalPrompt,
        model: selectedModel,
        metadata: {
          domain: session.domain,
          patternsUsed: patterns.map(p => p.patternId),
          confidence: session.currentConfidence,
          compilationVersion: signature.version,
          compiledAt: new Date().toISOString(),
        },
      },
    };
  }

  /**
   * Find required slots that are missing answers
   */
  private findMissingRequiredSlots(
    signature: AxiomDomainSignature,
    answers: Record<string, ClarionAnswer>
  ): string[] {
    const missing: string[] = [];

    for (const [slotName, slotDef] of Object.entries(signature.template.slots)) {
      if (slotDef.required && slotDef.mapsToQuestion) {
        if (!answers[slotDef.mapsToQuestion]) {
          missing.push(slotName);
        }
      }
    }

    return missing;
  }

  /**
   * Fill template slots with CLARION answers
   */
  private fillTemplateSlots(
    template: AxiomDomainSignature['template'],
    answers: Record<string, ClarionAnswer>
  ): AxiomFilledTemplate {
    let systemPrompt = template.systemPrompt;
    let userPrompt = template.userPromptPrefix;

    for (const [slotName, slotDef] of Object.entries(template.slots)) {
      const questionId = slotDef.mapsToQuestion;
      const answer = questionId ? answers[questionId] : null;

      const value = answer?.value ?? slotDef.defaultValue ?? '[not specified]';
      const placeholder = `{{${slotName}}}`;

      systemPrompt = systemPrompt.replace(new RegExp(placeholder, 'g'), String(value));
      userPrompt = userPrompt.replace(new RegExp(placeholder, 'g'), String(value));
    }

    userPrompt += template.userPromptSuffix;

    return { systemPrompt, userPrompt };
  }

  /**
   * Merge patterns into filled template
   */
  private mergePatterns(
    template: AxiomFilledTemplate,
    patterns: AxiomPromptPattern[]
  ): AxiomFilledTemplate {
    let { systemPrompt, userPrompt } = template;

    for (const pattern of patterns) {
      switch (pattern.type) {
        case 'system_augment':
          systemPrompt += '\n\n' + pattern.content;
          break;
        case 'user_augment':
          userPrompt = pattern.content + '\n\n' + userPrompt;
          break;
        case 'example':
          userPrompt += '\n\nExample:\n' + pattern.content;
          break;
        case 'constraint':
          systemPrompt += '\n\nConstraints:\n' + pattern.content;
          break;
        case 'format':
          userPrompt += '\n\nOutput Format:\n' + pattern.content;
          break;
      }
    }

    return { systemPrompt, userPrompt };
  }

  // ===========================================================================
  // [AXIOM:ROUTE] Model Selection (uses Model Network from Neural Cortex)
  // ===========================================================================

  /**
   * Select optimal model based on session and signature
   * Uses Model Network from AXIOM Neural Cortex for scoring
   */
  private async selectModel(
    session: ClarionSession,
    signature: AxiomDomainSignature
  ): Promise<AxiomModelSelection> {
    // Build task features for Model Network
    const taskFeatures = this.buildTaskFeatures(session, signature);
    
    // Use Model Network from Neural Cortex
    const modelScores = await axiomNeuralCortexService.scoreModels(taskFeatures);
    
    logger.debug('[AXIOM:ROUTE] Model Network scores', {
      sessionId: session.sessionId,
      topModel: modelScores.scores.topModel,
      usedFallback: modelScores.usedFallback,
      latencyMs: modelScores.latencyMs,
    });

    // Also check Topology Network for orchestration mode
    const topologyScores = await axiomNeuralCortexService.scoreTopologies(taskFeatures);
    
    logger.debug('[AXIOM:ROUTE] Topology Network scores', {
      sessionId: session.sessionId,
      recommendedMode: topologyScores.scores.mode,
      confidence: topologyScores.scores.confidence,
    });

    // Merge neural scores with CLARION predictions
    const predictions = session.modelPredictions;
    const mergedScores = this.mergeModelScores(predictions, modelScores.scores.scores);
    
    // Sort by merged score
    const sorted = [...mergedScores].sort((a, b) => b.score - a.score);
    
    // Get the top prediction
    const topPrediction = sorted[0];
    
    if (!topPrediction) {
      // Fallback to default model
      return {
        modelId: 'claude-sonnet-4',
        modelName: 'Claude Sonnet 4',
        provider: 'anthropic',
        selectionReason: 'Default model - no predictions available',
        matchScore: 50,
        strengths: ['General purpose'],
        weaknesses: [],
        estimatedLatencyMs: 2000,
        estimatedCostPer1kTokens: 0.003,
      };
    }

    // Check against signature preferences
    const avoid = signature.modelPreferences.avoid || [];
    if (avoid.includes(topPrediction.modelId)) {
      // Use next best that isn't avoided
      const alternative = sorted.find(p => !avoid.includes(p.modelId));
      if (alternative) {
        return this.buildModelSelection(alternative, 'Preferred model was avoided per domain rules');
      }
    }

    return this.buildModelSelection(topPrediction, 'Highest scoring model from CLARION predictions');
  }

  /**
   * Build model selection from prediction
   */
  private buildModelSelection(
    prediction: ClarionSession['modelPredictions'][0],
    reason: string
  ): AxiomModelSelection {
    return {
      modelId: prediction.modelId,
      modelName: prediction.modelName,
      provider: prediction.provider,
      selectionReason: reason,
      matchScore: Math.round(prediction.score * 100),
      strengths: prediction.reasons,
      weaknesses: [],
      estimatedLatencyMs: 2000, // Would be from model registry
      estimatedCostPer1kTokens: 0.003, // Would be from model registry
    };
  }

  /**
   * Build task feature vector for Neural Cortex networks
   */
  private buildTaskFeatures(
    session: ClarionSession,
    signature: AxiomDomainSignature
  ): number[] {
    // Build a 1536-dim feature vector encoding task characteristics
    const features = new Array(1536).fill(0);
    
    // Encode domain path (first 256 dims)
    const domainParts = session.domain.split('.');
    for (let i = 0; i < Math.min(domainParts.length, 8); i++) {
      features[i * 32] = 1; // One-hot for depth
    }
    
    // Encode confidence trajectory (next 64 dims)
    const trajectory = session.workingContext.confidenceTrajectory || [];
    for (let i = 0; i < Math.min(trajectory.length, 64); i++) {
      features[256 + i] = trajectory[i];
    }
    
    // Encode complexity indicators (next 64 dims)
    features[320] = session.workingContext.predictedComplexity || 0.5;
    features[321] = session.currentConfidence;
    features[322] = Object.keys(session.answers).length / 5; // Normalized question count
    features[323] = session.skippedQuestions.length > 0 ? 0.3 : 0;
    
    // Encode model prediction diversity (next 64 dims)
    const predictions = session.modelPredictions || [];
    if (predictions.length > 0) {
      const scores = predictions.map(p => p.score);
      const maxScore = Math.max(...scores);
      const minScore = Math.min(...scores);
      features[384] = maxScore;
      features[385] = maxScore - minScore; // Score spread
      features[386] = predictions.length / 10; // Normalized candidate count
    }
    
    return features;
  }

  /**
   * Merge CLARION predictions with Neural Cortex model scores
   */
  private mergeModelScores(
    clarionPredictions: ClarionSession['modelPredictions'],
    neuralScores: Array<{ modelId: string; score: number }>
  ): ClarionSession['modelPredictions'] {
    const scoreMap = new Map(neuralScores.map(s => [s.modelId, s.score]));
    
    return clarionPredictions.map(prediction => {
      const neuralScore = scoreMap.get(prediction.modelId) || 0.5;
      
      // Weighted average: 60% CLARION, 40% Neural Cortex
      const mergedScore = (prediction.score * 0.6) + (neuralScore * 0.4);
      
      return {
        ...prediction,
        score: mergedScore,
      };
    });
  }

  // ===========================================================================
  // [AXIOM:VARIANT] Model-Specific Variants
  // ===========================================================================

  /**
   * Generate model-specific prompt variant
   */
  private async generateModelVariant(
    basePrompt: AxiomFilledTemplate,
    model: AxiomModelSelection
  ): Promise<AxiomFilledTemplate> {
    // Get model-specific rules
    const rules = await this.getModelVariantRules(model.modelId);
    
    let { systemPrompt, userPrompt } = basePrompt;

    if (rules) {
      // Apply model-specific transformations
      if (rules.prefersStructured && !this.hasStructure(systemPrompt)) {
        systemPrompt = this.addStructure(systemPrompt);
      }

      if (rules.requiresExplicitFormat && !userPrompt.toLowerCase().includes('format')) {
        userPrompt += '\n\nPlease structure your response clearly with appropriate headings and sections.';
      }

      // Truncate if needed
      const totalTokens = this.estimateTokens(systemPrompt + userPrompt);
      if (totalTokens > rules.maxContextTokens * 0.9) {
        userPrompt = this.truncateToFit(
          userPrompt,
          rules.maxContextTokens * 0.9 - this.estimateTokens(systemPrompt)
        );
      }
    }

    return { systemPrompt, userPrompt };
  }

  /**
   * Get model variant rules
   */
  private async getModelVariantRules(modelId: string): Promise<AxiomModelVariantRules | null> {
    const result = await executeStatement(
      `SELECT * FROM axiom_model_variant_rules WHERE model_id = $1`,
      [stringParam('modelId', modelId)]
    );

    if (result.rows.length === 0) {
      // Return default rules
      return {
        modelId,
        prefersStructured: true,
        requiresExplicitFormat: false,
        maxContextTokens: 128000,
        temperatureDefault: 0.7,
        topPDefault: 1.0,
        systemPromptStyle: 'structured',
      };
    }

    const row = result.rows[0] as Record<string, unknown>;
    return {
      modelId: String(row.model_id),
      prefersStructured: Boolean(row.prefers_structured),
      requiresExplicitFormat: Boolean(row.requires_explicit_format),
      maxContextTokens: Number(row.max_context_tokens) || 128000,
      temperatureDefault: Number(row.temperature_default) || 0.7,
      topPDefault: Number(row.top_p_default) || 1.0,
      systemPromptStyle: String(row.system_prompt_style) as 'verbose' | 'concise' | 'structured',
      preferredOutputFormat: row.preferred_output_format as 'json' | 'markdown' | 'plain' | undefined,
    };
  }

  /**
   * Check if prompt has structure (headers, lists, etc.)
   */
  private hasStructure(text: string): boolean {
    return /^#{1,3}\s|^\d+\.\s|^-\s|^•\s/m.test(text);
  }

  /**
   * Add structure to unstructured prompt
   */
  private addStructure(text: string): string {
    // Split into paragraphs and add headers
    const paragraphs = text.split(/\n\n+/);
    if (paragraphs.length <= 1) return text;

    return paragraphs.map((p, i) => {
      if (i === 0) return '## Role\n' + p;
      if (p.toLowerCase().includes('approach') || p.toLowerCase().includes('method')) {
        return '## Approach\n' + p;
      }
      return p;
    }).join('\n\n');
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Truncate text to fit token limit
   */
  private truncateToFit(text: string, maxTokens: number): string {
    const currentTokens = this.estimateTokens(text);
    if (currentTokens <= maxTokens) return text;

    const ratio = maxTokens / currentTokens;
    const targetLength = Math.floor(text.length * ratio * 0.95);
    return text.substring(0, targetLength) + '\n\n[Content truncated for length...]';
  }

  // ===========================================================================
  // [AXIOM:COMPILE] Compilation Recording
  // ===========================================================================

  /**
   * Record compilation for learning
   */
  private async recordCompilation(data: {
    sessionId: string;
    tenantId: string;
    userId: string;
    domainId: string;
    compiledPrompt: AxiomFilledTemplate;
    modelSelected: AxiomModelSelection;
    patternsUsed: string[];
  }): Promise<string> {
    const compilationId = `compile-${uuidv4()}`;

    await executeStatement(
      `INSERT INTO axiom_compilations (
        compilation_id, session_id, tenant_id, user_id, domain_id,
        status, compiled_prompt, model_selected, patterns_used,
        compilation_version, token_count, created_at, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
      [
        stringParam('compilationId', compilationId),
        stringParam('sessionId', data.sessionId),
        stringParam('tenantId', data.tenantId),
        stringParam('userId', data.userId),
        stringParam('domainId', data.domainId),
        stringParam('status', 'ready'),
        stringParam('compiledPrompt', JSON.stringify(data.compiledPrompt)),
        stringParam('modelSelected', JSON.stringify(data.modelSelected)),
        stringParam('patternsUsed', JSON.stringify(data.patternsUsed)),
        stringParam('version', '2.0.0'),
        longParam('tokenCount', this.estimateTokens(
          data.compiledPrompt.systemPrompt + data.compiledPrompt.userPrompt
        )),
      ]
    );

    return compilationId;
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Parse signature row from database
   */
  private parseSignatureRow(row: Record<string, unknown>): AxiomDomainSignature {
    return {
      domainId: String(row.domain_id),
      domainPath: this.parseJson(row.domain_path, []),
      template: this.parseJson(row.template, {
        systemPrompt: '',
        userPromptPrefix: '',
        userPromptSuffix: '',
        slots: {},
      }),
      modelPreferences: this.parseJson(row.model_preferences, {
        primary: [],
        fallback: [],
        avoid: [],
        proficiencyRequirements: {},
      }),
      version: String(row.version || '1.0.0'),
      effectivenessScore: Number(row.effectiveness_score) || 0.5,
      usageCount: Number(row.usage_count) || 0,
      lastUpdated: String(row.updated_at),
      createdAt: String(row.created_at),
    };
  }

  /**
   * Parse pattern row from database
   */
  private parsePatternRow(row: Record<string, unknown>): AxiomPromptPattern {
    return {
      patternId: String(row.pattern_id),
      domainId: String(row.domain_id),
      type: String(row.pattern_type) as AxiomPromptPattern['type'],
      content: String(row.content),
      usageCount: Number(row.usage_count) || 0,
      successRate: Number(row.success_rate) || 0.5,
      lastUsed: row.last_used ? String(row.last_used) : new Date().toISOString(),
      origin: String(row.origin) as AxiomPromptPattern['origin'],
      parentPatterns: this.parseJson(row.parent_patterns, []),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  /**
   * Parse JSON safely
   */
  private parseJson<T>(value: unknown, defaultValue: T): T {
    if (!value) return defaultValue;
    if (typeof value === 'object') return value as T;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return defaultValue;
      }
    }
    return defaultValue;
  }
}

// =============================================================================
// Export Singleton
// =============================================================================

export const axiomService = new AxiomService();
