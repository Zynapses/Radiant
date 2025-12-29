// RADIANT v4.18.0 - AGI Brain Planner Service
// Real-time planning system that generates execution plans for prompts

import { executeStatement } from '../db/client';
import { domainTaxonomyService } from './domain-taxonomy.service';
import { agiOrchestrationSettingsService } from './agi-orchestration-settings.service';
import { modelRouterService } from './model-router.service';
import { delightOrchestrationService, type DelightWorkflowEvent, type WorkflowDelightResponse } from './delight-orchestration.service';
import { orchestrationPatternsService, type OrchestrationWorkflow, type WorkflowStep } from './orchestration-patterns.service';
import { prepromptLearningService } from './preprompt-learning.service';
import { providerRejectionService } from './provider-rejection.service';
import { userPersistentContextService, type RetrievedContext } from './user-persistent-context.service';
import { egoContextService, type EgoContextResult } from './ego-context.service';
import { libraryAssistService, type LibraryAssistResult } from './library-assist.service';
import { enhancedLearningService, type PatternCacheEntry } from './enhanced-learning.service';
import { v4 as uuidv4 } from 'uuid';

// Gemini 3 model for plan summarization
const PLAN_SUMMARY_MODEL = 'google/gemini-2.0-flash-thinking-exp';

// ============================================================================
// Types
// ============================================================================

export type PlanStatus = 'planning' | 'ready' | 'executing' | 'completed' | 'failed' | 'cancelled';
export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';
export type StepType = 'analyze' | 'detect_domain' | 'select_model' | 'prepare_context' | 'ethics_check' | 'generate' | 'synthesize' | 'verify' | 'refine' | 'calibrate' | 'reflect';
export type OrchestrationMode = 'thinking' | 'extended_thinking' | 'coding' | 'creative' | 'research' | 'analysis' | 'multi_model' | 'chain_of_thought' | 'self_consistency';

export interface PlanStep {
  stepId: string;
  stepNumber: number;
  stepType: StepType;
  title: string;
  description: string;
  status: StepStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  servicesInvolved: string[];
  primaryService?: string;
  selectedModel?: string;
  modelReason?: string;
  alternativeModels?: string[];
  detectedDomain?: {
    fieldId: string;
    fieldName: string;
    domainId: string;
    domainName: string;
    subspecialtyId?: string;
    subspecialtyName?: string;
    confidence: number;
  };
  output?: Record<string, unknown>;
  confidence?: number;
  dependsOn?: string[];
  isOptional?: boolean;
  isParallel?: boolean;
}

export interface PromptAnalysis {
  originalPrompt: string;
  tokenCount: number;
  complexity: 'simple' | 'moderate' | 'complex' | 'expert';
  taskType: string;
  intentDetected: string;
  requiresReasoning: boolean;
  requiresCreativity: boolean;
  requiresFactualAccuracy: boolean;
  requiresCodeGeneration: boolean;
  requiresMultiStep: boolean;
  keyTopics: string[];
  detectedLanguage: string;
  sensitivityLevel: 'none' | 'low' | 'medium' | 'high';
}

export interface ModelSelection {
  modelId: string;
  modelName: string;
  provider: string;
  selectionReason: string;
  matchScore: number;
  strengths: string[];
  estimatedLatencyMs: number;
  estimatedCostPer1kTokens: number;
}

/** Performance metrics exposed via response headers */
export interface RouterPerformanceMetrics {
  routerLatencyMs: number;      // Time spent in brain router decision-making
  domainDetectionMs: number;    // Time for domain detection
  modelSelectionMs: number;     // Time for model selection
  planGenerationMs: number;     // Total plan generation time
  estimatedCostCents: number;   // Estimated cost for this request
  modelCostPer1kTokens: number; // Cost of selected model
  cacheHit: boolean;            // Whether routing decision was cached
}

export interface AGIBrainPlan {
  planId: string;
  tenantId: string;
  userId: string;
  sessionId?: string;
  conversationId?: string;
  prompt: string;
  promptAnalysis: PromptAnalysis;
  status: PlanStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  totalDurationMs?: number;
  /** Performance metrics for debugging and optimization */
  performanceMetrics?: RouterPerformanceMetrics;
  steps: PlanStep[];
  currentStepIndex: number;
  orchestrationMode: OrchestrationMode;
  orchestrationReason: string;
  orchestrationSelection: 'auto' | 'user';  // Whether workflow was auto-selected or user-selected
  primaryModel: ModelSelection;
  fallbackModels: ModelSelection[];
  // Pre-prompt learning integration
  prepromptInstanceId?: string;
  prepromptTemplateCode?: string;
  systemPrompt?: string;
  domainDetection?: {
    fieldId: string;
    fieldName: string;
    fieldIcon: string;
    domainId: string;
    domainName: string;
    domainIcon: string;
    subspecialtyId?: string;
    subspecialtyName?: string;
    confidence: number;
    proficiencies: Record<string, number>;
  };
  consciousnessActive: boolean;
  ethicsEvaluation?: {
    passed: boolean;
    principlesChecked: number;
    relevantPrinciples: string[];
    concerns: string[];
    recommendation: 'proceed' | 'modify' | 'refuse' | 'clarify';
    moralConfidence: number;
  };
  estimatedDurationMs: number;
  estimatedCostCents: number;
  estimatedTokens: number;
  qualityTargets: {
    minConfidence: number;
    targetAccuracy: number;
    maxLatencyMs: number;
    maxCostCents: number;
    requireVerification: boolean;
    requireConsistency: boolean;
  };
  learningEnabled: boolean;
  feedbackRequested: boolean;
  // User Persistent Context - solves LLM forgetting problem
  userContext?: {
    enabled: boolean;
    entriesRetrieved: number;
    systemPromptInjection: string;
    totalRelevance: number;
    retrievalTimeMs: number;
  };
  // Plan summary (generated by Gemini 3)
  planSummary?: PlanSummary;
  // Library recommendations for generative UI outputs
  libraryRecommendations?: {
    enabled: boolean;
    libraries: Array<{
      id: string;
      name: string;
      category: string;
      matchScore: number;
      reason: string;
      codeExample?: string;
    }>;
    contextBlock?: string;
    retrievalTimeMs: number;
  };
  // Workflow Integration - AGI can select and configure workflows
  selectedWorkflow?: {
    workflowId: string;
    workflowCode: string;
    workflowName: string;
    description: string;
    category: string;
    selectionReason: string;
    selectionConfidence: number;
    selectionMethod: 'auto' | 'user' | 'domain_match';
  };
  workflowSteps?: Array<{
    bindingId: string;
    stepOrder: number;
    methodCode: string;
    methodName: string;
    parameterOverrides: Record<string, unknown>;
    dependsOn: string[];
    isParallel: boolean;
    parallelConfig?: {
      models: string[];
      outputMode: 'single' | 'all' | 'top_n' | 'threshold';
    };
  }>;
  workflowConfig?: Record<string, unknown>;
  alternativeWorkflows?: Array<{
    workflowCode: string;
    workflowName: string;
    matchScore: number;
    reason: string;
  }>;
  // Enhanced Learning System Integration
  enhancedLearning?: {
    enabled: boolean;
    patternCacheHit: boolean;
    cachedResponse?: string;
    cachedResponseRating?: number;
    activeLearningRequested: boolean;
    activeLearningPrompt?: string;
    conversationLearningId?: string;
    implicitFeedbackEnabled: boolean;
  };
}

export interface PlanSummary {
  headline: string;  // One-line summary
  approach: string;  // How the AGI will approach this
  stepsOverview: string[];  // Brief description of each step
  expectedOutcome: string;  // What the user can expect
  estimatedTime: string;  // Human-readable time estimate
  confidenceStatement: string;  // How confident the AGI is
  warnings?: string[];  // Any concerns or limitations
}

export interface GeneratePlanRequest {
  prompt: string;
  tenantId: string;
  userId: string;
  sessionId?: string;
  conversationId?: string;
  conversationHistory?: string[];  // Recent messages for context retrieval
  preferredMode?: OrchestrationMode;
  preferredModel?: string;
  maxLatencyMs?: number;
  maxCostCents?: number;
  enableConsciousness?: boolean;
  enableEthicsCheck?: boolean;
  enableVerification?: boolean;
  enableLearning?: boolean;
  enableUserContext?: boolean;  // Enable user persistent context injection (default: true)
  enableEgoContext?: boolean;   // Enable ego context injection (default: true)
  enableLibraryAssist?: boolean; // Enable library recommendations for generative UI (default: true)
  domainOverride?: {
    fieldId?: string;
    domainId?: string;
    subspecialtyId?: string;
  };
  // Workflow Selection - AGI can use orchestration workflows
  preferredWorkflow?: string;           // User-selected workflow code
  workflowParameterOverrides?: Record<string, unknown>;  // User parameter tweaks
  allowAgiWorkflowSelection?: boolean;  // Let AGI pick workflow (default: true)
  excludeWorkflows?: string[];          // Workflows to exclude from selection
}

// ============================================================================
// AGI Brain Planner Service
// ============================================================================

export class AGIBrainPlannerService {
  private activePlans = new Map<string, AGIBrainPlan>();

  // ============================================================================
  // Plan Generation
  // ============================================================================

  async generatePlan(request: GeneratePlanRequest): Promise<AGIBrainPlan> {
    const planId = uuidv4();
    const startTime = Date.now();
    
    // Performance tracking
    let domainDetectionMs = 0;
    let modelSelectionMs = 0;
    let cacheHit = false;

    // Step 0: Retrieve user persistent context (solves LLM forgetting problem)
    let userContextResult: RetrievedContext | null = null;
    if (request.enableUserContext !== false) {
      try {
        userContextResult = await userPersistentContextService.retrieveContextForPrompt(
          request.tenantId,
          request.userId,
          request.prompt,
          request.conversationHistory,
          { maxEntries: 10, minRelevance: 0.3 }
        );
      } catch {
        // Context retrieval failed, continue without it
      }
    }

    // Step 0.5: Build Ego context (zero-cost persistent Self)
    let egoContextResult: EgoContextResult | null = null;
    if (request.enableEgoContext !== false) {
      try {
        egoContextResult = await egoContextService.buildEgoContext(request.tenantId);
      } catch {
        // Ego context failed, continue without it
      }
    }

    // Step 0.6: Get library recommendations for generative UI outputs
    let libraryAssistResult: LibraryAssistResult | null = null;
    const libraryStartTime = Date.now();
    if (request.enableLibraryAssist !== false) {
      try {
        libraryAssistResult = await libraryAssistService.getRecommendations({
          tenantId: request.tenantId,
          userId: request.userId,
          conversationId: request.conversationId,
          prompt: request.prompt,
          requestId: planId,
        });
      } catch {
        // Library assist failed, continue without it
      }
    }
    const libraryRetrievalTimeMs = Date.now() - libraryStartTime;

    // Step 0.7: Check Enhanced Learning pattern cache (instant response for known patterns)
    let patternCacheResult: PatternCacheEntry | null = null;
    let enhancedLearningConfig = null;
    if (request.enableLearning !== false) {
      try {
        enhancedLearningConfig = await enhancedLearningService.getConfig(request.tenantId);
        if (enhancedLearningConfig?.patternCachingEnabled) {
          patternCacheResult = await enhancedLearningService.findCachedPattern(
            request.tenantId,
            request.prompt
          );
        }
      } catch {
        // Pattern cache lookup failed, continue without it
      }
    }

    // Step 1: Analyze prompt
    const promptAnalysis = await this.analyzePrompt(request.prompt);

    // Step 2: Detect domain (with timing)
    const domainStartTime = Date.now();
    const domainResult = await this.detectDomain(request.prompt, request.domainOverride);
    domainDetectionMs = Date.now() - domainStartTime;

    // Step 2.5: Select workflow (AGI chooses optimal workflow pattern)
    const workflowSelection = await this.selectWorkflow(
      request,
      promptAnalysis,
      domainResult
    );

    // Step 3: Determine orchestration mode
    const { mode, reason } = this.determineOrchestrationMode(promptAnalysis, domainResult);
    const orchestrationMode = request.preferredMode || mode;

    // Step 4: Select models (with timing)
    const modelStartTime = Date.now();
    const { primary, fallbacks, fromCache } = await this.selectModels(
      request.tenantId,
      promptAnalysis,
      domainResult,
      orchestrationMode,
      request.preferredModel
    );
    modelSelectionMs = Date.now() - modelStartTime;
    cacheHit = fromCache || false;

    // Step 5: Generate plan steps
    const steps = this.generatePlanSteps(
      promptAnalysis,
      orchestrationMode,
      request.enableConsciousness ?? true,
      request.enableEthicsCheck ?? true,
      request.enableVerification ?? true
    );

    // Step 6: Estimate performance
    const estimates = this.estimatePerformance(steps, primary, promptAnalysis);

    // Create plan
    const plan: AGIBrainPlan = {
      planId,
      tenantId: request.tenantId,
      userId: request.userId,
      sessionId: request.sessionId,
      conversationId: request.conversationId,
      prompt: request.prompt,
      promptAnalysis,
      status: 'ready',
      createdAt: new Date().toISOString(),
      steps,
      currentStepIndex: 0,
      orchestrationMode,
      orchestrationReason: request.preferredMode ? `User preferred: ${request.preferredMode}` : reason,
      orchestrationSelection: request.preferredMode ? 'user' : 'auto',
      primaryModel: primary,
      fallbackModels: fallbacks,
      domainDetection: domainResult ? {
        fieldId: domainResult.primary_field?.field_id || '',
        fieldName: domainResult.primary_field?.field_name || '',
        fieldIcon: domainResult.primary_field?.field_icon || '📚',
        domainId: domainResult.primary_domain?.domain_id || '',
        domainName: domainResult.primary_domain?.domain_name || '',
        domainIcon: domainResult.primary_domain?.domain_icon || '📁',
        subspecialtyId: domainResult.primary_subspecialty?.subspecialty_id,
        subspecialtyName: domainResult.primary_subspecialty?.subspecialty_name,
        confidence: domainResult.detection_confidence,
        proficiencies: domainResult.merged_proficiencies as unknown as Record<string, number>,
      } : undefined,
      consciousnessActive: request.enableConsciousness ?? true,
      estimatedDurationMs: estimates.durationMs,
      estimatedCostCents: estimates.costCents,
      estimatedTokens: estimates.tokens,
      qualityTargets: {
        minConfidence: 0.7,
        targetAccuracy: 0.9,
        maxLatencyMs: request.maxLatencyMs || 30000,
        maxCostCents: request.maxCostCents || 50,
        requireVerification: request.enableVerification ?? true,
        requireConsistency: orchestrationMode === 'self_consistency',
      },
      learningEnabled: request.enableLearning ?? true,
      feedbackRequested: true,
      // User persistent context (solves LLM forgetting problem)
      userContext: userContextResult ? {
        enabled: true,
        entriesRetrieved: userContextResult.entries.length,
        systemPromptInjection: userContextResult.systemPromptInjection,
        totalRelevance: userContextResult.totalRelevance,
        retrievalTimeMs: userContextResult.retrievalTimeMs,
      } : undefined,
      // Library recommendations for generative UI outputs
      libraryRecommendations: libraryAssistResult?.enabled ? {
        enabled: true,
        libraries: libraryAssistResult.recommendations.map(r => ({
          id: r.library.libraryId,
          name: r.library.name,
          category: r.library.category,
          matchScore: r.matchScore,
          reason: r.reason,
          codeExample: r.codeExample,
        })),
        contextBlock: libraryAssistResult.contextBlock,
        retrievalTimeMs: libraryRetrievalTimeMs,
      } : undefined,
      // Workflow integration
      selectedWorkflow: workflowSelection.selectedWorkflow,
      workflowSteps: workflowSelection.workflowSteps,
      workflowConfig: {
        ...workflowSelection.selectedWorkflow?.defaultConfig,
        ...request.workflowParameterOverrides,
      },
      alternativeWorkflows: workflowSelection.alternatives,
      // Enhanced Learning System Integration
      enhancedLearning: {
        enabled: request.enableLearning !== false,
        patternCacheHit: !!patternCacheResult,
        cachedResponse: patternCacheResult?.successfulResponse,
        cachedResponseRating: patternCacheResult?.averageRating,
        activeLearningRequested: false, // Will be set after response based on config
        implicitFeedbackEnabled: enhancedLearningConfig?.implicitFeedbackEnabled || false,
      },
    };

    // Add performance metrics
    const planGenerationMs = Date.now() - startTime;
    plan.performanceMetrics = {
      routerLatencyMs: domainDetectionMs + modelSelectionMs,
      domainDetectionMs,
      modelSelectionMs,
      planGenerationMs,
      estimatedCostCents: estimates.costCents,
      modelCostPer1kTokens: primary.estimatedCostPer1kTokens,
      cacheHit,
    };

    // Step 7: Generate plan summary (using Gemini 3)
    plan.planSummary = await this.generatePlanSummary(plan);

    // Step 8: Select and track pre-prompt using learning service
    try {
      const prepromptResult = await prepromptLearningService.selectPreprompt({
        planId,
        tenantId: request.tenantId,
        userId: request.userId,
        orchestrationMode,
        modelId: primary.modelId,
        detectedDomainId: domainResult?.primary_domain?.domain_id,
        taskType: promptAnalysis.taskType,
        complexity: promptAnalysis.complexity,
        variables: {
          domain_name: domainResult?.primary_domain?.domain_name || 'general',
          domain_context: domainResult?.primary_domain?.domain_name || 'general knowledge',
          domain_confidence: String(Math.round((domainResult?.detection_confidence || 0.5) * 100)),
          subspecialty_name: domainResult?.primary_subspecialty?.subspecialty_name || '',
          field_name: domainResult?.primary_field?.field_name || '',
          complexity: promptAnalysis.complexity,
          task_type: promptAnalysis.taskType,
          key_topics: promptAnalysis.keyTopics.join(', '),
          detected_language: promptAnalysis.detectedLanguage,
          model_role: 'primary',
          other_models: plan.fallbackModels.map(m => m.modelName).join(', '),
          synthesis_strategy: orchestrationMode === 'multi_model' ? 'consensus' : 'single',
          proficiencies: domainResult?.merged_proficiencies 
            ? Object.entries(domainResult.merged_proficiencies)
                .filter(([_, v]) => (v as number) >= 7)
                .map(([k, v]) => `${k}: ${v}`)
                .join(', ')
            : '',
        },
      });

      plan.prepromptInstanceId = prepromptResult.selectionLog.instanceId;
      plan.prepromptTemplateCode = prepromptResult.selectedTemplate.templateCode;
      plan.systemPrompt = prepromptResult.renderedPreprompt.full;
    } catch (err) {
      // Pre-prompt selection failure is non-fatal, use default
      console.warn('Pre-prompt selection failed, using default:', err);
    }

    // Store in active plans
    this.activePlans.set(planId, plan);

    // Persist to database
    await this.savePlan(plan);

    return plan;
  }

  // ============================================================================
  // Plan Summary Generation (Gemini 3)
  // ============================================================================

  private async generatePlanSummary(plan: AGIBrainPlan): Promise<PlanSummary> {
    // Build a structured summary without calling external API for speed
    // The summary is generated locally for immediate response
    const stepsOverview = plan.steps.map(step => {
      switch (step.stepType) {
        case 'analyze': return `📊 Analyze your request to understand requirements`;
        case 'detect_domain': return `🧭 Identify the knowledge domain (${plan.domainDetection?.domainName || 'general'})`;
        case 'select_model': return `🤖 Select the best AI model (${plan.primaryModel.modelName})`;
        case 'prepare_context': return `📚 Load relevant context and background knowledge`;
        case 'ethics_check': return `⚖️ Evaluate ethical considerations`;
        case 'generate': return `✨ Generate comprehensive response using ${plan.orchestrationMode.replace(/_/g, ' ')} mode`;
        case 'synthesize': return `🔗 Synthesize information from multiple sources`;
        case 'verify': return `✅ Verify accuracy and consistency`;
        case 'refine': return `💎 Refine and polish the response`;
        case 'calibrate': return `🎯 Calibrate confidence levels`;
        case 'reflect': return `🪞 Self-reflect on response quality`;
        default: return `📋 ${step.title}`;
      }
    });

    const modeDescriptions: Record<OrchestrationMode, string> = {
      thinking: 'standard reasoning',
      extended_thinking: 'deep multi-step reasoning with extended thinking',
      coding: 'code generation with best practices',
      creative: 'creative writing with imagination',
      research: 'research synthesis with analysis',
      analysis: 'quantitative analysis',
      multi_model: 'consulting multiple AI models',
      chain_of_thought: 'explicit step-by-step reasoning',
      self_consistency: 'multiple samples for accuracy',
    };

    const domainContext = plan.domainDetection 
      ? `in the ${plan.domainDetection.domainName} domain`
      : 'across general knowledge';

    const complexityDescriptions: Record<string, string> = {
      simple: 'straightforward',
      moderate: 'moderately complex',
      complex: 'complex',
      expert: 'expert-level',
    };

    const headline = `I'll use ${modeDescriptions[plan.orchestrationMode]} to answer your ${complexityDescriptions[plan.promptAnalysis.complexity]} question ${domainContext}.`;

    const approach = plan.orchestrationMode === 'extended_thinking'
      ? `I'll take extra time to think deeply about this, breaking it down into clear reasoning steps before providing a thorough answer.`
      : plan.orchestrationMode === 'coding'
      ? `I'll focus on writing clean, well-documented code with proper error handling and best practices.`
      : plan.orchestrationMode === 'creative'
      ? `I'll draw on creative approaches to craft an engaging and imaginative response.`
      : plan.orchestrationMode === 'research'
      ? `I'll synthesize information systematically, providing well-structured analysis with supporting details.`
      : `I'll analyze your request carefully and provide a clear, accurate response.`;

    const estimatedTime = this.formatDuration(plan.estimatedDurationMs);

    const confidenceStatement = plan.domainDetection && plan.domainDetection.confidence > 0.8
      ? `I'm highly confident in this domain (${Math.round(plan.domainDetection.confidence * 100)}% match).`
      : plan.domainDetection && plan.domainDetection.confidence > 0.5
      ? `I have good familiarity with this domain (${Math.round(plan.domainDetection.confidence * 100)}% match).`
      : `I'll approach this with careful analysis across my general knowledge.`;

    const expectedOutcome = `You'll receive a ${complexityDescriptions[plan.promptAnalysis.complexity]} response tailored to your specific needs, using ${plan.primaryModel.modelName} optimized for this type of task.`;

    const warnings: string[] = [];
    if (plan.promptAnalysis.sensitivityLevel !== 'none') {
      warnings.push(`⚠️ This topic may involve sensitive information - I'll be extra careful with accuracy.`);
    }
    if (plan.promptAnalysis.complexity === 'expert') {
      warnings.push(`⚠️ This is a complex request - the response may take longer but will be more thorough.`);
    }
    if (plan.consciousnessActive) {
      warnings.push(`🧠 Self-reflection is enabled to ensure response quality.`);
    }

    return {
      headline,
      approach,
      stepsOverview,
      expectedOutcome,
      estimatedTime: `Estimated time: ${estimatedTime}`,
      confidenceStatement,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return 'less than a second';
    if (ms < 5000) return 'a few seconds';
    if (ms < 15000) return '10-15 seconds';
    if (ms < 30000) return '15-30 seconds';
    if (ms < 60000) return '30-60 seconds';
    return 'about a minute';
  }

  // ============================================================================
  // Prompt Analysis
  // ============================================================================

  private async analyzePrompt(prompt: string): Promise<PromptAnalysis> {
    const tokenCount = Math.ceil(prompt.length / 4);
    const words = prompt.split(/\s+/);
    const lowerPrompt = prompt.toLowerCase();

    // Detect complexity
    let complexity: PromptAnalysis['complexity'] = 'simple';
    if (tokenCount > 500 || words.length > 100) {
      complexity = 'expert';
    } else if (tokenCount > 200 || words.length > 50) {
      complexity = 'complex';
    } else if (tokenCount > 50 || words.length > 20) {
      complexity = 'moderate';
    }

    // Detect task type
    const codeIndicators = ['code', 'function', 'debug', 'programming', 'script', 'algorithm', 'implement', 'class', 'api'];
    const reasoningIndicators = ['why', 'explain', 'analyze', 'compare', 'reason', 'think', 'logic', 'deduce'];
    const creativeIndicators = ['write', 'story', 'creative', 'poem', 'essay', 'imagine', 'compose', 'create'];
    const researchIndicators = ['research', 'study', 'investigate', 'literature', 'review', 'analyze data'];
    const factualIndicators = ['what is', 'define', 'list', 'describe', 'who', 'when', 'where'];

    let taskType = 'general';
    if (codeIndicators.some(i => lowerPrompt.includes(i))) taskType = 'coding';
    else if (reasoningIndicators.some(i => lowerPrompt.includes(i))) taskType = 'reasoning';
    else if (creativeIndicators.some(i => lowerPrompt.includes(i))) taskType = 'creative';
    else if (researchIndicators.some(i => lowerPrompt.includes(i))) taskType = 'research';
    else if (factualIndicators.some(i => lowerPrompt.includes(i))) taskType = 'factual';

    // Detect requirements
    const requiresReasoning = reasoningIndicators.some(i => lowerPrompt.includes(i)) || complexity === 'complex' || complexity === 'expert';
    const requiresCreativity = creativeIndicators.some(i => lowerPrompt.includes(i));
    const requiresFactualAccuracy = factualIndicators.some(i => lowerPrompt.includes(i)) || lowerPrompt.includes('accurate') || lowerPrompt.includes('correct');
    const requiresCodeGeneration = codeIndicators.some(i => lowerPrompt.includes(i));
    const requiresMultiStep = lowerPrompt.includes('step') || lowerPrompt.includes('first') || lowerPrompt.includes('then') || complexity === 'complex';

    // Detect sensitivity
    const sensitiveTerms = ['medical', 'legal', 'financial', 'personal', 'private', 'confidential'];
    const sensitivityLevel = sensitiveTerms.filter(t => lowerPrompt.includes(t)).length > 0 
      ? (sensitiveTerms.filter(t => lowerPrompt.includes(t)).length > 2 ? 'high' : 'medium') 
      : 'none';

    // Extract key topics (simple extraction)
    const keyTopics = words
      .filter(w => w.length > 5 && /^[a-zA-Z]+$/.test(w))
      .slice(0, 5);

    return {
      originalPrompt: prompt,
      tokenCount,
      complexity,
      taskType,
      intentDetected: `${taskType} task with ${complexity} complexity`,
      requiresReasoning,
      requiresCreativity,
      requiresFactualAccuracy,
      requiresCodeGeneration,
      requiresMultiStep,
      keyTopics,
      detectedLanguage: 'en',
      sensitivityLevel,
    };
  }

  // ============================================================================
  // Domain Detection
  // ============================================================================

  private async detectDomain(prompt: string, override?: GeneratePlanRequest['domainOverride']) {
    try {
      const result = await domainTaxonomyService.detectDomain(prompt, {
        include_subspecialties: true,
        min_confidence: 0.3,
        max_results: 3,
        manual_override: override ? {
          field_id: override.fieldId,
          domain_id: override.domainId,
          subspecialty_id: override.subspecialtyId,
        } : undefined,
      });
      return result;
    } catch {
      return null;
    }
  }

  // ============================================================================
  // Workflow Selection - AGI chooses optimal workflow pattern
  // ============================================================================

  private async selectWorkflow(
    request: GeneratePlanRequest,
    analysis: PromptAnalysis,
    domain: Awaited<ReturnType<typeof this.detectDomain>>
  ): Promise<{
    selectedWorkflow?: AGIBrainPlan['selectedWorkflow'] & { defaultConfig?: Record<string, unknown> };
    workflowSteps?: AGIBrainPlan['workflowSteps'];
    alternatives?: AGIBrainPlan['alternativeWorkflows'];
  }> {
    // If user specified a workflow, use that
    if (request.preferredWorkflow) {
      try {
        const workflow = await orchestrationPatternsService.getWorkflow(request.preferredWorkflow);
        if (workflow) {
          const steps = await orchestrationPatternsService.getWorkflowSteps(workflow.workflowId);
          return {
            selectedWorkflow: {
              workflowId: workflow.workflowId,
              workflowCode: workflow.workflowCode,
              workflowName: workflow.commonName,
              description: workflow.description,
              category: workflow.category,
              selectionReason: 'User selected workflow',
              selectionConfidence: 1.0,
              selectionMethod: 'user',
              defaultConfig: workflow.defaultConfig,
            },
            workflowSteps: steps.map(s => ({
              bindingId: s.bindingId,
              stepOrder: s.stepOrder,
              methodCode: s.method.methodCode,
              methodName: s.method.methodName,
              parameterOverrides: { ...s.parameterOverrides, ...request.workflowParameterOverrides },
              dependsOn: (s.dependsOnSteps || []).map(String),
              isParallel: s.parallelExecution?.enabled || false,
              parallelConfig: s.parallelExecution?.enabled ? {
                models: s.parallelExecution.models || [],
                outputMode: s.parallelExecution.outputMode || 'single',
              } : undefined,
            })),
            alternatives: [],
          };
        }
      } catch {
        // Fall through to auto-selection
      }
    }

    // If AGI workflow selection is disabled, return empty
    if (request.allowAgiWorkflowSelection === false) {
      return {};
    }

    // AGI selects optimal workflow based on prompt analysis and domain
    try {
      const patternResult = await orchestrationPatternsService.selectPattern({
        prompt: request.prompt,
        tenantId: request.tenantId,
        taskType: analysis.taskType,
        complexity: analysis.complexity,
        qualityPriority: analysis.requiresFactualAccuracy ? 0.9 : 0.7,
        costSensitive: (request.maxCostCents ?? 100) < 20,
        excludePatterns: request.excludeWorkflows,
      });

      if (patternResult.selectedPattern) {
        const steps = await orchestrationPatternsService.getWorkflowSteps(
          patternResult.selectedPattern.workflowId
        );

        return {
          selectedWorkflow: {
            workflowId: patternResult.selectedPattern.workflowId,
            workflowCode: patternResult.selectedPattern.workflowCode,
            workflowName: patternResult.selectedPattern.commonName,
            description: patternResult.selectedPattern.description,
            category: patternResult.selectedPattern.category,
            selectionReason: patternResult.reasoning,
            selectionConfidence: patternResult.confidence,
            selectionMethod: domain ? 'domain_match' : 'auto',
            defaultConfig: patternResult.selectedPattern.defaultConfig,
          },
          workflowSteps: steps.map(s => ({
            bindingId: s.bindingId,
            stepOrder: s.stepOrder,
            methodCode: s.method.methodCode,
            methodName: s.method.methodName,
            parameterOverrides: { ...s.parameterOverrides, ...request.workflowParameterOverrides },
            dependsOn: (s.dependsOnSteps || []).map(String),
            isParallel: s.parallelExecution?.enabled || false,
            parallelConfig: s.parallelExecution?.enabled ? {
              models: s.parallelExecution.models || [],
              outputMode: s.parallelExecution.outputMode || 'single',
            } : undefined,
          })),
          alternatives: patternResult.alternativePatterns?.map(alt => ({
            workflowCode: alt.pattern.workflowCode,
            workflowName: alt.pattern.commonName,
            matchScore: alt.score,
            reason: alt.reason,
          })),
        };
      }
    } catch {
      // Fall through to no workflow
    }

    return {};
  }

  // ============================================================================
  // Orchestration Mode Selection
  // ============================================================================

  private determineOrchestrationMode(
    analysis: PromptAnalysis,
    domain: Awaited<ReturnType<typeof this.detectDomain>>
  ): { mode: OrchestrationMode; reason: string } {
    // Check proficiencies if domain detected
    if (domain?.merged_proficiencies) {
      const p = domain.merged_proficiencies;
      
      if (p.reasoning_depth >= 9 && p.multi_step_problem_solving >= 9) {
        return { mode: 'extended_thinking', reason: 'Complex reasoning required based on domain proficiencies' };
      }
      if (p.code_generation >= 8) {
        return { mode: 'coding', reason: 'High code generation proficiency required' };
      }
      if (p.creative_generative >= 8) {
        return { mode: 'creative', reason: 'Creative task based on domain proficiencies' };
      }
      if (p.research_synthesis >= 8) {
        return { mode: 'research', reason: 'Research synthesis task' };
      }
      if (p.mathematical_quantitative >= 8) {
        return { mode: 'analysis', reason: 'Quantitative analysis required' };
      }
    }

    // Fallback to analysis-based selection
    if (analysis.requiresCodeGeneration) {
      return { mode: 'coding', reason: 'Code generation detected in prompt' };
    }
    if (analysis.requiresCreativity) {
      return { mode: 'creative', reason: 'Creative writing detected in prompt' };
    }
    if (analysis.complexity === 'expert' || (analysis.requiresReasoning && analysis.requiresMultiStep)) {
      return { mode: 'extended_thinking', reason: 'Complex multi-step reasoning required' };
    }
    if (analysis.taskType === 'research') {
      return { mode: 'research', reason: 'Research task detected' };
    }
    if (analysis.requiresFactualAccuracy && analysis.sensitivityLevel !== 'none') {
      return { mode: 'self_consistency', reason: 'High accuracy required for sensitive topic' };
    }

    return { mode: 'thinking', reason: 'Standard thinking mode for general task' };
  }

  // ============================================================================
  // Model Selection
  // ============================================================================

  private async selectModels(
    tenantId: string,
    analysis: PromptAnalysis,
    domain: Awaited<ReturnType<typeof this.detectDomain>>,
    mode: OrchestrationMode,
    preferredModel?: string
  ): Promise<{ primary: ModelSelection; fallbacks: ModelSelection[]; fromCache: boolean }> {
    // Get matching models from domain taxonomy if available
    let matches: Array<{ model_id: string; model_name: string; provider: string; match_score: number; strengths: string[]; recommended: boolean }> = [];
    
    if (domain?.merged_proficiencies) {
      try {
        matches = await domainTaxonomyService.getMatchingModels(domain.merged_proficiencies, {
          max_models: 5,
          min_match_score: 50,
        });
      } catch {
        // Fallback to defaults
      }
    }

    // Default model based on mode
    const modeDefaults: Record<OrchestrationMode, string> = {
      thinking: 'anthropic/claude-3-5-sonnet-20241022',
      extended_thinking: 'anthropic/claude-3-5-sonnet-20241022',
      coding: 'anthropic/claude-3-5-sonnet-20241022',
      creative: 'anthropic/claude-3-5-sonnet-20241022',
      research: 'anthropic/claude-3-5-sonnet-20241022',
      analysis: 'anthropic/claude-3-5-sonnet-20241022',
      multi_model: 'anthropic/claude-3-5-sonnet-20241022',
      chain_of_thought: 'anthropic/claude-3-5-sonnet-20241022',
      self_consistency: 'anthropic/claude-3-5-sonnet-20241022',
    };

    // Select primary model
    let primaryModelId = preferredModel || (matches.find(m => m.recommended)?.model_id) || modeDefaults[mode];
    const primaryMatch = matches.find(m => m.model_id === primaryModelId);

    const primary: ModelSelection = {
      modelId: primaryModelId,
      modelName: primaryMatch?.model_name || primaryModelId.split('/').pop() || primaryModelId,
      provider: primaryMatch?.provider || primaryModelId.split('/')[0] || 'anthropic',
      selectionReason: preferredModel 
        ? 'User preferred model' 
        : primaryMatch 
          ? `Best domain match (${primaryMatch.match_score}%)`
          : `Default for ${mode} mode`,
      matchScore: primaryMatch?.match_score || 80,
      strengths: primaryMatch?.strengths || ['general', 'reasoning'],
      estimatedLatencyMs: 2000,
      estimatedCostPer1kTokens: 0.003,
    };

    // Select fallback models
    const fallbacks: ModelSelection[] = matches
      .filter(m => m.model_id !== primaryModelId)
      .slice(0, 2)
      .map(m => ({
        modelId: m.model_id,
        modelName: m.model_name,
        provider: m.provider,
        selectionReason: `Fallback option (${m.match_score}% match)`,
        matchScore: m.match_score,
        strengths: m.strengths,
        estimatedLatencyMs: 2500,
        estimatedCostPer1kTokens: 0.003,
      }));

    return { primary, fallbacks, fromCache: false };
  }

  // ============================================================================
  // Plan Steps Generation
  // ============================================================================

  private generatePlanSteps(
    analysis: PromptAnalysis,
    mode: OrchestrationMode,
    enableConsciousness: boolean,
    enableEthics: boolean,
    enableVerification: boolean
  ): PlanStep[] {
    const steps: PlanStep[] = [];
    let stepNumber = 1;

    // Step 1: Analyze (always)
    steps.push({
      stepId: uuidv4(),
      stepNumber: stepNumber++,
      stepType: 'analyze',
      title: 'Analyze Request',
      description: 'Understanding your request and identifying key requirements',
      status: 'completed', // Already done during planning
      servicesInvolved: ['metacognition'],
      primaryService: 'metacognition',
      confidence: 0.95,
    });

    // Step 2: Detect Domain (always)
    steps.push({
      stepId: uuidv4(),
      stepNumber: stepNumber++,
      stepType: 'detect_domain',
      title: 'Detect Knowledge Domain',
      description: 'Identifying the field and specialty for optimal model selection',
      status: 'completed', // Already done during planning
      servicesInvolved: ['domain_taxonomy'],
      primaryService: 'domain_taxonomy',
      confidence: 0.9,
    });

    // Step 3: Select Model (always)
    steps.push({
      stepId: uuidv4(),
      stepNumber: stepNumber++,
      stepType: 'select_model',
      title: 'Select Best Model',
      description: 'Choosing the optimal AI model based on domain proficiencies',
      status: 'completed', // Already done during planning
      servicesInvolved: ['brain_router', 'domain_taxonomy'],
      primaryService: 'brain_router',
      confidence: 0.95,
    });

    // Step 4: Prepare Context (if complex)
    if (analysis.complexity !== 'simple') {
      steps.push({
        stepId: uuidv4(),
        stepNumber: stepNumber++,
        stepType: 'prepare_context',
        title: 'Prepare Context',
        description: 'Loading relevant context and memory for informed response',
        status: 'pending',
        servicesInvolved: ['episodic_memory', 'knowledge_graph'],
        primaryService: 'episodic_memory',
        isOptional: true,
      });
    }

    // Step 5: Ethics Check (if enabled and sensitive)
    // Now uses ethics pipeline for both domain-specific and general ethics
    if (enableEthics && analysis.sensitivityLevel !== 'none') {
      steps.push({
        stepId: uuidv4(),
        stepNumber: stepNumber++,
        stepType: 'ethics_check',
        title: 'Ethics Evaluation (Prompt)',
        description: 'Checking prompt against domain and general ethics before generation',
        status: 'pending',
        servicesInvolved: ['ethics_pipeline', 'moral_compass', 'domain_ethics'],
        primaryService: 'ethics_pipeline',
        output: { level: 'prompt' },
      });
    }

    // Step 6: Generate (always - main step)
    const generateDescription = this.getGenerateDescription(mode);
    steps.push({
      stepId: uuidv4(),
      stepNumber: stepNumber++,
      stepType: 'generate',
      title: 'Generate Response',
      description: generateDescription,
      status: 'pending',
      servicesInvolved: ['response_synthesis', 'consciousness'],
      primaryService: 'response_synthesis',
    });

    // Step 6b: Synthesis Ethics Check (if enabled)
    // Checks generated response and can trigger rerun if violations found
    if (enableEthics) {
      steps.push({
        stepId: uuidv4(),
        stepNumber: stepNumber++,
        stepType: 'ethics_check',
        title: 'Ethics Evaluation (Synthesis)',
        description: 'Checking generated response against domain and general ethics, with rerun if needed',
        status: 'pending',
        servicesInvolved: ['ethics_pipeline', 'moral_compass', 'domain_ethics'],
        primaryService: 'ethics_pipeline',
        output: { level: 'synthesis', canTriggerRerun: true },
      });
    }

    // Step 7: Consciousness (if enabled and complex)
    if (enableConsciousness && (analysis.complexity === 'complex' || analysis.complexity === 'expert')) {
      steps.push({
        stepId: uuidv4(),
        stepNumber: stepNumber++,
        stepType: 'reflect',
        title: 'Self-Reflection',
        description: 'Reflecting on response quality and potential improvements',
        status: 'pending',
        servicesInvolved: ['consciousness', 'metacognition'],
        primaryService: 'consciousness',
        isParallel: false,
      });
    }

    // Step 8: Verify (if enabled)
    if (enableVerification && analysis.requiresFactualAccuracy) {
      steps.push({
        stepId: uuidv4(),
        stepNumber: stepNumber++,
        stepType: 'verify',
        title: 'Verify Response',
        description: 'Checking accuracy and consistency of the response',
        status: 'pending',
        servicesInvolved: ['error_detection', 'confidence_calibration'],
        primaryService: 'error_detection',
      });
    }

    // Step 9: Calibrate (always at end)
    steps.push({
      stepId: uuidv4(),
      stepNumber: stepNumber++,
      stepType: 'calibrate',
      title: 'Calibrate Confidence',
      description: 'Assessing confidence level and noting any uncertainties',
      status: 'pending',
      servicesInvolved: ['confidence_calibration'],
      primaryService: 'confidence_calibration',
      isOptional: true,
    });

    return steps;
  }

  private getGenerateDescription(mode: OrchestrationMode): string {
    const descriptions: Record<OrchestrationMode, string> = {
      thinking: 'Reasoning through the problem systematically',
      extended_thinking: 'Deep multi-step reasoning with extended thinking',
      coding: 'Generating code with best practices and documentation',
      creative: 'Crafting creative content with style and imagination',
      research: 'Synthesizing research with citations and analysis',
      analysis: 'Performing quantitative analysis with precision',
      multi_model: 'Consulting multiple models for consensus',
      chain_of_thought: 'Breaking down into explicit reasoning steps',
      self_consistency: 'Generating multiple solutions for consistency check',
    };
    return descriptions[mode];
  }

  // ============================================================================
  // Performance Estimation
  // ============================================================================

  private estimatePerformance(
    steps: PlanStep[],
    primaryModel: ModelSelection,
    analysis: PromptAnalysis
  ): { durationMs: number; costCents: number; tokens: number } {
    const stepTimes: Record<StepType, number> = {
      analyze: 100,
      detect_domain: 200,
      select_model: 100,
      prepare_context: 500,
      ethics_check: 300,
      generate: 3000,
      synthesize: 2000,
      verify: 500,
      refine: 1000,
      calibrate: 200,
      reflect: 400,
    };

    let durationMs = 0;
    for (const step of steps) {
      durationMs += stepTimes[step.stepType] || 500;
    }

    // Adjust for complexity
    if (analysis.complexity === 'complex') durationMs *= 1.5;
    if (analysis.complexity === 'expert') durationMs *= 2;

    // Estimate tokens
    const inputTokens = analysis.tokenCount;
    const outputTokens = analysis.complexity === 'expert' ? 2000 : analysis.complexity === 'complex' ? 1000 : 500;
    const tokens = inputTokens + outputTokens;

    // Estimate cost
    const costCents = (tokens / 1000) * primaryModel.estimatedCostPer1kTokens * 100;

    return { durationMs, costCents, tokens };
  }

  // ============================================================================
  // Plan Execution
  // ============================================================================

  async startExecution(planId: string): Promise<AGIBrainPlan> {
    const plan = this.activePlans.get(planId);
    if (!plan) throw new Error(`Plan not found: ${planId}`);

    plan.status = 'executing';
    plan.startedAt = new Date().toISOString();
    plan.currentStepIndex = 3; // Skip completed steps (analyze, detect, select)

    await this.updatePlanInDb(plan);
    return plan;
  }

  async updateStepStatus(
    planId: string,
    stepId: string,
    status: StepStatus,
    output?: Record<string, unknown>
  ): Promise<PlanStep | null> {
    const plan = this.activePlans.get(planId);
    if (!plan) return null;

    const step = plan.steps.find(s => s.stepId === stepId);
    if (!step) return null;

    step.status = status;
    if (status === 'in_progress') {
      step.startedAt = new Date().toISOString();
    } else if (status === 'completed' || status === 'failed') {
      step.completedAt = new Date().toISOString();
      if (step.startedAt) {
        step.durationMs = new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime();
      }
    }
    if (output) {
      step.output = output;
    }

    // Update current step index
    if (status === 'completed') {
      const nextPending = plan.steps.findIndex(s => s.status === 'pending');
      plan.currentStepIndex = nextPending >= 0 ? nextPending : plan.steps.length;
    }

    // Check if all steps complete
    if (plan.steps.every(s => s.status === 'completed' || s.status === 'skipped')) {
      plan.status = 'completed';
      plan.completedAt = new Date().toISOString();
      plan.totalDurationMs = new Date(plan.completedAt).getTime() - new Date(plan.startedAt || plan.createdAt).getTime();
    }

    await this.updatePlanInDb(plan);
    return step;
  }

  async completePlan(planId: string): Promise<AGIBrainPlan | null> {
    const plan = this.activePlans.get(planId);
    if (!plan) return null;

    plan.status = 'completed';
    plan.completedAt = new Date().toISOString();
    plan.totalDurationMs = new Date(plan.completedAt).getTime() - new Date(plan.startedAt || plan.createdAt).getTime();

    await this.updatePlanInDb(plan);
    return plan;
  }

  // ============================================================================
  // Plan Retrieval
  // ============================================================================

  async getPlan(planId: string): Promise<AGIBrainPlan | null> {
    // Check cache first
    if (this.activePlans.has(planId)) {
      return this.activePlans.get(planId)!;
    }

    // Load from database
    const result = await executeStatement(
      `SELECT * FROM agi_brain_plans WHERE plan_id = $1`,
      [{ name: 'planId', value: { stringValue: planId } }]
    );

    if (result.rows.length === 0) return null;

    const plan = this.mapPlanFromDb(result.rows[0] as Record<string, unknown>);
    this.activePlans.set(planId, plan);
    return plan;
  }

  async getActivePlans(tenantId: string, userId?: string): Promise<AGIBrainPlan[]> {
    const result = await executeStatement(
      `SELECT * FROM agi_brain_plans 
       WHERE tenant_id = $1 ${userId ? 'AND user_id = $2' : ''} 
       AND status IN ('ready', 'executing')
       ORDER BY created_at DESC
       LIMIT 10`,
      userId
        ? [
            { name: 'tenantId', value: { stringValue: tenantId } },
            { name: 'userId', value: { stringValue: userId } },
          ]
        : [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return result.rows.map(row => this.mapPlanFromDb(row as Record<string, unknown>));
  }

  async getRecentPlans(tenantId: string, userId: string, limit: number = 10): Promise<AGIBrainPlan[]> {
    const result = await executeStatement(
      `SELECT * FROM agi_brain_plans 
       WHERE tenant_id = $1 AND user_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    return result.rows.map(row => this.mapPlanFromDb(row as Record<string, unknown>));
  }

  // ============================================================================
  // Database Operations
  // ============================================================================

  private async savePlan(plan: AGIBrainPlan): Promise<void> {
    await executeStatement(
      `INSERT INTO agi_brain_plans (
        plan_id, tenant_id, user_id, session_id, conversation_id,
        prompt, prompt_analysis, status, created_at,
        steps, current_step_index, orchestration_mode, orchestration_reason,
        primary_model, fallback_models, domain_detection,
        consciousness_active, ethics_evaluation,
        estimated_duration_ms, estimated_cost_cents, estimated_tokens,
        quality_targets, learning_enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`,
      [
        { name: 'p1', value: { stringValue: plan.planId } },
        { name: 'p2', value: { stringValue: plan.tenantId } },
        { name: 'p3', value: { stringValue: plan.userId } },
        { name: 'p4', value: plan.sessionId ? { stringValue: plan.sessionId } : { isNull: true } },
        { name: 'p5', value: plan.conversationId ? { stringValue: plan.conversationId } : { isNull: true } },
        { name: 'p6', value: { stringValue: plan.prompt.substring(0, 10000) } },
        { name: 'p7', value: { stringValue: JSON.stringify(plan.promptAnalysis) } },
        { name: 'p8', value: { stringValue: plan.status } },
        { name: 'p9', value: { stringValue: plan.createdAt } },
        { name: 'p10', value: { stringValue: JSON.stringify(plan.steps) } },
        { name: 'p11', value: { longValue: plan.currentStepIndex } },
        { name: 'p12', value: { stringValue: plan.orchestrationMode } },
        { name: 'p13', value: { stringValue: plan.orchestrationReason } },
        { name: 'p14', value: { stringValue: JSON.stringify(plan.primaryModel) } },
        { name: 'p15', value: { stringValue: JSON.stringify(plan.fallbackModels) } },
        { name: 'p16', value: plan.domainDetection ? { stringValue: JSON.stringify(plan.domainDetection) } : { isNull: true } },
        { name: 'p17', value: { booleanValue: plan.consciousnessActive } },
        { name: 'p18', value: plan.ethicsEvaluation ? { stringValue: JSON.stringify(plan.ethicsEvaluation) } : { isNull: true } },
        { name: 'p19', value: { longValue: plan.estimatedDurationMs } },
        { name: 'p20', value: { doubleValue: plan.estimatedCostCents } },
        { name: 'p21', value: { longValue: plan.estimatedTokens } },
        { name: 'p22', value: { stringValue: JSON.stringify(plan.qualityTargets) } },
        { name: 'p23', value: { booleanValue: plan.learningEnabled } },
      ]
    );
  }

  private async updatePlanInDb(plan: AGIBrainPlan): Promise<void> {
    await executeStatement(
      `UPDATE agi_brain_plans SET
        status = $2, started_at = $3, completed_at = $4, total_duration_ms = $5,
        steps = $6, current_step_index = $7, ethics_evaluation = $8
       WHERE plan_id = $1`,
      [
        { name: 'p1', value: { stringValue: plan.planId } },
        { name: 'p2', value: { stringValue: plan.status } },
        { name: 'p3', value: plan.startedAt ? { stringValue: plan.startedAt } : { isNull: true } },
        { name: 'p4', value: plan.completedAt ? { stringValue: plan.completedAt } : { isNull: true } },
        { name: 'p5', value: plan.totalDurationMs !== undefined ? { longValue: plan.totalDurationMs } : { isNull: true } },
        { name: 'p6', value: { stringValue: JSON.stringify(plan.steps) } },
        { name: 'p7', value: { longValue: plan.currentStepIndex } },
        { name: 'p8', value: plan.ethicsEvaluation ? { stringValue: JSON.stringify(plan.ethicsEvaluation) } : { isNull: true } },
      ]
    );
  }

  private mapPlanFromDb(row: Record<string, unknown>): AGIBrainPlan {
    return {
      planId: String(row.plan_id),
      tenantId: String(row.tenant_id),
      userId: String(row.user_id),
      sessionId: row.session_id ? String(row.session_id) : undefined,
      conversationId: row.conversation_id ? String(row.conversation_id) : undefined,
      prompt: String(row.prompt),
      promptAnalysis: JSON.parse(String(row.prompt_analysis || '{}')),
      status: String(row.status) as PlanStatus,
      createdAt: String(row.created_at),
      startedAt: row.started_at ? String(row.started_at) : undefined,
      completedAt: row.completed_at ? String(row.completed_at) : undefined,
      totalDurationMs: row.total_duration_ms ? parseInt(String(row.total_duration_ms), 10) : undefined,
      steps: JSON.parse(String(row.steps || '[]')),
      currentStepIndex: parseInt(String(row.current_step_index || 0), 10),
      orchestrationMode: String(row.orchestration_mode) as OrchestrationMode,
      orchestrationReason: String(row.orchestration_reason || ''),
      orchestrationSelection: (String(row.orchestration_selection || 'auto') as 'auto' | 'user'),
      primaryModel: JSON.parse(String(row.primary_model || '{}')),
      fallbackModels: JSON.parse(String(row.fallback_models || '[]')),
      domainDetection: row.domain_detection ? JSON.parse(String(row.domain_detection)) : undefined,
      consciousnessActive: row.consciousness_active === true,
      ethicsEvaluation: row.ethics_evaluation ? JSON.parse(String(row.ethics_evaluation)) : undefined,
      estimatedDurationMs: parseInt(String(row.estimated_duration_ms || 0), 10),
      estimatedCostCents: parseFloat(String(row.estimated_cost_cents || 0)),
      estimatedTokens: parseInt(String(row.estimated_tokens || 0), 10),
      qualityTargets: JSON.parse(String(row.quality_targets || '{}')),
      learningEnabled: row.learning_enabled !== false,
      feedbackRequested: true,
    };
  }

  // ============================================================================
  // Delight Integration
  // ============================================================================

  /**
   * Get delight messages for the current plan state
   */
  async getDelightForPlan(
    planId: string,
    eventType: 'plan_start' | 'step_start' | 'step_complete' | 'plan_complete'
  ): Promise<WorkflowDelightResponse> {
    const plan = await this.getPlan(planId);
    if (!plan) {
      return { messages: [] };
    }

    const event: DelightWorkflowEvent = {
      eventType,
      plan,
      step: plan.steps[plan.currentStepIndex],
    };

    return delightOrchestrationService.getDelightForEvent(event, plan.userId, plan.tenantId);
  }

  /**
   * Start plan execution with delight messages
   */
  async startExecutionWithDelight(planId: string): Promise<{
    plan: AGIBrainPlan;
    delight: WorkflowDelightResponse;
  }> {
    const plan = await this.startExecution(planId);
    const delight = await this.getDelightForPlan(planId, 'plan_start');
    return { plan, delight };
  }

  /**
   * Update step status with delight messages
   */
  async updateStepWithDelight(
    planId: string,
    stepId: string,
    status: StepStatus,
    output?: Record<string, unknown>
  ): Promise<{
    step: PlanStep | null;
    delight: WorkflowDelightResponse;
  }> {
    const step = await this.updateStepStatus(planId, stepId, status, output);
    const eventType = status === 'in_progress' ? 'step_start' : 'step_complete';
    const delight = await this.getDelightForPlan(planId, eventType);
    return { step, delight };
  }

  /**
   * Complete plan with delight messages and achievements
   */
  async completePlanWithDelight(planId: string): Promise<{
    plan: AGIBrainPlan | null;
    delight: WorkflowDelightResponse;
  }> {
    const plan = await this.completePlan(planId);
    if (!plan) {
      return { plan: null, delight: { messages: [] } };
    }

    const event: DelightWorkflowEvent = {
      eventType: 'plan_complete',
      plan,
    };

    const delight = await delightOrchestrationService.getDelightForEvent(
      event,
      plan.userId,
      plan.tenantId
    );

    return { plan, delight };
  }

  /**
   * Get contextual loading message for current plan state
   */
  getLoadingMessage(plan: AGIBrainPlan): string {
    return delightOrchestrationService.getContextualMessage(plan);
  }

  /**
   * Get domain-specific loading message
   */
  getDomainMessage(plan: AGIBrainPlan): string {
    return delightOrchestrationService.getDomainLoadingMessage(plan);
  }

  /**
   * Get model dynamics message based on consensus
   */
  getModelDynamicsMessage(consensusLevel: 'strong' | 'moderate' | 'divergent'): string {
    return delightOrchestrationService.getModelDynamicsMessage(consensusLevel);
  }

  /**
   * Get synthesis quality message
   */
  getSynthesisMessage(confidence: number): string {
    return delightOrchestrationService.getSynthesisMessage(confidence);
  }

  // ============================================================================
  // Enhanced Learning Integration
  // ============================================================================

  /**
   * Record implicit feedback signal after user interaction
   */
  async recordImplicitSignal(
    planId: string,
    signalType: 'copy_response' | 'share_response' | 'thumbs_up' | 'thumbs_down' | 'regenerate_request' | 'follow_up_question' | 'abandon_conversation' | 'rephrase_question',
    messageId: string,
    options: { signalValue?: number; metadata?: Record<string, unknown> } = {}
  ): Promise<void> {
    const plan = this.activePlans.get(planId);
    if (!plan || !plan.enhancedLearning?.enabled || !plan.enhancedLearning?.implicitFeedbackEnabled) {
      return;
    }

    try {
      await enhancedLearningService.recordImplicitSignal(
        plan.tenantId,
        plan.userId,
        messageId,
        signalType,
        {
          conversationId: plan.conversationId,
          signalValue: options.signalValue,
          metadata: {
            ...options.metadata,
            planId,
            orchestrationMode: plan.orchestrationMode,
            modelUsed: plan.primaryModel.modelId,
            domain: plan.domainDetection?.domainName,
          },
        }
      );
    } catch (error) {
      console.warn('Failed to record implicit signal:', error);
    }
  }

  /**
   * Cache successful response pattern for future instant retrieval
   */
  async cacheSuccessfulResponse(
    planId: string,
    response: string,
    rating: number,
    messageId: string
  ): Promise<void> {
    const plan = this.activePlans.get(planId);
    if (!plan || !plan.enhancedLearning?.enabled || rating < 4) {
      return;
    }

    try {
      await enhancedLearningService.cacheSuccessfulPattern(
        plan.tenantId,
        plan.prompt,
        response,
        {
          domain: plan.domainDetection?.domainName,
          rating,
          modelUsed: plan.primaryModel.modelId,
          metadata: {
            planId,
            messageId,
            orchestrationMode: plan.orchestrationMode,
          },
        }
      );
    } catch (error) {
      console.warn('Failed to cache successful pattern:', error);
    }
  }

  /**
   * Check if active learning feedback should be requested
   */
  async shouldRequestActiveLearning(planId: string): Promise<{
    shouldRequest: boolean;
    prompt?: string;
    requestType?: 'rating' | 'correction' | 'preference';
  }> {
    const plan = this.activePlans.get(planId);
    if (!plan || !plan.enhancedLearning?.enabled) {
      return { shouldRequest: false };
    }

    try {
      const config = await enhancedLearningService.getConfig(plan.tenantId);
      if (!config?.activeLearningEnabled) {
        return { shouldRequest: false };
      }

      // Probabilistic request based on config
      if (Math.random() > config.activeLearningProbability) {
        return { shouldRequest: false };
      }

      // Determine request type based on context
      const requestType: 'rating' | 'correction' | 'preference' = 
        plan.promptAnalysis.complexity === 'expert' ? 'correction' :
        plan.orchestrationMode === 'creative' ? 'preference' : 'rating';

      const prompts: Record<string, string> = {
        rating: 'Was this response helpful? Your feedback helps me learn.',
        correction: 'If anything was incorrect, please let me know so I can improve.',
        preference: 'Did this match what you were looking for?',
      };

      // Update plan with active learning request
      if (plan.enhancedLearning) {
        plan.enhancedLearning.activeLearningRequested = true;
        plan.enhancedLearning.activeLearningPrompt = prompts[requestType];
      }

      return {
        shouldRequest: true,
        prompt: prompts[requestType],
        requestType,
      };
    } catch (error) {
      console.warn('Failed to check active learning:', error);
      return { shouldRequest: false };
    }
  }

  /**
   * Start conversation-level learning tracking
   */
  async startConversationLearning(planId: string): Promise<string | null> {
    const plan = this.activePlans.get(planId);
    if (!plan || !plan.enhancedLearning?.enabled || !plan.conversationId) {
      return null;
    }

    try {
      const config = await enhancedLearningService.getConfig(plan.tenantId);
      if (!config?.conversationLearningEnabled) {
        return null;
      }

      const learning = await enhancedLearningService.startConversationLearning(
        plan.tenantId,
        plan.userId,
        plan.conversationId
      );

      if (plan.enhancedLearning) {
        plan.enhancedLearning.conversationLearningId = learning.id;
      }

      return learning.id;
    } catch (error) {
      console.warn('Failed to start conversation learning:', error);
      return null;
    }
  }

  /**
   * Update conversation learning with interaction data
   */
  async updateConversationLearning(
    planId: string,
    updates: {
      incrementMessageCount?: boolean;
      addDomain?: string;
      conversationRating?: number;
      goalAchieved?: boolean;
      incrementCorrections?: boolean;
      incrementRegenerations?: boolean;
    }
  ): Promise<void> {
    const plan = this.activePlans.get(planId);
    if (!plan || !plan.enhancedLearning?.conversationLearningId) {
      return;
    }

    try {
      await enhancedLearningService.updateConversationLearning(
        plan.tenantId,
        plan.conversationId!,
        updates
      );
    } catch (error) {
      console.warn('Failed to update conversation learning:', error);
    }
  }

  /**
   * Get cached response if available (instant response for known patterns)
   */
  getCachedResponse(planId: string): { response: string; rating: number } | null {
    const plan = this.activePlans.get(planId);
    if (!plan?.enhancedLearning?.patternCacheHit || !plan.enhancedLearning.cachedResponse) {
      return null;
    }

    return {
      response: plan.enhancedLearning.cachedResponse,
      rating: plan.enhancedLearning.cachedResponseRating || 0,
    };
  }
}

export const agiBrainPlannerService = new AGIBrainPlannerService();
