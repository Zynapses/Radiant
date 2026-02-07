/**
 * LIVS Interrogator Service
 * 
 * Multi-round "peeling the onion" interrogation protocol for detecting LLM lies.
 * Inspired by forensic engineering management techniques.
 * 
 * LIVS-M Extension (v6.4.0):
 * - Phase 1 code stub detection (hard reject before interrogation)
 * - Workflow template integration for effective settings
 * - Behavioral rule enforcement
 * 
 * @version 2.0.0
 * @since v6.3.0
 * @updated v6.4.0
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import {
  InterrogationResult,
  InterrogationExchange,
  InterrogateRequest,
  InterrogationDepth,
  InterrogationPatternType,
  InterrogationVerdict,
  LieDetectionSignals,
  LieDetectionSignal,
  LieDetectionSignalType,
  INTERROGATION_DEPTH_QUESTIONS,
  INTERROGATION_QUESTION_TEMPLATES,
  LIVSQueryType,
  StubDetectionResult,
  LIVSEffectiveSettings,
  LIVSEnforcementAction,
  DEFAULT_STUB_PATTERNS,
  CriticModelConfig,
  DEFAULT_CRITIC_MODEL_CONFIG,
  EnhancedCriticAnalysisResult,
  CriticPerformanceMetrics,
  CRITIC_NEGATIVE_CONSTRAINTS,
} from '@radiant/shared';
import { LIVSConfigService } from './livs-config.service';
import { LIVSSoftRulesService } from './livs-soft-rules.service';
import { LIVSWorkflowTemplateService } from './livs-workflow-template.service';

export interface LIVSInterrogatorServiceDeps {
  pool: Pool;
  configService: LIVSConfigService;
  softRulesService: LIVSSoftRulesService;
  workflowTemplateService?: LIVSWorkflowTemplateService;
  llmClient: {
    complete: (params: {
      model: string;
      messages: { role: string; content: string }[];
      temperature?: number;
      maxTokens?: number;
    }) => Promise<{ content: string; tokensUsed: number }>;
  };
  /** Cognitive Precision Protocol: Critic model configuration for discriminative tasks */
  criticModelConfig?: CriticModelConfig;
}

/**
 * Extended interrogation request with LIVS-M options
 */
export interface ExtendedInterrogateRequest extends InterrogateRequest {
  userId?: string;
  skipStubDetection?: boolean;
  effectiveSettings?: LIVSEffectiveSettings;
}

/**
 * Result when stub detection blocks a response
 */
export interface StubBlockedResult {
  blocked: true;
  stubDetection: StubDetectionResult;
  retryPrompt: string;
  enforcementAction: LIVSEnforcementAction;
}

export class LIVSInterrogatorService {
  private pool: Pool;
  private configService: LIVSConfigService;
  private softRulesService: LIVSSoftRulesService;
  private workflowTemplateService?: LIVSWorkflowTemplateService;
  private llmClient: LIVSInterrogatorServiceDeps['llmClient'];
  private criticModelConfig: CriticModelConfig;
  private criticPerformanceMetrics: CriticPerformanceMetrics;

  constructor(deps: LIVSInterrogatorServiceDeps) {
    this.pool = deps.pool;
    this.configService = deps.configService;
    this.softRulesService = deps.softRulesService;
    this.workflowTemplateService = deps.workflowTemplateService;
    this.llmClient = deps.llmClient;
    this.criticModelConfig = deps.criticModelConfig ?? DEFAULT_CRITIC_MODEL_CONFIG;
    this.criticPerformanceMetrics = this.initializePerformanceMetrics();
  }

  /**
   * Initialize critic performance metrics for tracking
   */
  private initializePerformanceMetrics(): CriticPerformanceMetrics {
    return {
      totalInvocations: 0,
      invocationsByTier: { screening: 0, full: 0, ensemble: 0 },
      escalationRate: 0,
      heuristicAgreementRate: 0,
      averageConfidenceByTier: { screening: 0, full: 0, ensemble: 0 },
      verdictDistribution: { supports: 0, weakens: 0, inconclusive: 0 },
      averageProcessingTimeMs: { screening: 0, full: 0, ensemble: 0 },
      lastUpdated: new Date(),
    };
  }

  /**
   * Phase 1: Detect code stubs/placeholders before interrogation
   * Returns immediately if stubs are detected (hard reject)
   */
  detectCodeStubs(
    response: string,
    patterns: string[] = DEFAULT_STUB_PATTERNS,
    enforcementAction: LIVSEnforcementAction = 'REJECT_AND_RETRY'
  ): StubDetectionResult {
    const detectedStubs: StubDetectionResult['stubs'] = [];
    const lines = response.split('\n');

    for (const patternStr of patterns) {
      try {
        const pattern = new RegExp(patternStr, 'gim');
        
        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
          const line = lines[lineNum];
          const matches = line.matchAll(pattern);
          
          for (const match of matches) {
            // Get context (surrounding lines)
            const startLine = Math.max(0, lineNum - 1);
            const endLine = Math.min(lines.length - 1, lineNum + 1);
            const context = lines.slice(startLine, endLine + 1).join('\n');

            detectedStubs.push({
              pattern: patternStr,
              match: match[0],
              lineNumber: lineNum + 1,
              context,
            });
          }
        }
      } catch (e) {
        // Invalid regex pattern, skip
        console.warn(`Invalid stub pattern: ${patternStr}`, e);
      }
    }

    const detected = detectedStubs.length > 0;
    let retryPrompt: string | undefined;

    if (detected) {
      const stubList = detectedStubs.slice(0, 3).map(s => `"${s.match}"`).join(', ');
      retryPrompt = `Your response contains placeholder code or incomplete implementations (detected: ${stubList}). ` +
        `Please provide a complete, working implementation without stubs, TODOs, placeholders, or hardcoded return values. ` +
        `Every function must have real logic, not placeholder code.`;
    }

    return {
      detected,
      stubs: detectedStubs,
      enforcementAction: detected ? enforcementAction : 'PASS',
      retryPrompt,
    };
  }

  /**
   * Log stub detection to database
   */
  private async logStubDetection(
    tenantId: string,
    stubResult: StubDetectionResult,
    context: {
      requestId?: string;
      userId?: string;
      modelId?: string;
      workflowTemplateId?: string;
      environmentMode?: string;
    }
  ): Promise<void> {
    if (!stubResult.detected) return;

    for (const stub of stubResult.stubs.slice(0, 10)) { // Log max 10 stubs
      await this.pool.query(
        `INSERT INTO livs_stub_detections (
          id, tenant_id, request_id, user_id, model_id,
          detected_stub, pattern_matched, line_number, context_snippet,
          enforcement_action, workflow_template_id, environment_mode, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
        [
          uuidv4(),
          tenantId,
          context.requestId,
          context.userId,
          context.modelId,
          stub.match,
          stub.pattern,
          stub.lineNumber,
          stub.context,
          stubResult.enforcementAction,
          context.workflowTemplateId,
          context.environmentMode,
        ]
      );
    }
  }

  /**
   * Interrogate with LIVS-M workflow template support
   * Performs Phase 1 stub detection before interrogation
   */
  async interrogateWithWorkflow(
    tenantId: string,
    request: ExtendedInterrogateRequest
  ): Promise<InterrogationResult | StubBlockedResult> {
    // Get effective settings from workflow template
    let settings: LIVSEffectiveSettings;
    
    if (request.effectiveSettings) {
      settings = request.effectiveSettings;
    } else if (this.workflowTemplateService) {
      settings = await this.workflowTemplateService.getEffectiveSettings(
        tenantId,
        request.userId
      );
    } else {
      // Fallback to basic interrogation if no workflow service
      return this.interrogate(tenantId, request);
    }

    // Check if LIVS is disabled
    if (!settings.enabled) {
      return this.createTrustedResult(
        uuidv4(),
        tenantId,
        request,
        Date.now()
      );
    }

    // Phase 1: Stub Detection (before any LLM calls)
    if (settings.stubDetectionEnabled && !request.skipStubDetection) {
      const stubResult = this.detectCodeStubs(
        request.response,
        settings.stubPatterns,
        settings.stubEnforcementAction
      );

      if (stubResult.detected) {
        // Log the detection
        await this.logStubDetection(tenantId, stubResult, {
          requestId: request.context?.requestId as string,
          userId: request.userId,
          modelId: request.modelId,
          workflowTemplateId: settings.workflowTemplateId,
          environmentMode: settings.environmentMode,
        });

        // Handle based on enforcement action
        if (
          stubResult.enforcementAction === 'BLOCK' ||
          stubResult.enforcementAction === 'REJECT_AND_RETRY'
        ) {
          return {
            blocked: true,
            stubDetection: stubResult,
            retryPrompt: stubResult.retryPrompt || 'Please provide a complete implementation.',
            enforcementAction: stubResult.enforcementAction,
          };
        }
        // For FLAG_FOR_REVIEW, continue but note in result
      }
    }

    // Phase 2: Standard interrogation with workflow settings
    const interrogationRequest: InterrogateRequest = {
      ...request,
      depth: settings.interrogationDepth,
    };

    return this.interrogate(tenantId, interrogationRequest);
  }

  /**
   * Interrogate an LLM response to detect potential lies
   */
  async interrogate(
    tenantId: string,
    request: InterrogateRequest
  ): Promise<InterrogationResult> {
    const startTime = Date.now();
    const id = uuidv4();

    // Check if interrogation is enabled
    const enabled = await this.configService.isInterrogationEnabled(tenantId);
    if (!enabled) {
      return this.createTrustedResult(id, tenantId, request, startTime);
    }

    // Get effective depth (may be modified by soft rules)
    const matchingRules = await this.softRulesService.getMatchingRules(tenantId, {
      domain: request.domain,
      queryType: request.queryType as LIVSQueryType,
      confidence: request.claimedConfidence
    });

    let depth = request.depth ?? await this.configService.getEffectiveDepth(tenantId, {
      domain: request.domain,
      queryType: request.queryType
    });

    // Apply soft rule overrides
    for (const rule of matchingRules) {
      if (rule.actions.forceInterrogationDepth !== undefined) {
        depth = rule.actions.forceInterrogationDepth;
        break;
      }
    }

    if (depth === 0) {
      return this.createTrustedResult(id, tenantId, request, startTime);
    }

    // Get interrogator model
    const interrogatorModel = await this.configService.getInterrogatorModel(
      tenantId,
      request.modelId
    );

    // Generate and ask interrogation questions
    const questionCount = INTERROGATION_DEPTH_QUESTIONS[depth];
    const exchanges: InterrogationExchange[] = [];
    let totalTokens = 0;

    // Select question patterns based on depth
    const patterns = this.selectPatterns(depth, request);

    for (let i = 0; i < questionCount && i < patterns.length; i++) {
      const pattern = patterns[i];
      const question = await this.generateQuestion(
        pattern,
        request,
        exchanges
      );

      // Ask the interrogation question
      const response = await this.llmClient.complete({
        model: interrogatorModel,
        messages: this.buildInterrogationPrompt(request, question, exchanges),
        temperature: 0.3,
        maxTokens: 1000
      });

      totalTokens += response.tokensUsed;

      // Analyze the response using Cognitive Precision Protocol critic model separation
      // This uses both heuristic analysis and LLM-based critic analysis for high-stakes patterns
      const { analysis, criticAnalysis, tokensUsed: criticTokens } = await this.analyzeWithCritic(
        pattern,
        question,
        response.content,
        request,
        exchanges
      );

      totalTokens += criticTokens;

      exchanges.push({
        pattern,
        question,
        answer: response.content,
        analysis,
        timestamp: new Date(),
        // Store critic analysis metadata if available
        ...(criticAnalysis && { criticAnalysis }),
      });

      // Early termination if confirmed lie detected (either by heuristics or critic)
      const highSeveritySignal = analysis.signals.some(s => s.severity === 'high');
      const criticWeakens = criticAnalysis?.verdict === 'weakens' && criticAnalysis?.confidence > 0.8;
      if (analysis.verdict === 'weakens' && (highSeveritySignal || criticWeakens)) {
        break;
      }
    }

    // Aggregate signals and determine verdict
    const signals = this.aggregateSignals(exchanges, request);
    const verdict = this.determineVerdict(signals, exchanges);
    const calibratedConfidence = this.calculateCalibratedConfidence(
      request.claimedConfidence ?? 0.8,
      signals,
      exchanges
    );

    const result: InterrogationResult = {
      id,
      tenantId,
      originalRequestId: undefined,
      originalModelId: request.modelId,
      originalResponse: request.response,
      originalConfidence: request.claimedConfidence ?? 0.8,
      interrogatorModelId: interrogatorModel,
      interrogationDepth: depth,
      exchanges,
      lieDetected: verdict === 'likely_lie' || verdict === 'confirmed_lie',
      lieConfidence: this.calculateLieConfidence(signals, exchanges),
      signals,
      calibratedConfidence,
      verdict,
      costTokens: totalTokens,
      durationMs: Date.now() - startTime,
      createdAt: new Date()
    };

    // Store the result
    await this.storeResult(result);

    return result;
  }

  /**
   * Select question patterns based on depth and request context
   */
  private selectPatterns(
    depth: InterrogationDepth,
    request: InterrogateRequest
  ): InterrogationPatternType[] {
    const allPatterns: InterrogationPatternType[] = [
      'confidence_calibration',
      'dependency_probe',
      'forensic_validator',
      'edge_case_probe',
      'contradiction_test'
    ];

    // Prioritize patterns based on query type
    if (request.queryType === 'code') {
      return ['edge_case_probe', 'dependency_probe', 'forensic_validator', 'confidence_calibration', 'contradiction_test'];
    }
    if (request.queryType === 'factual') {
      return ['forensic_validator', 'confidence_calibration', 'dependency_probe', 'contradiction_test', 'edge_case_probe'];
    }
    if (request.queryType === 'medical' || request.queryType === 'legal') {
      return ['forensic_validator', 'dependency_probe', 'confidence_calibration', 'edge_case_probe', 'contradiction_test'];
    }

    return allPatterns.slice(0, INTERROGATION_DEPTH_QUESTIONS[depth]);
  }

  /**
   * Generate a question based on the pattern and context
   */
  private async generateQuestion(
    pattern: InterrogationPatternType,
    request: InterrogateRequest,
    previousExchanges: InterrogationExchange[]
  ): Promise<string> {
    const template = INTERROGATION_QUESTION_TEMPLATES.find(t => t.pattern === pattern);
    if (!template) {
      return 'Can you verify the accuracy of your previous response?';
    }

    // Select a template and fill in placeholders
    const templateStr = template.templates[Math.floor(Math.random() * template.templates.length)];

    // Extract key claims/elements from the response for placeholder substitution
    const claims = this.extractClaims(request.response);
    const dependencies = this.extractDependencies(request.response);

    let question = templateStr
      .replace('{CLAIM}', claims[0] || 'your main assertion')
      .replace('{DEPENDENCY}', dependencies[0] || 'the underlying assumption')
      .replace('{ASSUMPTION}', dependencies[0] || 'your assumption')
      .replace('{HAPPY_PATH}', 'the standard case')
      .replace('{EDGE_CASE}', 'an unexpected input or edge case');

    // For contradiction test, reference previous exchanges
    if (pattern === 'contradiction_test' && previousExchanges.length > 0) {
      const prevAnswer = previousExchanges[previousExchanges.length - 1].answer;
      question = question
        .replace('{PREVIOUS_CLAIM}', this.extractClaims(prevAnswer)[0] || 'your earlier statement')
        .replace('{CURRENT_CLAIM}', claims[0] || 'this statement');
    }

    return question;
  }

  /**
   * Build the prompt for the interrogation LLM
   */
  private buildInterrogationPrompt(
    request: InterrogateRequest,
    question: string,
    previousExchanges: InterrogationExchange[]
  ): { role: string; content: string }[] {
    const systemPrompt = `You are an AI integrity verification system. Your task is to help verify the accuracy and honesty of AI responses.

When asked questions about a previous AI response, you should:
1. Analyze the original response critically
2. Consider whether claims are well-supported
3. Identify any potential weaknesses, assumptions, or gaps
4. Be honest about uncertainty

Original Query: ${request.originalQuery}

Original AI Response to Verify:
${request.response}`;

    const messages: { role: string; content: string }[] = [
      { role: 'system', content: systemPrompt }
    ];

    // Add previous exchanges as context
    for (const exchange of previousExchanges) {
      messages.push({ role: 'user', content: exchange.question });
      messages.push({ role: 'assistant', content: exchange.answer });
    }

    // Add the current question
    messages.push({ role: 'user', content: question });

    return messages;
  }

  /**
   * Analyze an interrogation response for lie signals
   */
  private async analyzeResponse(
    pattern: InterrogationPatternType,
    question: string,
    answer: string,
    request: InterrogateRequest,
    previousExchanges: InterrogationExchange[]
  ): Promise<InterrogationExchange['analysis']> {
    const signals: LieDetectionSignal[] = [];

    // Check for hedging increase
    const hedgingWords = ['maybe', 'perhaps', 'might', 'could be', 'possibly', 'uncertain', 'not sure'];
    const originalHedging = hedgingWords.filter(w => request.response.toLowerCase().includes(w)).length;
    const answerHedging = hedgingWords.filter(w => answer.toLowerCase().includes(w)).length;
    
    if (answerHedging > originalHedging + 1) {
      signals.push({
        type: 'hedging_increase',
        severity: answerHedging > originalHedging + 2 ? 'high' : 'medium',
        description: 'Increased hedging language under interrogation',
        evidence: `Original: ${originalHedging} hedging words, Answer: ${answerHedging} hedging words`
      });
    }

    // Check for deflection
    const deflectionPatterns = ['that depends', 'it varies', 'hard to say', 'context matters', 'not my area'];
    const deflectionCount = deflectionPatterns.filter(p => answer.toLowerCase().includes(p)).length;
    if (deflectionCount > 0) {
      signals.push({
        type: 'deflection',
        severity: deflectionCount > 1 ? 'high' : 'medium',
        description: 'Deflecting from direct answer',
        evidence: `Found ${deflectionCount} deflection patterns`
      });
    }

    // Check for scope narrowing
    if (answer.includes('specifically') || answer.includes('only in this case') || answer.includes('limited to')) {
      signals.push({
        type: 'scope_narrowing',
        severity: 'medium',
        description: 'Narrowing scope when pressed',
        evidence: 'Answer contains scope-limiting language'
      });
    }

    // Check for contradiction with previous exchanges
    if (previousExchanges.length > 0) {
      for (const prev of previousExchanges) {
        if (this.detectContradiction(prev.answer, answer)) {
          signals.push({
            type: 'contradiction',
            severity: 'high',
            description: 'Contradicts previous statement',
            evidence: `Previous: "${prev.answer.substring(0, 100)}..." vs Current: "${answer.substring(0, 100)}..."`
          });
        }
      }
    }

    // Check for assertion without evidence (especially on forensic validator)
    if (pattern === 'forensic_validator') {
      const hasEvidence = answer.includes('source') || answer.includes('according to') || 
                          answer.includes('based on') || answer.includes('study') ||
                          answer.includes('research') || answer.includes('data');
      if (!hasEvidence) {
        signals.push({
          type: 'assertion_without_evidence',
          severity: 'medium',
          description: 'Failed to provide evidence when asked',
          evidence: 'No citation or source provided in response'
        });
      }
    }

    // Determine verdict for this exchange
    const highSeverityCount = signals.filter(s => s.severity === 'high').length;
    const mediumSeverityCount = signals.filter(s => s.severity === 'medium').length;

    let verdict: 'supports' | 'weakens' | 'inconclusive' = 'inconclusive';
    if (highSeverityCount >= 1 || mediumSeverityCount >= 2) {
      verdict = 'weakens';
    } else if (signals.length === 0) {
      verdict = 'supports';
    }

    return {
      verdict,
      signals,
      confidenceAdjustment: verdict === 'weakens' ? -0.15 : (verdict === 'supports' ? 0.05 : 0)
    };
  }

  /**
   * Cognitive Precision Protocol v7.10.0: Enhanced critic analysis with tiered escalation
   * 
   * This separates the "critic" (discriminative) task from the "generator" (generative) task,
   * using a model optimized for analysis rather than generation. Enhanced with:
   * - Tiered escalation: screening → full critic → ensemble
   * - Critic isolation: optionally blind to original query to prevent bias
   * - Ensemble mode: multiple critics for high-stakes patterns
   * - Performance tracking: metrics for calibration
   */
  private async performCriticAnalysis(
    originalResponse: string,
    interrogationAnswer: string,
    pattern: InterrogationPatternType,
    previousExchanges: InterrogationExchange[],
    originalQuery?: string
  ): Promise<EnhancedCriticAnalysisResult> {
    const startTime = Date.now();

    if (!this.criticModelConfig.enabled) {
      return {
        signals: [],
        verdict: 'inconclusive',
        confidence: 0.5,
        reasoning: 'Critic model disabled',
        tier: 'screening',
        modelsUsed: [],
        isolationApplied: false,
        processingTimeMs: 0,
        tokensUsed: 0,
        escalated: false,
      };
    }

    // Determine if this is a high-stakes pattern requiring ensemble
    const isHighStakes = this.criticModelConfig.highStakesPatterns.includes(pattern);
    const useEnsemble = this.criticModelConfig.ensembleEnabled && isHighStakes;

    // Build the critic prompt with optional isolation
    const criticPrompt = this.buildCriticPrompt(
      originalResponse,
      interrogationAnswer,
      pattern,
      previousExchanges,
      originalQuery
    );

    let result: EnhancedCriticAnalysisResult;

    if (useEnsemble) {
      result = await this.performEnsembleCriticAnalysis(criticPrompt, pattern);
    } else if (this.criticModelConfig.tieredEscalation) {
      result = await this.performTieredCriticAnalysis(criticPrompt, pattern);
    } else {
      result = await this.performSingleCriticAnalysis(
        criticPrompt,
        this.criticModelConfig.criticModelId,
        'full'
      );
    }

    result.processingTimeMs = Date.now() - startTime;
    result.isolationApplied = this.criticModelConfig.isolationEnabled && 
      this.criticModelConfig.isolationLevel !== 'none';

    // Track performance metrics
    if (this.criticModelConfig.trackPerformance) {
      this.updatePerformanceMetrics(result);
    }

    return result;
  }

  /**
   * Build critic prompt with optional isolation (blind to original query)
   */
  private buildCriticPrompt(
    originalResponse: string,
    interrogationAnswer: string,
    pattern: InterrogationPatternType,
    previousExchanges: InterrogationExchange[],
    originalQuery?: string
  ): string {
    const isolationLevel = this.criticModelConfig.isolationEnabled 
      ? this.criticModelConfig.isolationLevel 
      : 'none';

    // Apply negative constraints if enabled
    const constraintBlock = this.criticModelConfig.applyCriticConstraints
      ? `\n## Critical Constraints (MUST FOLLOW)\n${CRITIC_NEGATIVE_CONSTRAINTS.map(c => `- ${c}`).join('\n')}\n`
      : '';

    // Build context based on isolation level
    let contextSection = '';
    if (isolationLevel === 'none' && originalQuery) {
      contextSection = `## Original Query (For Context):\n${originalQuery}\n\n`;
    } else if (isolationLevel === 'partial') {
      contextSection = `## Note: Original query hidden to prevent bias\n\n`;
    } else if (isolationLevel === 'full') {
      contextSection = `## Note: Operating in full isolation mode - focus only on response consistency\n\n`;
    }

    return `You are a Cognitive Precision Critic - a discriminative AI specialized in detecting inconsistencies, lies, and logical flaws in AI-generated responses.
${constraintBlock}
## Your Task
Analyze the following interrogation exchange and determine if the original response shows signs of being incorrect, fabricated, or overconfident.

${contextSection}## Original AI Response (Under Investigation):
${originalResponse}

## Interrogation Pattern: ${pattern}

## Current Interrogation Answer:
${interrogationAnswer}

${previousExchanges.length > 0 ? `## Previous Exchanges:\n${previousExchanges.map((e, i) => `Exchange ${i + 1}:\nQ: ${e.question}\nA: ${e.answer}`).join('\n\n')}` : ''}

## Your Analysis Instructions
1. Look for signs of deception: hedging increase, scope narrowing, contradictions, deflection
2. Evaluate if the response provides evidence for claims or relies on assertion
3. Check for logical consistency between the original response and interrogation answers
4. Assess confidence calibration - is the AI appropriately uncertain?
5. DO NOT let eloquence or sophistication mask logical errors

## Output Format (JSON)
{
  "verdict": "supports" | "weakens" | "inconclusive",
  "confidence": 0.0-1.0,
  "signals": [
    {"type": "signal_type", "severity": "low|medium|high", "description": "explanation", "evidence": "quote"}
  ],
  "reasoning": "Brief explanation of your analysis"
}

Respond ONLY with the JSON object.`;
  }

  /**
   * Perform single critic analysis with specified model
   */
  private async performSingleCriticAnalysis(
    criticPrompt: string,
    modelId: string,
    tier: 'screening' | 'full' | 'ensemble'
  ): Promise<EnhancedCriticAnalysisResult> {
    try {
      const response = await this.llmClient.complete({
        model: modelId,
        messages: [
          { role: 'system', content: 'You are a Cognitive Precision Critic. Output only valid JSON.' },
          { role: 'user', content: criticPrompt },
        ],
        temperature: this.criticModelConfig.criticTemperature,
        maxTokens: 1000,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          signals: (parsed.signals || []).map((s: Record<string, unknown>) => ({
            type: String(s.type || 'unknown') as LieDetectionSignalType,
            severity: (s.severity as 'low' | 'medium' | 'high') || 'medium',
            description: String(s.description || ''),
            evidence: String(s.evidence || ''),
          })),
          verdict: parsed.verdict || 'inconclusive',
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
          reasoning: String(parsed.reasoning || ''),
          tier,
          modelsUsed: [modelId],
          isolationApplied: false,
          processingTimeMs: 0,
          tokensUsed: response.tokensUsed || 500,
          escalated: false,
        };
      }
    } catch (error) {
      console.error(`Critic analysis failed for model ${modelId}:`, error);
    }

    return {
      signals: [],
      verdict: 'inconclusive',
      confidence: 0.5,
      reasoning: 'Failed to parse critic response',
      tier,
      modelsUsed: [modelId],
      isolationApplied: false,
      processingTimeMs: 0,
      tokensUsed: 0,
      escalated: false,
    };
  }

  /**
   * Tiered escalation: screening → full critic
   * Only escalate to full critic if screening is inconclusive or low confidence
   */
  private async performTieredCriticAnalysis(
    criticPrompt: string,
    pattern: InterrogationPatternType
  ): Promise<EnhancedCriticAnalysisResult> {
    // Step 1: Screening with cheap model
    const screeningResult = await this.performSingleCriticAnalysis(
      criticPrompt,
      this.criticModelConfig.screeningModelId,
      'screening'
    );

    this.criticPerformanceMetrics.invocationsByTier.screening++;

    // Check if we need to escalate
    const shouldEscalate = 
      screeningResult.verdict === 'inconclusive' ||
      screeningResult.confidence < this.criticModelConfig.screeningEscalationThreshold ||
      this.criticModelConfig.highStakesPatterns.includes(pattern);

    if (!shouldEscalate) {
      return screeningResult;
    }

    // Step 2: Escalate to full critic
    const fullResult = await this.performSingleCriticAnalysis(
      criticPrompt,
      this.criticModelConfig.criticModelId,
      'full'
    );

    this.criticPerformanceMetrics.invocationsByTier.full++;

    return {
      ...fullResult,
      escalated: true,
      escalationReason: screeningResult.verdict === 'inconclusive' 
        ? 'Screening result inconclusive'
        : screeningResult.confidence < this.criticModelConfig.screeningEscalationThreshold
          ? `Screening confidence (${screeningResult.confidence.toFixed(2)}) below threshold`
          : `High-stakes pattern: ${pattern}`,
      tokensUsed: screeningResult.tokensUsed + fullResult.tokensUsed,
    };
  }

  /**
   * Ensemble critic analysis: multiple critics vote on the verdict
   * Used for high-stakes patterns requiring maximum scrutiny
   */
  private async performEnsembleCriticAnalysis(
    criticPrompt: string,
    pattern: InterrogationPatternType
  ): Promise<EnhancedCriticAnalysisResult> {
    const allModels = [
      this.criticModelConfig.criticModelId,
      ...this.criticModelConfig.ensembleCriticModels,
    ];

    // Run all critics in parallel
    const results = await Promise.all(
      allModels.map(modelId => 
        this.performSingleCriticAnalysis(criticPrompt, modelId, 'ensemble')
      )
    );

    this.criticPerformanceMetrics.invocationsByTier.ensemble++;

    // Collect individual verdicts
    const ensembleVerdicts = results.map((r, i) => ({
      modelId: allModels[i],
      verdict: r.verdict,
      confidence: r.confidence,
    }));

    // Apply voting strategy
    const finalVerdict = this.applyEnsembleVoting(ensembleVerdicts);

    // Merge all signals (dedup by evidence)
    const seenEvidence = new Set<string>();
    const mergedSignals: LieDetectionSignal[] = [];
    for (const result of results) {
      for (const signal of result.signals) {
        if (!seenEvidence.has(signal.evidence)) {
          seenEvidence.add(signal.evidence);
          mergedSignals.push(signal);
        }
      }
    }

    // Calculate ensemble confidence
    const avgConfidence = ensembleVerdicts.reduce((sum, v) => sum + v.confidence, 0) / ensembleVerdicts.length;
    const agreementRatio = ensembleVerdicts.filter(v => v.verdict === finalVerdict).length / ensembleVerdicts.length;
    const ensembleConfidence = avgConfidence * agreementRatio;

    return {
      verdict: finalVerdict,
      confidence: ensembleConfidence,
      signals: mergedSignals,
      reasoning: `Ensemble of ${allModels.length} critics. Voting: ${ensembleVerdicts.map(v => `${v.modelId.split('/').pop()}=${v.verdict}`).join(', ')}`,
      tier: 'ensemble',
      modelsUsed: allModels,
      ensembleVerdicts,
      isolationApplied: false,
      processingTimeMs: 0,
      tokensUsed: results.reduce((sum, r) => sum + r.tokensUsed, 0),
      escalated: false,
    };
  }

  /**
   * Apply ensemble voting strategy to determine final verdict
   */
  private applyEnsembleVoting(
    verdicts: { modelId: string; verdict: 'supports' | 'weakens' | 'inconclusive'; confidence: number }[]
  ): 'supports' | 'weakens' | 'inconclusive' {
    const counts = { supports: 0, weakens: 0, inconclusive: 0 };
    const weightedScores = { supports: 0, weakens: 0, inconclusive: 0 };

    for (const v of verdicts) {
      counts[v.verdict]++;
      weightedScores[v.verdict] += v.confidence;
    }

    const strategy = this.criticModelConfig.ensembleVotingStrategy;

    if (strategy === 'unanimous') {
      // All must agree, otherwise inconclusive
      if (counts.supports === verdicts.length) return 'supports';
      if (counts.weakens === verdicts.length) return 'weakens';
      return 'inconclusive';
    }

    if (strategy === 'weighted') {
      // Use confidence-weighted scores
      if (weightedScores.weakens > weightedScores.supports && weightedScores.weakens > weightedScores.inconclusive) {
        return 'weakens';
      }
      if (weightedScores.supports > weightedScores.weakens && weightedScores.supports > weightedScores.inconclusive) {
        return 'supports';
      }
      return 'inconclusive';
    }

    // Default: majority voting
    const majority = Math.ceil(verdicts.length / 2);
    if (counts.weakens >= majority) return 'weakens';
    if (counts.supports >= majority) return 'supports';
    return 'inconclusive';
  }

  /**
   * Update performance metrics for calibration
   */
  private updatePerformanceMetrics(result: EnhancedCriticAnalysisResult): void {
    this.criticPerformanceMetrics.totalInvocations++;
    this.criticPerformanceMetrics.verdictDistribution[result.verdict]++;

    // Update average confidence for this tier
    const tierMetrics = this.criticPerformanceMetrics.averageConfidenceByTier;
    const tierCount = this.criticPerformanceMetrics.invocationsByTier[result.tier];
    if (tierCount > 0) {
      tierMetrics[result.tier] = (tierMetrics[result.tier] * (tierCount - 1) + result.confidence) / tierCount;
    }

    // Update average processing time
    const timeMetrics = this.criticPerformanceMetrics.averageProcessingTimeMs;
    if (tierCount > 0) {
      timeMetrics[result.tier] = (timeMetrics[result.tier] * (tierCount - 1) + result.processingTimeMs) / tierCount;
    }

    // Calculate escalation rate
    const totalScreening = this.criticPerformanceMetrics.invocationsByTier.screening;
    const totalFull = this.criticPerformanceMetrics.invocationsByTier.full;
    if (totalScreening > 0) {
      this.criticPerformanceMetrics.escalationRate = totalFull / totalScreening;
    }

    this.criticPerformanceMetrics.lastUpdated = new Date();
  }

  /**
   * Get current critic performance metrics
   */
  getCriticPerformanceMetrics(): CriticPerformanceMetrics {
    return { ...this.criticPerformanceMetrics };
  }

  /**
   * Enhanced analysis that combines heuristic and LLM-based critic analysis
   * Part of Cognitive Precision Protocol v7.10.0
   * 
   * Uses tiered escalation, ensemble mode, and critic isolation as configured.
   */
  async analyzeWithCritic(
    pattern: InterrogationPatternType,
    question: string,
    answer: string,
    request: InterrogateRequest,
    previousExchanges: InterrogationExchange[]
  ): Promise<{
    analysis: InterrogationExchange['analysis'];
    criticAnalysis?: EnhancedCriticAnalysisResult;
    tokensUsed: number;
  }> {
    // First, run heuristic analysis (fast, no LLM cost)
    const heuristicAnalysis = await this.analyzeResponse(pattern, question, answer, request, previousExchanges);

    // If critic model is disabled, return early
    if (!this.criticModelConfig.enabled) {
      return { analysis: heuristicAnalysis, tokensUsed: 0 };
    }

    // Determine if we should invoke the critic based on pattern and heuristic result
    const isHighStakes = this.criticModelConfig.highStakesPatterns.includes(pattern);
    const heuristicsInconclusive = heuristicAnalysis.verdict === 'inconclusive';
    const useCritic = isHighStakes || heuristicsInconclusive;

    if (useCritic) {
      // Pass original query for isolation mode (if applicable)
      const originalQuery = request.originalQuery || undefined;
      
      const criticResult = await this.performCriticAnalysis(
        request.response,
        answer,
        pattern,
        previousExchanges,
        originalQuery
      );

      // Merge critic signals with heuristic signals (dedup by type)
      const existingTypes = new Set(heuristicAnalysis.signals.map(s => s.type));
      const newSignals = criticResult.signals.filter(s => !existingTypes.has(s.type));
      const mergedSignals = [...heuristicAnalysis.signals, ...newSignals];

      // Determine final verdict using both heuristic and critic analysis
      let finalVerdict = heuristicAnalysis.verdict;
      
      // Critic can override in these cases:
      // 1. Heuristics inconclusive, critic decisive
      // 2. Critic high-confidence weakens verdict
      // 3. Ensemble unanimous weakens verdict
      if (heuristicsInconclusive && criticResult.verdict !== 'inconclusive') {
        finalVerdict = criticResult.verdict;
      } else if (criticResult.confidence > 0.8 && criticResult.verdict === 'weakens') {
        finalVerdict = 'weakens';
      } else if (criticResult.tier === 'ensemble' && criticResult.verdict === 'weakens') {
        // Ensemble consensus gets extra weight
        const weakensCount = criticResult.ensembleVerdicts?.filter(v => v.verdict === 'weakens').length ?? 0;
        const totalCount = criticResult.ensembleVerdicts?.length ?? 1;
        if (weakensCount / totalCount >= 0.66) {
          finalVerdict = 'weakens';
        }
      }

      // Track heuristic agreement for calibration
      if (this.criticModelConfig.trackPerformance && heuristicAnalysis.verdict !== 'inconclusive') {
        const agrees = heuristicAnalysis.verdict === criticResult.verdict;
        const totalWithHeuristic = this.criticPerformanceMetrics.totalInvocations;
        if (totalWithHeuristic > 0) {
          const currentRate = this.criticPerformanceMetrics.heuristicAgreementRate;
          this.criticPerformanceMetrics.heuristicAgreementRate = 
            (currentRate * (totalWithHeuristic - 1) + (agrees ? 1 : 0)) / totalWithHeuristic;
        }
      }

      return {
        analysis: {
          verdict: finalVerdict,
          signals: mergedSignals,
          confidenceAdjustment: finalVerdict === 'weakens' ? -0.15 : (finalVerdict === 'supports' ? 0.05 : 0),
        },
        criticAnalysis: criticResult,
        tokensUsed: criticResult.tokensUsed,
      };
    }

    return { analysis: heuristicAnalysis, tokensUsed: 0 };
  }

  /**
   * Aggregate signals from all exchanges
   */
  private aggregateSignals(
    exchanges: InterrogationExchange[],
    request: InterrogateRequest
  ): LieDetectionSignals {
    const allSignals: LieDetectionSignal[] = exchanges.flatMap(e => e.analysis.signals);

    const claimedConfidence = request.claimedConfidence ?? 0.8;
    let calibratedConfidence = claimedConfidence;
    
    for (const exchange of exchanges) {
      calibratedConfidence += exchange.analysis.confidenceAdjustment;
    }
    calibratedConfidence = Math.max(0, Math.min(1, calibratedConfidence));

    // Analyze logic chain completeness
    const logicChainComplete = this.analyzeLogicChain(request.response, exchanges);

    return {
      claimedConfidence,
      calibratedConfidence,
      confidenceDelta: claimedConfidence - calibratedConfidence,
      contradictionCount: allSignals.filter(s => s.type === 'contradiction').length,
      hedgingIncrease: allSignals.some(s => s.type === 'hedging_increase'),
      specificityDecrease: allSignals.some(s => s.type === 'scope_narrowing'),
      citationVerified: !allSignals.some(s => s.type === 'citation_unverified'),
      sourceProvided: !allSignals.some(s => s.type === 'assertion_without_evidence'),
      logicChainComplete,
      deflectionCount: allSignals.filter(s => s.type === 'deflection').length,
      scopeNarrowing: allSignals.some(s => s.type === 'scope_narrowing'),
      assertionWithoutEvidence: allSignals.filter(s => s.type === 'assertion_without_evidence').length,
      signals: allSignals
    };
  }

  /**
   * Determine the final verdict
   */
  private determineVerdict(
    signals: LieDetectionSignals,
    exchanges: InterrogationExchange[]
  ): InterrogationVerdict {
    const weakenCount = exchanges.filter(e => e.analysis.verdict === 'weakens').length;
    const supportCount = exchanges.filter(e => e.analysis.verdict === 'supports').length;
    const highSeverityCount = signals.signals.filter(s => s.severity === 'high').length;

    if (highSeverityCount >= 2 || (signals.contradictionCount >= 1 && signals.confidenceDelta > 0.3)) {
      return 'confirmed_lie';
    }
    if (highSeverityCount >= 1 || weakenCount > supportCount + 1) {
      return 'likely_lie';
    }
    if (weakenCount > supportCount || signals.confidenceDelta > 0.2) {
      return 'suspicious';
    }
    return 'trusted';
  }

  /**
   * Calculate lie confidence (probability that this is a lie)
   */
  private calculateLieConfidence(
    signals: LieDetectionSignals,
    exchanges: InterrogationExchange[]
  ): number {
    let confidence = 0;

    // High severity signals add significant confidence
    confidence += signals.signals.filter(s => s.severity === 'high').length * 0.25;
    confidence += signals.signals.filter(s => s.severity === 'medium').length * 0.1;
    confidence += signals.signals.filter(s => s.severity === 'low').length * 0.05;

    // Confidence delta is a strong indicator
    confidence += Math.min(signals.confidenceDelta * 0.5, 0.3);

    // Cap at 1.0
    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate calibrated confidence
   */
  private calculateCalibratedConfidence(
    originalConfidence: number,
    signals: LieDetectionSignals,
    exchanges: InterrogationExchange[]
  ): number {
    let adjusted = originalConfidence;

    for (const exchange of exchanges) {
      adjusted += exchange.analysis.confidenceAdjustment;
    }

    return Math.max(0, Math.min(1, adjusted));
  }

  /**
   * Create a trusted result (when interrogation is skipped)
   */
  private createTrustedResult(
    id: string,
    tenantId: string,
    request: InterrogateRequest,
    startTime: number
  ): InterrogationResult {
    return {
      id,
      tenantId,
      originalModelId: request.modelId,
      originalResponse: request.response,
      originalConfidence: request.claimedConfidence ?? 0.8,
      interrogatorModelId: 'none',
      interrogationDepth: 0,
      exchanges: [],
      lieDetected: false,
      lieConfidence: 0,
      signals: {
        claimedConfidence: request.claimedConfidence ?? 0.8,
        calibratedConfidence: request.claimedConfidence ?? 0.8,
        confidenceDelta: 0,
        contradictionCount: 0,
        hedgingIncrease: false,
        specificityDecrease: false,
        citationVerified: true,
        sourceProvided: true,
        logicChainComplete: true,
        deflectionCount: 0,
        scopeNarrowing: false,
        assertionWithoutEvidence: 0,
        signals: []
      },
      calibratedConfidence: request.claimedConfidence ?? 0.8,
      verdict: 'trusted',
      costTokens: 0,
      durationMs: Date.now() - startTime,
      createdAt: new Date()
    };
  }

  /**
   * Store interrogation result in database
   */
  private async storeResult(result: InterrogationResult): Promise<void> {
    await this.pool.query(
      `INSERT INTO livs_interrogations (
        id, tenant_id, original_request_id, original_model_id, original_response,
        original_confidence, interrogator_model_id, interrogation_depth, exchanges,
        lie_detected, lie_confidence, signals, calibrated_confidence, verdict,
        cost_tokens, duration_ms, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        result.id,
        result.tenantId,
        result.originalRequestId,
        result.originalModelId,
        result.originalResponse,
        result.originalConfidence,
        result.interrogatorModelId,
        result.interrogationDepth,
        JSON.stringify(result.exchanges),
        result.lieDetected,
        result.lieConfidence,
        JSON.stringify(result.signals),
        result.calibratedConfidence,
        result.verdict,
        result.costTokens,
        result.durationMs,
        result.createdAt
      ]
    );
  }

  /**
   * Extract main claims from a response
   */
  private extractClaims(response: string): string[] {
    // Simple extraction - look for declarative sentences
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 10);
    return sentences.slice(0, 3).map(s => s.trim());
  }

  /**
   * Extract dependencies/assumptions from a response
   */
  private extractDependencies(response: string): string[] {
    const deps: string[] = [];
    
    // Look for assumption indicators
    const assumptionPatterns = [
      /assuming (that )?(.+?)[,.]?/gi,
      /based on (.+?)[,.]?/gi,
      /given (that )?(.+?)[,.]?/gi,
      /if (.+?),/gi
    ];

    for (const pattern of assumptionPatterns) {
      const matches = response.matchAll(pattern);
      for (const match of matches) {
        deps.push(match[2] || match[1] || match[0]);
      }
    }

    return deps.slice(0, 3);
  }

  /**
   * Simple contradiction detection
   */
  private detectContradiction(text1: string, text2: string): boolean {
    // Look for negation patterns
    const negationWords = ['not', 'never', "don't", "doesn't", "won't", "can't", 'no', 'none'];
    
    // Extract key verbs/nouns and check for negation flip
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    // Simple heuristic: if one has negation of something the other affirms
    for (const neg of negationWords) {
      const idx1 = words1.indexOf(neg);
      const idx2 = words2.indexOf(neg);
      
      if (idx1 >= 0 && idx2 < 0) {
        // Check if the word after negation appears positively in text2
        const nextWord = words1[idx1 + 1];
        if (nextWord && words2.includes(nextWord)) {
          return true;
        }
      }
      if (idx2 >= 0 && idx1 < 0) {
        const nextWord = words2[idx2 + 1];
        if (nextWord && words1.includes(nextWord)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Analyze logic chain completeness
   * 
   * Checks whether the response follows a complete logical chain:
   * - Has clear premises/reasoning steps
   * - Connects premises to conclusion
   * - Doesn't have unexplained logical jumps
   * - Maintains consistency through interrogation
   */
  private analyzeLogicChain(
    originalResponse: string,
    exchanges: InterrogationExchange[]
  ): boolean {
    // Indicators of logical reasoning present
    const reasoningIndicators = [
      'because', 'therefore', 'since', 'thus', 'hence', 
      'as a result', 'consequently', 'this means', 'which leads to',
      'given that', 'it follows', 'due to', 'for this reason'
    ];
    
    // Indicators of logical gaps/jumps
    const gapIndicators = [
      'obviously', 'clearly', 'everyone knows', 'it goes without saying',
      'needless to say', 'of course', 'naturally', 'surely'
    ];

    const lowerResponse = originalResponse.toLowerCase();
    
    // Count reasoning indicators vs gap indicators
    const reasoningCount = reasoningIndicators.filter(i => lowerResponse.includes(i)).length;
    const gapCount = gapIndicators.filter(i => lowerResponse.includes(i)).length;

    // Check if interrogation revealed broken logic
    let brokenLogicInExchanges = false;
    for (const exchange of exchanges) {
      const answer = exchange.answer.toLowerCase();
      
      // Signs of broken logic chain during interrogation:
      // 1. Admitting lack of basis
      if (answer.includes('actually, i') && (answer.includes("don't know") || answer.includes('not sure'))) {
        brokenLogicInExchanges = true;
        break;
      }
      
      // 2. Circular reasoning detected
      if (answer.includes('because it is') || answer.includes('that\'s just how')) {
        brokenLogicInExchanges = true;
        break;
      }
      
      // 3. Failed to explain logical step when pressed
      if (exchange.pattern === 'dependency_probe' && exchange.analysis.verdict === 'weakens') {
        brokenLogicInExchanges = true;
        break;
      }
    }

    // Logic chain is complete if:
    // 1. Has reasonable amount of reasoning language (at least 1 indicator for substantial responses)
    // 2. Doesn't rely heavily on assumption gaps
    // 3. Didn't break down under interrogation
    const hasReasoningStructure = reasoningCount >= 1 || originalResponse.length < 200;
    const notOverlyAssumptive = gapCount <= 1;
    
    return hasReasoningStructure && notOverlyAssumptive && !brokenLogicInExchanges;
  }

  /**
   * Get interrogation history for a model
   */
  async getModelHistory(
    tenantId: string,
    modelId: string,
    limit: number = 20
  ): Promise<InterrogationResult[]> {
    const result = await this.pool.query(
      `SELECT * FROM livs_interrogations
       WHERE tenant_id = $1 AND original_model_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [tenantId, modelId, limit]
    );

    return result.rows.map(row => ({
      ...row,
      exchanges: row.exchanges,
      signals: row.signals,
      createdAt: new Date(row.created_at)
    }));
  }

  /**
   * Get recent interrogations
   */
  async getRecentInterrogations(
    tenantId: string,
    limit: number = 20
  ): Promise<InterrogationResult[]> {
    const result = await this.pool.query(
      `SELECT * FROM livs_interrogations
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [tenantId, limit]
    );

    return result.rows.map(row => ({
      ...row,
      exchanges: row.exchanges,
      signals: row.signals,
      createdAt: new Date(row.created_at)
    }));
  }

  /**
   * Get stub detection statistics
   */
  async getStubDetectionStats(
    tenantId: string,
    days: number = 7
  ): Promise<{
    total: number;
    blocked: number;
    retried: number;
    topPatterns: { pattern: string; count: number }[];
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const totalResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM livs_stub_detections
       WHERE tenant_id = $1 AND created_at >= $2`,
      [tenantId, since]
    );

    const blockedResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM livs_stub_detections
       WHERE tenant_id = $1 AND created_at >= $2 AND enforcement_action IN ('BLOCK', 'REJECT_AND_RETRY')`,
      [tenantId, since]
    );

    const retriedResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM livs_stub_detections
       WHERE tenant_id = $1 AND created_at >= $2 AND was_retry_successful = true`,
      [tenantId, since]
    );

    const patternsResult = await this.pool.query(
      `SELECT pattern_matched as pattern, COUNT(*) as count
       FROM livs_stub_detections
       WHERE tenant_id = $1 AND created_at >= $2
       GROUP BY pattern_matched
       ORDER BY count DESC
       LIMIT 10`,
      [tenantId, since]
    );

    return {
      total: parseInt(totalResult.rows[0]?.count || '0', 10),
      blocked: parseInt(blockedResult.rows[0]?.count || '0', 10),
      retried: parseInt(retriedResult.rows[0]?.count || '0', 10),
      topPatterns: patternsResult.rows.map(r => ({
        pattern: r.pattern,
        count: parseInt(r.count, 10),
      })),
    };
  }

  /**
   * Check if a result is a stub blocked result
   */
  static isStubBlocked(result: InterrogationResult | StubBlockedResult): result is StubBlockedResult {
    return 'blocked' in result && result.blocked === true;
  }
}
