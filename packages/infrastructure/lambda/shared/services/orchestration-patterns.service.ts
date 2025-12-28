// RADIANT v4.18.0 - Orchestration Patterns Service
// Manages 49 documented orchestration patterns with shared parameterized methods
// Architecture: Workflows → Methods (shared, parameterized per-workflow)
// Model Selection: Dynamic from metadata service with modes (Thinking, Deep Research, etc.)

import { executeStatement } from '../db/client';
import { modelRouterService } from './model-router.service';
import { learningService } from './learning.service';
import { modelMetadataService, ModelMetadata } from './model-metadata.service';

// ============================================================================
// Types
// ============================================================================

export interface OrchestrationMethod {
  methodId: string;
  methodCode: string;
  methodName: string;
  description: string;
  methodCategory: string;
  defaultParameters: Record<string, unknown>;
  parameterSchema: Record<string, unknown>;
  implementationType: 'prompt' | 'code' | 'composite' | 'external';
  promptTemplate?: string;
  codeReference?: string;
  modelRole: string;
  recommendedModels: string[];
  isEnabled: boolean;
}

export interface OrchestrationWorkflow {
  workflowId: string;
  workflowCode: string;
  commonName: string;
  formalName: string;
  category: string;
  categoryCode: string;
  patternNumber: number;
  description: string;
  detailedDescription?: string;
  bestFor: string[];
  problemIndicators: string[];
  qualityImprovement: string;
  typicalLatency: string;
  typicalCost: string;
  minModelsRequired: number;
  defaultConfig: Record<string, unknown>;
  isSystemWorkflow: boolean;
  isEnabled: boolean;
  avgQualityScore?: number;
}

export interface WorkflowStep {
  bindingId: string;
  stepOrder: number;
  stepName: string;
  stepDescription?: string;
  method: OrchestrationMethod;
  parameterOverrides: Record<string, unknown>;
  conditionExpression?: string;
  isIterative: boolean;
  maxIterations: number;
  iterationCondition?: string;
  dependsOnSteps: number[];
  modelOverride?: string;
  outputVariable?: string;
  // Parallelization settings
  parallelExecution?: ParallelExecutionConfig;
}

export interface ParallelExecutionConfig {
  enabled: boolean;
  mode: 'all' | 'race' | 'quorum'; // all = wait for all, race = first wins, quorum = majority
  models: string[]; // Multiple models to call in parallel (can be overridden by AGI)
  quorumThreshold?: number; // For quorum mode: 0.5 = majority, 0.7 = 70%
  synthesizeResults?: boolean; // Combine results from all models
  synthesisStrategy?: 'best_of' | 'merge' | 'vote' | 'weighted';
  weightByConfidence?: boolean;
  timeoutMs?: number; // Timeout for parallel calls
  failureStrategy?: 'fail_fast' | 'continue' | 'fallback'; // What to do if one fails
  // AGI Dynamic Model Selection
  agiModelSelection?: boolean; // Let AGI select models dynamically based on prompt/domain
  minModels?: number; // Minimum models AGI should select (default: 2)
  maxModels?: number; // Maximum models AGI should select (default: 5)
  domainHints?: string[]; // Optional hints for AGI model selection
}

// Model modes for specialized execution
export type ModelMode = 
  | 'standard'           // Default mode
  | 'thinking'           // Extended reasoning (o1, Claude thinking)
  | 'deep_research'      // In-depth research mode
  | 'fast'               // Speed-optimized (flash models)
  | 'creative'           // Higher temperature, creative mode
  | 'precise'            // Low temperature, factual mode
  | 'code'               // Code-specialized mode
  | 'vision'             // Multimodal with vision
  | 'long_context';      // Extended context handling

export interface ModelWithMode {
  modelId: string;
  mode: ModelMode;
  modeConfig?: Record<string, unknown>; // Mode-specific config (e.g., thinking budget)
}

// AGI Model Selection - Dynamic model assignment based on prompt analysis
export interface AGIModelSelectionResult {
  selectedModels: ModelWithMode[];
  reasoning: string;
  domainDetected: string;
  taskCharacteristics: {
    complexity: 'low' | 'medium' | 'high';
    requiresReasoning: boolean;
    requiresCreativity: boolean;
    requiresPrecision: boolean;
    requiresResearch: boolean;
    estimatedTokens: number;
  };
  modelScores: Array<{
    modelId: string;
    mode: ModelMode;
    score: number;
    strengths: string[];
    selectedFor: string;
    metadata?: Partial<ModelMetadata>; // Live metadata from service
  }>;
  executionStrategy: 'parallel' | 'sequential' | 'cascade';
  expectedQuality: number;
  expectedLatency: 'low' | 'medium' | 'high';
  expectedCost: 'low' | 'medium' | 'high';
}

export interface PatternSelectionRequest {
  tenantId: string;
  prompt: string;
  context?: string;
  taskType?: string;
  complexity?: string;
  preferredPatterns?: string[];
  excludePatterns?: string[];
  qualityPriority?: number; // 0-1, higher = prefer quality over speed
  costSensitive?: boolean;
}

export interface PatternSelectionResult {
  selectedPattern: OrchestrationWorkflow;
  confidence: number;
  reasoning: string;
  alternativePatterns: Array<{
    pattern: OrchestrationWorkflow;
    score: number;
    reason: string;
  }>;
}

export interface ExecutionRequest {
  tenantId: string;
  userId?: string;
  workflowCode: string;
  prompt: string;
  context?: string;
  configOverrides?: Record<string, unknown>;
  modelPreferences?: Record<string, string>;
}

export interface StepExecutionResult {
  stepOrder: number;
  stepName: string;
  methodCode: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  modelUsed: string;
  latencyMs: number;
  costCents: number;
  iteration: number;
  // Parallel execution results
  parallelResults?: ParallelExecutionResult[];
  wasParallel?: boolean;
  synthesizedFrom?: string[]; // Model IDs that contributed to final result
}

export interface ParallelExecutionResult {
  modelId: string;
  response: string;
  latencyMs: number;
  costCents: number;
  tokensUsed: number;
  confidence?: number;
  status: 'success' | 'failed' | 'timeout';
  error?: string;
}

export interface ExecutionResult {
  executionId: string;
  workflowCode: string;
  response: string;
  qualityScore: number;
  steps: StepExecutionResult[];
  totalLatencyMs: number;
  totalCostCents: number;
  modelsUsed: string[];
}

// ============================================================================
// Orchestration Patterns Service
// ============================================================================

export class OrchestrationPatternsService {

  // ============================================================================
  // Pattern Selection - AGI chooses optimal pattern for problem
  // ============================================================================

  async selectPattern(request: PatternSelectionRequest): Promise<PatternSelectionResult> {
    // Get all enabled workflows
    const workflows = await this.getEnabledWorkflows(request.tenantId);
    
    // Score each pattern based on problem characteristics
    const scores = await Promise.all(
      workflows.map(async (workflow) => {
        const score = await this.scorePatternForProblem(workflow, request);
        return { workflow, score };
      })
    );
    
    // Sort by score
    scores.sort((a, b) => b.score.total - a.score.total);
    
    // Apply filters
    let filtered = scores;
    if (request.preferredPatterns?.length) {
      filtered = filtered.filter(s => 
        request.preferredPatterns!.includes(s.workflow.workflowCode)
      );
    }
    if (request.excludePatterns?.length) {
      filtered = filtered.filter(s => 
        !request.excludePatterns!.includes(s.workflow.workflowCode)
      );
    }
    
    // Get top result
    const selected = filtered[0] || scores[0];
    
    return {
      selectedPattern: selected.workflow,
      confidence: selected.score.total,
      reasoning: selected.score.reasoning,
      alternativePatterns: filtered.slice(1, 4).map(s => ({
        pattern: s.workflow,
        score: s.score.total,
        reason: s.score.reasoning,
      })),
    };
  }

  private async scorePatternForProblem(
    workflow: OrchestrationWorkflow,
    request: PatternSelectionRequest
  ): Promise<{ total: number; reasoning: string }> {
    let score = 0;
    const reasons: string[] = [];
    
    // Check problem indicators match
    const promptLower = request.prompt.toLowerCase();
    for (const indicator of workflow.problemIndicators) {
      if (promptLower.includes(indicator.toLowerCase())) {
        score += 0.15;
        reasons.push(`Matches indicator: ${indicator}`);
      }
    }
    
    // Check task type match
    if (request.taskType) {
      for (const bestFor of workflow.bestFor) {
        if (bestFor.includes(request.taskType) || request.taskType.includes(bestFor)) {
          score += 0.2;
          reasons.push(`Good for task type: ${request.taskType}`);
          break;
        }
      }
    }
    
    // Adjust for quality/speed preference
    const qualityPriority = request.qualityPriority ?? 0.5;
    if (qualityPriority > 0.7) {
      // Prefer high-quality patterns
      if (workflow.typicalLatency === 'very_high' || workflow.typicalLatency === 'high') {
        score += 0.1;
        reasons.push('Quality-focused pattern');
      }
    } else if (qualityPriority < 0.3) {
      // Prefer fast patterns
      if (workflow.typicalLatency === 'low') {
        score += 0.1;
        reasons.push('Speed-focused pattern');
      }
    }
    
    // Adjust for cost sensitivity
    if (request.costSensitive) {
      if (workflow.typicalCost === 'low') {
        score += 0.1;
        reasons.push('Cost-effective pattern');
      } else if (workflow.typicalCost === 'very_high') {
        score -= 0.1;
      }
    }
    
    // Complexity match
    if (request.complexity) {
      const complexityScores: Record<string, number> = {
        'simple': 1, 'moderate': 2, 'complex': 3, 'expert': 4
      };
      const reqComplexity = complexityScores[request.complexity] || 2;
      const patternComplexity = workflow.minModelsRequired;
      
      // Prefer patterns that match complexity level
      if (Math.abs(patternComplexity - reqComplexity) <= 1) {
        score += 0.1;
        reasons.push('Complexity level match');
      }
    }
    
    // Historical performance boost
    if (workflow.avgQualityScore) {
      score += Number(workflow.avgQualityScore) * 0.1;
    }
    
    return {
      total: Math.min(1, Math.max(0, score)),
      reasoning: reasons.join('; ') || 'General match',
    };
  }

  // ============================================================================
  // Execute Workflow
  // ============================================================================

  async executeWorkflow(request: ExecutionRequest): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    // Get workflow and its steps
    const workflow = await this.getWorkflow(request.workflowCode);
    if (!workflow) {
      throw new Error(`Workflow ${request.workflowCode} not found`);
    }
    
    const steps = await this.getWorkflowSteps(workflow.workflowId);
    
    // Get tenant customizations
    const customization = await this.getWorkflowCustomization(
      workflow.workflowId,
      request.tenantId
    );
    
    // Merge configurations
    const config = {
      ...workflow.defaultConfig,
      ...customization?.configOverrides,
      ...request.configOverrides,
    };
    
    // Create execution record
    const executionId = await this.createExecution(
      workflow.workflowId,
      request.tenantId,
      request.userId,
      request.prompt,
      config
    );
    
    // Execute steps
    const stepResults: StepExecutionResult[] = [];
    const context: Record<string, unknown> = {
      originalPrompt: request.prompt,
      context: request.context,
      responses: [] as string[],
    };
    const modelsUsed = new Set<string>();
    let totalCost = 0;
    
    for (const step of steps) {
      // Check if step is disabled
      if (customization?.disabledSteps?.includes(step.stepOrder)) {
        continue;
      }
      
      // Check condition
      if (step.conditionExpression && !this.evaluateCondition(step.conditionExpression, context)) {
        continue;
      }
      
      // Check dependencies
      if (step.dependsOnSteps.length > 0) {
        const dependenciesMet = step.dependsOnSteps.every(
          depStep => stepResults.some(r => r.stepOrder === depStep)
        );
        if (!dependenciesMet) {
          continue;
        }
      }
      
      // Execute step (with iterations if needed)
      let iteration = 0;
      do {
        iteration++;
        
        const stepResult = await this.executeStep(
          step,
          context,
          config,
          request.modelPreferences,
          customization?.modelPreferences
        );
        
        stepResults.push({
          ...stepResult,
          iteration,
        });
        
        // Update context with step output
        if (step.outputVariable) {
          context[step.outputVariable] = stepResult.output;
        }
        if (stepResult.output.response) {
          (context.responses as string[]).push(String(stepResult.output.response));
        }
        
        modelsUsed.add(stepResult.modelUsed);
        totalCost += stepResult.costCents;
        
      } while (
        step.isIterative &&
        iteration < step.maxIterations &&
        step.iterationCondition &&
        this.evaluateCondition(step.iterationCondition, context)
      );
    }
    
    // Get final response
    const finalResponse = this.extractFinalResponse(stepResults, context);
    const totalLatency = Date.now() - startTime;
    
    // Calculate quality score
    const qualityScore = await this.assessQuality(
      request.prompt,
      finalResponse,
      stepResults
    );
    
    // Update execution record
    await this.completeExecution(
      executionId,
      finalResponse,
      qualityScore,
      totalLatency,
      totalCost,
      Array.from(modelsUsed)
    );
    
    // Record learning
    try {
      await learningService.recordInteraction({
        tenantId: request.tenantId,
        userId: request.userId,
        requestType: `orchestration_${request.workflowCode}`,
        requestSource: 'orchestration_patterns',
        requestText: request.prompt,
        modelSelected: Array.from(modelsUsed).join('+'),
        modelsConsidered: Array.from(modelsUsed),
        routingStrategy: request.workflowCode,
        responseText: finalResponse,
        totalLatencyMs: totalLatency,
        totalCostCents: totalCost,
        autoQualityScore: qualityScore,
        metadata: {
          workflowCode: request.workflowCode,
          stepsExecuted: stepResults.length,
        },
      });
    } catch (err) {
      console.error('Failed to record learning:', err);
    }
    
    return {
      executionId,
      workflowCode: request.workflowCode,
      response: finalResponse,
      qualityScore,
      steps: stepResults,
      totalLatencyMs: totalLatency,
      totalCostCents: totalCost,
      modelsUsed: Array.from(modelsUsed),
    };
  }

  private async executeStep(
    step: WorkflowStep,
    context: Record<string, unknown>,
    config: Record<string, unknown>,
    userModelPreferences?: Record<string, string>,
    tenantModelPreferences?: Record<string, string>
  ): Promise<Omit<StepExecutionResult, 'iteration'>> {
    const startTime = Date.now();
    
    // Resolve parameters
    const parameters = {
      ...step.method.defaultParameters,
      ...step.parameterOverrides,
    };
    
    // Build input
    const input = this.buildStepInput(step, context, parameters);
    
    // Check if parallel execution is enabled
    if (step.parallelExecution?.enabled && step.parallelExecution.models.length > 1) {
      return this.executeStepParallel(step, context, parameters, input, startTime);
    }
    
    // Single model execution (default)
    const modelRole = step.method.modelRole;
    const model = step.modelOverride
      || userModelPreferences?.[modelRole]
      || tenantModelPreferences?.[modelRole]
      || step.method.recommendedModels[0]
      || 'anthropic/claude-3-5-sonnet-20241022';
    
    // Execute based on implementation type
    let output: Record<string, unknown>;
    
    if (step.method.implementationType === 'prompt') {
      const prompt = this.interpolateTemplate(step.method.promptTemplate || '', {
        ...context,
        ...parameters,
        ...input,
      });
      
      const result = await modelRouterService.invoke({
        modelId: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: parameters.temperature as number | undefined,
        maxTokens: parameters.max_tokens as number | undefined,
      });
      
      output = {
        response: result.content,
        tokens: (result as { tokensUsed?: number }).tokensUsed || 0,
      };
    } else if (step.method.implementationType === 'code') {
      output = await this.executeCodeMethod(step.method.codeReference || '', input, parameters);
    } else {
      output = { response: 'Method type not implemented' };
    }
    
    const latency = Date.now() - startTime;
    const cost = (output.tokens as number || 0) * 0.00001;
    
    return {
      stepOrder: step.stepOrder,
      stepName: step.stepName,
      methodCode: step.method.methodCode,
      input,
      output,
      modelUsed: model,
      latencyMs: latency,
      costCents: cost * 100,
      wasParallel: false,
    };
  }

  // ============================================================================
  // AGI Dynamic Model Selection - Select models based on prompt and domain
  // Uses live model metadata from ModelMetadataService
  // ============================================================================

  private async selectModelsForStep(
    prompt: string,
    methodRole: string,
    parallelConfig: ParallelExecutionConfig
  ): Promise<AGIModelSelectionResult> {
    // Analyze the prompt to detect domain and characteristics
    const domain = this.detectDomain(prompt);
    const taskCharacteristics = this.analyzeTaskCharacteristics(prompt);
    
    // Fetch available models from metadata service (dynamic, live data)
    const availableModels = await modelMetadataService.getAllMetadata({ availableOnly: true });
    
    // Score models with modes based on task characteristics
    const modelScores = await this.scoreModelsWithModes(availableModels, domain, taskCharacteristics, methodRole);
    
    // Select top N models based on configuration
    const minModels = parallelConfig.minModels || 2;
    const maxModels = parallelConfig.maxModels || 5;
    const numModels = Math.min(maxModels, Math.max(minModels, this.calculateOptimalModelCount(taskCharacteristics)));
    
    const topModels = modelScores
      .sort((a, b) => b.score - a.score)
      .slice(0, numModels);
    
    const selectedModels: ModelWithMode[] = topModels.map(m => ({
      modelId: m.modelId,
      mode: m.mode,
      modeConfig: this.getModeConfig(m.mode, taskCharacteristics),
    }));

    return {
      selectedModels,
      reasoning: `Selected ${selectedModels.length} models with optimal modes for ${domain} domain. ` +
        `Task: ${taskCharacteristics.complexity} complexity, ` +
        `${taskCharacteristics.requiresReasoning ? 'requires deep reasoning, ' : ''}` +
        `${taskCharacteristics.requiresResearch ? 'requires research, ' : ''}` +
        `${taskCharacteristics.requiresCreativity ? 'creative task' : 'analytical task'}`,
      domainDetected: domain,
      taskCharacteristics,
      modelScores: topModels,
      executionStrategy: taskCharacteristics.requiresReasoning ? 'parallel' : 'cascade',
      expectedQuality: this.estimateQuality(selectedModels, domain),
      expectedLatency: this.estimateLatency(selectedModels),
      expectedCost: this.estimateCost(selectedModels),
    };
  }

  private detectDomain(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();
    
    const domainIndicators: Record<string, string[]> = {
      'coding': ['code', 'function', 'class', 'debug', 'implement', 'typescript', 'python', 'javascript', 'api', 'database', 'sql', 'algorithm', 'bug', 'error', 'compile'],
      'math': ['calculate', 'equation', 'formula', 'mathematical', 'proof', 'theorem', 'algebra', 'calculus', 'statistics', 'probability', 'integral', 'derivative'],
      'science': ['scientific', 'hypothesis', 'experiment', 'research', 'physics', 'chemistry', 'biology', 'quantum', 'theory', 'data'],
      'legal': ['legal', 'contract', 'law', 'regulation', 'compliance', 'liability', 'attorney', 'court', 'jurisdiction', 'statute'],
      'medical': ['medical', 'diagnosis', 'treatment', 'symptoms', 'patient', 'clinical', 'healthcare', 'drug', 'disease', 'therapy'],
      'finance': ['financial', 'investment', 'market', 'stock', 'trading', 'portfolio', 'risk', 'revenue', 'profit', 'valuation'],
      'creative': ['write', 'story', 'poem', 'creative', 'narrative', 'fiction', 'character', 'plot', 'imagine', 'design'],
      'analysis': ['analyze', 'evaluate', 'compare', 'assess', 'review', 'examine', 'investigate', 'benchmark', 'metrics'],
      'reasoning': ['reason', 'logic', 'deduce', 'infer', 'conclude', 'argue', 'justify', 'explain why', 'think through', 'step by step'],
      'research': ['research', 'find', 'search', 'discover', 'investigate', 'comprehensive', 'thorough', 'deep dive', 'explore'],
    };

    let maxScore = 0;
    let detectedDomain = 'general';

    for (const [domain, keywords] of Object.entries(domainIndicators)) {
      const score = keywords.filter(kw => lowerPrompt.includes(kw)).length;
      if (score > maxScore) {
        maxScore = score;
        detectedDomain = domain;
      }
    }

    return detectedDomain;
  }

  private analyzeTaskCharacteristics(prompt: string): {
    complexity: 'low' | 'medium' | 'high';
    requiresReasoning: boolean;
    requiresCreativity: boolean;
    requiresPrecision: boolean;
    requiresResearch: boolean;
    estimatedTokens: number;
  } {
    const length = prompt.length;
    const lowerPrompt = prompt.toLowerCase();
    const hasMultipleParts = prompt.includes('1.') || prompt.includes('first') || prompt.includes('then');
    
    return {
      complexity: length > 1000 || hasMultipleParts ? 'high' : length > 300 ? 'medium' : 'low',
      requiresReasoning: /think|reason|logic|step by step|analyze|deduce|why|how does/i.test(prompt),
      requiresCreativity: /creative|imagine|write|story|idea|design|invent/i.test(prompt),
      requiresPrecision: /exact|precise|accurate|correct|specific|must be|critical/i.test(prompt),
      requiresResearch: /research|comprehensive|thorough|deep dive|explore|find all|investigate/i.test(prompt),
      estimatedTokens: Math.ceil(length / 4) * 3,
    };
  }

  private async scoreModelsWithModes(
    models: ModelMetadata[],
    domain: string,
    characteristics: {
      complexity: 'low' | 'medium' | 'high';
      requiresReasoning: boolean;
      requiresCreativity: boolean;
      requiresPrecision: boolean;
      requiresResearch: boolean;
    },
    methodRole: string
  ): Promise<Array<{
    modelId: string;
    mode: ModelMode;
    score: number;
    strengths: string[];
    selectedFor: string;
    metadata?: Partial<ModelMetadata>;
  }>> {
    const results: Array<{
      modelId: string;
      mode: ModelMode;
      score: number;
      strengths: string[];
      selectedFor: string;
      metadata?: Partial<ModelMetadata>;
    }> = [];

    for (const model of models) {
      // Determine best mode for this model based on task
      const { mode, modeBonus } = this.selectBestMode(model, characteristics);
      
      let score = 0.5; // Base score
      const selectedReasons: string[] = [];

      // Quality score from metadata
      if (model.qualityScore) {
        score += model.qualityScore * 0.3;
      }

      // Domain match from specialties
      if (model.specialties?.some(s => s.toLowerCase().includes(domain))) {
        score += 0.2;
        selectedReasons.push(`Specialist in ${domain}`);
      }

      // Capability scores from metadata
      const capabilities = model.capabilities || {};
      if (domain === 'coding' && capabilities.coding) {
        score += capabilities.coding * 0.15;
        selectedReasons.push('Strong coding capability');
      }
      if (domain === 'reasoning' && capabilities.reasoning) {
        score += capabilities.reasoning * 0.15;
        selectedReasons.push('Strong reasoning capability');
      }
      if (domain === 'creative' && capabilities.creative) {
        score += capabilities.creative * 0.15;
        selectedReasons.push('Creative capability');
      }

      // Complexity handling
      if (characteristics.complexity === 'high') {
        if (model.contextWindow && model.contextWindow > 100000) {
          score += 0.1;
          selectedReasons.push('Large context window');
        }
      }

      // Mode bonus (thinking, research, etc.)
      score += modeBonus;
      if (mode !== 'standard') {
        selectedReasons.push(`${mode} mode enabled`);
      }

      // Reliability score
      if (model.reliabilityScore) {
        score += model.reliabilityScore * 0.1;
      }

      // Cost consideration for lower priority
      if (model.inputPricePer1M && model.inputPricePer1M < 5) {
        score += 0.05; // Slight bonus for cost-effective models
      }

      results.push({
        modelId: model.modelId,
        mode,
        score: Math.min(1, score),
        strengths: model.specialties || [],
        selectedFor: selectedReasons.join(', ') || 'General capability',
        metadata: {
          modelName: model.modelName,
          provider: model.provider,
          capabilities: model.capabilities,
          contextWindow: model.contextWindow,
          qualityScore: model.qualityScore,
        },
      });
    }

    return results;
  }

  private selectBestMode(
    model: ModelMetadata,
    characteristics: {
      requiresReasoning: boolean;
      requiresCreativity: boolean;
      requiresPrecision: boolean;
      requiresResearch: boolean;
    }
  ): { mode: ModelMode; modeBonus: number } {
    const modelId = model.modelId.toLowerCase();
    const modelName = model.modelName.toLowerCase();

    // Thinking mode - for models that support extended reasoning
    if (characteristics.requiresReasoning) {
      if (modelId.includes('o1') || modelId.includes('o3')) {
        return { mode: 'thinking', modeBonus: 0.3 };
      }
      if (modelId.includes('claude') && (modelId.includes('3.5') || modelId.includes('3-5'))) {
        return { mode: 'thinking', modeBonus: 0.25 };
      }
      if (modelId.includes('deepseek') && modelId.includes('r1')) {
        return { mode: 'thinking', modeBonus: 0.25 };
      }
    }

    // Deep research mode
    if (characteristics.requiresResearch) {
      if (modelId.includes('gemini') && modelName.includes('deep')) {
        return { mode: 'deep_research', modeBonus: 0.3 };
      }
      if (modelId.includes('perplexity') || modelId.includes('sonar')) {
        return { mode: 'deep_research', modeBonus: 0.35 };
      }
    }

    // Fast mode for flash/turbo models
    if (modelId.includes('flash') || modelId.includes('turbo') || modelId.includes('mini')) {
      if (characteristics.requiresReasoning || characteristics.requiresPrecision) {
        return { mode: 'standard', modeBonus: 0 }; // Don't use fast mode for complex tasks
      }
      return { mode: 'fast', modeBonus: 0.1 };
    }

    // Creative mode
    if (characteristics.requiresCreativity) {
      return { mode: 'creative', modeBonus: 0.1 };
    }

    // Precise mode
    if (characteristics.requiresPrecision) {
      return { mode: 'precise', modeBonus: 0.1 };
    }

    // Code mode for coding tasks
    if (model.specialties?.some(s => s.toLowerCase().includes('code'))) {
      return { mode: 'code', modeBonus: 0.1 };
    }

    return { mode: 'standard', modeBonus: 0 };
  }

  private getModeConfig(mode: ModelMode, characteristics: {
    complexity: 'low' | 'medium' | 'high';
    requiresReasoning: boolean;
  }): Record<string, unknown> {
    switch (mode) {
      case 'thinking':
        return {
          thinkingBudget: characteristics.complexity === 'high' ? 10000 : 5000,
          showThinking: true,
        };
      case 'deep_research':
        return {
          searchDepth: characteristics.complexity === 'high' ? 'comprehensive' : 'standard',
          includeSources: true,
        };
      case 'creative':
        return {
          temperature: 0.9,
          topP: 0.95,
        };
      case 'precise':
        return {
          temperature: 0.1,
          topP: 0.9,
        };
      case 'fast':
        return {
          maxTokens: 2048,
          streamResponse: true,
        };
      case 'code':
        return {
          temperature: 0.2,
          stopSequences: ['```\n\n'],
        };
      default:
        return {};
    }
  }

  private applyModeToParams(
    mode: ModelMode,
    modeConfig: Record<string, unknown> | undefined,
    baseParams: Record<string, unknown>
  ): { temperature?: number; maxTokens?: number; extra: Record<string, unknown> } {
    const config = modeConfig || {};
    
    switch (mode) {
      case 'thinking':
        return {
          temperature: 1, // Thinking models often work best at temp 1
          maxTokens: baseParams.max_tokens as number || 8192,
          extra: {
            thinkingBudget: config.thinkingBudget || 5000,
            enableThinking: true,
          },
        };
      case 'deep_research':
        return {
          temperature: 0.5,
          maxTokens: baseParams.max_tokens as number || 16384,
          extra: {
            searchDepth: config.searchDepth || 'standard',
            includeSources: true,
          },
        };
      case 'creative':
        return {
          temperature: config.temperature as number || 0.9,
          maxTokens: baseParams.max_tokens as number || 4096,
          extra: { topP: config.topP || 0.95 },
        };
      case 'precise':
        return {
          temperature: config.temperature as number || 0.1,
          maxTokens: baseParams.max_tokens as number || 4096,
          extra: { topP: config.topP || 0.9 },
        };
      case 'fast':
        return {
          temperature: baseParams.temperature as number || 0.7,
          maxTokens: config.maxTokens as number || 2048,
          extra: { streamResponse: true },
        };
      case 'code':
        return {
          temperature: config.temperature as number || 0.2,
          maxTokens: baseParams.max_tokens as number || 4096,
          extra: { stopSequences: config.stopSequences || [] },
        };
      case 'vision':
        return {
          temperature: baseParams.temperature as number || 0.7,
          maxTokens: baseParams.max_tokens as number || 4096,
          extra: { enableVision: true },
        };
      case 'long_context':
        return {
          temperature: baseParams.temperature as number || 0.7,
          maxTokens: baseParams.max_tokens as number || 16384,
          extra: { useLongContext: true },
        };
      default:
        return {
          temperature: baseParams.temperature as number,
          maxTokens: baseParams.max_tokens as number,
          extra: {},
        };
    }
  }

  private calculateOptimalModelCount(characteristics: { complexity: string; requiresReasoning: boolean }): number {
    if (characteristics.complexity === 'high' && characteristics.requiresReasoning) return 4;
    if (characteristics.complexity === 'high' || characteristics.requiresReasoning) return 3;
    return 2;
  }

  private estimateQuality(models: ModelWithMode[], domain: string): number {
    const baseQuality = 0.7;
    const modelBonus = Math.min(0.2, models.length * 0.05);
    const thinkingBonus = models.some(m => m.mode === 'thinking') ? 0.1 : 0;
    return Math.min(1, baseQuality + modelBonus + thinkingBonus);
  }

  private estimateLatency(models: ModelWithMode[]): 'low' | 'medium' | 'high' {
    const hasThinking = models.some(m => m.mode === 'thinking' || m.mode === 'deep_research');
    if (hasThinking) return 'high';
    if (models.length <= 2) return 'low';
    if (models.length <= 4) return 'medium';
    return 'high';
  }

  private estimateCost(models: ModelWithMode[]): 'low' | 'medium' | 'high' {
    const hasExpensiveMode = models.some(m => m.mode === 'thinking' || m.mode === 'deep_research');
    if (hasExpensiveMode || models.length > 4) return 'high';
    if (models.length > 2) return 'medium';
    return 'low';
  }

  // ============================================================================
  // Parallel Execution - Call multiple AI providers simultaneously
  // ============================================================================

  private async executeStepParallel(
    step: WorkflowStep,
    context: Record<string, unknown>,
    parameters: Record<string, unknown>,
    input: Record<string, unknown>,
    startTime: number
  ): Promise<Omit<StepExecutionResult, 'iteration'>> {
    const parallelConfig = step.parallelExecution!;
    const timeoutMs = parallelConfig.timeoutMs || 30000;

    // Build prompt once for all models
    const prompt = this.interpolateTemplate(step.method.promptTemplate || '', {
      ...context,
      ...parameters,
      ...input,
    });

    // AGI Dynamic Model Selection - select models based on prompt and domain
    let modelsWithModes: ModelWithMode[];
    let agiSelection: AGIModelSelectionResult | undefined;
    
    if (parallelConfig.agiModelSelection) {
      agiSelection = await this.selectModelsForStep(prompt, step.method.modelRole, parallelConfig);
      modelsWithModes = agiSelection.selectedModels;
    } else {
      // Convert static model list to ModelWithMode format
      modelsWithModes = parallelConfig.models.map(modelId => ({
        modelId,
        mode: 'standard' as ModelMode,
      }));
    }

    // Execute all models in parallel with their respective modes
    const modelPromises = modelsWithModes.map(async (modelWithMode): Promise<ParallelExecutionResult> => {
      const { modelId, mode, modeConfig } = modelWithMode;
      const modelStartTime = Date.now();
      try {
        // Apply mode-specific configuration
        const modeParams = this.applyModeToParams(mode, modeConfig, parameters);
        
        const result = await Promise.race([
          modelRouterService.invoke({
            modelId,
            messages: [{ role: 'user', content: prompt }],
            temperature: modeParams.temperature as number | undefined,
            maxTokens: modeParams.maxTokens as number | undefined,
            ...modeParams.extra,
          }),
          this.createTimeout(timeoutMs, modelId),
        ]);

        if ('timeout' in result) {
          return {
            modelId,
            response: '',
            latencyMs: timeoutMs,
            costCents: 0,
            tokensUsed: 0,
            status: 'timeout' as const,
            error: `Model ${modelId} timed out after ${timeoutMs}ms`,
          };
        }

        const tokensUsed = (result as { tokensUsed?: number }).tokensUsed || 0;
        return {
          modelId,
          response: result.content,
          latencyMs: Date.now() - modelStartTime,
          costCents: tokensUsed * 0.00001 * 100,
          tokensUsed,
          confidence: this.estimateConfidence(result.content),
          status: 'success' as const,
        };
      } catch (error) {
        return {
          modelId,
          response: '',
          latencyMs: Date.now() - modelStartTime,
          costCents: 0,
          tokensUsed: 0,
          status: 'failed' as const,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Handle based on mode
    let parallelResults: ParallelExecutionResult[];
    let finalOutput: Record<string, unknown>;
    let primaryModel: string;

    switch (parallelConfig.mode) {
      case 'race': {
        // Return first successful result
        const raceResult = await this.raceForFirst(modelPromises);
        parallelResults = [raceResult];
        finalOutput = { response: raceResult.response, tokens: raceResult.tokensUsed };
        primaryModel = raceResult.modelId;
        break;
      }
      
      case 'quorum': {
        // Wait for quorum threshold
        parallelResults = await this.waitForQuorum(
          modelPromises,
          parallelConfig.quorumThreshold || 0.5
        );
        const synthesis = this.synthesizeResults(parallelResults, parallelConfig);
        finalOutput = synthesis.output;
        primaryModel = synthesis.primaryModel;
        break;
      }
      
      case 'all':
      default: {
        // Wait for all results
        parallelResults = await Promise.all(modelPromises);
        
        // Handle failures based on strategy
        const successResults = parallelResults.filter(r => r.status === 'success');
        if (successResults.length === 0) {
          if (parallelConfig.failureStrategy === 'fail_fast') {
            throw new Error('All parallel model calls failed');
          }
          finalOutput = { response: 'All models failed', tokens: 0 };
          primaryModel = modelsWithModes[0].modelId;
        } else {
          const synthesis = this.synthesizeResults(successResults, parallelConfig);
          finalOutput = synthesis.output;
          primaryModel = synthesis.primaryModel;
        }
        break;
      }
    }

    const totalLatency = Date.now() - startTime;
    const totalCost = parallelResults.reduce((sum, r) => sum + r.costCents, 0);

    return {
      stepOrder: step.stepOrder,
      stepName: step.stepName,
      methodCode: step.method.methodCode,
      input,
      output: finalOutput,
      modelUsed: primaryModel,
      latencyMs: totalLatency,
      costCents: totalCost,
      wasParallel: true,
      parallelResults,
      synthesizedFrom: parallelResults.filter(r => r.status === 'success').map(r => r.modelId),
    };
  }

  private createTimeout(ms: number, modelId: string): Promise<{ timeout: true; modelId: string }> {
    return new Promise(resolve => {
      setTimeout(() => resolve({ timeout: true, modelId }), ms);
    });
  }

  private async raceForFirst(
    promises: Promise<ParallelExecutionResult>[]
  ): Promise<ParallelExecutionResult> {
    // Race but filter for successful results
    const results: ParallelExecutionResult[] = [];
    
    return new Promise((resolve, reject) => {
      let resolved = false;
      let completedCount = 0;
      
      promises.forEach(promise => {
        promise.then(result => {
          completedCount++;
          if (!resolved && result.status === 'success') {
            resolved = true;
            resolve(result);
          } else {
            results.push(result);
            if (completedCount === promises.length && !resolved) {
              // All failed, return first failure
              resolve(results[0]);
            }
          }
        }).catch(err => {
          completedCount++;
          if (completedCount === promises.length && !resolved) {
            reject(err);
          }
        });
      });
    });
  }

  private async waitForQuorum(
    promises: Promise<ParallelExecutionResult>[],
    threshold: number
  ): Promise<ParallelExecutionResult[]> {
    const results: ParallelExecutionResult[] = [];
    const requiredCount = Math.ceil(promises.length * threshold);
    
    return new Promise((resolve) => {
      let successCount = 0;
      
      promises.forEach(promise => {
        promise.then(result => {
          results.push(result);
          if (result.status === 'success') {
            successCount++;
            if (successCount >= requiredCount) {
              resolve(results.filter(r => r.status === 'success'));
            }
          }
          // If all completed without reaching quorum, return what we have
          if (results.length === promises.length) {
            resolve(results.filter(r => r.status === 'success'));
          }
        });
      });
    });
  }

  private synthesizeResults(
    results: ParallelExecutionResult[],
    config: ParallelExecutionConfig
  ): { output: Record<string, unknown>; primaryModel: string } {
    if (results.length === 0) {
      return { output: { response: '', tokens: 0 }, primaryModel: '' };
    }

    if (results.length === 1 || !config.synthesizeResults) {
      // Just return the best one (highest confidence or first)
      const best = config.weightByConfidence
        ? results.reduce((a, b) => (a.confidence || 0) > (b.confidence || 0) ? a : b)
        : results[0];
      return {
        output: { response: best.response, tokens: best.tokensUsed },
        primaryModel: best.modelId,
      };
    }

    switch (config.synthesisStrategy) {
      case 'best_of': {
        // Select highest confidence response
        const best = results.reduce((a, b) => 
          (a.confidence || 0) > (b.confidence || 0) ? a : b
        );
        return {
          output: { response: best.response, tokens: best.tokensUsed },
          primaryModel: best.modelId,
        };
      }

      case 'vote': {
        // Simple voting - find most common response pattern
        const responseGroups = new Map<string, { count: number; result: ParallelExecutionResult }>();
        for (const result of results) {
          const key = this.normalizeForVoting(result.response);
          const existing = responseGroups.get(key);
          if (existing) {
            existing.count++;
          } else {
            responseGroups.set(key, { count: 1, result });
          }
        }
        const winner = Array.from(responseGroups.values())
          .reduce((a, b) => a.count > b.count ? a : b);
        return {
          output: { response: winner.result.response, tokens: winner.result.tokensUsed },
          primaryModel: winner.result.modelId,
        };
      }

      case 'weighted': {
        // Weight by confidence and select best
        const weighted = results.map(r => ({
          ...r,
          score: (r.confidence || 0.5) * (1 / (r.latencyMs / 1000 + 1)), // Favor faster + confident
        }));
        const best = weighted.reduce((a, b) => a.score > b.score ? a : b);
        return {
          output: { response: best.response, tokens: best.tokensUsed },
          primaryModel: best.modelId,
        };
      }

      case 'merge':
      default: {
        // Merge all responses into synthesized output
        const mergedResponse = this.mergeResponses(results);
        const totalTokens = results.reduce((sum, r) => sum + r.tokensUsed, 0);
        return {
          output: { 
            response: mergedResponse, 
            tokens: totalTokens,
            sources: results.map(r => ({ model: r.modelId, confidence: r.confidence })),
          },
          primaryModel: results.map(r => r.modelId).join('+'),
        };
      }
    }
  }

  private normalizeForVoting(response: string): string {
    // Normalize response for comparison (lowercase, trim, remove punctuation)
    return response.toLowerCase().trim().replace(/[^\w\s]/g, '').substring(0, 200);
  }

  private mergeResponses(results: ParallelExecutionResult[]): string {
    // Simple merge - in production would use AI to synthesize
    if (results.length === 1) return results[0].response;
    
    const header = `[Synthesized from ${results.length} AI models]\n\n`;
    
    // Find common points across responses
    const responses = results.map(r => r.response);
    
    // For now, return highest confidence response with note about synthesis
    const best = results.reduce((a, b) => 
      (a.confidence || 0) > (b.confidence || 0) ? a : b
    );
    
    return header + best.response + `\n\n[Verified by ${results.length} models with avg confidence: ${
      (results.reduce((sum, r) => sum + (r.confidence || 0.5), 0) / results.length * 100).toFixed(0)
    }%]`;
  }

  private estimateConfidence(response: string): number {
    // Simple heuristic for confidence estimation
    // In production, would use model's own confidence or analyze response quality
    let confidence = 0.7; // Base confidence
    
    // Longer, more detailed responses tend to be more confident
    if (response.length > 500) confidence += 0.1;
    if (response.length > 1000) confidence += 0.05;
    
    // Responses with hedging language are less confident
    const hedgingWords = ['maybe', 'perhaps', 'possibly', 'might', 'could be', 'not sure', 'uncertain'];
    const lowerResponse = response.toLowerCase();
    for (const word of hedgingWords) {
      if (lowerResponse.includes(word)) {
        confidence -= 0.05;
      }
    }
    
    // Clamp to valid range
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private buildStepInput(
    step: WorkflowStep,
    context: Record<string, unknown>,
    parameters: Record<string, unknown>
  ): Record<string, unknown> {
    // Build input based on step dependencies and context
    const input: Record<string, unknown> = {
      prompt: context.originalPrompt,
      context: context.context,
    };
    
    // Add previous responses
    if ((context.responses as string[])?.length > 0) {
      input.responses = context.responses;
      input.previousResponse = (context.responses as string[]).slice(-1)[0];
    }
    
    // Add any step-specific inputs
    for (const depStep of step.dependsOnSteps) {
      const depOutput = context[`step_${depStep}_output`];
      if (depOutput) {
        input[`step_${depStep}`] = depOutput;
      }
    }
    
    return input;
  }

  private interpolateTemplate(template: string, values: Record<string, unknown>): string {
    let result = template;
    
    // Simple {{variable}} interpolation
    for (const [key, value] of Object.entries(values)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, String(value || ''));
    }
    
    // Handle {{#each}} blocks (simplified)
    const eachRegex = /\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
    result = result.replace(eachRegex, (_, arrayName, template) => {
      const array = values[arrayName];
      if (Array.isArray(array)) {
        return array.map((item, index) => {
          let itemResult = template;
          itemResult = itemResult.replace(/\{\{this\}\}/g, String(item));
          itemResult = itemResult.replace(/\{\{@index\}\}/g, String(index + 1));
          return itemResult;
        }).join('');
      }
      return '';
    });
    
    return result;
  }

  private async executeCodeMethod(
    codeReference: string,
    input: Record<string, unknown>,
    parameters: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    // Route to actual service methods based on code reference
    // Format: "service.method" e.g., "learning.extractInsights"
    const [serviceName, methodName] = codeReference.split('.');
    
    try {
      switch (serviceName) {
        case 'learning':
          return await this.executeLearningMethod(methodName, input, parameters);
        case 'model':
          return await this.executeModelMethod(methodName, input, parameters);
        case 'memory':
          return await this.executeMemoryMethod(methodName, input, parameters);
        case 'analysis':
          return await this.executeAnalysisMethod(methodName, input, parameters);
        default:
          return { 
            error: `Unknown service: ${serviceName}`,
            availableServices: ['learning', 'model', 'memory', 'analysis']
          };
      }
    } catch (error) {
      return { 
        error: error instanceof Error ? error.message : 'Method execution failed',
        codeReference,
        input
      };
    }
  }

  private async executeLearningMethod(
    method: string,
    input: Record<string, unknown>,
    parameters: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    switch (method) {
      case 'getInsights':
        const insights = await learningService.getSpecialtyInsights(
          String(input.specialty || '')
        );
        return { insights };
      case 'recordFeedback':
        await learningService.recordFeedback(
          String(input.interactionId || ''),
          {
            rating: Number(input.rating || 0),
            feedbackText: String(input.feedbackText || ''),
          }
        );
        return { success: true };
      case 'getStats':
        const stats = await learningService.getLearningStats(String(input.tenantId || ''));
        return { stats };
      default:
        return { error: `Unknown learning method: ${method}` };
    }
  }

  private async executeModelMethod(
    method: string,
    input: Record<string, unknown>,
    parameters: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    switch (method) {
      case 'invoke':
        const response = await modelRouterService.invoke({
          modelId: String(parameters.modelId || input.modelId || 'anthropic/claude-3-5-sonnet'),
          messages: (input.messages as Array<{ role: 'user' | 'system' | 'assistant'; content: string }>) || [],
          maxTokens: Number(parameters.maxTokens || 4096),
          temperature: Number(parameters.temperature || 0.7),
        });
        return { response: response.content, tokens: response.inputTokens + response.outputTokens };
      case 'getMetadata':
        const metadata = await modelMetadataService.getMetadata(
          String(parameters.modelId || input.modelId || '')
        );
        return { metadata };
      case 'getAllModels':
        const allModels = await modelMetadataService.getAllMetadata({
          availableOnly: Boolean(parameters.availableOnly ?? true),
        });
        return { models: allModels };
      default:
        return { error: `Unknown model method: ${method}` };
    }
  }

  private async executeMemoryMethod(
    method: string,
    input: Record<string, unknown>,
    parameters: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    switch (method) {
      case 'store':
        await executeStatement(
          `INSERT INTO semantic_memories (tenant_id, content, context, created_at)
           VALUES ($1, $2, $3, NOW())`,
          [
            { name: 'tenantId', value: { stringValue: String(input.tenantId || '') } },
            { name: 'content', value: { stringValue: String(input.content || '') } },
            { name: 'context', value: { stringValue: String(input.context || '') } },
          ]
        );
        return { success: true };
      case 'retrieve':
        const result = await executeStatement(
          `SELECT content, context FROM semantic_memories 
           WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
          [
            { name: 'tenantId', value: { stringValue: String(input.tenantId || '') } },
            { name: 'limit', value: { longValue: Number(parameters.limit || 10) } },
          ]
        );
        return { memories: result.rows };
      default:
        return { error: `Unknown memory method: ${method}` };
    }
  }

  private async executeAnalysisMethod(
    method: string,
    input: Record<string, unknown>,
    parameters: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    switch (method) {
      case 'summarize':
        const summaryResponse = await modelRouterService.invoke({
          modelId: 'anthropic/claude-3-5-sonnet',
          messages: [{ role: 'user', content: `Summarize this content concisely:\n\n${String(input.content || '')}` }],
          maxTokens: Number(parameters.maxTokens || 500),
        });
        return { summary: summaryResponse.content };
      case 'extractEntities':
        const entityResponse = await modelRouterService.invoke({
          modelId: 'anthropic/claude-3-5-sonnet',
          messages: [{ 
            role: 'user', 
            content: `Extract key entities (people, places, organizations, concepts) from this text. Return as JSON array:\n\n${String(input.content || '')}` 
          }],
          maxTokens: 1000,
        });
        return { entities: entityResponse.content };
      case 'classify':
        const classifyResponse = await modelRouterService.invoke({
          modelId: 'anthropic/claude-3-5-sonnet',
          messages: [{ 
            role: 'user', 
            content: `Classify this content into categories. Categories: ${String(parameters.categories || 'general')}.\n\nContent: ${String(input.content || '')}` 
          }],
          maxTokens: 200,
        });
        return { classification: classifyResponse.content };
      default:
        return { error: `Unknown analysis method: ${method}` };
    }
  }

  private evaluateCondition(condition: string, context: Record<string, unknown>): boolean {
    // Simple condition evaluation for workflow patterns
    // Examples: "confidence < 0.7", "iteration < max_iterations"
    // SECURITY: Input is sanitized to alphanumeric + comparison operators only
    // This prevents injection attacks while allowing basic comparisons
    try {
      const sanitized = condition.replace(/[^a-zA-Z0-9_.<>=! ]/g, '');
      // Validate sanitized condition doesn't contain dangerous patterns
      if (sanitized.length > 100 || /[;{}]/.test(condition)) {
        return true; // Fail safe
      }
      // eslint-disable-next-line no-new-func -- Required for dynamic condition eval, input is sanitized above
      const fn = new Function(...Object.keys(context), `return ${sanitized}`);
      return Boolean(fn(...Object.values(context)));
    } catch {
      return true; // Fail safe on evaluation errors
    }
  }

  private extractFinalResponse(
    steps: StepExecutionResult[],
    context: Record<string, unknown>
  ): string {
    // Get the last step's response, or synthesize from context
    if (steps.length > 0) {
      const lastStep = steps[steps.length - 1];
      if (lastStep.output.response) {
        return String(lastStep.output.response);
      }
    }
    
    const responses = context.responses as string[];
    if (responses?.length > 0) {
      return responses[responses.length - 1];
    }
    
    return 'No response generated';
  }

  private async assessQuality(
    prompt: string,
    response: string,
    steps: StepExecutionResult[]
  ): Promise<number> {
    // Simple quality assessment based on step count and response length
    let score = 0.7; // Base score
    
    // More steps = more thorough = higher score
    score += Math.min(0.15, steps.length * 0.03);
    
    // Longer, more detailed response = higher score (up to a point)
    const responseLength = response.length;
    if (responseLength > 500) score += 0.05;
    if (responseLength > 1000) score += 0.05;
    
    return Math.min(1, score);
  }

  // ============================================================================
  // Data Access Methods
  // ============================================================================

  async getEnabledWorkflows(tenantId?: string): Promise<OrchestrationWorkflow[]> {
    const result = await executeStatement(
      `SELECT * FROM orchestration_workflows 
       WHERE is_enabled = true 
         AND (is_system_workflow = true OR tenant_id = $1)
       ORDER BY pattern_number`,
      [{ name: 'tenantId', value: tenantId ? { stringValue: tenantId } : { isNull: true } }]
    );
    
    return result.rows.map(r => this.mapWorkflow(r as Record<string, unknown>));
  }

  async getWorkflow(workflowCode: string): Promise<OrchestrationWorkflow | null> {
    const result = await executeStatement(
      `SELECT * FROM orchestration_workflows WHERE workflow_code = $1`,
      [{ name: 'code', value: { stringValue: workflowCode } }]
    );
    
    if (result.rows.length === 0) return null;
    return this.mapWorkflow(result.rows[0] as Record<string, unknown>);
  }

  async getWorkflowSteps(workflowId: string): Promise<WorkflowStep[]> {
    const result = await executeStatement(
      `SELECT wmb.*, om.*
       FROM workflow_method_bindings wmb
       JOIN orchestration_methods om ON wmb.method_id = om.method_id
       WHERE wmb.workflow_id = $1 AND wmb.is_enabled = true
       ORDER BY wmb.step_order`,
      [{ name: 'workflowId', value: { stringValue: workflowId } }]
    );
    
    return result.rows.map(r => this.mapWorkflowStep(r as Record<string, unknown>));
  }

  async getWorkflowCustomization(
    workflowId: string,
    tenantId: string
  ): Promise<{
    configOverrides: Record<string, unknown>;
    disabledSteps: number[];
    modelPreferences: Record<string, string>;
  } | null> {
    const result = await executeStatement(
      `SELECT * FROM workflow_customizations 
       WHERE workflow_id = $1 AND tenant_id = $2`,
      [
        { name: 'workflowId', value: { stringValue: workflowId } },
        { name: 'tenantId', value: { stringValue: tenantId } },
      ]
    );
    
    if (result.rows.length === 0) return null;
    const row = result.rows[0] as Record<string, unknown>;
    
    return {
      configOverrides: typeof row.config_overrides === 'string' 
        ? JSON.parse(row.config_overrides) 
        : (row.config_overrides as Record<string, unknown>) || {},
      disabledSteps: (row.disabled_steps as number[]) || [],
      modelPreferences: typeof row.model_preferences === 'string'
        ? JSON.parse(row.model_preferences)
        : (row.model_preferences as Record<string, string>) || {},
    };
  }

  async getAllMethods(): Promise<OrchestrationMethod[]> {
    const result = await executeStatement(
      `SELECT * FROM orchestration_methods WHERE is_enabled = true ORDER BY method_category, method_name`,
      []
    );
    return result.rows.map(r => this.mapMethod(r as Record<string, unknown>));
  }

  async getMethodsByCategory(category: string): Promise<OrchestrationMethod[]> {
    const result = await executeStatement(
      `SELECT * FROM orchestration_methods WHERE method_category = $1 AND is_enabled = true`,
      [{ name: 'category', value: { stringValue: category } }]
    );
    return result.rows.map(r => this.mapMethod(r as Record<string, unknown>));
  }

  // ============================================================================
  // Execution Tracking
  // ============================================================================

  private async createExecution(
    workflowId: string,
    tenantId: string,
    userId: string | undefined,
    prompt: string,
    config: Record<string, unknown>
  ): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO orchestration_executions 
       (workflow_id, tenant_id, user_id, input_prompt, resolved_config, status)
       VALUES ($1, $2, $3, $4, $5, 'running')
       RETURNING execution_id`,
      [
        { name: 'workflowId', value: { stringValue: workflowId } },
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: userId ? { stringValue: userId } : { isNull: true } },
        { name: 'prompt', value: { stringValue: prompt } },
        { name: 'config', value: { stringValue: JSON.stringify(config) } },
      ]
    );
    
    return String((result.rows[0] as Record<string, unknown>).execution_id);
  }

  private async completeExecution(
    executionId: string,
    response: string,
    qualityScore: number,
    latencyMs: number,
    costCents: number,
    modelsUsed: string[]
  ): Promise<void> {
    await executeStatement(
      `UPDATE orchestration_executions SET
         status = 'completed',
         output_response = $2,
         quality_score = $3,
         total_latency_ms = $4,
         total_cost_cents = $5,
         models_used = $6,
         completed_at = NOW()
       WHERE execution_id = $1`,
      [
        { name: 'executionId', value: { stringValue: executionId } },
        { name: 'response', value: { stringValue: response.substring(0, 100000) } },
        { name: 'qualityScore', value: { doubleValue: qualityScore } },
        { name: 'latencyMs', value: { longValue: latencyMs } },
        { name: 'costCents', value: { doubleValue: costCents } },
        { name: 'modelsUsed', value: { stringValue: `{${modelsUsed.join(',')}}` } },
      ]
    );
  }

  // ============================================================================
  // Mapping Helpers
  // ============================================================================

  private mapWorkflow(row: Record<string, unknown>): OrchestrationWorkflow {
    return {
      workflowId: String(row.workflow_id),
      workflowCode: String(row.workflow_code),
      commonName: String(row.common_name),
      formalName: String(row.formal_name),
      category: String(row.category),
      categoryCode: String(row.category_code),
      patternNumber: Number(row.pattern_number || 0),
      description: String(row.description),
      detailedDescription: row.detailed_description ? String(row.detailed_description) : undefined,
      bestFor: (row.best_for as string[]) || [],
      problemIndicators: (row.problem_indicators as string[]) || [],
      qualityImprovement: String(row.quality_improvement || ''),
      typicalLatency: String(row.typical_latency || 'medium'),
      typicalCost: String(row.typical_cost || 'medium'),
      minModelsRequired: Number(row.min_models_required || 1),
      defaultConfig: typeof row.default_config === 'string' 
        ? JSON.parse(row.default_config) 
        : (row.default_config as Record<string, unknown>) || {},
      isSystemWorkflow: Boolean(row.is_system_workflow),
      isEnabled: Boolean(row.is_enabled),
      avgQualityScore: row.avg_quality_score ? Number(row.avg_quality_score) : undefined,
    };
  }

  private mapMethod(row: Record<string, unknown>): OrchestrationMethod {
    return {
      methodId: String(row.method_id),
      methodCode: String(row.method_code),
      methodName: String(row.method_name),
      description: String(row.description || ''),
      methodCategory: String(row.method_category),
      defaultParameters: typeof row.default_parameters === 'string'
        ? JSON.parse(row.default_parameters)
        : (row.default_parameters as Record<string, unknown>) || {},
      parameterSchema: typeof row.parameter_schema === 'string'
        ? JSON.parse(row.parameter_schema)
        : (row.parameter_schema as Record<string, unknown>) || {},
      implementationType: String(row.implementation_type) as OrchestrationMethod['implementationType'],
      promptTemplate: row.prompt_template ? String(row.prompt_template) : undefined,
      codeReference: row.code_reference ? String(row.code_reference) : undefined,
      modelRole: String(row.model_role || 'generator'),
      recommendedModels: (row.recommended_models as string[]) || [],
      isEnabled: Boolean(row.is_enabled),
    };
  }

  private mapWorkflowStep(row: Record<string, unknown>): WorkflowStep {
    return {
      bindingId: String(row.binding_id),
      stepOrder: Number(row.step_order),
      stepName: String(row.step_name || ''),
      stepDescription: row.step_description ? String(row.step_description) : undefined,
      method: this.mapMethod(row),
      parameterOverrides: typeof row.parameter_overrides === 'string'
        ? JSON.parse(row.parameter_overrides)
        : (row.parameter_overrides as Record<string, unknown>) || {},
      conditionExpression: row.condition_expression ? String(row.condition_expression) : undefined,
      isIterative: Boolean(row.is_iterative),
      maxIterations: Number(row.max_iterations || 1),
      iterationCondition: row.iteration_condition ? String(row.iteration_condition) : undefined,
      dependsOnSteps: (row.depends_on_steps as number[]) || [],
      modelOverride: row.model_override ? String(row.model_override) : undefined,
      outputVariable: row.output_variable ? String(row.output_variable) : undefined,
    };
  }
}

export const orchestrationPatternsService = new OrchestrationPatternsService();
